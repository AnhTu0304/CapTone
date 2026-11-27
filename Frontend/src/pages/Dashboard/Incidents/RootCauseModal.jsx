import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import i18n, { getIntlLocale } from '../../../i18n';
import { aiService } from '../../../services/aiService';
import { translateIncidentTitle, ACTION_DISPLAY_NAMES_VI, translateActionMessageToVi } from './incidentUtils';
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

const ACTION_DISPLAY_NAMES = ACTION_DISPLAY_NAMES_VI;

const getTimelineShortReason = (reason, code, isVerifiedSuccess = false, replicaCount = null) => {
  if (isVerifiedSuccess) {
    if (code === 'SCALE_REPLICAS' || code === 'SCALE_UP' || code === 'SCALE_DOWN') {
      return replicaCount
        ? i18n.t('dashHealing:rootCause.shortReasons.scaleVerifiedCount', { count: replicaCount })
        : i18n.t('dashHealing:rootCause.shortReasons.scaleVerified');
    }
    if (code === 'RESTART_POD' || code === 'RESTART_DEPLOYMENT') return i18n.t('dashHealing:rootCause.shortReasons.restartVerified');
    if (code === 'REPLACE_POD') return i18n.t('dashHealing:rootCause.shortReasons.replaceVerified');
    return i18n.t('dashHealing:rootCause.shortReasons.defaultVerified');
  }
  if (!reason) return i18n.t('dashHealing:rootCause.shortReasons.defaultFailed');
  const r = String(reason).toLowerCase();
  if (r.includes('daemonset') || r.includes('cannot scale')) return i18n.t('dashHealing:rootCause.shortReasons.daemonset');
  if (r.includes('agent không phản hồi') || r.includes('agent chưa phản hồi') || r.includes('quá thời gian chờ') || r.includes('timeout') || r.includes('did not respond')) return i18n.t('dashHealing:rootCause.shortReasons.timeout');
  if (r.includes('hậu kiểm thất bại') || r.includes('chưa giải quyết triệt để') || r.includes('vẫn lỗi') || r.includes('sau hành động') || r.includes('vẫn còn bất thường') || r.includes('not yet resolved')) return i18n.t('dashHealing:rootCause.shortReasons.postCheckFailed');
  if (r.includes('hậu kiểm thành công') || r.includes('ổn định hoàn toàn') || r.includes('đã phục hồi') || r.includes('fully recovered')) {
    return replicaCount
      ? i18n.t('dashHealing:rootCause.shortReasons.postCheckOkCount', { count: replicaCount })
      : i18n.t('dashHealing:rootCause.shortReasons.postCheckOk');
  }
  if (r.includes('1 node') || r.includes('chỉ có 1 node') || r.includes('không có node dự phòng') || r.includes('single-node')) return i18n.t('dashHealing:rootCause.shortReasons.singleNode');
  if (r.includes('oom') || r.includes('cạn kiệt') || r.includes('ram')) return i18n.t('dashHealing:rootCause.shortReasons.oom');
  if (r.includes('crashloop') || r.includes('sập')) return i18n.t('dashHealing:rootCause.shortReasons.crashLoop');
  if (r.includes('scaled') || r.includes('quy mô') || r.includes('mở rộng') || r.includes('thu hẹp') || r.includes('scale')) {
    return replicaCount
      ? i18n.t('dashHealing:rootCause.shortReasons.scaledCount', { count: replicaCount })
      : i18n.t('dashHealing:rootCause.shortReasons.scaled');
  }
  if (r.includes('restart') || r.includes('khởi động lại')) return i18n.t('dashHealing:rootCause.shortReasons.restarted');
  if (r.includes('replace') || r.includes('thay thế')) return i18n.t('dashHealing:rootCause.shortReasons.replaced');
  if (r.includes('drain') || r.includes('di tản') || r.includes('di dời') || r.includes('evict')) return i18n.t('dashHealing:rootCause.shortReasons.drained');
  return reason.length > 50 ? `${reason.substring(0, 48)}...` : reason;
};

