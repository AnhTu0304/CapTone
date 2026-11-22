from __future__ import annotations

import hashlib
import hmac
import os
import re
import threading
import time
from typing import Any, Mapping

try:
    from fastapi import HTTPException, Request
except ImportError:  # pragma: no cover - host unit-test fallback when fastapi is not installed
    class HTTPException(Exception):  # type: ignore[no-redef]
        def __init__(self, status_code: int, detail: str):
            super().__init__(detail)
            self.status_code = status_code
            self.detail = detail

    Request = Any  # type: ignore[misc,assignment]

from app.core.config import get_settings

MAX_CLOCK_SKEW_SECONDS = 60
NONCE_TTL_SECONDS = 120
MAX_CACHED_NONCES = 10_000
_NONCE_PATTERN = re.compile(r"^[A-Za-z0-9_-]{16,128}$")
_SHA256_PATTERN = re.compile(r"^[a-f0-9]{64}$")

_NONCE_LOCK = threading.Lock()
_SEEN_NONCES: dict[str, float] = {}


def clear_nonce_cache() -> None:
    with _NONCE_LOCK:
        _SEEN_NONCES.clear()


def verify_hmac_signature(
    method: str,
    path: str,
    headers: Mapping[str, str],
    secret: str | None = None,
    now: float | None = None,
    body_bytes: bytes | None = None,
) -> str:
    """
    Verify HMAC-SHA256 internal service authentication with 60s clock window,
    request body SHA-256 binding, and atomic nonce replay protection.
    Returns verified expected body SHA-256 hex digest.
    Raises HTTPException(401/503) on invalid, missing, stale, or replayed credentials.
    """
    settings = get_settings()
    resolved_secret = secret if secret is not None else (os.getenv("AI_INTERNAL_HMAC_SECRET") or settings.internal_hmac_secret)
    if not resolved_secret:
        raise HTTPException(status_code=503, detail="Internal authentication is not configured")

    # Normalize header lookup case-insensitively
    lowered = {k.lower(): v for k, v in headers.items()}
    ts_raw = (lowered.get("x-internal-timestamp") or "").strip()
    nonce = (lowered.get("x-internal-nonce") or "").strip()
    body_sha256 = (lowered.get("x-internal-body-sha256") or "").strip().lower()
    sig = (lowered.get("x-internal-signature") or "").strip().lower()

    if not ts_raw or not nonce or not sig or not body_sha256:
        raise HTTPException(status_code=401, detail="Missing internal authentication headers")

    if not _NONCE_PATTERN.match(nonce):
        raise HTTPException(status_code=401, detail="Invalid internal authentication nonce")

    if not _SHA256_PATTERN.match(body_sha256):
        raise HTTPException(status_code=401, detail="Invalid internal body digest")

    try:
        ts = int(ts_raw)
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid internal authentication timestamp")

    current_ts = int(time.time() if now is None else now)
    if abs(current_ts - ts) > MAX_CLOCK_SKEW_SECONDS:
        raise HTTPException(status_code=401, detail="Expired or future internal authentication timestamp")

    canonical = f"{ts}\n{nonce}\n{method.upper()}\n{path}\n{body_sha256}".encode("utf-8")
    expected_sig = hmac.new(resolved_secret.encode("utf-8"), canonical, hashlib.sha256).hexdigest()

    if not hmac.compare_digest(expected_sig.lower(), sig):
        raise HTTPException(status_code=401, detail="Invalid internal authentication signature")

    if body_bytes is not None:
        actual_sha256 = hashlib.sha256(body_bytes).hexdigest()
        if not hmac.compare_digest(actual_sha256, body_sha256):
            raise HTTPException(status_code=401, detail="Request body digest mismatch")

    with _NONCE_LOCK:
        expired = [k for k, exp in _SEEN_NONCES.items() if exp <= current_ts]
        for k in expired:
            _SEEN_NONCES.pop(k, None)

        if nonce in _SEEN_NONCES:
            raise HTTPException(status_code=401, detail="Replayed internal authentication nonce")

        if len(_SEEN_NONCES) >= MAX_CACHED_NONCES:
            # Evict oldest entry to cap memory under burst traffic
            oldest_key = min(_SEEN_NONCES, key=_SEEN_NONCES.get)
            _SEEN_NONCES.pop(oldest_key, None)

        _SEEN_NONCES[nonce] = float(current_ts + NONCE_TTL_SECONDS)

    return body_sha256


async def require_internal_auth(request: Request) -> None:
    content_type = (request.headers.get("content-type") or "").lower()
    is_multipart = content_type.startswith("multipart/form-data")
    body_bytes = None if is_multipart else await request.body()
    expected_sha256 = verify_hmac_signature(
        method=request.method,
        path=request.url.path,
        headers=request.headers,
        body_bytes=body_bytes,
    )
    if is_multipart:
        request.state.expected_upload_sha256 = expected_sha256
