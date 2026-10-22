import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';
import { ApiError } from '../utils/apiError';
import { IJwtPayload, UserModel } from '../models/user.model';
import { SessionRevocationService } from '../services/sessionRevocation.service';

/**
 * Middleware kiểm tra và giải mã JWT Access Token
 * Nếu hợp lệ, xác thực trạng thái người dùng trong DB và gắn payload vào req.user
 */
export const authenticateToken = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return next(new ApiError(401, 'Yêu cầu đăng nhập (Thiếu Authorization Header)'));
  }

  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  const token = match ? match[1].trim() : null;

  if (!token) {
    return next(new ApiError(401, 'Yêu cầu đăng nhập (Thiếu hoặc sai định dạng Bearer Token)'));
  }

  let decoded: IJwtPayload;
  try {
    decoded = jwt.verify(token, config.jwt.secret, {
      algorithms: ['HS256'],
    }) as IJwtPayload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return next(new ApiError(401, 'Token đã hết hạn'));
    }
    if (error instanceof jwt.JsonWebTokenError) {
      return next(new ApiError(401, 'Token không hợp lệ hoặc chữ ký không đúng'));
    }
    return next(new ApiError(401, 'Lỗi xác thực Token'));
  }

  // 0. Kiểm tra Token có trong Blacklist (Đã đăng xuất / bị thu hồi) không
  const isRevoked = await SessionRevocationService.isTokenRevoked(token);
  if (isRevoked) {
    return next(new ApiError(401, 'Phiên đăng nhập đã kết thúc hoặc Token đã bị thu hồi'));
  }

  if (!decoded || typeof decoded !== 'object' || !decoded.id || !decoded.email) {
    return next(new ApiError(401, 'Token thiếu thông tin xác thực bắt buộc (id, email)'));
  }

  // 1. Kiểm tra nhanh claim tĩnh trong token
  if (decoded.status === 'SUSPENDED' || decoded.status === 'INACTIVE') {
    return next(new ApiError(403, 'Tài khoản đã bị tạm khóa hoặc ngừng hoạt động'));
  }

  // 2. Kiểm tra động trạng thái mới nhất từ cơ sở dữ liệu qua UserModel
  try {
    const dbUser = await UserModel.findAuthStatus(decoded.id);

    if (!dbUser) {
      return next(new ApiError(401, 'Người dùng không tồn tại hoặc đã bị xóa khỏi hệ thống'));
    }

    // Tài khoản đã bị xóa mềm
    if (dbUser.deleted_at) {
      return next(new ApiError(401, 'Tài khoản đã bị xóa khỏi hệ thống'));
    }

    // Tài khoản bị tạm khóa hoặc ngừng hoạt động
    if (dbUser.status === 'SUSPENDED' || dbUser.status === 'INACTIVE') {
      return next(new ApiError(403, 'Tài khoản đã bị tạm khóa hoặc ngừng hoạt động'));
    }

    // Đồng bộ trạng thái thực tế và danh sách vai trò hoạt động mới nhất từ CSDL vào request
    decoded.status = dbUser.status as any;
    decoded.roles = Array.isArray(dbUser.roles) ? dbUser.roles : [];
  } catch (dbError) {
    if (dbError instanceof ApiError) {
      return next(dbError);
    }
    // Fail-closed: Không bỏ qua lỗi kết nối cơ sở dữ liệu
    return next(new ApiError(500, 'Lỗi cơ sở dữ liệu khi xác thực trạng thái tài khoản'));
  }

  (req as any).user = decoded;
  return next();
};
