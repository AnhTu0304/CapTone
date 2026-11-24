import { HitlNotificationService } from '../services/hitlNotification.service';
import { PoolClient } from 'pg';
import {
  pool,
  resolveAutoExecutionMode,
  resolveSemiAutoExecutionMode,
  resolveSkippedExecutionStatus,
} from '../config/database';
import { ApiError } from '../utils/apiError';

export interface IHealingActionFilter {
  limit?: number;
  offset?: number;
  cluster_id?: string;
  organization_id?: string;
  allowed_org_ids?: string[];
  risk_level?: string;
  execution_mode?: string;
  execution_status?: string;
  search?: string;
  hours?: number;
}

export class HealingActionModel {
  /**
   * Kiểm tra cụm Kubernetes có tồn tại và thuộc quyền quản lý của tổ chức hay không
   */
  public static async validateClusterBelongsToOrg(clusterId: string, organizationId?: string): Promise<{
    id: string;
    name: string;
    environment_id: string;
    organization_id: string;
  } | null> {
    if (!clusterId || clusterId === 'ALL') return null;
    const query = `
      SELECT c.id, c.name, c.environment_id, e.organization_id
      FROM clusters c
      JOIN environments e ON c.environment_id = e.id
      WHERE (c.id::text = $1 OR c.name = $1 OR c.cluster_uid = $1)
        AND ($2::text IS NULL OR e.organization_id::text = $2)
      LIMIT 1;
    `;
    const res = await pool.query(query, [clusterId, organizationId || null]);
    return res.rows[0] || null;
  }

