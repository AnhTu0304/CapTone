import { clusterService } from './clusterService';
import { agentService } from './agentService';

const hasActiveAuthToken = () =>
  Boolean(
    typeof window !== 'undefined' &&
      (sessionStorage.getItem('admin_access_token') ||
        localStorage.getItem('admin_access_token') ||
        localStorage.getItem('selfheal_auth_token') ||
        localStorage.getItem('token'))
  );

/**
 * @file adminInfrastructureService.js
 * Platform Admin Infrastructure Service Layer
 * Decoupled mock service providing typed data models for multi-tenant K8s infrastructure:
 * Clusters, eBPF Agents, Nodes, and Workloads.
 * Does NOT expose raw Kubernetes commands in the Admin UI.
 */

/**
 * @typedef {Object} InfrastructureCluster
 * @property {string} id - Unique cluster ID
 * @property {string} name - Cluster display name
 * @property {string} organizationId - Tenant organization ID
 * @property {string} organizationName - Tenant display name
 * @property {string} environment - 'Production' | 'Staging' | 'Development'
 * @property {string} k8sVersion - Kubernetes version (e.g., 'v1.30.2')
 * @property {string} status - 'READY' | 'WARNING' | 'CRITICAL'
 * @property {number} nodeCount - Number of registered nodes
 * @property {number} podCount - Total running pods
 * @property {string} agentStatus - eBPF Agent status ('ONLINE' | 'DEGRADED' | 'OFFLINE')
 * @property {string} agentVersion - Agent release version
 * @property {string} lastSync - Last synchronization timestamp
 */

/**
 * @typedef {Object} InfrastructureAgent
 * @property {string} id - Unique agent identifier
 * @property {string} name - Agent probe name
 * @property {string} organizationId - Tenant organization ID
 * @property {string} organizationName - Tenant display name
 * @property {string} clusterId - Target cluster ID
 * @property {string} clusterName - Target cluster display name
 * @property {string} version - Probe version (e.g., 'v2.4.1-ebpf')
 * @property {string} status - 'ONLINE' | 'DEGRADED' | 'OFFLINE'
 * @property {string} lastHeartbeat - Last heartbeat received
 * @property {string} latency - Latency measurement (e.g., '1.2ms')
 */

/**
 * @typedef {Object} InfrastructureNode
 * @property {string} id - Node identifier
 * @property {string} name - Node hostname
 * @property {string} clusterId - Parent cluster ID
 * @property {string} clusterName - Parent cluster display name
 * @property {string} organizationName - Tenant organization name
 * @property {string} status - 'READY' | 'NOT_READY' | 'MAINTENANCE'
 * @property {number} cpuAllocated - Cores currently in use
 * @property {number} cpuTotal - Total physical/virtual cores
 * @property {number} cpuPercent - Utilization percentage
 * @property {number} memoryAllocatedGB - RAM currently allocated (GB)
 * @property {number} memoryTotalGB - Total physical RAM (GB)
 * @property {number} memoryPercent - Memory utilization percentage
 * @property {string} k8sVersion - Node K8s version
 */

/**
 * @typedef {Object} InfrastructureWorkload
 * @property {string} id - Workload identifier
 * @property {string} name - Workload service name
 * @property {string} namespace - Kubernetes namespace
 * @property {string} clusterId - Parent cluster ID
 * @property {string} clusterName - Parent cluster display name
 * @property {string} organizationName - Tenant organization name
 * @property {string} type - 'Deployment' | 'StatefulSet' | 'DaemonSet'
 * @property {number} replicas - Desired replicas count
 * @property {number} availableReplicas - Current healthy replicas
 * @property {string} status - 'HEALTHY' | 'WARNING' | 'CRITICAL'
 */

