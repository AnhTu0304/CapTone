/**
 * Dịch vụ Xác thực và Người dùng (Auth & User API Client)
 * Kết nối trực tiếp với Main Backend Node.js Express (cổng 5000)
 */

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api/v1';

export const authService = {
  /**
   * Đăng ký tài khoản mới
   * @param {Object} payload { email, password, full_name }
   */
  async register({ email, password, full_name }) {
    const res = await fetch(`${API_BASE_URL}/auth/register`, {
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
    const res = await fetch(`${API_BASE_URL}/auth/login`, {
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
   * Đăng nhập / Đăng ký nhanh bằng Google OAuth Token
   * @param {string} token
   */
  async googleLogin(token) {
    const res = await fetch(`${API_BASE_URL}/auth/google`, {
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

    const res = await fetch(`${API_BASE_URL}/users/profile`, {
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

    const res = await fetch(`${API_BASE_URL}/auth/me`, {
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
};

export default authService;
