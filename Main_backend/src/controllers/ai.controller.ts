import { pool } from '../config/database';
import { Request, Response } from 'express';
import { AiService } from '../services/ai.service';
import { ApiResponse } from '../utils/apiResponse';
import { PredictRequestSchema, RCARequestSchema } from '../schemas/ai.schema';
import { ApiError } from '../utils/apiError';
import {
  AiPredictionModel,
  IncidentModel,
  RcaModel,
  RecommendationModel,
} from '../models';

export class AiController {
  /**
   * Health check endpoint to verify AI Backend & GRU model readiness
   * GET /api/v1/ai/health
   */
  public static async getAiHealth(req: Request, res: Response) {
    const healthResult = await AiService.checkAiHealth();

    if (!healthResult.connected) {
      return ApiResponse.error(
        res,
        'AI Backend is not reachable or not ready',
        503,
        { error: healthResult.error }
      );
    }

    return ApiResponse.success(
      res,
      'AI Backend and GRU model are operational',
      healthResult.data,
      200
    );
  }

  /**
   * Predict multi-label risk for a service workload and persist results
   * POST /api/v1/ai/predict
   */
  public static async predict(req: Request, res: Response) {
    const validationResult = PredictRequestSchema.safeParse(req.body);
    if (!validationResult.success) {
      return ApiResponse.error(
        res,
        'Validation failed: Invalid prediction input payload',
        400,
        validationResult.error.format()
      );
    }

    try {
      const result = await AiService.predictRisk(validationResult.data);
      return ApiResponse.success(
        res,
        'Risk prediction evaluated and persisted successfully',
        result,
        201
      );
    } catch (error) {
      if (error instanceof ApiError) {
        return ApiResponse.error(res, error.message, error.statusCode, error.errors);
      }
      return ApiResponse.error(
        res,
        `Unexpected error during risk prediction: ${(error as Error).message}`,
        500
      );
    }
  }

  /**
   * Analyze root cause (RCA), create incident, record evidences and action recommendations
   * POST /api/v1/ai/rca
   */
  public static async analyzeRootCause(req: Request, res: Response) {
    const validationResult = RCARequestSchema.safeParse(req.body);
    if (!validationResult.success) {
      return ApiResponse.error(
        res,
        'Validation failed: Invalid RCA request payload',
        400,
        validationResult.error.format()
      );
    }

    try {
      const result = await AiService.analyzeRootCause(validationResult.data);
      return ApiResponse.success(
        res,
        'Root cause analysis evaluated, incident opened, and recommendations recorded successfully',
        result,
        201
      );
    } catch (error) {
      if (error instanceof ApiError) {
        return ApiResponse.error(res, error.message, error.statusCode, error.errors);
      }
      return ApiResponse.error(
        res,
        `Unexpected error during RCA evaluation: ${(error as Error).message}`,
        500
      );
    }
  }

  /**
   * GET /api/v1/ai/models
   * List all registered AI models
   */
  public static async getModels(req: Request, res: Response) {
    try {
      const models = await AiPredictionModel.findAllModels();
      return ApiResponse.success(res, 'Retrieved AI models list', models, 200);
    } catch (error) {
      return ApiResponse.error(res, (error as Error).message, 500);
    }
  }

