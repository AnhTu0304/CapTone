import { pool } from '../config/database';
import { recordBackgroundJob } from '../telemetry/metrics';

export interface IQueryRunner {
  query(sql: string, params?: any[]): Promise<any>;
}

export interface ILogsRetentionStats {
  totalLogs: number;
  oldestOccurredAt: Date | null;
  newestOccurredAt: Date | null;
  infoRetentionHours: number;
  errorRetentionDays: number;
  infoCutoffDate: Date;
  errorCutoffDate: Date;
  expiredInfoCount: number;
  expiredWarnErrorCount: number;
}

export interface ILogsPurgeResult {
  purgedInfoCount: number;
  purgedWarnErrorCount: number;
  totalPurged: number;
  infoRetentionHours: number;
  errorRetentionDays: number;
  batchesExecuted: number;
  executionTimeMs: number;
}

export interface IPurgeLogsOptions {
  infoRetentionHours?: number;
  errorRetentionDays?: number;
  batchSize?: number;
  maxBatches?: number;
  dryRun?: boolean;
  queryPool?: IQueryRunner;
}

const HIGH_SEVERITY_LEVELS_SQL = `UPPER(level) IN ('WARN', 'WARNING', 'ERROR', 'FATAL', 'CRITICAL')`;
const LOW_SEVERITY_LEVELS_SQL = `UPPER(level) NOT IN ('WARN', 'WARNING', 'ERROR', 'FATAL', 'CRITICAL')`;

const LOGS_PERFORMANCE_INDEX_SQL: string[] = [
  `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_logs_meta_service_occurred ON public.logs USING btree ((metadata->>'service_id'), occurred_at DESC)`,
  `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_logs_cluster_occurred ON public.logs USING btree (cluster_id, occurred_at DESC)`,
  `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_logs_pod_occurred ON public.logs USING btree (pod_id, occurred_at DESC)`,
  `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_logs_meta_pod_occurred ON public.logs USING btree ((metadata->>'pod_name'), occurred_at DESC)`,
  `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_logs_level_occurred ON public.logs USING btree (level, occurred_at DESC)`,
];

/**
 * Manages batched TTL cleanup and performance indexes for the `logs` table
 * so routine telemetry logs never trigger multi-gigabyte bloat or CPU spikes.
 */
export class LogsRetentionService {
  private static initialTimer: NodeJS.Timeout | null = null;
  private static intervalTimer: NodeJS.Timeout | null = null;
  private static isRunning = false;

  public static getInfoRetentionHours(): number {
    const raw = parseInt(process.env.LOG_INFO_RETENTION_HOURS || '24', 10);
    return Number.isFinite(raw) ? Math.min(720, Math.max(1, raw)) : 24;
  }

  public static getErrorRetentionDays(): number {
    const raw = parseInt(process.env.LOG_ERROR_RETENTION_DAYS || '7', 10);
    return Number.isFinite(raw) ? Math.min(365, Math.max(1, raw)) : 7;
  }

  public static getRetentionIntervalMinutes(): number {
    const raw = parseInt(process.env.LOG_RETENTION_INTERVAL_MINUTES || '60', 10);
    return Number.isFinite(raw) ? Math.min(1440, Math.max(5, raw)) : 60;
  }

  public static computeCutoffs(
    infoRetentionHours = this.getInfoRetentionHours(),
    errorRetentionDays = this.getErrorRetentionDays(),
    nowMs = Date.now()
  ): { infoCutoffDate: Date; errorCutoffDate: Date } {
    return {
      infoCutoffDate: new Date(nowMs - infoRetentionHours * 60 * 60 * 1000),
      errorCutoffDate: new Date(nowMs - errorRetentionDays * 24 * 60 * 60 * 1000),
    };
  }

