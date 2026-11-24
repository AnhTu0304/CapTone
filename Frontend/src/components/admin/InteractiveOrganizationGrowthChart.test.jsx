import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { createChart, AreaSeries, LineSeries } from 'lightweight-charts';
import InteractiveOrganizationGrowthChart from './InteractiveOrganizationGrowthChart';

describe('InteractiveOrganizationGrowthChart (lightweight-charts v5)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const sampleKpi = {
    companies: { total: 2, active: 2 },
    users: { total: 5, active: 5 },
    agents: { total: 6, online: 2 },
    clusters: { total: 3, healthy: 0 },
  };

  test('initializes lightweight-charts once with 4 series and KPI priceLine', () => {
    const { unmount } = render(<InteractiveOrganizationGrowthChart kpiData={sampleKpi} />);

    expect(screen.getByTestId('growth-lightweight-chart')).toBeInTheDocument();
    expect(createChart).toHaveBeenCalledTimes(1);

    const chartInstance = createChart.mock.results[0].value;
    expect(chartInstance.addSeries).toHaveBeenCalledTimes(4);
    expect(chartInstance.addSeries).toHaveBeenNthCalledWith(1, AreaSeries, expect.any(Object));
    expect(chartInstance.addSeries).toHaveBeenNthCalledWith(2, LineSeries, expect.any(Object));
    expect(chartInstance.addSeries).toHaveBeenNthCalledWith(3, LineSeries, expect.any(Object));
    expect(chartInstance.addSeries).toHaveBeenNthCalledWith(4, LineSeries, expect.any(Object));

    const companiesSeries = chartInstance.addSeries.mock.results[0].value;
    expect(companiesSeries.setData).toHaveBeenCalled();
    const initialPoints = companiesSeries.setData.mock.calls[0][0];
    expect(initialPoints).toHaveLength(12);
    // Verify strictly ascending unique YYYY-MM-DD times
    for (let i = 1; i < initialPoints.length; i += 1) {
      expect(initialPoints[i].time > initialPoints[i - 1].time).toBe(true);
    }
    expect(companiesSeries.createPriceLine).toHaveBeenCalledTimes(1);

    unmount();
    expect(chartInstance.remove).toHaveBeenCalledTimes(1);
  });

  test('switches timeMode, scaleMode, and toggles series visibility cleanly', () => {
    render(<InteractiveOrganizationGrowthChart kpiData={sampleKpi} />);

    const chartInstance = createChart.mock.results[0].value;
    const companiesSeries = chartInstance.addSeries.mock.results[0].value;
    const usersSeries = chartInstance.addSeries.mock.results[1].value;

    // Switch to 'Theo Năm'
    fireEvent.click(screen.getByRole('button', { name: 'Theo Năm' }));
    const yearPoints = companiesSeries.setData.mock.calls.at(-1)[0];
    expect(yearPoints).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ time: '2023-01-01' }),
        expect.objectContaining({ time: '2026-01-01' }),
      ])
    );

    // Switch scale mode to 'Số Tuyệt Đối'
    fireEvent.click(screen.getByRole('button', { name: /Thang % Tăng Trưởng/i }));
    expect(screen.getByRole('button', { name: /Số Tuyệt Đối/i })).toBeInTheDocument();

    // Toggle 'Người Dùng' series off
    fireEvent.click(screen.getByRole('button', { name: /Người Dùng/i }));
    expect(usersSeries.applyOptions).toHaveBeenCalledWith({ visible: false });
  });
});
