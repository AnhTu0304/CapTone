import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthService } from '../services/auth.service';
import { SessionRevocationService } from '../services/sessionRevocation.service';
import { RefreshTokenService, GENERIC_REFRESH_ERROR } from '../services/refreshToken.service';
import { WsTicketService } from '../services/wsTicket.service';
import { UserService } from '../services/user.service';
import { AuditService } from '../services/audit.service';
import { ApiResponse } from '../utils/apiResponse';
import { ApiError } from '../utils/apiError';
import { config } from '../config/env';
import { IJwtPayload } from '../models/user.model';
import { clearAuthCookies, parseCookies, setAuthCookies } from '../middlewares/csrfOrigin.middleware';

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

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
      if (result.user?.id && !result.requires_verification) {
        const session = await RefreshTokenService.createSession(result.user.id, {
          ipAddress: req.ip || req.socket.remoteAddress || null,
          userAgent: req.headers['user-agent'] || null,
        });
        setAuthCookies(res, session.rawRefreshToken, session.csrfToken, req);
      }
      return ApiResponse.success(
        res,
        'Đăng ký thành công. Vui lòng kiểm tra email để nhập mã xác thực OTP.',
        result,
        201
      );
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
      if (result.require_2fa) {
        return ApiResponse.success(res, 'Yêu cầu xác thực hai yếu tố (2FA)', result, 200);
      }
      const session = await RefreshTokenService.createSession(result.id, {
        ipAddress: req.ip || req.socket.remoteAddress || null,
        userAgent: req.headers['user-agent'] || null,
      });
      setAuthCookies(res, session.rawRefreshToken, session.csrfToken, req);
      const primaryOrgId = result.organization_roles?.[0]?.organization_id || null;
      await AuditService.recordFromRequest(req, {
        organization_id: primaryOrgId,
        action: 'AUTH_LOGIN_SUCCESS',
        status: 'SUCCESS',
        user_id: result.id,
        description: 'Đăng nhập thành công vào hệ thống',
        metadata: {
          email: result.email,
          has_organization: result.has_organization,
          organization_name: result.organization_roles?.[0]?.organization_name || null,
        },
      }).catch(() => {});
      return ApiResponse.success(res, 'Đăng nhập thành công', result, 200);
    } catch (error) {
      await AuditService.recordFromRequest(req, {
        action: 'AUTH_LOGIN_FAILURE',
        status: 'FAILURE',
        reason_code: 'INVALID_CREDENTIALS',
        description: 'Đăng nhập thất bại do thông tin không chính xác',
        metadata: { email: (req.body?.email || '').toLowerCase().trim() },
      }).catch(() => {});
      next(error);
    }
  }

  /**
   * [GET] /api/v1/auth/me
   * Lấy thông tin tài khoản hiện tại từ Token xác thực
   */

  /**
   * [POST] /api/v1/auth/login/2fa
   * Xác thực mã OTP 2FA để hoàn tất đăng nhập
   */
  public static async verify2FALogin(req: Request, res: Response, next: NextFunction) {
    try {
      const { temp_token, code } = req.body;
      if (!temp_token || !code) {
        throw new ApiError(400, 'Vui lòng cung cấp mã phiên và mã OTP 2FA');
      }
      const result = await AuthService.verify2FALogin(temp_token, code);
      const session = await RefreshTokenService.createSession(result.id, {
        ipAddress: req.ip || req.socket.remoteAddress || null,
        userAgent: req.headers['user-agent'] || null,
      });
      setAuthCookies(res, session.rawRefreshToken, session.csrfToken, req);
      const primaryOrgId = result.organization_roles?.[0]?.organization_id || null;
      await AuditService.recordFromRequest(req, {
        organization_id: primaryOrgId,
        action: 'AUTH_LOGIN_SUCCESS',
        status: 'SUCCESS',
        user_id: result.id,
        description: 'Đăng nhập thành công qua xác thực 2FA',
        metadata: {
          email: result.email,
          auth_method: '2FA',
          has_organization: result.has_organization,
          organization_name: result.organization_roles?.[0]?.organization_name || null,
        },
      }).catch(() => {});
      return ApiResponse.success(res, 'Đăng nhập thành công', result, 200);
    } catch (error) {
      await AuditService.recordFromRequest(req, {
        action: 'AUTH_LOGIN_FAILURE',
        status: 'FAILURE',
        reason_code: 'INVALID_2FA_CODE',
        description: 'Xác thực 2FA thất bại do mã OTP không hợp lệ',
      }).catch(() => {});
      next(error);
    }
  }

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
      clearAuthCookies(res, req);
      await AuditService.recordFromRequest(req, {
        action: 'AUTH_PASSWORD_CHANGED',
        status: 'SUCCESS',
        user_id: userId,
        description: 'Đổi mật khẩu tài khoản thành công',
      }).catch(() => {});
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
          const decoded = jwt.verify(bearerToken, config.jwt.secret, { algorithms: ['HS256'] }) as IJwtPayload;
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
              <div class="email-badge">${escapeHtml(result.email)}</div>
              <p>Tài khoản của bạn đã được kích hoạt thành công. Bây giờ bạn có thể đăng nhập và trải nghiệm toàn bộ các tính năng của nền tảng <strong>AI Self-Heal</strong>.</p>
              <a href="/api/v1/auth/login" class="btn">Đăng Nhập Vào Hệ Thống</a>
            </div>
          </body>
          </html>
        `);
      }

      if (!isBrowserRequest && result.user?.id) {
        const session = await RefreshTokenService.createSession(result.user.id, {
          ipAddress: req.ip || req.socket.remoteAddress || null,
          userAgent: req.headers['user-agent'] || null,
        });
        setAuthCookies(res, session.rawRefreshToken, session.csrfToken, req);
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
              <div class="error-box">${escapeHtml(errMessage)}</div>
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
      if (result.user?.id) {
        const session = await RefreshTokenService.createSession(result.user.id, {
          ipAddress: req.ip || req.socket.remoteAddress || null,
          userAgent: req.headers['user-agent'] || null,
        });
        setAuthCookies(res, session.rawRefreshToken, session.csrfToken, req);
      }
      return ApiResponse.success(res, 'Đăng nhập Google thành công', result, 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * [POST] /api/v1/auth/refresh
   * Xoay vòng Refresh Token nguyên tử từ HttpOnly cookie + kiểm tra CSRF/Origin
   */
  public static async refresh(req: Request, res: Response, next: NextFunction) {
    try {
      const cookies = parseCookies(req.headers.cookie);
      const rawRefreshToken = cookies[config.refreshToken.cookieName];
      if (!rawRefreshToken) {
        clearAuthCookies(res, req);
        throw new ApiError(401, GENERIC_REFRESH_ERROR);
      }

      const rotated = await RefreshTokenService.rotateRefreshToken(rawRefreshToken, {
        ipAddress: req.ip || req.socket.remoteAddress || null,
        userAgent: req.headers['user-agent'] || null,
      });

      setAuthCookies(res, rotated.rawRefreshToken, rotated.csrfToken, req);
      return ApiResponse.success(
        res,
        'Làm mới phiên đăng nhập thành công',
        {
          token: rotated.accessToken,
          expires_in: config.jwt.accessExpiresIn,
        },
        200
      );
    } catch (error) {
      if (error instanceof ApiError && error.statusCode === 401) {
        clearAuthCookies(res, req);
      }
      next(error);
    }
  }

  /**
   * [POST] /api/v1/auth/logout
   * Đăng xuất và thu hồi cả Refresh Session lẫn Access Token hiện tại
   */
  public static async logout(req: Request, res: Response, next: NextFunction) {
    try {
      const authHeader = req.headers.authorization;
      const match = authHeader ? authHeader.match(/^Bearer\s+(.+)$/i) : null;
      const token = match ? match[1].trim() : null;

      // 1. Always revoke persistent PostgreSQL refresh session & clear cookies FIRST
      // so Redis outage never prevents session invalidation or cookie clearing
      const cookies = parseCookies(req.headers.cookie);
      const rawRefreshToken = cookies[config.refreshToken.cookieName];
      const revokedInfo = await RefreshTokenService.revokeSessionByRawToken(rawRefreshToken, 'LOGOUT');
      clearAuthCookies(res, req);

      // 2. Best-effort short-lived access token blacklisting in Redis (degrade with warning if Redis is down)
      if (token) {
        const decoded = jwt.decode(token) as any;
        const expSeconds = decoded?.exp ? decoded.exp - Math.floor(Date.now() / 1000) : 900;
        try {
          await SessionRevocationService.revokeToken(token, Math.max(60, expSeconds));
        } catch (revErr: any) {
          console.error('[Logout] Redis access-token blacklist failed (PG session & cookies already revoked):', revErr?.message || revErr);
        }
      }

      await AuditService.recordFromRequest(req, {
        user_id: (req as any).user?.id || revokedInfo.userId || null,
        action: 'AUTH_LOGOUT',
        status: 'SUCCESS',
        description: 'Đăng xuất khỏi hệ thống thành công',
        metadata: revokedInfo.sessionId ? { session_id: revokedInfo.sessionId } : undefined,
      }).catch(() => {});
      return ApiResponse.success(res, 'Đăng xuất thành công, phiên đăng nhập đã bị vô hiệu hóa', null, 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * [POST] /api/v1/auth/logout-all
   * Thu hồi toàn bộ phiên đăng nhập trên mọi thiết bị của người dùng hiện tại
   */
  public static async logoutAll(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        throw new ApiError(401, 'Yêu cầu đăng nhập trước khi thu hồi toàn bộ phiên');
      }

      const authHeader = req.headers.authorization;
      const match = authHeader ? authHeader.match(/^Bearer\s+(.+)$/i) : null;
      const token = match ? match[1].trim() : null;
      if (token) {
        const decoded = jwt.decode(token) as any;
        const expSeconds = decoded?.exp ? decoded.exp - Math.floor(Date.now() / 1000) : 900;
        await SessionRevocationService.revokeToken(token, Math.max(60, expSeconds));
      }

      await RefreshTokenService.revokeAllUserSessions(userId, 'LOGOUT_ALL');
      clearAuthCookies(res, req);

      await AuditService.recordFromRequest(req, {
        user_id: userId,
        action: 'AUTH_LOGOUT_ALL',
        status: 'SUCCESS',
        description: 'Thu hồi toàn bộ phiên đăng nhập trên mọi thiết bị thành công',
      }).catch(() => {});

      return ApiResponse.success(res, 'Đã đăng xuất khỏi toàn bộ thiết bị thành công', null, 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * [POST] /api/v1/auth/forgot-password
   */
  public static async forgotPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const { email } = req.body || {};
      await AuthService.requestPasswordReset(String(email || ''));
      return ApiResponse.success(
        res,
        'Nếu email tồn tại trong hệ thống, hướng dẫn đặt lại mật khẩu đã được gửi đi',
        null,
        200
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * [POST] /api/v1/auth/reset-password
   */
  public static async resetPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const { token, new_password } = req.body || {};
      await AuthService.resetPasswordWithToken(String(token || ''), String(new_password || ''));
      clearAuthCookies(res, req);
      return ApiResponse.success(res, 'Đặt lại mật khẩu thành công. Toàn bộ phiên cũ đã bị thu hồi.', null, 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * [POST] /api/v1/auth/ws-ticket
   * Cấp ticket dùng 1 lần (30s) để Frontend kết nối WebSocket không lộ JWT trên query URL
   */
  public static async issueWsTicket(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        throw new ApiError(401, 'Yêu cầu đăng nhập trước khi lấy WebSocket ticket');
      }
      const ticketData = await WsTicketService.issueTicket(userId);
      return ApiResponse.success(res, 'Tạo WebSocket ticket thành công', ticketData, 200);
    } catch (error) {
      next(error);
    }
  }
}
