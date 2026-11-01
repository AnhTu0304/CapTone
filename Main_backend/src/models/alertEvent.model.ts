import { PoolClient } from 'pg';
import { pool } from '../config/database';
import { AlertEventCategory, AlertEventStatus } from '../schemas/alertEvent.schema';
import { AlertSeverity } from '../schemas/alertRule.schema';
import { AlertHistoryQuery } from '../schemas/alertHistory.schema';

export function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '0s';
  const sec = Math.floor(seconds);
  if (sec < 60) return `${sec}s`;
  const mins = Math.floor(sec / 60);
  const remSec = sec % 60;
  if (mins < 60) return remSec > 0 ? `${mins}m ${remSec}s` : `${mins}m`;
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  if (hours < 24) return remMins > 0 ? `${hours}h ${remMins}m` : `${hours}h`;
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return remHours > 0 ? `${days}d ${remHours}h` : `${days}d`;
}

export interface IAlertEvent {
  id: string;
  organization_id: string;
  cluster_id?: string | null;
  rule_id?: string | null;
  rule_name: string;
  title?: string;
  category: AlertEventCategory;
  metric_type: string;
  resource_type: string;
  resource_id: string;
  namespace?: string | null;
  severity: AlertSeverity;
  status: AlertEventStatus;
  observed_value?: number | null;
  threshold_value?: number | null;
  unit?: string | null;
  message: string;
  details?: Record<string, any>;
  occurrence_count: number;
  fingerprint?: string | null;
  first_detected_at: Date;
  first_occurred_at?: Date;
  last_seen_at: Date;
  resolved_at?: Date | null;
  resolved_by?: string | null;
  acknowledged_at?: Date | null;
  acknowledged_by?: string | null;
  created_at: Date;
  updated_at: Date;
  // Joined fields
  cluster_name?: string | null;
  organization_name?: string | null;
  rule_description?: string | null;
  rule_operator?: string | null;
  rule_evaluation_window?: string | null;
  rule_duration?: number | null;
  rule_cooldown_seconds?: number | null;
  acknowledger_name?: string | null;
  acknowledger_email?: string | null;
  resolver_name?: string | null;
  resolver_email?: string | null;
  duration_seconds?: number;
  duration_formatted?: string;
  // Aliases for Frontend compatibility
  metric_value?: number | null;
  threshold?: number | null;
  resource_name?: string | null;
}

export interface IAlertEventFilters {
  page?: number;
  limit?: number;
  search?: string;
  category?: AlertEventCategory;
  status?: AlertEventStatus;
  severity?: AlertSeverity;
  metric_type?: string;
  resource_type?: string;
  resource_id?: string;
  cluster_id?: string;
  rule_id?: string;
  start_time?: string;
  end_time?: string;
  sort_by?: string;
  order?: 'asc' | 'desc';
}

export interface IPaginatedAlertEvents {
  items: IAlertEvent[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}

export class AlertEventModel {
  /**
   * Format raw SQL row to typed IAlertEvent
   */
  private static formatRow(row: any): IAlertEvent {
    const observedValue = row.observed_value !== null ? Number(row.observed_value) : null;
    const thresholdValue = row.threshold_value !== null ? Number(row.threshold_value) : null;
    return {
      ...row,
      observed_value: observedValue,
      threshold_value: thresholdValue,
      metric_value: observedValue,
      threshold: thresholdValue,
      resource_name: row.resource_id || row.details?.resource_name || null,
      details: typeof row.details === 'object' && row.details !== null ? row.details : {},
      occurrence_count:
        row.occurrence_count !== null && row.occurrence_count !== undefined
          ? Number(row.occurrence_count)
          : 1,
      fingerprint: row.fingerprint || null,
      title: row.rule_name || row.message,
      first_occurred_at: row.first_detected_at ? new Date(row.first_detected_at) : new Date(row.created_at),
      namespace: row.namespace || row.details?.namespace || null,
      duration_seconds: Math.max(
        0,
        Math.round(
          ((row.resolved_at ? new Date(row.resolved_at).getTime() : Date.now()) -
            (row.first_detected_at ? new Date(row.first_detected_at).getTime() : new Date(row.created_at).getTime())) /
            1000
        )
      ),
      duration_formatted: formatDuration(
        Math.max(
          0,
          Math.round(
            ((row.resolved_at ? new Date(row.resolved_at).getTime() : Date.now()) -
              (row.first_detected_at ? new Date(row.first_detected_at).getTime() : new Date(row.created_at).getTime())) /
              1000
          )
        )
      ),
    };
  }

