import { Request, Response, NextFunction } from 'express';
import { AlertLifecycleService } from '../services/alertLifecycle.service';
import { RuleEngineExecutionService } from '../services/ruleEngineExecution.service';
import { AlertRuleService } from '../services/alertRule.service';
import { AlertRuleModel } from '../models/alertRule.model';
import {
  ListAlertEventsQuerySchema,
  AcknowledgeAlertEventSchema,
  ResolveAlertEventSchema,
  AlertSummaryQuerySchema,
} from '../schemas/alertEvent.schema';
import { ApiResponse } from '../utils/apiResponse';
import { ApiError } from '../utils/apiError';

export class AlertEventController {
  /**
   * GET /api/v1/alerts/summary or GET /api/v1/alert-events/summary
   * Aggregated metrics for dashboard
   */
  public static async getSummary(req: Request, res: Response, next: NextFunction) {
    try {
      const parseResult = AlertSummaryQuerySchema.safeParse(req.query);
      if (!parseResult.success) {
        return next(
          new ApiError(
            400,
            parseResult.error.issues[0]?.message || 'Tham số truy vấn tổng hợp cảnh báo không hợp lệ',
            parseResult.error.format()
          )
        );
      }

      const user = (req as any).user;
      const targetOrgId = await AlertRuleService.enforceOrgAccess(
        user,
        (req.query.organization_id as string) || undefined
      );

      // Verify cluster ownership if cluster_id provided
      if (parseResult.data.cluster_id) {
        const belongs = await AlertRuleModel.verifyClusterOwnership(parseResult.data.cluster_id, targetOrgId);
        if (!belongs) {
          throw ApiError.forbidden('Cụm máy chủ không thuộc phạm vi tổ chức của bạn');
        }
      }

      const summary = await AlertLifecycleService.getSummary(targetOrgId, {
        clusterId: parseResult.data.cluster_id,
        from: parseResult.data.from,
        to: parseResult.data.to,
      });

      return ApiResponse.success(res, 'Lấy tổng hợp cảnh báo thành công', summary, 200);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * GET /api/v1/alert-events
   * List alert events with pagination and filters
   */
  public static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const parseResult = ListAlertEventsQuerySchema.safeParse(req.query);
      if (!parseResult.success) {
        return next(
          new ApiError(
            400,
            parseResult.error.issues[0]?.message || 'Tham số truy vấn sự kiện cảnh báo không hợp lệ',
            parseResult.error.format()
          )
        );
      }

      const user = (req as any).user;
      const targetOrgId = await AlertRuleService.enforceOrgAccess(
        user,
        (req.query.organization_id as string) || undefined
      );

      const result = await AlertLifecycleService.getAlertEvents(targetOrgId, parseResult.data as any);

      return ApiResponse.success(res, 'Lấy danh sách sự kiện cảnh báo thành công', result, 200);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * GET /api/v1/alert-events/:id
   * Get alert event details by ID
   */
  public static async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      if (!id) {
        return next(ApiError.badRequest('Thiếu ID sự kiện cảnh báo'));
      }

      const user = (req as any).user;
      const targetOrgId = await AlertRuleService.enforceOrgAccess(user);
      const event = await AlertLifecycleService.getAlertEventById(id, targetOrgId);

      return ApiResponse.success(res, 'Lấy chi tiết sự kiện cảnh báo thành công', event, 200);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * PATCH /api/v1/alert-events/:id/acknowledge
   * Acknowledge an active alert event
   */
  public static async acknowledge(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      if (!id) {
        return next(ApiError.badRequest('Thiếu ID sự kiện cảnh báo'));
      }

      const parseResult = AcknowledgeAlertEventSchema.safeParse(req.body);
      if (!parseResult.success) {
        return next(
          new ApiError(
            400,
            parseResult.error.issues[0]?.message || 'Dữ liệu xác nhận không hợp lệ',
            parseResult.error.format()
          )
        );
      }

      const user = (req as any).user;
      const targetOrgId = await AlertRuleService.enforceOrgAccess(user);
      const updated = await AlertLifecycleService.acknowledgeAlert(
        id,
        targetOrgId,
        user.id || user.userId,
        parseResult.data.note
      );

      return ApiResponse.success(res, 'Xác nhận sự kiện cảnh báo thành công', updated, 200);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * PATCH /api/v1/alert-events/:id/resolve
   * Manually resolve an alert event
   */
  public static async resolve(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      if (!id) {
        return next(ApiError.badRequest('Thiếu ID sự kiện cảnh báo'));
      }

      const parseResult = ResolveAlertEventSchema.safeParse(req.body);
      if (!parseResult.success) {
        return next(
          new ApiError(
            400,
            parseResult.error.issues[0]?.message || 'Dữ liệu giải quyết không hợp lệ',
            parseResult.error.format()
          )
        );
      }

      const user = (req as any).user;
      const targetOrgId = await AlertRuleService.enforceOrgAccess(user);
      const updated = await AlertLifecycleService.resolveAlertManually(
        id,
        targetOrgId,
        user.id || user.userId,
        parseResult.data.resolution_note
      );

      return ApiResponse.success(res, 'Giải quyết sự kiện cảnh báo thành công', updated, 200);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * POST /api/v1/alert-events/evaluate or POST /api/v1/alert-rules/evaluate
   * Trigger an evaluation run
   */
  public static async triggerEvaluation(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const targetOrgId = await AlertRuleService.enforceOrgAccess(
        user,
        req.body?.organization_id || undefined
      );

      const result = await RuleEngineExecutionService.runEvaluationCycle({
        organizationId: targetOrgId,
        clusterId: req.body?.cluster_id || undefined,
      });

      return ApiResponse.success(res, 'Chu kỳ đánh giá Rule Engine hoàn tất', result, 200);
    } catch (error) {
      return next(error);
    }
  }
}
