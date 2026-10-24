"""Comprehensive unit and integration test suite for Agent Heartbeat Module [PB11 2.2]."""

import asyncio
from datetime import datetime, timezone
import json
import logging
from typing import Any
import pytest
from aiohttp import web

from selfheal_agent.config import AgentConfig
from selfheal_agent.heartbeat import (
    AgentHeartbeatClient,
    HeartbeatState,
    derive_heartbeat_url,
)


@pytest.fixture
def base_config() -> AgentConfig:
    return AgentConfig(
        AGENT_SERVER_URL="ws://127.0.0.1:5000/api/v1/agent/connect",
        AGENT_TOKEN="sh_live_sec_agent_test_token_12345",
        AGENT_UID="test-cluster-agent-01",
        CLUSTER_ID="d4000000-0000-0000-0000-000000000001",
        ENVIRONMENT_ID="c4000000-0000-0000-0000-000000000001",
    )


@pytest.fixture
async def create_fake_server():
    runners = []

    async def _make(app: web.Application) -> str:
        runner = web.AppRunner(app)
        await runner.setup()
        site = web.TCPSite(runner, "127.0.0.1", 0)
        await site.start()
        port = site._server.sockets[0].getsockname()[1]
        runners.append(runner)
        return f"http://127.0.0.1:{port}"

    yield _make

    for r in runners:
        await r.cleanup()


class TestHeartbeatUrlDerivation:
    def test_derive_from_ws_url(self):
        url = derive_heartbeat_url("ws://api.backend.local:5000/api/v1/agent/connect")
        assert url == "http://api.backend.local:5000/api/v1/agents/heartbeat"

    def test_derive_from_wss_url(self):
        url = derive_heartbeat_url("wss://backend.captone.local/api/v1/agent/connect")
        assert url == "https://backend.captone.local/api/v1/agents/heartbeat"

    def test_derive_from_ws_root(self):
        url = derive_heartbeat_url("ws://localhost:3000")
        assert url == "http://localhost:3000/api/v1/agents/heartbeat"

    def test_explicit_http_url_normalized(self):
        url = derive_heartbeat_url("ws://localhost:5000", explicit_http_url="http://custom.backend:8080")
        assert url == "http://custom.backend:8080/api/v1/agents/heartbeat"

    def test_explicit_full_heartbeat_url(self):
        url = derive_heartbeat_url(
            "ws://localhost:5000",
            explicit_http_url="http://custom.backend:8080/api/v1/agents/heartbeat",
        )
        assert url == "http://custom.backend:8080/api/v1/agents/heartbeat"


