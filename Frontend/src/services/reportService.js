/**
 * Report Service Layer
 * Giao tiếp với Main Backend endpoints:
 * - GET /reports/organization-sla
 * - GET /reports/action-analytics
 */

import { request } from './apiClient';

export const fetchOrganizationSLAReport = async ({
  organizationId,
  environmentId,
  clusterId,
  serviceName = null,
  timeRange = '1M',
} = {}) => {
  try {
    const params = new URLSearchParams();
    if (organizationId) params.append('organizationId', organizationId);
    if (environmentId) params.append('environmentId', environmentId);
    if (clusterId) params.append('clusterId', clusterId);
    if (serviceName && serviceName !== 'ALL' && String(serviceName).trim()) {
      params.append('serviceName', String(serviceName).trim());
    }
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

export const fetchActionAnalyticsReport = async ({
  organizationId,
  environmentId,
  clusterId,
  serviceName = null,
  timeRange = '1M',
  actor = null,
  status = null,
  incidentType = null,
  actionCode = null,
  search = null,
  page = 1,
  limit = 25,
} = {}) => {
  try {
    const params = new URLSearchParams();
    if (organizationId) params.append('organizationId', organizationId);
    if (environmentId) params.append('environmentId', environmentId);
    if (clusterId) params.append('clusterId', clusterId);
    if (serviceName && serviceName !== 'ALL' && String(serviceName).trim()) {
      params.append('serviceName', String(serviceName).trim());
    }
    if (timeRange) params.append('timeRange', timeRange);
    if (actor && actor !== 'ALL') params.append('actor', actor);
    if (status && status !== 'ALL') params.append('status', status);
    if (incidentType && incidentType !== 'ALL') params.append('incidentType', incidentType);
    if (actionCode && actionCode !== 'ALL') params.append('actionCode', actionCode);
    if (search && search.trim()) params.append('search', search.trim());
    if (page) params.append('page', String(page));
    if (limit) params.append('limit', String(limit));

    const queryString = params.toString() ? `?${params.toString()}` : '';
    const res = await request(`/reports/action-analytics${queryString}`, {
      method: 'GET',
    });

    return res?.data || null;
  } catch (error) {
    console.warn('[ReportService] Lỗi khi gọi API /reports/action-analytics:', error?.message || error);
    if (error?.status === 403 || error?.status === 401) {
      throw error;
    }
    return null;
  }
};
