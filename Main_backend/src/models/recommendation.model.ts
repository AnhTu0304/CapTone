import { PoolClient } from 'pg';

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
}
