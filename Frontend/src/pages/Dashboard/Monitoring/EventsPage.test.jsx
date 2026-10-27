import React from 'react';
import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react';
import { EventsPage, formatEventAge } from './EventsPage';
import { telemetryService } from '../../../services/telemetryService';

// Mock Dashboard Context
const MOCK_DASHBOARD_CONTEXT = {
  currentOrg: { id: 'org-test-1', name: 'Aegis Test Org' },
  currentEnv: { id: 'env-test-1', name: 'Production Env', cluster_id: 'cluster-test-1' },
  selectedCluster: { id: 'cluster-test-1', name: 'k8s-cluster-prod' },
};

jest.mock('../context/DashboardContext', () => ({
  useDashboard: () => MOCK_DASHBOARD_CONTEXT,
}));

import {
  K8sEventSeverityBadge,
  normalizeK8sEventType,
  getK8sSeverityConfig,
} from '../../../components/dashboard/K8sEventSeverityBadge';
import {
  EventDetailModal,
  maskSensitiveData,
  formatEventDateTime,
} from '../../../components/dashboard/EventDetailModal';

// Mock clipboard
Object.assign(navigator, {
  clipboard: {
    writeText: jest.fn().mockImplementation(() => Promise.resolve()),
  },
});

// Mock telemetryService
jest.mock('../../../services/telemetryService', () => {
  const getKubernetesEvents = jest.fn();
  const getKubernetesEventById = jest.fn();
  return {
    telemetryService: {
      getKubernetesEvents,
      getKubernetesEventById,
    },
    __esModule: true,
    default: {
      getKubernetesEvents,
      getKubernetesEventById,
    },
  };
});

const MOCK_EVENTS = [
  {
    id: '1',
    cluster_id: 'cluster-test-1',
    namespace: 'production',
    resource_type: 'Pod',
    resource_uid: 'order-service-7f89d-11',
    resource_name: 'order-service-7f89d-11',
    event_type: 'Warning',
    reason: 'OOMKilled',
    message: 'Container memory limit exceeded (1024MB), killed by cgroup controller',
    source_component: 'kubelet',
    count: 3,
    first_seen_at: '2026-10-27T01:00:00.000Z',
    last_seen_at: '2026-10-27T01:05:00.000Z',
  },
  {
    id: '2',
    cluster_id: 'cluster-test-1',
    namespace: 'default',
    resource_type: 'Node',
    resource_uid: 'node-worker-01',
    resource_name: 'node-worker-01',
    event_type: 'Normal',
    reason: 'NodeReady',
    message: 'Node worker-01 status is now: NodeReady',
    source_component: 'kubelet',
    count: 1,
    first_seen_at: '2026-10-27T01:02:00.000Z',
    last_seen_at: '2026-10-27T01:02:00.000Z',
  },
];

