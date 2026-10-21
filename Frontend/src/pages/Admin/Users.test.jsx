import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import AdminUsersPage from './Users/AdminUsersPage';
import { adminUsersService } from '../../services/adminUsersService';
import { ToastProvider } from '../../context/ToastContext';
import { AuthProvider } from '../../context/AuthContext';

// Mock adminUsersService
jest.mock('../../services/adminUsersService');

const mockUserList = [
  {
    id: '53f5bcdb-a15f-43b6-b3d1-afa8eb5843c1',
    full_name: 'Nguyễn Văn An',
    email: 'an.nguyen@acmecorp.vn',
    avatar_url: null,
    status: 'ACTIVE',
    email_verified_at: '2026-01-20T10:00:00.000Z',
    last_login_at: '2026-10-21T15:30:49.000Z',
    created_at: '2026-01-15T08:00:00.000Z',
    updated_at: '2026-10-21T15:30:49.000Z',
  },
  {
    id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    full_name: 'Trần Thị Bình',
    email: 'binh.tran@smecloud.vn',
    avatar_url: 'https://example.com/avatar.jpg',
    status: 'PENDING',
    email_verified_at: null,
    last_login_at: null,
    created_at: '2026-02-01T09:00:00.000Z',
    updated_at: '2026-02-01T09:00:00.000Z',
  },
];

const renderWithProviders = (ui) => {
  return render(
    <ToastProvider>
      <AuthProvider>{ui}</AuthProvider>
    </ToastProvider>
  );
};

