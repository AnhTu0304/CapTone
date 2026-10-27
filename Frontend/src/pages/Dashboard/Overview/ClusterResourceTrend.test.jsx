import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import InteractiveResourceChart from '../../../components/dashboard/InteractiveResourceChart';

describe('[S4][PB19] – Cluster Resource Trend Chart & Overview Suite', () => {
  const sampleData = [
    {
      time: '14:00:00',
      fullTime: '14:00:00 (27/10/2026)',
      cpu: 25.5,
      ram: 40.0,
      rawRamMb: 3200,
      disk: 15.0,
      latency: 1.2,
    },
    {
      time: '14:05:00',
      fullTime: '14:05:00 (27/10/2026)',
      cpu: 50.0,
      ram: 60.0,
      rawRamMb: 4800,
      disk: 15.0,
      latency: 1.5,
    },
    {
      time: '14:10:00',
      fullTime: '14:10:00 (27/10/2026)',
      cpu: 75.0,
      ram: 80.0,
      rawRamMb: 6400,
      disk: 16.0,
      latency: 2.0,
    },
  ];

  test('1. Renders SVG chart, series lines, and title when valid telemetry data is present', () => {
    const { container } = render(
      <InteractiveResourceChart
        data={sampleData}
        totalCpuCores={8}
        totalMemoryGb={16}
        title="Biến thiên Tài nguyên Cụm máy chủ (CPU & RAM)"
        isLive={true}
        isLoading={false}
      />
    );

    expect(screen.getByText('Biến thiên Tài nguyên Cụm máy chủ (CPU & RAM)')).toBeInTheDocument();
    expect(container.querySelector('svg')).toBeInTheDocument();
    expect(screen.getByText('TRỰC TIẾP (eBPF 5s)')).toBeInTheDocument();
  });

  test('2. Renders Loading state when isLoading is true', () => {
    render(
      <InteractiveResourceChart
        data={[]}
        isLoading={true}
      />
    );

    expect(screen.getByText('Đang tải dữ liệu chuỗi thời gian...')).toBeInTheDocument();
    expect(screen.queryByText('Đang đồng bộ chuỗi viễn trắc eBPF từ cụm...')).not.toBeInTheDocument();
  });

  test('3. Renders honest Empty State with Retry button when data is empty and not loading', () => {
    const handleRetry = jest.fn();
    render(
      <InteractiveResourceChart
        data={[]}
        isLoading={false}
        onRetry={handleRetry}
      />
    );

    expect(screen.getByText('Chưa có dữ liệu viễn trắc đo đạc')).toBeInTheDocument();
    expect(screen.queryByText('Đang đồng bộ chuỗi viễn trắc eBPF từ cụm...')).not.toBeInTheDocument();

    const retryBtn = screen.getByRole('button', { name: /Thử lại/i });
    expect(retryBtn).toBeInTheDocument();
    fireEvent.click(retryBtn);
    expect(handleRetry).toHaveBeenCalledTimes(1);
  });

  test('4. Renders Error State when error prop is provided', () => {
    const handleRetry = jest.fn();
    render(
      <InteractiveResourceChart
        data={[]}
        error="Lỗi kết nối API viễn trắc máy chủ"
        isLoading={false}
        onRetry={handleRetry}
      />
    );

    expect(screen.getByText('Lỗi tải dữ liệu viễn trắc')).toBeInTheDocument();
    expect(screen.getByText('Lỗi kết nối API viễn trắc máy chủ')).toBeInTheDocument();

    const retryBtn = screen.getByRole('button', { name: /Thử lại/i });
    fireEvent.click(retryBtn);
    expect(handleRetry).toHaveBeenCalledTimes(1);
  });

  test('5. Calculates CPU and RAM averages, peaks, and physical conversions accurately', () => {
    render(
      <InteractiveResourceChart
        data={sampleData}
        totalCpuCores={8}
        totalMemoryGb={16}
      />
    );

    // CPU avg: (25.5 + 50 + 75) / 3 = 50.17%, peak: 75%
    // 50.17% of 8 vCPUs = 4.01 vCPUs
    expect(screen.getByText(/50\.17%/)).toBeInTheDocument();
    expect(screen.getByText(/Đỉnh 75%/)).toBeInTheDocument();
    expect(screen.getByText(/4\.01 \/ 8 vCPUs/)).toBeInTheDocument();

    // RAM avg: (40 + 60 + 80) / 3 = 60%, peak: 80%
    // RAM MB avg: (3200 + 4800 + 6400) / 3 = 4800 MB
    expect(screen.getByText(/4800 MB/)).toBeInTheDocument();
    expect(screen.getByText(/Đỉnh 6400 MB/)).toBeInTheDocument();
    expect(screen.getByText(/60% \/ 16 GB/)).toBeInTheDocument();
  });

  test('6. Shows N/A or dash when data is empty instead of reporting false 0% metrics', () => {
    render(
      <InteractiveResourceChart
        data={[]}
        totalCpuCores={8}
        totalMemoryGb={16}
        isLoading={false}
      />
    );

    // Summary cards should show '—' or 'N/A' when there are no valid data points
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThan(0);
    expect(screen.queryByText('0% / Đỉnh 0%')).not.toBeInTheDocument();
  });

  test('7. Range selector buttons trigger onTimeRangeChange for 15m, 1h, 6h, 24h', () => {
    const handleRangeChange = jest.fn();
    render(
      <InteractiveResourceChart
        data={sampleData}
        timeRange="15m"
        onTimeRangeChange={handleRangeChange}
      />
    );

    const btn1h = screen.getByRole('button', { name: '1 giờ' });
    fireEvent.click(btn1h);
    expect(handleRangeChange).toHaveBeenCalledWith('1h');

    const btn6h = screen.getByRole('button', { name: '6 giờ' });
    fireEvent.click(btn6h);
    expect(handleRangeChange).toHaveBeenCalledWith('6h');

    const btn24h = screen.getByRole('button', { name: '24 giờ' });
    fireEvent.click(btn24h);
    expect(handleRangeChange).toHaveBeenCalledWith('24h');
  });

  test('8. Freshness Badge differentiates Live, Stale, and Offline states', () => {
    const { rerender } = render(
      <InteractiveResourceChart
        data={sampleData}
        isLive={true}
        isStale={false}
        isClusterOnline={true}
      />
    );
    expect(screen.getByText('TRỰC TIẾP (eBPF 5s)')).toBeInTheDocument();

    // Stale state
    rerender(
      <InteractiveResourceChart
        data={sampleData}
        isLive={true}
        isStale={true}
        isClusterOnline={true}
      />
    );
    expect(screen.getByText('DỮ LIỆU CŨ (Stale)')).toBeInTheDocument();

    // Offline state
    rerender(
      <InteractiveResourceChart
        data={sampleData}
        isLive={false}
        isStale={false}
        isClusterOnline={false}
      />
    );
    expect(screen.getByText('● Ngoại tuyến')).toBeInTheDocument();
  });

  test('9. Autonomous MAPE-K card reflects high load (>80%) vs optimal state', () => {
    const { rerender } = render(
      <InteractiveResourceChart
        data={sampleData}
      />
    );
    // Peak CPU is 75% <= 80%
    expect(screen.getByText('Mô hình GRU + Multi-Agent RCA: Giám sát')).toBeInTheDocument();

    // Spike CPU to 90%
    const highLoadData = [
      ...sampleData,
      {
        time: '14:15:00',
        fullTime: '14:15:00 (27/10/2026)',
        cpu: 92.0,
        ram: 85.0,
        rawRamMb: 6800,
        disk: 16.0,
        latency: 2.5,
      },
    ];

    rerender(
      <InteractiveResourceChart
        data={highLoadData}
      />
    );
    expect(screen.getByText('⚠️ Tự động kích hoạt Scale Replicas')).toBeInTheDocument();
  });
});
