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
 * Service quản lý Deployments và Replicas Kubernetes
 * Kết nối các endpoint chuẩn Task 5.2 Backend:
 * - /organizations/:orgId/clusters/:clusterId/deployments
 * - /organizations/:orgId/clusters/:clusterId/deployments/:deploymentId
 * - /organizations/:orgId/clusters/:clusterId/deployments/:deploymentId/replicas
 */
export const deploymentService = {
  /**
   * Lấy danh sách trạng thái Deployments của một Cụm Kubernetes
   * @param {string} clusterId - ID của cụm K8s
   * @param {Object} [options]
   * @param {string} [options.orgId] - ID tổ chức
   * @param {string} [options.namespace] - Lọc theo namespace
   * @param {string} [options.status] - Lọc theo trạng thái rollout
   * @param {number} [options.limit]
   * @param {number} [options.offset]
   * @param {AbortSignal} [options.signal]
   * @returns {Promise<Array>}
   */
  async getDeploymentsByCluster(clusterId, options = {}) {
    if (!clusterId || clusterId.startsWith('org-') || clusterId.startsWith('sandbox-')) {
      return [];
    }

    const effectiveOrgId = resolveActiveOrgId(options.orgId);
    const queryParams = new URLSearchParams();
    if (options.namespace && options.namespace !== 'ALL') {
      queryParams.append('namespace', options.namespace);
    }
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

    // 1. Tuyến đường tổ chức (/organizations/:orgId/clusters/:clusterId/deployments)
    if (effectiveOrgId) {
      try {
        const res = await request(
          `/organizations/${encodeURIComponent(effectiveOrgId)}/clusters/${encodeURIComponent(clusterId)}/deployments${queryString}`,
          { signal: options.signal }
        );
        if (res?.success && Array.isArray(res.data)) {
          return res.data;
        }
        if (Array.isArray(res)) return res;
      } catch (err) {
        if (err.name === 'AbortError') throw err;
        console.warn('[deploymentService] Org route deployments thất bại:', err.message);
      }
    }

    // 2. Tuyến đường toàn cục (/clusters/:clusterId/deployments)
    try {
      const res = await request(
        `/clusters/${encodeURIComponent(clusterId)}/deployments${queryString}`,
        { signal: options.signal }
      );
      if (res?.success && Array.isArray(res.data)) {
        return res.data;
      }
      if (Array.isArray(res)) return res;
    } catch (err) {
      if (err.name === 'AbortError') throw err;
      console.warn('[deploymentService] Global route deployments thất bại:', err.message);
    }

    return [];
  },

  /**
   * Lấy chi tiết một Deployment
   * @param {string} deploymentId
   * @param {Object} [context] - { orgId, clusterId, signal }
   * @returns {Promise<Object|null>}
   */
  async getDeploymentDetail(deploymentId, context = {}) {
    if (!deploymentId) return null;
    const effectiveOrgId = resolveActiveOrgId(context.orgId);
    const clusterId = context.clusterId;

    if (effectiveOrgId && clusterId) {
      try {
        const res = await request(
          `/organizations/${encodeURIComponent(effectiveOrgId)}/clusters/${encodeURIComponent(clusterId)}/deployments/${encodeURIComponent(deploymentId)}`,
          { signal: context.signal }
        );
        if (res?.success && res.data) {
          return res.data;
        }
      } catch (err) {
        if (err.name === 'AbortError') throw err;
      }
    }

    try {
      const res = await request(`/deployments/${encodeURIComponent(deploymentId)}`, {
        signal: context.signal,
      });
      if (res?.success && res.data) {
        return res.data;
      }
      return res?.data || null;
    } catch (err) {
      if (err.name === 'AbortError') throw err;
      console.warn(`[deploymentService] Lỗi lấy chi tiết Deployment ${deploymentId}:`, err.message);
      return null;
    }
  },

  /**
   * Lấy trạng thái Replicas chuyên biệt của một Deployment
   * @param {string} deploymentId
   * @param {Object} [context] - { orgId, clusterId, signal }
   * @returns {Promise<Object|null>}
   */
  async getReplicaStatus(deploymentId, context = {}) {
    if (!deploymentId) return null;
    const effectiveOrgId = resolveActiveOrgId(context.orgId);
    const clusterId = context.clusterId;

    if (effectiveOrgId && clusterId) {
      try {
        const res = await request(
          `/organizations/${encodeURIComponent(effectiveOrgId)}/clusters/${encodeURIComponent(clusterId)}/deployments/${encodeURIComponent(deploymentId)}/replicas`,
          { signal: context.signal }
        );
        if (res?.success && res.data) {
          return res.data;
        }
      } catch (err) {
        if (err.name === 'AbortError') throw err;
      }
    }

    try {
      const res = await request(
        `/deployments/${encodeURIComponent(deploymentId)}/replicas`,
        { signal: context.signal }
      );
      if (res?.success && res.data) {
        return res.data;
      }
      return null;
    } catch (err) {
      if (err.name === 'AbortError') throw err;
      console.warn(`[deploymentService] Lỗi lấy Replica status ${deploymentId}:`, err.message);
      return null;
    }
  },
};

export default deploymentService;
