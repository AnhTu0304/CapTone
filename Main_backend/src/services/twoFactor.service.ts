import crypto from 'crypto';
import QRCode from 'qrcode';
import bcrypt from 'bcryptjs';
import { TwoFactorModel, IBackupCodeItem } from '../models/twoFactor.model';
import { UserModel } from '../models/user.model';
import { ApiError } from '../utils/apiError';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function bufferToBase32(buffer: Buffer): string {
    let bits = 0;
    let value = 0;
    let output = '';
    for (let i = 0; i < buffer.length; i++) {
        value = (value << 8) | buffer[i];
        bits += 8;
        while (bits >= 5) {
            output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
            bits -= 5;
        }
    }
    if (bits > 0) {
        output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
    }
    return output;
}

function base32ToBuffer(base32: string): Buffer {
    const cleanStr = base32.toUpperCase().replace(/=+$/, '').replace(/\s+/g, '');
    let bits = 0;
    let value = 0;
    const bytes: number[] = [];
    for (let i = 0; i < cleanStr.length; i++) {
        const idx = BASE32_ALPHABET.indexOf(cleanStr[i]);
        if (idx === -1) continue;
        value = (value << 5) | idx;
        bits += 5;
        if (bits >= 8) {
            bytes.push((value >>> (bits - 8)) & 255);
            bits -= 8;
        }
    }
    return Buffer.from(bytes);
}

function computeTOTP(secretBuffer: Buffer, timeStep: number): string {
    const buffer = Buffer.alloc(8);
    buffer.writeUInt32BE(0, 0);
    buffer.writeUInt32BE(timeStep, 4);

    const hmac = crypto.createHmac('sha1', secretBuffer);
    hmac.update(buffer);
    const digest = hmac.digest();

    const offset = digest[digest.length - 1] & 0x0f;
    const binary =
        ((digest[offset] & 0x7f) << 24) |
        ((digest[offset + 1] & 0xff) << 16) |
        ((digest[offset + 2] & 0xff) << 8) |
        (digest[offset + 3] & 0xff);

    return (binary % 1000000).toString().padStart(6, '0');
}

export function verifyTOTPCode(secretBase32: string, token: string, window: number = 1): boolean {
    const cleanToken = token ? token.toString().trim() : '';
    if (!cleanToken || cleanToken.length !== 6 || !/^\d{6}$/.test(cleanToken)) {
        return false;
    }
    try {
        const secretBuffer = base32ToBuffer(secretBase32);
        if (secretBuffer.length === 0) return false;

        const now = Math.floor(Date.now() / 1000);
        const currentStep = Math.floor(now / 30);

        for (let i = -window; i <= window; i++) {
            const step = currentStep + i;
            const expected = computeTOTP(secretBuffer, step);
            if (crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(cleanToken))) {
                return true;
            }
        }
    } catch {
        return false;
    }
    return false;
}

export class TwoFactorService {
    /**
     * Lấy trạng thái 2FA của người dùng
     */
    public static async getStatus(userId: string) {
        const record = await TwoFactorModel.findByUserId(userId);
        if (!record || !record.is_enabled) {
            return {
                is_enabled: false,
                confirmed_at: null,
                remaining_backup_codes: 0,
            };
        }

        const remainingBackupCodes = record.backup_codes.filter(c => !c.used).length;
        return {
            is_enabled: true,
            confirmed_at: record.confirmed_at,
            remaining_backup_codes: remainingBackupCodes,
        };
    }

