"""Unit tests for FastAPI Installer Service endpoints and security validations."""

import pytest
from fastapi.testclient import TestClient

from installer_service.main import app
from installer_service.routers.installer import safe_resolve_script


@pytest.fixture
def client():
    return TestClient(app)


def test_health_probe(client: TestClient) -> None:
    resp = client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "healthy"
    assert data["service"] == "selfheal-installer-api"


def test_get_bash_installer(client: TestClient) -> None:
    resp = client.get("/agent/install.sh")
    assert resp.status_code == 200
    assert "text/x-shellscript" in resp.headers["content-type"]
    assert "attachment; filename=\"install-agent.sh\"" in resp.headers.get("content-disposition", "")
    assert "#!/usr/bin/env bash" in resp.text
    assert "${BASH_SOURCE[0]:-}" in resp.text
    assert "/dev/tty" in resp.text
    assert "cpu: 500m" in resp.text
    assert "SelfHeal" in resp.text


def test_get_powershell_installer(client: TestClient) -> None:
    resp = client.get("/agent/install.ps1")
    assert resp.status_code == 200
    assert "text/plain" in resp.headers["content-type"]
    assert "attachment; filename=\"install-agent.ps1\"" in resp.headers.get("content-disposition", "")
    # UTF-8 BOM (\ufeff) breaks PowerShell `irm ... | iex` and `[scriptblock]::Create(...)` when param() is present
    assert not resp.text.startswith("\ufeff")
    assert '$EnableHealing = "true"' in resp.text
    assert "cpu: 500m" in resp.text
    assert "SelfHeal" in resp.text
    assert "kubectl" in resp.text


def test_get_powershell_uninstaller_has_no_bom(client: TestClient) -> None:
    resp = client.get("/agent/uninstall.ps1")
    assert resp.status_code == 200
    assert not resp.text.startswith("\ufeff")
    assert "selfheal-agent" in resp.text


def test_installer_injects_wss_for_https_forwarded_proto(client: TestClient) -> None:
    headers = {"Host": "aisealhealing.io.vn", "X-Forwarded-Proto": "https"}
    ps_resp = client.get("/agent/install.ps1", headers=headers)
    sh_resp = client.get("/agent/install.sh", headers=headers)
    assert ps_resp.status_code == 200
    assert sh_resp.status_code == 200
    assert '$CONFIGURED_SERVER_URL = "wss://aisealhealing.io.vn/api/v1/agent/connect"' in ps_resp.text
    assert 'CONFIGURED_SERVER_URL="wss://aisealhealing.io.vn/api/v1/agent/connect"' in sh_resp.text


def test_get_k8s_manifests(client: TestClient) -> None:
    # 1. Dynamic install manifest with token
    resp = client.get("/agent/install.yaml?token=sh_tok_live_123456")
    assert resp.status_code == 200
    assert "application/yaml" in resp.headers["content-type"]
    assert "sh_tok_live_123456" in resp.text
    assert "kind: Deployment" in resp.text
    assert "name: selfheal-agent" in resp.text

    # 2. Standard static manifest
    resp_std = client.get("/agent/manifest.yaml")
    assert resp_std.status_code == 200
    assert "application/yaml" in resp_std.headers["content-type"]
    assert "kind: Deployment" in resp_std.text


def test_get_checksums(client: TestClient) -> None:
    resp = client.get("/agent/checksums")
    assert resp.status_code == 200
    data = resp.json()
    assert data["algorithm"] == "sha256"
    assert "checksums" in data
    assert "install-agent.sh" in data["checksums"]
    assert data["checksums"]["install-agent.sh"].startswith("sha256:")
    assert len(data["checksums"]["install-agent.sh"]) == 71  # "sha256:" (7) + 64 hex


def test_get_agent_info(client: TestClient) -> None:
    resp = client.get("/agent/info")
    assert resp.status_code == 200
    data = resp.json()
    assert data["service"] == "selfheal-installer-api"
    assert data["agent_version"] == "1.0.0"
    assert "/agent/install.sh" in data["endpoints"]["bash_installer"]


def test_path_traversal_prevention() -> None:
    from fastapi import HTTPException
    with pytest.raises(HTTPException) as exc:
        safe_resolve_script("../../etc/passwd")
    assert exc.value.status_code == 400

    with pytest.raises(HTTPException) as exc2:
        safe_resolve_script("..\\secret.env")
    assert exc2.value.status_code == 400


def test_nonexistent_script_returns_404() -> None:
    from fastapi import HTTPException
    with pytest.raises(HTTPException) as exc:
        safe_resolve_script("non-existent-script.sh")
    assert exc.value.status_code == 404
