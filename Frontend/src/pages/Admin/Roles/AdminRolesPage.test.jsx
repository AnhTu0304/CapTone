import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import AuthContext from '../../../context/AuthContext';
import { AdminRolesPage, resolveUserRole, resolveUserOrg } from './AdminRolesPage';
import adminUsersService from '../../../services/adminUsersService';
import { getAuditLogs } from '../../../services/adminAuditLogsService';

jest.mock('../../../services/adminUsersService');
jest.mock('../../../services/adminAuditLogsService');

const mockUsersData = {
  items: [
    {
      id: 'u-01',
      full_name: 'Nguyen Van Admin',
      email: 'admin@selfheal.com',
      system_roles: ['SUPER_ADMIN'],
      organization_roles: [],
      status: 'ACTIVE',
      last_login_at: '2026-10-28T10:00:00Z',
    },
    {
      id: 'u-02',
      full_name: 'Tran Kiem Dinh',
      email: 'tran@selfheal.com',
      system_roles: ['ADMIN'],
      organization_roles: [],
      status: 'ACTIVE',
      last_login_at: '2026-10-28T09:30:00Z',
    },
    {
      id: 'u-03',
      full_name: 'Le Thi Owner',
      email: 'le@finflow.io',
      system_roles: [],
      organization_roles: [
        {
          organization_id: 'org-01',
          organization_name: 'FinFlow Pay',
          role_code: 'SME_OWNER',
          role_name: 'SME_OWNER',
        },
      ],
      status: 'ACTIVE',
      last_login_at: '2026-10-27T15:00:00Z',
    },
  ],
  pagination: {
    total: 3,
    page: 1,
    limit: 10,
    totalPages: 1,
  },
};

const mockAuditLogsData = {
  data: [
    {
      id: 'AUD-000001',
      timestamp: '28/10/2026 10:15:00',
      actor: 'admin@selfheal.com',
      target: 'tran@selfheal.com',
      action: 'SYSTEM_ROLE_ASSIGNED',
      beforeData: { roles: ['DEVOPS'] },
      afterData: { role: 'ADMIN' },
      metadata: { reason: 'Bổ nhiệm Admin vận hành', role: 'ADMIN' },
    },
  ],
  total: 1,
  page: 1,
  pageSize: 10,
};

const mockAuthValue = {
  user: {
    id: 'u-01',
    email: 'admin@selfheal.com',
    full_name: 'Nguyen Van Admin',
    system_roles: ['SUPER_ADMIN'],
  },
  isAuthenticated: true,
  isSuperAdmin: () => true,
  isAdmin: () => true,
};

