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
  const token = authHeader && authHeader.startsWith('Bearer ')
    ? authHeader.split(' ')[1]
    : null;

  if (!token) {
    return next(new ApiError(401, 'Yêu cầu đăng nhập (Thiếu Bearer Token)'));
  }

  try {
    const decoded = jwt.verify(token, config.jwt.secret) as IJwtPayload;
    (req as any).user = decoded;
    return next();
  } catch (error) {
    return next(new ApiError(401, 'Token không hợp lệ hoặc đã hết hạn'));
  }
};
