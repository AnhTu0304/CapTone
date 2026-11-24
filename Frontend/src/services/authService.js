/**
 * Dịch vụ Xác thực và Người dùng (Auth & User API Client)
 * Kết nối trực tiếp với Main Backend Node.js Express (cổng 5000)
 */

import { API_BASE_URL } from './apiClient';

const CSRF_COOKIE_NAME = 'selfheal_csrf_token';

/**
 * Đọc CSRF token (double-submit cookie) từ document.cookie
 * Lưu ý: Refresh token nằm trong HttpOnly cookie nên JS không bao giờ đọc được.
 */
export function getCsrfTokenFromCookie() {
  if (typeof document === 'undefined' || !document.cookie) return null;
  const pairs = document.cookie.split(';');
  for (const part of pairs) {
    const idx = part.indexOf('=');
    if (idx <= 0) continue;
    const key = part.slice(0, idx).trim();
    if (key === CSRF_COOKIE_NAME) {
      const raw = part.slice(idx + 1).trim();
      try {
        return decodeURIComponent(raw);
      } catch {
        return raw;
      }
    }
  }
  return null;
}

async function safeFetch(url, options = {}) {
  const fetchOptions = {
    credentials: 'include',
    ...options,
  };
  try {
    return await fetch(url, fetchOptions);
  } catch (err) {
    if (url.includes('localhost')) {
      const fallbackUrl = url.replace('localhost', '127.0.0.1');
      return await fetch(fallbackUrl, fetchOptions);
    }
    if (url.includes('127.0.0.1')) {
      const fallbackUrl = url.replace('127.0.0.1', 'localhost');
      return await fetch(fallbackUrl, fetchOptions);
    }
    throw err;
  }
}

export const authService = {
  /**
   * Đăng ký tài khoản mới
   * @param {Object} payload { email, password, full_name }
   */
  async register({ email, password, full_name }) {
    const res = await safeFetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password, full_name }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Đăng ký tài khoản không thành công');
    }
    return data;
  },

  /**
   * Đăng nhập tài khoản
   * @param {Object} payload { email, password }
   */
  async login({ email, password }) {
    const res = await safeFetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Email hoặc mật khẩu không chính xác');
    }
    return data;
  },

  /**
   * Xác thực mã OTP 2FA để hoàn tất đăng nhập
   * @param {string} temp_token
   * @param {string} code
   */
  async verify2FALogin(temp_token, code) {
    const res = await safeFetch(`${API_BASE_URL}/auth/login/2fa`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ temp_token, code: code?.trim() }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Mã xác thực 2FA không chính xác hoặc đã hết hạn');
    }
    return data;
  },

  /**
   * Đăng nhập / Đăng ký nhanh bằng Google OAuth Token
   * @param {string} token
   */
  async googleLogin(token) {
    const res = await safeFetch(`${API_BASE_URL}/auth/google`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Đăng nhập với Google không thành công');
    }
    return data;
  },

  /**
   * Lấy thông tin hồ sơ người dùng đang đăng nhập
   * @param {string} token
   */
  async getProfile(token) {
    if (!token) return null;

    const res = await safeFetch(`${API_BASE_URL}/users/profile`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Không thể tải thông tin người dùng');
    }
    return data.data;
  },

  /**
   * Xác thực token người dùng hiện tại
   * @param {string} token
   */
  async getMe(token) {
    if (!token) return null;

    const res = await safeFetch(`${API_BASE_URL}/auth/me`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Token không hợp lệ hoặc đã hết hạn');
    }
    return data.data;
  },

  /**
   * Xác thực mã OTP kích hoạt tài khoản
   * @param {string} code - Mã OTP 6 chữ số
   * @param {string} [token] - Token xác thực nếu có
   */
  async verifyEmail(code, token) {
    const headers = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await safeFetch(`${API_BASE_URL}/auth/verify-email`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ code: String(code).trim() }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Mã xác thực không chính xác hoặc đã hết hạn');
    }
    return data;
  },

  /**
   * Yêu cầu gửi lại mã xác thực OTP về email
   * @param {string} [token] - Token xác thực nếu có
   */
  async resendVerification(token) {
    const headers = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await safeFetch(`${API_BASE_URL}/auth/send-verification`, {
      method: 'POST',
      headers,
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Không thể gửi lại mã xác thực lúc này');
    }
    return data;
  },

  /**
   * Làm mới phiên bằng HttpOnly refresh cookie + Double-Submit CSRF header.
   * Không bao giờ lưu refresh token vào localStorage/sessionStorage.
   */
  async refreshSession() {
    const headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    const csrf = getCsrfTokenFromCookie();
    if (csrf) {
      headers['X-CSRF-Token'] = csrf;
    }

    const res = await safeFetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers,
    });

    let data = null;
    try {
      data = await res.json();
    } catch {
      data = {};
    }

    if (!res.ok) {
      const err = new Error(data?.message || 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
      err.status = res.status;
      throw err;
    }
    return data;
  },

  /**
   * Đăng xuất phiên hiện tại trên server (thu hồi refresh session + xóa HttpOnly cookie)
   * @param {string} [token]
   */
  async logout(token) {
    const headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const csrf = getCsrfTokenFromCookie();
    if (csrf) {
      headers['X-CSRF-Token'] = csrf;
    }

    const res = await safeFetch(`${API_BASE_URL}/auth/logout`, {
      method: 'POST',
      headers,
    });
    let data = null;
    try {
      data = await res.json();
    } catch {
      data = {};
    }
    return data;
  },

  /**
   * Đăng xuất khỏi toàn bộ thiết bị / phiên đang hoạt động
   * @param {string} [token]
   */
  async logoutAll(token) {
    const headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const csrf = getCsrfTokenFromCookie();
    if (csrf) {
      headers['X-CSRF-Token'] = csrf;
    }

    const res = await safeFetch(`${API_BASE_URL}/auth/logout-all`, {
      method: 'POST',
      headers,
    });
    let data = null;
    try {
      data = await res.json();
    } catch {
      data = {};
    }
    if (!res.ok) {
      throw new Error(data?.message || 'Không thể đăng xuất toàn bộ phiên');
    }
    return data;
  },

  async forgotPassword(email) {
    const res = await safeFetch(`${API_BASE_URL}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Không thể gửi yêu cầu đặt lại mật khẩu');
    }
    return data;
  },

  async resetPassword(token, new_password) {
    const res = await safeFetch(`${API_BASE_URL}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, new_password }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Không thể đặt lại mật khẩu');
    }
    return data;
  },
};

export default authService;
