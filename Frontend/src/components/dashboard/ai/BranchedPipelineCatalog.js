import i18n from '../../../i18n';
import {
  Activity,
  FileText,
  Server,
  History,
  Cpu,
  HardDrive,
  Clock,
  TrendingUp,
  AlertTriangle,
  RotateCcw,
  Layers,
  ShieldAlert,
  ShieldCheck,
  Zap,
  CheckCircle2,
  ScrollText,
  Database,
  Network,
  Wrench,
  Box,
} from 'lucide-react';

/**
 * 4 Tác tử Gom Ngữ Cảnh Độc Lập trong giai đoạn Multi-Agent RCA.
 */
export const BRANCHED_CONTEXT_AGENTS = [
  {
    id: 'metrics',
    name: 'Metrics Agent',
    role: 'Phân tích chuỗi 12 bước (60s)',
    detail: 'Đọc CPU, RAM, Disk, Latency, Req/s, HTTP 5xx từ Prometheus / eBPF',
    icon: Activity,
    color: '#2563EB',
    bg: '#EFF6FF',
    border: '#BFDBFE',
  },
  {
    id: 'log',
    name: 'Log Agent',
    role: 'Quét nhật ký Container',
    detail: 'Phát hiện OOMKilled, Exception 5xx, lỗi kết nối upstream & Probe failure',
    icon: FileText,
    color: '#D97706',
    bg: '#FFFBEB',
    border: '#FDE68A',
  },
  {
    id: 'k8s_event',
    name: 'K8s Event Agent',
    role: 'Trạng thái cụm Kubernetes',
    detail: 'Kiểm tra Pod Phase, CrashLoopBackOff, Restart delta, Replica & Node capacity',
    icon: Server,
    color: '#059669',
    bg: '#ECFDF5',
    border: '#A7F3D0',
  },
  {
    id: 'history',
    name: 'History Agent',
    role: 'Đối chiếu lịch sử sự cố',
    detail: 'Tra cứu các sự cố tương tự, Action bậc 1 đã thử và kết quả hậu kiểm 24h',
    icon: History,
    color: '#7C3AED',
    bg: '#F5F3FF',
    border: '#DDD6FE',
  },
];

/**
 * 16 Nguyên nhân gốc chuẩn từ CauseEvaluator.CAUSE_LABELS (AI_backend/app/rca/cause_evaluator.py).
 */
