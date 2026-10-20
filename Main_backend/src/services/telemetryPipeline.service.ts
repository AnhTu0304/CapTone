import { TelemetryAggregatorService } from './telemetryAggregator.service';
import { MetricModel } from '../models/metric.model';
import { broadcastTelemetryToUi } from '../websocket/telemetryWebSocket';

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
            ? `Đã gom đủ lô 12 điểm mới tinh (12/12)! Đang chuyển sang GRU AI dự đoán...`
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
      }
    } catch (err: any) {
      console.error(`[TelemetryPipeline] Processing error on ${serviceId}:`, err?.message || err);
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
