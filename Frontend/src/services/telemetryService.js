/**
 * @file telemetryService.js
 * @description Frontend Realtime Telemetry & Self-Healing Service
 * Connects directly to Main Backend (/api/v1/telemetry) with automatic fallback.
 */

import { getAuthToken } from './apiClient';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api/v1';

const getHeaders = () => {
  const token =
    getAuthToken() ||
    localStorage.getItem('selfheal_auth_token') ||
    localStorage.getItem('token');

  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return headers;
};

export const telemetryService = {
  /**
   * Fetch comprehensive real-time telemetry summary
   */
  async getLiveSummary(serviceId = 'sme-order-service') {
    try {
      const res = await fetch(`${API_BASE_URL}/telemetry/live-summary?service_id=${serviceId}`, {
        method: 'GET',
        headers: getHeaders(),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      return json.data;
    } catch (err) {
      console.warn('[telemetryService] getLiveSummary fallback:', err.message);
      return null;
    }
  },

  /**
   * Fetch metrics sequence for Chart
   */
  async getMetricsSequence(serviceId = 'sme-order-service', limit = 20) {
    try {
      const res = await fetch(
        `${API_BASE_URL}/telemetry/services/${serviceId}/metrics-sequence?limit=${limit}&bucket_seconds=5`,
        {
          method: 'GET',
          headers: getHeaders(),
        }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      return json.data?.sequence || [];
    } catch (err) {
      console.warn('[telemetryService] getMetricsSequence fallback:', err.message);
      return [];
    }
  },

  /**
   * Fetch live logs & K8s events for RCA context
   */
  async getRcaContext(serviceId = 'sme-order-service') {
    try {
      const res = await fetch(
        `${API_BASE_URL}/telemetry/services/${serviceId}/rca-context?window_minutes=15&log_limit=30`,
        {
          method: 'GET',
          headers: getHeaders(),
        }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      return json.data;
    } catch (err) {
      console.warn('[telemetryService] getRcaContext fallback:', err.message);
      return { logs: [], kubernetes_events: [] };
    }
  },

  /**
   * Trigger AI Evaluation & RCA
   */
  async evaluateService(serviceId = 'sme-order-service') {
    try {
      const res = await fetch(`${API_BASE_URL}/telemetry/services/${serviceId}/evaluate`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ bucket_seconds: 5, window_minutes: 15, auto_trigger_rca: true }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      return json.data;
    } catch (err) {
      console.warn('[telemetryService] evaluateService fallback:', err.message);
      return null;
    }
  },
};
