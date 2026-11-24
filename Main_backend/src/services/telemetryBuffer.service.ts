import { IAgentMetric, MetricModel } from '../models/metric.model';
import { GRUMetricPoint } from '../schemas/ai.schema';
import { redisClient, isRedisReady } from '../config/redis';
import { pool } from '../config/database';

export interface RawTelemetryEntry {
  organization_id?: string | null;
  environment_id?: string | null;
  batch_id?: string | null;
  sample_id?: string | null;
  agent_id: string;
  cluster_id?: string | null;
  service_id: string;
  pod_id: string;
  cpu: number;
  ram: number;
  disk: number;
  request_rate: number;
  latency: number;
  http_5xx_rate: number;
  pod_restart_count: number;
  replica_count: number;
  collected_at: Date;
}

export interface TenantBufferTarget {
  organizationId: string;
  clusterId: string;
  serviceId: string;
  bufferKey: string;
  lastUpdatedAt: number;
}

/**
 * TelemetryBufferService (Phương án 2: In-Memory / Redis Ring Buffer)
 * 
 * Quản lý vòng đệm viễn trắc trượt hoàn toàn trong RAM và Redis.
 * - Khi hệ thống BÌNH THƯỜNG: Dữ liệu được lưu trong buffer RAM/Redis, KHÔNG ghi vào PostgreSQL (tiết kiệm đĩa, tránh bloat).
 * - Khi AI / GRU phát hiện SỰ CỐ: Trích xuất Snapshot 12 bước viễn trắc từ RAM và lưu vĩnh viễn vào PostgreSQL.
 */
export class TelemetryBufferService {
  // Bộ đệm trong RAM cho từng (organizationId, clusterId, serviceId): lưu tối đa 120 điểm (~10 phút đo)
  private static rawBuffers: Map<string, RawTelemetryEntry[]> = new Map();
  private static bufferLastUpdatedAt: Map<string, number> = new Map();
  private static activeServicesSet: Set<string> = new Set();
  private static readonly MAX_RAW_PER_SERVICE = 120;
  private static readonly MAX_ACTIVE_BUFFERS = 500;
  private static readonly STALE_BUFFER_TTL_MS = 30 * 60 * 1000;
  private static readonly UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  public static isValidTenantContext(
    organizationId?: string | null,
    clusterId?: string | null,
    serviceId?: string | null
  ): boolean {
    const org = typeof organizationId === 'string' ? organizationId.trim() : '';
    const cluster = typeof clusterId === 'string' ? clusterId.trim() : '';
    const svc = typeof serviceId === 'string' ? serviceId.trim() : '';
    if (!org || !this.UUID_REGEX.test(org)) return false;
    if (!cluster || cluster.toLowerCase() === 'all') return false;
    if (!svc) return false;
    return true;
  }

  public static buildBufferKey(
    serviceId: string,
    organizationId: string,
    clusterId: string
  ): string {
    return `${organizationId.trim().toLowerCase()}::${clusterId.trim()}::${serviceId.trim()}`;
  }

  public static parseBufferKey(
    bufferKey: string
  ): { organizationId: string; clusterId: string; serviceId: string } | null {
    const firstSep = bufferKey.indexOf('::');
    if (firstSep <= 0) return null;
    const secondSep = bufferKey.indexOf('::', firstSep + 2);
    if (secondSep <= firstSep + 2) return null;

    const organizationId = bufferKey.slice(0, firstSep).trim().toLowerCase();
    const clusterId = bufferKey.slice(firstSep + 2, secondSep).trim();
    const serviceId = bufferKey.slice(secondSep + 2).trim();

    if (!this.isValidTenantContext(organizationId, clusterId, serviceId)) {
      return null;
    }
    return { organizationId, clusterId, serviceId };
  }

  private static pruneStaleBuffers(nowMs: number = Date.now()): void {
    const cutoff = nowMs - this.STALE_BUFFER_TTL_MS;
    for (const [key] of this.rawBuffers.entries()) {
      const updatedAt = this.bufferLastUpdatedAt.get(key) ?? 0;
      if (updatedAt > 0 && updatedAt < cutoff) {
        this.rawBuffers.delete(key);
        this.bufferLastUpdatedAt.delete(key);
      }
    }

    if (this.rawBuffers.size > this.MAX_ACTIVE_BUFFERS) {
      const sorted = Array.from(this.rawBuffers.keys()).sort(
        (a, b) => (this.bufferLastUpdatedAt.get(a) ?? 0) - (this.bufferLastUpdatedAt.get(b) ?? 0)
      );
      const excess = this.rawBuffers.size - this.MAX_ACTIVE_BUFFERS;
      for (let i = 0; i < excess; i++) {
        this.rawBuffers.delete(sorted[i]);
        this.bufferLastUpdatedAt.delete(sorted[i]);
      }
    }
  }

