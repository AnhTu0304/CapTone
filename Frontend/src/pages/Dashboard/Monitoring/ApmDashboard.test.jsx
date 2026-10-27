import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import {
  toUnixSeconds,
  sanitizeNumber,
  formatLatency,
  formatRps,
  formatErrorRate,
  formatAvailability,
  calculatePercentile,
  getServiceHealthStatus,
  downsampleApmSeries,
  transformApmMetricsForCharts,
} from '../../../utils/apmChartUtils';
import { ApmChartsPanel } from '../../../components/dashboard/ApmChartsPanel';
import { ApmPage } from './ApmPage';
import { telemetryService } from '../../../services/telemetryService';
import { DashboardProvider } from '../context/DashboardContext';

// Mock lightweight-charts v5.2.1
const mockSetData = jest.fn();
const mockApplyOptions = jest.fn();
const mockRemove = jest.fn();
const mockSubscribeCrosshairMove = jest.fn();
const mockUnsubscribeCrosshairMove = jest.fn();
const mockAddSeries = jest.fn(() => ({
  setData: mockSetData,
  update: jest.fn(),
}));

jest.mock('lightweight-charts', () => ({
  createChart: jest.fn(),
  AreaSeries: 'AreaSeriesDefinition',
  LineSeries: 'LineSeriesDefinition',
  ColorType: { Solid: 'solid' },
  CrosshairMode: { Normal: 0 },
  LineStyle: { Dotted: 1 },
}));

jest.mock('../../../services/telemetryService', () => ({
  telemetryService: {
    getApmServices: jest.fn(),
    getMetricsSequence: jest.fn(),
  },
}));

const { createChart } = require('lightweight-charts');