  /**
   * Create or update open alert event (Deduplication)
   * If an active/acknowledged alert event already exists for this rule & resource, update last_seen_at, observed_value & increment occurrence_count.
   * If none exists, insert a new active event.
   */
  public static async createOrUpdateOpenEvent(
    data: {
      organization_id: string;
      cluster_id?: string | null;
      rule_id?: string | null;
      rule_name: string;
  title?: string;
      category: AlertEventCategory;
      metric_type: string;
      resource_type: string;
      resource_id: string;
  namespace?: string | null;
      severity: AlertSeverity;
      observed_value?: number | null;
      threshold_value?: number | null;
      unit?: string | null;
      message: string;
      details?: Record<string, any>;
      fingerprint?: string | null;
    },
    client?: PoolClient
  ): Promise<{ event: IAlertEvent; isNew: boolean }> {
    const db = client || pool;

    // First check if an open event already exists
    const findQuery = `
      SELECT id, first_detected_at, last_seen_at, status, occurrence_count
      FROM alert_events
      WHERE organization_id = $1
        AND COALESCE(cluster_id, '00000000-0000-0000-0000-000000000000'::uuid) = COALESCE($2, '00000000-0000-0000-0000-000000000000'::uuid)
        AND COALESCE(rule_id, '00000000-0000-0000-0000-000000000000'::uuid) = COALESCE($3, '00000000-0000-0000-0000-000000000000'::uuid)
        AND resource_type = $4
        AND resource_id = $5
        AND metric_type = $6
        AND status != 'RESOLVED'
      LIMIT 1
      FOR UPDATE;
    `;

    const existingRes = await db.query(findQuery, [
      data.organization_id,
      data.cluster_id || null,
      data.rule_id || null,
      data.resource_type,
      data.resource_id,
      data.metric_type,
    ]);

    if (existingRes.rows.length > 0) {
      const existingId = existingRes.rows[0].id;
      const updateQuery = `
        UPDATE alert_events
        SET last_seen_at = NOW(),
            observed_value = $1,
            threshold_value = $2,
            message = $3,
            details = $4,
            occurrence_count = occurrence_count + 1,
            updated_at = NOW()
        WHERE id = $5
        RETURNING *;
      `;
      const updateRes = await db.query(updateQuery, [
        data.observed_value ?? null,
        data.threshold_value ?? null,
        data.message,
        JSON.stringify(data.details || {}),
        existingId,
      ]);
      return { event: this.formatRow(updateRes.rows[0]), isNew: false };
    }

    // Insert new event with partial unique conflict fallback
    const insertQuery = `
      INSERT INTO alert_events (
        organization_id,
        cluster_id,
        rule_id,
        rule_name,
        category,
        metric_type,
        resource_type,
        resource_id,
        severity,
        status,
        observed_value,
        threshold_value,
        unit,
        message,
        details,
        fingerprint,
        occurrence_count,
        first_detected_at,
        last_seen_at,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'ACTIVE', $10, $11, $12, $13, $14, $15, 1, NOW(), NOW(), NOW(), NOW())
      ON CONFLICT (
        organization_id,
        COALESCE(cluster_id, '00000000-0000-0000-0000-000000000000'::uuid),
        COALESCE(rule_id, '00000000-0000-0000-0000-000000000000'::uuid),
        resource_type,
        resource_id,
        metric_type
      ) WHERE status != 'RESOLVED'
      DO UPDATE SET
        last_seen_at = NOW(),
        observed_value = EXCLUDED.observed_value,
        threshold_value = EXCLUDED.threshold_value,
        message = EXCLUDED.message,
        details = EXCLUDED.details,
        occurrence_count = alert_events.occurrence_count + 1,
        updated_at = NOW()
      RETURNING *;
    `;

    const insertParams = [
      data.organization_id,
      data.cluster_id || null,
      data.rule_id || null,
      data.rule_name,
      data.category,
      data.metric_type,
      data.resource_type,
      data.resource_id,
      data.severity,
      data.observed_value ?? null,
      data.threshold_value ?? null,
      data.unit || null,
      data.message,
      JSON.stringify(data.details || {}),
      data.fingerprint || null,
    ];

    const insertRes = await db.query(insertQuery, insertParams);
    const row = insertRes.rows[0];
    const isNew = Math.abs(new Date(row.created_at).getTime() - new Date(row.updated_at).getTime()) < 1000;
    return { event: this.formatRow(row), isNew };
  }

