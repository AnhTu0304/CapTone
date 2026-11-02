import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { AlertsPage } from './AlertsPage';
import { AlertHistoryPage } from './AlertHistoryPage';
import { alertService } from '../../../services/alertService';

let mockCurrentRole = 'SME_OWNER';

jest.mock('../context/DashboardContext', () => ({
  useDashboard: () => ({
    currentOrg: {
      id: '6fdcd256-3eb1-4c22-b71c-42e1217963e3',
      name: 'Acme Cloud Corp',
      role_in_org: mockCurrentRole,
    },
    currentEnv: {
      id: 'c083f597-12a4-4860-9a41-c93860139808',
      name: 'Staging',
      cluster: 'k8s-pods-cluster-v2',
    },
    envList: [
      {
        id: 'c083f597-12a4-4860-9a41-c93860139808',
        cluster_id: 'cluster-alpha-01',
        name: 'k8s-pods-cluster-v2',
        cluster: 'k8s-pods-cluster-v2',
      },
      {
        id: 'env-prod-02',
        cluster_id: 'cluster-prod-02',
        name: 'eks-prod-ap-se1',
        cluster: 'eks-prod-ap-se1',
      },
    ],
    currentUserRole: mockCurrentRole,
  }),
}));

jest.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-owner-1', email: 'owner@acme.com', full_name: 'Owner Acme', role: mockCurrentRole },
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
      getAlertAuditTrail: jest.fn(),
      getAssignableMembers: jest.fn(),
      assignAlert: jest.fn(),
      unassignAlert: jest.fn(),
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

const MOCK_MEMBERS = [
  { id: 'user-devops-1', full_name: 'Alex DevOps', email: 'devops@acme.com', role: 'DEVOPS' },
  { id: 'user-owner-1', full_name: 'Owner Acme', email: 'owner@acme.com', role: 'SME_OWNER' },
];

const MOCK_HISTORY_SUMMARY = {
  total_alerts: 42,
  critical_alerts: 20,
  warning_alerts: 14,
  info_alerts: 8,
  active_alerts: 30,
  resolved_alerts: 12,
  acknowledged_alerts: 5,
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
    cluster_id: 'cluster-alpha-01',
    cluster_name: 'k8s-pods-cluster-v2',
    observed_value: 98.4,
    threshold_value: 85.0,
    unit: '%',
    message: 'CPU usage 98.4% exceeded 85%',
    duration_seconds: 4500,
    duration_formatted: '1h 15m',
    first_detected_at: '2026-11-01T08:00:00.000Z',
    last_seen_at: '2026-11-01T09:00:00.000Z',
    acknowledged_at: '2026-11-01T08:10:00.000Z',
    acknowledged_by: 'user-devops-1',
    acknowledger_name: 'Alex DevOps',
    assigned_to: 'user-devops-1',
    assignee_name: 'Alex DevOps',
    assignee_email: 'devops@acme.com',
    resolved_at: '2026-11-01T09:15:00.000Z',
    resolved_by: 'user-devops-1',
    resolver_name: 'Alex DevOps',
    resolver_email: 'devops@acme.com',
    resolution_note: 'Đã scale thêm worker nodes xử lý tải',
    version: 3,
  },
  {
    id: 'hist-002',
    rule_name: 'Payment Service CrashLoopBackOff',
    title: 'Payment Service CrashLoopBackOff',
    severity: 'WARNING',
    status: 'ACTIVE',
    category: 'KUBERNETES',
    metric_type: 'POD_CRASH_LOOP',
    resource_type: 'pod',
    resource_id: 'payment-api-pod-x',
    namespace: 'payment',
    cluster_id: 'cluster-prod-02',
    cluster_name: 'eks-prod-ap-se1',
    observed_value: 8,
    threshold_value: 4,
    unit: 'restarts',
    message: 'Pod restarted 8 times in payment namespace',
    duration_seconds: 3600,
    duration_formatted: '1h',
    first_detected_at: '2026-11-01T09:00:00.000Z',
    last_seen_at: '2026-11-01T10:00:00.000Z',
    assigned_to: null,
    assignee_name: null,
    resolved_at: null,
    resolution_note: null,
    version: 1,
  },
];

