# SelfHeal Kubernetes Agent (Python Edition)

Bộ phần mềm giám sát hạ tầng và tự phục hồi (Self-Healing Sentinel) dành cho Kubernetes, được phát triển bằng **Python 3.11** cho nền tảng **SelfHeal — AI-Driven Proactive Self-Healing Infrastructure for SMEs**.

Agent hoạt động như một tiến trình ngầm nhẹ (daemon) chạy bên trong Kubernetes cluster của doanh nghiệp, liên tục thu thập telemetry (metrics, logs, events), che giấu dữ liệu nhạy cảm (redaction/masking) và truyền tải hai chiều (full-duplex) theo thời gian thực về SelfHeal Main Backend thông qua giao thức **WebSocket (`wss://` / `ws://`)**.

---

## 1. Điểm nổi bật & Tính năng chính

- **100% Python 3.11 & Asyncio**: Tận dụng thư viện bất đồng bộ hiệu năng cao (`asyncio`, `websockets`, `aiohttp`, `pydantic-settings`).
- **Giao thức WebSocket chuẩn**: Tương thích hoàn toàn với Main Backend SelfHeal:
  - Tự động gửi header `x-agent-token` và `Authorization: Bearer <token>`.
  - Hỗ trợ gửi thông điệp bắt tay `{"type": "auth", "token": "..."}`.
  - Tự động phản hồi khung `Pong` khi nhận được `Ping` từ Backend (RFC 6455).
  - Tự động dừng kết nối và cảnh báo bảo mật khi nhận mã `4001 Unauthorized` (tránh spam cluster).
  - Tự động kết nối lại (Auto-reconnect) với thuật toán Exponential Backoff + Jitter khi gặp sự cố mạng tạm thời.
  - Hàng đợi đệm (Message Queue Buffer) lưu giữ dữ liệu khi rớt mạng và tự động xả (flush) khi kết nối lại thành công.
- **Thu thập Metrics liên tục**: Polling chỉ số CPU (%), RAM (MB), Disk (%), số lượng container restarts, và số lượng bản sao (replicas). Tự động truy vấn `metrics.k8s.io` và có cơ chế fallback thông minh nếu cluster SME chưa cài đặt Metrics Server.
- **Thu thập & Phân loại Logs**: Đọc luồng stdout/stderr từ các Pod theo chu kỳ `since_seconds`, tự động phân loại mức độ nghiêm trọng (`error`, `warn`, `info`).
- **Lắng nghe cảnh báo Kubernetes Events**: Giám sát các sự kiện bất thường của Pod (`OOMKilled`, `CrashLoopBackOff`, `FailedScheduling`, `Unhealthy`, `BackOff`) và chuẩn hóa định dạng phục vụ AI phân tích nguyên nhân gốc (RCA).
- **Bảo mật tuyệt đối (Zero Token Leakage & Non-Root)**:
  - Tự động lọc sạch token, mật khẩu, private key, AWS access key trước khi gửi (`security/redaction.py`).
  - Container chạy dưới tài khoản không đặc quyền `appuser` (UID 10001).
  - RBAC tuân thủ nguyên tắc quyền tối thiểu (Least Privilege), chỉ có quyền ĐỌC (`get`, `list`, `watch`). Mặc định khóa hoàn toàn các thao tác thay đổi hạ tầng (`ENABLE_HEALING_ACTIONS=false`).
- **Tích hợp Health Probes**: Cung cấp HTTP server nội bộ tại cổng `:8080` phục vụ Kubernetes liveness probe (`/healthz`) và readiness probe (`/readyz`).

---

## 2. Cấu trúc thư mục mã nguồn

