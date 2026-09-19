# Kubernetes (K8s) Manifests cho CapTone

Thư mục chứa các file cấu hình YAML để deploy hệ thống lên Kubernetes Cluster (Minikube, K3s, Kind, EKS, GKE, AKS).

## Cấu trúc file

- `namespace.yaml`: Tạo namespace `captone`.
- `postgres.yaml`: Tạo PersistentVolumeClaim (10Gi), Deployment và ClusterIP Service cho PostgreSQL.
- `backend.yaml`: Tạo ConfigMap, Secret, Deployment (2 replicas + Probes) và NodePort Service (Port 30500) cho `main-backend`.

## Hướng dẫn Deploy lên Kubernetes

### 1. Áp dụng tất cả các file YAML:
```bash
kubectl apply -f k8s/
```

### 2. Kiểm tra trạng thái:
```bash
# Xem Pods, Services, Deployments trong namespace captone
kubectl get all -n captone
```

### 3. Kiểm tra Health Check:
- Nếu chạy **Minikube**:
  ```bash
  minikube service main-backend-service -n captone
  ```
- Hoặc dùng **Port-forward**:
  ```bash
  kubectl port-forward svc/main-backend-service 5000:5000 -n captone
  ```
  Truy cập: `http://localhost:5000/api/v1/health`

### 4. Xóa hệ thống:
```bash
kubectl delete -f k8s/
```
