import { Request, Response, NextFunction } from 'express';
import { OrganizationService } from '../services/organization.service';
import { OrganizationRoleService } from '../services/organizationRole.service';
import { ApiResponse } from '../utils/apiResponse';
import { AuditService } from '../services/audit.service';

export class OrganizationController {
  /**
   * [POST] /api/v1/organizations
   * Tạo tổ chức mới kèm hồ sơ mở rộng (Profile) và gán người tạo làm SME_OWNER
   */
  public static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id;
      const result = await OrganizationService.create(userId, req.body);
      AuditService.recordFromRequest(req, {
        organization_id: result.id,
        action: 'ORG_CREATED',
        status: 'SUCCESS',
        target_type: 'ORGANIZATION',
        target_id: result.id,
        description: `Tạo tổ chức mới: ${result.name}`,
      }).catch(() => {});
      return ApiResponse.success(res, 'Tạo tổ chức thành công', result, 201);
    } catch (error) {
      next(error);
    }
  }

  /**
   * [GET] /api/v1/organizations
   * Lấy danh sách tổ chức (hỗ trợ phân trang, tìm kiếm, lọc theo trạng thái)
   */
  public static async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const result = await OrganizationService.getAll(user.id, user.roles || [], req.query);
      return ApiResponse.success(res, 'Lấy danh sách tổ chức thành công', result, 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * [GET] /api/v1/organizations/:id
   * Xem chi tiết thông tin và hồ sơ của một tổ chức
   */
  public static async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const orgId = req.params.id;
      const result = await OrganizationService.getById(orgId, user.id, user.roles || []);
      return ApiResponse.success(res, 'Lấy chi tiết tổ chức thành công', result, 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * [PUT] /api/v1/organizations/:id
   * Cập nhật thông tin tổ chức và hồ sơ
   */
  public static async update(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const orgId = req.params.id;
      const result = await OrganizationService.update(orgId, user.id, user.roles || [], req.body);
      return ApiResponse.success(res, 'Cập nhật thông tin tổ chức thành công', result, 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * [PATCH] /api/v1/organizations/:id/status
   * Khóa / Mở khóa / Vô hiệu hóa tổ chức ([2.12])
   */
  public static async updateStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const orgId = req.params.id;
      const { status, reason } = req.body;
      const result = await OrganizationService.updateStatus(
        orgId,
        user.id,
        user.roles || [],
        status,
        reason
      );
      AuditService.recordFromRequest(req, {
        organization_id: orgId,
        action: 'ORG_STATUS_CHANGED',
        status: 'SUCCESS',
        target_type: 'ORGANIZATION',
        target_id: orgId,
        description: `Cập nhật trạng thái tổ chức thành '${status}'`,
        metadata: { status, reason },
      }).catch(() => {});

      return ApiResponse.success(
        res,
        `Cập nhật trạng thái tổ chức thành '${status}' thành công`,
        result,
        200
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * [DELETE] /api/v1/organizations/:id
   * Xóa tổ chức (Soft delete)
   */
  public static async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const orgId = req.params.id;
      const result = await OrganizationService.delete(orgId, user.id, user.roles || []);
      AuditService.recordFromRequest(req, {
        organization_id: orgId,
        action: 'ORG_DELETED',
        status: 'SUCCESS',
        target_type: 'ORGANIZATION',
        target_id: orgId,
        description: 'Xóa tổ chức (Soft delete)',
      }).catch(() => {});
      return ApiResponse.success(res, 'Xóa tổ chức thành công', result, 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * [GET] /api/v1/organizations/roles
   * Lấy danh mục các vai trò tổ chức khả dụng (SME_OWNER, DEVOPS, VIEWER)
   */
  public static async getRoles(req: Request, res: Response, next: NextFunction) {
    try {
      const roles = await OrganizationRoleService.getAllRoles();
      return ApiResponse.success(res, 'Lấy danh mục vai trò tổ chức thành công', roles, 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * [GET] /api/v1/organizations/me/list hoặc /api/v1/users/me/organizations
   * Lấy danh sách tất cả các tổ chức mà người dùng hiện tại đang tham gia (Workspace Context)
   */
  public static async getMyOrganizations(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const result = await OrganizationService.getUserOrganizations(user.id);
      return ApiResponse.success(res, 'Lấy danh sách tổ chức của bạn thành công', result, 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * [GET] /api/v1/organizations/me/invitations hoặc /api/v1/users/me/invitations
   * Lấy danh sách các lời mời tham gia tổ chức đang chờ chấp nhận của tài khoản hiện tại
   */
  public static async getMyInvitations(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const result = await OrganizationService.getUserPendingInvitations(user.id);
      return ApiResponse.success(res, 'Lấy danh sách lời mời đang chờ thành công', result, 200);
    } catch (error) {
      next(error);
    }
  }
}

