/**
 * Dịch vụ Xác thực và Người dùng (Auth & User API Client)
 * Kết nối trực tiếp với Main Backend Node.js Express (cổng 5000)
 */

const rawApiUrl = process.env.REACT_APP_API_URL || 'http://127.0.0.1:5000/api/v1';
const API_BASE_URL = rawApiUrl.replace('//localhost:5000', '//127.0.0.1:5000');

async function safeFetch(url, options = {}) {
  try {
    return await fetch(url, options);
  } catch (err) {
    if (url.includes('localhost')) {
      const fallbackUrl = url.replace('localhost', '127.0.0.1');
      return await fetch(fallbackUrl, options);
    }
    if (url.includes('127.0.0.1')) {
      const fallbackUrl = url.replace('127.0.0.1', 'localhost');
      return await fetch(fallbackUrl, options);
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
    const savedToken = token || (typeof localStorage !== 'undefined' ? localStorage.getItem('selfheal_auth_token') : null);
    if (savedToken) {
      headers['Authorization'] = `Bearer ${savedToken}`;
    }

    const res = await fetch(`${API_BASE_URL}/auth/verify-email`, {
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
    const savedToken = token || (typeof localStorage !== 'undefined' ? localStorage.getItem('selfheal_auth_token') : null);
    if (savedToken) {
      headers['Authorization'] = `Bearer ${savedToken}`;
    }

    const res = await fetch(`${API_BASE_URL}/auth/send-verification`, {
      method: 'POST',
      headers,
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Không thể gửi lại mã xác thực lúc này');
    }
    return data;
  },
};

export default authService;
