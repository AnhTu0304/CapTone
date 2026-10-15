import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { pool } from '../config/database';
import { config } from '../config/env';
import { ApiError } from '../utils/apiError';
import { IUser, IUserResponse, UserStatus } from '../models/user.model';
import { 
    IRegisterDto, 
    ILoginDto, 
    IAuthResult, 
    ILoginResult, 
    IEmailVerificationToken,
    ISendVerificationResult,
    IVerifyEmailResult
} from '../models/auth.model';
import { EmailService } from './email.service';
import { SystemRoleService } from './systemRole.service';

export class AuthService {
    private static generateToken(user: { id: string; email: string; status: UserStatus }, roles: string[] = []): string {
        return jwt.sign(
            { id: user.id, email: user.email, status: user.status, roles },
            config.jwt.secret,
            { expiresIn: config.jwt.expiresIn as any }
        );
    }

    /**
     * Tạo mã xác thực email (OTP 6 số), lưu sha256 hash vào PostgreSQL
     */
    public static async createEmailVerificationToken(userId: string): Promise<string> {
        // Sinh mã xác thực 6 chữ số ngẫu nhiên
        const rawCode = Math.floor(100000 + Math.random() * 900000).toString();
        const tokenHash = crypto.createHash('sha256').update(rawCode).digest('hex');
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 giờ hiệu lực

        // Xóa các mã chưa xác thực cũ của user này
        await pool.query(
            'DELETE FROM email_verification_tokens WHERE user_id = $1 AND verified_at IS NULL',
            [userId]
        );

        // Lưu bản ghi token mới
        await pool.query(
            `INSERT INTO email_verification_tokens (user_id, token_hash, expires_at)
             VALUES ($1, $2, $3)`,
            [userId, tokenHash, expiresAt]
        );

        return rawCode;
    }

    // 1. Đăng ký tài khoản mới vào PostgreSQL
    public static async register(data: IRegisterDto): Promise<IAuthResult> {
        const existing = await pool.query<IUser>(
            'SELECT id FROM users WHERE email = $1 AND deleted_at IS NULL LIMIT 1',
            [data.email.toLowerCase().trim()]
        );
        if (existing.rows.length > 0) {
            throw new ApiError(409, 'Email này đã được sử dụng');
        }

        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(data.password, salt);

        const insertSql = `
          INSERT INTO users (email, password_hash, full_name, status)
          VALUES ($1, $2, $3, 'ACTIVE')
          RETURNING id, email, full_name, avatar_url, status, email_verified_at, last_login_at, created_at, updated_at
        `;
        const result = await pool.query<IUserResponse>(insertSql, [
            data.email.toLowerCase().trim(),
            passwordHash,
            data.full_name.trim(),
        ]);

        const newUser = result.rows[0];

        // Mặc định gán vai trò 'USER' cho tài khoản mới đăng ký
        try {
            await SystemRoleService.assignRole(newUser.id, 'USER');
            newUser.system_roles = ['USER'];
        } catch (roleError) {
            console.warn('Không thể gán vai trò mặc định USER khi đăng ký:', (roleError as Error).message);
        }

        const verificationToken = await this.createEmailVerificationToken(newUser.id);
        
        // Gửi email xác thực nếu muốn xác minh tài khoản sau này (không bắt buộc)
        EmailService.sendVerificationEmail(newUser.email, verificationToken, newUser.full_name).catch(() => {});

        return { 
            user: newUser, 
            token: this.generateToken(newUser, newUser.system_roles || ['USER']),
            verification_token: verificationToken
        };
    }

