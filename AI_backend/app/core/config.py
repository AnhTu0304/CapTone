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


def _optional_probability(name: str) -> float | None:
    raw = os.getenv(name)
    if raw is None or not raw.strip():
        return None
    value = float(raw)
    if not 0.0 <= value <= 1.0:
        raise ValueError(f"{name} must be between 0 and 1")
    return value


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    model_path = Path(os.getenv("GRU_MODEL_PATH", str(PROJECT_ROOT / "saved_models" / "gru_model_8feature.pth")))
    return Settings(
        app_name=os.getenv("APP_NAME", "AI-Driven Self-Healing Backend"),
        app_version="2.0.0",
        environment=os.getenv("APP_ENV", "development"),
        log_level=os.getenv("LOG_LEVEL", "INFO").upper(),
        model_path=model_path,
        risk_threshold=_optional_probability("GRU_RISK_THRESHOLD"),
        openai_api_key=os.getenv("OPENAI_API_KEY") or None,
        openai_model=os.getenv("OPENAI_MODEL", "gpt-5-mini"),
        openai_timeout_seconds=float(os.getenv("OPENAI_TIMEOUT_SECONDS", "30")),
    )
