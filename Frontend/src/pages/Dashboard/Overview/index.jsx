import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useDashboard } from '../context/DashboardContext';
import { telemetryService } from '../../../services/telemetryService';
import { clusterService } from '../../../services/clusterService';
import { dashboardStatisticsService } from '../../../services/dashboardStatisticsService';
import {
  Cpu,
  Database,
  HardDrive,
  Box,
  AlertTriangle,
  AlertCircle,
  Layers,
  Activity,
  ExternalLink,
  Radio,
  Zap,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
  Sparkles,
  RefreshCw,
  Terminal,
  HelpCircle,
  Server,
  ArrowRight,
} from 'lucide-react';
import InteractiveResourceChart from '../../../components/dashboard/InteractiveResourceChart';

export const OverviewPage = () => {
  const {
    currentOrg,
    currentEnv,
    setCurrentEnv,
    envList,
    isAgentConnected,
    isAutoRefresh,
    lastUpdated,
    isRefreshing,
    triggerRefresh,
    pendingApprovalsCount,
    refreshPendingApprovals,
    onNavigate,
  } = useDashboard();

  const activeClusterId = currentEnv?.clusterId || currentEnv?.id;
  const [chartTimeRange, setChartTimeRange] = useState('15m');
  const chartTimeRangeRef = useRef(chartTimeRange);
  useEffect(() => {
    chartTimeRangeRef.current = chartTimeRange;
  }, [chartTimeRange]);

  // Overview Statistics Cluster API State [S5][PBI19]
  const [overviewStats, setOverviewStats] = useState(null);
  const overviewStatsRef = useRef(null);
  useEffect(() => {
    overviewStatsRef.current = overviewStats;
  }, [overviewStats]);

  const [isStatsLoading, setIsStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState(null);

  const fetchOverviewStats = useCallback(async (isSilent = false) => {
    if (!isSilent && !overviewStatsRef.current) {
      setIsStatsLoading(true);
    }
    setStatsError(null);
    try {
      const orgId = currentOrg?.id;
      const clusterId = activeClusterId && !activeClusterId.startsWith('org-') ? activeClusterId : undefined;
      const tr = chartTimeRange === '15m' ? '1h' : chartTimeRange;
      const data = await dashboardStatisticsService.getOverviewStats({
        organization_id: orgId,
        cluster_id: clusterId,
        time_range: tr,
      });
      setOverviewStats(data);
    } catch (err) {
      console.warn('[OverviewPage] Không thể tải dữ liệu thống kê tổng hợp:', err);
      setStatsError(err.message || 'Không thể tải thống kê tổng quan.');
    } finally {
      setIsStatsLoading(false);
    }
  }, [currentOrg?.id, activeClusterId, chartTimeRange]);

  useEffect(() => {
    fetchOverviewStats();
  }, [fetchOverviewStats]);

  // Realtime Telemetry & Live Cluster State
  const [telemetry, setTelemetry] = useState(null);
  const [telemetrySequence, setTelemetrySequence] = useState([]);
  const telemetrySequenceRef = useRef([]);
  useEffect(() => {
    telemetrySequenceRef.current = telemetrySequence;
  }, [telemetrySequence]);
  const [clusterInfo, setClusterInfo] = useState(null);
  const [isWsLive, setIsWsLive] = useState(false);
  const [activeIncidents, setActiveIncidents] = useState([]);
  const [aiRecommendations, setAiRecommendations] = useState([]);
  const [lastDataTimestamp, setLastDataTimestamp] = useState(null);
  const [prevCpu, setPrevCpu] = useState(null);
  const [prevRam, setPrevRam] = useState(null);
  const [isChartLoading, setIsChartLoading] = useState(false);
  const [chartError, setChartError] = useState(null);
  const [isDataStale, setIsDataStale] = useState(false);
  const activeChartRequestRef = useRef(0);

  // Kiểm tra trạng thái Agent của Cụm Kubernetes đang chọn
  const isClusterOnline = useMemo(() => Boolean(
    currentEnv?.agentStatus === 'ONLINE' ||
    clusterInfo?.status === 'ACTIVE' ||
    clusterInfo?.status === 'HEALTHY' ||
    (Array.isArray(clusterInfo?.nodes) && clusterInfo.nodes.length > 0)
  ), [currentEnv?.agentStatus, clusterInfo?.status, clusterInfo?.nodes]);

  // 1b. Tải chuỗi viễn trắc theo khoảng thời gian được chọn với race-condition guard
  const loadClusterTrend = useCallback(async (range, isSilent = false) => {
    const reqId = ++activeChartRequestRef.current;
    setChartTimeRange(range);
    setChartError(null);

    if (!isClusterOnline || !activeClusterId) {
      setTelemetrySequence([]);
      setIsChartLoading(false);
      return;
    }

    // Chỉ bật loading toàn màn hình nếu chưa có dữ liệu trong biểu đồ
    if (!isSilent && telemetrySequenceRef.current.length === 0) {
      setIsChartLoading(true);
    }
    const controller = new AbortController();

    try {
      const res = await telemetryService.getClusterResourceTrend(
        {
          orgId: currentOrg?.id,
          clusterId: activeClusterId,
          range,
        },
        { signal: controller.signal }
      );

      // Bỏ qua response cũ nếu người dùng đã chuyển range hoặc cụm khác trong khi request đang bay
      if (activeChartRequestRef.current !== reqId) return;

      if (Array.isArray(res?.sequence) && res.sequence.length > 0) {
        setTelemetrySequence(res.sequence);
        setIsDataStale(Boolean(res.isStale));
        if (res.latestPoint) {
          setTelemetry((prev) => ({
            ...prev,
            ...res.latestPoint,
          }));
          setLastDataTimestamp(new Date().toLocaleTimeString('vi-VN'));
        }
      } else {
        setTelemetrySequence([]);
        setIsDataStale(false);
      }
    } catch (err) {
      if (err?.name === 'AbortError') return;
      if (activeChartRequestRef.current === reqId) {
        console.warn('[OverviewPage] Không thể tải dữ liệu chuỗi thời gian:', err.message);
        setChartError(err.message || 'Không thể tải chuỗi viễn trắc từ cụm.');
        setTelemetrySequence([]);
      }
    } finally {
      if (activeChartRequestRef.current === reqId) {
        setIsChartLoading(false);
      }
    }
  }, [activeClusterId, currentOrg?.id, isClusterOnline]);

  const handleChartRangeChange = useCallback((newRange) => {
    loadClusterTrend(newRange);
  }, [loadClusterTrend]);

  useEffect(() => {
    loadClusterTrend(chartTimeRange);
  }, [loadClusterTrend, chartTimeRange]);

  // 1. Tải chi tiết cụm Kubernetes THẬT (Nodes, Pods, dung lượng phần cứng)
  const fetchClusterInfo = useCallback(async () => {
    try {
      const clusterId = currentEnv?.clusterId || currentEnv?.id;
      const orgId = currentOrg?.id;
      if (clusterId && !clusterId.startsWith('org-')) {
        const detail = await clusterService.getClusterDetail(clusterId, orgId);
        if (detail) {
          setClusterInfo(detail);
        }
      }
    } catch (err) {
      console.warn('[OverviewPage] Không thể tải chi tiết cụm:', err);
    }
  }, [currentEnv?.clusterId, currentEnv?.id, currentOrg?.id]);

  useEffect(() => {
    fetchClusterInfo();
  }, [fetchClusterInfo]);

  // Auto-Refresh background interval (30s)
  const autoRefreshInterval = 60;
  const isAutoRefreshActive = true;
  const isPollingBusyRef = useRef(false);

  // Manual & automated refresh function
  const refreshAllData = useCallback(async () => {
    if (isPollingBusyRef.current) return;
    isPollingBusyRef.current = true;
    try {
      await Promise.allSettled([
        fetchOverviewStats(true),
        fetchClusterInfo(),
        loadClusterTrend(chartTimeRange, true),
        refreshPendingApprovals ? refreshPendingApprovals() : Promise.resolve(),
      ]);
      const now = new Date();
      setLastDataTimestamp(
        `${now.toLocaleTimeString('vi-VN')} ${now.toLocaleDateString('vi-VN')}`
      );
    } finally {
      isPollingBusyRef.current = false;
    }
  }, [fetchOverviewStats, fetchClusterInfo, loadClusterTrend, chartTimeRange]);

  // Unified Auto-Refresh Timer with Tab Visibility Pause & Concurrency Guard
  useEffect(() => {
    if (!isAutoRefreshActive || !isClusterOnline) return;

    let isTabVisible = !document.hidden;
    const handleVisibilityChange = () => {
      isTabVisible = !document.hidden;
      if (isTabVisible) {
        refreshAllData();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    const timer = setInterval(() => {
      if (isTabVisible && !isPollingBusyRef.current) {
        refreshAllData();
      }
    }, autoRefreshInterval * 1000);

    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isAutoRefreshActive, autoRefreshInterval, isClusterOnline, refreshAllData]);


  // 2. Kết nối WebSocket đẩy viễn trắc Realtime 100% từ Main Backend (CHỈ KHI CỤM ĐANG ONLINE)
  useEffect(() => {
    let isMounted = true;

    // Nếu cụm đang chọn là Offline hoặc chưa có Agent kết nối, dọn sạch số liệu cũ và ngắt WS
    if (!isClusterOnline) {
      setTelemetry(null);
      setTelemetrySequence([]);
      setActiveIncidents([]);
      setAiRecommendations([]);
      setIsWsLive(false);
      return;
    }

    // Dynamic service ID based on real pods in the cluster, fallback to first pod or sme-order-service
    const targetServiceId = (rawPods && rawPods.length > 0)
      ? (rawPods.find((p) => p.workload_name || p.name)?.workload_name || rawPods[0]?.name || 'sme-order-service')
      : 'sme-order-service';

    // Tải snapshot REST ban đầu cho cụm Online
    telemetryService.getLiveSummary(targetServiceId).then((data) => {
      if (isMounted && data) {
        setTelemetry((prev) => {
          const next = { ...prev, ...(data.latest_point || {}) };
          if (data.latest_node_metric) {
            next.node_cpu_percent = Number(data.latest_node_metric.cpu_usage_percent);
            next.node_ram_percent = Number(data.latest_node_metric.ram_usage_percent);
            next.node_cpu_cores = Number(data.latest_node_metric.cpu_cores);
            if (data.latest_node_metric.ram_used_bytes) {
              next.node_ram_gb = (Number(data.latest_node_metric.ram_used_bytes) / (1024 * 1024 * 1024)).toFixed(2);
            }
            if (data.latest_node_metric.disk_usage_percent !== undefined) {
              next.disk = Number(data.latest_node_metric.disk_usage_percent);
            }
          }
          return next;
        });
        if (Array.isArray(data.sequence) && data.sequence.length > 0) setTelemetrySequence(data.sequence);
        if (Array.isArray(data.incidents)) setActiveIncidents(data.incidents);
        if (Array.isArray(data.recommendations)) setAiRecommendations(data.recommendations);
        if (data.timestamp) setLastDataTimestamp(new Date(data.timestamp).toLocaleTimeString());
      }
    });

    // Lắng nghe luồng WebSocket trực tiếp
    const unsubscribe = telemetryService.subscribeWebSocket(
      targetServiceId,
      (payload) => {
        if (!isMounted || !payload) return;

        if (payload.type === 'initial_state' || payload.type === 'live_summary' || payload.type === 'live_pulse') {
          const data = payload.data;
          if (data) {
            setIsDataStale(false);
            if (data.latest_point || data.latest_node_metric) {
              setTelemetry((prev) => {
                if (prev?.cpu !== undefined) setPrevCpu(Number(prev.cpu));
                if (prev?.ram !== undefined) setPrevRam(Number(prev.ram));
                const merged = { ...prev };
                if (data.latest_point) {
                  merged.cpu = Number(data.latest_point.cpu ?? merged.cpu ?? 0);
                  merged.ram = Number(data.latest_point.ram ?? merged.ram ?? 0);
                  if (data.latest_point.disk !== undefined) merged.disk = Number(data.latest_point.disk);
                  if (data.latest_point.latency !== undefined) merged.latency = Number(data.latest_point.latency);
                }
                if (data.latest_node_metric) {
                  merged.node_cpu_percent = Number(data.latest_node_metric.cpu_usage_percent);
                  merged.node_ram_percent = Number(data.latest_node_metric.ram_usage_percent);
                  merged.node_cpu_cores = Number(data.latest_node_metric.cpu_cores);
                  if (data.latest_node_metric.ram_used_bytes) {
                    merged.node_ram_gb = (Number(data.latest_node_metric.ram_used_bytes) / (1024 * 1024 * 1024)).toFixed(2);
                  }
                  if (data.latest_node_metric.disk_usage_percent !== undefined) {
                    merged.disk = Number(data.latest_node_metric.disk_usage_percent);
                  }
                }
                return merged;
              });
            }
            // Cập nhật real-time sequence cho biểu đồ khi có live pulse hoặc initial state
            if (chartTimeRangeRef.current === '15m' && data.latest_node_metric) {
              const nodeMetric = data.latest_node_metric;
              const nodeCpu = nodeMetric.cpu_usage_percent !== undefined ? Number(nodeMetric.cpu_usage_percent) : undefined;
              const nodeRam = nodeMetric.ram_usage_percent !== undefined ? Number(nodeMetric.ram_usage_percent) : undefined;
              setTelemetrySequence((prevSeq) => {
                const now = new Date();
                const nowMs = now.getTime();
                const newPoint = {
                  time_bucket: now.toISOString(),
                  timestamp: nowMs,
                  time: now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                  fullTime: `${now.toLocaleTimeString('vi-VN')} (${now.toLocaleDateString('vi-VN')})`,
                  cpu: nodeCpu !== undefined ? nodeCpu : 0,
                  ram: nodeRam !== undefined ? nodeRam : 0,
                  node_cpu_percent: nodeCpu !== undefined ? nodeCpu : 0,
                  node_ram_percent: nodeRam !== undefined ? nodeRam : 0,
                  rawRamMb: nodeMetric.ram_used_bytes !== undefined ? Number(nodeMetric.ram_used_bytes) / (1024 * 1024) : 0,
                  disk: Number(nodeMetric.disk_usage_percent !== undefined ? nodeMetric.disk_usage_percent : 0),
                  latency: 0,
                };
                if (!prevSeq || prevSeq.length === 0) {
                  return Array.isArray(data.sequence) && data.sequence.length > 0 ? data.sequence : [newPoint];
                }
                const lastPt = prevSeq[prevSeq.length - 1];
                const lastPtMs = lastPt.time_bucket ? new Date(lastPt.time_bucket).getTime() : (lastPt.timestamp || 0);
                if (nowMs - lastPtMs < 2500) {
                  const updated = [...prevSeq];
                  updated[updated.length - 1] = {
                    ...lastPt,
                    cpu: nodeCpu !== undefined ? nodeCpu : lastPt.cpu,
                    ram: nodeRam !== undefined ? nodeRam : lastPt.ram,
                    node_cpu_percent: nodeCpu !== undefined ? nodeCpu : lastPt.node_cpu_percent,
                    node_ram_percent: nodeRam !== undefined ? nodeRam : lastPt.node_ram_percent,
                  };
                  return updated;
                }
                if (prevSeq.length >= 60) {
                  return [...prevSeq.slice(1), newPoint];
                }
                return [...prevSeq, newPoint];
              });
            } else if (chartTimeRangeRef.current === '15m' && Array.isArray(data.sequence) && data.sequence.length > 0) {
              setTelemetrySequence((prev) => (prev.length === 0 ? data.sequence : prev));
            }
            if (Array.isArray(data.incidents)) setActiveIncidents(data.incidents);
            if (Array.isArray(data.recommendations)) setAiRecommendations(data.recommendations);
            setLastDataTimestamp(new Date(payload.timestamp || Date.now()).toLocaleTimeString());
          }
        } else if (payload.type === 'node_metrics' && payload.data) {
          // THÔNG SỐ TOÀN CỤM MÁY CHỦ (Từ eBPF / NodeResourceCollector của Agent)
          const raw = payload.data;
          setIsDataStale(false);
          const nodeCpu = raw.cpu_usage_percent !== undefined ? Number(raw.cpu_usage_percent) : undefined;
          const nodeRam = raw.ram_usage_percent !== undefined ? Number(raw.ram_usage_percent) : undefined;

          setTelemetry((prev) => ({
            ...prev,
            node_cpu_percent: nodeCpu !== undefined ? nodeCpu : prev?.node_cpu_percent,
            node_ram_percent: nodeRam !== undefined ? nodeRam : prev?.node_ram_percent,
            node_cpu_cores: raw.cpu_cores !== undefined ? Number(raw.cpu_cores) : prev?.node_cpu_cores,
            node_ram_gb: raw.ram_used_bytes !== undefined ? (Number(raw.ram_used_bytes) / (1024 * 1024 * 1024)).toFixed(2) : prev?.node_ram_gb,
            disk: raw.disk_usage_percent !== undefined ? Number(raw.disk_usage_percent) : prev?.disk,
          }));

          // Đồng thời cập nhật Biểu đồ Tài nguyên Cụm máy chủ (CPU & RAM)
          if (chartTimeRangeRef.current === '15m') {
            setTelemetrySequence((prevSeq) => {
              const now = new Date();
              const nowMs = now.getTime();
              const lastPt = prevSeq && prevSeq.length > 0 ? prevSeq[prevSeq.length - 1] : null;

              const newPoint = {
                time_bucket: now.toISOString(),
                timestamp: nowMs,
                time: now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                fullTime: `${now.toLocaleTimeString('vi-VN')} (${now.toLocaleDateString('vi-VN')})`,
                cpu: nodeCpu !== undefined ? nodeCpu : (lastPt?.cpu || 0),
                ram: nodeRam !== undefined ? nodeRam : (lastPt?.ram || 0),
                node_cpu_percent: nodeCpu !== undefined ? nodeCpu : (lastPt?.node_cpu_percent || 0),
                node_ram_percent: nodeRam !== undefined ? nodeRam : (lastPt?.node_ram_percent || 0),
                rawRamMb: raw.ram_used_bytes !== undefined ? Number(raw.ram_used_bytes) / (1024 * 1024) : Number(lastPt?.rawRamMb || 0),
                disk: Number(raw.disk_usage_percent !== undefined ? raw.disk_usage_percent : (lastPt?.disk || 0)),
                latency: Number(lastPt?.latency || 0),
              };

              if (!prevSeq || prevSeq.length === 0) return [newPoint];

              const lastPtMs = lastPt.time_bucket ? new Date(lastPt.time_bucket).getTime() : (lastPt.timestamp || 0);
              if (nowMs - lastPtMs < 2500) {
                const updated = [...prevSeq];
                updated[updated.length - 1] = {
                  ...lastPt,
                  time_bucket: now.toISOString(),
                  timestamp: nowMs,
                  cpu: nodeCpu !== undefined ? nodeCpu : lastPt.cpu,
                  ram: nodeRam !== undefined ? nodeRam : lastPt.ram,
                  node_cpu_percent: nodeCpu !== undefined ? nodeCpu : lastPt.node_cpu_percent,
                  node_ram_percent: nodeRam !== undefined ? nodeRam : lastPt.node_ram_percent,
                  rawRamMb: raw.ram_used_bytes !== undefined ? Number(raw.ram_used_bytes) / (1024 * 1024) : lastPt.rawRamMb,
                };
                return updated;
              }

              if (prevSeq.length >= 60) {
                return [...prevSeq.slice(1), newPoint];
              }
              return [...prevSeq, newPoint];
            });
          }
          setLastDataTimestamp(new Date().toLocaleTimeString());
        } else if ((payload.type === 'raw_metric' || payload.type === 'metrics') && payload.data) {
          // THÔNG SỐ POD NGHIỆP VỤ (APM microservice con)
          const raw = payload.data;
          setIsDataStale(false);
          const podCpu = raw.cpu !== undefined ? Number(raw.cpu) : undefined;
          const podRam = raw.ram !== undefined ? Number(raw.ram) : undefined;

          setTelemetry((prev) => {
            if (prev?.cpu !== undefined) setPrevCpu(Number(prev.cpu));
            if (prev?.ram !== undefined) setPrevRam(Number(prev.ram));
            return {
              ...prev,
              cpu: podCpu !== undefined ? podCpu : prev?.cpu,
              ram: podRam !== undefined ? podRam : prev?.ram,
              latency: raw.latency !== undefined ? Number(raw.latency) : prev?.latency,
              request_rate: raw.request_rate !== undefined ? Number(raw.request_rate) : prev?.request_rate,
              http_5xx_rate: raw.http_5xx_rate !== undefined ? Number(raw.http_5xx_rate) : prev?.http_5xx_rate,
            };
          });
          setLastDataTimestamp(new Date().toLocaleTimeString());
        } else if (payload.type === 'incident' && payload.data) {
          setActiveIncidents((prev) => [payload.data, ...prev.slice(0, 9)]);
        } else if (payload.type === 'ai_recommendation' && payload.data) {
          setAiRecommendations((prev) => [payload.data, ...prev.slice(0, 9)]);
        } else if (
          payload.type === 'approval_created' ||
          payload.type === 'approval_status_changed' ||
          payload.type === 'healing_action_triggered'
        ) {
          if (refreshPendingApprovals) {
            refreshPendingApprovals();
          }
        }
      },
      (connected) => {
        if (isMounted) setIsWsLive(connected);
      },
      activeClusterId
    );

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [isClusterOnline, currentEnv?.id]);

  // Tính toán số liệu phần cứng và K8s Inventory THẬT
  const nodeCount = clusterInfo?.nodes?.length || currentEnv?.nodes || 1;
  const rawPods = useMemo(() => clusterInfo?.pods || [], [clusterInfo?.pods]);
  const podCount = rawPods.length || currentEnv?.pods || 0;
  const runningPodsCount = rawPods.length > 0
    ? rawPods.filter((p) => p.status === 'Running' || p.phase === 'Running').length
    : podCount;

  const namespacesList = useMemo(() => {
    if (rawPods.length > 0) {
      const set = new Set(rawPods.map((p) => p.namespace).filter(Boolean));
      return Array.from(set);
    }
    return [];
  }, [rawPods]);

  const namespacesCount = namespacesList.length;

  // Node hardware capacity - Tổng hợp dung lượng thực tế từ toàn bộ nodes của cụm
  const { totalCpuCores, totalRamGb, totalDiskTb } = useMemo(() => {
    if (clusterInfo?.nodes && clusterInfo.nodes.length > 0) {
      const totalCores = clusterInfo.nodes.reduce((acc, n) => {
        const mCores = parseInt(n.cpu_capacity_millicores, 10);
        return acc + (Number.isFinite(mCores) ? mCores / 1000 : 0);
      }, 0);
      const totalRam = clusterInfo.nodes.reduce((acc, n) => {
        const bytes = parseInt(n.memory_capacity_bytes, 10);
        return acc + (Number.isFinite(bytes) ? bytes : 0);
      }, 0);
      const totalDisk = clusterInfo.nodes.reduce((acc, n) => {
        const bytes = parseInt(n.disk_capacity_bytes, 10);
        return acc + (Number.isFinite(bytes) ? bytes : 0);
      }, 0);

      return {
        totalCpuCores: totalCores > 0 ? Math.round(totalCores) : 0,
        totalRamGb: totalRam > 0 ? (totalRam / (1024 * 1024 * 1024)).toFixed(1) : '0.0',
        totalDiskTb: totalDisk > 0 ? (totalDisk / (1024 * 1024 * 1024 * 1024)).toFixed(1) : '0.0',
      };
    }
    return {
      totalCpuCores: 0,
      totalRamGb: '0.0',
      totalDiskTb: '0.0',
    };
  }, [clusterInfo?.nodes]);

  // Metrics telemetry values
  const cpuVal = telemetry?.cpu !== undefined ? Number(telemetry.cpu) : 0;
  const allocatedCpu = ((cpuVal / 100) * totalCpuCores).toFixed(2);
  const cpuDiff = prevCpu !== null ? (cpuVal - prevCpu).toFixed(1) : '0.0';

  const ramVal = telemetry?.ram !== undefined ? Number(telemetry.ram) : 0; // MB RSS
  const ramUsagePercent = Math.max(
    1,
    Math.min(100, Math.round(((ramVal / (parseFloat(totalRamGb) * 1024)) * 100) * 10) / 10)
  );
  const ramDiff = prevRam !== null ? (ramVal - prevRam).toFixed(1) : '0.0';

  // Mức trung bình 1 giờ (Historical 1h average from API)
  const avgCpu1h = overviewStats?.resource_usage?.avg_cpu_percent !== undefined
    ? Number(overviewStats.resource_usage.avg_cpu_percent).toFixed(1)
    : null;
  const avgRam1h = overviewStats?.resource_usage?.avg_ram_percent !== undefined
    ? Number(overviewStats.resource_usage.avg_ram_percent).toFixed(1)
    : null;

  // Mức Tức thời thời gian thực (Real-time Live from eBPF WebSocket stream)
  const liveCpuPoint = telemetry?.node_cpu_percent !== undefined && telemetry.node_cpu_percent !== null && Number(telemetry.node_cpu_percent) > 0
    ? Number(telemetry.node_cpu_percent)
    : (telemetrySequence?.length > 0 ? Number(telemetrySequence[telemetrySequence.length - 1].cpu) : null);

  const liveRamPoint = telemetry?.node_ram_percent !== undefined && telemetry.node_ram_percent !== null && Number(telemetry.node_ram_percent) > 0
    ? Number(telemetry.node_ram_percent)
    : (telemetrySequence?.length > 0 ? Number(telemetrySequence[telemetrySequence.length - 1].ram) : null);

  // Ưu tiên hiển thị số TỨC THỜI thời gian thực để đồng bộ 100% với biểu đồ viễn trắc
  const nodeCpuPercent = liveCpuPoint !== null
    ? liveCpuPoint.toFixed(1)
    : (avgCpu1h || '0.0');

  const nodeRamPercent = liveRamPoint !== null
    ? liveRamPoint.toFixed(1)
    : (avgRam1h || '0.0');

  // Cores used = (nodeCpuPercent / 100) * totalCpuCores
  const nodeUsedCpuCores = totalCpuCores > 0
    ? ((Number(nodeCpuPercent) / 100) * totalCpuCores).toFixed(2)
    : '0.00';
  const nodeCpuCores = nodeUsedCpuCores;

  const nodeRamGb = telemetry?.node_ram_gb !== undefined && telemetry.node_ram_gb !== null && Number(telemetry.node_ram_gb) > 0
    ? Number(telemetry.node_ram_gb).toFixed(2)
    : ((Number(nodeRamPercent) / 100) * parseFloat(totalRamGb)).toFixed(2);

  const diskVal = overviewStats?.resource_usage?.avg_disk_percent !== undefined
    ? Math.round(Number(overviewStats.resource_usage.avg_disk_percent))
    : (telemetry?.disk !== undefined ? Math.round(Number(telemetry.disk)) : 0);
  const diskStatusText = diskVal > 85 ? 'Cảnh báo đầy' : diskVal > 70 ? 'Cần theo dõi' : 'Bình thường';
  const diskUsedGb = Math.round((diskVal / 100) * parseFloat(totalDiskTb) * 1024);

  // Lọc sự cố đang diễn ra thực tế (chỉ OPEN hoặc INVESTIGATING) - Loại bỏ tuyệt đối các sự cố đã RESOLVED
  const activeIncidentsList = useMemo(() => {
    return activeIncidents.filter(
      (i) => i.status === 'OPEN' || i.status === 'INVESTIGATING'
    );
  }, [activeIncidents]);

  const activeIncidentsCount = activeIncidentsList.length;

  // Lọc khuyến nghị AI: Chỉ hiển thị các dự báo/khuyến nghị chưa phê duyệt (PROPOSED/PENDING)
  const pendingRecommendations = useMemo(() => {
    return aiRecommendations.filter(
      (rec) => rec.status === 'PROPOSED' || rec.status === 'PENDING'
    );
  }, [aiRecommendations]);

  // Biến đổi sequence cho biểu đồ với cả giá trị % và đơn vị vật lý (MB/GB)
  const chartTelemetryData = useMemo(() => {
    if (!telemetrySequence || telemetrySequence.length === 0) return null;
    const totalRamMb = (parseFloat(totalRamGb) || 8.0) * 1024;

    return telemetrySequence.map((pt, idx) => {
      const t = pt.time_bucket
        ? new Date(pt.time_bucket)
        : new Date(Date.now() - (telemetrySequence.length - idx) * 5000);

      const rawRamVal = Number(pt.node_ram_percent ?? pt.ram_usage_percent ?? pt.ram ?? 0);
      let ramPercent = 0;
      let rawRamMb = Number(pt.rawRamMb ?? 0);

      // Nếu rawRamVal > 100, tức là mang giá trị Megabytes thô (ví dụ 1850MB hay 3350MB)
      if (rawRamVal > 100) {
        rawRamMb = rawRamVal;
        ramPercent = Math.min(100, Math.max(0, Math.round(((rawRamMb / totalRamMb) * 100) * 100) / 100));
      } else {
        // rawRamVal đã là phần trăm hợp lệ (ví dụ: 22.8% - 41.2%)
        ramPercent = Math.min(100, Math.max(0, Math.round(rawRamVal * 100) / 100));
        if (!rawRamMb && ramPercent > 0) {
          rawRamMb = Math.round((ramPercent / 100) * totalRamMb);
        }
      }

      const cpuPercent = Math.min(100, Math.max(0, Math.round((Number(pt.cpu_usage_percent ?? pt.cpu) || 0) * 100) / 100));

      return {
        timestamp: t.getTime(),
        time_bucket: t.toISOString(),
        time: t.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        fullTime: `${t.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} (${t.toLocaleDateString('vi-VN')})`,
        cpu: cpuPercent,
        ram: ramPercent,
        rawRamMb: rawRamMb,
        disk: Number(pt.disk_usage_percent ?? pt.disk ?? 0),
        latency: Number(pt.latency) || 0,
      };
    });
  }, [telemetrySequence, totalRamGb]);

  // Tìm cụm Online khả dụng để hỗ trợ người dùng chuyển nhanh
  const onlineCluster = useMemo(() => {
    if (!envList || envList.length === 0) return null;
    return envList.find((e) => e.agentStatus === 'ONLINE' && e.id !== currentEnv?.id) || null;
  }, [envList, currentEnv?.id]);

  // ==========================================
  // Honest Empty State: Khi cụm K8s đang chọn là OFFLINE hoặc chưa cài Agent
  // ==========================================
  if (!isClusterOnline || (clusterInfo && (!clusterInfo.nodes || clusterInfo.nodes.length === 0))) {
    return (
      <div className="dashboard-overview-container" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--dash-text-primary)', letterSpacing: '-0.02em', margin: 0 }}>
              Tổng Quan Vận Hành Hạ Tầng
            </h1>
            <p style={{ fontSize: '0.875rem', color: 'var(--dash-text-secondary)', marginTop: '4px', margin: 0 }}>
              Giám sát trạng thái vận hành và kết nối tác tử hạ tầng Kubernetes
            </p>
          </div>
          <button
            onClick={() => {
              triggerRefresh();
              fetchClusterInfo();
            }}
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
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
            <span>Kiểm tra kết nối</span>
          </button>
        </div>

        {/* Card thông báo Viễn trắc trung thực */}
        <div
          className="dash-card"
          style={{
            padding: '48px 32px',
            textAlign: 'center',
            maxWidth: '680px',
            margin: '30px auto',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            border: '1px dashed var(--dash-border)',
            borderRadius: 'var(--dash-radius-lg)',
          }}
        >
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: 'var(--dash-radius-xl)',
              backgroundColor: 'var(--dash-warning-bg)',
              color: 'var(--dash-warning-text)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '20px',
            }}
          >
            <Radio size={32} />
          </div>

          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '3px 10px',
              borderRadius: 'var(--dash-radius-full)',
              backgroundColor: 'var(--dash-danger-bg)',
              color: 'var(--dash-danger)',
              fontSize: '0.6875rem',
              fontWeight: 700,
              marginBottom: '12px',
            }}
          >
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--dash-danger)' }} />
            TÁC TỬ NGOẠI TUYẾN / CHƯA KẾT NỐI
          </div>

          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--dash-text-primary)', marginBottom: '8px' }}>
            Cụm Kubernetes "{currentEnv?.cluster || currentEnv?.name || 'Mặc định'}" Chưa Có Tác Tử Kết Nối
          </h2>

          <p style={{ fontSize: '0.875rem', color: 'var(--dash-text-secondary)', lineHeight: 1.6, maxWidth: '520px', marginBottom: '24px' }}>
            Cụm <strong>{currentEnv?.cluster || currentEnv?.name || 'Mặc định'}</strong> hiện chưa nhận được viễn trắc từ Tác tử eBPF. SelfHeal tuân thủ nghiêm ngặt nguyên tắc <strong>Viễn trắc trung thực (Honest Telemetry)</strong>: không hiển thị số liệu giả lập khi cụm chưa kết nối tác tử.
          </p>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              onClick={() => onNavigate && onNavigate('/dashboard/clusters')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 20px',
                backgroundColor: 'var(--dash-primary)',
                color: '#FFFFFF',
                borderRadius: 'var(--dash-radius-md)',
                border: 'none',
                fontWeight: 600,
                fontSize: '0.875rem',
                cursor: 'pointer',
                boxShadow: 'var(--dash-shadow-sm)',
              }}
            >
              <Terminal size={16} />
              <span>Lấy Lệnh Cài Đặt Tác Tử Cho Cụm Này</span>
            </button>

            {onlineCluster && (
              <button
                onClick={() => {
                  setCurrentEnv(onlineCluster);
                  localStorage.setItem('selfheal_active_cluster_id', onlineCluster.id);
                  localStorage.setItem('selfheal_active_cluster_name', onlineCluster.cluster || onlineCluster.name);
                  localStorage.setItem('selfheal_active_env_name', onlineCluster.envName || 'Production');
                  triggerRefresh();
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 18px',
                  backgroundColor: '#FFFFFF',
                  color: 'var(--dash-mint-600)',
                  borderRadius: 'var(--dash-radius-md)',
                  border: '1px solid var(--dash-mint-200)',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                }}
              >
                <Server size={16} />
                <span>Quay lại {onlineCluster.cluster || onlineCluster.name} (Online)</span>
                <ArrowRight size={14} />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // Render Dashboard Realtime (Khi cụm đang ONLINE)
  // ==========================================
  return (
    <div className="dashboard-overview-container" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* 1. Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--dash-text-primary)', letterSpacing: '-0.02em', margin: 0 }}>
            Tổng Quan Vận Hành Hạ Tầng
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px', fontSize: '0.8125rem', color: 'var(--dash-text-muted)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Clock size={12} /> Cập nhật gần nhất: {lastDataTimestamp || lastUpdated}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Manual Refresh Now button */}
          <button
            type="button"
            onClick={() => {
              triggerRefresh();
              refreshAllData();
            }}
            disabled={isRefreshing || isPollingBusyRef.current}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              backgroundColor: '#FFFFFF',
              border: '1px solid var(--dash-border)',
              borderRadius: 'var(--dash-radius-md)',
              color: 'var(--dash-text-primary)',
              fontSize: '0.8125rem',
              fontWeight: 600,
              cursor: (isRefreshing || isPollingBusyRef.current) ? 'wait' : 'pointer',
              boxShadow: 'var(--dash-shadow-xs)',
            }}
          >
            <RefreshCw size={14} className={(isRefreshing || isPollingBusyRef.current) ? 'animate-spin' : ''} />
            <span>Làm mới</span>
          </button>
        </div>
      </div>

      {/* Error State Banner for Statistics API */}
      {statsError && (
        <div
          style={{
            padding: '12px 18px',
            borderRadius: '8px',
            backgroundColor: '#FEF2F2',
            border: '1px solid #FECACA',
            color: '#DC2626',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8125rem', fontWeight: 600 }}>
            <AlertCircle size={16} />
            <span>Không thể đồng bộ số liệu thống kê tổng hợp: {statsError}</span>
          </div>
          <button
            type="button"
            onClick={fetchOverviewStats}
            style={{
              padding: '4px 12px',
              borderRadius: '6px',
              backgroundColor: '#FFFFFF',
              border: '1px solid #FECACA',
              color: '#DC2626',
              fontSize: '0.75rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Thử lại
          </button>
        </div>
      )}

      {/* 3. Overview Metric Cards (with Loading Skeleton) */}
      {isStatsLoading && !overviewStats ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '16px',
          }}
        >
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="dash-card"
              style={{
                padding: '16px 20px',
                minHeight: '104px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                opacity: 0.7,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ width: '55%', height: '14px', backgroundColor: '#E2E8F0', borderRadius: '4px' }} />
                <div style={{ width: '18px', height: '18px', backgroundColor: '#E2E8F0', borderRadius: '4px' }} />
              </div>
              <div style={{ width: '45%', height: '26px', backgroundColor: '#CBD5E1', borderRadius: '6px', margin: '6px 0' }} />
              <div style={{ width: '75%', height: '12px', backgroundColor: '#F1F5F9', borderRadius: '4px' }} />
            </div>
          ))}
        </div>
      ) : (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px',
        }}
      >
        {/* Card 1: CPU Usage */}
        <div className="dash-card" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--dash-text-secondary)' }}>CPU Máy Chủ (Toàn Cụm)</span>
            <Cpu size={16} color="var(--dash-primary)" />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '1.625rem', fontWeight: 800, color: 'var(--dash-text-primary)', letterSpacing: '-0.02em' }}>
              {nodeCpuPercent}%
            </span>
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                color: 'var(--dash-text-muted)',
              }}
            >
              {totalCpuCores > 0 ? `${nodeUsedCpuCores} / ${totalCpuCores} vCPUs` : `${nodeUsedCpuCores} vCPUs`}
            </span>
          </div>
        </div>

        {/* Card 2: Memory Usage */}
        <div className="dash-card" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--dash-text-secondary)' }}>RAM Máy Chủ (Toàn Cụm)</span>
            <Database size={16} color="var(--dash-info)" />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '1.625rem', fontWeight: 800, color: 'var(--dash-text-primary)', letterSpacing: '-0.02em' }}>
              {nodeRamPercent}%
            </span>
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                color: 'var(--dash-text-muted)',
              }}
            >
              {parseFloat(totalRamGb) > 0 ? `${nodeRamGb} / ${totalRamGb} GB` : `${nodeRamGb} GB`}
            </span>
          </div>
        </div>

        {/* Card 3: Disk Usage */}
        <div className="dash-card" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--dash-text-secondary)' }}>Dung lượng Ổ đĩa</span>
            <HardDrive size={16} color="var(--dash-text-secondary)" />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '1.625rem', fontWeight: 800, color: 'var(--dash-text-primary)', letterSpacing: '-0.02em' }}>
              {diskVal}%
            </span>
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                color: 'var(--dash-text-muted)',
              }}
            >
              {parseFloat(totalDiskTb) > 0 ? `${diskUsedGb} GB / ${totalDiskTb} TB` : `${diskUsedGb} GB`}
            </span>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: diskVal > 85 ? 'var(--dash-danger)' : diskVal > 70 ? 'var(--dash-warning)' : 'var(--dash-success)' }}>
              {diskStatusText}
            </span>
          </div>
        </div>

        {/* Card 4: Pods Đang Chạy */}
        <div className="dash-card" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--dash-text-secondary)' }}>Pods Đang Chạy</span>
            <Box size={16} color="var(--dash-mint-600)" />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '1.625rem', fontWeight: 800, color: 'var(--dash-text-primary)', letterSpacing: '-0.02em' }}>
              {runningPodsCount} / {podCount}
            </span>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: runningPodsCount === podCount ? 'var(--dash-success)' : 'var(--dash-warning)' }}>
              {runningPodsCount === podCount ? '100% Bình thường' : `${runningPodsCount}/${podCount} Đang chạy`}
            </span>
          </div>
        </div>

        {/* Card 5: Active Incidents */}
        <div className="dash-card" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--dash-text-secondary)' }}>Sự cố Đang Diễn Ra</span>
            <AlertTriangle size={16} color={activeIncidentsCount > 0 ? 'var(--dash-warning)' : 'var(--dash-success)'} />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '1.625rem', fontWeight: 800, color: activeIncidentsCount > 0 ? 'var(--dash-warning-text)' : 'var(--dash-text-primary)', letterSpacing: '-0.02em' }}>
              {activeIncidentsCount}
            </span>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: activeIncidentsCount > 0 ? 'var(--dash-warning-text)' : 'var(--dash-success)' }}>
              {activeIncidentsCount === 0 ? 'An toàn' : 'Cần chú ý'}
            </span>
          </div>
        </div>

        {/* Card 6: Agent Status */}
        <div className="dash-card" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--dash-text-secondary)' }}>Trạng thái Tác tử</span>
            <Radio
              size={16}
              color={
                !isClusterOnline
                  ? 'var(--dash-danger)'
                  : isDataStale || telemetrySequence.length === 0
                  ? 'var(--dash-warning-text)'
                  : 'var(--dash-primary)'
              }
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span
              style={{
                fontSize: '1.625rem',
                fontWeight: 800,
                color:
                  !isClusterOnline
                    ? 'var(--dash-text-muted)'
                    : isDataStale || telemetrySequence.length === 0
                    ? 'var(--dash-warning-text)'
                    : 'var(--dash-text-primary)',
                letterSpacing: '-0.02em',
              }}
            >
              {!isClusterOnline
                ? 'Ngoại tuyến'
                : isDataStale || telemetrySequence.length === 0
                ? 'Chờ viễn trắc'
                : 'Trực tuyến'}
            </span>
            <span
              style={{
                fontSize: '0.75rem',
                color:
                  !isClusterOnline
                    ? 'var(--dash-danger)'
                    : isDataStale || telemetrySequence.length === 0
                    ? 'var(--dash-warning-text)'
                    : 'var(--dash-success)',
                fontWeight: 600,
              }}
            >
              {!isClusterOnline
                ? 'Mất kết nối'
                : isDataStale || telemetrySequence.length === 0
                ? 'Chưa có mẫu'
                : telemetry?.latency
                ? `${telemetry.latency}ms`
                : '0ms'}
            </span>
          </div>
        </div>

        {/* Card 7: Self-Healing Actions */}
        <div className="dash-card" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--dash-text-secondary)' }}>Tự Phục Hồi (24h)</span>
            <Zap size={16} color="var(--dash-primary)" />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '1.625rem', fontWeight: 800, color: 'var(--dash-text-primary)', letterSpacing: '-0.02em' }}>
              {overviewStats?.remediations?.total !== undefined ? overviewStats.remediations.total : 0}
            </span>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--dash-success)' }}>
              {overviewStats?.remediations?.total > 0 ? `${Math.round(overviewStats.remediations.success_rate || 0)}% Thành công` : 'Chưa có sự cố'}
            </span>
          </div>
        </div>

        {/* Card 8: Pending Approvals (HITL Gate) */}
        <div
          className="dash-card"
          onClick={() => onNavigate && onNavigate('/dashboard/self-healing/approvals')}
          style={{
            padding: '16px 20px',
            cursor: 'pointer',
            backgroundColor: pendingApprovalsCount > 0 ? 'var(--dash-warning-bg)' : '#FFFFFF',
            border: pendingApprovalsCount > 0 ? '1px solid var(--dash-warning-border)' : '1px solid var(--dash-border)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: pendingApprovalsCount > 0 ? 'var(--dash-warning-text)' : 'var(--dash-text-secondary)' }}>
              Phê duyệt Chờ Xử lý (HITL)
            </span>
            <CheckCircle2 size={16} color={pendingApprovalsCount > 0 ? 'var(--dash-warning)' : 'var(--dash-text-muted)'} />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '1.625rem', fontWeight: 800, color: pendingApprovalsCount > 0 ? 'var(--dash-warning-text)' : 'var(--dash-text-primary)', letterSpacing: '-0.02em' }}>
              {pendingApprovalsCount}
            </span>
            {pendingApprovalsCount > 0 && (
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--dash-warning-text)' }}>
                Cần xử lý &rarr;
              </span>
            )}
          </div>
        </div>
      </div>
      )}

      {/* 4. Interactive Infrastructure Metrics Resource Chart */}
      <InteractiveResourceChart
        data={chartTelemetryData}
        totalCpuCores={totalCpuCores}
        totalMemoryGb={Math.round(parseFloat(totalRamGb))}
        title="Biến thiên Tài nguyên Cụm máy chủ (CPU & RAM)"
        subtitle="Dữ liệu viễn trắc đo đạc từ các DaemonSet eBPF theo thời gian thực"
        timeRange={chartTimeRange}
        onTimeRangeChange={handleChartRangeChange}
        showTimeRange={false}
        isLive={isWsLive && isClusterOnline && !isDataStale}
        isStale={isDataStale}
        isClusterOnline={isClusterOnline}
        isLoading={isChartLoading}
        error={chartError}
        onRetry={() => loadClusterTrend(chartTimeRange)}
      />

      {/* 5, 6, 7. Summaries Grid: AI Predictions, Incidents, Self-Healing */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
        {/* 5. Pending Approvals & AI Remediation Summary */}
        <div className="dash-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: 'var(--dash-radius-sm)',
                  backgroundColor: pendingApprovalsCount > 0 ? '#FEF3C7' : 'var(--dash-mint-100)',
                  color: pendingApprovalsCount > 0 ? '#B45309' : 'var(--dash-mint-600)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {pendingApprovalsCount > 0 ? <CheckCircle2 size={16} /> : <Sparkles size={16} />}
              </div>
              <div>
                <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--dash-text-primary)', margin: 0 }}>
                  Đề Xuất Phê Duyệt (HITL)
                </h3>
                <div style={{ fontSize: '0.65625rem', color: 'var(--dash-text-muted)', marginTop: '1px' }}>
                  AI Dự Báo Rủi Ro Chủ Động &bull; Cổng Phê Duyệt
                </div>
              </div>
            </div>
            <button
              onClick={() => onNavigate && onNavigate('/dashboard/self-healing/approvals')}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--dash-primary)',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Cổng phê duyệt &rarr;
            </button>
          </div>

          {/* Hiển thị đề xuất thật cần phê duyệt (Ưu tiên pendingApprovalsCount và pendingRecommendations) */}
          {pendingApprovalsCount > 0 || pendingRecommendations.length > 0 ? (
            <div
              style={{
                padding: '12px 14px',
                border: '1px solid #BAE6FD',
                borderRadius: 'var(--dash-radius-md)',
                backgroundColor: '#F0F9FF',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#0369A1' }}>
                  {pendingApprovalsCount > 0
                    ? `Có ${pendingApprovalsCount} yêu cầu tự phục hồi chờ phê duyệt`
                    : pendingRecommendations[0]?.recommendation || 'Đề xuất Tự Khắc Phục AI'}
                </span>
                <span
                  style={{
                    fontSize: '0.6875rem',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '12px',
                    backgroundColor: '#FEF3C7',
                    color: '#B45309',
                    border: '1px solid #FDE68A',
                  }}
                >
                  Cần xử lý
                </span>
              </div>
              <div style={{ fontSize: '0.75rem', color: '#1E293B', lineHeight: 1.5 }}>
                {pendingRecommendations[0]?.reasoning ||
                  'Hệ thống AI đề xuất hành động điều phối (Scale Replicas, Restart Pod...) để phân phối tải và duy trì tính khả dụng của dịch vụ.'}
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginTop: '4px',
                  paddingTop: '8px',
                  borderTop: '1px dashed #BAE6FD',
                }}
              >
                <span style={{ fontSize: '0.6875rem', color: '#64748B' }}>
                  Chế độ an toàn: Human-in-the-Loop
                </span>
                <button
                  type="button"
                  onClick={() => onNavigate && onNavigate('/dashboard/self-healing/approvals')}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '4px 10px',
                    background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '0.71875rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: '0 1px 2px rgba(5, 150, 105, 0.2)',
                  }}
                >
                  <CheckCircle2 size={12} />
                  <span>Xử Lý Ngay &rarr;</span>
                </button>
              </div>
            </div>
          ) : (
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '24px 16px',
                textAlign: 'center',
                backgroundColor: 'var(--dash-bg-canvas)',
                borderRadius: 'var(--dash-radius-md)',
                border: '1px dashed var(--dash-border)',
              }}
            >
              <ShieldCheck size={28} color="var(--dash-success)" style={{ marginBottom: '6px' }} />
              <div style={{ fontWeight: 600, fontSize: '0.8125rem', color: 'var(--dash-text-primary)' }}>
                Không Có Yêu Cầu Chờ Duyệt
              </div>
              <p style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', margin: '4px 0 0 0' }}>
                Tất cả các dịch vụ đang vận hành ổn định, không có đề xuất cần can thiệp.
              </p>
            </div>
          )}
        </div>

        {/* 6. Incident Summary */}
        <div className="dash-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: 'var(--dash-radius-sm)',
                  backgroundColor: activeIncidentsCount > 0 ? 'var(--dash-warning-bg)' : 'var(--dash-success-bg)',
                  color: activeIncidentsCount > 0 ? 'var(--dash-warning-text)' : 'var(--dash-success)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {activeIncidentsCount > 0 ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
              </div>
              <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--dash-text-primary)', margin: 0 }}>
                Sự Cố Đang Diễn Ra ({activeIncidentsCount})
              </h3>
            </div>
            <button
              onClick={() => onNavigate && onNavigate('/dashboard/incidents')}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--dash-primary)',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Xem lịch sử &rarr;
            </button>
          </div>

          {activeIncidentsCount > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
              {activeIncidentsList.slice(0, 3).map((inc, i) => (
                <div
                  key={inc.id || i}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 'var(--dash-radius-sm)',
                    backgroundColor: 'var(--dash-bg-canvas)',
                    border: '1px solid var(--dash-border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--dash-text-primary)' }}>
                      {inc.title || 'Sự cố viễn trắc K8s'}
                    </div>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', marginTop: '2px' }}>
                      {inc.created_at ? new Date(inc.created_at).toLocaleTimeString() : 'Vừa xong'} &bull; Mức độ: {inc.severity || 'HIGH'}
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: '0.6875rem',
                      fontWeight: 600,
                      padding: '2px 6px',
                      borderRadius: 'var(--dash-radius-xs)',
                      backgroundColor: 'var(--dash-warning-bg)',
                      color: 'var(--dash-warning-text)',
                    }}
                  >
                    {inc.status || 'OPEN'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '24px',
                textAlign: 'center',
                backgroundColor: 'var(--dash-bg-canvas)',
                borderRadius: 'var(--dash-radius-md)',
                border: '1px dashed var(--dash-border)',
              }}
            >
              <ShieldCheck size={32} color="var(--dash-success)" style={{ marginBottom: '8px' }} />
              <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--dash-text-primary)' }}>
                Toàn Bộ Hệ Thống Hoạt Động Tốt
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--dash-text-secondary)', margin: '4px 0 0 0' }}>
                Không ghi nhận sự cố nghiêm trọng nào trong môi trường hiện tại suốt 72 giờ qua.
              </p>
            </div>
          )}
        </div>

        {/* 7. Self-Healing Summary */}
        <div className="dash-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: 'var(--dash-radius-sm)',
                  backgroundColor: 'var(--dash-mint-100)',
                  color: 'var(--dash-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Zap size={16} />
              </div>
              <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--dash-text-primary)', margin: 0 }}>
                Hiệu Quả Tự Phục Hồi
              </h3>
            </div>
            <button
              onClick={() => onNavigate && onNavigate('/dashboard/self-healing/history')}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--dash-primary)',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Nhật ký đầy đủ &rarr;
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px' }}>
            <div style={{ padding: '10px', backgroundColor: 'var(--dash-bg-canvas)', borderRadius: 'var(--dash-radius-sm)', border: '1px solid var(--dash-border)' }}>
              <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)' }}>Tỷ Lệ Thành Công</div>
              <div style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--dash-success)', marginTop: '2px' }}>
                {overviewStats?.remediations?.total > 0 && overviewStats?.remediations?.success_rate !== undefined ? `${Math.round(overviewStats.remediations.success_rate)}%` : '--'}
              </div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-secondary)' }}>
                {overviewStats?.remediations?.total > 0 ? `${overviewStats.remediations.succeeded || 0}/${overviewStats.remediations.total} Hành động` : 'Chưa có hành động'}
              </div>
            </div>
            <div style={{ padding: '10px', backgroundColor: 'var(--dash-bg-canvas)', borderRadius: 'var(--dash-radius-sm)', border: '1px solid var(--dash-border)' }}>
              <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)' }}>Thời Gian Phục Hồi TB</div>
              <div style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--dash-text-primary)', marginTop: '2px' }}>
                {overviewStats?.remediations?.total > 0 && overviewStats?.remediations?.avg_duration_sec !== undefined ? `${overviewStats.remediations.avg_duration_sec}s` : '--'}
              </div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-secondary)' }}>Không gián đoạn</div>
            </div>
          </div>

          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--dash-text-primary)', marginBottom: '6px' }}>
            Hành Động Tự Động Gần Đây:
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.75rem' }}>
            {overviewStats?.remediations?.recent_actions && overviewStats.remediations.recent_actions.length > 0 ? (
              overviewStats.remediations.recent_actions.map((act) => (
                <div key={act.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 8px', backgroundColor: 'var(--dash-bg-canvas)', borderRadius: 'var(--dash-radius-xs)' }}>
                  <span style={{ color: 'var(--dash-text-secondary)' }}>
                    {act.action_name}: <strong style={{ color: 'var(--dash-text-primary)' }}>{act.target_name}</strong>
                  </span>
                  <span style={{ color: 'var(--dash-success)', fontWeight: 600 }}>Tự động trong {act.duration_sec}s</span>
                </div>
              ))
            ) : (
              <div style={{ padding: '8px', textAlign: 'center', color: 'var(--dash-text-muted)', fontSize: '0.75rem' }}>
                Chưa có hành động tự phục hồi nào trong chu kỳ này.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OverviewPage;