export const BRANCHED_ROOT_CAUSES = [
  {
    index: 1,
    code: 'memory_exhaustion',
    labelVi: 'Cạn kiệt bộ nhớ container (OOM)',
    shortLabelVi: 'Tràn bộ nhớ RAM (OOM)',
    icon: Server,
    color: '#DC2626',
    bg: '#FEF2F2',
    triggerMetrics: ['ram', 'pod_restart_count'],
    triggerRules: ['R3', 'R5'],
    triggerRisks: ['OOM'],
    agents: ['metrics', 'log', 'k8s_event', 'history'],
    primaryActionCode: 'RESTART_POD',
    secondaryActionCode: 'REPLACE_POD',
    policyBranch: 'AUTO',
    policyReasonVi: 'OOM Cấp 1 ưu tiên khởi động lại Pod giải phóng RAM; nếu tái diễn leo thang REPLACE_POD.',
  },
  {
    index: 2,
    code: 'storage_exhaustion',
    labelVi: 'Cạn kiệt dung lượng lưu trữ',
    shortLabelVi: 'Đầy ổ đĩa lưu trữ (Disk Full)',
    icon: HardDrive,
    color: '#D97706',
    bg: '#FFFBEB',
    triggerMetrics: ['disk'],
    triggerRules: ['R6'],
    triggerRisks: ['DISK_FULL'],
    agents: ['metrics', 'log', 'k8s_event'],
    primaryActionCode: 'CLEANUP_TEMP_FILES',
    secondaryActionCode: null,
    policyBranch: 'AUTO',
    policyReasonVi: 'Ổ đĩa > 85%, kích hoạt dọn file tạm & log rác an toàn tự động (CLEANUP_STORAGE).',
  },
  {
    index: 3,
    code: 'cpu_saturation',
    labelVi: 'Bão hòa tài nguyên CPU',
    shortLabelVi: 'Bão hòa CPU (CPU Saturation)',
    icon: Cpu,
    color: '#EA580C',
    bg: '#FFF7ED',
    triggerMetrics: ['cpu', 'latency'],
    triggerRules: ['R1'],
    triggerRisks: ['CPU_OVERLOAD'],
    agents: ['metrics', 'k8s_event', 'history'],
    primaryActionCode: 'SCALE_REPLICAS',
    secondaryActionCode: 'RESTART_POD',
    policyBranch: 'AUTO',
    policyReasonVi: 'Two-Tier Capacity xác nhận Node đủ tài nguyên → tự động tăng Replica chia tải CPU.',
  },
  {
    index: 4,
    code: 'traffic_overload',
    labelVi: 'Quá tải lưu lượng truy cập',
    shortLabelVi: 'Quá tải lưu lượng (Traffic)',
    icon: TrendingUp,
    color: '#0284C7',
    bg: '#F0F9FF',
    triggerMetrics: ['request_rate', 'latency', 'replica_count'],
    triggerRules: ['R2'],
    triggerRisks: ['TRAFFIC_OVERLOAD'],
    agents: ['metrics', 'log', 'k8s_event'],
    primaryActionCode: 'SCALE_REPLICAS',
    secondaryActionCode: 'BLOCK_IP_TEMP',
    policyBranch: 'AUTO',
    policyReasonVi: 'Traffic tăng đột biến → Scale Replicas tự động (nếu phát hiện IP tấn công sẽ rẽ chặn IP qua HITL).',
  },
  {
    index: 5,
    code: 'unstable_pod',
    labelVi: 'Pod ứng dụng bất ổn định / CrashLoop',
    shortLabelVi: 'Pod bất ổn / CrashLoop',
    icon: RotateCcw,
    color: '#DC2626',
    bg: '#FEF2F2',
    triggerMetrics: ['pod_restart_count'],
    triggerRules: ['R5'],
    triggerRisks: ['OOM', 'HTTP_5XX_SPIKE'],
    agents: ['metrics', 'log', 'k8s_event', 'history'],
    primaryActionCode: 'REPLACE_POD',
    secondaryActionCode: 'RESTART_POD',
    policyBranch: 'AUTO',
    policyReasonVi: 'Pod restart nhiều lần / CrashLoopBackOff → Tạo mới Pod (REPLACE_POD) thay thế tiến trình lỗi.',
  },
  {
    index: 6,
    code: 'deployment_failure',
    labelVi: 'Lỗi triển khai phiên bản mới',
    shortLabelVi: 'Lỗi triển khai Deployment mới',
    icon: Layers,
    color: '#B91C1C',
    bg: '#FEF2F2',
    triggerMetrics: ['pod_restart_count', 'http_5xx_rate'],
    triggerRules: ['R4', 'R5'],
    triggerRisks: ['HTTP_5XX_SPIKE'],
    agents: ['log', 'k8s_event', 'history'],
    primaryActionCode: 'ROLLBACK_DEPLOYMENT',
    secondaryActionCode: 'REPLACE_POD',
    policyBranch: 'HITL',
    policyReasonVi: 'Bản phát hành mới gây lỗi → Đề xuất hoàn nguyên bản cũ và đưa qua Cổng duyệt HITL.',
  },
  {
    index: 7,
    code: 'dependency_failure',
    labelVi: 'Lỗi dịch vụ phụ thuộc thượng nguồn',
    shortLabelVi: 'Lỗi dịch vụ phụ thuộc (Upstream)',
    icon: Network,
    color: '#64748B',
    bg: '#F8FAFC',
    triggerMetrics: ['latency', 'http_5xx_rate'],
    triggerRules: ['R4'],
    triggerRisks: ['HIGH_LATENCY', 'HTTP_5XX_SPIKE'],
    agents: ['metrics', 'log', 'k8s_event'],
    primaryActionCode: 'NO_ACTION',
    secondaryActionCode: null,
    policyBranch: 'AUDIT',
    policyReasonVi: 'Lỗi từ upstream (DB/API ngoài) → Khóa an toàn NO_ACTION để không restart oan dịch vụ này.',
  },
  {
    index: 8,
    code: 'application_failure',
    labelVi: 'Lỗi ứng dụng nội bộ (HTTP 5xx)',
    shortLabelVi: 'Lỗi ứng dụng nội bộ (5xx)',
    icon: AlertTriangle,
    color: '#DC2626',
    bg: '#FEF2F2',
    triggerMetrics: ['http_5xx_rate', 'latency'],
    triggerRules: ['R4'],
    triggerRisks: ['HTTP_5XX_SPIKE'],
    agents: ['metrics', 'log', 'k8s_event', 'history'],
    primaryActionCode: 'RESTART_DEPLOYMENT',
    secondaryActionCode: 'ROLLBACK_DEPLOYMENT',
    policyBranch: 'AUTO',
    policyReasonVi: 'Lỗi 5xx nội bộ rải rác trên Deployment → Rolling restart Deployment (hoặc Rollback qua HITL nếu sau deploy).',
  },
  {
    index: 9,
    code: 'service_degradation',
    labelVi: 'Suy giảm hiệu năng dịch vụ',
    shortLabelVi: 'Suy giảm hiệu năng / Trễ cao',
    icon: Clock,
    color: '#7C3AED',
    bg: '#F5F3FF',
    triggerMetrics: ['latency', 'cpu'],
    triggerRules: ['R1'],
    triggerRisks: ['HIGH_LATENCY'],
    agents: ['metrics', 'log', 'k8s_event'],
    primaryActionCode: 'SCALE_REPLICAS',
    secondaryActionCode: 'RESTART_POD',
    policyBranch: 'AUTO',
    policyReasonVi: 'Độ trễ vượt SLO → Scale thêm Replica chia tải (nếu không đỡ leo thang RESTART_POD).',
  },
  {
    index: 10,
    code: 'insufficient_replicas',
    labelVi: 'Không đủ số lượng Pod replica',
    shortLabelVi: 'Thiếu số lượng Pod Replica',
    icon: Box,
    color: '#2563EB',
    bg: '#EFF6FF',
    triggerMetrics: ['replica_count', 'cpu', 'latency'],
    triggerRules: ['R2', 'R5'],
    triggerRisks: ['CPU_OVERLOAD', 'TRAFFIC_OVERLOAD'],
    agents: ['metrics', 'k8s_event'],
    primaryActionCode: 'SCALE_REPLICAS',
    secondaryActionCode: null,
    policyBranch: 'AUTO',
    policyReasonVi: 'Số Pod khả dụng thấp hơn nhu cầu tải → Tự động tăng Replicas lên mức tối thiểu an toàn.',
  },
  {
    index: 11,
    code: 'scheduling_failure',
    labelVi: 'Lỗi lập lịch điều phối Kubernetes',
    shortLabelVi: 'Lỗi lập lịch Node (Scheduling)',
    icon: Server,
    color: '#B45309',
    bg: '#FFFBEB',
    triggerMetrics: ['replica_count'],
    triggerRules: ['R5'],
    triggerRisks: [],
    agents: ['k8s_event', 'history'],
    primaryActionCode: 'DRAIN_NODE',
    secondaryActionCode: 'REPLACE_POD',
    policyBranch: 'HITL',
    policyReasonVi: 'Pod kẹt Pending / Node quá tải tài nguyên → Đề xuất Drain Node sang Node khỏe (rủi ro cao → duyệt HITL).',
  },
  {
    index: 12,
    code: 'underutilized',
    labelVi: 'Tài nguyên dư thừa (Thu hẹp quy mô)',
    shortLabelVi: 'Dư thừa tài nguyên (Scale Down)',
    icon: Layers,
    color: '#0284C7',
    bg: '#F0F9FF',
    triggerMetrics: ['cpu', 'request_rate', 'replica_count'],
    triggerRules: [],
    triggerRisks: ['SCALE_DOWN_CANDIDATE'],
    agents: ['metrics', 'k8s_event'],
    primaryActionCode: 'SCALE_REPLICAS',
    secondaryActionCode: null,
    policyBranch: 'AUTO',
    policyReasonVi: 'Tải thấp kéo dài trên Deployment nhiều bản sao → Thu hẹp bớt Replica tối ưu tài nguyên (chặn nếu DaemonSet).',
  },
  {
    index: 13,
    code: 'probe_configuration_error',
    labelVi: 'Lỗi cấu hình kiểm tra Probe',
    shortLabelVi: 'Lỗi cấu hình Health Probe',
    icon: Wrench,
    color: '#9333EA',
    bg: '#FAF5FF',
    triggerMetrics: ['pod_restart_count'],
    triggerRules: ['R5'],
    triggerRisks: [],
    agents: ['log', 'k8s_event'],
    primaryActionCode: 'NO_ACTION',
    secondaryActionCode: null,
    policyBranch: 'AUDIT',
    policyReasonVi: 'Liveness/Readiness Probe timeout do cấu hình YAML → Không tự sửa được YAML, cảnh báo kỹ sư qua Audit.',
  },
  {
    index: 14,
    code: 'network_degradation',
    labelVi: 'Suy giảm kết nối mạng',
    shortLabelVi: 'Suy giảm / Tấn công mạng',
    icon: ShieldAlert,
    color: '#B45309',
    bg: '#FFFBEB',
    triggerMetrics: ['latency', 'http_5xx_rate', 'request_rate'],
    triggerRules: ['R2', 'R4'],
    triggerRisks: ['HIGH_LATENCY', 'TRAFFIC_OVERLOAD'],
    agents: ['metrics', 'log', 'k8s_event'],
    primaryActionCode: 'BLOCK_IP_TEMP',
    secondaryActionCode: 'NO_ACTION',
    policyBranch: 'HITL',
    policyReasonVi: 'Nếu phát hiện IP nguồn bất thường/flood → Chặn IP tạm thời (HITL); nếu lỗi mạng nội bộ → chuyển kỹ sư Audit.',
  },
  {
    index: 15,
    code: 'database_cache_utilization',
    labelVi: 'Bộ nhớ đệm CSDL (WiredTiger Cache)',
    shortLabelVi: 'Bộ nhớ đệm DB (WiredTiger)',
    icon: Database,
    color: '#059669',
    bg: '#ECFDF5',
    triggerMetrics: ['ram'],
    triggerRules: ['R3'],
    triggerRisks: ['OOM'],
    agents: ['metrics', 'k8s_event'],
    primaryActionCode: 'NO_ACTION',
    secondaryActionCode: null,
    policyBranch: 'AUDIT',
    policyReasonVi: 'RAM cao ổn định trên DB không kèm OOMKilled là cơ chế Buffer Cache chuẩn → Bảo vệ NO_ACTION, không restart DB.',
  },
  {
    index: 16,
    code: 'unknown',
    labelVi: 'Chưa xác định (Thiếu bằng chứng)',
    shortLabelVi: 'Chưa xác định (UNKNOWN)',
    icon: ShieldCheck,
    color: '#475569',
    bg: '#F8FAFC',
    triggerMetrics: [],
    triggerRules: [],
    triggerRisks: [],
    agents: ['metrics', 'log', 'k8s_event', 'history'],
    primaryActionCode: 'NO_ACTION',
    secondaryActionCode: null,
    policyBranch: 'AUDIT',
    policyReasonVi: 'Bằng chứng chưa đủ hoặc xung đột tín hiệu → Ngắt mạch Circuit Breaker (NO_ACTION), ghi Audit để con người kiểm tra.',
  },
];

