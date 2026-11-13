import { AuditService, IAuditRequestContext } from './audit.service';
import { AuditAction } from '../models/auditLog.model';
import { pool } from '../config/database';
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
  ): Promise<{ orgId?: string; clusterId?: string }> {
    if (!user || !user.id) {
      throw new ApiError(401, 'Yêu cầu đăng nhập trước khi truy cập tài nguyên');
    }

    const userRoles: string[] = Array.isArray(user.roles)
      ? user.roles.map((r: string) => r.trim().toUpperCase())
      : [];
    const isSystemAdmin =
      userRoles.includes('SUPER_ADMIN') ||
      userRoles.includes('SYSTEM_ADMIN') ||
      userRoles.includes('ADMIN') ||
      userRoles.includes('SME_OWNER') ||
      userRoles.includes('DEVOPS');

    // Xác định tổ chức mục tiêu (cho phép truy cập cụm Lab mặc định 00000000-0000-0000-0000-000000000001)
    const targetOrgId = organizationId || user.organization_id;
    const isDefaultSharedOrg = targetOrgId === '00000000-0000-0000-0000-000000000001';

    if (!isSystemAdmin && targetOrgId && !isDefaultSharedOrg) {
      const member = await OrganizationMemberModel.findByOrgAndUser(targetOrgId, user.id);
      if (!member || member.status !== 'ACTIVE') {
        throw new ApiError(
          403,
          'Từ chối truy cập: Bạn không phải là thành viên đang hoạt động của tổ chức này'
        );
      }
    }

    // Kiểm tra tính hợp lệ của Cụm K8s (nếu có cung cấp)
    if (clusterId && clusterId !== 'ALL' && clusterId !== 'all' && !isDefaultSharedOrg) {
      const clusterCheck = await HealingActionModel.validateClusterBelongsToOrg(clusterId, targetOrgId);
      if (!clusterCheck && !isSystemAdmin) {
        throw new ApiError(
          403,
          'Từ chối truy cập: Cụm Kubernetes này không tồn tại hoặc không thuộc quyền quản lý của tổ chức của bạn'
        );
      }
    }

    return { orgId: targetOrgId, clusterId };
  }

  /**
   * 1. Get list of healing actions with multi-dimensional filters
   */
  public static async getActions(filters: IHealingActionFilter = {}, user?: any) {
    if (user) {
      await this.validateUserOrgAndCluster(user, filters.organization_id, filters.cluster_id);
    }
    return await HealingActionModel.findManyActions(filters);
  }

  /**
   * 1b. Lấy danh sách hành động tự phục hồi đang chạy ngầm (RUNNING / PENDING)
   */
  public static async getRunningActions(
    filters: { organization_id?: string; cluster_id?: string; search?: string; limit?: number; offset?: number } = {},
    user?: any
  ) {
    if (user) {
      await this.validateUserOrgAndCluster(user, filters.organization_id, filters.cluster_id);
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
    userId?: string | null
  ) {
    if (!data.incident_id || !data.environment_id || !data.action_type_id) {
      throw new ApiError(
        400,
        'Thiếu thông tin bắt buộc: incident_id, environment_id, action_type_id'
      );
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
  public static async executeAction(actionId: string, executedBy?: string | null, user?: any, reqContext?: IAuditRequestContext) {
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

    // Target Concurrency Lock: Prevent multiple actions running concurrently on the same target workload/incident
    if (action.target_name || action.incident_id) {
      const activeRunningCheck = await pool.query(
        `SELECT id, action_type_code, execution_status, created_at 
         FROM healing_actions 
         WHERE id != $1 
           AND execution_status IN ('RUNNING', 'PENDING')
           AND (
             (target_name IS NOT NULL AND target_name = $2)
             OR (incident_id IS NOT NULL AND incident_id = $3)
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

    // Tenant & Cluster Access Validation
    if (user) {
      await this.validateUserOrgAndCluster(user, action.organization_id, action.cluster_id);
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

    if (actionCode === 'NO_ACTION') {
      console.log(`🛡️ [HealingActionService] Action is NO_ACTION (Circuit Breaker). Skipping automated agent dispatch.`);
    } else {
      try {
        const dispatchResult = await dispatchHealingActionToAgent({
          action_id: actionId,
          action_type: actionCode,
          target_name: targetWorkloadName,
          namespace: targetNamespace,
          cluster_id: action.cluster_id,
          environment_id: action.environment_id,
          params: action.result?.params || {},
        });
        if (dispatchResult?.dispatched) {
          // Fallback safety timeout: nếu K8s Agent không phản hồi sau 60 giây, đánh dấu FAILED tránh kẹt RUNNING
          setTimeout(async () => {
            try {
              await pool.query(
                `UPDATE healing_actions 
                 SET execution_status = 'FAILED', 
                     completed_at = COALESCE(completed_at, NOW()),
                     error_message = 'Quá thời gian chờ (60s) nhưng Kubernetes Agent chưa phản hồi kết quả thực thi.',
                     result = jsonb_set(COALESCE(result, '{}'::jsonb), '{error}', '"Agent execution timeout after 60s"'::jsonb) 
                 WHERE id = $1 AND execution_status = 'RUNNING'`,
                [actionId]
              );
              if (action.incident_id) {
                await pool.query(
                  `UPDATE incidents SET status = 'OPEN', resolved_at = NULL WHERE id = $1 AND status = 'RESOLVED'`,
                  [action.incident_id]
                ).catch(() => {});
              }
            } catch (e) {
              // ignore
            }
          }, 60000);

          // Wait briefly for K8s Agent WebSocket action_result callback to persist actual K8s outcome
          await new Promise((resolve) => setTimeout(resolve, 1500));
          const refreshed = await HealingActionModel.findActionById(actionId);
          if (refreshed) {
            result.action = refreshed;
          }
        } else {
          await pool.query(
            `UPDATE healing_actions 
             SET execution_status = 'FAILED', 
                 completed_at = NOW(),
                 error_message = 'Không có Kubernetes Agent nào trực tuyến để nhận lệnh tự phục hồi.',
                 result = jsonb_set(COALESCE(result, '{}'::jsonb), '{error}', '"Không có Agent K8s trực tuyến"'::jsonb) 
             WHERE id = $1 AND execution_status = 'RUNNING'`,
            [actionId]
          );
          if (action.incident_id) {
            await pool.query(
              'UPDATE incidents SET status = \'OPEN\', resolved_at = NULL WHERE id = $1 AND status = \'RESOLVED\'',
              [action.incident_id]
            ).catch(() => {});
          }
          const refreshed = await HealingActionModel.findActionById(actionId);
          if (refreshed) {
            result.action = refreshed;
          }
        }
      } catch (e) {
        console.warn('[HealingActionService] Dispatch to agent failed:', e);
      }
    }

    // Broadcast WebSocket event: completed
    try {
      broadcastTelemetryToUi({
        type: 'healing_action_completed',
        data: {
          action_id: actionId,
          status: result.action?.execution_status || 'SUCCEEDED',
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
      const actStatus = result.action?.execution_status || 'SUCCEEDED';
      const isSuccess = actStatus === 'SUCCEEDED';
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

    // Tenant & Cluster Access Validation
    if (user) {
      await this.validateUserOrgAndCluster(user, action.organization_id, action.cluster_id);
    }

    const completedStatuses = ['SUCCEEDED', 'FAILED', 'CANCELLED'];
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
   * 5. Update execution status
   */
  public static async updateActionStatus(
    actionId: string,
    status: string,
    result?: any,
    errorMessage?: string
  ) {
    if (!actionId || !status) {
      throw new ApiError(400, 'Mã hành động và trạng thái không được để trống');
    }

    const updated = await HealingActionModel.updateStatus(actionId, status, result, errorMessage);
    if (!updated) {
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
   * 7. Update action type configuration
   */
  public static async updateActionType(
    id: string,
    data: {
      enabled?: boolean;
      default_risk_level?: string;
      requires_approval_by_default?: boolean;
      description?: string;
    }
  ) {
    if (!id) {
      throw new ApiError(400, 'Mã loại hành động không hợp lệ');
    }

    const updated = await HealingActionModel.updateActionType(id, data);
    if (!updated) {
      throw new ApiError(404, 'Không tìm thấy loại hành động hoặc không có thay đổi');
    }
    return updated;
  }

  /**
   * 8. List policies
   */
  public static async getPolicies(filters: {
    organization_id?: string;
    environment_id?: string;
    is_active?: boolean;
    search?: string;
  } = {}) {
    return await HealingActionModel.findPolicies(filters);
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
    } = {},
    user?: any
  ) {
    if (user) {
      await this.validateUserOrgAndCluster(user, filters.organization_id, filters.cluster_id);
    }
    return await HealingActionModel.findApprovals(filters);
  }

  public static async approveAction(actionId: string, approvedBy: string, reason?: string, user?: any, reqContext?: IAuditRequestContext) {
    if (!actionId) {
      throw new ApiError(400, 'Mã hành động không hợp lệ');
    }
    const action = await HealingActionModel.findActionById(actionId);
    if (user && action) {
      await this.validateUserOrgAndCluster(user, action.organization_id, action.cluster_id);
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
      await this.executeAction(actionId, approvedBy, user, reqContext);
    } catch (execErr) {
      console.warn('[HealingActionService] Auto-execute after HITL approval warning:', execErr);
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

  public static async rejectAction(actionId: string, rejectedBy: string, reason?: string, user?: any, reqContext?: IAuditRequestContext) {
    if (!actionId) {
      throw new ApiError(400, 'Mã hành động không hợp lệ');
    }
    const action = await HealingActionModel.findActionById(actionId);
    if (user && action) {
      await this.validateUserOrgAndCluster(user, action.organization_id, action.cluster_id);
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
    if (user) {
      await this.validateUserOrgAndCluster(user, organizationId, clusterId);
    }
    return await HealingActionModel.getAnalytics(organizationId, clusterId);
  }
}
