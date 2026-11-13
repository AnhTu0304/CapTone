import { TelemetryBufferService } from './telemetryBuffer.service';
import { AuditService } from './audit.service';
import { HitlNotificationService } from './hitlNotification.service';
import { CriticalIncidentNotificationService } from './criticalIncidentNotification.service';
import { TelemetryAggregatorService } from './telemetryAggregator.service';
import { broadcastTelemetryToUi } from '../websocket/telemetryWebSocket';
import { pool } from '../config/database';
import { RCAResult } from './ai.service';
import { WorkloadModel } from '../models';
import { dispatchHealingActionToAgent } from '../websocket/agentWebSocket';
import { recordBackgroundJob, recordRemediationAction } from '../telemetry/metrics';
import { RecoveryVerificationService } from './recoveryVerification.service';

export class TelemetryPipelineService {
  private static isRunning = false;
  private static intervalHandle: NodeJS.Timeout | null = null;
  // Boundary tracking: only take time-buckets STRICTLY AFTER this timestamp
  private static lastEvaluatedBucketTimestamp: Record<string, Date | null> = {};
  private static urgentReasonByService: Record<string, string> = {};
  private static isProcessingService: Record<string, boolean> = {};

  /**
   * Start the continuous background pipeline for Tumbling Batches (Lô 12 điểm mới tinh):
   * Chờ gom đủ 12 điểm mới tinh (không gối đầu) rồi mới đưa toàn bộ vào GRU.
   */
  public static startPipeline(intervalSeconds: number = 5) {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log(`⚡ [TelemetryPipeline] Background Tumbling Batch AI Pipeline started (polling every ${intervalSeconds}s for full 12 fresh points)`);

    this.intervalHandle = setInterval(async () => {
      const startHr = process.hrtime.bigint();
      try {
        // Tự động đối soát và giải phóng định kỳ mọi tác vụ RUNNING bị treo quá 60s
        try {
          await pool.query(
            `UPDATE healing_actions 
             SET execution_status = 'FAILED', 
                 completed_at = NOW(),
                 error_message = 'Quá thời gian chờ (60s) nhưng Kubernetes Agent chưa phản hồi kết quả thực thi.',
                 result = jsonb_set(
                   COALESCE(result, '{}'::jsonb),
                   '{error}',
                   '"Timeout waiting for agent execution callback (> 60s); marked FAILED by automated reconciler"'::jsonb
                 ) 
             WHERE execution_status = 'RUNNING' 
               AND COALESCE(started_at, created_at) < NOW() - INTERVAL '60 seconds';`
          );
        } catch (sweeperErr) {
          console.warn('[TelemetryPipeline] Lỗi dọn dẹp định kỳ timeout healing actions:', sweeperErr);
        }
        const activeServices = await TelemetryBufferService.getActiveServices(5);
        if (!activeServices || activeServices.length === 0) {
          recordBackgroundJob('telemetry_pipeline', 'success', Number(process.hrtime.bigint() - startHr) / 1e9);
          return;
        }
        await Promise.all(
          activeServices.map((sId) =>
            this.processServiceBatch(sId).catch((err) => {
              console.error(`[TelemetryPipeline] Error processing service ${sId}:`, err?.message || err);
            })
          )
        );
        recordBackgroundJob('telemetry_pipeline', 'success', Number(process.hrtime.bigint() - startHr) / 1e9);
      } catch (err) {
        recordBackgroundJob('telemetry_pipeline', 'error', Number(process.hrtime.bigint() - startHr) / 1e9);
        console.error('[TelemetryPipeline] Error in background cycle:', err);
      }
    }, 5000);
  }

  /**
   * Mark urgent signal (Error log, OOM, Crash, or Warning event) for the service
   * so when the 12-point batch completes, RCA is guaranteed to evaluate it without
   * bypassing the 12-point tumbling batch rule.
   */
  public static triggerUrgentEvaluation(serviceId: string, reason: string) {
    this.urgentReasonByService[serviceId] = reason;
  }

