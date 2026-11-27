import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { getIntlLocale } from '../../../i18n';
import { useDashboard } from '../context/DashboardContext';
import { selfHealingService } from '../../../services/selfHealingService';
import { aiService } from '../../../services/aiService';
import { extractActiveK8sServices } from '../../../utils/k8sServiceFilter';
import { translateActionMessageToVi } from '../Incidents/incidentUtils';
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
  Filter,
  BarChart2,
  AlertTriangle,
  X,
} from 'lucide-react';

const CANONICAL_ACTION_CODES = [
  'RESTART_POD',
  'SCALE_REPLICAS',
  'ROLLBACK_DEPLOYMENT',
  'REPLACE_POD',
  'CLEANUP_TEMP_FILES',
  'RESTART_DEPLOYMENT',
  'ADJUST_RESOURCE_LIMITS',
  'DRAIN_NODE',
  'BLOCK_IP_TEMP',
  'NO_ACTION',
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

export const ActionHistoryPage = ({ onNavigate }) => {
  const { t, i18n: i18nInstance } = useTranslation('dashHealing');
  const { currentOrg, currentEnv } = useDashboard();
  const [searchTerm, setSearchTerm] = useState('');
  const [rawActions, setRawActions] = useState([]);
  const [, setAnalytics] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [, setIsUsingLiveDb] = useState(true);
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
  const [liveWorkloads, setLiveWorkloads] = useState([]);
  const [showTrendChart, setShowTrendChart] = useState(false);

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
      return t('incidents.calendar.todayLabel', { date: `${parts[2]}/${parts[1]}/${parts[0]}` });
    }
    if (timeFilterMode === 'date') {
      if (!selectedDate) return t('common.selectDate');
      const parts = selectedDate.split('-');
      const isToday = selectedDate === getTodayStr();
      const dFormatted = `${parts[2]}/${parts[1]}/${parts[0]}`;
      return isToday ? t('incidents.calendar.todayLabel', { date: dFormatted }) : dFormatted;
    }
    if (timeFilterMode === 'month') {
      if (!selectedMonth) return t('common.selectMonth');
      const parts = selectedMonth.split('-');
      return t('incidents.calendar.monthLabel', { month: `${parts[1]}/${parts[0]}` });
    }
    if (timeFilterMode === 'year') {
      return t('incidents.calendar.yearLabel', { year: selectedYear });
    }
    const parts = getTodayStr().split('-');
    return t('incidents.calendar.todayLabel', { date: `${parts[2]}/${parts[1]}/${parts[0]}` });
  }, [timeFilterMode, selectedDate, selectedMonth, selectedYear, t]);

  const activeClusterId = useMemo(() => {
    return currentEnv?.id || currentEnv?.clusterId || currentEnv?.cluster || '';
  }, [currentEnv?.id, currentEnv?.clusterId, currentEnv?.cluster]);

  const activeOrgId = useMemo(() => {
    return currentOrg?.id || '';
  }, [currentOrg?.id]);

  const formatRelativeTime = useCallback((dateStr) => {
    if (!dateStr) return t('common.justNow');
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return t('common.justNow');
    if (mins < 60) return t('common.minutesAgo', { count: mins });
    const hours = Math.floor(mins / 60);
    if (hours < 24) return t('common.hoursAgo', { count: hours });
    const days = Math.floor(hours / 24);
    return t('common.daysAgo', { count: days });
  }, [t]);

  const mapBackendActionToUI = useCallback((item) => {
    const shortId = item.id && item.id.length > 8 ? `ACT-${item.id.slice(0, 8).toUpperCase()}` : (item.id || 'N/A');

    let computedDurationMs = 0;
    if (item.started_at && item.completed_at) {
      const s = new Date(item.started_at).getTime();
      const e = new Date(item.completed_at).getTime();
      if (!isNaN(s) && !isNaN(e) && e >= s) {
        computedDurationMs = e - s;
      }
    }
    if (!computedDurationMs) {
      computedDurationMs = item.result?.duration_ms || item.attempts?.[0]?.duration_ms || (item.elapsed_seconds ? Math.round(item.elapsed_seconds * 1000) : 0);
    }
    const mttrSec = computedDurationMs > 0
      ? `${(computedDurationMs / 1000).toFixed(1)}s`
      : (item.execution_status === 'RUNNING' ? t('actionHistory.mapped.running') : (item.execution_status === 'PENDING' ? t('actionHistory.mapped.pending') : '0.1s'));

    // Strip WORKLOAD/ or any other prefix from target name
    const rawTarget = item.target_name || item.target_id || t('common.unknown');
    let targetName = String(rawTarget).replace(/^[A-Za-z0-9_-]+\//i, '').trim();
    const lTarget = targetName.toLowerCase();
    if (lTarget === 'otel-collector-opentelemetry-collector') targetName = 'opentelemetry-collector';
    else if (lTarget === 'prometheus-kube-state-metrics') targetName = 'kube-state-metrics';
    else if (lTarget === 'prometheus-kube-prometheus-operator') targetName = 'kube-prometheus-stack-operator';
    else if (lTarget === 'ecommerce-store') targetName = 'ecommerce-store-app';
    else if (/^mongodb-\d+$/i.test(lTarget)) targetName = 'mongodb';

    const resolvedNs = item.result?.details?.namespace ||
      item.result?.namespace ||
      item.namespace ||
      (item.result?.message?.match(/namespace "([^"]+)"/)?.[1]) ||
      (item.error_message?.match(/namespace "([^"]+)"/)?.[1]) ||
      'default';

    const rawActionCode = item.action_type_code || item.action_type_name || t('incidentUtils.actions.DEFAULT');
    let actionFriendlyName = rawActionCode;
    const upperCode = String(rawActionCode).toUpperCase();
    if (upperCode.includes('DRAIN')) actionFriendlyName = t('actionHistory.mapped.drain');
    else if (upperCode.includes('CORDON')) actionFriendlyName = t('actionHistory.mapped.cordon');
    else if (upperCode.includes('SCALE')) actionFriendlyName = t('actionHistory.mapped.scale');
    else if (upperCode.includes('RESTART')) actionFriendlyName = t('actionHistory.mapped.restart');
    else if (upperCode.includes('REPLACE')) actionFriendlyName = t('actionHistory.mapped.replace');
    else if (upperCode.includes('ROLLBACK')) actionFriendlyName = t('actionHistory.mapped.rollback');
    else if (upperCode.includes('CLEANUP')) actionFriendlyName = t('actionHistory.mapped.cleanup');
    else if (upperCode.includes('BLOCK')) {
      const blockedIp =
        item.result?.details?.blocked_ip ||
        item.result?.params?.ip ||
        item.params?.ip ||
        item.result?.params?.source_ip ||
        item.params?.source_ip ||
        (item.result?.message && item.result.message.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/)?.[0]) ||
        (item.incident_title && item.incident_title.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/)?.[0]);
      actionFriendlyName = blockedIp ? t('actionHistory.mapped.blockIpVal', { ip: blockedIp }) : t('actionHistory.mapped.blockIp');
    }
    else if (upperCode.includes('NO_ACTION')) actionFriendlyName = t('actionHistory.mapped.noAction');

    const rawMsg = String(item.result?.message || item.error_message || '');
    let title = translateActionMessageToVi(rawMsg, targetName, actionFriendlyName, resolvedNs);
    const policyName = item.policy_name || t('actionHistory.mapped.policyDefault');

    const isWaitingApproval =
      item.execution_status !== 'COMPLETED' &&
      item.execution_status !== 'SUCCEEDED' &&
      item.execution_status !== 'FAILED' &&
      item.execution_status !== 'CANCELLED' &&
      (item.approval_status === 'PENDING' ||
       item.execution_status === 'PENDING' ||
       rawMsg.toLowerCase().includes('chờ phê duyệt') ||
       rawMsg.toLowerCase().includes('awaiting hitl'));

    let resultText = t('actionHistory.mapped.resultSuccess');
    let verified = '';
    let effectiveMttr = mttrSec;
    let effectiveStatus = item.execution_status || 'COMPLETED';

    if (isWaitingApproval) {
      resultText = t('actionHistory.mapped.resultPending');
      verified = '';
      effectiveMttr = t('actionHistory.mapped.pending');
      effectiveStatus = 'PENDING';
      if (!title || title.includes('Thực thi') || title.includes('Executed')) {
        title = t('actionHistory.mapped.pendingTitle', { action: actionFriendlyName, target: targetName });
      }
    } else if (item.execution_status === 'RUNNING') {
      resultText = t('actionHistory.mapped.resultRunning');
      verified = t('actionHistory.mapped.verifiedProcessing');
      effectiveMttr = t('actionHistory.mapped.running');
      effectiveStatus = 'RUNNING';
    } else if (item.execution_status === 'FAILED') {
      resultText = t('actionHistory.mapped.resultFailed');
      verified = item.verification?.verification_type ? t('actionHistory.mapped.verifiedFailedCheck') : '';
      effectiveStatus = 'FAILED';
    } else if (item.execution_status === 'CANCELLED') {
      resultText = t('actionHistory.mapped.resultCancelled');
      verified = '';
      effectiveMttr = '-';
      effectiveStatus = 'CANCELLED';
    } else if (item.execution_status === 'COMPLETED' || item.execution_status === 'SUCCEEDED') {
      const hasVerificationFailed =
        item.verification?.verification_result === false ||
        String(item.error_message || '').toLowerCase().includes('hậu kiểm thất bại') ||
        String(item.result?.message || '').toLowerCase().includes('hậu kiểm thất bại');

      if (hasVerificationFailed) {
        resultText = t('actionHistory.mapped.resultVerifFailed');
        verified = item.verification?.verification_type === 'K8S_POST_HEALING_PROBE'
          ? t('actionHistory.mapped.verifiedProbeAbnormal')
          : t('actionHistory.mapped.verifiedSloNotMet');
        effectiveStatus = 'VERIFICATION_FAILED';
      } else {
        resultText = t('actionHistory.mapped.resultSuccess');
        const rawVer = item.verification?.verification_type || '';
        verified = rawVer === 'K8S_POST_HEALING_PROBE' ? t('actionHistory.mapped.verifiedProbeOk') : (rawVer || t('actionHistory.mapped.verifiedSafe'));
        effectiveStatus = 'COMPLETED';
        if (title.toLowerCase().includes('chờ phê duyệt') || title.toLowerCase().includes('awaiting hitl')) {
          title = t('actionHistory.mapped.completedTitle', { action: actionFriendlyName, target: targetName });
        }
      }
    }

    // Làm gọn tiêu đề: Bỏ mã kỹ thuật (SCALE_REPLICAS), (Replicas) và bỏ cụm "theo chính sách ..." trong tiêu đề
    title = title.replace(/\s*\((SCALE_REPLICAS|RESTART_POD|ROLLBACK_DEPLOYMENT|NO_ACTION|Replicas)\)/gi, '');
    title = title.replace(/\s*theo chính sách\s+[A-Za-z0-9_-]+/gi, '');
    title = title.replace(/\s{2,}/g, ' ').trim();
    if (!title.endsWith('.')) title += '.';

    let cleanErr = item.error_message
      ? item.error_message.replace(/\s*\(Post-Action Verification Failed\):?/gi, ':').replace(/Post-Action Verification Failed:?\s*/gi, '').replace(/\s{2,}/g, ' ').trim()
      : null;

    if (cleanErr) {
      if (cleanErr.includes('Safety Guard Blocked') || cleanErr.includes('protected Kubernetes system namespace')) {
        const nsMatch = cleanErr.match(/Namespace '([^']+)'/i);
        const ns = nsMatch ? nsMatch[1] : (resolvedNs || 'selfheal-system');
        cleanErr = t('actionHistory.mapped.errSafetyGuard', { ns });
      } else if (cleanErr.includes('Auto-recovered') || cleanErr.includes('tự phục hồi ổn định')) {
        cleanErr = t('actionHistory.mapped.errAutoRecovered');
      } else if (cleanErr.includes('User') && (cleanErr.includes('cannot') || cleanErr.includes('Forbidden') || cleanErr.includes('(403)'))) {
        cleanErr = t('actionHistory.mapped.errRbac403');
      }
    }

    return {
      id: shortId,
      rawId: item.id,
      title,
      target: targetName,
      targetName,
      namespace: resolvedNs,
      policy: policyName,
      mttr: effectiveMttr,
      result: resultText,
      timestamp: formatRelativeTime(item.completed_at || item.created_at),
      verifiedBy: verified,
      status: effectiveStatus,
      errorMessage: cleanErr,
      rawItem: item,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t, formatRelativeTime, i18nInstance.language]);

  const actions = useMemo(
    () => rawActions.map(mapBackendActionToUI),
    [rawActions, mapBackendActionToUI]
  );

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
      setRawActions(items);
      setAnalytics(analyticsRes);
      setIsUsingLiveDb(true);
    } catch (err) {
      console.warn('[ActionHistoryPage] Lỗi tải lịch sử:', err.message);
      setRawActions([]);
      setIsUsingLiveDb(true);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [activeClusterId, activeOrgId]);

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

  // Tải danh sách Workloads ĐANG CHẠY THỰC TẾ trên cụm K8s (đã lọc deleted_at IS NULL & bỏ dịch vụ hệ thống/monitoring)
  const fetchLiveWorkloads = useCallback(async () => {
    try {
      const workloads = await aiService.getWorkloads(activeClusterId, activeOrgId);
      if (Array.isArray(workloads)) {
        setLiveWorkloads(workloads);
      }
    } catch (err) {
      setLiveWorkloads([]);
    }
  }, [activeClusterId, activeOrgId]);

  useEffect(() => {
    fetchLiveWorkloads();
  }, [fetchLiveWorkloads]);

  useEffect(() => {
    fetchActions();
  }, [fetchActions]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchLiveWorkloads();
    fetchActions();
  };

  // Danh sách Action Types chuẩn hóa
  const allActionTypes = useMemo(() => {
    const map = new Map();
    CANONICAL_ACTION_CODES.forEach((code) => {
      map.set(code, { code, label: t(`actionHistory.actionTypes.${code}`, code) });
    });
    dbActionTypes.forEach((item) => {
      const code = item.code || item.name;
      if (code) {
        const existing = map.get(code);
        map.set(code, {
          code,
          label: existing?.label || `${item.name || code} (${code})`,
          description: item.description || existing?.description,
        });
      }
    });
    return Array.from(map.values());
  }, [dbActionTypes, t]);

  // Danh sách Dịch vụ K8s đang hoạt động thực tế (từ GET /api/v1/ai/workloads, tuyệt đối không lấy dịch vụ cũ đã xóa)
  const uniqueServices = useMemo(() => {
    return extractActiveK8sServices(liveWorkloads);
  }, [liveWorkloads]);

  useEffect(() => {
    if (
      selectedService !== 'ALL' &&
      uniqueServices.length > 0 &&
      !uniqueServices.includes(selectedService)
    ) {
      setSelectedService('ALL');
    }
  }, [selectedService, uniqueServices]);

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
          const isWithin24Hours = (Date.now() - d.getTime()) <= 24 * 60 * 60 * 1000 && (Date.now() - d.getTime()) >= -60000;
          const isSameCalendarDay = itemDateStr === getTodayStr();
          if (!isWithin24Hours && !isSameCalendarDay) return false;
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
          if (item.status !== 'PENDING') return false;
        } else if (selectedStatus === 'SUCCEEDED' || selectedStatus === 'COMPLETED') {
          if (item.status !== 'SUCCEEDED' && item.status !== 'COMPLETED') return false;
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
    }).sort((a, b) => {
      const timeA = new Date(a.rawItem?.completed_at || a.rawItem?.started_at || a.rawItem?.created_at || 0).getTime();
      const timeB = new Date(b.rawItem?.completed_at || b.rawItem?.started_at || b.rawItem?.created_at || 0).getTime();
      return timeB - timeA;
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
    let finishedCount = 0;
    let pendingCount = 0;
    filteredHistory.forEach((a) => {
      if (a.status === 'PENDING' || a.executionStatus === 'PENDING') {
        pendingCount++;
        return;
      }
      finishedCount++;
      const dur = a.rawItem?.attempts?.[0]?.duration_ms
        ? a.rawItem.attempts[0].duration_ms / 1000
        : (parseFloat(a.mttr) || a.rawItem?.elapsed_seconds || 1.5);
      totalSec += dur;
      if (a.status === 'COMPLETED' || a.status === 'SUCCEEDED' || a.executionStatus === 'COMPLETED' || a.executionStatus === 'SUCCEEDED') succeededCount++;
    });
    return {
      totalActions: total,
      pendingCount,
      finishedCount,
      averageRecoveryTime: finishedCount > 0 ? `${(totalSec / finishedCount).toFixed(1)}s` : '0s',
      successRate: finishedCount > 0 ? `${Math.round((succeededCount / finishedCount) * 100)}%` : '100%',
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
          gap: '10px',
          padding: '11px 16px',
          backgroundColor: '#F8FAFC',
          borderTop: '1px solid #E2E8F0',
          fontFamily: 'var(--font-mono)',
          fontSize: '0.75rem',
        }}
      >
        <div style={{ color: '#64748B' }}>
          {t('actionHistory.pagination.showing')} <strong style={{ color: '#0F172A' }}>{startIdx}–{endIdx}</strong> /{' '}
          <strong style={{ color: '#0F172A' }}>{totalItems}</strong> {t('actionHistory.pagination.records')}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <button
            type="button"
            disabled={currPage <= 1}
            onClick={() => onPageChange(Math.max(1, currPage - 1))}
            style={{
              height: '28px',
              padding: '0 10px',
              fontSize: '0.74rem',
              fontWeight: 600,
              borderRadius: '7px',
              border: '1px solid #CBD5E1',
              backgroundColor: '#FFFFFF',
              color: currPage <= 1 ? '#94A3B8' : '#334155',
              cursor: currPage <= 1 ? 'not-allowed' : 'pointer',
              opacity: currPage <= 1 ? 0.55 : 1,
            }}
          >
            &laquo; {t('common.prevShort')}
          </button>

          {pages.map((p, idx) =>
            p === '...' ? (
              <span key={`ellipsis-${idx}`} style={{ padding: '0 4px', color: '#94A3B8', fontSize: '0.74rem' }}>
                ...
              </span>
            ) : (
              <button
                key={p}
                type="button"
                onClick={() => onPageChange(p)}
                style={{
                  minWidth: '28px',
                  height: '28px',
                  padding: '0 7px',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  fontFamily: 'var(--font-mono)',
                  borderRadius: '7px',
                  border: currPage === p ? '1px solid #059669' : '1px solid #CBD5E1',
                  backgroundColor: currPage === p ? '#059669' : '#FFFFFF',
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
              height: '28px',
              padding: '0 10px',
              fontSize: '0.74rem',
              fontWeight: 600,
              borderRadius: '7px',
              border: '1px solid #CBD5E1',
              backgroundColor: '#FFFFFF',
              color: currPage >= totalPg ? '#94A3B8' : '#334155',
              cursor: currPage >= totalPg ? 'not-allowed' : 'pointer',
              opacity: currPage >= totalPg ? 0.55 : 1,
            }}
          >
            {t('common.nextShort')} &raquo;
          </button>
        </div>
      </div>
    );
  };

  const activeClusterLabel = currentEnv?.cluster || currentEnv?.name || t('common.systemWide');

  const kpiCardStyle = (accent, isSelected = false) => ({
    backgroundColor: '#FFFFFF',
    border: isSelected ? `1px solid ${accent}` : '1px solid rgba(226, 232, 240, 0.95)',
    borderTop: `2.5px solid ${accent}`,
    borderRadius: '12px',
    padding: '11px 14px',
    boxShadow: isSelected ? `0 6px 18px ${accent}22` : '0 4px 16px rgba(15, 23, 42, 0.04)',
    minWidth: 0,
    transition: 'transform 0.14s ease, box-shadow 0.14s ease, border-color 0.14s ease',
  });

  const actionBtnStyle = (active = false, disabled = false) => ({
    height: '34px',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '0 12px',
    backgroundColor: active ? '#ECFDF5' : '#FFFFFF',
    border: active ? '1px solid #10B981' : '1px solid rgba(203, 213, 225, 0.9)',
    borderRadius: '10px',
    boxShadow: '0 2px 6px rgba(15, 23, 42, 0.04)',
    fontSize: '0.8rem',
    fontWeight: active ? 700 : 600,
    color: active ? '#047857' : disabled ? '#94A3B8' : '#334155',
    cursor: disabled ? 'not-allowed' : 'pointer',
    whiteSpace: 'nowrap',
    transition: 'all 0.15s ease',
  });

  const selectControlStyle = {
    height: '32px',
    padding: '0 10px',
    fontSize: '0.75rem',
    fontWeight: 600,
    border: '1px solid #CBD5E1',
    borderRadius: '8px',
    backgroundColor: '#F8FAFC',
    color: '#0F172A',
    outline: 'none',
    cursor: 'pointer',
  };

  return (
    <div className="dashboard-action-history-page" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <style>{`
        .history-table-row {
          transition: background-color 0.14s ease;
        }
        .history-table-row:hover {
          background-color: #F8FAFC !important;
        }
        .history-table-row--failed:hover {
          background-color: #FEF2F2 !important;
        }
        .history-detail-btn:hover {
          background-color: #ECFDF5 !important;
          border-color: #10B981 !important;
          color: #047857 !important;
        }
      `}</style>

      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '12px',
              backgroundColor: '#ECFDF5',
              border: '1px solid #A7F3D0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: '0 2px 8px rgba(16, 185, 129, 0.12)',
            }}
          >
            <History size={19} color="#059669" />
          </div>
          <div>
            <h1 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.02em', margin: 0 }}>
              {t('actionHistory.header.title')}
            </h1>
            <p style={{ fontSize: '0.8rem', color: '#64748B', margin: '2px 0 0 0' }}>
              {t('actionHistory.header.subtitlePrefix')}{' '}
              <strong style={{ color: '#0F172A', fontFamily: 'var(--font-mono)' }}>{activeClusterLabel}</strong>
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setShowTrendChart((prev) => !prev)}
            style={actionBtnStyle(showTrendChart, false)}
            title={showTrendChart ? t('actionHistory.header.hideChartTitle') : t('actionHistory.header.showChartTitle')}
          >
            <BarChart2 size={14} />
            <span>{showTrendChart ? t('actionHistory.header.hideChart') : t('actionHistory.header.showChart')}</span>
          </button>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing || isLoading}
            style={actionBtnStyle(false, isRefreshing || isLoading)}
          >
            <RefreshCw size={14} className={isRefreshing || isLoading ? 'animate-spin' : ''} />
            <span>{isRefreshing ? t('common.refreshing') : t('common.refresh')}</span>
          </button>
        </div>
      </div>

      {/* Hàng 4 Thẻ KPI Tóm Tắt */}
      <div className="dash-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '12px' }}>
        <div
          onClick={() => setSelectedStatus('ALL')}
          title={t('actionHistory.kpi.totalTooltip')}
          style={{ ...kpiCardStyle('#059669'), cursor: 'pointer' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748B', letterSpacing: '0.02em' }}>{t('actionHistory.kpi.totalTitle')}</span>
            <Activity size={14} color="#059669" />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '4px' }}>
            <span style={{ fontSize: '1.3rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#0F172A' }}>
              {(dynamicAnalytics.totalActions || 0).toLocaleString(getIntlLocale(i18nInstance.language))}
            </span>
            <span style={{ fontSize: '0.7rem', color: '#059669', fontWeight: 600 }}>
              {t('actionHistory.kpi.finishedCount', { count: dynamicAnalytics.finishedCount || 0 })}
            </span>
          </div>
        </div>

        <div
          onClick={() => setSelectedStatus((prev) => (prev === 'SUCCEEDED' ? 'ALL' : 'SUCCEEDED'))}
          title={t('actionHistory.kpi.rateTooltip')}
          style={{ ...kpiCardStyle('#10B981', selectedStatus === 'SUCCEEDED'), cursor: 'pointer' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748B', letterSpacing: '0.02em' }}>{t('actionHistory.kpi.rateTitle')}</span>
            <CheckCircle2 size={14} color="#10B981" />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '4px' }}>
            <span style={{ fontSize: '1.3rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#059669' }}>
              {dynamicAnalytics.successRate}
            </span>
            <span style={{ fontSize: '0.7rem', color: '#64748B' }}>{t('actionHistory.kpi.rateSub')}</span>
          </div>
        </div>

        <div style={kpiCardStyle('#3B82F6')}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748B', letterSpacing: '0.02em' }}>{t('actionHistory.kpi.mttrTitle')}</span>
            <Clock size={14} color="#3B82F6" />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '4px' }}>
            <span style={{ fontSize: '1.3rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#0F172A' }}>
              {dynamicAnalytics.averageRecoveryTime}
            </span>
            <span style={{ fontSize: '0.7rem', color: '#64748B' }}>{t('actionHistory.kpi.mttrSub')}</span>
          </div>
        </div>

        <div
          onClick={() => setSelectedStatus((prev) => (prev === 'PENDING' ? 'ALL' : 'PENDING'))}
          title={t('actionHistory.kpi.pendingTooltip')}
          style={{ ...kpiCardStyle('#F59E0B', selectedStatus === 'PENDING'), cursor: 'pointer' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748B', letterSpacing: '0.02em' }}>{t('actionHistory.kpi.pendingTitle')}</span>
            <ShieldCheck size={14} color="#F59E0B" />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '4px' }}>
            <span
              style={{
                fontSize: '1.3rem',
                fontWeight: 800,
                fontFamily: 'var(--font-mono)',
                color: dynamicAnalytics.pendingCount > 0 ? '#D97706' : '#0F172A',
              }}
            >
              {dynamicAnalytics.pendingCount || 0}
            </span>
            <span style={{ fontSize: '0.7rem', color: '#64748B' }}>
              {dynamicAnalytics.pendingCount > 0 ? t('actionHistory.kpi.pendingNeed') : t('actionHistory.kpi.pendingNone')}
            </span>
          </div>
        </div>
      </div>

      {/* Bộ Lọc Gọn 2 Hàng */}
      <div
        className="dash-card"
        style={{
          padding: '12px 16px',
          backgroundColor: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: '14px',
          boxShadow: '0 4px 16px rgba(15, 23, 42, 0.04)',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}
      >
        {/* Hàng 1: Tìm kiếm + Pill Trạng thái + Lịch */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
          {/* Search Box */}
          <div className="dash-search-box" style={{ position: 'relative', flex: '1 1 250px', maxWidth: '360px' }}>
            <input
              type="text"
              placeholder={t('actionHistory.filters.searchPlaceholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                height: '34px',
                width: '100%',
                padding: '0 30px 0 32px',
                fontSize: '0.78rem',
                border: '1px solid #CBD5E1',
                borderRadius: '9px',
                backgroundColor: '#F8FAFC',
                color: '#0F172A',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: '#94A3B8' }} />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                aria-label={t('actionHistory.filters.clearSearchAria')}
                style={{
                  position: 'absolute',
                  right: '8px',
                  top: '9px',
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  color: '#94A3B8',
                  padding: 0,
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Quick Status Pills */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '3px',
              backgroundColor: '#F8FAFC',
              padding: '3px',
              border: '1px solid #E2E8F0',
              borderRadius: '9px',
            }}
          >
            {[
              { id: 'ALL', label: t('actionHistory.filters.statusAll'), color: '#059669', bg: '#ECFDF5' },
              { id: 'SUCCEEDED', label: t('actionHistory.filters.statusSucceeded'), color: '#047857', bg: '#ECFDF5' },
              { id: 'PENDING', label: t('actionHistory.filters.statusPending'), color: '#D97706', bg: '#FFFBEB' },
              { id: 'FAILED', label: t('actionHistory.filters.statusFailed'), color: '#DC2626', bg: '#FEF2F2' },
              { id: 'CANCELLED', label: t('actionHistory.filters.statusCancelled'), color: '#475569', bg: '#F1F5F9' },
            ].map((st) => {
              const active = selectedStatus === st.id;
              return (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => setSelectedStatus(st.id)}
                  style={{
                    padding: '4px 9px',
                    borderRadius: '6px',
                    border: active ? `1px solid ${st.color}55` : '1px solid transparent',
                    backgroundColor: active ? st.bg : 'transparent',
                    color: active ? st.color : '#64748B',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.12s ease',
                  }}
                >
                  {st.label}
                </button>
              );
            })}
          </div>

          {/* Nút Lịch mở Popover chọn Ngày, Tháng, Năm */}
          <div style={{ position: 'relative' }} ref={calendarRef}>
            <button
              type="button"
              onClick={() => setIsCalendarOpen(!isCalendarOpen)}
              style={{
                height: '34px',
                padding: '0 11px',
                fontSize: '0.75rem',
                fontWeight: 700,
                borderRadius: '9px',
                border: isCalendarOpen ? '1px solid #10B981' : '1px solid #CBD5E1',
                backgroundColor: isCalendarOpen ? '#ECFDF5' : '#F8FAFC',
                color: isCalendarOpen ? '#047857' : '#0F172A',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              title={t('incidents.calendar.buttonTitle')}
            >
              <Calendar size={14} color={isCalendarOpen ? '#059669' : '#64748B'} />
              <span>{currentFilterLabel}</span>
              <ChevronDown size={12} color={isCalendarOpen ? '#059669' : '#64748B'} />
            </button>

            {isCalendarOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: '40px',
                  right: '0',
                  zIndex: 100,
                  width: '326px',
                  maxWidth: 'calc(100vw - 32px)',
                  backgroundColor: '#FFFFFF',
                  borderRadius: '12px',
                  border: '1px solid #E2E8F0',
                  boxShadow: '0 14px 32px -4px rgba(15, 23, 42, 0.14), 0 4px 10px -2px rgba(15, 23, 42, 0.06)',
                  padding: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
              >
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px', backgroundColor: '#F1F5F9', padding: '3px', borderRadius: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setTimeFilterMode('date')}
                    style={{
                      padding: '6px 4px',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      borderRadius: '6px',
                      border: 'none',
                      backgroundColor: timeFilterMode === 'date' || timeFilterMode === 'today' ? '#FFFFFF' : 'transparent',
                      color: timeFilterMode === 'date' || timeFilterMode === 'today' ? '#047857' : '#64748B',
                      boxShadow: timeFilterMode === 'date' || timeFilterMode === 'today' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                      cursor: 'pointer',
                    }}
                  >
                    {t('common.day')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setTimeFilterMode('month')}
                    style={{
                      padding: '6px 4px',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      borderRadius: '6px',
                      border: 'none',
                      backgroundColor: timeFilterMode === 'month' ? '#FFFFFF' : 'transparent',
                      color: timeFilterMode === 'month' ? '#047857' : '#64748B',
                      boxShadow: timeFilterMode === 'month' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                      cursor: 'pointer',
                    }}
                  >
                    {t('common.month')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setTimeFilterMode('year')}
                    style={{
                      padding: '6px 4px',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      borderRadius: '6px',
                      border: 'none',
                      backgroundColor: timeFilterMode === 'year' ? '#FFFFFF' : 'transparent',
                      color: timeFilterMode === 'year' ? '#047857' : '#64748B',
                      boxShadow: timeFilterMode === 'year' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                      cursor: 'pointer',
                    }}
                  >
                    {t('common.year')}
                  </button>
                </div>

                {(timeFilterMode === 'date' || timeFilterMode === 'today' || timeFilterMode === 'all') && (
                  <div>
                    <label style={{ fontSize: '0.7rem', fontWeight: 600, color: '#64748B', display: 'block', marginBottom: '4px' }}>
                      {t('incidents.calendar.pickExactDate')}
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
                        height: '34px',
                        padding: '0 10px',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        border: '1px solid #CBD5E1',
                        borderRadius: '8px',
                        backgroundColor: '#F8FAFC',
                        color: '#0F172A',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />

                    <div style={{ marginTop: '10px' }}>
                      <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#94A3B8', marginBottom: '6px' }}>
                        {t('actionHistory.calendar.last7Days')}
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {Array.from({ length: 7 }, (_, i) => {
                          const dt = new Date(Date.now() - i * 86400000);
                          return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
                        }).map((dStr) => {
                          const dParts = dStr.split('-');
                          const isToday = dStr === getTodayStr();
                          const isSelected = (timeFilterMode === 'today' && isToday) || (timeFilterMode === 'date' && selectedDate === dStr);
                          return (
                            <button
                              key={dStr}
                              type="button"
                              onClick={() => {
                                setTimeFilterMode(isToday ? 'today' : 'date');
                                setSelectedDate(dStr);
                                setIsCalendarOpen(false);
                              }}
                              style={{
                                padding: '4px 8px',
                                fontSize: '0.7rem',
                                fontWeight: isSelected ? 700 : 500,
                                borderRadius: '6px',
                                border: isSelected ? '1px solid #10B981' : '1px solid #E2E8F0',
                                backgroundColor: isSelected ? '#ECFDF5' : '#F8FAFC',
                                color: isSelected ? '#047857' : '#334155',
                                cursor: 'pointer',
                              }}
                            >
                              {isToday ? t('incidents.calendar.todayChip', { date: `${dParts[2]}/${dParts[1]}` }) : `${dParts[2]}/${dParts[1]}`}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {timeFilterMode === 'month' && (
                  <div>
                    <label style={{ fontSize: '0.7rem', fontWeight: 600, color: '#64748B', display: 'block', marginBottom: '4px' }}>
                      {t('incidents.calendar.pickMonthYear')}
                    </label>
                    <input
                      type="month"
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(e.target.value)}
                      style={{
                        width: '100%',
                        height: '34px',
                        padding: '0 10px',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        border: '1px solid #CBD5E1',
                        borderRadius: '8px',
                        backgroundColor: '#F8FAFC',
                        color: '#0F172A',
                        outline: 'none',
                        boxSizing: 'border-box',
                        marginBottom: '10px',
                      }}
                    />

                    <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#94A3B8', marginBottom: '6px' }}>
                      {t('incidents.calendar.monthsInYear', { year: selectedMonth?.split('-')[0] || '2026' })}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((mNum) => {
                        const mStr = `${selectedMonth?.split('-')[0] || '2026'}-${String(mNum).padStart(2, '0')}`;
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
                              fontSize: '0.7rem',
                              fontWeight: isSelected ? 700 : 500,
                              borderRadius: '6px',
                              border: isSelected ? '1px solid #10B981' : '1px solid #E2E8F0',
                              backgroundColor: isSelected ? '#ECFDF5' : '#F8FAFC',
                              color: isSelected ? '#047857' : '#334155',
                              cursor: 'pointer',
                              textAlign: 'center',
                            }}
                          >
                            {t('incidents.calendar.monthItem', { num: mNum })}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {timeFilterMode === 'year' && (
                  <div>
                    <label style={{ fontSize: '0.7rem', fontWeight: 600, color: '#64748B', display: 'block', marginBottom: '6px' }}>
                      {t('incidents.calendar.pickSurveyYear')}
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
                              padding: '9px 4px',
                              fontSize: '0.8rem',
                              fontWeight: isSelected ? 700 : 600,
                              borderRadius: '8px',
                              border: isSelected ? '1px solid #10B981' : '1px solid #E2E8F0',
                              backgroundColor: isSelected ? '#ECFDF5' : '#F8FAFC',
                              color: isSelected ? '#047857' : '#334155',
                              cursor: 'pointer',
                              textAlign: 'center',
                            }}
                          >
                            {t('incidents.calendar.yearItem', { year: yr })}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '8px', borderTop: '1px solid #F1F5F9', marginTop: '2px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
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
                        fontSize: '0.72rem',
                        color: '#059669',
                        fontWeight: 700,
                        cursor: 'pointer',
                        padding: 0,
                      }}
                    >
                      {t('common.today')}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTimeFilterMode('all');
                        setIsCalendarOpen(false);
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        fontSize: '0.72rem',
                        color: timeFilterMode === 'all' ? '#047857' : '#64748B',
                        fontWeight: 700,
                        cursor: 'pointer',
                        padding: 0,
                      }}
                    >
                      {t('common.all')}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsCalendarOpen(false)}
                    style={{
                      padding: '5px 12px',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      backgroundColor: '#059669',
                      color: '#FFFFFF',
                      borderRadius: '7px',
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    {t('common.apply')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Hàng 2: Dịch vụ, Loại hành động, Đặt lại & Tổng số */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
            paddingTop: '8px',
            borderTop: '1px solid #F1F5F9',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Server size={13} color="#64748B" />
              <select
                value={selectedService}
                onChange={(e) => setSelectedService(e.target.value)}
                style={selectControlStyle}
              >
                <option value="ALL">{t('actionHistory.filters.serviceAll', { count: uniqueServices.length })}</option>
                {uniqueServices.map((svc) => (
                  <option key={svc} value={svc}>{t('actionHistory.filters.serviceOption', { name: svc })}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Filter size={13} color="#64748B" />
              <select
                value={selectedActionType}
                onChange={(e) => setSelectedActionType(e.target.value)}
                style={{ ...selectControlStyle, maxWidth: '240px' }}
              >
                <option value="ALL">{t('actionHistory.filters.actionTypeAll')}</option>
                {allActionTypes.map((at) => (
                  <option key={at.code} value={at.code}>{at.label}</option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={handleResetFilters}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                height: '32px',
                padding: '0 10px',
                fontSize: '0.73rem',
                fontWeight: 700,
                color: isFiltered ? '#DC2626' : '#64748B',
                backgroundColor: isFiltered ? '#FEF2F2' : '#FFFFFF',
                border: isFiltered ? '1px solid #FECACA' : '1px solid #E2E8F0',
                borderRadius: '8px',
                cursor: 'pointer',
              }}
            >
              <RotateCcw size={12} />
              <span>{t('common.reset')}</span>
            </button>
          </div>

          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.73rem', color: '#64748B' }}>
            {t('actionHistory.filters.totalRecords')} <strong style={{ color: '#0F172A' }}>{filteredHistory.length}</strong> {t('actionHistory.filters.recordsUnit')} &bull; {t('common.page')}{' '}
            <strong style={{ color: '#0F172A' }}>{safePage}</strong>/{totalPages}
          </div>
        </div>
      </div>

      {/* Embedded Self-Healing Trend Chart */}
      {showTrendChart && (
        <SelfHealingTrendChart
          actions={filteredHistory}
          analytics={dynamicAnalytics}
          height={180}
          title={t('actionHistory.chart.title', { label: currentFilterLabel })}
          timeFilterMode={timeFilterMode}
          selectedDate={selectedDate}
          selectedMonth={selectedMonth}
          selectedYear={selectedYear}
        />
      )}

      {/* History Records Table */}
      <div
        className="dash-card"
        style={{
          padding: 0,
          overflow: 'hidden',
          backgroundColor: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: '14px',
          boxShadow: '0 4px 16px rgba(15, 23, 42, 0.04)',
        }}
      >
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
            <thead>
              <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', textAlign: 'left' }}>
                <th style={{ padding: '11px 16px', fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', fontWeight: 700, color: '#64748B', letterSpacing: '0.03em' }}>{t('actionHistory.table.colId')}</th>
                <th style={{ padding: '11px 16px', fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', fontWeight: 700, color: '#64748B', letterSpacing: '0.03em' }}>{t('actionHistory.table.colAction')}</th>
                <th style={{ padding: '11px 16px', fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', fontWeight: 700, color: '#64748B', letterSpacing: '0.03em' }}>{t('actionHistory.table.colTarget')}</th>
                <th style={{ padding: '11px 16px', fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', fontWeight: 700, color: '#64748B', letterSpacing: '0.03em' }}>{t('actionHistory.table.colDuration')}</th>
                <th style={{ padding: '11px 16px', fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', fontWeight: 700, color: '#64748B', letterSpacing: '0.03em' }}>{t('actionHistory.table.colResult')}</th>
                <th style={{ padding: '11px 16px', fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', fontWeight: 700, color: '#64748B', letterSpacing: '0.03em' }}>{t('actionHistory.table.colTimestamp')}</th>
                <th style={{ padding: '11px 16px', fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', fontWeight: 700, color: '#64748B', letterSpacing: '0.03em', textAlign: 'center' }}>{t('actionHistory.table.colDetail')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredHistory.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '52px 20px', color: '#64748B' }}>
                    <div
                      style={{
                        width: '46px',
                        height: '46px',
                        borderRadius: '14px',
                        backgroundColor: '#ECFDF5',
                        border: '1px solid #A7F3D0',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: '10px',
                      }}
                    >
                      <ShieldCheck size={24} color="#059669" />
                    </div>
                    <div style={{ fontWeight: 700, color: '#0F172A', fontSize: '0.9rem' }}>
                      {t('actionHistory.empty.title')}
                    </div>
                    <div style={{ fontSize: '0.78rem', marginTop: '4px', color: '#64748B' }}>
                      {t('actionHistory.empty.subtitle')}
                    </div>
                    {isFiltered && (
                      <button
                        type="button"
                        onClick={handleResetFilters}
                        style={{
                          marginTop: '10px',
                          padding: '7px 14px',
                          backgroundColor: '#ECFDF5',
                          color: '#047857',
                          border: '1px solid #A7F3D0',
                          borderRadius: '9px',
                          fontSize: '0.76rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        {t('common.resetFilters')}
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                paginatedHistory.map((rec) => {
                  const isSucceeded = rec.status === 'COMPLETED' || rec.status === 'SUCCEEDED';
                  const isCancelled = rec.status === 'CANCELLED';
                  const isFailed = rec.status === 'FAILED';
                  const isPending = rec.status === 'PENDING';
                  const isVerificationFailed = rec.status === 'VERIFICATION_FAILED';

                  let statusColor = '#047857';
                  let statusBg = '#ECFDF5';
                  let statusBorder = '#A7F3D0';
                  if (isPending || isCancelled || isVerificationFailed) {
                    statusColor = '#B45309';
                    statusBg = '#FFFBEB';
                    statusBorder = '#FDE68A';
                  }
                  if (isFailed) {
                    statusColor = '#DC2626';
                    statusBg = '#FEF2F2';
                    statusBorder = '#FECACA';
                  }

                  return (
                    <tr
                      key={rec.id}
                      className={`history-table-row${isFailed ? ' history-table-row--failed' : ''}`}
                      onClick={() => setSelectedAction({ id: rec.rawId, item: rec.rawItem })}
                      style={{
                        borderBottom: '1px solid #F1F5F9',
                        backgroundColor: isFailed ? 'rgba(254, 242, 242, 0.3)' : '#FFFFFF',
                        cursor: 'pointer',
                      }}
                    >
                      <td
                        style={{
                          padding: '12px 16px',
                          fontFamily: 'var(--font-mono)',
                          fontWeight: 700,
                          color: '#334155',
                          whiteSpace: 'nowrap',
                          borderLeft: isFailed ? '3px solid #EF4444' : isPending ? '3px solid #F59E0B' : '3px solid transparent',
                        }}
                      >
                        <span
                          style={{
                            backgroundColor: '#F8FAFC',
                            padding: '3px 8px',
                            borderRadius: '7px',
                            border: '1px solid #E2E8F0',
                            fontSize: '0.74rem',
                          }}
                        >
                          {rec.id}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 600, color: '#0F172A', lineHeight: 1.45, fontSize: '0.8rem' }}>{rec.title}</div>
                        {rec.errorMessage && (
                          <div style={{ fontSize: '0.72rem', color: '#DC2626', marginTop: '3px' }}>
                            {t('actionHistory.table.reasonPrefix')} {rec.errorMessage}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                        <div style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', fontSize: '0.76rem', color: '#047857' }}>
                          {rec.target}
                        </div>
                        <div style={{ marginTop: '3px' }}>
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '1px 6px',
                              borderRadius: '5px',
                              backgroundColor: '#F1F5F9',
                              border: '1px solid #E2E8F0',
                              fontSize: '0.66rem',
                              fontFamily: 'var(--font-mono)',
                              fontWeight: 600,
                              color: '#475569',
                            }}
                          >
                            ns: {rec.namespace}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.78rem', color: statusColor, whiteSpace: 'nowrap' }}>
                        {rec.mttr}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              padding: '3px 9px',
                              borderRadius: '999px',
                              backgroundColor: statusBg,
                              color: statusColor,
                              border: `1px solid ${statusBorder}`,
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              width: 'fit-content',
                            }}
                          >
                            {isPending && <Clock size={12} />}
                            {isVerificationFailed && <AlertTriangle size={12} />}
                            {isSucceeded && <CheckCircle2 size={12} />}
                            {isCancelled && <XCircle size={12} />}
                            {isFailed && <AlertCircle size={12} />}
                            <span>{rec.result}</span>
                          </span>
                          {isPending && onNavigate && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onNavigate(`/dashboard/self-healing/approvals?target=${encodeURIComponent(rec.target)}`);
                              }}
                              style={{
                                padding: '2px 8px',
                                fontSize: '0.6875rem',
                                fontWeight: 700,
                                backgroundColor: '#FEF3C7',
                                color: '#B45309',
                                border: '1px solid #FDE68A',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                width: 'fit-content',
                              }}
                              title={t('actionHistory.table.approveNowTitle')}
                            >
                              <span>{t('actionHistory.table.approveNow')}</span>
                            </button>
                          )}
                        </div>
                        {rec.verifiedBy ? (
                          <div style={{ fontSize: '0.68rem', color: '#94A3B8', marginTop: '3px' }}>{rec.verifiedBy}</div>
                        ) : null}
                      </td>
                      <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', fontSize: '0.74rem', color: '#64748B', whiteSpace: 'nowrap' }}>
                        {rec.timestamp}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <button
                          type="button"
                          className="history-detail-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedAction({ id: rec.rawId, item: rec.rawItem });
                          }}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            height: '28px',
                            padding: '0 10px',
                            borderRadius: '8px',
                            border: '1px solid #E2E8F0',
                            backgroundColor: '#F8FAFC',
                            fontSize: '0.74rem',
                            fontWeight: 700,
                            color: '#334155',
                            cursor: 'pointer',
                            transition: 'all 0.14s ease',
                          }}
                        >
                          <Eye size={12} />
                          <span>{t('common.details')}</span>
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
