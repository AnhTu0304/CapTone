import { EventEmitter } from 'events';
import { Request, Response } from 'express';
import { LogModel, ILogItem } from '../models/log.model';

export interface ILogStreamFilters {
  service_id?: string;
  namespace?: string;
  deployment?: string;
  pod?: string;
  level?: string;
  search?: string;
  cluster_id?: string;
  tail?: number;
  allowedOrgIds?: string[];
}

export interface IStreamLimitsConfig {
  maxGlobalStreams: number;
  maxUserStreams: number;
  maxBufferSize: number;
  maxMessageBytes: number;
  heartbeatIntervalMs: number;
  maxRecentTail: number;
}

const DEFAULT_CONFIG: IStreamLimitsConfig = {
  maxGlobalStreams: 100,
  maxUserStreams: 5,
  maxBufferSize: 100,
  maxMessageBytes: 65536,
  heartbeatIntervalMs: 15000,
  maxRecentTail: 50,
};

const SEVERITY_HIERARCHY: Record<string, number> = {
  TRACE: 10,
  DEBUG: 20,
  INFO: 30,
  WARN: 40,
  WARNING: 40,
  ERROR: 50,
  CRITICAL: 60,
  FATAL: 70,
};

class LogStreamManager extends EventEmitter {
  private config: IStreamLimitsConfig = { ...DEFAULT_CONFIG };
  private activeGlobalStreams = 0;
  private activeUserStreams = new Map<string, number>();

  constructor() {
    super();
    // Allow unlimited internal subscribers without EventEmitter memory-leak warnings
    this.setMaxListeners(0);
  }

  /**
   * Reconfigure stream limits (useful for testing and environments)
   */
  public setConfig(custom: Partial<IStreamLimitsConfig>): void {
    this.config = { ...this.config, ...custom };
  }

  /**
   * Reset active counts and configurations (used by test suites)
   */
  public resetForTesting(): void {
    this.config = { ...DEFAULT_CONFIG };
    this.activeGlobalStreams = 0;
    this.activeUserStreams.clear();
    this.removeAllListeners();
  }

  public getActiveCounts(): { global: number; userStreams: Map<string, number> } {
    return {
      global: this.activeGlobalStreams,
      userStreams: new Map(this.activeUserStreams),
    };
  }

  /**
   * Acquire connection permit for global & user limits
   */
  public acquirePermit(userId: string): { allowed: boolean; status: number; reason?: string } {
    if (this.activeGlobalStreams >= this.config.maxGlobalStreams) {
      return {
        allowed: false,
        status: 429,
        reason: `Hệ thống đạt giới hạn kết nối streaming toàn cục (${this.config.maxGlobalStreams})`,
      };
    }

    const currentUsers = this.activeUserStreams.get(userId) || 0;
    if (currentUsers >= this.config.maxUserStreams) {
      return {
        allowed: false,
        status: 429,
        reason: `Người dùng đạt giới hạn kết nối streaming song song (${this.config.maxUserStreams})`,
      };
    }

    this.activeGlobalStreams++;
    this.activeUserStreams.set(userId, currentUsers + 1);
    return { allowed: true, status: 200 };
  }

  /**
   * Release connection permit when client disconnects
   */
  public releasePermit(userId: string): void {
    if (this.activeGlobalStreams > 0) {
      this.activeGlobalStreams--;
    }
    const currentUsers = this.activeUserStreams.get(userId) || 0;
    if (currentUsers <= 1) {
      this.activeUserStreams.delete(userId);
    } else {
      this.activeUserStreams.set(userId, currentUsers - 1);
    }
  }

