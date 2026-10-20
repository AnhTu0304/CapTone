import { PoolClient } from 'pg';
import { pool } from '../config/database';
import { IUser, IUserResponse, UserStatus } from './user.model';

/**
 * DTO (Data Transfer Object) cho dữ liệu Đăng ký tài khoản
 */
export interface IRegisterDto {
    email: string;
    password: string;
    full_name: string;
}

/**
 * DTO cho dữ liệu Đăng nhập
 */
export interface ILoginDto {
    email: string;
    password: string;
}

/**
 * Cấu trúc Payload lưu trữ bên trong JWT Token
 */
export interface IJwtPayload {
    id: string;
    email: string;
    status: UserStatus;
    roles?: string[];
    iat?: number;
    exp?: number;
}

/**
 * Kết quả trả về sau khi Đăng ký thành công
 */
export interface IAuthResult {
    user: IUserResponse;
    token: string;
    verification_token?: string;
}

/**
 * Kết quả trả về sau khi Đăng nhập thành công (chỉ gồm id, email, token)
 */
export interface ILoginResult {
    id: string;
    email: string;
    token: string;
}

/**
 * Interface cho bảng email_verification_tokens trong PostgreSQL
 */
export interface IEmailVerificationToken {
    id: string;
    user_id: string;
    token_hash: string;
    expires_at: Date;
    verified_at?: Date | null;
    created_at: Date;
}

/**
 * DTO kết quả gửi mã xác thực email
 */
export interface ISendVerificationResult {
    email: string;
    code: string;
    token: string;
}

/**
 * DTO kết quả xác thực email thành công
 */
export interface IVerifyEmailResult {
    email: string;
    verified_at: Date;
}

export class AuthModel {
    /**
     * Xóa các mã xác thực email chưa hoàn thành của một người dùng
     */
    public static async deletePendingTokens(userId: string, client?: PoolClient): Promise<void> {
        const db = client || pool;
        await db.query(
            'DELETE FROM email_verification_tokens WHERE user_id = $1 AND verified_at IS NULL',
            [userId]
        );
    }

    /**
     * Lưu mã xác thực email (token hash) mới vào DB
     */
    public static async createVerificationToken(
        userId: string,
        tokenHash: string,
        expiresAt: Date,
        client?: PoolClient
    ): Promise<void> {
        const db = client || pool;
        await db.query(
            `INSERT INTO email_verification_tokens (user_id, token_hash, expires_at)
             VALUES ($1, $2, $3)`,
            [userId, tokenHash, expiresAt]
        );
    }

    /**
     * Tìm mã xác thực theo hash (và tùy chọn theo userId)
     */
    public static async findVerificationToken(
        tokenHash: string,
        userId?: string,
        client?: PoolClient
    ): Promise<IEmailVerificationToken | null> {
        const db = client || pool;
        let querySql = 'SELECT id, user_id, expires_at, verified_at FROM email_verification_tokens WHERE token_hash = $1';
        const queryParams: unknown[] = [tokenHash];

        if (userId) {
            querySql += ' AND user_id = $2';
            queryParams.push(userId);
        }
        querySql += ' ORDER BY created_at DESC LIMIT 1';

        const result = await db.query<IEmailVerificationToken>(querySql, queryParams);
        return result.rows[0] || null;
    }

    /**
     * Đánh dấu token đã được sử dụng thành công
     */
    public static async markTokenVerified(tokenId: string, client?: PoolClient): Promise<void> {
        const db = client || pool;
        await db.query(
            'UPDATE email_verification_tokens SET verified_at = NOW() WHERE id = $1',
            [tokenId]
        );
    }

    /**
     * Đánh dấu tất cả các token của một người dùng đã được sử dụng
     */
    public static async markAllTokensVerifiedForUser(userId: string, client?: PoolClient): Promise<void> {
        const db = client || pool;
        await db.query(
            'UPDATE email_verification_tokens SET verified_at = NOW() WHERE user_id = $1 AND verified_at IS NULL',
            [userId]
        );
    }

    /**
     * Kích hoạt trạng thái ACTIVE và cập nhật email_verified_at cho người dùng
     */
    public static async verifyUserEmailAndActivate(
        userId: string,
        client?: PoolClient
    ): Promise<{ email: string; email_verified_at: Date } | null> {
        const db = client || pool;
        const userUpdate = await db.query<IUser>(
            `UPDATE users 
             SET email_verified_at = NOW(), status = 'ACTIVE', updated_at = NOW()
             WHERE id = $1 AND deleted_at IS NULL
             RETURNING email, email_verified_at`,
            [userId]
        );
        if (userUpdate.rows.length === 0) return null;
        return {
            email: userUpdate.rows[0].email,
            email_verified_at: userUpdate.rows[0].email_verified_at as Date,
        };
    }
}
