import { PoolClient } from 'pg';
import { pool } from '../config/database';

export interface IEnvironment {
  id: string;
  organization_id: string;
  name: string;
  type?: string | null;
}

export class EnvironmentModel {
  /**
   * Find first available environment
   */
  public static async findFirst(client?: PoolClient): Promise<IEnvironment | null> {
    const db = client || pool;
    try {
      const res = await db.query<IEnvironment>(
        'SELECT id, organization_id, name FROM environments LIMIT 1'
      );
      return res.rows[0] || null;
    } catch {
      return null;
    }
  }

  /**
   * Find environment by ID or Name
   */
  public static async findByIdOrName(
    idOrName: string,
    client?: PoolClient
  ): Promise<IEnvironment | null> {
    const db = client || pool;
    try {
      const res = await db.query<IEnvironment>(
        'SELECT id, organization_id, name FROM environments WHERE id::text = $1 OR name = $1 LIMIT 1',
        [idOrName]
      );
      return res.rows[0] || null;
    } catch {
      return null;
    }
  }
}
