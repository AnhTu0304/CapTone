import crypto from 'crypto';
import { redisClient, isRedisReady } from '../config/redis';
import { config } from '../config/env';
import { EmailService } from './email.service';

export type EmailJobType = 'VERIFICATION_EMAIL' | 'INVITATION_EMAIL' | 'WELCOME_GOOGLE_EMAIL';

export interface BaseEmailJob {
  id: string;
  type: EmailJobType;
  toEmail: string;
  createdAt: number;
  attempts: number;
  maxAttempts: number;
  lastError?: string;
  nextAttemptAt?: number;
}

export interface VerificationEmailJob extends BaseEmailJob {
  type: 'VERIFICATION_EMAIL';
  token: string;
  fullName: string;
}

export interface InvitationEmailJob extends BaseEmailJob {
  type: 'INVITATION_EMAIL';
  recipientName: string;
  inviterName: string;
  orgName: string;
  roleName: string;
}

export interface GoogleWelcomeEmailJob extends BaseEmailJob {
  type: 'WELCOME_GOOGLE_EMAIL';
  fullName: string;
}

export type EmailJob = VerificationEmailJob | InvitationEmailJob | GoogleWelcomeEmailJob;

export interface EmailQueueStats {
  pendingJobs: number;
  processingJobs: number;
  deadLetterJobs: number;
  enqueued: number;
  sent: number;
  failed: number;
  retried: number;
}

export const REDIS_KEYS = {
  JOBS: 'email_queue:jobs',
  PROCESSING: 'email_queue:processing',
  DEAD_LETTER: 'email_queue:dead_letter',
  STATS: 'email_queue:stats',
};

/**
 * Helper che giấu giá trị nhạy cảm khi log (bảo mật tuyệt đối thông tin xác thực)
 */
function maskSecret(val: string): string {
  if (!val || val.length <= 6) return '***';
  return `${val.slice(0, 3)}***${val.slice(-3)}`;
}

/**
 * Service quản lý Hàng đợi Email (Email Queue Producer)
 * Đảm bảo độ bền vững (Durable) với Redis Persistent Queue
 */
export class EmailQueue {
  /**
   * Đẩy job gửi email vào hàng đợi Redis bền vững
   * @throws Error nếu Redis cấu hình bật nhưng mất kết nối (không âm thầm fallback gây mất dữ liệu)
   */
  public static async enqueue(
    jobData:
      | Omit<VerificationEmailJob, 'id' | 'createdAt' | 'attempts' | 'maxAttempts'>
      | Omit<InvitationEmailJob, 'id' | 'createdAt' | 'attempts' | 'maxAttempts'>
      | Omit<GoogleWelcomeEmailJob, 'id' | 'createdAt' | 'attempts' | 'maxAttempts'>
  ): Promise<string> {
    const jobId = crypto.randomUUID();
    const job: EmailJob = {
      ...jobData,
      id: jobId,
      createdAt: Date.now(),
      attempts: 0,
      maxAttempts: 3,
    } as EmailJob;

    // Nếu Redis đang ở chế độ lazyConnect ('wait'), kích hoạt kết nối
    if (config.redis.enabled && redisClient.status === 'wait') {
      await redisClient.connect().catch(() => {});
    }

    // Trường hợp 1: Redis đang hoạt động bình thường -> Lưu bền vững vào hàng đợi Redis
    if (isRedisReady()) {
      try {
        await redisClient.lpush(REDIS_KEYS.JOBS, JSON.stringify(job));
        await redisClient.hincrby(REDIS_KEYS.STATS, 'enqueued', 1);

        const safeDetail =
          job.type === 'VERIFICATION_EMAIL'
            ? `(token: ${maskSecret((job as VerificationEmailJob).token)})`
            : job.type === 'INVITATION_EMAIL'
            ? `(org: ${(job as InvitationEmailJob).orgName})`
            : `(name: ${(job as GoogleWelcomeEmailJob).fullName})`;

        console.log(`📥 [EMAIL QUEUE] Enqueued job ${job.id} [${job.type}] to ${job.toEmail} ${safeDetail}`);
        return jobId;
      } catch (err: any) {
        throw new Error(`EmailQueueError: Không thể ghi job vào Redis: ${err.message}`);
      }
    }

    // Trường hợp 2: Redis được cấu hình tắt chủ động (REDIS_ENABLED=false) phục vụ dev/test tối giản
    if (!config.redis.enabled) {
      console.warn(
        `⚠️ [EMAIL QUEUE DEV] Redis bị tắt theo cấu hình (REDIS_ENABLED=false). Xử lý trực tiếp (không cam kết độ bền vững).`
      );
      setImmediate(async () => {
        try {
          await EmailWorker.processJob(job);
        } catch (err: any) {
          console.error(`❌ [EMAIL QUEUE DEV] Lỗi gửi email dev ${job.id}:`, err.message);
        }
      });
      return jobId;
    }

    // Trường hợp 3: Redis được bật nhưng hiện tại mất kết nối -> Trả lỗi rõ ràng để phía gọi biết, KHÔNG nói dối là đã enqueue thành công
    throw new Error(
      'EmailQueueUnavailable: Kết nối Redis hiện không khả dụng. Không thể đảm bảo lưu trữ email bền vững.'
    );
  }

