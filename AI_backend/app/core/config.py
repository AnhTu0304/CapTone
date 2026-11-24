from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[2]


@dataclass(frozen=True)
class Settings:
    app_name: str
    app_version: str
    environment: str
    log_level: str
    model_path: Path
    risk_threshold: float | None
    openai_api_key: str | None
    openai_model: str
    openai_timeout_seconds: float
    internal_hmac_secret: str
    max_model_upload_bytes: int


def _optional_probability(name: str) -> float | None:
    raw = os.getenv(name)
    if raw is None or not raw.strip():
        return None
    value = float(raw)
    if not 0.0 <= value <= 1.0:
        raise ValueError(f"{name} must be between 0 and 1")
    return value


def _resolve_internal_hmac_secret(environment: str) -> str:
    secret = os.getenv("AI_INTERNAL_HMAC_SECRET", "").strip()
    if environment.lower() == "production":
        if len(secret) < 32:
            raise ValueError("FATAL SECURITY ERROR: AI_INTERNAL_HMAC_SECRET must be set (>= 32 chars) in production")
        return secret
    return secret or "dev_only_ai_internal_hmac_secret_32_characters_long"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    environment = os.getenv("APP_ENV", "development")
    model_path = Path(os.getenv("GRU_MODEL_PATH", str(PROJECT_ROOT / "saved_models" / "gru_model_8feature.pth")))
    return Settings(
        app_name=os.getenv("APP_NAME", "AI-Driven Self-Healing Backend"),
        app_version="2.0.0",
        environment=environment,
        log_level=os.getenv("LOG_LEVEL", "INFO").upper(),
        model_path=model_path,
        risk_threshold=_optional_probability("GRU_RISK_THRESHOLD"),
        openai_api_key=os.getenv("OPENAI_API_KEY") or None,
        openai_model=os.getenv("OPENAI_MODEL", "gpt-5-mini"),
        openai_timeout_seconds=float(os.getenv("OPENAI_TIMEOUT_SECONDS", "30")),
        internal_hmac_secret=_resolve_internal_hmac_secret(environment),
        max_model_upload_bytes=int(os.getenv("MAX_MODEL_UPLOAD_BYTES", str(100 * 1024 * 1024))),
    )