  /**
   * Idempotently creates expression & composite indexes outside transactions.
   */
  public static async ensureLogsIndexes(
    queryPool: IQueryRunner = pool
  ): Promise<{ ensured: number; errors: string[] }> {
    let ensured = 0;
    const errors: string[] = [];

    for (const ddl of LOGS_PERFORMANCE_INDEX_SQL) {
      try {
        await queryPool.query(ddl);
        ensured++;
      } catch (err: any) {
        const msg = err?.message || String(err);
        errors.push(msg);
        console.warn(`⚠️ [LogsRetentionService] Failed ensuring index (${msg})`);
      }
    }

    return { ensured, errors };
  }

  public static async getRetentionStats(options?: {
    infoRetentionHours?: number;
    errorRetentionDays?: number;
    queryPool?: IQueryRunner;
  }): Promise<ILogsRetentionStats> {
    const infoRetentionHours = options?.infoRetentionHours ?? this.getInfoRetentionHours();
    const errorRetentionDays = options?.errorRetentionDays ?? this.getErrorRetentionDays();
    const queryPool = options?.queryPool || pool;
    const { infoCutoffDate, errorCutoffDate } = this.computeCutoffs(infoRetentionHours, errorRetentionDays);

    const res = await queryPool.query(
      `SELECT
         COUNT(*)::int AS total_logs,
         MIN(occurred_at) AS oldest_occurred_at,
         MAX(occurred_at) AS newest_occurred_at,
         COUNT(*) FILTER (WHERE occurred_at < $1 AND ${LOW_SEVERITY_LEVELS_SQL})::int AS expired_info_count,
         COUNT(*) FILTER (WHERE occurred_at < $2 AND ${HIGH_SEVERITY_LEVELS_SQL})::int AS expired_warn_error_count
       FROM public.logs;`,
      [infoCutoffDate, errorCutoffDate]
    );

    const row = res.rows[0] || {};
    return {
      totalLogs: Number(row.total_logs) || 0,
      oldestOccurredAt: row.oldest_occurred_at ? new Date(row.oldest_occurred_at) : null,
      newestOccurredAt: row.newest_occurred_at ? new Date(row.newest_occurred_at) : null,
      infoRetentionHours,
      errorRetentionDays,
      infoCutoffDate,
      errorCutoffDate,
      expiredInfoCount: Number(row.expired_info_count) || 0,
      expiredWarnErrorCount: Number(row.expired_warn_error_count) || 0,
    };
  }

  private static async purgeSliceInBatches(
    queryPool: IQueryRunner,
    levelConditionSql: string,
    cutoffDate: Date,
    batchSize: number,
    maxBatches: number
  ): Promise<{ purgedCount: number; batchesExecuted: number }> {
    let purgedCount = 0;
    let batchesExecuted = 0;
    let hasMore = true;

    while (hasMore && (maxBatches <= 0 || batchesExecuted < maxBatches)) {
      batchesExecuted++;
      const deleteSql = `
        DELETE FROM public.logs
        WHERE id IN (
          SELECT id
          FROM public.logs
          WHERE occurred_at < $1
            AND ${levelConditionSql}
          ORDER BY occurred_at ASC
          LIMIT $2
        );
      `;

      const res = await queryPool.query(deleteSql, [cutoffDate, batchSize]);
      const deleted = res.rowCount || 0;
      purgedCount += deleted;

      if (deleted < batchSize) {
        hasMore = false;
      } else if (maxBatches <= 0 || batchesExecuted < maxBatches) {
        await new Promise((resolve) => setTimeout(resolve, 40));
      }
    }

    return { purgedCount, batchesExecuted };
  }

