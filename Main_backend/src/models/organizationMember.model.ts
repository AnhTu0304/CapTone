import { PoolClient } from 'pg';
import { pool } from '../config/database';

/**
 * Model và Kiểu dữ liệu cho Thành viên Tổ chức (Organization Members)
 * Khớp với bảng `organization_members` trong PostgreSQL
 */

export type MemberStatus = 'INVITED' | 'ACTIVE' | 'INACTIVE' | 'REMOVED';

export interface IOrganizationMember {
  id: string;
  organization_id: string;
  user_id: string;
  role_id: string;
  status: MemberStatus;
  invited_by?: string | null;
  joined_at?: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface IOrganizationMemberDetail {
  id: string;
  organization_id: string;
  user: {
    id: string;
    email: string;
    full_name: string;
    avatar_url?: string | null;
    status: string;
  };
  role: {
    id: string;
    code: string;
    name: string;
    description?: string | null;
  };
  status: MemberStatus;
  inviter?: {
    id: string;
    email: string;
    full_name: string;
  } | null;
  joined_at?: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface IInviteMemberDto {
  email: string;
  role_code?: 'SME_OWNER' | 'DEVOPS' | 'VIEWER' | string;
}

export interface IUpdateMemberDto {
  role_code?: 'SME_OWNER' | 'DEVOPS' | 'VIEWER' | string;
  status?: 'ACTIVE' | 'INACTIVE';
}

export interface IMemberQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: MemberStatus;
  role?: string;
}

export class OrganizationMemberModel {
  /**
   * Tạo bản ghi thành viên mới
   */
  public static async create(
    client: PoolClient | undefined,
    data: {
      organization_id: string;
      user_id: string;
      role_id: string;
      status: MemberStatus;
      invited_by?: string | null;
      joined_at?: Date | null;
    }
  ): Promise<IOrganizationMember> {
    const db = client || pool;
    const query = `
      INSERT INTO organization_members (
        organization_id, user_id, role_id, status, invited_by, joined_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6
      ) RETURNING *;
    `;
    const res = await db.query<IOrganizationMember>(query, [
      data.organization_id,
      data.user_id,
      data.role_id,
      data.status,
      data.invited_by || null,
      data.joined_at || null,
    ]);
    return res.rows[0];
  }

  /**
   * Tìm thành viên theo ID tổ chức và User ID kèm mã vai trò
   */
  public static async findByOrgAndUser(
    organizationId: string,
    userId: string,
    client?: PoolClient
  ): Promise<(IOrganizationMember & { role_code: string }) | null> {
    const db = client || pool;
    const query = `
      SELECT om.*, r.code AS role_code
      FROM organization_members om
      JOIN roles r ON om.role_id = r.id
      WHERE om.organization_id = $1 AND om.user_id = $2
      LIMIT 1;
    `;
    const res = await db.query<IOrganizationMember & { role_code: string }>(query, [
      organizationId,
      userId,
    ]);
    return res.rows[0] || null;
  }

  /**
   * Kiểm tra người dùng có vai trò cụ thể trong tổ chức không
   */
  public static async findUserRoleInOrg(
    organizationId: string,
    userId: string,
    client?: PoolClient
  ): Promise<{ role_code: string; status: MemberStatus } | null> {
    const db = client || pool;
    const query = `
      SELECT r.code AS role_code, om.status
      FROM organization_members om
      JOIN roles r ON om.role_id = r.id
      WHERE om.organization_id = $1 AND om.user_id = $2 AND om.status = 'ACTIVE'
      LIMIT 1;
    `;
    const res = await db.query<{ role_code: string; status: MemberStatus }>(query, [
      organizationId,
      userId,
    ]);
    return res.rows[0] || null;
  }

