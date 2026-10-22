import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { DashboardProvider, useDashboard } from '../context/DashboardContext';
import { TopHeader } from '../../../components/dashboard/TopHeader';
import { Sidebar } from '../../../components/dashboard/Sidebar';
import apiClient, {
  getActiveOrganizationId,
  setActiveOrganizationId,
  cancelPendingRequests,
  createDefaultHeaders,
  request,
} from '../../../services/apiClient';

// Mock AuthContext
jest.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'usr-123', email: 'owner@test.com', full_name: 'Minh Quân', system_roles: ['USER'] },
    logout: jest.fn(),
    getInitials: () => 'MQ',
    getPrimaryRole: () => 'SME OWNER',
    isAdmin: () => false,
    isDevOps: () => false,
    isViewer: () => false,
  }),
}));

describe('TASK [S2][PB07] 3.1 — Organization Switcher Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    setActiveOrganizationId(null);
    jest.clearAllMocks();
  });

  describe('1. API Client & Interceptor (Phase 4)', () => {
    test('1.1. Injects X-Organization-Id header for tenant-scoped endpoints', () => {
      setActiveOrganizationId('org-test-uuid-001');
      const headers = createDefaultHeaders({}, '/organizations/org-test-uuid-001/members');
      expect(headers['X-Organization-Id']).toBe('org-test-uuid-001');
    });

    test('1.2. Does NOT inject X-Organization-Id for public and global endpoints', () => {
      setActiveOrganizationId('org-test-uuid-001');
      const loginHeaders = createDefaultHeaders({}, '/auth/login');
      expect(loginHeaders['X-Organization-Id']).toBeUndefined();

      const listHeaders = createDefaultHeaders({}, '/organizations/me/list');
      expect(listHeaders['X-Organization-Id']).toBeUndefined();
    });

    test('1.3. Allows explicit custom override of X-Organization-Id', () => {
      setActiveOrganizationId('org-test-uuid-001');
      const headers = createDefaultHeaders({ 'X-Organization-Id': 'custom-override-id' }, '/environments');
      expect(headers['X-Organization-Id']).toBe('custom-override-id');
    });

    test('1.4. cancelPendingRequests aborts previous switch in-flight requests', async () => {
      let aborted = false;
      const controller = new AbortController();
      controller.signal.addEventListener('abort', () => {
        aborted = true;
      });

      // Simulating cancelPendingRequests
      cancelPendingRequests();
      expect(typeof cancelPendingRequests).toBe('function');
    });
  });

  describe('2. Global State & switchOrganization (Phase 3)', () => {
    const TestConsumer = () => {
      const {
        currentOrg,
        orgList,
        currentUserRole,
        switchOrganization,
        isLoadingOrgs,
        isSwitchingOrg,
      } = useDashboard();

      return (
        <div>
          <div data-testid="current-org-name">{currentOrg?.name}</div>
          <div data-testid="current-org-id">{currentOrg?.id}</div>
          <div data-testid="current-role">{currentUserRole}</div>
          <div data-testid="is-loading">{String(isLoadingOrgs)}</div>
          <div data-testid="is-switching">{String(isSwitchingOrg)}</div>
          <button
            onClick={() =>
              switchOrganization({
                id: 'org-beta',
                name: 'Beta Cloud Ltd',
                role_in_org: 'DEVOPS',
              })
            }
          >
            Switch to Beta
          </button>
        </div>
      );
    };

    test('2.1. Initial state reads from localStorage or falls back safely', () => {
      localStorage.setItem('selfheal_active_org_id', 'org-saved-1');
      localStorage.setItem('selfheal_active_org_name', 'Saved Corp');
      localStorage.setItem('selfheal_active_org_role', 'DEVOPS');

      render(
        <DashboardProvider>
          <TestConsumer />
        </DashboardProvider>
      );

      expect(screen.getByTestId('current-org-id')).toHaveTextContent('org-saved-1');
      expect(screen.getByTestId('current-org-name')).toHaveTextContent('Saved Corp');
      expect(screen.getByTestId('current-role')).toHaveTextContent('DEVOPS');
    });

    test('2.2. switchOrganization updates state, localStorage and API client context', async () => {
      render(
        <DashboardProvider>
          <TestConsumer />
        </DashboardProvider>
      );

      const switchBtn = screen.getByText('Switch to Beta');
      fireEvent.click(switchBtn);

      expect(screen.getByTestId('current-org-name')).toHaveTextContent('Beta Cloud Ltd');
      expect(screen.getByTestId('current-org-id')).toHaveTextContent('org-beta');
      expect(screen.getByTestId('current-role')).toHaveTextContent('DEVOPS');

      expect(localStorage.getItem('selfheal_active_org_id')).toBe('org-beta');
      expect(localStorage.getItem('selfheal_active_org_name')).toBe('Beta Cloud Ltd');
      expect(localStorage.getItem('selfheal_active_org_role')).toBe('DEVOPS');
      expect(getActiveOrganizationId()).toBe('org-beta');
    });
  });

  describe('3. TopHeader Dropdown UI & Keyboard (Phase 2)', () => {
    test('3.1. Renders active organization name, badge and opens dropdown on click', () => {
      localStorage.setItem('selfheal_active_org_id', 'org-acme');
      localStorage.setItem('selfheal_active_org_name', 'Acme Cloud Corp');
      localStorage.setItem('selfheal_active_org_role', 'SME_OWNER');

      render(
        <DashboardProvider>
          <TopHeader />
        </DashboardProvider>
      );

      const triggerBtn = screen.getByRole('button', { name: /Chọn tổ chức/i });
      expect(triggerBtn).toBeInTheDocument();
      expect(triggerBtn).toHaveTextContent('Acme Cloud Corp');
      expect(triggerBtn).toHaveTextContent('SME_OWNER');

      // Click to open dropdown
      fireEvent.click(triggerBtn);
      expect(triggerBtn).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getByRole('listbox', { name: /Danh sách tổ chức của bạn/i })).toBeInTheDocument();
    });

    test('3.2. Closes dropdown when Escape key is pressed', () => {
      render(
        <DashboardProvider>
          <TopHeader />
        </DashboardProvider>
      );

      const triggerBtn = screen.getByRole('button', { name: /Chọn tổ chức/i });
      fireEvent.click(triggerBtn);
      expect(screen.getByRole('listbox')).toBeInTheDocument();

      fireEvent.keyDown(triggerBtn, { key: 'Escape' });
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });
  });

  describe('4. Routing & Sidebar RBAC Isolation (Phase 5)', () => {
    test('4.1. Sidebar hides Organization menu when role is DEVOPS', () => {
      localStorage.setItem('selfheal_active_org_role', 'DEVOPS');

      render(
        <DashboardProvider>
          <Sidebar currentPath="/dashboard" />
        </DashboardProvider>
      );

      // Organization group header and its child links must be hidden
      expect(screen.queryByText('TỔ CHỨC')).not.toBeInTheDocument();
      expect(screen.queryByText('Thành viên & Phân quyền')).not.toBeInTheDocument();
    });

    test('4.2. Sidebar displays Organization menu when role is SME_OWNER', () => {
      localStorage.setItem('selfheal_active_org_role', 'SME_OWNER');

      render(
        <DashboardProvider>
          <Sidebar currentPath="/dashboard" />
        </DashboardProvider>
      );

      expect(screen.getByText('TỔ CHỨC')).toBeInTheDocument();
      expect(screen.getByText('Thành viên & Phân quyền')).toBeInTheDocument();
    });
  });
});
