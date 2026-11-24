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
import { resolvePrimarySystemRole } from './user.service';
import { TwoFactorModel } from '../models/twoFactor.model';
import { TwoFactorService } from './twoFactor.service';
import { redisClient, isRedisReady } from '../config/redis';
import { RefreshTokenService } from './refreshToken.service';
import { EmailService } from './email.service';

const OTP_COOLDOWN_SECONDS = 60;
const OTP_MAX_FAILED_ATTEMPTS = 5;
const OTP_LOCKOUT_SECONDS = 15 * 60;
const MEMORY_OTP_COOLDOWN = new Map<string, number>();
const MEMORY_OTP_FAILURES = new Map<string, { count: number; expiresAt: number }>();

let cachedGoogleJwks: { keys: any[]; expiresAt: number } | null = null;

async function fetchGoogleJwks(forceRefresh = false): Promise<any[]> {
    const now = Date.now();
    if (!forceRefresh && cachedGoogleJwks && cachedGoogleJwks.expiresAt > now) {
        return cachedGoogleJwks.keys;
    }
    let res: Response;
    try {
        res = await fetch('https://www.googleapis.com/oauth2/v3/certs');
    } catch (err: any) {
        const reason = err?.cause?.code || err?.message || 'network_error';
        console.error('[AuthService] Lỗi kết nối Google JWKS:', reason);
        throw new ApiError(503, 'Không thể kết nối tới dịch vụ xác thực Google. Vui lòng kiểm tra kết nối mạng hoặc proxy máy chủ.');
    }
    if (!res.ok) {
        throw new Error(`Failed to fetch Google JWKS: HTTP ${res.status}`);
    }
    const cacheControl = res.headers.get('cache-control') || '';
    const maxAgeMatch = cacheControl.match(/max-age=(\d+)/i);
    const ttlMs = (maxAgeMatch ? Math.min(3600, Math.max(60, parseInt(maxAgeMatch[1], 10))) : 300) * 1000;
    const data = (await res.json()) as { keys?: any[] };
    const keys = Array.isArray(data?.keys) ? data.keys : [];
    cachedGoogleJwks = { keys, expiresAt: now + ttlMs };
    return keys;
}

export class AuthService {
    /**
     * Tạo JWT Token từ thông tin người dùng và danh sách vai trò
     */
    private static generateToken(
        user: { id: string; email: string; status: any; token_version?: number },
        roles: string[] = [],
        sessionId?: string
    ): string {
        return RefreshTokenService.signAccessToken(user, roles, sessionId);
    }

    /**
     * Tạo mã xác thực email (OTP 6 số dùng CSPRNG), lưu sha256 hash qua AuthModel
     */
    public static async createEmailVerificationToken(userId: string): Promise<string> {
        const rawCode = crypto.randomInt(100000, 1000000).toString();
        const tokenHash = crypto.createHash('sha256').update(rawCode).digest('hex');
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 phút hiệu lực

        // Xóa các mã chưa xác thực cũ của user này qua AuthModel
        await AuthModel.deletePendingTokens(userId);

        // Lưu bản ghi token mới qua AuthModel
        await AuthModel.createVerificationToken(userId, tokenHash, expiresAt);

        return rawCode;
    }

    // 1. Đăng ký tài khoản mới
    private static generateVerificationToken(user: { id: string; email: string }): string {
        return jwt.sign(
            {
                id: user.id,
                email: user.email,
                status: 'PENDING',
                typ: 'access',
                purpose: 'email_verification',
            },
            config.jwt.secret,
            { expiresIn: '30m' }
        );
    }

