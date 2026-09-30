"""Structured Logging Module for SelfHeal Agent v0.1.

Provides JSON and console formatters with sensitive data masking to ensure
agent authentication tokens are NEVER leaked in logs or monitoring streams.
"""

from datetime import datetime, timezone
import json
import logging
import re
import sys
from typing import Any, Dict, Optional

# Regex pattern to catch potential bearer tokens or token strings in raw log text
_TOKEN_PATTERNS = [
    re.compile(r"(Bearer\s+)[A-Za-z0-9_\-\.]{8,}", re.IGNORECASE),
    re.compile(r"('token':\s*')[^']+(\')", re.IGNORECASE),
    re.compile(r'("token":\s*")[^"]+(")', re.IGNORECASE),
    re.compile(r"('SELFHEAL_AGENT_TOKEN':\s*')[^']+(\')", re.IGNORECASE),
    re.compile(r'("SELFHEAL_AGENT_TOKEN":\s*")[^"]+(")', re.IGNORECASE),
]


class SensitiveDataMaskFilter(logging.Filter):
    """Logging filter that redacts sensitive tokens and secrets from all log records."""

    def __init__(self, token_to_mask: Optional[str] = None):
        super().__init__()
        self.exact_token = token_to_mask.strip() if token_to_mask else None

    def filter(self, record: logging.LogRecord) -> bool:
        if isinstance(record.msg, str):
            record.msg = self._sanitize_text(record.msg)

        # Sanitize arguments if any
        if record.args:
            if isinstance(record.args, dict):
                record.args = {k: self._sanitize_val(v) for k, v in record.args.items()}
            elif isinstance(record.args, tuple):
                record.args = tuple(self._sanitize_val(v) for v in record.args)

        return True

    def _sanitize_val(self, val: Any) -> Any:
        if isinstance(val, str):
            return self._sanitize_text(val)
        return val

    def _sanitize_text(self, text: str) -> str:
        if not text:
            return text

        # Exact match mask if token was provided
        if self.exact_token and len(self.exact_token) > 3 and self.exact_token in text:
            text = text.replace(self.exact_token, "***REDACTED_AGENT_TOKEN***")

        # Regex heuristic mask
        for pattern in _TOKEN_PATTERNS:
            text = pattern.sub(r"\g<1>***REDACTED***\g<2>", text) if "\\g<2>" in pattern.pattern else pattern.sub(r"\g<1>***REDACTED***", text)

        return text


class JsonLogFormatter(logging.Formatter):
    """Format logs as structured JSON strings suitable for CloudWatch / Grafana / ELK."""

    def format(self, record: logging.LogRecord) -> str:
        log_entry: Dict[str, Any] = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "func": record.funcName,
            "line": record.lineno,
        }

        # Include exception information if available
        if record.exc_info:
            log_entry["exception"] = self.formatException(record.exc_info)

        # Include custom extra fields if attached to record
        if hasattr(record, "extra_fields") and isinstance(record.extra_fields, dict):
            log_entry["context"] = record.extra_fields

        return json.dumps(log_entry, default=str)


class TextLogFormatter(logging.Formatter):
    """Human-readable log formatter for local development console."""

    def format(self, record: logging.LogRecord) -> str:
        record_time = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        base = f"[{record_time}] [{record.levelname:<7}] [{record.name}] {record.getMessage()}"
        if record.exc_info:
            base += "\n" + self.formatException(record.exc_info)
        return base


def setup_logging(
    log_level: str = "INFO",
    log_format: str = "json",
    token_to_mask: Optional[str] = None,
) -> None:
    """Initialize structured logging for SelfHeal Agent."""
    root_logger = logging.getLogger()
    numeric_level = getattr(logging, log_level.upper(), logging.INFO)
    root_logger.setLevel(numeric_level)

    # Remove existing handlers to avoid duplicates
    for handler in list(root_logger.handlers):
        root_logger.removeHandler(handler)

    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(numeric_level)

    # Choose formatter
    if log_format.lower() == "text":
        formatter = TextLogFormatter()
    else:
        formatter = JsonLogFormatter()

    console_handler.setFormatter(formatter)

    # Attach secret masking filter
    mask_filter = SensitiveDataMaskFilter(token_to_mask=token_to_mask)
    console_handler.addFilter(mask_filter)

    root_logger.addHandler(console_handler)

    # Suppress verbose noisy 3rd party loggers by default
    logging.getLogger("urllib3").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)


def get_logger(name: str) -> logging.Logger:
    """Return a configured logger instance with the given name."""
    return logging.getLogger(name)
