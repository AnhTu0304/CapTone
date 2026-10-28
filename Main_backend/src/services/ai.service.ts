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
  similar_incident_ids?: string[];
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

export class AiService {
  /**
   * Check connection and model readiness with AI Backend
   */
  public static async checkAiHealth(): Promise<{ connected: boolean; data?: AiBackendHealth; error?: string }> {
    const targetUrl = `${config.aiBackendUrl}/health`;
    try {
      const response = await fetch(targetUrl, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(4000),
      });

      if (!response.ok) {
        return {
          connected: false,
          error: `AI Backend responded with HTTP ${response.status}`,
        };
      }

      const data = (await response.json()) as AiBackendHealth;
      return {
        connected: true,
        data,
      };
    } catch (error) {
      return {
        connected: false,
        error: `Cannot reach AI Backend at ${config.aiBackendUrl}: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Predict risk using GRU model and record inputs & predictions in database
   */
  public static async predictRisk(input: PredictRequestInput): Promise<PredictionResult> {
    const targetUrl = `${config.aiBackendUrl}/api/v1/predict`;

    // 1. Call AI Backend GRU inference
    let aiResponse: AiBackendPredictionResponse;
    try {
      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

      if (!response.ok) {
        const errorText = await response.text();
        throw new ApiError(
          response.status === 422 ? 400 : 502,
          `AI Backend prediction failed [HTTP ${response.status}]: ${errorText}`
        );
      }

      aiResponse = (await response.json()) as AiBackendPredictionResponse;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(
        503,
        `Failed to communicate with AI Backend at ${targetUrl}: ${(error as Error).message}`
      );
    }

    // 2. Persist to PostgreSQL database (ai_predictions & prediction_inputs)
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
          const nsRes = await client.query(
            `SELECT p.namespace_id FROM pods p 
             WHERE (p.labels->>'app' = $1 OR p.name LIKE $2) AND p.namespace_id IS NOT NULL 
             LIMIT 1`,
            [input.service_id, `${input.service_id}%`]
          );
          if (nsRes.rows.length > 0 && nsRes.rows[0].namespace_id) {
            namespaceId = nsRes.rows[0].namespace_id;
          } else {
            const fallbackNs = await client.query(
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

      // Compute status & risk scores
      const hasRisks = aiResponse.detected_risks && aiResponse.detected_risks.length > 0;
      const primaryRisk = hasRisks ? aiResponse.detected_risks[0].risk_type : 'NORMAL';

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

    if (!prevAction || !prevActionResult) {
      try {
        let targetWorkloadId: string | null = input.workload_id || null;
        if (!targetWorkloadId) {
          const wl = await WorkloadModel.findByName(input.service_id);
          if (wl) {
            targetWorkloadId = wl.id;
          }
        }

        const prevActionQuery = `
          SELECT 
            h.execution_status,
            act.code AS action_code,
            act.name AS action_name,
            rca.root_cause_type
          FROM healing_actions h
          LEFT JOIN healing_action_types act ON act.id = h.action_type_id
          LEFT JOIN ai_recommendations rec ON rec.id = h.recommendation_id
          LEFT JOIN rca_analyses rca ON rca.id = rec.rca_analysis_id
          WHERE h.execution_status IN ('SUCCEEDED', 'FAILED')
            AND (
              h.target_name ILIKE $1 
              OR ($2::text IS NOT NULL AND (h.target_id::text = $2 OR h.target_name = $2))
            )
          ORDER BY h.completed_at DESC NULLS LAST, h.started_at DESC NULLS LAST, h.created_at DESC
          LIMIT 1;
        `;
        const searchPattern = `%${input.service_id}%`;
        const historyRes = await pool.query(prevActionQuery, [searchPattern, targetWorkloadId]);

        if (historyRes.rows.length > 0) {
          const row = historyRes.rows[0];
          let mappedCode = row.action_code;
          if (mappedCode === 'CLEANUP_TEMP_FILES') mappedCode = 'CLEANUP_STORAGE';
          if (mappedCode === 'BLOCK_IP_TEMP') mappedCode = 'TEMPORARY_IP_BLOCK';

          let mappedStatus: 'SUCCESS' | 'FAILED' | 'PARTIAL' | 'UNKNOWN' | null = null;
          if (row.execution_status === 'SUCCEEDED') mappedStatus = 'SUCCESS';
          else if (row.execution_status === 'FAILED') mappedStatus = 'FAILED';

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

    // Resolve action_history context (anti-loop & circuit breaker) if not passed
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
             h.error_message AS error_details,
             h.result AS verification_details
           FROM healing_actions h
           LEFT JOIN healing_action_types act ON act.id = h.action_type_id
           WHERE (h.target_name ILIKE $1 OR ($2::text IS NOT NULL AND (h.target_id::text = $2 OR h.target_name = $2)))
           ORDER BY h.completed_at DESC NULLS LAST, h.started_at DESC NULLS LAST, h.created_at DESC
           LIMIT 10;`,
          [`%${input.service_id}%`, input.workload_id || null]
        );

        if (actRes.rows.length > 0) {
          let consecutiveFailures = 0;
          for (const r of actRes.rows) {
            if (r.execution_status === 'FAILED') {
              consecutiveFailures++;
            } else if (r.execution_status === 'SUCCEEDED') {
              break;
            }
          }
          const blockedActions: string[] = [];
          for (const r of actRes.rows) {
            if (r.execution_status === 'FAILED' && r.action_code) {
              if (!blockedActions.includes(r.action_code)) {
                blockedActions.push(r.action_code);
              }
            }
          }
          actionHistory = {
            total_actions_recorded: actRes.rows.length,
            consecutive_failures: consecutiveFailures,
            circuit_breaker_tripped: consecutiveFailures >= 2,
            blocked_actions: blockedActions,
            history: actRes.rows.map((r: any) => ({
              action_id: r.action_id,
              action: r.action_code || 'UNKNOWN',
              target_type: r.target_type,
              target_name: r.target_name,
              target_id: r.target_id,
              executed_at: r.started_at || r.completed_at,
              result: r.execution_status === 'SUCCEEDED' ? 'SUCCESS' : (r.execution_status === 'FAILED' ? 'FAILED' : 'PARTIAL'),
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
      risk_type: input.risk_type,
      confidence: input.confidence,
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
           WHERE (w.name = $1 OR p.name LIKE $2 OR p.labels->>'app' = $1)
             AND p.deleted_at IS NULL 
           ORDER BY p.restart_count DESC, p.created_at DESC 
           LIMIT 1`,
          [input.service_id, `${input.service_id}%`]
        );
        if (podRes.rows.length > 0 && podRes.rows[0].name) {
          rcaPayload.pod_id = podRes.rows[0].name;
        }
      } catch (err) {
        console.warn('[AiService] Failed to auto-resolve pod_id:', err);
      }
    };

    if (prevAction && prevActionResult) {
      rcaPayload.previous_action = prevAction;
      rcaPayload.previous_action_result = prevActionResult;
      rcaPayload.previous_action_result_source = prevActionResultSource || 'POST_ACTION_VERIFICATION';
      if (prevRcaRootCause) {
        rcaPayload.previous_rca_root_cause = prevRcaRootCause;
      }
    }

    // 2. Call AI Backend RCA endpoint
    let aiResponse: AiBackendRCAResponse;
    try {
      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rcaPayload),
        signal: AbortSignal.timeout(25000),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new ApiError(
          response.status === 422 ? 400 : 502,
          `AI Backend RCA failed [HTTP ${response.status}]: ${errorText}`
        );
      }

      aiResponse = (await response.json()) as AiBackendRCAResponse;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(
        503,
        `Failed to communicate with AI Backend RCA at ${targetUrl}: ${(error as Error).message}`
      );
    }

    // 2. Persist to PostgreSQL database (incidents -> rca_analyses -> rca_evidences -> ai_recommendations)
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Resolve cluster, environment, organization, and workload safely
      let workloadId: string | null = input.workload_id || null;
      let clusterId: string | null = input.cluster_id || null;
      let environmentId: string | null = input.environment_id || null;
      let organizationId: string | null = null;

      // If prediction_id provided, pull linked context from ai_predictions
      if (input.prediction_id) {
        const predContext = await AiPredictionModel.findContextById(input.prediction_id, client);
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
        const workload = await WorkloadModel.findByName(input.service_id, client, clusterId);
        if (workload) {
          workloadId = workload.id;
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

      // 3. Delegate incident creation to IncidentModel (with deduplication)
      const incidentTitle = `[AI Alert] ${aiResponse.root_cause.cause} on ${input.service_id}`;
      const incidentSeverity = aiResponse.root_cause.severity || 'HIGH';
      const incidentType = input.risk_type || aiResponse.root_cause.cause || 'AI_ALERT';
      const targetType = aiResponse.target?.type || 'WORKLOAD';

      let incidentId: string;
      let incidentCreatedAt: string;

      const existingIncident = await IncidentModel.findOpenIncident(
        client,
        environmentId,
        workloadId,
        incidentType,
        15
      );

      if (existingIncident) {
        incidentId = existingIncident.id;
        incidentCreatedAt = new Date(existingIncident.created_at).toISOString();

        // Check if identical recommendation is already proposed for this incident
        const existingRecs = await RecommendationModel.findByIncidentId(incidentId);
        const duplicateRec = existingRecs.find(
          (r: any) => r.recommendation === aiResponse.recommendation.action && r.status === 'PROPOSED'
        );

        if (duplicateRec) {
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
            prediction_id: input.prediction_id || null,
            created_at: incidentCreatedAt,
          };
        }
      } else {
        const incRecord = await IncidentModel.create(client, {
          organization_id: organizationId,
          environment_id: environmentId,
          cluster_id: clusterId,
          prediction_id: input.prediction_id || null,
          source_type: 'AI_PREDICTION',
          target_type: targetType,
          target_id: workloadId,
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
        prediction_id: input.prediction_id || null,
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
        prediction_id: input.prediction_id || null,
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
