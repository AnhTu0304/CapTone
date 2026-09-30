"""Unit and Integration Tests for SelfHeal Agent v0.1."""

import os
from unittest.mock import AsyncMock, MagicMock, patch
import pytest
from pydantic import SecretStr

from app.auth.agent_auth import AgentAuth
from app.config.constants import AgentStatus, KubernetesMode
from app.config.settings import Settings
from app.heartbeat.heartbeat_service import HeartbeatService
from app.kubernetes.client import KubernetesClient
from app.logging.logger import SensitiveDataMaskFilter
from app.transport.backend_client import BackendClient, BackendConnectionError
from app.transport.models import HeartbeatPayload, HeartbeatResponse


def test_settings_validation_and_secrets():
    """Verify settings loads properly and masks secrets."""
    settings = Settings(
        SELFHEAL_BACKEND_URL="https://backend.example.com/",
        SELFHEAL_AGENT_ID="test-agent-01",
        SELFHEAL_AGENT_TOKEN="super-secret-token-xyz",
        SELFHEAL_HEARTBEAT_INTERVAL=15,
        SELFHEAL_KUBERNETES_MODE="LOCAL",
    )
    # URL trailing slash should be stripped
    assert settings.SELFHEAL_BACKEND_URL == "https://backend.example.com"
    assert settings.SELFHEAL_AGENT_ID == "test-agent-01"
    assert isinstance(settings.SELFHEAL_AGENT_TOKEN, SecretStr)
    # Token must not appear in string representation
    assert "super-secret-token-xyz" not in str(settings)
    assert settings.SELFHEAL_HEARTBEAT_INTERVAL == 15
    assert settings.SELFHEAL_KUBERNETES_MODE == KubernetesMode.LOCAL


def test_agent_auth_headers_and_masking():
    """Verify AgentAuth creates headers and masks tokens in repr."""
    auth = AgentAuth(
        agent_id="agent-k8s-01",
        agent_token="my-top-secret-agent-token-12345",
    )
    headers = auth.get_auth_headers()
    assert headers["X-Agent-ID"] == "agent-k8s-01"
    assert headers["Authorization"] == "Bearer my-top-secret-agent-token-12345"

    # String representation must mask token
    repr_str = str(auth)
    assert "agent-k8s-01" in repr_str
    assert "my-top-secret-agent-token-12345" not in repr_str
    assert "my-t...2345" in repr_str or "***" in repr_str


def test_sensitive_data_log_mask_filter():
    """Verify logging filter strips tokens from text records."""
    token = "secret-token-abcdefghij"
    mask_filter = SensitiveDataMaskFilter(token_to_mask=token)

    mock_record = MagicMock()
    mock_record.msg = f"Failed to authenticate with Bearer {token} in backend"
    mock_record.args = None

    mask_filter.filter(mock_record)
    assert token not in mock_record.msg
    assert "***REDACTED" in mock_record.msg


def test_heartbeat_payload_serialization():
    """Verify HeartbeatPayload contains required v0.1 fields."""
    payload = HeartbeatPayload(
        agent_id="cluster-agent-99",
        agent_version="0.1.0",
        status=AgentStatus.HEALTHY,
    )
    dump = payload.model_dump(by_alias=True)

    assert "agentId" in dump
    assert "agentVersion" in dump
    assert "status" in dump
    assert "reportedAt" in dump

    assert dump["agentId"] == "cluster-agent-99"
    assert dump["agentVersion"] == "0.1.0"
    assert dump["status"] == "HEALTHY"


@pytest.mark.asyncio
async def test_heartbeat_service_resilience_on_backend_failure():
    """Verify HeartbeatService continues running when backend is unreachable."""
    settings = Settings(
        SELFHEAL_BACKEND_URL="http://unreachable-backend:9999",
        SELFHEAL_AGENT_ID="test-agent-resilient",
        SELFHEAL_AGENT_TOKEN="test-token-123",
        SELFHEAL_HEARTBEAT_INTERVAL=1,
    )
    auth = AgentAuth(settings.SELFHEAL_AGENT_ID, settings.SELFHEAL_AGENT_TOKEN)

    mock_backend_client = MagicMock(spec=BackendClient)
    # Simulate backend connection failure
    mock_backend_client.send_heartbeat = AsyncMock(
        side_effect=BackendConnectionError("Connection refused")
    )

    service = HeartbeatService(
        settings=settings,
        auth=auth,
        backend_client=mock_backend_client,
    )

    # Calling single pulse should handle exception without throwing
    await service._send_single_pulse()
    assert mock_backend_client.send_heartbeat.called


def test_kubernetes_client_safe_local_failure():
    """Verify KubernetesClient handles missing local kubeconfig gracefully without crashing."""
    client = KubernetesClient(
        mode=KubernetesMode.LOCAL,
        kubeconfig_path="/non/existent/path/to/kubeconfig",
    )
    status = client.check_connectivity()
    assert status["connected"] is False
    assert "error" in status
