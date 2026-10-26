import React from 'react';
import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react';
import { LogsPage } from './LogsPage';
import { telemetryService } from '../../../services/telemetryService';
import { clusterService } from '../../../services/clusterService';
import { deploymentService } from '../../../services/deploymentService';
import { podService } from '../../../services/podService';
import { maskSensitiveData, formatLogTimestamp, getLogLevelBadgeStyle } from '../../../components/dashboard/LogDetailModal';

// Mock Dashboard Context
jest.mock('../context/DashboardContext', () => ({
  useDashboard: () => ({
    currentOrg: { id: 'org-test-1', name: 'Aegis Test Org' },
    currentEnv: { id: 'env-test-1', name: 'Production Cluster' },
  }),
}));

// Mock telemetryService
jest.mock('../../../services/telemetryService', () => ({
  telemetryService: {
    getLogs: jest.fn(),
    getApmServices: jest.fn(),
  },
}));

// Mock K8s services
jest.mock('../../../services/clusterService', () => ({
  clusterService: {
    getClusterNamespaces: jest.fn().mockResolvedValue(['default', 'kube-system', 'production']),
    getClusterDetail: jest.fn().mockResolvedValue({ namespaces: [{ name: 'default' }, { name: 'production' }] }),
  },
}));

jest.mock('../../../services/deploymentService', () => ({
  deploymentService: {
    getDeploymentsByCluster: jest.fn().mockResolvedValue([
      { id: 'dep-order', name: 'order-service' },
      { id: 'dep-payment', name: 'payment-service' },
    ]),
  },
}));

jest.mock('../../../services/podService', () => ({
  podService: {
    getPodsByCluster: jest.fn().mockResolvedValue([
      { id: 'pod-1', name: 'order-service-7f89d-11', workload_name: 'order-service' },
      { id: 'pod-2', name: 'payment-service-5a41c-22', workload_name: 'payment-service' },
    ]),
  },
}));

