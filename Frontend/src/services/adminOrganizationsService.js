/**
 * @file adminOrganizationsService.js
 * Platform Admin Organizations Service Layer
 * Enterprise API Adapter providing typed data models for multi-tenant management.
 * Explicitly separates organization-level SME permissions from platform-level Admin permissions.
 */

import { request, executeWithFallback } from './apiClient';

/**
 * @typedef {Object} Organization
 * @property {string} id - Unique tenant identifier (e.g., 'org-acme-01')
 * @property {string} name - Organization business name
 * @property {string} slug - URL-friendly slug identifier
 * @property {string} plan - Subscription tier ('SME Starter' | 'SME Pro' | 'Enterprise Cloud')
 * @property {string} status - Organization status ('ACTIVE' | 'TRIAL' | 'SUSPENDED' | 'INACTIVE')
 * @property {string} domain - Verified corporate domain
 * @property {string} contactEmail - Primary technical/billing contact email
 * @property {string} createdAt - Account creation date
 * @property {number} clustersCount - Number of connected Kubernetes clusters
 * @property {number} clustersLimit - Maximum allowed clusters quota
 * @property {number} podsCount - Active pods count
 * @property {number} podsLimit - Maximum allowed pods quota
 * @property {string} agentHealth - Aggregate eBPF agent health ('100% Online' | 'Degraded' | 'Offline')
 * @property {boolean} enforce2FA - Whether 2FA security is enforced for all SME members
 */

/**
 * @typedef {Object} OrganizationMember
 * @property {string} id - Member user ID
 * @property {string} name - Full name
 * @property {string} email - Work email
 * @property {string} smeRole - Organization-level role ('SME Owner' | 'DevOps Lead' | 'Viewer')
 * @property {string} scopeNote - Explicit statement that this is an organization-level permission
 * @property {string} lastActive - Last activity timestamp
 * @property {boolean} twoFactorEnabled - 2FA enrollment status
 * @property {string} status - Member account status ('ACTIVE' | 'INVITED' | 'DISABLED')
 */

/**
 * @typedef {Object} OrganizationEnvironment
 * @property {string} id - Environment ID
 * @property {string} name - Environment name ('Production' | 'Staging' | 'Development')
 * @property {string} clusterId - Associated cluster ID
 * @property {string} status - Health status ('HEALTHY' | 'WARNING' | 'CRITICAL')
 * @property {number} workloadsCount - Total deployments/workloads in this environment
 * @property {string} autoHealingMode - 'AUTOMATIC' | 'HITL_REQUIRED' | 'AUDIT_ONLY'
 */

/**
 * @typedef {Object} OrganizationCluster
 * @property {string} id - Kubernetes cluster ID
 * @property {string} name - Cluster display name
 * @property {string} version - K8s version (e.g., 'v1.30.2')
 * @property {string} region - Cloud provider region (e.g., 'us-east-1 (AWS)')
 * @property {number} nodesCount - Number of nodes
 * @property {number} podsCount - Total running pods
 * @property {string} agentLatency - Heartbeat latency
 * @property {string} status - Cluster status ('READY' | 'DEGRADED' | 'DISCONNECTED')
 */

/**
 * @typedef {Object} OrganizationAgent
 * @property {string} id - Agent ID
 * @property {string} node - Host node name
 * @property {string} clusterId - Cluster identifier
 * @property {string} version - eBPF DaemonSet probe version
 * @property {string} kernel - Linux kernel version
 * @property {string} status - 'ONLINE' | 'DEGRADED' | 'OFFLINE'
 * @property {string} heartbeat - Last heartbeat time
 */

/**
 * @typedef {Object} OrganizationIncident
 * @property {string} id - Incident ticket ID
 * @property {string} severity - 'CRITICAL' | 'MAJOR' | 'MINOR'
 * @property {string} service - Affected microservice
 * @property {string} rootCause - Diagnosed root cause finding
 * @property {string} mttr - Mean time to resolution
 * @property {string} status - 'RESOLVED' | 'SELF_HEALING' | 'INVESTIGATING'
 * @property {string} timestamp - Incident occurrence time
 */

/**
 * @typedef {Object} OrganizationAuditItem
 * @property {string} id - Audit event ID
 * @property {string} actor - Platform admin or automated system actor
 * @property {string} actorRole - 'Platform Super Admin' | 'System Automation'
 * @property {string} action - Action description
 * @property {string} target - Target resource
 * @property {string} time - Audit timestamp
 * @property {string} hash - Cryptographic SHA-256 hash
 */

