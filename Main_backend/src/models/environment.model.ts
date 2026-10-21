import { PoolClient } from 'pg';
import { pool } from '../config/database';

export type EnvironmentType = 'DEVELOPMENT' | 'STAGING' | 'TESTING' | 'PRODUCTION';
export type EnvironmentStatus = 'ACTIVE' | 'INACTIVE' | 'DISCONNECTED';

export interface IEnvironment {
  id: string;
  organization_id: string;
  name: string;
  code: string;
  environment_type: EnvironmentType;
  status: EnvironmentStatus;
  description?: string | null;
  created_by?: string | null;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date | null;
  // Computed aggregate fields
  clusters_count?: number;
  agents_count?: number;
}

export interface ICreateEnvironmentInput {
  organization_id: string;
  name: string;
  code: string;
  environment_type: EnvironmentType;
  description?: string;
  created_by?: string;
}

export interface IUpdateEnvironmentInput {
  name?: string;
  description?: string;
  environment_type?: EnvironmentType;
  status?: EnvironmentStatus;
}

export interface IEnvironmentQueryOptions {
  page?: number;
  limit?: number;
  search?: string;
  type?: EnvironmentType;
  status?: EnvironmentStatus;
}

export class EnvironmentModel {
  /**
   * Tạo mới môi trường trong tổ chức
   */
  public static async create(
    data: ICreateEnvironmentInput,
    client?: PoolClient
  ): Promise<IEnvironment> {
    const db = client || pool;
    const query = `
      INSERT INTO environments (
        organization_id, name, code, environment_type, description, created_by, status
      ) VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVE')
      RETURNING *;
    `;
    const res = await db.query(query, [
      data.organization_id,
      data.name,
      data.code.trim().toLowerCase(),
      data.environment_type,
      data.description || null,
      data.created_by || null,
    ]);
    return res.rows[0];
  }

  /**
   * Tìm môi trường theo ID (không lấy bản ghi đã soft-delete)
   */
  public static async findById(id: string, client?: PoolClient): Promise<IEnvironment | null> {
    const db = client || pool;
    const query = `
      SELECT e.*,
        (SELECT COUNT(*)::int FROM clusters c WHERE c.environment_id = e.id AND c.deleted_at IS NULL) as clusters_count,
        (SELECT COUNT(*)::int FROM agents a WHERE a.environment_id = e.id AND a.revoked_at IS NULL) as agents_count
      FROM environments e
      WHERE e.id = $1 AND e.deleted_at IS NULL;
    `;
    const res = await db.query(query, [id]);
    return res.rows[0] || null;
  }

  /**
   * Tìm môi trường theo Mã Code trong cùng một Tổ chức
   */
  public static async findByCode(
    organizationId: string,
    code: string,
    client?: PoolClient
  ): Promise<IEnvironment | null> {
    const db = client || pool;
    const query = `
      SELECT * FROM environments
      WHERE organization_id = $1 
        AND code = $2 
        AND deleted_at IS NULL
      LIMIT 1;
    `;
    const res = await db.query(query, [organizationId, code.trim().toLowerCase()]);
    return res.rows[0] || null;
  }

