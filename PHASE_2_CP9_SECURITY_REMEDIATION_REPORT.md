# BÁO CÁO KHẮC PHỤC & KIỂM CHỨNG BẢO MẬT PHASE 2 — CP-9B / CP-9C / CP-9D
**Dự án:** AI-Driven Proactive Self-Healing Infrastructure for SMEs  
**Nhánh làm việc:** `feature/security`  
**Ngày báo cáo:** 2026-11-18  
**Kết luận tổng thể (Verdict):** **PASS WITH CONDITIONS**

---

## 1. Tóm tắt điều hành (Executive Summary)

Toàn bộ các lỗ hổng bảo mật và lỗi vòng đời thực thi trong quy trình **HITL (Human-In-The-Loop)** được ghi nhận tại báo cáo kiểm toán **CP-9A** đã được phân tích nguyên nhân gốc, khắc phục theo phạm vi kiểm soát chặt chẽ (**CP-9B.1 → CP-9B.6**), kiểm chứng bằng bộ test tích hợp chuyên sâu API + PostgreSQL + WebSocket (**CP-9C**, `8/8 PASSED`, exit `0`), và chạy hồi quy trên Backend, AI Service, Kubernetes Agent và Frontend (**CP-9D**).

- Hệ thống không còn cho phép chuyển trạng thái `COMPLETED` khi chưa có cả **bằng chứng thực thi thành công từ Agent** (`execution_attempts.status = 'COMPLETED'`) lẫn **kết quả hậu kiểm phục hồi thực tế** (`recovery_verifications.verification_result = true`).
- Thao tác `approveAction` / `rejectAction` / `quickApprove` / `quickReject` đã được bọc transaction `FOR UPDATE` nguyên tử trong PostgreSQL, kiểm tra `expires_at <= NOW()` trực tiếp theo đồng hồ CSDL, chống replay token 1-Click, chống xung đột đồng thời (chỉ 1 request thành công, các request còn lại trả `409 Conflict`).
- Đã loại bỏ hoàn toàn cơ chế bypass thành viên tổ chức cho `SUPER_ADMIN` / `SYSTEM_ADMIN` / `ADMIN` trong `HealingActionService` và `HitlNotificationService`, đồng thời xóa bỏ fallback `SELECT id FROM environments LIMIT 1` và fallback Agent socket đầu tiên khi định tuyến.
- Tất cả container `captone-*` thuộc phạm vi **CP-8** không hề bị agent dừng, xóa, sửa hay tái tạo.

---

## 2. Phạm vi & Kiểm soát thay đổi (Scope and Change Control)

| Hạng mục | Trạng thái tuân thủ |
| :--- | :--- |
| Chỉ sửa mã nguồn liên quan trực tiếp các lỗi CP-9A | **Tuân thủ** (8 file nguồn Backend + 1 migration cộng thêm không phá hủy + 1 file test mới) |
| Migration an toàn, không xóa/sửa dữ liệu hiện có | **Tuân thủ** (`ADD COLUMN IF NOT EXISTS`) |
| Không dừng, xóa, tái tạo hoặc chạy `docker compose` trên `captone-*` | **Tuân thủ** (0 lệnh Docker thay đổi container) |
| Cô lập test với CSDL test `aiselfhealing_test` (port `5432`) & `REDIS_ENABLED=false` | **Tuân thủ** (không đụng DB `5433` hay Redis `6380`) |
| Không làm yếu RBAC, HITL hay sửa test cũ để ép pass | **Tuân thủ** (các test cũ không tương thích được giữ nguyên và phân loại rõ tại Mục 14) |

---

## 3. Bảng ánh xạ Lỗi CP-9A → Biện pháp khắc phục (Defect-to-Fix Mapping)

