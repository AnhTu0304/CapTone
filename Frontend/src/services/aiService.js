/**
 * @file aiService.js
 * @description Frontend API Service kết nối trực tiếp Main Backend & AI Backend
 * Truy xuất dữ liệu từ các thực thể: ai_predictions, prediction_inputs, ai_recommendations,
 * rca_analyses, rca_evidences, healing_actions, healing_action_types.
 * Tuân thủ nguyên tắc trung thực số liệu (Honest Telemetry) không giả lập số liệu ảo.
 */

import { request } from './apiClient';

export const aiService = {
  /**
   * Kiểm tra trạng thái hoạt động của AI Backend và mô hình PyTorch GRU
   * GET /api/v1/ai/health
   */
  async getAiHealth() {
    try {
      const res = await request('/ai/health');
      if (res?.success && res.data) return res.data;
      return res;
    } catch (err) {
      console.warn('[aiService] getAiHealth error:', err.message);
      return { status: 'DISCONNECTED', model_loaded: false, error: err.message };
    }
  },

  /**
   * Lấy danh sách mô hình AI đã đăng ký
   * GET /api/v1/ai/models
   */
  async getModels() {
    try {
      const res = await request('/ai/models');
      if (res?.success && Array.isArray(res.data)) return res.data;
      if (Array.isArray(res)) return res;
      return [];
    } catch (err) {
      console.warn('[aiService] getModels error:', err.message);
      return [];
    }
  },

  /**
   * Lấy danh sách lịch sử dự báo rủi ro từ mô hình GRU
   * GET /api/v1/ai/predictions
   * @param {Object} params - { limit, offset, status, prediction_type }
   */
  async getPredictions(params = {}) {
    try {
      const search = new URLSearchParams();
      if (params.limit) search.append('limit', params.limit);
      if (params.offset) search.append('offset', params.offset);
      if (params.status) search.append('status', params.status);
      if (params.prediction_type) search.append('prediction_type', params.prediction_type);
      if (params.cluster_id) search.append('cluster_id', params.cluster_id);
      if (params.organization_id) search.append('organization_id', params.organization_id);

      const qs = search.toString() ? `?${search.toString()}` : '';
      const res = await request(`/ai/predictions${qs}`);
      if (res?.success && res.data) {
        return res.data; // { items: [...], total: number }
      }
      return { items: [], total: 0 };
    } catch (err) {
      console.warn('[aiService] getPredictions error:', err.message);
      return { items: [], total: 0 };
    }
  },

  /**
   * Lấy thống kê tổng quan các lượt dự báo
   * GET /api/v1/ai/predictions/stats
   */
  async getPredictionStats(params = {}) {
    try {
      const search = new URLSearchParams();
      if (params.cluster_id) search.append('cluster_id', params.cluster_id);
      if (params.workload) search.append('workload', params.workload);
      if (params.service_id) search.append('service_id', params.service_id);
      if (params.organization_id) search.append('organization_id', params.organization_id);
      const qs = search.toString() ? `?${search.toString()}` : '';
      const res = await request(`/ai/predictions/stats${qs}`);
      if (res?.success && res.data) return res.data;
      return { total: 0, by_type: {}, avg_confidence: 0 };
    } catch (err) {
      console.warn('[aiService] getPredictionStats error:', err.message);
      return { total: 0, by_type: {}, avg_confidence: 0 };
    }
  },

  /**
   * Lấy danh sách các dịch vụ / workload thực tế của cụm K8s
   * GET /api/v1/ai/workloads
   */
  async getWorkloads(clusterId, organizationId) {
    try {
      const search = new URLSearchParams();
      if (clusterId && clusterId !== 'ALL' && clusterId !== 'all') search.append('cluster_id', clusterId);
      if (organizationId) search.append('organization_id', organizationId);
      const qs = search.toString() ? `?${search.toString()}` : '';
      const res = await request(`/ai/workloads${qs}`);
      if (res?.success && Array.isArray(res.data)) return res.data;
      return [];
    } catch (err) {
      console.warn('[aiService] getWorkloads error:', err.message);
      return [];
    }
  },

  /**
   * Lấy chi tiết một lượt dự báo
   * GET /api/v1/ai/predictions/:id
   */
  async getPredictionDetail(id) {
    if (!id) return null;
    try {
      const res = await request(`/ai/predictions/${id}`);
      if (res?.success && res.data) return res.data;
      return null;
    } catch (err) {
      console.warn('[aiService] getPredictionDetail error:', err.message);
      return null;
    }
  },

  /**
   * Lấy chuỗi 12 mốc viễn trắc đầu vào của một lượt dự báo
   * GET /api/v1/ai/predictions/:id/inputs
   */
  async getPredictionInputs(id) {
    if (!id) return [];
    try {
      const res = await request(`/ai/predictions/${id}/inputs`);
      if (res?.success && Array.isArray(res.data)) return res.data;
      if (Array.isArray(res)) return res;
      return [];
    } catch (err) {
      console.warn('[aiService] getPredictionInputs error:', err.message);
      return [];
    }
  },

  /**
   * Kích hoạt thủ công quy trình suy diễn AI & chẩn đoán tự lành cho service
   * POST /api/v1/telemetry/services/:serviceId/evaluate
   */
  async triggerManualInference(serviceId = 'sme-order-service', options = {}) {
    try {
      const res = await request(`/telemetry/services/${serviceId}/evaluate`, {
        method: 'POST',
        body: JSON.stringify({
          force_rca: options.forceRca || false,
          auto_trigger_rca: options.autoTriggerRca !== false,
          bucket_seconds: options.bucketSeconds || 5,
          window_minutes: options.windowMinutes || 30,
        }),
      });
      return res;
    } catch (err) {
      console.error('[aiService] triggerManualInference error:', err.message);
      throw err;
    }
  },

  /**
   * Lấy danh sách các khuyến nghị phòng ngừa tự lành
   * GET /api/v1/ai/recommendations
   */
  async getRecommendations(params = {}) {
    try {
      const search = new URLSearchParams();
      if (params.limit) search.append('limit', params.limit);
      if (params.status) search.append('status', params.status);
      if (params.cluster_id) search.append('cluster_id', params.cluster_id);
      if (params.organization_id) search.append('organization_id', params.organization_id);

      const qs = search.toString() ? `?${search.toString()}` : '';
      const res = await request(`/ai/recommendations${qs}`);
      if (res?.success && Array.isArray(res.data)) return res.data;
      if (Array.isArray(res)) return res;
      return [];
    } catch (err) {
      console.warn('[aiService] getRecommendations error:', err.message);
      return [];
    }
  },

  /**
   * Lấy danh sách 7 loại hành động tự lành hệ thống hỗ trợ
   * GET /api/v1/ai/healing-action-types
   */
  async getHealingActionTypes() {
    try {
      const res = await request('/ai/healing-action-types');
      if (res?.success && Array.isArray(res.data)) return res.data;
      if (Array.isArray(res)) return res;
      return [];
    } catch (err) {
      console.warn('[aiService] getHealingActionTypes error:', err.message);
      return [];
    }
  },

  /**
   * Lấy lịch sử các hành động tự lành đã thực thi
   * GET /api/v1/ai/healing-actions
   */
  async getHealingActions(params = {}) {
    try {
      const search = new URLSearchParams();
      if (params.limit) search.append('limit', params.limit);
      if (params.cluster_id) search.append('cluster_id', params.cluster_id);
      if (params.organization_id) search.append('organization_id', params.organization_id);

      const qs = search.toString() ? `?${search.toString()}` : '';
      const res = await request(`/ai/healing-actions${qs}`);
      if (res?.success && Array.isArray(res.data)) return res.data;
      if (Array.isArray(res)) return res;
      return [];
    } catch (err) {
      console.warn('[aiService] getHealingActions error:', err.message);
      return [];
    }
  },

  /**
   * Áp dụng khuyến nghị tự lành phòng ngừa (Mitigate)
   * POST /api/v1/ai/recommendations/:id/apply
   */
  async applyRecommendation(id) {
    if (!id) throw new Error('Recommendation ID is required');
    try {
      const res = await request(`/ai/recommendations/${id}/apply`, {
        method: 'POST',
      });
      return res;
    } catch (err) {
      console.error('[aiService] applyRecommendation error:', err.message);
      throw err;
    }
  },

  /**
   * Lấy danh sách sự cố AI Incident
   * GET /api/v1/ai/incidents
   */
  async getIncidents(params = {}) {
    try {
      const search = new URLSearchParams();
      if (params.limit) search.append('limit', params.limit);
      if (params.offset) search.append('offset', params.offset);
      if (params.status) search.append('status', params.status);
      if (params.severity && params.severity !== 'all') search.append('severity', params.severity);
      if (params.cluster_id && params.cluster_id !== 'all') search.append('cluster_id', params.cluster_id);
      if (params.organization_id && params.organization_id !== 'all') search.append('organization_id', params.organization_id);
      if (params.search) search.append('search', params.search);

      const qs = search.toString() ? `?${search.toString()}` : '';
      const res = await request(`/ai/incidents${qs}`);
      if (res?.success && res.data) return res.data;
      return { items: [], total: 0 };
    } catch (err) {
      console.warn('[aiService] getIncidents error:', err.message);
      return { items: [], total: 0 };
    }
  },

  /**
   * Lấy bằng chứng RCA của một sự cố
   * GET /api/v1/ai/incidents/:id/evidences
   */
  async getIncidentEvidences(id) {
    if (!id) return [];
    try {
      const res = await request(`/ai/incidents/${id}/evidences`);
      if (res?.success && Array.isArray(res.data)) return res.data;
      if (Array.isArray(res)) return res;
      return [];
    } catch (err) {
      console.warn('[aiService] getIncidentEvidences error:', err.message);
      return [];
    }
  },

  /**
   * Cập nhật trạng thái sự cố (e.g. RESOLVED, IGNORED)
   * PATCH /api/v1/ai/incidents/:id/status
   */
  async updateIncidentStatus(id, status) {
    if (!id) throw new Error('Incident ID is required');
    try {
      const res = await request(`/ai/incidents/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      return res;
    } catch (err) {
      console.error('[aiService] updateIncidentStatus error:', err.message);
      throw err;
    }
  },

  /**
   * L?y chi ti?t s? c? k?m RCA
   * GET /api/v1/ai/incidents/:id
   */
  async getIncidentDetail(id) {
    if (!id) return null;
    try {
      const res = await request(`/ai/incidents/${id}`);
      return res?.data || res || null;
    } catch (err) {
      console.warn(`[aiService] getIncidentDetail error for ${id}:`, err.message);
      return null;
    }
  },
};

export default aiService;
