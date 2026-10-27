import { pool } from '../config/database';
import { HealingActionModel, IHealingActionFilter } from '../models/healingAction.model';
import { ApiError } from '../utils/apiError';
import { dispatchHealingActionToAgent } from '../websocket/agentWebSocket';
import { broadcastTelemetryToUi } from '../websocket/telemetryWebSocket';
import { OrganizationMemberModel } from '../models/organizationMember.model';

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

    return await HealingActionModel.createAction({
      ...data,
      requested_by: userId || null,
    });
  }

  /**
   * 4. Execute or retry an action
   */
  public static async executeAction(actionId: string, executedBy?: string | null, user?: any) {
    if (!actionId) {
      throw new ApiError(400, 'Mã hành động không hợp lệ');
    }

    const action = await HealingActionModel.findActionById(actionId);
    if (!action) {
      throw new ApiError(404, 'Không tìm thấy hành động tự phục hồi yêu cầu');
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

    // Resolve actual namespace and canonical workload name
    let targetNamespace = 'default';
    let targetWorkloadName = action.target_name || 'sme-order-service';
    if (action.target_name || action.target_id) {
      try {
        const lookupKey = action.target_name || action.target_id;
        const wlRes = await pool.query(
          `SELECT w.name as workload_name, n.name as namespace_name 
           FROM workloads w 
           LEFT JOIN namespaces n ON n.id = w.namespace_id 
           WHERE w.name = $1 OR w.id::text = $1 
           ORDER BY w.updated_at DESC NULLS LAST
           LIMIT 1`,
          [lookupKey]
        );
        if (wlRes.rows.length > 0) {
          if (wlRes.rows[0].workload_name) targetWorkloadName = wlRes.rows[0].workload_name;
          if (wlRes.rows[0].namespace_name) targetNamespace = wlRes.rows[0].namespace_name;
        } else if (
          ['chaos-testagent2', 'ecommerce-store-app', 'attack-injector-app', 'selfheal-test-app', 'mongodb'].some((svc) =>
            String(targetWorkloadName).startsWith(svc)
          )
        ) {
          targetNamespace = 'test-lab';
        }
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
        const dispatched = await dispatchHealingActionToAgent({
          action_id: actionId,
          action_type: actionCode,
          target_name: targetWorkloadName,
          namespace: targetNamespace,
          cluster_id: action.cluster_id,
          environment_id: action.environment_id,
          params: action.result?.params || {},
        });
        if (dispatched) {
          // Wait briefly for K8s Agent WebSocket action_result callback to persist actual K8s outcome
          await new Promise((resolve) => setTimeout(resolve, 800));
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

    return result;
  }

  /**
   * 4b. Hủy bỏ (Abort) một hành động đang thực thi hoặc đang chờ duyệt
   */
  public static async abortAction(
    actionId: string,
    userId: string | null,
    reason?: string,
    user?: any
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
    }
  ) {
    if (!id) {
      throw new ApiError(400, 'Mã chính sách không hợp lệ');
    }

    const updated = await HealingActionModel.updatePolicyConfig(id, data);
    if (!updated) {
      throw new ApiError(404, 'Không tìm thấy chính sách tự phục hồi để cập nhật');
    }
    return updated;
  }

  /**
   * 10. Toggle policy active
   */
  public static async togglePolicyActive(id: string) {
    if (!id) {
      throw new ApiError(400, 'Mã chính sách không hợp lệ');
    }

    const updated = await HealingActionModel.togglePolicyActive(id);
    if (!updated) {
      throw new ApiError(404, 'Không tìm thấy chính sách tự phục hồi');
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
  }) {
    if (!data.name || !data.organization_id) {
      throw new ApiError(400, 'Tên chính sách và tổ chức là bắt buộc');
    }
    return await HealingActionModel.createPolicy(data);
  }

  /**
   * 11. Approvals: List, Approve, Reject
   */
  public static async getApprovals(
    filters: {
      organization_id?: string;
      cluster_id?: string;
      status?: string;
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

  public static async approveAction(actionId: string, approvedBy: string, reason?: string, user?: any) {
    if (!actionId) {
      throw new ApiError(400, 'Mã hành động không hợp lệ');
    }
    if (user) {
      const action = await HealingActionModel.findActionById(actionId);
      if (action) {
        await this.validateUserOrgAndCluster(user, action.organization_id, action.cluster_id);
      }
    }
    const approved = await HealingActionModel.approveAction(actionId, approvedBy, reason);
    if (!approved) {
      throw new ApiError(404, 'Không tìm thấy hành động hoặc hành động không thể phê duyệt');
    }
    // Sau khi phê duyệt HITL thành công, tự động kích hoạt thực thi xuống K8s Agent
    try {
      await this.executeAction(actionId, approvedBy, user);
    } catch (execErr) {
      console.warn('[HealingActionService] Auto-execute after HITL approval warning:', execErr);
    }
    return await HealingActionModel.findActionById(actionId);
  }

  public static async rejectAction(actionId: string, rejectedBy: string, reason?: string, user?: any) {
    if (!actionId) {
      throw new ApiError(400, 'Mã hành động không hợp lệ');
    }
    if (user) {
      const action = await HealingActionModel.findActionById(actionId);
      if (action) {
        await this.validateUserOrgAndCluster(user, action.organization_id, action.cluster_id);
      }
    }
    const rejected = await HealingActionModel.rejectAction(actionId, rejectedBy, reason);
    if (!rejected) {
      throw new ApiError(404, 'Không tìm thấy hành động hoặc hành động không thể từ chối');
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
