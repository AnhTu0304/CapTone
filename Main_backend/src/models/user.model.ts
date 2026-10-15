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
export type IUserResponse = Omit<IUser, 'password_hash'> & {
    system_roles?: string[];
};

/**
 * DTO cập nhật thông tin cá nhân
 */
export interface IUpdateUserDto {
    full_name?: string;
    avatar_url?: string | null;
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

// Re-export toàn bộ Auth models để duy trì tính tương thích ngược
export * from './auth.model';
