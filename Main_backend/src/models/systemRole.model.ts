import { PoolClient } from 'pg';
import { pool } from '../config/database';

/**
 * Model và Kiểu dữ liệu cho Vai trò Quản trị Toàn Hệ thống (System Roles)
 * Khớp với bảng `system_roles` và `user_system_roles` trong PostgreSQL
 */

export type SystemRoleType = 'SUPER_ADMIN' | 'SYSTEM_ADMIN' | 'ADMIN' | 'USER' | string;

/**
 * Interface đại diện cho một bản ghi trong bảng `system_roles`
 */
export interface ISystemRole {
    id: string;
    name: SystemRoleType;
    description?: string | null;
    created_at: Date;
    updated_at: Date;
}

/**
 * Interface đại diện cho bảng liên kết `user_system_roles`
 */
export interface IUserSystemRole {
    user_id: string;
    system_role_id: string;
    assigned_at: Date;
    assigned_by?: string | null;
}

/**
 * Chi tiết vai trò hệ thống gán cho người dùng kèm thông tin vai trò
 */
export interface IUserSystemRoleDetail {
    role_id: string;
    role_name: string;
    description?: string | null;
    assigned_at: Date;
    assigned_by?: string | null;
}

/**
 * DTO gán vai trò hệ thống cho người dùng
 */
export interface IAssignSystemRoleDto {
    user_id: string;
    role_name_or_id: string;
    assigned_by?: string;
}

/**
 * DTO thu hồi vai trò hệ thống của người dùng
 */
export interface IRevokeSystemRoleDto {
    user_id: string;
    role_name_or_id: string;
}

export class SystemRoleModel {
    /**
     * Lấy danh sách tất cả vai trò hệ thống từ DB
     */
    public static async findAll(client?: PoolClient): Promise<ISystemRole[]> {
        const db = client || pool;
        const result = await db.query<ISystemRole>(
            'SELECT id, name, description, created_at, updated_at FROM system_roles ORDER BY created_at ASC'
        );
        return result.rows;
    }

    /**
     * Lấy danh sách vai trò hệ thống của một người dùng kèm thông tin chi tiết
     */
    public static async getUserRoles(userId: string, client?: PoolClient): Promise<IUserSystemRoleDetail[]> {
        const db = client || pool;
        const sql = `
            SELECT 
                sr.id AS role_id,
                sr.name AS role_name,
                sr.description,
                usr.assigned_at,
                usr.assigned_by
            FROM user_system_roles usr
            JOIN system_roles sr ON usr.system_role_id = sr.id
            WHERE usr.user_id = $1
            ORDER BY usr.assigned_at ASC
        `;
        const result = await db.query<IUserSystemRoleDetail>(sql, [userId]);
        return result.rows;
    }

    /**
     * Tìm vai trò theo ID hoặc theo Tên vai trò
     */
    public static async findByNameOrId(
        roleNameOrId: string,
        isUuid: boolean,
        client?: PoolClient
    ): Promise<{ id: string; name: string } | null> {
        const db = client || pool;
        const query = isUuid
            ? 'SELECT id, name FROM system_roles WHERE id = $1 LIMIT 1'
            : 'SELECT id, name FROM system_roles WHERE UPPER(name) = UPPER($1) LIMIT 1';
        const result = await db.query<{ id: string; name: string }>(query, [roleNameOrId]);
        return result.rows[0] || null;
    }

    /**
     * Gán vai trò cho người dùng trong DB (idempotent ON CONFLICT DO NOTHING)
     */
    public static async assignRole(
        userId: string,
        roleId: string,
        assignedBy?: string | null,
        client?: PoolClient
    ): Promise<void> {
        const db = client || pool;
        const sql = `
            INSERT INTO user_system_roles (user_id, system_role_id, assigned_by)
            VALUES ($1, $2, $3)
            ON CONFLICT (user_id, system_role_id) DO NOTHING
        `;
        await db.query(sql, [userId, roleId, assignedBy || null]);
    }

    /**
     * Thu hồi vai trò của người dùng
     */
    public static async revokeRole(
        userId: string,
        roleId: string,
        client?: PoolClient
    ): Promise<void> {
        const db = client || pool;
        await db.query(
            'DELETE FROM user_system_roles WHERE user_id = $1 AND system_role_id = $2',
            [userId, roleId]
        );
    }

    /**
     * Kiểm tra người dùng có một trong các vai trò được chỉ định không
     */
    public static async hasAnyRole(
        userId: string,
        upperRoleNames: string[],
        client?: PoolClient
    ): Promise<boolean> {
        const db = client || pool;
        const sql = `
            SELECT 1 
            FROM (
                SELECT sr.name 
                FROM user_system_roles usr
                JOIN system_roles sr ON usr.system_role_id = sr.id
                WHERE usr.user_id = $1
                UNION
                SELECT r.code AS name
                FROM organization_members om
                JOIN roles r ON om.role_id = r.id
                WHERE om.user_id = $1 AND om.status != 'REMOVED'
            ) all_roles
            WHERE UPPER(all_roles.name) = ANY($2::text[])
            LIMIT 1
        `;
        const result = await db.query(sql, [userId, upperRoleNames]);
        return result.rows.length > 0;
    }
}
