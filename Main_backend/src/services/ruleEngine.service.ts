import {
  RuleEngineInput,
  RuleEvaluationResult,
  ProposedHealingAction,
} from '../schemas/ruleEngine.schema';

export interface RuleThresholds {
  cpuScaleThreshold: number;
  latencyScaleThreshold: number;
  trafficRateThreshold: number;
  trafficMaxReplicas: number;
  ramCriticalThreshold: number;
  podRestartThreshold: number;
  http5xxThreshold: number;
  diskCriticalThreshold: number;
}

const DEFAULT_THRESHOLDS: RuleThresholds = {
  cpuScaleThreshold: 80.0,
  latencyScaleThreshold: 200.0,
  trafficRateThreshold: 500.0,
  trafficMaxReplicas: 2,
  ramCriticalThreshold: 85.0,
  podRestartThreshold: 3,
  http5xxThreshold: 5.0,
  diskCriticalThreshold: 85.0,
};

export class RuleEngineService {
  private static thresholds: RuleThresholds = { ...DEFAULT_THRESHOLDS };

  /**
   * Configure custom rule thresholds if needed
   */
  public static configure(customThresholds: Partial<RuleThresholds>) {
    this.thresholds = { ...this.thresholds, ...customThresholds };
  }

  /**
   * Current active thresholds
   */
  public static getThresholds(): RuleThresholds {
    return { ...this.thresholds };
  }

