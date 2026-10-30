import { Request, Response, NextFunction } from 'express';
import { UserService } from '../services/user.service';
import { UserModel } from '../models/user.model';
import { ApiResponse } from '../utils/apiResponse';
import { ApiError } from '../utils/apiError';

export class UserController {
  /**
   * [GET] /api/v1/users/me
   * Lấy thông tin hồ sơ của người dùng đang đăng nhập
   */
  /**
   * [PUT] /api/v1/users/me
   * Cập nhật thông tin hồ sơ của người dùng đang đăng nhập
   */
  public static async updateMe(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        throw new ApiError(401, 'Không có quyền truy cập');
      }

      const updatedProfile = await UserService.updateMyProfile(userId, req.body);
      return ApiResponse.success(res, 'Cập nhật hồ sơ cá nhân thành công', updatedProfile, 200);
    } catch (error) {
      next(error);
    }
  }

  public static async getMe(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        throw new ApiError(401, 'Không có quyền truy cập');
      }

      const profile = await UserService.getMyProfile(userId);
      return ApiResponse.success(res, 'Lấy thông tin hồ sơ cá nhân thành công', profile, 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * [GET] /api/v1/users
   * Lấy danh sách người dùng (kèm phân trang, lọc theo status, tìm kiếm theo name, email, id, search)
   */
  public static async getAllUsers(req: Request, res: Response, next: NextFunction) {
    try {
      const { page, limit, search, name, email, id, status, role, sort_by, order } = req.query;
      const result = await UserService.getAll({
        page: page ? parseInt(page as string, 10) : undefined,
        limit: limit ? parseInt(limit as string, 10) : undefined,
        search: search as string,
        name: name as string,
        email: email as string,
        id: id as string,
        status: status as any,
        role: role as any,
        sort_by: sort_by as any,
        order: order as any,
      });
      return ApiResponse.success(res, 'Lấy danh sách người dùng thành công', result, 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * [GET] /api/v1/users/profile
   * Xem hồ sơ cá nhân của người dùng đang đăng nhập
   */
  public static async getProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        throw new ApiError(401, 'Không có quyền truy cập');
      }

      const user = await UserService.getById(userId);
      return ApiResponse.success(res, 'Lấy thông tin người dùng thành công', user, 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * [GET] /api/v1/users/:id
   * Xem chi tiết một người dùng theo ID
   */
  public static async getUserById(req: Request, res: Response, next: NextFunction) {
    try {
      const targetUserId = req.params.id;
      if (!targetUserId) {
        throw new ApiError(400, 'Vui lòng cung cấp ID người dùng');
      }

      const user = await UserService.getById(targetUserId);
      return ApiResponse.success(res, 'Lấy chi tiết người dùng thành công', user, 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * [PUT] /api/v1/users/profile
   * Cập nhật thông tin cá nhân (họ tên, avatar)
   */
  public static async updateProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        throw new ApiError(401, 'Không có quyền truy cập');
      }

      const { full_name, avatar_url } = req.body;
      const updatedUser = await UserService.updateProfile(userId, { full_name, avatar_url });
      return ApiResponse.success(res, 'Cập nhật hồ sơ thành công', updatedUser, 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * [PUT] /api/v1/users/:id
   * Cập nhật thông tin người dùng theo ID
   */
  public static async updateUserById(req: Request, res: Response, next: NextFunction) {
    try {
      const targetUserId = req.params.id;
      if (!targetUserId) {
        throw new ApiError(400, 'Vui lòng cung cấp ID người dùng cần cập nhật');
      }

      const { full_name, avatar_url } = req.body;
      const updatedUser = await UserService.updateProfile(targetUserId, { full_name, avatar_url });
      return ApiResponse.success(res, 'Cập nhật thông tin người dùng thành công', updatedUser, 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * [POST] /api/v1/users/change-password
   * Đổi mật khẩu tài khoản
   */
  public static async changePassword(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        throw new ApiError(401, 'Không có quyền truy cập');
      }

      const { old_password, new_password } = req.body;
      if (!old_password || !new_password) {
        throw new ApiError(400, 'Vui lòng cung cấp mật khẩu cũ và mật khẩu mới');
      }

      if (new_password.length < 6) {
        throw new ApiError(400, 'Mật khẩu mới phải có tối thiểu 6 ký tự');
      }

      await UserService.changePassword(userId, { old_password, new_password });
      return ApiResponse.success(res, 'Đổi mật khẩu thành công', null, 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * [POST] /api/v1/users/send-verification
   * Người dùng hiện tại tự yêu cầu gửi mã xác thực email vào hộp thư
   */
  public static async sendVerificationEmail(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        throw new ApiError(401, 'Không có quyền truy cập');
      }

      const result = await UserService.sendVerificationEmailForUser(userId);
      return ApiResponse.success(res, 'Mã xác thực email đã được tạo và gửi thành công', result, 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * [PATCH] /api/v1/users/:id/verify-email
   * Quản trị viên kích hoạt/xác thực email trực tiếp cho một user theo ID
   */
  public static async verifyEmailById(req: Request, res: Response, next: NextFunction) {
    try {
      const targetUserId = req.params.id;
      if (!targetUserId) {
        throw new ApiError(400, 'Vui lòng cung cấp ID người dùng cần xác thực');
      }

      const updatedUser = await UserService.verifyEmailById(targetUserId);
      return ApiResponse.success(res, 'Kích hoạt xác thực email cho người dùng thành công', updatedUser, 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * [POST] /api/v1/users/verify-email
   * Xác thực email cho chính tài khoản đang đăng nhập bằng Token người dùng (Authorization: Bearer <token>)
   */
  public static async verifyEmailByAuthToken(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        throw new ApiError(401, 'Không có quyền truy cập');
      }

      const updatedUser = await UserService.verifyEmailById(userId);
      return ApiResponse.success(res, 'Xác thực email thành công bằng Token người dùng!', {
        id: updatedUser.id,
        email: updatedUser.email,
        email_verified_at: updatedUser.email_verified_at,
      }, 200);
    } catch (error) {
      next(error);
    }
  }
  /**
   * [PATCH] /api/v1/users/:id/status
   * Cập nhật trạng thái tài khoản (Khóa/Mở khóa) - Yêu cầu ADMIN hoặc SUPER_ADMIN
   */
  public static async updateUserStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const operatorId = (req as any).user?.id;
      if (!operatorId) {
        throw new ApiError(401, 'Không có quyền truy cập');
      }

      const targetUserId = req.params.id;
      const { status } = req.body;

      // Lấy danh sách vai trò hệ thống của operator
      let operatorRoles: string[] = Array.isArray((req as any).user?.roles)
        ? (req as any).user.roles
        : [];
      if (!operatorRoles.includes('SUPER_ADMIN')) {
        const dbRoles = await UserModel.getUserRoles(operatorId);
        operatorRoles = Array.from(new Set([...operatorRoles, ...dbRoles]));
      }

      const updatedUser = await UserService.updateStatus(operatorId, operatorRoles, targetUserId, status);
      const actionText = status === 'SUSPENDED' ? 'Khóa' : 'Mở khóa';
      return ApiResponse.success(res, `${actionText} tài khoản người dùng thành công`, updatedUser, 200);
    } catch (error) {
      next(error);
    }
  }
}
