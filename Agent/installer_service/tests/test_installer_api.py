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
    assert "SelfHeal" in resp.text


def test_get_powershell_installer(client: TestClient) -> None:
    resp = client.get("/agent/install.ps1")
    assert resp.status_code == 200
    assert "text/plain" in resp.headers["content-type"]
    assert "attachment; filename=\"install-agent.ps1\"" in resp.headers.get("content-disposition", "")
    assert "SelfHeal" in resp.text
    assert "kubectl" in resp.text


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