  /**
   * Core Evaluation: 
   * 1. Anomaly Detection (Reactive threshold breaches)
   * 2. Rule Evaluation (Multi-condition synthesis & severity)
   * 3. RCA Trigger (Decision to investigate root cause)
   * 4. Action Proposal (Propose candidate healing action)
   *
   * Note: SCALE_DOWN_CANDIDATE is exclusively a proactive 12-timestep GRU prediction,
   * NOT triggered by a single snapshot rule in Rule Engine.
   */
  public static evaluate(input: RuleEngineInput): RuleEvaluationResult {
    const { service_id, metrics, pod_status, k8s_events = [], root_cause } = input;
    const th = this.thresholds;

    const triggeredRules: string[] = [];
    const anomalies: string[] = [];

    const k8sText = `${pod_status || ''} ${k8s_events.join(' ')}`.toLowerCase();

    // =========================================================================
    // 1. ANOMALY DETECTION (Deterministic Rule Evaluation)
    // =========================================================================

    // Rule 1: High CPU + High Latency Saturation
    if (metrics.cpu > th.cpuScaleThreshold && metrics.latency > th.latencyScaleThreshold) {
      triggeredRules.push(
        `Rule 1 [CPU+Latency]: cpu (${metrics.cpu.toFixed(1)}% > ${th.cpuScaleThreshold}%) and latency (${metrics.latency.toFixed(1)}ms > ${th.latencyScaleThreshold}ms)`
      );
      anomalies.push('CPU_LATENCY_SATURATION');
    }

    // Rule 2: High Request Rate with low replicas
    if (metrics.request_rate > th.trafficRateThreshold && metrics.replica_count <= th.trafficMaxReplicas) {
      triggeredRules.push(
        `Rule 2 [Traffic Surge]: request_rate (${metrics.request_rate.toFixed(1)} req/s > ${th.trafficRateThreshold}) with replica count ${metrics.replica_count}`
      );
      anomalies.push('TRAFFIC_SURGE');
    }

    // Rule 3: Memory Pressure / OOM
    const hasOom = k8sText.includes('oomkilled') || k8sText.includes('out of memory');
    if (metrics.ram > th.ramCriticalThreshold || hasOom) {
      triggeredRules.push(
        `Rule 3 [Memory Pressure]: ram (${metrics.ram.toFixed(1)}% > ${th.ramCriticalThreshold}%) or OOM detected (${hasOom})`
      );
      anomalies.push('MEMORY_PRESSURE');
    }

    // Rule 4: HTTP 5xx Error Spike
    if (metrics.http_5xx_rate > th.http5xxThreshold) {
      triggeredRules.push(
        `Rule 4 [5xx Spike]: http_5xx_rate (${metrics.http_5xx_rate.toFixed(1)}% > ${th.http5xxThreshold}%)`
      );
      anomalies.push('HTTP_5XX_SPIKE');
    }

    // Rule 5: Pod Instability (Treat restart_count as evidence of instability, not standalone root cause)
    const hasCrashLoop = k8sText.includes('crashloopbackoff');
    const hasProbeFail = k8sText.includes('probe failed');
    if (metrics.pod_restart_count >= th.podRestartThreshold || hasCrashLoop || hasProbeFail) {
      triggeredRules.push(
        `Rule 5 [Pod Instability]: restarts (${metrics.pod_restart_count} >= ${th.podRestartThreshold}) or CrashLoop/Probe failure in events`
      );
      anomalies.push('POD_INSTABILITY');
    }

    // Rule 6: Critical Disk Full
    if (metrics.disk > th.diskCriticalThreshold) {
      triggeredRules.push(
        `Rule 6 [Disk Saturation]: disk (${metrics.disk.toFixed(1)}% > ${th.diskCriticalThreshold}%)`
      );
      anomalies.push('DISK_SATURATION');
    }

    // =========================================================================
    // 2. RULE EVALUATION (Multi-condition synthesis & Severity determination)
    // =========================================================================
    const isAnomalous = anomalies.length > 0;
    let severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';

    if (
      hasOom ||
      hasCrashLoop ||
      (anomalies.includes('MEMORY_PRESSURE') && anomalies.includes('POD_INSTABILITY')) ||
      (anomalies.includes('HTTP_5XX_SPIKE') && anomalies.includes('POD_INSTABILITY'))
    ) {
      severity = 'CRITICAL';
    } else if (
      anomalies.includes('CPU_LATENCY_SATURATION') ||
      anomalies.includes('TRAFFIC_SURGE') ||
      anomalies.includes('HTTP_5XX_SPIKE') ||
      anomalies.includes('MEMORY_PRESSURE') ||
      anomalies.includes('DISK_SATURATION')
    ) {
      severity = 'HIGH';
    } else if (anomalies.includes('POD_INSTABILITY')) {
      severity = 'MEDIUM';
    } else {
      severity = 'LOW';
    }

    // =========================================================================
    // 3. RCA TRIGGER DECISION
    // =========================================================================
    // Filter: Only trigger RCA when anomalies present real service risks
    const requiresRca =
      anomalies.includes('MEMORY_PRESSURE') ||
      anomalies.includes('HTTP_5XX_SPIKE') ||
      anomalies.includes('POD_INSTABILITY') ||
      anomalies.includes('CPU_LATENCY_SATURATION') ||
      anomalies.includes('DISK_SATURATION') ||
      anomalies.includes('TRAFFIC_SURGE');

    // =========================================================================
    // 4. ACTION PROPOSAL (Proposal only, Safety Policy will validate)
    // =========================================================================
    let proposedAction: ProposedHealingAction | undefined = undefined;
    let reason = 'All telemetry signals within safe operational thresholds';

    // If root_cause is supplied (from prior RCA investigation or GRU forecast)
    if (root_cause) {
      const rc = root_cause.toLowerCase();
      if (rc.includes('memory') || rc.includes('oom')) {
        proposedAction = 'RESTART_POD';
        reason = `Root cause identified as ${root_cause}. Proposing pod restart.`;
      } else if (rc.includes('traffic') || rc.includes('cpu') || rc.includes('replica')) {
        proposedAction = 'SCALE_REPLICAS';
        reason = `Root cause identified as ${root_cause}. Proposing replica scaling.`;
      } else if (rc.includes('deployment') || rc.includes('rollout') || rc.includes('application')) {
        proposedAction = 'ROLLBACK_DEPLOYMENT';
        reason = `Root cause identified as ${root_cause}. Proposing deployment rollback.`;
      } else if (rc.includes('storage') || rc.includes('disk')) {
        proposedAction = 'CLEANUP_STORAGE';
        reason = `Root cause identified as ${root_cause}. Proposing storage cleanup.`;
      } else if (rc.includes('scale_down') || rc.includes('surplus') || rc.includes('scale-down')) {
        // Proactive scale down candidate coming from GRU model forecast
        proposedAction = 'SCALE_DOWN_CANDIDATE';
        reason = `Proactive GRU model forecasted sustained low utilization. Flagging scale-down candidate.`;
      }
    } else if (isAnomalous) {
      // Prioritize proposed action by highest urgency anomaly
      if (anomalies.includes('MEMORY_PRESSURE') || anomalies.includes('POD_INSTABILITY')) {
        proposedAction = 'RESTART_POD';
        reason = `Pod stability or memory pressure detected. Proposing pod restart.`;
      } else if (anomalies.includes('CPU_LATENCY_SATURATION') || anomalies.includes('TRAFFIC_SURGE')) {
        proposedAction = 'SCALE_REPLICAS';
        reason = `Load surge detected. Proposing scale up replicas to restore capacity.`;
      } else if (anomalies.includes('HTTP_5XX_SPIKE')) {
        proposedAction = 'ROLLBACK_DEPLOYMENT';
        reason = `High HTTP 5xx error rate detected. Proposing deployment rollback.`;
      } else if (anomalies.includes('DISK_SATURATION')) {
        proposedAction = 'CLEANUP_STORAGE';
        reason = `Disk storage critical. Proposing temporary storage cleanup.`;
      }
    }

    return {
      service_id,
      is_anomalous: isAnomalous,
      anomalies,
      severity,
      requires_rca: requiresRca,
      proposed_action: proposedAction,
      reason,
      triggered_rules: triggeredRules,
    };
  }
}
