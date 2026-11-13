# PHASE A — SOURCE CODE AUDIT REPORT
## SELFAI — EVIDENCE ISOLATION & RCA INTEGRITY AUDIT

**Hệ thống:** SelfAI – AI-Driven Proactive Self-Healing Infrastructure  
**Giai đoạn:** Phase A — Evidence Isolation & RCA Integrity  
**Vai trò kiểm toán:** Senior AI/ML Engineer, Kubernetes Reliability Engineer & Backend Architect  
**Thời gian:** 2026-11-12T09:15:00+07:00  
**Tình trạng Baseline:** Phase 6.2 (Lightweight & Adaptive Recovery Verification)  

---

## 1. LUỒNG DỮ LIỆU THỰC TẾ (END-TO-END DATA FLOW)

Chu trình thu thập, xử lý viễn trắc và suy luận nguyên nhân gốc rễ (RCA) trong hệ thống SelfAI vận hành qua 3 tầng phân cấp:

```
+-----------------------------------------------------------------------------------------+
|                                1. KUBERNETES & AGENT LAYER                              |
|  - PodsCollector (pods.py): list_pods_detail() quét Pods trong namespace               |
|  - EventsCollector (events.py): list_events() quét K8s events                          |
|  - LogsCollector (logs.py): get_recent_logs() đọc container logs                        |
+-----------------------------------------------------------------------------------------+
                                      │ WebSocket telemetry stream
                                      ▼
+-----------------------------------------------------------------------------------------+
|                                  2. MAIN BACKEND LAYER                                  |
|  - agentWebSocket.ts: Tiếp nhận payload từ Agent, lưu vào DB (pods, logs, k8s_events)   |
|  - telemetryAggregator.service.ts:                                                      |
|      * buildRcaContext(serviceId): gom pod, log, k8s_event theo serviceId              |
|      * evaluate(): chạy RuleEngineService + GRU prediction (/api/v1/predict)            |
|      * trigger RCA: gọi AiService.analyzeRootCause(payload) sang AI Backend            |
+-----------------------------------------------------------------------------------------+
                                      │ REST API (POST /api/v1/rca)
                                      ▼
+-----------------------------------------------------------------------------------------+
|                                   3. AI BACKEND LAYER                                   |
|  - api/rca.py -> RootCauseAnalysisAgent.analyze()                                       |
|      * Step 1: EvidenceCollector.collect() gom 5 nguồn bằng chứng:                      |
|                (Metrics, Pod Status, K8s Events, Node Conditions, Logs)                 |
|      * Step 2: EvidenceValidator.validate() kiểm tra tính hợp lệ & đối soát UID        |
|      * Step 3: KubernetesEventAgent.analyze() lọc faulty_pod & đánh giá database       |
|      * Step 4: CauseEvaluator.evaluate() đối chiếu bằng chứng suy luận Cause Code       |
|      * Step 5: SeverityEvaluator.evaluate() đánh giá mức độ nghiêm trọng (SLO)          |
|      * Step 6: RecommendationAgent.recommend() sinh Action tự khắc phục & Playbook     |
+-----------------------------------------------------------------------------------------+
```

---

## 2. CÁCH HỆ THỐNG XÁC ĐỊNH TARGET POD, WORKLOAD OWNERSHIP & SERVICE MAPPING

Qua kiểm tra trực tiếp mã nguồn, hệ thống hiện đang bộc lộ những lỗ hổng kỹ thuật nghiêm trọng trong việc định danh và liên kết tài nguyên:

### 2.1. Cách xác định Target Pod
- **Tại Main Backend (`telemetryAggregator.service.ts` dòng 235–270 & dòng 312–318):**
  - Truy vấn CSDL tìm Pods:
    ```sql
    WHERE (w.name = $1 OR w.name = $2 OR p.labels->>'app' = $1 OR p.name LIKE $3 OR p.name LIKE $4)
    ```
  - Chọn Pod đại diện (`selected`):
    `const selected = nonHealthyNonTerminating || firstNonTerminating || evalPods[0];`
    `podId = primary.pod_name;`
  - Nếu có nhiều Pod (ví dụ Pod cũ Terminating và Pod mới Running), hệ thống dễ lấy nhầm tên Pod cũ hoặc lấy Pod của dịch vụ khác nếu tiền tố tên tương tự.
