import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useDashboard } from '../context/DashboardContext';
import { selfHealingService } from '../../../services/selfHealingService';
import SelfHealingTrendChart from '../../../components/dashboard/SelfHealingTrendChart';
import ActionDetailModal from './ActionDetailModal';
import {
  History,
  CheckCircle2,
  Search,
  RefreshCw,
  ShieldCheck,
  AlertCircle,
  Clock,
  XCircle,
  Activity,
  Eye,
  Calendar,
  ChevronDown,
  RotateCcw,
  Server,
  Zap,
  Filter
} from 'lucide-react';

const CANONICAL_ACTION_TYPES = [
  { code: 'RESTART_POD', label: 'Khởi động lại Pod (RESTART_POD)' },
  { code: 'SCALE_REPLICAS', label: 'Mở rộng Replicas (SCALE_REPLICAS)' },
  { code: 'ROLLBACK_DEPLOYMENT', label: 'Hoàn nguyên Deployment (ROLLBACK_DEPLOYMENT)' },
  { code: 'REPLACE_POD', label: 'Thay thế Pod lỗi (REPLACE_POD)' },
  { code: 'CLEANUP_TEMP_FILES', label: 'Dọn dẹp lưu trữ tạm (CLEANUP_STORAGE)' },
  { code: 'RESTART_DEPLOYMENT', label: 'Khởi động lại Deployment (RESTART_DEPLOYMENT)' },
  { code: 'ADJUST_RESOURCE_LIMITS', label: 'Điều chỉnh hạn mức CPU/RAM (ADJUST_LIMITS)' },
  { code: 'DRAIN_NODE', label: 'Di tản Pod khỏi Node (DRAIN_NODE)' },
  { code: 'BLOCK_IP_TEMP', label: 'Chặn IP bất thường (TEMPORARY_IP_BLOCK)' },
  { code: 'NO_ACTION', label: 'Giám sát an toàn (NO_ACTION)' },
];

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

