import { Request, Response, NextFunction } from 'express';
import { ReportModel } from '../models/report.model';
import { ApiResponse } from '../utils/apiResponse';
import { ApiError } from '../utils/apiError';
import { OrganizationMemberModel } from '../models/organizationMember.model';

export class ReportController {
  /**
   * [GET] /api/v1/reports/organization-sla
   * Lấy báo cáo cam kết SLA, phân tích sự cố, lịch sử thay đổi và tổng hợp Action của tổ chức có kiểm tra RBAC
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
      const clusterId = (req.query.clusterId as string) || null;
      const rawServiceName =
        (req.query.serviceName as string) || (req.query.service_name as string) || '';
      const trimmedServiceName = rawServiceName.trim();
      const serviceName =
        trimmedServiceName && trimmedServiceName.toUpperCase() !== 'ALL'
          ? trimmedServiceName
          : null;
      const timeRange = (req.query.timeRange as string) || '6M';

      if (!organizationId) {
        return ApiResponse.error(res, 'Yêu cầu định danh tổ chức (organizationId)', 400);
      }

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

      const reportData = await ReportModel.getOrganizationSLAReport(
        organizationId,
        environmentId,
        clusterId,
        timeRange,
        serviceName
      );

      return ApiResponse.success(res, 'Lấy báo cáo SLA và vận hành tổ chức thành công', reportData, 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * [GET] /api/v1/reports/action-analytics
   * Lấy báo cáo truy vết Sự cố -> AI/Người Action -> Thời gian -> Kết quả & Nguyên nhân lỗi (có lọc & phân trang)
   */
  public static async getActionAnalyticsReport(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const organizationId =
        (req.query.organizationId as string) ||
        (req.headers['x-organization-id'] as string) ||
        user?.organizationId ||
        null;

      if (!organizationId) {
        return ApiResponse.error(res, 'Yêu cầu định danh tổ chức (organizationId)', 400);
      }

      if (!user?.id) {
        return next(new ApiError(401, 'Yêu cầu đăng nhập trước khi xem báo cáo hành động tự phục hồi'));
      }

      const member = await OrganizationMemberModel.findByOrgAndUser(organizationId, user.id);
      if (!member || member.status !== 'ACTIVE') {
        return ApiResponse.error(
          res,
          'Từ chối truy cập: Bạn không thuộc tổ chức này hoặc chưa được kích hoạt quyền thành viên theo chính sách RBAC',
          403
        );
      }

      const environmentId = (req.query.environmentId as string) || null;
      const clusterId = (req.query.clusterId as string) || null;
      const rawServiceName =
        (req.query.serviceName as string) || (req.query.service_name as string) || '';
      const trimmedServiceName = rawServiceName.trim();
      const serviceName =
        trimmedServiceName && trimmedServiceName.toUpperCase() !== 'ALL'
          ? trimmedServiceName
          : null;
      const timeRange = (req.query.timeRange as string) || '1M';
      const actor = (req.query.actor as string) || null;
      const status = (req.query.status as string) || null;
      const incidentType = (req.query.incidentType as string) || null;
      const actionCode = (req.query.actionCode as string) || null;
      const search = (req.query.search as string) || null;
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 25;

      const analyticsData = await ReportModel.getActionAnalyticsReport({
        organizationId,
        environmentId,
        clusterId,
        serviceName,
        timeRange,
        actor,
        status,
        incidentType,
        actionCode,
        search,
        page,
        limit,
      });

      return ApiResponse.success(res, 'Lấy báo cáo phân tích và truy vết Action thành công', analyticsData, 200);
    } catch (error) {
      next(error);
    }
  }
}
