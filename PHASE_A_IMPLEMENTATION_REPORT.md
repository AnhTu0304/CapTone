# PHASE A — IMPLEMENTATION REPORT
## EVIDENCE ISOLATION & RCA INTEGRITY IMPLEMENTATION
**Dự án:** SelfAI — Closed-Loop Autonomous Self-Healing Platform  
**Trạng thái:** HOÀN THÀNH (100% Implemented & Verified)  
**Ngày thực hiện:** 12/11/2026  

---

## 1. TỔNG QUAN TRIỂN KHAI

Phase A đã giải quyết triệt để 4 lỗi cốt lõi (DEF-01, DEF-02, DEF-03, DEF-04) và lỗi tương tranh 2 Action chạy cùng thời điểm ghi nhận trong đợt kiểm toán sự cố thực tế `ecommerce-store-app` (Pod: `ecommerce-store-app-646f88ccfc-k6sl6`, Pod UID: `454a6276-34ff-4b9b-9f68-316d35f34271`) và `mongodb-0` (Pod UID: `47e313e2-6b07-4d8b-8a9f-7f33211b2c78`).

Toàn bộ các baseline kỹ thuật được bảo toàn tuyệt đối:
- **GRU Checkpoint:** Giữ nguyên 100% trọng số, bias, StandardScaler và SHA-256 của checkpoint `saved_models/gru_model_8feature.pth`.
- **GRU Tensor Shape:** Chuẩn xác `[12, 8]`, 8 features, 7 nhãn phân loại.
- **Adaptive Recovery Verification:** Chu kỳ 3 → 6 → 12 mẫu của Phase 6.2 trong `recoveryVerification.service.ts` hoạt động ổn định và độc lập.

---

## 2. CHI TIẾT CÁC SỬA ĐỔI KỸ THUẬT THEO TỪNG THÀNH PHẦN

### 2.1. AI Backend — Model & Schemas (`AI_backend/app/rca/models.py`)
- **EvidenceAttribution Enum:** Bổ sung `DIRECT`, `DEPENDENCY`, `UNATTRIBUTED`, `HISTORICAL`, `CONTEXTUAL`.
- **EvidenceItem Dataclass:** Mở rộng các trường:
  - `attribution_status`: Phân định rõ nguồn gốc bằng chứng.
  - `resource_kind`: Loại tài nguyên thực (`Pod`, `Deployment`, `Node`, `Event`).
  - `resource_name`: Tên thực của tài nguyên phát sinh sự kiện.
- **ValidationResult:** Phân tách rõ ràng:
  - `valid_evidences`: Chỉ chứa bằng chứng DIRECT hợp lệ của Target Workload.
  - `dependency_evidences`: Chứa các bằng chứng thuộc dịch vụ phụ thuộc (Database/Upstream).
  - `unattributed_evidences`: Bằng chứng thiếu danh tính UID hoặc chưa xác định.

### 2.2. AI Backend — Evidence Collector (`AI_backend/app/rca/evidence_collector.py`)
- **Loại bỏ hoàn toàn cơ chế gán đè (Spoofing/Forging) UID:**
  - `_resolve_event_identity`: Ưu tiên bóc tách `involved_object.uid`, `involved_object.name`, `regarding` từ metadata Kubernetes chính quy.
  - Khi sự kiện có structured metadata nhưng thiếu UID: Đánh dấu `UNATTRIBUTED`, không tự ý lấy `target_uid` của workload để trám vào.
  - Khi sự kiện chứa thông tin của Pod phụ thuộc (`mongodb-0`): Bóc tách đúng `mongodb-0` và chuyển `attribution_status` sang `DEPENDENCY`, tuyệt đối không gắn vào `ecommerce-store-app`.
- **Trích xuất Log UID và Dependency Patterns:**
  - Hỗ trợ regex bóc tách UID từ format log chuẩn `[<uuid>]`. Log mang UID của MongoDB (`47e313e2...`) tự động được cô lập sang `DEPENDENCY`.
  - Phân tích pattern lỗi kết nối `CONN_LOG_PATTERN` (`getaddrinfo ENOTFOUND`, `ECONNREFUSED`, `Dual DB not ready yet`, `ConnectionRefused`) thành `LOG_CONNECTION_FAILURE` với trạng thái `DEPENDENCY`.

### 2.3. AI Backend — Evidence Validator (`AI_backend/app/rca/evidence_validator.py`)
- **Kiểm định danh tính UID nghiêm ngặt:**
  - Kiểm tra `ev.target_uid == target_pod_uid`: Nếu khớp, đánh dấu `is_current_pod = True`.
  - Kiểm tra `historical_uids`: Nếu Pod UID thuộc về Pod cũ đã thay thế trước đó, đánh dấu `is_current_pod = False`, `is_historical_replaced_pod = True`, `attribution_status = EvidenceAttribution.HISTORICAL`.
  - Khi có Pod UID khác lạ: Đưa vào `rejected` với issue `MISMATCHED_POD_UID`.
- **Xác thực Temporal Correlation:** Bằng chứng thiếu timestamp bị gắn cờ `MISSING_TIMESTAMP`, `has_temporal_correlation = False` và giảm chỉ số tin cậy.

