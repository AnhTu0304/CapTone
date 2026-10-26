/**
 * @file apmChartUtils.js
 * @description Pure data transformation, percentile computation, formatting, and
 * extrema-preserving utilities for APM (Application Performance Monitoring)
 * using `lightweight-charts` v5.2.1.
 */

export const APM_TIME_RANGE_PRESETS = [
  { id: '5m', label: '5 phút', durationMs: 5 * 60 * 1000, bucketSeconds: 5, limit: 60, maxChartPoints: 60 },
  { id: '15m', label: '15 phút', durationMs: 15 * 60 * 1000, bucketSeconds: 5, limit: 180, maxChartPoints: 180 },
  { id: '1h', label: '1 giờ', durationMs: 60 * 60 * 1000, bucketSeconds: 15, limit: 240, maxChartPoints: 240 },
  { id: '24h', label: '24 giờ', durationMs: 24 * 60 * 60 * 1000, bucketSeconds: 300, limit: 288, maxChartPoints: 288 },
  { id: '7d', label: '7 ngày', durationMs: 7 * 24 * 60 * 60 * 1000, bucketSeconds: 1800, limit: 336, maxChartPoints: 336 },
];

export const APM_STALE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Sanitize numeric values, rejecting NaN/Infinity and clamping to [min, max]
 */
export function sanitizeNumber(value, fallback = 0, min = 0, max = Number.MAX_SAFE_INTEGER) {
  if (value === null || value === undefined || value === '') return fallback;
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) return fallback;
  if (num < min) return min;
  if (num > max) return max;
  return num;
}

/**
 * Convert ISO timestamp string, Date, or epoch number to Unix seconds (integer).
 */
export function toUnixSeconds(input) {
  if (input === null || input === undefined || input === '') return null;
  if (typeof input === 'number') {
    if (!Number.isFinite(input) || input <= 0) return null;
    return input > 1e11 ? Math.floor(input / 1000) : Math.floor(input);
  }
  const ms = input instanceof Date ? input.getTime() : Date.parse(String(input));
  if (!Number.isFinite(ms) || ms <= 0) return null;
  return Math.floor(ms / 1000);
}

/**
 * Format Unix seconds for chart axis and tooltips
 */
export function formatUnixTime(unixSec, includeDate = false) {
  if (typeof unixSec !== 'number' || !Number.isFinite(unixSec)) return '';
  const d = new Date(unixSec * 1000);
  if (includeDate) {
    return d.toLocaleString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      day: '2-digit',
      month: '2-digit',
    });
  }
  return d.toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/**
 * Format latency / response time in ms or seconds
 */
export function formatLatency(ms, decimals = 1) {
  if (ms === null || ms === undefined || ms === '') return '--';
  const val = sanitizeNumber(ms, null, 0);
  if (val === null) return '--';
  if (val >= 1000) {
    return `${(val / 1000).toFixed(decimals)} s`;
  }
  return `${val.toFixed(decimals)} ms`;
}

/**
 * Format throughput (RPS - Requests per second)
 */
export function formatRps(rps, decimals = 1) {
  if (rps === null || rps === undefined || rps === '') return '--';
  const val = sanitizeNumber(rps, null, 0);
  if (val === null) return '--';
  if (val >= 1000000) {
    return `${(val / 1000000).toFixed(decimals)}M req/s`;
  }
  if (val >= 1000) {
    return `${(val / 1000).toFixed(decimals)}k req/s`;
  }
  return `${val.toFixed(decimals)} req/s`;
}

/**
 * Format error rate percentage
 */
export function formatErrorRate(rate, decimals = 2) {
  if (rate === null || rate === undefined || rate === '') return '--';
  const val = sanitizeNumber(rate, null, 0, 100);
  if (val === null) return '--';
  return `${val.toFixed(decimals)}%`;
}

/**
 * Format availability percentage (SLO)
 */
export function formatAvailability(avail, decimals = 2) {
  if (avail === null || avail === undefined || avail === '') return '--';
  const val = sanitizeNumber(avail, null, 0, 100);
  if (val === null) return '--';
  return `${val.toFixed(decimals)}%`;
}

/**
 * Calculate percentile value from an array of numbers using linear interpolation
 * @param {Array<number>} values - Array of numeric samples
 * @param {number} p - Percentile between 0 and 100 (e.g. 50, 95, 99)
 * @returns {number|null}
 */