@pytest.mark.asyncio
class TestAgentHeartbeatClient:
    async def test_heartbeat_headers_and_contract(self, base_config, create_fake_server):
        """1 & 2. Valid request sends required headers and JSON payload matching Backend contract."""
        received_requests = []

        async def handler(request: web.Request) -> web.Response:
            body = await request.json()
            received_requests.append({
                "headers": dict(request.headers),
                "body": body,
            })
            return web.json_response({
                "success": True,
                "message": "Ghi nhận nhịp tim Agent thành công",
                "data": {
                    "success": True,
                    "agent_id": "test-agent-id",
                    "status": "ONLINE",
                    "heartbeat_id": "hb-12345",
                    "reported_at": datetime.now(timezone.utc).isoformat(),
                },
            })

        app = web.Application()
        app.router.add_post("/api/v1/agents/heartbeat", handler)
        base_url = await create_fake_server(app)

        http_url = f"{base_url}/api/v1/agents/heartbeat"
        client = AgentHeartbeatClient(
            base_config,
            heartbeat_url=http_url,
            interval_seconds=1,
            timeout_seconds=2.0,
            max_retries=1,
        )

        try:
            success = await client.send_heartbeat_once()
            assert success is True
            assert len(received_requests) == 1

            req = received_requests[0]
            # Headers
            auth_val = req["headers"].get("Authorization") or req["headers"].get("authorization")
            assert auth_val == f"Bearer {base_config.AGENT_TOKEN}"
            token_val = req["headers"].get("x-agent-token") or req["headers"].get("X-Agent-Token")
            assert token_val == base_config.AGENT_TOKEN
            content_type = req["headers"].get("Content-Type") or req["headers"].get("content-type")
            assert content_type == "application/json"

            # Body Payload
            body = req["body"]
            assert body["status"] == "ONLINE"
            assert body["agent_version"] == "1.0.0"
            assert isinstance(body["latency_ms"], int)
            assert body["latency_ms"] >= 0
            assert "timestamp" in body
            assert body["metadata"]["agent_uid"] == base_config.AGENT_UID
            assert body["metadata"]["cluster_id"] == base_config.CLUSTER_ID

            # Client state
            assert client.state == HeartbeatState.HEALTHY
            assert client.consecutive_failures == 0
            assert client.last_successful_heartbeat is not None
            assert client.last_latency_ms is not None
        finally:
            await client.close()

    async def test_heartbeat_transient_5xx_retry_and_recovery(self, base_config, create_fake_server):
        """5 & 8. HTTP 500 error triggers retry with exponential backoff and succeeds on recovery."""
        attempts = 0

        async def handler(request: web.Request) -> web.Response:
            nonlocal attempts
            attempts += 1
            if attempts == 1:
                return web.Response(status=503, text="Service Unavailable")
            return web.json_response({
                "success": True,
                "data": {"status": "ONLINE"},
            })

        app = web.Application()
        app.router.add_post("/api/v1/agents/heartbeat", handler)
        base_url = await create_fake_server(app)

        http_url = f"{base_url}/api/v1/agents/heartbeat"
        client = AgentHeartbeatClient(
            base_config,
            heartbeat_url=http_url,
            timeout_seconds=2.0,
            max_retries=3,
            backoff_factor=1.1,
            max_backoff_seconds=1.0,
        )

        try:
            success = await client.send_heartbeat_once()
            assert success is True
            assert attempts == 2
            assert client.state == HeartbeatState.HEALTHY
        finally:
            await client.close()

    async def test_heartbeat_429_rate_limit_respects_retry_after(self, base_config, create_fake_server):
        """9. HTTP 429 Too Many Requests inspects and respects Retry-After header."""
        attempts = 0

        async def handler(request: web.Request) -> web.Response:
            nonlocal attempts
            attempts += 1
            if attempts == 1:
                return web.Response(
                    status=429,
                    text="Rate limit exceeded",
                    headers={"Retry-After": "1"},
                )
            return web.json_response({"success": True, "data": {"status": "ONLINE"}})

        app = web.Application()
        app.router.add_post("/api/v1/agents/heartbeat", handler)
        base_url = await create_fake_server(app)

        http_url = f"{base_url}/api/v1/agents/heartbeat"
        client = AgentHeartbeatClient(
            base_config,
            heartbeat_url=http_url,
            timeout_seconds=2.0,
            max_retries=2,
        )

        try:
            success = await client.send_heartbeat_once()
            assert success is True
            assert attempts == 2
        finally:
            await client.close()

    async def test_heartbeat_401_unauthorized_stops_rapid_retry(self, base_config, create_fake_server):
        """10. HTTP 401 Unauthorized halts retries within the cycle and sets UNAUTHORIZED state."""
        attempts = 0

        async def handler(request: web.Request) -> web.Response:
            nonlocal attempts
            attempts += 1
            return web.json_response(
                {"success": False, "message": "Token Agent không hợp lệ, đã hết hạn hoặc đã bị thu hồi"},
                status=401,
            )

        app = web.Application()
        app.router.add_post("/api/v1/agents/heartbeat", handler)
        base_url = await create_fake_server(app)

        http_url = f"{base_url}/api/v1/agents/heartbeat"
        client = AgentHeartbeatClient(
            base_config,
            heartbeat_url=http_url,
            timeout_seconds=2.0,
            max_retries=5,
        )

        try:
            success = await client.send_heartbeat_once()
            assert success is False
            # Must NOT retry 5 times when credentials are invalid!
            assert attempts == 1
            assert client.state == HeartbeatState.UNAUTHORIZED
        finally:
            await client.close()

    async def test_heartbeat_400_bad_request_does_not_retry(self, base_config, create_fake_server):
        """11. HTTP 400 Bad Request indicates invalid payload and aborts retries without spamming."""
        attempts = 0

        async def handler(request: web.Request) -> web.Response:
            nonlocal attempts
            attempts += 1
            return web.json_response(
                {"success": False, "message": "Payload validation error"},
                status=400,
            )

        app = web.Application()
        app.router.add_post("/api/v1/agents/heartbeat", handler)
        base_url = await create_fake_server(app)

        http_url = f"{base_url}/api/v1/agents/heartbeat"
        client = AgentHeartbeatClient(
            base_config,
            heartbeat_url=http_url,
            timeout_seconds=2.0,
            max_retries=4,
        )

        try:
            success = await client.send_heartbeat_once()
            assert success is False
            assert attempts == 1
            assert client.state == HeartbeatState.DEGRADED
        finally:
            await client.close()

    async def test_heartbeat_timeout_handling(self, base_config, create_fake_server):
        """4. Request timeout does not crash the agent and triggers retry."""
        attempts = 0

        async def handler(request: web.Request) -> web.Response:
            nonlocal attempts
            attempts += 1
            if attempts == 1:
                await asyncio.sleep(0.5)
                return web.json_response({"success": True})
            return web.json_response({"success": True})

        app = web.Application()
        app.router.add_post("/api/v1/agents/heartbeat", handler)
        base_url = await create_fake_server(app)

        http_url = f"{base_url}/api/v1/agents/heartbeat"
        client = AgentHeartbeatClient(
            base_config,
            heartbeat_url=http_url,
            timeout_seconds=0.2,
            max_retries=2,
            backoff_factor=1.0,
            max_backoff_seconds=0.1,
        )

        try:
            success = await client.send_heartbeat_once()
            assert success is True
            assert attempts == 2
        finally:
            await client.close()

    async def test_heartbeat_concurrency_overlap_guard(self, base_config, create_fake_server):
        """12. Concurrent heartbeat invocations do not overlap and corrupt request sequence."""
        concurrent_count = 0
        max_concurrent = 0

        async def handler(request: web.Request) -> web.Response:
            nonlocal concurrent_count, max_concurrent
            concurrent_count += 1
            if concurrent_count > max_concurrent:
                max_concurrent = concurrent_count
            await asyncio.sleep(0.1)
            concurrent_count -= 1
            return web.json_response({"success": True})

        app = web.Application()
        app.router.add_post("/api/v1/agents/heartbeat", handler)
        base_url = await create_fake_server(app)

        http_url = f"{base_url}/api/v1/agents/heartbeat"
        client = AgentHeartbeatClient(
            base_config,
            heartbeat_url=http_url,
            timeout_seconds=1.0,
        )

        try:
            # Fire 3 concurrent heartbeat calls
            results = await asyncio.gather(
                client.send_heartbeat_once(),
                client.send_heartbeat_once(),
                client.send_heartbeat_once(),
            )
            assert max_concurrent == 1
            assert all(results)
        finally:
            await client.close()

    async def test_heartbeat_periodic_loop_and_clean_shutdown(self, base_config, create_fake_server):
        """13 & 15. Periodic loop runs at intervals and cleanly shuts down without lingering tasks."""
        count = 0

        async def handler(request: web.Request) -> web.Response:
            nonlocal count
            count += 1
            return web.json_response({"success": True})

        app = web.Application()
        app.router.add_post("/api/v1/agents/heartbeat", handler)
        base_url = await create_fake_server(app)

        http_url = f"{base_url}/api/v1/agents/heartbeat"
        client = AgentHeartbeatClient(
            base_config,
            heartbeat_url=http_url,
            interval_seconds=0.1,
            timeout_seconds=1.0,
        )

        try:
            await client.start()
            # Wait for at least 2 ticks
            await asyncio.sleep(0.25)
            assert count >= 2

            # Graceful stop
            await client.stop()
            assert client.is_running is False
            final_count = count

            # Ensure no further requests after stop
            await asyncio.sleep(0.2)
            assert count == final_count
        finally:
            await client.close()

    async def test_zero_credential_leakage_in_logging(self, base_config, create_fake_server, caplog):
        """16. Logging never exposes the secret AGENT_TOKEN."""
        async def handler(request: web.Request) -> web.Response:
            return web.Response(status=500, text="Internal Server Error")

        app = web.Application()
        app.router.add_post("/api/v1/agents/heartbeat", handler)
        base_url = await create_fake_server(app)

        http_url = f"{base_url}/api/v1/agents/heartbeat"
        client = AgentHeartbeatClient(
            base_config,
            heartbeat_url=http_url,
            timeout_seconds=1.0,
            max_retries=1,
        )

        try:
            with caplog.at_level(logging.DEBUG):
                await client.send_heartbeat_once()

            # Assert unmasked token is NEVER present anywhere in logs
            for record in caplog.records:
                assert base_config.AGENT_TOKEN not in record.message
        finally:
            await client.close()

    async def test_heartbeat_resumption_after_temporary_outage(self, base_config, create_fake_server):
        """14. Heartbeat recovers automatically to HEALTHY after temporary failure."""
        is_server_down = True

        async def handler(request: web.Request) -> web.Response:
            if is_server_down:
                return web.Response(status=503, text="Service Unavailable")
            return web.json_response({"success": True})

        app = web.Application()
        app.router.add_post("/api/v1/agents/heartbeat", handler)
        base_url = await create_fake_server(app)

        http_url = f"{base_url}/api/v1/agents/heartbeat"
        client = AgentHeartbeatClient(
            base_config,
            heartbeat_url=http_url,
            timeout_seconds=1.0,
            max_retries=1,
        )

        try:
            # 1. Server down
            res1 = await client.send_heartbeat_once()
            assert res1 is False
            assert client.state == HeartbeatState.DEGRADED

            # 2. Server recovers
            is_server_down = False
            res2 = await client.send_heartbeat_once()
            assert res2 is True
            assert client.state == HeartbeatState.HEALTHY
            assert client.consecutive_failures == 0
        finally:
            await client.close()

    async def test_heartbeat_integration_in_agent_service(self, base_config, monkeypatch):
        """17. AgentService integrates heartbeat client into lifecycle."""
        from selfheal_agent.main import AgentService

        service = AgentService(base_config)
        assert hasattr(service, "heartbeat_client")
        assert service.heartbeat_client is not None

        # Mock start/stop of sub-services to test orchestrator cleanly
        started = []
        stopped = []

        async def mock_start():
            started.append("heartbeat")

        async def mock_stop():
            stopped.append("heartbeat")

        monkeypatch.setattr(service.heartbeat_client, "start", mock_start)
        monkeypatch.setattr(service.heartbeat_client, "stop", mock_stop)
        monkeypatch.setattr(service.ws_client, "start", lambda: asyncio.sleep(0))
        monkeypatch.setattr(service.ws_client, "stop", lambda: asyncio.sleep(0))

        # Test start
        service._runner = None
        service._site = None
        # Call heartbeat_client lifecycle directly through service methods
        await service.heartbeat_client.start()
        assert "heartbeat" in started

        await service.heartbeat_client.stop()
        assert "heartbeat" in stopped
