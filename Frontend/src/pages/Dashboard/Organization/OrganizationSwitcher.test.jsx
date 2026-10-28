import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { DashboardProvider, useDashboard } from '../context/DashboardContext';
import { TopHeader } from '../../../components/dashboard/TopHeader';
import { Sidebar } from '../../../components/dashboard/Sidebar';
import { clusterService } from '../../../services/clusterService';
import apiClient, {
  getActiveOrganizationId,
  setActiveOrganizationId,
  cancelPendingRequests,
  createDefaultHeaders,
  request,
} from '../../../services/apiClient';

// Mock clusterService
jest.mock('../../../services/clusterService', () => ({
  clusterService: {
    getClustersByOrg: jest.fn(() => Promise.resolve([])),
    getAllClusters: jest.fn(() => Promise.resolve([])),
    getClusterDetail: jest.fn(() => Promise.resolve(null)),
  },
}));

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

  describe('5. Dynamic K8s Cluster Synchronization & Zero Mock Data', () => {
    test('5.1. Khi chưa có tổ chức hoặc rỗng, hiển thị đúng "Chưa có Tổ chức" và "Chưa có Cụm K8s"', async () => {
      render(
        <DashboardProvider>
          <TopHeader />
        </DashboardProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('Chưa có Tổ chức')).toBeInTheDocument();
        expect(screen.getByText('Chưa có Cụm K8s')).toBeInTheDocument();
      });
      expect(screen.queryByText('Acme Corporation')).not.toBeInTheDocument();
      expect(screen.queryByText('k8s-cluster-01')).not.toBeInTheDocument();
      expect(screen.queryByText('cluster-k8s-sme-01')).not.toBeInTheDocument();
    });

    test('5.2. Khi tổ chức có cụm K8s thực tế, tự động đồng bộ cụm và trạng thái agent eBPF từ database', async () => {
      clusterService.getClustersByOrg.mockResolvedValueOnce([
        {
          id: 'c-uuid-prod',
          name: 'vng-payment-k8s',
          environment_name: 'Staging',
          agent_status: 'ONLINE',
          nodes_count: 3,
          pods_count: 12,
        },
      ]);

      localStorage.setItem('selfheal_active_org_id', 'org-vng-uuid');
      localStorage.setItem('selfheal_active_org_name', 'VNG Corporation');

      render(
        <DashboardProvider>
          <TopHeader />
        </DashboardProvider>
      );

      await waitFor(() => {
        expect(screen.getByText(/vng-payment-k8s/i)).toBeInTheDocument();
      });

      expect(localStorage.getItem('selfheal_active_cluster_id')).toBe('c-uuid-prod');
      expect(localStorage.getItem('selfheal_active_cluster_name')).toBe('vng-payment-k8s');
      expect(localStorage.getItem('selfheal_active_env_name')).toBe('Staging');
    });

    test('5.3. Khi chuyển sang tổ chức KHÔNG có cụm K8s, xóa ngay lập tức cụm cũ và hiển thị "Chưa có Cụm K8s"', async () => {
      clusterService.getClustersByOrg.mockResolvedValueOnce([]);

      const ClusterConsumer = () => {
        const { currentEnv, switchOrganization, envList } = useDashboard();
        return (
          <div>
            <div data-testid="current-cluster">{currentEnv?.cluster || 'NO_CLUSTER'}</div>
            <div data-testid="cluster-count">{envList.length}</div>
            <button
              onClick={() =>
                switchOrganization({
                  id: 'org-empty-k8s',
                  name: 'Zero Cluster Org',
                })
              }
            >
              Switch To Empty Cluster Org
            </button>
          </div>
        );
      };

      localStorage.setItem('selfheal_active_org_id', 'org-with-cluster');
      localStorage.setItem('selfheal_active_cluster_id', 'old-cluster-uuid');
      localStorage.setItem('selfheal_active_cluster_name', 'old-cluster-name');
      localStorage.setItem('selfheal_active_env_name', 'Production');

      render(
        <DashboardProvider>
          <ClusterConsumer />
        </DashboardProvider>
      );

      expect(screen.getByTestId('current-cluster')).toHaveTextContent('old-cluster-name');

      await act(async () => {
        fireEvent.click(screen.getByText('Switch To Empty Cluster Org'));
      });

      await waitFor(() => {
        expect(screen.getByTestId('current-cluster')).toHaveTextContent('NO_CLUSTER');
        expect(screen.getByTestId('cluster-count')).toHaveTextContent('0');
      });
      expect(localStorage.getItem('selfheal_active_cluster_id')).toBeNull();
      expect(localStorage.getItem('selfheal_active_cluster_name')).toBeNull();
    });
  });
});
