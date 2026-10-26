/**
 * @file nodeMetricsChartUtils.js
 * @description Pure data transformation, sanitization, unit formatting, and extrema-preserving
 * downsampling utilities for Node Metrics Dashboard (`lightweight-charts` v5.2.1).
 *
 * Key invariants enforced:
 * 1. `UTCTimestamp` is strictly in integer seconds (`Math.floor(ms / 1000)`).
 * 2. Series arrays are strictly ascending by `time` with unique timestamps (duplicates deduplicated).
 * 3. `NaN`, `Infinity`, `-Infinity`, `null`, and `undefined` values are sanitized or filtered out.
 * 4. Disk percentage per mount point is extracted from `disk_filesystems` without summing percentages.
 * 5. Network I/O throughput plots `net_rx_bytes_per_sec` and `net_tx_bytes_per_sec` (rates),
 *    never plotting cumulative `net_rx_bytes` / `net_tx_bytes` counters as throughput.
 */

export const TIME_RANGE_PRESETS = [
  { id: '5m', label: '5 phút', durationMs: 5 * 60 * 1000, limit: 300, maxChartPoints: 120 },
  { id: '15m', label: '15 phút', durationMs: 15 * 60 * 1000, limit: 600, maxChartPoints: 200 },
  { id: '1h', label: '1 giờ', durationMs: 60 * 60 * 1000, limit: 1500, maxChartPoints: 360 },
  { id: '6h', label: '6 giờ', durationMs: 6 * 60 * 60 * 1000, limit: 3000, maxChartPoints: 360 },
  { id: '24h', label: '24 giờ', durationMs: 24 * 60 * 60 * 1000, limit: 6000, maxChartPoints: 400 },
];

export const STALE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Convert ISO timestamp string, Date, or epoch number into integer Unix seconds (`UTCTimestamp`).
 * Returns `null` if invalid.
 * @param {string|number|Date} input
 * @returns {number|null}
 */
export function toUnixSeconds(input) {
  if (input === null || input === undefined || input === '') return null;
  if (typeof input === 'number') {
    if (!Number.isFinite(input) || input <= 0) return null;
    // Detect milliseconds vs seconds (timestamps > year 2286 in seconds are ms)
    return input > 1e11 ? Math.floor(input / 1000) : Math.floor(input);
  }
  const ms = input instanceof Date ? input.getTime() : Date.parse(String(input));
  if (!Number.isFinite(ms) || ms <= 0) return null;
  return Math.floor(ms / 1000);
}

/**
 * Sanitize numeric value, rejecting NaN / Infinity and clamping to [min, max].
 * @param {any} value
 * @param {number} [fallback=0]
 * @param {number} [min=0]
 * @param {number} [max=Number.MAX_SAFE_INTEGER]
 * @returns {number}
 */
export function sanitizeNumber(value, fallback = 0, min = 0, max = Number.MAX_SAFE_INTEGER) {
  if (value === null || value === undefined || value === '' || typeof value === 'boolean') {
    return fallback;
  }
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return fallback;
  }
  if (num < min) return min;
  if (num > max) return max;
  return num;
}

/**
 * Check if a raw value is a valid finite number (or numeric string).
 * @param {any} value
 * @returns {boolean}
 */
export function isFiniteMetricValue(value) {
  if (value === null || value === undefined || value === '' || typeof value === 'boolean') {
    return false;
  }
  return Number.isFinite(Number(value));
}

/**
 * Format raw byte count into human-readable binary units (B, KiB, MiB, GiB, TiB).
 * @param {number|string} bytes
 * @param {number} [decimals=1]
 * @returns {string}
 */
export function formatBytes(bytes, decimals = 1) {
  const safe = sanitizeNumber(bytes, 0, 0);
  if (safe === 0) return '0 B';
  const k = 1024;
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(safe) / Math.log(k)));
  const val = safe / Math.pow(k, i);
  return `${val.toFixed(i === 0 ? 0 : decimals)} ${units[i]}`;
}

/**
 * Format network throughput rate (bytes/sec) into human-readable units (B/s, KiB/s, MiB/s, GiB/s).
 * @param {number|string} bytesPerSec
 * @param {number} [decimals=1]
 * @returns {string}
 */
export function formatThroughput(bytesPerSec, decimals = 1) {
  const safe = sanitizeNumber(bytesPerSec, 0, 0);
  if (safe === 0) return '0 B/s';
  const k = 1024;
  const units = ['B/s', 'KiB/s', 'MiB/s', 'GiB/s'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(safe) / Math.log(k)));
  const val = safe / Math.pow(k, i);
  return `${val.toFixed(i === 0 ? 0 : decimals)} ${units[i]}`;
}

