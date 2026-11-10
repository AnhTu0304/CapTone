import { Request, Response, NextFunction } from 'express';
import {
  context,
  metrics,
  propagation,
  trace,
  Span,
  SpanStatusCode,
} from '@opentelemetry/api';

const meter = metrics.getMeter('selfheal-backend', '1.0.0');
export const backendTracer = trace.getTracer('selfheal-backend', '1.0.0');

// 1. HTTP Metrics
const httpRequestsCounter = meter.createCounter('selfheal.backend.http.requests', {
  description: 'Total incoming HTTP requests',
  unit: '{request}',
});

const httpDurationHistogram = meter.createHistogram('selfheal.backend.http.duration', {
  description: 'HTTP request latency in seconds',
  unit: 's',
});

const httpErrorsCounter = meter.createCounter('selfheal.backend.http.errors', {
  description: 'Total failed HTTP responses (status >= 400)',
  unit: '{error}',
});

// 2. Database Metrics
const dbOperationDurationHistogram = meter.createHistogram('selfheal.backend.db.operation.duration', {
  description: 'PostgreSQL query latency in seconds',
  unit: 's',
});

const dbErrorsCounter = meter.createCounter('selfheal.backend.db.errors', {
  description: 'Database connection and query errors',
  unit: '{error}',
});

// 3. External Service (AI Backend) Metrics
const externalDurationHistogram = meter.createHistogram('selfheal.backend.external.duration', {
  description: 'Outbound request duration to AI Service in seconds',
  unit: 's',
});

// 4. Authentication Failure Metrics
const authFailuresCounter = meter.createCounter('selfheal.backend.auth.failures', {
  description: 'Authentication and token validation failures',
  unit: '{failure}',
});

// 5. Background Job Metrics
const backgroundJobsCounter = meter.createCounter('selfheal.backend.background.jobs', {
  description: 'Background worker and pipeline cycle executions',
  unit: '{execution}',
});

const backgroundDurationHistogram = meter.createHistogram('selfheal.backend.background.duration', {
  description: 'Background worker and pipeline execution duration in seconds',
  unit: 's',
});

// 6. Agent Heartbeat Processing Metrics
const agentHeartbeatsCounter = meter.createCounter('selfheal.backend.agent.heartbeats', {
  description: 'Agent heartbeats processed by Backend',
  unit: '{heartbeat}',
});

// 7. Remediation Command Lifecycle Metrics
const remediationActionsCounter = meter.createCounter('selfheal.backend.remediation.actions', {
  description: 'Remediation command lifecycle transitions',
  unit: '{action}',
});

const remediationDurationHistogram = meter.createHistogram('selfheal.backend.remediation.duration', {
  description: 'End-to-end remediation command execution duration in seconds',
  unit: 's',
});

/**
 * Normalize an Express request path to a low-cardinality route template.
 * Replaces UUIDs and numeric IDs with `:id` when `req.route` is unavailable.
 */
export function normalizeHttpRoute(req: Request): string {
  if (req.route && typeof req.route.path === 'string') {
    const base = req.baseUrl || '';
    const routePath = req.route.path === '/' && base ? '' : req.route.path;
    return `${base}${routePath}` || '/';
  }
  const rawPath = (req.originalUrl || req.url || '/').split('?')[0];
  return rawPath
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id')
    .replace(/\/\d+(?=\/|$)/g, '/:id');
}

/**
 * Express middleware that records HTTP request count, duration, and errors
 * without capturing any sensitive headers or high-cardinality user/request IDs.
 */
export function otelHttpMiddleware(req: Request, res: Response, next: NextFunction): void {
  const startHrTime = process.hrtime.bigint();

  res.on('finish', () => {
    try {
      const durationSeconds = Number(process.hrtime.bigint() - startHrTime) / 1e9;
      const method = (req.method || 'GET').toUpperCase();
      const route = normalizeHttpRoute(req);
      const statusCode = res.statusCode || 200;

      const baseAttrs = {
        'http.request.method': method,
        'http.route': route,
        'http.response.status_code': statusCode,
      };

      httpRequestsCounter.add(1, baseAttrs);
      httpDurationHistogram.record(durationSeconds, baseAttrs);

      if (statusCode >= 400) {
        httpErrorsCounter.add(1, {
          ...baseAttrs,
          'error.category': statusCode >= 500 ? 'server_error' : 'client_error',
        });
      }
    } catch {
      // Never impact HTTP response lifecycle
    }
  });

  next();
}

