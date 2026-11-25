"""Router providing secure endpoints for SelfHeal Agent installer distribution."""

import hashlib
import logging
import re
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException, Request, Response, status

from installer_service.config import settings

logger = logging.getLogger("selfheal.installer_router")
router = APIRouter(prefix="/agent", tags=["Installer Distribution"])


def safe_resolve_script(filename: str) -> Path:
    """Validate filename against path traversal and verify existence."""
    if "/" in filename or "\\" in filename or ".." in filename:
        logger.warning("Path traversal attempt blocked: %r", filename)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid filename specified",
        )

    base_dir = settings.INSTALLERS_DIR.resolve()
    target = (base_dir / filename).resolve()

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


_HOST_RE = re.compile(r"^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*(?::\d{1,5})?$")
_TOKEN_RE = re.compile(r"^[A-Za-z0-9_.\-:]{1,256}$")
_CLUSTER_ID_RE = re.compile(r"^[A-Za-z0-9_.\-]{0,128}$")


def sanitize_installer_token(token: str | None) -> str:
    if not token or not token.strip():
        return ""
    candidate = token.strip()
    if not _TOKEN_RE.fullmatch(candidate):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid agent token format")
    return candidate


def sanitize_cluster_id(cluster_id: str | None) -> str:
    if not cluster_id or not cluster_id.strip():
        return ""
    candidate = cluster_id.strip()
    if not _CLUSTER_ID_RE.fullmatch(candidate):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid cluster_id format")
    return candidate


def resolve_backend_url(request: Request) -> str:
    """Determine the WebSocket backend URL from trusted config or validated proxy host header."""
    if settings.BACKEND_WS_URL and settings.BACKEND_WS_URL.strip():
        return settings.BACKEND_WS_URL.strip()

    forwarded_host = (request.headers.get("x-forwarded-host") or request.headers.get("host") or "").strip().lower()
    forwarded_host = forwarded_host.split(",")[0].strip()
    if not forwarded_host or not _HOST_RE.fullmatch(forwarded_host):
        return ""

    clean_host = forwarded_host.split(":")[0]
    if clean_host in ["localhost", "127.0.0.1", "0.0.0.0", "host.docker.internal"]:
        return ""

    allowed_hosts = [
        h.strip().lower()
        for h in (getattr(settings, "ALLOWED_PUBLIC_HOSTS", "") or "").split(",")
        if h.strip()
    ]
    if allowed_hosts and clean_host not in allowed_hosts and forwarded_host not in allowed_hosts:
        return ""

    proto = (request.headers.get("x-forwarded-proto") or request.url.scheme or "http").split(",")[0].strip().lower()
    ws_proto = "wss" if proto == "https" else "ws"
    return f"{ws_proto}://{forwarded_host}/api/v1/agent/connect"