  private static getMatchingBufferEntries(
    serviceId: string,
    organizationId?: string | null,
    clusterId?: string | null
  ): RawTelemetryEntry[] {
    if (!this.isValidTenantContext(organizationId, clusterId, serviceId)) {
      return [];
    }
    const exactKey = this.buildBufferKey(serviceId, organizationId!, clusterId!);
    return this.rawBuffers.get(exactKey) || [];
  }

  /**
   * Đẩy metric mới từ Agent vào bộ nhớ đệm RAM / Redis (tách biệt theo từng Tenant)
   */
  public static pushMetric(metric: IAgentMetric): void {
    if (!this.isValidTenantContext(metric?.organization_id, metric?.cluster_id, metric?.service_id)) {
      console.warn(
        `[TelemetryBuffer] Dropped metric with missing or invalid tenant context (org=${metric?.organization_id}, cluster=${metric?.cluster_id}, service=${metric?.service_id})`
      );
      return;
    }

    const organizationId = metric.organization_id!.trim().toLowerCase();
    const clusterId = metric.cluster_id!.trim();
    const serviceId = metric.service_id.trim();
    const collectedAt = metric.collected_at instanceof Date ? metric.collected_at : new Date(metric.collected_at);
    const nowMs = Date.now();

    const entry: RawTelemetryEntry = {
      organization_id: organizationId,
      environment_id: metric.environment_id || null,
      batch_id: metric.batch_id || null,
      sample_id: metric.sample_id || null,
      agent_id: metric.agent_id || 'agent-unknown',
      cluster_id: clusterId,
      service_id: serviceId,
      pod_id: metric.pod_id || 'pod-unknown',
      cpu: Number.isFinite(metric.cpu) ? metric.cpu : 0,
      ram: Number.isFinite(metric.ram) ? metric.ram : 0,
      disk: Number.isFinite(metric.disk) ? metric.disk : 0,
      request_rate: Number.isFinite(metric.request_rate) ? metric.request_rate : 0,
      latency: Number.isFinite(metric.latency) ? metric.latency : 0,
      http_5xx_rate: Number.isFinite(metric.http_5xx_rate) ? metric.http_5xx_rate : 0,
      pod_restart_count: Number.isInteger(metric.pod_restart_count) ? metric.pod_restart_count : 0,
      replica_count: Number.isInteger(metric.replica_count) && metric.replica_count > 0 ? metric.replica_count : 1,
      collected_at: collectedAt,
    };

    this.pruneStaleBuffers(nowMs);
    const bufferKey = this.buildBufferKey(serviceId, organizationId, clusterId);
    if (!this.rawBuffers.has(bufferKey)) {
      if (this.rawBuffers.size >= this.MAX_ACTIVE_BUFFERS) {
        const oldestKey = Array.from(this.rawBuffers.keys()).sort(
          (a, b) => (this.bufferLastUpdatedAt.get(a) ?? 0) - (this.bufferLastUpdatedAt.get(b) ?? 0)
        )[0];
        if (oldestKey) {
          this.rawBuffers.delete(oldestKey);
          this.bufferLastUpdatedAt.delete(oldestKey);
        }
      }
      this.rawBuffers.set(bufferKey, []);
    }

    const buf = this.rawBuffers.get(bufferKey)!;
    buf.push(entry);

    if (buf.length > this.MAX_RAW_PER_SERVICE) {
      buf.shift(); // FIFO: Tự động giải phóng bản ghi cũ nhất khỏi RAM
    }

    this.bufferLastUpdatedAt.set(bufferKey, nowMs);
    this.activeServicesSet.add(serviceId);

    // Gương sang Redis bất đồng bộ nếu Redis đang kết nối (không chặn luồng)
    if (isRedisReady()) {
      const redisKey = `telemetry:buffer:${bufferKey}`;
      redisClient
        .multi()
        .lpush(redisKey, JSON.stringify(entry))
        .ltrim(redisKey, 0, this.MAX_RAW_PER_SERVICE - 1)
        .expire(redisKey, 1800) // TTL 30 phút trong Redis
        .exec()
        .catch(() => {});
    }
  }

