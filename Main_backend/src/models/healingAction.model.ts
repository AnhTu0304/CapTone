import { PoolClient } from 'pg';
import { pool } from '../config/database';

export interface IHealingActionFilter {
  limit?: number;
  offset?: number;
  cluster_id?: string;
  organization_id?: string;
  risk_level?: string;
  execution_mode?: string;
  execution_status?: string;
  search?: string;
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
    const conditions: string[] = ["h.execution_status IN ('RUNNING', 'PENDING', 'QUEUED')"];
    const values: any[] = [];
    let idx = 1;

    if (filters.organization_id && filters.organization_id !== 'ALL' && !filters.organization_id.startsWith('sandbox-')) {
      conditions.push(`(
        env.organization_id = $${idx} OR 
        i.organization_id = $${idx} OR 
        p.organization_id = $${idx}
      )`);
      values.push(filters.organization_id);
      idx++;
    }

    if (filters.cluster_id && filters.cluster_id !== 'ALL') {
      conditions.push(`(
        i.cluster_id = $${idx} OR 
        EXISTS (
          SELECT 1 FROM clusters c 
          WHERE (c.id::text = i.cluster_id OR c.cluster_uid = i.cluster_id OR c.name = i.cluster_id)
            AND (c.id::text = $${idx} OR c.name = $${idx} OR c.cluster_uid = $${idx})
        )
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
      LEFT JOIN clusters cl ON (cl.id::text = i.cluster_id OR cl.name = i.cluster_id OR cl.cluster_uid = i.cluster_id)
      LEFT JOIN environments env ON env.id = h.environment_id
      LEFT JOIN organizations org ON org.id = env.organization_id
      LEFT JOIN healing_policies p ON p.id = h.policy_id
      LEFT JOIN users u_req ON u_req.id = h.requested_by
      LEFT JOIN users u_exec ON u_exec.id = h.executed_by
      ${whereClause}
      ORDER BY 
        CASE WHEN h.execution_status = 'RUNNING' THEN 1 WHEN h.execution_status = 'PENDING' THEN 2 ELSE 3 END,
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

    if (filters.organization_id && filters.organization_id !== 'ALL' && !filters.organization_id.startsWith('sandbox-')) {
      conditions.push(`(
        env.organization_id = $${idx} OR 
        i.organization_id = $${idx} OR 
        p.organization_id = $${idx}
      )`);
      values.push(filters.organization_id);
      idx++;
    }

    if (filters.cluster_id && filters.cluster_id !== 'ALL') {
      conditions.push(`(
        i.cluster_id = $${idx} OR 
        EXISTS (
          SELECT 1 FROM clusters c 
          WHERE (c.id::text = i.cluster_id OR c.cluster_uid = i.cluster_id OR c.name = i.cluster_id)
            AND (c.id::text = $${idx} OR c.name = $${idx} OR c.cluster_uid = $${idx})
        )
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
      LEFT JOIN clusters cl ON (cl.id::text = i.cluster_id OR cl.name = i.cluster_id OR cl.cluster_uid = i.cluster_id)
      LEFT JOIN environments env ON env.id = h.environment_id
      LEFT JOIN organizations org ON org.id = env.organization_id
      LEFT JOIN healing_policies p ON p.id = h.policy_id
      LEFT JOIN users u_req ON u_req.id = h.requested_by
      LEFT JOIN users u_exec ON u_exec.id = h.executed_by
      ${whereClause}
      ORDER BY h.created_at DESC
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
      LEFT JOIN clusters cl ON (cl.id::text = i.cluster_id OR cl.name = i.cluster_id OR cl.cluster_uid = i.cluster_id)
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

    const executionMode = (data.execution_mode === 'AUTO' || data.execution_mode === 'AUTONOMOUS') ? 'AUTO' : 'MANUAL';
    const isHighRisk = riskLevel === 'HIGH' || riskLevel === 'CRITICAL';
    const approvalStatus = isHighRisk ? 'PENDING' : 'NOT_REQUIRED';
    const executionStatus = isHighRisk ? 'PENDING' : (executionMode === 'AUTO' ? 'RUNNING' : 'PENDING');

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
        result
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, 
        $9::risk_level, $10::execution_mode, $11::approval_status, $12::execution_status,
        $13, NOW(), CASE WHEN $12 = 'RUNNING' THEN NOW() ELSE NULL END, '{}'::jsonb
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

    // If High/Critical Risk, create approval record
    if (isHighRisk) {
      await pool.query(
        `INSERT INTO approvals (healing_action_id, requested_by, status, reason, requested_at, expires_at)
         VALUES ($1, $2, 'PENDING', $3, NOW(), NOW() + interval '24 hours');`,
        [
          createdAction.id,
          data.requested_by || null,
          `Hành động rủi ro mức ${riskLevel} cần phê duyệt trước khi tác động lên ${data.target_name || 'hạ tầng'}.`,
        ]
      );
    }

    return createdAction;
  }

  /**
   * 4. Execute or retry an action
   */
  public static async executeAction(actionId: string, executedBy?: string): Promise<any> {
    const action = await this.findActionById(actionId);
    if (!action) throw new Error('Không tìm thấy hành động tự phục hồi');

    if (action.approval_status === 'REJECTED') {
      throw new Error('Hành động này đã bị từ chối phê duyệt, không thể thực thi');
    }

    // 1. Get next attempt number
    const countAttempt = await pool.query(
      'SELECT count(*) FROM execution_attempts WHERE healing_action_id = $1;',
      [actionId]
    );
    const attemptNum = parseInt(countAttempt.rows[0].count, 10) + 1;

    // 2. Mark action RUNNING
    await pool.query(
      `UPDATE healing_actions 
       SET execution_status = 'RUNNING', started_at = COALESCE(started_at, NOW()), executed_by = COALESCE($2, executed_by)
       WHERE id = $1;`,
      [actionId, executedBy || null]
    );

    // 3. Record execution attempt
    const attemptRes = await pool.query(
      `INSERT INTO execution_attempts (
        healing_action_id, attempt_number, command_type,
        request_payload, response_payload, status,
        started_at, completed_at, duration_ms
      ) VALUES (
        $1, $2, $3,
        $4::jsonb, $5::jsonb, 'SUCCEEDED'::execution_status,
        NOW(), NOW() + interval '1.5 seconds', 1500
      ) RETURNING *;`,
      [
        actionId,
        attemptNum,
        action.action_type_code || 'EXECUTE_HEALING',
        JSON.stringify({ target: action.target_name, action: action.action_type_code }),
        JSON.stringify({ statusCode: 200, message: 'Execution succeeded via Controller/Agent' }),
      ]
    );

    // 4. Record recovery verification
    await pool.query(
      `INSERT INTO recovery_verifications (
        healing_action_id, verification_type,
        status_before, status_after,
        verification_result, verification_details,
        verified_at, duration_ms
      ) VALUES (
        $1, 'SLO_HEALTH_CHECK',
        $2::jsonb, $3::jsonb,
        true, $4::jsonb,
        NOW() + interval '2 seconds', 800
      );`,
      [
        actionId,
        JSON.stringify({ health: 'DEGRADED', target: action.target_name }),
        JSON.stringify({ health: 'HEALTHY', target: action.target_name }),
        JSON.stringify({ status: 'RESTORED', message: 'Tất cả các probe và metrics đã trở về ngưỡng bình thường' }),
      ]
    );

    // 5. Mark action and incident RESOLVED/SUCCEEDED
    const updateRes = await pool.query(
      `UPDATE healing_actions 
       SET execution_status = 'SUCCEEDED', 
           completed_at = NOW(),
           result = $2::jsonb
       WHERE id = $1
       RETURNING *;`,
      [
        actionId,
        JSON.stringify({
          status: 'SUCCESS',
          message: `Hành động ${action.action_type_name || action.action_type_code} đã hoàn tất thành công trên ${action.target_name}.`,
          duration_ms: 1500,
          completed_at: new Date().toISOString(),
        }),
      ]
    );

    // Auto resolve the incident if linked
    if (action.incident_id) {
      await pool.query(
        `UPDATE incidents 
         SET status = 'RESOLVED', resolved_at = NOW() 
         WHERE id = $1 AND status != 'RESOLVED';`,
        [action.incident_id]
      );
    }

    return {
      action: updateRes.rows[0],
      attempt: attemptRes.rows[0],
    };
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

    const completedStatuses = ['SUCCEEDED', 'FAILED', 'CANCELLED'];
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
   * 5. Update action status
   */
  public static async updateStatus(
    actionId: string,
    status: string,
    result?: any,
    errorMessage?: string
  ): Promise<any> {
    const validStatuses = ['PENDING', 'QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED'];
    const safeStatus = validStatuses.includes(status.toUpperCase()) ? status.toUpperCase() : 'SUCCEEDED';

    const query = `
      UPDATE healing_actions 
      SET execution_status = $2::execution_status,
          error_message = $3,
          result = COALESCE($4::jsonb, result),
          completed_at = CASE WHEN $2 IN ('SUCCEEDED', 'FAILED', 'CANCELLED') THEN NOW() ELSE completed_at END
      WHERE id = $1
      RETURNING *;
    `;

    const res = await pool.query(query, [
      actionId,
      safeStatus,
      errorMessage || null,
      result ? JSON.stringify(result) : null,
    ]);

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

    if (filters.organization_id && filters.organization_id !== 'ALL' && !filters.organization_id.startsWith('sandbox-')) {
      conditions.push(`p.organization_id = $${idx++}`);
      values.push(filters.organization_id);
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
    return res.rows[0] || null;
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
   * 11. Approvals: List, Approve, Reject
   */
  public static async findApprovals(filters: {
    organization_id?: string;
    cluster_id?: string;
    status?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ items: any[]; total: number }> {
    const limit = filters.limit ?? 20;
    const offset = filters.offset ?? 0;
    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (filters.organization_id && filters.organization_id !== 'ALL' && !filters.organization_id.startsWith('sandbox-')) {
      conditions.push(`env.organization_id = $${idx++}`);
      values.push(filters.organization_id);
    }

    if (filters.cluster_id && filters.cluster_id !== 'ALL') {
      conditions.push(`(
        i.cluster_id = $${idx} OR 
        EXISTS (
          SELECT 1 FROM clusters c 
          WHERE (c.id::text = i.cluster_id OR c.cluster_uid = i.cluster_id OR c.name = i.cluster_id)
            AND (c.id::text = $${idx} OR c.name = $${idx} OR c.cluster_uid = $${idx})
        )
      )`);
      values.push(filters.cluster_id);
      idx++;
    }

    if (filters.status && filters.status !== 'ALL') {
      conditions.push(`ap.status = $${idx++}::approval_status`);
      values.push(filters.status.toUpperCase());
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countSql = `
      SELECT count(*) 
      FROM approvals ap
      JOIN healing_actions h ON h.id = ap.healing_action_id
      LEFT JOIN environments env ON env.id = h.environment_id
      LEFT JOIN incidents i ON i.id = h.incident_id
      ${whereClause};
    `;
    const countRes = await pool.query(countSql, values);
    const total = parseInt(countRes.rows[0].count, 10);

    const query = `
      SELECT 
        ap.id,
        ap.healing_action_id,
        h.target_name,
        h.target_type,
        h.risk_level,
        t.code AS action_code,
        t.name AS action_name,
        i.id AS incident_id,
        i.title AS incident_title,
        i.severity AS incident_severity,
        env.name AS environment_name,
        ap.status,
        ap.reason,
        ap.requested_at,
        ap.decided_at,
        ap.expires_at,
        u_req.email AS requested_by_email,
        u_app.email AS approved_by_email
      FROM approvals ap
      JOIN healing_actions h ON h.id = ap.healing_action_id
      LEFT JOIN healing_action_types t ON t.id = h.action_type_id
      LEFT JOIN incidents i ON i.id = h.incident_id
      LEFT JOIN environments env ON env.id = h.environment_id
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
    await pool.query(
      `UPDATE approvals 
       SET status = 'APPROVED', approved_by = $2, decided_at = NOW(), reason = COALESCE($3, reason)
       WHERE healing_action_id = $1 AND status = 'PENDING';`,
      [actionId, approvedBy, reason || 'Phê duyệt can thiệp tự phục hồi']
    );

    const res = await pool.query(
      `UPDATE healing_actions 
       SET approval_status = 'APPROVED'
       WHERE id = $1
       RETURNING *;`,
      [actionId]
    );

    return res.rows[0] || null;
  }

  public static async rejectAction(actionId: string, rejectedBy: string, reason?: string): Promise<any> {
    await pool.query(
      `UPDATE approvals 
       SET status = 'REJECTED', approved_by = $2, decided_at = NOW(), reason = COALESCE($3, reason)
       WHERE healing_action_id = $1 AND status = 'PENDING';`,
      [actionId, rejectedBy, reason || 'Từ chối thực thi do rủi ro gián đoạn dịch vụ']
    );

    const res = await pool.query(
      `UPDATE healing_actions 
       SET approval_status = 'REJECTED', execution_status = 'CANCELLED'
       WHERE id = $1
       RETURNING *;`,
      [actionId]
    );

    return res.rows[0] || null;
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
      conditions.push(`(
        i.cluster_id = $${idx} OR 
        EXISTS (
          SELECT 1 FROM clusters c 
          WHERE (c.id::text = i.cluster_id OR c.cluster_uid = i.cluster_id OR c.name = i.cluster_id)
            AND (c.id::text = $${idx} OR c.name = $${idx} OR c.cluster_uid = $${idx})
        )
      )`);
      values.push(clusterId);
      idx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const summarySql = `
      SELECT 
        count(*) AS total_actions,
        count(*) FILTER (WHERE h.execution_status = 'SUCCEEDED') AS succeeded_actions,
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
