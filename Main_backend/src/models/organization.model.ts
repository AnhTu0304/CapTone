import { PoolClient } from 'pg';
import { pool } from '../config/database';
import { IOrganizationProfile } from './organizationProfile.model';
export * from './organizationProfile.model';

/**
 * Model và Kiểu dữ liệu cho Tổ chức (Organizations)
 * Khớp với bảng `organizations` trong PostgreSQL
 */

export type OrganizationStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';

export interface IOrganization {
  id: string;
  name: string;
  slug: string;
  type?: string | null;
  description?: string | null;
  status: OrganizationStatus;
  created_by?: string | null;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date | null;
}

export interface IOrganizationDetail extends IOrganization {
  profile?: IOrganizationProfile | null;
  role_in_org?: string | null;
  members_count?: number;
}

export interface ICreateOrganizationDto {
  name: string;
  slug?: string;
  type?: string;
  description?: string;
  // Các trường hồ sơ mở rộng (Profile)
  email?: string;
  phone?: string;
  website?: string;
  address?: string;
  city?: string;
  country?: string;
  timezone?: string;
}

export interface IUpdateOrganizationDto {
  name?: string;
  type?: string;
  description?: string;
  status?: OrganizationStatus;
  // Các trường hồ sơ mở rộng (Profile)
  email?: string;
  phone?: string;
  website?: string;
  address?: string;
  city?: string;
  country?: string;
  timezone?: string;
}

export interface IOrganizationQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: OrganizationStatus;
  sort_by?: 'created_at' | 'name' | 'status';
  order?: 'ASC' | 'DESC' | 'asc' | 'desc';
}

export class OrganizationModel {
  /**
   * Tạo bản ghi tổ chức mới
   */
  public static async create(
    client: PoolClient | undefined,
    data: {
      name: string;
      slug: string;
      type?: string | null;
      description?: string | null;
      status: OrganizationStatus;
      created_by?: string | null;
    }
  ): Promise<IOrganization> {
    const db = client || pool;
    const query = `
      INSERT INTO organizations (name, slug, type, description, status, created_by)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *;
    `;
    const res = await db.query<IOrganization>(query, [
      data.name.trim(),
      data.slug,
      data.type?.trim() || null,
      data.description?.trim() || null,
      data.status || 'ACTIVE',
      data.created_by || null,
    ]);
    return res.rows[0];
  }

  /**
   * Tìm tổ chức theo ID
   */
  public static async findById(
    id: string,
    client?: PoolClient
  ): Promise<IOrganization | null> {
    const db = client || pool;
    const query = 'SELECT * FROM organizations WHERE id = $1 AND deleted_at IS NULL LIMIT 1;';
    const res = await db.query<IOrganization>(query, [id]);
    return res.rows[0] || null;
  }

  /**
   * Tìm tổ chức theo Slug
   */
  public static async findBySlug(
    slug: string,
    client?: PoolClient
  ): Promise<IOrganization | null> {
    const db = client || pool;
    const query = 'SELECT * FROM organizations WHERE slug = $1 AND deleted_at IS NULL LIMIT 1;';
    const res = await db.query<IOrganization>(query, [slug]);
    return res.rows[0] || null;
  }

