# TÀI LIỆU KIẾN TRÚC & THIẾT KẾ DASHBOARD: HỆ THỐNG SELFHEAL
> **Dự án**: SelfHeal — Nền tảng tự phục hồi sự cố hạ tầng Kubernetes chủ động dựa trên AI dành cho doanh nghiệp vừa và nhỏ (SMEs).  
> **Phiên bản thiết kế**: 1.0.0 (Production-Ready Dashboard Architecture)  
> **Phong cách thị giác**: White-First Calm Operations (Trắng sứ tinh khiết, Xanh ngọc lục bảo dịu mát, Xanh bạc hà nhẹ, Chữ xanh than đậm).

---

## 1. TỔNG QUAN & ĐỐI TƯỢNG NGƯỜI DÙNG (USER PERSONAS)

Bảng điều khiển **SelfHeal Dashboard** được thiết kế nhằm phục vụ 3 nhóm vai trò cốt lõi trong doanh nghiệp SME:

| Vai trò (Role) | Trách nhiệm chính | Nhu cầu giao diện cốt lõi |
| :--- | :--- | :--- |
| **SME Owner / CTO** *(Chính)* | Chịu trách nhiệm về SLA dịch vụ, chi phí và an toàn dữ liệu kinh doanh. | Cần cái nhìn tổng quan tức thì về "Hệ thống có ổn không?", AI dự báo rủi ro gì, và trực tiếp phê duyệt các hành động tự phục hồi có rủi ro cao (Human-in-the-Loop). |
| **DevOps / SRE Engineer** | Quản trị cụm Kubernetes, cấu hình chính sách, kiểm tra logs/metrics và phân tích RCA. | Thao tác sâu với Agent, Workloads, Pods, sự kiện K8s, phân tích nguyên nhân gốc rễ và cấu hình chính sách tự phục hồi. |
| **Viewer / Developer** | Giám sát trạng thái ứng dụng của đội ngũ, kiểm tra tính sẵn sàng khi deploy. | Xem trực quan chỉ số, nhận cảnh báo, không có quyền can thiệp hay thay đổi cấu hình hạ tầng. |

---

## 2. NGUYÊN TẮC THIẾT KẾ THỊ GIÁC (CALM WHITE-FIRST DESIGN SYSTEM)

Khác với các trang giới thiệu công nghệ (Marketing Landing Page) sử dụng hiệu ứng 3D đậm chất cyberpunk, giao diện vận hành kỹ thuật hằng ngày của Dashboard tuân thủ triệt để nguyên lý **"Calm Tech"** (Công nghệ điềm tĩnh):
- **Tránh mỏi mắt (Zero Visual Fatigue)**: Sử dụng nền trắng tinh tế `#FFFFFF` kết hợp nền xám nhạt trung tính `#F8FAFC` để phân cấp khối.
- **Tập trung vào thông tin (Information Over Decoration)**: Không sử dụng animation hào nhoáng, không dùng màu neon chói lọi, không dùng hiệu ứng kính mờ (glassmorphism) quá đà làm giảm độ tương phản chữ.
- **Dữ liệu trung thực (Honest Telemetry)**: Không hiển thị số liệu giả lập nếu Agent chưa kết nối; cung cấp trạng thái Empty State rõ ràng với hướng dẫn cài đặt Agent.