  /**
   * Lấy danh sách thành viên chi tiết có phân trang, tìm kiếm và lọc
   */
  public static async findManyByOrg(
    organizationId: string,
    filter: {
      search?: string;
      status?: MemberStatus;
      role?: string;
      limit: number;
      offset: number;
    },
    client?: PoolClient
  ): Promise<IOrganizationMemberDetail[]> {
    const db = client || pool;
    const conditions: string[] = ['om.organization_id = $1'];
    const params: any[] = [organizationId];
    let paramIndex = 2;

    if (filter.search && filter.search.trim() !== '') {
      conditions.push(
        `(u.email ILIKE $${paramIndex} OR u.full_name ILIKE $${paramIndex})`
      );
      params.push(`%${filter.search.trim()}%`);
      paramIndex++;
    }

    if (filter.status) {
      conditions.push(`om.status = $${paramIndex}`);
      params.push(filter.status);
      paramIndex++;
    }

    if (filter.role) {
      conditions.push(`r.code = $${paramIndex}`);
      params.push(filter.role.toUpperCase());
      paramIndex++;
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const query = `
      SELECT 
        om.id, om.organization_id, om.user_id, om.role_id, om.status, om.invited_by, om.joined_at, om.created_at, om.updated_at,
        u.email AS user_email, u.full_name AS user_full_name, u.avatar_url AS user_avatar_url, u.status AS user_status,
        r.code AS role_code, r.name AS role_name, r.description AS role_description,
        inv.id AS inviter_id, inv.email AS inviter_email, inv.full_name AS inviter_full_name
      FROM organization_members om
      JOIN users u ON om.user_id = u.id
      JOIN roles r ON om.role_id = r.id
      LEFT JOIN users inv ON om.invited_by = inv.id
      ${whereClause}
      ORDER BY 
        CASE 
          WHEN r.code = 'SME_OWNER' THEN 1
          WHEN r.code = 'DEVOPS' THEN 2
          ELSE 3
        END ASC,
        om.created_at ASC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1};
    `;

    params.push(filter.limit, filter.offset);
    const res = await db.query(query, params);

    return res.rows.map((row) => ({
      id: row.id,
      organization_id: row.organization_id,
      user: {
        id: row.user_id,
        email: row.user_email,
        full_name: row.user_full_name,
        avatar_url: row.user_avatar_url,
        status: row.user_status,
      },
      role: {
        id: row.role_id,
        code: row.role_code,
        name: row.role_name,
        description: row.role_description,
      },
      status: row.status,
      inviter: row.inviter_id
        ? {
            id: row.inviter_id,
            email: row.inviter_email,
            full_name: row.inviter_full_name,
          }
        : null,
      joined_at: row.joined_at,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));
  }

  /**
   * Đếm tổng số thành viên theo bộ lọc
   */
  public static async countByOrg(
    organizationId: string,
    filter: { search?: string; status?: MemberStatus; role?: string },
    client?: PoolClient
  ): Promise<number> {
    const db = client || pool;
    const conditions: string[] = ['om.organization_id = $1'];
    const params: any[] = [organizationId];
    let paramIndex = 2;

    if (filter.search && filter.search.trim() !== '') {
      conditions.push(
        `(u.email ILIKE $${paramIndex} OR u.full_name ILIKE $${paramIndex})`
      );
      params.push(`%${filter.search.trim()}%`);
      paramIndex++;
    }

    if (filter.status) {
      conditions.push(`om.status = $${paramIndex}`);
      params.push(filter.status);
      paramIndex++;
    }

    if (filter.role) {
      conditions.push(`r.code = $${paramIndex}`);
      params.push(filter.role.toUpperCase());
      paramIndex++;
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const query = `
      SELECT COUNT(*)::int AS total
      FROM organization_members om
      JOIN users u ON om.user_id = u.id
      JOIN roles r ON om.role_id = r.id
      ${whereClause};
    `;
    const res = await db.query<{ total: number }>(query, params);
    return res.rows[0]?.total || 0;
  }

  /**
   * Tìm lời mời đang chờ chấp nhận của user trong tổ chức
   */
  public static async findPendingInvite(
    organizationId: string,
    userId: string,
    client?: PoolClient
  ): Promise<{ id: string; org_name: string; role_code: string } | null> {
    const db = client || pool;
    const query = `
      SELECT om.id, o.name AS org_name, r.code AS role_code
      FROM organization_members om
      JOIN organizations o ON om.organization_id = o.id
      JOIN roles r ON om.role_id = r.id
      WHERE om.organization_id = $1 
        AND om.user_id = $2 
        AND om.status = 'INVITED' 
        AND o.deleted_at IS NULL
      LIMIT 1;
    `;
    const res = await db.query<{ id: string; org_name: string; role_code: string }>(query, [
      organizationId,
      userId,
    ]);
    return res.rows[0] || null;
  }

  /**
   * Tìm lời mời theo ID bản ghi thành viên và ID của user
   */
  public static async findPendingInviteById(
    inviteId: string,
    userId: string,
    client?: PoolClient
  ): Promise<{ id: string; organization_id: string; org_name: string; role_code: string } | null> {
    const db = client || pool;
    const query = `
      SELECT om.id, om.organization_id, o.name AS org_name, r.code AS role_code
      FROM organization_members om
      JOIN organizations o ON om.organization_id = o.id
      JOIN roles r ON om.role_id = r.id
      WHERE om.id = $1 
        AND om.user_id = $2 
        AND om.status = 'INVITED' 
        AND o.deleted_at IS NULL
      LIMIT 1;
    `;
    const res = await db.query<{ id: string; organization_id: string; org_name: string; role_code: string }>(query, [
      inviteId,
      userId,
    ]);
    return res.rows[0] || null;
  }

  /**
   * Đếm số lượng thành viên đang giữ vai trò cụ thể và còn ACTIVE
   */
  public static async countActiveRoleByOrg(
    organizationId: string,
    roleCode: string,
    client?: PoolClient
  ): Promise<number> {
    const db = client || pool;
    const query = `
      SELECT COUNT(*)::int AS count 
      FROM organization_members om 
      JOIN roles r ON om.role_id = r.id 
      WHERE om.organization_id = $1 AND r.code = $2 AND om.status = 'ACTIVE';
    `;
    const res = await db.query<{ count: number }>(query, [organizationId, roleCode]);
    return res.rows[0]?.count || 0;
  }

  /**
   * Cập nhật thông tin thành viên (Role, Status, joined_at, invited_by)
   */
  public static async update(
    client: PoolClient | undefined,
    memberId: string,
    updates: {
      role_id?: string;
      status?: MemberStatus;
      joined_at?: Date | null;
      invited_by?: string | null;
    }
  ): Promise<IOrganizationMember> {
    const db = client || pool;
    const setClauses: string[] = [];
    const params: any[] = [memberId];
    let paramIndex = 2;

    if (updates.role_id !== undefined) {
      setClauses.push(`role_id = $${paramIndex++}`);
      params.push(updates.role_id);
    }
    if (updates.status !== undefined) {
      setClauses.push(`status = $${paramIndex++}`);
      params.push(updates.status);
    }
    if (updates.joined_at !== undefined) {
      setClauses.push(`joined_at = $${paramIndex++}`);
      params.push(updates.joined_at);
    }
    if (updates.invited_by !== undefined) {
      setClauses.push(`invited_by = $${paramIndex++}`);
      params.push(updates.invited_by);
    }

    setClauses.push('updated_at = NOW()');

    const query = `
      UPDATE organization_members
      SET ${setClauses.join(', ')}
      WHERE id = $1
      RETURNING *;
    `;
    const res = await db.query<IOrganizationMember>(query, params);
    return res.rows[0];
  }

  /**
   * Đổi trạng thái thành viên (ví dụ: REMOVED)
   */
  public static async setStatus(
    client: PoolClient | undefined,
    memberId: string,
    status: MemberStatus
  ): Promise<boolean> {
    const db = client || pool;
    const query = `
      UPDATE organization_members 
      SET status = $2, updated_at = NOW() 
      WHERE id = $1;
    `;
    const res = await db.query(query, [memberId, status]);
    return (res.rowCount || 0) > 0;
  }

  /**
   * Tìm chi tiết một thành viên theo orgId và userId
   */
  public static async findDetail(
    organizationId: string,
    userId: string,
    client?: PoolClient
  ): Promise<IOrganizationMemberDetail | null> {
    const db = client || pool;
    const query = `
      SELECT 
        om.id, om.organization_id, om.user_id, om.role_id, om.status, om.invited_by, om.joined_at, om.created_at, om.updated_at,
        u.email AS user_email, u.full_name AS user_full_name, u.avatar_url AS user_avatar_url, u.status AS user_status,
        r.code AS role_code, r.name AS role_name, r.description AS role_description,
        inv.id AS inviter_id, inv.email AS inviter_email, inv.full_name AS inviter_full_name
      FROM organization_members om
      JOIN users u ON om.user_id = u.id
      JOIN roles r ON om.role_id = r.id
      LEFT JOIN users inv ON om.invited_by = inv.id
      WHERE om.organization_id = $1 AND om.user_id = $2
      LIMIT 1;
    `;
    const res = await db.query(query, [organizationId, userId]);
    if (res.rows.length === 0) return null;
    const row = res.rows[0];
    return {
      id: row.id,
      organization_id: row.organization_id,
      user: {
        id: row.user_id,
        email: row.user_email,
        full_name: row.user_full_name,
        avatar_url: row.user_avatar_url,
        status: row.user_status,
      },
      role: {
        id: row.role_id,
        code: row.role_code,
        name: row.role_name,
        description: row.role_description,
      },
      status: row.status,
      inviter: row.inviter_id
        ? {
            id: row.inviter_id,
            email: row.inviter_email,
            full_name: row.inviter_full_name,
          }
        : null,
      joined_at: row.joined_at,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  /**
   * Tìm người dùng theo email để phục vụ mời vào tổ chức
   */
  public static async findUserByEmail(
    email: string,
    client?: PoolClient
  ): Promise<{ id: string; email: string; full_name: string; avatar_url: string | null; status: string } | null> {
    const db = client || pool;
    const query = `
      SELECT id, email, full_name, avatar_url, status 
      FROM users 
      WHERE LOWER(email) = LOWER($1) AND deleted_at IS NULL 
      LIMIT 1;
    `;
    const res = await db.query(query, [email.trim()]);
    return res.rows[0] || null;
  }

  /**
   * Tìm người dùng theo ID (để lấy thông tin người mời)
   */
  public static async findUserById(
    userId: string,
    client?: PoolClient
  ): Promise<{ id: string; email: string; full_name: string } | null> {
    const db = client || pool;
    const query = `
      SELECT id, email, full_name 
      FROM users 
      WHERE id = $1 
      LIMIT 1;
    `;
    const res = await db.query(query, [userId]);
    return res.rows[0] || null;
  }
}
