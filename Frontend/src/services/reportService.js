/**
 * Report Service Layer
 * Giao tiếp với Main Backend endpoint /reports/organization-sla
 * để lấy số liệu thực tế về SLA, Sự cố, Tự phục hồi và Biến động hệ thống.
 */

import { request } from './apiClient';

export const fetchOrganizationSLAReport = async ({ organizationId, environmentId, clusterId, timeRange = '6M' } = {}) => {
  try {
    const params = new URLSearchParams();
    if (organizationId) params.append('organizationId', organizationId);
    if (environmentId) params.append('environmentId', environmentId);
    if (clusterId) params.append('clusterId', clusterId);
    if (timeRange) params.append('timeRange', timeRange);

    const queryString = params.toString() ? `?${params.toString()}` : '';
    const res = await request(`/reports/organization-sla${queryString}`, {
      method: 'GET',
    });

    return res?.data || null;
  } catch (error) {
    console.warn('[ReportService] Lỗi khi gọi API /reports/organization-sla:', error?.message || error);
    if (error?.status === 403 || error?.status === 401) {
      throw error;
    }
    return null;
  }
};