/**
 * 10 Hành động chuẩn đồng bộ với CANONICAL_ACTION_TYPES (ActionHistoryPage.jsx) & Catalog DB.
 */
export const BRANCHED_ACTIONS = [
  {
    index: 1,
    code: 'RESTART_POD',
    labelVi: 'Khởi động lại Pod',
    riskLevel: 'LOW',
    defaultBranch: 'AUTO',
    aiSupported: true,
    icon: RotateCcw,
    color: '#059669',
    desc: 'Xóa tiến trình container hiện tại để kubelet khởi động lại Pod tức thì.',
  },
  {
    index: 2,
    code: 'SCALE_REPLICAS',
    labelVi: 'Điều chỉnh số bản sao Pod',
    riskLevel: 'LOW',
    defaultBranch: 'AUTO',
    aiSupported: true,
    icon: Layers,
    color: '#0284C7',
    desc: 'Mở rộng hoặc thu hẹp số lượng Replica trên Deployment/StatefulSet.',
  },
  {
    index: 3,
    code: 'ROLLBACK_DEPLOYMENT',
    labelVi: 'Hoàn nguyên Deployment',
    riskLevel: 'HIGH',
    defaultBranch: 'HITL',
    aiSupported: true,
    icon: History,
    color: '#D97706',
    desc: 'Quay lại bản phát hành ổn định trước đó (bắt buộc duyệt HITL).',
  },
  {
    index: 4,
    code: 'REPLACE_POD',
    labelVi: 'Thay thế Pod mới',
    riskLevel: 'MEDIUM',
    defaultBranch: 'AUTO',
    aiSupported: true,
    icon: Zap,
    color: '#7C3AED',
    desc: 'Xóa hoàn toàn Pod lỗi để Controller cấp phát Pod mới sạch sẽ.',
  },
  {
    index: 5,
    code: 'CLEANUP_TEMP_FILES',
    labelVi: 'Dọn dẹp lưu trữ tạm',
    riskLevel: 'LOW',
    defaultBranch: 'AUTO',
    aiSupported: true,
    icon: HardDrive,
    color: '#0D9488',
    desc: 'Giải phóng file tạm và log phình to trong container (CLEANUP_STORAGE).',
  },
  {
    index: 6,
    code: 'RESTART_DEPLOYMENT',
    labelVi: 'Khởi động lại Deployment',
    riskLevel: 'MEDIUM',
    defaultBranch: 'AUTO',
    aiSupported: true,
    icon: Server,
    color: '#2563EB',
    desc: 'Rolling restart tuần tự toàn bộ Pod của Deployment không gián đoạn.',
  },
  {
    index: 7,
    code: 'ADJUST_RESOURCE_LIMITS',
    labelVi: 'Điều chỉnh hạn mức CPU/RAM',
    riskLevel: 'MEDIUM',
    defaultBranch: 'HITL',
    aiSupported: false,
    icon: Cpu,
    color: '#6366F1',
    desc: 'Catalog nâng limits CPU/RAM (hiện cấu hình qua Policy/Manual, AI không tự kích).',
  },
  {
    index: 8,
    code: 'DRAIN_NODE',
    labelVi: 'Di tản Pod khỏi Node',
    riskLevel: 'CRITICAL',
    defaultBranch: 'HITL',
    aiSupported: true,
    icon: ShieldAlert,
    color: '#DC2626',
    desc: 'Cordon & Drain toàn bộ Pod khỏi Node lỗi sang Node khỏe (cần duyệt HITL).',
  },
  {
    index: 9,
    code: 'BLOCK_IP_TEMP',
    labelVi: 'Chặn IP bất thường tạm thời',
    riskLevel: 'HIGH',
    defaultBranch: 'HITL',
    aiSupported: true,
    icon: ShieldCheck,
    color: '#B45309',
    desc: 'Áp dụng NetworkPolicy chặn IP flood trong thời gian ngắn (TEMPORARY_IP_BLOCK).',
  },
  {
    index: 10,
    code: 'NO_ACTION',
    labelVi: 'Giám sát an toàn / Ngắt mạch',
    riskLevel: 'SAFE',
    defaultBranch: 'AUDIT',
    aiSupported: true,
    icon: ScrollText,
    color: '#475569',
    desc: 'Không can thiệp cụm K8s; ghi Audit Log & cảnh báo khi thiếu bằng chứng/DB an toàn.',
  },
];

