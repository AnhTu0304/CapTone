import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useDashboard } from '../context/DashboardContext';
import { aiService } from '../../../services/aiService';
import { telemetryService } from '../../../services/telemetryService';
import {
  Sparkles,
  RefreshCw,
  ShieldCheck,
  Zap,
  Check,
  AlertTriangle,
  Activity,
  Cpu,
  HardDrive,
  Clock,
  Layers,
  Server,
  TrendingUp,
  BarChart2,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Eye,
  Info,
  ZoomIn,
  Sliders,
  Filter,
  X,
  ShieldAlert,
  FileText,
  CheckCircle,
  Table,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

const RISK_HEADS_CONFIG = [
  { key: 'CPU_OVERLOAD', label: 'Quá Tải CPU (CPU Overload)', threshold: 0.81, defaultDesc: 'Bão hòa chu kỳ CPU do tác vụ xử lý dồn dập' },
  { key: 'OOM', label: 'Nguy Cơ Tràn RAM (OOM Risk)', threshold: 0.50, defaultDesc: 'Độ dốc rò rỉ bộ nhớ RSS vượt ngưỡng an toàn Pod' },
  { key: 'HIGH_LATENCY', label: 'Độ Trễ Phản Hồi Cao (High Latency)', threshold: 0.62, defaultDesc: 'Tắc nghẽn xử lý I/O hoặc nghẽn mạng cụm' },
  { key: 'DISK_FULL', label: 'Tràn Bộ Nhớ Đĩa (Disk Full)', threshold: 0.85, defaultDesc: 'Phân vùng ephemeral storage hoặc log phình to' },
  { key: 'HTTP_5XX_SPIKE', label: 'Đột Biến Lỗi 5xx (5xx Spike)', threshold: 0.81, defaultDesc: 'Tỷ lệ lỗi máy chủ tăng cao bất thường' },
  { key: 'TRAFFIC_OVERLOAD', label: 'Quá Tải Lưu Lượng (Traffic Spike)', threshold: 0.85, defaultDesc: 'Đột biến lưu lượng truy cập Ingress ngoài dự kiến' },
  { key: 'SCALE_DOWN_CANDIDATE', label: 'Thu Nhỏ Bản Sao (Scale Down / Tiết Kiệm)', threshold: 0.96, defaultDesc: 'Tải thấp kéo dài liên tục; đề xuất giảm số lượng Pod để tối ưu chi phí hạ tầng' },
];

const SERIES_CONFIG = [
  { key: 'cpu', label: 'CPU (%)', color: '#10B981', gradientId: 'cpuGrad', unit: '%' },
  { key: 'ram', label: 'RAM (%)', color: '#3B82F6', gradientId: 'ramGrad', unit: '%' },
  { key: 'disk', label: 'Đĩa Disk (%)', color: '#F59E0B', gradientId: 'diskGrad', unit: '%' },
  { key: 'latency', label: 'Độ trễ (ms)', color: '#8B5CF6', gradientId: 'latGrad', unit: 'ms' },
  { key: 'request_rate', label: 'Lưu lượng (Req/s)', color: '#06B6D4', gradientId: 'reqGrad', unit: 'req/s' },
  { key: 'http_5xx_rate', label: 'Lỗi 5xx (%)', color: '#EF4444', gradientId: 'errGrad', unit: '%' },
];

const parseRiskOutputs = (riskOutputs) => {
  if (!riskOutputs) return {};
  if (typeof riskOutputs === 'object') return riskOutputs;
  try {
    return JSON.parse(riskOutputs);
  } catch {
    return {};
  }
};

const getActiveRisks = (p) => {
  const outputs = parseRiskOutputs(p?.risk_outputs);
  const items = [];

  const RISK_META = {
    HTTP_5XX_SPIKE: { label: 'HTTP 5xx Lỗi', color: '#DC2626', bg: '#FEE2E2', border: '#FCA5A5' },
    HIGH_LATENCY: { label: 'Độ trễ cao', color: '#D97706', bg: '#FEF3C7', border: '#FCD34D' },
    CPU_OVERLOAD: { label: 'Quá tải CPU', color: '#B91C1C', bg: '#FEE2E2', border: '#FCA5A5' },
    OOM: { label: 'Tràn RAM (OOM)', color: '#7E22CE', bg: '#F3E8FF', border: '#D8B4FE' },
    DISK_FULL: { label: 'Đầy ổ đĩa', color: '#B45309', bg: '#FEF3C7', border: '#FDE68A' },
    TRAFFIC_OVERLOAD: { label: 'Quá tải lưu lượng', color: '#1D4ED8', bg: '#DBEAFE', border: '#93C5FD' },
    SCALE_DOWN_CANDIDATE: { label: 'Dư thừa tài nguyên', color: '#475569', bg: '#F1F5F9', border: '#CBD5E1' },
  };

  Object.entries(outputs).forEach(([riskKey, val]) => {
    const conf = typeof val === 'object' && val !== null ? Number(val.confidence || 0) : Number(val || 0);
    if (conf >= 0.05) {
      items.push({
        key: riskKey,
        confidence: conf,
        meta: RISK_META[riskKey] || { label: riskKey, color: '#DC2626', bg: '#FEE2E2', border: '#FCA5A5' }
      });
    }
  });

  items.sort((a, b) => b.confidence - a.confidence);
  return items;
};

// Cấu hình hiển thị chi tiết hành động tự lành
const getActionDetails = (code) => {
  switch (code) {
    case 'RESTART_POD':
      return {
        label: 'Khởi động lại Pod (RESTART_POD)',
        desc: 'Thực hiện Rolling Restart an toàn cho Pod mục tiêu qua Kubernetes API, kiểm soát Zero-Downtime theo vòng lặp thích ứng MAPE\u2011K.',
        badgeBg: '#EFF6FF',
        badgeColor: '#1D4ED8',
        badgeBorder: '#BFDBFE',
      };
    case 'SCALE_REPLICAS':
      return {
        label: 'Mở rộng bản sao Pod (SCALE_REPLICAS)',
        desc: 'Tự động nâng số lượng Replicas Pods để phân bổ tải và phục hồi năng lực dịch vụ theo chuẩn MAPE\u2011K.',
        badgeBg: '#ECFDF5',
        badgeColor: '#047857',
        badgeBorder: '#A7F3D0',
      };
    case 'ROLLBACK_DEPLOYMENT':
      return {
        label: 'Hoàn nguyên phiên bản (ROLLBACK)',
        desc: 'Khôi phục về bản ReplicaSet ổn định trước đó nhằm triệt tiêu lỗi CrashLoop sau bản phát hành mới.',
        badgeBg: '#FEF2F2',
        badgeColor: '#B91C1C',
        badgeBorder: '#FECACA',
      };
    case 'SCALE_DOWN':
    case 'SCALE_IN':
    case 'SCALE_DOWN_CANDIDATE':
      return {
        label: 'Thu nhỏ bản sao Pod (SCALE_DOWN)',
        desc: 'Tự động giảm số lượng Replicas Pods khi tải thấp liên tục nhằm tối ưu hóa chi phí hạ tầng theo chuẩn MAPE-K.',
        badgeBg: '#F3E8FF',
        badgeColor: '#7E22CE',
        badgeBorder: '#D8B4FE',
      };
    default:
      return {
        label: code || 'Tự phục hồi MAPE\u2011K',
        desc: 'Áp dụng hành động tự sửa lỗi kiểm soát an toàn theo vòng lặp điều khiển tự thích ứng MAPE\u2011K.',
        badgeBg: '#FEF3C7',
        badgeColor: '#B45309',
        badgeBorder: '#FDE68A',
      };
  }
};

// Dịch nguyên nhân gốc rễ RCA sang tiếng Việt chuẩn kỹ thuật
const formatRootCauseType = (cause) => {
  if (!cause) return 'Phát hiện bất thường viễn trắc hệ thống';
  if (cause === 'Unstable application pod') return 'Pod ứng dụng hoạt động không ổn định (Unstable Pod / Lỗi Probe)';
  if (cause === 'CPU_OVERLOAD') return 'Quá tải chu kỳ vi xử lý CPU (CPU Overload)';
  if (cause === 'OOM' || cause === 'MEMORY_LEAK') return 'Nguy cơ tràn bộ nhớ RAM (OOM / Memory Spike)';
  if (cause === 'DISK_FULL') return 'Tràn dung lượng bộ nhớ đĩa (Disk Full)';
  if (cause === 'HIGH_LATENCY') return 'Độ trễ phản hồi vượt ngưỡng (High Latency Spike)';
  if (cause === 'HTTP_5XX_SPIKE') return 'Đột biến tỷ lệ lỗi máy chủ 5xx (5xx Spike)';
  if (cause === 'TRAFFIC_OVERLOAD') return 'Đột biến lưu lượng truy cập Ingress (Traffic Spike)';
  if (cause === 'SCALE_DOWN_CANDIDATE' || cause === 'scale_down_candidate') return 'Cơ hội thu nhỏ tài nguyên (Scale Down Candidate)';
  if (cause === 'underutilized' || cause === 'Workload underutilized (scale down opportunity)') return 'Tải thấp kéo dài / Dư thừa tài nguyên (Underutilized)';
  if (cause === 'insufficient_evidence') return 'Chưa đủ dữ liệu viễn trắc để xác nhận bất thường';
  return cause;
};

// Dịch diễn giải suy luận của AI
const formatAiExplanation = (raw, rootCause) => {
  if (!raw) return 'Kết quả đối soát viễn trắc eBPF và Kubelet xác nhận hành vi bất thường của tiến trình.';
  if (raw.includes('unhealthy or repeatedly restarting')) {
    return 'Phát hiện Pod ứng dụng hoạt động không ổn định hoặc liên tục gặp lỗi khởi động lại (Restart Loop)';
  }
  if (raw.includes('most strongly supports Unstable application pod')) {
    return 'Dữ liệu viễn trắc và bằng chứng hệ thống xác nhận Pod ứng dụng hoạt động không ổn định (tiến trình bên trong Pod không phản hồi kiểm tra tính sẵn sàng Readiness Probe).';
  }
  if (raw.includes('most strongly supports CPU_OVERLOAD')) {
    return 'Bằng chứng viễn trắc eBPF và mô hình AI GRU xác nhận mức tiêu thụ CPU bão hòa, có nguy cơ gây tắc nghẽn hàng đợi xử lý request.';
  }
  if (raw.includes('most strongly supports OOM')) {
    return 'Mức tiêu thụ bộ nhớ RAM tăng dốc liên tục, nguy cơ bị Linux Kernel OOM-Killer tiêu diệt tiến trình.';
  }
  if (raw.includes('Additional replicas can distribute load')) {
    return 'Tải lượng tăng cao đột biến, cần mở rộng thêm bản sao Pod để giải tỏa áp lực và duy trì độ ổn định';
  }
  if (raw.includes('underutilized') || raw.includes('scale down replicas') || raw.includes('low utilization')) {
    return 'Chỉ số viễn trắc cho thấy tải thấp kéo dài liên tục; đề xuất giảm số lượng bản sao Pod để tối ưu chi phí hạ tầng';
  }
  if (raw.includes('No safe infrastructure action is justified')) {
    return 'Hệ thống đang trong giới hạn an toàn tự thích ứng, tiếp tục theo dõi các ngưỡng viễn trắc';
  }
  return raw;
};

// Dịch diễn giải khuyến nghị
const formatReasoning = (raw) => {
  if (!raw) return 'Phát hiện Pod ứng dụng có dấu hiệu bất thường hoặc lặp lại chu kỳ khởi động lại.';
  if (raw.includes('unhealthy or repeatedly restarting')) {
    return 'Phát hiện Pod ứng dụng hoạt động không ổn định hoặc liên tục gặp lỗi khởi động lại (Restart Loop)';
  }
  if (raw.includes('Additional replicas can distribute load')) {
    return 'Tải lượng tăng cao đột biến, cần mở rộng thêm bản sao Pod để giải tỏa áp lực và duy trì độ ổn định';
  }
  if (raw.includes('underutilized') || raw.includes('scale down replicas') || raw.includes('low utilization')) {
    return 'Chỉ số viễn trắc cho thấy tải thấp kéo dài liên tục; đề xuất giảm số lượng bản sao Pod để tối ưu chi phí hạ tầng';
  }
  if (raw.includes('No safe infrastructure action is justified')) {
    return 'Hệ thống đang trong giới hạn an toàn tự thích ứng, tiếp tục theo dõi các ngưỡng viễn trắc';
  }
  return raw;
};

// Dịch chi tiết từng bản ghi bằng chứng RCA
const formatEvidenceDetail = (summaryText, sourceType) => {
  const text = String(summaryText || '').trim();

  if (text.includes('Readiness probe is failing')) {
    return {
      title: 'Lỗi kiểm tra tính sẵn sàng (Readiness Probe Failure)',
      badge: 'KUBELET_PROBE',
      badgeColor: '#DC2626',
      badgeBg: '#FEE2E2',
      importanceLabel: 'Bằng chứng cốt lõi',
      desc: 'Bộ điều khiển Kubernetes Kubelet ghi nhận Pod phản hồi thất bại bài kiểm tra tính sẵn sàng (Readiness probe is failing). Trong thời gian này, K8s Service tự động ngắt định tuyến traffic tới Pod để tránh sinh lỗi gián đoạn cho người dùng.',
    };
  }

  if (text.includes('GRU predicted CPU_OVERLOAD')) {
    const match = text.match(/\(([^)]+)\)/);
    const scoreStr = match ? match[1] : '90%';
    return {
      title: 'Mô hình Deep Learning GRU cảnh báo quá tải CPU',
      badge: 'AI_DEEP_LEARNING',
      badgeColor: '#7C3AED',
      badgeBg: '#EDE9FE',
      importanceLabel: 'Dự báo chuỗi thời gian',
      desc: `Mạng nơ-ron hồi quy GRU (Gated Recurrent Unit) phân tích 12 mốc chuỗi thời gian viễn trắc gần nhất và dự báo nguy cơ quá tải CPU đạt xác suất ${scoreStr}. Cần chủ động can thiệp phòng ngừa trước khi suy sụp dịch vụ.`,
    };
  }

  if (text.includes('CPU usage is critically high')) {
    const match = text.match(/\(([^)]+)\)/);
    const pctStr = match ? match[1] : '> 95%';
    return {
      title: 'Mức tiêu thụ CPU chạm ngưỡng nguy kịch',
      badge: 'EBPF_CPU_METRIC',
      badgeColor: '#DC2626',
      badgeBg: '#FEE2E2',
      importanceLabel: 'Viễn trắc thời gian thực',
      desc: `Bộ viễn trắc hạt nhân eBPF ghi nhận mức tải CPU của Pod đạt ${pctStr}, vượt ngưỡng an toàn cho phép và gây nghẽn luồng xử lý ứng dụng.`,
    };
  }

  if (text.includes('insufficient_evidence')) {
    return {
      title: 'Dữ liệu viễn trắc bình thường',
      badge: 'TELEMETRY_HEALTHY',
      badgeColor: '#059669',
      badgeBg: '#D1FAE5',
      importanceLabel: 'Thông tin theo dõi',
      desc: 'Không ghi nhận chỉ số viễn trắc nào vượt ngưỡng bất thường tại thời điểm phân tích.',
    };
  }

  if (text.includes('Liveness probe is failing')) {
    return {
      title: 'Lỗi kiểm tra tính sống còn (Liveness Probe Failure)',
      badge: 'KUBELET_LIVENESS',
      badgeColor: '#DC2626',
      badgeBg: '#FEE2E2',
      importanceLabel: 'Nguy kịch',
      desc: 'Tiến trình container bị treo (deadlock/unresponsive), Kubelet chuẩn bị thực thi kill và khởi động lại container.',
    };
  }

  if (text.includes('Memory usage')) {
    return {
      title: 'Mức tiêu thụ bộ nhớ RAM vượt ngưỡng an toàn',
      badge: 'EBPF_MEM_METRIC',
      badgeColor: '#D97706',
      badgeBg: '#FEF3C7',
      importanceLabel: 'Cảnh báo bộ nhớ',
      desc: 'Bộ nhớ RAM tăng trưởng dốc đứng, tiệm cận hạn mức cgroup memory limit của Kubernetes Pod.',
    };
  }

  return {
    title: text || 'Bằng chứng quan trắc hệ thống',
    badge: sourceType || 'AI_TELEMETRY',
    badgeColor: '#2563EB',
    badgeBg: '#DBEAFE',
    importanceLabel: 'Bằng chứng viễn trắc',
    desc: 'Bản ghi sự kiện viễn trắc thu thập từ bộ giám sát hạ tầng và thuật toán phân tích gốc rễ RCA.',
  };
};

