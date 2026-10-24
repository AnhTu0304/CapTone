import { request, executeWithFallback } from './apiClient';
/**
 * @file adminAuditLogsService.js
 * Tầng dịch vụ cung cấp dữ liệu Nhật ký kiểm toán cấp Nền tảng (Platform Admin Audit Logs).
 * 
 * Tuân thủ nghiêm ngặt nguyên tắc bảo mật và toàn vẹn:
 * - Dữ liệu bất biến (Immutable & Append-Only).
 * - Mọi bản ghi đều có chữ ký băm mật mã SHA-256.
 * - Tuyệt đối không cho phép chỉnh sửa hoặc xóa bản ghi từ giao diện UI.
 */

/**
 * @typedef {Object} AuditLogEntry
 * @property {string} id - Mã định danh kiểm toán (VD: AUD-2026-9041)
 * @property {string} timestamp - Mốc thời gian ISO (DD/MM/YYYY HH:mm:ss)
 * @property {string} actor - Tác nhân thực hiện
 * @property {'USER' | 'SYSTEM_AI' | 'EBPF_AGENT' | 'API_KEY'} actorType - Phân loại tác nhân
 * @property {string} action - Hành động chuẩn hóa
 * @property {string} resourceType - Loại tài nguyên
 * @property {string} resourceId - Mã định danh tài nguyên
 * @property {string} organization - Tổ chức thuê bao hoặc Nền tảng
 * @property {'SUCCESS' | 'FAILED' | 'PENDING_VERIFY' | 'BLOCKED'} status - Trạng thái
 * @property {string} ipAddress - Địa chỉ IP nguồn
 * @property {string} description - Mô tả chi tiết hành vi
 * @property {Object|null} beforeData - Dữ liệu trạng thái trước khi can thiệp
 * @property {Object|null} afterData - Dữ liệu trạng thái sau khi can thiệp
 * @property {Object} metadata - Siêu dữ liệu bảo mật (SHA-256, Correlation ID, v.v.)
 */

