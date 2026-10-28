import React, { useState, useRef } from 'react';
import {
  TrendingUp,
  Activity,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';

/**
 * SLACostSavingsChart
 * React 19 native SVG chart demonstrating SLA Uptime vs Target,
 * and Automated Incident Recovery metrics for Enterprises.
 */
export const SLACostSavingsChart = ({
  title = 'Cam Kết & Xu Hướng SLA Uptime (6 Tháng Gần Nhất)',
  subtitle = 'Đối chiếu thời gian hoạt động thực tế với cam kết chuẩn SLA 99.9% và số lượng sự cố tự phục hồi',
  className = '',
  height = 260,
  trendsData = null,
  summary = null,
}) => {
  const [hoverIndex, setHoverIndex] = useState(null);
  const svgRef = useRef(null);

  const data = Array.isArray(trendsData) ? trendsData : [];

  const padding = { top: 25, right: 65, bottom: 35, left: 55 };
  const width = 740;
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Scales
  const maxIncidents = 20; // 20 incidents max for recovery bar
  const minUptime = 99.80;
  const maxUptime = 100.00;

  const getX = (i) => padding.left + (data.length > 1 ? (i / (data.length - 1)) * chartWidth : chartWidth / 2);
  const getYIncidents = (val) => padding.top + chartHeight - (val / maxIncidents) * chartHeight;
  const getYUptime = (val) =>
    padding.top + chartHeight - ((val - minUptime) / (maxUptime - minUptime)) * chartHeight;

  // Coordinates for Uptime curve
  const uptimePoints = data.length > 0 ? data.map((d, i) => `${getX(i)},${getYUptime(d.uptime)}`).join(' ') : '';
  const slaTargetY = getYUptime(99.90);

  const handleMouseMove = (e) => {
    if (!svgRef.current || data.length === 0) return;
    const rect = svgRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const relativeX = (mouseX / rect.width) * width;

    if (relativeX < padding.left || relativeX > width - padding.right) {
      setHoverIndex(null);
      return;
    }

    const colWidth = chartWidth / (data.length > 1 ? (data.length - 1) : 1);
    const index = Math.round((relativeX - padding.left) / colWidth);
    const clampedIndex = Math.max(0, Math.min(data.length - 1, index));
    setHoverIndex(clampedIndex);
  };

  const handleMouseLeave = () => {
    setHoverIndex(null);
  };

  const hoveredData = hoverIndex !== null ? data[hoverIndex] : null;

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
      {/* Card Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <TrendingUp size={18} color="var(--dash-primary)" />
            <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--dash-text-primary)' }}>
              {title}
            </h3>
          </div>
          <p style={{ fontSize: '0.8125rem', color: 'var(--dash-text-secondary)', margin: '4px 0 0 0' }}>
            {subtitle}
          </p>
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '12px', height: '12px', backgroundColor: 'var(--dash-primary)', borderRadius: '2px', display: 'inline-block' }} />
            <span style={{ color: 'var(--dash-text-secondary)', fontWeight: 600 }}>Sự cố tự phục hồi (vụ)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '16px', height: '3px', backgroundColor: '#0284C7', borderRadius: '2px', display: 'inline-block' }} />
            <span style={{ color: 'var(--dash-text-secondary)', fontWeight: 600 }}>Uptime thực tế (%)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '16px', height: '2px', borderTop: '2px dashed #94A3B8', display: 'inline-block' }} />
            <span style={{ color: 'var(--dash-text-muted)', fontWeight: 500 }}>SLA Mục tiêu (99.9%)</span>
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
          {/* Horizontal Grid lines for Incidents */}
          {[0, 5, 10, 15, 20].map((val) => {
            const y = getYIncidents(val);
            return (
              <g key={`incident-grid-${val}`}>
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
                  {val} vụ
                </text>
              </g>
            );
          })}

          {/* Right Axis Labels for Uptime */}
          {[99.80, 99.90, 100.00].map((val) => {
            const y = getYUptime(val);
            return (
              <text
                key={`uptime-lbl-${val}`}
                x={width - padding.right + 8}
                y={y + 4}
                textAnchor="start"
                fontSize="10"
                fontFamily="var(--font-mono)"
                fill="#0284C7"
              >
                {val.toFixed(2)}%
              </text>
            );
          })}

          {/* SLA Target 99.9% Horizontal Dashed Line */}
          <line
            x1={padding.left}
            y1={slaTargetY}
            x2={width - padding.right}
            y2={slaTargetY}
            stroke="#94A3B8"
            strokeWidth="1.5"
            strokeDasharray="4,4"
          />

          {/* Recovery Incident Bars */}
          {data.map((d, i) => {
            const cx = getX(i);
            const barW = 28;
            const barH = chartHeight - (getYIncidents(d.preventedIncidents) - padding.top);
            const isHovered = hoverIndex === i;

            return (
              <g key={`bar-${d.month}`}>
                {/* Background Shadow Bar */}
                <rect
                  x={cx - barW / 2}
                  y={padding.top}
                  width={barW}
                  height={chartHeight}
                  fill={isHovered ? 'rgba(16, 185, 129, 0.08)' : 'transparent'}
                  rx="4"
                />
                {/* Recovery Bar */}
                <rect
                  x={cx - barW / 2}
                  y={getYIncidents(d.preventedIncidents)}
                  width={barW}
                  height={Math.max(4, barH)}
                  fill={isHovered ? '#047857' : 'var(--dash-primary)'}
                  rx="4"
                  opacity={isHovered ? 1 : 0.85}
                  style={{ transition: 'all 0.2s ease' }}
                />
                {/* Month Label */}
                <text
                  x={cx}
                  y={height - 12}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight={isHovered ? '700' : '500'}
                  fill={isHovered ? 'var(--dash-text-primary)' : 'var(--dash-text-secondary)'}
                >
                  {d.month}
                </text>
              </g>
            );
          })}

          {/* Actual Uptime Line */}
          <polyline
            fill="none"
            stroke="#0284C7"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={uptimePoints}
          />

          {/* Uptime Data Points */}
          {data.map((d, i) => {
            const cx = getX(i);
            const cy = getYUptime(d.uptime);
            const isHovered = hoverIndex === i;

            return (
              <g key={`dot-${d.month}`}>
                <circle
                  cx={cx}
                  cy={cy}
                  r={isHovered ? 6 : 4}
                  fill="#FFFFFF"
                  stroke="#0284C7"
                  strokeWidth={isHovered ? 3 : 2}
                  style={{ transition: 'all 0.2s' }}
                />
              </g>
            );
          })}

          {/* Vertical Crosshair on Hover */}
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

        {/* Tooltip */}
        {hoveredData && (
          <div
            style={{
              position: 'absolute',
              top: '10px',
              right: '20px',
              backgroundColor: '#0F172A',
              color: '#FFFFFF',
              borderRadius: 'var(--dash-radius-md)',
              padding: '12px 16px',
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)',
              fontSize: '0.75rem',
              pointerEvents: 'none',
              zIndex: 20,
              minWidth: '220px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '4px' }}>
              <span style={{ fontWeight: 800, color: '#34D399', fontSize: '0.8125rem' }}>
                Kỳ Báo Cáo: {hoveredData.month}
              </span>
              <span style={{ color: '#94A3B8', fontFamily: 'var(--font-mono)' }}>
                SLA: {hoveredData.slaTarget}%
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', lineHeight: 1.4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#94A3B8' }}>Uptime Thực Tế:</span>
                <strong style={{ color: '#38BDF8', fontFamily: 'var(--font-mono)' }}>
                  {hoveredData.uptime}%
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#94A3B8' }}>Sự Cố Tự Phục Hồi:</span>
                <strong style={{ color: '#34D399', fontFamily: 'var(--font-mono)' }}>
                  {hoveredData.preventedIncidents} sự cố
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#94A3B8' }}>Downtime Tránh Được:</span>
                <span style={{ color: '#F1F5F9', fontFamily: 'var(--font-mono)' }}>
                  {hoveredData.downtimeWithoutSelfHealHours} giờ
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Highlights Bar */}
      <div
        style={{
          marginTop: '16px',
          padding: '12px 16px',
          backgroundColor: '#F8FAFC',
          borderRadius: 'var(--dash-radius-md)',
          border: '1px solid var(--dash-border-subtle)',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '12px',
          fontSize: '0.8125rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Activity size={18} color="var(--dash-primary)" />
          <div>
            <div style={{ color: 'var(--dash-text-muted)', fontSize: '0.6875rem', fontWeight: 600 }}>TỔNG THỜI GIAN VẬN HÀNH</div>
            <div style={{ fontWeight: 800, color: 'var(--dash-text-primary)' }}>
              {summary?.totalOperatingHours ? `${summary.totalOperatingHours.toLocaleString('vi-VN')} Giờ liên tục` : '0 Giờ'}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ShieldCheck size={18} color="#0284C7" />
          <div>
            <div style={{ color: 'var(--dash-text-muted)', fontSize: '0.6875rem', fontWeight: 600 }}>CAM KẾT THỰC ĐẠT</div>
            <div style={{ fontWeight: 800, color: '#0284C7' }}>
              {summary?.actualUptime || '100.00%'} Uptime
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CheckCircle2 size={18} color="#059669" />
          <div>
            <div style={{ color: 'var(--dash-text-muted)', fontSize: '0.6875rem', fontWeight: 600 }}>TỔNG SỰ CỐ TỰ VÁ LỖI</div>
            <div style={{ fontWeight: 800, color: '#059669' }}>
              {summary?.totalIncidentsResolved ?? 0} sự cố đã xử lý
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SLACostSavingsChart;