  /**
   * Lấy danh sách các buffer đang hoạt động theo đúng Tenant (organizationId, clusterId, serviceId)
   */
  public static async getActiveTenantBuffers(windowMinutes: number = 30): Promise<TenantBufferTarget[]> {
    this.pruneStaleBuffers();

    const targets: TenantBufferTarget[] = [];
    for (const [bufferKey, entries] of this.rawBuffers.entries()) {
      if (!entries || entries.length === 0) continue;
      const parsed = this.parseBufferKey(bufferKey);
      if (!parsed) continue;
      targets.push({
        organizationId: parsed.organizationId,
        clusterId: parsed.clusterId,
        serviceId: parsed.serviceId,
        bufferKey,
        lastUpdatedAt: this.bufferLastUpdatedAt.get(bufferKey) ?? 0,
      });
    }

    if (targets.length > 0) {
      return targets;
    }

    // Fallback nếu server vừa khởi động lại chưa có buffer trong RAM
    const dbTargets = await MetricModel.getActiveTenantServices(windowMinutes);
    return dbTargets
      .filter((t) => this.isValidTenantContext(t.organizationId, t.clusterId, t.serviceId))
      .map((t) => ({
        organizationId: t.organizationId.trim().toLowerCase(),
        clusterId: t.clusterId.trim(),
        serviceId: t.serviceId.trim(),
        bufferKey: this.buildBufferKey(t.serviceId, t.organizationId, t.clusterId),
        lastUpdatedAt: Date.now(),
      }));
  }

  /**
   * Lấy danh sách các service đang hoạt động (từ RAM và DB)
   */
  public static async getActiveServices(windowMinutes: number = 30): Promise<string[]> {
    const targets = await this.getActiveTenantBuffers(windowMinutes);
    if (targets.length > 0) {
      return Array.from(new Set(targets.map((t) => t.serviceId)));
    }
    return [];
  }

  /**
   * Gom nhóm dữ liệu thô trong RAM thành các time-bucket 5s chuẩn
   */
  private static computeBucketsFromMemory(
    serviceId: string,
    bucketSeconds: number = 5,
    organizationId?: string | null,
    clusterIdFilter?: string | null
  ): { buckets: GRUMetricPoint[]; clusterId?: string; organizationId?: string; latestTime?: Date } {
    const rawList = this.getMatchingBufferEntries(serviceId, organizationId, clusterIdFilter);
    if (rawList.length === 0) {
      return { buckets: [] };
    }

    // Kiểm tra an toàn đa tenant (TEL-07 / PIPE-04): tuyệt đối không gộp nhiều tổ chức hoặc nhiều cluster vào một batch
    const orgIds = new Set(
      rawList.map((i) => (typeof i.organization_id === 'string' ? i.organization_id.trim().toLowerCase() : '')).filter(Boolean)
    );
    const clusterIds = new Set(
      rawList.map((i) => (typeof i.cluster_id === 'string' ? i.cluster_id.trim() : '')).filter(Boolean)
    );
    const expectedOrgId = organizationId!.trim().toLowerCase();
    const expectedClusterId = clusterIdFilter!.trim();

    if (
      orgIds.size !== 1 ||
      clusterIds.size !== 1 ||
      !orgIds.has(expectedOrgId) ||
      !clusterIds.has(expectedClusterId)
    ) {
      console.warn(
        `[TelemetryBuffer] Rejected mixed-tenant or mismatched buffer for service=${serviceId} (orgs=${orgIds.size}, clusters=${clusterIds.size})`
      );
      return { buckets: [] };
    }
    const resolvedOrgId = expectedOrgId;

    // Group theo time-bucket 5 giây
    const bucketMap: Map<number, RawTelemetryEntry[]> = new Map();
    let clusterId: string | undefined = undefined;

    for (const item of rawList) {
      if (item.cluster_id && !clusterId) {
        clusterId = item.cluster_id;
      }
      const epochSec = Math.floor(item.collected_at.getTime() / 1000);
      const bucketEpoch = Math.floor(epochSec / bucketSeconds) * bucketSeconds;
      if (!bucketMap.has(bucketEpoch)) {
        bucketMap.set(bucketEpoch, []);
      }
      bucketMap.get(bucketEpoch)!.push(item);
    }

    const sortedEpochs = Array.from(bucketMap.keys()).sort((a, b) => a - b);
    const buckets: GRUMetricPoint[] = [];

    for (const epoch of sortedEpochs) {
      const items = bucketMap.get(epoch)!;
      let maxCpu = 0;
      let maxRam = 0;
      let maxDisk = 0;
      let sumReq = 0;
      let maxLatency = 0;
      let sum5xx = 0;
      let maxRestarts = 0;
      let maxReplicas = 1;
      const uniquePods = new Set<string>();

      for (const it of items) {
        if (it.cpu > maxCpu) maxCpu = it.cpu;
        if (it.ram > maxRam) maxRam = it.ram;
        if (it.disk > maxDisk) maxDisk = it.disk;
        sumReq += it.request_rate;
        if (it.latency > maxLatency) maxLatency = it.latency;
        sum5xx += it.http_5xx_rate;
        if (it.pod_restart_count > maxRestarts) maxRestarts = it.pod_restart_count;
        if (it.replica_count > maxReplicas) maxReplicas = it.replica_count;
        if (it.pod_id) uniquePods.add(it.pod_id);
      }

      // Chuẩn hóa RAM như trong SQL
      const normRam = maxRam > 100 ? Math.min(100, (maxRam / 512.0) * 100.0) : maxRam;

      buckets.push({
        time_bucket: new Date(epoch * 1000).toISOString(),
        cpu: Number(maxCpu.toFixed(2)),
        ram: Number(normRam.toFixed(2)),
        disk: Number(maxDisk.toFixed(2)),
        request_rate: Number(sumReq.toFixed(2)),
        latency: Number(maxLatency.toFixed(2)),
        http_5xx_rate: Number((sum5xx / items.length).toFixed(2)),
        pod_restart_count: maxRestarts,
        replica_count: Math.max(maxReplicas, uniquePods.size),
      });
    }

    const latestTime = sortedEpochs.length > 0 ? new Date(sortedEpochs[sortedEpochs.length - 1] * 1000) : undefined;
    return { buckets, clusterId, organizationId: resolvedOrgId, latestTime };
  }

