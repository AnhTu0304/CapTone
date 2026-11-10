import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ReportsPage } from './ReportsPage';
import {
  fetchOrganizationSLAReport,
  fetchActionAnalyticsReport,
} from '../../../services/reportService';

const mockDashboardContext = {
  currentOrg: { id: 'org-1', name: 'SME Retail Enterprise' },
  currentEnv: {
    id: 'cluster-fyuyu',
    clusterId: 'cluster-fyuyu',
    cluster: 'fyuyu',
    environment_id: 'env-prod',
    name: 'Production Kubernetes / fyuyu',
  },
  isRefreshing: false,
  triggerRefresh: jest.fn(),
  currentUserRole: 'SME_OWNER',
  onNavigate: jest.fn(),
};

jest.mock('../context/DashboardContext', () => ({
  useDashboard: () => mockDashboardContext,
}));

const mockToastFns = {
  success: jest.fn(),
  error: jest.fn(),
};

jest.mock('../../../context/ToastContext', () => ({
  useToast: () => mockToastFns,
}));

jest.mock('../../../services/reportService', () => ({
  fetchOrganizationSLAReport: jest.fn(),
  fetchActionAnalyticsReport: jest.fn(),
}));

jest.mock('../../../utils/exportUtils', () => ({
  exportToCsv: jest.fn(),
  exportToJson: jest.fn(),
}));

jest.mock('../../../utils/reportExcelExport', () => ({
  exportReportsToExcel: jest.fn().mockResolvedValue({ fileName: 'report.xlsx', sheetNames: ['TongQuan'] }),
}));

jest.mock('../../../components/dashboard/SLACostSavingsChart', () => () => <div data-testid="sla-trend-chart" />);
jest.mock('../../../components/dashboard/IncidentSeverityBreakdown', () => () => <div data-testid="severity-chart" />);
jest.mock('../../../components/dashboard/ActionActorBreakdownChart', () => () => <div data-testid="actor-chart" />);
jest.mock('../../../components/dashboard/ErrorActionMatrixChart', () => () => <div data-testid="matrix-chart" />);
jest.mock('../../../components/dashboard/ActionFailureReasonsChart', () => () => <div data-testid="reasons-chart" />);
jest.mock('../../../components/dashboard/ExcelExportModal', () => () => null);

const buildMockReport = ({
  totalActions = 477,
  succeededActions = 350,
  failedActions = 12,
  cancelledActions = 115,
  totalIncidentsResolved = 874,
  totalIncidents = 900,
  services = [
    {
      name: 'selfheal-test-app',
      tier: 'Tier 2 (Nghiệp vụ cốt lõi)',
      targetSla: '99.50%',
      actualUptime: '99.96%',
      mttrAvg: '1.20s',
      incidentsResolved: 210,
      actionsTotal: 300,
      actionsFailed: 5,
      actionsCancelled: 85,
      status: 'Đạt SLA (5 lỗi)',
    },
    {
      name: 'sme-order-service',
      tier: 'Tier 1 (Tối quan trọng)',
      targetSla: '99.90%',
      actualUptime: '99.98%',
      mttrAvg: '0.80s',
      incidentsResolved: 140,
      actionsTotal: 177,
      actionsFailed: 7,
      actionsCancelled: 30,
      status: 'Đạt SLA (7 lỗi)',
    },
  ],
  availableServices = ['selfheal-test-app', 'sme-order-service'],
  actionHistory = [
    {
      id: 'act-1',
      shortId: 'ACT00001',
      incidentId: 'inc-1',
      incidentType: 'HTTP_5XX_SPIKE',
      severity: 'HIGH',
      incidentTitle: 'Spike 502 trên sme-order-service',
      targetName: 'sme-order-service',
      actionCode: 'SCALE_REPLICAS',
      actionName: 'Mở rộng Replicas',
      riskLevel: 'LOW',
      executionMode: 'AUTO',
      executionStatus: 'SUCCEEDED',
      actorKey: 'SYSTEM:AI_MAPE_K',
      actorName: 'AI MAPE-K (Tự Động)',
      actorType: 'AI',
      createdAt: '2026-11-10T10:00:00Z',
      durationSeconds: 0.8,
      verificationResult: true,
    },
  ],
} = {}) => ({
  summary: {
    actualUptime: '99.97%',
    targetSla: '99.90%',
    mttrAvgSeconds: 3.8,
    totalIncidentsResolved,
    autonomousHealingRate: '88.5%',
    totalOperatingHours: 720,
  },
  monthlyTrends: [{ month: 'Tuần 1', uptime: 99.97, slaTarget: 99.9 }],
  services,
  availableServices,
  incidentBreakdown: {
    bySeverity: { CRITICAL: 5, HIGH: 20, MEDIUM: 40, LOW: 10 },
    byType: { HTTP_5XX_SPIKE: totalIncidents },
  },
  recentChanges: [],
  actionAnalytics: {
    summary: {
      totalActions,
      succeededActions,
      failedActions,
      cancelledActions,
      pendingActions: 0,
      successRate: 73.4,
      autoActionsTotal: 400,
      autoSucceeded: 310,
      manualActionsTotal: 77,
      manualSucceeded: 40,
      avgExecutionSeconds: 0.9,
      medianExecutionSeconds: 0.6,
      verifiedCount: succeededActions,
      verifiedSuccessRate: 99.5,
      totalIncidents,
      incidentsWithAction: totalActions,
      incidentsWithoutAction: Math.max(0, totalIncidents - totalActions),
    },
    trends: [],
    byActor: [],
    errorActionMatrix: [],
    failureReasons: [],
    actionHistory,
    pagination: { page: 1, limit: 25, total: actionHistory.length, totalPages: 1 },
    filterOptions: {
      actors: [],
      incidentTypes: ['HTTP_5XX_SPIKE'],
      actionCodes: ['SCALE_REPLICAS'],
      services: availableServices,
    },
  },
});