  /**
   * Lấy danh sách tổ chức chi tiết kèm Profile và số thành viên
   */
  public static async findManyWithDetails(
    filter: {
      isSystemAdmin: boolean;
      userId: string;
      search?: string;
      status?: OrganizationStatus;
      sortBy?: string;
      order?: string;
      limit: number;
      offset: number;
    },
    client?: PoolClient
  ): Promise<IOrganizationDetail[]> {
    const db = client || pool;
    const conditions: string[] = ['o.deleted_at IS NULL'];
    const params: any[] = [];
    let paramIndex = 1;

    // Phân quyền dữ liệu Multi-Tenant
    if (!filter.isSystemAdmin) {
      conditions.push(
        `EXISTS (
          SELECT 1 FROM organization_members om 
          WHERE om.organization_id = o.id 
            AND om.user_id = $${paramIndex} 
            AND om.status != 'REMOVED'
        )`
      );
      params.push(filter.userId);
      paramIndex++;
    }

    if (filter.search && filter.search.trim() !== '') {
      conditions.push(
        `(o.name ILIKE $${paramIndex} OR o.slug ILIKE $${paramIndex} OR o.description ILIKE $${paramIndex})`
      );
      params.push(`%${filter.search.trim()}%`);
      paramIndex++;
    }

    if (filter.status) {
      conditions.push(`o.status = $${paramIndex}`);
      params.push(filter.status);
      paramIndex++;
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const validSortFields = ['created_at', 'name', 'status'];
    const sortBy = validSortFields.includes(filter.sortBy || '') ? filter.sortBy : 'created_at';
    const order = filter.order?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const query = `
      SELECT 
        o.id, o.name, o.slug, o.type, o.description, o.status, o.created_by, o.created_at, o.updated_at,
        op.id AS profile_id, op.email AS profile_email, op.phone AS profile_phone, op.website AS profile_website,
        op.address AS profile_address, op.city AS profile_city, op.country AS profile_country, op.timezone AS profile_timezone,
        r.code AS role_in_org,
        (SELECT COUNT(*)::int FROM organization_members om2 WHERE om2.organization_id = o.id AND om2.status = 'ACTIVE') AS members_count
      FROM organizations o
      LEFT JOIN organization_profiles op ON o.id = op.organization_id
      LEFT JOIN organization_members cur_om ON o.id = cur_om.organization_id AND cur_om.user_id = $${paramIndex}
      LEFT JOIN roles r ON cur_om.role_id = r.id
      ${whereClause}
      ORDER BY o.${sortBy} ${order}
      LIMIT $${paramIndex + 1} OFFSET $${paramIndex + 2};
    `;

    params.push(filter.userId, filter.limit, filter.offset);
    const res = await db.query(query, params);

    return res.rows.map((row) => ({
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
      profile: row.profile_id
        ? {
            id: row.profile_id,
            organization_id: row.id,
            description: row.description,
            email: row.profile_email,
            phone: row.profile_phone,
            website: row.profile_website,
            address: row.profile_address,
            city: row.profile_city,
            country: row.profile_country,
            timezone: row.profile_timezone,
            created_at: row.created_at,
            updated_at: row.updated_at,
          }
        : null,
    }));
  }

  /**
   * Đếm tổng số tổ chức theo bộ lọc
   */
  public static async count(
    filter: {
      isSystemAdmin: boolean;
      userId: string;
      search?: string;
      status?: OrganizationStatus;
    },
    client?: PoolClient
  ): Promise<number> {
    const db = client || pool;
    const conditions: string[] = ['o.deleted_at IS NULL'];
    const params: any[] = [];
    let paramIndex = 1;

    if (!filter.isSystemAdmin) {
      conditions.push(
        `EXISTS (
          SELECT 1 FROM organization_members om 
          WHERE om.organization_id = o.id 
            AND om.user_id = $${paramIndex} 
            AND om.status != 'REMOVED'
        )`
      );
      params.push(filter.userId);
      paramIndex++;
    }

    if (filter.search && filter.search.trim() !== '') {
      conditions.push(
        `(o.name ILIKE $${paramIndex} OR o.slug ILIKE $${paramIndex} OR o.description ILIKE $${paramIndex})`
      );
      params.push(`%${filter.search.trim()}%`);
      paramIndex++;
    }

    if (filter.status) {
      conditions.push(`o.status = $${paramIndex}`);
      params.push(filter.status);
      paramIndex++;
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;
    const query = `SELECT COUNT(DISTINCT o.id)::int AS total FROM organizations o ${whereClause};`;
    const res = await db.query<{ total: number }>(query, params);
    return res.rows[0]?.total || 0;
  }

  /**
   * Lấy chi tiết 1 tổ chức theo ID
   */
  public static async findDetailById(
    id: string,
    userId: string,
    client?: PoolClient
  ): Promise<(IOrganizationDetail & { member_status?: string }) | null> {
    const db = client || pool;
    const query = `
      SELECT 
        o.id, o.name, o.slug, o.type, o.description, o.status, o.created_by, o.created_at, o.updated_at, o.deleted_at,
        op.id AS profile_id, op.email AS profile_email, op.phone AS profile_phone, op.website AS profile_website,
        op.address AS profile_address, op.city AS profile_city, op.country AS profile_country, op.timezone AS profile_timezone,
        r.code AS role_in_org, cur_om.status AS member_status,
        (SELECT COUNT(*)::int FROM organization_members om2 WHERE om2.organization_id = o.id AND om2.status = 'ACTIVE') AS members_count
      FROM organizations o
      LEFT JOIN organization_profiles op ON o.id = op.organization_id
      LEFT JOIN organization_members cur_om ON o.id = cur_om.organization_id AND cur_om.user_id = $2
      LEFT JOIN roles r ON cur_om.role_id = r.id
      WHERE o.id = $1 AND o.deleted_at IS NULL
      LIMIT 1;
    `;
    const res = await db.query(query, [id, userId]);
    if (res.rows.length === 0) return null;

    const row = res.rows[0];
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
      member_status: row.member_status || undefined,
      members_count: row.members_count || 0,
      profile: row.profile_id
        ? {
            id: row.profile_id,
            organization_id: row.id,
            description: row.description,
            email: row.profile_email,
            phone: row.profile_phone,
            website: row.profile_website,
            address: row.profile_address,
            city: row.profile_city,
            country: row.profile_country,
            timezone: row.profile_timezone,
            created_at: row.created_at,
            updated_at: row.updated_at,
          }
        : null,
    };
  }

  /**
   * Cập nhật các trường bảng organizations
   */
  public static async update(
    client: PoolClient | undefined,
    id: string,
    data: { name?: string; type?: string; description?: string; status?: OrganizationStatus }
  ): Promise<IOrganization | null> {
    const db = client || pool;
    const updates: string[] = [];
    const params: any[] = [id];
    let paramIndex = 2;

    if (data.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      params.push(data.name.trim());
    }
    if (data.type !== undefined) {
      updates.push(`type = $${paramIndex++}`);
      params.push(data.type.trim() || null);
    }
    if (data.description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      params.push(data.description.trim() || null);
    }
    if (data.status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      params.push(data.status);
    }

    if (updates.length === 0) {
      return this.findById(id, client);
    }

    updates.push('updated_at = NOW()');
    const query = `
      UPDATE organizations
      SET ${updates.join(', ')}
      WHERE id = $1
      RETURNING *;
    `;
    const res = await db.query<IOrganization>(query, params);
    return res.rows[0] || null;
  }

  /**
   * Xóa mềm tổ chức
   */
  public static async softDelete(
    client: PoolClient | undefined,
    id: string
  ): Promise<boolean> {
    const db = client || pool;
    const query = `
      UPDATE organizations 
      SET deleted_at = NOW(), status = 'INACTIVE', updated_at = NOW() 
      WHERE id = $1;
    `;
    const res = await db.query(query, [id]);
    return (res.rowCount || 0) > 0;
  }

  /**
   * Lấy danh sách các tổ chức mà một User đang tham gia (Active membership)
   * Kèm thông tin vai trò trong tổ chức, profile, và số lượng thành viên
   */
  public static async findOrganizationsByUserId(
    userId: string,
    client?: PoolClient
  ): Promise<IOrganizationDetail[]> {
    const db = client || pool;
    const query = `
      SELECT 
        o.id, o.name, o.slug, o.type, o.description, o.status, o.created_by, o.created_at, o.updated_at,
        op.id AS profile_id, op.email AS profile_email, op.phone AS profile_phone, op.website AS profile_website,
        op.address AS profile_address, op.city AS profile_city, op.country AS profile_country, op.timezone AS profile_timezone,
        r.code AS role_in_org,
        (SELECT COUNT(*)::int FROM organization_members om2 WHERE om2.organization_id = o.id AND om2.status = 'ACTIVE') AS members_count
      FROM organizations o
      JOIN organization_members cur_om ON o.id = cur_om.organization_id
      JOIN roles r ON cur_om.role_id = r.id
      LEFT JOIN organization_profiles op ON o.id = op.organization_id
      WHERE cur_om.user_id = $1 
        AND cur_om.status = 'ACTIVE' 
        AND o.deleted_at IS NULL
      ORDER BY cur_om.created_at ASC;
    `;
    const res = await db.query(query, [userId]);
    return res.rows.map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      type: row.type,
      description: row.description,
      status: row.status,
      created_by: row.created_by,
      created_at: row.created_at,
      updated_at: row.updated_at,
      role_in_org: row.role_in_org,
      members_count: row.members_count || 0,
      profile: row.profile_id
        ? {
            id: row.profile_id,
            organization_id: row.id,
            description: row.description,
            email: row.profile_email,
            phone: row.profile_phone,
            website: row.profile_website,
            address: row.profile_address,
            city: row.profile_city,
            country: row.profile_country,
            timezone: row.profile_timezone,
            created_at: row.created_at,
            updated_at: row.updated_at,
          }
        : null,
    }));
  }

  /**
   * Lấy danh sách tất cả các lời mời đang chờ chấp nhận của User trên toàn hệ thống
   */
  public static async findPendingInvitationsByUserId(
    userId: string,
    client?: PoolClient
  ): Promise<Array<{
    id: string;
    organization: {
      id: string;
      name: string;
      slug: string;
      description?: string | null;
    };
    role: {
      id: string;
      code: string;
      name: string;
    };
    inviter?: {
      id: string;
      full_name: string;
      email: string;
    } | null;
    created_at: Date;
  }>> {
    const db = client || pool;
    const query = `
      SELECT 
        om.id, om.created_at,
        o.id AS org_id, o.name AS org_name, o.slug AS org_slug, o.description AS org_description,
        r.id AS role_id, r.code AS role_code, r.name AS role_name,
        inv.id AS inviter_id, inv.full_name AS inviter_full_name, inv.email AS inviter_email
      FROM organization_members om
      JOIN organizations o ON om.organization_id = o.id
      JOIN roles r ON om.role_id = r.id
      LEFT JOIN users inv ON om.invited_by = inv.id
      WHERE om.user_id = $1 
        AND om.status = 'INVITED' 
        AND o.deleted_at IS NULL
      ORDER BY om.created_at DESC;
    `;
    const res = await db.query(query, [userId]);
    return res.rows.map((row) => ({
      id: row.id,
      organization: {
        id: row.org_id,
        name: row.org_name,
        slug: row.org_slug,
        description: row.org_description,
      },
      role: {
        id: row.role_id,
        code: row.role_code,
        name: row.role_name,
      },
      inviter: row.inviter_id
        ? {
            id: row.inviter_id,
            full_name: row.inviter_full_name,
            email: row.inviter_email,
          }
        : null,
      created_at: row.created_at,
    }));
  }
}
