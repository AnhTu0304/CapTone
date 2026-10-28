import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  createChart,
  AreaSeries,
  LineSeries,
  ColorType,
  CrosshairMode,
  LineStyle,
} from 'lightweight-charts';
import { 
  Activity, 
  Cpu, 
  HardDrive, 
  AlertTriangle, 
  AlertCircle, 
  ZoomIn, 
  RefreshCw,
  Maximize2
} from 'lucide-react';

/**
 * Utility: Extract Unix timestamp in seconds (UTCTimestamp) from data point
 */
function extractTimestamp(item, index, totalItems) {
  if (typeof item.timestamp === 'number' && Number.isFinite(item.timestamp)) {
    return Math.floor(item.timestamp / 1000);
  }
  if (item.time_bucket) {
    const parsed = new Date(item.time_bucket).getTime();
    if (!isNaN(parsed)) return Math.floor(parsed / 1000);
  }
  if (item.time && typeof item.time === 'string') {
    const parts = item.time.split(':');
    if (parts.length >= 2) {
      const now = new Date();
      now.setHours(parseInt(parts[0], 10), parseInt(parts[1], 10), parseInt(parts[2] || '0', 10), 0);
      return Math.floor(now.getTime() / 1000);
    }
  }
  // Fallback: monotonic ascending timestamps in seconds
  const baseTime = Math.floor(Date.now() / 1000) - (totalItems - index) * 5;
  return baseTime;
}

/**
 * Utility: Sanitize and sort points to ensure strictly increasing UTCTimestamps
 */
function sanitizeSeriesData(items, valueKey) {
  if (!Array.isArray(items) || items.length === 0) return [];
  
  const mapped = items.map((item, idx) => ({
    time: extractTimestamp(item, idx, items.length),
    value: Number(item[valueKey]) || 0,
    rawItem: item,
  }));

  mapped.sort((a, b) => a.time - b.time);

  const deduped = [];
  let lastTime = -1;
  for (const pt of mapped) {
    let t = pt.time;
    if (t <= lastTime) {
      t = lastTime + 1;
    }
    lastTime = t;
    deduped.push({
      time: t,
      value: pt.value,
      rawItem: pt.rawItem,
    });
  }

  return deduped;
}

/**
 * InteractiveResourceChart
 * Production-ready, React 19 native interactive telemetry chart powered by TradingView's lightweight-charts v5.2.1.
 * Features:
 * - High-DPI Canvas rendering with AreaSeries (CPU) and LineSeries (RAM)
 * - Auto-scale (Zoom) mode vs Standard (0-100%) mode toggle for micro-variation tracking
 * - Crosshair vertical tracking line with synchronized coordinate projection
 * - Detailed floating tooltip showing both percentages and real physical units (vCPU, MB/GB RSS)
 * - Series toggles (CPU / RAM) & Fit Content button
 * - Time range selector (15 phút, 1 giờ, 6 giờ, 24 giờ)
 * - Summary statistics (Min, Max, Trung bình)
 * - MAPE-K Autonomous Loop monitoring card
 */
