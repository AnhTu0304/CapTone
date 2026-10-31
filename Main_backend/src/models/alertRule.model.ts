import { PoolClient } from 'pg';
import { pool } from '../config/database';
import { AlertMetricType, AlertOperator, AlertSeverity } from '../schemas/alertRule.schema';

export interface IAlertRule {
  id: string;
  organization_id: string;
  cluster_id?: string | null;
  name: string;
  description?: string | null;
  metric_type: AlertMetricType;
  operator: AlertOperator;
  threshold_value: number;
  unit: string;
  severity: AlertSeverity;
  evaluation_window: string;
  duration: number;
  cooldown_seconds: number;
  enabled: boolean;
  created_by?: string | null;
  created_at: Date;
  updated_at: Date;
  cluster_name?: string | null;
  creator_name?: string | null;
  creator_email?: string | null;
}

export interface IAlertRuleFilters {
  search?: string;
  metric_type?: AlertMetricType;
  severity?: AlertSeverity;
  enabled?: boolean;
  cluster_id?: string;
  page?: number;
  limit?: number;
  sort_by?: string;
  order?: 'asc' | 'desc';
}

export interface IPaginatedAlertRules {
  items: IAlertRule[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}

export class AlertRuleModel {
  /**
   * Format raw SQL row to typed IAlertRule
   */
  private static formatRow(row: any): IAlertRule {
    return {
      ...row,
      threshold_value: Number(row.threshold_value),
      duration: Number(row.duration),
      cooldown_seconds: Number(row.cooldown_seconds),
      enabled: Boolean(row.enabled),
    };
  }

  /**
   * Verify if a cluster exists and belongs to the given organization
   */
  public static async verifyClusterOwnership(
    clusterId: string,
    organizationId: string,
    client?: PoolClient
  ): Promise<boolean> {
    const db = client || pool;
    const query = `
      SELECT c.id
      FROM clusters c
      JOIN environments e ON c.environment_id = e.id
      WHERE c.id = $1 
        AND e.organization_id = $2 
        AND c.deleted_at IS NULL
      LIMIT 1
    `;
    const res = await db.query(query, [clusterId, organizationId]);
    return (res.rowCount ?? 0) > 0;
  }

  /**
   * Check if a rule name already exists within the organization
   */
  public static async checkNameExists(
    organizationId: string,
    name: string,
    excludeId?: string,
    client?: PoolClient
  ): Promise<boolean> {
    const db = client || pool;
    let query = `
      SELECT id FROM alert_rules
      WHERE organization_id = $1 AND LOWER(name) = LOWER($2)
    `;
    const params: any[] = [organizationId, name.trim()];
    if (excludeId) {
      query += ' AND id <> $3';
      params.push(excludeId);
    }
    const res = await db.query(query, params);
    return (res.rowCount ?? 0) > 0;
  }

  /**
   * Create a new Alert Rule
   */
  public static async create(
    data: {
      organization_id: string;
      cluster_id?: string | null;
      name: string;
      description?: string | null;
      metric_type: AlertMetricType;
      operator: AlertOperator;
      threshold_value: number;
      unit: string;
      severity?: AlertSeverity;
      evaluation_window?: string;
      duration?: number;
      cooldown_seconds?: number;
      enabled?: boolean;
      created_by?: string | null;
    },
    client?: PoolClient
  ): Promise<IAlertRule> {
    const db = client || pool;
    const query = `
      INSERT INTO alert_rules (
        organization_id,
        cluster_id,
        name,
        description,
        metric_type,
        operator,
        threshold_value,
        unit,
        severity,
        evaluation_window,
        duration,
        cooldown_seconds,
        enabled,
        created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *
    `;
    const params = [
      data.organization_id,
      data.cluster_id || null,
      data.name.trim(),
      data.description?.trim() || null,
      data.metric_type,
      data.operator,
      data.threshold_value,
      data.unit.trim(),
      data.severity || 'WARNING',
      data.evaluation_window || '5m',
      data.duration !== undefined ? data.duration : 60,
      data.cooldown_seconds !== undefined ? data.cooldown_seconds : 300,
      data.enabled !== undefined ? data.enabled : true,
      data.created_by || null,
    ];

    const res = await db.query(query, params);
    return this.formatRow(res.rows[0]);
  }

