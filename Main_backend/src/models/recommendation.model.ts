import { PoolClient } from 'pg';
import { pool } from '../config/database';

export interface IAiRecommendation {
  id?: string;
  incident_id: string;
  rca_analysis_id: string;
  prediction_id?: string | null;
  action_type_id?: string | null;
  recommendation: string;
  reasoning: string;
  risk_level: string;
  priority: number;
  status: string;
}

export class RecommendationModel {
  /**
   * Look up healing action type ID by name
   */
  public static async findActionTypeIdByName(
    client: PoolClient,
    actionName: string
  ): Promise<string | null> {
    const res = await client.query(
      'SELECT id FROM healing_action_types WHERE name ILIKE $1 LIMIT 1',
      [actionName]
    );
    return res.rows.length > 0 ? res.rows[0].id : null;
  }

  /**
   * Create recommendation record
   */
  public static async create(
    client: PoolClient,
    rec: IAiRecommendation
  ): Promise<{ id: string }> {
    const query = `
      INSERT INTO ai_recommendations (
        incident_id,
        rca_analysis_id,
        prediction_id,
        action_type_id,
        recommendation,
        reasoning,
        risk_level,
        priority,
        status
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, 'PROPOSED'
      ) RETURNING id;
    `;

    const res = await client.query(query, [
      rec.incident_id,
      rec.rca_analysis_id,
      rec.prediction_id || null,
      rec.action_type_id || null,
      rec.recommendation,
      rec.reasoning,
      rec.risk_level,
      rec.priority,
    ]);

    return res.rows[0];
  }

  /**
   * List recommendations by incident ID
   */
  public static async findByIncidentId(incidentId: string): Promise<any[]> {
    const query = `
      SELECT 
        r.id,
        r.incident_id,
        r.rca_analysis_id,
        r.prediction_id,
        r.action_type_id,
        h.code AS action_code,
        h.name AS action_name,
        h.default_risk_level,
        h.requires_approval_by_default,
        r.recommendation,
        r.reasoning,
        r.risk_level,
        r.priority,
        r.status,
        r.created_at
      FROM ai_recommendations r
      LEFT JOIN healing_action_types h ON h.id = r.action_type_id
      WHERE r.incident_id = $1
      ORDER BY r.priority ASC, r.created_at DESC;
    `;
    const res = await pool.query(query, [incidentId]);
    return res.rows;
  }

  /**
   * List all healing action types
   */
  public static async findAllActionTypes(): Promise<any[]> {
    const query = `
      SELECT 
        id,
        code,
        name,
        description,
        target_type,
        default_risk_level,
        requires_approval_by_default,
        enabled,
        created_at
      FROM healing_action_types
      ORDER BY name ASC;
    `;
    const res = await pool.query(query);
    return res.rows;
  }

  /**
   * Find recommendation by ID
   */
  public static async findById(id: string): Promise<any | null> {
    const query = `
      SELECT 
        r.id,
        r.incident_id,
        r.rca_analysis_id,
        r.prediction_id,
        r.action_type_id,
        h.code AS action_code,
        h.name AS action_name,
        r.recommendation,
        r.reasoning,
        r.risk_level,
        r.priority,
        r.status,
        r.created_at
      FROM ai_recommendations r
      LEFT JOIN healing_action_types h ON h.id = r.action_type_id
      WHERE r.id = $1
      LIMIT 1;
    `;
    const res = await pool.query(query, [id]);
    return res.rows[0] || null;
  }

  /**
   * Update recommendation status (e.g. APPLIED, REJECTED)
   */
  public static async updateStatus(id: string, status: string): Promise<any | null> {
    const query = `
      UPDATE ai_recommendations
      SET status = $1
      WHERE id = $2
      RETURNING *;
    `;
    const res = await pool.query(query, [status, id]);
    return res.rows[0] || null;
  }

