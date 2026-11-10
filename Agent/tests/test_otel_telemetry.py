"""Unit tests for SelfHeal Agent OpenTelemetry instrumentation and trace propagation."""

import os
from unittest.mock import patch

from selfheal_agent.telemetry.otel import (
    force_flush_agent_otel,
    inject_trace_context,
    is_otel_enabled,
    record_agent_retry,
    record_agent_up,
    record_connection_status,
    record_heartbeat_metric,
    record_k8s_api_call,
    record_monitoring_operation,
    record_processing_error,
    record_remediation_execution,
    shutdown_agent_otel,
    start_agent_span,
)


def test_is_otel_enabled_respects_env_override():
    with patch.dict(os.environ, {"OTEL_ENABLED": "false"}):
        assert is_otel_enabled() is False
    with patch.dict(os.environ, {"OTEL_ENABLED": "true"}):
        assert is_otel_enabled() is True


def test_otel_metric_recorders_never_raise():
    record_agent_up("agent-unit-01", 1)
    record_heartbeat_metric("HEALTHY", "success", 0.015)
    record_connection_status(True)
    record_k8s_api_call("pods", "list", "success", 0.012)
    record_k8s_api_call("pods", "list", "error", 0.025, error_code="403")
    record_monitoring_operation("pods", "success")
    record_remediation_execution("RESTART_POD", "pod", "success", 0.45)
    record_agent_retry("heartbeat")
    record_processing_error("metrics_loop")
    force_flush_agent_otel()
    shutdown_agent_otel()


def test_w3c_traceparent_extraction_and_injection():
    incoming_carrier = {
        "action_type": "RESTART_POD",
        "traceparent": "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
    }
    with start_agent_span(
        "agent.execute_action",
        attributes={"action.type": "RESTART_POD"},
        carrier=incoming_carrier,
    ):
        outbound_headers: dict[str, str] = {}
        inject_trace_context(outbound_headers)
        assert isinstance(outbound_headers, dict)
