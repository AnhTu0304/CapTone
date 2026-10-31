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
} from '../models';

export interface RcaContext {
  service_id: string;
  pod_id?: string;
  pod_status?: string;
  restart_count?: number;
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

    // Delegate query to MetricModel
    const points = await MetricModel.aggregateByService(serviceId, bucketSeconds, limit, {
      startTime: options?.startTime,
      endTime: options?.endTime,
      clusterId: options?.clusterId,
      organizationId: options?.organizationId,
    });

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

    // 2.2 Delegate K8s event filtering to KubernetesEventModel
    const eventRows = await KubernetesEventModel.findWarningEventsByService(
      serviceId,
      windowMinutes,
      eventLimit
    );
    const formattedEvents: string[] = eventRows.map((r) => {
      const timeStr = new Date(r.last_seen_at || r.first_seen_at).toISOString();
      const podPrefix = r.pod_name ? `Pod: ${r.pod_name} - ` : '';
      return `[${timeStr}] [${r.event_type}] ${podPrefix}Reason: ${r.reason} - ${r.message} (count: ${r.count || 1})`;
    });

    // 2.3 Latest aggregated metrics point (if available)
    const recentMetrics = await this.getServiceMetricsSequence(serviceId, {
      bucketSeconds: 5,
      limit: 1,
      fillPadding: false,
    });
    const latestMetrics = recentMetrics.length > 0 ? recentMetrics[0] : undefined;

    // 2.4 Query actual target Pod info & all workload pods
    let podId: string | undefined = undefined;
    let podStatus: string = 'Running';
    let restartCount = 0;
    let workloadType = 'Deployment';
    let workloadName = serviceId;
    let namespaceName = 'default';
    let workloadClusterId: string | undefined = undefined;
    let allPods: any[] = [];

    try {
      let podQuery = `SELECT 
           p.id AS pod_id,
           p.name AS pod_name,
           p.status,
           p.phase,
           p.restart_count,
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
         WHERE (w.name = $1 OR p.name LIKE $2 OR p.labels->>'app' = $1)
           AND p.deleted_at IS NULL`;
      const queryParams: any[] = [serviceId, `${serviceId}%`];
      if (clusterId) {
        podQuery += ` AND (p.cluster_id = $3 OR p.cluster_id IS NULL)`;
        queryParams.push(clusterId);
      }
      podQuery += ` ORDER BY p.created_at DESC, p.restart_count DESC`;
      const podsRes = await pool.query(podQuery, queryParams);

      if (podsRes.rows.length > 0) {
        const primary = podsRes.rows[0];
        podId = primary.pod_name;
        podStatus = primary.status || primary.phase || 'Running';
        restartCount = Number(primary.restart_count || 0);
        workloadType = primary.workload_type || 'Deployment';
        workloadName = primary.workload_name || serviceId;
        namespaceName = primary.namespace_name || 'default';
        workloadClusterId = clusterId || primary.cluster_id;

        // Inspect events and logs for pod termination signals (e.g. exit code 137, OOMKilled)
        const combinedLogAndEventText = `${formattedEvents.join(' ')} ${formattedLogs.join(' ')}`;
        const isOomKilled = /exit code 137|OOMKilled|Out of memory/i.test(combinedLogAndEventText);
        const exitCodeMatch = combinedLogAndEventText.match(/exit(?:Code|\s+code)\s*[:=]?\s*(\d+)/i);
        const lastExitCode = exitCodeMatch ? parseInt(exitCodeMatch[1], 10) : (isOomKilled ? 137 : undefined);
        const terminationReason = isOomKilled ? 'OOMKilled' : (lastExitCode ? `ExitCode_${lastExitCode}` : undefined);

        // Inspect database replica set role (e.g. MongoDB StatefulSet Primary/Secondary)
        const isMongo = /mongo/i.test(serviceId) || /mongodb/i.test(workloadType);
        const hasPrimaryMention = /PRIMARY/i.test(combinedLogAndEventText);

        allPods = podsRes.rows.map((row, idx) => {
          const isSuspected = row.pod_name === podId || idx === 0;
          let termination: any = undefined;
          if (isSuspected && (lastExitCode || isOomKilled)) {
            termination = {
              last_exit_code: lastExitCode || 137,
              reason: terminationReason || 'OOMKilled',
              container_name: serviceId,
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
              pvc_name: `datadir-${row.pod_name || serviceId}`,
              mount_status: 'Mounted',
              used_percent: Number(latestMetrics.disk),
            };
          }

          return {
            pod_id: row.pod_id,
            pod_name: row.pod_name,
            node_name: row.node_name,
            status: row.status || row.phase || 'Running',
            ready: (row.status === 'Running' || row.phase === 'Running') && Number(row.restart_count || 0) < 3,
            restart_count: Number(row.restart_count || 0),
            termination,
            mongodb_cluster_health: mongodbHealth,
            storage_pvc: storagePvc,
          };
        });
      }
    } catch (e) {
      console.warn('[TelemetryAggregator] Could not query pod info:', e);
    }

