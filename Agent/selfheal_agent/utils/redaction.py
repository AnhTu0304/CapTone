"""Security redaction and masking utilities.

Ensures that secrets, tokens, and credentials are never emitted into logs
or exposed over plain text fields.
"""

import re
from typing import Pattern

REDACTION_PATTERNS: list[tuple[Pattern[str], str]] = [
    # Bearer tokens in headers or logs
    (re.compile(r"(Bearer\s+)[A-Za-z0-9\-._~+/]+=*", re.IGNORECASE), r"\1[REDACTED_TOKEN]"),
    # Database / Redis connection URIs with inline passwords
    (re.compile(r"((?:postgres|postgresql|redis|rediss)://[^:\s/@]*:)([^@\s/]+)(@)", re.IGNORECASE), r"\1[REDACTED]\3"),
    # Query string tokens/secrets
    (re.compile(r"([?&](?:token|access_token|refresh_token|code|secret|password|api_key)=)([^&\s\"']+)", re.IGNORECASE), r"\1[REDACTED]"),
    # Generic password / secret / api_key / token / totp assignment (preserve Bearer/already-redacted tags)
    (
        re.compile(
            r"""(?i)(["']?(?:password|passwd|pwd|secret|api_?key|token|auth_?token|refresh_token|access_token|client_?secret|totp_?secret|hmac_?secret|x-agent-token|authorization)["']?\s*[:=]\s*["']?)(?!Bearer\b|\[REDACTED)([^"',\s\}]{3,})""",
            re.IGNORECASE,
        ),
        r"\1[REDACTED]",
    ),
    # SelfHeal tokens: cap_...
    (re.compile(r"\bcap_[a-zA-Z0-9_-]{8,}\b"), "cap_[REDACTED]"),
    # JWT tokens
    (re.compile(r"\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]+\b"), "[REDACTED_JWT]"),
    # AWS / Generic Cloud Access Keys
    (re.compile(r"\b(AKIA|ABIA|ACCA)[0-9A-Z]{16}\b"), "[REDACTED_AWS_KEY]"),
    # Private Key blocks
    (
        re.compile(
            r"-----BEGIN (?:RSA|OPENSSH|DSA|EC)?\s*PRIVATE KEY-----[\s\S]*?-----END (?:RSA|OPENSSH|DSA|EC)?\s*PRIVATE KEY-----"
        ),
        "[REDACTED_PRIVATE_KEY]",
    ),
]


def redact_sensitive_data(text: str) -> str:
    """Sanitize text by removing or masking detected secrets."""
    if not text:
        return text

    sanitized = text
    for pattern, replacement in REDACTION_PATTERNS:
        sanitized = pattern.sub(replacement, sanitized)
    return sanitized


def mask_token(token: str) -> str:
    """Return a masked token suitable for log output without revealing content."""
    if not token:
        return "<none>"
    if len(token) <= 8:
        return "***"
    prefix = token[:4]
    suffix = token[-4:]
    return f"{prefix}***{suffix}"
