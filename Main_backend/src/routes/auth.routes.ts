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
  updateProfileSchema 
} from '../validations';

import { authRateLimiter, sensitiveOpRateLimiter } from '../middlewares/rateLimit.middleware';

const router = Router();

// [POST] /api/v1/auth/register -> Đăng ký tài khoản (Validate body + Rate limit)
router.post('/register', authRateLimiter, validate(registerSchema), AuthController.register);

// [POST] /api/v1/auth/login -> Đăng nhập (Validate body + Rate limit)
router.post('/login', authRateLimiter, validate(loginSchema), AuthController.login);

// [POST] /api/v1/auth/login/2fa -> Xác thực OTP 2FA để hoàn tất đăng nhập
router.post('/login/2fa', authRateLimiter, AuthController.verify2FALogin);

// [POST] /api/v1/auth/logout -> Đăng xuất và thu hồi Token
router.post('/logout', authenticateToken, AuthController.logout);

// [POST] /api/v1/auth/google -> Đăng nhập bằng Google OAuth (Rate limit)
router.post('/google', authRateLimiter, AuthController.googleLogin);

// [GET] /api/v1/auth/me -> Lấy thông tin user hiện tại (Yêu cầu Token)
router.get('/me', authenticateToken, AuthController.me);

// [PUT] /api/v1/auth/me -> Cập nhật thông tin user hiện tại (Yêu cầu Token & Validate body)
router.put('/me', authenticateToken, validate(updateProfileSchema), UserController.updateProfile);

// [POST] /api/v1/auth/change-password -> Đổi mật khẩu (Yêu cầu Token, Validate body & Rate limit)
router.post('/change-password', authenticateToken, sensitiveOpRateLimiter, validate(changePasswordSchema), AuthController.changePassword);

// [POST & GET] /api/v1/auth/verify-email -> Xác thực tài khoản bằng mã gửi về email
router.post('/verify-email', validate(verifyEmailSchema), AuthController.verifyEmail);
router.get('/verify-email', validate(verifyEmailSchema), AuthController.verifyEmail);

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