  /**
   * Lấy danh sách môi trường theo Tổ chức kèm phân trang, tìm kiếm, lọc
   */
  public static async findByOrgId(
    organizationId: string,
    options: IEnvironmentQueryOptions = {},
    client?: PoolClient
  ): Promise<{
    environments: IEnvironment[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const db = client || pool;
    const page = Math.max(1, options.page || 1);
    const limit = Math.max(1, Math.min(100, options.limit || 20));
    const offset = (page - 1) * limit;

    const conditions: string[] = ['e.organization_id = $1', 'e.deleted_at IS NULL'];
    const params: any[] = [organizationId];
    let paramIndex = 2;

    if (options.type) {
      conditions.push(`e.environment_type = $${paramIndex}`);
      params.push(options.type);
      paramIndex++;
    }

    if (options.status) {
      conditions.push(`e.status = $${paramIndex}`);
      params.push(options.status);
      paramIndex++;
    }

    if (options.search && options.search.trim().length > 0) {
      conditions.push(`(e.name ILIKE $${paramIndex} OR e.code ILIKE $${paramIndex})`);
      params.push(`%${options.search.trim()}%`);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');

    // Đếm tổng số bản ghi
    const countRes = await db.query(
      `SELECT COUNT(*)::int as total FROM environments e WHERE ${whereClause}`,
      params
    );
    const total = countRes.rows[0]?.total || 0;

    // Lấy dữ liệu kèm số lượng clusters và agents liên kết
    const dataQuery = `
      SELECT e.*,
        (SELECT COUNT(*)::int FROM clusters c WHERE c.environment_id = e.id AND c.deleted_at IS NULL) as clusters_count,
        (SELECT COUNT(*)::int FROM agents a WHERE a.environment_id = e.id AND a.revoked_at IS NULL) as agents_count
      FROM environments e
      WHERE ${whereClause}
      ORDER BY e.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1};
    `;
    params.push(limit, offset);

    const dataRes = await db.query(dataQuery, params);

    return {
      environments: dataRes.rows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Cập nhật thông tin môi trường
   */
  public static async update(
    id: string,
    data: IUpdateEnvironmentInput,
    client?: PoolClient
  ): Promise<IEnvironment | null> {
    const db = client || pool;
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (data.name !== undefined) {
      fields.push(`name = $${idx++}`);
      values.push(data.name);
    }
    if (data.description !== undefined) {
      fields.push(`description = $${idx++}`);
      values.push(data.description);
    }
    if (data.environment_type !== undefined) {
      fields.push(`environment_type = $${idx++}`);
      values.push(data.environment_type);
    }
    if (data.status !== undefined) {
      fields.push(`status = $${idx++}`);
      values.push(data.status);
    }

    if (fields.length === 0) {
      return this.findById(id, db as PoolClient);
    }

    fields.push(`updated_at = NOW()`);
    values.push(id);

    const query = `
      UPDATE environments
      SET ${fields.join(', ')}
      WHERE id = $${idx} AND deleted_at IS NULL
      RETURNING *;
    `;

    const res = await db.query(query, values);
    return res.rows[0] || null;
  }

  /**
   * Xóa mềm môi trường (Soft Delete)
   */
  public static async softDelete(id: string, client?: PoolClient): Promise<boolean> {
    const db = client || pool;
    const res = await db.query(
      `UPDATE environments SET deleted_at = NOW(), status = 'INACTIVE' WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );
    return (res.rowCount ?? 0) > 0;
  }

  /**
   * Đếm số cụm cluster còn hoạt động trong môi trường
   */
  public static async countClusters(environmentId: string, client?: PoolClient): Promise<number> {
    const db = client || pool;
    const res = await db.query(
      `SELECT COUNT(*)::int as count FROM clusters WHERE environment_id = $1 AND deleted_at IS NULL`,
      [environmentId]
    );
    return res.rows[0]?.count || 0;
  }

  /**
   * Đếm số agent còn liên kết trong môi trường
   */
  public static async countAgents(environmentId: string, client?: PoolClient): Promise<number> {
    const db = client || pool;
    const res = await db.query(
      `SELECT COUNT(*)::int as count FROM agents WHERE environment_id = $1 AND revoked_at IS NULL`,
      [environmentId]
    );
    return res.rows[0]?.count || 0;
  }

  /* ==========================================================================
     Backward Compatibility (Dành cho AI Service fallback cũ)
     ========================================================================== */

  /**
   * Lấy môi trường đầu tiên khả dụng
   */
  public static async findFirst(client?: PoolClient): Promise<IEnvironment | null> {
    const db = client || pool;
    try {
      const res = await db.query<IEnvironment>(
        'SELECT * FROM environments WHERE deleted_at IS NULL ORDER BY created_at ASC LIMIT 1'
      );
      return res.rows[0] || null;
    } catch {
      return null;
    }
  }

  /**
   * Tìm môi trường theo ID hoặc Tên
   */
  public static async findByIdOrName(
    idOrName: string,
    client?: PoolClient
  ): Promise<IEnvironment | null> {
    const db = client || pool;
    try {
      const res = await db.query<IEnvironment>(
        `SELECT * FROM environments 
         WHERE (id::text = $1 OR name = $1 OR code = $1) 
           AND deleted_at IS NULL 
         LIMIT 1`,
        [idOrName]
      );
      return res.rows[0] || null;
    } catch {
      return null;
    }
  }
}
