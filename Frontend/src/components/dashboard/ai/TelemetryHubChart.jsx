import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BarChart2, Table2 } from 'lucide-react';

const METRIC_SHORT_LABELS = {
  cpu: 'CPU',
  ram: 'RAM',
  disk: 'Disk',
  latency: 'Latency',
  request_rate: 'Req/s',
  http_5xx_rate: '5xx',
  pod_restart_count: 'Restarts',
  replica_count: 'Pods',
};

export const getTimestepMetricValue = (timestep, cfg, podCount = 1) => {
  if (!timestep || !cfg) return 0;
  return Number(
    timestep[cfg.key] ??
      (cfg.key === 'http_5xx_rate' ? timestep.error_5xx : undefined) ??
      (cfg.key === 'pod_restart_count' ? timestep.restarts : undefined) ??
      (cfg.key === 'replica_count' ? (timestep.replicas ?? podCount ?? 1) : undefined) ??
      0
  );
};

const formatCompactTableValue = (val) => {
  const num = Number(val);
  if (!Number.isFinite(num)) return '0';
  return String(Math.round(num * 100) / 100);
};

// Cấu hình 10 cột của bảng dữ liệu realtime 12 bước (Mốc | Thời điểm | 8 Metric)
const REALTIME_TABLE_COLUMNS = [
  {
    key: 'step',
    labelKey: 'pipeline.canvas.aiHub.tableColStep',
    renderCell: (row, _podCount, idx) => ({
      text: row?.stepLabel || `T${idx + 1}`,
      color: '#047857',
      fontWeight: 700,
      bgColor: '#ECFDF5',
    }),
  },
  {
    key: 'time',
    labelKey: 'pipeline.canvas.aiHub.tableColTime',
    renderCell: (row, _podCount, idx) => ({
      text: row?.displayTime || row?.timeLabel || row?.stepLabel || `T${idx + 1}`,
      color: '#64748B',
      fontWeight: 500,
    }),
  },
  {
    key: 'cpu',
    staticLabel: 'CPU',
    metricKey: 'cpu',
    renderCell: (row, podCount) => {
      const v = getTimestepMetricValue(row, { key: 'cpu' }, podCount);
      return {
        text: `${formatCompactTableValue(v)}%`,
        color: v > 70 ? '#DC2626' : '#059669',
        fontWeight: v > 70 ? 700 : 500,
      };
    },
  },
  {
    key: 'ram',
    staticLabel: 'RAM',
    metricKey: 'ram',
    renderCell: (row, podCount) => ({
      text: `${formatCompactTableValue(getTimestepMetricValue(row, { key: 'ram' }, podCount))}%`,
      color: '#2563EB',
    }),
  },
  {
    key: 'disk',
    staticLabel: 'Disk',
    metricKey: 'disk',
    renderCell: (row, podCount) => ({
      text: `${formatCompactTableValue(getTimestepMetricValue(row, { key: 'disk' }, podCount))}%`,
      color: '#D97706',
    }),
  },
  {
    key: 'request_rate',
    staticLabel: 'Req/s',
    metricKey: 'request_rate',
    renderCell: (row, podCount) => ({
      text: formatCompactTableValue(getTimestepMetricValue(row, { key: 'request_rate' }, podCount)),
      color: '#0891B2',
    }),
  },
  {
    key: 'latency',
    labelKey: 'pipeline.canvas.aiHub.tableColLatency',
    metricKey: 'latency',
    renderCell: (row, podCount) => {
      const v = getTimestepMetricValue(row, { key: 'latency' }, podCount);
      return {
        text: `${formatCompactTableValue(v)}ms`,
        color: v > 100 ? '#D97706' : '#7C3AED',
      };
    },
  },
  {
    key: 'http_5xx_rate',
    staticLabel: '5xx',
    metricKey: 'http_5xx_rate',
    renderCell: (row, podCount) => {
      const v = getTimestepMetricValue(row, { key: 'http_5xx_rate' }, podCount);
      return {
        text: `${formatCompactTableValue(v)}%`,
        color: v > 0 ? '#DC2626' : '#64748B',
      };
    },
  },
  {
    key: 'pod_restart_count',
    staticLabel: 'Restarts',
    metricKey: 'pod_restart_count',
    renderCell: (row, podCount) => {
      const v = getTimestepMetricValue(row, { key: 'pod_restart_count' }, podCount);
      return {
        text: formatCompactTableValue(v),
        color: v > 0 ? '#DC2626' : '#64748B',
      };
    },
  },
  {
    key: 'replica_count',
    staticLabel: 'Pods',
    metricKey: 'replica_count',
    renderCell: (row, podCount) => ({
      text: formatCompactTableValue(getTimestepMetricValue(row, { key: 'replica_count' }, podCount)),
      color: '#334155',
      fontWeight: 600,
    }),
  },
];

