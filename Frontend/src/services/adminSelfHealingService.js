/**
 * @file adminSelfHealingService.js
 * @description Tầng dịch vụ dữ liệu chuyên dụng cho Phân hệ Quản Trị Tự Phục Hồi Nền Tảng (Platform Admin Self-Healing)
 * Quản lý các hành động tự phục hồi, danh mục loại hành động, cấu hình chính sách và phân tích số liệu.
 * Tuân thủ nguyên tắc an toàn: Không bypass quy trình phê duyệt và không thực thi trực tiếp lệnh K8s thô.
 */

/**
 * @typedef {Object} HealingAction
 * @property {string} id - Mã hành động tự phục hồi (ví dụ: 'ACT-2026-901')
 * @property {string} actionType - Loại hành động (ví dụ: 'K8s Resource Limit Patch (RAM)')
 * @property {string} target - Tài nguyên Kubernetes đích (ví dụ: 'Deployment/order-processor')
 * @property {string} organization - Tên tổ chức khách hàng
 * @property {string} organizationId - Mã định danh tổ chức
 * @property {string} environment - Môi trường ('Production' | 'Staging' | 'Development')
 * @property {'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'} riskLevel - Mức độ rủi ro
 * @property {'AUTONOMOUS' | 'HITL_GATE' | 'MANUAL'} executionMode - Chế độ thực thi
 * @property {'APPROVED' | 'AWAITING_APPROVAL' | 'REJECTED' | 'PRE_APPROVED_BY_POLICY'} approvalStatus - Trạng thái phê duyệt
 * @property {'SUCCEEDED' | 'EXECUTING' | 'FAILED' | 'ROLLED_BACK'} executionStatus - Trạng thái thực thi
 * @property {string} requestedBy - Thực thể yêu cầu (ví dụ: 'MAPE-K Planner v2.4')
 * @property {string} executedBy - Thực thể thực thi (ví dụ: 'K8s Self-Healing Controller v1.4')
 * @property {string} requestedTime - Thời gian ghi nhận yêu cầu
 * @property {string} startedTime - Thời gian bắt đầu thực thi
 * @property {string} completedTime - Thời gian hoàn tất
 * @property {string} result - Tóm tắt kết quả đo lường sau phục hồi
 * @property {string} auditHash - Chữ ký băm mật mã SHA-256 lưu sổ cái kiểm toán
 * @property {string} [incidentId] - Mã sự cố liên kết (nếu có)
 */

/**
 * @typedef {Object} SelfHealingPolicy
 * @property {string} id - Mã chính sách (ví dụ: 'POL-001')
 * @property {string} name - Tên chính sách
 * @property {string} triggerType - Loại tín hiệu kích hoạt (ví dụ: 'Kernel eBPF Probe', 'Metric Threshold')
 * @property {'Non-Destructive' | 'State-Preserving' | 'Disruptive'} riskType - Phân loại rủi ro
 * @property {'Fully Autonomous' | 'HITL Approval Required' | 'Dry-Run Only'} executionMode - Chế độ thực thi
 * @property {number} confidenceThreshold - Ngưỡng độ tin cậy AI tối thiểu để tự trị (%)
 * @property {string} cooldown - Thời gian hạ nhiệt ngăn flapping
 * @property {number} maxRetries - Số lần thử lại tối đa
 * @property {string} approvalRequirement - Quy định thẩm quyền phê duyệt
 * @property {boolean} activeStatus - Trạng thái kích hoạt (Bật/Tắt)
 * @property {string} description - Mô tả mục đích chính sách
 */

/**
 * @typedef {Object} ActionTypeDefinition
 * @property {string} id - Mã loại hành động
 * @property {string} name - Tên chuẩn hóa loại hành động
 * @property {string} category - Danh mục phân loại
 * @property {'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'} defaultRiskLevel - Mức độ rủi ro mặc định
 * @property {string} targetResourceType - Loại tài nguyên Kubernetes tác động
 * @property {boolean} defaultApprovalRequired - Yêu cầu phê duyệt theo mặc định
 * @property {boolean} supportsRollback - Hỗ trợ hoàn nguyên tự động
 * @property {string} description - Mô tả kỹ thuật hành động
 */

