import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useDashboard } from '../context/DashboardContext';
import { useToast } from '../../../context/ToastContext';
import { exportToCsv, exportToJson } from '../../../utils/exportUtils';
import AuditDistributionChart from '../../../components/dashboard/AuditDistributionChart';
import { fetchOrgAuditLogs } from '../../../services/dashboardAuditLogsService';
import {
  Calendar,
  ScrollText,
  Search,
  RefreshCw,
  CheckCircle2,
  FileJson,
  FileSpreadsheet,
  Download,
  ChevronDown,
  Printer,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  Bot,
  Cpu,
  User,
  UserCheck,
  Clock,
  Layers,
  Eye,
  RotateCcw,
  Server,
  X,
  Code2,
  BarChart2
} from 'lucide-react';

// Helpers định dạng ngày tháng cục bộ an toàn theo múi giờ client
const getTodayStr = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getThisMonthStr = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

const getThisYearStr = () => {
  return String(new Date().getFullYear());
};

const parseLogDate = (log) => {
  if (!log) return null;
  const raw = log.created_at || log.raw_created_at || log.rawItem?.created_at;
  if (raw) {
    const d = new Date(raw);
    if (!isNaN(d.getTime())) return d;
  }
  const ts = log.timestamp || log.rawItem?.timestamp;
  if (ts && typeof ts === 'string') {
    const parts = ts.split(' ');
    if (parts[0] && parts[0].includes('/')) {
      const [d, m, y] = parts[0].split('/').map(Number);
      const [hh, mm, ss] = (parts[1] || '0:0:0').split(':').map(Number);
      const res = new Date(y, m - 1, d, hh || 0, mm || 0, ss || 0);
      if (!isNaN(res.getTime())) return res;
    }
    const d = new Date(ts);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
};

const resolveLogServiceName = (item) => {
  if (!item) return null;
  if (item.serviceName && typeof item.serviceName === 'string' && item.serviceName.trim()) {
    return item.serviceName.trim();
  }
  const meta = item.metadata && typeof item.metadata === 'object' ? item.metadata : {};
  const metaService = meta.target_service || meta.service_id || meta.target_name || meta.pod_name;
  if (metaService && typeof metaService === 'string' && metaService.trim()) {
    return metaService.trim();
  }
  const rType = String(item.resourceType || '').toUpperCase();
  const tType = String(item.targetType || '').toUpperCase();
  const evt = String(item.event || '').toUpperCase();
  const isWorkloadLog =
    rType === 'HEALING_ACTION' ||
    rType === 'POD' ||
    rType === 'WORKLOAD' ||
    tType === 'WORKLOAD' ||
    evt.startsWith('REMEDIATION_') ||
    evt === 'AUTONOMOUS_HEALING_TRIGGERED' ||
    evt === 'CIRCUIT_BREAKER_TRIPPED' ||
    evt.startsWith('HITL_APPROVAL_');
  if (isWorkloadLog && item.target && item.target !== '-') {
    const targetStr = String(item.target).trim();
    if (targetStr.startsWith('HEALING_ACTION/') || targetStr.startsWith('WORKLOAD/')) {
      return null;
    }
    if (meta.namespace && targetStr.startsWith(`${meta.namespace}/`)) {
      return targetStr.slice(meta.namespace.length + 1);
    }
    return targetStr;
  }
  return null;
};

const EVENT_DISPLAY_MAP = {
  AUTONOMOUS_HEALING_TRIGGERED: {
    label: 'Kích hoạt tự phục hồi',
    bg: '#F0FDFA',
    color: '#0F766E',
    border: '#99F6E4',
    dot: '#14B8A6',
  },
  REMEDIATION_COMPLETED: {
    label: 'Hoàn tất tự phục hồi',
    bg: '#ECFDF5',
    color: '#047857',
    border: '#A7F3D0',
    dot: '#10B981',
  },
  REMEDIATION_FAILED: {
    label: 'Tự phục hồi thất bại',
    bg: '#FFFBEB',
    color: '#B45309',
    border: '#FDE68A',
    dot: '#F59E0B',
  },
  REMEDIATION_ABORTED: {
    label: 'Dừng khẩn cấp',
    bg: '#FFF1F2',
    color: '#BE123C',
    border: '#FECDD3',
    dot: '#F43F5E',
  },
  REMEDIATION_POD_RESTARTED: {
    label: 'Khởi động lại Pod',
    bg: '#F0F9FF',
    color: '#0369A1',
    border: '#BAE6FD',
    dot: '#0EA5E9',
  },
  CIRCUIT_BREAKER_TRIPPED: {
    label: 'Ngắt mạch bảo vệ',
    bg: '#FFFBEB',
    color: '#B45309',
    border: '#FDE68A',
    dot: '#F59E0B',
  },
  HITL_APPROVAL_GRANTED: {
    label: 'Phê duyệt HITL',
    bg: '#ECFDF5',
    color: '#047857',
    border: '#A7F3D0',
    dot: '#10B981',
  },
  HITL_APPROVAL_REJECTED: {
    label: 'Từ chối phê duyệt HITL',
    bg: '#FFF1F2',
    color: '#BE123C',
    border: '#FECDD3',
    dot: '#F43F5E',
  },
  REMEDIATION_NODE_DRAINED: {
    label: 'Rút tải Node (Drain)',
    bg: '#F0F9FF',
    color: '#0369A1',
    border: '#BAE6FD',
    dot: '#0EA5E9',
  },
  AGENT_CONNECTED: {
    label: 'Agent kết nối lại',
    bg: '#F5F3FF',
    color: '#6D28D9',
    border: '#DDD6FE',
    dot: '#8B5CF6',
  },
  AGENT_DISCONNECTED: {
    label: 'Agent mất kết nối',
    bg: '#FFFBEB',
    color: '#B45309',
    border: '#FDE68A',
    dot: '#F59E0B',
  },
  DISCONNECTED: {
    label: 'Ngắt kết nối Agent',
    bg: '#FFFBEB',
    color: '#B45309',
    border: '#FDE68A',
    dot: '#F59E0B',
  },
  AGENT_CREATED: {
    label: 'Khởi tạo Agent',
    bg: '#EFF6FF',
    color: '#1D4ED8',
    border: '#BFDBFE',
    dot: '#3B82F6',
  },
  AGENT_REVOKED: {
    label: 'Thu hồi Agent',
    bg: '#FFF1F2',
    color: '#BE123C',
    border: '#FECDD3',
    dot: '#F43F5E',
  },
  AGENT_TOKEN_CREATED: {
    label: 'Cấp Token Agent',
    bg: '#EEF2FF',
    color: '#4338CA',
    border: '#C7D2FE',
    dot: '#6366F1',
  },
  AGENT_TOKEN_REVOKED: {
    label: 'Thu hồi Token Agent',
    bg: '#FFF1F2',
    color: '#BE123C',
    border: '#FECDD3',
    dot: '#F43F5E',
  },
  AGENT_DELETED: {
    label: 'Xóa Agent',
    bg: '#F1F5F9',
    color: '#475569',
    border: '#CBD5E1',
    dot: '#64748B',
  },
  AUTH_LOGIN_SUCCESS: {
    label: 'Đăng nhập thành công',
    bg: '#EFF6FF',
    color: '#1D4ED8',
    border: '#BFDBFE',
    dot: '#3B82F6',
  },
  AUTH_LOGIN_FAILURE: {
    label: 'Đăng nhập thất bại',
    bg: '#FFFBEB',
    color: '#B45309',
    border: '#FDE68A',
    dot: '#F59E0B',
  },
  AUTH_LOGOUT: {
    label: 'Đăng xuất',
    bg: '#F1F5F9',
    color: '#475569',
    border: '#CBD5E1',
    dot: '#64748B',
  },
  AUTH_PASSWORD_CHANGED: {
    label: 'Đổi mật khẩu',
    bg: '#EEF2FF',
    color: '#4338CA',
    border: '#C7D2FE',
    dot: '#6366F1',
  },
  ACCESS_DENIED_ROLE: {
    label: 'Từ chối quyền (RBAC)',
    bg: '#FEF2F2',
    color: '#DC2626',
    border: '#FECACA',
    dot: '#EF4444',
  },
  ACCESS_DENIED_TENANT: {
    label: 'Từ chối truy cập tổ chức',
    bg: '#FEF2F2',
    color: '#DC2626',
    border: '#FECACA',
    dot: '#EF4444',
  },
  POLICY_CREATED: {
    label: 'Tạo chính sách mới',
    bg: '#EFF6FF',
    color: '#1D4ED8',
    border: '#BFDBFE',
    dot: '#3B82F6',
  },
  POLICY_UPDATED: {
    label: 'Cập nhật chính sách',
    bg: '#EEF2FF',
    color: '#4338CA',
    border: '#C7D2FE',
    dot: '#6366F1',
  },
  POLICY_THRESHOLD_MODIFIED: {
    label: 'Điều chỉnh ngưỡng chính sách',
    bg: '#EEF2FF',
    color: '#4338CA',
    border: '#C7D2FE',
    dot: '#6366F1',
  },
  POLICY_STATUS_CHANGED: {
    label: 'Đổi trạng thái chính sách',
    bg: '#EEF2FF',
    color: '#4338CA',
    border: '#C7D2FE',
    dot: '#6366F1',
  },
  POLICY_DELETED: {
    label: 'Xóa chính sách',
    bg: '#FFF1F2',
    color: '#BE123C',
    border: '#FECDD3',
    dot: '#F43F5E',
  },
  CLUSTER_CREATED: {
    label: 'Tạo cụm Kubernetes',
    bg: '#EFF6FF',
    color: '#1D4ED8',
    border: '#BFDBFE',
    dot: '#3B82F6',
  },
  CLUSTER_REMOVED: {
    label: 'Gỡ bỏ cụm Kubernetes',
    bg: '#FFF1F2',
    color: '#BE123C',
    border: '#FECDD3',
    dot: '#F43F5E',
  },
  CLUSTER_DELETED: {
    label: 'Xóa cụm Kubernetes',
    bg: '#FFF1F2',
    color: '#BE123C',
    border: '#FECDD3',
    dot: '#F43F5E',
  },
  TOKEN_ROTATED: {
    label: 'Xoay vòng Token Agent',
    bg: '#EEF2FF',
    color: '#4338CA',
    border: '#C7D2FE',
    dot: '#6366F1',
  },
  TOKEN_REVOKED: {
    label: 'Thu hồi Token Agent',
    bg: '#FFF1F2',
    color: '#BE123C',
    border: '#FECDD3',
    dot: '#F43F5E',
  },
  CONFIG_UPDATED: {
    label: 'Cập nhật cấu hình',
    bg: '#F1F5F9',
    color: '#334155',
    border: '#CBD5E1',
    dot: '#64748B',
  },
  MEMBER_INVITED: {
    label: 'Mời thành viên',
    bg: '#EFF6FF',
    color: '#1D4ED8',
    border: '#BFDBFE',
    dot: '#3B82F6',
  },
  MEMBER_JOINED: {
    label: 'Thành viên gia nhập',
    bg: '#ECFDF5',
    color: '#047857',
    border: '#A7F3D0',
    dot: '#10B981',
  },
  MEMBER_ROLE_CHANGED: {
    label: 'Đổi vai trò thành viên',
    bg: '#EEF2FF',
    color: '#4338CA',
    border: '#C7D2FE',
    dot: '#6366F1',
  },
  MEMBER_REMOVED: {
    label: 'Loại bỏ thành viên',
    bg: '#FFF1F2',
    color: '#BE123C',
    border: '#FECDD3',
    dot: '#F43F5E',
  },
  ORG_CREATED: {
    label: 'Tạo tổ chức',
    bg: '#EFF6FF',
    color: '#1D4ED8',
    border: '#BFDBFE',
    dot: '#3B82F6',
  },
  COMPANY_CREATE: {
    label: 'Tạo doanh nghiệp',
    bg: '#EFF6FF',
    color: '#1D4ED8',
    border: '#BFDBFE',
    dot: '#3B82F6',
  },
  COMPANY_JOIN: {
    label: 'Gia nhập doanh nghiệp',
    bg: '#ECFDF5',
    color: '#047857',
    border: '#A7F3D0',
    dot: '#10B981',
  },
  USER_PROFILE_UPDATED: {
    label: 'Cập nhật hồ sơ',
    bg: '#F1F5F9',
    color: '#334155',
    border: '#CBD5E1',
    dot: '#64748B',
  },
  PROFILE_UPDATE: {
    label: 'Cập nhật hồ sơ',
    bg: '#F1F5F9',
    color: '#334155',
    border: '#CBD5E1',
    dot: '#64748B',
  },
};

const getEventPresentation = (eventCode) => {
  const key = String(eventCode || '').trim().toUpperCase();
  if (EVENT_DISPLAY_MAP[key]) {
    return EVENT_DISPLAY_MAP[key];
  }
  const readable = key
    ? key
        .toLowerCase()
        .split('_')
        .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : ''))
        .join(' ')
    : 'Sự kiện hệ thống';
  return {
    label: readable,
    bg: '#F8FAFC',
    color: '#334155',
    border: '#E2E8F0',
    dot: '#64748B',
  };
};