export const normalizeCauseCodeFromText = (rawText) => {
  const s = String(rawText || '').toLowerCase().trim();
  if (!s) return null;

  for (const item of BRANCHED_ROOT_CAUSES) {
    if (s === item.code || s.includes(item.code)) return item.code;
  }

  if (s.includes('wiredtiger') || s.includes('buffer pool') || s.includes('database_cache') || s.includes('bộ nhớ đệm')) {
    return 'database_cache_utilization';
  }
  if (s.includes('oom') || s.includes('cạn kiệt bộ nhớ') || s.includes('memory_exhaust') || s.includes('memory leak')) {
    return 'memory_exhaustion';
  }
  if (s.includes('disk') || s.includes('storage') || s.includes('dung lượng lưu trữ') || s.includes('ổ đĩa')) {
    return 'storage_exhaustion';
  }
  if (s.includes('cpu_saturation') || s.includes('bão hòa') || s.includes('cpu_overload') || s.includes('cpu saturation')) {
    return 'cpu_saturation';
  }
  if (s.includes('traffic') || s.includes('lưu lượng') || s.includes('surge')) {
    return 'traffic_overload';
  }
  if (s.includes('crashloop') || s.includes('unstable') || s.includes('bất ổn')) {
    return 'unstable_pod';
  }
  if (s.includes('deployment failure') || s.includes('triển khai phiên bản')) {
    return 'deployment_failure';
  }
  if (s.includes('dependency') || s.includes('thượng nguồn') || s.includes('phụ thuộc')) {
    return 'dependency_failure';
  }
  if (s.includes('application failure') || s.includes('application error') || s.includes('5xx') || s.includes('nội bộ')) {
    return 'application_failure';
  }
  if (s.includes('insufficient') || s.includes('không đủ số lượng pod')) {
    return 'insufficient_replicas';
  }
  if (s.includes('scheduling') || s.includes('lập lịch')) {
    return 'scheduling_failure';
  }
  if (s.includes('underutilized') || s.includes('dư thừa') || s.includes('thu hẹp') || s.includes('scale_down')) {
    return 'underutilized';
  }
  if (s.includes('probe')) {
    return 'probe_configuration_error';
  }
  if (s.includes('network') || s.includes('mạng')) {
    return 'network_degradation';
  }
  if (s.includes('degradation') || s.includes('latency') || s.includes('độ trễ') || s.includes('hiệu năng')) {
    return 'service_degradation';
  }
  if (s.includes('unknown') || s.includes('chưa xác định')) {
    return 'unknown';
  }
  return null;
};

