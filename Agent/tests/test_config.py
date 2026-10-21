"""Tests for AgentConfig and validation logic."""

import pytest
from pydantic import ValidationError

from selfheal_agent.config import AgentConfig, load_config
from selfheal_agent.utils.redaction import mask_token


def test_valid_config() -> None:
    cfg = AgentConfig(
        AGENT_SERVER_URL="ws://localhost:5000/api/v1/agent/connect",
        AGENT_TOKEN="cap_test_token_123456789",
    )
    assert cfg.AGENT_SERVER_URL == "ws://localhost:5000/api/v1/agent/connect"
    assert cfg.AGENT_TOKEN == "cap_test_token_123456789"
    assert cfg.AGENT_UID == "selfheal-agent-default"
    assert cfg.METRICS_INTERVAL_MS == 5000
    assert cfg.LOG_COLLECTION_INTERVAL_MS == 5000
    assert cfg.K8S_NAMESPACE == "default"
    assert cfg.MONITOR_ALL_NAMESPACES is False
    assert cfg.ENABLE_HEALING_ACTIONS is False
    assert cfg.HEALTH_PORT == 8080


def test_wss_scheme_supported() -> None:
    cfg = AgentConfig(
        AGENT_SERVER_URL="wss://cloud.captone.ai/api/v1/agent/connect",
        AGENT_TOKEN="valid_token",
    )
    assert cfg.AGENT_SERVER_URL.startswith("wss://")


def test_invalid_scheme_rejected() -> None:
    with pytest.raises(ValidationError) as exc:
        AgentConfig(
            AGENT_SERVER_URL="http://localhost:5000/api/v1/agent/connect",
            AGENT_TOKEN="valid_token",
        )
    assert "AGENT_SERVER_URL must start with 'ws://' or 'wss://'" in str(exc.value)


def test_missing_token_rejected() -> None:
    with pytest.raises(ValidationError):
        AgentConfig(
            AGENT_SERVER_URL="ws://localhost:5000/api/v1/agent/connect",
            AGENT_TOKEN="",
        )


def test_empty_token_rejected() -> None:
    with pytest.raises(ValidationError):
        AgentConfig(
            AGENT_SERVER_URL="ws://localhost:5000/api/v1/agent/connect",
            AGENT_TOKEN="   ",
        )


def test_load_config_with_overrides() -> None:
    overrides = {
        "AGENT_SERVER_URL": "ws://127.0.0.1:5000/ws",
        "AGENT_TOKEN": "custom_override_token",
        "METRICS_INTERVAL_MS": "2500",
        "LOG_LEVEL": "debug",
    }
    cfg = load_config(overrides)
    assert cfg.AGENT_TOKEN == "custom_override_token"
    assert cfg.METRICS_INTERVAL_MS == 2500
    assert cfg.LOG_LEVEL == "DEBUG"


def test_mask_token() -> None:
    assert mask_token("cap_live_secret123456") == "cap_***3456"
    assert mask_token("short") == "***"
    assert mask_token("") == "<none>"