// Mock in-memory Clusters
const MOCK_CLUSTERS = [
  {
    id: 'k8s-acme-prod-01',
    name: 'acme-production-us-east',
    organizationId: 'org-acme-01',
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
  {
    id: 'k8s-acme-stage-01',
    name: 'acme-staging-us-east',
    organizationId: 'org-acme-01',
    organizationName: 'Acme Infrastructure Corp',
    environment: 'Staging',
    k8sVersion: 'v1.30.1',
    status: 'READY',
    nodeCount: 6,
    podCount: 48,
    agentStatus: 'ONLINE',
    agentVersion: 'v2.4.1-ebpf',
    lastSync: '30 giây trước',
  },
  {
    id: 'k8s-fintech-prod-01',
    name: 'fintech-core-prod-sg',
    organizationId: 'org-fintech-03',
    organizationName: 'Fintech Payments Group',
    environment: 'Production',
    k8sVersion: 'v1.29.4',
    status: 'READY',
    nodeCount: 24,
    podCount: 310,
    agentStatus: 'ONLINE',
    agentVersion: 'v2.4.1-ebpf',
    lastSync: '15 giây trước',
  },
  {
    id: 'k8s-retail-prod-01',
    name: 'retail-prod-hcm',
    organizationId: 'org-retail-02',
    organizationName: 'Global Retail SME Ltd',
    environment: 'Production',
    k8sVersion: 'v1.30.0',
    status: 'WARNING',
    nodeCount: 8,
    podCount: 76,
    agentStatus: 'DEGRADED',
    agentVersion: 'v2.3.8-ebpf',
    lastSync: '2 phút trước',
  },
  {
    id: 'k8s-swift-trial-01',
    name: 'swiftlog-trial-cluster',
    organizationId: 'org-logistics-04',
    organizationName: 'Vận Tải Thông Minh SwiftLog',
    environment: 'Development',
    k8sVersion: 'v1.29.2',
    status: 'READY',
    nodeCount: 3,
    podCount: 22,
    agentStatus: 'ONLINE',
    agentVersion: 'v2.4.1-ebpf',
    lastSync: '1 phút trước',
  },
  {
    id: 'k8s-medicare-edge-01',
    name: 'medicare-edge-da-nang',
    organizationId: 'org-health-05',
    organizationName: 'MediCare Cloud Systems',
    environment: 'Production',
    k8sVersion: 'v1.28.6',
    status: 'CRITICAL',
    nodeCount: 4,
    podCount: 0,
    agentStatus: 'OFFLINE',
    agentVersion: 'v2.2.0-ebpf',
    lastSync: '4 giờ trước',
  },
];

// Mock in-memory Agents
const MOCK_AGENTS = [
  {
    id: 'agent-acme-prod-node01',
    name: 'ebpf-probe-acme-prod-01',
    organizationId: 'org-acme-01',
    organizationName: 'Acme Infrastructure Corp',
    clusterId: 'k8s-acme-prod-01',
    clusterName: 'acme-production-us-east',
    version: 'v2.4.1-ebpf',
    status: 'ONLINE',
    lastHeartbeat: '5 giây trước',
    latency: '1.1ms',
  },
  {
    id: 'agent-acme-prod-node02',
    name: 'ebpf-probe-acme-prod-02',
    organizationId: 'org-acme-01',
    organizationName: 'Acme Infrastructure Corp',
    clusterId: 'k8s-acme-prod-01',
    clusterName: 'acme-production-us-east',
    version: 'v2.4.1-ebpf',
    status: 'ONLINE',
    lastHeartbeat: '6 giây trước',
    latency: '1.2ms',
  },
  {
    id: 'agent-fintech-prod-node01',
    name: 'ebpf-probe-fintech-prod-01',
    organizationId: 'org-fintech-03',
    organizationName: 'Fintech Payments Group',
    clusterId: 'k8s-fintech-prod-01',
    clusterName: 'fintech-core-prod-sg',
    version: 'v2.4.1-ebpf',
    status: 'ONLINE',
    lastHeartbeat: '4 giây trước',
    latency: '0.9ms',
  },
  {
    id: 'agent-retail-prod-node01',
    name: 'ebpf-probe-retail-prod-01',
    organizationId: 'org-retail-02',
    organizationName: 'Global Retail SME Ltd',
    clusterId: 'k8s-retail-prod-01',
    clusterName: 'retail-prod-hcm',
    version: 'v2.3.8-ebpf',
    status: 'DEGRADED',
    lastHeartbeat: '2 phút trước',
    latency: '8.4ms',
  },
  {
    id: 'agent-swift-trial-node01',
    name: 'ebpf-probe-swift-trial-01',
    organizationId: 'org-logistics-04',
    organizationName: 'Vận Tải Thông Minh SwiftLog',
    clusterId: 'k8s-swift-trial-01',
    clusterName: 'swiftlog-trial-cluster',
    version: 'v2.4.1-ebpf',
    status: 'ONLINE',
    lastHeartbeat: '12 giây trước',
    latency: '1.8ms',
  },
  {
    id: 'agent-medicare-edge-node01',
    name: 'ebpf-probe-medicare-edge-01',
    organizationId: 'org-health-05',
    organizationName: 'MediCare Cloud Systems',
    clusterId: 'k8s-medicare-edge-01',
    clusterName: 'medicare-edge-da-nang',
    version: 'v2.2.0-ebpf',
    status: 'OFFLINE',
    lastHeartbeat: '4 giờ trước',
    latency: 'N/A',
  },
];

// Mock in-memory Nodes
const MOCK_NODES = [
  {
    id: 'node-acme-prod-w01',
    name: 'ip-10-0-12-44.ec2.internal',
    clusterId: 'k8s-acme-prod-01',
    clusterName: 'acme-production-us-east',
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
  {
    id: 'node-acme-prod-w02',
    name: 'ip-10-0-12-45.ec2.internal',
    clusterId: 'k8s-acme-prod-01',
    clusterName: 'acme-production-us-east',
    organizationName: 'Acme Infrastructure Corp',
    status: 'READY',
    cpuAllocated: 18,
    cpuTotal: 32,
    cpuPercent: 56,
    memoryAllocatedGB: 64,
    memoryTotalGB: 128,
    memoryPercent: 50,
    k8sVersion: 'v1.30.2',
  },
  {
    id: 'node-fintech-prod-w01',
    name: 'fintech-k8s-worker-01.asia-southeast1',
    clusterId: 'k8s-fintech-prod-01',
    clusterName: 'fintech-core-prod-sg',
    organizationName: 'Fintech Payments Group',
    status: 'READY',
    cpuAllocated: 52,
    cpuTotal: 64,
    cpuPercent: 81,
    memoryAllocatedGB: 198,
    memoryTotalGB: 256,
    memoryPercent: 77,
    k8sVersion: 'v1.29.4',
  },
  {
    id: 'node-retail-prod-w01',
    name: 'retail-worker-vn-01.local',
    clusterId: 'k8s-retail-prod-01',
    clusterName: 'retail-prod-hcm',
    organizationName: 'Global Retail SME Ltd',
    status: 'MAINTENANCE',
    cpuAllocated: 6,
    cpuTotal: 16,
    cpuPercent: 38,
    memoryAllocatedGB: 22,
    memoryTotalGB: 64,
    memoryPercent: 34,
    k8sVersion: 'v1.30.0',
  },
  {
    id: 'node-swift-trial-w01',
    name: 'swiftlog-k8s-edge-01.cloud',
    clusterId: 'k8s-swift-trial-01',
    clusterName: 'swiftlog-trial-cluster',
    organizationName: 'Vận Tải Thông Minh SwiftLog',
    status: 'READY',
    cpuAllocated: 4,
    cpuTotal: 8,
    cpuPercent: 50,
    memoryAllocatedGB: 12,
    memoryTotalGB: 32,
    memoryPercent: 38,
    k8sVersion: 'v1.29.2',
  },
  {
    id: 'node-medicare-edge-w01',
    name: 'medicare-danang-gw01',
    clusterId: 'k8s-medicare-edge-01',
    clusterName: 'medicare-edge-da-nang',
    organizationName: 'MediCare Cloud Systems',
    status: 'NOT_READY',
    cpuAllocated: 0,
    cpuTotal: 16,
    cpuPercent: 0,
    memoryAllocatedGB: 0,
    memoryTotalGB: 64,
    memoryPercent: 0,
    k8sVersion: 'v1.28.6',
  },
];

// Mock in-memory Workloads
const MOCK_WORKLOADS = [
  {
    id: 'wl-acme-auth',
    name: 'auth-service',
    namespace: 'core-platform',
    clusterId: 'k8s-acme-prod-01',
    clusterName: 'acme-production-us-east',
    organizationName: 'Acme Infrastructure Corp',
    type: 'Deployment',
    replicas: 6,
    availableReplicas: 6,
    status: 'HEALTHY',
  },
  {
    id: 'wl-acme-billing',
    name: 'billing-processor',
    namespace: 'finance',
    clusterId: 'k8s-acme-prod-01',
    clusterName: 'acme-production-us-east',
    organizationName: 'Acme Infrastructure Corp',
    type: 'Deployment',
    replicas: 4,
    availableReplicas: 4,
    status: 'HEALTHY',
  },
  {
    id: 'wl-fintech-gw',
    name: 'payment-gateway',
    namespace: 'banking-core',
    clusterId: 'k8s-fintech-prod-01',
    clusterName: 'fintech-core-prod-sg',
    organizationName: 'Fintech Payments Group',
    type: 'Deployment',
    replicas: 12,
    availableReplicas: 12,
    status: 'HEALTHY',
  },
  {
    id: 'wl-fintech-ledger',
    name: 'ledger-kafka-broker',
    namespace: 'kafka-cluster',
    clusterId: 'k8s-fintech-prod-01',
    clusterName: 'fintech-core-prod-sg',
    organizationName: 'Fintech Payments Group',
    type: 'StatefulSet',
    replicas: 5,
    availableReplicas: 5,
    status: 'HEALTHY',
  },
  {
    id: 'wl-retail-store',
    name: 'storefront-frontend',
    namespace: 'ecommerce',
    clusterId: 'k8s-retail-prod-01',
    clusterName: 'retail-prod-hcm',
    organizationName: 'Global Retail SME Ltd',
    type: 'Deployment',
    replicas: 8,
    availableReplicas: 6,
    status: 'WARNING',
  },
  {
    id: 'wl-retail-daemon',
    name: 'vector-log-forwarder',
    namespace: 'monitoring',
    clusterId: 'k8s-retail-prod-01',
    clusterName: 'retail-prod-hcm',
    organizationName: 'Global Retail SME Ltd',
    type: 'DaemonSet',
    replicas: 8,
    availableReplicas: 8,
    status: 'HEALTHY',
  },
  {
    id: 'wl-medicare-emr',
    name: 'emr-telemedicine-api',
    namespace: 'healthcare',
    clusterId: 'k8s-medicare-edge-01',
    clusterName: 'medicare-edge-da-nang',
    organizationName: 'MediCare Cloud Systems',
    type: 'Deployment',
    replicas: 4,
    availableReplicas: 0,
    status: 'CRITICAL',
  },
];

// ==========================================
// MOCK SERVICE METHODS
// ==========================================

/**
 * Lấy các chỉ số KPI hạ tầng tổng quan trên toàn nền tảng
 * @returns {Promise<Object>}
 */
export const getInfrastructureKPIs = async () => {
  if (hasActiveAuthToken()) {
    try {
      const [realClusters, realAgentsRes] = await Promise.all([
        clusterService.getAllClusters(),
        agentService.getAllAgentsAdmin({ limit: 100 }),
      ]);
      const realAgents = realAgentsRes?.items || [];
      if (Array.isArray(realClusters) && realClusters.length > 0) {
        const totalNodes = realClusters.reduce((acc, c) => acc + Number(c.nodes_count || 0), 0);
        const totalPods = realClusters.reduce((acc, c) => acc + Number(c.pods_count || 0), 0);
        return {
          totalClusters: realClusters.length,
          readyClusters: realClusters.filter((c) => (c.agent_status || '').toUpperCase() === 'ONLINE').length,
          totalNodes,
          readyNodes: totalNodes,
          totalAgents: realAgents.length,
          onlineAgents: realAgents.filter((a) => (a.status || '').toUpperCase() === 'ONLINE').length,
          totalWorkloads: totalPods,
          healthyWorkloads: totalPods,
        };
      }
    } catch {
      // Fallback to mock KPIs
    }
  }
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        totalClusters: MOCK_CLUSTERS.length,
        readyClusters: MOCK_CLUSTERS.filter((c) => c.status === 'READY').length,
        totalNodes: MOCK_NODES.length,
        readyNodes: MOCK_NODES.filter((n) => n.status === 'READY').length,
        totalAgents: MOCK_AGENTS.length,
        onlineAgents: MOCK_AGENTS.filter((a) => a.status === 'ONLINE').length,
        totalWorkloads: MOCK_WORKLOADS.length,
        healthyWorkloads: MOCK_WORKLOADS.filter((w) => w.status === 'HEALTHY').length,
      });
    }, 60);
  });
};

