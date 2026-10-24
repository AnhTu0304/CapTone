"""Configuration management using Pydantic Settings."""

from typing import Optional
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class AgentConfig(BaseSettings):
    """Runtime configuration for SelfHeal Kubernetes Agent."""

    AGENT_SERVER_URL: str = Field(
        ...,
        description="SelfHeal Main Backend WebSocket URL (ws://... or wss://...)",
    )
    AGENT_HTTP_URL: Optional[str] = Field(
        default=None,
        description="Explicit Backend HTTP base URL (e.g. http://backend:5000). If omitted, derived from AGENT_SERVER_URL.",
    )
    AGENT_TOKEN: str = Field(
        ...,
        description="Pre-shared authentication token granted by SelfHeal",
    )
    AGENT_UID: str = Field(
        default="selfheal-agent-default",
        description="Unique identifier for this agent deployment",
    )
    CLUSTER_ID: Optional[str] = Field(
        default=None,
        description="Optional cluster identifier",
    )
    ENVIRONMENT_ID: Optional[str] = Field(
        default=None,
        description="Optional environment identifier",
    )
    HEARTBEAT_INTERVAL_SECONDS: float = Field(
        default=15.0,
        ge=1.0,
        description="Heartbeat transmission interval in seconds (default: 15s)",
    )
    HEARTBEAT_TIMEOUT_SECONDS: float = Field(
        default=5.0,
        ge=0.5,
        description="HTTP request timeout in seconds for heartbeat (default: 5s)",
    )
    HEARTBEAT_MAX_RETRIES: int = Field(
        default=3,
        ge=0,
        le=10,
        description="Maximum retry attempts per heartbeat cycle upon transient error",
    )
    HEARTBEAT_BACKOFF_FACTOR: float = Field(
        default=1.5,
        ge=1.0,
        le=5.0,
        description="Exponential backoff factor for heartbeat retries",
    )
    HEARTBEAT_MAX_BACKOFF_SECONDS: float = Field(
        default=10.0,
        ge=1.0,
        description="Maximum backoff wait time in seconds",
    )
    METRICS_INTERVAL_MS: int = Field(
        default=5000,
        ge=1000,
        description="Metrics collection interval in milliseconds",
    )
    LOG_COLLECTION_INTERVAL_MS: int = Field(
        default=5000,
        ge=1000,
        description="Log collection interval in milliseconds",
    )
    K8S_NAMESPACE: str = Field(
        default="default",
        description="Kubernetes namespace to monitor (if not monitoring all namespaces)",
    )
    MONITOR_ALL_NAMESPACES: bool = Field(
        default=True,
        description="Monitor all namespaces across the cluster",
    )
    PROMETHEUS_URL: Optional[str] = Field(
        default=None,
        description="Optional endpoint for Prometheus server (e.g. http://prometheus-k8s.monitoring.svc:9090)",
    )
    LOG_LEVEL: str = Field(
        default="INFO",
        description="Application logging level (DEBUG, INFO, WARNING, ERROR)",
    )
    KUBECONFIG_PATH: Optional[str] = Field(
        default=None,
        description="Explicit path to kubeconfig file (defaults to in-cluster or ~/.kube/config)",
    )
    ENABLE_HEALING_ACTIONS: bool = Field(
        default=False,
        description="Safeguard flag: must be explicitly true to permit automated healing actions",
    )
    HEALTH_PORT: int = Field(
        default=8080,
        ge=1024,
        le=65535,
        description="HTTP port for k8s liveness and readiness health probes",
    )
    QUEUE_MAX_SIZE: int = Field(
        default=500,
        ge=1,
        description="Maximum buffer size for telemetry queue when disconnected",
    )

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    @field_validator("AGENT_SERVER_URL")
    @classmethod
    def validate_ws_url(cls, v: str) -> str:
        trimmed = v.strip()
        if not (trimmed.startswith("ws://") or trimmed.startswith("wss://")):
            raise ValueError("AGENT_SERVER_URL must start with 'ws://' or 'wss://'")
        return trimmed

    @field_validator("AGENT_TOKEN")
    @classmethod
    def validate_agent_token(cls, v: str) -> str:
        trimmed = v.strip()
        if not trimmed:
            raise ValueError("AGENT_TOKEN cannot be empty")
        return trimmed

    @field_validator("LOG_LEVEL")
    @classmethod
    def validate_log_level(cls, v: str) -> str:
        upper = v.upper()
        if upper not in {"DEBUG", "INFO", "WARNING", "WARN", "ERROR", "CRITICAL"}:
            raise ValueError(f"Unsupported LOG_LEVEL: {v}")
        return "WARNING" if upper == "WARN" else upper


_cached_config: Optional[AgentConfig] = None


def load_config(env_overrides: Optional[dict[str, str]] = None) -> AgentConfig:
    """Load configuration from environment variables or custom overrides."""
    global _cached_config
    if _cached_config is not None and env_overrides is None:
        return _cached_config

    if env_overrides is not None:
        cfg = AgentConfig(**env_overrides)
    else:
        cfg = AgentConfig()

    if env_overrides is None:
        _cached_config = cfg
    return cfg
