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
 * Service quản lý Node máy chủ Kubernetes kết nối trực tiếp Backend & CSDL
 * Ưu tiên tuyến đường theo phạm vi Tổ chức (/organizations/:orgId/clusters/:clusterId/nodes)
 * để hỗ trợ đầy đủ các vai trò SME_OWNER, DEVOPS, VIEWER, kèm fallback cho SUPER_ADMIN.
 */
export const nodeService = {
  /**
   * Lấy danh sách Nodes của một Cụm Kubernetes cụ thể
   * @param {string} clusterId - ID hoặc UID của Cụm K8s
   * @param {string|Object} [orgIdOrOptions] - ID Tổ chức hoặc Options { orgId, status, limit, offset, signal }
   * @returns {Promise<Array>}
   */
  async getNodesByCluster(clusterId, orgIdOrOptions) {
    if (!clusterId || clusterId.startsWith('org-') || clusterId.startsWith('sandbox-')) {
      return [];
    }

    const options = typeof orgIdOrOptions === 'object' && orgIdOrOptions !== null
      ? orgIdOrOptions
      : { orgId: orgIdOrOptions };

    const effectiveOrgId = resolveActiveOrgId(options.orgId);
    const queryParams = new URLSearchParams();
    if (options.status && options.status !== 'ALL') {
      queryParams.append('status', options.status);
    }
    if (options.limit) {
      queryParams.append('limit', String(options.limit));
    }
    if (options.offset !== undefined && options.offset !== null) {
      queryParams.append('offset', String(options.offset));
    }
    const queryString = queryParams.toString() ? `?${queryParams.toString()}` : '';

    // 1. Ưu tiên gọi qua route phân quyền theo Tổ chức (/organizations/:orgId/clusters/:clusterId/nodes)
    if (effectiveOrgId) {
      try {
        const res = await request(
          `/organizations/${encodeURIComponent(effectiveOrgId)}/clusters/${encodeURIComponent(clusterId)}/nodes${queryString}`,
          { signal: options.signal }
        );
        if (res?.success && Array.isArray(res.data)) {
          return res.data;
        }
        if (Array.isArray(res)) return res;
      } catch (err) {
        if (err.name === 'AbortError') throw err;
        console.warn('[nodeService] /organizations/:orgId/clusters/:id/nodes thất bại:', err.message);
      }

      try {
        const res = await request(
          `/organizations/${encodeURIComponent(effectiveOrgId)}/clusters/${encodeURIComponent(clusterId)}`,
          { signal: options.signal }
        );
        if (res?.success && res.data && Array.isArray(res.data.nodes)) {
          return res.data.nodes;
        }
      } catch (err) {
        if (err.name === 'AbortError') throw err;
        console.warn('[nodeService] /organizations/:orgId/clusters/:id detail thất bại:', err.message);
      }
    }

    try {
      // 2. Thử qua router chuyên trách cụm /clusters/:clusterId/nodes (cho Platform Admin)
      const res = await request(
        `/clusters/${encodeURIComponent(clusterId)}/nodes${queryString}`,
        { signal: options.signal }
      );
      if (res?.success && Array.isArray(res.data)) {
        return res.data;
      }
      if (Array.isArray(res)) return res;
    } catch (err) {
      if (err.name === 'AbortError') throw err;
      console.warn('[nodeService] /clusters/:id/nodes thất bại, thử /nodes?clusterId:', err.message);
    }

    try {
      // 3. Thử qua router /nodes?clusterId=...
      const query = `?clusterId=${encodeURIComponent(clusterId)}${queryString ? `&${queryString.replace('?', '')}` : ''}`;
      const res = await request(`/nodes${query}`, { signal: options.signal });
      if (res?.success && Array.isArray(res.data)) {
        return res.data;
      }
      if (Array.isArray(res)) return res;
    } catch (err) {
      if (err.name === 'AbortError') throw err;
      console.warn('[nodeService] /nodes?clusterId thất bại:', err.message);
    }

    // 4. Fallback: Lấy qua cluster detail nếu các endpoint trên gặp lỗi
    try {
      const res = await request(`/clusters/${encodeURIComponent(clusterId)}`, { signal: options.signal });
      if (res?.success && res.data && Array.isArray(res.data.nodes)) {
        return res.data.nodes;
      }
    } catch (err) {
      if (err.name === 'AbortError') throw err;
      console.warn('[nodeService] Fallback cluster detail thất bại:', err.message);
    }

    return [];
  },

  /**
   * Lấy chi tiết một Node cụ thể kèm danh sách Pods chạy trên Node
   * @param {string} nodeId
   * @param {Object} [context] - { orgId, clusterId, signal }
   * @returns {Promise<Object|null>}
   */
  async getNodeDetail(nodeId, context = {}) {
    if (!nodeId) return null;
    const effectiveOrgId = resolveActiveOrgId(context.orgId);
    const clusterId =
      context.clusterId ||
      (typeof window !== 'undefined' && window.localStorage
        ? window.localStorage.getItem('selfheal_active_cluster_id')
        : null);

    if (effectiveOrgId && clusterId) {
      try {
        const res = await request(
          `/organizations/${encodeURIComponent(effectiveOrgId)}/clusters/${encodeURIComponent(clusterId)}/nodes/${encodeURIComponent(nodeId)}/status`,
          { signal: context.signal }
        );
        if (res?.success && res.data) {
          return res.data;
        }
      } catch (err) {
        if (err.name === 'AbortError') throw err;
        // Fallback to non-status detail
        try {
          const res = await request(
            `/organizations/${encodeURIComponent(effectiveOrgId)}/clusters/${encodeURIComponent(clusterId)}/nodes/${encodeURIComponent(nodeId)}`,
            { signal: context.signal }
          );
          if (res?.success && res.data) return res.data;
        } catch (innerErr) {
          if (innerErr.name === 'AbortError') throw innerErr;
        }
      }
    }

    try {
      const res = await request(`/nodes/${encodeURIComponent(nodeId)}/status`, { signal: context.signal });
      if (res?.success && res.data) {
        return res.data;
      }
      return res?.data || null;
    } catch (err) {
      if (err.name === 'AbortError') throw err;
      try {
        const res = await request(`/nodes/${encodeURIComponent(nodeId)}`, { signal: context.signal });
        if (res?.success && res.data) return res.data;
      } catch (innerErr) {
        if (innerErr.name === 'AbortError') throw innerErr;
      }
      console.warn(`[nodeService] Lỗi lấy chi tiết Node ${nodeId}:`, err.message);
      return null;
    }
  },

  /**
   * Yêu cầu tháo tải (Safe Drain) Node qua hệ thống MAPE-K
   * @param {string} nodeId
   * @param {Object} [context] - { orgId, clusterId }
   * @returns {Promise<Object>}
   */
  async drainNode(nodeId, context = {}) {
    if (!nodeId) throw new Error('nodeId là bắt buộc');
    const effectiveOrgId = resolveActiveOrgId(context.orgId);
    const clusterId =
      context.clusterId ||
      (typeof window !== 'undefined' && window.localStorage
        ? window.localStorage.getItem('selfheal_active_cluster_id')
        : null);

    if (effectiveOrgId && clusterId) {
      try {
        const res = await request(
          `/organizations/${encodeURIComponent(effectiveOrgId)}/clusters/${encodeURIComponent(clusterId)}/nodes/${encodeURIComponent(nodeId)}/drain`,
          { method: 'POST' }
        );
        return res?.data || res;
      } catch (err) {
        // Fallback to global route
      }
    }

    const res = await request(`/nodes/${encodeURIComponent(nodeId)}/drain`, {
      method: 'POST',
    });
    return res?.data || res;
  },
};

export default nodeService;
