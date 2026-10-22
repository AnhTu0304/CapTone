import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { config } from '../config/env';
import { ApiError } from '../utils/apiError';
import { 
    IRegisterDto, 
    ILoginDto, 
    IAuthResult, 
    ILoginResult, 
    IJwtPayload, 
    ISendVerificationResult,
    AuthModel,
} from '../models/auth.model';
import { UserModel } from '../models/user.model';
import { SystemRoleService } from './systemRole.service';
import { EmailQueue } from './emailQueue.service';

export class AuthService {
    /**
     * Tạo JWT Token từ thông tin người dùng và danh sách vai trò
     */
    private static generateToken(user: { id: string; email: string; status: any }, roles: string[] = []): string {
        const payload: IJwtPayload = {
            id: user.id,
            email: user.email,
            status: user.status,
            roles: roles,
        };
        return jwt.sign(payload, config.jwt.secret, {
            expiresIn: config.jwt.expiresIn,
        } as jwt.SignOptions);
    }

    /**
     * Tạo mã xác thực email (OTP 6 số), lưu sha256 hash qua AuthModel
     */
    public static async createEmailVerificationToken(userId: string): Promise<string> {
        // Sinh mã xác thực 6 chữ số ngẫu nhiên
        const rawCode = Math.floor(100000 + Math.random() * 900000).toString();
        const tokenHash = crypto.createHash('sha256').update(rawCode).digest('hex');
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 giờ hiệu lực

        // Xóa các mã chưa xác thực cũ của user này qua AuthModel
        await AuthModel.deletePendingTokens(userId);

        // Lưu bản ghi token mới qua AuthModel
        await AuthModel.createVerificationToken(userId, tokenHash, expiresAt);

        return rawCode;
    }

    // 1. Đăng ký tài khoản mới
    public static async register(data: IRegisterDto): Promise<IAuthResult> {
        const existing = await UserModel.findByEmail(data.email.toLowerCase().trim());
        if (existing) {
            throw new ApiError(409, 'Email này đã được sử dụng');
        }

        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(data.password, salt);

        const newUser = await UserModel.create({
            email: data.email.toLowerCase().trim(),
            password_hash: passwordHash,
            full_name: data.full_name.trim(),
            status: 'ACTIVE',
        });

        // Mặc định gán vai trò 'USER' cho tài khoản mới đăng ký
        try {
            await SystemRoleService.assignRole(newUser.id, 'USER');
            newUser.system_roles = ['USER'];
        } catch (roleError) {
            console.warn('Không thể gán vai trò mặc định USER khi đăng ký:', (roleError as Error).message);
        }
        newUser.organization_roles = [];
        newUser.has_organization = false;

        const verificationToken = await this.createEmailVerificationToken(newUser.id);
        
        // Gửi email xác thực nếu muốn xác minh tài khoản sau này (không bắt buộc)
        EmailQueue.enqueueVerification(newUser.email, verificationToken, newUser.full_name).catch(() => {});

        return { 
            user: newUser, 
            token: this.generateToken(newUser, newUser.system_roles || ['USER']),
            verification_token: verificationToken
        };
    }

    // 2. Đăng nhập tài khoản - Chỉ trả về id, email và token (Không bắt buộc xác thực email)
    public static async login(data: ILoginDto): Promise<ILoginResult> {
        const user = await UserModel.findByEmailWithPassword(data.email.toLowerCase().trim());
        if (!user) {
            throw new ApiError(401, 'Email hoặc mật khẩu không chính xác');
        }

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
            await UserModel.updateStatus(user.id, 'ACTIVE');
            user.status = 'ACTIVE';
        }

        await UserModel.updateLastLogin(user.id);

        // Lấy danh sách các vai trò hệ thống hiện có của người dùng qua UserModel
        const roles = await UserModel.getUserRoles(user.id);
        const orgRoles = await UserModel.getUserOrganizations(user.id);

