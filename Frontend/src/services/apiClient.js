/**
 * @file apiClient.js
 * @description Enterprise HTTP API Client & Fallback Adapter for Platform Admin Dashboard.
 * 
 * Hỗ trợ chuyển đổi liền mạch giữa Real Backend API và Mock Fallback Fixtures:
 * 1. Đọc cấu hình biến môi trường `REACT_APP_API_URL`.
 * 2. Tự động chèn Bearer Token từ storage vào header Authorization.
 * 3. Hỗ trợ cơ chế `executeWithFallback`: gọi API thật khi có endpoint, tự động dự phòng mock fixture khi môi trường dev/chưa nối backend.
 */

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api/v1';

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
 * @returns {HeadersInit}
 */
export const createDefaultHeaders = (customHeaders = {}) => {
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    ...customHeaders,
  };

  const token = getAuthToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
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

  const config = {
    ...options,
    headers: createDefaultHeaders(options.headers),
  };

  const response = await fetch(url, config);

  if (!response.ok) {
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
  createDefaultHeaders,
  request,
  executeWithFallback,
};

export default apiClient;
