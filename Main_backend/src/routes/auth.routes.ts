import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { UserController } from '../controllers/user.controller';
import { TwoFactorController } from '../controllers/twoFactor.controller';
import { authenticateToken } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { 
  registerSchema, 
  loginSchema, 
  changePasswordSchema, 
  verifyEmailSchema, 
  updateProfileSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '../validations';

import { authRateLimiter, refreshRateLimiter, sensitiveOpRateLimiter } from '../middlewares/rateLimit.middleware';
import { requireTrustedOriginAndCsrf } from '../middlewares/csrfOrigin.middleware';

const router = Router();

// [POST] /api/v1/auth/register -> Đăng ký tài khoản (Validate body + Rate limit)
router.post('/register', authRateLimiter, validate(registerSchema), AuthController.register);

// [POST] /api/v1/auth/login -> Đăng nhập (Validate body + Rate limit)
router.post('/login', authRateLimiter, validate(loginSchema), AuthController.login);

// [POST] /api/v1/auth/login/2fa -> Xác thực OTP 2FA để hoàn tất đăng nhập
router.post('/login/2fa', authRateLimiter, AuthController.verify2FALogin);

// [POST] /api/v1/auth/refresh -> Xoay vòng Refresh Token từ HttpOnly Cookie (CSRF + Origin + Rate limit)
router.post('/refresh', refreshRateLimiter, requireTrustedOriginAndCsrf, AuthController.refresh);

// [POST] /api/v1/auth/logout -> Đăng xuất và thu hồi Refresh Session + Access Token
router.post('/logout', (req, res, next) => {
  // Nếu có cookie refresh token, kiểm tra Origin + CSRF để chống Logout CSRF
  if (req.headers.cookie && req.headers.cookie.includes('selfheal_refresh_token=')) {
    return requireTrustedOriginAndCsrf(req, res, next);
  }
  return authenticateToken(req, res, next);
}, AuthController.logout);

// [POST] /api/v1/auth/logout-all -> Thu hồi toàn bộ phiên đăng nhập trên mọi thiết bị
router.post('/logout-all', authenticateToken, AuthController.logoutAll);

// [POST] /api/v1/auth/forgot-password & /reset-password -> Đặt lại mật khẩu và thu hồi phiên
router.post('/forgot-password', authRateLimiter, validate(forgotPasswordSchema), AuthController.forgotPassword);
router.post('/reset-password', authRateLimiter, validate(resetPasswordSchema), AuthController.resetPassword);

// [POST] /api/v1/auth/ws-ticket -> Cấp single-use WebSocket ticket ngắn hạn (tránh đưa JWT vào WS URL)
router.post('/ws-ticket', authenticateToken, sensitiveOpRateLimiter, AuthController.issueWsTicket);

// [POST] /api/v1/auth/google -> Đăng nhập bằng Google OAuth (Rate limit)
router.post('/google', authRateLimiter, AuthController.googleLogin);

// [GET] /api/v1/auth/me -> Lấy thông tin user hiện tại (Yêu cầu Token)
router.get('/me', authenticateToken, AuthController.me);

// [PUT] /api/v1/auth/me -> Cập nhật thông tin user hiện tại (Yêu cầu Token & Validate body)
router.put('/me', authenticateToken, validate(updateProfileSchema), UserController.updateProfile);

// [POST] /api/v1/auth/change-password -> Đổi mật khẩu (Yêu cầu Token, Validate body & Rate limit)
router.post('/change-password', authenticateToken, sensitiveOpRateLimiter, validate(changePasswordSchema), AuthController.changePassword);

// [POST & GET] /api/v1/auth/verify-email -> Xác thực tài khoản bằng mã gửi về email (Rate limit chống brute-force OTP)
router.post('/verify-email', authRateLimiter, validate(verifyEmailSchema), AuthController.verifyEmail);
router.get('/verify-email', authRateLimiter, validate(verifyEmailSchema), AuthController.verifyEmail);

// [POST] /api/v1/auth/send-verification -> Người dùng đăng nhập gửi mã xác thực về email (Yêu cầu Token & Rate limit)
router.post('/send-verification', authenticateToken, sensitiveOpRateLimiter, AuthController.sendVerification);

// === 2FA Management Endpoints ===
// [GET] /api/v1/auth/2fa/status -> Kiểm tra trạng thái 2FA
router.get('/2fa/status', authenticateToken, TwoFactorController.getStatus);

// [POST] /api/v1/auth/2fa/setup -> Bắt đầu thiết lập 2FA (tạo secret & mã QR)
router.post('/2fa/setup', authenticateToken, sensitiveOpRateLimiter, TwoFactorController.setup);

// [POST] /api/v1/auth/2fa/enable -> Xác thực mã OTP đầu tiên để kích hoạt 2FA
router.post('/2fa/enable', authenticateToken, sensitiveOpRateLimiter, TwoFactorController.enable);

// [POST] /api/v1/auth/2fa/disable -> Tắt 2FA
router.post('/2fa/disable', authenticateToken, sensitiveOpRateLimiter, TwoFactorController.disable);

export { router as authRoutes };
