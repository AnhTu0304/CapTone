import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  createChart,
  AreaSeries,
  LineSeries,
  ColorType,
  CrosshairMode,
  LineStyle,
} from 'lightweight-charts';
import {
  Clock,
  Activity,
  AlertTriangle,
  Zap,
  TrendingUp,
  Cpu,
  Layers,
  ShieldAlert,
} from 'lucide-react';
import {
  formatUnixTime,
  formatLatency,
  formatRps,
  formatErrorRate,
} from '../../utils/apmChartUtils';

/**
 * Reusable single Lightweight Chart Panel for APM
 */
const LightweightApmChart = ({
  testId,
  primaryData = [],
  secondaryData = null,
  primaryColor = '#0284C7',
  primaryTopColor = 'rgba(2, 132, 199, 0.25)',
  primaryBottomColor = 'rgba(2, 132, 199, 0.02)',
  secondaryColor = '#A855F7',
  unitType = 'latency', // 'latency' | 'rps' | 'percent'
  height = 200,
  onHoverTimeChange,
}) => {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const primarySeriesRef = useRef(null);
  const secondarySeriesRef = useRef(null);
  const onHoverRef = useRef(onHoverTimeChange);

  useEffect(() => {
    onHoverRef.current = onHoverTimeChange;
  }, [onHoverTimeChange]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    const valueFormatter = (val) => {
      if (!Number.isFinite(val)) return '0';
      if (unitType === 'latency') return formatLatency(val);
      if (unitType === 'rps') return formatRps(val);
      return `${val.toFixed(1)}%`;
    };

    let chart = null;
    let resizeObserver = null;
    let crosshairHandler = null;

    try {
      const initialWidth = Math.max(260, container.clientWidth || 400);
      chart = createChart(container, {
        width: initialWidth,
        height,
        layout: {
          background: { type: ColorType.Solid, color: '#FFFFFF' },
          textColor: '#475569',
          fontFamily: 'monospace',
          fontSize: 11,
        },
        grid: {
          vertLines: { color: '#F1F5F9', style: LineStyle.Dotted },
          horzLines: { color: '#F1F5F9', style: LineStyle.Dotted },
        },
        crosshair: {
          mode: CrosshairMode.Normal,
        },
        rightPriceScale: {
          borderColor: '#E2E8F0',
          scaleMargins: { top: 0.12, bottom: 0.08 },
        },
        timeScale: {
          borderColor: '#E2E8F0',
          timeVisible: true,
          secondsVisible: true,
          tickMarkFormatter: (time) =>
            typeof time === 'number' ? formatUnixTime(time, false) : String(time),
        },
        localization: {
          priceFormatter: valueFormatter,
          timeFormatter: (time) =>
            typeof time === 'number' ? formatUnixTime(time, true) : String(time),
        },
      });

      const primarySeries = chart.addSeries(AreaSeries, {
        lineColor: primaryColor,
        topColor: primaryTopColor,
        bottomColor: primaryBottomColor,
        lineWidth: 2,
        priceFormat: {
          type: 'custom',
          minMove: 0.01,
          formatter: valueFormatter,
        },
        autoscaleInfoProvider:
          unitType === 'percent'
            ? () => ({
                priceRange: { minValue: 0, maxValue: 100 },
              })
            : undefined,
      });

      let secondarySeries = null;
      if (secondaryData !== null) {
        secondarySeries = chart.addSeries(LineSeries, {
          color: secondaryColor,
          lineWidth: 2,
          priceFormat: {
            type: 'custom',
            minMove: 0.01,
            formatter: valueFormatter,
          },
        });
      }

      chartRef.current = chart;
      primarySeriesRef.current = primarySeries;
      secondarySeriesRef.current = secondarySeries;

      crosshairHandler = (param) => {
        if (!param || !param.time || param.point === undefined) {
          if (onHoverRef.current) onHoverRef.current(null);
          return;
        }
        if (typeof param.time === 'number' && onHoverRef.current) {
          onHoverRef.current(param.time);
        }
      };
      chart.subscribeCrosshairMove(crosshairHandler);

      resizeObserver = new ResizeObserver((entries) => {
        if (!entries || entries.length === 0 || !chartRef.current) return;
        const entry = entries[0];
        const newWidth = Math.max(260, Math.floor(entry.contentRect.width));
        try {
          chartRef.current.applyOptions({ width: newWidth });
        } catch (_) {}
      });
      resizeObserver.observe(container);
    } catch (e) {
      console.warn('[LightweightApmChart] Init error:', e?.message);
    }

    return () => {
      if (resizeObserver) resizeObserver.disconnect();
      if (chart && crosshairHandler) {
        try {
          chart.unsubscribeCrosshairMove(crosshairHandler);
        } catch (_) {}
      }
      if (chart) {
        try {
          chart.remove();
        } catch (_) {}
      }
      chartRef.current = null;
      primarySeriesRef.current = null;
      secondarySeriesRef.current = null;
    };
  }, [
    height,
    primaryColor,
    primaryTopColor,
    primaryBottomColor,
    secondaryColor,
    unitType,
    secondaryData !== null,
  ]);

  // Update data dynamically
  useEffect(() => {
    if (!primarySeriesRef.current) return;
    try {
      primarySeriesRef.current.setData(Array.isArray(primaryData) ? primaryData : []);
    } catch (e) {
      console.warn('[LightweightApmChart] primary setData error:', e?.message);
    }
  }, [primaryData]);

  useEffect(() => {
    if (!secondarySeriesRef.current || secondaryData === null) return;
    try {
      secondarySeriesRef.current.setData(Array.isArray(secondaryData) ? secondaryData : []);
    } catch (e) {
      console.warn('[LightweightApmChart] secondary setData error:', e?.message);
    }
  }, [secondaryData]);

  return (
    <div
      data-testid={testId}
      ref={containerRef}
      style={{
        width: '100%',
        height: `${height}px`,
        position: 'relative',
        borderRadius: '8px',
        overflow: 'hidden',
      }}
    />
  );
};

