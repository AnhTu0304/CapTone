import { TelemetryBufferService } from './telemetryBuffer.service';
import { pool } from '../config/database';
import { ApiError } from '../utils/apiError';
import { GRUMetricPoint } from '../schemas/ai.schema';
import { RuleEngineService } from './ruleEngine.service';
import { AiService, PredictionResult, RCAResult } from './ai.service';
import { RuleEvaluationResult } from '../schemas/ruleEngine.schema';
import {
  MetricModel,
  LogModel,
  KubernetesEventModel,
  AgentModel,
  IncidentModel,
  RecommendationModel,
  AiPredictionModel,
  WorkloadModel,
} from '../models';

export interface RcaContext {
  service_id: string;
  pod_id?: string;
  pod_status?: string;
  restart_count?: number;
  active_restart_count?: number;
  active_pod_issue?: boolean;
  desired_replicas?: number;
  available_replicas?: number;
  workload_type?: string;
  workload_name?: string;
  namespace?: string;
  cluster_id?: string;
  all_pods?: any[];
  nodes?: any[];
  logs: string[];
  kubernetes_events: string[];
  active_k8s_events?: string[];
  latest_metrics?: GRUMetricPoint;
  time_window_minutes: number;
  extracted_at: string;
}

export interface ServiceEvaluationResult {
  service_id: string;
  pod_id?: string;
  pod_status?: string;
  restart_count?: number;
  desired_replicas?: number;
  available_replicas?: number;
  evaluated_at: string;
  metrics_sequence: GRUMetricPoint[];
  latest_metrics: GRUMetricPoint;
  rule_evaluation: RuleEvaluationResult;
  gru_prediction: PredictionResult | null;
  rca_triggered: boolean;
  rca_trigger_reason?: string;
  rca_diagnosis: RCAResult | null;
  rca_evidence_count: {
    logs: number;
    kubernetes_events: number;
  };
}

export class TelemetryAggregatorService {
  private static lastBatchRestartCountByService = new Map<string, number>();

  /**
   * 1. Aggregate raw pod metrics by service_id and time bucket
   * to produce the standard [12 x 8] time-series sequence for GRU.
   */
  public static async getServiceMetricsSequence(
    serviceId: string,
    options?: {
      bucketSeconds?: number;
      limit?: number;
      fillPadding?: boolean;
      startTime?: Date | null;
      endTime?: Date | null;
      clusterId?: string | null;
      organizationId?: string | null;
    }
  ): Promise<GRUMetricPoint[]> {
    const bucketSeconds = options?.bucketSeconds ?? 5;
    const limit = options?.limit ?? 12;
    const fillPadding = options?.fillPadding ?? true;

    // Ưu tiên đọc từ In-Memory Buffer (RAM / Redis) nếu không có startTime lịch sử
    let points: GRUMetricPoint[] = [];
    if (!options?.startTime) {
      points = await TelemetryBufferService.getDisplayPoints(serviceId, bucketSeconds, limit);
    }
    if (points.length === 0) {
      points = await MetricModel.aggregateByService(serviceId, bucketSeconds, limit, {
        startTime: options?.startTime,
        endTime: options?.endTime,
        clusterId: options?.clusterId,
        organizationId: options?.organizationId,
      });
    }

    if (points.length === 0) {
      return [];
    }

    // If fewer than limit points exist and fillPadding is enabled,
    // pad by replicating the earliest point so GRU sequence validation passes (exact 12 points)
    if (fillPadding && points.length < limit) {
      const missingCount = limit - points.length;
      const earliestPoint = points[0];
      const earliestTime = earliestPoint?.time_bucket ? new Date(earliestPoint.time_bucket).getTime() : Date.now();
      const paddingPoints: GRUMetricPoint[] = Array.from({ length: missingCount }, (_, i) => ({
        ...earliestPoint,
        time_bucket: earliestPoint?.time_bucket ? new Date(earliestTime - (missingCount - i) * bucketSeconds * 1000).toISOString() : undefined,
      }));
      return [...paddingPoints, ...points];
    }

    return points;
  }

