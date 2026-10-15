import { PoolClient } from 'pg';
import { pool } from '../config/database';

export class WorkloadModel {
  /**
   * Find workload by service name
   */
  public static async findByName(
    name: string,
    client?: PoolClient
  ): Promise<{ id: string; cluster_id?: string | null } | null> {
    const db = client || pool;
    try {
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
