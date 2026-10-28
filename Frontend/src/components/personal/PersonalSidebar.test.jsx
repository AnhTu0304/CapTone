import React from 'react';
import { render, screen, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { PersonalSidebar, PERSONAL_NAV_ITEMS } from './PersonalSidebar';
import { personalPortalService } from '../../services/personalPortalService';
import multiTabSync, { SYNC_EVENTS } from '../../services/multiTabSync';

jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'usr-1', email: 'dev@selfheal.vn', full_name: 'Dev Lead' },
    isSuperAdmin: () => false,
    isAdmin: () => false,
  }),
}));

describe('PersonalSidebar Component - Company Count Badge Suite', () => {
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
});
