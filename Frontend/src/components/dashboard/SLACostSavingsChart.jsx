import React, { useState, useRef, useMemo, useCallback } from 'react';
import {
  TrendingUp,
  Activity,
  ShieldCheck,
  Wrench,
  Zap,
  Sparkles
} from 'lucide-react';

/**
 * Helper to compute smooth cubic bezier spline curve through points
 */
function getSmoothCurve(pts) {
  if (!pts || pts.length === 0) return '';
  if (pts.length === 1) return `M ${pts[0].x},${pts[0].y}`;
  if (pts.length === 2) return `M ${pts[0].x},${pts[0].y} L ${pts[1].x},${pts[1].y}`;

  let path = `M ${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = i === 0 ? pts[0] : pts[i - 1];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = i + 2 < pts.length ? pts[i + 2] : p2;

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    path += ` C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }
  return path;
}

/**
 * SLACostSavingsChart
 * Biểu đồ SVG thông minh tích hợp 2 chế độ xem chuyên sâu:
 * 1. Chế độ SLA & Uptime: Đánh giá cam kết SLA 99.9% và số vụ tự phục hồi.
 * 2. Chế độ Tự Trị SRE & MTTR: Đánh giá tốc độ hồi sinh Pod (giây) và tỷ lệ AI tự phục hồi (%).
 */