def generate_kubernetes_manifest(
    ws_url: str,
    token: str,
    docker_image: str,
    cluster_id: str = "",
) -> str:
    """Build a complete, standalone Kubernetes multi-document YAML for enterprise deployment."""
    token_val = token if token else "YOUR_AGENT_TOKEN"
    server_url = ws_url if ws_url else "ws://localhost:5000/api/v1/agent/connect"
    img = docker_image if docker_image else "ghcr.io/selfheal-ai/selfheal-agent:1.0.0"

    return f"""apiVersion: v1
kind: Namespace
metadata:
  name: selfheal-system
  labels:
    app.kubernetes.io/name: selfheal-agent
---
apiVersion: v1
kind: ServiceAccount
metadata:
  name: selfheal-agent-sa
  namespace: selfheal-system
  labels:
    app.kubernetes.io/name: selfheal-agent
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: selfheal-agent-role
  labels:
    app.kubernetes.io/name: selfheal-agent
rules:
  - apiGroups: [""]
    resources: ["pods", "pods/log", "services", "namespaces", "events", "nodes"]
    verbs: ["get", "list", "watch", "patch", "delete"]
  - apiGroups: ["apps"]
    resources: ["deployments", "replicasets"]
    verbs: ["get", "list", "watch", "patch", "update"]
  - apiGroups: ["apps"]
    resources: ["deployments/scale"]
    verbs: ["get", "patch", "update"]
  - apiGroups: ["metrics.k8s.io"]
    resources: ["pods", "nodes"]
    verbs: ["get", "list"]
  - apiGroups: ["networking.k8s.io"]
    resources: ["networkpolicies"]
    verbs: ["get", "list", "watch", "create", "update", "patch", "delete"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: selfheal-agent-rolebinding
  labels:
    app.kubernetes.io/name: selfheal-agent
subjects:
  - kind: ServiceAccount
    name: selfheal-agent-sa
    namespace: selfheal-system
roleRef:
  kind: ClusterRole
  name: selfheal-agent-role
  apiGroup: rbac.authorization.k8s.io
---
apiVersion: v1
kind: Secret
metadata:
  name: selfheal-agent-secret
  namespace: selfheal-system
  labels:
    app.kubernetes.io/name: selfheal-agent
type: Opaque
stringData:
  AGENT_TOKEN: "{token_val}"
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: selfheal-agent-config
  namespace: selfheal-system
  labels:
    app.kubernetes.io/name: selfheal-agent
data:
  AGENT_SERVER_URL: "{server_url}"
  AGENT_UID: "selfheal-agent-cluster-01"
  CLUSTER_ID: "{cluster_id}"
  METRICS_INTERVAL_MS: "5000"
  LOG_COLLECTION_INTERVAL_MS: "5000"
  LOG_LEVEL: "INFO"
  ENABLE_HEALING_ACTIONS: "false"
  HEALTH_PORT: "8080"
  OTEL_ENABLED: "true"
  OTEL_SERVICE_NAME: "selfheal-k8s-agent"
  OTEL_SERVICE_VERSION: "1.0.0"
  OTEL_SERVICE_NAMESPACE: "selfheal-system"
  DEPLOYMENT_ENVIRONMENT: "production"
  OTEL_EXPORTER_OTLP_ENDPOINT: "http://otel-collector-opentelemetry-collector.monitoring.svc.cluster.local:4318"
  OTEL_METRIC_EXPORT_INTERVAL_MS: "15000"
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: selfheal-agent
  namespace: selfheal-system
  labels:
    app.kubernetes.io/name: selfheal-agent
    app.kubernetes.io/component: monitoring-agent
spec:
  replicas: 1
  strategy:
    type: Recreate
  selector:
    matchLabels:
      app.kubernetes.io/name: selfheal-agent
  template:
    metadata:
      labels:
        app.kubernetes.io/name: selfheal-agent
    spec:
      serviceAccountName: selfheal-agent-sa
      securityContext:
        runAsNonRoot: true
        runAsUser: 10001
        runAsGroup: 10001
        fsGroup: 10001
        seccompProfile:
          type: RuntimeDefault
      containers:
        - name: selfheal-agent
          image: {img}
          imagePullPolicy: IfNotPresent
          ports:
            - name: http-health
              containerPort: 8080
              protocol: TCP
          envFrom:
            - configMapRef:
                name: selfheal-agent-config
          env:
            - name: PYTHONUNBUFFERED
              value: "1"
            - name: AGENT_TOKEN
              valueFrom:
                secretKeyRef:
                  name: selfheal-agent-secret
                  key: AGENT_TOKEN
            - name: K8S_NAMESPACE_NAME
              valueFrom:
                fieldRef:
                  fieldPath: metadata.namespace
            - name: K8S_POD_NAME
              valueFrom:
                fieldRef:
                  fieldPath: metadata.name
            - name: K8S_NODE_NAME
              valueFrom:
                fieldRef:
                  fieldPath: spec.nodeName
          livenessProbe:
            httpGet:
              path: /healthz
              port: 8080
            initialDelaySeconds: 15
            periodSeconds: 20
            timeoutSeconds: 5
            failureThreshold: 3
          readinessProbe:
            httpGet:
              path: /readyz
              port: 8080
            initialDelaySeconds: 10
            periodSeconds: 10
            timeoutSeconds: 5
            failureThreshold: 3
          resources:
            limits:
              cpu: 500m
              memory: 512Mi
            requests:
              cpu: 100m
              memory: 128Mi
          securityContext:
            allowPrivilegeEscalation: false
            readOnlyRootFilesystem: true
            capabilities:
              drop:
                - ALL
          volumeMounts:
            - name: tmp
              mountPath: /tmp
      volumes:
        - name: tmp
          emptyDir: {{}}
"""


@router.get("/install.sh", summary="Download Linux/macOS Bash Installer")
async def get_bash_installer(request: Request, token: str | None = None):
    """Returns the official SelfHeal Agent Bash installation script for Linux and macOS."""
    file_path = safe_resolve_script("install-agent.sh")
    with open(file_path, "r", encoding="utf-8-sig") as f:
        content = f.read().lstrip("\ufeff")

    ws_url = resolve_backend_url(request)
    if ws_url:
        content = content.replace('CONFIGURED_SERVER_URL="__SELFHEAL_BACKEND_URL__"', f'CONFIGURED_SERVER_URL="{ws_url}"')

    clean_token = sanitize_installer_token(token)
    if clean_token:
        content = content.replace('CONFIGURED_TOKEN="__SELFHEAL_TOKEN__"', f'CONFIGURED_TOKEN="{clean_token}"')

    docker_img = settings.DOCKER_IMAGE.strip() if settings.DOCKER_IMAGE else "ghcr.io/selfheal-ai/selfheal-agent:1.0.0"
    content = content.replace('AGENT_IMAGE="__SELFHEAL_DOCKER_IMAGE__"', f'AGENT_IMAGE="{docker_img}"')
    content = content.replace('image: captone-agent:1.0.0', f'image: {docker_img}')

    # Normalize Windows CRLF to Unix LF for Linux/macOS bash execution
    content = content.replace('\r\n', '\n').replace('\r', '\n')

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
async def get_powershell_installer(request: Request, token: str | None = None):
    """Returns the official SelfHeal Agent PowerShell installation script for Windows."""
    file_path = safe_resolve_script("install-agent.ps1")
    # Strip UTF-8 BOM (\ufeff) so PowerShell `irm ... | iex` and `[scriptblock]::Create(...)` parse `param(...)` safely
    with open(file_path, "r", encoding="utf-8-sig") as f:
        content = f.read().lstrip("\ufeff")

    ws_url = resolve_backend_url(request)
    if ws_url:
        content = content.replace('$CONFIGURED_SERVER_URL = "__SELFHEAL_BACKEND_URL__"', f'$CONFIGURED_SERVER_URL = "{ws_url}"')

    clean_token = sanitize_installer_token(token)
    if clean_token:
        content = content.replace('$CONFIGURED_TOKEN = "__SELFHEAL_TOKEN__"', f'$CONFIGURED_TOKEN = "{clean_token}"')

    docker_img = settings.DOCKER_IMAGE.strip() if settings.DOCKER_IMAGE else "ghcr.io/selfheal-ai/selfheal-agent:1.0.0"
    content = content.replace('$AGENT_IMAGE = "__SELFHEAL_DOCKER_IMAGE__"', f'$AGENT_IMAGE = "{docker_img}"')
    content = content.replace('$CONFIGURED_AGENT_IMAGE = "__SELFHEAL_DOCKER_IMAGE__"', f'$CONFIGURED_AGENT_IMAGE = "{docker_img}"')
    content = content.replace('image: captone-agent:1.0.0', f'image: {docker_img}')

    return Response(
        content=content,
        media_type="text/plain; charset=utf-8",
        headers={
            "Content-Disposition": 'attachment; filename="install-agent.ps1"',
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "X-Content-Type-Options": "nosniff",
        },
    )


