/**
 * @file environmentService.js
 * @description Enterprise Service Layer for Organizational Environments (DEV / STAGING) & K8s Cluster Allocation.
 * Kết nối các REST API backend thực tế:
 * - GET /api/v1/organizations/:orgId/environments : Danh sách môi trường, tìm kiếm, lọc loại, phân trang
 * - GET /api/v1/organizations/:orgId/environments/summary : Thống kê tổng quan môi trường
 * - POST /api/v1/organizations/:orgId/environments : Tạo môi trường mới (SME_OWNER, DEVOPS)
 * - GET /api/v1/organizations/:orgId/environments/:id : Chi tiết môi trường
 * - PUT /api/v1/organizations/:orgId/environments/:id : Cập nhật môi trường (SME_OWNER, DEVOPS)
 * - DELETE /api/v1/organizations/:orgId/environments/:id : Xóa mềm môi trường (chỉ SME_OWNER)
 */

import apiClient from './apiClient';

export const environmentService = {
  /**
   * Lấy danh sách môi trường thuộc tổ chức
   * @param {string} orgId 
   * @param {Object} [params] - { page, limit, search, type, status }
   */
  async getEnvironments(orgId, params = {}) {
    if (!orgId) return { items: [], total: 0 };
    const query = new URLSearchParams();
    if (params.page) query.append('page', String(params.page));
    if (params.limit) query.append('limit', String(params.limit));
    if (params.search) query.append('search', params.search.trim());
    if (params.type && params.type !== 'ALL') query.append('type', params.type.trim().toUpperCase());
    if (params.status && params.status !== 'ALL') query.append('status', params.status.trim().toUpperCase());

    const qs = query.toString();
    const endpoint = `/organizations/${encodeURIComponent(orgId)}/environments${qs ? `?${qs}` : ''}`;
    const res = await apiClient.request(endpoint);
    return res?.data || { items: [], total: 0 };
  },

  /**
   * Thống kê tổng quan môi trường (phân bổ số lượng cụm K8s cho DEV và STAGING)
   * @param {string} orgId 
   */
  async getSummary(orgId) {
    if (!orgId) return null;
    const endpoint = `/organizations/${encodeURIComponent(orgId)}/environments/summary`;
    const res = await apiClient.request(endpoint);
    return res?.data || null;
  },

  /**
   * Tạo môi trường mới
   * @param {string} orgId 
   * @param {{ name: string, type: 'DEVELOPMENT' | 'STAGING', description?: string, k8s_cluster_id?: string, cluster_name?: string }} data 
   */
  async createEnvironment(orgId, data) {
    const endpoint = `/organizations/${encodeURIComponent(orgId)}/environments`;
    const res = await apiClient.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return res?.data;
  },

  /**
   * Lấy chi tiết một môi trường
   * @param {string} orgId 
   * @param {string} envId 
   */
  async getById(orgId, envId) {
    const endpoint = `/organizations/${encodeURIComponent(orgId)}/environments/${encodeURIComponent(envId)}`;
    const res = await apiClient.request(endpoint);
    return res?.data;
  },

  /**
   * Cập nhật thông tin môi trường
   * @param {string} orgId 
   * @param {string} envId 
   * @param {{ name?: string, description?: string, status?: string, type?: string }} data 
   */
  async updateEnvironment(orgId, envId, data) {
    const endpoint = `/organizations/${encodeURIComponent(orgId)}/environments/${encodeURIComponent(envId)}`;
    const res = await apiClient.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return res?.data;
  },

  /**
   * Xóa mềm môi trường (chỉ SME_OWNER)
   * @param {string} orgId 
   * @param {string} envId 
   */
  async deleteEnvironment(orgId, envId) {
    const endpoint = `/organizations/${encodeURIComponent(orgId)}/environments/${encodeURIComponent(envId)}`;
    const res = await apiClient.request(endpoint, {
      method: 'DELETE',
    });
    return res?.data;
  },
};

export default environmentService;