  /**
   * Get recent recommendations (deduplicated by recommendation action and status)
   */
  public static async getRecent(limit: number = 10, clusterId?: string, client?: PoolClient, organizationId?: string) {
    const db = client || pool;
    const conditions: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (organizationId && organizationId !== 'ALL' && organizationId !== 'all') {
      conditions.push(`(i.organization_id = $${idx} OR EXISTS (SELECT 1 FROM environments env WHERE env.id = i.environment_id AND env.organization_id = $${idx}))`);
      params.push(organizationId);
      idx++;
    }

    if (clusterId && clusterId !== 'ALL' && clusterId !== 'all') {
      conditions.push(`(i.cluster_id = $${idx} OR i.cluster_id IN (SELECT name FROM clusters WHERE id::text = $${idx} OR cluster_uid = $${idx}) OR i.cluster_id IN (SELECT id::text FROM clusters WHERE name = $${idx}))`);
      params.push(clusterId);
      idx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const res = await db.query(
      `WITH ranked_recs AS (
        SELECT 
          r.id, r.incident_id, r.rca_analysis_id, r.prediction_id, r.action_type_id,
          h.code AS action_code, h.name AS action_name,
          r.recommendation, r.reasoning, r.risk_level, r.priority, r.status, r.created_at,
          i.cluster_id,
          COALESCE(i.target_id, '') as target_id,
          i.title as incident_title,
          ROW_NUMBER() OVER (PARTITION BY r.recommendation, r.status ORDER BY r.created_at DESC) as rn
        FROM ai_recommendations r
        LEFT JOIN healing_action_types h ON h.id = r.action_type_id
        LEFT JOIN incidents i ON r.incident_id = i.id
        ${whereClause}
      )
      SELECT id, incident_id, rca_analysis_id, prediction_id, action_type_id,
             action_code, action_name, recommendation, reasoning, risk_level, priority, status, created_at, cluster_id, target_id, incident_title
      FROM ranked_recs
      WHERE rn <= 2
      ORDER BY created_at DESC
      LIMIT $${idx};`,
      [...params, limit]
    );
    return res.rows;
  }

  /**
   * Create a healing action entry
   */
  public static async createHealingAction(data: {
    incident_id: string;
    recommendation_id?: string;
    environment_id: string;
    action_type_id: string;
    target_type: string;
    target_name?: string;
    risk_level?: string;
    execution_mode?: string;
    approval_status?: string;
    execution_status?: string;
    requested_by?: string;
    executed_by?: string;
    result?: any;
  }): Promise<any> {
    const rawRisk = (data.risk_level || 'LOW').toUpperCase();
    const validRisks = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
    const safeRisk = validRisks.includes(rawRisk) ? rawRisk : 'LOW';

    const safeMode = data.execution_mode === 'AUTO' ? 'AUTO' : 'MANUAL';
    const safeApproval = data.approval_status || 'APPROVED';
    const safeStatus = data.execution_status || 'SUCCEEDED';
    const safeResult = typeof data.result === 'object' ? JSON.stringify(data.result) : (data.result || '{}');

    const query = `
      INSERT INTO healing_actions (
        incident_id,
        recommendation_id,
        environment_id,
        action_type_id,
        target_type,
        target_name,
        risk_level,
        execution_mode,
        approval_status,
        execution_status,
        requested_by,
        executed_by,
        started_at,
        completed_at,
        result
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7::risk_level, $8::execution_mode, $9::approval_status, $10::execution_status, $11, $12, NOW(), NOW(), $13::jsonb
      ) RETURNING *;
    `;

    const res = await pool.query(query, [
      data.incident_id,
      data.recommendation_id || null,
      data.environment_id,
      data.action_type_id,
      data.target_type || 'WORKLOAD',
      data.target_name || '',
      safeRisk,
      safeMode,
      safeApproval,
      safeStatus,
      data.requested_by || null,
      data.executed_by || null,
      safeResult,
    ]);

    return res.rows[0];
  }

  /**
   * List recent healing actions with action type and incident info
   */
  public static async getHealingActions(limit: number = 20, clusterId?: string, organizationId?: string): Promise<any[]> {
    const conditions: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (organizationId && organizationId !== 'ALL' && organizationId !== 'all') {
      conditions.push(`(EXISTS (SELECT 1 FROM environments env WHERE env.id = h.environment_id AND env.organization_id = $${idx}) OR i.organization_id = $${idx})`);
      params.push(organizationId);
      idx++;
    }

    if (clusterId && clusterId !== 'ALL' && clusterId !== 'all') {
      conditions.push(`(i.cluster_id = $${idx} OR i.cluster_id IN (SELECT name FROM clusters WHERE id::text = $${idx} OR cluster_uid = $${idx}) OR i.cluster_id IN (SELECT id::text FROM clusters WHERE name = $${idx}))`);
      params.push(clusterId);
      idx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const query = `
      SELECT 
        h.id,
        h.incident_id,
        h.recommendation_id,
        h.environment_id,
        h.action_type_id,
        t.name AS action_type_name,
        t.code AS action_type_code,
        h.target_type,
        h.target_name,
        h.risk_level,
        h.execution_mode,
        h.approval_status,
        h.execution_status,
        h.started_at,
        h.completed_at,
        h.result,
        h.created_at,
        i.title AS incident_title,
        i.severity AS incident_severity
      FROM healing_actions h
      LEFT JOIN healing_action_types t ON t.id = h.action_type_id
      LEFT JOIN incidents i ON i.id = h.incident_id
      ${whereClause}
      ORDER BY h.created_at DESC
      LIMIT $${idx};
    `;
    const res = await pool.query(query, [...params, limit]);
    return res.rows;
  }
}
