import { PoolClient } from 'pg';
import { pool } from '../config/database';

export interface IRcaAnalysis {
  id?: string;
  incident_id: string;
  root_cause_type: string;
  root_cause_description: string;
  confidence_score: number;
  analysis_method: string;
  analysis_result?: string;
  analyzed_at?: Date;
}

export class RcaModel {
  /**
   * Create RCA Analysis record linked to incident
   */
  public static async createAnalysis(
    client: PoolClient,
    analysis: IRcaAnalysis
  ): Promise<{ id: string }> {
    const query = `
      INSERT INTO rca_analyses (
        incident_id,
        root_cause_type,
        root_cause_description,
        confidence_score,
        analysis_method,
        analysis_result,
        analyzed_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, NOW()
      ) RETURNING id;
    `;

    const res = await client.query(query, [
      analysis.incident_id,
      analysis.root_cause_type ? analysis.root_cause_type.substring(0, 250) : 'UNKNOWN',
      analysis.root_cause_description,
      analysis.confidence_score,
      (analysis.analysis_method || 'AI_DETERMINISTIC_RULES').substring(0, 250),
      analysis.analysis_result || null,
    ]);

    return res.rows[0];
  }

  /**
   * Create RCA Evidence records linked to analysis
   */
  public static async createEvidences(
    client: PoolClient,
    rcaAnalysisId: string,
    serviceId: string,
    evidences: string[]
  ): Promise<void> {
    for (const ev of evidences) {
      await client.query(
        `INSERT INTO rca_evidences (
          rca_analysis_id,
          source_type,
          source_reference,
          evidence_data,
          importance_score
        ) VALUES ($1, 'AI_TELEMETRY', $2, $3, 0.9000)`,
        [rcaAnalysisId, serviceId, JSON.stringify({ summary: ev })]
      );
    }
  }

  /**
   * Get evidences by incident ID
   */
  public static async findEvidencesByIncidentId(incidentId: string): Promise<any[]> {
    const query = `
      SELECT 
        e.id,
        e.rca_analysis_id,
        e.source_type,
        e.source_reference,
        e.evidence_data,
        e.importance_score,
        e.created_at
      FROM rca_evidences e
      JOIN rca_analyses a ON a.id = e.rca_analysis_id
      WHERE a.incident_id = $1
      ORDER BY e.importance_score DESC, e.created_at DESC;
    `;
    const res = await pool.query(query, [incidentId]);
    return res.rows;
  }
}
