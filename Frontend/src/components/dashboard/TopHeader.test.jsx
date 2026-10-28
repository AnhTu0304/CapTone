import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { TopHeader } from './TopHeader';

const mockUser = {
  id: 'usr-dev-99',
  email: 'sme.owner@company.vn',
  full_name: 'Nguyễn Văn Chủ',
  roles: ['SME_OWNER'],
  system_roles: [],
};

jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    user: mockUser,
    logout: jest.fn(),
    getInitials: () => 'NC',
    isAdmin: () => false,
  }),
}));

jest.mock('../../pages/Dashboard/context/DashboardContext', () => ({
  useDashboard: () => ({
    currentOrg: { id: 'org-1', name: 'Alpha Corp' },
    orgList: [{ id: 'org-1', name: 'Alpha Corp' }],
    switchOrganization: jest.fn(),
    isLoadingOrgs: false,
    isSwitchingOrg: false,
    currentEnv: null,
    setCurrentEnv: jest.fn(),
    envList: [],
    isLoadingEnvs: false,
    fetchOrgEnvironmentsAndClusters: jest.fn(),
    isAgentConnected: true,
    setIsAgentConnected: jest.fn(),
    isAutoRefresh: false,
    setIsAutoRefresh: jest.fn(),
    isRefreshing: false,
    triggerRefresh: jest.fn(),
    notifications: [],
    unreadNotifsCount: 0,
    markAllNotificationsRead: jest.fn(),
    isMobileNavOpen: false,
    setIsMobileNavOpen: jest.fn(),
    onNavigate: jest.fn(),
  }),
}));

describe('TopHeader Component - Profile Dropdown Suite', () => {
  test('TC01: Khi mở menu cá nhân, hiển thị đúng họ tên và email, KHÔNG hiển thị Role Badge', () => {
    render(<TopHeader />);

    // Click profile avatar button via initials
    const avatarBtn = screen.getByText('NC').closest('button');
    expect(avatarBtn).toBeInTheDocument();
    fireEvent.click(avatarBtn);

    // Profile menu opens with user details
    const nameMatches = screen.getAllByText('Nguyễn Văn Chủ');
    expect(nameMatches.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('sme.owner@company.vn')).toBeInTheDocument();

    // Verify role badge is removed
    expect(screen.queryByText(/SME OWNER/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Chủ Doanh Nghiệp/i)).not.toBeInTheDocument();
  });
});
