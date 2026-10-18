/**
 * @file adminIncidentsService.js
 * Platform Admin Incident Management Service Layer
 * Decoupled mock service providing typed data models and methods for multi-tenant incident management.
 * Enforces the 8-stage lifecycle:
 * Detection → Investigation → RCA → Recommendation → Approval → Healing → Verification → Resolution
 * Note: Healing actions are not executed directly from the incident page.
 */

/**
 * @typedef {Object} Incident
 * @property {string} id - Unique incident ticket ID (e.g., 'INC-2026-8812')
 * @property {string} title - Incident summary description
 * @property {string} severity - 'CRITICAL' | 'MAJOR' | 'MINOR' | 'INFO'
 * @property {string} status - 'INVESTIGATING' | 'RCA_COMPLETED' | 'AWAITING_APPROVAL' | 'HEALING' | 'VERIFYING' | 'RESOLVED'
 * @property {string} organizationId - Tenant organization ID
 * @property {string} organizationName - Tenant display name
 * @property {string} environment - 'Production' | 'Staging' | 'Development'
 * @property {string} clusterId - Kubernetes cluster identifier
 * @property {string} clusterName - Cluster display name
 * @property {string} source - Detection source probe (e.g., 'eBPF Kernel Probe')
 * @property {string} detectedTime - Timestamp when anomaly was first flagged
 * @property {string} startedTime - Timestamp when incident response was triggered
 * @property {string} resolvedTime - Timestamp when resolution was verified
 * @property {string} recoveryDuration - Mean time to resolution / Recovery duration (MTTR)
 */

/**
 * @typedef {Object} IncidentTimelineStep
 * @property {string} stage - 'Detection' | 'Investigation' | 'RCA' | 'Recommendation' | 'Approval' | 'Healing' | 'Verification' | 'Resolution'
 * @property {string} title - Step title
 * @property {string} status - 'COMPLETED' | 'IN_PROGRESS' | 'PENDING' | 'SKIPPED'
 * @property {string} timestamp - Occurrence timestamp
 * @property {string} actor - Triggering actor / engine
 * @property {string} detail - Step explanation
 */

/**
 * @typedef {Object} IncidentRCADetail
 * @property {string} rootCause - Diagnosed root cause summary
 * @property {string} confidence - AI model confidence percentage
 * @property {Array<{step: number, component: string, event: string}>} causalChain - Cause-effect graph sequence
 * @property {Array<{metric: string, threshold: string, observed: string, severity: string}>} signals - Telemetry anomalies
 * @property {{impactedServices: number, affectedPods: number, userImpact: string}} blastRadius - Blast radius assessment
 */

/**
 * @typedef {Object} IncidentHealingAction
 * @property {string} id - Unique action proposal ID
 * @property {string} action - Action title description
 * @property {string} type - Automation type (e.g., 'Auto-Remediation Patch', 'Pod Restart')
 * @property {string} target - Kubernetes resource target
 * @property {string} parameters - Execution parameters (YAML / config diff)
 * @property {string} state - 'RECOMMENDED' | 'AWAITING_APPROVAL' | 'EXECUTING' | 'APPLIED' | 'REJECTED'
 * @property {string} executedAt - Execution or approval time
 * @property {string} auditHash - Cryptographic SHA-256 audit fingerprint
 */