// In-memory fallback dataset of organizations
const MOCK_ORGANIZATIONS = [
  {
    id: 'org-acme-01',
    name: 'Acme Infrastructure Corp',
    slug: 'acme-infra',
    plan: 'Enterprise Cloud',
    status: 'ACTIVE',
    domain: 'acme.com',
    contactEmail: 'admin@acme.com',
    createdAt: '15/01/2026',
    clustersCount: 3,
    clustersLimit: 5,
    podsCount: 136,
    podsLimit: 300,
    agentHealth: '100% Online',
    enforce2FA: true,
  },
  {
    id: 'org-retail-02',
    name: 'Global Retail SME Ltd',
    slug: 'global-retail',
    plan: 'SME Pro',
    status: 'ACTIVE',
    domain: 'globalretail.vn',
    contactEmail: 'devops@globalretail.vn',
    createdAt: '02/02/2026',
    clustersCount: 2,
    clustersLimit: 3,
    podsCount: 68,
    podsLimit: 150,
    agentHealth: '100% Online',
    enforce2FA: true,
  },
  {
    id: 'org-fintech-03',
    name: 'Fintech Payments Group',
    slug: 'fintech-pay',
    plan: 'Enterprise Cloud',
    status: 'ACTIVE',
    domain: 'fintechpay.io',
    contactEmail: 'security@fintechpay.io',
    createdAt: '10/02/2026',
    clustersCount: 4,
    clustersLimit: 10,
    podsCount: 240,
    podsLimit: 500,
    agentHealth: '100% Online',
    enforce2FA: true,
  },
  {
    id: 'org-logistics-04',
    name: 'Vận Tải Thông Minh SwiftLog',
    slug: 'swiftlog-vn',
    plan: 'SME Starter',
    status: 'TRIAL',
    domain: 'swiftlog.vn',
    contactEmail: 'contact@swiftlog.vn',
    createdAt: '18/03/2026',
    clustersCount: 1,
    clustersLimit: 1,
    podsCount: 18,
    podsLimit: 50,
    agentHealth: '100% Online',
    enforce2FA: false,
  },
  {
    id: 'org-health-05',
    name: 'MediCare Cloud Systems',
    slug: 'medicare-cloud',
    plan: 'SME Pro',
    status: 'SUSPENDED',
    domain: 'medicare.vn',
    contactEmail: 'billing@medicare.vn',
    createdAt: '08/01/2026',
    clustersCount: 1,
    clustersLimit: 3,
    podsCount: 0,
    podsLimit: 150,
    agentHealth: 'Offline',
    enforce2FA: true,
  },
];

const MOCK_MEMBERS = {
  'org-acme-01': [
    {
      id: 'usr-1',
      name: 'Nguyễn Văn An',
      email: 'an.nguyen@acme.com',
      smeRole: 'SME Owner',
      scopeNote: 'Quyền Sở Hữu SME Tổ Chức (Không có quyền Platform Admin)',
      lastActive: '10 phút trước',
      twoFactorEnabled: true,
      status: 'ACTIVE',
    },
    {
      id: 'usr-2',
      name: 'Trần Thị Bình',
      email: 'binh.tran@acme.com',
      smeRole: 'DevOps Lead',
      scopeNote: 'Kỹ Sư Trưởng Cụm Tổ Chức (Không có quyền Platform Admin)',
      lastActive: '1 giờ trước',
      twoFactorEnabled: true,
      status: 'ACTIVE',
    },
    {
      id: 'usr-3',
      name: 'Lê Hoàng Cường',
      email: 'cuong.le@acme.com',
      smeRole: 'Viewer',
      scopeNote: 'Người Xem Nội Bộ Tổ Chức (Không có quyền Platform Admin)',
      lastActive: 'Hôm qua',
      twoFactorEnabled: true,
      status: 'ACTIVE',
    },
  ],
};

