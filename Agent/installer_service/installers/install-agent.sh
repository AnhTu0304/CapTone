#!/usr/bin/env bash
# ==============================================================================
# SelfHeal Agent Installer for Linux & macOS
# AI-Driven Proactive Self-Healing Infrastructure for SMEs
# ==============================================================================

set -euo pipefail

# ANSI Color Codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

SERVER_URL=""
AGENT_TOKEN=""
AGENT_NAMESPACE="selfheal-system"
RELEASE_NAME="selfheal-agent"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &>/dev/null && pwd || echo "")"
HELM_CHART_DIR="${SCRIPT_DIR}/../deploy/helm/selfheal-agent"

echo -e "${CYAN}${BOLD}==============================================================================${NC}"
echo -e "${CYAN}${BOLD}          S E L F H E A L   K U B E R N E T E S   A G E N T                   ${NC}"
echo -e "${CYAN}${BOLD}      AI-Driven Proactive Self-Healing Infrastructure for SMEs                ${NC}"
echo -e "${CYAN}${BOLD}==============================================================================${NC}"
echo ""

# Parse CLI arguments if any
while [[ $# -gt 0 ]]; do
  case "$1" in
    --server-url)
      SERVER_URL="$2"
      shift 2
      ;;
    --token)
      AGENT_TOKEN="$2"
      shift 2
      ;;
    --namespace)
      AGENT_NAMESPACE="$2"
      shift 2
      ;;
    -h|--help)
      echo "Cách dùng: $0 [--token TOKEN] [--server-url URL]"
      exit 0
      ;;
    *)
      shift
      ;;
  esac
done

# ------------------------------------------------------------------------------
# 1. Kiểm tra điều kiện tiên quyết (Prerequisites)
# ------------------------------------------------------------------------------
if ! command -v kubectl &> /dev/null; then
  echo -e "${RED}[ERROR] Không tìm thấy lệnh 'kubectl'. Vui lòng cài đặt kubectl trước khi tiếp tục.${NC}"
  exit 1
fi

CURRENT_CONTEXT="$(kubectl config current-context 2>/dev/null || true)"
if [ -z "${CURRENT_CONTEXT}" ]; then
  echo -e "${RED}[ERROR] Không thể xác định Kubernetes context hiện tại. Hãy kiểm tra file kubeconfig (~/.kube/config).${NC}"
  exit 1
fi

USE_HELM=false
if command -v helm &> /dev/null && [ -d "${HELM_CHART_DIR}" ]; then
  USE_HELM=true
fi

echo -e "${YELLOW}--- Thông tin môi trường triển khai ---${NC}"
echo -e "  * Kubernetes Context : ${GREEN}${BOLD}${CURRENT_CONTEXT}${NC}"
echo -e "  * Namespace          : ${GREEN}${BOLD}${AGENT_NAMESPACE}${NC}"
if [ "${USE_HELM}" = true ]; then
  echo -e "  * Deploy Engine      : ${GREEN}Helm Chart v3${NC}"
else
  echo -e "  * Deploy Engine      : ${GREEN}Kubernetes Native Manifests (kubectl)${NC}"
fi

# ------------------------------------------------------------------------------
# 2. Xử lý địa chỉ Backend tự động (Không bắt người dùng nhập)
# ------------------------------------------------------------------------------
CONFIGURED_SERVER_URL="__SELFHEAL_BACKEND_URL__"

if [ -z "${SERVER_URL}" ]; then
  if [ -n "${CONFIGURED_SERVER_URL}" ] && [[ "${CONFIGURED_SERVER_URL}" != "__"* ]]; then
    SERVER_URL="${CONFIGURED_SERVER_URL}"
  elif [ -n "${SELFHEAL_SERVER_URL:-}" ]; then
    SERVER_URL="${SELFHEAL_SERVER_URL}"
  elif [[ "${CURRENT_CONTEXT}" == *"minikube"* ]]; then
    SERVER_URL="ws://host.minikube.internal:5000/api/v1/agent/connect"
  elif [[ "${CURRENT_CONTEXT}" == *"docker"* ]]; then
    SERVER_URL="ws://host.docker.internal:5000/api/v1/agent/connect"
  else
    SERVER_URL="ws://localhost:5000/api/v1/agent/connect"
  fi
fi

echo -e "  * Server URL         : ${GREEN}${SERVER_URL} (Tự động kết nối)${NC}"
echo ""

# ------------------------------------------------------------------------------
# 3. Yêu cầu nhập Token (CÂU HỎI DUY NHẤT)
# ------------------------------------------------------------------------------
if [ -z "${AGENT_TOKEN}" ]; then
  read -r -s -p "Nhập Token do SelfHeal cấp: " AGENT_TOKEN
  echo ""
