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

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api/v1';

let currentActiveOrgId = null;
let currentSwitchAbortController = null;

const PUBLIC_OR_GLOBAL_ENDPOINTS = [
  '/auth/login',
  '/auth/register',
  '/auth/refresh',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/verify-email',
  '/health',
  '/organizations/me/list',
  '/organizations/me/invitations',
  '/users/me/organizations',
  '/users/me/invitations',
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
 * Lấy Bearer Token xác thực hiện hành (nếu có)
 * @returns {string|null}
 */
export const getAuthToken = () => {
  try {
    return (
      sessionStorage.getItem('admin_access_token') ||
      localStorage.getItem('admin_access_token') ||
      localStorage.getItem('selfheal_auth_token') ||
      localStorage.getItem('token') ||
      null
    );
  } catch (e) {
    return null;
  }
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

  const signal = options.signal || (currentSwitchAbortController ? currentSwitchAbortController.signal : undefined);

  const config = {
    ...options,
    headers: createDefaultHeaders(options.headers, endpoint),
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
    // Nếu token bị từ chối 401 trên endpoint bảo vệ, phát tín hiệu thoát session cho tất cả các tab
    if (response.status === 401 && !isPublicOrGlobalEndpoint(endpoint)) {
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
    const error = new Error(errorData.message || `Lỗi yêu cầu máy chủ: ${response.status}`);
    error.status = response.status;
    error.data = errorData;
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
  // Nếu có biến môi trường yêu cầu buộc dùng mock
  if (process.env.REACT_APP_USE_MOCK === 'true' || !process.env.REACT_APP_API_URL) {
    return fallbackMockCall();
  }

  try {
    return await apiCall();
  } catch (err) {
    console.warn('[apiClient] Lời gọi backend không khả dụng, chuyển sang fallback mock:', err.message);
    return fallbackMockCall();
  }
};

const apiClient = {
  API_BASE_URL,
  getAuthToken,
  getActiveOrganizationId,
  setActiveOrganizationId,
  cancelPendingRequests,
  createDefaultHeaders,
  request,
  executeWithFallback,
};

export default apiClient;
