import { Router } from 'express';
import { EnvironmentController } from '../controllers/environment.controller';
import { authenticateToken } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { requireOrgMember, requireOrgRole } from '../middlewares/orgAuth.middleware';
import {
  createEnvironmentSchema,
  updateEnvironmentSchema,
  envParamSchema,
  envQuerySchema,
} from '../validations/environment.validation';

// Cho phép router nhận param :orgId từ router cha
const router = Router({ mergeParams: true });

// Toàn bộ API Môi trường đều yêu cầu xác thực JWT
router.use(authenticateToken);

/**
 * [GET] /api/v1/organizations/:orgId/environments
 * Lấy danh sách môi trường thuộc tổ chức (hỗ trợ lọc DEV/STAGING, tìm kiếm, phân trang)
 * Quyền: Mọi thành viên hợp lệ (OWNER, DEVOPS, VIEWER)
 */
router.get(
  '/',
  requireOrgMember,
  validate(envQuerySchema),
  EnvironmentController.getByOrg
);

/**
 * [GET] /api/v1/organizations/:orgId/environments/summary
 * Thống kê tổng quan môi trường (phân bổ cụm K8s cho DEV và STAGING)
 * Quyền: Mọi thành viên hợp lệ
 */
router.get(
  '/summary',
  requireOrgMember,
  EnvironmentController.getSummary
);

/**
 * [POST] /api/v1/organizations/:orgId/environments
 * Tạo môi trường mới (chỉ chấp nhận 'DEVELOPMENT' hoặc 'STAGING')
 * Quyền: SME_OWNER hoặc DEVOPS của tổ chức
 */
router.post(
  '/',
  requireOrgMember,
  requireOrgRole('SME_OWNER', 'DEVOPS'),
  validate(createEnvironmentSchema),
  EnvironmentController.create
);

/**
 * [GET] /api/v1/organizations/:orgId/environments/:id
 * Xem chi tiết thông tin môi trường
 * Quyền: Mọi thành viên hợp lệ (SME_OWNER, DEVOPS, VIEWER)
 */
router.get(
  '/:id',
  requireOrgMember,
  validate(envParamSchema),
  EnvironmentController.getById
);

/**
 * [PUT] /api/v1/organizations/:orgId/environments/:id
 * Cập nhật môi trường (tên, mô tả, trạng thái, loại)
 * Quyền: SME_OWNER hoặc DEVOPS của tổ chức
 */
router.put(
  '/:id',
  requireOrgMember,
  requireOrgRole('SME_OWNER', 'DEVOPS'),
  validate(envParamSchema),
  validate(updateEnvironmentSchema),
  EnvironmentController.update
);

/**
 * [DELETE] /api/v1/organizations/:orgId/environments/:id
 * Xóa mềm môi trường (Soft Delete)
 * Quyền: Chỉ duy nhất SME_OWNER của tổ chức
 */
router.delete(
  '/:id',
  requireOrgMember,
  requireOrgRole('SME_OWNER'),
  validate(envParamSchema),
  EnvironmentController.delete
);

export const environmentRoutes = router;
