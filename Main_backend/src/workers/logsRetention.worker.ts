import { pool } from '../config/database';
import { LogsRetentionService } from '../services/logsRetention.service';
import { recordBackgroundJob } from '../telemetry/metrics';

/**
 * Standalone Background Worker for `logs` table TTL cleanup & index maintenance.
 * Run via: npm run worker:logs-retention [--once]
 */
async function startWorker() {
  const isOnce = process.argv.includes('--once');
  const intervalMinutes = LogsRetentionService.getRetentionIntervalMinutes();
  const intervalMs = intervalMinutes * 60 * 1000;

  console.log('🧹 [LOGS RETENTION WORKER] Starting Logs Data Retention Worker...');
  console.log(
    `📋 [LOGS RETENTION WORKER] Policy: INFO=${LogsRetentionService.getInfoRetentionHours()}h | WARN/ERROR/FATAL=${LogsRetentionService.getErrorRetentionDays()}d`
  );

  let timer: NodeJS.Timeout | null = null;
  let isRunning = false;

  const runTask = async () => {
    if (isRunning) return;
    isRunning = true;
    const startHr = process.hrtime.bigint();
    try {
      await LogsRetentionService.ensureLogsIndexes();
      const stats = await LogsRetentionService.getRetentionStats();
      console.log('📊 [LOGS RETENTION WORKER] Stats:', {
        totalLogs: stats.totalLogs,
        expiredInfoCount: stats.expiredInfoCount,
        expiredWarnErrorCount: stats.expiredWarnErrorCount,
      });

      if (stats.expiredInfoCount + stats.expiredWarnErrorCount > 0) {
        const res = await LogsRetentionService.purgeOldLogs({ batchSize: 5000, maxBatches: 0 });
        console.log('✅ [LOGS RETENTION WORKER] Purge completed:', res);
      } else {
        console.log('✨ [LOGS RETENTION WORKER] No expired logs to purge.');
      }
      recordBackgroundJob('logs_retention', 'success', Number(process.hrtime.bigint() - startHr) / 1e9);
    } catch (err: any) {
      recordBackgroundJob('logs_retention', 'error', Number(process.hrtime.bigint() - startHr) / 1e9);
      console.error('❌ [LOGS RETENTION WORKER] Error:', err?.message || err);
    } finally {
      isRunning = false;
    }
  };

  await runTask();

  if (isOnce) {
    await pool.end();
    process.exit(0);
  }

  timer = setInterval(runTask, intervalMs);
  const shutdown = async () => {
    if (timer) clearInterval(timer);
    await pool.end();
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

startWorker().catch(async (err) => {
  console.error('💥 [LOGS RETENTION WORKER] Fatal initialization error:', err);
  await pool.end();
  process.exit(1);
});
