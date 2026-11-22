from __future__ import annotations

import hashlib
import hmac
import importlib.util
import io
import json
import math
import time
from concurrent.futures import ThreadPoolExecutor

import pytest
from pydantic import ValidationError

from app.core.config import _resolve_internal_hmac_secret, get_settings
from app.core.internal_auth import (
    HTTPException,
    clear_nonce_cache,
    verify_hmac_signature,
)
from app.schemas.metrics import MetricPoint
from app.schemas.prediction import GRUMetricPoint, PredictionRequest
from app.schemas.rca import RCARequest


SECRET = "test_sb02_hmac_secret_with_at_least_32_characters"


def _make_hmac_headers(
    method: str,
    path: str,
    *,
    body: bytes = b"",
    secret: str = SECRET,
    timestamp: int | None = None,
    nonce: str = "a1b2c3d4e5f60718293a4b5c6d7e8f90",
) -> dict[str, str]:
    ts = int(time.time()) if timestamp is None else timestamp
    body_sha256 = hashlib.sha256(body).hexdigest()
    canonical = f"{ts}\n{nonce}\n{method.upper()}\n{path}\n{body_sha256}".encode("utf-8")
    sig = hmac.new(secret.encode("utf-8"), canonical, hashlib.sha256).hexdigest()
    return {
        "X-Internal-Timestamp": str(ts),
        "X-Internal-Nonce": nonce,
        "X-Internal-Body-Sha256": body_sha256,
        "X-Internal-Signature": sig,
    }


def setup_function():
    clear_nonce_cache()


def test_sb02_01_valid_hmac_passes_and_replay_is_rejected():
    now = 1_700_000_000
    body = b'{"service_id":"checkout"}'
    headers = _make_hmac_headers(
        "POST",
        "/api/v1/predict",
        body=body,
        timestamp=now,
        nonce="nonce_valid_1234567890",
    )
    verify_hmac_signature("POST", "/api/v1/predict", headers, secret=SECRET, now=now, body_bytes=body)

    # Replaying same nonce must fail with 401
    with pytest.raises(HTTPException) as exc:
        verify_hmac_signature("POST", "/api/v1/predict", headers, secret=SECRET, now=now + 5, body_bytes=body)
    assert exc.value.status_code == 401


def test_sb02_02_missing_tampered_stale_hmac_headers_rejected():
    now = 1_700_000_000
    body = b'{"filename":"gru_model_8feature.pth"}'

    # Missing headers
    with pytest.raises(HTTPException) as exc:
        verify_hmac_signature("POST", "/api/v1/predict", {}, secret=SECRET, now=now, body_bytes=body)
    assert exc.value.status_code == 401

    # Expired (> 60s old) and future (> 60s ahead)
    stale_headers = _make_hmac_headers("POST", "/api/v1/predict", body=body, timestamp=now - 61, nonce="nonce_stale_1234567890")
    with pytest.raises(HTTPException) as exc:
        verify_hmac_signature("POST", "/api/v1/predict", stale_headers, secret=SECRET, now=now, body_bytes=body)
    assert exc.value.status_code == 401

    future_headers = _make_hmac_headers("POST", "/api/v1/predict", body=body, timestamp=now + 61, nonce="nonce_future_123456789")
    with pytest.raises(HTTPException) as exc:
        verify_hmac_signature("POST", "/api/v1/predict", future_headers, secret=SECRET, now=now, body_bytes=body)
    assert exc.value.status_code == 401

    # Wrong path binding
    headers = _make_hmac_headers("POST", "/api/v1/predict", body=body, timestamp=now, nonce="nonce_path_12345678901")
    with pytest.raises(HTTPException) as exc:
        verify_hmac_signature("POST", "/api/v1/model/switch", headers, secret=SECRET, now=now, body_bytes=body)
    assert exc.value.status_code == 401

    # Wrong method binding
    with pytest.raises(HTTPException) as exc:
        verify_hmac_signature("GET", "/api/v1/predict", headers, secret=SECRET, now=now, body_bytes=body)
    assert exc.value.status_code == 401

    # Body tampering rejected
    tamper_headers = _make_hmac_headers("POST", "/api/v1/predict", body=body, timestamp=now, nonce="nonce_body_12345678901")
    with pytest.raises(HTTPException) as exc:
        verify_hmac_signature("POST", "/api/v1/predict", tamper_headers, secret=SECRET, now=now, body_bytes=b'{"tampered":true}')
    assert exc.value.status_code == 401

    # Invalid signature
    bad_sig = dict(headers)
    bad_sig["X-Internal-Signature"] = "0" * 64
    with pytest.raises(HTTPException) as exc:
        verify_hmac_signature("POST", "/api/v1/predict", bad_sig, secret=SECRET, now=now, body_bytes=body)
    assert exc.value.status_code == 401

    # Missing secret fails closed (503)
    with pytest.raises(HTTPException) as exc:
        verify_hmac_signature("POST", "/api/v1/predict", headers, secret="", now=now, body_bytes=body)
    assert exc.value.status_code == 503


