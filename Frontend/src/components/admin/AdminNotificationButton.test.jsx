import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AdminNotificationButton from './AdminNotificationButton';
import * as adminIncidentsService from '../../services/adminIncidentsService';
import * as adminBroadcastService from '../../services/adminBroadcastService';

jest.mock('../../services/adminIncidentsService');
jest.mock('../../services/adminBroadcastService');

describe('AdminNotificationButton Component Suite', () => {
  const mockAlerts = [
    {
      id: 'alt-ai-1',
      title: 'Tải Trọng AI Inference Nền Tảng',
      detail: 'Độ trễ suy luận mô hình Deep Learning GRU ổn định 1.2ms',
      service: 'AI Backend',
      severity: 'WARNING',
      status: 'ACTIVE',
      timestamp: '10:30',
    },
    {
      id: 'alt-k8s-1',
      title: 'Giám Sát Node Hạ Tầng Kubernetes',
      detail: 'Cụm K8s đang vận hành với 2/2 nodes sẵn sàng',
      service: 'K8s Cluster',
      severity: 'CRITICAL',
      status: 'ACTIVE',
      timestamp: '10:25',
    },
  ];

  const mockBroadcasts = [
    {
      id: 'bc-1',
      broadcast_code: 'BC-2026-09',
      title: 'Thông báo cập nhật thuật toán AI Model v2.4.1',
      content: 'Hệ thống đã triển khai phiên bản mô hình phát hiện dị thường mới',
      priority: 'INFO',
      audience: 'Tất cả người dùng',
      status: 'Đang hiển thị',
      formatted_date: '13/11/2026 12:38',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    adminIncidentsService.getAlertsOverview.mockResolvedValue({
      platformAlerts: mockAlerts,
    });
    adminBroadcastService.fetchAdminBroadcasts.mockResolvedValue({
      broadcasts: mockBroadcasts,
    });
  });

  test('renders notification bell button with total unread badge', async () => {
    render(<AdminNotificationButton />);

    const bellBtn = screen.getByLabelText(/Thông báo hệ thống quản trị/i);
    expect(bellBtn).toBeInTheDocument();

    // 2 alerts + 1 broadcast = 3 unread
    await waitFor(() => {
      expect(screen.getByText('3')).toBeInTheDocument();
    });
  });

  test('opens popover dialog on click and displays real technical alerts by default', async () => {
    const handleNavigate = jest.fn();
    render(<AdminNotificationButton onNavigate={handleNavigate} />);

    const bellBtn = screen.getByLabelText(/Thông báo hệ thống quản trị/i);
    fireEvent.click(bellBtn);

    expect(screen.getByText(/Thông Báo Quản Trị/i)).toBeInTheDocument();
    expect(screen.getByText(/Cảnh Báo Kỹ Thuật/i)).toBeInTheDocument();
    expect(screen.getByText(/Bản Tin Phát Sóng/i)).toBeInTheDocument();

    // Verify real alert item is present
    await waitFor(() => {
      expect(screen.getByText(/Tải Trọng AI Inference Nền Tảng/i)).toBeInTheDocument();
    });

    // Clicking alert item navigates to /admin/alerts
    const alertItem = screen.getByText(/Tải Trọng AI Inference Nền Tảng/i);
    fireEvent.click(alertItem);
    expect(handleNavigate).toHaveBeenCalledWith('/admin/alerts');
  });

  test('navigates to /admin/alerts when clicking footer button on alerts tab', async () => {
    const handleNavigate = jest.fn();
    render(<AdminNotificationButton onNavigate={handleNavigate} />);

    const bellBtn = screen.getByLabelText(/Thông báo hệ thống quản trị/i);
    fireEvent.click(bellBtn);

    const alertsFooterBtn = screen.getByText(/Xem Tất Cả Sự Cố & Cảnh Báo Hạ Tầng/i);
    fireEvent.click(alertsFooterBtn);

    expect(handleNavigate).toHaveBeenCalledWith('/admin/alerts');
  });

  test('switches to broadcast tab and navigates to /admin/notifications', async () => {
    const handleNavigate = jest.fn();
    render(<AdminNotificationButton onNavigate={handleNavigate} />);

    const bellBtn = screen.getByLabelText(/Thông báo hệ thống quản trị/i);
    fireEvent.click(bellBtn);

    // Switch to Bản Tin Phát Sóng tab
    const broadcastTabBtn = screen.getByRole('button', { name: /Bản Tin Phát Sóng/i });
    fireEvent.click(broadcastTabBtn);

    // Verify broadcast is displayed
    await waitFor(() => {
      expect(screen.getByText(/BC-2026-09/i)).toBeInTheDocument();
      expect(screen.getByText(/Thông báo cập nhật thuật toán AI Model v2.4.1/i)).toBeInTheDocument();
    });

    // Verify footer button navigates to /admin/notifications
    const broadcastFooterBtn = screen.getByText(/Mở Trung Tâm Phát Thông Báo Toàn Mạng/i);
    fireEvent.click(broadcastFooterBtn);

    expect(handleNavigate).toHaveBeenCalledWith('/admin/notifications');
  });

  test('marks all notifications as read when clicking "Đã đọc tất cả"', async () => {
    render(<AdminNotificationButton />);

    const bellBtn = screen.getByLabelText(/Thông báo hệ thống quản trị/i);
    fireEvent.click(bellBtn);

    await waitFor(() => {
      expect(screen.getByText(/Đã đọc tất cả/i)).toBeInTheDocument();
    });

    const markAllBtn = screen.getByText(/Đã đọc tất cả/i);
    fireEvent.click(markAllBtn);

    // "Đã đọc tất cả" button and unread counts disappear
    await waitFor(() => {
      expect(screen.queryByText(/Đã đọc tất cả/i)).not.toBeInTheDocument();
    });
  });
});
