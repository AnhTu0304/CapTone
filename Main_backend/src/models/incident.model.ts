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
   * Find recent open incident for deduplication (prevents spamming duplicate incidents)
   */
  public static async findOpenIncident(
    client: PoolClient,
    environmentId: string,
    targetId: string | null,
    incidentType: string,
    cooldownMinutes: number = 15
  ): Promise<any | null> {
    const query = `
      SELECT id, status, created_at
      FROM incidents
      WHERE environment_id = $1
        AND ($2::text IS NULL OR target_id = $2::text OR target_id IS NULL)
        AND incident_type = $3
        AND status IN ('OPEN', 'INVESTIGATING')
        AND created_at >= NOW() - ($4 || ' minutes')::interval
      ORDER BY created_at DESC
      LIMIT 1;
    `;
    const res = await client.query(query, [environmentId, targetId, incidentType, cooldownMinutes]);
    return res.rows[0] || null;
  }

  /**
   * List incidents with filtering and pagination
   */
  public static async findMany(params: {
    limit?: number;
    offset?: number;
    status?: string;
    severity?: string;
    cluster_id?: string;
    organization_id?: string;
    search?: string;
  }): Promise<{ items: any[]; total: number }> {
    const limit = params.limit ?? 50;
    const offset = params.offset ?? 0;
    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (params.organization_id && params.organization_id !== 'all' && !params.organization_id.startsWith('sandbox-') && params.organization_id !== 'org-acme') {
      conditions.push(`(i.organization_id = $${idx} OR EXISTS (SELECT 1 FROM environments env WHERE env.id = i.environment_id AND env.organization_id = $${idx}))`);
      values.push(params.organization_id);
      idx++;
    }

    if (params.cluster_id && params.cluster_id !== 'all') {
      const clusterMatches = await pool.query(
        'SELECT id, name, cluster_uid FROM clusters WHERE id::text = $1 OR name = $1 OR cluster_uid = $1',
        [params.cluster_id]
      );
      if (clusterMatches.rows.length > 0) {
        const cRow = clusterMatches.rows[0];
        const validIds = Array.from(new Set([params.cluster_id, String(cRow.id), cRow.name, cRow.cluster_uid].filter(Boolean)));
        conditions.push(`i.cluster_id::text = ANY($${idx})`);
        values.push(validIds);
        idx++;
      } else {
        conditions.push(`i.cluster_id = $${idx}`);
        values.push(params.cluster_id);
        idx++;
      }
    }

    if (params.status && params.status !== 'all') {
      // Map Vietnamese or English statuses
      const s = params.status.toUpperCase();
      if (params.status.includes('hoàn tất') || s === 'RESOLVED') {
        conditions.push(`i.status = 'RESOLVED'`);
      } else if (params.status.includes('phục hồi') || s === 'INVESTIGATING' || s === 'RECOVERING') {
        conditions.push(`i.status = 'INVESTIGATING'`);
      } else if (params.status.includes('duyệt') || s === 'OPEN' || s === 'HITL') {
        conditions.push(`i.status = 'OPEN'`);
      } else {
        conditions.push(`i.status ILIKE $${idx++}`);
        values.push(`%${params.status}%`);
      }
    }

    if (params.severity && params.severity !== 'all') {
      conditions.push(`i.severity = $${idx++}`);
      values.push(params.severity.toUpperCase());
    }

    if (params.search && params.search.trim() !== '') {
      conditions.push(`(
        i.title ILIKE $${idx} OR 
        i.description ILIKE $${idx} OR 
        i.incident_type ILIKE $${idx} OR 
        i.target_id::text ILIKE $${idx} OR
        i.id::text ILIKE $${idx}
      )`);
      values.push(`%${params.search.trim()}%`);
      idx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countSql = `SELECT count(*) FROM incidents i ${whereClause};`;
    const countRes = await pool.query(countSql, values);
    const total = parseInt(countRes.rows[0].count, 10);

    const query = `
      SELECT 
        i.id,
        i.organization_id,
        COALESCE(i.organization_id, e.organization_id) AS effective_organization_id,
        e.organization_id AS env_organization_id,
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
        r.id AS rca_id,
        r.root_cause_type,
        r.root_cause_description,
        r.confidence_score AS rca_confidence,
        r.analysis_method,
        r.analysis_result,
        COALESCE(ns.name, 'default') AS namespace,
        COALESCE(nd.name, 'minikube') AS node_name
      FROM incidents i
      LEFT JOIN organizations o ON o.id = i.organization_id
      LEFT JOIN environments e ON e.id = i.environment_id
      LEFT JOIN clusters c ON (c.id::text = i.cluster_id OR c.name = i.cluster_id OR c.cluster_uid = i.cluster_id)
      LEFT JOIN workloads w ON (w.id::text = i.target_id OR w.name = i.target_id)
      LEFT JOIN namespaces ns ON ns.id = w.namespace_id
      LEFT JOIN LATERAL (
        SELECT nd.name
        FROM nodes nd
        WHERE nd.cluster_id::text = i.cluster_id
        LIMIT 1
      ) nd ON true
      LEFT JOIN LATERAL (
        SELECT r.id, r.root_cause_type, r.root_cause_description, r.confidence_score, r.analysis_method, r.analysis_result
        FROM rca_analyses r
        WHERE r.incident_id = i.id
        ORDER BY r.analyzed_at DESC
        LIMIT 1
      ) r ON true
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
        COALESCE(i.organization_id, e.organization_id) AS effective_organization_id,
        e.organization_id AS env_organization_id,
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
        r.id AS rca_id,
        r.root_cause_type,
        r.root_cause_description,
        r.confidence_score AS rca_confidence,
        r.analysis_method,
        r.analysis_result,
        r.analyzed_at,
        COALESCE(ns.name, 'default') AS namespace,
        COALESCE(nd.name, 'minikube') AS node_name
      FROM incidents i
      LEFT JOIN organizations o ON o.id = i.organization_id
      LEFT JOIN environments e ON e.id = i.environment_id
      LEFT JOIN clusters c ON (c.id::text = i.cluster_id OR c.name = i.cluster_id OR c.cluster_uid = i.cluster_id)
      LEFT JOIN workloads w ON (w.id::text = i.target_id OR w.name = i.target_id)
      LEFT JOIN namespaces ns ON ns.id = w.namespace_id
      LEFT JOIN LATERAL (
        SELECT nd.name
        FROM nodes nd
        WHERE nd.cluster_id::text = i.cluster_id
        LIMIT 1
      ) nd ON true
      LEFT JOIN LATERAL (
        SELECT r.id, r.root_cause_type, r.root_cause_description, r.confidence_score, r.analysis_method, r.analysis_result, r.analyzed_at
        FROM rca_analyses r
        WHERE r.incident_id = i.id
        ORDER BY r.analyzed_at DESC
        LIMIT 1
      ) r ON true
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
        resolved_at = ${isResolved ? 'NOW()' : 'resolved_at'}
      WHERE id = $2
      RETURNING *;
    `;
    const res = await pool.query(query, [status, id]);
    return res.rows[0] || null;
  }

  /**
   * Get recent incidents
   */
  public static async getRecent(limit: number = 10, client?: PoolClient) {
    const db = client || pool;
    const res = await db.query(
      `SELECT id, title, severity, incident_type, description, status, detected_at, created_at
       FROM incidents
       ORDER BY created_at DESC
       LIMIT $1`,
      [limit]
    );
    return res.rows;
  }

  /**
   * Validate if a cluster belongs to the specified organization
   */
  public static async validateClusterBelongsToOrg(clusterIdOrName: string, orgId: string): Promise<boolean> {
    const query = `
      SELECT 1 
      FROM clusters c
      JOIN environments e ON c.environment_id = e.id
      WHERE (c.id::text = $1 OR c.name = $1 OR c.cluster_uid = $1)
        AND e.organization_id = $2
      LIMIT 1;
    `;
    const res = await pool.query(query, [clusterIdOrName, orgId]);
    return res.rows.length > 0;
  }

  /**
   * Resolve organization ID owning an incident
   */
  public static async findOrgIdByIncidentId(incidentId: string): Promise<string | null> {
    const query = `
      SELECT COALESCE(i.organization_id, e.organization_id) AS organization_id
      FROM incidents i
      LEFT JOIN environments e ON e.id = i.environment_id
      WHERE i.id = $1
      LIMIT 1;
    `;
    const res = await pool.query(query, [incidentId]);
    return res.rows[0]?.organization_id || null;
  }
}
