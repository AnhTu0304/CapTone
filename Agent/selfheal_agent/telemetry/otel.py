"""OpenTelemetry SDK and Metrics Instrumentation for SelfHeal Kubernetes Agent."""

from contextlib import contextmanager
import logging
import os
import socket
import sys
from typing import Any, Iterator, Optional

from opentelemetry import metrics, propagate, trace
from opentelemetry.exporter.otlp.proto.http.metric_exporter import OTLPMetricExporter
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.sdk.metrics.export import PeriodicExportingMetricReader
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.trace import StatusCode

logger = logging.getLogger("selfheal_agent.telemetry.otel")

_initialized = False
_meter_provider: Optional[MeterProvider] = None
_tracer_provider: Optional[TracerProvider] = None
_metric_reader: Optional[PeriodicExportingMetricReader] = None

meter = metrics.get_meter("selfheal-k8s-agent", "1.0.0")
tracer = trace.get_tracer("selfheal-k8s-agent", "1.0.0")

_agent_up_gauge: Any = None
_heartbeat_status_gauge: Any = None
_heartbeat_duration_histogram: Any = None
_connection_status_gauge: Any = None
_k8s_api_duration_histogram: Any = None
_k8s_api_errors_counter: Any = None
_monitoring_operations_counter: Any = None
_remediation_executions_counter: Any = None
_remediation_duration_histogram: Any = None
_retries_counter: Any = None
_processing_errors_counter: Any = None


def _bind_instruments() -> None:
    global meter, tracer
    global _agent_up_gauge, _heartbeat_status_gauge, _heartbeat_duration_histogram, _connection_status_gauge
    global _k8s_api_duration_histogram, _k8s_api_errors_counter, _monitoring_operations_counter
    global _remediation_executions_counter, _remediation_duration_histogram, _retries_counter, _processing_errors_counter

    meter = metrics.get_meter("selfheal-k8s-agent", "1.0.0")
    tracer = trace.get_tracer("selfheal-k8s-agent", "1.0.0")

    _agent_up_gauge = meter.create_gauge(
        name="selfheal.agent.up",
        description="Agent lifecycle state (1 = running, 0 = stopped)",
        unit="1",
    )
    _heartbeat_status_gauge = meter.create_gauge(
        name="selfheal.agent.heartbeat.status",
        description="Agent HTTP heartbeat health (1 = HEALTHY, 0 = DEGRADED/UNAUTHORIZED/STOPPED)",
        unit="1",
    )
    _heartbeat_duration_histogram = meter.create_histogram(
        name="selfheal.agent.heartbeat.duration",
        description="HTTP heartbeat round-trip latency in seconds",
        unit="s",
    )
    _connection_status_gauge = meter.create_gauge(
        name="selfheal.agent.connection.status",
        description="WebSocket connection state (1 = AUTHENTICATED, 0 = DISCONNECTED/RECONNECTING)",
        unit="1",
    )
    _k8s_api_duration_histogram = meter.create_histogram(
        name="selfheal.agent.k8s.api.duration",
        description="Duration of Kubernetes API client calls in seconds",
        unit="s",
    )
    _k8s_api_errors_counter = meter.create_counter(
        name="selfheal.agent.k8s.api.errors",
        description="Total Kubernetes API client failures",
        unit="{error}",
    )
    _monitoring_operations_counter = meter.create_counter(
        name="selfheal.agent.monitoring.operations",
        description="Completed monitoring collection cycles",
        unit="{operation}",
    )
    _remediation_executions_counter = meter.create_counter(
        name="selfheal.agent.remediation.executions",
        description="Total remediation commands executed by Agent",
        unit="{execution}",
    )
    _remediation_duration_histogram = meter.create_histogram(
        name="selfheal.agent.remediation.duration",
        description="Remediation action execution duration in seconds",
        unit="s",
    )
    _retries_counter = meter.create_counter(
        name="selfheal.agent.retries",
        description="Total retry attempts across heartbeat and WebSocket transport",
        unit="{retry}",
    )
    _processing_errors_counter = meter.create_counter(
        name="selfheal.agent.processing.errors",
        description="Unhandled loop or handler exceptions inside Agent",
        unit="{error}",
    )


