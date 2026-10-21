import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/apiError';
import { SystemRoleService } from '../services/systemRole.service';

/**
 * Mở rộng vai trò kế thừa (Role inheritance / expansion)
 * - SUPER_ADMIN: toàn quyền truy cập
 * - ADMIN / SME_OWNER: quản trị viên (Admin + DevOps + Viewer + User)
 * - SYSTEM_ADMIN: quản trị viên hệ thống (DevOps + Viewer + User)
 * - DEVOPS: vận hành hạ tầng (DevOps + Viewer + User), không có quyền quản trị User
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
      expanded.add('SME_OWNER');
      expanded.add('DEVOPS');
      expanded.add('VIEWER');
      expanded.add('USER');
    } else if (role === 'ADMIN' || role === 'SME_OWNER') {
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

      // 1. Kiểm tra nhanh qua roles đã nhúng trong JWT Token
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

      // Kiểm tra xem vai trò hiệu lực trong token có khớp với danh sách cho phép không
      const hasTokenMatch = effectiveTokenRoles.some((r) => normalizedAllowed.includes(r));
      if (hasTokenMatch) {
        return next();
      }

      // 2. Dự phòng: Kiểm tra trực tiếp trong Database
      // Đảm bảo không bị trễ quyền nếu tài khoản vừa được cấp vai trò mới mà chưa đăng nhập lại
      const rolesThatSatisfyAllowed: string[] = ['SUPER_ADMIN', ...normalizedAllowed];
      if (normalizedAllowed.includes('DEVOPS')) {
        rolesThatSatisfyAllowed.push('ADMIN', 'SYSTEM_ADMIN', 'SME_OWNER');
      }
      if (normalizedAllowed.includes('ADMIN')) {
        rolesThatSatisfyAllowed.push('SME_OWNER');
      }
      if (normalizedAllowed.includes('VIEWER') || normalizedAllowed.includes('USER')) {
        rolesThatSatisfyAllowed.push('DEVOPS', 'ADMIN', 'SYSTEM_ADMIN', 'SME_OWNER', 'USER', 'VIEWER');
      }

      const hasDbMatch = await SystemRoleService.hasAnyRole(user.id, rolesThatSatisfyAllowed);
      if (hasDbMatch) {
        return next();
      }

      // 3. Nếu không có vai trò hợp lệ -> Trả về lỗi 403 Forbidden
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
      const isAdminInDb = await SystemRoleService.hasAnyRole(user.id, ['ADMIN', 'SUPER_ADMIN', 'SME_OWNER']);
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
