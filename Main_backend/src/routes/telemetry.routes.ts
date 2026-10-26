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

// GET /api/v1/telemetry/services
// Danh sách các dịch vụ đang được giám sát APM kèm tổng hợp chỉ số
telemetryRoutes.get(
  '/services',
  authenticateToken,
  requireRoles('VIEWER', 'DEVOPS', 'ADMIN', 'USER'),
  TelemetryController.getApmServices
);

// GET /api/v1/telemetry/services/:serviceId/metrics-sequence
// Cho phép tất cả người dùng hợp lệ xem chuỗi viễn trắc để vẽ biểu đồ
telemetryRoutes.get(
  '/services/:serviceId/metrics-sequence',
  authenticateToken,
  requireRoles('VIEWER', 'DEVOPS', 'ADMIN', 'USER'),
  TelemetryController.getMetricsSequence
);

// GET /api/v1/telemetry/metrics-history
// Truy vấn lịch sử viễn trắc chi tiết theo resource, metric_type, time window, pagination (Task [S4][PB16] 2.1)
telemetryRoutes.get(
  '/metrics-history',
  authenticateToken,
  requireRoles('VIEWER', 'DEVOPS', 'ADMIN', 'USER'),
  TelemetryController.getMetricsHistory
);

// GET /api/v1/telemetry/logs
// Centralized logs querying with severity, service, search and time filters (Task [S4][PB17] 3.1)
telemetryRoutes.get(
  '/logs',
  authenticateToken,
  requireRoles('VIEWER', 'DEVOPS', 'ADMIN', 'USER'),
  TelemetryController.getLogs
);

// GET /api/v1/telemetry/services/:serviceId/metrics-history
telemetryRoutes.get(
  '/services/:serviceId/metrics-history',
  authenticateToken,
  requireRoles('VIEWER', 'DEVOPS', 'ADMIN', 'USER'),
  TelemetryController.getMetricsHistory
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
