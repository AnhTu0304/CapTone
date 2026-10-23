import { PoolClient } from 'pg';
import { pool } from '../config/database';

export class WorkloadModel {
  /**
   * Find workload by service name, optionally filtered by cluster
   */
  public static async findByName(
    name: string,
    client?: PoolClient,
    clusterId?: string | null
  ): Promise<{ id: string; cluster_id?: string | null } | null> {
    const db = client || pool;
    try {
      if (clusterId) {
        const res = await db.query(
          `SELECT id, cluster_id FROM workloads 
           WHERE name = $1 AND (cluster_id = $2 OR cluster_id IN (SELECT name FROM clusters WHERE id::text = $2 OR cluster_uid = $2) OR cluster_id IN (SELECT id::text FROM clusters WHERE name = $2))
           LIMIT 1`,
          [name, clusterId]
        );
        if (res.rows.length > 0) return res.rows[0];
      }
      const res = await db.query(
        'SELECT id, cluster_id FROM workloads WHERE name = $1 LIMIT 1',
        [name]
      );
      return res.rows[0] || null;
    } catch {
      return null;
    }
  }

  /**
   * Find cluster ID of a workload
   */
  public static async findClusterId(
    workloadId: string,
    client?: PoolClient
  ): Promise<string | null> {
    const db = client || pool;
    try {
      const res = await db.query(
        'SELECT cluster_id FROM workloads WHERE id = $1 LIMIT 1',
        [workloadId]
      );
      return res.rows[0]?.cluster_id || null;
    } catch {
      return null;
    }
  }
}