    // 1. Đăng ký tài khoản mới (tạo trạng thái PENDING, bắt buộc xác thực OTP qua email)
    public static async register(data: IRegisterDto): Promise<IAuthResult & { requires_verification?: boolean }> {
        const cleanEmail = data.email.toLowerCase().trim();
        const existing = await UserModel.findFullByEmail(cleanEmail);

        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(data.password, salt);

        let targetUser: any;
        if (existing) {
            if (existing.status === 'PENDING' && !existing.email_verified_at) {
                const updated = await UserModel.updatePendingRegistration(existing.id, {
                    full_name: data.full_name.trim(),
                    password_hash: passwordHash,
                });
                targetUser = updated || existing;
                targetUser.system_roles = await UserModel.getUserSystemRoles(existing.id);
                if (!targetUser.system_roles?.length) {
                    await SystemRoleService.assignRole(existing.id, 'USER').catch(() => {});
                    targetUser.system_roles = ['USER'];
                }
            } else {
                throw new ApiError(409, 'Email này đã được sử dụng');
            }
        } else {
            targetUser = await UserModel.create({
                email: cleanEmail,
                password_hash: passwordHash,
                full_name: data.full_name.trim(),
                status: 'PENDING',
            });

            // Mặc định gán vai trò 'USER' cho tài khoản mới đăng ký
            try {
                await SystemRoleService.assignRole(targetUser.id, 'USER');
                targetUser.system_roles = ['USER'];
            } catch (roleError) {
                console.warn('Không thể gán vai trò mặc định USER khi đăng ký:', (roleError as Error).message);
            }
        }

        targetUser.organization_roles = [];
        targetUser.has_organization = false;

        const verificationToken = await this.createEmailVerificationToken(targetUser.id);

        // Gửi email xác thực (không trả OTP trong HTTP response)
        EmailQueue.enqueueVerification(targetUser.email, verificationToken, targetUser.full_name).catch((err) => {
            console.warn('[AuthService] Không thể đưa email xác thực vào hàng đợi:', (err as Error).message);
        });

        return {
            user: targetUser,
            token: this.generateVerificationToken(targetUser),
            requires_verification: true,
        };
    }

    // 2. Đăng nhập tài khoản - Chỉ trả về id, email và token (Không bắt buộc xác thực email)
    public static async verify2FALogin(tempToken: string, code: string): Promise<ILoginResult> {
        let decoded: any;
        try {
            decoded = jwt.verify(tempToken, config.jwt.secret, { algorithms: ['HS256'] });
        } catch {
            throw new ApiError(401, 'Phiên xác thực 2FA đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.');
        }

        if (!decoded || decoded.purpose !== '2fa_login' || !decoded.tempUserId) {
            throw new ApiError(401, 'Token xác thực 2FA không hợp lệ.');
        }

        const userId = decoded.tempUserId;
        const verification = await TwoFactorService.verifyLoginCode(userId, code);
        if (!verification.success) {
            throw new ApiError(400, 'Mã xác thực 2FA không chính xác hoặc đã hết hạn.');
        }

        const user = await UserModel.findById(userId);
        if (!user) {
            throw new ApiError(404, 'Không tìm thấy người dùng');
        }
        if (user.status === 'SUSPENDED' || user.status === 'INACTIVE') {
            throw new ApiError(403, 'Tài khoản đã bị tạm khóa hoặc ngừng hoạt động');
        }

        const authStatus = await UserModel.findAuthStatus(user.id);
        await UserModel.updateLastLogin(user.id);

        const systemRoles = await UserModel.getUserSystemRoles(user.id);
        const orgRoles = await UserModel.getUserOrganizations(user.id);
        const primarySystemRole = resolvePrimarySystemRole(systemRoles);

        const token = this.generateToken({ ...user, token_version: authStatus?.token_version ?? 1 }, systemRoles);
        return {
            id: user.id,
            email: user.email,
            full_name: user.full_name,
            avatar_url: user.avatar_url || null,
            avatarUrl: user.avatar_url || null,
            token,
            system_roles: systemRoles,
            systemRole: primarySystemRole,
            system_role: primarySystemRole,
            has_organization: orgRoles.length > 0,
            organization_roles: orgRoles,
            require_2fa: false,
        };
    }

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