const computeFocusedScale = (cfg, values, fallbackMaxY) => {
  if (!cfg) {
    const step = fallbackMaxY / 4;
    return {
      maxY: fallbackMaxY,
      ticks: [0, step, step * 2, step * 3, fallbackMaxY],
    };
  }

  const maxObserved = Math.max(...values, 0);
  if (cfg.unit === '%' && maxObserved > 60 && maxObserved <= 100) {
    return { maxY: 100, ticks: [0, 25, 50, 75, 100] };
  }
  if (maxObserved <= 0) {
    const ceil = cfg.key === 'latency' ? 100 : cfg.unit === '%' ? 20 : 10;
    const step = ceil / 4;
    return { maxY: ceil, ticks: [0, step, step * 2, step * 3, ceil] };
  }
  if (maxObserved <= 1) {
    return { maxY: 2, ticks: [0, 0.5, 1, 1.5, 2] };
  }
  if (maxObserved <= 5) {
    return { maxY: 8, ticks: [0, 2, 4, 6, 8] };
  }
  if (maxObserved <= 10) {
    return { maxY: 12, ticks: [0, 3, 6, 9, 12] };
  }
  const step = Math.max(1, Math.ceil((maxObserved * 1.2) / 4));
  const maxY = step * 4;
  return { maxY, ticks: [0, step, step * 2, step * 3, maxY] };
};

const formatValue = (num, unit) => {
  if (!Number.isFinite(num)) return '0';
  if (unit === 'ms') return num >= 100 ? num.toFixed(0) : num.toFixed(1);
  if (unit === '%' || unit === 'Req/s') return num.toFixed(2).replace(/\.00$/, '');
  return Number.isInteger(num) ? String(num) : num.toFixed(1);
};

/**
 * Biểu đồ chuỗi thời gian 12 bước (T1..T12) dùng chung cho cả Sơ đồ 1 & Sơ đồ 2.
 * Hỗ trợ nhấn trực tiếp vùng biểu đồ để đổi qua lại với bảng dữ liệu realtime 12 bước,
 * đồng thời giữ bộ lọc pill / thẻ Metric Input cho cả hai chế độ.
 */
