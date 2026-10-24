import { pool } from '../config/database';
import { AuditService } from './audit.service';

export interface IRetentionStats {
  totalLogs: number;
  oldestLogDate: Date | null;
  newestLogDate: Date | null;
  logsOlderThanRetention: number;
  retentionDays: number;
  cutoffDate: Date;
}

export interface IPurgeResult {
  purgedCount: number;
  retentionDays: number;
  cutoffDate: Date;
  executionTimeMs: number;
  batchesExecuted: number;
}

export class AuditRetentionService {
  /**
   * Lấy số ngày lưu trữ cấu hình từ biến môi trường (mặc định 90 ngày)
   */
  public static getRetentionDays(): number {
    const envDays = parseInt(process.env.AUDIT_RETENTION_DAYS || '90', 10);
    return isNaN(envDays) || envDays < 1 ? 90 : envDays;
  }

  /**
   * Tính ngày cắt (Cutoff Date) dựa trên số ngày lưu trữ
   */
  public static getCutoffDate(retentionDays?: number): Date {
    const days = retentionDays || this.getRetentionDays();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return cutoff;
  }

  /**
   * Thống kê tình trạng lưu trữ audit logs
   */
  public static async getRetentionStats(retentionDays?: number): Promise<IRetentionStats> {
    const days = retentionDays || this.getRetentionDays();
    const cutoffDate = this.getCutoffDate(days);

    const query = `
      SELECT 
        COUNT(*)::int AS total_logs,
        MIN(created_at) AS oldest_log,
        MAX(created_at) AS newest_log,
        COUNT(CASE WHEN created_at < $1 THEN 1 END)::int AS older_than_cutoff
      FROM audit_logs;
    `;

    const res = await pool.query(query, [cutoffDate]);
    const row = res.rows[0] || {};

    return {
      totalLogs: Number(row.total_logs) || 0,
      oldestLogDate: row.oldest_log ? new Date(row.oldest_log) : null,
      newestLogDate: row.newest_log ? new Date(row.newest_log) : null,
      logsOlderThanRetention: Number(row.older_than_cutoff) || 0,
      retentionDays: days,
      cutoffDate,
    };
  }

  /**
   * Xóa các bản ghi audit log cũ hơn thời hạn lưu trữ.
   * Sử dụng cơ chế xóa theo lô (Batch Deletion) để tránh khóa bảng (Table Locking)
   * và giảm áp lực lên I/O của PostgreSQL.
   */
  public static async purgeOldLogs(options?: {
    retentionDays?: number;
    batchSize?: number;
    dryRun?: boolean;
    executedByUserId?: string;
  }): Promise<IPurgeResult> {
    const startTime = Date.now();
    const days = options?.retentionDays || this.getRetentionDays();
    const batchSize = Math.max(1, Math.min(10000, options?.batchSize || 1000));
    const dryRun = options?.dryRun || false;
    const cutoffDate = this.getCutoffDate(days);

    if (dryRun) {
      const stats = await this.getRetentionStats(days);
      return {
        purgedCount: stats.logsOlderThanRetention,
        retentionDays: days,
        cutoffDate,
        executionTimeMs: Date.now() - startTime,
        batchesExecuted: 0,
      };
    }

    let totalPurged = 0;
    let batches = 0;
    let hasMore = true;

    while (hasMore) {
      batches++;
      // Sử dụng ctid hoặc subquery có LIMIT để xóa từng lô an toàn
      const deleteSql = `
        DELETE FROM audit_logs
        WHERE id IN (
          SELECT id FROM audit_logs
          WHERE created_at < $1
          ORDER BY created_at ASC
          LIMIT $2
        );
      `;

      const res = await pool.query(deleteSql, [cutoffDate, batchSize]);
      const deletedInBatch = res.rowCount || 0;
      totalPurged += deletedInBatch;

      if (deletedInBatch < batchSize) {
        hasMore = false;
      }

      // Giãn cách ngắn giữa các batch để DB xử lý các transaction khác
      if (hasMore) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    }

    const executionTimeMs = Date.now() - startTime;

    // Ghi nhận sự kiện audit log cho việc thực thi Data Retention
    if (totalPurged > 0) {
      AuditService.record({
        user_id: options?.executedByUserId || null,
        actor_type: options?.executedByUserId ? 'USER' : 'SYSTEM',
        action: 'SYSTEM_AUDIT_PURGED',
        resource_type: 'AUDIT_LOGS',
        resource_id: null,
        status: 'SUCCESS',
        description: `Đã dọn dẹp ${totalPurged} bản ghi audit logs cũ hơn ${days} ngày (trước ${cutoffDate.toISOString()})`,
        metadata: {
          purged_count: totalPurged,
          retention_days: days,
          cutoff_date: cutoffDate.toISOString(),
          batches_executed: batches,
          execution_time_ms: executionTimeMs,
        },
      }).catch((err) => {
        console.error('[AuditRetentionService] Lỗi khi ghi nhận audit event cho purge:', err.message);
      });
    }

    return {
      purgedCount: totalPurged,
      retentionDays: days,
      cutoffDate,
      executionTimeMs,
      batchesExecuted: batches,
    };
  }
}
