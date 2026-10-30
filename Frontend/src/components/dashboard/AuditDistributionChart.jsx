import React, { useState, useRef } from 'react';
import { ScrollText } from 'lucide-react';

/**
 * AuditDistributionChart
 * Visualizes 7-day distribution of immutable audit events by category:
 * - AI Autonomous Actions (MAPE-K)
 * - Human-in-the-Loop Approvals (HITL)
 * - Policy & Config Changes
 * - Security & Access Logins
 */
export const AuditDistributionChart = ({
  title = 'Phân Bổ Sự Kiện Kiểm Toán 7 Ngày Qua',
  subtitle = 'Phân loại các thao tác do AI tự động thực thi, con người phê duyệt và các thay đổi cấu hình bảo mật',
  className = '',
  height = 220,
  data = null,
}) => {
  const [hoverIndex, setHoverIndex] = useState(null);
  const svgRef = useRef(null);

  const fallbackDays = [
    { day: '22/10', autonomous: 5, hitl: 1, policy: 0, auth: 4 },
    { day: '23/10', autonomous: 8, hitl: 2, policy: 1, auth: 6 },
    { day: '24/10', autonomous: 12, hitl: 0, policy: 2, auth: 8 },
    { day: '25/10', autonomous: 6, hitl: 1, policy: 0, auth: 5 },
    { day: '26/10', autonomous: 15, hitl: 3, policy: 2, auth: 10 },
    { day: '27/10', autonomous: 10, hitl: 2, policy: 1, auth: 7 },
    { day: '28/10 (Hôm nay)', autonomous: 4, hitl: 1, policy: 1, auth: 3 },
  ];

  const activeDays = (data && Array.isArray(data) && data.length > 0) ? data : fallbackDays;

  const categories = [
    { key: 'autonomous', label: 'AI Tự Trị (MAPE-K)', color: '#059669' },
    { key: 'hitl', label: 'Con Người Phê Duyệt (HITL)', color: '#2563EB' },
    { key: 'policy', label: 'Thay Đổi Chính Sách', color: '#D97706' },
    { key: 'auth', label: 'Xác Thực & Truy Cập', color: '#64748B' },
  ];

  const padding = { top: 20, right: 25, bottom: 35, left: 45 };
  const width = 720;
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const maxVal = Math.max(
    ...activeDays.map((d) => (d.autonomous || 0) + (d.hitl || 0) + (d.policy || 0) + (d.auth || 0)),
    10
  );
  const maxTotal = Math.max(15, Math.ceil(maxVal * 1.25));

  const getX = (i) => padding.left + (i / Math.max(1, activeDays.length - 1)) * chartWidth;
  const getY = (val) => padding.top + chartHeight - (val / maxTotal) * chartHeight;

  const handleMouseMove = (e) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const relativeX = (mouseX / rect.width) * width;

    if (relativeX < padding.left || relativeX > width - padding.right) {
      setHoverIndex(null);
      return;
    }

    const colWidth = chartWidth / Math.max(1, activeDays.length - 1);
    const index = Math.round((relativeX - padding.left) / colWidth);
    const clampedIndex = Math.max(0, Math.min(activeDays.length - 1, index));
    setHoverIndex(clampedIndex);
  };

  const handleMouseLeave = () => {
    setHoverIndex(null);
  };

  const hoveredData = hoverIndex !== null ? activeDays[hoverIndex] : null;

  const gridValues = [0, Math.round(maxTotal / 3), Math.round((maxTotal * 2) / 3), maxTotal];

  return (
    <div
      className={`dash-card ${className}`}
      style={{
        padding: '20px',
        backgroundColor: '#FFFFFF',
        borderRadius: 'var(--dash-radius-md)',
        boxShadow: 'var(--dash-shadow-xs)',
        position: 'relative',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ScrollText size={18} color="var(--dash-primary)" />
            <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--dash-text-primary)' }}>
              {title}
            </h3>
          </div>
          <p style={{ fontSize: '0.8125rem', color: 'var(--dash-text-secondary)', margin: '4px 0 0 0' }}>
            {subtitle}
          </p>
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.75rem', flexWrap: 'wrap' }}>
          {categories.map((c) => (
            <div key={c.key} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ width: '10px', height: '10px', backgroundColor: c.color, borderRadius: '2px', display: 'inline-block' }} />
              <span style={{ color: 'var(--dash-text-secondary)', fontWeight: 600 }}>{c.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* SVG Canvas */}
      <div style={{ position: 'relative', width: '100%', overflow: 'hidden' }}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${width} ${height}`}
          style={{ width: '100%', height: 'auto', display: 'block', cursor: 'crosshair' }}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          {/* Horizontal Grid */}
          {gridValues.map((val) => {
            const y = getY(val);
            return (
              <g key={`grid-${val}`}>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={width - padding.right}
                  y2={y}
                  stroke="#F1F5F9"
                  strokeWidth="1"
                />
                <text
                  x={padding.left - 8}
                  y={y + 4}
                  textAnchor="end"
                  fontSize="10"
                  fontFamily="var(--font-mono)"
                  fill="#94A3B8"
                >
                  {val}
                </text>
              </g>
            );
          })}

          {/* Stacked Bars per Day */}
          {activeDays.map((d, i) => {
            const cx = getX(i);
            const barW = 24;
            const isHovered = hoverIndex === i;

            // Stack heights
            let currentBase = 0;
            const barSegments = categories.map((cat) => {
              const val = d[cat.key] || 0;
              const segH = (val / maxTotal) * chartHeight;
              const segY = padding.top + chartHeight - ((currentBase + val) / maxTotal) * chartHeight;
              currentBase += val;
              return {
                key: cat.key,
                color: cat.color,
                y: segY,
                height: segH,
                val,
              };
            });

            return (
              <g key={`col-${d.day}-${i}`}>
                {/* Hover Column Background */}
                <rect
                  x={cx - barW / 2 - 4}
                  y={padding.top}
                  width={barW + 8}
                  height={chartHeight}
                  fill={isHovered ? 'rgba(241, 245, 249, 0.8)' : 'transparent'}
                  rx="4"
                />

                {/* Segments */}
                {barSegments.map((seg) => (
                  <rect
                    key={`seg-${seg.key}`}
                    x={cx - barW / 2}
                    y={seg.y}
                    width={barW}
                    height={Math.max(0, seg.height)}
                    fill={seg.color}
                    opacity={isHovered ? 1 : 0.85}
                  />
                ))}

                {/* Day label */}
                <text
                  x={cx}
                  y={height - 12}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight={isHovered ? '700' : '500'}
                  fill={isHovered ? 'var(--dash-text-primary)' : 'var(--dash-text-secondary)'}
                >
                  {d.day}
                </text>
              </g>
            );
          })}

          {/* Crosshair line */}
          {hoverIndex !== null && (
            <line
              x1={getX(hoverIndex)}
              y1={padding.top}
              x2={getX(hoverIndex)}
              y2={height - padding.bottom}
              stroke="#059669"
              strokeWidth="1.5"
              strokeDasharray="2,2"
              pointerEvents="none"
            />
          )}
        </svg>

        {/* Hover Tooltip */}
        {hoveredData && (
          <div
            style={{
              position: 'absolute',
              top: '10px',
              right: '20px',
              backgroundColor: '#0F172A',
              color: '#FFFFFF',
              borderRadius: 'var(--dash-radius-md)',
              padding: '10px 14px',
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)',
              fontSize: '0.75rem',
              pointerEvents: 'none',
              zIndex: 20,
              minWidth: '200px',
            }}
          >
            <div style={{ fontWeight: 800, color: '#34D399', marginBottom: '6px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '3px' }}>
              Ngày {hoveredData.day} &bull; Tổng: {(hoveredData.autonomous || 0) + (hoveredData.hitl || 0) + (hoveredData.policy || 0) + (hoveredData.auth || 0)} bản ghi
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', lineHeight: 1.3 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#A7F3D0' }}>AI Tự Trị (MAPE-K):</span>
                <strong style={{ fontFamily: 'var(--font-mono)' }}>{hoveredData.autonomous || 0}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#93C5FD' }}>Con Người Phê Duyệt:</span>
                <strong style={{ fontFamily: 'var(--font-mono)' }}>{hoveredData.hitl || 0}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#FDE68A' }}>Thay Đổi Chính Sách:</span>
                <strong style={{ fontFamily: 'var(--font-mono)' }}>{hoveredData.policy || 0}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#CBD5E1' }}>Xác Thực & Truy Cập:</span>
                <strong style={{ fontFamily: 'var(--font-mono)' }}>{hoveredData.auth || 0}</strong>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AuditDistributionChart;
