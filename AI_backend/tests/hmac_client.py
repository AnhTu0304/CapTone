from __future__ import annotations

import hashlib
import hmac
import json
import os
import time
import uuid
from typing import Any
from urllib.parse import urlsplit

from fastapi.testclient import TestClient

from app.core.config import get_settings


class SignedTestClient(TestClient):
    """TestClient subclass that attaches valid internal HMAC-SHA256 headers to /api/v1/* requests."""

    def request(self, method: str, url: Any, **kwargs: Any):
        path = urlsplit(str(url)).path
        headers = dict(kwargs.get("headers") or {})
        lowered = {k.lower() for k in headers}

        if path.startswith("/api/v1/") and "x-internal-signature" not in lowered:
            body_bytes = b""
            if "json" in kwargs and kwargs["json"] is not None:
                body_bytes = json.dumps(kwargs.pop("json"), separators=(",", ":")).encode("utf-8")
                kwargs["content"] = body_bytes
                if "content-type" not in lowered:
                    headers["Content-Type"] = "application/json"
            elif "content" in kwargs and kwargs["content"] is not None:
                raw = kwargs["content"]
                body_bytes = raw.encode("utf-8") if isinstance(raw, str) else bytes(raw)

            secret = os.getenv("AI_INTERNAL_HMAC_SECRET") or get_settings().internal_hmac_secret
            ts = str(int(time.time()))
            nonce = uuid.uuid4().hex
            body_sha256 = hashlib.sha256(body_bytes).hexdigest()
            canonical = f"{ts}\n{nonce}\n{method.upper()}\n{path}\n{body_sha256}".encode("utf-8")
            sig = hmac.new(secret.encode("utf-8"), canonical, hashlib.sha256).hexdigest()

            headers["X-Internal-Timestamp"] = ts
            headers["X-Internal-Nonce"] = nonce
            headers["X-Internal-Body-Sha256"] = body_sha256
            headers["X-Internal-Signature"] = sig
            kwargs["headers"] = headers

        return super().request(method, url, **kwargs)
