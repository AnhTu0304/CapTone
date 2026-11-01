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

// 2. GET /api/v1/alert-events - List alert events with pagination & filters
alertEventRoutes.get(
  '/',
  requireRoles('VIEWER', 'USER', 'DEVOPS', 'SME_OWNER', 'ADMIN', 'SUPER_ADMIN'),
  AlertEventController.list
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