```text
Agent/
├── selfheal_agent/
│   ├── __init__.py
│   ├── main.py                  # Điểm khởi chạy chính & điều phối vòng lặp telemetry
│   ├── config.py                # Cấu hình Pydantic BaseSettings & validate môi trường
│   ├── authenticator.py         # Quản lý credentials, headers & không lộ token qua query param
│   ├── websocket_client.py      # WebSocket client async với auto-reconnect & queue buffer
│   ├── health.py                # HTTP server phục vụ liveness/readiness probes (:8080)
│   ├── collectors/
│   │   ├── __init__.py
│   │   ├── pods.py              # Thu thập thông tin Pods, limits, phases, restart count
│   │   ├── deployments.py       # Thu thập số lượng bản sao replicas mong muốn & hiện tại
│   │   ├── services.py          # Thu thập danh sách Services, ClusterIP, Ports, Selectors
│   │   ├── nodes.py             # Thu thập danh sách Nodes, trạng thái Ready/NotReady
│   │   ├── events.py            # Lắng nghe cảnh báo sự kiện cụm k8s (OOMKilled, BackOff...)
│   │   └── logs.py              # Đọc & phân loại container logs
│   ├── telemetry/
│   │   ├── __init__.py
│   │   ├── metrics.py           # MetricsManager: CPU, RAM, Replicas & Prometheus HTTP API
│   │   └── schemas.py           # Pydantic schemas cho bản tin WebSocket
│   └── utils/
│       ├── __init__.py
│       ├── logger.py            # Cấu hình log có cấu trúc
│       └── redaction.py         # Che giấu dữ liệu nhạy cảm & ẩn token
├── tests/
│   ├── test_config.py           # Kiểm thử cấu hình & validation
│   ├── test_schemas.py          # Kiểm thử schemas & envelopes
│   ├── test_redaction.py        # Kiểm thử bộ lọc chuỗi nhạy cảm
│   ├── test_collectors.py       # Kiểm thử pods, deployments, events, logs
│   ├── test_prometheus.py       # Kiểm thử tích hợp Prometheus telemetry
│   └── test_websocket.py        # Kiểm thử bắt tay WebSocket, buffer, lỗi 4001
├── installer/
│   ├── install-agent.sh         # Bộ cài tự động cho Linux/macOS
│   ├── install-agent.ps1        # Bộ cài tự động cho Windows PowerShell
│   ├── uninstall-agent.sh       # Bộ gỡ cài đặt cho Linux/macOS
│   └── uninstall-agent.ps1      # Bộ gỡ cài đặt cho Windows PowerShell
├── installer_service/           # FastAPI Service phân phối bộ cài (Port 8100)
│   ├── main.py                  # Điểm khởi chạy FastAPI app
│   ├── config.py                # Cấu hình cổng, đường dẫn, version
│   ├── routers/installer.py     # Endpoints cấp script (.sh, .ps1) & checksums
│   ├── tests/                   # Kiểm thử bảo mật (Path traversal, checksums)
│   ├── Dockerfile               # Container đóng gói Installer API
│   └── requirements.txt         # FastAPI, uvicorn, pydantic-settings
├── deploy/
│   └── helm/
│       └── selfheal-agent/       # Helm Chart chuẩn hóa để phát hành
│           ├── Chart.yaml
│           ├── values.yaml
│           └── templates/
│               ├── deployment.yaml
│               ├── serviceaccount.yaml
│               ├── rbac.yaml
│               └── secret.yaml
├── Dockerfile                   # Multi-stage build (Python 3.11-slim, non-root)
├── requirements.txt             # Khai báo thư viện phụ thuộc
├── pyproject.toml               # Cấu hình package & pytest
├── SECURITY.md                  # Chính sách bảo mật & phân quyền RBAC
└── README.md
```

---

## 3. Cài đặt nhanh cho Khách hàng / Doanh nghiệp (Distribution Installer)

Bộ cài được đóng gói sẵn để Quản trị viên Doanh nghiệp có thể triển khai lên Kubernetes Cluster trong 1 lệnh duy nhất.

### 3.1. Dành cho Linux / macOS (Bash)

1. Mở Terminal trên máy đã cấu hình quyền truy cập cụm Kubernetes (`kubectl` và `helm`).
2. Chuyển vào thư mục `Agent/installer/` và chạy lệnh:

```bash
chmod +x installer/install-agent.sh
./installer/install-agent.sh
```

3. Bộ cài sẽ tự động:
   - Kiểm tra `kubectl`, `helm` và hiển thị context cụm hiện tại để người dùng xác nhận.
   - Yêu cầu nhập URL Main Backend (VD: `wss://backend.captone.ai/api/v1/agent/connect`).
   - Yêu cầu nhập Agent Token (ký tự được ẩn hoàn toàn trên màn hình terminal).
   - Tự động tạo Namespace `selfheal-system`.
   - Khởi tạo Kubernetes Secret và tiến hành `helm upgrade --install`.
   - Theo dõi trạng thái triển khai Pod cho đến khi sẵn sàng (`kubectl rollout status`).

