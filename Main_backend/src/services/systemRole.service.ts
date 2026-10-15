import { pool } from '../config/database';
import { ApiError } from '../utils/apiError';
import { ISystemRole, IUserSystemRoleDetail } from '../models/systemRole.model';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class SystemRoleService {
    /**
     * 1. Lấy danh sách tất cả vai trò quản trị hệ thống
     */
    public static async getAllRoles(): Promise<ISystemRole[]> {
        const result = await pool.query<ISystemRole>(
            'SELECT id, name, description, created_at, updated_at FROM system_roles ORDER BY created_at ASC'
        );
        return result.rows;
    }

    /**
     * 2. Lấy danh sách vai trò hệ thống của một người dùng
     */
    public static async getUserRoles(userId: string): Promise<IUserSystemRoleDetail[]> {
        if (!userId || !UUID_REGEX.test(userId.trim())) {
            throw new ApiError(400, 'Định dạng User ID không hợp lệ');
        }

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
        const result = await pool.query<IUserSystemRoleDetail>(sql, [userId.trim()]);
        return result.rows;
    }

    /**
     * 3. Gán vai trò hệ thống cho người dùng (theo tên vai trò hoặc role_id)
     */
    public static async assignRole(
        userId: string, 
        roleNameOrId: string, 
        assignedBy?: string
    ): Promise<void> {
        if (!userId || !UUID_REGEX.test(userId.trim())) {
            throw new ApiError(400, 'Định dạng User ID không hợp lệ');
        }

        // Tìm role theo id hoặc theo name
        const isUuid = UUID_REGEX.test(roleNameOrId.trim());
        const roleQuery = isUuid
            ? 'SELECT id, name FROM system_roles WHERE id = $1 LIMIT 1'
            : 'SELECT id, name FROM system_roles WHERE UPPER(name) = UPPER($1) LIMIT 1';

        const roleResult = await pool.query<{ id: string; name: string }>(roleQuery, [roleNameOrId.trim()]);
        if (roleResult.rows.length === 0) {
            throw new ApiError(404, `Không tìm thấy vai trò hệ thống: ${roleNameOrId}`);
        }

        const roleId = roleResult.rows[0].id;

        // Kiểm tra User có tồn tại không
        const userCheck = await pool.query('SELECT id FROM users WHERE id = $1 AND deleted_at IS NULL LIMIT 1', [userId.trim()]);
        if (userCheck.rows.length === 0) {
            throw new ApiError(404, 'Người dùng không tồn tại hoặc đã bị xóa');
        }

        // Gán vai trò (bỏ qua nếu đã được gán)
        const insertSql = `
            INSERT INTO user_system_roles (user_id, system_role_id, assigned_by)
            VALUES ($1, $2, $3)
            ON CONFLICT (user_id, system_role_id) DO NOTHING
        `;
        await pool.query(insertSql, [userId.trim(), roleId, assignedBy || null]);
    }

    /**
     * 4. Thu hồi vai trò hệ thống của người dùng
     */
    public static async revokeRole(userId: string, roleNameOrId: string): Promise<void> {
        if (!userId || !UUID_REGEX.test(userId.trim())) {
            throw new ApiError(400, 'Định dạng User ID không hợp lệ');
        }

        const isUuid = UUID_REGEX.test(roleNameOrId.trim());
        const roleQuery = isUuid
            ? 'SELECT id FROM system_roles WHERE id = $1 LIMIT 1'
            : 'SELECT id FROM system_roles WHERE UPPER(name) = UPPER($1) LIMIT 1';

        const roleResult = await pool.query<{ id: string }>(roleQuery, [roleNameOrId.trim()]);
        if (roleResult.rows.length === 0) {
            throw new ApiError(404, `Không tìm thấy vai trò hệ thống: ${roleNameOrId}`);
        }

        const roleId = roleResult.rows[0].id;
        await pool.query(
            'DELETE FROM user_system_roles WHERE user_id = $1 AND system_role_id = $2',
            [userId.trim(), roleId]
        );
    }

    /**
     * 5. Kiểm tra người dùng có một trong các vai trò được chỉ định không
     */
    public static async hasAnyRole(userId: string, roleNames: string[]): Promise<boolean> {
        if (!userId || !UUID_REGEX.test(userId.trim()) || roleNames.length === 0) {
            return false;
        }

        const upperRoleNames = roleNames.map(r => r.toUpperCase());
        const sql = `
            SELECT 1 
            FROM user_system_roles usr
            JOIN system_roles sr ON usr.system_role_id = sr.id
            WHERE usr.user_id = $1 AND UPPER(sr.name) = ANY($2::text[])
            LIMIT 1
        `;
        const result = await pool.query(sql, [userId.trim(), upperRoleNames]);
        return result.rows.length > 0;
    }
}
