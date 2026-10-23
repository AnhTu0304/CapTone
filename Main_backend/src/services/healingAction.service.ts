import { HealingActionModel, IHealingActionFilter } from '../models/healingAction.model';
import { ApiError } from '../utils/apiError';

export class HealingActionService {
  /**
   * 1. Get list of healing actions with multi-dimensional filters
   */
  public static async getActions(filters: IHealingActionFilter = {}) {
    return await HealingActionModel.findManyActions(filters);
  }

  /**
   * 2. Get healing action details by ID
   */
  public static async getActionById(id: string) {
    if (!id) {
      throw new ApiError(400, 'Mã định danh hành động không hợp lệ');
    }
    const action = await HealingActionModel.findActionById(id);
    if (!action) {
      throw new ApiError(404, 'Không tìm thấy hành động tự phục hồi yêu cầu');
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
  public static async executeAction(actionId: string, executedBy?: string | null) {
    if (!actionId) {
      throw new ApiError(400, 'Mã hành động không hợp lệ');
    }
    return await HealingActionModel.executeAction(actionId, executedBy || undefined);
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
  public static async getApprovals(filters: {
    organization_id?: string;
    cluster_id?: string;
    status?: string;
    limit?: number;
    offset?: number;
  } = {}) {
    return await HealingActionModel.findApprovals(filters);
  }

  public static async approveAction(actionId: string, approvedBy: string, reason?: string) {
    if (!actionId) {
      throw new ApiError(400, 'Mã hành động không hợp lệ');
    }
    const approved = await HealingActionModel.approveAction(actionId, approvedBy, reason);
    if (!approved) {
      throw new ApiError(404, 'Không tìm thấy hành động hoặc hành động không thể phê duyệt');
    }
    return approved;
  }

  public static async rejectAction(actionId: string, rejectedBy: string, reason?: string) {
    if (!actionId) {
      throw new ApiError(400, 'Mã hành động không hợp lệ');
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
  public static async getAnalytics(organizationId?: string, clusterId?: string) {
    return await HealingActionModel.getAnalytics(organizationId, clusterId);
  }
}
