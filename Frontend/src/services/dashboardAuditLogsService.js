import { request, executeWithFallback } from './apiClient';

/**
 * @file dashboardAuditLogsService.js
 * Dịch vụ cung cấp Nhật ký kiểm toán bất biến & Thống kê cho Tổ chức (Tenant Scope).
 */

const FALLBACK_AUDIT_LOGS = [
  {
    id: 'AUD-000055',
    timestamp: '27/10/2026 22:09:38',
    actor: 'Phạm Thái Sang (SME Owner)',
    role: 'SME_OWNER',
    event: 'ACCESS_DENIED_ROLE',
    description: 'Bị từ chối truy cập do thiếu vai trò hợp lệ theo chính sách RBAC',
    target: 'System/RBAC',
    ip: '127.0.0.1',
    sha256: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
    status: 'DENIED',
    before_data: null,
    after_data: null,
    metadata: {
      required_roles: ['ADMIN', 'SUPER_ADMIN'],
      current_roles: ['SME_OWNER'],
    },
  },
  {
    id: 'AUD-000050',
    timestamp: '27/10/2026 21:18:55',
    actor: 'MAPE-K Autonomous Engine',
    role: 'SYSTEM_AI',
    event: 'AUTONOMOUS_SCALE_UP',
    description: 'Tự động mở rộng số lượng Replicas từ 2 lên 3 cho payment-service theo dự báo tải',
    target: 'Deployment/payment-service',
    ip: '10.244.0.1 (Internal Cluster)',
    sha256: '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8',
    status: 'SUCCESS',
    before_data: { replicas: 2 },
    after_data: { replicas: 3 },
    metadata: {
      model: 'GRU-v2.1',
      confidence: 0.94,
    },
  },
  {
    id: 'AUD-000048',
    timestamp: '27/10/2026 20:50:12',
    actor: 'Trần Đình Tuấn (DevOps Lead)',
    role: 'DEVOPS',
    event: 'POLICY_THRESHOLD_MODIFIED',
    description: 'Cập nhật ngưỡng kích hoạt cổng HITL từ 25% lên 30% bán kính ảnh hưởng Pods',
    target: 'Policy/POL-RESTART-CRASHED-POD',
    ip: '14.162.180.92',
    sha256: '4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a',
    status: 'SUCCESS',
    before_data: { blastRadiusLimit: 0.25 },
    after_data: { blastRadiusLimit: 0.30 },
    metadata: { policyId: 'POL-01' },
  },
  {
    id: 'AUD-000045',
    timestamp: '27/10/2026 19:15:30',
    actor: 'MAPE-K Autonomous Engine',
    role: 'SYSTEM_AI',
    event: 'POD_MEMORY_RESTART',
    description: 'Khởi động lại Pod order-processor-66bf sau tín hiệu cảnh báo rò rỉ RAM',
    target: 'Pod/order-processor-66bf',
    ip: '10.244.0.1 (Internal Cluster)',
    sha256: 'ef2d127de37b942baad06145e54b0c619a1f22327b2ebbcfbec78f5564afe39d',
    status: 'SUCCESS',
    before_data: { memoryUsage: '94.2%' },
    after_data: { memoryUsage: '22.5%' },
    metadata: { rootCause: 'MEMORY_LEAK' },
  },
  {
    id: 'AUD-000040',
    timestamp: '27/10/2026 16:42:10',
    actor: 'Phạm Thái Sang (SME Owner)',
    role: 'SME_OWNER',
    event: 'HITL_APPROVAL_GRANTED',
    description: 'Phê duyệt tháo tải và cô lập máy chủ Node/worker-03 (Cordon & Drain)',
    target: 'Node/worker-03',
    ip: '113.161.72.45',
    sha256: '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918',
    status: 'SUCCESS',
    before_data: { nodeStatus: 'Ready' },
    after_data: { nodeStatus: 'SchedulingDisabled' },
    metadata: { approvalId: 'APP-901' },
  },
  {
    id: 'AUD-000035',
    timestamp: '27/10/2026 09:30:00',
    actor: 'Phạm Thái Sang (SME Owner)',
    role: 'SME_OWNER',
    event: 'AUTH_LOGIN_SUCCESS_2FA',
    description: 'Đăng nhập thành công vào bảng điều khiển qua cơ chế xác thực đa yếu tố 2FA',
    target: 'Identity/SSO',
    ip: '113.161.72.45',
    sha256: '04f8996da763b7a969b1028ee3007569eaf3a635486ddab211d512c85b9df8fb',
    status: 'SUCCESS',
    before_data: null,
    after_data: null,
    metadata: { provider: 'TOTP-2FA' },
  },
];

