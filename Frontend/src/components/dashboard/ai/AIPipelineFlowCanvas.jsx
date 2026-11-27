import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import i18nInstance, { normalizeLanguage } from '../../../i18n';
import BranchedPipelineSection from './BranchedPipelineSection';
import AIPipelineMobileVerticalFlow from './AIPipelineMobileVerticalFlow';
import {
  translateIncidentTitle,
  translateSeverity,
  ACTION_DISPLAY_NAMES_VI,
} from '../../../pages/Dashboard/Incidents/incidentUtils';
import {
  Cpu,
  Server,
  HardDrive,
  Clock,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Sparkles,
  ShieldCheck,
  ShieldAlert,
  Zap,
  FileText,
  Activity,
  History,
  ScrollText,
  RefreshCw,
  ExternalLink,
  X,
  ArrowRight,
  Layers,
} from 'lucide-react';

const extractBlockedIp = (item) => {
  if (!item) return null;
  let ip =
    item?.result?.details?.blocked_ip ||
    item?.details?.blocked_ip ||
    item?.result?.params?.ip ||
    item?.result?.params?.source_ip ||
    item?.result?.params?.blocked_ip ||
    item?.params?.ip ||
    item?.params?.source_ip ||
    item?.params?.blocked_ip ||
    item?.result?.blocked_ip ||
    item?.blocked_ip ||
    (item?.result?.details?.ip_cidr ? String(item.result.details.ip_cidr).split('/')[0] : null);

  if (!ip) {
    const combined = [
      item?.result?.message,
      item?.message,
      item?.incident_title,
      item?.title,
      item?.description,
      item?.incident_description,
      item?.reason,
      item?.reasoning,
      item?.policy_name,
    ]
      .filter(Boolean)
      .join(' ');
    const match = combined.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/);
    if (match) {
      ip = match[0];
    } else {
      const dashMatch = combined.match(/\bblock-ip-(\d{1,3})-(\d{1,3})-(\d{1,3})-(\d{1,3})\b/);
      if (dashMatch) {
        ip = `${dashMatch[1]}.${dashMatch[2]}.${dashMatch[3]}.${dashMatch[4]}`;
      }
    }
  }
  return ip ? String(ip).trim() : null;
};

const translateActionToVi = (rawAction, item = null) => {
  if (!rawAction) return '';
  const trimmed = String(rawAction).trim();
  const normalizedCode = trimmed.toUpperCase().replace(/[\s-]+/g, '_');
  const isVi = normalizeLanguage(i18nInstance.language) === 'vi';

  if (
    normalizedCode === 'BLOCK_IP_TEMP' ||
    normalizedCode === 'TEMPORARY_IP_BLOCK' ||
    normalizedCode === 'BLOCK_IP' ||
    normalizedCode === 'IP_BLOCK' ||
    normalizedCode.includes('BLOCK_IP') ||
    trimmed.toLowerCase().includes('chặn ip')
  ) {
    const ip = extractBlockedIp(item);
    return ip
      ? i18nInstance.t('dashboard:pipeline.actions.BLOCK_IP_SPECIFIC', { ip })
      : i18nInstance.t('dashboard:pipeline.actions.BLOCK_IP_TEMP');
  }

  if (normalizedCode === 'NO_ACTION') {
    return i18nInstance.t('dashboard:pipeline.actions.NO_ACTION_circuit');
  }

  if (isVi && ACTION_DISPLAY_NAMES_VI[normalizedCode]) {
    return ACTION_DISPLAY_NAMES_VI[normalizedCode];
  }

  const mappedCode = i18nInstance.t(`dashboard:pipeline.actions.${normalizedCode}`, { defaultValue: '' });
  if (mappedCode) return mappedCode;

  const lower = trimmed.toLowerCase();
  if (lower === 'replace pod') return i18nInstance.t('dashboard:pipeline.actions.REPLACE_POD');
  if (lower === 'restart pod') return i18nInstance.t('dashboard:pipeline.actions.RESTART_POD');
  if (lower === 'scale replicas' || lower === 'scale pod') return i18nInstance.t('dashboard:pipeline.actions.SCALE_REPLICAS');
  if (lower === 'scale up') return i18nInstance.t('dashboard:pipeline.actions.SCALE_UP');
  if (lower === 'scale down') return i18nInstance.t('dashboard:pipeline.actions.SCALE_DOWN');
  if (lower === 'restart deployment') return i18nInstance.t('dashboard:pipeline.actions.RESTART_DEPLOYMENT');
  if (lower === 'rollback deployment') return i18nInstance.t('dashboard:pipeline.actions.ROLLBACK_DEPLOYMENT');
  if (lower === 'drain node') return i18nInstance.t('dashboard:pipeline.actions.DRAIN_NODE');
  if (lower === 'cleanup storage' || lower === 'cleanup temp files') return i18nInstance.t('dashboard:pipeline.actions.CLEANUP_STORAGE');
  if (lower === 'temporary ip block' || lower === 'block ip temp') return i18nInstance.t('dashboard:pipeline.actions.BLOCK_IP_TEMP');
  return trimmed;
};

const translateExecutionStatusVi = (status) => {
  const s = String(status || '').toUpperCase();
  if (s === 'SUCCEEDED' || s === 'COMPLETED') return i18nInstance.t('dashboard:pipeline.execStatus.SUCCEEDED');
  if (s === 'FAILED') return i18nInstance.t('dashboard:pipeline.execStatus.FAILED');
  if (s === 'RUNNING') return i18nInstance.t('dashboard:pipeline.execStatus.RUNNING');
  if (s === 'PENDING') return i18nInstance.t('dashboard:pipeline.execStatus.PENDING');
  if (s === 'CANCELLED') return i18nInstance.t('dashboard:pipeline.execStatus.CANCELLED');
  return status || '';
};

/**
 * AIPipelineFlowCanvas
 * Giao diện trực quan hóa toàn bộ luồng AI Tự Phục Hồi (Node-based Workflow Canvas):
 * - Giai đoạn 1: 6 Khối đầu vào viễn trắc (Metric Inputs)
 * - Giai đoạn 2: Khối trung tâm GRU Deep Learning Hub tích hợp Biểu đồ sóng 12 bước (T1..T12)
 * - Giai đoạn 3: 7 Đầu ra dự báo rủi ro (GRU 7-Head Outputs)
 * - Giai đoạn 4 (Extended): Đa Tác Tử Phân Tích Nguyên Nhân Gốc (Multi-Agent RCA & Incident)
 * - Giai đoạn 5 (Extended): Bộ Đánh Giá Chính Sách & Rào Chắn An Toàn (Policy Engine)
 * - Giai đoạn 6 (Extended): 3 Nhánh Điều Phối (AUTO K8s Agent / Cổng duyệt HITL / Circuit Breaker & Audit)
 * - Giai đoạn 7 (Extended): Hậu Kiểm Phục Hồi 60s & Tự Đóng Sự Cố (Recovery Verification + Feedback Loop)
 */
