import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/apiError';
import { pool } from '../config/database';

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

      // System-level administrators can manage across all tenants
      const userRoles: string[] = Array.isArray(user.roles)
        ? user.roles.map((r: string) => r.trim().toUpperCase())
        : [];

      if (userRoles.includes('SUPER_ADMIN') || userRoles.includes('SYSTEM_ADMIN')) {
        return next();
      }

      // Check if user has explicit tenant claim in token
      const userOrg = (user as any).company_id || (user as any).organization_id;
      if (userOrg) {
        if (userOrg !== orgId) {
          return next(
            new ApiError(403, 'Từ chối truy cập: Bạn không thuộc tổ chức này')
          );
        }
        return next();
      }

      // Query database to ensure user belongs to this company / organization
      try {
        const memberRes = await pool.query(
          `SELECT role, status FROM company_members 
           WHERE company_id = $1 AND user_id = $2 AND status = 'ACTIVE' LIMIT 1`,
          [orgId, user.id]
        );

        if (memberRes.rows.length === 0) {
          return next(
            new ApiError(403, 'Từ chối truy cập: Bạn không thuộc tổ chức này hoặc tài khoản chưa kích hoạt trong tổ chức')
          );
        }

        (req as any).orgMember = memberRes.rows[0];
        return next();
      } catch (dbErr) {
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
