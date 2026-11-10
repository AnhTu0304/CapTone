import { Router } from 'express';
import { ReportController } from '../controllers/report.controller';
import { authenticateToken } from '../middlewares/auth.middleware';

const router = Router();

// Yêu cầu xác thực tài khoản JWT
router.use(authenticateToken);

// [GET] /api/v1/reports/organization-sla -> Báo cáo SLA, Sự cố và Biến động hệ thống
router.get('/organization-sla', ReportController.getOrganizationSLAReport);

// [GET] /api/v1/reports/action-analytics -> Báo cáo Action theo AI/Người, Thời gian, Kết quả & Nguyên nhân lỗi
router.get('/action-analytics', ReportController.getActionAnalyticsReport);

export { router as reportRoutes };
