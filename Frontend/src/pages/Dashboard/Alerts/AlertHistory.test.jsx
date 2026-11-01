import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AlertsPage } from './AlertsPage';
import { alertService } from '../../../services/alertService';

let mockCurrentRole = 'SME_OWNER';

jest.mock('../context/DashboardContext', () => ({
  useDashboard: () => ({
    currentOrg: { id: '6fdcd256-3eb1-4c22-b71c-42e1217963e3', name: 'Acme Cloud Corp', role_in_org: mockCurrentRole },
    currentEnv: { id: 'c083f597-12a4-4860-9a41-c93860139808', name: 'Staging', cluster: 'k8s-pods-cluster-v2' },
    envList: [
      { id: 'c083f597-12a4-4860-9a41-c93860139808', name: 'k8s-pods-cluster-v2', cluster: 'k8s-pods-cluster-v2' },
    ],
    currentUserRole: mockCurrentRole,
  }),
}));

jest.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-test-1', email: 'owner@acme.com', role: mockCurrentRole },
    isViewer: () => mockCurrentRole === 'VIEWER',
    isDevOps: () => mockCurrentRole === 'DEVOPS',
  }),
}));

jest.mock('../../../services/alertService', () => {
  const actual = jest.requireActual('../../../services/alertService');
  return {
    ...actual,
    alertService: {
      getAlertSummary: jest.fn(),
      getAlerts: jest.fn(),
      getAlertById: jest.fn(),
      getAlertHistory: jest.fn(),
      getAlertHistorySummary: jest.fn(),
      getAlertTimeline: jest.fn(),
      acknowledgeAlert: jest.fn(),
      resolveAlert: jest.fn(),
      triggerEvaluation: jest.fn(),
      getRuleMetadata: jest.fn(),
      getAlertRules: jest.fn(),
      getAlertRuleById: jest.fn(),
      createAlertRule: jest.fn(),
      updateAlertRule: jest.fn(),
      toggleAlertRuleStatus: jest.fn(),
      deleteAlertRule: jest.fn(),
    },
  };
});

const MOCK_HISTORY_SUMMARY = {
  total_alerts: 42,
  critical_alerts: 36,
  warning_alerts: 5,
  info_alerts: 1,
  resolved_alerts: 12,
};

const MOCK_HISTORY_ITEMS = [
  {
    id: 'hist-001',
    rule_name: 'High CPU Worker Spike',
    title: 'High CPU Worker Spike',
    severity: 'CRITICAL',
    status: 'RESOLVED',
    category: 'RESOURCE',
    metric_type: 'CPU',
    resource_type: 'node',
    resource_id: 'worker-node-01',
    namespace: 'default',
    observed_value: 98.4,
    threshold_value: 85.0,
    unit: '%',
    message: 'CPU usage 98.4% exceeded 85%',
    duration_seconds: 4500,
    duration_formatted: '1h 15m',
    first_detected_at: '2026-11-01T08:00:00.000Z',
    last_seen_at: '2026-11-01T09:00:00.000Z',
    resolved_at: '2026-11-01T09:15:00.000Z',
    resolver_name: 'Alex DevOps',
    resolver_email: 'devops@test.com',
  },
  {
    id: 'hist-002',
    rule_name: 'Payment Service CrashLoopBackOff',
    title: 'Payment Service CrashLoopBackOff',
    severity: 'CRITICAL',
    status: 'ACTIVE',
    category: 'KUBERNETES',
    metric_type: 'POD_CRASH_LOOP',
    resource_type: 'pod',
    resource_id: 'payment-api-pod-x',
    namespace: 'payment',
    observed_value: 8,
    threshold_value: 4,
    unit: 'restarts',
    message: 'Pod restarted 8 times in payment namespace',
    duration_seconds: 3600,
    duration_formatted: '1h',
    first_detected_at: '2026-11-01T09:00:00.000Z',
    last_seen_at: '2026-11-01T10:00:00.000Z',
    resolved_at: null,
  },
];

const MOCK_TIMELINE = [
  {
    id: 'tl-1',
    alert_event_id: 'hist-001',
    old_status: null,
    new_status: 'ACTIVE',
    action: 'TRIGGERED',
    actor_type: 'SYSTEM',
    actor_name: null,
    note: 'Khởi phát cảnh báo: CPU usage 98.4% exceeded 85%',
    created_at: '2026-11-01T08:00:00.000Z',
  },
  {
    id: 'tl-2',
    alert_event_id: 'hist-001',
    old_status: 'ACTIVE',
    new_status: 'ACTIVE',
    action: 'ESCALATED',
    actor_type: 'SYSTEM',
    actor_name: null,
    note: 'Chuyển mức độ nghiêm trọng thành CRITICAL',
    created_at: '2026-11-01T08:15:00.000Z',
  },
  {
    id: 'tl-3',
    alert_event_id: 'hist-001',
    old_status: 'ACTIVE',
    new_status: 'RESOLVED',
    action: 'RESOLVED',
    actor_type: 'USER',
    actor_name: 'Alex DevOps',
    note: 'Đã tối ưu hóa luồng tính toán',
    created_at: '2026-11-01T09:15:00.000Z',
  },
];

