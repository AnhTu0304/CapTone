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

/**
 * TelemetryBufferService (Phương án 2: In-Memory / Redis Ring Buffer)
 * 
 * Quản lý vòng đệm viễn trắc trượt hoàn toàn trong RAM và Redis.
 * - Khi hệ thống BÌNH THƯỜNG: Dữ liệu được lưu trong buffer RAM/Redis, KHÔNG ghi vào PostgreSQL (tiết kiệm đĩa, tránh bloat).
 * - Khi AI / GRU phát hiện SỰ CỐ: Trích xuất Snapshot 12 bước viễn trắc từ RAM và lưu vĩnh viễn vào PostgreSQL.
 */
export class TelemetryBufferService {
  // Bộ đệm trong RAM cho từng service: lưu tối đa 120 điểm (~10 phút đo)
  private static rawBuffers: Map<string, RawTelemetryEntry[]> = new Map();
  private static activeServicesSet: Set<string> = new Set();
  private static readonly MAX_RAW_PER_SERVICE = 120;

  /**
   * Đẩy metric mới từ Agent vào bộ nhớ đệm RAM / Redis
   */
  public static pushMetric(metric: IAgentMetric): void {
    const serviceId = metric.service_id || 'unknown';
    const collectedAt = metric.collected_at instanceof Date ? metric.collected_at : new Date(metric.collected_at);

    const entry: RawTelemetryEntry = {
      organization_id: metric.organization_id || null,
      environment_id: metric.environment_id || null,
      batch_id: metric.batch_id || null,
      sample_id: metric.sample_id || null,
      agent_id: metric.agent_id || 'agent-unknown',
      cluster_id: metric.cluster_id || null,
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

    if (!this.rawBuffers.has(serviceId)) {
      this.rawBuffers.set(serviceId, []);
    }

    const buf = this.rawBuffers.get(serviceId)!;
    buf.push(entry);

    if (buf.length > this.MAX_RAW_PER_SERVICE) {
      buf.shift(); // FIFO: Tự động giải phóng bản ghi cũ nhất khỏi RAM
    }

    this.activeServicesSet.add(serviceId);

    // Gương sang Redis bất đồng bộ nếu Redis đang kết nối (không chặn luồng)
    if (isRedisReady()) {
      const redisKey = `telemetry:buffer:${serviceId}`;
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
   * Lấy danh sách các service đang hoạt động (từ RAM và DB)
   */
  public static async getActiveServices(windowMinutes: number = 30): Promise<string[]> {
    const fromMemory = Array.from(this.activeServicesSet);
    if (fromMemory.length > 0) {
      return fromMemory;
    }
    // Fallback nếu server vừa khởi động lại chưa có buffer trong RAM
    return MetricModel.getActiveServices(windowMinutes);
  }

  /**
   * Gom nhóm dữ liệu thô trong RAM thành các time-bucket 5s chuẩn
   */
  private static computeBucketsFromMemory(
    serviceId: string,
    bucketSeconds: number = 5
  ): { buckets: GRUMetricPoint[]; clusterId?: string; latestTime?: Date } {
    const rawList = this.rawBuffers.get(serviceId) || [];
    if (rawList.length === 0) {
      return { buckets: [] };
    }

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
    return { buckets, clusterId, latestTime };
  }

  /**
   * Lấy chuỗi điểm hiển thị trên sơ đồ UI (12 điểm gần nhất)
   */
  public static async getDisplayPoints(
    serviceId: string,
    bucketSeconds: number = 5,
    limit: number = 12
  ): Promise<GRUMetricPoint[]> {
    const { buckets } = this.computeBucketsFromMemory(serviceId, bucketSeconds);
    if (buckets.length > 0) {
      return buckets.slice(-limit);
    }
    // Fallback sang PostgreSQL nếu bộ nhớ chưa gom đủ
    return MetricModel.aggregateByService(serviceId, bucketSeconds, limit);
  }

  /**
   * Lấy lô điểm mới tinh phát sinh sau mốc thời gian trước đó (Tumbling Batch)
   */
  public static async getFreshBatch(
    serviceId: string,
    bucketSeconds: number = 5,
    afterTimestamp?: Date | null,
    limit: number = 12
  ): Promise<{ points: GRUMetricPoint[]; latestTimeBucket?: Date; clusterId?: string }> {
    const { buckets, clusterId, latestTime } = this.computeBucketsFromMemory(serviceId, bucketSeconds);

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
      };
    }

    // Fallback sang PostgreSQL nếu RAM chưa có đủ
    return MetricModel.getFreshBatchByService(serviceId, bucketSeconds, afterTimestamp, limit);
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
  public static clearBuffer(serviceId?: string): void {
    if (serviceId) {
      this.rawBuffers.delete(serviceId);
      this.activeServicesSet.delete(serviceId);
      if (isRedisReady()) {
        redisClient.del(`telemetry:buffer:${serviceId}`).catch(() => {});
      }
    } else {
      this.rawBuffers.clear();
      this.activeServicesSet.clear();
    }
  }
}
