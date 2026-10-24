# CHÍNH SÁCH BẢO MẬT & QUY TẮC AN TOÀN - CAPTONE KUBERNETES AGENT

Tài liệu này quy định các tiêu chuẩn an toàn thông tin và bảo mật hạ tầng khi doanh nghiệp tích hợp **SelfHeal Kubernetes Agent** vào cụm máy chủ Kubernetes.

---

## 1. Nguyên tắc đặc quyền tối thiểu (Least Privilege RBAC)

SelfHeal Agent được thiết kế để giám sát và bảo vệ hạ tầng với mức quyền hạn thấp nhất có thể:

- **KHÔNG cấp quyền `cluster-admin`**: Agent chỉ sử dụng ServiceAccount có quyền `get`, `list`, `watch` trên các tài nguyên cần thiết (`pods`, `pods/log`, `events`, `nodes`, `namespaces`, `services`, `deployments`, `replicasets`).
- **Quyền Read-Only mặc định**: Bản phát hành tiêu chuẩn của Agent **chỉ đọc dữ liệu** (Metrics, Logs, Events) và tuyệt đối không có quyền sửa đổi hay xóa workload ứng dụng của doanh nghiệp.
- **Tự động phục hồi có kiểm soát (Self-Healing Guard)**: Chức năng can thiệp tự động (`RESTART_POD`, `SCALE_REPLICAS`) **mặc định bị tắt (`ENABLE_HEALING_ACTIONS=false`)**. Doanh nghiệp chỉ kích hoạt khi đã kiểm duyệt và cấp quyền RoleBinding ghi (`patch`) cụ thể trên `apps/deployments` và `apps/deployments/scale`.
- **Hỗ trợ Namespace-Scoped Role**: Cho phép triển khai qua Helm với `rbac.clusterScope=false` tạo `Role` và `RoleBinding` thu hẹp phạm vi trong 1 namespace duy nhất.

---

## 2. Bảo vệ Thông tin Bí mật & Token (Zero Secret Leakage)

- **Quản lý Token qua Kubernetes Secret**: `AGENT_TOKEN` được lưu trữ độc quyền trong Kubernetes Secret (`selfheal-agent-secret`) và inject vào Pod qua biến môi trường.
- **Không lưu Token trong Image hoặc Git**: Dockerfile và Helm Chart không bao giờ chứa token mặc định. File `.dockerignore` và `.gitignore` chặn toàn bộ file `.env`.
- **Tự động Redact trong Log**: Hệ thống ghi log được cấu hình tự động ẩn (`[REDACTED]`) các trường nhạy cảm (`token`, `password`, `secret`, `headers.x-agent-token`, `authorization`) trước khi ghi ra stdout.
- **Không hiển thị Token trên Terminal**: Bộ cài đặt (`install-agent.sh` và `install-agent.ps1`) sử dụng cơ chế nhập mật khẩu ẩn (`stty -echo` / `SecureString`), đảm bảo token không bị lộ qua lịch sử Terminal (Bash history) hay danh sách tiến trình (`ps aux`).

---

## 3. An toàn mạng & Mã hóa đường truyền (Transport Security)

- **Mã hóa TLS/WSS**: Trong môi trường Production, Agent bắt buộc kết nối qua giao thức bảo mật `wss://` (WebSocket over TLS).
- **Xác thực chứng chỉ số (Strict Certificate Validation)**: Agent không tắt kiểm tra chứng chỉ SSL/TLS, ngăn chặn hoàn toàn tấn công giả mạo (Man-in-the-Middle).
- **Không mở cổng inbound (Zero Inbound Ports)**: Agent chỉ mở kết nối outbound (đi ra ngoài) tới Main Backend của SelfHeal. Cụm Kubernetes của doanh nghiệp **không cần mở bất kỳ cổng firewall hay IP Public nào**, bảo vệ mạng nội bộ an toàn 100%.

---

## 4. Cô lập Tiến trình trong Container (Container Hardening)

- **Chạy phi đặc quyền (Non-Root User)**: Container Agent chạy dưới người dùng `appuser` (UID 10001, GID 10001), không chạy bằng `root`.
- **Hệ thống tệp chỉ đọc (Read-Only Root Filesystem)**: Kích hoạt `readOnlyRootFilesystem: true` cùng thư mục tạm `/tmp` mount qua `emptyDir`, ngăn chặn việc ghi đè mã nguồn hoặc cài cắm file thực thi độc hại.
- **Loại bỏ đặc quyền Linux (Drop Capabilities)**: Cấu hình `capabilities.drop: ["ALL"]` và `allowPrivilegeEscalation: false` triệt tiêu mọi khả năng leo thang đặc quyền bên trong Pod.
- **Hồ sơ Seccomp mặc định (RuntimeDefault Seccomp)**: Kích hoạt `seccompProfile.type: RuntimeDefault` tuân thủ chuẩn Kubernetes Pod Security Standards (PSS) cấp độ Restricted.
- **Giới hạn tài nguyên (Resource Requests & Limits)**: Cấu hình mặc định CPU Request 50m / Limit 200m và Memory Request 64Mi / Limit 256Mi, ngăn chặn nguy cơ Agent chiếm dụng tài nguyên của ứng dụng nghiệp vụ khi cụm bị nghẽn.

---

## 5. Quy trình thu hồi Token khi có sự cố lộ lọt (Token Revocation & Rotation)

Nếu doanh nghiệp nghi ngờ Agent Token bị rò rỉ:

1. **Thông báo Quản trị viên SelfHeal**: Quản trị viên SelfHeal sẽ truy cập hệ thống và thực hiện **Revoke (Thu hồi)** token tương ứng trong bảng `agent_tokens`. Ngay lập tức, kết nối WebSocket sẽ bị cắt với mã lỗi `4001 Unauthorized`.
2. **Cấp Token mới**: Hệ thống SelfHeal sinh token mới cho doanh nghiệp.
3. **Cập nhật lại cụm Kubernetes**: Doanh nghiệp chỉ cần cập nhật lại Secret trên Kubernetes bằng lệnh:
   ```bash
   kubectl create secret generic selfheal-agent-secret \
     --namespace selfheal-system \
     --from-literal=AGENT_TOKEN="<TOKEN_MOI>" \
     --dry-run=client -o yaml | kubectl apply -f -
   
   # Khởi động lại Pod để nhận token mới
   kubectl rollout restart deployment/selfheal-agent -n selfheal-system
   ```
