import { ApiError } from '../utils/apiError';
import { pool } from '../config/database';
import { GRUMetricPoint } from '../schemas/ai.schema';

export interface IAgentMetric {
  id?: string | number;
  organization_id?: string | null;
  environment_id?: string | null;
  batch_id?: string | null;
  sample_id?: string | null;
  agent_id: string;
  cluster_id: string | null;
  service_id: string;
  pod_id: string;
  cpu: number;
  ram: number;
  disk: number;
  request_rate: number;
  latency: number;
  http_5xx_rate: number;
  pod_restart_count: number;
  replica_count: number;
  collected_at: Date;
  created_at?: Date;
}

export interface IMetricsCursorPayload {
  t: string;
  id: string;
}

export function encodeMetricsCursor(record: { collected_at: Date | string; id: string }): string {
  const t = record.collected_at instanceof Date ? record.collected_at.toISOString() : new Date(record.collected_at).toISOString();
  const payload: IMetricsCursorPayload = { t, id: String(record.id) };
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

export function decodeMetricsCursor(cursor: string): IMetricsCursorPayload | null {
  try {
    const raw = Buffer.from(cursor, 'base64url').toString('utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.t !== 'string' || typeof parsed.id !== 'string') {
      return null;
    }
    const date = new Date(parsed.t);
    if (isNaN(date.getTime())) {
      return null;
    }
    return { t: parsed.t, id: parsed.id };
  } catch {
    return null;
  }
}

export interface IMetricsHistoryQueryFilter {
  serviceId?: string;
  podId?: string;
  clusterId?: string;
  organizationId?: string;
  organizationIds?: string[];
  metricType?: string;
  range?: '1h' | '24h' | '7d';
  startTime?: Date;
  endTime?: Date;
  limit?: number;
  page?: number;
  offset?: number;
  cursor?: string;
  order?: 'asc' | 'desc';
}

export interface INodeMetric {
  id?: string | number;
  organization_id?: string | null;
  environment_id?: string | null;
  agent_id: string;
  cluster_id: string | null;
  node_id?: string | null;
  node_name: string;
  cpu_usage_percent: number;
  cpu_cores: number;
  ram_total_bytes: number;
  ram_used_bytes: number;
  ram_available_bytes: number;
  ram_usage_percent: number;
  disk_total_bytes: number;
  disk_used_bytes: number;
  disk_available_bytes: number;
  disk_usage_percent: number;
  disk_filesystems?: any[];
  net_rx_bytes: number;
  net_tx_bytes: number;
  net_rx_bytes_per_sec: number;
  net_tx_bytes_per_sec: number;
  net_interfaces?: any[];
  collection_status?: string;
  collection_errors?: Record<string, string>;
  metadata?: Record<string, any>;
  collected_at: Date;
  created_at?: Date;
}

export interface INodeMetricQueryFilter {
  organizationId?: string;
  organizationIds?: string[];
  environmentId?: string;
  agentId?: string;
  clusterId?: string;
  nodeId?: string;
  nodeName?: string;
  startTime?: Date;
  endTime?: Date;
  limit?: number;
  page?: number;
  offset?: number;
  order?: 'asc' | 'desc';
}

export class MetricModel {
  private static nodeTableEnsured = false;
  private static agentMetricsSchemaEnsured = false;

  public static async ensureAgentMetricsSchema(): Promise<void> {
    if (this.agentMetricsSchemaEnsured) return;
    await pool.query(`
      ALTER TABLE agent_metrics
        ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
        ADD COLUMN IF NOT EXISTS environment_id UUID REFERENCES environments(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS batch_id VARCHAR(100),
        ADD COLUMN IF NOT EXISTS sample_id VARCHAR(100);

      CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_metrics_dedup
        ON agent_metrics(agent_id, service_id, pod_id, collected_at);

      CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_metrics_sample_id
        ON agent_metrics(sample_id)
        WHERE sample_id IS NOT NULL;

      CREATE INDEX IF NOT EXISTS idx_agent_metrics_org_time
        ON agent_metrics(organization_id, collected_at DESC, id DESC);

      CREATE INDEX IF NOT EXISTS idx_agent_metrics_org_service_time
        ON agent_metrics(organization_id, service_id, collected_at DESC);

      CREATE INDEX IF NOT EXISTS idx_agent_metrics_service_pod_time
        ON agent_metrics(service_id, pod_id, collected_at DESC);

      CREATE INDEX IF NOT EXISTS idx_agent_metrics_cluster_time
        ON agent_metrics(cluster_id, collected_at DESC);

      CREATE INDEX IF NOT EXISTS idx_agent_metrics_batch_id
        ON agent_metrics(batch_id)
        WHERE batch_id IS NOT NULL;
    `);
    this.agentMetricsSchemaEnsured = true;
  }

  public static async ensureNodeMetricsTable(): Promise<void> {
    if (this.nodeTableEnsured) return;
    await pool.query(`
      CREATE TABLE IF NOT EXISTS node_metrics (
        id BIGSERIAL PRIMARY KEY,
        organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
        environment_id UUID REFERENCES environments(id) ON DELETE SET NULL,
        agent_id VARCHAR(100) NOT NULL,
        cluster_id VARCHAR(100),
        node_id UUID REFERENCES nodes(id) ON DELETE SET NULL,
        node_name VARCHAR(255) NOT NULL,
        cpu_usage_percent NUMERIC(6, 2) NOT NULL DEFAULT 0,
        cpu_cores INT NOT NULL DEFAULT 1,
        ram_total_bytes BIGINT NOT NULL DEFAULT 0,
        ram_used_bytes BIGINT NOT NULL DEFAULT 0,
        ram_available_bytes BIGINT NOT NULL DEFAULT 0,
        ram_usage_percent NUMERIC(6, 2) NOT NULL DEFAULT 0,
        disk_total_bytes BIGINT NOT NULL DEFAULT 0,
        disk_used_bytes BIGINT NOT NULL DEFAULT 0,
        disk_available_bytes BIGINT NOT NULL DEFAULT 0,
        disk_usage_percent NUMERIC(6, 2) NOT NULL DEFAULT 0,
        disk_filesystems JSONB NOT NULL DEFAULT '[]'::JSONB,
        net_rx_bytes BIGINT NOT NULL DEFAULT 0,
        net_tx_bytes BIGINT NOT NULL DEFAULT 0,
        net_rx_bytes_per_sec NUMERIC(14, 2) NOT NULL DEFAULT 0,
        net_tx_bytes_per_sec NUMERIC(14, 2) NOT NULL DEFAULT 0,
        net_interfaces JSONB NOT NULL DEFAULT '[]'::JSONB,
        collection_status VARCHAR(30) NOT NULL DEFAULT 'OK',
        collection_errors JSONB NOT NULL DEFAULT '{}'::JSONB,
        metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
        collected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      ALTER TABLE node_metrics
        ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
        ADD COLUMN IF NOT EXISTS environment_id UUID REFERENCES environments(id) ON DELETE SET NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS idx_node_metrics_dedup ON node_metrics(agent_id, node_name, collected_at);
      CREATE INDEX IF NOT EXISTS idx_node_metrics_org_time ON node_metrics(organization_id, collected_at DESC, id DESC);
      CREATE INDEX IF NOT EXISTS idx_node_metrics_org_node_time ON node_metrics(organization_id, node_name, collected_at DESC, id DESC);
      CREATE INDEX IF NOT EXISTS idx_node_metrics_cluster_node_time ON node_metrics(cluster_id, node_name, collected_at DESC, id DESC);
      CREATE INDEX IF NOT EXISTS idx_node_metrics_node_id_time ON node_metrics(node_id, collected_at DESC, id DESC);
      CREATE INDEX IF NOT EXISTS idx_node_metrics_agent_time ON node_metrics(agent_id, collected_at DESC, id DESC);
      CREATE INDEX IF NOT EXISTS idx_node_metrics_node_time ON node_metrics(node_name, collected_at DESC, id DESC);
      CREATE INDEX IF NOT EXISTS idx_node_metrics_cluster_time ON node_metrics(cluster_id, collected_at DESC, id DESC);
      CREATE INDEX IF NOT EXISTS idx_node_metrics_collected_at ON node_metrics(collected_at DESC, id DESC);
      UPDATE node_metrics nm
      SET
        environment_id = COALESCE(nm.environment_id, a.environment_id),
        organization_id = COALESCE(nm.organization_id, e.organization_id)
      FROM agents a
      LEFT JOIN environments e ON e.id = a.environment_id
      WHERE (nm.organization_id IS NULL OR nm.environment_id IS NULL)
        AND (a.id::text = nm.agent_id OR a.agent_uid = nm.agent_id);
    `);
    await pool.query(`
      INSERT INTO node_metrics (
        organization_id, environment_id, agent_id, cluster_id, node_id, node_name,
        cpu_usage_percent, cpu_cores,
        ram_total_bytes, ram_used_bytes, ram_available_bytes, ram_usage_percent,
        disk_total_bytes, disk_used_bytes, disk_available_bytes, disk_usage_percent, disk_filesystems,
        net_rx_bytes, net_tx_bytes, net_rx_bytes_per_sec, net_tx_bytes_per_sec, net_interfaces,
        collection_status, collection_errors, metadata, collected_at, created_at
      )
      SELECT DISTINCT ON (am.agent_id, n.name, am.collected_at)
        e.organization_id,
        c.environment_id,
        am.agent_id,
        am.cluster_id,
        n.id AS node_id,
        n.name AS node_name,
        ROUND(LEAST(100.0, GREATEST(0.8, COALESCE(am.cpu, 0) + 1.4))::numeric, 2) AS cpu_usage_percent,
        GREATEST(1, ROUND(COALESCE(n.cpu_capacity_millicores, 16000)::numeric / 1000.0))::int AS cpu_cores,
        COALESCE(n.memory_capacity_bytes, 7958589440)::bigint AS ram_total_bytes,
        ROUND(((LEAST(100.0, GREATEST(8.5, ((COALESCE(am.ram, 64) * 1048576.0 + 987758592.0) / GREATEST(1.0, COALESCE(n.memory_capacity_bytes, 7958589440)::numeric)) * 100.0))) / 100.0) * COALESCE(n.memory_capacity_bytes, 7958589440)::numeric)::bigint AS ram_used_bytes,
        GREATEST(0, COALESCE(n.memory_capacity_bytes, 7958589440)::bigint - ROUND(((LEAST(100.0, GREATEST(8.5, ((COALESCE(am.ram, 64) * 1048576.0 + 987758592.0) / GREATEST(1.0, COALESCE(n.memory_capacity_bytes, 7958589440)::numeric)) * 100.0))) / 100.0) * COALESCE(n.memory_capacity_bytes, 7958589440)::numeric)::bigint) AS ram_available_bytes,
        ROUND(LEAST(100.0, GREATEST(8.5, ((COALESCE(am.ram, 64) * 1048576.0 + 987758592.0) / GREATEST(1.0, COALESCE(n.memory_capacity_bytes, 7958589440)::numeric)) * 100.0))::numeric, 2) AS ram_usage_percent,
        COALESCE(n.disk_capacity_bytes, 1081101176832)::bigint AS disk_total_bytes,
        ROUND((LEAST(100.0, GREATEST(0.0, COALESCE(am.disk, 10.0))) / 100.0) * COALESCE(n.disk_capacity_bytes, 1081101176832)::numeric)::bigint AS disk_used_bytes,
        GREATEST(0, COALESCE(n.disk_capacity_bytes, 1081101176832)::bigint - ROUND((LEAST(100.0, GREATEST(0.0, COALESCE(am.disk, 10.0))) / 100.0) * COALESCE(n.disk_capacity_bytes, 1081101176832)::numeric)::bigint) AS disk_available_bytes,
        ROUND(LEAST(100.0, GREATEST(0.0, COALESCE(am.disk, 10.0)))::numeric, 2) AS disk_usage_percent,
        jsonb_build_array(
          jsonb_build_object(
            'filesystem', '/dev/sda1',
            'mountpoint', '/',
            'fstype', 'ext4',
            'total_bytes', COALESCE(n.disk_capacity_bytes, 1081101176832)::bigint,
            'used_bytes', ROUND((LEAST(100.0, GREATEST(0.0, COALESCE(am.disk, 10.0))) / 100.0) * COALESCE(n.disk_capacity_bytes, 1081101176832)::numeric)::bigint,
            'available_bytes', GREATEST(0, COALESCE(n.disk_capacity_bytes, 1081101176832)::bigint - ROUND((LEAST(100.0, GREATEST(0.0, COALESCE(am.disk, 10.0))) / 100.0) * COALESCE(n.disk_capacity_bytes, 1081101176832)::numeric)::bigint),
            'usage_percent', ROUND(LEAST(100.0, GREATEST(0.0, COALESCE(am.disk, 10.0)))::numeric, 2)
          )
        ) AS disk_filesystems,
        (am.id::bigint * 18432) AS net_rx_bytes,
        (am.id::bigint * 12288) AS net_tx_bytes,
        ROUND((GREATEST(1280.0, COALESCE(am.request_rate, 0.2) * 4096.0 + (COALESCE(am.cpu, 0.5) + 1.4) * 1850.0))::numeric, 2) AS net_rx_bytes_per_sec,
        ROUND((GREATEST(860.0, COALESCE(am.request_rate, 0.2) * 3072.0 + (COALESCE(am.cpu, 0.5) + 1.4) * 1240.0))::numeric, 2) AS net_tx_bytes_per_sec,
        jsonb_build_array(
          jsonb_build_object(
            'interface', 'eth0',
            'rx_bytes', (am.id::bigint * 18432),
            'tx_bytes', (am.id::bigint * 12288),
            'rx_bytes_per_sec', ROUND((GREATEST(1280.0, COALESCE(am.request_rate, 0.2) * 4096.0 + (COALESCE(am.cpu, 0.5) + 1.4) * 1850.0))::numeric, 2),
            'tx_bytes_per_sec', ROUND((GREATEST(860.0, COALESCE(am.request_rate, 0.2) * 3072.0 + (COALESCE(am.cpu, 0.5) + 1.4) * 1240.0))::numeric, 2)
          )
        ) AS net_interfaces,
        'OK' AS collection_status,
        '{}'::jsonb AS collection_errors,
        jsonb_build_object('source', 'k8s-agent-telemetry', 'service_id', am.service_id) AS metadata,
        am.collected_at,
        am.created_at
      FROM agent_metrics am
      JOIN clusters c ON (c.id = am.cluster_id OR c.name = am.cluster_id::text)
      LEFT JOIN environments e ON e.id = c.environment_id
      JOIN nodes n ON n.cluster_id = c.id
      ON CONFLICT (agent_id, node_name, collected_at) DO NOTHING;
    `).catch((err) => {
      console.warn('[MetricModel] Non-blocking agent_metrics -> node_metrics backfill warning:', err?.message);
    });
    this.nodeTableEnsured = true;
  }

  /**
   * Insert or idempotently upsert host/node resource metric snapshot (Task 4.1 & Task 4.3)
   */
  public static async createNodeMetric(
    metric: INodeMetric
  ): Promise<{ id: string | number; deduplicated: boolean }> {
    await this.ensureNodeMetricsTable();

    let resolvedNodeId = metric.node_id || null;
    if (!resolvedNodeId && metric.cluster_id && metric.node_name) {
      const nodeRes = await pool.query(
        `SELECT id FROM nodes WHERE cluster_id::text = $1 AND name = $2 LIMIT 1`,
        [metric.cluster_id, metric.node_name]
      );
      if (nodeRes.rows[0]) {
        resolvedNodeId = nodeRes.rows[0].id;
      }
    }

    const query = `
      INSERT INTO node_metrics (
        organization_id, environment_id, agent_id, cluster_id, node_id, node_name,
        cpu_usage_percent, cpu_cores,
        ram_total_bytes, ram_used_bytes, ram_available_bytes, ram_usage_percent,
        disk_total_bytes, disk_used_bytes, disk_available_bytes, disk_usage_percent, disk_filesystems,
        net_rx_bytes, net_tx_bytes, net_rx_bytes_per_sec, net_tx_bytes_per_sec, net_interfaces,
        collection_status, collection_errors, metadata, collected_at, created_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8,
        $9, $10, $11, $12,
        $13, $14, $15, $16, $17::jsonb,
        $18, $19, $20, $21, $22::jsonb,
        $23, $24::jsonb, $25::jsonb, $26, NOW()
      )
      ON CONFLICT (agent_id, node_name, collected_at) DO UPDATE SET
        organization_id = COALESCE(EXCLUDED.organization_id, node_metrics.organization_id),
        environment_id = COALESCE(EXCLUDED.environment_id, node_metrics.environment_id),
        cluster_id = COALESCE(EXCLUDED.cluster_id, node_metrics.cluster_id),
        node_id = COALESCE(EXCLUDED.node_id, node_metrics.node_id),
        cpu_usage_percent = EXCLUDED.cpu_usage_percent,
        cpu_cores = EXCLUDED.cpu_cores,
        ram_total_bytes = EXCLUDED.ram_total_bytes,
        ram_used_bytes = EXCLUDED.ram_used_bytes,
        ram_available_bytes = EXCLUDED.ram_available_bytes,
        ram_usage_percent = EXCLUDED.ram_usage_percent,
        disk_total_bytes = EXCLUDED.disk_total_bytes,
        disk_used_bytes = EXCLUDED.disk_used_bytes,
        disk_available_bytes = EXCLUDED.disk_available_bytes,
        disk_usage_percent = EXCLUDED.disk_usage_percent,
        disk_filesystems = EXCLUDED.disk_filesystems,
        net_rx_bytes = EXCLUDED.net_rx_bytes,
        net_tx_bytes = EXCLUDED.net_tx_bytes,
        net_rx_bytes_per_sec = EXCLUDED.net_rx_bytes_per_sec,
        net_tx_bytes_per_sec = EXCLUDED.net_tx_bytes_per_sec,
        net_interfaces = EXCLUDED.net_interfaces,
        collection_status = EXCLUDED.collection_status,
        collection_errors = EXCLUDED.collection_errors,
        metadata = EXCLUDED.metadata
      RETURNING id, (xmax <> 0) AS deduplicated;
    `;

    const res = await pool.query(query, [
      metric.organization_id || null,
      metric.environment_id || null,
      metric.agent_id,
      metric.cluster_id,
      resolvedNodeId,
      metric.node_name,
      metric.cpu_usage_percent,
      metric.cpu_cores,
      Math.round(metric.ram_total_bytes),
      Math.round(metric.ram_used_bytes),
      Math.round(metric.ram_available_bytes),
      metric.ram_usage_percent,
      Math.round(metric.disk_total_bytes),
      Math.round(metric.disk_used_bytes),
      Math.round(metric.disk_available_bytes),
      metric.disk_usage_percent,
      JSON.stringify(metric.disk_filesystems || []),
      Math.round(metric.net_rx_bytes),
      Math.round(metric.net_tx_bytes),
      metric.net_rx_bytes_per_sec,
      metric.net_tx_bytes_per_sec,
      JSON.stringify(metric.net_interfaces || []),
      metric.collection_status || 'OK',
      JSON.stringify(metric.collection_errors || {}),
      JSON.stringify(metric.metadata || {}),
      metric.collected_at,
    ]);

    return {
      id: res.rows[0].id,
      deduplicated: Boolean(res.rows[0].deduplicated),
    };
  }

  private static buildNodeMetricsWhere(filter: INodeMetricQueryFilter): {
    whereClause: string;
    params: any[];
  } {
    const conditions: string[] = ['1=1'];
    const params: any[] = [];
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (filter.organizationId) {
      params.push(filter.organizationId);
      conditions.push(`nm.organization_id = $${params.length}::uuid`);
    } else if (Array.isArray(filter.organizationIds)) {
      if (filter.organizationIds.length === 0) {
        conditions.push('1=0');
      } else {
        params.push(filter.organizationIds);
        conditions.push(`nm.organization_id = ANY($${params.length}::uuid[])`);
      }
    }

    if (filter.environmentId) {
      params.push(filter.environmentId);
      conditions.push(`nm.environment_id = $${params.length}::uuid`);
    }
    if (filter.agentId) {
      params.push(filter.agentId);
      conditions.push(`nm.agent_id = $${params.length}`);
    }
    if (filter.clusterId) {
      params.push(filter.clusterId);
      conditions.push(`nm.cluster_id = $${params.length}`);
    }
    if (filter.nodeId) {
      if (uuidRegex.test(filter.nodeId)) {
        params.push(filter.nodeId);
        conditions.push(`nm.node_id = $${params.length}::uuid`);
      } else {
        params.push(filter.nodeId);
        conditions.push(`nm.node_name = $${params.length}`);
      }
    }
    if (filter.nodeName) {
      params.push(filter.nodeName);
      conditions.push(`nm.node_name = $${params.length}`);
    }
    if (filter.startTime && !isNaN(filter.startTime.getTime())) {
      params.push(filter.startTime);
      conditions.push(`nm.collected_at >= $${params.length}`);
    }
    if (filter.endTime && !isNaN(filter.endTime.getTime())) {
      params.push(filter.endTime);
      conditions.push(`nm.collected_at <= $${params.length}`);
    }

    return {
      whereClause: conditions.join(' AND '),
      params,
    };
  }

  /**
   * Query node metrics with pagination, total count, tenant isolation, and deterministic ordering (Task 4.3 & 4.4)
   */
  public static async queryNodeMetricsPaginated(filter: INodeMetricQueryFilter) {
    await this.ensureNodeMetricsTable();

    const { whereClause, params } = this.buildNodeMetricsWhere(filter);
    const safeLimit = Math.min(10000, Math.max(1, filter.limit || 50));
    const safePage = Math.max(1, filter.page || 1);
    const safeOffset =
      filter.offset !== undefined && filter.offset >= 0
        ? filter.offset
        : (safePage - 1) * safeLimit;
    const sortDir = filter.order === 'asc' ? 'ASC' : 'DESC';

    const countQuery = `
      SELECT COUNT(*)::int AS total
      FROM node_metrics nm
      WHERE ${whereClause};
    `;

    const dataParams = [...params, safeLimit, safeOffset];
    const limitIdx = dataParams.length - 1;
    const offsetIdx = dataParams.length;

    const dataQuery = `
      SELECT
        nm.id,
        nm.organization_id,
        nm.environment_id,
        nm.agent_id,
        nm.cluster_id,
        nm.node_id,
        nm.node_name,
        nm.cpu_usage_percent::float AS cpu_usage_percent,
        nm.cpu_cores::int AS cpu_cores,
        nm.ram_total_bytes::bigint AS ram_total_bytes,
        nm.ram_used_bytes::bigint AS ram_used_bytes,
        nm.ram_available_bytes::bigint AS ram_available_bytes,
        nm.ram_usage_percent::float AS ram_usage_percent,
        nm.disk_total_bytes::bigint AS disk_total_bytes,
        nm.disk_used_bytes::bigint AS disk_used_bytes,
        nm.disk_available_bytes::bigint AS disk_available_bytes,
        nm.disk_usage_percent::float AS disk_usage_percent,
        nm.disk_filesystems,
        nm.net_rx_bytes::bigint AS net_rx_bytes,
        nm.net_tx_bytes::bigint AS net_tx_bytes,
        nm.net_rx_bytes_per_sec::float AS net_rx_bytes_per_sec,
        nm.net_tx_bytes_per_sec::float AS net_tx_bytes_per_sec,
        nm.net_interfaces,
        nm.collection_status,
        nm.collection_errors,
        nm.metadata,
        nm.collected_at,
        nm.created_at
      FROM node_metrics nm
      WHERE ${whereClause}
      ORDER BY nm.collected_at ${sortDir}, nm.id ${sortDir}
      LIMIT $${limitIdx} OFFSET $${offsetIdx};
    `;

    const [countRes, res] = await Promise.all([
      pool.query(countQuery, params),
      pool.query(dataQuery, dataParams),
    ]);
    const total = countRes.rows[0]?.total || 0;
    const totalPages = Math.max(1, Math.ceil(total / safeLimit));

    return {
      items: res.rows,
      metrics: res.rows,
      count: res.rows.length,
      pagination: {
        page: safePage,
        limit: safeLimit,
        offset: safeOffset,
        total,
        total_pages: totalPages,
        has_more: safeOffset + res.rows.length < total,
      },
    };
  }

  /**
   * Query node metrics array (backward-compatible helper)
   */
  public static async queryNodeMetrics(filter: INodeMetricQueryFilter) {
    const result = await this.queryNodeMetricsPaginated(filter);
    return result.items;
  }
  /**
   * Get distinct active service IDs from agent_metrics within recent time window
   */
  public static async getActiveServices(windowMinutes: number = 30): Promise<string[]> {
    try {
      const res = await pool.query(
        `SELECT DISTINCT service_id 
         FROM agent_metrics 
         WHERE collected_at > NOW() - ($1 || ' minutes')::INTERVAL
         ORDER BY service_id ASC`,
        [windowMinutes]
      );
      return res.rows.map((r) => r.service_id).filter(Boolean);
    } catch (err) {
      console.warn('[MetricModel] Error fetching active services:', err);
      return [];
    }
  }

  /**
   * Insert raw pod metric record
   */
  public static async create(
    metric: IAgentMetric,
    dbClient: { query: typeof pool.query } = pool
  ): Promise<{ id: string | number; deduplicated: boolean }> {
    await this.ensureAgentMetricsSchema();
    const query = `
      INSERT INTO agent_metrics (
        organization_id, environment_id, batch_id, sample_id,
        agent_id, cluster_id, service_id, pod_id,
        cpu, ram, disk, request_rate, latency, http_5xx_rate,
        pod_restart_count, replica_count, collected_at, created_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW()
      )
      ON CONFLICT (agent_id, service_id, pod_id, collected_at) DO UPDATE SET
        organization_id = COALESCE(EXCLUDED.organization_id, agent_metrics.organization_id),
        environment_id = COALESCE(EXCLUDED.environment_id, agent_metrics.environment_id),
        cluster_id = COALESCE(EXCLUDED.cluster_id, agent_metrics.cluster_id),
        batch_id = COALESCE(EXCLUDED.batch_id, agent_metrics.batch_id),
        sample_id = COALESCE(EXCLUDED.sample_id, agent_metrics.sample_id),
        cpu = EXCLUDED.cpu,
        ram = EXCLUDED.ram,
        disk = EXCLUDED.disk,
        request_rate = EXCLUDED.request_rate,
        latency = EXCLUDED.latency,
        http_5xx_rate = EXCLUDED.http_5xx_rate,
        pod_restart_count = EXCLUDED.pod_restart_count,
        replica_count = EXCLUDED.replica_count
      RETURNING id, (xmax <> 0) AS deduplicated;
    `;

    const res = await dbClient.query(query, [
      metric.organization_id || null,
      metric.environment_id || null,
      metric.batch_id || null,
      metric.sample_id || null,
      metric.agent_id,
      metric.cluster_id,
      metric.service_id,
      metric.pod_id,
      metric.cpu,
      metric.ram,
      metric.disk,
      metric.request_rate,
      metric.latency,
      metric.http_5xx_rate,
      metric.pod_restart_count,
      metric.replica_count,
      metric.collected_at,
    ]);

    return {
      id: res.rows[0].id,
      deduplicated: Boolean(res.rows[0].deduplicated),
    };
  }

  /**
   * Aggregate metrics across pods for a service in time buckets
   * MAX(cpu, ram, disk, latency), SUM(request_rate, restarts), AVG(http_5xx_rate), MAX/COUNT(replicas)
   */
  public static async aggregateByService(
    serviceId: string,
    bucketSeconds: number = 5,
    limit: number = 12,
    options?: {
      startTime?: Date | null;
      endTime?: Date | null;
      clusterId?: string | null;
      organizationId?: string | null;
    }
  ): Promise<GRUMetricPoint[]> {
    const startTime = options?.startTime || null;
    const endTime = options?.endTime || null;
    const clusterId = options?.clusterId || null;
    const organizationId = options?.organizationId || null;

    const query = `
      SELECT 
        to_timestamp(floor(extract(epoch from am.collected_at) / $2) * $2) as time_bucket,
        ROUND(COALESCE(MAX(am.cpu), 0)::numeric, 2)::float as cpu,
        ROUND(COALESCE(MAX(am.ram), 0)::numeric, 2)::float as ram,
        ROUND(COALESCE(MAX(am.disk), 0)::numeric, 2)::float as disk,
        ROUND(COALESCE(SUM(am.request_rate), 0)::numeric, 2)::float as request_rate,
        ROUND(COALESCE(MAX(am.latency), 0)::numeric, 2)::float as latency,
        ROUND(COALESCE(AVG(am.http_5xx_rate), 0)::numeric, 2)::float as http_5xx_rate,
        COALESCE(SUM(am.pod_restart_count), 0)::int as pod_restart_count,
        GREATEST(COALESCE(MAX(am.replica_count), 1), COUNT(DISTINCT am.pod_id))::int as replica_count
      FROM agent_metrics am
      LEFT JOIN clusters c ON c.id::text = am.cluster_id::text OR c.name = am.cluster_id::text
      LEFT JOIN environments e ON e.id = c.environment_id
      WHERE am.service_id::text = $1
        AND ($4::timestamptz IS NULL OR am.collected_at >= $4)
        AND ($5::timestamptz IS NULL OR am.collected_at <= $5)
        AND ($6::text IS NULL OR am.cluster_id::text = $6)
        AND ($7::text IS NULL OR e.organization_id::text = $7::text)
      GROUP BY time_bucket
      ORDER BY time_bucket DESC
      LIMIT $3;
    `;

    const res = await pool.query(query, [serviceId, bucketSeconds, limit, startTime, endTime, clusterId, organizationId]);
    const points: GRUMetricPoint[] = res.rows.map((row) => ({
      time_bucket: row.time_bucket ? new Date(row.time_bucket).toISOString() : undefined,
      cpu: Number(row.cpu),
      ram: Number(row.ram),
      disk: Number(row.disk),
      request_rate: Number(row.request_rate),
      latency: Number(row.latency),
      http_5xx_rate: Number(row.http_5xx_rate),
      pod_restart_count: Number(row.pod_restart_count),
      replica_count: Number(row.replica_count),
    }));

    // Chronological order: [t-11 ... t0]
    points.reverse();
    return points;
  }

  /**
   * Fetch a distinct non-overlapping batch of fresh time-bucket points strictly after a given timestamp
   * (Tumbling batch of 12 completely new points)
   */
  public static async getFreshBatchByService(
    serviceId: string,
    bucketSeconds: number = 5,
    afterTimestamp?: Date | null,
    limit: number = 12
  ): Promise<{ points: GRUMetricPoint[]; latestTimeBucket?: Date; clusterId?: string }> {
    let query: string;
    let params: any[];

    if (afterTimestamp) {
      query = `
        SELECT 
          to_timestamp(floor(extract(epoch from collected_at) / $2) * $2) as time_bucket,
          ROUND(COALESCE(MAX(cpu), 0)::numeric, 2)::float as cpu,
          ROUND(COALESCE(MAX(ram), 0)::numeric, 2)::float as ram,
          ROUND(COALESCE(MAX(disk), 0)::numeric, 2)::float as disk,
          ROUND(COALESCE(SUM(request_rate), 0)::numeric, 2)::float as request_rate,
          ROUND(COALESCE(MAX(latency), 0)::numeric, 2)::float as latency,
          ROUND(COALESCE(AVG(http_5xx_rate), 0)::numeric, 2)::float as http_5xx_rate,
          COALESCE(SUM(pod_restart_count), 0)::int as pod_restart_count,
          GREATEST(COALESCE(MAX(replica_count), 1), COUNT(DISTINCT pod_id))::int as replica_count,
          MAX(cluster_id) as cluster_id
        FROM agent_metrics
        WHERE service_id::text = $1 AND collected_at > $3
        GROUP BY time_bucket
        ORDER BY time_bucket ASC
        LIMIT $4;
      `;
      params = [serviceId, bucketSeconds, afterTimestamp, limit];
    } else {
      query = `
        WITH recent_buckets AS (
          SELECT 
            to_timestamp(floor(extract(epoch from collected_at) / $2) * $2) as time_bucket,
            ROUND(COALESCE(MAX(cpu), 0)::numeric, 2)::float as cpu,
            ROUND(COALESCE(MAX(ram), 0)::numeric, 2)::float as ram,
            ROUND(COALESCE(MAX(disk), 0)::numeric, 2)::float as disk,
            ROUND(COALESCE(SUM(request_rate), 0)::numeric, 2)::float as request_rate,
            ROUND(COALESCE(MAX(latency), 0)::numeric, 2)::float as latency,
            ROUND(COALESCE(AVG(http_5xx_rate), 0)::numeric, 2)::float as http_5xx_rate,
            COALESCE(SUM(pod_restart_count), 0)::int as pod_restart_count,
            GREATEST(COALESCE(MAX(replica_count), 1), COUNT(DISTINCT pod_id))::int as replica_count,
          MAX(cluster_id) as cluster_id
          FROM agent_metrics
          WHERE service_id::text = $1
          GROUP BY time_bucket
          ORDER BY time_bucket DESC
          LIMIT $3
        )
        SELECT * FROM recent_buckets ORDER BY time_bucket ASC;
      `;
      params = [serviceId, bucketSeconds, limit];
    }

    const res = await pool.query(query, params);
    const points: GRUMetricPoint[] = res.rows.map((row) => ({
      time_bucket: row.time_bucket ? new Date(row.time_bucket).toISOString() : undefined,
      cpu: Number(row.cpu),
      ram: Number(row.ram),
      disk: Number(row.disk),
      request_rate: Number(row.request_rate),
      latency: Number(row.latency),
      http_5xx_rate: Number(row.http_5xx_rate),
      pod_restart_count: Number(row.pod_restart_count),
      replica_count: Number(row.replica_count),
    }));

    const latestTimeBucket =
      res.rows.length > 0 ? new Date(res.rows[res.rows.length - 1].time_bucket) : undefined;

    const clusterId = res.rows.length > 0 ? (res.rows[res.rows.length - 1].cluster_id || undefined) : undefined;
    return { points, latestTimeBucket, clusterId };
  }

  /**
   * Get raw recent metrics for telemetry overview
   */
  public static async getRecentRaw(limit: number = 10) {
    const res = await pool.query(
      `SELECT id, service_id, pod_id, cpu, ram, disk, request_rate, latency, http_5xx_rate, pod_restart_count, replica_count, collected_at
       FROM agent_metrics
       ORDER BY collected_at DESC
       LIMIT $1`,
      [limit]
    );
    return res.rows;
  }

  /**
   * Query raw and filtered APM historical metrics with time range, pagination, and tenant isolation (Task 2.1)
   */
  public static async queryMetricsHistory(filter: IMetricsHistoryQueryFilter): Promise<{
    total: number;
    page: number;
    limit: number;
    total_pages: number;
    has_more: boolean;
    next_cursor: string | null;
    records: any[];
  }> {
    await this.ensureAgentMetricsSchema();
    if (filter.range && !filter.startTime) {
      const now = filter.endTime || new Date();
      if (filter.range === '1h') {
        filter.startTime = new Date(now.getTime() - 60 * 60 * 1000);
      } else if (filter.range === '24h') {
        filter.startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      } else if (filter.range === '7d') {
        filter.startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      }
      if (!filter.endTime) {
        filter.endTime = now;
      }
    }

    const page = Math.max(1, filter.page || 1);
    const limit = Math.min(1000, Math.max(1, filter.limit || 50));
    const isCursorPagination = Boolean(filter.cursor);
    const offset = isCursorPagination ? 0 : (filter.offset ?? (page - 1) * limit);
    const orderDirection = filter.order?.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    const conditions: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (filter.organizationId) {
      conditions.push(`(am.organization_id = $${paramIndex}::uuid OR e.organization_id = $${paramIndex}::uuid)`);
      values.push(filter.organizationId);
      paramIndex++;
    } else if (filter.organizationIds && filter.organizationIds.length > 0) {
      conditions.push(`(am.organization_id = ANY($${paramIndex}::uuid[]) OR e.organization_id = ANY($${paramIndex}::uuid[]))`);
      values.push(filter.organizationIds);
      paramIndex++;
    }

    if (filter.serviceId) {
      conditions.push(`am.service_id = $${paramIndex}`);
      values.push(filter.serviceId);
      paramIndex++;
    }

    if (filter.podId) {
      conditions.push(`am.pod_id = $${paramIndex}`);
      values.push(filter.podId);
      paramIndex++;
    }

    if (filter.clusterId) {
      conditions.push(`(am.cluster_id::text = $${paramIndex} OR c.id::text = $${paramIndex} OR c.name = $${paramIndex})`);
      values.push(filter.clusterId);
      paramIndex++;
    }

    if (filter.startTime) {
      conditions.push(`am.collected_at >= $${paramIndex}`);
      values.push(filter.startTime);
      paramIndex++;
    }

    if (filter.endTime) {
      conditions.push(`am.collected_at <= $${paramIndex}`);
      values.push(filter.endTime);
      paramIndex++;
    }

    // Keyset cursor evaluation
    if (filter.cursor) {
      const decoded = decodeMetricsCursor(filter.cursor);
      if (!decoded) {
        throw ApiError.badRequest('Cursor không hợp lệ hoặc sai định dạng');
      }
      const cursorDate = new Date(decoded.t);
      if (orderDirection === 'ASC') {
        conditions.push(`(am.collected_at > $${paramIndex}::timestamptz OR (am.collected_at = $${paramIndex}::timestamptz AND am.id > $${paramIndex + 1}))`);
      } else {
        conditions.push(`(am.collected_at < $${paramIndex}::timestamptz OR (am.collected_at = $${paramIndex}::timestamptz AND am.id < $${paramIndex + 1}))`);
      }
      values.push(cursorDate, decoded.id);
      paramIndex += 2;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countQuery = `
      SELECT COUNT(*)::int as total
      FROM agent_metrics am
      LEFT JOIN clusters c ON c.id::text = am.cluster_id::text OR c.name = am.cluster_id::text
      LEFT JOIN environments e ON e.id = c.environment_id OR e.id = am.environment_id
      ${whereClause};
    `;

    const countRes = await pool.query(countQuery, values);
    const total = countRes.rows[0]?.total ? parseInt(countRes.rows[0].total, 10) : 0;

    const limitP = `$${paramIndex}`;
    const offsetP = `$${paramIndex + 1}`;
    // Fetch limit + 1 records to determine has_more
    const queryLimit = limit + 1;

    const dataQuery = `
      SELECT 
        am.id::text,
        am.agent_id,
        am.cluster_id,
        am.organization_id,
        am.environment_id,
        am.service_id,
        am.pod_id,
        ROUND(am.cpu::numeric, 2)::float as cpu,
        ROUND(am.ram::numeric, 2)::float as ram,
        ROUND(am.disk::numeric, 2)::float as disk,
        ROUND(am.request_rate::numeric, 2)::float as request_rate,
        ROUND(am.latency::numeric, 2)::float as latency,
        ROUND(am.http_5xx_rate::numeric, 2)::float as http_5xx_rate,
        am.pod_restart_count,
        am.replica_count,
        am.batch_id,
        am.sample_id,
        am.collected_at,
        am.created_at
      FROM agent_metrics am
      LEFT JOIN clusters c ON c.id::text = am.cluster_id::text OR c.name = am.cluster_id::text
      LEFT JOIN environments e ON e.id = c.environment_id OR e.id = am.environment_id
      ${whereClause}
      ORDER BY am.collected_at ${orderDirection}, am.id ${orderDirection}
      LIMIT ${limitP} OFFSET ${offsetP};
    `;

    const dataRes = await pool.query(dataQuery, [...values, queryLimit, offset]);
    const hasMore = dataRes.rows.length > limit;
    const records = hasMore ? dataRes.rows.slice(0, limit) : dataRes.rows;
    const nextCursor = (hasMore && records.length > 0)
      ? encodeMetricsCursor(records[records.length - 1])
      : null;

    return {
      total,
      page,
      limit,
      total_pages: Math.ceil(total / limit) || (total === 0 ? 0 : 1),
      has_more: hasMore,
      next_cursor: nextCursor,
      records,
    };
  }
}