const MOCK_AUDIT_TRAIL = {
  items: [
    {
      id: 'tl-1',
      alert_event_id: 'hist-001',
      old_status: null,
      new_status: 'ACTIVE',
      action: 'TRIGGERED',
      actor_type: 'SYSTEM',
      actor_name: 'Rule Engine (Hệ thống)',
      note: 'Khởi phát cảnh báo: CPU usage 98.4% exceeded 85%',
      old_value: {},
      new_value: { status: 'ACTIVE', severity: 'CRITICAL' },
      created_at: '2026-11-01T08:00:00.000Z',
    },
    {
      id: 'tl-2',
      alert_event_id: 'hist-001',
      old_status: 'ACTIVE',
      new_status: 'ACTIVE',
      action: 'ASSIGNED',
      actor_type: 'USER',
      actor_name: 'Owner Acme',
      note: 'Giao cho Alex DevOps trực ca',
      old_value: { assigned_to: null, assignee_name: null },
      new_value: { assigned_to: 'user-devops-1', assignee_name: 'Alex DevOps' },
      created_at: '2026-11-01T08:05:00.000Z',
    },
    {
      id: 'tl-3',
      alert_event_id: 'hist-001',
      old_status: 'ACTIVE',
      new_status: 'ACKNOWLEDGED',
      action: 'ACKNOWLEDGED',
      actor_type: 'USER',
      actor_name: 'Alex DevOps',
      note: 'Đang kiểm tra node',
      old_value: { status: 'ACTIVE' },
      new_value: { status: 'ACKNOWLEDGED' },
      created_at: '2026-11-01T08:10:00.000Z',
    },
    {
      id: 'tl-4',
      alert_event_id: 'hist-001',
      old_status: 'ACKNOWLEDGED',
      new_status: 'RESOLVED',
      action: 'RESOLVED',
      actor_type: 'USER',
      actor_name: 'Alex DevOps',
      note: 'Đã scale thêm worker nodes xử lý tải',
      old_value: { status: 'ACKNOWLEDGED' },
      new_value: { status: 'RESOLVED', resolution_note: 'Đã scale thêm worker nodes xử lý tải' },
      created_at: '2026-11-01T09:15:00.000Z',
    },
  ],
  pagination: { page: 1, limit: 20, total: 4, total_pages: 1 },
};