export const normalizeActionCodeForBranch = (rawAction) => {
  const s = String(rawAction || '').toUpperCase().trim().replace(/[\s-]+/g, '_');
  if (!s) return null;
  if (s === 'CLEANUP_STORAGE' || s === 'CLEANUP_TEMP_FILES' || s.includes('CLEANUP')) return 'CLEANUP_TEMP_FILES';
  if (s === 'TEMPORARY_IP_BLOCK' || s === 'BLOCK_IP_TEMP' || s === 'BLOCK_IP' || s === 'IP_BLOCK' || s.includes('BLOCK_IP')) {
    return 'BLOCK_IP_TEMP';
  }
  if (s === 'SCALE_UP' || s === 'SCALE_DOWN' || s === 'SCALE_REPLICAS' || s === 'SCALE_DEPLOYMENT' || s === 'SCALE_POD') {
    return 'SCALE_REPLICAS';
  }
  if (s === 'ROLLBACK' || s === 'ROLLBACK_DEPLOYMENT') return 'ROLLBACK_DEPLOYMENT';
  if (s === 'ADJUST_RESOURCE_LIMITS' || s === 'ADJUST_LIMITS') return 'ADJUST_RESOURCE_LIMITS';
  if (s === 'NO_ACTION' || s.includes('NO_ACTION') || s.includes('DUY_TRÌ')) return 'NO_ACTION';
  if (BRANCHED_ACTIONS.some((a) => a.code === s)) return s;
  return null;
};

