import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { PersonalHeader } from './PersonalHeader';

const mockUser = {
  id: 'usr-dev-99',
  email: 'letanquoc123@gmail.com',
  full_name: 'Lê Tấn Quốc',
};

jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    user: mockUser,
    logout: jest.fn(),
    isSuperAdmin: () => false,
    isAdmin: () => false,
  }),
}));

describe('PersonalHeader Component - Remove "Về Dashboard" Button Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
  });

  test('TC01: Header KHÔNG còn nút "Về Dashboard" trong thanh điều khiển', () => {
    const mockNavigate = jest.fn();
    render(<PersonalHeader currentPath="/portal" onNavigate={mockNavigate} />);

    // Nút "Về Dashboard" trực tiếp trên Header phải không tồn tại
    expect(screen.queryByText('Về Dashboard')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Bàn Điều Khiển Doanh Nghiệp (Dashboard)')).not.toBeInTheDocument();
  });

  test('TC02: Breadcrumb và tiêu đề trang vẫn hiển thị đầy đủ và chính xác', () => {
    render(<PersonalHeader currentPath="/portal" />);

    expect(screen.getByText('Không Gian Cá Nhân')).toBeInTheDocument();
    expect(screen.getAllByText('Bảng Điều Khiển Cá Nhân').length).toBeGreaterThanOrEqual(1);

    // Kiểm tra trang con khác: ví dụ /portal/companies
    render(<PersonalHeader currentPath="/portal/companies" />);
    expect(screen.getAllByText('Company Của Tôi').length).toBeGreaterThanOrEqual(1);
  });

  test('TC03: Nút Thông Báo vẫn hoạt động và điều hướng đến /portal/notifications', () => {
    const mockNavigate = jest.fn();
    render(<PersonalHeader currentPath="/portal" onNavigate={mockNavigate} />);

    const notifBtn = screen.getByTitle('Thông Báo Cá Nhân');
    expect(notifBtn).toBeInTheDocument();
    fireEvent.click(notifBtn);

    expect(mockNavigate).toHaveBeenCalledWith('/portal/notifications');
  });

  test('TC04: Menu tài khoản mở ra đầy đủ các mục chức năng và không bị ảnh hưởng', () => {
    const mockNavigate = jest.fn();
    render(<PersonalHeader currentPath="/portal" onNavigate={mockNavigate} />);

    // Click profile dropdown trigger
    const profileBtn = screen.getByText('Lê Tấn Quốc').closest('button');
    expect(profileBtn).toBeInTheDocument();
    fireEvent.click(profileBtn);

    // Profile dropdown items appear
    expect(screen.getByText('Xem Hồ Sơ Cá Nhân')).toBeInTheDocument();
    expect(screen.getByText('Bảo Mật & Đổi Mật Khẩu')).toBeInTheDocument();
    expect(screen.getByText('Bàn Điều Khiển Doanh Nghiệp')).toBeInTheDocument();
    expect(screen.getByText('Đăng Xuất Tài Khoản')).toBeInTheDocument();

    // Click Bàn Điều Khiển Doanh Nghiệp inside dropdown
    fireEvent.click(screen.getByText('Bàn Điều Khiển Doanh Nghiệp'));
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
  });
});
