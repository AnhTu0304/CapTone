import { Router } from 'express';
import { TelemetryController } from '../controllers/telemetry.controller';
import { authenticateToken } from '../middlewares/auth.middleware';
import { requireRoles } from '../middlewares/rbac.middleware';

export const telemetryRoutes = Router();

// GET /api/v1/telemetry/live-summary
// Endpoint tổng quan: cho phép tất cả người dùng hợp lệ (kể cả Viewer) truy cập
telemetryRoutes.get(
  '/live-summary',
  authenticateToken,
  requireRoles('VIEWER', 'DEVOPS', 'ADMIN', 'USER'),
  TelemetryController.getLiveSummary
);

// GET /api/v1/telemetry/node-metrics
telemetryRoutes.get(
  '/node-metrics',
  authenticateToken,
  requireRoles('VIEWER', 'DEVOPS', 'ADMIN', 'USER'),
  TelemetryController.getNodeMetrics
);

// GET /api/v1/telemetry/services/:serviceId/metrics-sequence
// Cho phép tất cả người dùng hợp lệ xem chuỗi viễn trắc để vẽ biểu đồ
telemetryRoutes.get(
  '/services/:serviceId/metrics-sequence',
  authenticateToken,
  requireRoles('VIEWER', 'DEVOPS', 'ADMIN', 'USER'),
  TelemetryController.getMetricsSequence
);

// Protect all following sensitive operations with JWT authentication + DEVOPS/ADMIN role
telemetryRoutes.use(authenticateToken);
telemetryRoutes.use(requireRoles('VIEWER', 'USER', 'DEVOPS', 'ADMIN'));

// GET /api/v1/telemetry/services/:serviceId/rca-context
telemetryRoutes.get(
  '/services/:serviceId/rca-context',
  TelemetryController.getRcaContext
);

// POST /api/v1/telemetry/services/:serviceId/evaluate
telemetryRoutes.post(
  '/services/:serviceId/evaluate',
  TelemetryController.evaluateService
);