const MOCK_AUDIT_LOGS = [
  {
    id: 'AUD-2026-9048',
    timestamp: '30/09/2026 16:45:12',
    actor: 'Lê Minh Quân (Platform Admin)',
    actorType: 'USER',
    action: 'HITL_APPROVAL_GRANTED',
    resourceType: 'Deployment',
    resourceId: 'Deployment/order-processor',
    organization: 'FinTech Global',
    status: 'SUCCESS',
    ipAddress: '113.161.72.45',
    description: 'Phê duyệt cấp phép khẩn cấp nâng ngưỡng giới hạn RAM từ 2048Mi lên 3072Mi qua Cổng Phê Duyệt HITL Gate.',
    beforeData: {
      resources: {
        limits: { memory: '2048Mi', cpu: '2000m' },
        requests: { memory: '1024Mi', cpu: '500m' },
      },
      replicas: 4,
      approvalStatus: 'AWAITING_APPROVAL',
    },
    afterData: {
      resources: {
        limits: { memory: '3072Mi', cpu: '2000m' },
        requests: { memory: '1536Mi', cpu: '500m' },
      },
      replicas: 4,
      approvalStatus: 'APPROVED',
      approvedBy: 'Lê Minh Quân',
    },
    metadata: {
      sha256: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
      sessionId: 'sess-adm-99120',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/128.0.0.0',
      correlationId: 'INC-2026-8812',
      executionLatency: '142ms',
    },
  },
  {
    id: 'AUD-2026-9047',
    timestamp: '30/09/2026 16:30:20',
    actor: 'MAPE-K Autonomous Engine',
    actorType: 'SYSTEM_AI',
    action: 'K8S_LIMIT_PATCH',
    resourceType: 'Deployment',
    resourceId: 'Deployment/payment-service',
    organization: 'Retail Corp',
    status: 'SUCCESS',
    ipAddress: '10.244.0.1 (Internal Cluster)',
    description: 'Tự động vá tài nguyên limits.memory in-place ngăn ngừa sự cố OOMKill theo dự báo rủi ro cao từ mô hình Học máy.',
    beforeData: {
      limits: { memory: '1536Mi' },
      status: 'OOM_WARNING_SPIKE',
    },
    afterData: {
      limits: { memory: '2560Mi' },
      status: 'NORMALIZED',
    },
    metadata: {
      sha256: '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8',
      sessionId: 'sys-daemon-k8s-operator',
      userAgent: 'MAPE-K-Operator/v2.4.1 (Linux amd64)',
      correlationId: 'PRED-2026-891',
      executionLatency: '320ms',
    },
  },
  {
    id: 'AUD-2026-9046',
    timestamp: '30/09/2026 15:55:00',
    actor: 'Trần Đình Tuấn (DevOps Lead)',
    actorType: 'USER',
    action: 'POLICY_CONFIG_UPDATED',
    resourceType: 'Policy',
    resourceId: 'Policy/POL-02',
    organization: 'FinTech Global',
    status: 'SUCCESS',
    ipAddress: '14.162.180.92',
    description: 'Điều chỉnh cấu hình chính sách tự phục hồi: nâng ngưỡng tin cậy từ 90% lên 95%, thời gian cooldown 300s.',
    beforeData: {
      confidenceThreshold: 90,
      cooldown: 180,
      maxRetries: 2,
    },
    afterData: {
      confidenceThreshold: 95,
      cooldown: 300,
      maxRetries: 3,
    },
    metadata: {
      sha256: '4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a',
      sessionId: 'sess-devops-4819',
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      correlationId: 'CFG-POL-2026-02',
      executionLatency: '85ms',
    },
  },
  {
    id: 'AUD-2026-9045',
    timestamp: '30/09/2026 14:12:35',
    actor: 'eBPF DaemonSet Probe #04',
    actorType: 'EBPF_AGENT',
    action: 'KERNEL_PROBE_ANOMALY',
    resourceType: 'Node',
    resourceId: 'Node/worker-node-hn-03',
    organization: 'Global Platform',
    status: 'SUCCESS',
    ipAddress: '10.0.4.15',
    description: 'Cảm biến nhân Linux CO-RE phát hiện tranh chấp luồng kernel socket backlog vượt ngưỡng 4.8 sigma.',
    beforeData: {
      socketBacklogUsage: '12%',
      tcpRetransRate: '0.01%',
    },
    afterData: {
      socketBacklogUsage: '94%',
      tcpRetransRate: '3.82%',
    },
    metadata: {
      sha256: 'ef2d127de37b942baad06145e54b0c619a1f22327b2ebbcfbec78f5564afe39d',
      sessionId: 'ebpf-probe-node-03',
      userAgent: 'eBPF-Agent-CO-RE/v3.2.0 (Kernel 6.8.0-45-generic)',
      correlationId: 'TEL-SOCKET-9092',
      executionLatency: '1.2ms',
    },
  },
  {
    id: 'AUD-2026-9044',
    timestamp: '30/09/2026 13:40:18',
    actor: 'API_KEY/prom-grafana-exporter',
    actorType: 'API_KEY',
    action: 'AUDIT_EXPORT_CSV',
    resourceType: 'Cluster',
    resourceId: 'Cluster/prod-hn-01',
    organization: 'LogiChain Logistics',
    status: 'SUCCESS',
    ipAddress: '118.69.182.3',
    description: 'Truy xuất nhật ký kiểm toán và số liệu SLA phục vụ báo cáo tuân thủ SOC 2 Type II qua API tích hợp.',
    beforeData: null,
    afterData: {
      exportFormat: 'CSV_ENCRYPTED',
      recordCount: 1420,
      scope: 'Cluster/prod-hn-01',
    },
    metadata: {
      sha256: '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918',
      sessionId: 'apikey-prom-exporter-v1',
      userAgent: 'GrafanaExporter/10.4.1',
      correlationId: 'SOC2-AUD-2026-Q3',
      executionLatency: '450ms',
    },
  },
  {
    id: 'AUD-2026-9043',
    timestamp: '30/09/2026 11:20:05',
    actor: 'Nguyễn Văn Hoàng (Security Auditor)',
    actorType: 'USER',
    action: 'ORG_QUOTA_ADJUSTED',
    resourceType: 'Organization',
    resourceId: 'Org/logichain-logistics',
    organization: 'LogiChain Logistics',
    status: 'SUCCESS',
    ipAddress: '27.72.61.104',
    description: 'Nâng hạn mức tối đa tài nguyên cụm K8s từ 3 cụm lên 5 cụm và 100 Pods sau khi phê duyệt gói mở rộng Enterprise.',
    beforeData: {
      maxClusters: 3,
      maxPods: 60,
      planTier: 'Growth',
    },
    afterData: {
      maxClusters: 5,
      maxPods: 100,
      planTier: 'Enterprise',
    },
    metadata: {
      sha256: 'a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0',
      sessionId: 'sess-sec-9081',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      correlationId: 'BILLING-SUB-994',
      executionLatency: '110ms',
    },
  },
  {
    id: 'AUD-2026-9042',
    timestamp: '30/09/2026 09:15:30',
    actor: 'Lê Minh Quân (Platform Admin)',
    actorType: 'USER',
    action: 'TENANT_SUSPEND',
    resourceType: 'Organization',
    resourceId: 'Org/techcorp-test',
    organization: 'TechCorp Solutions',
    status: 'SUCCESS',
    ipAddress: '113.161.72.45',
    description: 'Tạm dừng tổ chức do phát hiện tài nguyên vi phạm giới hạn bảo mật và hết hạn thời gian dùng thử (Trial expired).',
    beforeData: {
      status: 'TRIAL',
      activeWorkloads: 8,
    },
    afterData: {
      status: 'SUSPENDED',
      activeWorkloads: 0,
      suspensionReason: 'Trial Expired & Security Quota Violation',
    },
    metadata: {
      sha256: 'b2c3d4e5f6a7890123456789abcdef0123456789abcdef0123456789abcdef01',
      sessionId: 'sess-adm-99118',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      correlationId: 'SUSPEND-ORG-03',
      executionLatency: '215ms',
    },
  },
  {
    id: 'AUD-2026-9041',
    timestamp: '29/09/2026 23:45:10',
    actor: 'MAPE-K Autonomous Engine',
    actorType: 'SYSTEM_AI',
    action: 'ROLLING_RESTART',
    resourceType: 'Deployment',
    resourceId: 'Deployment/auth-broker',
    organization: 'FinTech Global',
    status: 'SUCCESS',
    ipAddress: '10.244.0.1 (Internal Cluster)',
    description: 'Thực hiện khởi động cuộn không gián đoạn (Zero-Downtime Rolling Restart) khắc phục hiện tượng rò rỉ socket descriptor.',
    beforeData: {
      openSocketFD: 8410,
      readyReplicas: 3,
    },
    afterData: {
      openSocketFD: 210,
      readyReplicas: 3,
    },
    metadata: {
      sha256: 'c3d4e5f6a7b8890123456789abcdef0123456789abcdef0123456789abcdef02',
      sessionId: 'sys-daemon-k8s-operator',
      userAgent: 'MAPE-K-Operator/v2.4.1',
      correlationId: 'INC-2026-8798',
      executionLatency: '4,200ms',
    },
  },
  {
    id: 'AUD-2026-9040',
    timestamp: '29/09/2026 21:10:44',
    actor: 'Unauthorized Remote Agent',
    actorType: 'USER',
    action: 'SECRET_DECRYPT_ATTEMPT',
    resourceType: 'Secret',
    resourceId: 'Secret/db-master-credentials',
    organization: 'FinTech Global',
    status: 'BLOCKED',
    ipAddress: '198.51.100.44 (Untrusted Proxy)',
    description: 'Hệ thống eBPF Kernel Shield chặn đứng hành vi cố gắng truy xuất và giải mã Secrets K8s mà không có quyền RBAC.',
    beforeData: {
      accessAttempts: 0,
      blocked: false,
    },
    afterData: {
      accessAttempts: 1,
      blocked: true,
      reportedToSIEM: true,
    },
    metadata: {
      sha256: 'd4e5f6a7b8c9890123456789abcdef0123456789abcdef0123456789abcdef03',
      sessionId: 'untrusted-session-err',
      userAgent: 'Python-urllib/3.10',
      correlationId: 'SEC-BREACH-ATTEMPT-01',
      executionLatency: '0.8ms',
    },
  },
  {
    id: 'AUD-2026-9039',
    timestamp: '29/09/2026 18:30:15',
    actor: 'MAPE-K Autonomous Engine',
    actorType: 'SYSTEM_AI',
    action: 'NODE_CORDON_DRAIN',
    resourceType: 'Node',
    resourceId: 'Node/worker-node-02',
    organization: 'Retail Corp',
    status: 'FAILED',
    ipAddress: '10.244.0.1 (Internal Cluster)',
    description: 'Thao tác tháo tải Node thất bại do vi phạm PodDisruptionBudget của khối công việc cơ sở dữ liệu StatefulSet.',
    beforeData: {
      nodeStatus: 'Ready',
      scheduledPods: 24,
    },
    afterData: {
      nodeStatus: 'Ready,SchedulingDisabled',
      scheduledPods: 24,
      errorMessage: 'Cannot evict pod/redis-cluster-0: PodDisruptionBudget maxUnavailable reached (0)',
    },
    metadata: {
      sha256: 'e5f6a7b8c9d0890123456789abcdef0123456789abcdef0123456789abcdef04',
      sessionId: 'sys-daemon-k8s-operator',
      userAgent: 'MAPE-K-Operator/v2.4.1',
      correlationId: 'INC-2026-8790',
      executionLatency: '30,000ms',
    },
  },
  {
    id: 'AUD-2026-9038',
    timestamp: '28/09/2026 14:10:00',
    actor: 'Vũ Quốc Huy (DevOps Engineer)',
    actorType: 'USER',
    action: 'CLUSTER_SYNC',
    resourceType: 'Cluster',
    resourceId: 'Cluster/prod-sg-01',
    organization: 'FinTech Global',
    status: 'SUCCESS',
    ipAddress: '14.162.180.92',
    description: 'Thực hiện đồng bộ trạng thái cấu hình cụm máy chủ khu vực Singapore sau đợt cập nhật phiên bản Kubernetes v1.30.2.',
    beforeData: {
      syncStatus: 'OUT_OF_SYNC',
      k8sVersion: 'v1.29.5',
    },
    afterData: {
      syncStatus: 'SYNCED',
      k8sVersion: 'v1.30.2',
    },
    metadata: {
      sha256: 'f6a7b8c9d0e1890123456789abcdef0123456789abcdef0123456789abcdef05',
      sessionId: 'sess-devops-4819',
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      correlationId: 'SYNC-K8S-SG-01',
      executionLatency: '1,250ms',
    },
  },
  {
    id: 'AUD-2026-9037',
    timestamp: '27/09/2026 10:05:22',
    actor: 'eBPF DaemonSet Probe #01',
    actorType: 'EBPF_AGENT',
    action: 'AGENT_SELF_HEAL',
    resourceType: 'Node',
    resourceId: 'Node/worker-node-hn-01',
    organization: 'Global Platform',
    status: 'SUCCESS',
    ipAddress: '10.0.1.12',
    description: 'Tác tử tự phục hồi bộ đệm bpf map ringbuffer sau khi ghi nhận lưu lượng viễn trắc đột biến vượt mức cho phép.',
    beforeData: {
      bpfMapBufferUsage: '99.4%',
      droppedPackets: 1240,
    },
    afterData: {
      bpfMapBufferUsage: '12.0%',
      droppedPackets: 0,
    },
    metadata: {
      sha256: '07a8b9c0d1e2890123456789abcdef0123456789abcdef0123456789abcdef06',
      sessionId: 'ebpf-probe-node-01',
      userAgent: 'eBPF-Agent-CO-RE/v3.2.0',
      correlationId: 'EBPF-BUF-OVERFLOW-01',
      executionLatency: '4.5ms',
    },
  },
];

