import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { getIntlLocale } from '../../../i18n';
import { useDashboard } from '../context/DashboardContext';
import { aiService } from '../../../services/aiService';
import { selfHealingService } from '../../../services/selfHealingService';
import { telemetryService } from '../../../services/telemetryService';
import { clusterService } from '../../../services/clusterService';
import { dashboardStatisticsService } from '../../../services/dashboardStatisticsService';
import {
  doesEntityMatchServiceTarget,
  doesPodMatchServiceTarget,
  doesRecordMatchServiceTarget,
  extractActiveK8sServices,
} from '../../../utils/k8sServiceFilter';
import AIPipelineFlowCanvas from '../../../components/dashboard/ai/AIPipelineFlowCanvas';
import {
  Server,
  RefreshCw,
  Sliders,
  ChevronDown,
  ChevronUp,
  Cpu,
  Database,
  HardDrive,
  Box,
  AlertTriangle,
  Radio,
  Zap,
  CheckCircle2,
} from 'lucide-react';

const normalizeServiceName = (raw) => {
  if (!raw || typeof raw !== 'string') return '';
  return raw.replace(/^(Deployment|StatefulSet|DaemonSet|Pod|Service)\s*[:/]?\s*/i, '').trim();
};

const TELEMETRY_POINT_KEYS = [
  'cpu',
  'ram',
  'disk',
  'latency',
  'request_rate',
  'http_5xx_rate',
  'error_5xx',
  'pod_restart_count',
  'replica_count',
];

const mapSequenceToInputs = (points, idPrefix, extraFields = {}) => {
  const directInputs = [];
  points.forEach((pt, idx) => {
    const ts = pt.time_bucket ? new Date(pt.time_bucket).toISOString() : new Date().toISOString();
    for (const mName of TELEMETRY_POINT_KEYS) {
      if (pt[mName] !== undefined) {
        directInputs.push({
          id: `${idPrefix}-${idx}-${mName}`,
          ...extraFields,
          metric_name: mName === 'http_5xx_rate' ? 'error_5xx' : mName,
          metric_value: pt[mName],
          collected_at: ts,
        });
      }
    }
  });
  return directInputs;
};

const buildSequenceSignature = (points) => {
  if (!Array.isArray(points) || points.length === 0) return '';
  return points
    .map((pt) => `${pt.time_bucket || ''}:${pt.cpu ?? ''}:${pt.ram ?? ''}:${pt.disk ?? ''}:${pt.latency ?? ''}:${pt.request_rate ?? ''}:${pt.http_5xx_rate ?? pt.error_5xx ?? ''}`)
    .join('|');
};

const getWorkloadStorageKey = (clusterId) =>
  clusterId ? `selfheal_overview_selected_workload:${clusterId}` : 'selfheal_overview_selected_workload';

const readSavedWorkload = (clusterId) => {
  try {
    return localStorage.getItem(getWorkloadStorageKey(clusterId)) || '';
  } catch {
    return '';
  }
};

const saveSelectedWorkload = (clusterId, workload) => {
  try {
    if (workload) {
      localStorage.setItem(getWorkloadStorageKey(clusterId), workload);
    }
  } catch {}
};

const EMPTY_ARRAY = [];

const getPredictionTimeMs = (pred) => {
  const raw = pred?.evaluated_at || pred?.predicted_at || pred?.created_at;
  if (!raw) return 0;
  const ms = new Date(raw).getTime();
  return Number.isFinite(ms) ? ms : 0;
};

/**
 * Hợp nhất kết quả polling từ DB với các dự báo HEALTHY realtime phát qua WebSocket
 * (do backend dùng cơ chế Zero-Write for NORMAL, không ghi HEALTHY vào PostgreSQL).
 */
export const mergePolledPredictions = (prevList = [], dbList = []) => {
  const safePrev = Array.isArray(prevList) ? prevList : [];
  const safeDb = Array.isArray(dbList) ? dbList : [];
  const dbMaxTsByService = new Map();

  for (const item of safeDb) {
    const key = normalizeServiceName(item?.workload_name || item?.service_id);
    if (!key) continue;
    const ts = getPredictionTimeMs(item);
    if (ts >= (dbMaxTsByService.get(key) || 0)) {
      dbMaxTsByService.set(key, ts);
    }
  }

  const fresherLiveItems = [];
  const seenLiveServices = new Set();
  for (const item of safePrev) {
    const key = normalizeServiceName(item?.workload_name || item?.service_id);
    if (!key || seenLiveServices.has(key)) continue;
    const isLiveSynthetic = String(item?.id || '').startsWith('live-');
    const itemTs = getPredictionTimeMs(item);
    const dbMaxTs = dbMaxTsByService.get(key) || 0;
    if ((isLiveSynthetic && itemTs >= dbMaxTs) || itemTs > dbMaxTs) {
      fresherLiveItems.push(item);
      seenLiveServices.add(key);
    }
  }

  const merged = [...fresherLiveItems, ...safeDb].slice(0, 30);
  if (
    merged.length === safePrev.length &&
    merged.every(
      (item, idx) =>
        item?.id === safePrev[idx]?.id &&
        item?.status === safePrev[idx]?.status &&
        item?.prediction_type === safePrev[idx]?.prediction_type &&
        Number(item?.risk_score ?? -1) === Number(safePrev[idx]?.risk_score ?? -1)
    )
  ) {
    return safePrev;
  }
  return merged;
};

const areEntityListsEquivalent = (prevList, nextList) => {
  if (!Array.isArray(prevList) || !Array.isArray(nextList) || prevList.length !== nextList.length) {
    return false;
  }
  for (let i = 0; i < prevList.length; i++) {
    const a = prevList[i];
    const b = nextList[i];
    if (
      a?.id !== b?.id ||
      a?.status !== b?.status ||
      a?.updated_at !== b?.updated_at ||
      a?.resolved_at !== b?.resolved_at ||
      a?.last_occurred_at !== b?.last_occurred_at
    ) {
      return false;
    }
  }
  return true;
};