export const POLICY_BRANCH_META = {
  AUTO: {
    code: 'AUTO',
    labelVi: 'Nhánh AUTO • K8s Agent',
    shortVi: 'Thực thi AUTO',
    color: '#059669',
    bg: '#ECFDF5',
    border: '#A7F3D0',
    icon: Zap,
  },
  HITL: {
    code: 'HITL',
    labelVi: 'Cổng Phê Duyệt (HITL)',
    shortVi: 'Chờ duyệt HITL',
    color: '#D97706',
    bg: '#FFFBEB',
    border: '#FDE68A',
    icon: CheckCircle2,
  },
  AUDIT: {
    code: 'AUDIT',
    labelVi: 'Circuit Breaker & Audit',
    shortVi: 'Ngắt mạch / Audit',
    color: '#DC2626',
    bg: '#FEF2F2',
    border: '#FECACA',
    icon: ScrollText,
  },
};

/**
 * Ánh xạ từng Luật Rule Engine (R1..R6) ↔ Metric đầu vào & các Agent kiểm chứng liên quan.
 */
export const RULE_AGENT_MAP = {
  R1: { sourceMetrics: ['cpu', 'latency'], agents: ['metrics', 'k8s_event'] },
  R2: { sourceMetrics: ['request_rate', 'replica_count'], agents: ['metrics', 'log', 'k8s_event'] },
  R3: { sourceMetrics: ['ram'], agents: ['metrics', 'log', 'k8s_event', 'history'] },
  R4: { sourceMetrics: ['http_5xx_rate'], agents: ['metrics', 'log'] },
  R5: { sourceMetrics: ['pod_restart_count'], agents: ['k8s_event', 'log', 'history'] },
  R6: { sourceMetrics: ['disk'], agents: ['metrics', 'log', 'k8s_event'] },
};

