import { PoolClient } from 'pg';
import { pool } from '../config/database';

/**
 * Model và Kiểu dữ liệu cho User (Người dùng)
 * Khớp với bảng `users` trong cơ sở dữ liệu PostgreSQL (selfheal_erd_v2_postgresql.sql)
 */

// Trạng thái tài khoản theo ENUM user_status trong PostgreSQL
export type UserStatus = 'PENDING' | 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';

/**
 * Interface đại diện cho một bản ghi đầy đủ trong bảng `users`
 */
export interface IUser {
    id: string;
    email: string;
    password_hash?: string;
    full_name: string;
    avatar_url?: string | null;
    phone?: string | null;
    job_title?: string | null;
    status: UserStatus;
    email_verified_at?: Date | null;
    last_login_at?: Date | null;
    created_at: Date;
    updated_at: Date;
    deleted_at?: Date | null;
}

/**
 * Interface an toàn trả về cho Client (Loại bỏ mật khẩu băm password_hash)
 */
export interface IUserOrgRole {
    organization_id: string;
    organization_name: string;
    role_name: string;
    role_code: string;
    member_status: string;
}

export type IUserResponse = Omit<IUser, 'password_hash'> & {
    system_roles?: string[];
    organization_roles?: IUserOrgRole[];
};

export interface IUserProfileResponse {
    id: string;
    email: string;
    full_name: string;
    fullName: string;
    avatar_url: string | null;
    avatarUrl: string | null;
    phone: string | null;
    job_title: string | null;
    jobTitle: string | null;
    status: UserStatus;
    accountStatus: UserStatus;
    system_roles: string[];
    systemRole: string;
    organization: {
        id: string;
        name: string;
        slug: string;
    } | null;
    organization_role: string | null;
    organizationRole: string | null;
    email_verified_at: Date | null;
    emailVerifiedAt: Date | null;
    last_login_at: Date | null;
    lastLoginAt: Date | null;
    created_at: Date;
    createdAt: Date;
    updated_at: Date;
    updatedAt: Date;
}

/**
 * DTO cập nhật thông tin cá nhân
 */
export interface IUpdateUserDto {
    full_name?: string;
    avatar_url?: string | null;
    phone?: string | null;
    job_title?: string | null;
    status?: UserStatus;
}

/**
 * DTO đổi mật khẩu
 */
export interface IChangePasswordDto {
    old_password: string;
    new_password: string;
}

/**
 * Interface cho tham số phân trang, tìm kiếm và lọc danh sách người dùng
 */
export interface IUserQuery {
    page?: number;
    limit?: number;
    search?: string;     // Tìm kiếm tổng hợp (name, email hoặc id)
    name?: string;       // Tìm kiếm chính xác hoặc chứa theo họ tên
    email?: string;      // Tìm kiếm chính xác hoặc chứa theo email
    id?: string;         // Tìm kiếm theo ID (UUID)
    status?: UserStatus; // Lọc theo trạng thái PENDING, ACTIVE, INACTIVE, SUSPENDED
    sort_by?: 'created_at' | 'full_name' | 'email' | 'last_login_at';
    order?: 'ASC' | 'DESC';
}

/**
 * Interface kết quả phân trang dùng chung
 */
export interface IPaginatedResult<T> {
    items: T[];
    pagination: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    };
}

export class UserModel {
    /**
     * Tìm người dùng theo ID (chỉ các trường an toàn)
     */
    public static async findById(userId: string, client?: PoolClient): Promise<IUserResponse | null> {
        const db = client || pool;
        const querySql = `
          SELECT id, email, full_name, avatar_url, phone, job_title, status, email_verified_at, last_login_at, created_at, updated_at
          FROM users 
          WHERE id = $1 AND deleted_at IS NULL
          LIMIT 1
        `;
        const result = await db.query<IUserResponse>(querySql, [userId]);
        return result.rows[0] || null;
    }

    /**
     * Lấy danh sách tên vai trò hệ thống của người dùng
     */
    public static async getUserRoles(userId: string, client?: PoolClient): Promise<string[]> {
        const db = client || pool;
        const rolesRes = await db.query<{ name: string }>(
            `SELECT sr.name 
             FROM user_system_roles usr 
             JOIN system_roles sr ON usr.system_role_id = sr.id 
             WHERE usr.user_id = $1 
             UNION 
             SELECT r.code AS name 
             FROM organization_members om 
             JOIN roles r ON om.role_id = r.id 
             WHERE om.user_id = $1 AND om.status != 'REMOVED' 
             ORDER BY name ASC`,
            [userId]
        );
        return rolesRes.rows.map((r) => r.name);
    }

    /**
     * Tìm người dùng theo email (kèm password_hash phục vụ xác thực đăng nhập)
     */
    public static async findByEmailWithPassword(email: string, client?: PoolClient): Promise<IUser | null> {
        const db = client || pool;
        const querySql = `
          SELECT id, email, password_hash, status, email_verified_at
          FROM users WHERE email = $1 AND deleted_at IS NULL LIMIT 1
        `;
        const result = await db.query<IUser>(querySql, [email]);
        return result.rows[0] || null;
    }

