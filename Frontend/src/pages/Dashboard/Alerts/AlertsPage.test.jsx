import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { AlertsPage } from './AlertsPage';
import { validateAlertRuleForm } from './AlertRuleModal';
import { alertService, DEFAULT_RULE_METADATA } from '../../../services/alertService';

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

const MOCK_SUMMARY = {
  total_active: 3,
  total_acknowledged: 1,
  total_resolved: 2,
  by_severity: { CRITICAL: 2, WARNING: 1, INFO: 0 },
  by_category: { RESOURCE: 1, KUBERNETES: 1, APM: 1 },
};

const MOCK_ALERTS = [
  {
    id: 'alert-cpu-001',
    organization_id: '6fdcd256-3eb1-4c22-b71c-42e1217963e3',
    organization_name: 'Acme Cloud Corp',
    cluster_id: 'c083f597-12a4-4860-9a41-c93860139808',
    cluster_name: 'k8s-pods-cluster-v2',
    rule_id: 'rule-cpu-001',
    rule_name: 'Demo Rule - High CPU Usage',
    rule_description: 'Canh bao khi CPU tren node vuot 85% trong 60 giay',
    rule_operator: 'GREATER_THAN',
    category: 'RESOURCE',
    metric_type: 'CPU',
    resource_type: 'node',
    resource_id: 'worker-node-01',
    severity: 'WARNING',
    status: 'ACTIVE',
    observed_value: 96.1,
    threshold_value: 85,
    unit: '%',
    occurrence_count: 2,
    message: "Máy chủ 'worker-node-01' vượt ngưỡng CPU: giá trị đo 96.1 % (> 85 %)",
    first_detected_at: '2026-11-01T08:00:00.000Z',
    last_seen_at: '2026-11-01T08:05:00.000Z',
    resolved_at: null,
    details: { node_name: 'worker-node-01', operator: 'GREATER_THAN' },
  },
  {
    id: 'alert-k8s-001',
    organization_id: '6fdcd256-3eb1-4c22-b71c-42e1217963e3',
    organization_name: 'Acme Cloud Corp',
    cluster_id: 'c083f597-12a4-4860-9a41-c93860139808',
    cluster_name: 'k8s-pods-cluster-v2',
    rule_id: 'rule-k8s-001',
    rule_name: 'Demo Rule - Pod CrashLoopBackOff',
    rule_operator: 'GREATER_THAN_OR_EQUAL',
    category: 'KUBERNETES',
    metric_type: 'POD_CRASH_LOOP',
    resource_type: 'pod',
    resource_id: 'orders-api-7d9c8b6f4-x9k2m',
    severity: 'CRITICAL',
    status: 'ACTIVE',
    observed_value: 6,
    threshold_value: 4,
    unit: 'restarts',
    occurrence_count: 1,
    message: "Pod 'orders-api-7d9c8b6f4-x9k2m' rơi vào trạng thái CrashLoopBackOff",
    first_detected_at: '2026-11-01T08:01:00.000Z',
    last_seen_at: '2026-11-01T08:06:00.000Z',
    resolved_at: null,
    details: { namespace: 'production', pod_status: 'CrashLoopBackOff' },
  },
  {
    id: 'alert-apm-001',
    organization_id: '6fdcd256-3eb1-4c22-b71c-42e1217963e3',
    organization_name: 'Acme Cloud Corp',
    cluster_id: 'c083f597-12a4-4860-9a41-c93860139808',
    cluster_name: 'k8s-pods-cluster-v2',
    rule_id: 'rule-apm-001',
    rule_name: 'Demo Rule - High APM 5xx Error Rate',
    rule_operator: 'GREATER_THAN',
    category: 'APM',
    metric_type: 'HTTP_5XX_RATE',
    resource_type: 'service',
    resource_id: 'checkout-service',
    severity: 'CRITICAL',
    status: 'ACTIVE',
    observed_value: 11.2,
    threshold_value: 5,
    unit: '%',
    occurrence_count: 3,
    message: "Dịch vụ 'checkout-service' gặp bất thường về APM (HTTP_5XX_RATE): đo được 11.2 %",
    first_detected_at: '2026-11-01T08:02:00.000Z',
    last_seen_at: '2026-11-01T08:07:00.000Z',
    resolved_at: null,
    details: { service_id: 'checkout-service' },
  },
];

const MOCK_RULES = [
  {
    id: 'rule-cpu-001',
    name: 'Demo Rule - High CPU Usage',
    description: 'Canh bao khi CPU tren node vuot 85% trong 60 giay',
    metric_type: 'CPU',
    operator: 'GREATER_THAN',
    threshold_value: 85,
    unit: '%',
    severity: 'WARNING',
    evaluation_window: '5m',
    duration: 60,
    cooldown_seconds: 300,
    enabled: true,
  },
];

