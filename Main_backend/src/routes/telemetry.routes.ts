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

// Protect all following detailed telemetry routes with JWT authentication + DEVOPS/ADMIN role
telemetryRoutes.use(authenticateToken);
telemetryRoutes.use(requireRoles('DEVOPS', 'ADMIN'));

// GET /api/v1/telemetry/services/:serviceId/metrics-sequence
telemetryRoutes.get(
  '/services/:serviceId/metrics-sequence',
  TelemetryController.getMetricsSequence
);

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