export const ApmChartsPanel = ({
  chartModel,
  serviceName = 'sme-order-service',
  isLoading = false,
  errorMessage = null,
  onRetry,
}) => {
  const [hoveredTime, setHoveredTime] = useState(null);

  const activeSample = useMemo(() => {
    if (hoveredTime !== null && chartModel?.byTimeMap?.has(hoveredTime)) {
      return chartModel.byTimeMap.get(hoveredTime);
    }
    return chartModel?.latestSample || null;
  }, [hoveredTime, chartModel?.byTimeMap, chartModel?.latestSample]);

  const { summary } = chartModel || {};
  const hasData = chartModel && chartModel.samples && chartModel.samples.length > 0;

  if (isLoading && !hasData) {
    return (
      <div
        data-testid="apm-loading-state"
        style={{
          padding: '60px 20px',
          textAlign: 'center',
          backgroundColor: '#FFFFFF',
          borderRadius: '12px',
          border: '1px solid #E2E8F0',
        }}
      >
        <div className="animate-spin" style={{ display: 'inline-block', marginBottom: '12px' }}>
          <Activity size={32} color="#0284C7" />
        </div>
        <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#334155' }}>
          Đang tải dữ liệu viễn trắc APM cho dịch vụ <code>{serviceName}</code>...
        </div>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div
        data-testid="apm-error-state"
        style={{
          padding: '30px 24px',
          backgroundColor: '#FEF2F2',
          border: '1px solid #FCA5A5',
          borderRadius: '12px',
          color: '#991B1B',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <AlertTriangle size={24} color="#DC2626" />
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.9375rem' }}>Lỗi truy vấn số liệu APM</div>
            <div style={{ fontSize: '0.8125rem', marginTop: '2px' }}>{errorMessage}</div>
          </div>
        </div>
        {onRetry && (
          <button
            type="button"
            data-testid="apm-retry-btn"
            onClick={onRetry}
            style={{
              padding: '6px 14px',
              backgroundColor: '#DC2626',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '6px',
              fontWeight: 700,
              fontSize: '0.8125rem',
              cursor: 'pointer',
            }}
          >
            Thử lại
          </button>
        )}
      </div>
    );
  }

  if (!hasData) {
    return (
      <div
        data-testid="apm-empty-state"
        style={{
          padding: '60px 20px',
          textAlign: 'center',
          backgroundColor: '#FFFFFF',
          borderRadius: '12px',
          border: '1px dashed #CBD5E1',
        }}
      >
        <Activity size={36} color="#94A3B8" style={{ marginBottom: '12px' }} />
        <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0F172A', margin: 0 }}>
          Chưa có số liệu APM cho dịch vụ "{serviceName}"
        </h3>
        <p style={{ fontSize: '0.8125rem', color: '#64748B', maxWidth: '460px', margin: '6px auto 0' }}>
          Đảm bảo Agent eBPF / K8s đang thu thập dữ liệu lưu lượng truy vấn cho service này hoặc chuyển sang dịch vụ khác.
        </p>
      </div>
    );
  }

  return (
    <div
      className="apm-charts-panel"
      data-testid="apm-charts-panel"
      style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}
    >
      {/* 1. Stale Metrics Warning Banner */}
      {summary?.isStale && (
        <div
          data-testid="apm-stale-banner"
          style={{
            padding: '10px 16px',
            backgroundColor: '#FFFBEB',
            border: '1px solid #FDE68A',
            borderRadius: '8px',
            color: '#92400E',
            fontSize: '0.8125rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Clock size={16} color="#D97706" />
          <span>
            <strong>Dữ liệu cũ (Stale APM):</strong> Mẫu gần nhất được ghi nhận lúc{' '}
            <code>{formatUnixTime(chartModel.latestSample.time, true)}</code>. Hãy kiểm tra Agent thu thập.
          </span>
        </div>
      )}

      {/* 2. Four APM Chart Panels Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))',
          gap: '16px',
        }}
      >
        {/* Chart 1: Latency / Response Time */}
        <div
          className="dash-card"
          data-testid="chart-panel-latency"
          style={{
            padding: '16px 18px',
            backgroundColor: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '12px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock size={16} color="#0284C7" />
              <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#0F172A' }}>
                Thời Gian Phản Hồi (Response Time)
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  fontSize: '0.75rem',
                  fontFamily: 'monospace',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  backgroundColor: '#F0F9FF',
                  color: '#0369A1',
                  fontWeight: 700,
                }}
              >
                p95: {formatLatency(summary?.latency?.p95)}
              </span>
              <span
                style={{
                  fontSize: '0.75rem',
                  fontFamily: 'monospace',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  backgroundColor: '#F8FAFC',
                  color: '#475569',
                  fontWeight: 600,
                }}
              >
                Max: {formatLatency(summary?.latency?.max)}
              </span>
            </div>
          </div>
          <LightweightApmChart
            testId="chart-latency-container"
            primaryData={chartModel.latencySeries}
            primaryColor="#0284C7"
            primaryTopColor="rgba(2, 132, 199, 0.25)"
            primaryBottomColor="rgba(2, 132, 199, 0.02)"
            unitType="latency"
            height={200}
            onHoverTimeChange={setHoveredTime}
          />
          <div
            style={{
              marginTop: '8px',
              fontSize: '0.75rem',
              color: '#64748B',
              display: 'flex',
              justifyContent: 'space-between',
            }}
          >
            <span>
              Hiện tại:{' '}
              <strong style={{ color: '#0F172A', fontFamily: 'monospace' }}>
                {formatLatency(activeSample ? activeSample.latency : summary?.latency?.current)}
              </strong>
            </span>
            <span>
              Trung bình: <strong style={{ fontFamily: 'monospace' }}>{formatLatency(summary?.latency?.avg)}</strong>
            </span>
          </div>
        </div>

        {/* Chart 2: Throughput / Request Rate */}
        <div
          className="dash-card"
          data-testid="chart-panel-throughput"
          style={{
            padding: '16px 18px',
            backgroundColor: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '12px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <TrendingUp size={16} color="#6366F1" />
              <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#0F172A' }}>
                Lưu Lượng Truy Cập (Throughput - RPS)
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  fontSize: '0.75rem',
                  fontFamily: 'monospace',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  backgroundColor: '#EEF2FF',
                  color: '#4F46E5',
                  fontWeight: 700,
                }}
              >
                Đỉnh: {formatRps(summary?.throughput?.max)}
              </span>
            </div>
          </div>
          <LightweightApmChart
            testId="chart-throughput-container"
            primaryData={chartModel.throughputSeries}
            primaryColor="#6366F1"
            primaryTopColor="rgba(99, 102, 241, 0.25)"
            primaryBottomColor="rgba(99, 102, 241, 0.02)"
            unitType="rps"
            height={200}
            onHoverTimeChange={setHoveredTime}
          />
          <div
            style={{
              marginTop: '8px',
              fontSize: '0.75rem',
              color: '#64748B',
              display: 'flex',
              justifyContent: 'space-between',
            }}
          >
            <span>
              Hiện tại:{' '}
              <strong style={{ color: '#0F172A', fontFamily: 'monospace' }}>
                {formatRps(activeSample ? activeSample.request_rate : summary?.throughput?.current)}
              </strong>
            </span>
            <span>
              Trung bình: <strong style={{ fontFamily: 'monospace' }}>{formatRps(summary?.throughput?.avg)}</strong>
            </span>
          </div>
        </div>

        {/* Chart 3: Error Rate HTTP 5xx */}
        <div
          className="dash-card"
          data-testid="chart-panel-error-rate"
          style={{
            padding: '16px 18px',
            backgroundColor: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '12px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldAlert size={16} color="#EF4444" />
              <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#0F172A' }}>
                Tỷ Lệ Lỗi (HTTP 5xx Rate)
              </span>
            </div>
            <span
              style={{
                fontSize: '0.75rem',
                fontFamily: 'monospace',
                padding: '2px 8px',
                borderRadius: '4px',
                backgroundColor: summary?.errorRate?.max > 0 ? '#FEF2F2' : '#F8FAFC',
                color: summary?.errorRate?.max > 0 ? '#DC2626' : '#64748B',
                fontWeight: 700,
              }}
            >
              Đỉnh: {formatErrorRate(summary?.errorRate?.max)}
            </span>
          </div>
          <LightweightApmChart
            testId="chart-error-rate-container"
            primaryData={chartModel.errorRateSeries}
            primaryColor="#EF4444"
            primaryTopColor="rgba(239, 68, 68, 0.25)"
            primaryBottomColor="rgba(239, 68, 68, 0.02)"
            unitType="percent"
            height={200}
            onHoverTimeChange={setHoveredTime}
          />
          <div
            style={{
              marginTop: '8px',
              fontSize: '0.75rem',
              color: '#64748B',
              display: 'flex',
              justifyContent: 'space-between',
            }}
          >
            <span>
              Hiện tại:{' '}
              <strong style={{ color: '#0F172A', fontFamily: 'monospace' }}>
                {formatErrorRate(activeSample ? activeSample.http_5xx_rate : summary?.errorRate?.current)}
              </strong>
            </span>
            <span>
              Trung bình: <strong style={{ fontFamily: 'monospace' }}>{formatErrorRate(summary?.errorRate?.avg)}</strong>
            </span>
          </div>
        </div>

        {/* Chart 4: Service CPU & RAM */}
        <div
          className="dash-card"
          data-testid="chart-panel-service-resources"
          style={{
            padding: '16px 18px',
            backgroundColor: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '12px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Cpu size={16} color="#3B82F6" />
              <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#0F172A' }}>
                Tài Nguyên Workload (CPU &amp; RAM)
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#2563EB' }}>
                ● CPU
              </span>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#A855F7' }}>
                ● RAM
              </span>
            </div>
          </div>
          <LightweightApmChart
            testId="chart-resources-container"
            primaryData={chartModel.cpuSeries}
            secondaryData={chartModel.ramSeries}
            primaryColor="#3B82F6"
            primaryTopColor="rgba(59, 130, 246, 0.20)"
            primaryBottomColor="rgba(59, 130, 246, 0.02)"
            secondaryColor="#A855F7"
            unitType="percent"
            height={200}
            onHoverTimeChange={setHoveredTime}
          />
          <div
            style={{
              marginTop: '8px',
              fontSize: '0.75rem',
              color: '#64748B',
              display: 'flex',
              justifyContent: 'space-between',
            }}
          >
            <span>
              CPU:{' '}
              <strong style={{ color: '#2563EB', fontFamily: 'monospace' }}>
                {activeSample ? activeSample.cpu.toFixed(1) : chartModel.latestSample?.cpu.toFixed(1) || 0}%
              </strong>
            </span>
            <span>
              RAM:{' '}
              <strong style={{ color: '#9333EA', fontFamily: 'monospace' }}>
                {activeSample ? activeSample.ram.toFixed(1) : chartModel.latestSample?.ram.toFixed(1) || 0}%
              </strong>
            </span>
            <span>
              Replicas:{' '}
              <strong style={{ color: '#0F172A', fontFamily: 'monospace' }}>
                {summary?.replicas || 1}
              </strong>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ApmChartsPanel;
