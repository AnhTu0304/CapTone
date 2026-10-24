import { ApiError } from '../utils/apiError';
import {
  IOrganizationMemberDetail,
  IInviteMemberDto,
  IUpdateMemberDto,
  IMemberQuery,
  OrganizationMemberModel,
} from '../models/organizationMember.model';
import { OrganizationModel } from '../models/organization.model';
import { AuditService } from './audit.service';
import { OrganizationRoleModel } from '../models/organizationRole.model';
import { IPaginatedResult } from '../models/user.model';
import { EmailQueue } from './emailQueue.service';
import { SessionRevocationService } from './sessionRevocation.service';
import { OrganizationInvitationService } from './organizationInvitation.service';
import { OrganizationInvitationModel } from '../models/organizationInvitation.model';
import { pool } from '../config/database';

/**
 * Service xử lý logic nghiệp vụ cho Thành viên Tổ chức (Organization Members)
 * Ủy thác toàn bộ thao tác cơ sở dữ liệu cho OrganizationMemberModel, OrganizationModel, OrganizationRoleModel
 */
export class OrganizationMemberService {
  /**
   * Helper kiểm tra xem người dùng có quyền quản trị tối cao hoặc là SME_OWNER của tổ chức không
   */
  private static async isSuperAdminOrOwner(
    orgId: string,
    userId: string,
    userRoles: string[] = []
  ): Promise<boolean> {
    const normalized = userRoles.map((r) => r.toUpperCase());
    if (normalized.includes('SUPER_ADMIN')) {
      return true;
    }

    const member = await OrganizationMemberModel.findUserRoleInOrg(orgId, userId);
    return member?.role_code === 'SME_OWNER';
  }

  /**
   * 1. Lấy danh sách thành viên trong tổ chức (Kèm phân trang, lọc status, vai trò, tìm kiếm)
   */
  public static async getMembers(
    orgId: string,
    currentUserId: string,
    currentUserRoles: string[] = [],
    query: IMemberQuery = {}
  ): Promise<IPaginatedResult<IOrganizationMemberDetail>> {
    // 1. Kiểm tra tổ chức tồn tại
    const org = await OrganizationModel.findById(orgId);
    if (!org) {
      throw new ApiError(404, 'Không tìm thấy tổ chức');
    }

    // 2. Kiểm tra quyền truy cập (Admin hệ thống hoặc thành viên trong tổ chức)
    const normalizedRoles = currentUserRoles.map((r) => r.toUpperCase());
    const isSystemAdmin = normalizedRoles.some((r) =>
      ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'ADMIN'].includes(r)
    );

    if (!isSystemAdmin) {
      const member = await OrganizationMemberModel.findByOrgAndUser(orgId, currentUserId);
      if (!member || member.status === 'REMOVED') {
        throw new ApiError(403, 'Bạn không có quyền xem danh sách thành viên của tổ chức này');
      }
    }

    const page = Math.max(1, query.page || 1);
    const limit = Math.max(1, Math.min(100, query.limit || 20));
    const offset = (page - 1) * limit;

    const filter = {
      search: query.search,
      status: query.status,
      role: query.role,
      limit,
      offset,
    };

    // 3. Đếm tổng số lượng thành viên qua OrganizationMemberModel
    const total = await OrganizationMemberModel.countByOrg(orgId, filter);

    // 4. Lấy danh sách thành viên chi tiết qua OrganizationMemberModel
    const items = await OrganizationMemberModel.findManyByOrg(orgId, filter);

