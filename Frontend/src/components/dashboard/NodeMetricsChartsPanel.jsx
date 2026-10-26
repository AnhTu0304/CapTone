import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  createChart,
  AreaSeries,
  LineSeries,
  ColorType,
  CrosshairMode,
  LineStyle,
} from 'lightweight-charts';
import {
  Cpu,
  HardDrive,
  Database,
  Activity,
  Wifi,
  RefreshCw,
  AlertTriangle,
  AlertCircle,
  Clock,
  Server,
  CheckCircle2,
} from 'lucide-react';
import { telemetryService } from '../../services/telemetryService';
import { nodeService } from '../../services/nodeService';
import {
  TIME_RANGE_PRESETS,
  buildTimeRangeBounds,
  transformNodeMetricsForCharts,
  formatBytes,
  formatThroughput,
  formatPercent,
} from '../../utils/nodeMetricsChartUtils';

/**
 * Format Unix seconds timestamp for chart axis and crosshair tooltip
 */
function formatUnixTime(unixSec, includeDate = false) {
  if (typeof unixSec !== 'number' || !Number.isFinite(unixSec)) return '';
  const d = new Date(unixSec * 1000);
  if (includeDate) {
    return d.toLocaleString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      day: '2-digit',
      month: '2-digit',
    });
  }
  return d.toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/**
 * Single `lightweight-charts` v5.2.1 Panel with strict lifecycle management:
 * - Instantiates chart ONCE on mount (`createChart`)
 * - Updates series via `setData()` without recreating chart instance
 * - Cleans up `ResizeObserver` and calls `chart.remove()` on unmount
 */
