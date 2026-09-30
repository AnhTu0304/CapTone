"""HTTP Backend Client for SelfHeal Agent v0.1.

Handles robust asynchronous HTTP communication with the SelfHeal Backend API,
including authentication headers, connection/request timeouts, and exponential
backoff retry on transient network or 5xx server failures using tenacity.
"""

from typing import Optional
import httpx
from tenacity import (
    RetryError,
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from app.auth.agent_auth import AgentAuth
from app.config.constants import HEARTBEAT_ENDPOINT
from app.logging.logger import get_logger
from app.transport.models import HeartbeatPayload, HeartbeatResponse

logger = get_logger("selfheal.transport.backend_client")


class BackendConnectionError(Exception):
    """Raised when connection to SelfHeal Backend fails after all retries."""
    pass


class BackendClient:
    """Asynchronous HTTP Client for communicating with the SelfHeal Backend."""

    def __init__(
        self,
        base_url: str,
        auth: AgentAuth,
        connect_timeout: float = 5.0,
        request_timeout: float = 10.0,
    ):
        self.base_url = base_url.rstrip("/")
        self.auth = auth
        self.connect_timeout = connect_timeout
        self.request_timeout = request_timeout

        timeout_config = httpx.Timeout(
            timeout=self.request_timeout,
            connect=self.connect_timeout,
            read=self.request_timeout,
            write=self.request_timeout,
        )

        self._client: Optional[httpx.AsyncClient] = httpx.AsyncClient(
            base_url=self.base_url,
            headers=self.auth.get_auth_headers(),
            timeout=timeout_config,
        )

    async def get_client(self) -> httpx.AsyncClient:
        """Get or recreate the active httpx client session."""
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                base_url=self.base_url,
                headers=self.auth.get_auth_headers(),
                timeout=httpx.Timeout(
                    timeout=self.request_timeout,
                    connect=self.connect_timeout,
                ),
            )
        return self._client

    @retry(
        retry=retry_if_exception_type((httpx.TransportError, httpx.TimeoutException)),
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=4),
        reraise=True,
    )
    async def _post_heartbeat_with_retry(self, url: str, data: dict) -> httpx.Response:
        """Execute HTTP POST with retry policy for transient network drops."""
        client = await self.get_client()
        response = await client.post(url, json=data)

        # Retry if server returns 5xx internal server or gateway error
        if response.status_code in {500, 502, 503, 504}:
            response.raise_for_status()

        return response

    async def send_heartbeat(self, payload: HeartbeatPayload) -> Optional[HeartbeatResponse]:
        """Send periodic heartbeat to backend.

        Catches transport and status errors without crashing the caller,
        allowing the agent loop to remain alive even during backend downtime.
        """
        url = HEARTBEAT_ENDPOINT
        serialized_payload = payload.model_dump(by_alias=True, mode="json")

        try:
            logger.debug(
                "Dispatching heartbeat for agent %s to %s%s",
                payload.agent_id,
                self.base_url,
                url,
            )
            response = await self._post_heartbeat_with_retry(url, serialized_payload)

            if response.status_code in {200, 201, 202}:
                logger.info(
                    "Heartbeat acknowledged by backend [%s] (HTTP %d)",
                    self.base_url,
                    response.status_code,
                )
                try:
                    return HeartbeatResponse.model_validate(response.json())
                except Exception:
                    return HeartbeatResponse(status="ACK", acknowledged=True)

            logger.warning(
                "Backend rejected heartbeat with unexpected status HTTP %d: %s",
                response.status_code,
                response.text[:200],
            )
            return None

        except (httpx.RequestError, RetryError) as err:
            logger.warning(
                "Unable to connect to SelfHeal Backend at %s: %s (agent will continue running)",
                self.base_url,
                str(err),
            )
            raise BackendConnectionError(f"Backend unreachable at {self.base_url}: {err}") from err
        except Exception as exc:
            logger.error(
                "Unexpected failure while sending heartbeat: %s",
                str(exc),
                exc_info=True,
            )
            raise BackendConnectionError(f"Heartbeat dispatch failed: {exc}") from exc

    async def close(self) -> None:
        """Gracefully close the underlying HTTP client session."""
        if self._client and not self._client.is_closed:
            await self._client.aclose()
            logger.debug("Closed BackendClient HTTP transport session")
