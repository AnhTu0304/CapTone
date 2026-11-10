import os from 'os';
import dotenv from 'dotenv';
import path from 'path';
import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { defaultResource, resourceFromAttributes } from '@opentelemetry/resources';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import { PgInstrumentation } from '@opentelemetry/instrumentation-pg';
import { IORedisInstrumentation } from '@opentelemetry/instrumentation-ioredis';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

let sdk: NodeSDK | null = null;
let metricReader: PeriodicExportingMetricReader | null = null;
let initialized = false;

export function isOtelEnabled(): boolean {
  if (process.env.OTEL_ENABLED === 'false') return false;
  if (process.env.OTEL_ENABLED === 'true') return true;
  if (process.env.NODE_ENV === 'test' || process.env.NODE_TEST_CONTEXT) return false;
  return true;
}

export function initOtel(): void {
  if (initialized || !isOtelEnabled()) {
    return;
  }
  initialized = true;

  try {
    if (process.env.OTEL_LOG_LEVEL === 'debug') {
      diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
    }

    const rawEndpoint = (
      process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318'
    ).replace(/\/+$/, '');

    const serviceName = process.env.OTEL_SERVICE_NAME || 'selfheal-backend';
    const serviceVersion = process.env.OTEL_SERVICE_VERSION || '1.0.0';
    const deploymentEnv =
      process.env.DEPLOYMENT_ENVIRONMENT || process.env.NODE_ENV || 'development';
    const serviceNamespace = process.env.OTEL_SERVICE_NAMESPACE || 'selfheal-system';
    const k8sNamespace =
      process.env.K8S_NAMESPACE_NAME || process.env.K8S_NAMESPACE || 'captone';
    const k8sPodName = process.env.K8S_POD_NAME || process.env.HOSTNAME || os.hostname();
    const k8sNodeName = process.env.K8S_NODE_NAME || 'local-node';
    const exportIntervalMs = Math.max(
      1000,
      parseInt(process.env.OTEL_METRIC_EXPORT_INTERVAL_MS || '10000', 10) || 10000
    );

    const resource = defaultResource().merge(
      resourceFromAttributes({
        'service.name': serviceName,
        'service.version': serviceVersion,
        'deployment.environment': deploymentEnv,
        'service.namespace': serviceNamespace,
        'k8s.namespace.name': k8sNamespace,
        'k8s.pod.name': k8sPodName,
        'k8s.node.name': k8sNodeName,
      })
    );

    const metricExporter = new OTLPMetricExporter({
      url: `${rawEndpoint}/v1/metrics`,
      timeoutMillis: 5000,
    });

    const traceExporter = new OTLPTraceExporter({
      url: `${rawEndpoint}/v1/traces`,
      timeoutMillis: 5000,
    });

    metricReader = new PeriodicExportingMetricReader({
      exporter: metricExporter,
      exportIntervalMillis: exportIntervalMs,
      exportTimeoutMillis: Math.min(5000, exportIntervalMs),
    });

    sdk = new NodeSDK({
      resource,
      traceExporter,
      metricReaders: [metricReader],
      instrumentations: [
        new HttpInstrumentation({
          ignoreIncomingRequestHook: (req) => req.url === '/favicon.ico',
        }),
        new ExpressInstrumentation(),
        new PgInstrumentation({
          enhancedDatabaseReporting: false,
        }),
        new IORedisInstrumentation(),
      ],
    });

    sdk.start();
    console.log(
      `[OTel] Initialized OpenTelemetry for ${serviceName} -> ${rawEndpoint} (interval=${exportIntervalMs}ms)`
    );
  } catch (err) {
    console.warn('[OTel] Failed to initialize OpenTelemetry SDK (continuing without OTel):', err);
  }
}

export async function forceFlushOtel(): Promise<void> {
  try {
    if (metricReader) {
      await metricReader.forceFlush();
    }
  } catch (err) {
    // Never crash on telemetry flush failure
  }
}

export async function shutdownOtel(): Promise<void> {
  try {
    if (metricReader) {
      await metricReader.forceFlush().catch(() => undefined);
    }
    if (sdk) {
      await sdk.shutdown();
      sdk = null;
      metricReader = null;
      initialized = false;
    }
  } catch (err) {
    console.warn('[OTel] Error during OpenTelemetry shutdown (ignored):', err);
  }
}

// Auto-initialize when imported at server startup
initOtel();
