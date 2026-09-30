import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import OverviewPage from './Overview';
import WidgetContainer from '../../components/admin/WidgetContainer';

describe('Admin Overview Page Suite (/admin/overview)', () => {
  test('renders 12 sections and snapshot timestamp after data load', async () => {
    render(<OverviewPage />);

    // Section 1: Page Header
    expect(screen.getByText(/Bàn Điều Khiển Sức Khỏe Nền Tảng/i)).toBeInTheDocument();
    expect(screen.getByText(/PLATFORM HEALTH/i)).toBeInTheDocument();

    // Wait for data load from service layer
    await waitFor(() => {
      expect(screen.getByText(/Ảnh chụp:/i)).toBeInTheDocument();
    });

    // Section 2: Global Scope Selector
    expect(screen.getByLabelText(/Chọn tổ chức/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Chọn môi trường/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Chọn cụm máy chủ/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Chọn khung thời gian/i)).toBeInTheDocument();

    // Section 3: KPI Cards
    expect(screen.getByText(/Độ Khả Dụng Uptime/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Tỷ Lệ Tự Phục Hồi/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Sự Cố Đang Hoạt Động/i)).toBeInTheDocument();
    expect(screen.getByText(/Tài Nguyên Chịu Tải/i)).toBeInTheDocument();

    // Section 4: Platform Health
    expect(screen.getByText(/Sức Khỏe Các Phân Hệ Nền Tảng/i)).toBeInTheDocument();
    expect(screen.getByText(/K8s Control Plane API/i)).toBeInTheDocument();
    expect(screen.getByText(/Đường Truyền Viễn Trắc eBPF/i)).toBeInTheDocument();
    expect(screen.getByText(/Động Cơ Tự Trị AI MAPE-K/i)).toBeInTheDocument();

    // Section 5: Infrastructure Overview
    expect(screen.getByText(/Tổng Quan Hạ Tầng & Phân Bổ Tài Nguyên/i)).toBeInTheDocument();
    expect(screen.getByText(/CPU TỔNG HỢP/i)).toBeInTheDocument();
    expect(screen.getByText(/BỘ NHỚ RAM RSS/i)).toBeInTheDocument();

    // Section 6: Organization Growth
    expect(screen.getByText(/Tăng Trưởng Tổ Chức & Áp Dụng/i)).toBeInTheDocument();
    expect(screen.getByText(/TỔ CHỨC \/ TENANTS/i)).toBeInTheDocument();

    // Section 7: Incident Analytics
    expect(screen.getByText(/Phân Tích Dữ Liệu Sự Cố/i)).toBeInTheDocument();
    expect(screen.getByText(/PHÂN BỐ THEO MỨC ĐỘ/i)).toBeInTheDocument();

    // Section 8: Self-Healing Analytics
    expect(screen.getByText(/Phân Tích Tự Phục Hồi MAPE-K/i)).toBeInTheDocument();
    expect(screen.getByText(/TỰ TRỊ HOÀN TOÀN/i)).toBeInTheDocument();

    // Section 9: AI Overview
    expect(screen.getByText(/Tổng Quan Trí Tuệ Nhân Tạo & Suy Diễn/i)).toBeInTheDocument();
    expect(screen.getByText(/MAPE-K Autonomous Engine v2.4-LTS/i)).toBeInTheDocument();

    // Section 10: Agent Health
    expect(screen.getByText(/Sức Khỏe Tác Tử eBPF/i)).toBeInTheDocument();
    expect(screen.getByText(/12 \/ 12 Máy Chủ Đang Chạy Tác Tử/i)).toBeInTheDocument();

    // Section 11: Critical Incident Feed
    expect(screen.getByText(/Bảng Theo Dõi Sự Cố Nghiêm Trọng/i)).toBeInTheDocument();
    expect(screen.getByText('INC-2026-081')).toBeInTheDocument();

    // Section 12: Recent Activity
    expect(screen.getByText(/Dòng Hoạt Động & Kiểm Toán Gần Nhất/i)).toBeInTheDocument();
    expect(screen.getByText(/Vá cấu hình tự động \(Rolling Patch Memory\)/i)).toBeInTheDocument();
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

  test('handles simulated disconnected state via scope selector', async () => {
    render(<OverviewPage />);

    // Select disconnected test cluster
    const clusterSelect = screen.getByLabelText(/Chọn cụm máy chủ/i);
    fireEvent.change(clusterSelect, { target: { value: 'cluster-disconnected' } });

    await waitFor(() => {
      expect(screen.getAllByText(/Mất Kết Nối Với Cụm Máy Chủ/i).length).toBeGreaterThan(0);
    });
  });

  test('handles simulated error state and retry via scope selector', async () => {
    render(<OverviewPage />);

    // Select error test cluster
    const clusterSelect = screen.getByLabelText(/Chọn cụm máy chủ/i);
    fireEvent.change(clusterSelect, { target: { value: 'cluster-error' } });

    await waitFor(() => {
      expect(screen.getAllByText(/Không Thể Nạp Dữ Liệu/i).length).toBeGreaterThan(0);
    });

    // Check retry button exists
    const retryButtons = screen.getAllByRole('button', { name: /Thử Lại Ngay/i });
    expect(retryButtons.length).toBeGreaterThan(0);
  });

  test('handles simulated empty state via scope selector', async () => {
    render(<OverviewPage />);

    // Select empty time range
    const timeRangeSelect = screen.getByLabelText(/Chọn khung thời gian/i);
    fireEvent.change(timeRangeSelect, { target: { value: 'empty-range' } });

    await waitFor(() => {
      expect(screen.getByText(/Không có sự cố nghiêm trọng nào được ghi nhận trong phạm vi này/i)).toBeInTheDocument();
      expect(screen.getByText(/Không có hoạt động nào được ghi nhận gần đây/i)).toBeInTheDocument();
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
