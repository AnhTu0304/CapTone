import { Request, Response, NextFunction } from 'express';
import { AdminBroadcastService } from '../services/adminBroadcast.service';
import { AuditService } from '../services/audit.service';
import { createBroadcastSchema } from '../validations/adminBroadcast.validation';
import { ApiResponse } from '../utils/apiResponse';

export class AdminBroadcastController {
  /**
   * [GET] /api/v1/admin/broadcasts
   * Lấy danh sách các thông báo toàn mạng và các cảnh báo hệ thống
   */
  public static async getBroadcasts(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await AdminBroadcastService.getBroadcastsOverview();
      return ApiResponse.success(res, 'Lấy danh sách thông báo toàn mạng thành công', result, 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * [POST] /api/v1/admin/broadcasts
   * Phát thông báo mới cho toàn hệ thống
   */
  public static async createBroadcast(req: Request, res: Response, next: NextFunction) {
    try {
      const validation = createBroadcastSchema.safeParse(req.body);
      if (!validation.success) {
        const firstIssue = validation.error.issues[0];
        const msg = firstIssue?.message || 'Dữ liệu thông báo không hợp lệ';
        return ApiResponse.error(res, msg, 400, { details: validation.error.issues });
      }
      const parsed = validation.data;
      const userId = (req as any).user?.id || 'admin';
      const reqContext = AuditService.extractRequestContext(req);

      const result = await AdminBroadcastService.createBroadcast(parsed, userId, reqContext);
      return ApiResponse.success(res, 'Phát sóng thông báo toàn mạng thành công', result, 201);
    } catch (error) {
      next(error);
    }
  }

  /**
   * [DELETE] /api/v1/admin/broadcasts/:id
   * Gỡ bỏ một thông báo toàn mạng
   */
  public static async deleteBroadcast(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.id || 'admin';
      const reqContext = AuditService.extractRequestContext(req);

      await AdminBroadcastService.deleteBroadcast(id, userId, reqContext);
      return ApiResponse.success(res, 'Gỡ bỏ thông báo toàn mạng thành công', null, 200);
    } catch (error) {
      next(error);
    }
  }
}
