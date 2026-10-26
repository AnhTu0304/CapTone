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

export interface ILogQueryOptions {
  serviceId?: string | null;
  level?: string | null;
  search?: string | null;
  startTime?: Date | null;
  endTime?: Date | null;
  clusterId?: string | null;
  limit?: number;
  offset?: number;
}

export interface ILogItem {
  id: string | number;
  cluster_id: string | null;
  service_id: string | null;
  service_name: string | null;
  pod_id: string | null;
  trace_id: string | null;
  level: string;
  message: string;
  source: string;
  occurred_at: string;
  metadata: Record<string, unknown> | null;
}

export interface ILogQueryResult {
  logs: ILogItem[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
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

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    let validServiceUuid: string | null = null;
    let metadataObj = log.metadata || {};

    if (log.service_id) {
      if (uuidRegex.test(log.service_id)) {
        validServiceUuid = log.service_id;
      } else if (!metadataObj.service_id) {
        metadataObj = { ...metadataObj, service_id: log.service_id };
      }
    }

    const res = await pool.query(query, [
      log.cluster_id,
      validServiceUuid,
      log.level.toUpperCase(),
      log.message,
      log.source || 'k8s-agent',
      log.occurred_at,
      Object.keys(metadataObj).length > 0 ? JSON.stringify(metadataObj) : null,
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

    const res = await pool.query(query, [serviceId, windowMinutes, limit]);
    return res.rows;
  }

  /**
   * Centralized logs querying with filters, search, and pagination
   */
  public static async queryLogs(options: ILogQueryOptions = {}): Promise<ILogQueryResult> {
    const limit = Math.min(200, Math.max(1, Number(options.limit) || 50));
    const offset = Math.max(0, Number(options.offset) || 0);
    const page = Math.floor(offset / limit) + 1;

    const conditions: string[] = [];
    const params: any[] = [];
    let paramIdx = 1;

    if (options.level && options.level.toUpperCase() !== 'ALL') {
      conditions.push(`l.level = $${paramIdx++}`);
      params.push(options.level.toUpperCase());
    }

    if (options.serviceId && options.serviceId !== 'all') {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(options.serviceId);
      if (isUuid) {
        conditions.push(`(
          l.service_id = $${paramIdx} 
          OR l.metadata->>'service_id' = $${paramIdx}
        )`);
      } else {
        conditions.push(`(
          l.metadata->>'service_id' = $${paramIdx} 
          OR l.service_id IN (SELECT id FROM services WHERE name = $${paramIdx})
          OR l.service_id IN (SELECT id FROM workloads WHERE name = $${paramIdx})
        )`);
      }
      params.push(options.serviceId);
      paramIdx++;
    }

    if (options.search && options.search.trim()) {
      const term = `%${options.search.trim()}%`;
      conditions.push(`(
        l.message ILIKE $${paramIdx} 
        OR l.metadata->>'pod_id' ILIKE $${paramIdx}
        OR l.metadata->>'service_id' ILIKE $${paramIdx}
        OR l.source ILIKE $${paramIdx}
      )`);
      params.push(term);
      paramIdx++;
    }

    if (options.startTime) {
      conditions.push(`l.occurred_at >= $${paramIdx++}`);
      params.push(options.startTime);
    }

    if (options.endTime) {
      conditions.push(`l.occurred_at <= $${paramIdx++}`);
      params.push(options.endTime);
    }

    if (options.clusterId) {
      conditions.push(`l.cluster_id = $${paramIdx++}`);
      params.push(options.clusterId);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // 1. Get total count
    const countQuery = `
      SELECT COUNT(*)::int as total
      FROM logs l
      ${whereClause};
    `;
    const countRes = await pool.query(countQuery, params);
    const total = Number(countRes.rows[0]?.total || 0);

    // 2. Fetch paginated records with readable service_name
    const dataParams = [...params, limit, offset];
    const dataQuery = `
      SELECT 
        l.id,
        l.cluster_id,
        l.service_id,
        COALESCE(s.name, w.name, l.metadata->>'service_id', l.service_id::text) as service_name,
        COALESCE(l.pod_id::text, l.metadata->>'pod_id') as pod_id,
        l.trace_id,
        l.level,
        l.message,
        l.source,
        l.occurred_at,
        l.metadata
      FROM logs l
      LEFT JOIN services s ON l.service_id = s.id
      LEFT JOIN workloads w ON l.service_id = w.id
      ${whereClause}
      ORDER BY l.occurred_at DESC, l.id DESC
      LIMIT $${paramIdx++} OFFSET $${paramIdx++};
    `;

    const dataRes = await pool.query(dataQuery, dataParams);
    const logs: ILogItem[] = dataRes.rows.map((row) => ({
      id: String(row.id),
      cluster_id: row.cluster_id,
      service_id: row.service_id,
      service_name: row.service_name || row.service_id || 'unknown',
      pod_id: row.pod_id,
      trace_id: row.trace_id,
      level: row.level,
      message: row.message,
      source: row.source,
      occurred_at: row.occurred_at ? new Date(row.occurred_at).toISOString() : new Date().toISOString(),
      metadata: row.metadata || null,
    }));

    return {
      logs,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Get recent logs for telemetry live feed
   */
  public static async getRecent(limit: number = 30) {
    const res = await pool.query(
      `SELECT id, service_id, level, message, source, occurred_at, metadata
       FROM logs
       ORDER BY occurred_at DESC
       LIMIT $1`,
      [limit]
    );
    return res.rows;
  }
}