export const AIPipelineFlowCanvas = ({
  selectedService = '',
  seriesSummaries = [],
  prediction = null,
  currentActiveStep = 12,
  totalSteps = 12,
  isAgentConnected = true,
  timesteps = [],
  activeSeriesList = [],
  scaleMode = 'standard',
  isFullScreen = false,
  showExtendedPipeline = false,
  defaultViewMode = 'all',
  topSafePadding = 0,
  pipelineContext = null,
  podCount = 1,
  onNavigate = null,
}) => {
  const { t, i18n } = useTranslation('dashboard');
  const localizedIncidentTitle = (text) => {
    if (!text) return '';
    return normalizeLanguage(i18n.language) === 'en' ? String(text) : translateIncidentTitle(text);
  };
  const localizedSeverity = (sev) => {
    if (!sev) return '';
    const upper = String(sev).toUpperCase();
    return normalizeLanguage(i18n.language) === 'en'
      ? t(`pipeline.severity.${upper}`, { defaultValue: upper })
      : translateSeverity(sev);
  };

  // State điều khiển Pan & Zoom (theo chuẩn infinite canvas Google Stitch / Figma)
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isWheelZooming, setIsWheelZooming] = useState(false);
  const wheelTimeoutRef = useRef(null);
  const cameraRef = useRef({ zoom: 1, pan: { x: 0, y: 0 }, autoScale: 1, width: 1000, height: 600 });
  const [activeViewMode, setActiveViewMode] = useState(() =>
    showExtendedPipeline ? defaultViewMode : 'all'
  ); // 'all' | 'gru' | 'healing'
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const dragOriginRef = useRef({ x: 0, y: 0 });
  const didDragRef = useRef(false);
  const hasUserMovedCameraRef = useRef(false);
  const [hasMeasuredContainer, setHasMeasuredContainer] = useState(false);
  const [hoveredEdge, setHoveredEdge] = useState(null);
  const [hoveredNode, setHoveredNode] = useState(null);
  const [hoveredInspector, setHoveredInspector] = useState(null);
  const [pinnedInspector, setPinnedInspector] = useState(null);
  // Cho phép mở/gập độc lập từng nhóm nhánh (mở nhóm này KHÔNG tự ẩn các nhóm khác)
  const [expandedGroups, setExpandedGroups] = useState({
    telemetry: false,
    rule: false,
    risks: false,
    branches: false,
  });
  // Chuyển đổi giữa Sơ đồ 1 (Tổng quan) và Sơ đồ 2 (Rẽ nhánh chi tiết 01→07)
  const [activeDiagram, setActiveDiagram] = useState('diagram1'); // 'diagram1' | 'diagram2'
  const [preferHorizontalOnMobile, setPreferHorizontalOnMobile] = useState(false);
  // Trạng thái độc lập cho Sơ đồ 2 (không ảnh hưởng Sơ đồ 1)
  const [d2TelemetryExpanded, setD2TelemetryExpanded] = useState(false);
  const [d2RuleExpanded, setD2RuleExpanded] = useState(false);
  const [d2RisksExpanded, setD2RisksExpanded] = useState(false);
  const [d2CausesExpanded, setD2CausesExpanded] = useState(false);
  const [d2ActionsExpanded, setD2ActionsExpanded] = useState(false);
  const [d2SimulatedCause, setD2SimulatedCause] = useState(null);
  const [d2VerifyOutcome, setD2VerifyOutcome] = useState('auto');
  const isTelemetryExpanded = !showExtendedPipeline || expandedGroups.telemetry;
  const isRuleExpanded = expandedGroups.rule;
  const isRisksExpanded = !showExtendedPipeline || expandedGroups.risks;
  const isBranchesExpanded = expandedGroups.branches;

  const toggleExpandGroup = (e, groupId) => {
    if (e) e.stopPropagation();
    didDragRef.current = false;
    setPinnedInspector(null);
    setHoveredInspector(null);
    setExpandedGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
  };
  const containerRef = useRef(null);
  const popoverRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(1000);
  const [containerHeight, setContainerHeight] = useState(600);
  const [isDraggingInspector, setIsDraggingInspector] = useState(false);
  const inspectorDragStartRef = useRef({ mouseX: 0, mouseY: 0, popX: 0, popY: 0, hasMoved: false });

  // Đóng cửa sổ chi tiết đã ghim khi click bên ngoài hoặc nhấn phím Escape
  useEffect(() => {
    if (!pinnedInspector) return;
    const handleOutsideClick = (e) => {
      if (isDraggingInspector || inspectorDragStartRef.current?.hasMoved) return;
      if (popoverRef.current && popoverRef.current.contains(e.target)) return;
      if (e.target.closest && e.target.closest('[data-inspector-trigger="true"]')) return;
      setPinnedInspector(null);
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setPinnedInspector(null);
    };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [pinnedInspector, isDraggingInspector]);

  // Cho phép kéo di chuyển cửa sổ chi tiết (Draggable Inspector) sang bất kỳ vị trí nào để không che khuất sơ đồ
  const handleInspectorHeaderMouseDown = (e) => {
    if (!pinnedInspector) return;
    if (e.button !== 0) return;
    if (e.target.closest('button') || e.target.closest('a')) return;
    e.stopPropagation();

    inspectorDragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      popX: pinnedInspector.x,
      popY: pinnedInspector.y,
      hasMoved: false,
    };
    setIsDraggingInspector(true);
  };

  useEffect(() => {
    if (!isDraggingInspector) return;

    const handleMouseMove = (e) => {
      const dx = e.clientX - inspectorDragStartRef.current.mouseX;
      const dy = e.clientY - inspectorDragStartRef.current.mouseY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        inspectorDragStartRef.current.hasMoved = true;
      }
      const cRect = containerRef.current?.getBoundingClientRect();
      const popW = 340;
      const maxX = cRect ? Math.max(10, cRect.width - popW - 14) : 2000;
      const maxY = cRect ? Math.max(20, cRect.height - 60) : 1000;
      const minY = Math.max(10, topSafePadding + 6);

      const nextX = Math.max(10, Math.min(maxX, inspectorDragStartRef.current.popX + dx));
      const nextY = Math.max(minY, Math.min(maxY, inspectorDragStartRef.current.popY + dy));

      setPinnedInspector((prev) => (prev ? { ...prev, x: nextX, y: nextY, isCustomMoved: true } : prev));
    };

    const handleMouseUp = () => {
      setIsDraggingInspector(false);
      setTimeout(() => {
        if (inspectorDragStartRef.current) {
          inspectorDragStartRef.current.hasMoved = false;
        }
      }, 60);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingInspector, topSafePadding]);

  // Tính vị trí hiển thị cửa sổ chi tiết bên cạnh khối (tự động lật trái/phải và chống tràn mép màn hình)
  const computeInspectorAnchor = (e) => {
    if (!containerRef.current || !e?.currentTarget) return { x: 24, y: 80, side: 'right' };
    const cRect = containerRef.current.getBoundingClientRect();
    const elRect = e.currentTarget.getBoundingClientRect();
    const popW = 375;
    const popH = 520;
    const gap = 12;

    const relLeft = elRect.left - cRect.left;
    const relRight = elRect.right - cRect.left;
    const relTop = elRect.top - cRect.top;
    const relCenterY = relTop + elRect.height / 2;

    let side = 'right';
    let x = relRight + gap;
    if (x + popW > cRect.width - 14) {
      side = 'left';
      x = relLeft - popW - gap;
    }
    if (x < 14) {
      x = Math.max(14, Math.min(relLeft, cRect.width - popW - 14));
    }

    let y = relCenterY - popH / 2;
    const minY = Math.max(14, topSafePadding + 6);
    const maxY = Math.max(minY, cRect.height - popH - 16);
    y = Math.max(minY, Math.min(y, maxY));

    return { x: Math.round(x), y: Math.round(y), side };
  };

  const handleInspectorHover = (e, id) => {
    const pos = computeInspectorAnchor(e);
    setHoveredInspector({ id, ...pos });
  };

  const handleInspectorLeave = (id) => {
    setHoveredInspector((prev) => (prev && prev.id === id ? null : prev));
  };

  const handleInspectorClick = (e, id) => {
    e.stopPropagation();
    if (didDragRef.current) return;
    const pos = computeInspectorAnchor(e);
    setPinnedInspector((prev) => (prev && prev.id === id ? null : { id, ...pos }));
  };

  // Tự động đo kích thước khung cha để tự co giãn vừa khít (Auto-fit to Container)
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
          setContainerWidth(entry.contentRect.width);
          setContainerHeight(entry.contentRect.height);
          setHasMeasuredContainer(true);
        }
      }
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Tỷ lệ co giãn tự động để vừa khít 100% khung màn hình theo Sơ đồ đang hiển thị (Sơ đồ 1: 2240x760 | Sơ đồ 2 có 00 Service: 4090x1230)
  const isDiagram2Active = showExtendedPipeline && activeDiagram === 'diagram2';
  const baseCanvasW = showExtendedPipeline ? (isDiagram2Active ? 4090 : 2240) : 1000;
  const baseCanvasH = showExtendedPipeline ? (isDiagram2Active ? 1230 : 760) : 550;
  const autoScale = useMemo(() => {
    if (!containerWidth) return 1;
    if (isFullScreen && containerHeight > 0) {
      const scaleW = (containerWidth - 36) / baseCanvasW;
      const scaleH = Math.max(containerHeight - topSafePadding - 32, 300) / baseCanvasH;
      const scale = Math.min(scaleW, scaleH);
      const minScale = showExtendedPipeline ? (isDiagram2Active ? 0.14 : 0.28) : 0.55;
      return Math.min(Math.max(scale, minScale), 1.45);
    }
    return Math.min(Math.max(containerWidth / baseCanvasW, 0.65), 1.6);
  }, [containerWidth, containerHeight, isFullScreen, baseCanvasW, baseCanvasH, isDiagram2Active, showExtendedPipeline, topSafePadding]);

  // Ánh xạ chuẩn 8 chiều dữ liệu viễn trắc của mô hình GRU [12×8]
  const METRIC_CONFIGS = useMemo(() => [
    {
      key: 'cpu',
      name: t('pipeline.metrics.cpuName'),
      label: t('pipeline.metrics.cpuLabel'),
      icon: Cpu,
      color: '#10B981', // Emerald
      bgColor: '#ECFDF5',
      borderColor: '#A7F3D0',
      unit: '%',
      threshold: 80,
    },
    {
      key: 'ram',
      name: t('pipeline.metrics.ramName'),
      label: t('pipeline.metrics.ramLabel'),
      icon: Server,
      color: '#3B82F6', // Blue
      bgColor: '#EFF6FF',
      borderColor: '#BFDBFE',
      unit: '%',
      threshold: 80,
    },
    {
      key: 'disk',
      name: t('pipeline.metrics.diskName'),
      label: t('pipeline.metrics.diskLabel'),
      icon: HardDrive,
      color: '#F59E0B', // Amber
      bgColor: '#FFFBEB',
      borderColor: '#FDE68A',
      unit: '%',
      threshold: 85,
    },
    {
      key: 'latency',
      name: t('pipeline.metrics.latencyName'),
      label: t('pipeline.metrics.latencyLabel'),
      icon: Clock,
      color: '#8B5CF6', // Purple
      bgColor: '#F5F3FF',
      borderColor: '#DDD6FE',
      unit: 'ms',
      threshold: 800,
    },
    {
      key: 'request_rate',
      name: t('pipeline.metrics.reqName'),
      label: t('pipeline.metrics.reqLabel'),
      icon: TrendingUp,
      color: '#06B6D4', // Cyan
      bgColor: '#ECFEFF',
      borderColor: '#A5F3FC',
      unit: 'Req/s',
      threshold: 100,
    },
    {
      key: 'http_5xx_rate',
      name: t('pipeline.metrics.err5xxName'),
      label: t('pipeline.metrics.err5xxLabel'),
      icon: AlertTriangle,
      color: '#EF4444', // Red
      bgColor: '#FEF2F2',
      borderColor: '#FECACA',
      unit: '%',
      threshold: 5,
    },
    {
      key: 'pod_restart_count',
      name: t('pipeline.metrics.restartName'),
      label: t('pipeline.metrics.restartLabel'),
      icon: RotateCcw,
      color: '#F97316', // Orange
      bgColor: '#FFF7ED',
      borderColor: '#FFEDD5',
      unit: t('pipeline.metrics.restartUnit'),
      threshold: 1,
    },
    {
      key: 'replica_count',
      name: t('pipeline.metrics.replicaName'),
      label: t('pipeline.metrics.replicaLabel'),
      icon: Layers,
      color: '#6366F1', // Indigo
      bgColor: '#EEF2FF',
      borderColor: '#E0E7FF',
      unit: t('pipeline.metrics.replicaUnit'),
      threshold: 999,
    },
  ], [t]);

  // Ánh xạ 7 đầu ra rủi ro AI đồng bộ 100% với bảng "Hồ Sơ Xác Suất Rủi Ro"
  const ACTION_OUTCOME_NODES = useMemo(() => [
    {
      id: 'cpu_overload',
      title: t('pipeline.riskNodes.cpu_overload'),
      riskKey: 'CPU_OVERLOAD',
      threshold: 0.81,
    },
    {
      id: 'oom_risk',
      title: t('pipeline.riskNodes.oom_risk'),
      riskKey: 'OOM',
      threshold: 0.50,
    },
    {
      id: 'high_latency',
      title: t('pipeline.riskNodes.high_latency'),
      riskKey: 'HIGH_LATENCY',
      threshold: 0.62,
    },
    {
      id: 'disk_full',
      title: t('pipeline.riskNodes.disk_full'),
      riskKey: 'DISK_FULL',
      threshold: 0.85,
    },
    {
      id: '5xx_spike',
      title: t('pipeline.riskNodes.5xx_spike'),
      riskKey: 'HTTP_5XX_SPIKE',
      threshold: 0.81,
    },
    {
      id: 'traffic_spike',
      title: t('pipeline.riskNodes.traffic_spike'),
      riskKey: 'TRAFFIC_OVERLOAD',
      threshold: 0.85,
    },
    {
      id: 'scale_down',
      title: t('pipeline.riskNodes.scale_down'),
      riskKey: 'SCALE_DOWN_CANDIDATE',
      threshold: 0.70,
    },
  ], [t]);

  // Nạp dữ liệu thực tế từ seriesSummaries & timesteps (khi mất kết nối Agent / Cụm -> toàn bộ hiển thị về 0.00)
  const liveMetrics = useMemo(() => {
    const map = {};
    for (const cfg of METRIC_CONFIGS) {
      if (!isAgentConnected) {
        map[cfg.key] = {
          latest: '0.00',
          avg: '0.00',
          max: '0.00',
          isWarning: false,
        };
        continue;
      }
      const summary = seriesSummaries.find(
        (s) =>
          s.key === cfg.key ||
          (cfg.key === 'http_5xx_rate' && (s.key === 'error_5xx' || s.key === 'http_5xx_rate')) ||
          (cfg.key === 'pod_restart_count' && (s.key === 'restarts' || s.key === 'restart_count' || s.key === 'pod_restart_count')) ||
          (cfg.key === 'replica_count' && (s.key === 'replicas' || s.key === 'pod_count' || s.key === 'replica_count'))
      );

      let latestNum = summary && summary.latest != null ? parseFloat(summary.latest) : null;
      let avgNum = summary && summary.avg != null ? parseFloat(summary.avg) : null;
      let maxNum = summary && summary.max != null ? parseFloat(summary.max) : null;

      if (cfg.key === 'replica_count' && podCount > 0) {
        const repVal = Number(podCount);
        latestNum = repVal;
        avgNum = repVal;
        maxNum = repVal;
      }

      if (
        latestNum === null || isNaN(latestNum) ||
        avgNum === null || isNaN(avgNum) ||
        maxNum === null || isNaN(maxNum)
      ) {
        if (timesteps && timesteps.length > 0) {
          const vals = timesteps.map((t) => {
            if (cfg.key === 'http_5xx_rate') return Number(t.http_5xx_rate ?? t.error_5xx ?? 0);
            if (cfg.key === 'pod_restart_count') return Number(t.pod_restart_count ?? t.restarts ?? 0);
            if (cfg.key === 'replica_count') return Number(t.replica_count ?? t.replicas ?? podCount ?? 1);
            return Number(t[cfg.key] ?? 0);
          });
          const validVals = vals.filter((v) => !isNaN(v));
          latestNum = validVals[validVals.length - 1] ?? 0;
          maxNum = validVals.length > 0 ? Math.max(...validVals) : 0;
          avgNum = validVals.length > 0 ? validVals.reduce((a, b) => a + b, 0) / validVals.length : 0;
        } else if (cfg.key === 'replica_count') {
          const repVal = Number(podCount || pipelineContext?.replicaCount || 1);
          latestNum = repVal;
          avgNum = repVal;
          maxNum = repVal;
        } else {
          latestNum = 0;
          avgNum = 0;
          maxNum = 0;
        }
      }

      latestNum = Number(latestNum || 0);
      avgNum = Number(avgNum || 0);
      maxNum = Number(maxNum || 0);

      const fmtVal = (num, rawStr) => {
        if (rawStr != null && rawStr !== '') return String(rawStr);
        if (num == null || isNaN(num)) return '0.00';
        return Number.isInteger(num) ? String(num) : num.toFixed(2);
      };

      map[cfg.key] = {
        latest: fmtVal(latestNum, summary?.latest),
        avg: fmtVal(avgNum, summary?.avg),
        max: fmtVal(maxNum, summary?.max),
        isWarning: latestNum >= cfg.threshold,
      };
    }
    return map;
  }, [METRIC_CONFIGS, seriesSummaries, isAgentConnected, timesteps, podCount, pipelineContext?.replicaCount]);

  // Trích xuất ngữ cảnh sự cố từ pipelineContext để các tầng suy luận sử dụng
  const latestIncident = isAgentConnected ? (pipelineContext?.latestIncident || null) : null;
  const lastResolvedIncident = isAgentConnected ? (pipelineContext?.lastResolvedIncident || null) : null;
  const openServiceIncidentsCount = isAgentConnected ? (pipelineContext?.openServiceIncidentsCount || 0) : 0;
  const latestIncCauseText = String(latestIncident?.cause || latestIncident?.root_cause || latestIncident?.title || '').toLowerCase();

  // Nhận diện Workload cơ sở dữ liệu / Cache (MongoDB, Redis, Postgres, MySQL, Cassandra...)
  // Các hệ thống này luôn giữ RAM cao (~80-100%) làm Buffer Cache / Page Cache
  const isDbCacheService = Boolean(
    (selectedService &&
      /^(mongo|redis|postgres|mysql|mariadb|elasticsearch|etcd|cassandra|clickhouse|neo4j|couchdb|scylladb|database|db$|.*[-_]db)/i.test(
        selectedService.trim()
      )) ||
    String(pipelineContext?.workload_type || '').toLowerCase() === 'statefulset'
  );
  // Nếu là cơ sở dữ liệu, không có OOMKilled và không có sự cố mở -> Coi là bộ đệm an toàn (Benign DB Cache)
  const isBenignDbCacheState = Boolean(
    isDbCacheService &&
    openServiceIncidentsCount === 0 &&
    !latestIncCauseText.includes('oom') &&
    !latestIncCauseText.includes('crash')
  );

  // Tính toán xác suất của 7 đầu rủi ro AI (đồng bộ chính xác với Hồ sơ xác suất rủi ro)
  const riskProbabilities = useMemo(() => {
    const map = {};
    const isPredictionHealthy =
      !prediction ||
      prediction?.status === 'HEALTHY' ||
      prediction?.prediction_type === 'NORMAL' ||
      prediction?.primary_risk === 'NORMAL';

    for (const action of ACTION_OUTCOME_NODES) {
      if (isPredictionHealthy || !isAgentConnected) {
        const effectiveThreshold = action.threshold;
        map[action.riskKey] = {
          prob: 0,
          isTriggered: false,
          threshold: effectiveThreshold,
          thresholdPercent: Math.round(effectiveThreshold * 100),
          probPercent: '0%',
        };
        continue;
      }

      const isDetected = isAgentConnected && Boolean(prediction) && prediction?.prediction_type === action.riskKey;
      const rawAiConf = prediction?.risk_outputs?.[action.riskKey]?.confidence;
      let probValue = 0;

      if (rawAiConf !== undefined && rawAiConf !== null) {
        probValue = parseFloat(rawAiConf);
      } else if (isDetected) {
        probValue = parseFloat(prediction?.confidence_score) || 0.85;
      } else if (prediction?.risk_score) {
        const baseScore = parseFloat(prediction.risk_score) || 0;
        probValue = Math.min(baseScore * 10, action.threshold * 0.4);
      }

      const effectiveThreshold = prediction?.thresholds?.[action.riskKey] !== undefined
        ? prediction.thresholds[action.riskKey]
        : action.threshold;

      const isOomSuppressed = isBenignDbCacheState && action.riskKey === 'OOM';
      const curReplicaNum = parseFloat(liveMetrics.replica_count?.latest) || podCount || 1;
      const curCpuNum = parseFloat(liveMetrics.cpu?.latest) || 0;
      const curLatNum = parseFloat(liveMetrics.latency?.latest) || 0;
      const isScaleDownSuppressed =
        action.riskKey === 'SCALE_DOWN_CANDIDATE' &&
        (curReplicaNum <= 2 || curCpuNum >= 40 || curLatNum >= 250);
      if (isScaleDownSuppressed) {
        probValue = 0;
      }
      const isExceeded = isAgentConnected && Boolean(prediction) && probValue >= effectiveThreshold && !isOomSuppressed && !isScaleDownSuppressed;
      const percentVal = probValue * 100;

      const displayPercentText = (!isAgentConnected || !prediction)
        ? '0%'
        : percentVal >= 1
        ? `${Math.round(percentVal)}%`
        : percentVal >= 0.1
        ? `${percentVal.toFixed(1)}%`
        : percentVal > 0.01
        ? '< 0.1%'
        : '0%';

      map[action.riskKey] = {
        prob: probValue,
        isTriggered: isExceeded,
        threshold: effectiveThreshold,
        thresholdPercent: Math.round(effectiveThreshold * 100),
        probPercent: displayPercentText,
      };
    }
    return map;
  }, [
    ACTION_OUTCOME_NODES,
    prediction,
    isAgentConnected,
    isBenignDbCacheState,
    liveMetrics.cpu?.latest,
    liveMetrics.latency?.latest,
    liveMetrics.replica_count?.latest,
    podCount,
  ]);

  // Xử lý sự kiện kéo rê (Pan)
  const handleMouseDown = (e) => {
    if (e.button !== 0 || e.target.closest('button') || e.target.closest('.pipeline-inspector-popover')) return;
    setIsDragging(true);
    didDragRef.current = false;
    dragOriginRef.current = { x: e.clientX, y: e.clientY };
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    const dx = Math.abs(e.clientX - dragOriginRef.current.x);
    const dy = Math.abs(e.clientY - dragOriginRef.current.y);
    if (dx > 5 || dy > 5) {
      didDragRef.current = true;
      hasUserMovedCameraRef.current = true;
      if (pinnedInspector) setPinnedInspector(null);
      if (hoveredInspector) setHoveredInspector(null);
    }
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const safeNavigate = (targetPath) => {
    if (didDragRef.current || !onNavigate || !targetPath) return;
    onNavigate(targetPath);
  };

  // Giữ cameraRef luôn đồng bộ để listener wheel non-passive tính đúng tọa độ con trỏ chuột (chuẩn Google Stitch / Figma)
  cameraRef.current = {
    zoom,
    pan,
    autoScale,
    width: containerWidth,
    height: containerHeight,
  };

  const MIN_VISUAL_SCALE = 0.12; // 12%
  const MAX_VISUAL_SCALE = 2.6;  // 260% — cho phép phóng to biểu đồ và từng thẻ siêu nét!

  // Phóng to / thu nhỏ neo đúng tâm điểm (con trỏ chuột khi lăn bánh xe, hoặc tâm khung nhìn khi bấm nút +/-)
  const applyZoomAroundPoint = (targetVisualScale, anchorX, anchorY, immediate = false) => {
    const cam = cameraRef.current;
    const oldScale = cam.zoom * cam.autoScale;
    const clampedVisualScale = Math.min(Math.max(targetVisualScale, MIN_VISUAL_SCALE), MAX_VISUAL_SCALE);
    const nextZoom = clampedVisualScale / (cam.autoScale || 1);
    const ratio = clampedVisualScale / (oldScale || 1);

    const originX = cam.width / 2;
    const originY = isFullScreen ? cam.height / 2 : 0;
    const relX = anchorX - originX - cam.pan.x;
    const relY = anchorY - originY - cam.pan.y;
    const nextPan = {
      x: anchorX - originX - relX * ratio,
      y: anchorY - originY - relY * ratio,
    };

    hasUserMovedCameraRef.current = true;
    setPinnedInspector(null);
    setHoveredInspector(null);

    if (immediate) {
      setIsWheelZooming(true);
      if (wheelTimeoutRef.current) clearTimeout(wheelTimeoutRef.current);
      wheelTimeoutRef.current = setTimeout(() => setIsWheelZooming(false), 120);
    }

    cameraRef.current = { ...cam, zoom: nextZoom, pan: nextPan };
    setZoom(nextZoom);
    setPan(nextPan);
  };

  // Gắn native wheel listener với { passive: false } để lăn chuột / pinch phóng to trực tiếp tại vị trí con trỏ như Google Stitch
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handleNativeWheel = (e) => {
      if (e.target && e.target.closest && e.target.closest('.pipeline-inspector-popover')) return;
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const pointerX = e.clientX - rect.left;
      const pointerY = e.clientY - rect.top;
      const cam = cameraRef.current;
      const currentVisualScale = cam.zoom * cam.autoScale;
      // Cuộn mượt tự nhiên cho cả chuột bánh xe và trackpad pinch
      const intensity = e.ctrlKey ? 0.0085 : 0.0016;
      const delta = Math.max(-180, Math.min(180, e.deltaY));
      const factor = Math.exp(-delta * intensity);
      applyZoomAroundPoint(currentVisualScale * factor, pointerX, pointerY, true);
    };
    el.addEventListener('wheel', handleNativeWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', handleNativeWheel);
      if (wheelTimeoutRef.current) clearTimeout(wheelTimeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFullScreen]);

  // Điều khiển Toolbar & Camera Focus (căn giữa vùng hiển thị sạch bên dưới 8 thẻ KPI nổi)
  const computeFocusTransform = (mode, targetDiagram = activeDiagram) => {
    const safeOffsetY = isFullScreen ? topSafePadding / 2 : 0;
    const forDiagram2 = showExtendedPipeline && targetDiagram === 'diagram2';
    const targetW = showExtendedPipeline ? (forDiagram2 ? 4090 : 2240) : 1000;
    const targetH = showExtendedPipeline ? (forDiagram2 ? 1230 : 760) : 550;
    if (mode === 'all' || !showExtendedPipeline) {
      return { nextZoom: 1, nextPan: { x: 0, y: safeOffsetY } };
    }
    const usableW = Math.max(containerWidth - 24, 280);
    const usableH = Math.max(containerHeight - topSafePadding - 24, 200);
    if (forDiagram2) {
      if (mode === 'd2_front') {
        const targetScale = Math.min(usableW / 1680, usableH / 1040, 1.0);
        const nextZoom = Math.min(Math.max(targetScale / autoScale, 0.25), MAX_VISUAL_SCALE / autoScale);
        const effScale = nextZoom * autoScale;
        const leftMarginPx = containerWidth <= 768 ? 8 : 18;
        const focusCy = 540;
        return {
          nextZoom,
          nextPan: {
            x: leftMarginPx - containerWidth / 2 + (targetW / 2 - 16) * effScale,
            y: (targetH / 2 - focusCy) * effScale + safeOffsetY,
          },
        };
      }
      if (mode === 'd2_branched') {
        const targetScale = Math.min(usableW / 2280, usableH / 1060, 1.0);
        const nextZoom = Math.min(Math.max(targetScale / autoScale, 0.24), MAX_VISUAL_SCALE / autoScale);
        const effScale = nextZoom * autoScale;
        const leftMarginPx = containerWidth <= 768 ? 8 : 18;
        const focusCy = 610;
        return {
          nextZoom,
          nextPan: {
            x: leftMarginPx - containerWidth / 2 + (targetW / 2 - 1860) * effScale,
            y: (targetH / 2 - focusCy) * effScale + safeOffsetY,
          },
        };
      }
      return { nextZoom: 1, nextPan: { x: 0, y: safeOffsetY } };
    }
    if (mode === 'gru') {
      // Neo sát lề trái (LEFT_X = 16 cách mép trái 18px) để không dư khoảng trắng bên trái, nhìn trọn từ 01 → 04/05 ngay lúc mở!
      const targetScale = Math.min(usableW / 1015, usableH / 700, 1.05);
      const nextZoom = Math.min(Math.max(targetScale / autoScale, 0.35), MAX_VISUAL_SCALE / autoScale);
      const effScale = nextZoom * autoScale;
      const leftMarginPx = containerWidth <= 768 ? 8 : 18;
      const focusCy = 512;
      return {
        nextZoom,
        nextPan: {
          x: leftMarginPx - containerWidth / 2 + (targetW / 2 - 16) * effScale,
          y: (targetH / 2 - focusCy) * effScale + safeOffsetY,
        },
      };
    }
    // mode === 'healing': Neo sát lề trái từ Cột 04 (Multi-Agent RCA) → 05 (Policy) → 06 (AUTO/HITL/Audit) → 07 (Hậu kiểm)
    const targetScale = Math.min(usableW / 1165, usableH / 650, 1.02);
    const nextZoom = Math.min(Math.max(targetScale / autoScale, 0.35), MAX_VISUAL_SCALE / autoScale);
    const effScale = nextZoom * autoScale;
    const leftMarginPx = containerWidth <= 768 ? 8 : 20;
    const focusCy = 524;
    return {
      nextZoom,
      nextPan: {
        x: leftMarginPx - containerWidth / 2 + (targetW / 2 - 1045) * effScale,
        y: (targetH / 2 - focusCy) * effScale + safeOffsetY,
      },
    };
  };

  const handleZoomIn = () => {
    const cam = cameraRef.current;
    const anchorX = cam.width / 2;
    const anchorY = isFullScreen ? topSafePadding + (cam.height - topSafePadding) / 2 : cam.height / 2;
    applyZoomAroundPoint(cam.zoom * cam.autoScale * 1.22, anchorX, anchorY, false);
  };
  const handleZoomOut = () => {
    const cam = cameraRef.current;
    const anchorX = cam.width / 2;
    const anchorY = isFullScreen ? topSafePadding + (cam.height - topSafePadding) / 2 : cam.height / 2;
    applyZoomAroundPoint((cam.zoom * cam.autoScale) / 1.22, anchorX, anchorY, false);
  };
  const handleFocusView = (mode) => {
    hasUserMovedCameraRef.current = false;
    setPinnedInspector(null);
    setHoveredInspector(null);
    setActiveViewMode(mode);
    const { nextZoom, nextPan } = computeFocusTransform(mode);
    setZoom(nextZoom);
    setPan(nextPan);
  };
  const handleSwitchDiagram = (diagramId) => {
    hasUserMovedCameraRef.current = false;
    setPinnedInspector(null);
    setHoveredInspector(null);
    setActiveDiagram(diagramId);
    setActiveViewMode(diagramId === 'diagram2' ? 'all' : defaultViewMode);
  };
  const handleReset = () => {
    handleFocusView(showExtendedPipeline ? (activeDiagram === 'diagram2' ? 'all' : defaultViewMode) : 'all');
  };

  // Tự động áp dụng góc nhìn mặc định (vừa khung các thẻ AI & Rule Engine) ngay khi đo xong kích thước khung & khi co giãn cửa sổ
  useEffect(() => {
    if (!hasMeasuredContainer || !showExtendedPipeline) return;
    if (hasUserMovedCameraRef.current) return;
    const { nextZoom, nextPan } = computeFocusTransform(activeViewMode, activeDiagram);
    setZoom(nextZoom);
    setPan(nextPan);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMeasuredContainer, containerWidth, containerHeight, autoScale, activeViewMode, activeDiagram, showExtendedPipeline, topSafePadding]);

  // Tọa độ bố cục chuẩn: giữ cố định Y_SHIFT = 162 để khi mở/gập Rule Engine toàn bộ sơ đồ không bị nhảy vị trí!
  const Y_SHIFT = showExtendedPipeline ? 162 : 0;

  // 1. Cột 1 (8 Metric Input Cards - ma trận chuẩn [12×8]): x = 16, width = 205, height = 48, gap = 8
  const LEFT_X = 16;
  const LEFT_W = 205;
  const LEFT_H = 48;
  const LEFT_GAP = 8;
  const LEFT_Y_START = 52 + Y_SHIFT;

  // 2. Cột 2 (Central AI Hub tích hợp Biểu đồ sóng): x = 265, width = 440, height = 430
  const CENTER_X = 265;
  const CENTER_Y = 58 + Y_SHIFT;
  const CENTER_W = 440;
  const CENTER_H = 430;
  const MAIN_MID_Y = CENTER_Y + CENTER_H / 2;

  const LEFT_COMPACT_H = 206;
  const LEFT_COMPACT_Y = Math.round(MAIN_MID_Y - LEFT_COMPACT_H / 2);

  // 3. Cột 3 (7 Đầu rủi ro): x = 745, width = 240, height = 52, gap = 10
  const RIGHT_X = 745;
  const RIGHT_W = 240;
  const RIGHT_H = 52;
  const RIGHT_GAP = 10;
  const RIGHT_Y_START = 58 + Y_SHIFT;
  const RIGHT_COMPACT_H = 206;
  const RIGHT_COMPACT_Y = Math.round(MAIN_MID_Y - RIGHT_COMPACT_H / 2);

  // 4. Cột 4 (Multi-Agent RCA & Sự cố): x = 1045, width = 265, height = 382
  const RCA_X = 1045;
  const RCA_Y = 82 + Y_SHIFT;
  const RCA_W = 265;
  const RCA_H = 382;

  // 5. Cột 5 (Policy Engine & Safety Gate): x = 1365, width = 215, height = 276
  const POLICY_X = 1365;
  const POLICY_Y = 135 + Y_SHIFT;
  const POLICY_W = 215;
  const POLICY_H = 276;

  // 6. Cột 6 (3 Nhánh Điều phối: AUTO / HITL / Circuit Breaker)
  const BRANCH_X = 1640;
  const BRANCH_W = 248;
  const AUTO_Y = 58 + Y_SHIFT;
  const AUTO_H = 128;
  const HITL_Y = 208 + Y_SHIFT;
  const HITL_H = 130;
  const AUDIT_Y = 360 + Y_SHIFT;
  const AUDIT_H = 122;
  const BRANCH_COMPACT_H = 218;
  const BRANCH_COMPACT_Y = Math.round(MAIN_MID_Y - BRANCH_COMPACT_H / 2);

  // 7. Cột 7 (Hậu kiểm Phục hồi 60s & Auto-Resolve)
  const VERIFY_X = 1945;
  const VERIFY_Y = 115 + Y_SHIFT;
  const VERIFY_W = 232;
  const VERIFY_H = 276;

  const CENTER_OUT_PORT = {
    x: CENTER_X + CENTER_W,
    y: CENTER_Y + CENTER_H / 2,
  };

  // 1. Đường cong Bezier từ Cột 1 vào AI Hub (8 đường khi mở rộng, 1 đường gọn khi thu gọn)
  const warningMetricsCount = METRIC_CONFIGS.filter((cfg) => liveMetrics[cfg.key]?.isWarning).length;
  const inputEdges = isTelemetryExpanded
    ? METRIC_CONFIGS.map((cfg, idx) => {
        const leftNodeY = LEFT_Y_START + idx * (LEFT_H + LEFT_GAP);
        const startPort = { x: LEFT_X + LEFT_W, y: leftNodeY + LEFT_H / 2 };
        const endPort = {
          x: CENTER_X,
          y: Math.round(CENTER_Y + 42 + idx * ((CENTER_H - 84) / Math.max(METRIC_CONFIGS.length - 1, 1))),
        };
        const c1x = startPort.x + (endPort.x - startPort.x) * 0.48;
        const c2x = startPort.x + (endPort.x - startPort.x) * 0.52;
        const pathD = `M ${startPort.x} ${startPort.y} C ${c1x} ${startPort.y}, ${c2x} ${endPort.y}, ${endPort.x} ${endPort.y}`;
        return {
          id: `edge-in-${cfg.key}`,
          pathD,
          startPort,
          endPort,
          color: cfg.color,
          isWarning: liveMetrics[cfg.key]?.isWarning,
        };
      })
    : [
        {
          id: 'edge-in-summary',
          pathD: `M ${LEFT_X + LEFT_W} ${MAIN_MID_Y} L ${CENTER_X} ${MAIN_MID_Y}`,
          startPort: { x: LEFT_X + LEFT_W, y: MAIN_MID_Y },
          endPort: { x: CENTER_X, y: MAIN_MID_Y },
          color: warningMetricsCount > 0 ? '#F59E0B' : '#10B981',
          isWarning: warningMetricsCount > 0,
        },
      ];

  // 2. Đường cong Bezier từ AI Hub sang Cột 3 (7 đường khi mở rộng, 1 đường gọn khi thu gọn)
  const allRiskEvaluations = ACTION_OUTCOME_NODES.map((action) => ({
    ...action,
    riskInfo: riskProbabilities[action.riskKey] || { prob: 0, isTriggered: false, thresholdPercent: Math.round(action.threshold * 100), probPercent: '0%' },
  }));
  const triggeredRisksList = allRiskEvaluations.filter((r) => r.riskInfo.isTriggered);
  const isScaleDownOnlyRisk =
    triggeredRisksList.length === 1 && triggeredRisksList[0].riskKey === 'SCALE_DOWN_CANDIDATE';
  const incCauseRawStr = String(
    latestIncident?.cause || latestIncident?.root_cause || latestIncident?.title || ''
  ).toLowerCase();
  const isScaleDownIncident =
    incCauseRawStr.includes('underutilized') ||
    incCauseRawStr.includes('dư thừa') ||
    incCauseRawStr.includes('thu hẹp') ||
    incCauseRawStr.includes('scale_down') ||
    incCauseRawStr.includes('scale down');
  const isScaleDownOptimization = isAgentConnected && (isScaleDownOnlyRisk || isScaleDownIncident);

  const topRiskEval = [...allRiskEvaluations].sort((a, b) => {
    if (a.riskInfo.isTriggered !== b.riskInfo.isTriggered) return a.riskInfo.isTriggered ? -1 : 1;
    return (b.riskInfo.prob || 0) - (a.riskInfo.prob || 0);
  })[0];

  const outputEdges = isRisksExpanded
    ? ACTION_OUTCOME_NODES.map((action, idx) => {
        const rightNodeY = RIGHT_Y_START + idx * (RIGHT_H + RIGHT_GAP);
        const endPort = { x: RIGHT_X, y: rightNodeY + RIGHT_H / 2 };
        const c1x = CENTER_OUT_PORT.x + (endPort.x - CENTER_OUT_PORT.x) * 0.48;
        const c2x = CENTER_OUT_PORT.x + (endPort.x - CENTER_OUT_PORT.x) * 0.52;
        const pathD = `M ${CENTER_OUT_PORT.x} ${CENTER_OUT_PORT.y} C ${c1x} ${CENTER_OUT_PORT.y}, ${c2x} ${endPort.y}, ${endPort.x} ${endPort.y}`;
        const riskInfo = riskProbabilities[action.riskKey] || { prob: 0, isTriggered: false };
        const isOptNode = action.riskKey === 'SCALE_DOWN_CANDIDATE';

        return {
          id: `edge-out-${action.id}`,
          pathD,
          startPort: CENTER_OUT_PORT,
          endPort,
          color: riskInfo.isTriggered ? (isOptNode ? '#0284C7' : '#EF4444') : '#10B981',
          isTriggered: riskInfo.isTriggered,
          riskProb: riskInfo.prob,
        };
      })
    : [
        {
          id: 'edge-out-summary',
          pathD: `M ${CENTER_OUT_PORT.x} ${CENTER_OUT_PORT.y} L ${RIGHT_X} ${MAIN_MID_Y}`,
          startPort: CENTER_OUT_PORT,
          endPort: { x: RIGHT_X, y: MAIN_MID_Y },
          color: triggeredRisksList.length > 0 ? (isScaleDownOnlyRisk ? '#0284C7' : '#EF4444') : '#10B981',
          isTriggered: isAgentConnected && triggeredRisksList.length > 0,
          riskProb: topRiskEval?.riskInfo?.prob || 0,
        },
      ];

  const isPredictionHealthy =
    !prediction ||
    prediction?.status === 'HEALTHY' ||
    prediction?.prediction_type === 'NORMAL' ||
    prediction?.primary_risk === 'NORMAL';

  const rawRiskScore = isAgentConnected && !isPredictionHealthy ? parseFloat(prediction?.risk_score || 0) : 0;
  const hasAnyTriggeredRisk = isAgentConnected && !isPredictionHealthy && triggeredRisksList.length > 0;
  const isRiskDetected =
    isAgentConnected &&
    !isPredictionHealthy &&
    (prediction?.status === 'RISK_DETECTED' || rawRiskScore >= 0.7 || hasAnyTriggeredRisk) &&
    !isBenignDbCacheState;

  // Trạng thái kích hoạt thực tế cho các giai đoạn sau AI (khi mất kết nối Agent -> toàn bộ tắt hiệu ứng về trạng thái nghỉ)
  const latestRecommendation = isAgentConnected ? (pipelineContext?.latestRecommendation || null) : null;
  const latestAutoAction = isAgentConnected ? (pipelineContext?.latestAutoAction || null) : null;
  const latestHitlApproval = isAgentConnected ? (pipelineContext?.latestHitlApproval || null) : null;
  const pendingApprovalsCount = isAgentConnected ? (pipelineContext?.pendingServiceApprovalsCount || 0) : 0;
  const isCircuitBreakerTripped = isAgentConnected && Boolean(pipelineContext?.isCircuitBreakerTripped);
  const actionTimeline = isAgentConnected && Array.isArray(pipelineContext?.actionTimeline) ? pipelineContext.actionTimeline : [];
  const recoveryStats = isAgentConnected && pipelineContext?.recoveryStats
    ? pipelineContext.recoveryStats
    : {
        totalActions: 0,
        succeededCount: 0,
        failedCount: 0,
        verifyingCount: 0,
        runningCount: 0,
        successRate: null,
        latestCompletedAction: null,
      };

  const isRcaActive = isAgentConnected && (openServiceIncidentsCount > 0 || (isRiskDetected && !isBenignDbCacheState));
  const isPolicyActive = isAgentConnected && (isRcaActive || Boolean(latestRecommendation));
  const autoActionStatus = isAgentConnected ? String(latestAutoAction?.execution_status || '').toUpperCase() : '';
  const isAutoActionDone = autoActionStatus === 'SUCCEEDED' || autoActionStatus === 'COMPLETED';
  const isAutoActionInProgress =
    isAgentConnected &&
    (autoActionStatus === 'RUNNING' ||
      (!isCircuitBreakerTripped &&
        openServiceIncidentsCount > 0 &&
        ['AUTO', 'AUTOMATIC', 'AUTONOMOUS'].includes(String(latestAutoAction?.execution_mode || '').toUpperCase()) &&
        !isAutoActionDone &&
        autoActionStatus !== 'FAILED'));
  const isHitlActive = isAgentConnected && pendingApprovalsCount > 0;
  const isAutoActionActive =
    !isHitlActive &&
    (isAutoActionInProgress ||
      (!isCircuitBreakerTripped && openServiceIncidentsCount > 0 && isAutoActionDone));
  const isVerifyingInProgress =
    isAgentConnected && (recoveryStats.runningCount > 0 || recoveryStats.verifyingCount > 0);
  const isAutoActive = isAutoActionActive;
  const isAuditActive =
    isAgentConnected &&
    (isCircuitBreakerTripped || (pipelineContext?.totalPoliciesCount > 0 && pipelineContext?.activePoliciesCount === 0));
  const latestTimelineStep = actionTimeline.length > 0 ? actionTimeline[actionTimeline.length - 1] : null;
  const hasUnrecoveredStep =
    isAgentConnected &&
    !isScaleDownOptimization &&
    Boolean(latestTimelineStep?.isFailedOrUnrecovered);
  const isVerifyActive = isVerifyingInProgress;

  // 3. Đường cong Bezier từ Cột 3 hội tụ vào Cột 4 (Multi-Agent RCA Hub)
  const RCA_IN_PORT = { x: RCA_X, y: RCA_Y + RCA_H / 2 };
  const rcaInEdges = isRisksExpanded
    ? ACTION_OUTCOME_NODES.map((action, idx) => {
        const rightNodeY = RIGHT_Y_START + idx * (RIGHT_H + RIGHT_GAP);
        const startPort = { x: RIGHT_X + RIGHT_W, y: rightNodeY + RIGHT_H / 2 };
        const c1x = startPort.x + (RCA_IN_PORT.x - startPort.x) * 0.5;
        const c2x = startPort.x + (RCA_IN_PORT.x - startPort.x) * 0.5;
        const pathD = `M ${startPort.x} ${startPort.y} C ${c1x} ${startPort.y}, ${c2x} ${RCA_IN_PORT.y}, ${RCA_IN_PORT.x} ${RCA_IN_PORT.y}`;
        const riskInfo = riskProbabilities[action.riskKey] || { prob: 0, isTriggered: false };
        const isOptNode = action.riskKey === 'SCALE_DOWN_CANDIDATE';
        return {
          id: `edge-rca-in-${action.id}`,
          pathD,
          isTriggered: riskInfo.isTriggered,
          color: riskInfo.isTriggered ? (isOptNode ? '#0284C7' : '#EF4444') : '#CBD5E1',
        };
      })
    : [
        {
          id: 'edge-rca-in-summary',
          pathD: `M ${RIGHT_X + RIGHT_W} ${MAIN_MID_Y} L ${RCA_IN_PORT.x} ${RCA_IN_PORT.y}`,
          isTriggered: isAgentConnected && triggeredRisksList.length > 0,
          color: triggeredRisksList.length > 0 ? (isScaleDownOnlyRisk ? '#0284C7' : '#EF4444') : '#CBD5E1',
        },
      ];

  // 4. Đường cong từ Multi-Agent RCA → Policy Engine
  const rcaOutPort = { x: RCA_X + RCA_W, y: RCA_Y + RCA_H / 2 };
  const policyInPort = { x: POLICY_X, y: POLICY_Y + POLICY_H / 2 };
  const rcaToPolicyPath = `M ${rcaOutPort.x} ${rcaOutPort.y} C ${rcaOutPort.x + 28} ${rcaOutPort.y}, ${policyInPort.x - 28} ${policyInPort.y}, ${policyInPort.x} ${policyInPort.y}`;

  // 5. Đường cong từ Policy Engine → Cột 6 (3 nhánh khi mở rộng, 1 đường gọn khi thu gọn)
  const policyOutPort = { x: POLICY_X + POLICY_W, y: POLICY_Y + POLICY_H / 2 };
  const policyBranchEdges = isBranchesExpanded
    ? [
        {
          id: 'edge-policy-auto',
          label: 'AUTO',
          color: '#10B981',
          active: isAutoActionActive,
          animating: isAutoActionInProgress,
          pathD: (() => {
            const end = { x: BRANCH_X, y: AUTO_Y + AUTO_H / 2 };
            const mx = policyOutPort.x + (end.x - policyOutPort.x) * 0.5;
            return `M ${policyOutPort.x} ${policyOutPort.y} C ${mx} ${policyOutPort.y}, ${mx} ${end.y}, ${end.x} ${end.y}`;
          })(),
        },
        {
          id: 'edge-policy-hitl',
          label: 'HITL',
          color: '#F59E0B',
          active: isHitlActive,
          animating: isHitlActive,
          pathD: (() => {
            const end = { x: BRANCH_X, y: HITL_Y + HITL_H / 2 };
            const mx = policyOutPort.x + (end.x - policyOutPort.x) * 0.5;
            return `M ${policyOutPort.x} ${policyOutPort.y} C ${mx} ${policyOutPort.y}, ${mx} ${end.y}, ${end.x} ${end.y}`;
          })(),
        },
        {
          id: 'edge-policy-audit',
          label: 'AUDIT',
          color: '#64748B',
          active: isAuditActive,
          animating: isAuditActive,
          pathD: (() => {
            const end = { x: BRANCH_X, y: AUDIT_Y + AUDIT_H / 2 };
            const mx = policyOutPort.x + (end.x - policyOutPort.x) * 0.5;
            return `M ${policyOutPort.x} ${policyOutPort.y} C ${mx} ${policyOutPort.y}, ${mx} ${end.y}, ${end.x} ${end.y}`;
          })(),
        },
      ]
    : [
        {
          id: 'edge-policy-summary',
          label: 'DISPATCH',
          color: isHitlActive ? '#F59E0B' : isAutoActionActive ? '#10B981' : '#64748B',
          active: isAutoActionActive || isHitlActive || isAuditActive,
          animating: isAutoActionInProgress || isHitlActive || isAuditActive,
          pathD: `M ${policyOutPort.x} ${policyOutPort.y} L ${BRANCH_X} ${MAIN_MID_Y}`,
        },
      ];

  // 6. Đường cong hội tụ từ Cột 6 → Cột 7 (Hậu kiểm Phục hồi)
  const verifyInPort = { x: VERIFY_X, y: VERIFY_Y + VERIFY_H / 2 };
  const branchToVerifyEdges = isBranchesExpanded
    ? [
        {
          id: 'edge-auto-verify',
          color: '#10B981',
          active: isAutoActionActive || isVerifyingInProgress,
          animating: isAutoActionInProgress || isVerifyingInProgress,
          pathD: (() => {
            const start = { x: BRANCH_X + BRANCH_W, y: AUTO_Y + AUTO_H / 2 };
            const mx = start.x + (verifyInPort.x - start.x) * 0.5;
            return `M ${start.x} ${start.y} C ${mx} ${start.y}, ${mx} ${verifyInPort.y - 26}, ${verifyInPort.x} ${verifyInPort.y - 26}`;
          })(),
        },
        {
          id: 'edge-hitl-verify',
          color: '#0891B2',
          active: isHitlActive,
          animating: isHitlActive,
          pathD: (() => {
            const start = { x: BRANCH_X + BRANCH_W, y: HITL_Y + HITL_H / 2 };
            const mx = start.x + (verifyInPort.x - start.x) * 0.5;
            return `M ${start.x} ${start.y} C ${mx} ${start.y}, ${mx} ${verifyInPort.y + 20}, ${verifyInPort.x} ${verifyInPort.y + 20}`;
          })(),
        },
      ]
    : [
        {
          id: 'edge-branch-verify-summary',
          color: '#0891B2',
          active: isAutoActionActive || isHitlActive || isVerifyingInProgress,
          animating: isAutoActionInProgress || isHitlActive || isVerifyingInProgress,
          pathD: `M ${BRANCH_X + BRANCH_W} ${MAIN_MID_Y} L ${verifyInPort.x} ${verifyInPort.y}`,
        },
      ];

  // 7. Nhánh Song Song: Rule Engine đặt PHÍA TRÊN ĐẦU (thu gọn 54px ↔ mở rộng 150px, vừa khít bao trọn 6 luật)
  const RULE_X = 265;
  const RULE_H = isRuleExpanded ? 150 : 54;
  const RULE_Y = isRuleExpanded ? 30 : 96;
  const RULE_W = 720;

  const liveCpuVal = parseFloat(liveMetrics.cpu?.latest) || 0;
  const liveRamVal = parseFloat(liveMetrics.ram?.latest) || 0;
  const liveDiskVal = parseFloat(liveMetrics.disk?.latest) || 0;
  const liveLatVal = parseFloat(liveMetrics.latency?.latest) || 0;
  const liveReqVal = parseFloat(liveMetrics.request_rate?.latest) || 0;
  const live5xxVal = parseFloat(liveMetrics.http_5xx_rate?.latest) || 0;

  const ruleEngineChecks = [
    {
      id: 'R1',
      name: t('pipeline.rules.R1Name'),
      cond: t('pipeline.rules.R1Cond'),
      value: `${liveCpuVal.toFixed(0)}% / ${liveLatVal.toFixed(0)}ms`,
      triggered: isAgentConnected && liveCpuVal > 80 && liveLatVal > 200,
    },
    {
      id: 'R2',
      name: t('pipeline.rules.R2Name'),
      cond: t('pipeline.rules.R2Cond'),
      value: `${liveReqVal.toFixed(0)} r/s • ${isAgentConnected ? podCount : 0}p`,
      triggered: isAgentConnected && liveReqVal > 500 && Number(podCount) <= 2,
    },
    {
      id: 'R3',
      name: isDbCacheService ? t('pipeline.rules.R3NameDb') : t('pipeline.rules.R3Name'),
      cond: isDbCacheService ? t('pipeline.rules.R3CondDb') : t('pipeline.rules.R3Cond'),
      value: `${liveRamVal.toFixed(1)}%`,
      triggered:
        isAgentConnected &&
        (latestIncCauseText.includes('oom') || (!isDbCacheService && liveRamVal > 85)),
    },
    {
      id: 'R4',
      name: t('pipeline.rules.R4Name'),
      cond: t('pipeline.rules.R4Cond'),
      value: `${live5xxVal.toFixed(2)}%`,
      triggered: isAgentConnected && live5xxVal > 5,
    },
    {
      id: 'R5',
      name: t('pipeline.rules.R5Name'),
      cond: t('pipeline.rules.R5Cond'),
      value: !isAgentConnected
        ? t('pipeline.rules.R5Offline')
        : latestIncCauseText.includes('crash') || latestIncCauseText.includes('pod')
          ? t('pipeline.rules.R5Unstable')
          : t('pipeline.rules.R5Running'),
      triggered:
        isAgentConnected &&
        openServiceIncidentsCount > 0 &&
        (latestIncCauseText.includes('crash') || latestIncCauseText.includes('restart') || latestIncCauseText.includes('pod')),
    },
    {
      id: 'R6',
      name: t('pipeline.rules.R6Name'),
      cond: t('pipeline.rules.R6Cond'),
      value: `${liveDiskVal.toFixed(1)}%`,
      triggered: isAgentConnected && liveDiskVal > 85,
    },
  ];
  const triggeredRuleCount = ruleEngineChecks.filter((r) => r.triggered).length;
  const isRuleEngineTriggered = triggeredRuleCount > 0;

  // Đường vào Rule Engine (tách nhánh song song đi LÊN từ Bus Viễn Trắc → Cổng trái Rule Engine)
  const ruleInPort = { x: RULE_X, y: RULE_Y + RULE_H / 2 };
  const ruleTapStart = {
    x: LEFT_X + LEFT_W + 14,
    y: isTelemetryExpanded ? LEFT_Y_START + LEFT_H / 2 : MAIN_MID_Y,
  };
  const ruleInPath = `M ${ruleTapStart.x} ${ruleTapStart.y} L ${ruleTapStart.x} ${ruleInPort.y + 16} Q ${ruleTapStart.x} ${ruleInPort.y} ${ruleTapStart.x + 16} ${ruleInPort.y} L ${ruleInPort.x} ${ruleInPort.y}`;

  // Đường ra từ Rule Engine → Cổng TRÊN của Multi-Agent RCA
  const ruleOutPort = { x: RULE_X + RULE_W, y: RULE_Y + RULE_H / 2 };
  const rcaTopPort = { x: RCA_X + RCA_W / 2, y: RCA_Y };
  const ruleToRcaPath = `M ${ruleOutPort.x} ${ruleOutPort.y} L ${rcaTopPort.x - 18} ${ruleOutPort.y} Q ${rcaTopPort.x} ${ruleOutPort.y} ${rcaTopPort.x} ${ruleOutPort.y + 18} L ${rcaTopPort.x} ${rcaTopPort.y - 4}`;

  // 8. Vòng lặp hồi tiếp phía dưới cùng: từ Hậu Kiểm Phục Hồi (Cột 7) quay về Đầu vào Viễn trắc (Cột 1)
  const verifyBottomPort = { x: VERIFY_X + VERIFY_W / 2, y: VERIFY_Y + VERIFY_H };
  const lastMetricIdx = Math.max(0, METRIC_CONFIGS.length - 1);
  const metricBottomPort = {
    x: LEFT_X + LEFT_W / 2,
    y: isTelemetryExpanded
      ? LEFT_Y_START + lastMetricIdx * (LEFT_H + LEFT_GAP) + LEFT_H
      : LEFT_COMPACT_Y + LEFT_COMPACT_H,
  };
  const lowestContentY = Math.max(
    CENTER_Y + CENTER_H,
    isTelemetryExpanded ? LEFT_Y_START + lastMetricIdx * (LEFT_H + LEFT_GAP) + LEFT_H : LEFT_COMPACT_Y + LEFT_COMPACT_H,
    VERIFY_Y + VERIFY_H
  );
  const feedbackTrackY = lowestContentY + 28;
  const feedbackLoopPath = `M ${verifyBottomPort.x} ${verifyBottomPort.y} L ${verifyBottomPort.x} ${feedbackTrackY - 18} Q ${verifyBottomPort.x} ${feedbackTrackY} ${verifyBottomPort.x - 18} ${feedbackTrackY} L ${metricBottomPort.x + 18} ${feedbackTrackY} Q ${metricBottomPort.x} ${feedbackTrackY} ${metricBottomPort.x} ${feedbackTrackY - 18} L ${metricBottomPort.x} ${metricBottomPort.y + 6}`;

  // ==========================================
  // NỘI DUNG CỬA SỔ GIẢI THÍCH CHI TIẾT (HOVER XEM NHANH • CLICK GHIM CỐ ĐỊNH)
  // ==========================================
  const getInspectorContent = (id) => {
    if (!id) return null;

    // 1. 6 Luật trong Rule Engine (R1..R6)
    if (id.startsWith('rule:')) {
      const ruleId = id.replace('rule:', '');
      const ruleObj = ruleEngineChecks.find((r) => r.id === ruleId);
      const RULE_DETAILS = {
        R1: {
          title: t('pipeline.inspector.ruleR1Title'),
          summary: t('pipeline.inspector.ruleR1Summary', { service: selectedService }),
          rows: [
            { label: t('pipeline.inspector.ruleR1CpuNow'), value: t('pipeline.inspector.ruleR1CpuVal', { val: liveCpuVal.toFixed(1) }), highlight: liveCpuVal > 80 },
            { label: t('pipeline.inspector.ruleR1LatNow'), value: t('pipeline.inspector.ruleR1LatVal', { val: liveLatVal.toFixed(0) }), highlight: liveLatVal > 200 },
            { label: t('pipeline.inspector.anomalyCode'), value: 'CPU_LATENCY_SATURATION' },
          ],
          nextStep: t('pipeline.inspector.ruleR1Next'),
        },
        R2: {
          title: t('pipeline.inspector.ruleR2Title'),
          summary: t('pipeline.inspector.ruleR2Summary', { service: selectedService }),
          rows: [
            { label: t('pipeline.inspector.ruleR2ReqNow'), value: t('pipeline.inspector.ruleR2ReqVal', { val: liveReqVal.toFixed(1) }), highlight: liveReqVal > 500 },
            { label: t('pipeline.inspector.ruleR2PodsNow'), value: t('pipeline.inspector.ruleR2PodsVal', { count: podCount }), highlight: Number(podCount) <= 2 },
            { label: t('pipeline.inspector.anomalyCode'), value: 'TRAFFIC_SURGE' },
          ],
          nextStep: t('pipeline.inspector.ruleR2Next'),
        },
        R3: {
          title: isDbCacheService ? t('pipeline.inspector.ruleR3TitleDb') : t('pipeline.inspector.ruleR3Title'),
          summary: isDbCacheService
            ? t('pipeline.inspector.ruleR3SummaryDb', { service: selectedService })
            : t('pipeline.inspector.ruleR3Summary', { service: selectedService }),
          rows: [
            { label: t('pipeline.inspector.ruleR3RamNow'), value: `${liveRamVal.toFixed(1)}% ${isDbCacheService ? t('pipeline.inspector.ruleR3RamDbHint') : t('pipeline.inspector.ruleR3RamThresholdHint')}`, highlight: !isDbCacheService && liveRamVal > 85 },
            { label: t('pipeline.inspector.ruleR3OomLabel'), value: latestIncCauseText.includes('oom') ? t('pipeline.inspector.ruleR3OomFound') : t('pipeline.inspector.ruleR3OomSafe'), highlight: latestIncCauseText.includes('oom') },
            { label: t('pipeline.inspector.ruleR3StatusLabel'), value: isDbCacheService && !latestIncCauseText.includes('oom') ? t('pipeline.inspector.ruleR3StatusDbSafe') : 'MEMORY_PRESSURE' },
          ],
          nextStep: isDbCacheService
            ? t('pipeline.inspector.ruleR3NextDb')
            : t('pipeline.inspector.ruleR3Next'),
        },
        R4: {
          title: t('pipeline.inspector.ruleR4Title'),
          summary: t('pipeline.inspector.ruleR4Summary', { service: selectedService }),
          rows: [
            { label: t('pipeline.inspector.ruleR4RateLabel'), value: t('pipeline.inspector.ruleR4RateVal', { val: live5xxVal.toFixed(2) }), highlight: live5xxVal > 5 },
            { label: t('pipeline.inspector.ruleR4ImpactLabel'), value: live5xxVal > 5 ? t('pipeline.inspector.ruleR4ImpactHigh') : t('pipeline.inspector.ruleR4ImpactStable') },
            { label: t('pipeline.inspector.anomalyCode'), value: 'HTTP_5XX_SPIKE' },
          ],
          nextStep: t('pipeline.inspector.ruleR4Next'),
        },
        R5: {
          title: t('pipeline.inspector.ruleR5Title'),
          summary: t('pipeline.inspector.ruleR5Summary', { service: selectedService }),
          rows: [
            { label: t('pipeline.inspector.ruleR5PodStatus'), value: ruleObj?.value || t('pipeline.rules.R5Running'), highlight: Boolean(ruleObj?.triggered) },
            { label: t('pipeline.inspector.ruleR5OpenInc'), value: t('pipeline.inspector.ruleR5OpenIncVal', { count: openServiceIncidentsCount }) },
            { label: t('pipeline.inspector.anomalyCode'), value: 'POD_INSTABILITY' },
          ],
          nextStep: t('pipeline.inspector.ruleR5Next'),
        },
        R6: {
          title: t('pipeline.inspector.ruleR6Title'),
          summary: t('pipeline.inspector.ruleR6Summary', { service: selectedService }),
          rows: [
            { label: t('pipeline.inspector.ruleR6DiskNow'), value: t('pipeline.inspector.ruleR6DiskVal', { val: liveDiskVal.toFixed(1) }), highlight: liveDiskVal > 85 },
            { label: t('pipeline.inspector.anomalyCode'), value: 'DISK_SATURATION' },
          ],
          nextStep: t('pipeline.inspector.ruleR6Next'),
        },
      };
      const detail = RULE_DETAILS[ruleId];
      if (!detail) return null;
      return {
        badge: t('pipeline.inspector.ruleBadge', { id: ruleId }),
        accent: ruleObj?.triggered ? '#DC2626' : '#EA580C',
        bg: ruleObj?.triggered ? '#FEF2F2' : '#FFF7ED',
        title: detail.title,
        statusText: ruleObj?.triggered ? t('pipeline.inspector.ruleTriggered') : t('pipeline.inspector.ruleSafe'),
        isAlert: Boolean(ruleObj?.triggered),
        summary: detail.summary,
        rows: detail.rows,
        nextStep: detail.nextStep,
        actionLabel: t('pipeline.inspector.openIncidentsBtn'),
        actionPath: '/dashboard/incidents',
      };
    }

    // 2. 8 Metric Input Cards
    if (id.startsWith('metric:')) {
      const key = id.replace('metric:', '');
      const cfg = METRIC_CONFIGS.find((m) => m.key === key);
      const live = liveMetrics[key] || { latest: '0.00', avg: '0.00', max: '0.00', isWarning: false };
      if (!cfg) return null;
      return {
        badge: t('pipeline.inspector.metricBadge'),
        accent: cfg.color,
        bg: cfg.bgColor,
        title: `${cfg.label} — ${selectedService}`,
        statusText: live.isWarning ? t('pipeline.inspector.metricHighAlert') : t('pipeline.inspector.metricNormal'),
        isAlert: Boolean(live.isWarning),
        summary: t(`pipeline.inspector.metricDesc.${key}`, { defaultValue: t('pipeline.inspector.metricDesc.default') }),
        rows: [
          { label: t('pipeline.inspector.metricCurrentVal'), value: `${live.latest} ${cfg.unit}`, highlight: Boolean(live.isWarning) },
          { label: t('pipeline.inspector.metricAvg12'), value: `${live.avg} ${cfg.unit}` },
          { label: t('pipeline.inspector.metricMaxPeak'), value: `${live.max} ${cfg.unit}` },
          { label: t('pipeline.inspector.metricThreshold'), value: `> ${cfg.threshold} ${cfg.unit}` },
        ],
        nextStep: t('pipeline.inspector.metricNext'),
        actionLabel: t('pipeline.inspector.viewMetricsBtn'),
        actionPath: '/dashboard/monitoring/metrics',
      };
    }

    // 3. 7 Đầu Rủi Ro AI
    if (id.startsWith('risk:')) {
      const riskId = id.replace('risk:', '');
      const node = ACTION_OUTCOME_NODES.find((a) => a.id === riskId);
      if (!node) return null;
      const riskInfo = riskProbabilities[node.riskKey] || { probPercent: '0%', thresholdPercent: 80, isTriggered: false };
      return {
        badge: t('pipeline.inspector.riskBadge'),
        accent: riskInfo.isTriggered ? '#DC2626' : '#059669',
        bg: riskInfo.isTriggered ? '#FEF2F2' : '#ECFDF5',
        title: node.title,
        statusText: riskInfo.isTriggered ? t('pipeline.inspector.riskExceeded') : t('pipeline.inspector.riskBelow'),
        isAlert: Boolean(riskInfo.isTriggered),
        summary: t('pipeline.inspector.riskSummary', { service: selectedService }),
        rows: [
          { label: t('pipeline.inspector.riskAiProb'), value: riskInfo.probPercent, highlight: Boolean(riskInfo.isTriggered) },
          { label: t('pipeline.inspector.riskTriggerThreshold'), value: `${riskInfo.thresholdPercent}%` },
          { label: t('pipeline.inspector.riskCode'), value: node.riskKey },
        ],
        nextStep: riskInfo.isTriggered
          ? t('pipeline.inspector.riskNextTriggered')
          : t('pipeline.inspector.riskNextSafe'),
        actionLabel: t('pipeline.inspector.viewIncidentsBtn'),
        actionPath: '/dashboard/incidents',
      };
    }

    // 4. Các khối giai đoạn chính (AI, RCA, Policy, AUTO, HITL, Audit, Verify)
    if (id === 'stage:gru') {
      return {
        badge: t('pipeline.inspector.gruBadge'),
        accent: '#2563EB',
        bg: '#EFF6FF',
        title: t('pipeline.inspector.gruTitle', { service: selectedService }),
        statusText: isRiskDetected ? t('pipeline.inspector.gruAlert') : t('pipeline.inspector.gruHealthy'),
        isAlert: isRiskDetected,
        summary: t('pipeline.inspector.gruSummary'),
        rows: [
          { label: t('pipeline.inspector.gruBatchProgress'), value: t('pipeline.inspector.gruBatchVal', { step: Math.min(currentActiveStep || 12, totalSteps), total: totalSteps }) },
          { label: t('pipeline.inspector.gruRiskScore'), value: rawRiskScore.toFixed(4), highlight: isRiskDetected },
          { label: t('pipeline.inspector.gruService'), value: selectedService },
        ],
        nextStep: t('pipeline.inspector.gruNext'),
        actionLabel: t('pipeline.inspector.viewIncidentsBtn'),
        actionPath: '/dashboard/incidents',
      };
    }

    if (id === 'stage:rca') {
      const lastResolved = pipelineContext?.lastResolvedIncident || null;
      const rcaStatusLabel =
        openServiceIncidentsCount > 0
          ? t('pipeline.inspector.rcaOpenStatus', { count: openServiceIncidentsCount })
          : isBenignDbCacheState
            ? t('pipeline.inspector.rcaDbSafeStatus')
            : isRcaActive
              ? t('pipeline.inspector.rcaDiagnosingStatus')
              : t('pipeline.inspector.rcaIdleStatus');

      const rawRecAction =
        latestRecommendation?.action ||
        latestRecommendation?.action_code ||
        latestRecommendation?.recommendation ||
        '';
      const rcaAgents = pipelineContext?.rcaAgentsSummary || null;
      const evidenceStatusVi =
        rcaAgents?.evidenceStatus === 'INSUFFICIENT_EVIDENCE'
          ? t('pipeline.inspector.rcaInsuffEv')
          : rcaAgents?.evidenceStatus === 'SUFFICIENT_EVIDENCE' || rcaAgents?.evidenceStatus === 'CONFIRMED'
            ? t('pipeline.inspector.rcaSuffEv')
            : null;
      const rcaCauseText = latestIncident
        ? localizedIncidentTitle(latestIncident.cause || latestIncident.root_cause || latestIncident.title)
        : '';
      const rawTitleText = latestIncident?.title ? localizedIncidentTitle(latestIncident.title) : '';
      const rcaRows = latestIncident
        ? [
            {
              label: t('pipeline.inspector.rcaOpenLabel'),
              value: rcaCauseText,
              highlight: true,
            },
            ...(rawTitleText && rawTitleText !== rcaCauseText
              ? [
                  {
                    label: t('pipeline.inspector.rcaTriggerSignal'),
                    value: rawTitleText,
                  },
                ]
              : []),
            {
              label: t('pipeline.inspector.rcaSeverityLabel'),
              value: latestIncident.severity ? localizedSeverity(latestIncident.severity) : '—',
            },
            ...(rcaAgents?.rcaConfidencePct !== null && rcaAgents?.rcaConfidencePct !== undefined
              ? [
                  {
                    label: t('pipeline.inspector.rcaConfidenceLabel'),
                    value: evidenceStatusVi
                      ? `${rcaAgents.rcaConfidencePct}% (${evidenceStatusVi})`
                      : `${rcaAgents.rcaConfidencePct}%`,
                  },
                ]
              : []),
            {
              label: t('pipeline.inspector.rcaRecLabel'),
              value: rawRecAction ? translateActionToVi(rawRecAction, latestRecommendation) : t('pipeline.inspector.rcaRecPending'),
            },
          ]
        : [
            {
              label: t('pipeline.inspector.rcaOpenLabel'),
              value: isBenignDbCacheState
                ? t('pipeline.inspector.rcaZeroDb')
                : t('pipeline.inspector.rcaZeroCount', { detail: isRcaActive ? t('pipeline.inspector.rcaZeroGathering') : t('pipeline.inspector.rcaZeroStable') }),
            },
            ...(lastResolved
              ? [
                  {
                    label: t('pipeline.inspector.rcaLastClosed'),
                    value: t('pipeline.inspector.rcaLastClosedVal', {
                      cause: localizedIncidentTitle(
                        lastResolved.cause || lastResolved.root_cause || lastResolved.title
                      ),
                    }),
                  },
                ]
              : []),
            {
              label: t('pipeline.inspector.rcaCurrentRec'),
              value: t('pipeline.inspector.rcaWaitAnomaly'),
            },
          ];

      return {
        badge: t('pipeline.inspector.rcaBadge'),
        accent: openServiceIncidentsCount > 0 ? '#DC2626' : '#7C3AED',
        bg: openServiceIncidentsCount > 0 ? '#FEF2F2' : '#F5F3FF',
        title: `Multi-Agent RCA — ${selectedService}`,
        statusText: rcaStatusLabel,
        isAlert: openServiceIncidentsCount > 0,
        summary: t('pipeline.inspector.rcaSummary', { service: selectedService }),
        rows: rcaRows,
        nextStep:
          openServiceIncidentsCount > 0
            ? t('pipeline.inspector.rcaNextOpen')
            : t('pipeline.inspector.rcaNextIdle'),
        actionLabel: t('pipeline.inspector.openRcaBtn'),
        actionPath: '/dashboard/incidents',
      };
    }

    if (id === 'stage:policy') {
      const pMeta = pipelineContext?.policyMeta || {};
      const thresholdRangeText =
        pMeta.minConfidencePct && pMeta.maxConfidencePct
          ? pMeta.minConfidencePct === pMeta.maxConfidencePct
            ? `≥ ${pMeta.minConfidencePct}%`
            : `${pMeta.minConfidencePct}% – ${pMeta.maxConfidencePct}%`
          : t('pipeline.inspector.policyNotConfigured');
      return {
        badge: t('pipeline.inspector.policyBadge'),
        accent: '#D97706',
        bg: '#FFFBEB',
        title: t('pipeline.inspector.policyTitle'),
        statusText: t('pipeline.inspector.policyActiveStatus', { count: pipelineContext?.activePoliciesCount ?? 0 }),
        isAlert: false,
        summary: t('pipeline.inspector.policySummary'),
        rows: [
          { label: t('pipeline.inspector.policyAutoRow'), value: t('pipeline.inspector.policyCountUnit', { count: pipelineContext?.autoPoliciesCount ?? 0 }) },
          { label: t('pipeline.inspector.policyHitlRow'), value: t('pipeline.inspector.policyCountUnit', { count: pipelineContext?.hitlPoliciesCount ?? 0 }) },
          {
            label: t('pipeline.inspector.policyThresholdRow'),
            value: `${thresholdRangeText}${pMeta.cooldownSec ? ` • ${pMeta.cooldownSec}s` : ''}`,
          },
        ],
        nextStep: t('pipeline.inspector.policyNext'),
        actionLabel: t('pipeline.inspector.openPoliciesBtn'),
        actionPath: '/dashboard/self-healing/policies',
      };
    }

    if (id === 'stage:auto') {
      return {
        badge: t('pipeline.inspector.autoBadge'),
        accent: '#059669',
        bg: '#ECFDF5',
        title: t('pipeline.inspector.autoTitle', { service: selectedService }),
        statusText: autoActionStatus ? translateExecutionStatusVi(autoActionStatus) : (isAgentConnected ? t('pipeline.inspector.autoReady') : t('pipeline.inspector.autoOffline')),
        isAlert: autoActionStatus === 'FAILED',
        summary: t('pipeline.inspector.autoSummary'),
        rows: [
          {
            label: t('pipeline.inspector.autoLatestAction'),
            value: latestAutoAction
              ? translateActionToVi(
                  latestAutoAction.display_action_name ||
                    latestAutoAction.action_type_name ||
                    latestAutoAction.action_type_code ||
                    latestAutoAction.action_name,
                  latestAutoAction
                ) || t('pipeline.actions.defaultHealing')
              : t('pipeline.inspector.autoNoAction'),
          },
          { label: t('pipeline.inspector.autoAgentStatus'), value: isAgentConnected ? t('pipeline.inspector.autoAgentOnline') : t('pipeline.inspector.autoAgentOffline') },
        ],
        nextStep: t('pipeline.inspector.autoNext'),
        actionLabel: t('pipeline.inspector.openActionsBtn'),
        actionPath: '/dashboard/self-healing/actions',
      };
    }

    if (id === 'stage:hitl') {
      return {
        badge: t('pipeline.inspector.hitlBadge'),
        accent: '#D97706',
        bg: '#FFFBEB',
        title: t('pipeline.inspector.hitlTitle', { service: selectedService }),
        statusText: t('pipeline.inspector.hitlPendingStatus', { count: isHitlActive ? pendingApprovalsCount : 0 }),
        isAlert: isHitlActive,
        summary: t('pipeline.inspector.hitlSummary', { service: selectedService }),
        rows: [
          { label: t('pipeline.inspector.hitlPendingRow'), value: t('pipeline.inspector.hitlPendingUnit', { count: pendingApprovalsCount }), highlight: isHitlActive },
          {
            label: t('pipeline.inspector.hitlLatestRow'),
            value: latestHitlApproval
              ? translateActionToVi(
                  latestHitlApproval.display_action_name ||
                    latestHitlApproval.action_type_name ||
                    latestHitlApproval.action_type_code,
                  latestHitlApproval
                ) || t('pipeline.inspector.hitlPendingFallback')
              : t('pipeline.inspector.hitlNone'),
          },
        ],
        nextStep: t('pipeline.inspector.hitlNext'),
        actionLabel: t('pipeline.inspector.openHitlBtn'),
        actionPath: '/dashboard/self-healing/approvals',
      };
    }

    if (id === 'stage:audit') {
      return {
        badge: t('pipeline.inspector.auditBadge'),
        accent: isAuditActive ? '#DC2626' : '#475569',
        bg: isAuditActive ? '#FEF2F2' : '#F8FAFC',
        title: t('pipeline.inspector.auditTitle', { service: selectedService }),
        statusText: isCircuitBreakerTripped ? t('pipeline.inspector.auditTrippedStatus') : t('pipeline.inspector.auditSafeStatus'),
        isAlert: isAuditActive,
        summary: t('pipeline.inspector.auditSummary'),
        rows: [
          { label: t('pipeline.inspector.auditStateRow'), value: isCircuitBreakerTripped ? t('pipeline.inspector.auditTripped') : t('pipeline.inspector.auditNormal'), highlight: isCircuitBreakerTripped },
          { label: t('pipeline.inspector.auditImpactRow'), value: t('pipeline.inspector.auditImpactVal') },
        ],
        nextStep: t('pipeline.inspector.auditNext'),
        actionLabel: t('pipeline.inspector.openAuditBtn'),
        actionPath: '/dashboard/audit-logs',
      };
    }

    if (id === 'stage:verify') {
      const timelineRows =
        actionTimeline.length > 0
          ? actionTimeline.slice(-4).map((step) => {
              const failureReason = step.isFailedOrUnrecovered
                ? String(
                    step.error_message ||
                      step.result?.error ||
                      step.verification?.verification_details?.message ||
                      step.verification_details?.message ||
                      ''
                  ).trim()
                : '';
              const shortReason = failureReason.length > 95 ? `${failureReason.slice(0, 92)}...` : failureReason;
              return {
                label: t('pipeline.inspector.verifyStepLabel', { step: step.stepIndex, action: step.actionLabelVi }),
                value: step.verdictLabel,
                subValue: shortReason ? `${step.timeStr} • ${shortReason}` : step.timeStr,
                highlight: step.isFailedOrUnrecovered,
                isRecovered: step.isVerifiedRecovered,
              };
            })
          : [
              { label: t('pipeline.inspector.verifyActionsCount'), value: t('pipeline.inspector.verifyZeroActions') },
              { label: t('pipeline.inspector.verifyServiceStatus'), value: openServiceIncidentsCount > 0 ? t('pipeline.inspector.verifyServiceOpen') : t('pipeline.inspector.verifyServiceHealthy') },
            ];

      return {
        badge: t('pipeline.inspector.verifyBadge'),
        accent: hasUnrecoveredStep ? '#DC2626' : '#0284C7',
        bg: hasUnrecoveredStep ? '#FEF2F2' : '#F0F9FF',
        title: t('pipeline.inspector.verifyTitle', { service: selectedService }),
        statusText:
          recoveryStats.runningCount > 0 || recoveryStats.verifyingCount > 0
            ? t('pipeline.inspector.verifyVerifying')
            : hasUnrecoveredStep && openServiceIncidentsCount > 0
              ? t('pipeline.inspector.verifyUnrecovered')
              : (recoveryStats.totalActions || actionTimeline.length) > 0
                ? t('pipeline.inspector.verifyTriedCount', { count: recoveryStats.totalActions || actionTimeline.length })
                : 'AUTO-RESOLVE',
        isAlert: Boolean(hasUnrecoveredStep && openServiceIncidentsCount > 0),
        summary: t('pipeline.inspector.verifySummary', { service: selectedService }),
        rows: [
          ...(podCount === 0
            ? [
                {
                  label: t('pipeline.inspector.verifyPodStatusRow'),
                  value: t('pipeline.inspector.verifyPodZero'),
                  highlight: false,
                },
              ]
            : []),
          {
            label:
              (recoveryStats.totalActions || 0) > actionTimeline.length
                ? t('pipeline.inspector.verifyTotalSubset', {
                    total: recoveryStats.totalActions,
                    recent: actionTimeline.length,
                    succeeded: recoveryStats.succeededCount,
                    failed: recoveryStats.failedCount,
                  })
                : t('pipeline.inspector.verifyTotalAll', {
                    total: actionTimeline.length,
                    succeeded: recoveryStats.succeededCount,
                    failed: recoveryStats.failedCount,
                  }),
            value: '',
            isFullWidth: true,
          },
          ...timelineRows,
        ],
        nextStep: podCount === 0
          ? t('pipeline.inspector.verifyNextZeroPods')
          : hasUnrecoveredStep && openServiceIncidentsCount > 0
            ? t('pipeline.inspector.verifyNextUnrecovered')
            : t('pipeline.inspector.verifyNextLoop'),
        actionLabel: t('pipeline.inspector.openHistoryBtn'),
        actionPath: '/dashboard/self-healing/history',
      };
    }

    // 6. Các giai đoạn trong Vòng lặp Tự trị Khép kín (Closed-Loop MAPE-K)
    if (id === 'closedloop:overview') {
      const activeCooldownSec = pipelineContext?.policyMeta?.cooldownSec || 60;
      return {
        title: t('pipeline.inspector.closedLoop.overviewTitle'),
        badge: t('pipeline.inspector.closedLoop.overviewBadge'),
        accent: '#0369A1',
        bg: '#F8FAFC',
        summary: t('pipeline.inspector.closedLoop.overviewSummary'),
        rows: [
          { label: t('pipeline.inspector.closedLoop.overviewRowArchLabel'), value: t('pipeline.inspector.closedLoop.overviewRowArchVal') },
          { label: t('pipeline.inspector.closedLoop.overviewRowSampleLabel'), value: t('pipeline.inspector.closedLoop.overviewRowSampleVal') },
          { label: t('pipeline.inspector.closedLoop.overviewRowAiTimeLabel'), value: t('pipeline.inspector.closedLoop.overviewRowAiTimeVal') },
          { label: t('pipeline.inspector.closedLoop.overviewRowSlaLabel'), value: t('pipeline.inspector.closedLoop.overviewRowSlaVal') },
          { label: t('pipeline.inspector.closedLoop.overviewRowGuardLabel'), value: t('pipeline.inspector.closedLoop.overviewRowGuardVal', { cooldown: activeCooldownSec }) },
        ],
        nextStep: t('pipeline.inspector.closedLoop.overviewNext'),
        actionLabel: t('pipeline.inspector.closedLoop.overviewBtn'),
        actionPath: '/dashboard/incidents',
      };
    }

    if (id === 'closedloop:monitor') {
      return {
        title: t('pipeline.inspector.closedLoop.monitorTitle'),
        badge: t('pipeline.inspector.closedLoop.monitorBadge'),
        accent: '#059669',
        bg: '#F0FDF4',
        summary: t('pipeline.inspector.closedLoop.monitorSummary'),
        rows: [
          { label: t('pipeline.inspector.closedLoop.monitorRowServiceLabel'), value: selectedService },
          { label: t('pipeline.inspector.closedLoop.monitorRowDimsLabel'), value: t('pipeline.inspector.closedLoop.monitorRowDimsVal') },
          { label: t('pipeline.inspector.closedLoop.monitorRowWindowLabel'), value: t('pipeline.inspector.closedLoop.monitorRowWindowVal') },
          { label: t('pipeline.inspector.closedLoop.monitorRowConnLabel'), value: isAgentConnected ? t('pipeline.inspector.closedLoop.monitorConnLive') : t('pipeline.inspector.closedLoop.monitorConnLost'), highlight: !isAgentConnected },
        ],
        nextStep: t('pipeline.inspector.closedLoop.monitorNext'),
        actionLabel: t('pipeline.inspector.closedLoop.monitorBtn'),
        actionPath: '/dashboard/telemetry',
      };
    }

    if (id === 'closedloop:analyze') {
      return {
        title: t('pipeline.inspector.closedLoop.analyzeTitle'),
        badge: t('pipeline.inspector.closedLoop.analyzeBadge'),
        accent: '#6366F1',
        bg: '#EEF2FF',
        summary: t('pipeline.inspector.closedLoop.analyzeSummary'),
        rows: [
          { label: t('pipeline.inspector.closedLoop.analyzeRowModelLabel'), value: t('pipeline.inspector.closedLoop.analyzeRowModelVal') },
          { label: t('pipeline.inspector.closedLoop.analyzeRowAgentsLabel'), value: t('pipeline.inspector.closedLoop.analyzeRowAgentsVal') },
          { label: t('pipeline.inspector.closedLoop.analyzeRowCauseLabel'), value: latestIncCauseText || t('pipeline.inspector.closedLoop.analyzeCauseStable') },
          { label: t('pipeline.inspector.closedLoop.analyzeRowConfLabel'), value: pipelineContext?.rcaAgentsSummary?.rcaConfidencePct ? `${pipelineContext.rcaAgentsSummary.rcaConfidencePct}%` : '85%' },
        ],
        nextStep: t('pipeline.inspector.closedLoop.analyzeNext'),
        actionLabel: t('pipeline.inspector.closedLoop.analyzeBtn'),
        actionPath: '/dashboard/rca',
      };
    }

    if (id === 'closedloop:plan_execute') {
      const activeCooldownSec = pipelineContext?.policyMeta?.cooldownSec || 60;
      return {
        title: t('pipeline.inspector.closedLoop.planTitle'),
        badge: t('pipeline.inspector.closedLoop.planBadge'),
        accent: '#D97706',
        bg: '#FFFBEB',
        summary: t('pipeline.inspector.closedLoop.planSummary', { cooldown: activeCooldownSec }),
        rows: [
          { label: t('pipeline.inspector.closedLoop.planRowGuardLabel'), value: t('pipeline.inspector.closedLoop.planRowGuardVal', { cooldown: activeCooldownSec }) },
          { label: t('pipeline.inspector.closedLoop.planRowDispatchLabel'), value: t('pipeline.inspector.closedLoop.planRowDispatchVal') },
          { label: t('pipeline.inspector.closedLoop.planRowActionsLabel'), value: t('pipeline.inspector.closedLoop.planRowActionsVal') },
          { label: t('pipeline.inspector.closedLoop.planRowDaemonLabel'), value: t('pipeline.inspector.closedLoop.planRowDaemonVal') },
        ],
        nextStep: t('pipeline.inspector.closedLoop.planNext'),
        actionLabel: t('pipeline.inspector.closedLoop.planBtn'),
        actionPath: '/dashboard/self-healing/approvals',
      };
    }

    if (id === 'closedloop:verify_feedback') {
      return {
        title: t('pipeline.inspector.closedLoop.verifyTitle'),
        badge: t('pipeline.inspector.closedLoop.verifyBadge'),
        accent: '#0284C7',
        bg: '#F0F9FF',
        summary: t('pipeline.inspector.closedLoop.verifySummary'),
        rows: [
          { label: t('pipeline.inspector.closedLoop.verifyRowWaitLabel'), value: t('pipeline.inspector.closedLoop.verifyRowWaitVal') },
          { label: t('pipeline.inspector.closedLoop.verifyRowSlaLabel'), value: t('pipeline.inspector.closedLoop.verifyRowSlaVal') },
          { label: t('pipeline.inspector.closedLoop.verifyRowSuccessLabel'), value: t('pipeline.inspector.closedLoop.verifyRowSuccessVal') },
          { label: t('pipeline.inspector.closedLoop.verifyRowFailLabel'), value: t('pipeline.inspector.closedLoop.verifyRowFailVal') },
        ],
        nextStep: t('pipeline.inspector.closedLoop.verifyNext'),
        actionLabel: t('pipeline.inspector.closedLoop.verifyBtn'),
        actionPath: '/dashboard/self-healing/history',
      };
    }

    return null;
  };

  const activeInspector = pinnedInspector || hoveredInspector;
  const activeInspectorData = activeInspector ? getInspectorContent(activeInspector.id) : null;
  const isInspectorPinned = Boolean(pinnedInspector);

  // ==========================================
  // THUẬT TOÁN VẼ MINI TELEMETRY WAVEFORM CHART (T1..T12)
  // ==========================================
  const miniChartW = 414;
  const miniChartH = 195;
  const chartPad = { top: 26, right: 12, bottom: 22, left: 28 };
  const innerW = miniChartW - chartPad.left - chartPad.right;
  const innerH = miniChartH - chartPad.top - chartPad.bottom;

  // Chuẩn bị danh sách 12 bước thời gian: khi mất kết nối Agent / Cụm trả toàn bộ bằng 0 (không vẽ sóng giả!)
  const effectiveTimesteps = useMemo(() => {
    if (!isAgentConnected) {
      return Array.from({ length: 12 }, (_, i) => ({
        stepLabel: `T${i + 1}`,
        cpu: 0,
        ram: 0,
        disk: 0,
        latency: 0,
        request_rate: 0,
        http_5xx_rate: 0,
        error_5xx: 0,
        pod_restart_count: 0,
        replica_count: 0,
      }));
    }
    if (timesteps && timesteps.length >= 2) return timesteps;
    // Khi đang kết nối nhưng chưa gom đủ mẫu ban đầu -> đường nền bằng 0 trung thực
    return Array.from({ length: 12 }, (_, i) => ({
      stepLabel: `T${i + 1}`,
      cpu: parseFloat(liveMetrics.cpu?.latest) || 0,
      ram: parseFloat(liveMetrics.ram?.latest) || 0,
      disk: parseFloat(liveMetrics.disk?.latest) || 0,
      latency: parseFloat(liveMetrics.latency?.latest) || 0,
      request_rate: parseFloat(liveMetrics.request_rate?.latest) || 0,
      http_5xx_rate: parseFloat(liveMetrics.http_5xx_rate?.latest) || 0,
      error_5xx: parseFloat(liveMetrics.http_5xx_rate?.latest) || 0,
      pod_restart_count: parseFloat(liveMetrics.pod_restart_count?.latest) || 0,
      replica_count: parseFloat(liveMetrics.replica_count?.latest) || (podCount || 1),
    }));
  }, [isAgentConnected, timesteps, liveMetrics, podCount]);

  // Tính Y max & Ticks cho biểu đồ mini
  const chartMaxY = useMemo(() => {
    if (scaleMode === 'standard') return 100;
    let maxFound = 100;
    for (const t of effectiveTimesteps) {
      for (const cfg of METRIC_CONFIGS) {
        const val = Number(t[cfg.key] || 0);
        if (val > maxFound) maxFound = val;
      }
    }
    return Math.ceil(maxFound * 1.08);
  }, [scaleMode, effectiveTimesteps, METRIC_CONFIGS]);

  const yTicks = [0, 25, 50, 75, 100];

  const getMiniX = (index) => {
    const total = Math.max(effectiveTimesteps.length - 1, 1);
    return chartPad.left + (index / total) * innerW;
  };

  const getMiniY = (value) => {
    const clamped = Math.max(0, Math.min(value, chartMaxY));
    return chartPad.top + innerH - (clamped / chartMaxY) * innerH;
  };

  // Tính toán cột quét viễn trắc (Sweep bar)
  const totalStepsCount = effectiveTimesteps.length || 12;
  const activeSweepIdx = (totalStepsCount - 1) - Math.min(Math.max((currentActiveStep || 1) - 1, 0), totalStepsCount - 1);
  const sweepTargetX = getMiniX(activeSweepIdx);
  const currentStepLabel = effectiveTimesteps[activeSweepIdx]?.stepLabel || `T${activeSweepIdx + 1}`;

  // Chiều cao tự thích ứng của khung Canvas để vừa khít 100% không bị tràn dọc
  const canvasHeight = useMemo(() => Math.max(380, Math.round(baseCanvasH * autoScale)), [baseCanvasH, autoScale]);

  // Nền lưới chấm đồng bộ 1:1 theo pan & zoom giống Google Stitch / Figma (dùng DUY NHẤT 1 background chung trên .dashboard-root-layout khi isFullScreen)
  const effectiveScale = zoom * autoScale;
  const syncedGridStep = Math.max(8, 22 * effectiveScale);
  const syncedDotRadius = Math.max(0.85, Math.min(2.6, 1.45 * effectiveScale));
  const syncedBgX = containerWidth / 2 + pan.x;
  const syncedBgY = (isFullScreen ? containerHeight / 2 : 0) + pan.y;

  useEffect(() => {
    if (!isFullScreen || !containerRef.current) return;
    const rootEl = containerRef.current.closest('.dashboard-root-layout');
    if (!rootEl) return;
    const rect = containerRef.current.getBoundingClientRect();
    const absX = rect.left + rect.width / 2 + pan.x;
    const absY = rect.top + rect.height / 2 + pan.y;
    rootEl.style.setProperty('--canvas-grid-step', `${syncedGridStep.toFixed(2)}px`);
    rootEl.style.setProperty('--canvas-dot-r', `${syncedDotRadius.toFixed(2)}px`);
    rootEl.style.setProperty('--canvas-bg-x', `${absX.toFixed(1)}px`);
    rootEl.style.setProperty('--canvas-bg-y', `${absY.toFixed(1)}px`);
  }, [isFullScreen, syncedGridStep, syncedDotRadius, pan.x, pan.y, containerWidth, containerHeight]);

  useEffect(() => {
    if (!isFullScreen) return;
    return () => {
      const rootEl = document.querySelector('.dashboard-root-layout');
      if (!rootEl) return;
      rootEl.style.removeProperty('--canvas-grid-step');
      rootEl.style.removeProperty('--canvas-dot-r');
      rootEl.style.removeProperty('--canvas-bg-x');
      rootEl.style.removeProperty('--canvas-bg-y');
    };
  }, [isFullScreen]);

  const isMobileViewport = containerWidth <= 860;
  const isMobileVerticalMode = isMobileViewport && !preferHorizontalOnMobile;

  if (isMobileVerticalMode) {
    return (
      <div
        ref={containerRef}
        style={{
          position: 'relative',
          width: '100%',
          height: 'auto',
          backgroundColor: isFullScreen ? 'transparent' : '#F8FAFC',
          borderRadius: isFullScreen ? 0 : '12px',
          border: isFullScreen ? 'none' : '1px solid #E2E8F0',
        }}
      >
        <AIPipelineMobileVerticalFlow
          showExtendedPipeline={showExtendedPipeline}
          activeDiagram={activeDiagram}
          onSwitchDiagram={handleSwitchDiagram}
          onSwitchToHorizontal={() => setPreferHorizontalOnMobile(true)}
          selectedService={selectedService}
          podCount={podCount}
          isAgentConnected={isAgentConnected}
          metricConfigs={METRIC_CONFIGS}
          liveMetrics={liveMetrics}
          effectiveTimesteps={effectiveTimesteps}
          chartMaxY={chartMaxY}
          activeSweepIdx={activeSweepIdx}
          currentStepLabel={currentStepLabel}
          prediction={prediction}
          rawRiskScore={rawRiskScore}
          isPredictionHealthy={isPredictionHealthy}
          isRiskDetected={isRiskDetected}
          isBenignDbCacheState={isBenignDbCacheState}
          isScaleDownOptimization={isScaleDownOptimization}
          allRiskEvaluations={allRiskEvaluations}
          triggeredRisksList={triggeredRisksList}
          topRiskEval={topRiskEval}
          ruleEngineChecks={ruleEngineChecks}
          triggeredRuleCount={triggeredRuleCount}
          isRuleEngineTriggered={isRuleEngineTriggered}
          latestIncident={latestIncident}
          lastResolvedIncident={lastResolvedIncident}
          openServiceIncidentsCount={openServiceIncidentsCount}
          latestRecommendation={latestRecommendation}
          latestAutoAction={latestAutoAction}
          latestHitlApproval={latestHitlApproval}
          pendingApprovalsCount={pendingApprovalsCount}
          isCircuitBreakerTripped={isCircuitBreakerTripped}
          actionTimeline={actionTimeline}
          recoveryStats={recoveryStats}
          pipelineContext={pipelineContext}
          isRcaActive={isRcaActive}
          isAutoActionActive={isAutoActionActive}
          isAutoActionInProgress={isAutoActionInProgress}
          isHitlActive={isHitlActive}
          isAuditActive={isAuditActive}
          isVerifyingInProgress={isVerifyingInProgress}
          hasUnrecoveredStep={hasUnrecoveredStep}
          simulatedCauseCode={d2SimulatedCause}
          onSelectSimulatedCause={(code) => {
            setD2VerifyOutcome('auto');
            setD2SimulatedCause((prev) => (prev === code ? null : code));
          }}
          onClearSimulation={() => {
            setD2VerifyOutcome('auto');
            setD2SimulatedCause(null);
          }}
          verifyOutcomeMode={d2VerifyOutcome}
          onChangeVerifyOutcome={(mode) => setD2VerifyOutcome((prev) => (prev === mode ? 'auto' : mode))}
          onNavigate={onNavigate}
        />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        height: isMobileViewport && preferHorizontalOnMobile ? '72vh' : isFullScreen ? '100%' : `${canvasHeight}px`,
        minHeight: isMobileViewport && preferHorizontalOnMobile ? '460px' : 0,
        flex: isFullScreen ? 1 : 'none',
        backgroundColor: isFullScreen ? 'transparent' : '#F8FAFC',
        backgroundImage: isFullScreen
          ? 'none'
          : `radial-gradient(circle, #CBD5E1 ${syncedDotRadius.toFixed(2)}px, transparent ${(syncedDotRadius + 0.35).toFixed(2)}px)`,
        backgroundSize: isFullScreen ? 'auto' : `${syncedGridStep.toFixed(2)}px ${syncedGridStep.toFixed(2)}px`,
        backgroundPosition: isFullScreen ? '0 0' : `${syncedBgX.toFixed(1)}px ${syncedBgY.toFixed(1)}px`,
        borderRadius: isFullScreen ? 0 : '12px',
        border: isFullScreen ? 'none' : '1px solid #E2E8F0',
        overflow: 'hidden',
        userSelect: 'none',
        cursor: isDragging ? 'grabbing' : 'grab',
        boxShadow: isFullScreen ? 'none' : 'inset 0 2px 6px rgba(0,0,0,0.02)',
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Thanh điều khiển Canvas ToolBar (Focus Giai đoạn + Pan/Zoom/Reset) */}
      <div
        className="canvas-bottom-toolbar"
        style={{
          position: 'absolute',
          ...(isFullScreen ? { bottom: '16px', right: '18px' } : { top: '12px', right: '14px' }),
          zIndex: 30,
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          backgroundColor: 'rgba(255, 255, 255, 0.96)',
          backdropFilter: 'blur(10px)',
          padding: '5px 10px',
          borderRadius: '12px',
          border: '1px solid #E2E8F0',
          boxShadow: '0 4px 16px rgba(15, 23, 42, 0.08)',
        }}
      >
        {isMobileViewport && preferHorizontalOnMobile && (
          <>
            <button
              type="button"
              data-testid="toggle-mobile-layout-mode"
              onClick={() => setPreferHorizontalOnMobile(false)}
              style={{
                padding: '4px 9px',
                borderRadius: '7px',
                border: '1px solid #059669',
                backgroundColor: '#ECFDF5',
                color: '#047857',
                fontSize: '0.6875rem',
                fontWeight: 800,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {t('pipeline.canvas.verticalModeBtn')}
            </button>
            <div style={{ width: '1px', height: '16px', backgroundColor: '#E2E8F0', margin: '0 2px' }} />
          </>
        )}
        {showExtendedPipeline && (
          <>
            {/* Bộ chuyển nhanh giữa Sơ đồ 1 (Tổng quan) và Sơ đồ 2 (Rẽ nhánh 01→07) */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
                padding: '2px',
                borderRadius: '8px',
                backgroundColor: '#F1F5F9',
                border: '1px solid #CBD5E1',
              }}
            >
              {[
                { id: 'diagram1', label: t('pipeline.canvas.diagram1'), testId: 'switch-diagram-1' },
                { id: 'diagram2', label: t('pipeline.canvas.diagram2'), testId: 'switch-diagram-2' },
              ].map((dTab) => {
                const isDiagSelected = activeDiagram === dTab.id;
                return (
                  <button
                    key={dTab.id}
                    type="button"
                    data-testid={dTab.testId}
                    onClick={() => handleSwitchDiagram(dTab.id)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '6px',
                      border: 'none',
                      backgroundColor: isDiagSelected ? (dTab.id === 'diagram2' ? '#7C3AED' : '#0F172A') : 'transparent',
                      color: isDiagSelected ? '#FFFFFF' : '#475569',
                      fontSize: '0.6875rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      boxShadow: isDiagSelected ? '0 1px 3px rgba(15, 23, 42, 0.2)' : 'none',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {dTab.label}
                  </button>
                );
              })}
            </div>
            <div style={{ width: '1px', height: '16px', backgroundColor: '#E2E8F0', margin: '0 2px' }} />
            {(activeDiagram === 'diagram2'
              ? [
                  { id: 'd2_front', label: t('pipeline.canvas.d2Front') },
                  { id: 'd2_branched', label: t('pipeline.canvas.d2Branched') },
                  { id: 'all', label: t('pipeline.canvas.d2All') },
                ]
              : [
                  { id: 'gru', label: t('pipeline.canvas.d1Gru') },
                  { id: 'healing', label: t('pipeline.canvas.d1Healing') },
                  { id: 'all', label: t('pipeline.canvas.d1All') },
                ]
            ).map((tab) => {
              const isSelected = activeViewMode === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleFocusView(tab.id)}
                  style={{
                    padding: '4px 9px',
                    borderRadius: '7px',
                    border: isSelected ? '1px solid #3B82F6' : '1px solid transparent',
                    backgroundColor: isSelected ? '#EFF6FF' : 'transparent',
                    color: isSelected ? '#1D4ED8' : '#475569',
                    fontSize: '0.6875rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
            <div style={{ width: '1px', height: '16px', backgroundColor: '#E2E8F0', margin: '0 2px' }} />
          </>
        )}
        <span
          style={{
            fontSize: '0.6875rem',
            fontWeight: 700,
            fontFamily: 'var(--font-mono)',
            color: '#64748B',
            marginRight: '2px',
          }}
        >
          {Math.round(zoom * autoScale * 100)}%
        </span>
        <button
          onClick={handleZoomIn}
          title={t('pipeline.canvas.zoomInTitle')}
          style={{
            background: 'none',
            border: 'none',
            padding: '4px',
            borderRadius: '4px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            color: '#334155',
          }}
        >
          <ZoomIn size={14} />
        </button>
        <button
          onClick={handleZoomOut}
          title={t('pipeline.canvas.zoomOutTitle')}
          style={{
            background: 'none',
            border: 'none',
            padding: '4px',
            borderRadius: '4px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            color: '#334155',
          }}
        >
          <ZoomOut size={14} />
        </button>
        <button
          onClick={handleReset}
          title={t('pipeline.canvas.resetViewTitle')}
          style={{
            background: 'none',
            border: 'none',
            padding: '4px',
            borderRadius: '4px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            color: '#334155',
          }}
        >
          <RotateCcw size={14} />
        </button>
      </div>

      {/* Huy hiệu chế độ Workflow góc trên bên trái (chỉ hiển thị khi không ở chế độ full màn hình Overview) */}
      {!isFullScreen && (
        <div
          style={{
            position: 'absolute',
            top: '12px',
            left: '14px',
            zIndex: 30,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(8px)',
            padding: '5px 12px',
            borderRadius: '8px',
            border: '1px solid #E2E8F0',
            boxShadow: '0 4px 12px rgba(15, 23, 42, 0.06)',
          }}
        >
          <div
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: isRiskDetected ? '#EF4444' : '#10B981',
              boxShadow: `0 0 8px ${isRiskDetected ? 'rgba(239, 68, 68, 0.6)' : 'rgba(16, 185, 129, 0.6)'}`,
            }}
          />
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#1E293B' }}>
            {t('pipeline.canvas.workflowTitle')}
          </span>
          <span
            style={{
              fontSize: '0.6875rem',
              padding: '2px 8px',
              borderRadius: '4px',
              backgroundColor: '#F1F5F9',
              color: '#2563EB',
              fontFamily: 'var(--font-mono)',
              fontWeight: 700,
            }}
          >
            {selectedService}
          </span>
        </div>
      )}

      {/* Vùng Canvas chính: Tự động căn giữa và co giãn vừa khít 100% khung */}
      <div
        style={{
          position: 'absolute',
          top: isFullScreen ? '50%' : 0,
          left: '50%',
          width: `${baseCanvasW}px`,
          height: `${baseCanvasH}px`,
          transform: isFullScreen
            ? `translate(-50%, -50%) translate(${pan.x}px, ${pan.y}px) scale(${effectiveScale})`
            : `translateX(-50%) translate(${pan.x}px, ${pan.y}px) scale(${effectiveScale})`,
          transformOrigin: isFullScreen ? 'center center' : 'top center',
          transition: isDragging || isWheelZooming ? 'none' : 'transform 0.24s cubic-bezier(0.22, 1, 0.36, 1)',
          willChange: 'transform',
          pointerEvents: 'auto',
        }}
      >
        {(!showExtendedPipeline || activeDiagram === 'diagram1') && (
          <>
        {/* Stage Header Pills phía trên các giai đoạn (nhấn vào pill đang mở để thu gọn nhanh) */}
        {showExtendedPipeline &&
          [
            { x: LEFT_X, w: LEFT_W, top: isTelemetryExpanded ? LEFT_Y_START - 32 : LEFT_COMPACT_Y - 32, step: '01', label: t('pipeline.canvas.pills.telemetry'), color: '#059669', bg: '#ECFDF5', border: '#A7F3D0', groupId: 'telemetry', isOpen: isTelemetryExpanded },
            { x: CENTER_X, w: CENTER_W, top: CENTER_Y - 36, step: '02', label: t('pipeline.canvas.pills.aiHub'), color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE' },
            { x: RIGHT_X, w: RIGHT_W, top: isRisksExpanded ? RIGHT_Y_START - 36 : RIGHT_COMPACT_Y - 32, step: '03', label: t('pipeline.canvas.pills.risks'), color: '#DC2626', bg: '#FEF2F2', border: '#FECACA', groupId: 'risks', isOpen: isRisksExpanded },
            { x: RCA_X, w: RCA_W, top: Math.max(12, RCA_Y - 36), step: '04', label: t('pipeline.canvas.pills.rca'), color: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE' },
            { x: POLICY_X, w: POLICY_W, top: POLICY_Y - 36, step: '05', label: t('pipeline.canvas.pills.policy'), color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
            { x: BRANCH_X, w: BRANCH_W, top: isBranchesExpanded ? AUTO_Y - 36 : BRANCH_COMPACT_Y - 32, step: '06', label: t('pipeline.canvas.pills.branches'), color: '#0F766E', bg: '#F0FDFA', border: '#99F6E4', groupId: 'branches', isOpen: isBranchesExpanded },
            { x: VERIFY_X, w: VERIFY_W, top: VERIFY_Y - 36, step: '07', label: t('pipeline.canvas.pills.verify'), color: '#0284C7', bg: '#F0F9FF', border: '#BAE6FD' },
          ].map((col) => (
            <div
              key={col.step}
              style={{
                position: 'absolute',
                left: `${col.x}px`,
                top: `${col.top}px`,
                width: `${col.w}px`,
                display: 'flex',
                justifyContent: 'center',
                gap: '6px',
                pointerEvents: col.groupId ? 'auto' : 'none',
                zIndex: 14,
              }}
            >
              <span
                onMouseDown={col.groupId ? (e) => e.stopPropagation() : undefined}
                onClick={col.groupId ? (e) => toggleExpandGroup(e, col.groupId) : undefined}
                title={col.groupId ? (col.isOpen ? t('pipeline.canvas.pills.collapseTooltip') : t('pipeline.canvas.pills.expandTooltip')) : undefined}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '3px 10px',
                  borderRadius: '999px',
                  backgroundColor: col.bg,
                  border: `1px solid ${col.border}`,
                  color: col.color,
                  fontSize: '0.625rem',
                  fontWeight: 800,
                  letterSpacing: '0.03em',
                  whiteSpace: 'nowrap',
                  boxShadow: '0 2px 6px rgba(15, 23, 42, 0.04)',
                  cursor: col.groupId ? 'pointer' : 'default',
                }}
              >
                <span style={{ opacity: 0.7 }}>{col.step}</span>
                <span>{col.label}</span>
                {col.groupId && (
                  <span
                    style={{
                      marginLeft: '2px',
                      padding: '0 5px',
                      borderRadius: '999px',
                      backgroundColor: '#FFFFFF',
                      border: `1px solid ${col.border}`,
                      fontSize: '0.58rem',
                      fontWeight: 800,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {col.isOpen ? t('pipeline.canvas.pills.compactBtn') : t('pipeline.canvas.pills.expandBtn')}
                  </span>
                )}
              </span>
            </div>
          ))}

        {/* Layer 1: SVG Edges (Đường nối Bezier mềm mại + Hạt sáng chuyển động) */}
        <svg
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: `${baseCanvasW}px`,
            height: `${baseCanvasH}px`,
            pointerEvents: 'none',
            zIndex: 1,
          }}
        >
          <defs>
            <marker
              id="arrow-feedback"
              viewBox="0 0 10 10"
              refX="7"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 8 5 L 0 9 z" fill="#0284C7" />
            </marker>
            <marker
              id="arrow-rule"
              viewBox="0 0 10 10"
              refX="7"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 8 5 L 0 9 z" fill={isRuleEngineTriggered ? '#EA580C' : '#94A3B8'} />
            </marker>
          </defs>

          {/* 1. Các đường cong nối từ 6 Metric Inputs vào AI Hub (dừng hoàn toàn hiệu ứng chạy khi mất kết nối) */}
          {inputEdges.map((edge) => (
            <g key={edge.id}>
              <path
                d={edge.pathD}
                fill="none"
                stroke={isAgentConnected && hoveredEdge === edge.id ? edge.color : '#CBD5E1'}
                strokeWidth={isAgentConnected && hoveredEdge === edge.id ? 2.5 : 2}
                strokeDasharray={isAgentConnected ? 'none' : '4 3'}
                strokeLinecap="round"
                opacity={isAgentConnected ? 1 : 0.7}
                style={{ transition: 'stroke 0.2s, stroke-width 0.2s' }}
              />
              {isAgentConnected && (
                <circle r="3.5" fill={edge.color}>
                  <animateMotion
                    path={edge.pathD}
                    dur="2.8s"
                    repeatCount="indefinite"
                    rotate="auto"
                  />
                </circle>
              )}
            </g>
          ))}

          {/* 2. Các đường cong nối từ AI Hub sang 7 Khối rủi ro GRU */}
          {outputEdges.map((edge) => (
            <g key={edge.id}>
              <path
                d={edge.pathD}
                fill="none"
                stroke={edge.isTriggered ? '#EF4444' : '#CBD5E1'}
                strokeWidth={edge.isTriggered ? 2.5 : 1.8}
                strokeLinecap="round"
                strokeDasharray={edge.isTriggered ? 'none' : '4 2'}
              />
              {edge.isTriggered && (
                <circle r="4" fill="#EF4444">
                  <animateMotion
                    path={edge.pathD}
                    dur="1.8s"
                    repeatCount="indefinite"
                    rotate="auto"
                  />
                </circle>
              )}
            </g>
          ))}

          {/* 3. Các đường cong mở rộng sau GRU (Cột 3 → 4 → 5 → 6 → 7 + Vòng lặp hồi tiếp) */}
          {showExtendedPipeline && (
            <>
              {/* 3a. 7 Đầu Rủi Ro → Multi-Agent RCA Hub */}
              {rcaInEdges.map((edge) => (
                <g key={edge.id}>
                  <path
                    d={edge.pathD}
                    fill="none"
                    stroke={edge.isTriggered ? '#EF4444' : '#CBD5E1'}
                    strokeWidth={edge.isTriggered ? 2.5 : 1.6}
                    strokeLinecap="round"
                    strokeDasharray={edge.isTriggered ? 'none' : '4 3'}
                  />
                  {edge.isTriggered && (
                    <circle r="4" fill="#EF4444">
                      <animateMotion path={edge.pathD} dur="1.7s" repeatCount="indefinite" rotate="auto" />
                    </circle>
                  )}
                </g>
              ))}

              {/* 3b. Multi-Agent RCA → Policy Engine */}
              <g>
                <path
                  d={rcaToPolicyPath}
                  fill="none"
                  stroke={isRcaActive ? '#7C3AED' : '#CBD5E1'}
                  strokeWidth={isRcaActive ? 2.6 : 2}
                  strokeLinecap="round"
                  strokeDasharray={isRcaActive ? 'none' : '5 3'}
                />
                {isRcaActive && (
                  <circle r="4" fill="#7C3AED">
                    <animateMotion path={rcaToPolicyPath} dur="1.5s" repeatCount="indefinite" rotate="auto" />
                  </circle>
                )}
              </g>

              {/* 3c. Policy Engine → 3 Nhánh (AUTO / HITL / AUDIT) */}
              {policyBranchEdges.map((edge) => (
                <g key={edge.id}>
                  <path
                    d={edge.pathD}
                    fill="none"
                    stroke={edge.active ? edge.color : '#CBD5E1'}
                    strokeWidth={edge.active ? 2.6 : 1.8}
                    strokeLinecap="round"
                    strokeDasharray={edge.active ? 'none' : '5 3'}
                  />
                  {edge.animating && (
                    <circle r="4" fill={edge.color}>
                      <animateMotion path={edge.pathD} dur="1.6s" repeatCount="indefinite" rotate="auto" />
                    </circle>
                  )}
                </g>
              ))}

              {/* 3d. Nhánh AUTO & Nhánh HITL → Hậu kiểm Phục hồi */}
              {branchToVerifyEdges.map((edge) => (
                <g key={edge.id}>
                  <path
                    d={edge.pathD}
                    fill="none"
                    stroke={edge.active ? edge.color : '#CBD5E1'}
                    strokeWidth={edge.active ? 2.4 : 1.8}
                    strokeLinecap="round"
                    strokeDasharray={edge.active ? 'none' : '5 3'}
                  />
                  {edge.animating && (
                    <circle r="3.8" fill={edge.color}>
                      <animateMotion path={edge.pathD} dur="1.8s" repeatCount="indefinite" rotate="auto" />
                    </circle>
                  )}
                </g>
              ))}

              {/* 3f. Nhánh Song Song: Bus Viễn Trắc → Rule Engine → Cổng trên Multi-Agent RCA */}
              <g>
                {/* Điểm tách nhánh từ Bus Viễn Trắc Cột 1 */}
                <circle cx={ruleTapStart.x} cy={ruleTapStart.y} r="4" fill={isAgentConnected ? '#EA580C' : '#94A3B8'} />
                <path
                  d={ruleInPath}
                  fill="none"
                  stroke={!isAgentConnected ? '#CBD5E1' : isRuleEngineTriggered ? '#EA580C' : '#F59E0B'}
                  strokeWidth={isRuleEngineTriggered ? 2.5 : 2}
                  strokeDasharray={isAgentConnected ? 'none' : '4 3'}
                  strokeLinecap="round"
                  opacity={!isAgentConnected ? 0.65 : isRuleEngineTriggered ? 1 : 0.75}
                />
                {isAgentConnected && (
                  <circle r="3.5" fill="#EA580C">
                    <animateMotion path={ruleInPath} dur="2.2s" repeatCount="indefinite" rotate="auto" />
                  </circle>
                )}

                {/* Đường ra từ Rule Engine → Cổng dưới Multi-Agent RCA */}
                <path
                  d={ruleToRcaPath}
                  fill="none"
                  stroke={isRuleEngineTriggered ? '#EA580C' : '#CBD5E1'}
                  strokeWidth={isRuleEngineTriggered ? 2.6 : 1.9}
                  strokeDasharray={isRuleEngineTriggered ? 'none' : '5 3'}
                  strokeLinecap="round"
                  markerEnd="url(#arrow-rule)"
                />
                {isRuleEngineTriggered && (
                  <circle r="4.2" fill="#EA580C">
                    <animateMotion path={ruleToRcaPath} dur="1.6s" repeatCount="indefinite" rotate="auto" />
                  </circle>
                )}
              </g>

              {/* 3e. Vòng lặp hồi tiếp phía dưới (Hậu kiểm 60s → Đầu vào Viễn trắc) */}
              <g>
                <path
                  d={feedbackLoopPath}
                  fill="none"
                  stroke={isVerifyActive ? '#0284C7' : '#0EA5E9'}
                  strokeWidth={isVerifyActive ? 2.4 : 1.8}
                  strokeDasharray={isVerifyActive ? 'none' : '6 4'}
                  strokeLinecap="round"
                  markerEnd="url(#arrow-feedback)"
                  opacity={isVerifyActive ? 1 : 0.8}
                />
                <circle r={isVerifyActive ? 4 : 3.2} fill={isVerifyActive ? '#0284C7' : '#0EA5E9'}>
                  <animateMotion path={feedbackLoopPath} dur={isVerifyActive ? '3.8s' : '6.5s'} repeatCount="indefinite" rotate="auto" />
                </circle>
              </g>
            </>
          )}
        </svg>

        {/* Layer 2: Cột Trái - 8 Metric Input Nodes (Thu gọn 1 thẻ ↔ Nhấn bung đủ 8 thẻ nguyên bản) */}
        {isTelemetryExpanded ? (
          METRIC_CONFIGS.map((cfg, idx) => {
          const live = liveMetrics[cfg.key] || { latest: '0.00', avg: '0.00', max: '0.00' };
          const IconComp = cfg.icon;
          const nodeY = LEFT_Y_START + idx * (LEFT_H + LEFT_GAP);

          return (
            <div
              key={cfg.key}
              data-inspector-trigger="true"
              onMouseEnter={(e) => {
                setHoveredEdge(`edge-in-${cfg.key}`);
                setHoveredNode(cfg.key);
                handleInspectorHover(e, `metric:${cfg.key}`);
              }}
              onMouseLeave={() => {
                setHoveredEdge(null);
                setHoveredNode(null);
                handleInspectorLeave(`metric:${cfg.key}`);
              }}
              onClick={(e) => handleInspectorClick(e, `metric:${cfg.key}`)}
              style={{
                position: 'absolute',
                left: `${LEFT_X}px`,
                top: `${nodeY}px`,
                width: `${LEFT_W}px`,
                height: `${LEFT_H}px`,
                backgroundColor: '#FFFFFF',
                borderRadius: '8px',
                border: `1.5px solid ${pinnedInspector?.id === `metric:${cfg.key}` ? cfg.color : live.isWarning ? '#FCA5A5' : '#E2E8F0'}`,
                boxShadow: live.isWarning
                  ? '0 4px 12px rgba(239, 68, 68, 0.15)'
                  : hoveredNode === cfg.key || pinnedInspector?.id === `metric:${cfg.key}`
                    ? '0 6px 14px rgba(15, 23, 42, 0.1)'
                    : '0 2px 8px rgba(15, 23, 42, 0.04)',
                display: 'flex',
                alignItems: 'center',
                padding: '0 8px',
                gap: '7px',
                zIndex: 10,
                cursor: 'pointer',
                transform: hoveredNode === cfg.key ? 'translateY(-1px)' : 'none',
                transition: 'transform 0.15s, box-shadow 0.15s, border-color 0.15s',
              }}
            >
              {/* Icon Container bên trái */}
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '6px',
                  backgroundColor: cfg.bgColor,
                  border: `1px solid ${cfg.borderColor}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  color: cfg.color,
                }}
              >
                <IconComp size={15} />
              </div>

              {/* Thông tin Chỉ số (Tên & Live Telemetry Metrics) */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: '0.5rem',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    color: '#94A3B8',
                    lineHeight: 1.1,
                  }}
                >
                  Metric Input
                </div>
                <div
                  style={{
                    fontSize: '0.6875rem',
                    fontWeight: 700,
                    color: '#1E293B',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    lineHeight: 1.2,
                  }}
                >
                  {cfg.label}
                </div>
                {/* Dữ liệu thực tế: Hiện tại | TB */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '0.58rem',
                    fontFamily: 'var(--font-mono)',
                    color: '#64748B',
                    marginTop: '1px',
                  }}
                >
                  <span style={{ color: live.isWarning ? '#DC2626' : '#0F172A', fontWeight: 700 }}>
                    {live.latest} {cfg.unit}
                  </span>
                  <span style={{ color: '#CBD5E1' }}>•</span>
                  <span>TB: {live.avg}</span>
                </div>
              </div>

              {/* Cổng kết nối Output Handle (+) ở cạnh phải của thẻ */}
              <div
                style={{
                  position: 'absolute',
                  right: '-8px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: '16px',
                  height: '16px',
                  borderRadius: '50%',
                  backgroundColor: '#FFFFFF',
                  border: '2px solid #94A3B8',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.625rem',
                  fontWeight: 700,
                  color: '#64748B',
                  zIndex: 12,
                }}
              >
                +
              </div>
            </div>
          );
        })
        ) : (
          <div
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => toggleExpandGroup(e, 'telemetry')}
            onMouseEnter={() => setHoveredNode('compact-telemetry')}
            onMouseLeave={() => setHoveredNode(null)}
            style={{
              position: 'absolute',
              left: `${LEFT_X}px`,
              top: `${LEFT_COMPACT_Y}px`,
              width: `${LEFT_W}px`,
              height: `${LEFT_COMPACT_H}px`,
              backgroundColor: '#FFFFFF',
              borderRadius: '14px',
              border: `1.5px solid ${hoveredNode === 'compact-telemetry' ? '#10B981' : warningMetricsCount > 0 ? '#FCA5A5' : '#CBD5E1'}`,
              borderTop: `3px solid ${isAgentConnected ? (warningMetricsCount > 0 ? '#F59E0B' : '#10B981') : '#CBD5E1'}`,
              boxShadow: hoveredNode === 'compact-telemetry' ? '0 10px 24px rgba(16, 185, 129, 0.16)' : '0 4px 14px rgba(15, 23, 42, 0.06)',
              padding: '12px 13px',
              boxSizing: 'border-box',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              cursor: 'pointer',
              zIndex: 12,
              transition: 'border-color 0.15s, box-shadow 0.15s',
            }}
          >
            {/* Cổng ra bên phải */}
            <div style={{ position: 'absolute', right: '-6px', top: '50%', transform: 'translateY(-50%)', width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#10B981', border: '2px solid #FFFFFF', zIndex: 15 }} />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ fontSize: '0.625rem', fontWeight: 800, color: '#059669' }}>METRIC INPUT</span>
                <span style={{ fontSize: '0.62rem', fontWeight: 800, padding: '1px 6px', borderRadius: '999px', backgroundColor: !isAgentConnected ? '#F1F5F9' : warningMetricsCount > 0 ? '#FEF3C7' : '#ECFDF5', color: !isAgentConnected ? '#64748B' : warningMetricsCount > 0 ? '#B45309' : '#059669' }}>
                  {!isAgentConnected ? 'Offline' : warningMetricsCount > 0 ? t('pipeline.canvas.compactMetrics.warningCount', { count: warningMetricsCount }) : t('pipeline.canvas.compactMetrics.stableCount', { count: METRIC_CONFIGS.length, total: METRIC_CONFIGS.length })}
                </span>
              </div>
              <div style={{ fontSize: '0.84rem', fontWeight: 800, color: '#0F172A' }}>{t('pipeline.canvas.compactMetrics.title')}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '0.72rem', fontFamily: 'var(--font-mono)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748B' }}>CPU / RAM</span>
                <span style={{ fontWeight: 700, color: '#0F172A' }}>{liveCpuVal.toFixed(1)}% / {liveRamVal.toFixed(1)}%</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748B' }}>Latency</span>
                <span style={{ fontWeight: 700, color: liveLatVal > 200 ? '#DC2626' : '#7C3AED' }}>{liveLatVal.toFixed(0)} ms</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748B' }}>Req/s • 5xx</span>
                <span style={{ fontWeight: 700, color: live5xxVal > 5 ? '#DC2626' : '#0891B2' }}>{liveReqVal.toFixed(1)} • {live5xxVal.toFixed(1)}%</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748B' }}>Restarts • Pods</span>
                <span style={{ fontWeight: 700, color: (parseFloat(liveMetrics.pod_restart_count?.latest) || 0) > 0 ? '#DC2626' : '#6366F1' }}>
                  {t('pipeline.canvas.compactMetrics.restartsVal', { restarts: liveMetrics.pod_restart_count?.latest ?? 0, pods: liveMetrics.replica_count?.latest ?? podCount ?? 1 })}
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '7px', borderTop: '1px solid #F1F5F9', fontSize: '0.68rem', fontWeight: 800, color: '#059669' }}>
              <span>{t('pipeline.canvas.compactMetrics.clickToExpand')}</span>
              <span style={{ padding: '1px 7px', borderRadius: '999px', backgroundColor: '#ECFDF5', border: '1px solid #A7F3D0' }}>+8</span>
            </div>
          </div>
        )}

        {/* Layer 3: Khối Trung Tâm - AI Analysis Hub TÍCH HỢP BIỂU ĐỒ SÓNG VIỄN TRẮC (T1..T12) */}
        <div
          data-inspector-trigger="true"
          onMouseEnter={(e) => handleInspectorHover(e, 'stage:gru')}
          onMouseLeave={() => handleInspectorLeave('stage:gru')}
          onClick={(e) => handleInspectorClick(e, 'stage:gru')}
          style={{
            position: 'absolute',
            left: `${CENTER_X}px`,
            top: `${CENTER_Y}px`,
            width: `${CENTER_W}px`,
            height: `${CENTER_H}px`,
            backgroundColor: '#FFFFFF',
            borderRadius: '14px',
            border: pinnedInspector?.id === 'stage:gru' ? '2px solid #2563EB' : isRiskDetected ? '1.5px solid #F87171' : '1.5px solid #CBD5E1',
            boxShadow: isRiskDetected
              ? '0 10px 25px -5px rgba(239, 68, 68, 0.18), 0 8px 10px -6px rgba(239, 68, 68, 0.1)'
              : '0 8px 20px -4px rgba(15, 23, 42, 0.08), 0 4px 6px -2px rgba(15, 23, 42, 0.04)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            cursor: 'pointer',
            zIndex: 15,
          }}
        >
          {/* Header khối AI: Icon + Tiêu đề + Tiến trình gom nhịp */}
          <div
            style={{
              padding: '9px 12px',
              backgroundColor: '#F8FAFC',
              borderBottom: '1px solid #E2E8F0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div
                style={{
                  width: '22px',
                  height: '22px',
                  borderRadius: '6px',
                  backgroundColor: '#EFF6FF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#2563EB',
                }}
              >
                <Sparkles size={13} />
              </div>
              <span style={{ fontSize: '0.78125rem', fontWeight: 700, color: '#1E293B' }}>
                AI Analysis & Health Assessment
              </span>
            </div>

            <span
              style={{
                fontSize: '0.6875rem',
                fontFamily: 'var(--font-mono)',
                padding: '2px 7px',
                borderRadius: '4px',
                backgroundColor: !isAgentConnected ? '#F1F5F9' : currentActiveStep < totalSteps ? '#FEF3C7' : '#DCFCE7',
                color: !isAgentConnected ? '#64748B' : currentActiveStep < totalSteps ? '#D97706' : '#15803D',
                fontWeight: 700,
              }}
            >
              {isAgentConnected ? t('pipeline.canvas.aiHub.stepsProgress', { step: currentActiveStep, total: totalSteps }) : t('pipeline.canvas.aiHub.stepsProgress', { step: 0, total: totalSteps })}
            </span>
          </div>

          {/* VÙNG CHÍNH: BIỂU ĐỒ SÓNG VIỄN TRẮC NHỎ LẠI ĐƯỢC ĐƯA VÀO VỪA VẶN KHUNG TRUNG TÂM */}
          <div
            style={{
              position: 'relative',
              width: `${miniChartW}px`,
              height: `${miniChartH}px`,
              margin: '6px auto 0 auto',
              backgroundColor: '#FFFFFF',
              borderRadius: '8px',
            }}
          >
            <svg
              viewBox={`0 0 ${miniChartW} ${miniChartH}`}
              style={{ width: '100%', height: '100%', display: 'block' }}
            >
              <defs>
                {METRIC_CONFIGS.map((cfg) => (
                  <linearGradient key={`grad-${cfg.key}`} id={`mini-grad-${cfg.key}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={cfg.color} stopOpacity="0.28" />
                    <stop offset="100%" stopColor={cfg.color} stopOpacity="0.0" />
                  </linearGradient>
                ))}
              </defs>

              {/* Đường kẻ ngang Y-Axis */}
              {yTicks.map((val) => {
                const y = getMiniY(val);
                return (
                  <g key={`y-${val}`}>
                    <line
                      x1={chartPad.left}
                      y1={y}
                      x2={chartPad.left + innerW}
                      y2={y}
                      stroke="#F1F5F9"
                      strokeWidth="1"
                      strokeDasharray="3 3"
                    />
                    <text
                      x={chartPad.left - 5}
                      y={y + 3}
                      fill="#94A3B8"
                      fontSize="8"
                      fontFamily="var(--font-mono)"
                      textAnchor="end"
                    >
                      {val}
                    </text>
                  </g>
                );
              })}

              {/* Đường ngưỡng cảnh báo đỏ 80% */}
              {chartMaxY >= 80 && (
                <g>
                  <line
                    x1={chartPad.left}
                    y1={getMiniY(80)}
                    x2={chartPad.left + innerW}
                    y2={getMiniY(80)}
                    stroke="#EF4444"
                    strokeWidth="1.2"
                    strokeDasharray="4 3"
                  />
                  <text
                    x={chartPad.left + innerW + 4}
                    y={getMiniY(80) + 3}
                    fill="#EF4444"
                    fontSize="7.5"
                    fontWeight="700"
                    fontFamily="var(--font-mono)"
                  >
                    80%
                  </text>
                </g>
              )}

              {/* Vẽ các đường sóng viễn trắc (T1..T12) */}
              {effectiveTimesteps && effectiveTimesteps.length > 0 && METRIC_CONFIGS.map((cfg) => {
                // Xây dựng đường Path và Gradient Area
                const points = effectiveTimesteps.map((t, i) => {
                  const val = Number(
                    t[cfg.key] ??
                    (cfg.key === 'http_5xx_rate' ? t.error_5xx : undefined) ??
                    (cfg.key === 'pod_restart_count' ? t.restarts : undefined) ??
                    (cfg.key === 'replica_count' ? (t.replicas ?? podCount ?? 1) : undefined) ??
                    0
                  );
                  return { x: getMiniX(i), y: getMiniY(val) };
                });

                if (points.length < 2) return null;

                const lineD = points.reduce((acc, p, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`, '');
                const areaD = `${lineD} L ${points[points.length - 1].x} ${getMiniY(0)} L ${points[0].x} ${getMiniY(0)} Z`;

                return (
                  <g key={`series-${cfg.key}`}>
                    <path d={areaD} fill={`url(#mini-grad-${cfg.key})`} />
                    <path
                      d={lineD}
                      fill="none"
                      stroke={cfg.color}
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    {points.map((p, pIdx) => (
                      <circle
                        key={`pt-${cfg.key}-${pIdx}`}
                        cx={p.x}
                        cy={p.y}
                        r="2.5"
                        fill="#FFFFFF"
                        stroke={cfg.color}
                        strokeWidth="1.2"
                      />
                    ))}
                  </g>
                );
              })}

              {/* Cột quét viễn trắc thời gian thực (chỉ hiển thị khi Agent đang ONLINE) */}
              {isAgentConnected && effectiveTimesteps && effectiveTimesteps.length > 0 && (
                <g>
                  {/* Đường kẻ thẳng đứng nhấp nháy xanh dương */}
                  <line
                    x1={sweepTargetX}
                    y1={chartPad.top}
                    x2={sweepTargetX}
                    y2={chartPad.top + innerH}
                    stroke="#2563EB"
                    strokeWidth="1.5"
                    strokeDasharray="3 2"
                  />
                  {/* Điểm tròn nổi bật tại đầu gom */}
                  <circle
                    cx={sweepTargetX}
                    cy={getMiniY(Number(effectiveTimesteps[activeSweepIdx]?.latency || effectiveTimesteps[activeSweepIdx]?.ram || 50))}
                    r="4.5"
                    fill="#2563EB"
                    stroke="#FFFFFF"
                    strokeWidth="2"
                    style={{ filter: 'drop-shadow(0 0 4px rgba(37,99,235,0.6))' }}
                  />
                  {/* Nhãn trên đầu cột quét */}
                  <text
                    x={sweepTargetX}
                    y={chartPad.top - 8}
                    fill="#2563EB"
                    fontSize="8.5"
                    fontWeight="800"
                    fontFamily="var(--font-mono)"
                    textAnchor={activeSweepIdx >= 10 ? 'end' : activeSweepIdx <= 1 ? 'start' : 'middle'}
                  >
                    {currentStepLabel} ({activeSweepIdx === 0 ? t('pipeline.canvas.aiHub.enough12') : t('pipeline.canvas.aiHub.newHead')})
                  </text>
                </g>
              )}

              {/* Nhãn trục X: T1..T12 */}
              {effectiveTimesteps && effectiveTimesteps.length > 0 && effectiveTimesteps.map((t, i) => {
                const x = getMiniX(i);
                const isActive = i === activeSweepIdx;
                return (
                  <text
                    key={`step-${i}`}
                    x={x}
                    y={chartPad.top + innerH + 15}
                    fill={isActive ? '#2563EB' : '#64748B'}
                    fontSize={isActive ? '9' : '8'}
                    fontWeight={isActive ? '800' : '500'}
                    fontFamily="var(--font-mono)"
                    textAnchor="middle"
                  >
                    {t.stepLabel || `T${i + 1}`}
                  </text>
                );
              })}
            </svg>
          </div>

          {/* Footer khối AI: Tên workload & Điểm rủi ro AI */}
          <div
            style={{
              padding: '10px 14px',
              textAlign: 'center',
              borderTop: '1px solid #F1F5F9',
              marginTop: 'auto',
              backgroundColor: '#FAFAFA',
            }}
          >
            <div
              style={{
                fontSize: '0.8125rem',
                fontWeight: 700,
                color: '#0F172A',
                letterSpacing: '-0.01em',
              }}
            >
              {t('pipeline.canvas.aiHub.analyzeFooter', { service: selectedService })}
            </div>

            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '3px 10px',
                borderRadius: '16px',
                backgroundColor: isScaleDownOptimization ? '#E0F2FE' : isRiskDetected ? '#FEE2E2' : '#E0F2FE',
                color: isScaleDownOptimization ? '#0369A1' : isRiskDetected ? '#991B1B' : '#0369A1',
                fontSize: '0.6875rem',
                fontWeight: 700,
                fontFamily: 'var(--font-mono)',
                marginTop: '6px',
              }}
            >
              <span>{isScaleDownOptimization ? t('pipeline.canvas.aiHub.optScore') : t('pipeline.canvas.aiHub.riskScore')}</span>
              <strong style={{ fontSize: '0.75rem' }}>
                {rawRiskScore.toFixed(4)} ({isScaleDownOptimization ? 'SCALE_DOWN_OPT' : isPredictionHealthy ? 'HEALTHY' : (prediction?.status || (isAgentConnected ? 'HEALTHY' : 'DISCONNECTED'))})
              </strong>
            </div>
          </div>

          {/* Cổng kết nối Output Handle ở cạnh phải phát tín hiệu sang 7 Actions */}
          <div
            style={{
              position: 'absolute',
              right: '-9px',
              top: '50%',
              transform: 'translateY(-50%)',
              width: '18px',
              height: '18px',
              borderRadius: '50%',
              backgroundColor: '#3B82F6',
              border: '2px solid #FFFFFF',
              boxShadow: '0 2px 6px rgba(59, 130, 246, 0.4)',
              zIndex: 20,
            }}
          />
        </div>

        {/* Layer 4: Cột Phải - 7 Đầu rủi ro (Thu gọn 1 thẻ ↔ Nhấn bung đủ 7 thẻ nguyên bản) */}
        {isRisksExpanded ? (
          ACTION_OUTCOME_NODES.map((action, idx) => {
          const nodeY = RIGHT_Y_START + idx * (RIGHT_H + RIGHT_GAP);
          const riskInfo = riskProbabilities[action.riskKey] || {
            prob: 0,
            isTriggered: false,
            threshold: action.threshold,
            thresholdPercent: Math.round(action.threshold * 100),
            probPercent: '0%',
          };
          const isOptNode = action.riskKey === 'SCALE_DOWN_CANDIDATE';
          const trigBorderColor = isOptNode ? '#7DD3FC' : '#FCA5A5';
          const trigShadow = isOptNode
            ? '0 4px 12px rgba(2, 132, 199, 0.14)'
            : '0 4px 12px rgba(239, 68, 68, 0.14)';
          const trigIconBg = isOptNode ? '#E0F2FE' : '#FEF2F2';
          const trigIconBorder = isOptNode ? '#BAE6FD' : '#FECACA';
          const trigAccent = isOptNode ? '#0284C7' : '#EF4444';
          const trigTextColor = isOptNode ? '#0369A1' : '#DC2626';

          return (
            <div
              key={action.id}
              data-inspector-trigger="true"
              onMouseEnter={(e) => handleInspectorHover(e, `risk:${action.id}`)}
              onMouseLeave={() => handleInspectorLeave(`risk:${action.id}`)}
              onClick={(e) => handleInspectorClick(e, `risk:${action.id}`)}
              style={{
                position: 'absolute',
                left: `${RIGHT_X}px`,
                top: `${nodeY}px`,
                width: `${RIGHT_W}px`,
                height: `${RIGHT_H}px`,
                backgroundColor: riskInfo.isTriggered && isOptNode ? '#F0F9FF' : '#FFFFFF',
                borderRadius: '9px',
                border: `1.5px solid ${pinnedInspector?.id === `risk:${action.id}` ? '#2563EB' : riskInfo.isTriggered ? trigBorderColor : '#E2E8F0'}`,
                boxShadow: riskInfo.isTriggered
                  ? trigShadow
                  : '0 2px 6px rgba(15, 23, 42, 0.04)',
                display: 'flex',
                alignItems: 'center',
                padding: '0 10px',
                gap: '8px',
                zIndex: 10,
                cursor: 'pointer',
                transition: 'border-color 0.15s, box-shadow 0.15s',
              }}
            >
              {/* Icon Checkmark xanh, Tối ưu xanh dương hoặc Cảnh báo đỏ */}
              <div
                style={{
                  width: '26px',
                  height: '26px',
                  borderRadius: '50%',
                  backgroundColor: riskInfo.isTriggered ? trigIconBg : '#F0FDF4',
                  border: `1px solid ${riskInfo.isTriggered ? trigIconBorder : '#BBF7D0'}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: riskInfo.isTriggered ? trigAccent : '#10B981',
                  flexShrink: 0,
                }}
              >
                {riskInfo.isTriggered ? (
                  isOptNode ? <Sparkles size={14} /> : <AlertTriangle size={14} />
                ) : (
                  <CheckCircle2 size={14} />
                )}
              </div>

              {/* Thông tin 2 dòng khớp chính xác bảng Hồ Sơ Xác Suất Rủi Ro */}
              <div style={{ flex: 1, minWidth: 0 }}>
                {/* Dòng 1: Tên đầu rủi ro (Quá Tải CPU (CPU Overload), ...) */}
                <div
                  title={action.title}
                  style={{
                    fontSize: '0.6875rem',
                    fontWeight: 700,
                    color: riskInfo.isTriggered ? trigTextColor : '#1E293B',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    lineHeight: 1.25,
                  }}
                >
                  {action.title}
                </div>

                {/* Dòng 2: Ngưỡng: 81%           0% */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '0.625rem',
                    fontFamily: 'var(--font-mono)',
                    marginTop: '2px',
                    lineHeight: 1.2,
                  }}
                >
                  <span style={{ color: riskInfo.isTriggered ? trigAccent : '#64748B' }}>
                    {t('pipeline.canvas.risks.threshold', { pct: riskInfo.thresholdPercent })}
                  </span>
                  <strong
                    style={{
                      fontWeight: 700,
                      color: riskInfo.isTriggered ? trigTextColor : '#10B981',
                    }}
                  >
                    {riskInfo.probPercent}
                  </strong>
                </div>
              </div>

              {/* Cổng xuất sang Multi-Agent RCA khi ở chế độ Toàn luồng */}
              {showExtendedPipeline && (
                <div
                  style={{
                    position: 'absolute',
                    right: '-5px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    backgroundColor: riskInfo.isTriggered ? trigAccent : '#FFFFFF',
                    border: `2px solid ${riskInfo.isTriggered ? trigAccent : '#94A3B8'}`,
                    zIndex: 12,
                  }}
                />
              )}
            </div>
          );
        })
        ) : (
          <div
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => toggleExpandGroup(e, 'risks')}
            onMouseEnter={() => setHoveredNode('compact-risks')}
            onMouseLeave={() => setHoveredNode(null)}
            style={{
              position: 'absolute',
              left: `${RIGHT_X}px`,
              top: `${RIGHT_COMPACT_Y}px`,
              width: `${RIGHT_W}px`,
              height: `${RIGHT_COMPACT_H}px`,
              backgroundColor: '#FFFFFF',
              borderRadius: '14px',
              border: `1.5px solid ${hoveredNode === 'compact-risks' ? '#EF4444' : triggeredRisksList.length > 0 ? '#FCA5A5' : '#CBD5E1'}`,
              borderTop: `3px solid ${!isAgentConnected ? '#CBD5E1' : triggeredRisksList.length > 0 ? '#EF4444' : '#10B981'}`,
              boxShadow: triggeredRisksList.length > 0 ? '0 8px 20px rgba(239, 68, 68, 0.14)' : '0 4px 14px rgba(15, 23, 42, 0.06)',
              padding: '12px 14px',
              boxSizing: 'border-box',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              cursor: 'pointer',
              zIndex: 12,
              transition: 'border-color 0.15s, box-shadow 0.15s',
            }}
          >
            <div style={{ position: 'absolute', left: '-6px', top: '50%', transform: 'translateY(-50%)', width: '12px', height: '12px', borderRadius: '50%', backgroundColor: triggeredRisksList.length > 0 ? '#EF4444' : '#10B981', border: '2px solid #FFFFFF', zIndex: 15 }} />
            <div style={{ position: 'absolute', right: '-6px', top: '50%', transform: 'translateY(-50%)', width: '12px', height: '12px', borderRadius: '50%', backgroundColor: triggeredRisksList.length > 0 ? '#EF4444' : '#94A3B8', border: '2px solid #FFFFFF', zIndex: 15 }} />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ fontSize: '0.625rem', fontWeight: 800, color: triggeredRisksList.length > 0 ? '#DC2626' : '#059669' }}>{t('pipeline.canvas.risks.profileHeader')}</span>
                <span style={{ fontSize: '0.62rem', fontWeight: 800, padding: '1px 6px', borderRadius: '999px', backgroundColor: !isAgentConnected ? '#F1F5F9' : triggeredRisksList.length > 0 ? '#FEE2E2' : '#ECFDF5', color: !isAgentConnected ? '#64748B' : triggeredRisksList.length > 0 ? '#DC2626' : '#059669' }}>
                  {!isAgentConnected ? 'Offline' : triggeredRisksList.length > 0 ? t('pipeline.canvas.risks.warningCount', { count: triggeredRisksList.length }) : t('pipeline.canvas.risks.safe')}
                </span>
              </div>
              <div style={{ fontSize: '0.84rem', fontWeight: 800, color: '#0F172A' }}>{t('pipeline.canvas.risks.title')}</div>
            </div>
            <div style={{ padding: '8px 10px', borderRadius: '10px', backgroundColor: triggeredRisksList.length > 0 ? '#FEF2F2' : '#F8FAFC', border: triggeredRisksList.length > 0 ? '1px solid #FECACA' : '1px solid #E2E8F0' }}>
              <div style={{ fontSize: '0.6rem', fontWeight: 700, color: '#64748B' }}>{t('pipeline.canvas.risks.highestNow')}</div>
              <div style={{ fontSize: '0.74rem', fontWeight: 800, color: '#0F172A', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {isAgentConnected ? topRiskEval?.title || t('pipeline.canvas.risks.stable') : t('pipeline.canvas.risks.disconnected')}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '5px' }}>
                <div style={{ flex: 1, height: '5px', backgroundColor: '#E2E8F0', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(100, Math.round((topRiskEval?.riskInfo?.prob || 0) * 100))}%`, height: '100%', backgroundColor: topRiskEval?.riskInfo?.isTriggered ? '#EF4444' : '#10B981' }} />
                </div>
                <span style={{ fontSize: '0.74rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: topRiskEval?.riskInfo?.isTriggered ? '#DC2626' : '#059669' }}>
                  {topRiskEval?.riskInfo?.probPercent || '0%'}
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '7px', borderTop: '1px solid #F1F5F9', fontSize: '0.68rem', fontWeight: 800, color: triggeredRisksList.length > 0 ? '#DC2626' : '#059669' }}>
              <span>{t('pipeline.canvas.risks.clickToExpand')}</span>
              <span style={{ padding: '1px 7px', borderRadius: '999px', backgroundColor: triggeredRisksList.length > 0 ? '#FEF2F2' : '#ECFDF5', border: triggeredRisksList.length > 0 ? '1px solid #FECACA' : '1px solid #A7F3D0' }}>+7</span>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* CÁC GIAI ĐOẠN TIẾP THEO SAU GRU (4: RCA → 5: POLICY → 6: ĐIỀU PHỐI → 7: HẬU KIỂM) */}
        {/* ============================================================ */}
        {showExtendedPipeline && (
          <>
            {/* GIAI ĐOẠN 4: MULTI-AGENT RCA & TẠO SỰ CỐ */}
            <div
              data-inspector-trigger="true"
              onClick={(e) => handleInspectorClick(e, 'stage:rca')}
              onMouseEnter={(e) => {
                setHoveredNode('stage-rca');
                handleInspectorHover(e, 'stage:rca');
              }}
              onMouseLeave={() => {
                setHoveredNode(null);
                handleInspectorLeave('stage:rca');
              }}
              style={{
                position: 'absolute',
                left: `${RCA_X}px`,
                top: `${RCA_Y}px`,
                width: `${RCA_W}px`,
                height: `${RCA_H}px`,
                backgroundColor: '#FFFFFF',
                borderRadius: '14px',
                border: `1.5px solid ${isRcaActive ? '#8B5CF6' : hoveredNode === 'stage-rca' ? '#A78BFA' : '#CBD5E1'}`,
                boxShadow: isRcaActive
                  ? '0 10px 25px -5px rgba(124, 58, 237, 0.22)'
                  : hoveredNode === 'stage-rca'
                    ? '0 8px 20px rgba(15, 23, 42, 0.09)'
                    : '0 4px 14px rgba(15, 23, 42, 0.06)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'visible',
                cursor: onNavigate ? 'pointer' : 'default',
                zIndex: 12,
                transition: 'border-color 0.2s, box-shadow 0.2s',
              }}
            >
              {/* Cổng vào từ GRU (Trái), Cổng vào từ Rule Engine (Trên) & Cổng ra (Phải) */}
              <div
                style={{
                  position: 'absolute',
                  left: '-6px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  backgroundColor: isRcaActive ? '#EF4444' : '#7C3AED',
                  border: '2px solid #FFFFFF',
                  boxShadow: '0 0 0 1px #CBD5E1',
                  zIndex: 15,
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  top: '-6px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  backgroundColor: isRuleEngineTriggered ? '#EA580C' : '#F59E0B',
                  border: '2px solid #FFFFFF',
                  boxShadow: '0 0 0 1px #CBD5E1',
                  zIndex: 15,
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  right: '-6px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  backgroundColor: isRcaActive ? '#7C3AED' : '#94A3B8',
                  border: '2px solid #FFFFFF',
                  boxShadow: '0 0 0 1px #CBD5E1',
                  zIndex: 15,
                }}
              />

              {/* Header */}
              <div
                style={{
                  padding: '10px 12px',
                  backgroundColor: isRcaActive ? '#F5F3FF' : '#F8FAFC',
                  borderBottom: '1px solid #E2E8F0',
                  borderTopLeftRadius: '12px',
                  borderTopRightRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '6px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px', minWidth: 0 }}>
                  <div
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '7px',
                      backgroundColor: '#EDE9FE',
                      color: '#7C3AED',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Sparkles size={14} />
                  </div>
                  <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#1E293B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    Multi-Agent RCA
                  </span>
                </div>
                <span
                  style={{
                    fontSize: '0.6rem',
                    fontWeight: 700,
                    padding: '2px 7px',
                    borderRadius: '999px',
                    backgroundColor:
                      isScaleDownOptimization
                        ? '#E0F2FE'
                        : openServiceIncidentsCount > 0
                          ? '#FEE2E2'
                          : isBenignDbCacheState
                            ? '#ECFDF5'
                            : isRcaActive
                              ? '#EDE9FE'
                              : '#ECFDF5',
                    color:
                      isScaleDownOptimization
                        ? '#0369A1'
                        : openServiceIncidentsCount > 0
                          ? '#DC2626'
                          : isBenignDbCacheState
                            ? '#059669'
                            : isRcaActive
                              ? '#6D28D9'
                              : '#059669',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {isScaleDownOptimization
                    ? t('pipeline.canvas.rcaCard.optimizingPods')
                    : openServiceIncidentsCount > 0
                      ? t('pipeline.canvas.rcaCard.openCount', { count: openServiceIncidentsCount })
                      : isBenignDbCacheState
                        ? t('pipeline.canvas.rcaCard.dbCacheSafe')
                        : isRcaActive
                          ? t('pipeline.canvas.rcaCard.collectingBatch', { step: currentActiveStep || 12 })
                          : lastResolvedIncident
                            ? t('pipeline.canvas.rcaCard.stabilized')
                            : t('pipeline.canvas.rcaCard.optimal')}
                </span>
              </div>

              {/* Body: 4 Tác tử Gom bằng chứng + Root Cause + Recommendation */}
              <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '9px', flex: 1 }}>
                <div style={{ fontSize: '0.625rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {t('pipeline.canvas.rcaCard.fourAgents')}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                  {[
                    {
                      label: 'Metrics Agent',
                      sub: isAgentConnected
                        ? pipelineContext?.rcaAgentsSummary?.metricsSub || t('pipeline.canvas.rcaCard.stepsActual', { count: timesteps.length || 0 })
                        : t('pipeline.canvas.rcaCard.offline'),
                      icon: Activity,
                      color: '#2563EB',
                      bg: '#EFF6FF',
                    },
                    {
                      label: 'Log Agent',
                      sub: isAgentConnected
                        ? pipelineContext?.rcaAgentsSummary?.logSub || t('pipeline.canvas.rcaCard.monitoring')
                        : t('pipeline.canvas.rcaCard.offline'),
                      icon: FileText,
                      color: '#D97706',
                      bg: '#FFFBEB',
                    },
                    {
                      label: 'K8s Event Agent',
                      sub: isAgentConnected
                        ? pipelineContext?.rcaAgentsSummary?.k8sEventSub || t('pipeline.canvas.rcaCard.podStable')
                        : t('pipeline.canvas.rcaCard.offline'),
                      icon: Server,
                      color: '#059669',
                      bg: '#ECFDF5',
                    },
                    {
                      label: 'History Agent',
                      sub: isAgentConnected
                        ? pipelineContext?.rcaAgentsSummary?.historySub || t('pipeline.canvas.rcaCard.serviceHist', { count: pipelineContext?.totalServiceIncidentsCount ?? 0 })
                        : t('pipeline.canvas.rcaCard.offline'),
                      icon: History,
                      color: '#7C3AED',
                      bg: '#F5F3FF',
                    },
                  ].map((ag) => {
                    const AgIcon = ag.icon;
                    return (
                      <div
                        key={ag.label}
                        style={{
                          padding: '6px 7px',
                          borderRadius: '8px',
                          backgroundColor: ag.bg,
                          border: `1px solid ${ag.color}26`,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <AgIcon size={13} color={ag.color} style={{ flexShrink: 0 }} />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: '0.625rem', fontWeight: 700, color: '#1E293B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {ag.label}
                          </div>
                          <div style={{ fontSize: '0.5625rem', color: '#64748B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {ag.sub}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Khối Kết luận Root Cause thực tế */}
                <div
                  style={{
                    padding: '8px 10px',
                    borderRadius: '9px',
                    backgroundColor: isScaleDownOptimization ? '#F0F9FF' : openServiceIncidentsCount > 0 ? '#FEF2F2' : '#F0FDF4',
                    border: `1px solid ${isScaleDownOptimization ? '#BAE6FD' : openServiceIncidentsCount > 0 ? '#FECACA' : '#BBF7D0'}`,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.6rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
                      Nguyên nhân gốc (Root Cause)
                    </span>
                    {isScaleDownOptimization ? (
                      <span
                        style={{
                          fontSize: '0.5625rem',
                          fontWeight: 800,
                          padding: '1px 5px',
                          borderRadius: '4px',
                          backgroundColor: '#E0F2FE',
                          color: '#0369A1',
                        }}
                      >
                        {t('pipeline.canvas.rcaCard.optBadge')}
                      </span>
                    ) : latestIncident?.severity && openServiceIncidentsCount > 0 ? (
                      <span
                        style={{
                          fontSize: '0.5625rem',
                          fontWeight: 800,
                          padding: '1px 5px',
                          borderRadius: '4px',
                          backgroundColor: ['CRITICAL', 'HIGH'].includes(String(latestIncident.severity).toUpperCase()) ? '#FEE2E2' : '#E0F2FE',
                          color: ['CRITICAL', 'HIGH'].includes(String(latestIncident.severity).toUpperCase()) ? '#DC2626' : '#0369A1',
                        }}
                      >
                        {localizedSeverity(latestIncident.severity)}
                      </span>
                    ) : (
                      <span
                        style={{
                          fontSize: '0.5625rem',
                          fontWeight: 800,
                          padding: '1px 5px',
                          borderRadius: '4px',
                          backgroundColor: '#DCFCE7',
                          color: '#15803D',
                        }}
                      >
                        {isBenignDbCacheState ? t('pipeline.canvas.rcaCard.safeBadge') : lastResolvedIncident ? t('pipeline.canvas.rcaCard.recoveredBadge') : t('pipeline.canvas.rcaCard.normalBadge')}
                      </span>
                    )}
                  </div>
                  <div
                    title={
                      latestIncident && openServiceIncidentsCount > 0
                        ? localizedIncidentTitle(
                            latestIncident.cause || latestIncident.root_cause || latestIncident.title
                          )
                        : lastResolvedIncident
                          ? t('pipeline.canvas.rcaCard.latestPrefix', {
                              text: localizedIncidentTitle(
                                lastResolvedIncident.cause || lastResolvedIncident.root_cause || lastResolvedIncident.title
                              ),
                            })
                          : t('pipeline.canvas.rcaCard.optimalOp')
                    }
                    style={{
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      color: isScaleDownOptimization ? '#0369A1' : openServiceIncidentsCount > 0 ? '#B91C1C' : '#15803D',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      lineHeight: 1.3,
                    }}
                  >
                    {latestIncident && openServiceIncidentsCount > 0
                      ? localizedIncidentTitle(
                          latestIncident.cause || latestIncident.root_cause || latestIncident.title
                        )
                      : isBenignDbCacheState
                        ? t('pipeline.canvas.rcaCard.dbCacheDesc')
                        : isRcaActive
                          ? t('pipeline.canvas.rcaCard.collectingRca', { step: currentActiveStep || 12 })
                          : lastResolvedIncident
                            ? t('pipeline.canvas.rcaCard.latestStabilized', {
                                text: localizedIncidentTitle(
                                  lastResolvedIncident.cause || lastResolvedIncident.root_cause || lastResolvedIncident.title
                                ),
                              })
                            : t('pipeline.canvas.rcaCard.optimalFull')}
                  </div>
                </div>

                {/* Khối Đề xuất Hành động từ RecommendationAgent */}
                <div
                  style={{
                    padding: '7px 10px',
                    borderRadius: '9px',
                    backgroundColor: openServiceIncidentsCount > 0 ? '#F5F3FF' : '#F0FDF4',
                    border: `1px solid ${openServiceIncidentsCount > 0 ? '#DDD6FE' : '#BBF7D0'}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '6px',
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '0.5625rem', fontWeight: 700, color: openServiceIncidentsCount > 0 ? '#6D28D9' : '#15803D', textTransform: 'uppercase' }}>
                      {t('pipeline.canvas.rcaCard.aiRecHeader')}
                    </div>
                    <div
                      title={
                        (latestRecommendation && openServiceIncidentsCount > 0
                          ? translateActionToVi(
                              latestRecommendation?.action ||
                                latestRecommendation?.action_code ||
                                latestRecommendation?.recommendation,
                              latestRecommendation
                            )
                          : null) ||
                        (isBenignDbCacheState
                          ? t('pipeline.canvas.rcaCard.normalDbCache')
                          : lastResolvedIncident
                            ? t('pipeline.canvas.rcaCard.normalRecovered')
                            : t('pipeline.canvas.rcaCard.normalNoAction'))
                      }
                      style={{
                        fontSize: '0.6875rem',
                        fontWeight: 800,
                        color: openServiceIncidentsCount > 0 ? '#4C1D95' : '#166534',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {(latestRecommendation && openServiceIncidentsCount > 0
                        ? translateActionToVi(
                            latestRecommendation?.action ||
                              latestRecommendation?.action_code ||
                              latestRecommendation?.recommendation,
                            latestRecommendation
                          )
                        : null) ||
                        (isBenignDbCacheState
                          ? t('pipeline.canvas.rcaCard.normalDbCache')
                          : lastResolvedIncident
                            ? t('pipeline.canvas.rcaCard.normalRecovered')
                            : t('pipeline.canvas.rcaCard.normalNoAction'))}
                    </div>
                  </div>
                  <ExternalLink size={12} color={openServiceIncidentsCount > 0 ? '#7C3AED' : '#16A34A'} style={{ flexShrink: 0 }} />
                </div>
              </div>

              {/* Footer */}
              <div
                style={{
                  padding: '6px 12px',
                  borderTop: '1px solid #F1F5F9',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '0.6rem',
                  color: '#64748B',
                }}
              >
                <span>{t('pipeline.canvas.rcaCard.openIncidentsLabel')} <strong>{openServiceIncidentsCount}</strong></span>
                <span style={{ color: '#7C3AED', fontWeight: 700 }}>{t('pipeline.canvas.rcaCard.viewRcaLink')}</span>
              </div>
            </div>

            {/* GIAI ĐOẠN 5: POLICY ENGINE & SAFETY GATE */}
            <div
              data-inspector-trigger="true"
              onClick={(e) => handleInspectorClick(e, 'stage:policy')}
              onMouseEnter={(e) => {
                setHoveredNode('stage-policy');
                handleInspectorHover(e, 'stage:policy');
              }}
              onMouseLeave={() => {
                setHoveredNode(null);
                handleInspectorLeave('stage:policy');
              }}
              style={{
                position: 'absolute',
                left: `${POLICY_X}px`,
                top: `${POLICY_Y}px`,
                width: `${POLICY_W}px`,
                height: `${POLICY_H}px`,
                backgroundColor: '#FFFFFF',
                borderRadius: '14px',
                border: `1.5px solid ${isPolicyActive ? '#F59E0B' : hoveredNode === 'stage-policy' ? '#FBBF24' : '#CBD5E1'}`,
                boxShadow: isPolicyActive
                  ? '0 10px 24px -5px rgba(245, 158, 11, 0.2)'
                  : hoveredNode === 'stage-policy'
                    ? '0 8px 20px rgba(15, 23, 42, 0.09)'
                    : '0 4px 14px rgba(15, 23, 42, 0.06)',
                display: 'flex',
                flexDirection: 'column',
                cursor: onNavigate ? 'pointer' : 'default',
                zIndex: 12,
                transition: 'border-color 0.2s, box-shadow 0.2s',
              }}
            >
              {/* Cổng vào (Trái) & Cổng ra (Phải) */}
              <div
                style={{
                  position: 'absolute',
                  left: '-6px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  backgroundColor: isPolicyActive ? '#7C3AED' : '#94A3B8',
                  border: '2px solid #FFFFFF',
                  boxShadow: '0 0 0 1px #CBD5E1',
                  zIndex: 15,
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  right: '-6px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  backgroundColor: isPolicyActive ? '#F59E0B' : '#94A3B8',
                  border: '2px solid #FFFFFF',
                  boxShadow: '0 0 0 1px #CBD5E1',
                  zIndex: 15,
                }}
              />

              {/* Header */}
              <div
                style={{
                  padding: '10px 12px',
                  backgroundColor: '#FFFBEB',
                  borderBottom: '1px solid #FDE68A',
                  borderTopLeftRadius: '12px',
                  borderTopRightRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                  <div
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '7px',
                      backgroundColor: '#FEF3C7',
                      color: '#D97706',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <ShieldAlert size={14} />
                  </div>
                  <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#1E293B' }}>Policy Engine</span>
                </div>
                <span
                  style={{
                    fontSize: '0.6rem',
                    fontWeight: 700,
                    fontFamily: 'var(--font-mono)',
                    padding: '2px 6px',
                    borderRadius: '999px',
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #FDE68A',
                    color: '#B45309',
                  }}
                >
                  {t('pipeline.canvas.policyCard.activeCount', { count: pipelineContext?.activePoliciesCount ?? 0 })}
                </span>
              </div>

              {/* 3 Lớp Kiểm Tra Chính Sách & An Toàn */}
              <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '7px', flex: 1 }}>
                {[
                  {
                    title: t('pipeline.canvas.policyCard.chk1Title'),
                    desc: `${pipelineContext?.autoPoliciesCount ?? 0} AUTO • ${pipelineContext?.hitlPoliciesCount ?? 0} HITL${pipelineContext?.policyMeta?.cooldownSec ? ` • ${pipelineContext.policyMeta.cooldownSec}s` : ''}`,
                    dot: '#10B981',
                  },
                  {
                    title: t('pipeline.canvas.policyCard.chk2Title'),
                    desc:
                      pipelineContext?.policyMeta?.minConfidencePct && pipelineContext?.policyMeta?.maxConfidencePct
                        ? t('pipeline.canvas.policyCard.chk2Desc', {
                            rcaPrefix: pipelineContext?.rcaAgentsSummary?.rcaConfidencePct !== null && pipelineContext?.rcaAgentsSummary?.rcaConfidencePct !== undefined ? `RCA ${pipelineContext.rcaAgentsSummary.rcaConfidencePct}% • ` : '',
                            min: pipelineContext.policyMeta.minConfidencePct,
                            max: pipelineContext.policyMeta.maxConfidencePct,
                          })
                        : t('pipeline.canvas.policyCard.chk2Unconfigured'),
                    dot: '#3B82F6',
                  },
                  {
                    title: t('pipeline.canvas.policyCard.chk3Title'),
                    desc: t('pipeline.canvas.policyCard.chk3Desc', {
                      hitl: pipelineContext?.hitlPoliciesCount ?? 0,
                      pending: pendingApprovalsCount,
                    }),
                    dot: '#F59E0B',
                  },
                ].map((chk) => (
                  <div
                    key={chk.title}
                    style={{
                      padding: '6px 8px',
                      borderRadius: '8px',
                      backgroundColor: '#F8FAFC',
                      border: '1px solid #E2E8F0',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: chk.dot, flexShrink: 0 }} />
                      <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#1E293B' }}>{chk.title}</span>
                    </div>
                    <div style={{ fontSize: '0.58rem', color: '#64748B', marginTop: '2px', paddingLeft: '12px', fontFamily: 'var(--font-mono)' }}>
                      {chk.desc}
                    </div>
                  </div>
                ))}
              </div>

              <div
                style={{
                  padding: '6px 12px',
                  borderTop: '1px solid #F1F5F9',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '0.6rem',
                  color: '#B45309',
                  fontWeight: 700,
                }}
              >
                <span>{t('pipeline.canvas.policyCard.footerLeft')}</span>
                <span>{t('pipeline.canvas.policyCard.footerRight')}</span>
              </div>
            </div>

            {/* GIAI ĐOẠN 6: 3 NHÁNH ĐIỀU PHỐI (Thu gọn 1 thẻ ↔ Nhấn bung đủ 3 nhánh AUTO / HITL / Circuit Breaker nguyên bản) */}
            {isBranchesExpanded ? (
              <>
            {/* GIAI ĐOẠN 6A (TRÊN): NHÁNH TỰ PHỤC HỒI TỰ ĐỘNG (AUTO → K8S AGENT) */}
            <div
              data-inspector-trigger="true"
              onClick={(e) => handleInspectorClick(e, 'stage:auto')}
              onMouseEnter={(e) => {
                setHoveredNode('stage-auto');
                handleInspectorHover(e, 'stage:auto');
              }}
              onMouseLeave={() => {
                setHoveredNode(null);
                handleInspectorLeave('stage:auto');
              }}
              style={{
                position: 'absolute',
                left: `${BRANCH_X}px`,
                top: `${AUTO_Y}px`,
                width: `${BRANCH_W}px`,
                height: `${AUTO_H}px`,
                backgroundColor: '#FFFFFF',
                borderRadius: '12px',
                border: `1.5px solid ${isAutoActive ? '#10B981' : hoveredNode === 'stage-auto' ? '#34D399' : '#CBD5E1'}`,
                boxShadow: isAutoActive
                  ? '0 8px 20px -4px rgba(16, 185, 129, 0.25)'
                  : '0 3px 10px rgba(15, 23, 42, 0.05)',
                display: 'flex',
                flexDirection: 'column',
                cursor: onNavigate ? 'pointer' : 'default',
                zIndex: 12,
                transition: 'border-color 0.2s, box-shadow 0.2s',
              }}
            >
              {/* Input & Output Ports */}
              <div style={{ position: 'absolute', left: '-5px', top: '50%', transform: 'translateY(-50%)', width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#10B981', border: '2px solid #FFFFFF', zIndex: 15 }} />
              <div style={{ position: 'absolute', right: '-5px', top: '50%', transform: 'translateY(-50%)', width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#10B981', border: '2px solid #FFFFFF', zIndex: 15 }} />

              <div
                style={{
                  padding: '8px 10px',
                  backgroundColor: '#ECFDF5',
                  borderBottom: '1px solid #A7F3D0',
                  borderTopLeftRadius: '10px',
                  borderTopRightRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Zap size={14} color="#059669" />
                  <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#065F46' }}>{t('pipeline.canvas.branches.autoHeader')}</span>
                </div>
                <span
                  style={{
                    fontSize: '0.5625rem',
                    fontWeight: 800,
                    padding: '1px 6px',
                    borderRadius: '999px',
                    backgroundColor: autoActionStatus === 'RUNNING' ? '#DBEAFE' : '#D1FAE5',
                    color: autoActionStatus === 'RUNNING' ? '#1D4ED8' : '#047857',
                  }}
                >
                  {autoActionStatus
                    ? translateExecutionStatusVi(autoActionStatus)
                    : isAgentConnected
                      ? t('pipeline.canvas.branches.ready')
                      : t('pipeline.canvas.branches.offline')}
                </span>
              </div>

              <div style={{ padding: '8px 10px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#1E293B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {latestAutoAction
                      ? translateActionToVi(
                          latestAutoAction.display_action_name ||
                            latestAutoAction.action_type_name ||
                            latestAutoAction.action_type_code ||
                            latestAutoAction.action_name ||
                            latestAutoAction.action_code,
                          latestAutoAction
                        ) || t('pipeline.actions.defaultHealing')
                      : t('pipeline.canvas.branches.autoDefaultTitle')}
                  </div>
                  <div style={{ fontSize: '0.6rem', color: '#64748B', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {latestAutoAction
                      ? t('pipeline.canvas.branches.targetPrefix', { service: selectedService })
                      : t('pipeline.canvas.branches.noAutoOnService', { service: selectedService })}
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.58rem', color: '#059669', fontWeight: 700 }}>
                  <span>{t('pipeline.canvas.branches.autoFooterLeft')}</span>
                  <span>{t('pipeline.canvas.branches.autoFooterRight')}</span>
                </div>
              </div>
            </div>

            {/* GIAI ĐOẠN 6B (GIỮA): NHÁNH CỔNG PHÊ DUYỆT CON NGƯỜI (HITL APPROVAL GATE) */}
            <div
              data-inspector-trigger="true"
              onClick={(e) => handleInspectorClick(e, 'stage:hitl')}
              onMouseEnter={(e) => {
                setHoveredNode('stage-hitl');
                handleInspectorHover(e, 'stage:hitl');
              }}
              onMouseLeave={() => {
                setHoveredNode(null);
                handleInspectorLeave('stage:hitl');
              }}
              style={{
                position: 'absolute',
                left: `${BRANCH_X}px`,
                top: `${HITL_Y}px`,
                width: `${BRANCH_W}px`,
                height: `${HITL_H}px`,
                backgroundColor: '#FFFFFF',
                borderRadius: '12px',
                border: `1.5px solid ${isHitlActive ? '#F59E0B' : hoveredNode === 'stage-hitl' ? '#FBBF24' : '#CBD5E1'}`,
                boxShadow: isHitlActive
                  ? '0 8px 20px -4px rgba(245, 158, 11, 0.25)'
                  : '0 3px 10px rgba(15, 23, 42, 0.05)',
                display: 'flex',
                flexDirection: 'column',
                cursor: onNavigate ? 'pointer' : 'default',
                zIndex: 12,
                transition: 'border-color 0.2s, box-shadow 0.2s',
              }}
            >
              <div style={{ position: 'absolute', left: '-5px', top: '50%', transform: 'translateY(-50%)', width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#F59E0B', border: '2px solid #FFFFFF', zIndex: 15 }} />
              <div style={{ position: 'absolute', right: '-5px', top: '50%', transform: 'translateY(-50%)', width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#0891B2', border: '2px solid #FFFFFF', zIndex: 15 }} />

              <div
                style={{
                  padding: '8px 10px',
                  backgroundColor: '#FFFBEB',
                  borderBottom: '1px solid #FDE68A',
                  borderTopLeftRadius: '10px',
                  borderTopRightRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <CheckCircle2 size={14} color="#D97706" />
                  <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#92400E' }}>{t('pipeline.canvas.branches.hitlHeader')}</span>
                </div>
                <span
                  style={{
                    fontSize: '0.5625rem',
                    fontWeight: 800,
                    padding: '1px 6px',
                    borderRadius: '999px',
                    backgroundColor: isHitlActive ? '#FEF3C7' : '#F1F5F9',
                    color: isHitlActive ? '#B45309' : '#64748B',
                  }}
                >
                  {t('pipeline.canvas.branches.pendingCount', { count: isHitlActive ? pendingApprovalsCount : 0 })}
                </span>
              </div>

              <div style={{ padding: '8px 10px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#1E293B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {latestHitlApproval
                      ? translateActionToVi(
                          latestHitlApproval.display_action_name ||
                            latestHitlApproval.action_type_name ||
                            latestHitlApproval.action_type_code ||
                            latestHitlApproval.action_name ||
                            latestHitlApproval.action_code,
                          latestHitlApproval
                        ) || t('pipeline.canvas.branches.hitlPendingFallback')
                      : t('pipeline.canvas.branches.hitlDefaultTitle')}
                  </div>
                  <div style={{ fontSize: '0.6rem', color: '#64748B', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {latestHitlApproval
                      ? t('pipeline.canvas.branches.hitlEmailSub', { service: selectedService })
                      : t('pipeline.canvas.branches.hitlNoneSub', { service: selectedService })}
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.58rem', color: '#D97706', fontWeight: 700 }}>
                  <span>{t('pipeline.canvas.branches.hitlFooterLeft')}</span>
                  <span>{t('pipeline.canvas.branches.hitlFooterRight')}</span>
                </div>
              </div>
            </div>

            {/* GIAI ĐOẠN 6C (DƯỚI): NHÁNH NGẮT MẠCH (CIRCUIT BREAKER) & AUDIT LOG */}
            <div
              data-inspector-trigger="true"
              onClick={(e) => handleInspectorClick(e, 'stage:audit')}
              onMouseEnter={(e) => {
                setHoveredNode('stage-audit');
                handleInspectorHover(e, 'stage:audit');
              }}
              onMouseLeave={() => {
                setHoveredNode(null);
                handleInspectorLeave('stage:audit');
              }}
              style={{
                position: 'absolute',
                left: `${BRANCH_X}px`,
                top: `${AUDIT_Y}px`,
                width: `${BRANCH_W}px`,
                height: `${AUDIT_H}px`,
                backgroundColor: '#FFFFFF',
                borderRadius: '12px',
                border: `1.5px solid ${isAuditActive ? '#EF4444' : hoveredNode === 'stage-audit' ? '#94A3B8' : '#CBD5E1'}`,
                boxShadow: isAuditActive
                  ? '0 8px 18px -4px rgba(239, 68, 68, 0.2)'
                  : '0 3px 10px rgba(15, 23, 42, 0.05)',
                display: 'flex',
                flexDirection: 'column',
                cursor: onNavigate ? 'pointer' : 'default',
                zIndex: 12,
                transition: 'border-color 0.2s, box-shadow 0.2s',
              }}
            >
              <div style={{ position: 'absolute', left: '-5px', top: '50%', transform: 'translateY(-50%)', width: '10px', height: '10px', borderRadius: '50%', backgroundColor: isAuditActive ? '#EF4444' : '#64748B', border: '2px solid #FFFFFF', zIndex: 15 }} />

              <div
                style={{
                  padding: '8px 10px',
                  backgroundColor: isAuditActive ? '#FEF2F2' : '#F8FAFC',
                  borderBottom: '1px solid #E2E8F0',
                  borderTopLeftRadius: '10px',
                  borderTopRightRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <ScrollText size={14} color={isAuditActive ? '#DC2626' : '#475569'} />
                  <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#1E293B' }}>{t('pipeline.canvas.branches.auditHeader')}</span>
                </div>
                <span
                  style={{
                    fontSize: '0.5625rem',
                    fontWeight: 700,
                    padding: '1px 6px',
                    borderRadius: '999px',
                    backgroundColor: isAuditActive ? '#FEE2E2' : '#F1F5F9',
                    color: isAuditActive ? '#DC2626' : '#64748B',
                  }}
                >
                  {isCircuitBreakerTripped ? 'NO_ACTION' : t('pipeline.canvas.branches.safe')}
                </span>
              </div>

              <div style={{ padding: '8px 10px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: '0.67rem', fontWeight: 700, color: '#334155' }}>
                    {t('pipeline.canvas.branches.auditTitle')}
                  </div>
                  <div style={{ fontSize: '0.6rem', color: '#64748B', marginTop: '2px' }}>
                    {t('pipeline.canvas.branches.auditSub')}
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.58rem', color: '#475569', fontWeight: 700 }}>
                  <span>{t('pipeline.canvas.branches.auditFooterLeft')}</span>
                  <span>{t('pipeline.canvas.branches.auditFooterRight')}</span>
                </div>
              </div>
            </div>
              </>
            ) : (
              <div
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => toggleExpandGroup(e, 'branches')}
                onMouseEnter={() => setHoveredNode('compact-branches')}
                onMouseLeave={() => setHoveredNode(null)}
                style={{
                  position: 'absolute',
                  left: `${BRANCH_X}px`,
                  top: `${BRANCH_COMPACT_Y}px`,
                  width: `${BRANCH_W}px`,
                  height: `${BRANCH_COMPACT_H}px`,
                  backgroundColor: '#FFFFFF',
                  borderRadius: '14px',
                  border: `1.5px solid ${hoveredNode === 'compact-branches' ? '#0F766E' : isHitlActive ? '#F59E0B' : isAutoActive ? '#10B981' : '#CBD5E1'}`,
                  borderTop: `3px solid ${!isAgentConnected ? '#CBD5E1' : isHitlActive ? '#F59E0B' : isAutoActive ? '#10B981' : '#0F766E'}`,
                  boxShadow: hoveredNode === 'compact-branches' ? '0 10px 24px rgba(15, 118, 110, 0.16)' : '0 4px 14px rgba(15, 23, 42, 0.06)',
                  padding: '12px 14px',
                  boxSizing: 'border-box',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  zIndex: 12,
                  transition: 'border-color 0.15s, box-shadow 0.15s',
                }}
              >
                <div style={{ position: 'absolute', left: '-6px', top: '50%', transform: 'translateY(-50%)', width: '12px', height: '12px', borderRadius: '50%', backgroundColor: isHitlActive ? '#F59E0B' : '#10B981', border: '2px solid #FFFFFF', zIndex: 15 }} />
                <div style={{ position: 'absolute', right: '-6px', top: '50%', transform: 'translateY(-50%)', width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#0891B2', border: '2px solid #FFFFFF', zIndex: 15 }} />
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '0.625rem', fontWeight: 800, color: '#0F766E' }}>{t('pipeline.canvas.branches.compactHeader')}</span>
                    <span style={{ fontSize: '0.62rem', fontWeight: 800, padding: '1px 6px', borderRadius: '999px', backgroundColor: !isAgentConnected ? '#F1F5F9' : isHitlActive ? '#FEF3C7' : isAutoActive ? '#ECFDF5' : '#F0FDFA', color: !isAgentConnected ? '#64748B' : isHitlActive ? '#B45309' : isAutoActive ? '#059669' : '#0F766E' }}>
                      {!isAgentConnected ? 'Offline' : isHitlActive ? `${pendingApprovalsCount} HITL` : isAutoActive ? 'AUTO' : t('pipeline.canvas.branches.compactBranchesCount')}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.84rem', fontWeight: 800, color: '#0F172A' }}>{t('pipeline.canvas.branches.compactTitle')}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '0.7rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 8px', borderRadius: '7px', backgroundColor: isAutoActive ? '#ECFDF5' : '#F8FAFC', border: isAutoActive ? '1px solid #A7F3D0' : '1px solid #E2E8F0' }}>
                    <span style={{ fontWeight: 700, color: '#065F46' }}>{t('pipeline.canvas.branches.compactItem1')}</span>
                    <span style={{ fontWeight: 700, color: isAutoActive ? '#059669' : '#64748B' }}>{isAutoActive ? t('pipeline.canvas.branches.compactRunning') : t('pipeline.canvas.branches.compactReady')}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 8px', borderRadius: '7px', backgroundColor: isHitlActive ? '#FFFBEB' : '#F8FAFC', border: isHitlActive ? '1px solid #FDE68A' : '1px solid #E2E8F0' }}>
                    <span style={{ fontWeight: 700, color: '#92400E' }}>{t('pipeline.canvas.branches.compactItem2')}</span>
                    <span style={{ fontWeight: 700, color: isHitlActive ? '#D97706' : '#64748B' }}>{t('pipeline.canvas.branches.compactWait', { count: pendingApprovalsCount > 0 ? pendingApprovalsCount : 0 })}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 8px', borderRadius: '7px', backgroundColor: isAuditActive ? '#FEF2F2' : '#F8FAFC', border: isAuditActive ? '1px solid #FECACA' : '1px solid #E2E8F0' }}>
                    <span style={{ fontWeight: 700, color: '#991B1B' }}>{t('pipeline.canvas.branches.compactItem3')}</span>
                    <span style={{ fontWeight: 700, color: isAuditActive ? '#DC2626' : '#64748B' }}>{isCircuitBreakerTripped ? t('pipeline.canvas.branches.compactTripped') : t('pipeline.canvas.branches.compactNormal')}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '7px', borderTop: '1px solid #F1F5F9', fontSize: '0.68rem', fontWeight: 800, color: '#0F766E' }}>
                  <span>{t('pipeline.canvas.branches.compactClickExpand')}</span>
                  <span style={{ padding: '1px 7px', borderRadius: '999px', backgroundColor: '#F0FDFA', border: '1px solid #99F6E4' }}>+3</span>
                </div>
              </div>
            )}

            {/* GIAI ĐOẠN 7: HẬU KIỂM PHỤC HỒI 60S & TỰ ĐÓNG SỰ CỐ */}
            <div
              data-inspector-trigger="true"
              onClick={(e) => handleInspectorClick(e, 'stage:verify')}
              onMouseEnter={(e) => {
                setHoveredNode('stage-verify');
                handleInspectorHover(e, 'stage:verify');
              }}
              onMouseLeave={() => {
                setHoveredNode(null);
                handleInspectorLeave('stage:verify');
              }}
              style={{
                position: 'absolute',
                left: `${VERIFY_X}px`,
                top: `${VERIFY_Y}px`,
                width: `${VERIFY_W}px`,
                height: `${VERIFY_H}px`,
                backgroundColor: '#FFFFFF',
                borderRadius: '14px',
                border: `1.5px solid ${isVerifyActive ? '#0891B2' : hoveredNode === 'stage-verify' ? '#38BDF8' : '#CBD5E1'}`,
                boxShadow: isVerifyActive
                  ? '0 10px 24px -5px rgba(8, 145, 178, 0.22)'
                  : hoveredNode === 'stage-verify'
                    ? '0 8px 20px rgba(15, 23, 42, 0.09)'
                    : '0 4px 14px rgba(15, 23, 42, 0.06)',
                display: 'flex',
                flexDirection: 'column',
                cursor: onNavigate ? 'pointer' : 'default',
                zIndex: 12,
                transition: 'border-color 0.2s, box-shadow 0.2s',
              }}
            >
              {/* Input Port (Trái) & Bottom Feedback Port */}
              <div style={{ position: 'absolute', left: '-6px', top: '50%', transform: 'translateY(-50%)', width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#0891B2', border: '2px solid #FFFFFF', boxShadow: '0 0 0 1px #CBD5E1', zIndex: 15 }} />
              <div style={{ position: 'absolute', bottom: '-6px', left: '50%', transform: 'translateX(-50%)', width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#0891B2', border: '2px solid #FFFFFF', boxShadow: '0 0 0 1px #CBD5E1', zIndex: 15 }} />

              <div
                style={{
                  padding: '10px 12px',
                  backgroundColor: '#F0F9FF',
                  borderBottom: '1px solid #BAE6FD',
                  borderTopLeftRadius: '12px',
                  borderTopRightRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                  <div
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '7px',
                      backgroundColor: '#E0F2FE',
                      color: '#0284C7',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <ShieldCheck size={14} />
                  </div>
                  <span style={{ fontSize: '0.71rem', fontWeight: 800, color: '#0C4A6E', whiteSpace: 'nowrap' }}>{t('pipeline.canvas.verifyCard.headerTitle')}</span>
                </div>
                <span
                  style={{
                    fontSize: '0.5625rem',
                    fontWeight: 700,
                    padding: '2px 7px',
                    borderRadius: '999px',
                    backgroundColor: hasUnrecoveredStep && openServiceIncidentsCount > 0 ? '#FEE2E2' : '#FFFFFF',
                    border: `1px solid ${hasUnrecoveredStep && openServiceIncidentsCount > 0 ? '#FCA5A5' : '#BAE6FD'}`,
                    color: hasUnrecoveredStep && openServiceIncidentsCount > 0 ? '#DC2626' : '#0369A1',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                >
                  {(recoveryStats.totalActions || actionTimeline.length) > 0
                    ? t('pipeline.canvas.verifyCard.tried24h', { count: recoveryStats.totalActions || actionTimeline.length })
                    : recoveryStats.runningCount > 0
                      ? t('pipeline.canvas.verifyCard.checking')
                      : 'Auto-Resolve'}
                </span>
              </div>

              <div style={{ padding: '9px 11px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '7px', minHeight: 0 }}>
                {/* Tỷ lệ phục hồi thực tế của riêng dịch vụ đang chọn */}
                <div
                  style={{
                    padding: '6px 9px',
                    borderRadius: '9px',
                    backgroundColor: '#F8FAFC',
                    border: '1px solid #E2E8F0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '6px',
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '0.55rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {t('pipeline.canvas.verifyCard.recoverTitle', { service: selectedService })}
                    </div>
                    <div style={{ fontSize: '0.56rem', color: '#64748B', fontFamily: 'var(--font-mono)', marginTop: '1px' }}>
                      {t('pipeline.canvas.verifyCard.recoverSummary', { succeeded: recoveryStats.succeededCount, failed: recoveryStats.failedCount })}
                    </div>
                  </div>
                  <div
                    style={{
                      fontSize: '1.05rem',
                      fontWeight: 800,
                      fontFamily: 'var(--font-mono)',
                      color:
                        recoveryStats.successRate === null
                          ? '#64748B'
                          : (openServiceIncidentsCount === 0 || recoveryStats.successRate >= 50)
                            ? '#059669'
                            : '#DC2626',
                      flexShrink: 0,
                    }}
                  >
                    {recoveryStats.successRate !== null ? `${recoveryStats.successRate}%` : '—'}
                  </div>
                </div>

                {/* Danh sách các bước Action đã thực thi & kết quả hậu kiểm (① Khởi động lại Pod • Chưa phục hồi...) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, minHeight: 0, overflow: 'hidden' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.58rem', fontWeight: 700, color: '#0F172A' }}>
                    <RefreshCw size={10} color="#0891B2" />
                    <span>{t('pipeline.canvas.verifyCard.timelineTitle')}</span>
                  </div>

                  {actionTimeline.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {actionTimeline.slice(-3).map((step) => (
                        <div
                          key={step.id}
                          title={`${step.actionLabelVi} • ${step.verdictLabel} (${step.timeStr})${step.isFailedOrUnrecovered && (step.error_message || step.result?.error) ? ` — ${step.error_message || step.result?.error}` : ''}`}
                          style={{
                            padding: '4px 6px',
                            borderRadius: '7px',
                            backgroundColor: step.isFailedOrUnrecovered
                              ? '#FEF2F2'
                              : step.isVerifiedRecovered
                                ? '#ECFDF5'
                                : '#EFF6FF',
                            border: `1px solid ${
                              step.isFailedOrUnrecovered
                                ? '#FECACA'
                                : step.isVerifiedRecovered
                                  ? '#A7F3D0'
                                  : '#BFDBFE'
                            }`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '5px',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', minWidth: 0 }}>
                            <span
                              style={{
                                width: '15px',
                                height: '15px',
                                borderRadius: '50%',
                                backgroundColor: step.isFailedOrUnrecovered ? '#DC2626' : '#2563EB',
                                color: '#FFFFFF',
                                fontSize: '0.55rem',
                                fontWeight: 800,
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                              }}
                            >
                              {step.stepIndex}
                            </span>
                            <span
                              title={step.actionLabelVi}
                              style={{
                                fontSize: '0.58rem',
                                fontWeight: 700,
                                color: '#0F172A',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {step.actionLabelVi}
                            </span>
                          </div>
                          <span
                            style={{
                              fontSize: '0.52rem',
                              fontWeight: 800,
                              color: step.isFailedOrUnrecovered
                                ? '#DC2626'
                                : step.isVerifiedRecovered
                                  ? '#059669'
                                  : '#1D4ED8',
                              whiteSpace: 'nowrap',
                              flexShrink: 0,
                            }}
                          >
                            {step.verdictLabel}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ fontSize: '0.59rem', color: '#64748B', lineHeight: 1.35 }}>
                      {t('pipeline.canvas.verifyCard.noActionsYet', { service: selectedService })}
                    </div>
                  )}
                </div>
              </div>

              <div
                style={{
                  padding: '6px 12px',
                  borderTop: '1px solid #F1F5F9',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '0.6rem',
                  color: '#0284C7',
                  fontWeight: 700,
                }}
              >
                <span>{t('pipeline.canvas.verifyCard.footerLeft')}</span>
                <span>{t('pipeline.canvas.verifyCard.footerRight')}</span>
              </div>
            </div>

            {/* NHÁNH SONG SONG: RULE ENGINE (6 LUẬT NGƯỠNG TĨNH & K8S REACTIVE — SONG SONG VỚI GRU) */}
            <div
              onMouseEnter={() => setHoveredNode('stage-rule-engine')}
              onMouseLeave={() => setHoveredNode(null)}
              style={{
                position: 'absolute',
                left: `${RULE_X}px`,
                top: `${RULE_Y}px`,
                width: `${RULE_W}px`,
                height: `${RULE_H}px`,
                backgroundColor: '#FFFFFF',
                borderRadius: '14px',
                border: `1.5px solid ${isRuleEngineTriggered ? '#EA580C' : hoveredNode === 'stage-rule-engine' ? '#FB923C' : '#FED7AA'}`,
                boxShadow: isRuleEngineTriggered
                  ? '0 10px 24px -5px rgba(234, 88, 12, 0.24)'
                  : hoveredNode === 'stage-rule-engine'
                    ? '0 8px 20px rgba(15, 23, 42, 0.09)'
                    : '0 4px 14px rgba(15, 23, 42, 0.05)',
                display: 'flex',
                flexDirection: 'column',
                zIndex: 12,
                boxSizing: 'border-box',
                transition: 'border-color 0.2s, box-shadow 0.2s',
              }}
            >
              {/* Input Port (Trái) & Output Port (Phải) */}
              <div
                style={{
                  position: 'absolute',
                  left: '-6px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  backgroundColor: '#EA580C',
                  border: '2px solid #FFFFFF',
                  boxShadow: '0 0 0 1px #FED7AA',
                  zIndex: 15,
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  right: '-6px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  backgroundColor: isRuleEngineTriggered ? '#EA580C' : '#F59E0B',
                  border: '2px solid #FFFFFF',
                  boxShadow: '0 0 0 1px #FED7AA',
                  zIndex: 15,
                }}
              />

              {/* Header (nhấn để bung / gập 6 luật R1..R6 ngay trên sơ đồ) */}
              <div
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => toggleExpandGroup(e, 'rule')}
                style={{
                  padding: isRuleExpanded ? '7px 14px' : '12px 14px',
                  backgroundColor: isRuleEngineTriggered ? '#FFF7ED' : '#FFFBF5',
                  borderBottom: isRuleExpanded ? '1px solid #FED7AA' : 'none',
                  borderRadius: isRuleExpanded ? '12px 12px 0 0' : '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '10px',
                  cursor: 'pointer',
                  flex: isRuleExpanded ? 'none' : 1,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div
                    style={{
                      width: '22px',
                      height: '22px',
                      borderRadius: '6px',
                      backgroundColor: '#FFEDD5',
                      color: '#EA580C',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Zap size={13} />
                  </div>
                  <span style={{ fontSize: '0.73rem', fontWeight: 800, color: '#9A3412', whiteSpace: 'nowrap' }}>
                    {t('pipeline.canvas.ruleCard.title')}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span
                    style={{
                      fontSize: '0.625rem',
                      fontWeight: 800,
                      padding: '2px 9px',
                      borderRadius: '999px',
                      backgroundColor: isRuleEngineTriggered ? '#FEE2E2' : '#ECFDF5',
                      border: `1px solid ${isRuleEngineTriggered ? '#FCA5A5' : '#A7F3D0'}`,
                      color: isRuleEngineTriggered ? '#DC2626' : '#059669',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {isRuleEngineTriggered
                      ? t('pipeline.canvas.ruleCard.triggeredCount', { count: triggeredRuleCount })
                      : t('pipeline.canvas.ruleCard.safeCount')}
                  </span>
                  <span
                    style={{
                      fontSize: '0.625rem',
                      fontWeight: 800,
                      padding: '2px 8px',
                      borderRadius: '999px',
                      backgroundColor: '#FFFFFF',
                      border: '1px solid #FDBA74',
                      color: '#C2410C',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {isRuleExpanded ? t('pipeline.canvas.ruleCard.collapse') : t('pipeline.canvas.ruleCard.expand')}
                  </span>
                </div>
              </div>

              {/* Body: 6 Luật Ngưỡng Tĩnh Realtime dạng lưới 3 cột × 2 hàng (chỉ bung ra khi nhấn mở) */}
              {isRuleExpanded && (
              <div
                style={{
                  padding: '8px 14px 10px',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '6px',
                  flex: 1,
                  boxSizing: 'border-box',
                }}
              >
                {ruleEngineChecks.map((rule) => {
                  const ruleInspectorId = `rule:${rule.id}`;
                  const isRulePinned = pinnedInspector?.id === ruleInspectorId;
                  const isRuleHovered = hoveredInspector?.id === ruleInspectorId;
                  return (
                    <div
                      key={rule.id}
                      data-inspector-trigger="true"
                      onMouseEnter={(e) => handleInspectorHover(e, ruleInspectorId)}
                      onMouseLeave={() => handleInspectorLeave(ruleInspectorId)}
                      onClick={(e) => handleInspectorClick(e, ruleInspectorId)}
                      style={{
                        padding: '5px 8px',
                        borderRadius: '8px',
                        backgroundColor: rule.triggered
                          ? '#FEF2F2'
                          : isRulePinned
                            ? '#FFF7ED'
                            : isRuleHovered
                              ? '#FFFBF5'
                              : '#F8FAFC',
                        border: `1.5px solid ${
                          isRulePinned
                            ? '#EA580C'
                            : rule.triggered
                              ? '#FCA5A5'
                              : isRuleHovered
                                ? '#FB923C'
                                : '#E2E8F0'
                        }`,
                        boxShadow: isRulePinned
                          ? '0 0 0 2px rgba(234, 88, 12, 0.16)'
                          : isRuleHovered
                            ? '0 2px 8px rgba(234, 88, 12, 0.12)'
                            : 'none',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        gap: '2px',
                        minWidth: 0,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', minWidth: 0 }}>
                          <span
                            style={{
                              width: '6px',
                              height: '6px',
                              borderRadius: '50%',
                              backgroundColor: rule.triggered ? '#EF4444' : '#10B981',
                              flexShrink: 0,
                            }}
                          />
                          <span
                            style={{
                              fontSize: '0.64rem',
                              fontWeight: 700,
                              color: rule.triggered ? '#B91C1C' : '#1E293B',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {rule.name}
                          </span>
                        </div>
                        <span
                          style={{
                            fontSize: '0.58rem',
                            fontWeight: 700,
                            fontFamily: 'var(--font-mono)',
                            color: rule.triggered ? '#DC2626' : '#059669',
                            whiteSpace: 'nowrap',
                            flexShrink: 0,
                          }}
                        >
                          {rule.value}
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: '0.5625rem',
                          fontFamily: 'var(--font-mono)',
                          color: '#64748B',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          paddingLeft: '11px',
                        }}
                      >
                        {rule.cond}
                      </div>
                    </div>
                  );
                })}
              </div>
              )}
            </div>

            {/* Nhãn chú thích trên đường nối Rule Engine → Multi-Agent RCA */}
            <div
              style={{
                position: 'absolute',
                left: `${(ruleOutPort.x + rcaTopPort.x) / 2 - 4}px`,
                top: `${ruleOutPort.y - 12}px`,
                transform: 'translateX(-50%)',
                zIndex: 8,
                pointerEvents: 'none',
              }}
            >
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '2px 8px',
                  borderRadius: '999px',
                  backgroundColor: isRuleEngineTriggered ? '#FFF7ED' : 'rgba(255, 255, 255, 0.95)',
                  border: `1px solid ${isRuleEngineTriggered ? '#FDBA74' : '#E2E8F0'}`,
                  color: isRuleEngineTriggered ? '#C2410C' : '#64748B',
                  fontSize: '0.58rem',
                  fontWeight: 700,
                  whiteSpace: 'nowrap',
                  boxShadow: '0 2px 6px rgba(15, 23, 42, 0.05)',
                }}
              >
                {t('pipeline.canvas.ruleCard.triggerRcaLabel')}
              </span>
            </div>

            {/* Nhãn chú thích trên đường Vòng lặp Hồi tiếp phía dưới */}
            <div
              style={{
                position: 'absolute',
                left: `${(metricBottomPort.x + verifyBottomPort.x) / 2}px`,
                top: `${feedbackTrackY - 12}px`,
                transform: 'translateX(-50%)',
                zIndex: 8,
                pointerEvents: 'none',
              }}
            >
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '3px 12px',
                  borderRadius: '999px',
                  backgroundColor: 'rgba(255, 255, 255, 0.94)',
                  border: '1px solid #BAE6FD',
                  color: '#0369A1',
                  fontSize: '0.625rem',
                  fontWeight: 700,
                  boxShadow: '0 2px 6px rgba(15, 23, 42, 0.05)',
                  whiteSpace: 'nowrap',
                }}
              >
                <RefreshCw size={11} />
                {t('pipeline.canvas.ruleCard.feedbackLoopLabel')}
              </span>
            </div>
              </>
            )}
          </>
        )}

        {/* ============================================================ */}
        {/* SƠ ĐỒ 2: TOÀN LUỒNG ĐẦY ĐỦ 01→07 + RẼ NHÁNH 4→16→10         */}
        {/* ============================================================ */}
        {showExtendedPipeline && activeDiagram === 'diagram2' && (
          <BranchedPipelineSection
            topOffset={18}
              canvasWidth={baseCanvasW}
              selectedService={selectedService}
              isAgentConnected={isAgentConnected}
              liveMetrics={liveMetrics}
              riskProbabilities={riskProbabilities}
              ruleEngineChecks={ruleEngineChecks}
              latestIncident={latestIncident}
              lastResolvedIncident={lastResolvedIncident}
              openServiceIncidentsCount={openServiceIncidentsCount}
              latestRecommendation={latestRecommendation}
              latestAutoAction={latestAutoAction}
              latestHitlApproval={latestHitlApproval}
              isCircuitBreakerTripped={isCircuitBreakerTripped}
              isBenignDbCacheState={isBenignDbCacheState}
              isVerifyingInProgress={isVerifyingInProgress}
              isRcaActive={isRcaActive}
              isAutoActionActive={isAutoActionActive}
              isHitlActive={isHitlActive}
              isAuditActive={isAuditActive}
              actionTimeline={actionTimeline}
              recoveryStats={recoveryStats}
              pipelineContext={pipelineContext}
              podCount={podCount}
              currentActiveStep={currentActiveStep}
              totalSteps={totalSteps}
              metricConfigs={METRIC_CONFIGS}
              riskNodes={ACTION_OUTCOME_NODES}
              effectiveTimesteps={effectiveTimesteps}
              chartMaxY={chartMaxY}
              yTicks={yTicks}
              activeSweepIdx={activeSweepIdx}
              currentStepLabel={currentStepLabel}
              prediction={prediction}
              rawRiskScore={rawRiskScore}
              isPredictionHealthy={isPredictionHealthy}
              isRiskDetected={isRiskDetected}
              isScaleDownOptimization={isScaleDownOptimization}
              topRiskEval={topRiskEval}
              isTelemetryExpanded={d2TelemetryExpanded}
              isRuleExpanded={d2RuleExpanded}
              isRisksExpanded={d2RisksExpanded}
              isCausesExpanded={d2CausesExpanded}
              isActionsExpanded={d2ActionsExpanded}
              onToggleTelemetry={(e) => {
                if (e) e.stopPropagation();
                didDragRef.current = false;
                setD2TelemetryExpanded((prev) => !prev);
              }}
              onToggleRule={(e) => {
                if (e) e.stopPropagation();
                didDragRef.current = false;
                setD2RuleExpanded((prev) => !prev);
              }}
              onToggleRisks={(e) => {
                if (e) e.stopPropagation();
                didDragRef.current = false;
                setD2RisksExpanded((prev) => !prev);
              }}
              onToggleCauses={(e) => {
                if (e) e.stopPropagation();
                didDragRef.current = false;
                setD2CausesExpanded((prev) => !prev);
              }}
              onToggleActions={(e) => {
                if (e) e.stopPropagation();
                didDragRef.current = false;
                setD2ActionsExpanded((prev) => !prev);
              }}
              onToggleAllBranches={(expandAll) => {
                didDragRef.current = false;
                setD2TelemetryExpanded(expandAll);
                setD2RuleExpanded(expandAll);
                setD2RisksExpanded(expandAll);
                setD2CausesExpanded(expandAll);
                setD2ActionsExpanded(expandAll);
              }}
              simulatedCauseCode={d2SimulatedCause}
              onSelectSimulatedCause={(code) => {
                didDragRef.current = false;
                setD2VerifyOutcome('auto');
                setD2SimulatedCause((prev) => (prev === code ? null : code));
              }}
              onClearSimulation={() => {
                didDragRef.current = false;
                setD2VerifyOutcome('auto');
                setD2SimulatedCause(null);
              }}
              verifyOutcomeMode={d2VerifyOutcome}
              onChangeVerifyOutcome={(mode) => {
                didDragRef.current = false;
                setD2VerifyOutcome((prev) => (prev === mode ? 'auto' : mode));
              }}
            />
        )}
      </div>

      {/* CỬA SỔ GIẢI THÍCH CHI TIẾT NỔI BÊN CẠNH (Hover để xem nhanh • Click để ghim giữ nguyên • Kéo thả để di chuyển • Click bên ngoài để đóng) */}
      {activeInspector && activeInspectorData && (
        <div
          ref={popoverRef}
          className="pipeline-inspector-popover"
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            left: `${activeInspector.x}px`,
            top: `${activeInspector.y}px`,
            width: '375px',
            maxWidth: 'calc(100% - 28px)',
            maxHeight: `calc(100% - ${Math.max(10, activeInspector.y)}px - 16px)`,
            backgroundColor: 'rgba(255, 255, 255, 0.98)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            borderRadius: '14px',
            border: `1.5px solid ${isInspectorPinned ? activeInspectorData.accent : '#CBD5E1'}`,
            boxShadow: isDraggingInspector
              ? '0 24px 52px rgba(15, 23, 42, 0.28), 0 8px 22px rgba(15, 23, 42, 0.12)'
              : '0 18px 42px rgba(15, 23, 42, 0.16), 0 4px 12px rgba(15, 23, 42, 0.06)',
            zIndex: 60,
            pointerEvents: isInspectorPinned ? 'auto' : 'none',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            transition: isDraggingInspector ? 'none' : 'left 0.12s ease-out, top 0.12s ease-out',
            userSelect: isDraggingInspector ? 'none' : 'auto',
          }}
        >
          {/* Header cửa sổ giải thích: Hỗ trợ nhấn giữ và kéo rê để di chuyển sang chỗ khác */}
          <div
            onMouseDown={isInspectorPinned ? handleInspectorHeaderMouseDown : undefined}
            style={{
              padding: '10px 12px',
              backgroundColor: activeInspectorData.bg,
              borderBottom: '1px solid rgba(226, 232, 240, 0.9)',
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: '8px',
              cursor: isInspectorPinned ? (isDraggingInspector ? 'grabbing' : 'grab') : 'default',
              userSelect: 'none',
            }}
            title={isInspectorPinned ? t('pipeline.inspector.dragToMoveTitle') : undefined}
          >
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <span
                  style={{
                    fontSize: '0.625rem',
                    fontWeight: 800,
                    letterSpacing: '0.04em',
                    color: activeInspectorData.accent,
                  }}
                >
                  {activeInspectorData.badge}
                </span>
                <span
                  style={{
                    fontSize: '0.6rem',
                    fontWeight: 800,
                    padding: '1px 7px',
                    borderRadius: '999px',
                    backgroundColor: activeInspectorData.isAlert ? '#FEE2E2' : '#ECFDF5',
                    color: activeInspectorData.isAlert ? '#DC2626' : '#059669',
                  }}
                >
                  {activeInspectorData.statusText}
                </span>
              </div>
              <div
                style={{
                  fontSize: '0.84rem',
                  fontWeight: 800,
                  color: '#0F172A',
                  marginTop: '4px',
                  lineHeight: 1.3,
                }}
              >
                {activeInspectorData.title}
              </div>
            </div>

            {isInspectorPinned && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setPinnedInspector(null);
                }}
                title={t('pipeline.inspector.closeWindowTitle')}
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '7px',
                  border: '1px solid #CBD5E1',
                  backgroundColor: '#FFFFFF',
                  color: '#475569',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  flexShrink: 0,
                  padding: 0,
                }}
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Nội dung giải thích dễ hiểu */}
          <div style={{ padding: '11px 12px', display: 'flex', flexDirection: 'column', gap: '9px', overflowY: 'auto', flex: 1, minHeight: 0 }}>
            <div style={{ fontSize: '0.75rem', color: '#334155', lineHeight: 1.5 }}>
              {activeInspectorData.summary}
            </div>

            {/* Bảng thông số thực tế trực tiếp */}
            {Array.isArray(activeInspectorData.rows) && activeInspectorData.rows.length > 0 && (
              <div
                style={{
                  backgroundColor: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  borderRadius: '9px',
                  padding: '7px 10px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '5px',
                }}
              >
                {activeInspectorData.rows.map((row, idx) => {
                  if (row.isFullWidth) {
                    return (
                      <div
                        key={row.label || idx}
                        style={{
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          color: '#334155',
                          padding: '3px 0 2px 0',
                          borderBottom: '1px dashed #E2E8F0',
                          marginBottom: '2px',
                          lineHeight: 1.35,
                        }}
                      >
                        {row.label}
                      </div>
                    );
                  }
                  return (
                    <div
                      key={row.label || idx}
                      style={{
                        display: 'flex',
                        alignItems: row.subValue ? 'flex-start' : 'center',
                        justifyContent: 'space-between',
                        gap: '8px',
                        fontSize: '0.7rem',
                        padding: '3px 0',
                        borderBottom: idx < activeInspectorData.rows.length - 1 ? '1px solid #F8FAFC' : 'none',
                      }}
                    >
                      <span style={{ color: '#475569', fontWeight: 600, flexShrink: 0, maxWidth: '56%', lineHeight: 1.3 }}>
                        {row.label}:
                      </span>
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontWeight: 700,
                          color: row.highlight ? '#DC2626' : (row.isRecovered ? '#059669' : '#0F172A'),
                          textAlign: 'right',
                          wordBreak: 'break-word',
                          flex: 1,
                          minWidth: 0,
                        }}
                      >
                        {row.subValue ? (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: 1.25 }}>
                            <span>{row.value}</span>
                            <span style={{ fontSize: '0.62rem', color: '#64748B', fontWeight: 500, fontFamily: 'sans-serif', marginTop: '1px' }}>
                              {row.subValue}
                            </span>
                          </div>
                        ) : (
                          row.value
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Bước xử lý tiếp theo */}
            {activeInspectorData.nextStep && (
              <div
                style={{
                  fontSize: '0.7rem',
                  color: '#1E293B',
                  backgroundColor: '#EFF6FF',
                  border: '1px solid #BFDBFE',
                  borderRadius: '8px',
                  padding: '7px 9px',
                  lineHeight: 1.45,
                }}
              >
                <strong style={{ color: '#1D4ED8' }}>{t('pipeline.inspector.nextStepLabel')}</strong>
                {activeInspectorData.nextStep}
              </div>
            )}
          </div>

          {/* Footer: Gợi ý Ghim / Đóng & Nút mở trang chi tiết */}
          <div
            style={{
              padding: '7px 12px',
              borderTop: '1px solid #F1F5F9',
              backgroundColor: '#FAFAFA',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '8px',
              flexShrink: 0,
            }}
          >
            <span style={{ fontSize: '0.65rem', color: '#64748B', fontWeight: 600 }}>
              {isInspectorPinned ? t('pipeline.inspector.pinnedHint') : t('pipeline.inspector.unpinnedHint')}
            </span>
            {isInspectorPinned && activeInspectorData.actionPath && onNavigate && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  const dest = activeInspectorData.actionPath;
                  setPinnedInspector(null);
                  onNavigate(dest);
                }}
                style={{
                  padding: '4px 9px',
                  borderRadius: '7px',
                  border: 'none',
                  backgroundColor: activeInspectorData.accent,
                  color: '#FFFFFF',
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {activeInspectorData.actionLabel || t('pipeline.inspector.viewDetailsBtn')}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AIPipelineFlowCanvas;
