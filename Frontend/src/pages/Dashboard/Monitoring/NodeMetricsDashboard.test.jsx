import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import {
  toUnixSeconds,
  sanitizeNumber,
  formatBytes,
  formatThroughput,
  downsampleSeries,
  transformNodeMetricsForCharts,
} from '../../../utils/nodeMetricsChartUtils';
import { NodeMetricsChartsPanel } from '../../../components/dashboard/NodeMetricsChartsPanel';
import { telemetryService } from '../../../services/telemetryService';
import { nodeService } from '../../../services/nodeService';

// Mock lightweight-charts v5.2.1 to inspect chart lifecycle, series creation, setData, resize, and remove()
const mockSetData = jest.fn();
const mockFitContent = jest.fn();
const mockApplyOptions = jest.fn();
const mockRemove = jest.fn();
const mockSubscribeCrosshairMove = jest.fn();
const mockUnsubscribeCrosshairMove = jest.fn();
const mockAddSeries = jest.fn(() => ({
  setData: mockSetData,
  update: jest.fn(),
}));

jest.mock('lightweight-charts', () => ({
  createChart: jest.fn(() => ({
    addSeries: mockAddSeries,
    applyOptions: mockApplyOptions,
    remove: mockRemove,
    subscribeCrosshairMove: mockSubscribeCrosshairMove,
    unsubscribeCrosshairMove: mockUnsubscribeCrosshairMove,
    timeScale: () => ({
      fitContent: mockFitContent,
    }),
  })),
  AreaSeries: 'AreaSeriesDefinition',
  LineSeries: 'LineSeriesDefinition',
  ColorType: { Solid: 'solid' },
  CrosshairMode: { Normal: 0 },
  LineStyle: { Dotted: 1 },
}));

jest.mock('../../../services/telemetryService', () => ({
  telemetryService: {
    getNodeMetrics: jest.fn(),
  },
}));

jest.mock('../../../services/nodeService', () => ({
  nodeService: {
    getNodesByCluster: jest.fn(),
  },
}));

const { createChart } = require('lightweight-charts');