/**
 * Lấy danh sách các cụm Kubernetes có hỗ trợ lọc
 * @param {Object} [filters]
 * @returns {Promise<InfrastructureCluster[]>}
 */
export const getInfrastructureClusters = async (filters = {}) => {
  let baseList = [...MOCK_CLUSTERS];
  if (hasActiveAuthToken()) {
    try {
      const realClusters = await clusterService.getAllClusters();
      if (Array.isArray(realClusters) && realClusters.length > 0) {
        baseList = realClusters.map((c) => {
          const agStatus = (c.agent_status || 'PENDING').toUpperCase();
          const envRaw = (c.environment_type || c.environment_name || 'PRODUCTION').toUpperCase();
          const environment = envRaw.includes('PROD')
            ? 'Production'
            : envRaw.includes('STAG')
            ? 'Staging'
            : 'Development';
          return {
            id: c.id,
            name: c.name || 'k8s-cluster',
            organizationId: c.organization_id || 'org-default',
            organizationName: c.organization_name || 'Tổ chức Hệ thống',
            environment,
            k8sVersion: c.kubernetes_version || 'v1.29.4',
            status: agStatus === 'ONLINE' ? 'READY' : agStatus === 'PENDING' ? 'WARNING' : 'CRITICAL',
            nodeCount: Number(c.nodes_count || 0),
            podCount: Number(c.pods_count || 0),
            agentStatus: agStatus,
            agentVersion: c.agent_name || 'eBPF Daemon',
            lastSync: c.last_heartbeat_at
              ? new Date(c.last_heartbeat_at).toLocaleString('vi-VN')
              : 'Chưa đồng bộ',
          };
        });
      }
    } catch {
      // Fallback to MOCK_CLUSTERS
    }
  }

  return new Promise((resolve) => {
    setTimeout(() => {
      let result = [...baseList];

      const query = (filters.search || filters.query || '').toLowerCase().trim();
      if (query) {
        result = result.filter(
          (c) =>
            c.name.toLowerCase().includes(query) ||
            c.organizationName.toLowerCase().includes(query) ||
            c.k8sVersion.toLowerCase().includes(query)
        );
      }

      if (filters.status && filters.status !== 'ALL') {
        result = result.filter((c) => c.status === filters.status);
      }

      if (filters.organization && filters.organization !== 'ALL') {
        result = result.filter(
          (c) => c.organizationId === filters.organization || c.organizationName === filters.organization
        );
      }

      resolve(result);
    }, 70);
  });
};

