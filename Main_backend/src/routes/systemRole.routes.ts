import { Router } from 'express';
import { SystemRoleController } from '../controllers/systemRole.controller';
import { OrganizationController } from '../controllers/organization.controller';
import { authenticateToken } from '../middlewares/auth.middleware';

const router = Router();

// Yêu cầu xác thực tài khoản (Token) cho các API quản trị vai trò
router.use(authenticateToken);

// [GET] /api/v1/roles/organization -> Lấy danh mục vai trò cấp tổ chức (SME_OWNER, DEVOPS, VIEWER)
router.get('/organization', OrganizationController.getRoles);

// [GET] /api/v1/roles -> Lấy danh sách tất cả các vai trò quản trị hệ thống
router.get('/', SystemRoleController.getAllRoles);

// [GET] /api/v1/roles/users/:userId -> Lấy danh sách vai trò của một người dùng
router.get('/users/:userId', SystemRoleController.getUserRoles);

// [POST] /api/v1/roles/assign -> Gán vai trò cho người dùng
router.post('/assign', SystemRoleController.assignRole);

// [POST] /api/v1/roles/revoke -> Thu hồi vai trò của người dùng
router.post('/revoke', SystemRoleController.revokeRole);

// [DELETE] /api/v1/roles/revoke -> Thu hồi vai trò của người dùng
router.delete('/revoke', SystemRoleController.revokeRole);

export { router as systemRoleRoutes };
