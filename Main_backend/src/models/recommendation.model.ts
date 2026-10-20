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
}
