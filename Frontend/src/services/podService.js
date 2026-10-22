import { request } from './apiClient';

/**
 * Service quản lý Pods Kubernetes kết nối trực tiếp Backend & CSDL
 * Tuyến đường độc lập theo Cụm K8s, KHÔNG gộp trong tổ chức
 */
export const podService = {
  /**
   * Lấy danh sách Pods của một Cụm Kubernetes cụ thể
   * @param {string} clusterId - ID hoặc UID của Cụm K8s
   * @param {Object} [filters]
   * @param {string} [filters.namespace]
   * @returns {Promise<Array>}
   */
  async getPodsByCluster(clusterId, filters = {}) {
    if (!clusterId || clusterId.startsWith('org-') || clusterId.startsWith('sandbox-')) {
      return [];
    }

    const queryParams = new URLSearchParams();
    if (filters.namespace && filters.namespace !== 'ALL') {
      queryParams.append('namespace', filters.namespace);
    }
    const queryString = queryParams.toString() ? `?${queryParams.toString()}` : '';

    try {
      // 1. Thử qua router chuyên trách cụm /clusters/:clusterId/pods
      const res = await request(`/clusters/${encodeURIComponent(clusterId)}/pods${queryString}`);
      if (res?.success && Array.isArray(res.data)) {
        return res.data;
      }
      if (Array.isArray(res)) return res;
    } catch (err) {
      console.warn('[podService] /clusters/:id/pods thất bại, thử /pods?clusterId:', err.message);
    }

    try {
      // 2. Thử qua router /pods?clusterId=...
      const query = `?clusterId=${encodeURIComponent(clusterId)}${filters.namespace ? `&namespace=${encodeURIComponent(filters.namespace)}` : ''}`;
      const res = await request(`/pods${query}`);
      if (res?.success && Array.isArray(res.data)) {
        return res.data;
      }
      if (Array.isArray(res)) return res;
    } catch (err) {
      console.warn('[podService] /pods?clusterId thất bại:', err.message);
    }

    // 3. Fallback: Lấy qua cluster detail nếu cả 2 endpoint trên gặp lỗi
    try {
      const res = await request(`/clusters/${encodeURIComponent(clusterId)}`);
      if (res?.success && res.data && Array.isArray(res.data.pods)) {
        return res.data.pods;
      }
    } catch (err) {
      console.warn('[podService] Fallback cluster detail pods thất bại:', err.message);
    }

    return [];
  },

  /**
   * Lấy chi tiết một Pod cụ thể
   * @param {string} podId 
   * @returns {Promise<Object|null>}
   */
  async getPodDetail(podId) {
    if (!podId) return null;
    try {
      const res = await request(`/pods/${encodeURIComponent(podId)}`);
      if (res?.success && res.data) {
        return res.data;
      }
      return res?.data || null;
    } catch (err) {
      console.warn(`[podService] Lỗi lấy chi tiết Pod ${podId}:`, err.message);
      return null;
    }
  },

  /**
   * Khởi động lại một Pod qua hệ thống tự chữa lành MAPE-K
   * @param {string} podId 
   * @returns {Promise<Object>}
   */
  async restartPod(podId) {
    if (!podId) throw new Error('podId là bắt buộc');
    const res = await request(`/pods/${encodeURIComponent(podId)}/restart`, {
      method: 'POST',
    });
    return res?.data || res;
  },
};

export default podService;
