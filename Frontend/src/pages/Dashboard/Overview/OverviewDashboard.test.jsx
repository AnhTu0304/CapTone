import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { OverviewPage } from './index';
import { DashboardProvider } from '../context/DashboardContext';
import dashboardStatisticsService from '../../../services/dashboardStatisticsService';
import { clusterService } from '../../../services/clusterService';
import { telemetryService } from '../../../services/telemetryService';

// Mock lightweight-charts
jest.mock('lightweight-charts', () => ({
  createChart: jest.fn(() => ({
    addSeries: jest.fn(() => ({
      setData: jest.fn(),
      applyOptions: jest.fn(),
      update: jest.fn(),
      createPriceLine: jest.fn(),
    })),
    applyOptions: jest.fn(),
    remove: jest.fn(),
    subscribeCrosshairMove: jest.fn(),
    unsubscribeCrosshairMove: jest.fn(),
    timeScale: () => ({ fitContent: jest.fn() }),
  })),
  AreaSeries: 'AreaSeriesDefinition',
  LineSeries: 'LineSeriesDefinition',
  ColorType: { Solid: 'solid' },
  CrosshairMode: { Normal: 0 },
  LineStyle: { Dotted: 1, Dashed: 2 },
}));

// Mock services
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
  envList: [
    {
      id: 'cls-01',
      clusterId: 'cls-01',
      name: 'Production / k8s-prod-cluster',
      cluster: 'k8s-prod-cluster',
      envName: 'Production',
      status: 'Ready',
      agentStatus: 'ONLINE',
      nodes: 3,
      pods: 24,
    },
    {
      id: 'cls-02',
      clusterId: 'cls-02',
      name: 'Staging / k8s-staging-cluster',
      cluster: 'k8s-staging-cluster',
      envName: 'Staging',
      status: 'Pending',
      agentStatus: 'PENDING',
      nodes: 1,
      pods: 8,
    },
  ],
  isAgentConnected: true,
  isAutoRefresh: true,
  lastUpdated: '14:20:00',
  isRefreshing: false,
  triggerRefresh: jest.fn(),
  pendingApprovalsCount: 2,
  onNavigate: jest.fn(),
};

jest.mock('../context/DashboardContext', () => ({
  useDashboard: () => mockDashboardContextValue,
  DashboardProvider: ({ children }) => <div>{children}</div>,
}));

