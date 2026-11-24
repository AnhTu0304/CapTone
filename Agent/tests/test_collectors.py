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
    assert ev.status == "OOMKilled"
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


def test_pod_summary_preserves_https_probe_scheme_and_metrics_manager_uses_it() -> None:
    import asyncio
    from selfheal_agent.collectors.pods import PodsCollector
    from selfheal_agent.telemetry.metrics import MetricsManager

    mock_pod = MagicMock()
    mock_pod.metadata.name = "tls-service-0"
    mock_pod.metadata.namespace = "default"
    mock_pod.metadata.uid = "uid-tls-0"
    mock_pod.metadata.labels = {"app": "tls-service"}
    mock_pod.metadata.creation_timestamp = None
    mock_pod.metadata.deletion_timestamp = None
    mock_pod.status.phase = "Running"
    mock_pod.status.pod_ip = "10.244.0.8"
    mock_pod.status.host_ip = "192.168.49.2"
    mock_pod.status.qos_class = "Burstable"
    mock_pod.status.start_time = None
    mock_pod.status.container_statuses = []
    mock_pod.status.init_container_statuses = []

    container = MagicMock()
    container.image = "example/tls:1.0"
    container.resources.limits = {}
    port_obj = MagicMock()
    port_obj.container_port = 10250
    port_obj.name = "https"
    container.ports = [port_obj]
    container.liveness_probe.http_get.path = "/healthz"
    container.liveness_probe.http_get.port = "https"
    container.liveness_probe.http_get.scheme = "HTTPS"
    container.readiness_probe = None
    mock_pod.spec.node_name = "minikube"
    mock_pod.spec.containers = [container]

    summary = PodsCollector(MagicMock())._parse_pod(mock_pod)
    assert summary.port == 10250
    assert summary.health_path == "/healthz"
    assert summary.health_scheme == "https"

    captured: dict[str, object] = {}

    class FakeResp:
        status = 200
        async def json(self):
            return {}
        async def __aenter__(self):
            return self
        async def __aexit__(self, exc_type, exc, tb):
            return False

    class FakeSession:
        closed = False
        def get(self, url, **kwargs):
            captured["url"] = url
            captured["kwargs"] = kwargs
            return FakeResp()

    mgr = MetricsManager(custom_objects=None)
    mgr._http_session = FakeSession()
    asyncio.run(mgr.probe_pod_http(summary))
    assert captured["url"] == "https://10.244.0.8:10250/healthz"
    assert captured["kwargs"].get("ssl") is False


def test_probe_pod_http_preserves_reported_app_latency_and_rps() -> None:
    import asyncio
    from selfheal_agent.telemetry.metrics import MetricsManager

    summary = PodSummary(
        name="ecommerce-store-app-abc-123",
        namespace="test-lab",
        uid="uid-ecom-1",
        service_id="ecommerce-store-app",
        phase="Running",
        pod_ip="10.244.0.12",
        port=8080,
        health_path="/health",
    )

    class FakeStatsResp:
        status = 200
        async def json(self):
            return {
                "status": "UP",
                "metrics": {
                    "rps": 10.6,
                    "requestsInWindow": 53,
                    "avgLatencyMs": 5005,
                    "http5xxRate": 0.0,
                },
            }
        async def __aenter__(self):
            return self
        async def __aexit__(self, exc_type, exc, tb):
            return False

    class FakeStatsSession:
        closed = False
        def get(self, url, **kwargs):
            return FakeStatsResp()

    mgr = MetricsManager(custom_objects=None)
    mgr._http_session = FakeStatsSession()
    result = asyncio.run(mgr.probe_pod_http(summary))
    assert result["request_rate"] == 10.6
    assert result["latency"] >= 5005.0
    assert result["http_5xx_rate"] == 0.0