export const LightweightMetricChart = ({
  testId,
  primaryData = [],
  secondaryData = null,
  primaryColor = '#059669',
  primaryTopColor = 'rgba(5, 150, 105, 0.24)',
  primaryBottomColor = 'rgba(5, 150, 105, 0.02)',
  secondaryColor = '#EA580C',
  unitType = 'percent', // 'percent' | 'throughput'
  height = 220,
  onHoverTimeChange,
}) => {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const primarySeriesRef = useRef(null);
  const secondarySeriesRef = useRef(null);
  const onHoverRef = useRef(onHoverTimeChange);

  useEffect(() => {
    onHoverRef.current = onHoverTimeChange;
  }, [onHoverTimeChange]);

  // 1. Mount & Unmount lifecycle: create chart once, destroy on unmount
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    const valueFormatter = (val) => {
      if (!Number.isFinite(val)) return '0';
      if (unitType === 'throughput') {
        return formatThroughput(val, 1);
      }
      return `${val.toFixed(1)}%`;
    };

    let chart = null;
    let resizeObserver = null;
    let crosshairHandler = null;

    try {
      const initialWidth = Math.max(260, container.clientWidth || 420);
      chart = createChart(container, {
        width: initialWidth,
        height,
        layout: {
          background: { type: ColorType.Solid, color: '#FFFFFF' },
          textColor: '#475569',
          fontFamily: 'monospace',
          fontSize: 11,
        },
        grid: {
          vertLines: { color: '#F1F5F9', style: LineStyle.Dotted },
          horzLines: { color: '#F1F5F9', style: LineStyle.Dotted },
        },
        crosshair: {
          mode: CrosshairMode.Normal,
        },
        rightPriceScale: {
          borderColor: '#E2E8F0',
          scaleMargins: { top: 0.12, bottom: 0.08 },
        },
        timeScale: {
          borderColor: '#E2E8F0',
          timeVisible: true,
          secondsVisible: true,
          tickMarkFormatter: (time) =>
            typeof time === 'number' ? formatUnixTime(time, false) : String(time),
        },
        localization: {
          priceFormatter: valueFormatter,
          timeFormatter: (time) =>
            typeof time === 'number' ? formatUnixTime(time, true) : String(time),
        },
      });

      const primarySeries = chart.addSeries(AreaSeries, {
        lineColor: primaryColor,
        topColor: primaryTopColor,
        bottomColor: primaryBottomColor,
        lineWidth: 2,
        priceFormat: {
          type: 'custom',
          minMove: 0.01,
          formatter: valueFormatter,
        },
        autoscaleInfoProvider:
          unitType === 'percent'
            ? () => ({
                priceRange: { minValue: 0, maxValue: 100 },
              })
            : undefined,
      });

      primarySeriesRef.current = primarySeries;

      if (secondaryData !== null) {
        const secondarySeries = chart.addSeries(LineSeries, {
          color: secondaryColor,
          lineWidth: 2,
          priceFormat: {
            type: 'custom',
            minMove: 0.01,
            formatter: valueFormatter,
          },
        });
        secondarySeriesRef.current = secondarySeries;
      }

      crosshairHandler = (param) => {
        if (!param || param.time === undefined || !param.point) {
          if (onHoverRef.current) onHoverRef.current(null);
          return;
        }
        if (onHoverRef.current) {
          onHoverRef.current(Number(param.time));
        }
      };

      if (typeof chart.subscribeCrosshairMove === 'function') {
        chart.subscribeCrosshairMove(crosshairHandler);
      }

      if (typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver((entries) => {
          if (!entries || entries.length === 0 || !chartRef.current) return;
          const { width } = entries[0].contentRect;
          if (width > 0) {
            chartRef.current.applyOptions({ width: Math.floor(width) });
          }
        });
        resizeObserver.observe(container);
      }

      chartRef.current = chart;
    } catch (err) {
      // Safe fallback for environments without 2D Canvas support
      console.warn('[LightweightMetricChart] Chart init warning:', err.message);
    }

    return () => {
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      if (chart && crosshairHandler && typeof chart.unsubscribeCrosshairMove === 'function') {
        try {
          chart.unsubscribeCrosshairMove(crosshairHandler);
        } catch {}
      }
      primarySeriesRef.current = null;
      secondarySeriesRef.current = null;
      chartRef.current = null;
      if (chart && typeof chart.remove === 'function') {
        chart.remove();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2. Data update lifecycle: update series via setData without recreating chart
  useEffect(() => {
    if (!primarySeriesRef.current) return;
    try {
      primarySeriesRef.current.setData(Array.isArray(primaryData) ? primaryData : []);
      if (secondarySeriesRef.current && Array.isArray(secondaryData)) {
        secondarySeriesRef.current.setData(secondaryData);
      }
      if (chartRef.current && typeof chartRef.current.timeScale === 'function') {
        chartRef.current.timeScale().fitContent();
      }
    } catch (err) {
      console.warn('[LightweightMetricChart] setData warning:', err.message);
    }
  }, [primaryData, secondaryData]);

  return (
    <div
      ref={containerRef}
      data-testid={testId}
      style={{
        width: '100%',
        height: `${height}px`,
        position: 'relative',
        overflow: 'hidden',
      }}
    />
  );
};

/**
 * NodeMetricsChartsPanel
 * Complete Node Metrics Dashboard Section built on `lightweight-charts` v5.2.1.
 * Connects to Task 4.3 Backend Node Metrics Query APIs with:
 * - Node selector & Time Range selector (5m, 15m, 1h, 6h, 24h)
 * - Disk filesystem mount selector
 * - AbortController + request sequence race protection
 * - 4 dedicated panels (CPU %, RAM % & GiB, Disk % per mount, Network RX/TX throughput)
 * - Loading, Empty, Stale, Partial, and Error (with Retry) states
 */
export const NodeMetricsChartsPanel = ({
  orgId,
  clusterId,
  agentId,
  initialNodeName = '',
  nodesOverride = null,
  onRawItemsLoaded,
}) => {
  const [nodesList, setNodesList] = useState(Array.isArray(nodesOverride) ? nodesOverride : []);
  const [selectedNodeKey, setSelectedNodeKey] = useState(initialNodeName || '');
  const [timeRange, setTimeRange] = useState('15m');
  const [selectedMount, setSelectedMount] = useState('ALL');
  const [isAutoRefresh, setIsAutoRefresh] = useState(true);

  const [rawItems, setRawItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);
  const [hoveredTime, setHoveredTime] = useState(null);

  const abortControllerRef = useRef(null);
  const requestSeqRef = useRef(0);

  // Sync nodesOverride if provided by parent
  useEffect(() => {
    if (Array.isArray(nodesOverride)) {
      setNodesList(nodesOverride);
      if (nodesOverride.length > 0) {
        setSelectedNodeKey((prev) => {
          if (prev && nodesOverride.some((n) => n.name === prev || n.id === prev)) {
            return prev;
          }
          return nodesOverride[0].name || nodesOverride[0].id || '';
        });
      }
    }
  }, [nodesOverride]);

  // 1. Load cluster nodes list when clusterId changes
  useEffect(() => {
    if (Array.isArray(nodesOverride)) return undefined;
    let cancelled = false;

    async function loadNodes() {
      if (!clusterId || clusterId.startsWith('org-') || clusterId.startsWith('sandbox-')) {
        setNodesList([]);
        return;
      }
      try {
        const list = await nodeService.getNodesByCluster(clusterId, orgId);
        if (!cancelled && Array.isArray(list)) {
          setNodesList(list);
          if (list.length > 0) {
            setSelectedNodeKey((prev) => {
              if (prev && list.some((n) => n.name === prev || n.id === prev)) {
                return prev;
              }
              return list[0].name || list[0].id || '';
            });
          }
        }
      } catch (err) {
        if (!cancelled) {
          console.warn('[NodeMetricsChartsPanel] Lỗi tải danh sách Nodes:', err.message);
        }
      }
    }

    loadNodes();
    return () => {
      cancelled = true;
    };
  }, [clusterId, orgId, nodesOverride]);

  // 2. Fetch Node Metrics with AbortController & Sequence Guard
  const fetchMetrics = useCallback(
    async (silent = false) => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;
      const currentSeq = ++requestSeqRef.current;

      if (!silent) {
        setIsLoading(true);
      }
      setErrorMessage(null);

      try {
        const bounds = buildTimeRangeBounds(timeRange, Date.now());
        const matchedNode = nodesList.find(
          (n) => n.name === selectedNodeKey || n.id === selectedNodeKey
        );

        const result = await telemetryService.getNodeMetrics(
          {
            orgId,
            clusterId,
            agentId,
            nodeId: matchedNode?.id || selectedNodeKey || undefined,
            nodeName: matchedNode?.name || selectedNodeKey || undefined,
            from: bounds.from,
            to: bounds.to,
            limit: bounds.limit,
            order: 'desc',
          },
          { signal: controller.signal }
        );

        // Ignore stale response if a newer request was already triggered
        if (currentSeq !== requestSeqRef.current || controller.signal.aborted) {
          return;
        }

        const items = Array.isArray(result?.items) ? result.items : [];

        // If no node was selected yet and items contain node_name, lock onto the first node
        // so time-series charts always represent a single coherent host node.
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
        if (onRawItemsLoaded) {
          onRawItemsLoaded(items);
        }
      } catch (err) {
        if (err?.name === 'AbortError' || err?.isAborted || controller.signal.aborted) {
          return;
        }
        if (currentSeq !== requestSeqRef.current) {
          return;
        }
        setErrorMessage(err.message || 'Không thể tải dữ liệu Node Metrics từ máy chủ');
        setRawItems([]);
      } finally {
        if (currentSeq === requestSeqRef.current && !controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    },
    [orgId, clusterId, agentId, selectedNodeKey, timeRange, nodesList, onRawItemsLoaded]
  );

  useEffect(() => {
    fetchMetrics(false);
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchMetrics]);

  // Auto-refresh interval (every 15s when enabled)
  useEffect(() => {
    if (!isAutoRefresh) return undefined;
    const timer = setInterval(() => {
      fetchMetrics(true);
    }, 15000);
    return () => clearInterval(timer);
  }, [isAutoRefresh, fetchMetrics]);

  // Available nodes for selector (merge cluster nodes + distinct nodes seen in rawItems)
  const nodeOptions = useMemo(() => {
    const map = new Map();
    for (let i = 0; i < nodesList.length; i++) {
      const n = nodesList[i];
      const key = n.name || n.id;
      if (key) {
        map.set(key, {
          key,
          id: n.id,
          name: n.name || key,
          status: n.status || 'Ready',
        });
      }
    }
    for (let i = 0; i < rawItems.length; i++) {
      const name = rawItems[i]?.node_name;
      if (name && !map.has(name)) {
        map.set(name, {
          key: name,
          id: rawItems[i]?.node_id || name,
          name,
          status: 'Ready',
        });
      }
    }
    return Array.from(map.values());
  }, [nodesList, rawItems]);

  // Transform raw metrics for the 4 lightweight-charts panels
  const presetConfig = useMemo(
    () => TIME_RANGE_PRESETS.find((p) => p.id === timeRange) || TIME_RANGE_PRESETS[1],
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

  // Reset selectedMount to 'ALL' if the chosen mount no longer exists in the current node's filesystems
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

  return (
    <div
      className="node-metrics-charts-panel"
      data-testid="node-metrics-charts-panel"
      style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}
    >
      {/* 1. Filter & Control Bar */}
      <div
        className="dash-card"
        style={{
          padding: '16px 20px',
          backgroundColor: '#FFFFFF',
          border: '1px solid var(--dash-border, #E2E8F0)',
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '14px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Server size={18} color="var(--dash-primary, #059669)" />
            <label
              htmlFor="node-metrics-node-select"
              style={{
                fontSize: '0.8125rem',
                fontWeight: 700,
                color: 'var(--dash-text-primary, #0F172A)',
              }}
            >
              Máy chủ (Node):
            </label>
            <select
              id="node-metrics-node-select"
              data-testid="node-metrics-node-select"
              value={selectedNodeKey}
              onChange={(e) => setSelectedNodeKey(e.target.value)}
              style={{
                height: '34px',
                padding: '0 12px',
                fontSize: '0.8125rem',
                fontWeight: 600,
                fontFamily: 'var(--font-mono, monospace)',
                border: '1px solid var(--dash-border, #CBD5E1)',
                borderRadius: '6px',
                backgroundColor: '#F8FAFC',
                color: '#0F172A',
                cursor: 'pointer',
              }}
            >
              {nodeOptions.length === 0 ? (
                <option value="">Tất cả máy chủ trong cụm</option>
              ) : (
                nodeOptions.map((n) => (
                  <option key={n.key} value={n.key}>
                    {n.name} ({n.status})
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Disk Filesystem Mount Selector */}
          {chartModel.filesystems.length > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <label
                htmlFor="node-metrics-fs-select"
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: 'var(--dash-text-secondary, #64748B)',
                }}
              >
                Phân vùng Đĩa:
              </label>
              <select
                id="node-metrics-fs-select"
                data-testid="node-metrics-fs-select"
                value={selectedMount}
                onChange={(e) => setSelectedMount(e.target.value)}
                style={{
                  height: '34px',
                  padding: '0 10px',
                  fontSize: '0.75rem',
                  fontFamily: 'var(--font-mono, monospace)',
                  border: '1px solid var(--dash-border, #CBD5E1)',
                  borderRadius: '6px',
                  backgroundColor: '#FFFFFF',
                  color: '#334155',
                }}
              >
                {chartModel.filesystems.map((fs) => (
                  <option key={fs} value={fs}>
                    {fs === 'ALL' ? 'Tất cả (Tổng hợp)' : `Mount: ${fs}`}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Time Range + Auto-refresh + Manual Refresh */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div
            role="group"
            aria-label="Khoảng thời gian"
            style={{
              display: 'flex',
              backgroundColor: '#F1F5F9',
              padding: '3px',
              borderRadius: '8px',
              border: '1px solid #E2E8F0',
            }}
          >
            {TIME_RANGE_PRESETS.map((preset) => {
              const active = timeRange === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  data-testid={`node-metrics-range-${preset.id}`}
                  onClick={() => setTimeRange(preset.id)}
                  style={{
                    padding: '5px 10px',
                    fontFamily: 'var(--font-mono, monospace)',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    backgroundColor: active ? '#FFFFFF' : 'transparent',
                    color: active ? '#059669' : '#64748B',
                    border: 'none',
                    borderRadius: '6px',
                    boxShadow: active ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                    cursor: 'pointer',
                  }}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            data-testid="node-metrics-autorefresh-toggle"
            onClick={() => setIsAutoRefresh((v) => !v)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 10px',
              fontSize: '0.75rem',
              fontWeight: 700,
              borderRadius: '6px',
              border: isAutoRefresh ? '1px solid #A7F3D0' : '1px solid #CBD5E1',
              backgroundColor: isAutoRefresh ? '#ECFDF5' : '#F8FAFC',
              color: isAutoRefresh ? '#059669' : '#64748B',
              cursor: 'pointer',
            }}
          >
            <span
              style={{
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                backgroundColor: isAutoRefresh ? '#10B981' : '#94A3B8',
              }}
            />
            <span>Auto 15s</span>
          </button>

          <button
            type="button"
            data-testid="node-metrics-refresh-btn"
            onClick={() => fetchMetrics(false)}
            disabled={isLoading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              fontSize: '0.75rem',
              fontWeight: 700,
              borderRadius: '6px',
              border: '1px solid var(--dash-border, #CBD5E1)',
              backgroundColor: '#FFFFFF',
              color: '#0F172A',
              cursor: isLoading ? 'not-allowed' : 'pointer',
            }}
          >
            <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
            <span>Làm mới</span>
          </button>
        </div>
      </div>

      {/* 2. Stale / Partial Collection Warning Banners */}
      {hasData && summary.isStale && (
        <div
          data-testid="node-metrics-stale-banner"
          style={{
            padding: '10px 16px',
            backgroundColor: '#FFFBEB',
            border: '1px solid #FDE68A',
            borderRadius: '8px',
            color: '#92400E',
            fontSize: '0.8125rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Clock size={16} color="#D97706" />
          <span>
            <strong>Dữ liệu cũ (Stale Metrics):</strong> Mẫu gần nhất được ghi nhận lúc{' '}
            <code>{formatUnixTime(chartModel.latestSample.time, true)}</code>. Agent có thể đã tạm dừng gửi telemetry.
          </span>
        </div>
      )}

      {hasData && summary.isPartial && (
        <div
          data-testid="node-metrics-partial-banner"
          style={{
            padding: '10px 16px',
            backgroundColor: '#EFF6FF',
            border: '1px solid #BFDBFE',
            borderRadius: '8px',
            color: '#1E40AF',
            fontSize: '0.8125rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <AlertTriangle size={16} color="#2563EB" />
          <span>
            <strong>Thu thập một phần (PARTIAL):</strong> Một số chỉ số phần cứng không đọc được trên mẫu gần nhất.
          </span>
        </div>
      )}

      {/* 3. Summary KPI Cards (4 Core Resource Groups) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
          gap: '14px',
        }}
      >
        {/* Card 1: CPU */}
        <div
          className="dash-card"
          data-testid="summary-card-cpu"
          style={{
            padding: '16px',
            backgroundColor: '#FFFFFF',
            border: '1px solid var(--dash-border, #E2E8F0)',
            borderRadius: '10px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748B' }}>
              CPU UTILIZATION
            </span>
            <Cpu size={16} color="#059669" />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '6px' }}>
            <span
              style={{
                fontSize: '1.5rem',
                fontWeight: 800,
                fontFamily: 'var(--font-mono, monospace)',
                color: summary.cpu.current >= 80 ? '#E11D48' : '#0F172A',
              }}
            >
              {hasData ? formatPercent(summary.cpu.current, 1) : '—'}
            </span>
            {hasData && (
              <span style={{ fontSize: '0.75rem', color: '#059669', fontWeight: 600 }}>
                {summary.cpu.cores} vCPU Cores
              </span>
            )}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '6px', fontFamily: 'var(--font-mono, monospace)' }}>
            TB: {formatPercent(summary.cpu.avg, 1)} &bull; Đỉnh: {formatPercent(summary.cpu.max, 1)}
          </div>
        </div>

        {/* Card 2: RAM */}
        <div
          className="dash-card"
          data-testid="summary-card-ram"
          style={{
            padding: '16px',
            backgroundColor: '#FFFFFF',
            border: '1px solid var(--dash-border, #E2E8F0)',
            borderRadius: '10px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748B' }}>
              BỘ NHỚ RAM (USED / TOTAL)
            </span>
            <Database size={16} color="#2563EB" />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '6px' }}>
            <span
              style={{
                fontSize: '1.5rem',
                fontWeight: 800,
                fontFamily: 'var(--font-mono, monospace)',
                color: summary.ram.currentPercent >= 85 ? '#E11D48' : '#0F172A',
              }}
            >
              {hasData ? formatPercent(summary.ram.currentPercent, 1) : '—'}
            </span>
            {hasData && (
              <span style={{ fontSize: '0.75rem', color: '#2563EB', fontWeight: 600 }}>
                {formatBytes(summary.ram.usedBytes)} / {formatBytes(summary.ram.totalBytes)}
              </span>
            )}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '6px', fontFamily: 'var(--font-mono, monospace)' }}>
            Khả dụng: {formatBytes(summary.ram.availableBytes)} &bull; Đỉnh: {formatPercent(summary.ram.maxPercent, 1)}
          </div>
        </div>

        {/* Card 3: Disk */}
        <div
          className="dash-card"
          data-testid="summary-card-disk"
          style={{
            padding: '16px',
            backgroundColor: '#FFFFFF',
            border: '1px solid var(--dash-border, #E2E8F0)',
            borderRadius: '10px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748B' }}>
              DUNG LƯỢNG ĐĨA ({selectedMount === 'ALL' ? 'TỔNG HỢP' : selectedMount})
            </span>
            <HardDrive size={16} color="#7C3AED" />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '6px' }}>
            <span
              style={{
                fontSize: '1.5rem',
                fontWeight: 800,
                fontFamily: 'var(--font-mono, monospace)',
                color: summary.disk.currentPercent >= 85 ? '#E11D48' : '#0F172A',
              }}
            >
              {hasData ? formatPercent(summary.disk.currentPercent, 1) : '—'}
            </span>
            {hasData && (
              <span style={{ fontSize: '0.75rem', color: '#7C3AED', fontWeight: 600 }}>
                {formatBytes(summary.disk.usedBytes)} / {formatBytes(summary.disk.totalBytes)}
              </span>
            )}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '6px', fontFamily: 'var(--font-mono, monospace)' }}>
            Trống: {formatBytes(summary.disk.availableBytes)} &bull; Đỉnh: {formatPercent(summary.disk.maxPercent, 1)}
          </div>
        </div>

        {/* Card 4: Network I/O Throughput */}
        <div
          className="dash-card"
          data-testid="summary-card-network"
          style={{
            padding: '16px',
            backgroundColor: '#FFFFFF',
            border: '1px solid var(--dash-border, #E2E8F0)',
            borderRadius: '10px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748B' }}>
              BĂNG THÔNG MẠNG (RX / TX RATE)
            </span>
            <Wifi size={16} color="#0891B2" />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginTop: '6px', flexWrap: 'wrap' }}>
            <span
              style={{
                fontSize: '1.125rem',
                fontWeight: 800,
                fontFamily: 'var(--font-mono, monospace)',
                color: '#0891B2',
              }}
            >
              &darr; {hasData ? formatThroughput(summary.network.currentRxPerSec) : '0 B/s'}
            </span>
            <span
              style={{
                fontSize: '1.125rem',
                fontWeight: 800,
                fontFamily: 'var(--font-mono, monospace)',
                color: '#EA580C',
              }}
            >
              &uarr; {hasData ? formatThroughput(summary.network.currentTxPerSec) : '0 B/s'}
            </span>
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '6px', fontFamily: 'var(--font-mono, monospace)' }}>
            Tích lũy: RX {formatBytes(summary.network.totalRxBytes)} &bull; TX {formatBytes(summary.network.totalTxBytes)}
          </div>
        </div>
      </div>

      {/* 4. Error / Empty / Loading States or 4 Lightweight Charts Grid */}
      {errorMessage ? (
        <div
          className="dash-card"
          data-testid="node-metrics-error-state"
          style={{
            padding: '36px 24px',
            backgroundColor: '#FEF2F2',
            border: '1px solid #FECACA',
            borderRadius: '12px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <AlertCircle size={32} color="#DC2626" />
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#991B1B' }}>
            Không thể tải biểu đồ Node Metrics
          </h3>
          <p style={{ margin: 0, fontSize: '0.8125rem', color: '#7F1D1D', maxWidth: '480px' }}>
            {errorMessage}
          </p>
          <button
            type="button"
            data-testid="node-metrics-retry-btn"
            onClick={() => fetchMetrics(false)}
            style={{
              padding: '8px 16px',
              backgroundColor: '#DC2626',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '6px',
              fontSize: '0.8125rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Thử lại
          </button>
        </div>
      ) : !isLoading && !hasData ? (
        <div
          className="dash-card"
          data-testid="node-metrics-empty-state"
          style={{
            padding: '44px 24px',
            backgroundColor: '#FFFFFF',
            border: '1px solid var(--dash-border, #E2E8F0)',
            borderRadius: '12px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '10px',
          }}
        >
          <Activity size={32} color="#64748B" />
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#1E293B' }}>
            Chưa có dữ liệu Node Metrics trong khoảng thời gian đã chọn
          </h3>
          <p style={{ margin: 0, fontSize: '0.8125rem', color: '#64748B', maxWidth: '520px' }}>
            Hệ thống không ghi nhận mẫu dữ liệu nào cho máy chủ{' '}
            <strong>{selectedNodeKey || 'đang chọn'}</strong> trong cửa sổ{' '}
            <strong>{presetConfig.label}</strong>. Hãy mở rộng khoảng thời gian (vd: 6 giờ, 24 giờ) hoặc kiểm tra kết nối của Agent.
          </p>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(440px, 1fr))',
            gap: '18px',
            position: 'relative',
          }}
        >
          {/* Panel 1: CPU Utilization (%) */}
          <div
            className="dash-card"
            data-testid="chart-panel-cpu"
            style={{
              padding: '18px',
              backgroundColor: '#FFFFFF',
              border: '1px solid var(--dash-border, #E2E8F0)',
              borderRadius: '12px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Cpu size={16} color="#059669" />
                  <h4 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 700, color: '#0F172A' }}>
                    CPU Utilization (%)
                  </h4>
                </div>
                <span style={{ fontSize: '0.75rem', color: '#64748B' }}>
                  Tỷ lệ sử dụng CPU toàn máy chủ (0–100%)
                </span>
              </div>
              {activeSample && (
                <div style={{ textAlign: 'right', fontFamily: 'var(--font-mono, monospace)', fontSize: '0.75rem' }}>
                  <div style={{ fontWeight: 800, color: '#059669' }}>
                    {formatPercent(activeSample.cpu_usage_percent, 1)} ({activeSample.cpu_cores} vCPU)
                  </div>
                  <div style={{ color: '#94A3B8', fontSize: '0.6875rem' }}>
                    {formatUnixTime(activeSample.time, false)}
                  </div>
                </div>
              )}
            </div>
            <LightweightMetricChart
              testId="lwc-cpu-chart"
              primaryData={chartModel.cpuSeries}
              primaryColor="#059669"
              primaryTopColor="rgba(5, 150, 105, 0.25)"
              primaryBottomColor="rgba(5, 150, 105, 0.02)"
              unitType="percent"
              height={220}
              onHoverTimeChange={setHoveredTime}
            />
          </div>

          {/* Panel 2: RAM Usage (% & GiB) */}
          <div
            className="dash-card"
            data-testid="chart-panel-ram"
            style={{
              padding: '18px',
              backgroundColor: '#FFFFFF',
              border: '1px solid var(--dash-border, #E2E8F0)',
              borderRadius: '12px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Database size={16} color="#2563EB" />
                  <h4 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 700, color: '#0F172A' }}>
                    RAM Usage (% &amp; Dung lượng thực)
                  </h4>
                </div>
                <span style={{ fontSize: '0.75rem', color: '#64748B' }}>
                  Bộ nhớ vật lý đã dùng và khả dụng trên Node
                </span>
              </div>
              {activeSample && (
                <div style={{ textAlign: 'right', fontFamily: 'var(--font-mono, monospace)', fontSize: '0.75rem' }}>
                  <div style={{ fontWeight: 800, color: '#2563EB' }}>
                    {formatPercent(activeSample.ram_usage_percent, 1)} ({formatBytes(activeSample.ram_used_bytes)} / {formatBytes(activeSample.ram_total_bytes)})
                  </div>
                  <div style={{ color: '#94A3B8', fontSize: '0.6875rem' }}>
                    Khả dụng: {formatBytes(activeSample.ram_available_bytes)}
                  </div>
                </div>
              )}
            </div>
            <LightweightMetricChart
              testId="lwc-ram-chart"
              primaryData={chartModel.ramSeries}
              primaryColor="#2563EB"
              primaryTopColor="rgba(37, 99, 235, 0.24)"
              primaryBottomColor="rgba(37, 99, 235, 0.02)"
              unitType="percent"
              height={220}
              onHoverTimeChange={setHoveredTime}
            />
          </div>

          {/* Panel 3: Disk Usage (%) */}
          <div
            className="dash-card"
            data-testid="chart-panel-disk"
            style={{
              padding: '18px',
              backgroundColor: '#FFFFFF',
              border: '1px solid var(--dash-border, #E2E8F0)',
              borderRadius: '12px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <HardDrive size={16} color="#7C3AED" />
                  <h4 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 700, color: '#0F172A' }}>
                    Disk Usage (%) {selectedMount !== 'ALL' ? `[${selectedMount}]` : ''}
                  </h4>
                </div>
                <span style={{ fontSize: '0.75rem', color: '#64748B' }}>
                  Mức chiếm dụng ổ cứng theo phân vùng (không cộng dồn %)
                </span>
              </div>
              {activeSample && (
                <div style={{ textAlign: 'right', fontFamily: 'var(--font-mono, monospace)', fontSize: '0.75rem' }}>
                  <div style={{ fontWeight: 800, color: '#7C3AED' }}>
                    {formatPercent(activeSample.disk_usage_percent, 1)} ({formatBytes(activeSample.disk_used_bytes)} / {formatBytes(activeSample.disk_total_bytes)})
                  </div>
                  <div style={{ color: '#94A3B8', fontSize: '0.6875rem' }}>
                    Trống: {formatBytes(activeSample.disk_available_bytes)}
                  </div>
                </div>
              )}
            </div>
            <LightweightMetricChart
              testId="lwc-disk-chart"
              primaryData={chartModel.diskSeries}
              primaryColor="#7C3AED"
              primaryTopColor="rgba(124, 58, 237, 0.22)"
              primaryBottomColor="rgba(124, 58, 237, 0.02)"
              unitType="percent"
              height={220}
              onHoverTimeChange={setHoveredTime}
            />
          </div>

          {/* Panel 4: Network I/O Throughput (RX / TX per sec) */}
          <div
            className="dash-card"
            data-testid="chart-panel-network"
            style={{
              padding: '18px',
              backgroundColor: '#FFFFFF',
              border: '1px solid var(--dash-border, #E2E8F0)',
              borderRadius: '12px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Wifi size={16} color="#0891B2" />
                  <h4 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 700, color: '#0F172A' }}>
                    Network I/O Throughput (RX / TX Rate)
                  </h4>
                </div>
                <span style={{ fontSize: '0.75rem', color: '#64748B' }}>
                  Tốc độ truyền nhận mỗi giây (&darr; Inbound RX màu xanh &bull; &uarr; Outbound TX màu cam)
                </span>
              </div>
              {activeSample && (
                <div style={{ textAlign: 'right', fontFamily: 'var(--font-mono, monospace)', fontSize: '0.75rem' }}>
                  <div style={{ fontWeight: 800 }}>
                    <span style={{ color: '#0891B2' }}>
                      &darr; {formatThroughput(activeSample.net_rx_bytes_per_sec)}
                    </span>{' '}
                    &bull;{' '}
                    <span style={{ color: '#EA580C' }}>
                      &uarr; {formatThroughput(activeSample.net_tx_bytes_per_sec)}
                    </span>
                  </div>
                  <div style={{ color: '#94A3B8', fontSize: '0.6875rem' }}>
                    Counter: RX {formatBytes(activeSample.net_rx_bytes)} / TX {formatBytes(activeSample.net_tx_bytes)}
                  </div>
                </div>
              )}
            </div>
            <LightweightMetricChart
              testId="lwc-network-chart"
              primaryData={chartModel.netRxSeries}
              secondaryData={chartModel.netTxSeries}
              primaryColor="#0891B2"
              primaryTopColor="rgba(8, 145, 178, 0.22)"
              primaryBottomColor="rgba(8, 145, 178, 0.02)"
              secondaryColor="#EA580C"
              unitType="throughput"
              height={220}
              onHoverTimeChange={setHoveredTime}
            />
          </div>
        </div>
      )}

      {/* Footer Metadata Bar */}
      {hasData && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '8px',
            fontSize: '0.75rem',
            color: '#64748B',
            fontFamily: 'var(--font-mono, monospace)',
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
            <CheckCircle2 size={13} color="#059669" />
            Node: <strong>{chartModel.latestSample?.node_name}</strong> &bull; Hiển thị{' '}
            <strong>{summary.plottedCount}</strong> / {summary.rawCount} mẫu (Lightweight Charts v5.2.1)
          </span>
          <span>
            Cập nhật mẫu cuối: {formatUnixTime(chartModel.latestSample?.time, true)}
          </span>
        </div>
      )}
    </div>
  );
};

export default NodeMetricsChartsPanel;
