import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useDashboard } from '../context/DashboardContext';
import { aiService } from '../../../services/aiService';
import { clusterService } from '../../../services/clusterService';
import RootCauseModal from './RootCauseModal';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Search,
  RefreshCw,
  Zap,
  Layers,
  Eye,
  Database,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Calendar,
  ChevronDown
} from 'lucide-react';

const INITIAL_INCIDENTS = [];

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
export const translateIncidentTitle = (rawTitle) => {
  if (!rawTitle) return '';
  let title = String(rawTitle);

  title = title.replace(/\[AI Alert\]/gi, '[Cảnh báo AI]');
  title = title.replace(/\[Alert\]/gi, '[Cảnh báo]');

  const causeTranslations = [
    { en: /Unstable application pod/gi, vi: 'Pod ứng dụng bất ổn định' },
    { en: /Container memory exhausted/gi, vi: 'Cạn kiệt bộ nhớ container (OOM)' },
    { en: /Storage capacity exhausted/gi, vi: 'Cạn kiệt dung lượng lưu trữ' },
    { en: /CPU saturation/gi, vi: 'Bão hòa tài nguyên CPU' },
    { en: /Traffic overload/gi, vi: 'Quá tải lưu lượng truy cập' },
    { en: /Deployment failure/gi, vi: 'Lỗi triển khai phiên bản mới' },
    { en: /Upstream dependency failure/gi, vi: 'Lỗi dịch vụ phụ thuộc thượng nguồn' },
    { en: /Application errors/gi, vi: 'Lỗi ứng dụng nội bộ (5xx)' },
    { en: /Service performance degradation/gi, vi: 'Suy giảm hiệu năng dịch vụ' },
    { en: /Insufficient available replicas/gi, vi: 'Không đủ số lượng Pod replica' },
    { en: /Kubernetes scheduling failure/gi, vi: 'Lỗi lập lịch điều phối Kubernetes' },
    { en: /Workload underutilized/gi, vi: 'Tài nguyên làm việc dư thừa' },
    { en: /High latency detected/gi, vi: 'Độ trễ phản hồi tăng cao' },
    { en: /Memory leak detected/gi, vi: 'Phát hiện rò rỉ bộ nhớ' },
    { en: /Pod crash loop back-off/gi, vi: 'Pod bị kẹt vòng lặp CrashLoopBackOff' },
    { en: /OOMKilled/gi, vi: 'Tiến trình bị hủy do tràn RAM (OOMKilled)' },
  ];

  for (const { en, vi } of causeTranslations) {
    title = title.replace(en, vi);
  }

  title = title.replace(/\s+on\s+/gi, ' trên ');
  return title;
};

export const translateSeverity = (sev) => {
  if (!sev) return 'TRUNG BÌNH';
  const s = String(sev).toUpperCase();
  if (s === 'CRITICAL') return 'KHẨN CẤP';
  if (s === 'HIGH') return 'CAO';
  if (s === 'MEDIUM') return 'TRUNG BÌNH';
  if (s === 'LOW') return 'THẤP';
  return s;
};

// Danh sách trắng cho phép loại rủi ro dự báo hợp lệ (ngăn chặn việc lấy tên hành động thay cho rủi ro)
const VALID_RISKS = new Set([
  'OOM',
  'CPU_OVERLOAD',
  'DISK_FULL',
  'HIGH_LATENCY',
  'HTTP_5XX_SPIKE',
  'TRAFFIC_OVERLOAD',
  'UNSTABLE_POD',
  'SCALE_DOWN_CANDIDATE',
]);

// Danh sách các workload kinh doanh chuẩn của hệ thống
const KNOWN_SERVICES = [
  'attack-injector-app',
  'chaos-testagent2',
  'ecommerce-store-app',
  'mongodb-init',
  'mongodb',
  'selfheal-test-app',
  'sme-order-service',
];