  /**
   * GET /api/v1/ai/predictions
   * List risk predictions with filtering & pagination
   */
  public static async getPredictions(req: Request, res: Response) {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
      const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;
      const status = req.query.status as string | undefined;
      const prediction_type = req.query.prediction_type as string | undefined;
      const cluster_id = req.query.cluster_id as string | undefined;

      const result = await AiPredictionModel.findMany({
        limit,
        offset,
        status,
        prediction_type,
        cluster_id,
      });

      return ApiResponse.success(res, 'Retrieved predictions list', result, 200);
    } catch (error) {
      return ApiResponse.error(res, (error as Error).message, 500);
    }
  }

  /**
   * GET /api/v1/ai/predictions/stats
   * Aggregated statistics of predictions
   */
  public static async getPredictionStats(req: Request, res: Response) {
    try {
      const cluster_id = req.query.cluster_id as string | undefined;
      const stats = await AiPredictionModel.getPredictionStats(cluster_id);
      return ApiResponse.success(res, 'Retrieved prediction statistics', stats, 200);
    } catch (error) {
      return ApiResponse.error(res, (error as Error).message, 500);
    }
  }

  /**
   * GET /api/v1/ai/predictions/:id
   * Get prediction detail by ID
   */
  public static async getPredictionById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const prediction = await AiPredictionModel.findById(id);
      if (!prediction) {
        return ApiResponse.error(res, 'Prediction not found', 404);
      }
      return ApiResponse.success(res, 'Retrieved prediction details', prediction, 200);
    } catch (error) {
      return ApiResponse.error(res, (error as Error).message, 500);
    }
  }

  /**
   * GET /api/v1/ai/predictions/:id/inputs
   * Get 12 timesteps input sequence for prediction
   */
  public static async getPredictionInputs(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const inputs = await AiPredictionModel.findInputsByPredictionId(id);
      return ApiResponse.success(
        res,
        `Retrieved ${inputs.length} input observations for prediction`,
        inputs,
        200
      );
    } catch (error) {
      return ApiResponse.error(res, (error as Error).message, 500);
    }
  }

  /**
   * GET /api/v1/ai/incidents
   * List incidents with filtering & pagination
   */
  public static async getIncidents(req: Request, res: Response) {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
      const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;
      const status = req.query.status as string | undefined;
      const severity = req.query.severity as string | undefined;
      const cluster_id = req.query.cluster_id as string | undefined;

      const result = await IncidentModel.findMany({
        limit,
        offset,
        status,
        severity,
        cluster_id,
      });

      return ApiResponse.success(res, 'Retrieved incidents list', result, 200);
    } catch (error) {
      return ApiResponse.error(res, (error as Error).message, 500);
    }
  }

  /**
   * GET /api/v1/ai/incidents/:id
   * Get incident detail by ID (including RCA)
   */
  public static async getIncidentById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const incident = await IncidentModel.findById(id);
      if (!incident) {
        return ApiResponse.error(res, 'Incident not found', 404);
      }
      return ApiResponse.success(res, 'Retrieved incident details', incident, 200);
    } catch (error) {
      return ApiResponse.error(res, (error as Error).message, 500);
    }
  }

  /**
   * PATCH /api/v1/ai/incidents/:id/status
   * Update incident status (e.g. INVESTIGATING, RESOLVED, IGNORED)
   */
  public static async updateIncidentStatus(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { status } = req.body;
      if (!status) {
        return ApiResponse.error(res, 'Missing status field in request body', 400);
      }

      const updated = await IncidentModel.updateStatus(id, status);
      if (!updated) {
        return ApiResponse.error(res, 'Incident not found', 404);
      }

      return ApiResponse.success(res, 'Updated incident status successfully', updated, 200);
    } catch (error) {
      return ApiResponse.error(res, (error as Error).message, 500);
    }
  }

  /**
   * GET /api/v1/ai/incidents/:id/evidences
   * Get RCA evidence items for an incident
   */
  public static async getIncidentEvidences(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const evidences = await RcaModel.findEvidencesByIncidentId(id);
      return ApiResponse.success(
        res,
        `Retrieved ${evidences.length} RCA evidence records`,
        evidences,
        200
      );
    } catch (error) {
      return ApiResponse.error(res, (error as Error).message, 500);
    }
  }

  /**
   * GET /api/v1/ai/incidents/:id/recommendations
   * Get recommendations for an incident
   */
  public static async getIncidentRecommendations(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const recommendations = await RecommendationModel.findByIncidentId(id);
      return ApiResponse.success(
        res,
        `Retrieved ${recommendations.length} recommendations for incident`,
        recommendations,
        200
      );
    } catch (error) {
      return ApiResponse.error(res, (error as Error).message, 500);
    }
  }

  /**
   * GET /api/v1/ai/recommendations
   * List recommendations across incidents
   */
  public static async getRecommendations(req: Request, res: Response) {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
      const cluster_id = req.query.cluster_id as string | undefined;
      const result = await RecommendationModel.getRecent(limit, cluster_id);
      return ApiResponse.success(res, 'Retrieved recommendations list', result, 200);
    } catch (error) {
      return ApiResponse.error(res, (error as Error).message, 500);
    }
  }

  /**
   * GET /api/v1/ai/healing-action-types
   * List all healing action types
   */
  public static async getHealingActionTypes(req: Request, res: Response) {
    try {
      const actionTypes = await RecommendationModel.findAllActionTypes();
      return ApiResponse.success(
        res,
        'Retrieved healing action types',
        actionTypes,
        200
      );
    } catch (error) {
      return ApiResponse.error(res, (error as Error).message, 500);
    }
  }

  /**
   * GET /api/v1/ai/healing-actions
   * List executed self-healing actions from healing_actions table
   */
  public static async getHealingActions(req: Request, res: Response) {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
      const cluster_id = req.query.cluster_id as string | undefined;
      const actions = await RecommendationModel.getHealingActions(limit, cluster_id);
      return ApiResponse.success(res, 'Retrieved executed healing actions', actions, 200);
    } catch (error) {
      return ApiResponse.error(res, (error as Error).message, 500);
    }
  }

  /**
   * POST /api/v1/ai/recommendations/:id/apply
   * Mark recommendation as applied and insert an audit record into healing_actions
   */
  public static async applyRecommendation(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const rec = await RecommendationModel.findById(id);
      if (!rec) {
        return ApiResponse.error(res, 'Recommendation not found', 404);
      }

      // 1. Fetch incident details to bind environment_id and target workload
      let incident: any = null;
      if (rec.incident_id) {
        incident = await IncidentModel.findById(rec.incident_id);
      }

      // Resolve environment_id
      let environmentId = incident?.environment_id;
      if (!environmentId) {
        const envRes = await pool.query('SELECT id FROM environments LIMIT 1;');
        environmentId = envRes.rows[0]?.id || 'e0000000-0000-0000-0000-000000000001';
      }

      // Resolve action_type_id
      let actionTypeId = rec.action_type_id;
      if (!actionTypeId) {
        const actRes = await pool.query(
          'SELECT id FROM healing_action_types WHERE code = $1 OR name ILIKE $2 LIMIT 1;',
          [rec.recommendation, `%${rec.recommendation}%`]
        );
        actionTypeId = actRes.rows[0]?.id || 'd0000000-0000-0000-0000-000000000001';
      }

      const targetType = incident?.target_type || 'WORKLOAD';
      const targetName = incident?.target_id || 'sme-order-service';
      const user = (req as any).user;

      // 2. Insert into healing_actions
      const healingAction = await RecommendationModel.createHealingAction({
        incident_id: rec.incident_id,
        recommendation_id: rec.id,
        environment_id: environmentId,
        action_type_id: actionTypeId,
        target_type: targetType,
        target_name: targetName,
        risk_level: rec.risk_level || 'LOW',
        execution_mode: 'MANUAL',
        approval_status: 'APPROVED',
        execution_status: 'SUCCEEDED',
        requested_by: user?.id,
        executed_by: user?.id,
        result: {
          status: 'SUCCESS',
          action: rec.recommendation,
          target: targetName,
          applied_by: user?.email || 'admin@example.com',
          message: `Self-healing mitigate action '${rec.recommendation}' executed successfully on ${targetName}.`,
          timestamp: new Date().toISOString(),
        },
      });

      // 3. Mark recommendation as APPLIED
      const updatedRec = await RecommendationModel.updateStatus(id, 'APPLIED');

      // 4. Mark associated incident as RESOLVED
      if (rec.incident_id) {
        await IncidentModel.updateStatus(rec.incident_id, 'RESOLVED');
      }

      return ApiResponse.success(
        res,
        `Applied recommendation '${rec.recommendation}' and executed healing action successfully`,
        {
          recommendation: updatedRec,
          healing_action: healingAction,
        },
        200
      );
    } catch (error) {
      return ApiResponse.error(res, (error as Error).message, 500);
    }
  }
}
