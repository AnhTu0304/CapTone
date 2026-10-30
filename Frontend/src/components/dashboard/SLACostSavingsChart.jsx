import React, { useState, useRef } from 'react';
import {
  TrendingUp,
  Activity,
  ShieldCheck,
  Wrench
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
 * Biểu đồ SVG hiển thị kết hợp Cột sự cố tự phục hồi và Đường cong Uptime thực tế.
 */
export const SLACostSavingsChart = ({
  title = 'Cam Kết & Xu Hướng SLA Uptime (6 Tháng Gần Nhất)',
  subtitle = 'Đối chiếu thời gian hoạt động thực tế 6 tháng với cam kết chuẩn SLA 99.9% và số lượng sự cố tự phục hồi',
  className = '',
  height = 310,
  trendsData = null,
  summary = null,
}) => {
  const [hoverIndex, setHoverIndex] = useState(null);
  const svgRef = useRef(null);

  const data = Array.isArray(trendsData) && trendsData.length > 0
    ? trendsData
    : [
        { month: 'T5/2026', uptime: 99.96, slaTarget: 99.9, preventedIncidents: 1, downtimeAvoidedHours: 0.3 },
        { month: 'T6/2026', uptime: 99.97, slaTarget: 99.9, preventedIncidents: 2, downtimeAvoidedHours: 0.6 },
        { month: 'T7/2026', uptime: 99.98, slaTarget: 99.9, preventedIncidents: 1, downtimeAvoidedHours: 0.3 },
        { month: 'T8/2026', uptime: 99.97, slaTarget: 99.9, preventedIncidents: 1, downtimeAvoidedHours: 0.3 },
        { month: 'T9/2026', uptime: 99.97, slaTarget: 99.9, preventedIncidents: 1, downtimeAvoidedHours: 0.3 },
        { month: 'T10/2026', uptime: 99.98, slaTarget: 99.9, preventedIncidents: 2, downtimeAvoidedHours: 0.6 },
      ];

  const padding = { top: 40, right: 80, bottom: 38, left: 60 };
  const width = 820;
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const baselineY = padding.top + chartHeight;

  // Thang đo trục Y (Sự cố: tự động co giãn theo giá trị cao nhất để không bao giờ bị vượt khung)
  const maxVal = Math.max(...data.map((d) => Number(d.preventedIncidents) || 0), 1);
  const step = Math.max(1, Math.ceil(maxVal / 3));
  const maxIncidents = step * 4;
  const incidentTicks = [maxIncidents, step * 3, step * 2, step * 1, 0];
  const targetIncidentVal = step * 3;

  // Khoảng đệm ngang để cột không chạm hoặc đè lên nhãn trục trái & phải
  const innerMargin = data.length <= 4 ? 54 : 38;
  const innerWidth = chartWidth - 2 * innerMargin;

  const getX = (i) => padding.left + innerMargin + (data.length > 1 ? (i / (data.length - 1)) * innerWidth : innerWidth / 2);
  const getYIncidents = (val) => padding.top + (maxIncidents - Math.min(maxIncidents, Math.max(0, val))) * (chartHeight / maxIncidents);

  // Đường SLA Mục tiêu (99.9%) nằm chính xác ở mốc 3/4 chiều cao (targetIncidentVal)
  const slaTargetY = getYIncidents(targetIncidentVal);

  // Thang đo đường cong Uptime (99.80% - 100.00%)
  const getYUptime = (val) => {
    const numeric = Number(val) || 99.90;
    if (numeric >= 99.90) {
      // 99.90% -> 100.00% hiển thị êm ái phía trên đường nét đứt
      const ratio = Math.min(1, Math.max(0, (numeric - 99.90) / 0.10));
      return slaTargetY - ratio * (chartHeight * 0.22);
    }
    // Dưới 99.90% rơi xuống phía dưới đường nét đứt
    const ratio = Math.min(1, Math.max(0, (99.90 - numeric) / 0.10));
    return slaTargetY + ratio * (chartHeight * 0.25);
  };

  const points = data.map((d, i) => ({
    x: getX(i),
    y: getYUptime(d.uptime),
    raw: d,
  }));

  const curvePath = getSmoothCurve(points);
  const areaPath = points.length > 0
    ? `${curvePath} L ${points[points.length - 1].x},${baselineY} L ${points[0].x},${baselineY} Z`
    : '';

  const handleMouseMove = (e) => {
    if (!svgRef.current || data.length === 0) return;
    const rect = svgRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const relativeX = (mouseX / rect.width) * width;

    if (relativeX < padding.left || relativeX > width - padding.right) {
      setHoverIndex(null);
      return;
    }

    const startX = padding.left + innerMargin;
    const colWidth = innerWidth / (data.length > 1 ? data.length - 1 : 1);
    const index = Math.round((relativeX - startX) / colWidth);
    const clampedIndex = Math.max(0, Math.min(data.length - 1, index));
    setHoverIndex(clampedIndex);
  };

  const handleMouseLeave = () => {
    setHoverIndex(null);
  };

  const hoveredData = hoverIndex !== null ? data[hoverIndex] : null;

  // Tooltip dynamic horizontal position (clamped so it stays beautifully inside)
  const tooltipXPercent = hoverIndex !== null && data.length > 0
    ? Math.max(22, Math.min(78, (getX(hoverIndex) / width) * 100))
    : 50;

  return (
    <div
      className={`dash-card ${className}`}
      style={{
        padding: '24px 28px',
        backgroundColor: '#FFFFFF',
        borderRadius: '20px',
        boxShadow: '0 4px 20px -2px rgba(15, 23, 42, 0.06)',
        border: '1px solid #F1F5F9',
        position: 'relative',
      }}
    >
      {/* Card Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <TrendingUp size={24} color="#10B981" strokeWidth={2.5} />
            <h3 style={{ fontSize: '1.18rem', fontWeight: 800, margin: 0, color: '#0F172A', letterSpacing: '-0.02em' }}>
              {title}
            </h3>
          </div>
          <p style={{ fontSize: '0.84rem', color: '#64748B', margin: '4px 0 0 0', lineHeight: 1.45, maxWidth: '580px' }}>
            {subtitle}
          </p>
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '18px', fontSize: '0.8rem', flexWrap: 'wrap', marginTop: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10B981', display: 'inline-block' }} />
            <span style={{ color: '#334155', fontWeight: 500 }}>Sự cố tự phục hồi (vụ)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
            <span style={{ width: '18px', height: '2.5px', backgroundColor: '#1D4ED8', borderRadius: '2px', display: 'inline-block' }} />
            <span style={{ color: '#334155', fontWeight: 500 }}>Uptime thực tế (%)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ color: '#94A3B8', fontFamily: 'monospace', fontWeight: 700, fontSize: '0.75rem', letterSpacing: '1px' }}>--</span>
            <span style={{ color: '#64748B', fontWeight: 500 }}>SLA Mục tiêu (99.9%)</span>
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
            {/* Bar Vibrant Gradient (Top: #22C55E -> Bottom: #059669) */}
            <linearGradient id="targetBarGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22C55E" />
              <stop offset="100%" stopColor="#059669" />
            </linearGradient>

            {/* Uptime Area Gradient */}
            <linearGradient id="uptimeAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.18" />
              <stop offset="70%" stopColor="#3B82F6" stopOpacity="0.04" />
              <stop offset="100%" stopColor="#3B82F6" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Horizontal Grid lines for Incidents */}
          {incidentTicks.map((val) => {
            const y = getYIncidents(val);
            const isTargetLine = val === targetIncidentVal;

            return (
              <g key={`incident-grid-${val}`}>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={width - padding.right}
                  y2={y}
                  stroke={isTargetLine ? '#CBD5E1' : '#F1F5F9'}
                  strokeWidth={isTargetLine ? '1.5' : '1'}
                  strokeDasharray={isTargetLine ? '5,5' : undefined}
                />
                <text
                  x={padding.left - 12}
                  y={y + 4}
                  textAnchor="end"
                  fontSize="12"
                  fontWeight="500"
                  fontFamily="system-ui, -apple-system, sans-serif"
                  fill="#334155"
                >
                  {val} vụ
                </text>
              </g>
            );
          })}

          {/* Right Axis Labels for Uptime */}
          <text
            x={width - padding.right + 12}
            y={padding.top + 4}
            textAnchor="start"
            fontSize="12"
            fontWeight="500"
            fontFamily="system-ui, -apple-system, sans-serif"
            fill="#334155"
          >
            100.00%
          </text>
          <text
            x={width - padding.right + 12}
            y={slaTargetY + 4}
            textAnchor="start"
            fontSize="12"
            fontWeight="500"
            fontFamily="system-ui, -apple-system, sans-serif"
            fill="#334155"
          >
            99.90%
          </text>
          <text
            x={width - padding.right + 12}
            y={baselineY + 4}
            textAnchor="start"
            fontSize="12"
            fontWeight="500"
            fontFamily="system-ui, -apple-system, sans-serif"
            fill="#334155"
          >
            99.80%
          </text>

          {/* Label below the SLA Target 99.9% dashed line on right */}
          <text
            x={width - padding.right - 10}
            y={slaTargetY + 16}
            textAnchor="end"
            fontSize="11"
            fontWeight="500"
            fontFamily="system-ui, -apple-system, sans-serif"
            fill="#64748B"
          >
            SLA Mục tiêu (99.9%)
          </text>

          {/* Vertical Crosshair Line on Hover */}
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

          {/* Area under Uptime curve */}
          {areaPath && (
            <path
              d={areaPath}
              fill="url(#uptimeAreaGrad)"
              pointerEvents="none"
            />
          )}

          {/* Smooth Curved Line for Uptime */}
          {curvePath && (
            <path
              d={curvePath}
              fill="none"
              stroke="#1D4ED8"
              strokeWidth="3.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              pointerEvents="none"
            />
          )}

          {/* CỘT SỰ CỐ TỰ PHỤC HỒI & SỐ LIỆU TRÊN CỘT */}
          {data.map((d, i) => {
            const cx = getX(i);
            const barW = data.length <= 4 ? 48 : 42;
            const incidentVal = Number(d.preventedIncidents) || 0;
            const barTopY = getYIncidents(incidentVal);
            const barH = incidentVal > 0 ? baselineY - barTopY : 4;
            const isHovered = hoverIndex === i;

            return (
              <g key={`bar-${d.month}`}>
                {/* Main Vibrant Green Column */}
                <rect
                  x={cx - barW / 2}
                  y={incidentVal > 0 ? barTopY : baselineY - 4}
                  width={barW}
                  height={barH}
                  rx={8}
                  ry={8}
                  fill="url(#targetBarGrad)"
                  opacity={isHovered ? 1 : 0.95}
                  style={{ transition: 'all 0.2s ease' }}
                />

                {/* SỐ LIỆU TRÊN ĐỈNH CỘT (Pill Badge) */}
                {incidentVal > 0 && (
                  <g style={{ transition: 'all 0.2s ease' }}>
                    <rect
                      x={cx - 18}
                      y={barTopY - 22}
                      width={36}
                      height={18}
                      rx={9}
                      fill="#ECFDF5"
                      stroke="#A7F3D0"
                      strokeWidth="1"
                    />
                    <text
                      x={cx}
                      y={barTopY - 9}
                      textAnchor="middle"
                      fontSize="11"
                      fontWeight="600"
                      fontFamily="system-ui, -apple-system, sans-serif"
                      fill="#059669"
                    >
                      {incidentVal} vụ
                    </text>
                  </g>
                )}

                {/* X Axis Month Label */}
                <text
                  x={cx}
                  y={baselineY + 20}
                  textAnchor="middle"
                  fontSize="12"
                  fontWeight={isHovered ? '700' : '500'}
                  fontFamily="system-ui, -apple-system, sans-serif"
                  fill={isHovered ? '#0F172A' : '#64748B'}
                >
                  {d.month}
                </text>
              </g>
            );
          })}

          {/* UPTIME DOTS & PERCENTAGE LABELS */}
          {points.map((pt, i) => {
            const isHovered = hoverIndex === i;
            return (
              <g key={`uptime-dot-${pt.raw.month}`}>
                {/* Percentage label above dot */}
                <text
                  x={pt.x}
                  y={pt.y - 10}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight="600"
                  fontFamily="system-ui, -apple-system, sans-serif"
                  fill="#334155"
                >
                  {Number(pt.raw.uptime).toFixed(2)}%
                </text>

                {/* Outer halo on hover */}
                {isHovered && (
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={9}
                    fill="none"
                    stroke="#2563EB"
                    strokeWidth="2"
                    opacity="0.3"
                  />
                )}

                {/* Dot */}
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={isHovered ? 6 : 4.5}
                  fill="#1D4ED8"
                  stroke="#FFFFFF"
                  strokeWidth={2}
                  style={{ transition: 'all 0.15s ease' }}
                />
              </g>
            );
          })}
        </svg>

        {/* TOOLTIP HIỂN THỊ CHÍNH XÁC NHƯ MẪU */}
        {hoveredData && (
          <div
            style={{
              position: 'absolute',
              top: '42%',
              left: `${tooltipXPercent}%`,
              transform: 'translate(-50%, -50%)',
              backgroundColor: '#0B132B',
              color: '#FFFFFF',
              borderRadius: '14px',
              padding: '14px 20px',
              boxShadow: '0 16px 36px rgba(0, 0, 0, 0.45)',
              border: '1.5px solid #10B981',
              fontSize: '0.8rem',
              pointerEvents: 'none',
              zIndex: 30,
              minWidth: '240px',
              transition: 'left 0.12s ease-out',
            }}
          >
            {/* Header: Kỳ Báo Cáo | SLA */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.12)', paddingBottom: '6px' }}>
              <span style={{ fontWeight: 700, color: '#2DD4BF', fontSize: '0.84rem' }}>
                Kỳ Báo Cáo: {hoveredData.month}
              </span>
              <span style={{ color: '#64748B', margin: '0 6px' }}>|</span>
              <span style={{ color: '#94A3B8', fontWeight: 500 }}>
                SLA: {hoveredData.slaTarget}%
              </span>
            </div>

            {/* Content rows with bullet points */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', lineHeight: 1.45 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#94A3B8' }}>
                  <span style={{ color: '#38BDF8', marginRight: '6px' }}>•</span>
                  Uptime Thực Tế:
                </span>
                <strong style={{ color: '#38BDF8' }}>
                  {hoveredData.uptime}%
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#94A3B8' }}>
                  <span style={{ color: '#34D399', marginRight: '6px' }}>•</span>
                  Sự Cố Tự Phục Hồi:
                </span>
                <strong style={{ color: '#34D399' }}>
                  {hoveredData.preventedIncidents} sự cố
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#94A3B8' }}>
                  <span style={{ color: '#FFFFFF', marginRight: '6px' }}>•</span>
                  Downtime Tránh Được:
                </span>
                <strong style={{ color: '#FFFFFF' }}>
                  {hoveredData.downtimeAvoidedHours ?? (Number(hoveredData.preventedIncidents || 0) * 0.3).toFixed(1)} giờ
                </strong>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3 THẺ TÓM TẮT CHÂN TRANG ĐỘC LẬP */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px',
          marginTop: '22px',
        }}
      >
        {/* Thẻ 1: Tổng thời gian vận hành */}
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

        {/* Thẻ 2: Cam kết thực đạt */}
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

        {/* Thẻ 3: Tổng sự cố tự vá lỗi */}
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
    </div>
  );
};

export default SLACostSavingsChart;
