import { pool } from '../config/database';
import { AuditRetentionService } from '../services/auditRetention.service';

/**
 * Standalone Background Worker Process for Audit Log Data Retention
 * Chạy độc lập qua: npm run worker:audit-retention
 * Hỗ trợ cờ: --once (chạy một lần rồi thoát) hoặc chế độ định kỳ (daemon)
 */
async function startWorker() {
  const isOnce = process.argv.includes('--once');
  const retentionDays = AuditRetentionService.getRetentionDays();
  const intervalHours = parseInt(process.env.AUDIT_RETENTION_INTERVAL_HOURS || '24', 10);
  const intervalMs = Math.max(1, intervalHours) * 60 * 60 * 1000;

  console.log('🛡️ [AUDIT RETENTION WORKER] Starting Audit Log Retention Worker...');
  console.log(`📋 [AUDIT RETENTION WORKER] Configured Retention Policy: ${retentionDays} days`);
  console.log(`⏱️ [AUDIT RETENTION WORKER] Mode: ${isOnce ? 'ONE-SHOT (Immediate exit)' : `PERIODIC (Every ${intervalHours}h)`}`);

  let timer: NodeJS.Timeout | null = null;
  let isRunning = false;

  const runRetentionTask = async () => {
    if (isRunning) {
      console.warn('⚠️ [AUDIT RETENTION WORKER] Previous retention task still in progress. Skipping cycle.');
      return;
    }

    isRunning = true;
    try {
      console.log(`\n⏳ [AUDIT RETENTION WORKER] Checking retention status at ${new Date().toISOString()}...`);
      const stats = await AuditRetentionService.getRetentionStats(retentionDays);
      console.log(`📊 [AUDIT RETENTION WORKER] Current Stats:`, {
        totalLogs: stats.totalLogs,
        logsOlderThanRetention: stats.logsOlderThanRetention,
        cutoffDate: stats.cutoffDate.toISOString(),
        oldestLogDate: stats.oldestLogDate ? stats.oldestLogDate.toISOString() : 'None',
      });

      if (stats.logsOlderThanRetention > 0) {
        console.log(`🧹 [AUDIT RETENTION WORKER] Starting purge of ${stats.logsOlderThanRetention} outdated logs...`);
        const result = await AuditRetentionService.purgeOldLogs({
          retentionDays,
          batchSize: 1000,
        });
        console.log(`✅ [AUDIT RETENTION WORKER] Purge completed successfully:`, {
          purgedCount: result.purgedCount,
          executionTimeMs: `${result.executionTimeMs}ms`,
          batchesExecuted: result.batchesExecuted,
        });
      } else {
        console.log('✨ [AUDIT RETENTION WORKER] No logs exceed retention cutoff. Everything clean.');
      }
    } catch (err: any) {
      console.error('❌ [AUDIT RETENTION WORKER] Error executing retention purge:', err.message);
    } finally {
      isRunning = false;
    }
  };

  // Chạy ngay chu kỳ đầu tiên
  await runRetentionTask();

  if (isOnce) {
    console.log('👋 [AUDIT RETENTION WORKER] One-shot execution complete. Terminating worker.');
    await pool.end();
    process.exit(0);
  }

  // Lập lịch định kỳ
  timer = setInterval(runRetentionTask, intervalMs);

  const shutdown = async (signal: string) => {
    console.log(`\n🛑 [AUDIT RETENTION WORKER] Received ${signal}. Shutting down gracefully...`);
    if (timer) clearInterval(timer);
    await pool.end();
    console.log('👋 [AUDIT RETENTION WORKER] Worker terminated cleanly.');
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

startWorker().catch(async (err) => {
  console.error('💥 [AUDIT RETENTION WORKER] Fatal initialization error:', err);
  await pool.end();
  process.exit(1);
});