  /**
   * Lấy chuỗi điểm hiển thị trên sơ đồ UI (12 điểm gần nhất)
   */
  public static async getDisplayPoints(
    serviceId: string,
    bucketSeconds: number = 5,
    limit: number = 12,
    organizationId?: string | null,
    clusterId?: string | null
  ): Promise<GRUMetricPoint[]> {
    if (!this.isValidTenantContext(organizationId, clusterId, serviceId)) {
      return [];
    }
    const { buckets } = this.computeBucketsFromMemory(serviceId, bucketSeconds, organizationId, clusterId);
    if (buckets.length > 0) {
      return buckets.slice(-limit);
    }
    // Fallback sang PostgreSQL theo đúng tenant nếu bộ nhớ chưa gom đủ
    return MetricModel.aggregateByService(serviceId, bucketSeconds, limit, {
      organizationId: organizationId!.trim().toLowerCase(),
      clusterId: clusterId!.trim(),
    });
  }

  /**
   * Lấy lô điểm mới tinh phát sinh sau mốc thời gian trước đó (Tumbling Batch)
   */
  public static async getFreshBatch(
    serviceId: string,
    bucketSeconds: number = 5,
    afterTimestamp?: Date | null,
    limit: number = 12,
    organizationId?: string | null,
    clusterIdFilter?: string | null
  ): Promise<{ points: GRUMetricPoint[]; latestTimeBucket?: Date; clusterId?: string; organizationId?: string }> {
    if (!this.isValidTenantContext(organizationId, clusterIdFilter, serviceId)) {
      return { points: [] };
    }
    const { buckets, clusterId, organizationId: resolvedOrgId, latestTime } = this.computeBucketsFromMemory(
      serviceId,
      bucketSeconds,
      organizationId,
      clusterIdFilter
    );

    if (buckets.length > 0) {
      let filtered = buckets;
      if (afterTimestamp) {
        const thresholdMs = afterTimestamp.getTime() + bucketSeconds * 1000;
        filtered = buckets.filter((b) => b.time_bucket && new Date(b.time_bucket).getTime() >= thresholdMs);
      }

      const batch = filtered.slice(0, limit);
      const latestTimeBucket = batch.length > 0 && batch[batch.length - 1].time_bucket
        ? new Date(batch[batch.length - 1].time_bucket!)
        : latestTime;
      return {
        points: batch,
        latestTimeBucket,
        clusterId,
        organizationId: resolvedOrgId,
      };
    }

    // Fallback sang PostgreSQL theo đúng tenant nếu RAM chưa có đủ
    return MetricModel.getFreshBatchByService(
      serviceId,
      bucketSeconds,
      afterTimestamp,
      limit,
      organizationId!.trim().toLowerCase(),
      clusterIdFilter!.trim()
    );
  }