| Mã lỗi CP-9A | Mô tả lỗi gốc | Biện pháp khắc phục (CP-9B) | File liên quan |
| :--- | :--- | :--- | :--- |
| **CP-9A-01 (Critical)** | `executeAction` ghi sẵn `execution_attempts = COMPLETED`, `recovery_verifications = true`, `healing_actions.execution_status = COMPLETED` trước khi dispatch Agent; khiến lỗi offline Agent không thể chuyển thành `FAILED`; `createAction`/`createHealingAction` mặc định `'APPROVED'`/`'COMPLETED'` khi thiếu trường trạng thái | **CP-9B.1**: `createAction`/`createHealingAction` mặc định `'PENDING'/'PENDING'`; `executeAction` chỉ khóa `RUNNING` + tạo attempt `'RUNNING'`; `action_result` thành công giữ `RUNNING` chờ hậu kiểm; chỉ `finalizeRecoveryVerificationOutcome` (có cả attempt `COMPLETED` + `verification_result = true`) mới chuyển `COMPLETED` | `healingAction.model.ts`, `healingAction.service.ts`, `recommendation.model.ts`, `agentWebSocket.ts`, `recoveryVerification.service.ts`, `telemetryPipeline.service.ts`, `ai.controller.ts` |
| **CP-9A-02 (High)** | `approveAction` / `rejectAction` dùng 2 truy vấn rời rạc, `WHERE id = $1` không khóa trạng thái `PENDING`, cho phép phê duyệt lại action đã `REJECTED`/`CANCELLED`/đồng thời | **CP-9B.2**: Bọc transaction `BEGIN/COMMIT`, `SELECT ... FOR UPDATE`, kiểm tra trạng thái `PENDING/PENDING`, `UPDATE ... WHERE ... AND approval_status = 'PENDING' AND execution_status = 'PENDING'`, kiểm tra `rowCount`, trả `409 Conflict` | `healingAction.model.ts` |
| **CP-9A-03 (High)** | Thiếu kiểm tra `approvals.expires_at` ở `approveAction`, `rejectAction`, `executeAction`, `processQuickApprove`, `processQuickReject` | **CP-9B.3**: So sánh `expires_at <= NOW()` nguyên tử trong PostgreSQL; tự động chuyển `approvals.status = 'EXPIRED'`, `healing_actions.approval_status = 'EXPIRED'`, `execution_status = 'CANCELLED'`, trả `409` | `healingAction.model.ts`, `healingAction.service.ts`, `hitlNotification.service.ts` |
| **CP-9A-04 (High)** | `SUPER_ADMIN` / `SYSTEM_ADMIN` được bypass kiểm tra thành viên `organization_members` tại `validateUserOrgAndCluster`, `validatePolicyOwnership`, `approveAction`, `rejectAction`, `abortAction`, `updateActionStatus`, `processQuickApprove`; `processQuickReject` truyền `user = undefined` | **CP-9B.4**: Xóa bỏ toàn bộ nhánh miễn trừ `isSystemAdmin`; mọi vai trò (kể cả `SUPER_ADMIN` / `SYSTEM_ADMIN` / `ADMIN`) phải là thành viên `ACTIVE` trong đúng `organization_id` với vai trò tổ chức hợp lệ (`SME_OWNER`/`DEVOPS`/`ADMIN`), kiểm tra đầy đủ cho cả `processQuickApprove` & `processQuickReject` | `healingAction.service.ts`, `healingAction.controller.ts`, `hitlNotification.service.ts` |
| **CP-9A-05 (High)** | Token 1-Click email không đối chiếu `healingActionId`/`organizationId` với CSDL, trả `200` khi replay | **CP-9B.5**: Thêm `jti` khi ký, ép đối chiếu `ap.healing_action_id === decoded.healingActionId` & `ap.organization_id === decoded.organizationId` (`403` nếu lệch), chống replay/đồng thời bằng `409`, bọc `approval_channel` an toàn | `hitlNotification.service.ts`, `migrations/27_add_approval_metadata_columns.sql` |
| **CP-9A-06 (Medium)** | `updateStatus` fallback trạng thái lạ về `'COMPLETED'`; `ai.controller.ts` fallback `SELECT id FROM environments LIMIT 1`; `agentWebSocket` fallback socket đầu tiên | **CP-9B.6**: Từ chối trạng thái lạ bằng `400`; ép điều kiện bằng chứng khi chuyển `COMPLETED` (`409`); xóa fallback `environments LIMIT 1` (`400`); `dispatchHealingActionToAgent` yêu cầu khớp chặt `cluster_id` + `environment_id` + `organization_id` | `healingAction.model.ts`, `ai.controller.ts`, `agentWebSocket.ts` |

---

## 4. Phân tích nguyên nhân gốc (Root Cause Analysis)

