import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { DashboardProvider } from '../Dashboard/context/DashboardContext';
import { OverviewPage } from '../Dashboard/Overview/index';
import { AdminClusterOverviewPage } from './Clusters/AdminClusterOverviewPage';
import { AdminAgentManagementPage } from './Agents/AdminAgentManagementPage';
import { clusterService } from '../../services/clusterService';
import { agentService } from '../../services/agentService';
import { request, setActiveOrganizationId } from '../../services/apiClient';

jest.mock('../../services/apiClient', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
  request: jest.fn(),
  getAuthToken: jest.fn(() => 'mock-admin-jwt'),
  setActiveOrganizationId: jest.fn(),
  getActiveOrganizationId: jest.fn(),
  cancelPendingRequests: jest.fn(),
}));

jest.mock('../../services/clusterService', () => ({
  clusterService: {
    getAllClusters: jest.fn(),
    getClusters: jest.fn(),
    getClusterDetail: jest.fn(),
  },
}));

jest.mock('../../services/agentService', () => ({
  agentService: {
    getAllAgentsAdmin: jest.fn(),
    rotateAgentTokenAdmin: jest.fn(),
    revokeAgentAdmin: jest.fn(),
    disconnectAgentAdmin: jest.fn(),
    deleteAgentAdmin: jest.fn(),
  },
}));

jest.mock('../../components/dashboard/InteractiveResourceChart', () => () => (
  <div data-testid="mock-resource-chart" />
));

