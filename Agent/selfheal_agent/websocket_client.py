"""WebSocket Client for SelfHeal Agent with token security, reconnect, and buffering."""

import asyncio
import json
import logging
import random
from collections import deque
from enum import Enum
from typing import Any, Callable, Coroutine, Optional

from websockets.asyncio.client import ClientConnection, connect
from websockets.exceptions import ConnectionClosed

from selfheal_agent.authenticator import AgentAuthenticator
from selfheal_agent.config import AgentConfig
from selfheal_agent.telemetry.schemas import (
    AckPayload,
    AuthenticatedPayload,
    AuthMessage,
    ErrorPayload,
    IncomingMessage,
    OutgoingEnvelope,
)
from selfheal_agent.utils.redaction import mask_token

logger = logging.getLogger("selfheal_agent.websocket")


class ConnectionState(str, Enum):
    DISCONNECTED = "DISCONNECTED"
    CONNECTING = "CONNECTING"
    AUTHENTICATED = "AUTHENTICATED"
    RECONNECTING = "RECONNECTING"
    FATAL_AUTH_ERROR = "FATAL_AUTH_ERROR"


MessageHandler = Callable[[IncomingMessage], Coroutine[Any, Any, None]]


class AgentWebSocketClient:
    """Async WebSocket client communicating with SelfHeal Main Backend."""

    def __init__(self, config: AgentConfig) -> None:
        self.config = config
        self.authenticator = AgentAuthenticator(config)
        self.state: ConnectionState = ConnectionState.DISCONNECTED
        self._ws: Optional[ClientConnection] = None
        self._message_handlers: list[MessageHandler] = []
        self._queue: deque[OutgoingEnvelope] = deque(maxlen=config.QUEUE_MAX_SIZE)
        self._run_task: Optional[asyncio.Task[None]] = None
        self._is_stopped = False
        self._reconnect_attempt = 0
        self._auth_event = asyncio.Event()

    @property
    def is_authenticated(self) -> bool:
        return self.state == ConnectionState.AUTHENTICATED and self._ws is not None

    def add_message_handler(self, handler: MessageHandler) -> None:
        self._message_handlers.append(handler)

    async def start(self) -> None:
        """Start background connection manager task."""
        if self._run_task is not None and not self._run_task.done():
            return
        self._is_stopped = False
        self._run_task = asyncio.create_task(self._lifecycle_loop(), name="ws_lifecycle")

    async def stop(self) -> None:
        """Disconnect cleanly and cancel background tasks."""
        self._is_stopped = True
        self.state = ConnectionState.DISCONNECTED
        self._auth_event.clear()

        if self._ws is not None:
            try:
                await self._ws.close(code=1000, reason="Agent shutting down")
            except Exception:
                pass
            self._ws = None

        if self._run_task is not None and not self._run_task.done():
            self._run_task.cancel()
            try:
                await self._run_task
            except asyncio.CancelledError:
                pass

    async def send(self, envelope: OutgoingEnvelope) -> bool:
        """Transmit envelope if connected, otherwise enqueue into in-memory buffer."""
        if self.is_authenticated and self._ws is not None:
            try:
                await self._ws.send(envelope.model_dump_json())
                return True
            except Exception as err:
                logger.warning("Failed transmitting over active WebSocket: %s", err)

        # Buffer message in queue
        if len(self._queue) >= self.config.QUEUE_MAX_SIZE:
            logger.warning("Send queue is at capacity (%d). Dropping oldest item.", self.config.QUEUE_MAX_SIZE)
        self._queue.append(envelope)
        return False

    async def _flush_queue(self) -> None:
        """Flush queued telemetry items once authenticated."""
        if not self.is_authenticated or self._ws is None:
            return

        queued_count = len(self._queue)
        if queued_count == 0:
            return

        logger.info("Flushing %d queued telemetry items...", queued_count)
        while self._queue and self.is_authenticated and self._ws is not None:
            msg = self._queue.popleft()
            try:
                await self._ws.send(msg.model_dump_json())
            except Exception as err:
                logger.error("Failed flushing item, returning to queue: %s", err)
                self._queue.appendleft(msg)
                break

    async def _lifecycle_loop(self) -> None:
        """Lifecycle loop handling connections, exponential backoff, and fatal errors."""
        while not self._is_stopped:
            try:
                await self._connect_and_listen()
            except asyncio.CancelledError:
                break
            except Exception as err:
                logger.error("Error in WebSocket session loop: %s", err)

            if self._is_stopped:
                break

            if self.state == ConnectionState.FATAL_AUTH_ERROR:
                logger.critical(
                    "❌ Halting WebSocket reconnection loop: Invalid AGENT_TOKEN (4001 Unauthorized)."
                )
                break

            self.state = ConnectionState.RECONNECTING
            self._auth_event.clear()
            self._reconnect_attempt += 1

            backoff = min(
                1.0 * (2.0 ** min(self._reconnect_attempt, 5)) + random.uniform(0.1, 0.5),
                30.0,
            )
            logger.warning(
                "WebSocket disconnected. Reconnecting in %.1fs (attempt #%d)...",
                backoff,
                self._reconnect_attempt,
            )
            await asyncio.sleep(backoff)

    async def _connect_and_listen(self) -> None:
        """Establish single WebSocket connection using secure headers."""
        headers = self.authenticator.get_connection_headers()
        masked = mask_token(self.config.AGENT_TOKEN)
        logger.info(
            "Connecting to Main Backend at %s with token %s",
            self.config.AGENT_SERVER_URL,
            masked,
        )

        self.state = ConnectionState.CONNECTING
        try:
            # Note: We do NOT append token in URL query parameter
            async with connect(
                self.config.AGENT_SERVER_URL,
                additional_headers=headers,
                ping_interval=20,
                ping_timeout=20,
                open_timeout=15,
                close_timeout=5,
            ) as ws:
                self._ws = ws
                self._reconnect_attempt = 0
                logger.info("Connected to WebSocket transport. Sending handshake payload...")

                # Send explicit auth payload for backend fallback compatibility
                auth_payload = AuthMessage(token=self.config.AGENT_TOKEN)
                await ws.send(auth_payload.model_dump_json())

                async for raw_message in ws:
                    await self._handle_raw_message(raw_message)

        except ConnectionClosed as cc:
            code = cc.rcvd.code if cc.rcvd else (cc.sent.code if cc.sent else None)
            reason = cc.rcvd.reason if cc.rcvd else (cc.sent.reason if cc.sent else "")
            logger.warning("WebSocket closed: code=%s, reason=%s", code, reason)

            if code == 4001 or "unauthorized" in str(reason).lower():
                self.state = ConnectionState.FATAL_AUTH_ERROR
                return
        except OSError as oe:
            logger.warning("Network connection failed: %s", oe)
        finally:
            self._ws = None
            if self.state != ConnectionState.FATAL_AUTH_ERROR:
                self.state = ConnectionState.DISCONNECTED

    async def _handle_raw_message(self, raw_message: str | bytes) -> None:
        """Parse incoming JSON frames and dispatch to handlers."""
        try:
            if isinstance(raw_message, bytes):
                raw_message = raw_message.decode("utf-8")
            data = json.loads(raw_message)
        except Exception as err:
            logger.warning("Non-JSON frame received: %s", err)
            return

        status = data.get("status")
        msg_type = data.get("type")

        if status == "authenticated":
            self.state = ConnectionState.AUTHENTICATED
            self._auth_event.set()
            logger.info("✅ Agent successfully authenticated by Main Backend! (%s)", data.get("agent"))
            await self._flush_queue()
            payload: IncomingMessage = AuthenticatedPayload.model_validate(data)
        elif status == "ack":
            logger.debug("Received ACK: type=%s, record_id=%s", msg_type, data.get("record_id"))
            payload = AckPayload.model_validate(data)
        elif status == "error":
            logger.error("Server returned error: %s", data.get("message"))
            payload = ErrorPayload.model_validate(data)
        else:
            logger.debug("Received generic message: %s", data)
            return

        for handler in self._message_handlers:
            try:
                await handler(payload)
            except Exception as handler_err:
                logger.error("Error in WebSocket message handler: %s", handler_err)
