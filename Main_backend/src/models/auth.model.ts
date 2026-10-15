import { IUserResponse, UserStatus } from './user.model';

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