@router.get("/install.yaml", summary="Download Ready-to-Apply Dynamic Kubernetes Manifest")
async def get_k8s_install_manifest(request: Request, token: str | None = None, cluster_id: str | None = None):
    """Returns a full Kubernetes manifest with Token & Server URL dynamically embedded."""
    ws_url = resolve_backend_url(request)
    clean_token = sanitize_installer_token(token) or "YOUR_AGENT_TOKEN"
    clean_cluster_id = sanitize_cluster_id(cluster_id)
    docker_img = settings.DOCKER_IMAGE.strip() if settings.DOCKER_IMAGE else "ghcr.io/selfheal-ai/selfheal-agent:1.0.0"
    content = generate_kubernetes_manifest(ws_url, clean_token, docker_img, clean_cluster_id)

    return Response(
        content=content,
        media_type="application/yaml; charset=utf-8",
        headers={
            "Content-Disposition": 'attachment; filename="selfheal-agent-install.yaml"',
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "X-Content-Type-Options": "nosniff",
        },
    )


@router.get("/manifest.yaml", summary="Download Standard Kubernetes Manifest")
async def get_k8s_standard_manifest(request: Request):
    """Returns standard Kubernetes manifest referencing selfheal-agent-secret."""
    ws_url = resolve_backend_url(request)
    docker_img = settings.DOCKER_IMAGE.strip() if settings.DOCKER_IMAGE else "ghcr.io/selfheal-ai/selfheal-agent:1.0.0"
    content = generate_kubernetes_manifest(ws_url, "YOUR_AGENT_TOKEN", docker_img, "")

    return Response(
        content=content,
        media_type="application/yaml; charset=utf-8",
        headers={
            "Content-Disposition": 'attachment; filename="selfheal-agent.yaml"',
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "X-Content-Type-Options": "nosniff",
        },
    )


@router.get("/uninstall.sh", summary="Download Linux/macOS Bash Uninstaller")
async def get_bash_uninstaller():
    """Returns the clean removal script for SelfHeal Agent on Linux and macOS."""
    file_path = safe_resolve_script("uninstall-agent.sh")
    with open(file_path, "r", encoding="utf-8-sig") as f:
        content = f.read().lstrip("\ufeff").replace("\r\n", "\n").replace("\r", "\n")
    return Response(
        content=content,
        media_type="text/x-shellscript; charset=utf-8",
        headers={
            "Content-Disposition": 'attachment; filename="uninstall-agent.sh"',
            "Cache-Control": "no-cache",
            "X-Content-Type-Options": "nosniff",
        },
    )


@router.get("/uninstall.ps1", summary="Download Windows PowerShell Uninstaller")
async def get_powershell_uninstaller():
    """Returns the clean removal script for SelfHeal Agent on Windows."""
    file_path = safe_resolve_script("uninstall-agent.ps1")
    with open(file_path, "r", encoding="utf-8-sig") as f:
        content = f.read().lstrip("\ufeff")
    return Response(
        content=content,
        media_type="text/plain; charset=utf-8",
        headers={
            "Content-Disposition": 'attachment; filename="uninstall-agent.ps1"',
            "Cache-Control": "no-cache",
            "X-Content-Type-Options": "nosniff",
        },
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
            "k8s_install_manifest": "/agent/install.yaml",
            "k8s_standard_manifest": "/agent/manifest.yaml",
            "bash_uninstaller": "/agent/uninstall.sh",
            "powershell_uninstaller": "/agent/uninstall.ps1",
            "checksums": "/agent/checksums",
        },
    }
