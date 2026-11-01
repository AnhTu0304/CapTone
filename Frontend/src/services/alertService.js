/**
 * @file alertService.js
 * @description Real Backend API Client for Alert Management, History, Assignment & Audit Trail [S5][PBI21 & PBI22].
 */

import { request } from './apiClient';

export const DEFAULT_RULE_METADATA = {
  metric_types: [
    { code: 'CPU', label: 'CPU Usage (Mức sử dụng CPU)', category: 'RESOURCE', units: ['%', 'cores', 'millicores'], default_unit: '%' },
    { code: 'RAM', label: 'RAM Usage (Mức sử dụng Bộ nhớ)', category: 'RESOURCE', units: ['%', 'Bytes', 'KB', 'MB', 'GB'], default_unit: '%' },
    { code: 'DISK', label: 'Disk Usage (Dung lượng Lưu trữ)', category: 'RESOURCE', units: ['%', 'Bytes', 'KB', 'MB', 'GB'], default_unit: '%' },
    { code: 'NETWORK_RECEIVE', label: 'Network Receive Rate (Băng thông nhận RX)', category: 'RESOURCE', units: ['B/s', 'KB/s', 'MB/s', 'GB/s'], default_unit: 'MB/s' },
    { code: 'NETWORK_TRANSMIT', label: 'Network Transmit Rate (Băng thông gửi TX)', category: 'RESOURCE', units: ['B/s', 'KB/s', 'MB/s', 'GB/s'], default_unit: 'MB/s' },
    { code: 'HTTP_5XX_RATE', label: 'HTTP 5xx Error Rate (Tỷ lệ lỗi máy chủ 5xx)', category: 'APM', units: ['%', 'req/s'], default_unit: '%' },
    { code: 'ERROR_RATE', label: 'Application Error Rate (Tỷ lệ lỗi ứng dụng)', category: 'APM', units: ['%'], default_unit: '%' },
    { code: 'LATENCY', label: 'Response Latency (Độ trễ phản hồi)', category: 'APM', units: ['ms', 's'], default_unit: 'ms' },
    { code: 'REQUEST_RATE', label: 'Request Throughput (Lưu lượng truy cập)', category: 'APM', units: ['req/s', 'rpm'], default_unit: 'req/s' },
    { code: 'POD_CRASH_LOOP', label: 'Pod CrashLoopBackOff (Khởi động lại liên tục)', category: 'KUBERNETES', units: ['count', 'restarts'], default_unit: 'restarts' },
    { code: 'POD_FAILED', label: 'Pod Failed State (Pod lỗi khởi chạy)', category: 'KUBERNETES', units: ['count'], default_unit: 'count' },
    { code: 'CONTAINER_OOM', label: 'Container OOMKilled (Tràn bộ nhớ Container)', category: 'KUBERNETES', units: ['count'], default_unit: 'count' },
    { code: 'NODE_NOT_READY', label: 'Node NotReady (Máy chủ K8s mất sẵn sàng)', category: 'KUBERNETES', units: ['count', 'status'], default_unit: 'count' },
    { code: 'DEPLOYMENT_UNAVAILABLE', label: 'Deployment Unavailable (Thiếu hụt Replica)', category: 'KUBERNETES', units: ['count', 'replicas'], default_unit: 'replicas' },
  ],
  operators: [
    { code: 'GREATER_THAN', symbol: '>', label: 'Lớn hơn (>)' },
    { code: 'GREATER_THAN_OR_EQUAL', symbol: '>=', label: 'Lớn hơn hoặc bằng (>=)' },
    { code: 'LESS_THAN', symbol: '<', label: 'Nhỏ hơn (<)' },
    { code: 'LESS_THAN_OR_EQUAL', symbol: '<=', label: 'Nhỏ hơn hoặc bằng (<=)' },
    { code: 'EQUAL', symbol: '=', label: 'Bằng (=)' },
    { code: 'NOT_EQUAL', symbol: '!=', label: 'Khác (!=)' },
  ],
  severities: [
    { code: 'INFO', label: 'INFO — Thông tin' },
    { code: 'WARNING', label: 'WARNING — Cảnh báo' },
    { code: 'CRITICAL', label: 'CRITICAL — Khẩn cấp' },
  ],
  evaluation_windows: ['30s', '1m', '5m', '15m', '30m', '1h', '6h', '24h'],
  units_map: {
    CPU: ['%', 'cores', 'millicores'],
    RAM: ['%', 'Bytes', 'KB', 'MB', 'GB'],
    DISK: ['%', 'Bytes', 'KB', 'MB', 'GB'],
    NETWORK_RECEIVE: ['B/s', 'KB/s', 'MB/s', 'GB/s'],
    NETWORK_TRANSMIT: ['B/s', 'KB/s', 'MB/s', 'GB/s'],
    HTTP_5XX_RATE: ['%', 'req/s'],
    ERROR_RATE: ['%'],
    LATENCY: ['ms', 's'],
    REQUEST_RATE: ['req/s', 'rpm'],
    POD_CRASH_LOOP: ['count', 'restarts'],
    POD_FAILED: ['count'],
    CONTAINER_OOM: ['count'],
    NODE_NOT_READY: ['count', 'status'],
    DEPLOYMENT_UNAVAILABLE: ['count', 'replicas'],
  },
};

