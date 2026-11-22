import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import RouteRenderer from '../routes';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { executeWithFallback } from '../services/apiClient';
import { exportToCsv } from '../utils/exportUtils';

jest.mock('../pages/Dashboard', () => () => <div data-testid="mock-dashboard">Dashboard</div>);
jest.mock('../pages/Personal', () => () => <div data-testid="mock-portal">Portal</div>);
jest.mock('../pages/Login', () => () => <div data-testid="mock-login">Login Page</div>);
jest.mock('../layouts/AuthLayout', () => ({ children }) => <div data-testid="auth-layout">{children}</div>);
jest.mock('../layouts/PublicLayout', () => ({ children }) => <div data-testid="public-layout">{children}</div>);
jest.mock('../layouts/AdminLayout', () => ({ children }) => <div data-testid="admin-layout">{children}</div>);

describe('Sprint B SB-05 Frontend Security Tests', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  test('SB05-F01: Unauthenticated user accessing /dashboard, /portal, or /admin renders LoginPage', () => {
    localStorage.setItem('selfheal_mock_profile_v1', JSON.stringify({ systemRole: 'SUPER_ADMIN' }));
    render(
      <AuthProvider>
        <RouteRenderer currentPath="/dashboard" onNavigate={jest.fn()} />
      </AuthProvider>
    );
    expect(screen.getByTestId('mock-login')).toBeInTheDocument();
    expect(screen.queryByTestId('mock-dashboard')).not.toBeInTheDocument();
  });

  test('SB05-F02: localStorage mock profile cannot elevate baseRole to SUPER_ADMIN', () => {
    localStorage.setItem('selfheal_mock_profile_v1', JSON.stringify({ systemRole: 'SUPER_ADMIN', organizationRole: 'SME_OWNER' }));
    let capturedRole = null;
    const Probe = () => {
      const { baseRole } = useAuth();
      capturedRole = baseRole;
      return <div data-testid="role">{baseRole}</div>;
    };
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
    expect(capturedRole).toBe('USER');
  });

  test('SB05-F03: executeWithFallback rethrows 401 and 403 errors instead of falling back to mock data', async () => {
    const err401 = Object.assign(new Error('Unauthorized'), { status: 401 });
    await expect(
      executeWithFallback(() => Promise.reject(err401), () => ({ mock: true }))
    ).rejects.toThrow('Unauthorized');

    const err403 = Object.assign(new Error('Forbidden'), { status: 403 });
    await expect(
      executeWithFallback(() => Promise.reject(err403), () => ({ mock: true }))
    ).rejects.toThrow('Forbidden');
  });

  test('SB05-F04: exportToCsv neutralizes CSV formula injection (=, +, -, @)', () => {
    let capturedContent = '';
    const OrigBlob = global.Blob;
    global.Blob = jest.fn((parts) => {
      capturedContent = parts.join('');
      return {};
    });
    URL.createObjectURL = jest.fn(() => 'blob:test');
    URL.revokeObjectURL = jest.fn();

    exportToCsv('audit', ['ColA', 'ColB'], [['=CMD("calc")', '+1+1'], ['-2+3', '@SUM(A1)']]);
    expect(capturedContent).toContain(`"'=CMD(""calc"")"`);
    expect(capturedContent).toContain(`"'+1+1"`);
    expect(capturedContent).toContain(`"'-2+3"`);
    expect(capturedContent).toContain(`"'@SUM(A1)"`);
    global.Blob = OrigBlob;
  });
});
