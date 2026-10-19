import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';
import { ApiError } from '../utils/apiError';
import { IJwtPayload } from '../models/user.model';

/**
 * Middleware kiểm tra và giải mã JWT Access Token
 * Nếu hợp lệ, gắn payload vào req.user để các controller tiếp theo sử dụng
 */
export const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return next(new ApiError(401, 'Yêu cầu đăng nhập (Thiếu Authorization Header)'));
  }

  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  const token = match ? match[1].trim() : null;

  if (!token) {
    return next(new ApiError(401, 'Yêu cầu đăng nhập (Thiếu hoặc sai định dạng Bearer Token)'));
  }

  try {
    const decoded = jwt.verify(token, config.jwt.secret, {
      algorithms: ['HS256'],
    }) as IJwtPayload;

    if (!decoded || typeof decoded !== 'object' || !decoded.id || !decoded.email) {
      return next(new ApiError(401, 'Token thiếu thông tin xác thực bắt buộc (id, email)'));
    }

    if (decoded.status === 'SUSPENDED' || decoded.status === 'INACTIVE') {
      return next(new ApiError(403, 'Tài khoản đã bị tạm khóa hoặc ngừng hoạt động'));
    }

    (req as any).user = decoded;
    return next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return next(new ApiError(401, 'Token đã hết hạn'));
    }
    if (error instanceof jwt.JsonWebTokenError) {
      return next(new ApiError(401, 'Token không hợp lệ hoặc chữ ký không đúng'));
    }
    return next(new ApiError(401, 'Lỗi xác thực Token'));
  }
};
