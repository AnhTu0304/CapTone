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
      WHERE service_id = $1
      GROUP BY time_bucket
      ORDER BY time_bucket DESC
      LIMIT $3;
    `;

    const res = await pool.query(query, [serviceId, bucketSeconds, limit]);

    const points: GRUMetricPoint[] = res.rows.map((row) => ({
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
}
