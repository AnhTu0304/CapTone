import { ApiError } from '../utils/apiError';
import {
  IOrganizationMemberDetail,
  IInviteMemberDto,
  IUpdateMemberDto,
  IMemberQuery,
  OrganizationMemberModel,
} from '../models/organizationMember.model';
import { OrganizationModel } from '../models/organization.model';
import { OrganizationRoleModel } from '../models/organizationRole.model';
import { IPaginatedResult } from '../models/user.model';
import { EmailService } from './email.service';

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
   * Chỉ SME_OWNER của tổ chức hoặc SUPER_ADMIN mới có quyền mời
   */
  public static async inviteMember(
    orgId: string,
    currentUserId: string,
    currentUserRoles: string[] = [],
    dto: IInviteMemberDto
  ): Promise<IOrganizationMemberDetail> {
    const hasPermission = await this.isSuperAdminOrOwner(orgId, currentUserId, currentUserRoles);
    if (!hasPermission) {
      throw new ApiError(403, 'Chỉ Chủ sở hữu (SME Owner) hoặc Quản trị viên tối cao mới có quyền mời thành viên');
    }

    // Kiểm tra tổ chức tồn tại qua OrganizationModel
    const org = await OrganizationModel.findById(orgId);
    if (!org) {
      throw new ApiError(404, 'Không tìm thấy tổ chức');
    }

    // Kiểm tra vai trò cần gán qua OrganizationRoleModel
    const roleCode = dto.role_code || 'DEVOPS';
    const role = await OrganizationRoleModel.findByCode(roleCode);
    if (!role) {
      throw new ApiError(400, `Vai trò '${roleCode}' không hợp lệ hoặc không tồn tại`);
    }

    // Tìm người dùng theo Email qua OrganizationMemberModel
    const targetEmail = dto.email.trim().toLowerCase();
    const targetUser = await OrganizationMemberModel.findUserByEmail(targetEmail);
    if (!targetUser) {
      throw new ApiError(
        404,
        `Không tìm thấy tài khoản với email '${targetEmail}'. Người dùng cần đăng ký tài khoản trước khi tham gia tổ chức.`
      );
    }

    // Lấy thông tin người mời để gửi email
    const inviter = await OrganizationMemberModel.findUserById(currentUserId);

    // Kiểm tra xem đã là thành viên trong tổ chức chưa
    const existing = await OrganizationMemberModel.findByOrgAndUser(orgId, targetUser.id);

    let memberId: string;

    if (existing) {
      if (existing.status === 'ACTIVE') {
        throw new ApiError(409, `Người dùng '${targetUser.email}' đã là thành viên đang hoạt động trong tổ chức`);
      }
      if (existing.status === 'INVITED') {
        throw new ApiError(409, `Người dùng '${targetUser.email}' đã có một lời mời đang chờ chấp nhận`);
      }

      // Nếu đã từng bị REMOVED hoặc INACTIVE -> Kích hoạt lại lời mời qua OrganizationMemberModel
      const updated = await OrganizationMemberModel.update(undefined, existing.id, {
        role_id: role.id,
        status: 'INVITED',
        invited_by: currentUserId,
      });
      memberId = updated.id;
    } else {
      // Chèn bản ghi mới qua OrganizationMemberModel
      const created = await OrganizationMemberModel.create(undefined, {
        organization_id: orgId,
        user_id: targetUser.id,
        role_id: role.id,
        status: 'INVITED',
        invited_by: currentUserId,
      });
      memberId = created.id;
    }

    // Gửi email thông báo mời tham gia
    EmailService.sendInvitationEmail(
      targetUser.email,
      targetUser.full_name,
      inviter?.full_name || 'Quản trị viên',
      org.name,
      role.name
    ).catch(() => {});

    return {
      id: memberId,
      organization_id: orgId,
      user: {
        id: targetUser.id,
        email: targetUser.email,
        full_name: targetUser.full_name,
        avatar_url: targetUser.avatar_url,
        status: targetUser.status,
      },
      role: {
        id: role.id,
        code: role.code,
        name: role.name,
        description: role.description,
      },
      status: 'INVITED',
      inviter: inviter
        ? {
            id: inviter.id,
            email: inviter.email,
            full_name: inviter.full_name,
          }
        : null,
      joined_at: null,
      created_at: new Date(),
      updated_at: new Date(),
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
    const invite = await OrganizationMemberModel.findPendingInvite(orgId, currentUserId);

    if (!invite) {
      throw new ApiError(404, 'Không tìm thấy lời mời đang chờ nào cho tài khoản của bạn tại tổ chức này');
    }

    const updated = await OrganizationMemberModel.update(undefined, invite.id, {
      status: 'ACTIVE',
      joined_at: new Date(),
    });

    return {
      message: `Chào mừng bạn gia nhập tổ chức ${invite.org_name}!`,
      organization_id: orgId,
      role_code: invite.role_code,
      joined_at: updated.joined_at || new Date(),
    };
  }

  /**
   * 4. Cập nhật vai trò hoặc trạng thái của thành viên trong tổ chức
   * Chỉ SME_OWNER của tổ chức hoặc SUPER_ADMIN mới có quyền
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
    }

    // Lấy thông tin cập nhật chi tiết trả về qua OrganizationMemberModel
    const detail = await OrganizationMemberModel.findDetail(orgId, targetUserId);
    if (!detail) {
      throw new ApiError(404, 'Không thể tải thông tin thành viên sau khi cập nhật');
    }

    return detail;
  }

  /**
   * 5. Xóa / Loại bỏ thành viên khỏi tổ chức
   * Cho phép nếu:
   * - Người thao tác là SME_OWNER của tổ chức
   * - Hoặc SUPER_ADMIN
   * - Hoặc thành viên tự rời tổ chức (targetUserId === currentUserId)
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

    return {
      success: true,
      message: isSelfLeaving
        ? 'Bạn đã rời khỏi tổ chức thành công'
        : 'Đã xóa thành viên khỏi tổ chức thành công',
    };
  }
}
