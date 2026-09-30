# CapTone — Nền Tảng Tự Phục Hồi Hạ Tầng Tự Động Hóa (Autonomous Self-Healing Infrastructure)

> **Hệ thống AI-driven Proactive Incident Prevention & Self-Healing cho cụm Kubernetes (K8s) dành cho doanh nghiệp vừa và nhỏ (SME).**  
> Tích hợp giao diện **Greptile Blueprint Design System**, đồ họa **3D Interactive Telemetry**, mô hình dự báo rủi ro sớm **PyTorch GRU (12 timesteps)** và chu trình tự chữa lành khép kín **MAPE-K Loop**.

---

## 📑 Mục Lục
1. [Tổng Quan Kiến Trúc Hệ Thống](#1-tổng-quan-kiến-trúc-hệ-thống)
2. [Chi Tiết Các Thành Phần Cốt Lõi](#2-chi-tiết-các-thành-phần-cốt-lõi)
   - [Frontend (Giao diện Kỹ thuật cao React 19)](#21-frontend-giao-diện-kỹ-thuật-cao-react-19)
   - [Main Backend (Node.js Express TypeScript MVC)](#22-main-backend-nodejs-express-typescript-mvc)
   - [AI Backend (FastAPI + GRU Multi-Label + Multi-Agent RCA)](#23-ai-backend-fastapi--gru-multi-label--multi-agent-rca)
   - [Hạ Tầng Triển Khai K8s](#24-hạ-tầng-triển-khai-k8s)
3. [Cấu Trúc Thư Mục Toàn Dự Án](#3-cấu-trúc-thư-mục-toàn-dự-án)
4. [Hướng Dẫn Khởi Chạy & Vận Hành](#4-hướng-dẫn-khởi-chạy--vận-hành)
   - [4.1. Khởi chạy Frontend](#41-khởi-chạy-frontend)
   - [4.2. Khởi chạy Main Backend](#42-khởi-chạy-main-backend)
   - [4.3. Khởi chạy AI Backend](#43-khởi-chạy-ai-backend)
   - [4.4. Triển khai bằng Docker / Docker Compose](#44-triển-khai-bằng-docker--docker-compose)
5. [Chu Trình Tự Phục Hồi (MAPE-K Loop)](#5-chu-trình-tự-phục-hồi-mape-k-loop)
6. [Tài Liệu Kỹ Thuật Tham Chiếu Khác](#6-tài-liệu-kỹ-thuật-tham-chiếu-khác)

---

## 1. Tổng Quan Kiến Trúc Hệ Thống

Hệ thống **CapTone** hoạt động như một bộ não điều phối tự phục hồi toàn diện cho hạ tầng microservices:

```text
[ Cụm Kubernetes / Workloads / Pods ]
               │
               ▼ (Thu thập số liệu Metrics, Logs, K8s Events)
[ Agent & Telemetry Pipeline ]
               │
               ▼
[ Main Backend ] ──(12 timesteps x 8 features)──► [ AI Backend (FastAPI) ]
  (Express TS MVC)                                 ├── Mô hình PyTorch GRU (Dự báo rủi ro sớm)
  ├── Quản trị Incidents & Actions                 └── Multi-Agent RCA (Phân tích nguyên nhân gốc)
  ├── PostgreSQL Database                                   │
  └── Policy & Healing Engine ◄──(RCA + Khuyến nghị Action)──┘
               │
               ▼ (Chấp thuận / Tự động thực thi Self-Healing: Restart, Scale, Rollback...)
[ Kubernetes Cluster ]
               ▲
               │ (Hiển thị thời gian thực, điều khiển 3D, phê duyệt can thiệp)
[ Frontend (React 19 - Greptile Blueprint Design System) ]
```

---

## 2. Chi Tiết Các Thành Phần Cốt Lõi

### 2.1. Frontend (Giao diện Kỹ thuật cao React 19)
- **Công nghệ**: React 19, JavaScript ES6+, Lucide Icons, GSAP Animation, Three.js & CSS 3D Transforms.
- **Phong cách thiết kế Blueprint Greptile**:
  - Hình khối góc cạnh dứt khoát (`border-radius: 0px`).
  - Hệ màu sắc kỹ thuật: Canvas xi măng nhẹ (`#EEEEEE`), Navy cơ sở (`#3D3B4F`), Mint điện tử (`#28E99F`), Trắng tuyết (`#FFFFFF`).
  - Đường lưới kỹ thuật (Blueprint Grid 24px), kẻ nét đứt `1px dashed`, dấu định vị chữ thập 4 góc (`+` crosshairs), chốt định vị Datum Tab và bu-lông Anchor.
  - Chuẩn chiều rộng tối đa `--content-max-width: 1400px` với rãnh căn chỉnh milimét (Gutter Rails).
- **Các phân hệ màn hình nổi bật**:
  - **Trang chủ & Features**: Trình diễn mô hình không gian 3D tương tác (`HeroDashboardLive`, `AIPredictionCore3D`, `RootCauseAnalysis3D`, `SelfHealingDrone3D`).
  - **Onboarding & Login**: Chu trình 7 bước khởi tạo với hiệu ứng nở hoa Mini Dashboard Bloom.
  - **Giám sát (Monitoring)**: Metrics trực quan, Logs luồng phân tích, Sự kiện K8s Events.
  - **Cảnh báo & RCA (Incidents)**: Quản lý sự cố, Modal phân tích Root Cause với cây chứng cứ trực quan.
  - **Dự báo AI (AI Predictions)**: Dự đoán trước nguy cơ rủi ro dựa trên cửa sổ trượt GRU 12 điểm.
  - **Tự chữa lành (Self-Healing)**: Lập chính sách tự động (Policies), hàng đợi phê duyệt (Approvals), lịch sử hành động (Action History).
  - **Quản trị hệ thống (Admin & Organizations)**: Quản lý tổ chức, thành viên, báo cáo tăng trưởng và platform health.

### 2.2. Main Backend (Node.js Express TypeScript MVC)
- **Công nghệ**: Node.js, Express.js, TypeScript, PostgreSQL (`pg` pool).
- **Mô hình kiến trúc**: MVC (Model - Controller - Service - Routes) tường minh, chuẩn hóa API RESTful.
- **Nhiệm vụ chính**:
  - Quản trị người dùng, công ty, phân quyền tổ chức (`auth`, `user`, `company`).
  - Lưu trữ trạng thái hạ tầng: Cụm (`clusters`), Nodes, Pods, Deployments, Services.
  - Tiếp nhận và lưu trữ luồng Metrics, Logs, K8s Events.
  - Quản lý vòng đời sự cố (`incidents`), kích hoạt phân tích RCA sang AI Backend.
  - Quản lý chính sách tự phục hồi (`healing`), phê duyệt thủ công/tự động, lưu vết Audit Logs.
- **Cổng mặc định**: `5000` (Prefix: `/api/v1`).

### 2.3. AI Backend (FastAPI + GRU Multi-Label + Multi-Agent RCA)
- **Công nghệ**: Python 3.10+, FastAPI, PyTorch, Pydantic v2, Scikit-learn, Uvicorn.
- **Mô hình GRU Chuỗi Thời Gian**:
  - Nhận chuỗi quan sát chuẩn xác **12 timestep × 8 features** (`cpu`, `ram`, `disk`, `request_rate`, `latency`, `http_5xx_rate`, `pod_restart_count`, `replica_count`).
  - Dự báo đa nhãn (Multi-Label) cho 6-7 loại rủi ro: `CPU_OVERLOAD`, `OOM`, `DISK_FULL`, `HIGH_LATENCY`, `HTTP_5XX_SPIKE`, `TRAFFIC_OVERLOAD`.
  - Bộ chuẩn hóa Scaler và ngưỡng Threshold động tích hợp sẵn trong checkpoint.
- **Cơ chế Multi-Agent RCA (Root Cause Analysis)**:
  - Phân tích đa tác tử: `MetricsAgent`, `LogAgent`, `KubernetesAgent`, `HistoricalIncidentAgent`, `RCAAgent`, `RecommendationAgent`.
  - Hỗ trợ OpenAI Structured Outputs và bộ máy suy diễn tất định (Deterministic Fallback) an toàn tuyệt đối.
  - Đưa ra đúng 1 khuyến nghị hành động tối ưu kèm giải thích và độ tin cậy.
- **Cổng mặc định**: `8000`.

### 2.4. Hạ Tầng Triển Khai K8s
- Cung cấp sẵn các tệp manifest trong `k8s/`:
  - `namespace.yaml`: Thiết lập namespace cô lập `selfheal-platform`.
  - `postgres.yaml`: Triển khai StatefulSet/Deployment cho PostgreSQL kèm PersistentVolumeClaim.
  - `backend.yaml`: Triển khai dịch vụ backend và cấu hình kết nối mạng nội bộ Service/Ingress.

---

## 3. Cấu Trúc Thư Mục Toàn Dự Án

```text
CapTone/
├── frontend/                     # [MỚI CẬP NHẬT] Giao diện React 19 Blueprint Greptile
│   ├── public/                   # Tài nguyên tĩnh, favicon, manifest
│   ├── src/
│   │   ├── components/           # UI components tái sử dụng (Button, Table, MetricCard, 3D...)
│   │   ├── context/              # Quản lý state toàn cục (Auth, Theme...)
│   │   ├── hooks/                # Custom React Hooks
│   │   ├── layouts/              # Bố cục trang chính (Sidebar, Header, MainLayout)
│   │   ├── pages/                # Các trang (Home, Dashboard, Incidents, AI, SelfHealing...)
│   │   ├── routes/               # Hệ thống định tuyến ứng dụng
│   │   ├── services/             # Giao tiếp HTTP API với backend
│   │   ├── styles/               # CSS Tokens (design-tokens.css, dashboard-tokens.css, globals.css)
│   │   └── utils/                # Hàm tiện ích xuất báo cáo, format dữ liệu
│   ├── docs/                     # Tài liệu đặc tả kỹ thuật Frontend
│   ├── Dockerfile                # Đóng gói Frontend với Nginx Alpine
│   ├── nginx.conf                # Cấu hình máy chủ web Nginx phục vụ SPA
│   └── package.json              # Khai báo thư viện & dependencies
│
├── Main_backend/                 # Dịch vụ Backend lõi (Node.js Express TypeScript)
│   ├── src/
│   │   ├── config/               # Cấu hình môi trường và Database PostgreSQL
│   │   ├── controllers/          # Bộ điều khiển tiếp nhận Request / Response
│   │   ├── middlewares/          # Xác thực, bảo mật, xử lý ngoại lệ
│   │   ├── models/               # Định nghĩa Schema & Truy vấn Database
│   │   ├── routes/               # Tuyến đường API v1
│   │   ├── services/             # Xử lý logic nghiệp vụ, điều phối RCA & Healing
│   │   ├── utils/                # Tiện ích API chuẩn hóa
│   │   ├── app.ts                # Khởi tạo Express
│   │   └── server.ts             # Điểm bắt đầu khởi chạy HTTP Server
│   ├── Dockerfile                # Đóng gói Node.js Express
│   └── package.json
│
├── AI_backend/                   # Bộ xử lý Trí Tuệ Nhân Tạo & RCA (Python FastAPI)
│   ├── app/
│   │   ├── agents/               # Đa tác tử RCA (metrics, log, k8s, rca, recommendation...)
│   │   ├── api/                  # Endpoints (/health, /api/v1/predict, /api/v1/rca)
│   │   ├── core/                 # Cấu hình, bảo mật, biến môi trường
│   │   ├── models/               # Khai báo kiến trúc mạng nơ-ron PyTorch GRU
│   │   ├── schemas/              # Pydantic schemas xác thực dữ liệu vào/ra
│   │   └── services/             # Logic nạp checkpoint, inference, pipeline điều phối
│   ├── saved_models/             # Checkpoint mô hình GRU đã huấn luyện (.pt / .pth)
│   ├── tests/                    # Bộ kiểm thử đơn vị cho AI
│   ├── Dockerfile                # Đóng gói Python FastAPI
│   └── requirements.txt          # Khai báo thư viện Python
│
├── k8s/                          # Kubernetes Manifests
│   ├── namespace.yaml
│   ├── postgres.yaml
│   └── backend.yaml
│
├── docs/                         # Tài liệu kiến trúc chuyên sâu
│   └── DASHBOARD_ARCHITECTURE.md
├── docker-compose.yml            # Điều phối chạy container
├── DEPLOYMENT.md                 # Hướng dẫn chi tiết đóng gói và triển khai
├── PROJECT_STRUCTURE.md          # Đặc tả chi tiết từng tệp tin và thiết kế 3D
└── README.md                     # Tài liệu tổng quan dự án (Tệp này)
```

---

## 4. Hướng Dẫn Khởi Chạy & Vận Hành

### 4.1. Khởi chạy Frontend

Yêu cầu: **Node.js 18.x hoặc 20.x LTS**.

```bash
# 1. Di chuyển vào thư mục frontend
cd frontend

# 2. Cài đặt các gói phụ thuộc (dùng flag --legacy-peer-deps để đồng bộ tối ưu React 19)
npm install --legacy-peer-deps

# 3. Chạy ứng dụng trong môi trường phát triển
npm start
```
Ứng dụng sẽ được khởi tạo tại: **`http://localhost:3000`**

Kiểm thử tự động giao diện:
```bash
npm test -- --watchAll=false
```

---

### 4.2. Khởi chạy Main Backend

Yêu cầu: **Node.js 18.x+**, **PostgreSQL** đang chạy.

```bash
# 1. Di chuyển vào thư mục Main_backend
cd Main_backend

# 2. Cài đặt phụ thuộc
npm install

# 3. Cấu hình tệp .env (hoặc dùng mặc định từ .env.example)
cp .env.example .env

# 4. Khởi chạy ở chế độ phát triển (Tự động tải lại khi đổi mã nguồn)
npm run dev
```
Dịch vụ chạy tại: **`http://localhost:5000`**  
Kiểm tra sức khỏe: `GET http://localhost:5000/api/v1/health`

---

### 4.3. Khởi chạy AI Backend

Yêu cầu: **Python 3.10+**.

```powershell
# 1. Di chuyển vào thư mục AI_backend
cd AI_backend

# 2. Tạo và kích hoạt môi trường ảo Python
python -m venv .venv
.\.venv\Scripts\Activate.ps1   # Trên Windows PowerShell
# source .venv/bin/activate    # Trên Linux / macOS

# 3. Cài đặt các gói phụ thuộc
python -m pip install -r requirements.txt

# 4. Khởi chạy server FastAPI với Uvicorn
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
Dịch vụ chạy tại: **`http://localhost:8000`**  
Tài liệu OpenAPI tương tác: `http://localhost:8000/docs`

---

### 4.4. Triển khai bằng Docker / Docker Compose

Để triển khai nhanh giao diện Frontend đã được biên dịch tối ưu qua Nginx:

```bash
# Khởi động container Frontend
docker compose up -d --build

# Kiểm tra trạng thái container
docker compose ps

# Xem nhật ký log của container
docker compose logs -f selfheal-frontend
```
Truy cập qua trình duyệt: **`http://localhost:3000`**

---

## 5. Chu Trình Tự Phục Hồi (MAPE-K Loop)

Hệ thống hoạt động theo nguyên lý vòng lặp điều khiển tự thích ứng **MAPE-K**:

1. **Monitor (Giám sát)**: Cụm Agents liên tục thu thập chuỗi dữ liệu 8 chỉ số theo các chu kỳ đo.
2. **Analyze (Phân tích)**:
   - Khi có đủ 12 timestep mới, AI Backend phân tích qua mô hình **GRU** để nhận diện dấu hiệu bất thường tiềm ẩn.
   - Khi phát hiện rủi ro vượt ngưỡng, **Multi-Agent RCA Engine** lập tức đối soát Logs, Kubernetes Events và lịch sử sự cố tương tự.
3. **Plan (Lập kế hoạch)**:
   - Recommendation Agent đưa ra giải pháp khắc phục (khởi động lại Pod, thay đổi Scale Replicas, Rollback phiên bản, giải phóng tài nguyên...).
   - Đánh giá mức độ rủi ro để quyết định **Tự động thực thi** hoặc **Yêu cầu phê duyệt từ kỹ sư vận hành** (Human-in-the-Loop).
4. **Execute (Thực thi)**:
   - Tương tác với Kubernetes API Server để triển khai hành động đã được chốt.
5. **Knowledge Base (Tri thức tích lũy)**:
   - Đánh giá hiệu quả sau can thiệp (Post-Action Verification).
   - Lưu trữ kết quả và chỉ số thành công vào cơ sở dữ liệu làm bằng chứng cho các lần suy luận tiếp theo.

---

## 6. Tài Liệu Kỹ Thuật Tham Chiếu Khác

Để tìm hiểu chi tiết hơn về từng khía cạnh kỹ thuật, vui lòng tham khảo các tài liệu chuyên đề:
- [Kiến trúc & Cấu trúc Dự án Chi tiết (PROJECT_STRUCTURE.md)](PROJECT_STRUCTURE.md): Giải trình toàn diện từng file, từng module và cơ chế vẽ không gian 3D.
- [Hướng dẫn Đóng gói & Triển khai Sản xuất (DEPLOYMENT.md)](DEPLOYMENT.md): Hướng dẫn thiết lập Production trên Docker & Kubernetes.
- [Kiến trúc Bảng điều khiển Giám sát (docs/DASHBOARD_ARCHITECTURE.md)](docs/DASHBOARD_ARCHITECTURE.md): Sơ đồ luồng trạng thái và chi tiết kết nối API.
- [Đặc tả Hệ thống Thiết kế Greptile (www.greptile.com-DESIGN.md)](www.greptile.com-DESIGN.md): Bảng thông số Tokens, màu sắc, font chữ và quy chuẩn UI.

---
*(Bản quyền thuộc về Dự án Nghiên cứu Khoa học CapTone — Hệ thống Giám sát & Tự phục hồi Hạ tầng Kubernetes)*
