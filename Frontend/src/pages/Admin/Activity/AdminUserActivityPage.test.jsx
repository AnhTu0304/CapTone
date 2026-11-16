import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AdminUserActivityPage } from './AdminUserActivityPage';
import * as adminAuditLogsService from '../../../services/adminAuditLogsService';

jest.mock('../../../services/adminAuditLogsService');

describe('AdminUserActivityPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders correctly with real data from backend service', async () => {
    adminAuditLogsService.getUserActivityStats.mockResolvedValue({
      totalLogins: 74,
      successLogins: 62,
      failedLogins: 12,
      todayLogins: 5,
      todaySuccessLogins: 5,
      activeUsersCount: 32,
      securityAlerts: 79,
      adminActions: 190,
    });

    adminAuditLogsService.getUserActivities.mockResolvedValue({
      data: [
        {
          id: 'ACT-0001',
          rawId: '16042',
          timestamp: '15/11/2026 10:32:44',
          userName: 'Phạm Thái Sang',
          userEmail: 'phamthaisang1710@gmail.com',
          action: 'ACCESS_DENIED_TENANT',
          actionLabel: 'Từ chối quyền truy cập',
          ipAddress: '172.25.0.1',
          device: 'Chrome 157 / Windows 10/11',
          location: 'Audit Org B',
          riskLevel: 'HIGH',
          details: 'Từ chối truy cập: Bạn không phải là thành viên đang hoạt động của tổ chức này',
          status: 'DENIED',
        },
      ],
      total: 1,
      page: 1,
      pageSize: 10,
      totalPages: 1,
    });

    render(<AdminUserActivityPage />);

    // Kiểm tra tiêu đề trang
    expect(screen.getByText('Theo Dõi Hoạt Động Người Dùng')).toBeInTheDocument();

    // Chờ tải dữ liệu
    await waitFor(() => {
      expect(screen.getByText('Phạm Thái Sang')).toBeInTheDocument();
      expect(screen.getByText('phamthaisang1710@gmail.com')).toBeInTheDocument();
      expect(screen.getByText('172.25.0.1')).toBeInTheDocument();
      expect(screen.getAllByText('Nguy hiểm').length).toBeGreaterThanOrEqual(1);
    });

    // Kiểm tra 4 thẻ KPI
    expect(screen.getByText('74')).toBeInTheDocument(); // Tổng lượt đăng nhập
    expect(screen.getByText('32')).toBeInTheDocument(); // Người dùng active
    expect(screen.getByText('79')).toBeInTheDocument(); // Cảnh báo thất bại
    expect(screen.getByText('190')).toBeInTheDocument(); // Thao tác admin

    // Kiểm tra phân trang chuẩn AdminTablePagination
    expect(screen.getAllByText(/Hiển thị/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole('button', { name: /Trang 1/i })).toBeInTheDocument();

    // Kiểm tra bộ lọc thời gian: mặc định là Hôm nay
    expect(screen.getByTitle('Mở bảng lịch chọn ngày, tháng hoặc năm')).toBeInTheDocument();
    expect(screen.getByText(/Hôm nay \(\d{2}\/\d{2}\/\d{4}\)/)).toBeInTheDocument();
    expect(adminAuditLogsService.getUserActivityStats).toHaveBeenCalledWith(
      expect.objectContaining({
        timeFilterMode: 'today',
      })
    );
  });

  it('toggles calendar popover and allows mode switching', async () => {
    adminAuditLogsService.getUserActivityStats.mockResolvedValue({
      totalLogins: 10,
      successLogins: 8,
      failedLogins: 2,
      todayLogins: 1,
      todaySuccessLogins: 1,
      activeUsersCount: 5,
      securityAlerts: 2,
      adminActions: 3,
    });

    adminAuditLogsService.getUserActivities.mockResolvedValue({
      data: [],
      total: 0,
      page: 1,
      pageSize: 10,
      totalPages: 1,
    });

    const { fireEvent } = await import('@testing-library/react');
    render(<AdminUserActivityPage />);

    await waitFor(() => {
      expect(screen.queryByText('Đang nạp dữ liệu hoạt động người dùng thực tế...')).not.toBeInTheDocument();
    });

    const calBtn = screen.getByTitle('Mở bảng lịch chọn ngày, tháng hoặc năm');
    expect(calBtn).toBeInTheDocument();

    // Ban đầu popover chưa mở
    expect(screen.queryByText('Chọn ngày cụ thể:')).not.toBeInTheDocument();

    // Click mở popover
    fireEvent.click(calBtn);
    expect(screen.getByText('Chọn ngày cụ thể:')).toBeInTheDocument();
    expect(screen.getByText('Ngày có sự cố gần đây:')).toBeInTheDocument();
    expect(screen.getByText('Về hôm nay')).toBeInTheDocument();
    expect(screen.getByText('Áp dụng')).toBeInTheDocument();

    // Chuyển sang tab Tháng
    fireEvent.click(screen.getByText('🗓️ Tháng'));
    expect(screen.getByText('Chọn tháng & năm:')).toBeInTheDocument();

    // Chuyển sang tab Năm
    fireEvent.click(screen.getByText('📆 Năm'));
    expect(screen.getByText('Chọn năm khảo sát:')).toBeInTheDocument();

    // Click "Về hôm nay" để quay lại hôm nay và đóng popover
    fireEvent.click(screen.getByText('Về hôm nay'));
    expect(screen.queryByText('Chọn năm khảo sát:')).not.toBeInTheDocument();
  });
});