// Mock in-memory database of incidents
const MOCK_INCIDENTS = [
  {
    id: 'INC-2026-8812',
    title: 'Sự Cố Xung Đột Bộ Nhớ OOM-Killed Dây Chuyền trên Order Processor',
    severity: 'CRITICAL',
    status: 'RESOLVED',
    organizationId: 'org-acme-01',
    organizationName: 'Acme Infrastructure Corp',
    environment: 'Production',
    clusterId: 'k8s-acme-prod-01',
    clusterName: 'acme-production-us-east',
    source: 'eBPF Kernel Probe (OOM Watcher)',
    detectedTime: '30/09/2026 14:15:20',
    startedTime: '30/09/2026 14:15:22',
    resolvedTime: '30/09/2026 14:17:04',
    recoveryDuration: '1m 42s',
  },
  {
    id: 'INC-2026-8815',
    title: 'Tắc Nghẽn Hàng Đợi Kafka Consumer Lag trên Cụm Thanh Toán Giao Dịch',
    severity: 'MAJOR',
    status: 'AWAITING_APPROVAL',
    organizationId: 'org-fintech-03',
    organizationName: 'Fintech Payments Group',
    environment: 'Production',
    clusterId: 'k8s-fintech-prod-01',
    clusterName: 'fintech-core-prod-sg',
    source: 'AI Anomaly Detector v2.4',
    detectedTime: '30/09/2026 14:40:10',
    startedTime: '30/09/2026 14:40:12',
    resolvedTime: 'N/A (Chờ duyệt)',
    recoveryDuration: 'Đang xử lý',
  },
  {
    id: 'INC-2026-8819',
    title: 'Cạn Kiệt Bể Kết Nối Cơ Sở Dữ Liệu PostgreSQL (Pool Starvation)',
    severity: 'CRITICAL',
    status: 'HEALING',
    organizationId: 'org-retail-02',
    organizationName: 'Global Retail SME Ltd',
    environment: 'Production',
    clusterId: 'k8s-retail-prod-01',
    clusterName: 'retail-prod-hcm',
    source: 'Prometheus TCP Socket Alert',
    detectedTime: '30/09/2026 15:02:44',
    startedTime: '30/09/2026 15:02:46',
    resolvedTime: 'N/A (Đang tự lành)',
    recoveryDuration: 'Đang xử lý',
  },
  {
    id: 'INC-2026-8822',
    title: 'Nghẽn Xử Lý CPU Throttling trên Cổng Giao Tiếp Edge Ingress Gateway',
    severity: 'MINOR',
    status: 'RESOLVED',
    organizationId: 'org-logistics-04',
    organizationName: 'Vận Tải Thông Minh SwiftLog',
    environment: 'Development',
    clusterId: 'k8s-swift-trial-01',
    clusterName: 'swiftlog-trial-cluster',
    source: 'eBPF cgroup CPU Probe',
    detectedTime: '30/09/2026 11:20:00',
    startedTime: '30/09/2026 11:20:02',
    resolvedTime: '30/09/2026 11:21:18',
    recoveryDuration: '1m 16s',
  },
];

