"""Application Settings for SelfHeal Agent v0.1.

Loads and validates configuration from environment variables and .env file.
Protects sensitive data such as agent tokens using SecretStr.
"""

from functools import lru_cache
from typing import Optional
from pydantic import Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

from app.config.constants import (
    DEFAULT_AGENT_VERSION,
    DEFAULT_CONNECT_TIMEOUT,
    DEFAULT_HEARTBEAT_INTERVAL,
    DEFAULT_REQUEST_TIMEOUT,
    KubernetesMode,
)


class Settings(BaseSettings):
    """Configuration settings for SelfHeal Kubernetes Agent."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    # Backend Connection
    SELFHEAL_BACKEND_URL: str = Field(
        default="http://localhost:8000",
        description="Base URL of the SelfHeal Backend API",
    )

    # Authentication
    SELFHEAL_AGENT_ID: str = Field(
        ...,
        description="Unique identifier assigned to this Kubernetes Agent",
    )
    SELFHEAL_AGENT_TOKEN: SecretStr = Field(
        ...,
        description="Secret authentication token for the Agent. Protected by SecretStr.",
    )

    # Periodic Heartbeat
    SELFHEAL_HEARTBEAT_INTERVAL: int = Field(
        default=DEFAULT_HEARTBEAT_INTERVAL,
        gt=0,
        description="Interval in seconds between periodic heartbeat pulses",
    )

    # Kubernetes Cluster Mode
    SELFHEAL_KUBERNETES_MODE: KubernetesMode = Field(
        default=KubernetesMode.LOCAL,
        description="Kubernetes configuration mode: LOCAL or IN_CLUSTER",
    )

    # Optional custom kubeconfig path (used only when SELFHEAL_KUBERNETES_MODE is LOCAL)
    KUBECONFIG_PATH: Optional[str] = Field(
        default=None,
        description="Path to a custom kubeconfig file when running in LOCAL mode",
    )

    # Network Timeouts
    HTTP_CONNECT_TIMEOUT: float = Field(
        default=DEFAULT_CONNECT_TIMEOUT,
        gt=0.0,
        description="Connection timeout in seconds for backend requests",
    )
    HTTP_REQUEST_TIMEOUT: float = Field(
        default=DEFAULT_REQUEST_TIMEOUT,
        gt=0.0,
        description="Total read/request timeout in seconds for backend requests",
    )

    # Observability & Logging
    LOG_LEVEL: str = Field(
        default="INFO",
        description="Logging level: DEBUG, INFO, WARNING, ERROR, CRITICAL",
    )
    LOG_FORMAT: str = Field(
        default="json",
        description="Log output format: json or text",
    )

    # Versioning
    AGENT_VERSION: str = Field(
        default=DEFAULT_AGENT_VERSION,
        description="SelfHeal Agent Semantic Version",
    )

    @field_validator("SELFHEAL_BACKEND_URL")
    @classmethod
    def clean_backend_url(cls, v: str) -> str:
        """Strip trailing slash from backend URL for consistent endpoint path appending."""
        stripped = v.strip().rstrip("/")
        if not stripped:
            raise ValueError("SELFHEAL_BACKEND_URL cannot be empty")
        return stripped

    @field_validator("SELFHEAL_AGENT_ID")
    @classmethod
    def validate_agent_id(cls, v: str) -> str:
        """Validate agent ID is not empty or whitespace."""
        cleaned = v.strip()
        if not cleaned:
            raise ValueError("SELFHEAL_AGENT_ID cannot be empty")
        return cleaned

    @field_validator("LOG_LEVEL")
    @classmethod
    def normalize_log_level(cls, v: str) -> str:
        """Normalize log level string to uppercase."""
        return v.strip().upper()


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Singleton getter for application settings."""
    return Settings()