/**
 * @typedef {Object} SelfHealingAnalyticsData
 * @property {number} totalActions - Tổng số hành động đã thực hiện
 * @property {string} successRate - Tỷ lệ thành công (%)
 * @property {number} failedActions - Số hành động thất bại
 * @property {string} averageRecoveryTime - Thời gian phục hồi trung bình (MTTR)
 * @property {number} retryCount - Tổng số lần thử lại
 * @property {Array<{type: string, count: number, percentage: number}>} actionTypeDistribution - Phân bổ theo loại hành động
 */

// ==========================================
// DỮ LIỆU GIẢ LẬP TRONG BỘ NHỚ (MOCK DB)
// ==========================================

const MOCK_HEALING_ACTIONS = [
  {
    id: 'ACT-2026-901',
    actionType: 'K8s Resource Limit Patch (RAM)',
    target: 'Deployment/order-processor (namespace: default)',
    organization: 'Acme Infrastructure Corp',
    organizationId: 'org-acme-01',
    environment: 'Production',
    riskLevel: 'LOW',
    executionMode: 'AUTONOMOUS',
    approvalStatus: 'PRE_APPROVED_BY_POLICY',
    executionStatus: 'SUCCEEDED',
    requestedBy: 'MAPE-K Autonomous Planner v2.4',
    executedBy: 'K8s Self-Healing Controller v1.4',
    requestedTime: '30/09/2026 14:15:42',
    startedTime: '30/09/2026 14:16:15',
    completedTime: '30/09/2026 14:16:50',
    result: 'Nâng giới hạn RAM lên 3072Mi, triệt tiêu lỗi OOMKilled, khôi phục p99 latency về 14ms',
    auditHash: 'sha256:7f3a8b41...19e0',
    incidentId: 'INC-2026-8812',
  },
  {
    id: 'ACT-2026-902',
    actionType: 'Kafka Consumer Lag DLQ Re-route',
    target: 'Topic/payments-stream (partition: 3)',
    organization: 'Fintech Payments Group',
    organizationId: 'org-fintech-03',
    environment: 'Production',
    riskLevel: 'HIGH',
    executionMode: 'HITL_GATE',
    approvalStatus: 'AWAITING_APPROVAL',
    executionStatus: 'EXECUTING',
    requestedBy: 'AI Anomaly Detector v2.4',
    executedBy: 'Chờ duyệt từ Platform Admin',
    requestedTime: '30/09/2026 14:40:35',
    startedTime: 'Chờ duyệt tại HITL Gate',
    completedTime: 'Đang chờ xử lý',
    result: 'Kế hoạch chuyển hướng tin nhắn lỗi vào Dead Letter Queue đang chờ phê duyệt',
    auditHash: 'sha256:PendingApproval',
    incidentId: 'INC-2026-8815',
  },
  {
    id: 'ACT-2026-903',
    actionType: 'Zero-Downtime Rolling Restart',
    target: 'Deployment/api-gateway (namespace: edge)',
    organization: 'Global Retail SME Ltd',
    organizationId: 'org-retail-02',
    environment: 'Production',
    riskLevel: 'MEDIUM',
    executionMode: 'AUTONOMOUS',
    approvalStatus: 'APPROVED',
    executionStatus: 'SUCCEEDED',
    requestedBy: 'Health Synthetics Prober',
    executedBy: 'K8s Rolling Rollout Operator',
    requestedTime: '30/09/2026 13:10:00',
    startedTime: '30/09/2026 13:10:15',
    completedTime: '30/09/2026 13:11:40',
    result: 'Khởi động tuần tự 6 Pods không gián đoạn kết nối, giải phóng 34 Goroutines rò rỉ',
    auditHash: 'sha256:c18b29...e021',
    incidentId: 'INC-2026-8819',
  },
  {
    id: 'ACT-2026-904',
    actionType: 'HPA Temporary Scale-out',
    target: 'HPA/checkout-worker (replicas: 4 -> 10)',
    organization: 'Acme Infrastructure Corp',
    organizationId: 'org-acme-01',
    environment: 'Production',
    riskLevel: 'LOW',
    executionMode: 'AUTONOMOUS',
    approvalStatus: 'PRE_APPROVED_BY_POLICY',
    executionStatus: 'SUCCEEDED',
    requestedBy: 'MAPE-K Workload Predictive Model',
    executedBy: 'Kubernetes HPA Controller',
    requestedTime: '30/09/2026 12:00:20',
    startedTime: '30/09/2026 12:00:30',
    completedTime: '30/09/2026 12:01:45',
    result: 'Mở rộng thành công 10 Pods, xử lý trơn tru đợt tăng tải Flash Sale 12,000 req/s',
    auditHash: 'sha256:e4901f...3b12',
    incidentId: 'INC-2026-8809',
  },
  {
    id: 'ACT-2026-905',
    actionType: 'Node Cordon & Safe Drain',
    target: 'Node/worker-node-hn-03 (k8s-prod-hn-01)',
    organization: 'Vận Tải Thông Minh SwiftLog',
    organizationId: 'org-logistics-04',
    environment: 'Production',
    riskLevel: 'CRITICAL',
    executionMode: 'HITL_GATE',
    approvalStatus: 'APPROVED',
    executionStatus: 'SUCCEEDED',
    requestedBy: 'eBPF Hardware Failure Watcher',
    executedBy: 'Safe Eviction Drain Manager',
    requestedTime: '30/09/2026 09:15:00',
    startedTime: '30/09/2026 09:18:20',
    completedTime: '30/09/2026 09:22:10',
    result: 'Di dời an toàn 18 Pods sang node dự phòng trước khi ổ cứng SSD NVMe quá nhiệt sập nguồn',
    auditHash: 'sha256:4a79b2...88fe',
    incidentId: 'INC-2026-8795',
  },
  {
    id: 'ACT-2026-906',
    actionType: 'TCP Socket Pool Flush',
    target: 'StatefulSet/db-read-pool (PostgreSQL)',
    organization: 'Fintech Payments Group',
    organizationId: 'org-fintech-03',
    environment: 'Staging',
    riskLevel: 'MEDIUM',
    executionMode: 'MANUAL',
    approvalStatus: 'REJECTED',
    executionStatus: 'FAILED',
    requestedBy: 'DevOps Engineer (SME Role)',
    executedBy: 'Rejected by Security Gate',
    requestedTime: '30/09/2026 08:30:10',
    startedTime: 'Không thi hành',
    completedTime: '30/09/2026 08:31:00',
    result: 'Từ chối thực thi do vi phạm chính sách khóa an toàn cơ sở dữ liệu trên môi trường thanh toán',
    auditHash: 'sha256:Rejected-Audit-Hash',
    incidentId: 'INC-2026-8790',
  },
];

