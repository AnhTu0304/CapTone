import React from 'react';
import { render, screen, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { PersonalSidebar, PERSONAL_NAV_ITEMS } from './PersonalSidebar';
import { personalPortalService } from '../../services/personalPortalService';

describe('PersonalSidebar Component - Company Count Badge & Nav Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
  });

  test('TC01: PERSONAL_NAV_ITEMS static constants have null badges (no hardcoded 3 or 2)', () => {
    const companiesItem = PERSONAL_NAV_ITEMS.find((i) => i.id === 'companies');
    const notifsItem = PERSONAL_NAV_ITEMS.find((i) => i.id === 'notifications');

    expect(companiesItem.badge).toBeNull();
    expect(notifsItem.badge).toBeNull();
  });

  test('TC02: Hiển thị badge 0 khi Database / API chưa có Company nào (Không hiển thị 3)', async () => {
    jest.spyOn(personalPortalService, 'fetchMyCompanies').mockResolvedValue([]);
    jest.spyOn(personalPortalService, 'getMyCompanies').mockReturnValue([]);

    await act(async () => {
      render(<PersonalSidebar currentPath="/portal/companies" />);
    });

    const badge = screen.getByTestId('badge-companies');
    expect(badge).toBeInTheDocument();
    expect(badge.textContent).toBe('0');
    expect(badge.textContent).not.toBe('3');
  });

  test('TC03: Hiển thị đúng số lượng khi Database / API trả về danh sách Company thực tế', async () => {
    const realCompanies = [
      { id: 'org-1', name: 'Fintech Hub', status: 'ACTIVE' },
      { id: 'org-2', name: 'Logistics Pro', status: 'ACTIVE' },
    ];
    jest.spyOn(personalPortalService, 'fetchMyCompanies').mockResolvedValue(realCompanies);
    jest.spyOn(personalPortalService, 'getMyCompanies').mockReturnValue(realCompanies);

    await act(async () => {
      render(<PersonalSidebar currentPath="/portal/companies" />);
    });

    const badge = screen.getByTestId('badge-companies');
    expect(badge).toBeInTheDocument();
    expect(badge.textContent).toBe('2');
  });

  test('TC04: Nhận prop companyCount trực tiếp và hiển thị chuẩn xác', async () => {
    jest.spyOn(personalPortalService, 'fetchMyCompanies').mockResolvedValue([]);

    await act(async () => {
      render(<PersonalSidebar currentPath="/portal/companies" companyCount={5} />);
    });

    const badge = screen.getByTestId('badge-companies');
    expect(badge.textContent).toBe('5');
  });

  test('TC05: Tự động cập nhật số lượng khi có sự kiện thay đổi Company từ service hoặc MultiTabSync', async () => {
    jest.spyOn(personalPortalService, 'fetchMyCompanies').mockResolvedValue([]);
    const getMyCompaniesSpy = jest.spyOn(personalPortalService, 'getMyCompanies').mockReturnValue([]);

    await act(async () => {
      render(<PersonalSidebar currentPath="/portal/companies" />);
    });

    expect(screen.getByTestId('badge-companies').textContent).toBe('0');

    // Giả lập user tạo hoặc tham gia Company mới
    const newCompanyList = [{ id: 'org-new-1', name: 'NextGen Cloud' }];
    getMyCompaniesSpy.mockReturnValue(newCompanyList);

    await act(async () => {
      window.dispatchEvent(new CustomEvent('selfheal_companies_changed', { detail: newCompanyList }));
    });

    expect(screen.getByTestId('badge-companies').textContent).toBe('1');
  });

  test('TC06: Ẩn badge khi sidebar ở trạng thái thu gọn (isCollapsed = true)', async () => {
    jest.spyOn(personalPortalService, 'fetchMyCompanies').mockResolvedValue([]);

    await act(async () => {
      render(<PersonalSidebar currentPath="/portal/companies" isCollapsed={true} />);
    });

    expect(screen.queryByTestId('badge-companies')).not.toBeInTheDocument();
  });

  test('TC07: Đã xóa hoàn toàn nhóm "CHUYỂN KHÔNG GIAN" và mục "Về Dashboard", giữ nguyên 8 mục Chức Năng Cá Nhân', async () => {
    jest.spyOn(personalPortalService, 'fetchMyCompanies').mockResolvedValue([]);
    const mockToggleCollapse = jest.fn();

    await act(async () => {
      render(<PersonalSidebar currentPath="/portal" onToggleCollapse={mockToggleCollapse} />);
    });

    // 1. Phải KHÔNG còn tiêu đề CHUYỂN KHÔNG GIAN
    expect(screen.queryByText(/CHUYỂN KHÔNG GIAN/i)).not.toBeInTheDocument();

    // 2. Phải KHÔNG còn mục Về Dashboard
    expect(screen.queryByText(/Về Dashboard/i)).not.toBeInTheDocument();

    // 3. Phải KHÔNG còn mục Cổng Quản Trị
    expect(screen.queryByText(/Cổng Quản Trị/i)).not.toBeInTheDocument();

    // 4. Giữ nguyên toàn bộ 8 mục Chức Năng Cá Nhân
    expect(screen.getByText('Bảng Điều Khiển')).toBeInTheDocument();
    expect(screen.getByText('Company Của Tôi')).toBeInTheDocument();
    expect(screen.getByText('Hồ Sơ Cá Nhân')).toBeInTheDocument();
    expect(screen.getByText('Bảo Mật Tài Khoản')).toBeInTheDocument();
    expect(screen.getByText('Tùy Chỉnh Cá Nhân')).toBeInTheDocument();
    expect(screen.getByText('Thông Báo')).toBeInTheDocument();
    expect(screen.getByText('Lịch Sử Hoạt Động')).toBeInTheDocument();
    expect(screen.getByText('Trợ Giúp & Hỗ Trợ')).toBeInTheDocument();

    // 5. Nút thu gọn sidebar vẫn hoạt động bình thường
    expect(screen.getByRole('button', { name: /Thu gọn sidebar/i })).toBeInTheDocument();
  });
});
