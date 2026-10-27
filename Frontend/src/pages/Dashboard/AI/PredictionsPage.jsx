import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useDashboard } from '../context/DashboardContext';
import { aiService } from '../../../services/aiService';
import { telemetryService } from '../../../services/telemetryService';
import RootCauseModal from '../Incidents/RootCauseModal';
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
  Box,
  Copy,
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
    case 'NO_ACTION':
      return {
        label: 'Tự động an toàn (NO_ACTION)',
        desc: 'Hệ thống viễn trắc nằm trong ngưỡng an toàn tự thích ứng. Quyết định tự động: Không can thiệp để bảo toàn Zero-Downtime.',
        badgeBg: '#ECFDF5',
        badgeColor: '#047857',
        badgeBorder: '#A7F3D0',
      };
    case 'REPLACE_POD':
      return {
        label: 'Thu hồi & Thay thế Pod (REPLACE_POD)',
        desc: 'Thu hồi Pod gặp sự cố và khởi tạo Pod thay thế mới đảm bảo Pod Anti-Affinity và tính sẵn sàng.',
        badgeBg: '#EFF6FF',
        badgeColor: '#1D4ED8',
        badgeBorder: '#BFDBFE',
      };
    case 'CLEANUP_STORAGE':
      return {
        label: 'Dọn dẹp bộ nhớ đệm / Logs (CLEANUP_STORAGE)',
        desc: 'Giải phóng dung lượng bộ nhớ đệm, tệp nhật ký tạm thời và dọn dẹp các volume đĩa đang đầy.',
        badgeBg: '#FEF3C7',
        badgeColor: '#B45309',
        badgeBorder: '#FDE68A',
      };
    case 'TEMPORARY_IP_BLOCK':
      return {
        label: 'Chặn IP tạm thời (TEMPORARY_IP_BLOCK)',
        desc: 'Kích hoạt NetworkPolicy hoặc WAF để chặn các dải địa chỉ IP bất thường gây quá tải truy cập.',
        badgeBg: '#FEF2F2',
        badgeColor: '#B91C1C',
        badgeBorder: '#FECACA',
      };
    case 'RESTART_DEPLOYMENT':
      return {
        label: 'Khởi động lại Deployment (RESTART_DEPLOYMENT)',
        desc: 'Kích hoạt rollout restart cho toàn bộ Deployment để làm mới trạng thái phiên bản dịch vụ.',
        badgeBg: '#EFF6FF',
        badgeColor: '#1D4ED8',
        badgeBorder: '#BFDBFE',
      };
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
  if (raw === 'Khuyến nghị: NO_ACTION' || raw === 'NO_ACTION' || (typeof raw === 'string' && raw.includes('NO_ACTION')) || (typeof raw === 'string' && raw.includes('No safe infrastructure action is justified')) || (typeof raw === 'string' && raw.includes('No action is needed'))) {
    return 'Hệ thống viễn trắc nằm trong ngưỡng an toàn tự thích ứng. Tự động xác định: Chưa cần can thiệp hạ tầng.';
  }
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

