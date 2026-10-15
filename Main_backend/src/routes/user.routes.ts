import { Router } from 'express';
import { UserController } from '../controllers/user.controller';
import { authenticateToken } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { 
  updateProfileSchema, 
  userIdParamSchema, 
  userQuerySchema, 
  changePasswordSchema 
} from '../validations';

import { SystemRoleController } from '../controllers/systemRole.controller';

const router = Router();

// Toàn bộ các route phía dưới đều yêu cầu đã đăng nhập (cần Token)
router.use(authenticateToken);

// [GET] /api/v1/users -> Lấy danh sách người dùng (kèm phân trang, lọc và tìm kiếm)
router.get('/', validate(userQuerySchema), UserController.getAllUsers);

// [GET] /api/v1/users/profile -> Xem thông tin tài khoản đang đăng nhập
router.get('/profile', UserController.getProfile);

// [PUT] /api/v1/users/profile -> Cập nhật họ tên, avatar của tài khoản hiện tại
router.put('/profile', validate(updateProfileSchema), UserController.updateProfile);

// [POST] /api/v1/users/change-password -> Đổi mật khẩu
router.post('/change-password', validate(changePasswordSchema), UserController.changePassword);

// [POST] /api/v1/users/send-verification -> Người dùng tự yêu cầu gửi lại email xác thực
router.post('/send-verification', UserController.sendVerificationEmail);

// [POST] /api/v1/users/verify-email -> Xác thực email bằng chính Token đăng nhập của người dùng (Không cần thuộc tính trong JSON)
router.post('/verify-email', UserController.verifyEmailByAuthToken);

// [PATCH] /api/v1/users/:id/verify-email -> Kích hoạt xác thực email người dùng theo ID (Quản trị viên)
router.patch('/:id/verify-email', validate(userIdParamSchema), UserController.verifyEmailById);

// [GET] /api/v1/users/:id/roles -> Xem danh sách vai trò của người dùng
router.get('/:id/roles', validate(userIdParamSchema), SystemRoleController.getUserRoles);

// [POST] /api/v1/users/:id/roles -> Cấp vai trò cho người dùng
router.post('/:id/roles', validate(userIdParamSchema), SystemRoleController.assignRole);

// [DELETE] /api/v1/users/:id/roles/:role -> Thu hồi vai trò của người dùng
router.delete('/:id/roles/:role', validate(userIdParamSchema), SystemRoleController.revokeRole);

// [GET] /api/v1/users/:id -> Xem chi tiết một người dùng theo ID (Đặt sau /profile để tránh nuốt route)
router.get('/:id', validate(userIdParamSchema), UserController.getUserById);

// [PUT] /api/v1/users/:id -> Cập nhật thông tin người dùng theo ID
router.put('/:id', validate(userIdParamSchema), validate(updateProfileSchema), UserController.updateUserById);

export { router as userRoutes };
