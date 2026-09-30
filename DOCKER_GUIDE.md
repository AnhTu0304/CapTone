# Hướng Dẫn Chi Tiết Khởi Chạy Hệ Thống CapTone Bằng Docker

Tài liệu này hướng dẫn chi tiết từng bước cách khởi chạy, cấu hình, kiểm tra và gỡ lỗi (troubleshooting) toàn bộ 5 dịch vụ của hệ thống **CapTone** bằng **Docker & Docker Compose**.

---

## 📌 Danh Sách Dịch Vụ Trong Hệ Thống

| Dịch Vụ | Container Name | Cổng Expose (Host : Container) | Chức Năng |
|---|---|---|---|
| **postgres** | `captone-postgres` | `5432:5432` | Cơ sở dữ liệu chính PostgreSQL 16 (kèm volume lưu trữ) |
| **main-backend** | `captone-main-backend` | `5000:5000` | Node.js Express TypeScript MVC API |
| **ai-backend** | `captone-ai-backend` | `8000:8000` | FastAPI PyTorch GRU (12 timesteps) & Multi-Agent RCA |
| **selfheal-frontend** | `selfheal_platform_web` | `3000:80` | Giao diện React 19 tối ưu qua Web Server Nginx Alpine |
| **selfheal-agent** | `selfheal_k8s_agent` | *Mạng nội bộ* | Daemon giám sát K8s, gửi nhịp tim Heartbeat định kỳ |

Tất cả các dịch vụ kết nối với nhau qua mạng nội bộ Docker: `captone-network`.

---

## 1. Yêu Cầu Chuẩn Bị (Prerequisites)