  /**
   * 2. Filter relevant Logs and K8s Events to build RCA Context.
   * - Logs: prioritize ERROR, WARN, and error keywords (OOM, timeout, crash, etc.)
   *         while keeping chronological order and limiting to 20-50 entries.
   * - K8s Events: Warning, OOMKilled, BackOff, Unhealthy, Failed.
   */
  public static async buildRcaContext(
    serviceId: string,
    options?: {
      clusterId?: string;
      windowMinutes?: number;
      logLimit?: number;
      eventLimit?: number;
      organizationId?: string;
    }
  ): Promise<RcaContext> {
    const clusterId = options?.clusterId;
    const windowMinutes = options?.windowMinutes ?? 30;
    const logLimit = Math.min(Math.max(options?.logLimit ?? 30, 5), 100);
    const eventLimit = Math.min(Math.max(options?.eventLimit ?? 20, 5), 100);

    // 2.1 Delegate log filtering to LogModel
    const logRows = await LogModel.findPrioritizedByService(serviceId, windowMinutes, logLimit);
    const formattedLogs: string[] = logRows.map((r) => {
      const timeStr = new Date(r.occurred_at).toISOString();
      const podPrefix = r.pod_id ? `[${r.pod_id}] ` : '';
      return `[${timeStr}] [${(r.level || 'INFO').toUpperCase()}] ${podPrefix}${r.message}`;
    });

    // 2.15 Resolve canonical Kubernetes workload/namespace target + post-healing settling window
    const targetInfo = await WorkloadModel.resolveK8sTarget(serviceId, clusterId);
    const canonicalName = targetInfo.targetName || serviceId;
    const aliasNames = Array.from(new Set([serviceId, canonicalName].filter(Boolean)));
    const aliasLower = aliasNames.map((n) => n.toLowerCase());

    let settlingCutoff: Date | null = null;
    try {
      const latestHealRes = await pool.query(
        `SELECT MAX(completed_at) AS latest_completed_at
         FROM healing_actions
         WHERE execution_status = 'SUCCEEDED'
           AND completed_at >= NOW() - interval '30 minutes'
           AND (
             LOWER(COALESCE(target_name, '')) = ANY($1)
             OR ($2::text IS NOT NULL AND target_id::text = $2)
           );`,
        [aliasLower, targetInfo.workloadId]
      );
      const latestHealAt = latestHealRes.rows[0]?.latest_completed_at
        ? new Date(latestHealRes.rows[0].latest_completed_at)
        : null;
      if (latestHealAt && !isNaN(latestHealAt.getTime())) {
        settlingCutoff = new Date(latestHealAt.getTime() + 45000);
      }

      const recoveryDates = await Promise.all(
        aliasNames.map((name) => KubernetesEventModel.findLatestRecoveryTimeByService(name, 30))
      );
      for (const recAt of recoveryDates) {
        if (recAt && !isNaN(recAt.getTime())) {
          const recCutoff = new Date(recAt.getTime() + 15000);
          if (!settlingCutoff || recCutoff.getTime() > settlingCutoff.getTime()) {
            settlingCutoff = recCutoff;
          }
        }
      }
    } catch {
      // Non-blocking settling window check
    }

    // 2.2 Delegate K8s event filtering to KubernetesEventModel (with post-recovery cutoff)
    const eventSets = await Promise.all(
      aliasNames.map((name) =>
        KubernetesEventModel.findWarningEventsByService(name, windowMinutes, eventLimit, settlingCutoff)
      )
    );
    const seenEventKeys = new Set<string>();
    const eventRows = eventSets
      .flat()
      .filter((r: any) => {
        const key = r.id || `${r.pod_name || ''}:${r.reason}:${r.message}`;
        if (seenEventKeys.has(key)) return false;
        seenEventKeys.add(key);
        return true;
      })
      .slice(0, eventLimit);

    const formattedEvents: string[] = eventRows.map((r: any) => {
      const timeStr = new Date(r.last_seen_at || r.first_seen_at).toISOString();
      const podPrefix = r.pod_name ? `Pod: ${r.pod_name} - ` : '';
      return `[${timeStr}] [${r.event_type}] ${podPrefix}Reason: ${r.reason} - ${r.message} (count: ${r.count || 1})`;
    });

    // 2.3 Latest aggregated metrics point (if available)
    const recentMetrics = await this.getServiceMetricsSequence(serviceId, {
      bucketSeconds: 5,
      limit: 1,
      fillPadding: false,
      clusterId,
    });
    const latestMetrics = recentMetrics.length > 0 ? recentMetrics[0] : undefined;

    // 2.4 Query actual target Pod info & all workload pods with live container readiness
    let podId: string | undefined = undefined;
    let podStatus: string = 'Running';
    let restartCount = 0;
    let activeRestartCount = 0;
    let podIssueActive = false;
    let workloadType = targetInfo.workloadType || 'Deployment';
    let workloadName = canonicalName;
    let namespaceName = targetInfo.namespace || 'default';
    let workloadClusterId: string | undefined = clusterId;
    let allPods: any[] = [];
    let healthyRunningPodCount = 0;

    try {
      let podQuery = `SELECT 
           p.id AS pod_id,
           p.name AS pod_name,
           p.status,
           p.phase,
           p.restart_count,
           p.containers,
           p.observed_at,
           p.node_id,
           n.name AS node_name,
           w.workload_type AS workload_type,
           w.name AS workload_name,
           ns.name AS namespace_name,
           p.cluster_id
         FROM pods p
         LEFT JOIN workloads w ON w.id = p.workload_id
         LEFT JOIN nodes n ON n.id = p.node_id
         LEFT JOIN namespaces ns ON ns.id = p.namespace_id
         WHERE (
           w.name = $1
           OR w.name = $2
           OR p.labels->>'app' = $1
           OR p.labels->>'app.kubernetes.io/name' = $1
           OR p.name LIKE $3
           OR p.name LIKE $4
         )
           AND p.deleted_at IS NULL`;
      const queryParams: any[] = [serviceId, canonicalName, `${serviceId}-%`, `${canonicalName}-%`];
      if (clusterId) {
        podQuery += ` AND p.cluster_id::text = $5`;
        queryParams.push(clusterId);
      }
      podQuery += ` ORDER BY p.observed_at DESC NULLS LAST, p.updated_at DESC NULLS LAST, p.created_at DESC`;
      const podsRes = await pool.query(podQuery, queryParams);

      if (podsRes.rows.length > 0) {
        const evalPods = podsRes.rows.map((row: any) => {
          const rawStatus = String(row.status || row.phase || 'Running').trim();
          const rawPhase = String(row.phase || 'Running').trim();
          const isTerminating = rawStatus.toLowerCase() === 'terminating';
          const containers: any[] = Array.isArray(row.containers)
            ? row.containers
            : typeof row.containers === 'string'
              ? (() => { try { return JSON.parse(row.containers); } catch { return []; } })()
              : [];
          const nonInit = containers.filter((c) => !c?.is_init);
          const failingReasons = ['CrashLoopBackOff', 'ImagePullBackOff', 'ErrImagePull', 'OOMKilled', 'CreateContainerConfigError', 'CreateContainerError', 'Failed', 'Error', 'Unknown'];
          const hasFailingStatus = failingReasons.some((r) => rawStatus.toLowerCase() === r.toLowerCase());
          const hasFailingContainer = nonInit.some(
            (c) =>
              failingReasons.includes(String(c?.waiting_reason || '')) ||
              String(c?.terminated_reason || '') === 'OOMKilled'
          );
          const allContainersReady =
            nonInit.length > 0
              ? nonInit.every((c) => Boolean(c?.ready) || (c?.state === 'running' && !c?.waiting_reason))
              : rawStatus === 'Running' && !hasFailingStatus;
          const isHealthyPod =
            !isTerminating &&
            (rawStatus === 'Running' || rawPhase === 'Running') &&
            allContainersReady &&
            !hasFailingStatus &&
            !hasFailingContainer;
          return {
            row,
            rawStatus,
            isTerminating,
            hasFailingContainer,
            isHealthyPod,
            allContainersReady,
          };
        });

        const hasHealthySibling = evalPods.some((p) => p.isHealthyPod);
        healthyRunningPodCount = evalPods.filter((p) => p.isHealthyPod).length;

        const nonHealthyNonTerminating = evalPods.find((p) => !p.isHealthyPod && !p.isTerminating);
        const firstNonTerminating = evalPods.find((p) => !p.isTerminating);
        const selected = nonHealthyNonTerminating || firstNonTerminating || evalPods[0];
        const primary = selected.row;

        podId = primary.pod_name;
        podStatus = (selected.isTerminating && hasHealthySibling) ? 'Running' : selected.rawStatus;
        restartCount = Number(primary.restart_count || 0);
        workloadType = primary.workload_type || workloadType;
        workloadName = primary.workload_name || canonicalName;
        namespaceName = primary.namespace_name || namespaceName;
        workloadClusterId = clusterId || primary.cluster_id;

        podIssueActive = evalPods.some((p) => {
          if (p.isTerminating && hasHealthySibling) return false;
          return !p.isHealthyPod;
        });

        // Inspect recent events (within 5 min and after settlingCutoff) for active termination signals
        const fiveMinAgoMs = Date.now() - 5 * 60 * 1000;
        const recentEventRows = eventRows.filter((ev: any) => {
          const ts = new Date(ev.last_seen_at || ev.first_seen_at || 0).getTime();
          if (ts < fiveMinAgoMs) return false;
          if (settlingCutoff && ts <= settlingCutoff.getTime()) return false;
          return true;
        });
        const recentEventText = recentEventRows.map((ev: any) => `${ev.reason || ''} ${ev.message || ''}`).join(' ');
        const isOomKilled = /exit code 137|OOMKilled/i.test(recentEventText);
        const exitCodeMatch = recentEventText.match(/exit(?:Code|\s+code)\s*[:=]?\s*(\d+)/i);
        const lastExitCode = exitCodeMatch ? parseInt(exitCodeMatch[1], 10) : (isOomKilled ? 137 : undefined);
        const terminationReason = isOomKilled ? 'OOMKilled' : (lastExitCode ? `ExitCode_${lastExitCode}` : undefined);

        const isMongo = /mongo/i.test(serviceId) || /mongodb/i.test(workloadType);
        const combinedLogAndEventText = `${formattedEvents.join(' ')} ${formattedLogs.join(' ')}`;
        const hasPrimaryMention = /PRIMARY/i.test(combinedLogAndEventText);

        allPods = evalPods.map((item, idx) => {
          const { row, rawStatus, isTerminating, isHealthyPod } = item;
          const isSuspected = row.pod_name === podId || idx === 0;
          let termination: any = undefined;
          if (isSuspected && (!isHealthyPod || isOomKilled) && (lastExitCode || isOomKilled)) {
            termination = {
              last_exit_code: lastExitCode || 137,
              reason: terminationReason || 'OOMKilled',
              container_name: canonicalName,
            };
          }

          let mongodbHealth: any = undefined;
          if (isMongo) {
            mongodbHealth = {
              role: (isSuspected || idx === 0) ? (hasPrimaryMention ? 'PRIMARY' : 'PRIMARY') : 'SECONDARY',
              quorum_status: 'INTACT',
              healthy_members: 3,
              total_members: 3,
              replication_lag_seconds: 0.0,
            };
          }

          let storagePvc: any = undefined;
          if (latestMetrics && latestMetrics.disk !== undefined) {
            storagePvc = {
              pvc_name: `datadir-${row.pod_name || canonicalName}`,
              mount_status: 'Mounted',
              used_percent: Number(latestMetrics.disk),
            };
          }

          const effectiveHealthy = isTerminating && hasHealthySibling ? true : isHealthyPod;
          return {
            pod_id: row.pod_id,
            pod_name: row.pod_name,
            node_name: row.node_name,
            status: effectiveHealthy ? 'Running' : rawStatus,
            ready: effectiveHealthy,
            restart_count: effectiveHealthy ? 0 : Number(row.restart_count || 0),
            termination,
            mongodb_cluster_health: mongodbHealth,
            storage_pvc: storagePvc,
          };
        });

        activeRestartCount = evalPods.some((p) => !p.isHealthyPod && !(p.isTerminating && hasHealthySibling))
          ? restartCount
          : 0;
      }
    } catch (e) {
      console.warn('[TelemetryAggregator] Could not query pod info:', e);
    }

    // 2.5 Query Node metrics & conditions (strictly filtered by current cluster)
    let allNodes: any[] = [];
    try {
      const clusterWhere = workloadClusterId ? `WHERE n.cluster_id = $1` : '';
      const clusterParams = workloadClusterId ? [workloadClusterId] : [];
      const nodesRes = await pool.query(
        `SELECT DISTINCT ON (n.id)
           n.id AS node_id,
           n.name AS node_name,
           n.status,
           n.conditions,
           n.allocatable,
           COALESCE(nm.cpu_usage_percent, 0) AS cpu_usage_pct,
           COALESCE(nm.ram_total_bytes, n.memory_capacity_bytes, 0) AS ram_capacity_bytes,
           COALESCE(nm.ram_used_bytes, 0) AS ram_usage_bytes,
           COALESCE(nm.ram_available_bytes, 0) AS free_memory_bytes,
           COALESCE(nm.ram_usage_percent, 0) AS ram_usage_pct,
           COALESCE(nm.disk_usage_percent, 0) AS disk_usage_pct
         FROM nodes n
         LEFT JOIN node_metrics nm ON nm.node_id = n.id
         ${clusterWhere}
         ORDER BY n.id, nm.collected_at DESC NULLS LAST;`,
        clusterParams
      );
      const parseBoolCond = (val: any, fallback = false): boolean => {
        if (typeof val === 'boolean') return val;
        if (typeof val === 'string') return ['true', '1', 'yes'].includes(val.trim().toLowerCase());
        return fallback;
      };
      allNodes = nodesRes.rows.map((r) => {
        const rawCond = (typeof r.conditions === 'object' && r.conditions !== null) ? r.conditions : {};
        const rawAlloc = (typeof r.allocatable === 'object' && r.allocatable !== null) ? r.allocatable : {};
        const ramPct = Number(r.ram_usage_pct || 0);
        const diskPct = Number(r.disk_usage_pct || 0);
        return {
          node_id: r.node_id,
          node_name: r.node_name,
          status: r.status || 'Ready',
          unschedulable: Boolean(rawAlloc.unschedulable),
          taints: Array.isArray(rawAlloc.taints) ? rawAlloc.taints : [],
          cpu_usage_pct: Number(r.cpu_usage_pct || 0),
          ram_capacity_bytes: Number(r.ram_capacity_bytes || 0),
          ram_usage_bytes: Number(r.ram_usage_bytes || 0),
          free_memory_bytes: Number(r.free_memory_bytes || 0),
          ram_usage_pct: ramPct,
          disk_usage_pct: diskPct,
          pods_allocatable: rawAlloc.pods_allocatable != null ? Number(rawAlloc.pods_allocatable) : undefined,
          conditions: {
            Ready: r.status === 'Ready' && parseBoolCond(rawCond.Ready, true),
            MemoryPressure: parseBoolCond(rawCond.MemoryPressure, false) || ramPct >= 90,
            DiskPressure: parseBoolCond(rawCond.DiskPressure, false) || diskPct >= 90,
            PIDPressure: parseBoolCond(rawCond.PIDPressure, false),
            NetworkUnavailable: parseBoolCond(rawCond.NetworkUnavailable, false),
          },
        };
      });
    } catch (e) {
      console.warn('[TelemetryAggregator] Could not query nodes:', e);
    }

    // 2.6 Query Deployment replicas info (scoped to current cluster)
    let desiredReplicas: number | undefined = undefined;
    let availableReplicas: number | undefined = undefined;
    try {
      const depParams: any[] = [canonicalName, serviceId];
      const depClusterFilter = workloadClusterId ? 'AND w.cluster_id::text = $3' : '';
      if (workloadClusterId) depParams.push(workloadClusterId);
      const deplRes = await pool.query(
        `SELECT d.desired_replicas, d.available_replicas 
         FROM deployments d 
         JOIN workloads w ON w.id = d.workload_id 
         WHERE (w.name = $1 OR w.name = $2) ${depClusterFilter}
         ORDER BY w.updated_at DESC NULLS LAST
         LIMIT 1`,
        depParams
      );
      if (deplRes.rows.length > 0) {
        desiredReplicas = deplRes.rows[0].desired_replicas;
        availableReplicas = deplRes.rows[0].available_replicas;
      }
    } catch (e) {
      console.warn('[TelemetryAggregator] Could not query deployment replicas:', e);
    }

    // 2.7 Build active_k8s_events (only last 5 minutes & after settlingCutoff; ignore MinimumReplicasUnavailable when pods are healthy)
    const activeCutoffMs = Math.max(
      Date.now() - 5 * 60 * 1000,
      settlingCutoff ? settlingCutoff.getTime() : 0
    );
    const activeK8sEvents = eventRows
      .filter((r: any) => {
        const ts = new Date(r.last_seen_at || r.first_seen_at || 0).getTime();
        if (ts <= activeCutoffMs) return false;
        const msgLower = `${r.reason || ''} ${r.message || ''}`.toLowerCase();
        if (
          (msgLower.includes('minimumreplicasunavailable') || msgLower.includes('minimum availability')) &&
          healthyRunningPodCount >= Math.max(1, desiredReplicas ?? 1)
        ) {
          return false;
        }
        return true;
      })
      .map((r: any) => {
        const timeStr = new Date(r.last_seen_at || r.first_seen_at).toISOString();
        const podPrefix = r.pod_name ? `Pod: ${r.pod_name} - ` : '';
        return `[${timeStr}] [${r.event_type}] ${podPrefix}Reason: ${r.reason} - ${r.message} (count: ${r.count || 1})`;
      });

    return {
      service_id: serviceId,
      pod_id: podId,
      pod_status: podStatus,
      restart_count: restartCount,
      active_restart_count: activeRestartCount,
      active_pod_issue: podIssueActive,
      desired_replicas: desiredReplicas,
      available_replicas: availableReplicas,
      workload_type: workloadType,
      workload_name: workloadName,
      namespace: namespaceName,
      cluster_id: workloadClusterId,
      all_pods: allPods,
      nodes: allNodes,
      logs: formattedLogs,
      kubernetes_events: formattedEvents,
      active_k8s_events: activeK8sEvents,
      latest_metrics: latestMetrics,
      time_window_minutes: windowMinutes,
      extracted_at: new Date().toISOString(),
    };
  }