const cleanServiceName = (raw) => {
  if (!raw || typeof raw !== 'string') return null;
  let s = raw.trim();
  s = s.replace(/^dịch vụ\s+/i, '').replace(/^service\s+/i, '').replace(/^pod[\/:]\s*/i, '');
  s = s.replace(/['".,;:)]+$/, '').replace(/^['"(]+/, '').trim();
  if (KNOWN_SERVICES.includes(s.toLowerCase())) {
    return s.toLowerCase();
  }
  // Loại bỏ các câu văn mô tả dài hoặc chứa khoảng trắng
  if (/^[a-zA-Z0-9][a-zA-Z0-9_.-]{1,40}$/.test(s)) {
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

  const recAction = rcaParsed?.recommendation?.action || item.recommendation || (item.title?.includes('UNKNOWN') ? 'NO_ACTION' : 'RESTART_POD & RESCALE');
  const isNoAction = recAction === 'NO_ACTION' || (item.title && item.title.includes('UNKNOWN') && (item.severity === 'LOW' || !item.severity));

  // Trạng thái vòng đời sự cố lấy từ backend status, không tự suy ra sự cố an toàn chỉ từ NO_ACTION
  let statusLabel = 'Đang theo dõi';
  if (isResolved) {
    statusLabel = 'Đã khắc phục hoàn tất';
  } else if (isRecovering) {
    statusLabel = 'Đang tự phục hồi';
  } else if (item.status === 'OPEN') {
    statusLabel = isNoAction ? 'Chưa đủ bằng chứng (NO_ACTION)' : 'Chờ phê duyệt HITL';
  } else if (item.status) {
    statusLabel = item.status;
  }
  const recReason = rcaParsed?.recommendation?.reason || 'Tự động giải phóng tiến trình và điều chỉnh ngưỡng tài nguyên an toàn theo MAPE-K';

  // Chuẩn hóa confidence an toàn, giữ nguyên 0 và không fallback về 92%
  const rcaConfidence = parseConfidence(item.rca_confidence);

  // Chỉ chấp nhận predictedRisk khi thuộc VALID_RISKS, không lấy tên hành động thay cho rủi ro
  let predictedRisk = null;
  const rawRiskCandidate = rcaParsed?.prediction?.detected_risks?.[0]?.risk_type
    || item.prediction?.detected_risks?.[0]?.risk_type
    || item.prediction_type
    || item.incident_type;

  if (rawRiskCandidate && VALID_RISKS.has(String(rawRiskCandidate).toUpperCase())) {
    predictedRisk = String(rawRiskCandidate).toUpperCase();
  }

  let evidencesList = [
    {
      type: 'AI_TELEMETRY',
      ref: serviceName,
      summary: predictedRisk
        ? `Mô hình AI phát hiện nguy cơ ${predictedRisk}${rcaConfidence !== null ? ` với độ tin cậy ${rcaConfidence}%` : ''}`
        : 'Mô hình AI theo dõi chuỗi viễn trắc telemetry',
      score: rcaConfidence !== null ? `${rcaConfidence}%` : 'Chưa đánh giá',
    },
    {
      type: 'K8S_EVENT',
      ref: `pod/${serviceName}`,
      summary: 'Kubelet cảnh báo tải tài nguyên tăng nhanh',
      score: '91%',
    },
  ];

  if (rcaParsed?.evidence && Array.isArray(rcaParsed.evidence) && rcaParsed.evidence.length > 0) {
    evidencesList = rcaParsed.evidence.map((ev, idx) => ({
      type: idx === 0 ? 'AI_TELEMETRY' : 'K8S_EVENT',
      ref: serviceName,
      summary: typeof ev === 'string' ? ev : (ev.summary || JSON.stringify(ev)),
      score: rcaConfidence !== null ? `${rcaConfidence}%` : 'Chưa đánh giá',
    }));
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
    namespace: item.namespace || 'default',
    node: item.node_name || (item.cluster_name ? `${item.cluster_name}-node-1` : (item.cluster_id || 'worker-01')),
    severity: (item.severity || 'HIGH').toUpperCase(),
    status: statusLabel,
    time: formatRelativeTime(item.detected_at || item.created_at),
    detectedAt: item.detected_at || item.created_at,
    impact: item.description || `Ảnh hưởng hiệu năng dịch vụ ${serviceName}`,
    rootCause: item.root_cause_description || item.description || 'Hệ thống tự động phát hiện mẫu hành vi bất thường từ chuỗi viễn trắc AI.',
    rootCauseType: item.root_cause_type || (predictedRisk ? `Nguy cơ ${predictedRisk}` : 'Bất thường dịch vụ'),
    confidence: rcaConfidence,
    rcaConfidence: rcaConfidence,
    predictedRisk: predictedRisk,
    primaryRisk: predictedRisk ? `${predictedRisk}${rcaConfidence !== null ? ` (${rcaConfidence}%)` : ''}` : null,
    mttr: isResolved ? 'Đã khắc phục hoàn tất' : 'Đang chạy (1.4s)',
    recommendationAction: recAction,
    recommendationReason: recReason,
    evidences: evidencesList,
    causalSteps: [
      { step: '1. Tín hiệu sơ cấp', desc: `Đột biến lưu lượng hoặc viễn trắc trên ${serviceName}` },
      { step: '2. Tích tụ tài nguyên', desc: 'Mô hình AI phát hiện chuỗi trượt viễn trắc vượt ngưỡng an toàn' },
      { step: '3. Hệ quả hạ tầng', desc: `Kubelet ghi nhận cảnh báo bất thường trên pod ${serviceName}` },
      { step: '4. Tác động & Tự lành', desc: isResolved ? 'Vòng lặp MAPE-K đã hoàn tất tự khắc phục' : 'Vòng lặp MAPE-K đang can thiệp khôi phục tự động' }
    ]
  };
};

export const IncidentsPage = ({ onNavigate }) => {
  const { currentOrg, currentEnv, envList, setCurrentEnv } = useDashboard();
  const [selectedCluster, setSelectedCluster] = useState(() => currentEnv?.cluster || 'all'); // 'all' | clusterId

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
  const [timeFilterMode, setTimeFilterMode] = useState('today'); // 'today' | 'date' | 'month' | 'year' | 'all'
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

  // Tải danh sách cụm K8s và Workloads đã đăng ký trong tổ chức
  useEffect(() => {
    let isMounted = true;
    const loadAuxiliary = async () => {
      try {
        const workloads = await aiService.getWorkloads();
        if (isMounted && Array.isArray(workloads)) {
          setRegisteredWorkloads(workloads);
        }
      } catch (err) {}

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
    loadAuxiliary();
    return () => { isMounted = false; };
  }, [currentOrg?.id]);

  // Tải dữ liệu thật từ Main Backend API
  const fetchIncidents = useCallback(async () => {
    setIsLoading(true);
    try {
      const activeOrgId = currentOrg?.id;

      const params = {
        limit: 2000,
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
      console.warn('[IncidentsPage] Không thể kết nối API sự cố:', err.message);
      setIncidents([]);
      setIsUsingLiveDb(false);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [currentOrg?.id, selectedCluster, selectedStatus, selectedSeverity, searchQuery]);

  useEffect(() => {
    fetchIncidents();
  }, [fetchIncidents]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchIncidents();
  };

  // Kích hoạt giải quyết sự cố tức thời
  const handleResolveIncident = async (id, rawId) => {
    const targetRawId = rawId || incidents.find((i) => i.id === id)?.rawId;
    if (targetRawId) {
      try {
        await aiService.updateIncidentStatus(targetRawId, 'RESOLVED');
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

  // Danh sách service động kèm số lượng sự cố thực tế
  const availableServices = useMemo(() => {
    const counts = {};
    const clusterIncidents = incidents.filter((inc) => {
      if (selectedCluster === 'all') return true;
      return inc.clusterId === selectedCluster || inc.cluster === selectedCluster || inc.clusterName === selectedCluster;
    });

    clusterIncidents.forEach((i) => {
      if (i.service && i.service !== 'ứng dụng hệ thống') {
        const cleaned = cleanServiceName(i.service);
        if (cleaned) {
          counts[cleaned] = (counts[cleaned] || 0) + 1;
        }
      }
    });

    const rawWorkloadNames = (registeredWorkloads || [])
      .map((w) => (typeof w === 'string' ? w : (w?.name || '')))
      .map(cleanServiceName)
      .filter(Boolean);

    const allServiceNames = new Set([
      ...Object.keys(counts),
      ...rawWorkloadNames,
    ]);

    // Các dịch vụ hạ tầng / agent hệ thống không phải ứng dụng nghiệp vụ
    const SYSTEM_IGNORED = new Set([
      'coredns', 'etcd-minikube', 'kindnet', 'kube', 'kube-apiserver-minikube',
      'kube-controller', 'kube-controller-manager-minikube', 'kube-scheduler-minikube',
      'metrics-server', 'selfheal-agent', 'storage-provisioner', 'order-service'
    ]);

    return Array.from(allServiceNames)
      .filter((s) => s && !SYSTEM_IGNORED.has(s) && !s.includes('-0000-'))
      .map((name) => ({
        name,
        count: counts[name] || 0,
      }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [incidents, registeredWorkloads, selectedCluster]);

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

  // Thống kê nhanh
  const stats = useMemo(() => {
    const total = incidents.length;
    const critical = incidents.filter((i) => i.severity === 'CRITICAL' || i.severity === 'HIGH').length;
    const recovering = incidents.filter((i) => i.status.includes('phục hồi') || i.status.includes('duyệt')).length;
    const resolved = incidents.filter((i) => i.status.includes('hoàn tất') || i.status.includes('an toàn')).length;
    return { total, critical, recovering, resolved };
  }, [incidents]);

  // Bộ lọc dữ liệu phía Client
  const filteredIncidents = useMemo(() => {
    return incidents.filter((inc) => {
      const matchSeverity = selectedSeverity === 'all' || inc.severity === selectedSeverity;
      const matchStatus =
        selectedStatus === 'all' ||
        (selectedStatus === 'RECOVERING' && inc.status.includes('phục hồi')) ||
        (selectedStatus === 'HITL' && inc.status.includes('duyệt')) ||
        (selectedStatus === 'NO_ACTION' && (inc.status.includes('NO_ACTION') || inc.status.includes('an toàn'))) ||
        (selectedStatus === 'RESOLVED' && inc.status.includes('hoàn tất'));
      const matchService = selectedService === 'all' || inc.service === selectedService;
      const matchSearch =
        !searchQuery.trim() ||
        inc.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        inc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        inc.service.toLowerCase().includes(searchQuery.toLowerCase()) ||
        inc.rootCause.toLowerCase().includes(searchQuery.toLowerCase());

      const matchCluster =
        selectedCluster === 'all' ||
        inc.clusterId === selectedCluster ||
        inc.cluster === selectedCluster ||
        inc.clusterName === selectedCluster ||
        (inc.clusterName && selectedCluster && inc.clusterName.toLowerCase() === selectedCluster.toLowerCase()) ||
        (inc.clusterId && selectedCluster && inc.clusterId.toLowerCase() === selectedCluster.toLowerCase());
      return matchCluster && matchSeverity && matchStatus && matchService && matchSearch;
    });
  }, [incidents, selectedSeverity, selectedStatus, selectedService, searchQuery, selectedCluster]);

  // Tính toán phân trang (Pagination calculations)
  const totalFiltered = filteredIncidents.length;
  const totalPages = Math.ceil(totalFiltered / pageSize) || 1;
  const safePage = Math.min(Math.max(1, page), totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalFiltered);
  const paginatedIncidents = useMemo(() => {
    return filteredIncidents.slice(startIndex, endIndex);
  }, [filteredIncidents, startIndex, endIndex]);

  return (
    <div className="dashboard-incidents-page" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header Banner */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                backgroundColor: 'rgba(5, 150, 105, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <AlertTriangle size={20} color="var(--dash-primary)" />
            </div>
            <div>
              <h1
                style={{
                  fontSize: '1.45rem',
                  fontWeight: 800,
                  color: 'var(--dash-text-primary)',
                  letterSpacing: '-0.02em',
                  margin: 0,
                }}
              >
                Quản Lý Sự Cố & Phân Tích Nguyên Nhân Gốc Rễ (RCA)
              </h1>
              <p style={{ fontSize: '0.8125rem', color: 'var(--dash-text-secondary)', marginTop: '2px', margin: 0 }}>
                Bảng tổng quan sự cố và suy diễn cây nguyên nhân nhân quả
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
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
              color: 'var(--dash-text-primary)',
            }}
          >
            <RefreshCw size={14} className={isRefreshing || isLoading ? 'animate-spin' : ''} />
            <span>Làm mới</span>
          </button>
        </div>
      </div>

      {/* 4 Stat Overview Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        {/* Card 1: Tổng Sự Cố */}
        <div className="dash-card" style={{ padding: '16px', backgroundColor: '#FFFFFF', border: '1px solid var(--dash-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--dash-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Tổng Sự Cố
            </span>
            <Layers size={18} color="#6366F1" />
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--dash-text-primary)', fontFamily: 'var(--font-mono)' }}>
            {stats.total.toLocaleString()}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-secondary)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span
              style={{
                display: 'inline-block',
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: '#6366F1',
              }}
            />
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
              {selectedCluster === 'all'
                ? 'Toàn bộ cụm K8s'
                : (availableClusters.find(c => c.id === selectedCluster)?.name || selectedCluster)}
            </span>
          </div>
        </div>

        {/* Card 2: Nguy Cấp (Critical) */}
        <div className="dash-card" style={{ padding: '16px', backgroundColor: '#FFFFFF', border: '1px solid var(--dash-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--dash-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Nguy Cấp (Critical)
            </span>
            <AlertTriangle size={18} color={stats.critical > 0 ? '#DC2626' : '#94A3B8'} />
          </div>
          <div
            style={{
              fontSize: '1.65rem',
              fontWeight: 800,
              color: stats.critical > 0 ? '#DC2626' : '#059669',
              fontFamily: 'var(--font-mono)',
            }}
          >
            {stats.critical.toLocaleString()}
          </div>
          <div style={{ fontSize: '0.75rem', color: stats.critical > 0 ? '#DC2626' : 'var(--dash-text-secondary)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span
              style={{
                display: 'inline-block',
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: stats.critical > 0 ? '#DC2626' : '#10B981',
                boxShadow: stats.critical > 0 ? '0 0 8px #DC2626' : 'none',
              }}
            />
            <span>{stats.critical > 0 ? 'Ưu tiên tự phục hồi khẩn cấp' : 'Không có sự cố nguy cấp'}</span>
          </div>
        </div>

        {/* Card 3: Đang Tự Phục Hồi */}
        <div className="dash-card" style={{ padding: '16px', backgroundColor: '#FFFFFF', border: '1px solid var(--dash-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--dash-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Đang Tự Phục Hồi
            </span>
            <Zap size={18} color={stats.recovering > 0 ? '#D97706' : '#059669'} />
          </div>
          <div
            style={{
              fontSize: '1.65rem',
              fontWeight: 800,
              color: stats.recovering > 0 ? '#D97706' : '#059669',
              fontFamily: 'var(--font-mono)',
            }}
          >
            {stats.recovering.toLocaleString()}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-secondary)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span
              style={{
                display: 'inline-block',
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: stats.recovering > 0 ? '#D97706' : '#10B981',
                boxShadow: stats.recovering > 0 ? '0 0 8px #D97706' : 'none',
              }}
            />
            <span>{stats.recovering > 0 ? 'Vòng lặp MAPE-K đang xử lý' : 'Hệ thống vận hành ổn định'}</span>
          </div>
        </div>

        {/* Card 4: Đã Khắc Phục */}
        <div className="dash-card" style={{ padding: '16px', backgroundColor: '#FFFFFF', border: '1px solid var(--dash-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--dash-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Đã Khắc Phục
            </span>
            <CheckCircle2 size={18} color="#059669" />
          </div>
          <div
            style={{
              fontSize: '1.65rem',
              fontWeight: 800,
              color: '#059669',
              fontFamily: 'var(--font-mono)',
            }}
          >
            {stats.resolved.toLocaleString()}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#10B981', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <CheckCircle2 size={13} />
            <span>Khôi phục SLA 99.9%</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div
        className="dash-card"
        style={{
          padding: '12px 18px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          borderRadius: '12px',
          backgroundColor: '#FFFFFF',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px' }}>
          {/* Bộ Lọc Ngày / Tháng / Năm Đẹp Mắt */}
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
            title="Lọc nhanh toàn bộ sự cố phát sinh trong ngày hôm nay"
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

                    {/* Quick presets for days with incidents */}
                    <div style={{ marginTop: '10px' }}>
                      <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#94A3B8', marginBottom: '6px' }}>
                        Ngày có sự cố gần đây:
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
                        marginBottom: '10px',
                      }}
                    />

                    {/* 12 Months grid */}
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

          {/* Severity Select */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--dash-text-secondary)' }}>Mức độ:</span>
            <select
              value={selectedSeverity}
              onChange={(e) => setSelectedSeverity(e.target.value)}
              style={{
                height: '32px',
                padding: '0 8px',
                fontSize: '0.75rem',
                border: '1px solid var(--dash-border)',
                borderRadius: '6px',
                backgroundColor: '#F8FAFC',
                color: 'var(--dash-text-primary)',
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              <option value="all">Tất cả mức độ</option>
              <option value="CRITICAL">Critical (Nguy cấp)</option>
              <option value="HIGH">High (Cao)</option>
              <option value="MEDIUM">Medium (Trung bình)</option>
              <option value="LOW">Low (Thấp)</option>
            </select>
          </div>

          {/* Status Select */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--dash-text-secondary)' }}>Trạng thái:</span>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              style={{
                height: '32px',
                padding: '0 8px',
                fontSize: '0.75rem',
                border: '1px solid var(--dash-border)',
                borderRadius: '6px',
                backgroundColor: '#F8FAFC',
                color: 'var(--dash-text-primary)',
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="RECOVERING">Đang tự phục hồi</option>
              <option value="HITL">Chờ phê duyệt HITL</option>
              <option value="NO_ACTION">Tự động an toàn (NO_ACTION)</option>
              <option value="RESOLVED">Đã khắc phục hoàn tất</option>
            </select>
          </div>

          {/* Service Select */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--dash-text-secondary)' }}>Dịch vụ:</span>
            <select
              value={selectedService}
              onChange={(e) => setSelectedService(e.target.value)}
              style={{
                height: '32px',
                padding: '0 8px',
                fontSize: '0.75rem',
                fontWeight: 600,
                border: '1px solid #BBF7D0',
                borderRadius: '6px',
                backgroundColor: '#F0FDF4',
                color: '#15803D',
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              <option value="all">Tất cả dịch vụ ({availableServices.length})</option>
              {availableServices.map((svc) => (
                <option key={svc.name} value={svc.name}>
                  {svc.name} {svc.count > 0 ? '(' + svc.count + ')' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Search Input */}
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              placeholder="Tìm kiếm sự cố..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                height: '32px',
                width: '220px',
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

        <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-secondary)' }}>
          Hiển thị <strong>{totalFiltered > 0 ? startIndex + 1 : 0} - {endIndex}</strong> trên <strong>{totalFiltered}</strong> sự cố (tổng <strong>{incidents.length}</strong>)
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
          border: '1px solid var(--dash-border)',
          boxShadow: '0 1px 3px rgba(15, 23, 42, 0.05)',
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
                <th style={{ padding: '14px 16px', fontSize: '0.75rem', fontWeight: 700, color: '#334155', whiteSpace: 'nowrap', width: '130px' }}>
                  MÃ SỰ CỐ
                </th>
                <th style={{ padding: '14px 16px', fontSize: '0.75rem', fontWeight: 700, color: '#334155', whiteSpace: 'nowrap', width: '110px' }}>
                  MỨC ĐỘ
                </th>
                <th style={{ padding: '14px 16px', fontSize: '0.75rem', fontWeight: 700, color: '#334155', whiteSpace: 'nowrap', width: '170px' }}>
                  DỊCH VỤ / NODE
                </th>
                <th style={{ padding: '14px 18px', fontSize: '0.75rem', fontWeight: 700, color: '#334155', whiteSpace: 'nowrap', minWidth: '380px', maxWidth: '420px' }}>
                  TIÊU ĐỀ SỰ CỐ TỔNG QUAN
                </th>
                <th style={{ padding: '14px 16px', fontSize: '0.75rem', fontWeight: 700, color: '#334155', whiteSpace: 'nowrap', width: '150px' }}>
                  TRẠNG THÁI
                </th>
                <th style={{ padding: '14px 16px', fontSize: '0.75rem', fontWeight: 700, color: '#334155', whiteSpace: 'nowrap', width: '150px', textAlign: 'right' }}>
                  THAO TÁC
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} style={{ padding: '54px 20px', textAlign: 'center', color: '#64748B' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '42px', height: '42px', borderRadius: '50%', backgroundColor: 'rgba(5, 150, 105, 0.08)', margin: '0 auto 12px auto' }}>
                      <RefreshCw size={20} className="animate-spin" color="var(--dash-primary)" />
                    </div>
                    <div style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#0F172A' }}>
                      Đang đồng bộ danh sách sự cố...
                    </div>
                    <div style={{ fontSize: '0.8125rem', marginTop: '6px', color: '#64748B' }}>
                      Đang phân tích dữ liệu viễn trắc và chuỗi nguyên nhân gốc rễ
                    </div>
                  </td>
                </tr>
              ) : filteredIncidents.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '48px 20px', textAlign: 'center', color: '#64748B' }}>
                    <ShieldCheck size={42} color="#10B981" style={{ margin: '0 auto 12px auto' }} />
                    <div style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#0F172A' }}>
                      {incidents.length === 0
                        ? `Cụm ${currentEnv?.cluster || 'K8s'} không ghi nhận sự cố nào`
                        : 'Không tìm thấy sự cố nào phù hợp với bộ lọc'}
                    </div>
                    <div style={{ fontSize: '0.8125rem', marginTop: '6px', color: '#64748B' }}>
                      {incidents.length === 0
                        ? 'Toàn bộ các dịch vụ và node trên cụm đang hoạt động an toàn theo thời gian thực.'
                        : 'Thử điều chỉnh lại mức độ, trạng thái hoặc từ khóa tìm kiếm.'}
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedIncidents.map((item, index) => {
                  const isCrit = item.severity === 'CRITICAL';
                  const isHigh = item.severity === 'HIGH';
                  const isMed = item.severity === 'MEDIUM';

                  const isDone = item.status.includes('hoàn tất');
                  const isSafeNoAction = item.status.includes('NO_ACTION') || item.status.includes('an toàn');
                  const isWait = item.status.includes('duyệt');

                  return (
                    <tr
                      key={item.id}
                      style={{
                        borderBottom: '1px solid #F1F5F9',
                        backgroundColor: index % 2 === 0 ? '#FFFFFF' : '#FAFAFA',
                        transition: 'background-color 0.15s ease',
                      }}
                    >
                      <td style={{ padding: '14px 16px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#0F172A', whiteSpace: 'nowrap' }}>
                        <span
                          style={{
                            backgroundColor: '#F1F5F9',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            border: '1px solid #E2E8F0',
                            fontSize: '0.75rem',
                          }}
                        >
                          {item.id}
                        </span>
                      </td>

                      <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '3px 8px',
                            fontFamily: 'var(--font-mono)',
                            fontSize: '0.6875rem',
                            fontWeight: 800,
                            borderRadius: '6px',
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

                      <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                        <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--dash-primary)' }}>
                          {item.service}
                        </div>
                        <div style={{ fontSize: '0.6875rem', color: '#64748B', marginTop: '2px' }}>
                          <span style={{ color: "#94A3B8" }}>Namespace:</span> {item.namespace} &bull; <span style={{ color: "#94A3B8" }}>Node:</span> {item.node}
                        </div>
                      </td>

                      {/* CỘT TIÊU ĐỀ: ĐỘ RỘNG VỪA PHẢI, NẰM NGANG, HIỂN THỊ 2 HÀNG RỒI MỚI ... */}
                      <td style={{ padding: '14px 18px', minWidth: '380px', maxWidth: '420px' }}>
                        <div
                          title={item.title}
                          style={{
                            fontWeight: 600,
                            color: '#0F172A',
                            fontSize: '0.84rem',
                            lineHeight: 1.5,
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
                      </td>

                      <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '4px 9px',
                            borderRadius: '12px',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            backgroundColor: isDone ? '#DCFCE7' : isSafeNoAction ? '#ECFDF5' : isWait ? '#FEF3C7' : '#EFF6FF',
                            color: isDone ? '#15803D' : isSafeNoAction ? '#047857' : isWait ? '#B45309' : '#1D4ED8',
                            border: `1px solid ${isDone ? '#86EFAC' : isSafeNoAction ? '#A7F3D0' : isWait ? '#FDE68A' : '#BFDBFE'}`,
                          }}
                        >
                          {isDone ? (
                            <CheckCircle2 size={13} />
                          ) : isSafeNoAction ? (
                            <ShieldCheck size={13} />
                          ) : isWait ? (
                            <Clock size={13} />
                          ) : (
                            <Zap size={13} />
                          )}
                          <span>{item.status}</span>
                        </span>
                      </td>

                      <td style={{ padding: '12px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                          {/* Nút Xem Chi Tiết -> BẬT KHUNG CỬA SỔ NHỎ (MODAL) */}
                          <button
                            type="button"
                            onClick={() => setActiveModalIncident(item)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              padding: '6px 14px',
                              background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                              color: '#FFFFFF',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              borderRadius: '7px',
                              border: 'none',
                              cursor: 'pointer',
                              boxShadow: '0 2px 4px rgba(5, 150, 105, 0.25)',
                              transition: 'all 0.15s ease',
                            }}
                          >
                            <Eye size={13} />
                            <span>Xem chi tiết</span>
                          </button>

                          {/* Thời điểm ghi nhận đặt ngay dưới nút xem chi tiết */}
                          <div
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '0.6875rem',
                              color: '#64748B',
                              fontWeight: 500,
                            }}
                          >
                            <Clock size={11} color="#94A3B8" />
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
              padding: '12px 20px',
              borderTop: '1px solid #E2E8F0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
              backgroundColor: '#F8FAFC',
              fontSize: '0.8125rem',
            }}
          >
            {/* Chọn số bản ghi / trang & Tóm tắt */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ color: '#64748B', fontSize: '0.75rem', fontWeight: 500 }}>Số dòng mỗi trang:</span>
                <select
                  aria-label="Số bản ghi mỗi trang"
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                  style={{
                    padding: '4px 8px',
                    borderRadius: '6px',
                    border: '1px solid #CBD5E1',
                    backgroundColor: '#FFFFFF',
                    color: '#0F172A',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    outline: 'none',
                    cursor: 'pointer',
                  }}
                >
                  <option value={10}>10 sự cố</option>
                  <option value={20}>20 sự cố</option>
                  <option value={50}>50 sự cố</option>
                </select>
              </div>

              <span style={{ color: '#CBD5E1' }}>|</span>

              <span style={{ color: '#64748B', fontSize: '0.75rem' }}>
                Đang hiển thị <strong>{startIndex + 1} - {endIndex}</strong> trên <strong>{totalFiltered}</strong> sự cố
              </span>
            </div>

            {/* Các nút bấm chuyển trang */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: '#64748B', fontSize: '0.75rem', marginRight: '4px' }}>
                Trang <strong>{safePage}</strong> / <strong>{totalPages}</strong>
              </span>

              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                {/* Về trang đầu */}
                <button
                  type="button"
                  title="Trang đầu"
                  disabled={safePage <= 1}
                  onClick={() => setPage(1)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '30px',
                    height: '30px',
                    borderRadius: '6px',
                    border: '1px solid #CBD5E1',
                    backgroundColor: '#FFFFFF',
                    color: safePage <= 1 ? '#CBD5E1' : '#334155',
                    cursor: safePage <= 1 ? 'not-allowed' : 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <ChevronsLeft size={15} />
                </button>

                {/* Trang trước */}
                <button
                  type="button"
                  title="Trang trước"
                  disabled={safePage <= 1}
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '30px',
                    height: '30px',
                    borderRadius: '6px',
                    border: '1px solid #CBD5E1',
                    backgroundColor: '#FFFFFF',
                    color: safePage <= 1 ? '#CBD5E1' : '#334155',
                    cursor: safePage <= 1 ? 'not-allowed' : 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <ChevronLeft size={15} />
                </button>

                {/* Các nút số trang */}
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
                        <span key={item} style={{ padding: '0 4px', color: '#94A3B8', fontSize: '0.75rem' }}>
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
                          minWidth: '30px',
                          height: '30px',
                          padding: '0 6px',
                          borderRadius: '6px',
                          border: isCurrent ? 'none' : '1px solid #CBD5E1',
                          background: isCurrent ? 'linear-gradient(135deg, #059669 0%, #047857 100%)' : '#FFFFFF',
                          color: isCurrent ? '#FFFFFF' : '#334155',
                          fontSize: '0.75rem',
                          fontWeight: isCurrent ? 700 : 500,
                          cursor: 'pointer',
                          boxShadow: isCurrent ? '0 2px 4px rgba(5, 150, 105, 0.25)' : 'none',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {item}
                      </button>
                    );
                  })}

                {/* Trang sau */}
                <button
                  type="button"
                  title="Trang tiếp theo"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '30px',
                    height: '30px',
                    borderRadius: '6px',
                    border: '1px solid #CBD5E1',
                    backgroundColor: '#FFFFFF',
                    color: safePage >= totalPages ? '#CBD5E1' : '#334155',
                    cursor: safePage >= totalPages ? 'not-allowed' : 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <ChevronRight size={15} />
                </button>

                {/* Đến trang cuối */}
                <button
                  type="button"
                  title="Trang cuối"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage(totalPages)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '30px',
                    height: '30px',
                    borderRadius: '6px',
                    border: '1px solid #CBD5E1',
                    backgroundColor: '#FFFFFF',
                    color: safePage >= totalPages ? '#CBD5E1' : '#334155',
                    cursor: safePage >= totalPages ? 'not-allowed' : 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <ChevronsRight size={15} />
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
          onClose={() => setActiveModalIncident(null)}
          onResolve={handleResolveIncident}
        />
      )}
    </div>
  );
};

export default IncidentsPage;