def test_sb02_02b_concurrent_nonce_replay_allows_only_one():
    now = 1_700_000_000
    body = b'{"concurrent":true}'
    headers = _make_hmac_headers("POST", "/api/v1/predict", body=body, timestamp=now, nonce="nonce_concurrent_12345")

    def attempt(_i: int) -> int:
        try:
            verify_hmac_signature("POST", "/api/v1/predict", headers, secret=SECRET, now=now, body_bytes=body)
            return 200
        except HTTPException as exc:
            return exc.status_code

    with ThreadPoolExecutor(max_workers=8) as pool:
        results = list(pool.map(attempt, range(8)))

    assert results.count(200) == 1
    assert results.count(401) == 7


def test_sb02_03_production_requires_strong_hmac_secret(monkeypatch):
    monkeypatch.delenv("AI_INTERNAL_HMAC_SECRET", raising=False)
    with pytest.raises(ValueError):
        _resolve_internal_hmac_secret("production")

    monkeypatch.setenv("AI_INTERNAL_HMAC_SECRET", "too-short")
    with pytest.raises(ValueError):
        _resolve_internal_hmac_secret("production")

    monkeypatch.setenv("AI_INTERNAL_HMAC_SECRET", SECRET)
    assert _resolve_internal_hmac_secret("production") == SECRET


def test_sb02_04_pydantic_bounds_reject_nan_inf_and_out_of_range():
    valid_point = {
        "cpu": 50.0,
        "ram": 60.0,
        "disk": 40.0,
        "request_rate": 120.0,
        "latency": 45.0,
        "http_5xx_rate": 1.0,
        "pod_restart_count": 0,
        "replica_count": 2,
    }
    assert GRUMetricPoint(**valid_point).cpu == 50.0
    assert MetricPoint(**valid_point).http_5xx_rate == 1.0

    for bad_field, bad_val in [
        ("cpu", 101.0),
        ("ram", 200.0),
        ("disk", -0.1),
        ("http_5xx_rate", 150.0),
        ("cpu", float("nan")),
        ("latency", float("inf")),
        ("request_rate", math.nan),
        ("pod_restart_count", 200_000),
        ("replica_count", 0),
    ]:
        bad_payload = dict(valid_point)
        bad_payload[bad_field] = bad_val
        with pytest.raises(ValidationError):
            GRUMetricPoint(**bad_payload)

    # Oversized RCARequest string field rejected
    with pytest.raises(ValidationError):
        RCARequest(
            service_id="payment-service",
            cluster_id="x" * 201,
            metrics=MetricPoint(**valid_point),
        )

    # Normal 12-step PredictionRequest succeeds
    req = PredictionRequest(service_id="payment-service", sequence=[GRUMetricPoint(**valid_point) for _ in range(12)])
    assert len(req.sequence) == 12


