import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/apiError';
import { SystemRoleService } from '../services/systemRole.service';
import { AuditService } from '../services/audit.service';
import { pool } from '../config/database';

/**
 * Mở rộng vai trò kế thừa (Role inheritance / expansion)
 * - SUPER_ADMIN: toàn quyền truy cập toàn hệ thống
 * - ADMIN: quản trị viên hệ thống (Admin + DevOps + Viewer + User)
 * - SYSTEM_ADMIN: quản trị viên kỹ thuật hạ tầng (DevOps + Viewer + User)
 * - DEVOPS: vận hành hạ tầng (DevOps + Viewer + User), không có quyền quản trị User
 * - SME_OWNER: chủ sở hữu tổ chức (SME_OWNER + Viewer + User), KHÔNG có quyền Admin hệ thống
 * - VIEWER / USER: người dùng chỉ xem (Viewer + User), không có quyền can thiệp hay xem chi tiết
 */
export const expandRoles = (roles: string[]): string[] => {
  const expanded = new Set<string>();
  for (const r of roles) {
    if (!r) continue;
    const role = r.trim().toUpperCase();
    expanded.add(role);
    if (role === 'SUPER_ADMIN') {
      expanded.add('ADMIN');
      expanded.add('SYSTEM_ADMIN');
      expanded.add('DEVOPS');
      expanded.add('VIEWER');
      expanded.add('USER');
    } else if (role === 'ADMIN') {
      expanded.add('ADMIN');
      expanded.add('DEVOPS');
      expanded.add('VIEWER');
      expanded.add('USER');
    } else if (role === 'SYSTEM_ADMIN') {
      expanded.add('DEVOPS');
      expanded.add('VIEWER');
      expanded.add('USER');
    } else if (role === 'DEVOPS') {
      expanded.add('VIEWER');
      expanded.add('USER');
    } else if (role === 'SME_OWNER') {
      expanded.add('SME_OWNER');
      expanded.add('VIEWER');
      expanded.add('USER');
    } else if (role === 'VIEWER' || role === 'USER') {
      expanded.add('VIEWER');
      expanded.add('USER');
    }
  }
  return Array.from(expanded);
};

/**
 * Middleware phân quyền theo vai trò (Role-Based Access Control - RBAC)
 * Kiểm tra xem người dùng hiện tại có ít nhất một trong các vai trò được phép hay không.
 * Tự động cho phép vai trò 'SUPER_ADMIN' vượt qua mọi hạn chế quyền.
 * 
 * @param allowedRoles Danh sách các vai trò được cấp quyền (VD: 'ADMIN', 'DEVOPS', 'VIEWER')
 */