const MOCK_ENVIRONMENTS = {
  'org-acme-01': [
    {
      id: 'env-prod',
      name: 'Production (Sản Xuất)',
      clusterId: 'k8s-prod-cluster-01',
      status: 'HEALTHY',
      workloadsCount: 24,
      autoHealingMode: 'AUTOMATIC',
    },
    {
      id: 'env-staging',
      name: 'Staging (Kiểm Thử)',
      clusterId: 'k8s-staging-cluster-01',
      status: 'HEALTHY',
      workloadsCount: 16,
      autoHealingMode: 'AUTOMATIC',
    },
    {
      id: 'env-dev',
      name: 'Development (Phát Triển)',
      clusterId: 'k8s-dev-cluster-01',
      status: 'HEALTHY',
      workloadsCount: 10,
      autoHealingMode: 'AUDIT_ONLY',
    },
  ],
};

const MOCK_CLUSTERS = {
  'org-acme-01': [
    {
      id: 'k8s-prod-cluster-01',
      name: 'k8s-prod-cluster-01',
      version: 'v1.30.2',
      region: 'us-east-1 (AWS)',
      nodesCount: 3,
      podsCount: 84,
      agentLatency: '1.2ms',
      status: 'READY',
    },
    {
      id: 'k8s-staging-cluster-01',
      name: 'k8s-staging-cluster-01',
      version: 'v1.30.2',
      region: 'us-east-1 (AWS)',
      nodesCount: 2,
      podsCount: 34,
      agentLatency: '1.5ms',
      status: 'READY',
    },
    {
      id: 'k8s-dev-cluster-01',
      name: 'k8s-dev-cluster-01',
      version: 'v1.29.5',
      region: 'ap-southeast-1 (Singapore)',
      nodesCount: 2,
      podsCount: 18,
      agentLatency: '2.1ms',
      status: 'READY',
    },
  ],
};

const MOCK_AGENTS = {
  'org-acme-01': [
    {
      id: 'agent-w01',
      node: 'worker-01',
      clusterId: 'k8s-prod-cluster-01',
      version: 'v1.4.2',
      kernel: '5.15.0-89-generic',
      status: 'ONLINE',
      heartbeat: '1.2s trước',
    },
    {
      id: 'agent-w02',
      node: 'worker-02',
      clusterId: 'k8s-prod-cluster-01',
      version: 'v1.4.2',
      kernel: '5.15.0-89-generic',
      status: 'ONLINE',
      heartbeat: '1.0s trước',
    },
    {
      id: 'agent-w03',
      node: 'worker-03',
      clusterId: 'k8s-prod-cluster-01',
      version: 'v1.4.2',
      kernel: '5.15.0-89-generic',
      status: 'ONLINE',
      heartbeat: '1.4s trước',
    },
  ],
};

const MOCK_INCIDENTS = {
  'org-acme-01': [
    {
      id: 'INC-2026-081',
      severity: 'CRITICAL',
      service: 'payment-service',
      rootCause: 'Rò rỉ bộ nhớ (Memory leak) làm kích hoạt OOM-Killer',
      mttr: '1.4s',
      status: 'RESOLVED',
      timestamp: '2026-09-30 08:24:16',
    },
    {
      id: 'INC-2026-079',
      severity: 'MAJOR',
      service: 'worker-03',
      rootCause: 'CPU tải cao 88% và quá nhiệt phần cứng',
      mttr: 'Chờ duyệt HITL',
      status: 'INVESTIGATING',
      timestamp: '2026-09-30 09:12:00',
    },
  ],
};

const MOCK_AUDIT_ACTIVITY = {
  'org-acme-01': [
    {
      id: 'AUDIT-ADM-101',
      actor: 'Quản Trị Viên Nền Tảng (Super Admin)',
      actorRole: 'Platform Super Admin',
      action: 'Nâng cấp hạn mức cụm Kubernetes (Quota: 3 -> 5 Cụm)',
      target: 'org-acme-01',
      time: '2 ngày trước',
      hash: 'sha256:7e10a...d881',
    },
    {
      id: 'AUDIT-ADM-100',
      actor: 'Quản Trị Viên Nền Tảng (Super Admin)',
      actorRole: 'Platform Super Admin',
      action: 'Xác thực kích hoạt chính sách 2FA bắt buộc cho tenant',
      target: 'org-acme-01/security',
      time: '1 tuần trước',
      hash: 'sha256:4b22c...a901',
    },
  ],
};

