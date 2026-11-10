import {
  mapBackendLog,
  fetchOrgAuditLogs,
  fetchOrgAuditStats,
} from './dashboardAuditLogsService';
import { request } from './apiClient';

jest.mock('./apiClient', () => ({
  request: jest.fn(),
}));

describe('dashboardAuditLogsService (Real Data Contract)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns empty result set when orgId is missing without hardcoded fallback logs', async () => {
    const res = await fetchOrgAuditLogs(null, {}, { page: 1, pageSize: 10 });
    expect(res).toEqual({
      data: [],
      total: 0,
      page: 1,
      pageSize: 10,
      totalPages: 1,
    });
    expect(request).not.toHaveBeenCalled();

    const stats = await fetchOrgAuditStats(null);
    expect(stats).toBeNull();
  });

  test('propagates backend errors instead of masking with static fallback data', async () => {
    request.mockRejectedValueOnce(new Error('500 Internal Server Error'));
    await expect(fetchOrgAuditLogs('org-1', { timeFilterMode: 'today' })).rejects.toThrow(
      '500 Internal Server Error'
    );

    request.mockRejectedValueOnce(new Error('403 Forbidden'));
    await expect(fetchOrgAuditStats('org-1')).rejects.toThrow('403 Forbidden');
  });

  test('mapBackendLog preserves real AGENT, SYSTEM, USER identities, status SUCCESS/FAILED, and null IP', () => {
    const agentRow = mapBackendLog({
      id: 8177,
      actor_type: 'AGENT',
      user_name: 'fyuyu-ebpf-agent',
      actor_role: 'AGENT',
      action: 'REMEDIATION_COMPLETED',
      resource_type: 'HEALING_ACTION',
      status: 'SUCCESS',
      ip_address: null,
      created_at: '2026-11-10T07:31:01.000Z',
      metadata: {
        agent_name: 'fyuyu-ebpf-agent',
        target_name: 'selfheal-test-app',
        sha256: '6ab4855404a6',
      },
    });

    expect(agentRow.actor).toBe('fyuyu-ebpf-agent');
    expect(agentRow.role).toBe('AGENT');
    expect(agentRow.status).toBe('SUCCESS');
    expect(agentRow.ip).toBeNull();
    expect(agentRow.target).toBe('selfheal-test-app');

    const circuitBreakerRow = mapBackendLog({
      id: 7900,
      actor_type: 'SYSTEM',
      user_name: 'Hệ thống AI (MAPE-K)',
      actor_role: 'SYSTEM_AI',
      action: 'CIRCUIT_BREAKER_TRIPPED',
      resource_type: 'HEALING_ACTION',
      status: 'SUCCESS',
      ip_address: null,
      created_at: '2026-11-10T07:00:00.000Z',
      metadata: {
        service_id: 'ecommerce-store-app',
      },
    });
    expect(circuitBreakerRow.actor).toBe('Hệ thống AI (MAPE-K)');
    expect(circuitBreakerRow.role).toBe('SYSTEM_AI');
    expect(circuitBreakerRow.target).toBe('ecommerce-store-app');
    expect(circuitBreakerRow.sha256).toBeNull();

    // Never guess SME_OWNER/DEVOPS from hardcoded names like 'sang' or 'tuan'
    const viewerSangRow = mapBackendLog({
      id: 100,
      actor_type: 'USER',
      user_name: 'Sang Phạm',
      actor_role: 'VIEWER',
      action: 'AUTH_LOGIN_FAILURE',
      status: 'FAILURE',
      ip_address: '172.25.0.1/32',
      created_at: '2026-11-10T08:00:00.000Z',
      metadata: {},
    });
    expect(viewerSangRow.actor).toBe('Sang Phạm');
    expect(viewerSangRow.role).toBe('VIEWER');
    expect(viewerSangRow.status).toBe('FAILED');
    expect(viewerSangRow.ip).toBe('172.25.0.1');

    // Resolves real joined entity names (agent_name, cluster_name, healing_target_name, target_user_name)
    // and exposes exact request telemetry & resource identifiers instead of truncated UUIDs
    const connectedAgentRow = mapBackendLog({
      id: 8325,
      actor_type: 'AGENT',
      actor_role: 'AGENT',
      user_name: 'fyuyu-ebpf-agent',
      agent_name: 'fyuyu-ebpf-agent',
      cluster_name: 'fyuyu',
      organization_name: 'SME Retail Enterprise',
      action: 'AGENT_CONNECTED',
      reason_code: 'HEARTBEAT_RECOVERED',
      resource_type: 'AGENT',
      resource_id: '1aadd3cd-9c56-4812-8b91-77e01f234567',
      target_type: 'AGENT',
      target_id: '1aadd3cd-9c56-4812-8b91-77e01f234567',
      ip_address: '10.244.0.18/32',
      user_agent: 'selfheal-agent/v2.4.1',
      request_id: 'req-hb-8325',
      status: 'SUCCESS',
      created_at: '2026-11-10T11:53:04.000Z',
      before_data: { status: 'OFFLINE' },
      after_data: { status: 'ONLINE', last_seen_at: '2026-11-10T11:53:04.000Z' },
      metadata: {},
    });

    expect(connectedAgentRow.actor).toBe('fyuyu-ebpf-agent');
    expect(connectedAgentRow.target).toBe('fyuyu-ebpf-agent');
    expect(connectedAgentRow.resourceType).toBe('AGENT');
    expect(connectedAgentRow.resourceId).toBe('1aadd3cd-9c56-4812-8b91-77e01f234567');
    expect(connectedAgentRow.organizationName).toBe('SME Retail Enterprise');
    expect(connectedAgentRow.ip).toBe('10.244.0.18');
    expect(connectedAgentRow.metadata.cluster_name).toBe('fyuyu');
    expect(connectedAgentRow.metadata.reasonCode).toBe('HEARTBEAT_RECOVERED');
    expect(connectedAgentRow.metadata.userAgent).toBe('selfheal-agent/v2.4.1');
    expect(connectedAgentRow.metadata.requestId).toBe('req-hb-8325');
    expect(connectedAgentRow.after_data.last_seen_at).toBe('2026-11-10T11:53:04.000Z');

    const joinedMemberRow = mapBackendLog({
      id: 8401,
      actor_type: 'USER',
      user_name: 'Phạm Thái Sang',
      user_email: 'sang@sme.vn',
      actor_role: 'SME_OWNER',
      action: 'MEMBER_ROLE_CHANGED',
      resource_type: 'USER',
      resource_id: '22222222-3333-4444-5555-666666666666',
      target_type: 'USER',
      target_id: '22222222-3333-4444-5555-666666666666',
      target_user_name: 'Nguyễn Văn DevOps',
      target_user_email: 'devops@sme.vn',
      status: 'SUCCESS',
      created_at: '2026-11-10T12:00:00.000Z',
      metadata: {},
    });

    expect(joinedMemberRow.actorEmail).toBe('sang@sme.vn');
    expect(joinedMemberRow.target).toBe('Nguyễn Văn DevOps');
    expect(joinedMemberRow.targetUserEmail).toBe('devops@sme.vn');
  });

  test('passes ISO date window parameters to API for today/date/month/year filters', async () => {
    request.mockResolvedValue({
      success: true,
      data: {
        data: [],
        pagination: { total: 0, page: 1, limit: 5000, totalPages: 1 },
      },
    });

    await fetchOrgAuditLogs(
      'org-real-1',
      { timeFilterMode: 'date', selectedDate: '2026-11-01' },
      { page: 1, pageSize: 5000 }
    );

    expect(request).toHaveBeenCalledTimes(1);
    const url = request.mock.calls[0][0];
    expect(url).toContain('organizations/org-real-1/audit-logs?');
    expect(url).toContain('limit=5000');
    expect(url).toContain('start_date=');
    expect(url).toContain('end_date=');
  });

  test('maps clusterId, clusterName, serviceName and passes cluster_id / service_name filters when set', async () => {
    const mapped = mapBackendLog({
      id: 9001,
      actor_type: 'SYSTEM',
      user_name: 'Hệ thống AI (MAPE-K)',
      actor_role: 'SYSTEM_AI',
      action: 'AUTONOMOUS_HEALING_TRIGGERED',
      resource_type: 'HEALING_ACTION',
      cluster_id: 'cluster-fyuyu-1',
      cluster_name: 'fyuyu',
      service_name: 'sme-order-service',
      healing_target_name: 'sme-order-service',
      status: 'SUCCESS',
      created_at: '2026-11-10T10:00:00.000Z',
      metadata: { target_service: 'sme-order-service' },
    });

    expect(mapped.clusterId).toBe('cluster-fyuyu-1');
    expect(mapped.clusterName).toBe('fyuyu');
    expect(mapped.serviceName).toBe('sme-order-service');
    expect(mapped.target).toBe('sme-order-service');

    request.mockResolvedValue({
      success: true,
      data: {
        data: [],
        pagination: { total: 0, page: 1, limit: 5000, totalPages: 1 },
      },
    });

    await fetchOrgAuditLogs(
      'org-real-1',
      {
        timeFilterMode: 'today',
        cluster_id: 'cluster-fyuyu-1',
        service_name: 'sme-order-service',
      },
      { page: 1, pageSize: 5000 }
    );

    const filteredUrl = request.mock.calls[0][0];
    expect(filteredUrl).toContain('cluster_id=cluster-fyuyu-1');
    expect(filteredUrl).toContain('service_name=sme-order-service');

    await fetchOrgAuditLogs(
      'org-real-1',
      { timeFilterMode: 'today', cluster_id: 'ALL', service_name: 'ALL' },
      { page: 1, pageSize: 5000 }
    );
    const allUrl = request.mock.calls[1][0];
    expect(allUrl).not.toContain('cluster_id=');
    expect(allUrl).not.toContain('service_name=');
  });
});
