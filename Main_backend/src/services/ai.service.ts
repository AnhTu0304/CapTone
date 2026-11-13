import { config } from '../config/env';
import { pool } from '../config/database';
import { ApiError } from '../utils/apiError';
import { GRUMetricPoint, PredictRequestInput, RCARequestInput } from '../schemas/ai.schema';
import {
  AiPredictionModel,
  IncidentModel,
  RcaModel,
  RecommendationModel,
  WorkloadModel,
  ClusterModel,
  EnvironmentModel,
  OrganizationModel,
} from '../models';
import {
  injectTraceContext,
  recordExternalCall,
  withBackendSpan,
} from '../telemetry/metrics';

export interface AiBackendHealth {
  status: string;
  model_loaded: boolean;
  model_type?: string;
  input_shape?: number[];
  risk_count?: number;
  rca_provider?: string;
  version?: string;
}

export interface RiskScore {
  risk_type: string;
  confidence: number;
}

export interface AiBackendPredictionResponse {
  service_id: string;
  threshold: number;
  thresholds?: Record<string, number>;
  detected_risks: RiskScore[];
  risk_outputs: Record<string, { confidence: number }>;
}

export interface PredictionResult {
  prediction_id: string;
  service_id: string;
  status: string;
  primary_risk: string;
  overall_risk_score: number;
  confidence_score: number;
  threshold: number;
  thresholds?: Record<string, number>;
  detected_risks: RiskScore[];
  risk_outputs: Record<string, { confidence: number }>;
  prediction_horizon_minutes: number;
  environment_id: string;
  cluster_id?: string | null;
  workload_id?: string | null;
  inputs_recorded: number;
  predicted_at: string;
  expires_at: string;
}

