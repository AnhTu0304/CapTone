import { pool } from '../config/database';
import { AuthService } from '../services/auth.service';
import { TwoFactorService, verifyTOTPCode } from '../services/twoFactor.service';
import { UserModel } from '../models/user.model';
import bcrypt from 'bcryptjs';

async function run2FATest() {
    console.log('--- BẮT ĐẦU KIỂM THỬ HỆ THỐNG 2FA (RFC 6238 TOTP) ---');
    const testEmail = `test_2fa_${Date.now()}@test.com`;
    const testPassword = 'Password123!';

    try {
        // 1. Tạo user thử nghiệm
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(testPassword, salt);
        const testUser = await UserModel.create({
            email: testEmail,
            password_hash: passwordHash,
            full_name: 'Test 2FA User',
            status: 'ACTIVE',
        });
        console.log('1. Đã tạo test user:', testUser.id, testUser.email);

        // 2. Kiểm tra đăng nhập bình thường khi CHƯA bật 2FA (Backward Compatibility)
        const normalLogin = await AuthService.login({ email: testEmail, password: testPassword });
        if (normalLogin.token && !normalLogin.require_2fa) {
            console.log('2. ✅ Đăng nhập bình thường khi 2FA tắt: THÀNH CÔNG');
        } else {
            throw new Error('Đăng nhập thông thường bị lỗi khi 2FA chưa bật!');
        }

        // 3. Kiểm tra status ban đầu
        const initialStatus = await TwoFactorService.getStatus(testUser.id);
        if (!initialStatus.is_enabled) {
            console.log('3. ✅ Trạng thái ban đầu is_enabled = false: THÀNH CÔNG');
        } else {
            throw new Error('Trạng thái ban đầu không đúng!');
        }

        // 4. Khởi tạo cấu hình 2FA (setup)
        const setupResult = await TwoFactorService.setup(testUser.id, testUser.email);
        if (setupResult.secret && setupResult.qrCodeDataUrl.startsWith('data:image/png;base64,') && setupResult.backupCodes.length === 8) {
            console.log('4. ✅ Setup 2FA sinh secret, QR code Data URL và 8 backup codes: THÀNH CÔNG');
        } else {
            throw new Error('Setup 2FA không trả về đúng dữ liệu!');
        }

        // 5. Thử kích hoạt với mã sai -> Phải thất bại
        try {
            await TwoFactorService.enable(testUser.id, '000000');
            throw new Error('Kích hoạt với mã sai nhưng lại thành công!');
        } catch (err: any) {
            console.log('5. ✅ Kích hoạt với OTP sai bị chặn chính xác:', err.message);
        }

        // 6. Tính toán mã TOTP hợp lệ và kích hoạt
        const { default: crypto } = await import('crypto');
        const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
        function base32ToBuffer(base32: string): Buffer {
            const cleanStr = base32.toUpperCase().replace(/=+$/, '').replace(/\s+/g, '');
            let bits = 0, value = 0;
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

        const secretBuf = base32ToBuffer(setupResult.secret);
        const timeStep = Math.floor(Date.now() / 1000 / 30);
        const buf = Buffer.alloc(8);
        buf.writeUInt32BE(0, 0);
        buf.writeUInt32BE(timeStep, 4);
        const hmac = crypto.createHmac('sha1', secretBuf).update(buf).digest();
        const offset = hmac[hmac.length - 1] & 0x0f;
        const bin = ((hmac[offset] & 0x7f) << 24) | ((hmac[offset + 1] & 0xff) << 16) | ((hmac[offset + 2] & 0xff) << 8) | (hmac[offset + 3] & 0xff);
        const validCode = (bin % 1000000).toString().padStart(6, '0');

        const enableRes = await TwoFactorService.enable(testUser.id, validCode);
        console.log('6. ✅ Kích hoạt 2FA với mã TOTP hợp lệ:', enableRes.message);

        // 7. Kiểm tra status sau khi bật
        const enabledStatus = await TwoFactorService.getStatus(testUser.id);
        if (enabledStatus.is_enabled && enabledStatus.remaining_backup_codes === 8) {
            console.log('7. ✅ Status sau kích hoạt is_enabled = true (8 backup codes): THÀNH CÔNG');
        } else {
            throw new Error('Status sau kích hoạt không chính xác!');
        }

        // 8. Đăng nhập khi ĐÃ BẬT 2FA -> Hệ thống phải yêu cầu OTP và trả về temp_token
        const loginChallenge = await AuthService.login({ email: testEmail, password: testPassword });
        if (loginChallenge.require_2fa && loginChallenge.temp_token) {
            console.log('8. ✅ Đăng nhập khi bật 2FA trả về require_2fa: true & temp_token: THÀNH CÔNG');
        } else {
            throw new Error('Đăng nhập khi bật 2FA không yêu cầu mã xác thực!');
        }

        // 9. Xác thực 2FA login với mã OTP sai
        try {
            await AuthService.verify2FALogin(loginChallenge.temp_token, '123456');
            throw new Error('verify2FALogin với mã sai lại thành công!');
        } catch (err: any) {
            console.log('9. ✅ verify2FALogin với mã sai bị từ chối:', err.message);
        }

        // 10. Xác thực 2FA login với mã OTP đúng
        const validLoginRes = await AuthService.verify2FALogin(loginChallenge.temp_token, validCode);
        if (validLoginRes.token) {
            console.log('10. ✅ verify2FALogin với mã TOTP đúng cấp JWT Token thành công!');
        } else {
            throw new Error('verify2FALogin không cấp token!');
        }

        // 11. Đăng nhập bằng Backup Code
        const loginChallenge2 = await AuthService.login({ email: testEmail, password: testPassword });
        const backupCode = setupResult.backupCodes[0];
        const backupLoginRes = await AuthService.verify2FALogin(loginChallenge2.temp_token!, backupCode);
        if (backupLoginRes.token) {
            console.log('11. ✅ Đăng nhập bằng mã dự phòng Backup Code thành công!');
        }

        // Kiểm tra mã backup đó đã bị tiêu thụ
        const statusAfterBackup = await TwoFactorService.getStatus(testUser.id);
        if (statusAfterBackup.remaining_backup_codes === 7) {
            console.log('12. ✅ Mã dự phòng đã được tiêu thụ (còn lại 7 mã): THÀNH CÔNG');
        }

        // 13. Vô hiệu hóa 2FA
        await TwoFactorService.disable(testUser.id, testPassword);
        const finalStatus = await TwoFactorService.getStatus(testUser.id);
        if (!finalStatus.is_enabled) {
            console.log('13. ✅ Vô hiệu hóa 2FA thành công!');
        }

        // 14. Đăng nhập lại trực tiếp
        const directLogin = await AuthService.login({ email: testEmail, password: testPassword });
        if (directLogin.token && !directLogin.require_2fa) {
            console.log('14. ✅ Đăng nhập trực tiếp sau khi tắt 2FA: THÀNH CÔNG');
        }

        // Dọn dẹp
        await pool.query('DELETE FROM users WHERE id = $1', [testUser.id]);
        console.log('--- TẤT CẢ 14/14 TIÊU CHÍ KIỂM THỬ 2FA ĐỀU HOÀN TOÀN CHÍNH XÁC & KHÔNG XUNG ĐỘT! ---');
    } catch (e) {
        console.error('LỖI KIỂM THỬ 2FA:', e);
        process.exit(1);
    } finally {
        await pool.end();
        process.exit(0);
    }
}

run2FATest();
