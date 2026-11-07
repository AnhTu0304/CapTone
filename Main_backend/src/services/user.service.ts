import bcrypt from 'bcryptjs';
import { pool } from '../config/database';
import { ApiError } from '../utils/apiError';
import {
    IUserResponse,
    IUserProfileResponse,
    IUpdateUserDto,
    IChangePasswordDto,
    IUserQuery,
    IPaginatedResult,
    UserStatus,
    UserModel,
} from '../models/user.model';
import { OrganizationModel } from '../models/organization.model';
import { AuthModel } from '../models/auth.model';
import { AuthService } from './auth.service';
import { EmailQueue } from './emailQueue.service';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const resolvePrimarySystemRole = (roles: string[]): string | null => {
    if (!roles || roles.length === 0) return null;
    const hierarchy = ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'ADMIN', 'USER'];
    for (const h of hierarchy) {
        if (roles.includes(h)) return h;
    }
    return roles[0] || null;
};

export class UserService {
    // 0. Lấy thông tin hồ sơ người dùng đang đăng nhập (GET /api/v1/users/me)
    public static async getMyProfile(userId: string): Promise<IUserProfileResponse> {
        if (!userId || !UUID_REGEX.test(userId.trim())) {
            throw new ApiError(400, 'Định dạng ID người dùng không hợp lệ (yêu cầu UUID)');
        }

        const user = await UserModel.findById(userId.trim());
        if (!user) {
            throw new ApiError(404, 'Không tìm thấy người dùng');
        }

        if (user.status === 'SUSPENDED' || user.status === 'INACTIVE') {
            throw new ApiError(403, 'Tài khoản đã bị tạm khóa hoặc ngừng hoạt động');
        }

        const systemRoles = await UserModel.getUserSystemRoles(userId.trim());
        const primarySystemRole = resolvePrimarySystemRole(systemRoles);

        let primaryOrg: { id: string; name: string; slug: string; role_in_org?: string } | null = null;
        try {
            const orgs = await OrganizationModel.findOrganizationsByUserId(userId.trim());
            if (orgs && orgs.length > 0) {
                primaryOrg = {
                    id: orgs[0].id,
                    name: orgs[0].name,
                    slug: orgs[0].slug,
                    role_in_org: (orgs[0] as any).role_in_org || null,
                };
            }
        } catch {
            primaryOrg = null;
        }

        return {
            id: user.id,
            email: user.email,
            full_name: user.full_name,
            fullName: user.full_name,
            avatar_url: user.avatar_url || null,
            avatarUrl: user.avatar_url || null,
            phone: user.phone || null,
            job_title: user.job_title || null,
            jobTitle: user.job_title || null,
            status: user.status,
            accountStatus: user.status,
            system_roles: systemRoles,
            systemRole: primarySystemRole,
            system_role: primarySystemRole,
            organization: primaryOrg ? { id: primaryOrg.id, name: primaryOrg.name, slug: primaryOrg.slug } : null,
            organization_role: primaryOrg?.role_in_org || null,
            organizationRole: primaryOrg?.role_in_org || null,
            email_verified_at: user.email_verified_at || null,
            emailVerifiedAt: user.email_verified_at || null,
            last_login_at: user.last_login_at || null,
            lastLoginAt: user.last_login_at || null,
            created_at: user.created_at,
            createdAt: user.created_at,
            updated_at: user.updated_at,
            updatedAt: user.updated_at,
        };
    }
    // Cập nhật thông tin hồ sơ của người dùng hiện tại (PUT /api/v1/users/me)
    public static async updateMyProfile(
        userId: string,
        data: {
            fullName?: string;
            full_name?: string;
            avatarUrl?: string | null;
            avatar_url?: string | null;
            phone?: string | null;
            jobTitle?: string | null;
            job_title?: string | null;
        }
    ): Promise<IUserProfileResponse> {
        if (!userId || !UUID_REGEX.test(userId.trim())) {
            throw new ApiError(400, 'Định dạng ID người dùng không hợp lệ (yêu cầu UUID)');
        }

        const existingUser = await UserModel.findById(userId.trim());
        if (!existingUser) {
            throw new ApiError(404, 'Không tìm thấy người dùng');
        }

        if (existingUser.status === 'SUSPENDED' || existingUser.status === 'INACTIVE') {
            throw new ApiError(403, 'Tài khoản đã bị tạm khóa hoặc ngừng hoạt động');
        }

        const rawName = data.fullName !== undefined ? data.fullName : data.full_name;
        const trimmedName = rawName !== undefined ? rawName.trim() : undefined;
        if (trimmedName !== undefined && trimmedName.length < 2) {
            throw new ApiError(400, 'Họ và tên phải có ít nhất 2 ký tự');
        }

        const rawAvatar = data.avatarUrl !== undefined ? data.avatarUrl : data.avatar_url;
        const avatarUrl = rawAvatar !== undefined ? (rawAvatar ? rawAvatar.trim() : null) : undefined;

        const rawPhone = data.phone;
        const phone = rawPhone !== undefined ? (rawPhone ? rawPhone.trim() : null) : undefined;

        const rawJob = data.jobTitle !== undefined ? data.jobTitle : data.job_title;
        const jobTitle = rawJob !== undefined ? (rawJob ? rawJob.trim() : null) : undefined;

        if (trimmedName !== undefined || avatarUrl !== undefined || phone !== undefined || jobTitle !== undefined) {
            await UserModel.updateProfile(userId.trim(), {
                full_name: trimmedName,
                avatar_url: avatarUrl,
                phone,
                job_title: jobTitle,
            });
        }

        return this.getMyProfile(userId.trim());
    }