1. **Ngụy tạo hoàn tất sớm trong Model (`HealingActionModel.executeAction`):** Tác giả ban đầu viết `executeAction` như một mô phỏng đồng bộ (tạo `execution_attempts = COMPLETED`, `recovery_verifications = true`, `healing_actions = COMPLETED`) rồi mới cho tầng Service gửi WebSocket xuống Agent. Khi Agent ngoại tuyến hoặc lỗi, câu lệnh `WHERE execution_status = 'RUNNING'` của tầng Service khớp 0 dòng do bản ghi đã bị ghi `COMPLETED` từ trước.
2. **Mặc định an toàn ngược (`fail-open`) khi tạo action & cập nhật status:** `RecommendationModel.createHealingAction` mặc định `approval_status || 'APPROVED'` và `execution_status || 'COMPLETED'`; `HealingActionModel.updateStatus` ánh xạ chuỗi không hợp lệ về `'COMPLETED'`; `HealingActionModel.createAction` cho phép action `MANUAL` / thiếu trường tự trở thành `'APPROVED'` nếu loại hành động không bật cờ mặc định.
3. **Thiếu khóa hàng nguyên tử và hạn dùng:** `approveAction` / `rejectAction` chạy ngoài transaction nên race condition có thể ghi đè qua lại hoặc bỏ qua `expires_at`.
4. **Dư thừa đặc quyền `isSystemAdmin`:** Các helper kiểm tra tenant trong `HealingActionService` và `HitlNotificationService` giữ ngoại lệ cũ trước Sprint B, làm vô hiệu hóa nguyên tắc *“SUPER_ADMIN phải có tư cách thành viên ACTIVE trong tổ chức mục tiêu”*.
5. **Định tuyến dự phòng nguy hiểm:** `dispatchHealingActionToAgent` dùng fallback chọn socket mở đầu tiên khi thiếu `cluster_id`/`environment_id`, và `ai.controller.ts` lấy môi trường đầu tiên trong DB khi thiếu `incident.environment_id`.

---

## 5. Danh sách tệp đã thay đổi (Files Changed)