    return {
      items,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * 2. Mời thành viên mới vào tổ chức qua Email
   * Tích hợp với OrganizationInvitationService để sinh token bảo mật, lưu hạn dùng và enqueue email
   */
  public static async inviteMember(
    orgId: string,
    currentUserId: string,
    currentUserRoles: string[] = [],
    dto: IInviteMemberDto
  ): Promise<IOrganizationMemberDetail & { token?: string }> {
    const result = await OrganizationInvitationService.createInvitation(
      orgId,
      currentUserId,
      currentUserRoles,
      {
        email: dto.email,
        role_code: dto.role_code,
      }
    );

    const targetUser = await OrganizationMemberModel.findUserByEmail(dto.email.trim());

    return {
      id: result.invitation.id,
      organization_id: orgId,
      user: {
        id: targetUser?.id || result.invitation.id,
        email: result.invitation.email,
        full_name: targetUser?.full_name || dto.email.split('@')[0],
        avatar_url: targetUser?.avatar_url || null,
        status: targetUser?.status || 'PENDING',
      },
      role: result.invitation.role,
      status: 'INVITED',
      inviter: result.invitation.invited_by || null,
      joined_at: null,
      created_at: result.invitation.created_at,
      updated_at: result.invitation.created_at,
      token: result.token,
    };
  }

  /**
   * 3. Chấp nhận lời mời tham gia tổ chức
   * Bản thân người dùng được mời thực hiện gọi API này
   */
  public static async acceptInvitation(
    orgId: string,
    currentUserId: string
  ): Promise<{ message: string; organization_id: string; role_code: string; joined_at: Date }> {
    const user = await OrganizationMemberModel.findUserById(currentUserId);
    if (!user) {
      throw new ApiError(401, 'Không tìm thấy thông tin tài khoản người dùng');
    }

    const memberInvite = await OrganizationMemberModel.findPendingInvite(orgId, currentUserId);
    const invitationRecord = await OrganizationInvitationModel.findPendingByEmailAndOrg(user.email, orgId);

    if (!memberInvite && !invitationRecord) {
      throw new ApiError(404, 'Không tìm thấy lời mời đang chờ nào cho tài khoản của bạn tại tổ chức này');
    }

    const org = await OrganizationModel.findById(orgId);
    const orgName = org?.name || memberInvite?.org_name || 'Tổ chức';
    const roleId =
      invitationRecord?.role_id ||
      (await OrganizationMemberModel.findByOrgAndUser(orgId, currentUserId))?.role_id;

    const client = await pool.connect();
    let joinedAt = new Date();

    try {
      await client.query('BEGIN');

      if (invitationRecord) {
        await OrganizationInvitationModel.acceptAtomic(invitationRecord.id, currentUserId, client);
      }

      const upsertMemberQuery = `
        INSERT INTO organization_members (
          organization_id, user_id, role_id, status, invited_by, joined_at, created_at, updated_at
        ) VALUES (
          $1, $2, $3, 'ACTIVE', $4, NOW(), NOW(), NOW()
        )
        ON CONFLICT (organization_id, user_id)
        DO UPDATE SET 
          role_id = COALESCE(EXCLUDED.role_id, organization_members.role_id),
          status = 'ACTIVE',
          joined_at = NOW(),
          updated_at = NOW()
        RETURNING joined_at;
      `;

      const memberRes = await client.query(upsertMemberQuery, [
        orgId,
        currentUserId,
        roleId,
        invitationRecord?.invited_by || null,
      ]);

      if (memberRes.rows[0]?.joined_at) {
        joinedAt = memberRes.rows[0].joined_at;
      }

      await client.query('COMMIT');
      await SessionRevocationService.revokeUserOrgSessions(orgId, currentUserId);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    const role = roleId ? await OrganizationRoleModel.findById(roleId) : null;

    return {
      message: `Chào mừng bạn gia nhập tổ chức ${orgName}!`,
      organization_id: orgId,
      role_code: role?.code || memberInvite?.role_code || 'DEVOPS',
      joined_at: joinedAt,
    };
  }

  /**
   * 4. Cập nhật vai trò hoặc trạng thái của thành viên trong tổ chức
   * Chỉ SME_OWNER của tổ chức hoặc SUPER_ADMIN mới có quyền
   * Thu hồi phiên làm việc / quyền cũ ngay lập tức (Session & Access Revocation)
   */
  public static async updateMember(
    orgId: string,
    targetUserId: string,
    currentUserId: string,
    currentUserRoles: string[] = [],
    dto: IUpdateMemberDto
  ): Promise<IOrganizationMemberDetail> {
    const hasPermission = await this.isSuperAdminOrOwner(orgId, currentUserId, currentUserRoles);
    if (!hasPermission) {
      throw new ApiError(403, 'Chỉ Chủ sở hữu (SME Owner) hoặc Quản trị viên tối cao mới có quyền cập nhật thành viên');
    }

    // Kiểm tra thành viên mục tiêu qua OrganizationMemberModel
    const currentMember = await OrganizationMemberModel.findByOrgAndUser(orgId, targetUserId);

    if (!currentMember) {
      throw new ApiError(404, 'Thành viên này không tồn tại trong tổ chức');
    }

    // Bảo vệ: Tuyệt đối không cho phép gán vai trò hệ thống (SUPER_ADMIN, ADMIN) cho thành viên tổ chức
    if (dto.role_code && ['SUPER_ADMIN', 'ADMIN', 'SYSTEM_ADMIN'].includes(dto.role_code.toUpperCase())) {
      throw new ApiError(403, 'Không thể cấp vai trò hệ thống thông qua API quản lý thành viên tổ chức');
    }

    // Ràng buộc bảo vệ SME_OWNER duy nhất
    if (
      currentMember.role_code === 'SME_OWNER' &&
      ((dto.role_code && dto.role_code.toUpperCase() !== 'SME_OWNER') || dto.status === 'INACTIVE')
    ) {
      const ownerCount = await OrganizationMemberModel.countActiveRoleByOrg(orgId, 'SME_OWNER');
      if (ownerCount <= 1) {
        throw new ApiError(
          400,
          'Tổ chức phải có ít nhất một Chủ sở hữu (SME Owner). Vui lòng cấp quyền SME Owner cho thành viên khác trước khi thay đổi'
        );
      }
    }

    let roleId: string | undefined;

    // Cập nhật vai trò nếu có qua OrganizationRoleModel
    if (dto.role_code) {
      const role = await OrganizationRoleModel.findByCode(dto.role_code);
      if (!role) {
        throw new ApiError(400, `Vai trò '${dto.role_code}' không tồn tại`);
      }
      roleId = role.id;
    }

    // Cập nhật thành viên qua OrganizationMemberModel
    if (roleId !== undefined || dto.status !== undefined) {
      await OrganizationMemberModel.update(undefined, currentMember.id, {
        role_id: roleId,
        status: dto.status as any,
      });

      // Thu hồi quyền cũ của thành viên trong Redis Session / Cache
      await SessionRevocationService.revokeUserOrgSessions(orgId, targetUserId);
    }

    // Lấy thông tin cập nhật chi tiết trả về qua OrganizationMemberModel
    const detail = await OrganizationMemberModel.findDetail(orgId, targetUserId);
    if (!detail) {
      throw new ApiError(404, 'Không thể tải thông tin thành viên sau khi cập nhật');
    }

    AuditService.record({
      organization_id: orgId,
      user_id: currentUserId,
      action: 'MEMBER_ROLE_CHANGED',
      status: 'SUCCESS',
      target_type: 'USER',
      target_id: targetUserId,
      description: 'Thay đổi vai trò thành viên trong tổ chức',
      before_data: { role_code: currentMember.role_code, status: currentMember.status },
      after_data: { role_code: dto.role_code || currentMember.role_code, status: dto.status || currentMember.status },
    }).catch(() => {});

    return detail;
  }

  /**
   * 5. Xóa / Loại bỏ thành viên khỏi tổ chức
   * Thu hồi phiên làm việc / quyền cũ ngay lập tức (Session & Access Revocation)
   */
  public static async removeMember(
    orgId: string,
    targetUserId: string,
    currentUserId: string,
    currentUserRoles: string[] = []
  ): Promise<{ success: boolean; message: string }> {
    const isSelfLeaving = targetUserId === currentUserId;
    const isOwnerOrAdmin = await this.isSuperAdminOrOwner(orgId, currentUserId, currentUserRoles);

    if (!isSelfLeaving && !isOwnerOrAdmin) {
      throw new ApiError(403, 'Bạn không có quyền loại bỏ thành viên này khỏi tổ chức');
    }

    // Kiểm tra thành viên mục tiêu qua OrganizationMemberModel
    const targetMember = await OrganizationMemberModel.findByOrgAndUser(orgId, targetUserId);

    if (!targetMember || targetMember.status === 'REMOVED') {
      throw new ApiError(404, 'Thành viên này không tồn tại trong tổ chức hoặc đã bị xóa trước đó');
    }

    // Không cho phép xóa Chủ sở hữu duy nhất
    if (targetMember.role_code === 'SME_OWNER') {
      const ownerCount = await OrganizationMemberModel.countActiveRoleByOrg(orgId, 'SME_OWNER');
      if (ownerCount <= 1) {
        throw new ApiError(
          400,
          'Chủ sở hữu duy nhất không thể rời hoặc bị xóa khỏi tổ chức. Vui lòng chuyển giao quyền SME Owner cho thành viên khác trước hoặc xóa toàn bộ tổ chức.'
        );
      }
    }

    // Đánh dấu REMOVED qua OrganizationMemberModel
    await OrganizationMemberModel.setStatus(undefined, targetMember.id, 'REMOVED');

    // Thu hồi quyền / session của user trong tổ chức
    await SessionRevocationService.revokeUserOrgSessions(orgId, targetUserId);

    AuditService.record({
      organization_id: orgId,
      user_id: currentUserId,
      action: 'MEMBER_REMOVED',
      status: 'SUCCESS',
      target_type: 'USER',
      target_id: targetUserId,
      description: isSelfLeaving ? 'Thành viên tự rời khỏi tổ chức' : 'Loại bỏ thành viên khỏi tổ chức',
      metadata: { is_self: isSelfLeaving },
    }).catch(() => {});

    return {
      success: true,
      message: isSelfLeaving
        ? 'Bạn đã rời khỏi tổ chức thành công'
        : 'Đã xóa thành viên khỏi tổ chức thành công',
    };
  }
}
