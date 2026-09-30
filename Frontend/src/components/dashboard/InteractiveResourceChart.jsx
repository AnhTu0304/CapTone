import React, { useState, useMemo, useRef } from 'react';
import { 
  Activity, 
  Cpu, 
  HardDrive, 
  AlertTriangle 
} from 'lucide-react';

/**
 * InteractiveResourceChart
 * Production-ready, React 19 native interactive telemetry chart.
 * Features:
 * - Crosshair vertical tracking line
 * - Detailed cursor tooltip with % and physical units (vCPU, GB RSS)
 * - Series toggles (CPU / RAM)
 * - 80% Warning Threshold line with badge
 * - Time range selector (15 phút, 1 giờ, 6 giờ, 24 giờ)
 * - Summary statistics (Min, Max, Trung bình)
 */
export const InteractiveResourceChart = ({
  data: initialData,
  totalCpuCores = 32,
  totalMemoryGb = 64,
  title = 'Biến thiên Tài nguyên Cụm máy chủ (CPU & RAM)',
  subtitle = 'Dữ liệu viễn trắc đo đạc từ các DaemonSet eBPF theo thời gian thực',
  className = '',
  height = 260,
}) => {
  const [timeRange, setTimeRange] = useState('1h');
  const [showCpu, setShowCpu] = useState(true);
  const [showRam, setShowRam] = useState(true);
  const [showThreshold, setShowThreshold] = useState(true);
  const [hoverIndex, setHoverIndex] = useState(null);
  const svgRef = useRef(null);

  // Default sample telemetry data if none provided
  const telemetryData = useMemo(() => {
    if (initialData && initialData.length > 0) return initialData;

    // Generated 20 timestamps for 1-hour span
    const points = [];
    const now = Date.now();
    const count = 20;
    const interval = (60 * 60 * 1000) / count;

    for (let i = 0; i < count; i++) {
      const time = new Date(now - (count - 1 - i) * interval);
      const timeStr = time.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
      // Realistic simulated curve with occasional spikes
      const cpu = Math.round(38 + Math.sin(i * 0.45) * 14 + (i > 14 ? 18 : 0) + (i % 3) * 2);
      const ram = Math.round(62 + Math.cos(i * 0.3) * 8 + (i > 10 ? 9 : 0));
      points.push({
        time: timeStr,
        fullTime: time.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        cpu: Math.min(Math.max(cpu, 15), 95),
        ram: Math.min(Math.max(ram, 30), 92),
      });
    }
    return points;
  }, [initialData]);

  // Dimensions
  const padding = { top: 25, right: 30, bottom: 35, left: 45 };
  const width = 800; // SVG coordinate space
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Coordinate scales
  const getX = (index) => padding.left + (index / (telemetryData.length - 1)) * chartWidth;
  const getY = (val) => padding.top + chartHeight - (val / 100) * chartHeight;

  // Generate SVG path strings
  const cpuPoints = telemetryData.map((d, i) => `${getX(i)},${getY(d.cpu)}`).join(' ');
  const ramPoints = telemetryData.map((d, i) => `${getX(i)},${getY(d.ram)}`).join(' ');

  const cpuArea = `${getX(0)},${getY(0)} ${cpuPoints} ${getX(telemetryData.length - 1)},${getY(0)}`;
  const ramArea = `${getX(0)},${getY(0)} ${ramPoints} ${getX(telemetryData.length - 1)},${getY(0)}`;

  // Handle Mouse Move for Crosshair
  const handleMouseMove = (e) => {
    if (!svgRef.current) return;
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

  // Stats calculation
  const stats = useMemo(() => {
    const cpus = telemetryData.map((d) => d.cpu);
    const rams = telemetryData.map((d) => d.ram);

    const avgCpu = Math.round(cpus.reduce((a, b) => a + b, 0) / cpus.length);
    const maxCpu = Math.max(...cpus);
    const minCpu = Math.min(...cpus);

    const avgRam = Math.round(rams.reduce((a, b) => a + b, 0) / rams.length);
    const maxRam = Math.max(...rams);
    const minRam = Math.min(...rams);

    return { avgCpu, maxCpu, minCpu, avgRam, maxRam, minRam };
  }, [telemetryData]);

  const activePoint = hoverIndex !== null ? telemetryData[hoverIndex] : telemetryData[telemetryData.length - 1];

  return (
    <div
      className={`interactive-resource-chart ${className}`}
      style={{
        backgroundColor: '#FFFFFF',
        border: '1px solid var(--border-default)',
        padding: '20px',
        position: 'relative',
      }}
    >
      {/* Header bar with filters and controls */}
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
            <Activity size={18} color="#059669" />
            <h3
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '1rem',
                fontWeight: 700,
                color: 'var(--color-ink)',
                margin: 0,
              }}
            >
              {title}
            </h3>
          </div>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '0.75rem',
              color: 'var(--text-muted)',
              margin: '2px 0 0 0',
            }}
          >
            {subtitle}
          </p>
        </div>

        {/* Controls: Range selector and series switches */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px' }}>
          {/* Time range tabs */}
          <div
            style={{
              display: 'flex',
              backgroundColor: 'rgba(61, 59, 79, 0.05)',
              padding: '2px',
              border: '1px solid var(--border-default)',
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
                onClick={() => setTimeRange(t.id)}
                style={{
                  padding: '3px 8px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.6875rem',
                  fontWeight: 700,
                  backgroundColor: timeRange === t.id ? '#FFFFFF' : 'transparent',
                  color: timeRange === t.id ? 'var(--color-ink)' : 'var(--text-muted)',
                  border: 'none',
                  boxShadow: timeRange === t.id ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                  cursor: 'pointer',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Series Toggle Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              type="button"
              onClick={() => setShowCpu(!showCpu)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '4px 8px',
                backgroundColor: showCpu ? 'rgba(5, 150, 105, 0.1)' : 'transparent',
                border: showCpu ? '1px solid #059669' : '1px solid var(--border-default)',
                color: showCpu ? '#059669' : 'var(--text-muted)',
                fontFamily: 'var(--font-mono)',
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
                padding: '4px 8px',
                backgroundColor: showRam ? 'rgba(37, 99, 235, 0.1)' : 'transparent',
                border: showRam ? '1px solid #2563EB' : '1px solid var(--border-default)',
                color: showRam ? '#2563EB' : 'var(--text-muted)',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.6875rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#2563EB' }} />
              <span>RAM (%)</span>
            </button>

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
                border: showThreshold ? '1px solid #FDA4AF' : '1px solid var(--border-default)',
                color: showThreshold ? '#E11D48' : 'var(--text-muted)',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.6875rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <AlertTriangle size={12} />
              <span>Ngưỡng 80%</span>
            </button>
          </div>
        </div>
      </div>

      {/* SVG Chart Area */}
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
            {/* Gradients */}
            <linearGradient id="cpuGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#059669" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#059669" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="ramGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2563EB" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#2563EB" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines (0, 25, 50, 75, 100%) */}
          {[0, 25, 50, 75, 100].map((val) => {
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
                  fill="#94A3B8"
                >
                  {val}%
                </text>
              </g>
            );
          })}

          {/* 80% Threshold Reference Line */}
          {showThreshold && (
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
                x={width - padding.right - 115}
                y={getY(80) - 10}
                width="115"
                height="20"
                fill="#FFF1F2"
                stroke="#FDA4AF"
                strokeWidth="1"
              />
              <text
                x={width - padding.right - 57}
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
            // Show every 4th label to prevent clutter
            if (i % 4 !== 0 && i !== telemetryData.length - 1) return null;
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
          {hoverIndex !== null && (
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

        {/* Floating Tooltip Box (HTML Overlay for crisp typography) */}
        {hoverIndex !== null && (
          <div
            style={{
              position: 'absolute',
              top: '12px',
              left: `${Math.min(Math.max((getX(hoverIndex) / width) * 100, 15), 75)}%`,
              transform: 'translateX(-50%)',
              backgroundColor: '#0F172A',
              color: '#FFFFFF',
              padding: '10px 14px',
              borderRadius: '2px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
              pointerEvents: 'none',
              zIndex: 20,
              minWidth: '200px',
              border: '1px solid rgba(255,255,255,0.15)',
            }}
          >
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.6875rem',
                color: '#94A3B8',
                marginBottom: '6px',
                borderBottom: '1px solid rgba(255,255,255,0.1)',
                paddingBottom: '4px',
                display: 'flex',
                justifyContent: 'space-between',
              }}
            >
              <span>THỜI GIAN:</span>
              <strong style={{ color: '#F8FAFC' }}>{activePoint.fullTime || activePoint.time}</strong>
            </div>

            {showCpu && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontFamily: 'var(--font-mono)',
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
                    ({((activePoint.cpu / 100) * totalCpuCores).toFixed(1)}/{totalCpuCores} vCPU)
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
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.75rem',
                  marginBottom: '4px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#60A5FA' }}>
                  <HardDrive size={13} />
                  <span>RAM Dùng:</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontWeight: 800, color: '#FFFFFF' }}>{activePoint.ram}%</span>
                  <span style={{ fontSize: '0.6875rem', color: '#94A3B8', marginLeft: '4px' }}>
                    ({((activePoint.ram / 100) * totalMemoryGb).toFixed(1)}/{totalMemoryGb} GB)
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
                fontFamily: 'var(--font-mono)',
                fontSize: '0.625rem',
                display: 'flex',
                justifyContent: 'space-between',
                color: activePoint.cpu >= 80 || activePoint.ram >= 80 ? '#F87171' : '#34D399',
              }}
            >
              <span>TRẠNG THÁI:</span>
              <span>
                {activePoint.cpu >= 80 || activePoint.ram >= 80
                  ? 'VƯỢT NGƯỠNG AN TOÀN'
                  : 'BÌNH THƯỜNG / TỐI ƯU'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Metric Breakdown Stats Footer */}
      <div
        style={{
          marginTop: '16px',
          paddingTop: '14px',
          borderTop: '1px dashed #E2E8F0',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '12px',
        }}
      >
        <div style={{ padding: '8px 12px', backgroundColor: 'rgba(5, 150, 105, 0.05)', border: '1px solid rgba(5, 150, 105, 0.2)' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: '#065F46', fontWeight: 700 }}>
            CPU TRUNG BÌNH / ĐỈNH
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.05rem', fontWeight: 800, color: '#064E3B' }}>
            {stats.avgCpu}% <span style={{ fontSize: '0.75rem', fontWeight: 500, color: '#047857' }}>/ Đỉnh {stats.maxCpu}%</span>
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: '#059669' }}>
            Quy đổi: {((stats.avgCpu / 100) * totalCpuCores).toFixed(1)} vCPU
          </div>
        </div>

        <div style={{ padding: '8px 12px', backgroundColor: 'rgba(37, 99, 235, 0.05)', border: '1px solid rgba(37, 99, 235, 0.2)' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: '#1E40AF', fontWeight: 700 }}>
            RAM TRUNG BÌNH / ĐỈNH
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.05rem', fontWeight: 800, color: '#1E3A8A' }}>
            {stats.avgRam}% <span style={{ fontSize: '0.75rem', fontWeight: 500, color: '#2563EB' }}>/ Đỉnh {stats.maxRam}%</span>
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: '#3B82F6' }}>
            Quy đổi: {((stats.avgRam / 100) * totalMemoryGb).toFixed(1)} GB RSS
          </div>
        </div>

        <div style={{ padding: '8px 12px', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: 'var(--text-muted)', fontWeight: 700 }}>
            ĐIỀU PHỐI AUTONOMOUS
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.05rem', fontWeight: 800, color: 'var(--color-ink)' }}>
            Chính sách MAPE-K
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: '#059669' }}>
            Auto-Scale nếu CPU {'>'} 85% trong 3m
          </div>
        </div>
      </div>
    </div>
  );
};

export default InteractiveResourceChart;
