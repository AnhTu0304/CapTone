import crypto from 'crypto';
import { pool } from '../config/database';
import { ApiError } from '../utils/apiError';
import {
  OrganizationInvitationModel,
  IOrganizationInvitationDetail,
  IInvitationQuery,
} from '../models/organizationInvitation.model';
import { OrganizationModel } from '../models/organization.model';
import { OrganizationRoleModel } from '../models/organizationRole.model';
import { OrganizationMemberModel } from '../models/organizationMember.model';
import { UserModel } from '../models/user.model';
import { EmailQueue } from './emailQueue.service';
import { IPaginatedResult } from '../models/user.model';
import { SessionRevocationService } from './sessionRevocation.service';

export class OrganizationInvitationService {
  /**
   * Tạo mã hash SHA-256 an toàn từ token ngẫu nhiên
   */
  private static hashToken(token: string): string {
    return crypto.createHash('sha256').update(token.trim()).digest('hex');
  }

  /**
   * Kiểm tra quyền: Chỉ SME_OWNER của tổ chức hoặc SUPER_ADMIN mới có quyền quản lý lời mời
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
   * 1. Tạo lời mời thành viên mới vào tổ chức (Gửi email kèm Token xác thực)
   */
  public static async createInvitation(
    orgId: string,
    currentUserId: string,
    currentUserRoles: string[] = [],
    dto: { email: string; role_code?: string }
  ): Promise<{
    invitation: IOrganizationInvitationDetail;
    email_enqueued: boolean;
    token?: string; // Trả về để test hoặc gửi link
  }> {
    // 1. Kiểm tra thẩm quyền
    const hasPermission = await this.isSuperAdminOrOwner(orgId, currentUserId, currentUserRoles);
    if (!hasPermission) {
      throw new ApiError(403, 'Chỉ Chủ sở hữu (SME Owner) hoặc Quản trị viên tối cao mới có quyền mời thành viên');
    }

    // 2. Kiểm tra tổ chức tồn tại và không bị khóa
    const org = await OrganizationModel.findById(orgId);
    if (!org || org.deleted_at) {
      throw new ApiError(404, 'Không tìm thấy tổ chức');
    }
    if (org.status === 'SUSPENDED' || org.status === 'INACTIVE') {
      throw new ApiError(403, `Tổ chức đang trong trạng thái '${org.status}'. Không thể tạo lời mời thành viên mới.`);
    }

    // 3. Chuẩn hóa email
    const email = dto.email.trim().toLowerCase();

    // 4. Kiểm tra vai trò: Không cho phép gán vai trò hệ thống
    const roleCode = (dto.role_code || 'DEVOPS').trim().toUpperCase();
    if (['SUPER_ADMIN', 'ADMIN', 'SYSTEM_ADMIN'].includes(roleCode)) {
      throw new ApiError(403, 'Không được phép cấp vai trò hệ thống (SUPER_ADMIN, ADMIN) cho thành viên tổ chức');
    }

    const role = await OrganizationRoleModel.findByCode(roleCode);
    if (!role) {
      throw new ApiError(400, `Vai trò '${roleCode}' không hợp lệ hoặc không tồn tại`);
    }

    // 5. Kiểm tra nếu người dùng đã là thành viên ACTIVE trong tổ chức
    const targetUser = await OrganizationMemberModel.findUserByEmail(email);
    if (targetUser) {
      const existingMember = await OrganizationMemberModel.findByOrgAndUser(orgId, targetUser.id);
      if (existingMember && existingMember.status === 'ACTIVE') {
        throw new ApiError(409, `Người dùng '${email}' đã là thành viên đang hoạt động trong tổ chức`);
      }
    }

    // 6. Kiểm tra xem đã có lời mời PENDING nào cho email này trong tổ chức chưa
    const existingInvite = await OrganizationInvitationModel.findPendingByEmailAndOrg(email, orgId);
    if (existingInvite) {
      throw new ApiError(409, `Email '${email}' đã có một lời mời đang chờ phản hồi trong tổ chức này`);
    }

    // 7. Sinh token ngẫu nhiên bảo mật cao và tạo hash SHA-256
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 ngày

    // 8. Lưu lời mời vào bảng organization_invitations
    const invRecord = await OrganizationInvitationModel.create(undefined, {
      organization_id: orgId,
      email,
      role_id: role.id,
      invited_by: currentUserId,
      token_hash: tokenHash,
      expires_at: expiresAt,
    });

    // 9. Đồng bộ vào organization_members nếu user đã có tài khoản (đảm bảo tương thích ngược UI)
    if (targetUser) {
      const existingMember = await OrganizationMemberModel.findByOrgAndUser(orgId, targetUser.id);
      if (existingMember) {
        await OrganizationMemberModel.update(undefined, existingMember.id, {
          role_id: role.id,
          status: 'INVITED',
          invited_by: currentUserId,
        });
      } else {
        await OrganizationMemberModel.create(undefined, {
          organization_id: orgId,
          user_id: targetUser.id,
          role_id: role.id,
          status: 'INVITED',
          invited_by: currentUserId,
        });
      }
    }

    // 10. Gửi email thông báo mời tham gia qua EmailQueue (Task 2.3)
    const inviter = await OrganizationMemberModel.findUserById(currentUserId);
    let emailEnqueued = false;

    try {
      await EmailQueue.enqueueInvitation(
        email,
        targetUser?.full_name || email,
        inviter?.full_name || 'Quản trị viên',
        org.name,
        role.name
      );
      emailEnqueued = true;
    } catch (queueErr: any) {
      console.warn(`⚠️ [INVITATION SERVICE] Không thể đưa email mời vào hàng đợi: ${queueErr.message}`);
      emailEnqueued = false;
    }

    const detail: IOrganizationInvitationDetail = {
      id: invRecord.id,
      organization_id: orgId,
      organization_name: org.name,
      email,
      role: {
        id: role.id,
        code: role.code,
        name: role.name,
        description: role.description,
      },
      invited_by: inviter
        ? {
            id: inviter.id,
            full_name: inviter.full_name,
            email: inviter.email,
          }
        : null,
      status: 'PENDING',
      expires_at: expiresAt,
      accepted_at: null,
      created_at: invRecord.created_at,
    };

    return {
      invitation: detail,
      email_enqueued: emailEnqueued,
      token: rawToken, // Dùng cho testing và response
    };
  }