export const SLACostSavingsChart = ({
  title = 'Cam Kết & Xu Hướng SLA Uptime',
  subtitle = 'Đối chiếu thời gian hoạt động thực tế với cam kết chuẩn SLA 99.9% và số lượng sự cố tự phục hồi',
  className = '',
  height = 270,
  trendsData = null,
  summary = null,
  showSummaryCards = false,
}) => {
  const [chartMode, setChartMode] = useState('SLA'); // 'SLA' | 'AUTONOMOUS'
  const isSlaMode = chartMode === 'SLA';

  const [hoverIndex, setHoverIndex] = useState(null);
  const svgRef = useRef(null);

  const data = Array.isArray(trendsData) && trendsData.length > 0
    ? trendsData
    : [
        { month: 'Tuần 1', uptime: 100.0, slaTarget: 99.9, preventedIncidents: 0, downtimeAvoidedHours: 0.0, mttrSeconds: 14.5, autonomousHealingRate: 100.0 },
        { month: 'Tuần 2', uptime: 99.99, slaTarget: 99.9, preventedIncidents: 4, downtimeAvoidedHours: 1.2, mttrSeconds: 12.0, autonomousHealingRate: 98.2 },
        { month: 'Tuần 3', uptime: 99.97, slaTarget: 99.9, preventedIncidents: 142, downtimeAvoidedHours: 42.6, mttrSeconds: 12.4, autonomousHealingRate: 97.0 },
        { month: 'Tuần 4', uptime: 99.92, slaTarget: 99.9, preventedIncidents: 1673, downtimeAvoidedHours: 501.9, mttrSeconds: 12.6, autonomousHealingRate: 97.0 },
      ];

  const padding = { top: 34, right: 75, bottom: 32, left: 56 };
  const width = 820;
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const baselineY = padding.top + chartHeight;

  // --- 1. THANG ĐO CHO CHẾ ĐỘ SLA ---
  const maxIncVal = Math.max(...data.map((d) => Number(d.preventedIncidents) || 0), 1);
  const incStep = Math.max(1, Math.ceil(maxIncVal / 3));
  const maxIncidents = incStep * 3;
  const incidentTicks = [maxIncidents, incStep * 2, incStep * 1, 0];

  const getYIncidents = (val) => {
    if (!val || val <= 0) return baselineY;
    const ratio = Math.min(1, Math.max(0, val / maxIncidents));
    return baselineY - ratio * (chartHeight * 0.35);
  };

  const slaTargetY = padding.top + chartHeight * 0.28;

  const getYUptime = (val) => {
    const numeric = Number(val) || 99.90;
    if (numeric >= 99.90) {
      const ratio = Math.min(1, Math.max(0, (numeric - 99.90) / 0.10));
      return slaTargetY - ratio * (slaTargetY - (padding.top + 10));
    }
    const ratio = Math.min(1, Math.max(0, (99.90 - numeric) / 0.10));
    return slaTargetY + ratio * (chartHeight * 0.16);
  };

  // --- 2. THANG ĐO CHO CHẾ ĐỘ AUTONOMOUS (MTTR & TỶ LỆ TỰ TRỊ) ---
  const maxMttrVal = Math.max(...data.map((d) => Number(d.mttrSeconds) || 15), 30);
  const mttrStep = Math.ceil(maxMttrVal / 3);
  const maxMttr = mttrStep * 3;
  const mttrTicks = [maxMttr, mttrStep * 2, mttrStep * 1, 0];

  const getYMttr = (val) => {
    if (!val || val <= 0) return baselineY;
    const ratio = Math.min(1, Math.max(0, val / maxMttr));
    return baselineY - ratio * (chartHeight * 0.35);
  };

  const autoTargetY = padding.top + chartHeight * 0.28; // Ngưỡng mục tiêu tự trị 95.0%

  const getYAutoRate = (val) => {
    const numeric = Number(val) || 95.0;
    if (numeric >= 95.0) {
      const ratio = Math.min(1, Math.max(0, (numeric - 95.0) / 5.0));
      return autoTargetY - ratio * (autoTargetY - (padding.top + 10));
    }
    const ratio = Math.min(1, Math.max(0, (95.0 - numeric) / 5.0));
    return autoTargetY + ratio * (chartHeight * 0.16);
  };

  // Khoảng đệm ngang để cột không chạm nhãn trục
  const innerMargin = data.length <= 4 ? 54 : 38;
  const innerWidth = chartWidth - 2 * innerMargin;

  const getX = (i) => padding.left + innerMargin + (data.length > 1 ? (i / (data.length - 1)) * innerWidth : innerWidth / 2);

  const leftTicks = isSlaMode ? incidentTicks : mttrTicks;
  const targetLineY = isSlaMode ? slaTargetY : autoTargetY;
  const targetLineLabel = isSlaMode ? 'SLA Mục tiêu (99.9%)' : 'Mục tiêu Tự Trị (>95.0%)';

  const points = useMemo(() => {
    return data.map((d, i) => ({
      x: getX(i),
      y: isSlaMode ? getYUptime(d.uptime) : getYAutoRate(d.autonomousHealingRate ?? 100),
      raw: d,
    }));
  }, [data, isSlaMode, chartHeight, targetLineY, innerMargin, innerWidth]);

  const curvePath = useMemo(() => getSmoothCurve(points), [points]);
  const areaPath = useMemo(() => {
    return points.length > 0
      ? `${curvePath} L ${points[points.length - 1].x},${baselineY} L ${points[0].x},${baselineY} Z`
      : '';
  }, [curvePath, points, baselineY]);

  const handleMouseMove = useCallback((e) => {
    if (!svgRef.current || data.length === 0) return;
    const rect = svgRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const relativeX = (mouseX / rect.width) * width;

    if (relativeX < padding.left || relativeX > width - padding.right) {
      setHoverIndex((prev) => (prev !== null ? null : prev));
      return;
    }

    const startX = padding.left + innerMargin;
    const colWidth = innerWidth / (data.length > 1 ? data.length - 1 : 1);
    const index = Math.round((relativeX - startX) / colWidth);
    const clampedIndex = Math.max(0, Math.min(data.length - 1, index));
    setHoverIndex((prev) => (prev !== clampedIndex ? clampedIndex : prev));
  }, [data.length, innerMargin, innerWidth, padding.left, padding.right, width]);

  const handleMouseLeave = useCallback(() => {
    setHoverIndex((prev) => (prev !== null ? null : prev));
  }, []);

  const hoveredData = hoverIndex !== null ? data[hoverIndex] : null;

  const tooltipXPercent = hoverIndex !== null && data.length > 0
    ? Math.max(22, Math.min(78, (getX(hoverIndex) / width) * 100))
    : 50;

  return (
    <div
      className={`dash-card ${className}`}
      style={{
        padding: '16px 20px',
        backgroundColor: '#FFFFFF',
        borderRadius: '14px',
        boxShadow: '0 2px 10px -2px rgba(15, 23, 42, 0.05)',
        border: '1px solid #E2E8F0',
        position: 'relative',
      }}
    >
      {/* Card Header & Segmented Mode Switcher */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {isSlaMode ? (
              <TrendingUp size={20} color="#10B981" strokeWidth={2.5} />
            ) : (
              <Zap size={20} color="#7C3AED" strokeWidth={2.5} />
            )}
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, color: '#0F172A', letterSpacing: '-0.02em' }}>
              {isSlaMode ? title : 'Hiệu Năng AI Tự Trị & Tốc Độ Hồi Sinh MTTR'}
            </h3>
          </div>
          <p style={{ fontSize: '0.75rem', color: '#64748B', margin: '2px 0 0 0', lineHeight: 1.4, maxWidth: '580px' }}>
            {isSlaMode
              ? subtitle
              : 'Đánh giá tốc độ phục hồi sự cố trung bình (MTTR tính bằng giây) và tỷ lệ can thiệp tự động thành công của hệ thống Multi-Agent'}
          </p>
        </div>

        {/* NÚT CHUYỂN ĐỔI CHẾ ĐỘ XEM BIỂU ĐỒ (SLA vs HIỆU NĂNG TỰ TRỊ) */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
          <div
            style={{
              display: 'inline-flex',
              backgroundColor: '#F1F5F9',
              padding: '3px',
              borderRadius: '8px',
              border: '1px solid #E2E8F0',
            }}
          >
            <button
              type="button"
              onClick={() => setChartMode('SLA')}
              title="Xem cam kết SLA chuẩn 99.9% và số vụ sự cố tự phục hồi"
              style={{
                padding: '5px 12px',
                fontSize: '0.75rem',
                fontWeight: isSlaMode ? 700 : 500,
                backgroundColor: isSlaMode ? '#FFFFFF' : 'transparent',
                color: isSlaMode ? '#0284C7' : '#64748B',
                borderRadius: '6px',
                border: 'none',
                boxShadow: isSlaMode ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                transition: 'all 0.15s ease',
              }}
            >
              <ShieldCheck size={14} color={isSlaMode ? '#0284C7' : '#64748B'} />
              <span>1. SLA Uptime & Sự Cố</span>
            </button>
            <button
              type="button"
              onClick={() => setChartMode('AUTONOMOUS')}
              title="Xem tốc độ hồi sinh MTTR (giây) và tỷ lệ tự trị AI thành công"
              style={{
                padding: '5px 12px',
                fontSize: '0.75rem',
                fontWeight: !isSlaMode ? 700 : 500,
                backgroundColor: !isSlaMode ? '#FFFFFF' : 'transparent',
                color: !isSlaMode ? '#7C3AED' : '#64748B',
                borderRadius: '6px',
                border: 'none',
                boxShadow: !isSlaMode ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                transition: 'all 0.15s ease',
              }}
            >
              <Activity size={14} color={!isSlaMode ? '#7C3AED' : '#64748B'} />
              <span>2. Tốc Độ MTTR & AI Tự Trị</span>
            </button>
          </div>

          {/* Dynamic Legend */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '0.75rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: isSlaMode ? '#10B981' : '#8B5CF6',
                  display: 'inline-block',
                }}
              />
              <span style={{ color: '#334155', fontWeight: 500 }}>
                {isSlaMode ? 'Sự cố tự phục hồi (vụ)' : 'Tốc độ hồi sinh MTTR (giây)'}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span
                style={{
                  width: '16px',
                  height: '2.5px',
                  backgroundColor: isSlaMode ? '#1D4ED8' : '#0D9488',
                  borderRadius: '2px',
                  display: 'inline-block',
                }}
              />
              <span style={{ color: '#334155', fontWeight: 500 }}>
                {isSlaMode ? 'Uptime thực tế (%)' : 'Tỷ lệ AI tự phục hồi (%)'}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ color: '#94A3B8', fontFamily: 'monospace', fontWeight: 700, fontSize: '0.75rem', letterSpacing: '1px' }}>--</span>
              <span style={{ color: '#64748B', fontWeight: 500 }}>{targetLineLabel}</span>
            </div>
          </div>
        </div>
      </div>

      {/* SVG Container */}
      <div style={{ position: 'relative', width: '100%', overflow: 'hidden' }}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${width} ${height}`}
          style={{ width: '100%', height: 'auto', display: 'block', cursor: 'crosshair' }}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          <defs>
            {/* SLA Bar Gradient: Vibrant Green */}
            <linearGradient id="slaBarGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22C55E" />
              <stop offset="100%" stopColor="#059669" />
            </linearGradient>

            {/* Autonomous Bar Gradient: Tech Violet */}
            <linearGradient id="autoBarGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#A855F7" />
              <stop offset="100%" stopColor="#6D28D9" />
            </linearGradient>

            {/* SLA Uptime Area Gradient: Blue */}
            <linearGradient id="slaAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.18" />
              <stop offset="70%" stopColor="#3B82F6" stopOpacity="0.04" />
              <stop offset="100%" stopColor="#3B82F6" stopOpacity="0" />
            </linearGradient>

            {/* Autonomous Healing Area Gradient: Teal */}
            <linearGradient id="autoAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#14B8A6" stopOpacity="0.18" />
              <stop offset="70%" stopColor="#14B8A6" stopOpacity="0.04" />
              <stop offset="100%" stopColor="#14B8A6" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Đường nét đứt Mục Tiêu Tham Chiếu */}
          <line
            x1={padding.left}
            y1={targetLineY}
            x2={width - padding.right}
            y2={targetLineY}
            stroke="#94A3B8"
            strokeWidth="1.2"
            strokeDasharray="5,5"
          />

          {/* Trục Y Bên Trái & Đường Lưới Ngang */}
          {leftTicks.map((val) => {
            const y = isSlaMode ? getYIncidents(val) : getYMttr(val);
            const labelText = isSlaMode
              ? (val >= 1000 ? `${(val / 1000).toFixed(1)}k vụ` : `${val} vụ`)
              : `${val}s`;

            return (
              <g key={`left-grid-${val}`}>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={width - padding.right}
                  y2={y}
                  stroke={val === 0 ? '#E2E8F0' : '#F1F5F9'}
                  strokeWidth="1"
                />
                <text
                  x={padding.left - 10}
                  y={y + 4}
                  textAnchor="end"
                  fontSize="11"
                  fontWeight="500"
                  fontFamily="system-ui, -apple-system, sans-serif"
                  fill="#64748B"
                >
                  {labelText}
                </text>
              </g>
            );
          })}

          {/* Nhãn Mục Tiêu Tham Chiếu ở góc trái đường nét đứt (thoáng đãng) */}
          <text
            x={padding.left + 8}
            y={targetLineY - 6}
            textAnchor="start"
            fontSize="10"
            fontWeight="600"
            fontFamily="system-ui, -apple-system, sans-serif"
            fill={isSlaMode ? '#0284C7' : '#7C3AED'}
          >
            {targetLineLabel}
          </text>

          {/* Trục Y Bên Phải (Tỷ lệ phần trăm %) */}
          {isSlaMode ? (
            <>
              <text
                x={width - padding.right + 12}
                y={padding.top + 10}
                textAnchor="start"
                fontSize="11"
                fontWeight="600"
                fontFamily="system-ui, -apple-system, sans-serif"
                fill="#64748B"
              >
                100.00%
              </text>
              <text
                x={width - padding.right + 12}
                y={slaTargetY + 4}
                textAnchor="start"
                fontSize="11"
                fontWeight="700"
                fontFamily="system-ui, -apple-system, sans-serif"
                fill="#2563EB"
              >
                99.90%
              </text>
              <text
                x={width - padding.right + 12}
                y={slaTargetY + chartHeight * 0.16 + 4}
                textAnchor="start"
                fontSize="11"
                fontWeight="500"
                fontFamily="system-ui, -apple-system, sans-serif"
                fill="#94A3B8"
              >
                99.80%
              </text>
            </>
          ) : (
            <>
              <text
                x={width - padding.right + 12}
                y={padding.top + 10}
                textAnchor="start"
                fontSize="11"
                fontWeight="600"
                fontFamily="system-ui, -apple-system, sans-serif"
                fill="#64748B"
              >
                100.0%
              </text>
              <text
                x={width - padding.right + 12}
                y={autoTargetY + 4}
                textAnchor="start"
                fontSize="11"
                fontWeight="700"
                fontFamily="system-ui, -apple-system, sans-serif"
                fill="#0D9488"
              >
                95.0%
              </text>
              <text
                x={width - padding.right + 12}
                y={autoTargetY + chartHeight * 0.16 + 4}
                textAnchor="start"
                fontSize="11"
                fontWeight="500"
                fontFamily="system-ui, -apple-system, sans-serif"
                fill="#94A3B8"
              >
                90.0%
              </text>
            </>
          )}

          {/* Đường Con Trỏ Dọc khi Hover */}
          {hoverIndex !== null && (
            <line
              x1={getX(hoverIndex)}
              y1={padding.top}
              x2={getX(hoverIndex)}
              y2={baselineY}
              stroke="#CBD5E1"
              strokeWidth="1.5"
              strokeDasharray="4,4"
              pointerEvents="none"
            />
          )}

          {/* Diện tích phía dưới đường cong */}
          {areaPath && (
            <path
              d={areaPath}
              fill={isSlaMode ? 'url(#slaAreaGrad)' : 'url(#autoAreaGrad)'}
              pointerEvents="none"
            />
          )}

          {/* Đường cong mượt mà */}
          {curvePath && (
            <path
              d={curvePath}
              fill="none"
              stroke={isSlaMode ? '#1D4ED8' : '#0D9488'}
              strokeWidth="3.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              pointerEvents="none"
            />
          )}

          {/* CỘT DỮ LIỆU & HUY HIỆU SỐ LIỆU TRÊN CỘT */}
          {data.map((d, i) => {
            const cx = getX(i);
            const barW = data.length <= 4 ? 18 : 14;
            const incidentVal = Number(d.preventedIncidents) || 0;
            const mttrVal = Number(d.mttrSeconds) || 15;

            const barTopY = isSlaMode ? getYIncidents(incidentVal) : getYMttr(mttrVal);
            const barH = isSlaMode
              ? (incidentVal > 0 ? baselineY - barTopY : 0)
              : (mttrVal > 0 ? baselineY - barTopY : 0);

            const isHovered = hoverIndex === i;
            const badgeText = isSlaMode ? `${incidentVal} vụ` : `${mttrVal}s`;
            const badgeW = Math.max(34, badgeText.length * 6 + 10);

            return (
              <g key={`bar-${d.month}`}>
                {/* Cột chính */}
                {barH > 0 && (
                  <rect
                    x={cx - barW / 2}
                    y={barTopY}
                    width={barW}
                    height={barH}
                    rx={5}
                    ry={5}
                    fill={isSlaMode ? 'url(#slaBarGrad)' : 'url(#autoBarGrad)'}
                    opacity={isHovered ? 1 : 0.92}
                    style={{ transition: 'all 0.2s ease' }}
                  />
                )}

                {/* Huy hiệu số liệu trên đỉnh cột */}
                {barH > 0 && (
                  <g style={{ transition: 'all 0.2s ease' }}>
                    <rect
                      x={cx - badgeW / 2}
                      y={barTopY - 18}
                      width={badgeW}
                      height={15}
                      rx={7.5}
                      fill={isSlaMode ? '#ECFDF5' : '#F3E8FF'}
                      stroke={isSlaMode ? '#A7F3D0' : '#DDD6FE'}
                      strokeWidth="1"
                    />
                    <text
                      x={cx}
                      y={barTopY - 7}
                      textAnchor="middle"
                      fontSize="9.5"
                      fontWeight="600"
                      fontFamily="system-ui, -apple-system, sans-serif"
                      fill={isSlaMode ? '#059669' : '#7C3AED'}
                    >
                      {badgeText}
                    </text>
                  </g>
                )}

                {/* Nhãn Trục X (Tuần / Tháng) */}
                <text
                  x={cx}
                  y={baselineY + 18}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight={isHovered ? '700' : '500'}
                  fontFamily="system-ui, -apple-system, sans-serif"
                  fill={isHovered ? '#0F172A' : '#64748B'}
                >
                  {d.month}
                </text>
              </g>
            );
          })}

          {/* ĐIỂM CHẤM TRÊN ĐƯỜNG CONG & NHÃN PHẦN TRĂM */}
          {points.map((pt, i) => {
            const isHovered = hoverIndex === i;
            const labelVal = isSlaMode
              ? `${Number(pt.raw.uptime).toFixed(2)}%`
              : `${(Number(pt.raw.autonomousHealingRate) || 100).toFixed(1)}%`;

            return (
              <g key={`dot-${pt.raw.month}`}>
                {/* Nhãn phần trăm phía trên điểm */}
                <text
                  x={pt.x}
                  y={pt.y - 10}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight="600"
                  fontFamily="system-ui, -apple-system, sans-serif"
                  fill="#334155"
                >
                  {labelVal}
                </text>

                {/* Vầng sáng khi Hover */}
                {isHovered && (
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={9}
                    fill="none"
                    stroke={isSlaMode ? '#2563EB' : '#0D9488'}
                    strokeWidth="2"
                    opacity="0.3"
                  />
                )}

                {/* Điểm tròn */}
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={isHovered ? 6 : 4.5}
                  fill={isSlaMode ? '#1D4ED8' : '#0D9488'}
                  stroke="#FFFFFF"
                  strokeWidth={2}
                  style={{ transition: 'all 0.15s ease' }}
                />
              </g>
            );
          })}
        </svg>

        {/* TOOLTIP TƯƠNG TÁC THÔNG MINH */}
        {hoveredData && (
          <div
            style={{
              position: 'absolute',
              top: '38%',
              left: `${tooltipXPercent}%`,
              transform: 'translate(-50%, -50%)',
              backgroundColor: '#0F172A',
              color: '#FFFFFF',
              borderRadius: '10px',
              padding: '11px 15px',
              boxShadow: '0 12px 28px rgba(0, 0, 0, 0.35)',
              border: isSlaMode ? '1px solid #10B981' : '1px solid #8B5CF6',
              fontSize: '0.75rem',
              pointerEvents: 'none',
              zIndex: 30,
              minWidth: '220px',
              willChange: 'left',
            }}
          >
            {/* Header: Kỳ Báo Cáo | Mục Tiêu */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', borderBottom: '1px solid rgba(255,255,255,0.12)', paddingBottom: '4px' }}>
              <span style={{ fontWeight: 700, color: isSlaMode ? '#2DD4BF' : '#C084FC', fontSize: '0.78rem' }}>
                Kỳ Báo Cáo: {hoveredData.month}
              </span>
              <span style={{ color: '#64748B', margin: '0 4px' }}>|</span>
              <span style={{ color: '#94A3B8', fontWeight: 500 }}>
                {isSlaMode ? `SLA: ${hoveredData.slaTarget}%` : 'Mục tiêu: >95%'}
              </span>
            </div>

            {/* Content theo chế độ xem */}
            {isSlaMode ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', lineHeight: 1.4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#94A3B8' }}>
                    <span style={{ color: '#38BDF8', marginRight: '4px' }}>•</span>
                    Uptime Thực Tế:
                  </span>
                  <strong style={{ color: '#38BDF8' }}>
                    {hoveredData.uptime}%
                  </strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#94A3B8' }}>
                    <span style={{ color: '#34D399', marginRight: '4px' }}>•</span>
                    Sự Cố Tự Phục Hồi:
                  </span>
                  <strong style={{ color: '#34D399' }}>
                    {hoveredData.preventedIncidents} sự cố
                  </strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#94A3B8' }}>
                    <span style={{ color: '#FFFFFF', marginRight: '4px' }}>•</span>
                    Downtime Tránh Được:
                  </span>
                  <strong style={{ color: '#FFFFFF' }}>
                    {hoveredData.downtimeAvoidedHours ?? (Number(hoveredData.preventedIncidents || 0) * 0.3).toFixed(1)} giờ
                  </strong>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', lineHeight: 1.4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#94A3B8' }}>
                    <span style={{ color: '#C084FC', marginRight: '4px' }}>•</span>
                    Tốc Độ Hồi Sinh MTTR:
                  </span>
                  <strong style={{ color: '#C084FC' }}>
                    {hoveredData.mttrSeconds ?? 15} giây
                  </strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#94A3B8' }}>
                    <span style={{ color: '#34D399', marginRight: '4px' }}>•</span>
                    Tỷ Lệ Tự Trị AI:
                  </span>
                  <strong style={{ color: '#34D399' }}>
                    {hoveredData.autonomousHealingRate ?? 100}%
                  </strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#94A3B8' }}>
                    <span style={{ color: '#38BDF8', marginRight: '4px' }}>•</span>
                    Hiệu Năng AI SRE:
                  </span>
                  <strong style={{ color: '#38BDF8' }}>
                    Nhanh hơn 95% thủ công
                  </strong>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3 THẺ TÓM TẮT CHÂN TRANG ĐỘC LẬP (Chỉ hiển thị khi có cờ showSummaryCards) */}
      {showSummaryCards && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '16px',
            marginTop: '22px',
          }}
        >
          <div
            style={{
              padding: '16px 20px',
              backgroundColor: '#FFFFFF',
              borderRadius: '16px',
              border: '1px solid #E2E8F0',
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                backgroundColor: '#EFF6FF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Activity size={22} color="#1D4ED8" strokeWidth={2.2} />
            </div>
            <div>
              <div style={{ color: '#64748B', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.02em', marginBottom: '2px' }}>
                TỔNG THỜI GIAN VẬN HÀNH
              </div>
              <div style={{ fontWeight: 800, color: '#0F172A', fontSize: '1.25rem', letterSpacing: '-0.02em' }}>
                {summary?.totalOperatingHours ? `${summary.totalOperatingHours.toLocaleString('vi-VN')} Giờ liên tục` : '4.320 Giờ liên tục'}
              </div>
            </div>
          </div>

          <div
            style={{
              padding: '16px 20px',
              backgroundColor: '#FFFFFF',
              borderRadius: '16px',
              border: '1px solid #E2E8F0',
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                backgroundColor: '#F0F9FF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <ShieldCheck size={22} color="#0284C7" strokeWidth={2.2} />
            </div>
            <div>
              <div style={{ color: '#64748B', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.02em', marginBottom: '2px' }}>
                CAM KẾT THỰC ĐẠT
              </div>
              <div style={{ fontWeight: 800, color: '#0284C7', fontSize: '1.25rem', letterSpacing: '-0.02em' }}>
                {summary?.actualUptime || '99.98%'} Uptime
              </div>
            </div>
          </div>

          <div
            style={{
              padding: '16px 20px',
              backgroundColor: '#FFFFFF',
              borderRadius: '16px',
              border: '1px solid #E2E8F0',
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                backgroundColor: '#DCFCE7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Wrench size={22} color="#16A34A" strokeWidth={2.2} />
            </div>
            <div>
              <div style={{ color: '#64748B', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.02em', marginBottom: '2px' }}>
                TỔNG SỰ CỐ TỰ VÁ LỖI
              </div>
              <div style={{ fontWeight: 800, color: '#16A34A', fontSize: '1.25rem', letterSpacing: '-0.02em' }}>
                {summary?.totalIncidentsResolved ?? 5} sự cố đã xử lý
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const MemoizedSLACostSavingsChart = React.memo(SLACostSavingsChart);
export default MemoizedSLACostSavingsChart;