/**
 * Format percentage [0..100] with fixed decimals.
 * @param {number|string} percent
 * @param {number} [decimals=1]
 * @returns {string}
 */
export function formatPercent(percent, decimals = 1) {
  const safe = sanitizeNumber(percent, 0, 0, 100);
  return `${safe.toFixed(decimals)}%`;
}

/**
 * Build ISO time range bounds `{ from, to, limit, maxChartPoints }` for a preset key.
 * @param {string} rangeId
 * @param {number} [nowMs=Date.now()]
 */
export function buildTimeRangeBounds(rangeId = '15m', nowMs = Date.now()) {
  const preset = TIME_RANGE_PRESETS.find((p) => p.id === rangeId) || TIME_RANGE_PRESETS[1];
  const toDate = new Date(nowMs);
  const fromDate = new Date(nowMs - preset.durationMs);
  return {
    rangeId: preset.id,
    label: preset.label,
    from: fromDate.toISOString(),
    to: toDate.toISOString(),
    limit: preset.limit,
    maxChartPoints: preset.maxChartPoints,
  };
}

/**
 * Extract unique filesystem mount points from raw node_metrics items.
 * @param {Array<Object>} rawItems
 * @returns {Array<string>} e.g. ['ALL', '/', '/var/lib/docker']
 */
export function extractAvailableFilesystems(rawItems = []) {
  if (!Array.isArray(rawItems) || rawItems.length === 0) return ['ALL'];
  const mounts = new Set(['ALL']);
  for (let i = 0; i < rawItems.length; i++) {
    const fsList = rawItems[i]?.disk_filesystems;
    if (Array.isArray(fsList)) {
      for (let j = 0; j < fsList.length; j++) {
        const mp = fsList[j]?.mount_point;
        if (typeof mp === 'string' && mp.trim() !== '') {
          mounts.add(mp.trim());
        }
      }
    }
  }
  return Array.from(mounts);
}

/**
 * Extrema-preserving Min-Max bucket downsampling for `lightweight-charts` series.
 * Guarantees:
 * - Strictly ascending unique `time` values.
 * - First point and last point are always preserved.
 * - Both minimum and maximum values in each bucket are retained in chronological order
 *   so spikes/anomalies are never flattened.
 *
 * @param {Array<{time: number, value: number}>} points - Ascending unique time-series points
 * @param {number} [maxPoints=360] - Target maximum number of points
 * @returns {Array<{time: number, value: number}>}
 */
export function downsampleSeries(points, maxPoints = 360) {
  if (!Array.isArray(points)) return [];
  const len = points.length;
  if (len <= maxPoints || maxPoints < 4) {
    return points;
  }

  // Each bucket contributes up to 2 points (min and max in chronological order)
  const bucketCount = Math.max(1, Math.floor((maxPoints - 2) / 2));
  const interiorLen = len - 2;
  const bucketSize = interiorLen / bucketCount;

  const result = [points[0]];

  for (let b = 0; b < bucketCount; b++) {
    const startIdx = 1 + Math.floor(b * bucketSize);
    const endIdx = Math.min(len - 1, Math.max(startIdx + 1, 1 + Math.floor((b + 1) * bucketSize)));

    let minPoint = points[startIdx];
    let maxPoint = points[startIdx];

    for (let i = startIdx + 1; i < endIdx; i++) {
      const pt = points[i];
      if (pt.value < minPoint.value) minPoint = pt;
      if (pt.value > maxPoint.value) maxPoint = pt;
    }

    if (minPoint.time === maxPoint.time) {
      if (result[result.length - 1].time < minPoint.time) {
        result.push(minPoint);
      }
    } else if (minPoint.time < maxPoint.time) {
      if (result[result.length - 1].time < minPoint.time) {
        result.push(minPoint);
      }
      if (result[result.length - 1].time < maxPoint.time) {
        result.push(maxPoint);
      }
    } else {
      if (result[result.length - 1].time < maxPoint.time) {
        result.push(maxPoint);
      }
      if (result[result.length - 1].time < minPoint.time) {
        result.push(minPoint);
      }
    }
  }

  const lastPoint = points[len - 1];
  if (result[result.length - 1].time < lastPoint.time) {
    result.push(lastPoint);
  }

  return result;
}

/**
 * Resolve Disk metrics for a single sample based on selected `mountPoint`.
 * Never sums percentages across filesystems.
 * @param {Object} raw
 * @param {string} mountPoint
 */
