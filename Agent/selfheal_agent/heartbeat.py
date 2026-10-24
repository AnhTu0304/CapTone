"""Periodic Heartbeat, Error Handling, and Retry Module for SelfHeal Agent [PB11 2.2]."""

import asyncio
from datetime import datetime, timezone
from enum import Enum
import logging
import random
from typing import Any, Optional
from urllib.parse import urlparse

import aiohttp

from selfheal_agent.authenticator import AgentAuthenticator
from selfheal_agent.config import AgentConfig
from selfheal_agent.utils.redaction import mask_token

logger = logging.getLogger("selfheal_agent.heartbeat")


class HeartbeatState(str, Enum):
    HEALTHY = "HEALTHY"
    DEGRADED = "DEGRADED"
    UNAUTHORIZED = "UNAUTHORIZED"
    STOPPED = "STOPPED"


def derive_heartbeat_url(ws_url: str, explicit_http_url: Optional[str] = None) -> str:
    """Derive authoritative Backend HTTP heartbeat endpoint from config or WS server URL."""
    if explicit_http_url:
        trimmed = explicit_http_url.strip().rstrip("/")
        if trimmed.endswith("/api/v1/agents/heartbeat"):
            return trimmed
        return f"{trimmed}/api/v1/agents/heartbeat"

    trimmed = ws_url.strip()
    if trimmed.startswith("wss://"):
        base = "https://" + trimmed[6:]
    elif trimmed.startswith("ws://"):
        base = "http://" + trimmed[5:]
    else:
        base = trimmed

    parsed = urlparse(base)
    scheme = parsed.scheme or "http"
    netloc = parsed.netloc or parsed.path
    return f"{scheme}://{netloc}/api/v1/agents/heartbeat"