// Mock in-memory 8-stage Timelines
const MOCK_TIMELINES = {
  'INC-2026-8812': [
    {
      stage: 'Detection',
      title: 'Phát Hiện Dị Thường (Detection)',
      status: 'COMPLETED',
      timestamp: '14:15:20',
      actor: 'eBPF DaemonSet Kernel Probe',
      detail: 'Bắt được tín hiệu SIGKILL phát ra từ nhân Linux do cgroup v2 chạm ngưỡng memory limit 2048Mi.',
    },
    {
      stage: 'Investigation',
      title: 'Tự Động Thu Thập Bằng Chứng (Investigation)',
      status: 'COMPLETED',
      timestamp: '14:15:22',
      actor: 'Autonomous Diagnostics Engine',
      detail: 'Tự động trích xuất 500 dòng log gần nhất, đồ thị bộ nhớ JVM Heap và số lượng goroutines rò rỉ.',
    },
    {
      stage: 'RCA',
      title: 'Chẩn Đoán Nguyên Nhân Gốc Rễ (RCA)',
      status: 'COMPLETED',
      timestamp: '14:15:35',
      actor: 'AI Causal Graph Engine (Độ tin cậy 98.4%)',
      detail: 'Xác định rò rỉ bộ nhớ xảy ra trong hàm JsonBufferPool.Decode() khi xử lý gói tin JSON có kích thước đột biến.',
    },
    {
      stage: 'Recommendation',
      title: 'Đề Xuất Kế Hoạch Phục Hồi (Recommendation)',
      status: 'COMPLETED',
      timestamp: '14:15:42',
      actor: 'MAPE-K Planner v2.4',
      detail: 'Lập kế hoạch: Tăng giới hạn RAM lên 3072Mi tạm thời, kích hoạt HPA scale từ 4 lên 8 replicas và cô lập pod lỗi.',
    },
    {
      stage: 'Approval',
      title: 'Phê Duyệt Qua Cổng HITL (Approval)',
      status: 'COMPLETED',
      timestamp: '14:16:05',
      actor: 'Cổng Tự Trị Chính Sách (Auto-Approved by Policy)',
      detail: 'Sự cố thỏa mãn điều kiện tự trị an toàn Tier-1 (Độ tin cậy > 95%, không tác động database state).',
    },
    {
      stage: 'Healing',
      title: 'Thực Thi Tự Lành (Healing)',
      status: 'COMPLETED',
      timestamp: '14:16:15',
      actor: 'Self-Healing Kubernetes Operator',
      detail: 'Áp dụng Resource Patch 3072Mi và thực hiện Rolling Restart tuần tự không gián đoạn giao dịch.',
    },
    {
      stage: 'Verification',
      title: 'Kiểm Chứng Sức Khỏe Sau Tự Lành (Verification)',
      status: 'COMPLETED',
      timestamp: '14:16:50',
      actor: 'Synthetic Health Checker',
      detail: '100 probe HTTP /healthz đạt 200 OK, latency p99 duy trì ở mức 14ms, không còn tín hiệu OOM.',
    },
    {
      stage: 'Resolution',
      title: 'Đóng Sự Cố & Ký Số Nhật Ký (Resolution)',
      status: 'COMPLETED',
      timestamp: '14:17:04',
      actor: 'Audit Blockchain Ledger',
      detail: 'Đã đóng sự cố thành công với thời gian MTTR 1m 42s. Tạo chữ ký băm mật mã SHA-256 bất biến lưu trữ kiểm toán.',
    },
  ],
  'INC-2026-8815': [
    {
      stage: 'Detection',
      title: 'Phát Hiện Dị Thường (Detection)',
      status: 'COMPLETED',
      timestamp: '14:40:10',
      actor: 'AI Anomaly Detector v2.4',
      detail: 'Tốc độ tiêu thụ tin nhắn giảm 65%, độ trễ consumer lag vượt ngưỡng 12,000 messages.',
    },
    {
      stage: 'Investigation',
      title: 'Thu Thập Bằng Chứng (Investigation)',
      status: 'COMPLETED',
      timestamp: '14:40:12',
      actor: 'Diagnostics Engine',
      detail: 'Ghi nhận khóa hàng đợi partition-3 do lỗi serialization không tương thích ngược.',
    },
    {
      stage: 'RCA',
      title: 'Chẩn Đoán Nguyên Nhân Gốc (RCA)',
      status: 'COMPLETED',
      timestamp: '14:40:28',
      actor: 'AI Causal Graph Engine (Độ tin cậy 96.1%)',
      detail: 'Payload phiên bản v2.1 thiếu trường merchant_id khiến worker retry vô hạn.',
    },
    {
      stage: 'Recommendation',
      title: 'Đề Xuất Hành Động (Recommendation)',
      status: 'COMPLETED',
      timestamp: '14:40:35',
      actor: 'MAPE-K Planner v2.4',
      detail: 'Đề xuất: Chuyển hướng các tin nhắn lỗi vào Dead Letter Queue (DLQ) và tăng tạm thời 4 consumer workers.',
    },
    {
      stage: 'Approval',
      title: 'Chờ Phê Duyệt Cổng HITL (Approval)',
      status: 'IN_PROGRESS',
      timestamp: '14:40:40',
      actor: 'Cổng Duyệt HITL (/admin/approvals)',
      detail: 'Hành động tác động đến hàng đợi giao dịch tài chính. Yêu cầu Quản Trị Viên phê duyệt tại Cổng HITL Gate.',
    },
    {
      stage: 'Healing',
      title: 'Thực Thi Tự Lành (Healing)',
      status: 'PENDING',
      timestamp: '--:--:--',
      actor: 'Kubernetes Operator',
      detail: 'Chờ phê duyệt từ Platform Admin...',
    },
    {
      stage: 'Verification',
      title: 'Kiểm Chứng (Verification)',
      status: 'PENDING',
      timestamp: '--:--:--',
      actor: 'Synthetic Prober',
      detail: 'Chờ hoàn thành bước tự lành...',
    },
    {
      stage: 'Resolution',
      title: 'Giải Quyết Sự Cố (Resolution)',
      status: 'PENDING',
      timestamp: '--:--:--',
      actor: 'Ledger Audit',
      detail: 'Chờ hoàn thành kiểm chứng...',
    },
  ],
};