export const InteractiveResourceChart = ({
  data: initialData,
  totalCpuCores = 12,
  totalMemoryGb = 8,
  title = 'Biến thiên Tài nguyên Cụm máy chủ (CPU & RAM)',
  subtitle = 'Dữ liệu viễn trắc đo đạc từ các DaemonSet eBPF theo thời gian thực',
  className = '',
  height = 280,
  timeRange = '15m',
  onTimeRangeChange,
  isLive = false,
  isStale = false,
  isClusterOnline = true,
  isLoading = false,
  error = null,
  onRetry,
}) => {
  const [internalTimeRange, setInternalTimeRange] = useState(timeRange);
  const [showCpu, setShowCpu] = useState(true);
  const [showRam, setShowRam] = useState(true);
  const [showThreshold] = useState(true);
  const [scaleMode, setScaleMode] = useState('auto'); // 'auto' | 'standard'
  const [hoverData, setHoverData] = useState(null);

  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const cpuSeriesRef = useRef(null);
  const ramSeriesRef = useRef(null);
  const thresholdLineRef = useRef(null);

  const selectedRange = onTimeRangeChange ? timeRange : internalTimeRange;

  const handleRangeClick = (rangeId) => {
    if (onTimeRangeChange) {
      onTimeRangeChange(rangeId);
    } else {
      setInternalTimeRange(rangeId);
    }
  };

  // Telemetry data points with fallback if loading
  const telemetryData = useMemo(() => {
    if (initialData && Array.isArray(initialData) && initialData.length > 0) {
      return initialData;
    }
    return [];
  }, [initialData]);

  // Stats calculation
  const stats = useMemo(() => {
    if (telemetryData.length === 0) {
      return { hasData: false, avgCpu: 0, maxCpu: 0, minCpu: 0, avgRam: 0, maxRam: 0, minRam: 0, avgRamMb: 0, maxRamMb: 0 };
    }
    const cpus = telemetryData.map((d) => Number(d.cpu) || 0);
    const rams = telemetryData.map((d) => Number(d.ram) || 0);
    const ramMbs = telemetryData.map((d) => Number(d.rawRamMb) || 0);

    const avgCpu = Math.round((cpus.reduce((a, b) => a + b, 0) / cpus.length) * 100) / 100;
    const maxCpu = Math.round(Math.max(...cpus) * 100) / 100;
    const minCpu = Math.round(Math.min(...cpus) * 100) / 100;

    const avgRam = Math.round((rams.reduce((a, b) => a + b, 0) / rams.length) * 100) / 100;
    const maxRam = Math.round(Math.max(...rams) * 100) / 100;
    const minRam = Math.round(Math.min(...rams) * 100) / 100;

    const avgRamMb = ramMbs.length > 0 ? Math.round((ramMbs.reduce((a, b) => a + b, 0) / ramMbs.length) * 10) / 10 : 0;
    const maxRamMb = ramMbs.length > 0 ? Math.round(Math.max(...ramMbs) * 10) / 10 : 0;

    return { hasData: true, avgCpu, maxCpu, minCpu, avgRam, maxRam, minRam, avgRamMb, maxRamMb };
  }, [telemetryData]);

  // Clean data series for lightweight-charts
  const sanitizedCpuData = useMemo(() => sanitizeSeriesData(telemetryData, 'cpu'), [telemetryData]);
  const sanitizedRamData = useMemo(() => sanitizeSeriesData(telemetryData, 'ram'), [telemetryData]);

  // Value formatter for percent
  const valueFormatter = useCallback((val) => {
    if (!Number.isFinite(val)) return '0.00%';
    return val < 1 && val > 0 ? `${val.toFixed(2)}%` : `${val.toFixed(1)}%`;
  }, []);

  // Time formatter for unix timestamp
  const timeFormatter = useCallback((time) => {
    if (typeof time === 'number') {
      const d = new Date(time * 1000);
      return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }
    return String(time);
  }, []);

  // Reset / Fit Content
  const handleFitContent = useCallback(() => {
    if (chartRef.current) {
      chartRef.current.timeScale().fitContent();
    }
  }, []);

  // Toggle Series Visibility
  const toggleCpuSeries = useCallback(() => {
    setShowCpu((prev) => {
      const next = !prev;
      if (cpuSeriesRef.current && typeof cpuSeriesRef.current.applyOptions === 'function') {
        cpuSeriesRef.current.applyOptions({ visible: next });
      }
      return next;
    });
  }, []);

  const toggleRamSeries = useCallback(() => {
    setShowRam((prev) => {
      const next = !prev;
      if (ramSeriesRef.current && typeof ramSeriesRef.current.applyOptions === 'function') {
        ramSeriesRef.current.applyOptions({ visible: next });
      }
      return next;
    });
  }, []);

  // Initialize and manage lightweight-charts instance
  useEffect(() => {
    const container = containerRef.current;
    if (!container || telemetryData.length === 0 || isLoading || error || !isClusterOnline) {
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
        cpuSeriesRef.current = null;
        ramSeriesRef.current = null;
      }
      return undefined;
    }

    let chart = chartRef.current;
    let resizeObserver = null;

    if (!chart) {
      try {
        const initialWidth = Math.max(300, container.clientWidth || 700);
        chart = typeof createChart === 'function' ? createChart(container, {
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
            scaleMargins: { top: 0.15, bottom: 0.08 },
          },
          timeScale: {
            borderColor: '#E2E8F0',
            timeVisible: true,
            secondsVisible: true,
            tickMarkFormatter: timeFormatter,
          },
          localization: {
            priceFormatter: valueFormatter,
            timeFormatter: timeFormatter,
          },
        }) : null;
      } catch (err) {
        console.warn('[InteractiveResourceChart] createChart warning:', err);
        chart = null;
      }

      if (!chart || typeof chart.addSeries !== 'function') {
        return undefined;
      }

      // 1. CPU Series: Emerald Area
      const cpuSeries = chart.addSeries(AreaSeries, {
        lineColor: '#059669',
        topColor: 'rgba(5, 150, 105, 0.22)',
        bottomColor: 'rgba(5, 150, 105, 0.01)',
        lineWidth: 2,
        priceFormat: {
          type: 'custom',
          minMove: 0.01,
          formatter: valueFormatter,
        },
        autoscaleInfoProvider: scaleMode === 'standard'
          ? () => ({ priceRange: { minValue: 0, maxValue: 100 } })
          : undefined,
      });

      // 2. RAM Series: Blue Line
      const ramSeries = chart.addSeries(LineSeries, {
        color: '#2563EB',
        lineWidth: 2,
        priceFormat: {
          type: 'custom',
          minMove: 0.01,
          formatter: valueFormatter,
        },
        autoscaleInfoProvider: scaleMode === 'standard'
          ? () => ({ priceRange: { minValue: 0, maxValue: 100 } })
          : undefined,
      });

      cpuSeriesRef.current = cpuSeries;
      ramSeriesRef.current = ramSeries;
      chartRef.current = chart;

      // 80% Warning threshold line
      if (showThreshold && scaleMode === 'standard' && typeof cpuSeries.createPriceLine === 'function') {
        thresholdLineRef.current = cpuSeries.createPriceLine({
          price: 80,
          color: '#E11D48',
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: 'NGƯỠNG 80%',
        });
      }

      // Crosshair tracking for floating tooltip
      if (typeof chart.subscribeCrosshairMove === 'function') {
        chart.subscribeCrosshairMove((param) => {
          if (!param || param.time === undefined || !param.point) {
            setHoverData(null);
            return;
          }
          const time = Number(param.time);
          const cpuPt = param.seriesData ? param.seriesData.get(cpuSeries) : null;
          const ramPt = param.seriesData ? param.seriesData.get(ramSeries) : null;
          const cpuVal = cpuPt?.value !== undefined ? cpuPt.value : null;
          const ramVal = ramPt?.value !== undefined ? ramPt.value : null;

          setHoverData({
            time,
            x: param.point.x,
            y: param.point.y,
            cpu: cpuVal,
            ram: ramVal,
          });
        });
      }

      // ResizeObserver
      if (typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver((entries) => {
          if (!entries || !entries[0] || !chartRef.current) return;
          const width = entries[0].contentRect.width;
          if (width > 0) {
            chartRef.current.applyOptions({ width });
          }
        });
        resizeObserver.observe(container);
      }
    }

    // Update Series data
    if (cpuSeriesRef.current && typeof cpuSeriesRef.current.setData === 'function') {
      cpuSeriesRef.current.setData(sanitizedCpuData);
      cpuSeriesRef.current.applyOptions({
        visible: showCpu,
        autoscaleInfoProvider: scaleMode === 'standard'
          ? () => ({ priceRange: { minValue: 0, maxValue: 100 } })
          : undefined,
      });
    }

    if (ramSeriesRef.current && typeof ramSeriesRef.current.setData === 'function') {
      ramSeriesRef.current.setData(sanitizedRamData);
      ramSeriesRef.current.applyOptions({
        visible: showRam,
        autoscaleInfoProvider: scaleMode === 'standard'
          ? () => ({ priceRange: { minValue: 0, maxValue: 100 } })
          : undefined,
      });
    }

    if (chart && typeof chart.timeScale === 'function') {
      const ts = chart.timeScale();
      if (typeof ts.fitContent === 'function') {
        ts.fitContent();
      }
    }

    return () => {
      if (resizeObserver) resizeObserver.disconnect();
    };
  }, [
    sanitizedCpuData,
    sanitizedRamData,
    telemetryData.length,
    isLoading,
    error,
    isClusterOnline,
    scaleMode,
    showCpu,
    showRam,
    showThreshold,
    height,
    timeFormatter,
    valueFormatter,
  ]);

  // Cleanup chart on component unmount
  useEffect(() => {
    return () => {
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
        cpuSeriesRef.current = null;
        ramSeriesRef.current = null;
      }
    };
  }, []);

  return (
    <div
      className={`interactive-resource-chart ${className}`}
      style={{
        backgroundColor: '#FFFFFF',
        border: '1px solid var(--dash-border, #E2E8F0)',
        borderRadius: 'var(--dash-radius-lg, 8px)',
        padding: '20px',
        position: 'relative',
        boxShadow: 'var(--dash-shadow-sm, 0 1px 3px rgba(0,0,0,0.05))',
      }}
      data-testid="interactive-resource-chart"
    >
      {/* 1. Header bar with filters and controls */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '14px',
          marginBottom: '16px',
          paddingBottom: '14px',
          borderBottom: '1px solid #F1F5F9',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Activity size={18} color="var(--dash-primary, #059669)" />
            <h3
              style={{
                fontFamily: 'var(--font-display, inherit)',
                fontSize: '1rem',
                fontWeight: 700,
                color: 'var(--dash-text-primary, #0F172A)',
                margin: 0,
              }}
            >
              {title}
            </h3>

            {/* Live / Stale / Offline Telemetry Indicator */}
            {!isClusterOnline ? (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  backgroundColor: '#F1F5F9',
                  color: '#64748B',
                  fontSize: '0.6875rem',
                  fontWeight: 600,
                }}
              >
                ● Ngoại tuyến
              </span>
            ) : isStale ? (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(217, 119, 6, 0.1)',
                  color: '#D97706',
                  fontSize: '0.6875rem',
                  fontWeight: 700,
                  fontFamily: 'var(--font-mono, monospace)',
                }}
              >
                <span
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: '#D97706',
                  }}
                />
                DỮ LIỆU CŨ (Stale)
              </span>
            ) : isLive ? (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(5, 150, 105, 0.1)',
                  color: '#059669',
                  fontSize: '0.6875rem',
                  fontWeight: 700,
                  fontFamily: 'var(--font-mono, monospace)',
                }}
              >
                <span
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: '#059669',
                  }}
                />
                TRỰC TIẾP (eBPF 5s)
              </span>
            ) : null}
          </div>
          <p
            style={{
              fontSize: '0.8125rem',
              color: 'var(--dash-text-muted, #64748B)',
              margin: '4px 0 0 0',
            }}
          >
            {subtitle}
          </p>
        </div>

        {/* Action Controls: Time Range Selector, Zoom Mode, Toggles */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px' }}>
          {/* Time range selector */}
          <div
            style={{
              display: 'inline-flex',
              backgroundColor: '#F1F5F9',
              borderRadius: '6px',
              padding: '2px',
              border: '1px solid #E2E8F0',
            }}
          >
            {[
              { id: '15m', label: '15 phút' },
              { id: '1h', label: '1 giờ' },
              { id: '6h', label: '6 giờ' },
              { id: '24h', label: '24 giờ' },
            ].map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => handleRangeClick(r.id)}
                style={{
                  padding: '4px 10px',
                  fontSize: '0.75rem',
                  fontWeight: selectedRange === r.id ? 700 : 500,
                  color: selectedRange === r.id ? '#0F172A' : '#64748B',
                  backgroundColor: selectedRange === r.id ? '#FFFFFF' : 'transparent',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  boxShadow: selectedRange === r.id ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                {r.label}
              </button>
            ))}
          </div>

          {/* Auto-scale vs Standard 0-100% Mode Toggle */}
          <button
            type="button"
            onClick={() => setScaleMode((m) => (m === 'auto' ? 'standard' : 'auto'))}
            title={scaleMode === 'auto' ? 'Đang phóng to dao động (Auto-scale). Bấm để xem chuẩn 0-100%' : 'Đang ở chuẩn 0-100%. Bấm để phóng to dao động'}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 8px',
              fontSize: '0.75rem',
              fontWeight: 600,
              borderRadius: '6px',
              border: scaleMode === 'auto' ? '1px solid #93C5FD' : '1px solid #E2E8F0',
              backgroundColor: scaleMode === 'auto' ? '#EFF6FF' : '#FFFFFF',
              color: scaleMode === 'auto' ? '#1D4ED8' : '#64748B',
              cursor: 'pointer',
            }}
          >
            <ZoomIn size={12} />
            {scaleMode === 'auto' ? 'Phóng to dao động (Auto)' : 'Chuẩn (0-100%)'}
          </button>

          {/* Reset Fit Content */}
          <button
            type="button"
            onClick={handleFitContent}
            title="Khôi phục góc nhìn vừa khít dữ liệu"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 8px',
              fontSize: '0.75rem',
              fontWeight: 600,
              borderRadius: '6px',
              border: '1px solid #E2E8F0',
              backgroundColor: '#FFFFFF',
              color: '#64748B',
              cursor: 'pointer',
            }}
          >
            <Maximize2 size={12} />
            Vừa khít
          </button>

          {/* Series Toggle: CPU */}
          <button
            type="button"
            onClick={toggleCpuSeries}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '4px 8px',
              fontSize: '0.75rem',
              fontWeight: 600,
              borderRadius: '6px',
              border: showCpu ? '1px solid #A7F3D0' : '1px solid #E2E8F0',
              backgroundColor: showCpu ? 'rgba(5, 150, 105, 0.08)' : '#F8FAFC',
              color: showCpu ? '#047857' : '#94A3B8',
              cursor: 'pointer',
            }}
          >
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: showCpu ? '#059669' : '#CBD5E1' }} />
            CPU (%)
          </button>

          {/* Series Toggle: RAM */}
          <button
            type="button"
            onClick={toggleRamSeries}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '4px 8px',
              fontSize: '0.75rem',
              fontWeight: 600,
              borderRadius: '6px',
              border: showRam ? '1px solid #BFDBFE' : '1px solid #E2E8F0',
              backgroundColor: showRam ? 'rgba(37, 99, 235, 0.08)' : '#F8FAFC',
              color: showRam ? '#1D4ED8' : '#94A3B8',
              cursor: 'pointer',
            }}
          >
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: showRam ? '#2563EB' : '#CBD5E1' }} />
            RAM
          </button>
        </div>
      </div>

      {/* 2. Chart Body with States */}
      {isLoading ? (
        <div
          style={{
            height: `${height}px`,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#F8FAFC',
            borderRadius: '6px',
            gap: '10px',
          }}
        >
          <RefreshCw className="animate-spin" size={24} color="#059669" />
          <span style={{ fontSize: '0.8125rem', color: '#64748B' }}>
            Đang tải dữ liệu chuỗi thời gian...
          </span>
        </div>
      ) : error ? (
        <div
          style={{
            height: `${height}px`,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#FEF2F2',
            border: '1px dashed #FCA5A5',
            borderRadius: '6px',
            padding: '20px',
            gap: '10px',
          }}
        >
          <AlertCircle size={28} color="#DC2626" />
          <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#991B1B' }}>
            Lỗi tải dữ liệu viễn trắc
          </span>
          <span style={{ fontSize: '0.75rem', color: '#B91C1C', textAlign: 'center', maxWidth: '420px' }}>
            {error}
          </span>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              style={{
                marginTop: '4px',
                padding: '6px 14px',
                backgroundColor: '#DC2626',
                color: '#FFFFFF',
                borderRadius: '6px',
                border: 'none',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <RefreshCw size={13} />
              Thử lại
            </button>
          )}
        </div>
      ) : !isClusterOnline ? (
        <div
          style={{
            height: `${height}px`,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#F8FAFC',
            border: '1px dashed #CBD5E1',
            borderRadius: '6px',
            padding: '20px',
            gap: '10px',
          }}
        >
          <AlertTriangle size={28} color="#D97706" />
          <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#0F172A' }}>
            Cụm Kubernetes đang ngoại tuyến hoặc chưa kết nối Agent.
          </span>
          <span style={{ fontSize: '0.75rem', color: '#64748B' }}>
            Vui lòng cài đặt hoặc kích hoạt selfheal-agent để truyền chuỗi viễn trắc eBPF.
          </span>
        </div>
      ) : telemetryData.length === 0 ? (
        <div
          style={{
            height: `${height}px`,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#F8FAFC',
            border: '1px dashed #E2E8F0',
            borderRadius: '6px',
            padding: '20px',
            gap: '10px',
          }}
        >
          <Activity size={28} color="#94A3B8" />
          <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#0F172A' }}>
            Chưa có dữ liệu viễn trắc đo đạc
          </span>
          <span style={{ fontSize: '0.75rem', color: '#64748B', textAlign: 'center', maxWidth: '420px' }}>
            Không tìm thấy dữ liệu metrics CPU/RAM từ các tác tử eBPF trong khoảng thời gian này.
          </span>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              style={{
                marginTop: '4px',
                padding: '6px 14px',
                backgroundColor: '#F1F5F9',
                color: '#334155',
                borderRadius: '6px',
                border: '1px solid #CBD5E1',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <RefreshCw size={13} />
              Thử lại
            </button>
          )}
        </div>
      ) : (
        <div 
          style={{ width: '100%', position: 'relative', minHeight: `${height}px` }}
          data-testid="interactive-resource-chart-canvas-container"
        >
          {/* Lightweight Charts Canvas Host */}
          <div ref={containerRef} style={{ width: '100%', height: `${height}px` }} />

          {/* Interactive Floating Crosshair Tooltip */}
          {hoverData && (
            <div
              style={{
                position: 'absolute',
                top: '12px',
                left: Math.min(Math.max(16, hoverData.x - 110), (containerRef.current?.clientWidth || 600) - 230),
                backgroundColor: 'rgba(15, 23, 42, 0.94)',
                color: '#FFFFFF',
                borderRadius: '6px',
                padding: '8px 12px',
                boxShadow: '0 4px 14px rgba(0,0,0,0.25)',
                pointerEvents: 'none',
                minWidth: '210px',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                zIndex: 20,
                backdropFilter: 'blur(4px)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderBottom: '1px solid rgba(255,255,255,0.15)',
                  paddingBottom: '4px',
                  marginBottom: '6px',
                  fontSize: '0.75rem',
                  fontFamily: 'var(--font-mono, monospace)',
                  color: '#94A3B8',
                }}
              >
                <span>Thời gian:</span>
                <span style={{ color: '#F8FAFC', fontWeight: 700 }}>
                  {timeFormatter(hoverData.time)}
                </span>
              </div>

              {hoverData.cpu !== null && showCpu && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontFamily: 'var(--font-mono, monospace)',
                    fontSize: '0.75rem',
                    marginBottom: '4px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#34D399' }}>
                    <Cpu size={13} />
                    <span>CPU:</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontWeight: 800, color: '#FFFFFF' }}>{hoverData.cpu.toFixed(2)}%</span>
                    <span style={{ fontSize: '0.6875rem', color: '#94A3B8', marginLeft: '4px' }}>
                      ({((hoverData.cpu / 100) * totalCpuCores).toFixed(2)}/{totalCpuCores} vCPU)
                    </span>
                  </div>
                </div>
              )}

              {hoverData.ram !== null && showRam && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontFamily: 'var(--font-mono, monospace)',
                    fontSize: '0.75rem',
                    marginBottom: '4px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#60A5FA' }}>
                    <HardDrive size={13} />
                    <span>RAM:</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontWeight: 800, color: '#FFFFFF' }}>
                      {hoverData.ram.toFixed(2)}%
                    </span>
                    <span style={{ fontSize: '0.6875rem', color: '#94A3B8', marginLeft: '4px' }}>
                      ({((hoverData.ram / 100) * totalMemoryGb).toFixed(2)} GB RSS)
                    </span>
                  </div>
                </div>
              )}

              {/* Status evaluation */}
              <div
                style={{
                  marginTop: '6px',
                  paddingTop: '4px',
                  borderTop: '1px solid rgba(255,255,255,0.1)',
                  fontFamily: 'var(--font-mono, monospace)',
                  fontSize: '0.625rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  color: (hoverData.cpu || 0) >= 80 || (hoverData.ram || 0) >= 80 ? '#F87171' : '#34D399',
                }}
              >
                <span>TRẠNG THÁI:</span>
                <span>
                  {(hoverData.cpu || 0) >= 80 || (hoverData.ram || 0) >= 80
                    ? '🔴 VƯỢT NGƯỠNG AN TOÀN'
                    : '🟢 HOẠT ĐỘNG TỐI ƯU'}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. Metric Breakdown Stats Footer */}
      <div
        style={{
          marginTop: '16px',
          paddingTop: '14px',
          borderTop: '1px dashed #E2E8F0',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '12px',
        }}
      >
        <div style={{ padding: '8px 12px', backgroundColor: 'rgba(5, 150, 105, 0.05)', borderRadius: '6px', border: '1px solid rgba(5, 150, 105, 0.2)' }}>
          <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '0.6875rem', color: '#065F46', fontWeight: 700 }}>
            CPU TRUNG BÌNH / ĐỈNH
          </div>
          <div style={{ fontFamily: 'var(--font-display, inherit)', fontSize: '1.05rem', fontWeight: 800, color: '#064E3B' }}>
            {stats.hasData ? (
              <>
                {stats.avgCpu}% <span style={{ fontSize: '0.75rem', fontWeight: 500, color: '#047857' }}>/ Đỉnh {stats.maxCpu}%</span>
              </>
            ) : (
              '—'
            )}
          </div>
          <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '0.6875rem', color: '#059669' }}>
            {stats.hasData ? (
              `Quy đổi: ${((stats.avgCpu / 100) * totalCpuCores).toFixed(2)} / ${totalCpuCores} vCPUs`
            ) : (
              `Quy đổi: — / ${totalCpuCores} vCPUs`
            )}
          </div>
        </div>

        <div style={{ padding: '8px 12px', backgroundColor: 'rgba(37, 99, 235, 0.05)', borderRadius: '6px', border: '1px solid rgba(37, 99, 235, 0.2)' }}>
          <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '0.6875rem', color: '#1E40AF', fontWeight: 700 }}>
            RAM TRUNG BÌNH / ĐỈNH
          </div>
          <div style={{ fontFamily: 'var(--font-display, inherit)', fontSize: '1.05rem', fontWeight: 800, color: '#1E3A8A' }}>
            {stats.hasData ? (
              <>
                {stats.avgRamMb > 0 ? `${stats.avgRamMb} MB` : `${stats.avgRam}%`}{' '}
                <span style={{ fontSize: '0.75rem', fontWeight: 500, color: '#2563EB' }}>
                  / Đỉnh {stats.maxRamMb > 0 ? `${stats.maxRamMb} MB` : `${stats.maxRam}%`}
                </span>
              </>
            ) : (
              '—'
            )}
          </div>
          <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '0.6875rem', color: '#3B82F6' }}>
            {stats.hasData ? (
              `Quy đổi: ${stats.avgRam}% / ${totalMemoryGb} GB RSS`
            ) : (
              `Quy đổi: — / ${totalMemoryGb} GB RSS`
            )}
          </div>
        </div>

        <div style={{ padding: '8px 12px', backgroundColor: '#F8FAFC', borderRadius: '6px', border: '1px solid #E2E8F0' }}>
          <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '0.6875rem', color: 'var(--dash-text-muted, #64748B)', fontWeight: 700 }}>
            ĐIỀU PHỐI AUTONOMOUS
          </div>
          <div style={{ fontFamily: 'var(--font-display, inherit)', fontSize: '1.05rem', fontWeight: 800, color: 'var(--dash-text-primary, #0F172A)' }}>
            Vòng lặp MAPE-K
          </div>
          <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '0.6875rem', color: '#059669' }}>
            {stats.hasData && stats.maxCpu > 80
              ? '⚠️ Tự động kích hoạt Scale Replicas'
              : 'Mô hình GRU + Multi-Agent RCA: Giám sát'}
          </div>
        </div>
      </div>
    </div>
  );
};

export default InteractiveResourceChart;