describe('Task [S4][PB15] 1.1 – APM Monitoring Layout, Charts & Utilities Suite', () => {
  const sampleSequence = [
    {
      time_bucket: '2026-10-26T09:30:00.000Z',
      latency: 18.5,
      request_rate: 45.0,
      http_5xx_rate: 0.0,
      cpu: 12.4,
      ram: 25.1,
      pod_restart_count: 0,
      replica_count: 2,
    },
    {
      time_bucket: '2026-10-26T09:30:05.000Z',
      latency: 22.0,
      request_rate: 52.0,
      http_5xx_rate: 0.1,
      cpu: 15.0,
      ram: 25.5,
      pod_restart_count: 0,
      replica_count: 2,
    },
    {
      time_bucket: '2026-10-26T09:30:10.000Z',
      latency: 35.8,
      request_rate: 68.4,
      http_5xx_rate: 0.5,
      cpu: 21.2,
      ram: 26.0,
      pod_restart_count: 0,
      replica_count: 2,
    },
  ];

  const sampleServices = [
    {
      service_id: 'hello-minikube',
      service_name: 'hello-minikube',
      service_type: 'NodePort',
      avg_latency_ms: 22.5,
      max_latency_ms: 38.0,
      avg_request_rate: 55.0,
      avg_error_rate: 0.02,
      replica_count: 2,
      total_restarts: 0,
      last_collected_at: new Date().toISOString(),
    },
    {
      service_id: 'dashboard-metrics-scraper',
      service_name: 'dashboard-metrics-scraper',
      service_type: 'ClusterIP',
      avg_latency_ms: 8.2,
      max_latency_ms: 14.0,
      avg_request_rate: 12.0,
      avg_error_rate: 0.0,
      replica_count: 1,
      total_restarts: 0,
      last_collected_at: new Date().toISOString(),
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();

    global.ResizeObserver = jest.fn().mockImplementation(() => ({
      observe: jest.fn(),
      disconnect: jest.fn(),
      unobserve: jest.fn(),
    }));

    mockAddSeries.mockImplementation(() => ({
      setData: mockSetData,
      update: jest.fn(),
    }));

    createChart.mockImplementation(() => ({
      addSeries: mockAddSeries,
      applyOptions: mockApplyOptions,
      remove: mockRemove,
      subscribeCrosshairMove: mockSubscribeCrosshairMove,
      unsubscribeCrosshairMove: mockUnsubscribeCrosshairMove,
      timeScale: () => ({
        fitContent: jest.fn(),
      }),
    }));

    telemetryService.getApmServices.mockResolvedValue(sampleServices);
    telemetryService.getMetricsSequence.mockResolvedValue(sampleSequence);
  });

  describe('1. APM Data Transformation & Percentile Utilities', () => {
    test('1.1. Formats APM metrics with accurate units (Latency ms, Throughput req/s, Error %)', () => {
      expect(formatLatency(45.2)).toBe('45.2 ms');
      expect(formatLatency(1500)).toBe('1.5 s');
      expect(formatRps(88.4)).toBe('88.4 req/s');
      expect(formatRps(12500)).toBe('12.5k req/s');
      expect(formatErrorRate(0.05)).toBe('0.05%');
      expect(formatAvailability(99.954)).toBe('99.95%');

      // Edge cases: null / undefined / empty string safely format to '--' without fabricating 0
      expect(formatLatency(null)).toBe('--');
      expect(formatLatency(undefined)).toBe('--');
      expect(formatRps(null)).toBe('--');
      expect(formatErrorRate(null)).toBe('--');
      expect(formatAvailability(null)).toBe('--');
    });

    test('1.2. Computes p50, p95, and p99 percentiles correctly from distribution', () => {
      const latencies = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
      const p50 = calculatePercentile(latencies, 50);
      const p95 = calculatePercentile(latencies, 95);
      const p99 = calculatePercentile(latencies, 99);

      expect(p50).toBeCloseTo(55, 0);
      expect(p95).toBeCloseTo(95.5, 0);
      expect(p99).toBeCloseTo(99.1, 0);

      // Edge cases: empty or null returns null instead of fake 0
      expect(calculatePercentile([])).toBeNull();
      expect(calculatePercentile(null)).toBeNull();
    });

    test('1.3. Classifies service health status based on SLO thresholds and handles unknown safely', () => {
      expect(getServiceHealthStatus(0.0, 50).status).toBe('HEALTHY');
      expect(getServiceHealthStatus(1.5, 50).status).toBe('WARNING');
      expect(getServiceHealthStatus(0.0, 900).status).toBe('WARNING');
      expect(getServiceHealthStatus(6.0, 50).status).toBe('CRITICAL');
      expect(getServiceHealthStatus(0.0, 2500).status).toBe('CRITICAL');

      // Missing or null data returns UNKNOWN with informative label
      expect(getServiceHealthStatus(null, null).status).toBe('UNKNOWN');
      expect(getServiceHealthStatus(null, null).label).toBe('Chưa có dữ liệu');
    });

    test('1.4. Transforms raw backend sequence into sorted lightweight-charts points and KPI summaries', () => {
      const fixedNow = new Date('2026-10-26T09:31:00.000Z').getTime();
      const model = transformApmMetricsForCharts(sampleSequence, { nowMs: fixedNow });

      expect(model.samples.length).toBe(3);
      expect(model.latencySeries.length).toBe(3);
      expect(model.throughputSeries.length).toBe(3);
      expect(model.errorRateSeries.length).toBe(3);
      expect(model.summary.latency.avg).toBeCloseTo(25.4, 1);
      expect(model.summary.throughput.avg).toBeCloseTo(55.1, 1);
      expect(model.summary.isStale).toBe(false);
      expect(model.summary.availability).toBeGreaterThanOrEqual(99.0);
    });

    test('1.5. Detects Stale APM data when sample age exceeds 5 minutes', () => {
      const staleNow = new Date('2026-10-26T09:40:00.000Z').getTime(); // 10m later
      const model = transformApmMetricsForCharts(sampleSequence, { nowMs: staleNow });

      expect(model.summary.isStale).toBe(true);
    });

    test('1.5b. Prevents false-positive stale alerts on wide buckets (7d / 1800s bucket)', () => {
      // 30m bucket starts at 09:00:00
      const wideSequence = [
        {
          time_bucket: '2026-10-26T09:00:00.000Z',
          latency: 20.0,
          request_rate: 50.0,
          http_5xx_rate: 0.0,
          cpu: 10.0,
          ram: 20.0,
        },
      ];

      // At 09:24:00 (24 minutes into the 30-minute bucket), data is actively ingested and NOT stale
      const liveNow = new Date('2026-10-26T09:24:00.000Z').getTime();
      const liveModel = transformApmMetricsForCharts(wideSequence, {
        nowMs: liveNow,
        bucketSeconds: 1800,
      });
      expect(liveModel.summary.isStale).toBe(false);

      // At 09:36:00 (> 35m later, 5m past bucket end), stale alert correctly fires
      const trulyStaleNow = new Date('2026-10-26T09:36:00.000Z').getTime();
      const staleModel = transformApmMetricsForCharts(wideSequence, {
        nowMs: trulyStaleNow,
        bucketSeconds: 1800,
      });
      expect(staleModel.summary.isStale).toBe(true);
    });

    test('1.6. Downsampling preserves first, last, and peak anomaly point', () => {
      const points = [];
      for (let i = 0; i < 500; i++) {
        points.push({ time: 1700000000 + i * 5, value: i === 250 ? 999.0 : 10.0 });
      }

      const downsampled = downsampleApmSeries(points, 60);
      expect(downsampled.length).toBeLessThanOrEqual(60);
      expect(downsampled[0].time).toBe(points[0].time);
      expect(downsampled[downsampled.length - 1].time).toBe(points[points.length - 1].time);
      expect(downsampled.some((p) => p.value === 999.0)).toBe(true);
    });

    test('1.7. Empty sequence transforms to summary with null metrics instead of misleading 0', () => {
      const emptyModel = transformApmMetricsForCharts([]);
      expect(emptyModel.samples).toHaveLength(0);
      expect(emptyModel.summary.latency.avg).toBeNull();
      expect(emptyModel.summary.latency.p95).toBeNull();
      expect(emptyModel.summary.throughput.avg).toBeNull();
      expect(emptyModel.summary.errorRate.avg).toBeNull();
      expect(emptyModel.summary.availability).toBeNull();
      expect(emptyModel.summary.health.status).toBe('UNKNOWN');
    });
  });

  describe('2. ApmChartsPanel Component', () => {
    test('2.1. Renders 4 chart panels and initializes lightweight-charts with AreaSeries & LineSeries', () => {
      const model = transformApmMetricsForCharts(sampleSequence);
      render(<ApmChartsPanel chartModel={model} serviceName="hello-minikube" />);

      expect(screen.getByTestId('apm-charts-panel')).toBeInTheDocument();
      expect(screen.getByTestId('chart-panel-latency')).toBeInTheDocument();
      expect(screen.getByTestId('chart-panel-throughput')).toBeInTheDocument();
      expect(screen.getByTestId('chart-panel-error-rate')).toBeInTheDocument();
      expect(screen.getByTestId('chart-panel-service-resources')).toBeInTheDocument();

      // createChart should be called 4 times for the 4 panels
      expect(createChart).toHaveBeenCalledTimes(4);
      expect(mockAddSeries).toHaveBeenCalled();
      expect(mockSetData).toHaveBeenCalled();
    });

    test('2.2. Displays loading state when isLoading is true and no data is available', () => {
      render(<ApmChartsPanel chartModel={null} serviceName="hello-minikube" isLoading={true} />);
      expect(screen.getByTestId('apm-loading-state')).toBeInTheDocument();
    });

    test('2.3. Displays empty state when service has 0 telemetry data', () => {
      const emptyModel = transformApmMetricsForCharts([]);
      render(<ApmChartsPanel chartModel={emptyModel} serviceName="empty-service" />);
      expect(screen.getByTestId('apm-empty-state')).toBeInTheDocument();
    });

    test('2.4. Displays error state with retry button on failure', () => {
      const onRetry = jest.fn();
      render(
        <ApmChartsPanel
          chartModel={null}
          serviceName="hello-minikube"
          errorMessage="Network connection timeout"
          onRetry={onRetry}
        />
      );

      expect(screen.getByTestId('apm-error-state')).toBeInTheDocument();
      expect(screen.getByText(/Network connection timeout/i)).toBeInTheDocument();

      fireEvent.click(screen.getByTestId('apm-retry-btn'));
      expect(onRetry).toHaveBeenCalledTimes(1);
    });
  });

  describe('3. ApmPage Integration & User Interaction', () => {
    test('3.1. Renders APM Page with KPI cards, Service selector, and Microservices table', async () => {
      render(
        <DashboardProvider>
          <ApmPage />
        </DashboardProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('dashboard-apm-page')).toBeInTheDocument();
      });

      expect(screen.getByTestId('kpi-card-response-time')).toBeInTheDocument();
      expect(screen.getByTestId('kpi-card-throughput')).toBeInTheDocument();
      expect(screen.getByTestId('kpi-card-error-rate')).toBeInTheDocument();
      expect(screen.getByTestId('kpi-card-availability')).toBeInTheDocument();
      expect(screen.getByTestId('apm-services-table-panel')).toBeInTheDocument();
    });

    test('3.2. Selecting another service switches active APM charts and triggers new query', async () => {
      render(
        <DashboardProvider>
          <ApmPage />
        </DashboardProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('apm-service-select')).toBeInTheDocument();
      });

      act(() => {
        fireEvent.change(screen.getByTestId('apm-service-select'), {
          target: { value: 'dashboard-metrics-scraper' },
        });
      });

      await waitFor(() => {
        expect(telemetryService.getMetricsSequence).toHaveBeenCalledWith(
          'dashboard-metrics-scraper',
          expect.any(Object)
        );
      });
    });

    test('3.3. Changing time range preset (5m, 1h) updates bucketSeconds and limit', async () => {
      render(
        <DashboardProvider>
          <ApmPage />
        </DashboardProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('apm-range-1h')).toBeInTheDocument();
      });

      act(() => {
        fireEvent.click(screen.getByTestId('apm-range-1h'));
      });

      await waitFor(() => {
        expect(telemetryService.getMetricsSequence).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({ limit: 240, bucket_seconds: 15 })
        );
      });
    });

    test('3.4. Clicking "Xem Biểu Đồ" on a table row immediately selects that service', async () => {
      render(
        <DashboardProvider>
          <ApmPage />
        </DashboardProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('select-service-dashboard-metrics-scraper')).toBeInTheDocument();
      });

      act(() => {
        fireEvent.click(screen.getByTestId('select-service-dashboard-metrics-scraper'));
      });

      await waitFor(() => {
        expect(screen.getByTestId('apm-service-select')).toHaveValue('dashboard-metrics-scraper');
      });
    });

    test('3.5. Clean unmount removes all chart instances and clears timers without memory leaks', async () => {
      const { unmount } = render(
        <DashboardProvider>
          <ApmPage />
        </DashboardProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('apm-charts-panel')).toBeInTheDocument();
      });

      unmount();
      expect(mockRemove).toHaveBeenCalled();
    });

    test('3.6. Filters services list by status (ALL, HEALTHY, WARNING, CRITICAL)', async () => {
      render(
        <DashboardProvider>
          <ApmPage />
        </DashboardProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('apm-service-row-hello-minikube')).toBeInTheDocument();
      });

      // Filter by WARNING
      act(() => {
        fireEvent.click(screen.getByTestId('apm-filter-warning'));
      });

      // Since both hello-minikube (0.02%) and scraper (0%) are healthy (< 1%), neither is warning
      await waitFor(() => {
        expect(screen.getByText(/Không tìm thấy dịch vụ nào phù hợp/i)).toBeInTheDocument();
      });

      // Switch back to HEALTHY
      act(() => {
        fireEvent.click(screen.getByTestId('apm-filter-healthy'));
      });

      await waitFor(() => {
        expect(screen.getByTestId('apm-service-row-hello-minikube')).toBeInTheDocument();
      });
    });

    test('3.7. Filters services list by search keyword', async () => {
      render(
        <DashboardProvider>
          <ApmPage />
        </DashboardProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('apm-search-input')).toBeInTheDocument();
      });

      act(() => {
        fireEvent.change(screen.getByTestId('apm-search-input'), {
          target: { value: 'scraper' },
        });
      });

      await waitFor(() => {
        expect(screen.getByTestId('apm-service-row-dashboard-metrics-scraper')).toBeInTheDocument();
        expect(screen.queryByTestId('apm-service-row-hello-minikube')).not.toBeInTheDocument();
      });
    });

    test('3.8. Displays "--" in KPI cards when summary metrics are empty instead of fabricating 0', async () => {
      telemetryService.getMetricsSequence.mockResolvedValueOnce([]);

      render(
        <DashboardProvider>
          <ApmPage />
        </DashboardProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('kpi-card-response-time')).toBeInTheDocument();
      });

      const responseTimeCard = screen.getByTestId('kpi-card-response-time');
      expect(responseTimeCard).toHaveTextContent('--');

      const throughputCard = screen.getByTestId('kpi-card-throughput');
      expect(throughputCard).toHaveTextContent('--');

      const errorRateCard = screen.getByTestId('kpi-card-error-rate');
      expect(errorRateCard).toHaveTextContent('--');

      const availabilityCard = screen.getByTestId('kpi-card-availability');
      expect(availabilityCard).toHaveTextContent('--');
    });

    test('3.9. Changing time range to 24h and 7d calls API with correct bucketSeconds, limit and range', async () => {
      render(
        <DashboardProvider>
          <ApmPage />
        </DashboardProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('apm-range-24h')).toBeInTheDocument();
        expect(screen.getByTestId('apm-range-7d')).toBeInTheDocument();
      });

      // Click 24h
      act(() => {
        fireEvent.click(screen.getByTestId('apm-range-24h'));
      });

      await waitFor(() => {
        expect(telemetryService.getMetricsSequence).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({ limit: 288, bucket_seconds: 300, range: '24h' })
        );
      });

      // Click 7d
      act(() => {
        fireEvent.click(screen.getByTestId('apm-range-7d'));
      });

      await waitFor(() => {
        expect(telemetryService.getMetricsSequence).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({ limit: 336, bucket_seconds: 1800, range: '7d' })
        );
      });
    });

    test('3.10. Range buttons have accessible aria-pressed state and respond to keyboard Enter', async () => {
      render(
        <DashboardProvider>
          <ApmPage />
        </DashboardProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('apm-range-15m')).toBeInTheDocument();
      });

      const btn15m = screen.getByTestId('apm-range-15m');
      const btn24h = screen.getByTestId('apm-range-24h');

      expect(btn15m).toHaveAttribute('aria-pressed', 'true');
      expect(btn24h).toHaveAttribute('aria-pressed', 'false');

      // KeyDown Enter on 24h
      act(() => {
        fireEvent.keyDown(btn24h, { key: 'Enter', code: 'Enter' });
      });

      await waitFor(() => {
        expect(btn24h).toHaveAttribute('aria-pressed', 'true');
        expect(btn15m).toHaveAttribute('aria-pressed', 'false');
      });
    });

    test('3.11. Error panel displays message and retry button re-triggers API fetch', async () => {
      telemetryService.getMetricsSequence.mockRejectedValueOnce(new Error('Connection timeout to APM backend'));

      render(
        <DashboardProvider>
          <ApmPage />
        </DashboardProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('apm-retry-btn')).toBeInTheDocument();
        expect(screen.getByText(/Connection timeout to APM backend/i)).toBeInTheDocument();
      });

      // Reset mock to success and click retry
      telemetryService.getMetricsSequence.mockResolvedValueOnce(sampleSequence);

      act(() => {
        fireEvent.click(screen.getByTestId('apm-retry-btn'));
      });

      await waitFor(() => {
        expect(screen.getByTestId('chart-panel-latency')).toBeInTheDocument();
      });
    });
  });
});