  /**
   * Auto-resolve an open alert event when metrics/state return to normal
   */
  public static async resolveOpenEvent(
    data: {
      organization_id: string;
      cluster_id?: string | null;
      rule_id?: string | null;
      resource_type: string;
      resource_id: string;
  namespace?: string | null;
      metric_type: string;
      resolution_details?: Record<string, any>;
    },
    client?: PoolClient
  ): Promise<IAlertEvent | null> {
    const db = client || pool;
    const query = `
      UPDATE alert_events
      SET status = 'RESOLVED',
          resolved_at = NOW(),
          updated_at = NOW(),
          details = details || $7::jsonb
      WHERE organization_id = $1
        AND COALESCE(cluster_id, '00000000-0000-0000-0000-000000000000'::uuid) = COALESCE($2, '00000000-0000-0000-0000-000000000000'::uuid)
        AND COALESCE(rule_id, '00000000-0000-0000-0000-000000000000'::uuid) = COALESCE($3, '00000000-0000-0000-0000-000000000000'::uuid)
        AND resource_type = $4
        AND resource_id = $5
        AND metric_type = $6
        AND status != 'RESOLVED'
      RETURNING *;
    `;
    const params = [
      data.organization_id,
      data.cluster_id || null,
      data.rule_id || null,
      data.resource_type,
      data.resource_id,
      data.metric_type,
      JSON.stringify(data.resolution_details || { resolved_by: 'RULE_ENGINE_AUTO' }),
    ];

    const res = await db.query(query, params);
    if (res.rows.length === 0) return null;
    return this.formatRow(res.rows[0]);
  }

  /**
   * Find alert event by ID with tenant guard
   */
  public static async findById(
    id: string,
    organizationId?: string,
    client?: PoolClient
  ): Promise<IAlertEvent | null> {
    const db = client || pool;
    let query = `
      SELECT 
        ae.*,
        c.name AS cluster_name,
        o.name AS organization_name,
        ar.description AS rule_description,
        ar.operator AS rule_operator,
        ar.evaluation_window AS rule_evaluation_window,
        ar.duration AS rule_duration,
        ar.cooldown_seconds AS rule_cooldown_seconds,
        u.full_name AS acknowledger_name,
        u.email AS acknowledger_email,
        ur.full_name AS resolver_name,
        ur.email AS resolver_email
      FROM alert_events ae
      LEFT JOIN clusters c ON ae.cluster_id = c.id
      LEFT JOIN organizations o ON ae.organization_id = o.id
      LEFT JOIN alert_rules ar ON ae.rule_id = ar.id
      LEFT JOIN users u ON ae.acknowledged_by = u.id
      LEFT JOIN users ur ON ae.resolved_by = ur.id
      WHERE ae.id = $1
    `;
    const params: any[] = [id];

    if (organizationId) {
      query += ' AND ae.organization_id = $2';
      params.push(organizationId);
    }

    const res = await db.query(query, params);
    if (res.rows.length === 0) return null;
    return this.formatRow(res.rows[0]);
  }

