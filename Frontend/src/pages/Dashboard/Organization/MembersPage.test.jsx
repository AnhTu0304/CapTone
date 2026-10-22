import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import MembersPage from './MembersPage';
import { AuthProvider } from '../../../context/AuthContext';
import { ToastProvider } from '../../../context/ToastContext';
import { DashboardProvider } from '../context/DashboardContext';
import { organizationMemberService } from '../../../services/organizationMemberService';

const mockMembersList = [
  {
    id: 'mem-01',
    organization_id: 'org-acme',
    user: {
      id: 'usr-01',
      email: 'quan.le@acmecorp.vn',
      full_name: 'Lê Minh Quân',
      avatar_url: null,
      status: 'ACTIVE',
    },
    role: {
      id: 'role-owner',
      code: 'SME_OWNER',
      name: 'Chủ DN (SME Owner)',
      description: 'Toàn quyền',
    },
    status: 'ACTIVE',
    inviter: null,
    joined_at: '2026-01-10T08:00:00.000Z',
    created_at: '2026-01-10T08:00:00.000Z',
    mfa: true,
    lastActive: '5 phút trước',
  },
  {
    id: 'mem-02',
    organization_id: 'org-acme',
    user: {
      id: 'usr-02',
      email: 'tuan.tran@acmecorp.vn',
      full_name: 'Trần Đình Tuấn',
      avatar_url: null,
      status: 'ACTIVE',
    },
    role: {
      id: 'role-devops',
      code: 'DEVOPS',
      name: 'Kỹ Sư DevOps Lead',
      description: 'Vận hành K8s',
    },
    status: 'ACTIVE',
    inviter: null,
    joined_at: '2026-02-15T09:30:00.000Z',
    created_at: '2026-02-15T09:30:00.000Z',
    mfa: true,
    lastActive: '22 phút trước',
  },
  {
    id: 'mem-03',
    organization_id: 'org-acme',
    user: {
      id: 'usr-03',
      email: 'lan.pham@acmecorp.vn',
      full_name: 'Phạm Thị Lan',
      avatar_url: null,
      status: 'INVITED',
    },
    role: {
      id: 'role-viewer',
      code: 'VIEWER',
      name: 'Người Xem (Viewer)',
      description: 'Chỉ đọc',
    },
    status: 'INVITED',
    inviter: {
      id: 'usr-01',
      email: 'quan.le@acmecorp.vn',
      full_name: 'Lê Minh Quân',
    },
    joined_at: null,
    created_at: '2026-10-22T08:00:00.000Z',
    mfa: false,
    lastActive: 'Chờ chấp nhận',
  },
];

jest.mock('../../../services/organizationMemberService', () => ({
  organizationMemberService: {
    getMembers: jest.fn(),
    inviteMember: jest.fn(),
    updateMember: jest.fn(),
    removeMember: jest.fn(),
    getRoles: jest.fn(),
  },
}));

const renderMembersPage = () => {
  return render(
    <ToastProvider>
      <AuthProvider>
        <DashboardProvider>
          <MembersPage />
        </DashboardProvider>
      </AuthProvider>
    </ToastProvider>
  );
};

