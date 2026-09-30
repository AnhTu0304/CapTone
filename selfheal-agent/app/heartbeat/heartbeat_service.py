"""Periodic Heartbeat Service for SelfHeal Agent v0.1.

Periodically sends health status and telemetry metadata to the SelfHeal Backend.
Guarantees resilient operation: temporary backend outages do NOT crash or terminate
the agent daemon loop.
"""

import asyncio
from datetime import datetime, timezone
from typing import Optional

from app.auth.agent_auth import AgentAuth
from app.config.constants import AgentStatus
from app.config.settings import Settings
from app.logging.logger import get_logger
from app.transport.backend_client import BackendClient, BackendConnectionError
from app.transport.models import HeartbeatPayload

logger = get_logger("selfheal.heartbeat.service")


class HeartbeatService:
    """Manages periodic heartbeat dispatches in an asynchronous background loop."""

    def __init__(
        self,
        settings: Settings,
        auth: AgentAuth,
        backend_client: BackendClient,
        k8s_client: Optional[object] = None,
    ):
        self.settings = settings
        self.auth = auth
        self.backend_client = backend_client
        self.k8s_client = k8s_client

        self._running = False
        self._task: Optional[asyncio.Task] = None
        self._current_status = AgentStatus.STARTING

    @property
    def current_status(self) -> AgentStatus:
        """Get the current operational status of the agent."""
        return self._current_status

    def set_status(self, status: AgentStatus) -> None:
        """Update operational status reported in heartbeats."""
        if self._current_status != status:
            logger.info("Agent status transitioned from %s to %s", self._current_status.value, status.value)
            self._current_status = status

    def _collect_metadata(self) -> dict:
        """Collect non-destructive telemetry and cluster connectivity status."""
        metadata = {
            "mode": self.settings.SELFHEAL_KUBERNETES_MODE.value,
        }

        if self.k8s_client and hasattr(self.k8s_client, "get_connectivity_status"):
            try:
                conn_status = self.k8s_client.get_connectivity_status()
                metadata["kubernetes"] = conn_status
            except Exception as e:
                metadata["kubernetes"] = {"connected": False, "error": str(e)}

        return metadata

    async def _send_single_pulse(self) -> None:
        """Assemble and transmit a single heartbeat payload."""
        payload = HeartbeatPayload(
            agent_id=self.auth.agent_id,
            agent_version=self.settings.AGENT_VERSION,
            status=self._current_status,
            reported_at=datetime.now(timezone.utc),
            metadata=self._collect_metadata(),
        )

        try:
            await self.backend_client.send_heartbeat(payload)
        except BackendConnectionError:
            # Expected during temporary backend downtime - do not raise to keep loop alive
            logger.debug("Heartbeat pulse skipped due to backend unavailability; will retry next interval")
        except Exception as exc:
            logger.warning("Uncaught error during heartbeat pulse: %s", exc)

    async def _loop(self) -> None:
        """Heartbeat execution loop running at configured intervals."""
        logger.info(
            "Heartbeat service started for Agent [%s] with interval %ds",
            self.auth.agent_id,
            self.settings.SELFHEAL_HEARTBEAT_INTERVAL,
        )

        # Mark as HEALTHY once loop initializes (if not already set)
        if self._current_status == AgentStatus.STARTING:
            self.set_status(AgentStatus.HEALTHY)

        while self._running:
            await self._send_single_pulse()

            try:
                await asyncio.sleep(self.settings.SELFHEAL_HEARTBEAT_INTERVAL)
            except asyncio.CancelledError:
                logger.debug("Heartbeat sleep cancelled during shutdown")
                break

    def start(self) -> asyncio.Task:
        """Start heartbeat loop as a background asyncio Task."""
        if self._running:
            logger.warning("Heartbeat service is already running")
            return self._task

        self._running = True
        self._task = asyncio.create_task(self._loop(), name="selfheal-heartbeat-loop")
        return self._task

    async def stop(self) -> None:
        """Gracefully stop heartbeat loop and transmit a final STOPPING status."""
        if not self._running:
            return

        logger.info("Stopping Heartbeat service...")
        self._running = False
        self.set_status(AgentStatus.STOPPING)

        # Attempt to send final offline state if possible
        try:
            await asyncio.wait_for(self._send_single_pulse(), timeout=2.0)
        except Exception:
            pass

        if self._task and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass

        logger.info("Heartbeat service stopped cleanly")
