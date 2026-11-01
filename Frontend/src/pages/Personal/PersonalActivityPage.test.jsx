import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { PersonalActivityPage } from './PersonalActivityPage';
import { personalPortalService } from '../../services/personalPortalService';

jest.mock('../../services/personalPortalService', () => ({
  personalPortalService: {
    getActivityHistory: jest.fn(),
    fetchActivityHistory: jest.fn(),
  },
}));

describe('PersonalActivityPage Suite (/personal/activity) - Real Database Audit Logs', () => {
  const mockActivities = [
    {
      id: '24',
      actionType: 'AUTH_LOGIN_SUCCESS',
      title: 'Đăng nhập vào hệ thống',
      description: 'Đăng nhập thành công từ trình duyệt Chrome trên Windows 11',
      timestamp: '01/11/2026 13:36:32',
      ipAddress: '118.70.12.84',
      category: 'AUTH',
      status: 'SUCCESS',
    },
    {
      id: '25',
      actionType: 'USER_PROFILE_UPDATED',
      title: 'Cập nhật hồ sơ cá nhân',
      description: 'Cập nhật chức danh chuyên môn và số điện thoại liên hệ cá nhân',
      timestamp: '31/10/2026 15:36:32',
      ipAddress: '118.70.12.84',
      category: 'PROFILE',
      status: 'SUCCESS',
    },
    {
      id: '26',
      actionType: '2FA_ENABLED',
      title: 'Bảo mật xác thực hai yếu tố (2FA)',
      description: 'Kích hoạt thành công mã xác thực TOTP Authenticator cho tài khoản',
      timestamp: '29/10/2026 15:36:32',
      ipAddress: '118.70.12.84',
      category: 'SECURITY',
      status: 'SUCCESS',
    },
    {
      id: '27',
      actionType: 'USER_PASSWORD_CHANGED',
      title: 'Đổi mật khẩu tài khoản',
      description: 'Thay đổi mật khẩu đăng nhập định kỳ bảo mật',
      timestamp: '27/10/2026 15:36:32',
      ipAddress: '27.72.63.190',
      category: 'SECURITY',
      status: 'SUCCESS',
    },
    {
      id: '28',
      actionType: 'ORG_CREATED',
      title: 'Khởi tạo Company mới',
      description: 'Khởi tạo tổ chức mới Cloud DevOps Engineering Hub',
      timestamp: '22/10/2026 15:36:32',
      ipAddress: '118.70.12.84',
      category: 'COMPANY',
      status: 'SUCCESS',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    personalPortalService.getActivityHistory.mockReturnValue([]);
    personalPortalService.fetchActivityHistory.mockResolvedValue(mockActivities);
  });

  test('TC01: Render tiêu đề, mô tả và nút điều khiển trên trang Activity History', async () => {
    await act(async () => {
      render(<PersonalActivityPage />);
    });

    expect(
      screen.getByText('Activity History — Lịch Sử Hoạt Động Cá Nhân')
    ).toBeInTheDocument();
    expect(screen.getByText(/Nhật ký kiểm toán toàn diện/i)).toBeInTheDocument();
    expect(screen.getByText('Làm mới')).toBeInTheDocument();
    expect(screen.getByText('Xuất Báo Cáo CSV')).toBeInTheDocument();
  });

  test('TC02: Gọi fetchActivityHistory và hiển thị danh sách nhật ký từ Database', async () => {
    await act(async () => {
      render(<PersonalActivityPage />);
    });

    await waitFor(() => {
      expect(personalPortalService.fetchActivityHistory).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.getByText('Đăng nhập vào hệ thống')).toBeInTheDocument();
      expect(screen.getByText('Cập nhật hồ sơ cá nhân')).toBeInTheDocument();
      expect(screen.getByText('Bảo mật xác thực hai yếu tố (2FA)')).toBeInTheDocument();
      expect(screen.getByText('Khởi tạo Company mới')).toBeInTheDocument();
    });

    // Kiểm tra IP và trạng thái
    expect(screen.getAllByText('118.70.12.84').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Hoàn thành').length).toBe(5);
  });

  test('TC03: Lọc theo phân loại category (Bảo mật & 2FA)', async () => {
    await act(async () => {
      render(<PersonalActivityPage />);
    });

    await waitFor(() => {
      expect(screen.getByText('Đăng nhập vào hệ thống')).toBeInTheDocument();
    });

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'SECURITY' } });

    await waitFor(() => {
      expect(screen.queryByText('Đăng nhập vào hệ thống')).not.toBeInTheDocument();
      expect(screen.getByText('Bảo mật xác thực hai yếu tố (2FA)')).toBeInTheDocument();
      expect(screen.getByText('Đổi mật khẩu tài khoản')).toBeInTheDocument();
    });
  });

  test('TC04: Tìm kiếm theo từ khóa IP hoặc nội dung sự kiện', async () => {
    await act(async () => {
      render(<PersonalActivityPage />);
    });

    await waitFor(() => {
      expect(screen.getByText('Đăng nhập vào hệ thống')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/Tìm theo hành động, IP/i);
    fireEvent.change(searchInput, { target: { value: '27.72.63.190' } });

    await waitFor(() => {
      expect(screen.getByText('Đổi mật khẩu tài khoản')).toBeInTheDocument();
      expect(screen.queryByText('Đăng nhập vào hệ thống')).not.toBeInTheDocument();
    });
  });

  test('TC05: Hiển thị Empty state khi không tìm thấy kết quả nào', async () => {
    await act(async () => {
      render(<PersonalActivityPage />);
    });

    await waitFor(() => {
      expect(screen.getByText('Đăng nhập vào hệ thống')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/Tìm theo hành động, IP/i);
    fireEvent.change(searchInput, { target: { value: 'chuỗi_không_tồn_tại_99999' } });

    await waitFor(() => {
      expect(screen.getByText('Không có hoạt động nào')).toBeInTheDocument();
      expect(
        screen.getByText(/Không có sự kiện phù hợp với từ khóa hoặc bộ lọc đã chọn/i)
      ).toBeInTheDocument();
    });
  });

  test('TC06: Bấm nút Làm mới sẽ gọi lại API fetchActivityHistory', async () => {
    await act(async () => {
      render(<PersonalActivityPage />);
    });

    await waitFor(() => {
      expect(personalPortalService.fetchActivityHistory).toHaveBeenCalled();
    });

    const refreshBtn = screen.getByText('Làm mới');
    fireEvent.click(refreshBtn);

    await waitFor(() => {
      expect(personalPortalService.fetchActivityHistory).toHaveBeenCalledTimes(2);
    });
  });

  test('TC07: Bấm Xuất Báo Cáo CSV tạo download URL và không bị lỗi runtime', async () => {
    const mockCreateObjectURL = jest.fn(() => 'blob:mock-url');
    const mockRevokeObjectURL = jest.fn();
    window.URL.createObjectURL = mockCreateObjectURL;
    window.URL.revokeObjectURL = mockRevokeObjectURL;

    await act(async () => {
      render(<PersonalActivityPage />);
    });

    await waitFor(() => {
      expect(screen.getByText('Đăng nhập vào hệ thống')).toBeInTheDocument();
    });

    const exportBtn = screen.getByText('Xuất Báo Cáo CSV');
    expect(() => fireEvent.click(exportBtn)).not.toThrow();
    expect(mockCreateObjectURL).toHaveBeenCalled();
  });
});