export function formatAlertApiError(err, fallbackMsg = 'Đã xảy ra lỗi khi xử lý yêu cầu cảnh báo') {
  const status = err?.status;
  if (status === 401) {
    return 'Phiên đăng nhập đã hết hạn (401). Vui lòng đăng nhập lại.';
  }
  if (status === 403) {
    return 'Từ chối truy cập (403): Bạn không có quyền thực hiện thao tác này.';
  }
  if (status === 404) {
    return err?.message || 'Không tìm thấy cảnh báo hoặc bạn không có quyền truy cập (404).';
  }
  if (status === 409) {
    return `Xung đột trạng thái (409): ${err?.message || 'Cảnh báo đã bị thay đổi bởi thao tác khác. Vui lòng tải lại dữ liệu.'}`;
  }
  if (status === 400) {
    return err?.message || 'Dữ liệu đầu vào không hợp lệ (400).';
  }
  return err?.message || fallbackMsg;
}

function buildQueryString(params = {}) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, val]) => {
    if (val !== undefined && val !== null && val !== '' && val !== 'ALL') {
      searchParams.append(key, String(val));
    }
  });
  const qs = searchParams.toString();
  return qs ? `?${qs}` : '';
}

export const alertService = {
  /**
   * GET /api/v1/alerts/summary
   */
  async getAlertSummary(params = {}) {
    const qs = buildQueryString(params);
    const res = await request(`/alerts/summary${qs}`);
    return res?.data || res;
  },

  /**
   * GET /api/v1/alerts
   */
  async getAlerts(params = {}) {
    const qs = buildQueryString(params);
    const res = await request(`/alerts${qs}`);
    const payload = res?.data || res;
    return {
      items: Array.isArray(payload?.items) ? payload.items : [],
      pagination: payload?.pagination || {
        page: Number(params.page || 1),
        limit: Number(params.limit || 10),
        total: 0,
        total_pages: 1,
      },
    };
  },

  /**
   * GET /api/v1/alerts/:id
   */
  async getAlertById(alertId) {
    if (!alertId) throw new Error('Thiếu ID cảnh báo');
    const res = await request(`/alerts/${encodeURIComponent(alertId)}`);
    return res?.data || res;
  },

  /**
   * GET /api/v1/alerts/history
   * Query alert history with filters, search, sorting and pagination [S5][PBI22 Task 4.2 & 4.4]
   */
  async getAlertHistory(params = {}) {
    const qs = buildQueryString(params);
    const res = await request(`/alerts/history${qs}`);
    const items = Array.isArray(res?.data) ? res.data : Array.isArray(res?.items) ? res.items : [];
    const p = res?.pagination || {};
    const limit = Number(p.limit ?? params.limit ?? 10);
    const total = Number(p.total ?? items.length);
    const totalPages = Number(p.total_pages ?? p.totalPages ?? (Math.ceil(total / limit) || 1));
    return {
      items,
      pagination: {
        page: Number(p.page ?? params.page ?? 1),
        limit,
        total,
        total_pages: totalPages,
        totalPages,
      },
    };
  },

  /**
   * GET /api/v1/alerts/history/summary
   */
  async getAlertHistorySummary(params = {}) {
    const qs = buildQueryString(params);
    const res = await request(`/alerts/history/summary${qs}`);
    return res?.data || res;
  },

  /**
   * GET /api/v1/alerts/history/:id/timeline
   */
  async getAlertTimeline(alertId) {
    if (!alertId) throw new Error('Thiếu ID cảnh báo');
    const res = await request(`/alerts/history/${encodeURIComponent(alertId)}/timeline`);
    return Array.isArray(res?.timeline) ? res.timeline : [];
  },

  /**
   * GET /api/v1/alerts/:id/audit-trail
   * Paginated audit trail with actor, old_value, new_value, note [S5][PBI22 Task 4.3 & 4.4]
   */
  async getAlertAuditTrail(alertId, params = { page: 1, limit: 50, order: 'asc' }) {
    if (!alertId) throw new Error('Thiếu ID cảnh báo');
    const qs = buildQueryString(params);
    const res = await request(`/alerts/${encodeURIComponent(alertId)}/audit-trail${qs}`);
    const payload = res?.data || res;
    const items = Array.isArray(payload?.items)
      ? payload.items
      : Array.isArray(payload)
      ? payload
      : [];
    return {
      items,
      pagination: payload?.pagination || {
        page: 1,
        limit: items.length || 20,
        total: items.length,
        total_pages: 1,
      },
    };
  },

  /**
   * GET /api/v1/organizations/:orgId/members?status=ACTIVE&limit=100
   * Real active organization members for assignment (no mock fallback)
   */
  async getAssignableMembers(orgId) {
    if (!orgId) return [];
    const res = await request(
      `/organizations/${encodeURIComponent(orgId)}/members?status=ACTIVE&limit=100`
    );
    const payload = res?.data || res;
    const rawItems = Array.isArray(payload?.items) ? payload.items : Array.isArray(payload) ? payload : [];
    return rawItems
      .filter((m) => !m.status || String(m.status).toUpperCase() === 'ACTIVE')
      .map((m) => ({
        id: m.user_id || m.user?.id || m.id,
        full_name: m.full_name || m.user?.full_name || m.email || m.user?.email || 'Thành viên',
        email: m.email || m.user?.email || '',
        role: m.role_code || m.role?.code || m.role || '',
      }))
      .filter((m) => Boolean(m.id));
  },

  /**
   * PATCH /api/v1/alerts/:id/assign
   */
  async assignAlert(alertId, { assignedTo, note = '', expectedVersion } = {}) {
    if (!alertId) throw new Error('Thiếu ID cảnh báo');
    const body = { assignedTo };
    if (note && String(note).trim()) body.note = String(note).trim();
    if (expectedVersion !== undefined && expectedVersion !== null) {
      body.expectedVersion = Number(expectedVersion);
    }
    const res = await request(`/alerts/${encodeURIComponent(alertId)}/assign`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
    return res?.data || res;
  },

  /**
   * PATCH /api/v1/alerts/:id/unassign
   */
  async unassignAlert(alertId, { note = '', expectedVersion } = {}) {
    if (!alertId) throw new Error('Thiếu ID cảnh báo');
    const body = {};
    if (note && String(note).trim()) body.note = String(note).trim();
    if (expectedVersion !== undefined && expectedVersion !== null) {
      body.expectedVersion = Number(expectedVersion);
    }
    const res = await request(`/alerts/${encodeURIComponent(alertId)}/unassign`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
    return res?.data || res;
  },

  /**
   * PATCH /api/v1/alerts/:id/acknowledge
   */
  async acknowledgeAlert(alertId, note = '', expectedVersion) {
    if (!alertId) throw new Error('Thiếu ID cảnh báo');
    const body = {};
    if (note && String(note).trim()) body.note = String(note).trim();
    if (expectedVersion !== undefined && expectedVersion !== null) {
      body.expectedVersion = Number(expectedVersion);
    }
    const res = await request(`/alerts/${encodeURIComponent(alertId)}/acknowledge`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
    return res?.data || res;
  },

  /**
   * PATCH /api/v1/alerts/:id/resolve
   */
  async resolveAlert(alertId, resolutionNote = '', expectedVersion) {
    if (!alertId) throw new Error('Thiếu ID cảnh báo');
    const body = {};
    if (resolutionNote && String(resolutionNote).trim()) {
      const cleanNote = String(resolutionNote).trim();
      body.resolutionNote = cleanNote;
      body.resolution_note = cleanNote;
    }
    if (expectedVersion !== undefined && expectedVersion !== null) {
      body.expectedVersion = Number(expectedVersion);
    }
    const res = await request(`/alerts/${encodeURIComponent(alertId)}/resolve`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
    return res?.data || res;
  },

  /**
   * POST /api/v1/alerts/evaluate
   */
  async triggerEvaluation(params = {}) {
    const res = await request('/alerts/evaluate', {
      method: 'POST',
      body: JSON.stringify(params || {}),
    });
    return res?.data || res;
  },

  /**
   * GET /api/v1/alert-rules/metadata
   */
  async getRuleMetadata() {
    try {
      const res = await request('/alert-rules/metadata');
      return res?.data || DEFAULT_RULE_METADATA;
    } catch {
      return DEFAULT_RULE_METADATA;
    }
  },

  /**
   * GET /api/v1/alert-rules
   */
  async getAlertRules(params = {}) {
    const qs = buildQueryString(params);
    const res = await request(`/alert-rules${qs}`);
    const payload = res?.data || res;
    return {
      items: Array.isArray(payload?.items) ? payload.items : [],
      pagination: payload?.pagination || {
        page: Number(params.page || 1),
        limit: Number(params.limit || 20),
        total: 0,
        total_pages: 1,
      },
    };
  },

  /**
   * GET /api/v1/alert-rules/:id
   */
  async getAlertRuleById(ruleId) {
    if (!ruleId) throw new Error('Thiếu ID cấu hình cảnh báo');
    const res = await request(`/alert-rules/${encodeURIComponent(ruleId)}`);
    return res?.data || res;
  },

  /**
   * POST /api/v1/alert-rules
   */
  async createAlertRule(ruleData) {
    const cleanPayload = {
      name: String(ruleData.name || '').trim(),
      description: ruleData.description ? String(ruleData.description).trim() : null,
      cluster_id: ruleData.cluster_id ? String(ruleData.cluster_id).trim() : null,
      metric_type: ruleData.metric_type,
      operator: ruleData.operator,
      threshold_value: Number(ruleData.threshold_value),
      unit: String(ruleData.unit || '').trim(),
      severity: ruleData.severity || 'WARNING',
      evaluation_window: String(ruleData.evaluation_window || '5m').trim(),
      duration: Number(ruleData.duration ?? 60),
      cooldown_seconds: Number(ruleData.cooldown_seconds ?? 300),
      enabled: ruleData.enabled !== undefined ? Boolean(ruleData.enabled) : true,
    };

    const res = await request('/alert-rules', {
      method: 'POST',
      body: JSON.stringify(cleanPayload),
    });
    return res?.data || res;
  },

  /**
   * PUT /api/v1/alert-rules/:id
   */
  async updateAlertRule(ruleId, ruleData) {
    if (!ruleId) throw new Error('Thiếu ID cấu hình cảnh báo');
    const cleanPayload = {};
    if (ruleData.name !== undefined) cleanPayload.name = String(ruleData.name).trim();
    if (ruleData.description !== undefined) {
      cleanPayload.description = ruleData.description ? String(ruleData.description).trim() : null;
    }
    if (ruleData.cluster_id !== undefined) {
      cleanPayload.cluster_id = ruleData.cluster_id ? String(ruleData.cluster_id).trim() : null;
    }
    if (ruleData.metric_type !== undefined) cleanPayload.metric_type = ruleData.metric_type;
    if (ruleData.operator !== undefined) cleanPayload.operator = ruleData.operator;
    if (ruleData.threshold_value !== undefined) cleanPayload.threshold_value = Number(ruleData.threshold_value);
    if (ruleData.unit !== undefined) cleanPayload.unit = String(ruleData.unit).trim();
    if (ruleData.severity !== undefined) cleanPayload.severity = ruleData.severity;
    if (ruleData.evaluation_window !== undefined) {
      cleanPayload.evaluation_window = String(ruleData.evaluation_window).trim();
    }
    if (ruleData.duration !== undefined) cleanPayload.duration = Number(ruleData.duration);
    if (ruleData.cooldown_seconds !== undefined) {
      cleanPayload.cooldown_seconds = Number(ruleData.cooldown_seconds);
    }
    if (ruleData.enabled !== undefined) cleanPayload.enabled = Boolean(ruleData.enabled);

    const res = await request(`/alert-rules/${encodeURIComponent(ruleId)}`, {
      method: 'PUT',
      body: JSON.stringify(cleanPayload),
    });
    return res?.data || res;
  },

  /**
   * PATCH /api/v1/alert-rules/:id/status
   */
  async toggleAlertRuleStatus(ruleId, enabled) {
    if (!ruleId) throw new Error('Thiếu ID cấu hình cảnh báo');
    const res = await request(`/alert-rules/${encodeURIComponent(ruleId)}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ enabled: Boolean(enabled) }),
    });
    return res?.data || res;
  },

  /**
   * DELETE /api/v1/alert-rules/:id
   */
  async deleteAlertRule(ruleId) {
    if (!ruleId) throw new Error('Thiếu ID cấu hình cảnh báo');
    const res = await request(`/alert-rules/${encodeURIComponent(ruleId)}`, {
      method: 'DELETE',
    });
    return res?.data || res;
  },
};

export default alertService;