1. **Docker & Docker Compose**:
   - Cài đặt [Docker Desktop](https://www.docker.com/products/docker-desktop/) (khuyến nghị phiên bản v24+ hoặc mới nhất).
   - Đảm bảo Docker Desktop đang ở trạng thái **Running** (biểu tượng cá voi màu xanh ở góc màn hình taskbar).
2. **Kiểm tra cổng trống**:
   - Đảm bảo các cổng sau trên máy của bạn chưa bị chiếm dụng bởi ứng dụng khác:
     - `3000` (Frontend)
     - `5000` (Main Backend)
     - `8000` (AI Backend)
     - `5432` (PostgreSQL)

Kiểm tra nhanh Docker trên máy qua Terminal / PowerShell:
```powershell
docker --version
docker compose version
```

---

## 2. Khởi Chạy Toàn Bộ Hệ Thống (Khuyến Nghị)

### Bước 1: Mở Terminal tại thư mục gốc `CapTone`
```powershell
cd D:\NCKH\CapTone
```

### Bước 2: Build và Khởi động tất cả 5 dịch vụ ở chế độ chạy ngầm (`-d`)
```powershell
docker compose up -d --build
```
> **Giải thích tham số:**
> - `-d` (detached mode): Chạy ngầm trong nền, không chiếm dụng cửa sổ dòng lệnh.
> - `--build`: Tự động biên dịch lại Docker image nếu có thay đổi mã nguồn mới.

### Bước 3: Kiểm tra trạng thái các container
```powershell
docker compose ps
```
Kết quả hiển thị trạng thái `Up` hoặc `Up (healthy)` cho cả 5 container:
```text
NAME                    IMAGE                         STATUS                    PORTS
captone-postgres        postgres:16-alpine            Up (healthy)              0.0.0.0:5432->5432/tcp
captone-main-backend    captone-main-backend          Up (healthy)              0.0.0.0:5000->5000/tcp
captone-ai-backend      captone-ai-backend            Up (healthy)              0.0.0.0:8000->8000/tcp
selfheal_platform_web   captone-selfheal-frontend     Up (healthy)              0.0.0.0:3000->80/tcp
selfheal_k8s_agent      captone-selfheal-agent        Up                        -
```

### Bước 4: Truy cập các dịch vụ qua trình duyệt:
- **Giao diện Người dùng (Frontend)**: 👉 [http://localhost:3000](http://localhost:3000)
- **API Sức khỏe Main Backend**: 👉 [http://localhost:5000/api/v1/health](http://localhost:5000/api/v1/health)
- **Tài liệu API AI Backend (Swagger/OpenAPI)**: 👉 [http://localhost:8000/docs](http://localhost:8000/docs)
- **API Sức khỏe AI Backend**: 👉 [http://localhost:8000/health](http://localhost:8000/health)

---

## 3. Khởi Chạy Từng Dịch Vụ Riêng Lẻ

Nếu bạn đang phát triển một thành phần cụ thể và không muốn bật toàn bộ các service:

### Chỉ khởi chạy Database + Main Backend:
```powershell
docker compose up -d postgres main-backend
```

### Chỉ khởi chạy AI Backend:
```powershell
docker compose up -d ai-backend
```

### Chỉ khởi chạy Giao diện Frontend:
```powershell
docker compose up -d selfheal-frontend
```

### Chỉ khởi chạy Kubernetes Agent:
```powershell
docker compose up -d selfheal-agent
```

---

## 4. Xem Nhật Ký Hoạt Động (Logs)

Theo dõi luồng xử lý hoặc kiểm tra lỗi thời gian thực bằng cờ `-f` (follow):

```powershell
# Xem logs toàn bộ hệ thống
docker compose logs -f

# Xem logs riêng Frontend
docker compose logs -f selfheal-frontend

# Xem logs riêng Main Backend
docker compose logs -f main-backend

# Xem logs riêng AI Backend (Mô hình GRU & RCA)
docker compose logs -f ai-backend

# Xem logs riêng SelfHeal Agent (Nhịp tim Heartbeat & Discovery)
docker compose logs -f selfheal-agent
```

---

## 5. Chạy Kiểm Thử Đơn Vị Tự Động Trong Docker

Bạn có thể chạy trực tiếp các bài kiểm thử bên trong container cô lập:

### Kiểm thử Agent (6 Unit Tests):
```powershell
docker build --target test -t selfheal-agent:test -f selfheal-agent/Dockerfile selfheal-agent
```

---

## 6. Dừng & Dọn Dẹp Hệ Thống

### Dừng các container nhưng vẫn giữ lại dữ liệu Database:
```powershell
docker compose down
```

### Dừng và xóa sạch toàn bộ dữ liệu Database (Reset về trạng thái ban đầu):
```powershell
docker compose down -v
```

### Dọn dẹp các image hoặc build cache cũ nếu ổ cứng đầy:
```powershell
docker system prune -f
```

---

## 7. Xử Lý Các Sự Cố Thường Gặp (Troubleshooting)

### ⚠️ Lỗi 1: Xung đột cổng `Bind for 0.0.0.0:5432 failed: port is already allocated`
- **Nguyên nhân**: Máy tính của bạn đã có một phiên bản PostgreSQL cài trực tiếp trên Windows hoặc một container khác đang chiếm cổng `5432`.
- **Cách khắc phục**:
  1. Mở file `.env` (hoặc tạo file `.env` tại thư mục gốc `CapTone`).
  2. Đổi cổng host sang cổng khác, ví dụ: `DB_PORT=5435`.
  3. Hoặc dừng container PostgreSQL cũ đang chạy bằng lệnh: `docker stop <tên_container_cũ>`.

### ⚠️ Lỗi 2: Docker daemon không phản hồi (`error during connect: open //./pipe/docker_engine`)
- **Nguyên nhân**: Phần mềm Docker Desktop chưa được bật.
- **Cách khắc phục**: Mở ứng dụng **Docker Desktop** trên Windows và chờ 1-2 phút cho đến khi góc dưới bên trái chuyển sang màu xanh lá cây ("Engine running").

### ⚠️ Lỗi 3: Cập nhật code mới nhưng Docker vẫn chạy bản cũ
- **Nguyên nhân**: Docker sử dụng cache của lần build trước.
- **Cách khắc phục**: Buộc Docker build lại từ đầu không dùng cache:
  ```powershell
  docker compose build --no-cache
  docker compose up -d
  ```

### ⚠️ Lỗi 4: Agent báo `Unable to connect to SelfHeal Backend at http://main-backend:5000`
- **Nguyên nhân bình thường khi khởi động**: Main Backend cần 5-10 giây để chờ PostgreSQL sẵn sàng và khởi động HTTP Server.
- **Tính năng bền bỉ (Resilience)**: Agent được thiết kế tự động retry liên tục với cơ chế exponential backoff, ngay khi backend sẵn sàng, agent sẽ tự động bắt tay thành công mà không cần can thiệp.

---

*(Tài liệu này được đồng bộ cùng dự án CapTone)*
