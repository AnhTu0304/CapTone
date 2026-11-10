import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { PersonalSecurityPage } from './PersonalSecurityPage';
import { personalPortalService } from '../../services/personalPortalService';

jest.mock('../../services/personalPortalService', () => {
  const original = jest.requireActual('../../services/personalPortalService');
  return {
    ...original,
    personalPortalService: {
      getProfile: jest.fn(() => ({ twoFactorEnabled: true })),
      getActiveSessions: jest.fn(() => [
        {
          id: 'sess-current',
          deviceName: 'Google Chrome trên Windows 11',
          deviceType: 'DESKTOP',
          ipAddress: '127.0.0.1 (Localhost / Mạng nội bộ)',
          lastActive: 'Đang hoạt động (Phiên hiện tại)',
          isCurrent: true,
          browser: 'Google Chrome 128',
          os: 'Windows 11',
        },
      ]),
      revokeOtherSessions: jest.fn(() => [
        {
          id: 'sess-current',
          deviceName: 'Google Chrome trên Windows 11',
          deviceType: 'DESKTOP',
          ipAddress: '127.0.0.1 (Localhost / Mạng nội bộ)',
          lastActive: 'Đang hoạt động (Phiên hiện tại)',
          isCurrent: true,
          browser: 'Google Chrome 128',
          os: 'Windows 11',
        },
      ]),
      fetchLoginHistory: jest.fn(),
      getLoginHistory: jest.fn(() => []),
      changePassword: jest.fn(),
      toggle2FA: jest.fn(),
    },
  };
});

describe('PersonalSecurityPage (/portal/security) - Session & Security Audit', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    personalPortalService.getProfile.mockReturnValue({ twoFactorEnabled: true });
    personalPortalService.getActiveSessions.mockReturnValue([
      {
        id: 'sess-current',
        deviceName: 'Google Chrome trên Windows 11',
        deviceType: 'DESKTOP',
        ipAddress: '127.0.0.1 (Localhost / Mạng nội bộ)',
        lastActive: 'Đang hoạt động (Phiên hiện tại)',
        isCurrent: true,
        browser: 'Google Chrome 128',
        os: 'Windows 11',
      },
    ]);
  });

  test('TC01: Chỉ hiển thị phiên làm việc thực tế của thiết bị hiện tại, không có iPhone hay Ubuntu giả', async () => {
    personalPortalService.fetchLoginHistory.mockResolvedValue([]);

    await act(async () => {
      render(<PersonalSecurityPage />);
    });

    // Xác nhận tiêu đề và huy hiệu
    expect(screen.getAllByText(/Các Phiên Đăng Nhập Đang Hoạt Động/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/phiên đang kết nối/i)).toBeInTheDocument();
    expect(screen.getByTestId('current-device-badge')).toBeInTheDocument();
    expect(screen.getByText(/Google Chrome trên Windows 11/i)).toBeInTheDocument();

    // Tuyệt đối không có các thiết bị ma gây hoang mang
    expect(screen.queryByText(/iPhone 15 Pro/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Ubuntu 24.04/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/14.162.144.12/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/27.72.63.190/i)).not.toBeInTheDocument();
  });

  test('TC02: Nút Đăng Xuất Khỏi Thiết Bị Khác hiển thị (0) và bị vô hiệu hóa khi không có thiết bị lạ', async () => {
    personalPortalService.fetchLoginHistory.mockResolvedValue([]);

    await act(async () => {
      render(<PersonalSecurityPage />);
    });

    const revokeBtn = screen.getByText(/Đăng Xuất Khỏi Thiết Bị Khác \(0\)/i);
    expect(revokeBtn).toBeInTheDocument();
    expect(revokeBtn.closest('button')).toBeDisabled();
  });

  test('TC03: Lịch sử đăng nhập đồng bộ dữ liệu thật từ cơ sở dữ liệu kiểm toán audit_logs', async () => {
    const realLogins = [
      {
        id: 'real-log-1',
        timestamp: '07/11/2026 05:30:12',
        method: 'Email & Mật khẩu',
        ipAddress: '172.25.0.1',
        location: 'Mạng nội bộ / Localhost',
        device: 'Google Chrome trên Windows 11',
        status: 'SUCCESS',
      },
    ];

    personalPortalService.fetchLoginHistory.mockResolvedValue(realLogins);

    await act(async () => {
      render(<PersonalSecurityPage />);
    });

    await waitFor(() => {
      expect(screen.getByText('07/11/2026 05:30:12')).toBeInTheDocument();
    });

    expect(screen.getByText('172.25.0.1')).toBeInTheDocument();
    expect(screen.getByText('Thành công')).toBeInTheDocument();
    expect(screen.queryByText(/Cần Thơ, Việt Nam/i)).not.toBeInTheDocument();
  });

  test('TC04: Khi chưa có lịch sử đăng nhập, hiển thị thông báo rỗng thân thiện', async () => {
    personalPortalService.fetchLoginHistory.mockResolvedValue([]);

    await act(async () => {
      render(<PersonalSecurityPage />);
    });

    await waitFor(() => {
      expect(
        screen.getByText('Chưa có bản ghi lịch sử đăng nhập nào được ghi nhận.')
      ).toBeInTheDocument();
    });
  });

  test('TC05: Hiển thị thanh phân trang đúng chuẩn giao diện (Hiển thị mỗi trang, Trang X trên tổng Y, Trước / Sau)', async () => {
    const dummyLogins = Array.from({ length: 15 }, (_, i) => ({
      id: `real-log-${i}`,
      timestamp: `07/11/2026 05:30:${String(i).padStart(2, '0')}`,
      method: 'Email & Mật khẩu',
      ipAddress: '172.25.0.1',
      location: 'Mạng nội bộ / Localhost',
      device: 'Google Chrome trên Windows 11',
      status: 'SUCCESS',
    }));
    dummyLogins.total = 35;
    dummyLogins.page = 1;
    dummyLogins.limit = 10;

    personalPortalService.fetchLoginHistory.mockResolvedValue(dummyLogins);

    await act(async () => {
      render(<PersonalSecurityPage />);
    });

    await waitFor(() => {
      expect(screen.getByText(/Hiển thị mỗi trang:/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/Trang 1 trên tổng 4/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Trước/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Sau/i })).not.toBeDisabled();
  });
});