let MOCK_POLICIES = [
  {
    id: 'POL-001',
    name: 'Tự Động Nâng Hạn Mức RAM OOM-Guard',
    triggerType: 'Kernel eBPF Probe (cgroup memory limit > 92%)',
    riskType: 'Non-Destructive',
    executionMode: 'Fully Autonomous',
    confidenceThreshold: 95,
    cooldown: '15m',
    maxRetries: 3,
    approvalRequirement: 'Auto-Approved for Tier-1 (No DB Impact)',
    activeStatus: true,
    description: 'Tự động tính toán và điều chỉnh Resource Limits khi phát hiện hiện tượng memory leak cục bộ.',
  },
  {
    id: 'POL-002',
    name: 'Chuyển Tiếp Hàng Đợi Nghẽn Vào Dead Letter Queue',
    triggerType: 'Kafka Consumer Lag (> 10,000 msgs)',
    riskType: 'State-Preserving',
    executionMode: 'HITL Approval Required',
    confidenceThreshold: 98,
    cooldown: '30m',
    maxRetries: 2,
    approvalRequirement: 'HITL Gate Super Admin Approval Mandatory',
    activeStatus: true,
    description: 'Phát hiện deserialization poison pill và chuyển sang DLQ để tránh tắc nghẽn giao dịch.',
  },
  {
    id: 'POL-003',
    name: 'Khởi Động Lại Không Gián Đoạn (Zero-Downtime Rollout)',
    triggerType: 'Synthetic Probe Failure (500 Error Spike > 5%)',
    riskType: 'State-Preserving',
    executionMode: 'Fully Autonomous',
    confidenceThreshold: 92,
    cooldown: '10m',
    maxRetries: 2,
    approvalRequirement: 'Auto-Approved with Healthcheck Validation',
    activeStatus: true,
    description: 'Áp dụng Rolling Restart từng Pods với maxSurge 25% và maxUnavailable 0.',
  },
  {
    id: 'POL-004',
    name: 'Cô Lập & Sơ Tán Máy Chủ Lỗi Phần Cứng (Cordon & Drain)',
    triggerType: 'Hardware SMART Anomaly (SSD Bad Blocks / ECC Error)',
    riskType: 'Disruptive',
    executionMode: 'HITL Approval Required',
    confidenceThreshold: 99,
    cooldown: '60m',
    maxRetries: 1,
    approvalRequirement: 'Dual Sign-off (Platform Admin + Lead)',
    activeStatus: false,
    description: 'Cordon node ngay lập tức và tiến hành drain tuần tự các workloads quan trọng.',
  },
  {
    id: 'POL-005',
    name: 'Tự Động Mở Rộng Replicas Giảm Áp Lực Tải Đột Biến',
    triggerType: 'CPU Throttling Ratio (> 25% trong 3 phút)',
    riskType: 'Non-Destructive',
    executionMode: 'Fully Autonomous',
    confidenceThreshold: 94,
    cooldown: '5m',
    maxRetries: 4,
    approvalRequirement: 'Auto-Approved up to Quota Limit',
    activeStatus: true,
    description: 'Kích hoạt mở rộng số lượng Pods tạm thời trong giới hạn ngân sách tài nguyên của tổ chức.',
  },
];

