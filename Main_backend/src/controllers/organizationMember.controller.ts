import { Request, Response, NextFunction } from 'express';
import { OrganizationMemberService } from '../services/organizationMember.service';
import { ApiResponse } from '../utils/apiResponse';

export class OrganizationMemberController {
  /**
   * [GET] /api/v1/organizations/:id/members
   * Lấy danh sách thành viên trong tổ chức
   */
  public static async getMembers(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const orgId = req.params.id;
      const result = await OrganizationMemberService.getMembers(
        orgId,
        user.id,
        user.roles || [],
        req.query
      );
      return ApiResponse.success(res, 'Lấy danh sách thành viên thành công', result, 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * [POST] /api/v1/organizations/:id/members/invite
   * Mời thành viên mới vào tổ chức qua email
   */
  public static async inviteMember(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const orgId = req.params.id;
      const result = await OrganizationMemberService.inviteMember(
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
   * [POST] /api/v1/organizations/:id/members/accept
   * Chấp nhận lời mời tham gia tổ chức
   */
  public static async acceptInvitation(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const orgId = req.params.id;
      const result = await OrganizationMemberService.acceptInvitation(orgId, user.id);
      return ApiResponse.success(res, result.message, result, 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * [PUT] /api/v1/organizations/:id/members/:userId
   * Cập nhật vai trò hoặc trạng thái thành viên
   */
  public static async updateMember(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const orgId = req.params.id;
      const targetUserId = req.params.userId;
      const result = await OrganizationMemberService.updateMember(
        orgId,
        targetUserId,
        user.id,
        user.roles || [],
        req.body
      );
      return ApiResponse.success(res, 'Cập nhật thành viên thành công', result, 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * [DELETE] /api/v1/organizations/:id/members/:userId
   * Xóa hoặc loại bỏ thành viên khỏi tổ chức
   */
  public static async removeMember(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const orgId = req.params.id;
      const targetUserId = req.params.userId;
      const result = await OrganizationMemberService.removeMember(
        orgId,
        targetUserId,
        user.id,
        user.roles || []
      );
      return ApiResponse.success(res, result.message, null, 200);
    } catch (error) {
      next(error);
    }
  }
}