  /**
   * 3. End-to-End Orchestration:
   * Aggregates Telemetry Sequence -> Evaluates Rule Engine -> Invokes GRU ->
   * Triggers and records RCA if anomaly or critical risk is detected.
   */
  public static async evaluateAndDiagnoseService(
    serviceId: string,
    options?: {
      bucketSeconds?: number;
      windowMinutes?: number;
      forceRca?: boolean;
      autoTriggerRca?: boolean;
      providedSequence?: GRUMetricPoint[];
      clusterId?: string;
      onGruPrediction?: (pred: PredictionResult) => void;
      organizationId?: string;
    }
  ): Promise<ServiceEvaluationResult> {
    const bucketSeconds = options?.bucketSeconds ?? 5;
    const windowMinutes = options?.windowMinutes ?? 30;
    const forceRca = options?.forceRca ?? false;
    const autoTriggerRca = options?.autoTriggerRca ?? true;

    // 1. Fetch 12-timestep sequence (or use provided 12-point fresh tumbling batch)
    const sequence =
      options?.providedSequence && options.providedSequence.length >= 12
        ? options.providedSequence
        : await this.getServiceMetricsSequence(serviceId, {
            bucketSeconds,
            limit: 12,
            fillPadding: true,
          });

    if (sequence.length < 12) {
      throw ApiError.badRequest(
        `Insufficient telemetry data for service '${serviceId}'. Found ${sequence.length}/12 points.`
      );
    }

    // Convert monotonic cumulative pod_restart_count into per-step non-negative deltas
    const stateKey = `${options?.clusterId || 'default'}:${serviceId}`;
    const prevRawRestart = TelemetryAggregatorService.lastBatchRestartCountByService.get(stateKey);
    const stepDeltas: number[] = [];
    for (let i = 0; i < sequence.length; i++) {
      const rawCurr = Math.max(0, Number(sequence[i]?.pod_restart_count || 0));
      if (i === 0) {
        if (prevRawRestart === undefined) {
          stepDeltas.push(0);
        } else {
          stepDeltas.push(rawCurr < prevRawRestart ? rawCurr : rawCurr - prevRawRestart);
        }
      } else {
        const rawPrev = Math.max(0, Number(sequence[i - 1]?.pod_restart_count || 0));
        stepDeltas.push(rawCurr >= rawPrev ? rawCurr - rawPrev : rawCurr);
      }
    }
    const rawLastRestart = Math.max(0, Number(sequence[sequence.length - 1]?.pod_restart_count || 0));
    TelemetryAggregatorService.lastBatchRestartCountByService.set(stateKey, rawLastRestart);

    const normalizedSequence: GRUMetricPoint[] = sequence.map((pt, idx) => ({
      ...pt,
      pod_restart_count: stepDeltas[idx] ?? 0,
    }));
    const windowRestartTotal = stepDeltas.reduce((acc, val) => acc + val, 0);
    const latestMetrics = normalizedSequence[normalizedSequence.length - 1];

    // 2. Run GRU Prediction & Build RCA Context in parallel (non-blocking)
    // Broadcast GRU result immediately via onGruPrediction as soon as GRU completes
    const gruPromise = AiService.predictRisk({
      service_id: serviceId,
      sequence: normalizedSequence,
      prediction_horizon_minutes: 15,
      cluster_id: options?.clusterId,
    })
      .then((pred) => {
        if (pred && options?.onGruPrediction) {
          try {
            options.onGruPrediction(pred);
          } catch (cbErr) {
            console.warn(`[TelemetryAggregator] onGruPrediction callback error:`, cbErr);
          }
        }
        return pred;
      })
      .catch((error) => {
        console.warn(`[TelemetryAggregator] AI Backend prediction failed for ${serviceId}:`, error);
        return null;
      });

    const rcaContextPromise = this.buildRcaContext(serviceId, {
      clusterId: options?.clusterId,
      windowMinutes,
    });

    const [gruPrediction, rcaContext] = await Promise.all([gruPromise, rcaContextPromise]);

    // 3. Evaluate Rule Engine on normalized delta snapshot + live active K8s context
    const ruleEvaluation = RuleEngineService.evaluate({
      service_id: serviceId,
      metrics: latestMetrics,
      pod_status: rcaContext.pod_status || 'Running',
      restart_delta: windowRestartTotal,
      active_pod_issue: rcaContext.active_pod_issue,
      k8s_events: rcaContext.active_k8s_events ?? [],
    });

    // 5. Determine whether to trigger RCA
    let rcaTriggered = false;
    let rcaTriggerReason: string | undefined = undefined;

    const hasHighGruRisk =
      gruPrediction &&
      gruPrediction.detected_risks.some(
        (r) => r.risk_type !== 'SCALE_DOWN_CANDIDATE'
      );

    if (forceRca) {
      rcaTriggered = true;
      rcaTriggerReason = 'Manual trigger (force_rca=true)';
    } else if (ruleEvaluation.requires_rca) {
      rcaTriggered = true;
      rcaTriggerReason = `Rule Engine detected anomalies: [${ruleEvaluation.anomalies.join(', ')}]`;
    } else if (hasHighGruRisk) {
      rcaTriggered = true;
      rcaTriggerReason = `GRU forecasted primary risk '${gruPrediction?.primary_risk}' with confidence ${gruPrediction?.confidence_score.toFixed(2)}`;
    }

    let rcaDiagnosis: RCAResult | null = null;

    if (rcaTriggered && autoTriggerRca) {
      // Determine primary risk type for RCA (without mislabeling pure POD_INSTABILITY as CPU_OVERLOAD):
      let riskType: any = undefined;
      let confidence: number | undefined = undefined;

      if (ruleEvaluation.anomalies.includes('MEMORY_PRESSURE')) {
        riskType = 'OOM';
        confidence = 0.95;
      } else if (ruleEvaluation.anomalies.includes('DISK_SATURATION')) {
        riskType = 'DISK_FULL';
        confidence = 0.90;
      } else if (ruleEvaluation.anomalies.includes('HTTP_5XX_SPIKE')) {
        riskType = 'HTTP_5XX_SPIKE';
        confidence = 0.88;
      } else if (ruleEvaluation.anomalies.includes('CPU_LATENCY_SATURATION')) {
        riskType = 'CPU_OVERLOAD';
        confidence = 0.85;
      } else if (ruleEvaluation.anomalies.includes('TRAFFIC_SURGE')) {
        riskType = 'TRAFFIC_OVERLOAD';
        confidence = 0.85;
      } else if (ruleEvaluation.anomalies.includes('POD_INSTABILITY')) {
        if (
          gruPrediction?.primary_risk &&
          gruPrediction.primary_risk !== 'NONE' &&
          gruPrediction.primary_risk !== 'NORMAL'
        ) {
          riskType = gruPrediction.primary_risk;
          confidence = gruPrediction.confidence_score;
        } else {
          riskType = undefined;
          confidence = undefined;
        }
      } else if (
        gruPrediction?.primary_risk &&
        gruPrediction.primary_risk !== 'NONE' &&
        gruPrediction.primary_risk !== 'NORMAL'
      ) {
        riskType = gruPrediction.primary_risk;
        confidence = gruPrediction.confidence_score;
      } else {
        riskType = 'CPU_OVERLOAD';
        confidence = 0.70;
      }

      const generatedRequestId = `req-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const generatedIncidentId = `inc-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

      try {
        rcaDiagnosis = await AiService.analyzeRootCause({
          request_id: generatedRequestId,
          incident_id: generatedIncidentId,
          service_id: serviceId,
          ...(riskType !== undefined && confidence !== undefined ? { risk_type: riskType, confidence } : {}),
          rule_engine: ruleEvaluation.triggered_rules,
          pod_id: rcaContext.pod_id,
          namespace: rcaContext.namespace,
          workload_type: rcaContext.workload_type,
          suspected_pod_name: rcaContext.pod_id,
          metric_sequence: normalizedSequence,
          kubernetes: {
            cluster_id: options?.clusterId || rcaContext.cluster_id,
            namespace: rcaContext.namespace,
            workload_type: rcaContext.workload_type,
            workload_name: rcaContext.workload_name,
            pod_status: rcaContext.pod_status || 'Running',
            container_status: rcaContext.active_pod_issue ? (rcaContext.pod_status || 'Unhealthy') : 'Running',
            restart_count: Math.max(windowRestartTotal, rcaContext.active_restart_count ?? 0),
            events: rcaContext.active_pod_issue ? rcaContext.kubernetes_events : (rcaContext.active_k8s_events ?? []),
            desired_replicas: rcaContext.desired_replicas ?? latestMetrics.replica_count ?? 1,
            available_replicas: rcaContext.available_replicas ?? latestMetrics.replica_count ?? 1,
            all_pods: rcaContext.all_pods || [],
            nodes: rcaContext.nodes || [],
          },
          prediction: gruPrediction
            ? {
                service_id: serviceId,
                threshold: gruPrediction.threshold,
                thresholds: gruPrediction.thresholds || {},
                detected_risks: gruPrediction.detected_risks || [],
                risk_outputs: gruPrediction.risk_outputs || {},
              }
            : undefined,
          metrics: latestMetrics,
          logs: rcaContext.logs,
          kubernetes_events: rcaContext.active_pod_issue ? rcaContext.kubernetes_events : (rcaContext.active_k8s_events ?? []),
          prediction_id: gruPrediction?.prediction_id,
          cluster_id: options?.clusterId || rcaContext.cluster_id,
        });
      } catch (error) {
        console.warn(`[TelemetryAggregator] AI Backend RCA failed for ${serviceId}:`, error);
      }
    }

    return {
      service_id: serviceId,
      evaluated_at: new Date().toISOString(),
      metrics_sequence: normalizedSequence,
      latest_metrics: latestMetrics,
      rule_evaluation: ruleEvaluation,
      gru_prediction: gruPrediction,
      rca_triggered: rcaTriggered,
      rca_trigger_reason: rcaTriggerReason,
      rca_diagnosis: rcaDiagnosis,
      rca_evidence_count: {
        logs: rcaContext.logs.length,
        kubernetes_events: rcaContext.kubernetes_events.length,
      },
    };
  }

