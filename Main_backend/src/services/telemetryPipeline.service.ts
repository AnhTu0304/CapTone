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
  private static pendingUrgentEval: Record<string, NodeJS.Timeout> = {};

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
        await this.processServiceBatch('sme-order-service');
      } catch (err) {
        console.error('[TelemetryPipeline] Error in background cycle:', err);
      }
    }, intervalSeconds * 1000);
  }

  /**
   * Reactive trigger: When Agent detects an Error log, OOM, Crash, or Warning event,
   * trigger an immediate evaluation with a 2-second debounce to avoid storming.
   */
  public static triggerUrgentEvaluation(serviceId: string, reason: string) {
    console.log(`🚨 [TelemetryPipeline] Urgent diagnosis scheduled for '${serviceId}' [Reason: ${reason.slice(0, 80)}]`);

    if (this.pendingUrgentEval[serviceId]) {
      clearTimeout(this.pendingUrgentEval[serviceId]);
    }

    this.pendingUrgentEval[serviceId] = setTimeout(async () => {
      delete this.pendingUrgentEval[serviceId];
      try {
        await TelemetryAggregatorService.evaluateAndDiagnoseService(serviceId, {
          bucketSeconds: 5,
          windowMinutes: 30,
          forceRca: true,
          autoTriggerRca: true,
        });
      } catch (err) {
        console.error(`[TelemetryPipeline] Urgent evaluation error for ${serviceId}:`, err);
      }
    }, 1500);
  }

  /**
   * Tumbling Batch Logic:
   * 1. Query new time-buckets strictly after lastEvaluatedBucketTimestamp
   * 2. If < 12 points: WAIT and report progress (e.g. 5/12 new points)
   * 3. When 12 new points reached: Feed all 12 points into GRU, advance boundary, discard old 12 points!
   */
  public static async processServiceBatch(serviceId: string) {
    const lastBucket = this.lastEvaluatedBucketTimestamp[serviceId];

    // Fetch up to 12 points strictly newer than last evaluated batch
    const freshBatch = await MetricModel.getFreshBatchByService(
      serviceId,
      5, // 5s bucket
      lastBucket,
      12 // batch size: 12 fresh points
    );

    const count = freshBatch.points.length;

    // Broadcast batch progress to UI Dashboard
    broadcastTelemetryToUi({
      type: 'batch_accumulation',
      data: {
        service_id: serviceId,
        collected: count,
        target: 12,
        percent: Math.round((count / 12) * 100),
        status: count >= 12 ? 'ready_for_gru' : 'accumulating',
        message:
          count >= 12
            ? 'Đã gom đủ lô 12 điểm mới tinh (12/12)! Đang chuyển sang GRU AI dự đoán...'
            : `Đang gom 12 điểm mới: [${count}/12 điểm] (${count * 5}s / 60s)... Chờ gom đủ 12 điểm mới tinh.`,
      },
    });

    // If not yet 12 brand-new points, wait for more points to arrive
    if (count < 12) {
      console.log(`⏳ [TelemetryPipeline] Đang gom đợt mới cho '${serviceId}': [${count}/12 điểm mới]. Đang chờ gom đủ 12 cái mới tinh...`);
      return;
    }

    // EXACTLY 12 NEW POINTS ACCUMULATED!
    console.log(`🎯 [TelemetryPipeline] ĐÃ GOM ĐỦ 12 ĐIỂM MỚI TINH (12/12)! Vứt bỏ các điểm cũ, đưa 12 điểm mới hoàn toàn vào GRU...`);

    try {
      const result = await TelemetryAggregatorService.evaluateAndDiagnoseService(serviceId, {
        bucketSeconds: 5,
        windowMinutes: 30,
        forceRca: false,
        autoTriggerRca: true,
        providedSequence: freshBatch.points,
        clusterId: freshBatch.clusterId,
      });

      // Advance boundary: any point up to this timestamp is now part of the past!
      this.lastEvaluatedBucketTimestamp[serviceId] = freshBatch.latestTimeBucket || new Date();

      // Broadcast AI Forecast
      if (result.gru_prediction) {
        console.log(`🔮 [TelemetryPipeline] GRU Forecast hoàn tất cho lô 12 điểm mới: Primary Risk = ${result.gru_prediction.primary_risk} (Score: ${result.gru_prediction.confidence_score.toFixed(4)})`);
        broadcastTelemetryToUi({
          type: 'ai_prediction',
          data: result.gru_prediction,
        });
      }

      // If RCA was triggered -> broadcast Incident & Recommendation to UI WebSocket
      if (result.rca_triggered && result.rca_diagnosis) {
        console.log(`🎯 [TelemetryPipeline] RCA DIAGNOSIS COMPLETED on '${serviceId}':`);
        console.log(`   - Root Cause: ${result.rca_diagnosis.root_cause.cause} (${result.rca_diagnosis.root_cause.confidence})`);
        console.log(`   - Action: ${result.rca_diagnosis.recommendation.action} [${result.rca_diagnosis.recommendation.priority}]`);

        broadcastTelemetryToUi({
          type: 'incident',
          data: {
            id: result.rca_diagnosis.incident_id,
            service_id: serviceId,
            title: `[AI Alert] ${result.rca_diagnosis.root_cause.cause} on ${serviceId}`,
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
            action: result.rca_diagnosis.recommendation.action,
            reason: result.rca_diagnosis.recommendation.reason,
            priority: result.rca_diagnosis.recommendation.priority,
          },
        });

        // Evaluate active healing policies for Autonomous Self-Healing
        await TelemetryPipelineService.evaluatePolicyAndTriggerAutonomousHealing(
          result.rca_diagnosis,
          serviceId
        );
      }
    } catch (err: any) {
      console.error(`[TelemetryPipeline] Processing error on ${serviceId}:`, err?.message || err);
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
      const recAction = rca.recommendation.action || 'Restart Pod';
      const confidence = rca.root_cause.confidence || 0.85;

      // 1. Query matching active policies
      const query = `
        SELECT 
          p.id AS policy_id,
          p.name AS policy_name,
          p.execution_mode,
          p.confidence_threshold,
          p.requires_approval,
          p.is_active,
          p.environment_id,
          act.id AS action_type_id,
          act.code AS action_code,
          act.name AS action_name
        FROM healing_policies p
        JOIN policy_actions pa ON pa.policy_id = p.id
        JOIN healing_action_types act ON act.id = pa.action_type_id
        WHERE p.is_active = true
          AND p.deleted_at IS NULL
          AND pa.is_enabled = true
          AND (act.name ILIKE $1 OR act.code ILIKE $2 OR p.name ILIKE $3)
        ORDER BY pa.priority ASC
        LIMIT 1;
      `;

      const searchPattern = `%${recAction}%`;
      const codePattern = `%${recAction.replace(/\s+/g, '_')}%`;
      const polRes = await pool.query(query, [searchPattern, codePattern, searchPattern]);

      if (polRes.rows.length === 0) {
        console.log(`ℹ️ [PolicyEngine] No active policy matches action '${recAction}'. Kept in PROPOSED status for HITL approval.`);
        return;
      }

      const policy = polRes.rows[0];
      const threshold = policy.confidence_threshold !== null ? Number(policy.confidence_threshold) : 0.70;

      // Check confidence threshold
      if (confidence < threshold) {
        console.log(`🛡️ [PolicyEngine] Policy '${policy.policy_name}' matched, but AI confidence (${confidence.toFixed(2)}) < threshold (${threshold.toFixed(2)}). Waiting for HITL confirmation.`);
        return;
      }

      // Check execution mode & approval requirement
      const isAuto = (policy.execution_mode === 'AUTO' || policy.execution_mode === 'AUTONOMOUS');
      if (!isAuto || policy.requires_approval) {
        console.log(`🛡️ [PolicyEngine] Policy '${policy.policy_name}' requires human approval (Execution Mode: ${policy.execution_mode}, Requires Approval: ${policy.requires_approval}). Kept in PROPOSED.`);
        return;
      }

      // 2. AUTONOMOUS HEALING TRIGGERED!
      console.log(`⚡ [AutonomousSelfHealing] Matched ACTIVE AUTO Policy '${policy.policy_name}'!`);
      console.log(`   - Target Service: ${serviceId}`);
      console.log(`   - Action: ${policy.action_name} (${policy.action_code})`);
      console.log(`   - AI Confidence: ${(confidence * 100).toFixed(1)}% >= Threshold: ${(threshold * 100).toFixed(1)}%`);

      let environmentId = rca.environment_id || policy.environment_id;
      if (!environmentId) {
        const envRes = await pool.query('SELECT id FROM environments LIMIT 1;');
        environmentId = envRes.rows[0]?.id;
      }

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
      const dispatchResult = await dispatchHealingActionToAgent({
        action_id: actionId,
        action_type: policy.action_code || 'RESTART_POD',
        target_name: serviceId,
        namespace: 'default',
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