_bind_instruments()


def is_otel_enabled(config: Any = None) -> bool:
    env_flag = os.environ.get("OTEL_ENABLED")
    if env_flag is not None:
        return env_flag.strip().lower() not in ("false", "0", "no")
    # Avoid starting background network threads during pytest runs unless explicitly enabled via env
    if "PYTEST_CURRENT_TEST" in os.environ or "pytest" in sys.modules:
        return False
    if config is not None and hasattr(config, "OTEL_ENABLED"):
        return bool(getattr(config, "OTEL_ENABLED"))
    return True


def init_agent_otel(config: Any = None) -> None:
    """Initialize OpenTelemetry MeterProvider and TracerProvider with OTLP/HTTP exporters."""
    global _initialized, _meter_provider, _tracer_provider, _metric_reader
    if _initialized or not is_otel_enabled(config):
        return
    _initialized = True

    try:
        raw_endpoint = (
            os.environ.get("OTEL_EXPORTER_OTLP_ENDPOINT")
            or getattr(config, "OTEL_EXPORTER_OTLP_ENDPOINT", None)
            or "http://otel-collector-opentelemetry-collector.monitoring.svc.cluster.local:4318"
        ).rstrip("/")

        service_name = (
            os.environ.get("OTEL_SERVICE_NAME")
            or getattr(config, "OTEL_SERVICE_NAME", None)
            or "selfheal-k8s-agent"
        )
        service_version = (
            os.environ.get("OTEL_SERVICE_VERSION")
            or getattr(config, "OTEL_SERVICE_VERSION", None)
            or "1.0.0"
        )
        deployment_env = (
            os.environ.get("DEPLOYMENT_ENVIRONMENT")
            or getattr(config, "DEPLOYMENT_ENVIRONMENT", None)
            or "development"
        )
        service_namespace = (
            os.environ.get("OTEL_SERVICE_NAMESPACE")
            or getattr(config, "OTEL_SERVICE_NAMESPACE", None)
            or "selfheal-system"
        )
        k8s_namespace = (
            os.environ.get("K8S_NAMESPACE_NAME")
            or os.environ.get("K8S_NAMESPACE")
            or getattr(config, "K8S_NAMESPACE", None)
            or "selfheal-system"
        )
        k8s_pod_name = (
            os.environ.get("K8S_POD_NAME")
            or os.environ.get("HOSTNAME")
            or socket.gethostname()
        )
        k8s_node_name = os.environ.get("K8S_NODE_NAME") or "minikube"

        export_interval_ms = int(
            os.environ.get("OTEL_METRIC_EXPORT_INTERVAL_MS")
            or getattr(config, "OTEL_METRIC_EXPORT_INTERVAL_MS", None)
            or 10000
        )
        export_interval_ms = max(1000, export_interval_ms)

        resource = Resource.create(
            {
                "service.name": service_name,
                "service.version": service_version,
                "deployment.environment": deployment_env,
                "service.namespace": service_namespace,
                "k8s.namespace.name": k8s_namespace,
                "k8s.pod.name": k8s_pod_name,
                "k8s.node.name": k8s_node_name,
            }
        )

        metric_exporter = OTLPMetricExporter(
            endpoint=f"{raw_endpoint}/v1/metrics",
            timeout=5,
        )
        _metric_reader = PeriodicExportingMetricReader(
            exporter=metric_exporter,
            export_interval_millis=export_interval_ms,
            export_timeout_millis=min(5000, export_interval_ms),
        )
        _meter_provider = MeterProvider(resource=resource, metric_readers=[_metric_reader])
        metrics.set_meter_provider(_meter_provider)

        span_exporter = OTLPSpanExporter(
            endpoint=f"{raw_endpoint}/v1/traces",
            timeout=5,
        )
        _tracer_provider = TracerProvider(resource=resource)
        _tracer_provider.add_span_processor(BatchSpanProcessor(span_exporter))
        trace.set_tracer_provider(_tracer_provider)

        _bind_instruments()

        logger.info(
            "📡 [OTel] Initialized OpenTelemetry for %s -> %s (interval=%dms)",
            service_name,
            raw_endpoint,
            export_interval_ms,
        )
    except Exception as err:
        logger.warning("Failed to initialize OpenTelemetry SDK (continuing without OTel): %s", err)