  /**
   * Find paginated alert events with filters
   */
  public static async findByOrg(
    organizationId: string,
    filters: IAlertEventFilters = {},
    client?: PoolClient
  ): Promise<IPaginatedAlertEvents> {
    const db = client || pool;
    const page = Math.max(1, filters.page || 1);
    const limit = Math.min(100, Math.max(1, filters.limit || 20));
    const offset = (page - 1) * limit;

    const conditions: string[] = ['ae.organization_id = $1'];
    const params: any[] = [organizationId];
    let paramIndex = 2;

    if (filters.cluster_id) {
      if (filters.cluster_id === 'null' || filters.cluster_id === 'org_wide') {
        conditions.push('ae.cluster_id IS NULL');
      } else {
        conditions.push(`ae.cluster_id = $${paramIndex++}`);
        params.push(filters.cluster_id);
      }
    }

    if (filters.rule_id) {
      conditions.push(`ae.rule_id = $${paramIndex++}`);
      params.push(filters.rule_id);
    }

    if (filters.category) {
      conditions.push(`ae.category = $${paramIndex++}`);
      params.push(filters.category);
    }

    if (filters.status) {
      conditions.push(`ae.status = $${paramIndex++}`);
      params.push(filters.status);
    }

    if (filters.severity) {
      conditions.push(`ae.severity = $${paramIndex++}`);
      params.push(filters.severity);
    }

    if (filters.metric_type) {
      conditions.push(`ae.metric_type = $${paramIndex++}`);
      params.push(filters.metric_type);
    }

    if (filters.resource_type) {
      conditions.push(`LOWER(ae.resource_type) = LOWER($${paramIndex++})`);
      params.push(filters.resource_type);
    }

    if (filters.resource_id) {
      conditions.push(`ae.resource_id = $${paramIndex++}`);
      params.push(filters.resource_id);
    }

    if (filters.start_time) {
      conditions.push(`ae.last_seen_at >= $${paramIndex++}`);
      params.push(new Date(filters.start_time));
    }

    if (filters.end_time) {
      conditions.push(`ae.last_seen_at <= $${paramIndex++}`);
      params.push(new Date(filters.end_time));
    }

    if (filters.search) {
      conditions.push(
        `(ae.rule_name ILIKE $${paramIndex} OR ae.message ILIKE $${paramIndex} OR ae.resource_id ILIKE $${paramIndex})`
      );
      params.push(`%${filters.search.trim()}%`);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');

    // Count total matching
    const countQuery = `SELECT COUNT(*) AS total FROM alert_events ae WHERE ${whereClause}`;
    const countRes = await db.query(countQuery, params);
    const total = parseInt(countRes.rows[0].total, 10);
    const totalPages = Math.ceil(total / limit) || 1;

    // Sorting
    const allowedSortFields: Record<string, string> = {
      first_detected_at: 'ae.first_detected_at',
      last_seen_at: 'ae.last_seen_at',
      resolved_at: 'ae.resolved_at',
      severity: 'ae.severity',
      status: 'ae.status',
      created_at: 'ae.created_at',
      occurrence_count: 'ae.occurrence_count',
    };
    const sortCol = allowedSortFields[filters.sort_by || 'last_seen_at'] || 'ae.last_seen_at';
    const sortOrder = filters.order === 'asc' ? 'ASC' : 'DESC';

    const dataQuery = `
      SELECT 
        ae.*,
        c.name AS cluster_name,
        o.name AS organization_name,
        ar.description AS rule_description,
        ar.operator AS rule_operator,
        ar.evaluation_window AS rule_evaluation_window,
        ar.duration AS rule_duration,
        ar.cooldown_seconds AS rule_cooldown_seconds,
        u.full_name AS acknowledger_name,
        u.email AS acknowledger_email,
        ur.full_name AS resolver_name,
        ur.email AS resolver_email
      FROM alert_events ae
      LEFT JOIN clusters c ON ae.cluster_id = c.id
      LEFT JOIN organizations o ON ae.organization_id = o.id
      LEFT JOIN alert_rules ar ON ae.rule_id = ar.id
      LEFT JOIN users u ON ae.acknowledged_by = u.id
      LEFT JOIN users ur ON ae.resolved_by = ur.id
      WHERE ${whereClause}
      ORDER BY ${sortCol} ${sortOrder}
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;

    const dataRes = await db.query(dataQuery, [...params, limit, offset]);

    return {
      items: dataRes.rows.map((row) => this.formatRow(row)),
      pagination: {
        page,
        limit,
        total,
        total_pages: totalPages,
      },
    };
  }

  /**
   * Acknowledge an active alert event
   */
  public static async acknowledgeEvent(
    id: string,
    organizationId: string,
    userId: string,
    note?: string,
    client?: PoolClient
  ): Promise<IAlertEvent | null> {
    const db = client || pool;
    const query = `
      UPDATE alert_events
      SET status = 'ACKNOWLEDGED',
          acknowledged_at = NOW(),
          acknowledged_by = $3,
          details = details || $4::jsonb,
          updated_at = NOW()
      WHERE id = $1 AND organization_id = $2 AND status = 'ACTIVE'
      RETURNING *;
    `;
    const detailsPatch = note ? { acknowledge_note: note } : {};
    const res = await db.query(query, [id, organizationId, userId, JSON.stringify(detailsPatch)]);
    if (res.rows.length === 0) return null;
    return this.formatRow(res.rows[0]);
  }

  /**
   * Manually resolve an alert event
   */
  public static async resolveEventById(
    id: string,
    organizationId: string,
    userId?: string,
    note?: string,
    client?: PoolClient
  ): Promise<IAlertEvent | null> {
    const db = client || pool;
    const query = `
      UPDATE alert_events
      SET status = 'RESOLVED',
          resolved_at = NOW(),
          resolved_by = $3,
          details = details || $4::jsonb,
          updated_at = NOW()
      WHERE id = $1 AND organization_id = $2 AND status != 'RESOLVED'
      RETURNING *;
    `;
    const detailsPatch = {
      resolved_by: userId ? `USER_${userId}` : 'MANUAL',
      resolution_note: note || 'Resolved by user',
    };
    const res = await db.query(query, [id, organizationId, userId || null, JSON.stringify(detailsPatch)]);
    if (res.rows.length === 0) return null;
    return this.formatRow(res.rows[0]);
  }

  /**
   * Find active / open alert events for a specific rule
   */
  /**
   * Find paginated alert history with full filters (PBI22 Task 4.2)
   */
  public static async findHistory(
    organizationId: string,
    filters: AlertHistoryQuery,
    client?: PoolClient
  ): Promise<{
    data: IAlertEvent[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    const db = client || pool;
    const page = Math.max(1, filters.page || 1);
    const limit = Math.min(100, Math.max(1, filters.limit || 10));
    const offset = (page - 1) * limit;

    const conditions: string[] = ['ae.organization_id = $1'];
    const params: any[] = [organizationId];
    let paramIndex = 2;

    if (filters.severity && filters.severity !== 'ALL') {
      conditions.push(`ae.severity = $${paramIndex++}`);
      params.push(filters.severity);
    }

    if (filters.status && filters.status !== 'ALL') {
      conditions.push(`ae.status = $${paramIndex++}`);
      params.push(filters.status);
    }

    if (filters.clusterId && filters.clusterId !== 'ALL' && filters.clusterId !== 'all') {
      if (filters.clusterId === 'null' || filters.clusterId === 'org_wide') {
        conditions.push('ae.cluster_id IS NULL');
      } else {
        conditions.push(`ae.cluster_id = $${paramIndex++}`);
        params.push(filters.clusterId);
      }
    }

    if (filters.ruleId && filters.ruleId !== 'ALL' && filters.ruleId !== 'all') {
      conditions.push(`ae.rule_id = $${paramIndex++}`);
      params.push(filters.ruleId);
    }

    if (filters.resourceType && filters.resourceType !== 'ALL' && filters.resourceType !== 'all') {
      conditions.push(`LOWER(ae.resource_type) = LOWER($${paramIndex++})`);
      params.push(filters.resourceType);
    }

    if (filters.startDate) {
      conditions.push(`COALESCE(ae.first_detected_at, ae.created_at) >= $${paramIndex++}`);
      params.push(new Date(filters.startDate));
    }

    if (filters.endDate) {
      conditions.push(`COALESCE(ae.first_detected_at, ae.created_at) <= $${paramIndex++}`);
      params.push(new Date(filters.endDate));
    }

    if (filters.search && filters.search.trim()) {
      const s = `%${filters.search.trim()}%`;
      conditions.push(
        `(ae.rule_name ILIKE $${paramIndex} OR ae.message ILIKE $${paramIndex} OR ae.resource_id ILIKE $${paramIndex} OR ae.namespace ILIKE $${paramIndex} OR (ae.details->>'namespace') ILIKE $${paramIndex})`
      );
      params.push(s);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');

    // Count
    const countRes = await db.query(
      `SELECT COUNT(*) AS total FROM alert_events ae WHERE ${whereClause}`,
      params
    );
    const total = parseInt(countRes.rows[0].total, 10);
    const totalPages = Math.ceil(total / limit) || 1;

    // Sort column
    const sortFieldMap: Record<string, string> = {
      first_detected_at: 'ae.first_detected_at',
      last_seen_at: 'ae.last_seen_at',
      resolved_at: 'ae.resolved_at',
      severity: 'ae.severity',
      status: 'ae.status',
      created_at: 'ae.created_at',
      duration: 'ae.resolved_at',
    };
    const sortCol = sortFieldMap[filters.sortBy || 'first_detected_at'] || 'ae.first_detected_at';
    const sortDir = (filters.sortOrder || 'desc').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const dataQuery = `
      SELECT 
        ae.*,
        c.name AS cluster_name,
        o.name AS organization_name,
        ar.description AS rule_description,
        ar.operator AS rule_operator,
        ar.evaluation_window AS rule_evaluation_window,
        ar.duration AS rule_duration,
        ar.cooldown_seconds AS rule_cooldown_seconds,
        u.full_name AS acknowledger_name,
        u.email AS acknowledger_email,
        ur.full_name AS resolver_name,
        ur.email AS resolver_email
      FROM alert_events ae
      LEFT JOIN clusters c ON ae.cluster_id = c.id
      LEFT JOIN organizations o ON ae.organization_id = o.id
      LEFT JOIN alert_rules ar ON ae.rule_id = ar.id
      LEFT JOIN users u ON ae.acknowledged_by = u.id
      LEFT JOIN users ur ON ae.resolved_by = ur.id
      WHERE ${whereClause}
      ORDER BY ${sortCol} ${sortDir}
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;

    const dataRes = await db.query(dataQuery, [...params, limit, offset]);

    return {
      data: dataRes.rows.map((r) => this.formatRow(r)),
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  /**
   * Get Alert History Summary metrics (PBI22 Task 4.2)
   */
  public static async getHistorySummary(
    organizationId: string,
    options: { clusterId?: string; startDate?: string; endDate?: string } = {},
    client?: PoolClient
  ): Promise<{
    total_alerts: number;
    critical_alerts: number;
    warning_alerts: number;
    info_alerts: number;
    resolved_alerts: number;
    active_alerts: number;
    acknowledged_alerts: number;
  }> {
    const db = client || pool;
    const params: any[] = [organizationId];
    let clusterFilter = '';
    let timeFilter = '';
    let paramIndex = 2;

    if (options.clusterId && options.clusterId !== 'ALL' && options.clusterId !== 'all') {
      clusterFilter = ` AND ae.cluster_id = $${paramIndex++}`;
      params.push(options.clusterId);
    }
    if (options.startDate) {
      timeFilter += ` AND COALESCE(ae.first_detected_at, ae.created_at) >= $${paramIndex++}`;
      params.push(new Date(options.startDate));
    }
    if (options.endDate) {
      timeFilter += ` AND COALESCE(ae.first_detected_at, ae.created_at) <= $${paramIndex++}`;
      params.push(new Date(options.endDate));
    }

    const query = `
      SELECT
        COUNT(ae.id) AS total_alerts,
        COUNT(CASE WHEN ae.severity = 'CRITICAL' THEN 1 END) AS critical_alerts,
        COUNT(CASE WHEN ae.severity = 'WARNING' THEN 1 END) AS warning_alerts,
        COUNT(CASE WHEN ae.severity = 'INFO' THEN 1 END) AS info_alerts,
        COUNT(CASE WHEN ae.status = 'RESOLVED' THEN 1 END) AS resolved_alerts,
        COUNT(CASE WHEN ae.status = 'ACTIVE' THEN 1 END) AS active_alerts,
        COUNT(CASE WHEN ae.status = 'ACKNOWLEDGED' THEN 1 END) AS acknowledged_alerts
      FROM alert_events ae
      WHERE ae.organization_id = $1 ${clusterFilter} ${timeFilter};
    `;

    const res = await db.query(query, params);
    const r = res.rows[0] || {};
    return {
      total_alerts: parseInt(r.total_alerts || '0', 10),
      critical_alerts: parseInt(r.critical_alerts || '0', 10),
      warning_alerts: parseInt(r.warning_alerts || '0', 10),
      info_alerts: parseInt(r.info_alerts || '0', 10),
      resolved_alerts: parseInt(r.resolved_alerts || '0', 10),
      active_alerts: parseInt(r.active_alerts || '0', 10),
      acknowledged_alerts: parseInt(r.acknowledged_alerts || '0', 10),
    };
  }

  public static async findOpenEventsByRule(
    ruleId: string,
    organizationId: string,
    client?: PoolClient
  ): Promise<IAlertEvent[]> {
    const db = client || pool;
    const query = `
      SELECT ae.*
      FROM alert_events ae
      WHERE ae.rule_id = $1 AND ae.organization_id = $2 AND ae.status != 'RESOLVED'
      ORDER BY ae.last_seen_at DESC
    `;
    const res = await db.query(query, [ruleId, organizationId]);
    return res.rows.map((r) => this.formatRow(r));
  }

  /**
   * Aggregate alert summary metrics for Dashboard
   */
  public static async getAlertSummary(
    organizationId: string,
    options: { clusterId?: string; from?: string; to?: string } = {},
    client?: PoolClient
  ): Promise<{
    total_active: number;
    total_acknowledged: number;
    total_resolved: number;
    critical: number;
    warning: number;
    info: number;
    resolved: number;
    by_severity: { INFO: number; WARNING: number; CRITICAL: number };
    by_category: { RESOURCE: number; KUBERNETES: number; APM: number };
    by_cluster: Array<{ cluster_id: string; cluster_name: string; active_count: number }>;
  }> {
    const db = client || pool;
    const params: any[] = [organizationId];
    let clusterFilter = '';
    let timeFilter = '';
    let paramIndex = 2;

    if (options.clusterId) {
      clusterFilter = ` AND ae.cluster_id = $${paramIndex++}`;
      params.push(options.clusterId);
    }
    if (options.from) {
      timeFilter += ` AND ae.last_seen_at >= $${paramIndex++}`;
      params.push(new Date(options.from));
    }
    if (options.to) {
      timeFilter += ` AND ae.last_seen_at <= $${paramIndex++}`;
      params.push(new Date(options.to));
    }

    const countsQuery = `
      SELECT
        COUNT(CASE WHEN ae.status = 'ACTIVE' THEN 1 END) AS total_active,
        COUNT(CASE WHEN ae.status = 'ACKNOWLEDGED' THEN 1 END) AS total_acknowledged,
        COUNT(CASE WHEN ae.status = 'RESOLVED' THEN 1 END) AS total_resolved,
        COUNT(CASE WHEN ae.severity = 'CRITICAL' AND ae.status != 'RESOLVED' THEN 1 END) AS critical_count,
        COUNT(CASE WHEN ae.severity = 'WARNING' AND ae.status != 'RESOLVED' THEN 1 END) AS warning_count,
        COUNT(CASE WHEN ae.severity = 'INFO' AND ae.status != 'RESOLVED' THEN 1 END) AS info_count,
        COUNT(CASE WHEN ae.category = 'RESOURCE' AND ae.status != 'RESOLVED' THEN 1 END) AS resource_count,
        COUNT(CASE WHEN ae.category = 'KUBERNETES' AND ae.status != 'RESOLVED' THEN 1 END) AS k8s_count,
        COUNT(CASE WHEN ae.category = 'APM' AND ae.status != 'RESOLVED' THEN 1 END) AS apm_count
      FROM alert_events ae
      WHERE ae.organization_id = $1 ${clusterFilter} ${timeFilter};
    `;
    const countsRes = await db.query(countsQuery, params);
    const r = countsRes.rows[0] || {};

    // Group by cluster
    const clusterQuery = `
      SELECT 
        ae.cluster_id,
        COALESCE(c.name, 'Org-Wide') AS cluster_name,
        COUNT(ae.id) AS active_count
      FROM alert_events ae
      LEFT JOIN clusters c ON ae.cluster_id = c.id
      WHERE ae.organization_id = $1 AND ae.status != 'RESOLVED' ${clusterFilter} ${timeFilter}
      GROUP BY ae.cluster_id, c.name
      ORDER BY active_count DESC;
    `;
    const clusterRes = await db.query(clusterQuery, params);

    return {
      total_active: parseInt(r.total_active || '0', 10),
      total_acknowledged: parseInt(r.total_acknowledged || '0', 10),
      total_resolved: parseInt(r.total_resolved || '0', 10),
      critical: parseInt(r.critical_count || '0', 10),
      warning: parseInt(r.warning_count || '0', 10),
      info: parseInt(r.info_count || '0', 10),
      resolved: parseInt(r.total_resolved || '0', 10),
      by_severity: {
        CRITICAL: parseInt(r.critical_count || '0', 10),
        WARNING: parseInt(r.warning_count || '0', 10),
        INFO: parseInt(r.info_count || '0', 10),
      },
      by_category: {
        RESOURCE: parseInt(r.resource_count || '0', 10),
        KUBERNETES: parseInt(r.k8s_count || '0', 10),
        APM: parseInt(r.apm_count || '0', 10),
      },
      by_cluster: clusterRes.rows.map((row) => ({
        cluster_id: row.cluster_id || 'org-wide',
        cluster_name: row.cluster_name,
        active_count: parseInt(row.active_count || '0', 10),
      })),
    };
  }
}
