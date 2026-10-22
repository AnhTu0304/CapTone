import { Request, Response, NextFunction } from 'express';
import { OrganizationInvitationService } from '../services/organizationInvitation.service';
import { ApiResponse } from '../utils/apiResponse';

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
