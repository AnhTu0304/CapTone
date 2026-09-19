# Main Backend (Node.js + TypeScript MVC)

Dự án backend sử dụng Express.js và TypeScript được tổ chức theo mô hình MVC (Model - View - Controller).

## Cấu trúc thư mục

```text
src/
├── config/             # Quản lý biến môi trường, kết nối cơ sở dữ liệu
├── controllers/        # Xử lý requests và trả về responses
├── middlewares/        # Middlewares (bảo mật, logging, xử lý lỗi)
├── models/             # Định nghĩa cấu trúc dữ liệu / schema
├── routes/             # Định tuyến URL API
├── services/           # Xử lý nghiệp vụ logic (Business logic)
├── utils/              # Các hàm tiện ích, chuẩn hóa response và error
├── views/              # View / Serializers
├── app.ts              # Cấu hình Express App
└── server.ts           # Khởi động HTTP Server
```

## Hướng dẫn cài đặt & chạy

### 1. Cài đặt dependencies
```bash
npm install
```

### 2. Thiết lập môi trường
File `.env` đã được chuẩn bị sẵn hoặc copy từ `.env.example`:
```env
PORT=5000
NODE_ENV=development
API_PREFIX=/api/v1
```

### 3. Chạy trong môi trường phát triển (Hot reload)
```bash
npm run dev
```

### 4. Build & Chạy Production
```bash
npm run build
npm start
```

## Endpoints khả dụng
- **Root:** `GET http://localhost:5000/`
- **Health Check:** `GET http://localhost:5000/api/v1/health`
