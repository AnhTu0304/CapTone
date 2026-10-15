import { PoolClient } from 'pg';

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
}