- **Tại AI Backend (`kubernetes_agent.py` dòng 68–83):**
  - Khi duyệt `data.all_pods`:
    ```python
    candidate_pods = sorted(data.all_pods, key=lambda p: p.restart_count, reverse=True)
    if candidate_pods:
        faulty_candidate = candidate_pods[0]
    ```
  - Thuật toán sắp xếp toàn bộ danh sách `data.all_pods` theo `restart_count DESC` mà **hoàn toàn không lọc xem Pod đó có thuộc về Target Workload hay không**.

### 2.2. Cách xác định Workload Ownership
- **Tại Agent (`pods.py` dòng 83–96):**
  - Hàm `extract_service_id(pod_name, labels)` chỉ dựa vào chuỗi cắt chuỗi `pod_name.split("-")`:
    - Nếu có 3 phần (`parts[-1] == 5` và `parts[-2] >= 5`): lấy `parts[:-2]`.
    - Ngược lại: lấy `parts[:-1]`.
  - **Hoàn toàn bỏ qua `metadata.owner_references`**. Agent không bóc tách chuỗi `Deployment -> ReplicaSet -> Pod` hay `StatefulSet -> Pod`.
- **Tại AI Backend (`kubernetes_agent.py` & `evidence_collector.py`):**
  - Không có hàm kiểm tra tính sở hữu controller phân cấp. Bất kỳ Pod nào có tên bắt đầu bằng tiền tố tương tự đều bị coi là thuộc về cùng một workload.

### 2.3. Cách ánh xạ Pod với Kubernetes Service
- Hệ thống đang đánh đồng `Service` logic của tầng ứng dụng (`service_id`) với `Kubernetes Service` object và `Deployment`.
- Chưa có cơ chế truy vấn `Service selector` hoặc `EndpointSlice` để phân biệt:
  1. *Pod Ownership*: Pod do ReplicaSet nào quản lý.
  2. *Service Membership*: Service nào đang định tuyến lưu lượng tới Pod.
  3. *Dependency Relationship*: Ứng dụng nào đang gọi tới Service nào.

### 2.4. Cách liên kết Logs, Events và Metrics
- **Tại `telemetryAggregator.service.ts`:**
  - `formattedLogs`: Lọc từ bảng `logs` theo `service_id` hoặc tên `pod_id`.
  - `formattedEvents`: Lọc từ bảng `kubernetes_events` theo `metadata->>'service_id'`.
  - Toàn bộ được đóng gói chung vào một `RCARequest` JSON phẳng gửi sang AI Backend.

---

## 3. NGUYÊN NHÂN CHÍNH XÁC CỦA 4 LỖI (DEF-01 ĐẾN DEF-04)

