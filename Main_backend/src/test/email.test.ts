import test, { describe } from 'node:test';
import assert from 'node:assert';
import { EmailService } from '../services/email.service';
import { config } from '../config/env';

describe('Mail Service & SMTP Configuration Suite [PB06 2.3]', () => {
  test('1. Đọc và tải đầy đủ cấu hình SMTP từ biến môi trường', () => {
    assert.ok(config.email, 'Cấu hình config.email phải tồn tại');
    assert.strictEqual(config.email.host, 'smtp.gmail.com', 'SMTP_HOST mặc định hoặc cấu hình là smtp.gmail.com');
    assert.strictEqual(config.email.port, 587, 'SMTP_PORT phải là 587 (STARTTLS)');
    assert.strictEqual(config.email.secure, false, 'SMTP_SECURE phải là false cho port 587 STARTTLS');
    assert.ok(config.email.clientUrl, 'CLIENT_URL phải được xác định');
  });

  test('2. Địa chỉ EMAIL_FROM tuân thủ chính sách chống giả mạo của Gmail SMTP', () => {
    const fromAddress = EmailService.getFromAddress();
    assert.ok(fromAddress, 'Địa chỉ FROM không được rỗng');

    if (config.email.host.includes('gmail.com') && config.email.user) {
      // Khi gửi qua Gmail SMTP, địa chỉ email trong FROM phải trùng với SMTP_USER để tránh bị Gmail từ chối (550 5.7.1)
      assert.ok(
        fromAddress.includes(config.email.user),
        `Địa chỉ FROM (${fromAddress}) phải chứa tài khoản xác thực (${config.email.user}) khi dùng Gmail SMTP`
      );
    }
  });

  test('3. Kiểm tra kết nối SMTP thực tế (STARTTLS qua port 587)', async () => {
    if (!config.email.user || !config.email.pass) {
      console.log('⚠️ Bỏ qua test kết nối thực tế do chưa cấu hình SMTP_USER / SMTP_PASS trong .env');
      return;
    }

    const verification = await EmailService.verifyConnection();
    assert.strictEqual(
      verification.success,
      true,
      `Xác thực kết nối SMTP thất bại: ${verification.message}`
    );
  });
});
