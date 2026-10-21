"""Structured logger setup for SelfHeal Agent."""

import logging
import sys


def setup_logger(level_name: str = "INFO") -> logging.Logger:
    """Configure and return root logger with uniform formatting."""
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
        logger.addHandler(handler)

    return logger
