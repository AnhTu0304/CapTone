import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useDashboard } from '../context/DashboardContext';
import { aiService } from '../../../services/aiService';
import { clusterService } from '../../../services/clusterService';
import RootCauseModal from './RootCauseModal';
import { translateIncidentTitle, translateSeverity } from './incidentUtils';
import {
  extractActiveK8sServices,
  normalizeK8sServiceName,
} from '../../../utils/k8sServiceFilter';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Search,
  RefreshCw,
  RotateCcw,
  Zap,
  Layers,
  Eye,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Calendar,
  ChevronDown,
  Activity,
  X,
} from 'lucide-react';

// Helper lấy chuỗi ngày tháng năm theo giờ địa phương
const getTodayStr = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const getThisMonthStr = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
};

const getThisYearStr = () => {
  return String(new Date().getFullYear());
};


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

// Chuẩn hóa confidence: không tự gán mặc định, giữ nguyên giá trị 0, trả về null nếu không hợp lệ
const parseConfidence = (val) => {
  if (val === null || val === undefined || val === '') {
    return null;
  }
  const num = Number(val);
  if (!Number.isFinite(num) || num < 0 || num > 100) {
    return null;
  }
  return Math.round(num <= 1 ? num * 100 : num);
};

// Helper chuyển ngữ tiêu đề sự cố và mức độ sang tiếng Việt
export { translateIncidentTitle, translateSeverity };

// Danh sách trắng cho phép loại rủi ro dự báo hợp lệ (ngăn chặn việc lấy tên hành động thay cho rủi ro)
const VALID_RISKS = new Set([
  'OOM',
  'CPU_OVERLOAD',
  'DISK_FULL',
  'HIGH_LATENCY',
  'HTTP_5XX_SPIKE',
  'TRAFFIC_OVERLOAD',
  'UNSTABLE_POD',
  'POD_INSTABILITY',
  'SCALE_DOWN_CANDIDATE',
]);

// Danh sách các workload kinh doanh và hạ tầng chuẩn của hệ thống
const KNOWN_SERVICES = [
  'attack-injector-app',
  'chaos-testagent2',
  'ecommerce-store-app',
  'mongodb',
  'selfheal-test-app',
  'sme-order-service',
  'opentelemetry-collector',
  'kube-state-metrics',
  'kube-prometheus-stack-operator',
  'prometheus',
  'prometheus-node-exporter',
];

