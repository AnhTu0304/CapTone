/**
 * @file apiClient.js
 * @description Enterprise HTTP API Client & Fallback Adapter for Platform Admin Dashboard.
 * 
 * Hỗ trợ chuyển đổi liền mạch giữa Real Backend API và Mock Fallback Fixtures:
 * 1. Đọc cấu hình biến môi trường `REACT_APP_API_URL`.
 * 2. Tự động chèn Bearer Token từ storage vào header Authorization.
 * 3. Tự động chèn `X-Organization-Id` cho các endpoint thuộc phạm vi tenant khi đã có Organization context.
 * 4. Hỗ trợ hủy bỏ (abort) in-flight requests cũ khi người dùng chuyển đổi Organization để chống race conditions.
 * 5. Tự động phát tín hiệu SESSION_REVOKED qua bus đa tab khi gặp 401 Unauthorized.
 * 6. Hỗ trợ cơ chế `executeWithFallback`: gọi API thật khi có endpoint, tự động dự phòng mock fixture khi môi trường dev/chưa nối backend.
 */

import multiTabSync, { SYNC_EVENTS } from './multiTabSync';

const rawApiUrl = process.env.REACT_APP_API_URL || 'http://127.0.0.1:5005/api/v1';

/**
 * Align local dev API URL hostname with browser hostname (`localhost` vs `127.0.0.1`)
 * so SameSite cookies (refresh + CSRF double-submit) share the same origin host across ports.
 * @param {string} [url]
 * @returns {string}
 */
export const resolveApiBaseUrl = (url = rawApiUrl) => {
  if (typeof window !== 'undefined') {
    const pageHost = window.location?.hostname;
    // Khi chạy trên domain hoặc IP thực tế (không phải localhost dev),
    // luôn gọi API tương đối qua Nginx reverse proxy (/api/v1) để không bị CSP và CORS chặn.
    if (pageHost && pageHost !== 'localhost' && pageHost !== '127.0.0.1') {
      return `${window.location.origin}/api/v1`;
    }
    if (pageHost === 'localhost' || pageHost === '127.0.0.1') {
      const normalized = String(url || '/api/v1')
        .replace('//localhost:5000', '//localhost:5005')
        .replace('//127.0.0.1:5000', '//127.0.0.1:5005');
      return normalized.replace(/\/\/(?:localhost|127\.0\.0\.1):5005/, `//${pageHost}:5005`);
    }
  }

  const normalized = String(url || '/api/v1')
    .replace('//localhost:5000', '//localhost:5005')
    .replace('//127.0.0.1:5000', '//127.0.0.1:5005');
  return normalized;
};

/**
 * Resolve backend host:port for WebSocket connections from local CRA dev servers (ports 3000-3005),
 * preserving the active browser hostname (`localhost` vs `127.0.0.1`).
 * @returns {string}
 */
export const resolveBackendWsHost = () => {
  if (typeof window === 'undefined') return 'localhost:5005';
  if (['3000', '3001', '3002', '3003', '3004', '3005'].includes(window.location.port)) {
    return `${window.location.hostname}:5005`;
  }
  return window.location.host;
};

export const API_BASE_URL = resolveApiBaseUrl(rawApiUrl);

let currentActiveOrgId = null;
let currentSwitchAbortController = null;
let inMemoryAccessToken = null;
let refreshInFlightPromise = null;

const CSRF_COOKIE_NAME = 'selfheal_csrf_token';

const readCsrfCookie = () => {
  if (typeof document === 'undefined' || !document.cookie) return null;
  for (const part of document.cookie.split(';')) {
    const idx = part.indexOf('=');
    if (idx <= 0) continue;
    if (part.slice(0, idx).trim() === CSRF_COOKIE_NAME) {
      const val = part.slice(idx + 1).trim();
      try {
        return decodeURIComponent(val);
      } catch {
        return val;
      }
    }
  }
  return null;
};

/**
 * Lưu access token ngắn hạn (15m) trong bộ nhớ RAM (không lưu refresh token vào storage)
 * @param {string|null} token
 */
export const setAuthToken = (token) => {
  inMemoryAccessToken = token || null;
};

/**
 * Xóa toàn bộ access token trong bộ nhớ và các khóa storage cũ
 */
export const clearAuthToken = () => {
  inMemoryAccessToken = null;
  try {
    sessionStorage.removeItem('admin_access_token');
    localStorage.removeItem('admin_access_token');
    localStorage.removeItem('selfheal_auth_token');
    localStorage.removeItem('token');
  } catch {}
};