describe('[S5][PBI22] Alert History UI & Timeline Integration (Task 4.1 & 4.2)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCurrentRole = 'SME_OWNER';

    alertService.getAlertSummary.mockResolvedValue({
      total_active: 2,
      total_acknowledged: 0,
      total_resolved: 1,
      by_severity: { CRITICAL: 1, WARNING: 1, INFO: 0 },
      by_category: { RESOURCE: 1, KUBERNETES: 1, APM: 0 },
    });
    alertService.getAlerts.mockResolvedValue({ items: [], pagination: { total: 0 } });
    alertService.getRuleMetadata.mockResolvedValue({ metric_types: [], operators: [], severities: [] });
    alertService.getAlertRules.mockResolvedValue({ items: [], pagination: { total: 0 } });

    alertService.getAlertHistorySummary.mockResolvedValue(MOCK_HISTORY_SUMMARY);
    alertService.getAlertHistory.mockResolvedValue({
      items: MOCK_HISTORY_ITEMS,
      pagination: { page: 1, limit: 10, total: 2, total_pages: 1 },
    });
    alertService.getAlertById.mockImplementation((id) =>
      Promise.resolve(MOCK_HISTORY_ITEMS.find((item) => item.id === id) || MOCK_HISTORY_ITEMS[0])
    );
    alertService.getAlertTimeline.mockResolvedValue(MOCK_TIMELINE);
  });

  test('1. Renders History tab button and switches to History view with summary KPIs', async () => {
    render(<AlertsPage initialTab="HISTORY" />);

    // Check tab button exists and is selected
    const historyTabBtn = screen.getByTestId('tab-alert-history');
    expect(historyTabBtn).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId('alert-history-section')).toBeInTheDocument();
      expect(screen.getByTestId('kpi-history-total')).toHaveTextContent('42');
      expect(screen.getByTestId('kpi-history-critical')).toHaveTextContent('36');
      expect(screen.getByTestId('kpi-history-warning')).toHaveTextContent('5');
      expect(screen.getByTestId('kpi-history-resolved')).toHaveTextContent('12');
    });
  });

  test('2. Displays historical alert rows with duration and resolver details', async () => {
    render(<AlertsPage initialTab="HISTORY" />);

    await waitFor(() => {
      expect(screen.getAllByTestId('history-row')).toHaveLength(2);
      expect(screen.getByText('High CPU Worker Spike')).toBeInTheDocument();
      expect(screen.getByText('Payment Service CrashLoopBackOff')).toBeInTheDocument();
      expect(screen.getByText('1h 15m')).toBeInTheDocument();
      expect(screen.getByText('Alex DevOps')).toBeInTheDocument();
    });
  });

  test('3. Filters history by severity and search keyword', async () => {
    render(<AlertsPage initialTab="HISTORY" />);

    await waitFor(() => {
      expect(screen.getByTestId('history-search-input')).toBeInTheDocument();
    });

    const searchInput = screen.getByTestId('history-search-input');
    fireEvent.change(searchInput, { target: { value: 'Payment' } });

    const severitySelect = screen.getByTestId('history-filter-severity');
    fireEvent.change(severitySelect, { target: { value: 'CRITICAL' } });

    await waitFor(() => {
      expect(alertService.getAlertHistory).toHaveBeenCalledWith(
        expect.objectContaining({
          search: 'Payment',
          severity: 'CRITICAL',
        })
      );
    });
  });

  test('4. Opens AlertDetailDrawer and renders chronological lifecycle timeline', async () => {
    render(<AlertsPage initialTab="HISTORY" />);

    await waitFor(() => {
      expect(screen.getAllByTestId('history-btn-detail')).toHaveLength(2);
    });

    // Click on Timeline button for the first row
    const detailBtns = screen.getAllByTestId('history-btn-detail');
    fireEvent.click(detailBtns[0]);

    await waitFor(() => {
      expect(screen.getByTestId('alert-detail-drawer')).toBeInTheDocument();
      expect(alertService.getAlertTimeline).toHaveBeenCalledWith('hist-001');
      expect(screen.getByTestId('detail-timeline-section')).toBeInTheDocument();
      expect(screen.getAllByTestId('timeline-item')).toHaveLength(3);
      expect(screen.getByText('TRIGGERED (ACTIVE)')).toBeInTheDocument();
      expect(screen.getByText('ESCALATED (ACTIVE)')).toBeInTheDocument();
      expect(screen.getByText('RESOLVED (RESOLVED)')).toBeInTheDocument();
    });
  });
});
