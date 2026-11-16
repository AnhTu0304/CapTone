import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AdminBroadcastPage } from './AdminBroadcastPage';
import * as adminBroadcastService from '../../../services/adminBroadcastService';

describe('AdminBroadcastPage Suite (/admin/notifications)', () => {
  const mockBroadcasts = [
    {
      id: 'bc-uuid-1',
      broadcast_code: 'BC-2026-09',
      title: 'Thông báo cập nhật AI Model v2.4.1',
      content: 'Hệ thống triển khai model mới với độ trễ 1.2ms',
      priority: 'INFO',
      audience: 'Tất cả người dùng',
      status: 'Đang hiển thị',
      formatted_date: '21/10/2026 22:00',
      views_count: 1240,
    },
    {
      id: 'bc-uuid-2',
      broadcast_code: 'BC-2026-08',
      title: 'Bảo trì hạ tầng PostgreSQL',
      content: 'Tối ưu hóa cơ sở dữ liệu định kỳ',
      priority: 'WARNING',
      audience: 'Chủ Doanh nghiệp',
      status: 'Đã lên lịch',
      formatted_date: '19/10/2026 14:30',
      views_count: 890,
    },
  ];

  const mockSystemAlerts = [
    {
      id: 'ALT-1',
      title: 'Tổ chức mới kích hoạt trên hệ thống',
      source: 'Quản lý Doanh nghiệp',
      time: 'Hôm nay',
      type: 'ORG',
      unread: true,
    },
  ];

  beforeEach(() => {
    jest.spyOn(adminBroadcastService, 'fetchAdminBroadcasts').mockResolvedValue({
      broadcasts: mockBroadcasts,
      systemAlerts: mockSystemAlerts,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('renders page header, compose card, alerts box and broadcasts table', async () => {
    render(<AdminBroadcastPage />);

    // 1. Header
    expect(screen.getByText(/Trung Tâm Phát Thông Báo Toàn Mạng/i)).toBeInTheDocument();

    // 2. Compose form elements
    expect(screen.getByText(/Soạn Thông Báo Mới/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/VD: Nâng cấp mô hình AI/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Nhập nội dung thông báo/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Phát Thông Báo Toàn Mạng Ngay/i })).toBeInTheDocument();

    // 3. Alerts box & Broadcasts table
    await waitFor(() => {
      expect(screen.getByText(/Thông báo cập nhật AI Model v2.4.1/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/Bảo trì hạ tầng PostgreSQL/i)).toBeInTheDocument();
    expect(screen.getByText(/BC-2026-09/i)).toBeInTheDocument();
  });

  test('handles successful broadcast creation', async () => {
    const createSpy = jest.spyOn(adminBroadcastService, 'createAdminBroadcast').mockResolvedValue({
      id: 'bc-uuid-new',
      broadcast_code: 'BC-2026-10',
      title: 'Khẩn cấp: Nâng cấp bảo mật máy chủ',
      content: 'Chi tiết bảo mật hệ thống khẩn',
      priority: 'CRITICAL',
      audience: 'Tất cả người dùng',
      status: 'Đang hiển thị',
      formatted_date: 'Vừa xong',
      views_count: 0,
    });

    render(<AdminBroadcastPage />);

    await waitFor(() => {
      expect(screen.getByText(/Thông báo cập nhật AI Model v2.4.1/i)).toBeInTheDocument();
    });

    const titleInput = screen.getByPlaceholderText(/VD: Nâng cấp mô hình AI/i);
    const contentInput = screen.getByPlaceholderText(/Nhập nội dung thông báo/i);
    const submitBtn = screen.getByRole('button', { name: /Phát Thông Báo Toàn Mạng Ngay/i });

    fireEvent.change(titleInput, { target: { value: 'Khẩn cấp: Nâng cấp bảo mật máy chủ' } });
    fireEvent.change(contentInput, { target: { value: 'Chi tiết bảo mật hệ thống khẩn' } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Khẩn cấp: Nâng cấp bảo mật máy chủ',
          content: 'Chi tiết bảo mật hệ thống khẩn',
        })
      );
    });

    await waitFor(() => {
      expect(screen.getByText(/Đã phát sóng thông báo toàn mạng/i)).toBeInTheDocument();
    });
  });

  test('handles delete broadcast', async () => {
    const deleteSpy = jest.spyOn(adminBroadcastService, 'deleteAdminBroadcast').mockResolvedValue(true);

    render(<AdminBroadcastPage />);

    await waitFor(() => {
      expect(screen.getByText(/Thông báo cập nhật AI Model v2.4.1/i)).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByTitle(/Gỡ bỏ thông báo này khỏi hệ thống/i);
    expect(deleteButtons.length).toBe(2);

    fireEvent.click(deleteButtons[0]);

    await waitFor(() => {
      expect(deleteSpy).toHaveBeenCalledWith('bc-uuid-1');
    });

    await waitFor(() => {
      expect(screen.getByText(/Đã gỡ bỏ thông báo toàn mạng thành công/i)).toBeInTheDocument();
    });
  });
});
