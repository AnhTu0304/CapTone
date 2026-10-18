import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import AdminInfrastructurePage from './Infrastructure/AdminInfrastructurePage';
import ClusterTable from '../../components/admin/infrastructure/ClusterTable';
import AgentTable from '../../components/admin/infrastructure/AgentTable';
import NodeTable from '../../components/admin/infrastructure/NodeTable';
import WorkloadTable from '../../components/admin/infrastructure/WorkloadTable';
import {
  getInfrastructureKPIs,
  getInfrastructureClusters,
  getInfrastructureAgents,
  getInfrastructureNodes,
  getInfrastructureWorkloads,
} from '../../services/adminInfrastructureService';

describe('Platform Admin Infrastructure Module', () => {
  describe('Service Layer Data Contracts', () => {
    test('getInfrastructureKPIs returns valid metrics structure', async () => {
      const kpis = await getInfrastructureKPIs();
      expect(kpis).toHaveProperty('totalClusters');
      expect(kpis).toHaveProperty('readyClusters');
      expect(kpis).toHaveProperty('totalNodes');
      expect(kpis).toHaveProperty('readyNodes');
      expect(kpis).toHaveProperty('totalAgents');
      expect(kpis).toHaveProperty('onlineAgents');
      expect(kpis).toHaveProperty('totalWorkloads');
      expect(kpis).toHaveProperty('healthyWorkloads');
    });

    test('getInfrastructureClusters returns clusters with all required fields', async () => {
      const clusters = await getInfrastructureClusters();
      expect(clusters.length).toBeGreaterThan(0);
      const c = clusters[0];
      expect(c).toHaveProperty('name');
      expect(c).toHaveProperty('organizationName');
      expect(c).toHaveProperty('environment');
      expect(c).toHaveProperty('k8sVersion');
      expect(c).toHaveProperty('status');
      expect(c).toHaveProperty('nodeCount');
      expect(c).toHaveProperty('podCount');
      expect(c).toHaveProperty('agentStatus');
      expect(c).toHaveProperty('lastSync');
    });

    test('getInfrastructureAgents returns agents with all required fields', async () => {
      const agents = await getInfrastructureAgents();
      expect(agents.length).toBeGreaterThan(0);
      const a = agents[0];
      expect(a).toHaveProperty('name');
      expect(a).toHaveProperty('organizationName');
      expect(a).toHaveProperty('clusterName');
      expect(a).toHaveProperty('version');
      expect(a).toHaveProperty('status');
      expect(a).toHaveProperty('lastHeartbeat');
      expect(a).toHaveProperty('latency');
    });

    test('getInfrastructureNodes returns nodes with capacity details', async () => {
      const nodes = await getInfrastructureNodes();
      expect(nodes.length).toBeGreaterThan(0);
      const n = nodes[0];
      expect(n).toHaveProperty('name');
      expect(n).toHaveProperty('clusterName');
      expect(n).toHaveProperty('status');
      expect(n).toHaveProperty('cpuAllocated');
      expect(n).toHaveProperty('cpuTotal');
      expect(n).toHaveProperty('memoryAllocatedGB');
      expect(n).toHaveProperty('memoryTotalGB');
      expect(n).toHaveProperty('k8sVersion');
    });

    test('getInfrastructureWorkloads returns workloads with replica metrics', async () => {
      const workloads = await getInfrastructureWorkloads();
      expect(workloads.length).toBeGreaterThan(0);
      const w = workloads[0];
      expect(w).toHaveProperty('name');
      expect(w).toHaveProperty('namespace');
      expect(w).toHaveProperty('clusterName');
      expect(w).toHaveProperty('type');
      expect(w).toHaveProperty('replicas');
      expect(w).toHaveProperty('availableReplicas');
      expect(w).toHaveProperty('status');
    });
  });

  describe('ClusterTable - No Raw K8s Commands', () => {
    test('renders cluster details and abstract safe action buttons', () => {
      const mockClusters = [
        {
          id: 'c1',
          name: 'acme-production-us-east',
          organizationName: 'Acme Infrastructure Corp',
          environment: 'Production',
          k8sVersion: 'v1.30.2',
          status: 'READY',
          nodeCount: 16,
          podCount: 142,
          agentStatus: 'ONLINE',
          agentVersion: 'v2.4.1-ebpf',
          lastSync: '10 giây trước',
        },
      ];

      render(<ClusterTable clusters={mockClusters} isLoading={false} />);

      expect(screen.getByText('acme-production-us-east')).toBeInTheDocument();
      expect(screen.getByText('Acme Infrastructure Corp')).toBeInTheDocument();
      expect(screen.getByText('Production')).toBeInTheDocument();
      expect(screen.getByText('v1.30.2')).toBeInTheDocument();
      expect(screen.getByText('Sẵn Sàng')).toBeInTheDocument();
      expect(screen.getByText('16')).toBeInTheDocument();
      expect(screen.getByText('142')).toBeInTheDocument();

      // Check abstract action buttons
      expect(screen.getByText('Đồng Bộ')).toBeInTheDocument();
      expect(screen.getByText('Quét An Toàn')).toBeInTheDocument();

      // Verify no raw kubectl commands exist
      expect(screen.queryByText(/kubectl/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/drain/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/cordon/i)).not.toBeInTheDocument();
    });

    test('renders gracefully without crashing when podCount or nodeCount is undefined', () => {
      const incompleteClusters = [
        {
          id: 'c-incomplete',
          name: 'k8s-edge-cluster',
          // podCount is deliberately undefined (uses podsCount or fallback)
          podsCount: 42,
          // nodeCount is undefined (uses nodesCount or fallback)
          nodesCount: 5,
        },
        {
          id: 'c-empty',
          name: 'k8s-barebones',
          // both podCount and podsCount missing
        },
      ];

      expect(() => {
        render(<ClusterTable clusters={incompleteClusters} isLoading={false} />);
      }).not.toThrow();

      expect(screen.getByText('k8s-edge-cluster')).toBeInTheDocument();
      expect(screen.getByText('42')).toBeInTheDocument();
      expect(screen.getByText('k8s-barebones')).toBeInTheDocument();
    });
  });

  describe('AgentTable - eBPF Monitoring', () => {
    test('renders agent details and latency without raw commands', () => {
      const mockAgents = [
        {
          id: 'a1',
          name: 'ebpf-probe-acme-prod-01',
          organizationName: 'Acme Infrastructure Corp',
          clusterName: 'acme-production-us-east',
          clusterId: 'k8s-c1',
          version: 'v2.4.1-ebpf',
          status: 'ONLINE',
          lastHeartbeat: '5 giây trước',
          latency: '1.1ms',
        },
      ];

      render(<AgentTable agents={mockAgents} isLoading={false} />);

      expect(screen.getByText('ebpf-probe-acme-prod-01')).toBeInTheDocument();
      expect(screen.getByText('Acme Infrastructure Corp')).toBeInTheDocument();
      expect(screen.getByText('acme-production-us-east')).toBeInTheDocument();
      expect(screen.getByText('v2.4.1-ebpf')).toBeInTheDocument();
      expect(screen.getByText('Trực Tuyến')).toBeInTheDocument();
      expect(screen.getByText('5 giây trước')).toBeInTheDocument();
      expect(screen.getByText('1.1ms')).toBeInTheDocument();
      expect(screen.getByText('Đo Nhịp Tim')).toBeInTheDocument();

      expect(screen.queryByText(/kubectl/i)).not.toBeInTheDocument();
    });
  });

  describe('NodeTable - Hardware Capacity', () => {
    test('renders node resources and safe maintenance button', () => {
      const mockNodes = [
        {
          id: 'n1',
          name: 'ip-10-0-12-44.ec2.internal',
          clusterName: 'acme-production-us-east',
          clusterId: 'k8s-c1',
          organizationName: 'Acme Infrastructure Corp',
          status: 'READY',
          cpuAllocated: 28,
          cpuTotal: 32,
          cpuPercent: 88,
          memoryAllocatedGB: 96,
          memoryTotalGB: 128,
          memoryPercent: 75,
          k8sVersion: 'v1.30.2',
        },
      ];

      render(<NodeTable nodes={mockNodes} isLoading={false} />);

      expect(screen.getByText('ip-10-0-12-44.ec2.internal')).toBeInTheDocument();
      expect(screen.getByText('acme-production-us-east')).toBeInTheDocument();
      expect(screen.getByText(/28 \/ 32 Cores/i)).toBeInTheDocument();
      expect(screen.getByText(/96 \/ 128 GB/i)).toBeInTheDocument();
      expect(screen.getByText('v1.30.2')).toBeInTheDocument();
      expect(screen.getByText('Bảo Trì')).toBeInTheDocument();

      expect(screen.queryByText(/kubectl/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/kubectl drain/i)).not.toBeInTheDocument();
    });
  });

  describe('WorkloadTable - Pod Deployments', () => {
    test('renders workload replicas and safe rollout button', () => {
      const mockWorkloads = [
        {
          id: 'w1',
          name: 'auth-service',
          namespace: 'core-platform',
          clusterName: 'acme-production-us-east',
          organizationName: 'Acme Infrastructure Corp',
          type: 'Deployment',
          replicas: 6,
          availableReplicas: 6,
          status: 'HEALTHY',
        },
      ];

      render(<WorkloadTable workloads={mockWorkloads} isLoading={false} />);

      expect(screen.getByText('auth-service')).toBeInTheDocument();
      expect(screen.getByText('core-platform')).toBeInTheDocument();
      expect(screen.getByText('acme-production-us-east')).toBeInTheDocument();
      expect(screen.getByText('Deployment')).toBeInTheDocument();
      expect(screen.getByText('6 Pods')).toBeInTheDocument();
      expect(screen.getByText('6 / 6')).toBeInTheDocument();
      expect(screen.getByText('Cuộn An Toàn')).toBeInTheDocument();

      expect(screen.queryByText(/kubectl/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/kubectl delete/i)).not.toBeInTheDocument();
    });
  });

  describe('AdminInfrastructurePage', () => {
    test('renders page heading, KPI metrics, and cluster table by default', async () => {
      const mockNavigate = jest.fn();
      render(<AdminInfrastructurePage currentSection="clusters" onNavigate={mockNavigate} />);

      expect(
        screen.getByText(/Quản Trị Hạ Tầng Kubernetes & Tác Tử eBPF/i)
      ).toBeInTheDocument();

      // Wait for table to load
      await waitFor(() => {
        expect(screen.getByText('acme-production-us-east')).toBeInTheDocument();
      });

      expect(screen.getByText('fintech-core-prod-sg')).toBeInTheDocument();
    });

    test('switches tabs and calls onNavigate', async () => {
      const mockNavigate = jest.fn();
      render(<AdminInfrastructurePage currentSection="clusters" onNavigate={mockNavigate} />);

      await waitFor(() => {
        expect(screen.getByText('acme-production-us-east')).toBeInTheDocument();
      });

      const agentsTab = screen.getByRole('tab', { name: /Tác Tử eBPF/i });
      fireEvent.click(agentsTab);

      expect(mockNavigate).toHaveBeenCalledWith('/admin/infrastructure/agents');

      // Wait for agent data
      await waitFor(() => {
        expect(screen.getByText('ebpf-probe-acme-prod-01')).toBeInTheDocument();
      });
    });

    test('filters clusters based on search query', async () => {
      render(<AdminInfrastructurePage currentSection="clusters" onNavigate={jest.fn()} />);

      await waitFor(() => {
        expect(screen.getByText('acme-production-us-east')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/Tìm kiếm trong Cụm K8s.../i);
      fireEvent.change(searchInput, { target: { value: 'fintech' } });

      await waitFor(() => {
        expect(screen.getByText('fintech-core-prod-sg')).toBeInTheDocument();
        expect(screen.queryByText('acme-production-us-east')).not.toBeInTheDocument();
      });
    });

    test('triggers safe action notification toast when clicking sync', async () => {
      render(<AdminInfrastructurePage currentSection="clusters" onNavigate={jest.fn()} />);

      await waitFor(() => {
        expect(screen.getByText('acme-production-us-east')).toBeInTheDocument();
      });

      const syncButtons = screen.getAllByText('Đồng Bộ');
      fireEvent.click(syncButtons[0]);

      await waitFor(() => {
        expect(
          screen.getByText(/Đã gửi yêu cầu đồng bộ cấu hình cho cụm acme-production-us-east/i)
        ).toBeInTheDocument();
      });
    });
  });
});
