import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import UserProfileDropdown from './UserProfileDropdown';

const mockSuperAdminUser = {
  id: 'usr-admin-01',
  email: 'admin@selfheal.systems',
  full_name: 'Quản Trị Tối Cao',
  system_roles: ['SUPER_ADMIN'],
  roles: ['SUPER_ADMIN'],
};

const mockSmeOwnerUser = {
  id: 'usr-sme-02',
  email: 'owner@vietcorp.vn',
  full_name: 'Trần Văn Doanh',
  system_roles: [],
  organization_roles: ['SME_OWNER'],
  roles: ['SME_OWNER'],
};

let mockCurrentMockUser = mockSuperAdminUser;
const mockLogout = jest.fn();

jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    user: mockCurrentMockUser,
    logout: mockLogout,
    getInitials: (name) => {
      const parts = name.trim().split(' ').filter(Boolean);
      return parts.length >= 2
        ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
        : name.slice(0, 2).toUpperCase();
    },
    isAdmin: (u) => u?.system_roles?.includes('SUPER_ADMIN') || false,
    isSuperAdmin: (u) => u?.system_roles?.includes('SUPER_ADMIN') || false,
  }),
}));

describe('UserProfileDropdown Component - Unified Design Reference Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
    mockCurrentMockUser = mockSuperAdminUser;
  });

  test('TC01: Hiển thị đúng Avatar monogram, tên người dùng và nhãn vai trò trên Header', () => {
    render(<UserProfileDropdown />);

    // Kiểm tra monogram và tên trên nút trigger
    expect(screen.getByText('QC')).toBeInTheDocument(); // Quản Trị Tối Cao -> QC
    expect(screen.getByText('Quản Trị Tối Cao')).toBeInTheDocument();
    expect(screen.getByText('SUPER ADMIN')).toBeInTheDocument();
  });

  test('TC02: Mở menu dropdown hiển thị đầy đủ User Card (Avatar, Tên, Email, Role Badge)', () => {
    render(<UserProfileDropdown />);

    const trigger = screen.getByRole('button', { name: /Menu hồ sơ/i });
    fireEvent.click(trigger);

    // Card header
    expect(screen.getByText('admin@selfheal.systems')).toBeInTheDocument();
    expect(screen.getByText('Toàn Quyền Cụm & Chính Sách')).toBeInTheDocument();

    // Menu items
    expect(screen.getByText('Không Gian Cá Nhân (Personal Portal)')).toBeInTheDocument();
    expect(screen.getByText('Bảng Điều Khiển Doanh Nghiệp (Owner / User)')).toBeInTheDocument();
    expect(screen.getByText('Bảng Quản Trị Hệ Thống (Admin)')).toBeInTheDocument();
    expect(screen.getByText('Xem Hồ Sơ Cá Nhân')).toBeInTheDocument();
    expect(screen.getByText('Bảo Mật & Đổi Mật Khẩu')).toBeInTheDocument();
    expect(screen.getByText('Nhật Ký Kiểm Toán SHA-256')).toBeInTheDocument();
    expect(screen.getByText('Thiết Lập Hệ Thống')).toBeInTheDocument();
    expect(screen.getByText('Đăng Xuất Tài Khoản')).toBeInTheDocument();
  });

  test('TC03: Đóng menu khi bấm phím Escape hoặc click ra ngoài', () => {
    render(
      <div>
        <div data-testid="outside-element">Bên ngoài</div>
        <UserProfileDropdown />
      </div>
    );

    const trigger = screen.getByRole('button', { name: /Menu hồ sơ/i });
    fireEvent.click(trigger);
    expect(screen.getByText('admin@selfheal.systems')).toBeInTheDocument();

    // Nhấn phím Escape
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByText('admin@selfheal.systems')).not.toBeInTheDocument();

    // Mở lại và click ra ngoài
    fireEvent.click(trigger);
    expect(screen.getByText('admin@selfheal.systems')).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByTestId('outside-element'));
    expect(screen.queryByText('admin@selfheal.systems')).not.toBeInTheDocument();
  });

  test('TC04: Tài khoản SME_OWNER không hiển thị menu Admin hay Nhật ký kiểm toán', () => {
    mockCurrentMockUser = mockSmeOwnerUser;
    render(<UserProfileDropdown />);

    const trigger = screen.getByRole('button', { name: /Menu hồ sơ/i });
    fireEvent.click(trigger);

    expect(screen.getAllByText('Trần Văn Doanh').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('owner@vietcorp.vn')).toBeInTheDocument();
    expect(screen.getByText('Chủ Sở Hữu Doanh Nghiệp')).toBeInTheDocument();

    // Không hiển thị các mục quản trị hệ thống
    expect(screen.queryByText('Bảng Quản Trị Hệ Thống (Admin)')).not.toBeInTheDocument();
    expect(screen.queryByText('Nhật Ký Kiểm Toán SHA-256')).not.toBeInTheDocument();
    expect(screen.queryByText('Thiết Lập Hệ Thống')).not.toBeInTheDocument();

    // Hiển thị các mục thông thường
    expect(screen.getByText('Không Gian Cá Nhân (Personal Portal)')).toBeInTheDocument();
    expect(screen.getByText('Bảng Điều Khiển Doanh Nghiệp (Owner / User)')).toBeInTheDocument();
    expect(screen.getByText('Cài Đặt Tài Khoản')).toBeInTheDocument();
  });

  test('TC05: Chuyển trang và đăng xuất hoạt động chính xác', () => {
    const mockNavigate = jest.fn();
    render(<UserProfileDropdown onNavigate={mockNavigate} />);

    const trigger = screen.getByRole('button', { name: /Menu hồ sơ/i });
    fireEvent.click(trigger);

    // Chuyển sang Personal Portal
    fireEvent.click(screen.getByText('Không Gian Cá Nhân (Personal Portal)'));
    expect(mockNavigate).toHaveBeenCalledWith('/portal');

    // Mở lại và bấm Đăng xuất
    fireEvent.click(trigger);
    fireEvent.click(screen.getByText('Đăng Xuất Tài Khoản'));
    expect(mockLogout).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith('/login');
  });
});
