import { request } from './apiClient';

/**
 * @file dashboardAuditLogsService.js
 * Dịch vụ cung cấp Nhật ký kiểm toán bất biến & Thống kê cho Tổ chức (Tenant Scope)
 * từ API thực tế của Main Backend (không sử dụng dữ liệu cứng / mock fallback).
 */

const getLocalTodayStr = () => {
  const now = new Date();
  const yr = now.getFullYear();
  const mo = String(now.getMonth() + 1).padStart(2, '0');
  const dy = String(now.getDate()).padStart(2, '0');
  return `${yr}-${mo}-${dy}`;
};

/**
 * Chuẩn hóa bản ghi từ Backend về định dạng hiển thị thống nhất trên giao diện
 */
export const mapBackendLog = (raw) => {
  const rawMeta = raw?.metadata && typeof raw.metadata === 'object' ? raw.metadata : {};

  let formattedDate = raw?.created_at || raw?.timestamp || '';
  try {
    const d = new Date(raw?.created_at || raw?.timestamp);
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
    formattedDate = String(raw?.created_at || '');
  }

  const actorType = String(raw?.actor_type || raw?.actorType || 'USER').toUpperCase();

  let actor;
  if (actorType === 'AGENT') {
    actor =
      rawMeta.agent_name ||
      raw?.agent_name ||
      raw?.user_name ||
      raw?.actor ||
      (raw?.resource_id ? `Agent (${String(raw.resource_id).substring(0, 8)}...)` : 'Agent K8s');
  } else if (actorType === 'SYSTEM') {
    actor =
      rawMeta.actor_name ||
      rawMeta.engine_name ||
      rawMeta.triggered_by ||
      raw?.user_name ||
      raw?.actor ||
      'Hệ thống AI (MAPE-K)';
  } else {
    actor =
      raw?.user_name ||
      raw?.actor ||
      raw?.user_email ||
      rawMeta.executed_by ||
      rawMeta.approved_by ||
      rawMeta.email ||
      (raw?.user_id ? `User (${String(raw.user_id).substring(0, 8)}...)` : 'Người dùng chưa xác định');
  }

  const rawRole = raw?.actor_role || raw?.role || raw?.member_role || null;
  let role = rawRole ? String(rawRole).toUpperCase() : null;
  if (actorType === 'AGENT') {
    role = 'AGENT';
  } else if (actorType === 'SYSTEM') {
    role = 'SYSTEM_AI';
  } else if (!role && raw?.user_id) {
    role = 'USER';
  }

  const logId =
    typeof raw?.id === 'string' && raw.id.startsWith('AUD-')
      ? raw.id
      : `AUD-${String(raw?.id || '').padStart(6, '0')}`;

  const rawStatus = String(raw?.status || '').toUpperCase();
  let status = rawStatus || 'UNKNOWN';
  if (rawStatus === 'FAILURE' || rawStatus === 'FAILED' || rawStatus === 'ERROR') {
    status = 'FAILED';
  } else if (rawStatus === 'DENIED' || rawStatus === 'BLOCKED') {
    status = 'DENIED';
  } else if (rawStatus === 'SUCCESS' || rawStatus === 'VERIFIED') {
    status = 'SUCCESS';
  }

  const sha256 = raw?.sha256 || rawMeta.sha256 || null;

  let target = '-';
  const metaTargetService =
    rawMeta.target_name ||
    raw?.healing_target_name ||
    rawMeta.target_service ||
    rawMeta.service_id ||
    rawMeta.pod_name ||
    rawMeta.node_name;
  const resolvedPolicyName = rawMeta.policy_name || raw?.policy_name;
  const resolvedClusterId = raw?.cluster_id || rawMeta.cluster_id || null;
  const resolvedClusterName = rawMeta.cluster_name || raw?.cluster_name;
  const rawServiceName =
    raw?.service_name ||
    raw?.healing_target_name ||
    rawMeta.target_service ||
    rawMeta.service_id ||
    rawMeta.target_name ||
    rawMeta.pod_name ||
    null;
  const resolvedServiceName =
    typeof rawServiceName === 'string' && rawServiceName.trim() !== '' ? rawServiceName.trim() : null;
  const resolvedAgentName = rawMeta.agent_name || raw?.agent_name;
  const resolvedTargetUser =
    raw?.target_user_name ||
    raw?.target_user_email ||
    rawMeta.target_email;

  if (metaTargetService) {
    target = rawMeta.namespace ? `${rawMeta.namespace}/${metaTargetService}` : metaTargetService;
  } else if (
    resolvedPolicyName &&
    (raw?.resource_type === 'POLICY' || raw?.target_type === 'POLICY' || !raw?.resource_type || raw?.resource_type === 'HEALING_ACTION')
  ) {
    target = resolvedPolicyName;
  } else if (raw?.resource_type === 'AGENT' && resolvedAgentName) {
    target = resolvedAgentName;
  } else if (raw?.resource_type === 'CLUSTER' && resolvedClusterName) {
    target = resolvedClusterName;
  } else if (raw?.target_type === 'AGENT' && resolvedAgentName) {
    target = resolvedAgentName;
  } else if ((raw?.target_type === 'USER' || raw?.resource_type === 'USER') && resolvedTargetUser) {
    target = resolvedTargetUser;
  } else if (resolvedPolicyName) {
    target = resolvedPolicyName;
  } else if (resolvedClusterName) {
    target = resolvedClusterName;
  } else if (resolvedAgentName) {
    target = resolvedAgentName;
  } else if (raw?.resource_type === 'ORGANIZATION' && (rawMeta.organization_name || raw?.organization_name)) {
    target = rawMeta.organization_name || raw.organization_name;
  } else if (raw?.resource_type) {
    if (raw.resource_type === 'HEALING_ACTION') {
      target =
        rawMeta.action_code ||
        rawMeta.action_type ||
        (raw.resource_id ? `HEALING_ACTION/${String(raw.resource_id).substring(0, 8)}...` : 'HEALING_ACTION');
    } else if (raw.resource_id && typeof raw.resource_id === 'string' && raw.resource_id.length > 18) {
      target = `${raw.resource_type}/${raw.resource_id.substring(0, 8)}...`;
    } else {
      target = raw.resource_id ? `${raw.resource_type}/${raw.resource_id}` : raw.resource_type;
    }
  } else if (raw?.target_type) {
    target =
      raw.target_id && typeof raw.target_id === 'string' && raw.target_id.length > 18
        ? `${raw.target_type}/${raw.target_id.substring(0, 8)}...`
        : raw.target_id
        ? `${raw.target_type}/${raw.target_id}`
        : raw.target_type;
  } else if (rawMeta.organization_name || raw?.organization_name) {
    target = rawMeta.organization_name || raw.organization_name;
  } else if (rawMeta.email) {
    target = rawMeta.email;
  } else if (rawMeta.path) {
    target = rawMeta.method ? `${rawMeta.method} ${rawMeta.path}` : rawMeta.path;
  }

  const rawIp = raw?.ip_address || raw?.ip || null;
  const ip = rawIp ? String(rawIp).replace('/32', '') : null;

  return {
    id: logId,
    rawId: raw?.id,
    timestamp: formattedDate,
    created_at: raw?.created_at,
    raw_created_at: raw?.created_at,
    rawItem: raw,
    actor,
    actorEmail: raw?.user_email || rawMeta.email || null,
    actorType,
    role,
    organizationName: raw?.organization_name || rawMeta.organization_name || null,
    clusterId: resolvedClusterId,
    clusterName: resolvedClusterName || null,
    serviceName: resolvedServiceName,
    event: raw?.action || '',
    description: raw?.description || raw?.action || '',
    target,
    resourceType: raw?.resource_type || null,
    resourceId: raw?.resource_id ? String(raw.resource_id) : null,
    targetType: raw?.target_type || null,
    targetId: raw?.target_id ? String(raw.target_id) : null,
    targetUserEmail: raw?.target_user_email || rawMeta.target_email || null,
    ip,
    sha256,
    status,
    before_data:
      raw?.before_data !== undefined
        ? raw.before_data
        : rawMeta.before_data !== undefined
        ? rawMeta.before_data
        : null,
    after_data:
      raw?.after_data !== undefined
        ? raw.after_data
        : rawMeta.after_data !== undefined
        ? rawMeta.after_data
        : null,
    metadata: {
      ...(raw?.cluster_name && !rawMeta.cluster_name ? { cluster_name: raw.cluster_name } : {}),
      ...(raw?.policy_name && !rawMeta.policy_name ? { policy_name: raw.policy_name } : {}),
      ...(raw?.agent_name && !rawMeta.agent_name ? { agent_name: raw.agent_name } : {}),
      ...rawMeta,
      requestId: raw?.request_id || null,
      userAgent: raw?.user_agent || rawMeta.userAgent || null,
      reasonCode: raw?.reason_code || null,
    },
  };
};

