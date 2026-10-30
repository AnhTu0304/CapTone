import { request } from './apiClient';

/**
 * Service lấy dữ liệu thống kê tổng hợp thực tế từ backend [S5][PBI19]
 */
export const dashboardStatisticsService = {
  /**
   * Lấy số liệu thống kê Dashboard tổng quan
   * @param {Object} params
   * @param {string} [params.time_range='24h'] - '15m' | '1h' | '6h' | '24h' | '7d' | '30d'
   * @param {string} [params.organization_id] - UUID tổ chức (tùy chọn)
   * @param {string} [params.cluster_id] - UUID cụm (tùy chọn)
   */
  async getOverviewStats(params = {}) {
    const searchParams = new URLSearchParams();
    if (params.time_range) searchParams.append('time_range', params.time_range);
    if (params.organization_id) searchParams.append('organization_id', params.organization_id);
    if (params.cluster_id) searchParams.append('cluster_id', params.cluster_id);

    const qs = searchParams.toString();
    const endpoint = `/statistics/overview${qs ? `?${qs}` : ''}`;
    const res = await request(endpoint, { method: 'GET' });
    return res?.data || res;
  },
};

export default dashboardStatisticsService;
