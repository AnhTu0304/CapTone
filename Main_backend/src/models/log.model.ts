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
  namespace?: string | null;
  deployment?: string | null;
  pod?: string | null;
  level?: string | null;
  search?: string | null;
  startTime?: Date | null;
  endTime?: Date | null;
  clusterId?: string | null;
  allowedOrgIds?: string[] | null;
  limit?: number;
  offset?: number;
}

export interface ILogItem {
  id: string | number;
  cluster_id: string | null;
  namespace?: string | null;
  service_id: string | null;
  service_name: string | null;
  pod_id: string | null;
  pod_name?: string | null;
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
        cluster_id, namespace_id, service_id, pod_id, level, message, source, occurred_at, metadata
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9
      ) RETURNING id;
    `;

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    let validClusterUuid: string | null = null;
    let validServiceUuid: string | null = null;
    let validNamespaceUuid: string | null = null;
    let validPodUuid: string | null = null;
    let metadataObj = log.metadata || {};

    if (log.cluster_id && uuidRegex.test(log.cluster_id)) {
      validClusterUuid = log.cluster_id;
    }

    if (log.service_id) {
      if (uuidRegex.test(log.service_id)) {
        validServiceUuid = log.service_id;
      } else if (!metadataObj.service_id) {
        metadataObj = { ...metadataObj, service_id: log.service_id };
      }
    }

    if (log.namespace_id) {
      if (uuidRegex.test(log.namespace_id)) {
        validNamespaceUuid = log.namespace_id;
      } else if (!metadataObj.namespace) {
        metadataObj = { ...metadataObj, namespace: log.namespace_id };
      }
    }

    if (log.pod_id) {
      if (uuidRegex.test(log.pod_id)) {
        validPodUuid = log.pod_id;
      } else if (!metadataObj.pod_id && !metadataObj.pod_name) {
        metadataObj = { ...metadataObj, pod_id: log.pod_id, pod_name: log.pod_id };
      }
    }

    const res = await pool.query(query, [
      validClusterUuid,
      validNamespaceUuid,
      validServiceUuid,
      validPodUuid,
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
          OR service_id::text = $1 OR service_id IN (SELECT id FROM workloads WHERE name = $1)
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
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (options.level && options.level.toUpperCase() !== 'ALL') {
      conditions.push(`l.level = $${paramIdx++}`);
      params.push(options.level.toUpperCase());
    }

    if (options.serviceId && options.serviceId !== 'all') {
      const isUuid = uuidRegex.test(options.serviceId);
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

    // [4.36] Filter by Namespace
    if (options.namespace && options.namespace.toUpperCase() !== 'ALL') {
      const ns = options.namespace.trim();
      const isUuid = uuidRegex.test(ns);
      if (isUuid) {
        conditions.push(`(
          l.namespace_id = $${paramIdx}
          OR l.metadata->>'namespace' = $${paramIdx}
          OR l.metadata->>'namespace_id' = $${paramIdx}
          OR l.pod_id IN (SELECT id FROM pods WHERE namespace_id = $${paramIdx})
        )`);
      } else {
        conditions.push(`(
          l.namespace_id IN (SELECT id FROM namespaces WHERE name = $${paramIdx})
          OR l.metadata->>'namespace' = $${paramIdx}
          OR l.metadata->>'namespace_id' = $${paramIdx}
          OR l.pod_id IN (SELECT p.id FROM pods p JOIN namespaces ns ON p.namespace_id = ns.id WHERE ns.name = $${paramIdx})
        )`);
      }
      params.push(ns);
      paramIdx++;
    }

    // [4.36] Filter by Deployment (Workload)
    if (options.deployment && options.deployment.toUpperCase() !== 'ALL') {
      const dep = options.deployment.trim();
      const isUuid = uuidRegex.test(dep);
      if (isUuid) {
        conditions.push(`(
          l.service_id = $${paramIdx}
          OR l.metadata->>'service_id' = $${paramIdx}
          OR l.metadata->>'deployment' = $${paramIdx}
          OR l.pod_id IN (SELECT id FROM pods WHERE workload_id = $${paramIdx})
        )`);
      } else {
        conditions.push(`(
          l.metadata->>'service_id' = $${paramIdx}
          OR l.metadata->>'deployment' = $${paramIdx}
          OR l.metadata->>'workload' = $${paramIdx}
          OR l.service_id IN (SELECT id FROM workloads WHERE name = $${paramIdx})
          OR l.pod_id IN (SELECT p.id FROM pods p JOIN workloads w ON p.workload_id = w.id WHERE w.name = $${paramIdx})
        )`);
      }
      params.push(dep);
      paramIdx++;
    }

    // [4.36] Filter by Pod
    if (options.pod && options.pod.toUpperCase() !== 'ALL') {
      const pod = options.pod.trim();
      const isUuid = uuidRegex.test(pod);
      if (isUuid) {
        conditions.push(`(
          l.pod_id = $${paramIdx}
          OR l.metadata->>'pod_id' = $${paramIdx}
          OR l.metadata->>'pod_name' = $${paramIdx}
        )`);
      } else {
        conditions.push(`(
          l.metadata->>'pod_id' = $${paramIdx}
          OR l.metadata->>'pod_name' = $${paramIdx}
          OR l.pod_id IN (SELECT id FROM pods WHERE name = $${paramIdx})
        )`);
      }
      params.push(pod);
      paramIdx++;
    }

    if (options.search && options.search.trim()) {
      const term = `%${options.search.trim()}%`;
      conditions.push(`(
        l.message ILIKE $${paramIdx} 
        OR l.metadata->>'pod_id' ILIKE $${paramIdx}
        OR l.metadata->>'pod_name' ILIKE $${paramIdx}
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
      conditions.push(`l.cluster_id::text = $${paramIdx++}`);
      params.push(options.clusterId);
    }

    // Tenant Isolation Scope [S4][PB17] 3.5
    if (Array.isArray(options.allowedOrgIds) && options.allowedOrgIds.length > 0) {
      conditions.push(`(
        l.cluster_id IN (
          SELECT c.id FROM clusters c 
          JOIN environments env ON c.environment_id = env.id 
          WHERE env.organization_id = ANY($${paramIdx}::uuid[])
        )
        OR l.service_id IN (
          SELECT s.id FROM services s 
          JOIN clusters c ON s.cluster_id = c.id
          JOIN environments env ON c.environment_id = env.id 
          WHERE env.organization_id = ANY($${paramIdx}::uuid[])
        )
        OR (l.metadata->>'organization_id') = ANY($${paramIdx}::text[])
        OR (l.metadata->>'org_id') = ANY($${paramIdx}::text[])
      )`);
      params.push(options.allowedOrgIds);
      paramIdx++;
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

    // 2. Fetch paginated records with readable service_name, pod_name, and namespace
    const dataParams = [...params, limit, offset];
    const dataQuery = `
      SELECT 
        l.id,
        l.cluster_id,
        l.namespace_id,
        COALESCE(ns.name, l.metadata->>'namespace', 'default') as namespace,
        l.service_id,
        COALESCE(s.name, w.name, l.metadata->>'service_id', l.service_id::text) as service_name,
        COALESCE(l.pod_id::text, l.metadata->>'pod_id') as pod_id,
        COALESCE(p.name, l.metadata->>'pod_name', l.pod_id::text, 'unknown-pod') as pod_name,
        l.trace_id,
        l.level,
        l.message,
        l.source,
        l.occurred_at,
        l.metadata
      FROM logs l
      LEFT JOIN services s ON l.service_id = s.id
      LEFT JOIN workloads w ON l.service_id = w.id
      LEFT JOIN namespaces ns ON l.namespace_id = ns.id
      LEFT JOIN pods p ON l.pod_id = p.id
      ${whereClause}
      ORDER BY l.occurred_at DESC, l.id DESC
      LIMIT $${paramIdx++} OFFSET $${paramIdx++};
    `;

    const dataRes = await pool.query(dataQuery, dataParams);
    const logs: ILogItem[] = dataRes.rows.map((row) => ({
      id: String(row.id),
      cluster_id: row.cluster_id ? String(row.cluster_id) : null,
      namespace: row.namespace || 'default',
      service_id: row.service_id ? String(row.service_id) : null,
      service_name: row.service_name || row.service_id || 'unknown',
      pod_id: row.pod_id,
      pod_name: row.pod_name || row.pod_id || 'unknown-pod',
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
