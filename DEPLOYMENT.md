# Hướng Dẫn Đóng Gói & Triển Khai Sản Xuất Nền Tảng SelfHeal
*(SelfHeal - AI-Driven Autonomous Self-Healing Infrastructure for SMEs)*

Tài liệu này cung cấp hướng dẫn toàn diện dành cho Kỹ sư DevOps và Quản trị viên hệ thống để đóng gói, triển khai và vận hành nền tảng **SelfHeal** trên môi trường Docker, Docker Compose và Kubernetes (K8s).

---

## 1. Yêu Cầu Môi Trường
- **Node.js**: v18.x hoặc v20.x LTS trở lên
- **Docker Engine**: v24.x trở lên
- **Docker Compose**: v2.x trở lên
- **Kubernetes**: Cụm v1.28 - v1.30+ (k8s-prod, k8s-staging)
- **Công cụ dòng lệnh**: `kubectl`, `helm` v3.x

---

## 2. Triển Khai Cục Bộ & Môi Trường Thử Nghiệm (Local / Dev)

### 2.1. Chạy trực tiếp với Node.js / React
```bash
# Di chuyển vào thư mục frontend
cd frontend

# Cài đặt phụ thuộc
npm install --legacy-peer-deps

# Khởi chạy server phát triển
npm start
# Ứng dụng sẽ chạy tại http://localhost:3000
```

### 2.2. Kiểm thử tự động trước khi triển khai
```bash
# Chạy toàn bộ 32 test cases với Jest
npm test -- --watchAll=false
```

---

## 3. Triển Khai Bằng Docker & Docker Compose (Khuyến Nghị Cho SME)

Nền tảng đã được cấu hình sẵn **Multi-stage Dockerfile** kết hợp Nginx Alpine tối ưu hóa bộ nhớ (< 30MB RAM khi hoạt động):

### 3.1. Khởi chạy 1-Click với Docker Compose
Tại thư mục gốc dự án:
```bash
# Khởi tạo và chạy container ở chế độ nền
docker compose up -d --build

# Kiểm tra trạng thái container
docker compose ps

# Xem nhật ký truy cập Nginx
docker compose logs -f
```
Ứng dụng sẽ khả dụng ngay tại: `http://localhost:3000`.

### 3.2. Dừng và dọn dẹp container
```bash
docker compose down
```

---

## 4. Triển Khai Lên Cụm Máy Chủ Kubernetes (K8s Production)

### 4.1. Build và Đẩy Docker Image lên Container Registry
```bash
# Đăng nhập vào Registry (Docker Hub, AWS ECR, hoặc Harbor nội bộ)
docker login registry.acmecorp.vn

# Build image với tag sản xuất
docker build -t registry.acmecorp.vn/selfheal/frontend:v1.0.0 ./frontend

# Đẩy image lên registry
docker push registry.acmecorp.vn/selfheal/frontend:v1.0.0
```

### 4.2. Khởi tạo K8s Deployment & Service Manifest
Tạo file manifest `selfheal-frontend.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: selfheal-frontend
  namespace: selfheal-system
  labels:
    app: selfheal-frontend
    tier: web
spec:
  replicas: 2
  selector:
    matchLabels:
      app: selfheal-frontend
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  template:
    metadata:
      labels:
        app: selfheal-frontend
    spec:
      containers:
        - name: frontend
          image: registry.acmecorp.vn/selfheal/frontend:v1.0.0
          imagePullPolicy: IfNotPresent
          ports:
            - containerPort: 80
          resources:
            requests:
              cpu: 50m
              memory: 64Mi
            limits:
              cpu: 200m
              memory: 256Mi
          readinessProbe:
            httpGet:
              path: /
              port: 80
            initialDelaySeconds: 5
            periodSeconds: 10
          livenessProbe:
            httpGet:
              path: /
              port: 80
            initialDelaySeconds: 15
            periodSeconds: 20
---
apiVersion: v1
kind: Service
metadata:
  name: selfheal-frontend-svc
  namespace: selfheal-system
spec:
  type: ClusterIP
  ports:
    - port: 80
      targetPort: 80
      protocol: TCP
  selector:
    app: selfheal-frontend
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: selfheal-frontend-ingress
  namespace: selfheal-system
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  tls:
    - hosts:
        - dashboard.selfheal.acmecorp.vn
      secretName: selfheal-tls-secret
  rules:
    - host: dashboard.selfheal.acmecorp.vn
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: selfheal-frontend-svc
                port:
                  number: 80
```

### 4.3. Áp dụng vào Cụm Máy Chủ
```bash
# Tạo namespace chuyên dụng
kubectl create namespace selfheal-system

# Áp dụng manifest
kubectl apply -f selfheal-frontend.yaml

# Kiểm tra trạng thái Pods và Ingress
kubectl get pods -n selfheal-system -l app=selfheal-frontend
kubectl get ingress -n selfheal-system
```

---

## 5. Tích Hợp Tác Tử Thu Thập Viễn Trắc eBPF (SelfHeal Agent)
Tác tử eBPF chạy dưới dạng `DaemonSet` trên mỗi Node của cụm K8s:
```bash
# Cài đặt qua Helm Chart nội bộ
helm repo add selfheal https://charts.selfheal.acmecorp.vn
helm repo update

# Cài đặt tác tử với API Key đã tạo trong trang Cài Đặt (/dashboard/settings)
helm install selfheal-agent selfheal/ebpf-agent \
  --namespace selfheal-system \
  --set apiKey="sh_live_9f82aa10e82c1b9942a" \
  --set clusterName="k8s-prod-cluster-01" \
  --set endpoint="https://api.k8s-prod.acmecorp.vn:6443"
```

---

## 6. Kiểm Soát & Bảo Mật Vận Hành
1. **SSL/TLS 1.3**: Bắt buộc cấu hình chứng chỉ HTTPS thông qua Cert-Manager Let's Encrypt hoặc chứng chỉ nội bộ.
2. **CORS & CSP**: Nginx cấu hình sẵn `X-Frame-Options SAMEORIGIN` và `X-Content-Type-Options nosniff`.
3. **Phân Quyền RBAC**: Đảm bảo phân quyền vai trò (SME Owner, DevOps, Viewer) theo đúng ma trận tại `/dashboard/organization/members`.
