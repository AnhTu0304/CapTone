import { pool } from '../config/database';
import { GRUMetricPoint } from '../schemas/ai.schema';

export interface IAgentMetric {
  id?: string | number;
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

export interface INodeMetric {
  id?: string | number;
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

export class MetricModel {
  private static nodeTableEnsured = false;

  public static async ensureNodeMetricsTable(): Promise<void> {
    if (this.nodeTableEnsured) return;
    await pool.query(`
      CREATE TABLE IF NOT EXISTS node_metrics (
        id BIGSERIAL PRIMARY KEY,
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
      CREATE INDEX IF NOT EXISTS idx_node_metrics_agent_time ON node_metrics(agent_id, collected_at DESC);
      CREATE INDEX IF NOT EXISTS idx_node_metrics_node_time ON node_metrics(node_name, collected_at DESC);
      CREATE INDEX IF NOT EXISTS idx_node_metrics_cluster_time ON node_metrics(cluster_id, collected_at DESC);
      CREATE INDEX IF NOT EXISTS idx_node_metrics_collected_at ON node_metrics(collected_at DESC);
    `);
    this.nodeTableEnsured = true;
  }

  /**
   * Insert host/node resource metric snapshot (Task 4.1)
   */
  public static async createNodeMetric(metric: INodeMetric): Promise<{ id: string | number }> {
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
        agent_id, cluster_id, node_id, node_name,
        cpu_usage_percent, cpu_cores,
        ram_total_bytes, ram_used_bytes, ram_available_bytes, ram_usage_percent,
        disk_total_bytes, disk_used_bytes, disk_available_bytes, disk_usage_percent, disk_filesystems,
        net_rx_bytes, net_tx_bytes, net_rx_bytes_per_sec, net_tx_bytes_per_sec, net_interfaces,
        collection_status, collection_errors, metadata, collected_at, created_at
      ) VALUES (
        $1, $2, $3, $4,
        $5, $6,
        $7, $8, $9, $10,
        $11, $12, $13, $14, $15::jsonb,
        $16, $17, $18, $19, $20::jsonb,
        $21, $22::jsonb, $23::jsonb, $24, NOW()
      ) RETURNING id;
    `;

    const res = await pool.query(query, [
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

    return { id: res.rows[0].id };
  }

  /**
   * Query node metrics by agent_id, cluster_id, node_name/node_id, and time range [startTime, endTime]
   */
  public static async queryNodeMetrics(filter: {
    agentId?: string;
    clusterId?: string;
    nodeId?: string;
    nodeName?: string;
    startTime?: Date;
    endTime?: Date;
    limit?: number;
  }) {
    await this.ensureNodeMetricsTable();

    const conditions: string[] = ['1=1'];
    const params: any[] = [];

    if (filter.agentId) {
      params.push(filter.agentId);
      conditions.push(`agent_id = $${params.length}`);
    }
    if (filter.clusterId) {
      params.push(filter.clusterId);
      conditions.push(`cluster_id = $${params.length}`);
    }
    if (filter.nodeId) {
      params.push(filter.nodeId);
      conditions.push(`(node_id::text = $${params.length} OR node_name = $${params.length})`);
    }
    if (filter.nodeName) {
      params.push(filter.nodeName);
      conditions.push(`node_name = $${params.length}`);
    }
    if (filter.startTime && !isNaN(filter.startTime.getTime())) {
      params.push(filter.startTime);
      conditions.push(`collected_at >= $${params.length}`);
    }
    if (filter.endTime && !isNaN(filter.endTime.getTime())) {
      params.push(filter.endTime);
      conditions.push(`collected_at <= $${params.length}`);
    }

    const safeLimit = Math.min(500, Math.max(1, filter.limit || 50));
    params.push(safeLimit);

    const query = `
      SELECT
        id, agent_id, cluster_id, node_id, node_name,
        cpu_usage_percent::float AS cpu_usage_percent,
        cpu_cores::int AS cpu_cores,
        ram_total_bytes::bigint AS ram_total_bytes,
        ram_used_bytes::bigint AS ram_used_bytes,
        ram_available_bytes::bigint AS ram_available_bytes,
        ram_usage_percent::float AS ram_usage_percent,
        disk_total_bytes::bigint AS disk_total_bytes,
        disk_used_bytes::bigint AS disk_used_bytes,
        disk_available_bytes::bigint AS disk_available_bytes,
        disk_usage_percent::float AS disk_usage_percent,
        disk_filesystems,
        net_rx_bytes::bigint AS net_rx_bytes,
        net_tx_bytes::bigint AS net_tx_bytes,
        net_rx_bytes_per_sec::float AS net_rx_bytes_per_sec,
        net_tx_bytes_per_sec::float AS net_tx_bytes_per_sec,
        net_interfaces,
        collection_status,
        collection_errors,
        metadata,
        collected_at,
        created_at
      FROM node_metrics
      WHERE ${conditions.join(' AND ')}
      ORDER BY collected_at DESC
      LIMIT $${params.length};
    `;

    const res = await pool.query(query, params);
    return res.rows;
  }
  /**
   * Insert raw pod metric record
   */
  public static async create(metric: IAgentMetric): Promise<{ id: string | number }> {
    const query = `
      INSERT INTO agent_metrics (
        agent_id, cluster_id, service_id, pod_id,
        cpu, ram, disk, request_rate, latency, http_5xx_rate,
        pod_restart_count, replica_count, collected_at, created_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW()
      ) RETURNING id;
    `;

    const res = await pool.query(query, [
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

    return { id: res.rows[0].id };
  }

  /**
   * Aggregate metrics across pods for a service in time buckets
   * MAX(cpu, ram, disk, latency), SUM(request_rate, restarts), AVG(http_5xx_rate), MAX/COUNT(replicas)
   */
  public static async aggregateByService(
    serviceId: string,
    bucketSeconds: number = 5,
    limit: number = 12
  ): Promise<GRUMetricPoint[]> {
    const query = `
      SELECT 
        to_timestamp(floor(extract(epoch from collected_at) / $2) * $2) as time_bucket,
        ROUND(COALESCE(MAX(cpu), 0)::numeric, 2)::float as cpu,
        ROUND(COALESCE(MAX(ram), 0)::numeric, 2)::float as ram,
        ROUND(COALESCE(MAX(disk), 0)::numeric, 2)::float as disk,
        ROUND(COALESCE(SUM(request_rate), 0)::numeric, 2)::float as request_rate,
        ROUND(COALESCE(MAX(latency), 0)::numeric, 2)::float as latency,
        ROUND(COALESCE(AVG(http_5xx_rate), 0)::numeric, 2)::float as http_5xx_rate,
        COALESCE(SUM(pod_restart_count), 0)::int as pod_restart_count,
        GREATEST(COALESCE(MAX(replica_count), 1), COUNT(DISTINCT pod_id))::int as replica_count
      FROM agent_metrics
      WHERE service_id::text = $1
      GROUP BY time_bucket
      ORDER BY time_bucket DESC
      LIMIT $3;
    `;

    const res = await pool.query(query, [serviceId, bucketSeconds, limit]);

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
}
