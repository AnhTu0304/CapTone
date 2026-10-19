import { Router } from 'express';
import { SystemRoleController } from '../controllers/systemRole.controller';
import { authenticateToken } from '../middlewares/auth.middleware';
import { requireRoles } from '../middlewares/rbac.middleware';

const router = Router();

// Yêu cầu xác thực tài khoản (Token) cho các API quản trị vai trò
router.use(authenticateToken);

// [GET] /api/v1/roles -> Lấy danh sách tất cả các vai trò quản trị hệ thống (ADMIN hoặc SUPER_ADMIN)
router.get('/', requireRoles('ADMIN', 'SUPER_ADMIN'), SystemRoleController.getAllRoles);

// [GET] /api/v1/roles/users/:userId -> Lấy danh sách vai trò của một người dùng (ADMIN hoặc SUPER_ADMIN)
router.get('/users/:userId', requireRoles('ADMIN', 'SUPER_ADMIN'), SystemRoleController.getUserRoles);

// [POST] /api/v1/roles/assign -> Gán vai trò cho người dùng (Chỉ SUPER_ADMIN)
router.post('/assign', requireRoles('SUPER_ADMIN'), SystemRoleController.assignRole);

// [POST] /api/v1/roles/revoke -> Thu hồi vai trò của người dùng (Chỉ SUPER_ADMIN)
router.post('/revoke', requireRoles('SUPER_ADMIN'), SystemRoleController.revokeRole);

// [DELETE] /api/v1/roles/revoke -> Thu hồi vai trò của người dùng (Chỉ SUPER_ADMIN)
router.delete('/revoke', requireRoles('SUPER_ADMIN'), SystemRoleController.revokeRole);

export { router as systemRoleRoutes };
