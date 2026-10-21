import { ApiError } from '../utils/apiError';
import { ISystemRole, IUserSystemRoleDetail, SystemRoleModel } from '../models/systemRole.model';
import { UserModel } from '../models/user.model';

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
        const role = await SystemRoleModel.findByNameOrId(roleNameOrId.trim(), isUuid);
        if (!role) {
            throw new ApiError(404, `Không tìm thấy vai trò hệ thống: ${roleNameOrId}`);
        }

        // Kiểm tra User có tồn tại không qua UserModel
        const userExists = await UserModel.exists(userId.trim());
        if (!userExists) {
            throw new ApiError(404, 'Người dùng không tồn tại hoặc đã bị xóa');
        }

        // Gán vai trò qua Model
        await SystemRoleModel.assignRole(userId.trim(), role.id, assignedBy || null);
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