// Mock in-memory RCA details
const MOCK_RCA = {
  'INC-2026-8812': {
    rootCause: 'Rò rỉ bộ nhớ không giới hạn (Unbounded memory leak) trong JsonBufferPool khi giải mã payload JSON bất thường.',
    confidence: '98.4%',
    causalChain: [
      { step: 1, component: 'api-gateway', event: 'Tiếp nhận yêu cầu POST /api/orders với body payload kích thước 18MB' },
      { step: 2, component: 'order-processor', event: 'Bộ đệm JsonBufferPool cấp phát liên tục mà không thu hồi (OOM Spike)' },
      { step: 3, component: 'linux-kernel', event: 'cgroup memory threshold 2048Mi chạm đỉnh, kích hoạt OOM-Killer tiêu diệt Pod' },
      { step: 4, component: 'kubernetes-scheduler', event: 'Pod khởi động lại nhưng sập liên tục (CrashLoopBackOff)' },
    ],
    signals: [
      { metric: 'container_memory_working_set_bytes', threshold: '1.95 GiB', observed: '2.04 GiB', severity: 'CRITICAL' },
      { metric: 'cgroup_oom_kills_total', threshold: '0 / min', observed: '4 / min', severity: 'CRITICAL' },
      { metric: 'http_request_duration_seconds_p99', threshold: '120 ms', observed: '4820 ms', severity: 'WARNING' },
    ],
    blastRadius: {
      impactedServices: 2,
      affectedPods: 4,
      userImpact: '58 đơn hàng bị hoãn trong 1m 42s, không thất thoát dữ liệu.',
    },
  },
  'INC-2026-8815': {
    rootCause: 'Tin nhắn sai định dạng schema v2.1 gây kẹt chuỗi tiêu thụ (Deserialization Poison Pill).',
    confidence: '96.1%',
    causalChain: [
      { step: 1, component: 'payment-service', event: 'Sản xuất tin nhắn thiếu trường bắt buộc merchant_id' },
      { step: 2, component: 'kafka-consumer', event: 'Ném ra ngoại lệ DeserializationException và liên tục retry' },
      { step: 3, component: 'partition-3', event: 'Hàng đợi bị khóa, consumer lag tăng vọt lên 12,450 messages' },
    ],
    signals: [
      { metric: 'kafka_consumergroup_lag', threshold: '500 msgs', observed: '12,450 msgs', severity: 'CRITICAL' },
      { metric: 'consumer_error_rate_percentage', threshold: '0.1%', observed: '18.4%', severity: 'MAJOR' },
    ],
    blastRadius: {
      impactedServices: 1,
      affectedPods: 6,
      userImpact: 'Xử lý thanh toán bị trễ trung bình 15 giây.',
    },
  },
};

// Mock in-memory Healing Actions
const MOCK_HEALING_ACTIONS = {
  'INC-2026-8812': [
    {
      id: 'ACT-01',
      action: 'Nâng Giới Hạn Tài Nguyên RAM cgroup (Memory Limit Bump)',
      type: 'K8s Resource Patch',
      target: 'Deployment/order-processor',
      parameters: 'resources.limits.memory: 3072Mi (Tăng từ 2048Mi)',
      state: 'APPLIED',
      executedAt: '30/09/2026 14:16:15',
      auditHash: 'sha256:7f3a8b...19e0',
    },
    {
      id: 'ACT-02',
      action: 'Khởi Động Lại Tuần Tự Không Gián Đoạn (Zero-Downtime Rollout)',
      type: 'Rolling Restart',
      target: 'Deployment/order-processor',
      parameters: 'maxSurge: 25%, maxUnavailable: 0',
      state: 'APPLIED',
      executedAt: '30/09/2026 14:16:22',
      auditHash: 'sha256:9c41d0...a821',
    },
    {
      id: 'ACT-03',
      action: 'Mở Rộng Tự Động Replicas (HPA Temporary Scale-out)',
      type: 'HPA Scale',
      target: 'HPA/order-processor-hpa',
      parameters: 'minReplicas: 8 (Tạm thời tăng từ 4)',
      state: 'APPLIED',
      executedAt: '30/09/2026 14:16:30',
      auditHash: 'sha256:3d82a1...bc72',
    },
  ],
  'INC-2026-8815': [
    {
      id: 'ACT-04',
      action: 'Chuyển Hướng Tin Nhắn Lỗi Sang Hàng Đợi Chết (Dead Letter Queue)',
      type: 'Kafka DLQ Route',
      target: 'Topic/payments-dlq',
      parameters: 'errorThreshold: 3 retries, skipPoisonPill: true',
      state: 'AWAITING_APPROVAL',
      executedAt: 'Chờ duyệt tại HITL Gate',
      auditHash: 'sha256:PendingApproval',
    },
    {
      id: 'ACT-05',
      action: 'Mở Rộng Số Lượng Consumer Pods Giảm Tải',
      type: 'K8s Scale',
      target: 'Deployment/kafka-payment-consumer',
      parameters: 'replicas: 10 (Tăng từ 6)',
      state: 'RECOMMENDED',
      executedAt: 'Chờ duyệt',
      auditHash: 'sha256:PendingApproval',
    },
  ],
};