describe('Task [S4][PB17] 3.1 – Centralized Logs Viewer, Filters & Details Suite', () => {
  const sampleLogs = [
    {
      id: '1001',
      cluster_id: 'cluster-alpha',
      service_id: '635135cb-913d-4f21-b2dc-c390a9978f25',
      service_name: 'dashboard-metrics-scraper',
      pod_id: 'metrics-scraper-pod-77x',
      level: 'INFO',
      message: 'Scraping target kubelet metrics completed in 14ms',
      source: 'k8s-agent',
      occurred_at: '2026-10-26T12:00:00.000Z',
      metadata: {
        agent_id: 'agent-1',
        pod_id: 'metrics-scraper-pod-77x',
        http_code: 200,
      },
    },
    {
      id: '1002',
      cluster_id: 'cluster-alpha',
      service_id: '333dcce2-d788-4d51-9226-5b67e90f5c5b',
      service_name: 'hello-minikube',
      pod_id: 'hello-minikube-6f98d',
      level: 'WARN',
      message: 'Connection pool approaching threshold (82% allocated)',
      source: 'k8s-agent',
      occurred_at: '2026-10-26T12:05:00.000Z',
      metadata: {
        pool_size: 20,
        active_connections: 16,
      },
    },
    {
      id: '1003',
      cluster_id: 'cluster-alpha',
      service_id: '635135cb-913d-4f21-b2dc-c390a9978f25',
      service_name: 'dashboard-metrics-scraper',
      pod_id: 'metrics-scraper-pod-77x',
      level: 'ERROR',
      message: 'Failed to dispatch webhook to notification gateway: connection timeout after 5000ms password=secret123',
      source: 'k8s-agent',
      occurred_at: '2026-10-26T12:10:00.000Z',
      metadata: {
        error_code: 'ETIMEDOUT',
        target_url: 'https://gateway.internal/webhook',
      },
    },
  ];

  const samplePagination = {
    total: 3,
    page: 1,
    limit: 50,
    totalPages: 1,
  };

  const sampleServices = [
    { service_id: 'dashboard-metrics-scraper', service_name: 'dashboard-metrics-scraper' },
    { service_id: 'hello-minikube', service_name: 'hello-minikube' },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    telemetryService.getApmServices.mockResolvedValue(sampleServices);
    telemetryService.getLogs.mockResolvedValue({
      logs: sampleLogs,
      pagination: samplePagination,
    });
    clusterService.getClusterNamespaces.mockResolvedValue(['default', 'kube-system', 'production', 'staging']);
    clusterService.getClusterDetail.mockResolvedValue({ namespaces: [{ name: 'default' }, { name: 'production' }] });
    deploymentService.getDeploymentsByCluster.mockResolvedValue([
      { id: 'dep-order', name: 'order-service' },
      { id: 'dep-payment', name: 'payment-service' },
    ]);
    podService.getPodsByCluster.mockResolvedValue([
      { id: 'pod-1', name: 'order-service-7f89d-11', workload_name: 'order-service' },
      { id: 'pod-2', name: 'payment-service-5a41c-22', workload_name: 'payment-service' },
    ]);
  });

  describe('1. Log Security & Formatter Utilities', () => {
    test('1.1. Masks sensitive passwords, tokens and bearer keys in log messages', () => {
      expect(maskSensitiveData('Connect with password=mySecretPassword123')).toBe('Connect with password=******');
      expect(maskSensitiveData('Using token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9')).toBe('Using token=******');
      expect(maskSensitiveData('Authorization: Bearer secret_jwt_token_here')).toBe('Authorization: Bearer ******');
      expect(maskSensitiveData(null)).toBeNull();
      expect(maskSensitiveData('Clean message with no secret')).toBe('Clean message with no secret');
    });

    test('1.2. Formats log timestamps to localized and UTC representation', () => {
      const formatted = formatLogTimestamp('2026-10-26T12:00:00.000Z');
      expect(formatted.utc).toBe('2026-10-26T12:00:00.000Z');
      expect(formatted.local).toBeTruthy();
      expect(formatLogTimestamp(null).local).toBe('--');
    });

    test('1.3. Returns appropriate color styles for all severity levels', () => {
      expect(getLogLevelBadgeStyle('FATAL').text).toBe('#BE123C');
      expect(getLogLevelBadgeStyle('ERROR').text).toBe('#DC2626');
      expect(getLogLevelBadgeStyle('WARN').text).toBe('#D97706');
      expect(getLogLevelBadgeStyle('DEBUG').text).toBe('#4B5563');
      expect(getLogLevelBadgeStyle('INFO').text).toBe('#2563EB');
    });
  });

  describe('2. LogsPage Rendering & Data Integration', () => {
    test('2.1. Renders page header, filter toolbar and terminal window', async () => {
      render(<LogsPage />);

      expect(screen.getByText(/Nhật Ký Hệ Thống Tập Trung/i)).toBeInTheDocument();
      expect(screen.getByTestId('logs-filter-toolbar')).toBeInTheDocument();
      expect(screen.getByTestId('logs-terminal-window')).toBeInTheDocument();

      await waitFor(() => {
        expect(telemetryService.getLogs).toHaveBeenCalled();
        expect(screen.getByText(/Scraping target kubelet metrics completed in 14ms/i)).toBeInTheDocument();
      });
    });

    test('2.2. Displays log rows with severity badge, service tag and pod info', async () => {
      render(<LogsPage />);

      await waitFor(() => {
        expect(screen.getByText(/Scraping target kubelet metrics completed in 14ms/i)).toBeInTheDocument();
      });

      expect(screen.getByText('WARN')).toBeInTheDocument();
      expect(screen.getByText('ERROR')).toBeInTheDocument();
      expect(screen.getAllByText(/dashboard-metrics-scraper\/metrics-scraper-pod-77x/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText(/hello-minikube\/hello-minikube-6f98d/i)).toBeInTheDocument();
    });

    test('2.3. Displays loading state while initial fetch is pending', () => {
      telemetryService.getLogs.mockReturnValue(new Promise(() => {})); // Never resolves
      render(<LogsPage />);

      expect(screen.getByTestId('logs-loading-state')).toBeInTheDocument();
    });

    test('2.4. Displays empty state when query returns 0 matching logs', async () => {
      telemetryService.getLogs.mockResolvedValueOnce({
        logs: [],
        pagination: { total: 0, page: 1, limit: 50, totalPages: 1 },
      });

      render(<LogsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('logs-empty-state')).toBeInTheDocument();
        expect(screen.getByText(/Không tìm thấy nhật ký phù hợp với bộ lọc hiện tại/i)).toBeInTheDocument();
      });
    });

    test('2.5. Displays error banner with retry button on API failure', async () => {
      telemetryService.getLogs.mockRejectedValueOnce(new Error('Network gateway timeout'));

      render(<LogsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('logs-error-banner')).toBeInTheDocument();
        expect(screen.getByText(/Network gateway timeout/i)).toBeInTheDocument();
      });

      // Clicking retry re-invokes fetch
      telemetryService.getLogs.mockResolvedValueOnce({
        logs: sampleLogs,
        pagination: samplePagination,
      });

      fireEvent.click(screen.getByTestId('logs-error-retry-btn'));

      await waitFor(() => {
        expect(screen.getByText(/Scraping target kubelet metrics completed in 14ms/i)).toBeInTheDocument();
      });
    });
  });

  describe('3. Filter Controls & Debounced Search', () => {
    test('3.1. Severity filter calls API with selected level and resets to page 1', async () => {
      render(<LogsPage />);

      await waitFor(() => {
        expect(telemetryService.getLogs).toHaveBeenCalled();
      });

      fireEvent.change(screen.getByTestId('logs-level-select'), { target: { value: 'ERROR' } });

      await waitFor(() => {
        expect(telemetryService.getLogs).toHaveBeenLastCalledWith(
          expect.objectContaining({ level: 'ERROR', page: 1 }),
          expect.anything()
        );
      });
    });

    test('3.2. Service filter calls API with selected service name', async () => {
      render(<LogsPage />);

      await waitFor(() => {
        expect(telemetryService.getLogs).toHaveBeenCalled();
      });

      fireEvent.change(screen.getByTestId('logs-service-select'), {
        target: { value: 'hello-minikube' },
      });

      await waitFor(() => {
        expect(telemetryService.getLogs).toHaveBeenLastCalledWith(
          expect.objectContaining({ serviceId: 'hello-minikube', page: 1 }),
          expect.anything()
        );
      });
    });

    test('3.3. Time range filter calls API with selected range preset', async () => {
      render(<LogsPage />);

      await waitFor(() => {
        expect(telemetryService.getLogs).toHaveBeenCalled();
      });

      fireEvent.change(screen.getByTestId('logs-range-select'), {
        target: { value: '24h' },
      });

      await waitFor(() => {
        expect(telemetryService.getLogs).toHaveBeenLastCalledWith(
          expect.objectContaining({ range: '24h', page: 1 }),
          expect.anything()
        );
      });
    });

    test('3.4. Search input debounces keystrokes and queries API after 300ms', async () => {
      jest.useFakeTimers();
      render(<LogsPage />);

      fireEvent.change(screen.getByTestId('logs-search-input'), {
        target: { value: 'ETIMEDOUT' },
      });

      // Not called immediately
      expect(telemetryService.getLogs).not.toHaveBeenLastCalledWith(
        expect.objectContaining({ search: 'ETIMEDOUT' }),
        expect.anything()
      );

      // Advance timers by 300ms
      act(() => {
        jest.advanceTimersByTime(300);
      });

      await waitFor(() => {
        expect(telemetryService.getLogs).toHaveBeenLastCalledWith(
          expect.objectContaining({ search: 'ETIMEDOUT', page: 1 }),
          expect.anything()
        );
      });

      jest.useRealTimers();
    });

    test('3.5. Reset button clears all active filters back to defaults', async () => {
      render(<LogsPage />);

      fireEvent.change(screen.getByTestId('logs-level-select'), { target: { value: 'ERROR' } });

      await waitFor(() => {
        expect(screen.getByTestId('logs-reset-filters-btn')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('logs-reset-filters-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('logs-level-select').value).toBe('all');
        expect(screen.getByTestId('logs-range-select').value).toBe('1h');
      });
    });
  });

  describe('4. Pagination & Page Navigation', () => {
    test('4.1. Navigates to next page and updates API call', async () => {
      telemetryService.getLogs.mockResolvedValueOnce({
        logs: sampleLogs,
        pagination: { total: 100, page: 1, limit: 50, totalPages: 2 },
      });

      render(<LogsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('logs-pagination-bar')).toHaveTextContent(/Trang 1 \/ 2/i);
      });

      const nextBtn = screen.getByTestId('logs-next-page-btn');
      expect(nextBtn).not.toBeDisabled();

      fireEvent.click(nextBtn);

      await waitFor(() => {
        expect(telemetryService.getLogs).toHaveBeenLastCalledWith(
          expect.objectContaining({ page: 2 }),
          expect.anything()
        );
      });
    });

    test('4.2. Prev button is disabled on page 1', async () => {
      render(<LogsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('logs-prev-page-btn')).toBeDisabled();
      });
    });

    test('4.3. Changing page size dropdown triggers reload with new limit', async () => {
      render(<LogsPage />);

      await waitFor(() => {
        expect(telemetryService.getLogs).toHaveBeenCalled();
      });

      fireEvent.change(screen.getByTestId('logs-page-size-select'), {
        target: { value: '100' },
      });

      await waitFor(() => {
        expect(telemetryService.getLogs).toHaveBeenLastCalledWith(
          expect.objectContaining({ limit: 100, page: 1 }),
          expect.anything()
        );
      });
    });
  });

  describe('5. Log Detail Modal & Masking', () => {
    test('5.1. Clicking a log row opens detailed modal with message and metadata', async () => {
      render(<LogsPage />);

      await waitFor(() => {
        expect(screen.getByText(/Scraping target kubelet metrics completed in 14ms/i)).toBeInTheDocument();
      });

      // Click on row 1001
      fireEvent.click(screen.getByTestId('log-row-1001'));

      expect(screen.getByTestId('log-detail-modal')).toBeInTheDocument();
      const modal = screen.getByTestId('log-detail-modal');
      expect(within(modal).getByText(/Chi tiết Bản ghi Nhật ký/i)).toBeInTheDocument();
      expect(within(modal).getAllByText(/metrics-scraper-pod-77x/i).length).toBeGreaterThan(0);
      expect(within(modal).getByText(/agent-1/i)).toBeInTheDocument();
    });

    test('5.2. Masks password in modal message view', async () => {
      render(<LogsPage />);

      await waitFor(() => {
        expect(screen.getByText(/Failed to dispatch webhook/i)).toBeInTheDocument();
      });

      // Click on row 1003 which has password=secret123
      fireEvent.click(screen.getByTestId('log-row-1003'));

      const modal = screen.getByTestId('log-detail-modal');
      expect(modal).toBeInTheDocument();
      expect(within(modal).getByText(/password=\*\*\*\*\*\*/i)).toBeInTheDocument();
      expect(within(modal).queryByText(/secret123/i)).not.toBeInTheDocument();
    });

    test('5.3. Closes modal when clicking close (X) or footer close button', async () => {
      render(<LogsPage />);

      await waitFor(() => {
        expect(screen.getByText(/Scraping target kubelet metrics completed in 14ms/i)).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('log-row-1001'));
      expect(screen.getByTestId('log-detail-modal')).toBeInTheDocument();

      fireEvent.click(screen.getByTestId('log-detail-close-btn'));
      expect(screen.queryByTestId('log-detail-modal')).not.toBeInTheDocument();
    });
  });

  describe('6. Live Stream & Copy Actions', () => {
    test('6.1. Toggling Live Stream updates status indicator and starts polling', async () => {
      render(<LogsPage />);

      expect(screen.getByText(/○ TẠM DỪNG/i)).toBeInTheDocument();

      const liveBtn = screen.getByTestId('logs-live-toggle');
      fireEvent.click(liveBtn);

      expect(screen.getByText(/● ĐANG TRUYỀN DỮ LIỆU TRỰC TIẾP/i)).toBeInTheDocument();
      expect(screen.getByText(/Tạm dừng Live/i)).toBeInTheDocument();
    });

    test('6.2. Copies logs to clipboard when clicking copy button', async () => {
      Object.assign(navigator, {
        clipboard: {
          writeText: jest.fn().mockImplementation(() => Promise.resolve()),
        },
      });

      render(<LogsPage />);

      await waitFor(() => {
        expect(screen.getByText(/Scraping target kubelet metrics completed in 14ms/i)).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('logs-copy-btn'));

      expect(navigator.clipboard.writeText).toHaveBeenCalled();
      expect(screen.getByText(/Đã sao chép!/i)).toBeInTheDocument();
    });
  });

  describe('7. Task [4.36] / [S4][PB17] 3.2 – Kubernetes Resource Filters (Namespace, Deployment, Pod, Time Range)', () => {
    test('7.1. Renders Namespace, Deployment, and Pod dropdowns in filter toolbar', async () => {
      render(<LogsPage />);

      expect(screen.getByTestId('logs-namespace-select')).toBeInTheDocument();
      expect(screen.getByTestId('logs-deployment-select')).toBeInTheDocument();
      expect(screen.getByTestId('logs-pod-select')).toBeInTheDocument();
    });

    test('7.2. Changing namespace filter triggers API call and resets page to 1', async () => {
      render(<LogsPage />);

      await waitFor(() => {
        expect(telemetryService.getLogs).toHaveBeenCalled();
      });

      const nsSelect = screen.getByTestId('logs-namespace-select');
      fireEvent.change(nsSelect, { target: { value: 'production' } });

      await waitFor(() => {
        expect(telemetryService.getLogs).toHaveBeenLastCalledWith(
          expect.objectContaining({
            namespace: 'production',
            deployment: undefined,
            pod: undefined,
            page: 1,
          }),
          expect.anything()
        );
      });
    });

    test('7.3. Changing deployment filter triggers API call with deployment param', async () => {
      render(<LogsPage />);

      await waitFor(() => {
        expect(screen.getByText('order-service')).toBeInTheDocument();
      });

      const depSelect = screen.getByTestId('logs-deployment-select');
      fireEvent.change(depSelect, { target: { value: 'order-service' } });

      await waitFor(() => {
        expect(telemetryService.getLogs).toHaveBeenLastCalledWith(
          expect.objectContaining({
            deployment: 'order-service',
            pod: undefined,
            page: 1,
          }),
          expect.anything()
        );
      });
    });

    test('7.4. Changing pod filter triggers API call with pod param', async () => {
      render(<LogsPage />);

      await waitFor(() => {
        expect(screen.getByText(/order-service-7f89d-11/i)).toBeInTheDocument();
      });

      const podSelect = screen.getByTestId('logs-pod-select');
      fireEvent.change(podSelect, { target: { value: 'order-service-7f89d-11' } });

      await waitFor(() => {
        expect(telemetryService.getLogs).toHaveBeenLastCalledWith(
          expect.objectContaining({
            pod: 'order-service-7f89d-11',
            page: 1,
          }),
          expect.anything()
        );
      });
    });

    test('7.5. Cascading reset: changing namespace resets deployment and pod selection', async () => {
      render(<LogsPage />);

      await waitFor(() => {
        expect(screen.getByText('order-service')).toBeInTheDocument();
      });

      // Select deployment first
      const depSelect = screen.getByTestId('logs-deployment-select');
      fireEvent.change(depSelect, { target: { value: 'order-service' } });
      expect(depSelect.value).toBe('order-service');

      // Now change namespace -> should reset deployment to ALL
      const nsSelect = screen.getByTestId('logs-namespace-select');
      fireEvent.change(nsSelect, { target: { value: 'production' } });

      expect(nsSelect.value).toBe('production');
      expect(screen.getByTestId('logs-deployment-select').value).toBe('ALL');
      expect(screen.getByTestId('logs-pod-select').value).toBe('ALL');
    });

    test('7.6. Reset button restores Namespace, Deployment, and Pod to ALL', async () => {
      render(<LogsPage />);

      await waitFor(() => {
        expect(telemetryService.getLogs).toHaveBeenCalled();
      });

      const nsSelect = screen.getByTestId('logs-namespace-select');
      fireEvent.change(nsSelect, { target: { value: 'production' } });
      expect(nsSelect.value).toBe('production');

      const resetBtn = screen.getByTestId('logs-reset-filters-btn');
      fireEvent.click(resetBtn);

      expect(screen.getByTestId('logs-namespace-select').value).toBe('ALL');
      expect(screen.getByTestId('logs-deployment-select').value).toBe('ALL');
      expect(screen.getByTestId('logs-pod-select').value).toBe('ALL');
    });
  });

  describe('8. Task [S4][PB17] 3.3 – Real-Time SSE Log Streaming & Load Limits', () => {
    let mockUnsubscribe;
    let streamCallback;

    beforeEach(() => {
      mockUnsubscribe = jest.fn();
      telemetryService.streamLogs = jest.fn().mockImplementation((params, onEvent, onError) => {
        streamCallback = onEvent;
        return mockUnsubscribe;
      });
    });

    test('8.1. Toggling Live Stream initiates real-time SSE stream via telemetryService.streamLogs', async () => {
      render(<LogsPage />);

      const liveBtn = screen.getByTestId('logs-live-toggle');
      fireEvent.click(liveBtn);

      expect(telemetryService.streamLogs).toHaveBeenCalledWith(
        expect.objectContaining({
          tail: 20,
        }),
        expect.any(Function),
        expect.any(Function)
      );
    });

    test('8.2. Streams incoming log entries incrementally into terminal window', async () => {
      render(<LogsPage />);

      const liveBtn = screen.getByTestId('logs-live-toggle');
      fireEvent.click(liveBtn);

      expect(telemetryService.streamLogs).toHaveBeenCalled();

      // Simulate incoming live log
      act(() => {
        streamCallback('log', {
          id: 'live-stream-row-999',
          service_id: 'order-service',
          level: 'WARN',
          message: 'Realtime SSE event arrived in terminal',
          occurred_at: '2026-10-26T23:59:59.000Z',
          metadata: { service_id: 'order-service' },
        });
      });

      expect(screen.getByText(/Realtime SSE event arrived in terminal/i)).toBeInTheDocument();
    });

    test('8.3. Displays overflow notice when backpressure notification is received', async () => {
      render(<LogsPage />);

      const liveBtn = screen.getByTestId('logs-live-toggle');
      fireEvent.click(liveBtn);

      act(() => {
        streamCallback('overflow', { dropped: 15 });
      });

      expect(screen.getByTestId('logs-overflow-notice')).toBeInTheDocument();
      expect(screen.getByText(/Đã giảm tải: bỏ qua 15 log/i)).toBeInTheDocument();
    });

    test('8.4. Filter changes cancel previous stream and reconnect with updated filters', async () => {
      render(<LogsPage />);

      const liveBtn = screen.getByTestId('logs-live-toggle');
      fireEvent.click(liveBtn);

      expect(telemetryService.streamLogs).toHaveBeenCalledTimes(1);

      // Change severity filter
      const levelSelect = screen.getByTestId('logs-level-select');
      fireEvent.change(levelSelect, { target: { value: 'ERROR' } });

      // Previous stream unsubscribed and new stream initiated with ERROR
      expect(mockUnsubscribe).toHaveBeenCalled();
      expect(telemetryService.streamLogs).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'ERROR',
        }),
        expect.any(Function),
        expect.any(Function)
      );
    });

    test('8.5. Unmounting the LogsPage cancels and cleans up the active stream', async () => {
      const { unmount } = render(<LogsPage />);

      const liveBtn = screen.getByTestId('logs-live-toggle');
      fireEvent.click(liveBtn);

      unmount();

      expect(mockUnsubscribe).toHaveBeenCalled();
    });
  });
});
