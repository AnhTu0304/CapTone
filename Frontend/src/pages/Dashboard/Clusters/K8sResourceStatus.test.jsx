import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ClusterDetailPage } from './ClusterDetailPage';
import K8sDeploymentsPanel from '../../../components/dashboard/K8sDeploymentsPanel';
import K8sFreshnessBadge from '../../../components/dashboard/K8sFreshnessBadge';
import K8sResourceDetailModal from '../../../components/dashboard/K8sResourceDetailModal';
import { clusterService } from '../../../services/clusterService';
import { nodeService } from '../../../services/nodeService';
import { podService } from '../../../services/podService';
import { deploymentService } from '../../../services/deploymentService';

// Mock contexts and hooks
jest.mock('../context/DashboardContext', () => ({
  useDashboard: () => ({
    currentOrg: { id: 'org-test-123', name: 'Test Org' },
    isRefreshing: false,
    triggerRefresh: jest.fn(),
    onNavigate: jest.fn(),
  }),
}));

jest.mock('../../../hooks/usePermissions', () => ({
  usePermissions: () => ({
    can: () => true,
    userRole: 'ADMIN',
  }),
  PERMISSIONS: {
    CREATE_CLUSTER: 'CREATE_CLUSTER',
    ROTATE_TOKEN: 'ROTATE_TOKEN',
    DISCONNECT_AGENT: 'DISCONNECT_AGENT',
    DELETE_CLUSTER: 'DELETE_CLUSTER',
  },
}));

// Mock services
jest.mock('../../../services/clusterService');
jest.mock('../../../services/nodeService');
jest.mock('../../../services/podService');
jest.mock('../../../services/deploymentService');

// Mock chart panel to simplify DOM
jest.mock('../../../components/dashboard/NodeMetricsChartsPanel', () => {
  return function MockNodeMetricsChartsPanel() {
    return <div data-testid="mock-node-metrics-chart">Mock Chart Panel</div>;
  };
});

