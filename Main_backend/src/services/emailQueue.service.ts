import crypto from 'crypto';
import { redisClient, isRedisReady } from '../config/redis';
import { EmailService } from './email.service';

export type EmailJobType = 'VERIFICATION_EMAIL' | 'INVITATION_EMAIL';

export interface BaseEmailJob {
  id: string;
  type: EmailJobType;
  toEmail: string;
  createdAt: number;
  attempts: number;
  maxAttempts: number;
  lastError?: string;
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

export type EmailJob = VerificationEmailJob | InvitationEmailJob;

export interface EmailQueueStats {
  pendingJobs: number;
  deadLetterJobs: number;
  enqueued: number;
  sent: number;
  failed: number;
  retried: number;
}

const REDIS_KEYS = {
  JOBS: 'email_queue:jobs',
  DEAD_LETTER: 'email_queue:dead_letter',
  STATS: 'email_queue:stats',
};

/**
 * Helper che giấu giá trị nhạy cảm khi log
 */
function maskSecret(val: string): string {
  if (!val || val.length <= 6) return '***';
  return `${val.slice(0, 3)}***${val.slice(-3)}`;
}

/**
 * Service quản lý Hàng đợi Email (Email Queue Producer)
 */
export class EmailQueue {
  /**
   * Đẩy job gửi email vào hàng đợi Redis (hoặc fallback async nếu Redis không khả dụng)
   */
  public static async enqueue(
    jobData:
      | Omit<VerificationEmailJob, 'id' | 'createdAt' | 'attempts' | 'maxAttempts'>
      | Omit<InvitationEmailJob, 'id' | 'createdAt' | 'attempts' | 'maxAttempts'>
  ): Promise<string> {
    const jobId = crypto.randomUUID();
    const job: EmailJob = {
      ...jobData,
      id: jobId,
      createdAt: Date.now(),
      attempts: 0,
      maxAttempts: 3,
    } as EmailJob;

    // Nếu Redis khả dụng, lưu job vào hàng đợi Redis
    if (isRedisReady()) {
      try {
        await redisClient.lpush(REDIS_KEYS.JOBS, JSON.stringify(job));
        await redisClient.hincrby(REDIS_KEYS.STATS, 'enqueued', 1);

        const safeDetail =
          job.type === 'VERIFICATION_EMAIL'
            ? `(token: ${maskSecret((job as VerificationEmailJob).token)})`
            : `(org: ${(job as InvitationEmailJob).orgName})`;

        console.log(`📥 [EMAIL QUEUE] Enqueued job ${job.id} [${job.type}] to ${job.toEmail} ${safeDetail}`);
        return jobId;
      } catch (err: any) {
        console.warn(`⚠️ [EMAIL QUEUE] Không thể đẩy vào Redis (${err.message}). Fallback gửi async trực tiếp.`);
      }
    }

    // Fallback: Xử lý async trong background (non-blocking API response)
    setImmediate(async () => {
      try {
        await EmailWorker.processJob(job);
      } catch (err: any) {
        console.error(`❌ [EMAIL QUEUE FALLBACK] Lỗi xử lý email ${job.id}:`, err.message);
      }
    });

    return jobId;
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
   * Lấy thống kê hàng đợi
   */
  public static async getQueueStats(): Promise<EmailQueueStats> {
    if (!isRedisReady()) {
      return {
        pendingJobs: 0,
        deadLetterJobs: 0,
        enqueued: 0,
        sent: 0,
        failed: 0,
        retried: 0,
      };
    }

    try {
      const [pendingJobs, deadLetterJobs, stats] = await Promise.all([
        redisClient.llen(REDIS_KEYS.JOBS),
        redisClient.llen(REDIS_KEYS.DEAD_LETTER),
        redisClient.hgetall(REDIS_KEYS.STATS),
      ]);

      return {
        pendingJobs,
        deadLetterJobs,
        enqueued: parseInt(stats.enqueued || '0', 10),
        sent: parseInt(stats.sent || '0', 10),
        failed: parseInt(stats.failed || '0', 10),
        retried: parseInt(stats.retried || '0', 10),
      };
    } catch {
      return {
        pendingJobs: 0,
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
 */
export class EmailWorker {
  private static isRunning = false;
  private static activeTimer: NodeJS.Timeout | null = null;
  private static isProcessing = false;

  /**
   * Khởi động background worker
   */
  public static start(pollIntervalMs: number = 1000): void {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log(`👷 [EMAIL WORKER] Background Email Worker started (poll interval: ${pollIntervalMs}ms)`);
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

    // Chờ nếu đang xử lý dở job
    let waitCycles = 0;
    while (this.isProcessing && waitCycles < 20) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      waitCycles++;
    }

    console.log('🛑 [EMAIL WORKER] Background Email Worker stopped gracefully.');
  }

  /**
   * Lấy job tiếp theo từ Redis và xử lý
   */
  public static async processNextJob(): Promise<boolean> {
    if (!isRedisReady()) return false;

    try {
      // Lấy job từ đuôi hàng đợi (FIFO: LPUSH -> RPOP)
      const rawJob = await redisClient.rpop(REDIS_KEYS.JOBS);
      if (!rawJob) return false;

      const job: EmailJob = JSON.parse(rawJob);
      await this.processJob(job);
      return true;
    } catch (err: any) {
      console.error('❌ [EMAIL WORKER] Lỗi khi nhận job từ hàng đợi:', err.message);
      return false;
    }
  }

  /**
   * Xử lý một job cụ thể: gọi EmailService, phân loại lỗi và retry / DLQ
   */
  public static async processJob(job: EmailJob): Promise<boolean> {
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
      }

      if (success) {
        if (isRedisReady()) {
          await redisClient.hincrby(REDIS_KEYS.STATS, 'sent', 1);
        }
        return true;
      } else {
        throw new Error('EmailService returned false');
      }
    } catch (err: any) {
      job.lastError = err.message || 'Lỗi gửi email không xác định';
      const isTransient = EmailService.isTransientError(err);

      // Nếu là lỗi tạm thời và chưa vượt quá số lần thử lại tối đa -> Retry
      if (isTransient && job.attempts < job.maxAttempts) {
        console.warn(
          `⚠️ [EMAIL WORKER] Job ${job.id} gặp sự cố tạm thời (${job.lastError}), retry lần ${job.attempts}/${job.maxAttempts}...`
        );
        if (isRedisReady()) {
          await redisClient.hincrby(REDIS_KEYS.STATS, 'retried', 1);
          // Đẩy lại vào hàng đợi để thử lại sau
          await redisClient.lpush(REDIS_KEYS.JOBS, JSON.stringify(job));
        }
      } else {
        // Lỗi vĩnh viễn (5xx/Auth) hoặc đã hết số lượt retry -> Đưa vào Dead Letter Queue
        console.error(
          `❌ [EMAIL WORKER] Job ${job.id} thất bại vĩnh viễn (attempts: ${job.attempts}): ${job.lastError}. Đưa vào DLQ.`
        );
        if (isRedisReady()) {
          await redisClient.hincrby(REDIS_KEYS.STATS, 'failed', 1);
          await redisClient.lpush(REDIS_KEYS.DEAD_LETTER, JSON.stringify(job));
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
        // Nếu vừa xử lý được 1 job, poll tiếp ngay lập tức để giải phóng queue nhanh
        this.scheduleNext(hasProcessed ? 50 : pollIntervalMs);
      } catch {
        this.scheduleNext(pollIntervalMs);
      }
    }, pollIntervalMs);
  }
}