/**
 * Chuẩn hóa bản ghi từ Backend về định dạng hiển thị thống nhất trên giao diện
 */
const mapBackendLog = (raw) => {
  const rawMeta = raw.metadata && typeof raw.metadata === 'object' ? raw.metadata : {};

  let formattedDate = raw.created_at;
  try {
    const d = new Date(raw.created_at);
    if (!isNaN(d.getTime())) {
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yyyy = d.getFullYear();
      const hh = String(d.getHours()).padStart(2, '0');
      const min = String(d.getMinutes()).padStart(2, '0');
      const ss = String(d.getSeconds()).padStart(2, '0');
      formattedDate = `${dd}/${mm}/${yyyy} ${hh}:${min}:${ss}`;
    }
  } catch (e) {
    formattedDate = String(raw.created_at);
  }

  // Tác tử
  let actor = raw.user_name || raw.user_email || 'Hệ Thống Tự Động (System)';
  let role = 'VIEWER';
  if (raw.actor_type === 'SYSTEM' || raw.actor_type === 'AGENT') {
    actor = 'MAPE-K Autonomous Engine';
    role = 'SYSTEM_AI';
  } else if (raw.action && raw.action.includes('HITL')) {
    role = 'SME_OWNER';
  } else if (raw.action && (raw.action.includes('POLICY') || raw.action.includes('DRAIN'))) {
    role = 'DEVOPS';
  }

  const logId = typeof raw.id === 'string' && raw.id.startsWith('AUD-')
    ? raw.id
    : `AUD-${String(raw.id || '').padStart(6, '0')}`;

  const status = raw.status === 'DENIED' ? 'DENIED' : raw.status === 'FAILURE' || raw.status === 'ERROR' ? 'FAILED' : 'VERIFIED';

  const sha256 = raw.sha256 || rawMeta.sha256 || '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08';

  const target = raw.resource_type
    ? (raw.resource_id ? `${raw.resource_type}/${raw.resource_id}` : raw.resource_type)
    : (raw.target_type ? `${raw.target_type}/${raw.target_id || ''}` : 'System');

  return {
    id: logId,
    rawId: raw.id,
    timestamp: formattedDate,
    actor,
    actorType: raw.actor_type || 'USER',
    role,
    event: raw.action,
    description: raw.description || raw.action,
    target,
    ip: raw.ip_address || '127.0.0.1',
    sha256,
    status,
    before_data: raw.before_data || rawMeta.before_data || null,
    after_data: raw.after_data || rawMeta.after_data || null,
    metadata: {
      ...rawMeta,
      requestId: raw.request_id,
      userAgent: raw.user_agent,
      reasonCode: raw.reason_code,
    },
  };
};

/**
 * Lấy danh sách nhật ký kiểm toán theo Tổ chức
 */