  /**
   * Enqueue email xác thực tài khoản
   */
  public static async enqueueVerification(toEmail: string, token: string, fullName: string): Promise<string> {
    return this.enqueue({
      type: 'VERIFICATION_EMAIL',
      toEmail,
      token,
      fullName,
    });
  }

  /**
   * Enqueue email mời tham gia tổ chức
   */
  public static async enqueueInvitation(
    toEmail: string,
    recipientName: string,
    inviterName: string,
    orgName: string,
    roleName: string
  ): Promise<string> {
    return this.enqueue({
      type: 'INVITATION_EMAIL',
      toEmail,
      recipientName,
      inviterName,
      orgName,
      roleName,
    });
  }

  /**
   * Enqueue email chào mừng và bảo mật cho tài khoản liên kết Google
   */
  public static async enqueueGoogleWelcome(toEmail: string, fullName: string): Promise<string> {
    return this.enqueue({
      type: 'WELCOME_GOOGLE_EMAIL',
      toEmail,
      fullName,
    });
  }

  /**
   * Lấy thống kê chi tiết trạng thái hàng đợi
   */
  public static async getQueueStats(): Promise<EmailQueueStats> {
    if (!isRedisReady()) {
      return {
        pendingJobs: 0,
        processingJobs: 0,
        deadLetterJobs: 0,
        enqueued: 0,
        sent: 0,
        failed: 0,
        retried: 0,
      };
    }

    try {
      const [pendingJobs, processingJobs, deadLetterJobs, stats] = await Promise.all([
        redisClient.llen(REDIS_KEYS.JOBS),
        redisClient.llen(REDIS_KEYS.PROCESSING),
        redisClient.llen(REDIS_KEYS.DEAD_LETTER),
        redisClient.hgetall(REDIS_KEYS.STATS),
      ]);

      return {
        pendingJobs,
        processingJobs,
        deadLetterJobs,
        enqueued: parseInt(stats.enqueued || '0', 10),
        sent: parseInt(stats.sent || '0', 10),
        failed: parseInt(stats.failed || '0', 10),
        retried: parseInt(stats.retried || '0', 10),
      };
    } catch {
      return {
        pendingJobs: 0,
        processingJobs: 0,
        deadLetterJobs: 0,
        enqueued: 0,
        sent: 0,
        failed: 0,
        retried: 0,
      };
    }
  }
}

/**
 * Worker xử lý các job gửi email trong background (Email Queue Consumer)
 * Áp dụng Reliable Queue Pattern (RPOPLPUSH) chống mất dữ liệu khi worker gặp sự cố
 */
export class EmailWorker {
  private static isRunning = false;
  private static activeTimer: NodeJS.Timeout | null = null;
  private static isProcessing = false;