@pytest.mark.skipif(
    importlib.util.find_spec("fastapi") is None or importlib.util.find_spec("torch") is None,
    reason="fastapi/torch not installed in host Python environment",
)
def test_sb02_05_fastapi_endpoints_upload_and_path_traversal_and_gru_bounds(monkeypatch):
    from fastapi.testclient import TestClient
    from app.api.model_management import SAVED_MODELS_DIR, resolve_model_path, sanitize_model_filename
    from app.main import app
    from app.models.gru import ModelConfig, validate_model_config

    monkeypatch.setenv("AI_INTERNAL_HMAC_SECRET", SECRET)

    # Filename / path traversal checks
    assert sanitize_model_filename("model_v1.pth") == "model_v1.pth"
    for bad in ["../evil.pth", "/etc/passwd", "evil.exe", "a\\b.pth", "", "%2e%2e/evil.pth"]:
        if ".." in bad or "/" in bad or "\\" in bad or bad.endswith(".exe") or bad == "":
            with pytest.raises(Exception):
                sanitize_model_filename(bad)
    for bad_path in ["/etc/passwd.pth", "../outside.pth", "/tmp/evil.pt", "sub/%2e%2e/evil.pth"]:
        with pytest.raises(Exception):
            resolve_model_path(None, bad_path)

    # Symlink escape check inside SAVED_MODELS_DIR (best effort if OS permits symlink)
    sym_path = SAVED_MODELS_DIR / "_test_sym_escape.pth"
    sym_created = False
    try:
        sym_path.symlink_to("/etc/passwd")
        sym_created = True
    except OSError:
        sym_created = False
    if sym_created:
        try:
            with pytest.raises(Exception):
                resolve_model_path("_test_sym_escape.pth", None)
        finally:
            sym_path.unlink(missing_ok=True)

    # GRU hyperparameter bounds
    validate_model_config(ModelConfig())
    with pytest.raises(ValueError):
        validate_model_config(ModelConfig(hidden_size=999_999))
    with pytest.raises(ValueError):
        validate_model_config(ModelConfig(num_layers=64))

    with TestClient(app) as client:
        assert client.get("/health").status_code == 200
        assert client.post("/api/v1/predict", json={}).status_code == 401
        assert client.post("/api/v1/model/switch", json={"filename": "gru_model_8feature.pth"}).status_code == 401

        # Signed switch with tampered body must fail with 401
        raw_switch = json.dumps({"filename": "gru_model_8feature.pth"}).encode("utf-8")
        hdrs = _make_hmac_headers("POST", "/api/v1/model/switch", body=raw_switch, nonce="nonce_http_switch_00001")
        hdrs["Content-Type"] = "application/json"
        assert (
            client.post(
                "/api/v1/model/switch",
                content=b'{"filename":"other_model.pth"}',
                headers=hdrs,
            ).status_code
            == 401
        )

        # Signed switch with authentic body succeeds
        hdrs_ok = _make_hmac_headers("POST", "/api/v1/model/switch", body=raw_switch, nonce="nonce_http_switch_00002")
        hdrs_ok["Content-Type"] = "application/json"
        res_ok = client.post("/api/v1/model/switch", content=raw_switch, headers=hdrs_ok)
        assert res_ok.status_code == 200

        # Empty upload (0 bytes) rejected with 400 and never leaves 0-byte file
        before_files = set(p.name for p in SAVED_MODELS_DIR.iterdir())
        empty_hdrs = _make_hmac_headers("POST", "/api/v1/model/upload", body=b"", nonce="nonce_http_empty_000001")
        res_empty = client.post(
            "/api/v1/model/upload",
            files={"file": ("empty_model.pth", io.BytesIO(b""), "application/octet-stream")},
            headers=empty_hdrs,
        )
        assert res_empty.status_code == 400
        after_files = set(p.name for p in SAVED_MODELS_DIR.iterdir())
        assert before_files == after_files

        # Oversized upload rejected with 413 during streaming (not persisted)
        monkeypatch.setenv("MAX_MODEL_UPLOAD_BYTES", "128")
        get_settings.cache_clear()
        try:
            big_bytes = b"A" * 2048
            big_hdrs = _make_hmac_headers("POST", "/api/v1/model/upload", body=big_bytes, nonce="nonce_http_big_00000001")
            res_big = client.post(
                "/api/v1/model/upload",
                files={"file": ("oversized.pth", io.BytesIO(big_bytes), "application/octet-stream")},
                headers=big_hdrs,
            )
            assert res_big.status_code == 413
            assert set(p.name for p in SAVED_MODELS_DIR.iterdir()) == before_files
        finally:
            monkeypatch.delenv("MAX_MODEL_UPLOAD_BYTES", raising=False)
            get_settings.cache_clear()

        # Invalid extension rejected cleanly
        bad_ext_hdrs = _make_hmac_headers("POST", "/api/v1/model/upload", body=b"abc", nonce="nonce_http_ext_00000001")
        res_ext = client.post(
            "/api/v1/model/upload",
            files={"file": ("malware.exe", io.BytesIO(b"abc"), "application/octet-stream")},
            headers=bad_ext_hdrs,
        )
        assert res_ext.status_code == 400

        # Valid .pt upload + concurrent upload & switch + invalid GRU checkpoint rejection
        import torch
        from app.models.gru import MultiHeadGRU

        valid_ckpt = {
            "model_state_dict": MultiHeadGRU(ModelConfig(num_risks=7)).state_dict(),
            "model_config": {"input_size": 8, "hidden_size": 96, "num_layers": 2, "dropout": 0.2, "shared_size": 64, "num_risks": 7},
            "feature_names": ["cpu", "ram", "disk", "request_rate", "latency", "http_5xx_rate", "pod_restart_count", "replica_count"],
            "risk_names": ["cpu_overload", "oom", "disk_full", "high_latency", "http_5xx_spike", "traffic_overload", "scale_down_candidate"],
            "scaler_mean": [0.0] * 8,
            "scaler_std": [1.0] * 8,
            "sequence_length": 12,
            "risk_threshold": 0.79,
        }
        buf_valid = io.BytesIO()
        torch.save(valid_ckpt, buf_valid)
        valid_bytes = buf_valid.getvalue()

        crafted_ckpt = dict(valid_ckpt)
        crafted_ckpt["model_config"] = {"input_size": 8, "hidden_size": 99999, "num_layers": 2, "dropout": 0.2, "shared_size": 64, "num_risks": 7}
        buf_crafted = io.BytesIO()
        torch.save(crafted_ckpt, buf_crafted)
        crafted_bytes = buf_crafted.getvalue()

        created_files = []
        try:
            up_hdrs = _make_hmac_headers("POST", "/api/v1/model/upload", body=valid_bytes, nonce="nonce_valid_pt_00000001")
            res_up = client.post(
                "/api/v1/model/upload",
                files={"file": ("valid_test.pt", io.BytesIO(valid_bytes), "application/octet-stream")},
                headers=up_hdrs,
            )
            assert res_up.status_code == 200
            up_data = res_up.json()
            assert up_data["filename"].endswith("_valid_test.pt")
            assert "/" not in up_data["file_path"]
            created_files.append(up_data["filename"])

            # Concurrent switch & upload of crafted oversized-GRU checkpoint (must not crash or corrupt active model)
            def do_upload(idx: int):
                hdr = _make_hmac_headers("POST", "/api/v1/model/upload", body=crafted_bytes, nonce=f"nonce_conc_up_{idx:08d}")
                return client.post(
                    "/api/v1/model/upload",
                    files={"file": (f"crafted_{idx}.pth", io.BytesIO(crafted_bytes), "application/octet-stream")},
                    headers=hdr,
                )

            def do_switch(idx: int):
                b = json.dumps({"filename": up_data["filename"]}).encode("utf-8")
                hdr = _make_hmac_headers("POST", "/api/v1/model/switch", body=b, nonce=f"nonce_conc_sw_{idx:08d}")
                hdr["Content-Type"] = "application/json"
                return client.post("/api/v1/model/switch", content=b, headers=hdr)

            with ThreadPoolExecutor(max_workers=4) as pool:
                up_futs = [pool.submit(do_upload, i) for i in range(2)]
                sw_futs = [pool.submit(do_switch, i) for i in range(2)]
                for f in up_futs:
                    r = f.result()
                    assert r.status_code == 200
                    rj = r.json()
                    if rj.get("filename"):
                        created_files.append(rj["filename"])
                    assert rj["metrics"]["evaluated"] is False
                    assert "/" not in str(rj["metrics"].get("error", ""))
                for f in sw_futs:
                    assert f.result().status_code == 200

            # Active model still healthy & serves predict
            pred_body = json.dumps({
                "service_id": "checkout",
                "sequence": [{
                    "cpu": 50.0, "ram": 60.0, "disk": 40.0, "request_rate": 120.0,
                    "latency": 45.0, "http_5xx_rate": 1.0, "pod_restart_count": 0, "replica_count": 2,
                }] * 12,
            }).encode("utf-8")
            pred_hdr = _make_hmac_headers("POST", "/api/v1/predict", body=pred_body, nonce="nonce_after_conc_00001")
            pred_hdr["Content-Type"] = "application/json"
            assert client.post("/api/v1/predict", content=pred_body, headers=pred_hdr).status_code == 200
        finally:
            for fname in created_files:
                (SAVED_MODELS_DIR / fname).unlink(missing_ok=True)


def test_phase3_ai_service_log_redaction():
    import io
    import logging
    from app.core.logging import SensitiveDataFilter

    stream = io.StringIO()
    handler = logging.StreamHandler(stream)
    handler.addFilter(SensitiveDataFilter())
    test_logger = logging.getLogger("phase3_ai_redaction_probe")
    test_logger.handlers = [handler]
    test_logger.setLevel(logging.INFO)
    test_logger.propagate = False

    fake_jwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1MSIsInRvbCI6MX0.signaturepart123"
    test_logger.info(
        "Auth Authorization=Bearer %s openai_key=sk-test1234567890abcdef postgres://selfheal_app:SuperSecretDbPw@postgres:5432/captone_db?token=rawQuerySecret",
        fake_jwt,
    )

    output = stream.getvalue()
    assert fake_jwt not in output
    assert "sk-test1234567890abcdef" not in output
    assert "SuperSecretDbPw" not in output
    assert "rawQuerySecret" not in output
    assert "[REDACTED]" in output or "[REDACTED_TOKEN]" in output