    /**
     * Kiểm tra sự tồn tại của email
     */
    public static async findByEmail(email: string, client?: PoolClient): Promise<{ id: string } | null> {
        const db = client || pool;
        const result = await db.query<{ id: string }>(
            'SELECT id FROM users WHERE email = $1 AND deleted_at IS NULL LIMIT 1',
            [email]
        );
        return result.rows[0] || null;
    }

    /**
     * Tìm thông tin người dùng theo email (đầy đủ các trường an toàn)
     */
    public static async findFullByEmail(email: string, client?: PoolClient): Promise<IUserResponse | null> {
        const db = client || pool;
        const querySql = `
          SELECT id, email, full_name, avatar_url, phone, job_title, status, email_verified_at, last_login_at, created_at, updated_at
          FROM users WHERE email = $1 AND deleted_at IS NULL LIMIT 1
        `;
        const result = await db.query<IUserResponse>(querySql, [email]);
        return result.rows[0] || null;
    }

    /**
     * Đếm tổng số bản ghi thỏa mãn điều kiện lọc
     */
    public static async count(whereClause: string, params: unknown[], client?: PoolClient): Promise<number> {
        const db = client || pool;
        const countQuery = `SELECT COUNT(*) AS total FROM users ${whereClause}`;
        const countResult = await db.query(countQuery, params);
        return parseInt(countResult.rows[0].total, 10);
    }

    /**
     * Lấy danh sách người dùng phân trang
     */
    public static async findMany(
        whereClause: string,
        sortBy: string,
        order: string,
        params: unknown[],
        limit: number,
        offset: number,
        client?: PoolClient
    ): Promise<IUserResponse[]> {
        const db = client || pool;
        const queryParams = [...params, limit, offset];
        const usersQuery = `
          SELECT 
            users.id, 
            users.email, 
            users.full_name, 
            users.avatar_url, 
            users.phone,
            users.job_title,
            users.status, 
            users.email_verified_at, 
            users.last_login_at, 
            users.created_at, 
            users.updated_at,
            COALESCE(
              (
                SELECT json_agg(sr.name ORDER BY usr.assigned_at ASC)
                FROM user_system_roles usr
                JOIN system_roles sr ON usr.system_role_id = sr.id
                WHERE usr.user_id = users.id
              ),
              '[]'::json
            ) AS system_roles,
            COALESCE(
              (
                SELECT json_agg(json_build_object(
                  'organization_id', o.id,
                  'organization_name', o.name,
                  'role_name', r.name,
                  'role_code', r.code,
                  'member_status', om.status
                ))
                FROM organization_members om
                JOIN organizations o ON om.organization_id = o.id
                JOIN roles r ON om.role_id = r.id
                WHERE om.user_id = users.id AND om.status != 'REMOVED'
              ),
              '[]'::json
            ) AS organization_roles
          FROM users
          ${whereClause}
          ORDER BY ${sortBy} ${order}
          LIMIT $${params.length + 1} OFFSET $${params.length + 2}
        `;
        const usersResult = await db.query<IUserResponse>(usersQuery, queryParams);
        return usersResult.rows;
    }

    /**
     * Tạo mới người dùng
     */
    public static async create(
        data: { email: string; password_hash?: string | null; full_name: string; status?: UserStatus; avatar_url?: string | null; email_verified_at?: Date | null },
        client?: PoolClient
    ): Promise<IUserResponse> {
        const db = client || pool;
        const insertSql = `
          INSERT INTO users (email, password_hash, full_name, avatar_url, status, email_verified_at)
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING id, email, full_name, avatar_url, status, email_verified_at, last_login_at, created_at, updated_at
        `;
        const result = await db.query<IUserResponse>(insertSql, [
            data.email,
            data.password_hash || null,
            data.full_name,
            data.avatar_url || null,
            data.status || 'ACTIVE',
            data.email_verified_at || null,
        ]);
        return result.rows[0];
    }

    /**
     * Cập nhật thông tin profile
     */
    public static async updateProfile(
        userId: string,
        data: { full_name?: string | null; avatar_url?: string | null; phone?: string | null; job_title?: string | null },
        client?: PoolClient
    ): Promise<IUserResponse | null> {
        const db = client || pool;
        const updates: string[] = ['updated_at = NOW()'];
        const values: any[] = [];
        let idx = 1;

        if (data.full_name !== undefined) {
            updates.push(`full_name = $${idx++}`);
            values.push(data.full_name);
        }
        if (data.avatar_url !== undefined) {
            updates.push(`avatar_url = $${idx++}`);
            values.push(data.avatar_url);
        }
        if (data.phone !== undefined) {
            updates.push(`phone = $${idx++}`);
            values.push(data.phone);
        }
        if (data.job_title !== undefined) {
            updates.push(`job_title = $${idx++}`);
            values.push(data.job_title);
        }

        values.push(userId);
        const query = `
            UPDATE users 
            SET ${updates.join(', ')}
            WHERE id = $${idx} AND deleted_at IS NULL
            RETURNING id, email, full_name, avatar_url, phone, job_title, status, email_verified_at, last_login_at, created_at, updated_at
        `;
        const result = await db.query<IUserResponse>(query, values);
        return result.rows[0] || null;
    }

