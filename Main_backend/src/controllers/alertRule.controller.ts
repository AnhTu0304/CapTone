import { Request, Response, NextFunction } from 'express';
import { AlertRuleService } from '../services/alertRule.service';
import {
  CreateAlertRuleSchema,
  UpdateAlertRuleSchema,
  ToggleAlertRuleStatusSchema,
  ListAlertRulesQuerySchema,
} from '../schemas/alertRule.schema';
import { ApiResponse } from '../utils/apiResponse';
import { ApiError } from '../utils/apiError';

export class AlertRuleController {
  /**
   * POST /api/v1/alert-rules
   * Tạo mới cấu hình cảnh báo
   */
  public static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const parseResult = CreateAlertRuleSchema.safeParse(req.body);
      if (!parseResult.success) {
        return next(
          new ApiError(
            400,
            parseResult.error.issues[0]?.message || 'Dữ liệu cấu hình cảnh báo không hợp lệ',
            parseResult.error.format()
          )
        );
      }

      const user = (req as any).user;
      const rule = await AlertRuleService.createRule(user, parseResult.data);

      return ApiResponse.success(res, 'Tạo cấu hình cảnh báo thành công', rule, 201);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * GET /api/v1/alert-rules
   * Lấy danh sách cấu hình cảnh báo có phân trang & lọc
   */
  public static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const parseResult = ListAlertRulesQuerySchema.safeParse(req.query);
      if (!parseResult.success) {
        return next(
          new ApiError(
            400,
            parseResult.error.issues[0]?.message || 'Tham số truy vấn không hợp lệ',
            parseResult.error.format()
          )
        );
      }

      const user = (req as any).user;
      const result = await AlertRuleService.listRules(user, parseResult.data as any);

      return ApiResponse.success(res, 'Lấy danh sách cấu hình cảnh báo thành công', result, 200);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * GET /api/v1/alert-rules/:id
   * Xem chi tiết một cấu hình cảnh báo
   */
  public static async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      if (!id) {
        return next(ApiError.badRequest('Thiếu ID cấu hình cảnh báo'));
      }

      const user = (req as any).user;
      const rule = await AlertRuleService.getRuleById(user, id);

      return ApiResponse.success(res, 'Lấy chi tiết cấu hình cảnh báo thành công', rule, 200);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * PUT /api/v1/alert-rules/:id (hoặc PATCH /api/v1/alert-rules/:id)
   * Cập nhật thông tin cấu hình cảnh báo
   */
  public static async update(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      if (!id) {
        return next(ApiError.badRequest('Thiếu ID cấu hình cảnh báo'));
      }

      const parseResult = UpdateAlertRuleSchema.safeParse(req.body);
      if (!parseResult.success) {
        return next(
          new ApiError(
            400,
            parseResult.error.issues[0]?.message || 'Dữ liệu cập nhật không hợp lệ',
            parseResult.error.format()
          )
        );
      }

      const user = (req as any).user;
      const updated = await AlertRuleService.updateRule(user, id, parseResult.data as any);

      return ApiResponse.success(res, 'Cập nhật cấu hình cảnh báo thành công', updated, 200);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * PATCH /api/v1/alert-rules/:id/status
   * Bật/tắt trạng thái hoạt động của cấu hình cảnh báo
   */
  public static async toggleStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      if (!id) {
        return next(ApiError.badRequest('Thiếu ID cấu hình cảnh báo'));
      }

      const parseResult = ToggleAlertRuleStatusSchema.safeParse(req.body);
      if (!parseResult.success) {
        return next(
          new ApiError(
            400,
            parseResult.error.issues[0]?.message || 'Dữ liệu trạng thái không hợp lệ',
            parseResult.error.format()
          )
        );
      }

      const user = (req as any).user;
      const updated = await AlertRuleService.toggleRuleStatus(user, id, parseResult.data.enabled);

      return ApiResponse.success(res, 'Cập nhật trạng thái cấu hình cảnh báo thành công', updated, 200);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * DELETE /api/v1/alert-rules/:id
   * Xóa cấu hình cảnh báo
   */
  public static async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      if (!id) {
        return next(ApiError.badRequest('Thiếu ID cấu hình cảnh báo'));
      }

      const user = (req as any).user;
      const result = await AlertRuleService.deleteRule(user, id);

      return ApiResponse.success(res, 'Xóa cấu hình cảnh báo thành công', result, 200);
    } catch (error) {
      return next(error);
    }
  }
}
