/**
 * @file profileService.js
 * @description Dịch vụ kết nối API Hồ sơ cá nhân (User Profile Service)
 * Kết nối các endpoint:
 * - GET /api/v1/users/me : Xem thông tin hồ sơ cá nhân và quyền hạn từ DB
 * - PUT /api/v1/users/me : Cập nhật họ tên, SĐT, chức danh, avatar vào DB
 * Hỗ trợ fallback mượt mà với mock data và localStorage khi không có token / chạy demo.
 */

import { request, executeWithFallback, getAuthToken } from './apiClient';
import { getStoredProfile, saveStoredProfile } from '../mocks/profileMockData';

export const profileService = {
  /**
   * Lấy thông tin hồ sơ người dùng (GET /api/v1/users/me)
   * @returns {Promise<any>}
   */
  async getProfile() {
    return executeWithFallback(
      async () => {
        const token = getAuthToken();
        if (!token) {
          return getStoredProfile();
        }

        const res = await request('/users/me');
        if (res && res.data) {
          const remoteData = res.data;
          const merged = {
            ...getStoredProfile(),
            fullName: remoteData.fullName || remoteData.full_name || '',
            email: remoteData.email || '',
            phone: remoteData.phone || '',
            jobTitle: remoteData.jobTitle || remoteData.job_title || '',
            avatar: remoteData.avatarUrl || remoteData.avatar_url || null,
            organization: remoteData.organization?.name || 'SME Retail Enterprise',
            systemRole: remoteData.systemRole || 'USER',
            orgRole: remoteData.organizationRole || 'SME_OWNER',
            accountStatus: remoteData.accountStatus || remoteData.status || 'ACTIVE',
            joinedDate: remoteData.createdAt ? new Date(remoteData.createdAt).toLocaleDateString('vi-VN') : '15/01/2026',
            lastLogin: remoteData.lastLoginAt ? new Date(remoteData.lastLoginAt).toLocaleString('vi-VN') : 'Vừa xong',
          };
          saveStoredProfile(merged);
          return merged;
        }
        return getStoredProfile();
      },
      async () => getStoredProfile()
    );
  },

  /**
   * Cập nhật thông tin hồ sơ người dùng (PUT /api/v1/users/me)
   * @param {Object} profileData
   * @returns {Promise<any>}
   */
  async updateProfile(profileData) {
    return executeWithFallback(
      async () => {
        const token = getAuthToken();
        if (!token) {
          saveStoredProfile(profileData);
          return profileData;
        }

        const payload = {
          fullName: profileData.fullName,
          phone: profileData.phone || null,
          jobTitle: profileData.jobTitle || null,
          avatarUrl: profileData.avatar || null,
        };

        const res = await request('/users/me', {
          method: 'PUT',
          body: JSON.stringify(payload),
        });

        if (res && res.data) {
          const updated = {
            ...profileData,
            fullName: res.data.fullName || res.data.full_name || profileData.fullName,
            phone: res.data.phone || profileData.phone,
            jobTitle: res.data.jobTitle || res.data.job_title || profileData.jobTitle,
            avatar: res.data.avatarUrl || res.data.avatar_url || profileData.avatar,
          };
          saveStoredProfile(updated);
          return updated;
        }

        saveStoredProfile(profileData);
        return profileData;
      },
      async () => {
        saveStoredProfile(profileData);
        return profileData;
      }
    );
  },
};

export default profileService;
