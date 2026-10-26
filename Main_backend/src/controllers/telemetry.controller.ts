import { Request, Response, NextFunction } from 'express';
import { TelemetryAggregatorService } from '../services/telemetryAggregator.service';
import { AgentService } from '../services/agent.service';
import { ApiResponse } from '../utils/apiResponse';
import { expandRoles } from '../middlewares/rbac.middleware';
import {
  GetServiceSequenceQuerySchema,
  GetRcaContextQuerySchema,
  EvaluateServiceBodySchema,
} from '../schemas/telemetry.schema';

export class TelemetryController {
  /**
   * GET /api/v1/telemetry/services/:serviceId/metrics-sequence
   * Aggregate pod metrics across time buckets to prepare 12x8 GRU sequence
   */
  public static async getMetricsSequence(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<any> {
    try {
      const { serviceId } = req.params;
      const parsedQuery = GetServiceSequenceQuerySchema.safeParse(req.query);

      if (!parsedQuery.success) {
        return ApiResponse.error(
          res,
          'Validation failed: Invalid query parameters for metrics sequence',
          400,
          parsedQuery.error.format()
        );
      }

      const { bucket_seconds, limit, fill_padding, from, to, start_time, end_time, cluster_id } = parsedQuery.data;

      const rawFrom = from || start_time;
      const rawTo = to || end_time;
      let startTime: Date | undefined;
      let endTime: Date | undefined;

      if (rawFrom) {
        const d = new Date(rawFrom);
        if (!isNaN(d.getTime())) startTime = d;
      }
      if (rawTo) {
        const d = new Date(rawTo);
        if (!isNaN(d.getTime())) endTime = d;
      }

      const sequence = await TelemetryAggregatorService.getServiceMetricsSequence(serviceId, {
        bucketSeconds: bucket_seconds,
        limit,
        fillPadding: fill_padding,
        startTime,
        endTime,
        clusterId: cluster_id,
      });

      return ApiResponse.success(
        res,
        `Retrieved ${sequence.length} metric points sequence for service '${serviceId}'`,
        {
          service_id: serviceId,
          bucket_seconds,
          count: sequence.length,
          sequence,
        },
        200
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/telemetry/services/:serviceId/rca-context
   * Filter relevant logs (prioritizing ERROR/WARN) and K8s events for RCA context
   */
  public static async getRcaContext(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<any> {
    try {
      const { serviceId } = req.params;
      const parsedQuery = GetRcaContextQuerySchema.safeParse(req.query);

      if (!parsedQuery.success) {
        return ApiResponse.error(
          res,
          'Validation failed: Invalid query parameters for RCA context',
          400,
          parsedQuery.error.format()
        );
      }

      const { window_minutes, log_limit, event_limit } = parsedQuery.data;

      const rcaContext = await TelemetryAggregatorService.buildRcaContext(serviceId, {
        windowMinutes: window_minutes,
        logLimit: log_limit,
        eventLimit: event_limit,
      });

      return ApiResponse.success(
        res,
        `Filtered RCA context for service '${serviceId}' (logs: ${rcaContext.logs.length}, events: ${rcaContext.kubernetes_events.length})`,
        rcaContext,
        200
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/telemetry/services/:serviceId/evaluate
   * Full end-to-end evaluation: metrics sequence -> rule engine -> GRU forecast -> AI RCA
   */
  public static async evaluateService(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<any> {
    try {
      const { serviceId } = req.params;
      const parsedBody = EvaluateServiceBodySchema.safeParse(req.body);

      if (!parsedBody.success) {
        return ApiResponse.error(
          res,
          'Validation failed: Invalid body parameters for service evaluation',
          400,
          parsedBody.error.format()
        );
      }

      const { bucket_seconds, window_minutes, force_rca, auto_trigger_rca } = parsedBody.data;

      const result = await TelemetryAggregatorService.evaluateAndDiagnoseService(serviceId, {
        bucketSeconds: bucket_seconds,
        windowMinutes: window_minutes,
        forceRca: force_rca,
        autoTriggerRca: auto_trigger_rca,
      });

      return ApiResponse.success(
        res,
        `Evaluation and diagnosis completed for service '${serviceId}'`,
        result,
        200
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * Internal helper to fetch live summary payload for REST API and WebSocket broadcast
   */
  public static async getLiveSummaryData(serviceId: string = 'sme-order-service', clusterId?: string) {
    return TelemetryAggregatorService.getLiveSummaryData(serviceId, clusterId);
  }

  public static async getLiveSummary(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<any> {
    try {
      const serviceId = (req.query.service_id as string) || 'sme-order-service';
      const clusterId = (req.query.cluster_id as string) || undefined;
      const data = await TelemetryController.getLiveSummaryData(serviceId, clusterId);

      const user = (req as any).user;
      const userRoles: string[] = Array.isArray(user?.roles) ? user.roles : (user?.roles ? [user.roles] : []);
      const expanded = expandRoles(userRoles);
      const isPrivileged = expanded.some((r) => ['SUPER_ADMIN', 'ADMIN', 'SYSTEM_ADMIN', 'DEVOPS'].includes(r));

      const payload = isPrivileged
        ? data
        : {
            ...data,
            raw_metrics: [],
            logs: [],
            events: [],
            incidents: [],
            recommendations: [],
            predictions: [],
          };

      return ApiResponse.success(res, 'Live telemetry summary fetched successfully', payload, 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/telemetry/node-metrics
   * Query host/node resource metrics by agent_id, cluster_id, node_name, and time range
   */
  public static async getNodeMetrics(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<any> {
    try {
      const result = await AgentService.queryNodeMetricsScoped({
        user: (req as any).user,
        orgMember: (req as any).orgMember,
        query: req.query as Record<string, any>,
      });

      return ApiResponse.success(
        res,
        `Retrieved ${result.count} node metric records`,
        result,
        200
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/telemetry/services
   * Returns distinct microservices monitored by APM with summary KPIs
   */
  public static async getApmServices(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<any> {
    try {
      const windowMinutes = Math.min(1440, Math.max(5, Number(req.query.window_minutes) || 60));
      const clusterId = (req.query.cluster_id as string) || undefined;
      const user = (req as any).user;
      const userRoles: string[] = Array.isArray(user?.roles) ? user.roles : (user?.roles ? [user.roles] : []);
      const isGlobalAdmin = userRoles.some((r) => ['SUPER_ADMIN', 'SYSTEM_ADMIN'].includes(String(r).toUpperCase()));
      const orgId = isGlobalAdmin
        ? (req.query.organization_id as string) || undefined
        : user?.organizationId || user?.organization_id || (req.query.organization_id as string) || undefined;

      const services = await TelemetryAggregatorService.getApmServicesSummary(windowMinutes, {
        clusterId,
        organizationId: orgId,
      });

      return ApiResponse.success(
        res,
        `Retrieved ${services.length} APM microservices`,
        services,
        200
      );
    } catch (error) {
      next(error);
    }
  }
}