const splitFormattedTimestamp = (ts) => {
  const value = String(ts || '').trim();
  const match = value.match(/^(\d{2}\/\d{2}\/\d{4})\s+(\d{2}:\d{2}:\d{2})$/);
  if (match) {
    return { date: match[1], time: match[2] };
  }
  return { date: null, time: value };
};

const HIDDEN_DETAIL_META_KEYS = new Set([
  'sha256',
  'signature',
  'userAgent',
  'requestId',
  'reasonCode',
  'before_data',
  'after_data',
  'organization_name',
  'method',
  'path',
  'actor_name',
  'engine_name',
  'triggered_by',
  'target_name',
  'target_service',
  'service_id',
  'agent_name',
  'cluster_name',
  'policy_name',
  'policy_id',
  'agent_id',
  'cluster_id',
  'action_id',
  'user_id',
  'target_user_id',
  'token_id',
  'heartbeat_id',
  'action_type',
  'action_code',
  'agent_version',
  'agent_uid',
  'namespace',
  'pod_name',
  'node_name',
  'incident_id',
  'duration_ms',
  'latency_ms',
  'timeout_threshold_seconds',
  'confidence',
  'threshold',
  'required_roles',
  'current_roles',
  'changed_fields',
  'approved_by',
  'rejected_by',
  'aborted_by',
  'executed_by',
  'updated_by',
  'created_by',
  'deleted_by',
  'email',
  'role_code',
  'role',
  'reason',
]);

const SENSITIVE_META_KEY_REGEX = /token|secret|password|key|hash|signature/i;

const extractDetailMetaItems = (log) => {
  const m = log?.metadata && typeof log.metadata === 'object' ? log.metadata : {};
  const items = [];
  if (m.reasonCode) items.push({ label: 'Mã lý do', value: String(m.reasonCode) });
  if (m.policy_name) items.push({ label: 'Chính sách áp dụng', value: m.policy_name });
  if (m.action_type || m.action_code) {
    items.push({ label: 'Loại can thiệp', value: m.action_type || m.action_code });
  }
  if (m.cluster_name) items.push({ label: 'Cụm Kubernetes', value: m.cluster_name });
  if (m.agent_name && m.agent_name !== log?.actor) {
    items.push({ label: 'Tác tử Agent', value: m.agent_name });
  }
  if (m.agent_version) items.push({ label: 'Phiên bản Agent', value: m.agent_version });
  if (m.agent_uid) items.push({ label: 'Mã định danh Agent', value: m.agent_uid });
  if (m.namespace) items.push({ label: 'Namespace', value: m.namespace });
  if (m.pod_name) items.push({ label: 'Pod mục tiêu', value: m.pod_name });
  if (m.node_name) items.push({ label: 'Node mục tiêu', value: m.node_name });
  if (m.incident_id) items.push({ label: 'Mã sự cố', value: String(m.incident_id) });
  if (typeof m.duration_ms === 'number') {
    items.push({ label: 'Thời gian thực thi', value: `${m.duration_ms} ms` });
  }
  if (typeof m.latency_ms === 'number') {
    items.push({ label: 'Độ trễ Heartbeat', value: `${m.latency_ms} ms` });
  }
  if (typeof m.timeout_threshold_seconds === 'number') {
    items.push({ label: 'Ngưỡng Timeout', value: `${m.timeout_threshold_seconds}s` });
  }
  if (typeof m.confidence === 'number') {
    items.push({ label: 'Độ tin cậy AI', value: `${Math.round(m.confidence * 100)}%` });
  }
  if (m.threshold !== undefined && m.threshold !== null && m.threshold !== '') {
    items.push({ label: 'Ngưỡng kích hoạt', value: String(m.threshold) });
  }
  if (m.path) {
    items.push({ label: 'Endpoint API', value: m.method ? `${m.method} ${m.path}` : m.path });
  }
  if (Array.isArray(m.required_roles) && m.required_roles.length > 0) {
    items.push({ label: 'Vai trò yêu cầu', value: m.required_roles.join(', ') });
  }
  if (Array.isArray(m.current_roles) && m.current_roles.length > 0) {
    items.push({ label: 'Vai trò hiện tại', value: m.current_roles.join(', ') });
  }
  if (Array.isArray(m.changed_fields) && m.changed_fields.length > 0) {
    items.push({ label: 'Trường thay đổi', value: m.changed_fields.join(', ') });
  }
  if (m.approved_by) items.push({ label: 'Người phê duyệt', value: m.approved_by });
  if (m.rejected_by) items.push({ label: 'Người từ chối', value: m.rejected_by });
  if (m.aborted_by) items.push({ label: 'Người dừng lệnh', value: m.aborted_by });
  if (m.executed_by) items.push({ label: 'Người thực thi', value: m.executed_by });
  if (m.updated_by) items.push({ label: 'Người cập nhật', value: m.updated_by });
  if (m.created_by) items.push({ label: 'Người khởi tạo', value: m.created_by });
  if (m.deleted_by) items.push({ label: 'Người xóa', value: m.deleted_by });
  if (m.email) items.push({ label: 'Email liên quan', value: m.email });
  if (m.role_code || m.role) items.push({ label: 'Vai trò', value: m.role_code || m.role });
  if (m.reason) items.push({ label: 'Lý do', value: m.reason });

  Object.entries(m).forEach(([key, val]) => {
    if (HIDDEN_DETAIL_META_KEYS.has(key) || SENSITIVE_META_KEY_REGEX.test(key)) return;
    if (val === null || val === undefined || val === '') return;
    if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
      items.push({ label: key, value: String(val) });
    } else if (
      Array.isArray(val) &&
      val.length > 0 &&
      val.every((el) => typeof el === 'string' || typeof el === 'number' || typeof el === 'boolean')
    ) {
      items.push({ label: key, value: val.join(', ') });
    }
  });

  return items;
};

