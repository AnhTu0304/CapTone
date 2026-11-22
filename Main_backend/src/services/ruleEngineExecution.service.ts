import { AlertRuleModel, IAlertRule } from '../models/alertRule.model';
import { ResourceMetricEvaluator } from './evaluators/resourceMetricEvaluator';
import { KubernetesRuleEvaluator } from './evaluators/kubernetesRuleEvaluator';
import { ApmRuleEvaluator } from './evaluators/apmRuleEvaluator';
import { pool } from '../config/database';
import { isValidUuid, runWithTenantContext } from '../config/dbContext';

export interface IRuleEngineRunResult {
  rules_evaluated: number;
  alerts_triggered: number;
  alerts_resolved: number;
  duration_ms: number;
  evaluated_at: string;
}

export class RuleEngineExecutionService {
  /**
   * Run one evaluation cycle across all active alert rules
   * Optional filters: organizationId and clusterId
   */
  public static async runEvaluationCycle(options?: {
    organizationId?: string;
    clusterId?: string;
  }): Promise<IRuleEngineRunResult> {
    if (!options?.organizationId) {
      const startTime = Date.now();
      let rulesEvaluated = 0;
      let alertsTriggered = 0;
      let alertsResolved = 0;
      const orgRes = await pool.query(`SELECT id FROM public.fn_list_active_organization_ids();`);
      for (const row of orgRes.rows) {
        const sub = await this.runEvaluationCycle({ organizationId: row.id, clusterId: options?.clusterId });
        rulesEvaluated += sub.rules_evaluated;
        alertsTriggered += sub.alerts_triggered;
        alertsResolved += sub.alerts_resolved;
      }
      return {
        rules_evaluated: rulesEvaluated,
        alerts_triggered: alertsTriggered,
        alerts_resolved: alertsResolved,
        duration_ms: Date.now() - startTime,
        evaluated_at: new Date().toISOString(),
      };
    }

    if (!isValidUuid(options.organizationId)) {
      throw new Error(`Invalid organizationId for RuleEngineExecutionService: ${options.organizationId}`);
    }

    return await runWithTenantContext(options.organizationId, null, async () => {
    const startTime = Date.now();
    let rulesEvaluated = 0;
    let alertsTriggered = 0;
    let alertsResolved = 0;

    // Fetch active enabled rules
    const rules = await AlertRuleModel.findActiveRules(options?.organizationId, options?.clusterId);
    rulesEvaluated = rules.length;

    for (const rule of rules) {
      try {
        let res = { triggered: 0, resolved: 0 };

        switch (rule.metric_type) {
          case 'CPU':
          case 'RAM':
          case 'DISK':
          case 'NETWORK_RECEIVE':
          case 'NETWORK_TRANSMIT':
            res = await ResourceMetricEvaluator.evaluateRule(rule);
            break;

          case 'POD_CRASH_LOOP':
          case 'POD_FAILED':
          case 'CONTAINER_OOM':
          case 'NODE_NOT_READY':
          case 'DEPLOYMENT_UNAVAILABLE':
            res = await KubernetesRuleEvaluator.evaluateRule(rule);
            break;

          case 'HTTP_5XX_RATE':
          case 'ERROR_RATE':
          case 'LATENCY':
          case 'REQUEST_RATE':
            res = await ApmRuleEvaluator.evaluateRule(rule);
            break;

          default:
            console.warn(`[RuleEngine] Bỏ qua quy tắc với metric_type chưa hỗ trợ: ${rule.metric_type}`);
            break;
        }

        alertsTriggered += res.triggered;
        alertsResolved += res.resolved;
      } catch (err) {
        console.error(`[RuleEngine] Lỗi khi đánh giá quy tắc ${rule.id} (${rule.name}):`, err);
      }
    }

    const durationMs = Date.now() - startTime;
    const result: IRuleEngineRunResult = {
      rules_evaluated: rulesEvaluated,
      alerts_triggered: alertsTriggered,
      alerts_resolved: alertsResolved,
      duration_ms: durationMs,
      evaluated_at: new Date().toISOString(),
    };

    if (rulesEvaluated > 0) {
      console.log(
        `[RuleEngine] Chu kỳ đánh giá hoàn tất: ${rulesEvaluated} quy tắc, ${alertsTriggered} cảnh báo kích hoạt, ${alertsResolved} giải quyết trong ${durationMs}ms.`
      );
    }

    return result;
    });
  }
}
