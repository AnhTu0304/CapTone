import { testRedisConnection, closeRedis } from '../config/redis';
import { EmailWorker, EmailQueue } from '../services/emailQueue.service';
import { EmailService } from '../services/email.service';

/**
 * Standalone Background Worker Process for Email Queue
 * Execute via: npm run worker:email
 */
async function startWorkerProcess() {
  console.log('🚀 [EMAIL WORKER PROCESS] Initializing standalone Email Background Worker...');

  const redisConnected = await testRedisConnection();
  if (!redisConnected) {
    console.error('❌ [EMAIL WORKER PROCESS] Cannot connect to Redis. Email Worker requires Redis. Exiting.');
    process.exit(1);
  }

  // Verify SMTP connection
  const smtpStatus = await EmailService.verifyConnection();
  if (smtpStatus.success) {
    console.log(`✅ [EMAIL WORKER PROCESS] SMTP Connection OK: ${smtpStatus.message}`);
  } else {
    console.warn(`⚠️ [EMAIL WORKER PROCESS] SMTP Warning: ${smtpStatus.message}`);
  }

  // Print current queue stats
  const stats = await EmailQueue.getQueueStats();
  console.log(`📊 [EMAIL WORKER PROCESS] Initial Queue Stats:`, {
    pending: stats.pendingJobs,
    processing: stats.processingJobs,
    deadLetter: stats.deadLetterJobs,
    totalEnqueued: stats.enqueued,
    totalSent: stats.sent,
    totalFailed: stats.failed,
  });

  // Start consumer loop with 1-second interval (with orphan recovery)
  await EmailWorker.start(1000);
  console.log('⚡ [EMAIL WORKER PROCESS] Email Worker is actively listening for jobs...');

  // Graceful shutdown handlers
  const shutdown = async (signal: string) => {
    console.log(`\n🛑 [EMAIL WORKER PROCESS] Received ${signal}. Shutting down worker gracefully...`);
    await EmailWorker.stop();
    await closeRedis();
    console.log('👋 [EMAIL WORKER PROCESS] Worker process terminated safely.');
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

startWorkerProcess().catch((err) => {
  console.error('💥 [EMAIL WORKER PROCESS] Fatal error starting worker:', err);
  process.exit(1);
});
