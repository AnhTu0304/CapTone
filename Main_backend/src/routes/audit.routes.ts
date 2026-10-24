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
