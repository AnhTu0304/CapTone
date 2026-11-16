import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AdminAnalyticsPage } from './AdminAnalyticsPage';
import adminAnalyticsService from '../../../services/adminAnalyticsService';

jest.mock('../../../services/adminAnalyticsService');

const mockAnalyticsData = {
  kpi: {
    totalOrganizations: 21,
    newOrganizationsThisMonth: 3,
    orgGrowthRatePercent: '+14.3%',
    totalUsers: 34,
    activeUsers: 30,
    totalClusters: 27,
    totalNodes: 18,
    totalPods: 225,
    onlineAgents: 2,
    totalAgents: 28,
    agentAvailabilityRate: '7.1%',
    healingSuccessRate: '98.5%',
  },
  monthlyGrowth: [
    { month: 'T1', monthIndex: 1, monthName: 'Tháng 1', newOrgs: 0, cumulativeOrgs: 0, newUsers: 0, cumulativeUsers: 0 },
    { month: 'T2', monthIndex: 2, monthName: 'Tháng 2', newOrgs: 0, cumulativeOrgs: 0, newUsers: 0, cumulativeUsers: 0 },
    { month: 'T3', monthIndex: 3, monthName: 'Tháng 3', newOrgs: 0, cumulativeOrgs: 0, newUsers: 0, cumulativeUsers: 0 },
    { month: 'T4', monthIndex: 4, monthName: 'Tháng 4', newOrgs: 0, cumulativeOrgs: 0, newUsers: 0, cumulativeUsers: 0 },
    { month: 'T5', monthIndex: 5, monthName: 'Tháng 5', newOrgs: 0, cumulativeOrgs: 0, newUsers: 0, cumulativeUsers: 0 },
    { month: 'T6', monthIndex: 6, monthName: 'Tháng 6', newOrgs: 0, cumulativeOrgs: 0, newUsers: 0, cumulativeUsers: 0 },
    { month: 'T7', monthIndex: 7, monthName: 'Tháng 7', newOrgs: 0, cumulativeOrgs: 0, newUsers: 0, cumulativeUsers: 0 },
    { month: 'T8', monthIndex: 8, monthName: 'Tháng 8', newOrgs: 0, cumulativeOrgs: 0, newUsers: 0, cumulativeUsers: 0 },
    { month: 'T9', monthIndex: 9, monthName: 'Tháng 9', newOrgs: 0, cumulativeOrgs: 0, newUsers: 0, cumulativeUsers: 0 },
    { month: 'T10', monthIndex: 10, monthName: 'Tháng 10', newOrgs: 18, cumulativeOrgs: 18, newUsers: 23, cumulativeUsers: 23 },
    { month: 'T11', monthIndex: 11, monthName: 'Tháng 11', newOrgs: 3, cumulativeOrgs: 21, newUsers: 11, cumulativeUsers: 34 },
    { month: 'T12', monthIndex: 12, monthName: 'Tháng 12', newOrgs: 0, cumulativeOrgs: 21, newUsers: 0, cumulativeUsers: 34 },
  ],
  environmentBreakdown: {
    production: { count: 3, percentage: '17%' },
    staging: { count: 12, percentage: '67%' },
    development: { count: 3, percentage: '17%' },
  },
  statusBreakdown: {
    active: { count: 18, percentage: '86%' },
    suspended: { count: 3, percentage: '14%' },
  },
  organizations: {
    items: [
      {
        id: '7b000000-0000-0000-0000-000000000001',
        name: 'Audit Org A',
        status: 'SUSPENDED',
        createdAt: '12:21:05 10/11/2026',
        joinedMonth: 'T11/2026',
        membersCount: 3,
        clustersCount: 1,
        nodesCount: 1,
        podsCount: 1,
        onlineAgents: 0,
        totalAgents: 0,
        environment: 'Development',
      },
      {
        id: '00000000-0000-0000-0000-000000000001',
        name: 'SME Retail Enterprise',
        status: 'ACTIVE',
        createdAt: '10:00:00 01/10/2026',
        joinedMonth: 'T10/2026',
        membersCount: 8,
        clustersCount: 11,
        nodesCount: 9,
        podsCount: 112,
        onlineAgents: 2,
        totalAgents: 2,
        environment: 'Production',
      },
    ],
    pagination: {
      total: 21,
      page: 1,
      limit: 10,
      totalPages: 3,
    },
  },
};

describe('AdminAnalyticsPage Real API Suite', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    adminAnalyticsService.getGrowthAnalytics.mockResolvedValue(mockAnalyticsData);
    adminAnalyticsService.downloadGrowthCsv.mockResolvedValue();
  });

  test('1. Loads and renders real KPI statistics from backend API', async () => {
    render(<AdminAnalyticsPage onNavigate={jest.fn()} />);

    await waitFor(() => {
      expect(screen.getAllByText('21').length).toBeGreaterThan(0);
      expect(screen.getByText('30')).toBeInTheDocument();
      expect(screen.getByText('27')).toBeInTheDocument();
      expect(screen.getAllByText('98.5%').length).toBeGreaterThan(0);
    });

    expect(screen.getByText(/Tổng Doanh Nghiệp Khách Hàng/i)).toBeInTheDocument();
    expect(screen.getByText(/Cụm K8s Đang Quản Lý/i)).toBeInTheDocument();
  });

  test('2. Renders real monthly growth charts (organizations and new users) and environment breakdown', async () => {
    render(<AdminAnalyticsPage onNavigate={jest.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('+18')).toBeInTheDocument();
      expect(screen.getByText('+3')).toBeInTheDocument();
      expect(screen.getByText('+23')).toBeInTheDocument();
      expect(screen.getByText('+11')).toBeInTheDocument();
    });

    expect(screen.getByText(/Biểu Đồ Doanh Nghiệp Mới Gia Nhập/i)).toBeInTheDocument();
    expect(screen.getByText(/Biểu Đồ Người Dùng Mới Đăng Ký/i)).toBeInTheDocument();
    expect(screen.getByText(/Môi trường Production/i)).toBeInTheDocument();
    expect(screen.getByText('12 cụm (67%)')).toBeInTheDocument();
  });

  test('3. Calls downloadGrowthCsv when clicking Export CSV button', async () => {
    render(<AdminAnalyticsPage onNavigate={jest.fn()} />);

    const exportBtn = screen.getByRole('button', { name: /Xuất Báo Cáo CSV/i });
    await waitFor(() => {
      expect(exportBtn).not.toBeDisabled();
    });

    fireEvent.click(exportBtn);

    await waitFor(() => {
      expect(adminAnalyticsService.downloadGrowthCsv).toHaveBeenCalledWith(
        expect.objectContaining({
          year: 2026,
          month: 'ALL',
        })
      );
    });
  });

  test('4. Allows switching chart view modes', async () => {
    render(<AdminAnalyticsPage onNavigate={jest.fn()} />);

    await waitFor(() => {
      expect(screen.getByText(/Biểu Đồ Phân Tích Tăng Trưởng/i)).toBeInTheDocument();
    });

    // Toggle chart mode button to "Người Dùng Mới"
    const userChartBtn = screen.getByRole('button', { name: /Người Dùng Mới/i });
    fireEvent.click(userChartBtn);

    expect(screen.getByText(/Biểu Đồ Người Dùng Mới Đăng Ký/i)).toBeInTheDocument();
  });
});
