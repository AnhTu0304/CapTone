# ==============================================================================
# SelfHeal Agent Installer for Windows PowerShell
# AI-Driven Proactive Self-Healing Infrastructure for SMEs
# ==============================================================================

[CmdletBinding()]
param (
    [string]$ServerUrl = "",
    [string]$Token = "",
    [string]$Namespace = "selfheal-system",
    [switch]$NonInteractive
)

$ErrorActionPreference = "Stop"

Write-Host "==============================================================================" -ForegroundColor Cyan
Write-Host "          S E L F H E A L   K U B E R N E T E S   A G E N T                   " -ForegroundColor Cyan
Write-Host "      AI-Driven Proactive Self-Healing Infrastructure for SMEs                " -ForegroundColor Cyan
Write-Host "==============================================================================" -ForegroundColor Cyan
Write-Host ""

# ------------------------------------------------------------------------------
# 1. Kiểm tra điều kiện tiên quyết (Prerequisites)
# ------------------------------------------------------------------------------
$kubectlCmd = Get-Command kubectl -ErrorAction SilentlyContinue
if (-not $kubectlCmd) {
    Write-Host "[ERROR] Khong tim thay lenh 'kubectl'. Vui long cai dat kubectl truoc khi chay bo cai." -ForegroundColor Red
    exit 1
}

$currentContext = (kubectl config current-context 2>$null)
if (-not $currentContext) {
    Write-Host "[ERROR] Khong the xac dinh Kubernetes context hien tai. Kiem tra file ~/.kube/config." -ForegroundColor Red
    exit 1
}

# Kiem tra ket noi thuc te den Kubernetes API Server
$clusterCheck = (kubectl cluster-info --request-timeout=4s 2>&1)
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Khong the ket noi den Kubernetes API Server (Context: $currentContext)!" -ForegroundColor Red
    Write-Host "  Nguyen nhan: Cum Kubernetes hien tai dang bi dung (Stopped) hoac endpoint bi lech cong." -ForegroundColor Yellow
    Write-Host "  Chi tiet: $(($clusterCheck | Out-String).Trim())" -ForegroundColor Gray
    Write-Host ""
    Write-Host "--- HUONG DAN KHAC PHUC NHANH ---" -ForegroundColor Cyan
    Write-Host "1. Neu dung Minikube, hay khoi dong lai cum bang lenh:" -ForegroundColor White
    Write-Host "   minikube start" -ForegroundColor Green
    Write-Host "   minikube update-context" -ForegroundColor Green
    Write-Host ""
    Write-Host "2. Hoac chay truc tiep Agent bang Python tren may Host (khong can K8s):" -ForegroundColor White
    Write-Host "   cd d:\\AISelfHealing\\Agent; .\\venv\\Scripts\\Activate.ps1" -ForegroundColor Green
    Write-Host "   python -m selfheal_agent.main" -ForegroundColor Green
    exit 1
}

$helmCmd = Get-Command helm -ErrorAction SilentlyContinue
$scriptDir = $null
try {
    if ($MyInvocation.MyCommand.Path) {
        $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
    }
} catch {
    $scriptDir = $null
}

$helmDir = $null
if ($scriptDir) {
    $cand1 = Join-Path $scriptDir "..\deploy\helm\selfheal-agent"
    $cand2 = Join-Path $scriptDir "..\helm\selfheal-agent"
    if (Test-Path $cand1) { $helmDir = $cand1 }
    elseif (Test-Path $cand2) { $helmDir = $cand2 }
}

$useHelm = [bool]($helmCmd -and $helmDir)

Write-Host "--- Thong tin moi truong trien khai ---" -ForegroundColor Yellow
Write-Host "  * Kubernetes Context : $currentContext" -ForegroundColor Green
Write-Host "  * Namespace          : $Namespace" -ForegroundColor Green
if ($useHelm) {
    Write-Host "  * Deploy Engine      : Helm Chart v3" -ForegroundColor Green
} else {
    Write-Host "  * Deploy Engine      : Kubernetes Native Manifests (kubectl)" -ForegroundColor Green
}

# ------------------------------------------------------------------------------
# 2. Xử lý địa chỉ Backend (Tự động nạp sẵn, không bắt người dùng nhập)
# ------------------------------------------------------------------------------
$CONFIGURED_SERVER_URL = "__SELFHEAL_BACKEND_URL__"

if (-not $ServerUrl) {
    if ($CONFIGURED_SERVER_URL -and $CONFIGURED_SERVER_URL -notmatch "^__") {
        $ServerUrl = $CONFIGURED_SERVER_URL
    } else {
        $envUrl = [System.Environment]::GetEnvironmentVariable("SELFHEAL_SERVER_URL")
        if ($envUrl) {
            $ServerUrl = $envUrl
        } else {
            $ServerUrl = if ($currentContext -like "*minikube*") {
                "ws://host.minikube.internal:5000/api/v1/agent/connect"
            } elseif ($currentContext -like "*docker*") {
                "ws://host.docker.internal:5000/api/v1/agent/connect"
            } else {
                "ws://localhost:5000/api/v1/agent/connect"
            }
        }
    }
}

Write-Host "  * Server URL         : $ServerUrl (Tu dong ket noi)" -ForegroundColor Green
Write-Host ""

# ------------------------------------------------------------------------------
# 3. Yêu cầu nhập Token (CÂU HỎI DUY NHẤT)
# ------------------------------------------------------------------------------
if (-not $Token) {
    $securePass = Read-Host "Nhap Token do SelfHeal cap" -AsSecureString
    $BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePass)
    $Token = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
}

