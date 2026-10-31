/**
 * @file telemetryService.js
 * @description Frontend Realtime Telemetry & Self-Healing Service
 * Connects directly to Main Backend (/api/v1/telemetry) with automatic fallback.
 */

import { getAuthToken, getActiveOrganizationId, request } from './apiClient';

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

  const activeOrgId = getActiveOrganizationId();
  if (activeOrgId) {
    headers['X-Organization-Id'] = activeOrgId;
  }

  return headers;
};

export const telemetryService = {
  /**
   * Query historical & real-time Node Metrics from Backend Task 4.3 API
   * Supports tenant-scoped routes:
   * - GET /api/v1/organizations/:orgId/clusters/:clusterId/nodes/:nodeId/metrics
   * - GET /api/v1/organizations/:orgId/agents/:agentId/metrics
   * - GET /api/v1/nodes/:nodeId/metrics
   * - GET /api/v1/telemetry/node-metrics
   */
  async getNodeMetrics(params = {}, options = {}) {
    const {
      orgId,
      clusterId,
      agentId,
      nodeId,
      nodeName,
      from,
      to,
      limit = 200,
      page = 1,
      order = 'asc',
    } = params;

    const validOrgId =
      orgId &&
      !orgId.startsWith('org-') &&
      !orgId.startsWith('sandbox-') &&
      orgId !== 'org-empty'
        ? orgId
        : null;
    const validClusterId =
      clusterId &&
      !clusterId.startsWith('org-') &&
      !clusterId.startsWith('sandbox-')
        ? clusterId
        : null;
    const validNodeId =
      nodeId && nodeId !== 'ALL' && nodeId !== 'all' ? nodeId : null;

    const queryParams = new URLSearchParams();
    if (from) queryParams.set('from', from);
    if (to) queryParams.set('to', to);
    if (limit) queryParams.set('limit', String(limit));
    if (page) queryParams.set('page', String(page));
    if (order) queryParams.set('order', order);
    if (nodeName && nodeName !== 'ALL' && nodeName !== 'all') {
      queryParams.set('node_name', nodeName);
    }

    let endpoint = '/telemetry/node-metrics';
    if (validOrgId && validClusterId && validNodeId) {
      endpoint = `/organizations/${encodeURIComponent(validOrgId)}/clusters/${encodeURIComponent(validClusterId)}/nodes/${encodeURIComponent(validNodeId)}/metrics`;
    } else if (validOrgId && agentId) {
      endpoint = `/organizations/${encodeURIComponent(validOrgId)}/agents/${encodeURIComponent(agentId)}/metrics`;
    } else if (validNodeId) {
      endpoint = `/nodes/${encodeURIComponent(validNodeId)}/metrics`;
      if (validClusterId) queryParams.set('cluster_id', validClusterId);
      if (validOrgId) queryParams.set('organization_id', validOrgId);
    } else {
      if (validOrgId) queryParams.set('organization_id', validOrgId);
      if (validClusterId) queryParams.set('cluster_id', validClusterId);
      if (agentId) queryParams.set('agent_id', agentId);
    }

    const qs = queryParams.toString();
    const fullEndpoint = qs ? `${endpoint}?${qs}` : endpoint;

    const res = await request(fullEndpoint, {
      method: 'GET',
      signal: options.signal,
    });

    const data = res?.data || res || {};
    const items = Array.isArray(data.items)
      ? data.items
      : Array.isArray(data.metrics)
        ? data.metrics
        : Array.isArray(data)
          ? data
          : [];

    return {
      items,
      pagination: data.pagination || {
        page: 1,
        limit: items.length || limit,
        total: items.length,
        total_pages: 1,
        has_more: false,
      },
    };
  },

  /**
   * Fetch downsampled time-series node metrics (CPU, RAM, Disk, Network) [S5][PBI20 Task 2.1 & 2.2]
   * @param {Object} options
   * @param {string} [options.nodeId] - Node ID
   * @param {string} [options.nodeName] - Node name
   * @param {string} [options.clusterId] - Cluster ID
   * @param {string} [options.organizationId] - Organization ID
   * @param {string} [options.range] - '15m' | '1h' | '6h' | '24h' | '7d' | '30d'
   * @param {string|number} [options.interval] - '15s', '60s', '300s', etc.
   * @param {string} [options.metricType] - 'ALL' | 'CPU' | 'RAM' | 'DISK' | 'NETWORK'
   * @param {string} [options.aggregation] - 'AVG' | 'MIN' | 'MAX' | 'SUM' | 'LAST'
   * @param {Date|string} [options.startTime]
   * @param {Date|string} [options.endTime]
   * @param {AbortSignal} [options.signal]
   * @returns {Promise<Object>}
   */
  async getNodeTimeseries(options = {}) {
    const {
      nodeId,
      nodeName,
      clusterId,
      organizationId,
      range = '1h',
      interval,
      metricType = 'ALL',
      aggregation = 'AVG',
      startTime,
      endTime,
      signal,
    } = options;

    const queryParams = new URLSearchParams();
    if (range) queryParams.set('range', range);
    if (interval) queryParams.set('interval', String(interval));
    if (metricType) queryParams.set('metricType', metricType);
    if (aggregation) queryParams.set('aggregation', aggregation);
    if (clusterId) queryParams.set('clusterId', clusterId);
    if (nodeName) queryParams.set('nodeName', nodeName);
    if (organizationId) queryParams.set('organizationId', organizationId);
    if (startTime) {
      queryParams.set('startTime', startTime instanceof Date ? startTime.toISOString() : startTime);
    }
    if (endTime) {
      queryParams.set('endTime', endTime instanceof Date ? endTime.toISOString() : endTime);
    }

    const endpoint = nodeId
      ? `/telemetry/nodes/${encodeURIComponent(nodeId)}/timeseries`
      : `/telemetry/timeseries`;

    const qs = queryParams.toString();
    const fullEndpoint = qs ? `${endpoint}?${qs}` : endpoint;

    const res = await request(fullEndpoint, {
      method: 'GET',
      signal,
    });

    return res?.data || res || {};
  },

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
   * Fetch list of APM-monitored services with summary KPIs
   */
  async getApmServices(windowMinutes = 60, options = {}) {
    try {
      const activeOrgId = typeof options === 'object' && options?.organizationId
        ? options.organizationId
        : getActiveOrganizationId();
      const clusterId = typeof options === 'object' && options?.clusterId ? options.clusterId : undefined;
      const orgParam = activeOrgId ? `&organization_id=${encodeURIComponent(activeOrgId)}` : '';
      const clusterParam = clusterId ? `&cluster_id=${encodeURIComponent(clusterId)}` : '';

      const res = await fetch(
        `${API_BASE_URL}/telemetry/services?window_minutes=${windowMinutes}${orgParam}${clusterParam}`,
        {
          method: 'GET',
          headers: getHeaders(),
          signal: typeof options === 'object' ? options?.signal : undefined,
        }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      return Array.isArray(json?.data) ? json.data : [];
    } catch (err) {
      if (err?.name === 'AbortError') throw err;
      console.warn('[telemetryService] getApmServices fallback:', err.message);
      return [];
    }
  },

  /**
   * Fetch metrics sequence for APM Chart
   * Supports options object: { limit, bucket_seconds, signal } or legacy limit number
   */
  async getMetricsSequence(serviceId = 'sme-order-service', options = 20) {
    try {
      const limit = typeof options === 'number' ? options : options?.limit || 60;
      const bucketSeconds = typeof options === 'object' && options?.bucket_seconds ? options.bucket_seconds : 5;
      const range = typeof options === 'object' && options?.range ? options.range : undefined;
      const signal = typeof options === 'object' ? options?.signal : undefined;
      const clusterId = typeof options === 'object' && options?.cluster_id ? options.cluster_id : undefined;
      const activeOrgId = typeof options === 'object' && options?.organization_id ? options.organization_id : getActiveOrganizationId();

      const rangeParam = range ? `&range=${encodeURIComponent(range)}` : '';
      const clusterParam = clusterId ? `&cluster_id=${encodeURIComponent(clusterId)}` : '';
      const orgParam = activeOrgId ? `&organization_id=${encodeURIComponent(activeOrgId)}` : '';

      const res = await fetch(
        `${API_BASE_URL}/telemetry/services/${encodeURIComponent(serviceId)}/metrics-sequence?limit=${limit}&bucket_seconds=${bucketSeconds}${rangeParam}${clusterParam}${orgParam}`,
        {
          method: 'GET',
          headers: getHeaders(),
          signal,
        }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      return json.data?.sequence || [];
    } catch (err) {
      if (err?.name === 'AbortError') throw err;
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
   * Fetch historical APM metrics with range (1h, 24h, 7d), pagination, and cursor (Task [S4][PB16] 2.3)
   */
  /**
   * Fetch centralized logs with K8s filters (namespace, deployment, pod, level, serviceId, search, time range) and pagination (Task [S4][PB17] 3.1 & 3.2 / [4.36])
   */
  async getLogs(params = {}, options = {}) {
    try {
      const {
        serviceId,
        namespace,
        deployment,
        pod,
        level,
        search,
        range,
        startTime,
        endTime,
        clusterId,
        page = 1,
        limit = 50,
      } = params;

      const queryParams = new URLSearchParams();
      if (serviceId && serviceId !== 'all' && serviceId !== 'ALL') queryParams.set('service_id', serviceId);
      if (namespace && namespace !== 'all' && namespace !== 'ALL') queryParams.set('namespace', namespace);
      if (deployment && deployment !== 'all' && deployment !== 'ALL') queryParams.set('deployment', deployment);
      if (pod && pod !== 'all' && pod !== 'ALL') queryParams.set('pod', pod);
      if (level && level !== 'all' && level !== 'ALL') queryParams.set('level', level);
      if (search && search.trim()) queryParams.set('search', search.trim());
      if (range && range !== 'all' && range !== 'ALL') queryParams.set('range', range);
      if (startTime) queryParams.set('start_time', startTime);
      if (endTime) queryParams.set('end_time', endTime);
      if (clusterId && clusterId !== 'all' && clusterId !== 'ALL') queryParams.set('cluster_id', clusterId);
      if (page) queryParams.set('page', String(page));
      if (limit) queryParams.set('limit', String(limit));

      const qs = queryParams.toString();
      const url = `${API_BASE_URL}/telemetry/logs${qs ? `?${qs}` : ''}`;

      const res = await fetch(url, {
        method: 'GET',
        headers: getHeaders(),
        signal: options?.signal,
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.message || `HTTP ${res.status}`);
      }

      const json = await res.json();
      return json.data || { logs: [], pagination: { total: 0, page: 1, limit, totalPages: 1 } };
    } catch (err) {
      if (err?.name === 'AbortError') throw err;
      console.warn('[telemetryService] getLogs error:', err.message);
      throw err;
    }
  },

  /**
   * Fetch centralized Kubernetes Events with filters and pagination [S4][PB18] 4.1 & 4.2
   */
  async getKubernetesEvents(params = {}, options = {}) {
    try {
      const {
        clusterId,
        namespace,
        eventType,
        type,
        reason,
        resourceType,
        resourceUid,
        pod,
        search,
        range,
        startTime,
        endTime,
        page = 1,
        limit = 50,
      } = params;

      const queryParams = new URLSearchParams();
      if (clusterId && clusterId !== 'all' && clusterId !== 'ALL') queryParams.set('cluster_id', clusterId);
      if (namespace && namespace !== 'all' && namespace !== 'ALL') queryParams.set('namespace', namespace);
      const effectiveType = eventType || type;
      if (effectiveType && effectiveType !== 'all' && effectiveType !== 'ALL') queryParams.set('type', effectiveType);
      if (reason && reason !== 'all' && reason !== 'ALL') queryParams.set('reason', reason);
      if (resourceType && resourceType !== 'all' && resourceType !== 'ALL') queryParams.set('resource_type', resourceType);
      const effectivePod = resourceUid || pod;
      if (effectivePod && effectivePod !== 'all' && effectivePod !== 'ALL') queryParams.set('resource_uid', effectivePod);
      if (search && search.trim()) queryParams.set('search', search.trim());
      if (range && range !== 'all' && range !== 'ALL') queryParams.set('range', range);
      if (startTime) queryParams.set('start_time', startTime);
      if (endTime) queryParams.set('end_time', endTime);
      if (page) queryParams.set('page', String(page));
      if (limit) queryParams.set('limit', String(limit));

      const qs = queryParams.toString();
      const url = `${API_BASE_URL}/telemetry/events${qs ? `?${qs}` : ''}`;

      const res = await fetch(url, {
        method: 'GET',
        headers: getHeaders(),
        signal: options?.signal,
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.message || `HTTP ${res.status}`);
      }

      const json = await res.json();
      return json.data || { events: [], pagination: { total: 0, page: 1, limit, totalPages: 1 } };
    } catch (err) {
      if (err?.name === 'AbortError') throw err;
      console.warn('[telemetryService] getKubernetesEvents error:', err.message);
      throw err;
    }
  },

  /**
   * Fetch single Kubernetes Event detail by ID [S4][PB18] 4.3
   * @param {string|number} id - Event ID
   * @param {Object} [options] - Request options (signal)
   */
  async getKubernetesEventById(id, options = {}) {
    try {
      const url = `${API_BASE_URL}/telemetry/events/${encodeURIComponent(id)}`;
      const res = await fetch(url, {
        headers: getHeaders(),
        signal: options?.signal,
      });
      if (!res.ok) {
        let errorMsg = `HTTP Error ${res.status}`;
        try {
          const errBody = await res.json();
          errorMsg = errBody.message || errorMsg;
        } catch {
          // ignore
        }
        throw new Error(errorMsg);
      }
      const json = await res.json();
      return json.data || null;
    } catch (err) {
      if (err?.name === 'AbortError') throw err;
      console.warn('[telemetryService] getKubernetesEventById error:', err.message);
      throw err;
    }
  },

  /**
   * Connect to Real-time SSE Logs Stream [S4][PB17] 3.3
   * @param {Object} params - Query filters (serviceId, namespace, deployment, pod, level, clusterId, tail)
   * @param {Function} onEvent - Callback for SSE events: (eventType, data) => void
   * @param {Function} onError - Callback for stream errors: (err) => void
   * @param {Object} [options] - Stream options (signal)
   * @returns {Function} unsubscribe - Function to close the stream
   */
  streamLogs(params = {}, onEvent, onError, options = {}) {
    const {
      serviceId,
      namespace,
      deployment,
      pod,
      level,
      search,
      clusterId,
      tail = 20,
    } = params;

    const queryParams = new URLSearchParams();
    if (serviceId && serviceId !== 'all' && serviceId !== 'ALL') queryParams.set('service_id', serviceId);
    if (namespace && namespace !== 'all' && namespace !== 'ALL') queryParams.set('namespace', namespace);
    if (deployment && deployment !== 'all' && deployment !== 'ALL') queryParams.set('deployment', deployment);
    if (pod && pod !== 'all' && pod !== 'ALL') queryParams.set('pod', pod);
    if (level && level !== 'all' && level !== 'ALL') queryParams.set('level', level);
    if (search && search.trim()) queryParams.set('search', search.trim());
    if (clusterId && clusterId !== 'all' && clusterId !== 'ALL') queryParams.set('cluster_id', clusterId);
    if (tail !== undefined && tail !== null) queryParams.set('tail', String(tail));

    const qs = queryParams.toString();
    const url = `${API_BASE_URL}/telemetry/logs/stream${qs ? `?${qs}` : ''}`;
    const controller = new AbortController();

    if (options.signal) {
      options.signal.addEventListener('abort', () => controller.abort());
    }

    let isClosed = false;

    (async () => {
      try {
        const res = await fetch(url, {
          method: 'GET',
          headers: getHeaders(),
          signal: controller.signal,
        });

        if (!res.ok) {
          const errJson = await res.json().catch(() => null);
          const errMsg = errJson?.message || `HTTP ${res.status} ${res.statusText}`;
          throw new Error(errMsg);
        }

        if (!res.body) {
          throw new Error('Response body is not a ReadableStream');
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';

        while (!isClosed) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split('\n\n');
          buffer = parts.pop() || '';

          for (const block of parts) {
            if (!block.trim()) continue;
            let eventType = 'message';
            let dataStr = '';

            const lines = block.split('\n');
            for (const line of lines) {
              if (line.startsWith('event:')) {
                eventType = line.slice(6).trim();
              } else if (line.startsWith('data:')) {
                dataStr += line.slice(5).trim();
              }
            }

            try {
              const parsedData = dataStr ? JSON.parse(dataStr) : null;
              if (typeof onEvent === 'function') {
                onEvent(eventType, parsedData);
              }
            } catch {
              if (typeof onEvent === 'function') {
                onEvent(eventType, dataStr);
              }
            }
          }
        }
      } catch (err) {
        if (err.name === 'AbortError' || isClosed) return;
        console.warn('[telemetryService] streamLogs connection error:', err.message);
        if (typeof onError === 'function') {
          onError(err);
        }
      }
    })();

    return () => {
      isClosed = true;
      controller.abort();
    };
  },

  async getMetricsHistory(params = {}, options = {}) {
    try {
      const {
        serviceId,
        podId,
        clusterId,
        range,
        startTime,
        endTime,
        page = 1,
        limit = 50,
        cursor,
        order = 'desc',
      } = params;

      const queryParams = new URLSearchParams();
      if (range) queryParams.set('range', range);
      if (startTime) queryParams.set('start_time', startTime);
      if (endTime) queryParams.set('end_time', endTime);
      if (page) queryParams.set('page', String(page));
      if (limit) queryParams.set('limit', String(limit));
      if (cursor) queryParams.set('cursor', cursor);
      if (order) queryParams.set('order', order);
      if (podId) queryParams.set('pod_id', podId);
      if (clusterId) queryParams.set('cluster_id', clusterId);

      let endpoint = `${API_BASE_URL}/telemetry/metrics-history`;
      if (serviceId) {
        endpoint = `${API_BASE_URL}/telemetry/services/${encodeURIComponent(serviceId)}/metrics-history`;
      }

      const qs = queryParams.toString();
      const url = qs ? `${endpoint}?${qs}` : endpoint;

      const res = await fetch(url, {
        method: 'GET',
        headers: getHeaders(),
        signal: options?.signal,
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.message || `HTTP ${res.status}`);
      }
      const json = await res.json();
      return json.data;
    } catch (err) {
      if (err?.name === 'AbortError') throw err;
      console.warn('[telemetryService] getMetricsHistory fallback:', err.message);
      throw err;
    }
  },

  /**
   * Fetch cluster-scoped CPU & RAM resource time series trend
   * Queries real node_metrics across cluster nodes, falling back to APM service sequence.
   * @param {Object} params - { orgId, clusterId, range, activeServiceId }
   * @param {Object} [options] - { signal }
   */
  async getClusterResourceTrend(params = {}, options = {}) {
    const { orgId, clusterId, range = '15m', activeServiceId = 'sme-order-service' } = params;
    const durationMsMap = {
      '15m': 15 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '6h': 6 * 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
    };
    const durationMs = durationMsMap[range] || durationMsMap['15m'];
    const limitMap = { '15m': 180, '1h': 360, '6h': 720, '24h': 1440 };
    const limit = limitMap[range] || 180;
    const nowMs = Date.now();
    const fromIso = new Date(nowMs - durationMs).toISOString();
    const toIso = new Date(nowMs).toISOString();

    // 1. First attempt: query real host/node metrics for the cluster
    if (clusterId && !clusterId.startsWith('org-') && !clusterId.startsWith('sandbox-')) {
      try {
        const nodeRes = await this.getNodeMetrics(
          {
            orgId,
            clusterId,
            from: fromIso,
            to: toIso,
            limit,
            order: 'asc',
          },
          { signal: options?.signal }
        );

        const items = Array.isArray(nodeRes?.items) ? nodeRes.items : [];
        if (items.length > 0) {
          const bucketSec = range === '15m' ? 5 : range === '1h' ? 60 : range === '6h' ? 300 : 900;
          const pointsByBucket = new Map();

          for (let i = 0; i < items.length; i++) {
            const row = items[i];
            const d = new Date(row.collected_at || '');
            if (isNaN(d.getTime())) continue;

            const bucketKey = Math.floor(d.getTime() / (bucketSec * 1000)) * bucketSec;
            const existing = pointsByBucket.get(bucketKey) || {
              epochSec: bucketKey,
              date: new Date(bucketKey * 1000),
              cpuSum: 0,
              ramSum: 0,
              rawRamMbSum: 0,
              diskSum: 0,
              count: 0,
            };

            existing.cpuSum += Number(row.cpu_usage_percent || 0);
            existing.ramSum += Number(row.ram_usage_percent || 0);
            const ramMb = row.ram_used_bytes ? Number(row.ram_used_bytes) / (1024 * 1024) : 0;
            existing.rawRamMbSum += ramMb;
            existing.diskSum += Number(row.disk_usage_percent || 0);
            existing.count += 1;
            pointsByBucket.set(bucketKey, existing);
          }

          const sortedKeys = Array.from(pointsByBucket.keys()).sort((a, b) => a - b);
          const sequence = sortedKeys.map((k) => {
            const p = pointsByBucket.get(k);
            const c = p.count || 1;
            const t = p.date;
            return {
              time_bucket: t.toISOString(),
              time: t.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
              fullTime: `${t.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} (${t.toLocaleDateString('vi-VN')})`,
              cpu: Math.round((p.cpuSum / c) * 100) / 100,
              ram: Math.round((p.ramSum / c) * 100) / 100,
              rawRamMb: Math.round((p.rawRamMbSum / c) * 10) / 10,
              disk: Math.round((p.diskSum / c) * 10) / 10,
              latency: 0,
            };
          });

          if (sequence.length > 0) {
            const latestItem = items[items.length - 1];
            const latestTime = new Date(latestItem.collected_at).getTime();
            const isStale = (Date.now() - latestTime) > (5 * 60 * 1000);

            return {
              sequence,
              latestPoint: sequence[sequence.length - 1],
              isStale,
              source: 'node_metrics',
            };
          }
        }
      } catch (err) {
        if (err?.name === 'AbortError') throw err;
        console.warn('[telemetryService] getNodeMetrics failed in getClusterResourceTrend:', err.message);
      }
    }

    // 2. Fallback: query APM service metrics sequence for the cluster
    try {
      const bucketSeconds = range === '15m' ? 5 : range === '1h' ? 60 : range === '6h' ? 300 : 900;
      const seq = await this.getMetricsSequence(activeServiceId, {
        limit: Math.min(100, limit),
        bucket_seconds: bucketSeconds,
        cluster_id: clusterId,
        signal: options?.signal,
      });

      if (Array.isArray(seq) && seq.length > 0) {
        const latestTime = seq[seq.length - 1]?.time_bucket
          ? new Date(seq[seq.length - 1].time_bucket).getTime()
          : Date.now();
        const isStale = (Date.now() - latestTime) > (5 * 60 * 1000);

        return {
          sequence: seq,
          latestPoint: seq[seq.length - 1],
          isStale,
          source: 'agent_metrics',
        };
      }
    } catch (err) {
      if (err?.name === 'AbortError') throw err;
      console.warn('[telemetryService] getMetricsSequence fallback error:', err.message);
    }

    return {
      sequence: [],
      latestPoint: null,
      isStale: false,
      source: 'none',
    };
  },

  /**
   * Subscribe to live WebSocket telemetry stream (100% Push Protocol)
   * @param {string} serviceId
   * @param {Function} onMessage - Callback receives parsed WebSocket JSON messages
   * @param {Function} onStatusChange - Callback receives (isConnected: boolean)
   * @returns {Function} cleanup / unsubscribe function
   */
  subscribeWebSocket(serviceId = 'sme-order-service', onMessage, onStatusChange, clusterId = null) {
    let ws = null;
    let reconnectTimeout = null;
    let isClosedExplicitly = false;

    const connect = () => {
      if (isClosedExplicitly) return;
      try {
        const isSecure = window.location.protocol === 'https:';
        const protocol = isSecure ? 'wss:' : 'ws:';
        // Connect to port 5000 if running locally on port 3000, else window.location.host
        let host = window.location.host;
        if (window.location.port === '3000' || window.location.port === '3001') {
          host = `${window.location.hostname}:5000`;
        }
        const token =
          getAuthToken() ||
          localStorage.getItem('selfheal_auth_token') ||
          localStorage.getItem('token');
        const tokenParam = token ? `&token=${encodeURIComponent(token)}` : '';
        const clusterParam = clusterId ? `&cluster_id=${encodeURIComponent(clusterId)}` : '';
        const wsUrl = `${protocol}//${host}/api/v1/telemetry/ws?service_id=${serviceId}${clusterParam}${tokenParam}`;

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

export default telemetryService;
