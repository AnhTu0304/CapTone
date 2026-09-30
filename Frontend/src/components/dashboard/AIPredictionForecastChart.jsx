import React, { useState, useMemo, useRef } from 'react';
import {
  Sparkles,
  AlertTriangle,
  Clock,
  Cpu,
  HardDrive,
  TrendingUp,
  Activity,
  CheckCircle2,
  ShieldAlert
} from 'lucide-react';

/**
 * AIPredictionForecastChart
 * React 19 native SVG chart visualizing multivariate AI time-series forecasting.
 * Features:
 * - Actual historical telemetry (Solid emerald line)
 * - Predicted future trajectory (Dashed amber/rose line for +15m / +30m)
 * - 85%-95% Confidence Interval Band
 * - Anomaly & Saturation inflection point markers (>80%)
 * - Crosshair vertical inspector tracking mouse position
 * - Floating tooltip with exact timestamp, % values, physical units (vCPU / GB), and incident probability
 * - Forecast horizon selector (+15 phút, +30 phút, +1 giờ)
 */
export const AIPredictionForecastChart = ({
  targetService = 'payment-service',
  metricType = 'RAM', // 'RAM' | 'CPU'
  totalCapacity = 64, // 64 GB or 32 vCPU
  unit = 'GB RSS',
  title = 'Dự Báo Nguy Cơ Bão Hòa & Bất Thường Bằng AI (Multivariate Forecasting)',
  subtitle = 'Mô hình chuỗi thời gian phân giải cao dự báo sớm 15-30 phút trước khi sự cố xảy ra',
  className = '',
  height = 270,
}) => {
  const [horizon, setHorizon] = useState('30m'); // '15m' | '30m' | '60m'
  const [hoverIndex, setHoverIndex] = useState(null);
  const [showConfidenceBand, setShowConfidenceBand] = useState(true);
  const svgRef = useRef(null);

  // Simulated time-series with 12 historical points and 10 future predicted points
  const points = useMemo(() => {
    const historicalCount = 12;
    const futureCount = horizon === '15m' ? 5 : horizon === '30m' ? 10 : 16;
    const totalPoints = historicalCount + futureCount;
    const now = Date.now();
    const intervalMinutes = 3;
    const stepMs = intervalMinutes * 60 * 1000;

    const data = [];

    // Historical Points (past 36 minutes up to now)
    for (let i = 0; i < historicalCount; i++) {
      const t = new Date(now - (historicalCount - 1 - i) * stepMs);
      const timeStr = t.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
      // Steady memory leak slope
      const val = Math.round(52 + i * 2.1 + (i % 2 === 0 ? 1 : -1));
      data.push({
        time: timeStr,
        isFuture: false,
        actual: val,
        predicted: val,
        upperBound: val + 2,
        lowerBound: Math.max(val - 2, 0),
        probability: Math.min(Math.round(val * 0.4), 30),
      });
    }

    // Future Predicted Points (next 15-48 minutes)
    const lastVal = data[historicalCount - 1].actual;
    for (let j = 1; j <= futureCount; j++) {
      const t = new Date(now + j * stepMs);
      const timeStr = '+' + (j * intervalMinutes) + 'm (' + t.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ')';
      // Accelerated slope leading to saturation
      const projected = Math.min(Math.round(lastVal + j * 2.8 + Math.sin(j * 0.3) * 1.5), 98);
      // Expanding uncertainty fan
      const spread = Math.round(2 + j * 0.75);

      data.push({
        time: timeStr,
        isFuture: true,
        actual: null,
        predicted: projected,
        upperBound: Math.min(projected + spread, 100),
        lowerBound: Math.max(projected - spread, 20),
        probability: Math.min(Math.round(projected * 0.95), 96),
      });
    }

    return data;
  }, [horizon]);

  // Coordinate scales
  const padding = { top: 25, right: 35, bottom: 35, left: 45 };
  const width = 820;
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const getX = (index) => padding.left + (index / (points.length - 1)) * chartWidth;
  const getY = (val) => padding.top + chartHeight - (val / 100) * chartHeight;

  // Split historical vs predicted
  const historicalIndexEnd = 11;
  const splitX = getX(historicalIndexEnd);

  // SVG Paths
  const actualPoints = points
    .filter((_, i) => i <= historicalIndexEnd)
    .map((p, i) => `${getX(i)},${getY(p.actual)}`)
    .join(' ');

  const predictedPoints = points
    .filter((_, i) => i >= historicalIndexEnd)
    .map((p, idx) => `${getX(historicalIndexEnd + idx)},${getY(p.predicted)}`)
    .join(' ');

  // Confidence Band Area (Upper bound + reversed lower bound)
  const futurePoints = points.slice(historicalIndexEnd);
  const upperPath = futurePoints.map((p, idx) => `${getX(historicalIndexEnd + idx)},${getY(p.upperBound)}`).join(' ');
  const lowerPathReversed = futurePoints
    .slice()
    .reverse()
    .map((p, idx) => `${getX(points.length - 1 - idx)},${getY(p.lowerBound)}`)
    .join(' ');
  const confidenceBandArea = `${upperPath} ${lowerPathReversed}`;

  // Saturation Inflection Point (where predicted crosses 80%)
  const saturationPointIndex = points.findIndex((p) => p.predicted >= 80);
  const saturationPoint = saturationPointIndex !== -1 ? points[saturationPointIndex] : null;

  // Handle Mouse Hover
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
    const idx = Math.round(ratio * (points.length - 1));
    setHoverIndex(Math.max(0, Math.min(points.length - 1, idx)));
  };

  const handleMouseLeave = () => {
    setHoverIndex(null);
  };

  const activePoint = hoverIndex !== null ? points[hoverIndex] : points[points.length - 1];

  return (
    <div
      className={`ai-prediction-forecast-chart ${className}`}
      style={{
        backgroundColor: '#FFFFFF',
        border: '1px solid var(--dash-border)',
        padding: '20px',
        position: 'relative',
      }}
    >
      {/* Header with Title and Forecast Controls */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          marginBottom: '16px',
          paddingBottom: '14px',
          borderBottom: '1px solid #F1F5F9',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={18} color="#059669" />
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--dash-text-primary)', margin: 0 }}>
              {title}
            </h3>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.6875rem',
                fontWeight: 700,
                padding: '2px 8px',
                backgroundColor: 'rgba(5, 150, 105, 0.1)',
                color: '#059669',
                border: '1px solid #34D399',
              }}
            >
              MỤC TIÊU: {targetService.toUpperCase()}
            </span>
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--dash-text-secondary)', margin: '2px 0 0 0' }}>
            {subtitle}
          </p>
        </div>

        {/* Forecast Range and Series Controls */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px' }}>
          {/* Horizon Toggle */}
          <div style={{ display: 'flex', backgroundColor: 'rgba(61, 59, 79, 0.05)', padding: '2px', border: '1px solid var(--dash-border)' }}>
            {[
              { id: '15m', label: '+15 phút' },
              { id: '30m', label: '+30 phút' },
              { id: '60m', label: '+1 giờ' },
            ].map((h) => (
              <button
                key={h.id}
                type="button"
                onClick={() => setHorizon(h.id)}
                style={{
                  padding: '3px 8px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.6875rem',
                  fontWeight: 700,
                  backgroundColor: horizon === h.id ? '#FFFFFF' : 'transparent',
                  color: horizon === h.id ? 'var(--dash-text-primary)' : 'var(--dash-text-secondary)',
                  border: 'none',
                  boxShadow: horizon === h.id ? 'var(--dash-shadow-xs)' : 'none',
                  cursor: 'pointer',
                }}
              >
                {h.label}
              </button>
            ))}
          </div>

          {/* Confidence Band Toggle */}
          <button
            type="button"
            onClick={() => setShowConfidenceBand(!showConfidenceBand)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '4px 8px',
              backgroundColor: showConfidenceBand ? '#EFF6FF' : 'transparent',
              border: showConfidenceBand ? '1px solid #93C5FD' : '1px solid var(--dash-border)',
              color: showConfidenceBand ? '#2563EB' : 'var(--dash-text-muted)',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.6875rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <span>Dải tin cậy 85-95%</span>
          </button>
        </div>
      </div>

      {/* SVG Canvas Area */}
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
            <linearGradient id="actualGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#059669" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#059669" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="confidenceGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#F59E0B" stopOpacity="0.05" />
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

          {/* 80% Saturation Reference Line */}
          <g>
            <line
              x1={padding.left}
              y1={getY(80)}
              x2={width - padding.right}
              y2={getY(80)}
              stroke="#E11D48"
              strokeWidth="1.5"
              strokeDasharray="4 4"
              strokeOpacity="0.85"
            />
            <rect
              x={width - padding.right - 120}
              y={getY(80) - 10}
              width="120"
              height="20"
              fill="#FFF1F2"
              stroke="#FDA4AF"
              strokeWidth="1"
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
              NGƯỠNG NGUY HIỂM 80%
            </text>
          </g>

          {/* Vertical Split Line: "NOW / HIỆN TẠI" */}
          <line
            x1={splitX}
            y1={padding.top}
            x2={splitX}
            y2={height - padding.bottom}
            stroke="#64748B"
            strokeWidth="1.5"
            strokeDasharray="3 3"
          />
          <rect
            x={splitX - 32}
            y={padding.top - 12}
            width="64"
            height="18"
            fill="#0F172A"
            rx="2"
          />
          <text
            x={splitX}
            y={padding.top}
            textAnchor="middle"
            fontFamily="monospace"
            fontSize="9"
            fontWeight="700"
            fill="#38BDF8"
          >
            HIỆN TẠI
          </text>

          {/* Future Confidence Interval Band */}
          {showConfidenceBand && (
            <polygon points={confidenceBandArea} fill="url(#confidenceGrad)" />
          )}

          {/* Actual Historical Line */}
          <polyline
            fill="none"
            stroke="#059669"
            strokeWidth="2.4"
            points={actualPoints}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Predicted Future Line (Dashed) */}
          <polyline
            fill="none"
            stroke="#F59E0B"
            strokeWidth="2.4"
            strokeDasharray="5 4"
            points={predictedPoints}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Saturation Inflection Point Marker */}
          {saturationPoint && (
            <g>
              <circle
                cx={getX(saturationPointIndex)}
                cy={getY(saturationPoint.predicted)}
                r="6"
                fill="#EF4444"
                stroke="#FFFFFF"
                strokeWidth="2"
              />
              <rect
                x={getX(saturationPointIndex) - 55}
                y={getY(saturationPoint.predicted) - 32}
                width="110"
                height="22"
                fill="#FEF2F2"
                stroke="#EF4444"
                strokeWidth="1"
                rx="2"
              />
              <text
                x={getX(saturationPointIndex)}
                y={getY(saturationPoint.predicted) - 18}
                textAnchor="middle"
                fontFamily="monospace"
                fontSize="9"
                fontWeight="700"
                fill="#B91C1C"
              >
                ĐIỂM BÙNG PHÁT (~{saturationPointIndex - historicalIndexEnd * 3}m)
              </text>
            </g>
          )}

          {/* X Axis Time Labels */}
          {points.map((d, i) => {
            if (i % 3 !== 0 && i !== points.length - 1 && i !== historicalIndexEnd) return null;
            const isNow = i === historicalIndexEnd;
            return (
              <text
                key={i}
                x={getX(i)}
                y={height - 10}
                textAnchor="middle"
                fontFamily="monospace"
                fontSize="10"
                fill={isNow ? '#0F172A' : d.isFuture ? '#D97706' : '#64748B'}
                fontWeight={isNow ? '800' : 'normal'}
              >
                {d.time.split(' ')[0]}
              </text>
            );
          })}

          {/* Hover Crosshair and Dot */}
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
              <circle
                cx={getX(hoverIndex)}
                cy={getY(activePoint.isFuture ? activePoint.predicted : activePoint.actual)}
                r="5"
                fill="#FFFFFF"
                stroke={activePoint.isFuture ? '#F59E0B' : '#059669'}
                strokeWidth="3"
              />
            </g>
          )}
        </svg>

        {/* Floating Tooltip Window */}
        {hoverIndex !== null && (
          <div
            style={{
              position: 'absolute',
              top: '10px',
              left: `${Math.min(Math.max((getX(hoverIndex) / width) * 100, 16), 74)}%`,
              transform: 'translateX(-50%)',
              backgroundColor: '#0F172A',
              color: '#FFFFFF',
              padding: '10px 14px',
              borderRadius: '2px',
              boxShadow: '0 4px 14px rgba(0,0,0,0.25)',
              pointerEvents: 'none',
              zIndex: 30,
              minWidth: '220px',
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
              <span>THỜI ĐIỂM:</span>
              <strong style={{ color: activePoint.isFuture ? '#FBBF24' : '#34D399' }}>
                {activePoint.time} {activePoint.isFuture ? '(DỰ BÁO AI)' : '(THỰC TẾ)'}
              </strong>
            </div>

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
                {metricType === 'RAM' ? <HardDrive size={13} /> : <Cpu size={13} />}
                <span>{metricType} Tiêu thụ:</span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontWeight: 800, color: '#FFFFFF' }}>
                  {activePoint.isFuture ? activePoint.predicted : activePoint.actual}%
                </span>
                <span style={{ fontSize: '0.6875rem', color: '#94A3B8', marginLeft: '4px' }}>
                  ({(((activePoint.isFuture ? activePoint.predicted : activePoint.actual) / 100) * totalCapacity).toFixed(1)} / {totalCapacity} {unit})
                </span>
              </div>
            </div>

            {activePoint.isFuture && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.6875rem',
                  color: '#CBD5E1',
                  marginBottom: '4px',
                }}
              >
                <span>Biên độ tin cậy 95%:</span>
                <span>{activePoint.lowerBound}% - {activePoint.upperBound}%</span>
              </div>
            )}

            <div
              style={{
                marginTop: '6px',
                paddingTop: '4px',
                borderTop: '1px solid rgba(255,255,255,0.1)',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.6875rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                color: activePoint.probability >= 80 ? '#F87171' : activePoint.probability >= 50 ? '#FBBF24' : '#34D399',
              }}
            >
              <span>XÁC SUẤT SỰ CỐ:</span>
              <strong>{activePoint.probability}% {activePoint.probability >= 80 ? '(BÙNG PHÁT NGUY HIỂM)' : ''}</strong>
            </div>
          </div>
        )}
      </div>

      {/* Insight Summary Footer */}
      <div
        style={{
          marginTop: '16px',
          paddingTop: '12px',
          borderTop: '1px dashed var(--dash-border)',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '12px',
        }}
      >
        <div style={{ padding: '8px 12px', backgroundColor: 'rgba(5, 150, 105, 0.05)', border: '1px solid rgba(5, 150, 105, 0.2)' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: '#065F46', fontWeight: 700 }}>
            TẢI THỰC TẾ HIỆN TẠI
          </div>
          <div style={{ fontSize: '1rem', fontWeight: 800, color: '#064E3B' }}>
            {points[historicalIndexEnd].actual}% ({((points[historicalIndexEnd].actual / 100) * totalCapacity).toFixed(1)} {unit})
          </div>
        </div>

        <div style={{ padding: '8px 12px', backgroundColor: '#FFFBEB', border: '1px solid #FDE68A' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: '#92400E', fontWeight: 700 }}>
            DỰ BÁO ĐỈNH TRONG {horizon === '15m' ? '15 PHÚT' : horizon === '30m' ? '30 PHÚT' : '1 GIỜ'}
          </div>
          <div style={{ fontSize: '1rem', fontWeight: 800, color: '#B45309' }}>
            {points[points.length - 1].predicted}% ({((points[points.length - 1].predicted / 100) * totalCapacity).toFixed(1)} {unit})
          </div>
        </div>

        <div style={{ padding: '8px 12px', backgroundColor: '#FEF2F2', border: '1px solid #FECACA' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: '#991B1B', fontWeight: 700 }}>
            HÀNH ĐỘNG TỰ PHỤC HỒI ĐỀ XUẤT
          </div>
          <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#DC2626', lineHeight: 1.3 }}>
            Tự động Scale Replicas +1 hoặc Kích hoạt HITL Drain Node
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIPredictionForecastChart;
