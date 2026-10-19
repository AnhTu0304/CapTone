import crypto from 'crypto';
import { pool } from '../config/database';
import { ApiError } from '../utils/apiError';
import {
  IOrganizationDetail,
  ICreateOrganizationDto,
  IUpdateOrganizationDto,
  IOrganizationQuery,
  OrganizationModel,
} from '../models/organization.model';
import { OrganizationProfileModel } from '../models/organizationProfile.model';
import { OrganizationRoleModel } from '../models/organizationRole.model';
import { OrganizationMemberModel } from '../models/organizationMember.model';
import { IPaginatedResult } from '../models/user.model';

/**
 * Hàm sinh chuỗi slug URL chuẩn hóa từ tên tổ chức (hỗ trợ tiếng Việt)
 */
export function generateSlug(text: string): string {
  const normalized = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || `org-${crypto.randomBytes(3).toString('hex')}`;
}

/**
 * Service xử lý logic nghiệp vụ cho Tổ chức (Organizations)
 * Ủy thác toàn bộ truy vấn cơ sở dữ liệu cho các Model tương ứng
 */
export class OrganizationService {
  /**
   * 1. Tạo tổ chức mới
   * Tự động tạo hồ sơ mở rộng (Profile) và gán người tạo làm SME_OWNER trong organization_members
   */
  public static async create(userId: string, dto: ICreateOrganizationDto): Promise<IOrganizationDetail> {
    if (!userId) {
      throw new ApiError(401, 'Yêu cầu đăng nhập trước khi tạo tổ chức');
    }

    // Xử lý tạo Slug
    let baseSlug = dto.slug ? generateSlug(dto.slug) : generateSlug(dto.name);
    let finalSlug = baseSlug;

    // Kiểm tra trùng lặp slug qua OrganizationModel
    const existingSlug = await OrganizationModel.findBySlug(finalSlug);
    if (existingSlug) {
      if (dto.slug) {
        throw new ApiError(409, `Định danh slug '${dto.slug}' đã tồn tại, vui lòng chọn một slug khác`);
      }
      finalSlug = `${baseSlug}-${crypto.randomBytes(2).toString('hex')}`;
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Tạo tổ chức qua OrganizationModel
      const org = await OrganizationModel.create(client, {
        name: dto.name.trim(),
        slug: finalSlug,
        type: dto.type?.trim() || null,
        description: dto.description?.trim() || null,
        status: 'ACTIVE',
        created_by: userId,
      });

      // 2. Tạo hồ sơ qua OrganizationProfileModel
      const profile = await OrganizationProfileModel.create(client, {
        organization_id: org.id,
        description: dto.description,
        email: dto.email,
        phone: dto.phone,
        website: dto.website,
        address: dto.address,
        city: dto.city,
        country: dto.country,
        timezone: dto.timezone,
      });

      // 3. Tìm vai trò SME_OWNER qua OrganizationRoleModel
      const role = await OrganizationRoleModel.findByCode('SME_OWNER', client);
      let assignedRoleCode: string | null = null;

      if (role) {
        // 4. Gán người tạo thành thành viên sáng lập (SME_OWNER) qua OrganizationMemberModel
        await OrganizationMemberModel.create(client, {
          organization_id: org.id,
          user_id: userId,
          role_id: role.id,
          status: 'ACTIVE',
          joined_at: new Date(),
        });
        assignedRoleCode = role.code;
      }

      await client.query('COMMIT');

      return {
        ...org,
        profile,
        role_in_org: assignedRoleCode,
        members_count: 1,
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * 2. Lấy danh sách tổ chức (Kèm phân trang, tìm kiếm, lọc status)
   * - Quản trị viên hệ thống (SUPER_ADMIN, SYSTEM_ADMIN, ADMIN) xem được tất cả.
   * - Người dùng thông thường chỉ xem các tổ chức mà họ là thành viên.
   */
  public static async getAll(
    userId: string,
    userRoles: string[] = [],
    query: IOrganizationQuery = {}
  ): Promise<IPaginatedResult<IOrganizationDetail>> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.max(1, Math.min(100, query.limit || 10));
    const offset = (page - 1) * limit;

    const normalizedRoles = userRoles.map((r) => r.toUpperCase());
    const isSystemAdmin = normalizedRoles.some((r) =>
      ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'ADMIN'].includes(r)
    );

    const filter = {
      isSystemAdmin,
      userId,
      search: query.search,
      status: query.status,
      sortBy: query.sort_by,
      order: query.order,
      limit,
      offset,
    };

    // Đếm tổng số lượng qua OrganizationModel
    const total = await OrganizationModel.count(filter);

    // Lấy danh sách chi tiết qua OrganizationModel
    const items = await OrganizationModel.findManyWithDetails(filter);

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
   * 3. Lấy thông tin chi tiết một tổ chức theo ID
   */
  public static async getById(
    orgId: string,
    userId: string,
    userRoles: string[] = []
  ): Promise<IOrganizationDetail> {
    const row = await OrganizationModel.findDetailById(orgId, userId);
    if (!row) {
      throw new ApiError(404, 'Không tìm thấy tổ chức hoặc tổ chức đã bị xóa');
    }

    const normalizedRoles = userRoles.map((r) => r.toUpperCase());
    const isSystemAdmin = normalizedRoles.some((r) =>
      ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'ADMIN'].includes(r)
    );

    const isMember = Boolean(row.member_status && row.member_status !== 'REMOVED');

    if (!isSystemAdmin && !isMember) {
      throw new ApiError(403, 'Bạn không có quyền truy cập vào thông tin tổ chức này');
    }

    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      type: row.type,
      description: row.description,
      status: row.status,
      created_by: row.created_by,
      created_at: row.created_at,
      updated_at: row.updated_at,
      role_in_org: row.role_in_org || null,
      members_count: row.members_count || 0,
      profile: row.profile || null,
    };
  }

