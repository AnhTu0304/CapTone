import { AuditService, IAuditRequestContext } from './audit.service';
import { SystemRoleService } from './systemRole.service';
import { AuditAction } from '../models/auditLog.model';
import { pool, resolveSkippedExecutionStatus } from '../config/database';
import { HealingActionModel, IHealingActionFilter } from '../models/healingAction.model';
import { ApiError } from '../utils/apiError';
import { dispatchHealingActionToAgent } from '../websocket/agentWebSocket';
import { broadcastTelemetryToUi } from '../websocket/telemetryWebSocket';
import { OrganizationMemberModel } from '../models/organizationMember.model';
import { WorkloadModel } from '../models';
import { recordRemediationAction } from '../telemetry/metrics';

export class HealingActionService {
  /**
   * Xác thực và phân quyền Tenant và Cluster cho người dùng
   * Đảm bảo không thể truy cập chéo tổ chức hoặc cụm Kubernetes của tổ chức khác
   */
  public static async validateUserOrgAndCluster(
    user: any,
    organizationId?: string,
    clusterId?: string
  ): Promise<{ orgId?: string; clusterId?: string; allowedOrgIds?: string[] }> {
    if (!user || !user.id) {
      throw new ApiError(401, 'Yêu cầu đăng nhập trước khi truy cập tài nguyên');
    }

    const memberRes = await pool.query(
      `SELECT organization_id FROM organization_members WHERE user_id = $1 AND status = 'ACTIVE'`,
      [user.id]
    );
    const allowedOrgIds: string[] = memberRes.rows.map((r: any) => r.organization_id);
    if (allowedOrgIds.length === 0) {
      throw new ApiError(
        403,
        'Từ chối truy cập: Tài khoản của bạn chưa thuộc tổ chức hoạt động nào'
      );
    }

    // Strict mode: mọi vai trò (bao gồm SUPER_ADMIN / SYSTEM_ADMIN / ADMIN) đều phải có organization_id hợp lệ và tư cách thành viên ACTIVE
    const rawOrgId = organizationId ? String(organizationId).trim() : '';
    const isAll = rawOrgId.toUpperCase() === 'ALL';
    if (!rawOrgId || isAll) {
      throw new ApiError(403, 'Từ chối truy cập: Thiếu hoặc không hợp lệ ngữ cảnh tổ chức (organization_id)');
    }
    const targetOrgId = rawOrgId;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetOrgId)) {
      throw new ApiError(400, 'Định dạng định danh tổ chức (organization_id) không hợp lệ');
    }

    if (!allowedOrgIds.includes(targetOrgId)) {
      throw new ApiError(
        403,
        'Từ chối truy cập: Bạn không phải là thành viên đang hoạt động của tổ chức này'
      );
    }

    // Kiểm tra tính hợp lệ của Cụm K8s (nếu có cung cấp)
    if (clusterId && clusterId !== 'ALL' && clusterId !== 'all') {
      const clusterCheck = await HealingActionModel.validateClusterBelongsToOrg(clusterId, targetOrgId);
      if (!clusterCheck) {
        throw new ApiError(
          403,
          'Từ chối truy cập: Cụm Kubernetes này không tồn tại hoặc không thuộc quyền quản lý của tổ chức của bạn'
        );
      }
    }

    return { orgId: targetOrgId, clusterId, allowedOrgIds };
  }

  /**
   * Kiểm tra quyền sở hữu chính sách tự phục hồi theo Tổ chức (Chống IDOR)
   * Decision 2.2: SUPER_ADMIN / SYSTEM_ADMIN cũng bắt buộc phải là thành viên ACTIVE của tổ chức
   */
  public static async validatePolicyOwnership(
    policyOrgId: string | null | undefined,
    user: any,
    requiredMinRole: 'DEVOPS' | 'SME_OWNER' = 'DEVOPS'
  ): Promise<void> {
    if (!user || !user.id) {
      throw new ApiError(401, 'Yêu cầu đăng nhập trước khi thao tác chính sách');
    }

    if (!policyOrgId) {
      throw new ApiError(403, 'Từ chối truy cập: Không thể sửa đổi chính sách mẫu dùng chung toàn hệ thống');
    }

    const member = await OrganizationMemberModel.findByOrgAndUser(policyOrgId, user.id);
    if (!member || member.status !== 'ACTIVE') {
      throw new ApiError(403, 'Từ chối truy cập: Bạn không thuộc tổ chức sở hữu chính sách tự phục hồi này');
    }

    const roleCode = String(member.role_code || '').toUpperCase();
    if (roleCode === 'VIEWER') {
      throw new ApiError(403, 'Tài khoản quyền Viewer chỉ có quyền xem, không được sửa đổi chính sách tự phục hồi');
    }

    if (requiredMinRole === 'SME_OWNER' && roleCode !== 'SME_OWNER' && roleCode !== 'ADMIN') {
      throw new ApiError(403, 'Chỉ Chủ sở hữu tổ chức (SME_OWNER) mới có quyền xóa chính sách này');
    }
  }

  /**
   * 1. Get list of healing actions with multi-dimensional filters
   */
  public static async getActions(filters: IHealingActionFilter = {}, user?: any) {
    if (user) {
      const validation = await this.validateUserOrgAndCluster(user, filters.organization_id, filters.cluster_id);
      if (!filters.organization_id || filters.organization_id.toUpperCase() === 'ALL') {
        filters.organization_id = validation.orgId;
      }
      if (validation.allowedOrgIds && validation.allowedOrgIds.length > 0) {
        filters.allowed_org_ids = validation.allowedOrgIds;
      }
    }
    return await HealingActionModel.findManyActions(filters);
  }

  /**
   * 1b. Lấy danh sách hành động tự phục hồi đang chạy ngầm (RUNNING / PENDING)
   */
  public static async getRunningActions(
    filters: { organization_id?: string; cluster_id?: string; search?: string; limit?: number; offset?: number; allowed_org_ids?: string[] } = {},
    user?: any
  ) {
    if (user) {
      const validation = await this.validateUserOrgAndCluster(user, filters.organization_id, filters.cluster_id);
      if (!filters.organization_id || filters.organization_id.toUpperCase() === 'ALL') {
        filters.organization_id = validation.orgId;
      }
      if (validation.allowedOrgIds && validation.allowedOrgIds.length > 0) {
        filters.allowed_org_ids = validation.allowedOrgIds;
      }
    }
    return await HealingActionModel.findRunningActions(filters);
  }

  /**
   * 2. Get healing action details by ID
   */
  public static async getActionById(id: string, user?: any) {
    if (!id) {
      throw new ApiError(400, 'Mã định danh hành động không hợp lệ');
    }
    const action = await HealingActionModel.findActionById(id);
    if (!action) {
      throw new ApiError(404, 'Không tìm thấy hành động tự phục hồi yêu cầu');
    }
    if (user) {
      await this.validateUserOrgAndCluster(user, action.organization_id, action.cluster_id);
    }
    return action;
  }

  /**
   * 3. Create a new healing action
   */
  public static async createAction(
    data: {
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
    },
    userId?: string | null,
    user?: any
  ) {
    if (!data.incident_id || !data.environment_id || !data.action_type_id) {
      throw new ApiError(
        400,
        'Thiếu thông tin bắt buộc: incident_id, environment_id, action_type_id'
      );
    }

    if (user) {
      const envRes = await pool.query(
        `SELECT organization_id FROM environments WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
        [data.environment_id]
      );
      if (envRes.rows.length === 0) {
        throw new ApiError(403, 'Từ chối truy cập: Môi trường không hợp lệ hoặc không thuộc tổ chức của bạn');
      }
      const envOrgId = envRes.rows[0].organization_id;
      await this.validateUserOrgAndCluster(user, envOrgId);

      const incRes = await pool.query(
        `SELECT environment_id FROM incidents WHERE id = $1 LIMIT 1`,
        [data.incident_id]
      );
      if (incRes.rows.length > 0 && incRes.rows[0].environment_id !== data.environment_id) {
        throw new ApiError(403, 'Từ chối truy cập: Sự cố không thuộc môi trường/tổ chức được chỉ định');
      }
    }

    const created = await HealingActionModel.createAction({
      ...data,
      requested_by: userId || null,
    });
    recordRemediationAction(created?.action_type_code || 'REMEDIATION', 'triggered');
    return created;
  }

  /**
   * 4. Execute or retry an action
   */
  public static async executeAction(
    actionId: string,
    executedBy?: string | null,
    user?: any,
    reqContext?: IAuditRequestContext,
    options?: { timeoutMs?: number; requestedOrgId?: string }
  ) {
    if (!actionId) {
      throw new ApiError(400, 'Mã hành động không hợp lệ');
    }

    const action = await HealingActionModel.findActionById(actionId);
    if (!action) {
      throw new ApiError(404, 'Không tìm thấy hành động tự phục hồi yêu cầu');
    }

    if (action.execution_status === 'RUNNING') {
      throw new ApiError(409, 'Hành động tự phục hồi này đang trong trạng thái thực thi');
    }
    if (action.approval_status === 'EXPIRED') {
      throw new ApiError(409, 'Yêu cầu phê duyệt đã hết hạn (EXPIRED), không thể thực thi');
    }
    if (action.approval_status === 'REJECTED') {
      throw new ApiError(403, 'Hành động này đã bị từ chối phê duyệt, không thể thực thi');
    }
    if (!['APPROVED', 'AUTO_APPROVED', 'NOT_REQUIRED'].includes(String(action.approval_status || '').toUpperCase())) {
      throw new ApiError(403, 'Hành động chưa được phê duyệt qua cổng HITL, không thể thực thi');
    }
    if (action.execution_status !== 'PENDING') {
      throw new ApiError(409, `Hành động đang ở trạng thái ${action.execution_status}, chỉ có thể thực thi hành động PENDING`);
    }

    // Tenant & Cluster Access Validation (Decision 2.2: no system admin bypass)
    if (user) {
      if (options?.requestedOrgId && action.organization_id !== options.requestedOrgId.trim()) {
        throw new ApiError(403, 'Từ chối truy cập: Hành động không thuộc tổ chức được yêu cầu');
      }
      const { orgId } = await this.validateUserOrgAndCluster(user, action.organization_id, action.cluster_id);
      const member = await OrganizationMemberModel.findByOrgAndUser(action.organization_id || orgId, user.id);
      const roleCode = String(member?.role_code || '').toUpperCase();
      if (!member || member.status !== 'ACTIVE' || !['SME_OWNER', 'DEVOPS', 'ADMIN'].includes(roleCode)) {
        throw new ApiError(403, 'Tài khoản không có quyền kích hoạt thực thi hành động tự phục hồi cho tổ chức này');
      }
    }

    // Target Concurrency Lock: Prevent multiple actions running concurrently on the same target workload/incident
    if (action.target_name || action.incident_id) {
      const activeRunningCheck = await pool.query(
        `SELECT h.id, t.code AS action_type_code, h.execution_status, h.created_at 
         FROM healing_actions h
         LEFT JOIN healing_action_types t ON t.id = h.action_type_id
         WHERE h.id != $1 
           AND h.execution_status IN ('RUNNING')
           AND (
             (h.target_name IS NOT NULL AND h.target_name = $2)
             OR (h.incident_id IS NOT NULL AND h.incident_id = $3)
           )
         LIMIT 1;`,
        [actionId, action.target_name, action.incident_id]
      );
      if (activeRunningCheck.rows.length > 0) {
        const running = activeRunningCheck.rows[0];
        throw new ApiError(
          409,
          `Đang có hành động '${running.action_type_code || 'REMEDIATION'}' (${running.execution_status}) đang chạy trên mục tiêu '${action.target_name || action.incident_id}'. Vui lòng chờ hành động trước hoàn tất.`
        );
      }
    }

    // Broadcast WebSocket event: started
    try {
      broadcastTelemetryToUi({
        type: 'healing_action_started',
        data: {
          action_id: actionId,
          status: 'RUNNING',
          target_name: action.target_name,
          cluster_name: action.cluster_name,
          executed_by: user?.email || executedBy,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (wsErr) {
      console.warn('[HealingActionService] Warning broadcasting start event:', wsErr);
    }

    const result = await HealingActionModel.executeAction(actionId, executedBy || undefined);
    const attemptId = result?.attempt?.id || null;

    // Resolve actual namespace and canonical workload name dynamically
    let targetNamespace = 'default';
    let targetWorkloadName = action.target_name || 'sme-order-service';
    if (action.target_name || action.target_id) {
      try {
        const lookupKey = action.target_name || action.target_id;
        const resolved = await WorkloadModel.resolveK8sTarget(String(lookupKey), action.cluster_id || null);
        if (resolved.targetName) targetWorkloadName = resolved.targetName;
        if (resolved.namespace) targetNamespace = resolved.namespace;
      } catch {}
    }

    const actionCode = (action.action_type_code || action.action_type_name || 'RESTART_POD')
      .toUpperCase()
      .trim()
      .replace(/\s+/g, '_');

    const timeoutMs = Math.max(50, Number(options?.timeoutMs ?? 60000));

    if (actionCode === 'NO_ACTION') {
      const skippedStatus = await resolveSkippedExecutionStatus();
      console.log(`🛡️ [HealingActionService] Action is NO_ACTION (Circuit Breaker). Marking ${skippedStatus} without Agent dispatch.`);
      await pool.query(
        `UPDATE execution_attempts SET status = $2::execution_status, completed_at = NOW(), duration_ms = 0 WHERE id = $1 AND status = 'RUNNING';`,
        [attemptId, skippedStatus]
      ).catch(() => {});
      const skippedRes = await pool.query(
        `UPDATE healing_actions SET execution_status = $2::execution_status, completed_at = NOW(), result = COALESCE(result, '{}'::jsonb) || '{"status":"SKIPPED","message":"NO_ACTION circuit breaker"}'::jsonb WHERE id = $1 RETURNING *;`,
        [actionId, skippedStatus]
      );
      if (skippedRes.rows[0]) result.action = skippedRes.rows[0];
    } else if (!action.environment_id || !action.cluster_id) {
      const routeErr = 'Thiếu environment_id hoặc cluster_id hợp lệ để định tuyến Kubernetes Agent';
      const failedRow = await HealingActionModel.recordDispatchFailure(actionId, attemptId, routeErr, {
        reason: 'MISSING_ROUTING_CONTEXT',
        environment_id: action.environment_id || null,
        cluster_id: action.cluster_id || null,
      });
      if (failedRow) result.action = failedRow;
    } else {
      const clusterOwner = await HealingActionModel.validateClusterBelongsToOrg(
        action.cluster_id,
        action.organization_id
      );
      if (!clusterOwner || clusterOwner.environment_id !== action.environment_id) {
        const crossErr = 'Cụm Kubernetes không khớp môi trường hoặc tổ chức sở hữu hành động';
        const failedRow = await HealingActionModel.recordDispatchFailure(actionId, attemptId, crossErr, {
          reason: 'CLUSTER_ENV_MISMATCH',
        });
        if (failedRow) result.action = failedRow;
      } else {
        try {
          const dispatchResult = await dispatchHealingActionToAgent({
            action_id: actionId,
            action_type: actionCode,
            target_name: targetWorkloadName,
            namespace: targetNamespace,
            cluster_id: clusterOwner.id,
            environment_id: action.environment_id,
            organization_id: action.organization_id,
            params: action.result?.params || {},
          });
          if (dispatchResult?.dispatched) {
            // Timeout watchdog: marks both attempt and action FAILED if Agent never returns
            const timeoutHandle = setTimeout(async () => {
              try {
                await HealingActionModel.recordDispatchFailure(
                  actionId,
                  attemptId,
                  `Quá thời gian chờ (${timeoutMs}ms) nhưng Kubernetes Agent chưa phản hồi kết quả thực thi.`,
                  { timeout: true, timeout_ms: timeoutMs }
                );
                if (action.incident_id) {
                  await pool.query(
                    `UPDATE incidents SET status = 'OPEN', resolved_at = NULL WHERE id = $1 AND status = 'RESOLVED'`,
                    [action.incident_id]
                  ).catch(() => {});
                }
              } catch {}
            }, timeoutMs);
            if (typeof timeoutHandle.unref === 'function') {
              timeoutHandle.unref();
            }

            // Wait briefly for quick Agent action_result callbacks without delaying short timeout tests
            await new Promise((resolve) => setTimeout(resolve, Math.min(timeoutMs <= 1000 ? 40 : 1500, 1500)));
            const refreshed = await HealingActionModel.findActionById(actionId);
            if (refreshed) {
              result.action = refreshed;
            }
          } else {
            const failedRow = await HealingActionModel.recordDispatchFailure(
              actionId,
              attemptId,
              'Không có Kubernetes Agent nào trực tuyến để nhận lệnh tự phục hồi.',
              { reason: 'NO_MATCHING_AGENT' }
            );
            if (action.incident_id) {
              await pool.query(
                'UPDATE incidents SET status = \'OPEN\', resolved_at = NULL WHERE id = $1 AND status = \'RESOLVED\'',
                [action.incident_id]
              ).catch(() => {});
            }
            if (failedRow) result.action = failedRow;
          }
        } catch (e: any) {
          const failedRow = await HealingActionModel.recordDispatchFailure(
            actionId,
            attemptId,
            e?.message || 'Lỗi gửi lệnh tới Kubernetes Agent',
            { reason: 'DISPATCH_EXCEPTION' }
          );
          if (failedRow) result.action = failedRow;
        }
      }
    }

    // Broadcast WebSocket event: completed
    try {
      broadcastTelemetryToUi({
        type: 'healing_action_completed',
        data: {
          action_id: actionId,
          status: result.action?.execution_status || 'COMPLETED',
          target_name: targetWorkloadName,
          cluster_name: action.cluster_name,
          result: result.action?.result,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (wsErr) {
      console.warn('[HealingActionService] Warning broadcasting complete event:', wsErr);
    }

    // Ghi sổ cái kiểm toán bất biến (Immutable Audit Log)
    try {
      const actStatus = result.action?.execution_status || 'COMPLETED';
      const isSuccess = actStatus === 'COMPLETED' || actStatus === 'SUCCEEDED';
      await AuditService.record({
        organization_id: action.organization_id || null,
        user_id: user?.id || (executedBy && !executedBy.includes('@') && executedBy.length > 30 ? executedBy : null),
        actor_type: executedBy ? 'USER' : 'SYSTEM',
        action: isSuccess ? 'REMEDIATION_COMPLETED' : 'REMEDIATION_FAILED',
        resource_type: 'HEALING_ACTION',
        resource_id: actionId,
        target_type: 'WORKLOAD',
        target_id: null,
        request_id: reqContext?.request_id || null,
        user_agent: reqContext?.user_agent || null,
        ip_address: reqContext?.ip_address || null,
        description: isSuccess
          ? `Thực thi thành công tự phục hồi [${actionCode}] cho mục tiêu ${targetWorkloadName} (${targetNamespace})`
          : `Thực thi tự phục hồi [${actionCode}] cho mục tiêu ${targetWorkloadName} không thành công`,
        status: isSuccess ? 'SUCCESS' : 'FAILURE',
        before_data: { execution_status: 'RUNNING' },
        after_data: {
          execution_status: actStatus,
          result: result.action?.result,
        },
        metadata: {
          action_type: actionCode,
          target_name: targetWorkloadName,
          namespace: targetNamespace,
          cluster_id: action.cluster_id,
          cluster_name: action.cluster_name,
          executed_by: user?.email || executedBy || 'SYSTEM',
        },
      });
    } catch (auditErr) {
      console.warn('[HealingActionService] Ghi audit log thất bại:', auditErr);
    }

    return result;
  }

  /**
   * 4b. Hủy bỏ (Abort) một hành động đang thực thi hoặc đang chờ duyệt
   */
  public static async abortAction(
    actionId: string,
    userId: string | null,
    reason?: string,
    user?: any,
    reqContext?: IAuditRequestContext
  ) {
    if (!actionId) {
      throw new ApiError(400, 'Mã hành động không hợp lệ');
    }

    const action = await HealingActionModel.findActionById(actionId);
    if (!action) {
      throw new ApiError(404, 'Không tìm thấy hành động tự phục hồi để hủy bỏ');
    }

    // Tenant & Cluster Access Validation (no system admin bypass)
    if (user) {
      const { orgId } = await this.validateUserOrgAndCluster(user, action.organization_id, action.cluster_id);
      const member = await OrganizationMemberModel.findByOrgAndUser(action.organization_id || orgId, user.id);
      const roleCode = String(member?.role_code || '').toUpperCase();
      if (!member || member.status !== 'ACTIVE' || !['SME_OWNER', 'DEVOPS', 'ADMIN'].includes(roleCode)) {
        throw new ApiError(403, 'Tài khoản quyền Viewer chỉ có quyền xem, không được hủy bỏ hành động tự phục hồi');
      }
    }

    const completedStatuses = ['COMPLETED', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'SKIPPED'];
    if (completedStatuses.includes(action.execution_status)) {
      throw new ApiError(
        400,
        `Hành động đã kết thúc với trạng thái ${action.execution_status}, không thể hủy bỏ`
      );
    }

    const aborted = await HealingActionModel.abortAction(actionId, userId, reason);
    recordRemediationAction(action.action_type_code || 'REMEDIATION', 'aborted');

    // Ghi audit log dừng khẩn cấp
    try {
      await AuditService.record({
        organization_id: action.organization_id || null,
        user_id: user?.id || (userId && userId.length > 30 ? userId : null),
        actor_type: 'USER',
        action: 'REMEDIATION_ABORTED',
        resource_type: 'HEALING_ACTION',
        resource_id: actionId,
        target_type: 'WORKLOAD',
        target_id: null,
        request_id: reqContext?.request_id || null,
        user_agent: reqContext?.user_agent || null,
        ip_address: reqContext?.ip_address || null,
        description: `Dừng khẩn cấp hành động tự phục hồi trên [${action.target_name || 'Workload'}]: ${reason || 'Người vận hành yêu cầu hủy bỏ'}`,
        status: 'SUCCESS',
        before_data: { execution_status: action.execution_status },
        after_data: { execution_status: 'CANCELLED', reason },
        metadata: {
          target_name: action.target_name,
          cluster_id: action.cluster_id,
          cluster_name: action.cluster_name,
          aborted_by: user?.email || userId,
          reason,
        },
      });
    } catch (auditErr) {
      console.warn('[HealingActionService] Ghi audit log abort thất bại:', auditErr);
    }

    // Phát thông báo thời gian thực tới tất cả Frontend qua WebSocket
    try {
      broadcastTelemetryToUi({
        type: 'healing_action_aborted',
        data: {
          action_id: actionId,
          status: 'CANCELLED',
          target_name: action.target_name,
          cluster_name: action.cluster_name,
          reason: reason || 'Hành động bị dừng khẩn cấp bởi quản trị viên',
          aborted_by: user?.email || userId,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (wsErr) {
      console.warn('[HealingActionService] Warning broadcasting abort event:', wsErr);
    }

    return aborted;
  }

  /**
   * 5. Update execution status (with Tenant Isolation & Atomic Update)
   */
  public static async updateActionStatus(
    actionId: string,
    status: string,
    result?: any,
    errorMessage?: string,
    user?: any,
    requestedOrgId?: string
  ) {
    if (!actionId || !status) {
      throw new ApiError(400, 'Mã hành động và trạng thái không được để trống');
    }

    let scopedOrgId: string | undefined;
    if (user) {
      const action = await HealingActionModel.findActionById(actionId);
      if (!action) {
        throw new ApiError(404, 'Không tìm thấy hành động để cập nhật trạng thái');
      }
      if (requestedOrgId && action.organization_id !== requestedOrgId.trim()) {
        throw new ApiError(403, 'Từ chối truy cập: Hành động không thuộc tổ chức được yêu cầu');
      }
      const validation = await this.validateUserOrgAndCluster(user, action.organization_id, action.cluster_id);
      const member = await OrganizationMemberModel.findByOrgAndUser(action.organization_id, user.id);
      const roleCode = String(member?.role_code || '').toUpperCase();
      if (!member || member.status !== 'ACTIVE' || !['SME_OWNER', 'DEVOPS', 'ADMIN'].includes(roleCode)) {
        throw new ApiError(403, 'Từ chối truy cập: Bạn không có quyền cập nhật trạng thái hành động này');
      }
      scopedOrgId = validation.orgId || action.organization_id;
    }

    const updated = await HealingActionModel.updateStatus(actionId, status, result, errorMessage, scopedOrgId);
    if (!updated) {
      if (scopedOrgId) {
        throw new ApiError(403, 'Từ chối truy cập: Hành động không thuộc tổ chức được ủy quyền');
      }
      throw new ApiError(404, 'Không tìm thấy hành động để cập nhật trạng thái');
    }
    return updated;
  }

  /**
   * 6. List all action types
   */
  public static async getActionTypes() {
    return await HealingActionModel.findAllActionTypes();
  }

  /**
   * 7. Update action type configuration (System SUPER_ADMIN / System ADMIN only)
   */
  public static async updateActionType(
    id: string,
    data: {
      enabled?: boolean;
      default_risk_level?: string;
      requires_approval_by_default?: boolean;
      description?: string;
    },
    user?: any
  ) {
    if (!id) {
      throw new ApiError(400, 'Mã loại hành động không hợp lệ');
    }

    if (user) {
      if (!user.id) {
        throw new ApiError(401, 'Yêu cầu đăng nhập trước khi cập nhật loại hành động');
      }
      const isSystemAdmin = await SystemRoleService.hasAnyRole(user.id, ['SUPER_ADMIN', 'ADMIN']);
      if (!isSystemAdmin) {
        throw new ApiError(403, 'Từ chối truy cập: Chỉ System SUPER_ADMIN hoặc System ADMIN mới được cập nhật loại hành động toàn cục');
      }
    }

    const updated = await HealingActionModel.updateActionType(id, data);
    if (!updated) {
      throw new ApiError(404, 'Không tìm thấy loại hành động hoặc không có thay đổi');
    }
    return updated;
  }

  /**
   * Helper: Khởi tạo bộ 7 chính sách tự phục hồi chuẩn cho một Tổ chức (Organization)
   */
  public static async seedDefaultPoliciesForOrg(orgId: string, createdBy?: string, client?: any): Promise<void> {
    if (!orgId) return;
    const db = client || pool;

    const DEFAULT_STANDARD_POLICIES = [
      {
        name: 'POL-REPLACE-UNSTABLE-POD',
        description: 'Tự động tính điểm và thay thế Pod bị crash loop hoặc OOMKilled liên tục',
        trigger_type: 'Kernel eBPF Probe',
        risk_type: 'Tự phục hồi AI',
        execution_mode: 'AUTO',
        risk_level: 'LOW',
        confidence_threshold: 0.55,
        cooldown_seconds: 60,
        requires_approval: false,
        is_active: true,
        action_code: 'REPLACE_POD',
      },
      {
        name: 'POL-BLOCK-MALICIOUS-IP',
        description: 'Chặn IP tấn công bất thường bằng eBPF/iptables',
        trigger_type: 'Kernel eBPF Probe',
        risk_type: 'Disruptive',
        execution_mode: 'AUTO',
        risk_level: 'HIGH',
        confidence_threshold: 0.95,
        cooldown_seconds: 60,
        requires_approval: false,
        is_active: true,
        action_code: 'BLOCK_IP_TEMP',
      },
      {
        name: 'POL-DRAIN-UNHEALTHY-NODE',
        description: 'Di tản workload và cô lập Node vật lý bị lỗi phần cứng',
        trigger_type: 'Kernel eBPF Probe',
        risk_type: 'Disruptive',
        execution_mode: 'MANUAL',
        risk_level: 'CRITICAL',
        confidence_threshold: 0.95,
        cooldown_seconds: 60,
        requires_approval: true,
        is_active: true,
        action_code: 'DRAIN_NODE',
      },
      {
        name: 'POL-SCALE-OUT-TRAFFIC',
        description: 'Tự động mở rộng bản sao Pod khi quá tải lưu lượng đột biến',
        trigger_type: 'Metric Threshold',
        risk_type: 'Non-Destructive',
        execution_mode: 'AUTO',
        risk_level: 'LOW',
        confidence_threshold: 0.45,
        cooldown_seconds: 60,
        requires_approval: false,
        is_active: true,
        action_code: 'SCALE_REPLICAS',
      },
      {
        name: 'POL-RESTART-CRASHED-POD',
        description: 'Tự động khởi động lại Pod bị treo hoặc crash liveness probe',
        trigger_type: 'Kernel eBPF Probe',
        risk_type: 'State-Preserving',
        execution_mode: 'AUTO',
        risk_level: 'LOW',
        confidence_threshold: 0.55,
        cooldown_seconds: 60,
        requires_approval: false,
        is_active: true,
        action_code: 'RESTART_POD',
      },
      {
        name: 'POL-CLEANUP-DISK-TEMP',
        description: 'Dọn dẹp dung lượng disk tạm thời trong thư mục /tmp',
        trigger_type: 'Metric Threshold',
        risk_type: 'Non-Destructive',
        execution_mode: 'AUTO',
        risk_level: 'LOW',
        confidence_threshold: 0.75,
        cooldown_seconds: 60,
        requires_approval: false,
        is_active: true,
        action_code: 'CLEANUP_TEMP_FILES',
      },
      {
        name: 'POL-ROLLBACK-HTTP5XX',
        description: 'Hoàn nguyên phiên bản khi tỷ lệ HTTP 5xx vượt 5%',
        trigger_type: 'AI Prediction',
        risk_type: 'Disruptive',
        execution_mode: 'MANUAL',
        risk_level: 'HIGH',
        confidence_threshold: 0.90,
        cooldown_seconds: 60,
        requires_approval: true,
        is_active: true,
        action_code: 'ROLLBACK_DEPLOYMENT',
      },
    ];

    try {
      const actionTypesRes = await db.query('SELECT id, code FROM healing_action_types;');
      const actionMap = new Map<string, string>();
      for (const row of actionTypesRes.rows) {
        actionMap.set(row.code, row.id);
      }

      const envId = null; // Chính sách mặc định tiêu chuẩn áp dụng toàn bộ tổ chức (environment_id = NULL)

      for (const pol of DEFAULT_STANDARD_POLICIES) {
        const actTypeId = actionMap.get(pol.action_code);
        if (!actTypeId) continue;

        const existing = await db.query(
          'SELECT id FROM healing_policies WHERE organization_id = $1 AND name = $2 AND deleted_at IS NULL LIMIT 1;',
          [orgId, pol.name]
        );
        if (existing.rows.length > 0) continue;

        const polInsert = await db.query(
          `INSERT INTO healing_policies (
            organization_id, environment_id, name, description, trigger_type, risk_type,
            execution_mode, risk_level, confidence_threshold, cooldown_seconds, max_retries,
            requires_approval, is_active, created_by, created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6,
            $7::execution_mode, $8::risk_level, $9, $10, 1,
            $11, $12, $13, NOW(), NOW()
          )
          RETURNING id;`,
          [
            orgId,
            envId,
            pol.name,
            pol.description,
            pol.trigger_type,
            pol.risk_type,
            pol.execution_mode,
            pol.risk_level,
            pol.confidence_threshold,
            pol.cooldown_seconds,
            pol.requires_approval,
            pol.is_active,
            createdBy || null,
          ]
        );

        const polId = polInsert.rows[0]?.id;
        if (polId) {
          await db.query(
            `INSERT INTO policy_actions (policy_id, action_type_id, priority, is_enabled, configuration, created_at)
             VALUES ($1, $2, 1, true, '{}'::jsonb, NOW());`,
            [polId, actTypeId]
          );
        }
      }
    } catch (seedErr: any) {
      console.warn(`[HealingActionService] seedDefaultPoliciesForOrg failed for ${orgId}:`, seedErr?.message || seedErr);
    }
  }

  /**
   * 8. List policies
   */
  public static async getPolicies(filters: {
    organization_id?: string;
    environment_id?: string;
    is_active?: boolean;
    search?: string;
    allowed_org_ids?: string[];
  } = {}, user?: any) {
    if (user) {
      const validation = await this.validateUserOrgAndCluster(user, filters.organization_id);
      if (!filters.organization_id || filters.organization_id.toUpperCase() === 'ALL') {
        filters.organization_id = validation.orgId;
      }
      if (validation.allowedOrgIds && validation.allowedOrgIds.length > 0) {
        filters.allowed_org_ids = validation.allowedOrgIds;
      }
    }

    let policies = await HealingActionModel.findPolicies(filters);
    if ((!policies || policies.length === 0) && filters.organization_id && filters.organization_id.toUpperCase() !== 'ALL') {
      await this.seedDefaultPoliciesForOrg(filters.organization_id, user?.id);
      policies = await HealingActionModel.findPolicies(filters);
    }
    return policies;
  }

  /**
   * 9. Update policy configuration
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
    },
    user?: any,
    reqContext?: IAuditRequestContext
  ) {
    if (!id) {
      throw new ApiError(400, 'Mã chính sách không hợp lệ');
    }

    const beforeRes = await pool.query('SELECT * FROM healing_policies WHERE id = $1', [id]);
    const beforePolicy = beforeRes.rows[0];
    if (!beforePolicy) {
      throw new ApiError(404, 'Không tìm thấy chính sách tự phục hồi để cập nhật');
    }

    if (user) {
      await this.validatePolicyOwnership(beforePolicy.organization_id, user, 'DEVOPS');
    }

    const updated = await HealingActionModel.updatePolicyConfig(id, data);
    if (!updated) {
      throw new ApiError(404, 'Không tìm thấy chính sách tự phục hồi để cập nhật');
    }

    try {
      const isThresholdModified = data.confidence_threshold !== undefined && Number(data.confidence_threshold) !== Number(beforePolicy?.confidence_threshold);
      const auditAction: AuditAction = isThresholdModified ? 'POLICY_THRESHOLD_MODIFIED' : 'POLICY_UPDATED';

      await AuditService.record({
        organization_id: updated.organization_id || beforePolicy?.organization_id || null,
        user_id: user?.id || null,
        actor_type: 'USER',
        action: auditAction,
        resource_type: 'POLICY',
        resource_id: id,
        target_type: 'POLICY',
        target_id: id,
        request_id: reqContext?.request_id || null,
        user_agent: reqContext?.user_agent || null,
        ip_address: reqContext?.ip_address || null,
        description: isThresholdModified
          ? `Điều chỉnh ngưỡng tin cậy chính sách [${updated.name}] từ ${(Number(beforePolicy?.confidence_threshold || 0) * 100).toFixed(0)}% sang ${(Number(updated.confidence_threshold || 0) * 100).toFixed(0)}%`
          : `Cập nhật cấu hình chính sách tự phục hồi [${updated.name}]`,
        status: 'SUCCESS',
        before_data: beforePolicy ? {
          name: beforePolicy.name,
          confidence_threshold: beforePolicy.confidence_threshold,
          requires_approval: beforePolicy.requires_approval,
          execution_mode: beforePolicy.execution_mode,
          risk_level: beforePolicy.risk_level,
          is_active: beforePolicy.is_active,
        } : null,
        after_data: {
          name: updated.name,
          confidence_threshold: updated.confidence_threshold,
          requires_approval: updated.requires_approval,
          execution_mode: updated.execution_mode,
          risk_level: updated.risk_level,
          is_active: updated.is_active,
        },
        metadata: {
          policy_id: id,
          policy_name: updated.name,
          changed_fields: Object.keys(data),
          updated_by: user?.email || user?.id,
        },
      });
    } catch (auditErr) {
      console.warn('[HealingActionService] Ghi audit log update policy thất bại:', auditErr);
    }

    return updated;
  }

  /**
   * 10. Toggle policy active
   */
  public static async togglePolicyActive(id: string, user?: any, reqContext?: IAuditRequestContext) {
    if (!id) {
      throw new ApiError(400, 'Mã chính sách không hợp lệ');
    }

    const beforeRes = await pool.query('SELECT * FROM healing_policies WHERE id = $1', [id]);
    const beforePolicy = beforeRes.rows[0];
    if (!beforePolicy) {
      throw new ApiError(404, 'Không tìm thấy chính sách tự phục hồi');
    }

    if (user) {
      await this.validatePolicyOwnership(beforePolicy.organization_id, user, 'DEVOPS');
    }

    const updated = await HealingActionModel.togglePolicyActive(id);
    if (!updated) {
      throw new ApiError(404, 'Không tìm thấy chính sách tự phục hồi');
    }

    try {
      await AuditService.record({
        organization_id: updated.organization_id || beforePolicy?.organization_id || null,
        user_id: user?.id || null,
        actor_type: 'USER',
        action: 'POLICY_STATUS_CHANGED',
        resource_type: 'POLICY',
        resource_id: id,
        target_type: 'POLICY',
        target_id: id,
        request_id: reqContext?.request_id || null,
        user_agent: reqContext?.user_agent || null,
        ip_address: reqContext?.ip_address || null,
        description: `Thay đổi trạng thái chính sách [${updated.name}] thành ${updated.is_active ? 'HOẠT ĐỘNG (ACTIVE)' : 'TẠM DỪNG (INACTIVE)'}`,
        status: 'SUCCESS',
        before_data: { is_active: beforePolicy?.is_active },
        after_data: { is_active: updated.is_active },
        metadata: {
          policy_id: id,
          policy_name: updated.name,
          is_active: updated.is_active,
          updated_by: user?.email || user?.id,
        },
      });
    } catch (auditErr) {
      console.warn('[HealingActionService] Ghi audit log toggle policy thất bại:', auditErr);
    }

    return updated;
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
  }, user?: any, reqContext?: IAuditRequestContext) {
    if (!data.name || !data.organization_id) {
      throw new ApiError(400, 'Tên chính sách và tổ chức là bắt buộc');
    }
    if (user?.id) {
      const member = await OrganizationMemberModel.findByOrgAndUser(data.organization_id, user.id);
      if (
        !member ||
        member.status !== 'ACTIVE' ||
        !['SME_OWNER', 'DEVOPS', 'ADMIN'].includes(member.role_code.toUpperCase())
      ) {
        throw new ApiError(403, 'Từ chối truy cập: Bạn không có quyền tạo chính sách cho tổ chức này');
      }
    }
    const created = await HealingActionModel.createPolicy(data);

    try {
      await AuditService.record({
        organization_id: data.organization_id,
        user_id: user?.id || (data.created_by && data.created_by.length > 30 ? data.created_by : null),
        actor_type: 'USER',
        action: 'POLICY_CREATED',
        resource_type: 'POLICY',
        resource_id: created?.id,
        target_type: 'POLICY',
        target_id: created?.id,
        request_id: reqContext?.request_id || null,
        user_agent: reqContext?.user_agent || null,
        ip_address: reqContext?.ip_address || null,
        description: `Khởi tạo chính sách tự phục hồi mới [${data.name}] với chế độ [${data.execution_mode || 'SUPERVISED'}]`,
        status: 'SUCCESS',
        after_data: data,
        metadata: {
          policy_id: created?.id,
          policy_name: data.name,
          execution_mode: data.execution_mode,
          risk_level: data.risk_level,
          confidence_threshold: data.confidence_threshold,
          created_by: user?.email || data.created_by,
        },
      });
    } catch (auditErr) {
      console.warn('[HealingActionService] Ghi audit log create policy thất bại:', auditErr);
    }

    return created;
  }

  /**
   * 10c. Soft-delete policy
   */
  public static async deletePolicy(id: string, user?: any, reqContext?: IAuditRequestContext) {
    if (!id) {
      throw new ApiError(400, 'Mã chính sách không hợp lệ');
    }
    const beforeRes = await pool.query('SELECT * FROM healing_policies WHERE id = $1', [id]);
    const beforePolicy = beforeRes.rows[0];
    if (!beforePolicy) {
      throw new ApiError(404, 'Không tìm thấy chính sách hoặc đã bị xóa');
    }

    if (user) {
      await this.validatePolicyOwnership(beforePolicy.organization_id, user, 'SME_OWNER');
    }

    const deleted = await HealingActionModel.deletePolicy(id);
    if (!deleted) {
      throw new ApiError(404, 'Không tìm thấy chính sách hoặc đã bị xóa');
    }

    try {
      await AuditService.record({
        organization_id: beforePolicy?.organization_id || null,
        user_id: user?.id || null,
        actor_type: 'USER',
        action: 'POLICY_DELETED',
        resource_type: 'POLICY',
        resource_id: id,
        target_type: 'POLICY',
        target_id: id,
        request_id: reqContext?.request_id || null,
        user_agent: reqContext?.user_agent || null,
        ip_address: reqContext?.ip_address || null,
        description: `Xóa chính sách tự phục hồi [${beforePolicy?.name || id}]`,
        status: 'SUCCESS',
        before_data: beforePolicy ? { name: beforePolicy.name, is_active: beforePolicy.is_active } : null,
        metadata: {
          policy_id: id,
          policy_name: beforePolicy?.name,
          deleted_by: user?.email || user?.id,
        },
      });
    } catch (auditErr) {
      console.warn('[HealingActionService] Ghi audit log delete policy thất bại:', auditErr);
    }

    return { success: true, id };
  }

  /**
   * 11. Approvals: List, Approve, Reject
   */
  public static async getApprovals(
    filters: {
      organization_id?: string;
      cluster_id?: string;
      status?: string;
      search?: string;
      limit?: number;
      offset?: number;
      allowed_org_ids?: string[];
    } = {},
    user?: any
  ) {
    if (user) {
      const validation = await this.validateUserOrgAndCluster(user, filters.organization_id, filters.cluster_id);
      if (!filters.organization_id || filters.organization_id.toUpperCase() === 'ALL') {
        filters.organization_id = validation.orgId;
      }
      if (validation.allowedOrgIds && validation.allowedOrgIds.length > 0) {
        filters.allowed_org_ids = validation.allowedOrgIds;
      }
    }
    return await HealingActionModel.findApprovals(filters);
  }

  public static async approveAction(
    actionId: string,
    approvedBy: string,
    reason?: string,
    user?: any,
    reqContext?: IAuditRequestContext,
    requestedOrgId?: string
  ) {
    if (!actionId) {
      throw new ApiError(400, 'Mã hành động không hợp lệ');
    }
    const action = await HealingActionModel.findActionById(actionId);
    if (!action) {
      throw new ApiError(404, 'Không tìm thấy hành động hoặc hành động không thể phê duyệt');
    }
    if (requestedOrgId && action.organization_id !== requestedOrgId.trim()) {
      throw new ApiError(403, 'Từ chối truy cập: Hành động không thuộc tổ chức được yêu cầu');
    }
    if (user) {
      const { orgId } = await this.validateUserOrgAndCluster(user, action.organization_id, action.cluster_id);
      const member = await OrganizationMemberModel.findByOrgAndUser(action.organization_id || orgId, user.id);
      const roleCode = String(member?.role_code || '').toUpperCase();
      if (!member || member.status !== 'ACTIVE' || !['SME_OWNER', 'DEVOPS', 'ADMIN'].includes(roleCode)) {
        throw new ApiError(403, 'Tài khoản quyền Viewer hoặc không thuộc tổ chức không được phê duyệt hành động tự phục hồi');
      }
    }
    const approved = await HealingActionModel.approveAction(actionId, approvedBy, reason);
    if (!approved) {
      throw new ApiError(404, 'Không tìm thấy hành động hoặc hành động không thể phê duyệt');
    }
    recordRemediationAction(action?.action_type_code || 'REMEDIATION', 'approved');

    try {
      await AuditService.record({
        organization_id: action?.organization_id || null,
        user_id: user?.id || (approvedBy && !approvedBy.includes('@') && approvedBy.length > 30 ? approvedBy : null),
        actor_type: 'USER',
        action: 'HITL_APPROVAL_GRANTED',
        resource_type: 'HEALING_ACTION',
        resource_id: actionId,
        target_type: 'WORKLOAD',
        target_id: null,
        request_id: reqContext?.request_id || null,
        user_agent: reqContext?.user_agent || null,
        ip_address: reqContext?.ip_address || null,
        description: `Phê duyệt hành động tự phục hồi [${action?.action_type_code || 'REMEDIATION'}] cho mục tiêu ${action?.target_name || 'Workload'}${reason ? `: ${reason}` : ''}`,
        status: 'SUCCESS',
        before_data: { approval_status: action?.approval_status || 'PENDING', execution_status: action?.execution_status },
        after_data: { approval_status: 'APPROVED', approved_by: approvedBy, reason },
        metadata: {
          action_type: action?.action_type_code,
          cluster_id: action?.cluster_id,
          cluster_name: action?.cluster_name,
          target_name: action?.target_name,
          approved_by: user?.email || approvedBy,
          reason,
        },
      });
    } catch (auditErr) {
      console.warn('[HealingActionService] Ghi audit log HITL approval granted thất bại:', auditErr);
    }

    // Sau khi phê duyệt HITL thành công, tự động kích hoạt thực thi xuống K8s Agent
    try {
      await this.executeAction(actionId, approvedBy, user, reqContext, { requestedOrgId });
    } catch (execErr: any) {
      console.warn('[HealingActionService] Auto-execute after HITL approval warning:', execErr?.message || execErr);
    }
    // Phát sự kiện phê duyệt HITL thành công tới Frontend qua WebSocket
    try {
      broadcastTelemetryToUi({
        type: 'approval_status_changed',
        data: {
          action_id: actionId,
          status: 'APPROVED',
          approved_by: user?.email || approvedBy,
          target_name: action?.target_name,
          cluster_name: action?.cluster_name,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (wsErr) {
      console.warn('[HealingActionService] Warning broadcasting approval status changed:', wsErr);
    }

    return await HealingActionModel.findActionById(actionId);
  }

  public static async rejectAction(
    actionId: string,
    rejectedBy: string,
    reason?: string,
    user?: any,
    reqContext?: IAuditRequestContext,
    requestedOrgId?: string
  ) {
    if (!actionId) {
      throw new ApiError(400, 'Mã hành động không hợp lệ');
    }
    const action = await HealingActionModel.findActionById(actionId);
    if (!action) {
      throw new ApiError(404, 'Không tìm thấy hành động hoặc hành động không thể từ chối');
    }
    if (requestedOrgId && action.organization_id !== requestedOrgId.trim()) {
      throw new ApiError(403, 'Từ chối truy cập: Hành động không thuộc tổ chức được yêu cầu');
    }
    if (user) {
      const { orgId } = await this.validateUserOrgAndCluster(user, action.organization_id, action.cluster_id);
      const member = await OrganizationMemberModel.findByOrgAndUser(action.organization_id || orgId, user.id);
      const roleCode = String(member?.role_code || '').toUpperCase();
      if (!member || member.status !== 'ACTIVE' || !['SME_OWNER', 'DEVOPS', 'ADMIN'].includes(roleCode)) {
        throw new ApiError(403, 'Tài khoản quyền Viewer hoặc không thuộc tổ chức không được từ chối hành động tự phục hồi');
      }
    }
    const rejected = await HealingActionModel.rejectAction(actionId, rejectedBy, reason);
    if (!rejected) {
      throw new ApiError(404, 'Không tìm thấy hành động hoặc hành động không thể từ chối');
    }
    recordRemediationAction(action?.action_type_code || 'REMEDIATION', 'rejected');

    try {
      await AuditService.record({
        organization_id: action?.organization_id || null,
        user_id: user?.id || (rejectedBy && !rejectedBy.includes('@') && rejectedBy.length > 30 ? rejectedBy : null),
        actor_type: 'USER',
        action: 'HITL_APPROVAL_REJECTED',
        resource_type: 'HEALING_ACTION',
        resource_id: actionId,
        target_type: 'WORKLOAD',
        target_id: null,
        request_id: reqContext?.request_id || null,
        user_agent: reqContext?.user_agent || null,
        ip_address: reqContext?.ip_address || null,
        description: `Từ chối hành động tự phục hồi [${action?.action_type_code || 'REMEDIATION'}] cho mục tiêu ${action?.target_name || 'Workload'}${reason ? `: ${reason}` : ''}`,
        status: 'SUCCESS',
        before_data: { approval_status: action?.approval_status || 'PENDING' },
        after_data: { approval_status: 'REJECTED', rejected_by: rejectedBy, reason },
        metadata: {
          action_type: action?.action_type_code,
          cluster_id: action?.cluster_id,
          cluster_name: action?.cluster_name,
          target_name: action?.target_name,
          rejected_by: user?.email || rejectedBy,
          reason,
        },
      });
    } catch (auditErr) {
      console.warn('[HealingActionService] Ghi audit log HITL approval rejected thất bại:', auditErr);
    }

    // Phát sự kiện từ chối HITL tới Frontend qua WebSocket
    try {
      broadcastTelemetryToUi({
        type: 'approval_status_changed',
        data: {
          action_id: actionId,
          status: 'REJECTED',
          rejected_by: user?.email || rejectedBy,
          target_name: action?.target_name,
          cluster_name: action?.cluster_name,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (wsErr) {
      console.warn('[HealingActionService] Warning broadcasting rejection status changed:', wsErr);
    }

    return rejected;
  }

  /**
   * 12. Self-Healing Analytics & MTTR
   */
  public static async getAnalytics(organizationId?: string, clusterId?: string, user?: any) {
    let targetOrg = organizationId;
    if (user) {
      const validation = await this.validateUserOrgAndCluster(user, organizationId, clusterId);
      if (!organizationId || organizationId.toUpperCase() === 'ALL') {
        targetOrg = validation.orgId;
      }
    }
    return await HealingActionModel.getAnalytics(targetOrg, clusterId);
  }

  /**
   * 13. Lấy cấu hình rào chắn an toàn (Safety Guards: Blast Radius, Max Restarts, Cooldown)
   */
  public static async getSafetyGuards(orgId?: string, clusterId?: string) {
    const defaultGuards = {
      blast_radius_threshold: 45,
      max_restarts: 2,
      restart_time_window: 15,
      approval_timeout: 30,
      cooldown_period: 1,
      global_mode: 'AUTONOMOUS',
    };

    if (!orgId) return defaultGuards;

    try {
      let query = `
        SELECT blast_radius_threshold, max_restarts, restart_time_window, approval_timeout, cooldown_period, global_mode, cluster_id, organization_id
        FROM cluster_safety_guards
        WHERE organization_id = $1
      `;
      const params: any[] = [orgId];

      if (clusterId && clusterId !== 'all') {
        query += ` AND (cluster_id::text = $2::text OR cluster_id IS NULL) ORDER BY cluster_id NULLS LAST LIMIT 1`;
        params.push(clusterId);
      } else {
        query += ` ORDER BY cluster_id NULLS LAST LIMIT 1`;
      }

      const res = await pool.query(query, params);
      if (res.rows.length > 0) {
        const row = res.rows[0];
        return {
          blast_radius_threshold: Number(row.blast_radius_threshold) || 45,
          max_restarts: Number(row.max_restarts) || 2,
          restart_time_window: Number(row.restart_time_window) || 15,
          approval_timeout: Number(row.approval_timeout) || 30,
          cooldown_period: Number(row.cooldown_period) || 1,
          global_mode: row.global_mode || 'AUTONOMOUS',
          cluster_id: row.cluster_id,
          organization_id: row.organization_id,
        };
      }
    } catch (err: any) {
      console.warn('[HealingActionService] Lỗi nạp safety guards từ DB:', err?.message || err);
    }

    return defaultGuards;
  }

  /**
   * 14. Lưu cấu hình rào chắn an toàn (Safety Guards) xuống Database
   */
  public static async saveSafetyGuards(
    orgId: string,
    clusterId?: string,
    envId?: string,
    data?: any,
    user?: any,
    reqContext?: IAuditRequestContext
  ) {
    if (!orgId) {
      throw new ApiError(400, 'Mã tổ chức không hợp lệ');
    }

    const blastRadiusThreshold = Math.min(100, Math.max(5, Number(data?.blast_radius_threshold || 45)));
    const maxRestarts = Math.max(1, Number(data?.max_restarts || 2));
    const restartTimeWindow = Math.max(1, Number(data?.restart_time_window || 15));
    const approvalTimeout = Math.max(5, Number(data?.approval_timeout || 30));
    const cooldownPeriod = Math.max(1, Number(data?.cooldown_period || 1));
    const rawMode = String(data?.global_mode || '').toUpperCase();
    let globalMode = 'AUTONOMOUS';
    if (['SUPERVISED', 'SEMI_AUTONOMOUS'].includes(rawMode)) {
      globalMode = 'SUPERVISED';
    } else if (['AUDIT', 'AUDIT_ONLY'].includes(rawMode)) {
      globalMode = 'AUDIT';
    } else if (rawMode === 'AUTONOMOUS') {
      globalMode = 'AUTONOMOUS';
    }

    const validClusterId = clusterId && clusterId !== 'all' ? clusterId : null;
    const validEnvId = envId && envId !== 'all' ? envId : null;

    const query = `
      INSERT INTO cluster_safety_guards (
        organization_id, cluster_id, environment_id, blast_radius_threshold, max_restarts,
        restart_time_window, approval_timeout, cooldown_period, global_mode, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      ON CONFLICT (organization_id, cluster_id) DO UPDATE SET
        blast_radius_threshold = EXCLUDED.blast_radius_threshold,
        max_restarts = EXCLUDED.max_restarts,
        restart_time_window = EXCLUDED.restart_time_window,
        approval_timeout = EXCLUDED.approval_timeout,
        cooldown_period = EXCLUDED.cooldown_period,
        global_mode = EXCLUDED.global_mode,
        environment_id = COALESCE(EXCLUDED.environment_id, cluster_safety_guards.environment_id),
        updated_at = NOW()
      RETURNING *;
    `;

    const res = await pool.query(query, [
      orgId,
      validClusterId,
      validEnvId,
      blastRadiusThreshold,
      maxRestarts,
      restartTimeWindow,
      approvalTimeout,
      cooldownPeriod,
      globalMode,
    ]);

    return res.rows[0];
  }
}
