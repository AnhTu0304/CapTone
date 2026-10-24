import { Router } from 'express';
import { AuditController } from '../controllers/audit.controller';
import { authenticateToken } from '../middlewares/auth.middleware';
import { requireRoles } from '../middlewares/rbac.middleware';

export const auditRoutes = Router();

// Platform Scope: Chỉ dành riêng cho SUPER_ADMIN và ADMIN hệ thống
auditRoutes.get(
  '/',
  authenticateToken,
  requireRoles('SUPER_ADMIN', 'ADMIN'),
  AuditController.getPlatformAuditLogs
);

// Retention Policy Stats: SUPER_ADMIN, ADMIN
auditRoutes.get(
  '/retention/stats',
  authenticateToken,
  requireRoles('SUPER_ADMIN', 'ADMIN'),
  AuditController.getRetentionStats
);

// Retention Purge Action: Chỉ SUPER_ADMIN
auditRoutes.post(
  '/retention/purge',
  authenticateToken,
  requireRoles('SUPER_ADMIN'),
  AuditController.triggerRetentionPurge
);