export const requireRoles = (...allowedRoles: string[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      if (!user || !user.id) {
        return next(new ApiError(401, 'Yêu cầu đăng nhập trước khi truy cập tài nguyên'));
      }

      const normalizedAllowed = allowedRoles.map((r) => r.trim().toUpperCase());

      // 1. Kiểm tra nhanh qua roles đã được đồng bộ từ CSDL mới nhất trong auth.middleware
      const rawTokenRoles: string[] = Array.isArray(user.roles)
        ? user.roles.map((r: string) => String(r).trim().toUpperCase())
        : (user.roles ? [String(user.roles).trim().toUpperCase()] : []);

      // Mặc định nếu không có role nào, coi như USER/VIEWER
      if (rawTokenRoles.length === 0) {
        rawTokenRoles.push('USER', 'VIEWER');
      }

      const effectiveTokenRoles = expandRoles(rawTokenRoles);

      // SUPER_ADMIN luôn có toàn quyền truy cập
      if (effectiveTokenRoles.includes('SUPER_ADMIN')) {
        return next();
      }

      // Kiểm tra xem vai trò hiệu lực có khớp với danh sách cho phép không
      const hasTokenMatch = effectiveTokenRoles.some((r) => normalizedAllowed.includes(r));
      if (hasTokenMatch) {
        return next();
      }

      // 2. Dự phòng: Kiểm tra trực tiếp trong Database
      // 2.1. Kiểm tra vai trò hệ thống toàn cục (System Roles)
      const systemRolesThatSatisfy: string[] = ['SUPER_ADMIN'];
      if (normalizedAllowed.includes('ADMIN')) systemRolesThatSatisfy.push('ADMIN');
      if (normalizedAllowed.includes('DEVOPS')) systemRolesThatSatisfy.push('ADMIN', 'SYSTEM_ADMIN');
      if (normalizedAllowed.includes('VIEWER') || normalizedAllowed.includes('USER')) {
        systemRolesThatSatisfy.push('ADMIN', 'SYSTEM_ADMIN', 'USER');
      }

      const hasSystemDbMatch = await SystemRoleService.hasAnyRole(user.id, systemRolesThatSatisfy);
      if (hasSystemDbMatch) {
        return next();
      }

      // 2.2. Kiểm tra vai trò tổ chức (Organization Roles: DEVOPS, SME_OWNER, VIEWER)
      // Cho phép thành viên tổ chức thực hiện các quyền hạn tương ứng với vai trò trong Tenant
      const orgRolesAllowed = normalizedAllowed.filter((r) => ['DEVOPS', 'SME_OWNER', 'VIEWER', 'ADMIN'].includes(r));
      if (orgRolesAllowed.length > 0) {
        const targetOrgId =
          (req.headers['x-organization-id'] as string) ||
          (req.query.organization_id as string) ||
          req.body?.organization_id ||
          user.organization_id;

        let orgRoleQuery = `
          SELECT r.code, r.name 
          FROM organization_members om 
          JOIN organization_roles r ON om.role_id = r.id 
          WHERE om.user_id = $1 AND om.status = 'ACTIVE'
        `;
        const orgQueryParams: any[] = [user.id];
        if (targetOrgId && targetOrgId !== 'all') {
          orgRoleQuery += ` AND om.organization_id = $2`;
          orgQueryParams.push(targetOrgId);
        }

        const orgMemberRes = await pool.query(orgRoleQuery, orgQueryParams);
        if (orgMemberRes.rows.length > 0) {
          const userOrgRoles = orgMemberRes.rows.flatMap((row: any) => [
            String(row.code || '').trim().toUpperCase(),
            String(row.name || '').trim().toUpperCase().replace(/\s+/g, '_'),
          ]).filter(Boolean);

          const expandedOrgRoles = expandRoles(userOrgRoles);
          const hasOrgMatch = expandedOrgRoles.some((r) => normalizedAllowed.includes(r));
          if (hasOrgMatch) {
            return next();
          }
        }
      }

      // 3. Nếu không có vai trò hợp lệ -> Trả về lỗi 403 Forbidden
      await AuditService.recordFromRequest(req, {
        action: 'ACCESS_DENIED_ROLE',
        status: 'DENIED',
        reason_code: 'ROLE_REQUIRED',
        description: `Từ chối truy cập: Yêu cầu một trong các vai trò [${normalizedAllowed.join(', ')}]`,
        metadata: {
          path: req.originalUrl || req.path,
          method: req.method,
          required_roles: normalizedAllowed,
          current_roles: effectiveTokenRoles,
        },
      }).catch(() => {});

      return next(
        new ApiError(
          403,
          `Từ chối truy cập: Bạn không có quyền thực hiện thao tác này theo chính sách RBAC. Yêu cầu một trong các vai trò: [${normalizedAllowed.join(', ')}]`
        )
      );
    } catch (error) {
      return next(error);
    }
  };
};

/**
 * Alias cho requireRoles để đồng bộ phong cách đặt tên
 */
export const authorizeRoles = requireRoles;

/**
 * Middleware cho phép chính chủ nhân của tài nguyên (Self) HOẶC Quản trị viên (Admin)
 * Ví dụ: Người dùng tự xem/sửa thông tin của chính mình HOẶC Admin/SuperAdmin xem/sửa người khác
 */
export const requireSelfOrAdmin = (getTargetUserId: (req: Request) => string | undefined) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      if (!user || !user.id) {
        return next(new ApiError(401, 'Yêu cầu đăng nhập trước khi thực hiện thao tác'));
      }

      const targetUserId = getTargetUserId(req);

      // Nếu người thao tác chính là chủ nhân của tài nguyên -> Cho phép
      if (targetUserId && user.id === targetUserId) {
        return next();
      }

      // Nếu không phải chính chủ, kiểm tra xem có quyền ADMIN hoặc SUPER_ADMIN không
      const rawTokenRoles: string[] = Array.isArray(user.roles)
        ? user.roles.map((r: string) => String(r).trim().toUpperCase())
        : (user.roles ? [String(user.roles).trim().toUpperCase()] : []);

      const effectiveTokenRoles = expandRoles(rawTokenRoles);

      if (effectiveTokenRoles.includes('SUPER_ADMIN') || effectiveTokenRoles.includes('ADMIN')) {
        return next();
      }

      // Kiểm tra DB nếu trong token chưa có quyền
      const isAdminInDb = await SystemRoleService.hasAnyRole(user.id, ['ADMIN', 'SUPER_ADMIN']);
      if (isAdminInDb) {
        return next();
      }

      return next(
        new ApiError(403, 'Từ chối truy cập: Bạn chỉ có quyền xem hoặc thao tác trên tài khoản của chính mình')
      );
    } catch (error) {
      return next(error);
    }
  };
};
