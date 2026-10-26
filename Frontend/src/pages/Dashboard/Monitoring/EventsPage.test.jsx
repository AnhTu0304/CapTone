import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
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

// Mock telemetryService
jest.mock('../../../services/telemetryService', () => {
  const getKubernetesEvents = jest.fn();
  return {
    telemetryService: {
      getKubernetesEvents,
    },
    __esModule: true,
    default: {
      getKubernetesEvents,
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
});