describe('[S5][PBI21] Task 3.4 – Alert Dashboard, Detail Drawer & Rule Configuration UI Suite', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCurrentRole = 'SME_OWNER';
    localStorage.clear();

    alertService.getAlertSummary.mockResolvedValue(MOCK_SUMMARY);
    alertService.getAlerts.mockResolvedValue({
      items: MOCK_ALERTS,
      pagination: { page: 1, limit: 10, total: 3, total_pages: 1 },
    });
    alertService.getAlertById.mockImplementation(async (id) =>
      MOCK_ALERTS.find((a) => a.id === id) || MOCK_ALERTS[0]
    );
    alertService.getRuleMetadata.mockResolvedValue(DEFAULT_RULE_METADATA);
    alertService.getAlertRules.mockResolvedValue({
      items: MOCK_RULES,
      pagination: { page: 1, limit: 100, total: 1, total_pages: 1 },
    });
  });

  test('1. Hiển thị 5 Summary Cards và bảng danh sách 3 cảnh báo (CPU, K8s CrashLoop, APM 5xx) với đúng Severity & Status badges', async () => {
    await act(async () => {
      render(<AlertsPage />);
    });

    expect(screen.getByTestId('summary-value-active')).toHaveTextContent('3');
    expect(screen.getByTestId('summary-value-critical')).toHaveTextContent('2');
    expect(screen.getByTestId('summary-value-warning')).toHaveTextContent('1');
    expect(screen.getByTestId('summary-value-info')).toHaveTextContent('0');
    expect(screen.getByTestId('summary-value-resolved')).toHaveTextContent('2');

    expect(screen.getByTestId('alert-row-alert-cpu-001')).toBeInTheDocument();
    expect(screen.getByTestId('alert-row-alert-k8s-001')).toBeInTheDocument();
    expect(screen.getByTestId('alert-row-alert-apm-001')).toBeInTheDocument();

    expect(screen.getByTestId('badge-severity-alert-cpu-001')).toHaveTextContent('WARNING');
    expect(screen.getByTestId('badge-severity-alert-k8s-001')).toHaveTextContent('CRITICAL');
    expect(screen.getByTestId('badge-status-alert-apm-001')).toHaveTextContent('ACTIVE');
  });

  test('2. Bộ lọc Server-side (Severity, Status, Resource Type, Time Range) và Pagination gửi đúng query params tới Backend', async () => {
    alertService.getAlerts.mockResolvedValue({
      items: MOCK_ALERTS,
      pagination: { page: 1, limit: 10, total: 25, total_pages: 3 },
    });

    await act(async () => {
      render(<AlertsPage />);
    });

    await act(async () => {
      fireEvent.change(screen.getByTestId('filter-severity-select'), { target: { value: 'CRITICAL' } });
    });

    expect(alertService.getAlerts).toHaveBeenLastCalledWith(
      expect.objectContaining({ severity: 'CRITICAL', page: 1 })
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId('btn-next-page'));
    });

    expect(alertService.getAlerts).toHaveBeenLastCalledWith(
      expect.objectContaining({ severity: 'CRITICAL', page: 2 })
    );
  });

  test('3. Mở Alert Detail Drawer hiển thị đầy đủ Metadata và cho phép Acknowledge & Resolve sự kiện', async () => {
    alertService.acknowledgeAlert.mockResolvedValue({
      ...MOCK_ALERTS[1],
      status: 'ACKNOWLEDGED',
      acknowledged_at: '2026-11-01T08:10:00.000Z',
    });
    alertService.resolveAlert.mockResolvedValue({
      ...MOCK_ALERTS[1],
      status: 'RESOLVED',
      resolved_at: '2026-11-01T08:12:00.000Z',
    });

    await act(async () => {
      render(<AlertsPage />);
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('alert-row-alert-k8s-001'));
    });

    expect(screen.getByTestId('alert-detail-drawer')).toBeInTheDocument();
    expect(screen.getByTestId('detail-alert-id')).toHaveTextContent('alert-k8s-001');
    expect(screen.getByTestId('detail-organization')).toHaveTextContent('Acme Cloud Corp');
    expect(screen.getByTestId('detail-cluster')).toHaveTextContent('k8s-pods-cluster-v2');
    expect(screen.getByTestId('detail-namespace')).toHaveTextContent('production');
    expect(screen.getByTestId('detail-resource-name')).toHaveTextContent('orders-api-7d9c8b6f4-x9k2m');

    // Acknowledge
    fireEvent.change(screen.getByTestId('input-acknowledge-note'), {
      target: { value: 'Đang kiểm tra pod orders-api' },
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('btn-acknowledge-alert'));
    });

    expect(alertService.acknowledgeAlert).toHaveBeenCalledWith(
      'alert-k8s-001',
      'Đang kiểm tra pod orders-api'
    );
    expect(screen.getByTestId('detail-status-badge')).toHaveTextContent('ACKNOWLEDGED');

    // Resolve
    fireEvent.change(screen.getByTestId('input-resolve-note'), {
      target: { value: 'Đã tăng giới hạn bộ nhớ container' },
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('btn-resolve-alert'));
    });

    expect(alertService.resolveAlert).toHaveBeenCalledWith(
      'alert-k8s-001',
      'Đã tăng giới hạn bộ nhớ container'
    );
    expect(screen.getByTestId('detail-status-badge')).toHaveTextContent('RESOLVED');
  });

  test('4. Tạo mới, chỉnh sửa, bật/tắt Alert Rule và kiểm tra Validation form phía Client', async () => {
    // Kiểm tra hàm validateAlertRuleForm
    const badPct = validateAlertRuleForm({
      name: 'A',
      metric_type: 'CPU',
      operator: 'GREATER_THAN',
      threshold_value: '150',
      unit: '%',
      evaluation_window: 'invalid',
      duration: '-5',
      cooldown_seconds: '-1',
    });
    expect(badPct.isValid).toBe(false);
    expect(badPct.errors.name).toBeDefined();
    expect(badPct.errors.threshold_value).toContain('0 đến 100');
    expect(badPct.errors.evaluation_window).toBeDefined();

    alertService.createAlertRule.mockResolvedValue({
      id: 'rule-new-001',
      name: 'Canh bao RAM Cao',
      metric_type: 'RAM',
      operator: 'GREATER_THAN',
      threshold_value: 90,
      unit: '%',
      severity: 'CRITICAL',
      evaluation_window: '5m',
      duration: 60,
      cooldown_seconds: 300,
      enabled: true,
    });
    alertService.toggleAlertRuleStatus.mockResolvedValue({
      ...MOCK_RULES[0],
      enabled: false,
    });

    await act(async () => {
      render(<AlertsPage />);
    });

    // Mở Modal tạo Rule
    await act(async () => {
      fireEvent.click(screen.getByTestId('btn-open-create-rule'));
    });

    expect(screen.getByTestId('alert-rule-modal')).toBeInTheDocument();

    fireEvent.change(screen.getByTestId('input-rule-name'), {
      target: { value: 'Canh bao RAM Cao' },
    });
    fireEvent.change(screen.getByTestId('select-rule-metric-type'), {
      target: { value: 'RAM' },
    });
    fireEvent.change(screen.getByTestId('input-rule-threshold'), {
      target: { value: '90' },
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('btn-submit-rule-form'));
    });

    expect(alertService.createAlertRule).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Canh bao RAM Cao',
        metric_type: 'RAM',
        threshold_value: 90,
        unit: '%',
      })
    );

    // Chuyển sang tab Rules và bật/tắt Rule
    await act(async () => {
      fireEvent.click(screen.getByTestId('tab-alert-rules'));
    });

    expect(screen.getByTestId('rule-row-rule-cpu-001')).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByTestId('btn-toggle-rule-rule-cpu-001'));
    });
    expect(alertService.toggleAlertRuleStatus).toHaveBeenCalledWith('rule-cpu-001', false);
  });

  test('5. RBAC: Tài khoản VIEWER chỉ được xem, ẩn toàn bộ nút Tạo Rule, Đánh giá Rule, Acknowledge và Resolve', async () => {
    mockCurrentRole = 'VIEWER';

    await act(async () => {
      render(<AlertsPage />);
    });

    expect(screen.queryByTestId('btn-open-create-rule')).not.toBeInTheDocument();
    expect(screen.queryByTestId('btn-evaluate-now')).not.toBeInTheDocument();
    expect(screen.queryByTestId('btn-row-ack-alert-cpu-001')).not.toBeInTheDocument();
    expect(screen.queryByTestId('btn-row-resolve-alert-cpu-001')).not.toBeInTheDocument();

    // Mở chi tiết cũng không có khung thao tác Acknowledge / Resolve
    await act(async () => {
      fireEvent.click(screen.getByTestId('alert-row-alert-cpu-001'));
    });
    expect(screen.getByTestId('alert-detail-drawer')).toBeInTheDocument();
    expect(screen.queryByTestId('detail-operations-panel')).not.toBeInTheDocument();
  });

  test('6. Hiển thị đúng Empty State và Error State kèm nút Retry khi API lỗi', async () => {
    alertService.getAlerts.mockRejectedValueOnce(new Error('Mất kết nối tới máy chủ Cảnh báo'));

    await act(async () => {
      render(<AlertsPage />);
    });

    expect(screen.getByTestId('alerts-error-state')).toBeInTheDocument();
    expect(screen.getByText('Mất kết nối tới máy chủ Cảnh báo')).toBeInTheDocument();

    // Khi bấm Retry, trả về danh sách rỗng -> hiển thị Empty State
    alertService.getAlerts.mockResolvedValueOnce({
      items: [],
      pagination: { page: 1, limit: 10, total: 0, total_pages: 1 },
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('btn-retry-alerts'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('alerts-empty-state')).toBeInTheDocument();
    });
  });
});