export const ActionHistoryPage = () => {
  const { currentOrg, currentEnv } = useDashboard();
  const [searchTerm, setSearchTerm] = useState('');
  const [actions, setActions] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isUsingLiveDb, setIsUsingLiveDb] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedAction, setSelectedAction] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // Filter States
  const [timeFilterMode, setTimeFilterMode] = useState('today'); // 'today' | 'date' | 'month' | 'year' | 'all'
  const [selectedDate, setSelectedDate] = useState(() => getTodayStr());
  const [selectedMonth, setSelectedMonth] = useState(() => getThisMonthStr());
  const [selectedYear, setSelectedYear] = useState(() => getThisYearStr());

  const [selectedService, setSelectedService] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [selectedActionType, setSelectedActionType] = useState('ALL');
  const [dbActionTypes, setDbActionTypes] = useState([]);

  // Trạng thái mở Popover Lịch
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const calendarRef = useRef(null);

  // Đóng Popover Lịch khi bấm ra ngoài
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (calendarRef.current && !calendarRef.current.contains(e.target)) {
        setIsCalendarOpen(false);
      }
    };
    if (isCalendarOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
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
      return `Ngày ${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    if (timeFilterMode === 'month') {
      if (!selectedMonth) return 'Chọn tháng';
      const parts = selectedMonth.split('-');
      return `Tháng ${parts[1]}/${parts[0]}`;
    }
    if (timeFilterMode === 'year') {
      return `Năm ${selectedYear}`;
    }
    return 'Tất cả thời gian';
  }, [timeFilterMode, selectedDate, selectedMonth, selectedYear]);

  const activeClusterId = useMemo(() => {
    return currentEnv?.id || currentEnv?.clusterId || currentEnv?.cluster || '';
  }, [currentEnv?.id, currentEnv?.clusterId, currentEnv?.cluster]);

  const activeOrgId = useMemo(() => {
    return currentOrg?.id || '';
  }, [currentOrg?.id]);

  const formatRelativeTime = (dateStr) => {
    if (!dateStr) return 'Vừa xong';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Vừa xong';
    if (mins < 60) return `${mins} phút trước`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} giờ trước`;
    const days = Math.floor(hours / 24);
    return `${days} ngày trước`;
  };

  const mapBackendActionToUI = useCallback((item) => {
    const shortId = item.id && item.id.length > 8 ? `ACT-${item.id.slice(0, 8).toUpperCase()}` : (item.id || 'N/A');
    const durMs = item.attempts && item.attempts[0]?.duration_ms ? item.attempts[0].duration_ms : 1500;
    const mttrSec = item.elapsed_seconds ? `${item.elapsed_seconds}s` : `${(durMs / 1000).toFixed(1)}s`;

    const targetName = item.target_name || item.target_id || 'Chưa xác định';
    const actionTypeCode = item.action_type_code || item.action_type_name || 'Tự phục hồi';
    const rawMsg = String(item.result?.message || item.error_message || '');
    let title = rawMsg || `Thực thi ${actionTypeCode} trên ${targetName}`;
    const rbacMatch = rawMsg.match(
      /User\\?\s*"([^"\\]+)\\?"\s+cannot\s+(\w+)\s+resource\s+\\?"([^"\\]+)\\?"(?:\s+in API group\s+\\?"([^"\\]*)\\?")?(?:\s+in the namespace\s+\\?"([^"\\]+)\\?")?/i
    );
    if (rbacMatch || rawMsg.includes('(403)') || rawMsg.includes('Forbidden')) {
      const saUser = rbacMatch ? rbacMatch[1].replace('system:serviceaccount:', '') : 'selfheal-system:selfheal-agent-sa';
      const verb = rbacMatch ? rbacMatch[2] : 'patch';
      const resource = rbacMatch ? rbacMatch[3] : 'deployments/scale';
      const targetNs = rbacMatch && rbacMatch[5] ? rbacMatch[5] : (item.namespace || 'default');
      title = `Thực thi ${actionTypeCode} trên "${targetName}" thất bại [Lỗi 403 Forbidden]: ServiceAccount "${saUser}" thiếu quyền "${verb}" tài nguyên "${resource}" tại namespace "${targetNs}"`;
    } else if (rawMsg.includes('Self-healing mitigate action')) {
      title =
        actionTypeCode === 'NO_ACTION'
          ? `Giám sát an toàn (NO_ACTION): "${targetName}" ổn định trong ngưỡng an toàn`
          : `Đã thực thi thành công ${actionTypeCode} trên dịch vụ "${targetName}"`;
    } else if (rawMsg.includes('HTTPHeaderDict')) {
      title = rawMsg.split('HTTP response headers:')[0].trim();
    }
    const policyName = item.policy_name || 'Tự phục hồi trực tiếp (AI Trigger)';

    const isWaitingApproval =
      item.execution_status !== 'SUCCEEDED' &&
      item.execution_status !== 'FAILED' &&
      item.execution_status !== 'CANCELLED' &&
      (item.approval_status === 'PENDING' ||
       item.execution_status === 'PENDING' ||
       rawMsg.toLowerCase().includes('chờ phê duyệt'));

    let resultText = 'Thành công (100%)';
    let verified = item.verification?.verification_type || (item.execution_status === 'SUCCEEDED' ? 'SLO Health Probe' : 'Hệ thống K8s');
    let effectiveMttr = mttrSec;
    let effectiveStatus = item.execution_status || 'SUCCEEDED';

    if (isWaitingApproval) {
      resultText = 'Chờ duyệt HITL (PENDING)';
      verified = 'Đang chờ phê duyệt';
      effectiveMttr = 'Đang chờ';
      effectiveStatus = 'PENDING';
      if (!title || title.includes('Thực thi')) {
        title = `Hành động ${actionTypeCode} trên "${targetName}" đang chờ phê duyệt tại Cổng HITL`;
      }
    } else if (item.execution_status === 'RUNNING') {
      resultText = 'Đang thực thi...';
      verified = 'Đang can thiệp trên K8s';
      effectiveMttr = 'Đang chạy';
      effectiveStatus = 'RUNNING';
    } else if (item.execution_status === 'FAILED') {
      resultText = 'Thất bại (Failed)';
      verified = item.verification?.verification_type || 'Kiểm tra K8s thất bại';
      effectiveStatus = 'FAILED';
    } else if (item.execution_status === 'CANCELLED') {
      resultText = 'Đã hủy bỏ (Cancelled)';
      verified = 'Đã hủy bỏ';
      effectiveMttr = '-';
      effectiveStatus = 'CANCELLED';
    } else if (item.execution_status === 'SUCCEEDED') {
      resultText = 'Thành công (100%)';
      verified = item.verification?.verification_type || 'SLO Health Probe';
      effectiveStatus = 'SUCCEEDED';
      if (title.toLowerCase().includes('chờ phê duyệt')) {
        title = `Đã thực thi thành công ${actionTypeCode} trên dịch vụ "${targetName}"`;
      }
    }

    return {
      id: shortId,
      rawId: item.id,
      title,
      target: `${item.target_type || 'Workload'}/${targetName}`,
      targetName,
      namespace: item.namespace || 'default',
      policy: policyName,
      mttr: effectiveMttr,
      result: resultText,
      timestamp: formatRelativeTime(item.completed_at || item.created_at),
      verifiedBy: verified,
      status: effectiveStatus,
      errorMessage: item.error_message || null,
      rawItem: item,
    };
  }, []);

  const fetchActions = useCallback(async () => {
    setIsLoading(true);
    try {
      // Tải lên đến 2000 bản ghi lịch sử để bộ lọc ngày/tháng/năm hoạt động chính xác
      const res = await selfHealingService.getActions({
        limit: 2000,
        cluster_id: activeClusterId,
        organization_id: activeOrgId,
      });

      const analyticsRes = await selfHealingService.getAnalytics({
        cluster_id: activeClusterId,
        organization_id: activeOrgId,
      });

      const items = res?.items || (Array.isArray(res) ? res : []);
      setActions(items.map(mapBackendActionToUI));
      setAnalytics(analyticsRes);
      setIsUsingLiveDb(true);
    } catch (err) {
      console.warn('[ActionHistoryPage] Lỗi tải lịch sử:', err.message);
      setActions([]);
      setIsUsingLiveDb(true);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [activeClusterId, activeOrgId, mapBackendActionToUI]);

  // Load danh mục Action Types từ Database
  useEffect(() => {
    let isMounted = true;
    selfHealingService.getActionTypes()
      .then((res) => {
        const list = res?.items || (Array.isArray(res) ? res : []);
        if (isMounted && list.length > 0) setDbActionTypes(list);
      })
      .catch((err) => console.warn('[ActionHistoryPage] Lỗi lấy action types:', err.message));
    return () => { isMounted = false; };
  }, []);

  useEffect(() => {
    fetchActions();
  }, [fetchActions]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchActions();
  };

  // Danh sách Action Types chuẩn hóa
  const allActionTypes = useMemo(() => {
    const map = new Map();
    CANONICAL_ACTION_TYPES.forEach((c) => map.set(c.code, c));
    dbActionTypes.forEach((t) => {
      const code = t.code || t.name;
      if (code) {
        const existing = map.get(code);
        map.set(code, {
          code,
          label: existing?.label || `${t.name || code} (${code})`,
          description: t.description || existing?.description,
        });
      }
    });
    return Array.from(map.values());
  }, [dbActionTypes]);

  // Dynamic Lists for Service Dropdown
  const uniqueServices = useMemo(() => {
    const s = new Set();
    actions.forEach((a) => {
      const name = a.targetName || a.rawItem?.target_name || a.rawItem?.target_id;
      if (name && !name.includes(' ') && name !== 'Chưa xác định') s.add(name);
    });
    return Array.from(s).sort();
  }, [actions]);

  // Danh sách các năm có hành động
  const availableYears = useMemo(() => {
    const currentY = getThisYearStr();
    const years = new Set([currentY, '2026', '2025']);
    actions.forEach((a) => {
      const rawDate = a.rawItem?.completed_at || a.rawItem?.created_at || a.rawItem?.started_at;
      if (rawDate) {
        const y = new Date(rawDate).getFullYear();
        if (!isNaN(y)) years.add(String(y));
      }
    });
    return Array.from(years).sort().reverse();
  }, [actions]);

  // BỘ LỌC ĐỒNG BỘ: Lọc đồng thời cả Biểu đồ và Bảng Lịch sử
  const filteredHistory = useMemo(() => {
    return actions.filter((item) => {
      // 1. Time range filtering
      const rawDate = item.rawItem?.completed_at || item.rawItem?.created_at || item.rawItem?.started_at;
      if (rawDate) {
        const d = new Date(rawDate);
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

      // 2. Service filter
      if (selectedService !== 'ALL') {
        const targetStr = (item.targetName || item.target || '').toLowerCase();
        if (!targetStr.includes(selectedService.toLowerCase())) return false;
      }

      // 3. Status filter
      if (selectedStatus !== 'ALL') {
        if (selectedStatus === 'PENDING') {
          if (item.status !== 'PENDING' && !item.result?.includes('Chờ duyệt')) return false;
        } else if (item.status !== selectedStatus) {
          return false;
        }
      }

      // 4. Action type filter
      if (selectedActionType !== 'ALL') {
        const code = (item.rawItem?.action_type_code || '').toUpperCase();
        const name = (item.rawItem?.action_type_name || '').toUpperCase();
        const sel = selectedActionType.toUpperCase();
        const isMatch =
          code === sel ||
          name === sel ||
          name.replace(/\s+/g, '_') === sel ||
          (sel === 'CLEANUP_TEMP_FILES' && (code === 'CLEANUP_STORAGE' || name.includes('CLEANUP') || code.includes('CLEANUP'))) ||
          (sel === 'BLOCK_IP_TEMP' && (code === 'TEMPORARY_IP_BLOCK' || name.includes('BLOCK') || code.includes('BLOCK')));
        if (!isMatch) return false;
      }

      // 5. Search text filter
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matches =
          item.id.toLowerCase().includes(term) ||
          item.title.toLowerCase().includes(term) ||
          item.target.toLowerCase().includes(term) ||
          (item.policy && item.policy.toLowerCase().includes(term)) ||
          (item.errorMessage && item.errorMessage.toLowerCase().includes(term));
        if (!matches) return false;
      }

      return true;
    });
  }, [
    actions,
    timeFilterMode,
    selectedDate,
    selectedMonth,
    selectedYear,
    selectedService,
    selectedStatus,
    selectedActionType,
    searchTerm,
  ]);

  // Tự động chuyển về trang 1 khi thay đổi bất kỳ bộ lọc nào
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedService, selectedStatus, selectedActionType, searchTerm, timeFilterMode, selectedDate, selectedMonth, selectedYear]);

  // Tính toán lại các chỉ số phân tích động theo bộ lọc
  const dynamicAnalytics = useMemo(() => {
    const total = filteredHistory.length;
    if (total === 0) {
      return {
        totalActions: 0,
        averageRecoveryTime: '0s',
        successRate: '100%',
      };
    }
    let totalSec = 0;
    let succeededCount = 0;
    filteredHistory.forEach((a) => {
      const dur = a.rawItem?.attempts?.[0]?.duration_ms
        ? a.rawItem.attempts[0].duration_ms / 1000
        : (parseFloat(a.mttr) || a.rawItem?.elapsed_seconds || 1.5);
      totalSec += dur;
      if (a.status === 'SUCCEEDED') succeededCount++;
    });
    return {
      totalActions: total,
      averageRecoveryTime: `${(totalSec / total).toFixed(1)}s`,
      successRate: `${Math.round((succeededCount / total) * 100)}%`,
    };
  }, [filteredHistory]);

  const handleResetFilters = () => {
    setTimeFilterMode('today');
    setSelectedDate(getTodayStr());
    setSelectedMonth(getThisMonthStr());
    setSelectedYear(getThisYearStr());
    setSelectedService('ALL');
    setSelectedStatus('ALL');
    setSelectedActionType('ALL');
    setSearchTerm('');
    setCurrentPage(1);
  };

  const isFiltered =
    timeFilterMode !== 'today' ||
    selectedService !== 'ALL' ||
    selectedStatus !== 'ALL' ||
    selectedActionType !== 'ALL' ||
    Boolean(searchTerm.trim());

  // Pagination Logic
  const totalPages = Math.ceil(filteredHistory.length / ITEMS_PER_PAGE) || 1;
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = (safePage - 1) * ITEMS_PER_PAGE;
  const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, filteredHistory.length);

  const paginatedHistory = useMemo(() => {
    return filteredHistory.slice(startIndex, endIndex);
  }, [filteredHistory, startIndex, endIndex]);

  const renderPaginationBar = (currPage, totalItems, onPageChange) => {
    const totalPg = Math.max(1, Math.ceil(totalItems / ITEMS_PER_PAGE));
    if (totalItems <= ITEMS_PER_PAGE) return null;
    const startIdx = (currPage - 1) * ITEMS_PER_PAGE + 1;
    const endIdx = Math.min(currPage * ITEMS_PER_PAGE, totalItems);

    const pages = [];
    for (let i = 1; i <= totalPg; i++) {
      if (i === 1 || i === totalPg || (i >= currPage - 1 && i <= currPage + 1)) {
        pages.push(i);
      } else if (pages[pages.length - 1] !== '...') {
        pages.push('...');
      }
    }

    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          paddingTop: '14px',
          borderTop: '1px solid var(--dash-border)',
        }}
      >
        <div style={{ fontSize: '0.78125rem', color: '#64748B', fontWeight: 500 }}>
          Hiển thị <strong style={{ color: '#0F172A' }}>{startIdx}–{endIdx}</strong> trong tổng số{' '}
          <strong style={{ color: '#0F172A' }}>{totalItems}</strong> bản ghi ({ITEMS_PER_PAGE} bản ghi / trang)
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            type="button"
            disabled={currPage <= 1}
            onClick={() => onPageChange(Math.max(1, currPage - 1))}
            style={{
              padding: '5px 10px',
              fontSize: '0.75rem',
              fontWeight: 600,
              borderRadius: '6px',
              border: '1px solid #CBD5E1',
              backgroundColor: currPage <= 1 ? '#F8FAFC' : '#FFFFFF',
              color: currPage <= 1 ? '#94A3B8' : '#334155',
              cursor: currPage <= 1 ? 'not-allowed' : 'pointer',
            }}
          >
            &laquo; Trước
          </button>

          {pages.map((p, idx) =>
            p === '...' ? (
              <span key={`ellipsis-${idx}`} style={{ padding: '0 4px', color: '#94A3B8', fontSize: '0.75rem' }}>
                ...
              </span>
            ) : (
              <button
                key={p}
                type="button"
                onClick={() => onPageChange(p)}
                style={{
                  minWidth: '30px',
                  height: '30px',
                  padding: '0 8px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  fontFamily: 'var(--font-mono)',
                  borderRadius: '6px',
                  border: currPage === p ? '1px solid #2563EB' : '1px solid #CBD5E1',
                  backgroundColor: currPage === p ? '#2563EB' : '#FFFFFF',
                  color: currPage === p ? '#FFFFFF' : '#334155',
                  cursor: 'pointer',
                }}
              >
                {p}
              </button>
            )
          )}

          <button
            type="button"
            disabled={currPage >= totalPg}
            onClick={() => onPageChange(Math.min(totalPg, currPage + 1))}
            style={{
              padding: '5px 10px',
              fontSize: '0.75rem',
              fontWeight: 600,
              borderRadius: '6px',
              border: '1px solid #CBD5E1',
              backgroundColor: currPage >= totalPg ? '#F8FAFC' : '#FFFFFF',
              color: currPage >= totalPg ? '#94A3B8' : '#334155',
              cursor: currPage >= totalPg ? 'not-allowed' : 'pointer',
            }}
          >
            Sau &raquo;
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="dashboard-action-history-page" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <History size={22} color="var(--dash-primary)" />
            <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--dash-text-primary)', letterSpacing: '-0.02em', margin: 0 }}>
              Lịch Sử Tự Phục Hồi & Báo Cáo Hiệu Quả MTTR
            </h1>
          </div>
          <p style={{ fontSize: '0.8125rem', color: 'var(--dash-text-secondary)', marginTop: '4px', margin: 0 }}>
            Tổ chức: <strong style={{ color: 'var(--dash-text-primary)' }}>{currentOrg?.name || 'Tổ chức hiện tại'}</strong> &bull; Cụm K8s:{' '}
            <span style={{ fontWeight: 600, color: 'var(--dash-primary)' }}>{currentEnv?.name || currentEnv?.cluster || 'Tất cả cụm'}</span> &bull; Dữ liệu lưu vết thực tế từ cơ sở dữ liệu
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing || isLoading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              backgroundColor: '#FFFFFF',
              border: '1px solid var(--dash-border)',
              borderRadius: 'var(--dash-radius-md)',
              fontSize: '0.8125rem',
              fontWeight: 600,
              cursor: isRefreshing || isLoading ? 'not-allowed' : 'pointer',
            }}
          >
            <RefreshCw size={14} className={isRefreshing || isLoading ? 'animate-spin' : ''} />
            <span>Làm mới lịch sử</span>
          </button>
        </div>
      </div>

      {/* UNIFIED FILTER BAR - BỘ LỌC ĐẸP MẮT CHUẨN NHƯ TRANG SỰ CỐ */}
      <div
        className="dash-card"
        style={{
          padding: '14px 18px',
          backgroundColor: '#FFFFFF',
          border: '1px solid var(--dash-border)',
          borderRadius: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
        }}
      >
        {/* Row 1: Time Range Selection (Bộ Lọc Lịch) */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.8125rem', fontWeight: 700, color: '#334155' }}>
              <Calendar size={15} color="var(--dash-primary)" />
              <span>Thời Gian:</span>
            </div>

            {/* Nút 1: Chọn ngày là đầu tiên (Nút Hôm Nay) */}
            <button
              type="button"
              onClick={() => {
                setTimeFilterMode('today');
                setSelectedDate(getTodayStr());
                setIsCalendarOpen(false);
              }}
              style={{
                height: '32px',
                padding: '0 12px',
                fontSize: '0.75rem',
                fontWeight: 700,
                borderRadius: '6px',
                border: timeFilterMode === 'today' ? '1px solid #10B981' : '1px solid var(--dash-border)',
                backgroundColor: timeFilterMode === 'today' ? 'rgba(16, 185, 129, 0.12)' : '#F8FAFC',
                color: timeFilterMode === 'today' ? '#047857' : 'var(--dash-text-primary)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                boxShadow: timeFilterMode === 'today' ? '0 1px 2px rgba(16, 185, 129, 0.15)' : 'none',
              }}
              title="Lọc nhanh toàn bộ hành động tự phục hồi trong ngày hôm nay"
            >
              <span
                style={{
                  width: '7px',
                  height: '7px',
                  borderRadius: '50%',
                  backgroundColor: timeFilterMode === 'today' ? '#10B981' : '#94A3B8',
                  boxShadow: timeFilterMode === 'today' ? '0 0 6px #10B981' : 'none',
                }}
              />
              Hôm nay
            </button>

            {/* Nút 2: Logo Lịch bên cạnh mở Popover chọn Ngày, Tháng, Năm */}
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
                  border: isCalendarOpen || timeFilterMode !== 'today' ? '1px solid #3B82F6' : '1px solid var(--dash-border)',
                  backgroundColor: timeFilterMode !== 'today' ? '#EFF6FF' : '#FFFFFF',
                  color: timeFilterMode !== 'today' ? '#1D4ED8' : 'var(--dash-text-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  boxShadow: isCalendarOpen ? '0 0 0 2px rgba(59, 130, 246, 0.2)' : 'none',
                  transition: 'all 0.15s ease',
                }}
                title="Mở bảng lịch chọn ngày, tháng hoặc năm"
              >
                <Calendar size={14} color={timeFilterMode !== 'today' ? '#2563EB' : 'var(--dash-primary)'} />
                <span>{currentFilterLabel}</span>
                <ChevronDown size={12} color={timeFilterMode !== 'today' ? '#2563EB' : 'var(--dash-text-secondary)'} />
              </button>

              {/* Cửa Sổ Popover Lịch Đẹp Mắt */}
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
                  {/* Tabs Chế Độ: Ngày | Tháng | Năm | Tất Cả */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px', backgroundColor: '#F1F5F9', padding: '3px', borderRadius: '8px' }}>
                    <button
                      type="button"
                      onClick={() => setTimeFilterMode('date')}
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
                      onClick={() => setTimeFilterMode('month')}
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
                      onClick={() => setTimeFilterMode('year')}
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
                    <button
                      type="button"
                      onClick={() => {
                        setTimeFilterMode('all');
                        setIsCalendarOpen(false);
                      }}
                      style={{
                        padding: '6px 2px',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        borderRadius: '6px',
                        border: 'none',
                        backgroundColor: timeFilterMode === 'all' ? '#FFFFFF' : 'transparent',
                        color: timeFilterMode === 'all' ? '#0F172A' : '#64748B',
                        boxShadow: timeFilterMode === 'all' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                        cursor: 'pointer',
                      }}
                    >
                      🌐 Tất cả
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
                          Ngày có hành động gần đây:
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {['2026-10-31', '2026-10-30', '2026-10-29', '2026-10-28', '2026-10-27'].map((dStr) => {
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
                        onChange={(e) => setSelectedMonth(e.target.value)}
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

                      {/* Quick Month Grid */}
                      <div style={{ marginTop: '10px' }}>
                        <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#94A3B8', marginBottom: '6px' }}>
                          Chọn nhanh các tháng trong năm:
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px' }}>
                          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((mNum) => {
                            const mStr = `${selectedYear || getThisYearStr()}-${String(mNum).padStart(2, '0')}`;
                            const isSelected = selectedMonth === mStr;
                            return (
                              <button
                                key={mNum}
                                type="button"
                                onClick={() => {
                                  setSelectedMonth(mStr);
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
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {isFiltered && (
              <button
                type="button"
                onClick={handleResetFilters}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '4px 8px',
                  borderRadius: '6px',
                  border: '1px solid #FECACA',
                  backgroundColor: '#FEF2F2',
                  color: '#B91C1C',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <RotateCcw size={12} />
                <span>Đặt lại</span>
              </button>
            )}

            <div style={{ fontSize: '0.75rem', color: '#64748B' }}>
              Khớp: <strong style={{ color: 'var(--dash-primary)' }}>{filteredHistory.length}</strong> / {actions.length} ca
            </div>
          </div>
        </div>

        {/* Row 2: Criteria Filters (Service, Status, Action Type, Search) */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', paddingTop: '10px', borderTop: '1px dashed #E2E8F0' }}>
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            {/* Service Dropdown */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Server size={14} color="#64748B" />
              <select
                value={selectedService}
                onChange={(e) => setSelectedService(e.target.value)}
                style={{
                  height: '32px',
                  padding: '0 8px',
                  fontSize: '0.75rem',
                  border: '1px solid #CBD5E1',
                  borderRadius: '6px',
                  backgroundColor: '#FFFFFF',
                  color: '#1E293B',
                  fontWeight: 500,
                  outline: 'none',
                }}
              >
                <option value="ALL">Tất cả dịch vụ ({uniqueServices.length})</option>
                {uniqueServices.map((svc) => (
                  <option key={svc} value={svc}>Dịch vụ: {svc}</option>
                ))}
              </select>
            </div>

            {/* Status Dropdown */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Zap size={14} color="#64748B" />
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                style={{
                  height: '32px',
                  padding: '0 8px',
                  fontSize: '0.75rem',
                  border: '1px solid #CBD5E1',
                  borderRadius: '6px',
                  backgroundColor: '#FFFFFF',
                  color: '#1E293B',
                  fontWeight: 500,
                  outline: 'none',
                }}
              >
                <option value="ALL">Tất cả trạng thái</option>
                <option value="SUCCEEDED">Thành công (SUCCEEDED)</option>
                <option value="PENDING">Chờ duyệt (PENDING)</option>
                <option value="FAILED">Thất bại (FAILED)</option>
                <option value="CANCELLED">Đã hủy bỏ (CANCELLED)</option>
                <option value="RUNNING">Đang thực thi (RUNNING)</option>
              </select>
            </div>

            {/* Action Type Dropdown */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Filter size={14} color="#64748B" />
              <select
                value={selectedActionType}
                onChange={(e) => setSelectedActionType(e.target.value)}
                style={{
                  height: '32px',
                  padding: '0 8px',
                  fontSize: '0.75rem',
                  border: '1px solid #CBD5E1',
                  borderRadius: '6px',
                  backgroundColor: '#FFFFFF',
                  color: '#1E293B',
                  fontWeight: 500,
                  outline: 'none',
                  maxWidth: '220px',
                }}
              >
                <option value="ALL">Tất cả hành động ({allActionTypes.length} loại chuẩn)</option>
                {allActionTypes.map((t) => (
                  <option key={t.code} value={t.code}>{t.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Search Box */}
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              placeholder="Tìm kiếm hành động, đối tượng..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                height: '32px',
                width: '240px',
                padding: '0 10px 0 28px',
                fontSize: '0.75rem',
                border: '1px solid var(--dash-border)',
                borderRadius: '6px',
                backgroundColor: '#F8FAFC',
                outline: 'none',
              }}
            />
            <Search size={13} style={{ position: 'absolute', left: '8px', top: '9px', color: 'var(--dash-text-muted)' }} />
          </div>
        </div>
      </div>

      {/* Embedded Self-Healing Trend Chart (Được đồng bộ bộ lọc) */}
      <SelfHealingTrendChart
        actions={filteredHistory}
        analytics={dynamicAnalytics}
        title={`Xu Hướng Phục Hồi Tự Động & Thời Gian MTTR (${currentFilterLabel})`}
      />

      {/* History Records Table (Được đồng bộ bộ lọc) */}
      <div className="dash-card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '14px' }}>
          <div>
            <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--dash-text-primary)', margin: 0 }}>
              Nhật Ký Hành Động Đã Lọc ({filteredHistory.length} ca)
            </h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--dash-text-secondary)', margin: '2px 0 0 0' }}>
              Thời gian hồi phục trung bình: <strong style={{ color: '#059669' }}>{dynamicAnalytics.averageRecoveryTime}</strong> &bull; Tỷ lệ thành công:{' '}
              <strong style={{ color: '#059669' }}>{dynamicAnalytics.successRate}</strong> &bull; Nhấp vào hàng để xem chi tiết
            </p>
          </div>
        </div>

        <div className="dash-table-container" style={{ border: '1px solid var(--dash-border)', borderRadius: '10px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--dash-bg-canvas)', borderBottom: '1px solid var(--dash-border)', textAlign: 'left' }}>
                <th style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: 'var(--dash-text-secondary)' }}>MÃ BẢN GHI</th>
                <th style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: 'var(--dash-text-secondary)' }}>HÀNH ĐỘNG & NỘI DUNG</th>
                <th style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: 'var(--dash-text-secondary)' }}>ĐỐI TƯỢNG (TARGET)</th>
                <th style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: 'var(--dash-text-secondary)' }}>THỜI LƯỢNG</th>
                <th style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: 'var(--dash-text-secondary)' }}>KẾT QUẢ KIỂM TRA</th>
                <th style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: 'var(--dash-text-secondary)' }}>THỜI ĐIỂM</th>
                <th style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: 'var(--dash-text-secondary)', textAlign: 'center' }}>CHI TIẾT</th>
              </tr>
            </thead>
            <tbody>
              {filteredHistory.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '36px 20px', color: 'var(--dash-text-muted)' }}>
                    <ShieldCheck size={32} color="#059669" style={{ margin: '0 auto 8px', display: 'block' }} />
                    <div style={{ fontWeight: 600, color: 'var(--dash-text-primary)' }}>Không có bản ghi lịch sử nào phù hợp</div>
                    <div style={{ fontSize: '0.75rem', marginTop: '2px' }}>
                      Không tìm thấy hành động tự phục hồi nào khớp với mốc thời gian hoặc tiêu chí đã lọc.
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedHistory.map((rec) => {
                  const isSucceeded = rec.status === 'SUCCEEDED';
                  const isCancelled = rec.status === 'CANCELLED';
                  const isFailed = rec.status === 'FAILED';

                  let statusColor = '#059669';
                  if (isCancelled) statusColor = '#D97706';
                  if (isFailed) statusColor = '#DC2626';

                  return (
                    <tr
                      key={rec.id}
                      onClick={() => setSelectedAction({ id: rec.rawId, item: rec.rawItem })}
                      style={{
                        borderBottom: '1px solid #F1F5F9',
                        cursor: 'pointer',
                        transition: 'background-color 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#F8FAFC';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      <td style={{ padding: '12px 14px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--dash-text-primary)' }}>
                        <span style={{ borderBottom: '1px dashed #CBD5E1' }}>{rec.id}</span>
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ fontWeight: 700, color: 'var(--dash-text-primary)' }}>{rec.title}</div>
                        <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', fontFamily: 'var(--font-mono)' }}>
                          Chính sách: {rec.policy}
                        </div>
                        {rec.errorMessage && (
                          <div style={{ fontSize: '0.6875rem', color: '#DC2626', marginTop: '2px' }}>
                            Lý do: {rec.errorMessage}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '12px 14px', fontFamily: 'var(--font-mono)', color: 'var(--dash-primary)' }}>
                        <div>{rec.target}</div>
                        <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)' }}>ns: {rec.namespace}</div>
                      </td>
                      <td style={{ padding: '12px 14px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: statusColor }}>
                        {rec.mttr}
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: statusColor, fontWeight: 600 }}>
                          {isSucceeded && <CheckCircle2 size={13} />}
                          {isCancelled && <XCircle size={13} />}
                          {isFailed && <AlertCircle size={13} />}
                          <span>{rec.result}</span>
                        </div>
                        <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)' }}>{rec.verifiedBy}</div>
                      </td>
                      <td style={{ padding: '12px 14px', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--dash-text-secondary)' }}>
                        {rec.timestamp}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedAction({ id: rec.rawId, item: rec.rawItem });
                          }}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '4px 10px',
                            borderRadius: '6px',
                            border: '1px solid #CBD5E1',
                            backgroundColor: '#FFFFFF',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            color: 'var(--dash-text-primary)',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = '#F1F5F9';
                            e.currentTarget.style.borderColor = 'var(--dash-primary)';
                            e.currentTarget.style.color = 'var(--dash-primary)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = '#FFFFFF';
                            e.currentTarget.style.borderColor = '#CBD5E1';
                            e.currentTarget.style.color = 'var(--dash-text-primary)';
                          }}
                        >
                          <Eye size={13} />
                          <span>Chi tiết</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Phân trang */}
        {renderPaginationBar(safePage, filteredHistory.length, setCurrentPage)}
      </div>

      {/* Action Detail Modal */}
      {selectedAction && (
        <ActionDetailModal
          actionId={selectedAction.id}
          initialItem={selectedAction.item}
          onClose={() => setSelectedAction(null)}
        />
      )}
    </div>
  );
};

export default ActionHistoryPage;