  /**
   * 4. Cập nhật thông tin tổ chức & hồ sơ
   * Chỉ SUPER_ADMIN hoặc SME_OWNER của tổ chức mới có quyền cập nhật
   */
  public static async update(
    orgId: string,
    userId: string,
    userRoles: string[] = [],
    dto: IUpdateOrganizationDto
  ): Promise<IOrganizationDetail> {
    const current = await this.getById(orgId, userId, userRoles);

    const normalizedRoles = userRoles.map((r) => r.toUpperCase());
    const isSuperAdmin = normalizedRoles.includes('SUPER_ADMIN');
    const isOwner = current.role_in_org === 'SME_OWNER';

    if (!isSuperAdmin && !isOwner) {
      throw new ApiError(403, 'Chỉ Chủ sở hữu (SME Owner) hoặc Quản trị viên tối cao mới có quyền chỉnh sửa tổ chức');
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Cập nhật bảng organizations qua OrganizationModel
      await OrganizationModel.update(client, orgId, {
        name: dto.name,
        type: dto.type,
        description: dto.description,
        status: dto.status,
      });

      // 2. Cập nhật bảng organization_profiles qua OrganizationProfileModel
      const existingProfile = await OrganizationProfileModel.findByOrganizationId(orgId, client);
      if (!existingProfile) {
        await OrganizationProfileModel.create(client, {
          organization_id: orgId,
          description: dto.description,
          email: dto.email,
          phone: dto.phone,
          website: dto.website,
          address: dto.address,
          city: dto.city,
          country: dto.country,
          timezone: dto.timezone,
        });
      } else {
        await OrganizationProfileModel.update(client, orgId, {
          description: dto.description,
          email: dto.email,
          phone: dto.phone,
          website: dto.website,
          address: dto.address,
          city: dto.city,
          country: dto.country,
          timezone: dto.timezone,
        });
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    return this.getById(orgId, userId, userRoles);
  }

  /**
   * 5. Xóa tổ chức (Soft Delete)
   * Chỉ SUPER_ADMIN hoặc SME_OWNER mới có quyền xóa
   */
  public static async delete(
    orgId: string,
    userId: string,
    userRoles: string[] = []
  ): Promise<{ id: string; deleted: boolean }> {
    const current = await this.getById(orgId, userId, userRoles);

    const normalizedRoles = userRoles.map((r) => r.toUpperCase());
    const isSuperAdmin = normalizedRoles.includes('SUPER_ADMIN');
    const isOwner = current.role_in_org === 'SME_OWNER';

    if (!isSuperAdmin && !isOwner) {
      throw new ApiError(403, 'Chỉ Chủ sở hữu (SME Owner) hoặc Quản trị viên tối cao mới có quyền xóa tổ chức');
    }

    // Xóa mềm qua OrganizationModel
    await OrganizationModel.softDelete(undefined, orgId);

    return { id: orgId, deleted: true };
  }

  /**
   * 6. Lấy danh sách các tổ chức mà người dùng đang tham gia (Workspace Context)
   */
  public static async getUserOrganizations(userId: string): Promise<IOrganizationDetail[]> {
    if (!userId) {
      throw new ApiError(401, 'Yêu cầu đăng nhập trước khi xem danh sách tổ chức');
    }
    return OrganizationModel.findOrganizationsByUserId(userId);
  }

  /**
   * 7. Lấy danh sách tất cả các lời mời đang chờ chấp nhận của người dùng
   */
  public static async getUserPendingInvitations(userId: string) {
    if (!userId) {
      throw new ApiError(401, 'Yêu cầu đăng nhập trước khi xem danh sách lời mời');
    }
    return OrganizationModel.findPendingInvitationsByUserId(userId);
  }

  /**
   * 8. Lấy chi tiết ngữ cảnh Workspace Context khi User chuyển đổi vào một tổ chức
   */
  public static async getWorkspaceContext(userId: string, orgId: string) {
    if (!userId) {
      throw new ApiError(401, 'Yêu cầu đăng nhập trước khi truy cập ngữ cảnh tổ chức');
    }

    const context = await OrganizationModel.getUserWorkspaceContext(userId, orgId);
    if (!context) {
      throw new ApiError(403, 'Bạn không phải là thành viên đang hoạt động (ACTIVE) của tổ chức này');
    }

    const roleCode = context.membership.role_code;
    const isOwner = roleCode === 'SME_OWNER';
    const isDevOps = roleCode === 'DEVOPS';

    return {
      workspace: context.organization,
      membership: context.membership,
      permissions: {
        is_owner: isOwner,
        can_manage_organization: isOwner,
        can_manage_members: isOwner,
        can_manage_infrastructure: isOwner || isDevOps,
        can_manage_environments: isOwner || isDevOps,
        can_trigger_rca: isOwner || isDevOps,
        can_view_metrics: true,
        can_view_reports: true,
      },
    };
  }

  /**
   * 9. Chấp nhận lời mời tham gia tổ chức trực tiếp bằng inviteId
   */
  public static async acceptInvitationById(userId: string, inviteId: string) {
    if (!userId) {
      throw new ApiError(401, 'Yêu cầu đăng nhập trước khi chấp nhận lời mời');
    }

    const invite = await OrganizationMemberModel.findPendingInviteById(inviteId, userId);
    if (!invite) {
      throw new ApiError(404, 'Không tìm thấy lời mời đang chờ nào tương ứng với tài khoản của bạn');
    }

    const updated = await OrganizationMemberModel.update(undefined, invite.id, {
      status: 'ACTIVE',
      joined_at: new Date(),
    });

    return {
      message: `Chào mừng bạn gia nhập tổ chức ${invite.org_name}!`,
      organization_id: invite.organization_id,
      role_code: invite.role_code,
      joined_at: updated.joined_at || new Date(),
    };
  }

  /**
   * 10. Từ chối lời mời tham gia tổ chức trực tiếp bằng inviteId
   */
  public static async declineInvitationById(userId: string, inviteId: string) {
    if (!userId) {
      throw new ApiError(401, 'Yêu cầu đăng nhập trước khi từ chối lời mời');
    }

    const invite = await OrganizationMemberModel.findPendingInviteById(inviteId, userId);
    if (!invite) {
      throw new ApiError(404, 'Không tìm thấy lời mời đang chờ nào tương ứng với tài khoản của bạn');
    }

    await OrganizationMemberModel.setStatus(undefined, invite.id, 'REMOVED');

    return {
      message: `Đã từ chối lời mời tham gia tổ chức ${invite.org_name} thành công`,
      organization_id: invite.organization_id,
    };
  }
}
