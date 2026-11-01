import { pool } from '../../config/database';
import { IAlertRule } from '../../models/alertRule.model';
import { AlertLifecycleService } from '../alertLifecycle.service';
import {
  evaluateOperator,
  parseWindowToSeconds,
  convertBytesToUnit,
  convertRateToUnit,
} from './ruleEvaluationHelper';

export interface IEvaluationResult {
  evaluatedCount: number;
  triggeredCount: number;
  resolvedCount: number;
}

export class ResourceMetricEvaluator {
  /**
   * Evaluate resource metric rules for a specific rule or set of rules
   */
  public static async evaluateRule(rule: IAlertRule): Promise<{
    triggered: number;
    resolved: number;
  }> {
    if (!rule.enabled) return { triggered: 0, resolved: 0 };

    const windowSeconds = parseWindowToSeconds(rule.evaluation_window);
    let triggered = 0;
    let resolved = 0;

    // 1. Build query to aggregate node_metrics across evaluation window
    // Filter by organization_id and optional cluster_id
    const params: any[] = [rule.organization_id, windowSeconds];
    let clusterFilter = '';
    if (rule.cluster_id) {
      clusterFilter = 'AND nm.cluster_id = $3';
      params.push(rule.cluster_id);
    }

    const query = `
      SELECT 
        nm.cluster_id,
        nm.node_name,
        AVG(nm.cpu_usage_percent) AS avg_cpu_pct,
        AVG(nm.cpu_usage_percent * COALESCE(nm.cpu_cores, 1) / 100.0) AS avg_cpu_cores,
        AVG(nm.cpu_usage_percent * COALESCE(nm.cpu_cores, 1) * 10.0) AS avg_cpu_millicores,
        AVG(nm.ram_usage_percent) AS avg_ram_pct,
        AVG(nm.ram_used_bytes) AS avg_ram_used_bytes,
        AVG(nm.disk_usage_percent) AS avg_disk_pct,
        AVG(nm.disk_used_bytes) AS avg_disk_used_bytes,
        AVG(nm.net_rx_bytes_per_sec) AS avg_net_rx_rate,
        AVG(nm.net_tx_bytes_per_sec) AS avg_net_tx_rate,
        MIN(nm.collected_at) AS min_collected_at,
        MAX(nm.collected_at) AS max_collected_at,
        COUNT(nm.id) AS sample_count
      FROM node_metrics nm
      WHERE nm.organization_id = $1
        AND nm.collected_at >= NOW() - ($2 || ' seconds')::interval
        ${clusterFilter}
      GROUP BY nm.cluster_id, nm.node_name;
    `;

    const res = await pool.query(query, params);

    for (const row of res.rows) {
      const clusterId = row.cluster_id;
      const nodeName = row.node_name || 'unknown-node';
      let observedValue = 0;

      // Extract and convert value according to metric_type and unit
      switch (rule.metric_type) {
        case 'CPU':
          if (rule.unit === '%') {
            observedValue = Number(row.avg_cpu_pct || 0);
          } else if (rule.unit === 'cores') {
            observedValue = Number(row.avg_cpu_cores || 0);
          } else if (rule.unit === 'millicores') {
            observedValue = Number(row.avg_cpu_millicores || 0);
          }
          break;

        case 'RAM':
          if (rule.unit === '%') {
            observedValue = Number(row.avg_ram_pct || 0);
          } else {
            const bytes = Number(row.avg_ram_used_bytes || 0);
            observedValue = convertBytesToUnit(bytes, rule.unit);
          }
          break;

        case 'DISK':
          if (rule.unit === '%') {
            observedValue = Number(row.avg_disk_pct || 0);
          } else {
            const bytes = Number(row.avg_disk_used_bytes || 0);
            observedValue = convertBytesToUnit(bytes, rule.unit);
          }
          break;

        case 'NETWORK_RECEIVE':
          observedValue = convertRateToUnit(Number(row.avg_net_rx_rate || 0), rule.unit);
          break;

        case 'NETWORK_TRANSMIT':
          observedValue = convertRateToUnit(Number(row.avg_net_tx_rate || 0), rule.unit);
          break;

        default:
          continue;
      }

      // Round to 2 decimal places
      observedValue = Math.round(observedValue * 100) / 100;

      // Check if threshold is breached
      const isBreached = evaluateOperator(observedValue, rule.operator, Number(rule.threshold_value));

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
        // Trigger or update alert event
        const triggerResult = await AlertLifecycleService.recordAlertTrigger({
          organization_id: rule.organization_id,
          cluster_id: clusterId,
          rule_id: rule.id,
          rule_name: rule.name,
          category: 'RESOURCE',
          metric_type: rule.metric_type,
          resource_type: 'node',
          resource_id: nodeName,
          severity: rule.severity,
          observed_value: observedValue,
          threshold_value: Number(rule.threshold_value),
          unit: rule.unit,
          message: `Máy chủ '${nodeName}' vượt ngưỡng ${rule.metric_type}: giá trị đo ${observedValue} ${rule.unit} (${rule.operator} ${rule.threshold_value} ${rule.unit})`,
          details: {
            node_name: nodeName,
            operator: rule.operator,
            evaluation_window: rule.evaluation_window,
            duration: rule.duration,
            sample_count: Number(row.sample_count),
          },
          cooldown_seconds: rule.cooldown_seconds,
        });

        triggered++;
      } else if (!isBreached) {
        // Condition is healthy: Auto-resolve if an open alert exists
        const resolvedEvent = await AlertLifecycleService.autoResolveAlert({
          organization_id: rule.organization_id,
          cluster_id: clusterId,
          rule_id: rule.id,
          resource_type: 'node',
          resource_id: nodeName,
          metric_type: rule.metric_type,
          resolution_details: {
            resolved_by: 'RULE_ENGINE_AUTO_RECOVERY',
            resolved_at: new Date().toISOString(),
            observed_value: observedValue,
            threshold_value: Number(rule.threshold_value),
            message: `Chỉ số ${rule.metric_type} của máy chủ '${nodeName}' đã hồi phục về mức an toàn (${observedValue} ${rule.unit})`,
          },
        });

        if (resolvedEvent) {
          resolved++;
        }
      }
    }

    return { triggered, resolved };
  }
}
