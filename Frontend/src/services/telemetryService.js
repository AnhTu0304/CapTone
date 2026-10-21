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

  /**
   * Subscribe to live WebSocket telemetry stream (100% Push Protocol)
   * @param {string} serviceId
   * @param {Function} onMessage - Callback receives parsed WebSocket JSON messages
   * @param {Function} onStatusChange - Callback receives (isConnected: boolean)
   * @returns {Function} cleanup / unsubscribe function
   */
  subscribeWebSocket(serviceId = 'sme-order-service', onMessage, onStatusChange) {
    let ws = null;
    let reconnectTimeout = null;
    let isClosedExplicitly = false;

    const connect = () => {
      if (isClosedExplicitly) return;
      try {
        const isSecure = window.location.protocol === 'https:';
        const protocol = isSecure ? 'wss:' : 'ws:';
        // Connect to port 5000 if running locally on port 3000, else window.location.host
        const host = window.location.hostname === 'localhost' ? 'localhost:5000' : window.location.host;
        const wsUrl = `${protocol}//${host}/api/v1/telemetry/ws?service_id=${serviceId}`;

        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          console.log('🟢 [TelemetryWS] Connected to Live WebSocket Stream:', wsUrl);
          if (onStatusChange) onStatusChange(true);
        };

        ws.onmessage = (event) => {
          try {
            const payload = JSON.parse(event.data);
            if (onMessage) onMessage(payload);
          } catch (e) {
            console.warn('[TelemetryWS] Parse error:', e);
          }
        };

        ws.onclose = () => {
          if (onStatusChange) onStatusChange(false);
          if (!isClosedExplicitly) {
            console.log('🟡 [TelemetryWS] Connection closed. Reconnecting in 2.5s...');
            reconnectTimeout = setTimeout(connect, 2500);
          }
        };

        ws.onerror = (err) => {
          console.warn('[TelemetryWS] Socket error:', err);
          ws?.close();
        };
      } catch (e) {
        console.warn('[TelemetryWS] Init error:', e);
        if (!isClosedExplicitly) {
          reconnectTimeout = setTimeout(connect, 3000);
        }
      }
    };

    connect();

    return () => {
      isClosedExplicitly = true;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (ws) {
        ws.close();
      }
    };
  },
};