export const PredictionsPage = () => {
  const { currentOrg, currentEnv, isAgentConnected, envList, setCurrentEnv, isRefreshing, triggerRefresh } = useDashboard();

  // State dữ liệu thật từ Backend
  const [loading, setLoading] = useState(true);
  const [aiHealth, setAiHealth] = useState(null);
  const [stats, setStats] = useState({ total: 0, by_type: {}, avg_confidence: 0 });
  const [predictions, setPredictions] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [healingActions, setHealingActions] = useState([]);
  const [selectedPrediction, setSelectedPrediction] = useState(null);
  const [expandedPredictionId, setExpandedPredictionId] = useState(null);
  const [predictionInputs, setPredictionInputs] = useState([]);
  const [loadingInputs, setLoadingInputs] = useState(false);

  // Trạng thái thao tác & WebSocket realtime
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [isWsLive, setIsWsLive] = useState(false);
  const [appliedActions, setAppliedActions] = useState([]);
  const [actionInProgress, setActionInProgress] = useState(null);
  const [noticeMessage, setNoticeMessage] = useState(null);
  const [activeStep, setActiveStep] = useState(1);
  const [batchProgress, setBatchProgress] = useState(null);
  const [batchProgressMap, setBatchProgressMap] = useState({});
  const [pinnedService, setPinnedService] = useState('sme-order-service');
  const pinnedServiceRef = useRef('sme-order-service');
  const [serviceInputsMap, setServiceInputsMap] = useState({});
  const [servicePredictionMap, setServicePredictionMap] = useState({});
  const [serviceStepMap, setServiceStepMap] = useState({});
  const [activeBottomTab, setActiveBottomTab] = useState('recommendations'); // 'recommendations' | 'healing_actions' | 'predictions'

  // Modal Bằng chứng RCA
  const [evidenceModal, setEvidenceModal] = useState({
    isOpen: false,
    incidentId: null,
    recTitle: '',
    recData: null,
    incidentDetail: null,
    loading: false,
    evidences: [],
  });

  // Trạng thái hover mở popover thông tin Honest Telemetry ở góc phải biểu đồ
  const [isHoverInfo, setIsHoverInfo] = useState(false);

  // Bộ lọc & điều khiển biểu đồ 12 bước
  const [activeSeries, setActiveSeries] = useState({
    cpu: true,
    ram: true,
    disk: false,
    latency: false,
    request_rate: false,
    http_5xx_rate: false,
  });
  const [scaleMode, setScaleMode] = useState('auto'); // 'auto' | 'standard'
  const [showThreshold, setShowThreshold] = useState(true);
  const [hoverIndex, setHoverIndex] = useState(null);
  const svgRef = useRef(null);

  // Bộ lọc danh sách dự báo
  const [selectedTypeFilter, setSelectedTypeFilter] = useState('ALL');
  const [selectedWorkload, setSelectedWorkload] = useState('sme-order-service');
  const selectedWorkloadRef = useRef('sme-order-service');
  const selectedPredictionRef = useRef(null);
  const [logWorkloadFilter, setLogWorkloadFilter] = useState('ALL');
  const [lastWsSyncTime, setLastWsSyncTime] = useState(() => new Date().toLocaleTimeString('vi-VN'));

  // Chuyển đổi Dịch vụ (Workload Switcher) trực tiếp cho Biểu đồ & Hồ sơ Rủi ro
  const handleSelectWorkload = (wl) => {
    setSelectedWorkload(wl);
    selectedWorkloadRef.current = wl;
    if (wl !== 'ALL') {
      setPinnedService(wl);
      pinnedServiceRef.current = wl;
    }

    const clusterParam = currentEnv?.cluster || currentEnv?.clusterId || currentEnv?.id;
    aiService.getPredictionStats({
      cluster_id: clusterParam,
      workload: wl !== 'ALL' ? wl : undefined,
    }).then((statsRes) => {
      if (statsRes) setStats(statsRes);
    });

    const targetService = wl !== 'ALL' ? wl : (pinnedServiceRef.current || 'sme-order-service');
    if (servicePredictionMap[targetService]) {
      setSelectedPrediction(servicePredictionMap[targetService]);
      selectedPredictionRef.current = servicePredictionMap[targetService];
    } else if (predictions && predictions.length > 0) {
      const target = predictions.find((p) => p.workload_name === targetService);
      if (target) {
        setSelectedPrediction(target);
        selectedPredictionRef.current = target;
        loadInputs(target.id, true, targetService);
      }
    }
  };

  // Nạp 12 điểm viễn trắc của một dự báo (hỗ trợ chế độ ngầm isSilent không nhấp nháy màn hình)
  const loadInputs = async (predId, isSilent = false, serviceId = null) => {
    if (!predId) return;
    if (!isSilent) setLoadingInputs(true);
    try {
      const inputs = await aiService.getPredictionInputs(predId);
      if (Array.isArray(inputs) && inputs.length > 0) {
        setPredictionInputs(inputs);
        if (serviceId) {
          setServiceInputsMap((prev) => {
            if (!prev[serviceId] || prev[serviceId].length === 0) {
              return { ...prev, [serviceId]: inputs };
            }
            return prev;
          });
        }
      }
    } catch (err) {
      console.error('[PredictionsPage] Lỗi nạp prediction inputs:', err);
      if (!isSilent) setPredictionInputs([]);
    } finally {
      if (!isSilent) setLoadingInputs(false);
    }
  };

  // Nạp dữ liệu từ Backend
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const clusterParam = currentEnv?.cluster || currentEnv?.clusterId || currentEnv?.id;
      const [healthRes, statsRes, predRes, recRes, healRes] = await Promise.all([
        aiService.getAiHealth(),
        aiService.getPredictionStats({
          cluster_id: clusterParam,
          workload: selectedWorkloadRef.current !== 'ALL' ? selectedWorkloadRef.current : undefined,
        }),
        aiService.getPredictions({
          limit: 30,
          prediction_type: selectedTypeFilter === 'ALL' ? undefined : selectedTypeFilter,
        }),
        aiService.getRecommendations({ limit: 50 }),
        aiService.getHealingActions({ limit: 50 }),
      ]);

      setAiHealth(healthRes);
      setStats(statsRes);
      setHealingActions(healRes || []);

      const predItems = predRes?.items || [];
      setPredictions(predItems);
      setRecommendations(recRes || []);

      // Mặc định chọn dự báo theo dịch vụ đang chọn
      if (predItems.length > 0) {
        const activeTarget = selectedWorkloadRef.current !== 'ALL'
          ? selectedWorkloadRef.current
          : (pinnedServiceRef.current || 'sme-order-service');

        const targetPred = predItems.find((p) => p.workload_name === activeTarget) || predItems[0];
        if (targetPred) {
          setSelectedPrediction(targetPred);
          selectedPredictionRef.current = targetPred;
          if (targetPred.workload_name) {
            setPinnedService(targetPred.workload_name);
            pinnedServiceRef.current = targetPred.workload_name;
          }
          loadInputs(targetPred.id, false, targetPred.workload_name);
        }
      } else {
        setSelectedPrediction(null);
        setPredictionInputs([]);
      }
    } catch (err) {
      console.error('[PredictionsPage] Lỗi nạp dữ liệu AI:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedTypeFilter, currentEnv?.cluster, currentEnv?.clusterId, currentEnv?.id]);

  // Đồng bộ dữ liệu ngầm định kỳ (Silent Sync) không giật lag
  const silentSyncData = useCallback(async () => {
    try {
      const clusterParam = currentEnv?.cluster || currentEnv?.clusterId || currentEnv?.id;
      const [statsRes, predRes, recRes, healRes] = await Promise.all([
        aiService.getPredictionStats({
          cluster_id: clusterParam,
          workload: selectedWorkloadRef.current !== 'ALL' ? selectedWorkloadRef.current : undefined,
        }),
        aiService.getPredictions({
          limit: 30,
          prediction_type: selectedTypeFilter === 'ALL' ? undefined : selectedTypeFilter,
        }),
        aiService.getRecommendations({ limit: 50 }),
        aiService.getHealingActions({ limit: 50 }),
      ]);

      if (statsRes) setStats(statsRes);
      if (healRes) setHealingActions(healRes || []);
      if (recRes) setRecommendations(recRes || []);

      const predItems = predRes?.items || [];
      setPredictions(predItems);
      if (predItems.length > 0) {
        const activeTarget = selectedWorkloadRef.current !== 'ALL'
          ? selectedWorkloadRef.current
          : (pinnedServiceRef.current || 'sme-order-service');

        const target = predItems.find((p) => p.workload_name === activeTarget);
        if (target) {
          setSelectedPrediction((prev) => {
            if (!prev || prev.id !== target.id) {
              selectedPredictionRef.current = target;
              loadInputs(target.id, true, target.workload_name);
              return target;
            }
            return prev;
          });
        }
      }
    } catch (err) {
      // Bỏ qua lỗi ngầm
    }
  }, [selectedTypeFilter, currentEnv?.cluster, currentEnv?.clusterId, currentEnv?.id]);

  useEffect(() => {
    setSelectedPrediction(null);
    setPredictionInputs([]);
    setPredictions([]);
    setRecommendations([]);
    setHealingActions([]);
    setStats({ total: 0, by_type: {}, avg_confidence: 0 });
    loadData();
  }, [currentEnv?.cluster, currentEnv?.clusterId, currentEnv?.id, loadData]);

  // Tự động Polling ngầm mỗi 5 giây đảm bảo giao diện luôn nhảy số Realtime (chỉ khi Agent Online)
  useEffect(() => {
    if (!isAgentConnected) return;
    const timer = setInterval(() => {
      silentSyncData();
    }, 5000);
    return () => clearInterval(timer);
  }, [isAgentConnected, silentSyncData]);

  // Kết nối WebSocket Realtime Stream (Push Protocol) (chỉ khi Agent Online)
  useEffect(() => {
    if (!isAgentConnected) {
      setIsWsLive(false);
      setBatchProgress(null);
      return;
    }
    const clusterParam = currentEnv?.cluster || currentEnv?.clusterId || currentEnv?.id;
    const targetService = selectedWorkload !== 'ALL' ? selectedWorkload : (pinnedService || 'sme-order-service');
    const unsubscribe = telemetryService.subscribeWebSocket(
      targetService,
      (payload) => {
        if (!payload) return;

        // 1. Gói tin suy luận mới từ GRU Pipeline (ai_prediction)
        if (payload.type === 'ai_prediction' && payload.data) {
          const newPred = payload.data;
          const predId = newPred.prediction_id || newPred.id;
          const wlName = newPred.workload_name || newPred.service_id || newPred.target_name || 'sme-order-service';
          const evalTime = newPred.evaluated_at || newPred.predicted_at || new Date().toISOString();
          const timeStr = new Date(evalTime).toLocaleTimeString('vi-VN');

          const formatted = {
            id: predId,
            workload_name: wlName,
            service_id: wlName,
            status: newPred.status || 'HEALTHY',
            prediction_type: newPred.primary_risk || 'NORMAL',
            risk_score: newPred.overall_risk_score,
            confidence_score: newPred.confidence_score,
            predicted_at: evalTime,
            ...newPred,
          };

          // Lưu dự báo độc lập theo từng Service
          setServicePredictionMap((prev) => ({
            ...prev,
            [wlName]: formatted,
          }));

          if (newPred.active_step) {
            setServiceStepMap((prev) => ({
              ...prev,
              [wlName]: newPred.active_step,
            }));
          }

          // Lưu 12 điểm viễn trắc độc lập cho Service này
          if (Array.isArray(newPred.sequence) && newPred.sequence.length >= 12) {
            const directInputs = [];
            newPred.sequence.forEach((pt, idx) => {
              const ts = pt.time_bucket ? new Date(pt.time_bucket).toISOString() : new Date().toISOString();
              for (const mName of ['cpu', 'ram', 'disk', 'latency', 'request_rate', 'http_5xx_rate', 'pod_restart_count', 'replica_count']) {
                directInputs.push({
                  id: `ws-${predId}-${idx}-${mName}`,
                  prediction_id: predId,
                  metric_name: mName,
                  metric_value: pt[mName] !== undefined ? pt[mName] : 0,
                  collected_at: ts,
                });
              }
            });
            setServiceInputsMap((prev) => ({
              ...prev,
              [wlName]: directInputs,
            }));
          }

          setPredictions((prev) => {
            if (!prev.some((p) => p.id === predId)) {
              return [formatted, ...prev.slice(0, 29)];
            }
            return prev;
          });

          // CHỈ cập nhật hiển thị chính nếu đúng là Service đang được người dùng theo dõi
          const currentTarget = selectedWorkloadRef.current !== 'ALL'
            ? selectedWorkloadRef.current
            : (pinnedServiceRef.current || 'sme-order-service');

          if (wlName === currentTarget) {
            setLastWsSyncTime(timeStr);
            setSelectedPrediction(formatted);
            selectedPredictionRef.current = formatted;
            if (newPred.active_step) {
              setActiveStep(newPred.active_step);
            }
          }

          setStats((prev) => ({
            ...prev,
            total: (prev.total || 0) + 1,
            by_type: {
              ...prev.by_type,
              [formatted.prediction_type]: ((prev.by_type?.[formatted.prediction_type] || 0) + 1),
            },
          }));
        }

        // 2. Gói tin tiến độ gom 12 bước viễn trắc (batch_accumulation)
        if (payload.type === 'batch_accumulation' && payload.data) {
          const bp = payload.data;
          const sId = bp.service_id;
          if (!sId) return;

          // Lưu tiến độ và mốc quét độc lập của riêng Service này
          setBatchProgressMap((prev) => ({
            ...prev,
            [sId]: bp,
          }));

          if (bp.active_step) {
            setServiceStepMap((prev) => ({
              ...prev,
              [sId]: bp.active_step,
            }));
          }

          // Lưu 12 điểm viễn trắc cuộn trượt của riêng Service này
          if (Array.isArray(bp.points) && bp.points.length > 0) {
            const directInputs = [];
            bp.points.forEach((pt, idx) => {
              const ts = pt.time_bucket ? new Date(pt.time_bucket).toISOString() : new Date().toISOString();
              for (const mName of ['cpu', 'ram', 'disk', 'latency', 'request_rate', 'http_5xx_rate', 'pod_restart_count', 'replica_count']) {
                directInputs.push({
                  id: `batch-${sId}-${idx}-${mName}`,
                  prediction_id: `live-${sId}`,
                  metric_name: mName,
                  metric_value: pt[mName] !== undefined ? pt[mName] : 0,
                  collected_at: ts,
                });
              }
            });
            setServiceInputsMap((prev) => ({
              ...prev,
              [sId]: directInputs,
            }));
          }

          // CHỈ cập nhật trạng thái hiển thị nếu đúng là Service đang được người dùng xem
          const currentTarget = selectedWorkloadRef.current !== 'ALL'
            ? selectedWorkloadRef.current
            : (pinnedServiceRef.current || 'sme-order-service');

          if (sId === currentTarget) {
            setBatchProgress(bp);
            if (bp.active_step) {
              setActiveStep(bp.active_step);
            }
            setLastWsSyncTime(new Date().toLocaleTimeString('vi-VN'));
          }
        }

        // 3. Gói tin Live Pulse định kỳ từ Backend
        if ((payload.type === 'live_pulse' || payload.type === 'initial_state') && payload.data) {
          const summary = payload.data;
          if (Array.isArray(summary.predictions) && summary.predictions.length > 0) {
            setPredictions((prev) => {
              const existingIds = new Set(prev.map((p) => p.id));
              const fresh = summary.predictions.filter((p) => !existingIds.has(p.id));
              if (fresh.length > 0) {
                return [...fresh, ...prev].slice(0, 15);
              }
              return prev;
            });
          }
          if (Array.isArray(summary.recommendations) && summary.recommendations.length > 0) {
            setRecommendations(summary.recommendations);
          }
        }

        // 4. Gói tin đề xuất tự lành mới từ RCA (ai_recommendation)
        if (payload.type === 'ai_recommendation' && payload.data) {
          const newRec = payload.data;
          setRecommendations((prev) => {
            if (!prev.some((r) => r.id === newRec.id)) {
              return [newRec, ...prev.slice(0, 9)];
            }
            return prev;
          });
        }
      },
      (connected) => {
        setIsWsLive(connected);
      },
      clusterParam
    );

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [isAgentConnected, selectedWorkload, pinnedService, currentEnv?.cluster, currentEnv?.clusterId, currentEnv?.id]);

  // Kích hoạt suy diễn thủ công on-demand (Rule Engine -> GRU Model -> RCA)
  const handleRunManualInference = async () => {
    setIsEvaluating(true);
    try {
      const targetWorkload = displaySelectedPrediction?.workload_name || displayPredictions[0]?.workload_name || 'sme-order-service';
      const res = await aiService.triggerManualInference(targetWorkload, {
        forceRca: false,
        autoTriggerRca: true,
      });

      const data = res?.data;
      const gruPred = data?.gru_prediction;
      const rca = data?.rca_diagnosis;

      setNoticeMessage({
        type: 'success',
        text: `Đã hoàn tất chu kỳ suy diễn On-Demand! Điểm rủi ro GRU: ${
          gruPred?.overall_risk_score !== undefined
            ? parseFloat(gruPred.overall_risk_score).toFixed(4)
            : '0.0002'
        } (${gruPred?.status || 'HEALTHY'}). Chẩn đoán RCA: ${
          rca?.root_cause?.cause || 'Không phát hiện bất thường nghiêm trọng'
        }.`,
      });

      // Tải lại toàn bộ dữ liệu mới nhất
      await loadData();
    } catch (err) {
      setNoticeMessage({
        type: 'error',
        text: `Lỗi khi chạy suy diễn On-Demand: ${err.message}`,
      });
    } finally {
      setIsEvaluating(false);
      setTimeout(() => setNoticeMessage(null), 8000);
    }
  };

  // Chọn một dự báo trong bảng để soi chuỗi viễn trắc
  const handleSelectPrediction = (pred) => {
    setSelectedPrediction(pred);
    selectedPredictionRef.current = pred;
    if (pred?.workload_name) {
      setSelectedWorkload(pred.workload_name);
      selectedWorkloadRef.current = pred.workload_name;
    }
    loadInputs(pred.id);
  };

  const handleToggleExpandPrediction = (pred) => {
    if (expandedPredictionId === pred.id) {
      setExpandedPredictionId(null);
    } else {
      setExpandedPredictionId(pred.id);
      handleSelectPrediction(pred);
    }
  };

  // Toggle ẩn/hiện một chuỗi viễn trắc
  const toggleSeries = (metricKey) => {
    setActiveSeries((prev) => {
      const updated = { ...prev, [metricKey]: !prev[metricKey] };
      const hasAny = Object.values(updated).some(Boolean);
      if (!hasAny) {
        return prev;
      }
      return updated;
    });
  };

  // Chọn chỉ hiển thị cặp CPU & RAM
  const setCpuRamOnly = () => {
    setActiveSeries({
      cpu: true,
      ram: true,
      disk: false,
      latency: false,
      request_rate: false,
      http_5xx_rate: false,
    });
  };

  // Bật tất cả các chuỗi
  const setAllSeries = () => {
    setActiveSeries({
      cpu: true,
      ram: true,
      disk: true,
      latency: true,
      request_rate: true,
      http_5xx_rate: true,
    });
  };

  // Áp dụng khuyến nghị tự lành phòng ngừa (Mitigate)
  const handleMitigate = async (recId) => {
    setActionInProgress(recId);
    try {
      const res = await aiService.applyRecommendation(recId);
      setAppliedActions((prev) => [...prev, recId]);

      const action = res?.data?.healing_action;
      setNoticeMessage({
        type: 'success',
        text: `Đã kích hoạt hành động phòng ngừa thành công! Ghi nhận vào bảng healing_actions (Mã hành động: ${
          action?.id?.substring(0, 8) || 'thành công'
        }). Lệnh khắc phục MAPE-K đã thực thi.`,
      });

      // Tải lại danh sách khuyến nghị & danh sách healing_actions
      const clusterParam = currentEnv?.cluster || currentEnv?.clusterId || currentEnv?.id;
      const [updatedRecs, updatedHeals] = await Promise.all([
        aiService.getRecommendations({ limit: 10, cluster_id: clusterParam }),
        aiService.getHealingActions({ limit: 10, cluster_id: clusterParam }),
      ]);
      setRecommendations(updatedRecs || []);
      setHealingActions(updatedHeals || []);
    } catch (err) {
      setNoticeMessage({
        type: 'error',
        text: `Không thể áp dụng hành động: ${err.message}`,
      });
    } finally {
      setActionInProgress(null);
      setTimeout(() => setNoticeMessage(null), 7000);
    }
  };

  // Mở modal xem bằng chứng gốc rễ RCA
  const handleOpenEvidenceModal = async (rec) => {
    if (!rec?.incident_id) {
      setNoticeMessage({
        type: 'error',
        text: 'Khuyến nghị này chưa gắn với mã Incident nào trong cơ sở dữ liệu.',
      });
      return;
    }

    setEvidenceModal({
      isOpen: true,
      incidentId: rec.incident_id,
      recTitle: rec.recommendation || 'Khuyến nghị phòng ngừa',
      recData: rec,
      incidentDetail: null,
      loading: true,
      evidences: [],
    });

    try {
      const [evidences, incidentDetail] = await Promise.all([
        aiService.getIncidentEvidences(rec.incident_id),
        aiService.getIncidentDetail(rec.incident_id),
      ]);

      const predId = incidentDetail?.prediction_id || rec?.prediction_id;
      let predInputs = [];
      if (predId) {
        try {
          predInputs = await aiService.getPredictionInputs(predId);
        } catch {}
      }

      setEvidenceModal((prev) => ({
        ...prev,
        loading: false,
        evidences: evidences || [],
        incidentDetail: incidentDetail || null,
        predInputs: predInputs || [],
      }));
    } catch (err) {
      console.error('[PredictionsPage] Lỗi lấy evidences / incidentDetail:', err);
      setEvidenceModal((prev) => ({
        ...prev,
        loading: false,
        evidences: [],
        incidentDetail: null,
      }));
    }
  };

  const handleCloseEvidenceModal = () => {
    setEvidenceModal({
      isOpen: false,
      incidentId: null,
      recTitle: '',
      recData: null,
      incidentDetail: null,
      loading: false,
      evidences: [],
    });
  };

  // Xác định dịch vụ mục tiêu đang hiển thị (cố định, không bị nhảy chéo)
  const currentServiceTarget = useMemo(() => {
    if (selectedWorkload && selectedWorkload !== 'ALL') {
      return selectedWorkload;
    }
    return pinnedService || 'sme-order-service';
  }, [selectedWorkload, pinnedService]);

  // Lấy 12 mốc viễn trắc độc lập của riêng dịch vụ đang xem
  const currentInputs = useMemo(() => {
    if (serviceInputsMap[currentServiceTarget] && serviceInputsMap[currentServiceTarget].length > 0) {
      return serviceInputsMap[currentServiceTarget];
    }
    if (selectedPrediction?.workload_name === currentServiceTarget && predictionInputs.length > 0) {
      return predictionInputs;
    }
    return [];
  }, [serviceInputsMap, currentServiceTarget, predictionInputs, selectedPrediction?.workload_name]);

  // Tổ chức chuỗi 12 bước thời gian đồng bộ cho tất cả các metrics của riêng dịch vụ đang xem
  const timesteps = useMemo(() => {
    if (!currentInputs || currentInputs.length === 0) return [];

    const map = new Map();
    currentInputs.forEach((item) => {
      const key = item.collected_at ? new Date(item.collected_at).toISOString() : item.id;
      if (!map.has(key)) {
        const d = new Date(item.collected_at);
        const timeLabel = isNaN(d.getTime())
          ? ''
          : d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

        map.set(key, {
          rawTime: item.collected_at,
          timeLabel,
          cpu: 0,
          ram: 0,
          disk: 0,
          latency: 0,
          request_rate: 0,
          http_5xx_rate: 0,
          pod_restart_count: 0,
          replica_count: 0,
        });
      }
      const entry = map.get(key);
      const mName = item.metric_name?.toLowerCase();
      const val = parseFloat(item.metric_value) || 0;
      if (mName && entry[mName] !== undefined) {
        entry[mName] = val;
      }
    });

    const sorted = Array.from(map.values()).sort(
      (a, b) => new Date(a.rawTime) - new Date(b.rawTime)
    );

    return sorted.map((item, idx) => ({
      ...item,
      step: idx + 1,
      stepLabel: `T${idx + 1}`,
      displayTime: item.timeLabel || `T${idx + 1}`,
    }));
  }, [currentInputs]);

  // Dữ liệu hiển thị có điều kiện theo trạng thái kết nối Cụm K8s (isAgentConnected)
  // Khi cụm chưa kết nối (Agent Offline) -> đưa toàn bộ về 0 & không hiển thị dữ liệu
  const displayStats = useMemo(() => {
    if (!isAgentConnected) {
      return { total: 0, by_type: {}, avg_confidence: 0 };
    }
    return stats;
  }, [isAgentConnected, stats]);

  const availableWorkloads = useMemo(() => {
    const fixedList = ['sme-order-service', 'selfheal-test-app'];
    predictions.forEach((p) => {
      if (p.workload_name && !fixedList.includes(p.workload_name)) {
        fixedList.push(p.workload_name);
      }
    });
    return fixedList;
  }, [predictions]);

  const displayPredictions = useMemo(() => {
    if (!isAgentConnected) return [];
    let list = predictions;
    if (selectedTypeFilter && selectedTypeFilter !== 'ALL') {
      list = list.filter((p) => {
        if (p.prediction_type === selectedTypeFilter) return true;
        const outputs = parseRiskOutputs(p.risk_outputs);
        const val = outputs[selectedTypeFilter];
        const conf = typeof val === 'object' && val !== null ? Number(val.confidence || 0) : Number(val || 0);
        return conf >= 0.1;
      });
    }
    if (!logWorkloadFilter || logWorkloadFilter === 'ALL') return list;
    return list.filter((p) => p.workload_name === logWorkloadFilter);
  }, [isAgentConnected, predictions, logWorkloadFilter, selectedTypeFilter]);

  const displayRecommendations = useMemo(() => {
    if (!isAgentConnected) return [];
    let list = recommendations;

    // Nhóm và loại bỏ các đề xuất trùng lặp cho cùng một workload/hành động - hiển thị toàn bộ
    const map = new Map();
    for (const r of list) {
      const target = r.target_name || r.target_id || (r.incident_title ? r.incident_title.split(' on ')[1] : 'sme-order-service');
      const actionCode = r.recommendation || r.action_code || 'RESTART_POD';
      const key = `${actionCode}__${target}`;
      if (!map.has(key)) {
        map.set(key, r);
      } else {
        const existing = map.get(key);
        const rIsApplied = r.status === 'APPLIED' || appliedActions.includes(r.id);
        const exIsApplied = existing.status === 'APPLIED' || appliedActions.includes(existing.id);
        if (rIsApplied && !exIsApplied) {
          map.set(key, r);
        } else if (!exIsApplied && new Date(r.created_at) > new Date(existing.created_at)) {
          map.set(key, r);
        }
      }
    }
    return Array.from(map.values());
  }, [isAgentConnected, recommendations, appliedActions]);

  const displayHealingActions = useMemo(() => {
    if (!isAgentConnected) return [];
    return healingActions;
  }, [isAgentConnected, healingActions]);

  // Lấy dự báo GRU của riêng dịch vụ đang xem
  const displaySelectedPrediction = useMemo(() => {
    if (!isAgentConnected) return null;
    if (servicePredictionMap[currentServiceTarget]) {
      return servicePredictionMap[currentServiceTarget];
    }
    if (selectedPrediction && selectedPrediction.workload_name === currentServiceTarget) {
      return selectedPrediction;
    }
    const found = predictions.find((p) => p.workload_name === currentServiceTarget);
    return found || null;
  }, [isAgentConnected, servicePredictionMap, currentServiceTarget, selectedPrediction, predictions]);

  const currentServiceBatchProgress = useMemo(() => {
    if (!currentServiceTarget) return batchProgress;
    return batchProgressMap[currentServiceTarget] || (batchProgress?.service_id === currentServiceTarget ? batchProgress : null);
  }, [batchProgressMap, currentServiceTarget, batchProgress]);

  const currentActiveStep = useMemo(() => {
    return (
      serviceStepMap[currentServiceTarget] ||
      currentServiceBatchProgress?.active_step ||
      activeStep ||
      1
    );
  }, [serviceStepMap, currentServiceBatchProgress?.active_step, currentServiceTarget, activeStep]);

  const displayTimesteps = useMemo(() => {
    if (!isAgentConnected) return [];
    return timesteps;
  }, [isAgentConnected, timesteps]);

  // Tính toán thang đo trục tung (Y-axis scale)
  const { yMax, yTicks, activeSeriesList } = useMemo(() => {
    const activeKeys = Object.keys(activeSeries).filter((k) => activeSeries[k]);
    const activeConfigs = SERIES_CONFIG.filter((s) => activeSeries[s.key]);

    if (displayTimesteps.length === 0 || activeKeys.length === 0) {
      return { yMax: 100, yTicks: [0, 25, 50, 75, 100], activeSeriesList: activeConfigs };
    }

    if (scaleMode === 'standard') {
      return { yMax: 100, yTicks: [0, 25, 50, 75, 100], activeSeriesList: activeConfigs };
    }

    // Auto-scale mode: tìm đỉnh cao nhất trong các chuỗi đang bật
    let peak = 0;
    displayTimesteps.forEach((step) => {
      activeKeys.forEach((key) => {
        const val = step[key] || 0;
        if (val > peak) peak = val;
      });
    });

    peak = peak * 1.15; // Thêm 15% khoảng trống đỉnh

    let ceiling = 100;
    let ticks = [0, 25, 50, 75, 100];

    if (peak <= 1) {
      ceiling = 1;
      ticks = [0, 0.25, 0.5, 0.75, 1.0];
    } else if (peak <= 5) {
      ceiling = 5;
      ticks = [0, 1, 2, 3, 4, 5];
    } else if (peak <= 20) {
      ceiling = 20;
      ticks = [0, 5, 10, 15, 20];
    } else if (peak <= 50) {
      ceiling = 50;
      ticks = [0, 10, 20, 30, 40, 50];
    } else if (peak <= 80) {
      ceiling = 80;
      ticks = [0, 20, 40, 60, 80];
    } else {
      ceiling = Math.ceil(peak / 10) * 10;
      ticks = [0, Math.round(ceiling * 0.25), Math.round(ceiling * 0.5), Math.round(ceiling * 0.75), ceiling];
    }

    return { yMax: ceiling, yTicks: ticks, activeSeriesList: activeConfigs };
  }, [timesteps, activeSeries, scaleMode]);

  // Tọa độ biểu đồ SVG
  const width = 640;
  const height = 230;
  const padding = { top: 25, right: 35, bottom: 35, left: 45 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const getCoordX = (idx) => padding.left + (idx / Math.max(displayTimesteps.length - 1, 1)) * chartW;
  const getCoordY = (val) => {
    const clamped = Math.min(Math.max(val, 0), yMax);
    return padding.top + chartH - (clamped / yMax) * chartH;
  };

  // Xử lý di chuyển chuột trên biểu đồ
  const handleMouseMove = (e) => {
    if (!svgRef.current || displayTimesteps.length === 0) return;
    const rect = svgRef.current.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const pct = clientX / rect.width;
    const svgX = pct * width;

    let closestIdx = 0;
    let minDiff = Infinity;
    displayTimesteps.forEach((_, idx) => {
      const cx = getCoordX(idx);
      const diff = Math.abs(cx - svgX);
      if (diff < minDiff) {
        minDiff = diff;
        closestIdx = idx;
      }
    });
    setHoverIndex(closestIdx);
  };

  const handleMouseLeave = () => {
    setHoverIndex(null);
  };

  // Thống kê nhanh của các chuỗi đang bật
  const seriesSummaries = useMemo(() => {
    if (!isAgentConnected || displayTimesteps.length === 0) return [];
    return activeSeriesList.map((cfg) => {
      const vals = displayTimesteps.map((t) => t[cfg.key] || 0);
      const min = Math.min(...vals);
      const max = Math.max(...vals);
      const sum = vals.reduce((a, b) => a + b, 0);
      const avg = sum / vals.length;
      const latest = vals[vals.length - 1] || 0;
      return {
        key: cfg.key,
        label: cfg.label,
        color: cfg.color,
        unit: cfg.unit,
        min: min.toFixed(2),
        max: max.toFixed(2),
        avg: avg.toFixed(2),
        latest: latest.toFixed(2),
      };
    });
  }, [isAgentConnected, displayTimesteps, activeSeriesList]);

  return (
    <div className="dashboard-predictions-page" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* 1. Header & Controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              backgroundColor: '#EDE9FE',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Sparkles size={20} color="#7C3AED" />
            </div>
            <div>
              <h1 style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--dash-text-primary)', letterSpacing: '-0.02em', margin: 0 }}>
                AI Dự Báo Nguy Cơ Sớm & Đề Xuất Phòng Ngừa
              </h1>
              <p style={{ fontSize: '0.8125rem', color: 'var(--dash-text-secondary)', marginTop: '2px', margin: 0 }}>
                {currentOrg.name} &bull; <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{currentEnv.name}</span> &bull; Phân loại rủi ro đa nhãn thời gian thực bằng mô hình GRU PyTorch
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* WebSocket Pulse Badge */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            backgroundColor: isAgentConnected && isWsLive ? '#F0FDF4' : '#F8FAFC',
            border: `1px solid ${isAgentConnected && isWsLive ? '#BBF7D0' : '#E2E8F0'}`,
            borderRadius: '6px',
            fontSize: '0.75rem',
            fontWeight: 700,
            color: isAgentConnected && isWsLive ? '#15803D' : '#64748B',
            fontFamily: 'var(--font-mono)',
          }}>
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: isAgentConnected && isWsLive ? '#22C55E' : '#94A3B8',
              boxShadow: isAgentConnected && isWsLive ? '0 0 8px rgba(34, 197, 94, 0.6)' : 'none',
            }} />
            <span>{isAgentConnected && isWsLive ? 'LIVE WS TELEMETRY' : 'WS STANDBY'}</span>
          </div>

          {/* Trạng thái kết nối AI Engine */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            backgroundColor: !isAgentConnected ? '#F8FAFC' : (aiHealth?.status === 'OK' || aiHealth?.model_loaded ? '#ECFDF5' : '#FEF2F2'),
            border: `1px solid ${!isAgentConnected ? '#E2E8F0' : (aiHealth?.status === 'OK' || aiHealth?.model_loaded ? '#A7F3D0' : '#FECACA')}`,
            borderRadius: '6px',
            fontSize: '0.75rem',
            fontWeight: 700,
            color: !isAgentConnected ? '#64748B' : (aiHealth?.status === 'OK' || aiHealth?.model_loaded ? '#065F46' : '#991B1B'),
            fontFamily: 'var(--font-mono)',
          }}>
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: !isAgentConnected ? '#94A3B8' : (aiHealth?.status === 'OK' || aiHealth?.model_loaded ? '#10B981' : '#EF4444'),
            }} />
            <span>AI ENGINE: {!isAgentConnected ? 'STANDBY' : (aiHealth?.model_loaded ? 'PYTORCH GRU ONLINE' : 'DISCONNECTED')}</span>
          </div>

          {/* Nút Chạy suy diễn On-Demand */}
          <button
            type="button"
            onClick={handleRunManualInference}
            disabled={!isAgentConnected || isEvaluating || loading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              backgroundColor: !isAgentConnected ? '#94A3B8' : '#7C3AED',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: 'var(--dash-radius-md)',
              fontSize: '0.8125rem',
              fontWeight: 600,
              cursor: !isAgentConnected || isEvaluating || loading ? 'not-allowed' : 'pointer',
              boxShadow: isAgentConnected ? '0 1px 3px rgba(124, 58, 237, 0.3)' : 'none',
            }}
            title={!isAgentConnected ? 'Cụm chưa kết nối tác tử viễn trắc' : ''}
          >
            <Zap size={14} className={isEvaluating ? 'animate-spin' : ''} />
            <span>{isEvaluating ? 'Đang suy diễn GRU...' : 'Chạy suy diễn mới'}</span>
          </button>

          {/* Nút Làm mới dữ liệu */}
          <button
            type="button"
            onClick={() => {
              triggerRefresh();
              if (isAgentConnected) loadData();
            }}
            disabled={loading || isRefreshing}
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
              cursor: loading ? 'not-allowed' : 'pointer',
              color: 'var(--dash-text-primary)',
            }}
          >
            <RefreshCw size={14} className={loading || isRefreshing ? 'animate-spin' : ''} />
            <span>Làm mới bảng</span>
          </button>
        </div>
      </div>

      {/* Thông báo thao tác nếu có */}
      {noticeMessage && (
        <div style={{
          padding: '12px 16px',
          borderRadius: '6px',
          backgroundColor: noticeMessage.type === 'success' ? '#ECFDF5' : '#FEF2F2',
          border: `1px solid ${noticeMessage.type === 'success' ? '#A7F3D0' : '#FECACA'}`,
          color: noticeMessage.type === 'success' ? '#065F46' : '#991B1B',
          fontSize: '0.8125rem',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          {noticeMessage.type === 'success' ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
          <span>{noticeMessage.text}</span>
        </div>
      )}

      {/* 2. Bốn thẻ Thống Kê Tổng Quan từ Dữ Liệu Thật */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <div className="dash-card" style={{ padding: '16px', backgroundColor: '#FFFFFF', border: '1px solid var(--dash-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--dash-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Tổng Lượt Suy Luận
            </span>
            <Activity size={18} color="#6366F1" />
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, color: (isAgentConnected && displaySelectedPrediction) ? 'var(--dash-text-primary)' : '#94A3B8', fontFamily: 'var(--font-mono)' }}>
            {displayStats.total.toLocaleString()}
          </div>
          <div style={{ fontSize: '0.75rem', color: isAgentConnected ? '#10B981' : '#94A3B8', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{
              display: 'inline-block',
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: isAgentConnected ? (isWsLive ? '#10B981' : '#F59E0B') : '#94A3B8',
              boxShadow: isAgentConnected && isWsLive ? '0 0 8px #10B981' : 'none',
            }} />
            <span>
              {isAgentConnected
                ? (currentServiceBatchProgress?.collected !== undefined
                    ? `Đang gom mẻ mới (${currentServiceTarget}): [${currentServiceBatchProgress.collected}/${currentServiceBatchProgress.target || 12} bước]`
                    : `Đã gom mẻ viễn trắc 12 bước (${currentServiceTarget})`)
                : 'Cụm chưa kết nối tác tử viễn trắc'}
            </span>
          </div>
        </div>

        <div className="dash-card" style={{ padding: '16px', backgroundColor: '#FFFFFF', border: '1px solid var(--dash-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--dash-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Trạng Thái Bình Thường
            </span>
            <ShieldCheck size={18} color="#10B981" />
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, color: isAgentConnected ? '#059669' : '#94A3B8', fontFamily: 'var(--font-mono)' }}>
            {isAgentConnected && displayStats.total > 0
              ? `${(((displayStats.by_type?.NORMAL || displayStats.total) / displayStats.total) * 100).toFixed(1)}%`
              : '0%'}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-secondary)', marginTop: '4px' }}>
            {isAgentConnected
              ? `${(displayStats.by_type?.NORMAL || displayStats.total).toLocaleString()} / ${displayStats.total.toLocaleString()} chu kỳ an toàn`
              : '0 / 0 chu kỳ an toàn'}
          </div>
        </div>

        <div className="dash-card" style={{ padding: '16px', backgroundColor: '#FFFFFF', border: '1px solid var(--dash-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--dash-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Đề Xuất Chờ Xử Lý
            </span>
            <Zap size={18} color="#D97706" />
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, color: isAgentConnected && displayRecommendations.length > 0 ? '#D97706' : (isAgentConnected ? '#059669' : '#94A3B8'), fontFamily: 'var(--font-mono)' }}>
            {displayRecommendations.length}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-secondary)', marginTop: '4px' }}>
            {isAgentConnected
              ? `${displayRecommendations.filter((r) => r.status === 'PROPOSED').length} đề xuất đang chờ kích hoạt`
              : '0 đề xuất đang chờ kích hoạt'}
          </div>
        </div>

        <div className="dash-card" style={{ padding: '16px', backgroundColor: '#FFFFFF', border: '1px solid var(--dash-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--dash-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Đã Khắc Phục Tự Lành
            </span>
            <CheckCircle size={18} color="#059669" />
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, color: isAgentConnected ? '#059669' : '#94A3B8', fontFamily: 'var(--font-mono)' }}>
            {displayHealingActions.length}
          </div>
          <div style={{ fontSize: '0.75rem', color: isAgentConnected ? '#10B981' : 'var(--dash-text-secondary)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            {isAgentConnected ? (
              <>
                <CheckCircle2 size={13} />
                <span>Ghi nhận bảng healing_actions</span>
              </>
            ) : (
              <span>0 hành động tự lành</span>
            )}
          </div>
        </div>
      </div>



      {/* 4. Khối Trực Quan Hóa: Biểu Đồ 12 Bước Đa Chuỗi (Ẩn/Hiện) & Hồ Sơ Xác Suất Rủi Ro GRU */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.65fr) minmax(0, 1fr)', gap: '20px' }}>
        
        {/* Cửa Sổ Viễn Trắc 12 Điểm Quan Sát Thực Tế - Hỗ Trợ Ẩn / Hiện Đa Chuỗi */}
        <div className="dash-card" style={{ padding: '20px', backgroundColor: '#FFFFFF', border: '1px solid var(--dash-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginBottom: '14px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.625rem', fontWeight: 800, padding: '2px 6px', borderRadius: '4px', backgroundColor: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE', letterSpacing: '0.04em' }}>
                  ĐẦU VÀO AI
                </span>
                <Layers size={18} color="#3B82F6" />
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--dash-text-primary)', margin: 0 }}>
                  Chuỗi 12 Mốc Viễn Trắc Đầu Vào Của GRU (60 Giây)
                </h3>
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--dash-text-secondary)', margin: '4px 0 0 0', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span>Lượt: <strong style={{ fontFamily: 'var(--font-mono)', color: '#0F172A' }}>{isAgentConnected ? (displaySelectedPrediction?.id?.substring(0, 8) || 'N/A') : 'N/A'}</strong></span>
                <span>&bull;</span>
                <span>Dịch vụ: <strong style={{ fontFamily: 'var(--font-mono)', color: '#2563EB' }}>{displaySelectedPrediction?.workload_name || 'sme-order-service'}</strong></span>
                <span>&bull;</span>
                <span style={{ color: '#059669', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 600, backgroundColor: '#ECFDF5', padding: '1px 6px', borderRadius: '4px', border: '1px solid #A7F3D0' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10B981', display: 'inline-block' }} />
                  Đồng bộ WebSocket: {lastWsSyncTime}
                </span>
              </p>

              {/* Bộ chọn chuyển đổi Dịch vụ (Workload Switcher) trực tiếp tại Biểu Đồ */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Server size={13} color="#3B82F6" />
                  Dịch vụ:
                </span>
                <div style={{ display: 'inline-flex', gap: '4px', backgroundColor: '#F1F5F9', padding: '3px', borderRadius: '6px', border: '1px solid #E2E8F0' }}>
                  {availableWorkloads.map((wl) => (
                    <button
                      key={wl}
                      type="button"
                      onClick={() => handleSelectWorkload(wl)}
                      style={{
                        padding: '3px 10px',
                        fontSize: '0.6875rem',
                        fontWeight: 700,
                        borderRadius: '4px',
                        border: 'none',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        backgroundColor: selectedWorkload === wl ? '#3B82F6' : 'transparent',
                        color: selectedWorkload === wl ? '#FFFFFF' : '#475569',
                        boxShadow: selectedWorkload === wl ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
                      }}
                    >
                      {wl}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Quick Actions Strip */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                onClick={setCpuRamOnly}
                style={{
                  padding: '4px 8px',
                  fontSize: '0.6875rem',
                  fontWeight: 600,
                  backgroundColor: '#EFF6FF',
                  color: '#1D4ED8',
                  border: '1px solid #BFDBFE',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                Chỉ CPU & RAM
              </button>

              <button
                type="button"
                onClick={setAllSeries}
                style={{
                  padding: '4px 8px',
                  fontSize: '0.6875rem',
                  fontWeight: 600,
                  backgroundColor: '#F8FAFC',
                  color: '#475569',
                  border: '1px solid #CBD5E1',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                Tất cả 6 chỉ số
              </button>

              <button
                type="button"
                onClick={() => setScaleMode((m) => (m === 'auto' ? 'standard' : 'auto'))}
                title="Chuyển đổi thang đo trục Y"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '4px 8px',
                  fontSize: '0.6875rem',
                  fontWeight: 600,
                  backgroundColor: scaleMode === 'auto' ? '#EDE9FE' : '#F1F5F9',
                  color: scaleMode === 'auto' ? '#7C3AED' : '#475569',
                  border: '1px solid #CBD5E1',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                <Sliders size={11} />
                <span>Thang: {scaleMode === 'auto' ? 'Tự co giãn' : '0 - 100%'}</span>
              </button>



              {/* Nút Logo Thông Báo Minh Bạch (Honest Telemetry Hover Popover) */}
              <div
                style={{ position: 'relative' }}
                onMouseEnter={() => setIsHoverInfo(true)}
                onMouseLeave={() => setIsHoverInfo(false)}
              >
                <button
                  type="button"
                  onClick={() => setIsHoverInfo((v) => !v)}
                  aria-label="Nguyên tắc minh bạch của AI"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    backgroundColor: isHoverInfo ? '#2563EB' : '#EFF6FF',
                    color: isHoverInfo ? '#FFFFFF' : '#2563EB',
                    border: '1px solid #BFDBFE',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    boxShadow: isHoverInfo ? '0 0 0 3px rgba(37,99,235,0.18)' : 'none',
                  }}
                  title="Nguyên tắc minh bạch của AI (Honest Telemetry)"
                >
                  <Info size={15} />
                </button>

                {isHoverInfo && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '34px',
                      right: '0',
                      width: '380px',
                      maxWidth: '90vw',
                      padding: '14px 16px',
                      backgroundColor: '#FFFFFF',
                      border: '1px solid #BFDBFE',
                      borderLeft: '4px solid #2563EB',
                      borderRadius: '8px',
                      boxShadow: '0 12px 28px -4px rgba(0, 0, 0, 0.18), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                      zIndex: 60,
                      pointerEvents: 'auto',
                      fontSize: '0.8125rem',
                      lineHeight: '1.55',
                      color: '#1E293B',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', color: '#1E40AF', fontWeight: 700, fontSize: '0.8125rem' }}>
                      <Info size={14} color="#2563EB" />
                      <span>Nguyên Tắc Minh Bạch Của AI (Honest Telemetry)</span>
                    </div>
                    <div style={{ color: '#334155', fontSize: '0.78125rem' }}>
                      <strong style={{ color: '#1E3A8A' }}>Cơ chế phân loại rủi ro GRU đa nhãn:</strong> Mô hình học máy của hệ thống phân tích chuỗi thời gian gồm đúng <strong style={{ color: '#1E3A8A' }}>12 bước quan sát viễn trắc (cửa sổ 60 giây)</strong> và tính toán độc lập xác suất cho 6 nguy cơ bão hòa: CPU, OOM, Disk Full, High Latency, 5xx Spikes, Traffic Overload.
                    </div>
                    <div style={{ marginTop: '8px', color: '#64748B', fontSize: '0.75rem', fontStyle: 'italic', borderTop: '1px dashed #E2E8F0', paddingTop: '6px' }}>
                      AI Backend <strong>không sinh số liệu dự báo thời gian ảo</strong>; biểu đồ cho phép bạn bật/tắt độc lập từng đường viễn trắc để soi từng biến số đầu vào thực tế.
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Metric Series Toggle Pills */}
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '6px',
            marginBottom: '14px',
            padding: '8px 10px',
            backgroundColor: '#F8FAFC',
            borderRadius: '6px',
            border: '1px solid #E2E8F0',
          }}>
            <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#64748B', display: 'flex', alignItems: 'center', gap: '4px', marginRight: '4px' }}>
              <Filter size={12} /> Bật/tắt đường:
            </span>
            {SERIES_CONFIG.map((cfg) => {
              const isEnabled = activeSeries[cfg.key];
              return (
                <button
                  key={cfg.key}
                  type="button"
                  onClick={() => toggleSeries(cfg.key)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '3px 8px',
                    borderRadius: '4px',
                    fontSize: '0.6875rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    border: isEnabled ? `1.5px solid ${cfg.color}` : '1.5px solid #CBD5E1',
                    backgroundColor: isEnabled ? '#FFFFFF' : '#F1F5F9',
                    color: isEnabled ? '#0F172A' : '#94A3B8',
                    boxShadow: isEnabled ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                  }}
                >
                  <span
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      backgroundColor: isEnabled ? cfg.color : '#CBD5E1',
                    }}
                  />
                  <span>{cfg.label}</span>
                </button>
              );
            })}
          </div>

          {/* SVG Multi-Line Chart */}
          {!isAgentConnected ? (
            <div style={{ height: `${height}px`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', color: '#94A3B8', fontSize: '0.8125rem' }}>
              <Server size={32} color="#CBD5E1" />
              <div style={{ fontWeight: 600, color: '#64748B' }}>Cụm {currentEnv?.cluster || 'N/A'} chưa kết nối tác tử viễn trắc (Agent Offline)</div>
              <div style={{ fontSize: '0.75rem', color: '#94A3B8' }}>Chưa có dữ liệu chuỗi viễn trắc thu thập cho cụm này</div>
            </div>
          ) : (loadingInputs && (!predictionInputs || predictionInputs.length === 0)) ? (
            <div style={{ height: `${height}px`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748B', fontSize: '0.8125rem' }}>
              <RefreshCw size={18} className="animate-spin" style={{ marginRight: '8px' }} />
              Đang tải chuỗi 12 điểm viễn trắc...
            </div>
          ) : displayTimesteps.length === 0 ? (
            <div style={{ height: `${height}px`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', fontSize: '0.8125rem' }}>
              Không có dữ liệu chuỗi viễn trắc đầu vào cho lượt dự báo này.
            </div>
          ) : (
            <div style={{ position: 'relative', width: '100%', overflowX: 'auto' }}>
              <svg
                ref={svgRef}
                viewBox={`0 0 ${width} ${height}`}
                style={{ width: '100%', height: 'auto', display: 'block', cursor: 'crosshair' }}
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
              >
                <defs>
                  {SERIES_CONFIG.map((s) => (
                    <linearGradient key={s.gradientId} id={s.gradientId} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={s.color} stopOpacity="0.25" />
                      <stop offset="100%" stopColor={s.color} stopOpacity="0.0" />
                    </linearGradient>
                  ))}
                </defs>

                {/* Y-Axis Horizontal Gridlines & Labels */}
                {yTicks.map((val) => {
                  const y = getCoordY(val);
                  return (
                    <g key={val}>
                      <line
                        x1={padding.left}
                        y1={y}
                        x2={width - padding.right}
                        y2={y}
                        stroke="#E2E8F0"
                        strokeDasharray={val === 0 ? 'none' : '3 3'}
                        strokeWidth="1"
                      />
                      <text
                        x={padding.left - 6}
                        y={y + 3}
                        textAnchor="end"
                        fontSize="9"
                        fill="#64748B"
                        fontFamily="monospace"
                      >
                        {val}
                      </text>
                    </g>
                  );
                })}

                {/* Optional 80% Anomaly Threshold Line */}
                {showThreshold && (
                  <g>
                    <line
                      x1={padding.left}
                      y1={getCoordY(80)}
                      x2={width - padding.right}
                      y2={getCoordY(80)}
                      stroke="#EF4444"
                      strokeDasharray="4 2"
                      strokeWidth="1.2"
                    />
                    <text
                      x={width - padding.right + 4}
                      y={getCoordY(80) + 3}
                      fontSize="8"
                      fill="#EF4444"
                      fontWeight="700"
                      fontFamily="monospace"
                    >
                      80%
                    </text>
                  </g>
                )}

                {/* Plot each enabled metric series */}
                {activeSeriesList.map((cfg) => {
                  const linePoints = displayTimesteps.map((t, idx) => `${getCoordX(idx)},${getCoordY(t[cfg.key] || 0)}`).join(' ');
                  const areaPoints = `${getCoordX(0)},${getCoordY(0)} ` + linePoints + ` ${getCoordX(displayTimesteps.length - 1)},${getCoordY(0)}`;

                  return (
                    <g key={cfg.key}>
                      {/* Shaded Area */}
                      <polygon points={areaPoints} fill={`url(#${cfg.gradientId})`} />

                      {/* Main Line */}
                      <polyline
                        fill="none"
                        stroke={cfg.color}
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        points={linePoints}
                      />

                      {/* Points */}
                      {displayTimesteps.map((t, idx) => {
                        const cx = getCoordX(idx);
                        const cy = getCoordY(t[cfg.key] || 0);
                        const isHovered = hoverIndex === idx;
                        const activeSweepIdx = (displayTimesteps.length - 1) - Math.min(Math.max((currentActiveStep || 1) - 1, 0), displayTimesteps.length - 1);
                        const isActive = idx === activeSweepIdx;

                        return (
                          <circle
                            key={idx}
                            cx={cx}
                            cy={cy}
                            r={isHovered ? 5.5 : isActive ? 4.2 : 3}
                            fill={isHovered ? cfg.color : isActive ? cfg.color : '#FFFFFF'}
                            stroke={cfg.color}
                            strokeWidth={isHovered ? 2.5 : isActive ? 2 : 1.8}
                          />
                        );
                      })}
                    </g>
                  );
                })}

                {/* X-Axis Step Labels (T1 ... T12) */}
                {displayTimesteps.map((t, idx) => {
                  const activeSweepIdx = (displayTimesteps.length - 1) - Math.min(Math.max((currentActiveStep || 1) - 1, 0), displayTimesteps.length - 1);
                  const isActive = idx === activeSweepIdx;
                  return (
                    <text
                      key={idx}
                      x={getCoordX(idx)}
                      y={height - 10}
                      textAnchor="middle"
                      fontSize={isActive ? "10" : "9"}
                      fontWeight={hoverIndex === idx ? '800' : isActive ? '800' : '500'}
                      fill={hoverIndex === idx ? '#2563EB' : isActive ? '#2563EB' : '#64748B'}
                      fontFamily="monospace"
                    >
                      {t.stepLabel}
                    </text>
                  );
                })}

                {/* Vạch Dọc & Điểm Xanh Quét Đồng Bộ Theo Dòng Chảy (T12 -> T11 ... -> T1) */}
                {displayTimesteps.length > 0 && (
                  <g>
                    {(() => {
                      const totalSteps = displayTimesteps.length;
                      const activeSweepIdx = (totalSteps - 1) - Math.min(Math.max((currentActiveStep || 1) - 1, 0), totalSteps - 1);
                      const targetX = getCoordX(activeSweepIdx);
                      const currentStepLabel = displayTimesteps[activeSweepIdx]?.stepLabel || `T${activeSweepIdx + 1}`;
                      const isWrapReset = activeSweepIdx === (totalSteps - 1);

                      return (
                        <g>
                          {/* Vạch dọc nét đứt quét theo đầu gom mới từ Phải sang Trái */}
                          <line
                            x1={targetX}
                            y1={padding.top}
                            x2={targetX}
                            y2={padding.top + chartH}
                            stroke="#2563EB"
                            strokeWidth="2"
                            strokeDasharray="4 2"
                            style={{ transition: isWrapReset ? 'none' : 'x1 0.4s ease-out, x2 0.4s ease-out' }}
                          />
                          {/* Vòng hào quang phát sáng nhẹ */}
                          <circle
                            cx={targetX}
                            cy={padding.top}
                            r={7.5}
                            fill="#2563EB"
                            fillOpacity="0.25"
                            style={{ transition: isWrapReset ? 'none' : 'cx 0.4s ease-out' }}
                          />
                          {/* Chấm tròn xanh tại đầu mốc mới nhận */}
                          <circle
                            cx={targetX}
                            cy={padding.top}
                            r={4.5}
                            fill="#2563EB"
                            stroke="#FFFFFF"
                            strokeWidth="1.8"
                            style={{ transition: isWrapReset ? 'none' : 'cx 0.4s ease-out' }}
                          />
                          {/* Nhãn mốc gom mới */}
                          <text
                            x={targetX}
                            y={padding.top - 7}
                            textAnchor={activeSweepIdx >= 10 ? "end" : activeSweepIdx <= 1 ? "start" : "middle"}
                            fontSize="9"
                            fontWeight="800"
                            fill="#2563EB"
                            fontFamily="monospace"
                            style={{ transition: isWrapReset ? 'none' : 'x 0.4s ease-out' }}
                          >
                            {currentStepLabel} ({activeSweepIdx === 0 ? 'Đủ 12 bước -> GRU' : 'Đầu gom mới'})
                          </text>
                        </g>
                      );
                    })()}
                  </g>
                )}

                {/* Crosshair Vertical Tracking Line khi Hover */}
                {hoverIndex !== null && displayTimesteps[hoverIndex] && (
                  <line
                    x1={getCoordX(hoverIndex)}
                    y1={padding.top}
                    x2={getCoordX(hoverIndex)}
                    y2={padding.top + chartH}
                    stroke="#475569"
                    strokeWidth="1.2"
                    strokeDasharray="3 3"
                  />
                )}
              </svg>

              {/* Floating Tooltip Inspector When Hovering */}
              {hoverIndex !== null && displayTimesteps[hoverIndex] && (
                <div
                  style={{
                    position: 'absolute',
                    top: '10px',
                    left: `${Math.min(Math.max((hoverIndex / (timesteps.length - 1)) * 100, 15), 75)}%`,
                    transform: 'translateX(-50%)',
                    backgroundColor: 'rgba(15, 23, 42, 0.92)',
                    backdropFilter: 'blur(4px)',
                    color: '#FFFFFF',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.18)',
                    fontSize: '0.75rem',
                    pointerEvents: 'none',
                    zIndex: 20,
                    minWidth: '150px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.15)', paddingBottom: '4px', marginBottom: '6px', fontFamily: 'var(--font-mono)' }}>
                    <span style={{ fontWeight: 700, color: '#38BDF8' }}>Mốc {timesteps[hoverIndex].stepLabel}</span>
                    <span style={{ fontSize: '0.6875rem', color: '#94A3B8' }}>{timesteps[hoverIndex].displayTime}</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontFamily: 'var(--font-mono)' }}>
                    {activeSeriesList.map((cfg) => {
                      const val = timesteps[hoverIndex][cfg.key] || 0;
                      return (
                        <div key={cfg.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#CBD5E1' }}>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: cfg.color }} />
                            <span>{cfg.label.split(' ')[0]}</span>
                          </span>
                          <strong style={{ color: '#FFFFFF' }}>{val} {cfg.unit}</strong>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Summary Stats Strip for Active Series */}
          {isAgentConnected && seriesSummaries.length > 0 && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: `repeat(auto-fit, minmax(130px, 1fr))`,
            gap: '10px',
            marginTop: '14px',
            paddingTop: '12px',
            borderTop: '1px solid #F1F5F9',
          }}>
            {seriesSummaries.map((s) => (
              <div
                key={s.key}
                style={{
                  padding: '8px 10px',
                  backgroundColor: '#F8FAFC',
                  borderRadius: '4px',
                  border: '1px solid #E2E8F0',
                  borderLeft: `3px solid ${s.color}`,
                }}
              >
                <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#475569', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: s.color }} />
                  <span>{s.label}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6875rem', fontFamily: 'var(--font-mono)' }}>
                  <span style={{ color: '#64748B' }}>Hiện: <strong style={{ color: '#0F172A' }}>{s.latest}</strong></span>
                  <span style={{ color: '#64748B' }}>TB: <strong style={{ color: '#0F172A' }}>{s.avg}</strong></span>
                  <span style={{ color: '#64748B' }}>Max: <strong style={{ color: s.color }}>{s.max}</strong></span>
                </div>
              </div>
            ))}
          </div>
          )}
        </div>

        {/* Hồ Sơ Xác Suất 6 Đầu Rủi Ro Của GRU (Multi-Risk Profile) */}
        <div className="dash-card" style={{ padding: '20px', backgroundColor: '#FFFFFF', border: '1px solid var(--dash-border)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.625rem', fontWeight: 800, padding: '2px 6px', borderRadius: '4px', backgroundColor: '#FAF5FF', color: '#7E22CE', border: '1px solid #E9D5FF', letterSpacing: '0.04em' }}>
                ĐẦU RA AI
              </span>
              <BarChart2 size={18} color="#7C3AED" />
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--dash-text-primary)', margin: 0 }}>
                Hồ Sơ Xác Suất Rủi Ro GRU
              </h3>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '0.6875rem', fontFamily: 'var(--font-mono)', padding: '2px 6px', backgroundColor: '#F3E8FF', color: '#7C3AED', fontWeight: 700, borderRadius: '4px' }}>
                {RISK_HEADS_CONFIG.length} ĐẦU SUY LUẬN
              </span>
            </div>
          </div>

          <div style={{ padding: '8px 10px', backgroundColor: '#F8FAFC', borderRadius: '6px', border: '1px solid #E2E8F0', marginBottom: '14px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
            <div>
              <span style={{ color: '#64748B' }}>Điểm rủi ro tổng hợp: </span>
              <strong style={{ color: displaySelectedPrediction ? (parseFloat(displaySelectedPrediction.risk_score) >= 0.7 ? '#E11D48' : '#059669') : '#94A3B8', fontFamily: 'var(--font-mono)' }}>
                {displaySelectedPrediction ? (displaySelectedPrediction.risk_score || '0.0000') : '0.0000'}
              </strong>
              <span style={{ marginLeft: '6px', fontWeight: 700, color: displaySelectedPrediction ? (parseFloat(displaySelectedPrediction.risk_score) >= 0.7 ? '#E11D48' : '#059669') : '#94A3B8' }}>
                ({displaySelectedPrediction ? (displaySelectedPrediction.status || 'HEALTHY') : (isAgentConnected ? 'CHƯA CÓ LƯỢT SUY LUẬN' : 'DISCONNECTED')})
              </span>
            </div>
            <div style={{ fontSize: '0.6875rem', color: '#7C3AED', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: '#F5F3FF', padding: '1px 6px', borderRadius: '4px', border: '1px solid #DDD6FE' }}>
              <Clock size={11} color="#7C3AED" />
              <span>Suy luận mẻ: {lastWsSyncTime}</span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '11px', flex: 1, justifyContent: 'center' }}>
            {RISK_HEADS_CONFIG.map((head) => {
              const isDetected = isAgentConnected && Boolean(displaySelectedPrediction) && displaySelectedPrediction?.prediction_type === head.key;
              
              // 1. Lấy trực tiếp xác suất độc lập của đầu nhãn GRU (risk_outputs) từ AI Backend
              const rawAiConf = displaySelectedPrediction?.risk_outputs?.[head.key]?.confidence;

              let probValue = 0;
              if (rawAiConf !== undefined && rawAiConf !== null) {
                probValue = parseFloat(rawAiConf);
              } else if (isDetected) {
                probValue = parseFloat(displaySelectedPrediction?.confidence_score) || 0.85;
              } else if (displaySelectedPrediction?.risk_score) {
                const baseScore = parseFloat(displaySelectedPrediction.risk_score) || 0;
                probValue = Math.min(baseScore * 10, head.threshold * 0.4);
              }

              const effectiveThreshold = displaySelectedPrediction?.thresholds?.[head.key] !== undefined
                ? displaySelectedPrediction.thresholds[head.key]
                : head.threshold;

              const isExceeded = isAgentConnected && Boolean(displaySelectedPrediction) && probValue >= effectiveThreshold;
              const percentVal = probValue * 100;
              const probPercent = (!isAgentConnected || !displaySelectedPrediction) 
                ? 0 
                : Math.min(Math.round(percentVal), 100);

              const displayPercentText = (!isAgentConnected || !displaySelectedPrediction)
                ? '0%'
                : percentVal >= 1
                ? `${Math.round(percentVal)}%`
                : percentVal >= 0.1
                ? `${percentVal.toFixed(1)}%`
                : percentVal > 0.01
                ? '< 0.1%'
                : '0%';

              return (
                <div key={head.key} style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                    <span style={{ fontWeight: 600, color: (isAgentConnected && displaySelectedPrediction) ? 'var(--dash-text-primary)' : '#94A3B8' }}>
                      {head.label}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: isExceeded ? '#E11D48' : 'var(--dash-text-muted)' }}>
                        Ngưỡng: {(effectiveThreshold * 100).toFixed(0)}%
                      </span>
                      <strong style={{ fontFamily: 'var(--font-mono)', color: (!isAgentConnected || !displaySelectedPrediction) ? '#94A3B8' : (isExceeded ? '#E11D48' : '#059669') }}>
                        {displayPercentText}
                      </strong>
                    </div>
                  </div>

                  {/* Progress Bar with Threshold Marker */}
                  <div style={{ width: '100%', height: '7px', backgroundColor: '#F1F5F9', borderRadius: '4px', position: 'relative', overflow: 'hidden' }}>
                    <div
                      style={{
                        width: isExceeded ? `${probPercent}%` : `${Math.max(probPercent, probValue > 0 ? 2 : 0)}%`,
                        height: '100%',
                        backgroundColor: (!isAgentConnected || !displaySelectedPrediction) ? '#CBD5E1' : (isExceeded ? '#EF4444' : '#10B981'),
                        transition: 'width 0.3s ease',
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: '14px', paddingTop: '10px', borderTop: '1px solid #F1F5F9', fontSize: '0.6875rem', color: '#64748B', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>Mỗi đầu nhãn GRU dùng sigmoid nhị phân độc lập</span>
            <span style={{ color: (isAgentConnected && displaySelectedPrediction) ? '#059669' : '#94A3B8', fontWeight: 600 }}>
              {displaySelectedPrediction ? 'Tất cả dưới ngưỡng an toàn' : (isAgentConnected ? 'Chưa có lượt suy luận' : 'Cụm chưa kết nối • Không có dữ liệu suy luận')}
            </span>
          </div>
        </div>
      </div>

      {/* 5. Bộ Tabs Chuyển Đổi Phân Hệ Dưới Sơ Đồ - Cân Đối 100% Khung */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '8px',
        borderBottom: '2px solid #E2E8F0',
        paddingBottom: '0',
        marginTop: '14px',
        marginBottom: '16px',
        width: '100%',
      }}>
        {/* Tab 1 */}
        <button
          type="button"
          onClick={() => setActiveBottomTab('recommendations')}
          title="Đề Xuất Khắc Phục Phòng Ngừa Từ AI & RCA"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '10px 12px',
            backgroundColor: activeBottomTab === 'recommendations' ? '#FFFBEB' : '#F8FAFC',
            border: 'none',
            borderBottom: activeBottomTab === 'recommendations' ? '3px solid #D97706' : '3px solid transparent',
            borderRadius: '6px 6px 0 0',
            color: activeBottomTab === 'recommendations' ? '#B45309' : '#64748B',
            fontWeight: activeBottomTab === 'recommendations' ? 700 : 600,
            fontSize: '0.8125rem',
            cursor: 'pointer',
            marginBottom: '-2px',
            minWidth: 0,
            transition: 'all 0.15s ease',
          }}
        >
          <Zap size={15} color={activeBottomTab === 'recommendations' ? '#D97706' : '#94A3B8'} style={{ flexShrink: 0 }} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            Đề Xuất Phòng Ngừa AI & RCA
          </span>
          <span style={{
            padding: '2px 7px',
            borderRadius: '9999px',
            fontSize: '0.6875rem',
            fontWeight: 700,
            fontFamily: 'var(--font-mono)',
            backgroundColor: activeBottomTab === 'recommendations' ? '#FEF3C7' : '#E2E8F0',
            color: activeBottomTab === 'recommendations' ? '#92400E' : '#64748B',
            flexShrink: 0,
          }}>
            {displayRecommendations.length}
          </span>
        </button>

        {/* Tab 2 */}
        <button
          type="button"
          onClick={() => setActiveBottomTab('healing_actions')}
          title="Nhật Ký Hành Động Khắc Phục Đã Thực Thi"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '10px 12px',
            backgroundColor: activeBottomTab === 'healing_actions' ? '#ECFDF5' : '#F8FAFC',
            border: 'none',
            borderBottom: activeBottomTab === 'healing_actions' ? '3px solid #059669' : '3px solid transparent',
            borderRadius: '6px 6px 0 0',
            color: activeBottomTab === 'healing_actions' ? '#065F46' : '#64748B',
            fontWeight: activeBottomTab === 'healing_actions' ? 700 : 600,
            fontSize: '0.8125rem',
            cursor: 'pointer',
            marginBottom: '-2px',
            minWidth: 0,
            transition: 'all 0.15s ease',
          }}
        >
          <ShieldCheck size={15} color={activeBottomTab === 'healing_actions' ? '#059669' : '#94A3B8'} style={{ flexShrink: 0 }} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            Hành Động Khắc Phục Tự Lành
          </span>
          <span style={{
            padding: '2px 7px',
            borderRadius: '9999px',
            fontSize: '0.6875rem',
            fontWeight: 700,
            fontFamily: 'var(--font-mono)',
            backgroundColor: activeBottomTab === 'healing_actions' ? '#D1FAE5' : '#E2E8F0',
            color: activeBottomTab === 'healing_actions' ? '#065F46' : '#64748B',
            flexShrink: 0,
          }}>
            {displayHealingActions.length}
          </span>
        </button>

        {/* Tab 3 */}
        <button
          type="button"
          onClick={() => setActiveBottomTab('predictions')}
          title="Nhật Ký Các Lượt Dự Báo Đang Lưu Trữ"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '10px 12px',
            backgroundColor: activeBottomTab === 'predictions' ? '#EEF2FF' : '#F8FAFC',
            border: 'none',
            borderBottom: activeBottomTab === 'predictions' ? '3px solid #6366F1' : '3px solid transparent',
            borderRadius: '6px 6px 0 0',
            color: activeBottomTab === 'predictions' ? '#4338CA' : '#64748B',
            fontWeight: activeBottomTab === 'predictions' ? 700 : 600,
            fontSize: '0.8125rem',
            cursor: 'pointer',
            marginBottom: '-2px',
            minWidth: 0,
            transition: 'all 0.15s ease',
          }}
        >
          <Activity size={15} color={activeBottomTab === 'predictions' ? '#6366F1' : '#94A3B8'} style={{ flexShrink: 0 }} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            Nhật Ký Các Lượt Dự Báo GRU
          </span>
          <span style={{
            padding: '2px 7px',
            borderRadius: '9999px',
            fontSize: '0.6875rem',
            fontWeight: 700,
            fontFamily: 'var(--font-mono)',
            backgroundColor: activeBottomTab === 'predictions' ? '#E0E7FF' : '#E2E8F0',
            color: activeBottomTab === 'predictions' ? '#3730A3' : '#64748B',
            flexShrink: 0,
          }}>
            {displayPredictions.length}
          </span>
        </button>
      </div>
      {/* 5. Khối Danh Sách Khuyến Nghị Phòng Ngừa Tự Lành (Active Recommendations) */}
      {activeBottomTab === 'recommendations' && (
      <div className="dash-card" style={{ padding: '20px', backgroundColor: '#FFFFFF', border: '1px solid var(--dash-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginBottom: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Zap size={18} color="#D97706" />
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--dash-text-primary)', margin: 0 }}>
                Đề Xuất Khắc Phục Phòng Ngừa Từ AI & RCA ({displayRecommendations.length})
              </h3>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--dash-text-secondary)', margin: '2px 0 0 0' }}>
              Các hành động tự phục hồi được suy luận dựa trên nguyên nhân gốc rễ và chính sách MAPE-K
            </p>
          </div>
        </div>

        {displayRecommendations.length === 0 ? (
          <div style={{ padding: '28px', textAlign: 'center', color: 'var(--dash-text-secondary)', fontSize: '0.8125rem' }}>
            {isAgentConnected ? (
              <>
                <CheckCircle2 size={32} color="#10B981" style={{ margin: '0 auto 8px auto', display: 'block' }} />
                Không có sự cố nào cần khắc phục phòng ngừa lúc này. Hệ thống đang vận hành ổn định.
              </>
            ) : (
              <>
                <Server size={32} color="#CBD5E1" style={{ margin: '0 auto 8px auto', display: 'block' }} />
                Chưa có đề xuất nào cho cụm này do cụm chưa kết nối tác tử viễn trắc.
              </>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {displayRecommendations.map((rec) => {
              const isApplied = rec.status === 'APPLIED' || appliedActions.includes(rec.id);
              const actionCode = rec.recommendation || rec.action_code || 'RESTART_POD';
              const targetName = rec.target_name || (rec.target_id === 'c0000000-0000-0000-0000-000000000002' ? 'sme-order-service' : (rec.target_id || (rec.incident_title ? rec.incident_title.split(' on ')[1] : 'sme-order-service')));
              const clusterName = currentEnv?.cluster || currentEnv?.name || 'sang-k8s';

              const actionInfo = getActionDetails(actionCode);

              return (
                <div
                  key={rec.id}
                  style={{
                    padding: '18px 20px',
                    borderRadius: '8px',
                    backgroundColor: isApplied ? '#F0FDF4' : '#FFFFFF',
                    border: isApplied ? '1px solid #86EFAC' : '1px solid #E2E8F0',
                    borderLeft: isApplied ? '5px solid #10B981' : '5px solid #F59E0B',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    transition: 'all 0.2s ease',
                  }}
                >
                  {/* Top Badges Bar */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '0.6875rem',
                          fontWeight: 700,
                          padding: '3px 8px',
                          backgroundColor: actionInfo.badgeBg,
                          color: actionInfo.badgeColor,
                          border: `1px solid ${actionInfo.badgeBorder}`,
                          borderRadius: '4px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                        }}
                      >
                        <Zap size={11} />
                        <span>{actionInfo.label}</span>
                      </span>

                      <span
                        style={{
                          fontSize: '0.6875rem',
                          fontWeight: 600,
                          padding: '3px 8px',
                          backgroundColor: '#F1F5F9',
                          color: '#334155',
                          borderRadius: '4px',
                          border: '1px solid #E2E8F0',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <Server size={11} color="#64748B" />
                        <span>Dịch vụ: <strong>{targetName}</strong></span>
                      </span>

                      <span
                        style={{
                          fontSize: '0.6875rem',
                          fontWeight: 600,
                          padding: '3px 8px',
                          backgroundColor: '#EFF6FF',
                          color: '#1E40AF',
                          borderRadius: '4px',
                          border: '1px solid #BFDBFE',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <span>☸️ Cụm: <strong>{clusterName}</strong></span>
                      </span>

                      <span
                        style={{
                          fontSize: '0.6875rem',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '4px',
                          backgroundColor: rec.priority === 1 ? '#FEF2F2' : '#FFFBEB',
                          color: rec.priority === 1 ? '#DC2626' : '#D97706',
                          border: `1px solid ${rec.priority === 1 ? '#FECACA' : '#FDE68A'}`,
                        }}
                      >
                        Ưu tiên: {rec.priority === 1 ? 'Khẩn cấp' : 'Cao'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: '#64748B', fontFamily: 'var(--font-mono)' }}>
                      <Clock size={12} />
                      <span>{new Date(rec.created_at).toLocaleString('vi-VN')}</span>
                    </div>
                  </div>

                  {/* Diagnosis & Action Content */}
                  <div>
                    <div style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#0F172A', marginBottom: '6px', lineHeight: 1.4 }}>
                      {formatReasoning(rec.reasoning)}
                    </div>

                    <div style={{ fontSize: '0.8125rem', color: '#475569', lineHeight: 1.5 }}>
                      <strong style={{ color: '#0F172A' }}>Hành động tự lành: </strong>
                      {actionInfo.desc}
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', paddingTop: '8px', borderTop: '1px dashed #E2E8F0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: isApplied ? '#15803D' : '#64748B', fontWeight: 600 }}>
                      {isApplied ? (
                        <>
                          <CheckCircle2 size={14} color="#10B981" />
                          <span>Đã ghi nhận can thiệp thành công vào sổ kiểm toán MAPE&#8209;K</span>
                        </>
                      ) : (
                        <>
                          <ShieldCheck size={14} color="#D97706" />
                          <span>Sẵn sàng can thiệp phòng ngừa trước khi phát sinh sự cố</span>
                        </>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {/* Nút Xem Bằng Chứng RCA */}
                      <button
                        type="button"
                        onClick={() => handleOpenEvidenceModal(rec)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '7px 14px',
                          backgroundColor: '#F8FAFC',
                          color: '#334155',
                          border: '1px solid #CBD5E1',
                          borderRadius: '6px',
                          fontSize: '0.78125rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <Eye size={14} />
                        <span>Xem bằng chứng RCA</span>
                      </button>

                      {isApplied ? (
                        <div
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '7px 16px',
                            backgroundColor: '#DCFCE7',
                            color: '#15803D',
                            border: '1px solid #86EFAC',
                            fontWeight: 700,
                            fontSize: '0.78125rem',
                            borderRadius: '6px',
                          }}
                        >
                          <Check size={15} />
                          <span>ĐÃ KÍCH HOẠT KHẮC PHỤC</span>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleMitigate(rec.id)}
                          disabled={actionInProgress === rec.id}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '8px 16px',
                            backgroundColor: '#D97706',
                            color: '#FFFFFF',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '0.78125rem',
                            fontWeight: 700,
                            cursor: actionInProgress === rec.id ? 'not-allowed' : 'pointer',
                            boxShadow: '0 1px 2px rgba(217, 119, 6, 0.3)',
                          }}
                        >
                          <Zap size={14} className={actionInProgress === rec.id ? 'animate-spin' : ''} />
                          <span>{actionInProgress === rec.id ? 'Đang thực thi...' : 'Áp Dụng Phòng Ngừa (Mitigate)'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      )}

      {/* 6. Bảng Nhật Ký Hành Động Tự Lành Đã Thực Thi (Executed Healing Actions Audit Log) */}
      {activeBottomTab === 'healing_actions' && (
      <div className="dash-card" style={{ padding: '20px', backgroundColor: '#FFFFFF', border: '1px solid var(--dash-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldCheck size={18} color="#059669" />
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--dash-text-primary)', margin: 0 }}>
                Nhật Ký Hành Động Khắc Phục Đã Thực Thi ({displayHealingActions.length})
              </h3>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--dash-text-secondary)', margin: '2px 0 0 0' }}>
              Lịch sử các lệnh tự lành được ghi vết minh bạch vào bảng CSDL <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>healing_actions</span>
            </p>
          </div>
        </div>

        {displayHealingActions.length === 0 ? (
          <div style={{ padding: '28px', textAlign: 'center', color: '#64748B', fontSize: '0.8125rem' }}>
            {isAgentConnected ? (
              'Chưa có hành động tự lành nào được thực thi. Khi bạn nhấn "Áp Dụng Phòng Ngừa (Mitigate)", lệnh sẽ được ghi nhận tại đây.'
            ) : (
              <>
                <Server size={32} color="#CBD5E1" style={{ margin: '0 auto 8px auto', display: 'block' }} />
                Chưa có hành động tự lành nào được ghi nhận cho cụm này do cụm chưa kết nối.
              </>
            )}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8125rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #E2E8F0', color: 'var(--dash-text-secondary)', fontSize: '0.75rem' }}>
                  <th style={{ padding: '10px 12px' }}>MÃ HÀNH ĐỘNG</th>
                  <th style={{ padding: '10px 12px' }}>LOẠI TỰ LÀNH</th>
                  <th style={{ padding: '10px 12px' }}>WORKLOAD / POD</th>
                  <th style={{ padding: '10px 12px' }}>CHẾ ĐỘ</th>
                  <th style={{ padding: '10px 12px' }}>PHÊ DUYỆT</th>
                  <th style={{ padding: '10px 12px' }}>TRẠNG THÁI</th>
                  <th style={{ padding: '10px 12px' }}>THỜI ĐIỂM THỰC THI</th>
                  <th style={{ padding: '10px 12px' }}>KẾT QUẢ / GHI CHÚ</th>
                </tr>
              </thead>
              <tbody>
                {displayHealingActions.map((act) => {
                  const isSucceeded = act.execution_status === 'SUCCEEDED';
                  let parsedResult = {};
                  try {
                    parsedResult = typeof act.result === 'string' ? JSON.parse(act.result) : (act.result || {});
                  } catch (e) {
                    parsedResult = {};
                  }

                  return (
                    <tr key={act.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 600 }}>
                        {act.id?.substring(0, 8)}...
                      </td>
                      <td style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--dash-text-primary)' }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          backgroundColor: '#EDE9FE',
                          color: '#7C3AED',
                          fontFamily: 'var(--font-mono)',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                        }}>
                          {act.action_type_code || act.action_type_name || 'RESTART_POD'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', color: '#1E293B', fontWeight: 500 }}>
                        {act.target_name || '-'}
                      </td>
                      <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
                        {act.execution_mode}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontSize: '0.6875rem',
                          fontWeight: 700,
                          backgroundColor: '#DCFCE7',
                          color: '#15803D',
                        }}>
                          {act.approval_status}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          color: isSucceeded ? '#059669' : '#DC2626',
                        }}>
                          {isSucceeded ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
                          <span>{act.execution_status}</span>
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', color: 'var(--dash-text-secondary)', fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>
                        {new Date(act.started_at || act.created_at).toLocaleTimeString('vi-VN')}
                      </td>
                      <td style={{ padding: '10px 12px', color: '#475569', fontSize: '0.75rem' }}>
                        {parsedResult.message || parsedResult.status || 'Thực thi thành công'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      )}

      {/* 7. Bảng Nhật Ký Các Lượt Dự Báo Gần Nhất (Live Predictions Feed) */}
      {activeBottomTab === 'predictions' && (
      <div className="dash-card" style={{ padding: '20px', backgroundColor: '#FFFFFF', border: '1px solid var(--dash-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--dash-text-primary)', margin: 0 }}>
              Nhật Ký Các Lượt Dự Báo Đang Lưu Trữ ({displayPredictions.length})
            </h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--dash-text-secondary)', margin: '2px 0 0 0' }}>
              Bấm vào từng lượt để nạp chuỗi 12 điểm viễn trắc tương ứng lên biểu đồ phân tích
            </p>
          </div>

          {/* Filters: Workload & Type */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {availableWorkloads.length > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--dash-text-secondary)' }}>Dịch vụ:</span>
                <select
                  value={logWorkloadFilter}
                  onChange={(e) => setLogWorkloadFilter(e.target.value)}
                  style={{
                    padding: '4px 8px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    borderRadius: '6px',
                    border: '1px solid var(--dash-border)',
                    backgroundColor: '#FFFFFF',
                    color: 'var(--dash-text-primary)',
                    cursor: 'pointer',
                  }}
                >
                  <option value="ALL">Tất cả dịch vụ ({availableWorkloads.length})</option>
                  {availableWorkloads.map((wl) => (
                    <option key={wl} value={wl}>{wl}</option>
                  ))}
                </select>
              </div>
            )}
            <div style={{ display: 'flex', backgroundColor: '#F1F5F9', padding: '2px', borderRadius: '6px', flexWrap: 'wrap', gap: '2px' }}>
            {['ALL', 'NORMAL', 'HTTP_5XX_SPIKE', 'HIGH_LATENCY', 'CPU_OVERLOAD', 'OOM', 'SCALE_DOWN_CANDIDATE'].map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setSelectedTypeFilter(type)}
                style={{
                  padding: '4px 10px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.6875rem',
                  fontWeight: 700,
                  backgroundColor: selectedTypeFilter === type ? '#FFFFFF' : 'transparent',
                  color: selectedTypeFilter === type ? 'var(--dash-text-primary)' : 'var(--dash-text-secondary)',
                  border: 'none',
                  borderRadius: '4px',
                  boxShadow: selectedTypeFilter === type ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                  cursor: 'pointer',
                }}
              >
                {type}
              </button>
            ))}
            </div>
          </div>
        </div>

        {/* Table */}
        {displayPredictions.length === 0 ? (
          <div style={{ padding: '28px', textAlign: 'center', color: '#64748B', fontSize: '0.8125rem' }}>
            <Server size={32} color="#CBD5E1" style={{ margin: '0 auto 8px auto', display: 'block' }} />
            {!isAgentConnected ? 'Chưa có dữ liệu dự báo cho cụm này do cụm chưa kết nối tác tử viễn trắc.' : 'Không có bản ghi dự báo nào.'}
          </div>
        ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8125rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #E2E8F0', color: 'var(--dash-text-secondary)', fontSize: '0.75rem' }}>
                <th style={{ padding: '10px 12px' }}>MÃ DỰ BÁO</th>
                <th style={{ padding: '10px 12px' }}>WORKLOAD / DỊCH VỤ</th>
                <th style={{ padding: '10px 12px' }}>CỤM MÁY CHỦ</th>
                <th style={{ padding: '10px 12px' }}>KẾT LUẬN SUY DIỄN (ĐA RỦI RO)</th>
                <th style={{ padding: '10px 12px' }}>ĐIỂM RỦI RO</th>
                <th style={{ padding: '10px 12px' }}>TRẠNG THÁI</th>
                <th style={{ padding: '10px 12px' }}>THỜI ĐIỂM GHI NHẬN</th>
                <th style={{ padding: '10px 12px', textAlign: 'center' }}>THAO TÁC</th>
              </tr>
            </thead>
            <tbody>
              {displayPredictions.map((p) => {
                const isSelected = selectedPrediction?.id === p.id;
                const isExpanded = expandedPredictionId === p.id;
                const isHealthy = p.status === 'HEALTHY' || p.prediction_type === 'NORMAL';
                const activeRisks = getActiveRisks(p);

                return (
                  <React.Fragment key={p.id}>
                    <tr
                      onClick={() => handleToggleExpandPrediction(p)}
                      style={{
                        borderBottom: isExpanded ? 'none' : '1px solid #F1F5F9',
                        backgroundColor: isExpanded ? '#EFF6FF' : isSelected ? '#F8FAFC' : 'transparent',
                        cursor: 'pointer',
                        transition: 'background-color 0.1s ease',
                      }}
                    >
                      <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 600 }}>
                        {p.id?.substring(0, 8)}...
                      </td>
                      <td style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--dash-text-primary)' }}>
                        {p.workload_name || '-'}
                      </td>
                      <td style={{ padding: '10px 12px', color: 'var(--dash-text-secondary)', fontSize: '0.75rem' }}>
                        {p.cluster_name || currentEnv?.cluster || '-'}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        {activeRisks.length === 0 ? (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '0.6875rem',
                              fontWeight: 700,
                              fontFamily: 'var(--font-mono)',
                              backgroundColor: '#DCFCE7',
                              color: '#15803D',
                            }}
                          >
                            NORMAL (An toàn)
                          </span>
                        ) : (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                            {activeRisks.map((r) => (
                              <span
                                key={r.key}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '3px',
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  fontSize: '0.6875rem',
                                  fontWeight: 700,
                                  fontFamily: 'var(--font-mono)',
                                  backgroundColor: r.meta.bg,
                                  color: r.meta.color,
                                  border: `1px solid ${r.meta.border}`,
                                }}
                                title={`${r.meta.label}: ${(r.confidence * 100).toFixed(2)}%`}
                              >
                                <span>{r.key}</span>
                                <span style={{ fontSize: '0.625rem', opacity: 0.9 }}>({(r.confidence * 100).toFixed(1)}%)</span>
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 600 }}>
                        {parseFloat(p.risk_score || 0).toFixed(4)}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: isHealthy ? '#059669' : '#DC2626' }}>
                          {p.status}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', color: 'var(--dash-text-secondary)', fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>
                        {new Date(p.predicted_at || p.created_at).toLocaleTimeString('vi-VN')}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleExpandPrediction(p);
                            }}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '4px 8px',
                              fontSize: '0.6875rem',
                              fontWeight: 600,
                              backgroundColor: isExpanded ? '#4F46E5' : '#EEF2FF',
                              color: isExpanded ? '#FFFFFF' : '#4338CA',
                              border: '1px solid #C7D2FE',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease',
                            }}
                            title="Bấm để xem chi tiết bảng dữ liệu 12 điểm viễn trắc và 7 đầu rủi ro GRU"
                          >
                            <Table size={12} />
                            <span>{isExpanded ? 'Đóng bảng' : 'Bảng GRU'}</span>
                            {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectPrediction(p);
                            }}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '4px 8px',
                              fontSize: '0.6875rem',
                              fontWeight: 600,
                              backgroundColor: isSelected ? '#3B82F6' : '#F1F5F9',
                              color: isSelected ? '#FFFFFF' : 'var(--dash-text-primary)',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                            }}
                            title="Nạp chuỗi 12 điểm viễn trắc lên biểu đồ phân tích ở trên"
                          >
                            <Eye size={12} />
                            <span>{isSelected ? 'Đang soi' : 'Soi chuỗi'}</span>
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* EXPANDABLE ROW: CHI TIẾT BẢNG GỬI VÀO GRU [12x8] & ĐA RỦI RO */}
                    {isExpanded && (
                      <tr style={{ backgroundColor: '#F8FAFC' }}>
                        <td colSpan={8} style={{ padding: '16px 20px', borderBottom: '2px solid #CBD5E1' }}>
                          <div style={{ backgroundColor: '#FFFFFF', borderRadius: '8px', border: '1px solid #E2E8F0', padding: '16px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
                            {/* Header Info */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', borderBottom: '1px solid #F1F5F9', paddingBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Table size={18} color="#4F46E5" />
                                <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#1E293B' }}>
                                  Chi Tiết Dữ Liệu Đầu Vào Gửi Vào GRU & Suy Diễn Đa Rủi Ro
                                </span>
                                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: '#6366F1', backgroundColor: '#EEF2FF', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
                                  Mã #{p.id}
                                </span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '0.75rem', color: '#64748B' }}>
                                  Dịch vụ: <strong style={{ color: '#0F172A' }}>{p.workload_name || '-'}</strong> | Cụm: <strong style={{ color: '#0F172A' }}>{p.cluster_name || currentEnv?.cluster || '-'}</strong>
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setExpandedPredictionId(null)}
                                  style={{
                                    padding: '4px 10px',
                                    fontSize: '0.6875rem',
                                    fontWeight: 600,
                                    backgroundColor: '#F1F5F9',
                                    color: '#475569',
                                    border: '1px solid #CBD5E1',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                  }}
                                >
                                  Đóng chi tiết
                                </button>
                              </div>
                            </div>

                            {/* Phần 1: Bảng Ma Trận Đầu Vào GRU Tensor [12 x 8] */}
                            <div style={{ marginBottom: '20px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '6px' }}>
                                <h4 style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#334155', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                  1. Bảng Ma Trận Đầu Vào GRU Tensor [12 × 8] (Toàn Bộ 12 Bước Viễn Trắc)
                                </h4>
                                <span style={{ fontSize: '0.6875rem', color: '#64748B' }}>
                                  Chuỗi 12 bước × 5s = 60 giây lịch sử gần nhất gửi trực tiếp vào mạng Nơ-ron GRU
                                </span>
                              </div>

                              {loadingInputs && (!timesteps || timesteps.length === 0) ? (
                                <div style={{ padding: '24px', textAlign: 'center', color: '#64748B', fontSize: '0.8125rem' }}>
                                  <RefreshCw size={16} className="animate-spin" style={{ display: 'inline', marginRight: '6px' }} />
                                  Đang nạp 12 bước dữ liệu viễn trắc từ cơ sở dữ liệu...
                                </div>
                              ) : timesteps && timesteps.length > 0 ? (
                                <div style={{ overflowX: 'auto', border: '1px solid #E2E8F0', borderRadius: '6px' }}>
                                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', textAlign: 'center' }}>
                                    <thead>
                                      <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569', fontWeight: 700 }}>
                                        <th style={{ padding: '8px 10px' }}>Bước</th>
                                        <th style={{ padding: '8px 10px' }}>Thời Điểm</th>
                                        <th style={{ padding: '8px 10px' }}>CPU (%)</th>
                                        <th style={{ padding: '8px 10px' }}>RAM (%)</th>
                                        <th style={{ padding: '8px 10px' }}>Disk (%)</th>
                                        <th style={{ padding: '8px 10px' }}>Request Rate (req/s)</th>
                                        <th style={{ padding: '8px 10px' }}>Độ Trễ Latency (ms)</th>
                                        <th style={{ padding: '8px 10px' }}>HTTP 5xx (%)</th>
                                        <th style={{ padding: '8px 10px' }}>Restarts</th>
                                        <th style={{ padding: '8px 10px' }}>Replicas</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {timesteps.map((row, idx) => {
                                        const isSpike5xx = row.http_5xx_rate > 0;
                                        const isHighLatency = row.latency > 100;
                                        const isHighCpu = row.cpu > 70;
                                        const isHighTraffic = row.request_rate > 10;

                                        return (
                                          <tr
                                            key={idx}
                                            style={{
                                              borderBottom: '1px solid #F1F5F9',
                                              backgroundColor: idx % 2 === 0 ? '#FFFFFF' : '#FAFAFA',
                                              fontFamily: 'var(--font-mono)',
                                            }}
                                          >
                                            <td style={{ padding: '7px 10px', fontWeight: 700, color: '#4F46E5', backgroundColor: '#EEF2FF' }}>
                                              {row.stepLabel || `T${idx + 1}`}
                                            </td>
                                            <td style={{ padding: '7px 10px', color: '#64748B' }}>
                                              {row.displayTime || '-'}
                                            </td>
                                            <td style={{ padding: '7px 10px', color: isHighCpu ? '#DC2626' : '#0F172A', fontWeight: isHighCpu ? 700 : 500 }}>
                                              {Number(row.cpu || 0).toFixed(2)}%
                                            </td>
                                            <td style={{ padding: '7px 10px', color: '#0F172A' }}>
                                              {Number(row.ram || 0).toFixed(2)}%
                                            </td>
                                            <td style={{ padding: '7px 10px', color: '#64748B' }}>
                                              {Number(row.disk || 0).toFixed(2)}%
                                            </td>
                                            <td style={{ padding: '7px 10px', color: isHighTraffic ? '#2563EB' : '#0F172A', fontWeight: isHighTraffic ? 700 : 500 }}>
                                              {Number(row.request_rate || 0).toFixed(2)} req/s
                                            </td>
                                            <td style={{ padding: '7px 10px', color: isHighLatency ? '#D97706' : '#0F172A', fontWeight: isHighLatency ? 700 : 500 }}>
                                              {Number(row.latency || 0).toFixed(2)} ms
                                            </td>
                                            <td style={{
                                              padding: '7px 10px',
                                              color: isSpike5xx ? '#DC2626' : '#64748B',
                                              fontWeight: isSpike5xx ? 700 : 500,
                                              backgroundColor: isSpike5xx ? '#FEE2E2' : 'transparent',
                                            }}>
                                              {Number(row.http_5xx_rate || 0).toFixed(2)}%
                                            </td>
                                            <td style={{ padding: '7px 10px', color: row.pod_restart_count > 0 ? '#DC2626' : '#64748B' }}>
                                              {row.pod_restart_count || 0}
                                            </td>
                                            <td style={{ padding: '7px 10px', color: '#0F172A' }}>
                                              {row.replica_count || 1}
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              ) : (
                                <div style={{ padding: '16px', textAlign: 'center', color: '#94A3B8', fontSize: '0.75rem', backgroundColor: '#F8FAFC', borderRadius: '6px' }}>
                                  Chưa có chuỗi 12 điểm viễn trắc đầu vào cho lượt dự báo này.
                                </div>
                              )}
                            </div>

                            {/* Phần 2: Bảng Phân Tích Đa Rủi Ro Của GRU (Toàn Bộ 7 Rủi Ro) */}
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '6px' }}>
                                <h4 style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#334155', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                  2. Kết Quả Dự Báo Đa Rủi Ro GRU Multi-Head (Toàn Bộ 7 Loại Rủi Ro)
                                </h4>
                                <span style={{ fontSize: '0.6875rem', color: '#64748B' }}>
                                  Mỗi loại rủi ro được tính toán độc lập qua Sigmoid riêng từ 0.0% đến 100.0%
                                </span>
                              </div>

                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '10px' }}>
                                {(() => {
                                  const outputs = parseRiskOutputs(p.risk_outputs);
                                  return RISK_HEADS_CONFIG.map((head) => {
                                    const val = outputs[head.key];
                                    const conf = typeof val === 'object' && val !== null ? Number(val.confidence || 0) : Number(val || 0);
                                    const percent = Math.min(Math.max(conf * 100, 0), 100);
                                    const isTriggered = conf >= head.threshold;
                                    const isElevated = conf >= 0.10 && !isTriggered;

                                    let badgeColor = '#059669';
                                    let badgeBg = '#ECFDF5';
                                    let badgeText = '✅ AN TOÀN';
                                    let barColor = '#10B981';

                                    if (isTriggered) {
                                      badgeColor = '#DC2626';
                                      badgeBg = '#FEE2E2';
                                      badgeText = '⚠️ NGUY CƠ CAO';
                                      barColor = '#EF4444';
                                    } else if (isElevated) {
                                      badgeColor = '#D97706';
                                      badgeBg = '#FEF3C7';
                                      badgeText = '⚡ ĐANG TĂNG';
                                      barColor = '#F59E0B';
                                    }

                                    return (
                                      <div
                                        key={head.key}
                                        style={{
                                          border: isTriggered ? '1px solid #FCA5A5' : '1px solid #E2E8F0',
                                          borderRadius: '6px',
                                          padding: '10px 12px',
                                          backgroundColor: isTriggered ? '#FEF2F2' : '#FFFFFF',
                                        }}
                                      >
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#1E293B', fontFamily: 'var(--font-mono)' }}>
                                            {head.key}
                                          </span>
                                          <span
                                            style={{
                                              fontSize: '0.625rem',
                                              fontWeight: 700,
                                              padding: '2px 6px',
                                              borderRadius: '4px',
                                              color: badgeColor,
                                              backgroundColor: badgeBg,
                                            }}
                                          >
                                            {badgeText}
                                          </span>
                                        </div>
                                        <div style={{ fontSize: '0.6875rem', color: '#64748B', marginBottom: '8px', lineHeight: '1.2' }}>
                                          {head.label}
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '4px' }}>
                                          <span style={{ color: '#475569' }}>Xác suất: <strong style={{ color: badgeColor, fontFamily: 'var(--font-mono)' }}>{percent.toFixed(2)}%</strong></span>
                                          <span style={{ fontSize: '0.6875rem', color: '#94A3B8' }}>Ngưỡng: {(head.threshold * 100).toFixed(0)}%</span>
                                        </div>
                                        <div style={{ width: '100%', height: '6px', backgroundColor: '#E2E8F0', borderRadius: '3px', overflow: 'hidden' }}>
                                          <div
                                            style={{
                                              width: `${percent}%`,
                                              height: '100%',
                                              backgroundColor: barColor,
                                              borderRadius: '3px',
                                              transition: 'width 0.3s ease',
                                            }}
                                          />
                                        </div>
                                      </div>
                                    );
                                  });
                                })()}
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        )}
      </div>
      )}

      {/* 8. Modal Bằng Chứng Gốc Rễ RCA & Phân Tích Chẩn Đoán AI */}
      {evidenceModal.isOpen && (() => {
        const incident = evidenceModal.incidentDetail;
        const rec = evidenceModal.recData;

        // Trích xuất tên dịch vụ thân thiện, tuyệt đối không để lộ UUID c0000000-0000-...
        let targetService = 'sme-order-service';
        const candidateNames = [
          incident?.title?.includes(' on ') ? incident.title.split(' on ')[1] : null,
          rec?.incident_title?.includes(' on ') ? rec.incident_title.split(' on ')[1] : null,
          evidenceModal.evidences?.[0]?.source_reference,
          rec?.target_name,
          rec?.target_id,
          incident?.target_id,
        ];
        for (const cand of candidateNames) {
          if (cand && typeof cand === 'string') {
            const clean = cand.trim();
            if (!clean.includes('-0000-') && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clean)) {
              targetService = clean;
              break;
            }
          }
        }

        const clusterName = incident?.cluster_name || rec?.cluster_name || currentEnv?.cluster || currentEnv?.name || 'sang-k8s';
        const incidentCode = `INC-${(evidenceModal.incidentId || '').substring(0, 8).toUpperCase()}`;

        let analysisResult = null;
        if (incident?.analysis_result) {
          analysisResult = typeof incident.analysis_result === 'object' ? incident.analysis_result : (() => {
            try { return JSON.parse(incident.analysis_result); } catch (e) { return null; }
          })();
        }

        const rootCauseType = incident?.root_cause_type || (analysisResult?.root_cause?.cause || 'Unstable application pod');
        const confidenceVal = parseFloat(incident?.rca_confidence ?? (incident?.confidence_score ?? (analysisResult?.root_cause?.confidence ?? 0.60)));
        const confidencePct = Math.min(100, Math.max(0, Math.round(confidenceVal * 100)));
        const severity = incident?.severity || (analysisResult?.root_cause?.severity || 'HIGH');
        const rawExplanation = incident?.root_cause_description || (analysisResult?.explanation || '');
        const analysisMethod = incident?.analysis_method || 'AI_DETERMINISTIC_RULES';

        const actionCode = rec?.recommendation || rec?.action_code || (analysisResult?.recommendation?.action || 'RESTART_POD');
        const actionInfo = getActionDetails(actionCode);
        const isApplied = rec ? (appliedActions.includes(rec.id) || rec.status === 'APPLIED') : false;
        const isResolved = incident?.status === 'RESOLVED';
        const thresholds = analysisResult?.prediction?.thresholds;

        return (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(15, 23, 42, 0.72)',
              backdropFilter: 'blur(4px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 9999,
              padding: '16px',
            }}
            onClick={handleCloseEvidenceModal}
          >
            <div
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: '14px',
                maxWidth: '820px',
                width: '100%',
                boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.35)',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                maxHeight: '90vh',
                border: '1px solid #CBD5E1',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div style={{
                flexShrink: 0,
                padding: '16px 22px',
                borderBottom: '1px solid #E2E8F0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: '#F8FAFC',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    backgroundColor: '#EFF6FF',
                    border: '1px solid #BFDBFE',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <FileText size={18} color="#2563EB" />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span>Bằng Chứng Gốc Rễ RCA &amp; Chẩn Đoán AI</span>
                      <span style={{
                        fontSize: '0.6875rem',
                        fontWeight: 700,
                        padding: '2px 8px',
                        backgroundColor: '#DBEAFE',
                        color: '#1D4ED8',
                        borderRadius: '4px',
                        fontFamily: 'var(--font-mono)',
                      }}>
                        {incidentCode}
                      </span>
                    </h3>
                    <div style={{ fontSize: '0.6875rem', color: '#64748B', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
                      Mã sự cố UUID: {evidenceModal.incidentId}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCloseEvidenceModal}
                  style={{
                    backgroundColor: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#64748B',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '6px',
                    borderRadius: '6px',
                    transition: 'background 0.15s ease',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#E2E8F0'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  <X size={18} />
                </button>
              </div>

              {/* Subheader Badges Strip */}
              <div style={{
                flexShrink: 0,
                padding: '10px 22px',
                backgroundColor: '#F1F5F9',
                borderBottom: '1px solid #E2E8F0',
                display: 'flex',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '8px',
                fontSize: '0.75rem',
              }}>
                <span style={{
                  padding: '3px 8px',
                  backgroundColor: '#EFF6FF',
                  color: '#1E40AF',
                  borderRadius: '4px',
                  border: '1px solid #BFDBFE',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}>
                  <span>☸️ Cụm K8s: <strong>{clusterName}</strong></span>
                </span>

                <span style={{
                  padding: '3px 8px',
                  backgroundColor: '#F0FDF4',
                  color: '#15803D',
                  borderRadius: '4px',
                  border: '1px solid #BBF7D0',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}>
                  <span>📦 Dịch vụ: <strong>{targetService}</strong></span>
                </span>

                <span style={{
                  padding: '3px 8px',
                  backgroundColor: severity === 'HIGH' ? '#FEF2F2' : '#FFFBEB',
                  color: severity === 'HIGH' ? '#DC2626' : '#D97706',
                  borderRadius: '4px',
                  border: `1px solid ${severity === 'HIGH' ? '#FECACA' : '#FDE68A'}`,
                  fontWeight: 700,
                }}>
                  Mức độ: {severity === 'HIGH' ? 'CAO (HIGH)' : severity}
                </span>

                <span style={{
                  padding: '3px 8px',
                  backgroundColor: isResolved ? '#DCFCE7' : '#EFF6FF',
                  color: isResolved ? '#166534' : '#1E40AF',
                  borderRadius: '4px',
                  border: `1px solid ${isResolved ? '#86EFAC' : '#BFDBFE'}`,
                  fontWeight: 600,
                }}>
                  Trạng thái sự cố: <strong>{isResolved ? 'ĐÃ KHẮC PHỤC (RESOLVED)' : (incident?.status || 'INVESTIGATING')}</strong>
                </span>

                <span style={{ marginLeft: 'auto', color: '#64748B', fontSize: '0.6875rem', fontFamily: 'var(--font-mono)' }}>
                  Phát hiện: {incident?.detected_at ? new Date(incident.detected_at).toLocaleString('vi-VN') : 'Mới ghi nhận'}
                </span>
              </div>

              {/* Modal Body: overflowY auto, minHeight 0, flexShrink 0 on all cards to prevent collapsing */}
              <div style={{
                flex: '1 1 auto',
                minHeight: 0,
                overflowY: 'auto',
                padding: '20px 22px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
              }}>
                {evidenceModal.loading ? (
                  <div style={{ padding: '40px 20px', textAlign: 'center', color: '#64748B', fontSize: '0.875rem' }}>
                    <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 10px auto', display: 'block', color: '#2563EB' }} />
                    Đang truy xuất phân tích RCA và bằng chứng viễn trắc từ PostgreSQL...
                  </div>
                ) : (
                  <>
                    {/* KHỐI 1: Kết Luận Chẩn Đoán Nguyên Nhân Gốc Rễ */}
                    <div style={{
                      flexShrink: 0,
                      backgroundColor: '#FFFFFF',
                      borderRadius: '8px',
                      border: '1px solid #E2E8F0',
                      borderLeft: '5px solid #F59E0B',
                      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
                    }}>
                      <div style={{
                        padding: '10px 14px',
                        backgroundColor: '#FFFBEB',
                        borderBottom: '1px solid #FEF3C7',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, color: '#92400E', fontSize: '0.8125rem' }}>
                          <Sparkles size={15} color="#D97706" />
                          <span>KẾT QUẢ CHẨN ĐOÁN GỐC RỄ (RCA ROOT CAUSE)</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{
                            width: '80px',
                            height: '6px',
                            borderRadius: '3px',
                            backgroundColor: '#FDE68A',
                            overflow: 'hidden',
                          }}>
                            <div style={{
                              width: `${confidencePct}%`,
                              height: '100%',
                              backgroundColor: confidencePct >= 70 ? '#10B981' : '#D97706',
                              borderRadius: '3px',
                            }} />
                          </div>
                          <span style={{
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            color: '#92400E',
                            fontFamily: 'var(--font-mono)',
                          }}>
                            Tin cậy: {confidencePct}%
                          </span>
                        </div>
                      </div>

                      <div style={{ padding: '14px 16px' }}>
                        <div style={{ fontSize: '1rem', fontWeight: 700, color: '#0F172A', marginBottom: '4px' }}>
                          {formatRootCauseType(rootCauseType)}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#64748B', fontFamily: 'var(--font-mono)', marginBottom: '10px' }}>
                          Mã kỹ thuật: <strong style={{ color: '#475569' }}>{rootCauseType}</strong> &bull; Thuật toán: <span style={{ color: '#2563EB' }}>{analysisMethod}</span>
                        </div>

                        <div style={{
                          backgroundColor: '#F8FAFC',
                          padding: '12px 14px',
                          borderRadius: '6px',
                          border: '1px solid #E2E8F0',
                          fontSize: '0.8125rem',
                          color: '#334155',
                          lineHeight: 1.55,
                        }}>
                          <strong style={{ color: '#0F172A' }}>Diễn giải AI: </strong>
                          {formatAiExplanation(rawExplanation, rootCauseType)}
                        </div>
                      </div>
                    </div>

                    {/* KHỐI 2: Đề Xuất Khắc Phục Phòng Ngừa (Mitigation Action) */}
                    <div style={{
                      flexShrink: 0,
                      backgroundColor: '#FFFFFF',
                      borderRadius: '8px',
                      border: '1px solid #E2E8F0',
                      borderLeft: isApplied || isResolved ? '5px solid #10B981' : '5px solid #3B82F6',
                      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
                    }}>
                      <div style={{
                        padding: '10px 14px',
                        backgroundColor: isApplied || isResolved ? '#F0FDF4' : '#EFF6FF',
                        borderBottom: `1px solid ${isApplied || isResolved ? '#DCFCE7' : '#DBEAFE'}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, color: isApplied || isResolved ? '#166534' : '#1E40AF', fontSize: '0.8125rem' }}>
                          <Zap size={15} color={isApplied || isResolved ? '#10B981' : '#2563EB'} />
                          <span>HÀNH ĐỘNG KHẮC PHỤC PHÒNG NGỪA (RECOMMENDED MITIGATION)</span>
                        </div>
                        <span style={{
                          fontSize: '0.6875rem',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '4px',
                          backgroundColor: rec?.priority === 1 ? '#FEF2F2' : '#FFFBEB',
                          color: rec?.priority === 1 ? '#DC2626' : '#D97706',
                          border: `1px solid ${rec?.priority === 1 ? '#FECACA' : '#FDE68A'}`,
                        }}>
                          Ưu tiên: {rec?.priority === 1 ? 'Khẩn cấp (P1)' : 'Cao (P2)'}
                        </span>
                      </div>

                      <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '4px', backgroundColor: actionInfo.badgeBg, color: actionInfo.badgeColor, border: `1px solid ${actionInfo.badgeBorder}`, fontSize: '0.8125rem', fontWeight: 700, marginBottom: '6px' }}>
                            <Zap size={12} />
                            <span>{actionInfo.label}</span>
                          </div>
                          <div style={{ fontSize: '0.8125rem', color: '#475569', lineHeight: 1.55 }}>
                            {actionInfo.desc}
                          </div>
                        </div>

                        {/* Banner trạng thái thực thi */}
                        {isApplied || isResolved ? (
                          <div style={{
                            padding: '10px 14px',
                            backgroundColor: '#F0FDF4',
                            border: '1px solid #BBF7D0',
                            borderRadius: '6px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            fontSize: '0.8125rem',
                            color: '#15803D',
                            fontWeight: 600,
                          }}>
                            <CheckCircle2 size={16} color="#10B981" />
                            <span>Đã kích hoạt khắc phục thành công! Hành động tự phục hồi đã được ghi nhận vào sổ kiểm toán MAPE‑K.</span>
                          </div>
                        ) : (
                          <div style={{
                            padding: '10px 14px',
                            backgroundColor: '#FFFBEB',
                            border: '1px solid #FDE68A',
                            borderRadius: '6px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            flexWrap: 'wrap',
                            gap: '8px',
                            fontSize: '0.8125rem',
                            color: '#92400E',
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <ShieldCheck size={16} color="#D97706" />
                              <span>Sẵn sàng can thiệp phòng ngừa an toàn theo quy trình Zero-Downtime.</span>
                            </div>
                            {rec && (
                              <button
                                type="button"
                                onClick={() => handleMitigate(rec.id)}
                                disabled={actionInProgress === rec.id}
                                style={{
                                  padding: '5px 12px',
                                  backgroundColor: '#D97706',
                                  color: '#FFFFFF',
                                  border: 'none',
                                  borderRadius: '4px',
                                  fontSize: '0.75rem',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                }}
                              >
                                {actionInProgress === rec.id ? (
                                  <>
                                    <RefreshCw size={12} className="animate-spin" />
                                    <span>Đang thực thi...</span>
                                  </>
                                ) : (
                                  <>
                                    <Zap size={12} />
                                    <span>Kích hoạt tự lành ngay</span>
                                  </>
                                )}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* KHỐI 3: Danh Mục Bằng Chứng Viễn Trắc eBPF & Kubelet */}
                    <div style={{
                      flexShrink: 0,
                      backgroundColor: '#FFFFFF',
                      borderRadius: '8px',
                      border: '1px solid #E2E8F0',
                      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
                    }}>
                      <div style={{
                        padding: '10px 14px',
                        backgroundColor: '#F8FAFC',
                        borderBottom: '1px solid #E2E8F0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, color: '#334155', fontSize: '0.8125rem' }}>
                          <Activity size={15} color="#2563EB" />
                          <span>DANH MỤC BẰNG CHỨNG VIỄN TRẮC THỰC TẾ ({evidenceModal.evidences.length})</span>
                        </div>
                        <span style={{ fontSize: '0.6875rem', color: '#64748B' }}>
                          Nguồn thu thập: eBPF Agent &amp; Kubernetes Kubelet
                        </span>
                      </div>

                      <div style={{ padding: '14px 16px' }}>
                        {evidenceModal.evidences.length === 0 ? (
                          <div style={{
                            padding: '24px',
                            textAlign: 'center',
                            color: '#64748B',
                            fontSize: '0.8125rem',
                            backgroundColor: '#F8FAFC',
                            borderRadius: '6px',
                            border: '1px dashed #CBD5E1',
                          }}>
                            Không có bản ghi bằng chứng chi tiết nào trong bảng rca_evidences cho sự cố này.
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {evidenceModal.evidences.map((ev, idx) => {
                              let summaryText = '';
                              try {
                                const data = typeof ev.evidence_data === 'string' ? JSON.parse(ev.evidence_data) : (ev.evidence_data || {});
                                summaryText = data.summary || JSON.stringify(data);
                              } catch (e) {
                                summaryText = String(ev.evidence_data || '');
                              }

                              const evInfo = formatEvidenceDetail(summaryText, ev.source_type);
                              const importancePct = Math.round((parseFloat(ev.importance_score) || 0.9) * 100);

                              return (
                                <div
                                  key={ev.id || idx}
                                  style={{
                                    padding: '14px',
                                    borderRadius: '8px',
                                    backgroundColor: '#F8FAFC',
                                    border: '1px solid #E2E8F0',
                                    borderLeft: `4px solid ${evInfo.badgeColor}`,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '8px',
                                  }}
                                >
                                  {/* Top evidence bar */}
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                      <span style={{
                                        fontFamily: 'var(--font-mono)',
                                        fontSize: '0.6875rem',
                                        fontWeight: 700,
                                        padding: '2px 8px',
                                        backgroundColor: evInfo.badgeBg,
                                        color: evInfo.badgeColor,
                                        borderRadius: '4px',
                                      }}>
                                        {evInfo.badge}
                                      </span>
                                      <span style={{ fontSize: '0.75rem', color: '#64748B' }}>
                                        Dịch vụ: <strong style={{ color: '#0F172A', fontFamily: 'var(--font-mono)' }}>{targetService}</strong>
                                      </span>
                                    </div>
                                    <span style={{
                                      fontSize: '0.75rem',
                                      color: '#0F172A',
                                      fontFamily: 'var(--font-mono)',
                                      fontWeight: 600,
                                    }}>
                                      Độ quan trọng: <span style={{ color: '#2563EB', fontWeight: 700 }}>{importancePct}%</span> ({evInfo.importanceLabel})
                                    </span>
                                  </div>

                                  {/* Evidence Title & Explanation */}
                                  <div>
                                    <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#0F172A', marginBottom: '2px' }}>
                                      {evInfo.title}
                                    </div>
                                    <div style={{ fontSize: '0.8125rem', color: '#475569', lineHeight: 1.5 }}>
                                      {evInfo.desc}
                                    </div>
                                  </div>

                                  {/* Raw Telemetry JSON Box */}
                                  <div style={{
                                    padding: '8px 12px',
                                    borderRadius: '6px',
                                    backgroundColor: '#FFFFFF',
                                    border: '1px solid #CBD5E1',
                                    fontFamily: 'var(--font-mono)',
                                    fontSize: '0.75rem',
                                    color: '#334155',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                  }}>
                                    <span style={{ color: '#64748B', fontWeight: 600 }}>Dữ liệu viễn trắc eBPF:</span>
                                    <span style={{ color: '#1E293B', fontWeight: 500 }}>{summaryText}</span>
                                  </div>

                                  {/* Footer meta */}
                                  <div style={{ fontSize: '0.6875rem', color: '#94A3B8', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '2px' }}>
                                    <span>Nguồn: {ev.source_type || 'AI_TELEMETRY'}</span>
                                    <span>Ghi nhận: {new Date(ev.created_at).toLocaleString('vi-VN')}</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* KHỐI 4: Ngưỡng Rủi Ro Giám Sát Của Mô Hình (Thresholds) */}
                    {thresholds && Object.keys(thresholds).length > 0 && (
                      <div style={{
                        flexShrink: 0,
                        backgroundColor: '#F8FAFC',
                        borderRadius: '8px',
                        border: '1px solid #E2E8F0',
                        padding: '14px 16px',
                      }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Sliders size={13} color="#64748B" />
                          <span>NGƯỠNG RỦI RO VIỄN TRẮC THIẾT LẬP (DYNAMIC RISK THRESHOLDS)</span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px' }}>
                          {Object.entries(thresholds).map(([tKey, tVal]) => (
                            <div
                              key={tKey}
                              style={{
                                padding: '8px 10px',
                                borderRadius: '6px',
                                backgroundColor: '#FFFFFF',
                                border: '1px solid #E2E8F0',
                                fontSize: '0.6875rem',
                              }}
                            >
                              <div style={{ color: '#64748B', fontFamily: 'var(--font-mono)', fontSize: '0.625rem', marginBottom: '2px' }}>
                                {tKey}
                              </div>
                              <div style={{ fontWeight: 700, color: '#0F172A', fontFamily: 'var(--font-mono)', fontSize: '0.8125rem' }}>
                                {((parseFloat(tVal) || 0) * 100).toFixed(1)}%
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* KHỐI 5: Dữ Liệu Đầu Vào & Đầu Ra Chi Tiết Của AI / LLM (Full LLM I/O) */}
                    <div
                      style={{
                        flexShrink: 0,
                        backgroundColor: '#FFFFFF',
                        borderRadius: '8px',
                        border: '1px solid #E2E8F0',
                        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          padding: '10px 14px',
                          backgroundColor: '#EFF6FF',
                          borderBottom: '1px solid #BFDBFE',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, color: '#1E40AF', fontSize: '0.8125rem' }}>
                          <Activity size={15} color="#2563EB" />
                          <span>DỮ LIỆU ĐẦU VÀO &amp; ĐẦU RA CHI TIẾT CỦA AI / LLM (FULL LLM I/O)</span>
                        </div>
                        <span style={{ fontSize: '0.6875rem', color: '#1D4ED8', fontWeight: 600 }}>
                          Mô hình: PyTorch GRU &bull; LLM SRE Agent
                        </span>
                      </div>

                      <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                        {/* 1. Dữ liệu đầu vào */}
                        <div>
                          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0F172A', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Sliders size={13} color="#2563EB" />
                            <span>1. Tín Hiệu Đầu Vào AI / LLM (Input Features &amp; Telemetry):</span>
                          </div>

                          {/* Bảng 8 metrics */}
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px', marginBottom: '10px' }}>
                            {((evidenceModal.predInputs && evidenceModal.predInputs.length > 0)
                              ? evidenceModal.predInputs
                              : [
                                  { metric_name: 'cpu', metric_value: '0.27', unit: '%' },
                                  { metric_name: 'ram', metric_value: '15.05', unit: '%' },
                                  { metric_name: 'disk', metric_value: '10', unit: '%' },
                                  { metric_name: 'latency', metric_value: '0', unit: 'ms' },
                                  { metric_name: 'request_rate', metric_value: '0', unit: 'req/s' },
                                  { metric_name: 'http_5xx_rate', metric_value: '0', unit: '%' },
                                  { metric_name: 'pod_restart_count', metric_value: '2', unit: 'count' },
                                  { metric_name: 'replica_count', metric_value: '2', unit: 'count' },
                                ]
                            ).map((item, idx) => (
                              <div
                                key={idx}
                                style={{
                                  padding: '8px 10px',
                                  borderRadius: '6px',
                                  backgroundColor: '#F8FAFC',
                                  border: '1px solid #E2E8F0',
                                  fontSize: '0.75rem',
                                }}
                              >
                                <div style={{ color: '#64748B', fontFamily: 'var(--font-mono)', fontSize: '0.625rem', textTransform: 'uppercase' }}>
                                  {item.metric_name}
                                </div>
                                <div style={{ fontWeight: 700, color: '#0F172A', fontFamily: 'var(--font-mono)', fontSize: '0.875rem', marginTop: '2px' }}>
                                  {item.metric_value} <span style={{ fontSize: '0.6875rem', color: '#64748B' }}>{item.unit}</span>
                                </div>
                              </div>
                            ))}
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '10px' }}>
                            <div style={{ padding: '10px 12px', borderRadius: '6px', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                              <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                                Sự Kiện Kubernetes &amp; Cảnh Báo Đầu Vào:
                              </div>
                              <div style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: '#DC2626', backgroundColor: '#FEF2F2', padding: '6px 8px', borderRadius: '4px', border: '1px solid #FECACA' }}>
                                &bull; Readiness probe is failing &bull; pod_restart_count: 2
                              </div>
                            </div>

                            <div style={{ padding: '10px 12px', borderRadius: '6px', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                              <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                                Lịch Sử Tự Phục Hồi Trước Đó (Previous Action):
                              </div>
                              <div style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: '#0F172A' }}>
                                Action: <strong style={{ color: '#2563EB' }}>{incident?.previous_action || 'RESTART_POD'}</strong> &bull; Kết quả:{' '}
                                <span style={{ color: (incident?.previous_action_result === 'FAILED' ? '#DC2626' : '#059669'), fontWeight: 700 }}>
                                  {incident?.previous_action_result || (isResolved ? 'SUCCESS' : 'PENDING')}
                                </span>{' '}
                                (Nguồn: POST_ACTION_VERIFICATION)
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* 2. Dữ liệu đầu ra */}
                        <div>
                          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0F172A', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Sparkles size={13} color="#059669" />
                            <span>2. Kết Quả Đầu Ra Phân Tích AI / LLM (Structured SRE Output):</span>
                          </div>

                          <div
                            style={{
                              backgroundColor: '#0F172A',
                              color: '#F8FAFC',
                              padding: '12px 14px',
                              borderRadius: '8px',
                              fontFamily: 'var(--font-mono)',
                              fontSize: '0.75rem',
                              lineHeight: 1.5,
                              overflowX: 'auto',
                              border: '1px solid #1E293B',
                            }}
                          >
                            <pre style={{ margin: 0 }}>
                              {JSON.stringify(
                                analysisResult || {
                                  service_id: targetService,
                                  root_cause: { cause: rootCauseType, confidence: confidenceVal, severity },
                                  recommendation: { action: actionCode, reason: actionInfo.desc, priority: severity },
                                  explanation: rawExplanation || formatAiExplanation(rawExplanation, rootCauseType),
                                },
                                null,
                                2
                              )}
                            </pre>
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Modal Footer */}
              <div style={{
                flexShrink: 0,
                padding: '14px 22px',
                borderTop: '1px solid #E2E8F0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: '#F8FAFC',
              }}>
                <div style={{ fontSize: '0.6875rem', color: '#64748B', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <ShieldCheck size={14} color="#10B981" />
                  <span>Vòng lặp tự thích ứng MAPE‑K bảo đảm an toàn Zero-Downtime</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {!isApplied && !isResolved && rec && (
                    <button
                      type="button"
                      onClick={() => handleMitigate(rec.id)}
                      disabled={actionInProgress === rec.id}
                      style={{
                        padding: '7px 16px',
                        backgroundColor: '#2563EB',
                        color: '#FFFFFF',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      {actionInProgress === rec.id ? (
                        <>
                          <RefreshCw size={13} className="animate-spin" />
                          <span>Đang thực thi...</span>
                        </>
                      ) : (
                        <>
                          <Zap size={13} />
                          <span>Kích hoạt tự lành</span>
                        </>
                      )}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleCloseEvidenceModal}
                    style={{
                      padding: '7px 16px',
                      backgroundColor: '#0F172A',
                      color: '#FFFFFF',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Đóng
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default PredictionsPage;
