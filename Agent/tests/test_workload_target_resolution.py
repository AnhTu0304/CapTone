import types
from unittest.mock import AsyncMock, MagicMock

import pytest

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


@pytest.mark.asyncio
async def test_resolves_helm_deployment_by_label_and_suffix():
    agent = _make_agent()

    agent.apps_v1.read_namespaced_deployment.side_effect = Exception("404 Not Found")
    dep_item = types.SimpleNamespace(
        metadata=types.SimpleNamespace(
            name="prometheus-kube-prometheus-operator",
            namespace="monitoring",
            labels={"app": "kube-prometheus-stack-operator"},
        ),
        spec=types.SimpleNamespace(
            selector=types.SimpleNamespace(
                match_labels={"app": "kube-prometheus-stack-operator"}
            )
        ),
    )
    agent.apps_v1.list_deployment_for_all_namespaces.return_value = types.SimpleNamespace(
        items=[dep_item]
    )

    captured = {}

    async def capture_send(msg):
        if isinstance(msg, ActionResultMessage):
            captured["data"] = msg.data.model_dump()

    agent.ws_client.send = AsyncMock(side_effect=capture_send)

    payload = ExecuteActionPayload(
        type="execute_action",
        data=ExecuteActionData(
            action_id="act-helm-1",
            action_type="RESTART_POD",
            target_name="kube-prometheus-stack-operator",
            namespace="default",
            params={},
        ),
    )
    await agent._handle_incoming_ws_message(payload)

    agent.apps_v1.patch_namespaced_deployment.assert_called_once()
    call_kwargs = agent.apps_v1.patch_namespaced_deployment.call_args.kwargs
    assert call_kwargs["name"] == "prometheus-kube-prometheus-operator"
    assert call_kwargs["namespace"] == "monitoring"
    assert captured["data"]["status"] == "SUCCEEDED"
    assert captured["data"]["details"]["namespace"] == "monitoring"
    assert captured["data"]["details"]["target"] == "prometheus-kube-prometheus-operator"


@pytest.mark.asyncio
async def test_controllerless_standalone_pod_fails_explicitly_without_404():
    agent = _make_agent()

    agent.apps_v1.read_namespaced_deployment.side_effect = Exception("404")
    agent.apps_v1.list_deployment_for_all_namespaces.return_value = types.SimpleNamespace(items=[])
    agent.apps_v1.read_namespaced_stateful_set.side_effect = Exception("404")
    agent.apps_v1.list_stateful_set_for_all_namespaces.return_value = types.SimpleNamespace(items=[])
    agent.apps_v1.read_namespaced_daemon_set.side_effect = Exception("404")
    agent.apps_v1.list_daemon_set_for_all_namespaces.return_value = types.SimpleNamespace(items=[])

    bare_pod = types.SimpleNamespace(
        metadata=types.SimpleNamespace(
            name="storage-provisioner",
            namespace="kube-system",
            labels={"addonmanager.kubernetes.io/mode": "Reconcile"},
            deletion_timestamp=None,
            owner_references=None,
        )
    )
    agent.core_v1.list_pod_for_all_namespaces.return_value = types.SimpleNamespace(
        items=[bare_pod]
    )

    captured = {}

    async def capture_send(msg):
        if isinstance(msg, ActionResultMessage):
            captured["data"] = msg.data.model_dump()

    agent.ws_client.send = AsyncMock(side_effect=capture_send)

    payload = ExecuteActionPayload(
        type="execute_action",
        data=ExecuteActionData(
            action_id="act-bare-1",
            action_type="RESTART_POD",
            target_name="storage-provisioner",
            namespace="default",
            params={},
        ),
    )
    await agent._handle_incoming_ws_message(payload)

    assert captured["data"]["status"] == "FAILED"
    assert "kube-system" in captured["data"]["message"]
    assert "standalone Pod" in captured["data"]["message"]
    assert captured["data"]["details"]["namespace"] == "kube-system"
