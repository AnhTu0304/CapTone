import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { AdminAlertsPage } from './AdminAlertsPage';
import * as adminIncidentsService from '../../../services/adminIncidentsService';
import aiService from '../../../services/aiService';

jest.mock('../../../services/adminIncidentsService');
jest.mock('../../../services/aiService');

describe('AdminAlertsPage Verification Suite', () => {
  const mockOverview = {
    kpi: {
      totalIncidents: 9109,
      criticalIncidents: 4,
      openIncidents: 7,
      resolvedIncidents: 9102,
      totalAgents: 28,
      onlineAgents: 2,
      offlineAgents: 8,
      pendingAgents: 18,
      totalClusters: 27,
      totalOrganizations: 21,
      autoHealingRate: '67.8%',
      averageMttr: '42s',
    },
    coreHealth: {
      mainBackend: { name: 'Main Backend', status: 'HEALTHY', latencyMs: 1 },
      aiBackend: { name: 'AI Engine', status: 'HEALTHY', latencyMs: 1.2 },
      postgres: { name: 'PostgreSQL Database', status: 'HEALTHY', latencyMs: 2 },
      redis: { name: 'Redis Cache & Queue', status: 'HEALTHY', latencyMs: 1 },
      websocket: { name: 'WebSocket Server', status: 'HEALTHY', latencyMs: 1 },
    },
    massDisconnectCluster: {
      clusterId: 'cls-01',
      clusterName: 'minikube-prod',
      offlineCount: 5,
      totalCount: 10,
    },
    platformAlerts: [
      {
        id: 'alt-core-backend',
        title: 'Mất kết nối Main Backend API Gateway',
        detail: 'Cụm điều khiển API Gateway không phản hồi heartbeat.',
        service: 'Main Backend',
        scope: 'Cụm Hệ Thống (Master Node)',
        category: 'CORE_INFRA',
        severity: 'CRITICAL',
        status: 'PENDING',
        timestamp: '12:00:00',
      },
      {
        id: 'alt-db-pool',
        title: 'Connection Pool PostgreSQL gần đạt giới hạn (>85%)',
        detail: 'PostgreSQL connection pool đạt mức 88%. Nguy cơ nghẽn kết nối.',
        service: 'PostgreSQL Primary',
        scope: 'Cụm Dữ Liệu (Storage Cluster)',
        category: 'DATABASE',
        severity: 'HIGH',
        status: 'INVESTIGATING',
        timestamp: '12:01:00',
      },
      {
        id: 'alt-sec-brute',
        title: 'Phát hiện đăng nhập thất bại liên tục (Brute-force)',
        detail: 'Hơn 12 lần đăng nhập sai từ địa chỉ IP 10.244.3.15.',
        service: 'Security Sentinel',
        scope: 'API Gateway Ingress',
        category: 'SECURITY',
        severity: 'CRITICAL',
        status: 'PENDING',
        timestamp: '12:02:00',
      },
      {
        id: 'alt-ops-redis',
        title: 'Hàng đợi Redis tồn đọng tác vụ tự phục hồi',
        detail: 'Số lượng job tồn đọng trong queue vượt ngưỡng 1250 tác vụ.',
        service: 'Redis Queue Worker',
        scope: 'Self-Healing Controller',
        category: 'PLATFORM_OPS',
        severity: 'MEDIUM',
        status: 'RESOLVED',
        timestamp: '12:03:00',
      },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    adminIncidentsService.getAlertsOverview.mockResolvedValue(mockOverview);
    aiService.updateIncidentStatus.mockResolvedValue({ success: true });
  });

  it('1. Renders live KPIs, 5 core health indicators and alerts table without graphs/diagrams', async () => {
    render(<AdminAlertsPage />);

    // Check title
    expect(screen.getByText('Quản Lý Cảnh Báo Hạ Tầng Hệ Thống')).toBeInTheDocument();

    // Wait for data load
    await waitFor(() => {
      expect(screen.getByText('Giám sát thời gian thực toàn bộ 27 cụm hạ tầng')).toBeInTheDocument();
    });

    // 5 Thành phần cốt lõi hiển thị dạng đèn tín hiệu & latency
    expect(screen.getByText('Main Backend (API)')).toBeInTheDocument();
    expect(screen.getByText('AI Engine (FastAPI)')).toBeInTheDocument();
    expect(screen.getByText('PostgreSQL Database')).toBeInTheDocument();
    expect(screen.getByText('Redis Cache & Queue')).toBeInTheDocument();
    expect(screen.getByText('WebSocket Telemetry')).toBeInTheDocument();

    // Verify category badges rendered
    expect(screen.getAllByText('🔴 Cốt Lõi Hệ Thống').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('🟡 Cơ Sở Dữ Liệu').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('🛡️ An Ninh Bảo Mật').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('🔵 Hoạt Động Nền Tảng').length).toBeGreaterThanOrEqual(1);

    // Check KPI values from DB
    expect(screen.getByText('67.8%')).toBeInTheDocument();
    expect(screen.getByText('42s')).toBeInTheDocument();

    // Verify alerts in table
    expect(screen.getByText('Mất kết nối Main Backend API Gateway')).toBeInTheDocument();
    expect(screen.getByText(/Connection Pool PostgreSQL gần đạt giới hạn/)).toBeInTheDocument();

    // Verify NO company/organization filter exists
    expect(screen.queryByText(/Tất cả doanh nghiệp/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Lọc theo doanh nghiệp/i)).not.toBeInTheDocument();
  });

  it('2. Filters alerts properly by category dropdown', async () => {
    render(<AdminAlertsPage />);

    await waitFor(() => {
      expect(screen.getByText('Mất kết nối Main Backend API Gateway')).toBeInTheDocument();
    });

    const categorySelect = screen.getByLabelText('Lọc theo danh mục cảnh báo');
    expect(categorySelect).toBeInTheDocument();

    // Filter by DATABASE only
    fireEvent.change(categorySelect, { target: { value: 'DATABASE' } });

    expect(screen.getByText(/Connection Pool PostgreSQL gần đạt giới hạn/)).toBeInTheDocument();
    expect(screen.queryByText('Mất kết nối Main Backend API Gateway')).not.toBeInTheDocument();
    expect(screen.queryByText(/Phát hiện đăng nhập thất bại liên tục/)).not.toBeInTheDocument();
  });

  it('3. Triggers incident status update to backend when clicking "Đánh Dấu Giải Quyết"', async () => {
    render(<AdminAlertsPage />);

    await waitFor(() => {
      expect(screen.getByText('Mất kết nối Main Backend API Gateway')).toBeInTheDocument();
    });

    const resolveButtons = screen.getAllByRole('button', { name: /Đánh Dấu Giải Quyết/i });
    expect(resolveButtons.length).toBeGreaterThan(0);

    fireEvent.click(resolveButtons[0]);

    await waitFor(() => {
      expect(screen.getByText(/Đã chuyển trạng thái cảnh báo sang: RESOLVED!/i)).toBeInTheDocument();
    });
  });

  it('4. Opens threshold modal and allows configuring DB pool and Redis backlog thresholds', async () => {
    render(<AdminAlertsPage />);

    await waitFor(() => {
      expect(screen.getByText('Quản Lý Cảnh Báo Hạ Tầng Hệ Thống')).toBeInTheDocument();
    });

    // Open threshold modal
    const configBtn = screen.getByRole('button', { name: /Cấu Hình Ngưỡng/i });
    fireEvent.click(configBtn);

    expect(screen.getByText('Cấu Hình Ngưỡng Cảnh Báo Cấp Nền Tảng')).toBeInTheDocument();
    expect(screen.getByText(/Ngưỡng Sử Dụng Connection Pool CSDL/i)).toBeInTheDocument();
    expect(screen.getByText(/Ngưỡng Hàng Đợi Redis Tồn Đọng/i)).toBeInTheDocument();
    expect(screen.getByText(/Ngưỡng Đăng Nhập Thất Bại Liên Tiếp/i)).toBeInTheDocument();

    // Submit configuration
    const saveBtn = screen.getByRole('button', { name: /Lưu Cấu Hình/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(screen.queryByText('Cấu Hình Ngưỡng Cảnh Báo Cấp Nền Tảng')).not.toBeInTheDocument();
    });
  });

  it('5. Displays mass disconnect warning banner based on offline threshold', async () => {
    render(<AdminAlertsPage />);

    await waitFor(() => {
      expect(screen.getByText('Cảnh Báo Tác Tử Mất Kết Nối Hàng Loạt (Mass Disconnect Detection)')).toBeInTheDocument();
    });

    expect(screen.getByText(/Hệ thống ghi nhận/i)).toBeInTheDocument();
  });
});
