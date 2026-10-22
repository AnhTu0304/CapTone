import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthService } from '../services/auth.service';
import { SessionRevocationService } from '../services/sessionRevocation.service';
import { UserService } from '../services/user.service';
import { ApiResponse } from '../utils/apiResponse';
import { ApiError } from '../utils/apiError';
import { config } from '../config/env';
import { IJwtPayload } from '../models/user.model';

export class AuthController {
  /**
   * [POST] /api/v1/auth/register
   * Đăng ký tài khoản người dùng mới
   */
  public static async register(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password, full_name } = req.body;

      if (!email || !password || !full_name) {
        throw new ApiError(400, 'Vui lòng điền đầy đủ email, mật khẩu và họ tên');
      }

      if (password.length < 6) {
        throw new ApiError(400, 'Mật khẩu phải có ít nhất 6 ký tự');
      }

      const result = await AuthService.register({ email, password, full_name });
      return ApiResponse.success(res, 'Đăng ký tài khoản thành công', result, 201);
    } catch (error) {
      next(error);
    }
  }

  /**
   * [POST] /api/v1/auth/login
   * Đăng nhập hệ thống và nhận JWT Token
   */
  public static async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        throw new ApiError(400, 'Vui lòng cung cấp email và mật khẩu');
      }

      const result = await AuthService.login({ email, password });
      return ApiResponse.success(res, 'Đăng nhập thành công', result, 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * [GET] /api/v1/auth/me
   * Lấy thông tin tài khoản hiện tại từ Token xác thực
   */
  public static async me(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        throw new ApiError(401, 'Không tìm thấy thông tin xác thực người dùng');
      }

      const user = await UserService.getById(userId);
      return ApiResponse.success(res, 'Lấy thông tin tài khoản thành công', user, 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * [POST] /api/v1/auth/change-password
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

      if (old_password === new_password) {
        throw new ApiError(400, 'Mật khẩu mới không được trùng với mật khẩu cũ');
      }

      await UserService.changePassword(userId, { old_password, new_password });
      return ApiResponse.success(res, 'Đổi mật khẩu thành công', null, 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * [POST] /api/v1/auth/send-verification
   * Gửi mã xác thực về email cho người dùng (Yêu cầu Token đăng nhập)
   */
  public static async sendVerification(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        throw new ApiError(401, 'Không có quyền truy cập (Yêu cầu đăng nhập)');
      }

      const result = await AuthService.sendVerificationEmail(userId);
      return ApiResponse.success(res, 'Mã xác thực email đã được gửi thành công đến hộp thư của bạn', result, 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * [POST & GET] /api/v1/auth/verify-email
   * Xác thực tài khoản email bằng mã code nhận được từ Email
   */
  public static async verifyEmail(req: Request, res: Response, next: NextFunction) {
    const isBrowserRequest = req.method === 'GET' && req.headers.accept?.includes('text/html');

    try {
      // 1. Nhận mã xác thực (code hoặc token) được gửi về email
      const code = (req.body?.code || req.body?.token || req.query?.code || req.query?.token) as string;

      if (!code) {
        throw new ApiError(400, 'Vui lòng cung cấp mã xác thực được gửi về email của bạn');
      }

      // 2. Trích xuất userId nếu có Header Authorization: Bearer <token> của người dùng
      let userId: string | undefined = undefined;
      const authHeader = req.headers.authorization;
      const bearerToken = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

      if (bearerToken) {
        try {
          const decoded = jwt.verify(bearerToken, config.jwt.secret) as IJwtPayload;
          userId = decoded.id;
        } catch (err) {
          throw new ApiError(401, 'Token xác thực người dùng không hợp lệ hoặc đã hết hạn');
        }
      }

      // 3. Đối chiếu mã code với hệ thống
      const result = await AuthService.verifyEmail(code, userId);

      // Nếu người dùng nhấn trực tiếp vào link trong Email trên trình duyệt
      if (isBrowserRequest) {
        return res.status(200).send(`
          <!DOCTYPE html>
          <html lang="vi">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Xác thực Email thành công - AI Self-Heal</title>
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
                color: #e2e8f0;
                min-height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
                margin: 0;
                padding: 20px;
                box-sizing: border-box;
              }
              .card {
                background: rgba(30, 41, 59, 0.85);
                backdrop-filter: blur(12px);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 16px;
                padding: 40px 32px;
                max-width: 480px;
                width: 100%;
                text-align: center;
                box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
              }
              .icon-circle {
                width: 72px;
                height: 72px;
                background: rgba(16, 185, 129, 0.15);
                border: 2px solid #10b981;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                margin: 0 auto 24px;
                color: #10b981;
                font-size: 36px;
              }
              h1 {
                font-size: 24px;
                font-weight: 700;
                color: #f8fafc;
                margin: 0 0 12px;
              }
              p {
                font-size: 15px;
                line-height: 1.6;
                color: #94a3b8;
                margin: 0 0 28px;
              }
              .email-badge {
                display: inline-block;
                background: rgba(37, 99, 235, 0.15);
                border: 1px solid rgba(59, 130, 246, 0.3);
                color: #60a5fa;
                padding: 6px 14px;
                border-radius: 20px;
                font-size: 14px;
                font-weight: 600;
                margin-bottom: 24px;
              }
              .btn {
                display: inline-block;
                background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
                color: #ffffff;
                text-decoration: none;
                padding: 14px 28px;
                border-radius: 8px;
                font-weight: 600;
                font-size: 15px;
                transition: transform 0.2s, box-shadow 0.2s;
                box-shadow: 0 4px 14px rgba(37, 99, 235, 0.4);
              }
              .btn:hover {
                transform: translateY(-2px);
                box-shadow: 0 6px 20px rgba(37, 99, 235, 0.6);
              }
            </style>
          </head>
          <body>
            <div class="card">
              <div class="icon-circle">✓</div>
              <h1>Xác Thực Email Thành Công!</h1>
              <div class="email-badge">${result.email}</div>
              <p>Tài khoản của bạn đã được kích hoạt thành công. Bây giờ bạn có thể đăng nhập và trải nghiệm toàn bộ các tính năng của nền tảng <strong>AI Self-Heal</strong>.</p>
              <a href="/api/v1/auth/login" class="btn">Đăng Nhập Vào Hệ Thống</a>
            </div>
          </body>
          </html>
        `);
      }

      return ApiResponse.success(res, 'Xác thực email thành công! Tài khoản của bạn đã được kích hoạt', result, 200);
    } catch (error) {
      if (isBrowserRequest) {
        const errMessage = (error as Error).message || 'Mã xác thực không hợp lệ hoặc đã hết hạn';
        return res.status(400).send(`
          <!DOCTYPE html>
          <html lang="vi">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Xác thực không thành công - AI Self-Heal</title>
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
                color: #e2e8f0;
                min-height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
                margin: 0;
                padding: 20px;
                box-sizing: border-box;
              }
              .card {
                background: rgba(30, 41, 59, 0.85);
                backdrop-filter: blur(12px);
                border: 1px solid rgba(239, 68, 68, 0.2);
                border-radius: 16px;
                padding: 40px 32px;
                max-width: 480px;
                width: 100%;
                text-align: center;
                box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
              }
              .icon-circle {
                width: 72px;
                height: 72px;
                background: rgba(239, 68, 68, 0.15);
                border: 2px solid #ef4444;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                margin: 0 auto 24px;
                color: #ef4444;
                font-size: 36px;
              }
              h1 {
                font-size: 22px;
                font-weight: 700;
                color: #f8fafc;
                margin: 0 0 12px;
              }
              p {
                font-size: 15px;
                line-height: 1.6;
                color: #94a3b8;
                margin: 0 0 28px;
              }
              .error-box {
                background: rgba(239, 68, 68, 0.1);
                border: 1px solid rgba(239, 68, 68, 0.3);
                color: #fca5a5;
                padding: 12px 16px;
                border-radius: 8px;
                font-size: 14px;
                margin-bottom: 24px;
              }
              .btn {
                display: inline-block;
                background: #334155;
                color: #f8fafc;
                text-decoration: none;
                padding: 12px 24px;
                border-radius: 8px;
                font-weight: 600;
                font-size: 14px;
              }
              .btn:hover {
                background: #475569;
              }
            </style>
          </head>
          <body>
            <div class="card">
              <div class="icon-circle">✕</div>
              <h1>Xác Thực Không Thành Công</h1>
              <div class="error-box">${errMessage}</div>
              <p>Mã xác thực có thể đã hết hạn (sau 24h), đã được sử dụng trước đó hoặc không hợp lệ. Vui lòng yêu cầu hệ thống gửi lại email xác thực mới.</p>
              <a href="/" class="btn">Quay lại Trang Chủ</a>
            </div>
          </body>
          </html>
        `);
      }
      next(error);
    }
  }

  /**
   * [POST] /api/v1/auth/google
   * Đăng nhập hoặc đăng ký nhanh qua Google OAuth
   */
  public static async googleLogin(req: Request, res: Response, next: NextFunction) {
    try {
      const { token } = req.body;

      if (!token) {
        throw new ApiError(400, 'Vui lòng cung cấp mã xác thực Google (Token)');
      }

      const result = await AuthService.loginWithGoogle(token);
      return ApiResponse.success(res, 'Đăng nhập Google thành công', result, 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * [POST] /api/v1/auth/logout
   * Đăng xuất và thu hồi Access Token hiện tại
   */
  public static async logout(req: Request, res: Response, next: NextFunction) {
    try {
      const authHeader = req.headers.authorization;
      const match = authHeader ? authHeader.match(/^Bearer\s+(.+)$/i) : null;
      const token = match ? match[1].trim() : null;

      if (token) {
        const decoded: any = jwt.decode(token);
        const expSeconds = decoded?.exp ? decoded.exp - Math.floor(Date.now() / 1000) : 3600;
        await SessionRevocationService.revokeToken(token, Math.max(60, expSeconds));
      }

      return ApiResponse.success(res, 'Đăng xuất thành công, phiên đăng nhập đã bị vô hiệu hóa', null, 200);
    } catch (error) {
      next(error);
    }
  }
}