/**
 * Ánh xạ từng Đầu Rủi Ro AI (03) ↔ các Agent thu thập bằng chứng tương ứng.
 */
export const RISK_AGENT_MAP = {
  CPU_OVERLOAD: ['metrics', 'k8s_event', 'history'],
  OOM: ['metrics', 'log', 'k8s_event', 'history'],
  HIGH_LATENCY: ['metrics', 'log', 'k8s_event'],
  DISK_FULL: ['metrics', 'log', 'k8s_event'],
  HTTP_5XX_SPIKE: ['metrics', 'log', 'k8s_event', 'history'],
  TRAFFIC_OVERLOAD: ['metrics', 'log', 'k8s_event'],
  SCALE_DOWN_CANDIDATE: ['metrics', 'k8s_event'],
};

const defaultTranslate = (key, opts) => i18n.t(`dashboard:${key}`, opts);

export const getBranchedContextAgents = (t = defaultTranslate) =>
  BRANCHED_CONTEXT_AGENTS.map((ag) => ({
    ...ag,
    name: t(`branchedCatalog.agents.${ag.id}.name`, { defaultValue: ag.name }),
    role: t(`branchedCatalog.agents.${ag.id}.role`, { defaultValue: ag.role }),
    detail: t(`branchedCatalog.agents.${ag.id}.detail`, { defaultValue: ag.detail }),
  }));

export const getBranchedRootCauses = (t = defaultTranslate) =>
  BRANCHED_ROOT_CAUSES.map((c) => ({
    ...c,
    labelVi: t(`branchedCatalog.causes.${c.code}.label`, { defaultValue: c.labelVi }),
    shortLabelVi: t(`branchedCatalog.causes.${c.code}.short`, { defaultValue: c.shortLabelVi }),
    policyReasonVi: t(`branchedCatalog.causes.${c.code}.reason`, { defaultValue: c.policyReasonVi }),
  }));

export const getBranchedActions = (t = defaultTranslate) =>
  BRANCHED_ACTIONS.map((a) => ({
    ...a,
    labelVi: t(`branchedCatalog.actions.${a.code}.label`, { defaultValue: a.labelVi }),
    desc: t(`branchedCatalog.actions.${a.code}.desc`, { defaultValue: a.desc }),
  }));

export const getPolicyBranchMeta = (t = defaultTranslate) => ({
  AUTO: {
    ...POLICY_BRANCH_META.AUTO,
    labelVi: t('branchedCatalog.policyBranches.AUTO.label', { defaultValue: POLICY_BRANCH_META.AUTO.labelVi }),
    shortVi: t('branchedCatalog.policyBranches.AUTO.short', { defaultValue: POLICY_BRANCH_META.AUTO.shortVi }),
    badge: t('branchedCatalog.policyBranches.AUTO.short', { defaultValue: POLICY_BRANCH_META.AUTO.shortVi }),
  },
  HITL: {
    ...POLICY_BRANCH_META.HITL,
    labelVi: t('branchedCatalog.policyBranches.HITL.label', { defaultValue: POLICY_BRANCH_META.HITL.labelVi }),
    shortVi: t('branchedCatalog.policyBranches.HITL.short', { defaultValue: POLICY_BRANCH_META.HITL.shortVi }),
    badge: t('branchedCatalog.policyBranches.HITL.short', { defaultValue: POLICY_BRANCH_META.HITL.shortVi }),
  },
  AUDIT: {
    ...POLICY_BRANCH_META.AUDIT,
    labelVi: t('branchedCatalog.policyBranches.AUDIT.label', { defaultValue: POLICY_BRANCH_META.AUDIT.labelVi }),
    shortVi: t('branchedCatalog.policyBranches.AUDIT.short', { defaultValue: POLICY_BRANCH_META.AUDIT.shortVi }),
    badge: t('branchedCatalog.policyBranches.AUDIT.short', { defaultValue: POLICY_BRANCH_META.AUDIT.shortVi }),
  },
});