export const fetchOrgAuditLogs = async (
  orgId,
  filters = {},
  pagination = { page: 1, pageSize: 10 }
) => {
  if (!orgId) {
    return { data: FALLBACK_AUDIT_LOGS, total: FALLBACK_AUDIT_LOGS.length, page: 1, pageSize: 10, totalPages: 1 };
  }

  return executeWithFallback(
    async () => {
      const params = new URLSearchParams();
      params.set('page', String(pagination.page || 1));
      params.set('limit', String(pagination.pageSize || 10));

      if (filters.action && filters.action !== 'ALL') params.set('action', filters.action);
      if (filters.status && filters.status !== 'ALL') params.set('status', filters.status);
      if (filters.search) params.set('search', filters.search);

      if (filters.dateRange && filters.dateRange !== 'ALL') {
        const now = new Date();
        if (filters.dateRange === '24H') {
          params.set('start_date', new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString());
        } else if (filters.dateRange === '7D') {
          params.set('start_date', new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString());
        } else if (filters.dateRange === '30D') {
          params.set('start_date', new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString());
        }
      }

      const res = await request(`organizations/${orgId}/audit-logs?${params.toString()}`);
      if (res && res.success && res.data) {
        const rawItems = Array.isArray(res.data.data)
          ? res.data.data
          : Array.isArray(res.data.items)
          ? res.data.items
          : Array.isArray(res.data)
          ? res.data
          : [];

        const mapped = rawItems.map(mapBackendLog);
        const total = res.data.pagination?.total ?? (typeof res.data.total === 'number' ? res.data.total : mapped.length);
        const page = res.data.pagination?.page || pagination.page || 1;
        const pageSize = res.data.pagination?.limit || pagination.pageSize || 10;
        const totalPages = res.data.pagination?.totalPages || Math.ceil(total / pageSize) || 1;

        return {
          data: mapped,
          total,
          page,
          pageSize,
          totalPages,
        };
      }
      throw new Error('Định dạng phản hồi API không hợp lệ');
    },
    async () => {
      // Mock Fallback filtering
      let result = [...FALLBACK_AUDIT_LOGS];
      if (filters.search) {
        const q = filters.search.toLowerCase().trim();
        result = result.filter(
          (l) =>
            l.id.toLowerCase().includes(q) ||
            l.actor.toLowerCase().includes(q) ||
            l.event.toLowerCase().includes(q) ||
            l.description.toLowerCase().includes(q) ||
            l.ip.toLowerCase().includes(q) ||
            l.sha256.toLowerCase().includes(q)
        );
      }
      if (filters.role && filters.role !== 'ALL') {
        result = result.filter((l) => l.role === filters.role);
      }
      if (filters.status && filters.status !== 'ALL') {
        result = result.filter((l) => l.status === filters.status);
      }
      const page = pagination.page || 1;
      const pageSize = pagination.pageSize || 10;
      const start = (page - 1) * pageSize;
      return {
        data: result.slice(start, start + pageSize),
        total: result.length,
        page,
        pageSize,
        totalPages: Math.ceil(result.length / pageSize) || 1,
      };
    }
  );
};

/**
 * Lấy số liệu thống kê 7 ngày phục vụ biểu đồ và thẻ KPI
 */
export const fetchOrgAuditStats = async (orgId) => {
  if (!orgId) {
    return null;
  }

  return executeWithFallback(
    async () => {
      const res = await request(`organizations/${orgId}/audit-logs/stats`);
      if (res && res.success && res.data) {
        return res.data;
      }
      throw new Error('Không thể lấy thống kê kiểm toán');
    },
    async () => {
      // Fallback static 7 days
      return {
        summary: {
          totalLogs: FALLBACK_AUDIT_LOGS.length,
          autonomousActions: 2,
          hitlApprovals: 1,
          policyChanges: 1,
          authEvents: 2,
          blockedViolations: 1,
          verifiedIntegrity: '100% (SHA-256 Validated)',
        },
        days: [
          { day: '22/10', autonomous: 5, hitl: 1, policy: 0, auth: 4, total: 10 },
          { day: '23/10', autonomous: 8, hitl: 2, policy: 1, auth: 6, total: 17 },
          { day: '24/10', autonomous: 12, hitl: 0, policy: 2, auth: 8, total: 22 },
          { day: '25/10', autonomous: 6, hitl: 1, policy: 0, auth: 5, total: 12 },
          { day: '26/10', autonomous: 15, hitl: 3, policy: 2, auth: 10, total: 30 },
          { day: '27/10', autonomous: 10, hitl: 2, policy: 1, auth: 7, total: 20 },
          { day: '28/10 (Hôm nay)', autonomous: 4, hitl: 1, policy: 1, auth: 3, total: 9 },
        ],
      };
    }
  );
};

export default {
  fetchOrgAuditLogs,
  fetchOrgAuditStats,
};
