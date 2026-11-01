import { pool } from '../../config/database';
import { IAlertRule } from '../../models/alertRule.model';
import { AlertLifecycleService } from '../alertLifecycle.service';
import { evaluateOperator, parseWindowToSeconds } from './ruleEvaluationHelper';
import { ConditionEvaluator } from './conditionEvaluator.service';

export class KubernetesRuleEvaluator {
  /**
   * Evaluate Kubernetes workload and cluster state rules
   */
  public static async evaluateRule(rule: IAlertRule): Promise<{
    triggered: number;
    resolved: number;
  }> {
    if (!rule.enabled) return { triggered: 0, resolved: 0 };

    switch (rule.metric_type) {
      case 'POD_CRASH_LOOP':
        return this.evaluatePodCrashLoop(rule);
      case 'POD_FAILED':
        return this.evaluatePodFailed(rule);
      case 'CONTAINER_OOM':
        return this.evaluateContainerOOM(rule);
      case 'NODE_NOT_READY':
        return this.evaluateNodeNotReady(rule);
      case 'DEPLOYMENT_UNAVAILABLE':
        return this.evaluateDeploymentUnavailable(rule);
      default:
        return { triggered: 0, resolved: 0 };
    }
  }

  /**
   * POD_CRASH_LOOP: Check pods in CrashLoopBackOff or with high restart counts
   */
  private static async evaluatePodCrashLoop(rule: IAlertRule): Promise<{ triggered: number; resolved: number }> {
    let triggered = 0;
    let resolved = 0;

    const params: any[] = [rule.organization_id];
    let clusterFilter = '';
    if (rule.cluster_id) {
      clusterFilter = 'AND p.cluster_id = $2';
      params.push(rule.cluster_id);
    }

    const query = `
      SELECT 
        p.id AS pod_pk,
        p.cluster_id,
        p.name AS pod_name,
        p.status,
        p.restart_count,
        COALESCE(np.name, nw.name, 'default') AS namespace_name
      FROM pods p
      JOIN clusters c ON p.cluster_id = c.id
      JOIN environments e ON c.environment_id = e.id
      LEFT JOIN namespaces np ON p.namespace_id = np.id
      LEFT JOIN workloads w ON p.workload_id = w.id
      LEFT JOIN namespaces nw ON w.namespace_id = nw.id
      WHERE e.organization_id = $1
        AND p.deleted_at IS NULL
        ${clusterFilter}
    `;

    const res = await pool.query(query, params);

    for (const pod of res.rows) {
      const restartCount = Number(pod.restart_count || 0);
      const isStatusCrashLoop =
        typeof pod.status === 'string' && pod.status.toLowerCase().includes('crashloop');
      const isThresholdBreached = evaluateOperator(
        restartCount,
        rule.operator,
        Number(rule.threshold_value)
      );

      const isViolating = isStatusCrashLoop || (restartCount > 0 && isThresholdBreached);

      const { severity, isEscalated } = ConditionEvaluator.determineSeverity(
        rule.severity,
        restartCount,
        Number(rule.threshold_value),
        'POD_CRASH_LOOP'
      );

      const fingerprint = ConditionEvaluator.computeFingerprint(
        rule.organization_id,
        pod.cluster_id,
        rule.id,
        'pod',
        pod.pod_name,
        'POD_CRASH_LOOP'
      );

      if (isViolating) {
        await AlertLifecycleService.recordAlertTrigger({
          organization_id: rule.organization_id,
          cluster_id: pod.cluster_id,
          rule_id: rule.id,
          rule_name: rule.name,
          category: 'KUBERNETES',
          metric_type: 'POD_CRASH_LOOP',
          resource_type: 'pod',
          resource_id: pod.pod_name,
          severity,
          observed_value: restartCount,
          threshold_value: Number(rule.threshold_value),
          unit: rule.unit || 'restarts',
          message: `Pod '${pod.pod_name}' rơi vào trạng thái CrashLoopBackOff (khởi động lại: ${restartCount} lần, trạng thái: ${pod.status})`,
          details: {
            pod_name: pod.pod_name,
            namespace: pod.namespace_name || 'default',
            pod_status: pod.status,
            restart_count: restartCount,
            evaluation_state: 'FIRING',
            is_escalated: isEscalated,
          },
          cooldown_seconds: rule.cooldown_seconds,
          fingerprint,
        });
        triggered++;
      } else if (pod.status === 'Running') {
        // Auto resolve if pod has recovered to Running
        const autoResolved = await AlertLifecycleService.autoResolveAlert({
          organization_id: rule.organization_id,
          cluster_id: pod.cluster_id,
          rule_id: rule.id,
          resource_type: 'pod',
          resource_id: pod.pod_name,
          metric_type: 'POD_CRASH_LOOP',
          resolution_details: {
            resolved_by: 'K8S_POD_HEALTHY',
            resolved_at: new Date().toISOString(),
            pod_status: pod.status,
            namespace: pod.namespace_name || 'default',
            message: `Pod '${pod.pod_name}' đã hoạt động ổn định trở lại (Running)`,
          },
        });
        if (autoResolved) resolved++;
      }
    }

    return { triggered, resolved };
  }