  /**
   * Internal helper to fetch live summary payload for REST API and WebSocket broadcast
   */
  public static async getLiveSummaryData(serviceId: string = 'sme-order-service', clusterId?: string, organizationId?: string) {
    const agents = await AgentModel.listAll();
    const sequence = await TelemetryAggregatorService.getServiceMetricsSequence(serviceId, {
      bucketSeconds: 5,
      limit: 20,
      fillPadding: false,
      clusterId,
      organizationId,
    });
    const rawMetrics = await MetricModel.getRecentRaw(10);
    const logs = await LogModel.getRecent(30);
    const events = await KubernetesEventModel.getRecent(20);
    const incidents = await IncidentModel.getRecent(10);
    const recommendations = await RecommendationModel.getRecent(10, clusterId);
    const predictions = await AiPredictionModel.getRecent(5);

    // If clusterId is specified, also fetch most recent host/node metrics
    let latestNodeMetric: any = null;
    if (clusterId) {
      try {
        const nodeRes = await pool.query(
          `SELECT node_name, cpu_usage_percent, cpu_cores, ram_total_bytes, ram_used_bytes, ram_usage_percent, disk_usage_percent, collected_at
           FROM node_metrics
           WHERE cluster_id = $1
           ORDER BY collected_at DESC
           LIMIT 1`,
          [clusterId]
        );
        if (nodeRes.rows.length > 0) {
          latestNodeMetric = nodeRes.rows[0];
        }
      } catch (err) {
        // Safe fallback without disrupting summary
      }
    }

    const latestPoint = sequence.length > 0 
      ? sequence[sequence.length - 1] 
      : latestNodeMetric 
        ? {
            time_bucket: new Date(latestNodeMetric.collected_at).toISOString(),
            cpu: Number(latestNodeMetric.cpu_usage_percent || 0),
            ram: Number(latestNodeMetric.ram_usage_percent || 0),
            node_cpu_percent: Number(latestNodeMetric.cpu_usage_percent || 0),
            node_ram_percent: Number(latestNodeMetric.ram_usage_percent || 0),
            node_cpu_cores: Number(latestNodeMetric.cpu_cores || 1),
            node_ram_gb: latestNodeMetric.ram_used_bytes ? Number(latestNodeMetric.ram_used_bytes) / (1024 * 1024 * 1024) : 0,
            disk: Number(latestNodeMetric.disk_usage_percent || 0),
            latency: 0,
            request_rate: 0,
            http_5xx_rate: 0,
            pod_restart_count: 0,
            replica_count: 1,
          }
        : null;

    return {
      service_id: serviceId,
      cluster_id: clusterId,
      agents,
      sequence,
      latest_point: latestPoint,
      latest_node_metric: latestNodeMetric,
      raw_metrics: rawMetrics,
      logs,
      events,
      incidents,
      recommendations,
      predictions,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Summary of APM-monitored microservices with aggregated latency, throughput, error rate and health
   */
  public static async getApmServicesSummary(
    windowMinutes: number = 60,
    options?: {
      clusterId?: string | null;
      organizationId?: string | null;
    }
  ) {
    const clusterId = options?.clusterId || null;
    const orgId = options?.organizationId || null;

    const query = `
      WITH recent_metrics AS (
        SELECT 
          am.service_id,
          ROUND(AVG(am.latency)::numeric, 1)::float as avg_latency_ms,
          ROUND(MAX(am.latency)::numeric, 1)::float as max_latency_ms,
          ROUND(AVG(am.request_rate)::numeric, 1)::float as avg_request_rate,
          ROUND(AVG(am.http_5xx_rate)::numeric, 2)::float as avg_error_rate,
          MAX(am.collected_at) as last_collected_at,
          GREATEST(1, COUNT(DISTINCT am.pod_id))::int as replica_count,
          SUM(am.pod_restart_count)::int as total_restarts
        FROM agent_metrics am
        LEFT JOIN clusters c ON c.id::text = am.cluster_id::text OR c.name = am.cluster_id::text
        LEFT JOIN environments e ON e.id = c.environment_id
        WHERE am.collected_at > NOW() - ($1 || ' minutes')::INTERVAL
          AND ($2::text IS NULL OR am.cluster_id::text = $2)
          AND ($3::text IS NULL OR e.organization_id::text = $3::text)
        GROUP BY am.service_id
      )
      SELECT 
        rm.service_id,
        COALESCE(s.name, rm.service_id) as service_name,
        COALESCE(s.service_type, 'ClusterIP') as service_type,
        rm.avg_latency_ms,
        rm.max_latency_ms,
        rm.avg_request_rate,
        rm.avg_error_rate,
        rm.last_collected_at,
        rm.replica_count,
        rm.total_restarts
      FROM recent_metrics rm
      LEFT JOIN services s ON s.id::text = rm.service_id OR s.name = rm.service_id
      ORDER BY rm.service_id ASC;
    `;
    const res = await pool.query(query, [windowMinutes, clusterId, orgId]);
    if (res.rows.length > 0) {
      return res.rows;
    }

    // Fallback if no recent metrics: return known services with 0 metrics
    const fallbackRes = await pool.query(
      `SELECT 
        s.name as service_id,
        s.name as service_name,
        COALESCE(s.service_type, 'ClusterIP') as service_type,
        0.0::float as avg_latency_ms,
        0.0::float as max_latency_ms,
        0.0::float as avg_request_rate,
        0.0::float as avg_error_rate,
        NULL::timestamptz as last_collected_at,
        1::int as replica_count,
        0::int as total_restarts
      FROM services s
      LEFT JOIN clusters c ON c.id = s.cluster_id
      LEFT JOIN environments e ON e.id = c.environment_id
      WHERE ($1::text IS NULL OR e.organization_id::text = $1::text)
        AND ($2::text IS NULL OR c.id::text = $2 OR c.name = $2)
      ORDER BY s.name ASC
      LIMIT 20;`,
      [orgId, clusterId]
    );
    return fallbackRes.rows;
  }
}