class AgentHeartbeatClient:
    """Manages periodic HTTP heartbeats with finite timeout, exponential backoff, jitter, and error handling."""

    def __init__(
        self,
        config: AgentConfig,
        heartbeat_url: Optional[str] = None,
        interval_seconds: Optional[float] = None,
        timeout_seconds: Optional[float] = None,
        max_retries: Optional[int] = None,
        backoff_factor: Optional[float] = None,
        max_backoff_seconds: Optional[float] = None,
    ) -> None:
        self.config = config
        self.authenticator = AgentAuthenticator(config)
        self.heartbeat_url = heartbeat_url or derive_heartbeat_url(
            config.AGENT_SERVER_URL, getattr(config, "AGENT_HTTP_URL", None)
        )
        self.interval_seconds = (
            interval_seconds
            if interval_seconds is not None
            else getattr(config, "HEARTBEAT_INTERVAL_SECONDS", 15.0)
        )
        self.timeout_seconds = (
            timeout_seconds
            if timeout_seconds is not None
            else getattr(config, "HEARTBEAT_TIMEOUT_SECONDS", 5.0)
        )
        self.max_retries = (
            max_retries
            if max_retries is not None
            else getattr(config, "HEARTBEAT_MAX_RETRIES", 3)
        )
        self.backoff_factor = (
            backoff_factor
            if backoff_factor is not None
            else getattr(config, "HEARTBEAT_BACKOFF_FACTOR", 1.5)
        )
        self.max_backoff_seconds = (
            max_backoff_seconds
            if max_backoff_seconds is not None
            else getattr(config, "HEARTBEAT_MAX_BACKOFF_SECONDS", 10.0)
        )

        self.state: HeartbeatState = HeartbeatState.DEGRADED
        self.last_successful_heartbeat: Optional[datetime] = None
        self.last_latency_ms: Optional[int] = None
        self.consecutive_failures: int = 0
        self.last_error: Optional[str] = None

        self._session: Optional[aiohttp.ClientSession] = None
        self._lock = asyncio.Lock()
        self._stop_event = asyncio.Event()
        self._task: Optional[asyncio.Task[None]] = None
        self._is_stopped = False

    @property
    def is_running(self) -> bool:
        return self._task is not None and not self._task.done() and not self._is_stopped

    async def _get_session(self) -> aiohttp.ClientSession:
        if self._session is None or self._session.closed:
            self._session = aiohttp.ClientSession()
        return self._session

    async def start(self) -> None:
        """Start the periodic heartbeat loop task."""
        if self._task is not None and not self._task.done():
            return
        self._is_stopped = False
        self._stop_event.clear()
        self._task = asyncio.create_task(self._periodic_loop(), name="agent_heartbeat_loop")
        logger.info(
            "💓 Agent heartbeat scheduler started (interval: %.1fs, endpoint: %s)",
            self.interval_seconds,
            self.heartbeat_url,
        )

    async def stop(self) -> None:
        """Gracefully stop background loop and close HTTP session."""
        self._is_stopped = True
        self._stop_event.set()
        self.state = HeartbeatState.STOPPED

        if self._task is not None and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None

        await self.close()
        logger.info("Agent heartbeat scheduler stopped.")

    async def close(self) -> None:
        """Close internal aiohttp ClientSession."""
        if self._session is not None and not self._session.closed:
            await self._session.close()
            self._session = None

    async def send_heartbeat_once(self) -> bool:
        """Execute a single heartbeat request with concurrency lock and bounded retries."""
        if self._is_stopped:
            return False

        async with self._lock:
            return await self._execute_heartbeat_with_retry()

    async def _execute_heartbeat_with_retry(self) -> bool:
        session = await self._get_session()
        headers = self.authenticator.get_connection_headers()
        headers["Content-Type"] = "application/json"

        reported_time = datetime.now(timezone.utc)
        payload = {
            "latency_ms": self.last_latency_ms if self.last_latency_ms is not None else 10,
            "agent_version": "1.0.0",
            "status": "ONLINE",
            "timestamp": reported_time.isoformat(),
            "metadata": {
                "agent_uid": self.config.AGENT_UID,
                "cluster_id": self.config.CLUSTER_ID,
                "environment_id": self.config.ENVIRONMENT_ID,
                "k8s_namespace": self.config.K8S_NAMESPACE,
            },
        }

        attempts = max(1, self.max_retries)
        for attempt in range(1, attempts + 1):
            if self._is_stopped:
                return False

            req_start = asyncio.get_event_loop().time()
            try:
                timeout = aiohttp.ClientTimeout(total=self.timeout_seconds)
                async with session.post(
                    self.heartbeat_url,
                    headers=headers,
                    json=payload,
                    timeout=timeout,
                ) as resp:
                    duration_ms = max(1, int((asyncio.get_event_loop().time() - req_start) * 1000))

                    if 200 <= resp.status < 300:
                        self.last_latency_ms = duration_ms
                        self.last_successful_heartbeat = datetime.now(timezone.utc)
                        self.consecutive_failures = 0
                        self.last_error = None
                        self.state = HeartbeatState.HEALTHY
                        logger.debug("💓 Heartbeat success: status=%d, latency=%dms", resp.status, duration_ms)
                        return True

                    if resp.status in (401, 403):
                        self.consecutive_failures += 1
                        self.state = HeartbeatState.UNAUTHORIZED
                        self.last_error = f"HTTP {resp.status} Unauthorized / Revoked"
                        logger.critical(
                            "❌ Heartbeat rejected with HTTP %d: Token invalid or agent revoked. Halting rapid retries.",
                            resp.status,
                        )
                        return False

                    if resp.status == 400:
                        self.consecutive_failures += 1
                        self.state = HeartbeatState.DEGRADED
                        self.last_error = "HTTP 400 Bad Request"
                        logger.error("Heartbeat rejected with HTTP 400 Bad Request. Skipping retries for invalid payload.")
                        return False

                    if resp.status == 429:
                        self.last_error = "HTTP 429 Too Many Requests"
                        retry_after_str = resp.headers.get("Retry-After")
                        sleep_time = self._calculate_retry_after(retry_after_str, attempt)
                        logger.warning("Heartbeat rate limited (429). Waiting %.2fs before retry (attempt %d/%d)...", sleep_time, attempt, attempts)
                        if attempt < attempts:
                            await self._cancellable_sleep(sleep_time)
                            continue
                        break

                    # Server error 5xx
                    self.last_error = f"HTTP {resp.status} Server Error"
                    logger.warning("Heartbeat server error (status=%d, attempt=%d/%d)", resp.status, attempt, attempts)

            except (asyncio.TimeoutError, aiohttp.ClientError, OSError) as exc:
                self.last_error = str(exc)
                logger.warning("Heartbeat request failed (attempt %d/%d): %s", attempt, attempts, exc)

            if attempt < attempts and not self._is_stopped:
                backoff = min(
                    (self.backoff_factor ** attempt) + random.uniform(0.05, 0.2),
                    self.max_backoff_seconds,
                )
                logger.debug("Retrying heartbeat in %.2fs (attempt %d)...", backoff, attempt + 1)
                await self._cancellable_sleep(backoff)

        self.consecutive_failures += 1
        if self.state != HeartbeatState.UNAUTHORIZED:
            self.state = HeartbeatState.DEGRADED
        return False

    def _calculate_retry_after(self, retry_after_header: Optional[str], attempt: int) -> float:
        if retry_after_header:
            try:
                seconds = float(retry_after_header.strip())
                return min(max(0.5, seconds), self.max_backoff_seconds)
            except ValueError:
                pass
        return min((self.backoff_factor ** attempt) + random.uniform(0.1, 0.3), self.max_backoff_seconds)

    async def _cancellable_sleep(self, seconds: float) -> None:
        try:
            await asyncio.wait_for(self._stop_event.wait(), timeout=seconds)
        except asyncio.TimeoutError:
            pass

    async def _periodic_loop(self) -> None:
        while not self._is_stopped:
            try:
                await self.send_heartbeat_once()
            except asyncio.CancelledError:
                break
            except Exception as err:
                logger.error("Unexpected error in heartbeat cycle: %s", err)

            try:
                await asyncio.wait_for(self._stop_event.wait(), timeout=self.interval_seconds)
            except asyncio.TimeoutError:
                pass
            except asyncio.CancelledError:
                break
