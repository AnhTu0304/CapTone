"""Tests for Kubernetes collectors (pods, deployments, events, logs)."""

from unittest.mock import MagicMock
from selfheal_agent.collectors.deployments import DeploymentsCollector
from selfheal_agent.collectors.events import EventsCollector
from selfheal_agent.collectors.logs import LogsCollector
from selfheal_agent.collectors.pods import (
    PodsCollector,
    PodSummary,
    parse_cpu_to_millicores,
    parse_memory_to_bytes,
)


def test_parse_cpu_to_millicores() -> None:
    assert parse_cpu_to_millicores("500m") == 500.0
    assert parse_cpu_to_millicores("1") == 1000.0
    assert parse_cpu_to_millicores("2.5") == 2500.0
    assert parse_cpu_to_millicores("1000000n") == 1.0
    assert parse_cpu_to_millicores("5000u") == 5.0
    assert parse_cpu_to_millicores(None) == 0.0


def test_parse_memory_to_bytes() -> None:
    assert parse_memory_to_bytes("1Ki") == 1024.0
    assert parse_memory_to_bytes("1Mi") == 1024.0 * 1024.0
    assert parse_memory_to_bytes("2Gi") == 2.0 * 1024.0 * 1024.0 * 1024.0
    assert parse_memory_to_bytes("1024") == 1024.0
    assert parse_memory_to_bytes(None) == 0.0


def test_pods_collector() -> None:
    mock_core = MagicMock()
    mock_pod = MagicMock()
    mock_pod.metadata.name = "payment-svc-789ab-x1"
    mock_pod.metadata.namespace = "default"
    mock_pod.metadata.uid = "uid-pay-1"
    mock_pod.metadata.labels = {"app": "payment-svc"}
    mock_pod.status.phase = "Running"
    cs = MagicMock()
    cs.restart_count = 3
    mock_pod.status.container_statuses = [cs]
    container = MagicMock()
    container.resources.limits = {"cpu": "500m", "memory": "256Mi"}
    mock_pod.spec.containers = [container]
    mock_pod.spec.node_name = "worker-node-1"

    mock_core.list_namespaced_pod.return_value.items = [mock_pod]

    collector = PodsCollector(mock_core)
    pods = collector.list_pods("default")

    assert len(pods) == 1
    p = pods[0]
    assert p.name == "payment-svc-789ab-x1"
    assert p.service_id == "payment-svc"
    assert p.phase == "Running"
    assert p.restarts == 3
    assert p.cpu_limit_millicores == 500.0
    assert p.memory_limit_bytes == 256.0 * 1024.0 * 1024.0


def test_deployments_collector() -> None:
    mock_apps = MagicMock()
    mock_dep = MagicMock()
    mock_dep.metadata.name = "auth-deploy"
    mock_dep.status.available_replicas = 4
    mock_dep.spec.replicas = 4

    mock_apps.list_namespaced_deployment.return_value.items = [mock_dep]

    collector = DeploymentsCollector(mock_apps)
    replicas = collector.get_replicas_map("default")

    assert replicas.get("auth-deploy") == 4


def test_events_collector_and_deduplication() -> None:
    mock_core = MagicMock()
    mock_event = MagicMock()
    mock_event.metadata.uid = "ev-uid-001"
    mock_event.involved_object.kind = "Pod"
    mock_event.involved_object.name = "worker-queue-p1"
    mock_event.involved_object.uid = "uid-worker-1"
    mock_event.type = "Warning"
    mock_event.reason = "OOMKilled"
    mock_event.message = "Container exceeded memory limit and was killed"
    mock_event.last_timestamp = None

    mock_core.list_namespaced_event.return_value.items = [mock_event]

    collector = EventsCollector(mock_core)
    events = collector.collect_events("default")

    assert len(events) == 1
    ev = events[0]
    assert ev.service_id == "worker-queue"
    assert ev.status == "CrashLoopBackOff"
    assert ev.event.reason == "OOMKilled"

    # Deduplication test
    events_repeat = collector.collect_events("default")
    assert len(events_repeat) == 0


def test_logs_collector_and_redaction() -> None:
    mock_core = MagicMock()
    mock_core.read_namespaced_pod_log.return_value = (
        "Server listening on port 8080\n"
        "Warning: High memory consumption detected\n"
        "CRITICAL Exception: Database connection lost with password=secret123\n"
    )

    pods = [
        PodSummary(
            name="web-service-xyz",
            namespace="default",
            uid="uid-web-1",
            service_id="web-service",
            phase="Running",
            restarts=0,
        )
    ]

    collector = LogsCollector(mock_core)
    logs = collector.collect_pod_logs(pods)

    assert len(logs) == 3
    assert logs[0].level == "info"
    assert logs[1].level == "warn"
    assert logs[2].level == "error"
    assert "secret123" not in logs[2].message
    assert "[REDACTED]" in logs[2].message
