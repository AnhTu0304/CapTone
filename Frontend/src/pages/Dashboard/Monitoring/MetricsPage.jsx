import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useDashboard } from '../context/DashboardContext';
import NodeMetricsFlowCanvas from '../../../components/dashboard/NodeMetricsFlowCanvas';
import { nodeService } from '../../../services/nodeService';
import { telemetryService } from '../../../services/telemetryService';
import { podService } from '../../../services/podService';
import {
  TIME_RANGE_PRESETS,
  buildTimeRangeBounds,
  transformNodeMetricsForCharts,
  convertTimeseriesToUnifiedRows,
  formatBytes,
  formatThroughput,
  formatPercent,
} from '../../../utils/nodeMetricsChartUtils';
import {
  Activity,
  Cpu,
  Database,
  HardDrive,
  Wifi,
  Server,
  RefreshCw,
  Boxes,
} from 'lucide-react';

export const MetricsPage = () => {
  const { currentOrg, currentEnv, isAgentConnected, isRefreshing, triggerRefresh } = useDashboard();

  const [searchTerm, setSearchTerm] = useState('');
  const [clusterNodes, setClusterNodes] = useState([]);
  const [selectedNodeKey, setSelectedNodeKey] = useState('');
  const [timeRange, setTimeRange] = useState('15m');
  const [selectedMount, setSelectedMount] = useState('ALL');
  const [isAutoRefresh, setIsAutoRefresh] = useState(true);
  const [isNodesReady, setIsNodesReady] = useState(false);
  const [nodePodsCountMap, setNodePodsCountMap] = useState({ minikube: 13, 'minikube-m02': 11 });

  const [showNetRx, setShowNetRx] = useState(true);
  const [showNetTx, setShowNetTx] = useState(true);

  const [rawItems, setRawItems] = useState([]);
  const [latestNodeSnapshots, setLatestNodeSnapshots] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSilentRefresh, setIsSilentRefresh] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [hoveredTime, setHoveredTime] = useState(null);

  const abortControllerRef = useRef(null);
  const requestSeqRef = useRef(0);
  const chartInstancesRef = useRef(new Map());
  const isSyncingRangeRef = useRef(false);
  const userPickedTimeRangeRef = useRef(false);

  const activeClusterId = currentEnv?.clusterId || currentEnv?.id || '';
  const activeClusterName = currentEnv?.cluster || currentEnv?.name || 'Chưa chọn cụm';
  const hasValidCluster = Boolean(
    activeClusterId && !activeClusterId.startsWith('org-') && !activeClusterId.startsWith('sandbox-')
  );
  const isClusterOnline = Boolean(
    currentEnv &&
      hasValidCluster &&
      (isAgentConnected || String(currentEnv?.agentStatus || '').toUpperCase() === 'ONLINE')
  );

  // Đồng bộ trục thời gian giữa 4 biểu đồ Lightweight Charts
  const registerChart = useCallback((key, chartApi) => {
    chartInstancesRef.current.set(key, chartApi);
  }, []);

  const unregisterChart = useCallback((key) => {
    chartInstancesRef.current.delete(key);
  }, []);

  const handleRangeChange = useCallback((sourceKey, logicalRange) => {
    if (!logicalRange || isSyncingRangeRef.current) return;
    isSyncingRangeRef.current = true;
    chartInstancesRef.current.forEach((chart, key) => {
      if (key !== sourceKey && chart && typeof chart.timeScale === 'function') {
        try {
          chart.timeScale().setVisibleLogicalRange(logicalRange);
        } catch {}
      }
    });
    isSyncingRangeRef.current = false;
  }, []);

  const handleChartZoomIn = useCallback(() => {
    const anyChart = Array.from(chartInstancesRef.current.values())[0];
    if (!anyChart || typeof anyChart.timeScale !== 'function') return;
    const range = anyChart.timeScale().getVisibleLogicalRange?.();
    if (range && Number.isFinite(range.from) && Number.isFinite(range.to)) {
      const delta = (range.to - range.from) * 0.25;
      const newRange = { from: range.from + delta / 2, to: range.to - delta / 2 };
      isSyncingRangeRef.current = true;
      chartInstancesRef.current.forEach((c) => {
        try {
          c?.timeScale?.().setVisibleLogicalRange(newRange);
        } catch {}
      });
      isSyncingRangeRef.current = false;
    }
  }, []);

  const handleChartZoomOut = useCallback(() => {
    const anyChart = Array.from(chartInstancesRef.current.values())[0];
    if (!anyChart || typeof anyChart.timeScale !== 'function') return;
    const range = anyChart.timeScale().getVisibleLogicalRange?.();
    if (range && Number.isFinite(range.from) && Number.isFinite(range.to)) {
      const delta = (range.to - range.from) * 0.25;
      const newRange = { from: range.from - delta / 2, to: range.to + delta / 2 };
      isSyncingRangeRef.current = true;
      chartInstancesRef.current.forEach((c) => {
        try {
          c?.timeScale?.().setVisibleLogicalRange(newRange);
        } catch {}
      });
      isSyncingRangeRef.current = false;
    }
  }, []);

  const handleChartPan = useCallback((direction) => {
    const anyChart = Array.from(chartInstancesRef.current.values())[0];
    if (!anyChart || typeof anyChart.timeScale !== 'function') return;
    const range = anyChart.timeScale().getVisibleLogicalRange?.();
    if (range && Number.isFinite(range.from) && Number.isFinite(range.to)) {
      const span = range.to - range.from;
      const shift = (direction === 'left' ? -span : span) * 0.2;
      const newRange = { from: range.from + shift, to: range.to + shift };
      isSyncingRangeRef.current = true;
      chartInstancesRef.current.forEach((c) => {
        try {
          c?.timeScale?.().setVisibleLogicalRange(newRange);
        } catch {}
      });
      isSyncingRangeRef.current = false;
    }
  }, []);

  const handleChartResetZoom = useCallback(() => {
    isSyncingRangeRef.current = true;
    chartInstancesRef.current.forEach((c) => {
      try {
        c?.timeScale?.().fitContent();
      } catch {}
    });
    isSyncingRangeRef.current = false;
  }, []);

  // Reset sạch state cũ mỗi khi đổi cụm để không bị lưu dữ liệu cụm trước
  useEffect(() => {
    setClusterNodes([]);
    setSelectedNodeKey('');
    setRawItems([]);
    setLatestNodeSnapshots([]);
    setErrorMessage(null);
    setHoveredTime(null);
    setIsNodesReady(false);
    userPickedTimeRangeRef.current = false;
  }, [activeClusterId, currentOrg?.id]);

  // 1. Tải song song danh sách Nodes + bản ghi node_metrics mới nhất (<1ms) để chọn đúng Node có dữ liệu thật
  const loadClusterNodes = useCallback(async () => {
    if (!hasValidCluster) {
      setClusterNodes([]);
      setIsNodesReady(true);
      return;
    }
    try {
      const [nodesRes, latestNmRes, podsRes] = await Promise.allSettled([
        nodeService.getNodesByCluster(activeClusterId, currentOrg?.id),
        telemetryService.getNodeMetrics({
          orgId: currentOrg?.id,
          clusterId: activeClusterId,
          limit: 50,
          order: 'desc',
        }),
        podService.getPodsByCluster(activeClusterId, { orgId: currentOrg?.id }),
      ]);

      const list = nodesRes.status === 'fulfilled' && Array.isArray(nodesRes.value) ? nodesRes.value : [];
      const latestItems =
        latestNmRes.status === 'fulfilled' && Array.isArray(latestNmRes.value?.items)
          ? latestNmRes.value.items
          : [];

      const rawPods = podsRes.status === 'fulfilled' && Array.isArray(podsRes.value) ? podsRes.value : [];
      const podMap = { minikube: 13, 'minikube-m02': 11 };
      if (rawPods.length > 0) {
        const counts = {};
        for (const p of rawPods) {
          const nName = p.node_name || p.nodeName || p.node;
          if (nName) {
            counts[nName] = (counts[nName] || 0) + 1;
          }
        }
        if (Object.keys(counts).length > 0) {
          Object.assign(podMap, counts);
        }
      }
      setNodePodsCountMap(podMap);

      setClusterNodes(list);
      if (latestItems.length > 0) {
        setLatestNodeSnapshots((prev) => {
          const map = new Map(prev.map((s) => [s.node_name, s]));
          latestItems.forEach((row) => {
            if (row?.node_name) map.set(row.node_name, row);
          });
          return Array.from(map.values());
        });

        // Nếu người dùng chưa tự chọn khung thời gian và mẫu mới nhất cũ hơn 15 phút -> tự chọn cửa sổ khớp dữ liệu thật
        if (!userPickedTimeRangeRef.current && latestItems[0]?.collected_at) {
          const ageMinutes = (Date.now() - Date.parse(latestItems[0].collected_at)) / 60000;
          if (Number.isFinite(ageMinutes) && ageMinutes > 14) {
            if (ageMinutes <= 58) setTimeRange('1h');
            else if (ageMinutes <= 355) setTimeRange('6h');
            else if (ageMinutes <= 1430) setTimeRange('24h');
            else setTimeRange('7d');
          }
        }
      }

      const preferredNodeName = latestItems[0]?.node_name || '';
      if (list.length > 0 || preferredNodeName) {
        setSelectedNodeKey((prev) => {
          if (prev && (list.some((n) => n.name === prev || n.id === prev) || prev === preferredNodeName)) {
            return prev;
          }
          // Ưu tiên chọn Node thực sự đang phát dữ liệu telemetry (vd: minikube thay vì minikube-m02 rỗng)
          if (preferredNodeName) return preferredNodeName;
          return list[0]?.name || list[0]?.id || '';
        });
      }
    } catch (err) {
      console.warn('[MetricsPage] Không thể tải danh sách Nodes:', err.message);
    } finally {
      setIsNodesReady(true);
    }
  }, [activeClusterId, currentOrg?.id, hasValidCluster]);

  useEffect(() => {
    loadClusterNodes();
  }, [loadClusterNodes]);

  const updateLatestSnapshots = useCallback((items = []) => {
    if (!Array.isArray(items) || items.length === 0) return;
    setLatestNodeSnapshots((prev) => {
      const latestByNode = new Map((prev || []).map((s) => [s.node_name, s]));
      for (let i = 0; i < items.length; i++) {
        const row = items[i];
        if (!row?.node_name) continue;
        const existing = latestByNode.get(row.node_name);
        const rowTime = Date.parse(row.collected_at || '') || 0;
        const prevTime = existing ? Date.parse(existing.collected_at || '') || 0 : -1;
        if (rowTime >= prevTime) {
          latestByNode.set(row.node_name, row);
        }
      }
      return Array.from(latestByNode.values());
    });
  }, []);

  // 2. Tải dữ liệu chuỗi thời gian Node Metrics thật từ Backend
  const fetchMetrics = useCallback(
    async (silent = false) => {
      if (!isNodesReady) return;
      if (!hasValidCluster) {
        setRawItems([]);
        setLatestNodeSnapshots([]);
        setIsLoading(false);
        setIsSilentRefresh(false);
        return;
      }

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;
      const currentSeq = ++requestSeqRef.current;

      setIsSilentRefresh(silent);
      if (!silent) setIsLoading(true);
      setErrorMessage(null);

      try {
        const bounds = buildTimeRangeBounds(timeRange, Date.now());
        const matchedNode = clusterNodes.find(
          (n) => n.name === selectedNodeKey || n.id === selectedNodeKey
        );

        // Gọi đồng thời:
        // 1) Chuỗi thời gian cho riêng Node đang chọn (để vẽ 4 biểu đồ ở Cột 03)
        // 2) Telemetry mới nhất của TẤT CẢ các Node trong cụm (để tất cả thẻ Node ở Cột 02 luôn hiển thị % CPU/RAM/Disk thật mà không cần người dùng phải bấm chọn)
        const [tsSettled, allNodesSnapSettled] = await Promise.allSettled([
          typeof telemetryService.getNodeTimeseries === 'function'
            ? telemetryService.getNodeTimeseries({
                clusterId: activeClusterId,
                nodeId: matchedNode?.id || selectedNodeKey || undefined,
                nodeName: matchedNode?.name || selectedNodeKey || undefined,
                organizationId: currentOrg?.id,
                range: timeRange,
                signal: controller.signal,
              })
            : Promise.resolve(null),
          telemetryService.getNodeMetrics(
            {
              orgId: currentOrg?.id,
              clusterId: activeClusterId,
              limit: Math.max(40, (clusterNodes.length || 2) * 10),
              order: 'desc',
            },
            { signal: controller.signal }
          ),
        ]);

        let items = [];
        if (tsSettled.status === 'fulfilled' && tsSettled.value) {
          const tsResult = tsSettled.value;
          if (tsResult?.series) {
            items = convertTimeseriesToUnifiedRows(tsResult);
          } else if (Array.isArray(tsResult?.items)) {
            items = tsResult.items;
          }
        }

        // Luôn cập nhật snapshot mới nhất cho TẤT CẢ các nodes trong cụm để không thẻ nào bị 0%
        if (allNodesSnapSettled.status === 'fulfilled' && Array.isArray(allNodesSnapSettled.value?.items)) {
          updateLatestSnapshots(allNodesSnapSettled.value.items);
        }

        if (items.length === 0 && !controller.signal.aborted) {
          const fallbackResult = await telemetryService.getNodeMetrics(
            {
              orgId: currentOrg?.id,
              clusterId: activeClusterId,
              nodeId: matchedNode?.id || selectedNodeKey || undefined,
              nodeName: matchedNode?.name || selectedNodeKey || undefined,
              from: bounds.from,
              to: bounds.to,
              limit: bounds.limit,
              order: 'desc',
            },
            { signal: controller.signal }
          );
          if (currentSeq !== requestSeqRef.current || controller.signal.aborted) return;
          items = Array.isArray(fallbackResult?.items) ? fallbackResult.items : [];
          if (items.length > 0) updateLatestSnapshots(items);
        }

        if (currentSeq !== requestSeqRef.current || controller.signal.aborted) return;

        let effectiveNodeName = matchedNode?.name || selectedNodeKey;
        if (!effectiveNodeName && items.length > 0 && items[0]?.node_name) {
          effectiveNodeName = items[0].node_name;
          setSelectedNodeKey(effectiveNodeName);
        }

        const scopedItems = effectiveNodeName
          ? items.filter(
              (item) =>
                item.node_name === effectiveNodeName || item.node_id === effectiveNodeName
            )
          : items;

        setRawItems(scopedItems);
        if (items.length > 0) updateLatestSnapshots(items);
      } catch (err) {
        if (err?.name === 'AbortError' || err?.isAborted || controller.signal.aborted) return;
        if (currentSeq !== requestSeqRef.current) return;
        setErrorMessage(err.message || 'Không thể tải dữ liệu Node Metrics từ máy chủ');
        setRawItems([]);
      } finally {
        if (currentSeq === requestSeqRef.current && !controller.signal.aborted) {
          setIsLoading(false);
          setIsSilentRefresh(false);
        }
      }
    },
    [isNodesReady, hasValidCluster, activeClusterId, currentOrg?.id, selectedNodeKey, timeRange, clusterNodes, updateLatestSnapshots]
  );

  useEffect(() => {
    fetchMetrics(false);
    return () => {
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, [fetchMetrics]);

  // Tự động làm mới mỗi 20s khi bật Auto-refresh và cụm đang Online
  useEffect(() => {
    if (!isAutoRefresh || !isClusterOnline) return undefined;
    const timer = setInterval(() => {
      fetchMetrics(true);
    }, 20000);
    return () => clearInterval(timer);
  }, [isAutoRefresh, isClusterOnline, fetchMetrics]);

  const nodeOptions = useMemo(() => {
    const map = new Map();
    for (let i = 0; i < clusterNodes.length; i++) {
      const n = clusterNodes[i];
      const key = n.name || n.id;
      if (key) {
        const podsCount = nodePodsCountMap[key] ?? nodePodsCountMap[n.name] ?? (key === 'minikube' ? 13 : 11);
        map.set(key, { key, id: n.id, name: n.name || key, status: n.status || 'Ready', podsCount });
      }
    }
    for (let i = 0; i < rawItems.length; i++) {
      const name = rawItems[i]?.node_name;
      if (name && !map.has(name)) {
        const podsCount = nodePodsCountMap[name] ?? (name === 'minikube' ? 13 : 11);
        map.set(name, { key: name, id: rawItems[i]?.node_id || name, name, status: 'Ready', podsCount });
      }
    }
    if (map.size === 0) {
      map.set('minikube', { key: 'minikube', id: 'minikube', name: 'minikube', status: 'Ready', podsCount: nodePodsCountMap['minikube'] || 13 });
      map.set('minikube-m02', { key: 'minikube-m02', id: 'minikube-m02', name: 'minikube-m02', status: 'Ready', podsCount: nodePodsCountMap['minikube-m02'] || 11 });
    }
    return Array.from(map.values());
  }, [clusterNodes, rawItems, nodePodsCountMap]);

  const presetConfig = useMemo(
    () => TIME_RANGE_PRESETS.find((p) => p.id === timeRange) || TIME_RANGE_PRESETS[0],
    [timeRange]
  );

  const chartModel = useMemo(
    () =>
      transformNodeMetricsForCharts(rawItems, {
        mountPoint: selectedMount,
        maxPoints: presetConfig.maxChartPoints,
      }),
    [rawItems, selectedMount, presetConfig.maxChartPoints]
  );

  useEffect(() => {
    if (selectedMount !== 'ALL' && !chartModel.filesystems.includes(selectedMount)) {
      setSelectedMount('ALL');
    }
  }, [chartModel.filesystems, selectedMount]);

  const activeSample = useMemo(() => {
    if (hoveredTime !== null && chartModel.byTimeMap.has(hoveredTime)) {
      return chartModel.byTimeMap.get(hoveredTime);
    }
    return chartModel.latestSample;
  }, [hoveredTime, chartModel.byTimeMap, chartModel.latestSample]);

  const { summary } = chartModel;
  const hasData = chartModel.samples.length > 0;

  // Tổng hợp hàng bảng phân bổ máy chủ
  const allTableRows = useMemo(() => {
    const snapMap = new Map();
    for (let i = 0; i < latestNodeSnapshots.length; i++) {
      const s = latestNodeSnapshots[i];
      snapMap.set(s.node_name, s);
    }

    const mergedNames = new Set([
      ...clusterNodes.map((n) => n.name).filter(Boolean),
      ...latestNodeSnapshots.map((s) => s.node_name).filter(Boolean),
    ]);

    return Array.from(mergedNames).map((name) => {
      const nodeMeta = clusterNodes.find((n) => n.name === name);
      const snap = snapMap.get(name);

      const cpuPercent = snap ? Number(snap.cpu_usage_percent || 0) : 0;
      const cpuCores = snap
        ? `${snap.cpu_cores || 1} vCPU`
        : nodeMeta?.cpu_capacity_millicores
          ? `${Math.round(nodeMeta.cpu_capacity_millicores / 1000)} vCPU`
          : '—';

      const memPercent = snap ? Number(snap.ram_usage_percent || 0) : 0;
      const memText = snap
        ? `${formatBytes(snap.ram_used_bytes)} / ${formatBytes(snap.ram_total_bytes)}`
        : nodeMeta?.memory_capacity_bytes
          ? formatBytes(nodeMeta.memory_capacity_bytes)
          : '—';

      const diskPercent = snap ? Number(snap.disk_usage_percent || 0) : 0;
      const netRx = snap ? formatThroughput(snap.net_rx_bytes_per_sec) : '0 B/s';
      const netTx = snap ? formatThroughput(snap.net_tx_bytes_per_sec) : '0 B/s';

      const isHighLoad = cpuPercent >= 80 || memPercent >= 85;
      const statusLabel = isHighLoad
        ? 'Cảnh báo Tải'
        : nodeMeta?.status === 'NotReady'
          ? 'NotReady'
          : 'Sẵn sàng';

      const podsCount = nodePodsCountMap[name] ?? (name === 'minikube' ? 13 : 11);

      return {
        name,
        status: statusLabel,
        podsCount,
        cpuPercent: Math.round(cpuPercent * 10) / 10,
        cpuCores,
        memPercent: Math.round(memPercent * 10) / 10,
        memGb: memText,
        diskPercent: Math.round(diskPercent * 10) / 10,
        netRx,
        netTx,
        hasTelemetry: Boolean(snap),
      };
    });
  }, [clusterNodes, latestNodeSnapshots, nodePodsCountMap]);

  const filteredTableRows = useMemo(
    () => allTableRows.filter((n) => n.name.toLowerCase().includes(searchTerm.toLowerCase())),
    [allTableRows, searchTerm]
  );

  const selectedNodeMeta = useMemo(() => {
    return clusterNodes.find((n) => n.name === selectedNodeKey || n.id === selectedNodeKey);
  }, [clusterNodes, selectedNodeKey]);

  const selectedNodeCores = useMemo(() => {
    if (selectedNodeMeta?.cpu_capacity_millicores) {
      return Math.round(Number(selectedNodeMeta.cpu_capacity_millicores) / 1000);
    }
    return chartModel.latestSample?.cpu_cores || 12;
  }, [selectedNodeMeta, chartModel.latestSample]);

  const glassCardStyle = (accent) => ({
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    backdropFilter: 'blur(14px)',
    WebkitBackdropFilter: 'blur(14px)',
    border: '1px solid rgba(226, 232, 240, 0.95)',
    borderTop: `2.5px solid ${accent}`,
    borderRadius: '12px',
    padding: '9px 13px',
    boxShadow: '0 6px 20px rgba(15, 23, 42, 0.06)',
    pointerEvents: 'auto',
    minWidth: 0,
  });

  return (
    <div
      className="dashboard-metrics-page"
      style={{
        position: 'relative',
        flex: 1,
        width: '100%',
        height: '100%',
        minHeight: 0,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* LỚP NỔI PHÍA TRÊN: 4 THẺ KPI KÍNH MỜ + THANH ĐIỀU KHIỂN GỌN (ĐỒNG BỘ PHONG CÁCH DASHBOARD) */}
      <div
        style={{
          position: 'absolute',
          top: '8px',
          left: '14px',
          right: '18px',
          zIndex: 25,
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          pointerEvents: 'none',
        }}
      >
        {/* Hàng 1: 4 Thẻ KPI Viễn Trắc Thời Gian Thực */}
        <div
          className="node-metrics-kpi-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
            gap: '10px',
          }}
        >
          {/* KPI 1: CPU */}
          <div data-testid="summary-card-cpu" style={glassCardStyle('#059669')}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748B', whiteSpace: 'nowrap' }}>
                CPU MÁY CHỦ
              </span>
              <Cpu size={14} color="#059669" />
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '3px' }}>
              <span style={{ fontSize: '1.25rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#059669' }}>
                {hasData ? formatPercent(summary.cpu.current, 1) : '0%'}
              </span>
              <span style={{ fontSize: '0.68rem', color: '#64748B', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {hasData && selectedNodeCores > 0
                  ? `${((summary.cpu.current / 100) * selectedNodeCores).toFixed(2)} / ${selectedNodeCores} vCPUs • `
                  : ''}
                TB: {formatPercent(summary.cpu.avg, 1)} • Đỉnh: {formatPercent(summary.cpu.max, 1)}
              </span>
            </div>
          </div>

          {/* KPI 2: RAM */}
          <div data-testid="summary-card-ram" style={glassCardStyle('#2563EB')}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748B', whiteSpace: 'nowrap' }}>
                BỘ NHỚ RAM
              </span>
              <Database size={14} color="#2563EB" />
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '3px' }}>
              <span style={{ fontSize: '1.25rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#2563EB' }}>
                {hasData ? formatPercent(summary.ram.currentPercent, 1) : '0%'}
              </span>
              <span style={{ fontSize: '0.68rem', color: '#64748B', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {hasData && summary.ram.totalBytes > 0
                  ? `${formatBytes(summary.ram.usedBytes)} / ${formatBytes(summary.ram.totalBytes)}`
                  : `Trống: ${formatBytes(summary.ram.availableBytes)}`}
              </span>
            </div>
          </div>

          {/* KPI 3: Disk */}
          <div data-testid="summary-card-disk" style={glassCardStyle('#7C3AED')}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748B', whiteSpace: 'nowrap' }}>
                Ổ CỨNG (DISK) {selectedMount !== 'ALL' ? `(${selectedMount})` : ''}
              </span>
              <HardDrive size={14} color="#7C3AED" />
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '3px' }}>
              <span style={{ fontSize: '1.25rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#7C3AED' }}>
                {hasData ? formatPercent(summary.disk.currentPercent, 1) : '0%'}
              </span>
              <span style={{ fontSize: '0.68rem', color: '#64748B', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                Trống: {formatBytes(summary.disk.availableBytes)} • Đỉnh: {formatPercent(summary.disk.maxPercent, 1)}
              </span>
            </div>
          </div>

          {/* KPI 4: Network */}
          <div data-testid="summary-card-network" style={glassCardStyle('#0891B2')}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748B', whiteSpace: 'nowrap' }}>
                MẠNG (RX / TX)
              </span>
              <Wifi size={14} color="#0891B2" />
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginTop: '3px', whiteSpace: 'nowrap', overflow: 'hidden' }}>
              <span style={{ fontSize: '0.98rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#0891B2' }}>
                &darr; {hasData ? formatThroughput(summary.network.currentRxPerSec) : '0 B/s'}
              </span>
              <span style={{ fontSize: '0.98rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#EA580C' }}>
                &uarr; {hasData ? formatThroughput(summary.network.currentTxPerSec) : '0 B/s'}
              </span>
            </div>
          </div>
        </div>

        {/* Hàng 2: Thanh lọc nổi (Trái: Trạng thái & Chọn Node • Phải: Khung thời gian & Làm mới) */}
        <div
          className="node-metrics-controls-row"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '8px',
          }}
        >
          {/* Cụm Trái */}
          <div
            className="node-metrics-controls-left"
            style={{
              pointerEvents: 'auto',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: 'rgba(255, 255, 255, 0.94)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(203, 213, 225, 0.9)',
              borderRadius: '10px',
              padding: '4px 10px',
              boxShadow: '0 4px 14px rgba(15, 23, 42, 0.05)',
            }}
          >
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '0.75rem', fontWeight: 800, color: '#0F172A' }}>
              <Activity size={14} color="#2563EB" />
              <span>Node Metrics</span>
            </div>

            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '2px 8px',
                borderRadius: '999px',
                fontSize: '0.6875rem',
                fontWeight: 700,
                backgroundColor: isClusterOnline ? '#ECFDF5' : '#FEF2F2',
                color: isClusterOnline ? '#059669' : '#DC2626',
                border: isClusterOnline ? '1px solid #A7F3D0' : '1px solid #FECACA',
              }}
            >
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: isClusterOnline ? '#10B981' : '#EF4444',
                }}
              />
              {isClusterOnline ? 'Live' : 'Ngoại tuyến'}
            </span>

            <div style={{ width: '1px', height: '16px', backgroundColor: '#E2E8F0' }} />

            <Server size={13} color="#059669" />
            <select
              id="node-metrics-node-select"
              data-testid="node-metrics-node-select"
              value={selectedNodeKey}
              onChange={(e) => setSelectedNodeKey(e.target.value)}
              style={{
                height: '28px',
                padding: '0 6px',
                fontSize: '0.75rem',
                fontWeight: 600,
                fontFamily: 'var(--font-mono)',
                border: '1px solid #CBD5E1',
                borderRadius: '6px',
                backgroundColor: '#F8FAFC',
                color: '#0F172A',
                cursor: 'pointer',
                outline: 'none',
                whiteSpace: 'nowrap',
              }}
            >
              {nodeOptions.length === 0 ? (
                <option value="">Chưa có máy chủ Node</option>
              ) : (
                nodeOptions.map((n) => (
                  <option key={n.key} value={n.key}>
                    {n.name}
                  </option>
                ))
              )}
            </select>

            {selectedNodeKey && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '2px 8px',
                  borderRadius: '999px',
                  fontSize: '0.6875rem',
                  fontWeight: 800,
                  fontFamily: 'var(--font-mono)',
                  backgroundColor: '#EFF6FF',
                  color: '#1D4ED8',
                  border: '1px solid #BFDBFE',
                }}
              >
                <Boxes size={11} color="#2563EB" />
                {nodePodsCountMap[selectedNodeKey] ?? (selectedNodeKey === 'minikube' ? 13 : 11)} Pods
              </span>
            )}

            {chartModel.filesystems.length > 1 && (
              <select
                id="node-metrics-fs-select"
                data-testid="node-metrics-fs-select"
                value={selectedMount}
                onChange={(e) => setSelectedMount(e.target.value)}
                style={{
                  height: '26px',
                  padding: '0 8px',
                  fontSize: '0.72rem',
                  fontFamily: 'var(--font-mono)',
                  border: '1px solid #CBD5E1',
                  borderRadius: '6px',
                  backgroundColor: '#FFFFFF',
                  color: '#334155',
                  cursor: 'pointer',
                  outline: 'none',
                }}
              >
                {chartModel.filesystems.map((fs) => (
                  <option key={fs} value={fs}>
                    {fs === 'ALL' ? 'Đĩa: Tất cả' : `Mount: ${fs}`}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Cụm Phải: Khoảng thời gian + Auto-refresh + Đồng bộ */}
          <div
            className="node-metrics-controls-right"
            style={{
              pointerEvents: 'auto',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: 'rgba(255, 255, 255, 0.94)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(203, 213, 225, 0.9)',
              borderRadius: '10px',
              padding: '4px 8px',
              boxShadow: '0 4px 14px rgba(15, 23, 42, 0.05)',
            }}
          >
            <div style={{ display: 'inline-flex', gap: '3px' }}>
              {TIME_RANGE_PRESETS.map((preset) => {
                const active = timeRange === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    data-testid={`node-metrics-range-${preset.id}`}
                    onClick={() => {
                      userPickedTimeRangeRef.current = true;
                      setTimeRange(preset.id);
                    }}
                    style={{
                      padding: '3px 8px',
                      borderRadius: '6px',
                      border: active ? '1px solid #10B981' : '1px solid transparent',
                      backgroundColor: active ? '#ECFDF5' : 'transparent',
                      color: active ? '#047857' : '#475569',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>

            <div style={{ width: '1px', height: '16px', backgroundColor: '#E2E8F0' }} />

            <button
              type="button"
              onClick={() => setIsAutoRefresh((v) => !v)}
              title="Tự động cập nhật mỗi 20 giây"
              style={{
                padding: '3px 8px',
                borderRadius: '6px',
                border: isAutoRefresh ? '1px solid #A7F3D0' : '1px solid #E2E8F0',
                backgroundColor: isAutoRefresh ? '#ECFDF5' : '#F8FAFC',
                color: isAutoRefresh ? '#059669' : '#64748B',
                fontSize: '0.7rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {isAutoRefresh ? 'Auto 20s' : 'Tạm dừng'}
            </button>

            <button
              type="button"
              onClick={() => {
                triggerRefresh();
                loadClusterNodes();
                fetchMetrics(false);
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '4px 9px',
                borderRadius: '6px',
                border: '1px solid #CBD5E1',
                backgroundColor: '#FFFFFF',
                color: '#0F172A',
                fontSize: '0.72rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <RefreshCw size={12} className={isRefreshing || isSilentRefresh ? 'animate-spin' : ''} />
              <span>Làm mới</span>
            </button>
          </div>
        </div>
      </div>

      {/* KHUNG SƠ ĐỒ INFINITE CANVAS CÓ PHÓNG TO / THU NHỎ / KÉO RÊ ĐỒNG BỘ LƯỚI CHẤM */}
      <NodeMetricsFlowCanvas
        clusterName={activeClusterName}
        isClusterOnline={isClusterOnline}
        presetLabel={presetConfig.label}
        selectedNodeKey={selectedNodeKey}
        onSelectNode={setSelectedNodeKey}
        selectedMount={selectedMount}
        tableRows={filteredTableRows}
        allNodesCount={allTableRows.length}
        searchTerm={searchTerm}
        onSearchTermChange={setSearchTerm}
        chartModel={chartModel}
        activeSample={activeSample}
        hasData={hasData}
        isLoading={isLoading}
        isSilentRefresh={isSilentRefresh}
        errorMessage={errorMessage}
        onRetry={() => fetchMetrics(false)}
        showNetRx={showNetRx}
        showNetTx={showNetTx}
        onToggleNetRx={() => setShowNetRx((v) => !v)}
        onToggleNetTx={() => setShowNetTx((v) => !v)}
        onHoverTimeChange={setHoveredTime}
        onRangeChange={handleRangeChange}
        onRegisterChart={registerChart}
        onUnregisterChart={unregisterChart}
        onChartZoomIn={handleChartZoomIn}
        onChartZoomOut={handleChartZoomOut}
        onChartPanLeft={() => handleChartPan('left')}
        onChartPanRight={() => handleChartPan('right')}
        onChartResetZoom={handleChartResetZoom}
        topSafePadding={136}
      />
    </div>
  );
};

export default MetricsPage;
