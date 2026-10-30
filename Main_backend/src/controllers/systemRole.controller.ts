import { Request, Response, NextFunction } from 'express';
import { SystemRoleService } from '../services/systemRole.service';
import { ApiResponse } from '../utils/apiResponse';
import { ApiError } from '../utils/apiError';
import { AuditService } from '../services/audit.service';

export class SystemRoleController {
  /**
   * [GET] /api/v1/roles
   * Lấy danh sách tất cả các vai trò quản trị hệ thống
   */
  public static async getAllRoles(req: Request, res: Response, next: NextFunction) {
    try {
      const roles = await SystemRoleService.getAllRoles();
      return ApiResponse.success(res, 'Lấy danh sách vai trò hệ thống thành công', roles, 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * [GET] /api/v1/roles/users/:userId (hoặc /api/v1/users/:id/roles)
   * Lấy danh sách vai trò hệ thống của một người dùng
   */
  public static async getUserRoles(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.params.userId || req.params.id;
      if (!userId) {
        throw new ApiError(400, 'Vui lòng cung cấp ID người dùng');
      }

      const roles = await SystemRoleService.getUserRoles(userId);
      return ApiResponse.success(res, 'Lấy danh sách vai trò của người dùng thành công', roles, 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * [POST] /api/v1/roles/assign (hoặc /api/v1/users/:id/roles)
   * Gán vai trò hệ thống hoặc tổ chức cho người dùng
   * Body: { userId, role, reason } hoặc params :id và body { role, reason }
   */
  public static async assignRole(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.body.userId || req.params.id;
      const role = req.body.role || req.body.roleName || req.body.roleId;
      const reason = req.body.reason || 'Cập nhật vai trò qua Admin Dashboard';
      const assignedBy = (req as any).user?.id;

      if (!userId) {
        throw new ApiError(400, 'Thiếu thông tin ID người dùng (userId)');
      }
      if (!role) {
        throw new ApiError(400, 'Thiếu thông tin vai trò cần cấp (role: SUPER_ADMIN, ADMIN, SME_OWNER, DEVOPS, VIEWER)');
      }

      const beforeRoles = await SystemRoleService.getUserRoles(userId).catch(() => []);
      const beforeRoleNames = beforeRoles.map((r) => r.role_name);

      await SystemRoleService.assignRole(userId, role, assignedBy);

      await AuditService.recordFromRequest(req, {
        action: 'SYSTEM_ROLE_ASSIGNED',
        status: 'SUCCESS',
        target_type: 'USER',
        target_id: userId,
        description: `Cấp vai trò [${role}] cho người dùng`,
        before_data: { roles: beforeRoleNames },
        after_data: { role },
        metadata: { role, assigned_by: assignedBy, reason },
      }).catch((auditErr) => {
        console.warn('[SystemRoleController] Ghi audit log thất bại:', auditErr?.message);
      });

      return ApiResponse.success(res, `Cấp vai trò [${role}] cho người dùng thành công`, { userId, role }, 201);
    } catch (error) {
      next(error);
    }
  }

  /**
   * [POST] /api/v1/roles/revoke hoặc [DELETE] /api/v1/roles/revoke hoặc [DELETE] /api/v1/users/:id/roles/:role
   * Thu hồi vai trò hệ thống của người dùng
   */
  public static async revokeRole(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.body.userId || req.params.id;
      const role = req.body.role || req.params.role;
      const revokedBy = (req as any).user?.id;

      if (!userId) {
        throw new ApiError(400, 'Thiếu thông tin ID người dùng (userId)');
      }
      if (!role) {
        throw new ApiError(400, 'Thiếu thông tin vai trò cần thu hồi (role)');
      }

      await SystemRoleService.revokeRole(userId, role);

      await AuditService.recordFromRequest(req, {
        action: 'SYSTEM_ROLE_REVOKED',
        status: 'SUCCESS',
        target_type: 'USER',
        target_id: userId,
        description: `Thu hồi vai trò [${role}] của người dùng`,
        before_data: { role },
        after_data: { roles: [] },
        metadata: { role, revoked_by: revokedBy },
      }).catch((auditErr) => {
        console.warn('[SystemRoleController] Ghi audit log thu hồi thất bại:', auditErr?.message);
      });

      return ApiResponse.success(res, `Thu hồi vai trò [${role}] của người dùng thành công`, { userId, role }, 200);
    } catch (error) {
      next(error);
    }
  }
}