/**
 * Lấy danh sách tác tử eBPF có hỗ trợ lọc
 * @param {Object} [filters]
 * @returns {Promise<InfrastructureAgent[]>}
 */
export const getInfrastructureAgents = async (filters = {}) => {
  let baseList = [...MOCK_AGENTS];
  if (hasActiveAuthToken()) {
    try {
      const realAgentsRes = await agentService.getAllAgentsAdmin({ limit: 100 });
      if (realAgentsRes && Array.isArray(realAgentsRes.items) && realAgentsRes.items.length > 0) {
        baseList = realAgentsRes.items.map((a) => {
          const rawStatus = (a.status || 'OFFLINE').toUpperCase();
          const status =
            rawStatus === 'ONLINE'
              ? 'ONLINE'
              : rawStatus === 'PENDING' || rawStatus === 'DEGRADED'
              ? 'DEGRADED'
              : 'OFFLINE';
          return {
            id: a.id,
            name: a.name || a.agent_uid || a.id,
            organizationId: a.organization_id || 'org-default',
            organizationName: a.organization_name || 'Tổ chức Hệ thống',
            clusterId: a.cluster_id || '',
            clusterName: a.cluster_name || a.environment_name || 'k8s-cluster',
            version: a.version || 'v1.0.0-ebpf',
            status,
            lastHeartbeat: a.last_seen_at
              ? new Date(a.last_seen_at).toLocaleString('vi-VN')
              : 'Chưa kết nối',
            latency: a.last_latency_ms != null ? `${a.last_latency_ms}ms` : status === 'ONLINE' ? '1.1ms' : 'N/A',
          };
        });
      }
    } catch {
      // Fallback to MOCK_AGENTS
    }
  }

  return new Promise((resolve) => {
    setTimeout(() => {
      let result = [...baseList];

      const query = (filters.search || filters.query || '').toLowerCase().trim();
      if (query) {
        result = result.filter(
          (a) =>
            a.name.toLowerCase().includes(query) ||
            a.organizationName.toLowerCase().includes(query) ||
            a.clusterName.toLowerCase().includes(query) ||
            a.version.toLowerCase().includes(query)
        );
      }

      if (filters.status && filters.status !== 'ALL') {
        result = result.filter((a) => a.status === filters.status);
      }

      if (filters.organization && filters.organization !== 'ALL') {
        result = result.filter(
          (a) => a.organizationId === filters.organization || a.organizationName === filters.organization
        );
      }

      resolve(result);
    }, 70);
  });
};

