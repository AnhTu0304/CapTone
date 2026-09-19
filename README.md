# CapTone Project

Hệ thống CapTone bao gồm các thành phần:
- `Main_backend/`: Node.js Express TypeScript (Mô hình MVC)
- `Frontend/`: Giao diện người dùng
- `AI_backend/`: Xử lý phân tích AI / RCA
- `Agent/`: Thu thập số liệu metrics / log giám sát

## Hướng dẫn chạy bằng Docker Container

### 1. Khởi động toàn bộ dịch vụ (PostgreSQL + Main_backend):
```bash
docker compose up -d --build
```

### 2. Xem logs hoạt động:
```bash
docker compose logs -f
```

### 3. Kiểm tra Health Check:
```bash
curl http://localhost:5000/api/v1/health
```

### 4. Dừng hệ thống:
```bash
docker compose down
```
*(Nếu muốn xóa sạch dữ liệu volume postgres để reset: `docker compose down -v`)*
