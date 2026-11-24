import React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import AuthContext from '../../../context/AuthContext';
import { ToastProvider } from '../../../context/ToastContext';
import RouteRenderer, { ROUTES } from '../../../routes';
import { request } from '../../../services/apiClient';
import App from '../../../App';

jest.mock('../../Home', () => () => <div data-testid="mock-home-page">Home Page</div>);
jest.mock('../../Login', () => () => <div data-testid="mock-login-page">Login Page</div>);
jest.mock('../../Dashboard/Overview', () => () => <div data-testid="mock-dashboard-overview">Dashboard Overview</div>);
jest.mock('../../Dashboard/Alerts/AlertsPage', () => () => <div data-testid="mock-dashboard-alerts">Dashboard Alerts</div>);
jest.mock('../../Personal/PersonalDashboardPage', () => () => <div data-testid="mock-portal-dashboard">Personal Dashboard</div>);
jest.mock('../../Onboarding', () => ({ currentPath }) => (
  <div data-testid="mock-onboarding-page">Onboarding: {currentPath}</div>
));
jest.mock('../../Admin/Overview', () => () => <div data-testid="mock-admin-overview">Admin Overview</div>);
jest.mock('../../../layouts/PublicLayout', () => ({ children, currentPath }) => (
  <div data-testid="mock-public-layout" data-path={currentPath}>
    {children}
  </div>
));
jest.mock('../../../layouts/DashboardLayout', () => ({ children, currentPath }) => (
  <div data-testid="mock-dashboard-layout" data-path={currentPath}>
    {children}
  </div>
));
jest.mock('../../../layouts/PersonalPortalLayout', () => ({ children, currentPath }) => (
  <div data-testid="mock-portal-layout" data-path={currentPath}>
    {children}
  </div>
));
jest.mock('../../../layouts/AdminLayout', () => ({ children, currentPath }) => (
  <div data-testid="mock-admin-layout" data-path={currentPath}>
    {children}
  </div>
));

const makeAuthValue = (roles = ['SME_OWNER']) => {
  const norm = roles.map((r) => r.toUpperCase());
  const isSuperAdmin = norm.includes('SUPER_ADMIN');
  const isAdmin = isSuperAdmin || norm.includes('ADMIN') || norm.includes('SYSTEM_ADMIN');
  const isOwner = norm.includes('SME_OWNER');
  const isDevOps = norm.includes('DEVOPS');
  const isViewer = norm.includes('VIEWER');

  return {
    user: { id: 'u-1', email: 'owner@selfheal.io', full_name: 'Owner Test', system_roles: norm },
    token: 'test-token',
    isAuthenticated: true,
    loading: false,
    activeRole: norm[0] || 'USER',
    baseRole: norm[0] || 'USER',
    getUserRoles: () => norm,
    isSuperAdmin: () => isSuperAdmin,
    isAdmin: () => isAdmin,
    isOwner: () => isOwner,
    isDevOps: () => isDevOps,
    isViewer: () => isViewer,
  };
};

