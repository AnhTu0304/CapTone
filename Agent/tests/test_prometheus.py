"""Tests for Prometheus collector and MetricsManager."""

import pytest
from unittest.mock import AsyncMock, MagicMock
from selfheal_agent.collectors.pods import PodSummary
from selfheal_agent.telemetry.metrics import MetricsManager, PrometheusCollector


@pytest.mark.asyncio
async def test_prometheus_unconfigured() -> None:
    prom = PrometheusCollector(None)
    data = await prom.collect_http_metrics("default")
    assert data == {}


@pytest.mark.asyncio
async def test_metrics_manager_aggregation() -> None:
    mock_custom = MagicMock()
    # Usage: 250m cpu, 128MB memory
    mock_custom.list_namespaced_custom_object.return_value = {
        "items": [
            {
                "metadata": {"name": "cart-pod-1"},
                "containers": [
                    {"usage": {"cpu": "250m", "memory": "128Mi"}}
                ],
            }
        ]
    }

    mock_prom = MagicMock(spec=PrometheusCollector)
    mock_prom.collect_http_metrics = AsyncMock(
        return_value={
            "cart-pod-1": {
                "request_rate": 88.5,
                "latency": 14.2,
                "http_5xx_rate": 0.02,
            }
        }
    )

    manager = MetricsManager(mock_custom, mock_prom)

    pods = [
        PodSummary(
            name="cart-pod-1",
            namespace="default",
            uid="uid-cart-1",
            service_id="cart-service",
            phase="Running",
            restarts=1,
            cpu_limit_millicores=1000.0,
            memory_limit_bytes=512 * 1024 * 1024,
        )
    ]
    replicas_map = {"cart-service": 2}

    metrics = await manager.aggregate_metrics(pods, replicas_map, "default")

    assert len(metrics) == 1
    m = metrics[0]
    assert m.service_id == "cart-service"
    assert m.cpu == 25.0
    assert m.ram == 128.0
    assert m.request_rate == 88.5
    assert m.latency == 14.2
    assert m.http_5xx_rate == 0.02
    assert m.replica_count == 2
    assert m.pod_restart_count == 1