  /**
   * Evaluate if a log matches the active stream filters
   */
  public matchesFilter(log: any, filters: ILogStreamFilters): boolean {
    if (!log) return false;

    // 1. Cluster check
    if (filters.cluster_id && filters.cluster_id !== 'ALL' && filters.cluster_id !== 'all') {
      const logCluster = log.cluster_id || log.metadata?.cluster_id;
      if (logCluster && logCluster !== filters.cluster_id) {
        return false;
      }
    }

    // 2. Namespace check
    if (filters.namespace && filters.namespace !== 'ALL' && filters.namespace !== 'all') {
      const targetNs = filters.namespace.toLowerCase();
      const logNs = String(log.namespace || log.metadata?.namespace || '').toLowerCase();
      const logNsId = String(log.namespace_id || '').toLowerCase();
      if (logNs !== targetNs && logNsId !== targetNs) {
        return false;
      }
    }

    // 3. Deployment / Workload check
    if (filters.deployment && filters.deployment !== 'ALL' && filters.deployment !== 'all') {
      const targetDep = filters.deployment.toLowerCase();
      const logDep = String(log.metadata?.deployment || log.metadata?.workload || log.service_id || '').toLowerCase();
      const logSvcName = String(log.service_name || log.metadata?.service_name || '').toLowerCase();
      if (logDep !== targetDep && logSvcName !== targetDep && !logDep.startsWith(targetDep)) {
        return false;
      }
    }

    // 4. Pod check
    if (filters.pod && filters.pod !== 'ALL' && filters.pod !== 'all') {
      const targetPod = filters.pod.toLowerCase();
      const logPod = String(log.pod_name || log.pod_id || log.metadata?.pod_name || log.metadata?.pod_id || '').toLowerCase();
      if (logPod !== targetPod && !logPod.includes(targetPod)) {
        return false;
      }
    }

    // 5. Service ID check
    if (filters.service_id && filters.service_id !== 'ALL' && filters.service_id !== 'all') {
      const targetSvc = filters.service_id.toLowerCase();
      const logSvcId = String(log.service_id || log.metadata?.service_id || '').toLowerCase();
      const logSvcName = String(log.service_name || '').toLowerCase();
      if (logSvcId !== targetSvc && logSvcName !== targetSvc) {
        return false;
      }
    }

    // 6. Level check (hierarchy)
    if (filters.level && filters.level !== 'ALL' && filters.level !== 'all') {
      const filterRank = SEVERITY_HIERARCHY[filters.level.toUpperCase()] || 0;
      const logRank = SEVERITY_HIERARCHY[String(log.level || 'INFO').toUpperCase()] || 0;
      if (logRank < filterRank) {
        return false;
      }
    }

    // 7. Dynamic Search keyword check (case-insensitive substring in message, pod, service, or source) [S4][PB17] 3.4
    if (filters.search && filters.search.trim()) {
      const term = filters.search.trim().toLowerCase();
      const msg = String(log.message || log.msg || '').toLowerCase();
      const pod = String(log.pod_name || log.pod_id || log.metadata?.pod_name || '').toLowerCase();
      const svc = String(log.service_name || log.service_id || log.metadata?.service_name || '').toLowerCase();
      const src = String(log.source || '').toLowerCase();
      if (!msg.includes(term) && !pod.includes(term) && !svc.includes(term) && !src.includes(term)) {
        return false;
      }
    }

    // 8. Tenant Isolation check: if stream is scoped to allowedOrgIds [S4][PB17] 3.5
    if (Array.isArray(filters.allowedOrgIds) && filters.allowedOrgIds.length > 0) {
      const logOrgId = log.organization_id || log.org_id || log.metadata?.organization_id || log.metadata?.org_id;
      if (logOrgId && !filters.allowedOrgIds.includes(String(logOrgId))) {
        return false;
      }
    }

    return true;
  }

  /**
   * Broadcast a newly ingested log to all matching listeners
   */
  public emitLog(log: any): void {
    if (!log) return;
    this.emit('new_log', log);
  }