### Bảng Mã Màu Thiết Kế (Color Palette):
| Thành phần | Mã màu HEX | Ứng dụng |
| :--- | :--- | :--- |
| **Background (Nền chính)** | `#FFFFFF` | Nền canvas trang, nền thẻ card, nền bảng dữ liệu |
| **Surface Secondary (Nền phụ)** | `#F8FAFC` | Nền thanh bên Sidebar, nền header bảng, nền ô tìm kiếm |
| **Primary Brand (Màu chủ đạo)** | `#059669` (Emerald 600) | Nút bấm chính, tab active, trạng thái Healthy |
| **Primary Hover** | `#047857` (Emerald 700) | Trạng thái hover nút bấm và liên kết |
| **Secondary Accent** | `#D1FAE5` (Mint 100) | Nền badge thành công, viền điểm nhấn nhẹ nhàng |
| **Text Primary (Chữ chính)** | `#0F172A` (Navy Slate 900) | Tiêu đề, số liệu chính, nhãn quan trọng |
| **Text Secondary (Chữ phụ)** | `#475569` (Slate 600) | Mô tả, nhãn phụ, đơn vị đo lường |
| **Text Muted (Chữ mờ)** | `#94A3B8` (Slate 400) | Placeholder, timestamp, breadcrumb |
| **Border Hairline (Đường viền)** | `#E2E8F0` / `#E5ECE7` | Viền thẻ, viền bảng, viền ngăn cách phân cấp |
| **Success (Thành công)** | `#10B981` / Nền `#ECFDF5` | Cụm khỏe mạnh, tự phục hồi thành công |
| **Warning (Cảnh báo)** | `#F59E0B` / Nền `#FFFBEB` | Ngưỡng tài nguyên cao, AI dự báo rủi ro |
| **Critical (Nguy cấp)** | `#EF4444` / Nền `#FEF2F2` | Sập Pod, lỗi 5xx, Agent mất kết nối |
| **Information (Thông tin)** | `#0284C7` / Nền `#F0F9FF` | Thông báo hệ thống, nhật ký kiểm toán |

---

## 3. KIẾN TRÚC LAYOUT TỔNG THỂ (GLOBAL DASHBOARD LAYOUT)