    /**
     * Lấy mật khẩu băm hiện tại của người dùng
     */
    public static async getPasswordHash(userId: string, client?: PoolClient): Promise<string | null> {
        const db = client || pool;
        const result = await db.query<{ password_hash: string }>(
            'SELECT password_hash FROM users WHERE id = $1 AND deleted_at IS NULL',
            [userId]
        );
        return result.rows[0]?.password_hash || null;
    }

    /**
     * Cập nhật mật khẩu băm mới
     */
    public static async updatePassword(userId: string, newHash: string, client?: PoolClient): Promise<void> {
        const db = client || pool;
        await db.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [newHash, userId]);
    }

    /**
     * Lấy thông tin cơ bản phục vụ gửi email / kiểm tra trạng thái
     */
    public static async findBasicById(userId: string, client?: PoolClient): Promise<IUser | null> {
        const db = client || pool;
        const result = await db.query<IUser>(
            'SELECT id, email, full_name, email_verified_at, status FROM users WHERE id = $1 AND deleted_at IS NULL LIMIT 1',
            [userId]
        );
        return result.rows[0] || null;
    }

    /**
     * Xác thực email trực tiếp cho người dùng
     */
    public static async verifyEmail(userId: string, client?: PoolClient): Promise<IUserResponse | null> {
        const db = client || pool;
        const result = await db.query<IUserResponse>(
            `UPDATE users 
             SET email_verified_at = COALESCE(email_verified_at, NOW()),
                 status = CASE WHEN status = 'PENDING' THEN 'ACTIVE' ELSE status END,
                 updated_at = NOW()
             WHERE id = $1 AND deleted_at IS NULL
             RETURNING id, email, full_name, avatar_url, phone, job_title, status, email_verified_at, last_login_at, created_at, updated_at`,
            [userId]
        );
        return result.rows[0] || null;
    }

    /**
     * Cập nhật trạng thái người dùng
     */
    public static async updateStatus(userId: string, status: UserStatus, client?: PoolClient): Promise<IUserResponse | null> {
        const db = client || pool;
        const result = await db.query<IUserResponse>(
            `UPDATE users 
             SET status = $1,
                 updated_at = NOW()
             WHERE id = $2 AND deleted_at IS NULL
             RETURNING id, email, full_name, avatar_url, status, email_verified_at, last_login_at, created_at, updated_at`,
            [status, userId]
        );
        return result.rows[0] || null;
    }

    /**
     * Cập nhật mốc thời gian đăng nhập gần nhất
     */
    public static async updateLastLogin(userId: string, client?: PoolClient): Promise<void> {
        const db = client || pool;
        await db.query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [userId]);
    }

    /**
     * Xóa mềm tài khoản người dùng
     */
    public static async softDelete(userId: string, client?: PoolClient): Promise<number> {
        const db = client || pool;
        const result = await db.query(
            'UPDATE users SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1 AND deleted_at IS NULL',
            [userId]
        );
        return result.rowCount ?? 0;
    }

    /**
     * Kiểm tra người dùng có tồn tại không
     */
    public static async exists(userId: string, client?: PoolClient): Promise<boolean> {
        const db = client || pool;
        const userCheck = await db.query('SELECT id FROM users WHERE id = $1 AND deleted_at IS NULL LIMIT 1', [userId]);
        return userCheck.rows.length > 0;
    }

    /**
     * Kiểm tra trạng thái hoạt động và trạng thái xóa phục vụ Auth Middleware
     */
    public static async findAuthStatus(
        userId: string,
        client?: PoolClient
    ): Promise<{ id: string; status: UserStatus; deleted_at?: Date | null; roles: string[] } | null> {
        const db = client || pool;
        const sql = `
            SELECT 
                u.id, 
                u.status, 
                u.deleted_at,
                COALESCE(
                  (
                    SELECT json_agg(DISTINCT r_name)
                    FROM (
                      SELECT sr.name AS r_name
                      FROM user_system_roles usr
                      JOIN system_roles sr ON usr.system_role_id = sr.id
                      WHERE usr.user_id = u.id
                      UNION
                      SELECT r.code AS r_name
                      FROM organization_members om
                      JOIN roles r ON om.role_id = r.id
                      WHERE om.user_id = u.id AND om.status != 'REMOVED'
                    ) all_r
                  ),
                  '[]'::json
                ) AS roles
            FROM users u 
            WHERE u.id = $1 
            LIMIT 1
        `;
        const res = await db.query<{ id: string; status: UserStatus; deleted_at?: Date | null; roles: string[] }>(
            sql,
            [userId]
        );
        return res.rows[0] || null;
    }
}

// Re-export toàn bộ Auth models để duy trì tính tương thích ngược
export * from './auth.model';
