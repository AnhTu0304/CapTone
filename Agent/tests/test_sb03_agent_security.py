from unittest.mock import MagicMock

from selfheal_agent.config import AgentConfig
from selfheal_agent.main import AgentService
from selfheal_agent.telemetry.schemas import ExecuteActionData, ExecuteActionPayload


def _make_agent(enable_healing: bool = True) -> AgentService:
    config = AgentConfig(
        AGENT_SERVER_URL="ws://localhost:5000/api/v1/agent/connect",
        AGENT_HTTP_URL="http://localhost:5000",
        AGENT_TOKEN="test-token-123",
        ENABLE_HEALING_ACTIONS=enable_healing,
    )
    agent = AgentService(config)
    agent.apps_v1 = MagicMock()
    agent.core_v1 = MagicMock()
    agent.networking_v1 = MagicMock()
    return agent


def test_sb03_a01_disabled_healing_actions_blocks_mutating_commands_but_allows_no_action():
    agent = _make_agent(enable_healing=False)
    restart_res = agent._execute_action_sync(
        ExecuteActionPayload(
            type="execute_action",
            data=ExecuteActionData(
                action_id="sb03-disabled-1",
                action_type="RESTART_POD",
                target_name="orders-api",
                namespace="default",
            ),
        )
    )
    assert restart_res.data.status == "FAILED"
    agent.apps_v1.patch_namespaced_deployment.assert_not_called()

    no_action_res = agent._execute_action_sync(
        ExecuteActionPayload(
            type="execute_action",
            data=ExecuteActionData(
                action_id="sb03-disabled-2",
                action_type="NO_ACTION",
                target_name="orders-api",
                namespace="default",
            ),
        )
    )
    assert no_action_res.data.status == "COMPLETED"


def test_sb03_a02_disallowed_action_type_fails_closed():
    agent = _make_agent(enable_healing=True)
    res = agent._execute_action_sync(
        ExecuteActionPayload(
            type="execute_action",
            data=ExecuteActionData(
                action_id="sb03-bad-action-1",
                action_type="ARBITRARY_SHELL_EXEC",
                target_name="orders-api",
                namespace="default",
            ),
        )
    )
    assert res.data.status == "FAILED"


def test_sb03_a03_action_id_replay_and_expiry_rejected():
    agent = _make_agent(enable_healing=True)

    # First execution succeeds with canonical COMPLETED status
    first = agent._execute_action_sync(
        ExecuteActionPayload(
            type="execute_action",
            data=ExecuteActionData(
                action_id="sb03-replay-1",
                action_type="RESTART_POD",
                target_name="orders-api",
                namespace="default",
            ),
        )
    )
    assert first.data.status == "COMPLETED"

    # Second execution with same action_id must be rejected as replay
    replay = agent._execute_action_sync(
        ExecuteActionPayload(
            type="execute_action",
            data=ExecuteActionData(
                action_id="sb03-replay-1",
                action_type="RESTART_POD",
                target_name="orders-api",
                namespace="default",
            ),
        )
    )
    assert replay.data.status == "FAILED"

    # Expired command must be rejected
    expired = agent._execute_action_sync(
        ExecuteActionPayload(
            type="execute_action",
            data=ExecuteActionData(
                action_id="sb03-expired-1",
                action_type="RESTART_POD",
                target_name="orders-api",
                namespace="default",
                params={"expires_at": "2020-01-01T00:00:00Z"},
            ),
        )
    )
    assert expired.data.status == "FAILED"


def test_sb03_a04_protected_namespaces_block_all_mutations_including_ip_block():
    agent = _make_agent(enable_healing=True)
    res = agent._execute_action_sync(
        ExecuteActionPayload(
            type="execute_action",
            data=ExecuteActionData(
                action_id="sb03-ns-1",
                action_type="TEMPORARY_IP_BLOCK",
                target_name="coredns",
                namespace="kube-system",
                params={"ip": "198.51.100.42"},
            ),
        )
    )
    assert res.data.status == "FAILED"
    agent.networking_v1.create_namespaced_network_policy.assert_not_called()


def test_sb03_a05_ip_cidr_validation_rejects_private_broad_invalid_and_allows_public():
    agent = _make_agent(enable_healing=True)

    for idx, bad_params in enumerate([
        {},
        {"ip": "127.0.0.1"},
        {"ip": "10.0.0.5"},
        {"ip": "192.168.1.10"},
        {"ip": "0.0.0.0/0"},
        {"ip": "198.51.100.0/16"},
        {"ip": "not-an-ip;rm -rf"},
    ]):
        res = agent._execute_action_sync(
            ExecuteActionPayload(
                type="execute_action",
                data=ExecuteActionData(
                    action_id=f"sb03-bad-ip-{idx}",
                    action_type="TEMPORARY_IP_BLOCK",
                    target_name="orders-api",
                    namespace="default",
                    params=bad_params,
                ),
            )
        )
        assert res.data.status == "FAILED", f"Expected FAILED for {bad_params}"

    ok = agent._execute_action_sync(
        ExecuteActionPayload(
            type="execute_action",
            data=ExecuteActionData(
                action_id="sb03-ok-ip-1",
                action_type="TEMPORARY_IP_BLOCK",
                target_name="orders-api",
                namespace="default",
                params={"ip": "198.51.100.42", "duration_minutes": 5},
            ),
        )
    )
    assert ok.data.status == "COMPLETED"
    agent.networking_v1.create_namespaced_network_policy.assert_called_once()


def test_phase3_agent_log_redaction_filter():
    import io
    import logging
    from selfheal_agent.utils.logger import SensitiveDataLogFilter
    from selfheal_agent.utils.redaction import redact_sensitive_data

    stream = io.StringIO()
    handler = logging.StreamHandler(stream)
    handler.addFilter(SensitiveDataLogFilter())
    test_logger = logging.getLogger("phase3_agent_redaction_probe")
    test_logger.handlers = [handler]
    test_logger.setLevel(logging.INFO)
    test_logger.propagate = False

    test_logger.info(
        "WS connect url=wss://api.local/ws?token=cap_secret12345678 Authorization=Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.sig123 redis://:RedisPass99@redis:6379"
    )
    rendered = stream.getvalue()
    assert "cap_secret12345678" not in rendered
    assert "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.sig123" not in rendered
    assert "RedisPass99" not in rendered
    assert "cap_[REDACTED]" in redact_sensitive_data("agent token cap_abcdef123456")

