import React, { useState, useRef, useMemo, useCallback } from 'react';
import {
  TrendingUp,
  Activity,
  ShieldCheck,
  Wrench,
  Zap,
  BarChart2,
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
 * Biểu đồ SVG thông minh tích hợp 3 chế độ xem chuyên sâu:
 * 1. SLA & Uptime: Đánh giá cam kết SLA 99.9% và số vụ tự phục hồi.
 * 2. Tốc độ MTTR & Tự Trị AI: Đánh giá tốc độ hồi sinh Pod (giây) và tỷ lệ tự trị (%).
 * 3. Kết Quả Action (Thành Công / Lỗi / Hủy): Cột xếp chồng theo thời gian + đường Tỷ lệ Thành Công (%).
 */
export const SLACostSavingsChart = ({
  title = 'Cam Kết & Xu Hướng SLA Uptime',
  subtitle = 'Đối chiếu thời gian hoạt động thực tế với cam kết chuẩn SLA 99.9% và số lượng sự cố tự phục hồi',
  className = '',
  height = 275,
  trendsData = null,
  actionTrends = null,
  summary = null,
  showSummaryCards = false,
  initialMode = 'SLA',
}) => {
  const [chartMode, setChartMode] = useState(initialMode); // 'SLA' | 'AUTONOMOUS' | 'ACTIONS'
  const isSlaMode = chartMode === 'SLA';
  const isAutoMode = chartMode === 'AUTONOMOUS';
  const isActionsMode = chartMode === 'ACTIONS';

  const [hoverIndex, setHoverIndex] = useState(null);
  const svgRef = useRef(null);

  const slaData = useMemo(() => {
    if (Array.isArray(trendsData) && trendsData.length > 0) return trendsData;
    return [
      { month: 'Tuần 1', uptime: 100.0, slaTarget: 99.9, preventedIncidents: 0, downtimeAvoidedHours: 0.0, mttrSeconds: 0, autonomousHealingRate: 100.0, totalActions: 0, succeededActions: 0, failedActions: 0, cancelledActions: 0 },
      { month: 'Tuần 2', uptime: 100.0, slaTarget: 99.9, preventedIncidents: 0, downtimeAvoidedHours: 0.0, mttrSeconds: 0, autonomousHealingRate: 100.0, totalActions: 0, succeededActions: 0, failedActions: 0, cancelledActions: 0 },
      { month: 'Tuần 3', uptime: 100.0, slaTarget: 99.9, preventedIncidents: 0, downtimeAvoidedHours: 0.0, mttrSeconds: 0, autonomousHealingRate: 100.0, totalActions: 0, succeededActions: 0, failedActions: 0, cancelledActions: 0 },
      { month: 'Tuần 4', uptime: 100.0, slaTarget: 99.9, preventedIncidents: 0, downtimeAvoidedHours: 0.0, mttrSeconds: 0, autonomousHealingRate: 100.0, totalActions: 0, succeededActions: 0, failedActions: 0, cancelledActions: 0 },
    ];
  }, [trendsData]);

  const actionsSeries = useMemo(() => {
    if (Array.isArray(actionTrends) && actionTrends.length > 0) {
      return actionTrends.map((t) => ({
        month: t.label,
        total: Number(t.total) || 0,
        succeeded: Number(t.succeeded) || 0,
        failed: Number(t.failed) || 0,
        cancelled: Number(t.cancelled) || 0,
        pending: Number(t.pending) || 0,
        successRate: Number(t.successRate) || 0,
        avgDurationSeconds: Number(t.avgDurationSeconds) || 0,
        autoCount: Number(t.autoCount) || 0,
        manualCount: Number(t.manualCount) || 0,
      }));
    }
    return slaData.map((d) => {
      const ok = Number(d.succeededActions ?? d.preventedIncidents) || 0;
      const fail = Number(d.failedActions) || 0;
      const cancel = Number(d.cancelledActions) || 0;
      const total = Number(d.totalActions) || ok + fail + cancel;
      return {
        month: d.month,
        total,
        succeeded: ok,
        failed: fail,
        cancelled: cancel,
        pending: Number(d.pendingActions) || 0,
        successRate: total > 0 ? parseFloat(((ok / total) * 100).toFixed(1)) : 0,
        avgDurationSeconds: Number(d.mttrSeconds) || 0,
        autoCount: ok,
        manualCount: fail + cancel,
      };
    });
  }, [actionTrends, slaData]);

  const data = isActionsMode ? actionsSeries : slaData;

  const padding = { top: 34, right: 75, bottom: 34, left: 56 };
  const width = 860;
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const baselineY = padding.top + chartHeight;

  // --- 1. THANG ĐO SLA ---
  const maxIncVal = Math.max(...slaData.map((d) => Number(d.preventedIncidents) || 0), 1);
  const incStep = Math.max(1, Math.ceil(maxIncVal / 3));
  const maxIncidents = incStep * 3;
  const incidentTicks = [maxIncidents, incStep * 2, incStep, 0];

  const getYIncidents = (val) => {
    if (!val || val <= 0) return baselineY;
    const ratio = Math.min(1, Math.max(0, val / maxIncidents));
    return baselineY - ratio * (chartHeight * 0.42);
  };

  const slaTargetY = padding.top + chartHeight * 0.28;

  // --- 2. THANG ĐO AUTONOMOUS (MTTR & TỶ LỆ TỰ TRỊ) ---
  const maxMttrVal = Math.max(...slaData.map((d) => Number(d.mttrSeconds) || 0), 15);
  const mttrStep = Math.max(5, Math.ceil(maxMttrVal / 3));
  const maxMttr = mttrStep * 3;
  const mttrTicks = [maxMttr, mttrStep * 2, mttrStep, 0];

  const getYMttr = (val) => {
    if (!val || val <= 0) return baselineY;
    const ratio = Math.min(1, Math.max(0, val / maxMttr));
    return baselineY - ratio * (chartHeight * 0.42);
  };

  const autoTargetY = padding.top + chartHeight * 0.28;

  // --- 3. THANG ĐO ACTIONS STACKED BARS ---
  const maxActVal = Math.max(...actionsSeries.map((d) => Number(d.total) || 0), 1);
  const actStep = Math.max(1, Math.ceil(maxActVal / 3));
  const maxActions = actStep * 3;
  const actionTicks = [maxActions, actStep * 2, actStep, 0];

  const getYActionsHeight = (val) => {
    if (!val || val <= 0) return 0;
    const ratio = Math.min(1, Math.max(0, val / maxActions));
    return ratio * (chartHeight * 0.72);
  };

  const getYSuccessRate = (rate) => {
    const pct = Math.min(100, Math.max(0, Number(rate) || 0));
    return baselineY - (pct / 100) * (chartHeight * 0.85);
  };

  const innerMargin = data.length <= 4 ? 58 : data.length <= 8 ? 38 : 26;
  const innerWidth = chartWidth - 2 * innerMargin;

  const getX = (i) =>
    padding.left + innerMargin + (data.length > 1 ? (i / (data.length - 1)) * innerWidth : innerWidth / 2);

  const leftTicks = isSlaMode ? incidentTicks : isAutoMode ? mttrTicks : actionTicks;
  const targetLineY = isSlaMode ? slaTargetY : autoTargetY;
  const targetLineLabel = isSlaMode ? 'SLA Mục tiêu (99.9%)' : 'Mục tiêu Tự Trị (>95.0%)';

  const points = useMemo(() => {
    return data.map((d, i) => {
      const x =
        padding.left +
        innerMargin +
        (data.length > 1 ? (i / (data.length - 1)) * innerWidth : innerWidth / 2);

      let y;
      if (isSlaMode) {
        const numeric = Number(d.uptime) || 99.9;
        if (numeric >= 99.9) {
          const ratio = Math.min(1, Math.max(0, (numeric - 99.9) / 0.1));
          y = slaTargetY - ratio * (slaTargetY - (padding.top + 10));
        } else {
          const ratio = Math.min(1, Math.max(0, (99.9 - numeric) / 0.1));
          y = slaTargetY + ratio * (chartHeight * 0.18);
        }
      } else if (isAutoMode) {
        const val = d.autonomousHealingRate ?? 100;
        const numeric = val === undefined || val === null ? 100 : Number(val);
        if (numeric >= 95.0) {
          const ratio = Math.min(1, Math.max(0, (numeric - 95.0) / 5.0));
          y = autoTargetY - ratio * (autoTargetY - (padding.top + 10));
        } else {
          const ratio = Math.min(1, Math.max(0, (95.0 - numeric) / 95.0));
          y = autoTargetY + ratio * (chartHeight * 0.35);
        }
      } else {
        const pct = Math.min(100, Math.max(0, Number(d.successRate) || 0));
        y = baselineY - (pct / 100) * (chartHeight * 0.85);
      }

      return { x, y, raw: d };
    });
  }, [
    data,
    isSlaMode,
    isAutoMode,
    padding.left,
    padding.top,
    slaTargetY,
    autoTargetY,
    baselineY,
    chartHeight,
    innerMargin,
    innerWidth,
  ]);

  const curvePath = useMemo(() => getSmoothCurve(points), [points]);
  const areaPath = useMemo(() => {
    return points.length > 0 && !isActionsMode
      ? `${curvePath} L ${points[points.length - 1].x},${baselineY} L ${points[0].x},${baselineY} Z`
      : '';
  }, [curvePath, points, baselineY, isActionsMode]);

  const handleMouseMove = useCallback(
    (e) => {
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
    },
    [data.length, innerMargin, innerWidth, padding.left, padding.right, width]
  );

  const handleMouseLeave = useCallback(() => {
    setHoverIndex((prev) => (prev !== null ? null : prev));
  }, []);

  const hoveredData = hoverIndex !== null ? data[hoverIndex] : null;
  const tooltipXPercent =
    hoverIndex !== null && data.length > 0
      ? Math.max(22, Math.min(78, (getX(hoverIndex) / width) * 100))
      : 50;

  return (
    <div
      className={`dash-card ${className}`}
      style={{
        padding: '18px 22px',
        backgroundColor: '#FFFFFF',
        borderRadius: '14px',
        boxShadow: '0 2px 10px -2px rgba(15, 23, 42, 0.05)',
        border: '1px solid #E2E8F0',
        position: 'relative',
      }}
    >
      {/* Header & Mode Switcher */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {isSlaMode ? (
              <TrendingUp size={20} color="#10B981" strokeWidth={2.5} />
            ) : isAutoMode ? (
              <Zap size={20} color="#7C3AED" strokeWidth={2.5} />
            ) : (
              <BarChart2 size={20} color="#2563EB" strokeWidth={2.5} />
            )}
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, color: '#0F172A', letterSpacing: '-0.02em' }}>
              {isSlaMode
                ? title
                : isAutoMode
                  ? 'Hiệu Năng AI Tự Trị & Tốc Độ Hồi Sinh MTTR'
                  : 'Xu Hướng Kết Quả Action (Thành Công / Thất Bại / Bị Hủy)'}
            </h3>
          </div>
          <p style={{ fontSize: '0.75rem', color: '#64748B', margin: '3px 0 0 0', lineHeight: 1.4, maxWidth: '600px' }}>
            {isSlaMode
              ? subtitle
              : isAutoMode
                ? 'Đánh giá tốc độ phục hồi sự cố trung bình (MTTR giây) và tỷ lệ can thiệp tự động (AUTO)'
                : 'Theo dõi diễn biến số lượng hành động xử lý theo ngày/tháng và tỷ lệ thành công thực tế (SUCCEEDED vs FAILED vs CANCELLED)'}
          </p>
        </div>

        {/* Mode Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
          <div
            className="no-print"
            style={{
              display: 'inline-flex',
              backgroundColor: '#F1F5F9',
              padding: '3px',
              borderRadius: '8px',
              border: '1px solid #E2E8F0',
              flexWrap: 'wrap',
            }}
          >
            <button
              type="button"
              onClick={() => setChartMode('SLA')}
              style={{
                padding: '5px 11px',
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
              }}
            >
              <ShieldCheck size={14} color={isSlaMode ? '#0284C7' : '#64748B'} />
              <span>1. SLA Uptime</span>
            </button>
            <button
              type="button"
              onClick={() => setChartMode('AUTONOMOUS')}
              style={{
                padding: '5px 11px',
                fontSize: '0.75rem',
                fontWeight: isAutoMode ? 700 : 500,
                backgroundColor: isAutoMode ? '#FFFFFF' : 'transparent',
                color: isAutoMode ? '#7C3AED' : '#64748B',
                borderRadius: '6px',
                border: 'none',
                boxShadow: isAutoMode ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              <Activity size={14} color={isAutoMode ? '#7C3AED' : '#64748B'} />
              <span>2. MTTR & Tự Trị</span>
            </button>
            <button
              type="button"
              onClick={() => setChartMode('ACTIONS')}
              style={{
                padding: '5px 11px',
                fontSize: '0.75rem',
                fontWeight: isActionsMode ? 700 : 500,
                backgroundColor: isActionsMode ? '#FFFFFF' : 'transparent',
                color: isActionsMode ? '#059669' : '#64748B',
                borderRadius: '6px',
                border: 'none',
                boxShadow: isActionsMode ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              <BarChart2 size={14} color={isActionsMode ? '#059669' : '#64748B'} />
              <span>3. Kết Quả Action</span>
            </button>
          </div>

          {/* Dynamic Legend */}
          {isActionsMode ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.72rem', flexWrap: 'wrap' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#047857', fontWeight: 600 }}>
                <span style={{ width: '9px', height: '9px', borderRadius: '2px', backgroundColor: '#10B981', display: 'inline-block' }} />
                Thành công
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#DC2626', fontWeight: 600 }}>
                <span style={{ width: '9px', height: '9px', borderRadius: '2px', backgroundColor: '#EF4444', display: 'inline-block' }} />
                Thất bại
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#D97706', fontWeight: 600 }}>
                <span style={{ width: '9px', height: '9px', borderRadius: '2px', backgroundColor: '#F59E0B', display: 'inline-block' }} />
                Bị hủy / HITL
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#1D4ED8', fontWeight: 600 }}>
                <span style={{ width: '14px', height: '2.5px', backgroundColor: '#1D4ED8', display: 'inline-block' }} />
                Tỷ lệ đạt (%)
              </span>
            </div>
          ) : (
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
                <span style={{ color: '#94A3B8', fontFamily: 'monospace', fontWeight: 700, fontSize: '0.75rem' }}>--</span>
                <span style={{ color: '#64748B', fontWeight: 500 }}>{targetLineLabel}</span>
              </div>
            </div>
          )}
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
            <linearGradient id="slaBarGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22C55E" />
              <stop offset="100%" stopColor="#059669" />
            </linearGradient>
            <linearGradient id="autoBarGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#A855F7" />
              <stop offset="100%" stopColor="#6D28D9" />
            </linearGradient>
            <linearGradient id="slaAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.18" />
              <stop offset="70%" stopColor="#3B82F6" stopOpacity="0.04" />
              <stop offset="100%" stopColor="#3B82F6" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="autoAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#14B8A6" stopOpacity="0.18" />
              <stop offset="70%" stopColor="#14B8A6" stopOpacity="0.04" />
              <stop offset="100%" stopColor="#14B8A6" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Reference dashed line for SLA / Auto mode */}
          {!isActionsMode && (
            <>
              <line
                x1={padding.left}
                y1={targetLineY}
                x2={width - padding.right}
                y2={targetLineY}
                stroke="#94A3B8"
                strokeWidth="1.2"
                strokeDasharray="5,5"
              />
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
            </>
          )}

          {/* Left Y Ticks */}
          {leftTicks.map((val, idx) => {
            const y = isSlaMode
              ? getYIncidents(val)
              : isAutoMode
                ? getYMttr(val)
                : baselineY - getYActionsHeight(val);
            const labelText = isSlaMode || isActionsMode
              ? val >= 1000 ? `${(val / 1000).toFixed(1)}k` : `${val}`
              : `${val}s`;

            return (
              <g key={`left-grid-${idx}-${val}`}>
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

          {/* Right Y Labels */}
          {isSlaMode ? (
            <>
              <text x={width - padding.right + 12} y={padding.top + 10} fontSize="11" fontWeight="600" fill="#64748B">100.00%</text>
              <text x={width - padding.right + 12} y={slaTargetY + 4} fontSize="11" fontWeight="700" fill="#2563EB">99.90%</text>
              <text x={width - padding.right + 12} y={slaTargetY + chartHeight * 0.18 + 4} fontSize="11" fontWeight="500" fill="#94A3B8">99.80%</text>
            </>
          ) : isAutoMode ? (
            <>
              <text x={width - padding.right + 12} y={padding.top + 10} fontSize="11" fontWeight="600" fill="#64748B">100.0%</text>
              <text x={width - padding.right + 12} y={autoTargetY + 4} fontSize="11" fontWeight="700" fill="#0D9488">95.0%</text>
              <text x={width - padding.right + 12} y={autoTargetY + chartHeight * 0.35 + 4} fontSize="11" fontWeight="500" fill="#94A3B8">0.0%</text>
            </>
          ) : (
            <>
              <text x={width - padding.right + 12} y={getYSuccessRate(100) + 4} fontSize="11" fontWeight="600" fill="#1D4ED8">100%</text>
              <text x={width - padding.right + 12} y={getYSuccessRate(50) + 4} fontSize="11" fontWeight="500" fill="#64748B">50%</text>
              <text x={width - padding.right + 12} y={baselineY + 4} fontSize="11" fontWeight="500" fill="#94A3B8">0%</text>
            </>
          )}

          {/* Hover Vertical Line */}
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

          {/* Area fill */}
          {areaPath && (
            <path
              d={areaPath}
              fill={isSlaMode ? 'url(#slaAreaGrad)' : 'url(#autoAreaGrad)'}
              pointerEvents="none"
            />
          )}

          {/* Bars */}
          {data.map((d, i) => {
            const cx = getX(i);
            const barW = data.length <= 5 ? 24 : data.length <= 12 ? 18 : 13;
            const isHovered = hoverIndex === i;

            // Show every X label if <=14 items, else alternate to avoid label crowding
            const showXLabel = data.length <= 14 || i % 2 === 0 || i === data.length - 1 || isHovered;

            if (isActionsMode) {
              const okH = getYActionsHeight(d.succeeded);
              const failH = getYActionsHeight(d.failed);
              const cancelH = getYActionsHeight(d.cancelled);
              const totalH = okH + failH + cancelH;

              const okY = baselineY - okH;
              const failY = okY - failH;
              const cancelY = failY - cancelH;

              return (
                <g key={`act-bar-${i}-${d.month}`}>
                  {okH > 0 && (
                    <rect
                      x={cx - barW / 2}
                      y={okY}
                      width={barW}
                      height={okH}
                      rx={failH === 0 && cancelH === 0 ? 3 : 0}
                      fill="#10B981"
                      opacity={isHovered ? 1 : 0.9}
                    />
                  )}
                  {failH > 0 && (
                    <rect
                      x={cx - barW / 2}
                      y={failY}
                      width={barW}
                      height={failH}
                      fill="#EF4444"
                      opacity={isHovered ? 1 : 0.95}
                    />
                  )}
                  {cancelH > 0 && (
                    <rect
                      x={cx - barW / 2}
                      y={cancelY}
                      width={barW}
                      height={cancelH}
                      rx={3}
                      fill="#F59E0B"
                      opacity={isHovered ? 1 : 0.9}
                    />
                  )}
                  {totalH > 0 && (data.length <= 12 || isHovered) && (
                    <text
                      x={cx}
                      y={cancelY - 6}
                      textAnchor="middle"
                      fontSize="9.5"
                      fontWeight="700"
                      fill="#334155"
                    >
                      {d.total}
                    </text>
                  )}
                  {showXLabel && (
                    <text
                      x={cx}
                      y={baselineY + 18}
                      textAnchor="middle"
                      fontSize="10.5"
                      fontWeight={isHovered ? '700' : '500'}
                      fill={isHovered ? '#0F172A' : '#64748B'}
                    >
                      {d.month}
                    </text>
                  )}
                </g>
              );
            }

            const incidentVal = Number(d.preventedIncidents) || 0;
            const mttrVal = Number(d.mttrSeconds) || 0;
            const barTopY = isSlaMode ? getYIncidents(incidentVal) : getYMttr(mttrVal);
            const barH = isSlaMode
              ? incidentVal > 0 ? baselineY - barTopY : 0
              : mttrVal > 0 ? baselineY - barTopY : 0;
            const badgeText = isSlaMode ? `${incidentVal} vụ` : `${mttrVal}s`;
            const badgeW = Math.max(34, badgeText.length * 6 + 10);

            return (
              <g key={`bar-${i}-${d.month}`}>
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
                  />
                )}
                {barH > 0 && (
                  <g>
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
                      fill={isSlaMode ? '#059669' : '#7C3AED'}
                    >
                      {badgeText}
                    </text>
                  </g>
                )}
                {showXLabel && (
                  <text
                    x={cx}
                    y={baselineY + 18}
                    textAnchor="middle"
                    fontSize="11"
                    fontWeight={isHovered ? '700' : '500'}
                    fill={isHovered ? '#0F172A' : '#64748B'}
                  >
                    {d.month}
                  </text>
                )}
              </g>
            );
          })}

          {/* Curve line */}
          {curvePath && (
            <path
              d={curvePath}
              fill="none"
              stroke={isSlaMode ? '#1D4ED8' : isAutoMode ? '#0D9488' : '#1D4ED8'}
              strokeWidth={isActionsMode ? '2.4' : '3.2'}
              strokeDasharray={isActionsMode ? '4,3' : undefined}
              strokeLinecap="round"
              strokeLinejoin="round"
              pointerEvents="none"
            />
          )}

          {/* Curve dots */}
          {points.map((pt, i) => {
            const isHovered = hoverIndex === i;
            const showDotLabel = !isActionsMode && (data.length <= 10 || isHovered);
            const labelVal = isSlaMode
              ? `${Number(pt.raw.uptime).toFixed(2)}%`
              : isAutoMode
                ? `${(Number(pt.raw.autonomousHealingRate) || 0).toFixed(1)}%`
                : `${Number(pt.raw.successRate).toFixed(1)}%`;

            return (
              <g key={`dot-${i}-${pt.raw.month}`}>
                {showDotLabel && (
                  <text
                    x={pt.x}
                    y={pt.y - 10}
                    textAnchor="middle"
                    fontSize="10.5"
                    fontWeight="600"
                    fill="#334155"
                  >
                    {labelVal}
                  </text>
                )}
                {isHovered && (
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={9}
                    fill="none"
                    stroke={isAutoMode ? '#0D9488' : '#2563EB'}
                    strokeWidth="2"
                    opacity="0.3"
                  />
                )}
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={isHovered ? 5.5 : 3.8}
                  fill={isAutoMode ? '#0D9488' : '#1D4ED8'}
                  stroke="#FFFFFF"
                  strokeWidth={1.8}
                />
              </g>
            );
          })}
        </svg>

        {/* Tooltip */}
        {hoveredData && (
          <div
            style={{
              position: 'absolute',
              top: '34%',
              left: `${tooltipXPercent}%`,
              transform: 'translate(-50%, -50%)',
              backgroundColor: '#0F172A',
              color: '#FFFFFF',
              borderRadius: '10px',
              padding: '11px 15px',
              boxShadow: '0 12px 28px rgba(0, 0, 0, 0.35)',
              border: isActionsMode ? '1px solid #3B82F6' : isSlaMode ? '1px solid #10B981' : '1px solid #8B5CF6',
              fontSize: '0.75rem',
              pointerEvents: 'none',
              zIndex: 30,
              minWidth: '225px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', borderBottom: '1px solid rgba(255,255,255,0.12)', paddingBottom: '4px' }}>
              <span style={{ fontWeight: 700, color: '#38BDF8', fontSize: '0.78rem' }}>
                Mốc: {hoveredData.month}
              </span>
              <span style={{ color: '#94A3B8', fontWeight: 500 }}>
                {isActionsMode
                  ? `Đạt ${hoveredData.successRate}%`
                  : isSlaMode
                    ? `SLA: ${hoveredData.slaTarget}%`
                    : 'Mục tiêu: >95%'}
              </span>
            </div>

            {isActionsMode ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#94A3B8' }}>Tổng Action:</span>
                  <strong>{hoveredData.total} tác vụ</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#34D399' }}>• Thành công (SUCCEEDED):</span>
                  <strong style={{ color: '#34D399' }}>{hoveredData.succeeded}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#F87171' }}>• Thất bại (FAILED):</span>
                  <strong style={{ color: '#F87171' }}>{hoveredData.failed}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#FBBF24' }}>• Bị hủy (CANCELLED):</span>
                  <strong style={{ color: '#FBBF24' }}>{hoveredData.cancelled}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '4px', marginTop: '2px' }}>
                  <span style={{ color: '#94A3B8' }}>Thời gian xử lý TB:</span>
                  <strong>{hoveredData.avgDurationSeconds}s</strong>
                </div>
              </div>
            ) : isSlaMode ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#94A3B8' }}>Uptime Thực Tế:</span>
                  <strong style={{ color: '#38BDF8' }}>{hoveredData.uptime}%</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#94A3B8' }}>Sự Cố Tự Phục Hồi:</span>
                  <strong style={{ color: '#34D399' }}>{hoveredData.preventedIncidents} sự cố</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#94A3B8' }}>Downtime Tránh Được:</span>
                  <strong>{hoveredData.downtimeAvoidedHours ?? (Number(hoveredData.preventedIncidents || 0) * 0.3).toFixed(1)} giờ</strong>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#94A3B8' }}>Tốc Độ Hồi Sinh MTTR:</span>
                  <strong style={{ color: '#C084FC' }}>{hoveredData.mttrSeconds ?? 0} giây</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#94A3B8' }}>Tỷ Lệ Tự Trị AI:</span>
                  <strong style={{ color: '#34D399' }}>{hoveredData.autonomousHealingRate ?? 0}%</strong>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {showSummaryCards && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '16px',
            marginTop: '22px',
          }}
        >
          <div style={{ padding: '16px 20px', backgroundColor: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: 44, height: 44, borderRadius: '50%', backgroundColor: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Activity size={22} color="#1D4ED8" strokeWidth={2.2} />
            </div>
            <div>
              <div style={{ color: '#64748B', fontSize: '0.75rem', fontWeight: 700 }}>TỔNG THỜI GIAN VẬN HÀNH</div>
              <div style={{ fontWeight: 800, color: '#0F172A', fontSize: '1.25rem' }}>
                {summary?.totalOperatingHours ? `${summary.totalOperatingHours.toLocaleString('vi-VN')} Giờ` : '720 Giờ'}
              </div>
            </div>
          </div>

          <div style={{ padding: '16px 20px', backgroundColor: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: 44, height: 44, borderRadius: '50%', backgroundColor: '#F0F9FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <ShieldCheck size={22} color="#0284C7" strokeWidth={2.2} />
            </div>
            <div>
              <div style={{ color: '#64748B', fontSize: '0.75rem', fontWeight: 700 }}>CAM KẾT THỰC ĐẠT</div>
              <div style={{ fontWeight: 800, color: '#0284C7', fontSize: '1.25rem' }}>
                {summary?.actualUptime || '100.00%'} Uptime
              </div>
            </div>
          </div>

          <div style={{ padding: '16px 20px', backgroundColor: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: 44, height: 44, borderRadius: '50%', backgroundColor: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Wrench size={22} color="#16A34A" strokeWidth={2.2} />
            </div>
            <div>
              <div style={{ color: '#64748B', fontSize: '0.75rem', fontWeight: 700 }}>TỔNG SỰ CỐ ĐÃ XỬ LÝ</div>
              <div style={{ fontWeight: 800, color: '#16A34A', fontSize: '1.25rem' }}>
                {(summary?.totalIncidentsResolved ?? 0).toLocaleString('vi-VN')} sự cố
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