export function extractSqlOperation(sqlText: unknown): string {
  if (typeof sqlText !== 'string') return 'OTHER';
  const match = sqlText.trim().match(/^([A-Za-z]+)/);
  if (!match) return 'OTHER';
  const verb = match[1].toUpperCase();
  if (verb === 'SELECT' || verb === 'INSERT' || verb === 'UPDATE' || verb === 'DELETE') {
    return verb;
  }
  return 'OTHER';
}

export function recordDbOperation(
  operation: string,
  status: 'success' | 'error',
  durationSeconds: number
): void {
  try {
    dbOperationDurationHistogram.record(durationSeconds, {
      'db.system': 'postgresql',
      'db.operation': operation,
      status,
    });
  } catch {
    // No-op on telemetry error
  }
}

export function recordDbError(errorType: 'pool_error' | 'query_error' | 'timeout'): void {
  try {
    dbErrorsCounter.add(1, {
      'db.system': 'postgresql',
      'error.type': errorType,
    });
  } catch {
    // No-op on telemetry error
  }
}

export function recordExternalCall(
  peerService: 'ai-backend',
  operation: 'health' | 'predict' | 'rca',
  status: 'success' | 'error' | 'timeout',
  durationSeconds: number
): void {
  try {
    externalDurationHistogram.record(durationSeconds, {
      'peer.service': peerService,
      operation,
      status,
    });
  } catch {
    // No-op on telemetry error
  }
}

export function recordAuthFailure(
  authType: 'jwt' | 'agent_token',
  reason: 'missing_token' | 'invalid_token' | 'expired_token' | 'user_inactive' | 'agent_revoked'
): void {
  try {
    authFailuresCounter.add(1, {
      'auth.type': authType,
      'failure.reason': reason,
    });
  } catch {
    // No-op on telemetry error
  }
}

export function recordBackgroundJob(
  jobName: 'telemetry_pipeline' | 'rule_engine' | 'agent_timeout' | 'audit_retention',
  status: 'success' | 'error',
  durationSeconds: number
): void {
  try {
    backgroundJobsCounter.add(1, {
      'job.name': jobName,
      status,
    });
    backgroundDurationHistogram.record(durationSeconds, {
      'job.name': jobName,
    });
  } catch {
    // No-op on telemetry error
  }
}

export function recordAgentHeartbeat(
  channel: 'http' | 'ws',
  status: 'success' | 'error'
): void {
  try {
    agentHeartbeatsCounter.add(1, {
      channel,
      status,
    });
  } catch {
    // No-op on telemetry error
  }
}

export type RemediationLifecycleState =
  | 'triggered'
  | 'hitl_pending'
  | 'approved'
  | 'rejected'
  | 'dispatched'
  | 'succeeded'
  | 'failed'
  | 'aborted';

export function recordRemediationAction(
  actionType: string,
  lifecycleState: RemediationLifecycleState
): void {
  try {
    remediationActionsCounter.add(1, {
      'action.type': actionType || 'UNKNOWN',
      'lifecycle.state': lifecycleState,
    });
  } catch {
    // No-op on telemetry error
  }
}

export function recordRemediationDuration(
  actionType: string,
  status: 'success' | 'failed',
  durationSeconds: number
): void {
  try {
    remediationDurationHistogram.record(durationSeconds, {
      'action.type': actionType || 'UNKNOWN',
      status,
    });
  } catch {
    // No-op on telemetry error
  }
}

/**
 * Inject active W3C TraceContext headers (`traceparent`, `tracestate`) into a carrier object.
 */
export function injectTraceContext(carrier: Record<string, string> = {}): Record<string, string> {
  try {
    propagation.inject(context.active(), carrier);
  } catch {
    // Ignore propagation errors
  }
  return carrier;
}

/**
 * Execute an async function inside an OpenTelemetry Span with automatic error recording.
 */
export async function withBackendSpan<T>(
  spanName: string,
  attributes: Record<string, string | number | boolean>,
  fn: (span: Span) => Promise<T>
): Promise<T> {
  return backendTracer.startActiveSpan(spanName, { attributes }, async (span) => {
    try {
      const result = await fn(span);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (err) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: err instanceof Error ? err.name : 'Error',
      });
      throw err;
    } finally {
      span.end();
    }
  });
}
