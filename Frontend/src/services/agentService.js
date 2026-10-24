import { request } from './apiClient';

/**
 * Service quản trị Tác tử eBPF Agent kết nối trực tiếp Backend & CSDL
 */
export const agentService = {
  /**
   * Lấy danh sách Agents theo tổ chức và bộ lọc (clusterId, environmentId, status, search)
   * @param {string} orgId 
   * @param {Object} [params]
   * @returns {Promise<{ items: Array, total: number }>}
   */
  async getAgents(orgId, params = {}) {
    if (!orgId) return { items: [], total: 0 };
    try {
      const query = new URLSearchParams();
      if (params.clusterId) query.append('cluster_id', params.clusterId);
      if (params.environmentId) query.append('environment_id', params.environmentId);
      if (params.status && params.status !== 'ALL') query.append('status', params.status);
      if (params.search) query.append('search', params.search);
      if (params.page) query.append('page', params.page);
      if (params.limit) query.append('limit', params.limit);

      const qs = query.toString() ? `?${query.toString()}` : '';
      const res = await request(`/organizations/${orgId}/agents${qs}`);
      if (res?.success && res.data) {
        return res.data;
      }
      return { items: [], total: 0 };
    } catch (err) {
      console.warn(`[agentService] Lỗi tải danh sách Agent:`, err.message);
      return { items: [], total: 0 };
    }
  },

  /**
   * Lấy chi tiết một Agent (kèm tokens và lịch sử heartbeat)
   * @param {string} orgId 
   * @param {string} agentId 
   * @returns {Promise<Object|null>}
   */
  async getAgentDetail(orgId, agentId) {
    if (!orgId || !agentId) return null;
    try {
      const res = await request(`/organizations/${orgId}/agents/${agentId}`);
      if (res?.success && res.data) {
        return res.data;
      }
      return null;
    } catch (err) {
      console.warn(`[agentService] Lỗi tải chi tiết Agent ${agentId}:`, err.message);
      return null;
    }
  },

  /**
   * Thu hồi Agent Token
   */
  async revokeAgent(orgId, agentId) {
    if (!orgId || !agentId) return false;
    try {
      const res = await request(`/organizations/${orgId}/agents/${agentId}/revoke`, {
        method: 'POST',
      });
      return res?.success || false;
    } catch (err) {
      console.warn(`[agentService] Lỗi thu hồi Agent:`, err.message);
      return false;
    }
  },

  /**
   * Ngắt kết nối Agent (chuyển sang OFFLINE và thu hồi token kết nối)
   * @param {string} orgId 
   * @param {string} agentId 
   * @returns {Promise<Object>}
   */
  async disconnectAgent(orgId, agentId) {
    if (!orgId || !agentId) throw new Error('orgId và agentId là bắt buộc');
    const res = await request(`/organizations/${orgId}/agents/${agentId}/disconnect`, {
      method: 'POST',
    });
    return res?.data || res;
  },

  /**
   * Xóa Agent khỏi hệ thống (hỗ trợ cờ an toàn force khi đang ONLINE)
   * @param {string} orgId 
   * @param {string} agentId 
   * @param {boolean} [force=false]
   * @returns {Promise<Object>}
   */
  async deleteAgent(orgId, agentId, force = false) {
    if (!orgId || !agentId) throw new Error('orgId và agentId là bắt buộc');
    const query = force ? '?force=true' : '';
    const res = await request(`/organizations/${orgId}/agents/${agentId}${query}`, {
      method: 'DELETE',
    });
    return res?.data || res;
  },
};

export default agentService;
