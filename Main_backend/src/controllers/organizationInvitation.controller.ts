import { Request, Response, NextFunction } from 'express';
import { OrganizationInvitationService } from '../services/organizationInvitation.service';
import { ApiResponse } from '../utils/apiResponse';
import { AuditService } from '../services/audit.service';

export class OrganizationInvitationController {
  /**
   * [POST] /api/v1/organizations/:id/invitations
   * Tạo lời mời thành viên mới vào tổ chức
   */
  public static async createInvitation(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const orgId = req.params.id;
      const result = await OrganizationInvitationService.createInvitation(
        orgId,
        user.id,
        user.roles || [],
        req.body
      );
      AuditService.recordFromRequest(req, {
        organization_id: orgId,
        action: 'MEMBER_INVITED',
        status: 'SUCCESS',
        target_type: 'INVITATION',
        target_id: result.invitation?.id,
        description: `Mời thành viên ${result.invitation?.email || req.body?.email} vào tổ chức với vai trò ${result.invitation?.role?.code || req.body?.role_code}`,
        metadata: { email: result.invitation?.email || req.body?.email, role_code: result.invitation?.role?.code || req.body?.role_code },
      }).catch(() => {});
      return ApiResponse.success(res, 'Gửi lời mời tham gia tổ chức thành công', result, 201);
    } catch (error) {
      next(error);
    }
  }

  /**
   * [GET] /api/v1/organizations/:id/invitations
   * Liệt kê danh sách lời mời của một tổ chức (Dành cho Quản trị viên/Owner)
   */
  public static async listInvitations(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const orgId = req.params.id;
      const result = await OrganizationInvitationService.getOrganizationInvitations(
        orgId,
        user.id,
        user.roles || [],
        req.query
      );
      return ApiResponse.success(res, 'Lấy danh sách lời mời thành công', result, 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * [POST] /api/v1/organizations/invitations/accept
   * Xác nhận chấp nhận lời mời tham gia tổ chức bằng Token bí mật
   */
  public static async acceptInvitationByToken(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const { token } = req.body;
      const result = await OrganizationInvitationService.acceptInvitationByToken(token, user.id);
      AuditService.recordFromRequest(req, {
        organization_id: result.organization_id,
        action: 'MEMBER_JOINED',
        status: 'SUCCESS',
        user_id: user.id,
        description: 'Chấp nhận lời mời và gia nhập tổ chức thành công',
        metadata: { organization_id: result.organization_id, role_code: result.role_code },
      }).catch(() => {});
      return ApiResponse.success(res, result.message, result, 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * [DELETE] /api/v1/organizations/:id/invitations/:invitationId
   * Thu hồi lời mời tham gia tổ chức
   */
  public static async revokeInvitation(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const orgId = req.params.id;
      const invitationId = req.params.invitationId;
      const result = await OrganizationInvitationService.revokeInvitation(
        orgId,
        invitationId,
        user.id,
        user.roles || []
      );
      AuditService.recordFromRequest(req, {
        organization_id: orgId,
        action: 'INVITATION_REVOKED',
        status: 'SUCCESS',
        target_type: 'INVITATION',
        target_id: invitationId,
        description: 'Thu hồi lời mời tham gia tổ chức thành công',
      }).catch(() => {});
      return ApiResponse.success(res, result.message, null, 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * [POST] /api/v1/organizations/:id/invitations/:invitationId/resend
   * Gửi lại lời mời tham gia tổ chức
   */
  public static async resendInvitation(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const orgId = req.params.id;
      const invitationId = req.params.invitationId;
      const result = await OrganizationInvitationService.resendInvitation(
        orgId,
        invitationId,
        user.id,
        user.roles || []
      );
      return ApiResponse.success(res, result.message, result, 200);
    } catch (error) {
      next(error);
    }
  }
}