- [Main_backend/migrations/27_add_approval_metadata_columns.sql](file:///d:/AISelfHealing/Main_backend/migrations/27_add_approval_metadata_columns.sql) *(mới — non-destructive)*
- [Main_backend/src/models/recommendation.model.ts](file:///d:/AISelfHealing/Main_backend/src/models/recommendation.model.ts)
- [Main_backend/src/models/healingAction.model.ts](file:///d:/AISelfHealing/Main_backend/src/models/healingAction.model.ts)
- [Main_backend/src/services/healingAction.service.ts](file:///d:/AISelfHealing/Main_backend/src/services/healingAction.service.ts)
- [Main_backend/src/controllers/healingAction.controller.ts](file:///d:/AISelfHealing/Main_backend/src/controllers/healingAction.controller.ts)
- [Main_backend/src/services/hitlNotification.service.ts](file:///d:/AISelfHealing/Main_backend/src/services/hitlNotification.service.ts)
- [Main_backend/src/websocket/agentWebSocket.ts](file:///d:/AISelfHealing/Main_backend/src/websocket/agentWebSocket.ts)
- [Main_backend/src/services/recoveryVerification.service.ts](file:///d:/AISelfHealing/Main_backend/src/services/recoveryVerification.service.ts)
- [Main_backend/src/services/telemetryPipeline.service.ts](file:///d:/AISelfHealing/Main_backend/src/services/telemetryPipeline.service.ts)
- [Main_backend/src/controllers/ai.controller.ts](file:///d:/AISelfHealing/Main_backend/src/controllers/ai.controller.ts)
- [Main_backend/src/test/phase2Cp9HitlSecurity.test.ts](file:///d:/AISelfHealing/Main_backend/src/test/phase2Cp9HitlSecurity.test.ts) *(mới — CP-9C suite)*

---

## 6. Thay đổi cơ sở dữ liệu & An toàn Migration

- Đã bổ sung [27_add_approval_metadata_columns.sql](file:///d:/AISelfHealing/Main_backend/migrations/27_add_approval_metadata_columns.sql):
  ```sql
  ALTER TABLE approvals ADD COLUMN IF NOT EXISTS approval_token TEXT;
  ALTER TABLE approvals ADD COLUMN IF NOT EXISTS approval_channel VARCHAR(50);
  ```
- Không sửa, xóa, hay thay đổi giá trị enum hiện có (`approval_status = {PENDING,APPROVED,REJECTED,EXPIRED}`, `execution_status = {PENDING,RUNNING,COMPLETED,FAILED,CANCELLED,SKIPPED}`, `execution_mode = {AUTOMATIC,MANUAL,SEMI_AUTOMATIC}`).
- Đã áp dụng riêng lên CSDL test `aiselfhealing_test` (port `5432`); không chạm tới dữ liệu production/dev hay `captone-postgres` (`5433`).

---

## 7. Bằng chứng vòng đời thực thi (Lifecycle State Transition Evidence)

### 7.1 Chuỗi chuẩn: `CREATE → PENDING → APPROVE → DISPATCH → RUNNING → AGENT RESULT → RECOVERY VERIFICATION → COMPLETED`
Kiểm chứng trong test **A3** ([phase2Cp9HitlSecurity.test.ts](file:///d:/AISelfHealing/Main_backend/src/test/phase2Cp9HitlSecurity.test.ts)):
1. **CREATE → PENDING:** `POST /api/v1/healing/actions` (HIGH risk) trả `201`, bản ghi PostgreSQL có `approval_status = 'PENDING'`, `execution_status = 'PENDING'`, `approvals.status = 'PENDING'`.
2. **APPROVE → DISPATCH → RUNNING:** `POST /api/v1/healing/actions/:id/approve` khóa `approval_status = 'APPROVED'`, chuyển `execution_status = 'RUNNING'`, tạo `execution_attempts.status = 'RUNNING'`, gửi WS `execute_action` xuống Agent `cp9-agent-a1` (gửi lặp `POST /execute` ngay lúc này bị chặn `409`).
3. **AGENT RESULT (chưa hậu kiểm):** Agent gửi `action_result { status: 'COMPLETED' }` → `execution_attempts.status` cập nhật thành `'COMPLETED'`, nhưng `healing_actions.execution_status` **vẫn giữ `'RUNNING'`** (`result.agent_status = 'COMPLETED'`, `phase = 'AWAITING_RECOVERY_VERIFICATION'`). Gửi trùng lặp `action_result` lần 2 bị từ chối ghi (`⚠️ Ignored duplicate or non-RUNNING callback`, số attempt vẫn = `1`).
4. **RECOVERY VERIFICATION → COMPLETED:** `RecoveryVerificationService.evaluateAdaptiveRecovery` kiểm chứng 6 mẫu viễn trắc khỏe mạnh tăng dần → ghi `recovery_verifications.verification_result = true` và chuyển `healing_actions.execution_status = 'COMPLETED'`.

### 7.2 Trường hợp thất bại — Không bao giờ trở thành `COMPLETED`
- **Không có Agent kết nối (Test A2):** `POST /approve` cho `cp9-no-agent-target` khi không có Agent online → log `[AgentWebSocket] No connected agents available`, DB ghi `healing_actions.execution_status = 'FAILED'`, `execution_attempts.status = 'FAILED'`, `error_message` đầy đủ, `0` bản ghi `recovery_verifications`.
- **Agent trả `FAILED` (Test A3 Case 3):** Agent gửi `status: 'FAILED'` → DB ghi `healing_actions.execution_status = 'FAILED'`, `error_message = 'K8s RBAC forbidden'`.
- **Hậu kiểm thất bại sau khi Agent báo `COMPLETED` (Test A3 Case 2):** Agent báo `COMPLETED` nhưng 6 mẫu viễn trắc sau đó có CPU `98%` / RAM `96%` / HTTP 5xx `35%` → `recovery_verifications.verification_result = false` và `healing_actions.execution_status = 'FAILED'`.
- **Timeout thực thi (Test E1/Timeout):** Agent nhận lệnh nhưng không phản hồi sau `timeoutMs: 120ms` → watchdog cập nhật `healing_actions.execution_status = 'FAILED'` và `execution_attempts.status = 'FAILED'`.
- **Ép trạng thái thủ công thiếu bằng chứng (Test A3 Case 4):** `PATCH /actions/:id/status` với `BOGUS_UNKNOWN_STATUS` → `400`; với `COMPLETED` khi thiếu bằng chứng → `409`.

---

## 8. Bằng chứng Phê duyệt / Từ chối nguyên tử (Atomic Approval/Reject Evidence)

Kiểm chứng trong **B1/C1** và **G1**:
- **Model-level concurrency (5 luồng `HealingActionModel.approveAction` song song):** `1` fulfilled, `4` rejected (`ApiError 409`).
- **HTTP-level concurrency (5 request `POST /api/v1/healing/actions/:id/approve` song song):** `1` HTTP `200`, `4` HTTP `409`.
- **Approve & Reject đua nhau đồng thời:** `1` fulfilled, `1` rejected (`409`).
- **Chuyển trạng thái không hợp lệ:** Từ chối action đã `APPROVED` → `409`; phê duyệt action đã `REJECTED` → `409` (giữ nguyên `REJECTED` / `CANCELLED`).

---

## 9. Bằng chứng thực thi hạn dùng (Expiration Enforcement Evidence)

Kiểm chứng trong **B1/C1** và **E1**:
- Ranh giới hết hạn `expires_at = NOW() - interval '1 millisecond'` và `expires_at = NOW()`: truy vấn `POST /approve` và 3 luồng đồng thời trả `409` (`0` thành công, `3` thất bại), PostgreSQL tự chuyển `approval_status = 'EXPIRED'`, `execution_status = 'CANCELLED'`.
- **Dispatch sau khi hết hạn:** Action được phê duyệt hợp lệ, sau đó `expires_at` lùi về quá khứ trước lúc gọi `executeAction` → bị chặn `409`, chuyển thành `EXPIRED` / `CANCELLED` và không dispatch Agent.

---

## 10. Bằng chứng cô lập Tenant & RBAC (Tenant Isolation and RBAC Evidence)

Kiểm chứng trong **D1** và **G1**:
- `SUPER_ADMIN` **có** thành viên `ACTIVE` (role `DEVOPS`) tại Org A → `POST /actions/:id/approve`: **200**.
- `SUPER_ADMIN` **không có** thành viên Org A → `POST /actions/:id/approve`: **403**; `POST /actions/:id/abort`: **403**.
- `SUPER_ADMIN` có thành viên **`INACTIVE`** tại Org A → `POST /actions/:id/approve`: **403**.
- `SYSTEM_ADMIN` không có thành viên Org A → **403**.
- `ADMIN` của Org B truy cập action hoặc tạo action thuộc môi trường Org A → **403**.
- `VIEWER` tại Org A → **403**.
- `SUPER_ADMIN` gọi `GET /api/v1/healing/actions?cluster_id=...` **thiếu `organization_id`** → **403** (không fallback).

---

## 11. Bằng chứng bảo mật Token Quick Approve / Quick Reject

Kiểm chứng trong **E1**:
- Token ký cho `action B` dùng với `approvalId` của `action A` → **403**.
- Token ký cho `Org B` dùng với `action A` của `Org A` → **403**.
- `SUPER_ADMIN` không thuộc Org A dùng token quick-approve **và** quick-reject → đều **403**.
- 3 lời gọi `processQuickApprove` đồng thời cùng 1 token hợp lệ → **1** thành công (`200`), **2** bị chặn (`409`).
- Replay token sau khi đã `approve` hoặc `reject` → **409** (không còn trả `200`).
- Token khi `expires_at <= NOW()` → **409** (`EXPIRED`).

---

## 12. Bằng chứng định tuyến Agent (Agent Routing Evidence)

Kiểm chứng trong **F1** với 3 Agent WS đồng thời (`cp9-agent-a1` ở Org A/Cluster A1, `cp9-agent-a2` ở Org A/Cluster A2, `cp9-agent-b1` ở Org B/Cluster B1):
- Thiếu `cluster_id` → `{ dispatched: false, reason: 'MISSING_ROUTING_CONTEXT' }`.
- Thiếu `environment_id` → `{ dispatched: false, reason: 'MISSING_ROUTING_CONTEXT' }`.
- Lệch `cluster_id` của Org B ghép với `environment_id` của Org A → `{ dispatched: false, reason: 'NO_MATCHING_AGENT' }`.
- Đúng `CLUSTER_A2` + `ENV_A2` → `{ dispatched: true, recipient_agent: 'cp9-agent-a2' }`; `cp9-agent-a1` và `cp9-agent-b1` không nhận bất kỳ message nào.
- Đóng socket `cp9-agent-a2` → lệnh tiếp theo trả `{ dispatched: false, reason: 'NO_MATCHING_AGENT' }`, không rơi về `a1` hay `b1`.

---

## 13. Kết quả kiểm thử & Mã thoát thực tế (Test Results and Exact Exit Codes)

| Thành phần | Lệnh thực thi (đã chạy sau chỉnh sửa cuối) | Exit Code | Kết quả thực tế |
| :--- | :--- | :---: | :--- |
| **Main Backend TS** | `DB_NAME=aiselfhealing_test NODE_ENV=test REDIS_ENABLED=false npx tsc --noEmit` | `0` | 0 lỗi biên dịch TypeScript |
| **Main Backend CI** | `DB_NAME=aiselfhealing_test NODE_ENV=test REDIS_ENABLED=false npm run test:ci` | `0` | **4/4 pass** (`incidentModel`, `reportModel`) |
| **CP-9 HITL Security Suite** | `DB_NAME=aiselfhealing_test NODE_ENV=test REDIS_ENABLED=false npx tsx --test src/test/phase2Cp9HitlSecurity.test.ts` | `0` | **8/8 pass** (`A1, A2, A3, B1/C1, D1, E1, F1, G1`) |
| **Main Backend Security & Auth** | `npx tsx --test src/test/phase2Cp9HitlSecurity.test.ts src/test/sprintATelemetryPipeline.test.ts src/test/sprintBSecuritySB04.test.ts src/test/sprintBSecuritySB05Ticket.test.ts src/test/agentAuth.test.ts src/test/googleAuth.test.ts` | `0` | **37/37 pass** across 6 suites (`0 fail, 0 skipped`) |
| **Main Backend Combined Sprint A/B** | `npx tsx --test src/test/sprintAPostgresIntegration.test.ts ... src/test/sprintBSecuritySB01.test.ts src/test/sprintBSecuritySB03.test.ts ...` | `1` | **50 pass, 3 fail** (`PG-09`, `SB01-01`, `SB03-01b` — xem Mục 14) |
| **AI Backend** | `python -m pytest tests/test_sb02_security.py -v` | `0` | **5 passed, 1 skipped** (FastAPI integration test mặc định skip do cấu hình test cũ) |
| **Kubernetes Agent** | `python -m pytest tests/test_sb03_agent_security.py -v` | `0` | **5 passed** (`test_sb03_a01..a05`) |
| **Frontend Error Routing** | `npm test -- --watchAll=false src/pages/Error/__tests__/ErrorRouting.test.jsx` | `0` | **9 passed** (`1/1 suite`) |
| **Frontend HITL/Security Filtered** | `npx react-scripts test --watchAll=false src/pages/Dashboard/SelfHealing/ApprovalsPage.test.jsx src/pages/Admin/SelfHealing.test.jsx src/security/SprintBSecurity.test.jsx src/pages/Error/__tests__/ErrorRouting.test.jsx` | `1` | **32 passed, 1 failed** (`Admin/SelfHealing.test.jsx:192` — xem Mục 14) |
| **Frontend Production Build** | `npm run build` | `0` | Build thành công (chỉ có ESLint unused/deps warnings) |

---

## 14. Phân loại các test cũ thất bại (Legacy Test Failures and Classification)

Theo nguyên tắc không hạ chuẩn bảo mật hoặc tự ý sửa test cũ để lấy kết quả xanh:

| Tên test / Suite | Lệnh & Exit | Kết quả quan sát | Phân loại | Giải thích |
| :--- | :---: | :--- | :--- | :--- |
| `sprintAPostgresIntegration.test.ts` (`PG-09`) | Exit `1` (trong tổ hợp) | `PATCH /healing/actions/:id/status` gửi `{ status: 'COMPLETED' }` nhận `409` thay vì `200` | **LEGACY CONTRACT MISMATCH** | Test cũ tự ép `COMPLETED` trực tiếp không có `execution_attempts` + `recovery_verifications`; quy tắc mới CP-9B.1/CP-9B.6 cấm ép `COMPLETED` không bằng chứng |
| `sprintBSecuritySB01.test.ts` (`SB01-01`) | Exit `1` (trong tổ hợp) | `HealingActionModel.updateStatus(ACT_A, 'COMPLETED', ...)` nhận `409` | **LEGACY CONTRACT MISMATCH** | Giống `PG-09`: `ACT_A` được chèn thô chưa có attempt và hậu kiểm hợp lệ |
| `sprintBSecuritySB03.test.ts` (`SB03-01b`) | Exit `1` (trong tổ hợp) | `createAction` với `ACT_TYPE_SB03` (`requires_approval_by_default = TRUE`) nhưng truyền `requires_approval: false` không có policy nhận `PENDING` thay vì `APPROVED` | **LEGACY CONTRACT MISMATCH** | CP-9B.1 bảo vệ cờ `requires_approval_by_default = true` khi không có chính sách `healing_policies` hợp lệ |
| `phase62AdaptiveRecovery.test.ts`, `phase61SafetyHardening.test.ts`, `phase6ClosedLoop.test.ts` | Exit `1` | PostgreSQL báo `invalid input value for enum execution_mode: "AUTO"` | **LEGACY CONTRACT MISMATCH** | Script Phase 6 chèn SQL thô `'AUTO'::execution_mode` thay vì enum chuẩn `'AUTOMATIC'` của schema hiện hành |
| `phase5Integration.test.ts`, `rcaAiIntegration.test.ts` | Exit `1` | Lỗi kết nối AI Backend tại `http://localhost:8001` | **ENVIRONMENT ISSUE** | Dịch vụ AI Backend không được bật tại `localhost:8001` trong môi trường kiểm thử cô lập |
| `Frontend/src/pages/Admin/SelfHealing.test.jsx` (`line 192`) | Exit `1` | Kỳ vọng `<ExecutionStatusBadge status="SUCCEEDED" />` render `"Thành Công"` | **LEGACY CONTRACT MISMATCH** | Badge Frontend đã chuyển sang chuẩn canonical `COMPLETED` ở Sprint B |

---

## 15. Rủi ro còn lại (Remaining Risks)

1. **Tương thích ngược của test cũ (`PG-09`, `SB01-01`, `SB03-01b`, `SelfHealing.test.jsx`):** Cần một đợt cập nhật có kiểm soát của PO để bổ sung bằng chứng thực thi/hậu kiểm vào `PG-09`/`SB01-01`, dùng action type không khóa `requires_approval_by_default` hoặc có policy thật cho `SB03-01b`, và đổi `'SUCCEEDED'` sang `'COMPLETED'` ở `SelfHealing.test.jsx`.
2. **Kiểm thử Redis cô lập:** Các bài test chạy với `REDIS_ENABLED=false` nhằm tránh chạm tới Redis cổng `6380`. Cơ chế ticket WS dùng 1 lần / blacklist / rate-limit dưới tải Redis thật chưa được tái kiểm trên container Redis riêng trong lần chạy này.
3. **`captone-installer-service` trên host (xem CP-8):** Vẫn còn container `cc4b8708941d` từ `2026-11-11` mở `0.0.0.0:8100->8100` (`SecurityOpt: null`).

---

## 16. Trạng thái CP-8 (CP-8 Status)

- Agent **tuyệt đối không** dừng, xóa, sửa hoặc tái tạo bất kỳ container `captone-*` nào trong suốt quá trình thực hiện CP-9B/9C/9D.
- Ghi nhận quan sát đọc `docker inspect` tại thời điểm `2026-11-18T20:33:37+07:00`:
  - Ba container `captone-main-backend` (`88fba5ca86f9`, created `13:33:13Z`), `captone-postgres` (`0b8747927182`, created `13:29:11Z`), và `captone-redis` (`e4e157085266`, created `13:29:11Z`) đã được tạo lại bởi thao tác bên ngoài với cấu hình `127.0.0.1` (`5005`, `5433`, `6380`) và `no-new-privileges:true`.
  - Riêng `captone-installer-service` (`cc4b8708941d`, created `2026-11-11T12:45:25Z`) **vẫn chưa được tái tạo** và tiếp tục mở `0.0.0.0:8100->8100` với `SecurityOpt: null`.
- Quyền nghiệm thu cuối cùng và quyết định xử lý container còn lại của **CP-8** hoàn toàn thuộc về **Product Owner**.

---

## 17. Hành động khuyến nghị tiếp theo (Recommended Next Actions)

1. **Product Owner rà soát & phê duyệt cập nhật tương thích 4 test cũ:** `PG-09`, `SB01-01`, `SB03-01b`, và `Admin/SelfHealing.test.jsx` (cộng thêm Phase 6 standalone SQL `'AUTOMATIC'`).
2. **Tái tạo `captone-installer-service` (CP-8):** Nếu PO phê duyệt, chạy `docker compose up -d --build --force-recreate installer-service` để chuyển cổng `8105` về `127.0.0.1` và bật `no-new-privileges:true`.
3. **Áp dụng migration `27_add_approval_metadata_columns.sql` lên DB runtime** trước khi triển khai bản build mới của `main-backend`.
4. **Chạy thêm bài kiểm tra trên Redis test cô lập** (container riêng trên cổng phụ tách biệt `6380`) để hoàn tất xác minh end-to-end khi bật Redis.