const MOCK_ACTION_TYPES = [
  {
    id: 'TYPE-01',
    name: 'K8s Resource Limit Patch (RAM/CPU)',
    category: 'Resource Optimization',
    defaultRiskLevel: 'LOW',
    targetResourceType: 'Deployment / StatefulSet',
    defaultApprovalRequired: false,
    supportsRollback: true,
    description: 'Tăng hoặc giảm thông số request/limit trong spec container không làm restart Pod nếu sử dụng In-place Pod Resize.',
  },
  {
    id: 'TYPE-02',
    name: 'Zero-Downtime Rolling Restart',
    category: 'Pod Resiliency',
    defaultRiskLevel: 'MEDIUM',
    targetResourceType: 'Deployment / DaemonSet',
    defaultApprovalRequired: false,
    supportsRollback: true,
    description: 'Cập nhật annotation kubectl.kubernetes.io/restartedAt để kích hoạt rolling rollout tuần tự không mất mát lưu lượng.',
  },
  {
    id: 'TYPE-03',
    name: 'HPA Temporary Scale-out',
    category: 'Workload Scaling',
    defaultRiskLevel: 'LOW',
    targetResourceType: 'HorizontalPodAutoscaler',
    defaultApprovalRequired: false,
    supportsRollback: true,
    description: 'Tăng minReplicas hoặc maxReplicas của HPA trong khung thời gian quá tải có kiểm soát hạn mức cluster quota.',
  },
  {
    id: 'TYPE-04',
    name: 'Kafka Consumer Lag DLQ Re-route',
    category: 'Traffic & Queue',
    defaultRiskLevel: 'HIGH',
    targetResourceType: 'Kafka Topic / Consumer Group',
    defaultApprovalRequired: true,
    supportsRollback: true,
    description: 'Chuyển tiếp gói tin có schema dị thường vào Dead Letter Queue để khơi thông luồng xử lý chính.',
  },
  {
    id: 'TYPE-05',
    name: 'Node Cordon & Safe Drain',
    category: 'Node Maintenance',
    defaultRiskLevel: 'CRITICAL',
    targetResourceType: 'Node',
    defaultApprovalRequired: true,
    supportsRollback: false,
    description: 'Đánh dấu unschedulable và di dời Pods có tôn trọng PodDisruptionBudget (PDB) trước khi node vật lý hỏng.',
  },
  {
    id: 'TYPE-06',
    name: 'TCP Socket Pool Flush',
    category: 'Database Connection',
    defaultRiskLevel: 'MEDIUM',
    targetResourceType: 'Connection Pool Proxy (PgBouncer/ProxySQL)',
    defaultApprovalRequired: true,
    supportsRollback: false,
    description: 'Xóa sạch các kết nối TCP mồ côi (zombie sockets) và reset lại pool kết nối an toàn.',
  },
];

