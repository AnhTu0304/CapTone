import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ClustersPage } from './ClustersPage';
import { ClusterDetailPage } from './ClusterDetailPage';
import { AgentsPage } from '../Agents/index';
import { ToastProvider } from '../../../context/ToastContext';
import { AuthProvider } from '../../../context/AuthContext';
import { DashboardProvider } from '../context/DashboardContext';
import { clusterService } from '../../../services/clusterService';
import { agentService } from '../../../services/agentService';

jest.mock('../../../services/clusterService', () => ({
  clusterService: {
    getClustersByOrg: jest.fn(),
    getAllClusters: jest.fn(),
    getClusterDetail: jest.fn(),
    createCluster: jest.fn(),
    rotateClusterToken: jest.fn(),
    revokeClusterToken: jest.fn(),
    disconnectAgent: jest.fn(),
    removeCluster: jest.fn(),
    updateAgentConfig: jest.fn(),
  },
}));

jest.mock('../../../services/agentService', () => ({
  agentService: {
    getAgents: jest.fn(),
    getAgentDetail: jest.fn(),
    revokeAgent: jest.fn(),
    disconnectAgent: jest.fn(),
    deleteAgent: jest.fn(),
  },
}));

const mockClusterData = {
  id: 'c1000000-0000-0000-0000-000000000001',
  name: 'prod-k8s-cluster',
  environment_type: 'PRODUCTION',
  environment_name: 'Production',
  provider: 'MINIKUBE',
  kubernetes_version: 'v1.29.4',
  nodes_count: 3,
  pods_count: 12,
  status: 'CONNECTED',
  agent_id: 'a1000000-0000-0000-0000-000000000001',
  agent_name: 'Agent Main',
  agent_status: 'ONLINE',
  token_prefix: 'sh_live_sec_abcd1234',
  created_at: new Date().toISOString(),
  tokens: [
    {
      id: 'tok-01',
      token_prefix: 'sh_live_sec_abcd1234',
      expires_at: new Date(Date.now() + 86400000 * 30).toISOString(),
      revoked_at: null,
      created_at: new Date().toISOString(),
    },
  ],
  nodes: [{ name: 'minikube-node-1', status: 'Ready' }],
  pods: [{ name: 'selfheal-agent-pod-1', status: 'Running', namespace: 'selfheal-system' }],
};

const mockAgentsList = [
  {
    id: 'a1000000-0000-0000-0000-000000000001',
    name: 'Agent Primary',
    agent_uid: 'uid-agent-prod-01',
    cluster_id: 'c1000000-0000-0000-0000-000000000001',
    cluster_name: 'prod-k8s-cluster',
    version: '1.0.0',
    status: 'ONLINE',
    last_seen_at: new Date().toISOString(),
    active_tokens_count: 1,
  },
  {
    id: 'a2000000-0000-0000-0000-000000000002',
    name: 'Agent Secondary',
    agent_uid: 'uid-agent-prod-02',
    cluster_id: 'c1000000-0000-0000-0000-000000000001',
    cluster_name: 'prod-k8s-cluster',
    version: '1.0.0',
    status: 'OFFLINE',
    last_seen_at: new Date(Date.now() - 3600000).toISOString(),
    active_tokens_count: 0,
  },
];

const renderComponent = (component, role = 'SME_OWNER') => {
  localStorage.setItem('selfheal_active_org_id', 'b6000000-0000-0000-0000-000000000001');
  localStorage.setItem('selfheal_active_org_name', 'Acme Real Org');
  localStorage.setItem('selfheal_active_org_role', role);

  return render(
    <ToastProvider>
      <AuthProvider>
        <DashboardProvider>
          {component}
        </DashboardProvider>
      </AuthProvider>
    </ToastProvider>
  );
};

