import React, { useState, useEffect, useMemo } from 'react';
import { aiService } from '../../../services/aiService';
import {
  X,
  GitBranch,
  CheckCircle2,
  Zap,
  Check,
  Copy,
  Activity,
  Sliders,
  FileText,
  Sparkles,
  RefreshCw,
  AlertTriangle,
  Database,
  ShieldAlert,
  ShieldCheck,
  BookOpen,
  ChevronRight,
  ChevronDown,
  History,
  Clock,
  Box,
  Layers,
  Terminal,
  Info,
  HelpCircle,
  XCircle,
} from 'lucide-react';

const ACTION_DISPLAY_NAMES = {
  SCALE_REPLICAS: 'Scale Replicas',
  RESTART_POD: 'Restart Pod',
  REPLACE_POD: 'Replace Pod',
  DRAIN_NODE: 'Drain Node',
  RESTART_DEPLOYMENT: 'Restart Deployment',
  ROLLBACK_DEPLOYMENT: 'Rollback Deployment',
  CLEANUP_STORAGE: 'Cleanup Storage',
  TEMPORARY_IP_BLOCK: 'Temporary IP Block',
};

const getTimelineShortReason = (reason, code) => {
  if (!reason) return 'Thao tác không thành công.';
  const r = String(reason).toLowerCase();
  if (r.includes('daemonset') || r.includes('cannot scale')) return 'Không thể scale DaemonSet.';
  if (r.includes('agent không phản hồi') || r.includes('agent chưa phản hồi') || r.includes('quá thời gian chờ') || r.includes('timeout')) return 'Agent không phản hồi.';
  if (r.includes('chưa giải quyết triệt để') || r.includes('vẫn lỗi') || r.includes('hậu kiểm') || r.includes('sau hành động')) return 'Kiểm tra sau hành động vẫn lỗi.';
  if (r.includes('1 node') || r.includes('chỉ có 1 node') || r.includes('không có node dự phòng') || r.includes('single-node')) return 'Cụm chỉ có 1 Node.';
  if (r.includes('oom') || r.includes('cạn kiệt') || r.includes('ram')) return 'Container bị tràn RAM (OOM).';
  if (r.includes('crashloop') || r.includes('sập')) return 'Pod bị CrashLoopBackOff.';
  return reason.length > 50 ? `${reason.substring(0, 48)}...` : reason;
};

const getTimelineStatusBadge = (st) => {
  const code = String(st.code || '').toUpperCase();
  const reason = String(st.reason || '').toLowerCase();
  if (code === 'DRAIN_NODE' || reason.includes('bị chặn') || reason.includes('không có node') || reason.includes('1 node')) {
    return { label: 'Bị chặn', bg: '#FEF3C7', color: '#D97706', border: '#FDE68A' };
  }
  if (st.isVerifiedSuccess) {
    return { label: 'Thành công', bg: '#DCFCE7', color: '#16A34A', border: '#86EFAC' };
  }
  if (st.isVerifying) {
    return { label: 'Đang kiểm tra', bg: '#DBEAFE', color: '#2563EB', border: '#BFDBFE' };
  }
  if (reason.includes('chưa giải quyết triệt để') || reason.includes('vẫn lỗi') || reason.includes('chưa phục hồi') || st.metrics) {
    return { label: 'Chưa phục hồi', bg: '#FEE2E2', color: '#DC2626', border: '#FECACA' };
  }
  return { label: 'Thất bại', bg: '#FEE2E2', color: '#DC2626', border: '#FECACA' };
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

// Tên tiếng Việt thân thiện, chuẩn SRE cho 7 Heads mô hình học sâu GRU
const HEAD_NAMES_VI = {
  CPU_OVERLOAD: 'Quá tải vi xử lý CPU (CPU_OVERLOAD)',
  OOM: 'Cạn kiệt bộ nhớ RAM (OOM)',
  DISK_FULL: 'Đầy dung lượng ổ đĩa (DISK_FULL)',
  HIGH_LATENCY: 'Độ trễ phản hồi tăng cao (HIGH_LATENCY)',
  HTTP_5XX_SPIKE: 'Đột biến lỗi máy chủ (HTTP 5xx)',
  TRAFFIC_OVERLOAD: 'Quá tải lưu lượng truy cập (TRAFFIC_OVERLOAD)',
  SCALE_DOWN_CANDIDATE: 'Thu hẹp Pod dư thừa (SCALE_DOWN)',
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
  'POD_INSTABILITY',
  'SCALE_DOWN_CANDIDATE',
]);

// Bộ từ điển chuẩn hóa SRE 100% Tiếng Việt
const SRE_DICTIONARY_VI = {
  // 1. Root causes
  'Service performance degradation': 'Suy giảm hiệu năng dịch vụ',
  'Container memory exhausted': 'Cạn kiệt bộ nhớ container (OOM)',
  'Storage capacity exhausted': 'Cạn kiệt dung lượng lưu trữ',
  'CPU saturation': 'Bão hòa tài nguyên CPU',
  'Traffic overload': 'Quá tải lưu lượng truy cập',
  'Unstable application pod': 'Pod ứng dụng bất ổn định / CrashLoop',
  'Deployment failure': 'Lỗi triển khai phiên bản mới',
  'Upstream dependency failure': 'Lỗi dịch vụ phụ thuộc thượng nguồn',
  'Application errors': 'Lỗi ứng dụng nội bộ (HTTP 5xx)',
  'Insufficient available replicas': 'Không đủ số lượng Pod replica',
  'Kubernetes scheduling failure': 'Lỗi lập lịch điều phối Kubernetes',
  'Workload underutilized (scale down opportunity)': 'Tài nguyên dư thừa (Có thể thu hẹp quy mô)',
  'OOM_WIREDTIGER_CACHE_PRESSURE_DUE_TO_UNINDEXED_QUERY': 'Tràn bộ nhớ đệm WiredTiger do truy vấn quét thiếu chỉ mục (Index)',
  'UNKNOWN': 'CHƯA XÁC ĐỊNH (THIẾU BẰNG CHỨNG XÁC THỰC)',

  // 2. Categories
  'DATABASE_RESOURCE_SATURATION': 'BÃO HÒA TÀI NGUYÊN CSDL',
  'INFRASTRUCTURE_SATURATION': 'BÃO HÒA HẠ TẦNG',
  'APPLICATION_SATURATION': 'QUÁ TẢI ỨNG DỤNG',
  'NETWORK_CONGESTION': 'NGHẼN MẠNG',
  'INSUFFICIENT_EVIDENCE': 'CHƯA ĐỦ BẰNG CHỨNG XÁC THỰC',

  // 3. Severities & Priorities
  'CRITICAL': 'KHẨN CẤP',
  'HIGH': 'CAO',
  'MEDIUM': 'TRUNG BÌNH',
  'LOW': 'THẤP',

  // 4. Actions
  'NO_ACTION': 'NGẮT MẠCH AN TOÀN (NO_ACTION)',
  'TEMPORARY_IP_BLOCK': 'CHẶN TẠM THỜI IP NGUỒN',
  'RESTART_POD': 'KHỞI ĐỘNG LẠI POD',
  'REPLACE_POD': 'THAY THẾ POD (REPLACE)',
  'DRAIN_NODE': 'DI DỜI POD KHỎI NODE LỖI (DRAIN_NODE)',
  'SCALE_REPLICAS': 'MỞ RỘNG POD REPLICAS',
  'ROLLBACK_DEPLOYMENT': 'ROLLBACK DEPLOYMENT',
  'CLEANUP_STORAGE': 'DỌN DẸP LƯU TRỮ',
  'RESTART_DEPLOYMENT': 'ROLLING RESTART DEPLOYMENT',

  // 5. Risks
  'CPU_OVERLOAD': 'QUÁ TẢI CPU',
  'OOM': 'TRÀN BỘ NHỚ RAM (OOM)',
  'DISK_FULL': 'CẠN KIỆT Ổ ĐĨA',
  'HIGH_LATENCY': 'ĐỘ TRỄ CAO',
  'HTTP_5XX_SPIKE': 'ĐỘT BIẾN LỖI 5XX',
  'TRAFFIC_OVERLOAD': 'QUÁ TẢI TRUY CẬP',
  'UNSTABLE_POD': 'POD BẤT ỔN ĐỊNH',
  'POD_INSTABILITY': 'POD BẤT ỔN ĐỊNH',
  'SCALE_DOWN_CANDIDATE': 'XU HƯỚNG CÓ THỂ GIẢM REPLICA',
};

// Hàm dịch động thông minh nhận diện mẫu câu log & giải trình cho cả dữ liệu cũ trong DB
const translateSREText = (text) => {
  if (!text || typeof text !== 'string') return text;
  const trimmed = text.trim();
  if (SRE_DICTIONARY_VI[trimmed]) return SRE_DICTIONARY_VI[trimmed];

  // Regex patterns
  if (/^Current incident evidence most strongly supports (.+?)\.?$/i.test(trimmed)) {
    const match = trimmed.match(/^Current incident evidence most strongly supports (.+?)\.?$/i);
    const sub = match[1].trim();
    const subVi = SRE_DICTIONARY_VI[sub] || sub;
    return `Bằng chứng sự cố hiện tại ủng hộ mạnh nhất nguyên nhân: ${subVi}.`;
  }

  if (/No safe infrastructure action is justified by the available evidence/i.test(trimmed)) {
    return 'Chưa có hành động hạ tầng nào đủ an toàn dựa trên bằng chứng hiện tại (Kích hoạt Circuit Breaker chuyển giao kỹ sư duyệt HITL).';
  }

  if (/^Latency is above normal \(([\d\.]+)\s*ms\)/i.test(trimmed)) {
    const match = trimmed.match(/^Latency is above normal \(([\d\.]+)\s*ms\)/i);
    return `Độ trễ xử lý cao hơn bình thường (${match[1]} ms)`;
  }

  if (/Readiness probe is failing/i.test(trimmed)) {
    return 'Kiểm tra tính sẵn sàng (Readiness probe) thất bại';
  }

  if (/Liveness probe is failing/i.test(trimmed)) {
    return 'Kiểm tra tính sống còn (Liveness probe) thất bại';
  }

  if (/Container was OOMKilled/i.test(trimmed)) {
    return 'Container bị tiêu diệt do tràn bộ nhớ (OOMKilled exitCode 137)';
  }

  if (/Pod is in CrashLoopBackOff/i.test(trimmed)) {
    return 'Pod bị rơi vào vòng lặp sập liên tục (CrashLoopBackOff)';
  }

  if (/^Pod restarted multiple times \((\d+)\)/i.test(trimmed)) {
    const match = trimmed.match(/^Pod restarted multiple times \((\d+)\)/i);
    return `Pod đã khởi động lại nhiều lần liên tiếp (${match[1]} lần)`;
  }

  if (/^CPU usage is critically high \(([\d\.]+%)\)/i.test(trimmed)) {
    const match = trimmed.match(/^CPU usage is critically high \(([\d\.]+%)\)/i);
    return `Mức sử dụng CPU ở ngưỡng nguy hiểm (${match[1]})`;
  }

  if (/^RAM usage is critically high \(([\d\.]+%)\)/i.test(trimmed)) {
    const match = trimmed.match(/^RAM usage is critically high \(([\d\.]+%)\)/i);
    return `Mức sử dụng RAM ở ngưỡng nguy hiểm (${match[1]})`;
  }

  if (/^Disk usage is critically high \(([\d\.]+%)\)/i.test(trimmed)) {
    const match = trimmed.match(/^Disk usage is critically high \(([\d\.]+%)\)/i);
    return `Mức sử dụng ổ đĩa ở ngưỡng nguy hiểm (${match[1]})`;
  }

  if (/^HTTP 5xx rate is high \(([\d\.]+%)\)/i.test(trimmed)) {
    const match = trimmed.match(/^HTTP 5xx rate is high \(([\d\.]+%)\)/i);
    return `Tỷ lệ lỗi HTTP 5xx ở mức cao (${match[1]})`;
  }

  if (/^Request rate is high \(([\d\.]+)\)/i.test(trimmed)) {
    const match = trimmed.match(/^Request rate is high \(([\d\.]+)\)/i);
    return `Lưu lượng yêu cầu (Request rate) tăng cao (${match[1]})`;
  }

  if (/The affected pod is unhealthy or repeatedly restarting/i.test(trimmed)) {
    return 'Pod bị ảnh hưởng đang ở trạng thái không khỏe mạnh hoặc liên tục khởi động lại.';
  }

  if (/Additional replicas can distribute load and restore service capacity/i.test(trimmed)) {
    return 'Bổ sung số lượng Pod replica để phân phối tải và phục hồi năng lực xử lý.';
  }

  if (/Security anomaly detected from source IP/i.test(trimmed)) {
    const match = trimmed.match(/source IP ([\d\.]+)/i);
    return `Phát hiện bất thường bảo mật từ IP nguồn ${match ? match[1] : ''}; tạm thời chặn IP để bảo vệ dịch vụ.`;
  }

  if (/Action history recorded (\d+) consecutive failure\(s\)/i.test(trimmed)) {
    const match = trimmed.match(/recorded (\d+) consecutive failure\(s\)/i);
    return `Lịch sử hành động ghi nhận ${match ? match[1] : 2} lần thất bại liên tiếp (Kích hoạt Circuit Breaker chống lặp vô hạn).`;
  }

  if (/^Previous (.+?) action result was (.+?)$/i.test(trimmed)) {
    const match = trimmed.match(/^Previous (.+?) action result was (.+?)$/i);
    return `Hành động ${match[1]} trước đó có kết quả: ${match[2]}.`;
  }

  return trimmed;
};

const parseAnalysisPayload = (raw) => {
  if (!raw) return null;
  try {
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    return null;
  }
};

// Tên tiếng Việt chuẩn SRE cho các loại rủi ro dự báo từ GRU
const GRU_RISK_NAMES_VI = {
  SCALE_DOWN_CANDIDATE: 'Dự báo khả năng giảm replica',
  OOM: 'Nguy cơ cạn kiệt bộ nhớ RAM',
  CPU_OVERLOAD: 'Nguy cơ quá tải xử lý CPU',
  HIGH_LATENCY: 'Nguy cơ tăng cao độ trễ phản hồi',
  HTTP_5XX_SPIKE: 'Nguy cơ đột biến lỗi ứng dụng 5xx',
  TRAFFIC_OVERLOAD: 'Nguy cơ quá tải lưu lượng truy cập',
  DISK_FULL: 'Nguy cơ đầy dung lượng ổ đĩa',
};

// Từ điển câu hỏi nghiệp vụ SRE Checklist ngắn gọn (chỉ câu hỏi ngắn, tham số kỹ thuật đưa vào tooltip)
const SRE_CHECKLIST_QUESTIONS = {
  'Application health endpoint response': {
    tech: 'Application health endpoint response',
    question: 'Ứng dụng có mở cổng kiểm tra sức khỏe không?',
    detail: 'Kiểm tra xem ứng dụng có thực sự đang chạy và phản hồi HTTP 200 tại cổng/endpoint kiểm tra sức khỏe (/health) không.',
  },
  'Probe configuration': {
    tech: 'Probe configuration',
    question: 'Cấu hình Probe có chính xác không?',
    detail: 'Kiểm tra cấu hình Liveness/Readiness Probe (cổng port, đường dẫn path, timeout, periodSeconds) có khớp với thiết kế của ứng dụng không.',
  },
  'Application logs': {
    tech: 'Application logs',
    question: 'Log ứng dụng có ghi nhận lỗi khởi động không?',
    detail: 'Nhật ký ứng dụng (Application logs) có ghi nhận lỗi ngoại lệ khi khởi động (exception/panic/database connection error) không.',
  },
  'CPU throttling metrics': {
    tech: 'CPU throttling metrics',
    question: 'CPU có bị giới hạn quá mức không?',
    detail: 'Ứng dụng có bị bóp nghẽn CPU (CPU throttling) do giới hạn tài nguyên (cpu limit) bị đặt quá thấp không.',
  },
  'Historical latency': {
    tech: 'Historical latency',
    question: 'Latency trước sự cố có tăng không?',
    detail: 'Độ trễ xử lý (Latency) trước thời điểm xảy ra sự cố có dấu hiệu tăng đột biến bất thường không.',
  },
  'Kubernetes events chưa được cung cấp': {
    tech: 'Kubernetes events',
    question: 'Kubernetes Events có ghi nhận cảnh báo bất thường không?',
    detail: 'Cần kiểm tra bảng Kubernetes Events của Pod/Namespace xem có cảnh báo bất thường nào từ cụm không.',
  },
};

const getSREChecklistQuestion = (rawKey) => {
  const trimmed = String(rawKey || '').trim();
  if (SRE_CHECKLIST_QUESTIONS[trimmed]) {
    return SRE_CHECKLIST_QUESTIONS[trimmed];
  }
  return {
    tech: trimmed,
    question: translateSREText(trimmed),
    detail: trimmed,
  };
};