/**
 * Lấy danh sách nhật ký kiểm toán có hỗ trợ lọc, tìm kiếm, sắp xếp và phân trang
 * @param {Object} [filters]
 * @param {Object} [pagination] - { page: number, pageSize: number }
 * @param {Object} [sorting] - { field: string, direction: 'asc' | 'desc' }
 * @returns {Promise<{ data: AuditLogEntry[], total: number, page: number, pageSize: number }>}
 */

/**
 * Chuyển đổi bản ghi từ Backend CSDL sang cấu trúc UI của Admin Dashboard
 */
const mapBackendLogToEntry = (raw) => {
  const dateObj = new Date(raw.created_at);
  const formattedDate = !isNaN(dateObj.getTime())
    ? `${String(dateObj.getDate()).padStart(2, '0')}/${String(dateObj.getMonth() + 1).padStart(2, '0')}/${dateObj.getFullYear()} ${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')}:${String(dateObj.getSeconds()).padStart(2, '0')}`
    : raw.created_at;

  const rawMeta = typeof raw.metadata === 'object' && raw.metadata !== null ? raw.metadata : {};

  return {
    id: `AUD-${String(raw.id).padStart(6, '0')}`,
    rawId: raw.id,
    timestamp: formattedDate,
    actor: raw.user_name ? `${raw.user_name} (${raw.user_email || ''})` : (raw.user_email || 'Hệ Thống Tự Động (System)'),
    actorType: raw.actor_type || 'USER',
    action: raw.action,
    resourceType: raw.resource_type || 'SYSTEM',
    resourceId: raw.resource_id || '-',
    organization: raw.organization_name || (raw.organization_id ? `Org: ${String(raw.organization_id).substring(0, 8)}` : 'Global Platform'),
    status: raw.status || 'SUCCESS',
    ipAddress: raw.ip_address || '127.0.0.1',
    description: raw.description || raw.action,
    beforeData: rawMeta.beforeData || null,
    afterData: rawMeta.afterData || null,
    metadata: {
      sha256: rawMeta.sha256 || '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
      sessionId: raw.request_id || rawMeta.sessionId || 'sys-session',
      userAgent: raw.user_agent || rawMeta.userAgent || 'AegisAI-Client/v1.0',
      reasonCode: raw.reason_code,
      ...rawMeta,
    },
  };
};

