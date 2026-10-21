"""Configuration for SelfHeal FastAPI Installer API Service."""

from pathlib import Path
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class InstallerConfig(BaseSettings):
    """Runtime settings for the Installer API Service."""

    PORT: int = Field(default=8100, ge=1024, le=65535, description="HTTP listening port")
    HOST: str = Field(default="0.0.0.0", description="Host interface binding")
    APP_ENV: str = Field(default="production", description="Environment mode")
    AGENT_VERSION: str = Field(default="1.0.0", description="Current release version of SelfHeal Agent")
    CHART_VERSION: str = Field(default="1.0.0", description="Current Helm chart version")
    DOCKER_IMAGE: str = Field(
        default="ghcr.io/selfheal-ai/selfheal-agent:1.0.0",
        description="Public registry image reference for the agent",
    )
    BACKEND_WS_URL: str = Field(
        default="",
        description="Public WebSocket URL for SelfHeal Main Backend (e.g. wss://app.selfheal.vn/api/v1/agent/connect)",
    )
    INSTALLERS_DIR: Path = Field(
        default_factory=lambda: Path(__file__).resolve().parent / "installers",
        description="Path to directory containing installation scripts",
    )

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )


settings = InstallerConfig()
