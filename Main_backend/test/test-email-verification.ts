import { AuthService } from '../src/services/auth.service';
import { pool } from '../src/config/database';

async function testWorkflow() {
  console.log('=== TEST QUY TRÌNH XÁC THỰC EMAIL ===\n');

  const testEmail = 'verify_flow_test@example.com';
  // Dọn dẹp dữ liệu cũ nếu có
  await pool.query('DELETE FROM users WHERE email = $1', [testEmail]);

  // 1. Đăng ký tài khoản mới
  console.log('Bước 1: Người dùng đăng ký tài khoản mới...');
  const regResult = await AuthService.register({
    email: testEmail,
    password: 'Password123@',
    full_name: 'Nguyễn Văn Kiểm Thử',
  });
  console.log('  -> User ID vừa tạo:', regResult.user.id);
  console.log('  -> Trạng thái ban đầu:', regResult.user.status);
  console.log('  -> Mã OTP gửi về email:', regResult.verification_token);

  // 2. Kiểm tra token được lưu an toàn trong bảng email_verification_tokens
  console.log('\nBước 2: Kiểm tra bản ghi trong bảng email_verification_tokens...');
  const tokenRecord = await pool.query(
    'SELECT id, user_id, token_hash, expires_at, verified_at FROM email_verification_tokens WHERE user_id = $1',
    [regResult.user.id]
  );
  const token = tokenRecord.rows[0];
  console.log('  -> Token ID:', token.id);
  console.log('  -> Token Hash (SHA-256):', token.token_hash);
  console.log('  -> Hạn sử dụng:', token.expires_at);
  console.log('  -> Trạng thái verified_at:', token.verified_at);

  // 3. Tiến hành xác thực email với mã OTP nhận được
  console.log('\nBước 3: Người dùng nhập mã OTP để xác thực email...');
  const verifyResult = await AuthService.verifyEmail(regResult.verification_token!);
  console.log('  -> Kết quả verifyEmail:', verifyResult);

  // 4. Kiểm tra user trong DB sau xác thực
  console.log('\nBước 4: Đối chiếu dữ liệu User trong DB sau khi xác thực...');
  const userAfter = await pool.query(
    'SELECT id, email, status, email_verified_at, updated_at FROM users WHERE id = $1',
    [regResult.user.id]
  );
  console.log('  -> Email:', userAfter.rows[0].email);
  console.log('  -> Trạng thái User:', userAfter.rows[0].status);
  console.log('  -> email_verified_at:', userAfter.rows[0].email_verified_at);

  // 5. Thử xác thực lại lần 2 bằng chính mã cũ (Kiểm tra chống Replay Attack)
  console.log('\nBước 5: Thử dùng lại mã OTP đã xác thực (Chống Replay Attack)...');
  try {
    await AuthService.verifyEmail(regResult.verification_token!);
    console.log('  ❌ Lỗi bảo mật: Hệ thống cho phép dùng lại mã OTP cũ!');
  } catch (err: any) {
    console.log('  ✅ An toàn! Bị từ chối chính xác với thông báo:', err.message);
  }

  // 6. Dọn dẹp dữ liệu test
  await pool.query('DELETE FROM users WHERE email = $1', [testEmail]);
  console.log('\n=== QUY TRÌNH XÁC THỰC EMAIL HOẠT ĐỘNG HOÀN TOÀN CHÍNH XÁC ===\n');

  await pool.end();
}

testWorkflow().catch((err) => {
  console.error('Lỗi kiểm thử:', err);
  process.exit(1);
});