        // 2.2. Kiểm tra tài khoản bị tạm khóa / ngừng hoạt động hoặc chưa xác thực email
        if (user.status === 'SUSPENDED' || user.status === 'INACTIVE') {
            throw new ApiError(403, 'Tài khoản đã bị tạm khóa hoặc ngừng hoạt động');
        }

        if (user.status === 'PENDING' || !user.email_verified_at) {
            throw new ApiError(
                403,
                'Tài khoản chưa được xác thực email. Vui lòng kiểm tra hộp thư để nhập mã OTP hoặc đăng ký lại để nhận mã mới.'
            );
        }

                // 2.3. Kiem tra Xac thuc 2 yeu to (2FA)
        const twoFactor = await TwoFactorModel.findByUserId(user.id);
        if (twoFactor && twoFactor.is_enabled) {
            const tempToken = jwt.sign(
                { tempUserId: user.id, email: user.email, purpose: '2fa_login' },
                config.jwt.secret,
                { expiresIn: '10m' }
            );
            return {
                id: user.id,
                email: user.email,
                require_2fa: true,
                temp_token: tempToken,
            };
        }

await UserModel.updateLastLogin(user.id);

        // Lấy danh sách các vai trò hệ thống hiện có của người dùng qua UserModel (thuần túy từ user_system_roles)
        const systemRoles = await UserModel.getUserSystemRoles(user.id);
        const orgRoles = await UserModel.getUserOrganizations(user.id);
        const primarySystemRole = resolvePrimarySystemRole(systemRoles);

