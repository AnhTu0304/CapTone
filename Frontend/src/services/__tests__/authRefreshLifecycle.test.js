import React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import {
  request,
  setAuthToken,
  getAuthToken,
  clearAuthToken,
} from '../apiClient';
import { AuthProvider, useAuth } from '../../context/AuthContext';

describe('Sprint C Phase 2 — Frontend Refresh Token & Logout Lifecycle (Test #18)', () => {
  const originalFetch = global.fetch;

  const setCookie = (name, value) => {
    document.cookie = `${name}=${encodeURIComponent(value)}; path=/`;
  };

  const clearCookie = (name) => {
    document.cookie = `${name}=; Max-Age=0; path=/`;
  };

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    clearAuthToken();
    clearCookie('selfheal_csrf_token');
    global.fetch = jest.fn();
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  test('18a. Concurrent 401 responses coalesce into a single POST /auth/refresh with credentials & CSRF header, then retry once', async () => {
    setAuthToken('expired-access-token');
    setCookie('selfheal_csrf_token', 'csrf-abc-123');

    let refreshCount = 0;
    global.fetch.mockImplementation(async (url, opts = {}) => {
      if (String(url).includes('/auth/refresh')) {
        refreshCount += 1;
        expect(opts.method).toBe('POST');
        expect(opts.credentials).toBe('include');
        expect(opts.headers['X-CSRF-Token']).toBe('csrf-abc-123');
        // Small async delay so both concurrent requests await the same in-flight promise
        await new Promise((r) => setTimeout(r, 15));
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: { token: 'fresh-access-token-2' },
          }),
        };
      }

      if (opts.headers?.Authorization === 'Bearer expired-access-token') {
        return {
          ok: false,
          status: 401,
          statusText: 'Unauthorized',
          json: async () => ({ message: 'Token expired' }),
        };
      }

      if (opts.headers?.Authorization === 'Bearer fresh-access-token-2') {
        expect(opts.credentials).toBe('include');
        return {
          ok: true,
          status: 200,
          json: async () => ({ success: true, data: { endpoint: url } }),
        };
      }

      throw new Error(`Unexpected fetch call: ${url}`);
    });

    const [resA, resB] = await Promise.all([
      request('/clusters'),
      request('/incidents'),
    ]);

    expect(refreshCount).toBe(1);
    expect(resA.success).toBe(true);
    expect(resB.success).toBe(true);
    expect(getAuthToken()).toBe('fresh-access-token-2');
    // Refresh token and access token must NOT be persisted in localStorage/sessionStorage
    expect(localStorage.getItem('selfheal_auth_token')).toBeNull();
    expect(localStorage.getItem('refresh_token')).toBeNull();
    expect(sessionStorage.getItem('refresh_token')).toBeNull();
  });

  test('18b. Failed refresh on 401 clears auth state, clears legacy storage keys, and fires same-tab revocation event', async () => {
    setAuthToken('expired-access-token');
    localStorage.setItem('selfheal_auth_token', 'legacy-token');
    localStorage.setItem('admin_access_token', 'legacy-admin');
    localStorage.setItem('token', 'legacy-generic');
    sessionStorage.setItem('admin_access_token', 'legacy-session');
    setCookie('selfheal_csrf_token', 'csrf-revoked');

    const onRevoked = jest.fn();
    window.addEventListener('selfheal:session-revoked', onRevoked);

    global.fetch.mockImplementation(async (url) => {
      if (String(url).includes('/auth/refresh')) {
        return {
          ok: false,
          status: 401,
          statusText: 'Unauthorized',
          json: async () => ({ message: 'Session revoked' }),
        };
      }
      return {
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({ message: 'Unauthorized' }),
      };
    });

    try {
      await expect(request('/clusters')).rejects.toThrow();
      expect(getAuthToken()).toBeNull();
      expect(localStorage.getItem('selfheal_auth_token')).toBeNull();
      expect(localStorage.getItem('admin_access_token')).toBeNull();
      expect(localStorage.getItem('token')).toBeNull();
      expect(sessionStorage.getItem('admin_access_token')).toBeNull();
      expect(onRevoked).toHaveBeenCalledTimes(1);
    } finally {
      window.removeEventListener('selfheal:session-revoked', onRevoked);
    }
  });

  test('18c. AuthProvider login keeps access token in-memory only, and logout invokes POST /auth/logout with CSRF & clears state', async () => {
    let authRef = null;
    const Probe = () => {
      authRef = useAuth();
      return (
        <div>
          <span data-testid="auth-state">{authRef.isAuthenticated ? 'AUTH' : 'GUEST'}</span>
          <span data-testid="auth-email">{authRef.user?.email || 'none'}</span>
        </div>
      );
    };

    const calls = [];
    global.fetch.mockImplementation(async (url, opts = {}) => {
      calls.push({ url: String(url), opts });
      if (String(url).includes('/auth/login')) {
        // Simulate server setting non-HttpOnly CSRF cookie alongside HttpOnly refresh cookie
        setCookie('selfheal_csrf_token', 'csrf-live-session');
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: {
              id: 'u-1',
              email: 'tester@acme.local',
              full_name: 'Phase 2 Tester',
              token: 'short-lived-jwt-15m',
              system_roles: ['USER'],
            },
          }),
        };
      }
      if (String(url).includes('/users/profile')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: {
              id: 'u-1',
              email: 'tester@acme.local',
              full_name: 'Phase 2 Tester',
              system_roles: ['USER'],
            },
          }),
        };
      }
      if (String(url).includes('/auth/logout')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ success: true, message: 'Logged out' }),
        };
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByTestId('auth-state')).toHaveTextContent('GUEST'));

    await act(async () => {
      await authRef.login({ email: 'tester@acme.local', password: 'Password!123' });
    });

    expect(screen.getByTestId('auth-state')).toHaveTextContent('AUTH');
    expect(getAuthToken()).toBe('short-lived-jwt-15m');
    // Tokens MUST NOT be written to localStorage or sessionStorage
    expect(localStorage.getItem('selfheal_auth_token')).toBeNull();
    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('refresh_token')).toBeNull();

    const loginCall = calls.find((c) => c.url.includes('/auth/login'));
    expect(loginCall.opts.credentials).toBe('include');

    await act(async () => {
      await authRef.logout();
    });

    const logoutCall = calls.find((c) => c.url.includes('/auth/logout'));
    expect(logoutCall).toBeDefined();
    expect(logoutCall.opts.method).toBe('POST');
    expect(logoutCall.opts.credentials).toBe('include');
    expect(logoutCall.opts.headers['X-CSRF-Token']).toBe('csrf-live-session');
    expect(screen.getByTestId('auth-state')).toHaveTextContent('GUEST');
    expect(getAuthToken()).toBeNull();
  });

  test('18d. AuthProvider restores session on page reload via silent POST /auth/refresh when CSRF cookie is present', async () => {
    setCookie('selfheal_csrf_token', 'csrf-reload-token');

    global.fetch.mockImplementation(async (url, opts = {}) => {
      if (String(url).includes('/auth/refresh')) {
        expect(opts.credentials).toBe('include');
        expect(opts.headers['X-CSRF-Token']).toBe('csrf-reload-token');
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: { token: 'rehydrated-access-token' },
          }),
        };
      }
      if (String(url).includes('/users/profile')) {
        expect(opts.headers.Authorization).toBe('Bearer rehydrated-access-token');
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: {
              id: 'u-1',
              email: 'reloaded@acme.local',
              full_name: 'Reloaded User',
              system_roles: ['USER'],
            },
          }),
        };
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });

    const Probe = () => {
      const { isAuthenticated, user, loading } = useAuth();
      if (loading) return <div data-testid="loading">loading</div>;
      return (
        <div>
          <span data-testid="state">{isAuthenticated ? 'AUTH' : 'GUEST'}</span>
          <span data-testid="email">{user?.email || ''}</span>
        </div>
      );
    };

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('AUTH'));
    expect(screen.getByTestId('email')).toHaveTextContent('reloaded@acme.local');
    expect(getAuthToken()).toBe('rehydrated-access-token');
    expect(localStorage.getItem('selfheal_auth_token')).toBeNull();
  });
});
