import test, { describe, before, after } from 'node:test';
import assert from 'node:assert';
import { EmailService } from '../services/email.service';
import { EmailQueue, EmailWorker, EmailJob, REDIS_KEYS } from '../services/emailQueue.service';
import { config } from '../config/env';
import { redisClient, isRedisReady, closeRedis, testRedisConnection } from '../config/redis';

describe('Mail Service & Background Worker Email Queue Suite [PB06 2.3]', () => {
  before(async () => {
    await testRedisConnection();
  });
  after(async () => {
    // Stop worker and clean up handles
    await EmailWorker.stop();
    // Clean up test keys in redis if connected
    if (isRedisReady()) {
      await redisClient.del(
        REDIS_KEYS.JOBS,
        REDIS_KEYS.PROCESSING,
        REDIS_KEYS.DEAD_LETTER,
        REDIS_KEYS.STATS
      );
    }
    await closeRedis();
  });

  // =========================================================================
  // PHẦN A: SMTP CẤU HÌNH & BẢO MẬT (Unit Tests)
  // =========================================================================

  test('1. Đọc và tải đầy đủ cấu hình SMTP từ biến môi trường', () => {
    assert.ok(config.email, 'Cấu hình config.email phải tồn tại');
    assert.strictEqual(config.email.host, 'smtp.gmail.com', 'SMTP_HOST mặc định hoặc cấu hình là smtp.gmail.com');
    assert.strictEqual(config.email.port, 587, 'SMTP_PORT phải là 587 (STARTTLS)');
    assert.strictEqual(config.email.secure, false, 'SMTP_SECURE phải là false cho port 587 STARTTLS');
    assert.ok(config.email.clientUrl, 'CLIENT_URL phải được xác định');
    assert.strictEqual(typeof config.email.inProcessWorker, 'boolean', 'inProcessWorker phải là boolean');
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

  test('3. setTransporterForTesting có production guard chống can thiệp trong production', () => {
    const originalEnv = config.nodeEnv;
    const originalIsProduction = config.isProduction;

    try {
      // Giả lập môi trường production
      (config as any).isProduction = true;
      assert.throws(
        () => EmailService.setTransporterForTesting({} as any),
        /SECURITY VIOLATION: setTransporterForTesting is strictly forbidden in production/
      );
    } finally {
      (config as any).isProduction = originalIsProduction;
      (config as any).nodeEnv = originalEnv;
    }
  });

  // =========================================================================
  // PHẦN B: PHÂN LOẠI LỖI TRANSIENT VS PERMANENT (Unit Tests)
  // =========================================================================

  test('4. Phân loại lỗi mạng và DNS tạm thời (Transient) là hợp lệ để retry', () => {
    assert.strictEqual(EmailService.isTransientError({ code: 'ETIMEDOUT' }), true);
    assert.strictEqual(EmailService.isTransientError({ code: 'ECONNRESET' }), true);
    assert.strictEqual(EmailService.isTransientError({ code: 'ECONNREFUSED' }), true);
    assert.strictEqual(EmailService.isTransientError({ code: 'ESOCKET' }), true);
    assert.strictEqual(EmailService.isTransientError({ code: 'EAI_AGAIN' }), true);
    assert.strictEqual(EmailService.isTransientError({ responseCode: 421 }), true);
    assert.strictEqual(EmailService.isTransientError({ responseCode: 450 }), true);
  });

  test('5. Phân loại lỗi vĩnh viễn (Permanent: 535 Auth, 501 Syntax, 550) là KHÔNG ĐƯỢC retry', () => {
    assert.strictEqual(EmailService.isTransientError({ responseCode: 535, message: 'Authentication failed' }), false);
    assert.strictEqual(EmailService.isTransientError({ responseCode: 501, message: 'Syntax error' }), false);
    assert.strictEqual(EmailService.isTransientError({ responseCode: 550, message: 'User not found' }), false);
    assert.strictEqual(EmailService.isTransientError({ responseCode: 553, message: 'Relay denied' }), false);
    assert.strictEqual(EmailService.isTransientError(null), false);
  });

  // =========================================================================
  // PHẦN C: HÀNG ĐỢI EMAIL BỀN VỮNG & ATOMIC RPOPLPUSH (Redis Integration Tests)
  // =========================================================================

  test('6. Enqueue Verification Email vào Redis với Job ID hợp lệ', async () => {
    const jobId = await EmailQueue.enqueueVerification('test.verify@selfheal.io', '123456', 'Nguyễn Văn Test');
    assert.ok(jobId, 'Job ID trả về phải tồn tại');
    assert.match(jobId, /^[0-9a-f-]{36}$/i, 'Job ID phải có định dạng UUID');

    if (isRedisReady()) {
      const len = await redisClient.llen(REDIS_KEYS.JOBS);
      assert.ok(len > 0, 'Hàng đợi Redis phải chứa ít nhất 1 job');
    }
  });

  test('7. Enqueue Invitation Email vào Redis với Job ID hợp lệ', async () => {
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

  test('8. Lấy thống kê hàng đợi EmailQueue.getQueueStats()', async () => {
    const stats = await EmailQueue.getQueueStats();
    assert.strictEqual(typeof stats.pendingJobs, 'number');
    assert.strictEqual(typeof stats.processingJobs, 'number');
    assert.strictEqual(typeof stats.deadLetterJobs, 'number');
    assert.strictEqual(typeof stats.enqueued, 'number');
    assert.strictEqual(typeof stats.sent, 'number');
    assert.strictEqual(typeof stats.failed, 'number');
    assert.strictEqual(typeof stats.retried, 'number');
  });

  test('9. Worker xử lý job thành công và xác nhận (ACK) xóa khỏi PROCESSING list', async () => {
    // Giả lập mock transporter thành công
    const mockTransporter: any = {
      sendMail: async () => ({ messageId: 'mock-msg-123' }),
    };
    EmailService.setTransporterForTesting(mockTransporter);

    const testJob: EmailJob = {
      id: 'test-job-ack-1',
      type: 'VERIFICATION_EMAIL',
      toEmail: 'worker.ack@selfheal.io',
      token: '654321',
      fullName: 'Worker Ack Tester',
      createdAt: Date.now(),
      attempts: 0,
      maxAttempts: 3,
    };

    const rawJob = JSON.stringify(testJob);
    if (isRedisReady()) {
      // Đẩy vào PROCESSING list giả lập worker đã nhận job
      await redisClient.lpush(REDIS_KEYS.PROCESSING, rawJob);
    }

    const success = await EmailWorker.processJob(testJob, rawJob);
    assert.strictEqual(success, true, 'Worker phải xử lý job thành công');
    assert.strictEqual(testJob.attempts, 1, 'Số lần attempts phải tăng lên 1');

    if (isRedisReady()) {
      // Kiểm tra job đã được xóa khỏi PROCESSING list
      const processingList = await redisClient.lrange(REDIS_KEYS.PROCESSING, 0, -1);
      assert.strictEqual(
        processingList.includes(rawJob),
        false,
        'Job đã hoàn tất phải bị xóa khỏi PROCESSING list'
      );
    }

    // Reset transporter về null
    EmailService.setTransporterForTesting(null);
  });

  test('10. Worker xử lý lỗi vĩnh viễn (535 Auth error) đưa ngay vào Dead Letter Queue (DLQ)', async () => {
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
      id: 'test-job-dlq-verify',
      type: 'VERIFICATION_EMAIL',
      toEmail: 'fail.dlq@selfheal.io',
      token: '999888',
      fullName: 'Fail DLQ Tester',
      createdAt: Date.now(),
      attempts: 0,
      maxAttempts: 3,
    };

    const rawJob = JSON.stringify(testJob);
    if (isRedisReady()) {
      await redisClient.lpush(REDIS_KEYS.PROCESSING, rawJob);
    }

    const success = await EmailWorker.processJob(testJob, rawJob);
    assert.strictEqual(success, false, 'Worker phải đánh dấu job thất bại');
    assert.ok(testJob.lastError, 'lastError phải được ghi nhận');

    if (isRedisReady()) {
      // Job phải bị gỡ khỏi PROCESSING
      const processingList = await redisClient.lrange(REDIS_KEYS.PROCESSING, 0, -1);
      assert.strictEqual(processingList.includes(rawJob), false);

      // Job phải xuất hiện trong DLQ
      const dlqList = await redisClient.lrange(REDIS_KEYS.DEAD_LETTER, 0, -1);
      assert.ok(
        dlqList.some((item) => item.includes('test-job-dlq-verify')),
        'Job thất bại vĩnh viễn phải được lưu trong DLQ'
      );
    }

    // Reset transporter về null
    EmailService.setTransporterForTesting(null);
  });

  test('11. Cơ chế phục hồi tự động (Crash Recovery): Quét và hoàn trả các job mồ côi từ PROCESSING về JOBS', async () => {
    if (!isRedisReady()) {
      console.log('⚠️ Bỏ qua test Redis crash recovery do Redis không khả dụng');
      return;
    }

    // Giả lập worker bị kill đột ngột: job còn nằm trong PROCESSING
    const orphanedJob: EmailJob = {
      id: 'test-orphaned-job-1',
      type: 'INVITATION_EMAIL',
      toEmail: 'orphan@selfheal.io',
      recipientName: 'Orphan User',
      inviterName: 'Admin',
      orgName: 'Crash Recovery Org',
      roleName: 'DEV',
      createdAt: Date.now(),
      attempts: 1,
      maxAttempts: 3,
    };

    const rawOrphan = JSON.stringify(orphanedJob);
    await redisClient.lpush(REDIS_KEYS.PROCESSING, rawOrphan);

    // Kích hoạt phục hồi
    const recoveredCount = await EmailWorker.recoverOrphanedJobs();
    assert.ok(recoveredCount >= 1, 'Worker phải phục hồi ít nhất 1 job mồ côi');

    // Job phải được hoàn trả về danh sách JOBS để xử lý lại
    const jobsList = await redisClient.lrange(REDIS_KEYS.JOBS, 0, -1);
    assert.ok(
      jobsList.some((item) => item.includes('test-orphaned-job-1')),
      'Job mồ côi phải xuất hiện trở lại trong danh sách JOBS'
    );
  });

  test('12. Khi Redis không sẵn sàng, EmailQueue từ chối và ném lỗi EmailQueueUnavailable rõ ràng', async () => {
    const originalStatus = redisClient.status;
    try {
      (redisClient as any).status = 'disconnected';
      await assert.rejects(
        async () => {
          await EmailQueue.enqueueVerification('test.disconnected@selfheal.io', '000111', 'Disconnected Test');
        },
        /EmailQueueUnavailable/
      );
    } finally {
      (redisClient as any).status = originalStatus;
    }
  });

  // =========================================================================
  // PHẦN D: KIỂM TRA KẾT NỐI SMTP THỰC TẾ (STARTTLS Port 587)
  // =========================================================================

  test('13. Kiểm tra kết nối SMTP thực tế (STARTTLS qua port 587)', async () => {
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