  /**
   * Purges expired INFO (short TTL) and WARN/ERROR/FATAL (longer TTL) logs in bounded batches.
   */
  public static async purgeOldLogs(options?: IPurgeLogsOptions): Promise<ILogsPurgeResult> {
    const startTime = Date.now();
    const infoRetentionHours = options?.infoRetentionHours ?? this.getInfoRetentionHours();
    const errorRetentionDays = options?.errorRetentionDays ?? this.getErrorRetentionDays();
    const batchSize = Math.min(20000, Math.max(100, options?.batchSize ?? 5000));
    const maxBatches = options?.maxBatches ?? 40;
    const dryRun = Boolean(options?.dryRun);
    const queryPool = options?.queryPool || pool;

    if (dryRun) {
      const stats = await this.getRetentionStats({ infoRetentionHours, errorRetentionDays, queryPool });
      return {
        purgedInfoCount: stats.expiredInfoCount,
        purgedWarnErrorCount: stats.expiredWarnErrorCount,
        totalPurged: stats.expiredInfoCount + stats.expiredWarnErrorCount,
        infoRetentionHours,
        errorRetentionDays,
        batchesExecuted: 0,
        executionTimeMs: Date.now() - startTime,
      };
    }

    const { infoCutoffDate, errorCutoffDate } = this.computeCutoffs(infoRetentionHours, errorRetentionDays);

    const infoRes = await this.purgeSliceInBatches(
      queryPool,
      LOW_SEVERITY_LEVELS_SQL,
      infoCutoffDate,
      batchSize,
      maxBatches
    );

    const remainingBatches = maxBatches <= 0 ? 0 : Math.max(1, maxBatches - infoRes.batchesExecuted);
    const warnErrRes = await this.purgeSliceInBatches(
      queryPool,
      HIGH_SEVERITY_LEVELS_SQL,
      errorCutoffDate,
      batchSize,
      remainingBatches
    );

    const totalPurged = infoRes.purgedCount + warnErrRes.purgedCount;
    if (totalPurged >= 5000) {
      await queryPool.query('ANALYZE public.logs;').catch(() => {});
    }

    return {
      purgedInfoCount: infoRes.purgedCount,
      purgedWarnErrorCount: warnErrRes.purgedCount,
      totalPurged,
      infoRetentionHours,
      errorRetentionDays,
      batchesExecuted: infoRes.batchesExecuted + warnErrRes.batchesExecuted,
      executionTimeMs: Date.now() - startTime,
    };
  }

  public static async runScheduledCycle(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    const startHr = process.hrtime.bigint();
    try {
      await this.ensureLogsIndexes();
      const result = await this.purgeOldLogs({ batchSize: 5000, maxBatches: 40 });
      if (result.totalPurged > 0) {
        console.log(
          `🧹 [LogsRetention] Purged ${result.totalPurged} expired logs (INFO: ${result.purgedInfoCount} >${result.infoRetentionHours}h, WARN/ERR: ${result.purgedWarnErrorCount} >${result.errorRetentionDays}d) in ${result.executionTimeMs}ms`
        );
      }
      recordBackgroundJob('logs_retention', 'success', Number(process.hrtime.bigint() - startHr) / 1e9);
    } catch (err: any) {
      recordBackgroundJob('logs_retention', 'error', Number(process.hrtime.bigint() - startHr) / 1e9);
      console.error('❌ [LogsRetention] Scheduled cleanup failed:', err?.message || err);
    } finally {
      this.isRunning = false;
    }
  }

  public static startScheduler(): void {
    this.stopScheduler();
    const intervalMinutes = this.getRetentionIntervalMinutes();
    const intervalMs = intervalMinutes * 60 * 1000;

    console.log(
      `🧹 [LogsRetention] Scheduler active (INFO TTL=${this.getInfoRetentionHours()}h, WARN/ERR TTL=${this.getErrorRetentionDays()}d, every ${intervalMinutes}m)`
    );

    this.initialTimer = setTimeout(() => {
      void this.runScheduledCycle();
    }, 15000);
    if (typeof this.initialTimer.unref === 'function') this.initialTimer.unref();

    this.intervalTimer = setInterval(() => {
      void this.runScheduledCycle();
    }, intervalMs);
    if (typeof this.intervalTimer.unref === 'function') this.intervalTimer.unref();
  }

  public static stopScheduler(): void {
    if (this.initialTimer) {
      clearTimeout(this.initialTimer);
      this.initialTimer = null;
    }
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }
  }
}