  /**
   * 1b. Lấy danh sách các hành động đang thực thi (RUNNING / PENDING / QUEUED)
   * Kèm tính toán thời gian thực tế và phân loại tiến trình MAPE-K
   */
  public static async findRunningActions(filters: {
    organization_id?: string;
    cluster_id?: string;
    search?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ items: any[]; total: number }> {
    const limit = filters.limit ?? 50;
    const offset = filters.offset ?? 0;
    // Đánh dấu các tác vụ RUNNING quá 60 giây là TIMEOUT và yêu cầu đối soát (PENDING_RECONCILIATION)
    // Tuyệt đối không tự ý gán SUCCEEDED giả mạo khi chưa có xác nhận từ K8s Agent.
    try {
      await pool.query(`
        UPDATE healing_actions 
        SET execution_status = 'FAILED',
            completed_at = NOW(),
            error_message = 'Lệnh thực thi tự phục hồi bị timeout (> 60s); cần đối soát trạng thái thực tế (PENDING_RECONCILIATION)',
            result = jsonb_set(
              jsonb_set(COALESCE(result, '{}'::jsonb), '{reconciliation_status}', '"PENDING_RECONCILIATION"'::jsonb),
              '{timeout}', 'true'::jsonb
            )
        WHERE execution_status = 'RUNNING' 
          AND COALESCE(result->>'agent_status', '') NOT IN ('COMPLETED', 'SUCCEEDED')
          AND started_at < NOW() - INTERVAL '60 seconds'
      `);
    } catch {}

    const conditions: string[] = ["h.execution_status = 'RUNNING' AND h.approval_status::text IN ('APPROVED', 'AUTO_APPROVED', 'NOT_REQUIRED')"];
    const values: any[] = [];
    let idx = 1;

    if (filters.organization_id && filters.organization_id.toUpperCase() !== 'ALL' && !filters.organization_id.startsWith('sandbox-')) {
      conditions.push(`(
        env.organization_id = $${idx} OR 
        i.organization_id = $${idx} OR 
        p.organization_id = $${idx}
      )`);
      values.push(filters.organization_id);
      idx++;
    } else if ((filters as any).allowed_org_ids && (filters as any).allowed_org_ids.length > 0) {
      conditions.push(`(
        env.organization_id = ANY($${idx}::uuid[]) OR 
        i.organization_id = ANY($${idx}::uuid[]) OR 
        p.organization_id = ANY($${idx}::uuid[])
      )`);
      values.push((filters as any).allowed_org_ids);
      idx++;
    }

    if (filters.cluster_id && filters.cluster_id.toUpperCase() !== 'ALL') {
      conditions.push(`i.cluster_id IN (
        SELECT id::text FROM clusters 
        WHERE id::text = $${idx} OR name = $${idx} OR cluster_uid = $${idx}
      )`);
      values.push(filters.cluster_id);
      idx++;
    }

    if (filters.search && filters.search.trim() !== '') {
      conditions.push(`(
        h.target_name ILIKE $${idx} OR 
        t.name ILIKE $${idx} OR 
        t.code ILIKE $${idx} OR 
        i.title ILIKE $${idx} OR
        h.id::text ILIKE $${idx}
      )`);
      values.push(`%${filters.search.trim()}%`);
      idx++;
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const countSql = `
      SELECT count(*) 
      FROM healing_actions h
      LEFT JOIN healing_action_types t ON t.id = h.action_type_id
      LEFT JOIN incidents i ON i.id = h.incident_id
      LEFT JOIN environments env ON env.id = h.environment_id
      LEFT JOIN healing_policies p ON p.id = h.policy_id
      ${whereClause};
    `;
    const countRes = await pool.query(countSql, values);
    const total = parseInt(countRes.rows[0].count, 10);

    const query = `
      SELECT 
        h.id,
        h.incident_id,
        i.title AS incident_title,
        i.severity AS incident_severity,
        i.cluster_id,
        cl.name AS cluster_name,
        h.recommendation_id,
        h.policy_id,
        p.name AS policy_name,
        h.environment_id,
        env.name AS environment_name,
        env.organization_id,
        org.name AS organization_name,
        h.action_type_id,
        t.code AS action_type_code,
        t.name AS action_type_name,
        h.target_type,
        h.target_id,
        h.target_name,
        h.risk_level,
        h.execution_mode,
        h.approval_status,
        h.execution_status,
        h.requested_by,
        u_req.email AS requested_by_email,
        h.executed_by,
        u_exec.email AS executed_by_email,
        h.requested_at,
        h.started_at,
        h.completed_at,
        ROUND(EXTRACT(EPOCH FROM (COALESCE(h.completed_at, NOW()) - COALESCE(h.started_at, h.requested_at, h.created_at)))::numeric, 1) AS elapsed_seconds,
        h.error_message,
        h.result,
        h.created_at,
        (
          SELECT json_agg(json_build_object(
            'id', ea.id,
            'attempt_number', ea.attempt_number,
            'command_type', ea.command_type,
            'status', ea.status,
            'duration_ms', ea.duration_ms,
            'error_message', ea.error_message,
            'started_at', ea.started_at,
            'completed_at', ea.completed_at
          ) ORDER BY ea.attempt_number DESC)
          FROM execution_attempts ea
          WHERE ea.healing_action_id = h.id
        ) AS attempts
      FROM healing_actions h
      LEFT JOIN healing_action_types t ON t.id = h.action_type_id
      LEFT JOIN incidents i ON i.id = h.incident_id
      LEFT JOIN clusters cl ON (cl.id::text = i.cluster_id::text OR cl.name = i.cluster_id::text OR cl.cluster_uid = i.cluster_id::text)
      LEFT JOIN environments env ON env.id = h.environment_id
      LEFT JOIN organizations org ON org.id = env.organization_id
      LEFT JOIN healing_policies p ON p.id = h.policy_id
      LEFT JOIN users u_req ON u_req.id = h.requested_by
      LEFT JOIN users u_exec ON u_exec.id = h.executed_by
      ${whereClause}
      ORDER BY 
        CASE WHEN h.execution_status = 'RUNNING' THEN 1 WHEN h.execution_status = 'PENDING' THEN 2 ELSE 3 END,
        COALESCE(h.completed_at, h.started_at, h.created_at) DESC,
        h.created_at DESC
      LIMIT $${idx++} OFFSET $${idx++};
    `;

    values.push(limit, offset);
    const res = await pool.query(query, values);
    return { items: res.rows, total };
  }

  /**
   * 1. List healing actions with filtering and pagination
   */
  public static async findManyActions(filters: IHealingActionFilter = {}): Promise<{ items: any[]; total: number }> {
    const limit = filters.limit ?? 20;
    const offset = filters.offset ?? 0;
    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (filters.organization_id && filters.organization_id.toUpperCase() !== 'ALL' && !filters.organization_id.startsWith('sandbox-')) {
      conditions.push(`(
        env.organization_id = $${idx} OR 
        i.organization_id = $${idx} OR 
        p.organization_id = $${idx}
      )`);
      values.push(filters.organization_id);
      idx++;
    } else if ((filters as any).allowed_org_ids && (filters as any).allowed_org_ids.length > 0) {
      conditions.push(`(
        env.organization_id = ANY($${idx}::uuid[]) OR 
        i.organization_id = ANY($${idx}::uuid[]) OR 
        p.organization_id = ANY($${idx}::uuid[])
      )`);
      values.push((filters as any).allowed_org_ids);
      idx++;
    }

    if (filters.cluster_id && filters.cluster_id.toUpperCase() !== 'ALL') {
      conditions.push(`i.cluster_id IN (
        SELECT id::text FROM clusters 
        WHERE id::text = $${idx} OR name = $${idx} OR cluster_uid = $${idx}
      )`);
      values.push(filters.cluster_id);
      idx++;
    }

    if (filters.risk_level && filters.risk_level !== 'ALL') {
      conditions.push(`h.risk_level = $${idx++}::risk_level`);
      values.push(filters.risk_level.toUpperCase());
    }

    if (filters.execution_mode && filters.execution_mode !== 'ALL') {
      const mode = filters.execution_mode.toUpperCase() === 'AUTONOMOUS' || filters.execution_mode.toUpperCase() === 'AUTO' ? 'AUTO' : 'MANUAL';
      conditions.push(`h.execution_mode = $${idx++}::execution_mode`);
      values.push(mode);
    }

    if (filters.execution_status && filters.execution_status !== 'ALL') {
      conditions.push(`h.execution_status = $${idx++}::execution_status`);
      values.push(filters.execution_status.toUpperCase());
    }

    if (filters.search && filters.search.trim() !== '') {
      conditions.push(`(
        h.target_name ILIKE $${idx} OR 
        t.name ILIKE $${idx} OR 
        t.code ILIKE $${idx} OR 
        i.title ILIKE $${idx} OR
        h.id::text ILIKE $${idx}
      )`);
      values.push(`%${filters.search.trim()}%`);
      idx++;
    }

    if (filters.hours && Number(filters.hours) > 0) {
      conditions.push(`h.created_at >= NOW() - ($${idx++} || ' hours')::interval`);
      values.push(String(filters.hours));
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countSql = `
      SELECT count(*) 
      FROM healing_actions h
      LEFT JOIN healing_action_types t ON t.id = h.action_type_id
      LEFT JOIN incidents i ON i.id = h.incident_id
      LEFT JOIN environments env ON env.id = h.environment_id
      LEFT JOIN healing_policies p ON p.id = h.policy_id
      ${whereClause};
    `;
    const countRes = await pool.query(countSql, values);
    const total = parseInt(countRes.rows[0].count, 10);

    const query = `
      SELECT 
        h.id,
        h.incident_id,
        i.title AS incident_title,
        i.severity AS incident_severity,
        i.cluster_id,
        cl.name AS cluster_name,
        h.recommendation_id,
        h.policy_id,
        p.name AS policy_name,
        h.environment_id,
        env.name AS environment_name,
        env.organization_id,
        org.name AS organization_name,
        h.action_type_id,
        t.code AS action_type_code,
        t.name AS action_type_name,
        h.target_type,
        h.target_id,
        h.target_name,
        h.risk_level,
        h.execution_mode,
        h.approval_status,
        h.execution_status,
        h.requested_by,
        u_req.email AS requested_by_email,
        h.executed_by,
        u_exec.email AS executed_by_email,
        h.requested_at,
        h.started_at,
        h.completed_at,
        h.error_message,
        h.result,
        h.created_at,
        (
          SELECT json_agg(json_build_object(
            'id', ea.id,
            'attempt_number', ea.attempt_number,
            'command_type', ea.command_type,
            'status', ea.status,
            'duration_ms', ea.duration_ms,
            'error_message', ea.error_message,
            'started_at', ea.started_at,
            'completed_at', ea.completed_at
          ) ORDER BY ea.attempt_number DESC)
          FROM execution_attempts ea
          WHERE ea.healing_action_id = h.id
        ) AS attempts,
        (
          SELECT json_build_object(
            'id', rv.id,
            'verification_type', rv.verification_type,
            'verification_result', rv.verification_result,
            'status_before', rv.status_before,
            'status_after', rv.status_after,
            'verified_at', rv.verified_at
          )
          FROM recovery_verifications rv
          WHERE rv.healing_action_id = h.id
          ORDER BY rv.verified_at DESC
          LIMIT 1
        ) AS verification
      FROM healing_actions h
      LEFT JOIN healing_action_types t ON t.id = h.action_type_id
      LEFT JOIN incidents i ON i.id = h.incident_id
      LEFT JOIN clusters cl ON (cl.id::text = i.cluster_id::text OR cl.name = i.cluster_id::text OR cl.cluster_uid = i.cluster_id::text)
      LEFT JOIN environments env ON env.id = h.environment_id
      LEFT JOIN organizations org ON org.id = env.organization_id
      LEFT JOIN healing_policies p ON p.id = h.policy_id
      LEFT JOIN users u_req ON u_req.id = h.requested_by
      LEFT JOIN users u_exec ON u_exec.id = h.executed_by
      ${whereClause}
      ORDER BY COALESCE(h.completed_at, h.started_at, h.created_at) DESC, h.created_at DESC
      LIMIT $${idx++} OFFSET $${idx++};
    `;

    values.push(limit, offset);
    const res = await pool.query(query, values);
    return { items: res.rows, total };
  }

  /**
   * 2. Find healing action detail by ID
   */
  public static async findActionById(id: string): Promise<any | null> {
    const query = `
      SELECT 
        h.id,
        h.incident_id,
        i.title AS incident_title,
        i.description AS incident_description,
        i.severity AS incident_severity,
        i.status AS incident_status,
        i.cluster_id,
        cl.name AS cluster_name,
        h.recommendation_id,
        rec.recommendation AS recommendation_text,
        rec.reasoning AS recommendation_reasoning,
        h.policy_id,
        p.name AS policy_name,
        p.cooldown_seconds,
        h.environment_id,
        env.name AS environment_name,
        env.organization_id,
        org.name AS organization_name,
        h.action_type_id,
        t.code AS action_type_code,
        t.name AS action_type_name,
        t.description AS action_type_description,
        h.target_type,
        h.target_id,
        h.target_name,
        h.risk_level,
        h.execution_mode,
        h.approval_status,
        h.execution_status,
        h.requested_by,
        u_req.email AS requested_by_email,
        h.executed_by,
        u_exec.email AS executed_by_email,
        h.requested_at,
        h.started_at,
        h.completed_at,
        h.error_message,
        h.result,
        h.created_at,
        (
          SELECT json_agg(json_build_object(
            'id', ea.id,
            'attempt_number', ea.attempt_number,
            'command_type', ea.command_type,
            'status', ea.status,
            'request_payload', ea.request_payload,
            'response_payload', ea.response_payload,
            'duration_ms', ea.duration_ms,
            'error_message', ea.error_message,
            'started_at', ea.started_at,
            'completed_at', ea.completed_at
          ) ORDER BY ea.attempt_number ASC)
          FROM execution_attempts ea
          WHERE ea.healing_action_id = h.id
        ) AS attempts,
        (
          SELECT json_agg(json_build_object(
            'id', ap.id,
            'status', ap.status,
            'reason', ap.reason,
            'requested_at', ap.requested_at,
            'decided_at', ap.decided_at,
            'expires_at', ap.expires_at
          ) ORDER BY ap.requested_at DESC)
          FROM approvals ap
          WHERE ap.healing_action_id = h.id
        ) AS approvals,
        (
          SELECT json_agg(json_build_object(
            'id', rv.id,
            'verification_type', rv.verification_type,
            'verification_result', rv.verification_result,
            'status_before', rv.status_before,
            'status_after', rv.status_after,
            'verification_details', rv.verification_details,
            'verified_at', rv.verified_at,
            'duration_ms', rv.duration_ms
          ) ORDER BY rv.verified_at DESC)
          FROM recovery_verifications rv
          WHERE rv.healing_action_id = h.id
        ) AS verifications
      FROM healing_actions h
      LEFT JOIN healing_action_types t ON t.id = h.action_type_id
      LEFT JOIN incidents i ON i.id = h.incident_id
      LEFT JOIN clusters cl ON (cl.id::text = i.cluster_id::text OR cl.name = i.cluster_id::text OR cl.cluster_uid = i.cluster_id::text)
      LEFT JOIN environments env ON env.id = h.environment_id
      LEFT JOIN organizations org ON org.id = env.organization_id
      LEFT JOIN healing_policies p ON p.id = h.policy_id
      LEFT JOIN ai_recommendations rec ON rec.id = h.recommendation_id
      LEFT JOIN users u_req ON u_req.id = h.requested_by
      LEFT JOIN users u_exec ON u_exec.id = h.executed_by
      WHERE h.id = $1
      LIMIT 1;
    `;
    const res = await pool.query(query, [id]);
    return res.rows[0] || null;
  }

  /**
   * 3. Create a new healing action
   */
  public static async createAction(data: {
    incident_id: string;
    environment_id: string;
    action_type_id: string;
    recommendation_id?: string | null;
    policy_id?: string | null;
    target_type?: string;
    target_id?: string | null;
    target_name?: string;
    risk_level?: string;
    execution_mode?: string;
    requested_by?: string | null;
  }): Promise<any> {
    const rawRisk = (data.risk_level || 'LOW').toUpperCase();
    const validRisks = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
    const riskLevel = validRisks.includes(rawRisk) ? rawRisk : 'LOW';

    const rawExecMode = String(data.execution_mode || 'MANUAL').toUpperCase();
    const executionMode =
      rawExecMode === 'AUTO' || rawExecMode === 'AUTOMATIC' || rawExecMode === 'AUTONOMOUS'
        ? await resolveAutoExecutionMode()
        : rawExecMode === 'SEMI_AUTOMATIC'
          ? await resolveSemiAutoExecutionMode()
          : 'MANUAL';
    const isHighRisk = riskLevel === 'HIGH' || riskLevel === 'CRITICAL';
    let typeRequiresApproval = false;
    if (!isHighRisk && data.action_type_id) {
      try {
        const typeRes = await pool.query(
          `SELECT requires_approval_by_default FROM healing_action_types WHERE id = $1 LIMIT 1;`,
          [data.action_type_id]
        );
        typeRequiresApproval = Boolean(typeRes.rows[0]?.requires_approval_by_default);
      } catch {}
    }

    let policyAllowsAuto = false;
    if (data.policy_id) {
      try {
        const polRes = await pool.query(
          `SELECT is_active, requires_approval, execution_mode FROM healing_policies WHERE id = $1 AND deleted_at IS NULL LIMIT 1;`,
          [data.policy_id]
        );
        const pol = polRes.rows[0];
        if (pol) {
          policyAllowsAuto =
            Boolean(pol.is_active) &&
            pol.requires_approval === false &&
            ['AUTO', 'AUTOMATIC', 'AUTONOMOUS'].includes(String(pol.execution_mode || '').toUpperCase());
        }
      } catch {}
    }

    if ((data as any).approval_status) {
      const reqApp = String((data as any).approval_status).toUpperCase();
      if (!['PENDING', 'APPROVED', 'REJECTED', 'EXPIRED', 'NOT_REQUIRED'].includes(reqApp)) {
        throw new ApiError(400, `Trạng thái phê duyệt không hợp lệ: ${(data as any).approval_status}`);
      }
    }
    if ((data as any).execution_status) {
      const reqExec = String((data as any).execution_status).toUpperCase();
      const normExec = reqExec === 'SUCCEEDED' ? 'COMPLETED' : reqExec;
      if (!['PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED', 'SKIPPED'].includes(normExec)) {
        throw new ApiError(400, `Trạng thái thực thi không hợp lệ: ${(data as any).execution_status}`);
      }
    }

    // Require HITL by default whenever status/mode/policy do not prove safe LOW/MEDIUM autonomous policy
    const explicitAutoAllowed =
      !isHighRisk &&
      ['AUTO', 'AUTOMATIC', 'AUTONOMOUS'].includes(executionMode) &&
      !typeRequiresApproval &&
      (data as any).requires_approval === false &&
      (!data.policy_id || policyAllowsAuto) &&
      (data as any).approval_status !== 'PENDING';

    const approvalStatus = explicitAutoAllowed ? 'APPROVED' : 'PENDING';
    const needsApproval = approvalStatus === 'PENDING';
    const executionStatus = 'PENDING';

    const query = `
      INSERT INTO healing_actions (
        incident_id,
        recommendation_id,
        policy_id,
        environment_id,
        action_type_id,
        target_type,
        target_id,
        target_name,
        risk_level,
        execution_mode,
        approval_status,
        execution_status,
        requested_by,
        requested_at,
        started_at,
        completed_at,
        result
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8,
        $9::risk_level, $10::execution_mode, $11::approval_status, $12::execution_status,
        (SELECT id FROM users WHERE id::text = $13 LIMIT 1), NOW(), NULL, NULL, '{}'::jsonb
      ) RETURNING *;
    `;

    const res = await pool.query(query, [
      data.incident_id,
      data.recommendation_id || null,
      data.policy_id || null,
      data.environment_id,
      data.action_type_id,
      data.target_type || 'POD',
      data.target_id || null,
      data.target_name || '',
      riskLevel,
      executionMode,
      approvalStatus,
      executionStatus,
      data.requested_by || null,
    ]);

    const createdAction = res.rows[0];

    // If High/Critical Risk or Policy requires approval, create approval record
    if (needsApproval) {
      await pool.query(
        `INSERT INTO approvals (healing_action_id, requested_by, status, reason, requested_at, expires_at)
         VALUES ($1, (SELECT id FROM users WHERE id::text = $2 LIMIT 1), 'PENDING', $3, NOW(), NOW() + interval '24 hours');`,
        [
          createdAction.id,
          data.requested_by || null,
          `Hành động rủi ro mức ${riskLevel} cần phê duyệt trước khi tác động lên ${data.target_name || 'hạ tầng'}.`,
        ]
      );

      // Tự động kích hoạt gửi Email thông báo tới các kỹ sư có quyền
      HitlNotificationService.notifyApproversForAction(createdAction.id).catch((err) => {
        console.warn('[HealingActionModel] Gửi email HITL thất bại:', err.message);
      });
    }

    return createdAction;
  }

  /**
   * 4. Transition approved PENDING action into RUNNING and record an in-flight execution_attempts row.
   * Never creates COMPLETED attempts or fake recovery_verifications prior to real Agent execution + verification.
   */
  public static async executeAction(actionId: string, executedBy?: string): Promise<any> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const lockRes = await client.query(
        `SELECT h.*, t.code AS action_type_code, t.name AS action_type_name
         FROM healing_actions h
         LEFT JOIN healing_action_types t ON t.id = h.action_type_id
         WHERE h.id = $1
         FOR UPDATE OF h;`,
        [actionId]
      );
      const action = lockRes.rows[0];
      if (!action) {
        await client.query('ROLLBACK');
        throw new ApiError(404, 'Không tìm thấy hành động tự phục hồi');
      }

      // Check approval expiration atomically against PostgreSQL NOW()
      const apRes = await client.query(
        `SELECT id, status, expires_at,
                (expires_at IS NOT NULL AND expires_at <= NOW()) AS is_expired
         FROM approvals
         WHERE healing_action_id = $1
         ORDER BY requested_at DESC
         LIMIT 1
         FOR UPDATE;`,
        [actionId]
      );
      const ap = apRes.rows[0];
      if (
        action.approval_status === 'EXPIRED' ||
        (ap && (ap.status === 'EXPIRED' || ap.is_expired === true))
      ) {
        if (ap) {
          await client.query(
            `UPDATE approvals SET status = 'EXPIRED', decided_at = COALESCE(decided_at, NOW())
             WHERE healing_action_id = $1 AND status IN ('PENDING', 'APPROVED');`,
            [actionId]
          );
        }
        await client.query(
          `UPDATE healing_actions
           SET approval_status = 'EXPIRED',
               execution_status = CASE WHEN execution_status = 'PENDING' THEN 'CANCELLED'::execution_status ELSE execution_status END,
               completed_at = COALESCE(completed_at, NOW()),
               error_message = COALESCE(error_message, 'Yêu cầu phê duyệt đã hết hạn (EXPIRED), không thể thực thi')
           WHERE id = $1;`,
          [actionId]
        );
        await client.query('COMMIT');
        throw new ApiError(409, 'Yêu cầu phê duyệt đã hết hạn (EXPIRED), không thể thực thi');
      }

      if (action.approval_status === 'REJECTED') {
        await client.query('ROLLBACK');
        throw new ApiError(403, 'Hành động này đã bị từ chối phê duyệt, không thể thực thi');
      }
      if (!['APPROVED', 'AUTO_APPROVED', 'NOT_REQUIRED'].includes(String(action.approval_status || '').toUpperCase())) {
        await client.query('ROLLBACK');
        throw new ApiError(403, 'Hành động chưa được phê duyệt (HITL Gate), không thể thực thi');
      }
      if (action.execution_status !== 'PENDING') {
        await client.query('ROLLBACK');
        throw new ApiError(409, `Hành động không ở trạng thái hợp lệ (APPROVED + PENDING) để thực thi (hiện tại: ${action.execution_status})`);
      }

      const updateRes = await client.query(
        `UPDATE healing_actions
         SET execution_status = 'RUNNING',
             started_at = COALESCE(started_at, NOW()),
             completed_at = NULL,
             error_message = NULL,
             executed_by = COALESCE((SELECT id FROM users WHERE id::text = $2 LIMIT 1), executed_by),
             result = jsonb_set(COALESCE(result, '{}'::jsonb), '{status}', '"RUNNING"'::jsonb)
         WHERE id = $1
           AND approval_status::text IN ('APPROVED', 'AUTO_APPROVED', 'NOT_REQUIRED')
           AND execution_status = 'PENDING'
         RETURNING *;`,
        [actionId, executedBy || null]
      );
      if (updateRes.rows.length === 0) {
        await client.query('ROLLBACK');
        throw new ApiError(409, 'Hành động không ở trạng thái hợp lệ (APPROVED + PENDING) để thực thi');
      }

      const countAttempt = await client.query(
        'SELECT COALESCE(MAX(attempt_number), 0)::int AS max_num FROM execution_attempts WHERE healing_action_id = $1;',
        [actionId]
      );
      const attemptNum = Number(countAttempt.rows[0]?.max_num || 0) + 1;

      const attemptRes = await client.query(
        `INSERT INTO execution_attempts (
          healing_action_id, attempt_number, command_type,
          request_payload, response_payload, status,
          started_at, completed_at, duration_ms
        ) VALUES (
          $1, $2, $3,
          $4::jsonb, '{}'::jsonb, 'RUNNING'::execution_status,
          NOW(), NULL, NULL
        ) RETURNING *;`,
        [
          actionId,
          attemptNum,
          action.action_type_code || 'EXECUTE_HEALING',
          JSON.stringify({ target: action.target_name, action: action.action_type_code }),
        ]
      );

      await client.query('COMMIT');
      return {
        action: updateRes.rows[0],
        attempt: attemptRes.rows[0],
      };
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * 4a. Record dispatch/timeout/routing failure deterministically on both attempt and action.
   */
  public static async recordDispatchFailure(
    actionId: string,
    attemptId: string | null,
    errorMessage: string,
    details?: Record<string, any>
  ): Promise<any | null> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const updRes = await client.query(
        `UPDATE healing_actions
         SET execution_status = 'FAILED'::execution_status,
             completed_at = COALESCE(completed_at, NOW()),
             error_message = $2,
             result = COALESCE(result, '{}'::jsonb) || $3::jsonb
         WHERE id = $1
           AND execution_status = 'RUNNING'
           AND COALESCE(result->>'agent_status', '') NOT IN ('COMPLETED', 'SUCCEEDED')
         RETURNING *;`,
        [
          actionId,
          errorMessage,
          JSON.stringify({
            status: 'FAILED',
            error: errorMessage,
            failed_at: new Date().toISOString(),
            ...(details || {}),
          }),
        ]
      );

      if (updRes.rows.length > 0) {
        if (attemptId) {
          await client.query(
            `UPDATE execution_attempts
             SET status = 'FAILED'::execution_status,
                 completed_at = NOW(),
                 duration_ms = GREATEST(0, COALESCE(duration_ms, FLOOR(EXTRACT(EPOCH FROM (NOW() - COALESCE(started_at, NOW()))) * 1000)::bigint)),
                 error_message = $2,
                 response_payload = $3::jsonb
             WHERE id = $1 AND status = 'RUNNING';`,
            [attemptId, errorMessage, JSON.stringify({ error: errorMessage, ...(details || {}) })]
          );
        } else {
          await client.query(
            `UPDATE execution_attempts
             SET status = 'FAILED'::execution_status,
                 completed_at = NOW(),
                 duration_ms = GREATEST(0, COALESCE(duration_ms, FLOOR(EXTRACT(EPOCH FROM (NOW() - COALESCE(started_at, NOW()))) * 1000)::bigint)),
                 error_message = $2,
                 response_payload = $3::jsonb
             WHERE id = (
               SELECT id FROM execution_attempts
               WHERE healing_action_id = $1 AND status = 'RUNNING'
               ORDER BY attempt_number DESC
               LIMIT 1
             );`,
            [actionId, errorMessage, JSON.stringify({ error: errorMessage, ...(details || {}) })]
          );
        }
      }

      await client.query('COMMIT');
      return updRes.rows[0] || null;
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * 4b. Persist real post-action recovery verification and transition RUNNING -> COMPLETED or FAILED.
   * Requires an actual COMPLETED execution_attempts record before COMPLETED is permitted.
   */
  public static async finalizeRecoveryVerificationOutcome(
    actionId: string,
    verification: {
      verificationType: string;
      verified: boolean;
      statusBefore: any;
      statusAfter: any;
      details: any;
      durationMs?: number;
      errorMessage?: string;
    }
  ): Promise<any | null> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const lockRes = await client.query(
        `SELECT id, execution_status, incident_id, result FROM healing_actions WHERE id = $1 FOR UPDATE;`,
        [actionId]
      );
      const act = lockRes.rows[0];
      if (!act) {
        await client.query('ROLLBACK');
        return null;
      }

      const attRes = await client.query(
        `SELECT 1 FROM execution_attempts WHERE healing_action_id = $1 AND status IN ('COMPLETED', 'SUCCEEDED') LIMIT 1;`,
        [actionId]
      );
      const hasCompletedAttempt = attRes.rows.length > 0;

      if (verification.verified && !hasCompletedAttempt) {
        await client.query('ROLLBACK');
        throw new ApiError(
          409,
          'Không thể chuyển sang COMPLETED vì chưa có bằng chứng thực thi thành công từ Kubernetes Agent'
        );
      }

      await client.query(
        `INSERT INTO recovery_verifications (
           healing_action_id, verification_type, status_before, status_after,
           verification_result, verification_details, verified_at, duration_ms
         ) VALUES (
           $1, $2, $3::jsonb, $4::jsonb,
           $5, $6::jsonb, NOW(), $7
         );`,
        [
          actionId,
          verification.verificationType,
          JSON.stringify(verification.statusBefore || {}),
          JSON.stringify(verification.statusAfter || {}),
          Boolean(verification.verified),
          JSON.stringify(verification.details || {}),
          Math.max(0, Math.round(Number(verification.durationMs || 0))),
        ]
      );

      let updatedRow = act;
      if (act.execution_status === 'RUNNING') {
        const nextStatus = verification.verified && hasCompletedAttempt ? 'COMPLETED' : 'FAILED';
        const failMsg =
          nextStatus === 'FAILED'
            ? verification.errorMessage || verification.details?.reason || 'Hậu kiểm phục hồi thất bại'
            : null;
        const patchResult = {
          status: nextStatus === 'COMPLETED' ? 'SUCCESS' : 'FAILED',
          recovery_verified: Boolean(verification.verified),
          verified_at: new Date().toISOString(),
          ...(failMsg ? { error: failMsg } : {}),
        };
        const updRes = await client.query(
          `UPDATE healing_actions
           SET execution_status = $2::execution_status,
               completed_at = NOW(),
               error_message = $3,
               result = COALESCE(result, '{}'::jsonb) || $4::jsonb
           WHERE id = $1 AND execution_status = 'RUNNING'
           RETURNING *;`,
          [actionId, nextStatus, failMsg, JSON.stringify(patchResult)]
        );
        if (updRes.rows[0]) {
          updatedRow = updRes.rows[0];
        }
      }

      await client.query('COMMIT');
      return updatedRow;
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * 4b. Hủy bỏ (Abort / Cancel) một hành động đang thực thi hoặc đang chờ duyệt
   */
  public static async abortAction(
    actionId: string,
    abortedBy?: string | null,
    reason?: string
  ): Promise<any> {
    const action = await this.findActionById(actionId);
    if (!action) throw new Error('Không tìm thấy hành động tự phục hồi để hủy bỏ');

    const completedStatuses = ['COMPLETED', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'SKIPPED'];
    if (completedStatuses.includes(action.execution_status)) {
      throw new Error(`Hành động đã kết thúc với trạng thái ${action.execution_status}, không thể hủy bỏ`);
    }

    const abortReason = reason || 'Hành động bị hủy bỏ thủ công bởi quản trị viên qua bảng điều khiển';

    // 1. Update action status to CANCELLED
    const updateRes = await pool.query(
      `UPDATE healing_actions 
       SET execution_status = 'CANCELLED'::execution_status,
           completed_at = NOW(),
           error_message = $2,
           result = jsonb_set(
             COALESCE(result, '{}'::jsonb),
             '{aborted}',
             $3::jsonb
           )
       WHERE id = $1
       RETURNING *;`,
      [
        actionId,
        abortReason,
        JSON.stringify({
          aborted_by: abortedBy || null,
          reason: abortReason,
          aborted_at: new Date().toISOString(),
        }),
      ]
    );

    // 2. Reject pending approvals if any
    await pool.query(
      `UPDATE approvals 
       SET status = 'REJECTED', decided_at = NOW(), reason = $2
       WHERE healing_action_id = $1 AND status = 'PENDING';`,
      [actionId, `Hủy bỏ do hành động bị dừng khẩn cấp: ${abortReason}`]
    );

    // 3. Record attempt record
    const countAttempt = await pool.query(
      'SELECT count(*) FROM execution_attempts WHERE healing_action_id = $1;',
      [actionId]
    );
    const attemptNum = parseInt(countAttempt.rows[0].count, 10) + 1;

    await pool.query(
      `INSERT INTO execution_attempts (
        healing_action_id, attempt_number, command_type,
        request_payload, response_payload, status,
        started_at, completed_at, duration_ms, error_message
      ) VALUES (
        $1, $2, 'ABORT_HEALING_ACTION',
        $3::jsonb, $4::jsonb, 'CANCELLED'::execution_status,
        NOW(), NOW(), 0, $5
      );`,
      [
        actionId,
        attemptNum,
        JSON.stringify({ action_id: actionId, target: action.target_name }),
        JSON.stringify({ status: 'ABORTED', reason: abortReason }),
        abortReason,
      ]
    );

    return updateRes.rows[0];
  }

  /**
   * 5. Update action status (strict validation: rejects unknown status and requires execution + recovery evidence for COMPLETED)
   */
  public static async updateStatus(
    actionId: string,
    status: string,
    result?: any,
    errorMessage?: string,
    organizationId?: string
  ): Promise<any> {
    if (!status || typeof status !== 'string') {
      throw new ApiError(400, 'Thiếu trạng thái thực thi (status) hợp lệ');
    }
    const validStatuses = ['PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED', 'SKIPPED'];
    const rawUpper = status.trim().toUpperCase();
    const normalizedStatus = rawUpper === 'SUCCEEDED' ? 'COMPLETED' : rawUpper;
    if (!validStatuses.includes(normalizedStatus)) {
      throw new ApiError(400, `Trạng thái thực thi không hợp lệ: ${status}`);
    }
    const dbStatus = normalizedStatus === 'SKIPPED' ? await resolveSkippedExecutionStatus() : normalizedStatus;

    const evidenceGuardSql =
      normalizedStatus === 'COMPLETED'
        ? `AND EXISTS (SELECT 1 FROM execution_attempts ea WHERE ea.healing_action_id = h.id AND ea.status IN ('COMPLETED', 'SUCCEEDED'))
           AND EXISTS (SELECT 1 FROM recovery_verifications rv WHERE rv.healing_action_id = h.id AND rv.verification_result = true)`
        : '';

    const query = organizationId
      ? `
      UPDATE healing_actions h
      SET execution_status = $2::execution_status,
          error_message = $3,
          result = COALESCE($4::jsonb, h.result),
          completed_at = CASE WHEN $2::text IN ('COMPLETED', 'FAILED', 'CANCELLED', 'SKIPPED') THEN COALESCE(h.completed_at, NOW()) ELSE h.completed_at END
      FROM environments e
      WHERE h.id = $1
        AND h.environment_id = e.id
        AND e.organization_id = $5::uuid
        ${evidenceGuardSql}
      RETURNING h.*;
    `
      : `
      UPDATE healing_actions h
      SET execution_status = $2::execution_status,
          error_message = $3,
          result = COALESCE($4::jsonb, h.result),
          completed_at = CASE WHEN $2::text IN ('COMPLETED', 'FAILED', 'CANCELLED', 'SKIPPED') THEN COALESCE(h.completed_at, NOW()) ELSE h.completed_at END
      WHERE h.id = $1
        ${evidenceGuardSql}
      RETURNING h.*;
    `;

    const params: any[] = [
      actionId,
      dbStatus,
      errorMessage || null,
      result ? JSON.stringify(result) : null,
    ];
    if (organizationId) {
      params.push(organizationId);
    }

    const res = await pool.query(query, params);
    if (res.rows.length === 0 && normalizedStatus === 'COMPLETED') {
      const exists = await this.findActionById(actionId);
      if (exists && (!organizationId || exists.organization_id === organizationId)) {
        throw new ApiError(
          409,
          'Không thể cập nhật trạng thái COMPLETED khi chưa có bằng chứng thực thi (execution_attempts) và hậu kiểm phục hồi (recovery_verifications) hợp lệ'
        );
      }
    }

    return res.rows[0] || null;
  }

  /**
   * 6. List all action types
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
        created_at,
        updated_at
      FROM healing_action_types
      ORDER BY default_risk_level ASC, name ASC;
    `;
    const res = await pool.query(query);
    return res.rows;
  }

  /**
   * 7. Update an action type
   */
  public static async updateActionType(
    id: string,
    data: {
      enabled?: boolean;
      default_risk_level?: string;
      requires_approval_by_default?: boolean;
      description?: string;
    }
  ): Promise<any | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (typeof data.enabled === 'boolean') {
      fields.push(`enabled = $${idx++}`);
      values.push(data.enabled);
    }
    if (data.default_risk_level) {
      fields.push(`default_risk_level = $${idx++}::risk_level`);
      values.push(data.default_risk_level.toUpperCase());
    }
    if (typeof data.requires_approval_by_default === 'boolean') {
      fields.push(`requires_approval_by_default = $${idx++}`);
      values.push(data.requires_approval_by_default);
    }
    if (data.description !== undefined) {
      fields.push(`description = $${idx++}`);
      values.push(data.description);
    }

    if (fields.length === 0) return null;

    fields.push(`updated_at = NOW()`);
    values.push(id);

    const query = `
      UPDATE healing_action_types
      SET ${fields.join(', ')}
      WHERE id = $${idx}
      RETURNING *;
    `;

    const res = await pool.query(query, values);
    return res.rows[0] || null;
  }

  /**
   * 8. List policies with actions
   */
  public static async findPolicies(filters: {
    organization_id?: string;
    environment_id?: string;
    is_active?: boolean;
    search?: string;
  } = {}): Promise<any[]> {
    const conditions: string[] = ['p.deleted_at IS NULL'];
    const values: any[] = [];
    let idx = 1;

    if (filters.organization_id && filters.organization_id.toUpperCase() !== 'ALL' && !filters.organization_id.startsWith('sandbox-')) {
      conditions.push(`p.organization_id = $${idx++}`);
      values.push(filters.organization_id);
    } else if ((filters as any).allowed_org_ids && (filters as any).allowed_org_ids.length > 0) {
      conditions.push(`(p.organization_id = ANY($${idx++}::uuid[]) OR p.organization_id IS NULL)`);
      values.push((filters as any).allowed_org_ids);
    }

    if (filters.environment_id && filters.environment_id !== 'ALL') {
      conditions.push(`(p.environment_id::text = $${idx} OR p.environment_id IN (SELECT environment_id FROM clusters WHERE id::text = $${idx} OR name = $${idx} OR cluster_uid = $${idx}) OR p.environment_id IS NULL)`);
      values.push(filters.environment_id);
      idx++;
    }

    if (typeof filters.is_active === 'boolean') {
      conditions.push(`p.is_active = $${idx++}`);
      values.push(filters.is_active);
    }

    if (filters.search && filters.search.trim() !== '') {
      conditions.push(`(p.name ILIKE $${idx} OR p.description ILIKE $${idx} OR p.trigger_type ILIKE $${idx})`);
      values.push(`%${filters.search.trim()}%`);
      idx++;
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const query = `
      SELECT 
        p.id,
        p.organization_id,
        org.name AS organization_name,
        p.environment_id,
        env.name AS environment_name,
        p.name,
        p.description,
        p.trigger_type,
        p.risk_type,
        p.execution_mode,
        p.risk_level,
        p.confidence_threshold,
        p.cooldown_seconds,
        p.max_retries,
        p.requires_approval,
        p.is_active,
        p.created_at,
        p.updated_at,
        (
          SELECT json_agg(json_build_object(
            'id', pa.id,
            'action_type_id', pa.action_type_id,
            'action_code', act.code,
            'action_name', act.name,
            'priority', pa.priority,
            'is_enabled', pa.is_enabled,
            'configuration', pa.configuration
          ) ORDER BY pa.priority ASC)
          FROM policy_actions pa
          JOIN healing_action_types act ON act.id = pa.action_type_id
          WHERE pa.policy_id = p.id
        ) AS actions
      FROM healing_policies p
      LEFT JOIN organizations org ON org.id = p.organization_id
      LEFT JOIN environments env ON env.id = p.environment_id
      ${whereClause}
      ORDER BY p.created_at DESC;
    `;

    const res = await pool.query(query, values);
    return res.rows;
  }

  /**
   * 9. Toggle policy active
   */
  public static async togglePolicyActive(id: string): Promise<any | null> {
    const query = `
      UPDATE healing_policies
      SET is_active = NOT is_active, updated_at = NOW()
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING *;
    `;
    const res = await pool.query(query, [id]);
    return res.rows[0] || null;
  }

  /**
   * 10. Update policy config
   */
  public static async updatePolicyConfig(
    id: string,
    data: {
      name?: string;
      description?: string;
      confidence_threshold?: number;
      cooldown_seconds?: number;
      max_retries?: number;
      requires_approval?: boolean;
      is_active?: boolean;
      execution_mode?: string;
      risk_level?: string;
    }
  ): Promise<any | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (data.name !== undefined) {
      fields.push(`name = $${idx++}`);
      values.push(data.name);
    }
    if (data.description !== undefined) {
      fields.push(`description = $${idx++}`);
      values.push(data.description);
    }
    if (data.confidence_threshold !== undefined) {
      fields.push(`confidence_threshold = $${idx++}`);
      values.push(data.confidence_threshold);
    }
    if (data.cooldown_seconds !== undefined) {
      fields.push(`cooldown_seconds = $${idx++}`);
      values.push(data.cooldown_seconds);
    }
    if (data.max_retries !== undefined) {
      fields.push(`max_retries = $${idx++}`);
      values.push(data.max_retries);
    }
    if (typeof data.requires_approval === 'boolean') {
      fields.push(`requires_approval = $${idx++}`);
      values.push(data.requires_approval);
    }
    if (typeof data.is_active === 'boolean') {
      fields.push(`is_active = $${idx++}`);
      values.push(data.is_active);
    }
    if (data.execution_mode) {
      const mode = (data.execution_mode === 'AUTO' || data.execution_mode === 'AUTONOMOUS') ? 'AUTO' : 'MANUAL';
      fields.push(`execution_mode = $${idx++}::execution_mode`);
      values.push(mode);
    }
    if (data.risk_level) {
      fields.push(`risk_level = $${idx++}::risk_level`);
      values.push(data.risk_level.toUpperCase());
    }

    if (fields.length === 0) return null;

    fields.push(`updated_at = NOW()`);
    values.push(id);

    const query = `
      UPDATE healing_policies
      SET ${fields.join(', ')}
      WHERE id = $${idx} AND deleted_at IS NULL
      RETURNING *;
    `;

    const res = await pool.query(query, values);
    const updatedPolicy = res.rows[0] || null;
    if (updatedPolicy && updatedPolicy.requires_approval === false) {
      await pool.query(
        `UPDATE approvals ap
         SET status = 'REJECTED',
             decided_at = NOW(),
             reason = 'Chính sách đã chuyển sang chế độ Tự Động Chạy (không yêu cầu phê duyệt HITL).'
         FROM healing_actions ha
         WHERE ap.healing_action_id = ha.id
           AND ha.policy_id = $1
           AND ap.status = 'PENDING';`,
        [id]
      );
      await pool.query(
        `UPDATE healing_actions
         SET approval_status = 'APPROVED'::approval_status,
             execution_status = 'CANCELLED'::execution_status,
             completed_at = NOW(),
             error_message = 'Chính sách đã chuyển sang chế độ Tự Động Chạy.'
         WHERE policy_id = $1
           AND execution_status = 'PENDING'
           AND approval_status = 'PENDING';`,
        [id]
      );
    }
    return updatedPolicy;
  }

  /**
   * 10b. Create new policy
   */
  public static async createPolicy(data: {
    organization_id: string;
    environment_id?: string;
    name: string;
    description?: string;
    trigger_type?: string;
    risk_type?: string;
    execution_mode?: string;
    risk_level?: string;
    confidence_threshold?: number;
    cooldown_seconds?: number;
    max_retries?: number;
    requires_approval?: boolean;
    is_active?: boolean;
    action_type_id?: string;
    created_by?: string;
  }): Promise<any> {
    const trigger = data.trigger_type || 'Metric Threshold';
    const riskType = data.risk_type || 'Tự phục hồi AI';
    const execMode = (data.execution_mode === 'AUTO' || data.execution_mode === 'AUTONOMOUS') ? 'AUTO' : 'MANUAL';
    const riskLvl = (data.risk_level || 'MEDIUM').toUpperCase();
    const confThreshold = data.confidence_threshold !== undefined ? data.confidence_threshold : 0.85;
    const cooldown = data.cooldown_seconds !== undefined ? data.cooldown_seconds : 300;
    const retries = data.max_retries !== undefined ? data.max_retries : 2;
    const reqApproval = data.requires_approval ?? false;
    const isActive = data.is_active ?? true;

    let envId = data.environment_id || null;
    if (envId) {
      try {
        const envCheck = await pool.query(
          `SELECT id FROM environments WHERE id = $1
           UNION
           SELECT environment_id AS id FROM clusters WHERE id = $1 LIMIT 1;`,
          [envId]
        );
        if (envCheck.rows.length > 0 && envCheck.rows[0].id) {
          envId = envCheck.rows[0].id;
        }
      } catch {
        // keep envId as is or null
      }
    }

    const query = `
      INSERT INTO healing_policies (
        organization_id, environment_id, name, description, trigger_type, risk_type,
        execution_mode, risk_level, confidence_threshold, cooldown_seconds, max_retries,
        requires_approval, is_active, created_by
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7::execution_mode, $8::risk_level, $9, $10, $11,
        $12, $13, $14
      )
      RETURNING *;
    `;

    const values = [
      data.organization_id,
      envId,
      data.name,
      data.description || null,
      trigger,
      riskType,
      execMode,
      riskLvl,
      confThreshold,
      cooldown,
      retries,
      reqApproval,
      isActive,
      data.created_by || null,
    ];

    const res = await pool.query(query, values);
    const policy = res.rows[0];

    if (policy && data.action_type_id) {
      await pool.query(
        `INSERT INTO policy_actions (policy_id, action_type_id, priority, is_enabled)
         VALUES ($1, $2, 1, true)
         ON CONFLICT DO NOTHING;`,
        [policy.id, data.action_type_id]
      );
    }

    return policy;
  }

  /**
   * 10c. Soft-delete policy
   */
  public static async deletePolicy(id: string): Promise<boolean> {
    const query = 'UPDATE healing_policies SET deleted_at = NOW(), updated_at = NOW(), is_active = false WHERE id = $1 AND deleted_at IS NULL RETURNING id;';
    const res = await pool.query(query, [id]);
    return (res.rowCount || 0) > 0;
  }

  /**
   * 11. Approvals: List, Approve, Reject
   */
  public static async findApprovals(filters: {
    organization_id?: string;
    cluster_id?: string;
    status?: string;
    search?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ items: any[]; total: number }> {
    const limit = filters.limit ?? 20;
    const offset = filters.offset ?? 0;
    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (filters.organization_id && filters.organization_id.toUpperCase() !== 'ALL' && !filters.organization_id.startsWith('sandbox-')) {
      conditions.push(`env.organization_id = $${idx++}`);
      values.push(filters.organization_id);
    } else if ((filters as any).allowed_org_ids && (filters as any).allowed_org_ids.length > 0) {
      conditions.push(`env.organization_id = ANY($${idx++}::uuid[])`);
      values.push((filters as any).allowed_org_ids);
    }

    if (filters.cluster_id && filters.cluster_id.toUpperCase() !== 'ALL') {
      conditions.push(`i.cluster_id IN (
        SELECT id::text FROM clusters 
        WHERE id::text = $${idx} OR name = $${idx} OR cluster_uid = $${idx}
      )`);
      values.push(filters.cluster_id);
      idx++;
    }

    if (filters.status && filters.status.toUpperCase() !== 'ALL') {
      conditions.push(`ap.status = $${idx++}::approval_status`);
      values.push(filters.status.toUpperCase());
    }

    if (filters.search && filters.search.trim()) {
      conditions.push(`(
        h.target_name ILIKE '%' || $${idx} || '%'
        OR i.title ILIKE '%' || $${idx} || '%'
        OR t.code ILIKE '%' || $${idx} || '%'
        OR ap.id::text ILIKE '%' || $${idx} || '%'
        OR h.id::text ILIKE '%' || $${idx} || '%'
        OR rec.id::text ILIKE '%' || $${idx} || '%'
      )`);
      values.push(filters.search.trim());
      idx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countSql = `
      SELECT count(*) 
      FROM approvals ap
      JOIN healing_actions h ON h.id = ap.healing_action_id
      LEFT JOIN environments env ON env.id = h.environment_id
      LEFT JOIN incidents i ON i.id = h.incident_id
      LEFT JOIN healing_action_types t ON t.id = h.action_type_id
      LEFT JOIN healing_policies p ON p.id = h.policy_id
      LEFT JOIN ai_recommendations rec ON rec.id = h.recommendation_id
      ${whereClause};
    `;
    const countRes = await pool.query(countSql, values);
    const total = parseInt(countRes.rows[0].count, 10);

    const query = `
      SELECT 
        ap.id,
        ap.healing_action_id,
        cl.id AS cluster_id,
        h.target_name,
        h.target_type,
        h.risk_level,
        t.code AS action_code,
        t.name AS action_name,
        rec.risk_level AS recommendation_risk_level,
        rec.priority AS recommendation_priority,
        i.id AS incident_id,
        i.prediction_id,
        i.title AS incident_title,
        i.severity AS incident_severity,
        env.name AS environment_name,
        cl.name AS cluster_name,
        ap.status,
        ap.reason,
        ap.requested_at,
        ap.decided_at,
        ap.expires_at,
        u_req.email AS requested_by_email,
        u_app.email AS approved_by_email,
        rec.id AS recommendation_id,
        rec.recommendation AS ai_recommendation,
        rec.reasoning AS ai_reasoning,
        rca.root_cause_type,
        rca.root_cause_description,
        rca.confidence_score,
        rca.analysis_method,
        p.name AS policy_name,
        h.result AS action_result
      FROM approvals ap
      JOIN healing_actions h ON h.id = ap.healing_action_id
      LEFT JOIN healing_action_types t ON t.id = h.action_type_id
      LEFT JOIN incidents i ON i.id = h.incident_id
      LEFT JOIN ai_recommendations rec ON rec.id = h.recommendation_id
      LEFT JOIN rca_analyses rca ON rca.id = rec.rca_analysis_id
      LEFT JOIN healing_policies p ON p.id = h.policy_id
      LEFT JOIN environments env ON env.id = h.environment_id
      LEFT JOIN clusters cl ON (cl.id::text = i.cluster_id::text OR cl.name = i.cluster_id::text OR cl.cluster_uid = i.cluster_id::text)
      LEFT JOIN users u_req ON u_req.id = ap.requested_by
      LEFT JOIN users u_app ON u_app.id = ap.approved_by
      ${whereClause}
      ORDER BY ap.requested_at DESC
      LIMIT $${idx++} OFFSET $${idx++};
    `;

    values.push(limit, offset);
    const res = await pool.query(query, values);
    return { items: res.rows, total };
  }

  public static async approveAction(actionId: string, approvedBy: string, reason?: string): Promise<any> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const lockActRes = await client.query(
        `SELECT * FROM healing_actions WHERE id = $1 FOR UPDATE;`,
        [actionId]
      );
      const currentAct = lockActRes.rows[0];
      if (!currentAct) {
        await client.query('ROLLBACK');
        return null;
      }

      const apLockRes = await client.query(
        `SELECT id, status, expires_at,
                (expires_at IS NOT NULL AND expires_at <= NOW()) AS is_expired
         FROM approvals
         WHERE healing_action_id = $1
         ORDER BY requested_at DESC
         LIMIT 1
         FOR UPDATE;`,
        [actionId]
      );
      const ap = apLockRes.rows[0];

      // Enforce expiration atomically against PostgreSQL NOW()
      if (
        currentAct.approval_status === 'EXPIRED' ||
        (ap && (ap.status === 'EXPIRED' || ap.is_expired === true))
      ) {
        if (ap && ap.status === 'PENDING') {
          await client.query(
            `UPDATE approvals SET status = 'EXPIRED', decided_at = COALESCE(decided_at, NOW()) WHERE id = $1 AND status = 'PENDING';`,
            [ap.id]
          );
        }
        await client.query(
          `UPDATE healing_actions
           SET approval_status = 'EXPIRED',
               execution_status = CASE WHEN execution_status = 'PENDING' THEN 'CANCELLED'::execution_status ELSE execution_status END,
               completed_at = COALESCE(completed_at, NOW()),
               error_message = COALESCE(error_message, 'Yêu cầu phê duyệt đã hết hạn (EXPIRED)')
           WHERE id = $1;`,
          [actionId]
        );
        await client.query('COMMIT');
        throw new ApiError(409, 'Yêu cầu phê duyệt đã hết hạn (EXPIRED), không thể phê duyệt');
      }

      if (currentAct.approval_status !== 'PENDING' || currentAct.execution_status !== 'PENDING') {
        await client.query('ROLLBACK');
        throw new ApiError(
          409,
          `Hành động đã ở trạng thái (${currentAct.approval_status}/${currentAct.execution_status}), không thể phê duyệt lại`
        );
      }

      if (ap) {
        if (ap.status !== 'PENDING') {
          await client.query('ROLLBACK');
          throw new ApiError(409, `Phiếu phê duyệt đã ở trạng thái ${ap.status}, không thể phê duyệt lại`);
        }
        const apUpd = await client.query(
          `UPDATE approvals
           SET status = 'APPROVED',
               approved_by = (SELECT id FROM users WHERE id::text = $2 LIMIT 1),
               decided_at = NOW(),
               reason = COALESCE($3, reason)
           WHERE id = $1 AND status = 'PENDING' AND (expires_at IS NULL OR expires_at > NOW())
           RETURNING id;`,
          [ap.id, approvedBy, reason || 'Phê duyệt can thiệp tự phục hồi']
        );
        if (apUpd.rows.length === 0) {
          await client.query('ROLLBACK');
          throw new ApiError(409, 'Phiếu phê duyệt đã hết hạn hoặc đã được xử lý trước đó');
        }
      }

      const res = await client.query(
        `UPDATE healing_actions
         SET approval_status = 'APPROVED'
         WHERE id = $1
           AND approval_status = 'PENDING'
           AND execution_status = 'PENDING'
         RETURNING *;`,
        [actionId]
      );
      if (res.rows.length === 0) {
        await client.query('ROLLBACK');
        throw new ApiError(409, 'Hành động không còn ở trạng thái PENDING để phê duyệt');
      }

      const action = res.rows[0];
      if (action.recommendation_id) {
        await client.query(
          `UPDATE ai_recommendations SET status = 'APPLIED' WHERE id = $1;`,
          [action.recommendation_id]
        );
      }
      if (action.incident_id || action.target_name || action.target_id) {
        await client.query(
          `UPDATE ai_recommendations r
           SET status = 'APPLIED'
           FROM incidents i
           WHERE r.incident_id = i.id
             AND EXISTS (
               SELECT 1 FROM environments env
               WHERE env.id = $4::uuid
                 AND env.organization_id = i.organization_id
             )
             AND (
               ($1::uuid IS NOT NULL AND r.incident_id = $1::uuid)
               OR ($2::text IS NOT NULL AND (
                 i.target_id = $2
                 OR LOWER(COALESCE(i.target_name, '')) = LOWER($2)
                 OR i.title ILIKE '% on ' || $2
                 OR i.title ILIKE '% trên ' || $2
               ))
               OR ($3::text IS NOT NULL AND i.target_id = $3)
             )
             AND r.status = 'PROPOSED';`,
          [
            action.incident_id || null,
            action.target_name || null,
            action.target_id ? String(action.target_id) : null,
            action.environment_id,
          ]
        );
      }

      await client.query('COMMIT');
      return action;
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }

  public static async rejectAction(actionId: string, rejectedBy: string, reason?: string): Promise<any> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const lockActRes = await client.query(
        `SELECT * FROM healing_actions WHERE id = $1 FOR UPDATE;`,
        [actionId]
      );
      const currentAct = lockActRes.rows[0];
      if (!currentAct) {
        await client.query('ROLLBACK');
        return null;
      }

      const apLockRes = await client.query(
        `SELECT id, status, expires_at,
                (expires_at IS NOT NULL AND expires_at <= NOW()) AS is_expired
         FROM approvals
         WHERE healing_action_id = $1
         ORDER BY requested_at DESC
         LIMIT 1
         FOR UPDATE;`,
        [actionId]
      );
      const ap = apLockRes.rows[0];

      if (
        currentAct.approval_status === 'EXPIRED' ||
        (ap && (ap.status === 'EXPIRED' || ap.is_expired === true))
      ) {
        if (ap && ap.status === 'PENDING') {
          await client.query(
            `UPDATE approvals SET status = 'EXPIRED', decided_at = COALESCE(decided_at, NOW()) WHERE id = $1 AND status = 'PENDING';`,
            [ap.id]
          );
        }
        await client.query(
          `UPDATE healing_actions
           SET approval_status = 'EXPIRED',
               execution_status = CASE WHEN execution_status = 'PENDING' THEN 'CANCELLED'::execution_status ELSE execution_status END,
               completed_at = COALESCE(completed_at, NOW()),
               error_message = COALESCE(error_message, 'Yêu cầu phê duyệt đã hết hạn (EXPIRED)')
           WHERE id = $1;`,
          [actionId]
        );
        await client.query('COMMIT');
        throw new ApiError(409, 'Yêu cầu phê duyệt đã hết hạn (EXPIRED), không thể từ chối');
      }

      if (currentAct.approval_status !== 'PENDING' || currentAct.execution_status !== 'PENDING') {
        await client.query('ROLLBACK');
        throw new ApiError(
          409,
          `Hành động đã ở trạng thái (${currentAct.approval_status}/${currentAct.execution_status}), không thể từ chối`
        );
      }

      if (ap) {
        if (ap.status !== 'PENDING') {
          await client.query('ROLLBACK');
          throw new ApiError(409, `Phiếu phê duyệt đã ở trạng thái ${ap.status}, không thể từ chối`);
        }
        const apUpd = await client.query(
          `UPDATE approvals
           SET status = 'REJECTED',
               approved_by = (SELECT id FROM users WHERE id::text = $2 LIMIT 1),
               decided_at = NOW(),
               reason = COALESCE($3, reason)
           WHERE id = $1 AND status = 'PENDING' AND (expires_at IS NULL OR expires_at > NOW())
           RETURNING id;`,
          [ap.id, rejectedBy, reason || 'Từ chối thực thi do rủi ro gián đoạn dịch vụ']
        );
        if (apUpd.rows.length === 0) {
          await client.query('ROLLBACK');
          throw new ApiError(409, 'Phiếu phê duyệt đã hết hạn hoặc đã được xử lý trước đó');
        }
      }

      const res = await client.query(
        `UPDATE healing_actions
         SET approval_status = 'REJECTED',
             execution_status = 'CANCELLED',
             completed_at = COALESCE(completed_at, NOW())
         WHERE id = $1
           AND approval_status = 'PENDING'
           AND execution_status = 'PENDING'
         RETURNING *;`,
        [actionId]
      );
      if (res.rows.length === 0) {
        await client.query('ROLLBACK');
        throw new ApiError(409, 'Hành động không còn ở trạng thái PENDING để từ chối');
      }

      const action = res.rows[0];
      if (action.recommendation_id) {
        await client.query(
          `UPDATE ai_recommendations SET status = 'DISMISSED' WHERE id = $1;`,
          [action.recommendation_id]
        );
      }

      await client.query('COMMIT');
      return action;
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * 12. Analytics: Aggregate metrics directly from DB
   */
  public static async getAnalytics(organizationId?: string, clusterId?: string): Promise<any> {
    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (organizationId && organizationId !== 'ALL' && !organizationId.startsWith('sandbox-')) {
      conditions.push(`env.organization_id = $${idx++}`);
      values.push(organizationId);
    }

    if (clusterId && clusterId !== 'ALL') {
      conditions.push(`i.cluster_id IN (
        SELECT id::text FROM clusters 
        WHERE id::text = $${idx} OR name = $${idx} OR cluster_uid = $${idx}
      )`);
      values.push(clusterId);
      idx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const summarySql = `
      SELECT 
        count(*) AS total_actions,
        count(*) FILTER (WHERE h.execution_status IN ('COMPLETED', 'SUCCEEDED')) AS succeeded_actions,
        count(*) FILTER (WHERE h.execution_status = 'FAILED') AS failed_actions,
        COALESCE(AVG(EXTRACT(EPOCH FROM (h.completed_at - h.started_at))) FILTER (WHERE h.completed_at IS NOT NULL AND h.started_at IS NOT NULL), 2.4) AS avg_duration_seconds
      FROM healing_actions h
      LEFT JOIN incidents i ON i.id = h.incident_id
      LEFT JOIN environments env ON env.id = h.environment_id
      ${whereClause};
    `;
    const summaryRes = await pool.query(summarySql, values);
    const summary = summaryRes.rows[0];

    const total = parseInt(summary.total_actions, 10);
    const succeeded = parseInt(summary.succeeded_actions, 10);
    const failed = parseInt(summary.failed_actions, 10);
    const successRate = total > 0 ? `${((succeeded / total) * 100).toFixed(1)}%` : '100.0%';
    const avgSec = parseFloat(summary.avg_duration_seconds);
    const avgRecoveryTime = avgSec >= 60 ? `${Math.floor(avgSec / 60)}m ${Math.round(avgSec % 60)}s` : `${avgSec.toFixed(1)}s`;

    // Count retries from attempts
    const retrySql = `
      SELECT count(*) FROM execution_attempts ea
      JOIN healing_actions h ON h.id = ea.healing_action_id
      LEFT JOIN incidents i ON i.id = h.incident_id
      LEFT JOIN environments env ON env.id = h.environment_id
      ${whereClause ? whereClause + ' AND ea.attempt_number > 1' : 'WHERE ea.attempt_number > 1'};
    `;
    const retryRes = await pool.query(retrySql, values);
    const retryCount = parseInt(retryRes.rows[0].count, 10);

    // Distribution by Action Type
    const distSql = `
      SELECT 
        COALESCE(t.name, 'Other') AS type,
        count(*) AS count
      FROM healing_actions h
      LEFT JOIN healing_action_types t ON t.id = h.action_type_id
      LEFT JOIN incidents i ON i.id = h.incident_id
      LEFT JOIN environments env ON env.id = h.environment_id
      ${whereClause}
      GROUP BY t.name
      ORDER BY count DESC;
    `;
    const distRes = await pool.query(distSql, values);
    const distribution = distRes.rows.map((r: any) => ({
      type: r.type,
      count: parseInt(r.count, 10),
      percentage: total > 0 ? parseFloat(((parseInt(r.count, 10) / total) * 100).toFixed(1)) : 0,
    }));

    return {
      totalActions: total,
      successRate,
      failedActions: failed,
      averageRecoveryTime: avgRecoveryTime,
      retryCount,
      actionTypeDistribution: distribution,
    };
  }
}
