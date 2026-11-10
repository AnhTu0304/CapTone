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
        i.source_type,
        i.target_type,
        i.target_id,
        w.name AS workload_name,
        w.workload_type,
        w.kubernetes_uid AS workload_kubernetes_uid,
        COALESCE(w.name, ha.target_name, i.target_id) AS service_name,
        i.incident_type,
        i.title,
        i.description,
        i.severity,
        i.status,
        i.detected_at,
        i.started_at,
        i.resolved_at,
        i.created_at,
        pred.prediction_type,
        pred.confidence_score AS prediction_confidence,
        pred.risk_score AS prediction_risk_score,
        r.id AS rca_id,
        r.root_cause_type,
        r.root_cause_description,
        r.confidence_score AS rca_confidence,
        r.analysis_method,
        r.analysis_result,
        COALESCE(
          ns.name,
          CASE
            WHEN r.analysis_result IS NOT NULL AND left(btrim(r.analysis_result), 1) = '{'
              THEN NULLIF(r.analysis_result::jsonb->>'namespace', '')
            ELSE NULL
          END
        ) AS namespace,
        COALESCE(pod_info.pod_node_name, nd.name) AS node_name,
        COALESCE(pod_info.pod_node_id, nd.id) AS node_id,
        pod_info.pod_name AS actual_pod_name,
        pod_info.pod_id AS actual_pod_id,
        pod_info.pod_uid AS kubernetes_uid,
        (SELECT COUNT(*)::int FROM nodes nd_cnt WHERE nd_cnt.cluster_id = c.id) AS cluster_node_count,
        rec_info.recommendation_id,
        rec_info.recommendation_action,
        rec_info.recommendation_reason,
        rec_info.recommendation_risk_level,
        rec_info.recommendation_priority,
        rec_info.requires_approval_by_default,
        ha.id AS healing_action_id,
        ha.execution_status AS healing_status,
        ha.approval_status AS healing_approval_status,
        ha.target_name AS healing_target_name,
        ha.action_name AS healing_action_name,
        ha.completed_at AS healing_completed_at,
        ha.pending_approval_id,
        (ha.pending_approval_id IS NOT NULL) AS has_pending_approval,
        CASE 
          WHEN i.resolved_at IS NOT NULL AND i.detected_at IS NOT NULL 
            THEN EXTRACT(EPOCH FROM (i.resolved_at - i.detected_at))::int
          WHEN ha.completed_at IS NOT NULL AND i.detected_at IS NOT NULL
            THEN EXTRACT(EPOCH FROM (ha.completed_at - i.detected_at))::int
          ELSE NULL 
        END AS mttr_seconds
      FROM incidents i
      LEFT JOIN organizations o ON o.id = i.organization_id
      LEFT JOIN environments e ON e.id = i.environment_id
      LEFT JOIN clusters c ON (c.id::text = i.cluster_id OR c.name = i.cluster_id OR c.cluster_uid = i.cluster_id)
      LEFT JOIN ai_predictions pred ON pred.id = i.prediction_id
      LEFT JOIN LATERAL (
        SELECT w.id, w.name, w.namespace_id, w.workload_type, w.kubernetes_uid
        FROM workloads w
        WHERE w.id::text = i.target_id
           OR (w.name = i.target_id AND (c.id IS NULL OR w.cluster_id = c.id::text OR w.cluster_id = i.cluster_id))
        ORDER BY (w.id::text = i.target_id) DESC, (w.deleted_at IS NULL) DESC, w.created_at DESC
        LIMIT 1
      ) w ON true
      LEFT JOIN namespaces ns ON ns.id = w.namespace_id
      LEFT JOIN LATERAL (
        SELECT p.id AS pod_id, p.name AS pod_name, p.kubernetes_uid AS pod_uid, nd_p.id AS pod_node_id, nd_p.name AS pod_node_name
        FROM pods p
        LEFT JOIN nodes nd_p ON nd_p.id = p.node_id
        WHERE p.deleted_at IS NULL
          AND (
            (w.id IS NOT NULL AND p.workload_id = w.id)
            OR (w.id IS NULL AND c.id IS NOT NULL AND p.cluster_id = c.id AND i.target_id IS NOT NULL AND (p.name = i.target_id OR p.name LIKE i.target_id || '-%'))
          )
        ORDER BY p.restart_count DESC NULLS LAST, p.created_at DESC
        LIMIT 1
      ) pod_info ON true
      LEFT JOIN LATERAL (
        SELECT nd.id, nd.name
        FROM nodes nd
        WHERE nd.cluster_id = c.id
        ORDER BY (nd.status = 'Ready') DESC, nd.created_at ASC
        LIMIT 1
      ) nd ON true
      LEFT JOIN LATERAL (
        SELECT r.id, r.root_cause_type, r.root_cause_description, r.confidence_score, r.analysis_method, r.analysis_result
        FROM rca_analyses r
        WHERE r.incident_id = i.id
        ORDER BY r.analyzed_at DESC
        LIMIT 1
      ) r ON true
      LEFT JOIN LATERAL (
        SELECT
          rec.id AS recommendation_id,
          rec.recommendation AS recommendation_action,
          rec.reasoning AS recommendation_reason,
          COALESCE(rec.risk_level::text, hat.default_risk_level::text) AS recommendation_risk_level,
          CASE rec.priority
            WHEN 1 THEN 'CRITICAL'
            WHEN 2 THEN 'HIGH'
            WHEN 3 THEN 'MEDIUM'
            WHEN 4 THEN 'LOW'
            ELSE NULL
          END AS recommendation_priority,
          COALESCE(hat.requires_approval_by_default, false) AS requires_approval_by_default
        FROM ai_recommendations rec
        LEFT JOIN healing_action_types hat ON hat.id = rec.action_type_id
        WHERE rec.incident_id = i.id
        ORDER BY (rec.rca_analysis_id = r.id) DESC NULLS LAST, rec.priority ASC NULLS LAST, rec.created_at DESC
        LIMIT 1
      ) rec_info ON true
      LEFT JOIN LATERAL (
        SELECT
          ha.id,
          ha.execution_status,
          ha.approval_status,
          ha.target_name,
          hat.name AS action_name,
          ha.completed_at,
          ap.id AS pending_approval_id
        FROM healing_actions ha
        LEFT JOIN healing_action_types hat ON hat.id = ha.action_type_id
        LEFT JOIN approvals ap ON ap.healing_action_id = ha.id AND ap.status = 'PENDING'
        WHERE ha.incident_id = i.id
        ORDER BY (ap.id IS NOT NULL) DESC, ha.created_at DESC
        LIMIT 1
      ) ha ON true
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
        w.name AS workload_name,
        w.workload_type,
        w.kubernetes_uid AS workload_kubernetes_uid,
        COALESCE(w.name, ha.target_name, i.target_id) AS service_name,
        i.incident_type,
        i.title,
        i.description,
        i.severity,
        i.status,
        i.detected_at,
        i.started_at,
        i.resolved_at,
        i.created_at,
        pred.prediction_type,
        pred.confidence_score AS prediction_confidence,
        pred.risk_score AS prediction_risk_score,
        r.id AS rca_id,
        r.root_cause_type,
        r.root_cause_description,
        r.confidence_score AS rca_confidence,
        r.analysis_method,
        r.analysis_result,
        r.analyzed_at,
        COALESCE(
          ns.name,
          CASE
            WHEN r.analysis_result IS NOT NULL AND left(btrim(r.analysis_result), 1) = '{'
              THEN NULLIF(r.analysis_result::jsonb->>'namespace', '')
            ELSE NULL
          END
        ) AS namespace,
        COALESCE(pod_info.pod_node_name, nd.name) AS node_name,
        COALESCE(pod_info.pod_node_id, nd.id) AS node_id,
        pod_info.pod_name AS actual_pod_name,
        pod_info.pod_id AS actual_pod_id,
        pod_info.pod_uid AS kubernetes_uid,
        (SELECT COUNT(*)::int FROM nodes nd_cnt WHERE nd_cnt.cluster_id = c.id) AS cluster_node_count,
        rec_info.recommendation_id,
        rec_info.recommendation_action,
        rec_info.recommendation_reason,
        rec_info.recommendation_risk_level,
        rec_info.recommendation_priority,
        rec_info.requires_approval_by_default,
        ha.id AS healing_action_id,
        ha.execution_status AS healing_status,
        ha.approval_status AS healing_approval_status,
        ha.target_name AS healing_target_name,
        ha.action_name AS healing_action_name,
        ha.completed_at AS healing_completed_at,
        ha.pending_approval_id,
        (ha.pending_approval_id IS NOT NULL) AS has_pending_approval
      FROM incidents i
      LEFT JOIN organizations o ON o.id = i.organization_id
      LEFT JOIN environments e ON e.id = i.environment_id
      LEFT JOIN clusters c ON (c.id::text = i.cluster_id OR c.name = i.cluster_id OR c.cluster_uid = i.cluster_id)
      LEFT JOIN ai_predictions pred ON pred.id = i.prediction_id
      LEFT JOIN LATERAL (
        SELECT w.id, w.name, w.namespace_id, w.workload_type, w.kubernetes_uid
        FROM workloads w
        WHERE w.id::text = i.target_id
           OR (w.name = i.target_id AND (c.id IS NULL OR w.cluster_id = c.id::text OR w.cluster_id = i.cluster_id))
        ORDER BY (w.id::text = i.target_id) DESC, (w.deleted_at IS NULL) DESC, w.created_at DESC
        LIMIT 1
      ) w ON true
      LEFT JOIN namespaces ns ON ns.id = w.namespace_id
      LEFT JOIN LATERAL (
        SELECT p.id AS pod_id, p.name AS pod_name, p.kubernetes_uid AS pod_uid, nd_p.id AS pod_node_id, nd_p.name AS pod_node_name
        FROM pods p
        LEFT JOIN nodes nd_p ON nd_p.id = p.node_id
        WHERE p.deleted_at IS NULL
          AND (
            (w.id IS NOT NULL AND p.workload_id = w.id)
            OR (w.id IS NULL AND c.id IS NOT NULL AND p.cluster_id = c.id AND i.target_id IS NOT NULL AND (p.name = i.target_id OR p.name LIKE i.target_id || '-%'))
          )
        ORDER BY p.restart_count DESC NULLS LAST, p.created_at DESC
        LIMIT 1
      ) pod_info ON true
      LEFT JOIN LATERAL (
        SELECT nd.id, nd.name
        FROM nodes nd
        WHERE nd.cluster_id = c.id
        ORDER BY (nd.status = 'Ready') DESC, nd.created_at ASC
        LIMIT 1
      ) nd ON true
      LEFT JOIN LATERAL (
        SELECT r.id, r.root_cause_type, r.root_cause_description, r.confidence_score, r.analysis_method, r.analysis_result, r.analyzed_at
        FROM rca_analyses r
        WHERE r.incident_id = i.id
        ORDER BY r.analyzed_at DESC
        LIMIT 1
      ) r ON true
      LEFT JOIN LATERAL (
        SELECT
          rec.id AS recommendation_id,
          rec.recommendation AS recommendation_action,
          rec.reasoning AS recommendation_reason,
          COALESCE(rec.risk_level::text, hat.default_risk_level::text) AS recommendation_risk_level,
          CASE rec.priority
            WHEN 1 THEN 'CRITICAL'
            WHEN 2 THEN 'HIGH'
            WHEN 3 THEN 'MEDIUM'
            WHEN 4 THEN 'LOW'
            ELSE NULL
          END AS recommendation_priority,
          COALESCE(hat.requires_approval_by_default, false) AS requires_approval_by_default
        FROM ai_recommendations rec
        LEFT JOIN healing_action_types hat ON hat.id = rec.action_type_id
        WHERE rec.incident_id = i.id
        ORDER BY (rec.rca_analysis_id = r.id) DESC NULLS LAST, rec.priority ASC NULLS LAST, rec.created_at DESC
        LIMIT 1
      ) rec_info ON true
      LEFT JOIN LATERAL (
        SELECT
          ha.id,
          ha.execution_status,
          ha.approval_status,
          ha.target_name,
          hat.name AS action_name,
          ha.completed_at,
          ap.id AS pending_approval_id
        FROM healing_actions ha
        LEFT JOIN healing_action_types hat ON hat.id = ha.action_type_id
        LEFT JOIN approvals ap ON ap.healing_action_id = ha.id AND ap.status = 'PENDING'
        WHERE ha.incident_id = i.id
        ORDER BY (ap.id IS NOT NULL) DESC, ha.created_at DESC
        LIMIT 1
      ) ha ON true
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