if (-not $Token -or $Token.Trim() -eq "") {
    Write-Host "[ERROR] Token khong duoc de trong! Dung qua trinh cai dat." -ForegroundColor Red
    exit 1
}

$maskedToken = $Token.Substring(0, [Math]::Min(8, $Token.Length)) + "****************"
Write-Host "  * Token xac nhan     : $maskedToken (da ma hoa bao mat)" -ForegroundColor Green
Write-Host ""

# ------------------------------------------------------------------------------
# 4. Tạo Namespace & Secret bảo mật
# ------------------------------------------------------------------------------
Write-Host "--- Dang chuan bi Namespace & Secret an toan ---" -ForegroundColor Yellow

kubectl create namespace $Namespace --dry-run=client -o yaml | kubectl apply -f - | Out-Null

$secretName = "selfheal-agent-secret"
kubectl create secret generic $secretName `
    --namespace $Namespace `
    --from-literal="AGENT_TOKEN=$Token" `
    --dry-run=client -o yaml | kubectl apply -f - | Out-Null

Write-Host "  * Secret '$secretName' da duoc luu tru an toan." -ForegroundColor Green
Write-Host ""

# ------------------------------------------------------------------------------
# 5. Triển khai Agent vào Kubernetes
# ------------------------------------------------------------------------------
Write-Host "--- Dang trien khai SelfHeal Agent vao Cluster ---" -ForegroundColor Yellow
$releaseName = "selfheal-agent"

if ($useHelm) {
    Write-Host "  Thuc thi qua Helm: helm upgrade --install $releaseName ..."
    helm upgrade --install $releaseName $helmDir `
        --namespace $Namespace `
        --set config.agentServerUrl="$ServerUrl" `
        --set secret.existingSecret="$secretName" `
        --set securityContext.runAsNonRoot=true `
        --set securityContext.runAsUser=10001 `
        --wait `
        --timeout 2m
} else {
    Write-Host "  Thuc thi qua kubectl manifest..."
    $manifestYaml = @"
apiVersion: v1
kind: ServiceAccount
metadata:
  name: selfheal-agent-sa
  namespace: $Namespace
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
    verbs: ["get", "list", "watch"]
  - apiGroups: ["apps"]
    resources: ["deployments", "replicasets"]
    verbs: ["get", "list", "watch"]
  - apiGroups: ["apps"]
    resources: ["deployments"]
    verbs: ["patch"]
  - apiGroups: ["apps"]
    resources: ["deployments/scale"]
    verbs: ["get", "patch"]
  - apiGroups: ["metrics.k8s.io"]
    resources: ["pods", "nodes"]
    verbs: ["get", "list"]
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
    namespace: $Namespace
roleRef:
  kind: ClusterRole
  name: selfheal-agent-role
  apiGroup: rbac.authorization.k8s.io
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: $releaseName
  namespace: $Namespace
  labels:
    app.kubernetes.io/name: selfheal-agent
spec:
  replicas: 1
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
          image: captone-agent:1.0.0
          imagePullPolicy: IfNotPresent
          ports:
            - name: http-health
              containerPort: 8080
              protocol: TCP
          env:
            - name: AGENT_SERVER_URL
              value: "$ServerUrl"
            - name: AGENT_UID
              value: "selfheal-agent-default"
            - name: CLUSTER_ID
              value: "$currentContext"
            - name: METRICS_INTERVAL_MS
              value: "5000"
            - name: LOG_COLLECTION_INTERVAL_MS
              value: "5000"
            - name: LOG_LEVEL
              value: "INFO"
            - name: ENABLE_HEALING_ACTIONS
              value: "false"
            - name: HEALTH_PORT
              value: "8080"
            - name: PYTHONUNBUFFERED
              value: "1"
            - name: AGENT_TOKEN
              valueFrom:
                secretKeyRef:
                  name: $secretName
                  key: AGENT_TOKEN
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
            requests:
              cpu: 50m
              memory: 64Mi
            limits:
              cpu: 200m
              memory: 256Mi
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
          emptyDir: {}
"@
    $manifestYaml | kubectl apply -f - | Out-Null
}

Write-Host "  * Manifests da duoc ap dung thanh cong." -ForegroundColor Green
Write-Host ""

# ------------------------------------------------------------------------------
# 6. Kiểm tra trạng thái Pods
# ------------------------------------------------------------------------------
Write-Host "--- Kiem tra trang thai Pod ---" -ForegroundColor Yellow
Write-Host "  Khoi dong lai Pod de ap dung Token moi nhat..."
kubectl rollout restart deployment/$releaseName --namespace $Namespace | Out-Null
Write-Host "  Cho Pod khoi dong va san sang..."
kubectl rollout status deployment/$releaseName --namespace $Namespace --timeout=60s

Write-Host ""
Write-Host "==============================================================================" -ForegroundColor Green
Write-Host "       CAI DAT SELFHEAL KUBERNETES AGENT HOAN TAT THANH CONG!                 " -ForegroundColor Green
Write-Host "==============================================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Cac lenh kiem tra trang thai:"
Write-Host "  * Xem Pod  : kubectl get pods -n $Namespace -l app.kubernetes.io/name=selfheal-agent" -ForegroundColor Cyan
Write-Host "  * Xem Logs : kubectl logs -f -n $Namespace -l app.kubernetes.io/name=selfheal-agent" -ForegroundColor Cyan
Write-Host ""