describe('Task [S4][PB18] 4.1 – Kubernetes Events List & Filters UI Suite', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    telemetryService.getKubernetesEvents.mockResolvedValue({
      events: MOCK_EVENTS,
      pagination: { total: 2, page: 1, limit: 25, totalPages: 1 },
    });
  });

  // =========================================================================
  // 1. FORMATTER UTILITIES
  // =========================================================================
  describe('1. Formatter Utilities', () => {
    test('1.1. formatEventAge calculates human-readable relative duration', () => {
      const now = Date.now();
      assertAgeMatch(formatEventAge(new Date(now - 10 * 1000).toISOString()), 'giây trước');
      assertAgeMatch(formatEventAge(new Date(now - 5 * 60 * 1000).toISOString()), 'phút trước');
      assertAgeMatch(formatEventAge(new Date(now - 3 * 3600 * 1000).toISOString()), 'giờ trước');
      assertAgeMatch(formatEventAge(new Date(now - 2 * 86400 * 1000).toISOString()), 'ngày trước');
      expect(formatEventAge(null)).toBe('—');
      expect(formatEventAge(undefined)).toBe('—');
    });

    function assertAgeMatch(str, expectedSubstring) {
      expect(str).toContain(expectedSubstring);
    }
  });

  // =========================================================================
  // 2. RENDERING & INITIAL FETCH
  // =========================================================================
  describe('2. Rendering & Data Integration', () => {
    test('2.1. Renders header, cluster title and filter toolbar', async () => {
      await act(async () => {
        render(<EventsPage />);
      });

      expect(screen.getByText(/Dòng Sự Kiện Cụm Máy Chủ/i)).toBeInTheDocument();
      expect(screen.getByText(/k8s-cluster-prod/i)).toBeInTheDocument();
      expect(screen.getByTestId('events-search-input')).toBeInTheDocument();
      expect(screen.getByTestId('type-filter-all')).toBeInTheDocument();
      expect(screen.getByTestId('type-filter-Warning')).toBeInTheDocument();
      expect(screen.getByTestId('type-filter-Normal')).toBeInTheDocument();
    });

    test('2.2. Calls getKubernetesEvents on mount with default filters and renders rows', async () => {
      await act(async () => {
        render(<EventsPage />);
      });

      await waitFor(() => {
        expect(telemetryService.getKubernetesEvents).toHaveBeenCalledWith(
          expect.objectContaining({
            clusterId: 'cluster-test-1',
            eventType: 'all',
            namespace: 'all',
            reason: 'all',
            resourceType: 'all',
            range: '24h',
            page: 1,
            limit: 25,
          }),
          expect.any(Object)
        );
      });

      expect(screen.getByText('OOMKilled')).toBeInTheDocument();
      expect(screen.getByText('NodeReady')).toBeInTheDocument();
      expect(screen.getByText(/Node worker-01 status is now: NodeReady/i)).toBeInTheDocument();
    });

    test('2.3. Displays loading indicator while initial fetch is pending', async () => {
      telemetryService.getKubernetesEvents.mockReturnValueOnce(new Promise(() => {})); // Never resolves
      render(<EventsPage />);

      expect(screen.getByText(/Đang truy vấn sự kiện Kubernetes/i)).toBeInTheDocument();
    });

    test('2.4. Displays empty state with reset button when query returns 0 events', async () => {
      telemetryService.getKubernetesEvents.mockResolvedValueOnce({
        events: [],
        pagination: { total: 0, page: 1, limit: 25, totalPages: 1 },
      });

      await act(async () => {
        render(<EventsPage />);
      });

      await waitFor(() => {
        expect(screen.getByText(/Không tìm thấy sự kiện nào phù hợp/i)).toBeInTheDocument();
      });
      expect(screen.getByText('Đặt lại toàn bộ bộ lọc')).toBeInTheDocument();
    });

    test('2.5. Displays error banner with retry button on API failure', async () => {
      telemetryService.getKubernetesEvents.mockRejectedValueOnce(new Error('Kube-apiserver timeout'));

      await act(async () => {
        render(<EventsPage />);
      });

      await waitFor(() => {
        expect(screen.getByTestId('events-error-banner')).toBeInTheDocument();
        expect(screen.getByText('Kube-apiserver timeout')).toBeInTheDocument();
      });

      // Click retry
      telemetryService.getKubernetesEvents.mockResolvedValueOnce({
        events: MOCK_EVENTS,
        pagination: { total: 2, page: 1, limit: 25, totalPages: 1 },
      });

      await act(async () => {
        fireEvent.click(screen.getByText('Thử lại'));
      });

      await waitFor(() => {
        expect(screen.getByText('OOMKilled')).toBeInTheDocument();
      });
    });
  });

  // =========================================================================
  // 3. FILTER CONTROLS & DEBOUNCED SEARCH
  // =========================================================================
  describe('3. Filter Controls & Debounced Search', () => {
    test('3.1. Clicking Warning type button queries API with eventType=Warning and resets to page 1', async () => {
      await act(async () => {
        render(<EventsPage />);
      });

      await act(async () => {
        fireEvent.click(screen.getByTestId('type-filter-Warning'));
      });

      await waitFor(() => {
        expect(telemetryService.getKubernetesEvents).toHaveBeenLastCalledWith(
          expect.objectContaining({
            eventType: 'Warning',
            page: 1,
          }),
          expect.any(Object)
        );
      });
    });

    test('3.2. Changing namespace dropdown queries API with selected namespace', async () => {
      await act(async () => {
        render(<EventsPage />);
      });

      await act(async () => {
        fireEvent.change(screen.getByTestId('namespace-select'), {
          target: { value: 'production' },
        });
      });

      await waitFor(() => {
        expect(telemetryService.getKubernetesEvents).toHaveBeenLastCalledWith(
          expect.objectContaining({
            namespace: 'production',
            page: 1,
          }),
          expect.any(Object)
        );
      });
    });

    test('3.3. Changing reason dropdown queries API with selected reason', async () => {
      await act(async () => {
        render(<EventsPage />);
      });

      await act(async () => {
        fireEvent.change(screen.getByTestId('reason-select'), {
          target: { value: 'OOMKilled' },
        });
      });

      await waitFor(() => {
        expect(telemetryService.getKubernetesEvents).toHaveBeenLastCalledWith(
          expect.objectContaining({
            reason: 'OOMKilled',
            page: 1,
          }),
          expect.any(Object)
        );
      });
    });

    test('3.4. Changing resource type dropdown queries API with selected resourceType', async () => {
      await act(async () => {
        render(<EventsPage />);
      });

      await act(async () => {
        fireEvent.change(screen.getByTestId('resource-type-select'), {
          target: { value: 'Node' },
        });
      });

      await waitFor(() => {
        expect(telemetryService.getKubernetesEvents).toHaveBeenLastCalledWith(
          expect.objectContaining({
            resourceType: 'Node',
            page: 1,
          }),
          expect.any(Object)
        );
      });
    });

    test('3.5. Changing time range dropdown queries API with selected range', async () => {
      await act(async () => {
        render(<EventsPage />);
      });

      await act(async () => {
        fireEvent.change(screen.getByTestId('time-range-select'), {
          target: { value: '7d' },
        });
      });

      await waitFor(() => {
        expect(telemetryService.getKubernetesEvents).toHaveBeenLastCalledWith(
          expect.objectContaining({
            range: '7d',
            page: 1,
          }),
          expect.any(Object)
        );
      });
    });

    test('3.6. Typing in search input debounces by 300ms before calling API', async () => {
      jest.useFakeTimers();
      render(<EventsPage />);

      const searchInput = screen.getByTestId('events-search-input');
      act(() => {
        fireEvent.change(searchInput, { target: { value: 'CrashLoop' } });
      });

      // Not called immediately
      expect(telemetryService.getKubernetesEvents).not.toHaveBeenLastCalledWith(
        expect.objectContaining({ search: 'CrashLoop' }),
        expect.any(Object)
      );

      // Fast forward timers past 300ms debounce
      act(() => {
        jest.advanceTimersByTime(350);
      });

      expect(telemetryService.getKubernetesEvents).toHaveBeenLastCalledWith(
        expect.objectContaining({ search: 'CrashLoop', page: 1 }),
        expect.any(Object)
      );
      jest.useRealTimers();
    });

    test('3.7. Reset filters button clears all filters and restores defaults', async () => {
      await act(async () => {
        render(<EventsPage />);
      });

      // Change filters
      await act(async () => {
        fireEvent.click(screen.getByTestId('type-filter-Warning'));
        fireEvent.change(screen.getByTestId('namespace-select'), { target: { value: 'kube-system' } });
      });

      // Click reset
      await act(async () => {
        fireEvent.click(screen.getByTestId('reset-filters-btn'));
      });

      await waitFor(() => {
        expect(telemetryService.getKubernetesEvents).toHaveBeenLastCalledWith(
          expect.objectContaining({
            eventType: 'all',
            namespace: 'all',
            reason: 'all',
            resourceType: 'all',
            range: '24h',
            search: '',
            page: 1,
          }),
          expect.any(Object)
        );
      });
    });
  });

  // =========================================================================
  // 4. PAGINATION
  // =========================================================================
  describe('4. Pagination Controls', () => {
    test('4.1. Clicking next page advances page and calls API with page=2', async () => {
      telemetryService.getKubernetesEvents.mockResolvedValueOnce({
        events: MOCK_EVENTS,
        pagination: { total: 50, page: 1, limit: 25, totalPages: 2 },
      });

      await act(async () => {
        render(<EventsPage />);
      });

      await waitFor(() => {
        expect(screen.getByTestId('next-page-btn')).not.toBeDisabled();
      });

      await act(async () => {
        fireEvent.click(screen.getByTestId('next-page-btn'));
      });

      await waitFor(() => {
        expect(telemetryService.getKubernetesEvents).toHaveBeenLastCalledWith(
          expect.objectContaining({ page: 2 }),
          expect.any(Object)
        );
      });
    });

    test('4.2. Prev page button is disabled on page 1', async () => {
      await act(async () => {
        render(<EventsPage />);
      });

      expect(screen.getByTestId('prev-page-btn')).toBeDisabled();
    });

    test('4.3. Changing page size dropdown triggers reload with new limit', async () => {
      await act(async () => {
        render(<EventsPage />);
      });

      await act(async () => {
        fireEvent.change(screen.getByTestId('page-size-select'), {
          target: { value: '50' },
        });
      });

      await waitFor(() => {
        expect(telemetryService.getKubernetesEvents).toHaveBeenLastCalledWith(
          expect.objectContaining({ limit: 50, page: 1 }),
          expect.any(Object)
        );
      });
    });
  });

  // =========================================================================
  // 5. EVENT ROW DETAILS, REPETITION COUNT & MESSAGE EXPANSION
  // =========================================================================
  describe('5. Row Details, Repetition Count & Message Expansion', () => {
    test('5.1. Warning and Normal events display corresponding badge styles and icons', async () => {
      await act(async () => {
        render(<EventsPage />);
      });

      const badges = screen.getAllByTestId('event-type-badge');
      expect(badges[0]).toHaveTextContent('Warning');
      expect(badges[1]).toHaveTextContent('Normal');
    });

    test('5.2. Event with count > 1 renders repetition badge', async () => {
      await act(async () => {
        render(<EventsPage />);
      });

      expect(screen.getByTestId('event-count-badge')).toHaveTextContent('Lặp lại 3 lần');
    });

    test('5.3. Long message renders "Xem thêm" button which expands the message text', async () => {
      const longMsg = 'A'.repeat(200);
      telemetryService.getKubernetesEvents.mockResolvedValueOnce({
        events: [
          {
            ...MOCK_EVENTS[0],
            message: longMsg,
          },
        ],
        pagination: { total: 1, page: 1, limit: 25, totalPages: 1 },
      });

      await act(async () => {
        render(<EventsPage />);
      });

      expect(screen.getByText('Xem thêm')).toBeInTheDocument();

      await act(async () => {
        fireEvent.click(screen.getByText('Xem thêm'));
      });

      expect(screen.getByText('Thu gọn')).toBeInTheDocument();
    });
  });

  // =========================================================================
  // 6. RACE-CONDITION PROTECTION
  // =========================================================================
  describe('6. Race-Condition Protection', () => {
    test('6.1. Stale slower response is discarded when newer search finishes first', async () => {
      let resolveFirst;
      const slowPromise = new Promise((resolve) => {
        resolveFirst = resolve;
      });

      // First query is slow
      telemetryService.getKubernetesEvents.mockImplementationOnce(() => slowPromise);

      const { rerender } = render(<EventsPage />);

      // Second query arrives fast with different events
      const fastResult = {
        events: [
          {
            ...MOCK_EVENTS[1],
            id: 'fast-id-99',
            reason: 'FastNewResult',
          },
        ],
        pagination: { total: 1, page: 1, limit: 25, totalPages: 1 },
      };
      telemetryService.getKubernetesEvents.mockResolvedValueOnce(fastResult);

      // Trigger second query by changing filter
      await act(async () => {
        fireEvent.click(screen.getByTestId('type-filter-Normal'));
      });

      // Fast query resolves
      await waitFor(() => {
        expect(screen.getByText('FastNewResult')).toBeInTheDocument();
      });

      // Now the old slow query resolves with old events
      await act(async () => {
        resolveFirst({
          events: [
            {
              ...MOCK_EVENTS[0],
              id: 'stale-id-1',
              reason: 'StaleOldResult',
            },
          ],
          pagination: { total: 1, page: 1, limit: 25, totalPages: 1 },
        });
      });

      // Stale result must NOT overwrite the current view!
      expect(screen.queryByText('StaleOldResult')).not.toBeInTheDocument();
      expect(screen.getByText('FastNewResult')).toBeInTheDocument();
    });
  });

  // =========================================================================
  // 7. K8sEventSeverityBadge UNIT & CANONICAL MAPPING [S4][PB18] 4.3
  // =========================================================================
  describe('7. K8sEventSeverityBadge Unit & Canonical Mapping', () => {
    test('7.1. normalizeK8sEventType normalizes warning variations to Warning', () => {
      expect(normalizeK8sEventType('Warning')).toBe('Warning');
      expect(normalizeK8sEventType('WARNING')).toBe('Warning');
      expect(normalizeK8sEventType('warn')).toBe('Warning');
      expect(normalizeK8sEventType('  WARN  ')).toBe('Warning');
    });

    test('7.2. normalizeK8sEventType normalizes normal variations to Normal', () => {
      expect(normalizeK8sEventType('Normal')).toBe('Normal');
      expect(normalizeK8sEventType('NORMAL')).toBe('Normal');
      expect(normalizeK8sEventType('info')).toBe('Normal');
      expect(normalizeK8sEventType('  Normal  ')).toBe('Normal');
    });

    test('7.3. normalizeK8sEventType returns Unknown for missing, null, or unrecognized values', () => {
      expect(normalizeK8sEventType(null)).toBe('Unknown');
      expect(normalizeK8sEventType(undefined)).toBe('Unknown');
      expect(normalizeK8sEventType('')).toBe('Unknown');
      expect(normalizeK8sEventType('CriticalCustom')).toBe('Unknown');
    });

    test('7.4. SeverityBadge renders accessible text label and not color alone', () => {
      const { rerender } = render(<K8sEventSeverityBadge type="Warning" showFullLabel={true} />);
      const warningBadge = screen.getByTestId('event-severity-badge');
      expect(warningBadge).toHaveAttribute('data-severity', 'Warning');
      expect(warningBadge).toHaveAttribute('aria-label', 'Mức độ Cảnh báo (Warning)');
      expect(screen.getByText('Cảnh báo (Warning)')).toBeInTheDocument();

      rerender(<K8sEventSeverityBadge type="Normal" showFullLabel={false} />);
      const normalBadge = screen.getByTestId('event-severity-badge');
      expect(normalBadge).toHaveAttribute('data-severity', 'Normal');
      expect(screen.getByText('Normal')).toBeInTheDocument();

      rerender(<K8sEventSeverityBadge type="CustomUnknownType" showFullLabel={true} />);
      const unknownBadge = screen.getByTestId('event-severity-badge');
      expect(unknownBadge).toHaveAttribute('data-severity', 'Unknown');
      expect(screen.getByText(/Không xác định \(CustomUnknownType\)/i)).toBeInTheDocument();
    });
  });

  // =========================================================================
  // 8. EVENT DETAIL MODAL & KEY FIELDS RENDERING [S4][PB18] 4.3
  // =========================================================================
  describe('8. Event Detail Modal & Key Fields Rendering', () => {
    test('8.1. Clicking Chi tiết button on a row opens EventDetailModal', async () => {
      await act(async () => {
        render(<EventsPage />);
      });

      const detailBtn = screen.getByTestId('event-detail-btn-1');
      await act(async () => {
        fireEvent.click(detailBtn);
      });

      expect(screen.getByTestId('event-detail-modal-backdrop')).toBeInTheDocument();
      const modal = screen.getByRole('dialog');
      expect(modal).toBeInTheDocument();
      expect(within(modal).getByRole('heading', { name: /OOMKilled/i })).toBeInTheDocument();
      expect(within(modal).getByText(/Container memory limit exceeded/i)).toBeInTheDocument();
    });

    test('8.2. Displays all key fields: resource, namespace, count, timestamps, source and cluster', async () => {
      await act(async () => {
        render(<EventsPage />);
      });

      await act(async () => {
        fireEvent.click(screen.getByTestId('event-detail-btn-1'));
      });

      const modal = screen.getByRole('dialog');

      // Resource object & namespace
      expect(within(modal).getByText('Pod/order-service-7f89d-11')).toBeInTheDocument();
      expect(within(modal).getByText('production')).toBeInTheDocument();

      // Count
      expect(within(modal).getByTestId('event-detail-count')).toHaveTextContent('3 lần');

      // Source
      expect(within(modal).getByText(/Component: kubelet/i)).toBeInTheDocument();

      // Cluster & Env
      expect(within(modal).getByText(/k8s-cluster-prod/i)).toBeInTheDocument();
      expect(within(modal).getByText(/Production Env/i)).toBeInTheDocument();
    });

    test('8.3. Handles missing optional fields without crashing', async () => {
      const minimalEvent = {
        id: 'min-1',
        event_type: 'Normal',
        reason: 'MinimalReason',
        first_seen_at: '2026-10-27T01:00:00.000Z',
        last_seen_at: '2026-10-27T01:00:00.000Z',
        // Optional fields absent: resource_type, namespace, source_component, reporting_controller, message
      };

      await act(async () => {
        render(<EventDetailModal event={minimalEvent} onClose={jest.fn()} />);
      });

      const modal = screen.getByRole('dialog');
      expect(within(modal).getByRole('heading', { name: /MinimalReason/i })).toBeInTheDocument();
      expect(within(modal).getByText('default')).toBeInTheDocument(); // fallback namespace
      expect(within(modal).getByText('Không có nội dung thông điệp')).toBeInTheDocument();
    });

    test('8.4. maskSensitiveData masks tokens, passwords and bearer credentials in message', () => {
      const sensitiveText = 'DB error: password=secretPassword123 with authorization: bearer eyJhbGciOiJIUzI1NiJ9.test and api_key=superSecretKey';
      const masked = maskSensitiveData(sensitiveText);
      expect(masked).not.toContain('secretPassword123');
      expect(masked).not.toContain('superSecretKey');
      expect(masked).toContain('password=******');
      expect(masked).toContain('api_key=******');
    });

    test('8.5. Copy message and copy JSON buttons invoke clipboard writeText', async () => {
      await act(async () => {
        render(<EventDetailModal event={MOCK_EVENTS[0]} onClose={jest.fn()} />);
      });

      const copyMsgBtn = screen.getByTestId('copy-event-message-btn');
      fireEvent.click(copyMsgBtn);
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(MOCK_EVENTS[0].message);

      // Toggle raw JSON
      const toggleJsonBtn = screen.getByTestId('toggle-raw-json-btn');
      fireEvent.click(toggleJsonBtn);

      const copyJsonBtn = screen.getByTestId('copy-event-json-btn');
      fireEvent.click(copyJsonBtn);
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining(MOCK_EVENTS[0].id));
    });

    test('8.6. Closing detail modal via close button, footer close button or Escape key', async () => {
      const onCloseMock = jest.fn();
      render(<EventDetailModal event={MOCK_EVENTS[0]} onClose={onCloseMock} />);

      // 1. Close button
      fireEvent.click(screen.getByTestId('event-detail-close-btn'));
      expect(onCloseMock).toHaveBeenCalledTimes(1);

      // 2. Footer close button
      fireEvent.click(screen.getByTestId('event-detail-footer-close-btn'));
      expect(onCloseMock).toHaveBeenCalledTimes(2);

      // 3. Escape key press
      fireEvent.keyDown(window, { key: 'Escape' });
      expect(onCloseMock).toHaveBeenCalledTimes(3);
    });

    test('8.7. Handles error and retry when loading event detail by ID fails', async () => {
      telemetryService.getKubernetesEventById.mockRejectedValueOnce(new Error('Kube-apiserver unavailable'));

      await act(async () => {
        render(<EventDetailModal eventId="err-id-1" onClose={jest.fn()} />);
      });

      await waitFor(() => {
        expect(screen.getByTestId('event-detail-error')).toBeInTheDocument();
        expect(screen.getByText('Kube-apiserver unavailable')).toBeInTheDocument();
      });

      // Click retry
      telemetryService.getKubernetesEventById.mockResolvedValueOnce(MOCK_EVENTS[0]);
      await act(async () => {
        fireEvent.click(screen.getByTestId('event-detail-retry-btn'));
      });

      const modal = screen.getByRole('dialog');
      await waitFor(() => {
        expect(within(modal).getByRole('heading', { name: /OOMKilled/i })).toBeInTheDocument();
      });
    });

    test('8.8. Handles not found state when event does not exist', async () => {
      telemetryService.getKubernetesEventById.mockResolvedValueOnce(null);

      await act(async () => {
        render(<EventDetailModal eventId="missing-id-99" onClose={jest.fn()} />);
      });

      await waitFor(() => {
        expect(screen.getByTestId('event-detail-not-found')).toBeInTheDocument();
        expect(screen.getByText('Sự kiện không tồn tại')).toBeInTheDocument();
      });
    });
  });

  // =========================================================================
  // 9. FILTER INTEGRATION & DRILL-DOWN FILTERING [S4][PB18] 4.3
  // =========================================================================
  describe('9. Filter Integration & Drill-Down Filtering', () => {
    test('9.1. Opening and closing EventDetailModal preserves all active filters and pagination', async () => {
      await act(async () => {
        render(<EventsPage />);
      });

      // Change filters first
      await act(async () => {
        fireEvent.click(screen.getByTestId('type-filter-Warning'));
        fireEvent.change(screen.getByTestId('namespace-select'), { target: { value: 'production' } });
      });

      // Open detail modal
      await act(async () => {
        fireEvent.click(screen.getByTestId('event-detail-btn-1'));
      });
      expect(screen.getByTestId('event-detail-modal-backdrop')).toBeInTheDocument();

      // Close modal
      await act(async () => {
        fireEvent.click(screen.getByTestId('event-detail-close-btn'));
      });
      expect(screen.queryByTestId('event-detail-modal-backdrop')).not.toBeInTheDocument();

      // Active filters must remain intact
      expect(screen.getByTestId('namespace-select')).toHaveValue('production');
      expect(screen.getByTestId('type-filter-Warning')).toHaveStyle({ backgroundColor: '#FFFFFF' });
    });

    test('9.2. Clicking "Lọc theo namespace này" from detail modal applies filter, resets page to 1 and closes modal', async () => {
      await act(async () => {
        render(<EventsPage />);
      });

      // Open detail for event 1 (namespace: production)
      await act(async () => {
        fireEvent.click(screen.getByTestId('event-detail-btn-1'));
      });

      // Click filter by namespace
      const filterNsBtn = screen.getByTestId('filter-by-namespace-btn');
      await act(async () => {
        fireEvent.click(filterNsBtn);
      });

      // Modal closes
      expect(screen.queryByTestId('event-detail-modal-backdrop')).not.toBeInTheDocument();

      // Namespace filter updated to production
      expect(screen.getByTestId('namespace-select')).toHaveValue('production');

      // API was called with namespace=production and page=1
      await waitFor(() => {
        expect(telemetryService.getKubernetesEvents).toHaveBeenLastCalledWith(
          expect.objectContaining({
            namespace: 'production',
            page: 1,
          }),
          expect.any(Object)
        );
      });
    });

    test('9.3. Clicking "Lọc theo loại Pod" from detail modal applies resourceType filter and resets page to 1', async () => {
      await act(async () => {
        render(<EventsPage />);
      });

      // Open detail
      await act(async () => {
        fireEvent.click(screen.getByTestId('event-detail-btn-1'));
      });

      // Click filter by resource
      const filterResBtn = screen.getByTestId('filter-by-resource-btn');
      await act(async () => {
        fireEvent.click(filterResBtn);
      });

      // Modal closes
      expect(screen.queryByTestId('event-detail-modal-backdrop')).not.toBeInTheDocument();

      // Resource type filter updated to Pod
      expect(screen.getByTestId('resource-type-select')).toHaveValue('Pod');

      // API called with resourceType=Pod and page=1
      await waitFor(() => {
        expect(telemetryService.getKubernetesEvents).toHaveBeenLastCalledWith(
          expect.objectContaining({
            resourceType: 'Pod',
            page: 1,
          }),
          expect.any(Object)
        );
      });
    });

    test('9.4. Clicking "Lọc theo lý do này" from detail modal applies reason filter and resets page to 1', async () => {
      await act(async () => {
        render(<EventsPage />);
      });

      // Open detail
      await act(async () => {
        fireEvent.click(screen.getByTestId('event-detail-btn-1'));
      });

      // Click filter by reason (OOMKilled)
      const filterReasonBtn = screen.getByTestId('filter-by-reason-btn');
      await act(async () => {
        fireEvent.click(filterReasonBtn);
      });

      // Modal closes
      expect(screen.queryByTestId('event-detail-modal-backdrop')).not.toBeInTheDocument();

      // Reason filter updated to OOMKilled
      expect(screen.getByTestId('reason-select')).toHaveValue('OOMKilled');

      // API called with reason=OOMKilled and page=1
      await waitFor(() => {
        expect(telemetryService.getKubernetesEvents).toHaveBeenLastCalledWith(
          expect.objectContaining({
            reason: 'OOMKilled',
            page: 1,
          }),
          expect.any(Object)
        );
      });
    });
  });
});
