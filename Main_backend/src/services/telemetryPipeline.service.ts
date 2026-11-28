import { TelemetryBufferService } from './telemetryBuffer.service';
import { AuditService } from './audit.service';
import { HitlNotificationService } from './hitlNotification.service';
import { CriticalIncidentNotificationService } from './criticalIncidentNotification.service';
import { TelemetryAggregatorService } from './telemetryAggregator.service';
import { broadcastTelemetryToUi } from '../websocket/telemetryWebSocket';
import { pool, resolveAutoExecutionMode } from '../config/database';
import { RCAResult } from './ai.service';
import { WorkloadModel } from '../models';
import { dispatchHealingActionToAgent } from '../websocket/agentWebSocket';
import { recordBackgroundJob, recordRemediationAction } from '../telemetry/metrics';
import { RecoveryVerificationService } from './recoveryVerification.service';
import {
  isDatabaseCacheWorkload,
  isInfrastructureControlPlaneWorkload,
} from '../utils/systemServiceFilter';
import { HealingActionModel } from '../models/healingAction.model';
import { isValidUuid, runWithTenantContext } from '../config/dbContext';

export class TelemetryPipelineService {
  private static isRunning = false;
  private static intervalHandle: NodeJS.Timeout | null = null;
  private static readonly STATE_TTL_MS = 30 * 60 * 1000;
  // Boundary tracking: only take time-buckets STRICTLY AFTER this timestamp
  private static lastEvaluatedBucketTimestamp: Record<string, Date | null> = {};
  private static urgentReasonByService: Record<string, string> = {};
  private static isProcessingService: Record<string, boolean> = {};

  private static buildLockKey(serviceId: string, organizationId: string, clusterId: string): string {
    return `${organizationId.trim().toLowerCase()}:${clusterId.trim()}:${serviceId.trim()}`;
  }

  private static pruneStalePipelineState(activeLockKeys: Set<string>, nowMs: number = Date.now()): void {
    for (const [key, ts] of Object.entries(this.lastEvaluatedBucketTimestamp)) {
      if (!activeLockKeys.has(key) && !this.isProcessingService[key]) {
        if (!ts || nowMs - ts.getTime() > this.STATE_TTL_MS) {
          delete this.lastEvaluatedBucketTimestamp[key];
          delete this.urgentReasonByService[key];
          delete this.isProcessingService[key];
        }
      }
    }
  }

  /**
   * Execute one tenant-aware background pipeline cycle across all active tenant buffers.
   */
  public static async runPipelineCycle(): Promise<void> {
    const startHr = process.hrtime.bigint();
    try {
      // Tự động đối soát và giải phóng định kỳ mọi tác vụ RUNNING bị treo quá 60s theo từng tổ chức
      try {
        const orgIdsRes = await pool.query(`SELECT id FROM public.fn_list_active_organization_ids();`);
        for (const row of orgIdsRes.rows) {
          await runWithTenantContext(row.id, null, async () => {
            await pool.query(
              `UPDATE healing_actions h
               SET execution_status = 'FAILED',
                   completed_at = NOW(),
                   error_message = 'Quá thời gian chờ (60s) nhưng Kubernetes Agent chưa phản hồi kết quả thực thi.',
                   result = jsonb_set(
                     COALESCE(h.result, '{}'::jsonb),
                     '{error}',
                     '"Timeout waiting for agent execution callback (> 60s); marked FAILED by automated reconciler"'::jsonb
                   )
               WHERE h.execution_status = 'RUNNING'
                 AND COALESCE(h.result->>'agent_status', '') NOT IN ('COMPLETED', 'SUCCEEDED')
                 AND COALESCE(h.started_at, h.created_at) < NOW() - INTERVAL '60 seconds'
                 AND EXISTS (SELECT 1 FROM environments e WHERE e.id = h.environment_id AND e.organization_id = $1::uuid);`,
              [row.id]
            );
          }).catch(() => {});
        }
      } catch (sweeperErr) {
        console.warn('[TelemetryPipeline] Lỗi dọn dẹp định kỳ timeout healing actions:', sweeperErr);
      }

      const activeTargets = await TelemetryBufferService.getActiveTenantBuffers(5);
      const activeLockKeys = new Set(
        activeTargets.map((t) => this.buildLockKey(t.serviceId, t.organizationId, t.clusterId))
      );
      this.pruneStalePipelineState(activeLockKeys);

      if (!activeTargets || activeTargets.length === 0) {
        recordBackgroundJob('telemetry_pipeline', 'success', Number(process.hrtime.bigint() - startHr) / 1e9);
        return;
      }

      await Promise.allSettled(
        activeTargets.map((target) =>
          runWithTenantContext(target.organizationId, null, () =>
            this.processServiceBatch(target.serviceId, target.organizationId, target.clusterId)
          ).catch((err) => {
            console.error(
              `[TelemetryPipeline] Error processing org=${target.organizationId} cluster=${target.clusterId} service=${target.serviceId}:`,
              err?.message || err
            );
          })
        )
      );
      recordBackgroundJob('telemetry_pipeline', 'success', Number(process.hrtime.bigint() - startHr) / 1e9);
    } catch (err) {
      recordBackgroundJob('telemetry_pipeline', 'error', Number(process.hrtime.bigint() - startHr) / 1e9);
      console.error('[TelemetryPipeline] Error in background cycle:', err);
    }
  }

  /**
   * Start the continuous background pipeline for Tumbling Batches (Lô 12 điểm mới tinh):
   * Chờ gom đủ 12 điểm mới tinh (không gối đầu) rồi mới đưa toàn bộ vào GRU.
   */
  public static startPipeline(intervalSeconds: number = 5) {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log(`⚡ [TelemetryPipeline] Background Tumbling Batch AI Pipeline started (polling every ${intervalSeconds}s for full 12 fresh points)`);

    this.intervalHandle = setInterval(() => {
      void this.runPipelineCycle();
    }, 5000);
  }