describe('Task 4.4 – Node Metrics Dashboard Charts & Utilities Suite', () => {
  let mockResizeDisconnect;
  let mockResizeObserve;

  beforeEach(() => {
    jest.clearAllMocks();
    mockResizeDisconnect = jest.fn();
    mockResizeObserve = jest.fn();
    global.ResizeObserver = jest.fn().mockImplementation(() => ({
      observe: mockResizeObserve,
      disconnect: mockResizeDisconnect,
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
        fitContent: mockFitContent,
      }),
    }));
    nodeService.getNodesByCluster.mockResolvedValue([
      { id: 'node-uuid-1', name: 'k8s-worker-01', status: 'Ready' },
      { id: 'node-uuid-2', name: 'k8s-worker-02', status: 'Ready' },
    ]);
  });

  // =========================================================================
  // 1. PURE DATA TRANSFORMATION, SORTING, DEDUPLICATION & SANITIZATION
  // =========================================================================
  test('1. Transforms valid backend node_metrics payload into CPU, RAM, Disk, and Network rate series', () => {
    const rawItems = [
      {
        id: '10',
        node_name: 'k8s-worker-01',
        cpu_usage_percent: 42.5,
        cpu_cores: 8,
        ram_total_bytes: '17179869184', // 16 GiB
        ram_used_bytes: '8589934592',   // 8 GiB
        ram_available_bytes: '8589934592',
        ram_usage_percent: 50.0,
        disk_total_bytes: '107374182400', // 100 GiB
        disk_used_bytes: '42949672960',   // 40 GiB
        disk_available_bytes: '64424509440',
        disk_usage_percent: 40.0,
        disk_filesystems: [
          {
            device: '/dev/nvme0n1p1',
            mount_point: '/',
            total_bytes: 107374182400,
            used_bytes: 32212254720,
            available_bytes: 75161927680,
            usage_percent: 30.0,
          },
          {
            device: '/dev/nvme0n1p2',
            mount_point: '/var/lib/docker',
            total_bytes: 214748364800,
            used_bytes: 150323855360,
            available_bytes: 64424509440,
            usage_percent: 70.0,
          },
        ],
        net_rx_bytes: '999999999', // Cumulative counter (must NOT be plotted as throughput)
        net_tx_bytes: '888888888',
        net_rx_bytes_per_sec: 4096.5,
        net_tx_bytes_per_sec: 2048.25,
        collection_status: 'OK',
        collected_at: '2026-10-25T08:00:00.000Z',
      },
    ];

    const allMountModel = transformNodeMetricsForCharts(rawItems, { mountPoint: 'ALL' });
    const expectedTime = toUnixSeconds('2026-10-25T08:00:00.000Z');

    expect(allMountModel.cpuSeries).toEqual([{ time: expectedTime, value: 42.5 }]);
    expect(allMountModel.ramSeries).toEqual([{ time: expectedTime, value: 50 }]);
    expect(allMountModel.diskSeries).toEqual([{ time: expectedTime, value: 40 }]);
    // Network series must plot per-second throughput rate, NOT cumulative counters
    expect(allMountModel.netRxSeries).toEqual([{ time: expectedTime, value: 4096.5 }]);
    expect(allMountModel.netTxSeries).toEqual([{ time: expectedTime, value: 2048.25 }]);
    expect(allMountModel.filesystems).toEqual(['ALL', '/', '/var/lib/docker']);

    // Selecting a specific mount point extracts that mount's usage_percent without summing percentages
    const dockerMountModel = transformNodeMetricsForCharts(rawItems, {
      mountPoint: '/var/lib/docker',
    });
    expect(dockerMountModel.diskSeries).toEqual([{ time: expectedTime, value: 70 }]);
    expect(dockerMountModel.summary.disk.currentPercent).toBe(70);
  });

  test('2. Sorts out-of-order timestamps strictly ascending and deduplicates identical timestamps', () => {
    const rawItems = [
      {
        id: '3',
        node_name: 'k8s-worker-01',
        cpu_usage_percent: 80.0,
        ram_usage_percent: 60.0,
        disk_usage_percent: 50.0,
        net_rx_bytes_per_sec: 300,
        net_tx_bytes_per_sec: 150,
        collected_at: '2026-10-25T08:00:30.000Z',
      },
      {
        id: '1',
        node_name: 'k8s-worker-01',
        cpu_usage_percent: 25.0,
        ram_usage_percent: 40.0,
        disk_usage_percent: 50.0,
        net_rx_bytes_per_sec: 100,
        net_tx_bytes_per_sec: 50,
        collected_at: '2026-10-25T08:00:10.000Z',
      },
      {
        id: '2',
        node_name: 'k8s-worker-01',
        cpu_usage_percent: 55.0,
        ram_usage_percent: 50.0,
        disk_usage_percent: 50.0,
        net_rx_bytes_per_sec: 200,
        net_tx_bytes_per_sec: 100,
        collected_at: '2026-10-25T08:00:20.000Z',
      },
      // Duplicate timestamp (08:00:20) with higher ID ('4') should replace ID '2'
      {
        id: '4',
        node_name: 'k8s-worker-01',
        cpu_usage_percent: 59.5,
        ram_usage_percent: 52.0,
        disk_usage_percent: 50.0,
        net_rx_bytes_per_sec: 220,
        net_tx_bytes_per_sec: 110,
        collected_at: '2026-10-25T08:00:20.000Z',
      },
    ];

    const model = transformNodeMetricsForCharts(rawItems);
    expect(model.cpuSeries).toHaveLength(3);
    expect(model.cpuSeries[0].time).toBeLessThan(model.cpuSeries[1].time);
    expect(model.cpuSeries[1].time).toBeLessThan(model.cpuSeries[2].time);
    expect(model.cpuSeries.map((p) => p.value)).toEqual([25.0, 59.5, 80.0]);
  });

  test('3. Filters and sanitizes malformed timestamps, NaN, Infinity, and out-of-range values', () => {
    const rawItems = [
      { id: '1', collected_at: 'invalid-date', cpu_usage_percent: 50 },
      { id: '2', collected_at: null, cpu_usage_percent: 50 },
      {
        id: '3',
        node_name: 'k8s-worker-01',
        collected_at: '2026-10-25T08:01:00.000Z',
        cpu_usage_percent: NaN,
        ram_usage_percent: Infinity,
        disk_usage_percent: 150, // Clamped to 100%
        net_rx_bytes_per_sec: -500, // Clamped to 0
        net_tx_bytes_per_sec: '1024',
      },
    ];

    const model = transformNodeMetricsForCharts(rawItems);
    expect(model.samples).toHaveLength(1);
    expect(model.cpuSeries).toHaveLength(0); // NaN omitted from series
    expect(model.ramSeries).toHaveLength(0); // Infinity omitted from series
    expect(model.diskSeries[0].value).toBe(100);
    expect(model.netRxSeries[0].value).toBe(0);
    expect(model.netTxSeries[0].value).toBe(1024);

    expect(sanitizeNumber(NaN, 0)).toBe(0);
    expect(formatBytes(1073741824)).toBe('1.0 GiB');
    expect(formatThroughput(2048)).toBe('2.0 KiB/s');
  });

  test('4. Extrema-preserving downsampling keeps first, last, and peak spike across 10,000 points', () => {
    const baseTime = 1700000000;
    const points = Array.from({ length: 10000 }, (_, i) => ({
      time: baseTime + i * 5,
      value: i === 4321 ? 99.9 : 25.0 + (i % 5),
    }));

    const downsampled = downsampleSeries(points, 360);
    expect(downsampled.length).toBeLessThanOrEqual(360);
    expect(downsampled[0]).toEqual(points[0]);
    expect(downsampled[downsampled.length - 1]).toEqual(points[points.length - 1]);

    // Verify strictly ascending unique timestamps
    for (let i = 1; i < downsampled.length; i++) {
      expect(downsampled[i].time).toBeGreaterThan(downsampled[i - 1].time);
    }

    // Verify the 99.9% spike at index 4321 was preserved
    expect(downsampled.some((p) => p.value === 99.9)).toBe(true);
  });

  // =========================================================================
  // 2. COMPONENT LIFECYCLE, EMPTY/ERROR STATES & STALE REQUEST CANCELLATION
  // =========================================================================
  test('5. Renders 4 lightweight-charts panels once, updates via setData, and calls chart.remove() on unmount', async () => {
    telemetryService.getNodeMetrics.mockResolvedValue({
      items: [
        {
          id: '101',
          node_name: 'k8s-worker-01',
          cpu_usage_percent: 35.4,
          cpu_cores: 4,
          ram_total_bytes: '8589934592',
          ram_used_bytes: '4294967296',
          ram_available_bytes: '4294967296',
          ram_usage_percent: 50.0,
          disk_total_bytes: '53687091200',
          disk_used_bytes: '21474836480',
          disk_available_bytes: '32212254720',
          disk_usage_percent: 40.0,
          net_rx_bytes: '102400',
          net_tx_bytes: '51200',
          net_rx_bytes_per_sec: 2048,
          net_tx_bytes_per_sec: 1024,
          collection_status: 'OK',
          collected_at: new Date().toISOString(),
        },
      ],
      pagination: { page: 1, limit: 200, total: 1, total_pages: 1, has_more: false },
    });

    const { unmount } = render(
      <NodeMetricsChartsPanel
        orgId="11111111-1111-4111-8111-111111111111"
        clusterId="22222222-2222-4222-8222-222222222222"
        nodesOverride={[{ id: 'node-uuid-1', name: 'k8s-worker-01', status: 'Ready' }]}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('chart-panel-cpu')).toBeInTheDocument();
    });

    expect(screen.getByTestId('chart-panel-ram')).toBeInTheDocument();
    expect(screen.getByTestId('chart-panel-disk')).toBeInTheDocument();
    expect(screen.getByTestId('chart-panel-network')).toBeInTheDocument();

    // 4 charts created (CPU, RAM, Disk, Network)
    expect(createChart).toHaveBeenCalledTimes(4);
    expect(mockSetData).toHaveBeenCalled();

    // Triggering refresh updates data via setData without recreating chart instances
    fireEvent.click(screen.getByTestId('node-metrics-refresh-btn'));
    await waitFor(() => {
      expect(telemetryService.getNodeMetrics).toHaveBeenCalledTimes(2);
    });
    expect(createChart).toHaveBeenCalledTimes(4);

    // Unmount cleans up ResizeObserver and calls chart.remove() on all 4 instances
    unmount();
    expect(mockResizeDisconnect).toHaveBeenCalledTimes(4);
    expect(mockRemove).toHaveBeenCalledTimes(4);
  });

  test('6. Displays Empty State when Backend returns 0 metrics and Error State with Retry on failure', async () => {
    telemetryService.getNodeMetrics.mockResolvedValueOnce({
      items: [],
      pagination: { page: 1, limit: 200, total: 0, total_pages: 1, has_more: false },
    });

    render(
      <NodeMetricsChartsPanel
        orgId="11111111-1111-4111-8111-111111111111"
        clusterId="22222222-2222-4222-8222-222222222222"
        nodesOverride={[{ id: 'node-uuid-1', name: 'k8s-worker-01', status: 'Ready' }]}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('node-metrics-empty-state')).toBeInTheDocument();
    });

    // Now simulate an API failure on refresh
    telemetryService.getNodeMetrics.mockRejectedValueOnce(
      new Error('Lỗi kết nối máy chủ: 500 Internal Server Error')
    );

    fireEvent.click(screen.getByTestId('node-metrics-refresh-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('node-metrics-error-state')).toBeInTheDocument();
    });
    expect(screen.getByText(/500 Internal Server Error/i)).toBeInTheDocument();

    // Clicking Retry recovers when API succeeds
    telemetryService.getNodeMetrics.mockResolvedValueOnce({
      items: [
        {
          id: '202',
          node_name: 'k8s-worker-01',
          cpu_usage_percent: 22.0,
          cpu_cores: 4,
          ram_total_bytes: '8589934592',
          ram_used_bytes: '2147483648',
          ram_available_bytes: '6442450944',
          ram_usage_percent: 25.0,
          disk_total_bytes: '53687091200',
          disk_used_bytes: '10737418240',
          disk_available_bytes: '42949672960',
          disk_usage_percent: 20.0,
          net_rx_bytes: '1000',
          net_tx_bytes: '1000',
          net_rx_bytes_per_sec: 512,
          net_tx_bytes_per_sec: 256,
          collection_status: 'OK',
          collected_at: new Date().toISOString(),
        },
      ],
    });

    fireEvent.click(screen.getByTestId('node-metrics-retry-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('chart-panel-cpu')).toBeInTheDocument();
    });
  });

  test('7. Switching Node cancels/ignores stale in-flight response so old Node data never overwrites active Node', async () => {
    let resolveFirstRequest;
    const firstPromise = new Promise((resolve) => {
      resolveFirstRequest = resolve;
    });

    // 1st call (for k8s-worker-01) hangs until after 2nd call (for k8s-worker-02) resolves
    telemetryService.getNodeMetrics
      .mockImplementationOnce(() => firstPromise)
      .mockResolvedValueOnce({
        items: [
          {
            id: '902',
            node_name: 'k8s-worker-02',
            cpu_usage_percent: 88.8,
            cpu_cores: 8,
            ram_total_bytes: '17179869184',
            ram_used_bytes: '8589934592',
            ram_available_bytes: '8589934592',
            ram_usage_percent: 50.0,
            disk_total_bytes: '53687091200',
            disk_used_bytes: '26843545600',
            disk_available_bytes: '26843545600',
            disk_usage_percent: 50.0,
            net_rx_bytes: '5000',
            net_tx_bytes: '5000',
            net_rx_bytes_per_sec: 1024,
            net_tx_bytes_per_sec: 1024,
            collection_status: 'OK',
            collected_at: new Date().toISOString(),
          },
        ],
      });

    render(
      <NodeMetricsChartsPanel
        orgId="11111111-1111-4111-8111-111111111111"
        clusterId="22222222-2222-4222-8222-222222222222"
        initialNodeName="k8s-worker-01"
        nodesOverride={[
          { id: 'node-uuid-1', name: 'k8s-worker-01', status: 'Ready' },
          { id: 'node-uuid-2', name: 'k8s-worker-02', status: 'Ready' },
        ]}
      />
    );

    // Immediately switch to k8s-worker-02 before k8s-worker-01 request resolves
    fireEvent.change(screen.getByTestId('node-metrics-node-select'), {
      target: { value: 'k8s-worker-02' },
    });

    await waitFor(() => {
      expect(screen.getByTestId('summary-card-cpu')).toHaveTextContent('88.8%');
    });

    // Now resolve the stale first request with 11.1% CPU
    await act(async () => {
      resolveFirstRequest({
        items: [
          {
            id: '901',
            node_name: 'k8s-worker-01',
            cpu_usage_percent: 11.1,
            cpu_cores: 4,
            ram_total_bytes: '8589934592',
            ram_used_bytes: '2147483648',
            ram_available_bytes: '6442450944',
            ram_usage_percent: 25.0,
            disk_total_bytes: '53687091200',
            disk_used_bytes: '10737418240',
            disk_available_bytes: '42949672960',
            disk_usage_percent: 20.0,
            net_rx_bytes: '100',
            net_tx_bytes: '100',
            net_rx_bytes_per_sec: 100,
            net_tx_bytes_per_sec: 100,
            collection_status: 'OK',
            collected_at: new Date().toISOString(),
          },
        ],
      });
    });

    // Active summary card must still show 88.8% (k8s-worker-02), NOT overwritten by stale 11.1%
    expect(screen.getByTestId('summary-card-cpu')).toHaveTextContent('88.8%');
  });
});
