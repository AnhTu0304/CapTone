import React, { useState, useMemo, useRef } from 'react';
import { 
  Activity, 
  Cpu, 
  HardDrive, 
  AlertTriangle,
  AlertCircle,
  ZoomIn,
  Sliders,
  Radio,
  RefreshCw
} from 'lucide-react';

/**
 * InteractiveResourceChart
 * Production-ready, React 19 native interactive telemetry chart.
 * Features:
 * - Direct connection to live eBPF telemetry stream (WebSocket 3s + REST history)
 * - Auto-scale (Zoom) mode vs Standard (0-100%) mode toggle for micro-variation tracking
 * - Crosshair vertical tracking line with synchronized coordinate projection
 * - Detailed tooltip showing both percentages and real physical units (vCPU, MB/GB RSS, Disk, Latency)
 * - Series toggles (CPU / RAM)
 * - 80% Warning Threshold line with badge
 * - Time range selector (15 phút, 1 giờ, 6 giờ, 24 giờ)
 * - Summary statistics (Min, Max, Trung bình)
 */
export const InteractiveResourceChart = ({
  data: initialData,
  totalCpuCores = 12,
  totalMemoryGb = 8,
  title = 'Biến thiên Tài nguyên Cụm máy chủ (CPU & RAM)',
  subtitle = 'Dữ liệu viễn trắc đo đạc từ các DaemonSet eBPF theo thời gian thực',
  className = '',
  height = 270,
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
  const [showThreshold, setShowThreshold] = useState(true);
  const [scaleMode, setScaleMode] = useState('auto'); // 'auto' | 'standard'
  const [hoverIndex, setHoverIndex] = useState(null);
  const svgRef = useRef(null);

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

  // Dynamic Y-axis scale calculation
  const { yMax, yTicks } = useMemo(() => {
    if (scaleMode === 'standard') {
      return { yMax: 100, yTicks: [0, 25, 50, 75, 100] };
    }

    // Auto-scale mode: adapt ceiling to highest observed metric
    const peak = Math.max(stats.maxCpu, stats.maxRam, 0.1);
    if (peak <= 0.5) {
      return { yMax: 0.5, yTicks: [0, 0.1, 0.25, 0.5] };
    }
    if (peak <= 1.0) {
      return { yMax: 1.0, yTicks: [0, 0.25, 0.5, 0.75, 1.0] };
    }
    if (peak <= 2.0) {
      return { yMax: 2.0, yTicks: [0, 0.5, 1.0, 1.5, 2.0] };
    }
    if (peak <= 5.0) {
      return { yMax: 5.0, yTicks: [0, 1.25, 2.5, 3.75, 5.0] };
    }
    if (peak <= 10.0) {
      return { yMax: 10.0, yTicks: [0, 2.5, 5.0, 7.5, 10.0] };
    }
    if (peak <= 25.0) {
      return { yMax: 25.0, yTicks: [0, 5, 10, 15, 20, 25] };
    }
    if (peak <= 50.0) {
      return { yMax: 50.0, yTicks: [0, 10, 20, 30, 40, 50] };
    }
    return { yMax: 100, yTicks: [0, 25, 50, 75, 100] };
  }, [scaleMode, stats.maxCpu, stats.maxRam]);

  // Chart Dimensions
  const padding = { top: 25, right: 30, bottom: 35, left: 52 };
  const width = 800; // SVG coordinate space
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Coordinate mapping
  const getX = (index) => {
    if (telemetryData.length <= 1) return padding.left;
    return padding.left + (index / (telemetryData.length - 1)) * chartWidth;
  };
  const getY = (val) => {
    const clamped = Math.min(yMax, Math.max(0, Number(val) || 0));
    return padding.top + chartHeight - (clamped / yMax) * chartHeight;
  };

  // Generate SVG path strings
  const cpuPoints = telemetryData.map((d, i) => `${getX(i)},${getY(d.cpu)}`).join(' ');
  const ramPoints = telemetryData.map((d, i) => `${getX(i)},${getY(d.ram)}`).join(' ');

  const cpuArea = telemetryData.length > 0
    ? `${getX(0)},${getY(0)} ${cpuPoints} ${getX(telemetryData.length - 1)},${getY(0)}`
    : '';
  const ramArea = telemetryData.length > 0
    ? `${getX(0)},${getY(0)} ${ramPoints} ${getX(telemetryData.length - 1)},${getY(0)}`
    : '';

  // Handle Mouse Move for Crosshair
  const handleMouseMove = (e) => {
    if (!svgRef.current || telemetryData.length === 0) return;
    const rect = svgRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const relativeX = (mouseX / rect.width) * width;
    
    if (relativeX < padding.left || relativeX > width - padding.right) {
      setHoverIndex(null);
      return;
    }

    const ratio = (relativeX - padding.left) / chartWidth;
    const idx = Math.round(ratio * (telemetryData.length - 1));
    setHoverIndex(Math.max(0, Math.min(telemetryData.length - 1, idx)));
  };

  const handleMouseLeave = () => {
    setHoverIndex(null);
  };

  const activePoint = hoverIndex !== null 
    ? telemetryData[hoverIndex] 
    : telemetryData[telemetryData.length - 1] || null;

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
                    boxShadow: '0 0 6px #D97706',
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
                    boxShadow: '0 0 6px #059669',
                  }}
                />
                TRỰC TIẾP (eBPF 5s)
              </span>
            ) : (
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
                ● Chờ dữ liệu
              </span>
            )}
          </div>
          <p
            style={{
              fontFamily: 'var(--font-body, inherit)',
              fontSize: '0.75rem',
              color: 'var(--dash-text-secondary, #64748B)',
              margin: '3px 0 0 0',
            }}
          >
            {subtitle}
          </p>
        </div>

        {/* Controls: Range selector, series switches, and scale mode */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px' }}>
          {/* Time range selector */}
          <div
            style={{
              display: 'flex',
              backgroundColor: '#F1F5F9',
              padding: '2px',
              borderRadius: '6px',
              border: '1px solid #E2E8F0',
            }}
          >
            {[
              { id: '15m', label: '15 phút' },
              { id: '1h', label: '1 giờ' },
              { id: '6h', label: '6 giờ' },
              { id: '24h', label: '24 giờ' },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => handleRangeClick(t.id)}
                disabled={isLoading}
                style={{
                  padding: '4px 10px',
                  fontFamily: 'var(--font-mono, monospace)',
                  fontSize: '0.6875rem',
                  fontWeight: 700,
                  backgroundColor: selectedRange === t.id ? '#FFFFFF' : 'transparent',
                  color: selectedRange === t.id ? '#0F172A' : '#64748B',
                  border: 'none',
                  borderRadius: '4px',
                  boxShadow: selectedRange === t.id ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Scale Mode Toggle (Auto-Scale vs 0-100%) */}
          <button
            type="button"
            onClick={() => setScaleMode(scaleMode === 'auto' ? 'standard' : 'auto')}
            title={scaleMode === 'auto' ? 'Đang phóng to dao động (Auto-Scale). Bấm để chuyển về thang đo chuẩn 0-100%' : 'Đang xem thang đo 0-100%. Bấm để tự động phóng to dao động'}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '4px 9px',
              backgroundColor: scaleMode === 'auto' ? 'rgba(99, 102, 241, 0.08)' : '#F8FAFC',
              border: scaleMode === 'auto' ? '1px solid #818CF8' : '1px solid #E2E8F0',
              color: scaleMode === 'auto' ? '#4F46E5' : '#64748B',
              borderRadius: '6px',
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: '0.6875rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <ZoomIn size={12} />
            <span>{scaleMode === 'auto' ? `Phóng to dao động (${yMax}%)` : 'Thang đo 0-100%'}</span>
          </button>

          {/* Series Toggle Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              type="button"
              onClick={() => setShowCpu(!showCpu)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '4px 9px',
                backgroundColor: showCpu ? 'rgba(5, 150, 105, 0.1)' : 'transparent',
                border: showCpu ? '1px solid #059669' : '1px solid #CBD5E1',
                color: showCpu ? '#059669' : '#64748B',
                borderRadius: '6px',
                fontFamily: 'var(--font-mono, monospace)',
                fontSize: '0.6875rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#059669' }} />
              <span>CPU (%)</span>
            </button>

            <button
              type="button"
              onClick={() => setShowRam(!showRam)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '4px 9px',
                backgroundColor: showRam ? 'rgba(37, 99, 235, 0.1)' : 'transparent',
                border: showRam ? '1px solid #2563EB' : '1px solid #CBD5E1',
                color: showRam ? '#2563EB' : '#64748B',
                borderRadius: '6px',
                fontFamily: 'var(--font-mono, monospace)',
                fontSize: '0.6875rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#2563EB' }} />
              <span>RAM</span>
            </button>

            {yMax >= 80 && (
              <button
                type="button"
                onClick={() => setShowThreshold(!showThreshold)}
                title="Ngưỡng cảnh báo 80%"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '4px 8px',
                  backgroundColor: showThreshold ? '#FFF1F2' : 'transparent',
                  border: showThreshold ? '1px solid #FDA4AF' : '1px solid #CBD5E1',
                  color: showThreshold ? '#E11D48' : '#64748B',
                  borderRadius: '6px',
                  fontFamily: 'var(--font-mono, monospace)',
                  fontSize: '0.6875rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                <AlertTriangle size={12} />
                <span>Ngưỡng 80%</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2. SVG Chart Area / Loading / Error / Empty States */}
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
            gap: '12px',
          }}
        >
          <RefreshCw size={24} className="animate-spin" color="#059669" />
          <span style={{ fontSize: '0.8125rem', color: '#64748B', fontWeight: 600 }}>
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
          <span style={{ fontSize: '0.75rem', color: '#B91C1C', textAlign: 'center', maxWidth: '400px' }}>
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
          style={{ width: '100%', position: 'relative', cursor: 'crosshair', userSelect: 'none' }}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          <svg
            ref={svgRef}
            viewBox={`0 0 ${width} ${height}`}
            style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }}
          >
            <defs>
              <linearGradient id="cpuGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#059669" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#059669" stopOpacity="0.0" />
              </linearGradient>
              <linearGradient id="ramGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2563EB" stopOpacity="0.20" />
                <stop offset="100%" stopColor="#2563EB" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Grid lines according to dynamic yTicks */}
            {yTicks.map((val) => {
              const y = getY(val);
              return (
                <g key={val}>
                  <line
                    x1={padding.left}
                    y1={y}
                    x2={width - padding.right}
                    y2={y}
                    stroke={val === 0 ? '#CBD5E1' : '#F1F5F9'}
                    strokeWidth="1"
                    strokeDasharray={val === 0 ? 'none' : '3 3'}
                  />
                  <text
                    x={padding.left - 8}
                    y={y + 3}
                    textAnchor="end"
                    fontFamily="monospace"
                    fontSize="10"
                    fill="#64748B"
                  >
                    {val < 1 && val > 0 ? val.toFixed(2) : val}%
                  </text>
                </g>
              );
            })}

            {/* 80% Threshold Reference Line if within view */}
            {showThreshold && yMax >= 80 && (
              <g>
                <line
                  x1={padding.left}
                  y1={getY(80)}
                  x2={width - padding.right}
                  y2={getY(80)}
                  stroke="#E11D48"
                  strokeWidth="1.5"
                  strokeDasharray="4 4"
                  strokeOpacity="0.8"
                />
                <rect
                  x={width - padding.right - 120}
                  y={getY(80) - 10}
                  width="120"
                  height="20"
                  fill="#FFF1F2"
                  stroke="#FDA4AF"
                  strokeWidth="1"
                  rx="3"
                />
                <text
                  x={width - padding.right - 60}
                  y={getY(80) + 4}
                  textAnchor="middle"
                  fontFamily="monospace"
                  fontSize="9"
                  fontWeight="700"
                  fill="#E11D48"
                >
                  NGƯỠNG CẢNH BÁO 80%
                </text>
              </g>
            )}

            {/* RAM Series Area & Line */}
            {showRam && (
              <>
                <polygon points={ramArea} fill="url(#ramGradient)" />
                <polyline
                  fill="none"
                  stroke="#2563EB"
                  strokeWidth="2.2"
                  points={ramPoints}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </>
            )}

            {/* CPU Series Area & Line */}
            {showCpu && (
              <>
                <polygon points={cpuArea} fill="url(#cpuGradient)" />
                <polyline
                  fill="none"
                  stroke="#059669"
                  strokeWidth="2.2"
                  points={cpuPoints}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </>
            )}

            {/* X Axis Time Labels */}
            {telemetryData.map((d, i) => {
              // Show approximately 4 to 6 evenly-spaced labels
              const step = Math.max(1, Math.floor(telemetryData.length / 5));
              if (i % step !== 0 && i !== telemetryData.length - 1) return null;
              return (
                <text
                  key={i}
                  x={getX(i)}
                  y={height - 10}
                  textAnchor="middle"
                  fontFamily="monospace"
                  fontSize="10"
                  fill="#64748B"
                >
                  {d.time}
                </text>
              );
            })}

            {/* Crosshair indicator when hovering */}
            {hoverIndex !== null && activePoint && (
              <g>
                <line
                  x1={getX(hoverIndex)}
                  y1={padding.top}
                  x2={getX(hoverIndex)}
                  y2={height - padding.bottom}
                  stroke="#0F172A"
                  strokeWidth="1.5"
                  strokeDasharray="2 2"
                />
                {showCpu && (
                  <circle
                    cx={getX(hoverIndex)}
                    cy={getY(activePoint.cpu)}
                    r="4.5"
                    fill="#FFFFFF"
                    stroke="#059669"
                    strokeWidth="2.5"
                  />
                )}
                {showRam && (
                  <circle
                    cx={getX(hoverIndex)}
                    cy={getY(activePoint.ram)}
                    r="4.5"
                    fill="#FFFFFF"
                    stroke="#2563EB"
                    strokeWidth="2.5"
                  />
                )}
              </g>
            )}
          </svg>

          {/* Floating Tooltip Box */}
          {hoverIndex !== null && activePoint && (
            <div
              style={{
                position: 'absolute',
                top: '12px',
                left: `${Math.min(Math.max((getX(hoverIndex) / width) * 100, 18), 72)}%`,
                transform: 'translateX(-50%)',
                backgroundColor: '#0F172A',
                color: '#FFFFFF',
                padding: '10px 14px',
                borderRadius: '6px',
                boxShadow: '0 8px 20px rgba(0,0,0,0.25)',
                pointerEvents: 'none',
                zIndex: 20,
                minWidth: '220px',
                border: '1px solid rgba(255,255,255,0.15)',
              }}
            >
              <div
                style={{
                  fontFamily: 'var(--font-mono, monospace)',
                  fontSize: '0.6875rem',
                  color: '#94A3B8',
                  marginBottom: '6px',
                  borderBottom: '1px solid rgba(255,255,255,0.1)',
                  paddingBottom: '4px',
                  display: 'flex',
                  justifyContent: 'space-between',
                }}
              >
                <span>THỜI ĐIỂM:</span>
                <strong style={{ color: '#F8FAFC' }}>{activePoint.fullTime || activePoint.time}</strong>
              </div>

              {showCpu && (
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
                    <span>CPU Tải:</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontWeight: 800, color: '#FFFFFF' }}>{activePoint.cpu}%</span>
                    <span style={{ fontSize: '0.6875rem', color: '#94A3B8', marginLeft: '4px' }}>
                      ({((activePoint.cpu / 100) * totalCpuCores).toFixed(2)}/{totalCpuCores} vCPU)
                    </span>
                  </div>
                </div>
              )}

              {showRam && (
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
                    <span>RAM Dùng:</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontWeight: 800, color: '#FFFFFF' }}>
                      {activePoint.rawRamMb ? `${activePoint.rawRamMb.toFixed(1)} MB` : `${activePoint.ram}%`}
                    </span>
                    <span style={{ fontSize: '0.6875rem', color: '#94A3B8', marginLeft: '4px' }}>
                      ({activePoint.ram.toFixed(1)}% / {totalMemoryGb} GB RSS)
                    </span>
                  </div>
                </div>
              )}

              {activePoint.disk !== undefined && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontFamily: 'var(--font-mono, monospace)',
                    fontSize: '0.6875rem',
                    color: '#CBD5E1',
                    marginBottom: '4px',
                  }}
                >
                  <span>Ổ đĩa (PV):</span>
                  <span>{activePoint.disk}%</span>
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
                  color: activePoint.cpu >= 80 || activePoint.ram >= 80 ? '#F87171' : '#34D399',
                }}
              >
                <span>TRẠNG THÁI:</span>
                <span>
                  {activePoint.cpu >= 80 || activePoint.ram >= 80
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
