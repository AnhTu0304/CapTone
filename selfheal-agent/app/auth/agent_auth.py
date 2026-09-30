"""Agent Authentication Module for SelfHeal Agent v0.1.

Encapsulates Agent credentials and securely generates authentication headers
for communication with the SelfHeal Backend API.
"""

from typing import Dict
from pydantic import SecretStr


class AgentAuth:
    """Manages credentials and authentication headers for the SelfHeal Agent."""

    def __init__(self, agent_id: str, agent_token: SecretStr | str):
        if not agent_id or not str(agent_id).strip():
            raise ValueError("agent_id must be a non-empty string")

        self.agent_id = str(agent_id).strip()

        if isinstance(agent_token, SecretStr):
            self._token = agent_token
        else:
            self._token = SecretStr(str(agent_token).strip())

        if not self._token.get_secret_value():
            raise ValueError("agent_token cannot be empty")

    @property
    def token_secret(self) -> SecretStr:
        """Access protected SecretStr representation."""
        return self._token

    def get_token_raw(self) -> str:
        """Retrieve raw secret token for HTTP header insertion ONLY."""
        return self._token.get_secret_value()

    def get_masked_token(self) -> str:
        """Return masked token suitable for display or audit without exposing secrets."""
        raw = self.get_token_raw()
        if len(raw) <= 8:
            return "***"
        return f"{raw[:4]}...{raw[-4:]}"

    def get_auth_headers(self) -> Dict[str, str]:
        """Generate HTTP headers required to authenticate with the SelfHeal Backend."""
        return {
            "X-Agent-ID": self.agent_id,
            "Authorization": f"Bearer {self.get_token_raw()}",
            "Content-Type": "application/json",
            "User-Agent": f"SelfHeal-Agent/{self.agent_id}",
        }

    def __repr__(self) -> str:
        return f"AgentAuth(agent_id='{self.agent_id}', token='{self.get_masked_token()}')"

    def __str__(self) -> str:
        return self.__repr__()
