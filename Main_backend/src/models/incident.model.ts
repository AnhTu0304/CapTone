import { PoolClient } from 'pg';
import { pool } from '../config/database';

export interface IIncident {
  id?: string;
  organization_id?: string | null;
  environment_id: string;
  cluster_id?: string | null;
  prediction_id?: string | null;
  source_type: string;
  target_type: string;
  target_id?: string | null;
  incident_type: string;
  title: string;
  description: string;
  severity: string;
  status: string;
  detected_at?: Date;
  started_at?: Date;
  created_at?: Date;
}

export class IncidentModel {
  /**
   * Create an incident record
   */
  public static async create(
    client: PoolClient,
    incident: IIncident
  ): Promise<{ id: string; created_at: Date }> {
    const query = `
      INSERT INTO incidents (
        organization_id,
        environment_id,
        cluster_id,
        prediction_id,
        source_type,
        target_type,
        target_id,
        incident_type,
        title,
        description,
        severity,
        status,
        detected_at,
        started_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW()
      ) RETURNING id, created_at;
    `;

    const res = await client.query(query, [
      incident.organization_id || null,
      incident.environment_id,
      incident.cluster_id || null,
      incident.prediction_id || null,
      incident.source_type || 'AI_PREDICTION',
      incident.target_type || 'WORKLOAD',
      incident.target_id || null,
      incident.incident_type,
      incident.title,
      incident.description,
      incident.severity,
      incident.status || 'OPEN',
    ]);

    return res.rows[0];
  }

  /**
   * List incidents with filtering and pagination
   */
  public static async findMany(params: {
    limit?: number;
    offset?: number;
    status?: string;
    severity?: string;
  }): Promise<{ items: any[]; total: number }> {
    const limit = params.limit ?? 20;
    const offset = params.offset ?? 0;
    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (params.status) {
      conditions.push(`i.status = $${idx++}`);
      values.push(params.status);
    }
    if (params.severity) {
      conditions.push(`i.severity = $${idx++}`);
      values.push(params.severity);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countSql = `SELECT count(*) FROM incidents i ${whereClause};`;
    const countRes = await pool.query(countSql, values);
    const total = parseInt(countRes.rows[0].count, 10);

    const query = `
      SELECT 
        i.id,
        i.organization_id,
        o.name AS organization_name,
        i.environment_id,
        e.name AS environment_name,
        i.cluster_id,
        c.name AS cluster_name,
        i.prediction_id,
        i.incident_type,
        i.title,
        i.description,
        i.severity,
        i.status,
        i.detected_at,
        i.started_at,
        i.resolved_at,
        i.created_at,
        i.updated_at
      FROM incidents i
      LEFT JOIN organizations o ON o.id = i.organization_id
      LEFT JOIN environments e ON e.id = i.environment_id
      LEFT JOIN clusters c ON c.id = i.cluster_id
      ${whereClause}
      ORDER BY i.detected_at DESC
      LIMIT $${idx++} OFFSET $${idx++};
    `;

    values.push(limit, offset);
    const res = await pool.query(query, values);

    return { items: res.rows, total };
  }

  /**
   * Find incident details by ID including RCA summary
   */
  public static async findById(id: string): Promise<any | null> {
    const query = `
      SELECT 
        i.id,
        i.organization_id,
        o.name AS organization_name,
        i.environment_id,
        e.name AS environment_name,
        i.cluster_id,
        c.name AS cluster_name,
        i.prediction_id,
        i.source_type,
        i.target_type,
        i.target_id,
        i.incident_type,
        i.title,
        i.description,
        i.severity,
        i.status,
        i.detected_at,
        i.started_at,
        i.resolved_at,
        i.created_at,
        i.updated_at,
        r.id AS rca_id,
        r.root_cause_type,
        r.root_cause_description,
        r.confidence_score AS rca_confidence,
        r.analysis_method,
        r.analysis_result,
        r.analyzed_at
      FROM incidents i
      LEFT JOIN organizations o ON o.id = i.organization_id
      LEFT JOIN environments e ON e.id = i.environment_id
      LEFT JOIN clusters c ON c.id = i.cluster_id
      LEFT JOIN rca_analyses r ON r.incident_id = i.id
      WHERE i.id = $1
      LIMIT 1;
    `;
    const res = await pool.query(query, [id]);
    return res.rows[0] || null;
  }

  /**
   * Update incident status
   */
  public static async updateStatus(id: string, status: string): Promise<any | null> {
    const isResolved = status === 'RESOLVED';
    const query = `
      UPDATE incidents
      SET 
        status = $1,
        resolved_at = ${isResolved ? 'NOW()' : 'resolved_at'},
        updated_at = NOW()
      WHERE id = $2
      RETURNING *;
    `;
    const res = await pool.query(query, [status, id]);
    return res.rows[0] || null;
  }
}