function resolveDiskMetricsForSample(raw, mountPoint = 'ALL') {
  const fsList = Array.isArray(raw?.disk_filesystems) ? raw.disk_filesystems : [];
  if (mountPoint && mountPoint !== 'ALL' && fsList.length > 0) {
    const matched = fsList.find((fs) => fs && fs.mount_point === mountPoint);
    if (matched) {
      const totalBytes = sanitizeNumber(matched.total_bytes, 0, 0);
      const usedBytes = sanitizeNumber(matched.used_bytes, 0, 0, totalBytes || Number.MAX_SAFE_INTEGER);
      const availableBytes = sanitizeNumber(
        matched.available_bytes ?? Math.max(0, totalBytes - usedBytes),
        0,
        0
      );
      const usagePercent = isFiniteMetricValue(matched.usage_percent)
        ? sanitizeNumber(matched.usage_percent, 0, 0, 100)
        : totalBytes > 0
          ? sanitizeNumber((usedBytes / totalBytes) * 100, 0, 0, 100)
          : 0;

      return {
        disk_total_bytes: totalBytes,
        disk_used_bytes: usedBytes,
        disk_available_bytes: availableBytes,
        disk_usage_percent: Math.round(usagePercent * 100) / 100,
        mount_point: matched.mount_point,
        device: matched.device || '',
        has_mount_data: true,
      };
    }
    return {
      disk_total_bytes: 0,
      disk_used_bytes: 0,
      disk_available_bytes: 0,
      disk_usage_percent: null,
      mount_point: mountPoint,
      device: '',
      has_mount_data: false,
    };
  }

  const totalBytes = sanitizeNumber(raw?.disk_total_bytes, 0, 0);
  const usedBytes = sanitizeNumber(raw?.disk_used_bytes, 0, 0);
  const availableBytes = sanitizeNumber(raw?.disk_available_bytes, 0, 0);
  const usagePercent = isFiniteMetricValue(raw?.disk_usage_percent)
    ? sanitizeNumber(raw.disk_usage_percent, 0, 0, 100)
    : totalBytes > 0
      ? sanitizeNumber((usedBytes / totalBytes) * 100, 0, 0, 100)
      : null;

  return {
    disk_total_bytes: totalBytes,
    disk_used_bytes: usedBytes,
    disk_available_bytes: availableBytes,
    disk_usage_percent: usagePercent !== null ? Math.round(usagePercent * 100) / 100 : null,
    mount_point: 'ALL',
    device: '',
    has_mount_data: usagePercent !== null,
  };
}

/**
 * Transform raw backend `node_metrics` rows into ascending, deduplicated, sanitized
 * `lightweight-charts` series and summary statistics.
 *
 * @param {Array<Object>} rawItems
 * @param {Object} [options]
 * @param {string} [options.mountPoint='ALL']
 * @param {number} [options.maxPoints=360]
 * @param {number} [options.nowMs=Date.now()]
 */