// Helper phân tích và bóc tách thông tin kỹ thuật K8s gốc kèm diễn giải SRE trực quan
const parseSREEventEvidence = (raw) => {
  if (!raw) {
    return {
      originalText: '',
      title: 'Bất thường viễn trắc',
      podName: null,
      count: 1,
      port: null,
      ip: null,
      url: null,
      timestamp: null,
      errorSnippet: 'Bất thường viễn trắc',
      explanation: 'Ghi nhận tín hiệu bất thường qua viễn trắc.',
      rawLog: '',
    };
  }
  const str = String(raw).trim();
  const lower = str.toLowerCase();

  // 1. Trích xuất tên Pod nếu có
  const podMatch = str.match(/(?:Pod|pod)[:\s]+([a-zA-Z0-9_\-\.]+)/i);
  const podName = podMatch ? podMatch[1] : null;

  // 2. Trích xuất số lần xảy ra (count)
  const countMatch = str.match(/\(count:\s*(\d+)\)/i) || str.match(/\((\d+)\s*(?:lần|times)\)/i);
  const count = countMatch ? parseInt(countMatch[1], 10) : 1;

  // 3. Trích xuất timestamp
  const timeMatch = str.match(/\[(\d{4}-\d{2}-\d{2}T[\d:\.]+Z?)\]/);
  const timestamp = timeMatch ? timeMatch[1] : null;

  // 4. Trích xuất URL, IP, Port
  const urlMatch = str.match(/(?:Get|Post|Put|Delete)\s+"([^"]+)"/i) || str.match(/(https?:\/\/[^\s"']+)/i);
  const url = urlMatch ? urlMatch[1] : null;

  const portMatch = str.match(/:(\d{2,5})(?:[\/\s"'\)]|$)/) || (url && url.match(/:(\d{2,5})/));
  const port = portMatch ? portMatch[1] : null;

  const ipMatch = str.match(/(?:dial tcp\s+|http:\/\/)([\d\.]+):/) || str.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/);
  const ip = ipMatch ? ipMatch[1] || ipMatch[0] : null;

  // 5. Xác định tên triệu chứng (title)
  let title = 'Bất thường viễn trắc';
  if (lower.includes('liveness probe failed') || lower.includes('liveness probe') || lower.includes('tính sống còn')) {
    title = 'Liveness Probe thất bại';
  } else if (lower.includes('readiness probe failed') || lower.includes('readiness probe') || lower.includes('tính sẵn sàng')) {
    title = 'Readiness Probe thất bại';
  } else if (lower.includes('startup probe failed') || lower.includes('startup probe')) {
    title = 'Startup Probe thất bại';
  } else if (lower.includes('oomkilled') || lower.includes('exit code 137') || lower.includes('exitcode 137')) {
    title = 'Container bị OOMKilled';
  } else if (lower.includes('crashloopbackoff') || lower.includes('back-off restarting')) {
    title = 'Pod rơi vào CrashLoopBackOff';
  } else if (lower.includes('imagepullbackoff') || lower.includes('errimagepull')) {
    title = 'Không thể tải Image (ImagePullBackOff)';
  } else if (lower.includes('failedscheduling')) {
    title = 'Không thể xếp lịch Pod (FailedScheduling)';
  } else if (str.includes(':')) {
    title = translateSREText(str.split(':')[0].trim());
  } else {
    title = translateSREText(str);
  }

  // 6. Xác định lỗi vắn tắt (errorSnippet) và 1 câu giải thích tiếng Việt ngắn (explanation)
  let errorSnippet = null;
  let explanation = null;

  if (lower.includes('connection refused') || lower.includes('connect: connection refused')) {
    errorSnippet = 'connection refused';
    explanation = `Không thể kết nối tới cổng ${port || '8080'} của ứng dụng.`;
  } else if (lower.includes('context deadline exceeded') || lower.includes('client.timeout') || lower.includes('timeout exceeded')) {
    errorSnippet = 'context deadline exceeded (timeout)';
    explanation = 'Ứng dụng không phản hồi kịp trong thời gian Kubernetes cho phép.';
  } else if (lower.includes('oomkilled') || lower.includes('exit code 137') || lower.includes('exitcode 137')) {
    errorSnippet = 'exitCode 137 (OOM)';
    explanation = 'Tiến trình bị hệ điều hành tiêu diệt do cạn kiệt bộ nhớ RAM.';
  } else if (lower.includes('crashloopbackoff') || lower.includes('back-off restarting')) {
    errorSnippet = 'CrashLoopBackOff';
    explanation = 'Pod bị rơi vào vòng lặp sập và khởi động lại liên tục.';
  } else if (lower.includes('imagepullbackoff') || lower.includes('errimagepull')) {
    errorSnippet = 'ErrImagePull';
    explanation = 'Không thể tải container image từ Registry.';
  } else if (lower.includes('failedscheduling')) {
    errorSnippet = 'FailedScheduling';
    explanation = 'Kubernetes Scheduler không thể xếp lịch do thiếu tài nguyên hoặc Node phù hợp.';
  } else {
    errorSnippet = 'Bất thường hoạt động';
    explanation = translateSREText(str);
  }

  // Trích xuất log K8s gốc nguyên bản
  let rawLog = str;
  const quoteMatch = str.match(/:\s*['"](\[.+?\][\s\S]+?)['"]$/);
  if (quoteMatch) {
    rawLog = quoteMatch[1];
  }

  return {
    originalText: str,
    title,
    podName,
    count,
    port,
    ip,
    url,
    timestamp,
    errorSnippet,
    explanation,
    rawLog,
  };
};

export const RootCauseModal = ({ incident, onClose, onResolve, onNavigate }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [isTimelineExpanded, setIsTimelineExpanded] = useState(false);
  const [isPlaybookExpanded, setIsPlaybookExpanded] = useState(false);
  const [isEvidenceDrawerOpen, setIsEvidenceDrawerOpen] = useState(false);
  const [isChecklistDrawerOpen, setIsChecklistDrawerOpen] = useState(false);
  const [isGruDrawerOpen, setIsGruDrawerOpen] = useState(false); // 'overview' | 'io'
  const [copiedKey, setCopiedKey] = useState(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [evidenceList, setEvidenceList] = useState(incident?.evidences || []);
  const [incidentDetail, setIncidentDetail] = useState(null);
  const [parsedAnalysis, setParsedAnalysis] = useState(() =>
    parseAnalysisPayload(incident?.analysis_result ?? incident?.analysisResult)
  );
  const [predictionInputs, setPredictionInputs] = useState([]);
  const [isLoadingDetail, setIsLoadingDetail] = useState(() =>
    Boolean(incident?.rawId || incident?.id)
  );
  const [expandedSymptomKeys, setExpandedSymptomKeys] = useState(new Set());
  const [isExpandedEvidenceList, setIsExpandedEvidenceList] = useState(false);
  const [expandedSymptoms, setExpandedSymptoms] = useState({});
  const [isEvidenceForExpanded, setIsEvidenceForExpanded] = useState(false);

  const toggleSymptomKey = (key) => {
    setExpandedSymptomKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const toggleSymptom = (groupKey) => {
    setExpandedSymptoms((prev) => ({
      ...prev,
      [groupKey]: !prev[groupKey],
    }));
  };

  const handleCopyText = (text, key) => {
    if (!text) return;
    navigator.clipboard?.writeText(typeof text === 'string' ? text : JSON.stringify(text, null, 2));
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  useEffect(() => {
    let isMounted = true;
    const targetId = incident?.rawId || incident?.id;

    setIncidentDetail(null);
    setPredictionInputs([]);
    setEvidenceList(incident?.evidences || []);
    setParsedAnalysis(parseAnalysisPayload(incident?.analysis_result ?? incident?.analysisResult));

    if (!targetId) {
      setIsLoadingDetail(false);
      return () => {
        isMounted = false;
      };
    }

    setIsLoadingDetail(true);
    const initialPredId = incident?.predictionId || incident?.prediction_id;

    (async () => {
      try {
        const [evData, detailData, initialInputs] = await Promise.all([
          aiService.getIncidentEvidences(targetId),
          aiService.getIncidentDetail(targetId),
          initialPredId ? aiService.getPredictionInputs(initialPredId) : Promise.resolve(null),
        ]);
        if (!isMounted) return;

        const items = Array.isArray(evData) ? evData : evData?.items || [];
        if (items.length > 0) {
          const mapped = items.map((ev) => {
            let summary = '';
            try {
              const d = typeof ev.evidence_data === 'string' ? JSON.parse(ev.evidence_data) : ev.evidence_data;
              summary = d?.summary || JSON.stringify(d);
            } catch {
              summary = String(ev.evidence_data || ev.source_reference || '');
            }
            const hasScore =
              ev.importance_score !== undefined &&
              ev.importance_score !== null &&
              !Number.isNaN(Number(ev.importance_score));
            const rawScore = hasScore ? Number(ev.importance_score) : null;
            return {
              type: ev.source_type || 'AI_TELEMETRY',
              ref: ev.source_reference || incident?.service,
              summary: translateSREText(summary) || 'Ghi nhận bất thường qua viễn trắc',
              score: rawScore !== null ? `${Math.round(rawScore <= 1 ? rawScore * 100 : rawScore)}%` : null,
            };
          });
          setEvidenceList(mapped);
        }

        if (detailData) {
          setIncidentDetail(detailData);
          const parsed = parseAnalysisPayload(detailData.analysis_result);
          if (parsed) {
            setParsedAnalysis(parsed);
          }
        }

        if (Array.isArray(initialInputs)) {
          setPredictionInputs(initialInputs);
        } else {
          const predId = detailData?.prediction_id || initialPredId;
          if (predId) {
            try {
              const inputs = await aiService.getPredictionInputs(predId);
              if (isMounted && Array.isArray(inputs)) {
                setPredictionInputs(inputs);
              }
            } catch {}
          }
        }
      } catch (err) {
        console.warn('[RootCauseModal] Lỗi nạp chi tiết:', err);
      } finally {
        if (isMounted) setIsLoadingDetail(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [incident?.rawId, incident?.id, incident?.service, incident?.predictionId, incident?.prediction_id, incident?.analysis_result, incident?.analysisResult, incident?.evidences]);

  const isApprovalContext = Boolean(
    incident?.fromApprovals === true ||
    incident?.hasPendingApproval === true ||
    incident?.approvalId ||
    incident?.pendingApprovalId ||
    incident?.approvalStatus === 'PENDING' ||
    (typeof window !== 'undefined' && (
      window.location.pathname.includes('/approvals') ||
      window.location.href.includes('approvals')
    ))
  );

  const hasActualPendingApproval = Boolean(
    isApprovalContext ||
    incidentDetail?.has_pending_approval === true ||
    incidentDetail?.pending_approval_id ||
    incident?.hasPendingApproval === true ||
    incident?.pendingApprovalId
  );

  // QUAN TRỌNG: Chỉ coi là "ĐÃ KHẮC PHỤC" khi sự cố thực sự đã RESOLVED (đã vượt qua bước Verification 12 điểm viễn trắc)
  const isResolved = !hasActualPendingApproval && (
    (incidentDetail?.status || incident?.status || '').toLowerCase().includes('resolve') ||
    (incident?.status && incident?.status.includes('hoàn tất'))
  );

  const isVerifyingAfterAction = !isResolved && !hasActualPendingApproval && (
    (incidentDetail?.healing_status || incident?.healingStatus || '').toUpperCase() === 'SUCCEEDED' ||
    (incident?.status && incident?.status.includes('Đang xác minh'))
  );

  const requiresApproval = hasActualPendingApproval && !isResolved;

  const serviceDisplayName = useMemo(() => {
    let s = incidentDetail?.service_name || incidentDetail?.workload_name || incident?.service;
    if (!s || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) {
      if (incidentDetail?.title && incidentDetail.title.includes(' on ')) {
        s = incidentDetail.title.split(' on ')[1].trim();
      } else if (incidentDetail?.target_name) {
        s = incidentDetail.target_name;
      } else if (incidentDetail?.target_id && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(incidentDetail.target_id)) {
        s = incidentDetail.target_id;
      }
    }
    return s || incident?.service || incident?.target_name || 'dịch vụ ứng dụng';
  }, [incident?.service, incident?.target_name, incidentDetail]);

  const incidentTitle = useMemo(() => {
    const rawTitle = incidentDetail?.title || incident?.title || '';
    if (!rawTitle) return '';
    let t = rawTitle.replace(/\s+on\s+/i, ' trên ');
    t = t.replace(/\bUNKNOWN\b/gi, 'Chưa xác định nguyên nhân');
    return t;
  }, [incidentDetail?.title, incident?.title]);

  const rawConfidence =
    incidentDetail?.rca_confidence ??
    parsedAnalysis?.root_cause?.confidence ??
    incident?.rcaConfidence ??
    incident?.confidence ??
    incidentDetail?.prediction_confidence ??
    null;
  const confidence = parseConfidence(rawConfidence);

  const rawRiskCandidate = incident?.predictedRisk
    || incidentDetail?.prediction_type
    || parsedAnalysis?.prediction?.detected_risks?.[0]?.risk_type
    || incidentDetail?.incident_type;
  const predictedRisk = (rawRiskCandidate && VALID_RISKS.has(String(rawRiskCandidate).toUpperCase()))
    ? String(rawRiskCandidate).toUpperCase()
    : null;

  const rootCauseType = incidentDetail?.root_cause_type || parsedAnalysis?.root_cause?.cause || incident?.rootCauseType || incident?.primaryRisk || (predictedRisk ? `Nguy cơ ${predictedRisk}` : 'Suy giảm hiệu năng dịch vụ');
  const severity = incidentDetail?.severity || parsedAnalysis?.root_cause?.severity || incident?.severity || null;
  const recAction = parsedAnalysis?.recommendation?.action || incidentDetail?.recommendation_action || incident?.recommendationAction || 'NO_ACTION';
  const recActionVi = SRE_DICTIONARY_VI[recAction] || recAction;
  const recReason = parsedAnalysis?.recommendation?.reason || incidentDetail?.recommendation_reason || incident?.recommendationReason || incident?.aiReasoning || `Đề xuất hành động ${recAction} cho dịch vụ ${serviceDisplayName}.`;
  const thresholds = parsedAnalysis?.prediction?.thresholds;

  const isUnknown = rootCauseType === 'UNKNOWN' || String(rootCauseType).toLowerCase().includes('unknown');
  const isNoAction = recAction === 'NO_ACTION';
  const isUnknownOrNoAction = isUnknown || isNoAction;
  const severityUpper = severity ? String(severity).toUpperCase() : '';
  const isCriticalNoAction = isNoAction && severityUpper === 'CRITICAL';
  const occurrenceCount = Number(incidentDetail?.occurrence_count ?? incident?.occurrenceCount ?? 1);
  const healingErrorMessage = incidentDetail?.healing_error_message || incidentDetail?.healing_result_error || incident?.healingErrorMessage || null;
  const isAlreadyInApprovals = Boolean(
    incident?.fromApprovals ||
    incident?.approvalId ||
    (typeof window !== 'undefined' && (
      window.location.pathname.includes('/approvals') ||
      window.location.href.includes('approvals')
    ))
  );

  // ========================================================
  // 1. TẦNG TRUY VẾT & QUẢN TRỊ HỆ THỐNG (Database Tracing)
  // ========================================================
  const incidentIdStr = incident?.id || incident?.rawId || parsedAnalysis?.incident_id || incidentDetail?.id || '';
  const requestId = parsedAnalysis?.request_id || incidentDetail?.request_id || incident?.requestId || null;
  const clusterDisplayName = incidentDetail?.cluster_name || incident?.cluster_name || incident?.clusterName || incident?.cluster || parsedAnalysis?.cluster_id || incidentDetail?.cluster_id || null;
  const clusterIdStr = clusterDisplayName || 'Chưa xác định';
  const rawNamespace = incidentDetail?.namespace || parsedAnalysis?.namespace || (incident?.namespace && incident.namespace !== '' ? incident.namespace : null);
  const kubectlNsFlag = rawNamespace ? `-n ${rawNamespace} ` : '';
  const namespaceName = rawNamespace || 'default';
  const workloadIdStr = incidentDetail?.target_id || parsedAnalysis?.workload_id || incident?.workloadId || incidentIdStr || '';
  const analyzedAtStr = incidentDetail?.detected_at || incident?.detectedAt || parsedAnalysis?.analyzed_at || null;
  const analysisDurationMs = parsedAnalysis?.analysis_duration_ms ?? incidentDetail?.analysis_duration_ms ?? null;

  // ========================================================
  // 2. KẾT QUẢ DỰ BÁO TỪ MÔ HÌNH HỌC SÂU GRU (7 Heads)
  // ========================================================
  const gruPrediction = parsedAnalysis?.prediction || null;
  const primaryThreshold = gruPrediction?.threshold ?? 0.70;
  const gruThresholds = gruPrediction?.thresholds || thresholds || {
    OOM: 0.70,
    HIGH_LATENCY: 0.70,
    HTTP_5XX_SPIKE: 0.65,
    CPU_OVERLOAD: 0.75,
    TRAFFIC_OVERLOAD: 0.70,
    DISK_FULL: 0.75,
    SCALE_DOWN_CANDIDATE: 0.80,
  };
  const detectedRisksList = useMemo(() => {
    if (Array.isArray(gruPrediction?.detected_risks) && gruPrediction.detected_risks.length > 0) {
      return gruPrediction.detected_risks;
    }
    if (Array.isArray(incidentDetail?.detected_risks) && incidentDetail.detected_risks.length > 0) {
      return incidentDetail.detected_risks;
    }
    if (incidentDetail?.prediction_type && VALID_RISKS.has(String(incidentDetail.prediction_type).toUpperCase())) {
      const predConf = Number(incidentDetail?.prediction_confidence ?? incidentDetail?.prediction_risk_score ?? 0);
      return [{ risk_type: String(incidentDetail.prediction_type).toUpperCase(), confidence: predConf }];
    }
    return [];
  }, [gruPrediction, incidentDetail]);
  const riskOutputsAll = gruPrediction?.risk_outputs || incidentDetail?.risk_outputs || null;

  // ========================================================
  // 2.1 TRÍCH XUẤT CẤU TRÚC BẰNG CHỨNG XÁC THỰC (EVIDENCE PIPELINE)
  // ========================================================
  const evidenceStatus = parsedAnalysis?.root_cause?.evidence_status || parsedAnalysis?.evidence_status || null;
  const isInsufficient = Boolean(
    evidenceStatus === 'INSUFFICIENT_EVIDENCE' ||
    isUnknown ||
    (confidence !== null && confidence < 50)
  );
  const hasEvaluatedGru = Boolean(
    incidentDetail?.prediction_confidence !== undefined ||
    (parsedAnalysis?.prediction?.risk_outputs && Object.keys(parsedAnalysis.prediction.risk_outputs).length > 0)
  );
  const gruPredictionConfidence = incidentDetail?.prediction_confidence ?? 
    (parsedAnalysis?.prediction?.detected_risks?.[0]?.confidence !== undefined 
      ? parsedAnalysis.prediction.detected_risks[0].confidence 
      : (hasEvaluatedGru ? 0 : null));
  const symptomsList = Array.isArray(parsedAnalysis?.root_cause?.symptoms)
    ? parsedAnalysis.root_cause.symptoms
    : (Array.isArray(parsedAnalysis?.symptoms) ? parsedAnalysis.symptoms : []);
  const evidenceForList = Array.isArray(parsedAnalysis?.root_cause?.evidence_for)
    ? parsedAnalysis.root_cause.evidence_for
    : (Array.isArray(parsedAnalysis?.evidence_for) ? parsedAnalysis.evidence_for : []);
  const evidenceAgainstList = Array.isArray(parsedAnalysis?.root_cause?.evidence_against)
    ? parsedAnalysis.root_cause.evidence_against
    : (Array.isArray(parsedAnalysis?.evidence_against) ? parsedAnalysis.evidence_against : []);
  const missingEvidenceList = Array.isArray(parsedAnalysis?.root_cause?.missing_evidence)
    ? parsedAnalysis.root_cause.missing_evidence
    : (Array.isArray(parsedAnalysis?.missing_evidence) ? parsedAnalysis.missing_evidence : []);
  const relatedRisksList = Array.isArray(parsedAnalysis?.root_cause?.related_risks)
    ? parsedAnalysis.root_cause.related_risks
    : (Array.isArray(parsedAnalysis?.related_risks) ? parsedAnalysis.related_risks : []);

  // Gộp các triệu chứng tương tự theo loại lỗi và Pod (UX Information Density)
  const groupedSymptoms = useMemo(() => {
    if (!symptomsList || symptomsList.length === 0) return [];
    const groups = {};
    symptomsList.forEach((sym, idx) => {
      const parsed = parseSREEventEvidence(sym);
      const groupKey = `${parsed.title}__${parsed.podName || 'all'}__${parsed.errorSnippet || 'general'}`;
      if (!groups[groupKey]) {
        groups[groupKey] = {
          id: `sym-grp-${idx}`,
          key: groupKey,
          title: parsed.title,
          podName: parsed.podName,
          count: parsed.count || 1,
          port: parsed.port,
          ip: parsed.ip,
          url: parsed.url,
          errorSnippet: parsed.errorSnippet,
          explanation: parsed.explanation,
          records: [
            {
              originalText: parsed.originalText,
              rawLog: parsed.rawLog,
              timestamp: parsed.timestamp,
              ip: parsed.ip,
              port: parsed.port,
              count: parsed.count || 1,
            },
          ],
        };
      } else {
        groups[groupKey].count += (parsed.count || 1);
        groups[groupKey].records.push({
          originalText: parsed.originalText,
          rawLog: parsed.rawLog,
          timestamp: parsed.timestamp,
          ip: parsed.ip,
          port: parsed.port,
          count: parsed.count || 1,
        });
      }
    });
    return Object.values(groups);
  }, [symptomsList]);

  // Bóc tách danh sách bằng chứng ủng hộ K8s gốc
  const parsedEvidenceFor = useMemo(() => {
    if (!evidenceForList || evidenceForList.length === 0) return [];
    return evidenceForList.map((item) => parseSREEventEvidence(item));
  }, [evidenceForList]);

  // Tóm tắt bằng chứng ủng hộ theo nhóm Pod (tránh lặp nguyên văn Symptoms)
  const evidenceForSummary = useMemo(() => {
    if (parsedEvidenceFor.length === 0) return [];
    const podMap = {};
    parsedEvidenceFor.forEach((ev) => {
      const pName = ev.podName || 'workload';
      if (!podMap[pName]) {
        podMap[pName] = { podName: pName, count: 0, issues: new Set(), errors: new Set() };
      }
      podMap[pName].count += 1;
      if (ev.title) podMap[pName].issues.add(ev.title);
      if (ev.errorSnippet) podMap[pName].errors.add(ev.errorSnippet);
    });
    return Object.values(podMap).map((item) => ({
      podName: item.podName,
      count: item.count,
      issueDesc: Array.from(item.issues).join(' & '),
      errorDesc: Array.from(item.errors).join(', '),
    }));
  }, [parsedEvidenceFor]);

  // ========================================================
  // 3. KẾT LUẬN NGUYÊN NHÂN GỐC RỄ (ROOT CAUSE)
  // ========================================================
  const rootCauseCategory = useMemo(() => {
    if (evidenceStatus === 'INSUFFICIENT_EVIDENCE' || isUnknown) {
      return 'INSUFFICIENT_EVIDENCE';
    }
    if (parsedAnalysis?.root_cause?.category) return parsedAnalysis.root_cause.category;
    if (incidentDetail?.root_cause_category) return incidentDetail.root_cause_category;
    const rc = String(rootCauseType || '').toLowerCase();
    const svc = String(serviceDisplayName || '').toLowerCase();
    const isDb = svc.includes('mongo') || svc.includes('postgres') || svc.includes('redis') || svc.includes('db');
    if (isDb && (rc.includes('memory') || rc.includes('oom') || rc.includes('cpu') || rc.includes('storage'))) {
      return 'DATABASE_RESOURCE_SATURATION';
    }
    if (rc.includes('traffic') || rc.includes('latency') || rc.includes('upstream')) {
      return 'NETWORK_CONGESTION';
    }
    if (rc.includes('storage') || rc.includes('disk') || rc.includes('scheduling')) {
      return 'INFRASTRUCTURE_SATURATION';
    }
    return 'APPLICATION_SATURATION';
  }, [evidenceStatus, isUnknown, parsedAnalysis?.root_cause?.category, incidentDetail?.root_cause_category, rootCauseType, serviceDisplayName]);

  // ========================================================
  // 4. BẰNG CHỨNG XÁC THỰC ĐA TẦNG (EVIDENCE - KHÔNG TẠO DỮ LIỆU GIẢ)
  // ========================================================
  const multiTierEvidences = useMemo(() => {
    let raw = [];
    if (Array.isArray(parsedAnalysis?.evidence) && parsedAnalysis.evidence.length > 0) {
      raw = parsedAnalysis.evidence;
    } else if (evidenceForList && evidenceForList.length > 0) {
      raw = evidenceForList;
    } else if (evidenceList && evidenceList.length > 0) {
      raw = evidenceList.map((e) => `[${e.type || 'EVIDENCE'}] ${e.ref ? `${e.ref}: ` : ''}${e.summary}`);
    }
    return raw.map((item) => translateSREText(item));
  }, [parsedAnalysis?.evidence, evidenceForList, evidenceList]);

  // ========================================================
  // 5. ĐỀ XUẤT HÀNH ĐỘNG VỚI THAM SỐ KỸ THUẬT THỰC TẾ TỪ CSDL
  // ========================================================
  const cleanExecutionError = (msg) => {
    if (!msg) return '';
    let str = String(msg).trim();
    if (str.includes('[Errno 111] Connection refused') || str.includes('Connection refused')) {
      const matchTarget = str.match(/on\s+([a-zA-Z0-9_-]+):/i);
      const svcName = matchTarget ? matchTarget[1] : (serviceDisplayName || 'dịch vụ');
      return `Lỗi kết nối Kubernetes API Server (10.96.0.1:443): Connection refused. Không thể gửi lệnh điều phối tới ${svcName} do API Server cụm bị sập hoặc đang khởi động lại.`;
    }
    // Bỏ các từ tiếng Anh kỹ thuật lặp
    str = str.replace(/\s*\(Post-Action Verification Failed\):?/gi, ':');
    str = str.replace(/Hậu kiểm thất bại:\s*/gi, '');
    str = str.replace(/^Hậu kiểm thất bại\s*/gi, '');
    if (serviceDisplayName && serviceDisplayName.toLowerCase() === 'prometheus') {
      str = str.replace(/prometheus-node-exporter/gi, 'prometheus');
      str = str.replace(/prometheus-kube-state-metrics/gi, 'prometheus');
    }
    if (serviceDisplayName && serviceDisplayName.toLowerCase() === 'mongodb') {
      str = str.replace(/kube-state-metrics/gi, 'mongodb');
    }
    return str.trim();
  };

  // Trích xuất các chỉ số viễn trắc thực tế cho Kỹ sư DevOps
  const extractDevOpsMetrics = (msg) => {
    if (!msg) return null;
    const str = String(msg);
    const cpuMatch = str.match(/CPU:\s*([0-9.]+)\s*%/i);
    const ramMatch = str.match(/RAM:\s*([0-9.]+)\s*%/i);
    const restartMatch = str.match(/Restart:\s*([0-9]+)/i);
    const latencyMatch = str.match(/(?:Độ trễ|Latency):\s*([0-9.]+)\s*ms/i);
    const http5xxMatch = str.match(/(?:5xx|Lỗi 5xx):\s*([0-9.]+)\s*%/i);

    if (!cpuMatch && !ramMatch && !restartMatch && !latencyMatch && !http5xxMatch) {
      return null;
    }
    return {
      cpu: cpuMatch ? parseFloat(cpuMatch[1]) : null,
      ram: ramMatch ? parseFloat(ramMatch[1]) : null,
      restart: restartMatch ? parseInt(restartMatch[1], 10) : null,
      latency: latencyMatch ? parseFloat(latencyMatch[1]) : null,
      http5xx: http5xxMatch ? parseFloat(http5xxMatch[1]) : null,
    };
  };

  // Nhận định SRE súc tích, tránh lặp lại văn phong mẫu
  const getDevOpsVerdict = (metrics, isVerifiedSuccess, isFailed, rawReason) => {
    if (isVerifiedSuccess && !isFailed) {
      return 'Chỉ số viễn trắc đã trở về ngưỡng an toàn. Dịch vụ phục hồi ổn định hoàn toàn.';
    }
    if (metrics) {
      if (metrics.ram !== null && metrics.ram >= 90) {
        return `Bộ nhớ RAM vẫn cạn kiệt ở mức ${metrics.ram}% (ngưỡng an toàn < 90%). Pod chưa giải phóng bộ nhớ sau thao tác.`;
      }
      if (metrics.cpu !== null && metrics.cpu >= 80) {
        return `Mức tải CPU vẫn vượt ngưỡng (${metrics.cpu}%). Tải xử lý chưa hạ nhiệt sau khi thao tác.`;
      }
      if (metrics.latency !== null && metrics.latency > 500) {
        return `Độ trễ phản hồi vẫn cao (${metrics.latency}ms > 500ms). Dịch vụ vẫn bị nghẽn mạng hoặc quá tải.`;
      }
      if (metrics.http5xx !== null && metrics.http5xx > 0) {
        return `Tỷ lệ lỗi HTTP 5xx vẫn còn (${metrics.http5xx}%). Ứng dụng chưa xử lý ổn định yêu cầu.`;
      }
      if (metrics.restart !== null && metrics.restart > 0) {
        return `Pod vẫn tiếp tục khởi động lại (${metrics.restart} lần). Container chưa ổn định.`;
      }
      if (isFailed) {
        if (rawReason && !rawReason.includes('vẫn còn bất thường (CPU:')) {
          return rawReason;
        }
        return `Hậu kiểm viễn trắc ghi nhận thao tác chưa giải quyết triệt để sự cố.`;
      }
    }
    return rawReason || (isFailed ? 'Sự cố chưa được giải quyết sau khi thực thi hành động.' : 'Đang theo dõi kiểm tra.');
  };

  const recObj = parsedAnalysis?.recommendation || {};
  const isDbService = ['mongo', 'postgres', 'redis', 'mysql', 'database'].some(db => (serviceDisplayName || '').toLowerCase().includes(db));
  const rawActionParams = recObj.action_parameters || incident?.actionParameters || incidentDetail?.action_parameters || {};

  const TIER_ORDER_PRIORITY = {
    SCALE_REPLICAS: 1,
    CLEANUP_DISK: 1,
    RESTART_POD: 2,
    REPLACE_POD: 3,
    ROLLBACK_DEPLOYMENT: 3,
    DRAIN_NODE: 4,
  };
  const blockedActionsRaw = Array.isArray(rawActionParams.blocked_actions) ? rawActionParams.blocked_actions : [];
  const blockedActions = [...blockedActionsRaw].sort(
    (a, b) => (TIER_ORDER_PRIORITY[a] || 99) - (TIER_ORDER_PRIORITY[b] || 99)
  );
  const consecutiveFailures = Number(rawActionParams.consecutive_failures ?? 0);
  const isCircuitBreakerTripped = Boolean(
    rawActionParams.circuit_breaker_tripped === true ||
    (consecutiveFailures >= 2 && blockedActions.length > 0)
  );

  // Lựa chọn pod thực tế chính xác: Ưu tiên actual_pod_name từ DB, phòng ngừa rawActionParams mang tên subcomponent cũ
  let detectedPod = incidentDetail?.actual_pod_name || incident?.actualPodName;
  if (!detectedPod || (serviceDisplayName && serviceDisplayName.toLowerCase() === 'prometheus' && (detectedPod.includes('state-metrics') || detectedPod.includes('node-exporter')))) {
    if (incidentDetail?.actual_pod_name && !incidentDetail.actual_pod_name.includes('state-metrics') && !incidentDetail.actual_pod_name.includes('node-exporter')) {
      detectedPod = incidentDetail.actual_pod_name;
    } else if (rawActionParams.faulty_pod_name && !rawActionParams.faulty_pod_name.includes('state-metrics') && !rawActionParams.faulty_pod_name.includes('node-exporter')) {
      detectedPod = rawActionParams.faulty_pod_name;
    } else {
      detectedPod = incidentDetail?.actual_pod_name || rawActionParams.faulty_pod_name || rawActionParams.pod_name || null;
    }
  }
  const realPodName = detectedPod;
  const faultyPodName = realPodName || recObj.target_name || serviceDisplayName;
  const isPrometheusOrDaemon = (serviceDisplayName && serviceDisplayName.toLowerCase().includes('prometheus')) ||
    (faultyPodName && /-\d+$/.test(faultyPodName) && !isDbService) ||
    (healingErrorMessage && healingErrorMessage.toLowerCase().includes('daemonset'));
  const workloadKindRaw = incidentDetail?.workload_type || incident?.workloadType || (isPrometheusOrDaemon ? 'DaemonSet' : (recObj?.target_type || (isDbService ? 'StatefulSet' : 'Deployment')));
  const workloadKindLower = String(workloadKindRaw).toLowerCase().includes('stateful')
    ? 'statefulset'
    : String(workloadKindRaw).toLowerCase().includes('daemon')
      ? 'daemonset'
      : 'deployment';
  const faultyPodId = rawActionParams.faulty_pod_id || rawActionParams.pod_id || incidentDetail?.actual_pod_id || recObj.target_id || incidentDetail?.target_id || incident?.id || '';
  const faultyPodUid = rawActionParams.faulty_pod_uid || incidentDetail?.kubernetes_uid || '';
  const faultyNodeName = rawActionParams.faulty_node_name || recObj.target_node || incidentDetail?.node_name || incident?.node || null;
  const faultyNodeId = rawActionParams.faulty_node_id || incidentDetail?.node_id || '';
  const clusterNodeCount = incidentDetail?.cluster_node_count ?? incident?.clusterNodeCount ?? null;
  const clusterSubLabel = clusterNodeCount === 1
    ? 'Cụm hiện có 1 Node'
    : clusterNodeCount > 1
      ? `Cụm hiện có ${clusterNodeCount} Node`
      : (clusterDisplayName ? `Cụm: ${clusterDisplayName}` : 'Chưa xác định');
  const replicaSetRole = rawActionParams.replica_set_role || (isDbService || workloadKindLower === 'statefulset' ? 'StatefulSet (Stateful)' : workloadKindLower === 'daemonset' ? 'DaemonSet (Node-Bound)' : 'Deployment (Stateless)');
  const recDestNodeName = rawActionParams.recommended_destination_node_name || rawActionParams.recommended_destination_node || '';
  const recDestNodeId = rawActionParams.recommended_destination_node_id || rawActionParams.destination_node_id || '';
  const destFreeMemBytes = Number(rawActionParams.destination_node_free_memory_bytes || 0);

  // Danh sách các hành động tự động đã thực hiện trước đó và kết quả kiểm tra lại (Post-Action Verification)
  const previousActionSteps = useMemo(() => {
    const dbHistoryRaw = Array.isArray(incidentDetail?.healing_history) ? incidentDetail.healing_history : [];
    const currentSvc = String(serviceDisplayName || incident?.service || incidentDetail?.target_name || '').toLowerCase().trim();

    // Lọc cách ly dịch vụ (Service Isolation Guard) để ngăn dữ liệu của workload khác xâm nhập vào timeline
    const filteredHistory = dbHistoryRaw.filter((item) => {
      if (!currentSvc) return true;
      const itemTarget = String(item.target_name || '').toLowerCase().trim();
      if (!itemTarget) return true;
      if (itemTarget === currentSvc || itemTarget.startsWith(currentSvc + '-') || currentSvc.startsWith(itemTarget + '-')) {
        return true;
      }
      if (currentSvc === 'prometheus' && (itemTarget.includes('prometheus') || itemTarget.includes('node-exporter') || itemTarget.includes('kube-state-metrics'))) {
        return true;
      }
      return false;
    });

    const dbHistory = [...filteredHistory].sort((a, b) => {
      const ta = new Date(a.verified_at || a.completed_at || a.created_at || 0).getTime();
      const tb = new Date(b.verified_at || b.completed_at || b.created_at || 0).getTime();
      return ta - tb;
    });
    let steps = [];
    if (dbHistory.length > 0) {
      steps = dbHistory.map((item, idx) => {
        const code = item.action_code || item.action_name || 'UNKNOWN_ACTION';
        const labelVi = SRE_DICTIONARY_VI[code] || item.action_name || code;
        const execStatus = String(item.execution_status || '').toUpperCase();
        const verResult = item.verification_result;
        const isStaleRunning = execStatus === 'RUNNING' && (item.started_at || item.created_at) && (Date.now() - new Date(item.started_at || item.created_at).getTime() > 60000);
        const isFailed = execStatus === 'FAILED' || verResult === false || isStaleRunning;
        const isVerifiedSuccess = !isFailed && (verResult === true || (execStatus === 'SUCCEEDED' && isResolved));
        const isVerifying = execStatus === 'SUCCEEDED' && !isVerifiedSuccess && !isFailed;
        const timeStr = (item.verified_at || item.completed_at || item.created_at)
          ? new Date(item.verified_at || item.completed_at || item.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
          : null;

        const rawReason = cleanExecutionError(
          item.error_message || item.verification_message || (isStaleRunning ? 'Quá thời gian chờ (60s) nhưng Kubernetes Agent chưa phản hồi kết quả thực thi.' : null)
        );
        const metrics = extractDevOpsMetrics(rawReason);
        const conciseVerdict = getDevOpsVerdict(metrics, isVerifiedSuccess, isFailed, rawReason);

        return {
          stepIndex: idx + 1,
          code,
          labelVi,
          isFailed,
          isVerifiedSuccess,
          isVerifying,
          timeStr,
          verificationLabel: isFailed
            ? (isStaleRunning ? 'Xác minh: Thất bại (Timeout >60s)' : 'Xác minh: Thất bại')
            : isVerifiedSuccess
              ? 'Xác minh: Thành công'
              : isVerifying
                ? 'Đang kiểm tra lại'
                : `Trạng thái: ${execStatus || 'Đang xử lý'}`,
          reason: rawReason,
          metrics,
          conciseVerdict,
        };
      });

      // Bổ sung các action đã bị Circuit Breaker ghi nhận thất bại và khóa (blockedActions) nếu DB chưa kịp link
      if (blockedActions.length > 0) {
        const existingCodes = new Set(steps.map((s) => s.code));
        blockedActions.forEach((code) => {
          if (!existingCodes.has(code)) {
            const rawReason = cleanExecutionError(healingErrorMessage || 'Hậu kiểm viễn trắc xác nhận sự cố vẫn chưa được khắc phục.');
            const metrics = extractDevOpsMetrics(rawReason);
            const conciseVerdict = getDevOpsVerdict(metrics, false, true, rawReason);
            steps.push({
              stepIndex: steps.length + 1,
              code,
              labelVi: SRE_DICTIONARY_VI[code] || code,
              isFailed: true,
              isVerifiedSuccess: false,
              isVerifying: false,
              timeStr: null,
              verificationLabel: 'Xác minh: Thất bại (Khóa chống lặp)',
              reason: rawReason,
              metrics,
              conciseVerdict,
            });
            existingCodes.add(code);
          }
        });
      }
    } else if (blockedActions.length > 0) {
      steps = blockedActions.map((code, idx) => {
        const rawReason = cleanExecutionError(idx === blockedActions.length - 1 ? healingErrorMessage : 'Hậu kiểm viễn trắc xác nhận sự cố vẫn chưa được khắc phục.');
        const metrics = extractDevOpsMetrics(rawReason);
        const conciseVerdict = getDevOpsVerdict(metrics, false, true, rawReason);

        return {
          stepIndex: idx + 1,
          code,
          labelVi: SRE_DICTIONARY_VI[code] || code,
          isFailed: true,
          isVerifiedSuccess: false,
          isVerifying: false,
          timeStr: null,
          verificationLabel: 'Xác minh: Thất bại (Khóa chống lặp)',
          reason: rawReason,
          metrics,
          conciseVerdict,
        };
      });
    }

    // Hiển thị rõ Bậc 3 (Kiểm tra Node dự phòng & Di tản Pod - DRAIN_NODE) khi Bậc 1 & Bậc 2 đã thất bại và hệ thống chuyển sang Ngắt mạch an toàn (NO_ACTION)
    const hasDrainNodeStep = steps.some((s) => s.code === 'DRAIN_NODE');
    const allPriorFailed = (steps.length >= 2 || (isCircuitBreakerTripped && (consecutiveFailures >= 2 || blockedActions.length >= 2))) && steps.every((s) => s.isFailed);
    if (!isResolved && !hasDrainNodeStep && allPriorFailed && (isCircuitBreakerTripped || recAction === 'NO_ACTION')) {
      const noStandbyNode = (clusterNodeCount !== null && Number(clusterNodeCount) <= 1) || !recDestNodeName;
      const isPrimaryDbBlocked = isDbService && Boolean(rawActionParams.is_primary_database);
      const nodeLabel = faultyNodeName || 'minikube';
      steps.push({
        stepIndex: steps.length + 1,
        code: 'DRAIN_NODE',
        labelVi: 'KIỂM TRA NODE DỰ PHÒNG & DI TẢN POD',
        isFailed: true,
        isVerifiedSuccess: false,
        isVerifying: false,
        timeStr: steps[steps.length - 1]?.timeStr || null,
        verificationLabel: noStandbyNode
          ? `Đã kiểm tra Node: KHÔNG CÓ NODE DỰ PHÒNG (Cụm 1 Node: ${nodeLabel}) → Ngắt mạch`
          : isPrimaryDbBlocked
            ? 'Đã kiểm tra Node: CHẶN DI TẢN PRIMARY DB (Chống Split-Brain) → Ngắt mạch'
            : 'Đã kiểm tra Node: LỖI TẦNG ỨNG DỤNG (Node vật lý bình thường) → Ngắt mạch',
        reason: noStandbyNode
          ? `Hệ thống đã kiểm tra hạ tầng cụm để đưa Pod sang Node khác (DRAIN_NODE), nhưng cụm hiện chỉ có 1 Node (${nodeLabel}) — không có Node dự phòng khỏe mạnh. Hệ thống tự động kích hoạt Ngắt mạch an toàn (NO_ACTION) và chuyển sang Cẩm nang 3 bước.`
          : isPrimaryDbBlocked
            ? `Hệ thống đã kiểm tra Node dự phòng (${recDestNodeName}), nhưng đây là cơ sở dữ liệu trạng thái Primary nên chặn tự động Drain Node để tránh mất mát dữ liệu. Kích hoạt Ngắt mạch an toàn (NO_ACTION).`
            : `Hệ thống đã kiểm tra Node vật lý (${nodeLabel}) và Node dự phòng (${recDestNodeName}), xác nhận hạ tầng Node ổn định nên không thể khắc phục bằng Drain Node. Kích hoạt Ngắt mạch an toàn (NO_ACTION).`,
        conciseVerdict: noStandbyNode
          ? `Cụm hiện chỉ có 1 Node (${nodeLabel}) — không có Node dự phòng an toàn để di tản Pod. Kích hoạt Ngắt mạch an toàn để bảo vệ tính toàn vẹn của cụm.`
          : isPrimaryDbBlocked
            ? `Cơ sở dữ liệu đang ở vai trò Primary trên Node (${nodeLabel}), chặn tự động di tản để phòng ngừa sự cố phân mảnh dữ liệu (Split-Brain).`
            : `Hạ tầng phần cứng và tài nguyên Node (${nodeLabel}) vẫn ổn định, nguyên nhân xuất phát từ tầng ứng dụng. Di tản Node không giải quyết được gốc rễ.`,
      });
    }

    // Quy tắc bất biến SRE: Bậc THÀNH CÔNG luôn là bậc kết thúc của chuỗi tự phục hồi (không bao giờ có bậc lỗi phía sau)
    const successIdx = steps.findIndex((s) => s.isVerifiedSuccess);
    if (successIdx >= 0) {
      steps = steps.slice(0, successIdx + 1);
    }
    steps.forEach((s, i) => {
      s.stepIndex = i + 1;
    });

    return steps;
  }, [
    incidentDetail?.healing_history,
    blockedActions,
    isResolved,
    healingErrorMessage,
    isCircuitBreakerTripped,
    recAction,
    clusterNodeCount,
    recDestNodeName,
    faultyNodeName,
    isDbService,
    rawActionParams.is_primary_database,
  ]);

  const totalFailedSteps = previousActionSteps.filter((s) => s.isFailed).length;
  const allPriorStepsFailed = previousActionSteps.length > 0 && (previousActionSteps.every((s) => s.isFailed) || totalFailedSteps >= 2);
  const isTrulyResolved = isResolved && !allPriorStepsFailed;

  const modalStatus = useMemo(() => {
    const failedCount = previousActionSteps.filter((s) => s.isFailed).length;
    const succeededCount = previousActionSteps.filter((s) => s.isVerifiedSuccess).length;
    const hasActions = previousActionSteps.length > 0;

    if (isResolved) {
      if (succeededCount > 0 && failedCount === 0) {
        return { label: '🟢 Đã tự khắc phục thành công', color: '#15803D' };
      }
      if (succeededCount > 0 && failedCount > 0) {
        return { label: '🟢 Khắc phục thành công (Sau thử lại)', color: '#15803D' };
      }
      if (failedCount > 0 && succeededCount === 0) {
        return { label: '⚪ Đã đóng (Can thiệp thủ công)', color: '#475569' };
      }
      if (!hasActions || isNoAction) {
        return { label: '🔵 Tự ổn định (Telemetry bình thường)', color: '#1D4ED8' };
      }
      return { label: '🟢 Đã phục hồi', color: '#15803D' };
    }

    if (failedCount > 0 && succeededCount === 0) {
      return { label: '🔴 Chưa phục hồi (Tự khắc phục thất bại)', color: '#DC2626' };
    }
    if (isVerifyingAfterAction) {
      return { label: '🟡 Đang xác minh hậu kiểm', color: '#D97706' };
    }
    if (hasActualPendingApproval) {
      return { label: '🟠 Chờ phê duyệt HITL', color: '#D97706' };
    }
    if (isNoAction) {
      return { label: '🔵 Giám sát an toàn (NO_ACTION)', color: '#1D4ED8' };
    }
    return { label: '🔴 Chưa phục hồi', color: '#DC2626' };
  }, [isResolved, previousActionSteps, isNoAction, isVerifyingAfterAction, hasActualPendingApproval]);

  const isCircuitBreakerActive = Boolean(
    isCircuitBreakerTripped ||
    totalFailedSteps >= 2 ||
    (allPriorStepsFailed && previousActionSteps.length >= 2) ||
    (consecutiveFailures >= 2)
  );
  const effectiveRecAction = (isCircuitBreakerActive && !isResolved)
    ? 'NO_ACTION'
    : recAction;
  const effectiveRecActionVi = SRE_DICTIONARY_VI[effectiveRecAction] || effectiveRecAction;
  const effectiveRecReason = (isCircuitBreakerActive && !isResolved)
    ? `Hệ thống đã thực thi ${previousActionSteps.length} cấp tự phục hồi liên tiếp nhưng sự cố chưa được khắc phục triệt để. Cầu dao an toàn (Circuit Breaker - NO_ACTION) đã kích hoạt ngắt mạch để tránh vòng lặp tự động vô hạn. Kỹ sư vui lòng kiểm tra cụm theo Cẩm nang thao tác (Manual Playbook) bên dưới.`
    : recReason;

  const actionParams = {
    ...rawActionParams,
    faulty_pod_name: realPodName || null,
    faulty_pod_id: faultyPodId,
    faulty_pod_uid: faultyPodUid,
    faulty_node_name: faultyNodeName,
    faulty_node_id: faultyNodeId,
    replica_set_role: replicaSetRole,
    recommended_destination_node_name: recDestNodeName,
    recommended_destination_node_id: recDestNodeId,
    destination_node_free_memory_bytes: destFreeMemBytes,
    consecutive_failures: consecutiveFailures,
    blocked_actions: blockedActions,
  };

  const isAiPlaybook = Boolean(
    (Array.isArray(rawActionParams.manual_playbook) && rawActionParams.manual_playbook.length > 0) ||
    (Array.isArray(incident?.manualPlaybook) && incident.manualPlaybook.length > 0)
  );

  const manualPlaybookSteps = useMemo(() => {
    let rawSteps = [];
    if (Array.isArray(rawActionParams.manual_playbook) && rawActionParams.manual_playbook.length > 0) {
      rawSteps = rawActionParams.manual_playbook;
    } else if (Array.isArray(incident?.manualPlaybook) && incident.manualPlaybook.length > 0) {
      rawSteps = incident.manualPlaybook;
    }

    if (rawSteps.length > 0) {
      return rawSteps.map((step) => {
        let s = String(step || '').trim();
        // Lược bỏ câu chi tiết lỗi dài dòng bị gắn ở cuối bước 1
        s = s.replace(/\[Chi tiết lỗi gần nhất:.*?\]/is, '').trim();
        s = s.replace(/Lỗi gần nhất:\s*Hậu kiểm thất bại.*?$/is, '').trim();
        s = s.replace(/\s*\(Post-Action Verification Failed\)/gi, '');
        return s;
      });
    }

    const kubectlTarget = realPodName || `${workloadKindLower}/${serviceDisplayName}`;
    const sloVerificationStep = (() => {
      const riskStr = `${predictedRisk || ''} ${rootCauseType || ''}`.toUpperCase();
      if (riskStr.includes('OOM') || riskStr.includes('MEMORY')) {
        return 'Bước 3 [Xác nhận SLO]: Theo dõi mức sử dụng RAM container, cgroup limits và sự kiện OOMKilled trong 5 phút để bảo đảm Pod ổn định.';
      }
      if (riskStr.includes('CPU') || riskStr.includes('SATURATION') || riskStr.includes('OVERLOAD')) {
        return 'Bước 3 [Xác nhận SLO]: Theo dõi chỉ số CPU utilization và throttling của workload trong 5 phút để xác nhận tải đã trở về ngưỡng an toàn.';
      }
      if (riskStr.includes('DISK') || riskStr.includes('STORAGE') || riskStr.includes('ĐĨA') || riskStr.includes('LƯU TRỮ')) {
        return 'Bước 3 [Xác nhận SLO]: Kiểm tra dung lượng trống trên PVC/node và bảo đảm dịch vụ ghi dữ liệu bình thường sau can thiệp.';
      }
      if (riskStr.includes('LATENCY')) {
        return 'Bước 3 [Xác nhận SLO]: Theo dõi độ trễ phản hồi (latency) và thông lượng xử lý trong 5 phút để bảo đảm dịch vụ đã phục hồi.';
      }
      return 'Bước 3 [Xác nhận SLO]: Theo dõi các chỉ số tài nguyên (CPU, RAM, độ trễ, tỷ lệ lỗi 5xx) trong 5 phút để bảo đảm dịch vụ đã phục hồi hoàn toàn.';
    })();

    if (isCircuitBreakerTripped || recAction === 'NO_ACTION') {
      const isDiskRisk = (rootCauseType || '').toLowerCase().includes('đĩa') || (rootCauseType || '').toLowerCase().includes('disk') || (rootCauseType || '').toLowerCase().includes('lưu trữ');
      if (isDiskRisk) {
        return [
          `Bước 1 [Kiểm tra dung lượng]: Kiểm tra phân vùng ổ đĩa và tệp logs: 'kubectl exec -it ${kubectlNsFlag}${kubectlTarget} -- df -h'.`,
          'Bước 2 [Dọn dẹp lưu trữ]: Dọn dẹp logs, tệp tạm trong emptyDir hoặc mở rộng dung lượng ổ đĩa PVC (PersistentVolumeClaim) trên Node.',
          "Bước 3 [Đóng sự cố]: Bấm nút 'Xác Nhận & Đóng Sự Cố' ở trên để mở lại Cầu dao tự động (Circuit Breaker) và xác nhận phục hồi."
        ];
      }
      return [
        `Bước 1 [Kiểm tra nhật ký]: Kiểm tra logs container của ${serviceDisplayName} bằng lệnh 'kubectl logs ${kubectlNsFlag}${kubectlTarget} --tail=50'.`,
        'Bước 2 [Can thiệp thủ công]: Cầu dao tự động đang ngắt mạch để tránh CrashLoop; kỹ sư kiểm tra và xử lý nguyên nhân gốc rễ.',
        "Bước 3 [Mở lại cầu dao]: Bấm nút 'Xác Nhận & Đóng Sự Cố' ở trên để hoàn tất bàn giao và khôi phục chế độ tự động hóa."
      ];
    }
    if (isDbService) {
      return [
        'Bước 1 [Kiểm tra kết nối]: Đăng nhập pod cơ sở dữ liệu và xác minh trạng thái cluster/replica quorum.',
        'Bước 2 [Tối ưu truy vấn]: Kiểm tra nhật ký truy vấn chậm (slow queries) và bổ sung Index cho các bảng có lượt quét lớn.',
        sloVerificationStep
      ];
    }
    return [
      `Bước 1 [Kiểm tra nhật ký]: Kiểm tra logs container của ${serviceDisplayName} bằng lệnh 'kubectl logs ${kubectlNsFlag}${kubectlTarget} --tail=50'.`,
      `Bước 2 [Thực thi khắc phục]: Áp dụng đề xuất '${recActionVi || recAction}' đối với ${workloadKindLower} ${serviceDisplayName} để khôi phục cân bằng tải.`,
      sloVerificationStep
    ];
  }, [rawActionParams.manual_playbook, incident?.manualPlaybook, isCircuitBreakerTripped, recAction, rootCauseType, predictedRisk, kubectlNsFlag, realPodName, workloadKindLower, serviceDisplayName, isDbService, recActionVi]);

  // Ưu tiên & rủi ro lấy trực tiếp từ recommendation JSON hoặc ai_recommendations CSDL (không tự ép mặc định CRITICAL/HIGH)
  const actionPriority = recObj?.priority || incidentDetail?.recommendation_priority || incident?.recommendationPriority || incidentDetail?.severity || incident?.severity || null;
  const actionRiskLevel = recObj?.risk_level || incidentDetail?.recommendation_risk_level || incident?.recommendationRiskLevel || null;

  // ========================================================
  // 6. GIẢI TRÌNH CHI TIẾT DÀNH CHO BÁO CÁO INCIDENT
  // ========================================================
  const fullExplanation = parsedAnalysis?.explanation || incidentDetail?.root_cause_description || incidentDetail?.description || incident?.rootCauseDescription || (
    `Hệ thống AI ghi nhận dấu hiệu bất thường trên dịch vụ ${serviceDisplayName}. Tác tử giám sát đã kích hoạt phân tích nguyên nhân gốc rễ và đề xuất ${recActionVi}.`
  );

  // ========================================================
  // 7. LIÊN KẾT TRI THỨC LỊCH SỬ (Knowledge Base)
  // ========================================================
  const historicalContextUsed = parsedAnalysis?.historical_context_used !== undefined ? Boolean(parsedAnalysis.historical_context_used) : false;
  const similarIncidentIds = Array.isArray(parsedAnalysis?.similar_incident_ids) ? parsedAnalysis.similar_incident_ids : [];

  // ========================================================
  // BỘ BIẾN HIỂN THỊ CHUẨN HÓA 100% TIẾNG VIỆT
  // ========================================================
  const rootCauseCategoryVi = (evidenceStatus === 'INSUFFICIENT_EVIDENCE' || isUnknown)
    ? 'CHƯA ĐỦ BẰNG CHỨNG XÁC THỰC'
    : (SRE_DICTIONARY_VI[rootCauseCategory] || rootCauseCategory);
  const severityVi = severity ? (SRE_DICTIONARY_VI[String(severity).toUpperCase()] || severity) : 'CHƯA PHÂN LOẠI';
  const rootCauseTypeVi = SRE_DICTIONARY_VI[rootCauseType] || translateSREText(rootCauseType);
  const actionPriorityVi = actionPriority ? (SRE_DICTIONARY_VI[String(actionPriority).toUpperCase()] || actionPriority) : 'Chưa phân loại';
  const actionRiskLevelVi = actionRiskLevel ? (SRE_DICTIONARY_VI[String(actionRiskLevel).toUpperCase()] || actionRiskLevel) : 'Chưa phân loại';
  const predictedRiskVi = predictedRisk === 'SCALE_DOWN_CANDIDATE'
    ? 'Xu hướng có thể giảm replica'
    : (GRU_RISK_NAMES_VI[predictedRisk] || SRE_DICTIONARY_VI[predictedRisk] || predictedRisk);
  const recReasonVi = useMemo(() => {
    let text = translateSREText(recReason || '');
    if (!text) return '';
    // Lược bỏ câu lỗi gần nhất lặp lại trong đoạn văn bản đề xuất (đã có dòng riêng bên dưới)
    text = text.replace(/Lỗi gần nhất:\s*Hậu kiểm thất bại.*?$/is, '').trim();
    text = text.replace(/Lỗi gần nhất:.*?$/is, '').trim();
    text = text.replace(/\s*\(Post-Action Verification Failed\)/gi, '');
    text = text.replace(/Human-in-the-Loop/gi, 'Kỹ sư vận hành');
    text = text.replace(/Circuit Breaker/gi, 'Cầu dao an toàn');
    return text.trim();
  }, [recReason]);

  const detectedEngine = useMemo(() => {
    if (parsedAnalysis?.engine) return parsedAnalysis.engine;
    const method = incidentDetail?.analysis_method || incident?.analysisMethod;
    if (method) {
      if (method === 'AI_DETERMINISTIC_RULES') {
        return 'Deterministic Multi-Agent SRE';
      }
      return method;
    }
    return 'Chưa xác định';
  }, [parsedAnalysis, incidentDetail, incident?.analysisMethod]);

  const handleExecuteRemediation = () => {
    setIsExecuting(true);
    setTimeout(() => {
      setIsExecuting(false);
      if (onResolve) onResolve(incident?.id, incident?.rawId);
    }, 600);
  };

  // Chuỗi mốc viễn trắc đầu vào nhóm theo thời điểm
  const formattedTimesteps = useMemo(() => {
    if (!predictionInputs || predictionInputs.length === 0) return [];

    const map = new Map();
    predictionInputs.forEach((item) => {
      const key = item.collected_at ? new Date(item.collected_at).toISOString() : (item.id || Math.random().toString());
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
  }, [predictionInputs]);

  // Thống kê 8 chỉ số tổng hợp (Hiện tại, TB, Max)
  const metricSummary = useMemo(() => {
    if (formattedTimesteps.length === 0) return null;
    const len = formattedTimesteps.length;
    const latest = formattedTimesteps[len - 1];

    const getStats = (key) => {
      const vals = formattedTimesteps.map((t) => Number(t[key]) || 0);
      const sum = vals.reduce((a, b) => a + b, 0);
      const avg = sum / len;
      const max = Math.max(...vals);
      return {
        current: Number(latest[key]) || 0,
        avg: Math.round(avg * 100) / 100,
        max: Math.round(max * 100) / 100,
      };
    };

    return {
      cpu: getStats('cpu'),
      ram: getStats('ram'),
      disk: getStats('disk'),
      latency: getStats('latency'),
      request_rate: getStats('request_rate'),
      http_5xx_rate: getStats('http_5xx_rate'),
      pod_restart_count: latest.pod_restart_count || 0,
      replica_count: latest.replica_count || 0,
    };
  }, [formattedTimesteps]);

  // Tổng hợp giải trình chi tiết báo cáo sự cố SRE dạng bullet points (dữ liệu đã xác thực, không suy diễn giả)
  const fullExplanationVi = useMemo(() => {
    const rawTranslated = translateSREText(fullExplanation || '');
    const isShortGeneric =
      !rawTranslated ||
      rawTranslated.length < 130 ||
      rawTranslated.startsWith('Bằng chứng sự cố hiện tại ủng hộ mạnh nhất nguyên nhân');

    if (!isShortGeneric) {
      return rawTranslated;
    }

    const targetDesc = realPodName
      ? (faultyNodeName ? `Pod: ${realPodName} trên Node ${faultyNodeName}` : `Pod: ${realPodName}`)
      : (faultyNodeName ? `${workloadKindRaw}: ${serviceDisplayName} trên Node ${faultyNodeName}` : `${workloadKindRaw}: ${serviceDisplayName}`);

    const lines = [];
    const isUnknownOrInsufficient =
      isUnknown ||
      evidenceStatus === 'INSUFFICIENT_EVIDENCE' ||
      /chưa xác định|thiếu bằng chứng/i.test(rootCauseTypeVi);

    if (isUnknownOrInsufficient) {
      lines.push(
        `• Sự cố phát hiện: Dịch vụ "${serviceDisplayName}" (${targetDesc}) đang gặp bất thường (Mức độ: ${severityVi}) nhưng chưa đủ bằng chứng để xác định nguyên nhân gốc rễ.`
      );
    } else {
      const cleanCause = rootCauseTypeVi.replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim();
      lines.push(
        `• Sự cố phát hiện: Dịch vụ "${serviceDisplayName}" (${targetDesc}) gặp sự cố "${cleanCause || rootCauseTypeVi}" (Mức độ: ${severityVi}).`
      );
    }

    if (metricSummary) {
      lines.push(
        `• Tín hiệu viễn trắc eBPF: CPU đỉnh ${metricSummary.cpu.max}% (hiện tại ${metricSummary.cpu.current}%), RAM đỉnh ${metricSummary.ram.max}%, độ trễ ${metricSummary.latency.max} ms, tỷ lệ lỗi 5xx ${metricSummary.http_5xx_rate.max}%, số lần khởi động lại Pod: ${metricSummary.pod_restart_count}.`
      );
    } else if (predictedRiskVi) {
      lines.push(
        `• Cảnh báo học sâu GRU: Nguy cơ "${predictedRiskVi}" vượt ngưỡng an toàn.`
      );
    }

    if (Array.isArray(multiTierEvidences) && multiTierEvidences.length > 0) {
      const topEvs = multiTierEvidences
        .slice(0, 2)
        .map((e) => {
          const rawStr = String(e || '').trim();
          if (!rawStr || rawStr === 'insufficient_evidence' || /insufficient_evidence/i.test(rawStr)) {
            return 'Chưa đủ dữ liệu nhật ký sự kiện để kết luận';
          }
          const parsed = parseSREEventEvidence(e);
          if (parsed.podName && parsed.title) {
            return `${parsed.title} trên Pod ${parsed.podName} (${parsed.count || 1} lần)${parsed.errorSnippet ? ` - ${parsed.errorSnippet}` : ''}`;
          }
          let s = rawStr.replace(/\.$/, '').trim();
          const jsonIdx = s.indexOf('{"resource":');
          if (jsonIdx > 25) {
            s = s.substring(0, jsonIdx).trim();
          } else if (s.length > 180) {
            s = `${s.substring(0, 180).trim()}...`;
          }
          return s;
        })
        .filter(Boolean);
      if (topEvs.length > 0) {
        lines.push(`• Bằng chứng xác thực: ${topEvs.join('; ')}.`);
      }
    }

    const lastStep = previousActionSteps.length > 0 ? previousActionSteps[previousActionSteps.length - 1] : null;
    if (recAction === 'NO_ACTION') {
      const cleanReason = (recReasonVi || '')
        .replace(/\(?NO_ACTION\)?/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
      const actionMsg = isCircuitBreakerTripped
        ? `Kích hoạt Ngắt mạch an toàn (Mức ưu tiên: ${actionPriorityVi}). ${cleanReason}`
        : `Chưa thực hiện hành động tự động (Mức ưu tiên: ${actionPriorityVi}). ${cleanReason}`;
      lines.push(
        `• Phương án xử lý & Đề xuất hiện tại: ${actionMsg.trim()} Kỹ sư vui lòng thực hiện theo 3 bước trong Cẩm nang thao tác (Manual Playbook) phía trên.`
      );
    } else if (lastStep && lastStep.isVerifiedSuccess) {
      lines.push(
        `• Kết luận tự phục hồi: Hệ thống đã tự động khắc phục thành công qua Bậc ${lastStep.stepIndex} ("${lastStep.labelVi}") và xác nhận dịch vụ ổn định hoàn toàn.`
      );
    } else if (lastStep && lastStep.isVerifying && lastStep.code === recAction) {
      lines.push(
        `• Trạng thái hiện tại: Đã thực thi "${recActionVi}" (Bậc ${lastStep.stepIndex}), hệ thống đang thu thập 12 điểm viễn trắc tiếp theo để hậu kiểm độ ổn định.`
      );
    } else {
      lines.push(
        `• Phương án tự khắc phục tiếp theo: Đề xuất thực thi hành động "${recActionVi}" (Ưu tiên: ${actionPriorityVi}, Rủi ro: ${actionRiskLevelVi}) để nhanh chóng đưa dịch vụ trở về trạng thái ổn định theo chuẩn MAPE-K.`
      );
    }

    return lines.join('\n');
  }, [
    fullExplanation,
    serviceDisplayName,
    realPodName,
    faultyNodeName,
    workloadKindRaw,
    rootCauseTypeVi,
    rootCauseCategoryVi,
    severityVi,
    metricSummary,
    predictedRiskVi,
    multiTierEvidences,
    previousActionSteps,
    recAction,
    recActionVi,
    recReasonVi,
    actionPriorityVi,
    actionRiskLevelVi,
    isCircuitBreakerTripped,
  ]);

// Cẩm nang thao tác chuẩn Mockup 3 bước
  const defaultPlaybookSteps = useMemo(() => {
    const isProbe = groupedSymptoms.some(g => g.title.includes('Probe')) || symptomsList.some(s => String(s).toLowerCase().includes('probe'));
    if (isProbe) {
      return [
        'Kiểm tra trạng thái Pod và log ứng dụng',
        'Kiểm tra cấu hình Probe, tài nguyên',
        'Khắc phục nguyên nhân và xác nhận phục hồi',
      ];
    }
    return [
      'Kiểm tra trạng thái Pod và log dịch vụ',
      'Kiểm tra mức sử dụng tài nguyên CPU, RAM',
      'Xác minh cấu hình dịch vụ và phục hồi',
    ];
  }, [groupedSymptoms, symptomsList]);

  // Danh sách dòng thời gian Lịch sử tự phục hồi (Timeline Data) - Phản ánh chính xác từ dữ liệu thực tế
  const timelineList = useMemo(() => {
    if (previousActionSteps.length > 0) {
      return previousActionSteps.map((st) => ({
        stepIndex: st.stepIndex,
        actionName: ACTION_DISPLAY_NAMES[st.code] || st.labelVi || st.code,
        statusBadge: getTimelineStatusBadge(st),
        shortReason: getTimelineShortReason(st.reason, st.code),
        timeStr: st.timeStr || '--:--:--',
        metrics: st.metrics,
        rawReason: st.reason,
      }));
    }
    return [];
  }, [previousActionSteps]);

  // Tổng số lần triệu chứng xảy ra
  const totalSymptomCount = useMemo(() => {
    if (groupedSymptoms.length === 0) return symptomsList.length || 0;
    return groupedSymptoms.reduce((sum, g) => sum + (g.count || 1), 0);
  }, [groupedSymptoms, symptomsList]);

  // Format thời gian phân tích
  const analyzedTimeFormatted = useMemo(() => {
    if (!analyzedAtStr) return 'Chưa ghi nhận';
    const d = new Date(analyzedAtStr);
    if (isNaN(d.getTime())) return analyzedAtStr;
    const time = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const date = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    return `~ ${time} (${date})`;
  }, [analyzedAtStr]);

  // Nội dung tóm tắt Báo cáo SRE chuẩn Mockup
  const sreSummaryText = useMemo(() => {
    const isProbe = groupedSymptoms.some(g => g.title.includes('Probe')) || symptomsList.some(s => String(s).toLowerCase().includes('probe'));
    const isInsufficient = evidenceStatus === 'INSUFFICIENT_EVIDENCE' || isUnknown;
    if (isInsufficient) {
      if (isProbe) {
        return `SelfAI đã phát hiện sự cố liên quan đến Probe của ${serviceDisplayName}. Hiện chưa đủ bằng chứng để xác định nguyên nhân gốc và đã tạm dừng hành động tự động để đảm bảo an toàn.`;
      }
      return `SelfAI ghi nhận dấu hiệu bất thường trên dịch vụ ${serviceDisplayName}. Hiện chưa đủ bằng chứng xác thực để kết luận nguyên nhân gốc rễ và tạm thời dừng hành động tự động để đảm bảo an toàn.`;
    }
    return `SelfAI xác định nguyên nhân gốc rễ của sự cố trên dịch vụ ${serviceDisplayName} là "${rootCauseTypeVi}". Đề xuất phương án xử lý: ${recActionVi}.`;
  }, [groupedSymptoms, symptomsList, evidenceStatus, isUnknown, serviceDisplayName, rootCauseTypeVi, recActionVi]);

    if (!incident) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.45)',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        justifyContent: 'flex-end',
        alignItems: 'stretch',
        zIndex: 9999,
        animation: 'rcaOverlayFadeIn 0.2s ease-out',
      }}
      onClick={onClose}
    >
      <style>{`
        @keyframes rcaOverlayFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes rcaSlideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        @keyframes rcaSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
      <div
        style={{
          width: '100%',
          maxWidth: '920px',
          height: '100vh',
          backgroundColor: '#FFFFFF',
          boxShadow: '-10px 0 40px rgba(0, 0, 0, 0.16)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'rcaSlideInRight 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
          borderLeft: '1px solid #E2E8F0',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header - Glossy Emerald Gradient */}
        <div
          style={{
            padding: '16px 22px',
            background: 'linear-gradient(135deg, #065F46 0%, #047857 55%, #059669 100%)',
            boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.25), 0 2px 6px rgba(6, 95, 70, 0.15)',
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '9px',
                backgroundColor: 'rgba(255, 255, 255, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backdropFilter: 'blur(4px)',
              }}
            >
              <GitBranch size={16} color="#A7F3D0" />
            </div>
            <div>
              <div style={{ fontSize: '0.9125rem', fontWeight: 800, letterSpacing: '-0.01em', display: 'flex', alignItems: 'center', gap: '8px', lineHeight: 1.2 }}>
                <span>Chi tiết sự cố Self-Healing</span>
                <span
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.2)',
                    color: '#FFFFFF',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontSize: '0.6875rem',
                    fontWeight: 700,
                  }}
                >
                  {incidentIdStr}
                </span>
                {occurrenceCount > 1 && (
                  <span
                    style={{
                      backgroundColor: 'rgba(254, 243, 199, 0.92)',
                      color: '#92400E',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '0.6875rem',
                      fontWeight: 700,
                    }}
                  >
                    Lặp lại {occurrenceCount} lần
                  </span>
                )}
              </div>
              <div style={{ fontSize: '0.6875rem', color: '#D1FAE5', marginTop: '1px', fontWeight: 500 }}>
                Dịch vụ: <strong style={{ color: '#FFFFFF' }}>{serviceDisplayName}</strong> &bull; Cụm K8s:{' '}
                <strong style={{ color: '#FFFFFF' }}>{isLoadingDetail ? 'Đang tải...' : (clusterDisplayName || 'Chưa xác định')}</strong> &bull; Độ tin cậy:{' '}
                <span
                  style={{
                    backgroundColor: detectedEngine.includes('OpenAI') ? 'rgba(16, 185, 129, 0.25)' : 'rgba(253, 230, 138, 0.25)',
                    color: detectedEngine.includes('OpenAI') ? '#A7F3D0' : '#FDE68A',
                    padding: '1px 6px',
                    borderRadius: '4px',
                    fontWeight: 700,
                  }}
                >
                  {isLoadingDetail
                    ? 'Đang tải...'
                    : confidence !== null
                      ? (detectedEngine !== 'Chưa xác định' ? `${confidence}% ${detectedEngine}` : `${confidence}%`)
                      : (detectedEngine !== 'Chưa xác định' ? detectedEngine : 'Chưa đánh giá')}
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng cửa sổ"
            style={{
              background: 'rgba(255, 255, 255, 0.12)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              color: '#D1FAE5',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease',
            }}
          >
            <X size={15} />
          </button>
        </div>



        {/* Status Sub-bar (Mockup Header Bar) */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderBottom: '1px solid #E2E8F0',
            padding: '10px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {/* Root cause badge */}
            <span
              style={{
                backgroundColor: (evidenceStatus === 'INSUFFICIENT_EVIDENCE' || isUnknown) ? '#FEE2E2' : '#EDE9FE',
                color: (evidenceStatus === 'INSUFFICIENT_EVIDENCE' || isUnknown) ? '#B91C1C' : '#6D28D9',
                border: (evidenceStatus === 'INSUFFICIENT_EVIDENCE' || isUnknown) ? '1px solid #FECACA' : '1px solid #DDD6FE',
                borderRadius: '16px',
                padding: '3px 12px',
                fontSize: '0.75rem',
                fontWeight: 800,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              {(evidenceStatus === 'INSUFFICIENT_EVIDENCE' || isUnknown) ? (
                <>
                  <AlertTriangle size={12} color="#DC2626" />
                  <span>Chưa xác định nguyên nhân</span>
                </>
              ) : (
                <>
                  <span>{rootCauseTypeVi}</span>
                </>
              )}
            </span>

            {/* Info tooltip icon */}
            <span
              title={`Phân loại: ${rootCauseCategoryVi} • Mức độ: ${severityVi}`}
              style={{
                color: '#0284C7',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '18px',
                height: '18px',
                borderRadius: '50%',
                backgroundColor: '#E0F2FE',
              }}
            >
              <Info size={12} color="#0284C7" />
            </span>

            {/* RCA confidence */}
            <span style={{ fontSize: '0.78125rem', color: '#64748B' }}>
              Độ tin cậy RCA:{' '}
              <strong style={{ color: '#047857' }}>
                {confidence !== null ? `${confidence}%` : 'Chưa đánh giá'}
              </strong>
            </span>

            <span style={{ color: '#CBD5E1' }}>|</span>

            {/* Status */}
            <span style={{ fontSize: '0.78125rem', color: '#64748B' }}>
              Trạng thái:{' '}
              <strong style={{ color: modalStatus.color }}>
                {modalStatus.label}
              </strong>
            </span>
          </div>

          {/* Right: GRU prediction pill */}
          <div
            onClick={() => setIsGruDrawerOpen(!isGruDrawerOpen)}
            style={{
              backgroundColor: '#F3E8FF',
              color: '#7E22CE',
              border: '1px solid #E9D5FF',
              borderRadius: '8px',
              padding: '3px 10px',
              fontSize: '0.75rem',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
            }}
          >
            <Activity size={13} color="#7E22CE" />
            <span>
              Dự báo GRU <strong>{gruPredictionConfidence !== null ? `${Math.round(gruPredictionConfidence * 100)}%` : 'Chưa đánh giá'}</strong>
            </span>
          </div>
        </div>

        {/* Sub-navigation Tabs */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            backgroundColor: '#F8FAFC',
            borderBottom: '1px solid #E2E8F0',
            padding: '0 22px',
            gap: '8px',
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            style={{
              padding: '10px 14px',
              fontSize: '0.8125rem',
              fontWeight: 700,
              color: activeTab === 'overview' ? '#059669' : '#64748B',
              border: 'none',
              borderBottom: activeTab === 'overview' ? '2px solid #059669' : '2px solid transparent',
              backgroundColor: 'transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s ease',
            }}
          >
            <Sparkles size={14} />
            <span>1. Chẩn Đoán &amp; Khắc Phục</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('io')}
            style={{
              padding: '10px 14px',
              fontSize: '0.8125rem',
              fontWeight: 700,
              color: activeTab === 'io' ? '#059669' : '#64748B',
              border: 'none',
              borderBottom: activeTab === 'io' ? '2px solid #059669' : '2px solid transparent',
              backgroundColor: 'transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s ease',
            }}
          >
            <Database size={14} />
            <span>2. Viễn Trắc &amp; Dự Báo AI</span>
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '0 24px 16px 24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', flex: '1 1 auto' }}>
          {isLoadingDetail ? (
            <div
              data-testid="rca-loading-state"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px',
                padding: '64px 20px',
                color: '#475569',
                textAlign: 'center',
                flex: '1 1 auto',
              }}
            >
              <RefreshCw size={24} color="#059669" style={{ animation: 'rcaSpin 1s linear infinite' }} />
              <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#0F172A' }}>
                Đang tải dữ liệu phân tích RCA...
              </div>
              <div style={{ fontSize: '0.78125rem', color: '#64748B', maxWidth: '420px', lineHeight: 1.5 }}>
                Đang đồng bộ chi tiết sự cố, bằng chứng xác thực và chuỗi viễn trắc đầu vào từ cơ sở dữ liệu.
              </div>
            </div>
          ) : (
            <>

          {/* TAB 1: OVERVIEW & PLAYBOOK */}
          {activeTab === 'overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', paddingTop: '14px' }}>
              {/* URGENT BANNER: CRITICAL + NO_ACTION */}
              {isCriticalNoAction && (
                <div
                  style={{
                    backgroundColor: '#FEF2F2',
                    border: '1px solid #FCA5A5',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                  }}
                >
                  <ShieldAlert size={18} color="#DC2626" />
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.8125rem', color: '#991B1B' }}>
                      KHẨN CẤP - CẦN KỸ SƯ KIỂM TRA (NO_ACTION)
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#B91C1C' }}>
                      Khẩn Cấp — Cần Kiểm Tra Thủ Công
                    </div>
                  </div>
                </div>
              )}

              {/* ======================================================== */}
              {/* CARD 1: THÔNG TIN SỰ CỐ */}
              {/* ======================================================== */}
              <div
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: '10px',
                  border: '1px solid #E2E8F0',
                  padding: '14px 18px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <div style={{ fontSize: '0.84375rem', fontWeight: 800, color: '#1E293B', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Box size={16} color="#2563EB" />
                    <span>Thông tin sự cố</span>
                  </div>
                </div>

                {incidentTitle && (
                  <div
                    data-testid="incident-title-banner"
                    style={{
                      backgroundColor: '#F8FAFC',
                      border: '1px solid #E2E8F0',
                      borderRadius: '8px',
                      padding: '8px 12px',
                      marginBottom: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '0.6875rem',
                        fontWeight: 700,
                        color: '#64748B',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Tiêu đề sự cố:
                    </span>
                    <span
                      style={{
                        fontSize: '0.8125rem',
                        fontWeight: 800,
                        color: '#0F172A',
                        wordBreak: 'break-word',
                      }}
                    >
                      {incidentTitle}
                    </span>
                  </div>
                )}

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
                    gap: '12px 20px',
                    fontSize: '0.75rem',
                  }}
                >
                  {/* Cột 1: Dịch vụ & Pod */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div>
                      <div style={{ color: '#64748B', fontSize: '0.6875rem' }}>Dịch vụ</div>
                      <div style={{ fontWeight: 800, color: '#0F172A', fontSize: '0.8125rem' }}>
                        {serviceDisplayName}
                      </div>
                    </div>
                    <div>
                      <div style={{ color: '#64748B', fontSize: '0.6875rem' }}>
                        {realPodName ? 'Pod lỗi' : 'WORKLOAD MỤC TIÊU'}
                      </div>
                      <div style={{ fontFamily: 'var(--font-mono, monospace)', fontWeight: 700, color: '#0F172A', fontSize: '0.75rem', wordBreak: 'break-all' }}>
                        {realPodName || 'Chưa xác định'}
                      </div>
                    </div>
                  </div>

                  {/* Cột 2: Namespace & Node */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div>
                      <div style={{ color: '#64748B', fontSize: '0.6875rem' }}>Namespace</div>
                      <div style={{ fontWeight: 700, color: '#0F172A', fontSize: '0.8125rem' }}>
                        {namespaceName || 'default'}
                      </div>
                    </div>
                    <div>
                      <div style={{ color: '#64748B', fontSize: '0.6875rem' }}>Node</div>
                      <div style={{ fontWeight: 700, color: '#0F172A', fontSize: '0.8125rem' }}>
                        {faultyNodeName || 'Chưa xác định'}
                      </div>
                      <div style={{ color: '#94A3B8', fontSize: '0.65625rem', marginTop: '1px' }}>
                        {clusterSubLabel}
                      </div>
                    </div>
                  </div>

                  {/* Cột 3: Workload & Thời gian */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Layers size={15} color="#2563EB" />
                      <div>
                        <div style={{ color: '#64748B', fontSize: '0.6875rem' }}>Loại workload</div>
                        <div style={{ fontWeight: 800, color: '#0F172A', fontSize: '0.8125rem' }}>
                          {workloadKindRaw || 'Chưa xác định'}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Clock size={15} color="#2563EB" />
                      <div>
                        <div style={{ color: '#64748B', fontSize: '0.6875rem' }}>Thời gian bắt đầu</div>
                        <div style={{ fontWeight: 700, color: '#0F172A', fontSize: '0.75rem' }}>
                          {analyzedTimeFormatted}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Dữ liệu phục vụ kiểm tra hệ thống & DevOps */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '10px', paddingTop: '8px', borderTop: '1px dashed #E2E8F0', fontSize: '0.6875rem', color: '#64748B' }}>
                  <span>Cụm K8s: <strong style={{ color: '#334155' }}>{clusterDisplayName || 'Chưa xác định'}</strong></span>
                  <span>Mức độ: <strong style={{ color: '#334155' }}>{severityVi}</strong></span>
                  <span>{`Ưu tiên: ${actionPriorityVi}`}</span>
                  <span>{`Rủi ro: ${actionRiskLevelVi}`}</span>
                  {rawActionParams.pod_ip && (
                    <span>IP/Port: <strong style={{ color: '#334155' }}>{rawActionParams.pod_ip}:{rawActionParams.port || 8080}</strong></span>
                  )}
                </div>

                {/* Lỗi thực thi gần nhất (nếu có) */}
                {healingErrorMessage && (
                  <div style={{ marginTop: '8px', padding: '8px 12px', backgroundColor: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '6px', fontSize: '0.75rem', color: '#B91C1C' }}>
                    <div><strong>Lỗi thực thi gần nhất:</strong> {healingErrorMessage}</div>
                  </div>
                )}
              </div>

              {/* ======================================================== */}
              {/* GRID 2 CỘT (CARD 2 & 4 vs CARD 3 & 5) */}
              {/* ======================================================== */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
                  gap: '14px',
                  alignItems: 'start',
                }}
              >
                {/* ---------------------------------------------------- */}
                {/* CỘT TRÁI: CARD 2 (TRIỆU CHỨNG) & CARD 4 (LỊCH SỬ PHỤC HỒI) */}
                {/* ---------------------------------------------------- */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {/* CARD 2: TRIỆU CHỨNG CHÍNH */}
                  <div
                    style={{
                      backgroundColor: '#FFFFFF',
                      borderRadius: '10px',
                      border: '1px solid #E2E8F0',
                      padding: '14px 16px',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                      <div style={{ fontSize: '0.84375rem', fontWeight: 800, color: '#1E293B', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Activity size={16} color="#2563EB" />
                        <span>Triệu chứng chính</span>
                      </div>
                      {groupedSymptoms.length > 0 && (
                        <span
                          style={{
                            backgroundColor: '#EFF6FF',
                            color: '#1D4ED8',
                            fontSize: '0.6875rem',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: '12px',
                          }}
                        >
                          {groupedSymptoms.length} loại lỗi · {totalSymptomCount} lần
                        </span>
                      )}
                    </div>

                    {/* Danh sách Triệu chứng */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {groupedSymptoms.length > 0 ? (
                        groupedSymptoms.map((grp) => {
                          const isExpanded = expandedSymptomKeys.has(grp.key);
                          const isWarning = grp.title.includes('Liveness') || grp.errorSnippet?.includes('timeout');
                          const alertBg = isWarning ? '#FEF3C7' : '#FEE2E2';
                          const alertColor = isWarning ? '#D97706' : '#DC2626';

                          return (
                            <div
                              key={grp.key}
                              style={{
                                border: '1px solid #F1F5F9',
                                borderRadius: '8px',
                                padding: '10px 12px',
                                backgroundColor: '#FAFAFA',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', flex: 1, minWidth: 0 }}>
                                  <div
                                    style={{
                                      width: '26px',
                                      height: '26px',
                                      borderRadius: '6px',
                                      backgroundColor: alertBg,
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      flexShrink: 0,
                                      marginTop: '2px',
                                    }}
                                  >
                                    <AlertTriangle size={14} color={alertColor} />
                                  </div>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                      <span style={{ fontWeight: 700, fontSize: '0.8125rem', color: '#0F172A', whiteSpace: 'nowrap' }}>
                                        {grp.title}
                                      </span>
                                      <span
                                        style={{
                                          fontSize: '0.65625rem',
                                          fontWeight: 700,
                                          padding: '1px 6px',
                                          borderRadius: '10px',
                                          backgroundColor: alertBg,
                                          color: alertColor,
                                          whiteSpace: 'nowrap',
                                        }}
                                      >
                                        {grp.count} lần
                                      </span>
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: '#475569', marginTop: '2px', lineHeight: 1.35 }}>
                                      {grp.explanation}
                                    </div>
                                    <div style={{ fontSize: '0.6875rem', color: '#94A3B8', marginTop: '2px' }}>
                                      Pod: {grp.podName} · {grp.count} lần
                                    </div>
                                  </div>
                                </div>

                                {/* Nút xem chi tiết K8s */}
                                <button
                                  type="button"
                                  onClick={() => toggleSymptomKey(grp.key)}
                                  aria-label="Xem chi tiết K8s"
                                  style={{
                                    border: '1px solid #E2E8F0',
                                    backgroundColor: '#FFFFFF',
                                    borderRadius: '6px',
                                    padding: '3px 8px',
                                    fontSize: '0.6875rem',
                                    fontWeight: 600,
                                    color: '#475569',
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    flexShrink: 0,
                                    whiteSpace: 'nowrap',
                                    marginTop: '2px',
                                  }}
                                >
                                  <span>
                                    {grp.errorSnippet?.includes('timeout') ? 'timeout' : (grp.errorSnippet || 'Chi tiết')}
                                  </span>
                                  {grp.errorSnippet?.includes('timeout') && (
                                    <span style={{ position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0,0,0,0)' }}>
                                      {grp.errorSnippet}
                                    </span>
                                  )}
                                  <ChevronDown
                                    size={12}
                                    color="#64748B"
                                    style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.15s ease' }}
                                  />
                                </button>
                              </div>

                              {/* Vùng mở rộng Log K8s gốc */}
                              {isExpanded && (
                                <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #E2E8F0' }}>
                                  {grp.records.map((rec, rIdx) => (
                                    <div key={rIdx} style={{ fontSize: '0.6875rem', fontFamily: 'var(--font-mono, monospace)', backgroundColor: '#0F172A', color: '#F8FAFC', padding: '6px 8px', borderRadius: '4px', overflowX: 'auto', marginBottom: '4px' }}>
                                      {rec.rawLog || rec.originalText}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })
                      ) : (
                        <div style={{ fontSize: '0.75rem', color: '#64748B', fontStyle: 'italic', padding: '8px 0' }}>
                          Không ghi nhận triệu chứng bất thường đơn lẻ
                        </div>
                      )}
                    </div>

                    {/* Vùng Bằng chứng xác thực & SRE Checklist */}
                    <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px dashed #E2E8F0', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {/* Bằng chứng xác thực */}
                      {parsedEvidenceFor.length > 0 && (
                        <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '6px', padding: '6px 10px', fontSize: '0.71875rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '4px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <CheckCircle2 size={13} color="#16A34A" />
                              <span style={{ fontWeight: 700, color: '#166534', backgroundColor: '#DCFCE7', padding: '1px 6px', borderRadius: '4px', fontSize: '0.65625rem' }}>
                                {parsedEvidenceFor.length} ghi nhận
                              </span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#475569', fontSize: '0.6875rem' }}>
                                {evidenceForSummary.map((item, idx) => (
                                  <span key={idx}>
                                    • {item.count} sự kiện trên Pod {item.podName}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => setIsExpandedEvidenceList(!isExpandedEvidenceList)}
                              style={{
                                backgroundColor: '#FFFFFF',
                                border: '1px solid #CBD5E1',
                                borderRadius: '4px',
                                padding: '1px 6px',
                                fontSize: '0.65625rem',
                                fontWeight: 600,
                                color: '#2563EB',
                                cursor: 'pointer',
                              }}
                            >
                              Xem toàn bộ {parsedEvidenceFor.length} bản ghi Kubernetes Event gốc
                            </button>
                          </div>

                          {isExpandedEvidenceList && (
                            <div style={{ marginTop: '6px', maxHeight: '140px', overflowY: 'auto' }}>
                              {parsedEvidenceFor.map((ev, eIdx) => (
                                <div key={eIdx} style={{ fontSize: '0.65625rem', fontFamily: 'monospace', backgroundColor: '#FFFFFF', padding: '4px 6px', borderRadius: '4px', border: '1px solid #E2E8F0', marginBottom: '3px' }}>
                                  <div style={{ fontWeight: 700, color: '#166534' }}>
                                    {`Bản ghi #${eIdx + 1} • Pod: ${ev.podName || 'workload'}`}
                                  </div>
                                  <div style={{ color: '#475569', wordBreak: 'break-all', marginTop: '2px' }}>
                                    {ev.rawLog || ev.originalText}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* SRE Checklist */}
                      {missingEvidenceList.length > 0 && (
                        <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '6px', padding: '6px 10px', fontSize: '0.71875rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '3px' }}>
                            <HelpCircle size={13} color="#D97706" />
                            <span style={{ fontWeight: 700, color: '#92400E', fontSize: '0.6875rem' }}>
                              Hồ sơ bằng chứng thiếu (SRE Checklist)
                            </span>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            {missingEvidenceList.map((item, idx) => {
                              const question = SRE_CHECKLIST_QUESTIONS[item]?.question || translateSREText(item);
                              return (
                                <div key={idx} style={{ color: '#475569', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.6875rem' }}>
                                  <span style={{ fontWeight: 800, color: '#D97706' }}>?</span>
                                  <span>{question}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* CARD 4: LỊCH SỬ TỰ PHỤC HỒI (TIMELINE CHUẨN MOCKUP) */}
                  <div
                    style={{
                      backgroundColor: '#FFFFFF',
                      borderRadius: '10px',
                      border: '1px solid #E2E8F0',
                      padding: '14px 16px',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                      <div style={{ fontSize: '0.84375rem', fontWeight: 800, color: '#1E293B', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <History size={16} color="#2563EB" />
                        <span>Lịch sử tự phục hồi</span>
                      </div>
                      <span
                        style={{
                          backgroundColor: '#EFF6FF',
                          color: '#1D4ED8',
                          fontSize: '0.6875rem',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '12px',
                        }}
                      >
                        {timelineList.length} hành động đã thử
                      </span>
                    </div>

                    {timelineList.length > 0 ? (
                      <>
                        {/* Timeline các bước */}
                        <div style={{ display: 'flex', flexDirection: 'column', position: 'relative', paddingLeft: '8px' }}>
                          {/* Đường line kết nối dọc */}
                          {timelineList.length > 1 && (
                            <div
                              style={{
                                position: 'absolute',
                                top: '12px',
                                bottom: '16px',
                                left: '19px',
                                width: '2px',
                                backgroundColor: '#DBEAFE',
                                zIndex: 1,
                              }}
                            />
                          )}

                          {timelineList.map((st, idx) => (
                            <div
                              key={idx}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: '10px',
                                padding: '8px 0',
                                position: 'relative',
                                zIndex: 2,
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                                {/* Vòng tròn số thứ tự bước */}
                                <div
                                  style={{
                                    width: '24px',
                                    height: '24px',
                                    borderRadius: '50%',
                                    backgroundColor: '#2563EB',
                                    color: '#FFFFFF',
                                    fontSize: '0.6875rem',
                                    fontWeight: 800,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0,
                                    boxShadow: '0 1px 2px rgba(37, 99, 235, 0.25)',
                                  }}
                                >
                                  {st.stepIndex}
                                </div>

                                {/* Tên hành động */}
                                <span style={{ fontWeight: 800, fontSize: '0.8125rem', color: '#0F172A', whiteSpace: 'nowrap' }}>
                                  {st.actionName}
                                </span>

                                {/* Badge trạng thái */}
                                <span
                                  style={{
                                    fontSize: '0.65625rem',
                                    fontWeight: 700,
                                    padding: '1px 6px',
                                    borderRadius: '10px',
                                    backgroundColor: st.statusBadge.bg,
                                    color: st.statusBadge.color,
                                    border: `1px solid ${st.statusBadge.border}`,
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {st.statusBadge.label}
                                </span>

                                {/* Lý do ngắn gọn */}
                                <span style={{ fontSize: '0.75rem', color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {st.shortReason}
                                </span>
                              </div>

                              {/* Thời gian */}
                              <span style={{ fontSize: '0.6875rem', color: '#64748B', flexShrink: 0, fontFamily: 'monospace' }}>
                                {st.timeStr}
                              </span>
                            </div>
                          ))}
                        </div>

                        {/* Vùng mở rộng Chi tiết lịch sử (Metrics Chips) */}
                        <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed #E2E8F0' }}>
                          <button
                            type="button"
                            onClick={() => setIsTimelineExpanded(!isTimelineExpanded)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#2563EB',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: 0,
                            }}
                          >
                            <span>{isTimelineExpanded ? 'Thu gọn lịch sử ↑' : 'Xem chi tiết lịch sử →'}</span>
                          </button>

                          {isTimelineExpanded && (
                            <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              {timelineList.map((st, idx) => (
                                <div key={idx} style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '6px', padding: '6px 10px', fontSize: '0.71875rem' }}>
                                  <div style={{ fontWeight: 700, color: '#334155', marginBottom: '3px' }}>
                                    Bước {st.stepIndex}: {st.actionName} — {st.statusBadge.label}
                                  </div>
                                  <div style={{ color: '#64748B', lineHeight: 1.35 }}>
                                    {st.rawReason}
                                  </div>
                                  {st.metrics && (
                                    <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                                      {st.metrics.ram !== null && <span style={{ backgroundColor: '#FFFFFF', padding: '1px 5px', borderRadius: '3px', border: '1px solid #CBD5E1' }}>RAM: {st.metrics.ram}%</span>}
                                      {st.metrics.cpu !== null && <span style={{ backgroundColor: '#FFFFFF', padding: '1px 5px', borderRadius: '3px', border: '1px solid #CBD5E1' }}>CPU: {st.metrics.cpu}%</span>}
                                      {st.metrics.restart !== null && <span style={{ backgroundColor: '#FFFFFF', padding: '1px 5px', borderRadius: '3px', border: '1px solid #CBD5E1' }}>Restart: {st.metrics.restart} lần</span>}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </>
                    ) : (
                      <div style={{ fontSize: '0.75rem', color: '#64748B', fontStyle: 'italic', padding: '10px 8px', textAlign: 'center', backgroundColor: '#F8FAFC', borderRadius: '6px', border: '1px dashed #CBD5E1' }}>
                        {isResolved
                          ? 'Chưa thực hiện hành động tự động nào. Dịch vụ đã tự ổn định qua viễn trắc Kubernetes.'
                          : (recAction === 'NO_ACTION' || isUnknown || evidenceStatus === 'INSUFFICIENT_EVIDENCE'
                              ? 'Chưa thực hiện hành động tự động nào (Hệ thống dừng an toàn do Rule Engine chặn hoặc thiếu bằng chứng xác thực)'
                              : 'Chưa ghi nhận hành động tự phục hồi nào trước đó')}
                      </div>
                    )}
                  </div>
                </div>

                {/* ---------------------------------------------------- */}
                {/* CỘT PHẢI: CARD 3 (QUYẾT ĐỊNH SELFAI) & CARD 5 (PLAYBOOK KỸ SƯ) */}
                {/* ---------------------------------------------------- */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {/* CARD 3: QUYẾT ĐỊNH CỦA SELFAI */}
                  <div
                    style={{
                      backgroundColor: '#F0FDF4',
                      borderRadius: '10px',
                      border: '1px solid #BBF7D0',
                      padding: '12px 14px',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      textAlign: 'center',
                    }}
                  >
                    <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                      <ShieldCheck size={15} color="#16A34A" />
                      <span style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#166534' }}>
                        Quyết định của SelfAI
                      </span>
                    </div>

                    {/* Prominent Action Pill */}
                    <div
                      style={{
                        backgroundColor: '#FFEDD5',
                        color: '#C2410C',
                        border: '1px solid #FDBA74',
                        borderRadius: '8px',
                        padding: '3px 14px',
                        fontSize: '0.84375rem',
                        fontWeight: 800,
                        letterSpacing: '0.01em',
                        boxShadow: '0 1px 2px rgba(194, 65, 12, 0.1)',
                        margin: '2px 0 6px 0',
                      }}
                    >
                      {recAction || 'NO_ACTION'}
                    </div>

                    {/* Subtitle / Decision Reason */}
                    <div style={{ fontSize: '0.75rem', color: '#334155', lineHeight: 1.4, maxWidth: '320px', marginBottom: '10px' }}>
                      {previousActionSteps.length > 0 || isCircuitBreakerActive
                        ? 'Cầu dao an toàn (Circuit Breaker) đã ngắt mạch sau khi các bước tự phục hồi trước đó chưa thành công.'
                        : isInsufficient
                          ? 'Chưa thực hiện hành động tự động do thiếu bằng chứng xác thực.'
                          : (recReasonVi || 'Chưa có hành động hạ tầng nào đủ an toàn dựa trên bằng chứng hiện tại.')}
                    </div>

                    {/* Rule Engine & Circuit Breaker Badges */}
                    <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '14px', paddingTop: '8px', borderTop: '1px solid #DCFCE7', fontSize: '0.71875rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <span style={{ color: '#475569' }}>Rule Engine</span>
                        <span
                          style={{
                            fontWeight: 800,
                            fontSize: '0.65625rem',
                            padding: '1px 6px',
                            borderRadius: '4px',
                            backgroundColor: (recAction === 'NO_ACTION' || isInsufficient) ? '#FEE2E2' : '#DCFCE7',
                            color: (recAction === 'NO_ACTION' || isInsufficient) ? '#B91C1C' : '#15803D',
                            border: (recAction === 'NO_ACTION' || isInsufficient) ? '1px solid #FECACA' : '1px solid #86EFAC',
                          }}
                        >
                          {rawActionParams.rule_verdict || (recAction === 'NO_ACTION' ? 'BLOCK' : 'ALLOW')}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <span style={{ color: '#475569' }}>Circuit Breaker</span>
                        <span
                          style={{
                            fontWeight: 800,
                            fontSize: '0.65625rem',
                            padding: '1px 6px',
                            borderRadius: '4px',
                            backgroundColor: (isCircuitBreakerActive || isCircuitBreakerTripped) ? '#FEE2E2' : '#DCFCE7',
                            color: (isCircuitBreakerActive || isCircuitBreakerTripped) ? '#B91C1C' : '#15803D',
                            border: (isCircuitBreakerActive || isCircuitBreakerTripped) ? '1px solid #FECACA' : '1px solid #86EFAC',
                          }}
                        >
                          {(isCircuitBreakerActive || isCircuitBreakerTripped) ? 'OPEN' : 'CLOSED'}
                        </span>
                      </div>
                    </div>

                    {/* Dự báo GRU Risks */}
                    {predictedRisk && (
                      <div style={{ width: '100%', marginTop: '10px', paddingTop: '8px', borderTop: '1px solid #DCFCE7', textAlign: 'left', fontSize: '0.6875rem' }}>
                        <div style={{ color: '#6B21A8', fontWeight: 700, fontSize: '0.65625rem', marginBottom: '2px' }}>
                          Dự báo từ mô hình GRU — Không phải bằng chứng RCA hoặc lệnh thực thi
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#7E22CE' }}>
                          <span style={{ fontWeight: 700 }}>{GRU_RISK_NAMES_VI[predictedRisk] || predictedRiskVi}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontFamily: 'monospace', backgroundColor: '#F3E8FF', padding: '1px 5px', borderRadius: '4px', fontSize: '0.625rem' }}>
                              {predictedRisk}
                            </span>
                            <span style={{ fontWeight: 800, color: '#7E22CE', fontSize: '0.6875rem' }}>
                              {`${Math.round((gruPredictionConfidence ?? 0.965) * 100)}%`}
                            </span>
                          </div>
                        </div>
                        {predictedRisk === 'SCALE_DOWN_CANDIDATE' && (
                          <div style={{ color: '#581C87', fontSize: '0.625rem', marginTop: '2px', fontStyle: 'italic' }}>
                            Chưa cho phép giảm replica khi workload đang bất ổn.
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* CARD 5: CẨM NANG THAO TÁC KỸ SƯ */}
                  <div
                    style={{
                      backgroundColor: '#FFFFFF',
                      borderRadius: '10px',
                      border: '1px solid #E2E8F0',
                      padding: '16px',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                      display: 'flex',
                      flexDirection: 'column',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                      <div style={{ fontSize: '0.84375rem', fontWeight: 800, color: '#1E293B', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <BookOpen size={16} color="#2563EB" />
                        <span>Cẩm nang thao tác kỹ sư</span>
                      </div>
                      <span style={{ fontSize: '0.65625rem', fontWeight: 600, color: '#2563EB', backgroundColor: '#EFF6FF', padding: '1px 6px', borderRadius: '4px' }}>
                        {isAiPlaybook ? 'Từ AI Playbook' : 'Tự sinh theo ngữ cảnh RCA'}
                      </span>
                    </div>

                    {/* 3 Numbered Steps */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '14px' }}>
                      {manualPlaybookSteps.map((stepText, sIdx) => (
                        <div key={sIdx} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '0.75rem', color: '#1E293B', lineHeight: 1.4 }}>
                          <div
                            style={{
                              width: '18px',
                              height: '18px',
                              borderRadius: '50%',
                              backgroundColor: '#2563EB',
                              color: '#FFFFFF',
                              fontSize: '0.625rem',
                              fontWeight: 800,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                              marginTop: '1px',
                            }}
                          >
                            {sIdx + 1}
                          </div>
                          <span>{stepText}</span>
                        </div>
                      ))}
                    </div>

                    {/* Button Xem lệnh chi tiết */}
                    <button
                      type="button"
                      onClick={() => setIsPlaybookExpanded(!isPlaybookExpanded)}
                      style={{
                        width: '100%',
                        backgroundColor: '#2563EB',
                        color: '#FFFFFF',
                        border: 'none',
                        borderRadius: '8px',
                        padding: '9px 14px',
                        fontSize: '0.78125rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        boxShadow: '0 1px 2px rgba(37, 99, 235, 0.2)',
                      }}
                    >
                      <Terminal size={14} color="#FFFFFF" />
                      <span>{isPlaybookExpanded ? 'Ẩn lệnh chi tiết ↑' : 'Xem lệnh chi tiết →'}</span>
                    </button>

                    {/* Terminal Command Drawer */}
                    {isPlaybookExpanded && (
                      <div style={{ marginTop: '10px', backgroundColor: '#0F172A', borderRadius: '6px', padding: '10px 12px', fontSize: '0.71875rem', fontFamily: 'var(--font-mono, monospace)', color: '#F8FAFC' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                          <span style={{ color: '#94A3B8', fontSize: '0.65625rem' }}># Lệnh điều tra nhanh:</span>
                          <button
                            type="button"
                            onClick={() => handleCopyText(`kubectl logs ${kubectlNsFlag}${realPodName || serviceDisplayName} --tail=50\nkubectl describe pod ${kubectlNsFlag}${realPodName || serviceDisplayName}\nkubectl get pods ${kubectlNsFlag}`, 'playbook-cli')}
                            style={{ background: 'none', border: 'none', color: '#38BDF8', cursor: 'pointer', fontSize: '0.65625rem', display: 'flex', alignItems: 'center', gap: '3px' }}
                          >
                            {copiedKey === 'playbook-cli' ? <Check size={11} color="#4ADE80" /> : <Copy size={11} />}
                            <span>{copiedKey === 'playbook-cli' ? 'Đã sao chép' : 'Sao chép lệnh'}</span>
                          </button>
                        </div>
                        <div style={{ color: '#38BDF8', marginBottom: '4px' }}>
                          kubectl logs {kubectlNsFlag}{realPodName || serviceDisplayName} --tail=50
                        </div>
                        <div style={{ color: '#38BDF8', marginBottom: '4px' }}>
                          kubectl describe pod {kubectlNsFlag}{realPodName || serviceDisplayName}
                        </div>
                        <div style={{ color: '#38BDF8' }}>
                          kubectl get pods {kubectlNsFlag} -l app={serviceDisplayName}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* ======================================================== */}
              {/* CARD 6: BÁO CÁO SRE (TÓM TẮT) */}
              {/* ======================================================== */}
              <div
                style={{
                  backgroundColor: '#F8FAFC',
                  borderRadius: '10px',
                  border: '1px solid #E2E8F0',
                  padding: '14px 18px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <FileText size={16} color="#2563EB" />
                    <span style={{ fontSize: '0.84375rem', fontWeight: 800, color: '#1E293B' }}>
                      Báo cáo SRE (Tóm tắt)
                    </span>
                    <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#166534', backgroundColor: '#DCFCE7', padding: '1px 6px', borderRadius: '4px' }}>
                      BÁO CÁO GIẢI TRÌNH SRE (SRE INCIDENT REPORT)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopyText(`${sreSummaryText}\n\n${fullExplanationVi}`, 'sre-report-copy')}
                    aria-label="Sao chép giải trình"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '4px 10px',
                      fontSize: '0.71875rem',
                      fontWeight: 600,
                      backgroundColor: '#FFFFFF',
                      border: '1px solid #CBD5E1',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      color: '#334155',
                    }}
                  >
                    {copiedKey === 'sre-report-copy' ? <Check size={12} color="#10B981" /> : <Copy size={12} />}
                    <span>{copiedKey === 'sre-report-copy' ? 'Đã sao chép' : 'Sao chép báo cáo'}</span>
                  </button>
                </div>

                <div style={{ fontSize: '0.78125rem', color: '#334155', lineHeight: 1.5, marginBottom: '8px' }}>
                  {sreSummaryText}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', paddingTop: '8px', borderTop: '1px dashed #CBD5E1' }}>
                  {fullExplanationVi.split('\n').filter(Boolean).map((line, idx) => (
                    <div key={idx} style={{ fontSize: '0.75rem', color: '#475569', lineHeight: 1.45 }}>
                      {line}
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}

          {/* TAB 2: LLM I/O & GRU 7 HEADS */}
          {activeTab === 'io' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* ======================================================== */}
              {/* 2. KẾT QUẢ DỰ BÁO TỪ MÔ HÌNH HỌC SÂU GRU (7 Heads) */}
              {/* ======================================================== */}
              <div
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: '10px',
                  border: '1px solid #E2E8F0',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    padding: '12px 16px',
                    backgroundColor: '#F5F3FF',
                    borderBottom: '1px solid #DDD6FE',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '8px',
                  }}
                >
                  <div style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#6D28D9', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Activity size={16} color="#7C3AED" />
                    <span>KẾT QUẢ DỰ BÁO TỪ MÔ HÌNH HỌC SÂU GRU (7 HEADS ARCHITECTURE)</span>
                  </div>
                  <span style={{ fontSize: '0.6875rem', color: '#5B21B6', fontWeight: 600, backgroundColor: '#EDE9FE', padding: '2px 8px', borderRadius: '4px' }}>
                    Ngưỡng phân loại chuẩn: {(primaryThreshold * 100).toFixed(0)}%
                  </span>
                </div>

                <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {/* Tóm tắt các rủi ro vượt ngưỡng */}
                  <div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155', marginBottom: '8px' }}>
                      Rủi ro vượt ngưỡng kích hoạt (Detected Risks):
                    </div>
                    {detectedRisksList.length > 0 ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {detectedRisksList.map((r, i) => {
                          const riskConf = parseConfidence(r.confidence);
                          return (
                            <div
                              key={i}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '6px 12px',
                                backgroundColor: '#FEF2F2',
                                color: '#B91C1C',
                                border: '1px solid #FECACA',
                                borderRadius: '6px',
                                fontWeight: 700,
                                fontSize: '0.75rem',
                              }}
                            >
                              <AlertTriangle size={13} color="#DC2626" />
                              <span>{HEAD_NAMES_VI[r.risk_type] || r.risk_type}</span>
                              {riskConf !== null && (
                                <span style={{ backgroundColor: '#DC2626', color: '#FFFFFF', padding: '1px 6px', borderRadius: '3px', fontSize: '0.6875rem' }}>
                                  {riskConf}%
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (gruPrediction || incidentDetail?.prediction_id) ? (
                      <div
                        style={{
                          padding: '10px 14px',
                          backgroundColor: '#F0FDF4',
                          border: '1px solid #BBF7D0',
                          borderRadius: '8px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                        }}
                      >
                        <CheckCircle2 size={16} color="#15803D" />
                        <span style={{ fontSize: '0.78125rem', color: '#166534', fontWeight: 600 }}>
                          Không có rủi ro viễn trắc nào vượt ngưỡng. Toàn bộ các chỉ số tài nguyên được giám sát đều trong giới hạn an toàn.
                        </span>
                      </div>
                    ) : (
                      <div
                        style={{
                          padding: '10px 14px',
                          backgroundColor: '#F8FAFC',
                          border: '1px solid #E2E8F0',
                          borderRadius: '8px',
                          fontSize: '0.78125rem',
                          color: '#64748B',
                          fontWeight: 500,
                        }}
                      >
                        Không có dữ liệu dự báo GRU gắn với sự cố này.
                      </div>
                    )}
                  </div>

                  {/* BẢNG 7 HEADS VỚI PROGRESS BAR */}
                  <div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155', marginBottom: '8px' }}>
                      Chi tiết điểm số &amp; ngưỡng kích hoạt của 7 Heads:
                    </div>
                    {riskOutputsAll && Object.keys(riskOutputsAll).length > 0 ? (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '8px' }}>
                        {Object.entries(riskOutputsAll).map(([headName, headData]) => {
                          const rawConf = headData?.confidence ?? 0;
                          const confPct = Math.round(rawConf <= 1 ? rawConf * 100 : rawConf);
                          const thVal = gruThresholds[headName] ?? primaryThreshold;
                          const thPct = Math.round(thVal <= 1 ? thVal * 100 : thVal);
                          const isTriggered = confPct >= thPct;

                          return (
                            <div
                              key={headName}
                              style={{
                                padding: '10px 12px',
                                borderRadius: '8px',
                                backgroundColor: isTriggered ? '#FEF2F2' : '#F8FAFC',
                                border: isTriggered ? '1px solid #FECACA' : '1px solid #E2E8F0',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: isTriggered ? '#DC2626' : '#334155' }}>
                                  {HEAD_NAMES_VI[headName] || headName}
                                </span>
                                <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: isTriggered ? '#B91C1C' : '#64748B' }}>
                                  {confPct}% (Ngưỡng {thPct}%)
                                </span>
                              </div>
                              <div style={{ width: '100%', height: '6px', backgroundColor: '#E2E8F0', borderRadius: '3px', overflow: 'hidden' }}>
                                <div
                                  style={{
                                    width: `${Math.min(confPct, 100)}%`,
                                    height: '100%',
                                    backgroundColor: isTriggered ? '#DC2626' : '#3B82F6',
                                    borderRadius: '3px',
                                    transition: 'width 0.3s ease',
                                  }}
                                />
                              </div>
                              <div style={{ fontSize: '0.625rem', marginTop: '4px', fontWeight: 600, color: isTriggered ? '#991B1B' : '#64748B' }}>
                                {isTriggered ? 'VƯỢT NGƯỠNG CẢNH BÁO' : 'Trong giới hạn an toàn'}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div
                        style={{
                          padding: '10px 14px',
                          backgroundColor: '#F8FAFC',
                          border: '1px solid #E2E8F0',
                          borderRadius: '8px',
                          fontSize: '0.78125rem',
                          color: '#64748B',
                        }}
                      >
                        Điểm xác suất chi tiết của 7 Heads GRU chưa được lưu trong payload RCA này.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* BẢNG 8 CHỈ SỐ TỔNG HỢP (SUMMARY METRICS) */}
              <div
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: '10px',
                  border: '1px solid #E2E8F0',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    padding: '12px 16px',
                    backgroundColor: '#EFF6FF',
                    borderBottom: '1px solid #BFDBFE',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '8px',
                  }}
                >
                  <div style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#1E40AF', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Sliders size={16} color="#2563EB" />
                    <span>DỮ LIỆU ĐẦU VÀO AI ({formattedTimesteps.length} MỐC VIỄN TRẮC TELEMETRY)</span>
                  </div>
                  <span style={{ fontSize: '0.6875rem', color: '#1D4ED8', fontWeight: 600, backgroundColor: '#DBEAFE', padding: '2px 8px', borderRadius: '4px' }}>
                    {formattedTimesteps.length > 0 ? `${formattedTimesteps.length} mốc telemetry từ CSDL` : 'Không có dữ liệu telemetry'}
                  </span>
                </div>

                <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {formattedTimesteps.length === 0 && (
                    <div
                      style={{
                        padding: '12px 14px',
                        backgroundColor: '#F8FAFC',
                        border: '1px solid #E2E8F0',
                        borderRadius: '8px',
                        fontSize: '0.78125rem',
                        color: '#64748B',
                      }}
                    >
                      Chưa ghi nhận chuỗi viễn trắc đầu vào cho sự cố này trong CSDL.
                    </div>
                  )}
                  {metricSummary && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px' }}>
                      <div style={{ padding: '4px 6px', borderRadius: '5px', backgroundColor: '#F0FDF4', border: '1px solid #DCFCE7' }}>
                        <div style={{ fontSize: '0.625rem', fontWeight: 700, color: '#15803D', textTransform: 'uppercase' }}>CPU (%)</div>
                        <div style={{ fontSize: '0.875rem', fontWeight: 800, color: '#0F172A', marginTop: '2px' }}>
                          {metricSummary.cpu.current}%
                        </div>
                        <div style={{ fontSize: '0.625rem', color: '#166534' }}>Max: {metricSummary.cpu.max}%</div>
                      </div>

                      <div style={{ padding: '4px 6px', borderRadius: '5px', backgroundColor: '#EFF6FF', border: '1px solid #DBEAFE' }}>
                        <div style={{ fontSize: '0.625rem', fontWeight: 700, color: '#1D4ED8', textTransform: 'uppercase' }}>RAM (%)</div>
                        <div style={{ fontSize: '0.875rem', fontWeight: 800, color: '#0F172A', marginTop: '2px' }}>
                          {metricSummary.ram.current}%
                        </div>
                        <div style={{ fontSize: '0.625rem', color: '#1E40AF' }}>Max: {metricSummary.ram.max}%</div>
                      </div>

                      <div style={{ padding: '4px 6px', borderRadius: '5px', backgroundColor: '#FFFBEB', border: '1px solid #FEF3C7' }}>
                        <div style={{ fontSize: '0.625rem', fontWeight: 700, color: '#B45309', textTransform: 'uppercase' }}>DISK (%)</div>
                        <div style={{ fontSize: '0.875rem', fontWeight: 800, color: '#0F172A', marginTop: '2px' }}>
                          {metricSummary.disk.current}%
                        </div>
                        <div style={{ fontSize: '0.625rem', color: '#92400E' }}>Max: {metricSummary.disk.max}%</div>
                      </div>

                      <div style={{ padding: '4px 6px', borderRadius: '5px', backgroundColor: '#F5F3FF', border: '1px solid #EDE9FE' }}>
                        <div style={{ fontSize: '0.625rem', fontWeight: 700, color: '#6D28D9', textTransform: 'uppercase' }}>ĐỘ TRỄ (MS)</div>
                        <div style={{ fontSize: '0.875rem', fontWeight: 800, color: '#0F172A', marginTop: '2px' }}>
                          {metricSummary.latency.current} ms
                        </div>
                        <div style={{ fontSize: '0.625rem', color: '#5B21B6' }}>Max: {metricSummary.latency.max} ms</div>
                      </div>

                      <div style={{ padding: '4px 6px', borderRadius: '5px', backgroundColor: '#ECFEFF', border: '1px solid #CFFAFE' }}>
                        <div style={{ fontSize: '0.625rem', fontWeight: 700, color: '#0E7490', textTransform: 'uppercase' }}>REQ RATE</div>
                        <div style={{ fontSize: '0.875rem', fontWeight: 800, color: '#0F172A', marginTop: '2px' }}>
                          {metricSummary.request_rate.current} <span style={{ fontSize: '0.6875rem' }}>req/s</span>
                        </div>
                        <div style={{ fontSize: '0.625rem', color: '#155E75' }}>Max: {metricSummary.request_rate.max}</div>
                      </div>

                      <div style={{ padding: '8px 10px', borderRadius: '6px', backgroundColor: metricSummary.http_5xx_rate.max > 0 ? '#FEF2F2' : '#F8FAFC', border: metricSummary.http_5xx_rate.max > 0 ? '1px solid #FECACA' : '1px solid #E2E8F0' }}>
                        <div style={{ fontSize: '0.625rem', fontWeight: 700, color: metricSummary.http_5xx_rate.max > 0 ? '#DC2626' : '#64748B', textTransform: 'uppercase' }}>LỖI 5XX (%)</div>
                        <div style={{ fontSize: '0.875rem', fontWeight: 800, color: '#0F172A', marginTop: '2px' }}>
                          {metricSummary.http_5xx_rate.current}%
                        </div>
                        <div style={{ fontSize: '0.625rem', color: '#B91C1C' }}>Đỉnh: {metricSummary.http_5xx_rate.max}%</div>
                      </div>

                      <div style={{ padding: '4px 6px', borderRadius: '5px', backgroundColor: '#FDF2F8', border: '1px solid #FCE7F3' }}>
                        <div style={{ fontSize: '0.625rem', fontWeight: 700, color: '#BE185D', textTransform: 'uppercase' }}>RESTARTS</div>
                        <div style={{ fontSize: '0.875rem', fontWeight: 800, color: '#0F172A', marginTop: '2px' }}>
                          {metricSummary.pod_restart_count}
                        </div>
                        <div style={{ fontSize: '0.625rem', color: '#9D174D' }}>K8s Restarts</div>
                      </div>

                      <div style={{ padding: '4px 6px', borderRadius: '5px', backgroundColor: '#EEF2FF', border: '1px solid #E0E7FF' }}>
                        <div style={{ fontSize: '0.625rem', fontWeight: 700, color: '#4338CA', textTransform: 'uppercase' }}>REPLICAS</div>
                        <div style={{ fontSize: '0.875rem', fontWeight: 800, color: '#0F172A', marginTop: '2px' }}>
                          {metricSummary.replica_count}
                        </div>
                        <div style={{ fontSize: '0.625rem', color: '#3730A3' }}>Pods cụm</div>
                      </div>
                    </div>
                  )}

                  {/* BẢNG NHẬT KÝ MỐC VIỄN TRẮC (Audit Table) */}
                  {formattedTimesteps.length > 0 && (
                    <div style={{ overflowX: 'auto', border: '1px solid #E2E8F0', borderRadius: '8px' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', textAlign: 'center' }}>
                        <thead>
                          <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569', fontWeight: 700 }}>
                            <th style={{ padding: '3px 5px' }}>Mốc</th>
                            <th style={{ padding: '3px 5px' }}>Thời Điểm</th>
                            <th style={{ padding: '3px 5px' }}>CPU (%)</th>
                            <th style={{ padding: '3px 5px' }}>RAM (%)</th>
                            <th style={{ padding: '3px 5px' }}>Disk (%)</th>
                            <th style={{ padding: '3px 5px' }}>Req Rate</th>
                            <th style={{ padding: '3px 5px' }}>Độ Trễ</th>
                            <th style={{ padding: '3px 5px' }}>5xx (%)</th>
                            <th style={{ padding: '3px 5px' }}>Restarts</th>
                            <th style={{ padding: '3px 5px' }}>Replicas</th>
                          </tr>
                        </thead>
                        <tbody>
                          {formattedTimesteps.map((row, idx) => (
                            <tr
                              key={idx}
                              style={{
                                borderBottom: '1px solid #F1F5F9',
                                backgroundColor: idx % 2 === 0 ? '#FFFFFF' : '#FAFAFA',
                              }}
                            >
                              <td style={{ padding: '3px 5px', fontWeight: 700, color: '#4F46E5', backgroundColor: '#EEF2FF' }}>
                                {row.stepLabel}
                              </td>
                              <td style={{ padding: '3px 5px', color: '#64748B' }}>{row.displayTime || '-'}</td>
                              <td style={{ padding: '3px 5px', color: row.cpu > 70 ? '#DC2626' : '#10B981', fontWeight: row.cpu > 70 ? 700 : 400 }}>{row.cpu}%</td>
                              <td style={{ padding: '3px 5px', color: '#3B82F6' }}>{row.ram}%</td>
                              <td style={{ padding: '3px 5px', color: '#F59E0B' }}>{row.disk}%</td>
                              <td style={{ padding: '3px 5px', color: '#06B6D4' }}>{row.request_rate}</td>
                              <td style={{ padding: '3px 5px', color: row.latency > 100 ? '#D97706' : '#8B5CF6' }}>{row.latency} ms</td>
                              <td style={{ padding: '3px 5px', color: row.http_5xx_rate > 0 ? '#DC2626' : '#64748B' }}>{row.http_5xx_rate}%</td>
                              <td style={{ padding: '3px 5px', color: row.pod_restart_count > 0 ? '#DC2626' : '#64748B' }}>{row.pod_restart_count}</td>
                              <td style={{ padding: '3px 5px', color: '#4338CA' }}>{row.replica_count}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>


            </div>
          )}
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '12px 22px',
            backgroundColor: '#F8FAFC',
            borderTop: '1px solid #E2E8F0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ fontSize: '0.75rem', color: '#64748B' }}>
            Thời điểm ghi nhận: {(() => {
              const rawDate = incidentDetail?.detected_at || incidentDetail?.created_at || incident?.detectedAt || incident?.created_at;
              if (!rawDate) return 'Chưa ghi nhận';
              const d = new Date(rawDate);
              return isNaN(d.getTime()) ? String(rawDate) : d.toLocaleString('vi-VN');
            })()}
            {occurrenceCount > 1 && (incidentDetail?.last_occurred_at || incident?.lastOccurredAt) && (() => {
              const rawLast = incidentDetail?.last_occurred_at || incident?.lastOccurredAt;
              const dLast = new Date(rawLast);
              const formattedLast = isNaN(dLast.getTime()) ? String(rawLast) : dLast.toLocaleString('vi-VN');
              return ` • Lần gần nhất: ${formattedLast}`;
            })()}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              disabled={isLoadingDetail}
              onClick={() => handleCopyText(
                parsedAnalysis || {
                  request_id: requestId,
                  incident_id: incidentIdStr,
                  cluster_id: incidentDetail?.cluster_id || incident?.clusterId || clusterDisplayName || null,
                  namespace: rawNamespace || null,
                  service_id: serviceDisplayName,
                  workload_id: workloadIdStr,
                  analyzed_at: analyzedAtStr,
                  analysis_duration_ms: analysisDurationMs,
                  prediction: gruPrediction,
                  root_cause: { cause: rootCauseType, category: rootCauseCategory, confidence: confidence !== null ? confidence / 100 : null, severity },
                  evidence: multiTierEvidences,
                  recommendation: { action: recAction, priority: actionPriority, risk_level: actionRiskLevel, requires_approval: requiresApproval, reason: recReason, action_parameters: actionParams },
                  explanation: fullExplanation,
                  historical_context_used: historicalContextUsed,
                  similar_incident_ids: similarIncidentIds
                },
                'raw_json'
              )}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '7px 14px',
                backgroundColor: '#FFFFFF',
                border: '1px solid #CBD5E1',
                borderRadius: '8px',
                fontSize: '0.78125rem',
                fontWeight: 600,
                color: '#475569',
                cursor: isLoadingDetail ? 'not-allowed' : 'pointer',
                opacity: isLoadingDetail ? 0.6 : 1,
              }}
              title="Sao chép toàn bộ payload JSON dữ liệu phân tích RCA phục vụ kỹ thuật"
            >
              {copiedKey === 'raw_json' ? <Check size={13} color="#10B981" /> : <Copy size={13} />}
              <span>{copiedKey === 'raw_json' ? 'Đã sao chép JSON' : 'Sao chép JSON'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '7px 20px',
                backgroundColor: '#059669',
                border: '1px solid #059669',
                borderRadius: '8px',
                fontSize: '0.8125rem',
                fontWeight: 700,
                color: '#FFFFFF',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              Đóng
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RootCauseModal;
