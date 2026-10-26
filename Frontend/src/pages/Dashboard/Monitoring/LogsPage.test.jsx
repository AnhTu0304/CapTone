import React from 'react';
import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react';
import { LogsPage } from './LogsPage';
import { telemetryService } from '../../../services/telemetryService';
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
});
