import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import AuthContext from '../../context/AuthContext';
import { AdminSidebar } from '../../components/admin/AdminSidebar';
import { RouteRenderer } from '../../routes';
import { ToastProvider } from '../../context/ToastContext';

// Mock child pages that make remote network calls
jest.mock('./Overview', () => () => <div data-testid="mock-admin-overview">Admin Overview Page</div>);
jest.mock('./Users', () => ({ AdminUsersPage: () => <div data-testid="mock-admin-users">Admin Users Page</div> }));
jest.mock('./Incidents', () => ({
  IncidentsListPage: () => <div data-testid="mock-admin-incidents">Incidents List Page</div>,
  IncidentDetailPage: () => <div data-testid="mock-admin-incident-detail">Incident Detail Page</div>,
}));
jest.mock('./AI', () => ({ AdminAIPage: () => <div data-testid="mock-admin-ai">Admin AI Page</div> }));
jest.mock('../Dashboard', () => () => <div data-testid="mock-dashboard">Dashboard Page</div>);

const createAuthContextValue = (roles, overrides = {}) => {
  const normRoles = roles.map(r => r.toUpperCase());
  const isSuperAdmin = normRoles.includes('SUPER_ADMIN');
  const isAdmin = isSuperAdmin || normRoles.some(r => ['ADMIN', 'SYSTEM_ADMIN', 'SME_OWNER'].includes(r));
  const isDevOps = normRoles.includes('DEVOPS') && !isAdmin;
  const isViewer = !isAdmin && !isDevOps;

  const user = {
    id: 'test-user-id',
    email: 'test@selfheal.com',
    full_name: 'Test User',
    system_roles: roles,
    ...overrides,
  };

  return {
    user,
    token: 'mock-jwt-token',
    isAuthenticated: true,
    loading: false,
    getUserRoles: () => normRoles,
    isSuperAdmin: () => isSuperAdmin,
    isAdmin: () => isAdmin,
    isDevOps: () => isDevOps,
    isViewer: () => isViewer,
    getPrimaryRole: () => (isSuperAdmin ? 'SUPER ADMIN' : isAdmin ? 'ADMIN' : isDevOps ? 'DEVOPS' : 'VIEWER'),
    getInitials: (name) => 'TU',
    logout: jest.fn(),
  };
};