describe('Cluster, Token & Agent Management UI Test Suite [PB12 3.3]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    Object.assign(navigator, {
      clipboard: {
        writeText: jest.fn().mockImplementation(() => Promise.resolve()),
      },
    });

    clusterService.getClustersByOrg.mockResolvedValue([mockClusterData]);
    clusterService.getClusterDetail.mockResolvedValue(mockClusterData);
    agentService.getAgents.mockResolvedValue({ items: mockAgentsList, total: 2 });
  });

  describe('1. UI Quản lý Cluster (ClustersPage)', () => {
    test('1.1. Render danh sách cụm K8s với dữ liệu thực tế từ Backend', async () => {
      renderComponent(<ClustersPage />);

      await waitFor(() => {
        expect(screen.getByText('prod-k8s-cluster')).toBeInTheDocument();
      });
      expect(screen.getByText('Quản Lý Cụm Kubernetes Đa Môi Trường')).toBeInTheDocument();
      expect(screen.getByText('Đang hoạt động (Online)')).toBeInTheDocument();
    });

    test('1.2. Mở modal tạo cụm và hiển thị Token 1 lần duy nhất khi tạo thành công', async () => {
      clusterService.createCluster.mockResolvedValueOnce({
        cluster: { id: 'c1000000-0000-0000-0000-000000000002', name: 'staging-cluster' },
        agent: { id: 'a-new', name: 'Agent New' },
        token: {
          id: 'tok-new',
          token: 'sh_live_sec_raw_initial_token_12345',
          token_prefix: 'sh_live_sec_raw_',
          expires_at: new Date().toISOString(),
        },
      });

      renderComponent(<ClustersPage />);

      await waitFor(() => {
        expect(screen.getByText('prod-k8s-cluster')).toBeInTheDocument();
      });

      const addBtn = screen.getByText('Đăng Ký Cụm Mới');
      fireEvent.click(addBtn);

      const nameInput = screen.getByPlaceholderText('ví dụ: k8s-prod-cluster-02');
      fireEvent.change(nameInput, { target: { value: 'staging-cluster' } });

      const submitBtn = screen.getByRole('button', { name: 'Đăng Ký Cụm' });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByTestId('token-display-modal')).toBeInTheDocument();
      });

      expect(screen.getByText('BẢO MẬT: CHỈ HIỂN THỊ 1 LẦN')).toBeInTheDocument();
      const tokenInput = screen.getByTestId('raw-token-input');
      expect(tokenInput).toHaveValue('sh_live_sec_raw_initial_token_12345');

      // Test copy raw token
      const copyBtn = screen.getByTestId('copy-raw-token-btn');
      fireEvent.click(copyBtn);
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('sh_live_sec_raw_initial_token_12345');

      // Close modal
      const closeBtn = screen.getByTestId('close-token-modal-btn');
      fireEvent.click(closeBtn);

      expect(screen.queryByTestId('token-display-modal')).not.toBeInTheDocument();
    });

    test('1.3. RBAC: Vai trò VIEWER không nhìn thấy nút Đăng Ký Cụm Mới', async () => {
      renderComponent(<ClustersPage />, 'VIEWER');

      await waitFor(() => {
        expect(screen.getByText('prod-k8s-cluster')).toBeInTheDocument();
      });

      expect(screen.queryByText('Đăng Ký Cụm Mới')).not.toBeInTheDocument();
    });
  });

  describe('2. UI Chi Tiết Cụm & Vòng Đời Token (ClusterDetailPage)', () => {
    test('2.1. Render chi tiết Cụm, thông tin Agent và danh sách Token bảo mật', async () => {
      renderComponent(<ClusterDetailPage clusterId={mockClusterData.id} />);

      await waitFor(() => {
        expect(screen.getByText('prod-k8s-cluster')).toBeInTheDocument();
      });

      // Default active tab is 'agent' which displays token prefix
      await waitFor(() => {
        expect(screen.getByDisplayValue(/sh_live_sec_abcd1234/)).toBeInTheDocument();
      });
    });

    test('2.2. Xoay vòng Token (Rotate Token) hiển thị token mới một lần duy nhất', async () => {
      clusterService.rotateClusterToken.mockResolvedValueOnce({
        token: 'sh_live_sec_new_rotated_secret_99999',
        token_prefix: 'sh_live_sec_new_',
        message: 'Xoay vòng Token thành công',
      });

      renderComponent(<ClusterDetailPage clusterId={mockClusterData.id} />);

      await waitFor(() => {
        expect(screen.getByText('prod-k8s-cluster')).toBeInTheDocument();
      });

      const rotateButtons = screen.getAllByText(/Xoay Vòng \/ Đổi Token/i);
      fireEvent.click(rotateButtons[0]);

      expect(screen.getByText(/Xoay Vòng Mã Token Agent/i)).toBeInTheDocument();

      const confirmRotateBtn = screen.getByTestId('confirm-rotate-token-btn');
      fireEvent.click(confirmRotateBtn);

      await waitFor(() => {
        expect(clusterService.rotateClusterToken).toHaveBeenCalled();
        expect(screen.getAllByDisplayValue('sh_live_sec_new_rotated_secret_99999').length).toBeGreaterThanOrEqual(1);
      });
    });

    test('2.3. Xóa Cụm K8s với cờ an toàn force=true khi Agent đang ONLINE', async () => {
      clusterService.removeCluster.mockResolvedValueOnce({ success: true });

      renderComponent(<ClusterDetailPage clusterId={mockClusterData.id} />);

      await waitFor(() => {
        expect(screen.getByText('prod-k8s-cluster')).toBeInTheDocument();
      });

      // Switch to 'config' tab where Remove Cluster section lives
      const configTabBtn = screen.getByText('Cấu Hình & Vùng Thao Tác');
      fireEvent.click(configTabBtn);

      // Open remove modal
      const removeBtn = screen.getByText('Xóa Cụm Kubernetes');
      fireEvent.click(removeBtn);

      expect(screen.getByText('Xác Nhận Xóa Cụm Kubernetes')).toBeInTheDocument();

      // Confirm cluster name
      const nameInput = screen.getByPlaceholderText('prod-k8s-cluster');
      fireEvent.change(nameInput, { target: { value: 'prod-k8s-cluster' } });

      // Force checkbox when agent is online
      const forceCheckbox = screen.getByTestId('force-remove-cluster-checkbox');
      expect(forceCheckbox).toBeInTheDocument();
      fireEvent.click(forceCheckbox);
      expect(forceCheckbox.checked).toBe(true);

      const confirmDeleteBtn = screen.getByText('Tôi Hiểu Hậu Quả, Xóa Cụm Này');
      fireEvent.click(confirmDeleteBtn);

      await waitFor(() => {
        expect(clusterService.removeCluster).toHaveBeenCalledWith(
          mockClusterData.id,
          expect.anything(),
          true
        );
      });
    });

    test('2.4. RBAC: Vai trò DEVOPS không có quyền xóa Cụm (Nút Xóa bị ẩn)', async () => {
      renderComponent(<ClusterDetailPage clusterId={mockClusterData.id} />, 'DEVOPS');

      await waitFor(() => {
        expect(screen.getByText('prod-k8s-cluster')).toBeInTheDocument();
      });

      // Switch to config tab
      const configTabBtn = screen.getByText('Cấu Hình & Vùng Thao Tác');
      fireEvent.click(configTabBtn);

      expect(screen.queryByText('Xóa Cụm Kubernetes Này')).not.toBeInTheDocument();
    });
  });

  describe('3. UI Điều Khiển & Theo Dõi Agent (AgentsPage)', () => {
    test('3.1. Render danh sách Tác tử eBPF với trạng thái và số liệu nhịp tim', async () => {
      renderComponent(<AgentsPage />);

      await waitFor(() => {
        expect(screen.getByText('Agent Primary')).toBeInTheDocument();
        expect(screen.getByText('Agent Secondary')).toBeInTheDocument();
      });

      expect(screen.getAllByText('Trực tuyến')[0]).toBeInTheDocument();
      expect(screen.getAllByText('Ngoại tuyến')[0]).toBeInTheDocument();
    });

    test('3.2. Ngắt kết nối Agent (Disconnect) chuyển trạng thái và thu hồi token', async () => {
      agentService.disconnectAgent.mockResolvedValueOnce({
        id: mockAgentsList[0].id,
        status: 'OFFLINE',
        message: 'Ngắt kết nối thành công',
      });

      renderComponent(<AgentsPage />);

      await waitFor(() => {
        expect(screen.getByText('Agent Primary')).toBeInTheDocument();
      });

      const disconnectBtn = screen.getByTestId(`disconnect-agent-btn-${mockAgentsList[0].id}`);
      fireEvent.click(disconnectBtn);

      expect(screen.getByTestId('disconnect-agent-modal')).toBeInTheDocument();
      expect(screen.getByText(/Bạn có chắc chắn muốn ngắt kết nối Tác tử/)).toBeInTheDocument();

      const confirmBtn = screen.getByTestId('confirm-disconnect-agent-btn');
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(agentService.disconnectAgent).toHaveBeenCalledWith(
          expect.anything(),
          mockAgentsList[0].id
        );
      });
    });

    test('3.3. Xóa Agent với cờ an toàn force=true khi đang ONLINE', async () => {
      agentService.deleteAgent.mockResolvedValueOnce({ success: true });

      renderComponent(<AgentsPage />);

      await waitFor(() => {
        expect(screen.getByText('Agent Primary')).toBeInTheDocument();
      });

      const deleteBtn = screen.getByTestId(`delete-agent-btn-${mockAgentsList[0].id}`);
      fireEvent.click(deleteBtn);

      expect(screen.getByTestId('delete-agent-modal')).toBeInTheDocument();

      // Checkbox force is displayed because agent is ONLINE
      const forceCheckbox = screen.getByTestId('force-delete-agent-checkbox');
      expect(forceCheckbox).toBeInTheDocument();
      fireEvent.click(forceCheckbox);
      expect(forceCheckbox.checked).toBe(true);

      const confirmBtn = screen.getByTestId('confirm-delete-agent-btn');
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(agentService.deleteAgent).toHaveBeenCalledWith(
          expect.anything(),
          mockAgentsList[0].id,
          true
        );
      });
    });

    test('3.4. RBAC: Vai trò VIEWER không có quyền Ngắt kết nối hoặc Xóa Agent', async () => {
      renderComponent(<AgentsPage />, 'VIEWER');

      await waitFor(() => {
        expect(screen.getByText('Agent Primary')).toBeInTheDocument();
      });

      expect(screen.queryByTestId(`disconnect-agent-btn-${mockAgentsList[0].id}`)).not.toBeInTheDocument();
      expect(screen.queryByTestId(`delete-agent-btn-${mockAgentsList[0].id}`)).not.toBeInTheDocument();
    });

    test('3.5. RBAC: Vai trò DEVOPS có quyền Ngắt kết nối nhưng KHÔNG có quyền Xóa Agent', async () => {
      renderComponent(<AgentsPage />, 'DEVOPS');

      await waitFor(() => {
        expect(screen.getByText('Agent Primary')).toBeInTheDocument();
      });

      expect(screen.getByTestId(`disconnect-agent-btn-${mockAgentsList[0].id}`)).toBeInTheDocument();
      expect(screen.queryByTestId(`delete-agent-btn-${mockAgentsList[0].id}`)).not.toBeInTheDocument();
    });
  });
});