  /**
   * LƯU SNAPSHOT KHI CÓ SỰ CỐ (Predict-First Persistence):
   * Chỉ khi AI hoặc Rule Engine phát hiện sự cố, hệ thống mới kết xuất đúng 12 điểm viễn trắc
   * từ RAM xuống cơ sở dữ liệu để lưu vết bằng chứng vĩnh viễn.
   */
  public static async persistIncidentSnapshot(
    incidentId: string,
    serviceId: string,
    snapshotPoints: GRUMetricPoint[]
  ): Promise<void> {
    if (!snapshotPoints || snapshotPoints.length === 0) return;

    try {
      console.log(`💾 [TelemetryBuffer] Persisting Incident Snapshot (${snapshotPoints.length} points) for Incident [${incidentId}] on service [${serviceId}] to PostgreSQL...`);

      // 1. Lưu dưới dạng JSON bằng chứng trong rca_evidences qua rca_analyses
      const rcaRes = await pool.query(
        `SELECT id FROM rca_analyses WHERE incident_id = $1 ORDER BY analyzed_at DESC LIMIT 1`,
        [incidentId]
      );
      if (rcaRes.rows.length > 0) {
        const rcaAnalysisId = rcaRes.rows[0].id;
        await pool.query(
          `INSERT INTO rca_evidences (
            rca_analysis_id, source_type, source_reference, evidence_data, importance_score, created_at
          ) VALUES (
            $1, 'METRIC_TIME_SERIES', $2, $3, 0.95, NOW()
          )`,
          [
            rcaAnalysisId,
            serviceId,
            JSON.stringify({
              service_id: serviceId,
              points: snapshotPoints,
              captured_at: new Date().toISOString(),
            }),
          ]
        );
      }

      // 2. Lưu các điểm mẫu vào agent_metrics có đánh dấu thời gian để tra cứu biểu đồ lịch sử sự cố
      for (const p of snapshotPoints) {
        const collectedAt = p.time_bucket ? new Date(p.time_bucket) : new Date();
        await pool.query(
          `INSERT INTO agent_metrics (
            agent_id, service_id, pod_id, cpu, ram, disk,
            request_rate, latency, http_5xx_rate, pod_restart_count, replica_count,
            collected_at, created_at
          ) VALUES (
            'agent-snapshot', $1, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW()
          ) ON CONFLICT DO NOTHING`,
          [
            serviceId,
            p.cpu,
            p.ram,
            p.disk,
            p.request_rate,
            p.latency,
            p.http_5xx_rate,
            p.pod_restart_count,
            p.replica_count,
            collectedAt,
          ]
        ).catch(() => {});
      }

      console.log(`✅ [TelemetryBuffer] Snapshot for Incident [${incidentId}] persisted successfully.`);
    } catch (err: any) {
      console.error(`❌ [TelemetryBuffer] Error persisting snapshot for Incident [${incidentId}]:`, err?.message || err);
    }
  }

  /**
   * Xóa bộ đệm RAM (dùng cho test hoặc khi dịch vụ bị hủy)
   */
  public static clearBuffer(serviceId?: string, organizationId?: string | null, clusterId?: string | null): void {
    if (serviceId && this.isValidTenantContext(organizationId, clusterId, serviceId)) {
      const exactKey = this.buildBufferKey(serviceId, organizationId!, clusterId!);
      this.rawBuffers.delete(exactKey);
      this.bufferLastUpdatedAt.delete(exactKey);
      if (isRedisReady()) {
        redisClient.del(`telemetry:buffer:${exactKey}`).catch(() => {});
      }
      return;
    }
    if (serviceId) {
      for (const key of Array.from(this.rawBuffers.keys())) {
        if (key === serviceId || key.endsWith(`::${serviceId}`)) {
          this.rawBuffers.delete(key);
          this.bufferLastUpdatedAt.delete(key);
          if (isRedisReady()) {
            redisClient.del(`telemetry:buffer:${key}`).catch(() => {});
          }
        }
      }
      this.activeServicesSet.delete(serviceId);
    } else {
      this.rawBuffers.clear();
      this.bufferLastUpdatedAt.clear();
      this.activeServicesSet.clear();
    }
  }
}