  /**
   * Khởi động background worker và tự động phục hồi các job đang dở dang
   */
  public static async start(pollIntervalMs: number = 1000): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log(`👷 [EMAIL WORKER] Background Email Worker started (poll interval: ${pollIntervalMs}ms)`);

    // Tự động phục hồi các job còn tồn đọng trong danh sách PROCESSING khi khởi động
    await this.recoverOrphanedJobs();

    this.scheduleNext(pollIntervalMs);
  }

  /**
   * Dừng worker một cách an toàn (Graceful Shutdown)
   */
  public static async stop(): Promise<void> {
    if (!this.isRunning) return;
    this.isRunning = false;

    if (this.activeTimer) {
      clearTimeout(this.activeTimer);
      this.activeTimer = null;
    }

    // Chờ nếu worker đang xử lý dở 1 job (tối đa 2.5s)
    let waitCycles = 0;
    while (this.isProcessing && waitCycles < 25) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      waitCycles++;
    }

    console.log('🛑 [EMAIL WORKER] Background Email Worker stopped gracefully.');
  }

  /**
   * Phục hồi các job bị mồ côi (orphaned) khi worker trước đó bị crash/kill đột ngột giữa lúc xử lý
   */
  public static async recoverOrphanedJobs(): Promise<number> {
    if (!isRedisReady()) return 0;

    let recoveredCount = 0;
    try {
      const processingJobs = await redisClient.lrange(REDIS_KEYS.PROCESSING, 0, -1);
      for (const rawJob of processingJobs) {
        try {
          const job: EmailJob = JSON.parse(rawJob);
          // Nếu job đã vượt quá số lần thử tối đa -> Chuyển vào DLQ
          if (job.attempts >= job.maxAttempts) {
            await redisClient.lrem(REDIS_KEYS.PROCESSING, 1, rawJob);
            await redisClient.lpush(REDIS_KEYS.DEAD_LETTER, rawJob);
            await redisClient.hincrby(REDIS_KEYS.STATS, 'failed', 1);
          } else {
            // Đưa lại vào hàng đợi JOBS để xử lý lại
            await redisClient.lrem(REDIS_KEYS.PROCESSING, 1, rawJob);
            await redisClient.lpush(REDIS_KEYS.JOBS, rawJob);
            recoveredCount++;
          }
        } catch {
          // Payload lỗi cú pháp -> loại bỏ khỏi PROCESSING và lưu DLQ
          await redisClient.lrem(REDIS_KEYS.PROCESSING, 1, rawJob);
          await redisClient.lpush(REDIS_KEYS.DEAD_LETTER, rawJob);
        }
      }

      if (recoveredCount > 0) {
        console.log(`🔄 [EMAIL WORKER] Phục hồi thành công ${recoveredCount} job mồ côi từ đợt xử lý trước.`);
      }
    } catch (err: any) {
      console.warn('⚠️ [EMAIL WORKER] Không thể quét phục hồi job mồ côi:', err.message);
    }
    return recoveredCount;
  }

  /**
   * Lấy job tiếp theo từ Redis bằng cơ chế nguyên tử RPOPLPUSH (Atomic Handshake)
   */
  public static async processNextJob(): Promise<boolean> {
    if (!isRedisReady()) return false;

    try {
      // Chuyển nguyên tử job từ JOBS sang PROCESSING: Nếu worker chết ngay tại đây, job vẫn an toàn trong PROCESSING
      const rawJob = await redisClient.rpoplpush(REDIS_KEYS.JOBS, REDIS_KEYS.PROCESSING);
      if (!rawJob) return false;

      const job: EmailJob = JSON.parse(rawJob);
      await this.processJob(job, rawJob);
      return true;
    } catch (err: any) {
      console.error('❌ [EMAIL WORKER] Lỗi khi nhận job từ hàng đợi:', err.message);
      return false;
    }
  }

  /**
   * Xử lý một job cụ thể: phân biệt lỗi Transient (retry backoff) vs Permanent (chuyển ngay DLQ)
   */
  public static async processJob(job: EmailJob, rawJob?: string): Promise<boolean> {
    this.isProcessing = true;
    job.attempts++;

    try {
      let success = false;
      if (job.type === 'VERIFICATION_EMAIL') {
        const vJob = job as VerificationEmailJob;
        success = await EmailService.sendVerificationEmail(vJob.toEmail, vJob.token, vJob.fullName);
      } else if (job.type === 'INVITATION_EMAIL') {
        const iJob = job as InvitationEmailJob;
        success = await EmailService.sendInvitationEmail(
          iJob.toEmail,
          iJob.recipientName,
          iJob.inviterName,
          iJob.orgName,
          iJob.roleName
        );
      } else if (job.type === 'WELCOME_GOOGLE_EMAIL') {
        const gJob = job as GoogleWelcomeEmailJob;
        success = await EmailService.sendGoogleWelcomeEmail(gJob.toEmail, gJob.fullName);
      }

      if (success) {
        // Hoàn tất: Xóa job khỏi danh sách PROCESSING và tăng bộ đếm SENT
        if (rawJob && isRedisReady()) {
          await redisClient.lrem(REDIS_KEYS.PROCESSING, 1, rawJob);
          await redisClient.hincrby(REDIS_KEYS.STATS, 'sent', 1);
        }
        return true;
      } else {
        throw new Error('EmailService returned false');
      }
    } catch (err: any) {
      job.lastError = err.message || 'Lỗi gửi email không xác định';
      const isTransient = EmailService.isTransientError(err);

      // Nếu là lỗi tạm thời (Transient) và chưa vượt số lần thử -> Retry có backoff
      if (isTransient && job.attempts < job.maxAttempts) {
        const backoffMs = Math.min(1000 * Math.pow(2, job.attempts - 1), 10000);
        console.warn(
          `⚠️ [EMAIL WORKER] Job ${job.id} gặp sự cố tạm thời (${job.lastError}), retry lần ${job.attempts}/${job.maxAttempts} sau ${backoffMs}ms...`
        );

        if (rawJob && isRedisReady()) {
          // Xóa khỏi PROCESSING
          await redisClient.lrem(REDIS_KEYS.PROCESSING, 1, rawJob);
          await redisClient.hincrby(REDIS_KEYS.STATS, 'retried', 1);

          // Re-queue sau backoff
          setTimeout(async () => {
            try {
              if (isRedisReady()) {
                await redisClient.lpush(REDIS_KEYS.JOBS, JSON.stringify(job));
              }
            } catch (retryErr: any) {
              console.error('❌ [EMAIL WORKER] Lỗi re-queue job sau backoff:', retryErr.message);
            }
          }, backoffMs);
        }
      } else {
        // Lỗi vĩnh viễn (5xx/Auth) hoặc đã cạn lượt retry -> Chuyển vào Dead Letter Queue (DLQ)
        console.error(
          `❌ [EMAIL WORKER] Job ${job.id} thất bại vĩnh viễn (attempts: ${job.attempts}, transient: ${isTransient}): ${job.lastError}. Đưa vào DLQ.`
        );

        if (rawJob && isRedisReady()) {
          // Xóa khỏi PROCESSING
          await redisClient.lrem(REDIS_KEYS.PROCESSING, 1, rawJob);
          await redisClient.hincrby(REDIS_KEYS.STATS, 'failed', 1);
          // Đẩy vào DLQ và giới hạn tối đa 1000 bản ghi tránh phình bộ nhớ
          await redisClient.lpush(REDIS_KEYS.DEAD_LETTER, JSON.stringify(job));
          await redisClient.ltrim(REDIS_KEYS.DEAD_LETTER, 0, 999);
        }
      }
      return false;
    } finally {
      this.isProcessing = false;
    }
  }

  private static scheduleNext(pollIntervalMs: number): void {
    if (!this.isRunning) return;

    this.activeTimer = setTimeout(async () => {
      try {
        const hasProcessed = await this.processNextJob();
        this.scheduleNext(hasProcessed ? 50 : pollIntervalMs);
      } catch {
        this.scheduleNext(pollIntervalMs);
      }
    }, pollIntervalMs);
  }
}
