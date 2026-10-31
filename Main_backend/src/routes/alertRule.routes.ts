import { Router } from 'express';
import { AlertRuleController } from '../controllers/alertRule.controller';
import { authenticateToken } from '../middlewares/auth.middleware';
import { requireRoles } from '../middlewares/rbac.middleware';

export const alertRuleRoutes = Router();

// Toàn bộ API Alert Rule yêu cầu đăng nhập
alertRuleRoutes.use(authenticateToken);

// 1. GET /api/v1/alert-rules - Danh sách cấu hình cảnh báo
alertRuleRoutes.get(
  '/',
  requireRoles('VIEWER', 'USER', 'DEVOPS', 'SME_OWNER', 'ADMIN', 'SUPER_ADMIN'),
  AlertRuleController.list
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
