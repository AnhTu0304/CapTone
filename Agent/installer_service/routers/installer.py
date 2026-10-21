"""Router providing secure endpoints for SelfHeal Agent installer distribution."""

import hashlib
import logging
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException, Request, Response, status
from fastapi.responses import FileResponse

from installer_service.config import settings

logger = logging.getLogger("selfheal.installer_router")
router = APIRouter(prefix="/agent", tags=["Installer Distribution"])


def safe_resolve_script(filename: str) -> Path:
    """Validate filename against path traversal and verify existence."""
    # Strict validation: prevent path separators
    if "/" in filename or "\\" in filename or ".." in filename:
        logger.warning("Path traversal attempt blocked: %r", filename)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid filename specified",
        )

    base_dir = settings.INSTALLERS_DIR.resolve()
    target = (base_dir / filename).resolve()

    # Ensure target path stays strictly inside base_dir
    try:
        target.relative_to(base_dir)
    except ValueError:
        logger.warning("Escape attempt outside directory: %r", filename)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied",
        )

    if not target.is_file():
        logger.info("Requested installer file not found: %s", target)
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Installer script '{filename}' not found",
        )

    return target


def calculate_sha256(file_path: Path) -> str:
    """Compute standard SHA-256 hash for a file."""
    sha256 = hashlib.sha256()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            sha256.update(chunk)
    return sha256.hexdigest()


def resolve_backend_url(request: Request) -> str:
    """Determine the WebSocket backend URL based on config or request headers.

    Priority:
    1. Explicit BACKEND_WS_URL from environment / settings.
    2. Derived from incoming request's Host / X-Forwarded-Host header if it's a VPS / public domain.
    3. Empty string (falls back to client-side local cluster discovery).
    """
    if settings.BACKEND_WS_URL and settings.BACKEND_WS_URL.strip():
        return settings.BACKEND_WS_URL.strip()

    forwarded_host = request.headers.get("x-forwarded-host") or request.headers.get("host", "")
    proto = request.headers.get("x-forwarded-proto") or request.url.scheme
    ws_proto = "wss" if proto == "https" else "ws"

    # If accessed via a real domain or public IP on VPS (not localhost/127.0.0.1)
    clean_host = forwarded_host.split(":")[0].strip().lower()
    if clean_host and clean_host not in ["localhost", "127.0.0.1", "0.0.0.0", "host.docker.internal"]:
        return f"{ws_proto}://{forwarded_host}/api/v1/agent/connect"

    return ""


@router.get("/install.sh", summary="Download Linux/macOS Bash Installer")
async def get_bash_installer(request: Request):
    """Returns the official SelfHeal Agent Bash installation script for Linux and macOS."""
    file_path = safe_resolve_script("install-agent.sh")
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    ws_url = resolve_backend_url(request)
    if ws_url:
        content = content.replace('CONFIGURED_SERVER_URL="__SELFHEAL_BACKEND_URL__"', f'CONFIGURED_SERVER_URL="{ws_url}"')

    return Response(
        content=content,
        media_type="text/x-shellscript; charset=utf-8",
        headers={
            "Content-Disposition": 'attachment; filename="install-agent.sh"',
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "X-Content-Type-Options": "nosniff",
        },
    )


@router.get("/install.ps1", summary="Download Windows PowerShell Installer")
async def get_powershell_installer(request: Request):
    """Returns the official SelfHeal Agent PowerShell installation script for Windows."""
    file_path = safe_resolve_script("install-agent.ps1")
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    ws_url = resolve_backend_url(request)
    if ws_url:
        content = content.replace('$CONFIGURED_SERVER_URL = "__SELFHEAL_BACKEND_URL__"', f'$CONFIGURED_SERVER_URL = "{ws_url}"')

    return Response(
        content=content,
        media_type="text/plain; charset=utf-8",
        headers={
            "Content-Disposition": 'attachment; filename="install-agent.ps1"',
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "X-Content-Type-Options": "nosniff",
        },
    )


@router.get("/uninstall.sh", summary="Download Linux/macOS Bash Uninstaller")
async def get_bash_uninstaller():
    """Returns the clean removal script for SelfHeal Agent on Linux and macOS."""
    file_path = safe_resolve_script("uninstall-agent.sh")
    return FileResponse(
        path=file_path,
        media_type="text/x-shellscript",
        filename="uninstall-agent.sh",
        headers={"Cache-Control": "no-cache"},
    )


@router.get("/uninstall.ps1", summary="Download Windows PowerShell Uninstaller")
async def get_powershell_uninstaller():
    """Returns the clean removal script for SelfHeal Agent on Windows."""
    file_path = safe_resolve_script("uninstall-agent.ps1")
    return FileResponse(
        path=file_path,
        media_type="text/plain",
        filename="uninstall-agent.ps1",
        headers={"Cache-Control": "no-cache"},
    )


@router.get("/checksums", summary="Get SHA-256 Checksums for Integrity Verification")
async def get_installer_checksums() -> dict[str, Any]:
    """Provides cryptographic SHA-256 hashes of all published installer scripts."""
    base_dir = settings.INSTALLERS_DIR.resolve()
    checksums = {}

    scripts = [
        "install-agent.sh",
        "install-agent.ps1",
        "uninstall-agent.sh",
        "uninstall-agent.ps1",
    ]

    for script in scripts:
        target = base_dir / script
        if target.is_file():
            checksums[script] = f"sha256:{calculate_sha256(target)}"

    return {
        "version": settings.AGENT_VERSION,
        "algorithm": "sha256",
        "checksums": checksums,
    }


@router.get("/info", summary="Agent Release Metadata & Distribution Info")
async def get_agent_distribution_info() -> dict[str, Any]:
    """Provides release metadata for customer Kubernetes cluster administrators."""
    return {
        "service": "selfheal-installer-api",
        "agent_version": settings.AGENT_VERSION,
        "chart_version": settings.CHART_VERSION,
        "docker_image": settings.DOCKER_IMAGE,
        "backend_ws_url": settings.BACKEND_WS_URL or "auto-detected from request host",
        "endpoints": {
            "bash_installer": "/agent/install.sh",
            "powershell_installer": "/agent/install.ps1",
            "bash_uninstaller": "/agent/uninstall.sh",
            "powershell_uninstaller": "/agent/uninstall.ps1",
            "checksums": "/agent/checksums",
        },
    }