export const AuditLogsPage = () => {
  const { currentOrg, currentEnv } = useDashboard();
  const { success: toastSuccess, error: toastError } = useToast();

  const headerClusterId =
    currentEnv?.clusterId || (currentEnv?.cluster ? currentEnv?.id : currentEnv?.id) || null;
  const headerClusterName = currentEnv?.cluster || currentEnv?.name || null;

  // Data states
  const [rawLogs, setRawLogs] = useState([]);
  const [loadError, setLoadError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showChart, setShowChart] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const exportMenuRef = useRef(null);
  const loadSeqRef = useRef(0);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target)) {
        setIsExportMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Pagination states (10 items/page)
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // Filter states
  const [scopeMode, setScopeMode] = useState('cluster'); // 'cluster' | 'all' — mặc định lọc theo cụm đang chọn trên Header
  const [selectedService, setSelectedService] = useState('ALL');
  const [selectedRole, setSelectedRole] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const activeClusterId = scopeMode === 'cluster' ? headerClusterId : null;

  const prevScopeKeyRef = useRef(`${currentOrg?.id || ''}|${activeClusterId || ''}|${scopeMode}`);
  useEffect(() => {
    const nextKey = `${currentOrg?.id || ''}|${activeClusterId || ''}|${scopeMode}`;
    if (prevScopeKeyRef.current !== nextKey) {
      prevScopeKeyRef.current = nextKey;
      setSelectedService('ALL');
      setPage(1);
    }
  }, [currentOrg?.id, activeClusterId, scopeMode]);

  // Time Filter States (Mặc định là ngày hôm nay, đồng bộ chuẩn Lịch sử phục hồi)
  const [timeFilterMode, setTimeFilterMode] = useState('today'); // 'today' | 'date' | 'month' | 'year'
  const [selectedDate, setSelectedDate] = useState(() => getTodayStr());
  const [selectedMonth, setSelectedMonth] = useState(() => getThisMonthStr());
  const [selectedYear, setSelectedYear] = useState(() => getThisYearStr());

  // Trạng thái Popover Lịch
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const calendarRef = useRef(null);

  // Đóng Popover Lịch khi bấm ra ngoài
  useEffect(() => {
    const handleClickOutsideCalendar = (e) => {
      if (calendarRef.current && !calendarRef.current.contains(e.target)) {
        setIsCalendarOpen(false);
      }
    };
    if (isCalendarOpen) {
      document.addEventListener('mousedown', handleClickOutsideCalendar);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutsideCalendar);
    };
  }, [isCalendarOpen]);

  // Nhãn hiển thị trực quan trên nút Lịch
  const currentFilterLabel = useMemo(() => {
    if (timeFilterMode === 'today') {
      const parts = getTodayStr().split('-');
      return `Hôm nay (${parts[2]}/${parts[1]}/${parts[0]})`;
    }
    if (timeFilterMode === 'date') {
      if (!selectedDate) return 'Chọn ngày';
      const parts = selectedDate.split('-');
      const isToday = selectedDate === getTodayStr();
      return isToday ? `Hôm nay (${parts[2]}/${parts[1]}/${parts[0]})` : `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    if (timeFilterMode === 'month') {
      if (!selectedMonth) return 'Chọn tháng';
      const parts = selectedMonth.split('-');
      return `Tháng ${parts[1]}/${parts[0]}`;
    }
    if (timeFilterMode === 'year') {
      return `Năm ${selectedYear}`;
    }
    const parts = getTodayStr().split('-');
    return `Hôm nay (${parts[2]}/${parts[1]}/${parts[0]})`;
  }, [timeFilterMode, selectedDate, selectedMonth, selectedYear]);

  // Danh sách các năm khả dụng trích từ dữ liệu thực tế & năm hiện hành
  const availableYears = useMemo(() => {
    const currentY = Number(getThisYearStr());
    const years = new Set([String(currentY), String(currentY - 1)]);
    rawLogs.forEach((item) => {
      const d = parseLogDate(item);
      if (d && !isNaN(d.getTime())) {
        years.add(String(d.getFullYear()));
      }
    });
    return Array.from(years).sort((a, b) => Number(b) - Number(a));
  }, [rawLogs]);

  // Danh sách các ngày gần đây để chọn nhanh
  const recentActiveDays = useMemo(() => {
    const days = [];
    const now = new Date();
    for (let i = 0; i < 6; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const yr = d.getFullYear();
      const mo = String(d.getMonth() + 1).padStart(2, '0');
      const dy = String(d.getDate()).padStart(2, '0');
      days.push(`${yr}-${mo}-${dy}`);
    }
    return days;
  }, []);

  // UI interaction states
  const [exportNotice, setExportNotice] = useState(false);
  const [selectedLogDetail, setSelectedLogDetail] = useState(null);

  // Debounce search query
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1); // reset to page 1 on new search
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Tải nhật ký kiểm toán thực tế từ backend theo khoảng thời gian & cụm K8s đang chọn
  const loadAuditData = useCallback(async () => {
    const seq = ++loadSeqRef.current;
    setIsLoading(true);
    setLoadError(null);
    try {
      const orgId = currentOrg?.id || null;
      const requestFilters = {
        timeFilterMode,
        selectedDate,
        selectedMonth,
        selectedYear,
        ...(activeClusterId ? { cluster_id: activeClusterId } : {}),
      };

      const firstPageRes = await fetchOrgAuditLogs(
        orgId,
        requestFilters,
        { page: 1, pageSize: 5000 }
      );

      let combinedLogs = firstPageRes.data || [];
      const totalPagesFromApi = firstPageRes.totalPages || 1;
      if (orgId && totalPagesFromApi > 1) {
        const extraPageCount = Math.min(totalPagesFromApi, 4);
        const remainingPromises = [];
        for (let p = 2; p <= extraPageCount; p += 1) {
          remainingPromises.push(
            fetchOrgAuditLogs(orgId, requestFilters, { page: p, pageSize: 5000 })
          );
        }
        const remainingResults = await Promise.all(remainingPromises);
        remainingResults.forEach((res) => {
          if (res?.data?.length) {
            combinedLogs = combinedLogs.concat(res.data);
          }
        });
      }

      if (seq !== loadSeqRef.current) return;
      setRawLogs(combinedLogs);
    } catch (err) {
      if (err?.isAborted || err?.name === 'AbortError' || seq !== loadSeqRef.current) {
        return;
      }
      console.error('Failed to load audit logs:', err);
      const errMsg = err?.message || 'Không thể tải nhật ký kiểm toán từ máy chủ';
      setRawLogs([]);
      setLoadError(errMsg);
      toastError(errMsg);
    } finally {
      if (seq === loadSeqRef.current) {
        setIsLoading(false);
      }
    }
  }, [currentOrg?.id, activeClusterId, timeFilterMode, selectedDate, selectedMonth, selectedYear, toastError]);

  // Chuẩn hóa danh sách theo Thời gian và Cụm K8s đang kích hoạt
  const timeAndClusterLogs = useMemo(() => {
    return rawLogs.filter((item) => {
      // 1. Lọc theo thời gian (Ngày, Tháng, Năm)
      const d = parseLogDate(item);
      if (d && !isNaN(d.getTime())) {
        const itemDateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const itemMonthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const itemYearStr = String(d.getFullYear());

        if (timeFilterMode === 'today') {
          if (itemDateStr !== getTodayStr()) return false;
        } else if (timeFilterMode === 'date') {
          if (selectedDate && itemDateStr !== selectedDate) return false;
        } else if (timeFilterMode === 'month') {
          if (selectedMonth && itemMonthStr !== selectedMonth) return false;
        } else if (timeFilterMode === 'year') {
          if (selectedYear && itemYearStr !== selectedYear) return false;
        }
      }

      // 2. Bảo đảm khớp cụm K8s khi lọc theo Cụm trên Header
      if (activeClusterId && item.clusterId && String(item.clusterId) !== String(activeClusterId)) {
        return false;
      }

      return true;
    });
  }, [rawLogs, activeClusterId, timeFilterMode, selectedDate, selectedMonth, selectedYear]);

  // Danh sách Dịch vụ K8s thực tế trong phạm vi Thời gian & Cụm hiện tại
  const uniqueServices = useMemo(() => {
    const svcSet = new Set();
    timeAndClusterLogs.forEach((item) => {
      const svc = resolveLogServiceName(item);
      if (svc) svcSet.add(svc);
    });
    return Array.from(svcSet).sort((a, b) => a.localeCompare(b));
  }, [timeAndClusterLogs]);

  // Bộ lọc dữ liệu tập trung theo Dịch vụ K8s, Tác nhân, Trạng thái và Từ khóa tìm kiếm
  const filteredLogs = useMemo(() => {
    return timeAndClusterLogs.filter((item) => {
      // 1. Lọc theo Dịch vụ K8s
      if (selectedService !== 'ALL') {
        const svc = resolveLogServiceName(item);
        if (svc !== selectedService) return false;
      }

      // 2. Lọc theo Tác nhân / Vai trò
      if (selectedRole !== 'ALL') {
        if (selectedRole === 'AGENT') {
          if (item.role !== 'AGENT' && item.actorType !== 'AGENT') return false;
        } else if (selectedRole === 'SYSTEM_AI') {
          if (item.role !== 'SYSTEM_AI' && item.actorType !== 'SYSTEM') return false;
        } else if (item.role !== selectedRole) {
          return false;
        }
      }

      // 3. Lọc theo Trạng thái
      if (selectedStatus !== 'ALL') {
        if (selectedStatus === 'SUCCESS') {
          if (item.status !== 'SUCCESS' && item.status !== 'VERIFIED') return false;
        } else if (item.status !== selectedStatus) {
          return false;
        }
      }

      // 4. Lọc theo Tìm kiếm
      if (debouncedSearch) {
        const q = debouncedSearch.toLowerCase().trim();
        const idMatch = (item.id || '').toLowerCase().includes(q);
        const actorMatch = (item.actor || '').toLowerCase().includes(q);
        const eventMatch = (item.event || '').toLowerCase().includes(q);
        const targetMatch = (item.target || '').toLowerCase().includes(q);
        const descMatch = (item.description || '').toLowerCase().includes(q);
        const ipMatch = (item.ip || '').toLowerCase().includes(q);
        const resourceIdMatch = (item.resourceId || '').toLowerCase().includes(q);
        const reasonCodeMatch = (item.metadata?.reasonCode || '').toLowerCase().includes(q);
        const requestIdMatch = (item.metadata?.requestId || '').toLowerCase().includes(q);
        const clusterMatch = (item.clusterName || item.metadata?.cluster_name || '').toLowerCase().includes(q);
        const serviceMatch = (resolveLogServiceName(item) || '').toLowerCase().includes(q);
        if (
          !idMatch &&
          !actorMatch &&
          !eventMatch &&
          !targetMatch &&
          !descMatch &&
          !ipMatch &&
          !resourceIdMatch &&
          !reasonCodeMatch &&
          !requestIdMatch &&
          !clusterMatch &&
          !serviceMatch
        ) {
          return false;
        }
      }

      return true;
    });
  }, [timeAndClusterLogs, selectedService, selectedRole, selectedStatus, debouncedSearch]);

  const total = filteredLogs.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, totalPages);
  const logs = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredLogs.slice(start, start + pageSize);
  }, [filteredLogs, currentPage, pageSize]);

  useEffect(() => {
    loadAuditData();
  }, [loadAuditData]);

  // Export CSV
  const handleExportCsv = () => {
    const headers = [
      'Mã Bản Ghi',
      'Thời Gian',
      'Tác Nhân (Actor)',
      'Vai Trò',
      'Sự Kiện',
      'Mô Tả Chi Tiết',
      'Đối Tượng Mục Tiêu',
      'Cụm K8s',
      'Dịch Vụ K8s',
      'Địa Chỉ IP',
      'Trạng Thái',
    ];
    const rows = logs.map((log) => [
      log.id,
      log.timestamp,
      log.actor,
      log.role || '-',
      log.event,
      log.description,
      log.target,
      log.clusterName || log.metadata?.cluster_name || '-',
      resolveLogServiceName(log) || '-',
      log.ip || '-',
      log.status,
    ]);
    exportToCsv(`so-cai-kiem-toan-${currentOrg?.slug || 'org'}.csv`, headers, rows);
    setExportNotice(true);
    toastSuccess(`Đã xuất ${rows.length} bản ghi kiểm toán định dạng CSV!`, 'Xuất Dữ Liệu');
    setTimeout(() => setExportNotice(false), 3000);
  };

  // Export JSON
  const handleExportJson = () => {
    exportToJson(`so-cai-kiem-toan-${currentOrg?.slug || 'org'}.json`, logs);
    setExportNotice(true);
    toastSuccess(`Đã xuất ${logs.length} bản ghi kiểm toán định dạng JSON!`, 'Xuất Dữ Liệu');
    setTimeout(() => setExportNotice(false), 3000);
  };

  // Print / Save PDF
  const handlePrintPdf = () => {
    setExportNotice(true);
    toastSuccess('Đang mở hộp thoại In / Lưu PDF của trình duyệt...', 'In / Lưu PDF');
    setTimeout(() => {
      window.print();
    }, 250);
    setTimeout(() => setExportNotice(false), 4000);
  };

  // Summary KPI Cards tính toán động từ dữ liệu thực tế theo bộ lọc
  const summaryKpis = useMemo(() => {
    const totalCount = filteredLogs.length;
    const autonomousCount = filteredLogs.filter(
      (l) =>
        l.role === 'SYSTEM_AI' ||
        l.role === 'AGENT' ||
        l.actorType === 'SYSTEM' ||
        l.actorType === 'AGENT' ||
        (l.event && l.event.includes('AUTONOMOUS'))
    ).length;
    const hitlCount = filteredLogs.filter(
      (l) => l.event && (l.event.includes('HITL') || l.event.includes('APPROV'))
    ).length;
    const blockedCount = filteredLogs.filter((l) => l.status === 'DENIED').length;

    return [
      {
        title: 'Tổng Bản Ghi Sổ Cái',
        value: totalCount,
        sub: 'Theo bộ lọc thực tế',
        icon: ScrollText,
        color: '#2563EB',
        bg: '#EFF6FF',
      },
      {
        title: 'AI MAPE-K & Agent K8s',
        value: autonomousCount,
        sub: 'Tác vụ tự trị & Agent',
        icon: Bot,
        color: '#059669',
        bg: '#ECFDF5',
      },
      {
        title: 'Cổng Phê Duyệt HITL',
        value: hitlCount,
        sub: 'Con người xác nhận',
        icon: UserCheck,
        color: '#D97706',
        bg: '#FFFBEB',
      },
      {
        title: 'Vi Phạm Bị Chặn (RBAC)',
        value: blockedCount,
        sub: 'Từ chối quyền truy cập',
        icon: ShieldAlert,
        color: '#DC2626',
        bg: '#FEF2F2',
      },
    ];
  }, [filteredLogs]);

    // Nút Lịch & Popover đặt trên góc phải của Biểu đồ
  const calendarFilterControl = (
    <div style={{ position: 'relative' }} ref={calendarRef}>
      <button
        type="button"
        onClick={() => setIsCalendarOpen(!isCalendarOpen)}
        style={{
          height: '32px',
          padding: '0 10px',
          fontSize: '0.75rem',
          fontWeight: 600,
          borderRadius: '6px',
          border: '1px solid #CBD5E1',
          backgroundColor: '#FFFFFF',
          color: 'var(--dash-text-primary, #1E293B)',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          cursor: 'pointer',
          boxShadow: isCalendarOpen ? '0 0 0 2px rgba(15, 23, 42, 0.08)' : 'none',
          transition: 'all 0.15s ease',
        }}
        title="Mở bảng lịch chọn ngày, tháng hoặc năm"
      >
        <Calendar size={14} color="#64748B" />
        <span>{currentFilterLabel}</span>
        <ChevronDown size={12} color="#64748B" />
      </button>

      {/* Cửa Sổ Popover Lịch Đa Chế Độ */}
      {isCalendarOpen && (
        <div
          style={{
            position: 'absolute',
            top: '38px',
            left: '0',
            zIndex: 100,
            width: '330px',
            backgroundColor: '#FFFFFF',
            borderRadius: '10px',
            border: '1px solid #E2E8F0',
            boxShadow: '0 12px 30px -4px rgba(0, 0, 0, 0.15), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
            padding: '14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          {/* Tabs Chế Độ: Ngày | Tháng | Năm */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px', backgroundColor: '#F1F5F9', padding: '3px', borderRadius: '8px' }}>
            <button
              type="button"
              onClick={() => {
                setTimeFilterMode('date');
                setPage(1);
              }}
              style={{
                padding: '6px 2px',
                fontSize: '0.7rem',
                fontWeight: 700,
                borderRadius: '6px',
                border: 'none',
                backgroundColor: timeFilterMode === 'date' || timeFilterMode === 'today' ? '#FFFFFF' : 'transparent',
                color: timeFilterMode === 'date' || timeFilterMode === 'today' ? '#0F172A' : '#64748B',
                boxShadow: timeFilterMode === 'date' || timeFilterMode === 'today' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                cursor: 'pointer',
              }}
            >
              📅 Ngày
            </button>
            <button
              type="button"
              onClick={() => {
                setTimeFilterMode('month');
                setPage(1);
              }}
              style={{
                padding: '6px 2px',
                fontSize: '0.7rem',
                fontWeight: 700,
                borderRadius: '6px',
                border: 'none',
                backgroundColor: timeFilterMode === 'month' ? '#FFFFFF' : 'transparent',
                color: timeFilterMode === 'month' ? '#0F172A' : '#64748B',
                boxShadow: timeFilterMode === 'month' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                cursor: 'pointer',
              }}
            >
              🗓️ Tháng
            </button>
            <button
              type="button"
              onClick={() => {
                setTimeFilterMode('year');
                setPage(1);
              }}
              style={{
                padding: '6px 2px',
                fontSize: '0.7rem',
                fontWeight: 700,
                borderRadius: '6px',
                border: 'none',
                backgroundColor: timeFilterMode === 'year' ? '#FFFFFF' : 'transparent',
                color: timeFilterMode === 'year' ? '#0F172A' : '#64748B',
                boxShadow: timeFilterMode === 'year' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                cursor: 'pointer',
              }}
            >
              📆 Năm
            </button>
          </div>

          {/* Tab Body: CHỌN NGÀY */}
          {(timeFilterMode === 'date' || timeFilterMode === 'today') && (
            <div>
              <label style={{ fontSize: '0.7rem', fontWeight: 600, color: '#64748B', display: 'block', marginBottom: '4px' }}>
                Chọn ngày cụ thể:
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => {
                  setSelectedDate(e.target.value);
                  setTimeFilterMode('date');
                  setPage(1);
                }}
                style={{
                  width: '100%',
                  height: '36px',
                  padding: '0 10px',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  border: '1px solid #CBD5E1',
                  borderRadius: '6px',
                  backgroundColor: '#F8FAFC',
                  color: '#0F172A',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />

              {/* Quick presets for recent days */}
              <div style={{ marginTop: '10px' }}>
                <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#94A3B8', marginBottom: '6px' }}>
                  Ngày có bản ghi gần đây:
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {recentActiveDays.map((dStr) => {
                    const dParts = dStr.split('-');
                    const isToday = dStr === getTodayStr();
                    const isSelected = (timeFilterMode === 'today' && isToday) || (timeFilterMode === 'date' && selectedDate === dStr);
                    return (
                      <button
                        key={dStr}
                        type="button"
                        onClick={() => {
                          if (isToday) {
                            setTimeFilterMode('today');
                          } else {
                            setTimeFilterMode('date');
                          }
                          setSelectedDate(dStr);
                          setPage(1);
                          setIsCalendarOpen(false);
                        }}
                        style={{
                          padding: '4px 8px',
                          fontSize: '0.6875rem',
                          fontWeight: isSelected ? 700 : 500,
                          borderRadius: '4px',
                          border: isSelected ? '1px solid #10B981' : '1px solid #E2E8F0',
                          backgroundColor: isSelected ? '#ECFDF5' : '#F8FAFC',
                          color: isSelected ? '#047857' : '#334155',
                          cursor: 'pointer',
                        }}
                      >
                        {isToday ? `Hôm nay (${dParts[2]}/${dParts[1]})` : `${dParts[2]}/${dParts[1]}`}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Tab Body: CHỌN THÁNG */}
          {timeFilterMode === 'month' && (
            <div>
              <label style={{ fontSize: '0.7rem', fontWeight: 600, color: '#64748B', display: 'block', marginBottom: '4px' }}>
                Chọn tháng & năm:
              </label>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => {
                  setSelectedMonth(e.target.value);
                  setPage(1);
                }}
                style={{
                  width: '100%',
                  height: '36px',
                  padding: '0 10px',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  border: '1px solid #CBD5E1',
                  borderRadius: '6px',
                  backgroundColor: '#F8FAFC',
                  color: '#0F172A',
                  outline: 'none',
                  boxSizing: 'border-box',
                  marginBottom: '10px',
                }}
              />

              {/* 12 Months grid */}
              <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#94A3B8', marginBottom: '6px' }}>
                Các tháng trong năm {selectedMonth?.split('-')[0] || getThisYearStr()}:
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((mNum) => {
                  const mStr = `${selectedMonth?.split('-')[0] || getThisYearStr()}-${String(mNum).padStart(2, '0')}`;
                  const isSelected = selectedMonth === mStr;
                  return (
                    <button
                      key={mNum}
                      type="button"
                      onClick={() => {
                        setSelectedMonth(mStr);
                        setPage(1);
                        setIsCalendarOpen(false);
                      }}
                      style={{
                        padding: '6px 2px',
                        fontSize: '0.6875rem',
                        fontWeight: isSelected ? 700 : 500,
                        borderRadius: '4px',
                        border: isSelected ? '1px solid #2563EB' : '1px solid #E2E8F0',
                        backgroundColor: isSelected ? '#EFF6FF' : '#F8FAFC',
                        color: isSelected ? '#1D4ED8' : '#334155',
                        cursor: 'pointer',
                        textAlign: 'center',
                      }}
                    >
                      Tháng {mNum}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tab Body: CHỌN NĂM */}
          {timeFilterMode === 'year' && (
            <div>
              <label style={{ fontSize: '0.7rem', fontWeight: 600, color: '#64748B', display: 'block', marginBottom: '6px' }}>
                Chọn năm khảo sát:
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                {availableYears.map((yr) => {
                  const isSelected = selectedYear === yr;
                  return (
                    <button
                      key={yr}
                      type="button"
                      onClick={() => {
                        setSelectedYear(yr);
                        setPage(1);
                        setIsCalendarOpen(false);
                      }}
                      style={{
                        padding: '10px 4px',
                        fontSize: '0.8125rem',
                        fontWeight: isSelected ? 700 : 600,
                        borderRadius: '6px',
                        border: isSelected ? '1px solid #7C3AED' : '1px solid #E2E8F0',
                        backgroundColor: isSelected ? '#F5F3FF' : '#F8FAFC',
                        color: isSelected ? '#6D28D9' : '#334155',
                        cursor: 'pointer',
                        textAlign: 'center',
                      }}
                    >
                      Năm {yr}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Popover Footer */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '8px', borderTop: '1px solid #F1F5F9', marginTop: '4px' }}>
            <button
              type="button"
              onClick={() => {
                setTimeFilterMode('today');
                setSelectedDate(getTodayStr());
                setPage(1);
                setIsCalendarOpen(false);
              }}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '0.7rem',
                color: '#10B981',
                fontWeight: 700,
                cursor: 'pointer',
                padding: 0,
              }}
            >
              Về hôm nay
            </button>
            <button
              type="button"
              onClick={() => setIsCalendarOpen(false)}
              style={{
                padding: '4px 12px',
                fontSize: '0.7rem',
                fontWeight: 700,
                backgroundColor: '#0F172A',
                color: '#FFFFFF',
                borderRadius: '4px',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Áp dụng
            </button>
          </div>
        </div>
      )}
    </div>
  );


  return (
    <div className="dashboard-audit-logs-page" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* 1. Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 100%)',
              border: '1px solid #A7F3D0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: '0 2px 6px rgba(5, 150, 105, 0.08)',
            }}
          >
            <ScrollText size={22} color="#059669" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <h1 style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--dash-text-primary)', letterSpacing: '-0.02em', margin: 0 }}>
                Nhật Ký Kiểm Toán Bất Biến
              </h1>
            </div>
            <p style={{ fontSize: '0.84375rem', color: 'var(--dash-text-secondary)', margin: '4px 0 0 0', lineHeight: 1.5 }}>
              Theo dõi lịch sử thao tác hệ thống, hành động tự phục hồi AI và kiểm soát truy cập theo chuẩn SOC 2 và ISO 27001
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={loadAuditData}
            disabled={isLoading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 12px',
              backgroundColor: '#FFFFFF',
              border: '1px solid var(--dash-border)',
              borderRadius: 'var(--dash-radius-md)',
              fontSize: '0.8125rem',
              fontWeight: 600,
              cursor: isLoading ? 'not-allowed' : 'pointer',
              color: 'var(--dash-text-primary)',
            }}
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            <span>{isLoading ? 'Đang tải...' : 'Làm mới'}</span>
          </button>

          {/* Danh Sách Chọn Định Dạng Xuất Sổ Cái */}
          <div ref={exportMenuRef} style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setIsExportMenuOpen((prev) => !prev)}
              aria-haspopup="true"
              aria-expanded={isExportMenuOpen}
              aria-label="Tùy chọn xuất sổ cái"
              title="Chọn định dạng file xuất sổ cái kiểm toán (CSV, JSON, PDF)"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 14px',
                backgroundColor: 'var(--dash-primary)',
                border: 'none',
                borderRadius: 'var(--dash-radius-md)',
                color: '#FFFFFF',
                fontSize: '0.8125rem',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: 'var(--dash-shadow-xs)',
                transition: 'all 0.15s ease',
              }}
            >
              <Download size={15} />
              <span>Xuất Sổ Cái</span>
              <ChevronDown
                size={14}
                style={{
                  transform: isExportMenuOpen ? 'rotate(180deg)' : 'none',
                  transition: 'transform 0.2s ease',
                }}
              />
            </button>

            {/* Danh sách định dạng file để chọn */}
            <div
              role="menu"
              aria-label="Danh sách định dạng xuất sổ cái"
              style={{
                display: isExportMenuOpen ? 'flex' : 'none',
                flexDirection: 'column',
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: '6px',
                width: '230px',
                backgroundColor: '#FFFFFF',
                border: '1px solid var(--dash-border)',
                borderRadius: 'var(--dash-radius-md)',
                boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.12), 0 8px 10px -6px rgba(15, 23, 42, 0.06)',
                padding: '6px',
                zIndex: 50,
                gap: '2px',
              }}
            >
              <div
                style={{
                  padding: '6px 8px 4px 8px',
                  fontSize: '0.6875rem',
                  fontWeight: 700,
                  color: 'var(--dash-text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Chọn Định Dạng File
              </div>

              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  handleExportCsv();
                  setIsExportMenuOpen(false);
                }}
                aria-label="Xuất CSV"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '8px 10px',
                  width: '100%',
                  backgroundColor: 'transparent',
                  border: 'none',
                  borderRadius: 'var(--dash-radius-sm)',
                  color: 'var(--dash-text-primary)',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background-color 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F0FDF4')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '28px',
                    height: '28px',
                    borderRadius: '6px',
                    backgroundColor: '#DCFCE7',
                  }}
                >
                  <FileSpreadsheet size={16} color="#059669" />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ color: '#0F172A', fontWeight: 600 }}>Xuất CSV</span>
                  <span style={{ fontSize: '0.6875rem', color: '#64748B', fontWeight: 400 }}>Bảng tính Excel (.csv)</span>
                </div>
              </button>

              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  handleExportJson();
                  setIsExportMenuOpen(false);
                }}
                aria-label="Xuất JSON"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '8px 10px',
                  width: '100%',
                  backgroundColor: 'transparent',
                  border: 'none',
                  borderRadius: 'var(--dash-radius-sm)',
                  color: 'var(--dash-text-primary)',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background-color 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F0F9FF')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '28px',
                    height: '28px',
                    borderRadius: '6px',
                    backgroundColor: '#E0F2FE',
                  }}
                >
                  <FileJson size={16} color="#0284C7" />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ color: '#0F172A', fontWeight: 600 }}>Xuất JSON</span>
                  <span style={{ fontSize: '0.6875rem', color: '#64748B', fontWeight: 400 }}>Cấu trúc đối tượng (.json)</span>
                </div>
              </button>

              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  handlePrintPdf();
                  setIsExportMenuOpen(false);
                }}
                aria-label="In hoặc Lưu PDF"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '8px 10px',
                  width: '100%',
                  backgroundColor: 'transparent',
                  border: 'none',
                  borderRadius: 'var(--dash-radius-sm)',
                  color: 'var(--dash-text-primary)',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background-color 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F8FAFC')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '28px',
                    height: '28px',
                    borderRadius: '6px',
                    backgroundColor: '#F1F5F9',
                  }}
                >
                  <Printer size={16} color="#475569" />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ color: '#0F172A', fontWeight: 600 }}>In / Lưu PDF</span>
                  <span style={{ fontSize: '0.6875rem', color: '#64748B', fontWeight: 400 }}>In hoặc tài liệu PDF A4</span>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>

      {exportNotice && (
        <div
          style={{
            padding: '12px 16px',
            backgroundColor: '#ECFDF5',
            border: '1px solid #A7F3D0',
            borderRadius: 'var(--dash-radius-md)',
            color: '#065F46',
            fontSize: '0.875rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <CheckCircle2 size={18} color="#059669" />
          <span>Dữ liệu nhật ký kiểm toán đã được xuất thành công!</span>
        </div>
      )}

      {/* 2. KPI Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
        {summaryKpis.map((kpi, idx) => {
          const Icon = kpi.icon;
          return (
            <div
              key={idx}
              className="dash-card"
              style={{
                padding: '16px 18px',
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                backgroundColor: '#FFFFFF',
                borderRadius: '14px',
                border: '1px solid #E2E8F0',
                boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
              }}
            >
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '12px',
                  backgroundColor: kpi.bg,
                  border: `1px solid ${kpi.color}22`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: kpi.color,
                  flexShrink: 0,
                }}
              >
                <Icon size={20} />
              </div>
              <div style={{ overflow: 'hidden' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-secondary)', fontWeight: 600 }}>{kpi.title}</div>
                <div
                  style={{
                    fontSize: '1.45rem',
                    fontWeight: 800,
                    color: 'var(--dash-text-primary)',
                    marginTop: '2px',
                    lineHeight: 1.2,
                    fontVariantNumeric: 'tabular-nums',
                    letterSpacing: '-0.02em',
                  }}
                >
                  {kpi.value.toLocaleString('vi-VN')}
                </div>
                <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', marginTop: '2px' }}>{kpi.sub}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 3. Bộ lọc Tổng Hợp Đặt Trên Biểu Đồ (Đồng bộ chuẩn Lịch sử phục hồi, lọc đồng thời Biểu đồ và Sổ cái) */}
      <div
        className="dash-card"
        style={{
          padding: '16px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          borderRadius: '14px',
          border: '1px solid #E2E8F0',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          {/* Bộ chọn Thời Gian, Cụm K8s (Header) và Dịch Vụ K8s */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--dash-text-secondary)' }}>Thời Gian:</span>
              {calendarFilterControl}
            </div>

            {headerClusterId && headerClusterName && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--dash-text-secondary)' }}>Cụm K8s:</span>
                <div
                  role="group"
                  aria-label="Phạm vi cụm Kubernetes"
                  style={{
                    display: 'inline-flex',
                    backgroundColor: '#F1F5F9',
                    border: '1px solid #CBD5E1',
                    borderRadius: '7px',
                    padding: '2px',
                    height: '32px',
                    alignItems: 'center',
                    boxSizing: 'border-box',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setScopeMode('cluster');
                      setPage(1);
                    }}
                    aria-pressed={scopeMode === 'cluster'}
                    title={`Lọc theo cụm đang chọn trên Header: ${headerClusterName}`}
                    style={{
                      height: '26px',
                      padding: '0 10px',
                      borderRadius: '5px',
                      border: 'none',
                      backgroundColor: scopeMode === 'cluster' ? '#FFFFFF' : 'transparent',
                      color: scopeMode === 'cluster' ? '#059669' : '#64748B',
                      boxShadow: scopeMode === 'cluster' ? '0 1px 2px rgba(15, 23, 42, 0.08)' : 'none',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <Server size={12} />
                    <span>{headerClusterName}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setScopeMode('all');
                      setPage(1);
                    }}
                    aria-pressed={scopeMode === 'all'}
                    title="Xem nhật ký của toàn bộ các cụm và cấp tổ chức"
                    style={{
                      height: '26px',
                      padding: '0 10px',
                      borderRadius: '5px',
                      border: 'none',
                      backgroundColor: scopeMode === 'all' ? '#FFFFFF' : 'transparent',
                      color: scopeMode === 'all' ? '#0F172A' : '#64748B',
                      boxShadow: scopeMode === 'all' ? '0 1px 2px rgba(15, 23, 42, 0.08)' : 'none',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Toàn công ty
                  </button>
                </div>
              </div>
            )}

            {/* Bộ lọc Dịch vụ K8s thực tế */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--dash-text-secondary)' }}>Dịch Vụ:</span>
              <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
                <Layers
                  size={13}
                  color="#64748B"
                  style={{ position: 'absolute', left: '9px', pointerEvents: 'none' }}
                />
                <select
                  aria-label="Lọc theo dịch vụ K8s"
                  value={selectedService}
                  onChange={(e) => {
                    setSelectedService(e.target.value);
                    setPage(1);
                  }}
                  style={{
                    height: '32px',
                    padding: '0 10px 0 28px',
                    fontSize: '0.75rem',
                    border: selectedService !== 'ALL' ? '1px solid #059669' : '1px solid #CBD5E1',
                    borderRadius: '6px',
                    backgroundColor: selectedService !== 'ALL' ? '#ECFDF5' : '#FFFFFF',
                    color: selectedService !== 'ALL' ? '#047857' : '#1E293B',
                    fontWeight: 600,
                    outline: 'none',
                    cursor: 'pointer',
                    maxWidth: '230px',
                  }}
                >
                  <option value="ALL">Tất cả dịch vụ ({uniqueServices.length})</option>
                  {uniqueServices.map((svc) => (
                    <option key={svc} value={svc}>
                      Dịch vụ: {svc}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {(selectedRole !== 'ALL' || selectedStatus !== 'ALL' || selectedService !== 'ALL' || searchQuery !== '') && (
              <button
                type="button"
                onClick={() => {
                  setSelectedRole('ALL');
                  setSelectedStatus('ALL');
                  setSelectedService('ALL');
                  setSearchQuery('');
                  setPage(1);
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  height: '32px',
                  padding: '0 10px',
                  borderRadius: '6px',
                  border: '1px solid #E2E8F0',
                  backgroundColor: '#F8FAFC',
                  color: '#475569',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <RotateCcw size={12} />
                <span>Đặt lại lọc</span>
              </button>
            )}
          </div>

          {/* Search box rộng rãi */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              flex: '1',
              minWidth: '280px',
              maxWidth: '580px',
              height: '36px',
              padding: '0 12px',
              border: '1px solid #CBD5E1',
              borderRadius: '8px',
              backgroundColor: '#F8FAFC',
              transition: 'border-color 0.15s ease, background-color 0.15s ease',
            }}
          >
            <Search size={15} color="#64748B" />
            <input
              type="text"
              placeholder="Tìm theo Mã bản ghi (AUD-...), Tác nhân, Sự kiện, Mục tiêu, Nội dung hoặc IP..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                border: 'none',
                outline: 'none',
                width: '100%',
                fontSize: '0.8125rem',
                backgroundColor: 'transparent',
                color: 'var(--dash-text-primary)',
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Xóa từ khóa tìm kiếm"
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '2px', display: 'flex' }}
              >
                <X size={14} color="#64748B" />
              </button>
            )}
          </div>
        </div>

        {/* Roles and Status pills */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', paddingTop: '12px', borderTop: '1px dashed #E2E8F0' }}>
          {/* Role pills */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--dash-text-secondary)', marginRight: '2px' }}>Tác Nhân:</span>
            {[
              { key: 'ALL', label: 'Tất cả', activeBg: '#0F172A', activeBorder: '#0F172A' },
              { key: 'SYSTEM_AI', label: 'AI MAPE-K', activeBg: '#059669', activeBorder: '#059669' },
              { key: 'AGENT', label: 'Agent K8s', activeBg: '#7C3AED', activeBorder: '#7C3AED' },
              { key: 'SME_OWNER', label: 'SME Owner', activeBg: '#2563EB', activeBorder: '#2563EB' },
              { key: 'DEVOPS', label: 'DevOps Lead', activeBg: '#0284C7', activeBorder: '#0284C7' },
              { key: 'VIEWER', label: 'Viewer', activeBg: '#475569', activeBorder: '#475569' },
            ].map((rk) => {
              const isActive = selectedRole === rk.key;
              return (
                <button
                  key={rk.key}
                  type="button"
                  onClick={() => {
                    setSelectedRole(rk.key);
                    setPage(1);
                  }}
                  style={{
                    padding: '4px 11px',
                    borderRadius: '9999px',
                    border: `1px solid ${isActive ? rk.activeBorder : '#E2E8F0'}`,
                    backgroundColor: isActive ? rk.activeBg : '#FFFFFF',
                    color: isActive ? '#FFFFFF' : '#475569',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    boxShadow: isActive ? '0 1px 3px rgba(15, 23, 42, 0.14)' : 'none',
                  }}
                >
                  {rk.label}
                </button>
              );
            })}
          </div>

          {/* Status pills */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--dash-text-secondary)', marginRight: '2px' }}>Trạng Thái:</span>
            {[
              { key: 'ALL', label: 'Tất cả', activeBg: '#0F172A', activeBorder: '#0F172A' },
              { key: 'SUCCESS', label: 'Thành Công', activeBg: '#059669', activeBorder: '#059669' },
              { key: 'FAILED', label: 'Thất Bại', activeBg: '#D97706', activeBorder: '#D97706' },
              { key: 'DENIED', label: 'Bị Từ Chối (RBAC)', activeBg: '#DC2626', activeBorder: '#DC2626' },
            ].map((st) => {
              const isActive = selectedStatus === st.key;
              return (
                <button
                  key={st.key}
                  type="button"
                  onClick={() => {
                    setSelectedStatus(st.key);
                    setPage(1);
                  }}
                  style={{
                    padding: '4px 11px',
                    borderRadius: '9999px',
                    border: `1px solid ${isActive ? st.activeBorder : '#E2E8F0'}`,
                    backgroundColor: isActive ? st.activeBg : '#FFFFFF',
                    color: isActive ? '#FFFFFF' : '#475569',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    boxShadow: isActive ? '0 1px 3px rgba(15, 23, 42, 0.14)' : 'none',
                  }}
                >
                  {st.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 4. Distribution Chart (Mặc định ẩn để ưu tiên hiển thị Sổ cái ngay tầm mắt; có nút bấm bật khi cần) */}
      {showChart && (
        <AuditDistributionChart
          height={230}
          title={`Phân Bổ Sự Kiện Kiểm Toán (${currentFilterLabel})`}
          subtitle="Phân loại các thao tác do AI tự động thực thi, con người phê duyệt và các thay đổi cấu hình bảo mật"
          logs={filteredLogs}
          timeFilterMode={timeFilterMode}
          selectedDate={selectedDate}
          selectedMonth={selectedMonth}
          selectedYear={selectedYear}
        />
      )}

      {/* 5. Audit Log Table */}
      <div className="dash-card" style={{ padding: '0', overflow: 'hidden', borderRadius: '14px', border: '1px solid #E2E8F0' }}>
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--dash-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '10px',
            backgroundColor: '#FFFFFF',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--dash-text-primary)', margin: 0 }}>
                Sổ Cái Nhật Ký Kiểm Toán ({total} Bản ghi)
              </h3>
              {selectedService !== 'ALL' && (
                <span
                  style={{
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '9999px',
                    backgroundColor: '#ECFDF5',
                    color: '#047857',
                  }}
                >
                  {`Dịch vụ: ${selectedService}`}
                </span>
              )}
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--dash-text-secondary)', margin: '3px 0 0 0' }}>
              Danh sách sự kiện và thao tác vận hành được ghi nhận đầy đủ theo thứ tự thời gian thực
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setShowChart((prev) => !prev)}
              title={showChart ? 'Thu gọn biểu đồ phân bổ' : 'Mở biểu đồ phân bổ sự kiện'}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '8px',
                border: showChart ? '1px solid #93C5FD' : '1px solid #CBD5E1',
                backgroundColor: showChart ? '#EFF6FF' : '#FFFFFF',
                color: showChart ? '#1D4ED8' : 'var(--dash-text-secondary)',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <BarChart2 size={14} />
              <span>{showChart ? 'Ẩn Biểu Đồ Phân Bổ' : 'Xem Phân Bổ Sự Kiện'}</span>
            </button>
          </div>
        </div>

        <div className="dash-table-container" style={{ border: 'none', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8125rem' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--dash-bg-canvas)', borderBottom: '1px solid var(--dash-border)' }}>
                <th style={{ padding: '12px 12px 12px 18px', fontWeight: 700, color: 'var(--dash-text-secondary)', width: '132px', whiteSpace: 'nowrap' }}>Mã & Thời Điểm</th>
                <th style={{ padding: '12px 12px', fontWeight: 700, color: 'var(--dash-text-secondary)', width: '218px' }}>Tác Nhân (Actor)</th>
                <th style={{ padding: '12px 12px', fontWeight: 700, color: 'var(--dash-text-secondary)', width: '240px' }}>Loại Sự Kiện & Mục Tiêu</th>
                <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--dash-text-secondary)', minWidth: '300px' }}>Nội Dung Chi Tiết</th>
                <th style={{ padding: '12px 12px', fontWeight: 700, color: 'var(--dash-text-secondary)', width: '128px', whiteSpace: 'nowrap' }}>Trạng Thái</th>
                <th style={{ padding: '12px 18px 12px 10px', fontWeight: 700, color: 'var(--dash-text-secondary)', width: '82px', textAlign: 'center', whiteSpace: 'nowrap' }}>Chi Tiết</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && rawLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '44px', textAlign: 'center', color: 'var(--dash-text-muted)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                      <RefreshCw size={24} className="animate-spin" color="var(--dash-primary)" />
                      <span>Đang tải sổ cái kiểm toán từ CSDL...</span>
                    </div>
                  </td>
                </tr>
              ) : loadError && rawLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '44px', textAlign: 'center', color: '#DC2626' }}>
                    <ShieldAlert size={32} style={{ margin: '0 auto 8px auto', opacity: 0.75 }} />
                    <div style={{ fontWeight: 700, fontSize: '0.875rem' }}>Không thể tải dữ liệu kiểm toán thực tế từ máy chủ</div>
                    <div style={{ fontSize: '0.75rem', marginTop: '4px', color: 'var(--dash-text-secondary)' }}>{loadError}</div>
                    <button
                      type="button"
                      onClick={loadAuditData}
                      style={{
                        marginTop: '12px',
                        padding: '6px 14px',
                        borderRadius: 'var(--dash-radius-sm)',
                        border: '1px solid #FECACA',
                        backgroundColor: '#FEF2F2',
                        color: '#DC2626',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Thử tải lại
                    </button>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '44px', textAlign: 'center', color: 'var(--dash-text-muted)' }}>
                    <ScrollText size={32} style={{ margin: '0 auto 8px auto', opacity: 0.4 }} />
                    <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>Không tìm thấy bản ghi kiểm toán nào</div>
                    <div style={{ fontSize: '0.75rem', marginTop: '4px' }}>Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm</div>
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const isAgent = log.role === 'AGENT' || log.actorType === 'AGENT';
                  const isSystem = !isAgent && (log.role === 'SYSTEM_AI' || log.actorType === 'SYSTEM');
                  const isOwner = log.role === 'SME_OWNER' || log.role === 'SUPER_ADMIN';
                  const isDenied = log.status === 'DENIED';
                  const isFailed = log.status === 'FAILED';
                  const evt = getEventPresentation(log.event);
                  const tsParts = splitFormattedTimestamp(log.timestamp);
                  const runtimeMetric =
                    typeof log.metadata?.duration_ms === 'number'
                      ? `${log.metadata.duration_ms}ms`
                      : typeof log.metadata?.confidence === 'number'
                      ? `AI ${Math.round(log.metadata.confidence * 100)}%`
                      : null;

                  return (
                    <tr
                      key={log.id}
                      style={{
                        borderBottom: '1px solid #F1F5F9',
                        backgroundColor: isDenied ? '#FFFBFB' : 'transparent',
                        boxShadow: isDenied ? 'inset 3px 0 0 #EF4444' : isFailed ? 'inset 3px 0 0 #F59E0B' : 'none',
                      }}
                    >
                      <td style={{ padding: '14px 12px 14px 18px', verticalAlign: 'middle' }}>
                        <div
                          style={{
                            fontWeight: 800,
                            fontSize: '0.8125rem',
                            color: '#059669',
                            fontFamily: 'var(--font-mono)',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                          }}
                          onClick={() => setSelectedLogDetail(log)}
                          title="Bấm để xem chi tiết bản ghi"
                        >
                          {log.id}
                        </div>
                        {tsParts.date ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '4px', fontVariantNumeric: 'tabular-nums' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', fontWeight: 600, color: '#334155' }}>
                              <Clock size={11} color="#94A3B8" />
                              <span>{tsParts.time}</span>
                            </span>
                            <span style={{ fontSize: '0.6875rem', color: '#94A3B8' }}>{tsParts.date}</span>
                          </div>
                        ) : (
                          <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', marginTop: '4px', lineHeight: 1.35 }}>
                            {log.timestamp}
                          </div>
                        )}
                      </td>

                      <td style={{ padding: '14px 12px', verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                          <div
                            style={{
                              width: '30px',
                              height: '30px',
                              borderRadius: '9px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                              marginTop: '1px',
                              backgroundColor: isAgent ? '#F3E8FF' : isSystem ? '#ECFDF5' : '#EFF6FF',
                              border: `1px solid ${isAgent ? '#DDD6FE' : isSystem ? '#A7F3D0' : '#BFDBFE'}`,
                              color: isAgent ? '#7C3AED' : isSystem ? '#059669' : '#2563EB',
                            }}
                          >
                            {isAgent ? <Cpu size={15} /> : isSystem ? <Bot size={15} /> : <User size={15} />}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 700, fontSize: '0.8125rem', color: '#0F172A', lineHeight: 1.35, overflowWrap: 'break-word' }}>
                              {log.actor}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '5px', marginTop: '5px' }}>
                              {log.role && (
                                <span
                                  style={{
                                    display: 'inline-block',
                                    fontSize: '0.625rem',
                                    fontWeight: 700,
                                    padding: '1px 7px',
                                    borderRadius: 'var(--dash-radius-full)',
                                    backgroundColor: isAgent
                                      ? '#F3E8FF'
                                      : isSystem
                                      ? '#ECFDF5'
                                      : isOwner
                                      ? '#EFF6FF'
                                      : '#F1F5F9',
                                    color: isAgent
                                      ? '#7C3AED'
                                      : isSystem
                                      ? '#059669'
                                      : isOwner
                                      ? '#2563EB'
                                      : '#475569',
                                    border: `1px solid ${isAgent ? '#E9D5FF' : isSystem ? '#A7F3D0' : isOwner ? '#BFDBFE' : '#E2E8F0'}`,
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {log.role}
                                </span>
                              )}
                              {log.ip ? (
                                <span style={{ fontSize: '0.6875rem', color: '#64748B', fontFamily: 'var(--font-mono)' }}>
                                  IP: {log.ip}
                                </span>
                              ) : (
                                <span style={{ fontSize: '0.6875rem', color: '#64748B' }}>
                                  {isAgent ? 'Cụm K8s' : isSystem ? 'Nội bộ hệ thống' : 'Không ghi nhận IP'}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td style={{ padding: '14px 12px', verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '5px' }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              padding: '2px 8px',
                              borderRadius: '6px',
                              backgroundColor: evt.bg,
                              color: evt.color,
                              border: `1px solid ${evt.border}`,
                              fontSize: '0.71875rem',
                              fontWeight: 700,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            <span style={{ width: '6px', height: '6px', borderRadius: '9999px', backgroundColor: evt.dot, flexShrink: 0 }} />
                            <span>{evt.label}</span>
                          </span>

                          <div
                            title={log.event}
                            style={{
                              fontFamily: 'var(--font-mono)',
                              fontSize: '0.6875rem',
                              fontWeight: 600,
                              color: '#64748B',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              maxWidth: '220px',
                              letterSpacing: '-0.01em',
                            }}
                          >
                            {log.event}
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '5px' }}>
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '2px 7px',
                                borderRadius: '5px',
                                backgroundColor: '#F8FAFC',
                                border: '1px solid #E2E8F0',
                                fontSize: '0.6875rem',
                                color: '#334155',
                                fontFamily: 'var(--font-mono)',
                                fontWeight: 600,
                                maxWidth: '170px',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                              title={log.target}
                            >
                              <Layers size={10} color="#64748B" />
                              <span>{log.target}</span>
                            </span>
                            {runtimeMetric && (
                              <span
                                style={{
                                  padding: '2px 6px',
                                  borderRadius: '5px',
                                  backgroundColor: isAgent ? '#EFF6FF' : '#ECFDF5',
                                  color: isAgent ? '#1D4ED8' : '#047857',
                                  fontSize: '0.65625rem',
                                  fontFamily: 'var(--font-mono)',
                                  fontWeight: 700,
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {runtimeMetric}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      <td
                        style={{
                          padding: '14px 16px',
                          minWidth: '300px',
                          color: '#334155',
                          fontSize: '0.8125rem',
                          lineHeight: 1.6,
                          overflowWrap: 'break-word',
                          verticalAlign: 'middle',
                        }}
                      >
                        {log.description}
                      </td>

                      <td style={{ padding: '14px 12px', whiteSpace: 'nowrap', verticalAlign: 'middle' }}>
                        {isDenied ? (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              whiteSpace: 'nowrap',
                              fontFamily: 'var(--font-mono)',
                              fontSize: '0.6875rem',
                              fontWeight: 800,
                              padding: '4px 10px',
                              backgroundColor: '#FEF2F2',
                              color: '#DC2626',
                              border: '1px solid #FECACA',
                              borderRadius: 'var(--dash-radius-full)',
                            }}
                          >
                            ✕ TỪ CHỐI
                          </span>
                        ) : isFailed ? (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              whiteSpace: 'nowrap',
                              fontFamily: 'var(--font-mono)',
                              fontSize: '0.6875rem',
                              fontWeight: 800,
                              padding: '4px 10px',
                              backgroundColor: '#FFFBEB',
                              color: '#D97706',
                              border: '1px solid #FDE68A',
                              borderRadius: 'var(--dash-radius-full)',
                            }}
                          >
                            ! THẤT BẠI
                          </span>
                        ) : (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              whiteSpace: 'nowrap',
                              fontFamily: 'var(--font-mono)',
                              fontSize: '0.6875rem',
                              fontWeight: 800,
                              padding: '4px 10px',
                              backgroundColor: '#ECFDF5',
                              color: '#059669',
                              border: '1px solid #A7F3D0',
                              borderRadius: 'var(--dash-radius-full)',
                            }}
                          >
                            ● THÀNH CÔNG
                          </span>
                        )}
                      </td>

                      <td style={{ padding: '14px 18px 14px 10px', textAlign: 'center', whiteSpace: 'nowrap', verticalAlign: 'middle' }}>
                        <button
                          type="button"
                          onClick={() => setSelectedLogDetail(log)}
                          title="Xem chi tiết dữ liệu trước/sau"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '5px 11px',
                            backgroundColor: '#FFFFFF',
                            border: '1px solid #CBD5E1',
                            borderRadius: '7px',
                            cursor: 'pointer',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            color: '#059669',
                            whiteSpace: 'nowrap',
                            boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
                          }}
                        >
                          <Eye size={13} />
                          <span>Xem</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 6. Dynamic Pagination Bar (10 items/page) */}
        <div
          style={{
            padding: '12px 20px',
            borderTop: '1px solid var(--dash-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            backgroundColor: '#FAFAFA',
          }}
        >
          <div style={{ fontSize: '0.8125rem', color: 'var(--dash-text-secondary)' }}>
            Hiển thị{' '}
            <strong style={{ color: 'var(--dash-text-primary)' }}>
              {total > 0 ? (currentPage - 1) * pageSize + 1 : 0} - {Math.min(currentPage * pageSize, total)}
            </strong>{' '}
            trên tổng số <strong style={{ color: 'var(--dash-text-primary)' }}>{total}</strong> bản ghi
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1 || isLoading}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '6px 10px',
                borderRadius: 'var(--dash-radius-sm)',
                border: '1px solid var(--dash-border)',
                backgroundColor: currentPage <= 1 ? '#F1F5F9' : '#FFFFFF',
                color: currentPage <= 1 ? '#94A3B8' : 'var(--dash-text-primary)',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: currentPage <= 1 ? 'not-allowed' : 'pointer',
              }}
            >
              <ChevronLeft size={14} />
              <span>Trước</span>
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 2)
              .map((p, idx, arr) => {
                const prev = arr[idx - 1];
                return (
                  <React.Fragment key={p}>
                    {prev && p - prev > 1 && (
                      <span style={{ padding: '0 4px', color: '#94A3B8', fontSize: '0.75rem' }}>...</span>
                    )}
                    <button
                      type="button"
                      onClick={() => setPage(p)}
                      style={{
                        minWidth: '28px',
                        height: '28px',
                        padding: '0 6px',
                        borderRadius: 'var(--dash-radius-sm)',
                        border: '1px solid var(--dash-border)',
                        backgroundColor: currentPage === p ? 'var(--dash-primary)' : '#FFFFFF',
                        color: currentPage === p ? '#FFFFFF' : 'var(--dash-text-secondary)',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      {p}
                    </button>
                  </React.Fragment>
                );
              })}

            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages || isLoading}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '6px 10px',
                borderRadius: 'var(--dash-radius-sm)',
                border: '1px solid var(--dash-border)',
                backgroundColor: currentPage >= totalPages ? '#F1F5F9' : '#FFFFFF',
                color: currentPage >= totalPages ? '#94A3B8' : 'var(--dash-text-primary)',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: page >= totalPages ? 'not-allowed' : 'pointer',
              }}
            >
              <span>Tiếp</span>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* 7. Audit Detail Modal / Drawer */}
      {selectedLogDetail && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(3px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
          onClick={() => setSelectedLogDetail(null)}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 'var(--dash-radius-lg, 16px)',
              width: '100%',
              maxWidth: '720px',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              display: 'flex',
              flexDirection: 'column',
              border: '1px solid #E2E8F0',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '18px 24px',
                borderBottom: '1px solid #A7F3D0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'linear-gradient(135deg, #ECFDF5 0%, #F8FAFC 100%)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '10px',
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #A7F3D0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <ScrollText size={19} color="#059669" />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.125rem', fontWeight: 800, margin: 0, color: '#0F172A' }}>
                    Chi Tiết Bản Ghi Kiểm Toán
                  </h3>
                  <span style={{ fontSize: '0.75rem', color: '#475569', fontFamily: 'var(--font-mono)' }}>
                    ID: {selectedLogDetail.id} &bull; {selectedLogDetail.timestamp}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    whiteSpace: 'nowrap',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.6875rem',
                    fontWeight: 800,
                    padding: '3px 9px',
                    backgroundColor:
                      selectedLogDetail.status === 'DENIED'
                        ? '#FEF2F2'
                        : selectedLogDetail.status === 'FAILED'
                        ? '#FFFBEB'
                        : '#ECFDF5',
                    color:
                      selectedLogDetail.status === 'DENIED'
                        ? '#DC2626'
                        : selectedLogDetail.status === 'FAILED'
                        ? '#D97706'
                        : '#059669',
                    border:
                      selectedLogDetail.status === 'DENIED'
                        ? '1px solid #FECACA'
                        : selectedLogDetail.status === 'FAILED'
                        ? '1px solid #FDE68A'
                        : '1px solid #A7F3D0',
                    borderRadius: 'var(--dash-radius-full)',
                  }}
                >
                  {selectedLogDetail.status === 'DENIED'
                    ? '✕ TỪ CHỐI'
                    : selectedLogDetail.status === 'FAILED'
                    ? '! THẤT BẠI'
                    : '● THÀNH CÔNG'}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedLogDetail(null)}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    padding: '4px',
                    borderRadius: '6px',
                    color: '#64748B',
                  }}
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>

              {/* Event Metadata Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
                <div style={{ padding: '12px 14px', borderRadius: '10px', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#64748B' }}>Tác Nhân Thực Hiện</div>
                  <div style={{ fontWeight: 700, color: '#0F172A', marginTop: '3px', wordBreak: 'break-word' }}>
                    {selectedLogDetail.actor}
                  </div>
                  {selectedLogDetail.actorEmail && selectedLogDetail.actorEmail !== selectedLogDetail.actor && (
                    <div style={{ fontSize: '0.6875rem', color: '#475569', marginTop: '3px', fontFamily: 'var(--font-mono)', wordBreak: 'break-word' }}>
                      {selectedLogDetail.actorEmail}
                    </div>
                  )}
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px', marginTop: '5px' }}>
                    {selectedLogDetail.role && (
                      <span
                        style={{
                          display: 'inline-block',
                          fontSize: '0.625rem',
                          fontWeight: 700,
                          padding: '1px 7px',
                          borderRadius: 'var(--dash-radius-full)',
                          backgroundColor: selectedLogDetail.role === 'AGENT' ? '#F3E8FF' : selectedLogDetail.role === 'SYSTEM_AI' ? '#ECFDF5' : '#EFF6FF',
                          color: selectedLogDetail.role === 'AGENT' ? '#7C3AED' : selectedLogDetail.role === 'SYSTEM_AI' ? '#059669' : '#2563EB',
                        }}
                      >
                        {selectedLogDetail.role}
                      </span>
                    )}
                    {selectedLogDetail.organizationName && (
                      <span
                        style={{
                          display: 'inline-block',
                          fontSize: '0.625rem',
                          fontWeight: 600,
                          padding: '1px 7px',
                          borderRadius: 'var(--dash-radius-full)',
                          backgroundColor: '#E2E8F0',
                          color: '#334155',
                        }}
                      >
                        {selectedLogDetail.organizationName}
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ padding: '12px 14px', borderRadius: '10px', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#64748B' }}>Địa Chỉ IP & Kết Nối</div>
                  <div style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#0F172A', marginTop: '3px', wordBreak: 'break-word' }}>
                    {selectedLogDetail.ip || 'Chưa ghi nhận IP'}
                  </div>
                  <div style={{ fontSize: '0.6875rem', color: '#475569', marginTop: '5px', wordBreak: 'break-word' }}>
                    {selectedLogDetail.metadata?.userAgent || 'Chưa ghi nhận User-Agent'}
                  </div>
                  {selectedLogDetail.metadata?.requestId && (
                    <div style={{ fontSize: '0.6875rem', color: '#64748B', marginTop: '4px', fontFamily: 'var(--font-mono)', wordBreak: 'break-all' }}>
                      Request ID: {selectedLogDetail.metadata.requestId}
                    </div>
                  )}
                </div>

                <div style={{ padding: '12px 14px', borderRadius: '10px', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#64748B' }}>Mã Sự Kiện Chuẩn</div>
                  <div style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#059669', marginTop: '3px', wordBreak: 'break-word' }}>
                    {selectedLogDetail.event}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#475569', marginTop: '4px', fontWeight: 600 }}>
                    {getEventPresentation(selectedLogDetail.event).label}
                  </div>
                </div>

                <div style={{ padding: '12px 14px', borderRadius: '10px', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#64748B' }}>Đối Tượng Tác Động</div>
                  <div style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#0F172A', marginTop: '3px', wordBreak: 'break-word' }}>
                    {selectedLogDetail.target}
                  </div>
                  {(selectedLogDetail.resourceType || selectedLogDetail.resourceId || selectedLogDetail.targetType || selectedLogDetail.targetId) && (
                    <div style={{ fontSize: '0.6875rem', color: '#475569', marginTop: '5px', fontFamily: 'var(--font-mono)', wordBreak: 'break-all' }}>
                      {selectedLogDetail.resourceType || selectedLogDetail.resourceId
                        ? [selectedLogDetail.resourceType, selectedLogDetail.resourceId].filter(Boolean).join(': ')
                        : [selectedLogDetail.targetType, selectedLogDetail.targetId].filter(Boolean).join(': ')}
                    </div>
                  )}
                  {selectedLogDetail.targetUserEmail && selectedLogDetail.targetUserEmail !== selectedLogDetail.target && (
                    <div style={{ fontSize: '0.6875rem', color: '#64748B', marginTop: '3px', fontFamily: 'var(--font-mono)', wordBreak: 'break-word' }}>
                      {selectedLogDetail.targetUserEmail}
                    </div>
                  )}
                </div>
              </div>

              {extractDetailMetaItems(selectedLogDetail).length > 0 && (
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748B', marginBottom: '6px' }}>
                    Thông Số Thực Thi Ghi Nhận
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {extractDetailMetaItems(selectedLogDetail).map((item, idx) => (
                      <div
                        key={idx}
                        style={{
                          padding: '6px 10px',
                          borderRadius: '8px',
                          backgroundColor: '#F8FAFC',
                          border: '1px solid #E2E8F0',
                          fontSize: '0.75rem',
                        }}
                      >
                        <span style={{ color: '#64748B', fontWeight: 600 }}>{item.label}: </span>
                        <span style={{ color: '#0F172A', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Description */}
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748B', marginBottom: '6px' }}>Mô Tả Chi Tiết</div>
                <div
                  style={{
                    padding: '12px 14px',
                    backgroundColor: '#F8FAFC',
                    borderRadius: '10px',
                    border: '1px solid #E2E8F0',
                    fontSize: '0.84375rem',
                    lineHeight: 1.6,
                    color: '#334155',
                  }}
                >
                  {selectedLogDetail.description}
                </div>
              </div>

              {/* Before and After Data (State Diff) */}
              {((selectedLogDetail.before_data !== null && selectedLogDetail.before_data !== undefined) ||
                (selectedLogDetail.after_data !== null && selectedLogDetail.after_data !== undefined)) && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--dash-text-secondary)', marginBottom: '8px' }}>
                    <Code2 size={14} />
                    <span>Dữ Liệu Trạng Thái Trước & Sau Thay Đổi (State Diff)</span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                    <div>
                      <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#DC2626', marginBottom: '4px' }}>
                        Trạng Thái Trước (Before)
                      </div>
                      <pre
                        style={{
                          margin: 0,
                          padding: '10px',
                          backgroundColor: '#FEF2F2',
                          border: '1px solid #FECACA',
                          borderRadius: '6px',
                          fontSize: '0.6875rem',
                          fontFamily: 'var(--font-mono)',
                          maxHeight: '220px',
                          overflowY: 'auto',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                          color: '#991B1B',
                        }}
                      >
                        {selectedLogDetail.before_data !== null && selectedLogDetail.before_data !== undefined
                          ? JSON.stringify(selectedLogDetail.before_data, null, 2)
                          : 'null'}
                      </pre>
                    </div>

                    <div>
                      <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#059669', marginBottom: '4px' }}>
                        Trạng Thái Sau (After)
                      </div>
                      <pre
                        style={{
                          margin: 0,
                          padding: '10px',
                          backgroundColor: '#ECFDF5',
                          border: '1px solid #A7F3D0',
                          borderRadius: '6px',
                          fontSize: '0.6875rem',
                          fontFamily: 'var(--font-mono)',
                          maxHeight: '220px',
                          overflowY: 'auto',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                          color: '#065F46',
                        }}
                      >
                        {selectedLogDetail.after_data !== null && selectedLogDetail.after_data !== undefined
                          ? JSON.stringify(selectedLogDetail.after_data, null, 2)
                          : 'null'}
                      </pre>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: '14px 24px',
                borderTop: '1px solid var(--dash-border)',
                backgroundColor: '#F8FAFC',
                display: 'flex',
                justifyContent: 'flex-end',
              }}
            >
              <button
                type="button"
                onClick={() => setSelectedLogDetail(null)}
                style={{
                  padding: '8px 18px',
                  backgroundColor: 'var(--dash-primary)',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: 'var(--dash-radius-md)',
                  fontSize: '0.8125rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuditLogsPage;
