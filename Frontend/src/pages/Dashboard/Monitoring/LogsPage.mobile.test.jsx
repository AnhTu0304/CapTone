import React from 'react';
import fs from 'fs';
import path from 'path';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { LogsPage } from './LogsPage';
import { telemetryService } from '../../../services/telemetryService';
import { clusterService } from '../../../services/clusterService';
import { deploymentService } from '../../../services/deploymentService';
import { podService } from '../../../services/podService';
import { aiService } from '../../../services/aiService';

jest.mock('../context/DashboardContext', () => ({
  useDashboard: () => ({
    currentOrg: { id: 'org-test-1', name: 'CMUTPM3' },
    currentEnv: { id: 'env-test-1', name: 'TPM3-Cluster', clusterId: 'cluster-tpm3' },
  }),
}));

jest.mock('../../../services/telemetryService', () => ({
  telemetryService: {
    getLogs: jest.fn(),
    getApmServices: jest.fn(),
    streamLogs: jest.fn(),
  },
}));

jest.mock('../../../services/aiService', () => ({
  aiService: {
    getWorkloads: jest.fn().mockResolvedValue([]),
  },
}));

jest.mock('../../../services/clusterService', () => ({
  clusterService: {
    getClusterNamespaces: jest.fn().mockResolvedValue(['default', 'kube-system']),
  },
}));

jest.mock('../../../services/deploymentService', () => ({
  deploymentService: {
    getDeploymentsByCluster: jest.fn().mockResolvedValue([{ id: 'dep-1', name: 'storage-provisioner' }]),
  },
}));

jest.mock('../../../services/podService', () => ({
  podService: {
    getPodsByCluster: jest.fn().mockResolvedValue([{ id: 'pod-1', name: 'storage-provisioner', workload_name: 'storage-provisioner' }]),
  },
}));

describe('LogsPage Mobile Responsive Layout & Log Table', () => {
  const sampleLogs = [
    {
      id: 'log-k8s-1',
      namespace: 'kube-system',
      service_name: 'storage-provisioner',
      pod_name: 'storage-provisioner',
      level: 'WARN',
      message: 'W1127 08:23:12.431728 1 leaderelection.go:255 failed to renew lease kube-system/k8s-minikube',
      occurred_at: '2026-11-27T08:23:12.431Z',
      metadata: { pod_id: 'storage-provisioner' },
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    aiService.getWorkloads.mockResolvedValue([]);
    telemetryService.getApmServices.mockResolvedValue([]);
    telemetryService.getLogs.mockResolvedValue({
      logs: sampleLogs,
      pagination: { total: 12269, page: 1, limit: 50, totalPages: 246 },
    });
  });

  test('renders dedicated mobile semantic containers and stacked meta/message blocks per log row', async () => {
    const { container } = render(<LogsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('log-row-log-k8s-1')).toBeInTheDocument();
    });

    expect(container.querySelector('.dashboard-logs-page')).toBeInTheDocument();
    expect(container.querySelector('.logs-kpi-grid')).toBeInTheDocument();
    expect(container.querySelector('.logs-action-bar')).toBeInTheDocument();
    expect(container.querySelector('.logs-resource-filters')).toBeInTheDocument();
    expect(container.querySelector('.logs-terminal-header')).toBeInTheDocument();
    expect(container.querySelector('.logs-container')).toBeInTheDocument();
    expect(container.querySelector('.logs-pagination-bar')).toBeInTheDocument();

    const filterPills = container.querySelectorAll('.logs-filter-pills');
    expect(filterPills.length).toBeGreaterThanOrEqual(2);

    const row = screen.getByTestId('log-row-log-k8s-1');
    expect(row).toHaveClass('logs-row');

    const meta = row.querySelector('.logs-row-meta');
    const msg = screen.getByTestId('log-msg-log-k8s-1');
    expect(meta).toBeInTheDocument();
    expect(meta).toHaveTextContent('WARN');
    expect(meta).toHaveTextContent('[kube-system/storage-provisioner/storage-provisioner]');
    expect(msg).toHaveClass('logs-row-msg');
    expect(meta.contains(msg)).toBe(false);
    expect(msg.style.wordBreak).not.toBe('break-all');
    expect(msg.style.overflowWrap).not.toBe('anywhere');

    // Tapping a row opens responsive modal with dash-modal-card
    fireEvent.click(row);
    expect(screen.getByTestId('log-detail-modal')).toHaveClass('dash-modal-card');
  });

  test('dashboard-tokens.css defines mobile rules preventing vertical 1-char wrapping and rigid select widths', () => {
    const cssPath = path.resolve(__dirname, '../../../styles/dashboard-tokens.css');
    const css = fs.readFileSync(cssPath, 'utf8');

    expect(css).toContain('.logs-row-meta');
    expect(css).toContain('.logs-row');
    expect(css).toContain('flex-direction: column');
    expect(css).toContain('.logs-row-msg');
    expect(css).toContain('.logs-resource-filters');
    expect(css).toContain('.logs-kpi-grid');
    expect(css).toContain('.device-mode-mobile .logs-row');
    expect(css).toContain('.device-mode-mobile .logs-resource-filters');
  });
});