const cleanServiceName = (raw) => {
  if (!raw || typeof raw !== 'string') return null;
  let s = raw.trim();
  s = s.replace(/^dịch vụ\s+/i, '').replace(/^service\s+/i, '').replace(/^pod[\/:]\s*/i, '');
  s = s.replace(/['".,;:)]+$/, '').replace(/^['"(]+/, '').trim();
  const lower = s.toLowerCase();
  if (lower === 'ecommerce-store') return 'ecommerce-store-app';
  if (/^mongodb-\d+$/i.test(lower)) return 'mongodb';
  if (lower === 'otel-collector-opentelemetry-collector') return 'opentelemetry-collector';
  if (lower === 'prometheus-kube-state-metrics') return 'kube-state-metrics';
  if (lower === 'prometheus-kube-prometheus-operator') return 'kube-prometheus-stack-operator';
  if (KNOWN_SERVICES.includes(lower)) {
    return lower;
  }
  // Loại bỏ các câu văn mô tả dài hoặc chứa khoảng trắng
  if (/^[a-zA-Z0-9][a-zA-Z0-9_.-]{1,80}$/.test(s)) {
    // Không nhận chuỗi UUID làm tên dịch vụ hiển thị
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) {
      return null;
    }
    return s;
  }
  return null;
};

const resolveServiceName = (item, registeredWorkloads = []) => {
  // 1. Kiểm tra trường do Backend cung cấp
  const candidate = item.service_name || item.workload_name || item.target_name || item.service;
  const cleaned = cleanServiceName(candidate);
  if (cleaned) return cleaned;

  // 2. Tra cứu qua registeredWorkloads nếu item.target_id khớp id hoặc name
  if (item.target_id && Array.isArray(registeredWorkloads)) {
    const matched = registeredWorkloads.find(
      (w) => (w?.id && w.id === item.target_id) || (w?.name && w.name === item.target_id)
    );
    if (matched?.name) {
      const c = cleanServiceName(matched.name);
      if (c) return c;
    }
  }

  // 3. Quét tiêu đề với danh sách KNOWN_SERVICES (ưu tiên từ khoá sau 'trên' hoặc 'on')
  const title = item.title || '';
  for (const kw of KNOWN_SERVICES) {
    const targetRegex = new RegExp('(?:trên|on)\\s+(?:dịch vụ\\s+)?' + kw + '(?![a-zA-Z0-9_-])', 'i');
    if (targetRegex.test(title)) {
      return kw;
    }
  }
  for (const kw of KNOWN_SERVICES) {
    if (title.toLowerCase().includes(kw)) {
      return kw;
    }
  }

  // 4. Fallback tìm token cuối cùng sau 'trên' hoặc 'on'
  const regex = /(?:trên|on)\s+(?:dịch vụ\s+)?([a-zA-Z0-9_-]+)/gi;
  let match;
  let lastFound = null;
  while ((match = regex.exec(title)) !== null) {
    const word = match[1];
    if (word && !['pod', 'dịch', 'các', 'nhiều', 'hệ'].includes(word.toLowerCase())) {
      lastFound = word;
    }
  }
  if (lastFound) {
    const c = cleanServiceName(lastFound);
    if (c) return c;
  }

  return 'ứng dụng hệ thống';
};

const mapBackendIncidentToUI = (item, registeredWorkloads = []) => {
  const shortId = item.id.length > 12 ? `INC-${item.id.slice(0, 8).toUpperCase()}` : item.id;
  const isResolved = item.status === 'RESOLVED';
  const isRecovering = item.status === 'INVESTIGATING';

  const serviceName = resolveServiceName(item, registeredWorkloads);

  // Phân tích kết quả RCA lưu trong DB (nếu có)
  let rcaParsed = null;
  if (item.analysis_result) {
    try {
      rcaParsed = typeof item.analysis_result === 'string' ? JSON.parse(item.analysis_result) : item.analysis_result;
    } catch (e) {
      // bỏ qua nếu không parse được
    }
  }

  const recAction = rcaParsed?.recommendation?.action || item.recommendation_action || item.recommendation || (item.title?.includes('UNKNOWN') ? 'NO_ACTION' : null);
  const isNoAction = recAction === 'NO_ACTION' || (item.title && item.title.includes('UNKNOWN') && (item.severity === 'LOW' || !item.severity));

  // Trạng thái vòng đời sự cố: Phản ánh trung thực trạng thái thực tế từ CSDL
  const hasPendingApproval = item.has_pending_approval !== undefined
    ? Boolean(item.has_pending_approval)
    : Boolean(item.pending_approval_id || item.healing_approval_status === 'PENDING' || item.status === 'AWAITING_APPROVAL');
  const isCriticalNoAction = isNoAction && (
    String(item.severity || '').toUpperCase() === 'CRITICAL' ||
    String(rcaParsed?.recommendation?.priority || '').toUpperCase() === 'CRITICAL' ||
    Boolean(rcaParsed?.recommendation?.action_parameters?.circuit_breaker_tripped)
  );

  const nowMs = Date.now();
  const healingStartedMs = item.healing_started_at ? new Date(item.healing_started_at).getTime() : 0;
  const healingCompletedMs = item.healing_completed_at ? new Date(item.healing_completed_at).getTime() : 0;
  const isRecentlyRunning = (item.healing_status === 'IN_PROGRESS' || item.healing_status === 'RUNNING') && healingStartedMs > 0 && (nowMs - healingStartedMs < 60000);
  const isRecentlyVerifying = item.healing_status === 'SUCCEEDED' && !isResolved && (item.healing_verification_result === null || item.healing_verification_result === undefined) && healingCompletedMs > 0 && (nowMs - healingCompletedMs < 90000);

  const failedCount = Number(item.failed_actions_count || 0);
  const succeededCount = Number(item.succeeded_actions_count || 0);

  const isHealingFailed =
    item.healing_status === 'FAILED' ||
    item.healing_verification_result === false ||
    failedCount > 0;

  const isHealingSucceeded =
    succeededCount > 0 ||
    (item.healing_status === 'SUCCEEDED' && item.healing_verification_result === true);

  const hasNoActions = failedCount === 0 && succeededCount === 0 && !item.healing_action_id;

  let statusLabel = 'Đang theo dõi';
  if (isResolved) {
    if (isHealingFailed && !isHealingSucceeded) {
      statusLabel = 'Đã đóng (Can thiệp thủ công)';
    } else if (isHealingSucceeded) {
      statusLabel = 'Đã khắc phục hoàn tất';
    } else if (hasNoActions || isNoAction) {
      statusLabel = 'Tự ổn định (Telemetry bình thường)';
    } else {
      statusLabel = 'Đã khắc phục hoàn tất';
    }
  } else if (hasPendingApproval) {
    statusLabel = 'Chờ phê duyệt HITL';
  } else if (isCriticalNoAction) {
    statusLabel = 'Cảnh báo khẩn (Cần kiểm tra - NO_ACTION)';
  } else if (item.healing_verification_result === false) {
    statusLabel = 'Hậu kiểm thất bại (Chưa phục hồi)';
  } else if (isHealingFailed && !isHealingSucceeded) {
    statusLabel = 'Tự khắc phục thất bại (Chưa phục hồi)';
  } else if (isRecentlyVerifying) {
    statusLabel = 'Đang tự phục hồi (Đang xác minh)';
  } else if (item.healing_status === 'SUCCEEDED') {
    statusLabel = 'Hậu kiểm thất bại (Chưa phục hồi)';
  } else if (isRecentlyRunning) {
    statusLabel = 'Đang tự phục hồi';
  } else if (item.healing_status === 'IN_PROGRESS' || item.healing_status === 'RUNNING') {
    statusLabel = 'Tự khắc phục thất bại (Timeout >60s)';
  } else if (item.healing_status === 'FAILED') {
    statusLabel = 'Tự khắc phục thất bại';
  } else if (item.status === 'INVESTIGATING') {
    statusLabel = 'Đang điều tra';
  } else if (item.status === 'OPEN') {
    statusLabel = isNoAction
      ? 'Tự động an toàn (NO_ACTION)'
      : 'Đang xử lý / Giám sát';
  } else if (item.status) {
    statusLabel = item.status;
  }
  const recReason = rcaParsed?.recommendation?.reason || item.recommendation_reason || null;

  // Chuẩn hóa confidence an toàn, giữ nguyên 0 và không fallback về 92%
  const rcaConfidence = parseConfidence(item.rca_confidence ?? item.prediction_confidence);

  // Chỉ chấp nhận predictedRisk khi thuộc VALID_RISKS, không lấy tên hành động thay cho rủi ro
  let predictedRisk = null;
  const rawRiskCandidate = rcaParsed?.prediction?.detected_risks?.[0]?.risk_type
    || item.prediction?.detected_risks?.[0]?.risk_type
    || item.prediction_type
    || item.incident_type;

  if (rawRiskCandidate && VALID_RISKS.has(String(rawRiskCandidate).toUpperCase())) {
    predictedRisk = String(rawRiskCandidate).toUpperCase();
  }

  let evidencesList = [];
  if (rcaParsed?.evidence && Array.isArray(rcaParsed.evidence) && rcaParsed.evidence.length > 0) {
    evidencesList = rcaParsed.evidence.map((ev, idx) => ({
      type: idx === 0 ? 'AI_TELEMETRY' : 'K8S_EVENT',
      ref: serviceName,
      summary: typeof ev === 'string' ? ev : (ev.summary || JSON.stringify(ev)),
      score: rcaConfidence !== null ? `${rcaConfidence}%` : 'Chưa đánh giá',
    }));
  }

  const occurrenceCount = Number(item.occurrence_count || 1);
  const lastOccurredAt = item.last_occurred_at || item.detected_at || item.created_at;
  const healingErrorMessage = item.healing_error_message || item.healing_result_error || null;
  let failureHint = null;
  if (!isResolved && item.healing_status === 'FAILED' && healingErrorMessage) {
    failureHint = `Lỗi thực thi: ${healingErrorMessage}`;
  } else if (!isResolved && isNoAction && String(item.severity || '').toUpperCase() === 'CRITICAL' && recReason) {
    failureHint = String(recReason);
  }

  return {
    id: shortId,
    rawId: item.id,
    predictionId: item.prediction_id,
    cluster: item.cluster_name || item.cluster_id,
    clusterId: item.cluster_id,
    clusterName: item.cluster_name,
    title: translateIncidentTitle(item.title),
    service: serviceName,
    namespace: item.namespace || null,
    node: item.node_name || null,
    actualPodName: item.actual_pod_name || null,
    clusterNodeCount: item.cluster_node_count ?? null,
    workloadType: item.workload_type || null,
    severity: (item.severity || 'HIGH').toUpperCase(),
    status: statusLabel,
    occurrenceCount,
    lastOccurredAt,
    healingErrorMessage,
    failureHint,
    time: formatRelativeTime(lastOccurredAt),
    detectedAt: lastOccurredAt,
    impact: item.description || `Ảnh hưởng hiệu năng dịch vụ ${serviceName}`,
    rootCause: item.root_cause_description || item.description || null,
    rootCauseType: item.root_cause_type || (predictedRisk ? `Nguy cơ ${predictedRisk}` : 'Bất thường dịch vụ'),
    confidence: rcaConfidence,
    rcaConfidence: rcaConfidence,
    predictedRisk: predictedRisk,
    primaryRisk: predictedRisk ? `${predictedRisk}${rcaConfidence !== null ? ` (${rcaConfidence}%)` : ''}` : null,
    mttr: item.mttr_seconds !== null && item.mttr_seconds !== undefined ? `${item.mttr_seconds}s` : (isResolved ? 'Đã khắc phục hoàn tất' : 'Đang theo dõi'),
    hasPendingApproval: hasPendingApproval,
    pendingApprovalId: item.pending_approval_id || null,
    healingStatus: item.healing_status || null,
    healingApprovalStatus: item.healing_approval_status || null,
    recommendationAction: recAction,
    recommendationReason: recReason,
    recommendationRiskLevel: item.recommendation_risk_level || rcaParsed?.recommendation?.risk_level || null,
    recommendationPriority: item.recommendation_priority || rcaParsed?.recommendation?.priority || null,
    analysisMethod: item.analysis_method || null,
    evidences: evidencesList,
  };
};

export const IncidentsPage = ({ onNavigate }) => {
  const { currentOrg, currentEnv, envList, setCurrentEnv, refreshActiveIncidents } = useDashboard();
  const [selectedCluster, setSelectedCluster] = useState(() => currentEnv?.cluster || currentEnv?.clusterId || 'all'); // 'all' | clusterId

  // Tự động đồng bộ bộ lọc khi người dùng chuyển Cụm K8s trên Header Top Navbar
  useEffect(() => {
    if (currentEnv?.cluster && currentEnv.cluster !== selectedCluster) {
      setSelectedCluster(currentEnv.cluster);
      setSelectedService('all');
    }
  }, [currentEnv?.cluster, currentEnv?.clusterId]);

  const [selectedSeverity, setSelectedSeverity] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedService, setSelectedService] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Bộ lọc thời gian: mặc định là 'today' (ngày hôm nay) theo yêu cầu người dùng
  const [timeFilterMode, setTimeFilterMode] = useState('today'); // 'today' | 'date' | 'month' | 'year'
  const [selectedDate, setSelectedDate] = useState(() => getTodayStr());
  const [selectedMonth, setSelectedMonth] = useState(() => getThisMonthStr());
  const [selectedYear, setSelectedYear] = useState(() => getThisYearStr());
  
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
  
  // Trạng thái phân trang (Pagination)
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Tự động chuyển về trang 1 khi thay đổi bất kỳ bộ lọc nào
  useEffect(() => {
    setPage(1);
  }, [selectedCluster, selectedSeverity, selectedStatus, selectedService, searchQuery, timeFilterMode, selectedDate, selectedMonth, selectedYear]);

  const [incidents, setIncidents] = useState([]);
  const [clusterList, setClusterList] = useState([]);
  const [registeredWorkloads, setRegisteredWorkloads] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUsingLiveDb, setIsUsingLiveDb] = useState(false);
  const [activeModalIncident, setActiveModalIncident] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [deepLinkIncidentId, setDeepLinkIncidentId] = useState(() => {
    try {
      return new URLSearchParams(window.location.search).get('incident');
    } catch {
      return null;
    }
  });
  const handledDeepLinkRef = useRef(null);

  useEffect(() => {
    const syncDeepLinkFromUrl = () => {
      try {
        const incParam = new URLSearchParams(window.location.search).get('incident');
        if (incParam) {
          handledDeepLinkRef.current = null;
          setDeepLinkIncidentId(incParam);
        }
      } catch {}
    };
    window.addEventListener('popstate', syncDeepLinkFromUrl);
    window.addEventListener('selfheal:urlchange', syncDeepLinkFromUrl);
    return () => {
      window.removeEventListener('popstate', syncDeepLinkFromUrl);
      window.removeEventListener('selfheal:urlchange', syncDeepLinkFromUrl);
    };
  }, []);

  useEffect(() => {
    if (!deepLinkIncidentId || handledDeepLinkRef.current === deepLinkIncidentId) return;

    const matched = incidents.find(
      (i) => i.rawId === deepLinkIncidentId || i.id === deepLinkIncidentId
    );
    if (matched) {
      handledDeepLinkRef.current = deepLinkIncidentId;
      setActiveModalIncident(matched);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const detail = await aiService.getIncidentDetail(deepLinkIncidentId);
        if (!cancelled && detail && (detail.id || detail.rawId)) {
          handledDeepLinkRef.current = deepLinkIncidentId;
          setActiveModalIncident(mapBackendIncidentToUI(detail, registeredWorkloads));
        }
      } catch {}
    })();

    return () => {
      cancelled = true;
    };
  }, [deepLinkIncidentId, incidents, registeredWorkloads]);

  const activeClusterForWorkloads = useMemo(() => {
    if (selectedCluster && selectedCluster !== 'all') {
      if (
        currentEnv?.clusterId &&
        (currentEnv.cluster === selectedCluster ||
          currentEnv.clusterId === selectedCluster ||
          currentEnv.id === selectedCluster)
      ) {
        return currentEnv.clusterId;
      }
      return selectedCluster;
    }
    return undefined;
  }, [selectedCluster, currentEnv?.cluster, currentEnv?.clusterId, currentEnv?.id]);

  // Tải danh sách Workloads ĐANG CHẠY THỰC TẾ trên cụm K8s (đã lọc deleted_at IS NULL & bỏ hệ thống/monitoring)
  const fetchLiveWorkloads = useCallback(async () => {
    const orgId =
      currentOrg?.id && !currentOrg.id.startsWith('sandbox-') && currentOrg.id !== 'org-acme'
        ? currentOrg.id
        : undefined;
    try {
      const workloads = await aiService.getWorkloads(activeClusterForWorkloads, orgId);
      if (Array.isArray(workloads)) {
        setRegisteredWorkloads(workloads);
      }
    } catch (err) {}
  }, [activeClusterForWorkloads, currentOrg?.id]);

  useEffect(() => {
    fetchLiveWorkloads();
  }, [fetchLiveWorkloads]);

  // Tải danh sách cụm K8s trong tổ chức
  useEffect(() => {
    let isMounted = true;
    const loadClusters = async () => {
      try {
        const orgId = currentOrg?.id;
        if (orgId && !orgId.startsWith('sandbox-') && orgId !== 'org-acme') {
          const clusters = await clusterService.getClustersByOrg(orgId);
          if (isMounted && Array.isArray(clusters)) {
            setClusterList(clusters);
          }
        }
      } catch (err) {}
    };
    loadClusters();
    return () => { isMounted = false; };
  }, [currentOrg?.id]);

  // Tải dữ liệu thật từ Main Backend API
  const fetchIncidents = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const activeOrgId = currentOrg?.id;

      const params = {
        limit: 80,
        cluster_id: selectedCluster === 'all' ? undefined : selectedCluster,
        organization_id: activeOrgId,
        status: selectedStatus,
        severity: selectedSeverity,
        search: searchQuery,
      };

      const res = await aiService.getIncidents(params);
      const items = res?.items || (Array.isArray(res) ? res : []);

      setIncidents(items.map((it) => mapBackendIncidentToUI(it, registeredWorkloads)));
      setIsUsingLiveDb(true);
    } catch (err) {
      if (!silent) {
        console.warn('[IncidentsPage] Không thể kết nối API sự cố:', err.message);
        setIncidents([]);
        setIsUsingLiveDb(false);
      }
    } finally {
      if (!silent) setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [currentOrg?.id, selectedCluster, selectedStatus, selectedSeverity, searchQuery]);

  useEffect(() => {
    fetchIncidents(false);
    const intervalId = setInterval(() => {
      fetchIncidents(true);
    }, 15000);
    return () => clearInterval(intervalId);
  }, [fetchIncidents]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchLiveWorkloads();
    fetchIncidents();
    refreshActiveIncidents?.();
  };

  // Kích hoạt giải quyết sự cố tức thời
  const handleResolveIncident = async (id, rawId) => {
    const targetRawId = rawId || incidents.find((i) => i.id === id)?.rawId;
    if (targetRawId) {
      try {
        await aiService.updateIncidentStatus(targetRawId, 'RESOLVED');
        refreshActiveIncidents?.();
      } catch (err) {
        console.warn('Lỗi cập nhật trạng thái sự cố lên DB:', err.message);
      }
    }

    setIncidents((prev) =>
      prev.map((inc) =>
        inc.id === id || inc.rawId === targetRawId
          ? {
              ...inc,
              status: 'Đã khắc phục hoàn tất',
              mttr: 'Đã khắc phục hoàn tất',
            }
          : inc
      )
    );
    if (activeModalIncident && (activeModalIncident.id === id || activeModalIncident.rawId === targetRawId)) {
      setActiveModalIncident((prev) =>
        prev
          ? {
              ...prev,
              status: 'Đã khắc phục hoàn tất',
              mttr: 'Đã khắc phục hoàn tất',
            }
          : null
      );
    }
  };

  // Danh sách Cụm K8s chuẩn xác của tổ chức (khử trùng lặp tuyệt đối theo Tên cụm)
  const availableClusters = useMemo(() => {
    const clusterMap = new Map();

    // 1. Lấy danh sách cụm thuộc tổ chức hiện tại từ Cluster API
    if (Array.isArray(clusterList)) {
      clusterList.forEach((c) => {
        const name = c.name?.trim();
        const id = c.id || name;
        if (name && !clusterMap.has(name)) {
          clusterMap.set(name, { id, name });
        }
      });
    }

    // 2. Lấy từ danh sách môi trường K8s (envList)
    if (Array.isArray(envList)) {
      envList.forEach((e) => {
        const name = (e.cluster || e.name)?.trim();
        const id = e.clusterId || e.id || name;
        if (name && !clusterMap.has(name)) {
          clusterMap.set(name, { id, name });
        }
      });
    }

    // 3. Dự phòng từ danh sách sự cố thực tế của tổ chức
    incidents.forEach((inc) => {
      const name = (inc.clusterName || inc.cluster)?.trim();
      const id = inc.clusterId || inc.cluster || name;
      if (name && !clusterMap.has(name)) {
        clusterMap.set(name, { id, name });
      }
    });

    return Array.from(clusterMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [envList, clusterList, incidents]);

  // Hàm kiểm tra trùng khớp bộ lọc thời gian
  const checkTimeMatch = useCallback((detectedAt) => {
    if (timeFilterMode === 'all') return true;
    if (!detectedAt) return false;
    const d = new Date(detectedAt);
    if (isNaN(d.getTime())) return false;

    const incY = d.getFullYear();
    const incM = String(d.getMonth() + 1).padStart(2, '0');
    const incD = String(d.getDate()).padStart(2, '0');
    const incDateStr = `${incY}-${incM}-${incD}`;
    const incMonthStr = `${incY}-${incM}`;
    const incYearStr = String(incY);

    if (timeFilterMode === 'today') {
      return incDateStr === getTodayStr();
    }
    if (timeFilterMode === 'date') {
      return selectedDate ? incDateStr === selectedDate : true;
    }
    if (timeFilterMode === 'month') {
      return selectedMonth ? incMonthStr === selectedMonth : true;
    }
    if (timeFilterMode === 'year') {
      return selectedYear ? incYearStr === selectedYear : true;
    }
    return true;
  }, [timeFilterMode, selectedDate, selectedMonth, selectedYear]);

  // Danh sách dịch vụ ĐANG CHẠY THỰC TẾ trên cụm K8s (từ GET /api/v1/ai/workloads, đã lọc deleted_at IS NULL & bỏ hệ thống/monitoring)
  // Tuyệt đối không cộng thêm workload cũ đã bị xóa từ lịch sử sự cố
  const availableServices = useMemo(() => {
    const liveServiceNames = extractActiveK8sServices(registeredWorkloads);
    if (liveServiceNames.length === 0) return [];

    const liveSet = new Set(liveServiceNames);
    const counts = {};
    incidents.forEach((inc) => {
      const matchCluster =
        selectedCluster === 'all' ||
        inc.clusterId === selectedCluster ||
        inc.cluster === selectedCluster ||
        inc.clusterName === selectedCluster ||
        (inc.clusterName && selectedCluster && inc.clusterName.toLowerCase() === selectedCluster.toLowerCase()) ||
        (inc.clusterId && selectedCluster && inc.clusterId.toLowerCase() === selectedCluster.toLowerCase());
      if (!matchCluster || !checkTimeMatch(inc.detectedAt)) return;

      if (inc.service && inc.service !== 'ứng dụng hệ thống') {
        const cleaned = normalizeK8sServiceName(inc.service) || cleanServiceName(inc.service);
        if (cleaned && liveSet.has(cleaned)) {
          counts[cleaned] = (counts[cleaned] || 0) + 1;
        }
      }
    });

    return liveServiceNames
      .map((name) => ({
        name,
        count: counts[name] || 0,
      }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [incidents, registeredWorkloads, selectedCluster, checkTimeMatch]);

  // Reset bộ lọc dịch vụ nếu dịch vụ đang chọn không còn tồn tại trên cụm K8s hiện tại
  useEffect(() => {
    if (
      selectedService !== 'all' &&
      availableServices.length > 0 &&
      !availableServices.some((svc) => svc.name === selectedService)
    ) {
      setSelectedService('all');
    }
  }, [selectedService, availableServices]);

  // Danh sách các năm có sự cố
  const availableYears = useMemo(() => {
    const currentY = getThisYearStr();
    const years = new Set([currentY, '2026', '2025']);
    incidents.forEach((inc) => {
      if (inc.detectedAt) {
        const y = new Date(inc.detectedAt).getFullYear();
        if (!isNaN(y)) years.add(String(y));
      }
    });
    return Array.from(years).sort().reverse();
  }, [incidents]);

  // Danh sách ngày có sự cố gần đây (dùng cho các nút bấm nhanh trong lịch)
  const recentIncidentDates = useMemo(() => {
    const dateSet = new Set();
    const today = getTodayStr();
    dateSet.add(today);
    incidents.forEach((inc) => {
      if (inc.detectedAt) {
        const d = new Date(inc.detectedAt);
        if (!isNaN(d.getTime())) {
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          dateSet.add(`${y}-${m}-${day}`);
        }
      }
    });
    return Array.from(dateSet).sort().reverse().slice(0, 6);
  }, [incidents]);

  // Thống kê nhanh theo Cụm và Thời gian được chọn
  const stats = useMemo(() => {
    const list = incidents.filter((inc) => {
      const matchCluster =
        selectedCluster === 'all' ||
        inc.clusterId === selectedCluster ||
        inc.cluster === selectedCluster ||
        inc.clusterName === selectedCluster ||
        (inc.clusterName && selectedCluster && inc.clusterName.toLowerCase() === selectedCluster.toLowerCase()) ||
        (inc.clusterId && selectedCluster && inc.clusterId.toLowerCase() === selectedCluster.toLowerCase());

      const matchTime = checkTimeMatch(inc.detectedAt);
      return matchCluster && matchTime;
    });

    const total = list.length;
    const critical = list.filter((i) => i.severity === 'CRITICAL' || i.severity === 'HIGH').length;
    const recovering = list.filter((i) => (i.status === 'Đang tự phục hồi' || i.status === 'Đang tự phục hồi (Đang xác minh)' || i.status.includes('duyệt'))).length;
    const resolved = list.filter((i) => i.status.includes('hoàn tất') || i.status.includes('Đã đóng') || i.status.includes('Tự ổn định') || (i.status.includes('an toàn') && i.severity !== 'CRITICAL')).length;
    return { total, critical, recovering, resolved };
  }, [incidents, selectedCluster, checkTimeMatch]);

  // Bộ lọc dữ liệu phía Client (bao gồm bộ lọc thời gian)
  const filteredIncidents = useMemo(() => {
    return incidents.filter((inc) => {
      const matchSeverity = selectedSeverity === 'all' || inc.severity === selectedSeverity;
      const matchStatus =
        selectedStatus === 'all' ||
        (selectedStatus === 'OPEN' && (!inc.status.includes('khắc phục') && !inc.status.includes('hoàn tất') && !inc.status.includes('Đã đóng') && !inc.status.includes('Tự ổn định'))) ||
        (selectedStatus === 'RECOVERING' &&
          (inc.status.includes('phục hồi') ||
            inc.status.includes('xác minh') ||
            inc.status.includes('Đang xử lý') ||
            inc.status.includes('Giám sát'))) ||
        (selectedStatus === 'HITL' && inc.status.includes('duyệt')) ||
        (selectedStatus === 'NO_ACTION' &&
          (inc.status.includes('NO_ACTION') ||
            inc.status.includes('an toàn') ||
            inc.status.includes('Cảnh báo') ||
            inc.status.includes('Cần kiểm tra'))) ||
        (selectedStatus === 'FAILED' &&
          (inc.status.includes('thất bại') || inc.healingStatus === 'FAILED' || inc.status.includes('Chưa phục hồi') || inc.status.includes('Thủ công'))) ||
        (selectedStatus === 'RESOLVED' && (inc.status.includes('khắc phục') || inc.status.includes('hoàn tất') || inc.status.includes('Đã đóng') || inc.status.includes('Tự ổn định')));
      const matchService = selectedService === 'all' || inc.service === selectedService;
      const matchSearch =
        !searchQuery.trim() ||
        Boolean(inc.id && inc.id.toLowerCase().includes(searchQuery.toLowerCase())) ||
        Boolean(inc.title && inc.title.toLowerCase().includes(searchQuery.toLowerCase())) ||
        Boolean(inc.service && inc.service.toLowerCase().includes(searchQuery.toLowerCase())) ||
        Boolean(inc.rootCause && inc.rootCause.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchCluster =
        selectedCluster === 'all' ||
        inc.clusterId === selectedCluster ||
        inc.cluster === selectedCluster ||
        inc.clusterName === selectedCluster ||
        (inc.clusterName && selectedCluster && inc.clusterName.toLowerCase() === selectedCluster.toLowerCase()) ||
        (inc.clusterId && selectedCluster && inc.clusterId.toLowerCase() === selectedCluster.toLowerCase());

      const matchTime = checkTimeMatch(inc.detectedAt);

      return matchCluster && matchSeverity && matchStatus && matchService && matchSearch && matchTime;
    });
  }, [incidents, selectedSeverity, selectedStatus, selectedService, searchQuery, selectedCluster, checkTimeMatch]);

  // Tính toán phân trang (Pagination calculations)
  const totalFiltered = filteredIncidents.length;
  const totalPages = Math.ceil(totalFiltered / pageSize) || 1;
  const safePage = Math.min(Math.max(1, page), totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalFiltered);
  const paginatedIncidents = useMemo(() => {
    return filteredIncidents.slice(startIndex, endIndex);
  }, [filteredIncidents, startIndex, endIndex]);

  const activeClusterLabel =
    selectedCluster === 'all'
      ? 'Toàn bộ cụm K8s'
      : availableClusters.find((c) => c.id === selectedCluster)?.name || selectedCluster;

  const hasActiveFilters =
    selectedSeverity !== 'all' ||
    selectedStatus !== 'all' ||
    selectedService !== 'all' ||
    timeFilterMode !== 'today' ||
    searchQuery.trim().length > 0;

  const handleResetFilters = () => {
    setSelectedSeverity('all');
    setSelectedStatus('all');
    setSelectedService('all');
    setSearchQuery('');
    setTimeFilterMode('today');
    setSelectedDate(getTodayStr());
    setPage(1);
  };

  const kpiCardStyle = (accent, isSelected = false) => ({
    backgroundColor: '#FFFFFF',
    border: isSelected ? `1px solid ${accent}` : '1px solid rgba(226, 232, 240, 0.95)',
    borderTop: `2.5px solid ${accent}`,
    borderRadius: '12px',
    padding: '11px 14px',
    boxShadow: isSelected
      ? `0 6px 18px ${accent}22`
      : '0 4px 16px rgba(15, 23, 42, 0.04)',
    minWidth: 0,
    transition: 'transform 0.14s ease, box-shadow 0.14s ease, border-color 0.14s ease',
  });

  const actionBtnStyle = (disabled = false) => ({
    height: '34px',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '0 12px',
    backgroundColor: '#FFFFFF',
    border: '1px solid rgba(203, 213, 225, 0.9)',
    borderRadius: '10px',
    boxShadow: '0 2px 6px rgba(15, 23, 42, 0.04)',
    fontSize: '0.8rem',
    fontWeight: 600,
    color: disabled ? '#94A3B8' : '#334155',
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
    <div className="dashboard-incidents-page" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <style>{`
        .incidents-table-row {
          transition: background-color 0.14s ease;
        }
        .incidents-table-row:hover {
          background-color: #F8FAFC !important;
        }
        .incidents-table-row--critical:hover {
          background-color: #FEF2F2 !important;
        }
        .incidents-detail-btn:hover {
          background-color: #059669 !important;
          border-color: #059669 !important;
          color: #FFFFFF !important;
        }
      `}</style>

      {/* Page Header (đồng bộ phong cách sạch, gọn của Dashboard, Logs & Events) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
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
            <AlertTriangle size={19} color="#059669" />
          </div>
          <div>
            <h1
              style={{
                fontSize: '1.35rem',
                fontWeight: 800,
                color: '#0F172A',
                letterSpacing: '-0.02em',
                margin: 0,
              }}
            >
              Quản Lý Sự Cố &amp; Phân Tích Nguyên Nhân Gốc
            </h1>
            <p style={{ fontSize: '0.8rem', color: '#64748B', margin: '2px 0 0 0' }}>
              Theo dõi sự cố, suy diễn nguyên nhân nhân quả &amp; trạng thái tự phục hồi từ cụm{' '}
              <strong style={{ color: '#0F172A', fontFamily: 'var(--font-mono)' }}>{activeClusterLabel}</strong>
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing || isLoading}
            style={actionBtnStyle(isRefreshing || isLoading)}
          >
            <RefreshCw size={14} className={isRefreshing || isLoading ? 'animate-spin' : ''} />
            <span>{isRefreshing ? 'Đang làm mới...' : 'Làm mới'}</span>
          </button>
        </div>
      </div>

      {/* Hàng 4 Thẻ KPI Tóm Tắt (đồng bộ viền màu phía trên giống Dashboard, Logs & Events) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '12px' }}>
        {/* Card 1: Tổng Sự Cố */}
        <div
          onClick={() => {
            setSelectedSeverity('all');
            setSelectedStatus('all');
          }}
          title="Nhấp để hiển thị tất cả sự cố"
          style={{ ...kpiCardStyle('#059669'), cursor: 'pointer' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748B', letterSpacing: '0.02em' }}>
              TỔNG SỰ CỐ
            </span>
            <Layers size={14} color="#059669" />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '4px' }}>
            <span style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0F172A', fontFamily: 'var(--font-mono)' }}>
              {isLoading && incidents.length === 0 ? '...' : stats.total.toLocaleString('vi-VN')}
            </span>
            <span style={{ fontSize: '0.7rem', color: '#059669', fontWeight: 600, fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {activeClusterLabel}
            </span>
          </div>
        </div>

        {/* Card 2: Nguy Cấp / Cao */}
        <div
          onClick={() => setSelectedSeverity((prev) => (prev === 'CRITICAL' ? 'all' : 'CRITICAL'))}
          title="Nhấp để lọc nhanh sự cố Nguy cấp (Critical)"
          style={{ ...kpiCardStyle('#EF4444', selectedSeverity === 'CRITICAL'), cursor: 'pointer' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748B', letterSpacing: '0.02em' }}>
              NGUY CẤP &amp; CAO
            </span>
            <AlertTriangle size={14} color={stats.critical > 0 ? '#EF4444' : '#94A3B8'} />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '4px' }}>
            <span
              style={{
                fontSize: '1.3rem',
                fontWeight: 800,
                color: stats.critical > 0 ? '#DC2626' : '#0F172A',
                fontFamily: 'var(--font-mono)',
              }}
            >
              {isLoading && incidents.length === 0 ? '...' : stats.critical.toLocaleString('vi-VN')}
            </span>
            <span style={{ fontSize: '0.7rem', color: stats.critical > 0 ? '#DC2626' : '#64748B', fontWeight: stats.critical > 0 ? 600 : 500 }}>
              {stats.critical > 0 ? 'Ưu tiên xử lý' : 'Không có nguy cấp'}
            </span>
          </div>
        </div>

        {/* Card 3: Đang Tự Phục Hồi */}
        <div
          onClick={() => setSelectedStatus((prev) => (prev === 'RECOVERING' ? 'all' : 'RECOVERING'))}
          title="Nhấp để lọc nhanh sự cố đang tự phục hồi"
          style={{ ...kpiCardStyle('#F59E0B', selectedStatus === 'RECOVERING'), cursor: 'pointer' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748B', letterSpacing: '0.02em' }}>
              ĐANG TỰ PHỤC HỒI
            </span>
            <Zap size={14} color={stats.recovering > 0 ? '#F59E0B' : '#94A3B8'} />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '4px' }}>
            <span
              style={{
                fontSize: '1.3rem',
                fontWeight: 800,
                color: stats.recovering > 0 ? '#D97706' : '#0F172A',
                fontFamily: 'var(--font-mono)',
              }}
            >
              {isLoading && incidents.length === 0 ? '...' : stats.recovering.toLocaleString('vi-VN')}
            </span>
            <span style={{ fontSize: '0.7rem', color: '#64748B' }}>
              {stats.recovering > 0 ? 'MAPE-K đang chạy' : 'Hệ thống ổn định'}
            </span>
          </div>
        </div>

        {/* Card 4: Đã Khắc Phục */}
        <div
          onClick={() => setSelectedStatus((prev) => (prev === 'RESOLVED' ? 'all' : 'RESOLVED'))}
          title="Nhấp để lọc nhanh sự cố đã khắc phục"
          style={{ ...kpiCardStyle('#10B981', selectedStatus === 'RESOLVED'), cursor: 'pointer' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748B', letterSpacing: '0.02em' }}>
              ĐÃ KHẮC PHỤC
            </span>
            <CheckCircle2 size={14} color="#10B981" />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '4px' }}>
            <span style={{ fontSize: '1.3rem', fontWeight: 800, color: '#059669', fontFamily: 'var(--font-mono)' }}>
              {isLoading && incidents.length === 0 ? '...' : stats.resolved.toLocaleString('vi-VN')}
            </span>
            <span style={{ fontSize: '0.7rem', color: '#059669', fontWeight: 600 }}>
              Khôi phục SLA 99.9%
            </span>
          </div>
        </div>
      </div>

      {/* Bộ Lọc Gọn 2 Hàng (Hàng 1: Tìm kiếm + Chọn nhanh Mức độ + Bộ chọn Lịch • Hàng 2: Trạng thái + Dịch vụ + Đặt lại) */}
      <div
        className="dash-card"
        style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: '14px',
          padding: '12px 16px',
          boxShadow: '0 4px 16px rgba(15, 23, 42, 0.04)',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}
      >
        {/* Hàng 1: Tìm kiếm + Pill Mức độ + Lịch */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
          {/* Search Input */}
          <div style={{ position: 'relative', flex: '1 1 250px', maxWidth: '360px' }}>
            <input
              type="text"
              placeholder="Tìm kiếm mã sự cố, tiêu đề, dịch vụ, nguyên nhân..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
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
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Xóa từ khóa tìm kiếm"
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

          {/* Severity Quick Pills */}
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
              { id: 'all', label: 'Tất cả', color: '#059669', bg: '#ECFDF5' },
              { id: 'CRITICAL', label: 'Nguy cấp', color: '#DC2626', bg: '#FEF2F2' },
              { id: 'HIGH', label: 'Cao', color: '#EA580C', bg: '#FFF7ED' },
              { id: 'MEDIUM', label: 'Trung bình', color: '#D97706', bg: '#FFFBEB' },
              { id: 'LOW', label: 'Thấp', color: '#2563EB', bg: '#EFF6FF' },
            ].map((sev) => {
              const active = selectedSeverity === sev.id;
              return (
                <button
                  key={sev.id}
                  type="button"
                  onClick={() => setSelectedSeverity(sev.id)}
                  style={{
                    padding: '4px 9px',
                    borderRadius: '6px',
                    border: active ? `1px solid ${sev.color}55` : '1px solid transparent',
                    backgroundColor: active ? sev.bg : 'transparent',
                    color: active ? sev.color : '#64748B',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.12s ease',
                  }}
                >
                  {sev.label}
                </button>
              );
            })}
          </div>

          {/* Nút Lịch mở Popover chọn Ngày, Tháng, Năm, Tất cả */}
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
              title="Mở bảng lịch chọn ngày, tháng hoặc năm"
            >
              <Calendar size={14} color={isCalendarOpen ? '#059669' : '#64748B'} />
              <span>{currentFilterLabel}</span>
              <ChevronDown size={12} color={isCalendarOpen ? '#059669' : '#64748B'} />
            </button>

            {/* Cửa Sổ Popover Lịch */}
            {isCalendarOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: '40px',
                  right: '0',
                  zIndex: 100,
                  width: '326px',
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
                {/* Tabs Chế Độ: Ngày | Tháng | Năm */}
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
                    Ngày
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
                    Tháng
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
                    Năm
                  </button>
                </div>

                {/* Tab Body: CHỌN NGÀY */}
                {(timeFilterMode === 'date' || timeFilterMode === 'today' || timeFilterMode === 'all') && (
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

                    {/* Quick presets for days with incidents */}
                    <div style={{ marginTop: '10px' }}>
                      <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#94A3B8', marginBottom: '6px' }}>
                        Ngày có sự cố gần đây:
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {recentIncidentDates.map((dStr) => {
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
                                fontSize: '0.7rem',
                                fontWeight: isSelected ? 700 : 500,
                                borderRadius: '6px',
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
                      Chọn tháng &amp; năm:
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
                      Các tháng trong năm {selectedMonth?.split('-')[0] || '2026'}:
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
                            Năm {yr}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Popover Footer */}
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
                      Hôm nay
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
                      Tất cả
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
                    Áp dụng
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Hàng 2: Trạng thái, Dịch vụ, Đặt lại & Bộ đếm */}
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
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px' }}>
            {/* Status Select */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748B' }}>Trạng thái</span>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                style={selectControlStyle}
              >
                <option value="all">Tất cả trạng thái</option>
                <option value="OPEN">Chưa khắc phục (Đang mở)</option>
                <option value="RECOVERING">Đang xử lý / Giám sát</option>
                <option value="HITL">Chờ phê duyệt HITL</option>
                <option value="NO_ACTION">Cần kiểm tra / Ngắt mạch (NO_ACTION)</option>
                <option value="FAILED">Tự khắc phục thất bại</option>
                <option value="RESOLVED">Đã khắc phục hoàn tất</option>
              </select>
            </div>

            {/* Service Select */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748B' }}>Dịch vụ</span>
              <select
                value={selectedService}
                onChange={(e) => setSelectedService(e.target.value)}
                style={selectControlStyle}
              >
                <option value="all">Tất cả dịch vụ ({availableServices.length})</option>
                {availableServices.map((svc) => (
                  <option key={svc.name} value={svc.name}>
                    {svc.name} {svc.count > 0 ? '(' + svc.count + ')' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Reset Filters Button */}
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
                color: hasActiveFilters ? '#DC2626' : '#64748B',
                backgroundColor: hasActiveFilters ? '#FEF2F2' : '#FFFFFF',
                border: hasActiveFilters ? '1px solid #FECACA' : '1px solid #E2E8F0',
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'all 0.14s ease',
              }}
            >
              <RotateCcw size={12} />
              <span>Đặt lại</span>
            </button>
          </div>

          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.73rem', color: '#64748B' }}>
            {isLoading && incidents.length === 0 ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <RefreshCw size={12} className="animate-spin" color="#059669" />
                <span>Đang đồng bộ danh sách sự cố...</span>
              </span>
            ) : (
              <>
                Hiển thị <strong style={{ color: '#0F172A' }}>{totalFiltered > 0 ? startIndex + 1 : 0}-{endIndex}</strong> /{' '}
                <strong style={{ color: '#0F172A' }}>{totalFiltered}</strong> sự cố
              </>
            )}
          </div>
        </div>
      </div>

      {/* Main Overview Table */}
      <div
        className="dash-card"
        style={{
          padding: 0,
          overflow: 'hidden',
          borderRadius: '14px',
          backgroundColor: '#FFFFFF',
          border: '1px solid #E2E8F0',
          boxShadow: '0 4px 16px rgba(15, 23, 42, 0.04)',
        }}
      >
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem', tableLayout: 'auto' }}>
            <thead>
              <tr
                style={{
                  backgroundColor: '#F8FAFC',
                  borderBottom: '1px solid #E2E8F0',
                  textAlign: 'left',
                }}
              >
                <th style={{ padding: '11px 16px', fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', fontWeight: 700, color: '#64748B', letterSpacing: '0.03em', whiteSpace: 'nowrap', width: '132px' }}>
                  MÃ SỰ CỐ
                </th>
                <th style={{ padding: '11px 16px', fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', fontWeight: 700, color: '#64748B', letterSpacing: '0.03em', whiteSpace: 'nowrap', width: '112px' }}>
                  MỨC ĐỘ
                </th>
                <th style={{ padding: '11px 16px', fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', fontWeight: 700, color: '#64748B', letterSpacing: '0.03em', whiteSpace: 'nowrap', width: '185px' }}>
                  DỊCH VỤ / NODE
                </th>
                <th style={{ padding: '11px 18px', fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', fontWeight: 700, color: '#64748B', letterSpacing: '0.03em', whiteSpace: 'nowrap', minWidth: '340px' }}>
                  TIÊU ĐỀ SỰ CỐ
                </th>
                <th style={{ padding: '11px 16px', fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', fontWeight: 700, color: '#64748B', letterSpacing: '0.03em', whiteSpace: 'nowrap', width: '185px' }}>
                  TRẠNG THÁI
                </th>
                <th style={{ padding: '11px 16px', fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', fontWeight: 700, color: '#64748B', letterSpacing: '0.03em', whiteSpace: 'nowrap', width: '126px', textAlign: 'right' }}>
                  THAO TÁC
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} style={{ padding: '56px 20px', textAlign: 'center', color: '#64748B' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '42px', height: '42px', borderRadius: '12px', backgroundColor: '#ECFDF5', border: '1px solid #A7F3D0', margin: '0 auto 12px auto' }}>
                      <RefreshCw size={20} className="animate-spin" color="#059669" />
                    </div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0F172A' }}>
                      Đang đồng bộ danh sách sự cố...
                    </div>
                    <div style={{ fontSize: '0.78rem', marginTop: '4px', color: '#64748B' }}>
                      Đang phân tích dữ liệu viễn trắc và chuỗi nguyên nhân gốc rễ
                    </div>
                  </td>
                </tr>
              ) : filteredIncidents.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '56px 20px', textAlign: 'center', color: '#64748B' }}>
                    <div
                      style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '14px',
                        backgroundColor: '#ECFDF5',
                        border: '1px solid #A7F3D0',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: '10px',
                      }}
                    >
                      <ShieldCheck size={26} color="#059669" />
                    </div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0F172A' }}>
                      {incidents.length === 0
                        ? `Cụm ${activeClusterLabel} không ghi nhận sự cố nào`
                        : 'Không tìm thấy sự cố nào phù hợp với bộ lọc'}
                    </div>
                    <div style={{ fontSize: '0.78rem', marginTop: '4px', color: '#64748B' }}>
                      {incidents.length === 0
                        ? 'Toàn bộ các dịch vụ và node trên cụm đang hoạt động an toàn theo thời gian thực.'
                        : 'Thử điều chỉnh lại mức độ, trạng thái, khung thời gian hoặc từ khóa tìm kiếm.'}
                    </div>
                    {hasActiveFilters && (
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
                        Đặt lại bộ lọc
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                paginatedIncidents.map((item) => {
                  const isCrit = item.severity === 'CRITICAL';
                  const isHigh = item.severity === 'HIGH';
                  const isMed = item.severity === 'MEDIUM';

                  const isDone = item.status.includes('hoàn tất');
                  const isAutoStabilized = item.status.includes('Tự ổn định');
                  const isClosedManual = item.status.includes('Can thiệp thủ công') || item.status.includes('Đã đóng');
                  const isUrgentNoAction = item.status.includes('Cần kiểm tra');
                  const isSafeNoAction = !isUrgentNoAction && (item.status.includes('NO_ACTION') || item.status.includes('an toàn'));
                  const isWait = item.status.includes('duyệt');
                  const isFailed = item.status.includes('thất bại') || item.status.includes('Chưa phục hồi');
                  const isAlertRow = (isCrit || isFailed || isUrgentNoAction) && !isDone && !isClosedManual && !isAutoStabilized;

                  return (
                    <tr
                      key={item.id}
                      className={`incidents-table-row${isAlertRow ? ' incidents-table-row--critical' : ''}`}
                      onClick={() => setActiveModalIncident(item)}
                      style={{
                        borderBottom: '1px solid #F1F5F9',
                        backgroundColor: isAlertRow ? 'rgba(254, 242, 242, 0.32)' : '#FFFFFF',
                        cursor: 'pointer',
                      }}
                    >
                      <td
                        style={{
                          padding: '13px 16px',
                          fontFamily: 'var(--font-mono)',
                          fontWeight: 700,
                          color: '#0F172A',
                          whiteSpace: 'nowrap',
                          borderLeft: isAlertRow
                            ? '3px solid #EF4444'
                            : isHigh && !isDone && !isClosedManual
                            ? '3px solid #F97316'
                            : '3px solid transparent',
                        }}
                      >
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                          <span
                            style={{
                              backgroundColor: '#F8FAFC',
                              padding: '3px 8px',
                              borderRadius: '7px',
                              border: '1px solid #E2E8F0',
                              fontSize: '0.74rem',
                              color: '#334155',
                            }}
                          >
                            {item.id}
                          </span>
                          {item.occurrenceCount > 1 && (
                            <span
                              title={`Sự cố lặp lại ${item.occurrenceCount} lần`}
                              style={{
                                backgroundColor: '#FEF3C7',
                                color: '#B45309',
                                border: '1px solid #FDE68A',
                                padding: '2px 6px',
                                borderRadius: '6px',
                                fontSize: '0.68rem',
                                fontWeight: 800,
                              }}
                            >
                              x{item.occurrenceCount}
                            </span>
                          )}
                        </div>
                      </td>

                      <td style={{ padding: '13px 16px', whiteSpace: 'nowrap' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '3px 9px',
                            fontFamily: 'var(--font-mono)',
                            fontSize: '0.68rem',
                            fontWeight: 800,
                            borderRadius: '999px',
                            backgroundColor: isCrit ? '#FFF1F2' : isHigh ? '#FFF7ED' : isMed ? '#FFFBEB' : '#EFF6FF',
                            color: isCrit ? '#E11D48' : isHigh ? '#EA580C' : isMed ? '#D97706' : '#2563EB',
                            border: `1px solid ${isCrit ? '#FDA4AF' : isHigh ? '#FDBA74' : isMed ? '#FDE68A' : '#BFDBFE'}`,
                          }}
                        >
                          <span
                            style={{
                              width: '6px',
                              height: '6px',
                              borderRadius: '50%',
                              backgroundColor: isCrit ? '#E11D48' : isHigh ? '#EA580C' : isMed ? '#D97706' : '#2563EB',
                            }}
                          />
                          {translateSeverity(item.severity)}
                        </span>
                      </td>

                      <td style={{ padding: '13px 16px', whiteSpace: 'nowrap' }}>
                        <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.78rem', color: '#047857' }}>
                          {item.service}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '3px', flexWrap: 'wrap' }}>
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '1px 5px',
                              borderRadius: '5px',
                              backgroundColor: '#F1F5F9',
                              border: '1px solid #E2E8F0',
                              fontSize: '0.65rem',
                              fontFamily: 'var(--font-mono)',
                              fontWeight: 600,
                              color: '#475569',
                            }}
                          >
                            ns: {item.namespace || '—'}
                          </span>
                          {item.node && (
                            <span
                              style={{
                                display: 'inline-block',
                                padding: '1px 5px',
                                borderRadius: '5px',
                                backgroundColor: '#F8FAFC',
                                border: '1px solid #E2E8F0',
                                fontSize: '0.65rem',
                                fontFamily: 'var(--font-mono)',
                                fontWeight: 600,
                                color: '#64748B',
                              }}
                            >
                              {item.node}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* CỘT TIÊU ĐỀ: HIỂN THỊ TỐI ĐA 2 HÀNG */}
                      <td style={{ padding: '13px 18px', minWidth: '340px', maxWidth: '420px' }}>
                        <div
                          title={translateIncidentTitle(item.title)}
                          style={{
                            fontWeight: 600,
                            color: '#0F172A',
                            fontSize: '0.82rem',
                            lineHeight: 1.48,
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            wordBreak: 'break-word',
                          }}
                        >
                          {translateIncidentTitle(item.title)}
                        </div>
                        {item.failureHint && (
                          <div
                            title={item.failureHint}
                            style={{
                              marginTop: '3px',
                              fontSize: '0.72rem',
                              color: item.healingStatus === 'FAILED' ? '#B91C1C' : '#64748B',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {item.failureHint}
                          </div>
                        )}
                      </td>

                      <td style={{ padding: '13px 16px', whiteSpace: 'nowrap' }}>
                        {isWait && onNavigate ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onNavigate(`/dashboard/self-healing/approvals?target=${encodeURIComponent(item.service)}`);
                            }}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '4px 10px',
                              borderRadius: '999px',
                              fontSize: '0.73rem',
                              fontWeight: 700,
                              backgroundColor: '#FEF3C7',
                              color: '#B45309',
                              border: '1px solid #FDE68A',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease',
                            }}
                            title="Chuyển ngay tới Cổng Phê Duyệt HITL"
                          >
                            <Clock size={12} />
                            <span>Chờ phê duyệt HITL &rarr;</span>
                          </button>
                        ) : (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '4px 10px',
                              borderRadius: '999px',
                              fontSize: '0.73rem',
                              fontWeight: 700,
                              backgroundColor: isDone ? '#ECFDF5' : isAutoStabilized ? '#EFF6FF' : isClosedManual ? '#F1F5F9' : isUrgentNoAction ? '#FEF2F2' : isSafeNoAction ? '#ECFDF5' : isWait ? '#FEF3C7' : isFailed ? '#FEF2F2' : '#EFF6FF',
                              color: isDone ? '#047857' : isAutoStabilized ? '#1D4ED8' : isClosedManual ? '#475569' : isUrgentNoAction ? '#DC2626' : isSafeNoAction ? '#047857' : isWait ? '#B45309' : isFailed ? '#DC2626' : '#1D4ED8',
                              border: `1px solid ${isDone ? '#A7F3D0' : isAutoStabilized ? '#BFDBFE' : isClosedManual ? '#CBD5E1' : isUrgentNoAction ? '#FECACA' : isSafeNoAction ? '#A7F3D0' : isWait ? '#FDE68A' : isFailed ? '#FCA5A5' : '#BFDBFE'}`,
                            }}
                          >
                            {isDone ? (
                              <CheckCircle2 size={12} />
                            ) : isAutoStabilized ? (
                              <Activity size={12} />
                            ) : isClosedManual ? (
                              <ShieldCheck size={12} />
                            ) : isUrgentNoAction ? (
                              <AlertTriangle size={12} />
                            ) : isSafeNoAction ? (
                              <ShieldCheck size={12} />
                            ) : isWait ? (
                              <Clock size={12} />
                            ) : isFailed ? (
                              <AlertTriangle size={12} />
                            ) : (
                              <Zap size={12} />
                            )}
                            <span>{item.status}</span>
                          </span>
                        )}
                      </td>

                      <td style={{ padding: '13px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                          <button
                            type="button"
                            className="incidents-detail-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveModalIncident(item);
                            }}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              height: '28px',
                              padding: '0 10px',
                              backgroundColor: '#ECFDF5',
                              color: '#047857',
                              fontSize: '0.74rem',
                              fontWeight: 700,
                              borderRadius: '8px',
                              border: '1px solid #A7F3D0',
                              cursor: 'pointer',
                              transition: 'all 0.14s ease',
                            }}
                          >
                            <Eye size={12} />
                            <span>Xem chi tiết</span>
                          </button>

                          <div
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '0.68rem',
                              fontFamily: 'var(--font-mono)',
                              color: '#94A3B8',
                              fontWeight: 500,
                            }}
                          >
                            <Clock size={10} color="#94A3B8" />
                            <span>{item.time}</span>
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Thanh Phân Trang (Pagination Controls) */}
        {totalFiltered > 0 && (
          <div
            style={{
              padding: '11px 16px',
              borderTop: '1px solid #E2E8F0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '10px',
              backgroundColor: '#F8FAFC',
              fontSize: '0.75rem',
              fontFamily: 'var(--font-mono)',
              color: '#475569',
            }}
          >
            {/* Chọn số bản ghi / trang & Tóm tắt */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ color: '#64748B', fontSize: '0.74rem' }}>Hiển thị mỗi trang:</span>
                <select
                  aria-label="Số bản ghi mỗi trang"
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                  style={{
                    height: '28px',
                    padding: '0 8px',
                    borderRadius: '7px',
                    border: '1px solid #CBD5E1',
                    backgroundColor: '#FFFFFF',
                    color: '#0F172A',
                    fontSize: '0.74rem',
                    fontWeight: 600,
                    outline: 'none',
                    cursor: 'pointer',
                  }}
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
              </div>

              <span style={{ color: '#CBD5E1' }}>|</span>

              <span style={{ color: '#64748B', fontSize: '0.74rem' }}>
                <strong style={{ color: '#0F172A' }}>{startIndex + 1}-{endIndex}</strong> / <strong style={{ color: '#0F172A' }}>{totalFiltered}</strong> sự cố
              </span>
            </div>

            {/* Các nút bấm chuyển trang */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: '#64748B', fontSize: '0.74rem', marginRight: '4px' }}>
                Trang <strong style={{ color: '#0F172A' }}>{safePage}</strong> / {totalPages}
              </span>

              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <button
                  type="button"
                  title="Trang đầu"
                  disabled={safePage <= 1}
                  onClick={() => setPage(1)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '28px',
                    height: '28px',
                    borderRadius: '7px',
                    border: '1px solid #CBD5E1',
                    backgroundColor: '#FFFFFF',
                    color: safePage <= 1 ? '#CBD5E1' : '#334155',
                    cursor: safePage <= 1 ? 'not-allowed' : 'pointer',
                  }}
                >
                  <ChevronsLeft size={14} />
                </button>

                <button
                  type="button"
                  title="Trang trước"
                  disabled={safePage <= 1}
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '28px',
                    height: '28px',
                    borderRadius: '7px',
                    border: '1px solid #CBD5E1',
                    backgroundColor: '#FFFFFF',
                    color: safePage <= 1 ? '#CBD5E1' : '#334155',
                    cursor: safePage <= 1 ? 'not-allowed' : 'pointer',
                  }}
                >
                  <ChevronLeft size={14} />
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
                  .reduce((acc, p, idx, arr) => {
                    if (idx > 0 && p - arr[idx - 1] > 1) {
                      acc.push('ellipsis-' + p);
                    }
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((item) => {
                    if (typeof item === 'string' && item.startsWith('ellipsis-')) {
                      return (
                        <span key={item} style={{ padding: '0 4px', color: '#94A3B8', fontSize: '0.74rem' }}>
                          ...
                        </span>
                      );
                    }
                    const isCurrent = item === safePage;
                    return (
                      <button
                        key={item}
                        type="button"
                        onClick={() => setPage(item)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          minWidth: '28px',
                          height: '28px',
                          padding: '0 6px',
                          borderRadius: '7px',
                          border: isCurrent ? '1px solid #059669' : '1px solid #CBD5E1',
                          backgroundColor: isCurrent ? '#059669' : '#FFFFFF',
                          color: isCurrent ? '#FFFFFF' : '#334155',
                          fontSize: '0.74rem',
                          fontWeight: isCurrent ? 700 : 600,
                          cursor: 'pointer',
                        }}
                      >
                        {item}
                      </button>
                    );
                  })}

                <button
                  type="button"
                  title="Trang tiếp theo"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '28px',
                    height: '28px',
                    borderRadius: '7px',
                    border: '1px solid #CBD5E1',
                    backgroundColor: '#FFFFFF',
                    color: safePage >= totalPages ? '#CBD5E1' : '#334155',
                    cursor: safePage >= totalPages ? 'not-allowed' : 'pointer',
                  }}
                >
                  <ChevronRight size={14} />
                </button>

                <button
                  type="button"
                  title="Trang cuối"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage(totalPages)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '28px',
                    height: '28px',
                    borderRadius: '7px',
                    border: '1px solid #CBD5E1',
                    backgroundColor: '#FFFFFF',
                    color: safePage >= totalPages ? '#CBD5E1' : '#334155',
                    cursor: safePage >= totalPages ? 'not-allowed' : 'pointer',
                  }}
                >
                  <ChevronsRight size={14} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* KHUNG CỬA SỔ NHỎ HIỆN LÊN KHI BẤM "XEM CHI TIẾT" */}
      {activeModalIncident && (
        <RootCauseModal
          incident={activeModalIncident}
          onClose={() => {
            setActiveModalIncident(null);
            handledDeepLinkRef.current = null;
            setDeepLinkIncidentId(null);
            if (typeof window !== 'undefined' && window.location.search.includes('incident=')) {
              const url = new URL(window.location.href);
              url.searchParams.delete('incident');
              const cleanSearch = url.searchParams.toString();
              window.history.replaceState({}, '', `${url.pathname}${cleanSearch ? `?${cleanSearch}` : ''}`);
            }
          }}
          onResolve={handleResolveIncident}
          onNavigate={onNavigate}
        />
      )}
    </div>
  );
};

export default IncidentsPage;
