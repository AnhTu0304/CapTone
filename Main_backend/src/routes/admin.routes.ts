import { Router } from 'express';
import { AdminDashboardController } from '../controllers/adminDashboard.controller';
import { AdminAnalyticsController } from '../controllers/adminAnalytics.controller';
import { AdminBroadcastController } from '../controllers/adminBroadcast.controller';
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

/**
 * [GET] /api/v1/admin/alerts/overview
 * Lấy tổng hợp cảnh báo nền tảng, tình trạng đứt kết nối tác tử và KPI sự cố (100% dữ liệu thực)
 */
router.get('/alerts/overview', AdminDashboardController.getAlertsOverview);

/**
 * [GET] /api/v1/admin/analytics/growth
 * Lấy dữ liệu thống kê tăng trưởng và danh sách doanh nghiệp thời gian thực
 */
router.get('/analytics/growth', AdminAnalyticsController.getGrowthAnalytics);

/**
 * [GET] /api/v1/admin/analytics/export
 * Xuất báo cáo dữ liệu tăng trưởng doanh nghiệp định dạng CSV an toàn
 */
router.get('/analytics/export', AdminAnalyticsController.exportGrowthCsv);

/**
 * [GET] /api/v1/admin/broadcasts
 * Lấy danh sách thông báo toàn mạng và cảnh báo hệ thống
 */
router.get('/broadcasts', AdminBroadcastController.getBroadcasts);

/**
 * [POST] /api/v1/admin/broadcasts
 * Phát sóng thông báo mới toàn mạng
 */
router.post('/broadcasts', AdminBroadcastController.createBroadcast);

/**
 * [DELETE] /api/v1/admin/broadcasts/:id
 * Gỡ bỏ thông báo toàn mạng
 */
router.delete('/broadcasts/:id', AdminBroadcastController.deleteBroadcast);

export const adminRoutes = router;