  /**
   * POD_FAILED: Check pods in Failed phase/status
   */
  private static async evaluatePodFailed(rule: IAlertRule): Promise<{ triggered: number; resolved: number }> {
    let triggered = 0;
    let resolved = 0;

    const params: any[] = [rule.organization_id];
    let clusterFilter = '';
    if (rule.cluster_id) {
      clusterFilter = 'AND p.cluster_id = $2';
      params.push(rule.cluster_id);
    }

    const query = `
      SELECT 
        p.id AS pod_pk,
        p.cluster_id,
        p.name AS pod_name,
        p.status,
        p.phase
      FROM pods p
      JOIN clusters c ON p.cluster_id = c.id
      JOIN environments e ON c.environment_id = e.id
      WHERE e.organization_id = $1
        AND p.deleted_at IS NULL
        ${clusterFilter}
    `;

    const res = await pool.query(query, params);

    for (const pod of res.rows) {
      const isFailed =
        pod.status === 'Failed' ||
        pod.phase === 'Failed' ||
        (typeof pod.status === 'string' && pod.status.toLowerCase().includes('error'));

      if (isFailed) {
        await AlertLifecycleService.recordAlertTrigger({
          organization_id: rule.organization_id,
          cluster_id: pod.cluster_id,
          rule_id: rule.id,
          rule_name: rule.name,
          category: 'KUBERNETES',
          metric_type: 'POD_FAILED',
          resource_type: 'pod',
          resource_id: pod.pod_name,
          severity: rule.severity,
          observed_value: 1,
          threshold_value: Number(rule.threshold_value),
          unit: 'count',
          message: `Pod '${pod.pod_name}' thất bại không thể khởi chạy (Trạng thái: ${pod.status}, Pha: ${pod.phase})`,
          details: {
            pod_name: pod.pod_name,
            status: pod.status,
            phase: pod.phase,
          },
          cooldown_seconds: rule.cooldown_seconds,
        });
        triggered++;
      } else if (pod.status === 'Running') {
        const autoResolved = await AlertLifecycleService.autoResolveAlert({
          organization_id: rule.organization_id,
          cluster_id: pod.cluster_id,
          rule_id: rule.id,
          resource_type: 'pod',
          resource_id: pod.pod_name,
          metric_type: 'POD_FAILED',
          resolution_details: {
            resolved_by: 'K8S_POD_HEALTHY',
            resolved_at: new Date().toISOString(),
            status: pod.status,
          },
        });
        if (autoResolved) resolved++;
      }
    }

    return { triggered, resolved };
  }

