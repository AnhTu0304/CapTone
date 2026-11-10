import React, { useState, useMemo, useRef } from 'react';
import { ScrollText, Eye, EyeOff } from 'lucide-react';

/**
 * AuditDistributionChart
 * Visualizes dynamic distribution of immutable audit events by category:
 * - AI Autonomous Actions (MAPE-K)
 * - Human-in-the-Loop Approvals (HITL)
 * - Policy & Config Changes
 * - Security & Access Logins
 *
 * Supports dynamic timeline adaptation (like SelfHealingTrendChart):
 * - Theo Năm: 12 tháng (T01 -> T12)
 * - Theo Tháng: Tất cả các ngày trong tháng (01 -> 28/30/31)
 * - Theo Ngày / Hôm nay: 6 khung giờ (00:00 - 24:00)
 * - Tất cả: Các mốc ngày phát sinh sự kiện
 */

const getTodayStr = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseLogDate = (log) => {
  if (!log) return null;
  const raw = log.created_at || log.raw_created_at || log.rawItem?.created_at;
  if (raw) {
    const d = new Date(raw);
    if (!isNaN(d.getTime())) return d;
  }
  const ts = log.timestamp || log.rawItem?.timestamp;
  if (ts && typeof ts === 'string') {
    const parts = ts.split(' ');
    if (parts[0] && parts[0].includes('/')) {
      const [d, m, y] = parts[0].split('/').map(Number);
      const [hh, mm, ss] = (parts[1] || '0:0:0').split(':').map(Number);
      const res = new Date(y, m - 1, d, hh || 0, mm || 0, ss || 0);
      if (!isNaN(res.getTime())) return res;
    }
    const d = new Date(ts);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
};

const classifyLog = (item) => {
  const action = (item.event || item.action || '').toUpperCase();
  const actorType = (item.actorType || item.actor_type || '').toUpperCase();
  const desc = (item.description || '').toUpperCase();

  if (action === 'AGENT_DELETED') {
    return 'policy';
  }

  // 1. AI MAPE-K Autonomous & Agent Execution
  if (
    actorType === 'SYSTEM' ||
    actorType === 'AGENT' ||
    action.includes('AUTONOMOUS') ||
    action.includes('CIRCUIT_BREAKER') ||
    action === 'AGENT_CONNECTED' ||
    action === 'AGENT_DISCONNECTED' ||
    action.includes('SCALE') ||
    action.includes('POD_MEMORY_RESTART') ||
    (action.includes('REMEDIATION') && actorType !== 'USER') ||
    desc.includes('MAPE-K')
  ) {
    return 'autonomous';
  }

  // 2. Human-in-the-Loop (HITL) & Manual Remediation
  if (
    action.includes('HITL') ||
    action.includes('APPROVAL') ||
    action.includes('REJECT') ||
    (actorType === 'USER' && action.includes('REMEDIATION')) ||
    desc.includes('PHÊ DUYỆT')
  ) {
    return 'hitl';
  }

  // 3. Policy & Configuration
  if (
    action.includes('POLICY') ||
    action.includes('THRESHOLD') ||
    action.includes('CONFIG') ||
    action.includes('CLUSTER_') ||
    action.includes('TOKEN_') ||
    action.includes('DRAIN') ||
    action.includes('CORDON')
  ) {
    return 'policy';
  }

  // 4. Authentication & RBAC Access
  return 'auth';
};

export const AuditDistributionChart = ({
  title = 'Phân Bổ Sự Kiện Kiểm Toán',
  subtitle = 'Phân loại các thao tác do AI tự động thực thi, con người phê duyệt và các thay đổi cấu hình bảo mật',
  className = '',
  height = 230,
  logs = [],
  fallbackData = null,
  timeFilterMode = 'today',
  selectedDate = null,
  selectedMonth = null,
  selectedYear = null,
  filterControl = null,
}) => {
  const [hoverIndex, setHoverIndex] = useState(null);
  const [showDataLabels, setShowDataLabels] = useState(true);
  const svgRef = useRef(null);

  const categories = useMemo(() => [
    { key: 'autonomous', label: 'AI Tự Trị (MAPE-K)', color: '#059669' },
    { key: 'hitl', label: 'Con Người Phê Duyệt (HITL)', color: '#2563EB' },
    { key: 'policy', label: 'Thay Đổi Chính Sách', color: '#D97706' },
    { key: 'auth', label: 'Xác Thực & Truy Cập', color: '#64748B' },
  ], []);

  // Tính toán dữ liệu theo mốc thời gian động đồng bộ như SelfHealingTrendChart
  const activeDays = useMemo(() => {
    // Nếu không có log thực tế nhưng có fallbackData tĩnh
    if ((!logs || logs.length === 0) && fallbackData && Array.isArray(fallbackData) && fallbackData.length > 0) {
      return fallbackData;
    }

    // 1. CHẾ ĐỘ LỌC THEO NĂM: Liệt kê theo 12 THÁNG trong năm
    if (timeFilterMode === 'year' && selectedYear) {
      const yearNum = parseInt(selectedYear, 10);
      const months = [];
      for (let m = 1; m <= 12; m++) {
        const mPadded = String(m).padStart(2, '0');
        const monthLabel = `T${m}`;
        const windowName = `Tháng ${mPadded}/${yearNum}`;

        const monthLogs = (logs || []).filter((l) => {
          const dt = parseLogDate(l);
          if (!dt) return false;
          return dt.getFullYear() === yearNum && dt.getMonth() + 1 === m;
        });

        const counts = { autonomous: 0, hitl: 0, policy: 0, auth: 0 };
        monthLogs.forEach((l) => {
          const cat = classifyLog(l);
          counts[cat] = (counts[cat] || 0) + 1;
        });
        const total = counts.autonomous + counts.hitl + counts.policy + counts.auth;

        months.push({
          day: monthLabel,
          window: windowName,
          ...counts,
          total,
        });
      }
      return months;
    }

    // 2. CHẾ ĐỘ LỌC THEO THÁNG: Liệt kê ĐỦ TẤT CẢ CÁC NGÀY trong tháng (1 -> 28/30/31)
    if (timeFilterMode === 'month' && selectedMonth) {
      const [yStr, mStr] = selectedMonth.split('-');
      const yNum = parseInt(yStr, 10);
      const mNum = parseInt(mStr, 10);
      const daysInMonth = new Date(yNum, mNum, 0).getDate();
      const days = [];

      for (let d = 1; d <= daysInMonth; d++) {
        const dStr = String(d).padStart(2, '0');
        const dayLabel = dStr;
        const windowName = `Ngày ${dStr}/${mStr}/${yNum}`;

        const dayLogs = (logs || []).filter((l) => {
          const dt = parseLogDate(l);
          if (!dt) return false;
          return dt.getFullYear() === yNum && dt.getMonth() + 1 === mNum && dt.getDate() === d;
        });

        const counts = { autonomous: 0, hitl: 0, policy: 0, auth: 0 };
        dayLogs.forEach((l) => {
          const cat = classifyLog(l);
          counts[cat] = (counts[cat] || 0) + 1;
        });
        const total = counts.autonomous + counts.hitl + counts.policy + counts.auth;

        days.push({
          day: dayLabel,
          window: windowName,
          ...counts,
          total,
        });
      }
      return days;
    }

    // 3. CHẾ ĐỘ LỌC THEO NGÀY CỤ THỂ HOẶC HÔM NAY: 6 khung giờ (00:00 - 24:00)
    if (timeFilterMode === 'date' || timeFilterMode === 'today') {
      const targetDateStr = timeFilterMode === 'today' ? getTodayStr() : (selectedDate || getTodayStr());
      const [tYear, tMonth, tDay] = targetDateStr.split('-').map(Number);
      const dayStart = new Date(tYear, tMonth - 1, tDay, 0, 0, 0, 0).getTime();
      const intervals = [];

      for (let i = 0; i < 6; i++) {
        const startHour = i * 4;
        const endHour = (i + 1) * 4;
        const startMs = dayStart + startHour * 3600 * 1000;
        const endMs = dayStart + endHour * 3600 * 1000;

        const startLabel = `${String(startHour).padStart(2, '0')}:00`;
        const endLabel = `${String(endHour).padStart(2, '0')}:00`;
        const windowName = `${startLabel} - ${endLabel} (${String(tDay).padStart(2, '0')}/${String(tMonth).padStart(2, '0')})`;

        const windowLogs = (logs || []).filter((l) => {
          const dt = parseLogDate(l);
          if (!dt) return false;
          const t = dt.getTime();
          return t >= startMs && t < endMs;
        });

        const counts = { autonomous: 0, hitl: 0, policy: 0, auth: 0 };
        windowLogs.forEach((l) => {
          const cat = classifyLog(l);
          counts[cat] = (counts[cat] || 0) + 1;
        });
        const total = counts.autonomous + counts.hitl + counts.policy + counts.auth;

        intervals.push({
          day: endLabel,
          window: windowName,
          ...counts,
          total,
        });
      }
      return intervals;
    }

    // 4. CHẾ ĐỘ LỌC TẤT CẢ (ALL): Phân bổ theo chuỗi ngày phát sinh bản ghi
    const datesMap = new Map();
    (logs || []).forEach((l) => {
      const dt = parseLogDate(l);
      if (!dt) return;
      const dKey = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
      if (!datesMap.has(dKey)) datesMap.set(dKey, []);
      datesMap.get(dKey).push(l);
    });

    let sortedDates = Array.from(datesMap.keys()).sort();
    if (sortedDates.length < 5) {
      const now = new Date();
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 24 * 3600 * 1000);
        const dKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        if (!datesMap.has(dKey)) {
          datesMap.set(dKey, []);
        }
      }
      sortedDates = Array.from(datesMap.keys()).sort();
    }

    return sortedDates.map((dKey) => {
      const [yr, mo, dy] = dKey.split('-');
      const label = `${dy}/${mo}`;
      const dayLogs = datesMap.get(dKey) || [];
      const counts = { autonomous: 0, hitl: 0, policy: 0, auth: 0 };
      dayLogs.forEach((l) => {
        const cat = classifyLog(l);
        counts[cat] = (counts[cat] || 0) + 1;
      });
      const total = counts.autonomous + counts.hitl + counts.policy + counts.auth;

      return {
        day: label,
        window: `Ngày ${dy}/${mo}/${yr}`,
        ...counts,
        total,
      };
    });
  }, [logs, fallbackData, timeFilterMode, selectedDate, selectedMonth, selectedYear]);

  const padding = { top: 25, right: 25, bottom: 35, left: 45 };
  const width = 760;
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const maxVal = Math.max(
    ...activeDays.map((d) => (d.autonomous || 0) + (d.hitl || 0) + (d.policy || 0) + (d.auth || 0)),
    5
  );
  const maxTotal = Math.max(10, Math.ceil(maxVal * 1.25));

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
        padding: '18px 20px',
        backgroundColor: '#FFFFFF',
        borderRadius: 'var(--dash-radius-md)',
        boxShadow: 'var(--dash-shadow-xs)',
        position: 'relative',
      }}
    >
      {/* Header card: Title & Legend & Filter Control */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '12px' }}>
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

        {/* Nhóm bên phải: Chú thích (Legend) + Nút Lọc Thời Gian (Filter Control) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          {/* Legend */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.75rem', flexWrap: 'wrap' }}>
            {categories.map((c) => (
              <div key={c.key} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ width: '10px', height: '10px', backgroundColor: c.color, borderRadius: '2px', display: 'inline-block' }} />
                <span style={{ color: 'var(--dash-text-secondary)', fontWeight: 600 }}>{c.label}</span>
              </div>
            ))}
          </div>

          {/* Nút Bật / Tắt Hiển Thị Số Liệu Trên Các Cột */}
          <button
            type="button"
            onClick={() => setShowDataLabels((prev) => !prev)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '3px 9px',
              borderRadius: 'var(--dash-radius-sm, 6px)',
              border: showDataLabels ? '1px solid #10B981' : '1px solid var(--dash-border, #CBD5E1)',
              backgroundColor: showDataLabels ? '#ECFDF5' : '#F8FAFC',
              color: showDataLabels ? '#047857' : '#64748B',
              fontSize: '0.6875rem',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              userSelect: 'none',
              boxShadow: showDataLabels ? '0 1px 2px rgba(16, 185, 129, 0.12)' : 'none',
            }}
            title={showDataLabels ? 'Đang bật hiển thị số liệu cột (Bấm để ẩn)' : 'Đang ẩn số liệu cột (Bấm để hiện)'}
          >
            {showDataLabels ? <Eye size={12} color="#059669" /> : <EyeOff size={12} color="#94A3B8" />}
            <span>{showDataLabels ? 'Hiện số liệu cột' : 'Ẩn số liệu cột'}</span>
          </button>

          {/* Bộ lọc Date Picker đặt trực tiếp trên Biểu đồ */}
          {filterControl && (
            <div>
              {filterControl}
            </div>
          )}
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

          {/* Stacked Bars per Interval */}
          {activeDays.map((d, i) => {
            const cx = getX(i);
            const barW = activeDays.length > 20 ? 10 : activeDays.length > 8 ? 18 : 28;
            const isHovered = hoverIndex === i;

            const totalVal = d.total || (d.autonomous || 0) + (d.hitl || 0) + (d.policy || 0) + (d.auth || 0);
            const rawTotalH = (totalVal / maxTotal) * chartHeight;
            const totalH = totalVal > 0 ? Math.max(3.5, rawTotalH) : 0;
            const barTopY = padding.top + chartHeight - totalH;

            // Stack heights with minimum visible slice
            let accumulatedH = 0;
            const barSegments = categories.map((cat) => {
              const val = d[cat.key] || 0;
              if (val <= 0 || totalVal <= 0) {
                return { key: cat.key, color: cat.color, y: padding.top + chartHeight, height: 0, val: 0 };
              }
              const fraction = val / totalVal;
              const segH = Math.max(1.2, fraction * totalH);
              const segY = padding.top + chartHeight - (accumulatedH + segH);
              accumulatedH += segH;
              return {
                key: cat.key,
                color: cat.color,
                y: segY,
                height: segH,
                val,
              };
            });

            const labelY = Math.max(padding.top + 8, barTopY - 5);
            const numDigits = String(totalVal).length;
            const badgeW = numDigits * (activeDays.length > 15 ? 6.5 : 7.5) + 6;
            const badgeH = activeDays.length > 15 ? 12 : 14;

            return (
              <g key={`col-${d.day}-${i}`}>
                {/* Hover Column Background */}
                <rect
                  x={cx - barW / 2 - 4}
                  y={padding.top}
                  width={barW + 8}
                  height={chartHeight}
                  fill={isHovered ? 'rgba(241, 245, 249, 0.85)' : 'transparent'}
                  rx="4"
                />

                {/* Segments */}
                {barSegments.map((seg) => (
                  <g key={`seg-grp-${seg.key}`}>
                    <rect
                      x={cx - barW / 2}
                      y={seg.y}
                      width={barW}
                      height={Math.max(0, seg.height)}
                      fill={seg.color}
                      opacity={isHovered ? 1 : 0.88}
                      rx="1"
                    />
                    {/* Segment Value inside bar if segment is sufficiently tall */}
                    {showDataLabels && seg.height >= 26 && barW >= 15 && seg.val > 0 && (
                      <text
                        x={cx}
                        y={seg.y + seg.height / 2 + 3.5}
                        textAnchor="middle"
                        fontSize={activeDays.length > 15 ? "8" : "9"}
                        fontWeight="700"
                        fontFamily="var(--font-mono, monospace)"
                        fill="#FFFFFF"
                        opacity={0.95}
                        pointerEvents="none"
                      >
                        {seg.val}
                      </text>
                    )}
                  </g>
                ))}

                {/* Data Label trên đỉnh mỗi cột (Data Label on top of each bar) */}
                {showDataLabels && totalVal > 0 && (
                  <g pointerEvents="none">
                    {/* Badge nền nhỏ giúp số luôn đọc được rõ ràng */}
                    <rect
                      x={cx - badgeW / 2}
                      y={labelY - badgeH + 3}
                      width={badgeW}
                      height={badgeH}
                      rx="3"
                      fill={isHovered ? '#0F172A' : '#F8FAFC'}
                      stroke={isHovered ? '#34D399' : '#CBD5E1'}
                      strokeWidth={isHovered ? '1.2' : '0.8'}
                      opacity={isHovered ? 1 : 0.94}
                    />
                    <text
                      x={cx}
                      y={labelY}
                      textAnchor="middle"
                      fontSize={activeDays.length > 20 ? "7.5" : activeDays.length > 12 ? "8.5" : "9.5"}
                      fontWeight="700"
                      fontFamily="var(--font-mono, monospace)"
                      fill={isHovered ? '#34D399' : '#1E293B'}
                    >
                      {totalVal}
                    </text>
                  </g>
                )}

                {/* Label on X Axis */}
                <text
                  x={cx}
                  y={height - 10}
                  textAnchor="middle"
                  fontSize={activeDays.length > 20 ? "8" : "9.5"}
                  fontWeight={isHovered ? '700' : '500'}
                  fill={isHovered ? 'var(--dash-text-primary)' : 'var(--dash-text-secondary)'}
                  fontFamily="monospace"
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
              left: `${Math.min(Math.max((getX(hoverIndex) / width) * 100, 16), 72)}%`,
              transform: 'translateX(-50%)',
              backgroundColor: '#0F172A',
              color: '#FFFFFF',
              borderRadius: '6px',
              padding: '10px 14px',
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.35)',
              fontSize: '0.75rem',
              pointerEvents: 'none',
              zIndex: 30,
              minWidth: '220px',
              border: '1px solid rgba(255,255,255,0.15)',
            }}
          >
            <div style={{ fontWeight: 800, color: '#34D399', marginBottom: '6px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '4px' }}>
              {hoveredData.window || `Mốc ${hoveredData.day}`} &bull; Tổng: {hoveredData.total || 0} bản ghi
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
