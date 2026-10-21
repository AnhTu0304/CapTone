"""Agent authentication manager and credential encapsulation."""

from typing import Any
from selfheal_agent.config import AgentConfig


class AgentAuthenticator:
    """Encapsulates token verification, HTTP headers generation, and auth messages."""

    def __init__(self, config: AgentConfig) -> None:
        self.config = config

    def get_connection_headers(self) -> dict[str, str]:
        """Construct secure HTTP headers for WebSocket handshake.

        Note: As per security guidelines, token is passed strictly in headers
        and NOT placed into URL query parameters to avoid logging by intermediate proxies.
        """
        return {
            "x-agent-token": self.config.AGENT_TOKEN,
            "Authorization": f"Bearer {self.config.AGENT_TOKEN}",
            "User-Agent": f"SelfHealAgent/1.0.0 ({self.config.AGENT_UID})",
        }

    def get_auth_payload(self) -> dict[str, Any]:
        """Generate first-message auth handshake payload."""
        return {
            "type": "auth",
            "token": self.config.AGENT_TOKEN,
        }