### 3.2. Dành cho Windows (PowerShell)

Mở PowerShell với quyền Administrator hoặc Developer:

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process
.\installer\install-agent.ps1
```

*(Bộ cài PowerShell hỗ trợ nhập token bảo mật bằng `Read-Host -AsSecureString` và tự động xác thực context cluster).*

### 3.3. Gỡ bỏ Agent khi cần thiết (Uninstall)

- **Linux / macOS**:
  ```bash
  ./installer/uninstall-agent.sh
  ```
- **Windows**:
  ```powershell
  .\installer\uninstall-agent.ps1
  ```

---

## 4. Triển khai thủ công bằng Helm Chart

Nếu doanh nghiệp quản lý hạ tầng qua CI/CD (GitOps, ArgoCD, Flux):

```bash
# Thêm secret chứa token của Agent
kubectl create namespace selfheal-system --dry-run=client -o yaml | kubectl apply -f -

kubectl create secret generic selfheal-agent-secret \
  --namespace selfheal-system \
  --from-literal=AGENT_TOKEN="cap_live_your_actual_token_here" \
  --dry-run=client -o yaml | kubectl apply -f -

# Cài đặt qua Helm Chart
helm upgrade --install selfheal-agent ./deploy/helm/selfheal-agent \
  --namespace selfheal-system \
  --set config.agentServerUrl="wss://backend.your-company.com/api/v1/agent/connect" \
  --set secret.existingSecret="selfheal-agent-secret" \
  --set config.k8sNamespace="default" \
  --set config.monitorAllNamespaces="true"
```

---

## 5. Bảng tham số cấu hình (Environment Variables)

| Biến môi trường | Kiểu | Mặc định | Ý nghĩa & Mô tả |
|---|---|---|---|
| `AGENT_SERVER_URL` | string | *Bắt buộc* | Địa chỉ WebSocket của Main Backend (`ws://...` hoặc `wss://...`) |
| `AGENT_TOKEN` | string | *Bắt buộc* | Token xác thực của Agent do SelfHeal cấp |
| `AGENT_UID` | string | `selfheal-agent-default` | Mã định danh của phiên bản Agent |
| `CLUSTER_ID` | string | `None` | ID của cụm Kubernetes trên hệ thống SelfHeal |
| `ENVIRONMENT_ID` | string | `None` | ID môi trường (Production, Staging, v.v.) |
| `METRICS_INTERVAL_MS`| int | `5000` | Chu kỳ thu thập metrics (ms, tối thiểu 1000) |
| `LOG_COLLECTION_INTERVAL_MS` | int | `5000` | Chu kỳ thu thập container logs (ms, tối thiểu 1000) |
| `K8S_NAMESPACE` | string | `default` | Namespace giám sát khi `MONITOR_ALL_NAMESPACES=false` |
| `MONITOR_ALL_NAMESPACES`| bool | `false` | Giám sát tất cả các namespace trên toàn bộ cluster |
| `LOG_LEVEL` | string | `INFO` | Mức log ứng dụng (`DEBUG`, `INFO`, `WARNING`, `ERROR`) |
| `KUBECONFIG_PATH` | string | `None` | Đường dẫn file kubeconfig tùy chọn (khi dev cục bộ) |
| `ENABLE_HEALING_ACTIONS` | bool | `false` | Khóa an toàn: Phải bật rõ ràng mới cho phép tự khắc phục sự cố |
| `HEALTH_PORT` | int | `8080` | Cổng HTTP phục vụ probe `/healthz` và `/readyz` |
| `QUEUE_MAX_SIZE` | int | `500` | Dung lượng tối đa của hàng đợi đệm khi mất mạng |

---

## 6. Chạy thử nghiệm cục bộ (Local Development)

### Điều kiện tiên quyết
- Python >= 3.11
- File cấu hình `~/.kube/config` trỏ tới một Kubernetes cluster (Minikube, Kind, Docker Desktop K8s, k3s, EKS, GKE, AKS).

### Các bước thực hiện:

```bash
cd Agent

# 1. Tạo và kích hoạt môi trường ảo Python
python -m venv .venv
# Trên Linux/macOS:
source .venv/bin/activate
# Trên Windows PowerShell:
.\.venv\Scripts\Activate.ps1

# 2. Cài đặt thư viện phụ thuộc
pip install -r requirements.txt

# 3. Tạo file cấu hình .env cục bộ
# Tạo file .env với nội dung:
# AGENT_SERVER_URL=ws://localhost:5000/api/v1/agent/connect
# AGENT_TOKEN=cap_test_token_123456
# K8S_NAMESPACE=default

# 4. Khởi chạy Agent
python -m selfheal_agent.main
```

