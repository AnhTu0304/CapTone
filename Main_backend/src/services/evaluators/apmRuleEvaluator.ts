import { pool } from '../../config/database';
import { IAlertRule } from '../../models/alertRule.model';
import { AlertLifecycleService } from '../alertLifecycle.service';
import { evaluateOperator, parseWindowToSeconds } from './ruleEvaluationHelper';

export class ApmRuleEvaluator {
  /**
   * Evaluate APM performance and error metrics rules
   */
  public static async evaluateRule(rule: IAlertRule): Promise<{
    triggered: number;
    resolved: number;
  }> {
    if (!rule.enabled) return { triggered: 0, resolved: 0 };

    const windowSeconds = parseWindowToSeconds(rule.evaluation_window);
    let triggered = 0;
    let resolved = 0;

    const params: any[] = [rule.organization_id, windowSeconds];
    let clusterFilter = '';
    if (rule.cluster_id) {
      clusterFilter = 'AND am.cluster_id = $3';
      params.push(rule.cluster_id);
    }

    const query = `
      SELECT 
        am.cluster_id,
        COALESCE(am.service_id, 'default-service') AS service_id,
        AVG(am.http_5xx_rate) AS avg_http_5xx_rate,
        AVG(am.latency) AS avg_latency,
        AVG(am.request_rate) AS avg_request_rate,
        MIN(am.collected_at) AS min_collected_at,
        MAX(am.collected_at) AS max_collected_at,
        COUNT(am.id) AS sample_count
      FROM agent_metrics am
      WHERE am.organization_id = $1
        AND am.collected_at >= NOW() - ($2 || ' seconds')::interval
        ${clusterFilter}
      GROUP BY am.cluster_id, am.service_id;
    `;

    const res = await pool.query(query, params);

    for (const row of res.rows) {
      const clusterId = row.cluster_id;
      const serviceId = row.service_id;
      let observedValue = 0;

      switch (rule.metric_type) {
        case 'HTTP_5XX_RATE':
        case 'ERROR_RATE':
          observedValue = Number(row.avg_http_5xx_rate || 0);
          break;

        case 'LATENCY':
          observedValue = Number(row.avg_latency || 0);
          if (rule.unit === 's') {
            observedValue = observedValue / 1000;
          }
          break;

        case 'REQUEST_RATE':
          observedValue = Number(row.avg_request_rate || 0);
          if (rule.unit === 'rpm') {
            observedValue = observedValue * 60;
          }
          break;

        default:
          continue;
      }

      observedValue = Math.round(observedValue * 100) / 100;

      const isBreached = evaluateOperator(
        observedValue,
        rule.operator,
        Number(rule.threshold_value)
      );

      // Verify duration persistence if required
      let durationSatisfied = true;
      if (isBreached && rule.duration > 0) {
        if (row.min_collected_at && row.max_collected_at) {
          const sampleSpreadSeconds =
            (new Date(row.max_collected_at).getTime() - new Date(row.min_collected_at).getTime()) / 1000;
          if (sampleSpreadSeconds < rule.duration && Number(row.sample_count) <= 1) {
            durationSatisfied = false;
          }
        }
      }

      if (isBreached && durationSatisfied) {
        await AlertLifecycleService.recordAlertTrigger({
          organization_id: rule.organization_id,
          cluster_id: clusterId,
          rule_id: rule.id,
          rule_name: rule.name,
          category: 'APM',
          metric_type: rule.metric_type,
          resource_type: 'service',
          resource_id: serviceId,
          severity: rule.severity,
          observed_value: observedValue,
          threshold_value: Number(rule.threshold_value),
          unit: rule.unit,
          message: `Dịch vụ '${serviceId}' gặp bất thường về APM (${rule.metric_type}): đo được ${observedValue} ${rule.unit} (${rule.operator} ${rule.threshold_value} ${rule.unit})`,
          details: {
            service_id: serviceId,
            operator: rule.operator,
            evaluation_window: rule.evaluation_window,
            duration: rule.duration,
            sample_count: Number(row.sample_count),
          },
          cooldown_seconds: rule.cooldown_seconds,
        });
        triggered++;
      } else if (!isBreached) {
        const autoResolved = await AlertLifecycleService.autoResolveAlert({
          organization_id: rule.organization_id,
          cluster_id: clusterId,
          rule_id: rule.id,
          resource_type: 'service',
          resource_id: serviceId,
          metric_type: rule.metric_type,
          resolution_details: {
            resolved_by: 'APM_METRIC_RECOVERY',
            resolved_at: new Date().toISOString(),
            observed_value: observedValue,
            threshold_value: Number(rule.threshold_value),
            message: `Chỉ số APM ${rule.metric_type} của dịch vụ '${serviceId}' đã bình thường trở lại (${observedValue} ${rule.unit})`,
          },
        });
        if (autoResolved) resolved++;
      }
    }

    return { triggered, resolved };
  }
}