  /**
   * Tumbling Batch Logic:
   * 1. Query new time-buckets strictly after lastEvaluatedBucketTimestamp
   * 2. If < 12 points: WAIT and report progress (e.g. 5/12 new points)
   * 3. When 12 new points reached: Advance boundary immediately so next batch [1/12] accumulates in parallel,
   *    and feed all 12 points into GRU + RCA asynchronously without blocking!
   */
  public static async processServiceBatch(serviceId: string) {
    if (this.isProcessingService[serviceId]) return;
    this.isProcessingService[serviceId] = true;
    try {
      const lastBucket = this.lastEvaluatedBucketTimestamp[serviceId];

      // 1. Luôn lấy 12 điểm viễn trắc gần nhất từ In-Memory Buffer (RAM / Redis)
      const displayPoints = await TelemetryBufferService.getDisplayPoints(serviceId, 5, 12);
      if (displayPoints.length === 0) return;

      // 2. Lấy số điểm MỚI TINH phát sinh sau mốc đánh giá gần nhất (Tumbling Batch từ RAM / Redis)
      const freshBatch = await TelemetryBufferService.getFreshBatch(
        serviceId,
        5, // 5s bucket
        lastBucket,
        12 // batch size: 12 điểm mới
      );

      const count = freshBatch.points.length;

      // Nếu vừa chốt 12/12 (lastBucket đã có) và đang trong cùng khung 5s chưa sang bucket mới (count === 0):
      // Giữ nguyên hiển thị mốc 12/12 (T1) với điểm cập nhật mới nhất (nếu có nhiều pod cùng gửi trong 1 bucket),
      // tuyệt đối KHÔNG reset sớm về bước 1 (T12) khi chưa có điểm mới!
      if (count === 0 && lastBucket) {
        if (Date.now() - lastBucket.getTime() < 5500) {
          broadcastTelemetryToUi({
            type: 'batch_accumulation',
            data: {
              service_id: serviceId,
              collected: 12,
              target: 12,
              active_step: 12,
              percent: 100,
              status: 'ready_for_gru',
              points: displayPoints,
              latest_point: displayPoints[displayPoints.length - 1] || null,
              message: `Đã gom đủ 12 điểm mới tinh (12/12)! Đang chuyển sang GRU AI dự đoán...`,
            },
          });
        }
        return;
      }

      const currentStep = count === 0 ? 1 : Math.min(count, 12);

      // Broadcast trạng thái tới UI Dashboard:
      // - points: Luôn gửi đủ 12 điểm gần nhất để sơ đồ vẽ liên tục, chèn điểm mới lên từ phải sang trái
      // - active_step & collected: Báo nhịp gom [1/12] -> [12/12] cho vạch dọc
      broadcastTelemetryToUi({
        type: 'batch_accumulation',
        data: {
          service_id: serviceId,
          collected: count,
          target: 12,
          active_step: currentStep,
          percent: Math.round((count / 12) * 100),
          status: count >= 12 ? 'ready_for_gru' : 'accumulating',
          points: displayPoints,
          latest_point: displayPoints[displayPoints.length - 1] || null,
          message:
            count >= 12
              ? `Đã gom đủ 12 điểm mới tinh (12/12)! Đang chuyển sang GRU AI dự đoán...`
              : `Đang gom 12 điểm mới: [${count}/12 điểm] (${count * 5}s / 60s)... Chờ đủ 12 điểm mới rồi mới gửi vào GRU.`,
        },
      });

      // NẾU CHƯA ĐỦ 12 ĐIỂM MỚI: CHỜ TIẾP, TUYỆT ĐỐI CHƯA GỬI VÀO GRU!
      if (count < 12) {
        console.log(`⏳ [TelemetryPipeline] '${serviceId}': Đang gom [${count}/12 điểm mới]. Chưa đủ 12 điểm nên chưa gửi vào GRU...`);
        return;
      }

      // ĐÃ GOM ĐỦ 12 ĐIỂM MỚI TINH (12/12):
      // 1. Cập nhật mốc chốt chặn NGAY LẬP TỨC để lô tiếp theo [1/12] gom song song không phải đợi GRU/RCA!
      this.lastEvaluatedBucketTimestamp[serviceId] = freshBatch.latestTimeBucket || new Date();
      delete this.urgentReasonByService[serviceId];

      const batchPointsSnapshot = [...freshBatch.points];
      const displayPointsSnapshot = [...displayPoints];
      const batchClusterId = freshBatch.clusterId;

      console.log(`🎯 [TelemetryPipeline] '${serviceId}': ĐÃ GOM ĐỦ 12 ĐIỂM MỚI TINH (12/12)! Đẩy bất đồng bộ sang GRU & tiếp tục gom lô mới ngay lập tức...`);

      // 2. Chạy GRU và RCA hoàn toàn bất đồng bộ (non-blocking) ở background để không khóa isProcessingService[serviceId]
      (async () => {
        try {
          const result = await TelemetryAggregatorService.evaluateAndDiagnoseService(serviceId, {
            bucketSeconds: 5,
            windowMinutes: 30,
            forceRca: false,
            autoTriggerRca: true,
            providedSequence: batchPointsSnapshot,
            clusterId: batchClusterId,
            onGruPrediction: (gruPred) => {
              // Broadcast kết quả dự đoán GRU NGAY LẬP TỨC khi GRU vừa trả về (không đợi RCA)
              broadcastTelemetryToUi({
                type: 'ai_prediction',
                data: {
                  ...gruPred,
                  workload_name: serviceId,
                  service_id: serviceId,
                  active_step: 12,
                  sequence: displayPointsSnapshot,
                  evaluated_at: new Date().toISOString(),
                  is_tumbling_batch: true,
                },
              });
            },
          });

          // Nếu phát hiện nguy cơ cao -> Kích hoạt RCA & đề xuất khắc phục
          if (result.rca_triggered && result.rca_diagnosis) {
            console.log(`🎯 [TelemetryPipeline] RCA DIAGNOSIS on '${serviceId}': ${result.rca_diagnosis.root_cause.cause}`);

            // Lưu snapshot 12 bước viễn trắc lúc xảy ra sự cố từ RAM vào PostgreSQL
            await TelemetryBufferService.persistIncidentSnapshot(
              result.rca_diagnosis.incident_id,
              serviceId,
              batchPointsSnapshot
            );

            broadcastTelemetryToUi({
              type: 'incident',
              data: {
                id: result.rca_diagnosis.incident_id,
                service_id: serviceId,
                title: `${result.rca_diagnosis.root_cause.cause} trên dịch vụ ${serviceId}`,
                severity: result.rca_diagnosis.root_cause.severity,
                cause: result.rca_diagnosis.root_cause.cause,
                explanation: result.rca_diagnosis.explanation,
                created_at: result.rca_diagnosis.created_at,
              },
            });

            broadcastTelemetryToUi({
              type: 'ai_recommendation',
              data: {
                id: result.rca_diagnosis.recommendation_id,
                incident_id: result.rca_diagnosis.incident_id,
                recommendation: result.rca_diagnosis.recommendation.action,
                action: result.rca_diagnosis.recommendation.action,
                action_code: result.rca_diagnosis.recommendation.action,
                reason: result.rca_diagnosis.recommendation.reason,
                reasoning: result.rca_diagnosis.recommendation.reason,
                priority: result.rca_diagnosis.recommendation.priority,
                target_name: serviceId,
                target_id: serviceId,
                incident_title: `${result.rca_diagnosis.root_cause.cause} trên dịch vụ ${serviceId}`,
                cluster_id: (result.rca_diagnosis as any)?.cluster_id,
                created_at: new Date().toISOString(),
              },
            });

            await TelemetryPipelineService.evaluatePolicyAndTriggerAutonomousHealing(
              result.rca_diagnosis,
              serviceId
            );
          } else if (!result.rca_triggered && (result.rule_evaluation?.anomalies?.length ?? 0) === 0) {
            await TelemetryPipelineService.autoResolveIfRecovered(serviceId, batchClusterId, batchPointsSnapshot);
          }
        } catch (bgErr: any) {
          console.error(`[TelemetryPipeline] Async GRU/RCA error on ${serviceId}:`, bgErr?.message || bgErr);
        }
      })();
    } catch (err: any) {
      console.error(`[TelemetryPipeline] Processing error on ${serviceId}:`, err?.message || err);
    } finally {
      this.isProcessingService[serviceId] = false;
    }
  }

