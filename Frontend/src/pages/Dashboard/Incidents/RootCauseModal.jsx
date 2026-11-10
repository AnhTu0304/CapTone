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
  BookOpen,
  ChevronRight,
  History
} from 'lucide-react';

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
  'UNKNOWN': 'CHƯA XÁC ĐỊNH',

  // 2. Categories
  'DATABASE_RESOURCE_SATURATION': 'BÃO HÒA TÀI NGUYÊN CSDL',
  'INFRASTRUCTURE_SATURATION': 'BÃO HÒA HẠ TẦNG',
  'APPLICATION_SATURATION': 'QUÁ TẢI ỨNG DỤNG',
  'NETWORK_CONGESTION': 'NGHẼN MẠNG',

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
  'SCALE_DOWN_CANDIDATE': 'DƯ THỪA TÀI NGUYÊN',
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

export const RootCauseModal = ({ incident, onClose, onResolve, onNavigate }) => {
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'io'
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

  // QUAN TRỌNG: Nếu yêu cầu này đang nằm trong luồng chờ phê duyệt (HITL Pending),
  // nó CHƯA THỂ là "ĐÃ KHẮC PHỤC" vì kỹ sư chưa bấm duyệt hành động!
  const isResolved = !hasActualPendingApproval && (
    (incidentDetail?.status || incident?.status || '').toLowerCase().includes('resolve') ||
    (incidentDetail?.healing_status || incident?.healingStatus || '').toUpperCase() === 'SUCCEEDED' ||
    (incident?.status && incident?.status.includes('hoàn tất'))
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
  // 3. KẾT LUẬN NGUYÊN NHÂN GỐC RỄ (ROOT CAUSE)
  // ========================================================
  const rootCauseCategory = useMemo(() => {
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
  }, [parsedAnalysis?.root_cause?.category, incidentDetail?.root_cause_category, rootCauseType, serviceDisplayName]);

  // ========================================================
  // 4. BẰNG CHỨNG XÁC THỰC ĐA TẦNG (EVIDENCE - KHÔNG TẠO DỮ LIỆU GIẢ)
  // ========================================================
  const multiTierEvidences = useMemo(() => {
    let raw = [];
    if (Array.isArray(parsedAnalysis?.evidence) && parsedAnalysis.evidence.length > 0) {
      raw = parsedAnalysis.evidence;
    } else if (evidenceList && evidenceList.length > 0) {
      raw = evidenceList.map((e) => `[${e.type || 'EVIDENCE'}] ${e.ref ? `${e.ref}: ` : ''}${e.summary}`);
    }
    return raw.map((item) => translateSREText(item));
  }, [parsedAnalysis?.evidence, evidenceList]);

  // ========================================================
  // 5. ĐỀ XUẤT HÀNH ĐỘNG VỚI THAM SỐ KỸ THUẬT THỰC TẾ TỪ CSDL
  // ========================================================
  const recObj = parsedAnalysis?.recommendation || {};
  const isDbService = ['mongo', 'postgres', 'redis', 'mysql', 'database'].some(db => (serviceDisplayName || '').toLowerCase().includes(db));
  const rawActionParams = recObj.action_parameters || incident?.actionParameters || incidentDetail?.action_parameters || {};

  const blockedActions = Array.isArray(rawActionParams.blocked_actions) ? rawActionParams.blocked_actions : [];
  const consecutiveFailures = Number(rawActionParams.consecutive_failures ?? 0);
  const isCircuitBreakerTripped = Boolean(
    rawActionParams.circuit_breaker_tripped === true ||
    (consecutiveFailures >= 3 && blockedActions.length > 0)
  );

  const realPodName = rawActionParams.faulty_pod_name || rawActionParams.pod_name || incidentDetail?.actual_pod_name || incident?.actualPodName || null;
  const workloadKindRaw = incidentDetail?.workload_type || incident?.workloadType || recObj?.target_type || (isDbService ? 'StatefulSet' : 'Deployment');
  const workloadKindLower = String(workloadKindRaw).toLowerCase().includes('stateful')
    ? 'statefulset'
    : String(workloadKindRaw).toLowerCase().includes('daemon')
      ? 'daemonset'
      : 'deployment';
  const faultyPodName = realPodName || recObj.target_name || serviceDisplayName;
  const faultyPodId = rawActionParams.faulty_pod_id || rawActionParams.pod_id || incidentDetail?.actual_pod_id || recObj.target_id || incidentDetail?.target_id || incident?.id || '';
  const faultyPodUid = rawActionParams.faulty_pod_uid || incidentDetail?.kubernetes_uid || '';
  const faultyNodeName = rawActionParams.faulty_node_name || recObj.target_node || incidentDetail?.node_name || incident?.node || null;
  const faultyNodeId = rawActionParams.faulty_node_id || incidentDetail?.node_id || '';
  const clusterNodeCount = incidentDetail?.cluster_node_count ?? incident?.clusterNodeCount ?? null;
  const replicaSetRole = rawActionParams.replica_set_role || (isDbService ? 'StatefulSet (Stateful)' : 'Deployment (Stateless)');
  const recDestNodeName = rawActionParams.recommended_destination_node_name || rawActionParams.recommended_destination_node || '';
  const recDestNodeId = rawActionParams.recommended_destination_node_id || rawActionParams.destination_node_id || '';
  const destFreeMemBytes = Number(rawActionParams.destination_node_free_memory_bytes || 0);

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
    if (Array.isArray(rawActionParams.manual_playbook) && rawActionParams.manual_playbook.length > 0) {
      return rawActionParams.manual_playbook;
    }
    if (Array.isArray(incident?.manualPlaybook) && incident.manualPlaybook.length > 0) {
      return incident.manualPlaybook;
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
  const rootCauseCategoryVi = SRE_DICTIONARY_VI[rootCauseCategory] || rootCauseCategory;
  const severityVi = severity ? (SRE_DICTIONARY_VI[String(severity).toUpperCase()] || severity) : 'CHƯA PHÂN LOẠI';
  const rootCauseTypeVi = SRE_DICTIONARY_VI[rootCauseType] || translateSREText(rootCauseType);
  const actionPriorityVi = actionPriority ? (SRE_DICTIONARY_VI[String(actionPriority).toUpperCase()] || actionPriority) : 'Chưa phân loại';
  const actionRiskLevelVi = actionRiskLevel ? (SRE_DICTIONARY_VI[String(actionRiskLevel).toUpperCase()] || actionRiskLevel) : 'Chưa phân loại';
  const predictedRiskVi = SRE_DICTIONARY_VI[predictedRisk] || predictedRisk;
  const recReasonVi = translateSREText(recReason);

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

  // Tổng hợp giải trình chi tiết báo cáo sự cố SRE (dữ liệu đã xác thực, không suy diễn giả)
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
    lines.push(
      `• Sự cố phát hiện: Dịch vụ "${serviceDisplayName}" (${targetDesc}) gặp sự cố "${rootCauseTypeVi}" (${rootCauseCategoryVi}, mức độ ${severityVi}).`
    );

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
        .map((e) => String(e).replace(/\.$/, '').trim())
        .filter(Boolean);
      if (topEvs.length > 0) {
        lines.push(`• Bằng chứng xác thực: ${topEvs.join('; ')}.`);
      }
    }

    lines.push(
      `• Phương án tự khắc phục: Đề xuất thực thi hành động "${recActionVi}" (Ưu tiên: ${actionPriorityVi}, Rủi ro: ${actionRiskLevelVi}) để nhanh chóng đưa dịch vụ trở về trạng thái ổn định theo chuẩn MAPE-K.`
    );

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
    recActionVi,
    actionPriorityVi,
    actionRiskLevelVi,
  ]);

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
          maxWidth: '820px',
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
                <span>Chi Tiết Sự Cố &amp; Phân Tích Nguyên Nhân Gốc Rễ (RCA)</span>
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
            <>
              {/* ======================================================== */}
              {/* 3. KẾT LUẬN NGUYÊN NHÂN GỐC RỄ (ROOT CAUSE) */}
              {/* ======================================================== */}
              <div
                style={{
                  padding: '16px 0',
                  borderBottom: '1px solid #E2E8F0',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, color: isResolved ? '#166534' : isUnknownOrNoAction ? '#334155' : '#991B1B', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <Sparkles size={15} />
                    <span>KẾT LUẬN NGUYÊN NHÂN GỐC RỄ (ROOT CAUSE ANALYSIS)</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span
                      style={{
                        fontSize: '0.6875rem',
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: '10px',
                        backgroundColor: '#EDE9FE',
                        color: '#6D28D9',
                        border: '1px solid #DDD6FE',
                      }}
                    >
                      {rootCauseCategoryVi}
                    </span>
                    <span
                      style={{
                        fontSize: '0.6875rem',
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: '10px',
                        backgroundColor: isResolved ? '#DCFCE7' : isUnknownOrNoAction ? '#F1F5F9' : '#FEE2E2',
                        color: isResolved ? '#15803D' : isUnknownOrNoAction ? '#475569' : '#B91C1C',
                        border: isUnknownOrNoAction ? '1px solid #CBD5E1' : 'none',
                      }}
                    >
                      Mức độ: {severityVi}
                    </span>
                  </div>
                </div>

                <div style={{ fontWeight: 800, fontSize: '1.0625rem', color: isResolved ? '#15803D' : isUnknownOrNoAction ? '#334155' : '#B91C1C', marginBottom: '6px' }}>
                  {rootCauseTypeVi}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.75rem', color: '#64748B' }}>
                    Dự báo rủi ro:{' '}
                    <strong style={{ color: '#1D4ED8' }}>
                      {predictedRiskVi || (detectedRisksList.length > 0 ? 'Phát hiện nguy cơ' : (gruPrediction || incidentDetail?.prediction_id ? 'Không suy biến tài nguyên' : 'Chưa có dữ liệu dự báo'))}
                    </strong>
                  </span>
                  <span style={{ color: '#CBD5E1' }}>&bull;</span>
                  <span style={{ fontSize: '0.75rem', color: '#64748B' }}>
                    Độ tin cậy RCA: <strong style={{ color: '#047857' }}>{confidence !== null ? `${confidence}%` : 'Chưa đánh giá'}</strong>
                  </span>

                  <span style={{ fontSize: '0.75rem', color: '#64748B' }}>
                    &bull; Trạng thái:{' '}
                    <strong style={{ color: isResolved ? '#10B981' : isUnknownOrNoAction ? '#059669' : '#DC2626' }}>
                      {isResolved
                        ? 'ĐÃ KHẮC PHỤC'
                        : isCircuitBreakerTripped
                          ? 'NGẮT MẠCH AN TOÀN (CIRCUIT BREAKER)'
                          : isUnknownOrNoAction
                            ? 'AN TOÀN (KHÔNG CẦN CAN THIỆP)'
                            : requiresApproval
                              ? 'CHỜ PHÊ DUYỆT (HITL)'
                              : 'CHỜ KHẮC PHỤC'}
                    </strong>
                  </span>
                </div>
              </div>

              {/* ======================================================== */}
              <div
                style={{
                  padding: '16px 0',
                  borderBottom: '1px solid #E2E8F0',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', marginBottom: '6px' }}>
                  <div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#065F46', display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <Zap size={16} color="#059669" />
                      <span>KẾ HOẠCH TỰ KHẮC PHỤC: {recActionVi}</span>
                      <span style={{ color: '#CBD5E1', margin: '0 4px' }}>•</span>
                      <span style={{ fontSize: '0.75rem', color: '#B91C1C', fontWeight: 700 }}>
                        Ưu tiên: {actionPriorityVi}
                      </span>
                      <span style={{ color: '#CBD5E1', margin: '0 4px' }}>•</span>
                      <span style={{ fontSize: '0.75rem', color: '#1D4ED8', fontWeight: 700 }}>
                        Rủi ro: {actionRiskLevelVi}
                      </span>
                      {requiresApproval && (
                        <>
                          <span style={{ color: '#CBD5E1', margin: '0 4px' }}>•</span>
                          <span style={{ fontSize: '0.75rem', color: '#B45309', fontWeight: 700 }}>
                            Cần Kỹ sư duyệt (HITL)
                          </span>
                        </>
                      )}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#334155', marginTop: '2px', lineHeight: 1.35 }}>
                      {recReasonVi}
                    </div>
                  </div>

                  {recAction === 'NO_ACTION' ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <div
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '7px 12px',
                          backgroundColor: '#FEF2F2',
                          color: '#B91C1C',
                          borderRadius: '8px',
                          fontWeight: 700,
                          fontSize: '0.75rem',
                          border: '1px solid #FECACA',
                        }}
                      >
                        <ShieldAlert size={15} />
                        <span>Cầu Dao Đang Khóa ({consecutiveFailures} Lần Lỗi)</span>
                      </div>
                      {!isResolved && (
                        <button
                          type="button"
                          onClick={handleExecuteRemediation}
                          disabled={isExecuting}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '7px 14px',
                            backgroundColor: '#FFFFFF',
                            color: '#065F46',
                            border: '1px solid #059669',
                            borderRadius: '8px',
                            fontSize: '0.78125rem',
                            fontWeight: 700,
                            cursor: isExecuting ? 'not-allowed' : 'pointer',
                          }}
                        >
                          <Check size={14} />
                          <span>{isExecuting ? 'Đang lưu...' : 'Xác Nhận & Đóng Sự Cố'}</span>
                        </button>
                      )}
                    </div>
                  ) : !isResolved ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      {isApprovalContext && onResolve && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsExecuting(true);
                            setTimeout(() => {
                              setIsExecuting(false);
                              if (onResolve) onResolve(incident?.id, incident?.rawId);
                            }, 400);
                          }}
                          disabled={isExecuting}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '8px 16px',
                            background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                            color: '#FFFFFF',
                            borderRadius: '8px',
                            border: 'none',
                            fontSize: '0.78125rem',
                            fontWeight: 700,
                            cursor: isExecuting ? 'not-allowed' : 'pointer',
                            boxShadow: '0 2px 4px rgba(5, 150, 105, 0.2)',
                          }}
                        >
                          <CheckCircle2 size={14} />
                          <span>{isExecuting ? 'Đang gửi phê duyệt...' : 'Phê Duyệt Hành Động Ngay'}</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          if (isAlreadyInApprovals) {
                            onClose();
                          } else if (requiresApproval && onNavigate) {
                            onClose();
                            onNavigate(`/dashboard/self-healing/approvals?target=${encodeURIComponent(serviceDisplayName)}`);
                          } else {
                            handleExecuteRemediation();
                          }
                        }}
                        disabled={isExecuting}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '8px 16px',
                          background: isAlreadyInApprovals
                            ? '#F1F5F9'
                            : requiresApproval
                            ? 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)'
                            : 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                          color: isAlreadyInApprovals ? '#334155' : '#FFFFFF',
                          borderRadius: '8px',
                          border: isAlreadyInApprovals ? '1px solid #CBD5E1' : 'none',
                          fontSize: '0.78125rem',
                          fontWeight: 700,
                          cursor: isExecuting ? 'not-allowed' : 'pointer',
                        }}
                      >
                        {requiresApproval ? <CheckCircle2 size={14} /> : <Zap size={14} />}
                        <span>
                          {isExecuting
                            ? 'Đang thực thi...'
                            : isAlreadyInApprovals
                            ? (onResolve ? 'Đóng & Xem Danh Sách' : 'Đóng & Phê Duyệt Tại Danh Sách Phía Dưới')
                            : requiresApproval
                            ? 'Chuyển Sang Cổng Phê Duyệt (HITL) →'
                            : 'Kích Hoạt Tự Khắc Phục Ngay'}
                        </span>
                      </button>
                    </div>
                  ) : (
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 12px',
                        backgroundColor: '#DCFCE7',
                        color: '#15803D',
                        borderRadius: '8px',
                        fontWeight: 700,
                        fontSize: '0.75rem',
                        border: '1px solid #86EFAC',
                      }}
                    >
                      <CheckCircle2 size={15} />
                      <span>Đã Tự Khắc Phục Hoàn Tất</span>
                    </div>
                  )}
                </div>

                {/* BẢNG THAM SỐ KỸ THUẬT CHI TIẾT (ACTION PARAMETERS GRID) */}
                <div style={{ marginTop: '6px', borderTop: '1px solid #E2E8F0', paddingTop: '6px' }}>
                  <div style={{ fontSize: '0.6875rem', fontWeight: 800, color: '#1E40AF', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Sliders size={13} color="#2563EB" />
                    <span>THAM SỐ KỸ THUẬT ĐIỀU PHỐI (ACTION PARAMETERS):</span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '8px' }}>
                    <div style={{ padding: '4px 8px', backgroundColor: '#F8FAFC', borderRadius: '6px', border: '1px solid #E2E8F0' }}>
                      <div style={{ fontSize: '0.625rem', color: '#64748B', fontWeight: 600 }}>
                        {realPodName ? 'POD MỤC TIÊU (TARGET POD)' : 'WORKLOAD MỤC TIÊU'}
                      </div>
                      <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#0F172A', wordBreak: 'break-all' }}>
                        {faultyPodName}
                      </div>
                      <div style={{ fontSize: '0.625rem', color: '#94A3B8', marginTop: '2px' }}>
                        {realPodName ? `${workloadKindRaw}: ${serviceDisplayName}` : `Loại workload: ${workloadKindRaw}`}
                        {faultyPodId ? ` • ID: ${String(faultyPodId).substring(0, 18)}...` : ''}
                      </div>
                    </div>

                    <div style={{ padding: '4px 8px', backgroundColor: '#F8FAFC', borderRadius: '6px', border: '1px solid #E2E8F0' }}>
                      <div style={{ fontSize: '0.625rem', color: '#64748B', fontWeight: 600 }}>NODE &amp; VAI TRÒ REPLICA SET</div>
                      <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <span>{faultyNodeName || 'Chưa xác định'}</span>
                        <span style={{ fontSize: '0.6875rem', color: '#64748B', fontWeight: 500 }}>({replicaSetRole})</span>
                      </div>
                      <div style={{ fontSize: '0.625rem', color: faultyNodeName ? '#166534' : '#94A3B8', marginTop: '2px', fontWeight: 600 }}>
                        {faultyNodeName ? `Node: ${faultyNodeName}` : 'Chưa gắn với Node cụ thể'}
                      </div>
                    </div>

                    {(() => {
                      const hasFailover = recDestNodeName && recDestNodeName !== faultyNodeName && !recDestNodeName.includes('nkljojl');
                      const nodeSummaryTitle = clusterNodeCount === 1
                        ? 'Không có (Đơn node)'
                        : clusterNodeCount > 1
                          ? 'Chưa chỉ định'
                          : 'Chưa xác định';
                      const clusterSubLabel = clusterNodeCount === 1
                        ? 'Cụm hiện có 1 Node'
                        : clusterNodeCount > 1
                          ? `Cụm hiện có ${clusterNodeCount} Node`
                          : `Cụm: ${clusterIdStr}`;
                      return (
                        <div style={{ padding: '4px 8px', backgroundColor: '#F8FAFC', borderRadius: '6px', border: '1px solid #E2E8F0' }}>
                          <div style={{ fontSize: '0.625rem', color: '#64748B', fontWeight: 600 }}>NODE AN TOÀN DỰ PHÒNG</div>
                          <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: hasFailover ? '#059669' : '#64748B' }}>
                            {hasFailover ? recDestNodeName : nodeSummaryTitle}
                          </div>
                          <div style={{ fontSize: '0.625rem', color: hasFailover ? '#166534' : '#94A3B8', marginTop: '2px' }}>
                            {hasFailover ? (
                              destFreeMemBytes > 0
                                ? <>RAM trống: <strong>{(destFreeMemBytes / 1024 / 1024 / 1024).toFixed(2)} GB</strong></>
                                : clusterSubLabel
                            ) : (
                              clusterSubLabel
                            )}
                          </div>
                        </div>
                      );
                    })()}

                    <div style={{ padding: '8px 10px', backgroundColor: isCircuitBreakerTripped ? '#FEF2F2' : '#F8FAFC', borderRadius: '6px', border: isCircuitBreakerTripped ? '1px solid #FECACA' : '1px solid #E2E8F0' }}>
                      <div style={{ fontSize: '0.625rem', color: isCircuitBreakerTripped ? '#991B1B' : '#64748B', fontWeight: 700 }}>ANTI-LOOP (CIRCUIT BREAKER)</div>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: isCircuitBreakerTripped ? '#DC2626' : '#059669' }}>
                        {isCircuitBreakerTripped ? (blockedActions.length > 0 ? `Đang khóa: ${blockedActions.join(', ')}` : 'Đang khóa (Ngắt mạch an toàn)') : 'Trạng thái: Hoạt động bình thường'}
                      </div>
                      <div style={{ fontSize: '0.625rem', color: isCircuitBreakerTripped ? '#B91C1C' : '#64748B', marginTop: '2px' }}>
                        Đã thất bại: <strong>{consecutiveFailures} lần liên tiếp</strong>
                      </div>
                    </div>
                  </div>
                </div>

                {/* MANUAL PLAYBOOK DÀNH CHO KỸ SƯ SRE / DBA */}
                <div style={{ marginTop: '12px', borderTop: '1px solid #E2E8F0', paddingTop: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#065F46', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      <BookOpen size={13} color="#059669" />
                      <span>CẨM NANG THAO TÁC KỸ SƯ (MANUAL PLAYBOOK):</span>
                      <span
                        style={{
                          fontSize: '0.625rem',
                          fontWeight: 700,
                          padding: '1px 6px',
                          borderRadius: '4px',
                          backgroundColor: isAiPlaybook ? '#DCFCE7' : '#EFF6FF',
                          color: isAiPlaybook ? '#15803D' : '#1D4ED8',
                          border: isAiPlaybook ? '1px solid #BBF7D0' : '1px solid #BFDBFE',
                        }}
                      >
                        {isAiPlaybook ? 'Từ AI Playbook' : 'Tự sinh theo ngữ cảnh RCA'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopyText(manualPlaybookSteps.join('\n'), 'playbook')}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '3px 8px',
                        fontSize: '0.6875rem',
                        fontWeight: 600,
                        backgroundColor: '#F1F5F9',
                        border: '1px solid #CBD5E1',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        color: '#334155',
                      }}
                    >
                      {copiedKey === 'playbook' ? <Check size={12} color="#10B981" /> : <Copy size={12} />}
                      <span>{copiedKey === 'playbook' ? 'Đã chép Playbook' : 'Sao chép 3 bước'}</span>
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {manualPlaybookSteps.map((step, idx) => (
                      <div
                        key={idx}
                        style={{
                          padding: '8px 12px',
                          backgroundColor: '#F0FDF4',
                          border: '1px solid #BBF7D0',
                          borderRadius: '6px',
                          fontSize: '0.75rem',
                          color: '#166534',
                          lineHeight: 1.45,
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '6px',
                        }}
                      >
                        <ChevronRight size={14} color="#059669" style={{ flexShrink: 0, marginTop: '2px' }} />
                        <span>{step}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* ======================================================== */}
              {/* 6. GIẢI TRÌNH CHI TIẾT DÀNH CHO BÁO CÁO INCIDENT */}
              {/* ======================================================== */}
              <div
                style={{
                  padding: '16px 0',
                  borderBottom: '1px solid #E2E8F0',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div style={{ fontSize: '0.78125rem', fontWeight: 800, color: '#065F46', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <FileText size={15} color="#059669" />
                    <span>BÁO CÁO GIẢI TRÌNH SRE (SRE INCIDENT REPORT)</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopyText(fullExplanationVi, 'explanation')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '3px 8px',
                      fontSize: '0.6875rem',
                      fontWeight: 600,
                      backgroundColor: '#FFFFFF',
                      border: '1px solid #CBD5E1',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      color: '#334155',
                    }}
                  >
                    {copiedKey === 'explanation' ? <Check size={12} color="#10B981" /> : <Copy size={12} />}
                    <span>{copiedKey === 'explanation' ? 'Đã sao chép' : 'Sao chép giải trình'}</span>
                  </button>
                </div>
                <div
                  style={{
                    backgroundColor: '#FFFFFF',
                    padding: '12px 14px',
                    borderRadius: '8px',
                    border: '1px solid #E2E8F0',
                    fontSize: '0.8125rem',
                    color: '#334155',
                    lineHeight: 1.6,
                    whiteSpace: 'pre-line',
                  }}
                >
                  {fullExplanationVi}
                </div>
              </div>

              {/* ======================================================== */}
              {/* 5. ĐỀ XUẤT HÀNH ĐỘNG & THAM SỐ KỸ THUẬT CỤ THỂ */}
              {/* ======================================================== */}
              <div
                style={{
                  padding: '14px 0',
                  borderBottom: '1px solid #E2E8F0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '10px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <History size={16} color="#6366F1" />
                  <div>
                    <div style={{ fontSize: '0.78125rem', fontWeight: 800, color: '#334155' }}>
                      ĐỐI CHIẾU TRI THỨC LỊCH SỬ (KNOWLEDGE BASE RETRIEVAL)
                    </div>
                    <div style={{ fontSize: '0.6875rem', color: '#64748B' }}>
                      Đối soát sự cố tương đồng từ vector database: <strong style={{ color: historicalContextUsed ? '#059669' : '#64748B' }}>{historicalContextUsed ? 'KÍCH HOẠT (ACTIVE)' : 'KHÔNG (Chẩn đoán độc lập từ tín hiệu trực tiếp)'}</strong>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.6875rem', color: '#64748B', fontWeight: 600 }}>Sự cố đối chiếu:</span>
                  {similarIncidentIds && similarIncidentIds.length > 0 ? (
                    similarIncidentIds.map((simId, idx) => (
                      <span
                        key={idx}
                        style={{
                          padding: '2px 6px',
                          backgroundColor: '#EEF2FF',
                          color: '#4F46E5',
                          border: '1px solid #C7D2FE',
                          borderRadius: '4px',
                          fontSize: '0.65rem',
                          fontWeight: 700,
                        }}
                      >
                        {simId}
                      </span>
                    ))
                  ) : (
                    <span style={{ fontSize: '0.6875rem', color: '#94A3B8', fontStyle: 'italic' }}>
                      Không có tiền lệ tương tự (Sự cố mới xuất hiện)
                    </span>
                  )}
                </div>
              </div>

            </>
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
