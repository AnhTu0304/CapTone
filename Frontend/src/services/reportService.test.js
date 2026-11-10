import {
  fetchOrganizationSLAReport,
  fetchActionAnalyticsReport,
} from './reportService';
import { request } from './apiClient';

jest.mock('./apiClient', () => ({
  request: jest.fn(),
}));

describe('reportService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('fetchOrganizationSLAReport forwards organization, cluster, environment, serviceName and timeRange params', async () => {
    const payload = { summary: { actualUptime: '99.98%' }, availableServices: ['sme-order-service'] };
    request.mockResolvedValueOnce({ data: payload });

    const res = await fetchOrganizationSLAReport({
      organizationId: 'org-1',
      environmentId: 'env-1',
      clusterId: 'cluster-fyuyu',
      serviceName: 'sme-order-service',
      timeRange: '7D',
    });

    expect(res).toEqual(payload);
    expect(request).toHaveBeenCalledWith(
      '/reports/organization-sla?organizationId=org-1&environmentId=env-1&clusterId=cluster-fyuyu&serviceName=sme-order-service&timeRange=7D',
      { method: 'GET' }
    );
  });

  test('fetchOrganizationSLAReport omits serviceName when ALL or blank and rethrows 403', async () => {
    request.mockResolvedValueOnce({ data: { services: [] } });

    await fetchOrganizationSLAReport({
      organizationId: 'org-1',
      serviceName: 'ALL',
      timeRange: '1M',
    });

    expect(request).toHaveBeenCalledWith(
      '/reports/organization-sla?organizationId=org-1&timeRange=1M',
      { method: 'GET' }
    );

    const err403 = new Error('Forbidden');
    err403.status = 403;
    request.mockRejectedValueOnce(err403);
    await expect(fetchOrganizationSLAReport({ organizationId: 'org-1' })).rejects.toThrow('Forbidden');

    request.mockRejectedValueOnce(new Error('Network error'));
    const fallback = await fetchOrganizationSLAReport({ organizationId: 'org-1' });
    expect(fallback).toBeNull();
  });

  test('fetchActionAnalyticsReport forwards cluster, serviceName and table filters cleanly', async () => {
    const analytics = { summary: { totalActions: 10 }, actionHistory: [] };
    request.mockResolvedValueOnce({ data: analytics });

    const res = await fetchActionAnalyticsReport({
      organizationId: 'org-1',
      environmentId: 'env-1',
      clusterId: 'cluster-ai',
      serviceName: 'ecommerce-store-app',
      timeRange: '1M',
      actor: 'AI',
      status: 'FAILED',
      incidentType: 'ALL',
      actionCode: 'SCALE_REPLICAS',
      search: ' 404 ',
      page: 2,
      limit: 50,
    });

    expect(res).toEqual(analytics);
    expect(request).toHaveBeenCalledWith(
      '/reports/action-analytics?organizationId=org-1&environmentId=env-1&clusterId=cluster-ai&serviceName=ecommerce-store-app&timeRange=1M&actor=AI&status=FAILED&actionCode=SCALE_REPLICAS&search=404&page=2&limit=50',
      { method: 'GET' }
    );
  });
});