const PUBLIC_OR_GLOBAL_ENDPOINTS = [
  '/auth/login',
  '/auth/register',
  '/auth/refresh',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/verify-email',
  '/auth/2fa',
  '/health',
  '/organizations/me/list',
  '/organizations/me/invitations',
  '/users/me/organizations',
  '/users/me/invitations',
  '/users/me/activities',
];

const isPublicOrGlobalEndpoint = (endpoint = '') => {
  const clean = endpoint.toLowerCase().split('?')[0];
  return PUBLIC_OR_GLOBAL_ENDPOINTS.some((p) => clean.includes(p));
};

/**
 * Lấy Organization ID hiện hành đang được active
 * @returns {string|null}
 */
export const getActiveOrganizationId = () => {
  if (currentActiveOrgId) return currentActiveOrgId;
  try {
    return localStorage.getItem('selfheal_active_org_id') || null;
  } catch (e) {
    return null;
  }
};

/**
 * Đặt Organization ID hiện hành và đồng bộ context cho API Client
 * @param {string|null} orgId 
 */
export const setActiveOrganizationId = (orgId) => {
  currentActiveOrgId = orgId || null;
};

/**
 * Hủy các request đang chờ xử lý liên quan đến tổ chức cũ khi người dùng switch tổ chức
 */
export const cancelPendingRequests = () => {
  if (currentSwitchAbortController) {
    currentSwitchAbortController.abort();
  }
  currentSwitchAbortController = new AbortController();
};

/**
 * Lấy Bearer Token xác thực hiện hành (chỉ lưu trong bộ nhớ RAM, không đọc từ localStorage/sessionStorage để chống XSS)
 * @returns {string|null}
 */
export const getAuthToken = () => inMemoryAccessToken || null;

/**
 * Làm mới access token single-flight: mọi 401 đồng thời dùng chung 1 POST /auth/refresh
 * để tránh đụng độ rotation & kích hoạt reuse detection giả.
 * @returns {Promise<string|null>}
 */
export const refreshAccessTokenSingleFlight = async () => {
  if (refreshInFlightPromise) {
    return refreshInFlightPromise;
  }

  refreshInFlightPromise = (async () => {
    const refreshUrl = `${API_BASE_URL.replace(/\/$/, '')}/auth/refresh`;
    const headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    const csrf = readCsrfCookie();
    if (csrf) {
      headers['X-CSRF-Token'] = csrf;
    }

    const res = await fetch(refreshUrl, {
      method: 'POST',
      credentials: 'include',
      headers,
    });

    if (!res.ok) {
      return null;
    }

    const payload = await res.json().catch(() => null);
    const nextToken = payload?.data?.token || null;
    if (nextToken) {
      setAuthToken(nextToken);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('selfheal:access-token-refreshed', { detail: { token: nextToken } })
        );
      }
    }
    return nextToken;
  })().finally(() => {
    refreshInFlightPromise = null;
  });

  return refreshInFlightPromise;
};

/**
 * Tạo Headers mặc định cho request API
 * @param {Record<string, string>} [customHeaders]
 * @param {string} [endpoint]
 * @returns {HeadersInit}
 */
export const createDefaultHeaders = (customHeaders = {}, endpoint = '') => {
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    ...customHeaders,
  };

  const token = getAuthToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const csrf = readCsrfCookie();
  if (csrf && !headers['X-CSRF-Token'] && !headers['x-csrf-token']) {
    headers['X-CSRF-Token'] = csrf;
  }

  // Tự động đính kèm X-Organization-Id nếu không phải endpoint public hoặc danh sách tổ chức toàn cục
  if (!isPublicOrGlobalEndpoint(endpoint)) {
    const orgId = getActiveOrganizationId();
    if (orgId && !headers['X-Organization-Id'] && !headers['x-organization-id']) {
      headers['X-Organization-Id'] = orgId;
    }
  }

  return headers;
};

/**
 * Thực thi một request HTTP có xử lý lỗi và chuẩn hóa JSON
 * @param {string} endpoint - Đường dẫn con (vd: '/admin/incidents')
 * @param {RequestInit} [options]
 * @returns {Promise<any>}
 */
