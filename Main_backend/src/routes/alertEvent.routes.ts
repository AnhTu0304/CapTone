import { Router } from 'express';
import { AlertEventController } from '../controllers/alertEvent.controller';
import { authenticateToken } from '../middlewares/auth.middleware';
import { requireRoles } from '../middlewares/rbac.middleware';

export const alertEventRoutes = Router();

// All alert event routes require authentication
alertEventRoutes.use(authenticateToken);

// 1. POST /api/v1/alert-events/evaluate - Manually trigger rule engine evaluation cycle (DevOps/Admin)
alertEventRoutes.post(
  '/evaluate',
  requireRoles('DEVOPS', 'SME_OWNER', 'ADMIN', 'SUPER_ADMIN'),
  AlertEventController.triggerEvaluation
);

// 1b. POST /api/v1/alerts/demo-ingest - Dev/Test fixture telemetry ingestion & evaluation adapter
alertEventRoutes.post(
  '/demo-ingest',
  requireRoles('DEVOPS', 'SME_OWNER', 'ADMIN', 'SUPER_ADMIN'),
  AlertEventController.demoIngest
);

// 1c. GET /api/v1/alerts/history - List paginated alert history with filters (PBI22 Task 4.2)
alertEventRoutes.get(
  '/history',
  requireRoles('VIEWER', 'USER', 'DEVOPS', 'SME_OWNER', 'ADMIN', 'SUPER_ADMIN'),
  AlertEventController.getHistory
);

// 1d. GET /api/v1/alerts/history/summary - Summary metrics for alert history (PBI22 Task 4.2)
alertEventRoutes.get(
  '/history/summary',
  requireRoles('VIEWER', 'USER', 'DEVOPS', 'SME_OWNER', 'ADMIN', 'SUPER_ADMIN'),
  AlertEventController.getHistorySummary
);

// 1e. GET /api/v1/alerts/history/:id/timeline - Chronological timeline of alert status changes (PBI22 Task 4.2)
alertEventRoutes.get(
  '/history/:id/timeline',
  requireRoles('VIEWER', 'USER', 'DEVOPS', 'SME_OWNER', 'ADMIN', 'SUPER_ADMIN'),
  AlertEventController.getTimeline
);

// 1e-2. GET /api/v1/alerts/history/:id/audit-trail - Paginated audit trail (PBI22 Task 4.3)
alertEventRoutes.get(
  '/history/:id/audit-trail',
  requireRoles('VIEWER', 'USER', 'DEVOPS', 'SME_OWNER', 'ADMIN', 'SUPER_ADMIN'),
  AlertEventController.getAuditTrail
);

// 1f. GET /api/v1/alerts/history/:id - Alert history detail by ID (PBI22 Task 4.2)
alertEventRoutes.get(
  '/history/:id',
  requireRoles('VIEWER', 'USER', 'DEVOPS', 'SME_OWNER', 'ADMIN', 'SUPER_ADMIN'),
  AlertEventController.getHistoryById
);

// 1g. GET /api/v1/alerts/:id/timeline - Alias for timeline endpoint
alertEventRoutes.get(
  '/:id/timeline',
  requireRoles('VIEWER', 'USER', 'DEVOPS', 'SME_OWNER', 'ADMIN', 'SUPER_ADMIN'),
  AlertEventController.getTimeline
);

// 1h. GET /api/v1/alerts/:id/audit-trail - Paginated audit trail for alert event (PBI22 Task 4.3)
alertEventRoutes.get(
  '/:id/audit-trail',
  requireRoles('VIEWER', 'USER', 'DEVOPS', 'SME_OWNER', 'ADMIN', 'SUPER_ADMIN'),
  AlertEventController.getAuditTrail
);

// 2. GET /api/v1/alert-events - List alert events with pagination & filters
alertEventRoutes.get(
  '/',
  requireRoles('VIEWER', 'USER', 'DEVOPS', 'SME_OWNER', 'ADMIN', 'SUPER_ADMIN'),
  AlertEventController.list
);

// 2b. GET /api/v1/alert-events/summary - Dashboard alert summary metrics
alertEventRoutes.get(
  '/summary',
  requireRoles('VIEWER', 'USER', 'DEVOPS', 'SME_OWNER', 'ADMIN', 'SUPER_ADMIN'),
  AlertEventController.getSummary
);

// 3. GET /api/v1/alert-events/:id - Get alert event details by ID
alertEventRoutes.get(
  '/:id',
  requireRoles('VIEWER', 'USER', 'DEVOPS', 'SME_OWNER', 'ADMIN', 'SUPER_ADMIN'),
  AlertEventController.getById
);

// 4. PATCH /api/v1/alert-events/:id/acknowledge - Acknowledge active alert event
alertEventRoutes.patch(
  '/:id/acknowledge',
  requireRoles('DEVOPS', 'SME_OWNER', 'ADMIN', 'SUPER_ADMIN'),
  AlertEventController.acknowledge
);

// 5. PATCH /api/v1/alert-events/:id/resolve - Manually resolve alert event
alertEventRoutes.patch(
  '/:id/resolve',
  requireRoles('DEVOPS', 'SME_OWNER', 'ADMIN', 'SUPER_ADMIN'),
  AlertEventController.resolve
);

// 6. PATCH /api/v1/alerts/:id/assign - Assign or reassign alert owner (PBI22 Task 4.3)
alertEventRoutes.patch(
  '/:id/assign',
  requireRoles('DEVOPS', 'SME_OWNER', 'ADMIN', 'SUPER_ADMIN'),
  AlertEventController.assign
);

// 7. PATCH /api/v1/alerts/:id/unassign - Unassign alert owner (PBI22 Task 4.3)
alertEventRoutes.patch(
  '/:id/unassign',
  requireRoles('DEVOPS', 'SME_OWNER', 'ADMIN', 'SUPER_ADMIN'),
  AlertEventController.unassign
);