export interface RootCauseResult {
  cause: string;
  confidence: number;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export interface RecommendationResult {
  action: string;
  reason: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  target_type?: string | null;
  target_name?: string | null;
  target_id?: string | null;
  target_node?: string | null;
  action_parameters?: {
    faulty_pod_id?: string | null;
    faulty_pod_name?: string | null;
    faulty_node_id?: string | null;
    faulty_node_name?: string | null;
    recommended_destination_node?: string | null;
    destination_node_id?: string | null;
    consecutive_failures?: number | null;
    circuit_breaker_tripped?: boolean | null;
    manual_playbook?: string[];
  } | null;
}

export interface TargetContext {
  type?: string;
  id?: string;
  name?: string;
}

export interface AiBackendRCAResponse {
  service_id: string;
  prediction?: any;
  root_cause: RootCauseResult;
  evidence: string[];
  recommendation: RecommendationResult;
  explanation: string;
  historical_context_used: boolean;
  similar_incident_ids: string[];
  target?: TargetContext;
  workload_id?: string | null;
  namespace?: string | null;
  cluster_id?: string | null;
  incident_id?: string | null;
  request_id?: string | null;
}

export interface RCAResult {
  incident_id: string;
  rca_analysis_id: string;
  recommendation_id: string;
  service_id: string;
  prediction?: AiBackendPredictionResponse | null;
  root_cause: RootCauseResult;
  evidence: string[];
  recommendation: RecommendationResult;
  explanation: string;
  historical_context_used?: boolean;
  similar_incident_ids?: boolean | string[];
  target?: TargetContext;
  environment_id: string;
  cluster_id?: string | null;
  workload_id?: string | null;
  prediction_id?: string | null;
  created_at: string;
  previous_action?: string | null;
  previous_action_result?: string | null;
  namespace?: string | null;
  request_id?: string | null;
}

const METRIC_UNITS: Record<keyof GRUMetricPoint, string> = {
  cpu: '%',
  ram: '%',
  disk: '%',
  latency: 'ms',
  request_rate: 'req/s',
  http_5xx_rate: '%',
  pod_restart_count: 'count',
  replica_count: 'count',
  time_bucket: '',
};

const ACTION_NAME_MAP: Record<string, string> = {
  RESTART_POD: 'Restart Pod',
  REPLACE_POD: 'Replace Pod',
  DRAIN_NODE: 'Drain Node',
  RESTART_DEPLOYMENT: 'Restart Deployment',
  SCALE_REPLICAS: 'Scale Replicas',
  SCALE_UP: 'Scale Replicas',
  SCALE_DOWN: 'Scale Replicas',
  SCALE_DOWN_CANDIDATE: 'Scale Replicas',
  ROLLBACK_DEPLOYMENT: 'Rollback Deployment',
  CLEANUP_STORAGE: 'Cleanup Temporary Files',
  TEMPORARY_IP_BLOCK: 'Temporary IP Block',
  BLOCK_IP: 'Temporary IP Block',
  BLOCK_IP_TEMP: 'Temporary IP Block',
  BLOCK_SUSPICIOUS_IP: 'Temporary IP Block',
  NO_ACTION: 'No Action',
};

const PRIORITY_INT_MAP: Record<string, number> = {
  CRITICAL: 1,
  HIGH: 2,
  MEDIUM: 3,
  LOW: 4,
};

const CAUSE_TO_INCIDENT_TYPE: Record<string, string> = {
  'Container memory exhausted': 'OOM',
  'Storage capacity exhausted': 'DISK_FULL',
  'CPU saturation': 'CPU_OVERLOAD',
  'Traffic overload': 'TRAFFIC_OVERLOAD',
  'Unstable application pod': 'UNSTABLE_POD',
  'Deployment failure': 'DEPLOYMENT_FAILURE',
  'Upstream dependency failure': 'DEPENDENCY_FAILURE',
  'Application errors': 'HTTP_5XX_SPIKE',
  'Service performance degradation': 'HIGH_LATENCY',
  'Insufficient available replicas': 'INSUFFICIENT_REPLICAS',
  'Kubernetes scheduling failure': 'SCHEDULING_FAILURE',
  'Workload underutilized (scale down opportunity)': 'SCALE_DOWN_CANDIDATE',
};

function buildSpecificIncidentTitle(
  cause: string,
  serviceId: string,
  incidentType: string,
  metrics: {
    cpu?: number;
    ram?: number;
    disk?: number;
    latency?: number;
    request_rate?: number;
    http_5xx_rate?: number;
    pod_restart_count?: number;
  },
  evidence: string[] = []
): string {
  const evText = evidence.join(' ');
  const normType = String(incidentType || '').toUpperCase();

  if (normType === 'OOM' || cause === 'Container memory exhausted') {
    const isOom137 = /137|OOMKilled/i.test(evText);
    const ram = Math.round(Number(metrics?.ram || 0));
    const detail = isOom137 ? 'OOMKilled exitCode 137' : `RAM ${ram}%`;
    return `Tràn bộ nhớ RAM (${detail}) on ${serviceId}`;
  }
  if (normType === 'DISK_FULL' || cause === 'Storage capacity exhausted') {
    const disk = Math.round(Number(metrics?.disk || 0));
    return `Cạn kiệt dung lượng ổ đĩa (${disk}%) on ${serviceId}`;
  }
  if (normType === 'CPU_OVERLOAD' || cause === 'CPU saturation') {
    const cpu = Math.round(Number(metrics?.cpu || 0));
    const lat = Math.round(Number(metrics?.latency || 0));
    return lat >= 300
      ? `Bão hòa tài nguyên CPU (${cpu}%, Latency ${lat}ms) on ${serviceId}`
      : `Bão hòa tài nguyên CPU (${cpu}%) on ${serviceId}`;
  }
  if (normType === 'HIGH_LATENCY' || cause === 'Service performance degradation') {
    const lat = Math.round(Number(metrics?.latency || 0));
    return `Độ trễ phản hồi tăng cao (${lat}ms) on ${serviceId}`;
  }
  if (normType === 'HTTP_5XX_SPIKE' || cause === 'Application errors') {
    const rate = Number(metrics?.http_5xx_rate || 0).toFixed(1);
    return `Đột biến lỗi ứng dụng HTTP 5xx (${rate}%) on ${serviceId}`;
  }
  if (normType === 'TRAFFIC_OVERLOAD' || cause === 'Traffic overload') {
    const reqRate = Math.round(Number(metrics?.request_rate || 0));
    return `Quá tải lưu lượng truy cập (${reqRate} req/s) on ${serviceId}`;
  }
  if (normType === 'UNSTABLE_POD' || cause === 'Unstable application pod') {
    if (/CrashLoopBackOff/i.test(evText)) {
      return `Pod bị kẹt vòng lặp CrashLoopBackOff on ${serviceId}`;
    }
    if (/ImagePullBackOff|ErrImagePull/i.test(evText)) {
      return `Lỗi tải Container Image (ImagePullBackOff) on ${serviceId}`;
    }
    if (/Readiness probe/i.test(evText)) {
      return `Pod lỗi Readiness Probe (không sẵn sàng) on ${serviceId}`;
    }
    if (/Liveness probe/i.test(evText)) {
      return `Pod lỗi Liveness Probe (khởi động lại) on ${serviceId}`;
    }
    const restarts = Number(metrics?.pod_restart_count || 0);
    if (restarts > 0) {
      return `Pod khởi động lại liên tục (${restarts} lần) on ${serviceId}`;
    }
    return `Pod ứng dụng bất ổn định on ${serviceId}`;
  }

  return `${cause} on ${serviceId}`;
}

export class AiService {
  /**
   * Check connection and model readiness with AI Backend
   */
  public static async checkAiHealth(): Promise<{ connected: boolean; data?: AiBackendHealth; error?: string }> {
    const targetUrl = `${config.aiBackendUrl}/health`;
    const startHr = process.hrtime.bigint();
    return withBackendSpan('ai.health', { 'peer.service': 'ai-backend', operation: 'health' }, async () => {
      try {
        const headers = injectTraceContext({ 'Content-Type': 'application/json' });
        const response = await fetch(targetUrl, {
          method: 'GET',
          headers,
          signal: AbortSignal.timeout(4000),
        });
        const dur = Number(process.hrtime.bigint() - startHr) / 1e9;

        if (!response.ok) {
          recordExternalCall('ai-backend', 'health', 'error', dur);
          return {
            connected: false,
            error: `AI Backend responded with HTTP ${response.status}`,
          };
        }

        const data = (await response.json()) as AiBackendHealth;
        recordExternalCall('ai-backend', 'health', 'success', dur);
        return {
          connected: true,
          data,
        };
      } catch (error: any) {
        const dur = Number(process.hrtime.bigint() - startHr) / 1e9;
        const isTimeout = error?.name === 'TimeoutError' || error?.name === 'AbortError';
        recordExternalCall('ai-backend', 'health', isTimeout ? 'timeout' : 'error', dur);
        return {
          connected: false,
          error: `Cannot reach AI Backend at ${config.aiBackendUrl}: ${(error as Error).message}`,
        };
      }
    });
  }

