# SelfHeal Agent Kubernetes Manifests (Production-Ready)

Bộ tài liệu cấu hình Kubernetes YAML manifests độc lập dành cho **SelfHeal Agent**, hỗ trợ triển khai nhanh qua `kubectl apply` hoặc các công cụ GitOps (ArgoCD, Flux).

## 1. Cấu trúc thư mục

- `namespace.yaml`: Tạo namespace cách ly `selfheal-system`.
- `serviceaccount.yaml`: ServiceAccount `selfheal-agent-sa` cho Agent.
- `rbac.yaml`: Least-privilege `ClusterRole` và `ClusterRoleBinding` (chỉ cấp đọc tài nguyên cần thiết và quyền patch workload khi có lệnh self-healing).
- `configmap.yaml`: Các cấu hình chung không nhạy cảm (URL Backend, intervals, log level).
- `secret.yaml`: Secret lưu trữ `AGENT_TOKEN` bảo mật.
- `deployment.yaml`: Deployment 1 bản sao, Non-Root UID 10001, Drop ALL capabilities, Read-only root filesystem, Liveness/Readiness probes.
- `kustomization.yaml`: Kustomize bundle để triển khai 1 lệnh.

## 2. Hướng dẫn triển khai

### Bước 1: Khởi tạo Secret với Token thực tế
```bash
kubectl create namespace selfheal-system --dry-run=client -o yaml | kubectl apply -f -

kubectl create secret generic selfheal-agent-secret \
  --namespace selfheal-system \
  --from-literal=AGENT_TOKEN="<AGENT_TOKEN_DO_BACKEND_CAP>" \
  --dry-run=client -o yaml | kubectl apply -f -
```

### Bước 2: Tùy chỉnh cấu hình trong `configmap.yaml`
Cập nhật `AGENT_SERVER_URL` trỏ tới địa chỉ WebSocket Backend (ví dụ `wss://backend.example.com/api/v1/agent/connect`).

### Bước 3: Áp dụng toàn bộ manifests
```bash
# Triển khai qua Kustomize:
kubectl apply -k Agent/deploy/manifests/

# Hoặc qua kubectl apply trực tiếp:
kubectl apply -f Agent/deploy/manifests/
```

### Bước 4: Kiểm tra trạng thái
```bash
kubectl rollout status deployment/selfheal-agent -n selfheal-system
kubectl get pods -n selfheal-system -l app.kubernetes.io/name=selfheal-agent
kubectl logs -f -n selfheal-system -l app.kubernetes.io/name=selfheal-agent
```