def force_flush_agent_otel() -> None:
    try:
        if _meter_provider is not None:
            _meter_provider.force_flush(timeout_millis=3000)
        if _tracer_provider is not None:
            _tracer_provider.force_flush(timeout_millis=3000)
    except Exception:
        pass


def shutdown_agent_otel() -> None:
    global _initialized, _meter_provider, _tracer_provider, _metric_reader
    try:
        force_flush_agent_otel()
        if _meter_provider is not None:
            _meter_provider.shutdown(timeout_millis=3000)
            _meter_provider = None
            _metric_reader = None
        if _tracer_provider is not None:
            _tracer_provider.shutdown()
            _tracer_provider = None
        _initialized = False
    except Exception:
        pass


def record_agent_up(agent_uid: str, up: int) -> None:
    try:
        _agent_up_gauge.set(up, {"agent.uid": agent_uid or "selfheal-agent-default"})
    except Exception:
        pass


def record_heartbeat_metric(state_str: str, status: str, duration_seconds: float) -> None:
    try:
        is_healthy = 1 if state_str == "HEALTHY" else 0
        _heartbeat_status_gauge.set(is_healthy, {"state": state_str})
        _heartbeat_duration_histogram.record(max(0.0, duration_seconds), {"status": status})
    except Exception:
        pass


def record_connection_status(is_authenticated: bool) -> None:
    try:
        _connection_status_gauge.set(
            1 if is_authenticated else 0,
            {"transport": "websocket"},
        )
    except Exception:
        pass


def record_k8s_api_call(
    resource: str,
    operation: str,
    status: str,
    duration_seconds: float,
    error_code: Optional[str] = None,
) -> None:
    try:
        _k8s_api_duration_histogram.record(
            max(0.0, duration_seconds),
            {
                "k8s.resource": resource,
                "k8s.operation": operation,
                "status": status,
            },
        )
        if status == "error" or error_code is not None:
            _k8s_api_errors_counter.add(
                1,
                {
                    "k8s.resource": resource,
                    "k8s.operation": operation,
                    "error.code": str(error_code or "unknown"),
                },
            )
    except Exception:
        pass


def record_monitoring_operation(target: str, status: str) -> None:
    try:
        _monitoring_operations_counter.add(
            1,
            {
                "monitor.target": target,
                "status": status,
            },
        )
    except Exception:
        pass


def record_remediation_execution(
    action_type: str,
    workload_kind: str,
    status: str,
    duration_seconds: float,
) -> None:
    try:
        attrs = {
            "action.type": action_type or "UNKNOWN",
            "workload.kind": workload_kind or "deployment",
            "status": status,
        }
        _remediation_executions_counter.add(1, attrs)
        _remediation_duration_histogram.record(max(0.0, duration_seconds), attrs)
    except Exception:
        pass


def record_agent_retry(component: str) -> None:
    try:
        _retries_counter.add(1, {"component": component})
    except Exception:
        pass


def record_processing_error(loop_name: str) -> None:
    try:
        _processing_errors_counter.add(1, {"loop": loop_name})
    except Exception:
        pass


def inject_trace_context(headers: dict[str, str]) -> dict[str, str]:
    try:
        propagate.inject(headers)
    except Exception:
        pass
    return headers


@contextmanager
def start_agent_span(
    name: str,
    attributes: Optional[dict[str, Any]] = None,
    carrier: Optional[dict[str, Any]] = None,
) -> Iterator[Any]:
    parent_ctx = None
    if carrier and isinstance(carrier, dict):
        try:
            str_carrier = {
                str(k): str(v)
                for k, v in carrier.items()
                if isinstance(k, str) and isinstance(v, str)
            }
            if "traceparent" in str_carrier:
                parent_ctx = propagate.extract(str_carrier)
        except Exception:
            parent_ctx = None

    with tracer.start_as_current_span(
        name,
        context=parent_ctx,
        attributes=attributes or {},
    ) as span:
        try:
            yield span
            span.set_status(StatusCode.OK)
        except Exception as exc:
            span.set_status(StatusCode.ERROR, type(exc).__name__)
            raise