describe('K8s Resource Status UI & Polling Synchronization Test Suite [S3][PB14] 5.3', () => {
  const mockClusterId = 'cluster-alpha-001';

  const mockClusterBase = {
    id: mockClusterId,
    name: 'Production-K8s-Cluster',
    environment_type: 'PRODUCTION',
    status: 'CONNECTED',
    agent_status: 'ONLINE',
    organization_id: 'org-test-123',
    agent_id: 'agent-alpha-01',
    namespaces: [{ name: 'default' }, { name: 'kube-system' }, { name: 'ecommerce' }],
    tokens: [
      { id: 'token-1', token_prefix: 'aegis_live_', is_active: true, expires_at: '2026-12-31' },
    ],
    recent_heartbeats: [{ latency_ms: 2.4, status: 'OK' }],
    connection_logs: [],
  };

  const mockNodesData = [
    {
      id: 'node-1',
      name: 'k8s-control-plane-01',
      roles: ['control-plane'],
      ready: true,
      status: 'Ready',
      effective_status: 'Ready',
      active_pressures: [],
      cpu_capacity: '4',
      cpu_allocatable: '3.8',
      cpu_capacity_millicores: 4000,
      cpu_allocatable_millicores: 3800,
      memory_capacity_bytes: 16 * 1024 * 1024 * 1024,
      memory_allocatable_bytes: 14 * 1024 * 1024 * 1024,
      freshness: { is_fresh: true, age_seconds: 15, state: 'FRESH' },
    },
    {
      id: 'node-2',
      name: 'k8s-worker-pressured-02',
      roles: ['worker'],
      ready: false,
      status: 'NotReady',
      effective_status: 'NotReady',
      active_pressures: ['MemoryPressure', 'DiskPressure'],
      cpu_capacity: '8',
      cpu_allocatable: '7.5',
      cpu_capacity_millicores: 8000,
      cpu_allocatable_millicores: 7500,
      memory_capacity_bytes: 32 * 1024 * 1024 * 1024,
      memory_allocatable_bytes: 28 * 1024 * 1024 * 1024,
      freshness: { is_fresh: true, age_seconds: 20, state: 'FRESH' },
    },
    {
      id: 'node-3',
      name: 'k8s-worker-unknown-03',
      roles: ['worker'],
      ready: false,
      status: 'Unknown',
      effective_status: 'Unknown',
      active_pressures: [],
      cpu_capacity: '4',
      cpu_allocatable: '4',
      cpu_capacity_millicores: 4000,
      cpu_allocatable_millicores: 4000,
      memory_capacity_bytes: 16 * 1024 * 1024 * 1024,
      memory_allocatable_bytes: 15 * 1024 * 1024 * 1024,
      freshness: { is_fresh: false, age_seconds: 120, state: 'STALE' },
    },
  ];

  const mockPodsData = [
    {
      id: 'pod-1',
      name: 'api-gateway-7b9f84b65-x2n8q',
      namespace: 'ecommerce',
      phase: 'Running',
      status: 'Running',
      node_name: 'k8s-control-plane-01',
      restart_count: 0,
      image: 'registry.aegis.io/api-gateway:v1.2',
      freshness: { is_fresh: true, age_seconds: 15, state: 'FRESH' },
    },
    {
      id: 'pod-2',
      name: 'payment-service-crashloop-58d7-km9pl',
      namespace: 'ecommerce',
      phase: 'Running',
      status: 'CrashLoopBackOff',
      has_crash_loop: true,
      waiting_reason: 'CrashLoopBackOff',
      waiting_message: 'back-off 5m0s restarting failed container',
      exit_code: 137,
      node_name: 'k8s-worker-pressured-02',
      restart_count: 14,
      image: 'registry.aegis.io/payment-service:v2.0-broken',
      freshness: { is_fresh: true, age_seconds: 18, state: 'FRESH' },
    },
    {
      id: 'pod-3',
      name: 'report-worker-pending-99f8-jj7yt',
      namespace: 'default',
      phase: 'Pending',
      status: 'Pending',
      node_name: null,
      restart_count: 0,
      waiting_reason: 'ContainerCreating',
      waiting_message: '0/3 nodes are available: 1 MemoryPressure',
      freshness: { is_fresh: true, age_seconds: 12, state: 'FRESH' },
    },
  ];

  const mockDeploymentsData = [
    {
      id: 'dep-1',
      name: 'frontend-web',
      namespace: 'default',
      status: 'Healthy',
      rollout_in_progress: false,
      desired_replicas: 3,
      ready_replicas: 3,
      available_replicas: 3,
      updated_replicas: 3,
      unavailable_replicas: 0,
      missing_ready: 0,
      missing_available: 0,
      generation: 4,
      observed_generation: 4,
      conditions: [{ type: 'Available', status: 'True', reason: 'MinimumReplicasAvailable' }],
      freshness: { is_fresh: true, age_seconds: 10, state: 'FRESH' },
    },
    {
      id: 'dep-2',
      name: 'batch-cron-nightly',
      namespace: 'ecommerce',
      status: 'ScaledToZero',
      rollout_in_progress: false,
      desired_replicas: 0,
      ready_replicas: 0,
      available_replicas: 0,
      updated_replicas: 0,
      unavailable_replicas: 0,
      missing_ready: 0,
      missing_available: 0,
      generation: 1,
      observed_generation: 1,
      freshness: { is_fresh: true, age_seconds: 10, state: 'FRESH' },
    },
    {
      id: 'dep-3',
      name: 'order-processor',
      namespace: 'ecommerce',
      status: 'Degraded',
      rollout_in_progress: true,
      desired_replicas: 5,
      ready_replicas: 2,
      available_replicas: 2,
      updated_replicas: 2,
      unavailable_replicas: 3,
      missing_ready: 3,
      missing_available: 3,
      generation: 8,
      observed_generation: 7,
      conditions: [{ type: 'Progressing', status: 'False', reason: 'ProgressDeadlineExceeded' }],
      freshness: { is_fresh: true, age_seconds: 10, state: 'FRESH' },
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    clusterService.getClusterDetail.mockResolvedValue(mockClusterBase);
    clusterService.getClusterStatusSummary.mockResolvedValue({
      summary: {
        nodes: { total: 3, ready: 1, not_ready: 1, unknown: 1 },
        pods: { total: 3, running: 2, pending: 1, crash_loop_count: 1 },
        deployments: { total: 3, healthy: 2, degraded: 1 },
      },
      nodes: mockNodesData,
      pods: mockPodsData,
      deployments: mockDeploymentsData,
      freshness: { is_fresh: true, age_seconds: 15, state: 'FRESH' },
    });
    nodeService.getNodesByCluster.mockResolvedValue(mockNodesData);
    podService.getPodsByCluster.mockResolvedValue(mockPodsData);
    deploymentService.getDeploymentsByCluster.mockResolvedValue(mockDeploymentsData);
  });

  describe('1. K8sFreshnessBadge Component', () => {
    it('1.1. Hiển thị trạng thái FRESH khi age_seconds <= 90s', () => {
      render(<K8sFreshnessBadge freshness={{ is_fresh: true, age_seconds: 25, state: 'FRESH' }} />);
      expect(screen.getByText(/25s trước/i)).toBeInTheDocument();
    });

    it('1.2. Hiển thị cảnh báo STALE và lý do khi age_seconds > 90s', () => {
      render(
        <K8sFreshnessBadge
          freshness={{
            is_fresh: false,
            age_seconds: 140,
            state: 'STALE',
            warning: 'Dữ liệu quá 90s chưa đồng bộ',
          }}
        />
      );
      expect(screen.getByText(/Dữ liệu cũ \(140s trước\)/i)).toBeInTheDocument();
    });

    it('1.3. Hiển thị trạng thái NEVER_SYNCED khi cluster chưa từng có dữ liệu', () => {
      render(<K8sFreshnessBadge freshness={{ is_fresh: false, state: 'NEVER_SYNCED' }} />);
      expect(screen.getByText(/Chưa có dữ liệu đồng bộ/i)).toBeInTheDocument();
    });
  });

  describe('2. Node Status View (Tab Máy Chủ Nodes)', () => {
    it('2.1. Render đầy đủ tên node, effective_status (Ready, NotReady, Unknown) và active pressures', async () => {
      render(<ClusterDetailPage clusterId={mockClusterId} onBack={jest.fn()} />);

      await waitFor(() => {
        expect(screen.getByText('Production-K8s-Cluster')).toBeInTheDocument();
      });

      // Chuyển sang Tab Máy Chủ Nodes
      const nodeTabBtn = screen.getByRole('button', { name: /Máy Chủ Nodes/i });
      fireEvent.click(nodeTabBtn);

      // Verify node 1 (Ready)
      expect(screen.getByText('k8s-control-plane-01')).toBeInTheDocument();
      const readyBadges = screen.getAllByText('Ready');
      expect(readyBadges.length).toBeGreaterThan(0);

      // Verify node 2 (NotReady with MemoryPressure and DiskPressure)
      expect(screen.getByText('k8s-worker-pressured-02')).toBeInTheDocument();
      expect(screen.getByText('NotReady')).toBeInTheDocument();
      expect(screen.getByText('MemoryPressure')).toBeInTheDocument();
      expect(screen.getByText('DiskPressure')).toBeInTheDocument();

      // Verify node 3 (Unknown)
      expect(screen.getByText('k8s-worker-unknown-03')).toBeInTheDocument();
      expect(screen.getByText('Unknown')).toBeInTheDocument();
    });

    it('2.2. Không tự suy diễn NotReady khi mất kết nối mạng và hiển thị Unverified hoặc giữ dữ liệu cũ', async () => {
      const unverifiedNode = [
        {
          id: 'node-unverified',
          name: 'k8s-node-isolated',
          roles: ['worker'],
          ready: null,
          status: 'Unknown',
          effective_status: 'Unverified',
          active_pressures: [],
          freshness: { is_fresh: false, age_seconds: 300, state: 'STALE' },
        },
      ];
      clusterService.getClusterDetail.mockResolvedValue({
        ...mockClusterBase,
        nodes: unverifiedNode,
      });
      clusterService.getClusterStatusSummary.mockResolvedValue({
        summary: { nodes: { total: 1 } },
        nodes: unverifiedNode,
        pods: [],
        deployments: [],
      });
      nodeService.getNodesByCluster.mockResolvedValue(unverifiedNode);

      render(<ClusterDetailPage clusterId={mockClusterId} onBack={jest.fn()} />);
      await waitFor(() => expect(screen.getByText('Production-K8s-Cluster')).toBeInTheDocument());

      const nodeTabBtn = screen.getByRole('button', { name: /Máy Chủ Nodes/i });
      fireEvent.click(nodeTabBtn);

      await waitFor(() => {
        expect(screen.getByText('k8s-node-isolated')).toBeInTheDocument();
        expect(screen.getByText('Unverified')).toBeInTheDocument();
      });
    });

    it('2.3. Mở modal chi tiết Node khi click nút Chi Tiết', async () => {
      render(<ClusterDetailPage clusterId={mockClusterId} onBack={jest.fn()} />);
      await waitFor(() => expect(screen.getByText('Production-K8s-Cluster')).toBeInTheDocument());

      fireEvent.click(screen.getByRole('button', { name: /Máy Chủ Nodes/i }));

      await waitFor(() => {
        expect(screen.getByText('k8s-control-plane-01')).toBeInTheDocument();
      });

      const detailBtns = screen.getAllByRole('button', { name: /Chi Tiết/i });
      fireEvent.click(detailBtns[0]);

      // Verify Modal hiển thị
      await waitFor(() => {
        expect(screen.getByText(/Chi Tiết Máy Chủ Node/i)).toBeInTheDocument();
      });

      // Đóng modal
      fireEvent.click(screen.getByRole('button', { name: /Đóng/i }));
      await waitFor(() => {
        expect(screen.queryByText(/Chi Tiết Máy Chủ Node/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('3. Pod Status View (Tab Tài Nguyên Pods)', () => {
    it('3.1. Phân biệt rõ rệt Pod Phase với Container Waiting Reason & CrashLoopBackOff', async () => {
      render(<ClusterDetailPage clusterId={mockClusterId} onBack={jest.fn()} />);
      await waitFor(() => expect(screen.getByText('Production-K8s-Cluster')).toBeInTheDocument());

      fireEvent.click(screen.getByRole('button', { name: /Tài Nguyên Pods Đang Chạy/i }));

      // Pod 1 bình thường
      expect(screen.getByText('api-gateway-7b9f84b65-x2n8q')).toBeInTheDocument();

      // Pod 2 CrashLoopBackOff: Phase Running nhưng Status/Reason là CrashLoopBackOff
      expect(screen.getByText('payment-service-crashloop-58d7-km9pl')).toBeInTheDocument();
      const runningPhases = screen.getAllByText(/Phase: Running/i);
      expect(runningPhases.length).toBeGreaterThan(0);

      const crashBadges = screen.getAllByText('CrashLoopBackOff');
      expect(crashBadges.length).toBeGreaterThan(0);
      expect(screen.getByText(/Exit 137/i)).toBeInTheDocument();
      expect(screen.getByText('14')).toBeInTheDocument(); // restart count

      // Pod 3 Pending
      expect(screen.getByText('report-worker-pending-99f8-jj7yt')).toBeInTheDocument();
      expect(screen.getByText(/Phase: Pending/i)).toBeInTheDocument();
      expect(screen.getByText(/ContainerCreating/i)).toBeInTheDocument();
    });

    it('3.2. Lọc Pods theo bộ lọc Chỉ CrashLoop và Namespace', async () => {
      render(<ClusterDetailPage clusterId={mockClusterId} onBack={jest.fn()} />);
      await waitFor(() => expect(screen.getByText('Production-K8s-Cluster')).toBeInTheDocument());

      fireEvent.click(screen.getByRole('button', { name: /Tài Nguyên Pods Đang Chạy/i }));

      // Check checkbox Chỉ CrashLoop
      const crashLoopCheckbox = screen.getByLabelText(/Chỉ CrashLoop/i);
      fireEvent.click(crashLoopCheckbox);

      // Chỉ còn pod payment-service
      expect(screen.getByText('payment-service-crashloop-58d7-km9pl')).toBeInTheDocument();
      expect(screen.queryByText('api-gateway-7b9f84b65-x2n8q')).not.toBeInTheDocument();
      expect(screen.queryByText('report-worker-pending-99f8-jj7yt')).not.toBeInTheDocument();
    });
  });

  describe('4. K8sDeploymentsPanel & Replica Status View', () => {
    it('4.1. Render trạng thái Deployments bao gồm Healthy, Degraded và ScaledToZero (desired=0)', () => {
      const onSelect = jest.fn();
      render(
        <K8sDeploymentsPanel
          deployments={mockDeploymentsData}
          namespaces={[{ name: 'default' }, { name: 'ecommerce' }]}
          onSelectDeployment={onSelect}
        />
      );

      // 1. Healthy deployment
      expect(screen.getByText('frontend-web')).toBeInTheDocument();
      const healthyBadges = screen.getAllByText(/Khỏe mạnh/i);
      expect(healthyBadges.length).toBeGreaterThan(0);

      // 2. ScaledToZero deployment (hợp lệ, chủ đích, không phải lỗi)
      expect(screen.getByText('batch-cron-nightly')).toBeInTheDocument();
      expect(screen.getAllByText(/Scaled To Zero/i).length).toBeGreaterThan(0);

      // 3. Degraded deployment
      expect(screen.getByText('order-processor')).toBeInTheDocument();
      expect(screen.getAllByText(/Thiếu Replica/i).length).toBeGreaterThan(0);

      // Click chi tiết
      const detailBtns = screen.getAllByRole('button', { name: /Chi Tiết/i });
      fireEvent.click(detailBtns[0]);
      expect(onSelect).toHaveBeenCalledWith(mockDeploymentsData[0]);
    });

    it('4.2. Tìm kiếm và lọc Deployment theo namespace và trạng thái', () => {
      render(
        <K8sDeploymentsPanel
          deployments={mockDeploymentsData}
          namespaces={[{ name: 'default' }, { name: 'ecommerce' }]}
          onSelectDeployment={jest.fn()}
        />
      );

      const searchInput = screen.getByPlaceholderText(/Tìm Deployment.../i);
      fireEvent.change(searchInput, { target: { value: 'batch-cron' } });

      expect(screen.getByText('batch-cron-nightly')).toBeInTheDocument();
      expect(screen.queryByText('frontend-web')).not.toBeInTheDocument();
      expect(screen.queryByText('order-processor')).not.toBeInTheDocument();
    });
  });

  describe('5. K8sResourceDetailModal Component', () => {
    it('5.1. Render modal chi tiết Deployment với phân tích Replicas và Rollout conditions', () => {
      const onClose = jest.fn();
      render(
        <K8sResourceDetailModal
          resource={mockDeploymentsData[2]}
          type="DEPLOYMENT"
          onClose={onClose}
        />
      );

      expect(screen.getByRole('heading', { level: 3, name: /order-processor/i })).toBeInTheDocument();
      expect(screen.getByText(/ProgressDeadlineExceeded/i)).toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument(); // Desired
      expect(screen.getAllByText('2').length).toBeGreaterThan(0); // Ready, available, updated

      fireEvent.click(screen.getByRole('button', { name: /Đóng/i }));
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('6. Polling & Transient Error Handling', () => {
    it('6.1. Giữ lại dữ liệu đã có và hiển thị cảnh báo lỗi khi mạng tạm thời bị ngắt', async () => {
      // Đầu tiên load thành công
      render(<ClusterDetailPage clusterId={mockClusterId} onBack={jest.fn()} />);
      await waitFor(() => expect(screen.getByText('Production-K8s-Cluster')).toBeInTheDocument());

      // Lần cập nhật tiếp theo gặp lỗi mạng 500
      clusterService.getClusterStatusSummary.mockRejectedValueOnce(
        new Error('Network connection timeout')
      );

      // Bấm nút Refresh thủ công
      const refreshBtn = screen.getByRole('button', { name: /Đồng Bộ/i });
      fireEvent.click(refreshBtn);

      // Dữ liệu cũ vẫn còn nguyên (không bị trắng màn hình)
      await waitFor(() => {
        expect(screen.getByText('Production-K8s-Cluster')).toBeInTheDocument();
      });
    });
  });
});