const MOCK_ANALYTICS = {
  totalActions: 248,
  successRate: '96.4%',
  failedActions: 9,
  averageRecoveryTime: '1m 24s',
  retryCount: 14,
  actionTypeDistribution: [
    { type: 'K8s Resource Limit Patch', count: 112, percentage: 45.2 },
    { type: 'Zero-Downtime Rolling Restart', count: 68, percentage: 27.4 },
    { type: 'HPA Temporary Scale-out', count: 38, percentage: 15.3 },
    { type: 'Kafka DLQ Re-route', count: 18, percentage: 7.3 },
    { type: 'Node Cordon & Drain', count: 8, percentage: 3.2 },
    { type: 'TCP Socket Pool Flush', count: 4, percentage: 1.6 },
  ],
};

// ==========================================
// MOCK SERVICE METHODS
// ==========================================

/**
 * Lấy danh sách các hành động tự phục hồi có lọc đa chiều
 * @param {Object} [filters]
 * @returns {Promise<HealingAction[]>}
 */
export const getHealingActions = (filters = {}) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      let result = [...MOCK_HEALING_ACTIONS];

      const query = (filters.search || '').toLowerCase().trim();
      if (query) {
        result = result.filter(
          (item) =>
            item.id.toLowerCase().includes(query) ||
            item.actionType.toLowerCase().includes(query) ||
            item.target.toLowerCase().includes(query) ||
            item.organization.toLowerCase().includes(query) ||
            item.environment.toLowerCase().includes(query)
        );
      }

      if (filters.riskLevel && filters.riskLevel !== 'ALL') {
        result = result.filter((item) => item.riskLevel === filters.riskLevel);
      }

      if (filters.executionMode && filters.executionMode !== 'ALL') {
        result = result.filter((item) => item.executionMode === filters.executionMode);
      }

      if (filters.executionStatus && filters.executionStatus !== 'ALL') {
        result = result.filter((item) => item.executionStatus === filters.executionStatus);
      }

      if (filters.organization && filters.organization !== 'ALL') {
        result = result.filter(
          (item) => item.organization === filters.organization || item.organizationId === filters.organization
        );
      }

      resolve(result);
    }, 70);
  });
};

/**
 * Lấy danh mục các loại hành động chuẩn hóa
 * @returns {Promise<ActionTypeDefinition[]>}
 */
export const getActionTypes = () => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve([...MOCK_ACTION_TYPES]);
    }, 60);
  });
};

/**
 * Lấy danh sách chính sách tự phục hồi
 * @returns {Promise<SelfHealingPolicy[]>}
 */
export const getPolicies = () => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve([...MOCK_POLICIES]);
    }, 60);
  });
};

/**
 * Cập nhật cấu hình tham số cho một chính sách
 * @param {string} id
 * @param {Partial<SelfHealingPolicy>} updatedConfig
 * @returns {Promise<SelfHealingPolicy>}
 */
export const updatePolicyConfig = (id, updatedConfig) => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      const idx = MOCK_POLICIES.findIndex((p) => p.id === id);
      if (idx === -1) {
        reject(new Error(`Không tìm thấy chính sách với mã định danh: ${id}`));
        return;
      }

      MOCK_POLICIES[idx] = {
        ...MOCK_POLICIES[idx],
        ...updatedConfig,
      };

      resolve(MOCK_POLICIES[idx]);
    }, 80);
  });
};

/**
 * Bật/tắt trạng thái kích hoạt của chính sách
 * @param {string} id
 * @returns {Promise<SelfHealingPolicy>}
 */
export const togglePolicyActive = (id) => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      const idx = MOCK_POLICIES.findIndex((p) => p.id === id);
      if (idx === -1) {
        reject(new Error(`Không tìm thấy chính sách với mã định danh: ${id}`));
        return;
      }

      MOCK_POLICIES[idx].activeStatus = !MOCK_POLICIES[idx].activeStatus;
      resolve(MOCK_POLICIES[idx]);
    }, 60);
  });
};

/**
 * Lấy tổng hợp số liệu phân tích hiệu quả tự phục hồi
 * @returns {Promise<SelfHealingAnalyticsData>}
 */
export const getSelfHealingAnalytics = () => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({ ...MOCK_ANALYTICS });
    }, 60);
  });
};

const adminSelfHealingService = {
  getHealingActions,
  getActionTypes,
  getPolicies,
  updatePolicyConfig,
  togglePolicyActive,
  getSelfHealingAnalytics,
};

export default adminSelfHealingService;
