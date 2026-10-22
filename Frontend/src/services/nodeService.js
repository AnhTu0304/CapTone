import { request } from './apiClient';

/**
 * Service quản lý Node máy chủ Kubernetes kết nối trực tiếp Backend & CSDL
 * Tuyến đường độc lập theo Cụm K8s, KHÔNG gộp trong tổ chức
 */
export const nodeService = {
  /**
   * Lấy danh sách Nodes của một Cụm Kubernetes cụ thể
   * @param {string} clusterId - ID hoặc UID của Cụm K8s
   * @returns {Promise<Array>}
   */
  async getNodesByCluster(clusterId) {
    if (!clusterId || clusterId.startsWith('org-') || clusterId.startsWith('sandbox-')) {
      return [];
    }

    try {
      // 1. Thử qua router chuyên trách cụm /clusters/:clusterId/nodes
      const res = await request(`/clusters/${encodeURIComponent(clusterId)}/nodes`);
      if (res?.success && Array.isArray(res.data)) {
        return res.data;
      }
      if (Array.isArray(res)) return res;
    } catch (err) {
      console.warn('[nodeService] /clusters/:id/nodes thất bại, thử /nodes?clusterId:', err.message);
    }

    try {
      // 2. Thử qua router /nodes?clusterId=...
      const res = await request(`/nodes?clusterId=${encodeURIComponent(clusterId)}`);
      if (res?.success && Array.isArray(res.data)) {
        return res.data;
      }
      if (Array.isArray(res)) return res;
    } catch (err) {
      console.warn('[nodeService] /nodes?clusterId thất bại:', err.message);
    }

    // 3. Fallback: Lấy qua cluster detail nếu cả 2 endpoint trên gặp lỗi
    try {
      const res = await request(`/clusters/${encodeURIComponent(clusterId)}`);
      if (res?.success && res.data && Array.isArray(res.data.nodes)) {
        return res.data.nodes;
      }
    } catch (err) {
      console.warn('[nodeService] Fallback cluster detail thất bại:', err.message);
    }

    return [];
  },

  /**
   * Lấy chi tiết một Node cụ thể kèm danh sách Pods chạy trên Node
   * @param {string} nodeId 
   * @returns {Promise<Object|null>}
   */
  async getNodeDetail(nodeId) {
    if (!nodeId) return null;
    try {
      const res = await request(`/nodes/${encodeURIComponent(nodeId)}`);
      if (res?.success && res.data) {
        return res.data;
      }
      return res?.data || null;
    } catch (err) {
      console.warn(`[nodeService] Lỗi lấy chi tiết Node ${nodeId}:`, err.message);
      return null;
    }
  },

  /**
   * Yêu cầu tháo tải (Safe Drain) Node qua hệ thống MAPE-K
   * @param {string} nodeId 
   * @returns {Promise<Object>}
   */
  async drainNode(nodeId) {
    if (!nodeId) throw new Error('nodeId là bắt buộc');
    const res = await request(`/nodes/${encodeURIComponent(nodeId)}/drain`, {
      method: 'POST',
    });
    return res?.data || res;
  },
};

export default nodeService;