  /**
   * Mark urgent signal (Error log, OOM, Crash, or Warning event) for the service
   * so when the 12-point batch completes, RCA is guaranteed to evaluate it without
   * bypassing the 12-point tumbling batch rule.
   */
  public static triggerUrgentEvaluation(
    serviceId: string,
    reason: string,
    organizationId?: string | null,
    clusterId?: string | null
  ) {
    const key = TelemetryBufferService.isValidTenantContext(organizationId, clusterId, serviceId)
      ? this.buildLockKey(serviceId, organizationId!, clusterId!)
      : serviceId;
    this.urgentReasonByService[key] = reason;
  }

  /**
   * Tumbling Batch Logic:
   * 1. Query new time-buckets strictly after lastEvaluatedBucketTimestamp
   * 2. If < 12 points: WAIT and report progress (e.g. 5/12 new points)
   * 3. When 12 new points reached: Advance boundary immediately so next batch [1/12] accumulates in parallel,
   *    and feed all 12 points into GRU + RCA asynchronously without blocking!
   */
  public static async processServiceBatch(
    serviceId: string,
    organizationId?: string | null,
    clusterId?: string | null
  ) {
    if (!TelemetryBufferService.isValidTenantContext(organizationId, clusterId, serviceId)) {
      console.warn(
        `[TelemetryPipeline] Rejected batch processing with missing or invalid tenant context (org=${organizationId}, cluster=${clusterId}, service=${serviceId})`
      );
      return;
    }

    const normalizedOrgId = organizationId!.trim().toLowerCase();
    const normalizedClusterId = clusterId!.trim();
    const normalizedServiceId = serviceId.trim();
    const lockKey = this.buildLockKey(normalizedServiceId, normalizedOrgId, normalizedClusterId);

    if (this.isProcessingService[lockKey]) return;
    this.isProcessingService[lockKey] = true;
    try {
      const lastBucket = this.lastEvaluatedBucketTimestamp[lockKey];

      // 1. Luôn lấy 12 điểm viễn trắc gần nhất từ In-Memory Buffer (RAM / Redis)
      const displayPoints = await TelemetryBufferService.getDisplayPoints(
        normalizedServiceId,
        5,
        12,
        normalizedOrgId,
        normalizedClusterId
      );
      if (displayPoints.length === 0) return;

      // 2. Lấy số điểm MỚI TINH phát sinh sau mốc đánh giá gần nhất (Tumbling Batch từ RAM / Redis)
      const freshBatch = await TelemetryBufferService.getFreshBatch(
        normalizedServiceId,
        5, // 5s bucket
        lastBucket,
        12, // batch size: 12 điểm mới
        normalizedOrgId,
        normalizedClusterId
      );

      if (freshBatch.organizationId && freshBatch.organizationId.trim().toLowerCase() !== normalizedOrgId) {
        console.warn(
          `[TelemetryPipeline] Aborted batch with mismatched organizationId (expected=${normalizedOrgId}, got=${freshBatch.organizationId})`
        );
        return;
      }
      if (freshBatch.clusterId && freshBatch.clusterId.trim() !== normalizedClusterId) {
        console.warn(
          `[TelemetryPipeline] Aborted batch with mismatched clusterId (expected=${normalizedClusterId}, got=${freshBatch.clusterId})`
        );
        return;
      }

      const batchOrgId = normalizedOrgId;
      const batchClusterId = normalizedClusterId;
      const count = freshBatch.points.length;

      // Nếu vừa chốt 12/12 (lastBucket đã có) và đang trong cùng khung 5s chưa sang bucket mới (count === 0):
      // Giữ nguyên hiển thị mốc 12/12 (T1) với điểm cập nhật mới nhất (nếu có nhiều pod cùng gửi trong 1 bucket),
      // tuyệt đối KHÔNG reset sớm về bước 1 (T12) khi chưa có điểm mới!
      if (count === 0 && lastBucket) {
        if (Date.now() - lastBucket.getTime() < 5500) {
          broadcastTelemetryToUi({
            type: 'batch_accumulation',
            data: {
              service_id: normalizedServiceId,
              organization_id: batchOrgId,
              cluster_id: batchClusterId,
              collected: 12,
              target: 12,
              active_step: 12,
              percent: 100,
              status: 'ready_for_gru',
              points: displayPoints,
              latest_point: displayPoints[displayPoints.length - 1] || null,
              message: `Đã gom đủ 12 điểm mới tinh (12/12)! Đang chuyển sang mô hình AI dự đoán...`,
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
          service_id: normalizedServiceId,
          organization_id: batchOrgId,
          cluster_id: batchClusterId,
          collected: count,
          target: 12,
          active_step: currentStep,
          percent: Math.round((count / 12) * 100),
          status: count >= 12 ? 'ready_for_ai' : 'accumulating',
          points: displayPoints,
          latest_point: displayPoints[displayPoints.length - 1] || null,
          message:
            count >= 12
              ? `Đã gom đủ 12 điểm mới tinh (12/12)! Đang chuyển sang mô hình AI dự đoán...`
              : `Đang gom 12 điểm mới: [${count}/12 điểm] (${count * 5}s / 60s)... Chờ đủ 12 điểm mới rồi mới gửi vào mô hình AI.`,
        },
      });

      // NẾU CHƯA ĐỦ 12 ĐIỂM MỚI: CHỜ TIẾP, TUYỆT ĐỐI CHƯA GỬI VÀO MÔ HÌNH AI!
      if (count < 12) {
        console.log(`⏳ [TelemetryPipeline] '${normalizedServiceId}': Đang gom [${count}/12 điểm mới]. Chưa đủ 12 điểm nên chưa gửi vào mô hình AI...`);
        return;
      }

      // Chống xử lý trùng lặp cùng 1 lô nếu mốc thời gian không vượt quá lô đã đánh giá
      if (lastBucket && freshBatch.latestTimeBucket && freshBatch.latestTimeBucket.getTime() <= lastBucket.getTime()) {
        return;
      }

      // ĐÃ GOM ĐỦ 12 ĐIỂM MỚI TINH (12/12):
      // 1. Cập nhật mốc chốt chặn NGAY LẬP TỨC để lô tiếp theo [1/12] gom song song không phải đợi AI/RCA!
      this.lastEvaluatedBucketTimestamp[lockKey] = freshBatch.latestTimeBucket || new Date();
      delete this.urgentReasonByService[lockKey];

      // Không chạy AI Prediction / RCA / Auto-Healing trên hạ tầng lõi K8s & monitoring stack
      // (nhưng vẫn giữ stream metrics 12 điểm phía trên để hiển thị Overview)
      if (isInfrastructureControlPlaneWorkload(normalizedServiceId)) {
        return;
      }

      const batchPointsSnapshot = [...freshBatch.points];
      const displayPointsSnapshot = [...displayPoints];

      console.log(`🎯 [TelemetryPipeline] '${normalizedServiceId}': ĐÃ GOM ĐỦ 12 ĐIỂM MỚI TINH (12/12)! Đẩy bất đồng bộ sang mô hình AI & tiếp tục gom lô mới ngay lập tức...`);

      // 2. Chạy GRU và RCA hoàn toàn bất đồng bộ (non-blocking) ở background để không khóa lockKey
      (async () => {
        try {
          const result = await TelemetryAggregatorService.evaluateAndDiagnoseService(normalizedServiceId, {
            bucketSeconds: 5,
            windowMinutes: 30,
            forceRca: false,
            autoTriggerRca: true,
            providedSequence: batchPointsSnapshot,
            clusterId: batchClusterId,
            organizationId: batchOrgId,
            onGruPrediction: (gruPred) => {
              // Broadcast kết quả dự đoán GRU NGAY LẬP TỨC khi GRU vừa trả về (không đợi RCA)
              broadcastTelemetryToUi({
                type: 'ai_prediction',
                data: {
                  ...gruPred,
                  organization_id: batchOrgId,
                  cluster_id: batchClusterId,
                  workload_name: normalizedServiceId,
                  service_id: normalizedServiceId,
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
            console.log(`🎯 [TelemetryPipeline] RCA DIAGNOSIS on '${normalizedServiceId}': ${result.rca_diagnosis.root_cause.cause}`);

            // Lưu snapshot 12 bước viễn trắc lúc xảy ra sự cố từ RAM vào PostgreSQL
            await TelemetryBufferService.persistIncidentSnapshot(
              result.rca_diagnosis.incident_id,
              normalizedServiceId,
              batchPointsSnapshot
            );

            broadcastTelemetryToUi({
              type: 'incident',
              data: {
                id: result.rca_diagnosis.incident_id,
                organization_id: batchOrgId,
                cluster_id: batchClusterId,
                service_id: normalizedServiceId,
                title: `${result.rca_diagnosis.root_cause.cause} trên dịch vụ ${normalizedServiceId}`,
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
                organization_id: batchOrgId,
                incident_id: result.rca_diagnosis.incident_id,
                recommendation: result.rca_diagnosis.recommendation.action,
                action: result.rca_diagnosis.recommendation.action,
                action_code: result.rca_diagnosis.recommendation.action,
                reason: result.rca_diagnosis.recommendation.reason,
                reasoning: result.rca_diagnosis.recommendation.reason,
                priority: result.rca_diagnosis.recommendation.priority,
                target_name: normalizedServiceId,
                target_id: normalizedServiceId,
                incident_title: `${result.rca_diagnosis.root_cause.cause} trên dịch vụ ${normalizedServiceId}`,
                cluster_id: (result.rca_diagnosis as any)?.cluster_id || batchClusterId,
                created_at: new Date().toISOString(),
              },
            });

            await TelemetryPipelineService.evaluatePolicyAndTriggerAutonomousHealing(
              {
                ...result.rca_diagnosis,
                organization_id: result.rca_diagnosis.organization_id || batchOrgId,
              },
              normalizedServiceId
            );
          } else if (!result.rca_triggered && (result.rule_evaluation?.anomalies?.length ?? 0) === 0) {
            await TelemetryPipelineService.autoResolveIfRecovered(
              normalizedServiceId,
              batchClusterId,
              batchPointsSnapshot,
              batchOrgId
            );
          }
        } catch (bgErr: any) {
          console.error(`[TelemetryPipeline] Async GRU/RCA error on ${normalizedServiceId}:`, bgErr?.message || bgErr);
        }
      })();
    } catch (err: any) {
      console.error(`[TelemetryPipeline] Processing error on ${normalizedServiceId}:`, err?.message || err);
    } finally {
      this.isProcessingService[lockKey] = false;
    }
  }

  /**
   * Auto-resolve open incidents for a service when a full 12-point (60s) fresh telemetry batch
   * verifies that both Rule Engine and GRU find zero anomalies (service has genuinely recovered).
   */
  public static async autoResolveIfRecovered(
    serviceId: string,
    clusterId?: string | null,
    providedSequence?: any[],
    organizationId?: string | null
  ): Promise<void> {
    if (!organizationId || !isValidUuid(organizationId)) {
      console.warn(`[TelemetryPipelineService] Rejected autoResolveIfRecovered for ${serviceId}: missing valid organizationId.`);
      return;
    }
    const scopedOrgId = organizationId.trim();
    return await runWithTenantContext(scopedOrgId, null, async () => {
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

      // Verify post-action health genuinely from post-completion telemetry batch before recording verification and completing action
      const unverifiedSuccRes = await pool.query(
        `SELECT h.id, h.incident_id,
                act.code AS action_code,
                h.result AS action_result,
                COALESCE(
                  h.completed_at,
                  NULLIF(h.result->>'agent_completed_at', '')::timestamptz,
                  h.started_at,
                  h.created_at
                ) AS effective_completed_at
         FROM healing_actions h
         JOIN environments e ON e.id = h.environment_id
         LEFT JOIN healing_action_types act ON act.id = h.action_type_id
         WHERE e.organization_id = $3::uuid
           AND (
             (h.execution_status = 'RUNNING' AND COALESCE(h.result->>'agent_status', '') IN ('COMPLETED', 'SUCCEEDED')
              AND COALESCE((h.result->>'agent_completed_at')::timestamptz, h.started_at, NOW()) <= NOW() - interval '30 seconds')
             OR (h.execution_status::text IN ('COMPLETED', 'SUCCEEDED') AND h.completed_at IS NOT NULL AND h.completed_at <= NOW() - interval '30 seconds' AND h.completed_at >= NOW() - interval '60 minutes')
           )
           AND (
             LOWER(COALESCE(h.target_name, '')) = ANY($1)
             OR ($2::text IS NOT NULL AND h.target_id::text = $2)
           )
           AND NOT EXISTS (
             SELECT 1 FROM recovery_verifications rv
             WHERE rv.healing_action_id = h.id
           );`,
        [targetAliasesLower, validTargetWorkloadId, scopedOrgId]
      );
      const seq = Array.isArray(providedSequence) ? providedSequence : [];
      const isDbCacheTarget =
        isDatabaseCacheWorkload(canonicalTargetName) || isDatabaseCacheWorkload(serviceId);
      const untimedSeqEval = RecoveryVerificationService.evaluateSequenceRecovery(seq, {
        isDatabaseWorkload: isDbCacheTarget,
        baselineRestartCount: seq.length > 0 ? Number(seq[0]?.pod_restart_count ?? 0) : 0,
      });

      for (const succRow of unverifiedSuccRes.rows) {
        const completedAtDate = succRow.effective_completed_at ? new Date(succRow.effective_completed_at) : null;
        const elapsedMs =
          completedAtDate && !isNaN(completedAtDate.getTime())
            ? Math.max(0, Date.now() - completedAtDate.getTime())
            : 0;
        const graceSec = RecoveryVerificationService.getActionSettlingCooldownSeconds(
          succRow.action_code,
          succRow.action_result
        );
        const postFilter = RecoveryVerificationService.filterPostActionSamples(
          seq,
          completedAtDate,
          graceSec
        );

        let evalSeq = seq;
        let rowViolations = untimedSeqEval.violations;
        let rowHealthy = seq.length >= 12 && untimedSeqEval.healthy;

        if (postFilter.hasTimestamps) {
          if (postFilter.filtered.length < RecoveryVerificationService.MIN_POST_ACTION_SEQUENCE_SAMPLES) {
            // Current batch still has too few clean samples after rollout/settling grace -> wait for next clean batch
            continue;
          }
          evalSeq = postFilter.filtered;
          const filteredEval = RecoveryVerificationService.evaluateSequenceRecovery(evalSeq, {
            isDatabaseWorkload: isDbCacheTarget,
            baselineRestartCount: evalSeq.length > 0 ? Number(evalSeq[0]?.pod_restart_count ?? 0) : 0,
          });
          rowViolations = filteredEval.violations;
          rowHealthy = filteredEval.healthy;

          // Inside autoResolveIfRecovered (Rule Engine & GRU already cleared current state), never stamp a premature failure before 65s
          if (!rowHealthy && elapsedMs < 65_000) {
            continue;
          }
        }

        const tsCheck = RecoveryVerificationService.validateTimestampSequence(evalSeq);
        const observationDurationMs = tsCheck.valid && tsCheck.durationMs > 0
          ? tsCheck.durationMs
          : (seq.length >= 12 ? 60000 : Math.max(5000, evalSeq.length * 5000));

        await HealingActionModel.finalizeRecoveryVerificationOutcome(succRow.id, {
          verificationType: 'K8S_POST_HEALING_PROBE',
          verified: rowHealthy,
          statusBefore: { health: 'DEGRADED' },
          statusAfter: {
            health: rowHealthy ? 'HEALTHY' : 'STILL_DEGRADED',
            verified_by: postFilter.hasTimestamps ? 'POST_ACTION_FILTERED_BATCH' : '12_POINT_TELEMETRY_BATCH',
            post_action_metrics_sequence: evalSeq,
            excluded_pre_action_samples: postFilter.excludedPreActionCount,
            latest_metrics: evalSeq.length > 0 ? evalSeq[evalSeq.length - 1] : null,
          },
          details: {
            status: rowHealthy ? 'VERIFIED_HEALTHY' : 'VERIFICATION_FAILED',
            sample_count: evalSeq.length,
            excluded_pre_action_samples: postFilter.excludedPreActionCount,
            violations: rowViolations,
            metrics: evalSeq.length > 0 ? evalSeq[evalSeq.length - 1] : null,
            message: rowHealthy
              ? `Hậu kiểm thành công sau chu kỳ ${evalSeq.length} điểm viễn trắc hậu hành động: Dịch vụ '${serviceId}' đã phục hồi ổn định.`
              : `Hậu kiểm thất bại cho '${serviceId}': ${rowViolations.join('; ') || 'Thiếu đủ dữ liệu viễn trắc hợp lệ'}`,
          },
          durationMs: observationDurationMs,
          errorMessage: rowHealthy ? undefined : (rowViolations.join('; ') || 'Post-healing telemetry verification failed'),
        }).catch(() => {});

        if (rowHealthy && succRow.incident_id) {
          await pool.query(
            `UPDATE healing_actions SET execution_status = 'CANCELLED' WHERE incident_id = $1 AND execution_status = 'PENDING';`,
            [succRow.incident_id]
          ).catch(() => {});
          await pool.query(
            `UPDATE incidents SET status = 'RESOLVED', resolved_at = COALESCE(resolved_at, NOW()), updated_at = NOW()
             WHERE id = $1 AND status IN ('OPEN', 'INVESTIGATING');`,
            [succRow.incident_id]
          ).catch(() => {});
        }
      }

      // 1b. Historical integrity: Past failed verifications are preserved.

      const updRes = await pool.query(
        `UPDATE incidents i
         SET status = 'RESOLVED',
             resolved_at = COALESCE(i.resolved_at, NOW()),
             updated_at = NOW()
         WHERE i.status IN ('OPEN', 'INVESTIGATING')
           AND i.organization_id = $4::uuid
           AND ($5::text IS NULL OR i.cluster_id IS NULL OR i.cluster_id = $5)
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
               AND ha.execution_status::text IN ('COMPLETED', 'SUCCEEDED')
               AND ha.completed_at > NOW() - interval '30 seconds'
           )
           AND NOT EXISTS (
             SELECT 1 FROM healing_actions ha_unv
             WHERE ha_unv.incident_id = i.id
               AND ha_unv.execution_status::text IN ('COMPLETED', 'SUCCEEDED')
               AND ha_unv.completed_at >= NOW() - interval '60 minutes'
               AND NOT EXISTS (
                 SELECT 1 FROM recovery_verifications rv_unv
                 WHERE rv_unv.healing_action_id = ha_unv.id
               )
           )
           -- Giữ rào chắn trong 15 phút sau hành động/hậu kiểm thất bại để ngăn đóng non,
           -- nhưng cho phép tự đóng sau khi dịch vụ đã thực sự phục hồi qua chu kỳ 12/12 sạch khi Circuit Breaker (NO_ACTION) đang ngắt hành động mới
           AND NOT EXISTS (
             SELECT 1 FROM healing_actions ha_fail
             WHERE ha_fail.incident_id = i.id
               AND (
                 (
                   ha_fail.execution_status = 'FAILED'
                   AND COALESCE(ha_fail.completed_at, ha_fail.started_at, ha_fail.created_at) >= NOW() - interval '15 minutes'
                 )
                 OR EXISTS (
                   SELECT 1 FROM recovery_verifications rv_fail
                   WHERE rv_fail.healing_action_id = ha_fail.id
                     AND rv_fail.verification_result = false
                     AND COALESCE(rv_fail.verified_at, ha_fail.completed_at, ha_fail.created_at) >= NOW() - interval '15 minutes'
                 )
               )
               AND NOT EXISTS (
                 SELECT 1 FROM healing_actions ha_win
                 WHERE ha_win.incident_id = i.id
                   AND ha_win.completed_at > ha_fail.completed_at
                   AND ha_win.execution_status::text IN ('COMPLETED', 'SUCCEEDED')
               )
           )
         RETURNING i.id, i.title, i.target_name;`,
        [targetAliasesLower, validTargetWorkloadId, serviceId, scopedOrgId, clusterId || null]
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
            organization_id: organizationId || undefined,
            cluster_id: clusterId || undefined,
            service_id: serviceId,
            incident_ids: resolvedIds,
            timestamp: new Date().toISOString(),
          },
        });
      }
    } catch (err: any) {
      console.warn(`[TelemetryPipelineService] Auto-resolve check warning for ${serviceId}:`, err?.message || err);
    }
    });
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
        if (rca.recommendation_id) {
          await pool.query(
            `UPDATE ai_recommendations SET status = 'APPLIED' WHERE id = $1;`,
            [rca.recommendation_id]
          ).catch((err) => {
            console.warn('[TelemetryPipelineService] Cập nhật trạng thái ai_recommendations NO_ACTION thất bại:', err?.message || err);
          });
        }
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

      const rcaOrgId = (rca as any)?.organization_id && isValidUuid(String((rca as any).organization_id))
        ? String((rca as any).organization_id).trim()
        : null;
      const rcaEnvId = rca.environment_id && uuidRegex.test(String(rca.environment_id)) ? String(rca.environment_id) : null;
      if (!rcaOrgId) {
        console.warn(`[PolicyEngine] Refusing policy evaluation for '${serviceId}': missing organization_id on RCA context.`);
        return;
      }

      // 1. Query matching policy strictly scoped to rcaOrgId (NEVER cross-tenant fallback!)
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
        WHERE p.organization_id = $5::uuid
          AND p.deleted_at IS NULL
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
      const polRes = await pool.query(query, [searchPattern, codePattern, searchPattern, rcaEnvId, rcaOrgId]);

      if (polRes.rows.length === 0) {
        console.log(`ℹ️ [PolicyEngine] No policy matches action '${recAction}' for org=${rcaOrgId}. Kept in PROPOSED status.`);
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
        const envRes = await pool.query(
          'SELECT id FROM environments WHERE organization_id = $1::uuid AND deleted_at IS NULL ORDER BY created_at ASC LIMIT 1;',
          [rcaOrgId]
        );
        environmentId = envRes.rows[0]?.id;
      }
      if (!environmentId) {
        console.warn(`[PolicyEngine] Cannot trigger healing for org=${rcaOrgId}: no environment available.`);
        return;
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

      // Cooldown & Anti-Spam Check strictly scoped to rcaOrgId:
      const cooldownSec = policy.cooldown_seconds ? Number(policy.cooldown_seconds) : 300;
      const recentActionRes = await pool.query(
        `SELECT h.id, h.execution_status, h.completed_at, h.created_at, h.error_message, h.result
         FROM healing_actions h
         JOIN environments e ON e.id = h.environment_id
         WHERE e.organization_id = $5::uuid
           AND (
             LOWER(COALESCE(h.target_name, '')) = ANY($1)
             OR ($4::text IS NOT NULL AND h.target_id::text = $4::text)
           )
           AND (h.action_type_id = $2 OR h.execution_status::text IN ('PENDING', 'RUNNING') OR (h.execution_status::text IN ('COMPLETED', 'SUCCEEDED') AND h.completed_at >= NOW() - interval '35 seconds'))
           AND (
             (h.approval_status = 'PENDING' AND h.execution_status = 'PENDING')
             OR (h.execution_status = 'RUNNING')
             OR (
               NOT (
                 h.execution_status = 'FAILED'
                 AND EXISTS (
                   SELECT 1 FROM recovery_verifications rv
                   WHERE rv.healing_action_id = h.id AND rv.verification_result = false
                 )
                 AND COALESCE(NULLIF(h.result->>'agent_completed_at', '')::timestamptz, h.started_at, h.created_at) < NOW() - interval '45 seconds'
               )
               AND COALESCE(NULLIF(h.result->>'agent_completed_at', '')::timestamptz, h.completed_at) >= NOW() - ($3 || ' seconds')::interval
             )
           )
         ORDER BY h.created_at DESC 
         LIMIT 1;`,
        [targetAliasesLower, policy.action_type_id, `${cooldownSec}`, validTargetWorkloadId, rcaOrgId]
      );

      if (recentActionRes.rows.length > 0) {
        const act = recentActionRes.rows[0];
        if (act.execution_status === 'PENDING') {
          console.log(`⏳ [PolicyEngine] '${canonicalTargetName}' đã có yêu cầu phê duyệt đang chờ (ID: ${act.id}). Bỏ qua không tạo ca trùng lặp.`);
          await pool.query(`UPDATE healing_actions SET requested_at = NOW() WHERE id = $1;`, [act.id]);
        } else if (act.execution_status === 'RUNNING') {
          console.log(`⏳ [PolicyEngine] '${canonicalTargetName}' đang trong quá trình thực thi ${policy.action_name} (ID: ${act.id}). Bỏ qua.`);
        } else if (act.execution_status === 'COMPLETED' || act.execution_status === 'SUCCEEDED') {
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

      // Rào chắn an toàn bất biến (SRE Safety Invariant):
      // ROLLBACK_DEPLOYMENT và DRAIN_NODE là hành động rủi ro cao/khẩn cấp, can thiệp phiên bản phát hành/hạ tầng cụm.
      // BẮT BUỘC gửi về Cổng Phê Duyệt HITL (Human-In-The-Loop) để con người phê duyệt, NGHIÊM CẤM tự động thi hành (Autonomous Execution).
      const rawAction = String(policy.action_code || recAction || '').toUpperCase().replace(/[\s-]+/g, '_');
      const isMandatoryHitlAction = [
        'ROLLBACK_DEPLOYMENT',
        'ROLLBACK',
        'ROLLBACK_DEPLOY',
        'DRAIN_NODE',
        'DRAIN'
      ].includes(rawAction);

      // Rào chắn bảo vệ hạ tầng hệ thống Kubernetes (K8s System Infrastructure Safety Guard):
      // Các Namespace lõi hệ thống ('kube-system', 'kube-public', 'kube-node-lease', 'local-path-storage', 'selfheal-system')
      // hoặc các thành phần mạng / giám sát hạ tầng DaemonSet ('kindnet', 'kube-proxy', 'prometheus-node-exporter', 'selfheal-agent')
      // TUYỆT ĐỐI NGHIÊM CẤM tự động can thiệp (Autonomous Execution) như SCALE_REPLICAS hay RESTART_POD.
      // Mọi can thiệp hạ tầng BẮT BUỘC phải chuyển qua Cổng Phê Duyệt HITL có kỹ sư xác nhận.
      const isProtectedSystemNamespace = ['kube-system', 'kube-public', 'kube-node-lease', 'local-path-storage', 'selfheal-system'].includes(
        String(targetNamespace || '').toLowerCase()
      );
      const isSystemInfrastructureWorkload = [
        'kindnet',
        'kube-proxy',
        'prometheus-node-exporter',
        'node-exporter',
        'etcd-minikube',
        'kube-apiserver-minikube',
        'kube-controller-manager-minikube',
        'kube-scheduler-minikube',
        'storage-provisioner',
        'selfheal-agent',
      ].includes(canonicalTargetName.toLowerCase());
      const isProtectedSystemTarget = isProtectedSystemNamespace || isSystemInfrastructureWorkload;

      // ----------------------------------------------------
      // Rào chắn Bán kính ảnh hưởng (Blast Radius Safety Guard):
      // Giới hạn tỷ lệ Pods bị can thiệp đồng thời trong cùng một Namespace.
      // Nếu can thiệp thêm làm tỷ lệ vượt quá blastRadiusThreshold (mặc định 45%), bắt buộc chuyển sang Cổng Phê Duyệt HITL!
      // ----------------------------------------------------
      let isBlastRadiusExceeded = false;
      let blastRadiusInfo = {
        totalPods: 0,
        alreadyAffected: 0,
        newAffectedCount: 0,
        ratioPercent: 0,
        threshold: 45,
      };
      let clusterGlobalMode = 'AUTONOMOUS';

      try {
        let guardThreshold = 45;
        let restartWindowMin = 15;
        if (policy.organization_id) {
          const guardRes = await pool.query(
            `SELECT blast_radius_threshold, restart_time_window, max_restarts, global_mode 
             FROM cluster_safety_guards 
             WHERE organization_id = $1 
             ORDER BY cluster_id NULLS LAST 
             LIMIT 1;`,
            [policy.organization_id]
          );
          if (guardRes.rows.length > 0) {
            guardThreshold = Number(guardRes.rows[0].blast_radius_threshold) || 45;
            restartWindowMin = Number(guardRes.rows[0].restart_time_window) || 15;
            clusterGlobalMode = String(guardRes.rows[0].global_mode || 'AUTONOMOUS').toUpperCase();
          }
        }

        const totalPodsRes = await pool.query(
          `SELECT COUNT(p.id) AS total_pods 
           FROM pods p 
           JOIN namespaces n ON p.namespace_id = n.id 
           WHERE LOWER(n.name) = LOWER($1) 
             AND p.deleted_at IS NULL;`,
          [targetNamespace]
        );
        const totalPodsInNs = parseInt(totalPodsRes.rows[0]?.total_pods || '0', 10);

        const recentInterventionsRes = await pool.query(
          `SELECT COUNT(DISTINCT COALESCE(ha.result->'params'->>'pod_name', ha.target_name)) AS affected_count
           FROM healing_actions ha
           WHERE (
               LOWER(COALESCE(ha.result->>'namespace', '')) = LOWER($1)
               OR LOWER(COALESCE(ha.result->'params'->>'namespace', '')) = LOWER($1)
               OR LOWER(COALESCE(ha.target_name, '')) = LOWER($2)
           )
           AND ha.created_at >= NOW() - ($3 || ' minutes')::interval
           AND ha.execution_status::text IN ('RUNNING', 'SUCCEEDED', 'COMPLETED', 'PENDING');`,
          [targetNamespace, canonicalTargetName, restartWindowMin]
        );
        const alreadyAffected = parseInt(recentInterventionsRes.rows[0]?.affected_count || '0', 10);
        const newAffectedCount = alreadyAffected + 1;

        if (totalPodsInNs > 0) {
          const ratio = (newAffectedCount / totalPodsInNs) * 100;
          blastRadiusInfo = {
            totalPods: totalPodsInNs,
            alreadyAffected,
            newAffectedCount,
            ratioPercent: Math.round(ratio),
            threshold: guardThreshold,
          };

          if (totalPodsInNs >= 2 && ratio > guardThreshold) {
            isBlastRadiusExceeded = true;
            console.warn(`🛡️ [SafetyGuard:BlastRadius] VƯỢT NGƯỠNG BÁN KÍNH ẢNH HƯỞNG: ${newAffectedCount}/${totalPodsInNs} Pods (${ratio.toFixed(1)}% > ${guardThreshold}%) trong Namespace '${targetNamespace}'. Bắt buộc chuyển sang Cổng Phê Duyệt HITL!`);
          }
        }
      } catch (brErr: any) {
        console.warn('[TelemetryPipelineService] Lỗi tính toán Blast Radius:', brErr?.message || brErr);
      }

      // Case 2: Policy requires HITL confirmation (High/Critical risk in SUPERVISED mode, or AUDIT mode, or HITL switch enabled, or confidence < threshold, or StatefulSet Primary DB, or Mandatory HITL action, or Protected System Target, or Blast Radius Exceeded)
      const isAuditMode = ['AUDIT', 'AUDIT_ONLY'].includes(clusterGlobalMode);
      const isSupervisedMode = ['SUPERVISED', 'SEMI_AUTONOMOUS'].includes(clusterGlobalMode);
      const isEffectiveHighRisk = effectiveRisk === 'HIGH' || effectiveRisk === 'CRITICAL';
      const requiresSupervisedHitl = isSupervisedMode && isEffectiveHighRisk;

      if (isAuditMode || requiresSupervisedHitl || !isAuto || Boolean(policy.requires_approval) || (confidence < threshold) || isStatefulPrimaryDestructive || isMandatoryHitlAction || isProtectedSystemTarget || isBlastRadiusExceeded) {
        console.log(`🛡️ [PolicyEngine] Policy '${policy.policy_name}' action '${policy.action_code || recAction}' requires HITL approval (BlastRadiusExceeded: ${isBlastRadiusExceeded}, Protected System: ${isProtectedSystemTarget}, Mandatory HITL: ${isMandatoryHitlAction}, Mode: ${policy.execution_mode}, HITL: ${policy.requires_approval}, Confidence: ${confidence.toFixed(2)}/${threshold.toFixed(2)}). Routing to HITL Approval Gate.`);
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
          const hitlReason = isProtectedSystemTarget
            ? `Dịch vụ ${canonicalTargetName} thuộc hạ tầng hệ thống Kubernetes (${targetNamespace}). Để đảm bảo an toàn tuyệt đối, hành động ${policy.action_name} (${policy.action_code}) BẮT BUỘC phải qua Cổng Phê Duyệt (HITL) có kỹ sư kiểm tra thủ công, nghiêm cấm AI tự động can thiệp.`
            : isBlastRadiusExceeded
            ? `Bán kính ảnh hưởng (Blast Radius) vượt ngưỡng an toàn: Can thiệp thêm sẽ làm ảnh hưởng ${blastRadiusInfo.newAffectedCount}/${blastRadiusInfo.totalPods} Pods (${blastRadiusInfo.ratioPercent}% > ${blastRadiusInfo.threshold}%) trong Namespace '${targetNamespace}'. Rào chắn an toàn đã tự động chuyển sang Cổng Phê Duyệt (HITL) có kỹ sư thẩm định, ngăn ngừa nguy cơ sập toàn bộ dịch vụ (downtime).`
            : isMandatoryHitlAction
            ? `Hành động ${policy.action_name} (${policy.action_code}) có mức độ rủi ro cao (${effectiveRisk}), can thiệp trực tiếp vào phiên bản phát hành/hạ tầng nên BẮT BUỘC phải qua Cổng Phê Duyệt (HITL) có con người xác nhận, nghiêm cấm AI tự động thi hành.`
            : confidence < threshold
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
                organization_id: policy.organization_id,
                cluster_id: (rca as any)?.cluster_id,
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

      const autoExecMode = await resolveAutoExecutionMode();
      // Insert record into healing_actions with status 'PENDING' and approval 'APPROVED'
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
          'WORKLOAD', $6::uuid, $7, 'LOW'::risk_level, $9::execution_mode, 'APPROVED'::approval_status,
          'PENDING'::execution_status, NULL, NOW(), NULL,
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
        autoExecMode,
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

      // Rào chắn bảo vệ tầng cuối cùng (Fail-safe Hard Guard):
      // Ngăn chặn tuyệt đối việc phát lệnh tự động đối với các hành động rủi ro cao (Rollback, Drain Node) hoặc vượt Bán kính ảnh hưởng.
      const candidateAction = String(policy.action_code || recAction || '').toUpperCase().replace(/[\s-]+/g, '_');
      if (['ROLLBACK_DEPLOYMENT', 'ROLLBACK', 'ROLLBACK_DEPLOY', 'DRAIN_NODE', 'DRAIN'].includes(candidateAction) || isBlastRadiusExceeded) {
        const blockReason = isBlastRadiusExceeded
          ? `Bán kính ảnh hưởng vượt ngưỡng an toàn (${blastRadiusInfo.newAffectedCount}/${blastRadiusInfo.totalPods} Pods, ${blastRadiusInfo.ratioPercent}% > ${blastRadiusInfo.threshold}%). Bắt buộc phải qua Cổng HITL có kỹ sư duyệt.`
          : `Hành động ${policy.action_code || candidateAction} là hành động rủi ro cao, bắt buộc phải duyệt qua Cổng HITL (Human-In-The-Loop) của kỹ sư. Không cho phép tự động thi hành.`;
        console.warn(`🛑 [SafetyGuard] CHẶN ĐỨNG THỰC THI TỰ ĐỘNG: ${blockReason}`);
        await pool.query(
          `UPDATE healing_actions 
           SET execution_status = 'CANCELLED',
               result = $1::jsonb,
               completed_at = NOW()
           WHERE id = $2;`,
          [
            JSON.stringify({
              status: 'BLOCKED_BY_SAFETY_GUARD',
              reason: blockReason,
              timestamp: new Date().toISOString(),
            }),
            actionId,
          ]
        );
        return;
      }

      // Broadcast real-time execution trigger to UI
      broadcastTelemetryToUi({
        type: 'healing_action_triggered',
        data: {
          action_id: actionId,
          organization_id: policy.organization_id,
          cluster_id: (rca as any)?.cluster_id,
          incident_id: rca.incident_id,
          policy_name: policy.policy_name,
          action_type: policy.action_name,
          target: canonicalTargetName,
          execution_mode: 'AUTO',
          status: 'RUNNING',
          timestamp: new Date().toISOString(),
        },
      });

      // Transition through HealingActionModel.executeAction so execution_attempts starts cleanly in RUNNING
      const execLock = await HealingActionModel.executeAction(actionId);
      const attemptId = execLock?.attempt?.id || null;

      // 3. Dispatch action over WebSocket to Kubernetes Agent using canonical workload + namespace + strict routing!
      const targetPod = rca.target?.id || rca.target?.name;
      const dispatchResult = await dispatchHealingActionToAgent({
        action_id: actionId,
        action_type: policy.action_code || 'RESTART_POD',
        target_name: canonicalTargetName,
        namespace: targetNamespace,
        cluster_id: (rca as any)?.cluster_id,
        environment_id: environmentId,
        organization_id: policy.organization_id,
        params: {
          ...(rca.recommendation.action_parameters || {}),
          pod_name: targetPod,
          pod_id: targetPod,
          faulty_node_name: rca.recommendation.target_node || rca.recommendation.action_parameters?.faulty_node_name,
          recommended_destination_node: rca.recommendation.action_parameters?.recommended_destination_node,
        },
      });

      console.log(`📡 [AutonomousSelfHealing] Action dispatched to agent: ${dispatchResult.dispatched ? 'SUCCESS' : 'NO AGENT (FAILED)'}`);

      if (!dispatchResult.dispatched) {
        if (rca.incident_id) {
          CriticalIncidentNotificationService.notifyIfNeeded(rca.incident_id, {
            reasonStage: 'HEALING_FAILED',
            failureMessage: 'Không có Kubernetes Agent nào trực tuyến để nhận lệnh tự phục hồi.',
          }).catch((err) => {
            console.warn('[TelemetryPipelineService] Gửi cảnh báo khẩn HEALING_FAILED thất bại:', err?.message || err);
          });
        }
        await HealingActionModel.recordDispatchFailure(
          actionId,
          attemptId,
          'Không có Kubernetes Agent nào trực tuyến để nhận lệnh tự phục hồi.',
          { reason: dispatchResult.reason || 'NO_MATCHING_AGENT' }
        );
      } else {
        const timeoutHandle = setTimeout(async () => {
          try {
            await HealingActionModel.recordDispatchFailure(
              actionId,
              attemptId,
              'Quá thời gian chờ (60s) nhưng Kubernetes Agent chưa phản hồi kết quả thực thi.',
              { timeout: true }
            );
          } catch {}
        }, 60000);
        if (typeof timeoutHandle.unref === 'function') {
          timeoutHandle.unref();
        }
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

  public static resetState() {
    this.stopPipeline();
    this.lastEvaluatedBucketTimestamp = {};
    this.urgentReasonByService = {};
    this.isProcessingService = {};
  }
}