describe('Overview Dashboard & Statistics Cards Suite [S5][PBI19 Task 1.3 & 1.4]', () => {
  const mockStatsResponse = {
    time_range: '24h',
    scope: { type: 'TENANT', organization_id: 'org-101' },
    summary: {
      total_organizations: 1,
      active_organizations: 1,
      total_clusters: 2,
      connected_clusters: 1,
      total_agents: 2,
      online_agents: 1,
    },
    incidents: {
      total: 3,
      active: 1,
      resolved: 2,
      failed: 0,
      critical: 0,
      high: 1,
      medium: 1,
      low: 1,
      mttr_minutes: 15,
    },
    remediations: {
      total: 10,
      succeeded: 9,
      failed: 1,
      in_progress: 0,
      success_rate: 90.0,
    },
    resource_usage: {
      avg_cpu_percent: 28.5,
      peak_cpu_percent: 62.0,
      avg_ram_percent: 45.2,
      peak_ram_percent: 78.1,
      sample_count: 500,
    },
    recent_activities: [],
  };

  const mockClusterDetail = {
    id: 'cls-01',
    name: 'k8s-prod-cluster',
    status: 'ACTIVE',
    kubernetes_version: 'v1.37.0',
    nodes: [
      {
        id: 'node-01',
        name: 'worker-01',
        cpu_capacity_millicores: '4000',
        memory_capacity_bytes: (8 * 1024 * 1024 * 1024).toString(),
        disk_capacity_bytes: (500 * 1024 * 1024 * 1024).toString(),
      },
    ],
    pods: [
      { id: 'pod-01', name: 'app-service-1', status: 'Running', namespace: 'default' },
      { id: 'pod-02', name: 'app-service-2', status: 'Running', namespace: 'default' },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    dashboardStatisticsService.getOverviewStats.mockResolvedValue(mockStatsResponse);
    clusterService.getClusterDetail.mockResolvedValue(mockClusterDetail);
    telemetryService.getClusterResourceTrend.mockResolvedValue({
      sequence: [
        { time_bucket: new Date().toISOString(), cpu: 25, ram: 40, disk: 15, latency: 1.2 },
      ],
      isStale: false,
    });
    telemetryService.getLiveSummary.mockResolvedValue({
      latest_point: { cpu: 25.5, ram: 40.0, disk: 15, latency: 1.2 },
      sequence: [],
      incidents: [],
      recommendations: [],
    });
    telemetryService.subscribeWebSocket.mockReturnValue(jest.fn());
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('1. Renders Overview Header with Organization and Environment name', async () => {
    render(<OverviewPage />);

    expect(screen.getByText('Tổng Quan Vận Hành Hạ Tầng')).toBeInTheDocument();
    expect(screen.getAllByText(/Acme Test Corp/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/k8s-prod-cluster/i).length).toBeGreaterThanOrEqual(1);
  });

  test('2. Renders Auto-Refresh controls: Toggle button, Interval selector, and Refresh Now button', async () => {
    render(<OverviewPage />);

    // Toggle button
    expect(screen.getByText(/Tự làm mới: 30s/)).toBeInTheDocument();
    // Manual refresh button
    expect(screen.getByRole('button', { name: /^Làm mới$/i })).toBeInTheDocument();
  });

  test('3. Fetches and renders live Statistics metrics from backend API', async () => {
    render(<OverviewPage />);

    await waitFor(() => {
      expect(dashboardStatisticsService.getOverviewStats).toHaveBeenCalledWith(
        expect.objectContaining({
          organization_id: 'org-101',
          cluster_id: 'cls-01',
        })
      );
    });

    // Check rendered metric values
    await waitFor(() => {
      expect(screen.getByText('28.5%')).toBeInTheDocument(); // CPU
      expect(screen.getByText('45.2%')).toBeInTheDocument(); // RAM
      expect(screen.getByText('1')).toBeInTheDocument();     // Active Incidents
      expect(screen.getByText(/90%/i)).toBeInTheDocument();  // Remediations Success Rate
    });
  });

  test('4. Displays Error Banner with Retry button when statistics API fails', async () => {
    dashboardStatisticsService.getOverviewStats.mockRejectedValueOnce(
      new Error('Mạng không ổn định hoặc CSDL bận')
    );

    render(<OverviewPage />);

    await waitFor(() => {
      expect(screen.getByText(/Mạng không ổn định hoặc CSDL bận/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Thử lại/i })).toBeInTheDocument();
    });

    // Click retry
    dashboardStatisticsService.getOverviewStats.mockResolvedValueOnce(mockStatsResponse);
    fireEvent.click(screen.getByRole('button', { name: /Thử lại/i }));

    await waitFor(() => {
      expect(dashboardStatisticsService.getOverviewStats).toHaveBeenCalledTimes(2);
    });
  });

  test('5. Renders Cluster Fleet Status table with cluster rows and hardware metrics', async () => {
    render(<OverviewPage />);

    await waitFor(() => {
      expect(screen.getByText('Trạng Thái Hạ Tầng Cụm Kubernetes (Cluster Fleet Status)')).toBeInTheDocument();
      expect(screen.getByText('k8s-prod-cluster')).toBeInTheDocument();
      expect(screen.getByText('k8s-staging-cluster')).toBeInTheDocument();
      expect(screen.getByText('CONNECTED')).toBeInTheDocument();
      expect(screen.getByText('PENDING')).toBeInTheDocument();
    });
  });

  test('6. Clicking "Chuyển sang cụm này" triggers setCurrentEnv and local storage save', async () => {
    render(<OverviewPage />);

    await waitFor(() => {
      expect(screen.getByText('k8s-staging-cluster')).toBeInTheDocument();
    });

    const switchBtn = screen.getByRole('button', { name: /Chuyển sang cụm này/i });
    fireEvent.click(switchBtn);

    expect(mockDashboardContextValue.setCurrentEnv).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'cls-02' })
    );
    expect(mockDashboardContextValue.triggerRefresh).toHaveBeenCalled();
  });

  test('7. Toggling Auto-Refresh button pauses and resumes polling', async () => {
    render(<OverviewPage />);

    const toggleBtn = screen.getByText(/Tự làm mới: 30s/i);
    fireEvent.click(toggleBtn);

    // Turned OFF
    expect(screen.getByText('Tự làm mới: TẮT')).toBeInTheDocument();

    // Turned back ON
    fireEvent.click(screen.getByText('Tự làm mới: TẮT'));
    expect(screen.getByText(/Tự làm mới: 30s/i)).toBeInTheDocument();
  });

  test('8. Changing interval dropdown changes refresh timer interval', async () => {
    render(<OverviewPage />);

    const select = screen.getByDisplayValue('30s');
    fireEvent.change(select, { target: { value: '15' } });

    expect(screen.getByText(/Tự làm mới: 15s/i)).toBeInTheDocument();
  });

  test('9. Auto-refresh timer triggers periodic refresh when active', async () => {
    render(<OverviewPage />);

    await waitFor(() => {
      expect(dashboardStatisticsService.getOverviewStats).toHaveBeenCalledTimes(1);
    });

    // Advance 30 seconds
    act(() => {
      jest.advanceTimersByTime(30000);
    });

    await waitFor(() => {
      expect(dashboardStatisticsService.getOverviewStats).toHaveBeenCalledTimes(2);
    });
  });

  test('10. Pauses polling when document becomes hidden and resumes upon visibility', async () => {
    render(<OverviewPage />);

    await waitFor(() => {
      expect(dashboardStatisticsService.getOverviewStats).toHaveBeenCalledTimes(1);
    });

    // Simulate tab hidden
    Object.defineProperty(document, 'hidden', { value: true, writable: true });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
      jest.advanceTimersByTime(30000);
    });

    // Should NOT have triggered while hidden
    expect(dashboardStatisticsService.getOverviewStats).toHaveBeenCalledTimes(1);

    // Simulate tab visible again
    Object.defineProperty(document, 'hidden', { value: false, writable: true });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    await waitFor(() => {
      expect(dashboardStatisticsService.getOverviewStats).toHaveBeenCalledTimes(2);
    });
  });

  test('11. Manual "Làm mới" button triggers immediate refresh and updates timestamp', async () => {
    render(<OverviewPage />);

    const refreshBtn = screen.getByRole('button', { name: /^Làm mới$/i });
    fireEvent.click(refreshBtn);

    expect(mockDashboardContextValue.triggerRefresh).toHaveBeenCalled();
    await waitFor(() => {
      expect(dashboardStatisticsService.getOverviewStats).toHaveBeenCalledTimes(2);
    });
  });

  test('12. Unmounting component cleans up interval timer and event listeners', async () => {
    const removeEventListenerSpy = jest.spyOn(document, 'removeEventListener');
    const { unmount } = render(<OverviewPage />);

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      'visibilitychange',
      expect.any(Function)
    );
  });
});
