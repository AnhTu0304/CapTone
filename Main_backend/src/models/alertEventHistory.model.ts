import { PoolClient } from 'pg';
import { pool } from '../config/database';

export type AlertHistoryAction =
  | 'TRIGGERED'
  | 'UPDATED'
  | 'ESCALATED'
  | 'ACKNOWLEDGED'
  | 'ASSIGNED'
  | 'REASSIGNED'
  | 'UNASSIGNED'
  | 'RESOLVED'
  | 'AUTO_RESOLVED'
  | 'REOPENED';

export interface IAlertEventHistory {
  id: string;
  alert_event_id: string;
  organization_id?: string | null;
  old_status?: string | null;
  new_status: string;
  action: AlertHistoryAction;
  actor_id?: string | null;
  actor_type: 'SYSTEM' | 'USER' | 'AGENT';
  note?: string | null;
  metadata?: Record<string, any>;
  old_value?: Record<string, any>;
  new_value?: Record<string, any>;
  created_at: Date;
  // Joined fields
  actor_name?: string | null;
  actor_email?: string | null;
}

export interface ICreateAlertHistoryInput {
  alert_event_id: string;
  organization_id?: string | null;
  old_status?: string | null;
  new_status: string;
  action: AlertHistoryAction;
  actor_id?: string | null;
  actor_type?: 'SYSTEM' | 'USER' | 'AGENT';
  note?: string | null;
  metadata?: Record<string, any>;
  old_value?: Record<string, any>;
  new_value?: Record<string, any>;
  created_at?: Date;
}

export class AlertEventHistoryModel {
  /**
   * Create a new history / audit trail entry
   */
  public static async createEntry(
    data: ICreateAlertHistoryInput,
    client?: PoolClient
  ): Promise<IAlertEventHistory> {
    const db = client || pool;
    const query = `
      INSERT INTO alert_event_history (
        alert_event_id, organization_id, old_status, new_status, action,
        actor_id, actor_type, note, metadata, old_value, new_value, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, COALESCE($12, NOW()))
      RETURNING *;
    `;
    const params = [
      data.alert_event_id,
      data.organization_id || null,
      data.old_status || null,
      data.new_status,
      data.action,
      data.actor_id || null,
      data.actor_type || 'SYSTEM',
      data.note || null,
      JSON.stringify(data.metadata || {}),
      JSON.stringify(data.old_value || {}),
      JSON.stringify(data.new_value || {}),
      data.created_at || null,
    ];

    const res = await db.query(query, params);
    return res.rows[0];
  }

  /**
   * Find timeline of an alert event ordered chronologically
   */
  public static async findByAlertEventId(
    alertEventId: string,
    client?: PoolClient
  ): Promise<IAlertEventHistory[]> {
    const db = client || pool;
    const query = `
      SELECT 
        aeh.*,
        u.full_name AS actor_name,
        u.email AS actor_email
      FROM alert_event_history aeh
      LEFT JOIN users u ON aeh.actor_id = u.id
      WHERE aeh.alert_event_id = $1
      ORDER BY aeh.created_at ASC;
    `;
    const res = await db.query(query, [alertEventId]);
    return res.rows.map((r) => ({
      ...r,
      metadata: typeof r.metadata === 'object' && r.metadata !== null ? r.metadata : {},
      old_value: typeof r.old_value === 'object' && r.old_value !== null ? r.old_value : {},
      new_value: typeof r.new_value === 'object' && r.new_value !== null ? r.new_value : {},
      actor_name:
        r.actor_type === 'SYSTEM'
          ? 'Rule Engine (Hệ thống)'
          : r.actor_name || (r.actor_id ? `User ${r.actor_id.slice(0, 8)}` : 'Hệ thống'),
    }));
  }

  /**
   * Get paginated audit trail for an alert event with actor info and state diffs [S5][PBI22 Task 4.3]
   */
  public static async getAuditTrail(
    alertEventId: string,
    options: { page?: number; limit?: number; order?: string } = {},
    client?: PoolClient
  ): Promise<{
    items: IAlertEventHistory[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      total_pages: number;
    };
  }> {
    const db = client || pool;
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 20));
    const offset = (page - 1) * limit;
    const sortDir = String(options.order || 'asc').toLowerCase() === 'desc' ? 'DESC' : 'ASC';

    const countRes = await db.query(
      `SELECT COUNT(*)::int AS total FROM alert_event_history WHERE alert_event_id = $1`,
      [alertEventId]
    );
    const total = countRes.rows[0]?.total || 0;
    const totalPages = Math.ceil(total / limit) || 1;

    const query = `
      SELECT 
        aeh.*,
        u.full_name AS actor_name,
        u.email AS actor_email
      FROM alert_event_history aeh
      LEFT JOIN users u ON aeh.actor_id = u.id
      WHERE aeh.alert_event_id = $1
      ORDER BY aeh.created_at ${sortDir}
      LIMIT $2 OFFSET $3;
    `;
    const res = await db.query(query, [alertEventId, limit, offset]);

    const items = res.rows.map((r) => ({
      ...r,
      metadata: typeof r.metadata === 'object' && r.metadata !== null ? r.metadata : {},
      old_value: typeof r.old_value === 'object' && r.old_value !== null ? r.old_value : {},
      new_value: typeof r.new_value === 'object' && r.new_value !== null ? r.new_value : {},
      actor_name:
        r.actor_type === 'SYSTEM'
          ? 'Rule Engine (Hệ thống)'
          : r.actor_name || (r.actor_id ? `User ${r.actor_id.slice(0, 8)}` : 'Hệ thống'),
    }));

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        total_pages: totalPages,
      },
    };
  }
}
