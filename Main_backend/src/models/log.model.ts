import { pool } from '../config/database';

export interface ILog {
  id?: string | number;
  cluster_id: string | null;
  namespace_id?: string | null;
  pod_id?: string | null;
  service_id?: string | null;
  level: string;
  message: string;
  source: string;
  trace_id?: string | null;
  occurred_at: Date;
  metadata?: Record<string, unknown>;
}

export class LogModel {
  /**
   * Insert raw log record
   */
  public static async create(log: ILog): Promise<{ id: string | number }> {
    const query = `
      INSERT INTO logs (
        cluster_id, service_id, level, message, source, occurred_at, metadata
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7
      ) RETURNING id;
    `;

    const res = await pool.query(query, [
      log.cluster_id,
      log.service_id,
      log.level.toUpperCase(),
      log.message,
      log.source || 'k8s-agent',
      log.occurred_at,
      log.metadata ? JSON.stringify(log.metadata) : null,
    ]);

    return { id: res.rows[0].id };
  }

  /**
   * Query prioritized logs for RCA context (FATAL > ERROR > WARN > keywords > INFO)
   */
  public static async findPrioritizedByService(
    serviceId: string,
    windowMinutes: number = 30,
    limit: number = 30
  ): Promise<Array<{ level: string; message: string; occurred_at: Date; pod_id?: string }>> {
    const query = `
      WITH prioritized_logs AS (
        SELECT 
          id,
          level,
          message,
          occurred_at,
          metadata->>'pod_id' as pod_id,
          CASE 
            WHEN UPPER(level) IN ('FATAL', 'CRITICAL') THEN 1
            WHEN UPPER(level) = 'ERROR' THEN 2
            WHEN UPPER(level) IN ('WARN', 'WARNING') THEN 3
            WHEN message ~* '(exception|timeout|oom|crash|connection error|killed|deadlock|fail)' THEN 4
            ELSE 5
          END AS priority_score
        FROM logs
        WHERE (
          metadata->>'service_id' = $1 
          OR service_id = $1 OR service_id IN (SELECT id::text FROM workloads WHERE name = $1)
        )
        AND occurred_at >= NOW() - ($2 || ' minutes')::interval
      )
      SELECT level, message, occurred_at, pod_id
      FROM (
        SELECT * FROM prioritized_logs
        ORDER BY priority_score ASC, occurred_at DESC
        LIMIT $3
      ) sub
      ORDER BY occurred_at ASC;
    `;

    let res = await pool.query(query, [serviceId, windowMinutes, limit]);

    // Fallback: fetch recent logs without time filter if empty
    if (res.rows.length === 0) {
      const fallbackQuery = `
        SELECT level, message, occurred_at, metadata->>'pod_id' as pod_id
        FROM logs
        WHERE (
          metadata->>'service_id' = $1 
          OR service_id = $1 OR service_id IN (SELECT id::text FROM workloads WHERE name = $1)
        )
        ORDER BY occurred_at DESC
        LIMIT $2;
      `;
      const fallbackRes = await pool.query(fallbackQuery, [serviceId, limit]);
      res = { ...fallbackRes, rows: fallbackRes.rows.reverse() };
    }

    return res.rows;
  }
}

