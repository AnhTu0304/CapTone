import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/apiError';
import { OrganizationMemberModel } from '../models/organizationMember.model';

/**
 * Middleware ensuring tenant/organization data isolation.
 * Prevents horizontal cross-tenant data leakage by checking organization membership.
 */
export const requireTenantAccess = (getOrgId: (req: Request) => string | undefined) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      if (!user || !user.id) {
        return next(new ApiError(401, 'Yêu cầu đăng nhập trước khi truy cập tài nguyên tổ chức'));
      }

      const orgId = getOrgId(req);
      if (!orgId) {
        return next(new ApiError(400, 'Thiếu thông tin định danh tổ chức (organization_id)'));
      }

      // Check if user has explicit tenant claim in token
      const userOrg = (user as any).organization_id || (user as any).company_id;
      if (userOrg) {
        if (userOrg !== orgId) {
          return next(
            new ApiError(403, 'Từ chối truy cập: Bạn không thuộc tổ chức này')
          );
        }
        return next();
      }

      // Query database via OrganizationMemberModel to ensure user belongs to this organization
      try {
        const member = await OrganizationMemberModel.findByOrgAndUser(orgId, user.id);

        if (!member || member.status !== 'ACTIVE') {
          return next(
            new ApiError(403, 'Từ chối truy cập: Bạn không thuộc tổ chức này hoặc tài khoản chưa kích hoạt trong tổ chức')
          );
        }

        (req as any).orgMember = member;
        return next();
      } catch {
        // Fail securely if DB membership cannot be confirmed for non-admin
        return next(
          new ApiError(403, 'Từ chối truy cập: Bạn không có quyền truy cập vào dữ liệu của tổ chức này')
        );
      }
    } catch (error) {
      return next(error);
    }
  };
};