    /**
     * Khởi tạo thiết lập 2FA: Sinh secret key, QR Code Data URL và 8 mã dự phòng (backup codes)
     */
    public static async setup(userId: string, email: string) {
        // Sinh ngẫu nhiên 20 byte cho TOTP secret (160-bit chuẩn RFC 6238)
        const secretBuffer = crypto.randomBytes(20);
        const secret = bufferToBase32(secretBuffer);

        const issuer = 'CapTone';
        const otpauthUrl = `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(email)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;

        // Sinh QR Code Data URL
        const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl, {
            errorCorrectionLevel: 'M',
            margin: 2,
            width: 256,
            color: {
                dark: '#0f172a',
                light: '#ffffff',
            },
        });

        // Sinh 8 mã dự phòng (8 mã hex ngẫu nhiên, ví dụ: a3f8b912)
        const plainBackupCodes: string[] = [];
        const backupCodeItems: IBackupCodeItem[] = [];

        for (let i = 0; i < 8; i++) {
            const code = crypto.randomBytes(4).toString('hex').toLowerCase();
            plainBackupCodes.push(code);
            const codeHash = crypto.createHash('sha256').update(code).digest('hex');
            backupCodeItems.push({
                codeHash,
                used: false,
                used_at: null,
            });
        }

        // Lưu vào cơ sở dữ liệu ở trạng thái chưa kích hoạt (is_enabled = FALSE)
        await TwoFactorModel.upsertSecret(userId, secret, backupCodeItems);

        return {
            secret,
            qrCodeDataUrl,
            otpauthUrl,
            backupCodes: plainBackupCodes,
        };
    }

    /**
     * Kích hoạt 2FA: Xác thực mã OTP 6 số đầu tiên từ ứng dụng Authenticator
     */
    public static async enable(userId: string, code: string) {
        const record = await TwoFactorModel.findByUserId(userId);
        if (!record || !record.secret_key) {
            throw new ApiError(400, 'Chưa có cấu hình 2FA để kích hoạt. Vui lòng tạo mã QR trước.');
        }

        const isValid = verifyTOTPCode(record.secret_key, code);
        if (!isValid) {
            throw new ApiError(400, 'Mã xác thực 2FA không chính xác hoặc đã hết hạn.');
        }

        await TwoFactorModel.enable(userId);
        return {
            message: 'Kích hoạt xác thực 2 yếu tố (2FA) thành công.',
            is_enabled: true,
        };
    }

    /**
     * Vô hiệu hóa 2FA: Có thể yêu cầu mật khẩu để xác minh an toàn
     */
    public static async disable(userId: string, password?: string) {
        if (password) {
            const user = await UserModel.findByIdWithPassword(userId);
            if (!user) {
                throw new ApiError(404, 'Không tìm thấy người dùng');
            }
            const isMatch = await bcrypt.compare(password, user.password_hash || '');
            if (!isMatch) {
                throw new ApiError(400, 'Mật khẩu tài khoản không chính xác');
            }
        }

        await TwoFactorModel.disable(userId);
        return {
            message: 'Đã vô hiệu hóa xác thực 2 yếu tố (2FA).',
            is_enabled: false,
        };
    }

    /**
     * Kiểm tra mã đăng nhập (chấp nhận cả mã OTP 6 số hoặc một trong các mã backup 8 ký tự)
     */
    public static async verifyLoginCode(userId: string, inputCode: string): Promise<{ success: boolean; usedBackupCode: boolean }> {
        const record = await TwoFactorModel.findByUserId(userId);
        if (!record || !record.is_enabled) {
            return { success: false, usedBackupCode: false };
        }

        const clean = inputCode ? inputCode.trim() : '';

        // 1. Thử xác thực như mã TOTP 6 số
        if (/^\d{6}$/.test(clean)) {
            const isTotpValid = verifyTOTPCode(record.secret_key, clean);
            if (isTotpValid) {
                return { success: true, usedBackupCode: false };
            }
        }

        // 2. Thử đối chiếu với danh sách backup codes
        const inputHash = crypto.createHash('sha256').update(clean.toLowerCase()).digest('hex');
        let matched = false;
        const updatedBackupCodes = (record.backup_codes || []).map(b => {
            if (!b.used && b.codeHash === inputHash) {
                matched = true;
                return {
                    ...b,
                    used: true,
                    used_at: new Date().toISOString(),
                };
            }
            return b;
        });

        if (matched) {
            await TwoFactorModel.updateBackupCodes(userId, updatedBackupCodes);
            return { success: true, usedBackupCode: true };
        }

        return { success: false, usedBackupCode: false };
    }
}