describe('[S5][PBI22 Task 4.4] Alert History UI, Filters, Assignment, Resolution & Audit Trail Suite', () => {
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
    alertService.getAlertAuditTrail.mockResolvedValue(MOCK_AUDIT_TRAIL);
    alertService.getAlertTimeline.mockResolvedValue(MOCK_AUDIT_TRAIL.items);
    alertService.getAssignableMembers.mockResolvedValue(MOCK_MEMBERS);
  });

  // 1 & 2: Summary cards (all 6) + Table columns render cleanly without raw undefined/null
  test('1-2. Renders all 6 Summary KPI cards and full Alert History table columns without undefined/null', async () => {
    render(<AlertsPage initialTab="HISTORY" />);

    await waitFor(() => {
      expect(screen.getByTestId('alert-history-section')).toBeInTheDocument();
      expect(screen.getByTestId('kpi-history-total')).toHaveTextContent('42');
      expect(screen.getByTestId('kpi-history-critical')).toHaveTextContent('20');
      expect(screen.getByTestId('kpi-history-warning')).toHaveTextContent('14');
      expect(screen.getByTestId('kpi-history-info')).toHaveTextContent('8');
      expect(screen.getByTestId('kpi-history-active')).toHaveTextContent('30');
      expect(screen.getByTestId('kpi-history-resolved')).toHaveTextContent('12');
    });

    const rows = screen.getAllByTestId('history-row');
    expect(rows).toHaveLength(2);
    const tableContainer = screen.getByTestId('history-table-container');
    expect(within(tableContainer).getByText('High CPU Worker Spike')).toBeInTheDocument();
    expect(within(tableContainer).getByText('k8s-pods-cluster-v2')).toBeInTheDocument();
    expect(within(tableContainer).getByText('eks-prod-ap-se1')).toBeInTheDocument();
    expect(screen.getByTestId('history-assignee-hist-001')).toHaveTextContent('Alex DevOps');
    expect(screen.getByTestId('history-assignee-hist-002')).toHaveTextContent('Chưa phân công');

    const tableText = screen.getByTestId('history-table-container').textContent;
    expect(tableText).not.toContain('undefined');
    expect(tableText).not.toContain('null');
  });

  // 3, 4, 5: Search, Severity filter, Status filter
  test('3-5. Filters history by debounced search, severity, and status', async () => {
    render(<AlertsPage initialTab="HISTORY" />);

    await waitFor(() => expect(screen.getByTestId('history-search-input')).toBeInTheDocument());

    fireEvent.change(screen.getByTestId('history-search-input'), { target: { value: 'payment' } });
    fireEvent.change(screen.getByTestId('history-filter-severity'), { target: { value: 'WARNING' } });
    fireEvent.change(screen.getByTestId('history-filter-status'), { target: { value: 'ACTIVE' } });

    await waitFor(() => {
      expect(alertService.getAlertHistory).toHaveBeenCalledWith(
        expect.objectContaining({
          search: 'payment',
          severity: 'WARNING',
          status: 'ACTIVE',
          page: 1,
        })
      );
    });
  });

  // 6: Time range presets (24h, 7d, 30d) + Custom date range + invalid startDate > endDate validation
  test('6. Supports 24h, 7d, 30d time presets and validates custom startDate <= endDate before API call', async () => {
    render(<AlertsPage initialTab="HISTORY" />);

    await waitFor(() => expect(screen.getByTestId('history-filter-time')).toBeInTheDocument());

    const timeSelect = screen.getByTestId('history-filter-time');
    expect(within(timeSelect).getByRole('option', { name: /24 giờ qua/i })).toBeInTheDocument();
    expect(within(timeSelect).getByRole('option', { name: /7 ngày qua/i })).toBeInTheDocument();
    expect(within(timeSelect).getByRole('option', { name: /30 ngày qua/i })).toBeInTheDocument();

    fireEvent.change(timeSelect, { target: { value: '30d' } });
    await waitFor(() => {
      expect(alertService.getAlertHistory).toHaveBeenLastCalledWith(
        expect.objectContaining({ startDate: expect.any(String) })
      );
    });

    // Switch to CUSTOM and enter startDate > endDate
    fireEvent.change(timeSelect, { target: { value: 'CUSTOM' } });
    const callCountBeforeInvalid = alertService.getAlertHistory.mock.calls.length;

    fireEvent.change(screen.getByTestId('history-start-date'), {
      target: { value: '2026-11-05T10:00' },
    });
    fireEvent.change(screen.getByTestId('history-end-date'), {
      target: { value: '2026-11-01T10:00' },
    });

    await waitFor(() => {
      expect(screen.getByTestId('history-date-validation-error')).toBeInTheDocument();
    });
    // Should not call getAlertHistory with startDate > endDate
    const invalidCalls = alertService.getAlertHistory.mock.calls
      .slice(callCountBeforeInvalid)
      .filter(([arg]) => arg?.startDate && arg?.endDate && new Date(arg.startDate) > new Date(arg.endDate));
    expect(invalidCalls).toHaveLength(0);
  });

  // 7 & 8: Combined filters (with Cluster) + Stale response guard + Clear filters
  test('7-8. Applies combined filters including Cluster, ignores stale responses, and resets all via Clear Filters', async () => {
    let resolveSlowCall;
    render(<AlertsPage initialTab="HISTORY" />);
    await waitFor(() => expect(screen.getByTestId('history-filter-cluster')).toBeInTheDocument());

    // First filter triggers slow response
    alertService.getAlertHistory.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveSlowCall = resolve;
        })
    );
    fireEvent.change(screen.getByTestId('history-filter-cluster'), {
      target: { value: 'cluster-alpha-01' },
    });

    // Immediate second filter triggers fast response with only hist-002
    alertService.getAlertHistory.mockResolvedValueOnce({
      items: [MOCK_HISTORY_ITEMS[1]],
      pagination: { page: 1, limit: 10, total: 1, total_pages: 1 },
    });
    fireEvent.change(screen.getByTestId('history-filter-cluster'), {
      target: { value: 'cluster-prod-02' },
    });

    await waitFor(() => {
      expect(screen.getAllByTestId('history-row')).toHaveLength(1);
      expect(screen.getByText('Payment Service CrashLoopBackOff')).toBeInTheDocument();
    });

    // Resolve stale first call AFTER second call completed — UI must NOT overwrite with stale hist-001
    resolveSlowCall({
      items: [MOCK_HISTORY_ITEMS[0]],
      pagination: { page: 1, limit: 10, total: 1, total_pages: 1 },
    });

    await waitFor(() => {
      expect(screen.queryByText('High CPU Worker Spike')).not.toBeInTheDocument();
      expect(screen.getByText('Payment Service CrashLoopBackOff')).toBeInTheDocument();
    });

    // Clear filters
    fireEvent.click(screen.getByTestId('history-btn-clear-filters'));
    await waitFor(() => {
      expect(screen.getByTestId('history-filter-cluster').value).toBe('ALL');
      expect(alertService.getAlertHistory).toHaveBeenLastCalledWith(
        expect.objectContaining({
          clusterId: undefined,
          severity: undefined,
          status: undefined,
          page: 1,
        })
      );
    });
  });

  // 9 & 10: Server-side Pagination & Sorting
  test('9-10. Supports server-side pagination (normalizing totalPages) and server-side sorting', async () => {
    alertService.getAlertHistory.mockResolvedValue({
      items: MOCK_HISTORY_ITEMS,
      pagination: { page: 1, limit: 10, total: 25, totalPages: 3 },
    });

    render(<AlertsPage initialTab="HISTORY" />);

    await waitFor(() => {
      expect(screen.getByTestId('history-btn-next-page')).not.toBeDisabled();
    });

    // Change sortBy and sortOrder
    fireEvent.change(screen.getByTestId('history-sort-by'), { target: { value: 'resolved_at' } });
    fireEvent.change(screen.getByTestId('history-sort-order'), { target: { value: 'asc' } });

    await waitFor(() => {
      expect(alertService.getAlertHistory).toHaveBeenCalledWith(
        expect.objectContaining({
          sortBy: 'resolved_at',
          sortOrder: 'asc',
          page: 1,
        })
      );
    });

    // Click Next Page and verify sort parameters are preserved
    fireEvent.click(screen.getByTestId('history-btn-next-page'));
    await waitFor(() => {
      expect(alertService.getAlertHistory).toHaveBeenCalledWith(
        expect.objectContaining({
          sortBy: 'resolved_at',
          sortOrder: 'asc',
          page: 2,
        })
      );
    });
  });

  // 11 & 12: Alert Detail Drawer fields + Audit Timeline with diffs
  test('11-12. Opens AlertDetailDrawer showing assignment/resolution metadata and full Audit Timeline', async () => {
    render(<AlertsPage initialTab="HISTORY" />);

    await waitFor(() => expect(screen.getAllByTestId('history-btn-detail')).toHaveLength(2));
    fireEvent.click(screen.getAllByTestId('history-btn-detail')[0]);

    await waitFor(() => {
      expect(screen.getByTestId('alert-detail-drawer')).toBeInTheDocument();
      expect(alertService.getAlertAuditTrail).toHaveBeenCalledWith('hist-001', expect.any(Object));
      expect(screen.getByTestId('detail-assigned-to')).toHaveTextContent('Alex DevOps');
      expect(screen.getByTestId('detail-acknowledged-by')).toHaveTextContent('Alex DevOps');
      expect(screen.getByTestId('detail-resolved-by')).toHaveTextContent('Alex DevOps');
      expect(screen.getByTestId('detail-resolution-note')).toHaveTextContent(
        'Đã scale thêm worker nodes xử lý tải'
      );
      expect(screen.getAllByTestId('timeline-item')).toHaveLength(4);
      expect(screen.getByText(/ASSIGNED/)).toBeInTheDocument();
      expect(screen.getByText('Giao cho Alex DevOps trực ca')).toBeInTheDocument();
    });
  });

  // 13 & 14: Assign, Reassign (with confirmation), and Unassign in Detail Drawer
  test('13-14. Assigns member, prompts confirmation on Reassign, and supports Unassign', async () => {
    // Open unassigned hist-002 first
    alertService.assignAlert.mockResolvedValueOnce({
      ...MOCK_HISTORY_ITEMS[1],
      assigned_to: 'user-devops-1',
      assignee_name: 'Alex DevOps',
      version: 2,
    });

    render(<AlertsPage initialTab="HISTORY" />);
    await waitFor(() => expect(screen.getAllByTestId('history-btn-detail')).toHaveLength(2));
    fireEvent.click(screen.getAllByTestId('history-btn-detail')[1]);

    await waitFor(() => {
      expect(alertService.getAssignableMembers).toHaveBeenCalledWith('6fdcd256-3eb1-4c22-b71c-42e1217963e3');
      expect(screen.getByTestId('assign-member-select')).toBeInTheDocument();
    });

    // Search member & assign
    fireEvent.change(screen.getByTestId('assign-member-search'), { target: { value: 'Alex' } });
    fireEvent.change(screen.getByTestId('assign-member-select'), { target: { value: 'user-devops-1' } });
    fireEvent.click(screen.getByTestId('btn-submit-assign'));

    await waitFor(() => {
      expect(alertService.assignAlert).toHaveBeenCalledWith('hist-002', {
        assignedTo: 'user-devops-1',
        note: '',
        expectedVersion: 1,
      });
      expect(screen.getByTestId('detail-assigned-to')).toHaveTextContent('Alex DevOps');
    });

    // Now alert is assigned to user-devops-1 (version 2). Selecting user-owner-1 should require Reassign confirmation
    fireEvent.change(screen.getByTestId('assign-member-search'), { target: { value: '' } });
    fireEvent.change(screen.getByTestId('assign-member-select'), { target: { value: 'user-owner-1' } });
    fireEvent.click(screen.getByTestId('btn-submit-assign'));

    await waitFor(() => {
      expect(screen.getByTestId('reassign-confirm-box')).toBeInTheDocument();
    });

    alertService.assignAlert.mockResolvedValueOnce({
      ...MOCK_HISTORY_ITEMS[1],
      assigned_to: 'user-owner-1',
      assignee_name: 'Owner Acme',
      version: 3,
    });
    fireEvent.click(screen.getByTestId('btn-confirm-reassign'));

    await waitFor(() => {
      expect(alertService.assignAlert).toHaveBeenLastCalledWith('hist-002', {
        assignedTo: 'user-owner-1',
        note: '',
        expectedVersion: 2,
      });
      expect(screen.getByTestId('detail-assigned-to')).toHaveTextContent('Owner Acme');
    });

    // Unassign
    alertService.unassignAlert.mockResolvedValueOnce({
      ...MOCK_HISTORY_ITEMS[1],
      assigned_to: null,
      assignee_name: null,
      version: 4,
    });
    fireEvent.click(screen.getByTestId('btn-unassign-alert'));

    await waitFor(() => {
      expect(alertService.unassignAlert).toHaveBeenCalledWith('hist-002', { expectedVersion: 3 });
      expect(screen.getByTestId('detail-assigned-to')).toHaveTextContent('Chưa phân công');
    });
  });

  // 15, 16, 17: Acknowledge + Mark as Resolved Confirmation Dialog + Resolution Note validation + Duplicate click guard
  test('15-17. Acknowledges alert and resolves via Confirmation Modal with note validation and no optimistic mutation before API confirms', async () => {
    alertService.acknowledgeAlert.mockResolvedValueOnce({
      ...MOCK_HISTORY_ITEMS[1],
      status: 'ACKNOWLEDGED',
      acknowledged_by: 'user-owner-1',
      acknowledger_name: 'Owner Acme',
      version: 2,
    });

    render(<AlertsPage initialTab="HISTORY" />);
    await waitFor(() => expect(screen.getByTestId('history-btn-ack-hist-002')).toBeInTheDocument());

    // RESOLVED alert hist-001 must NOT render quick Ack or Resolve buttons
    expect(screen.queryByTestId('history-btn-resolve-hist-001')).not.toBeInTheDocument();

    // Quick Acknowledge on hist-002
    fireEvent.click(screen.getByTestId('history-btn-ack-hist-002'));
    await waitFor(() => {
      expect(alertService.acknowledgeAlert).toHaveBeenCalledWith('hist-002', expect.any(String), 1);
    });

    // Open Mark as Resolved Confirmation Modal from History table row
    fireEvent.click(screen.getByTestId('history-btn-resolve-hist-002'));
    await waitFor(() => {
      expect(screen.getByTestId('resolve-confirm-modal')).toBeInTheDocument();
    });

    // Validate > 2000 chars rejected client-side
    fireEvent.change(screen.getByTestId('resolve-modal-note-input'), {
      target: { value: 'x'.repeat(2005) },
    });
    fireEvent.click(screen.getByTestId('btn-confirm-resolve-submit'));
    expect(screen.getByTestId('resolve-note-error')).toBeInTheDocument();
    expect(alertService.resolveAlert).not.toHaveBeenCalled();

    // Valid resolution note with deferred promise to verify duplicate click guard
    let finishResolve;
    alertService.resolveAlert.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishResolve = resolve;
        })
    );

    fireEvent.change(screen.getByTestId('resolve-modal-note-input'), {
      target: { value: 'Đã khởi động lại pod và tăng memory limit' },
    });
    const confirmBtn = screen.getByTestId('btn-confirm-resolve-submit');
    fireEvent.click(confirmBtn);
    fireEvent.click(confirmBtn); // second click while in-flight must be blocked

    expect(alertService.resolveAlert).toHaveBeenCalledTimes(1);
    expect(confirmBtn).toBeDisabled();

    finishResolve({
      ...MOCK_HISTORY_ITEMS[1],
      status: 'RESOLVED',
      resolved_by: 'user-owner-1',
      resolver_name: 'Owner Acme',
      resolution_note: 'Đã khởi động lại pod và tăng memory limit',
      resolved_at: '2026-11-01T10:30:00.000Z',
      version: 3,
    });

    await waitFor(() => {
      expect(screen.queryByTestId('resolve-confirm-modal')).not.toBeInTheDocument();
      expect(alertService.getAlertHistory).toHaveBeenCalled();
      expect(alertService.getAlertHistorySummary).toHaveBeenCalled();
    });
  });

  // 18, 19, 20: Loading, Empty, and Error states (History + Audit Timeline)
  test('18-20. Handles Loading, Empty, and Error + Retry states for both History table and Audit Timeline', async () => {
    // 1. Error state then Retry -> Empty state
    alertService.getAlertHistory.mockRejectedValueOnce(new Error('Lỗi máy chủ 500'));
    render(<AlertsPage initialTab="HISTORY" />);

    await waitFor(() => {
      expect(screen.getByTestId('history-error-state')).toHaveTextContent('Lỗi máy chủ 500');
    });

    alertService.getAlertHistory.mockResolvedValueOnce({
      items: [],
      pagination: { page: 1, limit: 10, total: 0, total_pages: 1 },
    });
    fireEvent.click(screen.getByTestId('history-btn-retry'));

    await waitFor(() => {
      expect(screen.getByTestId('history-empty-state')).toBeInTheDocument();
    });

    // 2. Audit Timeline error -> retry -> empty
    alertService.getAlertHistory.mockResolvedValueOnce({
      items: MOCK_HISTORY_ITEMS,
      pagination: { page: 1, limit: 10, total: 2, total_pages: 1 },
    });
    fireEvent.click(screen.getByTestId('history-btn-clear-filters'));

    // Force refresh
    fireEvent.click(screen.getByTestId('btn-refresh-alerts'));
    await waitFor(() => expect(screen.getAllByTestId('history-btn-detail')).toHaveLength(2));

    alertService.getAlertAuditTrail.mockRejectedValueOnce(new Error('Không thể tải Audit Trail'));
    fireEvent.click(screen.getAllByTestId('history-btn-detail')[1]);

    await waitFor(() => {
      expect(screen.getByTestId('timeline-error-state')).toBeInTheDocument();
    });

    alertService.getAlertAuditTrail.mockResolvedValueOnce({ items: [], pagination: { total: 0 } });
    fireEvent.click(screen.getByTestId('timeline-btn-retry'));

    await waitFor(() => {
      expect(screen.getByTestId('timeline-empty-state')).toBeInTheDocument();
    });
  });

  // 21 & 22: HTTP 403 Forbidden & HTTP 409 Conflict handling
  test('21-22. Displays clear user-friendly errors on HTTP 403 Forbidden and HTTP 409 Conflict', async () => {
    render(<AlertsPage initialTab="HISTORY" />);
    await waitFor(() => expect(screen.getByTestId('history-btn-resolve-hist-002')).toBeInTheDocument());

    // Open Resolve modal and simulate 409 Conflict
    fireEvent.click(screen.getByTestId('history-btn-resolve-hist-002'));
    const conflictErr = new Error('Sự kiện cảnh báo này đã được giải quyết trước đó');
    conflictErr.status = 409;
    alertService.resolveAlert.mockRejectedValueOnce(conflictErr);

    fireEvent.click(screen.getByTestId('btn-confirm-resolve-submit'));
    await waitFor(() => {
      expect(screen.getByTestId('resolve-modal-error')).toHaveTextContent(/409|trước đó|thay đổi/i);
    });

    // Simulate 403 Forbidden
    const forbiddenErr = new Error('Forbidden');
    forbiddenErr.status = 403;
    alertService.resolveAlert.mockRejectedValueOnce(forbiddenErr);

    fireEvent.click(screen.getByTestId('btn-confirm-resolve-submit'));
    await waitFor(() => {
      expect(screen.getByTestId('resolve-modal-error')).toHaveTextContent(/quyền|403/i);
    });
  });

  // 23 & 24: Viewer RBAC read-only + Responsive table container
  test('23-24. Enforces VIEWER read-only RBAC across table & drawer and preserves responsive scroll container', async () => {
    mockCurrentRole = 'VIEWER';
    render(<AlertsPage initialTab="HISTORY" />);

    await waitFor(() => {
      expect(screen.getAllByTestId('history-row')).toHaveLength(2);
    });

    // Responsive scroll container exists
    const scrollWrap = screen.getByTestId('history-table-scroll');
    expect(scrollWrap).toHaveStyle({ overflowX: 'auto' });

    // VIEWER cannot see quick Acknowledge or Resolve buttons in table
    expect(screen.queryByTestId('history-btn-ack-hist-002')).not.toBeInTheDocument();
    expect(screen.queryByTestId('history-btn-resolve-hist-002')).not.toBeInTheDocument();

    // VIEWER CAN open Detail Drawer & view Audit Timeline, but operations/assignment controls are hidden
    fireEvent.click(screen.getAllByTestId('history-btn-detail')[1]);
    await waitFor(() => {
      expect(screen.getByTestId('alert-detail-drawer')).toBeInTheDocument();
      expect(screen.getByTestId('detail-timeline-section')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('detail-operations-panel')).not.toBeInTheDocument();
    expect(screen.queryByTestId('assign-member-select')).not.toBeInTheDocument();
  });
  // 25: Dedicated standalone AlertHistoryPage without shared layout (no active summary cards, no tabs)
  test('25. Standalone AlertHistoryPage renders dedicated header, skips shared layout/tabs, and navigates back', async () => {
    const mockNavigate = jest.fn();
    render(<AlertHistoryPage onNavigate={mockNavigate} />);

    await waitFor(() => {
      expect(screen.getByTestId('alert-history-page')).toBeInTheDocument();
      expect(screen.getByTestId('alert-history-section')).toBeInTheDocument();
    });

    // Dedicated header
    expect(screen.getByText('Lịch Sử Cảnh Báo & Nhật Ký Kiểm Toán (Alert History)')).toBeInTheDocument();

    // Verify shared layout elements are NOT rendered on standalone page
    expect(screen.queryByTestId('alert-summary-cards')).not.toBeInTheDocument();
    expect(screen.queryByTestId('tab-alert-events')).not.toBeInTheDocument();
    expect(screen.queryByTestId('tab-alert-rules')).not.toBeInTheDocument();
    expect(screen.queryByTestId('btn-evaluate-rules')).not.toBeInTheDocument();
    expect(screen.queryByTestId('btn-open-create-rule-modal')).not.toBeInTheDocument();

    // Quick navigation back to active alerts
    const backBtn = screen.getByTestId('btn-goto-rules');
    expect(backBtn).toBeInTheDocument();
    fireEvent.click(backBtn);
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard/alerts');
  });

  // 26: AlertsPage tabs verification: exactly 2 tabs (EVENTS & RULES), completely excluding tab-alert-history
  test('26. AlertsPage renders exactly 2 tabs (EVENTS and RULES) and does NOT contain tab-alert-history', async () => {
    render(<AlertsPage initialTab="EVENTS" />);

    await waitFor(() => {
      expect(screen.getByTestId('tab-alert-events')).toBeInTheDocument();
      expect(screen.getByTestId('tab-alert-rules')).toBeInTheDocument();
    });

    // Verify tab-alert-history is completely removed from AlertsPage layout
    expect(screen.queryByTestId('tab-alert-history')).not.toBeInTheDocument();
  });
});