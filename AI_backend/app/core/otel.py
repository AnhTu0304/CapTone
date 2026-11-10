from __future__ import annotations

import logging
import os
import sys
from contextlib import contextmanager
from typing import Any, Iterator, Mapping

logger = logging.getLogger(__name__)

try:
    from opentelemetry import metrics, trace
    from opentelemetry.exporter.otlp.proto.http.metric_exporter import OTLPMetricExporter
    from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
    from opentelemetry.propagate import extract
    from opentelemetry.sdk.metrics import MeterProvider
    from opentelemetry.sdk.metrics.export import PeriodicExportingMetricReader
    from opentelemetry.sdk.resources import Resource
    from opentelemetry.sdk.trace import TracerProvider
    from opentelemetry.sdk.trace.export import BatchSpanProcessor
    from opentelemetry.trace import SpanKind

    _OTEL_AVAILABLE = True
except Exception:  # pragma: no cover - optional dependency fallback
    _OTEL_AVAILABLE = False

_meter_provider: Any = None
_tracer_provider: Any = None
_initialized: bool = False

_prediction_counter: Any = None
_prediction_duration_hist: Any = None
_rca_counter: Any = None
_rca_duration_hist: Any = None


def _is_enabled() -> bool:
    raw = os.getenv("OTEL_ENABLED")
    if raw is not None:
        return raw.strip().lower() in ("true", "1", "yes")
    return "pytest" not in sys.modules


def init_ai_otel() -> None:
    """Initialize OpenTelemetry SDK for the AI Prediction & RCA service."""
    global _meter_provider, _tracer_provider, _initialized
    global _prediction_counter, _prediction_duration_hist, _rca_counter, _rca_duration_hist

    if _initialized:
        return
    if not _is_enabled() or not _OTEL_AVAILABLE:
        return

    endpoint = os.getenv(
        "OTEL_EXPORTER_OTLP_ENDPOINT",
        "http://otel-collector-opentelemetry-collector.monitoring.svc.cluster.local:4318",
    ).rstrip("/")
    export_interval_ms = int(os.getenv("OTEL_METRIC_EXPORT_INTERVAL_MS", "15000"))

    try:
        resource = Resource.create(
            {
                "service.name": os.getenv("OTEL_SERVICE_NAME", "selfheal-ai-service"),
                "service.version": os.getenv("OTEL_SERVICE_VERSION", "1.0.0"),
                "deployment.environment": os.getenv(
                    "DEPLOYMENT_ENVIRONMENT", os.getenv("APP_ENV", "development")
                ),
                "service.namespace": os.getenv("OTEL_SERVICE_NAMESPACE", "selfheal-system"),
                "k8s.namespace.name": os.getenv("K8S_NAMESPACE_NAME", "selfheal-system"),
                "k8s.pod.name": os.getenv("K8S_POD_NAME", os.getenv("HOSTNAME", "local-ai-pod")),
                "k8s.node.name": os.getenv("K8S_NODE_NAME", "minikube"),
            }
        )

        metric_exporter = OTLPMetricExporter(
            endpoint=f"{endpoint}/v1/metrics",
            timeout=5,
        )
        metric_reader = PeriodicExportingMetricReader(
            exporter=metric_exporter,
            export_interval_millis=export_interval_ms,
            export_timeout_millis=5000,
        )
        _meter_provider = MeterProvider(resource=resource, metric_readers=[metric_reader])
        metrics.set_meter_provider(_meter_provider)

        span_exporter = OTLPSpanExporter(
            endpoint=f"{endpoint}/v1/traces",
            timeout=5,
        )
        _tracer_provider = TracerProvider(resource=resource)
        _tracer_provider.add_span_processor(
            BatchSpanProcessor(
                span_exporter,
                max_queue_size=512,
                schedule_delay_millis=5000,
                export_timeout_millis=5000,
            )
        )
        trace.set_tracer_provider(_tracer_provider)

        meter = metrics.get_meter("selfheal-ai-service", "1.0.0")
        _prediction_counter = meter.create_counter(
            name="selfheal.ai.prediction.executions",
            description="Total GRU risk prediction executions",
            unit="{prediction}",
        )
        _prediction_duration_hist = meter.create_histogram(
            name="selfheal.ai.prediction.duration",
            description="GRU model inference latency in seconds",
            unit="s",
        )
        _rca_counter = meter.create_counter(
            name="selfheal.ai.rca.executions",
            description="Total Root Cause Analysis executions",
            unit="{analysis}",
        )
        _rca_duration_hist = meter.create_histogram(
            name="selfheal.ai.rca.duration",
            description="RCA execution latency in seconds",
            unit="s",
        )

        _initialized = True
        logger.info("AI OpenTelemetry initialized (endpoint=%s)", endpoint)
    except Exception as exc:  # pragma: no cover
        logger.warning("AI OpenTelemetry initialization failed (continuing without OTel): %s", exc)


def force_flush_ai_otel(timeout_millis: int = 5000) -> None:
    if not _initialized:
        return
    try:
        if _meter_provider is not None:
            _meter_provider.force_flush(timeout_millis=timeout_millis)
        if _tracer_provider is not None:
            _tracer_provider.force_flush(timeout_millis=timeout_millis)
    except Exception as exc:
        logger.debug("AI OpenTelemetry force_flush error (ignored): %s", exc)


def shutdown_ai_otel() -> None:
    global _meter_provider, _tracer_provider, _initialized
    if not _initialized:
        return
    try:
        if _meter_provider is not None:
            _meter_provider.shutdown()
        if _tracer_provider is not None:
            _tracer_provider.shutdown()
    except Exception as exc:
        logger.debug("AI OpenTelemetry shutdown error (ignored): %s", exc)
    finally:
        _meter_provider = None
        _tracer_provider = None
        _initialized = False


def record_ai_prediction(risk_detected: bool, status: str, duration_s: float) -> None:
    if not _initialized:
        return
    try:
        if _prediction_counter is not None:
            _prediction_counter.add(
                1,
                {
                    "risk.detected": "true" if risk_detected else "false",
                    "status": status,
                },
            )
        if _prediction_duration_hist is not None:
            _prediction_duration_hist.record(max(0.0, duration_s), {"status": status})
    except Exception:
        pass


def record_ai_rca(provider: str, status: str, duration_s: float) -> None:
    if not _initialized:
        return
    try:
        if _rca_counter is not None:
            _rca_counter.add(1, {"provider": provider, "status": status})
        if _rca_duration_hist is not None:
            _rca_duration_hist.record(max(0.0, duration_s), {"provider": provider, "status": status})
    except Exception:
        pass


@contextmanager
def start_ai_http_span(
    method: str,
    path: str,
    headers: Mapping[str, str] | None = None,
) -> Iterator[Any]:
    if not _initialized or not _OTEL_AVAILABLE:
        yield None
        return

    try:
        tracer = trace.get_tracer("selfheal-ai-service", "1.0.0")
        carrier: dict[str, str] = {}
        if headers:
            for k, v in headers.items():
                lk = k.lower()
                if lk in ("traceparent", "tracestate"):
                    carrier[lk] = str(v)
        ctx = extract(carrier) if carrier else None
        with tracer.start_as_current_span(
            f"{method} {path}",
            context=ctx,
            kind=SpanKind.SERVER,
            attributes={
                "http.request.method": method,
                "url.path": path,
            },
        ) as span:
            yield span
    except Exception:
        yield None