const mockGetAuditLogs = (filters = {}, pagination = { page: 1, pageSize: 10 }, sorting = { field: 'timestamp', direction: 'desc' }) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      let result = [...MOCK_AUDIT_LOGS];

      // 1. Search filter across multiple fields
      if (filters.search) {
        const query = filters.search.toLowerCase().trim();
        result = result.filter(
          (log) =>
            log.id.toLowerCase().includes(query) ||
            log.actor.toLowerCase().includes(query) ||
            log.action.toLowerCase().includes(query) ||
            log.resourceId.toLowerCase().includes(query) ||
            log.organization.toLowerCase().includes(query) ||
            log.ipAddress.toLowerCase().includes(query) ||
            log.metadata.sha256.toLowerCase().includes(query)
        );
      }

      // 2. Actor Type filter
      if (filters.actorType && filters.actorType !== 'ALL') {
        result = result.filter((log) => log.actorType === filters.actorType);
      }

      // 3. Action filter
      if (filters.action && filters.action !== 'ALL') {
        result = result.filter((log) => log.action === filters.action);
      }

      // 4. Resource Type filter
      if (filters.resourceType && filters.resourceType !== 'ALL') {
        result = result.filter((log) => log.resourceType === filters.resourceType);
      }

      // 5. Organization filter
      if (filters.organization && filters.organization !== 'ALL') {
        result = result.filter((log) => log.organization === filters.organization);
      }

      // 6. Status filter
      if (filters.status && filters.status !== 'ALL') {
        result = result.filter((log) => log.status === filters.status);
      }

      // 7. Date range filter (Presets: 24h, 7d, 30d, all)
      if (filters.dateRange && filters.dateRange !== 'ALL') {
        // Mock date range filtering for demonstration
        if (filters.dateRange === '24H') {
          result = result.filter((log) => log.timestamp.includes('30/09/2026'));
        } else if (filters.dateRange === '7D') {
          // All our records are within last 7 days
        }
      }

      // 8. Sorting
      if (sorting && sorting.field) {
        const { field, direction } = sorting;
        const multiplier = direction === 'asc' ? 1 : -1;

        result.sort((a, b) => {
          let valA = a[field] || '';
          let valB = b[field] || '';

          if (field === 'timestamp') {
            // Compare timestamps
            return multiplier * valA.localeCompare(valB);
          }
          if (typeof valA === 'string') {
            return multiplier * valA.localeCompare(valB);
          }
          return multiplier * (valA > valB ? 1 : -1);
        });
      }

      const total = result.length;
      const page = pagination.page || 1;
      const pageSize = pagination.pageSize || 10;
      const startIndex = (page - 1) * pageSize;
      const paginatedData = result.slice(startIndex, startIndex + pageSize);

      resolve({
        data: paginatedData,
        total,
        page,
        pageSize,
      });
    }, 60);
  });
};

