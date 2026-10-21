import { Router } from 'express';
import { OrganizationController } from '../controllers/organization.controller';
import { OrganizationMemberController } from '../controllers/organizationMember.controller';
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
  orgIdParamSchema,
  orgQuerySchema,
} from '../validations/organization.validation';
import {
  inviteMemberSchema,
  updateMemberSchema,
  memberParamSchema,
  orgMemberIdOnlySchema,
  memberQuerySchema,
} from '../validations/organizationMember.validation';

const router = Router();

// Toàn bộ API Organizations đều yêu cầu xác thực JWT Bearer Token
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

export const organizationRoutes = router;
