"""Tests for WebSocket Client lifecycle, buffering, auth handshake, and errors."""

import asyncio
import json
import pytest
from websockets.asyncio.server import serve

from selfheal_agent.config import AgentConfig
from selfheal_agent.telemetry.schemas import AgentMetricsData, MetricsMessage
from selfheal_agent.websocket_client import AgentWebSocketClient, ConnectionState


@pytest.mark.asyncio
async def test_offline_queue_buffering() -> None:
    config = AgentConfig(
        AGENT_SERVER_URL="ws://127.0.0.1:59999/api/v1/agent/connect",
        AGENT_TOKEN="test_token",
        QUEUE_MAX_SIZE=5,
    )
    client = AgentWebSocketClient(config)

    metric = MetricsMessage(
        data=AgentMetricsData(
            service_id="test",
            pod_id="p1",
            timestamp="2026-10-20T00:00:00Z",
            cpu=10.0,
            ram=50.0,
        )
    )

    for _ in range(8):
        await client.send(metric)

    assert len(client._queue) == 5
    assert client.is_authenticated is False
    assert client.state == ConnectionState.DISCONNECTED


@pytest.mark.asyncio
async def test_websocket_auth_handshake_and_flush() -> None:
    received_messages = []
    auth_received = asyncio.Event()

    async def mock_backend_handler(ws):
        async for msg_str in ws:
            data = json.loads(msg_str)
            received_messages.append(data)
            if data.get("type") == "auth":
                auth_received.set()
                await ws.send(
                    json.dumps(
                        {
                            "status": "authenticated",
                            "message": "Agent verified successfully",
                            "agent": {"id": "agent-123", "name": "k8s-cluster-1"},
                        }
                    )
                )

    server = await serve(mock_backend_handler, "127.0.0.1", 54323)

    try:
        config = AgentConfig(
            AGENT_SERVER_URL="ws://127.0.0.1:54323/api/v1/agent/connect",
            AGENT_TOKEN="cap_valid_agent_token",
            QUEUE_MAX_SIZE=50,
        )
        client = AgentWebSocketClient(config)

        test_metric = MetricsMessage(
            data=AgentMetricsData(
                service_id="order-service",
                pod_id="order-pod-001",
                timestamp="2026-10-20T12:00:00Z",
                cpu=15.0,
                ram=128.0,
            )
        )
        await client.send(test_metric)
        assert len(client._queue) == 1

        await client.start()

        await asyncio.wait_for(auth_received.wait(), timeout=5.0)

        for _ in range(30):
            types_received = [m.get("type") for m in received_messages]
            if client.is_authenticated and len(client._queue) == 0 and "metrics" in types_received:
                break
            await asyncio.sleep(0.1)

        assert client.is_authenticated is True
        assert len(client._queue) == 0

        types_received = [m.get("type") for m in received_messages]
        assert "auth" in types_received
        assert "metrics" in types_received

        await client.stop()
    finally:
        server.close()
        await server.wait_closed()


@pytest.mark.asyncio
async def test_unauthorized_token_triggers_fatal_halt() -> None:
    async def reject_backend_handler(ws):
        await ws.recv()
        await ws.close(code=4001, reason="Unauthorized: invalid agent token")

    server = await serve(reject_backend_handler, "127.0.0.1", 54324)

    try:
        config = AgentConfig(
            AGENT_SERVER_URL="ws://127.0.0.1:54324/api/v1/agent/connect",
            AGENT_TOKEN="invalid_rejected_token",
        )
        client = AgentWebSocketClient(config)
        await client.start()

        for _ in range(30):
            if client.state == ConnectionState.FATAL_AUTH_ERROR:
                break
            await asyncio.sleep(0.1)

        assert client.state == ConnectionState.FATAL_AUTH_ERROR
        assert client.is_authenticated is False

        await client.stop()
    finally:
        server.close()
        await server.wait_closed()
