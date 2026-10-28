import { ApiError } from '../utils/apiError';
import { ISystemRole, IUserSystemRoleDetail, SystemRoleModel } from '../models/systemRole.model';
import { UserModel } from '../models/user.model';
import { OrganizationRoleModel } from '../models/organizationRole.model';
import { pool } from '../config/database';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class SystemRoleService {
    /**
     * 1. Lấy danh sách tất cả vai trò quản trị hệ thống
     */
    public static async getAllRoles(): Promise<ISystemRole[]> {
        return SystemRoleModel.findAll();
    }

    /**
     * 2. Lấy danh sách vai trò hệ thống của một người dùng
     */
    public static async getUserRoles(userId: string): Promise<IUserSystemRoleDetail[]> {
        if (!userId || !UUID_REGEX.test(userId.trim())) {
            throw new ApiError(400, 'Định dạng User ID không hợp lệ');
        }
        return SystemRoleModel.getUserRoles(userId.trim());
    }

    /**
     * 3. Gán vai trò hệ thống hoặc tổ chức cho người dùng
     */
    public static async assignRole(
        userId: string, 
        roleNameOrId: string, 
        assignedBy?: string
    ): Promise<void> {
        if (!userId || !UUID_REGEX.test(userId.trim())) {
            throw new ApiError(400, 'Định dạng User ID không hợp lệ');
        }

        const trimmedRole = (roleNameOrId || '').trim();
        if (!trimmedRole) {
            throw new ApiError(400, 'Tên hoặc ID vai trò không được để trống');
        }

        // Kiểm tra User có tồn tại không qua UserModel
        const userExists = await UserModel.exists(userId.trim());
        if (!userExists) {
            throw new ApiError(404, 'Người dùng không tồn tại hoặc đã bị xóa');
        }

        // 1. Kiểm tra vai trò trong system_roles
        const isUuid = UUID_REGEX.test(trimmedRole);
        const systemRole = await SystemRoleModel.findByNameOrId(trimmedRole, isUuid);

        // 2. Nếu không có trong system_roles, kiểm tra trong organization roles (roles table)
        let orgRole = null;
        if (!systemRole) {
            orgRole = await OrganizationRoleModel.findByCode(trimmedRole);
        }

        if (!systemRole && !orgRole) {
            throw new ApiError(404, `Không tìm thấy vai trò hệ thống hoặc tổ chức: ${trimmedRole}`);
        }

        // 3. Kiểm tra bảo vệ Super Admin cuối cùng (Last Super Admin Protection)
        const currentRoles = await SystemRoleModel.getUserRoles(userId.trim());
        const isCurrentlySuperAdmin = currentRoles.some((r) => r.role_name.toUpperCase() === 'SUPER_ADMIN');

        const isNewRoleSuperAdmin = systemRole ? systemRole.name.toUpperCase() === 'SUPER_ADMIN' : false;

        if (isCurrentlySuperAdmin && !isNewRoleSuperAdmin) {
            const activeSuperAdminCount = await SystemRoleModel.countUsersWithRole('SUPER_ADMIN');
            if (activeSuperAdminCount <= 1) {
                throw new ApiError(
                    400,
                    'Không thể hạ cấp hoặc thu hồi Super Admin cuối cùng của hệ thống. Hệ thống phải duy trì ít nhất một Super Admin khả dụng.'
                );
            }
        }

        // 4. Thực thi gán vai trò
        if (systemRole) {
            // Thay thế vai trò hệ thống cũ bằng vai trò mới
            await SystemRoleModel.removeAllRoles(userId.trim());
            await SystemRoleModel.assignRole(userId.trim(), systemRole.id, assignedBy || null);
        } else if (orgRole) {
            // Hạ cấp khỏi vai trò hệ thống và gán vai trò tổ chức
            await SystemRoleModel.removeAllRoles(userId.trim());

            // Cập nhật hoặc tạo thành viên tổ chức
            const userOrgs = await UserModel.getUserOrganizations(userId.trim());
            if (userOrgs.length > 0) {
                await pool.query(
                    `UPDATE organization_members 
                     SET role_id = $1, updated_at = NOW() 
                     WHERE user_id = $2 AND organization_id = $3`,
                    [orgRole.id, userId.trim(), userOrgs[0].organization_id]
                );
            } else {
                // Nếu chưa thuộc tổ chức nào, gán vào tổ chức mặc định đầu tiên
                const defaultOrgRes = await pool.query('SELECT id FROM organizations WHERE deleted_at IS NULL ORDER BY created_at ASC LIMIT 1');
                if (defaultOrgRes.rows.length > 0) {
                    await pool.query(
                        `INSERT INTO organization_members (organization_id, user_id, role_id, status, joined_at)
                         VALUES ($1, $2, $3, 'ACTIVE', NOW())
                         ON CONFLICT (organization_id, user_id) 
                         DO UPDATE SET role_id = $3, status = 'ACTIVE', updated_at = NOW()`,
                        [defaultOrgRes.rows[0].id, userId.trim(), orgRole.id]
                    );
                }
            }
        }
    }

    /**
     * 4. Thu hồi vai trò hệ thống của người dùng
     */
    public static async revokeRole(userId: string, roleNameOrId: string): Promise<void> {
        if (!userId || !UUID_REGEX.test(userId.trim())) {
            throw new ApiError(400, 'Định dạng User ID không hợp lệ');
        }

        const isUuid = UUID_REGEX.test(roleNameOrId.trim());
        const role = await SystemRoleModel.findByNameOrId(roleNameOrId.trim(), isUuid);
        if (!role) {
            throw new ApiError(404, `Không tìm thấy vai trò hệ thống: ${roleNameOrId}`);
        }

        // Bảo vệ Super Admin cuối cùng khi thu hồi vai trò SUPER_ADMIN
        if (role.name.toUpperCase() === 'SUPER_ADMIN') {
            const activeSuperAdminCount = await SystemRoleModel.countUsersWithRole('SUPER_ADMIN');
            if (activeSuperAdminCount <= 1) {
                throw new ApiError(
                    400,
                    'Không thể hạ cấp hoặc thu hồi Super Admin cuối cùng của hệ thống. Hệ thống phải duy trì ít nhất một Super Admin khả dụng.'
                );
            }
        }

        await SystemRoleModel.revokeRole(userId.trim(), role.id);
    }

    /**
     * 5. Kiểm tra người dùng có một trong các vai trò được chỉ định không
     */
    public static async hasAnyRole(userId: string, roleNames: string[]): Promise<boolean> {
        if (!userId || !UUID_REGEX.test(userId.trim()) || roleNames.length === 0) {
            return false;
        }

        const upperRoleNames = roleNames.map(r => r.toUpperCase());
        return SystemRoleModel.hasAnyRole(userId.trim(), upperRoleNames);
    }
}
