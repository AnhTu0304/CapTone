import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { NodeMetricsFlowCanvas } from './NodeMetricsFlowCanvas';

jest.mock('lightweight-charts', () => ({
  createChart: jest.fn(() => ({
    addSeries: jest.fn(() => ({
      setData: jest.fn(),
      applyOptions: jest.fn(),
      update: jest.fn(),
    })),
    applyOptions: jest.fn(),
    remove: jest.fn(),
    subscribeCrosshairMove: jest.fn(),
    unsubscribeCrosshairMove: jest.fn(),
    timeScale: () => ({
      fitContent: jest.fn(),
      getVisibleLogicalRange: jest.fn(() => ({ from: 0, to: 10 })),
      setVisibleLogicalRange: jest.fn(),
      subscribeVisibleLogicalRangeChange: jest.fn(),
      unsubscribeVisibleLogicalRangeChange: jest.fn(),
    }),
  })),
  AreaSeries: 'AreaSeriesDefinition',
  LineSeries: 'LineSeriesDefinition',
  ColorType: { Solid: 'solid' },
  CrosshairMode: { Normal: 0 },
  LineStyle: { Dotted: 1 },
}));

let mockObservedWidth = 390;
let mockObservedHeight = 844;

beforeAll(() => {
  global.ResizeObserver = class ResizeObserver {
    constructor(cb) {
      this.cb = cb;
    }
    observe() {
      this.cb([{ contentRect: { width: mockObservedWidth, height: mockObservedHeight } }]);
    }
    disconnect() {}
  };
});

beforeEach(() => {
  mockObservedWidth = 390;
  mockObservedHeight = 844;
});

const baseChartModel = {
  cpuSeries: [{ time: 1700000000, value: 42 }],
  ramSeries: [{ time: 1700000000, value: 58 }],
  diskSeries: [{ time: 1700000000, value: 35 }],
  netRxSeries: [{ time: 1700000000, value: 1200 }],
  netTxSeries: [{ time: 1700000000, value: 800 }],
  samples: [{ time: 1700000000, cpu_usage_percent: 42 }],
  summary: {
    network: { currentRxPerSec: 1200, currentTxPerSec: 800 },
  },
};

const baseRows = [
  {
    name: 'worker-node-01',
    status: 'Sẵn sàng',
    podsCount: 12,
    cpuPercent: 42,
    memPercent: 58,
    diskPercent: 35,
    netRx: '1.2 KB/s',
    netTx: '800 B/s',
    cpuText: '42.0%',
    ramText: '58.0%',
    diskText: '35.0%',
  },
  {
    name: 'worker-node-02',
    status: 'Sẵn sàng',
    podsCount: 8,
    cpuPercent: 25,
    memPercent: 40,
    diskPercent: 30,
    netRx: '500 B/s',
    netTx: '300 B/s',
    cpuText: '25.0%',
    ramText: '40.0%',
    diskText: '30.0%',
  },
];

describe('NodeMetricsFlowCanvas Mobile Vertical Flow Mode', () => {
  test('renders vertical stacked stages 01->04 with time axis controls and node selection on <= 860px viewport', () => {
    const onSelectNode = jest.fn();
    const onChartZoomIn = jest.fn();
    const onChartResetZoom = jest.fn();

    render(
      <NodeMetricsFlowCanvas
        clusterName="k8s-cluster-ecommerce"
        isClusterOnline={true}
        presetLabel="15 phút"
        selectedNodeKey="worker-node-01"
        onSelectNode={onSelectNode}
        tableRows={baseRows}
        allNodesCount={2}
        chartModel={baseChartModel}
        hasData={true}
        onChartZoomIn={onChartZoomIn}
        onChartResetZoom={onChartResetZoom}
      />
    );

    expect(screen.getByTestId('node-metrics-mobile-vertical')).toBeInTheDocument();
    expect(screen.getByText(/01\s*•\s*NGUỒN THU THẬP eBPF/i)).toBeInTheDocument();
    expect(screen.getByText(/02\s*•\s*MÁY CHỦ K8S/i)).toBeInTheDocument();
    expect(screen.getByText(/03\s*•\s*BIỂU ĐỒ VIỄN TRẮC ĐỒNG BỘ/i)).toBeInTheDocument();
    expect(screen.getByTestId('chart-panel-cpu')).toBeInTheDocument();
    expect(screen.getByTestId('chart-panel-ram')).toBeInTheDocument();
    expect(screen.getByTestId('chart-panel-disk')).toBeInTheDocument();
    expect(screen.getByTestId('chart-panel-network')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('mobile-node-card-worker-node-02'));
    expect(onSelectNode).toHaveBeenCalledWith('worker-node-02');

    fireEvent.click(screen.getByTitle('Phóng to trục thời gian biểu đồ'));
    expect(onChartZoomIn).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText('Vừa khít'));
    expect(onChartResetZoom).toHaveBeenCalledTimes(1);
  });

  test('renders empty state cleanly and allows switching to horizontal canvas on mobile', () => {
    render(
      <NodeMetricsFlowCanvas
        clusterName="k8s-cluster-ecommerce"
        isClusterOnline={false}
        presetLabel="15 phút"
        selectedNodeKey=""
        tableRows={[]}
        allNodesCount={0}
        chartModel={{ samples: [], summary: {} }}
        hasData={false}
      />
    );

    expect(screen.getByTestId('node-metrics-mobile-vertical')).toBeInTheDocument();
    expect(screen.getByText(/Chưa có dữ liệu Node Metrics/i)).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('toggle-mobile-layout-mode'));
    expect(screen.queryByTestId('node-metrics-mobile-vertical')).not.toBeInTheDocument();

    // Toggle back to mobile vertical flow
    fireEvent.click(screen.getByTestId('toggle-mobile-layout-mode'));
    expect(screen.getByTestId('node-metrics-mobile-vertical')).toBeInTheDocument();
  });

  test('detects mobile vertical mode even when initial ResizeObserver height is 0', () => {
    mockObservedWidth = 390;
    mockObservedHeight = 0;

    render(
      <NodeMetricsFlowCanvas
        clusterName="k8s-cluster-ecommerce"
        isClusterOnline={false}
        presetLabel="15 phút"
        selectedNodeKey=""
        tableRows={[]}
        allNodesCount={0}
        chartModel={{ samples: [], summary: {} }}
        hasData={false}
      />
    );

    expect(screen.getByTestId('node-metrics-mobile-vertical')).toBeInTheDocument();
  });
});