  /**
   * CONTAINER_OOM: Check container OOMKilled events and states
   */
  private static async evaluateContainerOOM(rule: IAlertRule): Promise<{ triggered: number; resolved: number }> {
    let triggered = 0;
    let resolved = 0;
    const windowSeconds = parseWindowToSeconds(rule.evaluation_window);

    const params: any[] = [rule.organization_id, windowSeconds];
    let clusterFilter = '';
    if (rule.cluster_id) {
      clusterFilter = 'AND ke.cluster_id = $3';
      params.push(rule.cluster_id);
    }

    // Check kubernetes_events for OOMKilled events in lookback window
    const eventQuery = `
      SELECT 
        ke.cluster_id,
        ke.resource_uid,
        ke.message,
        ke.reason,
        COUNT(ke.id) AS event_count
      FROM kubernetes_events ke
      JOIN clusters c ON ke.cluster_id = c.id
      JOIN environments e ON c.environment_id = e.id
      WHERE e.organization_id = $1
        AND (ke.reason ILIKE '%OOM%' OR ke.message ILIKE '%OOMKilled%')
        AND ke.last_seen_at >= NOW() - ($2 || ' seconds')::interval
        ${clusterFilter}
      GROUP BY ke.cluster_id, ke.resource_uid, ke.message, ke.reason
    `;

    const res = await pool.query(eventQuery, params);

    for (const ev of res.rows) {
      const count = Number(ev.event_count || 1);
      const isBreached = evaluateOperator(count, rule.operator, Number(rule.threshold_value));

      if (isBreached) {
        await AlertLifecycleService.recordAlertTrigger({
          organization_id: rule.organization_id,
          cluster_id: ev.cluster_id,
          rule_id: rule.id,
          rule_name: rule.name,
          category: 'KUBERNETES',
          metric_type: 'CONTAINER_OOM',
          resource_type: 'container',
          resource_id: ev.resource_uid || 'unknown-container',
          severity: rule.severity,
          observed_value: count,
          threshold_value: Number(rule.threshold_value),
          unit: 'count',
          message: `Phát hiện container bị tắt do tràn bộ nhớ OOMKilled: ${ev.message}`,
          details: {
            reason: ev.reason,
            message: ev.message,
            event_count: count,
          },
          cooldown_seconds: rule.cooldown_seconds,
        });
        triggered++;
      }
    }

    return { triggered, resolved };
  }

  /**
   * NODE_NOT_READY: Check cluster nodes not in Ready state
   */
  private static async evaluateNodeNotReady(rule: IAlertRule): Promise<{ triggered: number; resolved: number }> {
    let triggered = 0;
    let resolved = 0;

    const params: any[] = [rule.organization_id];
    let clusterFilter = '';
    if (rule.cluster_id) {
      clusterFilter = 'AND n.cluster_id = $2';
      params.push(rule.cluster_id);
    }

    const query = `
      SELECT 
        n.id AS node_pk,
        n.cluster_id,
        n.name AS node_name,
        n.status
      FROM nodes n
      JOIN clusters c ON n.cluster_id = c.id
      JOIN environments e ON c.environment_id = e.id
      WHERE e.organization_id = $1
        ${clusterFilter}
    `;

    const res = await pool.query(query, params);

    for (const node of res.rows) {
      const isNotReady = node.status !== 'Ready';

      if (isNotReady) {
        await AlertLifecycleService.recordAlertTrigger({
          organization_id: rule.organization_id,
          cluster_id: node.cluster_id,
          rule_id: rule.id,
          rule_name: rule.name,
          category: 'KUBERNETES',
          metric_type: 'NODE_NOT_READY',
          resource_type: 'node',
          resource_id: node.node_name,
          severity: rule.severity,
          observed_value: 1,
          threshold_value: Number(rule.threshold_value),
          unit: 'count',
          message: `Máy chủ cụm (Node) '${node.node_name}' mất kết nối hoặc chuyển trạng thái bất thường (${node.status})`,
          details: {
            node_name: node.node_name,
            node_status: node.status,
          },
          cooldown_seconds: rule.cooldown_seconds,
        });
        triggered++;
      } else {
        // Auto-resolve when node returns to Ready
        const autoResolved = await AlertLifecycleService.autoResolveAlert({
          organization_id: rule.organization_id,
          cluster_id: node.cluster_id,
          rule_id: rule.id,
          resource_type: 'node',
          resource_id: node.node_name,
          metric_type: 'NODE_NOT_READY',
          resolution_details: {
            resolved_by: 'K8S_NODE_READY',
            resolved_at: new Date().toISOString(),
            node_status: 'Ready',
            message: `Máy chủ '${node.node_name}' đã trở lại trạng thái sẵn sàng (Ready)`,
          },
        });
        if (autoResolved) resolved++;
      }
    }

    return { triggered, resolved };
  }

