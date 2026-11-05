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

        label: 'Thay thế Pod (REPLACE_POD)',

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

        label: 'Scale Replicas',

        desc: 'Tự động nâng số lượng Replicas Pods để phân bổ tải và phục hồi năng lực dịch vụ theo chuẩn MAPE\u2011K.',

        badgeBg: '#ECFDF5',

        badgeColor: '#047857',

        badgeBorder: '#A7F3D0',

      };

    case 'ROLLBACK_DEPLOYMENT':

      return {

        label: 'Rollback Deployment',

        desc: 'Khôi phục về bản ReplicaSet ổn định trước đó nhằm triệt tiêu lỗi CrashLoop sau bản phát hành mới.',

        badgeBg: '#FEF2F2',

        badgeColor: '#B91C1C',

        badgeBorder: '#FECACA',

      };

    case 'SCALE_DOWN':

    case 'SCALE_IN':

    case 'SCALE_DOWN_CANDIDATE':

      return {

        label: 'Scale Down',

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
  const { currentOrg, currentEnv, isAgentConnected, envList, setCurrentEnv, isRefreshing, triggerRefresh, onNavigate } = useDashboard();

  const activeClusterId = currentEnv?.id || currentEnv?.clusterId || currentEnv?.cluster || '';



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

        setRegisteredWorkloads(workloadsRes.value);

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

            const filtered = prev.filter((r) => r.id !== newRec.id);

            return [newRec, ...filtered.slice(0, 49)];

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



  // Lắng nghe sự kiện phê duyệt thành công từ Cổng Phê Duyệt (ApprovalsPage)
  useEffect(() => {
    const handleApprovalEvent = (e) => {
      const recId = e.detail?.req?.recommendationId;
      const target = e.detail?.req?.targetName;
      if (recId) setAppliedActions((prev) => [...prev, recId]);
      const clusterParam = currentEnv?.cluster || currentEnv?.clusterId || currentEnv?.id;
      const orgParam = currentOrg?.id;
      aiService.getRecommendations({ limit: 50, cluster_id: clusterParam, organization_id: orgParam }).then((recs) => {
        if (Array.isArray(recs)) setRecommendations(recs);
      }).catch(() => {});
      aiService.getHealingActions({ limit: 50, cluster_id: clusterParam, organization_id: orgParam }).then((acts) => {
        if (Array.isArray(acts)) setHealingActions(acts);
      }).catch(() => {});
    };
    window.addEventListener('hitl-approval-success', handleApprovalEvent);
    return () => window.removeEventListener('hitl-approval-success', handleApprovalEvent);
  }, [currentEnv?.cluster, currentEnv?.clusterId, currentEnv?.id, currentOrg?.id]);

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



  // Thông tin số Pod và số Node của dịch vụ hiện tại (Realtime theo luồng Telemetry WebSocket & Topology)

  const currentServiceMetadata = useMemo(() => {

    if (!currentServiceTarget) return { pods: 2, nodes: 1 };



    // 1. Ưu tiên cao nhất: Đọc trực tiếp từ luồng Telemetry WebSocket thời gian thực (5s/lần)

    const liveBatch = batchProgressMap[currentServiceTarget];

    if (liveBatch) {

      const pt = liveBatch.latest_point || (Array.isArray(liveBatch.points) && liveBatch.points[liveBatch.points.length - 1]);

      if (pt && pt.replica_count !== undefined && Number(pt.replica_count) > 0) {

        return {

          pods: Number(pt.replica_count),

          nodes: 1,

        };

      }

    }



    // 2. Tra cứu từ chuỗi dự báo thời gian thực của Service

    const livePred = servicePredictionMap[currentServiceTarget];

    if (livePred?.sequence && Array.isArray(livePred.sequence) && livePred.sequence.length > 0) {

      const lastPt = livePred.sequence[livePred.sequence.length - 1];

      if (lastPt && lastPt.replica_count !== undefined && Number(lastPt.replica_count) > 0) {

        return {

          pods: Number(lastPt.replica_count),

          nodes: 1,

        };

      }

    }



    // 3. Tìm trong danh sách Workloads đồng bộ từ K8s Cluster Inventory

    if (Array.isArray(registeredWorkloads)) {

      const found = registeredWorkloads.find((w) => {

        const wName = typeof w === 'string' ? w : w?.name;

        return normalizeServiceName(wName) === currentServiceTarget;

      });

      if (found && typeof found === 'object' && found.pod_count !== undefined) {

        return {

          pods: Math.max(1, Number(found.pod_count) || 2),

          nodes: Math.max(1, Number(found.node_count) || 1),

        };

      }

    }



    // 4. Tra cứu từ khuyến nghị hành động phục hồi (nếu có scale event)

    const relatedRec = recommendations.find((r) => {

      const tName = normalizeServiceName(r.target_name || r.target_id);

      return tName === currentServiceTarget;

    });

    if (relatedRec?.action_parameters?.current_replicas) {

      return {

        pods: Number(relatedRec.action_parameters.current_replicas) || 2,

        nodes: 1,

      };

    }



    // 5. Fallback mặc định theo topology Kubernetes thực tế

    const defaults = {

      'ecommerce-store-app': { pods: 2, nodes: 1 },

      'sme-order-service': { pods: 2, nodes: 1 },

      'attack-injector-app': { pods: 2, nodes: 1 },

      'chaos-testagent2': { pods: 2, nodes: 1 },

      'mongodb': { pods: 2, nodes: 1 },

      'selfheal-test-app': { pods: 2, nodes: 1 },

    };



    return defaults[currentServiceTarget] || { pods: 2, nodes: 1 };

  }, [currentServiceTarget, batchProgressMap, servicePredictionMap, registeredWorkloads, recommendations]);





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

    let storedApplied = [];
    try {
      storedApplied = JSON.parse(sessionStorage.getItem('applied_recommendations') || '[]');
    } catch {}

    const isActionApprovedOrExecuted = (r, target) => {
      if (storedApplied.includes(r.id) || storedApplied.includes(target.toLowerCase())) {
        return true;
      }
      if (!Array.isArray(healingActions) || healingActions.length === 0) return false;
      return healingActions.some((ha) => {
        if (ha.recommendation_id && ha.recommendation_id === r.id) {
          return ha.approval_status === 'APPROVED' || ha.execution_status === 'SUCCEEDED' || ha.execution_status === 'RUNNING';
        }
        const haTarget = (ha.target_name || ha.target_id || '').toLowerCase();
        const rTarget = target.toLowerCase();
        const haAction = (ha.action_type_code || ha.action_code || '').toUpperCase().trim();
        const rAction = (r.recommendation || r.action_code || '').toUpperCase().trim();
        if (haTarget && rTarget && haTarget === rTarget && haAction && rAction && haAction === rAction) {
          return ha.approval_status === 'APPROVED' || ha.execution_status === 'SUCCEEDED' || ha.execution_status === 'RUNNING';
        }
        return false;
      });
    };

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



      const isApplied = r.status === 'APPLIED' || appliedActions.includes(r.id) || isActionApprovedOrExecuted(r, target);

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

    // Lọc bỏ các mục đã kích hoạt thành công (APPLIED), các mục bị từ chối (DISMISSED) và các mục trạng thái an toàn (NO_ACTION)
    const activeActionableRecs = res.filter((r) => {
      const code = String(r.recommendation || r.action_code || '').toUpperCase().trim();
      const isApplied = r.status === 'APPLIED' || appliedActions.includes(r.id) || isActionApprovedOrExecuted(r, r.target_name || '');
      const isNoAction = code === 'NO_ACTION' || code === 'NO ACTION' || code.includes('NO_ACTION');
      const isDismissed = r.status === 'DISMISSED';
      return !isApplied && !isNoAction && !isDismissed;
    });

    return activeActionableRecs;

  }, [isAgentConnected, recommendations, appliedActions, healingActions, bottomServiceFilter]);



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



  // Phân trang 10 mục mỗi trang cho cả 3 tab bên dưới

  const ITEMS_PER_PAGE = 10;

  const [recPage, setRecPage] = useState(1);

  const [actPage, setActPage] = useState(1);

  const [predPage, setPredPage] = useState(1);



  useEffect(() => {

    setRecPage(1);

    setActPage(1);

    setPredPage(1);

  }, [bottomServiceFilter, logWorkloadFilter, selectedTypeFilter, currentEnv?.id, currentEnv?.cluster]);



  const recTotalPages = Math.max(1, Math.ceil(displayRecommendations.length / ITEMS_PER_PAGE));

  const actTotalPages = Math.max(1, Math.ceil(displayHealingActions.length / ITEMS_PER_PAGE));

  const predTotalPages = Math.max(1, Math.ceil(displayPredictions.length / ITEMS_PER_PAGE));



  const safeRecPage = Math.min(recPage, recTotalPages);

  const safeActPage = Math.min(actPage, actTotalPages);

  const safePredPage = Math.min(predPage, predTotalPages);



  const paginatedRecommendations = useMemo(() => {

    const start = (safeRecPage - 1) * ITEMS_PER_PAGE;

    return displayRecommendations.slice(start, start + ITEMS_PER_PAGE);

  }, [displayRecommendations, safeRecPage]);



  const paginatedHealingActions = useMemo(() => {

    const start = (safeActPage - 1) * ITEMS_PER_PAGE;

    return displayHealingActions.slice(start, start + ITEMS_PER_PAGE);

  }, [displayHealingActions, safeActPage]);



  const paginatedPredictions = useMemo(() => {

    const start = (safePredPage - 1) * ITEMS_PER_PAGE;

    return displayPredictions.slice(start, start + ITEMS_PER_PAGE);

  }, [displayPredictions, safePredPage]);



  const renderPaginationBar = (currentPage, totalItems, onPageChange) => {

    const totalPages = Math.max(1, Math.ceil(totalItems / ITEMS_PER_PAGE));

    if (totalItems <= 0) return null;

    const startIdx = (currentPage - 1) * ITEMS_PER_PAGE + 1;

    const endIdx = Math.min(currentPage * ITEMS_PER_PAGE, totalItems);



    const pages = [];

    for (let i = 1; i <= totalPages; i++) {

      if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {

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

          marginTop: '16px',

          paddingTop: '14px',

          borderTop: '1px solid #E2E8F0',

        }}

      >

        <div style={{ fontSize: '0.78125rem', color: '#64748B', fontWeight: 500 }}>

          Hiển thị <strong style={{ color: '#0F172A' }}>{startIdx}–{endIdx}</strong> trong tổng số{' '}

          <strong style={{ color: '#0F172A' }}>{totalItems}</strong> mục (10 mục / trang)

        </div>



        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>

          <button

            type="button"

            disabled={currentPage <= 1}

            onClick={() => onPageChange(Math.max(1, currentPage - 1))}

            style={{

              padding: '5px 10px',

              fontSize: '0.75rem',

              fontWeight: 600,

              borderRadius: '6px',

              border: '1px solid #CBD5E1',

              backgroundColor: currentPage <= 1 ? '#F8FAFC' : '#FFFFFF',

              color: currentPage <= 1 ? '#94A3B8' : '#334155',

              cursor: currentPage <= 1 ? 'not-allowed' : 'pointer',

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

                  border: currentPage === p ? '1px solid #2563EB' : '1px solid #CBD5E1',

                  backgroundColor: currentPage === p ? '#2563EB' : '#FFFFFF',

                  color: currentPage === p ? '#FFFFFF' : '#334155',

                  cursor: 'pointer',

                }}

              >

                {p}

              </button>

            )

          )}



          <button

            type="button"

            disabled={currentPage >= totalPages}

            onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}

            style={{

              padding: '5px 10px',

              fontSize: '0.75rem',

              fontWeight: 600,

              borderRadius: '6px',

              border: '1px solid #CBD5E1',

              backgroundColor: currentPage >= totalPages ? '#F8FAFC' : '#FFFFFF',

              color: currentPage >= totalPages ? '#94A3B8' : '#334155',

              cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer',

            }}

          >

            Sau &raquo;

          </button>

        </div>

      </div>

    );

  };





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
                Phân loại rủi ro đa nhãn thời gian thực bằng mô hình GRU PyTorch
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

          <div style={{ marginBottom: '14px' }}>

            {/* Hàng Tiêu đề & Nút Info minh bạch (i) ở góc phải */}

            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>

              <div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>

                  <Layers size={18} color="#3B82F6" />

                  <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--dash-text-primary)', margin: 0 }}>

                    Chuỗi 12 Mốc Viễn Trắc Đầu Vào Của GRU (60 Giây)

                  </h3>

                </div>

                {isAgentConnected && currentServiceTarget && (

                  <p style={{ fontSize: '0.75rem', color: 'var(--dash-text-secondary)', margin: '4px 0 0 0', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>

                    <span>Quy mô: <strong style={{ fontFamily: 'var(--font-mono)', color: '#15803D' }}>{currentServiceMetadata.pods} Pods</strong> / <strong style={{ fontFamily: 'var(--font-mono)', color: '#475569' }}>{currentServiceMetadata.nodes} Node</strong></span>

                  </p>

                )}

              </div>



              {/* Nút Logo Thông Báo Minh Bạch (Honest Telemetry Hover Popover) ở góc phải hàng tiêu đề */}

              <div

                style={{ position: 'relative', flexShrink: 0 }}

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

                    width: '30px',

                    height: '30px',

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

                  <Info size={16} />

                </button>



                {isHoverInfo && (

                  <div

                    style={{

                      position: 'absolute',

                      top: '36px',

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



            {/* Hàng ngang điều khiển: Dịch vụ Dropdown + Các nút chuyển đổi */}

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '12px', flexWrap: 'wrap' }}>

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

                      padding: '3px 22px 3px 8px',

                      fontSize: '0.75rem',

                      fontWeight: 600,

                      color: '#1D4ED8',

                      backgroundColor: '#EFF6FF',

                      border: '1px solid #3B82F6',

                      borderRadius: '5px',

                      outline: 'none',

                      cursor: 'pointer',

                      appearance: 'none',

                      WebkitAppearance: 'none',

                      MozAppearance: 'none',

                      transition: 'all 0.15s ease',

                      boxShadow: '0 1px 2px rgba(59, 130, 246, 0.08)',

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

                    size={12}

                    color="#2563EB"

                    style={{

                      position: 'absolute',

                      right: '6px',

                      pointerEvents: 'none',

                    }}

                  />

                </div>

              )}



              {/* 3 nút thao tác nhanh nằm ngang hàng với Dịch vụ */}

              <button

                type="button"

                onClick={setCpuRamOnly}

                style={{

                  padding: '5px 10px',

                  fontSize: '0.75rem',

                  fontWeight: 600,

                  backgroundColor: '#EFF6FF',

                  color: '#1D4ED8',

                  border: '1px solid #BFDBFE',

                  borderRadius: '6px',

                  cursor: 'pointer',

                }}

              >

                Chỉ CPU & RAM

              </button>



              <button

                type="button"

                onClick={setAllSeries}

                style={{

                  padding: '5px 10px',

                  fontSize: '0.75rem',

                  fontWeight: 600,

                  backgroundColor: '#F8FAFC',

                  color: '#475569',

                  border: '1px solid #CBD5E1',

                  borderRadius: '6px',

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

                  padding: '5px 10px',

                  fontSize: '0.75rem',

                  fontWeight: 600,

                  backgroundColor: scaleMode === 'auto' ? '#EDE9FE' : '#F1F5F9',

                  color: scaleMode === 'auto' ? '#7C3AED' : '#475569',

                  border: '1px solid #CBD5E1',

                  borderRadius: '6px',

                  cursor: 'pointer',

                }}

              >

                <Sliders size={12} />

                <span>Thang: {scaleMode === 'auto' ? 'Tự co giãn' : '0 - 100%'}</span>

              </button>

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
              <BarChart2 size={18} color="#7C3AED" />
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--dash-text-primary)', margin: 0 }}>
                Hồ Sơ Xác Suất Rủi Ro
              </h3>
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



          <div style={{ marginTop: '14px', paddingTop: '10px', borderTop: '1px solid #F1F5F9', fontSize: '0.6875rem', color: '#64748B', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>


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

    </div>
  );
};

export default PredictionsPage;