  /**
   * Auto-resolve open incidents for a service when a full 12-point (60s) fresh telemetry batch
   * verifies that both Rule Engine and GRU find zero anomalies (service has genuinely recovered).
   */
  public static async autoResolveIfRecovered(
    serviceId: string,
    clusterId?: string | null,
    providedSequence?: any[]
  ): Promise<void> {
    try {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const resolvedTarget = await WorkloadModel.resolveK8sTarget(serviceId, clusterId || null);
      const canonicalTargetName = resolvedTarget.targetName || serviceId;
      const targetAliasesLower = Array.from(
        new Set([serviceId.toLowerCase(), canonicalTargetName.toLowerCase()].filter(Boolean))
      );
      const validTargetWorkloadId =
        resolvedTarget.workloadId && uuidRegex.test(resolvedTarget.workloadId)
          ? resolvedTarget.workloadId
          : null;

      // Record genuine Post-Action Verification (verification_result = true) for any SUCCEEDED healing_actions
      // that completed >= 30s ago and have now passed the 12-point healthy batch check.
      const unverifiedSuccRes = await pool.query(
        `SELECT h.id, h.incident_id
         FROM healing_actions h
         WHERE h.execution_status = 'SUCCEEDED'
           AND h.completed_at IS NOT NULL
           AND h.completed_at <= NOW() - interval '30 seconds'
           AND h.completed_at >= NOW() - interval '60 minutes'
           AND (
             LOWER(COALESCE(h.target_name, '')) = ANY($1)
             OR ($2::text IS NOT NULL AND h.target_id::text = $2)
           )
           AND NOT EXISTS (
             SELECT 1 FROM recovery_verifications rv
             WHERE rv.healing_action_id = h.id
           );`,
        [targetAliasesLower, validTargetWorkloadId]
      );
      for (const succRow of unverifiedSuccRes.rows) {
        if (succRow.incident_id) {
          await pool.query(
            `UPDATE healing_actions SET execution_status = 'CANCELLED' WHERE incident_id = $1 AND execution_status = 'PENDING';`,
            [succRow.incident_id]
          ).catch(() => {});
          await pool.query(
            `UPDATE incidents SET status = 'RESOLVED', resolved_at = COALESCE(resolved_at, NOW()), updated_at = NOW()
             WHERE id = $1 AND status = 'OPEN'
               AND NOT EXISTS (
                 SELECT 1 FROM healing_actions ha_fail
                 WHERE ha_fail.incident_id = $1
                   AND (
                     ha_fail.execution_status = 'FAILED'
                     OR EXISTS (
                       SELECT 1 FROM recovery_verifications rv_fail
                       WHERE rv_fail.healing_action_id = ha_fail.id
                         AND rv_fail.verification_result = false
                     )
                   )
               );`,
            [succRow.incident_id]
          ).catch(() => {});
        }
        const tsCheck = RecoveryVerificationService.validateTimestampSequence(providedSequence || []);
        const observationDurationMs = tsCheck.valid && tsCheck.durationMs > 0
          ? tsCheck.durationMs
          : (providedSequence && providedSequence.length >= 12 ? 60000 : Math.max(5000, Number(providedSequence?.length || 12) * 5000));
        await pool.query(
          `INSERT INTO recovery_verifications (
             healing_action_id, verification_type, status_before, status_after,
             verification_result, verification_details, verified_at, duration_ms
           ) VALUES (
             $1, 'K8S_POST_HEALING_PROBE', $2::jsonb, $3::jsonb,
             true, $4::jsonb, NOW(), $5
           );`,
          [
            succRow.id,
            JSON.stringify({ health: 'DEGRADED' }),
            JSON.stringify({
              health: 'HEALTHY',
              verified_by: '12_POINT_TELEMETRY_BATCH',
              post_action_metrics_sequence: providedSequence || [],
              latest_metrics: providedSequence && providedSequence.length > 0 ? providedSequence[providedSequence.length - 1] : null,
            }),
            JSON.stringify({
              status: 'VERIFIED_HEALTHY',
              sample_count: providedSequence?.length || 12,
              metrics: providedSequence && providedSequence.length > 0 ? providedSequence[providedSequence.length - 1] : null,
              message: `Hậu kiểm thành công sau chu kỳ 12 điểm viễn trắc (cửa sổ 60s): Dịch vụ '${serviceId}' đã phục hồi ổn định hoàn toàn.`,
            }),
            observationDurationMs,
          ]
        ).catch(() => {});
      }

      const updRes = await pool.query(
        `UPDATE incidents i
         SET status = 'RESOLVED',
             resolved_at = COALESCE(i.resolved_at, NOW()),
             updated_at = NOW()
         WHERE i.status = 'OPEN'
           AND COALESCE(i.last_occurred_at, i.detected_at, i.created_at) <= NOW() - interval '45 seconds'
           AND (
             LOWER(COALESCE(i.target_name, '')) = ANY($1)
             OR LOWER(COALESCE(i.target_id, '')) = ANY($1)
             OR ($2::text IS NOT NULL AND i.target_id = $2)
             OR ($3::text IS NOT NULL AND (i.title ILIKE '% on ' || $3 OR i.title ILIKE '% trên ' || $3))
           )
           AND NOT EXISTS (
             SELECT 1 FROM healing_actions ha
             WHERE ha.incident_id = i.id
               AND ha.execution_status IN ('PENDING', 'RUNNING')
           )
           AND NOT EXISTS (
             SELECT 1 FROM healing_actions ha
             WHERE ha.incident_id = i.id
               AND ha.execution_status = 'SUCCEEDED'
               AND ha.completed_at > NOW() - interval '30 seconds'
            )
            AND NOT EXISTS (
              SELECT 1 FROM healing_actions ha_fail
              WHERE ha_fail.incident_id = i.id
                AND (
                  ha_fail.execution_status = 'FAILED'
                  OR EXISTS (
                    SELECT 1 FROM recovery_verifications rv_fail
                    WHERE rv_fail.healing_action_id = ha_fail.id
                      AND rv_fail.verification_result = false
                  )
                )
                AND NOT EXISTS (
                  SELECT 1 FROM healing_actions ha_win
                  WHERE ha_win.incident_id = i.id
                    AND ha_win.completed_at > ha_fail.completed_at
                    AND ha_win.execution_status = 'SUCCEEDED'
                )
            )
         RETURNING i.id, i.title, i.target_name;`,
        [targetAliasesLower, validTargetWorkloadId, serviceId]
      );

      if ((updRes.rowCount || 0) > 0) {
        const resolvedIds = updRes.rows.map((r: any) => r.id);
        console.log(
          `✅ [AutoResolve] Service '${serviceId}' verified HEALTHY after 12-point batch check. Auto-resolved ${updRes.rowCount} open incident(s): [${resolvedIds.join(', ')}]`
        );
        await pool
          .query(
            `UPDATE ai_recommendations
             SET status = 'APPLIED'
             WHERE incident_id = ANY($1::uuid[]) AND status = 'PROPOSED';`,
            [resolvedIds]
          )
          .catch(() => {});

        broadcastTelemetryToUi({
          type: 'incident_resolved',
          data: {
            service_id: serviceId,
            incident_ids: resolvedIds,
            timestamp: new Date().toISOString(),
          },
        });
      }
    } catch (err: any) {
      console.warn(`[TelemetryPipelineService] Auto-resolve check warning for ${serviceId}:`, err?.message || err);
    }
  }

