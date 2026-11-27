import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { OverviewPage } from './index';
import dashboardStatisticsService from '../../../services/dashboardStatisticsService';
import { clusterService } from '../../../services/clusterService';
import { telemetryService } from '../../../services/telemetryService';

jest.mock('../../../components/dashboard/ai/AIPipelineFlowCanvas', () => ({
  __esModule: true,
  default: ({ topSafePadding }) => (
    <div data-testid="mock-ai-canvas" data-top-safe-padding={String(topSafePadding)} />
  ),
}));

jest.mock('../../../services/dashboardStatisticsService');
jest.mock('../../../services/clusterService');
jest.mock('../../../services/telemetryService');

const mockDashboardContextValue = {
  currentOrg: { id: 'org-101', name: 'Acme Test Corp', slug: 'acme-test' },
  currentEnv: {
    id: 'cls-01',
    clusterId: 'cls-01',
    name: 'Production / k8s-prod-cluster',
    cluster: 'k8s-prod-cluster',
    envName: 'Production',
    status: 'Ready',
    agentStatus: 'ONLINE',
  },
  setCurrentEnv: jest.fn(),
  envList: [],
  isAgentConnected: true,
  isAutoRefresh: false,
  lastUpdated: '14:20:00',
  isRefreshing: false,
  triggerRefresh: jest.fn(),
  pendingApprovalsCount: 0,
  onNavigate: jest.fn(),
};

jest.mock('../context/DashboardContext', () => ({
  useDashboard: () => mockDashboardContextValue,
}));

describe('Overview KPI Strip Collapse & Expand Toggle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.removeItem('overview_kpi_collapsed');
    dashboardStatisticsService.getOverviewStats.mockResolvedValue({});
    clusterService.getClusterDetail.mockResolvedValue({ id: 'cls-01', nodes: [], pods: [] });
    telemetryService.getClusterResourceTrend.mockResolvedValue({ sequence: [] });
    telemetryService.getLiveSummary.mockResolvedValue({ latest_point: null, sequence: [] });
    telemetryService.getMetricsSequence.mockResolvedValue({ sequence: [] });
    telemetryService.subscribeWebSocket.mockReturnValue(jest.fn());
  });

  test('collapses KPI cards upwards and expands back downwards on toggle click', () => {
    render(<OverviewPage />);

    const toggleBtn = screen.getByTestId('overview-kpi-toggle-btn');
    const kpiWrapper = screen.getByTestId('overview-kpi-collapsible');
    const canvas = screen.getByTestId('mock-ai-canvas');

    // Mặc định đang mở rộng 8 thẻ KPI
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'true');
    expect(kpiWrapper).toHaveAttribute('aria-hidden', 'false');
    expect(kpiWrapper.style.maxHeight).not.toBe('0px');
    expect(canvas).toHaveAttribute('data-top-safe-padding', '126');
    expect(screen.getByText('CPU Cụm')).toBeInTheDocument();

    // Nhấn nút ẩn lên trên
    fireEvent.click(toggleBtn);
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'false');
    expect(kpiWrapper).toHaveAttribute('aria-hidden', 'true');
    expect(kpiWrapper.style.maxHeight).toBe('0px');
    expect(canvas).toHaveAttribute('data-top-safe-padding', '48');
    expect(screen.getByText(/Chỉ số cụm \(8\)/i)).toBeInTheDocument();
    expect(localStorage.getItem('overview_kpi_collapsed')).toBe('true');

    // Nhấn nút sổ xuống để hiện lại 8 thẻ KPI
    fireEvent.click(toggleBtn);
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'true');
    expect(kpiWrapper).toHaveAttribute('aria-hidden', 'false');
    expect(kpiWrapper.style.maxHeight).not.toBe('0px');
    expect(canvas).toHaveAttribute('data-top-safe-padding', '126');
    expect(localStorage.getItem('overview_kpi_collapsed')).toBe('false');
  });
});
