import { pool } from '../config/database';
import { Request, Response, NextFunction } from 'express';
import { TelemetryAggregatorService } from '../services/telemetryAggregator.service';
import { ApiResponse } from '../utils/apiResponse';
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

      const { bucket_seconds, limit, fill_padding } = parsedQuery.data;

      const sequence = await TelemetryAggregatorService.getServiceMetricsSequence(serviceId, {
        bucketSeconds: bucket_seconds,
        limit,
        fillPadding: fill_padding,
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
  public static async getLiveSummaryData(serviceId: string = 'sme-order-service') {
    // 1. Agents list
    const agentsRes = await pool.query(
      `SELECT id, name, agent_uid, cluster_id, status, last_seen_at
       FROM agents
       ORDER BY last_seen_at DESC`
    );

    // 2. Metrics sequence (last 15 points)
    const sequence = await TelemetryAggregatorService.getServiceMetricsSequence(serviceId, {
      bucketSeconds: 5,
      limit: 15,
      fillPadding: false,
    });

    // 3. Raw Pod metrics (last 10 records)
    const rawMetricsRes = await pool.query(
      `SELECT id, service_id, pod_id, cpu, ram, disk, request_rate, latency, http_5xx_rate, pod_restart_count, replica_count, collected_at
       FROM agent_metrics
       ORDER BY collected_at DESC
       LIMIT 10`
    );

    // 4. Live logs (last 30 logs)
    const logsRes = await pool.query(
      `SELECT id, service_id, level, message, source, occurred_at, metadata
       FROM logs
       ORDER BY occurred_at DESC
       LIMIT 30`
    );

    // 5. Live K8s Events (last 20 events)
    const eventsRes = await pool.query(
      `SELECT id, event_type, reason, message, first_seen_at, last_seen_at, count, metadata
       FROM kubernetes_events
       ORDER BY last_seen_at DESC
       LIMIT 20`
    );

    // 6. Recent incidents
    const incidentsRes = await pool.query(
      `SELECT id, title, severity, incident_type, description, status, detected_at, created_at
       FROM incidents
       ORDER BY created_at DESC
       LIMIT 10`
    );

    // 7. Recent AI Recommendations
    const recsRes = await pool.query(
      `SELECT r.id, r.incident_id, r.recommendation, r.reasoning, r.risk_level, r.priority, r.status, r.created_at
       FROM ai_recommendations r
       ORDER BY r.created_at DESC
       LIMIT 10`
    );

    // 8. Recent AI Predictions
    const predRes = await pool.query(
      `SELECT id, prediction_type, risk_score, confidence_score, status, predicted_at, expires_at
       FROM ai_predictions
       ORDER BY predicted_at DESC
       LIMIT 5`
    );

    const latestPoint = sequence.length > 0 ? sequence[sequence.length - 1] : null;

    return {
      service_id: serviceId,
      agents: agentsRes.rows,
      sequence,
      latest_point: latestPoint,
      raw_metrics: rawMetricsRes.rows,
      logs: logsRes.rows,
      events: eventsRes.rows,
      incidents: incidentsRes.rows,
      recommendations: recsRes.rows,
      predictions: predRes.rows,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * GET /api/v1/telemetry/live-summary
   * Provides unified real-time telemetry payload for Frontend Dashboard
   */
  public static async getLiveSummary(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<any> {
    try {
      const serviceId = (req.query.service_id as string) || 'sme-order-service';
      const data = await TelemetryController.getLiveSummaryData(serviceId);
      return ApiResponse.success(res, 'Live telemetry summary fetched successfully', data, 200);
    } catch (error) {
      next(error);
    }
  }
}
