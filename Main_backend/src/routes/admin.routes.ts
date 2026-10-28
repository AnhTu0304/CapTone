import { Router } from 'express';
import { AdminDashboardController } from '../controllers/adminDashboard.controller';
import { authenticateToken } from '../middlewares/auth.middleware';
import { requireRoles } from '../middlewares/rbac.middleware';

const router = Router();

// Yêu cầu xác thực tài khoản và kiểm tra quyền Quản trị viên
router.use(authenticateToken);
router.use(requireRoles('SUPER_ADMIN', 'SYSTEM_ADMIN', 'ADMIN'));

/**
 * [GET] /api/v1/admin/dashboard/stats
 * Lấy các chỉ số KPI thời gian thực của toàn bộ nền tảng (Users, Agents, Clusters, Orgs,...)
 */
router.get('/dashboard/stats', AdminDashboardController.getKpiStats);

export const adminRoutes = router;
