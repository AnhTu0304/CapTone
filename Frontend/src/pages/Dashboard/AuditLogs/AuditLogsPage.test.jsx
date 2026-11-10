import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AuditLogsPage } from './AuditLogsPage';
import { fetchOrgAuditLogs } from '../../../services/dashboardAuditLogsService';

const mockOrgContext = {
  currentOrg: { id: 'org-1', name: 'SME Retail Enterprise', slug: 'sme-retail' },
  currentEnv: null,
};

jest.mock('../context/DashboardContext', () => ({
  useDashboard: () => mockOrgContext,
}));

const mockToastFns = {
  success: jest.fn(),
  error: jest.fn(),
};

jest.mock('../../../context/ToastContext', () => ({
  useToast: () => mockToastFns,
}));

jest.mock('../../../components/dashboard/AuditDistributionChart', () => () => null);

jest.mock('../../../services/dashboardAuditLogsService', () => ({
  fetchOrgAuditLogs: jest.fn(),
}));

describe('AuditLogsPage Real Data & Time Filter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockOrgContext.currentEnv = null;

    const now = new Date();
    const todayIso = now.toISOString();

    // Pick another date within the same calendar year that is guaranteed not to be today
    const otherDayInSameYear =
      now.getMonth() !== 0
        ? new Date(now.getFullYear(), 0, 15, 10, 0, 0)
        : new Date(now.getFullYear(), 0, now.getDate() === 1 ? 2 : 1, 10, 0, 0);
    const otherDayIso = otherDayInSameYear.toISOString();

    fetchOrgAuditLogs.mockResolvedValue({
      data: [
        {
          id: 'AUD-008177',
          timestamp: 'Hôm nay 14:31:01',
          created_at: todayIso,
          raw_created_at: todayIso,
          actor: 'fyuyu-ebpf-agent',
          actorType: 'AGENT',
          role: 'AGENT',
          event: 'REMEDIATION_COMPLETED',
          description: 'Tác vụ tự phục hồi hoàn tất thành công bởi Agent fyuyu-ebpf-agent',
          target: 'selfheal-test-app',
          ip: null,
          sha256: '6ab4855404a6775dab81836284bacd8488883ff87808840d245940ec96408852',
          status: 'SUCCESS',
          metadata: {},
        },
        {
          id: 'AUD-OLD-1',
          timestamp: 'Ngày khác trong năm 10:00:00',
          created_at: otherDayIso,
          raw_created_at: otherDayIso,
          actor: 'Phạm Thái Sang',
          actorType: 'USER',
          role: 'SME_OWNER',
          event: 'POLICY_UPDATED',
          description: 'Log ngày khác trong năm',
          target: 'Policy/POL-1',
          ip: '172.25.0.1',
          sha256: 'def1234567890abc123456',
          status: 'SUCCESS',
          metadata: { userAgent: 'Mozilla/5.0' },
        },
      ],
      total: 2,
      page: 1,
      pageSize: 5000,
      totalPages: 1,
    });
  });

  it('defaults to today without showing "Tất cả thời gian" and displays real Agent actor without fake 127.0.0.1 IP', async () => {
    render(<AuditLogsPage />);

    await waitFor(() => {
      expect(screen.getByText('AUD-008177')).toBeInTheDocument();
    });

    // Shows real agent identity and truthful internal cluster source instead of fake 127.0.0.1
    expect(screen.getByText('fyuyu-ebpf-agent')).toBeInTheDocument();
    expect(screen.getByText('Cụm K8s')).toBeInTheDocument();
    expect(screen.queryByText(/127\.0\.0\.1/)).not.toBeInTheDocument();

    // Older entry is filtered out by default ('today')
    expect(screen.queryByText('AUD-OLD-1')).not.toBeInTheDocument();

    // Filter SUCCESS pill ("Thành Công") matches real SUCCESS records
    fireEvent.click(screen.getByRole('button', { name: 'Thành Công' }));
    expect(screen.getByText('AUD-008177')).toBeInTheDocument();

    // Filter AGENT pill ("Agent K8s") keeps real Agent records
    fireEvent.click(screen.getByRole('button', { name: 'Agent K8s' }));
    expect(screen.getByText('AUD-008177')).toBeInTheDocument();

    // Button label shows "Hôm nay (...)" and never "Tất cả thời gian"
    const calendarBtn = screen.getByTitle('Mở bảng lịch chọn ngày, tháng hoặc năm');
    expect(calendarBtn).toHaveTextContent(/Hôm nay \(\d{2}\/\d{2}\/\d{4}\)/);
    expect(screen.queryByText('Tất cả thời gian')).not.toBeInTheDocument();

    // Open popover and verify only Ngày / Tháng / Năm tabs exist
    fireEvent.click(calendarBtn);

    expect(screen.getByRole('button', { name: /Ngày$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Tháng$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Năm$/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /🌐 Tất cả/i })).not.toBeInTheDocument();
  });

  it('shows historical logs within the current year when switching to Year mode', async () => {
    render(<AuditLogsPage />);

    await waitFor(() => {
      expect(screen.getByText('AUD-008177')).toBeInTheDocument();
    });

    const calendarBtn = screen.getByTitle('Mở bảng lịch chọn ngày, tháng hoặc năm');
    fireEvent.click(calendarBtn);

    const yearTabBtn = screen.getByRole('button', { name: /Năm$/i });
    fireEvent.click(yearTabBtn);

    const now = new Date();
    expect(calendarBtn).toHaveTextContent(`Năm ${now.getFullYear()}`);
    expect(screen.getByText('AUD-OLD-1')).toBeInTheDocument();

    await waitFor(() => {
      expect(fetchOrgAuditLogs).toHaveBeenCalledWith(
        'org-1',
        expect.objectContaining({ timeFilterMode: 'year', selectedYear: String(now.getFullYear()) }),
        { page: 1, pageSize: 5000 }
      );
    });
  });

  it('hides signature UI, widens content column, and displays truthful connection metadata in modal', async () => {
    render(<AuditLogsPage />);

    await waitFor(() => {
      expect(screen.getByText('AUD-008177')).toBeInTheDocument();
    });

    // Signature UI elements are hidden from KPIs, toolbar, and table
    expect(screen.queryByText(/Chữ Ký SHA-256/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Toàn Vẹn Chữ Ký/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Toàn vẹn mật mã/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Mã băm SHA-256/i)).not.toBeInTheDocument();

    // Expected 6 table headers render cleanly
    const headers = screen.getAllByRole('columnheader');
    expect(headers).toHaveLength(6);

    const contentHeader = screen.getByRole('columnheader', { name: 'Nội Dung Chi Tiết' });
    expect(contentHeader).toBeInTheDocument();
    expect(contentHeader).toHaveStyle({ minWidth: '300px' });

    const contentCell = screen.getByRole('cell', {
      name: 'Tác vụ tự phục hồi hoàn tất thành công bởi Agent fyuyu-ebpf-agent',
    });
    expect(contentCell).toBeInTheDocument();
    expect(contentCell).toHaveStyle({ minWidth: '300px' });
    expect(contentCell).not.toHaveStyle({ maxWidth: '320px' });

    // Opening detail modal shows truthful null-state labels (no hardcoded assumptions) and hides signature box
    fireEvent.click(screen.getByRole('button', { name: 'Xem' }));
    expect(screen.getByText('Chi Tiết Bản Ghi Kiểm Toán')).toBeInTheDocument();
    expect(screen.getByText('Chưa ghi nhận IP')).toBeInTheDocument();
    expect(screen.getByText('Chưa ghi nhận User-Agent')).toBeInTheDocument();
    expect(screen.queryByText('Không ghi nhận (Nội bộ)')).not.toBeInTheDocument();
    expect(screen.queryByText('Tác tử Kubernetes Agent')).not.toBeInTheDocument();
    expect(screen.queryByText(/Internal Cluster Network/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Chữ Ký Bất Biến SHA-256/i)).not.toBeInTheDocument();
  });

  it('displays explicit error state instead of fake fallback logs when API rejects', async () => {
    fetchOrgAuditLogs.mockRejectedValueOnce(new Error('Mất kết nối CSDL Postgres'));

    render(<AuditLogsPage />);

    await waitFor(() => {
      expect(screen.getByText('Không thể tải dữ liệu kiểm toán thực tế từ máy chủ')).toBeInTheDocument();
    });

    expect(screen.getByText('Mất kết nối CSDL Postgres')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Thử tải lại' })).toBeInTheDocument();
    expect(mockToastFns.error).toHaveBeenCalledWith('Mất kết nối CSDL Postgres');
  });

  it('renders readable Vietnamese event badges, split timestamps, runtime metadata pills, and reset filter button', async () => {
    const todayIso = new Date().toISOString();
    fetchOrgAuditLogs.mockResolvedValueOnce({
      data: [
        {
          id: 'AUD-008211',
          timestamp: '10/11/2026 15:03:55',
          created_at: todayIso,
          raw_created_at: todayIso,
          actor: 'fyuyu-ebpf-agent',
          actorType: 'AGENT',
          role: 'AGENT',
          event: 'REMEDIATION_COMPLETED',
          description: 'Tác vụ tự phục hồi hoàn tất thành công bởi Agent fyuyu-ebpf-agent',
          target: 'sme-order-service',
          ip: null,
          status: 'SUCCESS',
          metadata: { duration_ms: 179, cluster_name: 'fyuyu' },
        },
        {
          id: 'AUD-008210',
          timestamp: '10/11/2026 15:03:55',
          created_at: todayIso,
          raw_created_at: todayIso,
          actor: 'Hệ thống AI (MAPE-K)',
          actorType: 'SYSTEM',
          role: 'SYSTEM_AI',
          event: 'AUTONOMOUS_HEALING_TRIGGERED',
          description: 'Tác vụ tự phục hồi tự động được kích hoạt cho sme-order-service',
          target: 'sme-order-service',
          ip: null,
          status: 'SUCCESS',
          metadata: { policy_name: 'POL-SCALE-OUT-TRAFFIC', confidence: 0.7929 },
        },
      ],
      total: 2,
      page: 1,
      pageSize: 5000,
      totalPages: 1,
    });

    render(<AuditLogsPage />);

    await waitFor(() => {
      expect(screen.getByText('AUD-008211')).toBeInTheDocument();
    });

    expect(screen.getByText('Hoàn tất tự phục hồi')).toBeInTheDocument();
    expect(screen.getByText('Kích hoạt tự phục hồi')).toBeInTheDocument();
    expect(screen.getByText('179ms')).toBeInTheDocument();
    expect(screen.getByText('AI 79%')).toBeInTheDocument();
    expect(screen.getAllByText('15:03:55')).toHaveLength(2);
    expect(screen.getAllByText('10/11/2026')).toHaveLength(2);

    // Selecting a role reveals "Đặt lại lọc" button which restores ALL state
    fireEvent.click(screen.getByRole('button', { name: 'Agent K8s' }));
    expect(screen.queryByText('AUD-008210')).not.toBeInTheDocument();
    const resetBtn = screen.getByRole('button', { name: 'Đặt lại lọc' });
    fireEvent.click(resetBtn);
    expect(screen.getByText('AUD-008210')).toBeInTheDocument();

    // Open modal on AGENT row and verify real metadata chips display
    const viewButtons = screen.getAllByRole('button', { name: 'Xem' });
    fireEvent.click(viewButtons[0]);
    expect(screen.getByText('Thông Số Thực Thi Ghi Nhận')).toBeInTheDocument();
    expect(screen.getByText('179 ms')).toBeInTheDocument();
    expect(screen.getByText('fyuyu')).toBeInTheDocument();
  });

  it('displays real telemetry, resource identifier, ISO State Diff timestamps, and exact null without hardcoded assumptions', async () => {
    const todayIso = new Date().toISOString();
    fetchOrgAuditLogs.mockResolvedValueOnce({
      data: [
        {
          id: 'AUD-008325',
          timestamp: '10/11/2026 18:53:04',
          created_at: todayIso,
          raw_created_at: todayIso,
          actor: 'fyuyu-ebpf-agent',
          actorEmail: null,
          actorType: 'AGENT',
          role: 'AGENT',
          organizationName: 'SME Retail Enterprise',
          event: 'AGENT_CONNECTED',
          description: "Agent 'fyuyu-ebpf-agent' recovered connection via valid heartbeat. Status transitioned from OFFLINE to ONLINE.",
          target: 'fyuyu-ebpf-agent',
          resourceType: 'AGENT',
          resourceId: '1aadd3cd-9c56-4812-8b91-77e01f234567',
          ip: '10.244.0.18',
          status: 'SUCCESS',
          before_data: null,
          after_data: { status: 'ONLINE', last_seen_at: '2026-11-10T11:53:04.000Z' },
          metadata: {
            reasonCode: 'HEARTBEAT_RECOVERED',
            cluster_name: 'fyuyu',
            userAgent: 'selfheal-agent/v2.4.1',
            requestId: 'req-agent-8325',
            latency_ms: 1.4,
          },
        },
      ],
      total: 1,
      page: 1,
      pageSize: 5000,
      totalPages: 1,
    });

    render(<AuditLogsPage />);

    await waitFor(() => {
      expect(screen.getByText('AUD-008325')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Xem' }));

    expect(screen.getByText('10.244.0.18')).toBeInTheDocument();
    expect(screen.getByText('selfheal-agent/v2.4.1')).toBeInTheDocument();
    expect(screen.getByText('Request ID: req-agent-8325')).toBeInTheDocument();
    expect(screen.getByText('SME Retail Enterprise')).toBeInTheDocument();
    expect(screen.getByText('AGENT: 1aadd3cd-9c56-4812-8b91-77e01f234567')).toBeInTheDocument();
    expect(screen.getByText('HEARTBEAT_RECOVERED')).toBeInTheDocument();
    expect(screen.getByText('1.4 ms')).toBeInTheDocument();
    expect(screen.getByText('fyuyu')).toBeInTheDocument();
    expect(screen.getByText(/2026-11-10T11:53:04\.000Z/)).toBeInTheDocument();
    expect(screen.getByText('null')).toBeInTheDocument();
    expect(screen.queryByText(/null \(Tạo mới\)/)).not.toBeInTheDocument();
  });

  it('automatically filters by TopHeader cluster (currentEnv), switches on header cluster change, and allows Toàn công ty toggle', async () => {
    const todayIso = new Date().toISOString();
    mockOrgContext.currentEnv = {
      id: 'cluster-fyuyu',
      clusterId: 'cluster-fyuyu',
      cluster: 'fyuyu',
      name: 'Production Kubernetes / fyuyu',
    };

    fetchOrgAuditLogs.mockResolvedValue({
      data: [
        {
          id: 'AUD-FYUYU-1',
          timestamp: '10/11/2026 15:03:55',
          created_at: todayIso,
          raw_created_at: todayIso,
          actor: 'fyuyu-ebpf-agent',
          actorType: 'AGENT',
          role: 'AGENT',
          clusterId: 'cluster-fyuyu',
          clusterName: 'fyuyu',
          serviceName: 'selfheal-test-app',
          event: 'REMEDIATION_COMPLETED',
          description: 'Khôi phục thành công selfheal-test-app trên cụm fyuyu',
          target: 'selfheal-test-app',
          status: 'SUCCESS',
          metadata: { cluster_name: 'fyuyu' },
        },
      ],
      total: 1,
      page: 1,
      pageSize: 5000,
      totalPages: 1,
    });

    const { rerender } = render(<AuditLogsPage />);

    await waitFor(() => {
      expect(fetchOrgAuditLogs).toHaveBeenCalledWith(
        'org-1',
        expect.objectContaining({ cluster_id: 'cluster-fyuyu', timeFilterMode: 'today' }),
        { page: 1, pageSize: 5000 }
      );
    });

    expect(screen.queryByText('Cụm K8s: fyuyu')).not.toBeInTheDocument();
    expect(screen.queryByText('SME Retail Enterprise')).not.toBeInTheDocument();
    expect(screen.queryByText(/Immutable Audit Logs/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'fyuyu' })).toHaveAttribute('aria-pressed', 'true');
    expect(await screen.findByText('AUD-FYUYU-1')).toBeInTheDocument();
    expect(screen.getByRole('table')).not.toHaveTextContent(/Cụm:\s*fyuyu/);
    expect(screen.queryByText(/Cụm:\s*fyuyu/)).not.toBeInTheDocument();
    expect(screen.getAllByText(/Hôm nay \(\d{2}\/\d{2}\/\d{4}\)/)).toHaveLength(1);

    // Switching cluster on TopHeader immediately re-queries using new header cluster ID
    mockOrgContext.currentEnv = {
      id: 'cluster-ai',
      clusterId: 'cluster-ai',
      cluster: 'ai',
      name: 'Production Kubernetes / ai',
    };
    fetchOrgAuditLogs.mockResolvedValueOnce({
      data: [
        {
          id: 'AUD-AI-1',
          timestamp: '10/11/2026 15:05:00',
          created_at: todayIso,
          raw_created_at: todayIso,
          actor: 'Hệ thống AI (MAPE-K)',
          actorType: 'SYSTEM',
          role: 'SYSTEM_AI',
          clusterId: 'cluster-ai',
          clusterName: 'ai',
          serviceName: 'mongodb',
          event: 'AUTONOMOUS_HEALING_TRIGGERED',
          description: 'Kích hoạt tự phục hồi mongodb trên cụm ai',
          target: 'mongodb',
          status: 'SUCCESS',
          metadata: { cluster_name: 'ai' },
        },
      ],
      total: 1,
      page: 1,
      pageSize: 5000,
      totalPages: 1,
    });

    rerender(<AuditLogsPage />);

    await waitFor(() => {
      expect(fetchOrgAuditLogs).toHaveBeenCalledWith(
        'org-1',
        expect.objectContaining({ cluster_id: 'cluster-ai' }),
        { page: 1, pageSize: 5000 }
      );
    });
    expect(screen.queryByText('Cụm K8s: ai')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ai' })).toHaveAttribute('aria-pressed', 'true');
    expect(await screen.findByText('AUD-AI-1')).toBeInTheDocument();

    // Switching to "Toàn công ty" clears cluster_id filter
    fireEvent.click(screen.getByRole('button', { name: 'Toàn công ty' }));

    await waitFor(() => {
      const lastCallFilters = fetchOrgAuditLogs.mock.calls[fetchOrgAuditLogs.mock.calls.length - 1][1];
      expect(lastCallFilters.cluster_id).toBeUndefined();
    });
    expect(screen.queryByText('Phạm vi: Toàn công ty')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Toàn công ty' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('filters dynamically by real K8s service options and resets cleanly via Đặt lại lọc', async () => {
    const todayIso = new Date().toISOString();
    fetchOrgAuditLogs.mockResolvedValueOnce({
      data: [
        {
          id: 'AUD-SVC-1',
          timestamp: '10/11/2026 15:01:00',
          created_at: todayIso,
          raw_created_at: todayIso,
          actor: 'fyuyu-ebpf-agent',
          actorType: 'AGENT',
          role: 'AGENT',
          serviceName: 'selfheal-test-app',
          event: 'REMEDIATION_COMPLETED',
          description: 'Restart selfheal-test-app',
          target: 'selfheal-test-app',
          resourceType: 'HEALING_ACTION',
          status: 'SUCCESS',
          metadata: {},
        },
        {
          id: 'AUD-SVC-2',
          timestamp: '10/11/2026 15:02:00',
          created_at: todayIso,
          raw_created_at: todayIso,
          actor: 'Hệ thống AI (MAPE-K)',
          actorType: 'SYSTEM',
          role: 'SYSTEM_AI',
          serviceName: 'sme-order-service',
          event: 'AUTONOMOUS_HEALING_TRIGGERED',
          description: 'Scale out sme-order-service',
          target: 'sme-order-service',
          resourceType: 'HEALING_ACTION',
          status: 'SUCCESS',
          metadata: {},
        },
        {
          id: 'AUD-POL-1',
          timestamp: '10/11/2026 15:03:00',
          created_at: todayIso,
          raw_created_at: todayIso,
          actor: 'Phạm Thái Sang',
          actorType: 'USER',
          role: 'SME_OWNER',
          event: 'POLICY_UPDATED',
          description: 'Cập nhật policy org',
          target: 'Policy/POL-1',
          resourceType: 'POLICY',
          status: 'SUCCESS',
          metadata: {},
        },
      ],
      total: 3,
      page: 1,
      pageSize: 5000,
      totalPages: 1,
    });

    render(<AuditLogsPage />);

    await waitFor(() => {
      expect(screen.getByText('AUD-SVC-1')).toBeInTheDocument();
    });

    const serviceSelect = screen.getByLabelText('Lọc theo dịch vụ K8s');
    const optionLabels = Array.from(serviceSelect.querySelectorAll('option')).map((o) => o.textContent);
    expect(optionLabels).toEqual([
      'Tất cả dịch vụ (2)',
      'Dịch vụ: selfheal-test-app',
      'Dịch vụ: sme-order-service',
    ]);

    fireEvent.change(serviceSelect, { target: { value: 'sme-order-service' } });
    expect(screen.queryByText('AUD-SVC-1')).not.toBeInTheDocument();
    expect(screen.queryByText('AUD-POL-1')).not.toBeInTheDocument();
    expect(screen.getByText('AUD-SVC-2')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Đặt lại lọc' }));
    expect(screen.getByText('AUD-SVC-1')).toBeInTheDocument();
    expect(screen.getByText('AUD-SVC-2')).toBeInTheDocument();
    expect(screen.getByText('AUD-POL-1')).toBeInTheDocument();
  });
});