        const token = this.generateToken(user, roles);
        return {
            id: user.id,
            email: user.email,
            token,
            has_organization: orgRoles.length > 0,
            organization_roles: orgRoles,
        };
    }

    // 3. Xác thực Email bằng mã xác thực (Code/Token nhận được từ email)
    public static async verifyEmail(rawCode: string, userId?: string): Promise<{ email: string; verified_at: Date }> {
        if (!rawCode || typeof rawCode !== 'string') {
            throw new ApiError(400, 'Vui lòng cung cấp mã xác thực được gửi về email của bạn');
        }

        const tokenHash = crypto.createHash('sha256').update(rawCode.trim()).digest('hex');

        // Tìm mã xác thực qua AuthModel
        const tokenRecord = await AuthModel.findVerificationToken(tokenHash, userId);

        if (!tokenRecord) {
            throw new ApiError(400, 'Mã xác thực không chính xác hoặc không tồn tại');
        }

        if (tokenRecord.verified_at) {
            throw new ApiError(400, 'Mã xác thực này đã được sử dụng trước đó');
        }

        if (new Date() > new Date(tokenRecord.expires_at)) {
            throw new ApiError(400, 'Mã xác thực đã hết hạn, vui lòng yêu cầu gửi mã mới');
        }

        // Đánh dấu mã xác thực đã được sử dụng qua AuthModel
        await AuthModel.markTokenVerified(tokenRecord.id);

        // Kích hoạt người dùng sang ACTIVE và lưu mốc email_verified_at qua AuthModel
        const activatedUser = await AuthModel.verifyUserEmailAndActivate(tokenRecord.user_id);
        if (!activatedUser) {
            throw new ApiError(404, 'Không tìm thấy người dùng sở hữu mã xác thực này');
        }

        return {
            email: activatedUser.email,
            verified_at: activatedUser.email_verified_at,
        };
    }

    // 4. Gửi mã xác thực về email cho người dùng (dựa trên userId từ Token đăng nhập)
    public static async sendVerificationEmail(userId: string): Promise<ISendVerificationResult> {
        if (!userId) {
            throw new ApiError(400, 'Không tìm thấy thông tin định danh người dùng');
        }

        const user = await UserModel.findBasicById(userId.trim());
        if (!user) {
            throw new ApiError(404, 'Không tìm thấy người dùng');
        }

        if (user.email_verified_at) {
            throw new ApiError(400, 'Tài khoản này đã được xác thực email trước đó rồi');
        }

        // Tạo mã xác thực OTP 6 số mới
        const rawCode = await this.createEmailVerificationToken(user.id);
        
        // Gửi email xác thực
        await EmailQueue.enqueueVerification(user.email, rawCode, user.full_name);

        return {
            email: user.email,
            code: rawCode,
            token: rawCode,
        };
    }

    /**
     * Xác thực token với Google (hỗ trợ cả ID token và OAuth2 access token)
     */
    public static async verifyGoogleToken(token: string): Promise<{ email: string; name: string; picture?: string }> {
        // 1. Thử xác thực theo ID Token nếu token có định dạng JWT (3 phần)
        if (token.includes('.') && token.split('.').length === 3) {
            try {
                const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(token)}`);
                if (res.ok) {
                    const data = await res.json() as any;
                    if (data.email) {
                        return {
                            email: data.email,
                            name: data.name || data.email.split('@')[0],
                            picture: data.picture,
                        };
                    }
                }
            } catch {
                // Tiếp tục thử phương án access_token
            }
        }

        // 2. Thử xác thực theo Google OAuth2 Access Token qua UserInfo endpoint
        try {
            const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
                const data = await res.json() as any;
                if (data.email) {
                    return {
                        email: data.email,
                        name: data.name || data.email.split('@')[0],
                        picture: data.picture,
                    };
                }
            }
        } catch {
            // Lỗi kết nối Google API
        }

        throw new ApiError(401, 'Xác thực Google không thành công hoặc mã token đã hết hạn');
    }

    /**
     * Đăng nhập hoặc đăng ký tài khoản liên kết Google
     */
    public static async loginWithGoogle(token: string): Promise<{ user: any; token: string }> {
        if (!token || typeof token !== 'string' || !token.trim()) {
            throw new ApiError(400, 'Vui lòng cung cấp mã xác thực Google (Token)');
        }

        const googleUser = await this.verifyGoogleToken(token.trim());
        const email = googleUser.email.toLowerCase().trim();

        let user = await UserModel.findFullByEmail(email);

        if (!user) {
            // Chưa có tài khoản -> Tạo mới tài khoản đã xác thực email
            const created = await UserModel.create({
                email,
                full_name: googleUser.name || email.split('@')[0],
                avatar_url: googleUser.picture || null,
                status: 'ACTIVE',
                email_verified_at: new Date(),
            });

            try {
                await SystemRoleService.assignRole(created.id, 'USER');
            } catch (roleError) {
                console.warn('Không thể gán vai trò mặc định USER khi đăng nhập Google:', (roleError as Error).message);
            }

            user = {
                ...created,
                system_roles: ['USER'],
            };
        } else {
            // Đã có tài khoản -> Kiểm tra trạng thái
            if (user.status === 'SUSPENDED' || user.status === 'INACTIVE') {
                throw new ApiError(403, 'Tài khoản đã bị tạm khóa hoặc ngừng hoạt động');
            }

            // Tự động kích hoạt nếu đang PENDING
            if (user.status === 'PENDING') {
                await UserModel.updateStatus(user.id, 'ACTIVE');
                user.status = 'ACTIVE';
            }

            await UserModel.updateLastLogin(user.id);

            // Cập nhật avatar nếu người dùng chưa có
            if (!user.avatar_url && googleUser.picture) {
                await UserModel.updateProfile(user.id, { avatar_url: googleUser.picture });
                user.avatar_url = googleUser.picture;
            }
        }

        const roles = await UserModel.getUserRoles(user.id);
        const orgRoles = await UserModel.getUserOrganizations(user.id);
        const jwtToken = this.generateToken(user, roles);

        return {
            user: {
                id: user.id,
                email: user.email,
                full_name: user.full_name,
                avatar_url: user.avatar_url,
                status: user.status,
                system_roles: roles,
                organization_roles: orgRoles,
                has_organization: orgRoles.length > 0,
            },
            token: jwtToken,
        };
    }
}
