import { Router } from 'express';
import { TelemetryController } from '../controllers/telemetry.controller';
import { authenticateToken } from '../middlewares/auth.middleware';

export const telemetryRoutes = Router();

// GET /api/v1/telemetry/live-summary
telemetryRoutes.get('/live-summary', TelemetryController.getLiveSummary);



// Protect telemetry routes with JWT authentication
telemetryRoutes.use(authenticateToken);

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