  /**
   * DEPLOYMENT_UNAVAILABLE: Check deployments with missing replicas
   */
  private static async evaluateDeploymentUnavailable(rule: IAlertRule): Promise<{ triggered: number; resolved: number }> {
    let triggered = 0;
    let resolved = 0;

    const params: any[] = [rule.organization_id];
    let clusterFilter = '';
    if (rule.cluster_id) {
      clusterFilter = 'AND w.cluster_id = $2';
      params.push(rule.cluster_id);
    }

    const query = `
      SELECT 
        d.id AS deployment_pk,
        w.name AS deployment_name,
        w.cluster_id,
        d.desired_replicas,
        d.available_replicas,
        d.ready_replicas
      FROM deployments d
      JOIN workloads w ON d.workload_id = w.id
      JOIN clusters c ON w.cluster_id = c.id
      JOIN environments e ON c.environment_id = e.id
      WHERE e.organization_id = $1
        ${clusterFilter}
    `;

    const res = await pool.query(query, params);

    for (const d of res.rows) {
      const desired = Number(d.desired_replicas || 0);
      const available = Number(d.available_replicas || 0);
      const missingReplicas = Math.max(0, desired - available);

      const isBreached = evaluateOperator(
        missingReplicas,
        rule.operator,
        Number(rule.threshold_value)
      );

      if (missingReplicas > 0 && isBreached) {
        await AlertLifecycleService.recordAlertTrigger({
          organization_id: rule.organization_id,
          cluster_id: d.cluster_id,
          rule_id: rule.id,
          rule_name: rule.name,
          category: 'KUBERNETES',
          metric_type: 'DEPLOYMENT_UNAVAILABLE',
          resource_type: 'deployment',
          resource_id: d.deployment_name,
          severity: rule.severity,
          observed_value: missingReplicas,
          threshold_value: Number(rule.threshold_value),
          unit: rule.unit || 'replicas',
          message: `Deployment '${d.deployment_name}' bị thiếu bản sao khả dụng (${available}/${desired} ready)`,
          details: {
            deployment_name: d.deployment_name,
            desired_replicas: desired,
            available_replicas: available,
            missing_replicas: missingReplicas,
          },
          cooldown_seconds: rule.cooldown_seconds,
        });
        triggered++;
      } else if (available >= desired) {
        const autoResolved = await AlertLifecycleService.autoResolveAlert({
          organization_id: rule.organization_id,
          cluster_id: d.cluster_id,
          rule_id: rule.id,
          resource_type: 'deployment',
          resource_id: d.deployment_name,
          metric_type: 'DEPLOYMENT_UNAVAILABLE',
          resolution_details: {
            resolved_by: 'K8S_DEPLOYMENT_HEALTHY',
            resolved_at: new Date().toISOString(),
            available_replicas: available,
            desired_replicas: desired,
            message: `Deployment '${d.deployment_name}' đã đủ số lượng replicas (${available}/${desired})`,
          },
        });
        if (autoResolved) resolved++;
      }
    }

    return { triggered, resolved };
  }
}
