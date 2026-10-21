import { PoolClient } from 'pg';
import { pool } from '../config/database';

export interface ICluster {
  id: string;
  environment_id: string;
  name: string;
  provider?: string | null;
  status?: string | null;
}

export class ClusterModel {
  /**
   * Find first available cluster
   */
  public static async findFirst(client?: PoolClient): Promise<ICluster | null> {
    const db = client || pool;
    try {
      const res = await db.query<ICluster>('SELECT id, environment_id, name FROM clusters LIMIT 1');
      return res.rows[0] || null;
    } catch {
      return null;
    }
  }

  /**
   * Find cluster by ID or Name
   */
  public static async findByIdOrName(
    idOrName: string,
    client?: PoolClient
  ): Promise<ICluster | null> {
    const db = client || pool;
    try {
      const res = await db.query<ICluster>(
        'SELECT id, environment_id, name FROM clusters WHERE id::text = $1 OR name = $1 LIMIT 1',
        [idOrName]
      );
      return res.rows[0] || null;
    } catch {
      return null;
    }
  }
}
