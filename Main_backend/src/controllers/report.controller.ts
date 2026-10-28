import { Request, Response, NextFunction } from 'express';
import { ReportModel } from '../models/report.model';
import { ApiResponse } from '../utils/apiResponse';
import { ApiError } from '../utils/apiError';
import { OrganizationMemberModel } from '../models/organizationMember.model';

export class ReportController {
  /**
   * [GET] /api/v1/reports/organization-sla
   * Lấy báo cáo cam kết SLA, phân tích sự cố và lịch sử thay đổi của tổ chức có kiểm tra RBAC
   */
  public static async getOrganizationSLAReport(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const organizationId =
        (req.query.organizationId as string) ||
        (req.headers['x-organization-id'] as string) ||
        user?.organizationId ||
        null;
      const environmentId = (req.query.environmentId as string) || null;
      const timeRange = (req.query.timeRange as string) || '6M';

      if (!organizationId) {
        return ApiResponse.error(res, 'Yêu cầu định danh tổ chức (organizationId)', 400);
      }

      // RBAC Validation: Nếu không phải Admin hệ thống, bắt buộc phải là thành viên ACTIVE của tổ chức này
      const userRoles: string[] = Array.isArray(user?.roles)
        ? user.roles.map((r: string) => r.trim().toUpperCase())
        : [String(user?.role || '').trim().toUpperCase()];

      const isSystemAdmin = userRoles.includes('SUPER_ADMIN') || userRoles.includes('ADMIN') || userRoles.includes('SYSTEM_ADMIN');

      if (!isSystemAdmin) {
        if (!user?.id) {
          return next(new ApiError(401, 'Yêu cầu đăng nhập trước khi xem báo cáo tổ chức'));
        }

        const member = await OrganizationMemberModel.findByOrgAndUser(organizationId, user.id);
        if (!member || member.status !== 'ACTIVE') {
          return ApiResponse.error(
            res,
            'Từ chối truy cập: Bạn không thuộc tổ chức này hoặc chưa được kích hoạt quyền thành viên theo chính sách RBAC',
            403
          );
        }
      }

      const reportData = await ReportModel.getOrganizationSLAReport(
        organizationId,
        environmentId,
        timeRange
      );

      return ApiResponse.success(res, 'Lấy báo cáo SLA và vận hành tổ chức thành công', reportData, 200);
    } catch (error) {
      next(error);
    }
  }
}