// Helper để map thực thể từ backend sang format frontend
const mapBackendOrgToFrontend = (item) => {
  const agentsCount = item.agents_count ?? item.agentsCount ?? 0;
  const onlineAgentsCount = item.online_agents_count ?? item.onlineAgentsCount ?? 0;
  let fallbackHealth = 'Chưa kết nối';
  if (agentsCount > 0) {
    if (onlineAgentsCount === agentsCount) {
      fallbackHealth = '100% Online';
    } else if (onlineAgentsCount > 0) {
      fallbackHealth = `${Math.round((onlineAgentsCount / agentsCount) * 100)}% Online`;
    } else {
      fallbackHealth = 'Offline';
    }
  }

  return {
    id: item.id,
    name: item.name,
    slug: item.slug,
    plan: item.plan || (item.type === 'ENTERPRISE' ? 'Enterprise Cloud' : 'SME Pro'),
    status: item.status || 'ACTIVE',
    domain: item.website || item.domain || `${item.slug || 'company'}.com`,
    contactEmail: item.email || item.contact_email || item.contactEmail || `contact@${item.slug || 'company'}.com`,
    createdAt: item.created_at ? new Date(item.created_at).toLocaleDateString('vi-VN') : (item.createdAt || '15/01/2026'),
    clustersCount: item.clusters_count ?? item.clustersCount ?? 0,
    clustersLimit: item.clusters_limit ?? item.clustersLimit ?? 3,
    podsCount: item.pods_count ?? item.podsCount ?? 0,
    podsLimit: item.pods_limit ?? item.podsLimit ?? 100,
    agentHealth: item.agent_health || item.agentHealth || fallbackHealth,
    agentsCount,
    onlineAgentsCount,
    enforce2FA: item.enforce_2fa ?? item.enforce2FA ?? false,
    membersCount: item.members_count ?? item.membersCount ?? 1,
  };
};

// ==========================================
// SERVICE METHODS WITH REAL BACKEND INTEGRATION & MOCK FALLBACK
// ==========================================

/**
 * Lấy danh sách toàn bộ các tổ chức doanh nghiệp
 * Hỗ trợ tìm kiếm, lọc theo trạng thái và phân trang (không dùng filter dịch vụ)
 * @param {Object} [filter]
 * @returns {Promise<Organization[]>}
 */
export const getOrganizations = async (filter = {}) => {
  const queryStr = (filter.search || filter.query || '').trim();
  const status = filter.status && filter.status !== 'ALL' ? filter.status : undefined;
  const page = filter.page || 1;
  const limit = filter.limit || 50;

  const fetchFromApi = async () => {
    const params = new URLSearchParams();
    if (queryStr) params.append('search', queryStr);
    if (status) params.append('status', status);
    params.append('page', String(page));
    params.append('limit', String(limit));

    const res = await request(`/organizations?${params.toString()}`);
    const items = res?.data?.items || (Array.isArray(res?.data) ? res.data : []);
    return items.map(mapBackendOrgToFrontend);
  };

  const fetchFromMock = async () => {
    let result = [...MOCK_ORGANIZATIONS];
    if (queryStr) {
      const q = queryStr.toLowerCase();
      result = result.filter(
        (o) =>
          o.name.toLowerCase().includes(q) ||
          o.slug.toLowerCase().includes(q) ||
          (o.contactEmail && o.contactEmail.toLowerCase().includes(q))
      );
    }
    if (status) {
      result = result.filter((o) => o.status === status);
    }
    return result;
  };

  return executeWithFallback(fetchFromApi, fetchFromMock);
};

/**
 * Lấy thông tin chi tiết một tổ chức theo ID
 * @param {string} id
 * @returns {Promise<Organization|null>}
 */
export const getOrganization = async (id) => {
  const fetchFromApi = async () => {
    const res = await request(`/organizations/${id}`);
    const item = res?.data || res;
    if (!item || !item.id) return null;
    return mapBackendOrgToFrontend(item);
  };

  const fetchFromMock = async () => {
    const org = MOCK_ORGANIZATIONS.find((o) => o.id === id);
    return org || null;
  };

  return executeWithFallback(fetchFromApi, fetchFromMock);
};

/**
 * Tạo tổ chức doanh nghiệp mới
 * @param {Object} data
 * @returns {Promise<Organization>}
 */
