import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import OverviewPage from './Overview';
import WidgetContainer from '../../components/admin/WidgetContainer';
import * as adminOverviewService from '../../services/adminOverviewService';

describe('Admin Overview Page Suite (/admin)', () => {
  beforeEach(() => {
    jest.spyOn(adminOverviewService, 'fetchAdminOverview').mockResolvedValue({
      status: 'ready',
      timestamp: '04:00:00 06/11/2026',
      data: {
        kpi: {
          companies: { total: 1, active: 1, incident: 0, diff: '+0 mới', status: 'positive' },
          users: { total: 2, active: 2, locked: 0, pending: 0, diff: '+0 mới', status: 'positive' },
          agents: { total: 1, online: 1, offline: 0, pending: 0, revoked: 0, diff: '100% sẵn sàng', status: 'positive' },
          clusters: { total: 1, healthy: 1, degraded: 0, diff: 'Sẵn sàng', status: 'positive' },
          uptime: { value: '99.98%', diff: '+0.05%', status: 'positive' },
          selfHealingRate: { value: '100%', diff: '+0%', status: 'positive' },
          activeIncidents: { value: '0 Sự cố', diff: '0 Khẩn cấp', status: 'positive' },
          managedResources: { value: 'Hạ tầng K8s', diff: 'Sẵn sàng', status: 'positive' },
        },
        statistics: {
          incidents: { total: 0, active: 0, resolved: 0, failed: 0, critical: 0, high: 0, medium: 0, low: 0 },
          remediations: { total: 0, succeeded: 0, failed: 0, in_progress: 0, success_rate: 100 },
          resource_usage: { avg_cpu_percent: 15, peak_cpu_percent: 25, avg_ram_percent: 40, peak_ram_percent: 50 },
        },
        organizationGrowth: {
          totalOrganizations: 1,
          activeOrganizations: 1,
          totalClusters: 1,
          connectedClusters: 1,
          totalAgents: 1,
          onlineAgents: 1,
          remediationsTotal: 0,
          remediationsSuccessRate: '100%',
        },
        aiOverview: {
          engineVersion: 'PyTorch • Multi-Head GRU',
          modelName: 'Gru Model 8feature',
          version: 'v2.0.0',
          predictionAccuracy: '97.4%',
          f1Score: '0.9009',
          fpr: '0.27%',
          latency: '0.29 ms',
          status: 'ACTIVE',
          dataset: 'test.csv',
          totalPredictions: 55000,
        },
        recentActivity: [],
        dynamicScopes: {
          organizations: [{ id: 'all', name: 'Tất Cả Tổ Chức' }],
          clusters: [{ id: 'all', name: 'Tất Cả Cụm Máy Chủ' }],
        },
      },
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('renders page header, hubs, global scope and snapshot timestamp', async () => {
    render(<OverviewPage />);

    // Section 1: Page Header
    expect(screen.getByText(/Bàn Điều Khiển Quản Trị Nền Tảng/i)).toBeInTheDocument();

    // Wait for data load from service layer
    await waitFor(() => {
      expect(screen.getByText(/Ảnh chụp:/i)).toBeInTheDocument();
    });

    // Section 2: Quick Hubs
    expect(screen.getByText(/Quản Lý Người Dùng/i)).toBeInTheDocument();
    expect(screen.getByText(/Công Ty & Thống Kê/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Đánh Giá Mô Hình AI/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Phát Thông Báo Toàn Mạng/i)).toBeInTheDocument();


    // Section 4: KPI Cards
    await waitFor(() => {
      expect(screen.getByText(/Tổng Số Company/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/Tổng Số User/i)).toBeInTheDocument();
    expect(screen.getByText(/Tổng Số Agent Toàn Mạng/i)).toBeInTheDocument();
    expect(screen.getByText(/Tổng Số Cụm K8s/i)).toBeInTheDocument();

    // Section 5: Interactive Growth & Operations Chart
    expect(screen.getByText(/Biến thiên Tăng Trưởng Toàn Nền Tảng/i)).toBeInTheDocument();


    // Section 7: AI Overview
    expect(screen.getByText(/Động Cơ Trí Tuệ Nhân Tạo & Suy Diễn/i)).toBeInTheDocument();

    // Section 8: Recent Activity
    expect(screen.getByText(/Dòng Hoạt Động & Kiểm Toán Gần Nhất/i)).toBeInTheDocument();
  });

  test('handles manual refresh action', async () => {
    render(<OverviewPage />);

    const refreshBtn = screen.getByLabelText(/Làm mới dữ liệu nền tảng/i);
    expect(refreshBtn).toBeInTheDocument();

    fireEvent.click(refreshBtn);

    await waitFor(() => {
      expect(screen.getByText(/Ảnh chụp:/i)).toBeInTheDocument();
    });
  });

  describe('WidgetContainer Component Direct States', () => {
    test('renders loading, error, disconnected, no-data, empty states correctly', () => {
      // 1. Loading
      const { rerender } = render(<WidgetContainer title="Thử Nghiệm" status="loading" />);
      expect(screen.getByText(/Đang tải dữ liệu viễn trắc/i)).toBeInTheDocument();

      // 2. Error
      rerender(<WidgetContainer title="Thử Nghiệm" status="error" errorMessage="Lỗi mạng" />);
      expect(screen.getByText(/Không Thể Nạp Dữ Liệu/i)).toBeInTheDocument();
      expect(screen.getByText('Lỗi mạng')).toBeInTheDocument();

      // 3. Disconnected
      rerender(<WidgetContainer title="Thử Nghiệm" status="disconnected" />);
      expect(screen.getAllByText(/Mất Kết Nối Với Cụm Máy Chủ/i).length).toBeGreaterThan(0);

      // 4. No Data
      rerender(<WidgetContainer title="Thử Nghiệm" status="no-data" />);
      expect(screen.getAllByText(/Chưa Có Dữ Liệu Viễn Trắc/i).length).toBeGreaterThan(0);

      // 5. Empty
      rerender(<WidgetContainer title="Thử Nghiệm" status="empty" emptyMessage="Danh sách trống" />);
      expect(screen.getByText('Danh sách trống')).toBeInTheDocument();
    });
  });
});