    // 1. Lấy chi tiết thông tin người dùng theo ID (hoặc Profile chính mình)
    public static async getById(userId: string): Promise<IUserResponse> {
        if (!userId || !UUID_REGEX.test(userId.trim())) {
            throw new ApiError(400, 'Định dạng ID người dùng không hợp lệ (yêu cầu UUID)');
        }

        const user = await UserModel.findById(userId.trim());
        if (!user) {
            throw new ApiError(404, 'Không tìm thấy người dùng với ID này');
        }

        user.system_roles = await UserModel.getUserSystemRoles(userId.trim());
        user.systemRole = resolvePrimarySystemRole(user.system_roles);
        user.system_role = user.systemRole;
        user.organization_roles = await UserModel.getUserOrganizations(userId.trim());
        user.has_organization = (user.organization_roles || []).length > 0;
        return user;
    }

    // 2. Lấy tất cả người dùng, hỗ trợ tìm kiếm theo name, email, ID, status và phân trang
    public static async getAll(query: IUserQuery): Promise<IPaginatedResult<IUserResponse>> {
        const page = Math.max(1, Number(query.page) || 1);
        const limit = Math.max(1, Math.min(100, Number(query.limit) || 10));
        const offset = (page - 1) * limit;

        const conditions: string[] = ['deleted_at IS NULL'];
        const params: unknown[] = [];

        // 2.1. Tìm kiếm tổng hợp (search: tìm kiếm trên cả email, họ tên, ID hoặc tên tổ chức liên kết)
        if (query.search && query.search.trim()) {
            params.push(`%${query.search.trim()}%`);
            conditions.push(
                `(email ILIKE $${params.length} OR full_name ILIKE $${params.length} OR id::text ILIKE $${params.length} OR EXISTS (` +
                `SELECT 1 FROM organization_members om JOIN organizations o ON om.organization_id = o.id ` +
                `WHERE om.user_id = users.id AND om.status != 'REMOVED' AND o.name ILIKE $${params.length}))`
            );
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

        // 2.6. Lọc theo vai trò phân cấp RBAC (role: SUPER_ADMIN, ADMIN, SME_OWNER, DEVOPS, VIEWER)
        if (query.role && typeof query.role === 'string' && query.role.trim() && query.role.trim().toUpperCase() !== 'ALL') {
            const roleUpper = query.role.trim().toUpperCase();
            if (roleUpper === 'SUPER_ADMIN') {
                conditions.push(`EXISTS (
                    SELECT 1 FROM user_system_roles usr 
                    JOIN system_roles sr ON usr.system_role_id = sr.id 
                    WHERE usr.user_id = users.id AND sr.name = 'SUPER_ADMIN'
                )`);
            } else if (roleUpper === 'ADMIN') {
                conditions.push(`EXISTS (
                    SELECT 1 FROM user_system_roles usr 
                    JOIN system_roles sr ON usr.system_role_id = sr.id 
                    WHERE usr.user_id = users.id AND sr.name IN ('ADMIN', 'SYSTEM_ADMIN')
                ) AND NOT EXISTS (
                    SELECT 1 FROM user_system_roles usr 
                    JOIN system_roles sr ON usr.system_role_id = sr.id 
                    WHERE usr.user_id = users.id AND sr.name = 'SUPER_ADMIN'
                )`);
            } else if (roleUpper === 'SME_OWNER') {
                conditions.push(`EXISTS (
                    SELECT 1 FROM organization_members om 
                    JOIN roles r ON om.role_id = r.id 
                    WHERE om.user_id = users.id AND om.status != 'REMOVED' AND r.code IN ('SME_OWNER', 'OWNER')
                ) AND NOT EXISTS (
                    SELECT 1 FROM user_system_roles usr 
                    JOIN system_roles sr ON usr.system_role_id = sr.id 
                    WHERE usr.user_id = users.id AND sr.name IN ('SUPER_ADMIN', 'ADMIN', 'SYSTEM_ADMIN')
                )`);
            } else if (roleUpper === 'DEVOPS') {
                conditions.push(`EXISTS (
                    SELECT 1 FROM organization_members om 
                    JOIN roles r ON om.role_id = r.id 
                    WHERE om.user_id = users.id AND om.status != 'REMOVED' AND r.code = 'DEVOPS'
                ) AND NOT EXISTS (
                    SELECT 1 FROM user_system_roles usr 
                    JOIN system_roles sr ON usr.system_role_id = sr.id 
                    WHERE usr.user_id = users.id AND sr.name IN ('SUPER_ADMIN', 'ADMIN', 'SYSTEM_ADMIN')
                ) AND NOT EXISTS (
                    SELECT 1 FROM organization_members om 
                    JOIN roles r ON om.role_id = r.id 
                    WHERE om.user_id = users.id AND om.status != 'REMOVED' AND r.code IN ('SME_OWNER', 'OWNER')
                )`);
            } else if (roleUpper === 'VIEWER') {
                conditions.push(`NOT EXISTS (
                    SELECT 1 FROM user_system_roles usr 
                    JOIN system_roles sr ON usr.system_role_id = sr.id 
                    WHERE usr.user_id = users.id AND sr.name IN ('SUPER_ADMIN', 'ADMIN', 'SYSTEM_ADMIN')
                ) AND NOT EXISTS (
                    SELECT 1 FROM organization_members om 
                    JOIN roles r ON om.role_id = r.id 
                    WHERE om.user_id = users.id AND om.status != 'REMOVED' AND r.code IN ('SME_OWNER', 'OWNER', 'DEVOPS')
                )`);
            }
        }

        const whereClause = `WHERE ${conditions.join(' AND ')}`;

        // Đếm tổng số bản ghi khớp điều kiện qua Model
        const total = await UserModel.count(whereClause, params);

        // Sắp xếp (mặc định created_at DESC)
        const validSortColumns = ['created_at', 'full_name', 'email', 'last_login_at'];
        const sortBy: string = query.sort_by && validSortColumns.includes(query.sort_by) ? query.sort_by : 'created_at';
        const order = query.order?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

        // Lấy danh sách người dùng qua Model
        const items = await UserModel.findMany(whereClause, sortBy, order, params, limit, offset);

        return {
            items,
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

        const updatedUser = await UserModel.updateProfile(userId, {
            full_name: trimmedName,
            avatar_url: data.avatar_url,
        });

        if (!updatedUser) {
            throw new ApiError(404, 'Không tìm thấy người dùng để cập nhật');
        }
        return updatedUser;
    }

    // Đổi mật khẩu trong phần Cài đặt tài khoản
    public static async changePassword(userId: string, data: IChangePasswordDto): Promise<void> {
        const currentHash = await UserModel.getPasswordHash(userId);
        if (!currentHash) {
            throw new ApiError(404, 'Người dùng không tồn tại');
        }

        if (data.old_password === data.new_password) {
            throw new ApiError(400, 'Mật khẩu mới không được trùng với mật khẩu cũ');
        }

        const isMatch = await bcrypt.compare(data.old_password, currentHash);
        if (!isMatch) {
            throw new ApiError(400, 'Mật khẩu cũ không chính xác');
        }

        const salt = await bcrypt.genSalt(10);
        const newHash = await bcrypt.hash(data.new_password, salt);

        await UserModel.updatePassword(userId, newHash);
    }

    // 5. Gửi email xác thực cho người dùng hiện tại (dành cho User tự gửi từ profile)
    public static async sendVerificationEmailForUser(userId: string): Promise<{ email: string; token: string; code: string }> {
        if (!userId || !UUID_REGEX.test(userId.trim())) {
            throw new ApiError(400, 'Định dạng ID người dùng không hợp lệ');
        }

        const user = await UserModel.findBasicById(userId.trim());
        if (!user) {
            throw new ApiError(404, 'Không tìm thấy người dùng');
        }

        if (user.email_verified_at) {
            throw new ApiError(400, 'Tài khoản này đã được xác thực email trước đó rồi');
        }

        // Tạo mã xác thực mới
        const token = await AuthService.createEmailVerificationToken(user.id);

        // Gửi email xác thực
        await EmailQueue.enqueueVerification(user.email, token, user.full_name);

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

        const updatedUser = await UserModel.verifyEmail(targetUserId.trim());
        if (!updatedUser) {
            throw new ApiError(404, 'Không tìm thấy người dùng để kích hoạt xác thực email');
        }

        // Cập nhật trạng thái các token xác thực đang chờ của người dùng này qua AuthModel
        await AuthModel.markAllTokensVerifiedForUser(targetUserId.trim());

        return updatedUser;
    }

    // 7. Cập nhật trạng thái tài khoản (Khóa/Mở khóa) bởi Quản trị viên
    public static async updateStatus(
        operatorId: string,
        operatorRoles: string[],
        targetUserId: string,
        status: UserStatus
    ): Promise<IUserResponse> {
        if (!targetUserId || !UUID_REGEX.test(targetUserId.trim())) {
            throw new ApiError(400, 'Định dạng ID người dùng không hợp lệ (yêu cầu UUID)');
        }

        // 7.1. Chặn tự khóa / thay đổi trạng thái tài khoản của chính mình (Self-lock prevention)
        if (operatorId && operatorId.trim().toLowerCase() === targetUserId.trim().toLowerCase()) {
            throw new ApiError(400, 'Không thể tự thay đổi trạng thái hoặc khóa tài khoản của chính mình');
        }

        // 7.2. Kiểm tra trạng thái hợp lệ
        const validStatuses: UserStatus[] = ['ACTIVE', 'SUSPENDED'];
        if (!validStatuses.includes(status)) {
            throw new ApiError(400, `Trạng thái tài khoản không hợp lệ: ${status}. Chỉ chấp nhận ACTIVE hoặc SUSPENDED`);
        }

        // 7.3. Kiểm tra sự tồn tại của target user
        const targetUser = await UserModel.findById(targetUserId.trim());
        if (!targetUser) {
            throw new ApiError(404, 'Không tìm thấy người dùng để cập nhật trạng thái');
        }

        // 7.4. Kiểm tra trạng thái trùng lặp
        if (targetUser.status === status) {
            const statusLabel = status === 'SUSPENDED' ? 'tạm khóa' : 'hoạt động';
            throw new ApiError(400, `Tài khoản đã ở trạng thái ${statusLabel}`);
        }

        // 7.5. Bảo vệ đặc quyền cao nhất (Privilege Protection): ADMIN không được khóa/mở khóa SUPER_ADMIN
        const targetRoles = await UserModel.getUserRoles(targetUserId.trim());
        const isTargetSuperAdmin = targetRoles.includes('SUPER_ADMIN');
        const isOperatorSuperAdmin = operatorRoles.includes('SUPER_ADMIN');

        if (isTargetSuperAdmin && !isOperatorSuperAdmin) {
            throw new ApiError(403, 'Quản trị viên (ADMIN) không có quyền thay đổi trạng thái của Super Admin');
        }

        // 7.6. Cập nhật trạng thái người dùng trong DB
        const updatedUser = await UserModel.updateStatus(targetUserId.trim(), status);
        if (!updatedUser) {
            throw new ApiError(500, 'Cập nhật trạng thái người dùng thất bại');
        }

        updatedUser.system_roles = targetRoles;
        return updatedUser;
    }

    // 8. Xóa mềm tài khoản người dùng (soft delete)
    public static async softDelete(userId: string): Promise<void> {
        if (!userId || !UUID_REGEX.test(userId.trim())) {
            throw new ApiError(400, 'Định dạng ID người dùng không hợp lệ (yêu cầu UUID)');
        }

        const affected = await UserModel.softDelete(userId.trim());
        if (affected === 0) {
            throw new ApiError(404, 'Không tìm thấy người dùng để xóa');
        }
    }

    // 9. Lấy nhật ký hoạt động cá nhân của người dùng từ audit_logs (bao gồm cả hoạt động trong Organization của họ)
    public static async getMyActivities(
        userId: string,
        query: { category?: string; search?: string; limit?: number; page?: number }
    ): Promise<{ items: any[]; total: number; page: number; limit: number }> {
        const page = Math.max(1, Number(query.page) || 1);
        const limit = Math.max(1, Math.min(100, Number(query.limit) || 50));
        const offset = (page - 1) * limit;

        const conditions: string[] = [
            "(a.user_id = $1 OR (a.target_type = 'USER' AND a.target_id = $1))",
            "(a.resource_type IS NULL OR a.resource_type != 'HEALING_ACTION')",
            "(a.action NOT LIKE 'REMEDIATION_%' AND a.action NOT LIKE 'CIRCUIT_BREAKER_%' AND a.action NOT LIKE 'AUTONOMOUS_HEALING_%' AND a.action NOT LIKE 'HITL_%')"
        ];
        const params: any[] = [userId];
        let pIndex = 2;

        if (query.category && query.category !== 'ALL') {
            const cat = query.category.toUpperCase();
            if (cat === 'AUTH') {
                conditions.push("a.action IN ('AUTH_LOGIN_SUCCESS', 'AUTH_LOGIN_FAILURE', 'USER_LOGOUT', 'USER_REGISTERED', 'LOGIN')");
            } else if (cat === 'PROFILE') {
                conditions.push("a.action IN ('USER_PROFILE_UPDATED', 'PROFILE_UPDATED', 'PROFILE_UPDATE', 'EMAIL_VERIFIED', 'USER_UPDATE', 'PROFILE')");
            } else if (cat === 'COMPANY') {
                conditions.push("a.action IN ('ORG_CREATED', 'ORG_UPDATED', 'ORG_STATUS_CHANGED', 'INVITATION_SENT', 'INVITATION_ACCEPTED', 'MEMBER_JOINED', 'MEMBER_REMOVED', 'COMPANY', 'CLUSTER_CREATED', 'CLUSTER_DELETED', 'CONFIG_UPDATED', 'AGENT_CREATED', 'AGENT_DELETED', 'AGENT_CONNECTED', 'POLICY_STATUS_CHANGED', 'POLICY_CREATED', 'POLICY_UPDATED')");
            } else if (cat === 'SECURITY') {
                conditions.push("a.action IN ('2FA_ENABLED', '2FA_DISABLED', 'USER_PASSWORD_CHANGED', 'PASSWORD_RESET', 'TOKEN_ROTATED', 'SECURITY')");
            }
        }

        if (query.search && query.search.trim()) {
            conditions.push("(a.description ILIKE $" + pIndex + " OR a.action ILIKE $" + pIndex + " OR a.ip_address::text ILIKE $" + pIndex + ")");
            params.push("%" + query.search.trim() + "%");
            pIndex++;
        }

        const whereSql = conditions.join(' AND ');
        const countRes = await pool.query<{ total: number }>('SELECT COUNT(*)::int AS total FROM audit_logs a WHERE ' + whereSql, params);
        const total = countRes.rows[0]?.total || 0;

        const limitIndex = pIndex++;
        const offsetIndex = pIndex++;
        const dataQuery = 'SELECT a.id, a.action, a.description, a.status, a.ip_address, a.user_agent, a.created_at, a.metadata, a.actor_type, a.organization_id, ' +
            'COALESCE(o.name, a.metadata->>\'organization_name\', (SELECT o2.name FROM organizations o2 JOIN organization_members om2 ON om2.organization_id = o2.id WHERE om2.user_id = $1 LIMIT 1)) AS organization_name, ' +
            'COALESCE(a.metadata->>\'cluster_name\', c.name, NULL) AS cluster_name ' +
            'FROM audit_logs a ' +
            'LEFT JOIN organizations o ON o.id = a.organization_id ' +
            'LEFT JOIN clusters c ON (c.id::text = a.metadata->>\'cluster_id\' OR (a.resource_type = \'CLUSTER\' AND c.id = a.resource_id)) ' +
            'WHERE ' + whereSql + ' ' +
            'ORDER BY a.created_at DESC ' +
            'LIMIT $' + limitIndex + ' OFFSET $' + offsetIndex;

        const dataParams = [...params, limit, offset];
        const dataRes = await pool.query(dataQuery, dataParams);

        const items = dataRes.rows.map((r: any) => {
            const action = (r.action || '').toUpperCase();
            let category = 'GENERAL';
            let title = r.description || action;

            if (action.includes('AUTH') || action.includes('LOGIN') || action.includes('LOGOUT')) {
                category = 'AUTH';
                title = action.includes('SUCCESS') ? 'Đăng nhập vào hệ thống' : (action.includes('FAILURE') ? 'Đăng nhập thất bại' : 'Xác thực tài khoản');
            } else if (action.includes('PROFILE') || action.includes('EMAIL')) {
                category = 'PROFILE';
                title = 'Cập nhật hồ sơ cá nhân';
            } else if (action.includes('2FA') || action.includes('PASSWORD') || action.includes('TOKEN')) {
                category = 'SECURITY';
                title = action.includes('2FA') ? 'Bảo mật xác thực hai yếu tố (2FA)' : (action.includes('PASSWORD') ? 'Đổi mật khẩu tài khoản' : (action.includes('TOKEN') ? 'Xoay vòng Token Agent' : 'Bảo mật tài khoản'));
            } else if (action.includes('ORG') || action.includes('MEMBER') || action.includes('INVITATION') || action.includes('CLUSTER') || action.includes('CONFIG') || action.includes('AGENT') || action.includes('POLICY')) {
                category = 'COMPANY';
                title = action.includes('ORG_CREATED') ? 'Khởi tạo Company mới' : (action.includes('ORG_UPDATED') ? 'Cập nhật hồ sơ tổ chức' : (action.includes('CLUSTER_CREATED') ? 'Đăng ký Cụm Kubernetes' : (action.includes('CONFIG') ? 'Cập nhật cấu hình Agent' : (action.includes('AGENT') ? 'Kết nối Tác tử Agent' : 'Thao tác tổ chức & hạ tầng'))));
            }

            const d = new Date(r.created_at);
            let timestamp = '';
            try {
                timestamp = d.toLocaleString('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', hour12: false }).replace(',', '');
            } catch {
                const pad = (n: number) => String(n).padStart(2, '0');
                timestamp = pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear() + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
            }

            let ip = r.ip_address ? String(r.ip_address) : '127.0.0.1';
            if (ip === '::1' || ip === '::ffff:127.0.0.1') ip = '127.0.0.1';

            return {
                id: String(r.id),
                actionType: r.action,
                title,
                description: (() => {
                    const rawDesc = r.description || title;
                    let c = rawDesc.replace(/\[\S+@\S+\]/g, '').replace(/Người dùng\s*/i, '').trim();
                    if (!c) return title;
                    return c.charAt(0).toUpperCase() + c.slice(1);
                })(),
                timestamp,
                ipAddress: ip,
                userAgent: r.user_agent || null,
                category,
                status: r.status === 'SUCCESS' ? 'SUCCESS' : (r.status === 'FAILURE' ? 'FAILED' : r.status),
                organizationName: r.organization_name || (r.metadata && r.metadata.organization_name) || null,
                clusterName: (() => {
                    let clName = r.cluster_name || (r.metadata && r.metadata.cluster_name) || null;
                    if (!clName && r.description) {
                        const m = r.description.match(/\[([a-zA-Z0-9_\-]+?)(?:-cluster)?(?:-ebpf)?-agent\]/i);
                        if (m) clName = m[1];
                    }
                    return clName;
                })(),
            };
        });

        return { items, total, page, limit };
    }
}
