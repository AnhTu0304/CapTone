/**
 * @file selfHealingService.js
 * @description Frontend Service kết nối trực tiếp với Main Backend API phân hệ Self-Healing (/api/v1/healing)
 * Quản lý Actions, Running Actions, Action Types, Policies, Approvals (HITL), và Analytics thời gian thực.
 */

import { request } from './apiClient';

export const selfHealingService = {
  /**
   * 1. Lấy danh sách các hành động tự phục hồi
   * GET /api/v1/healing/actions
   * @param {Object} params - { limit, offset, cluster_id, organization_id, risk_level, execution_mode, execution_status, search }
   */
  async getActions(params = {}) {
    try {
      const search = new URLSearchParams();
      if (params.limit) search.append('limit', String(params.limit));
      if (params.offset) search.append('offset', String(params.offset));
      if (params.cluster_id && params.cluster_id !== 'all') search.append('cluster_id', params.cluster_id);
      if (params.organization_id && params.organization_id !== 'all') search.append('organization_id', params.organization_id);
      if (params.risk_level && params.risk_level !== 'all') search.append('risk_level', params.risk_level);
      if (params.execution_mode && params.execution_mode !== 'all') search.append('execution_mode', params.execution_mode);
      if (params.execution_status && params.execution_status !== 'all') search.append('execution_status', params.execution_status);
      if (params.search) search.append('search', params.search);

      const qs = search.toString();
      const res = await request(`/healing/actions${qs ? `?${qs}` : ''}`);
      return res?.data || { items: [], total: 0 };
    } catch (err) {
      console.warn('[selfHealingService] getActions error:', err.message);
      return { items: [], total: 0 };
    }
  },

  /**
   * 1b. Lấy danh sách hành động tự phục hồi đang chạy ngầm (RUNNING / PENDING)
   * GET /api/v1/healing/actions/running
   */
  async getRunningActions(params = {}) {
    try {
      const search = new URLSearchParams();
      if (params.limit) search.append('limit', String(params.limit));
      if (params.offset) search.append('offset', String(params.offset));
      if (params.cluster_id && params.cluster_id !== 'all') search.append('cluster_id', params.cluster_id);
      if (params.organization_id && params.organization_id !== 'all') search.append('organization_id', params.organization_id);
      if (params.search) search.append('search', params.search);

      const qs = search.toString();
      const res = await request(`/healing/actions/running${qs ? `?${qs}` : ''}`);
      return res?.data || { items: [], total: 0 };
    } catch (err) {
      console.warn('[selfHealingService] getRunningActions error:', err.message);
      return { items: [], total: 0 };
    }
  },

  /**
   * 2. Lấy chi tiết 1 hành động kèm attempts và verification
   * GET /api/v1/healing/actions/:id
   */
  async getActionById(id) {
    try {
      const res = await request(`/healing/actions/${id}`);
      return res?.data || null;
    } catch (err) {
      console.warn('[selfHealingService] getActionById error:', err.message);
      return null;
    }
  },

  /**
   * 3. Thực thi hoặc chạy lại (retry) một hành động
   * POST /api/v1/healing/actions/:id/execute
   */
  async executeAction(id) {
    return await request(`/healing/actions/${id}/execute`, {
      method: 'POST',
    });
  },

  /**
   * 3b. Hủy bỏ (Abort / Cancel) một hành động đang thực thi hoặc đang chờ
   * POST /api/v1/healing/actions/:id/abort
   */
  async abortAction(id, reason = '') {
    return await request(`/healing/actions/${id}/abort`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },

  /**
   * 4. Lấy danh mục các loại hành động chuẩn hóa
   * GET /api/v1/healing/action-types
   */
  async getActionTypes() {
    try {
      const res = await request('/healing/action-types');
      return res?.data || [];
    } catch (err) {
      console.warn('[selfHealingService] getActionTypes error:', err.message);
      return [];
    }
  },

  /**
   * 5. Lấy danh sách chính sách tự phục hồi
   * GET /api/v1/healing/policies
   */
  async getPolicies(params = {}) {
    try {
      const search = new URLSearchParams();
      if (params.organization_id && params.organization_id !== 'all') search.append('organization_id', params.organization_id);
      if (params.environment_id && params.environment_id !== 'all') search.append('environment_id', params.environment_id);
      if (params.search) search.append('search', params.search);

      const qs = search.toString();
      const res = await request(`/healing/policies${qs ? `?${qs}` : ''}`);
      return res?.data || [];
    } catch (err) {
      console.warn('[selfHealingService] getPolicies error:', err.message);
      return [];
    }
  },

  /**
   * 6. Cập nhật cấu hình chính sách
   * PUT /api/v1/healing/policies/:id
   */
  async updatePolicyConfig(id, data) {
    return await request(`/healing/policies/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  /**
   * 7. Bật / Tắt kích hoạt chính sách
   * PATCH /api/v1/healing/policies/:id/toggle
   */
  async togglePolicyActive(id) {
    return await request(`/healing/policies/${id}/toggle`, {
      method: 'PATCH',
    });
  },

  /**
   * 7b. Tạo mới chính sách tự phục hồi
   * POST /api/v1/healing/policies
   */
  async createPolicy(data) {
    return await request('/healing/policies', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * 8. Lấy danh sách yêu cầu phê duyệt HITL
   * GET /api/v1/healing/approvals
   */
  async getApprovals(params = {}) {
    try {
      const search = new URLSearchParams();
      if (params.limit) search.append('limit', String(params.limit));
      if (params.offset) search.append('offset', String(params.offset));
      if (params.status && params.status !== 'all') search.append('status', params.status);
      if (params.organization_id && params.organization_id !== 'all') search.append('organization_id', params.organization_id);
      if (params.cluster_id && params.cluster_id !== 'all') search.append('cluster_id', params.cluster_id);

      const qs = search.toString();
      const res = await request(`/healing/approvals${qs ? `?${qs}` : ''}`);
      return res?.data || { items: [], total: 0 };
    } catch (err) {
      console.warn('[selfHealingService] getApprovals error:', err.message);
      return { items: [], total: 0 };
    }
  },

  /**
   * 9. Phê duyệt hành động rủi ro cao
   * POST /api/v1/healing/actions/:id/approve
   */
  async approveAction(id, reason = '') {
    return await request(`/healing/actions/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },

  /**
   * 10. Từ chối hành động rủi ro cao
   * POST /api/v1/healing/actions/:id/reject
   */
  async rejectAction(id, reason = '') {
    return await request(`/healing/actions/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },

  /**
   * 11. Lấy số liệu thống kê tự phục hồi (MTTR, tỷ lệ thành công)
   * GET /api/v1/healing/analytics
   */
  async getAnalytics(params = {}) {
    try {
      const search = new URLSearchParams();
      if (params.organization_id && params.organization_id !== 'all') search.append('organization_id', params.organization_id);
      if (params.cluster_id && params.cluster_id !== 'all') search.append('cluster_id', params.cluster_id);

      const qs = search.toString();
      const res = await request(`/healing/analytics${qs ? `?${qs}` : ''}`);
      return res?.data || null;
    } catch (err) {
      console.warn('[selfHealingService] getAnalytics error:', err.message);
      return null;
    }
  },
};