### 2.4. AI Backend — Kubernetes Event Agent (`AI_backend/app/agents/kubernetes_agent.py`)
- **Khắc phục DEF-02 (Lựa chọn sai Target Pod):**
  - Xây dựng hàm `_is_pod_of_workload(pod, workload_name, workload_type)` kiểm tra cây điều phối (`ownerReferences`: ReplicaSet -> Deployment, StatefulSet -> Pod) và quy ước đặt tên Pod.
  - Danh sách ứng viên `faulty_pod` được lọc nghiêm ngặt trong `target_pods`. Ngăn chặn hoàn toàn việc `mongodb-0` (37 restarts) bị chọn làm target pod của `ecommerce-store-app`.
- **Khắc phục H-04 (Gán sai vai trò Primary Database):**
  - Khóa cờ `is_primary_database`: Chỉ được phép bật `True` khi workload thực sự là `StatefulSet` cơ sở dữ liệu. Deployments và web app thông thường bắt buộc `is_primary_database = False`.

### 2.5. AI Backend — Cause Evaluator (`AI_backend/app/rca/cause_evaluator.py`)
- **Khắc phục DEF-04 (Phân định Root Cause vs Triệu chứng):**
  - Bổ sung quy trình đánh giá `dependency_failure` ưu tiên trước `application_failure`.
  - Khi dịch vụ phụ thuộc gặp sự cố (MongoDB CrashLoop, lỗi kết nối DNS/Socket `ENOTFOUND`):
    - Tỷ lệ HTTP 5xx (100%) và Độ trễ cao (2590ms) của Ecommerce được xếp vào danh mục **Triệu chứng quan sát (Symptoms)**, không phải nguyên nhân gốc.
    - Causal Evidence Gating: Trả về `CONFIRMED` khi có đủ log lỗi kết nối từ ứng dụng + bằng chứng sự cố của Dependency Pod; trả về `PROBABLE` (độ tin cậy 0.62–0.76) kèm `missing_evidence` nếu thiếu dữ liệu đối soát.
- **Rào chắn CPU Saturation:** Nếu CPU < 50% hoặc ở mức bình thường, cấm tuyệt đối việc kết luận `cpu_saturation`.

### 2.6. AI Backend — Recommendation Agent (`AI_backend/app/agents/recommendation_agent.py`)
- **Bảo vệ Workload mục tiêu trước lỗi phụ thuộc:**
  - Khi `cause == "dependency_failure"`: Trả về `action = "NO_ACTION"` kèm playbook điều tra 3 bước hướng dẫn kiểm tra Database Service, DNS và Secret.
  - Ngăn chặn hoàn toàn việc leo thang sang `REPLACE_POD` hoặc `SCALE_REPLICAS` trên web app khi lỗi thuộc về database thượng nguồn.
  - Loại bỏ hoàn toàn playbook chuyển quyền `rs.stepDown(60)` đối với các ứng dụng Stateless Deployment.

### 2.7. Main Backend — Target Concurrency Lock (`ai.controller.ts` & `healingAction.service.ts`)
- **Khắc phục lỗi 2 Action cùng RUNNING tại 01:41:35:**
  - Trong `ai.controller.ts` (`applyRecommendation`): Trước khi tạo mới action và chuyển sang `RUNNING`, thực hiện truy vấn kiểm tra xem trên `target_name` hoặc `incident_id` có action nào đang ở trạng thái `RUNNING` hoặc `PENDING` hay không. Nếu có, từ chối với HTTP 409 Conflict.
  - Trong `healingAction.service.ts` (`executeAction`): Bổ sung khóa tương tranh mục tiêu tương tự, đảm bảo không thể có 2 tiến trình tự phục hồi chạy song song đè lên cùng một workload.

---

## 3. DANH MỤC CÁC TẬP TIN ĐÃ CHỈNH SỬA

| STT | Tập tin | Nội dung chỉnh sửa |
|---|---|---|
| 1 | `AI_backend/app/rca/models.py` | Thêm Enum `EvidenceAttribution`, trường `attribution_status`, `resource_kind`, `resource_name` |
| 2 | `AI_backend/app/rca/evidence_collector.py` | Khắc phục spoofing UID, cô lập sự kiện/log của foreign pod, phân tích dependency logs |
| 3 | `AI_backend/app/rca/evidence_validator.py` | Kiểm định UID đa tầng, cô lập unattributed evidences, hỗ trợ historical pod UIDs |
| 4 | `AI_backend/app/agents/kubernetes_agent.py` | Lọc `target_pods` theo workload, chặn `mongodb-0` làm target, khóa `is_primary_database` cho web app |
| 5 | `AI_backend/app/rca/cause_evaluator.py` | Đánh giá `dependency_failure`, phân định symptoms vs cause, bảo vệ mức CPU thấp |
| 6 | `AI_backend/app/agents/recommendation_agent.py` | Gán `NO_ACTION` cho `dependency_failure`, chặn playbook `rs.stepDown(60)` cho web app |
| 7 | `Main_backend/src/controllers/ai.controller.ts` | Bổ sung Target Concurrency Lock chặn hành động trùng lặp |
| 8 | `Main_backend/src/services/healingAction.service.ts` | Bổ sung Concurrency Lock trong `executeAction` |
| 9 | `AI_backend/tests/test_phase_a_evidence_isolation.py` | Xây dựng bộ test mới gồm 18 kịch bản A01–A18 |

---

## 4. KẾT LUẬN TRIỂN KHAI
Toàn bộ mã nguồn đã được triển khai đầy đủ, chính xác, sạch sẽ, không còn tình trạng gán cứng dữ liệu giả mạo hay gán nhầm danh tính thực thể Kubernetes.
