import { Router } from 'express';
import { OrganizationController } from '../controllers/organization.controller';
import { AuditController } from '../controllers/audit.controller';
import { OrganizationModel } from '../models/organization.model';
import { OrganizationMemberController } from '../controllers/organizationMember.controller';
import { OrganizationInvitationController } from '../controllers/organizationInvitation.controller';
import { authenticateToken } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import {
  requireOrgMember,
  requireOrgRole,
  requireOrgSelfOrOwner,
} from '../middlewares/orgAuth.middleware';
import {
  createOrganizationSchema,
  updateOrganizationSchema,
  updateOrgStatusSchema,
  orgIdParamSchema,
  orgQuerySchema,
} from '../validations/organization.validation';
import {
  inviteMemberSchema,
  updateMemberSchema,
  memberParamSchema,
  orgMemberIdOnlySchema,
  memberQuerySchema,
  acceptInvitationByTokenSchema,
  invitationParamSchema,
  invitationQuerySchema,
} from '../validations/organizationMember.validation';
import { environmentRoutes } from './environment.routes';
import { agentRoutes } from './agent.routes';
import { clusterRoutes } from './cluster.routes';

const router = Router();

/**
 * [GET] /api/v1/organizations/check-slug/:slug
 * Kiểm tra ràng buộc duy nhất của Slug (Public / Tiện ích xác thực)
 */
