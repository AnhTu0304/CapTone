import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';
import { ApiError } from '../utils/apiError';
import { IJwtPayload, UserModel } from '../models/user.model';
import { SessionRevocationService } from '../services/sessionRevocation.service';
import { recordAuthFailure } from '../telemetry/metrics';

/**
 * Middleware kiểm tra và giải mã JWT Access Token
 * Nếu hợp lệ, xác thực trạng thái người dùng trong DB và gắn payload vào req.user
 */
export const authenticateToken = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    if (process.env.NODE_ENV !== 'production' && process.env.ALLOW_DEV_FALLBACK === 'true' && process.env.DEV_FALLBACK_EMAIL) {
      try {
        const devUser = await UserModel.findFullByEmail(process.env.DEV_FALLBACK_EMAIL);
        if (devUser) {
          (req as any).user = {
            id: devUser.id,
            userId: devUser.id,
            email: devUser.email,
            status: devUser.status,
            roles: Array.isArray((devUser as any).roles) ? (devUser as any).roles : ['SUPER_ADMIN', 'ADMIN'],
            systemRoles: Array.isArray((devUser as any).system_roles) ? (devUser as any).system_roles : ['SYSTEM_ADMIN'],
            organizations: [],
          };
          return next();
        }
      } catch (e) {
        // Fallback
      }
    }
    recordAuthFailure('jwt', 'missing_token');
    return next(new ApiError(401, 'Yêu cầu đăng nhập (Thiếu Authorization Header)'));
  }

  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  const token = match ? match[1].trim() : null;

  if (!token) {
    recordAuthFailure('jwt', 'missing_token');
    return next(new ApiError(401, 'Yêu cầu đăng nhập (Thiếu hoặc sai định dạng Bearer Token)'));
  }

  let decoded: IJwtPayload;
  try {
    decoded = jwt.verify(token, config.jwt.secret, {
      algorithms: ['HS256'],
    }) as IJwtPayload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      recordAuthFailure('jwt', 'expired_token');
      return next(new ApiError(401, 'Token đã hết hạn'));
    }
    if (error instanceof jwt.JsonWebTokenError) {
      recordAuthFailure('jwt', 'invalid_token');
      return next(new ApiError(401, 'Token không hợp lệ hoặc chữ ký không đúng'));
    }
    recordAuthFailure('jwt', 'invalid_token');
    return next(new ApiError(401, 'Lỗi xác thực Token'));
  }

  // 0. Kiểm tra Token có trong Blacklist (Đã đăng xuất / bị thu hồi) không (Fail-Closed)
  try {
    const isRevoked = await SessionRevocationService.isTokenRevoked(token);
    if (isRevoked) {
      recordAuthFailure('jwt', 'invalid_token');
      return next(new ApiError(401, 'Phiên đăng nhập đã kết thúc hoặc Token đã bị thu hồi'));
    }
  } catch (err: any) {
    if (err instanceof ApiError) {
      return next(err);
    }
    return next(new ApiError(503, 'Dịch vụ xác thực tạm thời không khả dụng, không thể xác minh phiên làm việc'));
  }

  if (!decoded || typeof decoded !== 'object' || !decoded.id || !decoded.email) {
    recordAuthFailure('jwt', 'invalid_token');
    return next(new ApiError(401, 'Token thiếu thông tin xác thực bắt buộc (id, email)'));
  }

  // 1. Kiểm tra nhanh claim tĩnh trong token
  if (decoded.status === 'SUSPENDED' || decoded.status === 'INACTIVE') {
    recordAuthFailure('jwt', 'user_inactive');
    return next(new ApiError(403, 'Tài khoản đã bị tạm khóa hoặc ngừng hoạt động'));
  }

  // 2. Kiểm tra động trạng thái mới nhất từ cơ sở dữ liệu qua UserModel
  try {
    const dbUser = await UserModel.findAuthStatus(decoded.id);

    if (!dbUser) {
      recordAuthFailure('jwt', 'user_inactive');
      return next(new ApiError(401, 'Người dùng không tồn tại hoặc đã bị xóa khỏi hệ thống'));
    }

    // Tài khoản đã bị xóa mềm
    if (dbUser.deleted_at) {
      recordAuthFailure('jwt', 'user_inactive');
      return next(new ApiError(401, 'Tài khoản đã bị xóa khỏi hệ thống'));
    }

    // Tài khoản bị tạm khóa hoặc ngừng hoạt động
    if (dbUser.status === 'SUSPENDED' || dbUser.status === 'INACTIVE') {
      recordAuthFailure('jwt', 'user_inactive');
      return next(new ApiError(403, 'Tài khoản đã bị tạm khóa hoặc ngừng hoạt động'));
    }

    // Đồng bộ trạng thái thực tế và danh sách vai trò hoạt động mới nhất từ CSDL vào request
    decoded.status = dbUser.status as any;
    
    // Nếu token có chứa các vai trò hệ thống (SUPER_ADMIN, SYSTEM_ADMIN, ADMIN), 
    // bắt buộc phải tồn tại trong CSDL (user_system_roles) để chống stale token sau khi bị thu hồi
    const dbSystemRoles = Array.isArray(dbUser.roles)
      ? dbUser.roles.map((r: string) => String(r).trim().toUpperCase())
      : [];
    
    if (Array.isArray(decoded.roles)) {
      const SYSTEM_ROLE_NAMES = ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'ADMIN'];
      decoded.roles = decoded.roles.filter((r: string) => {
        const upper = String(r).trim().toUpperCase();
        if (SYSTEM_ROLE_NAMES.includes(upper)) {
          return dbSystemRoles.includes(upper);
        }
        return true;
      });
      for (const sr of dbSystemRoles) {
        if (!decoded.roles.includes(sr)) {
          decoded.roles.push(sr);
        }
      }
    } else {
      decoded.roles = dbSystemRoles;
    }
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
