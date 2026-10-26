import { request } from './apiClient';

function resolveActiveOrgId(explicitOrgId) {
  const candidate =
    explicitOrgId ||
    (typeof window !== 'undefined' && window.localStorage
      ? window.localStorage.getItem('selfheal_active_org_id')
      : null);
  if (!candidate || candidate === 'org-acme' || String(candidate).startsWith('sandbox-')) {
    return null;
  }
  return candidate;
}

/**
 * Service quản lý Pods Kubernetes kết nối trực tiếp Backend & CSDL
 */
export const podService = {
  /**
   * Lấy danh sách Pods của một Cụm Kubernetes cụ thể
   * @param {string} clusterId - ID hoặc UID của Cụm K8s
   * @param {Object} [filters]
   * @param {string} [filters.orgId]
   * @param {string} [filters.namespace]
   * @param {string} [filters.phase]
   * @param {string} [filters.status]
   * @param {boolean} [filters.crashLoopOnly]
   * @param {number} [filters.limit]
   * @param {number} [filters.offset]
   * @param {AbortSignal} [filters.signal]
   * @returns {Promise<Array>}
   */
  async getPodsByCluster(clusterId, filters = {}) {
    if (!clusterId || clusterId.startsWith('org-') || clusterId.startsWith('sandbox-')) {
      return [];
    }

    const effectiveOrgId = resolveActiveOrgId(filters.orgId);
    const queryParams = new URLSearchParams();
    if (filters.namespace && filters.namespace !== 'ALL') {
      queryParams.append('namespace', filters.namespace);
    }
    if (filters.phase && filters.phase !== 'ALL') {
      queryParams.append('phase', filters.phase);
    }
    if (filters.status && filters.status !== 'ALL') {
      queryParams.append('status', filters.status);
    }
    if (filters.crashLoopOnly) {
      queryParams.append('crashLoopOnly', 'true');
    }
    if (filters.limit) {
      queryParams.append('limit', String(filters.limit));
    }
    if (filters.offset !== undefined && filters.offset !== null) {
      queryParams.append('offset', String(filters.offset));
    }
    const queryString = queryParams.toString() ? `?${queryParams.toString()}` : '';

    // 1. Thử qua router phân quyền tổ chức
    if (effectiveOrgId) {
      try {
        const res = await request(
          `/organizations/${encodeURIComponent(effectiveOrgId)}/clusters/${encodeURIComponent(clusterId)}/pods${queryString}`,
          { signal: filters.signal }
        );
        if (res?.success && Array.isArray(res.data)) {
          return res.data;
        }
        if (Array.isArray(res)) return res;
      } catch (err) {
        if (err.name === 'AbortError') throw err;
        console.warn('[podService] Org route pods thất bại:', err.message);
      }
    }

    try {
      // 2. Thử qua router chuyên trách cụm /clusters/:clusterId/pods
      const res = await request(
        `/clusters/${encodeURIComponent(clusterId)}/pods${queryString}`,
        { signal: filters.signal }
      );
      if (res?.success && Array.isArray(res.data)) {
        return res.data;
      }
      if (Array.isArray(res)) return res;
    } catch (err) {
      if (err.name === 'AbortError') throw err;
      console.warn('[podService] /clusters/:id/pods thất bại, thử /pods?clusterId:', err.message);
    }

    try {
      // 3. Thử qua router /pods?clusterId=...
      const query = `?clusterId=${encodeURIComponent(clusterId)}${queryString ? `&${queryString.replace('?', '')}` : ''}`;
      const res = await request(`/pods${query}`, { signal: filters.signal });
      if (res?.success && Array.isArray(res.data)) {
        return res.data;
      }
      if (Array.isArray(res)) return res;
    } catch (err) {
      if (err.name === 'AbortError') throw err;
      console.warn('[podService] /pods?clusterId thất bại:', err.message);
    }

    // 4. Fallback: Lấy qua cluster detail nếu các endpoint trên gặp lỗi
    try {
      const res = await request(`/clusters/${encodeURIComponent(clusterId)}`, { signal: filters.signal });
      if (res?.success && res.data && Array.isArray(res.data.pods)) {
        return res.data.pods;
      }
    } catch (err) {
      if (err.name === 'AbortError') throw err;
      console.warn('[podService] Fallback cluster detail pods thất bại:', err.message);
    }

    return [];
  },

  /**
   * Lấy chi tiết một Pod cụ thể
   * @param {string} podId 
   * @param {Object} [context] - { orgId, clusterId, signal }
   * @returns {Promise<Object|null>}
   */
  async getPodDetail(podId, context = {}) {
    if (!podId) return null;
    const effectiveOrgId = resolveActiveOrgId(context.orgId);
    const clusterId = context.clusterId;

    if (effectiveOrgId && clusterId) {
      try {
        const res = await request(
          `/organizations/${encodeURIComponent(effectiveOrgId)}/clusters/${encodeURIComponent(clusterId)}/pods/${encodeURIComponent(podId)}/status`,
          { signal: context.signal }
        );
        if (res?.success && res.data) {
          return res.data;
        }
      } catch (err) {
        if (err.name === 'AbortError') throw err;
        try {
          const res = await request(
            `/organizations/${encodeURIComponent(effectiveOrgId)}/clusters/${encodeURIComponent(clusterId)}/pods/${encodeURIComponent(podId)}`,
            { signal: context.signal }
          );
          if (res?.success && res.data) return res.data;
        } catch (innerErr) {
          if (innerErr.name === 'AbortError') throw innerErr;
        }
      }
    }

    try {
      const res = await request(`/pods/${encodeURIComponent(podId)}/status`, { signal: context.signal });
      if (res?.success && res.data) {
        return res.data;
      }
      return res?.data || null;
    } catch (err) {
      if (err.name === 'AbortError') throw err;
      try {
        const res = await request(`/pods/${encodeURIComponent(podId)}`, { signal: context.signal });
        if (res?.success && res.data) return res.data;
      } catch (innerErr) {
        if (innerErr.name === 'AbortError') throw innerErr;
      }
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
