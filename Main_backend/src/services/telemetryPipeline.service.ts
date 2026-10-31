import { HitlNotificationService } from './hitlNotification.service';
import { TelemetryAggregatorService } from './telemetryAggregator.service';
import { MetricModel } from '../models/metric.model';
import { broadcastTelemetryToUi } from '../websocket/telemetryWebSocket';
import { pool } from '../config/database';
import { RCAResult } from './ai.service';
import { dispatchHealingActionToAgent } from '../websocket/agentWebSocket';

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
      try {
        const activeServices = await MetricModel.getActiveServices(2);
        if (!activeServices || activeServices.length === 0) return;
        await Promise.all(
          activeServices.map((sId) =>
            this.processServiceBatch(sId).catch((err) => {
              console.error(`[TelemetryPipeline] Error processing service ${sId}:`, err?.message || err);
            })
          )
        );
      } catch (err) {
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

      // 1. Luôn lấy 12 điểm viễn trắc gần nhất để sơ đồ UI luôn đầy đủ 12 mốc và chèn điểm mới liên tục từ Phải sang Trái
      const displayPoints = await MetricModel.aggregateByService(serviceId, 5, 12);
      if (displayPoints.length === 0) return;

      // 2. Lấy số điểm MỚI TINH phát sinh sau mốc đánh giá gần nhất (Tumbling Batch)
      const freshBatch = await MetricModel.getFreshBatchByService(
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

            broadcastTelemetryToUi({
              type: 'incident',
              data: {
                id: result.rca_diagnosis.incident_id,
                service_id: serviceId,
                title: `[Cảnh báo AI] ${result.rca_diagnosis.root_cause.cause} trên dịch vụ ${serviceId}`,
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
                incident_title: `[Cảnh báo AI] ${result.rca_diagnosis.root_cause.cause} trên dịch vụ ${serviceId}`,
                cluster_id: (result.rca_diagnosis as any)?.cluster_id,
                created_at: new Date().toISOString(),
              },
            });

            await TelemetryPipelineService.evaluatePolicyAndTriggerAutonomousHealing(
              result.rca_diagnosis,
              serviceId
            );
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
   * Evaluates active healing policies for the given RCA diagnosis.
   * If an active policy with execution_mode = 'AUTO' matches and confidence threshold is met,
   * automatically execute the remediation and dispatch command to K8s Agent!
   */
  public static async evaluatePolicyAndTriggerAutonomousHealing(
    rca: RCAResult,
    serviceId: string
  ): Promise<void> {
    try {
      let recAction = rca.recommendation.action || 'Restart Pod';
      if (recAction === 'NO_ACTION') {
        console.log(`🛡️ [PolicyEngine] Recommendation is NO_ACTION (Circuit Breaker). Bypassing automated healing dispatch.`);
        return;
      }
      if (recAction === 'CLEANUP_STORAGE') recAction = 'CLEANUP_TEMP_FILES';
      if (recAction === 'TEMPORARY_IP_BLOCK') recAction = 'BLOCK_IP_TEMP';
      const confidence = rca.root_cause.confidence || 0.85;

      // 1. Query matching policy (prioritizing active policies)
      const query = `
        SELECT 
          p.id AS policy_id,
          p.name AS policy_name,
          p.execution_mode,
          p.risk_level,
          p.confidence_threshold,
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
        ORDER BY p.is_active DESC, pa.priority ASC
        LIMIT 1;
      `;

      const searchPattern = `%${recAction}%`;
      const codePattern = `%${recAction.replace(/\s+/g, '_')}%`;
      const polRes = await pool.query(query, [searchPattern, codePattern, searchPattern]);

      if (polRes.rows.length === 0) {
        console.log(`ℹ️ [PolicyEngine] No policy matches action '${recAction}'. Kept in PROPOSED status.`);
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
        return;
      }

      const threshold = policy.confidence_threshold !== null ? Number(policy.confidence_threshold) : 0.70;
      const isAuto = (policy.execution_mode === 'AUTO' || policy.execution_mode === 'AUTONOMOUS');
      const effectiveRisk = (policy.risk_level || policy.default_risk_level || 'LOW').toUpperCase();

      // Case 2: Policy requires HITL confirmation (High/Critical risk in SUPERVISED mode, or HITL switch enabled, or confidence < threshold)
      if (!isAuto || policy.requires_approval || confidence < threshold) {
        console.log(`🛡️ [PolicyEngine] Policy '${policy.policy_name}' requires HITL approval (Mode: ${policy.execution_mode}, HITL: ${policy.requires_approval}, Confidence: ${confidence.toFixed(2)}/${threshold.toFixed(2)}). Routing to HITL Approval Gate.`);
        // Anti-spam deduplication: If there is already a PENDING action for the same target and action type within the last 15 minutes, skip creating duplicates
        const existingPending = await pool.query(
          `SELECT id FROM healing_actions 
           WHERE target_name = $1 
             AND action_type_id = $2 
             AND approval_status = 'PENDING' 
             AND requested_at > NOW() - interval '15 minutes' 
           LIMIT 1;`,
          [serviceId, policy.action_type_id]
        );
        if (existingPending.rows.length > 0) {
          console.log(`⏳ [PolicyEngine] '${serviceId}' already has a pending approval (ID: ${existingPending.rows[0].id}). Skipping duplicate pending action.`);
          return;
        }

        const hitlActInsert = await pool.query(
          `INSERT INTO healing_actions (
            incident_id, recommendation_id, policy_id, environment_id, action_type_id,
            target_type, target_name, risk_level, execution_mode, approval_status, execution_status,
            requested_at, result
          ) VALUES (
            $1, $2, $3, $4, $5,
            'WORKLOAD', $6, $7::risk_level, 'MANUAL'::execution_mode, 'PENDING'::approval_status, 'PENDING'::execution_status,
            NOW(), $8::jsonb
          ) RETURNING id;`,
          [
            rca.incident_id,
            rca.recommendation_id,
            policy.policy_id,
            environmentId,
            policy.action_type_id,
            serviceId,
            effectiveRisk,
            JSON.stringify({
              status: 'PENDING_APPROVAL',
              policy_id: policy.policy_id,
              policy_name: policy.policy_name,
              action: policy.action_name,
              target: serviceId,
              message: `Hành động ${policy.action_name} (${policy.action_code}) trên ${serviceId} đang chờ phê duyệt tại Cổng HITL theo chính sách ${policy.policy_name}.`,
            }),
          ]
        );
        const pendingActionId = hitlActInsert.rows[0]?.id;
        if (pendingActionId) {
          const hitlReason = confidence < threshold
            ? `Độ tin cậy chẩn đoán AI (${(confidence * 100).toFixed(0)}%) thấp hơn ngưỡng tự động (${(threshold * 100).toFixed(0)}%) của chính sách ${policy.policy_name}, kích hoạt rào chắn an toàn HITL.`
            : `Chính sách ${policy.policy_name} (Mức rủi ro: ${effectiveRisk}) yêu cầu phê duyệt con người (HITL) trước khi thực thi ${policy.action_name} trên dịch vụ ${serviceId}.`;

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
        }
        return;
      }

      // Case 3: AUTONOMOUS HEALING TRIGGERED!
      console.log(`⚡ [AutonomousSelfHealing] Matched ACTIVE AUTO Policy '${policy.policy_name}'!`);
      console.log(`   - Target Service: ${serviceId}`);
      console.log(`   - Action: ${policy.action_name} (${policy.action_code})`);
      console.log(`   - AI Confidence: ${(confidence * 100).toFixed(1)}% >= Threshold: ${(threshold * 100).toFixed(1)}%`);

      // Insert record into healing_actions with status 'RUNNING' and approval 'APPROVED'
      const insertActQuery = `
        INSERT INTO healing_actions (
          incident_id,
          recommendation_id,
          policy_id,
          environment_id,
          action_type_id,
          target_type,
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
          'WORKLOAD', $6, 'LOW'::risk_level, 'AUTO'::execution_mode, 'APPROVED'::approval_status,
          'RUNNING'::execution_status, NULL, NOW(), NOW(),
          $7::jsonb
        ) RETURNING id;
      `;

      const initialResult = {
        status: 'RUNNING',
        policy_id: policy.policy_id,
        policy_name: policy.policy_name,
        action: policy.action_name,
        target: serviceId,
        triggered_by: 'Autonomous Policy Engine',
        started_at: new Date().toISOString(),
      };

      const actInsert = await pool.query(insertActQuery, [
        rca.incident_id,
        rca.recommendation_id,
        policy.policy_id,
        environmentId,
        policy.action_type_id,
        serviceId,
        JSON.stringify(initialResult),
      ]);

      const actionId = actInsert.rows[0].id;

      // Broadcast real-time execution trigger to UI
      broadcastTelemetryToUi({
        type: 'healing_action_triggered',
        data: {
          action_id: actionId,
          incident_id: rca.incident_id,
          policy_name: policy.policy_name,
          action_type: policy.action_name,
          target: serviceId,
          execution_mode: 'AUTO',
          status: 'RUNNING',
          timestamp: new Date().toISOString(),
        },
      });

      // 3. Dispatch action over WebSocket to Kubernetes Agent!
      let targetNamespace = 'default';
      try {
        const wlRes = await pool.query(
          `SELECT n.name as namespace_name 
           FROM workloads w 
           LEFT JOIN namespaces n ON n.id = w.namespace_id 
           WHERE w.name = $1 
           LIMIT 1`,
          [serviceId]
        );
        if (wlRes.rows.length > 0 && wlRes.rows[0].namespace_name) {
          targetNamespace = wlRes.rows[0].namespace_name;
        } else {
          const podNsRes = await pool.query(
            `SELECT n.name as namespace_name 
             FROM pods p 
             JOIN namespaces n ON n.id = p.namespace_id 
             WHERE (p.name LIKE $1 OR p.labels->>'app' = $2) 
             LIMIT 1`,
            [`${serviceId}%`, serviceId]
          );
          if (podNsRes.rows.length > 0 && podNsRes.rows[0].namespace_name) {
            targetNamespace = podNsRes.rows[0].namespace_name;
          }
        }
      } catch (e) {
        console.warn(`[AutonomousSelfHealing] Could not resolve namespace for ${serviceId}:`, e);
      }

      const targetPod = rca.target?.id || rca.target?.name;
      const dispatchResult = await dispatchHealingActionToAgent({
        action_id: actionId,
        action_type: policy.action_code || 'RESTART_POD',
        target_name: serviceId,
        namespace: targetNamespace,
        params: {
          ...(rca.recommendation.action_parameters || {}),
          pod_name: targetPod,
          pod_id: targetPod,
        },
      });

      console.log(`📡 [AutonomousSelfHealing] Action dispatched to agent: ${dispatchResult.dispatched ? 'SUCCESS' : 'NO AGENT (QUEUED)'}`);

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