        const authStatus = await UserModel.findAuthStatus(user.id);
        const token = this.generateToken({ ...user, token_version: authStatus?.token_version ?? 1 }, systemRoles);
        return {
            id: user.id,
            email: user.email,
            full_name: user.full_name,
            avatar_url: user.avatar_url || null,
            avatarUrl: user.avatar_url || null,
            token,
            system_roles: systemRoles,
            systemRole: primarySystemRole,
            system_role: primarySystemRole,
            has_organization: orgRoles.length > 0,
            organization_roles: orgRoles,
        };
    }

    // 3. Xác thực Email bằng mã xác thực (Code/Token nhận được từ email)
    public static async verifyEmail(rawCode: string, userId?: string): Promise<{ email: string; verified_at: Date; token?: string; user?: any }> {
        if (!rawCode || typeof rawCode !== 'string') {
            throw new ApiError(400, 'Vui lòng cung cấp mã xác thực được gửi về email của bạn');
        }

        const attemptKey = userId ? `otp:fail:${userId}` : null;
        if (attemptKey) {
            if (isRedisReady()) {
                const fails = Number(await redisClient.get(attemptKey) || 0);
                if (fails >= OTP_MAX_FAILED_ATTEMPTS) {
                    throw new ApiError(429, 'Bạn đã nhập sai mã OTP quá nhiều lần. Vui lòng yêu cầu gửi lại mã mới sau 15 phút.');
                }
            } else {
                const mem = MEMORY_OTP_FAILURES.get(attemptKey);
                if (mem && mem.expiresAt > Date.now() && mem.count >= OTP_MAX_FAILED_ATTEMPTS) {
                    throw new ApiError(429, 'Bạn đã nhập sai mã OTP quá nhiều lần. Vui lòng yêu cầu gửi lại mã mới sau 15 phút.');
                }
            }
        }

        const tokenHash = crypto.createHash('sha256').update(rawCode.trim()).digest('hex');

        // Tìm mã xác thực qua AuthModel
        const tokenRecord = await AuthModel.findVerificationToken(tokenHash, userId);

        if (!tokenRecord) {
            if (attemptKey) {
                if (isRedisReady()) {
                    const count = await redisClient.incr(attemptKey);
                    if (count === 1) await redisClient.expire(attemptKey, OTP_LOCKOUT_SECONDS);
                    if (count >= OTP_MAX_FAILED_ATTEMPTS && userId) {
                        await AuthModel.deletePendingTokens(userId).catch(() => {});
                    }
                } else {
                    const cur = MEMORY_OTP_FAILURES.get(attemptKey);
                    const nextCount = cur && cur.expiresAt > Date.now() ? cur.count + 1 : 1;
                    MEMORY_OTP_FAILURES.set(attemptKey, { count: nextCount, expiresAt: Date.now() + OTP_LOCKOUT_SECONDS * 1000 });
                    if (nextCount >= OTP_MAX_FAILED_ATTEMPTS && userId) {
                        await AuthModel.deletePendingTokens(userId).catch(() => {});
                    }
                }
            }
            throw new ApiError(400, 'Mã xác thực không chính xác hoặc không tồn tại');
        }

        if (tokenRecord.verified_at) {
            throw new ApiError(400, 'Mã xác thực này đã được sử dụng trước đó');
        }

        if (new Date() > new Date(tokenRecord.expires_at)) {
            throw new ApiError(400, 'Mã xác thực đã hết hạn, vui lòng yêu cầu gửi mã mới');
        }

        // Đánh dấu mã xác thực đã được sử dụng atomic (single-use)
        const claimed = await AuthModel.markTokenVerified(tokenRecord.id);
        if (!claimed) {
            throw new ApiError(400, 'Mã xác thực này đã được sử dụng trước đó');
        }

        if (attemptKey) {
            if (isRedisReady()) {
                await redisClient.del(attemptKey).catch(() => {});
            }
            MEMORY_OTP_FAILURES.delete(attemptKey);
        }

        // Kích hoạt người dùng sang ACTIVE và lưu mốc email_verified_at qua AuthModel
        const activatedUser = await AuthModel.verifyUserEmailAndActivate(tokenRecord.user_id);
        if (!activatedUser) {
            throw new ApiError(404, 'Không tìm thấy người dùng sở hữu mã xác thực này');
        }

        const fullUser = await UserModel.findFullByEmail(activatedUser.email);
        const userIdResolved = fullUser?.id || tokenRecord.user_id;
        const systemRoles = await UserModel.getUserSystemRoles(userIdResolved);
        const orgRoles = await UserModel.getUserOrganizations(userIdResolved);
        const primarySystemRole = resolvePrimarySystemRole(systemRoles);
        const authStatus = await UserModel.findAuthStatus(userIdResolved);
        const accessToken = this.generateToken(
            {
                id: userIdResolved,
                email: activatedUser.email,
                status: fullUser?.status || 'ACTIVE',
                token_version: authStatus?.token_version ?? 1,
            },
            systemRoles
        );

        return {
            email: activatedUser.email,
            verified_at: activatedUser.email_verified_at,
            token: accessToken,
            user: {
                id: userIdResolved,
                email: activatedUser.email,
                full_name: fullUser?.full_name || '',
                avatar_url: fullUser?.avatar_url || null,
                status: fullUser?.status || 'ACTIVE',
                email_verified_at: activatedUser.email_verified_at,
                system_roles: systemRoles,
                systemRole: primarySystemRole,
                system_role: primarySystemRole,
                has_organization: orgRoles.length > 0,
                organization_roles: orgRoles,
            },
        };
    }

    // 4. Gửi mã xác thực về email cho người dùng (có cooldown, không trả OTP ra HTTP response)
    public static async sendVerificationEmail(userId: string): Promise<ISendVerificationResult> {
        if (!userId) {
            throw new ApiError(400, 'Không tìm thấy thông tin định danh người dùng');
        }

        const cleanUserId = userId.trim();
        const cooldownKey = `otp:cooldown:${cleanUserId}`;
        if (isRedisReady()) {
            const acquired = await redisClient.set(cooldownKey, '1', 'EX', OTP_COOLDOWN_SECONDS, 'NX');
            if (!acquired) {
                throw new ApiError(429, 'Vui lòng chờ ít nhất 60 giây trước khi yêu cầu gửi lại mã xác thực');
            }
        } else {
            const now = Date.now();
            const until = MEMORY_OTP_COOLDOWN.get(cooldownKey) || 0;
            if (until > now) {
                throw new ApiError(429, 'Vui lòng chờ ít nhất 60 giây trước khi yêu cầu gửi lại mã xác thực');
            }
            MEMORY_OTP_COOLDOWN.set(cooldownKey, now + OTP_COOLDOWN_SECONDS * 1000);
        }

        const user = await UserModel.findBasicById(cleanUserId);
        if (!user) {
            throw new ApiError(404, 'Không tìm thấy người dùng');
        }

        if (user.email_verified_at) {
            throw new ApiError(400, 'Tài khoản này đã được xác thực email trước đó rồi');
        }

        // Tạo mã xác thực OTP 6 số mới bằng CSPRNG
        const rawCode = await this.createEmailVerificationToken(user.id);
        
        // Gửi email xác thực (không lộ OTP ra API response)
        await EmailQueue.enqueueVerification(user.email, rawCode, user.full_name);

        return {
            email: user.email,
            sent: true,
        };
    }

    /**
     * Xác thực token với Google (kiểm chứng chữ ký RS256 JWKS, aud, iss, exp, email_verified)
     */
    public static async verifyGoogleToken(token: string): Promise<{ email: string; name: string; picture?: string }> {
        // 1. Google ID Token (JWT 3 phần) -> Xác thực chữ ký mật mã RS256 qua Google JWKS + claims iss/aud/exp/email_verified
        if (token.includes('.') && token.split('.').length === 3) {
            try {
                const decodedHeader = jwt.decode(token, { complete: true }) as { header?: { kid?: string; alg?: string } } | null;
                if (!decodedHeader?.header || decodedHeader.header.alg !== 'RS256') {
                    throw new ApiError(401, 'Google ID token có thuật toán chữ ký không hợp lệ');
                }
                let keys = await fetchGoogleJwks(false);
                let jwk =
                    keys.find((k) => k.kid && k.kid === decodedHeader.header!.kid) ||
                    (!decodedHeader.header.kid && keys.length === 1 ? keys[0] : undefined);
                if (!jwk) {
                    keys = await fetchGoogleJwks(true);
                    jwk = keys.find((k) => k.kid && k.kid === decodedHeader.header!.kid);
                }
                if (!jwk) {
                    throw new ApiError(401, 'Không tìm thấy khóa xác thực Google phù hợp');
                }
                const publicKey = crypto.createPublicKey({ key: jwk, format: 'jwk' });
                const verified = jwt.verify(token, publicKey, {
                    algorithms: ['RS256'],
                    audience: config.googleClientId,
                    issuer: ['https://accounts.google.com', 'accounts.google.com'],
                }) as any;

                if (!verified?.email || verified.email_verified !== true) {
                    throw new ApiError(401, 'Tài khoản Google chưa xác thực email hoặc thiếu email');
                }
                return {
                    email: verified.email,
                    name: verified.name || verified.email.split('@')[0],
                    picture: verified.picture,
                };
            } catch (err) {
                if (err instanceof ApiError) throw err;
                throw new ApiError(401, 'Google ID token không hợp lệ hoặc đã hết hạn');
            }
        }

        // 2. Google OAuth2 Access Token -> bắt buộc đối chiếu tokeninfo (kiểm tra aud & email_verified)
        let infoRes: Response;
        try {
            infoRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(token)}`);
        } catch (err: any) {
            const reason = err?.cause?.code || err?.message || 'network_error';
            console.error('[AuthService] Lỗi kết nối Google OAuth2 API:', reason);
            throw new ApiError(503, 'Không thể kết nối tới dịch vụ xác thực Google. Vui lòng kiểm tra kết nối mạng hoặc proxy máy chủ.');
        }

        if (infoRes.ok) {
            const info = (await infoRes.json()) as any;
            const audMatches = info.aud === config.googleClientId || info.azp === config.googleClientId;
            const emailVerified = info.email_verified === true || info.email_verified === 'true';
            if (audMatches && emailVerified && info.email) {
                let profile: any = {};
                try {
                    const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                        headers: { Authorization: `Bearer ${token}` },
                    });
                    if (userRes.ok) profile = await userRes.json();
                } catch {
                    // userinfo chỉ để lấy tên/avatar bổ sung; không làm hỏng đăng nhập khi tokeninfo đã xác thực
                }
                return {
                    email: info.email,
                    name: profile.name || info.email.split('@')[0],
                    picture: profile.picture,
                };
            }
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

            // Gửi email chào mừng và thông báo kích hoạt tài khoản qua Google
            EmailQueue.enqueueGoogleWelcome(user.email, user.full_name).catch(() => {});
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

        const systemRoles = await UserModel.getUserSystemRoles(user.id);
        const orgRoles = await UserModel.getUserOrganizations(user.id);
        const primarySystemRole = resolvePrimarySystemRole(systemRoles);
        const authStatus = await UserModel.findAuthStatus(user.id);
        const jwtToken = this.generateToken({ ...user, token_version: authStatus?.token_version ?? 1 }, systemRoles);

        return {
            user: {
                id: user.id,
                email: user.email,
                full_name: user.full_name,
                avatar_url: user.avatar_url,
                status: user.status,
                system_roles: systemRoles,
                systemRole: primarySystemRole,
                system_role: primarySystemRole,
                organization_roles: orgRoles,
                has_organization: orgRoles.length > 0,
            },
            token: jwtToken,
        };
    }

    /**
     * Request a password reset token (stored hashed in password_reset_tokens, 15m TTL).
     * Always returns neutral success response to prevent account enumeration.
     */
    public static async requestPasswordReset(email: string): Promise<{ accepted: boolean }> {
        const cleanEmail = (email || '').toLowerCase().trim();
        if (!cleanEmail) return { accepted: true };

        const user = await UserModel.findByEmailWithPassword(cleanEmail);
        if (!user || user.status === 'SUSPENDED' || user.status === 'INACTIVE') {
            return { accepted: true };
        }

        const rawResetToken = crypto.randomBytes(32).toString('hex');
        const tokenHash = crypto.createHash('sha256').update(rawResetToken).digest('hex');
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

        await AuthModel.deletePendingPasswordResetTokens(user.id);
        await AuthModel.createPasswordResetToken(user.id, tokenHash, expiresAt);

        await EmailService.sendPasswordResetEmail(
            user.email,
            user.full_name || user.email,
            rawResetToken
        ).catch((err) => {
            console.error('[AuthService] Lỗi gửi email đặt lại mật khẩu:', (err as Error).message);
        });
        return { accepted: true };
    }

    /**
     * Complete password reset using a single-use token from password_reset_tokens.
     * Updates password, bumps token_version, and revokes all active refresh sessions & WS connections.
     */
    public static async resetPasswordWithToken(rawToken: string, newPassword: string): Promise<void> {
        if (!rawToken || typeof rawToken !== 'string' || rawToken.trim().length < 16) {
            throw new ApiError(400, 'Mã đặt lại mật khẩu không hợp lệ hoặc đã hết hạn');
        }
        if (!newPassword || newPassword.length < 6) {
            throw new ApiError(400, 'Mật khẩu mới phải có tối thiểu 6 ký tự');
        }

        const tokenHash = crypto.createHash('sha256').update(rawToken.trim()).digest('hex');
        const consumed = await AuthModel.consumePasswordResetToken(tokenHash);
        if (!consumed) {
            throw new ApiError(400, 'Mã đặt lại mật khẩu không hợp lệ hoặc đã hết hạn');
        }

        const salt = await bcrypt.genSalt(10);
        const newHash = await bcrypt.hash(newPassword, salt);
        await UserModel.updatePassword(consumed.user_id, newHash);
        await RefreshTokenService.revokeAllUserSessions(consumed.user_id, 'PASSWORD_RESET');
    }
}