describe('ReportsPage Cluster Header Sync & K8s Service Filter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDashboardContext.currentOrg = { id: 'org-1', name: 'SME Retail Enterprise' };
    mockDashboardContext.currentEnv = {
      id: 'cluster-fyuyu',
      clusterId: 'cluster-fyuyu',
      cluster: 'fyuyu',
      environment_id: 'env-prod',
      name: 'Production Kubernetes / fyuyu',
    };
  });

  it('defaults to TopHeader cluster scope, re-queries on header cluster switch, and toggles Toàn công ty', async () => {
    fetchOrganizationSLAReport.mockResolvedValueOnce(buildMockReport());

    const { rerender } = render(<ReportsPage />);

    await waitFor(() => {
      expect(fetchOrganizationSLAReport).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: 'org-1',
          environmentId: 'env-prod',
          clusterId: 'cluster-fyuyu',
          serviceName: 'ALL',
          timeRange: '1M',
        })
      );
    });

    expect(screen.getByText('Cụm K8s: fyuyu', { selector: 'span' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'fyuyu' })).toHaveAttribute('aria-pressed', 'true');
    expect(await screen.findByText('477 action')).toBeInTheDocument();

    // Switching cluster on TopHeader immediately re-queries using new cluster
    mockDashboardContext.currentEnv = {
      id: 'cluster-ai',
      clusterId: 'cluster-ai',
      cluster: 'ai',
      environment_id: 'env-prod',
      name: 'Production Kubernetes / ai',
    };
    fetchOrganizationSLAReport.mockResolvedValueOnce(
      buildMockReport({
        totalActions: 95,
        succeededActions: 80,
        failedActions: 3,
        cancelledActions: 12,
        totalIncidentsResolved: 120,
        totalIncidents: 130,
        availableServices: ['mongodb'],
        services: [
          {
            name: 'mongodb',
            tier: 'Tier 1 (Tối quan trọng)',
            targetSla: '99.90%',
            actualUptime: '99.99%',
            mttrAvg: '0.50s',
            incidentsResolved: 80,
            actionsTotal: 95,
            actionsFailed: 3,
            actionsCancelled: 12,
            status: 'Đạt SLA (3 lỗi)',
          },
        ],
      })
    );

    rerender(<ReportsPage />);

    await waitFor(() => {
      expect(fetchOrganizationSLAReport).toHaveBeenCalledWith(
        expect.objectContaining({
          clusterId: 'cluster-ai',
          serviceName: 'ALL',
        })
      );
    });
    expect(screen.getByText('Cụm K8s: ai', { selector: 'span' })).toBeInTheDocument();
    expect(await screen.findByText('95 action')).toBeInTheDocument();

    // Switching to Toàn công ty clears clusterId and environmentId
    fetchOrganizationSLAReport.mockResolvedValueOnce(
      buildMockReport({ totalActions: 3617, totalIncidentsResolved: 7029, totalIncidents: 7100 })
    );

    fireEvent.click(screen.getByRole('button', { name: 'Toàn công ty' }));

    await waitFor(() => {
      expect(fetchOrganizationSLAReport).toHaveBeenLastCalledWith(
        expect.objectContaining({
          organizationId: 'org-1',
          environmentId: null,
          clusterId: null,
          serviceName: 'ALL',
        })
      );
    });
    expect(screen.getByText('Phạm vi: Toàn công ty', { selector: 'span' })).toBeInTheDocument();
    expect(await screen.findByText('3.617 action')).toBeInTheDocument();
  });

  it('filters cohesively by real K8s service, resets on Đặt lại lọc, and clears stale service on cluster switch', async () => {
    fetchOrganizationSLAReport.mockResolvedValueOnce(buildMockReport());

    const { rerender } = render(<ReportsPage />);

    expect(await screen.findByText('477 action')).toBeInTheDocument();

    const serviceSelect = screen.getByLabelText('Lọc theo dịch vụ K8s');
    const optionLabels = Array.from(serviceSelect.querySelectorAll('option')).map((o) => o.textContent);
    expect(optionLabels).toEqual([
      'Tất cả dịch vụ (2)',
      'Dịch vụ: selfheal-test-app',
      'Dịch vụ: sme-order-service',
    ]);

    // Select a specific K8s service
    fetchOrganizationSLAReport.mockResolvedValueOnce(
      buildMockReport({
        totalActions: 177,
        succeededActions: 140,
        failedActions: 7,
        cancelledActions: 30,
        totalIncidentsResolved: 150,
        totalIncidents: 160,
        availableServices: ['selfheal-test-app', 'sme-order-service'],
        services: [
          {
            name: 'sme-order-service',
            tier: 'Tier 1 (Tối quan trọng)',
            targetSla: '99.90%',
            actualUptime: '99.98%',
            mttrAvg: '0.80s',
            incidentsResolved: 140,
            actionsTotal: 177,
            actionsFailed: 7,
            actionsCancelled: 30,
            status: 'Đạt SLA (7 lỗi)',
          },
        ],
      })
    );

    fireEvent.change(serviceSelect, { target: { value: 'sme-order-service' } });

    await waitFor(() => {
      expect(fetchOrganizationSLAReport).toHaveBeenLastCalledWith(
        expect.objectContaining({
          clusterId: 'cluster-fyuyu',
          serviceName: 'sme-order-service',
        })
      );
    });
    expect(await screen.findByText('177 action')).toBeInTheDocument();
    expect(screen.getByText('Dịch vụ: sme-order-service', { selector: 'span' })).toBeInTheDocument();
    // Both services remain selectable in dropdown while filtered
    expect(Array.from(serviceSelect.querySelectorAll('option')).map((o) => o.value)).toEqual([
      'ALL',
      'selfheal-test-app',
      'sme-order-service',
    ]);

    // Reset via "Đặt lại lọc"
    fetchOrganizationSLAReport.mockResolvedValueOnce(buildMockReport());
    fireEvent.click(screen.getByRole('button', { name: 'Đặt lại lọc' }));

    await waitFor(() => {
      expect(fetchOrganizationSLAReport).toHaveBeenLastCalledWith(
        expect.objectContaining({
          clusterId: 'cluster-fyuyu',
          serviceName: 'ALL',
        })
      );
    });
    expect(await screen.findByText('477 action')).toBeInTheDocument();

    // Select service again then switch cluster on header: service must reset to ALL BEFORE querying new cluster
    fetchOrganizationSLAReport.mockResolvedValueOnce(buildMockReport({ totalActions: 177 }));
    fireEvent.change(serviceSelect, { target: { value: 'sme-order-service' } });
    await screen.findByText('177 action');

    const callsBeforeSwitch = fetchOrganizationSLAReport.mock.calls.length;
    mockDashboardContext.currentEnv = {
      id: 'cluster-ai',
      clusterId: 'cluster-ai',
      cluster: 'ai',
      environment_id: 'env-prod',
      name: 'Production Kubernetes / ai',
    };
    fetchOrganizationSLAReport.mockResolvedValueOnce(
      buildMockReport({ totalActions: 95, availableServices: ['mongodb'] })
    );

    rerender(<ReportsPage />);

    await waitFor(() => {
      expect(fetchOrganizationSLAReport.mock.calls.length).toBeGreaterThan(callsBeforeSwitch);
    });

    const newClusterCalls = fetchOrganizationSLAReport.mock.calls
      .slice(callsBeforeSwitch)
      .map((args) => args[0]);
    expect(newClusterCalls.every((arg) => arg.clusterId === 'cluster-ai' && arg.serviceName === 'ALL')).toBe(
      true
    );
  });

  it('displays explicit 403 RBAC error state without fallback data', async () => {
    const err403 = new Error('Từ chối truy cập');
    err403.status = 403;
    fetchOrganizationSLAReport.mockRejectedValueOnce(err403);

    render(<ReportsPage />);

    expect(
      await screen.findByText(/Từ chối truy cập \(403 Forbidden\)/i)
    ).toBeInTheDocument();
    expect(fetchActionAnalyticsReport).not.toHaveBeenCalled();
  });
});