    // 2. Đăng nhập tài khoản - Chỉ trả về id, email và token (Không bắt buộc xác thực email)
    public static async login(data: ILoginDto): Promise<ILoginResult> {
        const querySql = `
          SELECT id, email, password_hash, status, email_verified_at
          FROM users WHERE email = $1 AND deleted_at IS NULL LIMIT 1
        `;
        const result = await pool.query<IUser>(querySql, [data.email.toLowerCase().trim()]);
        if (result.rows.length === 0) {
            throw new ApiError(401, 'Email hoặc mật khẩu không chính xác');
        }

        const user = result.rows[0];

        // 2.1. Kiểm tra đối chiếu mật khẩu
        const isMatch = await bcrypt.compare(data.password, user.password_hash || '');
        if (!isMatch) {
            throw new ApiError(401, 'Email hoặc mật khẩu không chính xác');
        }

        // 2.2. Kiểm tra tài khoản bị tạm khóa / ngừng hoạt động
        if (user.status === 'SUSPENDED' || user.status === 'INACTIVE') {
            throw new ApiError(403, 'Tài khoản đã bị tạm khóa hoặc ngừng hoạt động');
        }

        // Tự động chuyển PENDING sang ACTIVE nếu có tài khoản cũ chưa kích hoạt
        if (user.status === 'PENDING') {
            await pool.query("UPDATE users SET status = 'ACTIVE' WHERE id = $1", [user.id]);
            user.status = 'ACTIVE';
        }

        await pool.query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id]);

        // Lấy danh sách các vai trò hệ thống hiện có của người dùng
        const rolesRes = await pool.query<{ name: string }>(
            `SELECT sr.name 
             FROM user_system_roles usr 
             JOIN system_roles sr ON usr.system_role_id = sr.id 
             WHERE usr.user_id = $1 
             ORDER BY usr.assigned_at ASC`,
            [user.id]
        );
        const roles = rolesRes.rows.map(r => r.name);

        const token = this.generateToken(user, roles);
        return {
            id: user.id,
            email: user.email,
            token,
        };
    }

    // 3. Xác thực Email bằng mã xác thực (Code/Token nhận được từ email)
    public static async verifyEmail(rawCode: string, userId?: string): Promise<{ email: string; verified_at: Date }> {
        if (!rawCode || typeof rawCode !== 'string') {
            throw new ApiError(400, 'Vui lòng cung cấp mã xác thực được gửi về email của bạn');
        }

        const tokenHash = crypto.createHash('sha256').update(rawCode.trim()).digest('hex');

        // Tìm mã xác thực
        let querySql = 'SELECT id, user_id, expires_at, verified_at FROM email_verification_tokens WHERE token_hash = $1';
        const queryParams: any[] = [tokenHash];

        if (userId) {
            querySql += ' AND user_id = $2';
            queryParams.push(userId);
        }
        querySql += ' ORDER BY created_at DESC LIMIT 1';

        const tokenResult = await pool.query<IEmailVerificationToken>(querySql, queryParams);

        if (tokenResult.rows.length === 0) {
            throw new ApiError(400, 'Mã xác thực không chính xác hoặc không tồn tại');
        }

        const tokenRecord = tokenResult.rows[0];

        if (tokenRecord.verified_at) {
            throw new ApiError(400, 'Mã xác thực này đã được sử dụng trước đó');
        }

        if (new Date() > new Date(tokenRecord.expires_at)) {
            throw new ApiError(400, 'Mã xác thực đã hết hạn, vui lòng yêu cầu gửi mã mới');
        }

        // Đánh dấu mã xác thực đã được sử dụng
        await pool.query(
            'UPDATE email_verification_tokens SET verified_at = NOW() WHERE id = $1',
            [tokenRecord.id]
        );

        // Kích hoạt người dùng sang ACTIVE và lưu mốc email_verified_at
        const userUpdate = await pool.query<IUser>(
            `UPDATE users 
             SET email_verified_at = NOW(), status = 'ACTIVE', updated_at = NOW()
             WHERE id = $1 AND deleted_at IS NULL
             RETURNING email, email_verified_at`,
            [tokenRecord.user_id]
        );

        if (userUpdate.rows.length === 0) {
            throw new ApiError(404, 'Không tìm thấy người dùng sở hữu mã xác thực này');
        }

        return {
            email: userUpdate.rows[0].email,
            verified_at: userUpdate.rows[0].email_verified_at as Date,
        };
    }

    // 4. Gửi mã xác thực về email cho người dùng (dựa trên userId từ Token đăng nhập)
    public static async sendVerificationEmail(userId: string): Promise<ISendVerificationResult> {
        if (!userId) {
            throw new ApiError(400, 'Không tìm thấy thông tin định danh người dùng');
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

        // Tạo mã xác thực OTP 6 số mới
        const rawCode = await this.createEmailVerificationToken(user.id);
        
        // Gửi email xác thực
        await EmailService.sendVerificationEmail(user.email, rawCode, user.full_name);

        return {
            email: user.email,
            code: rawCode,
            token: rawCode,
        };
    }
}