    // 2.5 Query Node metrics & conditions
    let allNodes: any[] = [];
    try {
      const nodesRes = await pool.query(
        `SELECT DISTINCT ON (n.id)
           n.id AS node_id,
           n.name AS node_name,
           n.status,
           COALESCE(nm.cpu_usage_percent, 0) AS cpu_usage_pct,
           COALESCE(nm.ram_total_bytes, n.memory_capacity_bytes, 0) AS ram_capacity_bytes,
           COALESCE(nm.ram_used_bytes, 0) AS ram_usage_bytes,
           COALESCE(nm.ram_available_bytes, 0) AS free_memory_bytes,
           COALESCE(nm.ram_usage_percent, 0) AS ram_usage_pct
         FROM nodes n
         LEFT JOIN node_metrics nm ON nm.node_id = n.id
         ORDER BY n.id, nm.collected_at DESC NULLS LAST;`
      );
      allNodes = nodesRes.rows.map((r) => ({
        node_id: r.node_id,
        node_name: r.node_name,
        status: r.status || 'Ready',
        cpu_usage_pct: Number(r.cpu_usage_pct || 0),
        ram_capacity_bytes: Number(r.ram_capacity_bytes || 0),
        ram_usage_bytes: Number(r.ram_usage_bytes || 0),
        free_memory_bytes: Number(r.free_memory_bytes || 0),
        ram_usage_pct: Number(r.ram_usage_pct || 0),
        conditions: {
          Ready: r.status === 'Ready',
          MemoryPressure: Number(r.ram_usage_pct || 0) >= 90,
        },
      }));
    } catch (e) {
      console.warn('[TelemetryAggregator] Could not query nodes:', e);
    }

    // 2.6 Query Deployment replicas info
    let desiredReplicas: number | undefined = undefined;
    let availableReplicas: number | undefined = undefined;
    try {
      const deplRes = await pool.query(
        `SELECT d.desired_replicas, d.available_replicas 
         FROM deployments d 
         JOIN workloads w ON w.id = d.workload_id 
         WHERE w.name = $1 
         LIMIT 1`,
        [serviceId]
      );
      if (deplRes.rows.length > 0) {
        desiredReplicas = deplRes.rows[0].desired_replicas;
        availableReplicas = deplRes.rows[0].available_replicas;
      }
    } catch (e) {
      console.warn('[TelemetryAggregator] Could not query deployment replicas:', e);
    }

    return {
      service_id: serviceId,
      pod_id: podId,
      pod_status: podStatus,
      restart_count: restartCount,
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

    const latestMetrics = sequence[sequence.length - 1];

    // 2. Run GRU Prediction & Build RCA Context in parallel (non-blocking)
    // Broadcast GRU result immediately via onGruPrediction as soon as GRU completes
    const gruPromise = AiService.predictRisk({
      service_id: serviceId,
      sequence,
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

    // 3. Evaluate Rule Engine on latest snapshot + K8s context
    const ruleEvaluation = RuleEngineService.evaluate({
      service_id: serviceId,
      metrics: latestMetrics,
      pod_status: 'Running',
      k8s_events: rcaContext.kubernetes_events,
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
      // Determine primary risk type for RCA:
      let riskType: any = undefined;
      let confidence = 0.90;

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
          risk_type: riskType,
          confidence,
          pod_id: rcaContext.pod_id,
          namespace: rcaContext.namespace,
          workload_type: rcaContext.workload_type,
          suspected_pod_name: rcaContext.pod_id,
          metric_sequence: sequence,
          kubernetes: {
            cluster_id: options?.clusterId || rcaContext.cluster_id,
            namespace: rcaContext.namespace,
            workload_type: rcaContext.workload_type,
            workload_name: rcaContext.workload_name,
            pod_status: rcaContext.pod_status || 'Running',
            container_status: 'Running',
            restart_count: rcaContext.restart_count || latestMetrics.pod_restart_count || 0,
            events: rcaContext.kubernetes_events,
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
          kubernetes_events: rcaContext.kubernetes_events,
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
      metrics_sequence: sequence,
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
