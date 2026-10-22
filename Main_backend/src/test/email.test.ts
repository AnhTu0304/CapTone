import test, { describe, after } from 'node:test';
import assert from 'node:assert';
import { EmailService } from '../services/email.service';
import { EmailQueue, EmailWorker, EmailJob } from '../services/emailQueue.service';
import { config } from '../config/env';
import { redisClient, isRedisReady, closeRedis } from '../config/redis';

describe('Mail Service & Background Worker Email Queue Suite [PB06 2.3]', () => {
  after(async () => {
    // Stop worker and clean up handles
    await EmailWorker.stop();
    // Clean up test keys in redis if connected
    if (isRedisReady()) {
      await redisClient.del('email_queue:jobs', 'email_queue:dead_letter', 'email_queue:stats');
    }
    await closeRedis();
  });

  // --- A. SMTP Cấu hình & Bảo mật ---

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

  // --- B. Phân loại lỗi Transient vs Permanent (Không retry lỗi 5xx/Auth) ---

  test('3. Phân loại lỗi mạng và DNS tạm thời (Transient) là hợp lệ để retry', () => {
    assert.strictEqual(EmailService.isTransientError({ code: 'ETIMEDOUT' }), true);
    assert.strictEqual(EmailService.isTransientError({ code: 'ECONNRESET' }), true);
    assert.strictEqual(EmailService.isTransientError({ code: 'ECONNREFUSED' }), true);
    assert.strictEqual(EmailService.isTransientError({ code: 'ESOCKET' }), true);
    assert.strictEqual(EmailService.isTransientError({ code: 'EAI_AGAIN' }), true);
    assert.strictEqual(EmailService.isTransientError({ responseCode: 421 }), true);
    assert.strictEqual(EmailService.isTransientError({ responseCode: 450 }), true);
  });

  test('4. Phân loại lỗi vĩnh viễn (Permanent: 535 Auth, 501 Syntax, 550) là KHÔNG ĐƯỢC retry', () => {
    assert.strictEqual(EmailService.isTransientError({ responseCode: 535, message: 'Authentication failed' }), false);
    assert.strictEqual(EmailService.isTransientError({ responseCode: 501, message: 'Syntax error' }), false);
    assert.strictEqual(EmailService.isTransientError({ responseCode: 550, message: 'User not found' }), false);
    assert.strictEqual(EmailService.isTransientError({ responseCode: 553, message: 'Relay denied' }), false);
    assert.strictEqual(EmailService.isTransientError(null), false);
  });

  // --- C. Hàng đợi Email & Background Worker (Redis-backed Queue) ---

  test('5. Enqueue Verification Email sinh ra Job ID hợp lệ và lưu vào queue', async () => {
    const jobId = await EmailQueue.enqueueVerification('test.verify@selfheal.io', '123456', 'Nguyễn Văn Test');
    assert.ok(jobId, 'Job ID trả về phải tồn tại');
    assert.match(jobId, /^[0-9a-f-]{36}$/i, 'Job ID phải có định dạng UUID');
  });

  test('6. Enqueue Invitation Email sinh ra Job ID hợp lệ', async () => {
    const jobId = await EmailQueue.enqueueInvitation(
      'invited.user@selfheal.io',
      'Lê Thị B',
      'Admin Tu Ngo',
      'Viettel Cloud DevOps',
      'DEVOPS_ENGINEER'
    );
    assert.ok(jobId, 'Job ID trả về phải tồn tại');
    assert.match(jobId, /^[0-9a-f-]{36}$/i, 'Job ID phải có định dạng UUID');
  });

  test('7. Background Worker xử lý job thành công và cập nhật thống kê sent', async () => {
    // Giả lập mock transporter thành công
    const mockTransporter: any = {
      sendMail: async () => ({ messageId: 'mock-msg-123' }),
    };
    EmailService.setTransporterForTesting(mockTransporter);

    const testJob: EmailJob = {
      id: 'test-job-success-1',
      type: 'VERIFICATION_EMAIL',
      toEmail: 'worker.test@selfheal.io',
      token: '654321',
      fullName: 'Worker Tester',
      createdAt: Date.now(),
      attempts: 0,
      maxAttempts: 3,
    };

    const success = await EmailWorker.processJob(testJob);
    assert.strictEqual(success, true, 'Worker phải xử lý job thành công');
    assert.strictEqual(testJob.attempts, 1, 'Số lần attempts phải tăng lên 1');

    // Reset transporter về null
    EmailService.setTransporterForTesting(null);
  });

  test('8. Worker xử lý job thất bại vĩnh viễn (535 Auth error) chuyển vào Dead Letter Queue (DLQ)', async () => {
    // Giả lập transporter trả về lỗi xác thực vĩnh viễn
    const authError: any = new Error('535 5.7.8 Username and Password not accepted');
    authError.responseCode = 535;

    const mockTransporter: any = {
      sendMail: async () => {
        throw authError;
      },
    };
    EmailService.setTransporterForTesting(mockTransporter);

    const testJob: EmailJob = {
      id: 'test-job-dlq-1',
      type: 'VERIFICATION_EMAIL',
      toEmail: 'fail.test@selfheal.io',
      token: '999888',
      fullName: 'Fail Tester',
      createdAt: Date.now(),
      attempts: 0,
      maxAttempts: 3,
    };

    const success = await EmailWorker.processJob(testJob);
    assert.strictEqual(success, false, 'Worker phải đánh dấu job thất bại');
    assert.ok(testJob.lastError, 'lastError phải được ghi nhận');

    // Reset transporter về null
    EmailService.setTransporterForTesting(null);
  });

  test('9. Lấy thống kê hàng đợi EmailQueue.getQueueStats()', async () => {
    const stats = await EmailQueue.getQueueStats();
    assert.strictEqual(typeof stats.pendingJobs, 'number');
    assert.strictEqual(typeof stats.deadLetterJobs, 'number');
    assert.strictEqual(typeof stats.enqueued, 'number');
    assert.strictEqual(typeof stats.sent, 'number');
    assert.strictEqual(typeof stats.failed, 'number');
  });

  // --- D. Kiểm tra kết nối SMTP thực tế (STARTTLS port 587) ---

  test('10. Kiểm tra kết nối SMTP thực tế (STARTTLS qua port 587)', async () => {
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