router.get(
  '/check-slug/:slug',
  async (req, res, next) => {
    try {
      const slug = (req.params.slug || '').trim().toLowerCase();
      const existing = await OrganizationModel.findBySlug(slug);
      return res.json({
        success: true,
        message: existing ? 'Slug đã được sử dụng' : 'Slug khả dụng',
        data: {
          slug,
          available: !existing,
          exists: !!existing,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// Toàn bộ API Organizations phía sau đều yêu cầu xác thực JWT Bearer Token
router.use(authenticateToken);

/* ==========================================================================
   1. CÁC ĐƯỜNG DẪN TỔ CHỨC CỦA NGƯỜI DÙNG (USER WORKSPACE CONTEXT - MODULE 3)
   (Đặt trước các route /:id để tránh bị nuốt param)
   ========================================================================== */

/**
 * [GET] /api/v1/organizations/me/list - Danh sách các tổ chức của user hiện tại
 */
router.get(
  '/me/list',
  OrganizationController.getMyOrganizations
);

/**
 * [GET] /api/v1/organizations/me/invitations - Danh sách lời mời đang chờ user chấp nhận
 */
router.get(
  '/me/invitations',
  OrganizationController.getMyInvitations
);

/**
 * [POST] /api/v1/organizations/invitations/accept - Chấp nhận lời mời tham gia tổ chức bằng Token
 */
router.post(
  '/invitations/accept',
  validate(acceptInvitationByTokenSchema),
  OrganizationInvitationController.acceptInvitationByToken
);

/**
 * [GET] /api/v1/organizations/roles - Lấy danh mục các vai trò tổ chức khả dụng (SME_OWNER, DEVOPS, VIEWER)
 */
router.get(
  '/roles',
  OrganizationController.getRoles
);



/* ==========================================================================
   2. CÁC ĐƯỜNG DẪN TỔ CHỨC & HỒ SƠ (MODULE 1)
   ========================================================================== */

/**
 * [POST] /api/v1/organizations - Tạo tổ chức mới kèm profile
 */
router.post(
  '/',
  validate(createOrganizationSchema),
  OrganizationController.create
);

/**
 * [GET] /api/v1/organizations - Lấy danh sách tổ chức (phân trang & tìm kiếm)
 */
router.get(
  '/',
  validate(orgQuerySchema),
  OrganizationController.getAll
);

/**
 * [GET] /api/v1/organizations/:id - Xem chi tiết tổ chức & profile
 * Bảo vệ: Chỉ thành viên tổ chức hoặc SUPER_ADMIN mới được xem
 */
router.get(
  '/:id',
  validate(orgIdParamSchema),
  requireOrgMember,
  OrganizationController.getById
);

/**
 * [PUT] /api/v1/organizations/:id - Cập nhật thông tin tổ chức & profile
 * Bảo vệ: Chỉ SME_OWNER của tổ chức hoặc SUPER_ADMIN mới có quyền cập nhật
 */
router.put(
  '/:id',
  validate(orgIdParamSchema),
  validate(updateOrganizationSchema),
  requireOrgRole('SME_OWNER'),
  OrganizationController.update
);

/**
 * [PATCH] /api/v1/organizations/:id/status - Khóa / Mở khóa / Vô hiệu hóa tổ chức ([2.12])
 * Bảo vệ: Yêu cầu đăng nhập, kiểm tra thẩm quyền tại Service (SUPER_ADMIN, ADMIN hoặc SME_OWNER của tổ chức)
 */
router.patch(
  '/:id/status',
  validate(orgIdParamSchema),
  validate(updateOrgStatusSchema),
  OrganizationController.updateStatus
);

/**
 * [DELETE] /api/v1/organizations/:id - Xóa tổ chức (Soft delete)
 * Bảo vệ: Chỉ SME_OWNER của tổ chức hoặc SUPER_ADMIN mới có quyền xóa
 */
router.delete(
  '/:id',
  validate(orgIdParamSchema),
  requireOrgRole('SME_OWNER'),
  OrganizationController.delete
);

/* ==========================================================================
   3. CÁC ĐƯỜNG DẪN THÀNH VIÊN TỔ CHỨC (MODULE 2 & 3)
   ========================================================================== */

/**
 * [GET] /api/v1/organizations/:id/members - Lấy danh sách thành viên trong tổ chức
 * Bảo vệ: Chỉ thành viên tổ chức hoặc SUPER_ADMIN mới được xem
 */
router.get(
  '/:id/members',
  validate(memberQuerySchema),
  requireOrgMember,
  OrganizationMemberController.getMembers
);

/**
 * [POST] /api/v1/organizations/:id/members/invite - Mời thành viên mới vào tổ chức
 * Bảo vệ: Chỉ SME_OWNER của tổ chức hoặc SUPER_ADMIN mới có quyền mời
 */
router.post(
  '/:id/members/invite',
  validate(inviteMemberSchema),
  requireOrgRole('SME_OWNER'),
  OrganizationMemberController.inviteMember
);

/**
 * [POST] /api/v1/organizations/:id/members/accept - Chấp nhận lời mời tham gia tổ chức
 * Người nhận lời mời tự gọi API này bằng token của chính mình
 */
router.post(
  '/:id/members/accept',
  validate(orgMemberIdOnlySchema),
  OrganizationMemberController.acceptInvitation
);

/**
 * [PUT] /api/v1/organizations/:id/members/:userId - Cập nhật vai trò / trạng thái thành viên
 * Bảo vệ: Chỉ SME_OWNER của tổ chức hoặc SUPER_ADMIN mới có quyền cập nhật
 */
router.put(
  '/:id/members/:userId',
  validate(updateMemberSchema),
  requireOrgRole('SME_OWNER'),
  OrganizationMemberController.updateMember
);

/**
 * [DELETE] /api/v1/organizations/:id/members/:userId - Xóa / Loại bỏ thành viên khỏi tổ chức
 * Bảo vệ: Chỉ SME_OWNER của tổ chức HOẶC chính thành viên đó tự rời khỏi tổ chức
 */
router.delete(
  '/:id/members/:userId',
  validate(memberParamSchema),
  requireOrgSelfOrOwner,
  OrganizationMemberController.removeMember
);

/**
 * [GET] /api/v1/organizations/:id/invitations - Lấy danh sách lời mời của tổ chức
 * Bảo vệ: Chỉ SME_OWNER hoặc SUPER_ADMIN
 */
router.get(
  '/:id/invitations',
  validate(invitationQuerySchema),
  requireOrgRole('SME_OWNER'),
  OrganizationInvitationController.listInvitations
);

/**
 * [POST] /api/v1/organizations/:id/invitations - Tạo lời mời thành viên vào tổ chức
 * Bảo vệ: Chỉ SME_OWNER hoặc SUPER_ADMIN
 */
router.post(
  '/:id/invitations',
  validate(inviteMemberSchema),
  requireOrgRole('SME_OWNER'),
  OrganizationInvitationController.createInvitation
);

/**
 * [DELETE] /api/v1/organizations/:id/invitations/:invitationId - Thu hồi lời mời
 * Bảo vệ: Chỉ SME_OWNER hoặc SUPER_ADMIN
 */
router.delete(
  '/:id/invitations/:invitationId',
  validate(invitationParamSchema),
  requireOrgRole('SME_OWNER'),
  OrganizationInvitationController.revokeInvitation
);

/**
 * [POST] /api/v1/organizations/:id/invitations/:invitationId/resend - Gửi lại lời mời
 * Bảo vệ: Chỉ SME_OWNER hoặc SUPER_ADMIN
 */
router.post(
  '/:id/invitations/:invitationId/resend',
  validate(invitationParamSchema),
  requireOrgRole('SME_OWNER'),
  OrganizationInvitationController.resendInvitation
);

/* ==========================================================================
   4. CÁC ĐƯỜNG DẪN MÔI TRƯỜNG THUỘC TỔ CHỨC (DEV & STAGING)
   ========================================================================== */
router.use('/:orgId/environments', environmentRoutes);
router.use('/:id/environments', environmentRoutes);

/* ==========================================================================
   5. CÁC ĐƯỜNG DẪN AGENT THUỘC TỔ CHỨC
   ========================================================================== */
router.use('/:orgId/agents', agentRoutes);
router.use('/:id/agents', agentRoutes);

router.use('/:orgId/clusters', clusterRoutes);
router.use('/:id/clusters', clusterRoutes);

router.get(
  '/:id/audit-logs',
  requireOrgMember,
  requireOrgRole('SME_OWNER', 'DEVOPS'),
  AuditController.getOrganizationAuditLogs
);
router.get(
  '/:orgId/audit-logs',
  requireOrgMember,
  requireOrgRole('SME_OWNER', 'DEVOPS'),
  AuditController.getOrganizationAuditLogs
);

export const organizationRoutes = router;
