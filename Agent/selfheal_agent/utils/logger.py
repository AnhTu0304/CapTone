"""Structured logger setup for SelfHeal Agent."""

import logging
import sys

from selfheal_agent.utils.redaction import redact_sensitive_data


class SensitiveDataLogFilter(logging.Filter):
    """Automatically redact credentials and tokens emitted to Agent logs."""

    def filter(self, record: logging.LogRecord) -> bool:
        try:
            rendered = record.getMessage()
            redacted = redact_sensitive_data(rendered)
            if redacted != rendered:
                record.msg = redacted
                record.args = ()
        except Exception:
            pass
        if record.exc_text:
            record.exc_text = redact_sensitive_data(record.exc_text)
        return True


def setup_logger(level_name: str = "INFO") -> logging.Logger:
    """Configure and return root logger with uniform formatting and automatic secret redaction."""
    level = getattr(logging, level_name.upper(), logging.INFO)
    logger = logging.getLogger("selfheal_agent")
    logger.setLevel(level)

    # Avoid duplicate handlers on re-initialization
    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        handler.setLevel(level)
        formatter = logging.Formatter(
            fmt="%(asctime)s [%(levelname)s] [%(name)s]: %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )
        handler.setFormatter(formatter)
        handler.addFilter(SensitiveDataLogFilter())
        logger.addHandler(handler)

    return logger
