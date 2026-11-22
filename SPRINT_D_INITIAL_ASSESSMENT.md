# SPRINT D — ĐÁNH GIÁ HIỆN TRẠNG BAN ĐẦU (INITIAL ASSESSMENT)
## (`SPRINT_D_INITIAL_ASSESSMENT.md`)

- **Dự án:** AI-Driven Proactive Self-Healing Infrastructure for SMEs
- **Chế độ thực thi:** `MODE 1 — AUDIT & PLANNING` (Strictly Read-Only với mã nguồn, migration, CSDL runtime và container `captone-*`)
- **Nhánh Git (Branch):** `feature/security`
- **Commit HEAD hiện tại:** `bfeb912 security du an` (kèm `e28c516`, `59bdb81`, `a8dd882`, `1e988e4` và `152` dòng thay đổi chưa commit từ Sprint B / CP-9 / Sprint C)
- **Ngày đánh giá:** 2026-11-19
- **Vai trò:** Senior Security Engineer, Application Security Architect, DevSecOps Engineer & Technical Lead

> **Quy tắc kiểm soát (Mode 1 Governance):** Không chỉnh sửa mã nguồn, schema, migration, test, Docker Compose hoặc Kubernetes manifests trong bước đánh giá này. Mọi container `captone-*` (`captone-main-backend`, `captone-postgres`, `captone-redis`, `captone-installer-service`) và CSDL runtime `captone_db` được giữ nguyên vẹn.

---

## 1. Tóm tắt Đánh giá & Mức độ Sẵn sàng

Qua đối soát trực tiếp mã nguồn, tài liệu Sprint A–C, cấu hình Docker/Kubernetes/CI-CD và trạng thái thực tế của CSDL kiểm thử `aiselfhealing_test`:
1. **Nền tảng bảo mật lõi đã có từ Sprint A/B/C:**
   - PostgreSQL RLS + `FORCE ROW LEVEL SECURITY` (`37/49` bảng, `86` policies), phân tách role `selfheal_app` / `selfheal_migrator` / `selfheal_readonly` / `selfheal_sysdefiner`, và `AsyncLocalStorage` + `SET LOCAL` trên `aiselfhealing_test`.
   - Refresh token HMAC-SHA256, rotation nguyên tử `FOR UPDATE`, `0s` reuse detection, Double-Submit CSRF, và `Main_backend` client PostgreSQL `DB_SSL_MODE=verify-full` fail-closed.
   - Internal HMAC-SHA256 + body SHA-256 + nonce replay guard giữa `Main_backend` và `AI_backend`; zero DB driver ở `AI_backend` và `Agent`; multi-service log redaction.
