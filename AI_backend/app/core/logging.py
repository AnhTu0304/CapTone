import logging
import re

_REDACTION_PATTERNS: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"(Bearer\s+)[A-Za-z0-9\-._~+/]+=*", re.IGNORECASE), r"\1[REDACTED_TOKEN]"),
    (
        re.compile(r"((?:postgres|postgresql|redis|rediss)://[^:\s/@]*:)([^@\s/]+)(@)", re.IGNORECASE),
        r"\1[REDACTED]\3",
    ),
    (
        re.compile(r"([?&](?:token|access_token|refresh_token|code|secret|password|api_key)=)([^&\s\"']+)", re.IGNORECASE),
        r"\1[REDACTED]",
    ),
    (
        re.compile(
            r"""(?i)(["']?(?:password|passwd|secret|api_?key|token|authorization|x-internal-signature|x-agent-token|private_key)["']?\s*[:=]\s*["']?)(?!Bearer\b|\[REDACTED)([^"',\s\}\]]{3,})"""
        ),
        r"\1[REDACTED]",
    ),
    (re.compile(r"\bsk-[A-Za-z0-9_-]{12,}\b"), "sk-[REDACTED]"),
    (re.compile(r"\bcap_[A-Za-z0-9_-]{8,}\b"), "cap_[REDACTED]"),
    (re.compile(r"\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]+\b"), "[REDACTED_JWT]"),
    (
        re.compile(
            r"-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z0-9 ]*PRIVATE KEY-----"
        ),
        "[REDACTED_PRIVATE_KEY]",
    ),
]


def redact_sensitive_text(text: str) -> str:
    if not text or not isinstance(text, str):
        return text
    sanitized = text
    for pattern, replacement in _REDACTION_PATTERNS:
        sanitized = pattern.sub(replacement, sanitized)
    return sanitized


class SensitiveDataFilter(logging.Filter):
    """Automatically scrub credentials, tokens, and private keys from log records."""

    def filter(self, record: logging.LogRecord) -> bool:
        try:
            rendered = record.getMessage()
            redacted = redact_sensitive_text(rendered)
            if redacted != rendered:
                record.msg = redacted
                record.args = ()
        except Exception:
            pass
        if record.exc_info and record.exc_text:
            record.exc_text = redact_sensitive_text(record.exc_text)
        return True


def configure_logging(level: str) -> None:
    logging.basicConfig(
        level=getattr(logging, level, logging.INFO),
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
        force=True,
    )
    root_logger = logging.getLogger()
    redaction_filter = SensitiveDataFilter()
    for handler in root_logger.handlers:
        handler.addFilter(redaction_filter)