const getTimelineStatusBadge = (st) => {
  const code = String(st.code || '').toUpperCase();
  const reason = String(st.reason || '').toLowerCase();
  if (code === 'DRAIN_NODE' || reason.includes('bị chặn') || reason.includes('không có node') || reason.includes('1 node') || reason.includes('blocked')) {
    return { label: i18n.t('dashHealing:rootCause.timeline.badgeBlocked'), bg: '#FEF3C7', color: '#D97706', border: '#FDE68A' };
  }
  if (st.isVerifiedSuccess) {
    return { label: i18n.t('dashHealing:rootCause.timeline.badgeSuccess'), bg: '#DCFCE7', color: '#16A34A', border: '#86EFAC' };
  }
  if (st.isVerifying) {
    return { label: i18n.t('dashHealing:rootCause.timeline.badgeVerifying'), bg: '#DBEAFE', color: '#2563EB', border: '#BFDBFE' };
  }
  if (reason.includes('chưa giải quyết triệt để') || reason.includes('vẫn lỗi') || reason.includes('chưa phục hồi') || reason.includes('not yet resolved') || st.metrics) {
    return { label: i18n.t('dashHealing:rootCause.timeline.badgeUnrecovered'), bg: '#FEE2E2', color: '#DC2626', border: '#FECACA' };
  }
  return { label: i18n.t('dashHealing:rootCause.timeline.badgeFailed'), bg: '#FEE2E2', color: '#DC2626', border: '#FECACA' };
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

const getSreDict = () => {
  const dict = i18n.t('dashHealing:rootCause.sreDict', { returnObjects: true });
  return dict && typeof dict === 'object' ? dict : {};
};

const getHeadName = (headName) => {
  const map = i18n.t('dashHealing:rootCause.heads', { returnObjects: true });
  return (map && map[headName]) || headName;
};

const getGruRiskName = (riskKey) => {
  const map = i18n.t('dashHealing:rootCause.gruRisks', { returnObjects: true });
  return (map && map[riskKey]) || null;
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

// Hàm dịch động thông minh nhận diện mẫu câu log & giải trình cho cả dữ liệu cũ trong DB
const translateSREText = (text) => {
  if (!text || typeof text !== 'string') return text;
  const trimmed = text.trim();
  const dict = getSreDict();
  if (dict[trimmed]) return dict[trimmed];

  // Regex patterns
  if (/^Current incident evidence most strongly supports (.+?)\.?$/i.test(trimmed)) {
    const match = trimmed.match(/^Current incident evidence most strongly supports (.+?)\.?$/i);
    const sub = match[1].trim();
    const subLocalized = dict[sub] || sub;
    return i18n.t('dashHealing:rootCause.srePatterns.strongestEvidence', { sub: subLocalized });
  }

  if (/No safe infrastructure action is justified by the available evidence/i.test(trimmed)) {
    return i18n.t('dashHealing:rootCause.srePatterns.noSafeInfra');
  }

  if (/^Latency is above normal \(([\d\.]+)\s*ms\)/i.test(trimmed)) {
    const match = trimmed.match(/^Latency is above normal \(([\d\.]+)\s*ms\)/i);
    return i18n.t('dashHealing:rootCause.srePatterns.latencyHigh', { ms: match[1] });
  }

  if (/Readiness probe is failing/i.test(trimmed)) {
    return i18n.t('dashHealing:rootCause.srePatterns.readinessFail');
  }

  if (/Liveness probe is failing/i.test(trimmed)) {
    return i18n.t('dashHealing:rootCause.srePatterns.livenessFail');
  }

  if (/Container was OOMKilled/i.test(trimmed)) {
    return i18n.t('dashHealing:rootCause.srePatterns.oomKilled');
  }

  if (/Pod is in CrashLoopBackOff/i.test(trimmed)) {
    return i18n.t('dashHealing:rootCause.srePatterns.crashLoop');
  }

  if (/^Pod restarted multiple times \((\d+)\)/i.test(trimmed)) {
    const match = trimmed.match(/^Pod restarted multiple times \((\d+)\)/i);
    return i18n.t('dashHealing:rootCause.srePatterns.restartedMultiple', { count: match[1] });
  }

  if (/^CPU usage is critically high \(([\d\.]+%)\)/i.test(trimmed)) {
    const match = trimmed.match(/^CPU usage is critically high \(([\d\.]+%)\)/i);
    return i18n.t('dashHealing:rootCause.srePatterns.cpuCrit', { val: match[1] });
  }

  if (/^RAM usage is critically high \(([\d\.]+%)\)/i.test(trimmed)) {
    const match = trimmed.match(/^RAM usage is critically high \(([\d\.]+%)\)/i);
    return i18n.t('dashHealing:rootCause.srePatterns.ramCrit', { val: match[1] });
  }

  if (/^Disk usage is critically high \(([\d\.]+%)\)/i.test(trimmed)) {
    const match = trimmed.match(/^Disk usage is critically high \(([\d\.]+%)\)/i);
    return i18n.t('dashHealing:rootCause.srePatterns.diskCrit', { val: match[1] });
  }

  if (/^HTTP 5xx rate is high \(([\d\.]+%)\)/i.test(trimmed)) {
    const match = trimmed.match(/^HTTP 5xx rate is high \(([\d\.]+%)\)/i);
    return i18n.t('dashHealing:rootCause.srePatterns.http5xxHigh', { val: match[1] });
  }

  if (/^Request rate is high \(([\d\.]+)\)/i.test(trimmed)) {
    const match = trimmed.match(/^Request rate is high \(([\d\.]+)\)/i);
    return i18n.t('dashHealing:rootCause.srePatterns.reqRateHigh', { val: match[1] });
  }

  if (/The affected pod is unhealthy or repeatedly restarting/i.test(trimmed)) {
    return i18n.t('dashHealing:rootCause.srePatterns.podUnhealthy');
  }

  if (/Additional replicas can distribute load and restore service capacity/i.test(trimmed)) {
    return i18n.t('dashHealing:rootCause.srePatterns.addReplicas');
  }

  if (/Security anomaly detected from source IP/i.test(trimmed)) {
    const match = trimmed.match(/source IP ([\d\.]+)/i);
    return i18n.t('dashHealing:rootCause.srePatterns.securityIp', { ip: match ? match[1] : '' });
  }

  if (/Action history recorded (\d+) consecutive failure\(s\)/i.test(trimmed)) {
    const match = trimmed.match(/recorded (\d+) consecutive failure\(s\)/i);
    return i18n.t('dashHealing:rootCause.srePatterns.consecutiveFailures', { count: match ? match[1] : 2 });
  }

  if (/^Previous (.+?) action result was (.+?)$/i.test(trimmed)) {
    const match = trimmed.match(/^Previous (.+?) action result was (.+?)$/i);
    return i18n.t('dashHealing:rootCause.srePatterns.prevActionResult', { action: match[1], result: match[2] });
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

// Từ điển câu hỏi nghiệp vụ SRE Checklist ngắn gọn
const getChecklistQuestionText = (rawKey) => {
  const trimmed = String(rawKey || '').trim();
  const keyMap = {
    'Application health endpoint response': 'dashHealing:rootCause.checklist.healthEndpointQ',
    'Probe configuration': 'dashHealing:rootCause.checklist.probeConfigQ',
    'Application logs': 'dashHealing:rootCause.checklist.appLogsQ',
    'CPU throttling metrics': 'dashHealing:rootCause.checklist.cpuThrottleQ',
    'Historical latency': 'dashHealing:rootCause.checklist.histLatencyQ',
    'Kubernetes events chưa được cung cấp': 'dashHealing:rootCause.checklist.k8sEventsQ',
  };
  if (keyMap[trimmed]) {
    return i18n.t(keyMap[trimmed]);
  }
  return translateSREText(trimmed);
};

// Helper phân tích và bóc tách thông tin kỹ thuật K8s gốc kèm diễn giải SRE trực quan
const parseSREEventEvidence = (raw) => {
  if (!raw) {
    const defTitle = i18n.t('dashHealing:rootCause.symptoms.defaultTitle');
    return {
      originalText: '',
      title: defTitle,
      podName: null,
      count: 1,
      port: null,
      ip: null,
      url: null,
      timestamp: null,
      errorSnippet: defTitle,
      explanation: i18n.t('dashHealing:rootCause.symptoms.defaultExplanation'),
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
  let title = i18n.t('dashHealing:rootCause.symptoms.defaultTitle');
  if (lower.includes('liveness probe failed') || lower.includes('liveness probe') || lower.includes('tính sống còn')) {
    title = i18n.t('dashHealing:rootCause.symptoms.livenessFailed');
  } else if (lower.includes('readiness probe failed') || lower.includes('readiness probe') || lower.includes('tính sẵn sàng')) {
    title = i18n.t('dashHealing:rootCause.symptoms.readinessFailed');
  } else if (lower.includes('startup probe failed') || lower.includes('startup probe')) {
    title = i18n.t('dashHealing:rootCause.symptoms.startupFailed');
  } else if (lower.includes('oomkilled') || lower.includes('exit code 137') || lower.includes('exitcode 137')) {
    title = i18n.t('dashHealing:rootCause.symptoms.oomKilled');
  } else if (lower.includes('crashloopbackoff') || lower.includes('back-off restarting')) {
    title = i18n.t('dashHealing:rootCause.symptoms.crashLoop');
  } else if (lower.includes('imagepullbackoff') || lower.includes('errimagepull')) {
    title = i18n.t('dashHealing:rootCause.symptoms.imagePull');
  } else if (lower.includes('failedscheduling')) {
    title = i18n.t('dashHealing:rootCause.symptoms.failedScheduling');
  } else if (str.includes(':')) {
    title = translateSREText(str.split(':')[0].trim());
  } else {
    title = translateSREText(str);
  }

  // 6. Xác định lỗi vắn tắt (errorSnippet) và 1 câu giải thích ngắn (explanation)
  let errorSnippet = null;
  let explanation = null;

  if (lower.includes('connection refused') || lower.includes('connect: connection refused')) {
    errorSnippet = 'connection refused';
    explanation = i18n.t('dashHealing:rootCause.symptoms.connRefusedExpl', { port: port || '8080' });
  } else if (lower.includes('context deadline exceeded') || lower.includes('client.timeout') || lower.includes('timeout exceeded')) {
    errorSnippet = 'context deadline exceeded (timeout)';
    explanation = i18n.t('dashHealing:rootCause.symptoms.timeoutExpl');
  } else if (lower.includes('oomkilled') || lower.includes('exit code 137') || lower.includes('exitcode 137')) {
    errorSnippet = 'exitCode 137 (OOM)';
    explanation = i18n.t('dashHealing:rootCause.symptoms.oomExpl');
  } else if (lower.includes('crashloopbackoff') || lower.includes('back-off restarting')) {
    errorSnippet = 'CrashLoopBackOff';
    explanation = i18n.t('dashHealing:rootCause.symptoms.crashLoopExpl');
  } else if (lower.includes('imagepullbackoff') || lower.includes('errimagepull')) {
    errorSnippet = 'ErrImagePull';
    explanation = i18n.t('dashHealing:rootCause.symptoms.imagePullExpl');
  } else if (lower.includes('failedscheduling')) {
    errorSnippet = 'FailedScheduling';
    explanation = i18n.t('dashHealing:rootCause.symptoms.failedSchedExpl');
  } else {
    errorSnippet = i18n.t('dashHealing:rootCause.symptoms.defaultSnippet');
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
  const { t, i18n: i18nInstance } = useTranslation('dashHealing');
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
  const [expandedSymptomKeys, setExpandedSymptomKeys] = useState(new Set());
  const [isExpandedEvidenceList, setIsExpandedEvidenceList] = useState(false);
  const [expandedSymptoms, setExpandedSymptoms] = useState({});
  const [isEvidenceForExpanded, setIsEvidenceForExpanded] = useState(false);
  const [isResolvingIncident, setIsResolvingIncident] = useState(false);
  const [resolveSuccess, setResolveSuccess] = useState(false);

  const handleConfirmResolve = async () => {
    const rawTargetId = incident?.rawId || incident?.id || incidentDetail?.id;
    if (!rawTargetId) return;
    try {
      setIsResolvingIncident(true);
      await aiService.updateIncidentStatus(rawTargetId, 'RESOLVED');
      setResolveSuccess(true);
      setIncidentDetail((prev) => ({
        ...(prev || {}),
        status: 'RESOLVED',
        resolved_at: new Date().toISOString(),
      }));
      if (onResolve) {
        onResolve(incident?.id, rawTargetId);
      }
    } catch (err) {
      console.error('[RootCauseModal] Failed to resolve incident:', err);
    } finally {
      setIsResolvingIncident(false);
    }
  };

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
      return () => {
        isMounted = false;
      };
    }

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
              summary: translateSREText(summary) || i18n.t('dashHealing:rootCause.symptoms.telemetryFallback'),
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

        if (Array.isArray(initialInputs) && initialInputs.length > 0) {
          setPredictionInputs(initialInputs);
        } else {
          const predId = detailData?.prediction_id;
          if (predId && predId !== initialPredId) {
            try {
              const inputs = await aiService.getPredictionInputs(predId);
              if (isMounted && Array.isArray(inputs)) {
                setPredictionInputs(inputs);
              }
            } catch {}
          } else if (Array.isArray(initialInputs)) {
            setPredictionInputs(initialInputs);
          }
        }
      } catch (err) {
        console.warn('[RootCauseModal] Lỗi nạp chi tiết:', err);
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
    incident?.statusKey === 'RESOLVED_AUTO' ||
    incident?.statusKey === 'RESOLVED_MANUAL' ||
    (incident?.status && incident?.status.includes('hoàn tất'))
  );

  const isVerifyingAfterAction = !isResolved && !hasActualPendingApproval && (
    (incidentDetail?.healing_status || incident?.healingStatus || '').toUpperCase() === 'COMPLETED' ||
    incident?.statusKey === 'VERIFYING' ||
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
    return s || incident?.service || incident?.target_name || t('incidentUtils.serviceAppFallback');
  }, [incident?.service, incident?.target_name, incidentDetail, t]);

  const incidentTitle = useMemo(() => {
    const rawTitle = incidentDetail?.title || incident?.title || '';
    if (!rawTitle) return '';
    return translateIncidentTitle(rawTitle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incidentDetail?.title, incident?.title, i18nInstance.language]);

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

  const sreDict = getSreDict();
  const gruRiskNames = t('rootCause.gruRisks', { returnObjects: true }) || {};
  const rootCauseType = incidentDetail?.root_cause_type || parsedAnalysis?.root_cause?.cause || incident?.rootCauseType || incident?.primaryRisk || (predictedRisk ? (gruRiskNames[predictedRisk] || predictedRisk) : sreDict['Service performance degradation'] || 'Service performance degradation');
  const severity = incidentDetail?.severity || parsedAnalysis?.root_cause?.severity || incident?.severity || null;
  const recAction = parsedAnalysis?.recommendation?.action || incidentDetail?.recommendation_action || incident?.recommendationAction || 'NO_ACTION';
  const recActionVi = sreDict[recAction] || recAction;
  const recReason = parsedAnalysis?.recommendation?.reason || incidentDetail?.recommendation_reason || incident?.recommendationReason || incident?.aiReasoning || t('rootCause.misc.recommendDefault', { action: recAction, service: serviceDisplayName });
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
  const clusterIdStr = clusterDisplayName || t('common.unidentified');
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
  const riskOutputsAll = useMemo(() => {
    let outputs = incidentDetail?.prediction_risk_outputs || incidentDetail?.risk_outputs;
    if (typeof outputs === 'string') {
      try {
        outputs = JSON.parse(outputs);
      } catch (e) {
        outputs = null;
      }
    }
    if (outputs && typeof outputs === 'object' && Object.keys(outputs).length > 0) {
      return outputs;
    }
    return gruPrediction?.risk_outputs || null;
  }, [incidentDetail, gruPrediction]);

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
      const svcName = matchTarget ? matchTarget[1] : (serviceDisplayName || t('rootCause.misc.serviceWord'));
      return t('rootCause.misc.connRefusedApi', { svc: svcName });
    }
    // Dịch các thông báo hành động từ K8s Agent (scaling, restart, rollback, replace pod...)
    str = translateActionMessageToVi(str, serviceDisplayName, t('incidentUtils.actions.DEFAULT'), namespaceName || 'default');
    // Bỏ các từ tiếng Anh kỹ thuật lặp
    str = str.replace(/\s*\(Post-Action Verification Failed\):?/gi, ':');
    str = str.replace(/Hậu kiểm thất bại:\s*/gi, '');
    str = str.replace(/^Hậu kiểm thất bại\s*/gi, '');
    str = str.replace(/Post-check failed:\s*/gi, '');
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
      return t('rootCause.verdicts.verifiedSuccess');
    }
    if (metrics) {
      if (metrics.ram !== null && metrics.ram >= 90) {
        return t('rootCause.verdicts.ramExhausted', { ram: metrics.ram });
      }
      if (metrics.cpu !== null && metrics.cpu >= 80) {
        return t('rootCause.verdicts.cpuOverload', { cpu: metrics.cpu });
      }
      if (metrics.latency !== null && metrics.latency > 500) {
        return t('rootCause.verdicts.highLatency', { latency: metrics.latency });
      }
      if (metrics.http5xx !== null && metrics.http5xx > 0) {
        return t('rootCause.verdicts.http5xx', { http5xx: metrics.http5xx });
      }
      if (metrics.restart !== null && metrics.restart > 0) {
        return t('rootCause.verdicts.restarts', { restart: metrics.restart });
      }
      if (isFailed) {
        if (rawReason && !rawReason.includes('vẫn còn bất thường (CPU:')) {
          return rawReason;
        }
        return t('rootCause.verdicts.postCheckFailed');
      }
    }
    return rawReason || (isFailed ? t('rootCause.verdicts.unresolvedFallback') : t('rootCause.verdicts.monitoringFallback'));
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
    ? t('rootCause.infoCard.clusterNodes1')
    : clusterNodeCount > 1
      ? t('rootCause.infoCard.clusterNodesN', { count: clusterNodeCount })
      : (clusterDisplayName ? t('rootCause.infoCard.clusterPrefix', { name: clusterDisplayName }) : t('common.unidentified'));
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
    const dict = getSreDict();
    const intlLocale = getIntlLocale(i18nInstance.language);
    if (dbHistory.length > 0) {
      steps = dbHistory.map((item, idx) => {
        const code = item.action_code || item.action_name || 'UNKNOWN_ACTION';
        const labelVi = dict[code] || item.action_name || code;
        const execStatus = String(item.execution_status || '').toUpperCase();
        const verResult = item.verification_result;
        const isStaleRunning = execStatus === 'RUNNING' && (item.started_at || item.created_at) && (Date.now() - new Date(item.started_at || item.created_at).getTime() > 60000);
        const isFailed = execStatus === 'FAILED' || verResult === false || isStaleRunning;
        const isCompletedExec = execStatus === 'COMPLETED' || execStatus === 'SUCCEEDED';
        const isVerifiedSuccess = !isFailed && (verResult === true || (isCompletedExec && isResolved));
        const isVerifying = isCompletedExec && !isVerifiedSuccess && !isFailed;
        const actionTs = item.verified_at || item.completed_at || item.created_at;
        const timeStr = actionTs
          ? new Date(actionTs).toLocaleTimeString(intlLocale, { hour: '2-digit', minute: '2-digit', second: '2-digit' })
          : null;

        const rawReason = cleanExecutionError(
          item.error_message || item.verification_message || (isStaleRunning ? t('rootCause.timeline.staleRunningReason') : null)
        );

        // Trích xuất số lượng bản sao Pod (Replicas) nếu có từ DB hoặc thông điệp
        const replicaCount =
          item.verification_details?.metrics?.replica_count ??
          item.result?.details?.target_replicas ??
          item.result?.details?.replicas ??
          item.result?.replicas ??
          (() => {
            const raw = String(item.verification_message || item.error_message || item.result?.message || rawReason || '');
            const m = raw.match(/(?:to|lên|thành|đạt|từ \d+ đến|từ \d+ tới)\s*(\d+)\s*(?:replicas|bản sao|pod)/i) ||
                      raw.match(/from \d+ to (\d+)/i) ||
                      raw.match(/(\d+)\s*(?:replicas|bản sao|pod)/i);
            return m ? parseInt(m[1], 10) : null;
          })();

        const metrics = item.verification_details?.metrics
          ? {
              cpu: item.verification_details.metrics.cpu ?? null,
              ram: item.verification_details.metrics.ram ?? null,
              restart: item.verification_details.metrics.pod_restart_count ?? null,
              latency: item.verification_details.metrics.latency ?? null,
              http5xx: item.verification_details.metrics.http5xx_rate ?? null,
              replica_count: item.verification_details.metrics.replica_count ?? replicaCount,
            }
          : extractDevOpsMetrics(rawReason);

        if (metrics && replicaCount && !metrics.replica_count) {
          metrics.replica_count = replicaCount;
        }

        const conciseVerdict = getDevOpsVerdict(metrics, isVerifiedSuccess, isFailed, rawReason);

        return {
          stepIndex: idx + 1,
          code,
          labelVi,
          isFailed,
          isVerifiedSuccess,
          isVerifying,
          timeStr,
          replicaCount,
          verificationLabel: isFailed
            ? (isStaleRunning ? t('rootCause.timeline.verifTimeout') : t('rootCause.timeline.verifFailed'))
            : isVerifiedSuccess
              ? t('rootCause.timeline.verifSuccess')
              : isVerifying
                ? t('rootCause.timeline.verifVerifying')
                : t('rootCause.timeline.verifStatus', { status: execStatus || t('common.processing') }),
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
            const rawReason = cleanExecutionError(healingErrorMessage || t('rootCause.timeline.unrecoveredReason'));
            const metrics = extractDevOpsMetrics(rawReason);
            const conciseVerdict = getDevOpsVerdict(metrics, false, true, rawReason);
            steps.push({
              stepIndex: steps.length + 1,
              code,
              labelVi: dict[code] || code,
              isFailed: true,
              isVerifiedSuccess: false,
              isVerifying: false,
              timeStr: null,
              verificationLabel: t('rootCause.timeline.verifBlockedLoop'),
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
        const rawReason = cleanExecutionError(idx === blockedActions.length - 1 ? healingErrorMessage : t('rootCause.timeline.unrecoveredReason'));
        const metrics = extractDevOpsMetrics(rawReason);
        const conciseVerdict = getDevOpsVerdict(metrics, false, true, rawReason);

        return {
          stepIndex: idx + 1,
          code,
          labelVi: dict[code] || code,
          isFailed: true,
          isVerifiedSuccess: false,
          isVerifying: false,
          timeStr: null,
          verificationLabel: t('rootCause.timeline.verifBlockedLoop'),
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
        labelVi: t('rootCause.timeline.drainNodeStep'),
        isFailed: true,
        isVerifiedSuccess: false,
        isVerifying: false,
        timeStr: steps[steps.length - 1]?.timeStr || null,
        verificationLabel: noStandbyNode
          ? t('rootCause.timeline.drainNoStandbyBadge', { node: nodeLabel })
          : isPrimaryDbBlocked
            ? t('rootCause.timeline.drainPrimaryDbBadge')
            : t('rootCause.timeline.drainAppLayerBadge'),
        reason: noStandbyNode
          ? t('rootCause.timeline.drainNoStandbyReason', { node: nodeLabel })
          : isPrimaryDbBlocked
            ? t('rootCause.timeline.drainPrimaryDbReason', { destNode: recDestNodeName })
            : t('rootCause.timeline.drainAppLayerReason', { node: nodeLabel, destNode: recDestNodeName }),
        conciseVerdict: noStandbyNode
          ? t('rootCause.timeline.drainNoStandbyVerdict', { node: nodeLabel })
          : isPrimaryDbBlocked
            ? t('rootCause.timeline.drainPrimaryDbVerdict', { node: nodeLabel })
            : t('rootCause.timeline.drainAppLayerVerdict', { node: nodeLabel }),
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    i18nInstance.language,
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
        return { label: t('rootCause.modalStatus.autoSucceeded'), color: '#15803D' };
      }
      if (succeededCount > 0 && failedCount > 0) {
        return { label: t('rootCause.modalStatus.retrySucceeded'), color: '#15803D' };
      }
      if (failedCount > 0 && succeededCount === 0) {
        return { label: t('rootCause.modalStatus.closedManual'), color: '#475569' };
      }
      if (!hasActions || isNoAction) {
        return { label: t('rootCause.modalStatus.autoStabilized'), color: '#1D4ED8' };
      }
      return { label: t('rootCause.modalStatus.recovered'), color: '#15803D' };
    }

    if (failedCount > 0 && succeededCount === 0) {
      return { label: t('rootCause.modalStatus.unrecoveredFailed'), color: '#DC2626' };
    }
    if (isVerifyingAfterAction) {
      return { label: t('rootCause.modalStatus.verifying'), color: '#D97706' };
    }
    if (hasActualPendingApproval) {
      return { label: t('rootCause.modalStatus.hitlPending'), color: '#D97706' };
    }
    if (isNoAction) {
      return { label: t('rootCause.modalStatus.safeMonitoring'), color: '#1D4ED8' };
    }
    return { label: t('rootCause.modalStatus.unrecovered'), color: '#DC2626' };
  }, [isResolved, previousActionSteps, isNoAction, isVerifyingAfterAction, hasActualPendingApproval, t]);

  const isCircuitBreakerActive = Boolean(
    isCircuitBreakerTripped ||
    totalFailedSteps >= 2 ||
    (allPriorStepsFailed && previousActionSteps.length >= 2) ||
    (consecutiveFailures >= 2)
  );
  const effectiveRecAction = (isCircuitBreakerActive && !isResolved)
    ? 'NO_ACTION'
    : recAction;
  const effectiveRecActionVi = sreDict[effectiveRecAction] || effectiveRecAction;
  const effectiveRecReason = (isCircuitBreakerActive && !isResolved)
    ? t('rootCause.decision.cbTrippedFallback', { steps: previousActionSteps.length, defaultValue: `Hệ thống đã thực thi ${previousActionSteps.length} cấp tự phục hồi liên tiếp nhưng sự cố chưa được khắc phục triệt để. Cầu dao an toàn (Circuit Breaker - NO_ACTION) đã kích hoạt ngắt mạch để tránh vòng lặp tự động vô hạn. Kỹ sư vui lòng kiểm tra cụm theo Cẩm nang thao tác (Manual Playbook) bên dưới.` })
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
        return t('rootCause.playbook.sloOom');
      }
      if (riskStr.includes('CPU') || riskStr.includes('SATURATION') || riskStr.includes('OVERLOAD')) {
        return t('rootCause.playbook.sloCpu');
      }
      if (riskStr.includes('DISK') || riskStr.includes('STORAGE') || riskStr.includes('ĐĨA') || riskStr.includes('LƯU TRỮ')) {
        return t('rootCause.playbook.sloDisk');
      }
      if (riskStr.includes('LATENCY')) {
        return t('rootCause.playbook.sloLatency');
      }
      return t('rootCause.playbook.sloDefault');
    })();

    if (isCircuitBreakerTripped || recAction === 'NO_ACTION') {
      const isDiskRisk = (rootCauseType || '').toLowerCase().includes('đĩa') || (rootCauseType || '').toLowerCase().includes('disk') || (rootCauseType || '').toLowerCase().includes('lưu trữ');
      if (isDiskRisk) {
        return [
          t('rootCause.playbook.diskStep1', { nsFlag: kubectlNsFlag, target: kubectlTarget }),
          t('rootCause.playbook.diskStep2'),
          t('rootCause.playbook.diskStep3'),
        ];
      }
      return [
        t('rootCause.playbook.cbStep1', { service: serviceDisplayName, nsFlag: kubectlNsFlag, target: kubectlTarget }),
        t('rootCause.playbook.cbStep2'),
        t('rootCause.playbook.cbStep3'),
      ];
    }
    if (isDbService) {
      return [
        t('rootCause.playbook.dbStep1'),
        t('rootCause.playbook.dbStep2'),
        sloVerificationStep,
      ];
    }
    return [
      t('rootCause.playbook.cbStep1', { service: serviceDisplayName, nsFlag: kubectlNsFlag, target: kubectlTarget }),
      t('rootCause.playbook.stdStep2', { action: recActionVi || recAction, kind: workloadKindLower, service: serviceDisplayName }),
      sloVerificationStep,
    ];
  }, [rawActionParams.manual_playbook, incident?.manualPlaybook, isCircuitBreakerTripped, recAction, rootCauseType, predictedRisk, kubectlNsFlag, realPodName, workloadKindLower, serviceDisplayName, isDbService, recActionVi, t]);

  // Ưu tiên & rủi ro lấy trực tiếp từ recommendation JSON hoặc ai_recommendations CSDL (không tự ép mặc định CRITICAL/HIGH)
  const actionPriority = recObj?.priority || incidentDetail?.recommendation_priority || incident?.recommendationPriority || incidentDetail?.severity || incident?.severity || null;
  const actionRiskLevel = recObj?.risk_level || incidentDetail?.recommendation_risk_level || incident?.recommendationRiskLevel || null;

  // ========================================================
  // 6. GIẢI TRÌNH CHI TIẾT DÀNH CHO BÁO CÁO INCIDENT
  // ========================================================
  const fullExplanation = parsedAnalysis?.explanation || incidentDetail?.root_cause_description || incidentDetail?.description || incident?.rootCauseDescription || (
    t('rootCause.misc.explanationDefault', { service: serviceDisplayName, action: recActionVi })
  );

  // ========================================================
  // 7. LIÊN KẾT TRI THỨC LỊCH SỬ (Knowledge Base)
  // ========================================================
  const historicalContextUsed = parsedAnalysis?.historical_context_used !== undefined ? Boolean(parsedAnalysis.historical_context_used) : false;
  const similarIncidentIds = Array.isArray(parsedAnalysis?.similar_incident_ids) ? parsedAnalysis.similar_incident_ids : [];

  // ========================================================
  // BỘ BIẾN HIỂN THỊ CHUẨN HÓA ĐA NGÔN NGỮ
  // ========================================================
  const rootCauseCategoryVi = (evidenceStatus === 'INSUFFICIENT_EVIDENCE' || isUnknown)
    ? (sreDict['INSUFFICIENT_EVIDENCE'] || 'INSUFFICIENT_EVIDENCE')
    : (sreDict[rootCauseCategory] || rootCauseCategory);
  const severityVi = severity ? (sreDict[String(severity).toUpperCase()] || severity) : t('rootCause.misc.unclassified');
  const rootCauseTypeVi = sreDict[rootCauseType] || translateSREText(rootCauseType);
  const actionPriorityVi = actionPriority ? (sreDict[String(actionPriority).toUpperCase()] || actionPriority) : t('common.unclassified');
  const actionRiskLevelVi = actionRiskLevel ? (sreDict[String(actionRiskLevel).toUpperCase()] || actionRiskLevel) : t('common.unclassified');
  const predictedRiskVi = predictedRisk === 'SCALE_DOWN_CANDIDATE'
    ? (sreDict['SCALE_DOWN_CANDIDATE'] || predictedRisk)
    : (getGruRiskName(predictedRisk) || sreDict[predictedRisk] || predictedRisk);
  const recReasonVi = useMemo(() => {
    let text = translateSREText(recReason || '');
    if (!text) return '';
    // Lược bỏ câu lỗi gần nhất lặp lại trong đoạn văn bản đề xuất (đã có dòng riêng bên dưới)
    text = text.replace(/Lỗi gần nhất:\s*Hậu kiểm thất bại.*?$/is, '').trim();
    text = text.replace(/Lỗi gần nhất:.*?$/is, '').trim();
    text = text.replace(/\s*\(Post-Action Verification Failed\)/gi, '');
    if (i18nInstance.language !== 'en') {
      text = text.replace(/Human-in-the-Loop/gi, 'Kỹ sư vận hành');
      text = text.replace(/Circuit Breaker/gi, 'Cầu dao an toàn');
    }
    return text.trim();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recReason, i18nInstance.language]);

  const detectedEngine = useMemo(() => {
    if (parsedAnalysis?.engine) return parsedAnalysis.engine;
    const method = incidentDetail?.analysis_method || incident?.analysisMethod;
    if (method) {
      if (method === 'AI_DETERMINISTIC_RULES') {
        return 'Deterministic Multi-Agent SRE';
      }
      return method;
    }
    return t('common.unidentified');
  }, [parsedAnalysis, incidentDetail, incident?.analysisMethod, t]);

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
          : d.toLocaleTimeString(getIntlLocale(i18nInstance.language), { hour: '2-digit', minute: '2-digit', second: '2-digit' });

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
  }, [predictionInputs, i18nInstance.language]);

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
    const prefixCheck = t('rootCause.srePatterns.strongestEvidence', { sub: '' }).split(':')[0];
    const isShortGeneric =
      !rawTranslated ||
      rawTranslated.length < 130 ||
      rawTranslated.startsWith('Bằng chứng sự cố hiện tại ủng hộ mạnh nhất nguyên nhân') ||
      (prefixCheck && rawTranslated.startsWith(prefixCheck));

    if (!isShortGeneric) {
      return rawTranslated;
    }

    const targetDesc = realPodName
      ? (faultyNodeName ? t('rootCause.misc.podOnNode', { pod: realPodName, node: faultyNodeName }) : t('rootCause.misc.podOnly', { pod: realPodName }))
      : (faultyNodeName ? t('rootCause.misc.workloadOnNode', { kind: workloadKindRaw, service: serviceDisplayName, node: faultyNodeName }) : t('rootCause.misc.workloadOnly', { kind: workloadKindRaw, service: serviceDisplayName }));

    const lines = [];
    const isUnknownOrInsufficient =
      isUnknown ||
      evidenceStatus === 'INSUFFICIENT_EVIDENCE' ||
      rootCauseType === 'UNKNOWN' ||
      /chưa xác định|thiếu bằng chứng|insufficient evidence|unidentified/i.test(rootCauseTypeVi);

    if (isUnknownOrInsufficient) {
      lines.push(
        t('rootCause.sreReport.bulletUnknown', { service: serviceDisplayName, target: targetDesc, severity: severityVi })
      );
    } else {
      const cleanCause = rootCauseTypeVi.replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim();
      lines.push(
        t('rootCause.sreReport.bulletKnown', { service: serviceDisplayName, target: targetDesc, cause: cleanCause || rootCauseTypeVi, severity: severityVi })
      );
    }

    if (metricSummary) {
      lines.push(
        t('rootCause.sreReport.bulletTelemetry', {
          cpuMax: metricSummary.cpu.max,
          cpuCurr: metricSummary.cpu.current,
          ramMax: metricSummary.ram.max,
          latMax: metricSummary.latency.max,
          err5xx: metricSummary.http_5xx_rate.max,
          restarts: metricSummary.pod_restart_count,
        })
      );
    } else if (predictedRiskVi) {
      lines.push(
        t('rootCause.sreReport.bulletAiRisk', { risk: predictedRiskVi })
      );
    }

    if (Array.isArray(multiTierEvidences) && multiTierEvidences.length > 0) {
      const topEvs = multiTierEvidences
        .slice(0, 2)
        .map((e) => {
          const rawStr = String(e || '').trim();
          if (!rawStr || rawStr === 'insufficient_evidence' || /insufficient_evidence/i.test(rawStr)) {
            return t('rootCause.sreReport.insufficientEventLog');
          }
          const parsed = parseSREEventEvidence(e);
          if (parsed.podName && parsed.title) {
            return t('rootCause.sreReport.evidencePodItem', {
              title: parsed.title,
              pod: parsed.podName,
              count: parsed.count || 1,
              snippet: parsed.errorSnippet ? ` - ${parsed.errorSnippet}` : '',
            });
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
        lines.push(t('rootCause.sreReport.bulletEvidence', { items: topEvs.join('; ') }));
      }
    }

    const lastStep = previousActionSteps.length > 0 ? previousActionSteps[previousActionSteps.length - 1] : null;
    if (recAction === 'NO_ACTION') {
      const cleanReason = (recReasonVi || '')
        .replace(/\(?NO_ACTION\)?/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
      const actionMsg = isCircuitBreakerTripped
        ? t('rootCause.sreReport.bulletActionCb', { priority: actionPriorityVi, reason: cleanReason })
        : t('rootCause.sreReport.bulletActionNo', { priority: actionPriorityVi, reason: cleanReason });
      lines.push(
        t('rootCause.sreReport.bulletActionProposal', { msg: actionMsg.trim() })
      );
    } else if (lastStep && lastStep.isVerifiedSuccess) {
      lines.push(
        t('rootCause.sreReport.bulletHealingSuccess', { step: lastStep.stepIndex, name: lastStep.labelVi })
      );
    } else if (lastStep && lastStep.isVerifying && lastStep.code === recAction) {
      lines.push(
        t('rootCause.sreReport.bulletHealingVerifying', { action: recActionVi, step: lastStep.stepIndex })
      );
    } else {
      const rollbackDetail = recAction === 'ROLLBACK_DEPLOYMENT'
        ? t('rootCause.sreReport.rollbackDetailLong')
        : '';
      lines.push(
        t('rootCause.sreReport.bulletNextAction', {
          action: recActionVi,
          rollback: rollbackDetail,
          priority: actionPriorityVi,
          risk: actionRiskLevelVi,
        })
      );
    }

    return lines.join('\n');
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    i18nInstance.language,
  ]);

// Cẩm nang thao tác chuẩn Mockup 3 bước
  const defaultPlaybookSteps = useMemo(() => {
    const isProbe = groupedSymptoms.some(g => g.title.includes('Probe')) || symptomsList.some(s => String(s).toLowerCase().includes('probe'));
    if (isProbe) {
      return [
        t('rootCause.misc.pbProbe1'),
        t('rootCause.misc.pbProbe2'),
        t('rootCause.misc.pbProbe3'),
      ];
    }
    return [
      t('rootCause.misc.pbDefault1'),
      t('rootCause.misc.pbDefault2'),
      t('rootCause.misc.pbDefault3'),
    ];
  }, [groupedSymptoms, symptomsList, t]);

  // Danh sách dòng thời gian Lịch sử tự phục hồi (Timeline Data) - Phản ánh chính xác từ dữ liệu thực tế
  const timelineList = useMemo(() => {
    if (previousActionSteps.length > 0) {
      return previousActionSteps.map((st) => {
        let actionName = ACTION_DISPLAY_NAMES[st.code] || st.labelVi || st.code;
        if (st.code === 'SCALE_REPLICAS' || st.code === 'SCALE_UP') {
          actionName = st.replicaCount
            ? t('rootCause.timeline.scaleUpNameCount', { count: st.replicaCount })
            : t('rootCause.timeline.scaleUpName');
        } else if (st.code === 'SCALE_DOWN') {
          actionName = st.replicaCount
            ? t('rootCause.timeline.scaleDownNameCount', { count: st.replicaCount })
            : t('rootCause.timeline.scaleDownName');
        }
        return {
          stepIndex: st.stepIndex,
          code: st.code,
          actionName,
          statusBadge: getTimelineStatusBadge(st),
          shortReason: getTimelineShortReason(st.reason, st.code, st.isVerifiedSuccess, st.replicaCount),
          timeStr: st.timeStr || '--:--:--',
          metrics: st.metrics,
          rawReason: st.reason,
          replicaCount: st.replicaCount,
        };
      });
    }
    return [];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previousActionSteps, i18nInstance.language]);

  // Tổng số lần triệu chứng xảy ra
  const totalSymptomCount = useMemo(() => {
    if (groupedSymptoms.length === 0) return symptomsList.length || 0;
    return groupedSymptoms.reduce((sum, g) => sum + (g.count || 1), 0);
  }, [groupedSymptoms, symptomsList]);

  // Format thời gian phân tích
  const analyzedTimeFormatted = useMemo(() => {
    if (!analyzedAtStr) return t('common.unrecorded');
    const d = new Date(analyzedAtStr);
    if (isNaN(d.getTime())) return analyzedAtStr;
    const intlLocale = getIntlLocale(i18nInstance.language);
    const time = d.toLocaleTimeString(intlLocale, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const date = d.toLocaleDateString(intlLocale, { day: '2-digit', month: '2-digit', year: 'numeric' });
    return `~ ${time} (${date})`;
  }, [analyzedAtStr, t, i18nInstance.language]);

  // Nội dung tóm tắt Báo cáo SRE chuẩn Mockup
  const sreSummaryText = useMemo(() => {
    const isProbe = groupedSymptoms.some(g => g.title.includes('Probe')) || symptomsList.some(s => String(s).toLowerCase().includes('probe'));
    const isInsufficient = evidenceStatus === 'INSUFFICIENT_EVIDENCE' || isUnknown;
    if (isInsufficient) {
      if (isProbe) {
        return t('rootCause.sreReport.summaryInsufficientProbe', { service: serviceDisplayName });
      }
      return t('rootCause.sreReport.summaryInsufficient', { service: serviceDisplayName });
    }
    const rollbackDetail = recAction === 'ROLLBACK_DEPLOYMENT'
      ? t('rootCause.sreReport.rollbackDetail')
      : '';
    return t('rootCause.sreReport.summaryIdentified', {
      service: serviceDisplayName,
      cause: rootCauseTypeVi,
      action: recActionVi,
      rollback: rollbackDetail,
    });
  }, [groupedSymptoms, symptomsList, evidenceStatus, isUnknown, serviceDisplayName, rootCauseTypeVi, recActionVi, recAction, t]);

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
          maxWidth: '880px',
          height: '100vh',
          backgroundColor: '#FFFFFF',
          boxShadow: '-12px 0 40px rgba(15, 23, 42, 0.14)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'rcaSlideInRight 0.24s cubic-bezier(0.16, 1, 0.3, 1)',
          borderLeft: '1px solid #E2E8F0',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header - Gọn gàng, đồng bộ phong cách trắng + nhấn xanh ngọc của Dashboard */}
        <div
          style={{
            padding: '14px 20px',
            backgroundColor: '#FFFFFF',
            borderBottom: '1px solid #E2E8F0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '11px', minWidth: 0 }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '11px',
                backgroundColor: '#ECFDF5',
                border: '1px solid #A7F3D0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                boxShadow: '0 2px 6px rgba(16, 185, 129, 0.1)',
              }}
            >
              <GitBranch size={17} color="#059669" />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.015em', display: 'flex', alignItems: 'center', gap: '7px', flexWrap: 'wrap', lineHeight: 1.25 }}>
                <span>{t('rootCause.header.title')}</span>
                <span
                  title={incidentIdStr}
                  style={{
                    backgroundColor: '#F1F5F9',
                    color: '#334155',
                    border: '1px solid #E2E8F0',
                    padding: '1px 7px',
                    borderRadius: '6px',
                    fontSize: '0.68rem',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 700,
                  }}
                >
                  {incidentIdStr && incidentIdStr.length > 14 ? `INC-${incidentIdStr.slice(0, 8).toUpperCase()}` : incidentIdStr}
                </span>
                {occurrenceCount > 1 && (
                  <span
                    style={{
                      backgroundColor: '#FEF3C7',
                      color: '#B45309',
                      border: '1px solid #FDE68A',
                      padding: '1px 7px',
                      borderRadius: '6px',
                      fontSize: '0.68rem',
                      fontWeight: 700,
                    }}
                  >
                    {t('rootCause.header.recurrence', { count: occurrenceCount })}
                  </span>
                )}
              </div>
              <div style={{ fontSize: '0.73rem', color: '#64748B', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <span>
                  {t('rootCause.header.serviceLabel')} <strong style={{ color: '#047857', fontFamily: 'var(--font-mono)' }}>{serviceDisplayName}</strong>
                </span>
                <span style={{ color: '#CBD5E1' }}>&bull;</span>
                <span>
                  {t('rootCause.header.clusterLabel')} <strong style={{ color: '#0F172A', fontFamily: 'var(--font-mono)' }}>{clusterDisplayName || t('common.unidentified')}</strong>
                </span>
                {detectedEngine && detectedEngine !== t('common.unidentified') && (
                  <>
                    <span style={{ color: '#CBD5E1' }}>&bull;</span>
                    <span style={{ color: '#64748B', fontSize: '0.7rem' }}>{detectedEngine}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label={t('rootCause.header.closeAria')}
            style={{
              background: '#F8FAFC',
              border: '1px solid #E2E8F0',
              color: '#475569',
              cursor: 'pointer',
              width: '32px',
              height: '32px',
              borderRadius: '9px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              transition: 'all 0.15s ease',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Status Sub-bar gọn gàng */}
        <div
          style={{
            backgroundColor: '#F8FAFC',
            borderBottom: '1px solid #E2E8F0',
            padding: '8px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {/* Root cause badge */}
            <span
              style={{
                backgroundColor: (evidenceStatus === 'INSUFFICIENT_EVIDENCE' || isUnknown) ? '#FEF2F2' : '#ECFDF5',
                color: (evidenceStatus === 'INSUFFICIENT_EVIDENCE' || isUnknown) ? '#B91C1C' : '#047857',
                border: (evidenceStatus === 'INSUFFICIENT_EVIDENCE' || isUnknown) ? '1px solid #FECACA' : '1px solid #A7F3D0',
                borderRadius: '999px',
                padding: '2px 10px',
                fontSize: '0.72rem',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              {(evidenceStatus === 'INSUFFICIENT_EVIDENCE' || isUnknown) ? (
                <>
                  <AlertTriangle size={12} color="#DC2626" />
                  <span>{t('rootCause.statusSubbar.unknownCause')}</span>
                </>
              ) : (
                <span>{rootCauseTypeVi}</span>
              )}
            </span>

            <span style={{ color: '#CBD5E1' }}>|</span>

            {/* RCA confidence */}
            <span style={{ fontSize: '0.74rem', color: '#64748B' }}>
              {t('rootCause.statusSubbar.rcaConfidence')}{' '}
              <strong style={{ color: '#047857', fontFamily: 'var(--font-mono)' }}>
                {confidence !== null ? `${confidence}%` : t('common.notEvaluated')}
              </strong>
            </span>

            <span style={{ color: '#CBD5E1' }}>|</span>

            {/* Status */}
            <span style={{ fontSize: '0.74rem', color: '#64748B' }}>
              {t('rootCause.statusSubbar.status')}{' '}
              <strong style={{ color: modalStatus.color }}>
                {modalStatus.label}
              </strong>
            </span>
          </div>

          {/* Right: AI prediction pill -> bấm chuyển qua Tab 2 */}
          <button
            type="button"
            onClick={() => {
              setIsGruDrawerOpen(!isGruDrawerOpen);
              setActiveTab('io');
            }}
            title={t('rootCause.statusSubbar.aiRiskTooltip')}
            style={{
              backgroundColor: '#F5F3FF',
              color: '#6D28D9',
              border: '1px solid #DDD6FE',
              borderRadius: '999px',
              padding: '2px 10px',
              fontSize: '0.72rem',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              cursor: 'pointer',
            }}
          >
            <Activity size={12} color="#7C3AED" />
            <span>
              {t('rootCause.statusSubbar.aiRiskLabel')} <strong style={{ fontFamily: 'var(--font-mono)' }}>{gruPredictionConfidence !== null ? `${Math.round(gruPredictionConfidence * 100)}%` : '—'}</strong>
            </span>
          </button>
        </div>

        {/* Sub-navigation Tabs */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            backgroundColor: '#FFFFFF',
            borderBottom: '1px solid #E2E8F0',
            padding: '0 20px',
            gap: '6px',
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            style={{
              padding: '9px 12px',
              fontSize: '0.78rem',
              fontWeight: 700,
              color: activeTab === 'overview' ? '#047857' : '#64748B',
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
            <Sparkles size={13} />
            <span>{t('rootCause.tabs.overview')}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('io')}
            style={{
              padding: '9px 12px',
              fontSize: '0.78rem',
              fontWeight: 700,
              color: activeTab === 'io' ? '#047857' : '#64748B',
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
            <Database size={13} />
            <span>{t('rootCause.tabs.io')}</span>
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '0 24px 16px 24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', flex: '1 1 auto' }}>
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
                      {t('rootCause.urgentBanner.title')}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#B91C1C' }}>
                      {t('rootCause.urgentBanner.subtitle')}
                    </div>
                  </div>
                </div>
              )}

              {/* ======================================================== */}
              {/* CARD 1: THÔNG TIN SỰ CỐ (GỌN 1 KHỐI TÓM TẮT) */}
              {/* ======================================================== */}
              <div
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: '12px',
                  border: '1px solid #E2E8F0',
                  padding: '12px 15px',
                  boxShadow: '0 2px 10px rgba(15, 23, 42, 0.03)',
                }}
              >
                {incidentTitle && (
                  <div
                    data-testid="incident-title-banner"
                    style={{
                      backgroundColor: '#F8FAFC',
                      border: '1px solid #E2E8F0',
                      borderRadius: '8px',
                      padding: '7px 11px',
                      marginBottom: '10px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <Box size={14} color="#059669" style={{ flexShrink: 0 }} />
                    <span
                      style={{
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        color: '#0F172A',
                        wordBreak: 'break-word',
                        lineHeight: 1.4,
                      }}
                    >
                      {incidentTitle}
                    </span>
                  </div>
                )}

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                    gap: '10px 14px',
                    fontSize: '0.74rem',
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ color: '#94A3B8', fontSize: '0.66rem', fontWeight: 700, textTransform: 'uppercase' }}>
                      {realPodName ? t('rootCause.infoCard.podError') : t('rootCause.infoCard.workload')}
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#0F172A', marginTop: '2px', wordBreak: 'break-all' }}>
                      {realPodName || serviceDisplayName}
                    </div>
                  </div>

                  <div style={{ minWidth: 0 }}>
                    <div style={{ color: '#94A3B8', fontSize: '0.66rem', fontWeight: 700, textTransform: 'uppercase' }}>
                      {t('rootCause.infoCard.namespace')}
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#0F172A', marginTop: '2px' }}>
                      {namespaceName || 'default'}
                    </div>
                  </div>

                  <div style={{ minWidth: 0 }}>
                    <div style={{ color: '#94A3B8', fontSize: '0.66rem', fontWeight: 700, textTransform: 'uppercase' }}>
                      {t('rootCause.infoCard.node')}
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#0F172A', marginTop: '2px' }}>
                      {faultyNodeName || t('common.unidentified')}
                    </div>
                  </div>

                  <div style={{ minWidth: 0 }}>
                    <div style={{ color: '#94A3B8', fontSize: '0.66rem', fontWeight: 700, textTransform: 'uppercase' }}>
                      {t('rootCause.infoCard.typeStart')}
                    </div>
                    <div style={{ fontWeight: 700, color: '#0F172A', marginTop: '2px' }}>
                      {workloadKindRaw || 'Workload'}
                    </div>
                    <div style={{ fontSize: '0.66rem', color: '#64748B', fontFamily: 'var(--font-mono)' }}>
                      {analyzedTimeFormatted}
                    </div>
                  </div>
                </div>

                {/* Inline compact metadata chips có màu sắc phân định mức độ trực quan */}
                {(() => {
                  const getSeverityStyle = (sev) => {
                    const s = String(sev || '').toUpperCase();
                    if (s.includes('CRITICAL') || s.includes('KHẨN')) {
                      return { bg: '#FEF2F2', border: '#FECACA', label: '#991B1B', val: '#DC2626', dot: '#EF4444' };
                    }
                    if (s.includes('HIGH') || s.includes('CAO')) {
                      return { bg: '#FFF7ED', border: '#FED7AA', label: '#9A3412', val: '#EA580C', dot: '#F97316' };
                    }
                    if (s.includes('MED') || s.includes('TRUNG')) {
                      return { bg: '#FEFCE8', border: '#FEF08A', label: '#854D0E', val: '#D97706', dot: '#EAB308' };
                    }
                    if (s.includes('LOW') || s.includes('THẤP')) {
                      return { bg: '#EFF6FF', border: '#BFDBFE', label: '#1E40AF', val: '#2563EB', dot: '#3B82F6' };
                    }
                    return { bg: '#ECFDF5', border: '#A7F3D0', label: '#065F46', val: '#059669', dot: '#10B981' };
                  };

                  const getPriorityStyle = (pri) => {
                    const p = String(pri || '').toUpperCase();
                    if (p.includes('CRITICAL') || p.includes('KHẨN') || p === 'P1') {
                      return { bg: '#FEF2F2', border: '#FECACA', label: '#991B1B', val: '#DC2626', dot: '#EF4444' };
                    }
                    if (p.includes('HIGH') || p.includes('CAO') || p === 'P2') {
                      return { bg: '#FFF7ED', border: '#FED7AA', label: '#9A3412', val: '#EA580C', dot: '#F97316' };
                    }
                    if (p.includes('MED') || p.includes('TRUNG') || p === 'P3') {
                      return { bg: '#FEFCE8', border: '#FEF08A', label: '#854D0E', val: '#D97706', dot: '#EAB308' };
                    }
                    if (p.includes('LOW') || p.includes('THẤP') || p === 'P4') {
                      return { bg: '#F1F5F9', border: '#CBD5E1', label: '#475569', val: '#334155', dot: '#64748B' };
                    }
                    return { bg: '#F8FAFC', border: '#E2E8F0', label: '#64748B', val: '#0F172A', dot: '#94A3B8' };
                  };

                  const getRiskStyle = (risk) => {
                    const r = String(risk || '').toUpperCase();
                    if (r.includes('CRITICAL') || r.includes('KHẨN')) {
                      return { bg: '#FEF2F2', border: '#FECACA', label: '#991B1B', val: '#DC2626', dot: '#EF4444' };
                    }
                    if (r.includes('HIGH') || r.includes('CAO')) {
                      return { bg: '#FFF7ED', border: '#FED7AA', label: '#9A3412', val: '#EA580C', dot: '#F97316' };
                    }
                    if (r.includes('MED') || r.includes('TRUNG')) {
                      return { bg: '#FEFCE8', border: '#FEF08A', label: '#854D0E', val: '#D97706', dot: '#EAB308' };
                    }
                    if (r.includes('LOW') || r.includes('THẤP')) {
                      return { bg: '#ECFDF5', border: '#A7F3D0', label: '#065F46', val: '#059669', dot: '#10B981' };
                    }
                    return { bg: '#F8FAFC', border: '#E2E8F0', label: '#64748B', val: '#0F172A', dot: '#94A3B8' };
                  };

                  const sevStyle = getSeverityStyle(severityUpper || severityVi);
                  const priStyle = getPriorityStyle(actionPriority || actionPriorityVi);
                  const riskStyle = getRiskStyle(actionRiskLevel || actionRiskLevelVi);

                  return (
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', marginTop: '10px', paddingTop: '8px', borderTop: '1px solid #F1F5F9', fontSize: '0.69rem', color: '#64748B' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          padding: '2px 9px',
                          borderRadius: '6px',
                          backgroundColor: sevStyle.bg,
                          border: `1px solid ${sevStyle.border}`,
                          color: sevStyle.label,
                          fontWeight: 600,
                        }}
                      >
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: sevStyle.dot, flexShrink: 0 }} />
                        {t('rootCause.infoCard.severityPrefix')} <strong style={{ color: sevStyle.val, fontWeight: 800 }}>{severityVi}</strong>
                      </span>

                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          padding: '2px 9px',
                          borderRadius: '6px',
                          backgroundColor: priStyle.bg,
                          border: `1px solid ${priStyle.border}`,
                          color: priStyle.label,
                          fontWeight: 600,
                        }}
                      >
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: priStyle.dot, flexShrink: 0 }} />
                        {t('rootCause.infoCard.priorityPrefix')} <strong style={{ color: priStyle.val, fontWeight: 800 }}>{actionPriorityVi}</strong>
                      </span>

                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          padding: '2px 9px',
                          borderRadius: '6px',
                          backgroundColor: riskStyle.bg,
                          border: `1px solid ${riskStyle.border}`,
                          color: riskStyle.label,
                          fontWeight: 600,
                        }}
                      >
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: riskStyle.dot, flexShrink: 0 }} />
                        {t('rootCause.infoCard.riskPrefix')} <strong style={{ color: riskStyle.val, fontWeight: 800 }}>{actionRiskLevelVi}</strong>
                      </span>

                      {clusterSubLabel && (
                        <span style={{ padding: '2px 9px', borderRadius: '6px', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', color: '#475569', fontWeight: 600 }}>
                          {clusterSubLabel}
                        </span>
                      )}
                      {rawActionParams.pod_ip && (
                        <span style={{ padding: '2px 9px', borderRadius: '6px', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', fontFamily: 'var(--font-mono)', color: '#475569' }}>
                          {rawActionParams.pod_ip}:{rawActionParams.port || 8080}
                        </span>
                      )}
                    </div>
                  );
                })()}

                {/* Lỗi thực thi gần nhất (nếu có) */}
                {healingErrorMessage && (
                  <div style={{ marginTop: '8px', padding: '7px 11px', backgroundColor: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', fontSize: '0.74rem', color: '#B91C1C' }}>
                    <strong>{t('rootCause.infoCard.latestExecError')}</strong> {healingErrorMessage}
                  </div>
                )}
              </div>

              {/* ======================================================== */}
              {/* GRID 2 CỘT CÂN ĐỐI */}
              {/* ======================================================== */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
                  gap: '12px',
                  alignItems: 'start',
                }}
              >
                {/* CỘT TRÁI: TRIỆU CHỨNG & LỊCH SỬ PHỤC HỒI */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {/* CARD 2: TRIỆU CHỨNG CHÍNH */}
                  <div
                    style={{
                      backgroundColor: '#FFFFFF',
                      borderRadius: '12px',
                      border: '1px solid #E2E8F0',
                      padding: '12px 14px',
                      boxShadow: '0 2px 10px rgba(15, 23, 42, 0.03)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Activity size={15} color="#059669" />
                        <span>{t('rootCause.symptoms.title')}</span>
                      </div>
                      {groupedSymptoms.length > 0 && (
                        <span
                          style={{
                            backgroundColor: '#ECFDF5',
                            color: '#047857',
                            border: '1px solid #A7F3D0',
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            padding: '1px 8px',
                            borderRadius: '999px',
                          }}
                        >
                          {t('rootCause.symptoms.summaryBadge', { types: groupedSymptoms.length, total: totalSymptomCount })}
                        </span>
                      )}
                    </div>

                    {/* Danh sách Triệu chứng */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
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
                                borderRadius: '9px',
                                padding: '9px 11px',
                                backgroundColor: '#F8FAFC',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', flex: 1, minWidth: 0 }}>
                                  <div
                                    style={{
                                      width: '24px',
                                      height: '24px',
                                      borderRadius: '6px',
                                      backgroundColor: alertBg,
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      flexShrink: 0,
                                      marginTop: '1px',
                                    }}
                                  >
                                    <AlertTriangle size={13} color={alertColor} />
                                  </div>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                      <span style={{ fontWeight: 700, fontSize: '0.78rem', color: '#0F172A' }}>
                                        {grp.title}
                                      </span>
                                      <span
                                        style={{
                                          fontSize: '0.65rem',
                                          fontWeight: 700,
                                          padding: '1px 6px',
                                          borderRadius: '999px',
                                          backgroundColor: alertBg,
                                          color: alertColor,
                                          whiteSpace: 'nowrap',
                                        }}
                                      >
                                        {t('rootCause.symptoms.countBadge', { count: grp.count })}
                                      </span>
                                    </div>
                                    <div style={{ fontSize: '0.73rem', color: '#475569', marginTop: '2px', lineHeight: 1.38 }}>
                                      {grp.explanation}
                                    </div>
                                    <div style={{ fontSize: '0.67rem', color: '#94A3B8', marginTop: '2px', fontFamily: 'var(--font-mono)' }}>
                                      {t('rootCause.symptoms.podCountLine', { pod: grp.podName, count: grp.count })}
                                    </div>
                                  </div>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => toggleSymptomKey(grp.key)}
                                  aria-label={t('rootCause.symptoms.viewK8sAria')}
                                  style={{
                                    border: '1px solid #E2E8F0',
                                    backgroundColor: '#FFFFFF',
                                    borderRadius: '7px',
                                    padding: '3px 8px',
                                    fontSize: '0.68rem',
                                    fontWeight: 600,
                                    color: '#475569',
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    flexShrink: 0,
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  <span>
                                    {grp.errorSnippet?.includes('timeout') ? 'timeout' : (grp.errorSnippet || t('common.details'))}
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

                              {isExpanded && (
                                <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #E2E8F0' }}>
                                  {grp.records.map((rec, rIdx) => (
                                    <div key={rIdx} style={{ fontSize: '0.68rem', fontFamily: 'var(--font-mono, monospace)', backgroundColor: '#0B1120', color: '#E2E8F0', padding: '6px 8px', borderRadius: '6px', overflowX: 'auto', marginBottom: '4px' }}>
                                      {rec.rawLog || rec.originalText}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })
                      ) : (
                        <div style={{ fontSize: '0.75rem', color: '#64748B', padding: '6px 10px', backgroundColor: '#F8FAFC', borderRadius: '8px', border: '1px dashed #CBD5E1' }}>
                          {t('rootCause.symptoms.empty')}
                        </div>
                      )}
                    </div>

                    {/* Bằng chứng xác thực & Checklist thiếu */}
                    {(parsedEvidenceFor.length > 0 || missingEvidenceList.length > 0) && (
                      <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #F1F5F9', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {parsedEvidenceFor.length > 0 && (
                          <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '7px 10px', fontSize: '0.71rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '4px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                <CheckCircle2 size={13} color="#059669" />
                                <span style={{ fontWeight: 700, color: '#047857', backgroundColor: '#ECFDF5', padding: '1px 6px', borderRadius: '5px', fontSize: '0.66rem' }}>
                                  {t('rootCause.evidence.recordsBadge', { count: parsedEvidenceFor.length })}
                                </span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#475569', fontSize: '0.68rem' }}>
                                  {evidenceForSummary.map((item, idx) => (
                                    <span key={idx}>
                                      {t('rootCause.evidence.eventsByPod', { count: item.count, pod: item.podName })}
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
                                  borderRadius: '6px',
                                  padding: '2px 7px',
                                  fontSize: '0.66rem',
                                  fontWeight: 700,
                                  color: '#047857',
                                  cursor: 'pointer',
                                }}
                              >
                                {isExpandedEvidenceList ? t('rootCause.evidence.collapse') : t('rootCause.evidence.expandRaw', { count: parsedEvidenceFor.length })}
                              </button>
                            </div>

                            {isExpandedEvidenceList && (
                              <div style={{ marginTop: '6px', maxHeight: '140px', overflowY: 'auto' }}>
                                {parsedEvidenceFor.map((ev, eIdx) => (
                                  <div key={eIdx} style={{ fontSize: '0.66rem', fontFamily: 'var(--font-mono)', backgroundColor: '#FFFFFF', padding: '5px 7px', borderRadius: '5px', border: '1px solid #E2E8F0', marginBottom: '3px' }}>
                                    <div style={{ fontWeight: 700, color: '#047857' }}>
                                      {t('rootCause.evidence.recordHeader', { idx: eIdx + 1, pod: ev.podName || 'workload' })}
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

                        {missingEvidenceList.length > 0 && (
                          <div style={{ backgroundColor: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '8px', padding: '7px 10px', fontSize: '0.71rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '3px' }}>
                              <HelpCircle size={12} color="#D97706" />
                              <span style={{ fontWeight: 700, color: '#92400E', fontSize: '0.69rem' }}>
                                {t('rootCause.evidence.missingTitle')}
                              </span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                              {missingEvidenceList.map((item, idx) => {
                                const question = getChecklistQuestionText(item) || translateSREText(item);
                                return (
                                  <div key={idx} style={{ color: '#78350F', display: 'flex', alignItems: 'flex-start', gap: '5px', fontSize: '0.69rem' }}>
                                    <span style={{ fontWeight: 800, color: '#D97706' }}>•</span>
                                    <span>{question}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* CARD 4: LỊCH SỬ TỰ PHỤC HỒI */}
                  <div
                    style={{
                      backgroundColor: '#FFFFFF',
                      borderRadius: '12px',
                      border: '1px solid #E2E8F0',
                      padding: '12px 14px',
                      boxShadow: '0 2px 10px rgba(15, 23, 42, 0.03)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                      <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <History size={15} color="#059669" />
                        <span>{t('rootCause.timeline.title')}</span>
                      </div>
                      <span
                        style={{
                          backgroundColor: '#F1F5F9',
                          color: '#475569',
                          border: '1px solid #E2E8F0',
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          padding: '1px 8px',
                          borderRadius: '999px',
                        }}
                      >
                        {t('rootCause.timeline.actionsCount', { count: timelineList.length })}
                      </span>
                    </div>

                    {timelineList.length > 0 ? (
                      <>
                        <div style={{ display: 'flex', flexDirection: 'column', position: 'relative', paddingLeft: '6px' }}>
                          {timelineList.length > 1 && (
                            <div
                              style={{
                                position: 'absolute',
                                top: '12px',
                                bottom: '14px',
                                left: '16px',
                                width: '2px',
                                backgroundColor: '#D1FAE5',
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
                                padding: '6px 0',
                                position: 'relative',
                                zIndex: 2,
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0, flexWrap: 'wrap', rowGap: '4px' }}>
                                <div
                                  style={{
                                    width: '22px',
                                    height: '22px',
                                    borderRadius: '50%',
                                    backgroundColor: '#059669',
                                    color: '#FFFFFF',
                                    fontSize: '0.66rem',
                                    fontWeight: 800,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0,
                                  }}
                                >
                                  {st.stepIndex}
                                </div>
                                <span style={{ fontWeight: 700, fontSize: '0.78rem', color: '#0F172A', whiteSpace: 'normal', lineHeight: 1.35 }}>
                                  {st.actionName}
                                </span>
                                <span
                                  style={{
                                    fontSize: '0.65rem',
                                    fontWeight: 700,
                                    padding: '1px 7px',
                                    borderRadius: '999px',
                                    backgroundColor: st.statusBadge.bg,
                                    color: st.statusBadge.color,
                                    border: `1px solid ${st.statusBadge.border}`,
                                    whiteSpace: 'nowrap',
                                    flexShrink: 0,
                                  }}
                                >
                                  {st.statusBadge.label}
                                </span>
                              </div>
                              <span style={{ fontSize: '0.68rem', color: '#64748B', flexShrink: 0, whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)' }}>
                                {st.timeStr}
                              </span>
                            </div>
                          ))}
                        </div>

                        <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #F1F5F9' }}>
                          <button
                            type="button"
                            onClick={() => setIsTimelineExpanded(!isTimelineExpanded)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#047857',
                              fontSize: '0.73rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: 0,
                            }}
                          >
                            <span>{isTimelineExpanded ? t('rootCause.timeline.collapse') : t('rootCause.timeline.expand')}</span>
                          </button>

                          {isTimelineExpanded && (
                            <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              {timelineList.map((st, idx) => (
                                <div key={idx} style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '8px 10px', fontSize: '0.72rem' }}>
                                  <div style={{ fontWeight: 700, color: '#0F172A', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                    <span>{t('rootCause.timeline.stepTitle', { step: st.stepIndex, name: st.actionName, badge: st.statusBadge.label })}</span>
                                    {st.replicaCount && (
                                      <span style={{ backgroundColor: '#ECFDF5', color: '#047857', padding: '1px 6px', borderRadius: '5px', border: '1px solid #A7F3D0', fontSize: '0.67rem', fontWeight: 700 }}>
                                        {st.replicaCount} Pods
                                      </span>
                                    )}
                                  </div>
                                  <div style={{ color: '#64748B', lineHeight: 1.4 }}>
                                    {st.rawReason}
                                  </div>
                                  {(st.metrics || st.replicaCount) && (
                                    <div style={{ display: 'flex', gap: '5px', marginTop: '6px', flexWrap: 'wrap', fontFamily: 'var(--font-mono)', fontSize: '0.67rem' }}>
                                      {st.replicaCount && (
                                        <span style={{ backgroundColor: '#FFFFFF', color: '#047857', padding: '1px 6px', borderRadius: '4px', border: '1px solid #A7F3D0', fontWeight: 700 }}>
                                          {t('rootCause.timeline.podCountChip', { count: st.replicaCount })}
                                        </span>
                                      )}
                                      {st.metrics?.ram !== null && st.metrics?.ram !== undefined && (
                                        <span style={{ backgroundColor: '#FFFFFF', padding: '1px 6px', borderRadius: '4px', border: '1px solid #CBD5E1' }}>
                                          RAM: {st.metrics.ram}%
                                        </span>
                                      )}
                                      {st.metrics?.cpu !== null && st.metrics?.cpu !== undefined && (
                                        <span style={{ backgroundColor: '#FFFFFF', padding: '1px 6px', borderRadius: '4px', border: '1px solid #CBD5E1' }}>
                                          CPU: {st.metrics.cpu}%
                                        </span>
                                      )}
                                      {st.metrics?.restart !== null && st.metrics?.restart !== undefined && (
                                        <span style={{ backgroundColor: '#FFFFFF', padding: '1px 6px', borderRadius: '4px', border: '1px solid #CBD5E1' }}>
                                          Restart: {st.metrics.restart}
                                        </span>
                                      )}
                                      {st.metrics?.latency !== null && st.metrics?.latency !== undefined && (
                                        <span style={{ backgroundColor: '#FFFFFF', padding: '1px 6px', borderRadius: '4px', border: '1px solid #CBD5E1' }}>
                                          {t('rootCause.timeline.latencyLabel', { val: st.metrics.latency })}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </>
                    ) : (
                      <div style={{ fontSize: '0.74rem', color: '#64748B', padding: '10px 12px', backgroundColor: '#F8FAFC', borderRadius: '8px', border: '1px dashed #CBD5E1', lineHeight: 1.45 }}>
                        {isResolved
                          ? t('rootCause.timeline.emptyResolved')
                          : (recAction === 'NO_ACTION' || isUnknown || evidenceStatus === 'INSUFFICIENT_EVIDENCE'
                              ? t('rootCause.timeline.emptyNoAction')
                              : t('rootCause.timeline.emptyDefault'))}
                      </div>
                    )}
                  </div>
                </div>

                {/* CỘT PHẢI: QUYẾT ĐỊNH SELFAI & CẨM NANG KỸ SƯ */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {/* CARD 3: QUYẾT ĐỊNH CỦA SELFAI */}
                  <div
                    style={{
                      backgroundColor: '#FFFFFF',
                      borderRadius: '12px',
                      border: '1px solid #A7F3D0',
                      borderTop: '2.5px solid #059669',
                      padding: '12px 14px',
                      boxShadow: '0 2px 10px rgba(16, 185, 129, 0.06)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <ShieldCheck size={15} color="#059669" />
                        <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#0F172A' }}>
                          {t('rootCause.decision.title')}
                        </span>
                      </div>
                      <span
                        style={{
                          backgroundColor: recAction === 'NO_ACTION' || !recAction ? '#FFF7ED' : '#ECFDF5',
                          color: recAction === 'NO_ACTION' || !recAction ? '#C2410C' : '#047857',
                          border: recAction === 'NO_ACTION' || !recAction ? '1px solid #FDBA74' : '1px solid #A7F3D0',
                          borderRadius: '7px',
                          padding: '2px 10px',
                          fontSize: '0.74rem',
                          fontFamily: 'var(--font-mono)',
                          fontWeight: 800,
                        }}
                      >
                        {recAction || 'NO_ACTION'}
                      </span>
                    </div>

                    <div style={{ fontSize: '0.75rem', color: '#334155', lineHeight: 1.45 }}>
                      {previousActionSteps.length > 0 || isCircuitBreakerActive
                        ? t('rootCause.decision.circuitBreakerReason')
                        : isInsufficient
                          ? t('rootCause.decision.insufficientReason')
                          : (recReasonVi || t('rootCause.decision.noSafeAction'))}
                    </div>

                    {/* Rule Engine & Circuit Breaker Badges */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', paddingTop: '8px', borderTop: '1px solid #F1F5F9', fontSize: '0.71rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <span style={{ color: '#64748B' }}>Rule Engine</span>
                        <span
                          style={{
                            fontWeight: 800,
                            fontFamily: 'var(--font-mono)',
                            fontSize: '0.66rem',
                            padding: '1px 7px',
                            borderRadius: '5px',
                            backgroundColor: (recAction === 'NO_ACTION' || isInsufficient) ? '#FEF2F2' : '#ECFDF5',
                            color: (recAction === 'NO_ACTION' || isInsufficient) ? '#B91C1C' : '#047857',
                            border: (recAction === 'NO_ACTION' || isInsufficient) ? '1px solid #FECACA' : '1px solid #A7F3D0',
                          }}
                        >
                          {rawActionParams.rule_verdict || (recAction === 'NO_ACTION' ? 'BLOCK' : 'ALLOW')}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <span style={{ color: '#64748B' }}>Circuit Breaker</span>
                        <span
                          style={{
                            fontWeight: 800,
                            fontFamily: 'var(--font-mono)',
                            fontSize: '0.66rem',
                            padding: '1px 7px',
                            borderRadius: '5px',
                            backgroundColor: (isCircuitBreakerActive || isCircuitBreakerTripped) ? '#FEF2F2' : '#ECFDF5',
                            color: (isCircuitBreakerActive || isCircuitBreakerTripped) ? '#B91C1C' : '#047857',
                            border: (isCircuitBreakerActive || isCircuitBreakerTripped) ? '1px solid #FECACA' : '1px solid #A7F3D0',
                          }}
                        >
                          {(isCircuitBreakerActive || isCircuitBreakerTripped) ? 'OPEN' : 'CLOSED'}
                        </span>
                      </div>
                    </div>

                    {/* Dự báo rủi ro AI sớm */}
                    {predictedRisk && (
                      <div
                        style={{
                          padding: '8px 10px',
                          backgroundColor: '#FAF5FF',
                          border: '1px solid #E9D5FF',
                          borderRadius: '8px',
                          fontSize: '0.71rem',
                        }}
                      >
                        <div style={{ color: '#7E22CE', fontWeight: 700, fontSize: '0.66rem', marginBottom: '3px' }}>
                          {t('rootCause.decision.aiRiskRef')}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', color: '#581C87' }}>
                          <span style={{ fontWeight: 700 }}>{getGruRiskName(predictedRisk) || predictedRiskVi}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
                            <span style={{ fontFamily: 'var(--font-mono)', backgroundColor: '#FFFFFF', border: '1px solid #DDD6FE', padding: '1px 6px', borderRadius: '5px', fontSize: '0.64rem' }}>
                              {predictedRisk}
                            </span>
                            <span style={{ fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#7E22CE', fontSize: '0.72rem' }}>
                              {`${Math.round((gruPredictionConfidence ?? 0.965) * 100)}%`}
                            </span>
                          </div>
                        </div>
                        {predictedRisk === 'SCALE_DOWN_CANDIDATE' && (
                          <div style={{ color: '#6B21A8', fontSize: '0.65rem', marginTop: '3px', fontStyle: 'italic' }}>
                            {t('rootCause.decision.scaleDownWarning')}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* CARD 5: CẨM NANG THAO TÁC KỸ SƯ */}
                  <div
                    style={{
                      backgroundColor: '#FFFFFF',
                      borderRadius: '12px',
                      border: '1px solid #E2E8F0',
                      padding: '12px 14px',
                      boxShadow: '0 2px 10px rgba(15, 23, 42, 0.03)',
                      display: 'flex',
                      flexDirection: 'column',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                      <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <BookOpen size={15} color="#059669" />
                        <span>{t('rootCause.playbook.title')}</span>
                      </div>
                      <span style={{ fontSize: '0.66rem', fontWeight: 700, color: '#047857', backgroundColor: '#ECFDF5', border: '1px solid #A7F3D0', padding: '1px 7px', borderRadius: '999px' }}>
                        {isAiPlaybook ? t('rootCause.playbook.aiBadge') : t('rootCause.playbook.contextBadge')}
                      </span>
                    </div>

                    {/* Các bước xử lý (tự loại bỏ số thứ tự trùng lặp kiểu "1. 1.") */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '7px', marginBottom: '12px' }}>
                      {manualPlaybookSteps.map((stepText, sIdx) => {
                        const cleanStep = String(stepText || '').replace(/^\s*\d+\.\s*/, '');
                        return (
                          <div key={sIdx} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '0.75rem', color: '#334155', lineHeight: 1.45 }}>
                            <div
                              style={{
                                width: '19px',
                                height: '19px',
                                borderRadius: '50%',
                                backgroundColor: '#ECFDF5',
                                border: '1px solid #A7F3D0',
                                color: '#047857',
                                fontSize: '0.65rem',
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
                            <span>{cleanStep}</span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Button Xem lệnh chi tiết */}
                    <button
                      type="button"
                      onClick={() => setIsPlaybookExpanded(!isPlaybookExpanded)}
                      style={{
                        width: '100%',
                        backgroundColor: isPlaybookExpanded ? '#059669' : '#ECFDF5',
                        color: isPlaybookExpanded ? '#FFFFFF' : '#047857',
                        border: '1px solid #A7F3D0',
                        borderRadius: '9px',
                        padding: '8px 12px',
                        fontSize: '0.76rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <Terminal size={13} />
                      <span>{isPlaybookExpanded ? t('rootCause.playbook.hideCmd') : t('rootCause.playbook.showCmd')}</span>
                    </button>

                    {isPlaybookExpanded && (
                      <div style={{ marginTop: '10px', backgroundColor: '#0B1120', borderRadius: '8px', padding: '10px 12px', fontSize: '0.71rem', fontFamily: 'var(--font-mono, monospace)', color: '#E2E8F0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                          <span style={{ color: '#94A3B8', fontSize: '0.66rem' }}>{t('rootCause.playbook.cliComment')}</span>
                          <button
                            type="button"
                            onClick={() => handleCopyText(`kubectl logs ${kubectlNsFlag}${realPodName || serviceDisplayName} --tail=50\nkubectl describe pod ${kubectlNsFlag}${realPodName || serviceDisplayName}\nkubectl get pods ${kubectlNsFlag}`, 'playbook-cli')}
                            style={{ background: 'none', border: 'none', color: '#34D399', cursor: 'pointer', fontSize: '0.66rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '3px' }}
                          >
                            {copiedKey === 'playbook-cli' ? <Check size={11} color="#4ADE80" /> : <Copy size={11} />}
                            <span>{copiedKey === 'playbook-cli' ? t('common.copied') : t('rootCause.playbook.copyCmd')}</span>
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
              {/* CARD 6: BÁO CÁO SRE (TÓM TẮT GỌN) */}
              {/* ======================================================== */}
              <div
                style={{
                  backgroundColor: '#F8FAFC',
                  borderRadius: '12px',
                  border: '1px solid #E2E8F0',
                  padding: '12px 15px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <FileText size={15} color="#059669" />
                    <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#0F172A' }}>
                      {t('rootCause.sreReport.title')}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopyText(`${sreSummaryText}\n\n${fullExplanationVi}`, 'sre-report-copy')}
                    aria-label={t('rootCause.sreReport.copyAria')}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '4px 10px',
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      backgroundColor: '#FFFFFF',
                      border: '1px solid #CBD5E1',
                      borderRadius: '7px',
                      cursor: 'pointer',
                      color: '#334155',
                    }}
                  >
                    {copiedKey === 'sre-report-copy' ? <Check size={12} color="#059669" /> : <Copy size={12} />}
                    <span>{copiedKey === 'sre-report-copy' ? t('common.copied') : t('common.copy')}</span>
                  </button>
                </div>

                <div style={{ fontSize: '0.76rem', color: '#334155', lineHeight: 1.5 }}>
                  {sreSummaryText}
                </div>

                {fullExplanationVi && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '7px', paddingTop: '7px', borderTop: '1px dashed #CBD5E1' }}>
                    {fullExplanationVi.split('\n').filter(Boolean).map((line, idx) => (
                      <div key={idx} style={{ fontSize: '0.73rem', color: '#475569', lineHeight: 1.45 }}>
                        {line}
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          )}

          {/* TAB 2: VIỄN TRẮC & 7 ĐẦU RỦI RO AI */}
          {activeTab === 'io' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', paddingTop: '14px' }}>
              <div
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: '12px',
                  border: '1px solid #E2E8F0',
                  boxShadow: '0 2px 10px rgba(15, 23, 42, 0.03)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    padding: '10px 14px',
                    backgroundColor: '#F8FAFC',
                    borderBottom: '1px solid #E2E8F0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '8px',
                  }}
                >
                  <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Activity size={15} color="#7C3AED" />
                    <span>{t('rootCause.tabIo.headsTitle')}</span>
                  </div>
                  <span style={{ fontSize: '0.68rem', color: '#6D28D9', fontWeight: 700, backgroundColor: '#F5F3FF', border: '1px solid #DDD6FE', padding: '2px 9px', borderRadius: '999px' }}>
                    {t('rootCause.tabIo.thresholdBadge', { pct: (primaryThreshold * 100).toFixed(0) })}
                  </span>
                </div>

                <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
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
                              borderRadius: '9px',
                              backgroundColor: isTriggered ? '#FEF2F2' : '#F8FAFC',
                              border: isTriggered ? '1px solid #FECACA' : '1px solid #E2E8F0',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', marginBottom: '5px' }}>
                              <span style={{ fontSize: '0.74rem', fontWeight: 700, color: isTriggered ? '#DC2626' : '#0F172A' }}>
                                {getHeadName(headName) || headName}
                              </span>
                              <span style={{ fontSize: '0.68rem', fontFamily: 'var(--font-mono)', fontWeight: 700, color: isTriggered ? '#B91C1C' : '#64748B', whiteSpace: 'nowrap' }}>
                                {confPct}% / {thPct}%
                              </span>
                            </div>
                            <div style={{ width: '100%', height: '6px', backgroundColor: '#E2E8F0', borderRadius: '999px', overflow: 'hidden' }}>
                              <div
                                style={{
                                  width: `${Math.min(confPct, 100)}%`,
                                  height: '100%',
                                  backgroundColor: isTriggered ? '#DC2626' : '#059669',
                                  borderRadius: '999px',
                                  transition: 'width 0.3s ease',
                                }}
                              />
                            </div>
                            <div style={{ fontSize: '0.65rem', marginTop: '4px', fontWeight: 600, color: isTriggered ? '#991B1B' : '#64748B' }}>
                              {isTriggered ? t('rootCause.tabIo.exceeded') : t('rootCause.tabIo.withinSafe')}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div
                      style={{
                        padding: '10px 12px',
                        backgroundColor: '#F8FAFC',
                        border: '1px dashed #CBD5E1',
                        borderRadius: '8px',
                        fontSize: '0.75rem',
                        color: '#64748B',
                      }}
                    >
                      {t('rootCause.tabIo.noRiskOutputs')}
                    </div>
                  )}
                </div>
              </div>

              {/* BẢNG CHỈ SỐ VIỄN TRẮC ĐẦU VÀO */}
              <div
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: '12px',
                  border: '1px solid #E2E8F0',
                  boxShadow: '0 2px 10px rgba(15, 23, 42, 0.03)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    padding: '10px 14px',
                    backgroundColor: '#F8FAFC',
                    borderBottom: '1px solid #E2E8F0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '8px',
                  }}
                >
                  <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Sliders size={15} color="#059669" />
                    <span>{t('rootCause.tabIo.telemetryTitle')}</span>
                  </div>
                  <span style={{ fontSize: '0.68rem', color: '#047857', fontWeight: 700, backgroundColor: '#ECFDF5', border: '1px solid #A7F3D0', padding: '2px 9px', borderRadius: '999px', fontFamily: 'var(--font-mono)' }}>
                    {formattedTimesteps.length > 0 ? t('rootCause.tabIo.timestepsCount', { count: formattedTimesteps.length }) : t('rootCause.tabIo.noTelemetry')}
                  </span>
                </div>

                <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {formattedTimesteps.length === 0 && (
                    <div
                      style={{
                        padding: '10px 12px',
                        backgroundColor: '#F8FAFC',
                        border: '1px dashed #CBD5E1',
                        borderRadius: '8px',
                        fontSize: '0.75rem',
                        color: '#64748B',
                      }}
                    >
                      {t('rootCause.tabIo.noTelemetryDesc')}
                    </div>
                  )}
                  {metricSummary && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '8px' }}>
                      <div style={{ padding: '8px 10px', borderRadius: '9px', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderTop: '2px solid #10B981' }}>
                        <div style={{ fontSize: '0.64rem', fontWeight: 700, color: '#64748B' }}>CPU (%)</div>
                        <div style={{ fontSize: '0.9rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#0F172A', marginTop: '2px' }}>
                          {metricSummary.cpu.current}%
                        </div>
                        <div style={{ fontSize: '0.64rem', color: '#64748B' }}>{t('rootCause.tabIo.peakPrefix', { val: `${metricSummary.cpu.max}%` })}</div>
                      </div>

                      <div style={{ padding: '8px 10px', borderRadius: '9px', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderTop: '2px solid #3B82F6' }}>
                        <div style={{ fontSize: '0.64rem', fontWeight: 700, color: '#64748B' }}>RAM (%)</div>
                        <div style={{ fontSize: '0.9rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#0F172A', marginTop: '2px' }}>
                          {metricSummary.ram.current}%
                        </div>
                        <div style={{ fontSize: '0.64rem', color: '#64748B' }}>{t('rootCause.tabIo.peakPrefix', { val: `${metricSummary.ram.max}%` })}</div>
                      </div>

                      <div style={{ padding: '8px 10px', borderRadius: '9px', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderTop: '2px solid #F59E0B' }}>
                        <div style={{ fontSize: '0.64rem', fontWeight: 700, color: '#64748B' }}>DISK (%)</div>
                        <div style={{ fontSize: '0.9rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#0F172A', marginTop: '2px' }}>
                          {metricSummary.disk.current}%
                        </div>
                        <div style={{ fontSize: '0.64rem', color: '#64748B' }}>{t('rootCause.tabIo.peakPrefix', { val: `${metricSummary.disk.max}%` })}</div>
                      </div>

                      <div style={{ padding: '8px 10px', borderRadius: '9px', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderTop: '2px solid #8B5CF6' }}>
                        <div style={{ fontSize: '0.64rem', fontWeight: 700, color: '#64748B' }}>{t('rootCause.tabIo.latencyLabel')}</div>
                        <div style={{ fontSize: '0.9rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#0F172A', marginTop: '2px' }}>
                          {metricSummary.latency.current}ms
                        </div>
                        <div style={{ fontSize: '0.64rem', color: '#64748B' }}>{t('rootCause.tabIo.peakPrefix', { val: `${metricSummary.latency.max}ms` })}</div>
                      </div>

                      <div style={{ padding: '8px 10px', borderRadius: '9px', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderTop: '2px solid #06B6D4' }}>
                        <div style={{ fontSize: '0.64rem', fontWeight: 700, color: '#64748B' }}>REQ RATE</div>
                        <div style={{ fontSize: '0.9rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#0F172A', marginTop: '2px' }}>
                          {metricSummary.request_rate.current} <span style={{ fontSize: '0.65rem', fontWeight: 600 }}>r/s</span>
                        </div>
                        <div style={{ fontSize: '0.64rem', color: '#64748B' }}>{t('rootCause.tabIo.peakPrefix', { val: metricSummary.request_rate.max })}</div>
                      </div>

                      <div style={{ padding: '8px 10px', borderRadius: '9px', backgroundColor: metricSummary.http_5xx_rate.max > 0 ? '#FEF2F2' : '#F8FAFC', border: metricSummary.http_5xx_rate.max > 0 ? '1px solid #FECACA' : '1px solid #E2E8F0', borderTop: '2px solid #EF4444' }}>
                        <div style={{ fontSize: '0.64rem', fontWeight: 700, color: metricSummary.http_5xx_rate.max > 0 ? '#DC2626' : '#64748B' }}>{t('rootCause.tabIo.errors5xxLabel')}</div>
                        <div style={{ fontSize: '0.9rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#0F172A', marginTop: '2px' }}>
                          {metricSummary.http_5xx_rate.current}%
                        </div>
                        <div style={{ fontSize: '0.64rem', color: '#B91C1C' }}>{t('rootCause.tabIo.peakPrefix', { val: `${metricSummary.http_5xx_rate.max}%` })}</div>
                      </div>

                      <div style={{ padding: '8px 10px', borderRadius: '9px', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderTop: '2px solid #EC4899' }}>
                        <div style={{ fontSize: '0.64rem', fontWeight: 700, color: '#64748B' }}>RESTARTS</div>
                        <div style={{ fontSize: '0.9rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#0F172A', marginTop: '2px' }}>
                          {metricSummary.pod_restart_count}
                        </div>
                        <div style={{ fontSize: '0.64rem', color: '#64748B' }}>{t('rootCause.tabIo.k8sRestarts')}</div>
                      </div>

                      <div style={{ padding: '8px 10px', borderRadius: '9px', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderTop: '2px solid #6366F1' }}>
                        <div style={{ fontSize: '0.64rem', fontWeight: 700, color: '#64748B' }}>REPLICAS</div>
                        <div style={{ fontSize: '0.9rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#0F172A', marginTop: '2px' }}>
                          {metricSummary.replica_count}
                        </div>
                        <div style={{ fontSize: '0.64rem', color: '#64748B' }}>{t('rootCause.tabIo.clusterPods')}</div>
                      </div>
                    </div>
                  )}

                  {formattedTimesteps.length > 0 && (
                    <div style={{ overflowX: 'auto', border: '1px solid #E2E8F0', borderRadius: '9px' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.73rem', textAlign: 'center', fontFamily: 'var(--font-mono)' }}>
                        <thead>
                          <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#64748B', fontWeight: 700 }}>
                            <th style={{ padding: '6px 5px' }}>{t('rootCause.tabIo.colStep')}</th>
                            <th style={{ padding: '6px 5px' }}>{t('rootCause.tabIo.colTime')}</th>
                            <th style={{ padding: '6px 5px' }}>CPU</th>
                            <th style={{ padding: '6px 5px' }}>RAM</th>
                            <th style={{ padding: '6px 5px' }}>Disk</th>
                            <th style={{ padding: '6px 5px' }}>Req/s</th>
                            <th style={{ padding: '6px 5px' }}>{t('rootCause.tabIo.colLatency')}</th>
                            <th style={{ padding: '6px 5px' }}>5xx</th>
                            <th style={{ padding: '6px 5px' }}>Restarts</th>
                            <th style={{ padding: '6px 5px' }}>Pods</th>
                          </tr>
                        </thead>
                        <tbody>
                          {formattedTimesteps.map((row, idx) => (
                            <tr
                              key={idx}
                              style={{
                                borderBottom: '1px solid #F1F5F9',
                                backgroundColor: '#FFFFFF',
                              }}
                            >
                              <td style={{ padding: '5px', fontWeight: 700, color: '#047857', backgroundColor: '#ECFDF5' }}>
                                {row.stepLabel}
                              </td>
                              <td style={{ padding: '5px', color: '#64748B' }}>{row.displayTime || '-'}</td>
                              <td style={{ padding: '5px', color: row.cpu > 70 ? '#DC2626' : '#059669', fontWeight: row.cpu > 70 ? 700 : 500 }}>{row.cpu}%</td>
                              <td style={{ padding: '5px', color: '#2563EB' }}>{row.ram}%</td>
                              <td style={{ padding: '5px', color: '#D97706' }}>{row.disk}%</td>
                              <td style={{ padding: '5px', color: '#0891B2' }}>{row.request_rate}</td>
                              <td style={{ padding: '5px', color: row.latency > 100 ? '#D97706' : '#7C3AED' }}>{row.latency}ms</td>
                              <td style={{ padding: '5px', color: row.http_5xx_rate > 0 ? '#DC2626' : '#64748B' }}>{row.http_5xx_rate}%</td>
                              <td style={{ padding: '5px', color: row.pod_restart_count > 0 ? '#DC2626' : '#64748B' }}>{row.pod_restart_count}</td>
                              <td style={{ padding: '5px', color: '#334155', fontWeight: 600 }}>{row.replica_count}</td>
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
            {t('rootCause.footer.detectedAt')} {(() => {
              const rawDate = incidentDetail?.detected_at || incidentDetail?.created_at || incident?.detectedAt || incident?.created_at;
              if (!rawDate) return t('common.notRecorded');
              const d = new Date(rawDate);
              return isNaN(d.getTime()) ? String(rawDate) : d.toLocaleString(getIntlLocale(i18nInstance.language));
            })()}
            {occurrenceCount > 1 && (incidentDetail?.last_occurred_at || incident?.lastOccurredAt) && (() => {
              const rawLast = incidentDetail?.last_occurred_at || incident?.lastOccurredAt;
              const dLast = new Date(rawLast);
              const formattedLast = isNaN(dLast.getTime()) ? String(rawLast) : dLast.toLocaleString(getIntlLocale(i18nInstance.language));
              return t('rootCause.footer.lastOccurred', { time: formattedLast });
            })()}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
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
                cursor: 'pointer',
              }}
              title={t('rootCause.footer.copyJsonTitle')}
            >
              {copiedKey === 'raw_json' ? <Check size={13} color="#10B981" /> : <Copy size={13} />}
              <span>{copiedKey === 'raw_json' ? t('rootCause.footer.copiedJson') : t('rootCause.footer.copyJson')}</span>
            </button>

            {!isResolved && !resolveSuccess ? (
              <button
                type="button"
                onClick={handleConfirmResolve}
                disabled={isResolvingIncident}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '7px 16px',
                  backgroundColor: '#DC2626',
                  border: '1px solid #DC2626',
                  borderRadius: '8px',
                  fontSize: '0.8125rem',
                  fontWeight: 700,
                  color: '#FFFFFF',
                  cursor: isResolvingIncident ? 'not-allowed' : 'pointer',
                  opacity: isResolvingIncident ? 0.7 : 1,
                  boxShadow: '0 1px 3px rgba(220, 38, 38, 0.25)',
                  transition: 'all 0.15s ease',
                }}
                title={t('rootCause.footer.resolveTitle')}
              >
                {isResolvingIncident ? (
                  <RefreshCw size={13} className="animate-spin" />
                ) : (
                  <CheckCircle2 size={14} color="#FFFFFF" />
                )}
                <span>{isResolvingIncident ? t('rootCause.footer.resolving') : t('rootCause.footer.resolveBtn')}</span>
              </button>
            ) : (
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '6px 14px',
                  backgroundColor: '#DCFCE7',
                  border: '1px solid #86EFAC',
                  borderRadius: '8px',
                  fontSize: '0.78125rem',
                  fontWeight: 700,
                  color: '#15803D',
                }}
              >
                <CheckCircle2 size={13} color="#15803D" />
                <span>{t('rootCause.footer.resolvedBadge')}</span>
              </div>
            )}

            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '7px 16px',
                backgroundColor: '#F1F5F9',
                border: '1px solid #CBD5E1',
                borderRadius: '8px',
                fontSize: '0.8125rem',
                fontWeight: 700,
                color: '#475569',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {t('common.closeWindow')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RootCauseModal;