export function calculatePercentile(values, p = 95) {
  if (!Array.isArray(values) || values.length === 0) return null;
  const sorted = [...values].filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  if (sorted.length === 1) return sorted[0];

  const index = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;

  if (upper >= sorted.length) return sorted[sorted.length - 1];
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

/**
 * Health status classifier based on APM SLO metrics
 */
export function getServiceHealthStatus(errorRate, avgLatency) {
  if (
    errorRate === null ||
    errorRate === undefined ||
    avgLatency === null ||
    avgLatency === undefined
  ) {
    return {
      status: 'UNKNOWN',
      label: 'Chưa có dữ liệu',
      color: '#64748B',
      bg: '#F8FAFC',
      border: '#CBD5E1',
    };
  }
  if (errorRate >= 5 || avgLatency >= 2000) {
    return {
      status: 'CRITICAL',
      label: 'Nguy hiểm',
      color: '#EF4444',
      bg: '#FEF2F2',
      border: '#FCA5A5',
    };
  }
  if (errorRate >= 1 || avgLatency >= 800) {
    return {
      status: 'WARNING',
      label: 'Cảnh báo',
      color: '#F59E0B',
      bg: '#FFFBEB',
      border: '#FDE68A',
    };
  }
  return {
    status: 'HEALTHY',
    label: 'Khỏe mạnh',
    color: '#10B981',
    bg: '#ECFDF5',
    border: '#A7F3D0',
  };
}

/**
 * Downsample series preserving first, last, and extrema
 */
export function downsampleApmSeries(points, maxPoints = 240) {
  if (!Array.isArray(points)) return [];
  const len = points.length;
  if (len <= maxPoints || maxPoints < 4) return points;

  const bucketCount = Math.max(1, Math.floor((maxPoints - 2) / 2));
  const innerPoints = points.slice(1, len - 1);
  const bucketSize = innerPoints.length / bucketCount;

  const sampled = [points[0]];

  for (let b = 0; b < bucketCount; b++) {
    const startIdx = Math.floor(b * bucketSize);
    const endIdx = Math.min(innerPoints.length, Math.floor((b + 1) * bucketSize));
    if (startIdx >= endIdx) continue;

    let minPoint = innerPoints[startIdx];
    let maxPoint = innerPoints[startIdx];

    for (let i = startIdx + 1; i < endIdx; i++) {
      const p = innerPoints[i];
      if (p.value < minPoint.value) minPoint = p;
      if (p.value > maxPoint.value) maxPoint = p;
    }

    if (minPoint.time === maxPoint.time) {
      sampled.push(minPoint);
    } else if (minPoint.time < maxPoint.time) {
      sampled.push(minPoint, maxPoint);
    } else {
      sampled.push(maxPoint, minPoint);
    }
  }

  sampled.push(points[len - 1]);

  // Ensure strictly ascending unique time
  const dedup = [];
  let lastTime = -1;
  for (let i = 0; i < sampled.length; i++) {
    if (sampled[i].time > lastTime) {
      dedup.push(sampled[i]);
      lastTime = sampled[i].time;
    }
  }
  return dedup;
}

/**
 * Transform raw backend sequence points into lightweight-charts series & KPI summary
 * @param {Array<Object>} sequence - Array of raw metric points from backend
 * @param {Object} [options]
 * @param {number} [options.maxPoints=240]
 * @param {number} [options.nowMs=Date.now()]
 */
export function transformApmMetricsForCharts(sequence = [], options = {}) {
  const {
    maxPoints = 240,
    nowMs = Date.now(),
    bucketSeconds = 5,
    staleThresholdMs = Math.max(
      APM_STALE_THRESHOLD_MS,
      (Number(bucketSeconds) || 5) * 1000 + APM_STALE_THRESHOLD_MS
    ),
  } = options;

  if (!Array.isArray(sequence) || sequence.length === 0) {
    return {
      latencySeries: [],
      throughputSeries: [],
      errorRateSeries: [],
      cpuSeries: [],
      ramSeries: [],
      samples: [],
      byTimeMap: new Map(),
      latestSample: null,
      summary: {
        rawCount: 0,
        plottedCount: 0,
        isStale: false,
        latency: { current: null, avg: null, max: null, p50: null, p95: null, p99: null },
        throughput: { current: null, avg: null, max: null },
        errorRate: { current: null, avg: null, max: null },
        availability: null,
        replicas: null,
        restarts: null,
        health: getServiceHealthStatus(null, null),
      },
    };
  }

  // 1. Deduplicate by Unix seconds timestamp
  const dedupMap = new Map();
  for (let i = 0; i < sequence.length; i++) {
    const raw = sequence[i];
    if (!raw || typeof raw !== 'object') continue;

    const timeSec = toUnixSeconds(raw.time_bucket ?? raw.collected_at ?? raw.time ?? raw.timestamp);
    if (timeSec === null) continue;

    dedupMap.set(timeSec, raw);
  }

  // 2. Sort strictly ascending by time (Unix seconds)
  const sortedTimes = Array.from(dedupMap.keys()).sort((a, b) => a - b);

  const rawLatency = [];
  const rawThroughput = [];
  const rawErrorRate = [];
  const rawCpu = [];
  const rawRam = [];
  const samples = [];
  const byTimeMap = new Map();

  const latencyValues = [];
  let latencySum = 0;
  let latencyMax = 0;

  let throughputSum = 0;
  let throughputMax = 0;

  let errorRateSum = 0;
  let errorRateMax = 0;

  let totalRestarts = 0;

  for (let i = 0; i < sortedTimes.length; i++) {
    const time = sortedTimes[i];
    const raw = dedupMap.get(time);

    const lat = sanitizeNumber(raw.latency, 0, 0);
    const rps = sanitizeNumber(raw.request_rate, 0, 0);
    const errRate = sanitizeNumber(raw.http_5xx_rate, 0, 0, 100);
    const cpu = sanitizeNumber(raw.cpu, 0, 0, 100);
    const ram = sanitizeNumber(raw.ram, 0, 0, 100);
    const replicas = Math.max(1, Math.round(sanitizeNumber(raw.replica_count, 1, 1)));
    const restarts = Math.max(0, Math.round(sanitizeNumber(raw.pod_restart_count, 0, 0)));

    rawLatency.push({ time, value: Math.round(lat * 10) / 10 });
    rawThroughput.push({ time, value: Math.round(rps * 10) / 10 });
    rawErrorRate.push({ time, value: Math.round(errRate * 100) / 100 });
    rawCpu.push({ time, value: Math.round(cpu * 10) / 10 });
    rawRam.push({ time, value: Math.round(ram * 10) / 10 });

    latencyValues.push(lat);
    latencySum += lat;
    if (lat > latencyMax) latencyMax = lat;

    throughputSum += rps;
    if (rps > throughputMax) throughputMax = rps;

    errorRateSum += errRate;
    if (errRate > errorRateMax) errorRateMax = errRate;

    totalRestarts += restarts;

    const sample = {
      time,
      latency: lat,
      request_rate: rps,
      http_5xx_rate: errRate,
      cpu,
      ram,
      replica_count: replicas,
      pod_restart_count: restarts,
    };
    samples.push(sample);
    byTimeMap.set(time, sample);
  }

  // 3. Downsample for chart panels
  const latencySeries = downsampleApmSeries(rawLatency, maxPoints);
  const throughputSeries = downsampleApmSeries(rawThroughput, maxPoints);
  const errorRateSeries = downsampleApmSeries(rawErrorRate, maxPoints);
  const cpuSeries = downsampleApmSeries(rawCpu, maxPoints);
  const ramSeries = downsampleApmSeries(rawRam, maxPoints);

  const count = samples.length;
  const latestSample = count > 0 ? samples[count - 1] : null;
  const latestAgeMs = latestSample ? Math.max(0, nowMs - latestSample.time * 1000) : 0;
  const isStale = Boolean(latestSample && latestAgeMs > staleThresholdMs);

  const avgLat = count > 0 ? Math.round((latencySum / count) * 10) / 10 : 0;
  const avgThroughput = count > 0 ? Math.round((throughputSum / count) * 10) / 10 : 0;
  const avgError = count > 0 ? Math.round((errorRateSum / count) * 100) / 100 : 0;
  const availability = Math.max(0, Math.min(100, Math.round((100 - avgError) * 100) / 100));

  const p50 = calculatePercentile(latencyValues, 50);
  const p95 = calculatePercentile(latencyValues, 95);
  const p99 = calculatePercentile(latencyValues, 99);

  return {
    latencySeries,
    throughputSeries,
    errorRateSeries,
    cpuSeries,
    ramSeries,
    samples,
    byTimeMap,
    latestSample,
    summary: {
      rawCount: count,
      plottedCount: latencySeries.length,
      isStale,
      latency: {
        current: latestSample ? latestSample.latency : null,
        avg: avgLat,
        max: count > 0 ? Math.round(latencyMax * 10) / 10 : null,
        p50: p50 !== null ? Math.round(p50 * 10) / 10 : null,
        p95: p95 !== null ? Math.round(p95 * 10) / 10 : null,
        p99: p99 !== null ? Math.round(p99 * 10) / 10 : null,
      },
      throughput: {
        current: latestSample ? latestSample.request_rate : null,
        avg: avgThroughput,
        max: count > 0 ? Math.round(throughputMax * 10) / 10 : null,
      },
      errorRate: {
        current: latestSample ? latestSample.http_5xx_rate : null,
        avg: avgError,
        max: count > 0 ? Math.round(errorRateMax * 100) / 100 : null,
      },
      availability,
      replicas: latestSample ? latestSample.replica_count : null,
      restarts: count > 0 ? totalRestarts : null,
      health: getServiceHealthStatus(avgError, avgLat),
    },
  };
}
