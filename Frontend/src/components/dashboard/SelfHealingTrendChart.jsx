import React, { useState, useMemo, useRef } from 'react';
import {
  Zap,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';

/**
 * SelfHealingTrendChart
 * Visualizes autonomous MTTR recovery duration and actions executed over time from live database data.
 * Displays:
 * - Columns: Count of autonomous healing actions resolved per 4-hour window
 * - Line: MTTR duration curve (seconds)
 * - Interactive Crosshair & Tooltip
 */
export const SelfHealingTrendChart = ({
  actions = [],
  analytics = null,
  title = 'Xu Hướng Phục Hồi Tự Động & Thời Gian MTTR (24h Qua)',
  subtitle = 'Hiệu quả khép kín của vòng lặp MAPE-K so sánh với cam kết chuẩn SLA (MTTR < 10 giây)',
  className = '',
  height = 240,
  timeFilterMode = 'today',
  selectedDate = null,
  selectedMonth = null,
  selectedYear = null,
}) => {
  const [hoverIndex, setHoverIndex] = useState(null);
  const svgRef = useRef(null);

  // Tính toán các mốc thời gian động (Theo Năm: 12 tháng | Theo Tháng: 6 kỳ | Theo Ngày: 6 khung giờ)
  const data = useMemo(() => {
    // 1. CHẾ ĐỘ LỌC THEO NĂM: Liệt kê theo 12 THÁNG trong năm
    if (timeFilterMode === 'year' && selectedYear) {
      const yearNum = parseInt(selectedYear, 10);
      const months = [];
      for (let m = 1; m <= 12; m++) {
        const mPadded = String(m).padStart(2, '0');
        const monthLabel = mPadded;
        const windowName = `${mPadded}/${yearNum}`;

        const monthActions = (actions || []).filter((a) => {
          const itemDate = a.rawItem?.completed_at || a.rawItem?.created_at || a.rawItem?.started_at;
          if (!itemDate) return false;
          const dt = new Date(itemDate);
          return dt.getFullYear() === yearNum && dt.getMonth() + 1 === m;
        });

        const count = monthActions.length;
        let totalDurationSec = 0;
        const actionTypeCount = {};

        monthActions.forEach((a) => {
          const dur = a.rawItem?.attempts?.[0]?.duration_ms
            ? a.rawItem.attempts[0].duration_ms / 1000
            : (parseFloat(a.elapsed || a.mttr) || a.rawItem?.elapsed_seconds || 1.5);
          totalDurationSec += dur;
          const typeName = a.rawItem?.action_type_name || a.rawItem?.action_type_code || 'Tự phục hồi';
          actionTypeCount[typeName] = (actionTypeCount[typeName] || 0) + 1;
        });

        let topAction = 'Hệ thống ổn định';
        let maxCount = 0;
        Object.entries(actionTypeCount).forEach(([k, v]) => {
          if (v > maxCount) {
            maxCount = v;
            topAction = k;
          }
        });

        const avgMttr = count > 0 ? parseFloat((totalDurationSec / count).toFixed(1)) : 0;
        const succeededCount = monthActions.filter(
          (a) => a.status === 'SUCCEEDED' || a.executionStatus === 'SUCCEEDED' || a.status === 'completed'
        ).length;
        const successRate = count > 0 ? Math.round((succeededCount / count) * 100) : 100;

        months.push({
          window: windowName,
          label: monthLabel,
          actions: count,
          avgMttrSeconds: avgMttr,
          successRate,
          topAction: count > 0 ? topAction : 'Không phát sinh sự cố',
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
        const dayLabel = dStr; // Chỉ hiện số ngày: 01, 02, ..., 28/30/31
        const windowName = `${dStr}/${mStr}/${yNum}`;

        const dayActions = (actions || []).filter((a) => {
          const itemDate = a.rawItem?.completed_at || a.rawItem?.created_at || a.rawItem?.started_at;
          if (!itemDate) return false;
          const dt = new Date(itemDate);
          return dt.getFullYear() === yNum && dt.getMonth() + 1 === mNum && dt.getDate() === d;
        });

        const count = dayActions.length;
        let totalDurationSec = 0;
        const actionTypeCount = {};

        dayActions.forEach((a) => {
          const dur = a.rawItem?.attempts?.[0]?.duration_ms
            ? a.rawItem.attempts[0].duration_ms / 1000
            : (parseFloat(a.elapsed || a.mttr) || a.rawItem?.elapsed_seconds || 1.5);
          totalDurationSec += dur;
          const typeName = a.rawItem?.action_type_name || a.rawItem?.action_type_code || 'Tự phục hồi';
          actionTypeCount[typeName] = (actionTypeCount[typeName] || 0) + 1;
        });

        let topAction = 'Hệ thống ổn định';
        let maxCount = 0;
        Object.entries(actionTypeCount).forEach(([k, v]) => {
          if (v > maxCount) {
            maxCount = v;
            topAction = k;
          }
        });

        const avgMttr = count > 0 ? parseFloat((totalDurationSec / count).toFixed(1)) : 0;
        const succeededCount = dayActions.filter(
          (a) => a.status === 'SUCCEEDED' || a.executionStatus === 'SUCCEEDED' || a.status === 'completed'
        ).length;
        const successRate = count > 0 ? Math.round((succeededCount / count) * 100) : 100;

        days.push({
          window: windowName,
          label: dayLabel,
          actions: count,
          avgMttrSeconds: avgMttr,
          successRate,
          topAction: count > 0 ? topAction : 'Không phát sinh sự cố',
        });
      }

      return days;
    }

    // 3b. CHẾ ĐỘ LỌC TẤT CẢ (ALL): 7 ngày gần nhất
    if (timeFilterMode === 'all') {
      const days = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(Date.now() - i * 86400000);
        const dStr = String(d.getDate()).padStart(2, '0');
        const mStr = String(d.getMonth() + 1).padStart(2, '0');
        const yNum = d.getFullYear();
        const dayLabel = `${dStr}/${mStr}`;
        const windowName = `Ngày ${dStr}/${mStr}/${yNum}`;

        const dayStart = new Date(yNum, d.getMonth(), d.getDate(), 0, 0, 0, 0).getTime();
        const dayEnd = new Date(yNum, d.getMonth(), d.getDate(), 23, 59, 59, 999).getTime();

        const dayActions = (actions || []).filter((a) => {
          const itemDate = a.rawItem?.completed_at || a.rawItem?.created_at || a.rawItem?.started_at;
          if (!itemDate) return false;
          const t = new Date(itemDate).getTime();
          return t >= dayStart && t <= dayEnd;
        });

        const count = dayActions.length;
        let totalDurationSec = 0;
        const actionTypeCount = {};

        dayActions.forEach((a) => {
          const dur = a.rawItem?.attempts?.[0]?.duration_ms
            ? a.rawItem.attempts[0].duration_ms / 1000
            : (parseFloat(a.elapsed || a.mttr) || a.rawItem?.elapsed_seconds || 1.5);
          totalDurationSec += dur;
          const typeName = a.rawItem?.action_type_name || a.rawItem?.action_type_code || 'Tự phục hồi';
          actionTypeCount[typeName] = (actionTypeCount[typeName] || 0) + 1;
        });

        let topAction = 'Hệ thống ổn định';
        let maxCount = 0;
        Object.entries(actionTypeCount).forEach(([k, v]) => {
          if (v > maxCount) {
            maxCount = v;
            topAction = k;
          }
        });

        const avgMttr = count > 0 ? parseFloat((totalDurationSec / count).toFixed(1)) : 0;
        const succeededCount = dayActions.filter(
          (a) => a.status === 'SUCCEEDED' || a.executionStatus === 'SUCCEEDED' || a.status === 'completed'
        ).length;
        const successRate = count > 0 ? Math.round((succeededCount / count) * 100) : 100;

        days.push({
          window: windowName,
          label: dayLabel,
          actions: count,
          avgMttrSeconds: avgMttr,
          successRate,
          topAction: count > 0 ? topAction : 'Không phát sinh sự cố',
        });
      }
      return days;
    }

    // 3. CHẾ ĐỘ LỌC THEO NGÀY CỤ THỂ
    if (timeFilterMode === 'date' && selectedDate) {
      const [tYear, tMonth, tDay] = selectedDate.split('-').map(Number);
      const dayStart = new Date(tYear, tMonth - 1, tDay, 0, 0, 0, 0).getTime();
      const intervals = [];

      for (let i = 0; i < 6; i++) {
        const startHour = i * 4;
        const endHour = (i + 1) * 4;
        const startMs = dayStart + startHour * 3600 * 1000;
        const endMs = dayStart + endHour * 3600 * 1000;

        const startLabel = `${String(startHour).padStart(2, '0')}:00`;
        const endLabel = `${String(endHour).padStart(2, '0')}:00`;
        const windowName = `${startLabel} - ${endLabel} (${tDay}/${tMonth})`;

        const windowActions = (actions || []).filter((a) => {
          const itemDate = a.rawItem?.completed_at || a.rawItem?.created_at || a.rawItem?.started_at;
          if (!itemDate) return false;
          const t = new Date(itemDate).getTime();
          return t >= startMs && t < endMs;
        });

        const count = windowActions.length;
        let totalDurationSec = 0;
        const actionTypeCount = {};

        windowActions.forEach((a) => {
          const dur = a.rawItem?.attempts?.[0]?.duration_ms
            ? a.rawItem.attempts[0].duration_ms / 1000
            : (parseFloat(a.elapsed || a.mttr) || a.rawItem?.elapsed_seconds || 1.5);
          totalDurationSec += dur;
          const typeName = a.rawItem?.action_type_name || a.rawItem?.action_type_code || 'Tự phục hồi';
          actionTypeCount[typeName] = (actionTypeCount[typeName] || 0) + 1;
        });

        let topAction = 'Hệ thống ổn định';
        let maxCount = 0;
        Object.entries(actionTypeCount).forEach(([k, v]) => {
          if (v > maxCount) {
            maxCount = v;
            topAction = k;
          }
        });

        const avgMttr = count > 0 ? parseFloat((totalDurationSec / count).toFixed(1)) : 0;
        const succeededCount = windowActions.filter(
          (a) => a.status === 'SUCCEEDED' || a.executionStatus === 'SUCCEEDED' || a.status === 'completed'
        ).length;
        const successRate = count > 0 ? Math.round((succeededCount / count) * 100) : 100;

        intervals.push({
          window: windowName,
          label: endLabel,
          actions: count,
          avgMttrSeconds: avgMttr,
          successRate,
          topAction: count > 0 ? topAction : 'Không phát sinh sự cố',
        });
      }
      return intervals;
    }

    // 4. MẶC ĐỊNH / HÔM NAY: 6 khung giờ gần nhất
    const now = Date.now();
    const fourHoursMs = 4 * 3600 * 1000;
    const intervals = [];

    for (let i = 5; i >= 0; i--) {
      const end = new Date(now - i * fourHoursMs);
      const start = new Date(now - (i + 1) * fourHoursMs);

      const startLabel = start.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
      const endLabel = i === 0 ? 'Hiện tại' : end.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
      const windowName = `${startLabel} - ${endLabel}`;

      const windowActions = (actions || []).filter((a) => {
        const itemDate = a.rawItem?.completed_at || a.rawItem?.created_at || a.rawItem?.started_at;
        if (!itemDate) return false;
        const t = new Date(itemDate).getTime();
        return t >= start.getTime() && t <= end.getTime();
      });

      const count = windowActions.length;
      let totalDurationSec = 0;
      const actionTypeCount = {};

      windowActions.forEach((a) => {
        const dur = a.rawItem?.attempts?.[0]?.duration_ms
          ? a.rawItem.attempts[0].duration_ms / 1000
          : (parseFloat(a.elapsed || a.mttr) || a.rawItem?.elapsed_seconds || 1.5);
        totalDurationSec += dur;
        const typeName = a.rawItem?.action_type_name || a.rawItem?.action_type_code || 'Tự phục hồi';
        actionTypeCount[typeName] = (actionTypeCount[typeName] || 0) + 1;
      });

      let topAction = 'Hệ thống ổn định';
      let maxCount = 0;
      Object.entries(actionTypeCount).forEach(([k, v]) => {
        if (v > maxCount) {
          maxCount = v;
          topAction = k;
        }
      });

      const avgMttr = count > 0 ? parseFloat((totalDurationSec / count).toFixed(1)) : 0;
      const succeededCount = windowActions.filter(
        (a) => a.status === 'SUCCEEDED' || a.executionStatus === 'SUCCEEDED' || a.status === 'completed'
      ).length;
      const successRate = count > 0 ? Math.round((succeededCount / count) * 100) : 100;

      intervals.push({
        window: windowName,
        label: endLabel,
        actions: count,
        avgMttrSeconds: avgMttr,
        successRate,
        topAction: count > 0 ? topAction : 'Không phát sinh sự cố',
      });
    }

    return intervals;
  }, [actions, timeFilterMode, selectedDate, selectedMonth, selectedYear]);

  const padding = { top: 25, right: 35, bottom: 35, left: 45 };
  const width = 760;
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const maxActions = Math.max(5, ...data.map((d) => d.actions));
  const maxMttr = Math.max(5, ...data.map((d) => d.avgMttrSeconds));

  const getX = (i) => padding.left + (i / (data.length - 1)) * chartWidth;
  const getYMttr = (val) => padding.top + chartHeight - (val / (maxMttr || 5)) * chartHeight;

  // Polyline coordinates for MTTR line
  const mttrPoints = data.map((d, i) => `${getX(i)},${getYMttr(d.avgMttrSeconds)}`).join(' ');

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
    const idx = Math.round(ratio * (data.length - 1));
    setHoverIndex(Math.max(0, Math.min(data.length - 1, idx)));
  };

  const handleMouseLeave = () => {
    setHoverIndex(null);
  };

  const active = hoverIndex !== null ? data[hoverIndex] : data[data.length - 1];

  const totalActionsCount = analytics?.totalActions !== undefined ? analytics.totalActions : actions.length;
  const successRateText = analytics?.successRate || (totalActionsCount > 0 ? '100%' : '100%');
  const avgRecoveryText = analytics?.averageRecoveryTime || (data.some((d) => d.avgMttrSeconds > 0) ? `${(data.reduce((acc, d) => acc + d.avgMttrSeconds, 0) / (data.filter((d) => d.avgMttrSeconds > 0).length || 1)).toFixed(1)}s` : '0s');

  return (
    <div
      className={`self-healing-trend-chart ${className}`}
      style={{
        backgroundColor: '#FFFFFF',
        border: '1px solid var(--dash-border)',
        padding: '20px',
        position: 'relative',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          marginBottom: '16px',
          paddingBottom: '12px',
          borderBottom: '1px solid #F1F5F9',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Zap size={18} color="#059669" />
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--dash-text-primary)', margin: 0 }}>
              {title}
            </h3>
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--dash-text-secondary)', margin: '2px 0 0 0' }}>
            {subtitle}
          </p>
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '12px', height: '10px', backgroundColor: 'rgba(5, 150, 105, 0.25)', border: '1px solid #059669' }} />
            <span style={{ color: 'var(--dash-text-secondary)' }}>Số ca tự phục hồi (Hành động)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '12px', height: '2.5px', backgroundColor: '#2563EB', borderRadius: '1px' }} />
            <span style={{ color: 'var(--dash-text-secondary)' }}>Thời gian MTTR (Giây)</span>
          </div>
        </div>
      </div>

      {/* SVG Canvas */}
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
          {/* Horizontal Grid lines */}
          {[0, 1, 2, 3, 4, 5].map((s) => {
            const y = getYMttr(s);
            return (
              <g key={s}>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={width - padding.right}
                  y2={y}
                  stroke={s === 0 ? '#CBD5E1' : '#F1F5F9'}
                  strokeWidth="1"
                  strokeDasharray={s === 0 ? 'none' : '3 3'}
                />
                <text
                  x={padding.left - 8}
                  y={y + 3}
                  textAnchor="end"
                  fontFamily="monospace"
                  fontSize={data.length > 8 ? "9" : "10"}
                  fill="#94A3B8"
                >
                  {s}s
                </text>
              </g>
            );
          })}

          {/* SLA Threshold Line at 3s */}
          <line
            x1={padding.left}
            y1={getYMttr(3)}
            x2={width - padding.right}
            y2={getYMttr(3)}
            stroke="#10B981"
            strokeWidth="1.2"
            strokeDasharray="4 4"
            opacity="0.8"
          />
          <text
            x={width - padding.right - 6}
            y={getYMttr(3) - 5}
            textAnchor="end"
            fontFamily="monospace"
            fontSize="9"
            fontWeight="700"
            fill="#059669"
          >
            MỤC TIÊU SLA &lt; 3.0s
          </text>

          {/* Action Columns (Bars) */}
          {data.map((d, i) => {
            const barWidth = data.length > 20 ? 10 : data.length > 8 ? 20 : 36;
            const barHeight = (d.actions / (maxActions || 1)) * chartHeight;
            const x = getX(i) - barWidth / 2;
            const y = padding.top + chartHeight - barHeight;

            return (
              <g key={i}>
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={Math.max(barHeight, 0)}
                  fill={hoverIndex === i ? "rgba(5, 150, 105, 0.35)" : "rgba(5, 150, 105, 0.18)"}
                  stroke="#059669"
                  strokeWidth="1"
                  rx="2"
                />
                {d.actions > 0 && (
                  <text
                    x={getX(i)}
                    y={y - 5}
                    textAnchor="middle"
                    fontFamily="var(--font-mono, monospace)"
                    fontSize={data.length > 20 ? "7.5" : "9"}
                    fontWeight="700"
                    fill={hoverIndex === i ? "#059669" : "#475569"}
                    pointerEvents="none"
                  >
                    {d.actions}
                  </text>
                )}
              </g>
            );
          })}

          {/* MTTR Polyline */}
          <polyline
            fill="none"
            stroke="#2563EB"
            strokeWidth={data.length > 20 ? 1.5 : 2.5}
            points={mttrPoints}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* MTTR Dots */}
          {data.map((d, i) => (
            <circle
              key={i}
              cx={getX(i)}
              cy={getYMttr(d.avgMttrSeconds)}
              r={data.length > 20 ? 2.5 : 4.5}
              fill="#FFFFFF"
              stroke="#2563EB"
              strokeWidth="2.5"
            />
          ))}

          {/* X Axis Window Labels */}
          {data.map((d, i) => (
            <text
              key={i}
              x={getX(i)}
              y={height - 10}
              textAnchor="middle"
              fontFamily="monospace"
              fontSize={data.length > 20 ? "7.5" : "9.5"}
              fill="#64748B"
            >
              {d.label || d.window}
            </text>
          ))}

          {/* Crosshair indicator */}
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
            </g>
          )}
        </svg>

        {/* Floating Tooltip */}
        {hoverIndex !== null && (
          <div
            style={{
              position: 'absolute',
              top: '10px',
              left: `${Math.min(Math.max((getX(hoverIndex) / width) * 100, 18), 75)}%`,
              transform: 'translateX(-50%)',
              backgroundColor: '#0F172A',
              color: '#FFFFFF',
              padding: '10px 14px',
              borderRadius: '2px',
              boxShadow: '0 4px 14px rgba(0,0,0,0.25)',
              pointerEvents: 'none',
              zIndex: 25,
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
              <span>{timeFilterMode === "year" ? "THÁNG:" : timeFilterMode === "month" ? "NGÀY:" : "KHUNG GIỜ:"}</span>
              <strong style={{ color: '#F8FAFC' }}>{active.window}</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', marginBottom: '4px' }}>
              <span style={{ color: '#34D399' }}>Số ca phục hồi:</span>
              <strong>{active.actions} hành động</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', marginBottom: '4px' }}>
              <span style={{ color: '#60A5FA' }}>MTTR trung bình:</span>
              <strong>{active.avgMttrSeconds} giây</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: '#CBD5E1', marginBottom: '4px' }}>
              <span>Tỷ lệ thành công:</span>
              <span style={{ color: '#34D399', fontWeight: 700 }}>{active.successRate}%</span>
            </div>

            <div style={{ fontSize: '0.6875rem', color: '#94A3B8', marginTop: '6px', paddingTop: '4px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
              Hành động tiêu biểu: <span style={{ color: '#FFFFFF' }}>{active.topAction}</span>
            </div>
          </div>
        )}
      </div>

      {/* Footer Stats Summary */}
      <div
        style={{
          marginTop: '16px',
          paddingTop: '12px',
          borderTop: '1px dashed var(--dash-border)',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '12px',
        }}
      >
        <div style={{ padding: '8px 12px', backgroundColor: 'rgba(5, 150, 105, 0.05)', border: '1px solid rgba(5, 150, 105, 0.2)' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: '#065F46', fontWeight: 700 }}>
            {timeFilterMode === "year" ? `TỔNG CA PHỤC HỒI (${selectedYear || "NĂM"})` : timeFilterMode === "month" ? "TỔNG CA PHỤC HỒI (THÁNG)" : "TỔNG CA PHỤC HỒI (24H)"}
          </div>
          <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#064E3B' }}>
            {totalActionsCount} Ca Hoàn Tất <span style={{ fontSize: '0.75rem', color: '#059669', fontWeight: 600 }}>({successRateText})</span>
          </div>
        </div>

        <div style={{ padding: '8px 12px', backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: '#1E40AF', fontWeight: 700 }}>
            THỜI GIAN MTTR TRUNG BÌNH
          </div>
          <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#1E3A8A' }}>
            {avgRecoveryText} <span style={{ fontSize: '0.75rem', color: '#2563EB', fontWeight: 600 }}>(&lt; 10s Chuẩn SME)</span>
          </div>
        </div>

        <div style={{ padding: '8px 12px', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: 'var(--dash-text-muted)', fontWeight: 700 }}>
            TIẾT KIỆM CHI PHÍ SỰ CỐ
          </div>
          <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--dash-text-primary)' }}>
            {totalActionsCount > 0 ? `~${Math.round(totalActionsCount * 2.5)} Phút Ngừng Máy` : '0 Phút (Hạ tầng ổn định)'}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SelfHealingTrendChart;
