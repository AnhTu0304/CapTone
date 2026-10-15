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