/**
 * Lấy danh sách máy chủ Nodes có hỗ trợ lọc
 * @param {Object} [filters]
 * @returns {Promise<InfrastructureNode[]>}
 */
export const getInfrastructureNodes = (filters = {}) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      let result = [...MOCK_NODES];

      const query = (filters.search || filters.query || '').toLowerCase().trim();
      if (query) {
        result = result.filter(
          (n) =>
            n.name.toLowerCase().includes(query) ||
            n.clusterName.toLowerCase().includes(query) ||
            n.organizationName.toLowerCase().includes(query)
        );
      }

      if (filters.status && filters.status !== 'ALL') {
        result = result.filter((n) => n.status === filters.status);
      }

      if (filters.cluster && filters.cluster !== 'ALL') {
        result = result.filter((n) => n.clusterId === filters.cluster || n.clusterName === filters.cluster);
      }

      resolve(result);
    }, 70);
  });
};

/**
 * Lấy danh sách khối công việc Workloads có hỗ trợ lọc
 * @param {Object} [filters]
 * @returns {Promise<InfrastructureWorkload[]>}
 */
export const getInfrastructureWorkloads = (filters = {}) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      let result = [...MOCK_WORKLOADS];

      const query = (filters.search || filters.query || '').toLowerCase().trim();
      if (query) {
        result = result.filter(
          (w) =>
            w.name.toLowerCase().includes(query) ||
            w.namespace.toLowerCase().includes(query) ||
            w.clusterName.toLowerCase().includes(query) ||
            w.organizationName.toLowerCase().includes(query)
        );
      }

      if (filters.status && filters.status !== 'ALL') {
        result = result.filter((w) => w.status === filters.status);
      }

      if (filters.type && filters.type !== 'ALL') {
        result = result.filter((w) => w.type === filters.type);
      }

      resolve(result);
    }, 70);
  });
};

const adminInfrastructureService = {
  getInfrastructureKPIs,
  getInfrastructureClusters,
  getInfrastructureAgents,
  getInfrastructureNodes,
  getInfrastructureWorkloads,
};

export default adminInfrastructureService;
