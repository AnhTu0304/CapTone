import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { DashboardLayout } from './DashboardLayout';
import AuthContext from '../context/AuthContext';
import { ToastProvider } from '../context/ToastContext';
import * as apiClient from '../services/apiClient';

jest.mock('../services/apiClient', () => ({
  request: jest.fn(),
  getAuthToken: jest.fn(),
  setActiveOrganizationId: jest.fn(),
  cancelPendingRequests: jest.fn(),
  resolveBackendWsHost: jest.fn(() => 'localhost:5005'),
}));

const makeAuth = (role = 'SME_OWNER') => ({
  user: {
    id: 'usr-1',
    email: 'owner@example.com',
    full_name: 'Owner Test',
    roles: [role],
    system_roles: [],
  },
  isAuthenticated: true,
  loading: false,
  isSuperAdmin: () => false,
  isAdmin: () => false,
  isOwner: () => role === 'SME_OWNER',
  isDevOps: () => role === 'DEVOPS',
  logout: jest.fn(),
  getInitials: () => 'OT',
  getPrimaryRole: () => role,
});

describe('DashboardLayout Responsive & Mobile Drawer Suite', () => {
  beforeEach(() => {
    apiClient.request.mockResolvedValue({ success: true, data: [] });
    apiClient.getAuthToken.mockReturnValue(null);
  });

  test('opens mobile drawer with full header + sidebar groups for SME_OWNER and closes on navigation or Escape', async () => {
    const onNavigate = jest.fn();
    render(
      <ToastProvider>
        <AuthContext.Provider value={makeAuth('SME_OWNER')}>
          <DashboardLayout currentPath="/dashboard" onNavigate={onNavigate}>
            <div>Dashboard Body</div>
          </DashboardLayout>
        </AuthContext.Provider>
      </ToastProvider>
    );

    const toggle = screen.getByLabelText('Mở menu điều hướng');
    fireEvent.click(toggle);

    const drawer = await screen.findByRole('dialog', { name: /menu điều hướng di động/i });
    expect(drawer).toBeInTheDocument();

    // Core sidebar links + header links (Hạ tầng, Tổ chức, Hệ thống) must both be accessible in mobile drawer
    expect(drawer).toHaveTextContent('Chỉ số tài nguyên');
    expect(drawer).toHaveTextContent('Tác tử Agent');
    expect(drawer).toHaveTextContent('Cụm K8s');
    expect(drawer).toHaveTextContent('Thông tin Tổ chức');
    expect(drawer).toHaveTextContent('Cài đặt hệ thống');

    // Escape closes drawer
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /menu điều hướng di động/i })).not.toBeInTheDocument();
    });

    // Re-open, click a mobile drawer item -> navigates & closes drawer
    fireEvent.click(toggle);
    const drawerReopened = await screen.findByRole('dialog', { name: /menu điều hướng di động/i });
    const clustersBtn = Array.from(drawerReopened.querySelectorAll('button')).find((b) =>
      b.textContent.includes('Cụm K8s')
    );
    expect(clustersBtn).toBeTruthy();
    fireEvent.click(clustersBtn);

    expect(onNavigate).toHaveBeenCalledWith('/dashboard/clusters');
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /menu điều hướng di động/i })).not.toBeInTheDocument();
    });
  });

  test('respects VIEWER RBAC in mobile drawer (hides Clusters, Organization, Policies, Settings)', async () => {
    render(
      <ToastProvider>
        <AuthContext.Provider value={makeAuth('VIEWER')}>
          <DashboardLayout currentPath="/dashboard" onNavigate={jest.fn()}>
            <div>Viewer Body</div>
          </DashboardLayout>
        </AuthContext.Provider>
      </ToastProvider>
    );

    fireEvent.click(screen.getByLabelText('Mở menu điều hướng'));
    const drawer = await screen.findByRole('dialog', { name: /menu điều hướng di động/i });

    expect(drawer).toHaveTextContent('Tác tử Agent');
    expect(drawer).not.toHaveTextContent('Cụm K8s');
    expect(drawer).not.toHaveTextContent('Thông tin Tổ chức');
    expect(drawer).not.toHaveTextContent('Chính sách tự động');
    expect(drawer).not.toHaveTextContent('Cài đặt hệ thống');
  });
});
