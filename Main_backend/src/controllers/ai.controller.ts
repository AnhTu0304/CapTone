import { Request, Response } from 'express';
import { AiService } from '../services/ai.service';
import { ApiResponse } from '../utils/apiResponse';
import { PredictRequestSchema, RCARequestSchema } from '../schemas/ai.schema';
import { ApiError } from '../utils/apiError';

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
    // 1. Validate request body with Zod
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
      // 2. Perform prediction via AI Backend & persist to database
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
    // 1. Validate request body with Zod
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
      // 2. Run Root Cause Analysis via AI Backend and persist records
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
}