describe('Frontend RBAC Suite (Admin, DevOps, Viewer)', () => {
  describe('1. AdminSidebar Navigation Filtering', () => {
    test('1.1. Viewer sidebar ONLY renders Overview Dashboard and hides all other groups', () => {
      const authVal = createAuthContextValue(['VIEWER']);

      render(
        <AuthContext.Provider value={authVal}>
          <AdminSidebar currentPath="/admin" />
        </AuthContext.Provider>
      );

      // Must show Overview
      expect(screen.getByText('Bàn Điều Khiển')).toBeInTheDocument();

      // Must NOT show operational or administrative menus
      expect(screen.queryByText('Sức Khỏe Tác Tử eBPF')).not.toBeInTheDocument();
      expect(screen.queryByText('Cổng Phê Duyệt HITL')).not.toBeInTheDocument();
      expect(screen.queryByText('Sự Cố & Điều Tra RCA')).not.toBeInTheDocument();
      expect(screen.queryByText('Cụm Kubernetes')).not.toBeInTheDocument();
      expect(screen.queryByText('Dự Báo Dị Thường')).not.toBeInTheDocument();
      expect(screen.queryByText('Thành Viên & Ma Trận RBAC')).not.toBeInTheDocument();
    });

    test('1.2. DevOps sidebar renders Infrastructure & AI, but hides User Management / Members', () => {
      const authVal = createAuthContextValue(['DEVOPS']);

      render(
        <AuthContext.Provider value={authVal}>
          <AdminSidebar currentPath="/admin" />
        </AuthContext.Provider>
      );

      // Shows operational items
      expect(screen.getByText('Bàn Điều Khiển')).toBeInTheDocument();
      expect(screen.getByText('Cổng Phê Duyệt HITL')).toBeInTheDocument();
      expect(screen.getByText('Cụm Kubernetes')).toBeInTheDocument();
      expect(screen.getByText('Tổng Quan Động Cơ AI')).toBeInTheDocument();

      // Must NOT show User Management
      expect(screen.queryByText('Thành Viên & Ma Trận RBAC')).not.toBeInTheDocument();
    });

    test('1.3. Admin sidebar renders all groups including User Management', () => {
      const authVal = createAuthContextValue(['ADMIN']);

      render(
        <AuthContext.Provider value={authVal}>
          <AdminSidebar currentPath="/admin" />
        </AuthContext.Provider>
      );

      expect(screen.getByText('Bàn Điều Khiển')).toBeInTheDocument();
      expect(screen.getByText('Thành Viên & Ma Trận RBAC')).toBeInTheDocument();
      expect(screen.getByText('Cụm Kubernetes')).toBeInTheDocument();
      expect(screen.getByText('Tổng Quan Động Cơ AI')).toBeInTheDocument();
    });
  });

  describe('2. RouteRenderer Guard & 403 Forbidden Access Denied', () => {
    test('2.1. Viewer CAN access /admin overview page', () => {
      const authVal = createAuthContextValue(['VIEWER']);

      render(
        <ToastProvider>
          <AuthContext.Provider value={authVal}>
            <RouteRenderer currentPath="/admin" />
          </AuthContext.Provider>
        </ToastProvider>
      );

      expect(screen.getByTestId('mock-admin-overview')).toBeInTheDocument();
    });

    test('2.2. Viewer is BLOCKED from /admin/users with 403 Access Denied', () => {
      const authVal = createAuthContextValue(['VIEWER']);

      render(
        <ToastProvider>
          <AuthContext.Provider value={authVal}>
            <RouteRenderer currentPath="/admin/users" />
          </AuthContext.Provider>
        </ToastProvider>
      );

      expect(screen.queryByTestId('mock-admin-users')).not.toBeInTheDocument();
      expect(screen.getByText(/403 — Không Có Quyền Truy Cập/i)).toBeInTheDocument();
    });

    test('2.3. Viewer is BLOCKED from /admin/incidents with 403 Access Denied', () => {
      const authVal = createAuthContextValue(['VIEWER']);

      render(
        <ToastProvider>
          <AuthContext.Provider value={authVal}>
            <RouteRenderer currentPath="/admin/incidents" />
          </AuthContext.Provider>
        </ToastProvider>
      );

      expect(screen.queryByTestId('mock-admin-incidents')).not.toBeInTheDocument();
      expect(screen.getByText(/403 — Không Có Quyền Truy Cập/i)).toBeInTheDocument();
    });

    test('2.4. DevOps CAN access /admin/incidents', () => {
      const authVal = createAuthContextValue(['DEVOPS']);

      render(
        <ToastProvider>
          <AuthContext.Provider value={authVal}>
            <RouteRenderer currentPath="/admin/incidents" />
          </AuthContext.Provider>
        </ToastProvider>
      );

      expect(screen.getByTestId('mock-admin-incidents')).toBeInTheDocument();
    });

    test('2.5. DevOps is BLOCKED from /admin/users with 403 User Management Forbidden', () => {
      const authVal = createAuthContextValue(['DEVOPS']);

      render(
        <ToastProvider>
          <AuthContext.Provider value={authVal}>
            <RouteRenderer currentPath="/admin/users" />
          </AuthContext.Provider>
        </ToastProvider>
      );

      expect(screen.queryByTestId('mock-admin-users')).not.toBeInTheDocument();
      expect(screen.getByText(/403 — Không Có Quyền Quản Lý Người Dùng/i)).toBeInTheDocument();
    });

    test('2.6. Admin CAN access /admin/users', () => {
      const authVal = createAuthContextValue(['ADMIN']);

      render(
        <ToastProvider>
          <AuthContext.Provider value={authVal}>
            <RouteRenderer currentPath="/admin/users" />
          </AuthContext.Provider>
        </ToastProvider>
      );

      expect(screen.getByTestId('mock-admin-users')).toBeInTheDocument();
    });
  });
});
