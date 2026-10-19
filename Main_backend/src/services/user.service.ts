import bcrypt from 'bcryptjs';
import { pool } from '../config/database';
import { ApiError } from '../utils/apiError';
import { IUser, IUserResponse, IUpdateUserDto, IChangePasswordDto, IUserQuery, IPaginatedResult, UserStatus } from '../models/user.model';
import { AuthService } from './auth.service';
import { EmailService } from './email.service';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class UserService {
    // 1. Lấy chi tiết thông tin người dùng theo ID (hoặc Profile chính mình)
    public static async getById(userId: string): Promise<IUserResponse> {
        if (!userId || !UUID_REGEX.test(userId.trim())) {
            throw new ApiError(400, 'Định dạng ID người dùng không hợp lệ (yêu cầu UUID)');
        }

        const querySql = `
          SELECT id, email, full_name, avatar_url, status, email_verified_at, last_login_at, created_at, updated_at
          FROM users 
          WHERE id = $1 AND deleted_at IS NULL
          LIMIT 1
        `;

        const result = await pool.query<IUserResponse>(querySql, [userId.trim()]);
        if (result.rows.length === 0) {
            throw new ApiError(404, 'Không tìm thấy người dùng với ID này');
        }

        const user = result.rows[0];
        const rolesRes = await pool.query<{ name: string }>(
            `SELECT sr.name 
             FROM user_system_roles usr 
             JOIN system_roles sr ON usr.system_role_id = sr.id 
             WHERE usr.user_id = $1 
             ORDER BY usr.assigned_at ASC`,
            [userId.trim()]
        );
        user.system_roles = rolesRes.rows.map(r => r.name);

        return user;
    }

    // 2. Lấy tất cả người dùng, hỗ trợ tìm kiếm theo name, email, ID, status và phân trang
    public static async getAll(query: IUserQuery): Promise<IPaginatedResult<IUserResponse>> {
        const page = Math.max(1, Number(query.page) || 1);
        const limit = Math.max(1, Math.min(100, Number(query.limit) || 10));
        const offset = (page - 1) * limit;

        const conditions: string[] = ['deleted_at IS NULL'];
        const params: unknown[] = [];

        // 2.1. Tìm kiếm tổng hợp (search: tìm kiếm trên cả email, họ tên hoặc ID)
        if (query.search && query.search.trim()) {
            params.push(`%${query.search.trim()}%`);
            conditions.push(`(email ILIKE $${params.length} OR full_name ILIKE $${params.length} OR id::text ILIKE $${params.length})`);
        }

        // 2.2. Tìm kiếm theo họ tên (name)
        if (query.name && query.name.trim()) {
            params.push(`%${query.name.trim()}%`);
            conditions.push(`full_name ILIKE $${params.length}`);
        }

        // 2.3. Tìm kiếm theo email
        if (query.email && query.email.trim()) {
            params.push(`%${query.email.trim()}%`);
            conditions.push(`email ILIKE $${params.length}`);
        }

        // 2.4. Tìm kiếm theo ID người dùng
        if (query.id && query.id.trim()) {
            params.push(`%${query.id.trim()}%`);
            conditions.push(`id::text ILIKE $${params.length}`);
        }

        // 2.5. Lọc theo trạng thái tài khoản (status: PENDING, ACTIVE, INACTIVE, SUSPENDED)
        if (query.status && typeof query.status === 'string' && query.status.trim()) {
            params.push(query.status.trim().toUpperCase());
            conditions.push(`status = $${params.length}`);
        }

        const whereClause = `WHERE ${conditions.join(' AND ')}`;

        // Đếm tổng số bản ghi khớp điều kiện
        const countQuery = `SELECT COUNT(*) AS total FROM users ${whereClause}`;
        const countResult = await pool.query(countQuery, params);
        const total = parseInt(countResult.rows[0].total, 10);

        // Sắp xếp (mặc định created_at DESC)
        const validSortColumns = ['created_at', 'full_name', 'email', 'last_login_at'];
        const sortBy = validSortColumns.includes(query.sort_by || '') ? query.sort_by : 'created_at';
        const order = query.order?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

        // Lấy danh sách người dùng
        const queryParams = [...params, limit, offset];
        const usersQuery = `
          SELECT id, email, full_name, avatar_url, status, email_verified_at, last_login_at, created_at, updated_at
          FROM users
          ${whereClause}
          ORDER BY ${sortBy} ${order}
          LIMIT $${params.length + 1} OFFSET $${params.length + 2}
        `;
        const usersResult = await pool.query<IUserResponse>(usersQuery, queryParams);

        return {
            items: usersResult.rows,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit) || 1,
            },
        };
    }

    // Cập nhật thông tin (Họ tên, ảnh đại diện)
    public static async updateProfile(userId: string, data: IUpdateUserDto): Promise<IUserResponse> {
        if (data.full_name === undefined && data.avatar_url === undefined) {
            throw new ApiError(400, 'Vui lòng cung cấp ít nhất một thông tin cần cập nhật (full_name hoặc avatar_url)');
        }

        if (data.full_name !== undefined && data.full_name.trim() === '') {
            throw new ApiError(400, 'Họ và tên không được để trống');
        }

        const trimmedName = data.full_name !== undefined ? data.full_name.trim() : null;

        const result = await pool.query<IUserResponse>(
            `UPDATE users 
       SET full_name = COALESCE($1, full_name),
           avatar_url = COALESCE($2, avatar_url),
           updated_at = NOW()
       WHERE id = $3 AND deleted_at IS NULL
       RETURNING id, email, full_name, avatar_url, status, email_verified_at, last_login_at, created_at, updated_at`,
            [trimmedName, data.avatar_url, userId]
        );
        if (result.rows.length === 0) {
            throw new ApiError(404, 'Không tìm thấy người dùng để cập nhật');
        }
        return result.rows[0];
    }

    // Đổi mật khẩu trong phần Cài đặt tài khoản
    public static async changePassword(userId: string, data: IChangePasswordDto): Promise<void> {
        const result = await pool.query<IUser>(
            'SELECT password_hash FROM users WHERE id = $1 AND deleted_at IS NULL',
            [userId]
        );
        if (result.rows.length === 0) {
            throw new ApiError(404, 'Người dùng không tồn tại');
        }

        if (data.old_password === data.new_password) {
            throw new ApiError(400, 'Mật khẩu mới không được trùng với mật khẩu cũ');
        }

        const isMatch = await bcrypt.compare(data.old_password, result.rows[0].password_hash || '');
        if (!isMatch) {
            throw new ApiError(400, 'Mật khẩu cũ không chính xác');
        }

        const salt = await bcrypt.genSalt(10);
        const newHash = await bcrypt.hash(data.new_password, salt);

        await pool.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [newHash, userId]);
    }

    // 5. Gửi email xác thực cho người dùng hiện tại (dành cho User tự gửi từ profile)
    public static async sendVerificationEmailForUser(userId: string): Promise<{ email: string; token: string; code: string }> {
        if (!userId || !UUID_REGEX.test(userId.trim())) {
            throw new ApiError(400, 'Định dạng ID người dùng không hợp lệ');
        }

        const userResult = await pool.query<IUser>(
            'SELECT id, email, full_name, email_verified_at, status FROM users WHERE id = $1 AND deleted_at IS NULL LIMIT 1',
            [userId.trim()]
        );

        if (userResult.rows.length === 0) {
            throw new ApiError(404, 'Không tìm thấy người dùng');
        }

        const user = userResult.rows[0];
        if (user.email_verified_at) {
            throw new ApiError(400, 'Tài khoản này đã được xác thực email trước đó rồi');
        }

        // Tạo mã xác thực mới
        const token = await AuthService.createEmailVerificationToken(user.id);

        // Gửi email xác thực
        await EmailService.sendVerificationEmail(user.email, token, user.full_name);

        return {
            email: user.email,
            code: token,
            token,
        };
    }

    // 6. Quản trị viên/Hệ thống xác thực email trực tiếp cho người dùng theo ID
    public static async verifyEmailById(targetUserId: string): Promise<IUserResponse> {
        if (!targetUserId || !UUID_REGEX.test(targetUserId.trim())) {
            throw new ApiError(400, 'Định dạng ID người dùng không hợp lệ (yêu cầu UUID)');
        }

        const result = await pool.query<IUserResponse>(
            `UPDATE users 
             SET email_verified_at = COALESCE(email_verified_at, NOW()),
                 status = CASE WHEN status = 'PENDING' THEN 'ACTIVE' ELSE status END,
                 updated_at = NOW()
             WHERE id = $1 AND deleted_at IS NULL
             RETURNING id, email, full_name, avatar_url, status, email_verified_at, last_login_at, created_at, updated_at`,
            [targetUserId.trim()]
        );

        if (result.rows.length === 0) {
            throw new ApiError(404, 'Không tìm thấy người dùng để kích hoạt xác thực email');
        }

        // Cập nhật trạng thái các token xác thực đang chờ của người dùng này
        await pool.query(
            'UPDATE email_verification_tokens SET verified_at = NOW() WHERE user_id = $1 AND verified_at IS NULL',
            [targetUserId.trim()]
        );

        return result.rows[0];
    }

    // 7. Cập nhật trạng thái tài khoản (PENDING, ACTIVE, INACTIVE, SUSPENDED)
    public static async updateStatus(userId: string, status: UserStatus): Promise<IUserResponse> {
        if (!userId || !UUID_REGEX.test(userId.trim())) {
            throw new ApiError(400, 'Định dạng ID người dùng không hợp lệ (yêu cầu UUID)');
        }
        const validStatuses: UserStatus[] = ['PENDING', 'ACTIVE', 'INACTIVE', 'SUSPENDED'];
        if (!validStatuses.includes(status)) {
            throw new ApiError(400, `Trạng thái tài khoản không hợp lệ: ${status}`);
        }

        const result = await pool.query<IUserResponse>(
            `UPDATE users 
             SET status = $1,
                 updated_at = NOW()
             WHERE id = $2 AND deleted_at IS NULL
             RETURNING id, email, full_name, avatar_url, status, email_verified_at, last_login_at, created_at, updated_at`,
            [status, userId.trim()]
        );

        if (result.rows.length === 0) {
            throw new ApiError(404, 'Không tìm thấy người dùng để cập nhật trạng thái');
        }

        return result.rows[0];
    }

    // 8. Xóa mềm tài khoản người dùng (soft delete)
    public static async softDelete(userId: string): Promise<void> {
        if (!userId || !UUID_REGEX.test(userId.trim())) {
            throw new ApiError(400, 'Định dạng ID người dùng không hợp lệ (yêu cầu UUID)');
        }

        const result = await pool.query(
            'UPDATE users SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1 AND deleted_at IS NULL',
            [userId.trim()]
        );

        if (result.rowCount === 0) {
            throw new ApiError(404, 'Không tìm thấy người dùng để xóa');
        }
    }
}