describe('Admin UI, Cluster & Agent Connection Verification Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    jest.clearAllMocks();
  });

  describe('1. Dashboard Overview Null-Safety Regression (Admin / Empty Org List)', () => {
    test('1.1. Does NOT crash with TypeError reading name when /organizations/me/list returns empty array', async () => {
      sessionStorage.setItem('admin_access_token', 'mock-admin-jwt');
      request.mockImplementation((url) => {
        if (url === '/organizations/me/list') {
          return Promise.resolve({ success: true, data: [] });
        }
        if (url.startsWith('/organizations?')) {
          return Promise.resolve({ success: true, data: { items: [] } });
        }
        return Promise.resolve({ success: true, data: [] });
      });
      clusterService.getClusters.mockResolvedValue([]);

      render(
        <DashboardProvider>
          <OverviewPage />
        </DashboardProvider>
      );

      await waitFor(() => {
        expect(screen.getByText(/Tổng Quan Vận Hành Hạ Tầng/i)).toBeInTheDocument();
        expect(screen.getByText(/Chưa (có|chọn) Tổ chức/i)).toBeInTheDocument();
      });

      expect(setActiveOrganizationId).toHaveBeenCalledWith(null);
    });
  });

  describe('2. AdminClusterOverviewPage (/admin/clusters) Real API Connection', () => {
    test('2.1. Fetches real clusters from clusterService.getAllClusters and displays live agent status', async () => {
      clusterService.getAllClusters.mockResolvedValue([
        {
          id: 'cls-real-prod-01',
          name: 'aegis-prod-k8s-cluster',
          organization_id: 'org-real-01',
          organization_name: 'Aegis Enterprise Vietnam',
          environment_name: 'Production',
          environment_type: 'PRODUCTION',
          provider: 'EKS',
          endpoint: 'https://eks.aegis.vn:6443',
          kubernetes_version: 'v1.30.4',
          status: 'CONNECTED',
          nodes_count: 8,
          pods_count: 64,
          agent_id: 'ag-real-01',
          agent_name: 'aegis-ebpf-daemon-01',
          agent_status: 'ONLINE',
          last_heartbeat_at: new Date().toISOString(),
        },
      ]);

      render(<AdminClusterOverviewPage />);

      await waitFor(() => {
        expect(clusterService.getAllClusters).toHaveBeenCalled();
        expect(screen.getByText('aegis-prod-k8s-cluster')).toBeInTheDocument();
      });

      expect(screen.getByText('Aegis Enterprise Vietnam')).toBeInTheDocument();
      expect(screen.getByText('v1.30.4')).toBeInTheDocument();
      expect(screen.getByText('8 Nodes')).toBeInTheDocument();
      expect(screen.getByText('64 Pods')).toBeInTheDocument();

      const syncBtn = screen.getByRole('button', { name: /Đồng Bộ Cụm/i });
      fireEvent.click(syncBtn);

      await waitFor(() => {
        expect(
          screen.getByText(/Đã đồng bộ trạng thái telemetry thực tế từ 1 cụm Kubernetes/i)
        ).toBeInTheDocument();
      });
    });
  });

  describe('3. AdminAgentManagementPage (/admin/agents) Real API Connection & Token Lifecycle', () => {
    const mockRealAgent = {
      id: 'ag-real-01',
      name: 'aegis-ebpf-worker-01',
      agent_uid: 'agent-uid-001',
      organization_id: 'org-real-01',
      organization_name: 'Aegis Enterprise Vietnam',
      cluster_id: 'cls-real-prod-01',
      cluster_name: 'aegis-prod-k8s-cluster',
      environment_name: 'Production',
      version: 'v2.5.0-ebpf',
      status: 'ONLINE',
      last_seen_at: new Date().toISOString(),
      last_latency_ms: 1.4,
      active_tokens_count: 1,
      active_token_prefix: 'ag_live_99aa',
      active_token_expires_at: new Date(Date.now() + 90 * 86400000).toISOString(),
    };

    test('3.1. Loads real agents from agentService.getAllAgentsAdmin and rotates token via API', async () => {
      agentService.getAllAgentsAdmin.mockResolvedValue({
        items: [mockRealAgent],
        total: 1,
      });
      agentService.rotateAgentTokenAdmin.mockResolvedValue({
        token_id: 'tok-new-99',
        raw_token: 'ag_live_rotated_secret_token_2026_xyz',
        token_prefix: 'ag_live_rota',
        expires_at: new Date(Date.now() + 90 * 86400000).toISOString(),
      });

      render(<AdminAgentManagementPage />);

      await waitFor(() => {
        expect(agentService.getAllAgentsAdmin).toHaveBeenCalled();
        expect(screen.getByText('aegis-ebpf-worker-01')).toBeInTheDocument();
      });

      expect(screen.getByText('v2.5.0-ebpf')).toBeInTheDocument();
      expect(screen.getByText(/ag_live_99aa/i)).toBeInTheDocument();

      // Open Rotate Token modal
      const rotateBtn = screen.getByRole('button', { name: /Xoay Token/i });
      fireEvent.click(rotateBtn);

      expect(screen.getByText(/Xác Nhận Xoay Vòng Agent Token/i)).toBeInTheDocument();

      const confirmRotateBtn = screen.getByRole('button', { name: /Tiến Hành Xoay Vòng/i });
      fireEvent.click(confirmRotateBtn);

      await waitFor(() => {
        expect(agentService.rotateAgentTokenAdmin).toHaveBeenCalledWith('ag-real-01', 90);
        expect(screen.getByTestId('admin-new-token-banner')).toBeInTheDocument();
      });

      expect(
        screen.getByDisplayValue('ag_live_rotated_secret_token_2026_xyz')
      ).toBeInTheDocument();
    });

    test('3.2. Revokes agent connection via agentService.revokeAgentAdmin and updates UI status to OFFLINE', async () => {
      agentService.getAllAgentsAdmin.mockResolvedValue({
        items: [mockRealAgent],
        total: 1,
      });
      agentService.revokeAgentAdmin.mockResolvedValue({
        id: 'ag-real-01',
        status: 'REVOKED',
      });

      render(<AdminAgentManagementPage />);

      await waitFor(() => {
        expect(screen.getByText('aegis-ebpf-worker-01')).toBeInTheDocument();
      });

      const revokeBtn = screen.getByRole('button', { name: /Thu Hồi/i });
      fireEvent.click(revokeBtn);

      expect(screen.getByText(/Thu Hồi Quyền Kết Nối Của Tác Tử/i)).toBeInTheDocument();

      const confirmRevokeBtn = screen.getByRole('button', { name: /Thu Hồi Ngay/i });
      fireEvent.click(confirmRevokeBtn);

      await waitFor(() => {
        expect(agentService.revokeAgentAdmin).toHaveBeenCalledWith('ag-real-01');
        expect(screen.getByText(/Hết hạn: Đã thu hồi/i)).toBeInTheDocument();
      });
    });
  });
});
