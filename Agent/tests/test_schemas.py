"""Tests for telemetry message schemas and envelopes."""

import json
from selfheal_agent.telemetry.schemas import (
    AckPayload,
    AgentK8sEventData,
    AgentK8sEventDetail,
    AgentLogData,
    AgentMetricsData,
    AuthenticatedPayload,
    AuthMessage,
    ErrorPayload,
    K8sEventMessage,
    LogMessage,
    MetricsMessage,
)


def test_metrics_message_serialization() -> None:
    data = AgentMetricsData(
        service_id="payment-service",
        pod_id="payment-service-7f8b9-x1",
        timestamp="2026-10-20T12:00:00Z",
        cpu=45.5,
        ram=256.0,
        disk=12.0,
        request_rate=120.0,
        latency=15.2,
        http_5xx_rate=0.01,
        pod_restart_count=1,
        replica_count=3,
    )
    envelope = MetricsMessage(data=data)
    dumped = json.loads(envelope.model_dump_json())

    assert dumped["type"] == "metrics"
    assert dumped["data"]["service_id"] == "payment-service"
    assert dumped["data"]["cpu"] == 45.5
    assert dumped["data"]["ram"] == 256.0
    assert dumped["data"]["replica_count"] == 3


def test_log_message_serialization() -> None:
    data = AgentLogData(
        service_id="order-service",
        pod_id="order-service-9a8b-z2",
        timestamp="2026-10-20T12:00:00Z",
        level="error",
        message="Database connection timed out after 5000ms",
    )
    envelope = LogMessage(data=data)
    dumped = json.loads(envelope.model_dump_json())

    assert dumped["type"] == "log"
    assert dumped["data"]["level"] == "error"
    assert "timed out" in dumped["data"]["message"]


def test_event_message_serialization() -> None:
    data = AgentK8sEventData(
        service_id="auth-service",
        pod_id="auth-service-pod-1",
        pod_name="auth-service-pod-1",
        status="CrashLoopBackOff",
        timestamp="2026-10-20T12:00:00Z",
        event=AgentK8sEventDetail(
            type="Warning",
            reason="BackOff",
            message="Back-off restarting failed container auth-app",
        ),
    )
    envelope = K8sEventMessage(data=data)
    dumped = json.loads(envelope.model_dump_json())

    assert dumped["type"] == "k8s_event"
    assert dumped["data"]["status"] == "CrashLoopBackOff"
    assert dumped["data"]["event"]["reason"] == "BackOff"


def test_auth_message() -> None:
    envelope = AuthMessage(token="cap_super_secret")
    dumped = json.loads(envelope.model_dump_json())
    assert dumped["type"] == "auth"
    assert dumped["token"] == "cap_super_secret"


def test_incoming_models() -> None:
    auth_resp = AuthenticatedPayload.model_validate(
        {
            "status": "authenticated",
            "message": "Token verified",
            "agent": {"id": "1", "name": "cluster-1"},
        }
    )
    assert auth_resp.status == "authenticated"
    assert auth_resp.agent["name"] == "cluster-1"

    ack_resp = AckPayload.model_validate(
        {
            "status": "ack",
            "type": "metrics",
            "record_id": 42,
            "service_id": "payment",
        }
    )
    assert ack_resp.status == "ack"
    assert ack_resp.record_id == 42

    err_resp = ErrorPayload.model_validate(
        {
            "status": "error",
            "message": "Validation failed",
        }
    )
    assert err_resp.status == "error"
