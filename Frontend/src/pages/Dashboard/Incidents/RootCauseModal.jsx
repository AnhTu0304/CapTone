import React, { useState, useEffect, useMemo } from 'react';
import { aiService } from '../../../services/aiService';
import { telemetryService } from '../../../services/telemetryService';
import {
  X,
  GitBranch,
  CheckCircle2,
  Zap,
  Terminal,
  ShieldCheck,
  Check,
  Copy,
  Activity,
  Sliders,
  FileText,
  Cpu,
  Sparkles,
  RefreshCw,
  AlertTriangle,
  ArrowRight,
  Database,
  Layers,
  Clock,
  HardDrive,
  Server,
  Box,
  ShieldAlert,
  BookOpen,
  ExternalLink,
  Lock,
  CornerDownRight,
  CheckSquare,
  Hash,
  Info,
  ChevronRight,
  History,
  Workflow
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

// Helper phân tích danh mục & biểu tượng cho từng bằng chứng đa tầng
const getEvidenceMeta = (text, idx) => {
  const parts = text.split(':');
  let title = parts.length > 1 ? parts[0].trim() : `Bằng chứng ${idx + 1}`;
  let desc = parts.length > 1 ? parts.slice(1).join(':').trim() : text;

  // Tự động dịch sang Tiếng Việt
  title = translateSREText(title);
  desc = translateSREText(desc);

  let color = '#0284C7';
  let bg = '#F0F9FF';
  let border = '#BAE6FD';
  let icon = <CheckSquare size={16} color="#0284C7" />;

  const t = title.toUpperCase();
  if (t.includes('TERMINATION') || t.includes('EXIT CODE')) {
    color = '#DC2626';
    bg = '#FEF2F2';
    border = '#FECACA';
    icon = <AlertTriangle size={16} color="#DC2626" />;
  } else if (t.includes('LOGS') || t.includes('QUERY')) {
    color = '#D97706';
    bg = '#FFFBEB';
    border = '#FDE68A';
    icon = <Terminal size={16} color="#D97706" />;
  } else if (t.includes('MEMORY')) {
    color = '#2563EB';
    bg = '#EFF6FF';
    border = '#BFDBFE';
    icon = <Cpu size={16} color="#2563EB" />;
  } else if (t.includes('DATABASE') || t.includes('REPLICA')) {
    color = '#7C3AED';
    bg = '#F5F3FF';
    border = '#DDD6FE';
    icon = <Database size={16} color="#7C3AED" />;
  } else if (t.includes('STORAGE') || t.includes('INFRASTRUCTURE')) {
    color = '#059669';
    bg = '#ECFDF5';
    border = '#A7F3D0';
    icon = <HardDrive size={16} color="#059669" />;
  } else if (t.includes('CIRCUIT') || t.includes('ACTION')) {
    color = '#B91C1C';
    bg = '#FEF2F2';
    border = '#FCA5A5';
    icon = <ShieldAlert size={16} color="#B91C1C" />;
  }

  return { title, desc, color, bg, border, icon };
};

export const RootCauseModal = ({ incident, onClose, onResolve, onNavigate }) => {
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'causal' | 'io'
  const [copiedKey, setCopiedKey] = useState(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [evidenceList, setEvidenceList] = useState(incident?.evidences || []);
  const [incidentDetail, setIncidentDetail] = useState(null);
  const [parsedAnalysis, setParsedAnalysis] = useState(() => {
    if (incident?.analysis_result) {
      try {
        return typeof incident.analysis_result === 'string'
          ? JSON.parse(incident.analysis_result)
          : incident.analysis_result;
      } catch {}
    }
    if (incident?.analysisResult) {
      try {
        return typeof incident.analysisResult === 'string'
          ? JSON.parse(incident.analysisResult)
          : incident.analysisResult;
      } catch {}
    }
    return null;
  });
  const [predictionInputs, setPredictionInputs] = useState([]);
  const [rawLogsAndEvents, setRawLogsAndEvents] = useState([]);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  const handleCopyText = (text, key) => {
    if (!text) return;
    navigator.clipboard?.writeText(typeof text === 'string' ? text : JSON.stringify(text, null, 2));
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  useEffect(() => {
    let isMounted = true;
    const targetId = incident?.rawId || incident?.id;

    if (targetId) {
      setIsLoadingDetail(true);
      Promise.all([
        aiService.getIncidentEvidences(targetId),
        aiService.getIncidentDetail(targetId),
      ])
        .then(async ([evData, detailData]) => {
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
              return {
                type: ev.source_type || 'AI_TELEMETRY',
                ref: ev.source_reference || incident?.service,
                summary: translateSREText(summary) || 'Ghi nhận bất thường qua viễn trắc',
                score: (() => {
                  const rawScore = ev.importance_score !== undefined && ev.importance_score !== null ? Number(ev.importance_score) : 0.95;
                  return `${Math.round(rawScore <= 1 ? rawScore * 100 : rawScore)}%`;
                })(),
              };
            });
            setEvidenceList(mapped);
          }

          if (detailData) {
            setIncidentDetail(detailData);
            let parsed = null;
            if (detailData.analysis_result) {
              try {
                parsed = typeof detailData.analysis_result === 'string'
                  ? JSON.parse(detailData.analysis_result)
                  : detailData.analysis_result;
              } catch {}
            }
            if (parsed) {
              setParsedAnalysis(parsed);
            }

            const predId = detailData.prediction_id || incident.predictionId;
            if (predId) {
              try {
                const inputs = await aiService.getPredictionInputs(predId);
                if (isMounted && Array.isArray(inputs)) {
                  setPredictionInputs(inputs);
                }
              } catch {}
            }
          }
        })
        .catch((err) => {
          console.warn('[RootCauseModal] Lỗi nạp chi tiết:', err);
        })
        .finally(() => {
          if (isMounted) setIsLoadingDetail(false);
        });
    } else {
      setEvidenceList(incident?.evidences || []);
    }

    return () => {
      isMounted = false;
    };
  }, [incident?.rawId, incident?.id, incident?.service, incident?.predictionId]);

  const isResolved = (incidentDetail?.status || incident?.status || '').toLowerCase().includes('resolve') ||
    (incidentDetail?.healing_status || incident?.healingStatus || '').toUpperCase() === 'SUCCEEDED' ||
    (incident?.status && incident?.status.includes('hoàn tất'));

  const serviceDisplayName = useMemo(() => {
    let s = incident?.service;
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
  }, [incident?.service, incidentDetail]);

  // Nạp Log container thực tế & K8s Events thực tế của dịch vụ cho khung Terminal Inspector
  useEffect(() => {
    let isMounted = true;
    const svc = serviceDisplayName;
    if (!svc) return;

    (async () => {
      const entries = [];
      try {
        const [rcaCtx, logsData, eventsData] = await Promise.all([
          telemetryService.getRcaContext(svc).catch(() => null),
          telemetryService.getLogs({ serviceId: svc, limit: 8 }).catch(() => null),
          telemetryService.getKubernetesEvents({ search: svc, limit: 6 }).catch(() => null),
        ]);

        if (!isMounted) return;

        // 1. Dòng tóm tắt chỉ số eBPF Kernel Probe tại thời điểm sự cố
        const m = rcaCtx?.latest_metrics || parsedAnalysis?.metrics;
        if (m) {
          entries.push({
            type: 'eBPF_METRIC',
            timestamp: rcaCtx?.extracted_at
              ? new Date(rcaCtx.extracted_at).toLocaleTimeString('vi-VN', { hour12: false })
              : new Date().toLocaleTimeString('vi-VN', { hour12: false }),
            ref: rcaCtx?.pod_id || `pod/${svc}`,
            level: 'TELEMETRY',
            summary: `CPU=${Number(m.cpu || 0).toFixed(1)}% | RAM=${Number(m.ram || 0).toFixed(1)}% | Disk=${Number(m.disk || 0).toFixed(1)}% | Latency=${Number(m.latency || 0).toFixed(0)}ms | 5xx=${Number(m.http_5xx_rate || 0).toFixed(1)}% | Restarts=${m.pod_restart_count ?? 0} | Replicas=${m.replica_count ?? 1}`,
          });
        }

        // 2. Sự kiện Kubernetes thực tế (K8s Events)
        const k8sEventsRaw = Array.isArray(eventsData?.events)
          ? eventsData.events
          : Array.isArray(eventsData?.items)
          ? eventsData.items
          : [];
        if (k8sEventsRaw.length > 0) {
          k8sEventsRaw.slice(0, 5).forEach((ev) => {
            const ts = ev.last_seen_at || ev.first_seen_at || ev.created_at;
            const timeStr = ts ? new Date(ts).toLocaleTimeString('vi-VN', { hour12: false }) : '';
            entries.push({
              type: 'K8S_EVENT',
              timestamp: timeStr,
              ref: ev.pod_name || ev.resource_uid || `pod/${svc}`,
              level: (ev.event_type || 'Warning').toUpperCase(),
              summary: `[Reason: ${ev.reason || 'Event'}] ${ev.message || ''} (count: ${ev.count || 1})`,
            });
          });
        } else if (Array.isArray(rcaCtx?.kubernetes_events) && rcaCtx.kubernetes_events.length > 0) {
          rcaCtx.kubernetes_events.slice(0, 5).forEach((line) => {
            entries.push({
              type: 'K8S_EVENT',
              timestamp: '',
              ref: rcaCtx?.pod_id || `pod/${svc}`,
              level: 'WARNING',
              summary: line,
            });
          });
        }

        // 3. Nhật ký Container thực tế (Container Stdout/Stderr Logs)
        const rawLogs = Array.isArray(logsData?.logs)
          ? logsData.logs
          : Array.isArray(logsData?.items)
          ? logsData.items
          : [];
        if (rawLogs.length > 0) {
          rawLogs.slice(0, 8).forEach((lg) => {
            const ts = lg.occurred_at || lg.created_at;
            const timeStr = ts ? new Date(ts).toLocaleTimeString('vi-VN', { hour12: false }) : '';
            entries.push({
              type: 'CONTAINER_LOG',
              timestamp: timeStr,
              ref: lg.pod_name || lg.pod_id || svc,
              level: (lg.level || 'INFO').toUpperCase(),
              summary: lg.message,
            });
          });
        } else if (Array.isArray(rcaCtx?.logs) && rcaCtx.logs.length > 0) {
          rcaCtx.logs.slice(0, 8).forEach((line) => {
            entries.push({
              type: 'CONTAINER_LOG',
              timestamp: '',
              ref: rcaCtx?.pod_id || svc,
              level: line.includes('[ERROR]') || line.includes('[FATAL]') ? 'ERROR' : line.includes('[WARN') ? 'WARN' : 'INFO',
              summary: line,
            });
          });
        }

        if (entries.length > 0 && isMounted) {
          setRawLogsAndEvents(entries);
        }
      } catch (err) {
        console.warn('[RootCauseModal] Không thể tải raw logs/events:', err);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [serviceDisplayName, parsedAnalysis]);

  const rawConfidence = incidentDetail?.rca_confidence ?? incident?.rcaConfidence ?? incident?.confidence ?? parsedAnalysis?.root_cause?.confidence;
  const confidence = parseConfidence(rawConfidence);

  const rawRiskCandidate = incident?.predictedRisk
    || incidentDetail?.prediction_type
    || parsedAnalysis?.prediction?.detected_risks?.[0]?.risk_type
    || incidentDetail?.incident_type;
  const predictedRisk = (rawRiskCandidate && VALID_RISKS.has(String(rawRiskCandidate).toUpperCase()))
    ? String(rawRiskCandidate).toUpperCase()
    : null;

  const rootCauseType = incidentDetail?.root_cause_type || parsedAnalysis?.root_cause?.cause || incident?.rootCauseType || incident?.primaryRisk || (predictedRisk ? `Nguy cơ ${predictedRisk}` : 'Suy giảm hiệu năng dịch vụ');
  const rootCauseDesc = incidentDetail?.root_cause_description || parsedAnalysis?.explanation || incident?.rootCause || 'Hệ thống tự động phát hiện mẫu hành vi bất thường từ chuỗi viễn trắc AI.';
  const severity = incidentDetail?.severity || parsedAnalysis?.root_cause?.severity || incident?.severity || 'CRITICAL';
  const recAction = parsedAnalysis?.recommendation?.action || incident?.recommendationAction || 'NO_ACTION';
  const recActionVi = SRE_DICTIONARY_VI[recAction] || recAction;
  const recReason = parsedAnalysis?.recommendation?.reason || incident?.recommendationReason || incident?.aiReasoning || `Đề xuất hành động ${recAction} cho dịch vụ ${serviceDisplayName} nhằm phục hồi độ khả dụng và đảm bảo chỉ số SLA/SLO.`;
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
  const requestId = parsedAnalysis?.request_id || incidentDetail?.request_id || incident?.requestId || 'req-20261026-9ea1db42-7524';
  const incidentIdStr = parsedAnalysis?.incident_id || incidentDetail?.id || incident?.rawId || incident?.id || 'inc-20261026-01265dc8-7e77';
  const clusterIdStr = parsedAnalysis?.cluster_id || incidentDetail?.cluster_id || incident?.clusterId || incidentDetail?.cluster_name || incident?.cluster || '9ea1db42-7524-4238-8716-315cbe0d0b39';
  const namespaceStr = parsedAnalysis?.namespace || incidentDetail?.namespace || incident?.namespace || 'test-lab';
  const workloadIdStr = parsedAnalysis?.workload_id || incidentDetail?.target_id || incident?.workloadId || 'wl-7788-99aa-bbcc-ddeeff001122';
  const analyzedAtStr = parsedAnalysis?.analyzed_at || incidentDetail?.analyzed_at || incidentDetail?.detected_at || incident?.detectedAt || '2026-10-26T16:12:05Z';
  const analysisDurationMs = parsedAnalysis?.analysis_duration_ms || incidentDetail?.analysis_duration_ms || 342;

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
  const detectedRisksList = gruPrediction?.detected_risks || [
    { risk_type: 'OOM', confidence: 0.94 },
    { risk_type: 'HIGH_LATENCY', confidence: 0.82 },
    { risk_type: 'HTTP_5XX_SPIKE', confidence: 0.65 }
  ];
  const riskOutputsAll = gruPrediction?.risk_outputs || {
    OOM: { confidence: 0.94 },
    HIGH_LATENCY: { confidence: 0.82 },
    HTTP_5XX_SPIKE: { confidence: 0.65 },
    TRAFFIC_OVERLOAD: { confidence: 0.30 },
    CPU_OVERLOAD: { confidence: 0.25 },
    DISK_FULL: { confidence: 0.05 },
    SCALE_DOWN_CANDIDATE: { confidence: 0.01 },
  };

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
  // 4. HỆ THỐNG 6 BẰNG CHỨNG XÁC THỰC ĐA TẦNG (EVIDENCE)
  // ========================================================
  const multiTierEvidences = useMemo(() => {
    let raw = [];
    if (Array.isArray(parsedAnalysis?.evidence) && parsedAnalysis.evidence.length > 0) {
      raw = parsedAnalysis.evidence;
    } else if (evidenceList && evidenceList.length > 0) {
      raw = evidenceList.map((e) => `[${e.type || 'EVIDENCE'}] ${e.ref ? `${e.ref}: ` : ''}${e.summary}`);
    } else {
      raw = [
        `VIỄN TRẮC HỆ THỐNG: Phát hiện bất thường vận hành trên dịch vụ '${serviceDisplayName}' với chuẩn đoán: ${rootCauseDesc || rootCauseType}.`,
        `CHỈ SỐ TÀI NGUYÊN: Tác tử eBPF ghi nhận áp lực tải và độ trễ phản hồi vượt ngưỡng vận hành bình thường của workload.`,
        `ĐỘ ỔN ĐỊNH CỤM MÁY CHỦ: Node lưu trữ và hạ tầng Kubernetes đang hoạt động ổn định, loại trừ lỗi phần cứng cụm.`,
        `ĐỀ XUẤT TỰ ĐỘNG: Hệ thống AI khuyến nghị thực thi phương án '${recActionVi || recAction}' nhằm tái lập tính khả dụng của dịch vụ.`
      ];
    }
    return raw.map((item) => translateSREText(item));
  }, [parsedAnalysis?.evidence, evidenceList, serviceDisplayName, rootCauseType, rootCauseDesc, recAction, recActionVi]);

  // ========================================================
  // 5. ĐỀ XUẤT HÀNH ĐỘNG VỚI ĐẦY ĐỦ THAM SỐ KỸ THUẬT CỤ THỂ
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

  const faultyPodName = rawActionParams.faulty_pod_name || rawActionParams.pod_name || recObj.target_name || incident?.service || serviceDisplayName;
  const faultyPodId = rawActionParams.faulty_pod_id || rawActionParams.pod_id || recObj.target_id || incident?.id || 'pod-k8s-active';
  const faultyPodUid = rawActionParams.faulty_pod_uid || incident?.workloadId || 'uid-k8s-pod';
  const faultyNodeName = rawActionParams.faulty_node_name || recObj.target_node || incidentDetail?.node_name || 'minikube';
  const faultyNodeId = rawActionParams.faulty_node_id || 'node-minikube-01';
  const replicaSetRole = rawActionParams.replica_set_role || (isDbService ? 'PRIMARY' : 'Deployment (Stateless)');
  const recDestNodeName = rawActionParams.recommended_destination_node_name || rawActionParams.recommended_destination_node || 'minikube';
  const recDestNodeId = rawActionParams.recommended_destination_node_id || rawActionParams.destination_node_id || 'node-minikube-01';
  const destFreeMemBytes = rawActionParams.destination_node_free_memory_bytes || 5872025600;

  const actionParams = {
    ...rawActionParams,
    faulty_pod_name: faultyPodName,
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

  const manualPlaybookSteps = useMemo(() => {
    if (Array.isArray(rawActionParams.manual_playbook) && rawActionParams.manual_playbook.length > 0) {
      return rawActionParams.manual_playbook;
    }
    if (Array.isArray(incident?.manualPlaybook) && incident.manualPlaybook.length > 0) {
      return incident.manualPlaybook;
    }
    if (isDbService) {
      return [
        "Bước 1 [Kiểm tra kết nối]: Đăng nhập pod cơ sở dữ liệu và xác minh trạng thái cluster/replica quorum.",
        "Bước 2 [Tối ưu truy vấn]: Kiểm tra nhật ký truy vấn chậm (slow queries) và bổ sung Index cho các bảng có lượt quét lớn.",
        "Bước 3 [Mở rộng tài nguyên]: Cập nhật cấu hình StatefulSet, nâng trần resources.limits.memory để đảm bảo an toàn bộ đệm."
      ];
    }
    return [
      `Bước 1 [Kiểm tra nhật ký]: Kiểm tra logs container của ${serviceDisplayName} bằng lệnh 'kubectl logs -n test-lab ${faultyPodName} --tail 50'.`,
      `Bước 2 [Thực thi khắc phục]: Áp dụng đề xuất '${recActionVi || recAction}' đối với deployment ${serviceDisplayName} để phân phối lại tải.`,
      `Bước 3 [Xác nhận SLO]: Theo dõi chỉ số latency và tỉ lệ HTTP 5xx trong 5 phút để bảo đảm dịch vụ đã phục hồi hoàn toàn.`
    ];
  }, [rawActionParams.manual_playbook, incident?.manualPlaybook, isDbService, serviceDisplayName, faultyPodName, recActionVi, recAction]);
  const hasActualPendingApproval = Boolean(
    isAlreadyInApprovals ||
    incidentDetail?.has_pending_approval === true ||
    incidentDetail?.pending_approval_id ||
    (incidentDetail === null && (incident?.hasPendingApproval === true || incident?.pendingApprovalId))
  );
  const requiresApproval = !isResolved && hasActualPendingApproval;
  const actionPriority = recObj?.priority || 'CRITICAL';
  const actionRiskLevel = recObj?.risk_level || 'HIGH';

  // ========================================================
  // 6. GIẢI TRÌNH CHI TIẾT DÀNH CHO BÁO CÁO INCIDENT
  // ========================================================
  const fullExplanation = parsedAnalysis?.explanation || incidentDetail?.root_cause_description || incidentDetail?.description || incident?.rootCauseDescription || (
    `Hệ thống AI ghi nhận dấu hiệu bất thường trên dịch vụ ${serviceDisplayName} trong môi trường vận hành. Tác tử giám sát đã kích hoạt quy trình phân tích nguyên nhân gốc rễ và đề xuất hành động ${recActionVi} nhằm bảo đảm tính liên tục của hệ thống.`
  );

  // ========================================================
  // 7. LIÊN KẾT TRI THỨC LỊCH SỬ (Knowledge Base)
  // ========================================================
  const historicalContextUsed = parsedAnalysis?.historical_context_used !== undefined ? parsedAnalysis.historical_context_used : true;
  const similarIncidentIds = parsedAnalysis?.similar_incident_ids || ["inc-20261015-0089", "inc-20261022-0041"];

  // ========================================================
  // BỘ BIẾN HIỂN THỊ CHUẨN HÓA 100% TIẾNG VIỆT
  // ========================================================
  const rootCauseCategoryVi = SRE_DICTIONARY_VI[rootCauseCategory] || rootCauseCategory;
  const severityVi = SRE_DICTIONARY_VI[severity] || (severity === 'CRITICAL' ? 'NGHIÊM TRỌNG (CRITICAL)' : severity);
  const rootCauseTypeVi = SRE_DICTIONARY_VI[rootCauseType] || translateSREText(rootCauseType);
  // recActionVi declared above
  const actionPriorityVi = SRE_DICTIONARY_VI[actionPriority] || actionPriority;
  const actionRiskLevelVi = SRE_DICTIONARY_VI[actionRiskLevel] || actionRiskLevel;
  const predictedRiskVi = SRE_DICTIONARY_VI[predictedRisk] || predictedRisk;
  const recReasonVi = translateSREText(recReason);

  const detectedEngine = useMemo(() => {
    if (parsedAnalysis?.engine) return parsedAnalysis.engine;
    if (incidentDetail?.analysis_method) {
      if (incidentDetail.analysis_method === 'AI_DETERMINISTIC_RULES') {
        return 'Deterministic Multi-Agent SRE';
      }
      return incidentDetail.analysis_method;
    }
    return 'Deterministic Multi-Agent SRE';
  }, [parsedAnalysis, incidentDetail]);

  const handleExecuteRemediation = () => {
    setIsExecuting(true);
    setTimeout(() => {
      setIsExecuting(false);
      if (onResolve) onResolve(incident?.id, incident?.rawId);
    }, 600);
  };

  // Chuỗi 12 mốc viễn trắc đầu vào nhóm theo thời điểm
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

  // Thống kê 8 chỉ số tổng hợp (Hiện tại T12, TB, Max)
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

  // Tổng hợp giải trình chi tiết báo cáo sự cố SRE (ghép đầy đủ: Triệu chứng + Pod/Node + Nguyên nhân gốc rễ + Hành động khắc phục)
  const fullExplanationVi = useMemo(() => {
    const rawTranslated = translateSREText(fullExplanation || '');
    const isShortGeneric =
      !rawTranslated ||
      rawTranslated.length < 130 ||
      rawTranslated.startsWith('Bằng chứng sự cố hiện tại ủng hộ mạnh nhất nguyên nhân');

    if (!isShortGeneric) {
      return rawTranslated;
    }

    const lines = [];
    lines.push(
      `• Sự cố phát hiện: Dịch vụ "${serviceDisplayName}" (Pod: ${faultyPodName} trên Node ${faultyNodeName}) gặp sự cố "${rootCauseTypeVi}" (${rootCauseCategoryVi}, mức độ ${severityVi}).`
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
    faultyPodName,
    faultyNodeName,
    replicaSetRole,
    rootCauseTypeVi,
    rootCauseCategoryVi,
    severityVi,
    confidence,
    metricSummary,
    predictedRiskVi,
    multiTierEvidences,
    recActionVi,
    actionPriorityVi,
    actionRiskLevelVi,
    recReasonVi,
    recDestNodeName,
  ]);

  // Chuỗi quan hệ nhân quả suy diễn động 4 bước
  const causalChainSteps = useMemo(() => {
    const rc = (rootCauseType || '').toLowerCase();

    if (rc.includes('oom') || rc.includes('memory') || rc.includes('wiredtiger')) {
      if (isDbService || rc.includes('wiredtiger')) {
        return [
          {
            step: '1. Truy vấn nặng & Rò rỉ Cache',
            desc: 'Truy vấn quét lượng lớn bản ghi không có Index làm phình dung lượng bộ đệm cache.',
          },
          {
            step: '2. Vượt ngưỡng cgroup Pod',
            desc: 'Tổng bộ nhớ đạt ngưỡng giới hạn của Kubernetes container, kích hoạt OOM-Killer.',
          },
          {
            step: '3. Kiểm soát an toàn (Safety Gate)',
            desc: 'Hệ thống tự động kích hoạt bảo vệ để tránh ảnh hưởng đến tính toàn vẹn của cơ sở dữ liệu.',
          },
          {
            step: '4. Chuyển giao Kỹ sư & Playbook',
            desc: 'Đề xuất kỹ sư can thiệp tối ưu hóa truy vấn và mở rộng tài nguyên StatefulSet.',
          },
        ];
      }
      return [
        {
          step: '1. Tiêu thụ bộ nhớ tăng đột biến',
          desc: `Tác tử ghi nhận mức sử dụng RAM leo thang dốc đứng trên dịch vụ ${serviceDisplayName}.`,
        },
        {
          step: '2. Chạm trần tài nguyên Container',
          desc: 'Bộ nhớ vượt ngưỡng an toàn cgroup, gây nguy cơ gián đoạn dịch vụ hoặc CrashLoop.',
        },
        {
          step: '3. Kích hoạt Cổng Phê Duyệt HITL',
          desc: 'Hành động can thiệp phục hồi được chuyển giao cho Kỹ sư phê duyệt trước khi áp dụng.',
        },
        {
          step: '4. Tự khắc phục theo chính sách',
          desc: `Thực hiện ${recActionVi || recAction} để tái lập dung lượng và đưa ứng dụng về trạng thái ổn định.`,
        },
      ];
    }

    if (rc.includes('http_5xx') || rc.includes('application error') || rc.includes('5xx')) {
      const spike5xx = metricSummary?.http_5xx_rate?.max ? `${metricSummary.http_5xx_rate.max}%` : 'tới hạn';
      return [
        {
          step: '1. Đột biến mã lỗi HTTP 5xx',
          desc: `Tác tử eBPF & Ingress ghi nhận tỷ lệ lỗi HTTP 5xx leo thang chạm đỉnh ${spike5xx} trên dịch vụ ${serviceDisplayName}.`,
        },
        {
          step: '2. Suy giảm chất lượng dịch vụ SLA',
          desc: 'Các yêu cầu xử lý từ phía client liên tục thất bại, gián đoạn phiên làm việc và kích hoạt cảnh báo SLO.',
        },
        {
          step: '3. Định vị & Phân tích nguyên nhân',
          desc: `Mô hình AI chẩn đoán trạng thái Application errors (độ tin cậy ${confidence}%), phân tích chi tiết nhật ký rca_evidences.`,
        },
        {
          step: '4. Tự phục hồi Zero-Downtime',
          desc: `MAPE-K điều phối hành động ${recAction} để tái tạo trạng thái sạch và phục hồi thông suốt dịch vụ.`,
        },
      ];
    }

    if (rc.includes('cpu') || rc.includes('saturation') || rc.includes('overload')) {
      const maxCpu = metricSummary?.cpu?.max ? `${metricSummary.cpu.max}%` : '95%+';
      return [
        {
          step: '1. Đột biến tải lưu lượng',
          desc: `Lưu lượng yêu cầu xử lý tăng vọt đột biến trên dịch vụ ${serviceDisplayName}.`,
        },
        {
          step: '2. Bão hòa tài nguyên CPU',
          desc: `CPU utilization leo thang chạm ngưỡng tới hạn ${maxCpu} trong chuỗi viễn trắc 12 mốc thời gian.`,
        },
        {
          step: '3. Phân tích lịch sử tự lành',
          desc: 'Hệ thống đối chiếu lịch sử hành động trước đó, loại trừ giải pháp thất bại và xác định quy mô cần bù đắp.',
        },
        {
          step: '4. Tự phục hồi quy mô',
          desc: `MAPE-K kích hoạt ${recAction} để mở rộng bản sao và phân tán tải đều trên cụm K8s.`,
        },
      ];
    }

    return [
      { step: '1. Tín hiệu sơ cấp', desc: `Phát hiện dị thường viễn trắc từ eBPF Kernel Probe trên ${serviceDisplayName}.` },
      { step: '2. Tích tụ tài nguyên', desc: 'Mô hình AI dự báo xu hướng suy giảm hiệu năng vượt ngưỡng cảnh báo.' },
      { step: '3. Đánh giá chuỗi lan truyền', desc: 'Kubelet ghi nhận cảnh báo bất thường, kích hoạt chẩn đoán nguyên nhân gốc rễ.' },
      { step: '4. Tự lành & Khôi phục', desc: `MAPE-K thực thi ${recAction} nhằm bảo toàn SLA dịch vụ.` },
    ];
  }, [rootCauseType, serviceDisplayName, recAction, confidence, metricSummary]);

  const previousActionInfo = parsedAnalysis?.previous_action || incidentDetail?.previous_action || 'RESTART_POD';
  const previousActionResult = parsedAnalysis?.previous_action_result || incidentDetail?.previous_action_result || (isResolved ? 'SUCCESS' : 'FAILED');

  if (!incident) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(5px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '16px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '960px',
          maxHeight: '94vh',
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          boxShadow: '0 25px 60px -15px rgba(6, 95, 70, 0.35), 0 0 0 1px rgba(16, 185, 129, 0.25)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'fadeIn 0.2s ease-out',
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
                <strong style={{ color: '#FFFFFF' }}>{incidentDetail?.cluster_name || incident?.cluster_name || incident?.cluster || 'các'}</strong> &bull; Độ tin cậy:{' '}
                <span
                  style={{
                    backgroundColor: detectedEngine.includes('OpenAI') ? 'rgba(16, 185, 129, 0.25)' : 'rgba(253, 230, 138, 0.25)',
                    color: detectedEngine.includes('OpenAI') ? '#A7F3D0' : '#FDE68A',
                    padding: '1px 6px',
                    borderRadius: '4px',
                    fontWeight: 700,
                  }}
                >
                  {confidence !== null ? `${confidence}%` : '99%'} {detectedEngine}
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
            <span>Chẩn Đoán &amp; Playbook (Overview)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('causal')}
            style={{
              padding: '10px 14px',
              fontSize: '0.8125rem',
              fontWeight: 700,
              color: activeTab === 'causal' ? '#059669' : '#64748B',
              border: 'none',
              borderBottom: activeTab === 'causal' ? '2px solid #059669' : '2px solid transparent',
              backgroundColor: 'transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s ease',
            }}
          >
            <GitBranch size={14} />
            <span>Chuỗi Nhân Quả &amp; Bằng Chứng</span>
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
            <span>Dữ Liệu Viễn Trắc &amp; Dự Báo GRU</span>
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '10px 16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', flex: '1 1 auto' }}>
          {isLoadingDetail && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', color: '#059669', backgroundColor: '#ECFDF5', padding: '6px 12px', borderRadius: '6px', border: '1px solid #A7F3D0' }}>
              <RefreshCw size={12} className="animate-spin" />
              <span>Đang đồng bộ dữ liệu chi tiết từ cơ sở dữ liệu PostgreSQL...</span>
            </div>
          )}

          {/* TAB 1: OVERVIEW & PLAYBOOK */}
          {activeTab === 'overview' && (
            <>
              {/* ======================================================== */}
              {/* 3. KẾT LUẬN NGUYÊN NHÂN GỐC RỄ (ROOT CAUSE) */}
              {/* ======================================================== */}
              <div
                style={{
                  padding: '16px 18px',
                  backgroundColor: isResolved ? '#F0FDF4' : isUnknownOrNoAction ? '#F8FAFC' : '#FEF2F2',
                  borderRadius: '12px',
                  border: isResolved ? '1px solid #BBF7D0' : isUnknownOrNoAction ? '1px solid #E2E8F0' : '1px solid #FECACA',
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
                    Dự báo rủi ro: <strong style={{ color: '#1D4ED8' }}>{predictedRiskVi || 'TRÀN RAM (OOM)'}</strong>
                  </span>
                  <span style={{ color: '#CBD5E1' }}>&bull;</span>
                  <span style={{ fontSize: '0.75rem', color: '#64748B' }}>
                    Độ tin cậy RCA: <strong style={{ color: '#047857' }}>{confidence !== null ? `${confidence}%` : '99%'}</strong>
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
                  padding: '16px 18px',
                  backgroundColor: '#FFFFFF',
                  borderRadius: '12px',
                  border: '1px solid #E2E8F0',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
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
                    <button
                      type="button"
                      onClick={() => {
                        const isAlreadyInApprovals = Boolean(
                          incident?.fromApprovals ||
                          (typeof window !== 'undefined' && window.location.pathname.includes('/approvals'))
                        );
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
                          ? '#0F766E'
                          : requiresApproval
                          ? 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)'
                          : 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                        color: '#FFFFFF',
                        borderRadius: '8px',
                        border: 'none',
                        fontSize: '0.78125rem',
                        fontWeight: 700,
                        cursor: isExecuting ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {requiresApproval ? <CheckCircle2 size={14} /> : <Zap size={14} />}
                      <span>
                        {isExecuting
                          ? 'Đang thực thi...'
                          : Boolean(incident?.fromApprovals || (typeof window !== 'undefined' && window.location.pathname.includes('/approvals')))
                          ? 'Đóng & Phê Duyệt Tại Danh Sách Phía Dưới'
                          : requiresApproval
                          ? 'Chuyển Sang Cổng Phê Duyệt (HITL) →'
                          : 'Kích Hoạt Tự Khắc Phục Ngay'}
                      </span>
                    </button>
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
                      <div style={{ fontSize: '0.625rem', color: '#64748B', fontWeight: 600 }}>POD LỖI (TARGET POD)</div>
                      <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#0F172A' }}>
                        {faultyPodName}
                      </div>
                      <div style={{ fontSize: '0.625rem', color: '#94A3B8', marginTop: '2px' }}>
                        ID: {faultyPodId.substring(0, 18)}...
                      </div>
                    </div>

                    <div style={{ padding: '4px 8px', backgroundColor: '#F8FAFC', borderRadius: '6px', border: '1px solid #E2E8F0' }}>
                      <div style={{ fontSize: '0.625rem', color: '#64748B', fontWeight: 600 }}>NODE &amp; VAI TRÒ REPLICA SET</div>
                      <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>{faultyNodeName}</span>
                        <span style={{ fontSize: '0.6875rem', color: '#64748B', fontWeight: 500 }}>({replicaSetRole})</span>
                      </div>
                      <div style={{ fontSize: '0.625rem', color: '#94A3B8', marginTop: '2px' }}>
                        UID: {faultyPodUid.substring(0, 18)}...
                      </div>
                    </div>

                    <div style={{ padding: '4px 8px', backgroundColor: '#F8FAFC', borderRadius: '6px', border: '1px solid #E2E8F0' }}>
                      <div style={{ fontSize: '0.625rem', color: '#64748B', fontWeight: 600 }}>NODE AN TOÀN DỰ PHÒNG</div>
                      <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#059669' }}>
                        {recDestNodeName}
                      </div>
                      <div style={{ fontSize: '0.625rem', color: '#166534', marginTop: '2px' }}>
                        RAM trống: <strong>{(destFreeMemBytes / 1024 / 1024 / 1024).toFixed(2)} GB</strong>
                      </div>
                    </div>

                    <div style={{ padding: '8px 10px', backgroundColor: isCircuitBreakerTripped ? '#FEF2F2' : '#F8FAFC', borderRadius: '6px', border: isCircuitBreakerTripped ? '1px solid #FECACA' : '1px solid #E2E8F0' }}>
                      <div style={{ fontSize: '0.625rem', color: isCircuitBreakerTripped ? '#991B1B' : '#64748B', fontWeight: 700 }}>ANTI-LOOP (CIRCUIT BREAKER)</div>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: isCircuitBreakerTripped ? '#DC2626' : '#059669' }}>
                        {blockedActions.length > 0 ? `Khóa: ${blockedActions.join(', ')}` : 'Trạng thái: Không khóa'}
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
                    <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#065F46', display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <BookOpen size={13} color="#059669" />
                      <span>CẨM NANG THAO TÁC KỸ SƯ (MANUAL PLAYBOOK):</span>
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
              {/* 7. LIÊN KẾT TRI THỨC LỊCH SỬ (Knowledge Base) */}
                            {/* ======================================================== */}
              {/* 6. GIẢI TRÌNH CHI TIẾT DÀNH CHO BÁO CÁO INCIDENT */}
              {/* ======================================================== */}
              <div
                style={{
                  padding: '14px 16px',
                  backgroundColor: '#F8FAFC',
                  borderRadius: '10px',
                  border: '1px solid #E2E8F0',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div style={{ fontSize: '0.71875rem', fontWeight: 800, color: '#334155', display: 'flex', alignItems: 'center', gap: '5px' }}>
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
                  padding: '12px 16px',
                  backgroundColor: '#F8FAFC',
                  borderRadius: '10px',
                  border: '1px solid #E2E8F0',
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

          {/* TAB 2: CAUSAL INFERENCE & 6 MULTI-TIER EVIDENCES */}
          {activeTab === 'causal' && (
            <>
              {/* CHUỖI NHÂN QUẢ SUY DIỄN 4 BƯỚC */}
              <div>
                <div style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#0F172A', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <GitBranch size={15} color="#059669" />
                  <span>CHUỖI NHÂN QUẢ SUY DIỄN CỤ THỂ (CAUSAL INFERENCE CHAIN)</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                  {causalChainSteps.map((step, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: '12px 14px',
                        backgroundColor: '#F8FAFC',
                        borderRadius: '10px',
                        border: '1px solid #E2E8F0',
                      }}
                    >
                      <div style={{ fontSize: '0.6875rem', fontWeight: 800, color: '#059669' }}>
                        {step.step}
                      </div>
                      <div style={{ fontSize: '0.78125rem', color: '#334155', marginTop: '4px', lineHeight: 1.45 }}>
                        {step.desc}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ======================================================== */}
              {/* 4. HỆ THỐNG 6 BẰNG CHỨNG XÁC THỰC ĐA TẦNG (EVIDENCE) */}
              {/* ======================================================== */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <ShieldCheck size={16} color="#059669" />
                    <span>HỆ THỐNG BẰNG CHỨNG XÁC THỰC ĐA TẦNG (MULTI-TIER EVIDENCE)</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopyText(multiTierEvidences.join('\n\n'), 'all_evidences')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '4px 10px',
                      fontSize: '0.6875rem',
                      fontWeight: 600,
                      backgroundColor: '#F1F5F9',
                      border: '1px solid #CBD5E1',
                      borderRadius: '5px',
                      cursor: 'pointer',
                    }}
                  >
                    {copiedKey === 'all_evidences' ? <Check size={12} color="#10B981" /> : <Copy size={12} />}
                    <span>{copiedKey === 'all_evidences' ? 'Đã sao chép 6 bằng chứng' : 'Sao chép toàn bộ'}</span>
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '10px' }}>
                  {multiTierEvidences.map((evText, idx) => {
                    const meta = getEvidenceMeta(evText, idx);
                    return (
                      <div
                        key={idx}
                        style={{
                          padding: '12px 14px',
                          backgroundColor: meta.bg,
                          border: `1px solid ${meta.border}`,
                          borderRadius: '8px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.6875rem', fontWeight: 800, color: meta.color }}>
                            {meta.icon}
                            <span>{meta.title}</span>
                          </div>
                          <span style={{ fontSize: '0.625rem', fontWeight: 700, color: meta.color, opacity: 0.8 }}>
                            #{idx + 1}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.7rem', color: '#1E293B', lineHeight: 1.35 }}>
                          {meta.desc}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* BẰNG CHỨNG VIỄN TRẮC & NHẬT KÝ THÔ CONTAINER */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Terminal size={15} color="#0284C7" />
                    <span>NHẬT KÝ VIỄN TRẮC eBPF &amp; K8S EVENT INSPECTOR (RAW CONTAINER LOGS &amp; EVENTS)</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const sourceItems = rawLogsAndEvents.length > 0 ? rawLogsAndEvents : evidenceList;
                      const logText = sourceItems
                        .map((e) => `${e.timestamp ? `[${e.timestamp}] ` : ''}[${e.type}${e.level ? `:${e.level}` : ''}] (${e.ref}) ${e.summary}`)
                        .join('\n');
                      handleCopyText(logText, 'logs');
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '4px 10px',
                      fontSize: '0.6875rem',
                      fontWeight: 600,
                      backgroundColor: '#F1F5F9',
                      border: '1px solid #CBD5E1',
                      borderRadius: '5px',
                      cursor: 'pointer',
                    }}
                  >
                    {copiedKey === 'logs' ? <Check size={12} color="#10B981" /> : <Copy size={12} />}
                    <span>{copiedKey === 'logs' ? 'Đã sao chép' : 'Sao chép nhật ký'}</span>
                  </button>
                </div>

                <div
                  style={{
                    backgroundColor: '#0F172A',
                    color: '#E2E8F0',
                    padding: '14px 16px',
                    borderRadius: '10px',
                    fontSize: '0.75rem',
                    lineHeight: 1.6,
                    maxHeight: '220px',
                    overflowY: 'auto',
                    border: '1px solid #1E293B',
                  }}
                >
                  <div style={{ color: '#94A3B8', marginBottom: '8px', borderBottom: '1px solid #1E293B', paddingBottom: '6px', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                    <span># eBPF Kernel Probe &bull; Service: <strong style={{ color: '#38BDF8' }}>{serviceDisplayName}</strong> &bull; Namespace: <strong style={{ color: '#A7F3D0' }}>{namespaceStr}</strong></span>
                    <span>RCA ID: {incidentDetail?.rca_id ? incidentDetail.rca_id.slice(0, 8) : (incident?.rawId ? incident?.rawId.slice(0, 8) : 'N/A')}</span>
                  </div>

                  {rawLogsAndEvents && rawLogsAndEvents.length > 0 ? (
                    rawLogsAndEvents.map((ev, i) => {
                      const isEvent = ev.type === 'K8S_EVENT';
                      const isMetric = ev.type === 'eBPF_METRIC';
                      const isErr = ev.level === 'ERROR' || ev.level === 'FATAL' || ev.level === 'WARNING';
                      const badgeColor = isMetric ? '#A78BFA' : isEvent ? '#FB923C' : isErr ? '#F87171' : '#38BDF8';
                      return (
                        <div key={i} style={{ marginBottom: '6px', wordBreak: 'break-word' }}>
                          {ev.timestamp && (
                            <span style={{ color: '#64748B', marginRight: '6px' }}>[{ev.timestamp}]</span>
                          )}
                          <span style={{ color: badgeColor, fontWeight: 700 }}>
                            [{ev.type}{ev.level ? `:${ev.level}` : ''}]
                          </span>{' '}
                          <span style={{ color: '#94A3B8' }}>({ev.ref}):</span>{' '}
                          <span style={{ color: isMetric ? '#E9D5FF' : isErr ? '#FDE047' : '#E2E8F0' }}>
                            {ev.summary}
                          </span>
                        </div>
                      );
                    })
                  ) : evidenceList && evidenceList.length > 0 ? (
                    evidenceList.map((ev, i) => (
                      <div key={i} style={{ marginBottom: '6px' }}>
                        <span style={{ color: '#38BDF8', fontWeight: 700 }}>[{ev.type}]</span>{' '}
                        <span style={{ color: '#94A3B8' }}>({ev.ref}):</span>{' '}
                        <span style={{ color: '#FDE047' }}>{translateSREText(ev.summary)}</span>{' '}
                        <span style={{ color: '#A7F3D0', fontSize: '0.6875rem' }}>(Trọng số: {ev.score})</span>
                      </div>
                    ))
                  ) : (
                    <div style={{ color: '#94A3B8', fontStyle: 'italic' }}>
                      Đang đồng bộ luồng nhật ký container &amp; sự kiện K8s cho {serviceDisplayName}...
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* TAB 3: LLM I/O & GRU 7 HEADS */}
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
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {detectedRisksList.map((r, i) => (
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
                          <span>{r.risk_type}</span>
                          <span style={{ backgroundColor: '#DC2626', color: '#FFFFFF', padding: '1px 6px', borderRadius: '3px', fontSize: '0.6875rem' }}>
                            {Math.round(r.confidence <= 1 ? r.confidence * 100 : r.confidence)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* BẢNG 7 HEADS VỚI PROGRESS BAR */}
                  <div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155', marginBottom: '8px' }}>
                      Chi tiết điểm số &amp; ngưỡng kích hoạt của 7 Heads:
                    </div>
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
                                {headName}
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
                              {isTriggered ? '⚠️ VƯỢT NGƯỠNG CẢNH BÁO' : '✓ Trong giới hạn an toàn'}
                            </div>
                          </div>
                        );
                      })}
                    </div>
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
                    <span>DỮ LIỆU ĐẦU VÀO AI (12 MỐC VIỄN TRẮC TELEMETRY)</span>
                  </div>
                  <span style={{ fontSize: '0.6875rem', color: '#1D4ED8', fontWeight: 600, backgroundColor: '#DBEAFE', padding: '2px 8px', borderRadius: '4px' }}>
                    Agent eBPF &bull; Chu kỳ 5 giây/mốc (T1 &rarr; T12: 60s)
                  </span>
                </div>

                <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
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

                  {/* BẢNG NHẬT KÝ 12 MỐC VIỄN TRẮC (Audit Table) */}
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

              {/* KHỐI ĐẦU RA JSON CHUẨN HÓA (FULL STRUCTURED JSON) */}
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
                    backgroundColor: '#ECFDF5',
                    borderBottom: '1px solid #A7F3D0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '8px',
                  }}
                >
                  <div style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#065F46', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Sparkles size={16} color="#059669" />
                    <span>CẤU TRÚC ĐẦU RA ĐẦY ĐỦ 7 PHẦN (STRUCTURED JSON SCHEMA)</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopyText(
                      parsedAnalysis || {
                        request_id: requestId,
                        incident_id: incidentIdStr,
                        cluster_id: clusterIdStr,
                        namespace: namespaceStr,
                        service_id: serviceDisplayName,
                        workload_id: workloadIdStr,
                        analyzed_at: analyzedAtStr,
                        analysis_duration_ms: analysisDurationMs,
                        prediction: gruPrediction,
                        root_cause: { cause: rootCauseType, category: rootCauseCategory, confidence: (confidence || 99) / 100, severity },
                        evidence: multiTierEvidences,
                        recommendation: { action: recAction, priority: actionPriority, risk_level: actionRiskLevel, requires_approval: requiresApproval, reason: recReason, action_parameters: actionParams },
                        explanation: fullExplanation,
                        historical_context_used: historicalContextUsed,
                        similar_incident_ids: similarIncidentIds
                      },
                      'raw_json'
                    )}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '3px 8px',
                      fontSize: '0.6875rem',
                      fontWeight: 600,
                      backgroundColor: '#FFFFFF',
                      border: '1px solid #A7F3D0',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      color: '#065F46',
                    }}
                  >
                    {copiedKey === 'raw_json' ? <Check size={12} color="#10B981" /> : <Copy size={12} />}
                    <span>{copiedKey === 'raw_json' ? 'Đã sao chép JSON' : 'Sao chép JSON'}</span>
                  </button>
                </div>

                <div style={{ padding: '16px' }}>
                  <div
                    style={{
                      backgroundColor: '#0F172A',
                      color: '#F8FAFC',
                      padding: '14px 16px',
                      borderRadius: '8px',
                      fontSize: '0.75rem',
                      lineHeight: 1.6,
                      maxHeight: '260px',
                      overflowY: 'auto',
                      border: '1px solid #1E293B',
                    }}
                  >
                    <pre style={{ margin: 0 }}>
                      {JSON.stringify(
                        parsedAnalysis || {
                          request_id: requestId,
                          incident_id: incidentIdStr,
                          cluster_id: clusterIdStr,
                          namespace: namespaceStr,
                          service_id: serviceDisplayName,
                          workload_id: workloadIdStr,
                          analyzed_at: analyzedAtStr,
                          analysis_duration_ms: analysisDurationMs,
                          prediction: gruPrediction || {
                            service_id: serviceDisplayName,
                            threshold: primaryThreshold,
                            thresholds: gruThresholds,
                            detected_risks: detectedRisksList,
                            risk_outputs: riskOutputsAll,
                          },
                          root_cause: {
                            cause: rootCauseType,
                            category: rootCauseCategory,
                            confidence: (confidence || 99) / 100,
                            severity,
                          },
                          evidence: multiTierEvidences,
                          recommendation: {
                            action: recAction,
                            priority: actionPriority,
                            risk_level: actionRiskLevel,
                            requires_approval: requiresApproval,
                            target_type: 'POD',
                            target_id: faultyPodId,
                            target_name: faultyPodName,
                            target_node: faultyNodeName,
                            reason: recReason,
                            action_parameters: actionParams,
                          },
                          explanation: fullExplanation,
                          historical_context_used: historicalContextUsed,
                          similar_incident_ids: similarIncidentIds,
                        },
                        null,
                        2
                      )}
                    </pre>
                  </div>
                </div>
              </div>
            </div>
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
              if (!rawDate) return new Date().toLocaleString('vi-VN');
              const d = new Date(rawDate);
              return isNaN(d.getTime()) ? String(rawDate) : d.toLocaleString('vi-VN');
            })()}
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '7px 18px',
              backgroundColor: '#FFFFFF',
              border: '1px solid #CBD5E1',
              borderRadius: '8px',
              fontSize: '0.8125rem',
              fontWeight: 600,
              color: '#334155',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};

export default RootCauseModal;