  /**
   * Predict risk using GRU model and record inputs & predictions in database
   */
  public static async predictRisk(input: PredictRequestInput): Promise<PredictionResult> {
    const targetUrl = `${config.aiBackendUrl}/api/v1/predict`;

    // 1. Call AI Backend GRU inference
    const aiResponse: AiBackendPredictionResponse = await withBackendSpan(
      'ai.predict',
      { 'peer.service': 'ai-backend', operation: 'predict' },
      async () => {
        const startHr = process.hrtime.bigint();
        try {
          const headers = injectTraceContext({ 'Content-Type': 'application/json' });
          const response = await fetch(targetUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              service_id: input.service_id,
              sequence: input.sequence.map((pt) => ({
                cpu: Math.min(100, Math.max(0, Number(pt.cpu || 0))),
                ram: Math.min(100, Math.max(0, Number(pt.ram || 0))),
                disk: Math.min(100, Math.max(0, Number(pt.disk || 0))),
                request_rate: Math.max(0, Number(pt.request_rate || 0)),
                latency: Math.max(0, Number(pt.latency || 0)),
                http_5xx_rate: Math.min(100, Math.max(0, Number(pt.http_5xx_rate || 0))),
                pod_restart_count: Math.max(0, Number(pt.pod_restart_count || 0)),
                replica_count: Math.max(1, Number(pt.replica_count || 1)),
              })),
            }),
            signal: AbortSignal.timeout(6000),
          });
          const dur = Number(process.hrtime.bigint() - startHr) / 1e9;

          if (!response.ok) {
            recordExternalCall('ai-backend', 'predict', 'error', dur);
            const errorText = await response.text();
            throw new ApiError(
              response.status === 422 ? 400 : 502,
              `AI Backend prediction failed [HTTP ${response.status}]: ${errorText}`
            );
          }

          const parsed = (await response.json()) as AiBackendPredictionResponse;
          recordExternalCall('ai-backend', 'predict', 'success', dur);
          return parsed;
        } catch (error: any) {
          if (error instanceof ApiError) throw error;
          const dur = Number(process.hrtime.bigint() - startHr) / 1e9;
          const isTimeout = error?.name === 'TimeoutError' || error?.name === 'AbortError';
          recordExternalCall('ai-backend', 'predict', isTimeout ? 'timeout' : 'error', dur);
          throw new ApiError(
            503,
            `Failed to communicate with AI Backend at ${targetUrl}: ${(error as Error).message}`
          );
        }
      }
    );

    // 2. Persist to PostgreSQL database ONLY when risk detected (Predict-First / Zero-Write for NORMAL)
    const hasRisks = aiResponse.detected_risks && aiResponse.detected_risks.length > 0;
    const primaryRisk = hasRisks ? aiResponse.detected_risks[0].risk_type : 'NORMAL';

    if (!hasRisks || primaryRisk === 'NORMAL') {
      const horizonMinutes = input.prediction_horizon_minutes || 15;
      const predictedAt = new Date();
      const expiresAt = new Date(predictedAt.getTime() + horizonMinutes * 60 * 1000);
      return {
        prediction_id: `live-norm-${Date.now()}-${input.service_id}`,
        service_id: input.service_id,
        status: 'HEALTHY',
        primary_risk: 'NORMAL',
        overall_risk_score: 0,
        confidence_score: 0,
        threshold: aiResponse.threshold,
        thresholds: aiResponse.thresholds,
        detected_risks: [],
        risk_outputs: aiResponse.risk_outputs,
        prediction_horizon_minutes: horizonMinutes,
        environment_id: input.environment_id || '00000000-0000-0000-0000-000000000001',
        cluster_id: input.cluster_id || null,
        inputs_recorded: 0,
        predicted_at: predictedAt.toISOString(),
        expires_at: expiresAt.toISOString(),
      };
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Resolve model_id via Model
      const modelId = await AiPredictionModel.findActiveModelId(client);

      // Resolve cluster, environment, and workload via Models safely
      let workloadId: string | null = input.workload_id || null;
      let clusterId: string | null = input.cluster_id || null;
      let environmentId: string | null = input.environment_id || null;

      // 1. Resolve cluster first
      if (!clusterId) {
        const cluster = await ClusterModel.findFirst(client);
        if (cluster) {
          clusterId = cluster.id;
          if (!environmentId) environmentId = cluster.environment_id;
        }
      }

      // 2. Resolve environment
      if (!environmentId) {
        if (clusterId) {
          const cluster = await ClusterModel.findByIdOrName(clusterId, client);
          if (cluster) environmentId = cluster.environment_id;
        }
        if (!environmentId) {
          const env = await EnvironmentModel.findFirst(client);
          if (env) environmentId = env.id;
        }
      }

      // 3. Resolve or create workload safely with valid clusterId & namespaceId
      if (!workloadId) {
        let namespaceId: string | null = null;
        try {
          // Run optional read-only lookup on pool so any schema/lookup quirk never aborts the outer TX (25P02)
          const nsRes = await pool.query(
            `SELECT p.namespace_id FROM pods p 
             WHERE (p.labels->>'app' = $1 OR p.name LIKE $2) AND p.namespace_id IS NOT NULL 
             LIMIT 1`,
            [input.service_id, `${input.service_id}%`]
          );
          if (nsRes.rows.length > 0 && nsRes.rows[0].namespace_id) {
            namespaceId = nsRes.rows[0].namespace_id;
          } else {
            const fallbackNs = await pool.query(
              `SELECT id FROM namespaces WHERE (cluster_id::text = $1 OR cluster_id IN (SELECT id FROM clusters WHERE name = $1 OR id::text = $1) OR $1::text IS NULL) AND deleted_at IS NULL ORDER BY created_at ASC LIMIT 1`,
              [clusterId]
            );
            if (fallbackNs.rows.length > 0) {
              namespaceId = fallbackNs.rows[0].id;
            }
          }
        } catch {}

        const workload = await WorkloadModel.findOrCreateByName(input.service_id, clusterId, client, namespaceId);
        if (workload && workload.id && !workload.id.includes(input.service_id)) {
          workloadId = workload.id;
        }
      }

      if (!environmentId) {
        throw new ApiError(500, 'Cannot resolve a valid environment_id for prediction storage');
      }

      // Compute status & risk scores (already evaluated)

      const highestConfidence = hasRisks
        ? Math.max(...aiResponse.detected_risks.map((r) => r.confidence))
        : Math.max(...Object.values(aiResponse.risk_outputs).map((o) => o.confidence), 0);

      // Clamp score to 0..1 for numeric(5,4)
      const clampedScore = Math.min(Math.max(highestConfidence, 0), 1);
      const predictionStatus = hasRisks ? 'RISK_DETECTED' : 'HEALTHY';
      const horizonMinutes = input.prediction_horizon_minutes || 15;

      const predictedAt = new Date();
      const expiresAt = new Date(predictedAt.getTime() + horizonMinutes * 60 * 1000);

      // Delegate to AiPredictionModel
      const predictionRecord = await AiPredictionModel.create(client, {
        model_id: modelId,
        environment_id: environmentId,
        cluster_id: clusterId,
        workload_id: workloadId,
        prediction_type: primaryRisk,
        risk_score: clampedScore,
        confidence_score: clampedScore,
        prediction_horizon_minutes: horizonMinutes,
        status: predictionStatus,
        predicted_at: predictedAt,
        expires_at: expiresAt,
        risk_outputs: aiResponse.risk_outputs,
      });

      const predictionId = predictionRecord.id;

      // Delegate batch inputs to AiPredictionModel
      await AiPredictionModel.batchInsertInputs(
        client,
        predictionId,
        input.sequence,
        METRIC_UNITS
      );

      await client.query('COMMIT');

      return {
        prediction_id: predictionId,
        service_id: input.service_id,
        status: predictionStatus,
        primary_risk: primaryRisk,
        overall_risk_score: clampedScore,
        confidence_score: clampedScore,
        threshold: aiResponse.threshold,
        thresholds: aiResponse.thresholds,
        detected_risks: aiResponse.detected_risks,
        risk_outputs: aiResponse.risk_outputs,
        prediction_horizon_minutes: horizonMinutes,
        environment_id: environmentId,
        cluster_id: clusterId,
        inputs_recorded: input.sequence.length * 8,
        predicted_at: new Date(predictionRecord.predicted_at).toISOString(),
        expires_at: new Date(predictionRecord.expires_at).toISOString(),
      };
    } catch (dbError) {
      await client.query('ROLLBACK');
      throw dbError;
    } finally {
      client.release();
    }
  }

  /**
   * Root Cause Analysis (RCA): Analyze root cause and persist incidents, rca_analyses, rca_evidences & recommendations
   */
  public static async analyzeRootCause(input: RCARequestInput): Promise<RCAResult> {
    const targetUrl = `${config.aiBackendUrl}/api/v1/rca`;

    // 1. Resolve previous healing action history for this service/workload if not explicitly provided
    let prevAction: string | null = input.previous_action || null;
    let prevActionResult: 'SUCCESS' | 'FAILED' | 'PARTIAL' | 'UNKNOWN' | null =
      input.previous_action_result || null;
    let prevActionResultSource: 'POST_ACTION_VERIFICATION' | null =
      input.previous_action_result_source || null;
    let prevRcaRootCause: string | null = input.previous_rca_root_cause || null;

    let resolvedTarget: { workloadId: string | null; targetName: string; namespace: string; workloadType: string } | null = null;
    try {
      resolvedTarget = await WorkloadModel.resolveK8sTarget(input.service_id, input.cluster_id);
    } catch {}
    const targetAliasesLower = Array.from(
      new Set([input.service_id, resolvedTarget?.targetName].filter(Boolean).map((s) => String(s).toLowerCase()))
    );
    const resolvedWorkloadId: string | null = input.workload_id || resolvedTarget?.workloadId || null;

    if (!prevAction || !prevActionResult) {
      try {
        // Post-Action Verification Failure Check:
        // If a K8s command finished >= 20s ago (execution_status = 'SUCCEEDED') on an still-OPEN incident
        // and no successful recovery_verification exists yet, the fact that RCA is triggered again means
        // the Pod/service did NOT recover. Record verification_result = false and mark the action FAILED
        // so the 3-tier escalation ladder (RESTART_POD -> REPLACE_POD -> DRAIN_NODE / NO_ACTION) advances.
        const unverifiedActRes = await pool.query(
          `SELECT h.id, act.code AS action_code, h.target_name, h.completed_at
           FROM healing_actions h
           LEFT JOIN healing_action_types act ON act.id = h.action_type_id
           WHERE h.execution_status = 'SUCCEEDED'
             AND h.completed_at IS NOT NULL
             AND h.completed_at <= NOW() - interval '20 seconds'
             AND h.completed_at >= NOW() - interval '60 minutes'
             AND (
               LOWER(COALESCE(h.target_name, '')) = ANY($1)
               OR ($2::text IS NOT NULL AND (h.target_id::text = $2 OR LOWER(COALESCE(h.target_name, '')) = LOWER($2)))
             )
             AND NOT EXISTS (
               SELECT 1 FROM recovery_verifications rv
               WHERE rv.healing_action_id = h.id
             )
             AND h.completed_at > COALESCE((
               SELECT MAX(inc.resolved_at)
               FROM incidents inc
               WHERE inc.status = 'RESOLVED'
                 AND inc.resolved_at IS NOT NULL
                 AND inc.resolved_at >= NOW() - interval '60 minutes'
                 AND (LOWER(COALESCE(inc.target_name, '')) = ANY($1) OR ($2::text IS NOT NULL AND inc.target_id::text = $2))
             ), '1970-01-01'::timestamptz)
           ORDER BY h.completed_at DESC
           LIMIT 5;`,
          [targetAliasesLower, resolvedWorkloadId]
        );
        for (const unv of unverifiedActRes.rows) {
          const metricParts: string[] = [];
          const latVal = Number((input.metrics as any).latency ?? 0);
          const err5xxVal = Number((input.metrics as any).http_5xx_rate ?? 0);
          const diskVal = Number((input.metrics as any).disk ?? 0);
          const cpuVal = Number(input.metrics.cpu ?? 0);
          const ramVal = Number(input.metrics.ram ?? 0);
          const restartCount = Number(input.metrics.pod_restart_count ?? 0);

          if (latVal >= 300) metricParts.push(`Độ trễ: ${Math.round(latVal)}ms`);
          if (err5xxVal > 0) metricParts.push(`Lỗi HTTP 5xx: ${err5xxVal}%`);
          if (diskVal >= 80) metricParts.push(`Disk: ${diskVal}%`);
          if (cpuVal >= 80) metricParts.push(`CPU quá tải: ${cpuVal}%`);
          if (ramVal >= 90) metricParts.push(`RAM cạn kiệt: ${ramVal}%`);
          if (restartCount > 0) metricParts.push(`Restart: ${restartCount} lần`);

          const telemetrySnapshot = `CPU: ${cpuVal}%, RAM: ${ramVal}%, Restart: ${restartCount}`;
          const reasonStr = metricParts.length > 0
            ? `vẫn còn bất thường (${metricParts.join(', ')}; ${telemetrySnapshot})`
            : `chưa ổn định hoàn toàn theo chu kỳ kiểm tra (${telemetrySnapshot})`;

          const failMsg = `Hậu kiểm thất bại (Post-Action Verification Failed): Sau khi chạy ${unv.action_code || 'lệnh K8s'}, dịch vụ ${input.service_id} ${reasonStr}.`;
          const actCompletedAt = unv.completed_at ? new Date(unv.completed_at) : null;
          const actualFailDurationMs = actCompletedAt ? Math.max(1000, Date.now() - actCompletedAt.getTime()) : 1000;
          await pool.query(
            `INSERT INTO recovery_verifications (
               healing_action_id, verification_type, status_before, status_after,
               verification_result, verification_details, verified_at, duration_ms
             ) VALUES (
               $1, 'K8S_POST_HEALING_PROBE', $2::jsonb, $3::jsonb,
               false, $4::jsonb, NOW(), $5
             );`,
            [
              unv.id,
              JSON.stringify({ health: 'DEGRADED' }),
              JSON.stringify({ health: 'STILL_DEGRADED', metrics: input.metrics }),
              JSON.stringify({ status: 'VERIFICATION_FAILED', message: failMsg, elapsed_since_completion_ms: actualFailDurationMs }),
              actualFailDurationMs,
            ]
          ).catch(() => {});
          await pool.query(
            `UPDATE healing_actions
             SET error_message = $2,
                 result = jsonb_set(COALESCE(result, '{}'::jsonb), '{verification_status}', '"FAILED"'::jsonb)
             WHERE id = $1;`,
            [unv.id, failMsg]
          ).catch(() => {});
          console.log(`⚠️ [PostActionVerification] Action ${unv.id} (${unv.action_code}) on '${input.service_id}' FAILED post-action verification. Escalating in Re-RCA...`);
        }

        const prevActionQuery = `
          SELECT 
            h.execution_status,
            act.code AS action_code,
            act.name AS action_name,
            rca.root_cause_type,
            rv.verification_result
          FROM healing_actions h
          LEFT JOIN healing_action_types act ON act.id = h.action_type_id
          LEFT JOIN ai_recommendations rec ON rec.id = h.recommendation_id
          LEFT JOIN rca_analyses rca ON rca.id = rec.rca_analysis_id
          LEFT JOIN LATERAL (
            SELECT verification_result
            FROM recovery_verifications rv_inner
            WHERE rv_inner.healing_action_id = h.id
            ORDER BY rv_inner.verified_at DESC
            LIMIT 1
          ) rv ON true
          WHERE h.execution_status IN ('SUCCEEDED', 'FAILED')
            AND COALESCE(h.completed_at, h.started_at, h.created_at) >= NOW() - interval '60 minutes'
            AND (
              LOWER(COALESCE(h.target_name, '')) = ANY($1)
              OR ($2::text IS NOT NULL AND (h.target_id::text = $2 OR LOWER(COALESCE(h.target_name, '')) = LOWER($2)))
            )
            AND COALESCE(h.completed_at, h.started_at, h.created_at) > COALESCE((
              SELECT MAX(inc.resolved_at)
              FROM incidents inc
              WHERE inc.status = 'RESOLVED'
                AND inc.resolved_at IS NOT NULL
                AND inc.resolved_at >= NOW() - interval '60 minutes'
                AND (LOWER(COALESCE(inc.target_name, '')) = ANY($1) OR ($2::text IS NOT NULL AND inc.target_id::text = $2))
            ), '1970-01-01'::timestamptz)
          ORDER BY h.completed_at DESC NULLS LAST, h.started_at DESC NULLS LAST, h.created_at DESC
          LIMIT 1;
        `;
        const historyRes = await pool.query(prevActionQuery, [targetAliasesLower, resolvedWorkloadId]);

        if (historyRes.rows.length > 0) {
          const row = historyRes.rows[0];
          let mappedCode = row.action_code;
          if (mappedCode === 'CLEANUP_TEMP_FILES') mappedCode = 'CLEANUP_STORAGE';
          if (mappedCode === 'BLOCK_IP_TEMP') mappedCode = 'TEMPORARY_IP_BLOCK';

          let mappedStatus: 'SUCCESS' | 'FAILED' | 'PARTIAL' | 'UNKNOWN' | null = null;
          if (row.execution_status === 'FAILED' || row.verification_result === false) mappedStatus = 'FAILED';
          else if (row.execution_status === 'SUCCEEDED' && row.verification_result !== false) mappedStatus = 'SUCCESS';

          if (mappedCode && mappedStatus) {
            prevAction = mappedCode;
            prevActionResult = mappedStatus;
            prevActionResultSource = 'POST_ACTION_VERIFICATION';
            if (row.root_cause_type) {
              prevRcaRootCause = row.root_cause_type;
            }
          }
        }
      } catch (err) {
        console.warn('[AiService] Failed to query previous healing action history:', err);
      }
    }

    // Resolve action_history context (anti-loop & circuit breaker, scoped 60m + auto-reset after RESOLVED)
    let actionHistory = input.action_history || null;
    if (!actionHistory) {
      try {
        const actRes = await pool.query(
          `SELECT 
             h.id AS action_id,
             act.code AS action_code,
             h.target_type,
             h.target_name,
             h.target_id,
             h.started_at,
             h.completed_at,
             h.execution_status,
             rv.verification_result,
             h.error_message AS error_details,
             h.result AS verification_details
           FROM healing_actions h
           LEFT JOIN healing_action_types act ON act.id = h.action_type_id
           LEFT JOIN LATERAL (
             SELECT verification_result
             FROM recovery_verifications rv_inner
             WHERE rv_inner.healing_action_id = h.id
             ORDER BY rv_inner.verified_at DESC
             LIMIT 1
           ) rv ON true
           WHERE COALESCE(h.completed_at, h.started_at, h.created_at) >= NOW() - interval '60 minutes'
             AND (
               LOWER(COALESCE(h.target_name, '')) = ANY($1)
               OR ($2::text IS NOT NULL AND (h.target_id::text = $2 OR LOWER(COALESCE(h.target_name, '')) = LOWER($2)))
             )
             AND COALESCE(h.completed_at, h.started_at, h.created_at) > COALESCE((
               SELECT MAX(inc.resolved_at)
               FROM incidents inc
               WHERE inc.status = 'RESOLVED'
                 AND inc.resolved_at IS NOT NULL
                 AND inc.resolved_at >= NOW() - interval '60 minutes'
                 AND (LOWER(COALESCE(inc.target_name, '')) = ANY($1) OR ($2::text IS NOT NULL AND inc.target_id::text = $2))
             ), '1970-01-01'::timestamptz)
           ORDER BY h.completed_at DESC NULLS LAST, h.started_at DESC NULLS LAST, h.created_at DESC
           LIMIT 10;`,
          [targetAliasesLower, resolvedWorkloadId]
        );

        if (actRes.rows.length > 0) {
          let consecutiveFailures = 0;
          for (const r of actRes.rows) {
            const isPendingRecon =
              (typeof r.verification_details === 'object' && r.verification_details?.reconciliation_status === 'PENDING_RECONCILIATION') ||
              (typeof r.error_details === 'string' && r.error_details.includes('PENDING_RECONCILIATION'));

            // Audit 3: Do not increment consecutive_failures for actions still awaiting reconciliation
            if (isPendingRecon) {
              continue;
            }

            const isFailed = r.execution_status === 'FAILED' || r.verification_result === false;
            if (isFailed) {
              consecutiveFailures++;
            } else if (r.execution_status === 'SUCCEEDED' && r.verification_result !== false) {
              break;
            }
          }
          const blockedActions: string[] = [];
          for (const r of [...actRes.rows].reverse()) {
            const isFailed = r.execution_status === 'FAILED' || r.verification_result === false;
            if (isFailed && r.action_code) {
              if (!blockedActions.includes(r.action_code)) {
                blockedActions.push(r.action_code);
              }
            }
          }
          actionHistory = {
            total_actions_recorded: actRes.rows.length,
            consecutive_failures: consecutiveFailures,
            circuit_breaker_tripped: consecutiveFailures >= 3,
            blocked_actions: blockedActions,
            history: actRes.rows.map((r: any) => ({
              action_id: r.action_id,
              action: r.action_code || 'UNKNOWN',
              target_type: r.target_type,
              target_name: r.target_name,
              target_id: r.target_id,
              executed_at: r.started_at || r.completed_at,
              result: (r.execution_status === 'FAILED' || r.verification_result === false)
                ? 'FAILED'
                : (r.execution_status === 'SUCCEEDED' ? 'SUCCESS' : 'PARTIAL'),
              execution_status: r.execution_status,
              verification_result: typeof r.verification_details === 'object' && r.verification_details !== null
                ? JSON.stringify(r.verification_details)
                : (r.verification_details ? String(r.verification_details) : null),
              failure_reason: typeof r.error_details === 'object' && r.error_details !== null
                ? JSON.stringify(r.error_details)
                : (r.error_details ? String(r.error_details) : null),
            })),
          };
        }
      } catch (err) {
        console.warn('[AiService] Failed to compile action_history:', err);
      }
    }

    const rcaPayload: Record<string, any> = {
      service_id: input.service_id,
      pod_id: input.pod_id,
      metrics: {
        cpu: Number(input.metrics.cpu),
        ram: Number(input.metrics.ram),
        disk: Number(input.metrics.disk),
        latency: Number(input.metrics.latency),
        request_rate: Number(input.metrics.request_rate),
        http_5xx_rate: Number(input.metrics.http_5xx_rate),
        pod_restart_count: Number(input.metrics.pod_restart_count),
        replica_count: Number(input.metrics.replica_count),
      },
      logs: input.logs,
      kubernetes_events: input.kubernetes_events,
    };

    if (input.risk_type !== undefined && input.risk_type !== null && input.confidence !== undefined && input.confidence !== null) {
      rcaPayload.risk_type = input.risk_type;
      rcaPayload.confidence = input.confidence;
    }
    if ((input as any).rule_engine) rcaPayload.rule_engine = (input as any).rule_engine;
    if (input.request_id) rcaPayload.request_id = input.request_id;
    if (input.incident_id) rcaPayload.incident_id = input.incident_id;
    if (input.cluster_id) rcaPayload.cluster_id = input.cluster_id;
    if (input.namespace) rcaPayload.namespace = input.namespace;
    if (input.workload_id) rcaPayload.workload_id = input.workload_id;
    if (input.workload_type) rcaPayload.workload_type = input.workload_type;
    if (input.suspected_pod_name) rcaPayload.suspected_pod_name = input.suspected_pod_name;
    if (input.metric_sequence) rcaPayload.metric_sequence = input.metric_sequence;
    if (actionHistory) rcaPayload.action_history = actionHistory;

    if ((input as any).kubernetes) {
      rcaPayload.kubernetes = (input as any).kubernetes;
    }
    if ((input as any).prediction) {
      rcaPayload.prediction = (input as any).prediction;
    }

    if (!rcaPayload.pod_id) {
      try {
        const podRes = await pool.query(
          `SELECT p.name FROM pods p 
           LEFT JOIN workloads w ON w.id = p.workload_id 
           WHERE (w.name = $1 OR p.labels->>'app' = $1 OR p.labels->>'app.kubernetes.io/name' = $1 OR p.name LIKE $2)
             AND p.deleted_at IS NULL
             AND ($3::text IS NULL OR p.cluster_id::text = $3 OR p.cluster_id::text IN (SELECT id::text FROM clusters WHERE id::text = $3 OR cluster_uid = $3 OR name = $3))
           ORDER BY p.updated_at DESC NULLS LAST, p.created_at DESC 
           LIMIT 1`,
          [input.service_id, `${input.service_id}-%`, input.cluster_id || null]
        );
        if (podRes.rows.length > 0 && podRes.rows[0].name) {
          rcaPayload.pod_id = podRes.rows[0].name;
        }
      } catch (err) {
        console.warn('[AiService] Failed to auto-resolve pod_id:', err);
      }
    }

    if (prevAction && prevActionResult) {
      rcaPayload.previous_action = prevAction;
      rcaPayload.previous_action_result = prevActionResult;
      rcaPayload.previous_action_result_source = prevActionResultSource || 'POST_ACTION_VERIFICATION';
      if (prevRcaRootCause) {
        rcaPayload.previous_rca_root_cause = prevRcaRootCause;
      }
    }

    // 2. Call AI Backend RCA endpoint
    const aiResponse: AiBackendRCAResponse = await withBackendSpan(
      'ai.rca',
      { 'peer.service': 'ai-backend', operation: 'rca' },
      async () => {
        const startHr = process.hrtime.bigint();
        try {
          const headers = injectTraceContext({ 'Content-Type': 'application/json' });
          const response = await fetch(targetUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify(rcaPayload),
            signal: AbortSignal.timeout(25000),
          });
          const dur = Number(process.hrtime.bigint() - startHr) / 1e9;

          if (!response.ok) {
            recordExternalCall('ai-backend', 'rca', 'error', dur);
            const errorText = await response.text();
            throw new ApiError(
              response.status === 422 ? 400 : 502,
              `AI Backend RCA failed [HTTP ${response.status}]: ${errorText}`
            );
          }

          const parsed = (await response.json()) as AiBackendRCAResponse;
          recordExternalCall('ai-backend', 'rca', 'success', dur);
          return parsed;
        } catch (error: any) {
          if (error instanceof ApiError) throw error;
          const dur = Number(process.hrtime.bigint() - startHr) / 1e9;
          const isTimeout = error?.name === 'TimeoutError' || error?.name === 'AbortError';
          recordExternalCall('ai-backend', 'rca', isTimeout ? 'timeout' : 'error', dur);
          throw new ApiError(
            503,
            `Failed to communicate with AI Backend RCA at ${targetUrl}: ${(error as Error).message}`
          );
        }
      }
    );

    // 2. Persist to PostgreSQL database (incidents -> rca_analyses -> rca_evidences -> ai_recommendations)
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const validPredictionId: string | null =
        input.prediction_id && uuidRegex.test(input.prediction_id) ? input.prediction_id : null;

      // Resolve cluster, environment, organization, and workload safely
      let workloadId: string | null =
        input.workload_id && uuidRegex.test(input.workload_id) ? input.workload_id : null;
      let clusterId: string | null = input.cluster_id || null;
      let environmentId: string | null =
        input.environment_id && uuidRegex.test(input.environment_id) ? input.environment_id : null;
      let organizationId: string | null = null;

      // If valid UUID prediction_id provided, pull linked context from ai_predictions
      if (validPredictionId) {
        const predContext = await AiPredictionModel.findContextById(validPredictionId, client);
        if (predContext) {
          if (!environmentId) environmentId = predContext.environment_id;
          if (!clusterId) clusterId = predContext.cluster_id || null;
          if (!workloadId) workloadId = predContext.workload_id || null;
        }
      }

      if (!clusterId) {
        const cluster = await ClusterModel.findFirst(client);
        if (cluster) {
          clusterId = cluster.id;
          if (!environmentId) environmentId = cluster.environment_id;
        }
      }

      if (!environmentId) {
        if (clusterId) {
          const cluster = await ClusterModel.findByIdOrName(clusterId, client);
          if (cluster) environmentId = cluster.environment_id;
        }
        if (!environmentId) {
          const env = await EnvironmentModel.findFirst(client);
          if (env) {
            environmentId = env.id;
            organizationId = env.organization_id;
          }
        }
      }

      if (!workloadId) {
        const resolvedWl = await WorkloadModel.resolveK8sTarget(input.service_id, clusterId, client);
        if (resolvedWl.workloadId) {
          workloadId = resolvedWl.workloadId;
        } else {
          const workload = await WorkloadModel.findByName(input.service_id, client, clusterId);
          if (workload) {
            workloadId = workload.id;
          }
        }
      }

      if (environmentId && !organizationId) {
        const env = await EnvironmentModel.findByIdOrName(environmentId, client);
        if (env) {
          organizationId = env.organization_id;
        }
      }

      if (!organizationId) {
        const org = await OrganizationModel.findFirst(client);
        if (org) {
          organizationId = org.id;
        }
      }

      if (!organizationId || !environmentId) {
        throw new ApiError(500, 'Cannot resolve organization_id or environment_id for incident creation');
      }

      // 3. Delegate incident creation to IncidentModel (with strict 24h per-service deduplication & occurrence counter)
      const incidentType =
        input.risk_type ||
        CAUSE_TO_INCIDENT_TYPE[aiResponse.root_cause.cause] ||
        aiResponse.root_cause.cause ||
        'AI_ALERT';
      const incidentTitle = buildSpecificIncidentTitle(
        aiResponse.root_cause.cause,
        input.service_id,
        incidentType,
        input.metrics,
        aiResponse.evidence
      );
      const incidentSeverity =
        aiResponse.recommendation?.action === 'NO_ACTION' &&
        (String(aiResponse.recommendation?.priority || '').toUpperCase() === 'CRITICAL' ||
          Boolean((aiResponse.recommendation as any)?.action_parameters?.circuit_breaker_tripped))
          ? 'CRITICAL'
          : aiResponse.root_cause.severity || 'HIGH';
      const targetType = aiResponse.target?.type || 'WORKLOAD';

      let incidentId: string;
      let incidentCreatedAt: string;

      const existingIncident = await IncidentModel.findOpenIncident(
        client,
        environmentId,
        workloadId,
        incidentType,
        1440,
        input.service_id
      );

      if (existingIncident) {
        incidentId = existingIncident.id;
        incidentCreatedAt = new Date(existingIncident.created_at).toISOString();

        const sevRank: Record<string, number> = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };
        const curSevUpper = String(existingIncident.severity || 'HIGH').toUpperCase();
        const newSevUpper = String(incidentSeverity || 'HIGH').toUpperCase();
        const nextSeverity =
          (sevRank[newSevUpper] || 0) >= (sevRank[curSevUpper] || 0) ? newSevUpper : curSevUpper;

        await client.query(
          `UPDATE incidents
           SET occurrence_count = COALESCE(occurrence_count, 1) + 1,
               last_occurred_at = NOW(),
               detected_at = NOW(),
               target_name = COALESCE(target_name, $2),
               severity = $3,
               title = $4,
               description = $5,
               updated_at = NOW()
           WHERE id = $1;`,
          [incidentId, input.service_id, nextSeverity, incidentTitle, aiResponse.explanation]
        );

        // Check if identical recommendation is already proposed for this incident
        const existingRecs = await RecommendationModel.findByIncidentId(incidentId);
        const duplicateRec = existingRecs.find(
          (r: any) => r.recommendation === aiResponse.recommendation.action && r.status === 'PROPOSED'
        );

        if (duplicateRec) {
          if (
            aiResponse.recommendation.reason &&
            duplicateRec.reasoning !== aiResponse.recommendation.reason
          ) {
            await client.query(
              `UPDATE ai_recommendations
               SET reasoning = $2,
                   risk_level = $3,
                   priority = $4
               WHERE id = $1;`,
              [
                duplicateRec.id,
                aiResponse.recommendation.reason,
                aiResponse.recommendation.priority || 'HIGH',
                PRIORITY_INT_MAP[aiResponse.recommendation.priority] || 2,
              ]
            );
          }
          if (duplicateRec.rca_analysis_id) {
            await client.query(
              `UPDATE rca_analyses
               SET root_cause_type = $2,
                   root_cause_description = $3,
                   analysis_result = $4,
                   analyzed_at = NOW()
               WHERE id = $1;`,
              [
                duplicateRec.rca_analysis_id,
                aiResponse.root_cause.cause,
                aiResponse.explanation,
                JSON.stringify(aiResponse),
              ]
            ).catch(() => {});
          }
          await client.query('COMMIT');
          return {
            incident_id: incidentId,
            rca_analysis_id: duplicateRec.rca_analysis_id,
            recommendation_id: duplicateRec.id,
            service_id: input.service_id,
            root_cause: aiResponse.root_cause,
            evidence: aiResponse.evidence,
            recommendation: aiResponse.recommendation,
            explanation: aiResponse.explanation,
            target: aiResponse.target,
            environment_id: environmentId,
            cluster_id: clusterId,
            workload_id: workloadId,
            prediction_id: validPredictionId,
            created_at: incidentCreatedAt,
          };
        }
      } else {
        const incRecord = await IncidentModel.create(client, {
          organization_id: organizationId,
          environment_id: environmentId,
          cluster_id: clusterId,
          prediction_id: validPredictionId,
          source_type: 'AI_PREDICTION',
          target_type: targetType,
          target_id: workloadId,
          target_name: input.service_id,
          incident_type: incidentType,
          title: incidentTitle,
          description: aiResponse.explanation,
          severity: incidentSeverity,
          status: 'OPEN',
        });
        incidentId = incRecord.id;
        incidentCreatedAt = new Date(incRecord.created_at).toISOString();
      }

      // 4. Delegate RCA Analysis creation to RcaModel
      const rcaConfidence = Math.min(Math.max(aiResponse.root_cause.confidence, 0), 1);
      const rcaRecord = await RcaModel.createAnalysis(client, {
        incident_id: incidentId,
        root_cause_type: aiResponse.root_cause.cause,
        root_cause_description: aiResponse.explanation,
        confidence_score: rcaConfidence,
        analysis_method: (aiResponse as any).engine || 'OpenAI GPT-4o-mini',
        analysis_result: JSON.stringify(aiResponse),
      });
      const rcaAnalysisId = rcaRecord.id;

      // 5. Delegate RCA Evidences creation to RcaModel
      if (aiResponse.evidence && aiResponse.evidence.length > 0) {
        await RcaModel.createEvidences(
          client,
          rcaAnalysisId,
          input.service_id,
          aiResponse.evidence
        );
      }

      // 6. Delegate Recommendation creation to RecommendationModel
      const mappedActionName = ACTION_NAME_MAP[aiResponse.recommendation.action] || 'Restart Pod';
      const actionTypeId = await RecommendationModel.findActionTypeIdByName(
        client,
        mappedActionName
      );

      const priorityNumber = PRIORITY_INT_MAP[aiResponse.recommendation.priority] || 2;
      const recRecord = await RecommendationModel.create(client, {
        incident_id: incidentId,
        rca_analysis_id: rcaAnalysisId,
        prediction_id: validPredictionId,
        action_type_id: actionTypeId,
        recommendation: aiResponse.recommendation.action,
        reasoning: aiResponse.recommendation.reason,
        risk_level: aiResponse.recommendation.priority,
        priority: priorityNumber,
        status: 'PROPOSED',
      });
      const recommendationId = recRecord.id;

      await client.query('COMMIT');

      return {
        incident_id: incidentId,
        rca_analysis_id: rcaAnalysisId,
        recommendation_id: recommendationId,
        service_id: input.service_id,
        prediction: aiResponse.prediction || null,
        root_cause: aiResponse.root_cause,
        evidence: aiResponse.evidence,
        recommendation: aiResponse.recommendation,
        explanation: aiResponse.explanation,
        historical_context_used: aiResponse.historical_context_used ?? false,
        similar_incident_ids: aiResponse.similar_incident_ids ?? [],
        target: aiResponse.target || {
          type: aiResponse.recommendation.target_type || targetType,
          name: aiResponse.recommendation.target_name || rcaPayload.pod_id || input.service_id,
          id: aiResponse.recommendation.target_id || workloadId || undefined,
        },
        environment_id: environmentId,
        cluster_id: clusterId,
        workload_id: workloadId,
        prediction_id: validPredictionId,
        created_at: incidentCreatedAt,
        previous_action: prevAction,
        previous_action_result: prevActionResult,
        namespace: aiResponse.namespace || input.namespace || undefined,
        request_id: aiResponse.request_id || input.request_id || undefined,
      };
    } catch (dbError) {
      await client.query('ROLLBACK');
      throw dbError;
    } finally {
      client.release();
    }
  }
}
