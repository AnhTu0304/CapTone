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
}

export interface RCAResult {
  incident_id: string;
  rca_analysis_id: string;
  recommendation_id: string;
  service_id: string;
  root_cause: RootCauseResult;
  evidence: string[];
  recommendation: RecommendationResult;
  explanation: string;
  target?: TargetContext;
  environment_id: string;
  cluster_id?: string | null;
  workload_id?: string | null;
  prediction_id?: string | null;
  created_at: string;
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
  ROLLBACK_DEPLOYMENT: 'Rollback Deployment',
  CLEANUP_STORAGE: 'Cleanup Temporary Files',
  TEMPORARY_IP_BLOCK: 'Temporary IP Block',
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
            cpu: Number(pt.cpu),
            ram: Number(pt.ram),
            disk: Number(pt.disk),
            request_rate: Number(pt.request_rate),
            latency: Number(pt.latency),
            http_5xx_rate: Number(pt.http_5xx_rate),
            pod_restart_count: Number(pt.pod_restart_count),
            replica_count: Number(pt.replica_count),
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

      // Resolve workload, cluster, environment via Models
      let workloadId: string | null = input.workload_id || null;
      let clusterId: string | null = input.cluster_id || null;
      let environmentId: string | null = input.environment_id || null;

      if (!workloadId) {
        const workload = await WorkloadModel.findByName(input.service_id, client);
        if (workload) {
          workloadId = workload.id;
          if (!clusterId && workload.cluster_id) clusterId = workload.cluster_id;
        }
      }

      if (!clusterId && workloadId) {
        clusterId = await WorkloadModel.findClusterId(workloadId, client);
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
          if (env) environmentId = env.id;
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

    // 1. Call AI Backend RCA endpoint
    let aiResponse: AiBackendRCAResponse;
    try {
      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
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
        }),
        signal: AbortSignal.timeout(8000),
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

      // Resolve workload, cluster, environment, and organization
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

      if (!workloadId) {
        const workload = await WorkloadModel.findByName(input.service_id, client);
        if (workload) {
          workloadId = workload.id;
          if (!clusterId && workload.cluster_id) clusterId = workload.cluster_id;
        }
      }

      if (!clusterId && workloadId) {
        clusterId = await WorkloadModel.findClusterId(workloadId, client);
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
        analysis_method: 'AI_DETERMINISTIC_RULES',
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
    } catch (dbError) {
      await client.query('ROLLBACK');
      throw dbError;
    } finally {
      client.release();
    }
  }
}