export function transformNodeMetricsForCharts(rawItems = [], options = {}) {
  const { mountPoint = 'ALL', maxPoints = 360, nowMs = Date.now() } = options;

  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    return {
      cpuSeries: [],
      ramSeries: [],
      diskSeries: [],
      netRxSeries: [],
      netTxSeries: [],
      samples: [],
      byTimeMap: new Map(),
      latestSample: null,
      filesystems: ['ALL'],
      summary: {
        rawCount: 0,
        plottedCount: 0,
        isStale: false,
        isPartial: false,
        cpu: { current: 0, avg: 0, max: 0, cores: 0 },
        ram: { currentPercent: 0, avgPercent: 0, maxPercent: 0, usedBytes: 0, availableBytes: 0, totalBytes: 0 },
        disk: { currentPercent: 0, avgPercent: 0, maxPercent: 0, usedBytes: 0, availableBytes: 0, totalBytes: 0, mountPoint },
        network: { currentRxPerSec: 0, currentTxPerSec: 0, maxRxPerSec: 0, maxTxPerSec: 0, totalRxBytes: 0, totalTxBytes: 0 },
      },
    };
  }

  const filesystems = extractAvailableFilesystems(rawItems);

  // 1. Parse timestamps, filter invalid rows, and deduplicate by Unix second `time`
  //    (when two rows share the same Unix second, keep the one with higher id / later index)
  const dedupMap = new Map();

  for (let i = 0; i < rawItems.length; i++) {
    const item = rawItems[i];
    if (!item || typeof item !== 'object') continue;

    const timeSec = toUnixSeconds(item.collected_at ?? item.timestamp ?? item.time);
    if (timeSec === null) continue;

    const existing = dedupMap.get(timeSec);
    if (existing) {
      const existingId = Number(existing.id) || 0;
      const candidateId = Number(item.id) || 0;
      if (candidateId >= existingId) {
        dedupMap.set(timeSec, item);
      }
    } else {
      dedupMap.set(timeSec, item);
    }
  }

  // 2. Sort strictly ascending by `time` (Unix seconds)
  const sortedTimes = Array.from(dedupMap.keys()).sort((a, b) => a - b);

  const cpuRawSeries = [];
  const ramRawSeries = [];
  const diskRawSeries = [];
  const netRxRawSeries = [];
  const netTxRawSeries = [];
  const samples = [];
  const byTimeMap = new Map();

  let cpuSum = 0;
  let cpuCount = 0;
  let cpuMax = 0;

  let ramSum = 0;
  let ramCount = 0;
  let ramMax = 0;

  let diskSum = 0;
  let diskCount = 0;
  let diskMax = 0;

  let netRxMax = 0;
  let netTxMax = 0;

  for (let i = 0; i < sortedTimes.length; i++) {
    const time = sortedTimes[i];
    const raw = dedupMap.get(time);

    const hasCpu = isFiniteMetricValue(raw.cpu_usage_percent);
    const cpuVal = hasCpu
      ? Math.round(sanitizeNumber(raw.cpu_usage_percent, 0, 0, 100) * 100) / 100
      : null;
    const cpuCores = Math.max(1, Math.round(sanitizeNumber(raw.cpu_cores, 1, 1, 1024)));

    const ramTotalBytes = sanitizeNumber(raw.ram_total_bytes, 0, 0);
    const ramUsedBytes = sanitizeNumber(raw.ram_used_bytes, 0, 0);
    const ramAvailBytes = sanitizeNumber(
      raw.ram_available_bytes ?? Math.max(0, ramTotalBytes - ramUsedBytes),
      0,
      0
    );
    const hasRamPct = isFiniteMetricValue(raw.ram_usage_percent) || ramTotalBytes > 0;
    const ramVal = isFiniteMetricValue(raw.ram_usage_percent)
      ? Math.round(sanitizeNumber(raw.ram_usage_percent, 0, 0, 100) * 100) / 100
      : ramTotalBytes > 0
        ? Math.round(sanitizeNumber((ramUsedBytes / ramTotalBytes) * 100, 0, 0, 100) * 100) / 100
        : null;

    const diskResolved = resolveDiskMetricsForSample(raw, mountPoint);

    const hasNetRx = isFiniteMetricValue(raw.net_rx_bytes_per_sec);
    const hasNetTx = isFiniteMetricValue(raw.net_tx_bytes_per_sec);
    const netRxPerSec = hasNetRx
      ? Math.round(sanitizeNumber(raw.net_rx_bytes_per_sec, 0, 0) * 100) / 100
      : null;
    const netTxPerSec = hasNetTx
      ? Math.round(sanitizeNumber(raw.net_tx_bytes_per_sec, 0, 0) * 100) / 100
      : null;
    const netRxBytes = sanitizeNumber(raw.net_rx_bytes, 0, 0);
    const netTxBytes = sanitizeNumber(raw.net_tx_bytes, 0, 0);

    if (cpuVal !== null) {
      cpuRawSeries.push({ time, value: cpuVal });
      cpuSum += cpuVal;
      cpuCount += 1;
      if (cpuVal > cpuMax) cpuMax = cpuVal;
    }

    if (ramVal !== null && hasRamPct) {
      ramRawSeries.push({ time, value: ramVal });
      ramSum += ramVal;
      ramCount += 1;
      if (ramVal > ramMax) ramMax = ramVal;
    }

    if (diskResolved.disk_usage_percent !== null) {
      diskRawSeries.push({ time, value: diskResolved.disk_usage_percent });
      diskSum += diskResolved.disk_usage_percent;
      diskCount += 1;
      if (diskResolved.disk_usage_percent > diskMax) diskMax = diskResolved.disk_usage_percent;
    }

    if (netRxPerSec !== null) {
      netRxRawSeries.push({ time, value: netRxPerSec });
      if (netRxPerSec > netRxMax) netRxMax = netRxPerSec;
    }

    if (netTxPerSec !== null) {
      netTxRawSeries.push({ time, value: netTxPerSec });
      if (netTxPerSec > netTxMax) netTxMax = netTxPerSec;
    }

    const normalizedSample = {
      id: raw.id,
      time,
      collected_at: raw.collected_at || new Date(time * 1000).toISOString(),
      node_id: raw.node_id || null,
      node_name: raw.node_name || 'unknown-node',
      cluster_id: raw.cluster_id || null,
      agent_id: raw.agent_id || null,
      cpu_usage_percent: cpuVal ?? 0,
      cpu_cores: cpuCores,
      ram_total_bytes: ramTotalBytes,
      ram_used_bytes: ramUsedBytes,
      ram_available_bytes: ramAvailBytes,
      ram_usage_percent: ramVal ?? 0,
      disk_total_bytes: diskResolved.disk_total_bytes,
      disk_used_bytes: diskResolved.disk_used_bytes,
      disk_available_bytes: diskResolved.disk_available_bytes,
      disk_usage_percent: diskResolved.disk_usage_percent ?? 0,
      disk_mount_point: diskResolved.mount_point,
      disk_filesystems: Array.isArray(raw.disk_filesystems) ? raw.disk_filesystems : [],
      net_rx_bytes: netRxBytes,
      net_tx_bytes: netTxBytes,
      net_rx_bytes_per_sec: netRxPerSec ?? 0,
      net_tx_bytes_per_sec: netTxPerSec ?? 0,
      collection_status: raw.collection_status || 'OK',
      collection_errors: raw.collection_errors || {},
    };

    samples.push(normalizedSample);
    byTimeMap.set(time, normalizedSample);
  }

  // 3. Apply extrema-preserving downsampling when dataset exceeds maxPoints
  const cpuSeries = downsampleSeries(cpuRawSeries, maxPoints);
  const ramSeries = downsampleSeries(ramRawSeries, maxPoints);
  const diskSeries = downsampleSeries(diskRawSeries, maxPoints);
  const netRxSeries = downsampleSeries(netRxRawSeries, maxPoints);
  const netTxSeries = downsampleSeries(netTxRawSeries, maxPoints);

  const latestSample = samples.length > 0 ? samples[samples.length - 1] : null;
  const latestAgeMs = latestSample ? Math.max(0, nowMs - latestSample.time * 1000) : 0;
  const isStale = Boolean(latestSample && latestAgeMs > STALE_THRESHOLD_MS);
  const isPartial = Boolean(
    latestSample &&
      (latestSample.collection_status === 'PARTIAL' ||
        latestSample.collection_status === 'FAILED' ||
        Object.keys(latestSample.collection_errors || {}).length > 0)
  );

  return {
    cpuSeries,
    ramSeries,
    diskSeries,
    netRxSeries,
    netTxSeries,
    samples,
    byTimeMap,
    latestSample,
    filesystems,
    summary: {
      rawCount: samples.length,
      plottedCount: Math.max(
        cpuSeries.length,
        ramSeries.length,
        diskSeries.length,
        netRxSeries.length
      ),
      isStale,
      isPartial,
      cpu: {
        current: latestSample ? latestSample.cpu_usage_percent : 0,
        avg: cpuCount > 0 ? Math.round((cpuSum / cpuCount) * 100) / 100 : 0,
        max: Math.round(cpuMax * 100) / 100,
        cores: latestSample ? latestSample.cpu_cores : 0,
      },
      ram: {
        currentPercent: latestSample ? latestSample.ram_usage_percent : 0,
        avgPercent: ramCount > 0 ? Math.round((ramSum / ramCount) * 100) / 100 : 0,
        maxPercent: Math.round(ramMax * 100) / 100,
        usedBytes: latestSample ? latestSample.ram_used_bytes : 0,
        availableBytes: latestSample ? latestSample.ram_available_bytes : 0,
        totalBytes: latestSample ? latestSample.ram_total_bytes : 0,
      },
      disk: {
        currentPercent: latestSample ? latestSample.disk_usage_percent : 0,
        avgPercent: diskCount > 0 ? Math.round((diskSum / diskCount) * 100) / 100 : 0,
        maxPercent: Math.round(diskMax * 100) / 100,
        usedBytes: latestSample ? latestSample.disk_used_bytes : 0,
        availableBytes: latestSample ? latestSample.disk_available_bytes : 0,
        totalBytes: latestSample ? latestSample.disk_total_bytes : 0,
        mountPoint,
      },
      network: {
        currentRxPerSec: latestSample ? latestSample.net_rx_bytes_per_sec : 0,
        currentTxPerSec: latestSample ? latestSample.net_tx_bytes_per_sec : 0,
        maxRxPerSec: Math.round(netRxMax * 100) / 100,
        maxTxPerSec: Math.round(netTxMax * 100) / 100,
        totalRxBytes: latestSample ? latestSample.net_rx_bytes : 0,
        totalTxBytes: latestSample ? latestSample.net_tx_bytes : 0,
      },
    },
  };
}
