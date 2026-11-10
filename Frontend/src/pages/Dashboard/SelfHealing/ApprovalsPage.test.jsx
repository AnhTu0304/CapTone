import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ApprovalsPage } from './ApprovalsPage';
import { selfHealingService } from '../../../services/selfHealingService';
import telemetryService from '../../../services/telemetryService';

const mockUseDashboardValue = {
  currentOrg: { id: 'org-1', name: 'Test Org' },
  currentEnv: { id: 'cluster-1', cluster: 'fyuyu', clusterId: 'cluster-1', clusterName: 'fyuyu' },
  setCurrentEnv: jest.fn(),
  envList: [
    { id: 'cluster-1', name: 'fyuyu', cluster: 'fyuyu' },
    { id: 'cluster-2', name: 'test-ai', cluster: 'test-ai' },
  ],
  isRefreshing: false,
  triggerRefresh: jest.fn(),
  selectedCluster: { id: 'cluster-1', name: 'fyuyu' },
};

jest.mock('../context/DashboardContext', () => ({
  useDashboard: () => mockUseDashboardValue,
}));

const mockToast = {
  success: jest.fn(),
  warning: jest.fn(),
};

jest.mock('../../../context/ToastContext', () => ({
  useToast: () => mockToast,
}));

jest.mock('../../../hooks/usePermissions', () => ({
  PERMISSIONS: { HITL_APPROVE: 'HITL_APPROVE' },
  usePermissions: () => ({
    can: () => true,
  }),
}));

jest.mock('../../../services/selfHealingService', () => ({
  selfHealingService: {
    getApprovals: jest.fn(),
    approveAction: jest.fn(),
    rejectAction: jest.fn(),
    resendNotification: jest.fn(),
  },
}));

jest.mock('../../../services/telemetryService', () => ({
  __esModule: true,
  default: {
    subscribeWebSocket: jest.fn(),
  },
}));

jest.mock('../Incidents/RootCauseModal', () => () => null);

describe('ApprovalsPage Cluster Filter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    selfHealingService.getApprovals.mockResolvedValue({ items: [], total: 0 });
    telemetryService.subscribeWebSocket.mockImplementation(() => jest.fn());
  });

  it('displays "Tất cả các cụm" without "(Toàn tổ chức)" in the cluster filter select', async () => {
    render(<ApprovalsPage />);

    const select = screen.getByTitle('Lọc yêu cầu phê duyệt theo Cụm Kubernetes');
    expect(select).toBeInTheDocument();

    expect(screen.getByRole('option', { name: 'Tất cả các cụm' })).toBeInTheDocument();
    expect(screen.queryByText(/Toàn tổ chức/i)).not.toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Cụm đang xem: fyuyu' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Cụm: test-ai' })).toBeInTheDocument();

    await waitFor(() => {
      expect(selfHealingService.getApprovals).toHaveBeenCalledWith(
        expect.objectContaining({
          organization_id: 'org-1',
          cluster_id: 'all',
          status: 'PENDING',
        })
      );
    });
  });

  it('updates getApprovals query when selecting a specific cluster filter', async () => {
    render(<ApprovalsPage />);

    const select = screen.getByTitle('Lọc yêu cầu phê duyệt theo Cụm Kubernetes');
    fireEvent.change(select, { target: { value: 'cluster-2' } });

    await waitFor(() => {
      expect(selfHealingService.getApprovals).toHaveBeenCalledWith(
        expect.objectContaining({
          organization_id: 'org-1',
          cluster_id: 'cluster-2',
        })
      );
    });
  });
});
