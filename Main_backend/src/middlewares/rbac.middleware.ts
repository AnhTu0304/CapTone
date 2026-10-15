import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/apiError';
import { SystemRoleService } from '../services/systemRole.service';

/**
 * Middleware phân quyền theo vai trò (Role-Based Access Control - RBAC)
 * Kiểm tra xem người dùng hiện tại có ít nhất một trong các vai trò được phép hay không.
 * Tự động cho phép vai trò 'SUPER_ADMIN' vượt qua mọi hạn chế quyền.
 * 
 * @param allowedRoles Danh sách các vai trò được cấp quyền (VD: 'ADMIN', 'SUPER_ADMIN', 'SYSTEM_ADMIN')
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
      const tokenRoles: string[] = Array.isArray(user.roles)
        ? user.roles.map((r: string) => r.trim().toUpperCase())
        : [];

      // SUPER_ADMIN luôn có toàn quyền truy cập
      if (tokenRoles.includes('SUPER_ADMIN')) {
        return next();
      }

      // Kiểm tra xem vai trò trong token có khớp với danh sách cho phép không
      const hasTokenMatch = tokenRoles.some((r) => normalizedAllowed.includes(r));
      if (hasTokenMatch) {
        return next();
      }

      // 2. Dự phòng: Kiểm tra trực tiếp trong Database
      // Đảm bảo không bị trễ quyền nếu tài khoản vừa được cấp vai trò mới mà chưa đăng nhập lại
      const hasDbMatch = await SystemRoleService.hasAnyRole(user.id, [
        ...normalizedAllowed,
        'SUPER_ADMIN',
      ]);

      if (hasDbMatch) {
        return next();
      }

      // 3. Nếu không có vai trò hợp lệ -> Trả về lỗi 403 Forbidden
      return next(
        new ApiError(
          403,
          `Từ chối truy cập: Bạn không có quyền thực hiện thao tác này. Yêu cầu một trong các vai trò: [${normalizedAllowed.join(', ')}]`
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
      const tokenRoles: string[] = Array.isArray(user.roles)
        ? user.roles.map((r: string) => r.trim().toUpperCase())
        : [];

      if (tokenRoles.includes('SUPER_ADMIN') || tokenRoles.includes('ADMIN')) {
        return next();
      }

      // Kiểm tra DB nếu trong token chưa có quyền
      const isAdminInDb = await SystemRoleService.hasAnyRole(user.id, ['ADMIN', 'SUPER_ADMIN']);
      if (isAdminInDb) {
        return next();
      }

      return next(
        new ApiError(403, 'Bạn chỉ có quyền xem hoặc thao tác trên tài khoản của chính mình')
      );
    } catch (error) {
      return next(error);
    }
  };
};
