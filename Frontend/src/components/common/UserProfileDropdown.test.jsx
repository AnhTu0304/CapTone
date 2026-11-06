import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import UserProfileDropdown, {
  resolveUserSystemRole,
} from './UserProfileDropdown';

let mockCurrentUser = null;
const mockLogout = jest.fn();

jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    user: mockCurrentUser,
    logout: mockLogout,
    getInitials: (name) => {
      if (!name) return 'AD';
      const parts = name.trim().split(/\s+/);
      if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    },
  }),
}));

describe('UserProfileDropdown Component - System Role Display Suite', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCurrentUser = null;
    localStorage.clear();
  });

  test('TC01: User có System Role SUPER_ADMIN -> hiển thị SUPER_ADMIN ở header trigger và popover', () => {
    mockCurrentUser = {
      id: 'usr-super-01',
      email: 'superadmin@selfheal.systems',
      full_name: 'Quản Trị Tối Cao',
      system_roles: ['SUPER_ADMIN'],
    };

    render(<UserProfileDropdown />);

    // Header trigger hiển thị đúng họ tên và SUPER_ADMIN
    expect(screen.getByText('Quản Trị Tối Cao')).toBeInTheDocument();
    expect(screen.getByText('SUPER_ADMIN')).toBeInTheDocument();

    // Mở dropdown kiểm tra card badge
    const trigger = screen.getByRole('button', { name: /Menu hồ sơ/i });
    fireEvent.click(trigger);

    expect(screen.getAllByText('SUPER_ADMIN').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Bảng Quản Trị Hệ Thống')).toBeInTheDocument();
    expect(screen.getByText('Nhật Ký Kiểm Toán SHA-256')).toBeInTheDocument();
  });

  test('TC02: User có System Role SYSTEM_ADMIN -> hiển thị SYSTEM_ADMIN', () => {
    mockCurrentUser = {
      id: 'usr-sysadmin-02',
      email: 'sysadmin@selfheal.systems',
      full_name: 'Quản Trị Vận Hành',
      system_roles: ['SYSTEM_ADMIN'],
    };

    render(<UserProfileDropdown />);

    expect(screen.getByText('Quản Trị Vận Hành')).toBeInTheDocument();
    expect(screen.getByText('SYSTEM_ADMIN')).toBeInTheDocument();

    const trigger = screen.getByRole('button', { name: /Menu hồ sơ/i });
    fireEvent.click(trigger);

    expect(screen.getAllByText('SYSTEM_ADMIN').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Bảng Quản Trị Hệ Thống')).toBeInTheDocument();
  });

  test('TC03: User có cả System Role và Company Role -> menu cá nhân hiển thị System Role', () => {
    mockCurrentUser = {
      id: 'usr-mixed-03',
      email: 'admin.devops@company.vn',
      full_name: 'Phan Minh Hoàng',
      system_roles: ['SYSTEM_ADMIN'],
      organization_roles: ['DEVOPS'],
      roles: ['DEVOPS'],
    };

    render(<UserProfileDropdown />);

    // Menu cá nhân PHẢI hiển thị System Role SYSTEM_ADMIN, không hiển thị DEVOPS hay Kỹ Sư Vận Hành
    expect(screen.getByText('SYSTEM_ADMIN')).toBeInTheDocument();
    expect(screen.queryByText('DEVOPS')).not.toBeInTheDocument();
    expect(screen.queryByText('Kỹ Sư Vận Hành')).not.toBeInTheDocument();

    const trigger = screen.getByRole('button', { name: /Menu hồ sơ/i });
    fireEvent.click(trigger);

    expect(screen.getAllByText('SYSTEM_ADMIN').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText('Kỹ Sư Vận Hành')).not.toBeInTheDocument();
  });

  test('TC04: User chỉ có Company Role -> không hiển thị role badge ở header trigger (USER ẩn)', () => {
    mockCurrentUser = {
      id: 'b8a9893a-aa44-44a3-8524-6130d66993e2',
      email: 'sieulv@vietcorp.vn',
      full_name: '25-Lê Văn Siêu',
      system_roles: [],
      organization_roles: ['DEVOPS'],
      roles: ['DEVOPS'],
    };

    render(<UserProfileDropdown />);

    expect(screen.getByText('25-Lê Văn Siêu')).toBeInTheDocument();
    expect(screen.queryByText('SUPER_ADMIN')).not.toBeInTheDocument();
    expect(screen.queryByText('Kỹ Sư Vận Hành')).not.toBeInTheDocument();
    expect(screen.queryByText('DEVOPS')).not.toBeInTheDocument();

    const trigger = screen.getByRole('button', { name: /Menu hồ sơ/i });
    fireEvent.click(trigger);

    expect(screen.queryByText('Bảng Quản Trị Hệ Thống')).not.toBeInTheDocument();
    expect(screen.getByText('Cài Đặt Tài Khoản')).toBeInTheDocument();
  });

  test('TC05: User có nhiều Company Role -> không lấy Company Role để hiển thị', () => {
    mockCurrentUser = {
      id: 'usr-multi-company-05',
      email: 'owner.dev@startup.io',
      full_name: 'Đặng Tuấn Anh',
      system_roles: [],
      organization_roles: ['SME_OWNER', 'DEVOPS'],
      roles: ['SME_OWNER', 'DEVOPS'],
    };

    render(<UserProfileDropdown />);

    expect(screen.getByText('Đặng Tuấn Anh')).toBeInTheDocument();
    expect(screen.queryByText('SME_OWNER')).not.toBeInTheDocument();
    expect(screen.queryByText('Chủ Sở Hữu Doanh Nghiệp')).not.toBeInTheDocument();
    expect(screen.queryByText('Kỹ Sư Vận Hành')).not.toBeInTheDocument();
  });

  test('TC06: User có nhiều System Role -> hiển thị theo phân cấp ưu tiên (SUPER_ADMIN > SYSTEM_ADMIN > ADMIN > USER)', () => {
    // 1. ADMIN và SUPER_ADMIN -> SUPER_ADMIN
    expect(
      resolveUserSystemRole({
        system_roles: ['ADMIN', 'SUPER_ADMIN'],
      })
    ).toBe('SUPER_ADMIN');

    // 2. USER và SYSTEM_ADMIN -> SYSTEM_ADMIN
    expect(
      resolveUserSystemRole({
        system_roles: ['USER', 'SYSTEM_ADMIN'],
      })
    ).toBe('SYSTEM_ADMIN');

    // 3. USER và ADMIN -> ADMIN
    expect(
      resolveUserSystemRole({
        system_roles: ['USER', 'ADMIN'],
      })
    ).toBe('ADMIN');

    // Kiểm tra render component với nhiều System Role:
    mockCurrentUser = {
      id: 'usr-multi-sys-06',
      email: 'boss@selfheal.systems',
      full_name: 'Trần Đại Nghĩa',
      system_roles: ['ADMIN', 'SUPER_ADMIN'],
    };

    render(<UserProfileDropdown />);
    expect(screen.getByText('SUPER_ADMIN')).toBeInTheDocument();
  });

  test('TC07: Thay đổi System Role trong DB -> giao diện cập nhật theo dữ liệu mới', () => {
    // Ban đầu user chưa có System Role (ẩn role subtitle)
    mockCurrentUser = {
      id: 'usr-dynamic-07',
      email: 'dynamic@company.vn',
      full_name: 'Nguyễn Tiến Đạt',
      system_roles: [],
    };

    const { rerender } = render(<UserProfileDropdown />);
    expect(screen.getByText('Nguyễn Tiến Đạt')).toBeInTheDocument();
    expect(screen.queryByText('SUPER_ADMIN')).not.toBeInTheDocument();

    // Cập nhật DB cấp System Role SUPER_ADMIN cho user
    mockCurrentUser = {
      id: 'usr-dynamic-07',
      email: 'dynamic@company.vn',
      full_name: 'Nguyễn Tiến Đạt',
      system_roles: ['SUPER_ADMIN'],
    };

    rerender(<UserProfileDropdown />);
    expect(screen.getByText('SUPER_ADMIN')).toBeInTheDocument();
  });

  test('TC08: Đóng menu khi bấm Escape hoặc click ra ngoài, và điều hướng / đăng xuất chính xác', () => {
    mockCurrentUser = {
      id: 'usr-nav-08',
      email: 'tester@selfheal.systems',
      full_name: 'Kiểm Thử Viên',
      system_roles: ['SUPER_ADMIN'],
    };

    const mockNavigate = jest.fn();
    render(
      <div>
        <div data-testid="outside-area">Vùng ngoài</div>
        <UserProfileDropdown onNavigate={mockNavigate} />
      </div>
    );

    const trigger = screen.getByRole('button', { name: /Menu hồ sơ/i });
    fireEvent.click(trigger);
    expect(screen.getByText('tester@selfheal.systems')).toBeInTheDocument();

    // Bấm Escape đóng menu
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByText('tester@selfheal.systems')).not.toBeInTheDocument();

    // Mở lại và click ra ngoài
    fireEvent.click(trigger);
    expect(screen.getByText('tester@selfheal.systems')).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByTestId('outside-area'));
    expect(screen.queryByText('tester@selfheal.systems')).not.toBeInTheDocument();

    // Mở lại và bấm điều hướng
    fireEvent.click(trigger);
    fireEvent.click(screen.getByText('Không Gian Cá Nhân'));
    expect(mockNavigate).toHaveBeenCalledWith('/portal');

    // Mở lại và bấm Đăng xuất
    fireEvent.click(trigger);
    fireEvent.click(screen.getByText('Đăng Xuất Tài Khoản'));
    expect(mockLogout).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith('/login');
  });

  test('TC09: Tài khoản thường có System Role USER -> không hiển thị nhãn USER theo yêu cầu', () => {
    mockCurrentUser = {
      id: 'usr-normal-09',
      email: 'psang8348@gmail.com',
      full_name: 'Sang Phạm',
      system_roles: ['USER'],
    };

    render(<UserProfileDropdown />);

    // Hiển thị họ tên
    expect(screen.getByText('Sang Phạm')).toBeInTheDocument();
    // Tuyệt đối không hiển thị nhãn USER dưới tên theo yêu cầu
    expect(screen.queryByText('USER')).not.toBeInTheDocument();
  });

  test('TC10: Họ tên có chứa hậu tố (Super Admin) hoặc (Admin) -> tự động xóa sạch', () => {
    mockCurrentUser = {
      id: 'usr-suffix-10',
      email: 'phamthaisang1710@gmail.com',
      full_name: 'Phạm Thái Sang (Super Admin)',
      system_roles: ['SUPER_ADMIN'],
    };

    render(<UserProfileDropdown />);

    // Tên hiển thị phải là "Phạm Thái Sang" sạch sẽ
    expect(screen.getByText('Phạm Thái Sang')).toBeInTheDocument();
    expect(screen.queryByText('Phạm Thái Sang (Super Admin)')).not.toBeInTheDocument();
  });
});
