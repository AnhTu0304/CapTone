import { Router } from 'express';
import { AlertRuleController } from '../controllers/alertRule.controller';
import { AlertEventController } from '../controllers/alertEvent.controller';
import { authenticateToken } from '../middlewares/auth.middleware';
import { requireRoles } from '../middlewares/rbac.middleware';

export const alertRuleRoutes = Router();

// Toàn bộ API Alert Rule yêu cầu đăng nhập
alertRuleRoutes.use(authenticateToken);

// --- Sub-resource: Alert Events & Evaluation ---
// POST /api/v1/alert-rules/evaluate - Kích hoạt đánh giá quy tắc
alertRuleRoutes.post(
  '/evaluate',
  requireRoles('DEVOPS', 'SME_OWNER', 'ADMIN', 'SUPER_ADMIN'),
  AlertEventController.triggerEvaluation
);

// GET /api/v1/alert-rules/events - Danh sách sự kiện cảnh báo
alertRuleRoutes.get(
  '/events',
  requireRoles('VIEWER', 'USER', 'DEVOPS', 'SME_OWNER', 'ADMIN', 'SUPER_ADMIN'),
  AlertEventController.list
);

// GET /api/v1/alert-rules/events/summary - Tổng hợp sự kiện cảnh báo
alertRuleRoutes.get(
  '/events/summary',
  requireRoles('VIEWER', 'USER', 'DEVOPS', 'SME_OWNER', 'ADMIN', 'SUPER_ADMIN'),
  AlertEventController.getSummary
);

// GET /api/v1/alert-rules/events/:id - Xem chi tiết sự kiện cảnh báo
alertRuleRoutes.get(
  '/events/:id',
  requireRoles('VIEWER', 'USER', 'DEVOPS', 'SME_OWNER', 'ADMIN', 'SUPER_ADMIN'),
  AlertEventController.getById
);

// PATCH /api/v1/alert-rules/events/:id/acknowledge - Xác nhận sự kiện cảnh báo
alertRuleRoutes.patch(
  '/events/:id/acknowledge',
  requireRoles('DEVOPS', 'SME_OWNER', 'ADMIN', 'SUPER_ADMIN'),
  AlertEventController.acknowledge
);

// PATCH /api/v1/alert-rules/events/:id/resolve - Giải quyết sự kiện cảnh báo
alertRuleRoutes.patch(
  '/events/:id/resolve',
  requireRoles('DEVOPS', 'SME_OWNER', 'ADMIN', 'SUPER_ADMIN'),
  AlertEventController.resolve
);

// 1. GET /api/v1/alert-rules - Danh sách cấu hình cảnh báo
alertRuleRoutes.get(
  '/',
  requireRoles('VIEWER', 'USER', 'DEVOPS', 'SME_OWNER', 'ADMIN', 'SUPER_ADMIN'),
  AlertRuleController.list
);

// 1b. GET /api/v1/alert-rules/metadata - Danh sách metric_type, operator, unit được hỗ trợ
alertRuleRoutes.get(
  '/metadata',
  requireRoles('VIEWER', 'USER', 'DEVOPS', 'SME_OWNER', 'ADMIN', 'SUPER_ADMIN'),
  AlertRuleController.getMetadata
);

// 2. GET /api/v1/alert-rules/:id - Xem chi tiết cấu hình cảnh báo
alertRuleRoutes.get(
  '/:id',
  requireRoles('VIEWER', 'USER', 'DEVOPS', 'SME_OWNER', 'ADMIN', 'SUPER_ADMIN'),
  AlertRuleController.getById
);

// 3. POST /api/v1/alert-rules - Tạo mới cấu hình cảnh báo (Yêu cầu DEVOPS trở lên)
alertRuleRoutes.post(
  '/',
  requireRoles('DEVOPS', 'SME_OWNER', 'ADMIN', 'SUPER_ADMIN'),
  AlertRuleController.create
);

// 4. PUT /api/v1/alert-rules/:id - Cập nhật cấu hình cảnh báo
alertRuleRoutes.put(
  '/:id',
  requireRoles('DEVOPS', 'SME_OWNER', 'ADMIN', 'SUPER_ADMIN'),
  AlertRuleController.update
);

// Hỗ trợ PATCH /:id tương đương PUT
alertRuleRoutes.patch(
  '/:id',
  requireRoles('DEVOPS', 'SME_OWNER', 'ADMIN', 'SUPER_ADMIN'),
  AlertRuleController.update
);

// 5. PATCH /api/v1/alert-rules/:id/status - Bật / tắt cấu hình cảnh báo
alertRuleRoutes.patch(
  '/:id/status',
  requireRoles('DEVOPS', 'SME_OWNER', 'ADMIN', 'SUPER_ADMIN'),
  AlertRuleController.toggleStatus
);

// 6. DELETE /api/v1/alert-rules/:id - Xóa cấu hình cảnh báo
alertRuleRoutes.delete(
  '/:id',
  requireRoles('DEVOPS', 'SME_OWNER', 'ADMIN', 'SUPER_ADMIN'),
  AlertRuleController.delete
);
