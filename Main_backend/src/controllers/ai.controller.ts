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

      const result = await AiPredictionModel.findMany({
        limit,
        offset,
        status,
        prediction_type,
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
      const stats = await AiPredictionModel.getPredictionStats();
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

      const result = await IncidentModel.findMany({
        limit,
        offset,
        status,
        severity,
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
   * POST /api/v1/ai/recommendations/:id/apply
   * Mark recommendation as applied
   */
  public static async applyRecommendation(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const rec = await RecommendationModel.findById(id);
      if (!rec) {
        return ApiResponse.error(res, 'Recommendation not found', 404);
      }

      const updated = await RecommendationModel.updateStatus(id, 'APPLIED');
      return ApiResponse.success(
        res,
        `Applied recommendation '${rec.recommendation}' successfully`,
        updated,
        200
      );
    } catch (error) {
      return ApiResponse.error(res, (error as Error).message, 500);
    }
  }
}