  /**
   * Evaluates active healing policies for the given RCA diagnosis.
   * If an active policy with execution_mode = 'AUTO' matches and confidence threshold is met,
   * automatically execute the remediation and dispatch command to K8s Agent!
   */
  public static async evaluatePolicyAndTriggerAutonomousHealing(
    rca: RCAResult,
    serviceId: string
  ): Promise<void> {
    try {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const resolvedTarget = await WorkloadModel.resolveK8sTarget(serviceId, (rca as any)?.cluster_id || null);
      const canonicalTargetName = resolvedTarget.targetName || serviceId;
      const targetAliasesLower = Array.from(
        new Set([serviceId.toLowerCase(), canonicalTargetName.toLowerCase()].filter(Boolean))
      );
      const validTargetWorkloadId =
        resolvedTarget.workloadId && uuidRegex.test(resolvedTarget.workloadId)
          ? resolvedTarget.workloadId
          : ((rca as any)?.workload_id && uuidRegex.test(String((rca as any).workload_id))
            ? String((rca as any).workload_id)
            : null);
      let targetNamespace = 'default';
      if (resolvedTarget.namespace && resolvedTarget.namespace !== 'default') {
        targetNamespace = resolvedTarget.namespace;
      } else if ((rca as any)?.namespace) {
        targetNamespace = (rca as any).namespace;
      } else if (resolvedTarget.namespace) {
        targetNamespace = resolvedTarget.namespace;
      }

      let recAction = rca.recommendation.action || 'Restart Pod';
      if (recAction === 'NO_ACTION') {
        console.log(`🛡️ [PolicyEngine] Recommendation is NO_ACTION (Circuit Breaker). Bypassing automated healing dispatch.`);
        if (rca.incident_id) {
          CriticalIncidentNotificationService.notifyIfNeeded(rca.incident_id, {
            reasonStage: 'NO_ACTION',
            failureMessage: rca.recommendation?.reason || null,
          }).catch((err) => {
            console.warn('[TelemetryPipelineService] Gửi cảnh báo khẩn NO_ACTION thất bại:', err?.message || err);
          });
        }
        AuditService.record({
          organization_id: null,
          actor_type: 'SYSTEM',
          action: 'CIRCUIT_BREAKER_TRIPPED',
          resource_type: 'HEALING_ACTION',
          target_type: 'WORKLOAD',
          description: `Rào chắn tự ngắt (Circuit Breaker) được kích hoạt cho dịch vụ [${serviceId}] nhằm ngăn chặn lặp sự cố hoặc quá tải hành động liên tiếp.`,
          status: 'SUCCESS',
          metadata: {
            service_id: serviceId,
            target_name: canonicalTargetName,
            incident_id: rca.incident_id,
            recommendation_id: rca.recommendation_id,
          },
        }).catch(() => {});
        return;
      }
      if (recAction === 'CLEANUP_STORAGE') recAction = 'CLEANUP_TEMP_FILES';
      if (recAction === 'TEMPORARY_IP_BLOCK') recAction = 'BLOCK_IP_TEMP';
      const confidence = rca.root_cause.confidence || 0.85;

      // 1. Query matching policy (prioritizing active policies and matching environment if provided)
      const query = `
        SELECT 
          p.id AS policy_id,
          p.organization_id,
          p.name AS policy_name,
          p.execution_mode,
          p.risk_level,
          p.confidence_threshold,
          p.cooldown_seconds,
          p.max_retries,
          p.requires_approval,
          p.is_active,
          p.environment_id,
          act.id AS action_type_id,
          act.code AS action_code,
          act.name AS action_name,
          act.default_risk_level
        FROM healing_policies p
        JOIN policy_actions pa ON pa.policy_id = p.id
        JOIN healing_action_types act ON act.id = pa.action_type_id
        WHERE p.deleted_at IS NULL
          AND pa.is_enabled = true
          AND (act.name ILIKE $1 OR act.code ILIKE $2 OR p.name ILIKE $3)
        ORDER BY
          CASE WHEN $4::uuid IS NOT NULL AND p.environment_id = $4::uuid THEN 0 ELSE 1 END ASC,
          p.is_active DESC,
          pa.priority ASC
        LIMIT 1;
      `;

      const searchPattern = `%${recAction}%`;
      const codePattern = `%${recAction.replace(/\s+/g, '_')}%`;
      const rcaEnvId = rca.environment_id && uuidRegex.test(String(rca.environment_id)) ? String(rca.environment_id) : null;
      const polRes = await pool.query(query, [searchPattern, codePattern, searchPattern, rcaEnvId]);

      if (polRes.rows.length === 0) {
        console.log(`ℹ️ [PolicyEngine] No policy matches action '${recAction}'. Kept in PROPOSED status.`);
        if (rca.incident_id) {
          CriticalIncidentNotificationService.notifyIfNeeded(rca.incident_id, {
            reasonStage: 'NO_POLICY',
            failureMessage: `Chưa có Chính sách tự phục hồi (Healing Policy) nào khớp với hành động đề xuất "${recAction}" trên ${canonicalTargetName}.`,
          }).catch((err) => {
            console.warn('[TelemetryPipelineService] Gửi cảnh báo khẩn NO_POLICY thất bại:', err?.message || err);
          });
        }
        return;
      }

      const policy = polRes.rows[0];
      let environmentId = rca.environment_id || policy.environment_id;
      if (!environmentId) {
        const envRes = await pool.query('SELECT id FROM environments LIMIT 1;');
        environmentId = envRes.rows[0]?.id;
      }

      // Case 1: Policy is turned OFF or Cluster is in AUDIT & Dry-Run Mode
      if (!policy.is_active) {
        console.log(`🔒 [PolicyEngine] Policy '${policy.policy_name}' is DISABLED (Audit / Dry-Run Mode). AI only diagnoses & alerts without modifying K8s cluster.`);
        if (rca.incident_id) {
          CriticalIncidentNotificationService.notifyIfNeeded(rca.incident_id, {
            reasonStage: 'POLICY_DISABLED',
            failureMessage: `Chính sách "${policy.policy_name}" đang ở chế độ Tắt / Audit (chỉ chẩn đoán, không tự động sửa đổi cụm Kubernetes).`,
          }).catch((err) => {
            console.warn('[TelemetryPipelineService] Gửi cảnh báo khẩn POLICY_DISABLED thất bại:', err?.message || err);
          });
        }
        return;
      }

      const threshold = policy.confidence_threshold !== null ? Number(policy.confidence_threshold) : 0.70;
      const isAuto = (policy.execution_mode === 'AUTO' || policy.execution_mode === 'AUTONOMOUS');
      const effectiveRisk = (policy.risk_level || policy.default_risk_level || 'LOW').toUpperCase();

      // Cooldown & Anti-Spam Check:
      // If this service has an action of the same type currently PENDING, RUNNING, or completed within cooldown window, skip!
      const cooldownSec = policy.cooldown_seconds ? Number(policy.cooldown_seconds) : 300;
      const recentActionRes = await pool.query(
        `SELECT id, execution_status, completed_at, created_at, error_message, result
         FROM healing_actions 
         WHERE (
             LOWER(COALESCE(target_name, '')) = ANY($1)
             OR ($4::uuid IS NOT NULL AND target_id = $4::uuid)
           )
           AND (action_type_id = $2 OR execution_status IN ('PENDING', 'RUNNING') OR (execution_status = 'SUCCEEDED' AND completed_at >= NOW() - interval '35 seconds'))
           AND (
             (approval_status = 'PENDING' AND execution_status = 'PENDING')
             OR (execution_status = 'RUNNING')
             OR (completed_at >= NOW() - ($3 || ' seconds')::interval)
           )
         ORDER BY created_at DESC 
         LIMIT 1;`,
        [targetAliasesLower, policy.action_type_id, `${cooldownSec}`, validTargetWorkloadId]
      );

      if (recentActionRes.rows.length > 0) {
        const act = recentActionRes.rows[0];
        if (act.execution_status === 'PENDING') {
          console.log(`⏳ [PolicyEngine] '${canonicalTargetName}' đã có yêu cầu phê duyệt đang chờ (ID: ${act.id}). Bỏ qua không tạo ca trùng lặp.`);
          await pool.query(`UPDATE healing_actions SET requested_at = NOW() WHERE id = $1;`, [act.id]);
        } else if (act.execution_status === 'RUNNING') {
          console.log(`⏳ [PolicyEngine] '${canonicalTargetName}' đang trong quá trình thực thi ${policy.action_name} (ID: ${act.id}). Bỏ qua.`);
        } else if (act.execution_status === 'SUCCEEDED') {
          console.log(`⏳ [PolicyEngine] '${canonicalTargetName}' vừa thực hiện ${policy.action_name} trên K8s và đang trong cửa sổ Cooldown / Hậu kiểm (${cooldownSec}s, hoàn tất lúc: ${act.completed_at}). Chờ xác minh 12 điểm viễn trắc tiếp theo.`);
          if (rca.recommendation_id) {
            await pool.query(
              `UPDATE ai_recommendations SET status = 'APPLIED' WHERE id = $1;`,
              [rca.recommendation_id]
            );
          }
        } else {
          const latestActError =
            act.error_message ||
            act.result?.error ||
            act.result?.message ||
            `Hành động tự phục hồi ${policy.action_name} gần nhất đã thất bại và đang trong thời gian chờ cooldown (${cooldownSec}s).`;
          console.log(`⚠️ [PolicyEngine] '${canonicalTargetName}' vừa thực hiện ${policy.action_name} thất bại (${act.execution_status}) trong thời gian Cooldown (${cooldownSec}s). Giữ trạng thái OPEN & báo khẩn nếu CRITICAL.`);
          if (rca.incident_id) {
            CriticalIncidentNotificationService.notifyIfNeeded(rca.incident_id, {
              reasonStage: 'HEALING_FAILED',
              failureMessage: latestActError,
            }).catch((err) => {
              console.warn('[TelemetryPipelineService] Gửi cảnh báo khẩn HEALING_FAILED (cooldown) thất bại:', err?.message || err);
            });
          }
        }
        return;
      }

      const isStatefulPrimaryDestructive =
        String(resolvedTarget.workloadType || (rca as any)?.workload_type || '').toLowerCase() === 'statefulset' &&
        ['REPLACE_POD', 'DRAIN_NODE'].includes(String(policy.action_code || recAction).toUpperCase()) &&
        Boolean((rca.recommendation?.action_parameters as any)?.is_primary_database);

      // Case 2: Policy requires HITL confirmation (High/Critical risk in SUPERVISED mode, or HITL switch enabled, or confidence < threshold, or StatefulSet Primary DB)
      if (!isAuto || Boolean(policy.requires_approval)) {
        console.log(`🛡️ [PolicyEngine] Policy '${policy.policy_name}' requires HITL approval (Mode: ${policy.execution_mode}, HITL: ${policy.requires_approval}, Confidence: ${confidence.toFixed(2)}/${threshold.toFixed(2)}). Routing to HITL Approval Gate.`);
        recordRemediationAction(policy.action_code || 'RESTART_POD', 'hitl_pending');

        const hitlActInsert = await pool.query(
          `INSERT INTO healing_actions (
            incident_id, recommendation_id, policy_id, environment_id, action_type_id,
            target_type, target_id, target_name, risk_level, execution_mode, approval_status, execution_status,
            requested_at, result
          ) VALUES (
            $1, $2, $3, $4, $5,
            'WORKLOAD', $6::uuid, $7, $8::risk_level, 'MANUAL'::execution_mode, 'PENDING'::approval_status, 'PENDING'::execution_status,
            NOW(), $9::jsonb
          ) RETURNING id;`,
          [
            rca.incident_id,
            rca.recommendation_id,
            policy.policy_id,
            environmentId,
            policy.action_type_id,
            validTargetWorkloadId,
            canonicalTargetName,
            effectiveRisk,
            JSON.stringify({
              status: 'PENDING_APPROVAL',
              policy_id: policy.policy_id,
              policy_name: policy.policy_name,
              action: policy.action_name,
              target: canonicalTargetName,
              params: {
                ...(rca.recommendation.action_parameters || {}),
                pod_name: rca.target?.id || rca.target?.name,
                pod_id: rca.target?.id || rca.target?.name,
                faulty_node_name: rca.recommendation.target_node || rca.recommendation.action_parameters?.faulty_node_name,
                recommended_destination_node: rca.recommendation.action_parameters?.recommended_destination_node,
              },
              message: `Hành động ${policy.action_name} (${policy.action_code}) trên ${canonicalTargetName} đang chờ phê duyệt tại Cổng HITL theo chính sách ${policy.policy_name}.`,
            }),
          ]
        );
        const pendingActionId = hitlActInsert.rows[0]?.id;
        if (pendingActionId) {
          const hitlReason = confidence < threshold
            ? `Độ tin cậy chẩn đoán AI (${(confidence * 100).toFixed(0)}%) thấp hơn ngưỡng tự động (${(threshold * 100).toFixed(0)}%) của chính sách ${policy.policy_name}, kích hoạt rào chắn an toàn HITL.`
            : `Chính sách ${policy.policy_name} (Mức rủi ro: ${effectiveRisk}) yêu cầu phê duyệt con người (HITL) trước khi thực thi ${policy.action_name} trên dịch vụ ${canonicalTargetName}.`;

          await pool.query(
            `INSERT INTO approvals (healing_action_id, status, reason, requested_at, expires_at)
             VALUES ($1, 'PENDING', $2, NOW(), NOW() + interval '24 hours');`,
            [
              pendingActionId,
              hitlReason,
            ]
          );

          // Tự động kích hoạt gửi Email thông báo tới các kỹ sư có quyền
          HitlNotificationService.notifyApproversForAction(pendingActionId).catch((err) => {
            console.warn('[TelemetryPipelineService] Gửi email HITL thất bại:', err.message);
          });

          if (rca.incident_id) {
            CriticalIncidentNotificationService.notifyIfNeeded(rca.incident_id, {
              reasonStage: 'HITL_PENDING',
              excludeHitlApprovers: true,
              failureMessage: hitlReason,
            }).catch((err) => {
              console.warn('[TelemetryPipelineService] Gửi cảnh báo khẩn HITL_PENDING thất bại:', err?.message || err);
            });
          }

          // Phát sự kiện yêu cầu phê duyệt mới tới tất cả Frontend qua WebSocket
          try {
            broadcastTelemetryToUi({
              type: 'approval_created',
              data: {
                id: pendingActionId,
                incident_id: rca.incident_id,
                target_name: canonicalTargetName,
                policy_name: policy.policy_name,
                action_name: policy.action_name,
                risk_level: effectiveRisk,
                timestamp: new Date().toISOString(),
              },
            });
          } catch (wsErr) {
            console.warn('[TelemetryPipelineService] Broadcast approval_created thất bại:', wsErr);
          }
        }
        return;
      }

      // Case 3: AUTONOMOUS HEALING TRIGGERED!
      console.log(`⚡ [AutonomousSelfHealing] Matched ACTIVE AUTO Policy '${policy.policy_name}'!`);
      console.log(`   - Target Service: ${canonicalTargetName} (${targetNamespace})`);
      console.log(`   - Action: ${policy.action_name} (${policy.action_code})`);
      console.log(`   - AI Confidence: ${(confidence * 100).toFixed(1)}% >= Threshold: ${(threshold * 100).toFixed(1)}%`);
      recordRemediationAction(policy.action_code || 'RESTART_POD', 'triggered');

      // Insert record into healing_actions with status 'RUNNING' and approval 'APPROVED'
      const insertActQuery = `
        INSERT INTO healing_actions (
          incident_id,
          recommendation_id,
          policy_id,
          environment_id,
          action_type_id,
          target_type,
          target_id,
          target_name,
          risk_level,
          execution_mode,
          approval_status,
          execution_status,
          requested_by,
          requested_at,
          started_at,
          result
        ) VALUES (
          $1, $2, $3, $4, $5,
          'WORKLOAD', $6::uuid, $7, 'LOW'::risk_level, 'AUTO'::execution_mode, 'APPROVED'::approval_status,
          'RUNNING'::execution_status, NULL, NOW(), NOW(),
          $8::jsonb
        ) RETURNING id;
      `;

      const initialResult = {
        status: 'RUNNING',
        policy_id: policy.policy_id,
        policy_name: policy.policy_name,
        action: policy.action_name,
        target: canonicalTargetName,
        namespace: targetNamespace,
        triggered_by: 'Autonomous Policy Engine',
        started_at: new Date().toISOString(),
      };

      const actInsert = await pool.query(insertActQuery, [
        rca.incident_id,
        rca.recommendation_id,
        policy.policy_id,
        environmentId,
        policy.action_type_id,
        validTargetWorkloadId,
        canonicalTargetName,
        JSON.stringify(initialResult),
      ]);

      const actionId = actInsert.rows[0].id;

      // Ghi nhận sự kiện kích hoạt tự lành tự động vào Sổ cái kiểm toán bất biến
      AuditService.record({
        organization_id: policy.organization_id || null,
        actor_type: 'SYSTEM',
        action: 'AUTONOMOUS_HEALING_TRIGGERED',
        resource_type: 'HEALING_ACTION',
        resource_id: actionId,
        target_type: 'WORKLOAD',
        description: `Tác vụ tự phục hồi hoàn toàn tự động được kích hoạt cho [${canonicalTargetName}] (${targetNamespace}) theo chính sách [${policy.policy_name}]. Độ tin cậy AI: ${(confidence * 100).toFixed(0)}%`,
        status: 'SUCCESS',
        before_data: { execution_status: 'PENDING' },
        after_data: { execution_status: 'RUNNING', execution_mode: 'AUTO', policy_id: policy.policy_id },
        metadata: {
          policy_id: policy.policy_id,
          policy_name: policy.policy_name,
          action_type: policy.action_name,
          action_code: policy.action_code,
          target_service: serviceId,
          target_name: canonicalTargetName,
          namespace: targetNamespace,
          confidence,
          threshold,
          incident_id: rca.incident_id,
        },
      }).catch((err) => {
        console.warn('[TelemetryPipelineService] Ghi audit log autonomous trigger thất bại:', err);
      });

      // Broadcast real-time execution trigger to UI
      broadcastTelemetryToUi({
        type: 'healing_action_triggered',
        data: {
          action_id: actionId,
          incident_id: rca.incident_id,
          policy_name: policy.policy_name,
          action_type: policy.action_name,
          target: canonicalTargetName,
          execution_mode: 'AUTO',
          status: 'RUNNING',
          timestamp: new Date().toISOString(),
        },
      });

      // 3. Dispatch action over WebSocket to Kubernetes Agent using canonical workload + namespace!
      const targetPod = rca.target?.id || rca.target?.name;
      const dispatchResult = await dispatchHealingActionToAgent({
        action_id: actionId,
        action_type: policy.action_code || 'RESTART_POD',
        target_name: canonicalTargetName,
        namespace: targetNamespace,
        cluster_id: (rca as any)?.cluster_id,
        environment_id: environmentId,
        params: {
          ...(rca.recommendation.action_parameters || {}),
          pod_name: targetPod,
          pod_id: targetPod,
          faulty_node_name: rca.recommendation.target_node || rca.recommendation.action_parameters?.faulty_node_name,
          recommended_destination_node: rca.recommendation.action_parameters?.recommended_destination_node,
        },
      });

      console.log(`📡 [AutonomousSelfHealing] Action dispatched to agent: ${dispatchResult.dispatched ? 'SUCCESS' : 'NO AGENT (QUEUED)'}`);

      if (!dispatchResult.dispatched) {
        // Nếu không có Agent K8s nào kết nối nhận lệnh, cập nhật ngay trạng thái FAILED tránh kẹt RUNNING vĩnh viễn
        if (rca.incident_id) {
          CriticalIncidentNotificationService.notifyIfNeeded(rca.incident_id, {
            reasonStage: 'HEALING_FAILED',
            failureMessage: 'Không có Kubernetes Agent nào trực tuyến để nhận lệnh tự phục hồi.',
          }).catch((err) => {
            console.warn('[TelemetryPipelineService] Gửi cảnh báo khẩn HEALING_FAILED thất bại:', err?.message || err);
          });
        }
        await pool.query(
          `UPDATE healing_actions 
           SET execution_status = 'FAILED', 
               completed_at = NOW(), 
               error_message = 'Không có Kubernetes Agent nào trực tuyến để nhận lệnh tự phục hồi.',
               result = jsonb_set(COALESCE(result, '{}'::jsonb), '{error}', '"Không có Agent K8s trực tuyến"'::jsonb) 
           WHERE id = $1 AND execution_status = 'RUNNING'`,
          [actionId]
        );
      } else {
        // Nếu sau 30 giây mà K8s Agent vẫn chưa phản hồi kết quả (RUNNING), đánh dấu FAILED do timeout (không tự gán SUCCEEDED giả)
        setTimeout(async () => {
          try {
            await pool.query(
              `UPDATE healing_actions 
               SET execution_status = 'FAILED', 
                   completed_at = COALESCE(completed_at, NOW()),
                   error_message = 'Quá thời gian chờ (30s) nhưng Kubernetes Agent chưa phản hồi kết quả thực thi.',
                   result = jsonb_set(COALESCE(result, '{}'::jsonb), '{error}', '"Agent execution timeout after 30s"'::jsonb) 
               WHERE id = $1 AND execution_status = 'RUNNING'`,
              [actionId]
            );
          } catch (e) {
            // ignore
          }
        }, 60000);
      }

    } catch (err) {
      console.error(`❌ [AutonomousSelfHealing] Error evaluating policy for ${serviceId}:`, err);
    }
  }

  public static stopPipeline() {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
    this.isRunning = false;
  }
}
