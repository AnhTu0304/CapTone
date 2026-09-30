/**
 * @file adminOrganizationsService.js
 * Platform Admin Organizations Service Layer
 * Decoupled mock service providing typed data models for multi-tenant management.
 * Explicitly separates organization-level SME permissions from platform-level Admin permissions.
 */

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

// Mock in-memory database of organizations
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

// ==========================================
// MOCK SERVICE METHODS (All API calls decoupled)
// ==========================================

/**
 * Lấy danh sách toàn bộ các tổ chức doanh nghiệp
 * @param {Object} [filter]
 * @returns {Promise<Organization[]>}
 */
export const getOrganizations = (filter = {}) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      let result = [...MOCK_ORGANIZATIONS];

      const queryStr = (filter.search || filter.query || '').toLowerCase().trim();
      if (queryStr) {
        result = result.filter(
          (o) =>
            o.name.toLowerCase().includes(queryStr) ||
            o.slug.toLowerCase().includes(queryStr) ||
            o.contactEmail.toLowerCase().includes(queryStr)
        );
      }

      if (filter.status && filter.status !== 'ALL') {
        result = result.filter((o) => o.status === filter.status);
      }

      if (filter.plan && filter.plan !== 'ALL') {
        result = result.filter((o) => o.plan === filter.plan);
      }

      resolve(result);
    }, 80);
  });
};

/**
 * Lấy thông tin chi tiết một tổ chức theo ID
 * @param {string} id
 * @returns {Promise<Organization|null>}
 */
export const getOrganization = (id) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const org = MOCK_ORGANIZATIONS.find((o) => o.id === id);
      resolve(org || null);
    }, 60);
  });
};

/**
 * Lấy danh sách thành viên nội bộ của tổ chức (Quyền SME)
 * @param {string} id
 * @returns {Promise<OrganizationMember[]>}
 */
export const getOrganizationMembers = (id) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(MOCK_MEMBERS[id] || MOCK_MEMBERS['org-acme-01']);
    }, 60);
  });
};

/**
 * Lấy danh sách các môi trường của tổ chức
 * @param {string} id
 * @returns {Promise<OrganizationEnvironment[]>}
 */
export const getOrganizationEnvironments = (id) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(MOCK_ENVIRONMENTS[id] || MOCK_ENVIRONMENTS['org-acme-01']);
    }, 60);
  });
};

/**
 * Lấy danh sách cụm Kubernetes thuộc tổ chức
 * @param {string} id
 * @returns {Promise<OrganizationCluster[]>}
 */
export const getOrganizationClusters = (id) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(MOCK_CLUSTERS[id] || MOCK_CLUSTERS['org-acme-01']);
    }, 60);
  });
};

/**
 * Lấy danh sách tác tử eBPF đang chạy trên cụm của tổ chức
 * @param {string} id
 * @returns {Promise<OrganizationAgent[]>}
 */
export const getOrganizationAgents = (id) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(MOCK_AGENTS[id] || MOCK_AGENTS['org-acme-01']);
    }, 60);
  });
};

/**
 * Lấy danh sách sự cố của tổ chức
 * @param {string} id
 * @returns {Promise<OrganizationIncident[]>}
 */
export const getOrganizationIncidents = (id) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(MOCK_INCIDENTS[id] || MOCK_INCIDENTS['org-acme-01']);
    }, 60);
  });
};

/**
 * Lấy nhật ký thao tác của Platform Admin trên tổ chức này
 * @param {string} id
 * @returns {Promise<OrganizationAuditItem[]>}
 */
export const getOrganizationAuditActivity = (id) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(MOCK_AUDIT_ACTIVITY[id] || MOCK_AUDIT_ACTIVITY['org-acme-01']);
    }, 60);
  });
};

const adminOrganizationsService = {
  getOrganizations,
  getOrganization,
  getOrganizationMembers,
  getOrganizationEnvironments,
  getOrganizationClusters,
  getOrganizationAgents,
  getOrganizationIncidents,
  getOrganizationAuditActivity,
};

export default adminOrganizationsService;