---

## 7. Chạy kiểm thử tự động (Automated Testing)

Agent đi kèm bộ kiểm thử toàn diện với **25 bài test** viết bằng `pytest` và `pytest-asyncio`, kiểm tra 100% các luồng nghiệp vụ quan trọng:

```bash
# Chạy toàn bộ test suite
pytest tests -v
```

Kết quả:
```text
tests/test_collectors.py::test_parse_cpu_to_millicores PASSED
tests/test_collectors.py::test_parse_memory_to_bytes PASSED
tests/test_collectors.py::test_metrics_collector PASSED
tests/test_collectors.py::test_log_collector PASSED
tests/test_collectors.py::test_event_collector PASSED
tests/test_config.py::test_valid_config PASSED
tests/test_config.py::test_wss_scheme_supported PASSED
tests/test_config.py::test_invalid_scheme_rejected PASSED
tests/test_config.py::test_missing_token_rejected PASSED
tests/test_config.py::test_empty_token_rejected PASSED
tests/test_config.py::test_load_config_with_overrides PASSED
tests/test_config.py::test_mask_token PASSED
tests/test_protocol.py::test_metrics_message_serialization PASSED
tests/test_protocol.py::test_log_message_serialization PASSED
tests/test_protocol.py::test_event_message_serialization PASSED
tests/test_protocol.py::test_auth_message PASSED
tests/test_protocol.py::test_incoming_models PASSED
tests/test_redaction.py::test_redact_bearer_token PASSED
tests/test_redaction.py::test_redact_password_and_secret PASSED
tests/test_redaction.py::test_redact_captone_token PASSED
tests/test_redaction.py::test_redact_aws_access_key PASSED
tests/test_redaction.py::test_clean_string_remains_unchanged PASSED
tests/test_websocket.py::test_offline_queue_buffering PASSED
tests/test_websocket.py::test_websocket_auth_handshake_and_flush PASSED
tests/test_websocket.py::test_unauthorized_token_triggers_fatal_halt PASSED
============================= 25 passed in 1.19s ==============================
```

---

## 8. Đóng gói Docker Image

```bash
# Build image
docker build -t selfheal-agent:1.0.0 .

# Chạy container thử nghiệm với Kubeconfig máy chủ
docker run --rm \
  -e AGENT_SERVER_URL="ws://host.docker.internal:5000/api/v1/agent/connect" \
  -e AGENT_TOKEN="cap_test_token_123456" \
  -v "$HOME/.kube/config:/home/appuser/.kube/config:ro" \
  -p 8080:8080 \
  selfheal-agent:1.0.0
```

---

## 9. Khắc phục sự cố thường gặp (Troubleshooting)

1. **Lỗi `4001 Unauthorized`**:
   - *Hiện tượng*: Agent ngắt kết nối và ghi log: `Halting WebSocket reconnection loop due to invalid AGENT_TOKEN (4001 Unauthorized)`.
   - *Nguyên nhân*: Token cấu hình sai, hết hạn hoặc chưa được kích hoạt trên SelfHeal Dashboard.
   - *Xử lý*: Kiểm tra lại token được cấp và cập nhật Secret trong Kubernetes (`kubectl edit secret selfheal-agent-secret -n selfheal-system`).

2. **Metrics không hiển thị số liệu thực tế**:
   - *Hiện tượng*: Chỉ số CPU/RAM ở mức baseline (5%, 64MB).
   - *Nguyên nhân*: Cụm Kubernetes của khách hàng chưa cài đặt `metrics-server`.
   - *Xử lý*: Cài đặt Metrics Server trên cụm bằng lệnh:
     ```bash
     kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
     ```

3. **Mất kết nối mạng tạm thời (Network Blips)**:
   - *Xử lý*: Agent tự động chuyển dữ liệu đo đạc vào bộ nhớ đệm (Queue Buffer tối đa 500 bản ghi) và tự động tái kết nối theo thuật toán Exponential Backoff. Khi mạng phục hồi, toàn bộ dữ liệu đệm được tự động xả về Backend mà không bị mất mát.
