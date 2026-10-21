/**
 * @file adminUsersService.js
 * @description Enterprise Service Layer for Platform Admin User Management.
 * Kết nối các endpoint backend REST API thực tế:
 * - GET /api/v1/users : Danh sách người dùng, phân trang, lọc theo status, tìm kiếm theo search/email/name
 * - GET /api/v1/users/:id : Xem chi tiết một người dùng
 * - GET /api/v1/users/:id/roles : Lấy danh sách vai trò hệ thống (system_roles) của người dùng
 * - PATCH /api/v1/users/:id/verify-email : Kích hoạt xác thực email thủ công bởi Quản trị viên
 * - PUT /api/v1/users/:id : Cập nhật thông tin cơ bản người dùng (full_name, avatar_url)
 */

import { request } from './apiClient';

export const adminUsersService = {
  /**
   * Lấy danh sách người dùng hệ thống có phân trang và bộ lọc
   * @param {Object} [params]
   * @param {number} [params.page=1]
   * @param {number} [params.limit=10]
   * @param {string} [params.search='']
   * @param {string} [params.status='']
   * @param {string} [params.sort_by='created_at']
   * @param {string} [params.order='DESC']
   * @returns {Promise<{ items: Array<any>, pagination: { total: number, page: number, limit: number, totalPages: number } }>}
   */
  async getUsers(params = {}) {
    const query = new URLSearchParams();

    if (params.page) query.append('page', String(params.page));
    if (params.limit) query.append('limit', String(params.limit));
    if (params.search && params.search.trim()) query.append('search', params.search.trim());
    if (params.status && params.status !== 'ALL') query.append('status', params.status.trim().toUpperCase());
    if (params.sort_by) query.append('sort_by', params.sort_by);
    if (params.order) query.append('order', params.order);

    const qs = query.toString();
    const endpoint = qs ? `/users?${qs}` : '/users';
    const response = await request(endpoint);
    return response?.data || { items: [], pagination: { total: 0, page: 1, limit: 10, totalPages: 1 } };
  },

  /**
   * Xem thông tin chi tiết một người dùng theo UUID
   * @param {string} userId
   * @returns {Promise<any>}
   */
  async getUserDetails(userId) {
    if (!userId) throw new Error('Yêu cầu ID người dùng');
    const response = await request(`/users/${encodeURIComponent(userId)}`);
    return response?.data || null;
  },

  /**
   * Lấy danh sách vai trò hệ thống của người dùng
   * @param {string} userId
   * @returns {Promise<Array<string>>}
   */
  async getUserRoles(userId) {
    if (!userId) return [];
    try {
      const response = await request(`/users/${encodeURIComponent(userId)}/roles`);
      const data = response?.data || [];
      if (!Array.isArray(data)) return [];
      return data
        .map((item) => {
          if (typeof item === 'string') return item;
          return item?.role_name || item?.name || item?.role_id || String(item);
        })
        .filter(Boolean);
    } catch (err) {
      console.warn('[adminUsersService] Không thể lấy vai trò hệ thống của user:', err.message);
      return [];
    }
  },

  /**
   * Kích hoạt xác thực email người dùng bởi Quản trị viên
   * @param {string} userId
   * @returns {Promise<any>}
   */
  async verifyUserEmail(userId) {
    if (!userId) throw new Error('Yêu cầu ID người dùng cần xác thực');
    const response = await request(`/users/${encodeURIComponent(userId)}/verify-email`, {
      method: 'PATCH',
    });
    return response?.data;
  },

  /**
   * Cập nhật thông tin họ tên / avatar người dùng
   * @param {string} userId
   * @param {Object} data
   * @param {string} [data.full_name]
   * @param {string} [data.avatar_url]
   * @returns {Promise<any>}
   */
  async updateUser(userId, data) {
    if (!userId) throw new Error('Yêu cầu ID người dùng cần cập nhật');
    const response = await request(`/users/${encodeURIComponent(userId)}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return response?.data;
  },

  /**
   * Cập nhật trạng thái tài khoản người dùng (Khóa / Mở khóa)
   * @param {string} userId
   * @param {'ACTIVE' | 'SUSPENDED'} status
   * @returns {Promise<any>}
   */
  async updateUserStatus(userId, status) {
    if (!userId) throw new Error('Yêu cầu ID người dùng cần cập nhật trạng thái');
    const response = await request(`/users/${encodeURIComponent(userId)}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    return response?.data;
  },
};

export default adminUsersService;