Layout được đóng gói trong linh kiện [`DashboardLayout.jsx`](file:///d:/AISelfHealing/frontend/src/layouts/DashboardLayout.jsx) gồm 3 khu vực chính:

```
+---------------------------------------------------------------------------------------+
|  TOP HEADER (Chiều cao: 64px, Viền đáy: 1px solid #E2E8F0, Nền trắng #FFFFFF)           |
|  [Logo SelfHeal] | [Org Selector: Acme Corp] [Env: Production] | [Refresh] [Notif] [User] |
+------------------+--------------------------------------------------------------------+
|  SIDEBAR (260px) |  MAIN CONTENT AREA (Nền: #F8FAFC, Co giãn theo màn hình)            |
|  - Thu gọn/Mở    |  [Breadcrumbs: Dashboard > Infrastructure]                         |
|  - 7 Nhóm Menu   |  [Page Header: Tiêu đề trang + Hành động chính]                    |
|  - 17 Sub-routes |                                                                    |
|  - Badge số đếm  |  +---------------------------------------------------------------+ |
|                  |  |  Content Cards / Data Tables / Charts / Filter Bars          | |
|                  |  +---------------------------------------------------------------+ |
+------------------+--------------------------------------------------------------------+
```

### 3.1. Cấu trúc Cột điều hướng (Sidebar Navigation - 7 Nhóm nghiệp vụ):
1. **OVERVIEW (Tổng quan)**:
   - `Dashboard` (`/dashboard`): Sa bàn điều hành toàn diện hạ tầng K8s.
2. **ORGANIZATION (Tổ chức & Phân quyền)**:
   - `Organization` (`/dashboard/organization`): Thông tin tổ chức, slug, môi trường.
   - `Members & Permissions` (`/dashboard/organization/members`): Danh sách thành viên, ma trận quyền SME Owner / DevOps / Viewer.
3. **INFRASTRUCTURE & AGENT (Hạ tầng & Tác tử)**:
   - `Agents` (`/dashboard/agents`): Quản lý tác tử eBPF/K8s, Heartbeat, hướng dẫn cài đặt.
   - `Clusters` (`/dashboard/clusters`): Thông tin các cụm K8s đang kết nối.
   - `Infrastructure` (`/dashboard/infrastructure`): Trực quan hóa Nodes, CPU/RAM dung lượng.
   - `Workloads` (`/dashboard/workloads`): Deployments, DaemonSets, StatefulSets, Pods.
4. **MONITORING (Giám sát chuyên sâu)**:
   - `Metrics` (`/dashboard/monitoring/metrics`): Biểu đồ CPU, Memory, Disk, Network, P99 Latency.
   - `Logs` (`/dashboard/monitoring/logs`): Bộ lọc nhật ký container theo thời gian thực.
   - `Events` (`/dashboard/monitoring/events`): Kubernetes Events (Warning, Normal).
5. **AI & INCIDENTS (Dự báo & Sự cố)**:
   - `AI Predictions` (`/dashboard/ai/predictions`): Danh sách cảnh báo sớm từ mô hình AI chuỗi thời gian.
   - `Incidents` (`/dashboard/incidents`): Quản lý sự cố, mức độ nghiêm trọng và tiến trình xử lý.
   - `Root Cause Analysis` (`/dashboard/incidents/:id/rca`): Cây suy diễn nguyên nhân gốc rễ chứng cứ.
6. **SELF-HEALING (Tự phục hồi & Cổng phê duyệt)**:
   - `Healing Actions` (`/dashboard/self-healing/actions`): Các hành động tự sửa chữa đang chạy.
   - `Action History` (`/dashboard/self-healing/history`): Lịch sử phục hồi, thời gian MTTR.
   - `Policies` (`/dashboard/self-healing/policies`): Thiết lập chính sách ngưỡng tự phục hồi.
   - `Approvals` (`/dashboard/self-healing/approvals`): Cổng duyệt khẩn cấp cho SME Owner (HITL Gate).
7. **SYSTEM (Hệ thống & Cài đặt)**:
   - `Notifications` (`/dashboard/notifications`): Trung tâm thông báo.
   - `Audit Logs` (`/dashboard/audit-logs`): Nhật ký kiểm toán bất biến theo chuẩn tuân thủ.
   - `Reports` (`/dashboard/reports`): Báo cáo chỉ số uptime, độ tin cậy AI, chi phí tiết kiệm.
   - `Settings` (`/dashboard/settings`): Cấu hình tài khoản và tích hợp webhook (Slack, PagerDuty).

---

## 4. CHI TIẾT ĐẶC TẢ CÁC TRANG CỐT LÕI (CORE PAGES SPECIFICATION)

### 4.1. Trang 1 — Tổng Quan Vận Hành (`/dashboard`)
- **Header trang**: "Infrastructure Overview", nhãn môi trường `Production (us-east-1)`, nút Refresh thủ công kèm công tắc "Auto-refresh: 30s", hiển thị dấu thời gian "Last updated: 14:02:18".
- **System Health Card**:
  - Trạng thái tổng hợp: `HEALTHY (Xanh lục)`, `WARNING (Hổ phách)`, `CRITICAL (Đỏ)`.
  - Kết nối Agent: `3/3 Connected`, Latency trung bình `1.2ms`.
  - Số lượng sự cố nghiêm trọng đang hoạt động: `0 Critical Incidents`.
- **Hệ thống Thẻ Chỉ Số Tổng Quan (Metric Overview Cards - 8 Thẻ chuẩn)**:
  1. `CPU Usage`: 42% (Xu hướng: &darr; 3% so với 1h trước).
  2. `Memory Usage`: 68% (Ngưỡng cảnh báo: 80%).
  3. `Disk I/O`: 24% (Ổn định).
  4. `Running Pods`: 84 / 84 Healthy.
  5. `Active Incidents`: 0 sự cố đang mở.
  6. `Agent Status`: 100% Online (eBPF Kernel Ready).
  7. `Self-Healing Actions`: 12 hành động tự giải quyết trong 24h qua.
  8. `Pending Approvals`: 1 yêu cầu cần SME Owner phê duyệt (Nhấn chuyển ngay đến trang duyệt).
- **Biểu đồ Tài nguyên Thời gian thực (Resource Charts)**:
  - Bộ chọn dải thời gian: `15m`, `1h`, `6h`, `24h`.
  - Biểu đồ đường kép CPU vs Memory kèm đường gióng ngưỡng trần (Threshold Indicator).
- **Khối Tóm Tắt Sự Cố & AI Dự Báo**:
  - Bảng sự cố gần nhất kèm phân loại mức độ nghiêm trọng và nút "View Incident".
  - Thẻ AI Prediction cảnh báo sớm: Ghi rõ *"Dự báo chỉ mang tính chất cảnh báo xác suất, không phải sự cố đã xảy ra"*.
- **Trạng thái Trống (Empty State)**:
  - Khi chưa có Agent nào được kết nối, hiển thị minh họa trực quan "No Agent Connected Yet" kèm nút gọi hành động "Connect Your First Kubernetes Cluster", tuyệt đối không giả lập số liệu ảo.

### 4.2. Trang 2 & 3 — Tổ Chức & Thành Viên (`/dashboard/organization/*`)
- Quản lý tên công ty, định danh slug, thông tin gói dịch vụ.
- Bảng danh sách thành viên phân cấp quyền:
  - `SME Owner`: Toàn quyền cấu hình, phê duyệt và quản lý tài chính.
  - `DevOps`: Quản lý cụm K8s, xem log/metric, đề xuất hành động.
  - `Viewer`: Chỉ đọc, các nút thao tác bị làm mờ (disabled) kèm tooltip giải thích lý do phân quyền.

### 4.3. Trang 4 — Tác Tử Agent (`/dashboard/agents`)
- Bảng danh sách tác tử: Phiên bản (`v1.4.2`), Cụm (`k8s-prod-cluster-01`), Trạng thái nhịp tim (`Heartbeat 4s ago`), eBPF hook status (`Active`).
- Nút "Install New Agent" mở Modal cung cấp lệnh `helm install selfheal-agent` hoặc `kubectl apply -f manifest.yaml` kèm nút sao chép 1-click.

### 4.4. Trang 5 — Hạ Tầng & Workloads (`/dashboard/infrastructure` & `/workloads`)
- Quản lý các Node (Master/Worker), dung lượng CPU/RAM khả dụng.
- Bảng Workload lọc theo Namespace (`default`, `kube-system`, `production`), số lượng Pods, số lần restart (`Restart count`) và trạng thái Pod.

### 4.5. Trang 6 — Giám Sát Chuyên Sâu (`/dashboard/monitoring/*`)
- `Metrics`: Xem chi tiết đa chỉ số CPU, RAM, Disk I/O, Network In/Out, P99 Latency, tỷ lệ lỗi HTTP 5xx.
- `Logs`: Trình duyệt log container thông minh, tìm kiếm theo từ khóa regex, lọc mức độ `INFO`, `WARN`, `ERROR`.
- `Events`: Bảng Kubernetes Events được gom nhóm và đánh dấu màu theo thời gian thực.

### 4.6. Trang 7 — Dự Báo Bằng AI (`/dashboard/ai/predictions`)
- Danh sách cảnh báo sớm từ thuật toán AI: Khả năng tràn bộ nhớ trong 18 phút tới, nguy cơ bão hòa Disk I/O.
- Hiển thị độ tin cậy mô hình (`Confidence Score: 87%`), các tín hiệu tương quan và trạng thái: `Active`, `Mitigated`, `Dismissed`.

### 4.7. Trang 8 — Sự Cố & Phân Tích Nguyên Nhân Gốc Rễ (`/dashboard/incidents`)
- Danh sách sự cố theo mức độ nghiêm trọng (`Critical`, `Major`, `Minor`).
- Trang chi tiết sự cố (`/dashboard/incidents/:id`):
  - Dòng thời gian phát hiện và xử lý (Timeline).
  - Tương quan logs/metrics tại thời điểm xảy ra sự cố.
  - Cây phân tích nguyên nhân gốc rễ (RCA) dựa trên bằng chứng kỹ thuật.

### 4.8. Trang 9 — Tự Phục Hồi & Phê Duyệt Của Con Người (`/dashboard/self-healing/*`)
- `Healing Actions`: Trạng thái hành động (`Running`, `Verifying`, `Completed`, `Failed`).
- `Approvals`: Khu vực phê duyệt của SME Owner đối với các hành động rủi ro cao (Drain Node, Rollback Database, Restart Ingress). Có modal xem trước diff cấu hình trước khi xác nhận ký duyệt.
- `Policies`: Cấu hình chính sách tự động (Ví dụ: Cho phép tự động restart pod tối đa 3 lần; nếu quá 3 lần phải kích hoạt cổng HITL).

### 4.9. Trang 10 — Hệ Thống & Cài Đặt (`/dashboard/settings`, `/audit-logs`, `/notifications`, `/reports`)
- Trung tâm thông báo chia theo tab (Unread, All, Critical).
- Nhật ký kiểm toán (Audit Logs) ghi nhận ai đã làm gì, vào thời điểm nào, từ IP nào.
- Báo cáo tổng hợp SLA và thời gian hồi phục trung bình (MTTR).

---

## 5. MA TRẬN QUYỀN TRUY CẬP THEO VAI TRÒ (RBAC MATRIX)

| Hành động trên Dashboard | SME Owner | DevOps Engineer | Viewer |
| :--- | :---: | :---: | :---: |
| Xem Tổng quan, Metrics, Logs, Trạng thái | ✅ Có | ✅ Có | ✅ Có |
| Kết nối Cluster & Tạo Token Agent mới | ✅ Có | ✅ Có | ❌ Không |
| Phê duyệt hành động Tự phục hồi rủi ro cao (Drain Node, Rollback) | ✅ Có | ❌ Không (Chờ Owner duyệt) | ❌ Không |
| Chỉnh sửa Chính sách Tự phục hồi (Policies) | ✅ Có | ✅ Có | ❌ Không |
| Mời thành viên & Thay đổi Role | ✅ Có | ❌ Không | ❌ Không |
| Xuất báo cáo kỹ thuật & Xem Audit Log | ✅ Có | ✅ Có | ❌ Không |

---

## 6. LỘ TRÌNH TRIỂN KHAI THEO GIAI ĐOẠN (PHASED ROADMAP)

Để đảm bảo chất lượng cao nhất, tránh triển khai dàn trải hời hợt, quy trình được chia làm các chặng vững chắc:

- **Giai đoạn 1 (Nền móng hạ tầng & Sa bàn Tổng quan)**:
  - Khởi tạo hệ thống Tokens & CSS riêng cho Dashboard (`src/styles/dashboard-tokens.css`).
  - Xây dựng Context quản lý trạng thái (`DashboardContext.jsx`): Lưu trữ Org hiện tại, Môi trường hiện tại, Vai trò người dùng hiện tại (kèm nút chuyển vai trò demo nhanh), trạng thái làm mới tự động.
  - Xây dựng Layout chuẩn mực [`DashboardLayout.jsx`](file:///d:/AISelfHealing/frontend/src/layouts/DashboardLayout.jsx) gồm Sidebar 7 nhóm, TopHeader linh hoạt, Breadcrumb và Drawer di động.
  - Xây dựng hoàn chỉnh **Trang 1: Overview (`/dashboard`)** với SystemHealthCard, MetricCards, Biểu đồ tài nguyên, Khối Incident/AI/SelfHealing và công tắc chuyển đổi Empty State chân thực.
  - Tích hợp route `/dashboard` vào [`src/routes/index.jsx`](file:///d:/AISelfHealing/frontend/src/routes/index.jsx) và bộ test tự động.

- **Giai đoạn 2 (Quản lý Agent, Cụm & Workloads K8s)**:
  - Trang 4: Agents (`/dashboard/agents`) kèm Modal lệnh cài đặt.
  - Trang 5: Infrastructure & Workloads (`/dashboard/infrastructure`, `/dashboard/workloads`).

- **Giai đoạn 3 (AI Dự báo, Sự cố & Phân tích Nguyên nhân gốc rễ RCA)**:
  - Trang 7: AI Predictions (`/dashboard/ai/predictions`).
  - Trang 8: Incidents & RCA (`/dashboard/incidents`, `/dashboard/incidents/:id`).

- **Giai đoạn 4 (Tự phục hồi & Cổng phê duyệt của Con người HITL)**:
  - Trang 9: Healing Actions, Action History, Policies, Approvals Modal.

- **Giai đoạn 5 (Giám sát Chuyên sâu, Tổ chức & Cài đặt Hệ thống)**:
  - Trang 6: Monitoring (Metrics, Logs, Events).
  - Trang 2 & 3: Organization & Members.
  - Trang 10: Notifications, Audit Logs, Reports & Settings.
