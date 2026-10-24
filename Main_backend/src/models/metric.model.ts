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

export class MetricModel {
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
