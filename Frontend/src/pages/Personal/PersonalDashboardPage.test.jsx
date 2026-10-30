import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { PersonalDashboardPage } from './PersonalDashboardPage';
import { personalPortalService } from '../../services/personalPortalService';
import { AuthProvider } from '../../context/AuthContext';
import { ToastProvider } from '../../context/ToastContext';

jest.mock('../../services/personalPortalService');

const renderWithProviders = (ui) => {
  return render(
    <ToastProvider>
      <AuthProvider>{ui}</AuthProvider>
    </ToastProvider>
  );
};

describe('PersonalDashboardPage Suite (/portal) - Real Database Synchronization', () => {
  const mockNavigate = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  test('TC01: Khi Database không có Organization -> Hiển thị Empty State, KPIs = 0, không có mock companies', async () => {
    personalPortalService.fetchDashboardSummary.mockResolvedValue({
      companies: [],
      invitations: [],
      summary: {
        totalCompanies: 0,
        activeCompanies: 0,
        unreadNotifs: 0,
        pendingInvitations: 0,
        recentCompany: null,
        recentActivities: [],
      },
    });

    await act(async () => {
      renderWithProviders(<PersonalDashboardPage onNavigate={mockNavigate} />);
    });

    await waitFor(() => {
      expect(screen.getByText('Chưa tham gia Company nào')).toBeInTheDocument();
    });

    // Xác nhận thông điệp empty state thân thiện
    expect(
      screen.getByText(
        /Hiện tại bạn chưa thuộc Company nào hoặc chưa được cấp quyền truy cập/i
      )
    ).toBeInTheDocument();

    // Xác nhận KPIs bằng 0
    expect(screen.getByText('0 công ty đang kích hoạt')).toBeInTheDocument();
    expect(screen.getByText('Chưa có công ty nào kích hoạt')).toBeInTheDocument();

    // Tuyệt đối không hiển thị Company mẫu
    expect(screen.queryByText(/Acme Corporation/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/VNG Fintech Gateway/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Smart Retail Logistics/i)).not.toBeInTheDocument();

    // Không render nút "Vào Workspace" cho company không tồn tại
    expect(screen.queryByText('Vào Workspace')).not.toBeInTheDocument();

    // Nút tạo Company mới hiển thị cho người dùng có quyền
    expect(screen.getByText('Tạo Company Mới')).toBeInTheDocument();
  });

  test('TC03: Khi User có Organization hợp lệ trong Database -> Hiển thị đúng dữ liệu thực tế và nút Vào Workspace', async () => {
    const realCompanies = [
      {
        id: 'org-real-001',
        name: 'TechCorp Vietnam Solutions',
        slug: 'techcorp-vn',
        plan: 'Enterprise Cloud',
        status: 'ACTIVE',
        role: 'SME_OWNER',
        roleTitle: 'Chủ Doanh Nghiệp (Owner)',
        joinedAt: '28/10/2026',
        clustersCount: 2,
        membersCount: 4,
        activeWorkloads: 8,
        domain: 'techcorp.vn',
        isPrimary: true,
        lastAccessedAt: 'Vừa xong',
        healthStatus: 'HEALTHY',
      },
    ];

    personalPortalService.fetchDashboardSummary.mockResolvedValue({
      companies: realCompanies,
      invitations: [],
      summary: {
        totalCompanies: 1,
        activeCompanies: 1,
        unreadNotifs: 0,
        pendingInvitations: 0,
        recentCompany: realCompanies[0],
        recentActivities: [],
      },
    });

    await act(async () => {
      renderWithProviders(<PersonalDashboardPage onNavigate={mockNavigate} />);
    });

    await waitFor(() => {
      expect(screen.getByText('TechCorp Vietnam Solutions')).toBeInTheDocument();
    });

    expect(screen.getByText('Chủ Doanh Nghiệp (Owner)')).toBeInTheDocument();
    expect(screen.getByText('Vào Workspace')).toBeInTheDocument();

    // Click "Vào Workspace" lưu thông tin vào localStorage và điều hướng
    fireEvent.click(screen.getByText('Vào Workspace'));
    expect(localStorage.getItem('selfheal_active_org_id')).toBe('org-real-001');
    expect(localStorage.getItem('selfheal_active_org_name')).toBe('TechCorp Vietnam Solutions');
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
  });

  test('TC04: Khi API lỗi (500 hoặc mất kết nối DB) -> Hiển thị thông báo lỗi, không fallback sang Company giả', async () => {
    personalPortalService.fetchDashboardSummary.mockRejectedValue(
      new Error('Lỗi kết nối cơ sở dữ liệu PostgreSQL')
    );

    await act(async () => {
      renderWithProviders(<PersonalDashboardPage onNavigate={mockNavigate} />);
    });

    await waitFor(() => {
      expect(
        screen.getByText('Không thể tải dữ liệu từ máy chủ hoặc cơ sở dữ liệu')
      ).toBeInTheDocument();
    });

    expect(
      screen.getByText(/Lỗi kết nối cơ sở dữ liệu PostgreSQL/i)
    ).toBeInTheDocument();

    // Nút Thử lại hiển thị
    expect(screen.getByText('Thử lại')).toBeInTheDocument();

    // Tuyệt đối không fallback sang dữ liệu mẫu Acme hay VNG
    expect(screen.queryByText(/Acme Corporation/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/VNG Fintech Gateway/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Vào Workspace')).not.toBeInTheDocument();
  });

  test('TC05: KPI tổng Company và Company đang hoạt động được tính chuẩn xác từ trạng thái thực tế', async () => {
    const mixedCompanies = [
      {
        id: 'org-act-1',
        name: 'Alpha Active Org',
        status: 'ACTIVE',
        role: 'SME_OWNER',
        roleTitle: 'Chủ sở hữu',
      },
      {
        id: 'org-inact-2',
        name: 'Beta Inactive Org',
        status: 'INACTIVE',
        role: 'VIEWER',
        roleTitle: 'Người xem',
      },
    ];

    personalPortalService.fetchDashboardSummary.mockResolvedValue({
      companies: mixedCompanies,
      invitations: [],
      summary: {
        totalCompanies: 2,
        activeCompanies: 1,
        unreadNotifs: 0,
        pendingInvitations: 0,
        recentCompany: mixedCompanies[0],
        recentActivities: [],
      },
    });

    await act(async () => {
      renderWithProviders(<PersonalDashboardPage onNavigate={mockNavigate} />);
    });

    await waitFor(() => {
      expect(screen.getByText('Alpha Active Org')).toBeInTheDocument();
      expect(screen.getByText('Beta Inactive Org')).toBeInTheDocument();
    });

    // 1 công ty đang kích hoạt
    expect(screen.getByText('1 công ty đang kích hoạt')).toBeInTheDocument();
    expect(screen.getByText('1/2 công ty đang hoạt động')).toBeInTheDocument();
  });

  test('TC07: Làm mới dashboard phản ánh dữ liệu mới khi thay đổi trên backend', async () => {
    personalPortalService.fetchDashboardSummary
      .mockResolvedValueOnce({
        companies: [],
        invitations: [],
        summary: {
          totalCompanies: 0,
          activeCompanies: 0,
          unreadNotifs: 0,
          pendingInvitations: 0,
          recentCompany: null,
          recentActivities: [],
        },
      })
      .mockResolvedValueOnce({
        companies: [
          {
            id: 'org-new-001',
            name: 'New Fresh Company',
            status: 'ACTIVE',
            role: 'SME_OWNER',
            roleTitle: 'Owner',
          },
        ],
        invitations: [],
        summary: {
          totalCompanies: 1,
          activeCompanies: 1,
          unreadNotifs: 0,
          pendingInvitations: 0,
          recentCompany: null,
          recentActivities: [],
        },
      });

    const { unmount } = renderWithProviders(
      <PersonalDashboardPage onNavigate={mockNavigate} />
    );

    await waitFor(() => {
      expect(screen.getByText('Chưa tham gia Company nào')).toBeInTheDocument();
    });

    // Unmount và tải lại dashboard (F5 / Chuyển tab quay lại)
    unmount();

    await act(async () => {
      renderWithProviders(<PersonalDashboardPage onNavigate={mockNavigate} />);
    });

    await waitFor(() => {
      expect(screen.getByText('New Fresh Company')).toBeInTheDocument();
    });
    expect(screen.queryByText('Chưa tham gia Company nào')).not.toBeInTheDocument();
  });
});
