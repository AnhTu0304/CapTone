import { PoolClient } from 'pg';
import { pool } from '../config/database';

export interface IAlertEventHistory {
  id: string;
  alert_event_id: string;
  old_status?: string | null;
  new_status: string;
  action: 'TRIGGERED' | 'UPDATED' | 'ESCALATED' | 'ACKNOWLEDGED' | 'RESOLVED' | 'AUTO_RESOLVED' | 'REOPENED';
  actor_id?: string | null;
  actor_type: 'SYSTEM' | 'USER' | 'AGENT';
  note?: string | null;
  metadata?: Record<string, any>;
  created_at: Date;
  // Joined fields
  actor_name?: string | null;
  actor_email?: string | null;
}

export interface ICreateAlertHistoryInput {
  alert_event_id: string;
  old_status?: string | null;
  new_status: string;
  action: 'TRIGGERED' | 'UPDATED' | 'ESCALATED' | 'ACKNOWLEDGED' | 'RESOLVED' | 'AUTO_RESOLVED' | 'REOPENED';
  actor_id?: string | null;
  actor_type?: 'SYSTEM' | 'USER' | 'AGENT';
  note?: string | null;
  metadata?: Record<string, any>;
  created_at?: Date;
}

export class AlertEventHistoryModel {
  /**
   * Create a new history timeline entry
   */
  public static async createEntry(
    data: ICreateAlertHistoryInput,
    client?: PoolClient
  ): Promise<IAlertEventHistory> {
    const db = client || pool;
    const query = `
      INSERT INTO alert_event_history (
        alert_event_id, old_status, new_status, action,
        actor_id, actor_type, note, metadata, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9, NOW()))
      RETURNING *;
    `;
    const params = [
      data.alert_event_id,
      data.old_status || null,
      data.new_status,
      data.action,
      data.actor_id || null,
      data.actor_type || 'SYSTEM',
      data.note || null,
      JSON.stringify(data.metadata || {}),
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
      actor_name: r.actor_type === 'SYSTEM' ? 'Rule Engine (Hệ thống)' : r.actor_name || (r.actor_id ? `User ${r.actor_id.slice(0, 8)}` : 'Hệ thống'),
    }));
  }
}
