import { Request, Response, NextFunction } from 'express';
import { AuditService } from '../services/audit.service';
import { ApiResponse } from '../utils/apiResponse';
import { ApiError } from '../utils/apiError';

export class AuditController {
  /**
   * [GET] /api/v1/audit-logs
   * Dành cho Platform Admin (SUPER_ADMIN, ADMIN) tra cứu audit log toàn hệ thống
   */
  public static async getPlatformAuditLogs(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      if (!user) {
        throw new ApiError(401, 'Yêu cầu đăng nhập trước khi truy cập');
      }

      const filter = {
        organization_id: req.query.organization_id as string,
        user_id: req.query.user_id as string,
        action: req.query.action as string,
        status: req.query.status as string,
        resource_type: req.query.resource_type as string,
        resource_id: req.query.resource_id as string,
        request_id: req.query.request_id as string,
        reason_code: req.query.reason_code as string,
        start_date: req.query.start_date as string,
        end_date: req.query.end_date as string,
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 20,
      };

      const result = await AuditService.query(filter, { user });
      return ApiResponse.success(res, 'Lấy danh sách nhật ký kiểm toán hệ thống thành công', result, 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * [GET] /api/v1/organizations/:id/audit-logs (hoặc :orgId)
   * Dành cho Quản trị viên tổ chức (SME_OWNER, DEVOPS) tra cứu audit log của chính tổ chức mình
   */
  public static async getOrganizationAuditLogs(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const orgMember = (req as any).orgMember;

      if (!user) {
        throw new ApiError(401, 'Yêu cầu đăng nhập trước khi truy cập');
      }

      const orgId = orgMember?.organizationId || req.params.orgId || req.params.id;
      if (!orgId) {
        throw new ApiError(400, 'Không tìm thấy định danh tổ chức');
      }

      const filter = {
        organization_id: (req.query.organization_id as string) || orgId,
        user_id: req.query.user_id as string,
        action: req.query.action as string,
        status: req.query.status as string,
        resource_type: req.query.resource_type as string,
        resource_id: req.query.resource_id as string,
        request_id: req.query.request_id as string,
        reason_code: req.query.reason_code as string,
        start_date: req.query.start_date as string,
        end_date: req.query.end_date as string,
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 20,
      };

      const result = await AuditService.query(filter, { user, orgMember });
      return ApiResponse.success(res, 'Lấy danh sách nhật ký kiểm toán tổ chức thành công', result, 200);
    } catch (error) {
      next(error);
    }
  }
}
