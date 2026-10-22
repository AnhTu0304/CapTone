import { PoolClient } from 'pg';
import { pool } from '../config/database';

/**
 * Model và Kiểu dữ liệu cho Vai trò Cấp Tổ Chức (Organization Roles)
 * Khớp với bảng `roles` trong PostgreSQL (scope = 'ORGANIZATION')
 */

export type OrganizationRoleCode = 'SME_OWNER' | 'DEVOPS' | 'VIEWER' | string;

export interface IOrganizationRole {
  id: string;
  code: OrganizationRoleCode;
  name: string;
  description?: string | null;
  scope: string;
  created_at: Date;
}

export class OrganizationRoleModel {
  /**
   * Lấy toàn bộ danh sách vai trò cấp tổ chức
   */
  public static async findAll(client?: PoolClient): Promise<IOrganizationRole[]> {
    const db = client || pool;
    const res = await db.query<IOrganizationRole>(
      `SELECT id, code, name, description, scope, created_at 
       FROM roles 
       WHERE scope = 'ORGANIZATION' 
       ORDER BY 
         CASE 
           WHEN code = 'SME_OWNER' THEN 1
           WHEN code = 'DEVOPS' THEN 2
           WHEN code = 'VIEWER' THEN 3
           ELSE 4
         END ASC;`
    );
    return res.rows;
  }

  /**
   * Tìm vai trò theo mã Code (chỉ trong phạm vi scope = 'ORGANIZATION')
   */
  public static async findByCode(
    code: string,
    client?: PoolClient
  ): Promise<IOrganizationRole | null> {
    const db = client || pool;
    const res = await db.query<IOrganizationRole>(
      "SELECT id, code, name, description, scope, created_at FROM roles WHERE UPPER(code) = UPPER($1) AND scope = 'ORGANIZATION' LIMIT 1;",
      [code.trim()]
    );
    return res.rows[0] || null;
  }

  /**
   * Tìm vai trò theo ID (UUID)
   */
  public static async findById(
    id: string,
    client?: PoolClient
  ): Promise<IOrganizationRole | null> {
    const db = client || pool;
    const res = await db.query<IOrganizationRole>(
      "SELECT id, code, name, description, scope, created_at FROM roles WHERE id = $1 AND scope = 'ORGANIZATION' LIMIT 1;",
      [id]
    );
    return res.rows[0] || null;
  }
}