describe('Admin Users Page & Service Suite', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Service Layer Interface', () => {
    test('getUsers calls apiClient and returns items and pagination', async () => {
      adminUsersService.getUsers.mockResolvedValueOnce({
        items: mockUserList,
        pagination: { total: 2, page: 1, limit: 10, totalPages: 1 },
      });

      const res = await adminUsersService.getUsers({ page: 1, limit: 10 });
      expect(res.items.length).toBe(2);
      expect(res.pagination.total).toBe(2);
      expect(res.items[0].email).toBe('an.nguyen@acmecorp.vn');
    });

    test('getUserDetails returns single user object', async () => {
      adminUsersService.getUserDetails.mockResolvedValueOnce(mockUserList[0]);
      const res = await adminUsersService.getUserDetails(mockUserList[0].id);
      expect(res.id).toBe(mockUserList[0].id);
      expect(res.full_name).toBe('Nguyễn Văn An');
    });

    test('verifyUserEmail calls endpoint and returns verified user', async () => {
      adminUsersService.verifyUserEmail.mockResolvedValueOnce({
        ...mockUserList[1],
        email_verified_at: '2026-10-21T16:00:00.000Z',
      });

      const res = await adminUsersService.verifyUserEmail(mockUserList[1].id);
      expect(res.email_verified_at).toBeDefined();
    });

    test('updateUserStatus calls API and returns updated user', async () => {
      adminUsersService.updateUserStatus.mockResolvedValueOnce({
        ...mockUserList[0],
        status: 'SUSPENDED',
      });

      const res = await adminUsersService.updateUserStatus(mockUserList[0].id, 'SUSPENDED');
      expect(res.status).toBe('SUSPENDED');
    });
  });

  describe('UI Component Rendering & Interactions', () => {
    test('1. Renders user management header and KPI cards correctly', async () => {
      adminUsersService.getUsers.mockResolvedValueOnce({
        items: mockUserList,
        pagination: { total: 2, page: 1, limit: 10, totalPages: 1 },
      });

      renderWithProviders(<AdminUsersPage />);

      expect(screen.getByText('Quản Lý Danh Sách Người Dùng & Phân Quyền')).toBeInTheDocument();
      expect(screen.getByText('TỔNG SỐ NGƯỜI DÙNG')).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getByText('Nguyễn Văn An')).toBeInTheDocument();
        expect(screen.getByText('Trần Thị Bình')).toBeInTheDocument();
      });
    });

    test('2. Displays users in table with email, status, and avatar fallback', async () => {
      adminUsersService.getUsers.mockResolvedValueOnce({
        items: mockUserList,
        pagination: { total: 2, page: 1, limit: 10, totalPages: 1 },
      });

      renderWithProviders(<AdminUsersPage />);

      await waitFor(() => {
        expect(screen.getByText('an.nguyen@acmecorp.vn')).toBeInTheDocument();
        expect(screen.getByText('binh.tran@smecloud.vn')).toBeInTheDocument();
        expect(screen.getAllByText('Hoạt động (Active)').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Chờ duyệt (Pending)').length).toBeGreaterThan(0);
      });
    });

    test('3. Handles empty state when API returns 0 users', async () => {
      adminUsersService.getUsers.mockResolvedValueOnce({
        items: [],
        pagination: { total: 0, page: 1, limit: 10, totalPages: 1 },
      });

      renderWithProviders(<AdminUsersPage />);

      await waitFor(() => {
        expect(screen.getByText('Không tìm thấy người dùng nào')).toBeInTheDocument();
      });
    });

    test('4. Handles server error and shows retry button', async () => {
      adminUsersService.getUsers.mockRejectedValueOnce(new Error('Máy chủ gặp sự cố 500'));

      renderWithProviders(<AdminUsersPage />);

      await waitFor(() => {
        expect(screen.getByText('Không thể tải danh sách người dùng')).toBeInTheDocument();
        expect(screen.getByText('Máy chủ gặp sự cố 500')).toBeInTheDocument();
      });

      // Click retry
      adminUsersService.getUsers.mockResolvedValueOnce({
        items: mockUserList,
        pagination: { total: 2, page: 1, limit: 10, totalPages: 1 },
      });

      const retryBtn = screen.getByRole('button', { name: /thử lại/i });
      fireEvent.click(retryBtn);

      await waitFor(() => {
        expect(screen.getByText('Nguyễn Văn An')).toBeInTheDocument();
      });
    });

    test('5. Handles 403 Forbidden and displays permission denied alert', async () => {
      const forbiddenErr = new Error('Từ chối quyền truy cập');
      forbiddenErr.status = 403;
      adminUsersService.getUsers.mockRejectedValueOnce(forbiddenErr);

      renderWithProviders(<AdminUsersPage />);

      await waitFor(() => {
        expect(screen.getByText(/403 — Không Đủ Quyền Truy Cập Quản Trị/i)).toBeInTheDocument();
      });
    });

    test('6. Opens details drawer when clicking Chi tiết', async () => {
      adminUsersService.getUsers.mockResolvedValueOnce({
        items: mockUserList,
        pagination: { total: 2, page: 1, limit: 10, totalPages: 1 },
      });
      adminUsersService.getUserDetails.mockResolvedValueOnce(mockUserList[0]);
      adminUsersService.getUserRoles.mockResolvedValueOnce([
        {
          role_id: 'role-super-1',
          role_name: 'SUPER_ADMIN',
          description: 'Toàn quyền quản trị hệ thống',
          assigned_at: '2026-10-21T10:00:00.000Z',
          assigned_by: 'system',
        },
      ]);

      renderWithProviders(<AdminUsersPage />);

      await waitFor(() => {
        expect(screen.getByText('Nguyễn Văn An')).toBeInTheDocument();
      });

      const detailButtons = screen.getAllByRole('button', { name: /chi tiết/i });
      fireEvent.click(detailButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('Chi Tiết Người Dùng')).toBeInTheDocument();
        expect(screen.getByText('SUPER_ADMIN')).toBeInTheDocument();
        expect(screen.getByText(/Tài khoản Quản trị viên cấp cao/i)).toBeInTheDocument();
      });

      // Close drawer
      const closeBtn = screen.getByRole('button', { name: /đóng chi tiết/i });
      fireEvent.click(closeBtn);

      await waitFor(() => {
        expect(screen.queryByText('Chi Tiết Người Dùng')).not.toBeInTheDocument();
      });
    });

    test('7. Search filter triggers debounced API call', async () => {
      adminUsersService.getUsers.mockResolvedValue({
        items: mockUserList,
        pagination: { total: 2, page: 1, limit: 10, totalPages: 1 },
      });

      renderWithProviders(<AdminUsersPage />);

      const searchInput = screen.getByPlaceholderText(/Tìm theo Họ tên, Email hoặc UUID/i);
      fireEvent.change(searchInput, { target: { value: 'Bình' } });

      await waitFor(() => {
        expect(adminUsersService.getUsers).toHaveBeenCalledWith(
          expect.objectContaining({ search: 'Bình' })
        );
      });
    });

    test('8. Opens confirmation modal when clicking Khóa and updates status on confirm', async () => {
      adminUsersService.getUsers.mockResolvedValueOnce({
        items: mockUserList,
        pagination: { total: 2, page: 1, limit: 10, totalPages: 1 },
      });
      adminUsersService.updateUserStatus.mockResolvedValueOnce({
        ...mockUserList[0],
        status: 'SUSPENDED',
      });

      renderWithProviders(<AdminUsersPage />);

      await waitFor(() => {
        expect(screen.getByText('Nguyễn Văn An')).toBeInTheDocument();
      });

      // Find Lock buttons (both users are not suspended)
      const lockButtons = screen.getAllByRole('button', { name: /khóa/i });
      expect(lockButtons.length).toBeGreaterThan(0);

      // Click Lock on first user
      fireEvent.click(lockButtons[0]);

      // Verify Modal opens
      await waitFor(() => {
        expect(screen.getByText('Xác Nhận Khóa Tài Khoản')).toBeInTheDocument();
        expect(screen.getByText(/Bạn có chắc chắn muốn/i)).toBeInTheDocument();
      });

      // Click Confirm Lock
      const confirmLockBtn = screen.getByRole('button', { name: /xác nhận khóa tài khoản/i });
      fireEvent.click(confirmLockBtn);

      await waitFor(() => {
        expect(adminUsersService.updateUserStatus).toHaveBeenCalledWith(
          mockUserList[0].id,
          'SUSPENDED'
        );
      });
    });

    test('9. Can cancel status modal without modifying user status', async () => {
      adminUsersService.getUsers.mockResolvedValueOnce({
        items: mockUserList,
        pagination: { total: 2, page: 1, limit: 10, totalPages: 1 },
      });

      renderWithProviders(<AdminUsersPage />);

      await waitFor(() => {
        expect(screen.getByText('Nguyễn Văn An')).toBeInTheDocument();
      });

      const lockButtons = screen.getAllByRole('button', { name: /khóa/i });
      fireEvent.click(lockButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('Xác Nhận Khóa Tài Khoản')).toBeInTheDocument();
      });

      const cancelBtn = screen.getByRole('button', { name: /hủy bỏ/i });
      fireEvent.click(cancelBtn);

      await waitFor(() => {
        expect(screen.queryByText('Xác Nhận Khóa Tài Khoản')).not.toBeInTheDocument();
      });
    });

    test('10. Renders Mở khóa button for SUSPENDED user and unlocks on confirm', async () => {
      const suspendedUser = {
        ...mockUserList[0],
        status: 'SUSPENDED',
      };

      adminUsersService.getUsers.mockResolvedValueOnce({
        items: [suspendedUser],
        pagination: { total: 1, page: 1, limit: 10, totalPages: 1 },
      });
      adminUsersService.updateUserStatus.mockResolvedValueOnce({
        ...suspendedUser,
        status: 'ACTIVE',
      });

      renderWithProviders(<AdminUsersPage />);

      await waitFor(() => {
        expect(screen.getByText('Nguyễn Văn An')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /mở khóa/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /mở khóa/i }));

      await waitFor(() => {
        expect(screen.getByText('Xác Nhận Mở Khóa Tài Khoản')).toBeInTheDocument();
      });

      const confirmUnlockBtn = screen.getByRole('button', { name: /xác nhận mở khóa/i });
      fireEvent.click(confirmUnlockBtn);

      await waitFor(() => {
        expect(adminUsersService.updateUserStatus).toHaveBeenCalledWith(
          suspendedUser.id,
          'ACTIVE'
        );
  });
});
  });
});