2. **Các lỗ hổng và blocker vẫn đang MỞ (cần xử lý trong Sprint D):**
   - Toàn bộ 9 Sprint C Findings (`AUD-E01`, `AUD-C01`, `AUD-D01`, `AUD-D02`, `AUD-G01`, `AUD-B01`, `AUD-A01`, `AUD-F01`, `AUD-I01`) **chưa được khắc phục trong mã nguồn** — hoàn toàn khớp thực tế.
   - **Phát hiện mới bổ sung qua Audit OWASP & Access Control (SD-06) trong Phase 0:**
     - **XSS / HTML Injection (HIGH):** `HitlNotificationService.renderResponsePage` và 4 hàm mẫu email trong `EmailService` không gọi `escapeHtml`; `Main_backend` tắt CSP (`contentSecurityPolicy: false`) và Nginx thiếu CSP + dính lỗi ghi đè `add_header` khiến các asset tĩnh và `/healthz` mất security headers; `avatarSchema` cho phép `data:image/svg+xml`; HITL 1-Click Approval/Reject vẫn chạy mutation qua HTTP `GET`.
     - **Access Control & Security Principle Violations (HIGH):** `AlertRuleService` vẫn giữ `SUPER_ADMIN` bypass và fallback `SELECT id FROM organizations LIMIT 1`; `NodeController.drainNode` và `PodController.restartPod` vẫn giữ `isPlatformAdmin` bypass thành viên tổ chức và lookup theo `name LIMIT 1` trước khi kiểm tenant; `HealingActionService.createPolicy` không kiểm chéo `body.organization_id` với membership/`x-organization-id`; `node.routes.ts` đặt metrics/timeseries trước middleware guard; `GET /organizations/:id/alert-settings` cho phép `VIEWER` xem cấu hình tích hợp; `UserController.recordMyActivity` cho phép user tự ghi `action` tùy ý vào `audit_logs`.
     - **SSRF & Injection Vectors (MEDIUM-HIGH):** `slack_webhook_url` không kiểm URL/IP nội bộ; `Agent/installer_service` tin cậy `X-Forwarded-Host`/`Host` để sinh `AGENT_SERVER_URL` và nội suy thô vào script/YAML; `Frontend` `ForgotPasswordPage` và `ResetPasswordPage` hiện vẫn đang **mock bằng `setTimeout`**, chưa gọi API `/auth/forgot-password` & `/auth/reset-password`; `Frontend` vẫn còn 6 module đọc token fallback từ `localStorage`/`sessionStorage`; `/api/v1/telemetry/logs/stream` và `telemetryWebSocket` vẫn nhận `?token=` qua URL query.
     - **DevSecOps / Runtime Mismatches (CRITICAL):** `./certs/` chưa tồn tại; `docker-compose.yml` đặt `NODE_ENV=production` nhưng thiếu `DB_SSL_MODE`/`REFRESH_TOKEN_PEPPER`; `docker-compose.prod.yml` dùng chung `${DB_PASSWORD}` cho cả `postgres` và `selfheal_app`; `k8s/postgres.yaml` thiếu `hba_file` & `fsGroup: 70`, `k8s/` thiếu Redis và dùng `NodePort 30500`; `cd.yml` có pre-backup fail-open, sai thứ tự `up -d` trước backup, probe `127.0.0.1:5000` không tồn tại ở host, và cả `ci.yml`/`cd.yml` đều thiếu `REFRESH_TOKEN_PEPPER` khi chạy `docker compose -f docker-compose.prod.yml config -q`.

---

## 2. Xác minh Repository, Dependencies & Test Baseline

