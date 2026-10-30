import { Router } from 'express';
import { StatisticsController } from '../controllers/statistics.controller';
import { authenticateToken } from '../middlewares/auth.middleware';

const router = Router();

// Tất cả các endpoint thống kê đều yêu cầu đăng nhập hợp lệ
router.use(authenticateToken);

/**
 * GET /api/v1/statistics/overview
 * Thống kê tổng hợp: KPIs, Incidents, Remediations, Telemetry, Activities
 */
router.get('/overview', StatisticsController.getOverview);

export { router as statisticsRoutes };
