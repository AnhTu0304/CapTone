"""Main Application Entrypoint for SelfHeal Kubernetes Agent v0.1.

Orchestrates startup lifecycle, dependency injection, structured logging,
heartbeat telemetry service, and graceful OS signal shutdown.
"""

import asyncio
import os
import signal
import sys
from typing import Optional

from app.auth.agent_auth import AgentAuth
from app.config.settings import Settings, get_settings
from app.heartbeat.heartbeat_service import HeartbeatService
from app.kubernetes.client import KubernetesClient
from app.logging.logger import get_logger, setup_logging
from app.transport.backend_client import BackendClient

logger = get_logger("selfheal.main")


class AgentApplication:
    """Manages the lifecycle and dependencies of the SelfHeal Agent."""

    def __init__(self, settings: Settings):
        self.settings = settings
        self.stop_event = asyncio.Event()

        # Dependencies initialized in setup
        self.auth: Optional[AgentAuth] = None
        self.backend_client: Optional[BackendClient] = None
        self.k8s_client: Optional[KubernetesClient] = None
        self.heartbeat_service: Optional[HeartbeatService] = None

    def initialize_dependencies(self) -> None:
        """Instantiate and wire domain components according to Dependency Inversion."""
        logger.info("Initializing Agent credentials and authentication...")
        self.auth = AgentAuth(
            agent_id=self.settings.SELFHEAL_AGENT_ID,
            agent_token=self.settings.SELFHEAL_AGENT_TOKEN,
        )

        logger.info("Initializing HTTP transport client for backend: %s", self.settings.SELFHEAL_BACKEND_URL)
        self.backend_client = BackendClient(
            base_url=self.settings.SELFHEAL_BACKEND_URL,
            auth=self.auth,
            connect_timeout=self.settings.HTTP_CONNECT_TIMEOUT,
            request_timeout=self.settings.HTTP_REQUEST_TIMEOUT,
        )

        logger.info("Initializing Kubernetes client in [%s] mode...", self.settings.SELFHEAL_KUBERNETES_MODE.value)
        self.k8s_client = KubernetesClient(
            mode=self.settings.SELFHEAL_KUBERNETES_MODE,
            kubeconfig_path=self.settings.KUBECONFIG_PATH,
        )

        # Detect Kubernetes connectivity
        k8s_status = self.k8s_client.check_connectivity()
        if k8s_status.get("connected"):
            logger.info(
                "Kubernetes cluster connection verified (version: %s, platform: %s)",
                k8s_status.get("git_version", "unknown"),
                k8s_status.get("platform", "unknown"),
            )
        else:
            logger.warning(
                "Kubernetes cluster connectivity check failed: %s (agent will continue monitoring)",
                k8s_status.get("error", "Unknown error"),
            )

        logger.info("Initializing Heartbeat service (interval: %ds)...", self.settings.SELFHEAL_HEARTBEAT_INTERVAL)
        self.heartbeat_service = HeartbeatService(
            settings=self.settings,
            auth=self.auth,
            backend_client=self.backend_client,
            k8s_client=self.k8s_client,
        )

    async def run(self) -> None:
        """Run the Agent main loop until shutdown signal is received."""
        self.initialize_dependencies()

        # Start periodic heartbeat in background
        heartbeat_task = self.heartbeat_service.start()

        logger.info(
            "SelfHeal Agent v%s successfully started [AgentID: %s] [Mode: %s]",
            self.settings.AGENT_VERSION,
            self.auth.agent_id,
            self.settings.SELFHEAL_KUBERNETES_MODE.value,
        )

        try:
            # Wait until termination signal is received
            await self.stop_event.wait()
        except asyncio.CancelledError:
            logger.info("Agent main loop cancellation requested")
        finally:
            await self.shutdown()

    async def shutdown(self) -> None:
        """Execute graceful shutdown sequence."""
        logger.info("Initiating graceful shutdown for SelfHeal Agent...")

        # 1. Stop Heartbeat service
        if self.heartbeat_service:
            await self.heartbeat_service.stop()

        # 2. Close HTTP transport session
        if self.backend_client:
            await self.backend_client.close()

        logger.info("SelfHeal Agent shutdown completed cleanly")


def handle_signals(app: AgentApplication, loop: asyncio.AbstractEventLoop) -> None:
    """Register OS signal listeners for graceful shutdown across platforms."""
    def trigger_stop():
        logger.info("Termination signal received, triggering shutdown...")
        loop.call_soon_threadsafe(app.stop_event.set)

    # Windows and POSIX compatible signal handling
    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(sig, trigger_stop)
        except (NotImplementedError, AttributeError):
            # Fallback on platforms where loop.add_signal_handler is not implemented (e.g. Windows SelectorEventLoop)
            signal.signal(sig, lambda *_: trigger_stop())


async def main_async() -> None:
    """Async main routine."""
    # 1. Load settings from environment and .env
    try:
        settings = get_settings()
    except Exception as exc:
        # Print directly to stderr if settings failed before logger initialization
        sys.stderr.write(f"FATAL: Configuration initialization failed: {exc}\n")
        sys.exit(1)

    # 2. Configure structured logging with token redacting
    setup_logging(
        log_level=settings.LOG_LEVEL,
        log_format=settings.LOG_FORMAT,
        token_to_mask=settings.SELFHEAL_AGENT_TOKEN.get_secret_value(),
    )

    logger.info("Starting SelfHeal Kubernetes Agent v%s...", settings.AGENT_VERSION)

    app = AgentApplication(settings=settings)
    loop = asyncio.get_running_loop()
    handle_signals(app, loop)

    await app.run()


def main() -> None:
    """Synchronous entrypoint for CLI execution."""
    try:
        asyncio.run(main_async())
    except KeyboardInterrupt:
        logger.info("Process interrupted by user (KeyboardInterrupt)")
    except Exception as exc:
        logger.critical("Fatal error encountered during agent execution: %s", exc, exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
