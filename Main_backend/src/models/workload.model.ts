import { PoolClient } from 'pg';
import { pool } from '../config/database';

export interface IWorkloadInfo {
  id: string;
  cluster_id?: string | null;
  namespace_id?: string | null;
}

export class WorkloadModel {
  /**
   * Find or create workload by service name, automatically associating namespace_id if provided
   */
  public static async findOrCreateByName(
    name: string,
    clusterId?: string | null,
    client?: PoolClient,
    namespaceId?: string | null
  ): Promise<IWorkloadInfo> {
    const existing = await this.findByName(name, client, clusterId);
    if (existing) {
      if (namespaceId && !existing.namespace_id) {
        const db = client || pool;
        try {
          await db.query('UPDATE workloads SET namespace_id = $1, updated_at = NOW() WHERE id = $2', [
            namespaceId,
            existing.id,
          ]);
          existing.namespace_id = namespaceId;
        } catch {
          // Ignore update error
        }
      }
      return existing;
    }

    const db = client || pool;
    try {
      const res = await db.query(
        `INSERT INTO workloads (name, cluster_id, namespace_id, workload_type, status)
         VALUES ($1, $2, $3, 'Deployment', 'HEALTHY')
         RETURNING id, cluster_id, namespace_id`,
        [name, clusterId || null, namespaceId || null]
      );
      return res.rows[0];
    } catch {
      const retry = await this.findByName(name, client, clusterId);
      if (retry) {
        if (namespaceId && !retry.namespace_id) {
          try {
            await db.query('UPDATE workloads SET namespace_id = $1, updated_at = NOW() WHERE id = $2', [
              namespaceId,
              retry.id,
            ]);
            retry.namespace_id = namespaceId;
          } catch {}
        }
        return retry;
      }
      return { id: name, cluster_id: clusterId || null, namespace_id: namespaceId || null };
    }
  }

  /**
   * Find workload by service name, optionally filtered by cluster
   */
  public static async findByName(
    name: string,
    client?: PoolClient,
    clusterId?: string | null
  ): Promise<IWorkloadInfo | null> {
    const db = client || pool;
    try {
      if (clusterId) {
        const res = await db.query(
          `SELECT id, cluster_id, namespace_id FROM workloads 
           WHERE name = $1 AND (cluster_id = $2 OR cluster_id IN (SELECT id::text FROM clusters WHERE id::text = $2 OR cluster_uid = $2 OR name = $2))
           LIMIT 1`,
          [name, clusterId]
        );
        if (res.rows.length > 0) return res.rows[0];
      }
      const res = await db.query(
        'SELECT id, cluster_id, namespace_id FROM workloads WHERE name = $1 LIMIT 1',
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