### 3.1. DEF-01 — Evidence Contamination (Nhiễm chéo Bằng chứng)
- **Vị trí lỗi:** [`AI_backend/app/rca/evidence_collector.py`](file:///d:/NCKH/CapTone/AI_backend/app/rca/evidence_collector.py) (dòng 240–294 và dòng 421–432).
- **Cơ chế lỗi:**
  - Khi duyệt qua `combined_events`, mã nguồn chỉ kiểm tra từ khóa dạng text: `if "crashloopbackoff" in ev_lower:`.
  - Dù nội dung sự kiện ghi rõ: `Pod: mongodb-0 - Reason: RecoveredFromCrashLoop - Container 'mongo' in pod 'test-lab/mongodb-0'`, Collector lại tự tiện gán:
    ```python
    target_resource = target_res  # Là ecommerce-store-app!
    target_uid = target_uid        # Là UID của ecommerce-store-app!
    ```
  - Khi chuyển sang [`evidence_validator.py`](file:///d:/NCKH/CapTone/AI_backend/app/rca/evidence_validator.py) (dòng 52–65), bộ kiểm định kiểm tra `if item.target_uid != target_pod_uid:`. Vì UID đã bị Collector điền đè thành của `ecommerce-store-app`, bài kiểm tra bị "qua mặt giả tạo" (False Bypass).
  - Tương tự với Log: Log JSON của MongoDB `[47e313e2-6b07-4d8b-8a9f-7f33211b2c78] {"t":{"$date":...}}` bị regex `CRASH_LOG_PATTERN` bắt trúng và gán đè danh tính thành `ecommerce-store-app`.

### 3.2. DEF-02 — Incorrect Target Pod Selection (Chọn sai Faulty Pod)
- **Vị trí lỗi:** [`AI_backend/app/agents/kubernetes_agent.py`](file:///d:/NCKH/CapTone/AI_backend/app/agents/kubernetes_agent.py) (dòng 68–83).
- **Cơ chế lỗi:**
  - `candidate_pods = sorted(data.all_pods, key=lambda p: p.restart_count, reverse=True)`.
  - `mongodb-0` có 37 lần restart, trong khi `ecommerce-store-app` chỉ có 12 lần restart.
  - Thuật toán chọn ngay `mongodb-0` làm `faulty_candidate`.
  - Tiếp theo, vì `faulty_candidate` là `mongodb-0` (thuộc MongoDB), biến cờ `is_primary_database` bị bật thành `True`, kéo theo việc sinh ra playbook cơ sở dữ liệu `rs.stepDown(60)` cho ứng dụng thương mại điện tử!

### 3.3. DEF-03 — Incorrect Workload Ownership (Sai lệch Quyền sở hữu Workload)
- **Vị trí lỗi:** [`Agent/selfheal_agent/collectors/pods.py`](file:///d:/NCKH/CapTone/Agent/selfheal_agent/collectors/pods.py) (dòng 83–96 & dòng 391–404) và [`telemetryAggregator.service.ts`](file:///d:/NCKH/CapTone/Main_backend/src/services/telemetryAggregator.service.ts) (dòng 254–262).
- **Cơ chế lỗi:**
  - So khớp theo tiền tố chuỗi (`LIKE serviceId || '-%'`).
  - Khi hai workload có tên cùng tiền tố (ví dụ: `ecommerce-store` và `ecommerce-store-app`), việc so khớp chuỗi lỏng lẻo sẽ nhận nhầm toàn bộ Pod của `ecommerce-store-app` thành của `ecommerce-store`.
  - Thiếu hẳn việc kiểm tra chuỗi Kubernetes `ownerReferences` (`metadata.ownerReferences[0].uid` và `ownerReferences[0].kind`).

### 3.4. DEF-04 — Dependency Confusion (Nhầm lẫn Sự cố Dịch vụ Phụ thuộc)
- **Vị trí lỗi:** [`AI_backend/app/rca/cause_evaluator.py`](file:///d:/NCKH/CapTone/AI_backend/app/rca/cause_evaluator.py) & [`recommendation_agent.py`](file:///d:/NCKH/CapTone/AI_backend/app/agents/recommendation_agent.py).
- **Cơ chế lỗi:**
  - Khi ứng dụng web bị lỗi `ECONNREFUSED` hoặc `ENOTFOUND` tới upstream database, hệ thống không phân định được đâu là triệu chứng (symptom) và đâu là nguyên nhân thực sự (dependency failure).
  - Do DEF-01 và DEF-02, hệ thống kết luận chính web app bị CrashLoopBackOff và ra lệnh Restart Pod hoặc Replace Pod trên web app một cách vô ích, thậm chí kích hoạt lệnh chuyển vai trò Primary của MongoDB trên một web app.

---

## 4. MA TRẬN PHẠM VI SỬA ĐỔI (REPAIR SCOPE MATRIX)

### 4.1. Các file và function CẦN SỬA:

| STT | Tập tin | Function / Thành phần | Mục đích sửa đổi |
| :---: | :--- | :--- | :--- |
| 1 | `AI_backend/app/rca/models.py` | `EvidenceItem`, `ValidationResult` | Thêm metadata `resource_kind`, `resource_name`, `attribution_status` (`DIRECT`, `DEPENDENCY`, `UNATTRIBUTED`, `HISTORICAL`), tách `dependency_evidences` và `unattributed_evidences`. |
| 2 | `AI_backend/app/rca/evidence_collector.py` | `_resolve_event_identity`, `_classify_attribution`, `collect` | Ưu tiên metadata cấu trúc `involved_object`. Không forge target UID nếu thiếu. Regex log bóc tách UID thực. Phân loại bằng chứng thành `DIRECT`, `DEPENDENCY`, `UNATTRIBUTED`. |
| 3 | `AI_backend/app/rca/evidence_validator.py` | `validate` | Kiểm định UID nghiêm ngặt. Sự kiện thiếu UID -> `UNATTRIBUTED`. Khác UID -> loại bỏ hoặc chuyển `DEPENDENCY`. Bằng chứng mang historical UID -> đánh dấu `HISTORICAL`. Kiểm tra timestamp lặp/thiếu. |
| 4 | `AI_backend/app/agents/kubernetes_agent.py` | `_is_pod_of_workload`, `analyze` | Lọc `data.all_pods` nghiêm ngặt theo `ownerReferences` (Deployment -> ReplicaSet -> Pod, StatefulSet -> Pod). Chỉ chọn `faulty_pod` trong các Pod thuộc target workload. Khóa cờ `is_primary_database` cho Deployment/Web app. |
| 5 | `AI_backend/app/rca/cause_evaluator.py` | `_evaluate_dependency_failure`, `evaluate` | Gating nguyên nhân `dependency_failure`: Chỉ `CONFIRMED` khi có đủ 4 bằng chứng (App connection log, dependency failure, endpoint/DNS status, temporal correlation). Thiếu 1 trong 4 thì chỉ được `PROBABLE` (0.62–0.76). |
| 6 | `AI_backend/app/agents/recommendation_agent.py` | `recommend`, `_build_manual_playbook` | Khi gặp `dependency_failure`, trả về `action = NO_ACTION` cho web app; cấm sinh `rs.stepDown(60)` cho workload không phải StatefulSet database. |
| 7 | `Main_backend/src/controllers/ai.controller.ts` & `healingAction.service.ts` | `applyRecommendation`, `executeAction` | Thêm kiểm tra khóa tương tranh (Target Concurrency Lock): Từ chối tạo hoặc chạy action mới nếu target đang có action `RUNNING` hoặc `PENDING`. |

### 4.2. Các thành phần BẢO VỆ TUYỆT ĐỐI (KHÔNG ĐƯỢC PHÉP SỬA):
- `Main_backend/src/services/recoveryVerification.service.ts`: Giữ nguyên 100% cơ chế Adaptive Recovery Verification 3 -> 6 -> 12 samples.
- `AI_backend/app/services/prediction_service.py` & Checkpoint `gru_model_8feature_6rick_v1.pth`: Giữ nguyên tensor `[12, 8]`, 8 features, weights, bias và scaler.
- `Main_backend/src/services/ruleEngine.service.ts`: Giữ nguyên rào chắn an toàn Rule Engine.
- Toàn bộ các bài test hồi quy của Phase 6.1 và Phase 6.2 (`phase61SafetyHardening.test.ts`, `phase62AdaptiveRecovery.test.ts`).

---

## 5. KẾ HOẠCH TRIỂN KHAI CHI TIẾT (IMPLEMENTATION PLAN)

1. **Bước 1 (Schema & Models):** Mở rộng `models.py` với các trường định danh và attribution chuẩn mực.
2. **Bước 2 (Evidence Collector):** Cải tiến `_resolve_event_identity` và regex log để bảo toàn UID thực tế, cô lập event không rõ nguồn gốc.
3. **Bước 3 (Evidence Validator):** Thiết lập rào chắn kiểm định UID, cô lập `unattributed_evidences`, `dependency_evidences` và `historical_uids`.
4. **Bước 4 (Kubernetes Agent):** Bổ sung phân giải quan hệ sở hữu phân cấp qua `ownerReferences`, chặn đứng việc cướp quyền đại diện của Pod ngoại lai.
5. **Bước 5 (Cause Evaluator & Recommendation):** Xây dựng bộ quy tắc đánh giá nhân quả `dependency_failure` nghiêm ngặt và khóa các hành động phá hủy trên target.
6. **Bước 6 (Target Concurrency Lock):** Bổ sung Mutex kiểm tra action `RUNNING` trên target tại Main Backend.
7. **Bước 7 (Test Suite A01–A18):** Viết bộ 18 test cases bắt buộc tại `test_phase_a_evidence_isolation.py`.
8. **Bước 8 (Verification & Deliverables):** Chạy toàn bộ test suite, regression suite và lập các báo cáo nghiệm thu.
