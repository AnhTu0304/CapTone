import { request } from './apiClient';

/**
 * Service quản lý cụm Kubernetes kết nối trực tiếp Backend & Database
 */
export const clusterService = {
  /**
   * Lấy danh sách các cụm Kubernetes theo Tổ chức (chỉ trả về cụm thuộc tổ chức đó)
   * @param {string} orgId 
   * @returns {Promise<Array>}
   */
  async getClustersByOrg(orgId) {
    if (!orgId) return [];
    try {
      const res = await request(`/organizations/${orgId}/clusters`);
      if (res?.success && Array.isArray(res.data)) {
        return res.data;
      }
      return Array.isArray(res) ? res : [];
    } catch (err) {
      console.warn(`[clusterService] Không thể tải cụm của org ${orgId}:`, err.message);
      return [];
    }
  },

  /**
   * Lấy toàn bộ danh sách cụm Kubernetes toàn hệ thống (Dành cho Platform Admin)
   * @returns {Promise<Array>}
   */
  async getAllClusters() {
    try {
      const res = await request('/clusters');
      if (res?.success && Array.isArray(res.data)) {
        return res.data;
      }
      return [];
    } catch (err) {
      console.warn('[clusterService] Lỗi tải cụm toàn hệ thống:', err.message);
      return [];
    }
  },

  /**
   * Lấy chi tiết toàn diện của một cụm Kubernetes (kèm danh sách Nodes, Pods, Namespaces, Agent)
   * @param {string} clusterId 
   * @param {string} [orgId] 
   * @returns {Promise<Object|null>}
   */
  async getClusterDetail(clusterId, orgId) {
    if (!clusterId) return null;
    try {
      if (orgId && !orgId.startsWith('org-')) {
        try {
          const res = await request(`/organizations/${orgId}/clusters/${clusterId}`);
          if (res?.success && res.data) return res.data;
        } catch (orgErr) {
          console.warn(`[clusterService] Org route detail failed, attempting global route:`, orgErr.message);
        }
      }
      const res = await request(`/clusters/${clusterId}`);
      if (res?.success && res.data) return res.data;
      return null;
    } catch (err) {
      console.warn(`[clusterService] Lỗi tải chi tiết cụm ${clusterId}:`, err.message);
      return null;
    }
  },

  /**
   * Đăng ký cụm Kubernetes mới cho tổ chức
   * @param {string} orgId 
   * @param {Object} data 
   * @returns {Promise<Object>}
   */
  async createCluster(orgId, data) {
    const res = await request(`/organizations/${orgId}/clusters`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return res?.data || res;
  },

  /**
   * Xoay vòng hoặc cấp mới Token kết nối của Agent cho cụm K8s
   * @param {string} clusterId 
   * @param {string} [orgId] 
   * @param {Object} [options] 
   * @returns {Promise<Object>}
   */
  async rotateClusterToken(clusterId, orgId, options = {}) {
    if (!clusterId) throw new Error('clusterId is required');
    const path = orgId && !orgId.startsWith('org-')
      ? `/organizations/${orgId}/clusters/${clusterId}/rotate-token`
      : `/clusters/${clusterId}/rotate-token`;
    const res = await request(path, {
      method: 'POST',
      body: JSON.stringify(options),
    });
    return res?.data || res;
  },

  /**
   * Thu hồi một Token kết nối của Agent thuộc cụm K8s
   * @param {string} clusterId 
   * @param {string} tokenId 
   * @param {string} [orgId] 
   * @returns {Promise<boolean>}
   */
  async revokeClusterToken(clusterId, tokenId, orgId) {
    if (!clusterId || !tokenId) throw new Error('clusterId and tokenId are required');
    const path = orgId && !orgId.startsWith('org-')
      ? `/organizations/${orgId}/clusters/${clusterId}/tokens/${tokenId}`
      : `/clusters/${clusterId}/tokens/${tokenId}`;
    const res = await request(path, {
      method: 'DELETE',
    });
    return res?.success ?? true;
  },

  /**
   * Cập nhật cấu hình Agent (chu kỳ metrics, namespaces, eBPF probes, log level)
   * @param {string} clusterId 
   * @param {string} [orgId] 
   * @param {Object} configData 
   * @returns {Promise<Object>}
   */
  async updateAgentConfig(clusterId, orgId, configData) {
    if (!clusterId) throw new Error('clusterId is required');
    const path = orgId && !orgId.startsWith('org-')
      ? `/organizations/${orgId}/clusters/${clusterId}/agent-config`
      : `/clusters/${clusterId}/agent-config`;
    const res = await request(path, {
      method: 'PUT',
      body: JSON.stringify(configData),
    });
    return res?.data || res;
  },

  /**
   * Kích hoạt hoặc kết nối Agent cho Cụm Kubernetes (Connect Agent)
   * @param {string} clusterId 
   * @param {string} [orgId] 
   * @returns {Promise<Object>}
   */
  async connectAgent(clusterId, orgId) {
    if (!clusterId) throw new Error('clusterId is required');
    const path = orgId && !orgId.startsWith('org-')
      ? `/organizations/${orgId}/clusters/${clusterId}/connect-agent`
      : `/clusters/${clusterId}/connect-agent`;
    const res = await request(path, {
      method: 'POST',
    });
    return res?.data || res;
  },

  /**
   * Ngắt kết nối Agent khỏi Cụm Kubernetes (Disconnect Agent)
   * @param {string} clusterId 
   * @param {string} [orgId] 
   * @returns {Promise<Object>}
   */
  async disconnectAgent(clusterId, orgId) {
    if (!clusterId) throw new Error('clusterId is required');
    const path = orgId && !orgId.startsWith('org-')
      ? `/organizations/${orgId}/clusters/${clusterId}/disconnect-agent`
      : `/clusters/${clusterId}/disconnect-agent`;
    const res = await request(path, {
      method: 'POST',
    });
    return res?.data || res;
  },

  /**
   * Xóa cấu hình Cụm Kubernetes khỏi hệ thống (Remove Cluster)
   * @param {string} clusterId 
   * @param {string} [orgId] 
   * @returns {Promise<Object>}
   */
  async removeCluster(clusterId, orgId) {
    if (!clusterId) throw new Error('clusterId is required');
    const path = orgId && !orgId.startsWith('org-')
      ? `/organizations/${orgId}/clusters/${clusterId}`
      : `/clusters/${clusterId}`;
    const res = await request(path, {
      method: 'DELETE',
    });
    return res?.data || res;
  },
};

export default clusterService;