  /**
   * 2. Xác nhận lời mời bằng Token (Token Acceptance Endpoint)
   * Xử lý Transaction nguyên tử chống Race Condition
   */
  public static async acceptInvitationByToken(
    rawToken: string,
    currentUserId: string
  ): Promise<{
    message: string;
    organization_id: string;
    organization_name: string;
    role_code: string;
    joined_at: Date;
  }> {
    if (!rawToken || rawToken.trim() === '') {
      throw new ApiError(400, 'Mã token xác thực lời mời không được để trống');
    }

    const tokenHash = this.hashToken(rawToken);
    const invite = await OrganizationInvitationModel.findByTokenHash(tokenHash);

    if (!invite) {
      throw new ApiError(404, 'Lời mời không tồn tại hoặc mã token không hợp lệ');
    }

    // Kiểm tra trạng thái lời mời
    if (invite.status === 'REVOKED') {
      throw new ApiError(410, 'Lời mời này đã bị thu hồi bởi quản trị viên tổ chức');
    }
    if (invite.status === 'ACCEPTED') {
      throw new ApiError(409, 'Lời mời này đã được chấp nhận trước đó');
    }
    if (invite.status === 'EXPIRED' || new Date(invite.expires_at) < new Date()) {
      throw new ApiError(410, 'Lời mời này đã hết hạn hiệu lực');
    }

    // Kiểm tra tổ chức tồn tại và không bị vô hiệu hóa
    if (invite.org_deleted_at) {
      throw new ApiError(404, 'Tổ chức liên kết với lời mời này đã bị xóa');
    }
    if (invite.org_status === 'SUSPENDED' || invite.org_status === 'INACTIVE') {
      throw new ApiError(403, `Tổ chức đang trong trạng thái '${invite.org_status}'. Không thể gia nhập lúc này.`);
    }

    // Kiểm tra thông tin người dùng đang chấp nhận
    const currentUser = await UserModel.findById(currentUserId);
    if (!currentUser) {
      throw new ApiError(401, 'Người dùng không tồn tại hoặc chưa đăng nhập');
    }

    // Xác minh email người nhận khớp với lời mời (Chống người khác đánh cắp token)

    if (currentUser.email.trim().toLowerCase() !== invite.email.trim().toLowerCase()) {
      throw new ApiError(
        403,
        `Tài khoản đăng nhập (${currentUser.email}) không trùng khớp với email nhận lời mời (${invite.email})`
      );
    }

    // Kiểm tra nếu người dùng đã là thành viên ACTIVE trong tổ chức
    const existingActive = await OrganizationMemberModel.findByOrgAndUser(invite.organization_id, currentUserId);
    if (existingActive && existingActive.status === 'ACTIVE') {
      throw new ApiError(409, 'Bạn đã là thành viên đang hoạt động của tổ chức này');
    }

    // Giao dịch cơ sở dữ liệu nguyên tử (Transaction)
    const client = await pool.connect();
    let joinedAt = new Date();

    try {
      await client.query('BEGIN');

      // 1. Chuyển trạng thái lời mời sang ACCEPTED (Atomic UPDATE có điều kiện status = 'PENDING')
      const acceptedRecord = await OrganizationInvitationModel.acceptAtomic(invite.id, currentUserId, client);
      if (!acceptedRecord) {
        throw new ApiError(409, 'Lời mời này đang được xử lý hoặc đã được chấp nhận bởi một yêu cầu khác');
      }

      // 2. Chèn hoặc cập nhật thành viên tổ chức với status = 'ACTIVE'
      const upsertMemberQuery = `
        INSERT INTO organization_members (
          organization_id, user_id, role_id, status, invited_by, joined_at, created_at, updated_at
        ) VALUES (
          $1, $2, $3, 'ACTIVE', $4, NOW(), NOW(), NOW()
        )
        ON CONFLICT (organization_id, user_id)
        DO UPDATE SET 
          role_id = EXCLUDED.role_id,
          status = 'ACTIVE',
          joined_at = NOW(),
          updated_at = NOW()
        RETURNING joined_at;
      `;

      const memberRes = await client.query(upsertMemberQuery, [
        invite.organization_id,
        currentUserId,
        invite.role_id,
        invite.invited_by || null,
      ]);

      if (memberRes.rows[0]?.joined_at) {
        joinedAt = memberRes.rows[0].joined_at;
      }

      await client.query('COMMIT');
      await SessionRevocationService.revokeUserOrgSessions(invite.organization_id, currentUserId);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    return {
      message: `Chào mừng bạn gia nhập tổ chức ${invite.org_name}!`,
      organization_id: invite.organization_id,
      organization_name: invite.org_name,
      role_code: invite.role_code,
      joined_at: joinedAt,
    };
  }

  /**
   * 3. Lấy danh sách lời mời của một tổ chức (Dành cho Quản trị viên/Owner tổ chức)
   */
  public static async getOrganizationInvitations(
    orgId: string,
    currentUserId: string,
    currentUserRoles: string[] = [],
    query: IInvitationQuery = {}
  ): Promise<IPaginatedResult<IOrganizationInvitationDetail>> {
    const hasPermission = await this.isSuperAdminOrOwner(orgId, currentUserId, currentUserRoles);
    if (!hasPermission) {
      throw new ApiError(403, 'Bạn không có quyền xem danh sách lời mời của tổ chức này');
    }

    const org = await OrganizationModel.findById(orgId);
    if (!org || org.deleted_at) {
      throw new ApiError(404, 'Không tìm thấy tổ chức');
    }

    const page = Math.max(1, query.page || 1);
    const limit = Math.max(1, Math.min(100, query.limit || 20));
    const offset = (page - 1) * limit;

    const filter = {
      status: query.status,
      search: query.search,
      limit,
      offset,
    };

    const total = await OrganizationInvitationModel.countByOrg(orgId, filter);
    const items = await OrganizationInvitationModel.findManyByOrg(orgId, filter);

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
   * 4. Thu hồi lời mời (Revoke Invitation)
   */
  public static async revokeInvitation(
    orgId: string,
    invitationId: string,
    currentUserId: string,
    currentUserRoles: string[] = []
  ): Promise<{ success: boolean; message: string }> {
    const hasPermission = await this.isSuperAdminOrOwner(orgId, currentUserId, currentUserRoles);
    if (!hasPermission) {
      throw new ApiError(403, 'Bạn không có quyền thu hồi lời mời trong tổ chức này');
    }

    const invite = await OrganizationInvitationModel.findByIdAndOrg(invitationId, orgId);
    if (!invite) {
      throw new ApiError(404, 'Lời mời không tồn tại trong tổ chức này');
    }

    if (invite.status !== 'PENDING') {
      throw new ApiError(400, `Không thể thu hồi lời mời đang ở trạng thái '${invite.status}'`);
    }

    await OrganizationInvitationModel.revoke(invitationId, orgId);

    // Cập nhật trạng thái trong organization_members nếu có
    const targetUser = await OrganizationMemberModel.findUserByEmail(invite.email);
    if (targetUser) {
      const member = await OrganizationMemberModel.findByOrgAndUser(orgId, targetUser.id);
      if (member && member.status === 'INVITED') {
        await OrganizationMemberModel.setStatus(undefined, member.id, 'REMOVED');
      }
    }

    return {
      success: true,
      message: 'Thu hồi lời mời thành công',
    };
  }

  /**
   * 5. Gửi lại lời mời (Resend Invitation)
   */
  public static async resendInvitation(
    orgId: string,
    invitationId: string,
    currentUserId: string,
    currentUserRoles: string[] = []
  ): Promise<{ success: boolean; message: string; email_enqueued: boolean; token?: string }> {
    const hasPermission = await this.isSuperAdminOrOwner(orgId, currentUserId, currentUserRoles);
    if (!hasPermission) {
      throw new ApiError(403, 'Bạn không có quyền gửi lại lời mời trong tổ chức này');
    }

    const invite = await OrganizationInvitationModel.findByIdAndOrg(invitationId, orgId);
    if (!invite) {
      throw new ApiError(404, 'Lời mời không tồn tại trong tổ chức này');
    }

    if (invite.status === 'ACCEPTED') {
      throw new ApiError(400, 'Lời mời đã được chấp nhận, không thể gửi lại');
    }

    // Sinh token mới và gia hạn thêm 7 ngày
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const updated = await OrganizationInvitationModel.resend(invitationId, orgId, tokenHash, expiresAt);
    if (!updated) {
      throw new ApiError(400, `Không thể gửi lại lời mời ở trạng thái '${invite.status}'`);
    }

    // Đẩy vào hàng đợi Email
    const inviter = await OrganizationMemberModel.findUserById(currentUserId);
    let emailEnqueued = false;

    try {
      await EmailQueue.enqueueInvitation(
        invite.email,
        invite.email,
        inviter?.full_name || 'Quản trị viên',
        invite.organization_name,
        invite.role.name
      );
      emailEnqueued = true;
    } catch {
      emailEnqueued = false;
    }

    return {
      success: true,
      message: 'Đã tạo lại token và gửi lại lời mời thành công',
      email_enqueued: emailEnqueued,
      token: rawToken,
    };
  }
}