describe('MembersPage UI Suite (/dashboard/organization/members)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    organizationMemberService.getMembers.mockImplementation(() =>
      Promise.resolve({
        items: mockMembersList,
        pagination: { total: 3, page: 1, limit: 20, totalPages: 1 },
      })
    );
    organizationMemberService.inviteMember.mockImplementation(({ email, role_code, full_name }) =>
      Promise.resolve({
        id: 'mem-new',
        organization_id: 'org-acme',
        user: { id: 'usr-new', email, full_name: full_name || email.split('@')[0], status: 'INVITED' },
        role: { code: role_code, name: role_code },
        status: 'INVITED',
      })
    );
    organizationMemberService.updateMember.mockImplementation((orgId, userId, data) =>
      Promise.resolve({
        id: 'mem-updated',
        role: { code: data.role_code, name: data.role_code },
      })
    );
    organizationMemberService.removeMember.mockImplementation(() =>
      Promise.resolve({ message: 'Success' })
    );
    organizationMemberService.getRoles.mockImplementation(() => Promise.resolve([]));
  });

  test('1. Render đầy đủ Header, Role Overview Cards, RBAC Matrix và Danh sách thành viên', async () => {
    renderMembersPage();

    // 1.1 Kiểm tra Header
    expect(
      screen.getByRole('heading', { name: /Thành Viên & Ma Trận Phân Quyền RBAC/i })
    ).toBeInTheDocument();

    // 1.2 Kiểm tra 3 Role cards
    expect(screen.getByText('Chủ DN (SME Owner)')).toBeInTheDocument();
    expect(screen.getByText('Kỹ Sư DevOps Lead')).toBeInTheDocument();
    expect(screen.getByText('Người Xem (Viewer)')).toBeInTheDocument();

    // 1.3 Kiểm tra hiển thị danh sách thành viên từ API/Service
    await waitFor(() => {
      expect(screen.getByText('Lê Minh Quân')).toBeInTheDocument();
      expect(screen.getByText('Trần Đình Tuấn')).toBeInTheDocument();
      expect(screen.getByText('Phạm Thị Lan')).toBeInTheDocument();
    });

    // 1.4 Kiểm tra hiển thị ma trận RBAC
    expect(screen.getByText(/Ma Trận So Sánh Quyền Hạn RBAC Chi Tiết/i)).toBeInTheDocument();
  });

  test('2. Lọc thành viên theo Tab trạng thái và Tìm kiếm từ khóa', async () => {
    renderMembersPage();

    await waitFor(() => {
      expect(screen.getByText('Lê Minh Quân')).toBeInTheDocument();
    });

    // 2.1 Chuyển tab sang "Lời Mời Đang Chờ"
    const invitedTab = screen.getByRole('button', { name: /Lời Mời Đang Chờ/i });
    fireEvent.click(invitedTab);

    expect(organizationMemberService.getMembers).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ status: 'INVITED' })
    );

    // 2.2 Nhập tìm kiếm theo từ khóa
    const searchInput = screen.getByPlaceholderText(/Tìm theo tên hoặc email/i);
    fireEvent.change(searchInput, { target: { value: 'Tuấn' } });

    expect(organizationMemberService.getMembers).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ search: 'Tuấn' })
    );
  });

  test('3. Mở Modal mời thành viên mới, validate email và gửi thư mời thành công', async () => {
    renderMembersPage();

    await waitFor(() => {
      expect(screen.getByText('Lê Minh Quân')).toBeInTheDocument();
    });

    // 3.1 Bấm nút Mời Thành Viên Mới
    const inviteBtn = screen.getByRole('button', { name: /Mời Thành Viên Mới/i });
    fireEvent.click(inviteBtn);

    // Modal xuất hiện
    expect(screen.getByText(/Mời Thành Viên Mới Vào Tổ Chức/i)).toBeInTheDocument();

    // 3.2 Nhập email hợp lệ
    const emailInput = screen.getByPlaceholderText('tuan.dang@acmecorp.vn');
    const nameInput = screen.getByPlaceholderText('VD: Đặng Quốc Tuấn');
    fireEvent.change(emailInput, { target: { value: 'quoc.tuan@acmecorp.vn' } });
    fireEvent.change(nameInput, { target: { value: 'Đặng Quốc Tuấn' } });

    // 3.3 Submit form
    const submitBtn = screen.getByRole('button', { name: /Gửi Thư Mời/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(organizationMemberService.inviteMember).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          email: 'quoc.tuan@acmecorp.vn',
          full_name: 'Đặng Quốc Tuấn',
        })
      );
    });
  });

  test('4. Hộp thoại xác nhận (Confirmation Modal) xuất hiện khi bấm Xóa / Thu hồi thành viên', async () => {
    renderMembersPage();

    await waitFor(() => {
      expect(screen.getByText('Trần Đình Tuấn')).toBeInTheDocument();
    });

    // 4.1 Bấm nút xóa của thành viên
    const deleteButtons = screen.getAllByTitle(/Loại bỏ thành viên khỏi tổ chức|Thu hồi lời mời/i);
    fireEvent.click(deleteButtons[0]);

    // 4.2 Hộp thoại xác nhận xuất hiện
    expect(screen.getByText(/Xác Nhận Loại Bỏ Thành Viên/i)).toBeInTheDocument();

    // 4.3 Bấm Xác Nhận
    const confirmBtn = screen.getByRole('button', { name: /Xác Nhận/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(organizationMemberService.removeMember).toHaveBeenCalled();
    });
  });
});
