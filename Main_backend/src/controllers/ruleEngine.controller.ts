import { Request, Response } from 'express';
import { RuleEngineService } from '../services/ruleEngine.service';
import { ApiResponse } from '../utils/apiResponse';
import { RuleEngineInputSchema } from '../schemas/ruleEngine.schema';

export class RuleEngineController {
  /**
   * Evaluate real-time metrics & state through Rule Engine
   * POST /api/v1/rule-engine/evaluate
   */
  public static async evaluate(req: Request, res: Response) {
    const parseResult = RuleEngineInputSchema.safeParse(req.body);
    if (!parseResult.success) {
      return ApiResponse.error(
        res,
        'Validation failed: Invalid Rule Engine evaluation payload',
        400,
        parseResult.error.format()
      );
    }

    const evaluation = RuleEngineService.evaluate(parseResult.data);

    return ApiResponse.success(
      res,
      'Rule Engine evaluation completed successfully',
      evaluation,
      200
    );
  }

  /**
   * Get current active thresholds of the Rule Engine
   * GET /api/v1/rule-engine/thresholds
   */
  public static async getThresholds(req: Request, res: Response) {
    const thresholds = RuleEngineService.getThresholds();
    return ApiResponse.success(
      res,
      'Rule Engine thresholds retrieved successfully',
      thresholds,
      200
    );
  }
}
