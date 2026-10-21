import { pool } from '../config/database';

export interface IKubernetesEvent {
  id?: string | number;
  cluster_id: string | null;
  namespace_id?: string | null;
  resource_type: string;
  resource_uid: string;
  event_type: string;
  reason: string;
  message: string;
  source_component?: string;
  first_seen_at: Date;
  last_seen_at: Date;
  count?: number;
  metadata?: Record<string, unknown>;
}

export class KubernetesEventModel {
  /**
   * Insert raw K8s event record
   */
  public static async create(event: IKubernetesEvent): Promise<{ id: string | number }> {
    const query = `
      INSERT INTO kubernetes_events (
        cluster_id, resource_type, resource_uid, event_type, reason, message,
        source_component, first_seen_at, last_seen_at, count, metadata
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
      ) RETURNING id;
    `;

    const res = await pool.query(query, [
      event.cluster_id,
      event.resource_type || 'Pod',
      event.resource_uid,
      event.event_type,
      event.reason,
      event.message,
      event.source_component || 'k8s-agent',
      event.first_seen_at,
      event.last_seen_at,
      event.count || 1,
      event.metadata ? JSON.stringify(event.metadata) : null,
    ]);

    return { id: res.rows[0].id };
  }

  /**
   * Query Warning/Incident K8s events for RCA context
   */
  public static async findWarningEventsByService(
    serviceId: string,
    windowMinutes: number = 30,
    limit: number = 20
  ): Promise<
    Array<{
      event_type: string;
      reason: string;
      message: string;
      first_seen_at: Date;
      last_seen_at: Date;
      count: number;
      pod_name?: string;
    }>
  > {
    const query = `
      SELECT 
        event_type,
        reason,
        message,
        first_seen_at,
        last_seen_at,
        count,
        metadata->>'pod_name' as pod_name
      FROM kubernetes_events
      WHERE metadata->>'service_id' = $1
        AND (last_seen_at >= NOW() - ($2 || ' minutes')::interval OR first_seen_at >= NOW() - ($2 || ' minutes')::interval)
        AND (
          UPPER(event_type) IN ('WARNING', 'ERROR')
          OR reason ~* '(OOM|BackOff|Failed|Unhealthy|Evicted|Killing|Crash)'
        )
      ORDER BY last_seen_at DESC
      LIMIT $3;
    `;

    let res = await pool.query(query, [serviceId, windowMinutes, limit]);

    // Fallback: fetch recent events without time filter if empty
    if (res.rows.length === 0) {
      const fallbackQuery = `
        SELECT 
          event_type,
          reason,
          message,
          first_seen_at,
          last_seen_at,
          count,
          metadata->>'pod_name' as pod_name
        FROM kubernetes_events
        WHERE metadata->>'service_id' = $1
        ORDER BY last_seen_at DESC
        LIMIT $2;
      `;
      res = await pool.query(fallbackQuery, [serviceId, limit]);
    }

    return res.rows;
  }

  /**
   * Optional: update pod status in pods table
   */
  public static async updatePodStatus(
    podName: string,
    kubernetesUid: string,
    clusterId: string | null,
    status: string
  ): Promise<void> {
    try {
      await pool.query(
        `UPDATE pods
         SET status = $1, updated_at = NOW()
         WHERE (name = $2 OR kubernetes_uid = $3)
           AND cluster_id = $4`,
        [status, podName, kubernetesUid, clusterId]
      );
    } catch {
      // Non-critical
    }
  }

  /**
   * Get recent Kubernetes events
   */
  public static async getRecent(limit: number = 20) {
    const res = await pool.query(
      `SELECT id, event_type, reason, message, first_seen_at, last_seen_at, count, metadata
       FROM kubernetes_events
       ORDER BY last_seen_at DESC
       LIMIT $1`,
      [limit]
    );
    return res.rows;
  }
}