/**
 * Lấy danh sách nhật ký kiểm toán thực tế theo Tổ chức
 */
export const fetchOrgAuditLogs = async (
  orgId,
  filters = {},
  pagination = { page: 1, pageSize: 10 }
) => {
  const requestedPage = pagination.page || 1;
  const requestedPageSize = pagination.pageSize || 10;

  if (!orgId) {
    return {
      data: [],
      total: 0,
      page: requestedPage,
      pageSize: requestedPageSize,
      totalPages: 1,
    };
  }

  const params = new URLSearchParams();
  params.set('page', String(requestedPage));
  params.set('limit', String(requestedPageSize));

  if (filters.action && filters.action !== 'ALL') params.set('action', filters.action);
  if (filters.status && filters.status !== 'ALL') params.set('status', filters.status);
  if (filters.role && filters.role !== 'ALL') params.set('role', filters.role);
  if (filters.cluster_id && filters.cluster_id !== 'ALL') params.set('cluster_id', filters.cluster_id);
  if (filters.service_name && filters.service_name !== 'ALL') params.set('service_name', filters.service_name);
  if (filters.search) params.set('search', filters.search);

  let startDate = null;
  let endDate = null;

  if (filters.start_date && filters.end_date) {
    startDate = filters.start_date;
    endDate = filters.end_date;
  } else if (filters.timeFilterMode === 'today') {
    const [y, m, d] = getLocalTodayStr().split('-').map(Number);
    startDate = new Date(y, m - 1, d, 0, 0, 0, 0).toISOString();
    endDate = new Date(y, m - 1, d, 23, 59, 59, 999).toISOString();
  } else if (filters.timeFilterMode === 'date') {
    const targetDate = filters.selectedDate || getLocalTodayStr();
    const [y, m, d] = targetDate.split('-').map(Number);
    startDate = new Date(y, m - 1, d, 0, 0, 0, 0).toISOString();
    endDate = new Date(y, m - 1, d, 23, 59, 59, 999).toISOString();
  } else if (filters.timeFilterMode === 'month') {
    const now = new Date();
    const fallbackMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const targetMonth = filters.selectedMonth || fallbackMonth;
    const [y, m] = targetMonth.split('-').map(Number);
    startDate = new Date(y, m - 1, 1, 0, 0, 0, 0).toISOString();
    endDate = new Date(y, m, 0, 23, 59, 59, 999).toISOString();
  } else if (filters.timeFilterMode === 'year') {
    const y = Number(filters.selectedYear || new Date().getFullYear());
    startDate = new Date(y, 0, 1, 0, 0, 0, 0).toISOString();
    endDate = new Date(y, 11, 31, 23, 59, 59, 999).toISOString();
  } else if (filters.dateRange && filters.dateRange !== 'ALL') {
    const now = new Date();
    if (filters.dateRange === '24H') {
      startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    } else if (filters.dateRange === '7D') {
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    } else if (filters.dateRange === '30D') {
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    }
  }

  if (startDate) params.set('start_date', startDate);
  if (endDate) params.set('end_date', endDate);

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
    const total =
      res.data.pagination?.total ??
      (typeof res.data.total === 'number' ? res.data.total : mapped.length);
    const page = res.data.pagination?.page || requestedPage;
    const pageSize = res.data.pagination?.limit || requestedPageSize;
    const totalPages = res.data.pagination?.totalPages || Math.ceil(total / pageSize) || 1;

    return {
      data: mapped,
      total,
      page,
      pageSize,
      totalPages,
    };
  }
  throw new Error('Định dạng phản hồi API nhật ký kiểm toán không hợp lệ');
};

/**
 * Lấy số liệu thống kê thực tế phục vụ KPI & đối chiếu biểu đồ từ backend
 */
export const fetchOrgAuditStats = async (orgId) => {
  if (!orgId) {
    return null;
  }

  const res = await request(`organizations/${orgId}/audit-logs/stats`);
  if (res && res.success && res.data) {
    return res.data;
  }
  throw new Error('Không thể lấy thống kê nhật ký kiểm toán từ máy chủ');
};

/**
 * Xác thực tính toàn vẹn sổ cái kiểm toán từ backend
 */
export const verifyOrgAuditIntegrity = async (orgId) => {
  if (!orgId) {
    return null;
  }

  const res = await request(`organizations/${orgId}/audit-logs/verify`);
  if (res && res.success && res.data) {
    return res.data;
  }
  throw new Error('Không thể xác thực tính toàn vẹn sổ cái từ máy chủ');
};

const dashboardAuditLogsService = {
  mapBackendLog,
  fetchOrgAuditLogs,
  fetchOrgAuditStats,
  verifyOrgAuditIntegrity,
};

export default dashboardAuditLogsService;
