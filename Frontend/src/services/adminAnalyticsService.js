/**
 * @file adminAnalyticsService.js
 * @description Enterprise Service Layer for Platform Growth & Organization Analytics.
 * Kết nối các endpoint backend REST API thực tế (100% dữ liệu từ PostgreSQL):
 * - GET /api/v1/admin/analytics/growth : Lấy số liệu KPI, biểu đồ 12 tháng và danh sách chi tiết doanh nghiệp
 * - GET /api/v1/admin/analytics/export : Xuất báo cáo CSV an toàn chống CSV Injection
 */

import { request, API_BASE_URL, getAuthToken } from './apiClient';

export const adminAnalyticsService = {
  /**
   * Lấy số liệu thống kê tăng trưởng và danh sách doanh nghiệp thời gian thực
   * @param {Object} params
   * @param {number} [params.year=2026] - Năm thống kê
   * @param {string} [params.month='ALL'] - Tháng thống kê ('ALL' hoặc '1'..'12')
   * @param {number} [params.page=1] - Trang phân trang
   * @param {number} [params.limit=10] - Số dòng mỗi trang
   * @param {string} [params.search] - Từ khóa tìm kiếm
   * @param {string} [params.status='ALL'] - Trạng thái doanh nghiệp
   * @param {string} [params.env='ALL'] - Môi trường triển khai
   * @returns {Promise<Object>}
   */
  async getGrowthAnalytics(params = {}) {
    try {
      const queryParams = new URLSearchParams();
      if (params.year) queryParams.set('year', params.year);
      if (params.month) queryParams.set('month', params.month);
      if (params.page) queryParams.set('page', params.page);
      if (params.limit) queryParams.set('limit', params.limit);
      if (params.search) queryParams.set('search', params.search);
      if (params.status && params.status !== 'ALL') queryParams.set('status', params.status);
      if (params.env && params.env !== 'ALL') queryParams.set('env', params.env);

      const qs = queryParams.toString();
      const url = `/admin/analytics/growth${qs ? `?${qs}` : ''}`;
      const res = await request(url);
      return res?.data || res;
    } catch (err) {
      console.error('[adminAnalyticsService] getGrowthAnalytics error:', err);
      throw err;
    }
  },

  /**
   * Xuất báo cáo dữ liệu tăng trưởng doanh nghiệp định dạng CSV an toàn
   * @param {Object} params
   * @returns {Promise<void>}
   */
  async downloadGrowthCsv(params = {}) {
    try {
      const queryParams = new URLSearchParams();
      if (params.year) queryParams.set('year', params.year);
      if (params.month) queryParams.set('month', params.month);
      if (params.status && params.status !== 'ALL') queryParams.set('status', params.status);
      if (params.search) queryParams.set('search', params.search);

      const qs = queryParams.toString();
      const endpoint = `/admin/analytics/export${qs ? `?${qs}` : ''}`;
      
      const token = getAuthToken();
      const baseURL = (API_BASE_URL || 'http://127.0.0.1:5005/api/v1').replace(/\/$/, '');
      const fullUrl = `${baseURL}/${endpoint.replace(/^\//, '')}`;

      const headers = {
        Accept: 'text/csv, application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(fullUrl, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        let errMsg = response.statusText;
        try {
          const errJson = await response.json();
          errMsg = errJson.message || errMsg;
        } catch {}
        throw new Error(errMsg || `Lỗi xuất file CSV: ${response.status}`);
      }

      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      const monthSuffix = params.month && params.month !== 'ALL' ? `-T${params.month}` : '';
      link.setAttribute('download', `bao-cao-tang-truong-${params.year || 2026}${monthSuffix}.csv`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error('[adminAnalyticsService] downloadGrowthCsv error:', err);
      throw err;
    }
  },
};

export default adminAnalyticsService;