### 2.1 Báo cáo & Tài liệu hiện có trong Repository
- **Sprint A / Phase A:** [PHASE_A_SOURCE_CODE_AUDIT.md](file:///d:/AISelfHealing/PHASE_A_SOURCE_CODE_AUDIT.md), [PHASE_A_IMPLEMENTATION_REPORT.md](file:///d:/AISelfHealing/PHASE_A_IMPLEMENTATION_REPORT.md), [PHASE_A_TEST_REPORT.md](file:///d:/AISelfHealing/PHASE_A_TEST_REPORT.md), [PHASE_A_REGRESSION_REPORT.md](file:///d:/AISelfHealing/PHASE_A_REGRESSION_REPORT.md) *(Lưu ý: không có file `SPRINT_A_SECURITY_CLOSURE_REPORT.md` tách riêng)*.
- **Sprint B / CP-9:** [SPRINT_B_RUNTIME_SECURITY_VERIFICATION_REPORT.md](file:///d:/AISelfHealing/SPRINT_B_RUNTIME_SECURITY_VERIFICATION_REPORT.md) (`PARTIAL — RUNTIME VERIFICATION INCOMPLETE`), [PHASE_2_CP9_SECURITY_REMEDIATION_REPORT.md](file:///d:/AISelfHealing/PHASE_2_CP9_SECURITY_REMEDIATION_REPORT.md) (`PASS WITH CONDITIONS`).
- **Sprint C:** [SPRINT_C_PHASE_0_DATA_SECURITY_AUDIT.md](file:///d:/AISelfHealing/SPRINT_C_PHASE_0_DATA_SECURITY_AUDIT.md), [SPRINT_C_PHASE_1_RLS_IMPLEMENTATION_REPORT.md](file:///d:/AISelfHealing/SPRINT_C_PHASE_1_RLS_IMPLEMENTATION_REPORT.md), [SPRINT_C_PHASE_2_REFRESH_TOKEN_SECURITY_REPORT.md](file:///d:/AISelfHealing/SPRINT_C_PHASE_2_REFRESH_TOKEN_SECURITY_REPORT.md), [SPRINT_C_PHASE_3_DATABASE_TLS_DATA_PROTECTION_REPORT.md](file:///d:/AISelfHealing/SPRINT_C_PHASE_3_DATABASE_TLS_DATA_PROTECTION_REPORT.md), [SPRINT_C_SECURITY_CLOSURE_REPORT.md](file:///d:/AISelfHealing/SPRINT_C_SECURITY_CLOSURE_REPORT.md), [SPRINT_C_FINAL_SECURITY_AUDIT_AND_CLOSURE_REPORT.md](file:///d:/AISelfHealing/SPRINT_C_FINAL_SECURITY_AUDIT_AND_CLOSURE_REPORT.md) (`PARTIAL` / `NOT READY — BLOCKED`).
- **Product Backlog:** Chưa có file Product Backlog riêng cho Sprint D trước phiên này (`Get-ChildItem -Filter "*backlog*"` rỗng). File [SPRINT_D_PRODUCT_BACKLOG.md](file:///d:/AISelfHealing/SPRINT_D_PRODUCT_BACKLOG.md) thiết lập Backlog chính thức cho Sprint D.

### 2.2 Stack & Package Versions Xác minh
- **Main Backend (`Main_backend/package.json`):** `express ^4.21.2`, `helmet ^8.0.0`, `pg ^8.23.0`, `ioredis ^6.0.0`, `jsonwebtoken ^9.0.3`, `bcryptjs ^3.0.3`, `nodemailer ^10.1.1`, `zod ^4.6.5`, `ws ^8.22.0`, `typescript ^5.7.2`, `tsx ^4.19.2`.
  - Test commands: `npm run build`, `npm run test:ci`, `npx tsx --test src/test/<file>.test.ts`.
- **Frontend (`Frontend/package.json`):** `react ^19.3.0`, `react-router-dom ^7.18.4`, `react-scripts 5.0.1`, `@testing-library/react ^16.3.3`. Chưa cài `dompurify`.
  - Test/build commands: `npm run build`, `npx react-scripts test --watchAll=false`.
- **AI Backend (`AI_backend/requirements.txt`):** `fastapi>=0.115,<1`, `uvicorn`, `pydantic>=2.8,<3`, `torch>=2.2,<3`, `openai>=2.0,<3`, `pytest>=8,<9`. *(Môi trường host Windows thiếu `fastapi`/`torch`/`openai`, cần chạy trong Docker image `AI_backend` hoặc venv Python 3.12 chuẩn).*
- **Agent & Installer (`Agent/requirements.txt`, `Agent/installer_service/requirements.txt`):** `kubernetes>=31.0.0`, `websockets>=14.0`, `pydantic>=2.10.0`, `aiohttp>=3.10.0`, `fastapi>=0.115.0`, `pytest>=8.0.0`.
- **Migrations hiện có (`Main_backend/migrations/`):** `00_init_full_database.sql`, `05_`..`14_`, `20_`..`31_sprint_c_phase2_refresh_tokens.sql` (`rollback/` có `29_`, `30_`, `31_`). Nếu thêm migration mới ở Sprint D phải bắt đầu từ **`32_...`** và **không** trùng số đã có.

### 2.3 Trạng thái Runtime Container hiện tại (`docker ps`)
- `captone-main-backend`: `Up 20 hours (healthy)`, `127.0.0.1:5005->5000/tcp`
- `captone-postgres`: `Up 20 hours (healthy)`, `127.0.0.1:5433->5432/tcp`
- `captone-redis`: `Up 20 hours (healthy)`, `127.0.0.1:6380->6379/tcp`
- `captone-installer-service`: `Up 2 days (healthy)`, `0.0.0.0:8100->8100/tcp` *(Lưu ý: vẫn đang bind `0.0.0.0:8100` trên runtime legacy)*
- `minikube`: `Up 47 hours`

---

## 3. Xác minh Chi tiết 9 Findings từ Sprint C Audit (`SD-01` → `SD-07`)

| Finding | Mức độ | Trạng thái xác minh hiện tại | Bằng chứng xác minh trực tiếp |
|---|---|---|---|
| **AUD-E01** | **CRITICAL** | **CONFIRMED OPEN** | `Main_backend/src/scripts/migrate.ts` (51 dòng) vẫn đọc toàn bộ `.sql` và chạy tuần tự không `schema_migrations`, không `pg_advisory_lock`, không transaction, không `--baseline`; `00_init_full_database.sql:1399,1414` vẫn còn `ON CONFLICT (email) DO UPDATE SET password_hash = crypt('AdminPassword123@', ...)` và trộn seed (org, cluster, agent_tokens, broadcasts lines `1433-1593`); `.github/workflows/cd.yml:271-278` chạy `up -d` trước backup và bỏ qua backup âm thầm nếu thiếu `BACKUP_ENCRYPTION_KEY`. |
| **AUD-C01** | **CRITICAL** | **CONFIRMED OPEN** | `d:\AISelfHealing\certs` không tồn tại (`Test-Path` = `False`). `nginx/nginx.conf:53-56` chỉ mở `:80` (chưa có `443 ssl`, redirect HTTPS, HSTS, CSP). `captone-postgres` chạy `ssl=off`. `docker-compose.staging.yml` chỉ có 3 service (`postgres`, `redis`, `main-backend`), thiếu `ai-backend`, `selfheal-frontend`, `nginx-proxy` để test HTTPS/WSS/E2E. |
| **AUD-D01** | **HIGH** | **CONFIRMED OPEN** | `OrganizationAlertSettingsModel` (`organizationAlertSettings.model.ts:67-90,148-215`) đọc/ghi plaintext `slack_webhook_url` & `pagerduty_key`; `organization.controller.ts:197,249` trả thẳng về API; `organization.routes.ts:332-343` chỉ dùng `requireOrgMember` khiến `VIEWER` đọc được secret tích hợp. |
| **AUD-D02** | **HIGH** | **CONFIRMED OPEN + ARCHITECTURAL DETAIL** | `hitlNotification.service.ts:151-196` sinh JWT riêng theo từng approver (`userId` + `jti`), chỉ lưu token người đầu tiên (`primaryToken`) plaintext vào `approvals.approval_token`, và `processQuickApprove`/`processQuickReject` (`lines 231-250, 460-479`) lookup `WHERE ap.id = $1` **mà chưa đối chiếu `token_hash`/`jti`**. Đổi sang một cột `approval_token_hash` đơn lẻ sẽ làm hỏng link của các approver thứ 2 trở đi nếu không thiết kế bảng/tập token theo `(approval_id, user_id, jti, token_hash)`. |
| **AUD-G01** | **MEDIUM-HIGH** | **CONFIRMED OPEN (BOTH BE + FE)** | `AuthService.requestPasswordReset` (`auth.service.ts:506-524`) tạo & lưu hash SHA-256 nhưng không gửi email (`EmailService` chưa có `sendPasswordResetEmail`). Ngoài ra, **phát hiện thêm trong Phase 0:** `Frontend/src/pages/ForgotPassword/index.jsx:44-59` và `Frontend/src/pages/ResetPassword/index.jsx:56-65` vẫn dùng `setTimeout(...)` giả lập demo, chưa gọi `authService.forgotPassword` / `authService.resetPassword`! |
| **AUD-B01** | **MEDIUM** | **CONFIRMED OPEN** | `rateLimit.middleware.ts:14-84` dùng in-memory `Map` trên `auth.routes.ts` & `agent.routes.ts` (`lines 211-267`); `Main_backend/src/app.ts` thiếu `app.set('trust proxy', ...)`; `SessionRevocationService` (`lines 50, 76`) fail-open khi Redis down ở non-prod và ném `503` ở prod trước `revokeSessionByRawToken` khi `/auth/logout` có Bearer token. |
| **AUD-A01** | **MEDIUM** | **CONFIRMED PARTIAL** | Truy vấn trực tiếp `aiselfhealing_test` ghi nhận `24` cặp `(table_name, column_name)` thuộc các cột `organization_id`/`cluster_id`/`environment_id`/`namespace_id` còn `is_nullable = 'YES'`. Trên `aiselfhealing_test`, ngoại trừ `audit_logs` có `331` dòng platform (`organization_id IS NULL` — hợp lệ theo thiết kế hybrid), các bảng nghiệp vụ `incidents`, `agent_metrics`, `node_metrics`, `notifications`, `alert_event_history`, `agents`, `logs`, `kubernetes_events`, `workloads`, `ai_predictions`, `healing_policies` hiện có **`0` dòng orphan**. Riêng `agents`, `incidents`, `workloads`, `logs`, `kubernetes_events`, `node_metrics`, `ai_predictions` lưu `cluster_id` dạng `character varying` nên cần phân biệt chặt cột FK UUID vs tên định danh trước khi siết `NOT NULL`. |
| **AUD-F01** | **MEDIUM** | **CONFIRMED PARTIAL** | `scripts/backup-postgres.sh` và `scripts/restore-postgres.sh` có trên repo, nhưng chưa chạy trên Linux host/VPS; `backup-postgres.sh:57` ghi full path vào `.sha256` dễ lỗi khi đổi thư mục; `restore-postgres.sh:47` chỉ guard chuỗi cố định `captone_db`; chưa có off-host storage và cron/monitoring; `cd.yml:276-278` chưa fail-closed. |
| **AUD-I01** | **LOW-MEDIUM** | **CONFIRMED OPEN** | `sprintASecurity.test.ts` mở `http.Server`, `WebSocketServer`, `TelemetryBufferService`/handles khiến Node tiến trình treo sau `TEL-07` (`after` có `process.exit(0)` nhưng có handle/timer ngăn runner kết thúc hoặc hook không hoàn tất); `SB01-01`, `SB03-01b`, `WS-10`, `Agent` `SUCCEEDED`, `11` Frontend UI suites lệch contract bảo mật mới; `AI_backend` & `installer_service` cần chạy pytest trong container chuẩn. |

---

## 4. Kết quả Audit OWASP Application Security (`SD-06`)

### 4.1 SQL Injection (`SD-06A`)
Đã kiểm tra toàn bộ `.query(...)` trong `Main_backend/src`, `AI_backend`, `Agent`:
- **Mặt bằng chung:** **Không phát hiện SQL injection khai thác được từ HTTP request trong code runtime hiện tại.** Các điều kiện `WHERE`, `ILIKE`, `LIKE`, `ANY($N)` đều dùng parameterized queries `$1, $2, ...`.
- **Chi tiết các truy vấn nội suy chuỗi đã đối chiếu:**
  - `ORDER BY` trong `alertEvent.model.ts`, `alertEventHistory.model.ts`, `alertRule.model.ts`, `metric.model.ts`, `organization.model.ts`: đều map qua allowlist (`Record<string, string>` hoặc `Array.includes`) và ternary `'ASC' : 'DESC'`.
  - `INTERVAL` / `MAKE_DATE` / `LIMIT` trong `report.model.ts` (`419,484,1613`), `adminAnalytics.service.ts` (`88-100`), `statistics.service.ts`: sử dụng `resolveTimeRangeDays` / `INTERVAL_MAP` / `Zod` schema validation và clamp integer.
- **Điểm yếu phòng thủ theo chiều sâu (Defense-in-Depth SQLi):**
  - `UserModel.count` & `UserModel.findMany` (`Main_backend/src/models/user.model.ts:255-321`) nhận thẳng chuỗi `whereClause`, `sortBy`, `order` ở tầng public static method (hiện an toàn nhờ `UserService.getAll`, nhưng dễ phát sinh SQLi nếu có caller mới gọi trực tiếp).
  - `Main_backend/src/scripts/benchmarkLargeMetrics.ts:264,277-279` nội suy biến vào `EXPLAIN` (chỉ là CLI benchmark, không nối HTTP).
  - **AI Backend & Agent:** Xác nhận `0` kết nối PostgreSQL / SQL driver.

### 4.2 Cross-Site Scripting (XSS) & Output Encoding (`SD-06B`)
- **Frontend React (`Frontend/src`):**
  - `0` sử dụng `dangerouslySetInnerHTML`, `innerHTML`, `outerHTML`, `document.write`, `eval(`, `new Function`. Các component Notifications, Audit Logs, AI RCA, Predictions, WebSocket consumers đều render qua JSX text escaping.
  - `OrganizationPage.jsx:338-341` kiểm tra `/^https?:\/\//i` cho link website.
  - **Cần gia cố:** `User validation` (`user.validation.ts:20-22`) cho phép `data:image/*` bao gồm `data:image/svg+xml`; `Breadcrumb.jsx:28` chưa kiểm scheme trên `item.href`.
- **Backend HTML Responses & Outbound Emails (`Main_backend/src`):**
  - **[HIGH] `HitlNotificationService.renderResponsePage` (`hitlNotification.service.ts:651-725`):** Không dùng `escapeHtml`, nội suy trực tiếp `options.title`, `options.message` (gồm `err.message`, `user.email`), `target_name`, `action_name`, `organization_name`, `approvedBy`, `dashboardUrl` vào phản hồi HTTP `text/html`.
  - **[MEDIUM-HIGH] `EmailService` (`email.service.ts`):** `sendVerificationEmail` (`189-208`), `sendInvitationEmail` (`288-290`), `sendGoogleWelcomeEmail` (`361-362`), và `sendHitlApprovalNotification` (`835-938`) không gọi `this.escapeHtml(...)` dù hàm này đã có sẵn trong lớp; ngoài ra `lines 140, 801-802` hardcode `http://localhost:${config.port}` khi tạo link email.

### 4.3 Security Headers, CSP, CORS, Trust Proxy & Client Storage (`SD-06C`)
- **Thiếu CSP toàn hệ thống:** `app.ts:17` cấu hình `helmet({ contentSecurityPolicy: false })`; `nginx/nginx.conf`, `Frontend/nginx.conf`, `Frontend/public/index.html` chưa thiết lập `Content-Security-Policy`.
- **Nginx `add_header` Override Bug:** `nginx/nginx.conf:59-62` (`/healthz`) và `Frontend/nginx.conf:22-26` (static assets) khai báo `add_header` riêng làm rơi toàn bộ security headers (`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`) kế thừa từ block cha.
- **Thiếu `trust proxy`:** `Main_backend/src/app.ts` chưa gọi `app.set('trust proxy', 1)` dù Nginx gửi `X-Forwarded-For` & `X-Forwarded-Proto`. Khiến `rateLimit.middleware.ts` gộp chung toàn bộ người dùng vào IP của Nginx container, và cho phép giả mạo `X-Forwarded-For`/`X-Forwarded-Proto` nếu đi thẳng port backend.
- **CORS wildcard risk:** `app.ts:27` cho phép `allowed.includes('*')` đi kèm `credentials: true`.
- **Client Token Exposure:** 6 file Frontend (`AuthContext.jsx`, `apiClient.js`, `authService.js`, `onboardingService.js`, `telemetryService.js`, `DashboardContext.jsx`) vẫn giữ fallback đọc token từ `localStorage`/`sessionStorage`; `/logs/stream` (`telemetry.routes.ts:100-108`) và `telemetryWebSocket.ts:64` vẫn nhận `?token=` trên query URL.

### 4.4 SSRF & Broken Access Control / Principle Violations (`SD-06C`)
- **SSRF tiềm ẩn:** `slack_webhook_url` (`organization.validation.ts:142`) chỉ kiểm `max(1000)`; `Installer Service` (`Agent/installer_service/routers/installer.py:57-76,338-343`) dựng `AGENT_SERVER_URL` từ `X-Forwarded-Host`/`Host` và nội suy trực tiếp `token` (thiếu strip `\r`), `cluster_id`, `ws_url` vào shell/YAML; `installer_service/main.py:28-34` dùng `CORSMiddleware(allow_origins=["*"], allow_credentials=True)` và mở `/docs` công khai.
- **Vi phạm Nguyên tắc Bảo mật #2, #3, #4 (Tenant & SUPER_ADMIN Bypass):**
  - `AlertRuleService.resolveUserOrganizations` & `enforceOrgAccess` (`alertRule.service.ts:28-30,121-128`) cho phép `SUPER_ADMIN` bỏ qua membership và tự fallback `SELECT id FROM organizations LIMIT 1`.
  - `NodeController.drainNode` (`node.controller.ts:102-135`) & `PodController.restartPod` (`pod.controller.ts:59-94`) giữ `isPlatformAdmin` bypass membership và lookup `WHERE (id::text = $1 OR name = $1) LIMIT 1` trước khi kiểm org.
  - `HealingActionService.createPolicy` (`healingAction.service.ts:817-837`) cho phép truyền `body.organization_id` khác với org đã authorize trong `x-organization-id`.
  - `node.routes.ts:11-12` đặt route `/:nodeId/metrics` & `/:nodeId/timeseries` trước guard admin ở dòng `14-19`.
  - `organization.routes.ts:332-343` cho phép `VIEWER` gọi `GET /:id/alert-settings`.
  - `UserController.recordMyActivity` (`user.controller.ts:345-356`) không validate allowlist cho `action` ghi vào `audit_logs`.
  - `healingAction.routes.ts:11-12` thực hiện phê duyệt/từ chối HITL bằng HTTP `GET` (nguy cơ email link scanner kích hoạt nhầm).

---

## 5. Phân loại Hiện trạng PBI (Completed / In-Progress / Not Started / Obsolete)

| Nhóm / Hạng mục | Trạng thái phân loại | Ghi chú kỹ thuật |
|---|---|---|
| PostgreSQL RLS `37` bảng + `FORCE RLS` + `selfheal_app` + `AsyncLocalStorage` + `SET LOCAL` trên `aiselfhealing_test` | **Đã hoàn thành (Test DB)** / **Chưa áp dụng Runtime DB** | Đạt `5/5 PASS` trên cả `postgres` và `selfheal_app`; chờ `SD-01` để rollout an toàn lên runtime. |
| Refresh Token Hashing + Rotation + `0s` Reuse Detection + CSRF/Origin + Frontend RAM Token | **Đã hoàn thành (Core Flow)** | Đạt `9/9 PASS` Backend & `4/4` Frontend; còn nợ distributed rate limit & policy Redis ở `SD-05`. |
| Client PostgreSQL TLS `verify-full` + `generate-pg-certs.sh` + `backup/restore` scripts + Multi-service Log Redaction | **Đang triển khai (Partial)** | Driver Node & script hoạt động trên test cô lập; thiếu Edge `:443 ssl`, cert runtime, VPS drill & off-host backup (`SD-02`, `SD-04`). |
| AI Internal HMAC-SHA256 + Body SHA-256 + Nonce Cache | **Đã hoàn thành (Single-worker)** | Chỉ lưu ý migrate `_SEEN_NONCES` sang Redis nếu scale `AI_backend` > 1 worker. |
| HITL Atomic Approve/Reject & Recovery Verification (`COMPLETED`) | **Đã hoàn thành (Lõi vòng đời)** | Còn mở lỗ hổng plaintext `approvals.approval_token`, XSS `renderResponsePage`, và `GET` mutation (`SD-03`, `SD-06`). |
| `SC-102` Migration Ledger, Advisory Lock, Baseline, Seed Split, Fail-closed CD Backup | **Chưa triển khai (`NOT STARTED`)** | Blocker P0 tuyệt đối (`SD-01`). |
| Alert Settings Encryption (`slack_webhook_url`, `pagerduty_key`) & HITL `token_hash` | **Chưa triển khai (`NOT STARTED`)** | Yêu cầu encryption key tách biệt + multi-approver token hash (`SD-03`). |
| SMTP Forgot Password Email & Frontend Real API Integration | **Chưa triển khai (`NOT STARTED`)** | Backend thiếu email template; Frontend `ForgotPassword`/`ResetPassword` đang chạy `setTimeout` mock (`SD-05`). |
| Distributed Redis Rate Limiting & `trust proxy` | **Chưa triển khai (`NOT STARTED`)** | Đang dùng per-process `Map` (`SD-05`). |
| OWASP SQLi/XSS/SSRF/Access Control Hardening & CSP | **Chưa triển khai (`NOT STARTED`)** | Phát hiện các lỗ hổng mới cần vá đồng bộ tại `SD-06`. |
| Các Legacy Tests khẳng định `'SUCCEEDED'`, `SUPER_ADMIN` auto-bypass, hoặc `AUTO`/`NOT_REQUIRED` | **Không còn phù hợp (`OBSOLETE / LEGACY MISMATCH`)** | Không được làm yếu bảo mật để ép pass; phân loại riêng để PO phê duyệt đồng bộ ở `SD-07`. |