describe('Error Routing (404, 403, 503) & Missing Route Warning Alert', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    jest.restoreAllMocks();
    window.history.pushState({}, '', '/');
  });

  test('ROUTES exposes explicit status page constants for 403, 404, 503', () => {
    expect(ROUTES.FORBIDDEN).toBe('/403');
    expect(ROUTES.NOT_FOUND).toBe('/404');
    expect(ROUTES.SERVICE_UNAVAILABLE).toBe('/503');
  });

  test('Public non-existent route renders NotFoundPage (404) instead of HomePage and shows toast warning', () => {
    render(
      <ToastProvider>
        <AuthContext.Provider value={makeAuthValue(['USER'])}>
          <RouteRenderer currentPath="/khong-ton-tai-xyz" onNavigate={jest.fn()} />
        </AuthContext.Provider>
      </ToastProvider>
    );

    expect(screen.queryByTestId('mock-home-page')).not.toBeInTheDocument();
    expect(screen.getByTestId('status-page-404')).toBeInTheDocument();
    expect(screen.getByTestId('status-page-404-code')).toHaveTextContent('404');
    expect(screen.getByText(/Cảnh báo chuyển trang/i)).toBeInTheDocument();
    expect(screen.getAllByText(/\/khong-ton-tai-xyz/i).length).toBeGreaterThan(0);
  });

  test('Dashboard non-existent routes render NotFoundPage inside DashboardLayout with warning, while /dashboard/alerts still works', () => {
    const authVal = makeAuthValue(['SME_OWNER']);

    const { rerender } = render(
      <ToastProvider>
        <AuthContext.Provider value={authVal}>
          <RouteRenderer currentPath="/dashboard/khong-ton-tai" onNavigate={jest.fn()} />
        </AuthContext.Provider>
      </ToastProvider>
    );

    expect(screen.getByTestId('mock-dashboard-layout')).toBeInTheDocument();
    expect(screen.queryByTestId('mock-dashboard-overview')).not.toBeInTheDocument();
    expect(screen.getByTestId('status-page-404')).toBeInTheDocument();
    expect(screen.getByText(/Cảnh báo chuyển trang/i)).toBeInTheDocument();

    rerender(
      <ToastProvider>
        <AuthContext.Provider value={authVal}>
          <RouteRenderer currentPath="/dashboard/self-healing/sai-duong-dan" onNavigate={jest.fn()} />
        </AuthContext.Provider>
      </ToastProvider>
    );
    expect(screen.getByTestId('status-page-404')).toBeInTheDocument();

    rerender(
      <ToastProvider>
        <AuthContext.Provider value={authVal}>
          <RouteRenderer currentPath="/dashboard/alerts" onNavigate={jest.fn()} />
        </AuthContext.Provider>
      </ToastProvider>
    );
    expect(screen.getByTestId('mock-dashboard-alerts')).toBeInTheDocument();
  });

  test('Portal non-existent route renders NotFoundPage inside PersonalPortalLayout with warning', () => {
    render(
      <ToastProvider>
        <AuthContext.Provider value={makeAuthValue(['USER'])}>
          <RouteRenderer currentPath="/portal/trang-ao" onNavigate={jest.fn()} />
        </AuthContext.Provider>
      </ToastProvider>
    );

    expect(screen.getByTestId('mock-portal-layout')).toBeInTheDocument();
    expect(screen.queryByTestId('mock-portal-dashboard')).not.toBeInTheDocument();
    expect(screen.getByTestId('status-page-404')).toBeInTheDocument();
    expect(screen.getByText(/Cảnh báo chuyển trang/i)).toBeInTheDocument();
  });

  test('Admin non-existent route renders Error NotFoundPage inside AdminLayout with warning', () => {
    render(
      <ToastProvider>
        <AuthContext.Provider value={makeAuthValue(['SUPER_ADMIN'])}>
          <RouteRenderer currentPath="/admin/trang-khong-ton-tai" onNavigate={jest.fn()} />
        </AuthContext.Provider>
      </ToastProvider>
    );

    expect(screen.getByTestId('mock-admin-layout')).toBeInTheDocument();
    expect(screen.getByTestId('status-page-404')).toBeInTheDocument();
    expect(screen.getByText(/Cảnh báo chuyển trang/i)).toBeInTheDocument();
  });

  test('Onboarding non-existent route renders NotFoundPage with warning', () => {
    render(
      <ToastProvider>
        <AuthContext.Provider value={makeAuthValue(['USER'])}>
          <RouteRenderer currentPath="/onboarding/unknown-step" onNavigate={jest.fn()} />
        </AuthContext.Provider>
      </ToastProvider>
    );

    expect(screen.queryByTestId('mock-onboarding-page')).not.toBeInTheDocument();
    expect(screen.getByTestId('status-page-404')).toBeInTheDocument();
    expect(screen.getByText(/Cảnh báo chuyển trang/i)).toBeInTheDocument();
  });

  test('RBAC 403 guards in both /admin and /dashboard use Scenic ForbiddenPage (403) while preserving 403 title contract', () => {
    const { rerender } = render(
      <ToastProvider>
        <AuthContext.Provider value={makeAuthValue(['VIEWER'])}>
          <RouteRenderer currentPath="/admin/users" onNavigate={jest.fn()} />
        </AuthContext.Provider>
      </ToastProvider>
    );

    expect(screen.getByTestId('mock-admin-layout')).toBeInTheDocument();
    expect(screen.getByTestId('forbidden-page')).toBeInTheDocument();
    expect(screen.getByTestId('forbidden-page-code')).toHaveTextContent('403');
    expect(screen.getByText(/403 — Không Có Quyền/i)).toBeInTheDocument();

    rerender(
      <ToastProvider>
        <AuthContext.Provider value={makeAuthValue(['DEVOPS'])}>
          <RouteRenderer currentPath="/dashboard/organization" onNavigate={jest.fn()} />
        </AuthContext.Provider>
      </ToastProvider>
    );

    expect(screen.getByTestId('forbidden-page')).toBeInTheDocument();
    expect(screen.getByText(/403 — Không Có Quyền Truy Cập/i)).toBeInTheDocument();
  });

  test('Direct /404 route renders NotFoundPage cleanly without missing-route warning toast', () => {
    render(
      <ToastProvider>
        <AuthContext.Provider value={makeAuthValue(['USER'])}>
          <RouteRenderer currentPath={ROUTES.NOT_FOUND} onNavigate={jest.fn()} />
        </AuthContext.Provider>
      </ToastProvider>
    );

    expect(screen.getByTestId('status-page-404')).toBeInTheDocument();
    expect(screen.queryByText(/Cảnh báo chuyển trang/i)).not.toBeInTheDocument();
  });

  test('Direct /503 route renders ServiceUnavailablePage (503) and HTTP 503 response switches App to 503 alert view', async () => {
    const mockFetch = jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
      json: async () => ({ message: 'Máy chủ đang bảo trì' }),
    });

    render(<App />);

    await act(async () => {
      await expect(request('/health')).rejects.toThrow('Máy chủ đang bảo trì');
    });
    expect(mockFetch).toHaveBeenCalled();

    await waitFor(() => {
      expect(screen.getByTestId('status-page-503')).toBeInTheDocument();
    });
    expect(screen.getByTestId('status-page-503-code')).toHaveTextContent('503');
    expect(screen.getByText(/Cảnh báo dịch vụ — 503/i)).toBeInTheDocument();
    expect(window.location.pathname).toBe('/503');
  });
});