const TelemetryHubChart = ({
  variantPrefix = 'd2',
  width = 396,
  height = 176,
  metricConfigs = [],
  effectiveTimesteps = [],
  podCount = 1,
  isAgentConnected = true,
  activeSweepIdx = 0,
  currentStepLabel = 'T12',
  baseChartMaxY = 100,
  selectedMetricKey = null,
  onSelectMetricKey,
}) => {
  const { t } = useTranslation('dashboard');
  const [viewMode, setViewMode] = useState('chart');

  const handleToggleView = (e) => {
    if (e) e.stopPropagation();
    setViewMode((prev) => (prev === 'chart' ? 'table' : 'chart'));
  };

  const isTableView = viewMode === 'table';
  const bodyHeight = isTableView ? Math.max(height, 200) : height;

  const activeMetricCfg = useMemo(
    () => (selectedMetricKey ? metricConfigs.find((m) => m.key === selectedMetricKey) || null : null),
    [selectedMetricKey, metricConfigs]
  );

  const focusedValues = useMemo(() => {
    if (!activeMetricCfg) return [];
    return effectiveTimesteps.map((ts) => getTimestepMetricValue(ts, activeMetricCfg, podCount));
  }, [activeMetricCfg, effectiveTimesteps, podCount]);

  const { maxY, ticks } = useMemo(
    () => computeFocusedScale(activeMetricCfg, focusedValues, baseChartMaxY),
    [activeMetricCfg, focusedValues, baseChartMaxY]
  );

  const chartPad = { top: 24, right: 12, bottom: 20, left: 32 };
  const innerW = width - chartPad.left - chartPad.right;
  const innerH = height - chartPad.top - chartPad.bottom;
  const totalStepsCount = effectiveTimesteps.length || 12;

  const getMiniX = (index) => {
    const total = Math.max(effectiveTimesteps.length - 1, 1);
    return chartPad.left + (index / total) * innerW;
  };

  const getMiniY = (value) => {
    const clamped = Math.max(0, Math.min(value, maxY));
    return chartPad.top + innerH - (clamped / Math.max(maxY, 1)) * innerH;
  };

  const sweepTargetX = getMiniX(activeSweepIdx);
  const isSweepWrapReset = activeSweepIdx >= Math.max(totalStepsCount - 1, 0);
  const isBatchCompleteStep = activeSweepIdx === 0;

  const displayedConfigs = activeMetricCfg ? [activeMetricCfg] : metricConfigs;
  const sweepPointVal = activeMetricCfg
    ? getTimestepMetricValue(effectiveTimesteps[activeSweepIdx], activeMetricCfg, podCount)
    : Number(effectiveTimesteps[activeSweepIdx]?.latency || effectiveTimesteps[activeSweepIdx]?.ram || 50);

  const focusedStats = useMemo(() => {
    if (!activeMetricCfg || focusedValues.length === 0) return null;
    const sum = focusedValues.reduce((acc, v) => acc + v, 0);
    const avg = sum / focusedValues.length;
    const peak = Math.max(...focusedValues);
    const latest = focusedValues[focusedValues.length - 1] ?? 0;
    return {
      latest: formatValue(latest, activeMetricCfg.unit),
      avg: formatValue(avg, activeMetricCfg.unit),
      peak: formatValue(peak, activeMetricCfg.unit),
    };
  }, [activeMetricCfg, focusedValues]);

  const thresholdValue = activeMetricCfg ? activeMetricCfg.threshold : 80;
  const showThresholdLine = Number.isFinite(thresholdValue) && thresholdValue > 0 && thresholdValue <= maxY;
  const thresholdText = activeMetricCfg
    ? `${thresholdValue}${activeMetricCfg.unit === '%' ? '%' : ''}`
    : '80%';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
      {/* Thanh chọn nhanh Metric trực tiếp trên thẻ biểu đồ */}
      <div
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '3.5px',
          padding: '2px 10px 0 10px',
        }}
      >
        <button
          type="button"
          data-testid={`${variantPrefix}-metric-pill-all`}
          onClick={(e) => {
            e.stopPropagation();
            if (onSelectMetricKey) onSelectMetricKey(null);
          }}
          style={{
            padding: '2px 7px',
            borderRadius: '999px',
            border: `1px solid ${!activeMetricCfg ? '#2563EB' : '#CBD5E1'}`,
            backgroundColor: !activeMetricCfg ? '#2563EB' : '#F8FAFC',
            color: !activeMetricCfg ? '#FFFFFF' : '#475569',
            fontSize: '0.58rem',
            fontWeight: 700,
            cursor: 'pointer',
            lineHeight: 1.25,
          }}
        >
          {t('pipeline.canvas.aiHub.filterAll')}
        </button>
        {metricConfigs.map((cfg) => {
          const isSelected = selectedMetricKey === cfg.key;
          return (
            <button
              key={`pill-${cfg.key}`}
              type="button"
              data-testid={`${variantPrefix}-metric-pill-${cfg.key}`}
              onClick={(e) => {
                e.stopPropagation();
                if (onSelectMetricKey) onSelectMetricKey(isSelected ? null : cfg.key);
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3.5px',
                padding: '2px 6.5px',
                borderRadius: '999px',
                border: `1px solid ${isSelected ? cfg.color : '#E2E8F0'}`,
                backgroundColor: isSelected ? cfg.color : '#FFFFFF',
                color: isSelected ? '#FFFFFF' : '#334155',
                fontSize: '0.58rem',
                fontWeight: 700,
                cursor: 'pointer',
                lineHeight: 1.25,
                transition: 'all 0.15s ease',
              }}
            >
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: isSelected ? '#FFFFFF' : cfg.color,
                  flexShrink: 0,
                }}
              />
              <span>{METRIC_SHORT_LABELS[cfg.key] || cfg.key}</span>
            </button>
          );
        })}
        <button
          type="button"
          data-testid={`${variantPrefix}-view-toggle-btn`}
          onClick={handleToggleView}
          title={isTableView
            ? t('pipeline.canvas.aiHub.clickTableToChartHint', { steps: totalStepsCount })
            : t('pipeline.canvas.aiHub.clickToCycleHint')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '3px',
            padding: '2px 7px',
            borderRadius: '999px',
            border: `1px solid ${isTableView ? '#0F172A' : '#94A3B8'}`,
            backgroundColor: isTableView ? '#0F172A' : '#F1F5F9',
            color: isTableView ? '#FFFFFF' : '#1E293B',
            fontSize: '0.58rem',
            fontWeight: 700,
            cursor: 'pointer',
            lineHeight: 1.25,
            transition: 'all 0.15s ease',
          }}
        >
          {isTableView ? <BarChart2 size={10} /> : <Table2 size={10} />}
          <span>{isTableView ? t('pipeline.canvas.aiHub.viewChartBtn') : t('pipeline.canvas.aiHub.viewTableBtn')}</span>
        </button>
      </div>

      {/* Vùng hiển thị chính: đổi qua lại giữa Biểu đồ SVG và Bảng 12 bước realtime khi nhấn */}
      {isTableView ? (
        <div
          data-testid={`${variantPrefix}-table-view`}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={handleToggleView}
          title={t('pipeline.canvas.aiHub.clickTableToChartHint', { steps: totalStepsCount })}
          style={{
            width: `${width}px`,
            height: `${bodyHeight}px`,
            margin: '0 auto',
            backgroundColor: '#FFFFFF',
            borderRadius: '8px',
            border: '1px solid #E2E8F0',
            overflowX: 'auto',
            overflowY: 'auto',
            cursor: 'pointer',
            userSelect: 'none',
          }}
        >
          {effectiveTimesteps.length === 0 ? (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.68rem', color: '#94A3B8' }}>
              {t('pipeline.canvas.aiHub.tableNoData')}
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9.5px', lineHeight: 1.15, textAlign: 'center', fontFamily: 'var(--font-mono)' }}>
              <thead>
                <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#64748B', fontWeight: 700, position: 'sticky', top: 0, zIndex: 2 }}>
                  {REALTIME_TABLE_COLUMNS.map((col) => {
                    const isColSelected = Boolean(col.metricKey && selectedMetricKey === col.metricKey);
                    return (
                      <th
                        key={col.key}
                        style={{
                          padding: '3px 2px',
                          whiteSpace: 'nowrap',
                          color: isColSelected && activeMetricCfg ? activeMetricCfg.color : '#64748B',
                          backgroundColor: isColSelected && activeMetricCfg ? activeMetricCfg.bgColor : '#F8FAFC',
                        }}
                      >
                        {col.labelKey ? t(col.labelKey) : col.staticLabel}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {effectiveTimesteps.map((row, idx) => {
                  const isActiveRow = isAgentConnected && idx === activeSweepIdx;
                  return (
                    <tr
                      key={row?.stepLabel || `row-${idx}`}
                      style={{
                        borderBottom: '1px solid #F1F5F9',
                        backgroundColor: isActiveRow ? '#F0F9FF' : '#FFFFFF',
                        boxShadow: isActiveRow ? 'inset 2px 0 0 #2563EB' : 'none',
                      }}
                    >
                      {REALTIME_TABLE_COLUMNS.map((col) => {
                        const cell = col.renderCell(row, podCount, idx);
                        const isColSelected = Boolean(col.metricKey && selectedMetricKey === col.metricKey);
                        return (
                          <td
                            key={`${idx}-${col.key}`}
                            style={{
                              padding: '1.5px 2px',
                              whiteSpace: 'nowrap',
                              color: cell.color,
                              fontWeight: isColSelected ? 700 : cell.fontWeight || 500,
                              backgroundColor: isColSelected && activeMetricCfg
                                ? activeMetricCfg.bgColor
                                : isActiveRow && !cell.bgColor
                                  ? '#F0F9FF'
                                  : cell.bgColor || 'transparent',
                            }}
                          >
                            {cell.text}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      ) : (
        <div
          data-testid={`${variantPrefix}-chart-view`}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={handleToggleView}
          title={t('pipeline.canvas.aiHub.clickToCycleHint')}
          style={{
            position: 'relative',
            width: `${width}px`,
            height: `${bodyHeight}px`,
            margin: '0 auto',
            backgroundColor: '#FFFFFF',
            borderRadius: '8px',
            cursor: 'pointer',
          }}
        >
          <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: '100%', display: 'block' }}>
          <defs>
            {metricConfigs.map((cfg) => (
              <linearGradient
                key={`${variantPrefix}-grad-${cfg.key}`}
                id={`${variantPrefix}-mini-grad-${cfg.key}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="0%" stopColor={cfg.color} stopOpacity={activeMetricCfg ? '0.32' : '0.26'} />
                <stop offset="100%" stopColor={cfg.color} stopOpacity="0.0" />
              </linearGradient>
            ))}
          </defs>

          {ticks.map((val) => {
            const y = getMiniY(val);
            const tickLabel = Number.isInteger(val) ? String(val) : val.toFixed(1);
            return (
              <g key={`${variantPrefix}-y-${val}`}>
                <line
                  x1={chartPad.left}
                  y1={y}
                  x2={chartPad.left + innerW}
                  y2={y}
                  stroke="#F1F5F9"
                  strokeWidth="1"
                  strokeDasharray="3 3"
                />
                <text
                  x={chartPad.left - 5}
                  y={y + 3}
                  fill="#94A3B8"
                  fontSize="8"
                  fontFamily="var(--font-mono)"
                  textAnchor="end"
                >
                  {tickLabel}
                </text>
              </g>
            );
          })}

          {showThresholdLine && (
            <g>
              <line
                x1={chartPad.left}
                y1={getMiniY(thresholdValue)}
                x2={chartPad.left + innerW}
                y2={getMiniY(thresholdValue)}
                stroke="#EF4444"
                strokeWidth="1.2"
                strokeDasharray="4 3"
              />
              <text
                x={chartPad.left + innerW - 2}
                y={getMiniY(thresholdValue) - 4}
                fill="#EF4444"
                fontSize="7.2"
                fontWeight="700"
                fontFamily="var(--font-mono)"
                textAnchor="end"
              >
                {thresholdText}
              </text>
            </g>
          )}

          {effectiveTimesteps.length > 0 &&
            displayedConfigs.map((cfg) => {
              const points = effectiveTimesteps.map((ts, i) => ({
                x: getMiniX(i),
                y: getMiniY(getTimestepMetricValue(ts, cfg, podCount)),
              }));
              if (points.length < 2) return null;
              const lineD = points.reduce((acc, p, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`, '');
              const areaD = `${lineD} L ${points[points.length - 1].x} ${getMiniY(0)} L ${points[0].x} ${getMiniY(0)} Z`;
              return (
                <g key={`${variantPrefix}-series-${cfg.key}`}>
                  <path d={areaD} fill={`url(#${variantPrefix}-mini-grad-${cfg.key})`} />
                  <path
                    d={lineD}
                    fill="none"
                    stroke={cfg.color}
                    strokeWidth={activeMetricCfg ? '2.3' : '1.6'}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {points.map((p, pIdx) => (
                    <circle
                      key={`${variantPrefix}-pt-${cfg.key}-${pIdx}`}
                      cx={p.x}
                      cy={p.y}
                      r={activeMetricCfg ? '3.1' : '2.4'}
                      fill="#FFFFFF"
                      stroke={cfg.color}
                      strokeWidth={activeMetricCfg ? '1.6' : '1.2'}
                    />
                  ))}
                </g>
              );
            })}

          {isAgentConnected && effectiveTimesteps.length > 0 && (
            <g
              style={{
                transform: `translateX(${sweepTargetX}px)`,
                transition: isSweepWrapReset ? 'none' : 'transform 0.35s cubic-bezier(0.22, 1, 0.36, 1)',
              }}
            >
              <line
                x1={0}
                y1={chartPad.top}
                x2={0}
                y2={chartPad.top + innerH}
                stroke={activeMetricCfg ? activeMetricCfg.color : '#2563EB'}
                strokeWidth="1.5"
                strokeDasharray="3 2"
              />
              <circle
                cx={0}
                cy={getMiniY(sweepPointVal)}
                r="4.5"
                fill={activeMetricCfg ? activeMetricCfg.color : '#2563EB'}
                stroke="#FFFFFF"
                strokeWidth="2"
                style={{ transition: 'cy 0.25s ease-out' }}
              />
              <text
                x={0}
                y={chartPad.top - 8}
                fill={activeMetricCfg ? activeMetricCfg.color : '#2563EB'}
                fontSize="8.5"
                fontWeight="800"
                fontFamily="var(--font-mono)"
                textAnchor={activeSweepIdx >= Math.max(totalStepsCount - 2, 1) ? 'end' : activeSweepIdx <= 1 ? 'start' : 'middle'}
              >
                {currentStepLabel} ({isBatchCompleteStep ? t('pipeline.canvas.aiHub.enough12') : t('pipeline.canvas.aiHub.newHead')})
              </text>
            </g>
          )}

          {effectiveTimesteps.map((ts, i) => (
            <text
              key={`${variantPrefix}-step-${i}`}
              x={getMiniX(i)}
              y={chartPad.top + innerH + 14}
              fill={i === activeSweepIdx ? (activeMetricCfg ? activeMetricCfg.color : '#2563EB') : '#64748B'}
              fontSize={i === activeSweepIdx ? '9' : '8'}
              fontWeight={i === activeSweepIdx ? '800' : '500'}
              fontFamily="var(--font-mono)"
              textAnchor="middle"
            >
              {ts.stepLabel || `T${i + 1}`}
            </text>
          ))}
        </svg>
        </div>
      )}

      {/* Dòng thông tin Metric đang chọn hoặc gợi ý nhấn để đổi qua lại Biểu đồ / Bảng */}
      <div
        data-testid={`${variantPrefix}-metric-readout`}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={!activeMetricCfg ? handleToggleView : (e) => e.stopPropagation()}
        style={{
          margin: '0 12px',
          padding: '4px 10px',
          borderRadius: '8px',
          backgroundColor: activeMetricCfg ? activeMetricCfg.bgColor : '#F8FAFC',
          border: `1px solid ${activeMetricCfg ? activeMetricCfg.borderColor : '#E2E8F0'}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '6px',
          fontSize: '0.62rem',
          fontFamily: activeMetricCfg ? 'var(--font-mono)' : 'inherit',
          color: activeMetricCfg ? '#0F172A' : '#64748B',
          cursor: !activeMetricCfg ? 'pointer' : 'default',
        }}
      >
        {activeMetricCfg && focusedStats ? (
          <>
            <span style={{ fontWeight: 800, color: activeMetricCfg.color, whiteSpace: 'nowrap' }}>
              {activeMetricCfg.label}
            </span>
            <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
              {t('pipeline.canvas.aiHub.metricReadout', {
                latest: focusedStats.latest,
                unit: activeMetricCfg.unit,
                avg: focusedStats.avg,
                max: focusedStats.peak,
              })}
            </span>
          </>
        ) : (
          <span style={{ width: '100%', textAlign: 'center', fontWeight: 600 }}>
            {isTableView
              ? t('pipeline.canvas.aiHub.clickTableToChartHint', { steps: totalStepsCount })
              : t('pipeline.canvas.aiHub.clickToCycleHint')}
          </span>
        )}
      </div>
    </div>
  );
};

export default React.memo(TelemetryHubChart);