  /**
   * Handles an active SSE log stream request
   */
  public async handleStream(
    req: Request,
    res: Response,
    filters: ILogStreamFilters,
    userId: string
  ): Promise<void> {
    const permit = this.acquirePermit(userId);
    if (!permit.allowed) {
      res.status(permit.status).json({
        success: false,
        message: permit.reason,
      });
      return;
    }

    // Configure headers for SSE
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable proxy buffering for nginx
    });
    res.flushHeaders?.();

    let isClosed = false;
    let droppedCount = 0;
    const queue: string[] = [];
    let isDraining = false;

    // Safe writer helper with backpressure queue
    const writeSseEvent = (eventType: string, data: any, eventId?: string | number) => {
      if (isClosed || res.writableEnded) return;

      let payloadStr = '';
      try {
        payloadStr = typeof data === 'string' ? data : JSON.stringify(data);
      } catch {
        payloadStr = JSON.stringify({ error: 'Serialization failure' });
      }

      if (payloadStr.length > this.config.maxMessageBytes) {
        payloadStr = payloadStr.slice(0, this.config.maxMessageBytes) + '...[TRUNCATED]';
      }

      let sseBlock = `event: ${eventType}\n`;
      if (eventId !== undefined) {
        sseBlock += `id: ${eventId}\n`;
      }
      sseBlock += `data: ${payloadStr}\n\n`;

      if (isDraining) {
        if (queue.length >= this.config.maxBufferSize) {
          queue.shift(); // Drop oldest message
          droppedCount++;
        }
        queue.push(sseBlock);
        return;
      }

      const canWriteMore = res.write(sseBlock);
      if (!canWriteMore) {
        isDraining = true;
      }
    };

    // Drain buffer when socket is ready
    res.on('drain', () => {
      if (isClosed || res.writableEnded) return;
      isDraining = false;

      while (queue.length > 0) {
        const item = queue.shift()!;
        const ok = res.write(item);
        if (!ok) {
          isDraining = true;
          break;
        }
      }

      if (!isDraining && droppedCount > 0) {
        const overflowNotice = {
          dropped: droppedCount,
          reason: 'Client buffer capacity exceeded (slow consumer backpressure)',
          timestamp: new Date().toISOString(),
        };
        droppedCount = 0;
        res.write(`event: overflow\ndata: ${JSON.stringify(overflowNotice)}\n\n`);
      }
    });

    // 1. Initial Status event
    writeSseEvent('status', {
      status: 'connected',
      activeFilters: filters,
      timestamp: new Date().toISOString(),
    });

    // 2. Initial Catch-Up Tail (if tail > 0)
    const tailLimit = Math.min(filters.tail ?? 20, this.config.maxRecentTail);
    if (tailLimit > 0) {
      try {
        const history = await LogModel.queryLogs({
          serviceId: filters.service_id,
          namespace: filters.namespace,
          deployment: filters.deployment,
          pod: filters.pod,
          level: filters.level,
          search: filters.search,
          clusterId: filters.cluster_id,
          allowedOrgIds: filters.allowedOrgIds,
          limit: tailLimit,
          offset: 0,
        });

        // Deliver history entries chronologically
        const recentLogs = [...history.logs].reverse();
        for (const item of recentLogs) {
          writeSseEvent('log', item, item.id);
        }
      } catch (err: any) {
        console.warn('[LogStream] Catchup tail query failed:', err.message);
      }
    }

    // 3. Heartbeat interval
    const heartbeatTimer = setInterval(() => {
      if (!isClosed && !res.writableEnded) {
        writeSseEvent('heartbeat', { timestamp: new Date().toISOString() });
      }
    }, this.config.heartbeatIntervalMs);

    // 4. Live Log listener
    const logListener = (newLog: any) => {
      if (isClosed || res.writableEnded) return;
      if (this.matchesFilter(newLog, filters)) {
        writeSseEvent('log', newLog, newLog.id);
      }
    };

    this.on('new_log', logListener);

    // 5. Cleanup on disconnect or error
    const cleanup = () => {
      if (isClosed) return;
      isClosed = true;
      clearInterval(heartbeatTimer);
      this.removeListener('new_log', logListener);
      this.releasePermit(userId);
      queue.length = 0;
    };

    req.on('close', cleanup);
    res.on('close', cleanup);
    res.on('error', cleanup);
    req.on('error', cleanup);
  }
}

export const LogStreamService = new LogStreamManager();
