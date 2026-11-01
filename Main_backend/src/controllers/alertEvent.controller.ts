import { Request, Response, NextFunction } from 'express';
import { AlertLifecycleService } from '../services/alertLifecycle.service';
import { RuleEngineExecutionService } from '../services/ruleEngineExecution.service';
import { AlertRuleService } from '../services/alertRule.service';
import { AlertRuleModel } from '../models/alertRule.model';
import { AlertEventModel } from '../models/alertEvent.model';
import {
  ListAlertEventsQuerySchema,
  AcknowledgeAlertEventSchema,
  ResolveAlertEventSchema,
  AlertSummaryQuerySchema,
} from '../schemas/alertEvent.schema';
import { alertHistoryQuerySchema } from '../schemas/alertHistory.schema';
import { AlertMetricType, AlertOperator, AlertSeverity } from '../schemas/alertRule.schema';
import { ApiResponse } from '../utils/apiResponse';
import { ApiError } from '../utils/apiError';
import { config } from '../config/env';
import { pool } from '../config/database';
import { RedisCacheService } from '../services/redisCache.service';

export class AlertEventController {
  /**
   * GET /api/v1/alerts/summary or GET /api/v1/alert-events/summary
   * Aggregated metrics for dashboard
   */
  public static async getSummary(req: Request, res: Response, next: NextFunction) {
    try {
      const parseResult = AlertSummaryQuerySchema.safeParse(req.query);
      if (!parseResult.success) {
        return next(
          new ApiError(
            400,
            parseResult.error.issues[0]?.message || 'Tham số truy vấn tổng hợp cảnh báo không hợp lệ',
            parseResult.error.format()
          )
        );
      }

      const user = (req as any).user;
      const targetOrgId = await AlertRuleService.enforceOrgAccess(
        user,
        AlertRuleService.extractRequestedOrgId(req)
      );

      // Verify cluster ownership if cluster_id provided
      if (parseResult.data.cluster_id) {
        const belongs = await AlertRuleModel.verifyClusterOwnership(parseResult.data.cluster_id, targetOrgId);
        if (!belongs) {
          throw ApiError.forbidden('Cụm máy chủ không thuộc phạm vi tổ chức của bạn');
        }
      }

      const summary = await AlertLifecycleService.getSummary(targetOrgId, {
        clusterId: parseResult.data.cluster_id,
        from: parseResult.data.from,
        to: parseResult.data.to,
      });

      return ApiResponse.success(res, 'Lấy tổng hợp cảnh báo thành công', summary, 200);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * GET /api/v1/alert-events
   * List alert events with pagination and filters
   */
  /**
   * GET /api/v1/alerts/history or GET /api/alerts/history
   * Paginated alert history with full multi-dimensional filters (PBI22 Task 4.2)
   */
  public static async getHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const parseResult = alertHistoryQuerySchema.safeParse(req.query);
      if (!parseResult.success) {
        return next(
          new ApiError(
            400,
            parseResult.error.issues[0]?.message || 'Tham số truy vấn lịch sử cảnh báo không hợp lệ',
            parseResult.error.format()
          )
        );
      }

      const user = (req as any).user;
      const targetOrgId = await AlertRuleService.enforceOrgAccess(
        user,
        AlertRuleService.extractRequestedOrgId(req)
      );

      // Verify cluster ownership if clusterId provided
      if (parseResult.data.clusterId && parseResult.data.clusterId !== 'ALL' && parseResult.data.clusterId !== 'all') {
        if (parseResult.data.clusterId !== 'null' && parseResult.data.clusterId !== 'org_wide') {
          const belongs = await AlertRuleModel.verifyClusterOwnership(parseResult.data.clusterId, targetOrgId);
          if (!belongs) {
            throw ApiError.forbidden('Cụm máy chủ không thuộc phạm vi tổ chức của bạn');
          }
        }
      }

      const result = await AlertLifecycleService.getAlertHistory(targetOrgId, parseResult.data);

      return res.status(200).json({
        success: true,
        message: 'Lấy danh sách lịch sử cảnh báo thành công',
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * GET /api/v1/alerts/history/summary or GET /api/alerts/history/summary
   * Summary counts for alert history (PBI22 Task 4.2)
   */
  public static async getHistorySummary(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const targetOrgId = await AlertRuleService.enforceOrgAccess(
        user,
        AlertRuleService.extractRequestedOrgId(req)
      );

      const clusterId = req.query.clusterId as string | undefined;
      const startDate = req.query.startDate as string | undefined;
      const endDate = req.query.endDate as string | undefined;

      if (clusterId && clusterId !== 'ALL' && clusterId !== 'all' && clusterId !== 'null' && clusterId !== 'org_wide') {
        const belongs = await AlertRuleModel.verifyClusterOwnership(clusterId, targetOrgId);
        if (!belongs) {
          throw ApiError.forbidden('Cụm máy chủ không thuộc phạm vi tổ chức của bạn');
        }
      }

      if (startDate && isNaN(new Date(startDate).getTime())) {
        throw ApiError.badRequest('startDate không hợp lệ');
      }
      if (endDate && isNaN(new Date(endDate).getTime())) {
        throw ApiError.badRequest('endDate không hợp lệ');
      }
      if (startDate && endDate && new Date(startDate).getTime() > new Date(endDate).getTime()) {
        throw ApiError.badRequest('startDate không được lớn hơn endDate');
      }

      const summary = await AlertLifecycleService.getAlertHistorySummary(targetOrgId, {
        clusterId,
        startDate,
        endDate,
      });

      return res.status(200).json({
        success: true,
        message: 'Lấy thống kê lịch sử cảnh báo thành công',
        data: summary,
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * GET /api/v1/alerts/history/:id or GET /api/alerts/history/:id
   * Get single alert history details by ID
   */
  public static async getHistoryById(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const targetOrgId = await AlertRuleService.enforceOrgAccess(
        user,
        AlertRuleService.extractRequestedOrgId(req)
      );

      const alert = await AlertLifecycleService.getAlertEventById(req.params.id, targetOrgId);

      return res.status(200).json({
        success: true,
        message: 'Lấy chi tiết lịch sử cảnh báo thành công',
        data: alert,
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * GET /api/v1/alerts/history/:id/timeline or GET /api/v1/alerts/:id/timeline
   * Get chronological status change history timeline
   */
  public static async getTimeline(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const targetOrgId = await AlertRuleService.enforceOrgAccess(
        user,
        AlertRuleService.extractRequestedOrgId(req)
      );

      const timeline = await AlertLifecycleService.getAlertTimeline(req.params.id, targetOrgId);

      return res.status(200).json({
        success: true,
        message: 'Lấy dòng thời gian lịch sử cảnh báo thành công',
        alert_id: req.params.id,
        timeline,
      });
    } catch (error) {
      return next(error);
    }
  }

  public static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const parseResult = ListAlertEventsQuerySchema.safeParse(req.query);
      if (!parseResult.success) {
        return next(
          new ApiError(
            400,
            parseResult.error.issues[0]?.message || 'Tham số truy vấn sự kiện cảnh báo không hợp lệ',
            parseResult.error.format()
          )
        );
      }

      const user = (req as any).user;
      const targetOrgId = await AlertRuleService.enforceOrgAccess(
        user,
        AlertRuleService.extractRequestedOrgId(req)
      );

      const result = await AlertLifecycleService.getAlertEvents(targetOrgId, parseResult.data as any);

      return ApiResponse.success(res, 'Lấy danh sách sự kiện cảnh báo thành công', result, 200);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * GET /api/v1/alert-events/:id
   * Get alert event details by ID
   */
  public static async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      if (!id) {
        return next(ApiError.badRequest('Thiếu ID sự kiện cảnh báo'));
      }

      const user = (req as any).user;
      const targetOrgId = await AlertRuleService.enforceOrgAccess(
        user,
        AlertRuleService.extractRequestedOrgId(req)
      );
      const event = await AlertLifecycleService.getAlertEventById(id, targetOrgId);

      return ApiResponse.success(res, 'Lấy chi tiết sự kiện cảnh báo thành công', event, 200);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * PATCH /api/v1/alert-events/:id/acknowledge
   * Acknowledge an active alert event
   */
  public static async acknowledge(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      if (!id) {
        return next(ApiError.badRequest('Thiếu ID sự kiện cảnh báo'));
      }

      const parseResult = AcknowledgeAlertEventSchema.safeParse(req.body);
      if (!parseResult.success) {
        return next(
          new ApiError(
            400,
            parseResult.error.issues[0]?.message || 'Dữ liệu xác nhận không hợp lệ',
            parseResult.error.format()
          )
        );
      }

      const user = (req as any).user;
      const targetOrgId = await AlertRuleService.enforceOrgAccess(
        user,
        AlertRuleService.extractRequestedOrgId(req)
      );
      const updated = await AlertLifecycleService.acknowledgeAlert(
        id,
        targetOrgId,
        user.id || user.userId,
        parseResult.data.note
      );

      return ApiResponse.success(res, 'Xác nhận sự kiện cảnh báo thành công', updated, 200);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * PATCH /api/v1/alert-events/:id/resolve
   * Manually resolve an alert event
   */
  public static async resolve(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      if (!id) {
        return next(ApiError.badRequest('Thiếu ID sự kiện cảnh báo'));
      }

      const parseResult = ResolveAlertEventSchema.safeParse(req.body);
      if (!parseResult.success) {
        return next(
          new ApiError(
            400,
            parseResult.error.issues[0]?.message || 'Dữ liệu giải quyết không hợp lệ',
            parseResult.error.format()
          )
        );
      }

      const user = (req as any).user;
      const targetOrgId = await AlertRuleService.enforceOrgAccess(
        user,
        AlertRuleService.extractRequestedOrgId(req)
      );
      const updated = await AlertLifecycleService.resolveAlertManually(
        id,
        targetOrgId,
        user.id || user.userId,
        parseResult.data.resolution_note
      );

      return ApiResponse.success(res, 'Giải quyết sự kiện cảnh báo thành công', updated, 200);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * POST /api/v1/alert-events/evaluate or POST /api/v1/alert-rules/evaluate
   * Trigger an evaluation run
   */
  public static async triggerEvaluation(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const targetOrgId = await AlertRuleService.enforceOrgAccess(
        user,
        AlertRuleService.extractRequestedOrgId(req)
      );

      const result = await RuleEngineExecutionService.runEvaluationCycle({
        organizationId: targetOrgId,
        clusterId: req.body?.cluster_id || undefined,
      });

      return ApiResponse.success(res, 'Chu kỳ đánh giá Rule Engine hoàn tất', result, 200);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * POST /api/v1/alerts/demo-ingest
   * Development/Test-only adapter that ingests fixture telemetry into real tables
   * (node_metrics, pods/kubernetes_events, agent_metrics), ensures Alert Rules exist,
   * and executes the full RuleEngineExecutionService pipeline.
   * Disabled in production (NODE_ENV === 'production').
   */
  public static async demoIngest(req: Request, res: Response, next: NextFunction) {
    try {
      if (config.isProduction || process.env.NODE_ENV === 'production') {
        throw ApiError.forbidden('Endpoint thử nghiệm chỉ khả dụng trong môi trường Development/Test');
      }

      const user = (req as any).user;
      const targetOrgId = await AlertRuleService.enforceOrgAccess(
        user,
        AlertRuleService.extractRequestedOrgId(req)
      );

      // 1. Resolve cluster for targetOrgId
      let targetClusterId: string | undefined = req.body?.cluster_id;
      let targetEnvId: string | undefined;

      if (targetClusterId) {
        const belongs = await AlertRuleModel.verifyClusterOwnership(targetClusterId, targetOrgId);
        if (!belongs) {
          throw ApiError.forbidden('Cụm máy chủ không thuộc phạm vi tổ chức của bạn');
        }
        const clRes = await pool.query(`SELECT environment_id FROM clusters WHERE id = $1`, [targetClusterId]);
        targetEnvId = clRes.rows[0]?.environment_id;
      } else {
        const clRes = await pool.query(
          `SELECT c.id, c.environment_id
           FROM clusters c
           JOIN environments e ON c.environment_id = e.id
           WHERE e.organization_id = $1 AND c.deleted_at IS NULL
           ORDER BY CASE WHEN c.name = 'k8s-pods-cluster-v2' THEN 0 ELSE 1 END, c.created_at ASC
           LIMIT 1`,
          [targetOrgId]
        );
        if (clRes.rows.length > 0) {
          targetClusterId = clRes.rows[0].id;
          targetEnvId = clRes.rows[0].environment_id;
        } else {
          // Create dev environment & cluster for organization if none exists
          const envInsert = await pool.query(
            `INSERT INTO environments (organization_id, name, code, environment_type, status, created_at, updated_at)
             VALUES ($1, 'Staging', 'staging-demo', 'STAGING', 'ACTIVE', NOW(), NOW())
             RETURNING id`,
            [targetOrgId]
          );
          targetEnvId = envInsert.rows[0].id;
          const clInsert = await pool.query(
            `INSERT INTO clusters (environment_id, name, provider, region, version, status, created_at, updated_at)
             VALUES ($1, 'k8s-demo-cluster', 'MINIKUBE', 'ap-southeast-1', '1.29', 'CONNECTED', NOW(), NOW())
             RETURNING id`,
            [targetEnvId]
          );
          targetClusterId = clInsert.rows[0].id;
        }
      }

      // 2. Resolve or create Agent for telemetry foreign keys
      let agentId: string;
      const agentRes = await pool.query(
        `SELECT id FROM agents WHERE cluster_id = $1 LIMIT 1`,
        [targetClusterId]
      );
      if (agentRes.rows.length > 0) {
        agentId = agentRes.rows[0].id;
      } else {
        const orgAgentRes = await pool.query(
          `SELECT a.id
           FROM agents a
           JOIN environments e ON a.environment_id = e.id
           WHERE e.organization_id = $1
           LIMIT 1`,
          [targetOrgId]
        );
        if (orgAgentRes.rows.length > 0) {
          agentId = orgAgentRes.rows[0].id;
        } else {
          const insAgent = await pool.query(
            `INSERT INTO agents (environment_id, cluster_id, name, agent_uid, version, status)
             VALUES ($1, $2, 'demo-ebpf-agent', $3, '1.29.4', 'ONLINE')
             RETURNING id`,
            [targetEnvId, targetClusterId, `uid-demo-${Date.now()}`]
          );
          agentId = insAgent.rows[0].id;
        }
      }

      const mode: 'trigger' | 'recover' = req.body?.mode === 'recover' ? 'recover' : 'trigger';
      const rawScenarios: any[] = Array.isArray(req.body?.scenarios)
        ? req.body.scenarios
        : req.body?.scenario
        ? [req.body.scenario]
        : [req.body];

      const processedScenarios: any[] = [];

      for (const sc of rawScenarios) {
        const ruleCfg = sc.rule || sc;
        const resourceCfg = typeof sc.resource === 'object' && sc.resource !== null ? sc.resource : {};
        const rawMetric = String(
          ruleCfg.metric_type || sc.metric_type || sc.metric || sc.event || ''
        )
          .toUpperCase()
          .trim();

        let metricType: AlertMetricType = 'CPU';
        if (rawMetric === 'CPU' || rawMetric === 'CPU_USAGE') {
          metricType = 'CPU';
        } else if (rawMetric === 'RAM' || rawMetric === 'RAM_USAGE') {
          metricType = 'RAM';
        } else if (rawMetric === 'DISK' || rawMetric === 'DISK_USAGE') {
          metricType = 'DISK';
        } else if (
          rawMetric === 'POD_CRASH_LOOP' ||
          rawMetric.includes('CRASHLOOP') ||
          rawMetric.includes('CRASH_LOOP')
        ) {
          metricType = 'POD_CRASH_LOOP';
        } else if (
          rawMetric === 'HTTP_5XX_RATE' ||
          rawMetric === 'APM_ERROR_RATE' ||
          rawMetric.includes('5XX') ||
          rawMetric.includes('ERROR_RATE')
        ) {
          metricType = 'HTTP_5XX_RATE';
        } else if (rawMetric === 'NETWORK_RECEIVE' || rawMetric.includes('NET_RX') || rawMetric.includes('RECEIVE')) {
          metricType = 'NETWORK_RECEIVE';
        } else if (rawMetric === 'NETWORK_TRANSMIT' || rawMetric.includes('NET_TX') || rawMetric.includes('TRANSMIT')) {
          metricType = 'NETWORK_TRANSMIT';
        } else if (rawMetric === 'LATENCY') {
          metricType = 'LATENCY';
        }

        const rawOp = String(ruleCfg.operator || sc.operator || 'GREATER_THAN')
          .toUpperCase()
          .trim();
        const opMap: Record<string, AlertOperator> = {
          GT: 'GREATER_THAN',
          GREATER_THAN: 'GREATER_THAN',
          GTE: 'GREATER_THAN_OR_EQUAL',
          GREATER_THAN_OR_EQUAL: 'GREATER_THAN_OR_EQUAL',
          LT: 'LESS_THAN',
          LESS_THAN: 'LESS_THAN',
          LTE: 'LESS_THAN_OR_EQUAL',
          LESS_THAN_OR_EQUAL: 'LESS_THAN_OR_EQUAL',
          EQ: 'EQUAL',
          EQUAL: 'EQUAL',
          NEQ: 'NOT_EQUAL',
          NOT_EQUAL: 'NOT_EQUAL',
        };
        const operator: AlertOperator = opMap[rawOp] || 'GREATER_THAN';

        const scenarioId = sc.scenario_id || sc.id || `${metricType}-DEMO`;
        const ruleName =
          ruleCfg.name || sc.rule_name || sc.name || `[${scenarioId}] Cảnh báo ${metricType}`;
        const thresholdValue = Number(
          ruleCfg.threshold ??
            ruleCfg.threshold_value ??
            sc.threshold ??
            sc.threshold_value ??
            (metricType === 'POD_CRASH_LOOP' ? 4 : metricType === 'HTTP_5XX_RATE' ? 5 : 85)
        );

        // Extract latest telemetry/signal value if nested in fixture
        const latestTelPoint = Array.isArray(sc.telemetry_points) && sc.telemetry_points.length > 0
          ? sc.telemetry_points[sc.telemetry_points.length - 1]
          : null;
        const latestApmPoint = Array.isArray(sc.apm_points) && sc.apm_points.length > 0
          ? sc.apm_points[sc.apm_points.length - 1]
          : null;
        const k8sSignal = sc.kubernetes_signal || null;

        const observedValue = Number(
          sc.expected_alert?.metric_value ??
            latestTelPoint?.cpu_usage_percent ??
            k8sSignal?.restart_count ??
            latestApmPoint?.error_rate_percent ??
            sc.value ??
            sc.observed_value ??
            (metricType === 'POD_CRASH_LOOP' ? 6 : metricType === 'HTTP_5XX_RATE' ? 11.2 : 96.1)
        );

        const rawUnit = String(ruleCfg.unit || sc.unit || '').toUpperCase().trim();
        const unit =
          rawUnit === 'PERCENT' || rawUnit === '%'
            ? '%'
            : rawUnit === 'COUNT' || rawUnit === 'RESTARTS'
            ? metricType === 'POD_CRASH_LOOP'
              ? 'restarts'
              : 'count'
            : ruleCfg.unit || sc.unit || (metricType === 'POD_CRASH_LOOP' ? 'restarts' : '%');

        const severity: AlertSeverity =
          ((sc.severity || ruleCfg.severity || sc.expected_alert?.severity || 'CRITICAL') as AlertSeverity);
        const duration = Number(
          ruleCfg.duration_seconds ??
            ruleCfg.duration ??
            sc.duration ??
            (metricType === 'POD_CRASH_LOOP' ? 0 : 60)
        );
        const evalWinSec = Number(ruleCfg.evaluation_window_seconds || 0);
        const evaluationWindow =
          ruleCfg.evaluation_window ||
          sc.evaluation_window ||
          (evalWinSec > 0 ? `${Math.max(evalWinSec, duration > 0 ? duration + 60 : evalWinSec)}s` : '5m');
        const cooldownSeconds = Number(
          ruleCfg.cooldown_seconds ?? sc.cooldown_seconds ?? 300
        );
        const isEnabled =
          ruleCfg.is_enabled !== undefined
            ? Boolean(ruleCfg.is_enabled)
            : ruleCfg.enabled !== undefined
            ? Boolean(ruleCfg.enabled)
            : true;

        // Ensure Alert Rule exists in PostgreSQL
        let rule = null;
        const existingRuleRes = await pool.query(
          `SELECT * FROM alert_rules WHERE organization_id = $1 AND LOWER(name) = LOWER($2) LIMIT 1`,
          [targetOrgId, ruleName]
        );
        if (existingRuleRes.rows.length > 0) {
          const existingRuleId = existingRuleRes.rows[0].id;
          rule = await AlertRuleModel.update(existingRuleId, targetOrgId, {
            cluster_id: targetClusterId,
            metric_type: metricType,
            operator,
            threshold_value: thresholdValue,
            unit,
            severity,
            evaluation_window: evaluationWindow,
            duration,
            cooldown_seconds: cooldownSeconds,
            enabled: isEnabled,
          });
        } else {
          rule = await AlertRuleModel.create({
            organization_id: targetOrgId,
            cluster_id: targetClusterId,
            name: ruleName,
            description:
              ruleCfg.description || sc.description || sc.title || `Quy tắc kịch bản kiểm thử ${scenarioId}`,
            metric_type: metricType,
            operator,
            threshold_value: thresholdValue,
            unit,
            severity,
            evaluation_window: evaluationWindow,
            duration,
            cooldown_seconds: cooldownSeconds,
            enabled: isEnabled,
            created_by: user.id || null,
          });
        }

        // Ingest raw telemetry into real source tables
        if (['CPU', 'RAM', 'DISK', 'NETWORK_RECEIVE', 'NETWORK_TRANSMIT'].includes(metricType)) {
          const nodeName =
            resourceCfg.resource_name ||
            (typeof sc.resource === 'string' && sc.resource.toUpperCase() !== 'NODE'
              ? sc.resource
              : sc.node_name || 'worker-node-01');
          const effectiveVal = mode === 'recover' ? Math.max(10, thresholdValue - 45) : observedValue;

          // Clear synthetic spikes in recent 15m window for this node so window AVG matches scenario
          await pool.query(
            `DELETE FROM node_metrics
             WHERE organization_id = $1 AND cluster_id = $2 AND node_name = $3
               AND collected_at >= NOW() - INTERVAL '15 minutes'`,
            [targetOrgId, targetClusterId, nodeName]
          );

          const cpuVal = metricType === 'CPU' ? effectiveVal : 35;
          const ramVal = metricType === 'RAM' ? effectiveVal : 45;
          const diskVal = metricType === 'DISK' ? effectiveVal : 40;
          const rxVal = metricType === 'NETWORK_RECEIVE' ? effectiveVal : 102400;
          const txVal = metricType === 'NETWORK_TRANSMIT' ? effectiveVal : 51200;

          await pool.query(
            `INSERT INTO node_metrics (
               agent_id, organization_id, cluster_id, node_name,
               cpu_usage_percent, cpu_cores, ram_usage_percent, ram_used_bytes, ram_total_bytes,
               disk_usage_percent, disk_used_bytes, disk_total_bytes,
               net_rx_bytes_per_sec, net_tx_bytes_per_sec, collected_at
             ) VALUES
               ($1, $2, $3, $4, $5, 8, $6, 4294967296, 8589934592, $7, 42949672960, 107374182400, $8, $9, NOW() - INTERVAL '90 seconds'),
               ($1, $2, $3, $4, $5, 8, $6, 4294967296, 8589934592, $7, 42949672960, 107374182400, $8, $9, NOW() - INTERVAL '45 seconds'),
               ($1, $2, $3, $4, $5, 8, $6, 4294967296, 8589934592, $7, 42949672960, 107374182400, $8, $9, NOW())`,
            [agentId, targetOrgId, targetClusterId, nodeName, cpuVal, ramVal, diskVal, rxVal, txVal]
          );

          processedScenarios.push({
            scenario_id: scenarioId,
            metric_type: metricType,
            resource_type: 'node',
            resource_id: nodeName,
            resource_name: nodeName,
            rule_id: rule?.id,
            ingested_value: effectiveVal,
            mode,
          });
        } else if (metricType === 'POD_CRASH_LOOP') {
          const podName =
            resourceCfg.resource_name ||
            (typeof sc.resource === 'string' && sc.resource.toUpperCase() !== 'POD'
              ? sc.resource
              : 'orders-api-7d9c8b6f4-x9k2m');
          const nsName = resourceCfg.namespace || sc.namespace || 'production';

          // Ensure namespace
          let nsId: string;
          const nsRes = await pool.query(
            `SELECT id FROM namespaces WHERE cluster_id = $1 AND name = $2 AND deleted_at IS NULL LIMIT 1`,
            [targetClusterId, nsName]
          );
          if (nsRes.rows.length > 0) {
            nsId = nsRes.rows[0].id;
          } else {
            const insNs = await pool.query(
              `INSERT INTO namespaces (cluster_id, name, status)
               VALUES ($1, $2, 'Active')
               RETURNING id`,
              [targetClusterId, nsName]
            );
            nsId = insNs.rows[0].id;
          }

          // Ensure workload
          let workloadId: string;
          const wlRes = await pool.query(
            `SELECT id FROM workloads WHERE cluster_id = $1 AND namespace_id = $2 AND name = $3 AND deleted_at IS NULL LIMIT 1`,
            [targetClusterId, nsId, podName]
          );
          if (wlRes.rows.length > 0) {
            workloadId = wlRes.rows[0].id;
          } else {
            const insWl = await pool.query(
              `INSERT INTO workloads (cluster_id, namespace_id, name, workload_type, status)
               VALUES ($1, $2, $3, 'Deployment', $4)
               RETURNING id`,
              [targetClusterId, nsId, podName, mode === 'recover' ? 'Running' : 'Degraded']
            );
            workloadId = insWl.rows[0].id;
          }

          // Upsert pod
          const podStatus = mode === 'recover' ? 'Running' : 'CrashLoopBackOff';
          const restartCount = mode === 'recover' ? 0 : observedValue;
          const existingPod = await pool.query(
            `SELECT id FROM pods WHERE cluster_id = $1 AND name = $2 AND deleted_at IS NULL LIMIT 1`,
            [targetClusterId, podName]
          );
          if (existingPod.rows.length > 0) {
            await pool.query(
              `UPDATE pods
               SET namespace_id = $1, workload_id = $2, status = $3, phase = 'Running', restart_count = $4, updated_at = NOW()
               WHERE id = $5`,
              [nsId, workloadId, podStatus, restartCount, existingPod.rows[0].id]
            );
          } else {
            await pool.query(
              `INSERT INTO pods (cluster_id, namespace_id, workload_id, name, status, phase, restart_count)
               VALUES ($1, $2, $3, $4, $5, 'Running', $6)`,
              [targetClusterId, nsId, workloadId, podName, podStatus, restartCount]
            );
          }

          // Also record Kubernetes event if triggering (best-effort)
          if (mode === 'trigger') {
            try {
              await pool.query(
                `INSERT INTO kubernetes_events (
                   cluster_id, namespace_id, event_type, reason, message, count,
                   first_seen_at, last_seen_at
                 ) VALUES ($1, $2, 'Warning', $3, $4, $5, NOW() - INTERVAL '2 minutes', NOW())`,
                [
                  targetClusterId,
                  nsId,
                  k8sSignal?.event_reason || 'BackOff',
                  k8sSignal?.event_message ||
                    `Back-off restarting failed container in pod ${podName} (namespace: ${nsName})`,
                  restartCount,
                ]
              );
            } catch {
              // Optional telemetry event table
            }
          }

          processedScenarios.push({
            scenario_id: scenarioId,
            metric_type: metricType,
            resource_type: 'pod',
            resource_id: podName,
            resource_name: podName,
            namespace: nsName,
            rule_id: rule?.id,
            ingested_value: restartCount,
            mode,
          });
        } else if (['HTTP_5XX_RATE', 'ERROR_RATE', 'LATENCY'].includes(metricType)) {
          const serviceName =
            resourceCfg.resource_name ||
            (typeof sc.resource === 'string' && sc.resource.toUpperCase() !== 'SERVICE'
              ? sc.resource
              : sc.service_id || 'checkout-service');
          const effectiveVal = mode === 'recover' ? 0.5 : observedValue;

          await pool.query(
            `DELETE FROM agent_metrics
             WHERE organization_id = $1 AND cluster_id = $2 AND service_id = $3
               AND collected_at >= NOW() - INTERVAL '15 minutes'`,
            [targetOrgId, targetClusterId, serviceName]
          );

          const rate5xx = metricType === 'LATENCY' ? 0.5 : effectiveVal;
          const latencyVal = metricType === 'LATENCY' ? effectiveVal : 320;

          await pool.query(
            `INSERT INTO agent_metrics (
               agent_id, organization_id, cluster_id, pod_id, service_id,
               http_5xx_rate, latency, request_rate, collected_at
             ) VALUES
               ($1, $2, $3, $4, $5, $6, $7, 145, NOW() - INTERVAL '90 seconds'),
               ($1, $2, $3, $4, $5, $6, $7, 150, NOW() - INTERVAL '45 seconds'),
               ($1, $2, $3, $4, $5, $6, $7, 155, NOW())`,
            [agentId, targetOrgId, targetClusterId, `${serviceName}-pod-1`, serviceName, rate5xx, latencyVal]
          );

          processedScenarios.push({
            scenario_id: scenarioId,
            metric_type: metricType,
            resource_type: 'service',
            resource_id: serviceName,
            resource_name: serviceName,
            rule_id: rule?.id,
            ingested_value: effectiveVal,
            mode,
          });
        }
      }

      // Invalidate rule cache before running evaluation
      try {
        await RedisCacheService.delByPattern(`alert_rules:${targetOrgId}:*`);
      } catch {
        // Ignore
      }

      // 3. Run real RuleEngineExecutionService evaluation cycle
      const evaluation = await RuleEngineExecutionService.runEvaluationCycle({
        organizationId: targetOrgId,
        clusterId: targetClusterId,
      });

      // 4. Query updated alerts from database
      const alertsResult = await AlertEventModel.findByOrg(targetOrgId, {
        cluster_id: targetClusterId,
        limit: 50,
      });

      return ApiResponse.success(
        res,
        mode === 'recover'
          ? 'Đã nạp dữ liệu hồi phục và đánh giá tự động giải quyết cảnh báo'
          : 'Đã nạp dữ liệu kịch bản kiểm thử và kích hoạt đánh giá Rule Engine thành công',
        {
          organization_id: targetOrgId,
          cluster_id: targetClusterId,
          mode,
          scenarios_processed: processedScenarios,
          ingested_scenarios: processedScenarios,
          evaluation,
          alerts: alertsResult.items,
        },
        200
      );
    } catch (error) {
      return next(error);
    }
  }
}