export const normalizeServiceName = (val) => {
  if (!val) return '';
  const str = String(val).trim();
  // Map specific legacy seed UUIDs to actual database workload names if a UUID was passed
  if (str === 'd9d4f68b-ffd5-4d44-8de2-980fcd6087d7') return 'selfheal-test-app';
  if (
    str === 'c0000000-0000-0000-0000-000000000001' ||
    str === 'c0000000-0000-0000-0000-000000000002' ||
    str === '6341454b-b372-479f-8eac-e0b39ad715e1' ||
    str === '446f1224-4c37-4a4c-89d3-611dc51a5cc9'
  ) return 'sme-order-service';
  if (str === 'fafbe6bc-d295-4f3b-aaa7-e5d3a3a16d2e' || str === '899b0ff5-c316-4ac3-9115-c802ad0bba7d') return 'chaos-testagent2';
  if (str === '19765456-dfdd-4d87-b32a-67d3e7be74c1' || str === '8a1c09b8-0dda-4777-9a6f-7a7a723a7197') return 'ecommerce-store-app';
  if (str === '6c8b57e0-6503-4249-802a-84e8751c01b9' || str === '58151d7d-b1fe-42cc-80de-594457c19c70') return 'attack-injector-app';

  // If raw UUID without mapping, drop it
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str)) {
    return '';
  }
  // Otherwise return the real service name as-is
  return str;
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
  const [registeredWorkloads, setRegisteredWorkloads] = useState([]);
  const [selectedPrediction, setSelectedPrediction] = useState(null);
  const [gruModal, setGruModal] = useState({ isOpen: false, prediction: null, inputs: [], loading: false });
  const [predictionInputs, setPredictionInputs] = useState([]);
  const [loadingInputs, setLoadingInputs] = useState(false);

  // Danh sách các dịch vụ hợp lệ của Cụm hiện tại (tải động từ telemetry & Backend)
  const availableWorkloads = useMemo(() => {
    if (!isAgentConnected) return [];
    const set = new Set();
    if (Array.isArray(registeredWorkloads)) {
      registeredWorkloads.forEach((w) => {
        const name = normalizeServiceName(w);
        if (name && name !== '-' && name !== 'undefined' && name !== 'selfheal-agent' && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(name)) {
          set.add(name);
        }
      });
    }
    predictions.forEach((p) => {
      const name = normalizeServiceName(p.workload_name || p.service_id);
      if (name && name !== '-' && name !== 'undefined' && name !== 'selfheal-agent' && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(name)) set.add(name);
    });
    recommendations.forEach((r) => {
      const name = normalizeServiceName(
        r.target_name || r.target_id || (r.incident_title?.includes(' on ') ? r.incident_title.split(' on ')[1] : null)
      );
      if (name && name !== '-' && name !== 'undefined' && name !== 'selfheal-agent' && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(name)) set.add(name);
    });
    healingActions.forEach((a) => {
      const name = normalizeServiceName(a.target_name || a.target_id);
      if (name && name !== '-' && name !== 'undefined' && name !== 'selfheal-agent' && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(name)) set.add(name);
    });
    return Array.from(set).filter(Boolean);
  }, [isAgentConnected, registeredWorkloads, predictions, recommendations, healingActions]);

  // Trạng thái thao tác & WebSocket realtime
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [isWsLive, setIsWsLive] = useState(false);
  const [appliedActions, setAppliedActions] = useState([]);
  const [actionInProgress, setActionInProgress] = useState(null);
  const [noticeMessage, setNoticeMessage] = useState(null);
  const [activeStep, setActiveStep] = useState(1);
  const [batchProgress, setBatchProgress] = useState(null);
  const [batchProgressMap, setBatchProgressMap] = useState({});
  const [pinnedService, setPinnedService] = useState('');
  const pinnedServiceRef = useRef('');
  const [serviceInputsMap, setServiceInputsMap] = useState({});
  const [servicePredictionMap, setServicePredictionMap] = useState({});
  const [serviceStepMap, setServiceStepMap] = useState({});
  const [activeBottomTab, setActiveBottomTab] = useState('recommendations'); // 'recommendations' | 'healing_actions' | 'predictions'
  const [bottomServiceFilter, setBottomServiceFilter] = useState('ALL');
  const [expandedPlaybooks, setExpandedPlaybooks] = useState({});
  const [copiedPlaybookId, setCopiedPlaybookId] = useState(null);

  const togglePlaybook = (id) => {
    setExpandedPlaybooks((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCopyPlaybook = (id, text) => {
    navigator.clipboard?.writeText(text);
    setCopiedPlaybookId(id);
    setTimeout(() => setCopiedPlaybookId(null), 2000);
  };

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
  const [selectedWorkload, setSelectedWorkload] = useState('ALL');
  const selectedWorkloadRef = useRef('ALL');
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

    const targetService = wl !== 'ALL' ? wl : (pinnedServiceRef.current || availableWorkloads[0] || '');
    if (targetService) {
      const hasLiveInputs =
        Array.isArray(serviceInputsMap[targetService]) &&
        serviceInputsMap[targetService].length > 0 &&
        String(serviceInputsMap[targetService][0]?.prediction_id || '').startsWith('live-');

      const target = predictions.find(
        (p) => normalizeServiceName(p.workload_name || p.service_id) === targetService
      );
      if (target) {
        setSelectedPrediction(target);
        selectedPredictionRef.current = target;
        if (!hasLiveInputs) {
          loadInputs(target.id, true, targetService);
        }
      } else if (servicePredictionMap[targetService]) {
        setSelectedPrediction(servicePredictionMap[targetService]);
        selectedPredictionRef.current = servicePredictionMap[targetService];
        if (servicePredictionMap[targetService].id && !hasLiveInputs) {
          loadInputs(servicePredictionMap[targetService].id, true, targetService);
        }
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
        setPredictionInputs((prev) => (isSilent && prev.length > 0 ? prev : inputs));
        if (serviceId) {
          setServiceInputsMap((prev) => {
            // Không ghi đè chuỗi 12 điểm realtime đang chạy từ WebSocket (live-*)
            const existing = prev[serviceId];
            if (
              isSilent &&
              Array.isArray(existing) &&
              existing.length > 0 &&
              String(existing[0]?.prediction_id || '').startsWith('live-')
            ) {
              return prev;
            }
            return {
              ...prev,
              [serviceId]: inputs,
            };
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

  // Nạp dữ liệu từ Backend hoàn toàn bất đồng bộ độc lập (Fail-Safe qua Promise.allSettled)
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const clusterParam = currentEnv?.cluster || currentEnv?.clusterId || currentEnv?.id;
      const orgParam = currentOrg?.id;
      const [healthRes, statsRes, predRes, recRes, healRes, workloadsRes] = await Promise.allSettled([
        aiService.getAiHealth(),
        aiService.getPredictionStats({
          cluster_id: clusterParam,
          organization_id: orgParam,
          workload: selectedWorkloadRef.current !== 'ALL' ? selectedWorkloadRef.current : undefined,
        }),
        aiService.getPredictions({
          limit: 30,
          prediction_type: selectedTypeFilter === 'ALL' ? undefined : selectedTypeFilter,
          cluster_id: clusterParam,
          organization_id: orgParam,
        }),
        aiService.getRecommendations({ limit: 50, cluster_id: clusterParam, organization_id: orgParam }),
        aiService.getHealingActions({ limit: 50, cluster_id: clusterParam, organization_id: orgParam }),
        aiService.getWorkloads(clusterParam, orgParam),
      ]);

      if (healthRes.status === 'fulfilled' && healthRes.value) {
        setAiHealth(healthRes.value);
      }
      if (statsRes.status === 'fulfilled' && statsRes.value) {
        setStats(statsRes.value);
      }
      if (healRes.status === 'fulfilled' && Array.isArray(healRes.value)) {
        setHealingActions(healRes.value);
      }
      if (workloadsRes.status === 'fulfilled' && Array.isArray(workloadsRes.value) && workloadsRes.value.length > 0) {
        setRegisteredWorkloads(workloadsRes.value);
      }
      if (recRes.status === 'fulfilled' && Array.isArray(recRes.value)) {
        setRecommendations(recRes.value);
      }

      const predItems = predRes.status === 'fulfilled' ? (predRes.value?.items || []) : [];
      if (predItems.length > 0) {
        setPredictions(predItems);
        const activeTarget = selectedWorkloadRef.current !== 'ALL'
          ? selectedWorkloadRef.current
          : (pinnedServiceRef.current || normalizeServiceName(predItems[0]?.workload_name || predItems[0]?.service_id) || '');

        const targetPred = predItems.find((p) => normalizeServiceName(p.workload_name || p.service_id) === activeTarget) || predItems[0];
        if (targetPred) {
          const normName = normalizeServiceName(targetPred.workload_name || targetPred.service_id);
          setSelectedPrediction(targetPred);
          selectedPredictionRef.current = targetPred;
          if (normName) {
            setPinnedService(normName);
            pinnedServiceRef.current = normName;
          }
          loadInputs(targetPred.id, false, normName);
        }
      }
    } catch (err) {
      console.error('[PredictionsPage] Lỗi nạp dữ liệu AI:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedTypeFilter, currentEnv?.cluster, currentEnv?.clusterId, currentEnv?.id, currentOrg?.id]);

  // Đồng bộ dữ liệu ngầm định kỳ (Silent Sync) hoàn toàn bất đồng bộ độc lập không giật lag
  const silentSyncData = useCallback(async () => {
    try {
      const clusterParam = currentEnv?.cluster || currentEnv?.clusterId || currentEnv?.id;
      const orgParam = currentOrg?.id;
      const [statsRes, predRes, recRes, healRes, workloadsRes] = await Promise.allSettled([
        aiService.getPredictionStats({
          cluster_id: clusterParam,
          organization_id: orgParam,
          workload: selectedWorkloadRef.current !== 'ALL' ? selectedWorkloadRef.current : undefined,
        }),
        aiService.getPredictions({
          limit: 30,
          prediction_type: selectedTypeFilter === 'ALL' ? undefined : selectedTypeFilter,
          cluster_id: clusterParam,
          organization_id: orgParam,
        }),
        aiService.getRecommendations({ limit: 50, cluster_id: clusterParam, organization_id: orgParam }),
        aiService.getHealingActions({ limit: 50, cluster_id: clusterParam, organization_id: orgParam }),
        aiService.getWorkloads(clusterParam, orgParam),
      ]);

      if (workloadsRes.status === 'fulfilled' && Array.isArray(workloadsRes.value) && workloadsRes.value.length > 0) {
        setRegisteredWorkloads((prev) => {
          if (prev.length === workloadsRes.value.length) return prev;
          return workloadsRes.value;
        });
      }

      if (statsRes.status === 'fulfilled' && statsRes.value) {
        setStats((prev) => {
          if (statsRes.value.total >= (prev.total || 0) || Math.abs((prev.total || 0) - statsRes.value.total) > 5) {
            return statsRes.value;
          }
          return prev;
        });
      }

      if (healRes.status === 'fulfilled' && Array.isArray(healRes.value)) {
        setHealingActions((prev) => {
          if (prev.length === healRes.value.length && prev[0]?.id === healRes.value[0]?.id && prev[prev.length - 1]?.id === healRes.value[healRes.value.length - 1]?.id) {
            return prev;
          }
          return healRes.value;
        });
      }

      if (recRes.status === 'fulfilled' && Array.isArray(recRes.value)) {
        setRecommendations((prev) => {
          if (prev.length === recRes.value.length && prev[0]?.id === recRes.value[0]?.id && prev[prev.length - 1]?.id === recRes.value[recRes.value.length - 1]?.id) {
            return prev;
          }
          return recRes.value;
        });
      }

      const predItems = predRes.status === 'fulfilled' ? (predRes.value?.items || []) : [];
      if (Array.isArray(predItems) && predItems.length > 0) {
        setPredictions((prev) => {
          if (prev.length === predItems.length && prev[0]?.id === predItems[0]?.id && prev[prev.length - 1]?.id === predItems[predItems.length - 1]?.id) {
            return prev;
          }
          return predItems;
        });
        const activeTarget = selectedWorkloadRef.current !== 'ALL'
          ? selectedWorkloadRef.current
          : (pinnedServiceRef.current || normalizeServiceName(predItems[0]?.workload_name || predItems[0]?.service_id) || '');

        const target = predItems.find((p) => normalizeServiceName(p.workload_name || p.service_id) === activeTarget);
        if (target) {
          const normName = normalizeServiceName(target.workload_name || target.service_id);
          setSelectedPrediction((prev) => {
            if (!prev || prev.id !== target.id) {
              selectedPredictionRef.current = target;
              loadInputs(target.id, true, normName);
              return target;
            }
            return prev;
          });
        }
      }
    } catch (err) {
      // Bỏ qua lỗi ngầm
    }
  }, [selectedTypeFilter, currentEnv?.cluster, currentEnv?.clusterId, currentEnv?.id, currentOrg?.id]);

  useEffect(() => {
    loadData();
  }, [currentEnv?.cluster, currentEnv?.clusterId, currentEnv?.id]);

  // Tự động Polling ngầm dự phòng (chỉ khi Agent Online)
  // Khi WebSocket đã kết nối trực tiếp (isWsLive), giảm tần suất polling xuống 20s để triệt tiêu hiện tượng giật số
  useEffect(() => {
    if (!isAgentConnected) return;
    const intervalMs = isWsLive ? 20000 : 5000;
    const timer = setInterval(() => {
      silentSyncData();
    }, intervalMs);
    return () => clearInterval(timer);
  }, [isAgentConnected, isWsLive, silentSyncData]);

  // Kết nối WebSocket Realtime Stream (Push Protocol) (chỉ khi Agent Online)
  useEffect(() => {
    if (!isAgentConnected) {
      setIsWsLive(false);
      setBatchProgress(null);
      return;
    }
    const clusterParam = currentEnv?.cluster || currentEnv?.clusterId || currentEnv?.id;
    const targetService =
      (selectedWorkloadRef.current !== 'ALL' ? selectedWorkloadRef.current : '') ||
      pinnedServiceRef.current ||
      availableWorkloads[0] ||
      'attack-injector-app';
    const unsubscribe = telemetryService.subscribeWebSocket(
      targetService,
      (payload) => {
        if (!payload) return;

        // 1. Gói tin suy luận mới từ GRU Pipeline (ai_prediction)
        if (payload.type === 'ai_prediction' && payload.data) {
          const newPred = payload.data;
          const predId = newPred.prediction_id || newPred.id;
          const wlName = normalizeServiceName(newPred.workload_name || newPred.service_id || newPred.target_name);
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

          // Chỉ lưu sequence từ ai_prediction nếu service này chưa có luồng batch_accumulation trực tiếp
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
            setServiceInputsMap((prev) => {
              const existing = prev[wlName];
              if (
                Array.isArray(existing) &&
                existing.length > 0 &&
                String(existing[0]?.prediction_id || '').startsWith('live-')
              ) {
                return prev;
              }
              return {
                ...prev,
                [wlName]: directInputs,
              };
            });
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
            : (pinnedServiceRef.current || availableWorkloads[0] || '');

          if (wlName && wlName === currentTarget) {
            setLastWsSyncTime(timeStr);
            setSelectedPrediction(formatted);
            selectedPredictionRef.current = formatted;
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
          const sId = normalizeServiceName(bp.service_id);
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
            : (pinnedServiceRef.current || availableWorkloads[0] || '');

          if (sId && (!currentTarget || sId === currentTarget)) {
            setLastWsSyncTime(new Date().toLocaleTimeString('vi-VN'));
            setBatchProgress(bp);
            if (bp.active_step) {
              setActiveStep(bp.active_step);
            }
          }
        }

        // 3. Gói tin Khởi tạo ban đầu từ WebSocket (chỉ nạp khi danh sách chưa có)
        if (payload.type === 'initial_state' && payload.data) {
          const summary = payload.data;
          if (Array.isArray(summary.predictions) && summary.predictions.length > 0) {
            setPredictions((prev) => (prev.length === 0 ? summary.predictions : prev));
          }
          if (Array.isArray(summary.recommendations) && summary.recommendations.length > 0) {
            setRecommendations((prev) => (prev.length === 0 ? summary.recommendations : prev));
          }
        }

        // 4. Gói tin đề xuất tự lành mới từ RCA (ai_recommendation)
        if (payload.type === 'ai_recommendation' && payload.data) {
          const newRec = payload.data;
          setRecommendations((prev) => {
            if (!prev.some((r) => r.id === newRec.id)) {
              return [newRec, ...prev.slice(0, 49)];
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
  }, [isAgentConnected, currentEnv?.cluster, currentEnv?.clusterId, currentEnv?.id]);

  // Kích hoạt suy diễn thủ công on-demand (Rule Engine -> GRU Model -> RCA)
  const handleRunManualInference = async () => {
    setIsEvaluating(true);
    try {
      const targetWorkload = selectedWorkload !== 'ALL'
        ? selectedWorkload
        : (pinnedService || (availableWorkloads && availableWorkloads[0]) || '');
      if (!targetWorkload) {
        setIsEvaluating(false);
        setNoticeMessage({
          type: 'warning',
          text: 'Chưa có dịch vụ nào trên cụm này để thực hiện suy diễn.',
        });
        return;
      }
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

  const handleOpenGruModal = async (pred) => {
    if (!pred) return;
    setGruModal({ isOpen: true, prediction: pred, inputs: [], loading: true });
    try {
      const inputs = await aiService.getPredictionInputs(pred.id);
      setGruModal((prev) => ({
        ...prev,
        inputs: Array.isArray(inputs) ? inputs : [],
        loading: false,
      }));
    } catch (err) {
      console.error('[PredictionsPage] Lỗi lấy chuỗi viễn trắc lịch sử GRU:', err);
      setGruModal((prev) => ({ ...prev, inputs: [], loading: false }));
    }
  };

  const handleCloseGruModal = () => {
    setGruModal({ isOpen: false, prediction: null, inputs: [], loading: false });
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
      const orgParam = currentOrg?.id;
      const [updatedRecs, updatedHeals] = await Promise.all([
        aiService.getRecommendations({ limit: 50, cluster_id: clusterParam, organization_id: orgParam }),
        aiService.getHealingActions({ limit: 50, cluster_id: clusterParam, organization_id: orgParam }),
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

  // Hàm định dạng thời gian tương đối
  const formatRelativeTime = (dateStr) => {
    if (!dateStr) return 'Vừa xong';
    const diff = Date.now() - new Date(dateStr).getTime();
    if (isNaN(diff)) return 'Vừa xong';
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Vừa xong';
    if (mins < 60) return `${mins} phút trước`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} giờ trước`;
    return `${Math.floor(hours / 24)} ngày trước`;
  };

  // Mở modal xem bằng chứng gốc rễ RCA (Đồng bộ chuẩn giao diện với Quản lý Sự cố)
  const handleOpenEvidenceModal = (rec) => {
    if (!rec?.incident_id) {
      setNoticeMessage({
        type: 'error',
        text: 'Khuyến nghị này chưa gắn với mã Incident nào trong cơ sở dữ liệu.',
      });
      return;
    }

    let targetService = rec.target_name || normalizeServiceName(rec.target_id);
    if (!targetService && rec.incident_title && rec.incident_title.includes(' on ')) {
      targetService = rec.incident_title.split(' on ')[1].trim();
    }
    if (!targetService) {
      targetService = availableWorkloads[0] || 'ecommerce-store-app';
    }

    const clusterName = rec.cluster_name || currentEnv?.cluster || currentEnv?.name || 'k8s-cluster';
    const isApplied = rec.status === 'APPLIED' || appliedActions.includes(rec.id);

    const actionCode = rec.recommendation || rec.action_code || 'NO_ACTION';
    const isNoAction = actionCode === 'NO_ACTION';
    const initialIncident = {
      id: `INC-${(rec.incident_id || '').substring(0, 8).toUpperCase()}`,
      rawId: rec.incident_id,
      predictionId: rec.prediction_id,
      cluster: clusterName,
      clusterName: clusterName,
      clusterId: rec.cluster_id || currentEnv?.clusterId,
      title: isNoAction ? 'Giám sát viễn trắc an toàn - Quyết định NO_ACTION' : (rec.incident_title || rec.recommendation || 'Bất thường viễn trắc AI'),
      service: targetService,
      severity: isNoAction ? 'LOW' : (rec.severity || 'LOW').toUpperCase(),
      status: isApplied ? 'Đã khắc phục hoàn tất' : (isNoAction ? 'Tự động an toàn (NO_ACTION)' : 'Chờ phê duyệt HITL'),
      time: formatRelativeTime(rec.created_at),
      detectedAt: rec.created_at,
      recommendationAction: actionCode,
      recommendationReason: isNoAction
        ? 'Hệ thống viễn trắc nằm trong ngưỡng an toàn tự thích ứng. Quyết định tự động: Không can thiệp để bảo toàn Zero-Downtime.'
        : (rec.reason || 'Áp dụng hành động tự sửa lỗi kiểm soát an toàn theo vòng lặp điều khiển tự thích ứng MAPE-K.'),
      confidence: Math.round(Number(rec.confidence || 0.3) * 100),
      primaryRisk: isNoAction ? 'AN TOÀN (100%)' : `${rec.recommendation || 'RỦI RO'} (${Math.round(Number(rec.confidence || 0.3) * 100)}%)`,
      actionParameters: rec.action_parameters,
      manualPlaybook: rec.manual_playbook,
      rootCauseType: rec.root_cause_type,
      rcaConfidence: rec.rca_confidence,
      analysisResult: rec.analysis_result,
    };

    setEvidenceModal({
      isOpen: true,
      incidentId: rec.incident_id,
      recTitle: rec.recommendation || 'Khuyến nghị phòng ngừa',
      recData: rec,
      incidentModalData: initialIncident,
    });
  };

  const handleCloseEvidenceModal = () => {
    setEvidenceModal({
      isOpen: false,
      incidentId: null,
      recTitle: '',
      recData: null,
      incidentModalData: null,
    });
  };

  const handleResolveFromEvidenceModal = async (id, rawId) => {
    const recId = evidenceModal.recData?.id;
    if (recId) {
      await handleMitigate(recId);
    }
    const targetRawId = rawId || evidenceModal.incidentId;
    if (targetRawId) {
      try {
        await aiService.updateIncidentStatus(targetRawId, 'RESOLVED');
      } catch (e) {
        console.warn('[PredictionsPage] Lỗi cập nhật trạng thái sự cố:', e);
      }
    }
    setEvidenceModal((prev) => ({
      ...prev,
      incidentModalData: prev.incidentModalData
        ? {
            ...prev.incidentModalData,
            status: 'Đã khắc phục hoàn tất',
            mttr: 'Đã khắc phục hoàn tất',
          }
        : null,
    }));
  };

  // Xác định dịch vụ mục tiêu đang hiển thị (cố định, không bị nhảy chéo)
  const currentServiceTarget = useMemo(() => {
    if (selectedWorkload && selectedWorkload !== 'ALL') {
      return selectedWorkload;
    }
    return pinnedService || availableWorkloads[0] || '';
  }, [selectedWorkload, pinnedService, availableWorkloads]);


  // Lấy dự báo GRU của riêng dịch vụ đang xem (luôn cập nhật bản ghi mới nhất, không bị kẹt ở lượt cũ)
  const displaySelectedPrediction = useMemo(() => {
    if (!isAgentConnected) return null;
    const livePred = servicePredictionMap[currentServiceTarget];
    const latestInList = Array.isArray(predictions)
      ? predictions.find((p) => normalizeServiceName(p.workload_name || p.service_id) === currentServiceTarget)
      : null;

    if (livePred && latestInList) {
      const liveTime = new Date(livePred.evaluated_at || livePred.predicted_at || livePred.created_at || 0).getTime();
      const listTime = new Date(latestInList.predicted_at || latestInList.created_at || 0).getTime();
      return liveTime >= listTime ? livePred : latestInList;
    }
    if (livePred) return livePred;
    if (latestInList) return latestInList;

    const selNorm = normalizeServiceName(selectedPrediction?.workload_name || selectedPrediction?.service_id);
    if (selectedPrediction && selNorm === currentServiceTarget) {
      return selectedPrediction;
    }
    return null;
  }, [isAgentConnected, servicePredictionMap, currentServiceTarget, selectedPrediction, predictions]);

  // Tự động nạp dữ liệu chuỗi 12 điểm viễn trắc khi có lượt dự báo mới hoặc dịch vụ mục tiêu đổi
  useEffect(() => {
    const curWl = currentServiceTarget;
    if (!curWl) return;
    const activePredId = displaySelectedPrediction?.id || selectedPrediction?.id;
    if (!activePredId) return;

    if (!serviceInputsMap[curWl] || serviceInputsMap[curWl].length === 0) {
      loadInputs(activePredId, true, curWl);
    }
  }, [displaySelectedPrediction?.id, selectedPrediction?.id, currentServiceTarget]);

  // Lấy 12 mốc viễn trắc độc lập của riêng dịch vụ đang xem
  const currentInputs = useMemo(() => {
    if (serviceInputsMap[currentServiceTarget] && serviceInputsMap[currentServiceTarget].length > 0) {
      return serviceInputsMap[currentServiceTarget];
    }
    // Fallback nếu dự báo hiện tại có sẵn trường sequence (từ WebSocket hoặc Backend)
    const activePred = displaySelectedPrediction || selectedPrediction;
    if (Array.isArray(activePred?.sequence) && activePred.sequence.length > 0) {
      const predId = activePred.id || 'live';
      const directInputs = [];
      activePred.sequence.forEach((pt, idx) => {
        const ts = pt.time_bucket ? new Date(pt.time_bucket).toISOString() : new Date().toISOString();
        for (const mName of ['cpu', 'ram', 'disk', 'latency', 'request_rate', 'http_5xx_rate', 'pod_restart_count', 'replica_count']) {
          directInputs.push({
            id: `seq-${predId}-${idx}-${mName}`,
            prediction_id: predId,
            metric_name: mName,
            metric_value: pt[mName] !== undefined ? pt[mName] : 0,
            collected_at: ts,
          });
        }
      });
      return directInputs;
    }
    const selNorm = normalizeServiceName(selectedPrediction?.workload_name || selectedPrediction?.service_id);
    if ((!selNorm || selNorm === currentServiceTarget) && predictionInputs && predictionInputs.length > 0) {
      return predictionInputs;
    }
    return [];
  }, [serviceInputsMap, currentServiceTarget, displaySelectedPrediction, selectedPrediction, predictionInputs]);

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

  // Chuỗi 12 bước thời gian lịch sử cố định (Snapshot Audit) của riêng dự báo đang xem trong modal GRU
  const modalTimesteps = useMemo(() => {
    if (!gruModal.inputs || gruModal.inputs.length === 0) return [];

    const map = new Map();
    gruModal.inputs.forEach((item) => {
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
  }, [gruModal.inputs]);

  // Dữ liệu hiển thị có điều kiện theo trạng thái kết nối Cụm K8s (isAgentConnected)
  // Khi cụm chưa kết nối (Agent Offline) -> đưa toàn bộ về 0 & không hiển thị dữ liệu
  const displayStats = useMemo(() => {
    if (!isAgentConnected) {
      return { total: 0, by_type: {}, avg_confidence: 0 };
    }
    return stats;
  }, [isAgentConnected, stats]);

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
    const effectiveFilter = bottomServiceFilter !== 'ALL' ? bottomServiceFilter : (logWorkloadFilter !== 'ALL' ? logWorkloadFilter : 'ALL');
    if (effectiveFilter && effectiveFilter !== 'ALL') {
      list = list.filter((p) => normalizeServiceName(p.workload_name || p.service_id) === effectiveFilter);
    }
    return list;
  }, [isAgentConnected, predictions, logWorkloadFilter, selectedTypeFilter, bottomServiceFilter]);

  const displayRecommendations = useMemo(() => {
    if (!isAgentConnected) return [];
    let list = Array.isArray(recommendations) ? recommendations : [];

    // Lọc theo bottomServiceFilter nếu người dùng chọn lọc dịch vụ
    if (bottomServiceFilter && bottomServiceFilter !== 'ALL') {
      list = list.filter((r) => {
        const target =
          r.target_name ||
          (r.incident_title && r.incident_title.includes(' on ')
            ? r.incident_title.split(' on ')[1].trim()
            : '') ||
          normalizeServiceName(r.target_id) ||
          '';
        return target.toLowerCase() === bottomServiceFilter.toLowerCase();
      });
    }

    // Khử trùng lặp theo ID khuyến nghị duy nhất (đảm bảo không bị nhân đôi giữa WebSocket & REST)
    const map = new Map();
    for (const r of list) {
      if (!r || !r.id) continue;
      const target =
        r.target_name ||
        (r.incident_title && r.incident_title.includes(' on ')
          ? r.incident_title.split(' on ')[1].trim()
          : '') ||
        normalizeServiceName(r.target_id) ||
        'sme-order-service';

      const isApplied = r.status === 'APPLIED' || appliedActions.includes(r.id);
      const formatted = {
        ...r,
        target_name: target,
        status: isApplied ? 'APPLIED' : (r.status || 'PROPOSED'),
      };

      if (!map.has(r.id)) {
        map.set(r.id, formatted);
      } else {
        const existing = map.get(r.id);
        if (isApplied && existing.status !== 'APPLIED') {
          map.set(r.id, formatted);
        }
      }
    }

    const res = Array.from(map.values());
    // Đảm bảo luôn sắp xếp tường minh theo thời gian mới nhất lên đầu (DESC)
    res.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
    return res;
  }, [isAgentConnected, recommendations, appliedActions, bottomServiceFilter]);

  const pendingProposedRecommendations = useMemo(() => {
    return displayRecommendations.filter((r) => {
      const code = r.recommendation || r.action_code || '';
      const isApplied = r.status === 'APPLIED' || appliedActions.includes(r.id);
      return r.status === 'PROPOSED' && !isApplied && code !== 'NO_ACTION';
    });
  }, [displayRecommendations, appliedActions]);

  const noActionRecommendations = useMemo(() => {
    return displayRecommendations.filter((r) => {
      const code = r.recommendation || r.action_code || '';
      return code === 'NO_ACTION';
    });
  }, [displayRecommendations]);

  const displayHealingActions = useMemo(() => {
    if (!isAgentConnected) return [];
    let list = [...healingActions];
    if (bottomServiceFilter && bottomServiceFilter !== 'ALL') {
      list = list.filter((a) => {
        const target = normalizeServiceName(a.target_name || a.target_id);
        return target === bottomServiceFilter;
      });
    }
    list.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
    return list;
  }, [isAgentConnected, healingActions, bottomServiceFilter]);


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
                {currentOrg?.name || 'Chưa chọn Tổ chức'} &bull; <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{currentEnv?.name || 'Môi trường mặc định'}</span> &bull; Phân loại rủi ro đa nhãn thời gian thực bằng mô hình GRU PyTorch
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
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
            <span
              style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}
              title={isAgentConnected ? `Tiến trình gom mẻ viễn trắc: ${currentServiceBatchProgress?.collected !== undefined ? currentServiceBatchProgress.collected : 12}/${currentServiceBatchProgress?.target || 12} (${currentServiceTarget})` : 'Cụm chưa kết nối'}
            >
              {isAgentConnected
                ? (currentServiceBatchProgress?.collected !== undefined
                    ? `${currentServiceBatchProgress.collected}/${currentServiceBatchProgress.target || 12}`
                    : '12/12')
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
            {pendingProposedRecommendations.length > 0 ? (
              <Zap size={18} color="#D97706" />
            ) : (
              <ShieldCheck size={18} color="#059669" />
            )}
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, color: isAgentConnected && pendingProposedRecommendations.length > 0 ? '#D97706' : (isAgentConnected ? '#059669' : '#94A3B8'), fontFamily: 'var(--font-mono)' }}>
            {pendingProposedRecommendations.length}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-secondary)', marginTop: '4px' }}>
            {isAgentConnected
              ? (pendingProposedRecommendations.length > 0
                  ? `${pendingProposedRecommendations.length} đề xuất đang chờ kích hoạt`
                  : (noActionRecommendations.length > 0
                      ? `${noActionRecommendations.length} đề xuất tự động an toàn (NO_ACTION)`
                      : '0 đề xuất đang chờ kích hoạt'))
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
                <span>Dịch vụ: <strong style={{ fontFamily: 'var(--font-mono)', color: '#2563EB' }}>{isAgentConnected ? (currentServiceTarget || 'Chưa có dữ liệu') : 'Chưa kết nối'}</strong></span>
              </p>

              {/* Bộ chọn chuyển đổi Dịch vụ dạng Dropdown (Sổ xuống) trực tiếp tại Biểu Đồ */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Server size={13} color="#3B82F6" />
                  Dịch vụ:
                </span>
                {!isAgentConnected ? (
                  <span style={{ fontSize: '0.75rem', color: '#94A3B8', fontStyle: 'italic', padding: '4px 10px', backgroundColor: '#F8FAFC', borderRadius: '6px', border: '1px solid #E2E8F0' }}>
                    Agent chưa kết nối (Không có dữ liệu viễn trắc)
                  </span>
                ) : availableWorkloads.length === 0 ? (
                  <span style={{ fontSize: '0.75rem', color: '#94A3B8', fontStyle: 'italic', padding: '4px 10px', backgroundColor: '#F8FAFC', borderRadius: '6px', border: '1px solid #E2E8F0' }}>
                    Chưa có dịch vụ nào gửi telemetry trên cụm này
                  </span>
                ) : (
                  <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
                    <select
                      id="workload-select-dropdown"
                      value={currentServiceTarget || availableWorkloads[0] || ''}
                      onChange={(e) => handleSelectWorkload(e.target.value)}
                      style={{
                        padding: '5px 30px 5px 12px',
                        fontSize: '0.8125rem',
                        fontWeight: 700,
                        color: '#1D4ED8',
                        backgroundColor: '#EFF6FF',
                        border: '1.5px solid #3B82F6',
                        borderRadius: '6px',
                        outline: 'none',
                        cursor: 'pointer',
                        appearance: 'none',
                        WebkitAppearance: 'none',
                        MozAppearance: 'none',
                        transition: 'all 0.15s ease',
                        boxShadow: '0 1px 2px rgba(59, 130, 246, 0.12)',
                      }}
                      onFocus={(e) => {
                        e.target.style.backgroundColor = '#FFFFFF';
                        e.target.style.borderColor = '#1E40AF';
                        e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.25)';
                      }}
                      onBlur={(e) => {
                        e.target.style.backgroundColor = '#EFF6FF';
                        e.target.style.borderColor = '#3B82F6';
                        e.target.style.boxShadow = '0 1px 2px rgba(59, 130, 246, 0.12)';
                      }}
                    >
                      {availableWorkloads.map((wl) => (
                        <option key={wl} value={wl} style={{ padding: '8px', fontSize: '0.8125rem', fontWeight: 600, color: '#0F172A', backgroundColor: '#FFFFFF' }}>
                          {wl}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      size={14}
                      color="#2563EB"
                      style={{
                        position: 'absolute',
                        right: '9px',
                        pointerEvents: 'none',
                      }}
                    />
                  </div>
                )}
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
              <RefreshCw size={18} className="animate-spin" style={{ marginRight: '8px', color: '#38BDF8' }} />
              Đang đồng bộ chuỗi 12 điểm viễn trắc...
            </div>
          ) : displayTimesteps.length === 0 ? (
            <div style={{ height: `${height}px`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', color: '#64748B', fontSize: '0.8125rem' }}>
              <RefreshCw size={22} className="animate-spin" style={{ color: '#38BDF8' }} />
              <div style={{ fontWeight: 600, color: 'var(--dash-text-primary)' }}>
                Đang gom nhịp viễn trắc độc lập cho {currentServiceTarget || 'dịch vụ'}...
              </div>
              <div style={{ fontSize: '0.75rem', color: '#94A3B8' }}>
                {currentServiceBatchProgress?.message || 'Hệ thống đang tích lũy đủ 12 bước viễn trắc (60s) để suy luận GRU'}
              </div>
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
            <span
              style={{
                color: (!isAgentConnected || !displaySelectedPrediction)
                  ? '#94A3B8'
                  : (displaySelectedPrediction.status === 'RISK_DETECTED' || Number(displaySelectedPrediction.risk_score ?? displaySelectedPrediction.overall_risk_score ?? 0) >= 0.7)
                    ? '#DC2626'
                    : '#059669',
                fontWeight: 600,
              }}
            >
              {displaySelectedPrediction
                ? ((displaySelectedPrediction.status === 'RISK_DETECTED' || Number(displaySelectedPrediction.risk_score ?? displaySelectedPrediction.overall_risk_score ?? 0) >= 0.7)
                    ? '⚠️ Phát hiện nguy cơ vượt ngưỡng!'
                    : 'Tất cả dưới ngưỡng an toàn')
                : (isAgentConnected ? 'Chưa có lượt suy luận' : 'Cụm chưa kết nối • Không có dữ liệu suy luận')}
            </span>
          </div>
        </div>
      </div>

      {/* 5. Bộ Điều Khiển Lọc & Tabs Chuyển Đổi Phân Hệ (Đã bỏ viền và thu gọn khoảng cách) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '-12px', marginBottom: '-14px' }}>
        {/* 4.9 Thanh Lọc Dịch Vụ / Workload Cho Toàn Bộ 3 Phân Hệ Phía Dưới dạng Dropdown */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            flexWrap: 'wrap',
            gap: '8px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#475569', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Filter size={14} color="#3B82F6" />
              Lọc theo Dịch vụ:
            </span>
            {!isAgentConnected ? (
              <span style={{ fontSize: '0.75rem', color: '#94A3B8', fontStyle: 'italic', padding: '4px 10px', backgroundColor: '#F8FAFC', borderRadius: '6px', border: '1px solid #E2E8F0' }}>
                Cụm chưa kết nối Agent (Không có dịch vụ)
              </span>
            ) : availableWorkloads.length === 0 ? (
              <span style={{ fontSize: '0.75rem', color: '#94A3B8', fontStyle: 'italic', padding: '4px 10px', backgroundColor: '#F8FAFC', borderRadius: '6px', border: '1px solid #E2E8F0' }}>
                Chưa có dịch vụ nào trên cụm này
              </span>
            ) : (
              <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
                <select
                  id="bottom-workload-filter-dropdown"
                  value={bottomServiceFilter}
                  onChange={(e) => {
                    setBottomServiceFilter(e.target.value);
                    setLogWorkloadFilter(e.target.value);
                  }}
                  style={{
                    padding: '5px 30px 5px 12px',
                    fontSize: '0.8125rem',
                    fontWeight: 700,
                    color: bottomServiceFilter === 'ALL' ? '#1E293B' : '#1D4ED8',
                    backgroundColor: bottomServiceFilter === 'ALL' ? '#F8FAFC' : '#EFF6FF',
                    border: bottomServiceFilter === 'ALL' ? '1.5px solid #CBD5E1' : '1.5px solid #3B82F6',
                    borderRadius: '6px',
                    outline: 'none',
                    cursor: 'pointer',
                    appearance: 'none',
                    WebkitAppearance: 'none',
                    MozAppearance: 'none',
                    transition: 'all 0.15s ease',
                    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
                  }}
                  onFocus={(e) => {
                    e.target.style.backgroundColor = '#FFFFFF';
                    e.target.style.borderColor = '#1D4ED8';
                    e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.2)';
                  }}
                  onBlur={(e) => {
                    e.target.style.backgroundColor = bottomServiceFilter === 'ALL' ? '#F8FAFC' : '#EFF6FF';
                    e.target.style.borderColor = bottomServiceFilter === 'ALL' ? '#CBD5E1' : '#3B82F6';
                    e.target.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.05)';
                  }}
                >
                  <option value="ALL" style={{ padding: '8px', fontSize: '0.8125rem', fontWeight: 600, color: '#0F172A', backgroundColor: '#FFFFFF' }}>
                    Tất cả dịch vụ ({availableWorkloads.length})
                  </option>
                  {availableWorkloads.map((wl) => (
                    <option key={wl} value={wl} style={{ padding: '8px', fontSize: '0.8125rem', fontWeight: 600, color: '#0F172A', backgroundColor: '#FFFFFF' }}>
                      {wl}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={14}
                  color={bottomServiceFilter === 'ALL' ? '#64748B' : '#2563EB'}
                  style={{
                    position: 'absolute',
                    right: '9px',
                    pointerEvents: 'none',
                  }}
                />
              </div>
            )}
          </div>
        </div>

        {/* 5. Bộ Tabs Chuyển Đổi Phân Hệ Dưới Sơ Đồ - Cân Đối 100% Khung */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '8px',
          borderBottom: '2px solid #E2E8F0',
          paddingBottom: '0',
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
            backgroundColor: activeBottomTab === 'recommendations' ? (pendingProposedRecommendations.length > 0 ? '#FFFBEB' : '#ECFDF5') : '#F8FAFC',
            border: 'none',
            borderBottom: activeBottomTab === 'recommendations' ? (pendingProposedRecommendations.length > 0 ? '3px solid #D97706' : '3px solid #059669') : '3px solid transparent',
            borderRadius: '6px 6px 0 0',
            color: activeBottomTab === 'recommendations' ? (pendingProposedRecommendations.length > 0 ? '#B45309' : '#047857') : '#64748B',
            fontWeight: activeBottomTab === 'recommendations' ? 700 : 600,
            fontSize: '0.8125rem',
            cursor: 'pointer',
            marginBottom: '-2px',
            minWidth: 0,
            transition: 'all 0.15s ease',
          }}
        >
          {pendingProposedRecommendations.length > 0 ? (
            <Zap size={15} color={activeBottomTab === 'recommendations' ? '#D97706' : '#94A3B8'} style={{ flexShrink: 0 }} />
          ) : (
            <ShieldCheck size={15} color={activeBottomTab === 'recommendations' ? '#059669' : '#94A3B8'} style={{ flexShrink: 0 }} />
          )}
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            Đề Xuất Phòng Ngừa AI & RCA
          </span>
          <span style={{
            padding: '2px 7px',
            borderRadius: '9999px',
            fontSize: '0.6875rem',
            fontWeight: 700,
            fontFamily: 'var(--font-mono)',
            backgroundColor: activeBottomTab === 'recommendations' ? (pendingProposedRecommendations.length > 0 ? '#FEF3C7' : '#DCFCE7') : '#E2E8F0',
            color: activeBottomTab === 'recommendations' ? (pendingProposedRecommendations.length > 0 ? '#92400E' : '#15803D') : '#64748B',
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
      </div>
      {/* 5. Khối Danh Sách Khuyến Nghị Phòng Ngừa Tự Lành (Active Recommendations) */}
      {activeBottomTab === 'recommendations' && (
      <div className="dash-card" style={{ padding: '20px', backgroundColor: '#FFFFFF', border: '1px solid var(--dash-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginBottom: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {pendingProposedRecommendations.length > 0 ? (
                <Zap size={18} color="#D97706" />
              ) : (
                <ShieldCheck size={18} color="#059669" />
              )}
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
              const isNoAction = actionCode === 'NO_ACTION';
              const targetName = rec.target_name || normalizeServiceName(rec.target_id) || (rec.incident_title && rec.incident_title.includes(' on ') ? rec.incident_title.split(' on ')[1].trim() : '') || 'sme-order-service';

              const actionInfo = getActionDetails(actionCode);

              // Trích xuất chi tiết bổ sung từ AI RCA & K8s
              const rootCause = rec.root_cause_type || null;
              const rcaConfidence = rec.rca_confidence ? Math.round(Number(rec.rca_confidence <= 1 ? rec.rca_confidence * 100 : rec.rca_confidence)) : null;
              const riskLevel = (rec.risk_level || (rec.priority === 1 ? 'CRITICAL' : 'HIGH')).toUpperCase();

              // Trích xuất tham số thực thi K8s
              const params = rec.action_parameters || {};
              const targetPod = params.faulty_pod_name || params.target_pod || null;
              const targetNode = params.recommended_destination_node || params.faulty_node_name || params.target_node || null;
              const circuitBreakerTripped = Boolean(params.circuit_breaker_tripped);
              const consecutiveFailures = params.consecutive_failures || 0;

              // Playbook thủ công
              const playbook = rec.manual_playbook || params.manual_playbook || null;
              const playbookSteps = Array.isArray(playbook) ? playbook : (typeof playbook === 'string' ? [playbook] : []);
              const isPlaybookOpen = Boolean(expandedPlaybooks[rec.id]);

              return (
                <div
                  key={rec.id}
                  style={{
                    padding: '18px 20px',
                    borderRadius: '8px',
                    backgroundColor: isApplied ? '#F0FDF4' : (isNoAction ? '#F0FDF4' : '#FFFFFF'),
                    border: isApplied ? '1px solid #86EFAC' : (isNoAction ? '1px solid #A7F3D0' : '1px solid #E2E8F0'),
                    borderLeft: isApplied ? '5px solid #10B981' : (isNoAction ? '5px solid #059669' : '5px solid #F59E0B'),
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
                        {isNoAction ? <ShieldCheck size={12} /> : <Zap size={11} />}
                        <span>{actionInfo.label}</span>
                      </span>

                      {/* Dịch vụ mục tiêu */}
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

                      {/* Pod cụ thể (nếu có) */}
                      {targetPod && (
                        <span
                          style={{
                            fontSize: '0.6875rem',
                            fontWeight: 600,
                            padding: '3px 8px',
                            backgroundColor: '#FDF4FF',
                            color: '#86198F',
                            borderRadius: '4px',
                            border: '1px solid #F0ABFC',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <Box size={11} color="#A21CAF" />
                          <span>Pod: <strong>{targetPod}</strong></span>
                        </span>
                      )}

                      {/* Node máy chủ (nếu có) */}
                      {targetNode && (
                        <span
                          style={{
                            fontSize: '0.6875rem',
                            fontWeight: 600,
                            padding: '3px 8px',
                            backgroundColor: '#F8FAFC',
                            color: '#475569',
                            borderRadius: '4px',
                            border: '1px solid #CBD5E1',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <Server size={11} color="#64748B" />
                          <span>Node: <strong>{targetNode}</strong></span>
                        </span>
                      )}

                      {/* Nguyên nhân cốt lõi RCA */}
                      {rootCause && !isNoAction && (
                        <span
                          style={{
                            fontSize: '0.6875rem',
                            fontWeight: 600,
                            padding: '3px 8px',
                            backgroundColor: '#FEF2F2',
                            color: '#991B1B',
                            borderRadius: '4px',
                            border: '1px solid #FECACA',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <Sparkles size={11} color="#DC2626" />
                          <span>Nguyên nhân: <strong>{rootCause}</strong></span>
                        </span>
                      )}

                      {/* Độ tin cậy */}
                      {rcaConfidence !== null && (
                        <span
                          style={{
                            fontSize: '0.6875rem',
                            fontWeight: 700,
                            padding: '3px 8px',
                            backgroundColor: '#ECFDF5',
                            color: '#065F46',
                            borderRadius: '4px',
                            border: '1px solid #A7F3D0',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <span>🎯 Độ tin cậy: <strong>{rcaConfidence}%</strong></span>
                        </span>
                      )}

                      {/* Trạng thái / Ưu tiên */}
                      <span
                        style={{
                          fontSize: '0.6875rem',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '4px',
                          backgroundColor: isNoAction ? '#ECFDF5' : (rec.priority === 1 ? '#FEF2F2' : '#FFFBEB'),
                          color: isNoAction ? '#047857' : (rec.priority === 1 ? '#DC2626' : '#D97706'),
                          border: `1px solid ${isNoAction ? '#A7F3D0' : (rec.priority === 1 ? '#FECACA' : '#FDE68A')}`,
                        }}
                      >
                        {isNoAction ? 'Trạng thái: An toàn' : `Ưu tiên: ${rec.priority === 1 ? 'Khẩn cấp' : 'Cao'}`}
                      </span>

                      {/* Mức rủi ro can thiệp (nếu không phải NO_ACTION) */}
                      {!isNoAction && (
                        <span
                          style={{
                            fontSize: '0.6875rem',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: '4px',
                            backgroundColor: riskLevel === 'CRITICAL' ? '#FEF2F2' : riskLevel === 'HIGH' ? '#FFFBEB' : '#F0FDF4',
                            color: riskLevel === 'CRITICAL' ? '#B91C1C' : riskLevel === 'HIGH' ? '#B45309' : '#15803D',
                            border: `1px solid ${riskLevel === 'CRITICAL' ? '#FCA5A5' : riskLevel === 'HIGH' ? '#FDE68A' : '#BBF7D0'}`,
                          }}
                        >
                          Rủi ro: {riskLevel}
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: '#64748B', fontFamily: 'var(--font-mono)' }}>
                      <Clock size={12} />
                      <span>{rec.created_at && !isNaN(new Date(rec.created_at).getTime()) ? new Date(rec.created_at).toLocaleString('vi-VN') : 'Vừa xong'}</span>
                    </div>
                  </div>

                  {/* Diagnosis & Action Content */}
                  <div>
                    <div style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#0F172A', marginBottom: '6px', lineHeight: 1.4 }}>
                      {formatReasoning(rec.reasoning || rec.reason)}
                    </div>

                    <div style={{ fontSize: '0.8125rem', color: '#475569', lineHeight: 1.5 }}>
                      <strong style={{ color: '#0F172A' }}>{isNoAction ? 'Đánh giá tự thích ứng: ' : 'Hành động tự lành: '}</strong>
                      {actionInfo.desc}
                    </div>
                  </div>

                  {/* Khối Thông Số Kỹ Thuật Can Thiệp (Action Parameters Details) */}
                  {(circuitBreakerTripped || params.new_replicas || params.memory_limit || params.cpu_limit || params.grace_period || params.delete_grace_period || (isNoAction && consecutiveFailures > 0)) && (
                    <div
                      style={{
                        padding: '10px 14px',
                        borderRadius: '6px',
                        backgroundColor: circuitBreakerTripped ? '#FFFBEB' : '#F8FAFC',
                        border: circuitBreakerTripped ? '1px solid #FDE68A' : '1px solid #E2E8F0',
                        fontSize: '0.75rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '8px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        {circuitBreakerTripped && (
                          <span style={{ fontWeight: 700, color: '#B45309', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <ShieldAlert size={13} color="#D97706" />
                            <span>Circuit Breaker: Kích hoạt (HITL - Chuyển giao quyền cho kỹ sư)</span>
                          </span>
                        )}
                        {consecutiveFailures > 0 && (
                          <span style={{ color: '#64748B' }}>
                            &bull; Lặp thất bại: <strong style={{ color: '#DC2626' }}>{consecutiveFailures} lần</strong>
                          </span>
                        )}
                        {params.new_replicas && (
                          <span style={{ color: '#334155' }}>
                            &bull; Bản sao mục tiêu: <strong style={{ color: '#2563EB' }}>{params.new_replicas} pods</strong>
                          </span>
                        )}
                        {params.memory_limit && (
                          <span style={{ color: '#334155' }}>
                            &bull; Mức RAM mới: <strong style={{ color: '#2563EB' }}>{params.memory_limit}</strong>
                          </span>
                        )}
                        {params.cpu_limit && (
                          <span style={{ color: '#334155' }}>
                            &bull; Mức CPU mới: <strong style={{ color: '#2563EB' }}>{params.cpu_limit}</strong>
                          </span>
                        )}
                        {(params.grace_period || params.delete_grace_period) && (
                          <span style={{ color: '#334155' }}>
                            &bull; Grace Period: <strong>{params.grace_period || params.delete_grace_period}s</strong>
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Khối Quy Trình Playbook Can Thiệp Kỹ Thuật (Manual Playbook) */}
                  {playbookSteps.length > 0 && (
                    <div style={{ marginTop: '2px' }}>
                      <button
                        type="button"
                        onClick={() => togglePlaybook(rec.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: 0,
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          color: '#2563EB',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                        }}
                      >
                        <FileText size={13} />
                        <span>{isPlaybookOpen ? 'Ẩn quy trình can thiệp kỹ thuật (Playbook)' : `📖 Xem quy trình can thiệp kỹ thuật cho kỹ sư (${playbookSteps.length} bước)`}</span>
                        {isPlaybookOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                      </button>

                      {isPlaybookOpen && (
                        <div
                          style={{
                            marginTop: '8px',
                            padding: '12px 14px',
                            backgroundColor: '#0F172A',
                            borderRadius: '6px',
                            color: '#F8FAFC',
                            fontFamily: 'var(--font-mono)',
                            fontSize: '0.75rem',
                            border: '1px solid #1E293B',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '6px',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px', borderBottom: '1px solid #334155', paddingBottom: '6px' }}>
                            <span style={{ color: '#94A3B8', fontSize: '0.6875rem', fontWeight: 600 }}>
                              Quy trình Playbook khuyến nghị bởi AI SRE Engine:
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopyPlaybook(rec.id, playbookSteps.join('\n'))}
                              style={{
                                background: '#1E293B',
                                border: '1px solid #334155',
                                borderRadius: '4px',
                                color: copiedPlaybookId === rec.id ? '#34D399' : '#CBD5E1',
                                fontSize: '0.6875rem',
                                padding: '3px 8px',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                              }}
                            >
                              {copiedPlaybookId === rec.id ? <Check size={11} /> : <Copy size={11} />}
                              <span>{copiedPlaybookId === rec.id ? 'Đã sao chép' : 'Sao chép Playbook'}</span>
                            </button>
                          </div>
                          {playbookSteps.map((step, idx) => (
                            <div key={idx} style={{ color: '#E2E8F0', lineHeight: 1.5 }}>
                              {step}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Actions Bar */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', paddingTop: '8px', borderTop: '1px dashed #E2E8F0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: (isApplied || isNoAction) ? '#15803D' : '#64748B', fontWeight: 600 }}>
                      {isApplied ? (
                        <>
                          <CheckCircle2 size={14} color="#10B981" />
                          <span>Đã ghi nhận can thiệp thành công vào sổ kiểm toán MAPE&#8209;K</span>
                        </>
                      ) : isNoAction ? (
                        <>
                          <ShieldCheck size={14} color="#059669" />
                          <span>Hệ thống an toàn • Đã tự động áp dụng quyết định NO_ACTION theo vòng lặp MAPE&#8209;K</span>
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

                      {isNoAction ? (
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
                          <ShieldCheck size={15} color="#15803D" />
                          <span>TỰ ĐỘNG AN TOÀN (NO_ACTION)</span>
                        </div>
                      ) : isApplied ? (
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
                        {normalizeServiceName(act.target_name || act.target_id) || '-'}
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
                      <td style={{ padding: '10px 12px', color: '#475569', fontSize: '0.75rem', lineHeight: 1.45 }}>
                        {(() => {
                          const rawMsg = String(parsedResult.message || parsedResult.status || '');
                          const svc = normalizeServiceName(act.target_name || act.target_id) || 'dịch vụ';
                          if (rawMsg.includes('(403)') || rawMsg.includes('Forbidden') || rawMsg.includes('cannot patch resource')) {
                            const resMatch = rawMsg.match(/cannot\s+(\w+)\s+resource\s+\\?"([^"\\]+)\\?"/i);
                            const nsMatch = rawMsg.match(/in the namespace\s+\\?"([^"\\]+)\\?"/i);
                            const verb = resMatch ? resMatch[1] : 'patch';
                            const resource = resMatch ? resMatch[2] : 'deployments';
                            const ns = nsMatch ? nsMatch[1] : 'default';
                            return `Lỗi phân quyền K8s RBAC (403 Forbidden): ServiceAccount selfheal-agent-sa thiếu quyền "${verb}" trên "${resource}" (namespace "${ns}") đối với ${svc}.`;
                          }
                          if (rawMsg.includes("action 'NO_ACTION' executed successfully") || act.action_type_code === 'NO_ACTION') {
                            return `Giữ nguyên trạng thái (NO_ACTION): Dịch vụ ${svc} đang ổn định, tiếp tục giám sát định kỳ.`;
                          }
                          return rawMsg || `Đã thực thi ${act.action_type_code || 'hành động'} thành công trên ${svc}.`;
                        })()}
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
                  value={bottomServiceFilter !== 'ALL' ? bottomServiceFilter : logWorkloadFilter}
                  onChange={(e) => {
                    setBottomServiceFilter(e.target.value);
                    setLogWorkloadFilter(e.target.value);
                  }}
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
                const isHealthy = p.status === 'HEALTHY' || p.prediction_type === 'NORMAL';
                const activeRisks = getActiveRisks(p);

                return (
                  <tr
                    key={p.id}
                    onClick={() => handleOpenGruModal(p)}
                    style={{
                      borderBottom: '1px solid #F1F5F9',
                      backgroundColor: isSelected ? '#F8FAFC' : 'transparent',
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
                            handleOpenGruModal(p);
                          }}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '4px 8px',
                            fontSize: '0.6875rem',
                            fontWeight: 600,
                            backgroundColor: '#EEF2FF',
                            color: '#4338CA',
                            border: '1px solid #C7D2FE',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                          title="Bấm để mở cửa sổ chi tiết bảng dữ liệu 12 điểm viễn trắc và 7 đầu rủi ro GRU"
                        >
                          <Table size={12} />
                          <span>Bảng GRU</span>
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
                );
              })}
            </tbody>
          </table>
        </div>
        )}
      </div>
      )}

      {/* 7.5 Modal Chi Tiết Dữ Liệu Đầu Vào Gửi Vào GRU & Suy Diễn Đa Rủi Ro */}
      {gruModal.isOpen && gruModal.prediction && (() => {
        const p = gruModal.prediction;
        const outputs = parseRiskOutputs(p.risk_outputs);

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
            onClick={handleCloseGruModal}
          >
            <div
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: '14px',
                maxWidth: '1050px',
                width: '100%',
                boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.35)',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                maxHeight: '92vh',
                border: '1px solid #CBD5E1',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div
                style={{
                  flexShrink: 0,
                  padding: '16px 22px',
                  borderBottom: '1px solid #E2E8F0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  backgroundColor: '#F8FAFC',
                  flexWrap: 'wrap',
                  gap: '10px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '8px',
                      backgroundColor: '#EEF2FF',
                      border: '1px solid #C7D2FE',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Table size={18} color="#4F46E5" />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#0F172A' }}>
                        Chi Tiết Dữ Liệu Đầu Vào GRU &amp; Suy Diễn Đa Rủi Ro (Snapshot Lịch Sử)
                      </h3>
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '0.75rem',
                          color: '#6366F1',
                          backgroundColor: '#EEF2FF',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontWeight: 600,
                        }}
                      >
                        Mã #{p.id}
                      </span>
                      <span
                        style={{
                          fontSize: '0.6875rem',
                          color: '#059669',
                          backgroundColor: '#ECFDF5',
                          border: '1px solid #A7F3D0',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontWeight: 600,
                        }}
                      >
                        BẢN GHI LỊCH SỬ (AUDIT RECORD)
                      </span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '2px' }}>
                      Dịch vụ: <strong style={{ color: '#0F172A' }}>{p.workload_name || '-'}</strong> | Cụm: <strong style={{ color: '#0F172A' }}>{p.cluster_name || currentEnv?.cluster || '-'}</strong> | Thời điểm dự báo: <strong style={{ color: '#0F172A' }}>{new Date(p.predicted_at || p.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} ({new Date(p.predicted_at || p.created_at).toLocaleDateString('vi-VN')})</strong>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleCloseGruModal}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '32px',
                    height: '32px',
                    borderRadius: '6px',
                    border: '1px solid #CBD5E1',
                    backgroundColor: '#FFFFFF',
                    color: '#64748B',
                    cursor: 'pointer',
                  }}
                  title="Đóng cửa sổ"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Modal Body */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
                {/* Phần 1: Bảng Ma Trận Đầu Vào GRU Tensor [12 x 8] */}
                <div style={{ marginBottom: '22px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', flexWrap: 'wrap', gap: '6px' }}>
                    <h4 style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#334155', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      1. Bảng Ma Trận Đầu Vào GRU Tensor [12 × 8] (Bản Ghi Lịch Sử Lưu Trữ)
                    </h4>
                    <span style={{ fontSize: '0.6875rem', color: '#64748B' }}>
                      Chuỗi 12 mốc viễn trắc lưu trữ tại thời điểm suy diễn trong CSDL làm bằng chứng kiểm toán (Cố định, không nhảy realtime)
                    </span>
                  </div>

                  {gruModal.loading ? (
                    <div style={{ padding: '32px', textAlign: 'center', color: '#64748B', fontSize: '0.8125rem', backgroundColor: '#F8FAFC', borderRadius: '8px' }}>
                      <RefreshCw size={18} className="animate-spin" style={{ display: 'inline', marginRight: '8px' }} />
                      Đang nạp 12 bước dữ liệu viễn trắc lịch sử từ cơ sở dữ liệu...
                    </div>
                  ) : modalTimesteps && modalTimesteps.length > 0 ? (
                    <div style={{ overflowX: 'auto', border: '1px solid #E2E8F0', borderRadius: '8px' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', textAlign: 'center' }}>
                        <thead>
                          <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569', fontWeight: 700 }}>
                            <th style={{ padding: '9px 10px' }}>Bước</th>
                            <th style={{ padding: '9px 10px' }}>Thời Điểm</th>
                            <th style={{ padding: '9px 10px' }}>CPU (%)</th>
                            <th style={{ padding: '9px 10px' }}>RAM (%)</th>
                            <th style={{ padding: '9px 10px' }}>Disk (%)</th>
                            <th style={{ padding: '9px 10px' }}>Request Rate (req/s)</th>
                            <th style={{ padding: '9px 10px' }}>Độ Trễ Latency (ms)</th>
                            <th style={{ padding: '9px 10px' }}>HTTP 5xx (%)</th>
                            <th style={{ padding: '9px 10px' }}>Restarts</th>
                            <th style={{ padding: '9px 10px' }}>Replicas</th>
                          </tr>
                        </thead>
                        <tbody>
                          {modalTimesteps.map((row, idx) => {
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
                                <td style={{ padding: '8px 10px', fontWeight: 700, color: '#4F46E5', backgroundColor: '#EEF2FF' }}>
                                  {row.stepLabel || `T${idx + 1}`}
                                </td>
                                <td style={{ padding: '8px 10px', color: '#64748B' }}>
                                  {row.displayTime || '-'}
                                </td>
                                <td style={{ padding: '8px 10px', color: isHighCpu ? '#DC2626' : '#0F172A', fontWeight: isHighCpu ? 700 : 500 }}>
                                  {Number(row.cpu || 0).toFixed(2)}%
                                </td>
                                <td style={{ padding: '8px 10px', color: '#0F172A' }}>
                                  {Number(row.ram || 0).toFixed(2)}%
                                </td>
                                <td style={{ padding: '8px 10px', color: '#64748B' }}>
                                  {Number(row.disk || 0).toFixed(2)}%
                                </td>
                                <td style={{ padding: '8px 10px', color: isHighTraffic ? '#2563EB' : '#0F172A', fontWeight: isHighTraffic ? 700 : 500 }}>
                                  {Number(row.request_rate || 0).toFixed(2)} req/s
                                </td>
                                <td style={{ padding: '8px 10px', color: isHighLatency ? '#D97706' : '#0F172A', fontWeight: isHighLatency ? 700 : 500 }}>
                                  {Number(row.latency || 0).toFixed(2)} ms
                                </td>
                                <td style={{
                                  padding: '8px 10px',
                                  color: isSpike5xx ? '#DC2626' : '#64748B',
                                  fontWeight: isSpike5xx ? 700 : 500,
                                  backgroundColor: isSpike5xx ? '#FEE2E2' : 'transparent',
                                }}>
                                  {Number(row.http_5xx_rate || 0).toFixed(2)}%
                                </td>
                                <td style={{ padding: '8px 10px', color: row.pod_restart_count > 0 ? '#DC2626' : '#64748B' }}>
                                  {row.pod_restart_count || 0}
                                </td>
                                <td style={{ padding: '8px 10px', color: '#0F172A' }}>
                                  {row.replica_count || 1}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div style={{ padding: '24px', textAlign: 'center', color: '#94A3B8', fontSize: '0.75rem', backgroundColor: '#F8FAFC', borderRadius: '8px' }}>
                      Chưa có bản ghi chuỗi 12 điểm viễn trắc lưu trữ trong CSDL cho lượt dự báo này.
                    </div>
                  )}
                </div>

                {/* Phần 2: Bảng Phân Tích Đa Rủi Ro Của GRU (Toàn Bộ 7 Rủi Ro) */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', flexWrap: 'wrap', gap: '6px' }}>
                    <h4 style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#334155', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      2. Kết Quả Dự Báo Đa Rủi Ro GRU Multi-Head (Toàn Bộ 7 Loại Rủi Ro)
                    </h4>
                    <span style={{ fontSize: '0.6875rem', color: '#64748B' }}>
                      Mỗi loại rủi ro được tính toán độc lập qua Sigmoid riêng từ 0.0% đến 100.0%
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
                    {RISK_HEADS_CONFIG.map((head) => {
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
                            borderRadius: '8px',
                            padding: '12px 14px',
                            backgroundColor: isTriggered ? '#FEF2F2' : '#FFFFFF',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
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
                          <div style={{ fontSize: '0.6875rem', color: '#64748B', marginBottom: '8px', lineHeight: '1.3' }}>
                            {head.label}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '6px' }}>
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
                    })}
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div
                style={{
                  flexShrink: 0,
                  padding: '12px 20px',
                  borderTop: '1px solid #E2E8F0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  backgroundColor: '#F8FAFC',
                  flexWrap: 'wrap',
                  gap: '10px',
                }}
              >
                <div style={{ fontSize: '0.75rem', color: '#64748B' }}>
                  Ma trận đầu vào [12 × 8] viễn trắc snapshot lịch sử ghi nhận tại thời điểm chạy mô hình GRU (Audit Record).
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      handleSelectPrediction(p);
                      handleCloseGruModal();
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '6px 14px',
                      fontSize: '0.8125rem',
                      fontWeight: 600,
                      backgroundColor: '#3B82F6',
                      color: '#FFFFFF',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                    }}
                  >
                    <Eye size={14} />
                    <span>Soi trên Biểu đồ Viễn trắc</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleCloseGruModal}
                    style={{
                      padding: '6px 14px',
                      fontSize: '0.8125rem',
                      fontWeight: 600,
                      backgroundColor: '#FFFFFF',
                      color: '#475569',
                      border: '1px solid #CBD5E1',
                      borderRadius: '6px',
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

      {/* 8. Modal Bằng Chứng Gốc Rễ RCA & Phân Tích Chẩn Đoán AI (Đồng bộ chuẩn giao diện với Quản Lý Sự Cố) */}
      {evidenceModal.isOpen && evidenceModal.incidentModalData && (
        <RootCauseModal
          incident={evidenceModal.incidentModalData}
          onClose={handleCloseEvidenceModal}
          onResolve={handleResolveFromEvidenceModal}
        />
      )}
   </div>
  );
};

export default PredictionsPage;
