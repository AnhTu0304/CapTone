import { Router } from 'express';
import { UserController } from '../controllers/user.controller';
import { authenticateToken } from '../middlewares/auth.middleware';
import { requireRoles, requireSelfOrAdmin } from '../middlewares/rbac.middleware';
import { sensitiveOpRateLimiter } from '../middlewares/rateLimit.middleware';
import { validate } from '../middlewares/validate.middleware';
import { 
  updateProfileSchema, 
  userIdParamSchema, 
  userQuerySchema, 
  changePasswordSchema 
} from '../validations';

import { SystemRoleController } from '../controllers/systemRole.controller';
import { OrganizationController } from '../controllers/organization.controller';

const router = Router();

// Toàn bộ các route phía dưới đều yêu cầu đã đăng nhập (cần Token)
router.use(authenticateToken);

// [GET] /api/v1/users/me -> Xem thông tin hồ sơ của người dùng đang đăng nhập
router.get('/me', UserController.getMe);

// [GET] /api/v1/users/me/organizations -> Lấy danh sách các tổ chức mà người dùng đang tham gia
router.get('/me/organizations', OrganizationController.getMyOrganizations);

// [GET] /api/v1/users/me/invitations -> Lấy danh sách các lời mời đang chờ chấp nhận
router.get('/me/invitations', OrganizationController.getMyInvitations);

// [GET] /api/v1/users -> Lấy danh sách người dùng (chỉ ADMIN hoặc SUPER_ADMIN)
router.get('/', requireRoles('ADMIN', 'SUPER_ADMIN'), validate(userQuerySchema), UserController.getAllUsers);

// [GET] /api/v1/users/profile -> Xem thông tin tài khoản đang đăng nhập
router.get('/profile', UserController.getProfile);

// [PUT] /api/v1/users/profile -> Cập nhật họ tên, avatar của tài khoản hiện tại
router.put('/profile', validate(updateProfileSchema), UserController.updateProfile);

// [POST] /api/v1/users/change-password -> Đổi mật khẩu
router.post('/change-password', sensitiveOpRateLimiter, validate(changePasswordSchema), UserController.changePassword);

// [POST] /api/v1/users/send-verification -> Người dùng tự yêu cầu gửi lại email xác thực
router.post('/send-verification', sensitiveOpRateLimiter, UserController.sendVerificationEmail);

// [POST] /api/v1/users/verify-email -> Xác thực email bằng chính Token đăng nhập của người dùng (Không cần thuộc tính trong JSON)
router.post('/verify-email', UserController.verifyEmailByAuthToken);

// [PATCH] /api/v1/users/:id/verify-email -> Kích hoạt xác thực email người dùng theo ID (Quản trị viên ADMIN / SUPER_ADMIN)
router.patch('/:id/verify-email', requireRoles('ADMIN', 'SUPER_ADMIN'), validate(userIdParamSchema), UserController.verifyEmailById);

// [GET] /api/v1/users/:id/roles -> Xem danh sách vai trò của người dùng (ADMIN / SUPER_ADMIN)
router.get('/:id/roles', requireRoles('ADMIN', 'SUPER_ADMIN'), validate(userIdParamSchema), SystemRoleController.getUserRoles);

// [POST] /api/v1/users/:id/roles -> Cấp vai trò cho người dùng (Chỉ SUPER_ADMIN)
router.post('/:id/roles', requireRoles('SUPER_ADMIN'), validate(userIdParamSchema), SystemRoleController.assignRole);

// [DELETE] /api/v1/users/:id/roles/:role -> Thu hồi vai trò của người dùng (Chỉ SUPER_ADMIN)
router.delete('/:id/roles/:role', requireRoles('SUPER_ADMIN'), validate(userIdParamSchema), SystemRoleController.revokeRole);

// [GET] /api/v1/users/:id -> Xem chi tiết một người dùng theo ID (Chính chủ hoặc ADMIN/SUPER_ADMIN)
router.get('/:id', validate(userIdParamSchema), requireSelfOrAdmin((req) => req.params.id), UserController.getUserById);

// [PUT] /api/v1/users/:id -> Cập nhật thông tin người dùng theo ID (Chính chủ hoặc ADMIN/SUPER_ADMIN)
router.put('/:id', validate(userIdParamSchema), requireSelfOrAdmin((req) => req.params.id), validate(updateProfileSchema), UserController.updateUserById);

export { router as userRoutes };