describe('AdminRolesPage Component Suite', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    adminUsersService.getUsers.mockResolvedValue(mockUsersData);
    getAuditLogs.mockResolvedValue(mockAuditLogsData);
  });

  test('1. Renders Page Header, Role Hierarchy explainer and Navigation Tabs', async () => {
    render(
      <AuthContext.Provider value={mockAuthValue}>
        <AdminRolesPage />
      </AuthContext.Provider>
    );

    await waitFor(() => {
      expect(screen.getByText('Nguyen Van Admin')).toBeInTheDocument();
    });

    expect(screen.getByText(/Cấp Quyền & Ma Trận Phân Cấp RBAC/i)).toBeInTheDocument();
    expect(screen.getByText('SUPER ADMIN ONLY')).toBeInTheDocument();
    expect(screen.getByText(/Nguyên Tắc Kế Thừa Phân Cấp Vai Trò/i)).toBeInTheDocument();
    expect(screen.getByText(/Gán Vai Trò Người Dùng/i)).toBeInTheDocument();
    expect(screen.getByText(/Ma Trận Quyền Hạn Chi Tiết/i)).toBeInTheDocument();
    expect(screen.getByText(/Nhật Ký Kiểm Toán Phân Quyền/i)).toBeInTheDocument();
  });

  test('2. Fetches and renders real users in User Assignment Tab', async () => {
    render(
      <AuthContext.Provider value={mockAuthValue}>
        <AdminRolesPage />
      </AuthContext.Provider>
    );

    await waitFor(() => {
      expect(screen.getByText('Nguyen Van Admin')).toBeInTheDocument();
    });

    expect(screen.getByText('admin@selfheal.com')).toBeInTheDocument();
    expect(screen.getByText('Tran Kiem Dinh')).toBeInTheDocument();
    expect(screen.getByText('FinFlow Pay')).toBeInTheDocument();
  });

  test('3. Clicking "Chi tiết" opens User Detail Modal without exposing sensitive data', async () => {
    render(
      <AuthContext.Provider value={mockAuthValue}>
        <AdminRolesPage />
      </AuthContext.Provider>
    );

    await waitFor(() => {
      expect(screen.getByText('Nguyen Van Admin')).toBeInTheDocument();
    });

    const detailButtons = screen.getAllByText('Chi tiết');
    fireEvent.click(detailButtons[0]);

    expect(screen.getByText('Hồ Sơ & Thẩm Quyền Tài Khoản')).toBeInTheDocument();
    expect(screen.getByText('MÃ ĐỊNH DANH HỆ THỐNG (USER ID)')).toBeInTheDocument();
    expect(screen.getByText('u-01')).toBeInTheDocument();
    // Verify no password hash or secrets are displayed
    expect(screen.queryByText(/password_hash/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/secret/i)).not.toBeInTheDocument();
  });

  test('4. Opening Role Modal displays safety warning when target role is SUPER_ADMIN', async () => {
    render(
      <AuthContext.Provider value={mockAuthValue}>
        <AdminRolesPage />
      </AuthContext.Provider>
    );

    await waitFor(() => {
      expect(screen.getByText('Tran Kiem Dinh')).toBeInTheDocument();
    });

    const changeRoleButtons = screen.getAllByText('Thay đổi vai trò');
    // Click on Tran Kiem Dinh (index 1)
    fireEvent.click(changeRoleButtons[1]);

    expect(screen.getByText('Điều Chỉnh Thẩm Quyền Phân Cấp')).toBeInTheDocument();

    // Select SUPER_ADMIN
    const select = screen.getByDisplayValue(/ADMIN/i);
    fireEvent.change(select, { target: { value: 'SUPER_ADMIN' } });

    expect(screen.getByText(/Cảnh báo an ninh cấp cao/i)).toBeInTheDocument();
    expect(screen.getByText(/Bạn đang thăng cấp tài khoản này lên SUPER_ADMIN/i)).toBeInTheDocument();
  });

  test('5. Submitting role change calls adminUsersService.assignRole and shows success toast', async () => {
    adminUsersService.assignRole.mockResolvedValueOnce({ success: true });

    render(
      <AuthContext.Provider value={mockAuthValue}>
        <AdminRolesPage />
      </AuthContext.Provider>
    );

    await waitFor(() => {
      expect(screen.getByText('Tran Kiem Dinh')).toBeInTheDocument();
    });

    const changeRoleButtons = screen.getAllByText('Thay đổi vai trò');
    fireEvent.click(changeRoleButtons[1]);

    const select = screen.getByDisplayValue(/ADMIN/i);
    fireEvent.change(select, { target: { value: 'SUPER_ADMIN' } });

    const reasonInput = screen.getByPlaceholderText(/Nhập căn cứ nghiệp vụ/i);
    fireEvent.change(reasonInput, { target: { value: 'Thăng cấp quản trị viên vận hành' } });

    const submitBtn = screen.getByText('Lưu & Áp Dụng Ngay');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(adminUsersService.assignRole).toHaveBeenCalledWith(
        'u-02',
        'SUPER_ADMIN',
        'Thăng cấp quản trị viên vận hành'
      );
    });

    await waitFor(() => {
      expect(screen.getByRole('status')).toBeInTheDocument();
    });
  });

  test('6. Displays backend error in modal when demoting sole Super Admin fails', async () => {
    adminUsersService.assignRole.mockRejectedValueOnce(
      new Error('Không thể hạ cấp hoặc thu hồi Super Admin cuối cùng của hệ thống. Hệ thống phải duy trì ít nhất một Super Admin khả dụng.')
    );

    render(
      <AuthContext.Provider value={mockAuthValue}>
        <AdminRolesPage />
      </AuthContext.Provider>
    );

    await waitFor(() => {
      expect(screen.getByText('Nguyen Van Admin')).toBeInTheDocument();
    });

    const changeRoleButtons = screen.getAllByText('Thay đổi vai trò');
    fireEvent.click(changeRoleButtons[0]);

    const select = screen.getByDisplayValue(/SUPER_ADMIN/i);
    fireEvent.change(select, { target: { value: 'ADMIN' } });

    const submitBtn = screen.getByText('Lưu & Áp Dụng Ngay');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/Không thể hạ cấp hoặc thu hồi Super Admin cuối cùng/i)).toBeInTheDocument();
    });
  });

  test('7. Tab 2: Clicking Ma Trận Quyền Hạn displays read-only permissions matrix', async () => {
    render(
      <AuthContext.Provider value={mockAuthValue}>
        <AdminRolesPage />
      </AuthContext.Provider>
    );

    await waitFor(() => {
      expect(screen.getByText('Nguyen Van Admin')).toBeInTheDocument();
    });

    const matrixTab = screen.getByText(/Ma Trận Quyền Hạn Chi Tiết/i);
    fireEvent.click(matrixTab);

    expect(screen.getByText(/Full Permissions Matrix/i)).toBeInTheDocument();
    expect(screen.getByText(/Chế độ Chỉ Đọc/i)).toBeInTheDocument();
    expect(screen.getByText('Quản Trị Toàn Nền Tảng & RBAC')).toBeInTheDocument();
    expect(screen.getByText('/api/v1/roles/**')).toBeInTheDocument();
  });

  test('8. Tab 3: Clicking Nhật Ký Kiểm Toán fetches and renders audit trail from API', async () => {
    render(
      <AuthContext.Provider value={mockAuthValue}>
        <AdminRolesPage />
      </AuthContext.Provider>
    );

    await waitFor(() => {
      expect(screen.getByText('Nguyen Van Admin')).toBeInTheDocument();
    });

    const auditTab = screen.getByText(/Nhật Ký Kiểm Toán Phân Quyền/i);
    fireEvent.click(auditTab);

    await waitFor(() => {
      expect(screen.getByText('Bổ nhiệm Admin vận hành')).toBeInTheDocument();
    });

    expect(screen.getByText(/RBAC Audit Trail/i)).toBeInTheDocument();
  });
  test('9. resolveUserRole prioritizes system roles and highest organization roles', () => {
    // SuperAdmin
    expect(resolveUserRole({ system_roles: ['SUPER_ADMIN'] })).toBe('SUPER_ADMIN');
    // Admin
    expect(resolveUserRole({ system_roles: ['ADMIN'] })).toBe('ADMIN');
    // Multiple org roles: SME_OWNER beats VIEWER
    expect(
      resolveUserRole({
        system_roles: [],
        organization_roles: [
          { organization_name: 'Org A', role_code: 'VIEWER' },
          { organization_name: 'Org B', role_code: 'SME_OWNER' },
        ],
      })
    ).toBe('SME_OWNER');
    // User with system_roles: ['USER'] and SME_OWNER in org
    expect(
      resolveUserRole({
        system_roles: ['USER'],
        organization_roles: [{ organization_name: 'Org C', role_code: 'SME_OWNER' }],
      })
    ).toBe('SME_OWNER');
    // Default fallback
    expect(resolveUserRole({})).toBe('VIEWER');
  });

  test('10. resolveUserOrg formats platform and multi-tenant org strings correctly', () => {
    // SuperAdmin platform root
    expect(resolveUserOrg({ system_roles: ['SUPER_ADMIN'] })).toBe('Toàn Hệ Thống (Platform Root)');
    // Admin operations
    expect(resolveUserOrg({ system_roles: ['ADMIN'] })).toBe('Platform Operations');
    // Single org
    expect(
      resolveUserOrg({
        organization_roles: [{ organization_name: 'Acme Cloud Corp', role_code: 'SME_OWNER' }],
      })
    ).toBe('Acme Cloud Corp');
    // Multiple orgs
    expect(
      resolveUserOrg({
        organization_roles: [
          { organization_name: 'Org A', role_code: 'VIEWER' },
          { organization_name: 'Acme Cloud Corp', role_code: 'SME_OWNER' },
        ],
      })
    ).toBe('Acme Cloud Corp (+1 khác)');
    // No org
    expect(resolveUserOrg({})).toBe('Chưa liên kết tổ chức');
  });
});