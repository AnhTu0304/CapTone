import types
from unittest.mock import AsyncMock, MagicMock

import pytest

import selfheal_agent.main as agent_main
from selfheal_agent.config import AgentConfig
from selfheal_agent.main import AgentService
from selfheal_agent.telemetry.schemas import (
    ActionResultMessage,
    ExecuteActionData,
    ExecuteActionPayload,
)


def _make_agent() -> AgentService:
    config = AgentConfig(
        AGENT_SERVER_URL="ws://localhost:5000/agent/ws",
        AGENT_HTTP_URL="http://localhost:5000",
        AGENT_TOKEN="test-token-123",
        ENABLE_HEALING_ACTIONS=True,
    )
    agent = AgentService(config)
    agent.apps_v1 = MagicMock()
    agent.core_v1 = MagicMock()
    agent.networking_v1 = MagicMock()
    return agent


def _make_deployment_state(
    name: str,
    namespace: str,
    generation: int,
    observed_generation: int,
    desired: int,
    updated: int,
    ready: int,
    available: int,
    total_replicas: int,
    version: str = "v1.2.1-faulty",
):
    return types.SimpleNamespace(
        metadata=types.SimpleNamespace(
            name=name,
            namespace=namespace,
            generation=generation,
            labels={"app": name},
            annotations={"deployment.kubernetes.io/revision": "5"},
        ),
        spec=types.SimpleNamespace(
            replicas=desired,
            selector=types.SimpleNamespace(match_labels={"app": name}),
        ),
        status=types.SimpleNamespace(
            observed_generation=observed_generation,
            updated_replicas=updated,
            ready_replicas=ready,
            available_replicas=available,
            replicas=total_replicas,
        ),
    )


@pytest.mark.asyncio
async def test_rollback_waits_for_deployment_rollout_settled(monkeypatch):
    agent = _make_agent()
    monkeypatch.setattr(agent_main.time, "sleep", lambda _sec: None)

    rs_old = types.SimpleNamespace(
        metadata=types.SimpleNamespace(
            name="ecommerce-store-app-v1",
            owner_references=[types.SimpleNamespace(kind="Deployment", name="ecommerce-store-app")],
            annotations={"deployment.kubernetes.io/revision": "4"},
        ),
        spec=types.SimpleNamespace(
            template=types.SimpleNamespace(
                metadata=types.SimpleNamespace(annotations={"app.kubernetes.io/version": "v1.2.0-stable"})
            )
        ),
    )
    agent.apps_v1.list_namespaced_replica_set.return_value = types.SimpleNamespace(items=[rs_old])
    agent.core_v1.list_namespaced_pod.return_value = types.SimpleNamespace(items=[])

    # Poll 1: controller has not observed new generation yet
    # Poll 2: new pods ready, old faulty pod still terminating (replicas=3 > desired=2)
    # Poll 3: rollout fully settled (replicas=2 == desired=2)
    states = [
        _make_deployment_state("ecommerce-store-app", "test-lab", 6, 6, 2, 2, 2, 2, 2),  # initial read before patch
        _make_deployment_state("ecommerce-store-app", "test-lab", 7, 6, 2, 0, 1, 1, 3),  # poll 1
        _make_deployment_state("ecommerce-store-app", "test-lab", 7, 7, 2, 2, 2, 2, 3),  # poll 2
        _make_deployment_state("ecommerce-store-app", "test-lab", 7, 7, 2, 2, 2, 2, 2),  # poll 3 (settled)
    ]
    agent.apps_v1.read_namespaced_deployment.side_effect = states

    captured = {}

    async def capture_send(msg):
        if isinstance(msg, ActionResultMessage):
            captured["data"] = msg.data.model_dump()

    agent.ws_client.send = AsyncMock(side_effect=capture_send)

    payload = ExecuteActionPayload(
        type="execute_action",
        data=ExecuteActionData(
            action_id="act-rb-wait-1",
            action_type="ROLLBACK_DEPLOYMENT",
            target_name="ecommerce-store-app",
            namespace="test-lab",
            params={},
        ),
    )
    await agent._handle_incoming_ws_message(payload)

    agent.apps_v1.patch_namespaced_deployment.assert_called_once()
    assert captured["data"]["status"] == "COMPLETED"
    assert captured["data"]["details"]["rollout_waited"] is True
    assert captured["data"]["details"]["rollout_settled"] is True
    assert captured["data"]["details"]["rollout_polls"] == 3


@pytest.mark.asyncio
async def test_rollback_wait_times_out_safely_without_raising(monkeypatch):
    agent = _make_agent()
    monkeypatch.setattr(agent_main.time, "sleep", lambda _sec: None)

    clock = {"t": 100.0}

    def fake_monotonic():
        clock["t"] += 15.0
        return clock["t"]

    monkeypatch.setattr(agent_main.time, "monotonic", fake_monotonic)

    agent.apps_v1.list_namespaced_replica_set.return_value = types.SimpleNamespace(items=[])
    agent.core_v1.list_namespaced_pod.return_value = types.SimpleNamespace(items=[])
    agent.apps_v1.read_namespaced_deployment.return_value = _make_deployment_state(
        "ecommerce-store-app", "test-lab", 7, 7, 2, 1, 1, 1, 3
    )

    captured = {}

    async def capture_send(msg):
        if isinstance(msg, ActionResultMessage):
            captured["data"] = msg.data.model_dump()

    agent.ws_client.send = AsyncMock(side_effect=capture_send)

    payload = ExecuteActionPayload(
        type="execute_action",
        data=ExecuteActionData(
            action_id="act-rb-timeout-1",
            action_type="ROLLBACK_DEPLOYMENT",
            target_name="ecommerce-store-app",
            namespace="test-lab",
            params={},
        ),
    )
    await agent._handle_incoming_ws_message(payload)

    assert captured["data"]["status"] == "COMPLETED"
    assert captured["data"]["details"]["rollout_waited"] is True
    assert captured["data"]["details"]["rollout_settled"] is False