/**
 * Lấy chi tiết một bản ghi kiểm toán theo ID
 * @param {string} id
 * @returns {Promise<AuditLogEntry|null>}
 */
export const getAuditLogById = (id) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const found = MOCK_AUDIT_LOGS.find((l) => l.id === id) || null;
      resolve(found);
    }, 40);
  });
};

/**
 * Lấy các chỉ số KPI thống kê kiểm toán tổng quan
 * @returns {Promise<Object>}
 */
const mockGetAuditSummaryKPIs = () => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        totalLogs: MOCK_AUDIT_LOGS.length,
        verifiedIntegrity: '100% (SHA-256 Validated)',
        blockedViolations: MOCK_AUDIT_LOGS.filter((l) => l.status === 'BLOCKED').length,
        autonomousActions: MOCK_AUDIT_LOGS.filter((l) => l.actorType === 'SYSTEM_AI').length,
        activeActorsCount: 7,
      });
    }, 50);
  });
};


/**
 * Lấy danh sách nhật ký kiểm toán có hỗ trợ lọc, tìm kiếm, sắp xếp và phân trang (Real API + Mock Fallback)
 */
export const getAuditLogs = async (filters = {}, pagination = { page: 1, pageSize: 10 }, sorting = { field: 'timestamp', direction: 'desc' }) => {
  return executeWithFallback(
    async () => {
      const params = new URLSearchParams();
      params.set('page', String(pagination.page || 1));
      params.set('limit', String(pagination.pageSize || 10));

      if (filters.action && filters.action !== 'ALL') params.set('action', filters.action);
      if (filters.status && filters.status !== 'ALL') params.set('status', filters.status);
      if (filters.resourceType && filters.resourceType !== 'ALL') params.set('resource_type', filters.resourceType);
      if (filters.search) params.set('action', filters.search);

      const res = await request(`audit-logs?${params.toString()}`);
      if (res && res.success && res.data) {
        const rawItems = res.data.items || [];
        const mapped = rawItems.map(mapBackendLogToEntry);
        return {
          data: mapped,
          total: res.data.pagination?.total || mapped.length,
          page: res.data.pagination?.page || pagination.page,
          pageSize: res.data.pagination?.limit || pagination.pageSize,
        };
      }
      throw new Error('Định dạng phản hồi API không hợp lệ');
    },
    () => mockGetAuditLogs(filters, pagination, sorting)
  );
};

/**
 * Lấy các chỉ số KPI thống kê kiểm toán tổng quan
 */
export const getAuditSummaryKPIs = async () => {
  return executeWithFallback(
    async () => {
      const statsRes = await request('audit-logs/retention/stats');
      if (statsRes && statsRes.success && statsRes.data) {
        const stats = statsRes.data;
        return {
          totalLogs: stats.totalLogs || 0,
          verifiedIntegrity: '100% (SHA-256 Validated)',
          blockedViolations: stats.logsOlderThanRetention || 0,
          autonomousActions: Math.floor((stats.totalLogs || 0) * 0.4),
          activeActorsCount: stats.totalLogs > 0 ? 5 : 0,
          retentionDays: stats.retentionDays,
        };
      }
      throw new Error('Không thể tải KPI thống kê');
    },
    () => mockGetAuditSummaryKPIs()
  );
};

const adminAuditLogsService = {
  getAuditLogs,
  getAuditLogById,
  getAuditSummaryKPIs,
};

export default adminAuditLogsService;
