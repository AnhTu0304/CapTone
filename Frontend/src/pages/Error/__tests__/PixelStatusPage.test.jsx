import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import {
  UnauthorizedPage,
  NotFoundPage,
  ServerErrorPage,
  ServiceUnavailablePage,
  TooManyRequestsPage,
  AgentOfflinePage,
  ClusterLostPage,
  MonitoringStatusPage,
  MaintenancePage,
} from '../StatusPages';
import ForbiddenPage from '../ForbiddenPage';

describe('PixelStatusPage Scenic Horizon Layout (All 10 Status Pages, No Buttons)', () => {
  test.each([
    ['401', UnauthorizedPage, '401', /Phiên đăng nhập đã hết hạn/i, 'status-page-401'],
    ['403', ForbiddenPage, '403', /Không có quyền truy cập/i, 'forbidden-page'],
    ['404', NotFoundPage, '404', /Đây không phải trang bạn đang tìm kiếm/i, 'status-page-404'],
    ['500', ServerErrorPage, '500', /Máy chủ đang gặp trục trặc nội bộ/i, 'status-page-500'],
    ['503', ServiceUnavailablePage, '503', /Dịch vụ tạm thời gián đoạn/i, 'status-page-503'],
    ['429', TooManyRequestsPage, '429', /Quá nhiều yêu cầu cùng lúc/i, 'status-page-429'],
    ['Agent Offline', AgentOfflinePage, 'AGENT OFFLINE', /Đang cố gắng kết nối lại với Agent/i, 'status-page-agent-offline'],
    ['Cluster Lost', ClusterLostPage, 'CLUSTER LOST', /Mất đồng bộ kết nối tới các Node/i, 'status-page-cluster-lost'],
    ['Monitoring', MonitoringStatusPage, 'MONITORING', /Đang kiểm tra luồng telemetry trực tiếp/i, 'status-page-monitoring'],
    ['Maintenance', MaintenancePage, 'MAINTENANCE', /Hệ thống đang được bảo trì định kỳ/i, 'status-page-maintenance'],
  ])('renders %s scenic status page with big status label, speech bubble note, robot artwork, and zero buttons', (_name, Component, statusText, noteRegex, testId) => {
    render(<Component />);

    expect(screen.getByTestId(testId)).toBeInTheDocument();
    expect(screen.getByTestId(`${testId}-code`)).toHaveTextContent(statusText);
    expect(screen.getByTestId(`${testId}-note`)).toHaveTextContent(noteRegex);
    expect(screen.getByTestId(`${testId}-artwork`)).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
