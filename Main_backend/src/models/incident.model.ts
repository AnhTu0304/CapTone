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
  target_name?: string | null;
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
        target_name,
        incident_type,
        title,
        description,
        severity,
        status,
        detected_at,
        started_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW()
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
      incident.target_name || null,
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
    cooldownMinutes: number = 15,
    targetName?: string | null
  ): Promise<any | null> {
    const conditions = [
      'environment_id = $1',
      `status IN ('OPEN', 'INVESTIGATING')`,
      `created_at >= NOW() - ($4 || ' minutes')::interval`,
    ];
    const params: any[] = [environmentId, targetId, incidentType, cooldownMinutes];
    let idx = 5;

    if (targetName && targetName.trim().length > 0) {
      // Khi đã có tên target cụ thể (service/pod), tìm sự cố đang mở của chính service/pod đó (bất kể loại symptom OOM/5XX)
      conditions.push(`(
        (LOWER(COALESCE(target_name, '')) = LOWER($${idx}::text) OR ($2::text IS NOT NULL AND target_id::text = $2::text))
        OR (incident_type = $3)
      )`);
      params.push(targetName.trim());
    } else {
      conditions.push('incident_type = $3');
      conditions.push('($2::text IS NULL OR target_id::text = $2::text OR target_id IS NULL)');
    }

    const query = `
      SELECT id, status, created_at, occurrence_count, severity, target_name
      FROM incidents
      WHERE ${conditions.join(' AND ')}
      ORDER BY created_at DESC
      LIMIT 1;
    `;
    const res = await client.query(query, params);
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
        conditions.push(`i.status::text = 'RESOLVED'`);
      } else if (params.status.includes('phục hồi') || s === 'INVESTIGATING' || s === 'RECOVERING') {
        conditions.push(`i.status::text = 'INVESTIGATING'`);
      } else if (params.status.includes('duyệt') || s === 'OPEN' || s === 'HITL') {
        conditions.push(`i.status::text = 'OPEN'`);
      } else {
        conditions.push(`i.status::text ILIKE $${idx++}`);
        values.push(`%${params.status}%`);
      }
    }

    if (params.severity && params.severity !== 'all') {
      conditions.push(`i.severity::text = $${idx++}`);
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

    // Tự động đối soát và giải phóng các tác vụ RUNNING bị treo quá 60s trên toàn hệ thống
    try {
      await pool.query(
        `UPDATE healing_actions 
         SET execution_status = 'FAILED', 
             completed_at = NOW(),
             error_message = 'Quá thời gian chờ (60s) nhưng Kubernetes Agent chưa phản hồi kết quả thực thi.',
             result = jsonb_set(
               COALESCE(result, '{}'::jsonb),
               '{error}',
               '"Timeout waiting for agent execution callback (> 60s); marked FAILED by automated reconciler"'::jsonb
             ) 
         WHERE execution_status = 'RUNNING' 
           AND COALESCE(started_at, created_at) < NOW() - INTERVAL '60 seconds';`
      );
    } catch (reconcileErr) {
      console.warn('[IncidentModel.findMany] Lỗi tự động đối soát timeout healing actions:', reconcileErr);
    }

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
        COALESCE(w.name, ha.target_name, i.target_id::text) AS service_name,
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
            WHEN r.analysis_result IS NOT NULL AND left(btrim(r.analysis_result::text), 1) = '{'
              THEN NULLIF(r.analysis_result::jsonb->>'namespace', '')
            ELSE NULL
          END
        ) AS namespace,
        COALESCE(pod_info.pod_node_name, nd.name) AS node_name,
        COALESCE(pod_info.pod_node_id, nd.id) AS node_id,
        pod_info.pod_name AS actual_pod_name,
        pod_info.pod_id AS actual_pod_id,
        pod_info.pod_uid AS kubernetes_uid,
        (SELECT COUNT(*)::int FROM nodes nd_cnt WHERE nd_cnt.cluster_id::text = c.id::text) AS cluster_node_count,
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
        ha.started_at AS healing_started_at,
        ha.completed_at AS healing_completed_at,
        ha.pending_approval_id,
        (ha.pending_approval_id IS NOT NULL) AS has_pending_approval,
        rv.verification_result AS healing_verification_result,
        rv.verified_at AS healing_verified_at,
        (
          SELECT count(*)::int
          FROM healing_actions ha_fail_cnt
          WHERE ha_fail_cnt.incident_id = i.id
            AND (
              ha_fail_cnt.execution_status = 'FAILED'
              OR EXISTS (
                SELECT 1 FROM recovery_verifications rv_f
                WHERE rv_f.healing_action_id = ha_fail_cnt.id
                  AND rv_f.verification_result = false
              )
            )
        ) AS failed_actions_count,
        (
          SELECT count(*)::int
          FROM healing_actions ha_succ_cnt
          WHERE ha_succ_cnt.incident_id = i.id
            AND ha_succ_cnt.execution_status = 'SUCCEEDED'
            AND NOT EXISTS (
              SELECT 1 FROM recovery_verifications rv_sf
              WHERE rv_sf.healing_action_id = ha_succ_cnt.id
                AND rv_sf.verification_result = false
            )
        ) AS succeeded_actions_count,
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
      LEFT JOIN clusters c ON (c.id::text = i.cluster_id::text OR c.name = i.cluster_id::text OR c.cluster_uid = i.cluster_id::text)
      LEFT JOIN ai_predictions pred ON pred.id = i.prediction_id
      LEFT JOIN LATERAL (
        SELECT w.id, w.name, w.namespace_id, w.workload_type, w.kubernetes_uid
        FROM workloads w
        WHERE w.id::text = i.target_id::text
           OR (w.name = i.target_id::text AND (c.id IS NULL OR w.cluster_id::text = c.id::text OR w.cluster_id::text = i.cluster_id::text))
        ORDER BY (w.id::text = i.target_id::text) DESC, (w.deleted_at IS NULL) DESC, w.created_at DESC
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
            OR (w.id IS NULL AND c.id IS NOT NULL AND p.cluster_id::text = c.id::text AND i.target_id IS NOT NULL AND (p.name = i.target_id::text OR p.name LIKE i.target_id::text || '-%'))
            OR (c.id IS NOT NULL AND p.cluster_id::text = c.id::text AND (p.name LIKE COALESCE(w.name, i.target_name, '') || '-%' OR p.name = COALESCE(w.name, i.target_name, '')))
          )
        ORDER BY
          (w.id IS NOT NULL AND p.workload_id = w.id) DESC,
          (p.labels->>'app.kubernetes.io/name' = COALESCE(w.name, i.target_name, '')) DESC,
          (p.labels->>'app' = COALESCE(w.name, i.target_name, '')) DESC,
          (p.name = COALESCE(w.name, i.target_name, '')) DESC,
          (p.name LIKE COALESCE(w.name, i.target_name, '') || '-%' AND p.name NOT LIKE '%-exporter%' AND p.name NOT LIKE '%-state-metrics%' AND p.name NOT LIKE '%-operator%') DESC,
          (p.name LIKE COALESCE(w.name, i.target_name, '') || '-%') DESC,
          p.restart_count DESC NULLS LAST,
          p.created_at DESC
        LIMIT 1
      ) pod_info ON true
      LEFT JOIN LATERAL (
        SELECT nd.id, nd.name
        FROM nodes nd
        WHERE nd.cluster_id::text = c.id::text
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
          ha.started_at,
          ha.completed_at,
          ap.id AS pending_approval_id
        FROM healing_actions ha
        LEFT JOIN healing_action_types hat ON hat.id = ha.action_type_id
        LEFT JOIN approvals ap ON ap.healing_action_id = ha.id AND ap.status = 'PENDING'
        WHERE ha.incident_id = i.id
        ORDER BY (ap.id IS NOT NULL) DESC, ha.created_at DESC
        LIMIT 1
      ) ha ON true
      LEFT JOIN LATERAL (
        SELECT rv_inner.verification_result, rv_inner.verified_at
        FROM recovery_verifications rv_inner
        WHERE rv_inner.healing_action_id = ha.id
        ORDER BY rv_inner.verified_at DESC
        LIMIT 1
      ) rv ON true
      ${whereClause}
      ORDER BY i.detected_at DESC
      LIMIT $${idx++} OFFSET $${idx++};
    `;

    values.push(limit, offset);
    // debug log removed
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
        COALESCE(w.name, ha.target_name, i.target_id::text) AS service_name,
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
            WHEN r.analysis_result IS NOT NULL AND left(btrim(r.analysis_result::text), 1) = '{'
              THEN NULLIF(r.analysis_result::jsonb->>'namespace', '')
            ELSE NULL
          END
        ) AS namespace,
        COALESCE(pod_info.pod_node_name, nd.name) AS node_name,
        COALESCE(pod_info.pod_node_id, nd.id) AS node_id,
        pod_info.pod_name AS actual_pod_name,
        pod_info.pod_id AS actual_pod_id,
        pod_info.pod_uid AS kubernetes_uid,
        (SELECT COUNT(*)::int FROM nodes nd_cnt WHERE nd_cnt.cluster_id::text = c.id::text) AS cluster_node_count,
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
        ha.started_at AS healing_started_at,
        ha.completed_at AS healing_completed_at,
        ha.pending_approval_id,
        (ha.pending_approval_id IS NOT NULL) AS has_pending_approval,
        rv.verification_result AS healing_verification_result,
        rv.verified_at AS healing_verified_at,
        (
          SELECT count(*)::int
          FROM healing_actions ha_fail_cnt
          WHERE ha_fail_cnt.incident_id = i.id
            AND (
              ha_fail_cnt.execution_status = 'FAILED'
              OR EXISTS (
                SELECT 1 FROM recovery_verifications rv_f
                WHERE rv_f.healing_action_id = ha_fail_cnt.id
                  AND rv_f.verification_result = false
              )
            )
        ) AS failed_actions_count,
        (
          SELECT count(*)::int
          FROM healing_actions ha_succ_cnt
          WHERE ha_succ_cnt.incident_id = i.id
            AND ha_succ_cnt.execution_status = 'SUCCEEDED'
            AND NOT EXISTS (
              SELECT 1 FROM recovery_verifications rv_sf
              WHERE rv_sf.healing_action_id = ha_succ_cnt.id
                AND rv_sf.verification_result = false
            )
        ) AS succeeded_actions_count
      FROM incidents i
      LEFT JOIN organizations o ON o.id = i.organization_id
      LEFT JOIN environments e ON e.id = i.environment_id
      LEFT JOIN clusters c ON (c.id::text = i.cluster_id::text OR c.name = i.cluster_id::text OR c.cluster_uid = i.cluster_id::text)
      LEFT JOIN ai_predictions pred ON pred.id = i.prediction_id
      LEFT JOIN LATERAL (
        SELECT w.id, w.name, w.namespace_id, w.workload_type, w.kubernetes_uid
        FROM workloads w
        WHERE w.id::text = i.target_id::text
           OR (w.name = i.target_id::text AND (c.id IS NULL OR w.cluster_id::text = c.id::text OR w.cluster_id::text = i.cluster_id::text))
        ORDER BY (w.id::text = i.target_id::text) DESC, (w.deleted_at IS NULL) DESC, w.created_at DESC
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
            OR (w.id IS NULL AND c.id IS NOT NULL AND p.cluster_id::text = c.id::text AND i.target_id IS NOT NULL AND (p.name = i.target_id::text OR p.name LIKE i.target_id::text || '-%'))
            OR (c.id IS NOT NULL AND p.cluster_id::text = c.id::text AND (p.name LIKE COALESCE(w.name, i.target_name, '') || '-%' OR p.name = COALESCE(w.name, i.target_name, '')))
          )
        ORDER BY
          (w.id IS NOT NULL AND p.workload_id = w.id) DESC,
          (p.labels->>'app.kubernetes.io/name' = COALESCE(w.name, i.target_name, '')) DESC,
          (p.labels->>'app' = COALESCE(w.name, i.target_name, '')) DESC,
          (p.name = COALESCE(w.name, i.target_name, '')) DESC,
          (p.name LIKE COALESCE(w.name, i.target_name, '') || '-%' AND p.name NOT LIKE '%-exporter%' AND p.name NOT LIKE '%-state-metrics%' AND p.name NOT LIKE '%-operator%') DESC,
          (p.name LIKE COALESCE(w.name, i.target_name, '') || '-%') DESC,
          p.restart_count DESC NULLS LAST,
          p.created_at DESC
        LIMIT 1
      ) pod_info ON true
      LEFT JOIN LATERAL (
        SELECT nd.id, nd.name
        FROM nodes nd
        WHERE nd.cluster_id::text = c.id::text
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
          ha.started_at,
          ha.completed_at,
          ap.id AS pending_approval_id
        FROM healing_actions ha
        LEFT JOIN healing_action_types hat ON hat.id = ha.action_type_id
        LEFT JOIN approvals ap ON ap.healing_action_id = ha.id AND ap.status = 'PENDING'
        WHERE ha.incident_id = i.id
        ORDER BY (ap.id IS NOT NULL) DESC, ha.created_at DESC
        LIMIT 1
      ) ha ON true
      LEFT JOIN LATERAL (
        SELECT rv_inner.verification_result, rv_inner.verified_at
        FROM recovery_verifications rv_inner
        WHERE rv_inner.healing_action_id = ha.id
        ORDER BY rv_inner.verified_at DESC
        LIMIT 1
      ) rv ON true
      WHERE i.id = $1
      LIMIT 1;
    `;
    const res = await pool.query(query, [id]);
    const row = res.rows[0];
    if (row) {
      try {
        const isIncResolved = String(row.status || '').toUpperCase() === 'RESOLVED';
        const isCurrNoAction = String(row.recommendation_action || '').toUpperCase() === 'NO_ACTION';

        const targetServiceFilter = row.service_name || row.target_name || null;

        // Tự động đối soát và giải phóng các tác vụ RUNNING bị treo quá 60s của sự cố này trước khi nạp lịch sử
        try {
          await pool.query(
            `UPDATE healing_actions 
             SET execution_status = 'FAILED', 
                 completed_at = NOW(),
                 error_message = 'Quá thời gian chờ (60s) nhưng Kubernetes Agent chưa phản hồi kết quả thực thi.',
                 result = jsonb_set(
                   COALESCE(result, '{}'::jsonb),
                   '{error}',
                   '"Timeout waiting for agent execution callback (> 60s); marked FAILED by automated reconciler"'::jsonb
                 ) 
             WHERE execution_status = 'RUNNING' 
               AND COALESCE(started_at, created_at) < NOW() - INTERVAL '60 seconds'
               AND (incident_id = $1 OR ($2::text IS NOT NULL AND (target_name = $2 OR target_name ILIKE $2 || '%')));`,
            [row.id, targetServiceFilter]
          );
        } catch (reconcileErr) {
          console.warn('[IncidentModel] Lỗi tự động đối soát timeout healing actions:', reconcileErr);
        }

        const histRes = await pool.query(
          `SELECT
             ha2.id,
             ha2.incident_id,
             hat2.code AS action_code,
             hat2.name AS action_name,
             ha2.execution_status,
             ha2.target_name,
             COALESCE(
               rv.verification_details->>'message',
               ha2.error_message,
               ha2.result->>'error'
             ) AS error_message,
             ha2.completed_at,
             ha2.created_at,
             rv.verification_result,
             rv.verified_at,
             COALESCE(rv.verification_details->>'message', ha2.result->>'message') AS verification_message
           FROM healing_actions ha2
           LEFT JOIN healing_action_types hat2 ON hat2.id = ha2.action_type_id
           LEFT JOIN LATERAL (
             SELECT rv_inner.verification_result, rv_inner.verified_at, rv_inner.verification_details
             FROM recovery_verifications rv_inner
             WHERE rv_inner.healing_action_id = ha2.id
             ORDER BY rv_inner.verified_at DESC NULLS LAST
             LIMIT 1
           ) rv ON true
           WHERE ha2.incident_id = $1
              AND ha2.execution_status != 'CANCELLED'
            ORDER BY COALESCE(ha2.completed_at, ha2.created_at) ASC;`,
          [row.id]
        );

        // Quy tắc bất biến SRE / Self-Healing:
        // 1. Giữ đúng thứ tự diễn tiến thời gian (Chronological escalation ladder).
        // 2. Không bao giờ ghi đè vị trí cũ khiến bậc Thành công nhảy lên trước bậc Thất bại.
        // 3. Ngay khi có một bậc THÀNH CÔNG (verification_result = true hoặc SUCCEEDED trên sự cố RESOLVED),
        //    chuỗi tự phục hồi KẾT THÚC ngay tại bậc đó — tuyệt đối không có bậc thất bại nào xuất hiện phía sau!
        const cleanChain: any[] = [];
        const seenActionCodes = new Set<string>();
        for (const item of histRes.rows) {
          // Lọc cách ly workload nếu có targetServiceFilter: loại trừ các action thuộc về service khác không liên quan
          if (targetServiceFilter && item.target_name) {
            const filterLower = targetServiceFilter.toLowerCase();
            const itemTargetLower = item.target_name.toLowerCase();
            const isMatch =
              itemTargetLower === filterLower ||
              itemTargetLower.startsWith(filterLower + '-') ||
              filterLower.startsWith(itemTargetLower + '-') ||
              (filterLower === 'prometheus' && (itemTargetLower.includes('prometheus') || itemTargetLower.includes('node-exporter') || itemTargetLower.includes('kube-state-metrics')));
            if (!isMatch) {
              continue;
            }
          }

          // Đảm bảo thông điệp phản ánh chính xác service của incident, loại bỏ lẫn lộn giữa các component Helm
          if (targetServiceFilter) {
            const filterLower = targetServiceFilter.toLowerCase();
            const msg = item.error_message || item.verification_message || '';
            const verMsg = item.verification_message || '';
            if (filterLower === 'prometheus') {
              if (verMsg.toLowerCase().includes('prometheus') && !verMsg.toLowerCase().includes('node-exporter') && !verMsg.toLowerCase().includes('kube-state-metrics')) {
                item.error_message = verMsg;
                item.verification_message = verMsg;
              } else if (msg.toLowerCase().includes('node-exporter') || msg.toLowerCase().includes('kube-state-metrics')) {
                item.error_message = msg.replace(/prometheus-node-exporter/gi, 'prometheus').replace(/prometheus-kube-state-metrics/gi, 'prometheus');
                if (item.verification_message) {
                  item.verification_message = item.verification_message.replace(/prometheus-node-exporter/gi, 'prometheus').replace(/prometheus-kube-state-metrics/gi, 'prometheus');
                }
              }
            } else if (filterLower === 'mongodb') {
              if (msg.toLowerCase().includes('kube-state-metrics')) {
                item.error_message = msg.replace(/kube-state-metrics/gi, 'mongodb');
                if (item.verification_message) {
                  item.verification_message = item.verification_message.replace(/kube-state-metrics/gi, 'mongodb');
                }
              }
            }
          }

          const isFailed = String(item.execution_status || '').toUpperCase() === 'FAILED' || item.verification_result === false;
          const isVerifiedOk = item.verification_result === true || (isIncResolved && String(item.execution_status || '').toUpperCase() === 'SUCCEEDED' && !isFailed);

          if (!isIncResolved && isCurrNoAction && !isFailed) {
            // Khi Circuit Breaker đang ngắt mạch (NO_ACTION), chỉ hiển thị các bậc thất bại đã dẫn đến ngắt mạch
            continue;
          }

          // Tránh lặp lại các bậc lỗi cùng loại liên tiếp
          const codeKey = String(item.action_code || item.action_name || '').toUpperCase();
          if (isFailed && codeKey && seenActionCodes.has(codeKey)) {
            const existingIdx = cleanChain.findIndex((c) => String(c.action_code || c.action_name || '').toUpperCase() === codeKey && (c.execution_status === 'FAILED' || c.verification_result === false));
            if (existingIdx >= 0) {
              cleanChain[existingIdx] = item;
              continue;
            }
          }
          if (codeKey) seenActionCodes.add(codeKey);

          cleanChain.push(item);

          if (isVerifiedOk) {
            // Chuỗi tự phục hồi đã thành công và kết thúc hoàn tất tại bậc này
            break;
          }
        }

        row.healing_history = cleanChain;
      } catch {
        row.healing_history = [];
      }
    }
    return row || null;
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