  /**
   * Find Alert Rule by ID with tenant guard and optional joined cluster & user names
   */
  public static async findById(
    id: string,
    organizationId?: string,
    client?: PoolClient
  ): Promise<IAlertRule | null> {
    const db = client || pool;
    let query = `
      SELECT 
        ar.*,
        c.name AS cluster_name,
        u.full_name AS creator_name,
        u.email AS creator_email
      FROM alert_rules ar
      LEFT JOIN clusters c ON ar.cluster_id = c.id
      LEFT JOIN users u ON ar.created_by = u.id
      WHERE ar.id = $1
    `;
    const params: any[] = [id];

    if (organizationId) {
      query += ' AND ar.organization_id = $2';
      params.push(organizationId);
    }

    const res = await db.query(query, params);
    if (res.rows.length === 0) return null;
    return this.formatRow(res.rows[0]);
  }

  /**
   * Find paginated Alert Rules with filters
   */
  public static async findByOrg(
    organizationId: string,
    filters: IAlertRuleFilters = {},
    client?: PoolClient
  ): Promise<IPaginatedAlertRules> {
    const db = client || pool;
    const page = Math.max(1, filters.page || 1);
    const limit = Math.min(100, Math.max(1, filters.limit || 20));
    const offset = (page - 1) * limit;

    const conditions: string[] = ['ar.organization_id = $1'];
    const params: any[] = [organizationId];
    let paramIndex = 2;

    if (filters.cluster_id) {
      if (filters.cluster_id === 'null' || filters.cluster_id === 'org_wide') {
        conditions.push('ar.cluster_id IS NULL');
      } else {
        conditions.push(`ar.cluster_id = $${paramIndex++}`);
        params.push(filters.cluster_id);
      }
    }

    if (filters.metric_type) {
      conditions.push(`ar.metric_type = $${paramIndex++}`);
      params.push(filters.metric_type);
    }

    if (filters.severity) {
      conditions.push(`ar.severity = $${paramIndex++}`);
      params.push(filters.severity);
    }

    if (filters.enabled !== undefined) {
      conditions.push(`ar.enabled = $${paramIndex++}`);
      params.push(filters.enabled);
    }

    if (filters.search) {
      conditions.push(
        `(ar.name ILIKE $${paramIndex} OR ar.description ILIKE $${paramIndex})`
      );
      params.push(`%${filters.search.trim()}%`);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');

    // Count query
    const countQuery = `
      SELECT COUNT(*)::int AS total
      FROM alert_rules ar
      WHERE ${whereClause}
    `;
    const countRes = await db.query(countQuery, params);
    const total = countRes.rows[0]?.total || 0;

    // Sorting
    const allowedSortFields: Record<string, string> = {
      created_at: 'ar.created_at',
      updated_at: 'ar.updated_at',
      name: 'ar.name',
      severity: 'ar.severity',
      threshold_value: 'ar.threshold_value',
      metric_type: 'ar.metric_type',
    };
    const sortCol = allowedSortFields[filters.sort_by || 'created_at'] || 'ar.created_at';
    const sortOrder = filters.order === 'asc' ? 'ASC' : 'DESC';

    // Data query
    const dataQuery = `
      SELECT 
        ar.*,
        c.name AS cluster_name,
        u.full_name AS creator_name,
        u.email AS creator_email
      FROM alert_rules ar
      LEFT JOIN clusters c ON ar.cluster_id = c.id
      LEFT JOIN users u ON ar.created_by = u.id
      WHERE ${whereClause}
      ORDER BY ${sortCol} ${sortOrder}
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;
    params.push(limit, offset);

    const dataRes = await db.query(dataQuery, params);
    const items = dataRes.rows.map((r) => this.formatRow(r));

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Retrieve active rules for Evaluation Engine
   */
  public static async findActiveRules(
    organizationId: string,
    clusterId?: string,
    metricType?: AlertMetricType,
    client?: PoolClient
  ): Promise<IAlertRule[]> {
    const db = client || pool;
    const conditions = ['ar.organization_id = $1', 'ar.enabled = true'];
    const params: any[] = [organizationId];
    let paramIndex = 2;

    if (clusterId) {
      conditions.push(`(ar.cluster_id = $${paramIndex++} OR ar.cluster_id IS NULL)`);
      params.push(clusterId);
    }

    if (metricType) {
      conditions.push(`ar.metric_type = $${paramIndex++}`);
      params.push(metricType);
    }

    const query = `
      SELECT ar.*
      FROM alert_rules ar
      WHERE ${conditions.join(' AND ')}
      ORDER BY ar.created_at ASC
    `;
    const res = await db.query(query, params);
    return res.rows.map((r) => this.formatRow(r));
  }

  /**
   * Update an existing Alert Rule
   */
  public static async update(
    id: string,
    organizationId: string,
    data: {
      name?: string;
      description?: string | null;
      cluster_id?: string | null;
      metric_type?: AlertMetricType;
      operator?: AlertOperator;
      threshold_value?: number;
      unit?: string;
      severity?: AlertSeverity;
      evaluation_window?: string;
      duration?: number;
      cooldown_seconds?: number;
      enabled?: boolean;
    },
    client?: PoolClient
  ): Promise<IAlertRule | null> {
    const db = client || pool;
    const setClauses: string[] = ['updated_at = NOW()'];
    const params: any[] = [id, organizationId];
    let paramIndex = 3;

    if (data.name !== undefined) {
      setClauses.push(`name = $${paramIndex++}`);
      params.push(data.name.trim());
    }
    if (data.description !== undefined) {
      setClauses.push(`description = $${paramIndex++}`);
      params.push(data.description ? data.description.trim() : null);
    }
    if (data.cluster_id !== undefined) {
      setClauses.push(`cluster_id = $${paramIndex++}`);
      params.push(data.cluster_id || null);
    }
    if (data.metric_type !== undefined) {
      setClauses.push(`metric_type = $${paramIndex++}`);
      params.push(data.metric_type);
    }
    if (data.operator !== undefined) {
      setClauses.push(`operator = $${paramIndex++}`);
      params.push(data.operator);
    }
    if (data.threshold_value !== undefined) {
      setClauses.push(`threshold_value = $${paramIndex++}`);
      params.push(data.threshold_value);
    }
    if (data.unit !== undefined) {
      setClauses.push(`unit = $${paramIndex++}`);
      params.push(data.unit.trim());
    }
    if (data.severity !== undefined) {
      setClauses.push(`severity = $${paramIndex++}`);
      params.push(data.severity);
    }
    if (data.evaluation_window !== undefined) {
      setClauses.push(`evaluation_window = $${paramIndex++}`);
      params.push(data.evaluation_window);
    }
    if (data.duration !== undefined) {
      setClauses.push(`duration = $${paramIndex++}`);
      params.push(data.duration);
    }
    if (data.cooldown_seconds !== undefined) {
      setClauses.push(`cooldown_seconds = $${paramIndex++}`);
      params.push(data.cooldown_seconds);
    }
    if (data.enabled !== undefined) {
      setClauses.push(`enabled = $${paramIndex++}`);
      params.push(data.enabled);
    }

    const query = `
      UPDATE alert_rules
      SET ${setClauses.join(', ')}
      WHERE id = $1 AND organization_id = $2
      RETURNING *
    `;

    const res = await db.query(query, params);
    if (res.rows.length === 0) return null;
    return this.formatRow(res.rows[0]);
  }

  /**
   * Toggle Alert Rule active status
   */
  public static async toggleStatus(
    id: string,
    organizationId: string,
    enabled: boolean,
    client?: PoolClient
  ): Promise<IAlertRule | null> {
    const db = client || pool;
    const query = `
      UPDATE alert_rules
      SET enabled = $1, updated_at = NOW()
      WHERE id = $2 AND organization_id = $3
      RETURNING *
    `;
    const res = await db.query(query, [enabled, id, organizationId]);
    if (res.rows.length === 0) return null;
    return this.formatRow(res.rows[0]);
  }

  /**
   * Delete Alert Rule with tenant guard
   */
  public static async delete(
    id: string,
    organizationId: string,
    client?: PoolClient
  ): Promise<boolean> {
    const db = client || pool;
    const query = `
      DELETE FROM alert_rules
      WHERE id = $1 AND organization_id = $2
    `;
    const res = await db.query(query, [id, organizationId]);
    return (res.rowCount ?? 0) > 0;
  }
}