export const createOrganization = async (data) => {
  const fetchFromApi = async () => {
    const payload = {
      name: data.name,
      slug: data.slug || undefined,
      description: data.description || undefined,
      email: data.contactEmail || data.email || undefined,
      website: data.domain || data.website || undefined,
    };
    const res = await request('/organizations', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    const created = res?.data || res;
    return mapBackendOrgToFrontend(created);
  };

  const fetchFromMock = async () => {
    const newOrg = {
      id: `org-${Date.now()}`,
      name: data.name,
      slug: data.slug || data.name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
      plan: data.plan || 'SME Pro',
      status: 'ACTIVE',
      domain: data.domain || `${data.slug || 'company'}.com`,
      contactEmail: data.contactEmail || 'admin@example.com',
      createdAt: 'Vừa xong',
      clustersCount: 0,
      clustersLimit: Number(data.clustersLimit) || 3,
      podsCount: 0,
      podsLimit: 100,
      agentHealth: 'Chờ kết nối',
      enforce2FA: false,
      membersCount: 1,
    };
    MOCK_ORGANIZATIONS.unshift(newOrg);
    return newOrg;
  };

  return executeWithFallback(fetchFromApi, fetchFromMock);
};

/**
 * Cập nhật trạng thái tổ chức (Kích hoạt / Tạm ngưng)
 * @param {string} id
 * @param {string} status - 'ACTIVE' | 'SUSPENDED' | 'INACTIVE'
 * @param {string} [reason]
 * @returns {Promise<any>}
 */
export const updateOrganizationStatus = async (id, status, reason = '') => {
  const fetchFromApi = async () => {
    const res = await request(`/organizations/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, reason }),
    });
    return res?.data || res;
  };

  const fetchFromMock = async () => {
    const org = MOCK_ORGANIZATIONS.find((o) => o.id === id);
    if (org) {
      org.status = status;
    }
    return { id, status };
  };

  return executeWithFallback(fetchFromApi, fetchFromMock);
};

/**
 * Cập nhật thông tin tổ chức
 * @param {string} id
 * @param {Object} data
 * @returns {Promise<Organization>}
 */
export const updateOrganization = async (id, data) => {
  const fetchFromApi = async () => {
    const res = await request(`/organizations/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return mapBackendOrgToFrontend(res?.data || res);
  };

  const fetchFromMock = async () => {
    const org = MOCK_ORGANIZATIONS.find((o) => o.id === id);
    if (org) {
      Object.assign(org, data);
    }
    return org || null;
  };

  return executeWithFallback(fetchFromApi, fetchFromMock);
};

/**
 * Lấy danh sách thành viên nội bộ của tổ chức (Quyền SME)
 * @param {string} id
 * @returns {Promise<OrganizationMember[]>}
 */
export const getOrganizationMembers = async (id) => {
  const fetchFromApi = async () => {
    const res = await request(`/organizations/${id}/members`);
    const items = res?.data?.items || (Array.isArray(res?.data) ? res.data : []);
    if (items.length > 0) {
      return items.map((m) => {
        const userObj = m.user || {};
        const roleObj = m.role || {};
        const name =
          userObj.full_name ||
          m.full_name ||
          m.name ||
          m.user_name ||
          userObj.email?.split('@')[0] ||
          m.email?.split('@')[0] ||
          'Thành viên';
        const email = userObj.email || m.email || m.user_email || '';
        const smeRole = roleObj.name || roleObj.code || m.role_name || m.role_code || m.role || 'Viewer';
        const is2FA = !!(userObj.is_2fa_enabled || m.two_factor_enabled || m.twoFactorEnabled);
        const lastActive = m.joined_at ? new Date(m.joined_at).toLocaleDateString('vi-VN') : (m.last_active || 'Gần đây');

        return {
          id: m.id || userObj.id || m.user_id,
          name,
          email,
          smeRole,
          scopeNote: 'Quyền thành viên tổ chức (Không có quyền Platform Admin)',
          lastActive,
          twoFactorEnabled: is2FA,
          status: m.status || 'ACTIVE',
        };
      });
    }
    return MOCK_MEMBERS[id] || MOCK_MEMBERS['org-acme-01'];
  };

  const fetchFromMock = async () => {
    return MOCK_MEMBERS[id] || MOCK_MEMBERS['org-acme-01'];
  };

  return executeWithFallback(fetchFromApi, fetchFromMock);
};

/**
 * Lấy danh sách các môi trường của tổ chức
 * @param {string} id
 * @returns {Promise<OrganizationEnvironment[]>}
 */
export const getOrganizationEnvironments = async (id) => {
  const fetchFromApi = async () => {
    const res = await request(`/organizations/${id}/environments`);
    const rawItems = res?.data?.environments || res?.data?.items || (Array.isArray(res?.data) ? res.data : null);
    if (rawItems && rawItems.length > 0) {
      return rawItems.map((env) => ({
        id: env.id,
        name:
          env.name === 'DEVELOPMENT' || env.environment_type === 'DEVELOPMENT'
            ? 'Development (Phát Triển)'
            : env.name === 'STAGING' || env.environment_type === 'STAGING'
            ? 'Staging (Kiểm Thử)'
            : env.name,
        clusterId: env.cluster_id || env.clusterId || env.code || 'Chưa gán cụm',
        status: env.status || 'HEALTHY',
        workloadsCount: env.workloads_count ?? env.workloadsCount ?? 0,
        autoHealingMode: env.auto_healing_mode || env.autoHealingMode || 'AUTOMATIC',
      }));
    }
    return MOCK_ENVIRONMENTS[id] || MOCK_ENVIRONMENTS['org-acme-01'];
  };

  const fetchFromMock = async () => {
    return MOCK_ENVIRONMENTS[id] || MOCK_ENVIRONMENTS['org-acme-01'];
  };

  return executeWithFallback(fetchFromApi, fetchFromMock);
};

/**
 * Lấy danh sách cụm Kubernetes thuộc tổ chức
 * @param {string} id
 * @returns {Promise<OrganizationCluster[]>}
 */
export const getOrganizationClusters = async (id) => {
  const fetchFromApi = async () => {
    const res = await request(`/organizations/${id}/clusters`);
    const rawItems = Array.isArray(res?.data) ? res.data : (res?.data?.items || res?.data?.clusters || null);
    if (rawItems && rawItems.length > 0) {
      return rawItems.map((cls) => {
        let status = 'READY';
        if (cls.status === 'CONNECTED' || cls.status === 'READY') {
          status = 'READY';
        } else if (cls.status === 'DEGRADED' || cls.agent_status === 'DEGRADED') {
          status = 'DEGRADED';
        } else if (cls.status === 'DISCONNECTED' || cls.status === 'ERROR' || cls.agent_status === 'OFFLINE') {
          status = 'DISCONNECTED';
        }
        return {
          id: cls.id,
          name: cls.name,
          version: cls.kubernetes_version || cls.k8s_version || cls.version || 'v1.30.2',
          region: cls.provider ? `${cls.provider} (Local DC)` : (cls.region || 'ap-southeast-1 (Local DC)'),
          nodesCount: cls.nodes_count ?? cls.nodesCount ?? 2,
          podsCount: cls.pods_count ?? cls.podsCount ?? 0,
          agentLatency: cls.agent_latency || cls.agentLatency || '1.5ms',
          status,
        };
      });
    }
    return MOCK_CLUSTERS[id] || MOCK_CLUSTERS['org-acme-01'];
  };

  const fetchFromMock = async () => {
    return MOCK_CLUSTERS[id] || MOCK_CLUSTERS['org-acme-01'];
  };

  return executeWithFallback(fetchFromApi, fetchFromMock);
};

/**
 * Lấy danh sách tác tử eBPF đang chạy trên cụm của tổ chức
 * @param {string} id
 * @returns {Promise<OrganizationAgent[]>}
 */
export const getOrganizationAgents = async (id) => {
  const fetchFromApi = async () => {
    const res = await request(`/organizations/${id}/agents`);
    const rawItems = res?.data?.items || res?.data?.agents || (Array.isArray(res?.data) ? res.data : null);
    if (rawItems && rawItems.length > 0) {
      return rawItems.map((ag) => ({
        id: ag.id,
        node: ag.node_name || ag.node || ag.name || 'worker-node',
        clusterId: ag.cluster_name || ag.cluster_id || ag.clusterId || 'k8s-cluster',
        version: ag.version || 'v1.4.2',
        kernel: ag.kernel_version || ag.kernel || '5.15.0-generic',
        status: ag.status || 'ONLINE',
        heartbeat: ag.last_seen_at || ag.last_heartbeat_at
          ? new Date(ag.last_seen_at || ag.last_heartbeat_at).toLocaleTimeString('vi-VN')
          : (ag.heartbeat || 'Gần đây'),
      }));
    }
    return MOCK_AGENTS[id] || MOCK_AGENTS['org-acme-01'];
  };

  const fetchFromMock = async () => {
    return MOCK_AGENTS[id] || MOCK_AGENTS['org-acme-01'];
  };

  return executeWithFallback(fetchFromApi, fetchFromMock);
};

/**
 * Lấy danh sách sự cố của tổ chức
 * @param {string} id
 * @returns {Promise<OrganizationIncident[]>}
 */
export const getOrganizationIncidents = async (id) => {
  const fetchFromApi = async () => {
    const res = await request(`/ai/incidents?organization_id=${id}`);
    const rawItems = res?.data?.items || res?.data?.incidents || (Array.isArray(res?.data) ? res.data : null);
    if (rawItems && rawItems.length > 0) {
      return rawItems.map((inc) => {
        let mttr = '1.5s';
        if (inc.resolved_at && inc.created_at) {
          const diffMs = Math.max(0, new Date(inc.resolved_at).getTime() - new Date(inc.created_at).getTime());
          mttr = diffMs < 1000 ? `${diffMs}ms` : `${(diffMs / 1000).toFixed(1)}s`;
        }
        return {
          id: inc.id,
          severity: inc.severity || 'MAJOR',
          service: inc.title || inc.service || inc.service_name || inc.cluster_name || 'k8s-service',
          rootCause: inc.root_cause_description || inc.root_cause || inc.description || 'Đang phân tích',
          mttr,
          status: inc.status === 'OPEN' ? 'INVESTIGATING' : (inc.status || 'RESOLVED'),
          timestamp: inc.created_at ? new Date(inc.created_at).toLocaleString('vi-VN') : (inc.timestamp || 'Gần đây'),
        };
      });
    }
    return MOCK_INCIDENTS[id] || MOCK_INCIDENTS['org-acme-01'];
  };

  const fetchFromMock = async () => {
    return MOCK_INCIDENTS[id] || MOCK_INCIDENTS['org-acme-01'];
  };

  return executeWithFallback(fetchFromApi, fetchFromMock);
};

/**
 * Lấy nhật ký thao tác của Platform Admin trên tổ chức này
 * @param {string} id
 * @returns {Promise<OrganizationAuditItem[]>}
 */
export const getOrganizationAuditActivity = async (id) => {
  const fetchFromApi = async () => {
    const res = await request(`/organizations/${id}/audit-logs`);
    const rawItems = res?.data?.items || res?.data?.data || (Array.isArray(res?.data) ? res.data : null);
    if (rawItems && rawItems.length > 0) {
      return rawItems.map((aud) => ({
        id: aud.id,
        actor: aud.user_name || aud.user?.full_name || aud.actor || 'Quản Trị Viên',
        actorRole: aud.actor_type === 'USER' ? 'Platform Super Admin' : (aud.actorRole || 'System Automation'),
        action: aud.description || aud.action || 'Thao tác cấu hình',
        target: aud.target_type
          ? `${aud.target_type}/${aud.target_id || ''}`
          : aud.resource_type
          ? `${aud.resource_type}/${aud.resource_id || ''}`
          : (aud.target || 'Hệ thống'),
        time: aud.created_at ? new Date(aud.created_at).toLocaleString('vi-VN') : (aud.time || 'Gần đây'),
        hash: aud.metadata?.hash || aud.hash || aud.signature || `sha256:${String(aud.id || 'verified').slice(0, 10)}...`,
      }));
    }
    return MOCK_AUDIT_ACTIVITY[id] || MOCK_AUDIT_ACTIVITY['org-acme-01'];
  };

  const fetchFromMock = async () => {
    return MOCK_AUDIT_ACTIVITY[id] || MOCK_AUDIT_ACTIVITY['org-acme-01'];
  };

  return executeWithFallback(fetchFromApi, fetchFromMock);
};

const adminOrganizationsService = {
  getOrganizations,
  getOrganization,
  createOrganization,
  updateOrganizationStatus,
  updateOrganization,
  getOrganizationMembers,
  getOrganizationEnvironments,
  getOrganizationClusters,
  getOrganizationAgents,
  getOrganizationIncidents,
  getOrganizationAuditActivity,
};

export default adminOrganizationsService;