export const OverviewPage = () => {
  const { t, i18n } = useTranslation('dashboard');
  const METRIC_CONFIGS = useMemo(() => [
    { key: 'cpu', label: t('overview.metrics.cpu'), unit: '%' },
    { key: 'ram', label: t('overview.metrics.ram'), unit: '%' },
    { key: 'disk', label: t('overview.metrics.disk'), unit: '%' },
    { key: 'latency', label: t('overview.metrics.latency'), unit: 'ms' },
    { key: 'request_rate', label: t('overview.metrics.request_rate'), unit: 'req/s' },
    { key: 'error_5xx', label: t('overview.metrics.error_5xx'), unit: '%' },
    { key: 'pod_restart_count', label: t('overview.metrics.pod_restart_count'), unit: t('overview.units.times') },
    { key: 'replica_count', label: t('overview.metrics.replica_count'), unit: t('overview.units.pod') },
  ], [t]);

  const {
    currentOrg,
    currentEnv,
    isAgentConnected,
    isRefreshing,
    triggerRefresh,
    pendingApprovalsCount: ctxPendingApprovalsCount,
    activeIncidentsCount: ctxActiveIncidentsCount,
    onNavigate,
  } = useDashboard();

  const clusterParam = currentEnv?.clusterId || currentEnv?.id || currentEnv?.cluster;
  const orgParam = currentOrg?.id;
  // Chỉ coi cụm là trực tuyến khi có cụm hợp lệ VÀ tác tử Agent của chính cụm đó đang ONLINE
  const isClusterOnline = Boolean(
    currentEnv &&
      clusterParam &&
      (isAgentConnected || String(currentEnv?.agentStatus || '').toUpperCase() === 'ONLINE')
  );

  const [registeredWorkloads, setRegisteredWorkloads] = useState([]);
  const [selectedWorkload, setSelectedWorkload] = useState(() => readSavedWorkload(clusterParam));
  const [predictions, setPredictions] = useState([]);
  const [serviceInputsMap, setServiceInputsMap] = useState({});
  const [serviceStepMap, setServiceStepMap] = useState({});
  const [batchProgressMap, setBatchProgressMap] = useState({});
  const [incidents, setIncidents] = useState([]);
  const [incidentDetailsMap, setIncidentDetailsMap] = useState({});
  const [recommendations, setRecommendations] = useState([]);
  const [policies, setPolicies] = useState([]);
  const [healingActions, setHealingActions] = useState([]);
  const [totalHealingActions, setTotalHealingActions] = useState(0);
  const [approvals, setApprovals] = useState([]);
  const [overviewStats, setOverviewStats] = useState(null);
  const [clusterInfo, setClusterInfo] = useState(null);
  const [nodeTelemetry, setNodeTelemetry] = useState(null);
  const [clusterOpenIncidents, setClusterOpenIncidents] = useState(null);
  const [scaleMode, setScaleMode] = useState('standard');
  const [isKpiCollapsed, setIsKpiCollapsed] = useState(() => {
    try {
      return localStorage.getItem('overview_kpi_collapsed') === 'true';
    } catch {
      return false;
    }
  });
  const handleToggleKpiBar = useCallback(() => {
    setIsKpiCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('overview_kpi_collapsed', String(next));
      } catch {}
      return next;
    });
  }, []);
  const [isLoading, setIsLoading] = useState(false);
  const [isWsConnected, setIsWsConnected] = useState(false);
  const isFetchingRef = useRef(false);
  const fetchSeqRef = useRef(0);
  const prevClusterParamRef = useRef(clusterParam);
  const isWsConnectedRef = useRef(false);
  const lastWsBatchAtRef = useRef({});
  const lastWsPointsSigRef = useRef({});
  const lastStepSigRef = useRef({});
  // Bộ nhớ đệm lưu trữ metrics mới nhất của từng node để tổng hợp số liệu chuẩn xác cho toàn cụm
  const nodeMetricsMapRef = useRef(new Map());

  // Tính toán số liệu CPU / RAM / Disk trung bình có trọng số cho TOÀN BỘ CỤM (tất cả các nodes)
  const calculateClusterNodeMetrics = useCallback((nodesMap) => {
    if (!nodesMap) return null;
    const now = Date.now();
    let nodes = Array.from(nodesMap.values()).filter(
      (n) => !n.last_updated || now - n.last_updated < 180000
    );
    if (nodes.length === 0) {
      nodes = Array.from(nodesMap.values());
    }
    if (nodes.length === 0) return null;

    let sumUsedCores = 0;
    let sumTotalCores = 0;
    let sumUsedRamBytes = 0;
    let sumTotalRamBytes = 0;
    let sumDiskPct = 0;

    nodes.forEach((n) => {
      const cores = Number(n.cpu_cores || 12);
      const cpuPct = Number(n.cpu_usage_percent || 0);
      sumUsedCores += (cpuPct / 100) * cores;
      sumTotalCores += cores;

      const ramUsed = Number(n.ram_used_bytes || 0);
      const ramTotal = Number(n.ram_total_bytes || 8163258368);
      sumUsedRamBytes += ramUsed;
      sumTotalRamBytes += ramTotal;

      sumDiskPct += Number(n.disk_usage_percent || 4);
    });

    const clusterCpuPct = sumTotalCores > 0 ? (sumUsedCores / sumTotalCores) * 100 : 0;
    const clusterRamPct = sumTotalRamBytes > 0 ? (sumUsedRamBytes / sumTotalRamBytes) * 100 : 0;
    const avgDiskPct = nodes.length > 0 ? sumDiskPct / nodes.length : 4;

    return {
      node_cpu_percent: Number(clusterCpuPct.toFixed(1)),
      node_cpu_cores: sumTotalCores,
      node_ram_percent: Number(clusterRamPct.toFixed(1)),
      node_ram_gb: (sumUsedRamBytes / (1024 * 1024 * 1024)).toFixed(2),
      disk: Number(avgDiskPct.toFixed(1)),
      nodes_count: nodes.length,
    };
  }, []);

  // Chỉ dọn sạch dữ liệu cụm & khôi phục dịch vụ đã lưu khi thực sự ĐỔI SANG CỤM K8s KHÁC
  // (Không xóa selectedWorkload khi isClusterOnline nhấp nháy lúc vừa tải trang hoặc bấm Làm mới!)
  useEffect(() => {
    const prevCluster = prevClusterParamRef.current;
    if (prevCluster === clusterParam) return;
    prevClusterParamRef.current = clusterParam;

    setRegisteredWorkloads([]);
    setSelectedWorkload(readSavedWorkload(clusterParam));
    setPredictions([]);
    setServiceInputsMap({});
    setServiceStepMap({});
    setBatchProgressMap({});
    setIncidents([]);
    setIncidentDetailsMap({});
    setRecommendations([]);
    setPolicies([]);
    setHealingActions([]);
    setApprovals([]);
    setOverviewStats(null);
    setClusterInfo(null);
    setNodeTelemetry(null);
    nodeMetricsMapRef.current.clear();
    isWsConnectedRef.current = false;
    lastWsBatchAtRef.current = {};
    lastWsPointsSigRef.current = {};
    lastStepSigRef.current = {};
    setClusterOpenIncidents(0);
    setIsWsConnected(false);
    setIsLoading(false);
  }, [clusterParam]);

  // Khi cụm mất kết nối tạm thời: chỉ ngắt cờ WS/loading, giữ nguyên dịch vụ đã chọn để không bị tự nhảy
  useEffect(() => {
    if (!isClusterOnline) {
      setIsWsConnected(false);
      setIsLoading(false);
    }
  }, [isClusterOnline]);

  // Danh sách Workload thực tế đang chạy trên K8s (CHỈ lấy từ GET /api/v1/ai/workloads — tuyệt đối không fallback sang predictions[0] để tránh tự nhảy dịch vụ theo sự kiện WebSocket!)
  const availableWorkloads = useMemo(() => {
    if (!isClusterOnline) return [];
    return extractActiveK8sServices(registeredWorkloads);
  }, [isClusterOnline, registeredWorkloads]);
  const availableWorkloadsRef = useRef([]);
  availableWorkloadsRef.current = availableWorkloads;

  // Khóa chặt dịch vụ đang chọn ngay khi danh sách workload sẵn sàng (ưu tiên dịch vụ đã lưu trong localStorage)
  useEffect(() => {
    if (!isClusterOnline || availableWorkloads.length === 0) return;
    if (selectedWorkload && availableWorkloads.includes(selectedWorkload)) {
      return;
    }
    const saved = readSavedWorkload(clusterParam);
    const nextTarget = saved && availableWorkloads.includes(saved) ? saved : availableWorkloads[0];
    setSelectedWorkload(nextTarget);
    saveSelectedWorkload(clusterParam, nextTarget);
  }, [isClusterOnline, availableWorkloads, selectedWorkload, clusterParam]);

  const handleSelectWorkload = useCallback(
    (nextWorkload) => {
      setSelectedWorkload(nextWorkload);
      saveSelectedWorkload(clusterParam, nextWorkload);
    },
    [clusterParam]
  );

  const currentServiceTarget = useMemo(() => {
    if (!isClusterOnline || availableWorkloads.length === 0) return '';
    if (selectedWorkload && availableWorkloads.includes(selectedWorkload)) {
      return selectedWorkload;
    }
    const saved = readSavedWorkload(clusterParam);
    if (saved && availableWorkloads.includes(saved)) {
      return saved;
    }
    return availableWorkloads[0] || '';
  }, [isClusterOnline, availableWorkloads, selectedWorkload, clusterParam]);

  // Khi đổi sang dịch vụ khác: dọn ngay dữ liệu hành động/phê duyệt cũ để không nháy số liệu dịch vụ trước
  useEffect(() => {
    setHealingActions([]);
    setApprovals([]);
  }, [currentServiceTarget]);

  // 1. Tải tiến trình song song & cập nhật từng khối NGAY KHI có phản hồi (không bị chặn bởi API chậm nhất)
  const fetchData = useCallback(async (isSilent = false) => {
    if (!isClusterOnline) {
      setIsLoading(false);
      setIsWsConnected(false);
      return;
    }
    // Chống chồng chéo request khi polling định kỳ
    if (isSilent && isFetchingRef.current) return;
    isFetchingRef.current = true;
    const seq = ++fetchSeqRef.current;

    if (!isSilent) setIsLoading(true);
    try {
      const clusterIdClean =
        clusterParam && !String(clusterParam).startsWith('org-') && !String(clusterParam).startsWith('sandbox-')
          ? clusterParam
          : undefined;
      const orgIdClean =
        orgParam && !String(orgParam).startsWith('org-') && !String(orgParam).startsWith('sandbox-')
          ? orgParam
          : undefined;

      const isStale = () => seq !== fetchSeqRef.current;

      const tasks = [
        // Ưu tiên 1: Danh sách dịch vụ (Workloads) — không ghi đè mảng rỗng khi request thoáng lỗi/bị hủy
        aiService.getWorkloads(clusterParam, orgParam).then((val) => {
          if (!isStale() && Array.isArray(val) && val.length > 0) setRegisteredWorkloads(val);
        }),

        // Ưu tiên 2: Chỉ số Node mới nhất cho toàn CỤM K8s (Tổng hợp đúng từ TẤT CẢ các Node đang chạy, không lấy 1 node ngẫu nhiên để tránh nhảy số liệu!)
        clusterIdClean
          ? telemetryService
              .getNodeMetrics({
                orgId: orgIdClean,
                clusterId: clusterIdClean,
                limit: 12,
                order: 'desc',
              })
              .then((val) => {
                if (isStale() || !val?.items?.length) return;
                // Gom bản ghi mới nhất của TỪNG node_name và nạp vào nodeMetricsMapRef
                val.items.forEach((item) => {
                  const nodeName = item?.node_name || 'default';
                  const existing = nodeMetricsMapRef.current.get(nodeName);
                  if (
                    !existing ||
                    !existing.collected_at ||
                    new Date(item.collected_at) >= new Date(existing.collected_at)
                  ) {
                    nodeMetricsMapRef.current.set(nodeName, { ...item, last_updated: Date.now() });
                  }
                });

                const clusterAgg = calculateClusterNodeMetrics(nodeMetricsMapRef.current);
                if (clusterAgg) {
                  setNodeTelemetry((prev) => ({
                    ...(prev || {}),
                    ...clusterAgg,
                  }));
                }
              })
          : Promise.resolve(),

        // Ưu tiên 3: Thống kê tổng quan & chi tiết cụm (Pods / Nodes / Tự phục hồi / HITL)
        dashboardStatisticsService
          .getOverviewStats({
            organization_id: orgIdClean,
            cluster_id: clusterIdClean,
            time_range: '24h',
          })
          .then((val) => {
            if (!isStale() && val) setOverviewStats(val);
          }),

        clusterIdClean
          ? clusterService.getClusterDetail(clusterIdClean, orgIdClean).then((val) => {
              if (!isStale() && val) setClusterInfo(val);
            })
          : Promise.resolve(),

        // Ưu tiên 4: Live Summary bản rút gọn (lite=true, chỉ ~3KB)
        telemetryService
          .getLiveSummary(currentServiceTarget || undefined, {
            clusterId: clusterIdClean,
            lite: true,
          })
          .then((data) => {
            if (isStale() || !data) return;
            setNodeTelemetry((prev) => {
              const next = { ...(prev || {}), ...(data.latest_point || {}) };
              if (data.latest_node_metric) {
                const nm = data.latest_node_metric;
                if (nm.node_name === 'cluster') {
                  if (nm.cpu_usage_percent !== undefined) next.node_cpu_percent = Number(nm.cpu_usage_percent);
                  if (nm.ram_usage_percent !== undefined) next.node_ram_percent = Number(nm.ram_usage_percent);
                  if (nm.cpu_cores !== undefined) next.node_cpu_cores = Number(nm.cpu_cores);
                  if (nm.ram_used_bytes) next.node_ram_gb = (Number(nm.ram_used_bytes) / (1024 * 1024 * 1024)).toFixed(2);
                  if (nm.disk_usage_percent !== undefined) next.disk = Number(nm.disk_usage_percent);
                } else {
                  nodeMetricsMapRef.current.set(nm.node_name || 'default', { ...nm, last_updated: Date.now() });
                  const clusterAgg = calculateClusterNodeMetrics(nodeMetricsMapRef.current);
                  if (clusterAgg) {
                    Object.assign(next, clusterAgg);
                  }
                }
              }
              return next;
            });
          }),

        // Ưu tiên 5: Chuỗi 12 điểm viễn trắc của dịch vụ đang chọn
        // Khi WebSocket đang trực tuyến và vừa cập nhật chuỗi trong 15s gần đây -> bỏ qua HTTP ghi đè để không giật biểu đồ
        (() => {
          if (!currentServiceTarget) return Promise.resolve();
          const lastWsAt = lastWsBatchAtRef.current[currentServiceTarget] || 0;
          const hasFreshWsData =
            isSilent &&
            isWsConnectedRef.current &&
            Date.now() - lastWsAt < 15000 &&
            Boolean(lastWsPointsSigRef.current[currentServiceTarget]);
          if (hasFreshWsData) return Promise.resolve();

          return telemetryService
            .getMetricsSequence(currentServiceTarget, {
              limit: 12,
              cluster_id: clusterParam,
              fill_padding: false,
            })
            .then((metricsSeq) => {
              if (isStale() || !Array.isArray(metricsSeq) || metricsSeq.length === 0) return;
              // Tránh ghi đè nếu WebSocket vừa cập nhật mới hơn trong lúc request đang bay
              if (isSilent && Date.now() - (lastWsBatchAtRef.current[currentServiceTarget] || 0) < 5000) return;

              const sig = buildSequenceSignature(metricsSeq);
              if (sig && sig === lastWsPointsSigRef.current[currentServiceTarget]) return;
              lastWsPointsSigRef.current[currentServiceTarget] = sig;

              const directInputs = mapSequenceToInputs(metricsSeq, `seq-init-${currentServiceTarget}`);
              if (directInputs.length > 0) {
                setServiceInputsMap((prev) => ({
                  ...prev,
                  [currentServiceTarget]: directInputs,
                }));
              }
            });
        })(),

        // Dự báo AI (GRU 7-Head)
        aiService
          .getPredictions({
            limit: 20,
            cluster_id: clusterParam,
            organization_id: orgParam,
          })
          .then((val) => {
            if (isStale()) return;
            const predsList = Array.isArray(val) ? val : Array.isArray(val?.items) ? val.items : [];
            setPredictions((prev) => mergePolledPredictions(prev, predsList));

            const inputsMap = {};
            predsList.forEach((pred) => {
              const wl = normalizeServiceName(pred.workload_name || pred.service_id);
              if (wl && Array.isArray(pred.sequence) && pred.sequence.length > 0 && !inputsMap[wl]) {
                const directInputs = mapSequenceToInputs(pred.sequence, `seq-${pred.id}`, {
                  prediction_id: pred.id,
                });
                if (directInputs.length > 0) {
                  inputsMap[wl] = directInputs;
                }
              }
            });
            if (Object.keys(inputsMap).length > 0) {
              setServiceInputsMap((prev) => {
                const hasMissingKey = Object.keys(inputsMap).some((k) => !prev[k] || prev[k].length === 0);
                return hasMissingKey ? { ...inputsMap, ...prev } : prev;
              });
            }
          }),

        // Gọi DUY NHẤT 1 lần getIncidents thay vì 2 lần trùng nhau (giảm 50% băng thông!)
        aiService
          .getIncidents({
            limit: 30,
            cluster_id: clusterParam,
            organization_id: orgParam,
          })
          .then((val) => {
            if (isStale()) return;
            const allList = Array.isArray(val) ? val : Array.isArray(val?.items) ? val.items : [];
            setIncidents((prev) => (areEntityListsEquivalent(prev, allList) ? prev : allList));
            const openCount = allList.filter((i) =>
              ['OPEN', 'INVESTIGATING'].includes(String(i.status || '').toUpperCase())
            ).length;
            setClusterOpenIncidents((prev) => (prev === openCount ? prev : openCount));

            const tLower = (currentServiceTarget || '').toLowerCase().trim();
            if (!tLower) return;
            const knownServices = availableWorkloadsRef.current;
            const matchingInc =
              allList.find(
                (inc) =>
                  String(inc.status || '').toUpperCase() === 'OPEN' &&
                  doesRecordMatchServiceTarget(inc, tLower, knownServices)
              ) ||
              allList.find((inc) =>
                doesRecordMatchServiceTarget(inc, tLower, knownServices)
              );

            if (matchingInc?.id) {
              aiService
                .getIncidentDetail(matchingInc.id)
                .then((detail) => {
                  if (!isStale() && detail) {
                    setIncidentDetailsMap((prev) => ({ ...prev, [matchingInc.id]: detail }));
                  }
                })
                .catch(() => {});
            }
          }),

        // Khuyến nghị, Chính sách, Hành động tự phục hồi, Phê duyệt HITL
        aiService
          .getRecommendations({ limit: 20, cluster_id: clusterParam, organization_id: orgParam })
          .then((val) => {
            if (!isStale()) {
              const items = Array.isArray(val) ? val : Array.isArray(val?.items) ? val.items : [];
              setRecommendations((prev) => (areEntityListsEquivalent(prev, items) ? prev : items));
            }
          }),

        selfHealingService.getPolicies({ organization_id: orgParam }).then((val) => {
          if (!isStale()) {
            const items = Array.isArray(val) ? val : Array.isArray(val?.items) ? val.items : [];
            setPolicies((prev) => (areEntityListsEquivalent(prev, items) ? prev : items));
          }
        }),

        currentServiceTarget
          ? selfHealingService
              .getActions({
                limit: 100,
                hours: 24,
                cluster_id: clusterParam,
                organization_id: orgParam,
                search: currentServiceTarget,
              })
              .then((val) => {
                if (!isStale()) {
                  const items = Array.isArray(val) ? val : Array.isArray(val?.items) ? val.items : [];
                  const total = typeof val?.total === 'number' ? val.total : items.length;
                  setHealingActions((prev) => (areEntityListsEquivalent(prev, items) ? prev : items));
                  setTotalHealingActions((prev) => (prev === total ? prev : total));
                }
              })
          : Promise.resolve(),

        currentServiceTarget
          ? selfHealingService
              .getApprovals({
                limit: 20,
                cluster_id: clusterParam,
                organization_id: orgParam,
                search: currentServiceTarget,
              })
              .then((val) => {
                if (!isStale()) {
                  const items = Array.isArray(val) ? val : Array.isArray(val?.items) ? val.items : [];
                  setApprovals((prev) => (areEntityListsEquivalent(prev, items) ? prev : items));
                }
              })
          : Promise.resolve(),
      ];

      await Promise.allSettled(tasks);
    } catch (err) {
      console.warn('[OverviewPage] Lỗi khi nạp dữ liệu AI:', err);
    } finally {
      isFetchingRef.current = false;
      setIsLoading(false);
    }
  }, [isClusterOnline, clusterParam, orgParam, currentServiceTarget, calculateClusterNodeMetrics]);

  useEffect(() => {
    if (!isClusterOnline) return;
    fetchData();
    // Khi WebSocket đã kết nối trực tiếp, giảm tần suất polling HTTP xuống 15s để triệt tiêu hiện tượng giật đồ thị
    const pollIntervalMs = isWsConnected ? 15000 : 5000;
    const interval = setInterval(() => fetchData(true), pollIntervalMs);
    return () => clearInterval(interval);
  }, [fetchData, isClusterOnline, isWsConnected]);

  // 2. Lắng nghe WebSocket thời gian thực (CHỈ kết nối khi cụm ONLINE và đã xác định rõ dịch vụ đang chọn — bỏ fallback cứng 'mongodb')
  useEffect(() => {
    if (!isClusterOnline || !currentServiceTarget) {
      isWsConnectedRef.current = false;
      setIsWsConnected(false);
      return;
    }
    let unsubscribe = null;
    try {
      unsubscribe = telemetryService.subscribeWebSocket(
        currentServiceTarget,
        (payload) => {
          if (!payload) return;

          // A. Gói tin tiến độ gom 12 bước viễn trắc thời gian thực (batch_accumulation)
          if (payload.type === 'batch_accumulation' && payload.data) {
            const bp = payload.data;
            const sId = normalizeServiceName(bp.service_id);
            if (!sId) return;

            lastWsBatchAtRef.current[sId] = Date.now();

            setBatchProgressMap((prev) => {
              const cur = prev[sId];
              if (cur && cur.active_step === bp.active_step && cur.collected === bp.collected && cur.status === bp.status) {
                return prev;
              }
              return { ...prev, [sId]: bp };
            });

            if (bp.active_step && lastStepSigRef.current[sId] !== bp.active_step) {
              lastStepSigRef.current[sId] = bp.active_step;
              setServiceStepMap((prev) => ({
                ...prev,
                [sId]: bp.active_step,
              }));
            }

            if (Array.isArray(bp.points) && bp.points.length > 0) {
              const sig = buildSequenceSignature(bp.points);
              if (sig !== lastWsPointsSigRef.current[sId]) {
                lastWsPointsSigRef.current[sId] = sig;
                const directInputs = mapSequenceToInputs(bp.points, `live-${sId}`);
                if (directInputs.length > 0) {
                  setServiceInputsMap((prev) => ({
                    ...prev,
                    [sId]: directInputs,
                  }));
                }
              }
            }
          }

          // B. Gói tin lượt dự báo mới từ GRU Pipeline (ai_prediction)
          if (payload.type === 'ai_prediction' && payload.data) {
            const newPred = payload.data;
            const predId = newPred.prediction_id || newPred.id;
            const wlName = normalizeServiceName(newPred.workload_name || newPred.service_id || newPred.target_name);

            const formatted = {
              id: predId,
              workload_name: wlName,
              service_id: wlName,
              status: newPred.status || 'HEALTHY',
              prediction_type: newPred.primary_risk || 'NORMAL',
              risk_score: newPred.overall_risk_score,
              confidence_score: newPred.confidence_score,
              ...newPred,
            };

            setPredictions((prev) => {
              if (!prev.some((p) => p.id === predId)) {
                return [formatted, ...prev.slice(0, 29)];
              }
              return prev;
            });

            if (Array.isArray(newPred.sequence) && newPred.sequence.length >= 12) {
              const sig = buildSequenceSignature(newPred.sequence);
              if (sig !== lastWsPointsSigRef.current[wlName]) {
                lastWsPointsSigRef.current[wlName] = sig;
                const directInputs = mapSequenceToInputs(newPred.sequence, `ws-${predId}`, {
                  prediction_id: predId,
                });
                if (directInputs.length > 0) {
                  setServiceInputsMap((prev) => ({
                    ...prev,
                    [wlName]: directInputs,
                  }));
                }
              }
            }
          }

          // C. Sự cố & Chẩn đoán Đa tác tử RCA mới (incident)
          if (payload.type === 'incident' && payload.data) {
            const inc = payload.data;
            setIncidents((prev) => {
              const filtered = prev.filter((item) => item.id !== inc.id);
              return [
                {
                  ...inc,
                  target_name: normalizeServiceName(inc.target_name || inc.service_id),
                  status: inc.status || 'OPEN',
                },
                ...filtered.slice(0, 19),
              ];
            });
          }

          // D. Khuyến nghị AI mới từ RecommendationAgent (ai_recommendation)
          if (payload.type === 'ai_recommendation' && payload.data) {
            const rec = payload.data;
            setRecommendations((prev) => {
              const filtered = prev.filter((item) => item.id !== rec.id);
              return [rec, ...filtered.slice(0, 19)];
            });
          }

          // E. Yêu cầu phê duyệt HITL mới (approval_created)
          if (payload.type === 'approval_created' && payload.data) {
            const appr = payload.data;
            setApprovals((prev) => {
              const filtered = prev.filter((item) => item.id !== appr.id);
              return [{ ...appr, status: 'PENDING' }, ...filtered.slice(0, 19)];
            });
            fetchData(true);
          }

          // F. Cập nhật hành động tự phục hồi & hậu kiểm tự đóng sự cố
          if (
            ['incident_resolved', 'healing_action', 'healing_action_update', 'action_completed', 'recovery_verified'].includes(
              payload.type
            )
          ) {
            fetchData(true);
          }

          // G. Thông số toàn cụm máy chủ (CPU/RAM/Disk thực tế từ eBPF NodeResourceCollector)
          // Đảm bảo tổng hợp trọng số của TẤT CẢ các Node đang chạy, không ghi đè đơn lẻ 1 Node để tránh nhảy số!
          if (payload.type === 'node_metrics' && payload.data) {
            const raw = payload.data;
            const nodeName = raw.node_name || 'default';
            nodeMetricsMapRef.current.set(nodeName, {
              ...(nodeMetricsMapRef.current.get(nodeName) || {}),
              ...raw,
              last_updated: Date.now(),
            });

            const clusterAgg = calculateClusterNodeMetrics(nodeMetricsMapRef.current);
            if (clusterAgg) {
              setNodeTelemetry((prev) => {
                if (
                  prev &&
                  prev.node_cpu_percent === clusterAgg.node_cpu_percent &&
                  prev.node_ram_percent === clusterAgg.node_ram_percent &&
                  prev.node_ram_gb === clusterAgg.node_ram_gb &&
                  prev.disk === clusterAgg.disk
                ) {
                  return prev;
                }
                return {
                  ...(prev || {}),
                  ...clusterAgg,
                };
              });
            }
          } else if (payload.type === 'initial_snapshot' && payload.data) {
            const snap = payload.data;
            if (snap.latest_node_metric || snap.latest_point) {
              setNodeTelemetry((prev) => {
                const next = { ...(prev || {}), ...(snap.latest_point || {}) };
                const nm = snap.latest_node_metric;
                if (nm) {
                  if (nm.node_name === 'cluster') {
                    if (nm.cpu_usage_percent !== undefined) next.node_cpu_percent = Number(nm.cpu_usage_percent);
                    if (nm.ram_usage_percent !== undefined) next.node_ram_percent = Number(nm.ram_usage_percent);
                    if (nm.cpu_cores !== undefined) next.node_cpu_cores = Number(nm.cpu_cores);
                    if (nm.ram_used_bytes) next.node_ram_gb = (Number(nm.ram_used_bytes) / (1024 * 1024 * 1024)).toFixed(2);
                    if (nm.disk_usage_percent !== undefined) next.disk = Number(nm.disk_usage_percent);
                  } else {
                    nodeMetricsMapRef.current.set(nm.node_name || 'default', { ...nm, last_updated: Date.now() });
                    const clusterAgg = calculateClusterNodeMetrics(nodeMetricsMapRef.current);
                    if (clusterAgg) {
                      Object.assign(next, clusterAgg);
                    }
                  }
                }
                return next;
              });
            }
          } else if ((payload.type === 'raw_metric' || payload.type === 'metrics') && payload.data) {
            const raw = payload.data;
            if (raw.latency !== undefined) {
              const nextLatency = Number(raw.latency);
              setNodeTelemetry((prev) => {
                if (prev && Number(prev.latency) === nextLatency) return prev;
                return { ...(prev || {}), latency: nextLatency };
              });
            }
          }
        },
        (connected) => {
          isWsConnectedRef.current = connected;
          setIsWsConnected(connected);
        },
        clusterParam
      );
    } catch (e) {
      console.warn('[OverviewPage] WebSocket không khả dụng:', e);
    }

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [isClusterOnline, currentServiceTarget, clusterParam, fetchData, calculateClusterNodeMetrics]);

  // Dự báo mới nhất ĐÚNG của Service đang chọn (tuyệt đối không fallback sang service khác!)
  const displaySelectedPrediction = useMemo(() => {
    if (!predictions || predictions.length === 0) return null;
    const knownServices = availableWorkloadsRef.current;
    const found =
      predictions.find((p) =>
        doesEntityMatchServiceTarget(
          p.workload_name || p.service_id,
          currentServiceTarget,
          knownServices
        )
      ) || null;

    if (!found) return null;

    const serviceIncidents = (incidents || []).filter((inc) =>
      doesRecordMatchServiceTarget(inc, currentServiceTarget, knownServices)
    );
    const hasOpenIncidents = serviceIncidents.some((inc) =>
      ['OPEN', 'INVESTIGATING', 'AWAITING_APPROVAL'].includes(String(inc.status || '').toUpperCase())
    );
    const latestResolved = serviceIncidents.find(
      (inc) => String(inc.status || '').toUpperCase() === 'RESOLVED'
    );

    // ANTI-STALE RESOLVED INCIDENT POLLUTION:
    // Nếu dịch vụ KHÔNG còn sự cố nào đang mở (0 OPEN)
    // VÀ sự cố gần nhất đã ở trạng thái RESOLVED
    // VÀ thời điểm dự báo này (predicted_at / created_at) xảy ra TRƯỚC hoặc TẠI THỜI ĐIỂM sự cố được giải quyết (resolved_at):
    // => Dự báo rủi ro này thuộc về sự cố cũ ĐÃ PHỤC HỒI! Tự động chuyển về trạng thái HEALTHY an toàn.
    const predTimeMs = found.predicted_at
      ? new Date(found.predicted_at).getTime()
      : found.created_at
        ? new Date(found.created_at).getTime()
        : 0;
    const resolvedTimeMs = latestResolved?.resolved_at
      ? new Date(latestResolved.resolved_at).getTime()
      : 0;

    const isStaleFromResolvedIncident =
      !hasOpenIncidents &&
      (resolvedTimeMs > 0 || (predTimeMs > 0 && Date.now() - predTimeMs > 60000) || predTimeMs === 0);

    if (isStaleFromResolvedIncident) {
      return {
        ...found,
        status: 'HEALTHY',
        prediction_type: 'NORMAL',
        primary_risk: 'NORMAL',
        overall_risk_score: 0,
        risk_score: 0,
        confidence_score: 0,
        detected_risks: [],
        risk_outputs: {
          CPU_OVERLOAD: { confidence: 0 },
          OOM: { confidence: 0 },
          DISK_FULL: { confidence: 0 },
          HIGH_LATENCY: { confidence: 0 },
          HTTP_5XX_SPIKE: { confidence: 0 },
          TRAFFIC_OVERLOAD: { confidence: 0 },
          SCALE_DOWN_CANDIDATE: { confidence: 0 },
        },
      };
    }

    return found;
  }, [predictions, currentServiceTarget, incidents]);

  // Nạp chi tiết inputs khi đổi prediction
  useEffect(() => {
    if (!displaySelectedPrediction?.id) return;
    if (serviceInputsMap[currentServiceTarget]?.length > 0) return;

    let isMounted = true;
    aiService.getPredictionInputs(displaySelectedPrediction.id).then((inputs) => {
      if (isMounted && Array.isArray(inputs) && inputs.length > 0) {
        setServiceInputsMap((prev) => ({
          ...prev,
          [currentServiceTarget]: inputs,
        }));
      }
    }).catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [displaySelectedPrediction?.id, currentServiceTarget, serviceInputsMap]);

  // Dữ liệu viễn trắc thô CÔ LẬP theo đúng Service đang chọn (tuyệt đối không mượn dữ liệu của service trước!)
  const currentInputs = useMemo(() => {
    if (!currentServiceTarget) return [];
    const fromMap = serviceInputsMap[currentServiceTarget];
    if (Array.isArray(fromMap) && fromMap.length > 0) return fromMap;
    return [];
  }, [serviceInputsMap, currentServiceTarget]);

  // Biến đổi thành chuỗi 12 bước viễn trắc (T1..T12)
  const timesteps = useMemo(() => {
    if (!currentInputs || currentInputs.length === 0) return [];

    const map = new Map();
    currentInputs.forEach((item) => {
      const key = item.collected_at ? new Date(item.collected_at).toISOString() : item.id;
      if (!map.has(key)) {
        const d = new Date(item.collected_at);
        const timeLabel = isNaN(d.getTime())
          ? ''
          : d.toLocaleTimeString(getIntlLocale(i18n.language), { hour: '2-digit', minute: '2-digit', second: '2-digit' });

        map.set(key, {
          rawTime: item.collected_at,
          timeLabel,
          cpu: 0,
          ram: 0,
          disk: 0,
          latency: 0,
          request_rate: 0,
          error_5xx: 0,
          pod_restart_count: 0,
          replica_count: 1,
        });
      }

      const entry = map.get(key);
      const mName = item.metric_name?.toLowerCase();
      const val = parseFloat(item.metric_value) || 0;
      let targetKey = mName;
      if (mName === 'http_5xx_rate') targetKey = 'error_5xx';
      else if (mName === 'restarts' || mName === 'restart_count' || mName === 'pod_restart_count') targetKey = 'pod_restart_count';
      else if (mName === 'replicas' || mName === 'pod_count' || mName === 'replica_count') targetKey = 'replica_count';

      if (targetKey && entry[targetKey] !== undefined) {
        entry[targetKey] = val;
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
  }, [currentInputs, i18n.language]);

  // Thống kê nhanh 6 chỉ số viễn trắc
  const seriesSummaries = useMemo(() => {
    if (timesteps.length === 0) return [];
    return METRIC_CONFIGS.map((cfg) => {
      const vals = timesteps.map((t) => Number(t[cfg.key] || 0)).filter((v) => !isNaN(v));
      const min = vals.length > 0 ? Math.min(...vals) : 0;
      const max = vals.length > 0 ? Math.max(...vals) : 0;
      const sum = vals.reduce((a, b) => a + b, 0);
      const avg = vals.length > 0 ? sum / vals.length : 0;
      const latest = vals.length > 0 ? (vals[vals.length - 1] ?? 0) : 0;
      return {
        key: cfg.key,
        label: cfg.label,
        min: Number(min || 0).toFixed(2),
        max: Number(max || 0).toFixed(2),
        avg: Number(avg || 0).toFixed(2),
        latest: Number(latest || 0).toFixed(2),
      };
    });
  }, [timesteps, METRIC_CONFIGS]);

  const currentActiveStep = isClusterOnline
    ? (serviceStepMap[currentServiceTarget] ?? (timesteps.length > 0 ? Math.min(timesteps.length, 12) : 12))
    : 0;

  // Quy mô Pods & Nodes thực tế của Service đang chọn (kiểm tra chặt chẽ vị trí Pod trên từng Node)
  const currentServiceMetadata = useMemo(() => {
    if (!isClusterOnline) {
      return { pods: 0, nodes: 0, totalClusterNodes: 0, nodeNames: [] };
    }

    const targetLower = (currentServiceTarget || '').toLowerCase().trim();
    const totalClusterNodes =
      Array.isArray(clusterInfo?.nodes) && clusterInfo.nodes.length > 0 ? clusterInfo.nodes.length : 1;

    // Tìm các Pod thực tế thuộc dịch vụ đang chọn từ clusterInfo.pods
    const matchedPods = (clusterInfo?.pods || []).filter((p) => {
      if (!p || !p.name) return false;
      const isMatch = doesPodMatchServiceTarget(p, targetLower, availableWorkloads);

      const isTerminating =
        String(p.status || '').toLowerCase() === 'terminating' ||
        String(p.phase || '').toLowerCase() === 'terminating' ||
        Boolean(p.deleted_at) ||
        Boolean(p.deletion_timestamp);

      const isAlive =
        !isTerminating &&
        !['Failed', 'Unknown', 'Completed', 'Succeeded'].includes(p.phase);
      return isMatch && isAlive;
    });

    // Lọc danh sách Node thực tế mà các Pod của dịch vụ này đang cư trú (loại trừ unassigned)
    const activeNodeNames = Array.from(
      new Set(
        matchedPods
          .map((p) => p.node_name)
          .filter((name) => Boolean(name) && name !== 'unassigned')
      )
    );

    // Dự phòng qua liveBatch nếu clusterInfo.pods chưa load xong
    const liveBatch = batchProgressMap[currentServiceTarget];
    const livePt = liveBatch?.latest_point || (Array.isArray(liveBatch?.points) && liveBatch.points[liveBatch.points.length - 1]);
    const liveReplica = (livePt?.replica_count !== undefined && Number(livePt.replica_count) > 0)
      ? Number(livePt.replica_count)
      : (nodeTelemetry?.replica_count !== undefined && Number(nodeTelemetry.replica_count) > 0)
        ? Number(nodeTelemetry.replica_count)
        : null;

    // Ưu tiên số Pods Running thực tế từ K8s (loại trừ Pod đang Terminating/xóa)
    const podsCount = matchedPods.length > 0
      ? matchedPods.length
      : ((liveReplica !== null && liveReplica !== undefined && liveReplica > 0) ? liveReplica : 0);
    const nodesCount = activeNodeNames.length > 0 ? activeNodeNames.length : (podsCount > 0 ? Math.min(podsCount, totalClusterNodes) : 0);

    return {
      pods: podsCount,
      nodes: nodesCount,
      totalClusterNodes,
      nodeNames: activeNodeNames,
    };
  }, [isClusterOnline, batchProgressMap, currentServiceTarget, clusterInfo, nodeTelemetry, availableWorkloads]);

  // Tổng hợp dữ liệu thực tế CÔ LẬP NGHIÊM NGẶT theo ĐÚNG dịch vụ đang chọn (tuyệt đối không lẫn dữ liệu dịch vụ khác!)
  const pipelineContext = useMemo(() => {
    const targetLower = (currentServiceTarget || '').toLowerCase().trim();
    const knownServices = availableWorkloadsRef.current;

    const matchesTarget = (raw) =>
      doesEntityMatchServiceTarget(raw, targetLower, knownServices);

    const resolveActionLabel = (act) =>
      act?.action_type_name ||
      act?.action_type_code ||
      act?.action_name ||
      act?.action_code ||
      act?.result?.action ||
      act?.action ||
      t('overview.actions.defaultHealing');

    const serviceIncidents = (incidents || []).filter((inc) =>
      doesRecordMatchServiceTarget(inc, targetLower, knownServices)
    );
    const openServiceIncidents = serviceIncidents.filter((inc) =>
      ['OPEN', 'INVESTIGATING', 'AWAITING_APPROVAL'].includes(String(inc.status || '').toUpperCase())
    );
    const resolvedServiceIncidents = serviceIncidents.filter(
      (inc) => String(inc.status || '').toUpperCase() === 'RESOLVED'
    );
    // Phân tách rõ ràng Sự cố ĐANG MỞ (activeOpenIncident) với Sự cố ĐÃ ĐÓNG (lastResolvedIncident) — không bao giờ hiển thị sự cố cũ đã RESOLVED như lỗi đang xảy ra!
    const activeOpenIncident = openServiceIncidents[0] || null;
    const lastResolvedIncident = resolvedServiceIncidents[0] || null;
    const latestIncident = activeOpenIncident;

    // Lấy đề xuất của sự cố đang mở hoặc sự cố gần nhất để giữ ngữ cảnh phân tích
    const targetIncident = activeOpenIncident || lastResolvedIncident;
    const serviceRecs = (recommendations || []).filter(
      (rec) =>
        (targetIncident?.id && rec.incident_id === targetIncident.id) ||
        doesRecordMatchServiceTarget(
          rec,
          targetLower,
          knownServices,
          ['service_id', 'workload_name', 'target_name'],
          ['incident_title']
        )
    );
    const latestRecommendation = serviceRecs[0] || null;

    const activePolicies = (policies || []).filter((p) => p.is_active !== false);
    const autoPoliciesCount = activePolicies.filter(
      (p) => ['AUTO', 'AUTONOMOUS'].includes(String(p.execution_mode || '').toUpperCase()) && !p.requires_approval
    ).length;
    const hitlPoliciesCount = activePolicies.length - autoPoliciesCount;
    const policyThresholdsArr = activePolicies
      .map((p) => Number(p.confidence_threshold))
      .filter((v) => Number.isFinite(v) && v > 0);
    const minPolicyConfidencePct =
      policyThresholdsArr.length > 0 ? Math.round(Math.min(...policyThresholdsArr) * 100) : null;
    const maxPolicyConfidencePct =
      policyThresholdsArr.length > 0 ? Math.round(Math.max(...policyThresholdsArr) * 100) : null;
    const cooldownValues = activePolicies
      .map((p) => Number(p.cooldown_seconds))
      .filter((v) => Number.isFinite(v) && v > 0);
    const policyCooldownSec = cooldownValues.length > 0 ? Math.min(...cooldownValues) : null;

    // Lấy hành động thuộc ĐÚNG dịch vụ đang chọn trong vòng 24 giờ qua (không lấy lịch sử xa xưa)
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;
    const nowMs = Date.now();

    const serviceActions = (healingActions || [])
      .filter((act) => {
        const matches =
          (activeOpenIncident?.id && act.incident_id === activeOpenIncident.id) ||
          doesRecordMatchServiceTarget(
            act,
            targetLower,
            knownServices,
            ['service_id', 'workload_name', 'target_name', 'result.target'],
            []
          );
        if (!matches) return false;
        const actTs = act.completed_at || act.started_at || act.created_at;
        const actTsMs = actTs ? new Date(actTs).getTime() : 0;
        return !actTsMs || actTsMs >= nowMs - ONE_DAY_MS;
      })
      .map((act) => ({
        ...act,
        display_action_name: resolveActionLabel(act),
      }));

    const latestAutoAction =
      serviceActions.find((act) =>
        ['AUTO', 'AUTONOMOUS'].includes(String(act.execution_mode || '').toUpperCase())
      ) || null;

    // Chỉ lấy yêu cầu phê duyệt HITL thuộc ĐÚNG dịch vụ đang chọn (tuyệt đối không lấy của dịch vụ khác như mongodb)
    const pendingServiceApprovals = (approvals || [])
      .filter(
        (a) =>
          String(a.status || a.approval_status || '').toUpperCase() === 'PENDING' &&
          ((activeOpenIncident?.id && a.incident_id === activeOpenIncident.id) ||
            doesRecordMatchServiceTarget(
              a,
              targetLower,
              knownServices,
              ['service_id', 'workload_name', 'target_name', 'healing_action.target_name'],
              []
            ))
      )
      .map((a) => ({
        ...a,
        display_action_name: resolveActionLabel(a.healing_action || a),
      }));
    const latestHitlApproval = pendingServiceApprovals[0] || null;

    const recActionStr = String(
      latestRecommendation?.action || latestRecommendation?.action_code || latestRecommendation?.recommendation || ''
    ).toUpperCase();
    // Chỉ kích hoạt Circuit Breaker khi ĐANG có sự cố mở có khuyến nghị NO_ACTION (không kích hoạt từ sự cố cũ đã RESOLVED!)
    const isCircuitBreakerTripped = Boolean(activeOpenIncident) && recActionStr === 'NO_ACTION';

    const ACTION_VI_MAP = {
      RESTART_POD: t('overview.actions.RESTART_POD'),
      'Restart Pod': t('overview.actions.RESTART_POD'),
      REPLACE_POD: t('overview.actions.REPLACE_POD'),
      'Replace Pod': t('overview.actions.REPLACE_POD'),
      SCALE_REPLICAS: t('overview.actions.SCALE_REPLICAS'),
      SCALE_UP: t('overview.actions.SCALE_UP'),
      'Scale Replicas': t('overview.actions.SCALE_REPLICAS'),
      SCALE_DOWN: t('overview.actions.SCALE_DOWN'),
      ROLLBACK_DEPLOYMENT: t('overview.actions.ROLLBACK_DEPLOYMENT'),
      'Rollback Deployment': t('overview.actions.ROLLBACK_DEPLOYMENT'),
      CLEANUP_TEMP_FILES: t('overview.actions.CLEANUP_STORAGE'),
      CLEANUP_STORAGE: t('overview.actions.CLEANUP_STORAGE'),
      DRAIN_NODE: t('overview.actions.DRAIN_NODE'),
      BLOCK_IP_TEMP: t('overview.actions.BLOCK_IP_TEMP'),
      TEMPORARY_IP_BLOCK: t('overview.actions.BLOCK_IP_TEMP'),
    };

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

    const translateActionVi = (raw, item = null) => {
      if (!raw) return t('overview.actions.defaultHealing');
      const str = String(raw).trim();
      const norm = str.toUpperCase().replace(/\s+/g, '_');

      if (
        norm === 'BLOCK_IP_TEMP' ||
        norm === 'TEMPORARY_IP_BLOCK' ||
        norm === 'BLOCK_IP' ||
        norm === 'IP_BLOCK' ||
        norm.includes('BLOCK_IP') ||
        str.toLowerCase().includes('chặn ip')
      ) {
        const ip = extractBlockedIp(item);
        return ip ? t('overview.actions.BLOCK_IP_SPECIFIC', { ip }) : t('overview.actions.BLOCK_IP_TEMP');
      }

      if (norm === 'SCALE_REPLICAS' || norm === 'SCALE_DOWN' || norm === 'SCALE_UP') {
        const rep = item?.result?.details?.replicas ?? item?.details?.replicas ?? item?.result?.params?.target_replicas ?? item?.target_replicas;
        const curRep = item?.result?.details?.current_replicas ?? item?.details?.current_replicas ?? item?.result?.params?.current_replicas ?? item?.current_replicas;
        // Chỉ xét ngữ cảnh hành động trực tiếp (loại trừ incident_title cũ để tránh nhiễu lịch sử)
        const directActionText = `${item?.result?.message || ''} ${item?.reason || ''} ${item?.reasoning || ''} ${item?.policy_name || ''} ${item?.details?.strategy || ''}`.toLowerCase();
        let isDown =
          norm === 'SCALE_DOWN' ||
          directActionText.includes('scale_down') ||
          directActionText.includes('scale-down') ||
          directActionText.includes('scale down') ||
          directActionText.includes('scale_in') ||
          directActionText.includes('scale-in') ||
          directActionText.includes('scale in') ||
          directActionText.includes('underutilized') ||
          directActionText.includes('thu hẹp') ||
          directActionText.includes('thu nhỏ') ||
          directActionText.includes('dư thừa');
        let isUp =
          norm === 'SCALE_UP' ||
          directActionText.includes('scale_up') ||
          directActionText.includes('scale-up') ||
          directActionText.includes('scale up') ||
          directActionText.includes('scale_out') ||
          directActionText.includes('scale-out') ||
          directActionText.includes('scale out') ||
          directActionText.includes('quá tải') ||
          directActionText.includes('cpu_overload') ||
          directActionText.includes('mở rộng') ||
          directActionText.includes('traffic');

        if (rep !== undefined && rep !== null && curRep !== undefined && curRep !== null && !isNaN(Number(rep)) && !isNaN(Number(curRep))) {
          if (Number(rep) < Number(curRep)) {
            isDown = true;
            isUp = false;
          } else if (Number(rep) > Number(curRep)) {
            isUp = true;
            isDown = false;
          }
        } else if (isUp && !isDown) {
          isDown = false;
        } else if (isDown && !isUp) {
          isUp = false;
        }

        const base = isDown ? t('overview.actions.SCALE_DOWN') : isUp ? t('overview.actions.SCALE_UP') : t('overview.actions.SCALE_REPLICAS');
        return rep !== undefined && rep !== null ? `${base} (→ ${rep})` : base;
      }
      return ACTION_VI_MAP[str] || ACTION_VI_MAP[norm] || str;
    };

    // Ghép lịch sử chi tiết từ incidentDetail.healing_history (chứa kết quả hậu kiểm thật: Đã phục hồi / Chưa phục hồi) + serviceActions (trong vòng 24h)
    const detailIncidentRef = activeOpenIncident || lastResolvedIncident;
    const activeIncidentDetail = detailIncidentRef?.id ? incidentDetailsMap[detailIncidentRef.id] : null;
    const rawDetailHistory = Array.isArray(activeIncidentDetail?.healing_history)
      ? activeIncidentDetail.healing_history.filter((item) => {
          const t = item.target_name || item.service_id || '';
          if (t && !matchesTarget(t)) return false;
          const hTs = item.verified_at || item.completed_at || item.created_at;
          const hTsMs = hTs ? new Date(hTs).getTime() : 0;
          return !hTsMs || hTsMs >= nowMs - ONE_DAY_MS;
        })
      : [];

    const mergedMap = new Map();
    const isIncidentResolved = !activeOpenIncident;
    const resolvedIncidentIds = new Set(
      (incidents || [])
        .filter((inc) => String(inc.status || '').toUpperCase() === 'RESOLVED')
        .map((inc) => inc.id)
    );

    const upsertTimelineItem = (item, source) => {
      const key = item.id || `${item.action_code || item.action_type_code || item.action_name}-${item.completed_at || item.created_at || source}`;
      const existing = mergedMap.get(key) || {};
      const merged = {
        ...existing,
        ...item,
        verification: item.verification ?? existing.verification ?? null,
        verification_result:
          item.verification_result !== undefined && item.verification_result !== null
            ? item.verification_result
            : existing.verification_result,
      };
      const rawCode =
        merged.action_code ||
        merged.action_type_code ||
        merged.action_name ||
        merged.action_type_name ||
        merged.result?.action ||
        merged.display_action_name;
      const execStatus = String(merged.execution_status || '').toUpperCase();
      // Đọc đúng kết quả hậu kiểm 60s từ cả 2 nguồn:
      // 1) GET /healing/actions trả về lồng trong merged.verification.verification_result
      // 2) GET /ai/incidents/:id (healing_history) trả về phẳng ở merged.verification_result
      const rawVerResult =
        merged.verification_result !== undefined && merged.verification_result !== null
          ? merged.verification_result
          : merged.verification?.verification_result;
      const verResult =
        rawVerResult === true || rawVerResult === 'true'
          ? true
          : rawVerResult === false || rawVerResult === 'false'
            ? false
            : null;
      const ts =
        merged.verified_at ||
        merged.verification?.verified_at ||
        merged.completed_at ||
        merged.started_at ||
        merged.created_at ||
        null;
      const tsMs = ts ? new Date(ts).getTime() : 0;
      if (tsMs && tsMs < nowMs - ONE_DAY_MS) return; // Chỉ lấy các hành động trong vòng 24 giờ qua
      const isRecentAction = tsMs > Date.now() - 180000; // Trong vòng 3 phút

      // Bảo toàn tính trung thực của lịch sử vòng lặp tự trị MAPE-K:
      // 1. verResult === true: Xác minh hoàn tất và thành công -> "Đã phục hồi" (Xanh).
      // 2. verResult === false hoặc execStatus === 'FAILED': Thất bại -> "Chưa phục hồi" (Đỏ).
      // 3. verResult === null và execStatus === 'SUCCEEDED': Đang chờ 60s hậu kiểm -> "Đang hậu kiểm" (Tuyệt đối không gán nhãn Đã phục hồi sớm!).
      //    (Chỉ những action cũ > 3 phút không có bảng verification mới coi là đã xong trong quá khứ).
      const isActionIncidentResolved =
        (merged.incident_id && resolvedIncidentIds.has(merged.incident_id)) ||
        isIncidentResolved;

      const agentDoneStatus = String(merged?.result?.agent_status || '').toUpperCase();
      const isAgentAwaitingVerify =
        execStatus === 'RUNNING' && (agentDoneStatus === 'COMPLETED' || agentDoneStatus === 'SUCCEEDED');
      const isExecCompleted = execStatus === 'SUCCEEDED' || execStatus === 'COMPLETED';

      const isVerifiedRecovered =
        verResult === true ||
        (verResult === null && isExecCompleted && !isRecentAction && isActionIncidentResolved);

      const isFailedOrUnrecovered =
        execStatus === 'FAILED' ||
        verResult === false;

      const isVerifying =
        verResult === null &&
        (isExecCompleted || isAgentAwaitingVerify) &&
        !isVerifiedRecovered &&
        !isFailedOrUnrecovered;

      const isRunning = execStatus === 'RUNNING' && !isAgentAwaitingVerify;
      const d = ts ? new Date(ts) : null;
      const intlLocale = getIntlLocale(i18n.language);
      const timeStr = d
        ? `${d.toLocaleDateString(intlLocale, { day: '2-digit', month: '2-digit', year: 'numeric' })} ${d.toLocaleTimeString(intlLocale, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
        : '--:--:--';

      mergedMap.set(key, {
        ...merged,
        id: key,
        actionLabelVi: translateActionVi(rawCode, merged),
        execStatus,
        isFailedOrUnrecovered,
        isVerifiedRecovered,
        isVerifying,
        isRunning,
        verdictLabel: isRunning
          ? t('overview.verdict.running')
          : isFailedOrUnrecovered
            ? t('overview.verdict.unrecovered')
            : isVerifiedRecovered
              ? t('overview.verdict.recovered')
              : isVerifying
                ? t('overview.verdict.verifying')
                : execStatus || t('overview.verdict.recorded'),
        tsMs,
        timeStr,
      });
    };

    serviceActions.forEach((a) => upsertTimelineItem(a, 'act'));
    rawDetailHistory.forEach((h) => upsertTimelineItem(h, 'hist'));

    // Lịch sử tự phục hồi và hậu kiểm của dịch vụ đang chọn trong vòng 24 giờ qua
    const sortedMerged = Array.from(mergedMap.values()).sort((a, b) => a.tsMs - b.tsMs);
    const totalCount = sortedMerged.length;
    const startStepIndex = 1;

    let prevRepTrack = null;
    const actionTimeline = sortedMerged.map((item, idx) => {
      let finalLabel = item.actionLabelVi;
      const rawCode =
        item.action_code ||
        item.action_type_code ||
        item.action_name ||
        item.action_type_name ||
        item.result?.action ||
        item.display_action_name;
      const norm = String(rawCode || '').trim().toUpperCase().replace(/\s+/g, '_');
      if (norm === 'SCALE_REPLICAS' || norm === 'SCALE_DOWN' || norm === 'SCALE_UP') {
        const rep =
          item?.result?.details?.replicas ??
          item?.details?.replicas ??
          item?.result?.params?.target_replicas ??
          item?.target_replicas;
        const curRep =
          item?.result?.details?.current_replicas ??
          item?.details?.current_replicas ??
          item?.result?.params?.current_replicas ??
          item?.current_replicas;

        // Chỉ kiểm tra ngữ cảnh trực tiếp của hành động này (loại trừ incident_title để không bị dính nhãn sự cố cũ)
        const directActionText = `${item?.result?.message || ''} ${item?.reason || ''} ${item?.reasoning || ''} ${item?.policy_name || ''} ${item?.details?.strategy || ''}`.toLowerCase();
        const isExplicitDown =
          norm === 'SCALE_DOWN' ||
          directActionText.includes('scale_down') ||
          directActionText.includes('scale-down') ||
          directActionText.includes('scale down') ||
          directActionText.includes('scale_in') ||
          directActionText.includes('scale-in') ||
          directActionText.includes('scale in') ||
          directActionText.includes('underutilized') ||
          directActionText.includes('thu hẹp') ||
          directActionText.includes('thu nhỏ') ||
          directActionText.includes('dư thừa');
        const isExplicitUp =
          norm === 'SCALE_UP' ||
          directActionText.includes('scale_up') ||
          directActionText.includes('scale-up') ||
          directActionText.includes('scale up') ||
          directActionText.includes('scale_out') ||
          directActionText.includes('scale-out') ||
          directActionText.includes('scale out') ||
          directActionText.includes('quá tải') ||
          directActionText.includes('cpu_overload') ||
          directActionText.includes('mở rộng') ||
          directActionText.includes('traffic');

        if (rep !== undefined && rep !== null) {
          const numRep = Number(rep);
          // Ưu tiên 1: So sánh với curRep nếu có
          if (curRep !== undefined && curRep !== null && !isNaN(Number(curRep)) && Number(curRep) !== numRep) {
            const numCurRep = Number(curRep);
            if (numRep < numCurRep) {
              finalLabel = `${t('overview.actions.SCALE_DOWN')} (→ ${numRep})`;
            } else {
              finalLabel = `${t('overview.actions.SCALE_UP')} (→ ${numRep})`;
            }
          }
          // Ưu tiên 2: So sánh theo tiến trình thời gian với số Pod của bước trước (prevRepTrack)
          else if (prevRepTrack !== null && !isNaN(prevRepTrack) && numRep !== prevRepTrack) {
            if (numRep < prevRepTrack) {
              finalLabel = `${t('overview.actions.SCALE_DOWN')} (→ ${numRep})`;
            } else {
              finalLabel = `${t('overview.actions.SCALE_UP')} (→ ${numRep})`;
            }
          }
          // Ưu tiên 3: Nếu là bước đầu tiên hoặc số Pod không đổi, xét từ khóa hành động trực tiếp
          else if (isExplicitUp && !isExplicitDown) {
            finalLabel = `${t('overview.actions.SCALE_UP')} (→ ${numRep})`;
          } else if (isExplicitDown && !isExplicitUp) {
            finalLabel = `${t('overview.actions.SCALE_DOWN')} (→ ${numRep})`;
          } else if (numRep >= 3) {
            finalLabel = `${t('overview.actions.SCALE_UP')} (→ ${numRep})`;
          } else {
            finalLabel = `${t('overview.actions.SCALE_DOWN')} (→ ${numRep})`;
          }

          prevRepTrack = numRep;
        }
      } else if (
        norm === 'BLOCK_IP_TEMP' ||
        norm === 'TEMPORARY_IP_BLOCK' ||
        norm === 'BLOCK_IP' ||
        norm === 'IP_BLOCK' ||
        norm.includes('BLOCK_IP') ||
        String(finalLabel || '').toLowerCase().includes('chặn ip')
      ) {
        const ip = extractBlockedIp(item);
        if (ip) {
          finalLabel = t('overview.actions.BLOCK_IP_SPECIFIC', { ip });
        }
      }

      return {
        ...item,
        actionLabelVi: finalLabel,
        stepIndex: startStepIndex + idx,
      };
    });

    // Thống kê Hậu kiểm 60s tính trên chính actionTimeline đã ghép đầy đủ kết quả xác minh của ĐÚNG dịch vụ đang chọn
    const succeededCount = actionTimeline.filter((a) => a.isVerifiedRecovered).length;
    const failedCount = actionTimeline.filter((a) => a.isFailedOrUnrecovered).length;
    const verifyingCount = actionTimeline.filter((a) => a.isVerifying).length;
    const runningCount = actionTimeline.filter((a) => a.isRunning).length;
    const completedCount = succeededCount + failedCount;
    const successRate = completedCount > 0 ? Math.round((succeededCount / completedCount) * 100) : null;
    const latestCompletedAction =
      [...actionTimeline].reverse().find((a) => a.isVerifiedRecovered || a.isFailedOrUnrecovered || a.isVerifying) || null;
    const effectiveLatestAutoAction =
      latestAutoAction ||
      [...actionTimeline].reverse().find((a) => ['AUTO', 'AUTOMATIC', 'AUTONOMOUS', ''].includes(String(a.execution_mode || '').toUpperCase())) ||
      null;

    // Phân tích bằng chứng thật từ rca_analyses.analysis_result cho 4 tác tử ở Cột 04 (không dùng chữ cứng)
    const rawAnalysisSrc = activeIncidentDetail?.analysis_result || activeOpenIncident?.analysis_result || null;
    let parsedAnalysis = null;
    if (rawAnalysisSrc) {
      if (typeof rawAnalysisSrc === 'string') {
        try {
          parsedAnalysis = JSON.parse(rawAnalysisSrc);
        } catch {
          parsedAnalysis = null;
        }
      } else if (typeof rawAnalysisSrc === 'object') {
        parsedAnalysis = rawAnalysisSrc;
      }
    }
    const evidenceItems = [
      ...(Array.isArray(parsedAnalysis?.evidence_for) ? parsedAnalysis.evidence_for : []),
      ...(Array.isArray(parsedAnalysis?.symptoms) ? parsedAnalysis.symptoms : []),
      ...(Array.isArray(parsedAnalysis?.evidence) ? parsedAnalysis.evidence : []),
    ].map((e) => (typeof e === 'string' ? e : JSON.stringify(e)).toLowerCase());
    const missingEv = Array.isArray(parsedAnalysis?.missing_evidence)
      ? parsedAnalysis.missing_evidence.map((m) => String(m).toLowerCase())
      : [];
    const relatedRisksArr = Array.isArray(parsedAnalysis?.related_risks)
      ? parsedAnalysis.related_risks
      : Array.isArray(parsedAnalysis?.root_cause?.related_risks)
        ? parsedAnalysis.root_cause.related_risks
        : [];
    const similarIdsArr = Array.isArray(parsedAnalysis?.similar_incident_ids)
      ? parsedAnalysis.similar_incident_ids
      : [];
    const logEvidenceCount = evidenceItems.filter((s) =>
      /log|error|warn|exception|stacktrace|5xx|timeout|refused/i.test(s)
    ).length;
    const k8sEventEvidenceCount = evidenceItems.filter((s) =>
      /oom|backoff|crashloop|evict|unhealthy|probe|restart|kube|event/i.test(s)
    ).length;
    const isMissingK8sEvents = missingEv.some((m) => m.includes('kubernetes events') || m.includes('k8s'));
    const rawRcaConf =
      activeIncidentDetail?.confidence_score ??
      activeOpenIncident?.confidence_score ??
      parsedAnalysis?.root_cause?.confidence ??
      null;
    const rcaConfidencePct =
      rawRcaConf !== null && rawRcaConf !== undefined && Number.isFinite(Number(rawRcaConf))
        ? Math.round(Number(rawRcaConf) <= 1 ? Number(rawRcaConf) * 100 : Number(rawRcaConf))
        : null;
    const evidenceStatus =
      parsedAnalysis?.evidence_status || parsedAnalysis?.root_cause?.evidence_status || null;

    const rcaAgentsSummary = {
      metricsSub:
        relatedRisksArr.length > 0
          ? t('overview.rcaAgents.metricsStepsRisks', { steps: timesteps.length || 12, risks: relatedRisksArr.length })
          : timesteps.length > 0
            ? t('overview.rcaAgents.metricsSteps', { steps: timesteps.length })
            : t('overview.rcaAgents.sampling'),
      logSub: activeOpenIncident
        ? logEvidenceCount > 0
          ? t('overview.rcaAgents.logErrors', { count: logEvidenceCount })
          : t('overview.rcaAgents.zeroLogErrors')
        : t('overview.rcaAgents.monitoring'),
      k8sEventSub: activeOpenIncident
        ? k8sEventEvidenceCount > 0
          ? t('overview.rcaAgents.k8sEvents', { count: k8sEventEvidenceCount })
          : isMissingK8sEvents
            ? t('overview.rcaAgents.zeroK8sEvents')
            : t('overview.rcaAgents.noAnomaly')
        : t('overview.rcaAgents.podStable'),
      historySub:
        similarIdsArr.length > 0
          ? t('overview.rcaAgents.similarCases', { count: similarIdsArr.length })
          : t('overview.rcaAgents.serviceHistory', { count: serviceIncidents.length }),
      rcaConfidencePct,
      evidenceStatus,
      relatedRisksCount: relatedRisksArr.length,
    };

    return {
      latestIncident,
      lastResolvedIncident,
      openServiceIncidentsCount: openServiceIncidents.length,
      resolvedServiceIncidentsCount: resolvedServiceIncidents.length,
      totalServiceIncidentsCount: serviceIncidents.length,
      latestRecommendation,
      activePoliciesCount: activePolicies.length,
      totalPoliciesCount: (policies || []).length,
      autoPoliciesCount,
      hitlPoliciesCount,
      policyMeta: {
        minConfidencePct: minPolicyConfidencePct,
        maxConfidencePct: maxPolicyConfidencePct,
        cooldownSec: policyCooldownSec,
      },
      rcaAgentsSummary,
      latestAutoAction: effectiveLatestAutoAction,
      latestHitlApproval,
      pendingServiceApprovalsCount: pendingServiceApprovals.length,
      isCircuitBreakerTripped,
      actionTimeline,
      recoveryStats: {
        totalActions: totalCount,
        succeededCount,
        failedCount,
        verifyingCount,
        runningCount,
        successRate,
        latestCompletedAction,
        isServiceScope: true,
      },
    };
  }, [currentServiceTarget, incidents, incidentDetailsMap, recommendations, policies, healingActions, totalHealingActions, approvals, timesteps.length, t, i18n.language]);

  // ==========================================
  // 8 THẺ KPI HẠ TẦNG & VẬN HÀNH THỜI GIAN THỰC (CHỈ HIỂN THỊ KHI CỤM/AGENT ONLINE — MẤT KẾT NỐI ĐƯA TOÀN BỘ VỀ 0)
  // ==========================================
  const clusterKpiCards = useMemo(() => {
    const rawPods = isClusterOnline && Array.isArray(clusterInfo?.pods) ? clusterInfo.pods : [];
    const totalPodsCount = isClusterOnline
      ? rawPods.length > 0
        ? rawPods.length
        : Number(currentEnv?.pods || 0)
      : 0;
    const runningPodsCount = isClusterOnline
      ? rawPods.length > 0
        ? rawPods.filter((p) => p.status === 'Running' || p.phase === 'Running').length
        : totalPodsCount
      : 0;

    const rawNodes = isClusterOnline && Array.isArray(clusterInfo?.nodes) ? clusterInfo.nodes : [];
    const totalNodesCount = isClusterOnline
      ? rawNodes.length > 0
        ? rawNodes.length
        : Number(currentEnv?.nodes || 0)
      : 0;
    const readyNodesCount = isClusterOnline
      ? rawNodes.length > 0
        ? rawNodes.filter((n) => String(n.status || '').toLowerCase() === 'ready').length
        : totalNodesCount
      : 0;
    const nodeNamesList = rawNodes.map((n) => n.name).filter(Boolean);
    const allPodsHealthy = totalPodsCount > 0 && runningPodsCount === totalPodsCount;
    const allNodesHealthy = totalNodesCount > 0 && readyNodesCount === totalNodesCount;

    let totalCpuCores = 0;
    let totalRamGbNum = 0;
    let totalDiskTbNum = 0;
    if (isClusterOnline && Array.isArray(clusterInfo?.nodes) && clusterInfo.nodes.length > 0) {
      totalCpuCores = Math.round(
        clusterInfo.nodes.reduce((acc, n) => {
          const m = parseInt(n.cpu_capacity_millicores, 10);
          return acc + (Number.isFinite(m) ? m / 1000 : 0);
        }, 0)
      );
      const totalRamBytes = clusterInfo.nodes.reduce((acc, n) => {
        const b = parseInt(n.memory_capacity_bytes, 10);
        return acc + (Number.isFinite(b) ? b : 0);
      }, 0);
      const totalDiskBytes = clusterInfo.nodes.reduce((acc, n) => {
        const b = parseInt(n.disk_capacity_bytes, 10);
        return acc + (Number.isFinite(b) ? b : 0);
      }, 0);
      totalRamGbNum = totalRamBytes > 0 ? totalRamBytes / (1024 * 1024 * 1024) : 0;
      totalDiskTbNum = totalDiskBytes > 0 ? totalDiskBytes / (1024 * 1024 * 1024 * 1024) : 0;
    }

    const totalRamGb = totalRamGbNum.toFixed(1);
    const totalDiskTb = totalDiskTbNum.toFixed(1);

    const avgCpu1h =
      isClusterOnline && overviewStats?.resource_usage?.avg_cpu_percent !== undefined
        ? Number(overviewStats.resource_usage.avg_cpu_percent)
        : null;
    const avgRam1h =
      isClusterOnline && overviewStats?.resource_usage?.avg_ram_percent !== undefined
        ? Number(overviewStats.resource_usage.avg_ram_percent)
        : null;

    const liveCpuNum = !isClusterOnline
      ? 0
      : nodeTelemetry?.node_cpu_percent !== undefined &&
          nodeTelemetry.node_cpu_percent !== null &&
          Number.isFinite(Number(nodeTelemetry.node_cpu_percent))
        ? Number(nodeTelemetry.node_cpu_percent)
        : avgCpu1h !== null
          ? avgCpu1h
          : 0;
    const liveRamNum = !isClusterOnline
      ? 0
      : nodeTelemetry?.node_ram_percent !== undefined &&
          nodeTelemetry.node_ram_percent !== null &&
          Number.isFinite(Number(nodeTelemetry.node_ram_percent))
        ? Number(nodeTelemetry.node_ram_percent)
        : avgRam1h !== null
          ? avgRam1h
          : 0;

    const nodeCpuPercent = liveCpuNum.toFixed(1);
    const nodeRamPercent = liveRamNum.toFixed(1);
    const nodeUsedCpuCores =
      isClusterOnline && totalCpuCores > 0
        ? ((liveCpuNum / 100) * totalCpuCores).toFixed(2)
        : '0.00';
    const nodeRamGb = !isClusterOnline
      ? '0.00'
      : nodeTelemetry?.node_ram_gb !== undefined &&
          nodeTelemetry.node_ram_gb !== null &&
          Number(nodeTelemetry.node_ram_gb) > 0
        ? Number(nodeTelemetry.node_ram_gb).toFixed(2)
        : ((liveRamNum / 100) * totalRamGbNum).toFixed(2);

    const diskVal = !isClusterOnline
      ? 0
      : nodeTelemetry?.disk !== undefined && nodeTelemetry.disk !== null
        ? Math.round(Number(nodeTelemetry.disk))
        : overviewStats?.resource_usage?.avg_disk_percent !== undefined
          ? Math.round(Number(overviewStats.resource_usage.avg_disk_percent))
          : 0;
    const diskUsedGb = isClusterOnline ? Math.round((diskVal / 100) * totalDiskTbNum * 1024) : 0;
    const diskStatusText = !isClusterOnline
      ? t('overview.kpi.disconnected')
      : diskVal > 85
        ? t('overview.kpi.diskFullAlert')
        : diskVal > 70
          ? t('overview.kpi.diskWatch')
          : t('overview.kpi.normal');

    const openIncidentsTotal = !isClusterOnline
      ? 0
      : clusterOpenIncidents !== null
        ? clusterOpenIncidents
        : Number(ctxActiveIncidentsCount || 0);

    const agentLatencyMs =
      isClusterOnline && nodeTelemetry?.latency !== undefined && nodeTelemetry.latency !== null
        ? Math.round(Number(nodeTelemetry.latency))
        : 0;

    const remediationsTotal =
      isClusterOnline && overviewStats?.remediations?.total !== undefined
        ? Number(overviewStats.remediations.total)
        : 0;
    const remediationsSuccessRate =
      isClusterOnline && overviewStats?.remediations?.success_rate !== undefined
        ? Math.round(Number(overviewStats.remediations.success_rate))
        : 0;

    const pendingHitlTotal = isClusterOnline ? Number(ctxPendingApprovalsCount || 0) : 0;

    return [
      {
        id: 'cpu',
        label: t('overview.kpi.cpuCluster'),
        value: `${nodeCpuPercent}%`,
        subtext:
          totalCpuCores > 0
            ? `${nodeUsedCpuCores} / ${totalCpuCores} vCPUs`
            : `${nodeUsedCpuCores} vCPUs`,
        subColor: '#64748B',
        percent: Math.min(100, Math.max(0, liveCpuNum)),
        accent: liveCpuNum > 85 ? '#EF4444' : liveCpuNum > 70 ? '#F59E0B' : '#10B981',
        iconBg: liveCpuNum > 85 ? '#FEF2F2' : '#ECFDF5',
        iconBorder: liveCpuNum > 85 ? '#FECACA' : '#A7F3D0',
        Icon: Cpu,
        path: '/dashboard/infrastructure',
      },
      {
        id: 'ram',
        label: t('overview.kpi.ramCluster'),
        value: `${nodeRamPercent}%`,
        subtext:
          totalRamGbNum > 0 ? `${nodeRamGb} / ${totalRamGb} GiB` : `${nodeRamGb} GiB`,
        subColor: '#64748B',
        percent: Math.min(100, Math.max(0, liveRamNum)),
        accent: liveRamNum > 85 ? '#EF4444' : liveRamNum > 75 ? '#F59E0B' : '#0EA5E9',
        iconBg: liveRamNum > 85 ? '#FEF2F2' : '#F0F9FF',
        iconBorder: liveRamNum > 85 ? '#FECACA' : '#BAE6FD',
        Icon: Database,
        path: '/dashboard/infrastructure',
      },
      {
        id: 'disk',
        label: t('overview.kpi.diskCluster'),
        value: `${diskVal}%`,
        subtext:
          totalDiskTbNum > 0
            ? `${diskUsedGb} GiB / ${totalDiskTb} TiB`
            : diskStatusText,
        badge: diskStatusText,
        subColor:
          diskVal > 85 ? '#DC2626' : diskVal > 70 ? '#D97706' : '#059669',
        percent: Math.min(100, Math.max(0, diskVal)),
        accent: diskVal > 85 ? '#EF4444' : diskVal > 70 ? '#F59E0B' : '#64748B',
        iconBg: '#F8FAFC',
        iconBorder: '#E2E8F0',
        Icon: HardDrive,
        path: '/dashboard/infrastructure',
      },
      {
        id: 'pods',
        label: t('overview.kpi.podsAndNodes'),
        value: `${runningPodsCount} / ${totalPodsCount}`,
        inlineBadge: isClusterOnline ? t('overview.kpi.nodeBadge', { ready: readyNodesCount, total: totalNodesCount }) : t('overview.kpi.zeroNodes'),
        inlineBadgeColor: !isClusterOnline
          ? '#64748B'
          : allNodesHealthy
            ? '#0284C7'
            : '#D97706',
        inlineBadgeBg: !isClusterOnline
          ? '#F1F5F9'
          : allNodesHealthy
            ? '#E0F2FE'
            : '#FEF3C7',
        subtext: !isClusterOnline
          ? t('overview.kpi.disconnected')
          : allPodsHealthy && allNodesHealthy
            ? t('overview.kpi.allHealthy')
            : t('overview.kpi.podsNodesSub', { readyPods: runningPodsCount, totalPods: totalPodsCount, readyNodes: readyNodesCount, totalNodes: totalNodesCount }),
        tooltip:
          nodeNamesList.length > 0
            ? `Pods: ${runningPodsCount}/${totalPodsCount} Running • Nodes: ${rawNodes.map((n) => `${n.name} (${n.status || 'Unknown'})`).join(', ')}`
            : `Pods: ${runningPodsCount}/${totalPodsCount} • Nodes: ${readyNodesCount}/${totalNodesCount}`,
        subColor: !isClusterOnline
          ? '#64748B'
          : allPodsHealthy && allNodesHealthy
            ? '#059669'
            : '#D97706',
        accent: !isClusterOnline
          ? '#64748B'
          : allPodsHealthy && allNodesHealthy
            ? '#10B981'
            : '#F59E0B',
        iconBg: !isClusterOnline
          ? '#F8FAFC'
          : allPodsHealthy && allNodesHealthy
            ? '#ECFDF5'
            : '#FFFBEB',
        iconBorder: !isClusterOnline
          ? '#E2E8F0'
          : allPodsHealthy && allNodesHealthy
            ? '#A7F3D0'
            : '#FDE68A',
        Icon: Box,
        path: '/dashboard/workloads',
      },
      {
        id: 'incidents',
        label: t('overview.kpi.openIncidents'),
        value: `${openIncidentsTotal}`,
        valueColor: openIncidentsTotal > 0 ? '#D97706' : '#0F172A',
        subtext: openIncidentsTotal === 0 ? t('overview.kpi.safe') : t('overview.kpi.needsAttention'),
        subColor: openIncidentsTotal > 0 ? '#D97706' : '#059669',
        accent: openIncidentsTotal > 0 ? '#F59E0B' : '#10B981',
        iconBg: openIncidentsTotal > 0 ? '#FFFBEB' : '#ECFDF5',
        iconBorder: openIncidentsTotal > 0 ? '#FDE68A' : '#A7F3D0',
        Icon: AlertTriangle,
        path: '/dashboard/incidents',
      },
      {
        id: 'agent',
        label: t('overview.kpi.agent'),
        value: isClusterOnline ? t('overview.kpi.online') : t('overview.kpi.offline'),
        valueSize: '1.02rem',
        valueColor: isClusterOnline ? '#0F172A' : '#94A3B8',
        subtext: isClusterOnline
          ? `${agentLatencyMs}ms • ${isWsConnected ? t('overview.kpi.live') : t('overview.kpi.sync')}`
          : t('overview.kpi.connectionLost'),
        subColor: isClusterOnline ? '#059669' : '#DC2626',
        accent: isClusterOnline ? '#10B981' : '#EF4444',
        iconBg: isClusterOnline ? '#ECFDF5' : '#FEF2F2',
        iconBorder: isClusterOnline ? '#A7F3D0' : '#FECACA',
        Icon: Radio,
        pulse: isClusterOnline,
        path: '/dashboard/agents',
      },
      {
        id: 'healing',
        label: t('overview.kpi.healing24h'),
        value: `${remediationsTotal}`,
        subtext:
          remediationsTotal > 0
            ? t('overview.kpi.successRate', { rate: remediationsSuccessRate })
            : t('overview.kpi.noIncidents'),
        subColor: '#059669',
        accent: '#0EA5E9',
        iconBg: '#EFF6FF',
        iconBorder: '#BFDBFE',
        Icon: Zap,
        path: '/dashboard/self-healing/history',
      },
      {
        id: 'hitl',
        label: t('overview.kpi.hitlPending'),
        value: `${pendingHitlTotal}`,
        valueColor: pendingHitlTotal > 0 ? '#7C3AED' : '#0F172A',
        subtext: pendingHitlTotal > 0 ? t('overview.kpi.needsApproval') : t('overview.kpi.noPending'),
        subColor: pendingHitlTotal > 0 ? '#7C3AED' : '#64748B',
        accent: pendingHitlTotal > 0 ? '#8B5CF6' : '#64748B',
        iconBg: pendingHitlTotal > 0 ? '#F5F3FF' : '#F8FAFC',
        iconBorder: pendingHitlTotal > 0 ? '#DDD6FE' : '#E2E8F0',
        Icon: CheckCircle2,
        path: '/dashboard/self-healing/approvals',
      },
    ];
  }, [
    clusterInfo,
    currentEnv?.pods,
    currentEnv?.nodes,
    overviewStats,
    nodeTelemetry,
    clusterOpenIncidents,
    ctxActiveIncidentsCount,
    ctxPendingApprovalsCount,
    isClusterOnline,
    isWsConnected,
    t,
  ]);

  return (
    <div
      className="dashboard-overview-container"
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        flex: 1,
        minHeight: 0,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* 1. KHỐI TRÊN ĐẦU NỔI KÍNH MỜ: 8 THẺ KPI HẠ TẦNG + THANH ĐIỀU KHIỂN DỊCH VỤ (NỔI TRÊN CANVAS VÔ CỰC GIỐNG STITCH) */}
      <div
        className="overview-floating-header"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          padding: '2px 18px 8px 22px',
          zIndex: 25,
          display: 'flex',
          flexDirection: 'column',
          gap: isKpiCollapsed ? '4px' : '8px',
          pointerEvents: 'none',
        }}
      >
        {/* Hàng 1: 8 Thẻ KPI Hạ tầng & Tự phục hồi có thể ẩn lên trên / sổ xuống */}
        <div
          className="overview-kpi-collapsible"
          data-testid="overview-kpi-collapsible"
          aria-hidden={isKpiCollapsed}
          style={{
            maxHeight: isKpiCollapsed ? '0px' : '460px',
            opacity: isKpiCollapsed ? 0 : 1,
            transform: isKpiCollapsed ? 'translateY(-10px)' : 'translateY(0)',
            overflow: 'hidden',
            padding: isKpiCollapsed ? '0px' : '2px 2px 10px 2px',
            margin: isKpiCollapsed ? '0px' : '-2px -2px -10px -2px',
            pointerEvents: isKpiCollapsed ? 'none' : 'auto',
            transition: 'max-height 0.24s ease, opacity 0.18s ease, transform 0.24s ease',
          }}
        >
        <div
          className="dashboard-kpi-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(132px, 1fr))',
            gap: '8px',
            pointerEvents: 'none',
          }}
        >
          {clusterKpiCards.map((card) => {
            const CardIcon = card.Icon;
            return (
              <button
                key={card.id}
                type="button"
                onClick={() => onNavigate && card.path && onNavigate(card.path)}
                title={card.tooltip || t('overview.kpi.viewDetails', { label: card.label })}
                style={{
                  pointerEvents: 'auto',
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '4px',
                  padding: '8px 10px 7px',
                  borderRadius: '13px',
                  backgroundColor: 'rgba(255, 255, 255, 0.97)',
                  border: '1px solid rgba(226, 232, 240, 0.95)',
                  boxShadow: '0 4px 14px rgba(15, 23, 42, 0.045)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  overflow: 'hidden',
                  transition: 'transform 0.16s ease, box-shadow 0.16s ease, border-color 0.16s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-1.5px)';
                  e.currentTarget.style.boxShadow = '0 8px 20px rgba(15, 23, 42, 0.08)';
                  e.currentTarget.style.borderColor = card.accent;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 14px rgba(15, 23, 42, 0.045)';
                  e.currentTarget.style.borderColor = 'rgba(226, 232, 240, 0.95)';
                }}
              >
                {/* Thanh nhấn sắc mảnh ở đỉnh thẻ */}
                <span
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: '2.5px',
                    background: `linear-gradient(90deg, ${card.accent} 0%, ${card.accent}55 100%)`,
                  }}
                />

                {/* Hàng tiêu đề + Biểu tượng */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '4px',
                    width: '100%',
                  }}
                >
                  <span
                    style={{
                      fontSize: '0.67rem',
                      fontWeight: 700,
                      color: '#64748B',
                      letterSpacing: '-0.01em',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {card.label}
                  </span>
                  <span
                    style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '6px',
                      backgroundColor: card.iconBg,
                      border: `1px solid ${card.iconBorder}`,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: card.accent,
                      flexShrink: 0,
                    }}
                  >
                    <CardIcon size={11} />
                  </span>
                </div>

                {/* Giá trị chính */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    minHeight: '22px',
                  }}
                >
                  {card.pulse && (
                    <span
                      style={{
                        width: '7px',
                        height: '7px',
                        borderRadius: '50%',
                        backgroundColor: '#10B981',
                        boxShadow: '0 0 0 3px rgba(16, 185, 129, 0.2)',
                        flexShrink: 0,
                      }}
                    />
                  )}
                  <span
                    style={{
                      fontSize: card.valueSize || '1.16rem',
                      fontWeight: 800,
                      color: card.valueColor || '#0F172A',
                      letterSpacing: '-0.025em',
                      lineHeight: 1.15,
                      fontVariantNumeric: 'tabular-nums',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {card.value}
                  </span>
                  {card.inlineBadge && (
                    <span
                      style={{
                        fontSize: '0.62rem',
                        fontWeight: 700,
                        padding: '1.5px 6px',
                        borderRadius: '999px',
                        backgroundColor: card.inlineBadgeBg || '#E0F2FE',
                        color: card.inlineBadgeColor || '#0284C7',
                        fontFamily: 'var(--font-mono)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {card.inlineBadge}
                    </span>
                  )}
                </div>

                {/* Thanh tiến độ mảnh (chỉ cho CPU / RAM / Ổ đĩa) */}
                {typeof card.percent === 'number' && (
                  <div
                    style={{
                      width: '100%',
                      height: '3px',
                      borderRadius: '99px',
                      backgroundColor: '#F1F5F9',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        width: `${Math.max(card.percent, 2)}%`,
                        height: '100%',
                        borderRadius: '99px',
                        backgroundColor: card.accent,
                        transition: 'width 0.35s ease',
                      }}
                    />
                  </div>
                )}

                {/* Thông số phụ */}
                <div
                  style={{
                    fontSize: '0.65rem',
                    fontWeight: 600,
                    color: card.subColor,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    width: '100%',
                  }}
                >
                  {card.subtext}
                </div>
              </button>
            );
          })}
        </div>
        </div>

        {/* Hàng 2: Thanh thông số Pod/WebSocket, nút Ẩn/Sổ KPI & Bộ điều khiển Dịch vụ nằm gọn phía dưới 8 thẻ KPI */}
        <div
          className="overview-controls-row"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '8px',
          }}
        >
          {/* Nhóm trái: Trạng thái LIVE + Pod/Node + Nút Ẩn/Sổ dải 8 KPI ngay bên cạnh */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              flexWrap: 'wrap',
              pointerEvents: 'none',
            }}
          >
            {/* Left Floating Status Pill: Trạng thái LIVE + Pod/Node */}
            <div
              className="overview-controls-left"
              style={{
                pointerEvents: 'auto',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '4px 10px',
                borderRadius: '11px',
                backgroundColor: 'rgba(255, 255, 255, 0.97)',
                border: '1px solid rgba(226, 232, 240, 0.95)',
                boxShadow: '0 3px 12px rgba(15, 23, 42, 0.045)',
              }}
            >
            <span
              style={{
                fontSize: '0.73rem',
                color: 'var(--dash-text-secondary)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              {currentServiceMetadata.pods > 0 ? (
                <>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '2px 7px',
                      borderRadius: '999px',
                      fontSize: '0.65rem',
                      fontWeight: 800,
                      backgroundColor: isClusterOnline ? '#ECFDF5' : '#FEF2F2',
                      color: isClusterOnline ? '#059669' : '#DC2626',
                      border: isClusterOnline ? '1px solid #A7F3D0' : '1px solid #FECACA',
                      letterSpacing: '0.04em',
                    }}
                  >
                    <span
                      style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        backgroundColor: isClusterOnline ? '#10B981' : '#EF4444',
                        boxShadow: isClusterOnline ? '0 0 0 2px rgba(16, 185, 129, 0.25)' : 'none',
                        display: 'inline-block',
                      }}
                    />
                    {isClusterOnline ? t('overview.controls.live') : t('overview.controls.offline')}
                  </span>
                  <strong style={{ fontFamily: 'var(--font-mono)', color: '#15803D' }}>
                    {t('overview.controls.podCount', { count: currentServiceMetadata.pods })}
                  </strong>
                  <span style={{ color: '#94A3B8' }}>•</span>
                  <strong
                    style={{ fontFamily: 'var(--font-mono)', color: '#475569' }}
                    title={t('overview.controls.nodesUsageTooltip', { nodes: currentServiceMetadata.nodes, total: currentServiceMetadata.totalClusterNodes })}
                  >
                    {currentServiceMetadata.nodes} / {currentServiceMetadata.totalClusterNodes} Node
                  </strong>
                </>
              ) : (
                <>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '2px 7px',
                      borderRadius: '999px',
                      fontSize: '0.65rem',
                      fontWeight: 700,
                      backgroundColor: '#F1F5F9',
                      color: '#64748B',
                      border: '1px solid #CBD5E1',
                      letterSpacing: '0.04em',
                    }}
                  >
                    <span
                      style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        backgroundColor: '#94A3B8',
                        display: 'inline-block',
                      }}
                    />
                    {t('overview.controls.stopped')}
                  </span>
                  <strong style={{ fontFamily: 'var(--font-mono)', color: '#64748B' }}>
                    {t('overview.controls.zeroPods')}
                  </strong>
                  <span style={{ color: '#94A3B8' }}>•</span>
                  <strong
                    style={{ fontFamily: 'var(--font-mono)', color: '#94A3B8' }}
                  >
                    0 / {currentServiceMetadata.totalClusterNodes} Node
                  </strong>
                </>
              )}
              {currentServiceMetadata.nodeNames?.length > 0 && (
                <span
                  style={{
                    fontSize: '0.67rem',
                    color: '#475569',
                    backgroundColor: '#F1F5F9',
                    padding: '1px 6px',
                    borderRadius: '4px',
                    border: '1px solid #E2E8F0',
                    fontFamily: 'var(--font-mono)',
                  }}
                  title={t('overview.controls.nodeNamesTooltip', { nodes: currentServiceMetadata.nodeNames.join(', ') })}
                >
                  {currentServiceMetadata.nodeNames.join(', ')}
                </span>
              )}
            </span>
          </div>

            {/* Nút Ẩn lên trên / Sổ xuống cho dải 8 thẻ KPI đặt ngay bên cạnh cụm Live/Pod */}
            <button
              type="button"
              data-testid="overview-kpi-toggle-btn"
              onClick={handleToggleKpiBar}
              aria-expanded={!isKpiCollapsed}
              aria-label={isKpiCollapsed ? t('overview.kpi.expandTopBar') : t('overview.kpi.collapseTopBar')}
              title={isKpiCollapsed ? t('overview.kpi.expandTopBar') : t('overview.kpi.collapseTopBar')}
              style={{
                pointerEvents: 'auto',
                height: '28px',
                minWidth: isKpiCollapsed ? 'auto' : '28px',
                padding: isKpiCollapsed ? '0 11px' : '0',
                borderRadius: '999px',
                backgroundColor: '#059669',
                color: '#FFFFFF',
                border: '2px solid #FFFFFF',
                boxShadow: '0 2px 8px rgba(5, 150, 105, 0.28)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
                fontSize: '0.68rem',
                fontWeight: 700,
                cursor: 'pointer',
                flexShrink: 0,
                transition: 'transform 0.15s ease, background-color 0.15s ease, box-shadow 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.06)';
                e.currentTarget.style.backgroundColor = '#047857';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(5, 150, 105, 0.38)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.backgroundColor = '#059669';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(5, 150, 105, 0.28)';
              }}
            >
              {isKpiCollapsed ? (
                <>
                  <ChevronDown size={14} strokeWidth={2.8} />
                  <span>{t('overview.kpi.expandTopBarShort')}</span>
                </>
              ) : (
                <ChevronUp size={15} strokeWidth={2.8} />
              )}
            </button>
          </div>

          {/* Right Floating Controls Pill: Dịch vụ Dropdown + Thang đo + Làm mới */}
          <div
            className="overview-controls-right"
            style={{
              pointerEvents: 'auto',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '7px',
              flexWrap: 'wrap',
              padding: '5px 9px',
              borderRadius: '11px',
              backgroundColor: 'rgba(255, 255, 255, 0.97)',
              border: '1px solid rgba(226, 232, 240, 0.95)',
              boxShadow: '0 3px 12px rgba(15, 23, 42, 0.045)',
            }}
          >
            {/* Workload Select Dropdown */}
            <div className="overview-service-picker" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span
                style={{
                  fontSize: '0.73rem',
                  fontWeight: 700,
                  color: '#475569',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <Server size={12} color={isClusterOnline ? '#2563EB' : '#94A3B8'} />
                {t('overview.controls.serviceLabel')}
                <strong
                  style={{
                    fontFamily: 'var(--font-mono)',
                    color: isClusterOnline ? '#1D4ED8' : '#64748B',
                    fontWeight: 800,
                  }}
                  title={t('overview.controls.totalServicesTooltip', { count: availableWorkloads.length })}
                >
                  ({availableWorkloads.length})
                </strong>:
              </span>

              <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
                <select
                  id="overview-workload-select"
                  value={currentServiceTarget}
                  disabled={!isClusterOnline || availableWorkloads.length === 0}
                  onChange={(e) => handleSelectWorkload(e.target.value)}
                  style={{
                    padding: '3px 22px 3px 9px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    color: isClusterOnline ? '#1D4ED8' : '#94A3B8',
                    backgroundColor: isClusterOnline ? '#EFF6FF' : '#F8FAFC',
                    border: `1px solid ${isClusterOnline ? '#3B82F6' : '#CBD5E1'}`,
                    borderRadius: '7px',
                    outline: 'none',
                    cursor: isClusterOnline ? 'pointer' : 'not-allowed',
                    appearance: 'none',
                    WebkitAppearance: 'none',
                    MozAppearance: 'none',
                  }}
                >
                  {availableWorkloads.length === 0 ? (
                    <option value="">{isClusterOnline ? t('overview.controls.loading') : t('overview.controls.agentNotConnected')}</option>
                  ) : (
                    availableWorkloads.map((wl) => (
                      <option key={wl} value={wl}>
                        {wl}
                      </option>
                    ))
                  )}
                </select>
                <ChevronDown
                  size={12}
                  color={isClusterOnline ? '#2563EB' : '#94A3B8'}
                  style={{
                    position: 'absolute',
                    right: '6px',
                    pointerEvents: 'none',
                  }}
                />
              </div>
            </div>

            {/* Nút Thang đo Auto / Standard */}
            <button
              type="button"
              className="overview-action-btn"
              onClick={() => setScaleMode((m) => (m === 'auto' ? 'standard' : 'auto'))}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '3px 9px',
                fontSize: '0.72rem',
                fontWeight: 600,
                backgroundColor: '#F8FAFC',
                border: '1px solid #CBD5E1',
                borderRadius: '7px',
                cursor: 'pointer',
                color: '#475569',
              }}
            >
              <Sliders size={11} />
              <span>{t('overview.controls.scalePrefix', { mode: scaleMode === 'auto' ? t('overview.controls.scaleAuto') : t('overview.controls.scaleStandard') })}</span>
            </button>

            {/* Nút Làm mới */}
            <button
              type="button"
              className="overview-action-btn"
              onClick={() => {
                triggerRefresh();
                fetchData();
              }}
              disabled={isLoading || isRefreshing}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '3px 10px',
                backgroundColor: '#FFFFFF',
                border: '1px solid #CBD5E1',
                borderRadius: '7px',
                color: 'var(--dash-text-primary)',
                fontSize: '0.72rem',
                fontWeight: 600,
                cursor: isLoading || isRefreshing ? 'wait' : 'pointer',
              }}
            >
              <RefreshCw size={11} className={isLoading || isRefreshing ? 'animate-spin' : ''} />
              <span>{t('overview.controls.refresh')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. KHUNG CHÍNH: SƠ ĐỒ LUỒNG AI + NỀN LƯỚI CHẤM ĐỒNG BỘ PHÓNG TO/THU NHỎ TOÀN KHUNG (CHUẨN STITCH) */}
      <div
        className="overview-canvas-wrapper"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          overflow: 'hidden',
          display: 'flex',
        }}
      >
        <AIPipelineFlowCanvas
          selectedService={isClusterOnline ? (currentServiceTarget || t('overview.controls.loading')) : t('overview.controls.disconnected')}
          seriesSummaries={isClusterOnline ? seriesSummaries : EMPTY_ARRAY}
          prediction={isClusterOnline ? displaySelectedPrediction : null}
          currentActiveStep={isClusterOnline ? currentActiveStep : 0}
          totalSteps={isClusterOnline ? (timesteps.length || 12) : 12}
          isAgentConnected={isClusterOnline}
          timesteps={isClusterOnline ? timesteps : EMPTY_ARRAY}
          scaleMode={scaleMode}
          isFullScreen={true}
          showExtendedPipeline={true}
          defaultViewMode="gru"
          topSafePadding={isKpiCollapsed ? 48 : 126}
          pipelineContext={isClusterOnline ? pipelineContext : null}
          podCount={isClusterOnline ? currentServiceMetadata.pods : 0}
          onNavigate={onNavigate}
        />
      </div>
    </div>
  );
};

export default OverviewPage;