// ==========================================
// MOCK SERVICE METHODS
// ==========================================

/**
 * Lấy danh sách sự cố có hỗ trợ tìm kiếm và lọc đa chiều
 * @param {Object} [filters]
 * @returns {Promise<Incident[]>}
 */
export const getIncidents = (filters = {}) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      let result = [...MOCK_INCIDENTS];

      const query = (filters.search || filters.query || '').toLowerCase().trim();
      if (query) {
        result = result.filter(
          (inc) =>
            inc.id.toLowerCase().includes(query) ||
            inc.title.toLowerCase().includes(query) ||
            inc.organizationName.toLowerCase().includes(query) ||
            inc.clusterName.toLowerCase().includes(query) ||
            inc.source.toLowerCase().includes(query)
        );
      }

      if (filters.severity && filters.severity !== 'ALL') {
        result = result.filter((inc) => inc.severity === filters.severity);
      }

      if (filters.status && filters.status !== 'ALL') {
        result = result.filter((inc) => inc.status === filters.status);
      }

      if (filters.organization && filters.organization !== 'ALL') {
        result = result.filter(
          (inc) => inc.organizationId === filters.organization || inc.organizationName === filters.organization
        );
      }

      resolve(result);
    }, 70);
  });
};

/**
 * Lấy chi tiết thông tin một sự cố theo ID
 * @param {string} id
 * @returns {Promise<Incident|null>}
 */
export const getIncidentById = (id) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const inc = MOCK_INCIDENTS.find((i) => i.id === id);
      resolve(inc || null);
    }, 60);
  });
};

/**
 * Lấy chuỗi dòng thời gian 8 giai đoạn của sự cố
 * @param {string} id
 * @returns {Promise<IncidentTimelineStep[]>}
 */
export const getIncidentTimeline = (id) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(MOCK_TIMELINES[id] || MOCK_TIMELINES['INC-2026-8812']);
    }, 60);
  });
};

/**
 * Lấy chi tiết chẩn đoán nguyên nhân gốc rễ (RCA) của sự cố
 * @param {string} id
 * @returns {Promise<IncidentRCADetail>}
 */
export const getIncidentRCA = (id) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(MOCK_RCA[id] || MOCK_RCA['INC-2026-8812']);
    }, 60);
  });
};

/**
 * Lấy danh sách các hành động tự phục hồi gắn với sự cố
 * @param {string} id
 * @returns {Promise<IncidentHealingAction[]>}
 */
export const getIncidentHealingActions = (id) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(MOCK_HEALING_ACTIONS[id] || MOCK_HEALING_ACTIONS['INC-2026-8812']);
    }, 60);
  });
};

/**
 * Lấy các chỉ số KPI tổng quan sự cố trên toàn nền tảng
 * @returns {Promise<Object>}
 */
export const getIncidentKPIs = () => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        totalIncidents: MOCK_INCIDENTS.length,
        criticalCount: MOCK_INCIDENTS.filter((i) => i.severity === 'CRITICAL').length,
        resolvedCount: MOCK_INCIDENTS.filter((i) => i.status === 'RESOLVED').length,
        awaitingApprovalCount: MOCK_INCIDENTS.filter((i) => i.status === 'AWAITING_APPROVAL').length,
        averageMTTR: '1m 29s',
        autoHealingRate: '94.2%',
      });
    }, 60);
  });
};

const adminIncidentsService = {
  getIncidents,
  getIncidentById,
  getIncidentTimeline,
  getIncidentRCA,
  getIncidentHealingActions,
  getIncidentKPIs,
};

export default adminIncidentsService;