export const request = async (endpoint, options = {}) => {
  const url = `${API_BASE_URL.replace(/\/$/, '')}/${endpoint.replace(/^\//, '')}`;
  const { _retriedAfterRefresh, ...fetchRest } = options;

  const signal = fetchRest.signal || (currentSwitchAbortController ? currentSwitchAbortController.signal : undefined);

  const config = {
    credentials: 'include',
    ...fetchRest,
    headers: createDefaultHeaders(fetchRest.headers, endpoint),
    signal,
  };

  let response;
  try {
    response = await fetch(url, config);
  } catch (fetchErr) {
    if (fetchErr && fetchErr.name === 'AbortError') {
      const abortError = new Error('Yêu cầu đã bị hủy do chuyển đổi tổ chức');
      abortError.name = 'AbortError';
      abortError.isAborted = true;
      throw abortError;
    }
    throw fetchErr;
  }

  if (!response.ok) {
    // 401 trên endpoint bảo vệ: thử single-flight refresh đúng 1 lần trước khi thu hồi phiên
    const canAttemptRefresh =
      response.status === 401 &&
      !_retriedAfterRefresh &&
      !String(endpoint).toLowerCase().includes('/auth/login') &&
      !String(endpoint).toLowerCase().includes('/auth/refresh') &&
      !String(endpoint).toLowerCase().includes('/auth/logout') &&
      !String(endpoint).toLowerCase().includes('/auth/register');

    if (canAttemptRefresh) {
      let refreshedToken = null;
      try {
        refreshedToken = await refreshAccessTokenSingleFlight();
      } catch {
        refreshedToken = null;
      }

      if (refreshedToken) {
        const retryHeaders = { ...(fetchRest.headers || {}) };
        delete retryHeaders.Authorization;
        delete retryHeaders.authorization;
        return request(endpoint, {
          ...fetchRest,
          headers: retryHeaders,
          _retriedAfterRefresh: true,
        });
      }

      // Refresh thất bại -> xóa sạch auth state cả tab hiện tại lẫn các tab khác
      clearAuthToken();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('selfheal:session-revoked'));
      }
      try {
        multiTabSync.broadcast(SYNC_EVENTS.SESSION_REVOKED);
      } catch {}
    } else if (response.status === 401 && !isPublicOrGlobalEndpoint(endpoint)) {
      clearAuthToken();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('selfheal:session-revoked'));
      }
      try {
        multiTabSync.broadcast(SYNC_EVENTS.SESSION_REVOKED);
      } catch {}
    }

    let errorData = null;
    try {
      errorData = await response.json();
    } catch {
      errorData = { message: response.statusText };
    }
    let errorMsg = errorData.message || `Lỗi yêu cầu máy chủ: ${response.status}`;
    // Tự động chuẩn hóa nếu backend trả về Zod raw issues string
    if (typeof errorMsg === 'string' && errorMsg.trim().startsWith('[') && errorMsg.includes('"message"')) {
      try {
        const parsed = JSON.parse(errorMsg);
        if (Array.isArray(parsed) && parsed[0]?.message) {
          errorMsg = parsed[0].message;
        }
      } catch {}
    }
    const error = new Error(errorMsg);
    error.status = response.status;
    error.data = errorData;
    const emitStatuses = new Set([403, 429, 500, 503]);
    const shouldEmit401 = response.status === 401 && !isPublicOrGlobalEndpoint(endpoint);
    if ((emitStatuses.has(response.status) || shouldEmit401) && typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('selfheal:http-status', {
          detail: { status: response.status, endpoint, message: errorMsg },
        })
      );
    }
    throw error;
  }

  return response.json();
};

/**
 * Cơ chế Adapter: Cố gắng gọi API thực tế; nếu không có kết nối hoặc gặp lỗi mạng thì chuyển sang mock provider
 * @template T
 * @param {() => Promise<T>} apiCall - Lời gọi API thực tế
 * @param {() => Promise<T>} fallbackMockCall - Lời gọi mock data fallback
 * @returns {Promise<T>}
 */
export const executeWithFallback = async (apiCall, fallbackMockCall) => {
  // Tuyệt đối không dùng mock fallback trong production hoặc khi bị từ chối xác thực/phân quyền (401/403)
  if (process.env.NODE_ENV !== 'production' && process.env.REACT_APP_USE_MOCK === 'true') {
    return fallbackMockCall();
  }

  try {
    return await apiCall();
  } catch (err) {
    if (err && (err.status === 401 || err.status === 403 || err.name === 'AbortError' || err.isAborted)) {
      throw err;
    }
    if (process.env.NODE_ENV === 'production') {
      throw err;
    }
    console.warn('[apiClient] Lời gọi backend không khả dụng, chuyển sang fallback mock:', err.message);
    return fallbackMockCall();
  }
};

export const getWsTicket = async () => {
  const res = await request('/auth/ws-ticket', { method: 'POST' });
  return res?.data?.ticket || null;
};

const apiClient = {
  API_BASE_URL,
  resolveApiBaseUrl,
  resolveBackendWsHost,
  getAuthToken,
  setAuthToken,
  clearAuthToken,
  refreshAccessTokenSingleFlight,
  getActiveOrganizationId,
  setActiveOrganizationId,
  cancelPendingRequests,
  createDefaultHeaders,
  request,
  executeWithFallback,
  getWsTicket,
};

export default apiClient;