fi

if [ -z "${AGENT_TOKEN// }" ]; then
  echo -e "${RED}[ERROR] Token không được để trống! Quá trình cài đặt dừng lại.${NC}"
  exit 1
fi

TOKEN_MASKED="${AGENT_TOKEN:0:8}****************"
echo -e "  * Token xác nhận     : ${GREEN}${TOKEN_MASKED}${NC} (đã mã hóa bảo mật)"
echo ""

# ------------------------------------------------------------------------------
# 4. Khởi tạo Namespace & Kubernetes Secret bảo mật
# ------------------------------------------------------------------------------
echo -e "${YELLOW}--- Đang chuẩn bị Namespace & Secret an toàn ---${NC}"

kubectl create namespace "${AGENT_NAMESPACE}" --dry-run=client -o yaml | kubectl apply -f - >/dev/null

SECRET_NAME="selfheal-agent-secret"
kubectl create secret generic "${SECRET_NAME}" \
  --namespace "${AGENT_NAMESPACE}" \
  --from-literal=AGENT_TOKEN="${AGENT_TOKEN}" \
  --dry-run=client -o yaml | kubectl apply -f - >/dev/null

echo -e "  * Secret '${SECRET_NAME}' đã được lưu trữ an toàn."
echo ""

# ------------------------------------------------------------------------------
# 5. Triển khai Agent vào Kubernetes
# ------------------------------------------------------------------------------
echo -e "${YELLOW}--- Đang triển khai SelfHeal Agent vào Cluster ---${NC}"

if [ "${USE_HELM}" = true ]; then
  echo -e "  Thực thi qua Helm: helm upgrade --install ${RELEASE_NAME} ..."
  helm upgrade --install "${RELEASE_NAME}" "${HELM_CHART_DIR}" \
    --namespace "${AGENT_NAMESPACE}" \
    --set config.agentServerUrl="${SERVER_URL}" \
    --set secret.existingSecret="${SECRET_NAME}" \
    --set securityContext.runAsNonRoot=true \
    --set securityContext.runAsUser=10001 \
    --wait \
    --timeout 2m
else
  echo -e "  Thực thi qua kubectl manifest..."
  cat <<EOF | kubectl apply -f - >/dev/null
apiVersion: v1
kind: ServiceAccount
metadata:
  name: selfheal-agent-sa
  namespace: ${AGENT_NAMESPACE}
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
    namespace: ${AGENT_NAMESPACE}
roleRef:
  kind: ClusterRole
  name: selfheal-agent-role
  apiGroup: rbac.authorization.k8s.io
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${RELEASE_NAME}
  namespace: ${AGENT_NAMESPACE}
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
              value: "${SERVER_URL}"
            - name: AGENT_UID
              value: "selfheal-agent-default"
            - name: CLUSTER_ID
              value: "${CURRENT_CONTEXT}"
            - name: METRICS_INTERVAL_MS
              value: "5000"
            - name: LOG_COLLECTION_INTERVAL_MS
              value: "5000"
            - name: LOG_LEVEL
              value: "INFO"
            - name: HEALTH_PORT
              value: "8080"
            - name: PYTHONUNBUFFERED
              value: "1"
            - name: AGENT_TOKEN
              valueFrom:
                secretKeyRef:
                  name: ${SECRET_NAME}
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
EOF
fi

echo -e "  * Manifests đã được áp dụng thành công."
echo ""

# ------------------------------------------------------------------------------
# 6. Kiểm tra trạng thái Pod & Kết nối
# ------------------------------------------------------------------------------
echo -e "${YELLOW}--- Kiểm tra trạng thái Pod ---${NC}"
echo -e "  Chờ Pod khởi động và sẵn sàng..."
kubectl rollout status deployment/"${RELEASE_NAME}" --namespace "${AGENT_NAMESPACE}" --timeout=60s

echo ""
echo -e "${GREEN}${BOLD}==============================================================================${NC}"
echo -e "${GREEN}${BOLD}       CÀI ĐẶT SELFHEAL KUBERNETES AGENT HOÀN TẤT THÀNH CÔNG!                ${NC}"
echo -e "${GREEN}${BOLD}==============================================================================${NC}"
echo ""
echo -e "Các lệnh kiểm tra trạng thái:"
echo -e "  * Xem Pod  : ${CYAN}kubectl get pods -n ${AGENT_NAMESPACE} -l app.kubernetes.io/name=selfheal-agent${NC}"
echo -e "  * Xem Logs : ${CYAN}kubectl logs -f -n ${AGENT_NAMESPACE} -l app.kubernetes.io/name=selfheal-agent${NC}"
echo ""
