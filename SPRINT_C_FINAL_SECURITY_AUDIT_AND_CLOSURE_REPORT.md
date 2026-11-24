# BÁO CÁO KIỂM TOÁN BẢO MẬT TỔNG THỂ, XÁC MINH & ĐÁNH GIÁ NGHIỆM THU SPRINT C
## (`SPRINT_C_FINAL_SECURITY_AUDIT_AND_CLOSURE_REPORT.md`)

- **Dự án:** AI-Driven Proactive Self-Healing Infrastructure for SMEs
- **Nhánh Git (Branch):** `feature/security`
- **Commit HEAD hiện tại:** `bfeb9129ac8e1f4793d47a3e93bc12dfaf763f6a` (`bfeb912 security du an`) + các thay đổi chưa commit của Sprint B / CP-9 / Sprint C (tổng `151` dòng trong `git status --short`)
- **Ngày kiểm toán:** 2026-11-19
- **Vai trò đánh giá:** Principal Application Security Engineer, Senior PostgreSQL Security Architect, DevSecOps Auditor & QA Lead
- **Kết luận triển khai Sprint C (Sprint C Implementation Verdict):** **`PARTIAL`**
- **Quyết định sẵn sàng Production (Production Readiness Decision):** **`NOT READY — BLOCKED`**

> **Tuyên bố thẩm quyền (Governance Notice):** Báo cáo này được lập theo chế độ **Read-Only Audit** độc lập (không sửa mã nguồn, không sửa migration, không tác động tới các container `captone-*` hay CSDL runtime). Kiểm toán viên **không tuyên bố đóng Sprint C** và **không công nhận Production Ready**; **Product Owner giữ toàn quyền phê duyệt nghiệm thu hoặc giữ lại các hạng mục còn mở**.

---

## 1. Tóm tắt điều hành (Executive Summary)

Sprint C (Data Security Hardening) đã triển khai và kiểm chứng được **3 trụ cột cốt lõi trên môi trường kiểm thử cô lập** (`aiselfhealing_test` PostgreSQL 18.6 và container TLS cô lập `postgres:16-alpine`), gồm:
1. **PostgreSQL Row-Level Security (RLS) & Phân tách Role tối thiểu:** `37/49` bảng nghiệp vụ & audit đã bật `ENABLE` + `FORCE ROW LEVEL SECURITY` với `86` policies; role `selfheal_app` (`NOSUPERUSER NOBYPASSRLS`) chịu sự kiểm soát hoàn toàn của RLS dưới cơ chế ngữ cảnh giao dịch cục bộ (`AsyncLocalStorage` + `SET LOCAL`).
2. **Refresh Token & Session Lifecycle Hardening:** Access JWT rút xuống `15m` gắn `tv` (`token_version`); Refresh Token ngẫu nhiên 256-bit lưu dưới dạng HMAC-SHA256 trong `user_sessions` + `refresh_tokens`; rotation nguyên tử `FOR UPDATE` + reuse detection `0s` thu hồi toàn bộ `family_id`; cookie `HttpOnly; SameSite=Lax; Path=/api/v1/auth` kèm Double-Submit CSRF & `Origin` check; Frontend chuyển access token sang bộ nhớ RAM với single-flight 401 refresh.
3. **PostgreSQL TLS Client/Config, Encrypted Backup/Restore & Log Redaction:** `Main_backend` (`pg.Pool` & migrator) thực thi fail-closed `DB_SSL_MODE=verify-full` ở staging/production, kiểm chứng thành công với PostgreSQL 16 TLSv1.3 thật, backup `pg_dump` mã hóa AES-256-PBKDF2 + kiểm thử restore DB mới, và bộ lọc che giấu secret trên Node.js (`Main_backend`) lẫn Python (`AI_backend`, `Agent`).

Tuy nhiên, kiểm toán độc lập xác nhận Sprint C đạt mức **`PARTIAL`** và hệ thống **`NOT READY — BLOCKED`** đối với Production vì các cổng bắt buộc sau **chưa hoàn tất**:
- **Blockers bắt buộc:**
  1. **`SC-102` (Migration Governance — Gate A = `FAIL`):** `Main_backend/src/scripts/migrate.ts` chưa có bảng `schema_migrations`, chưa có PostgreSQL advisory lock, chưa bọc transaction từng migration, chưa có `--baseline`; `00_init_full_database.sql` vẫn còn `ON CONFLICT DO UPDATE` ghi đè mật khẩu admin mặc định.
  2. **Runtime & Edge HTTPS chưa kích hoạt (Gate D = `PARTIAL`):** `nginx/nginx.conf` mới mở cổng `80` (chưa cấu hình `443 ssl`); `./certs/postgres` chưa được sinh và gắn vào runtime; `docker-compose.staging.yml` chưa chạy smoke test full-stack; container `captone-*` và DB `captone_db`/`aiselfheal` vẫn chạy cấu hình cũ (`ssl = off`, `postgres` superuser, chưa chạy Migrations `29–31`).
  3. **Dữ liệu nhạy cảm & Password Reset còn thiếu (Gate C = `PARTIAL`):** `organization_alert_settings` (`slack_webhook_url`, `pagerduty_key`) và `approvals.approval_token` vẫn lưu plaintext trong DB; `/auth/forgot-password` mới tạo & lưu hash token trong DB nhưng **chưa có email template / SMTP dispatch**.
  4. **Nợ kiểm thử & giới hạn vận hành:** `sprintASecurity.test.ts` bị treo sau `TEL-07` (`TEST HARNESS ISSUE`), `rateLimit.middleware.ts` vẫn dùng `Map` nội bộ tiến trình thay vì Redis, và các suite Python (`AI_backend` 4 file ML/FastAPI, `installer_service`) cần chạy trong container có đủ `torch`/`fastapi`.

---

## 2. Phạm vi Sprint C & Phương pháp kiểm toán

- **Phạm vi kiểm tra:** Toàn bộ 12 mục tiêu kiểm toán từ RLS, DB roles, Connection pooling, Refresh token/Session, PostgreSQL TLS & Edge HTTPS, Sensitive data encryption, Log/Error sanitization, Migration governance (`SC-102`), Backup/Restore, Password reset & email dispatch, Regression & test quality, tới Deployment readiness.
- **Kiểm soát thay đổi nghiêm ngặt:** Phiên kiểm toán này chỉ thực hiện đọc mã nguồn, truy vấn metadata catalog chỉ-đọc trên `aiselfhealing_test`, kiểm tra `docker ps` và đối chiếu kết quả chạy thử nghiệm cô lập từ Phase 4 (không chỉnh sửa bất kỳ file nguồn, migration, test, secret hay container `captone-*` nào).

---

## 3. Phiên bản mã nguồn & Trạng thái Git

- **Branch:** `feature/security`
- **Commit HEAD:** `bfeb9129ac8e1f4793d47a3e93bc12dfaf763f6a` (`bfeb912 security du an`)
- **Các commit gần trước đó:** `e28c516` (`fix(login): remove residual merge conflict markers in LoginPage`), `59bdb81` (`Merge branch 'feature/landingpage'`)
- **`git status --short`:** Ghi nhận `151` dòng thay đổi chưa commit bao phủ các bản vá Sprint B, CP-9 và toàn bộ Sprint C Phases 0–4 trên `Main_backend`, `AI_backend`, `Agent`, `Frontend`, `k8s/`, `nginx/`, `scripts/`, `docker-compose*.yml`, `.github/workflows/cd.yml` và các báo cáo `.md`.
- **Trạng thái container runtime (`docker ps`):** `captone-main-backend` (`Up 20 hours`), `captone-postgres` (`Up 20 hours`, `127.0.0.1:5433->5432`), `captone-redis` (`Up 20 hours`, `127.0.0.1:6380->6379`), `captone-installer-service` (`Up 2 days`, `0.0.0.0:8100->8100`) giữ nguyên vẹn, không bị khởi động lại hay chỉnh sửa.

---

## 4. Danh mục bằng chứng đã đối soát (Evidence Inventory)

### 4.1 Tài liệu báo cáo hiện có trong kho mã
- [SPRINT_C_PHASE_0_DATA_SECURITY_AUDIT.md](file:///d:/AISelfHealing/SPRINT_C_PHASE_0_DATA_SECURITY_AUDIT.md) — Có mặt (`READY WITH CONDITIONS`).
- [SPRINT_C_PHASE_1_RLS_IMPLEMENTATION_REPORT.md](file:///d:/AISelfHealing/SPRINT_C_PHASE_1_RLS_IMPLEMENTATION_REPORT.md) — Có mặt.
- [SPRINT_C_PHASE_2_REFRESH_TOKEN_SECURITY_REPORT.md](file:///d:/AISelfHealing/SPRINT_C_PHASE_2_REFRESH_TOKEN_SECURITY_REPORT.md) — Có mặt.
- [SPRINT_C_PHASE_3_DATABASE_TLS_DATA_PROTECTION_REPORT.md](file:///d:/AISelfHealing/SPRINT_C_PHASE_3_DATABASE_TLS_DATA_PROTECTION_REPORT.md) — Có mặt.
- [SPRINT_C_SECURITY_CLOSURE_REPORT.md](file:///d:/AISelfHealing/SPRINT_C_SECURITY_CLOSURE_REPORT.md) — Có mặt (`PASS WITH CONDITIONS`).
- [SPRINT_B_RUNTIME_SECURITY_VERIFICATION_REPORT.md](file:///d:/AISelfHealing/SPRINT_B_RUNTIME_SECURITY_VERIFICATION_REPORT.md) — Có mặt (`PARTIAL — RUNTIME VERIFICATION INCOMPLETE`).
- [PHASE_2_CP9_SECURITY_REMEDIATION_REPORT.md](file:///d:/AISelfHealing/PHASE_2_CP9_SECURITY_REMEDIATION_REPORT.md) — Có mặt (`PASS WITH CONDITIONS`).
- **Tài liệu thiếu / không tồn tại riêng lẻ (Missing Evidence):**
  - Không có file `SPRINT_A_SECURITY_CLOSURE_REPORT.md` riêng biệt trong repo (chỉ có nhóm `PHASE_A_*.md` về Evidence Isolation/RCA và file test `Main_backend/src/test/sprintASecurity.test.ts`).
  - Không có báo cáo `CP-8` / `CP-9A` tách rời thành file `.md` (nội dung CP-9A được tổng hợp tham chiếu trong `PHASE_2_CP9_SECURITY_REMEDIATION_REPORT.md`).

### 4.2 Tệp mã nguồn, cấu hình & migration được đối soát trực tiếp
- Migrations: `Main_backend/migrations/00_init_full_database.sql`, `29_create_alert_tables.sql`, `30_sprint_c_phase1_rls_and_roles.sql`, `31_sprint_c_phase2_refresh_tokens.sql`, `migrations/rollback/29_*.down.sql`, `30_*.down.sql`, `31_*.down.sql`.
- Database & Context: `Main_backend/src/config/env.ts`, `database.ts`, `dbContext.ts`, `redis.ts`, `Main_backend/src/scripts/migrate.ts`, `create-admin.ts`, `create-user-letanquoc.ts`.
- Auth & Session: `Main_backend/src/middlewares/auth.middleware.ts`, `csrfOrigin.middleware.ts`, `rateLimit.middleware.ts`, `Main_backend/src/services/refreshToken.service.ts`, `sessionRevocation.service.ts`, `auth.service.ts`, `user.service.ts`, `Main_backend/src/controllers/auth.controller.ts`, `routes/auth.routes.ts`, `Frontend/src/services/apiClient.js`, `authService.js`, `Frontend/src/context/AuthContext.jsx`.
- Data Encryption & Sanitization: `Main_backend/src/models/organizationAlertSettings.model.ts`, `Main_backend/src/services/hitlNotification.service.ts`, `email.service.ts`, `audit.service.ts`, `twoFactor.service.ts`, `Main_backend/src/utils/logSanitizer.ts`, `Main_backend/src/middlewares/error.middleware.ts`, `Main_backend/src/controllers/ai.controller.ts`, `aiModelRegistry.controller.ts`, `app.ts`, `AI_backend/app/core/logging.py`, `Agent/selfheal_agent/utils/redaction.py`, `logger.py`.
- Infra / CI / Scripts: `docker-compose.yml`, `docker-compose.staging.yml`, `docker-compose.prod.yml`, `k8s/postgres.yaml`, `k8s/backend.yaml`, `k8s/secrets.example.yaml`, `nginx/nginx.conf`, `.github/workflows/ci.yml`, `.github/workflows/cd.yml`, `scripts/certs/generate-pg-certs.sh`, `scripts/backup-postgres.sh`, `scripts/restore-postgres.sh`.

---

## 5. Kiến trúc cuối cùng & Luồng dữ liệu thực tế

- **Trên môi trường kiểm thử cô lập (`aiselfhealing_test`):**
  1. HTTP/WS đi qua `Main_backend` → `authenticateToken` / `wsTicket` / `agentAuth` thiết lập `AsyncLocalStorage` (`AUTH` → `TENANT` hoặc `PLATFORM_ADMIN`/`SYSTEM`).
  2. Mọi query qua `pool.query` / `pool.connect` / `withTenantTx` tự động mở giao dịch cục bộ (`BEGIN ... SELECT set_config('app.access_scope', ..., true), set_config('app.current_org_id', ..., true), set_config('app.current_user_id', ..., true) ... COMMIT`), chạy dưới role `selfheal_app` bị ép `FORCE RLS`.
  3. Luồng đăng nhập cấp Access JWT (`15m`, chứa `tv`) trong JSON body (lưu RAM ở Frontend) và Refresh Token ngẫu nhiên trong cookie `HttpOnly; SameSite=Lax; Path=/api/v1/auth` kèm CSRF cookie `selfheal_csrf_token`.
  4. Luồng kết nối PG hỗ trợ `DB_SSL_MODE=verify-full` (đã xác minh TLSv1.3 với container `postgres:16-alpine` cô lập); `AI_backend` và `Agent` không kết nối trực tiếp tới PostgreSQL.
- **Trên môi trường runtime hiện hữu (`captone-*`):** Vẫn giữ nguyên kiến trúc tiền Sprint C (`nginx` `:80`, `captone-postgres` `ssl=off`, user `postgres`, chưa áp dụng Migrations `29–31`).

---

## 6. Workstream A — Đánh giá PostgreSQL RLS & Cách ly Tenant

### 6.1 Kiểm chứng phân loại 49 bảng trên `aiselfhealing_test`
Truy vấn trực tiếp catalog `pg_class` + `pg_policies`:
- **Tổng số bảng schema `public`:** `49` bảng (`44` nền tảng + `3` bảng `alert_*` ở Migration 29 + `user_sessions`, `refresh_tokens` ở Migration 31).
- **RLS Enabled & Forced:** `37` bảng (`RLS_NOT_FORCED: []` — `100%` bảng bật RLS đều đã bật `FORCE ROW LEVEL SECURITY`).
- **Tổng số Policies:** `86` policies (`ALL: 37`, `SELECT: 40`, `INSERT: 4`, `UPDATE: 3`, `DELETE: 2`).

| Phân loại | Số lượng | Danh sách bảng | Trạng thái RLS |
| --- |---:| --- | --- |
| **`TENANT_SCOPED` (Direct `organization_id`)** | 13 | `organizations`, `environments`, `healing_policies`, `incidents`, `agent_metrics`, `node_metrics`, `organization_alert_settings`, `organization_invitations`, `organization_members`, `organization_profiles`, `notifications` *(hybrid user+org)*, `alert_rules`, `alert_events` | `ENABLE + FORCE RLS` |
| **`TENANT_SCOPED` (Indirect qua Parent FK)** | 23 | `clusters`, `agents`, `agent_heartbeats`, `agent_tokens`, `namespaces`, `nodes`, `services`, `workloads`, `deployments`, `pods`, `logs`, `kubernetes_events`, `ai_predictions`, `prediction_inputs`, `rca_analyses`, `rca_evidences`, `ai_recommendations`, `healing_actions`, `approvals`, `execution_attempts`, `recovery_verifications`, `policy_actions`, `alert_event_history` | `ENABLE + FORCE RLS` |
| **`AUDIT` (Hybrid Tenant + Platform)** | 1 | `audit_logs` *(tenant chỉ thấy `organization_id = app_current_org_id()`, ẩn `IS NULL`)* | `ENABLE + FORCE RLS` |
| **`GLOBAL` (Danh mục nền tảng)** | 4 | `system_roles`, `organization_roles`, `healing_action_types`, `ai_models` | Không RLS (`SELECT` toàn cục; khóa ghi `system_roles`/`organization_roles` với `selfheal_app`) |
| **`SYSTEM_MANAGED`** | 1 | `system_broadcasts` | Không RLS |
| **`AUTHENTICATION`** | 7 | `users`, `user_system_roles`, `user_two_factor`, `email_verification_tokens`, `password_reset_tokens`, `user_sessions`, `refresh_tokens` | Không bật tenant RLS (định danh toàn cục / đa tổ chức, kiểm soát theo `user_id` + `SECURITY DEFINER` + RBAC) |
| **`UNCLEAR`** | 0 | *(Không còn bảng chưa phân loại trên `aiselfhealing_test`)* | — |

### 6.2 Các phát hiện thực tế còn tồn tại ở tầng Schema & Pool
- **Finding `AUD-A01` (Medium — Nullable Tenant Columns):** Truy vấn `pg_attribute` xác nhận các cột `incidents.organization_id`, `agent_metrics.organization_id`, `node_metrics.organization_id`, `agents.cluster_id/environment_id`, `logs.cluster_id/namespace_id`, `kubernetes_events.cluster_id/namespace_id`, `workloads.cluster_id/namespace_id`, `ai_predictions.cluster_id` vẫn có `attnotnull = false` (dù hiện tại trên `aiselfhealing_test` có `0` bản ghi mồ côi `inc_null=0, agent_m_null=0, node_m_null=0`). Các bảng gián tiếp như `logs`/`kubernetes_events` vẫn đánh giá RLS bằng `EXISTS` join.
- **Finding `AUD-A02` (Low — `audit_logs` Privilege trên `selfheal_app`):** Truy vấn `information_schema.role_table_grants` cho thấy `selfheal_app` giữ quyền `DELETE,INSERT,SELECT,UPDATE` trên `audit_logs` (và `audit_logs` dựa vào RLS policy để kiểm soát, thay vì thu hồi hẳn `UPDATE`/`DELETE` ở cấp SQL `GRANT` đối với runtime API).
- **Finding `AUD-A03` (Info — Helper `SECURITY DEFINER`):** Có đúng `5` hàm (`fn_authenticate_agent_token`, `fn_list_active_organization_ids`, `fn_lookup_approval_context`, `fn_lookup_invitation_by_token_hash`, `fn_user_has_org_membership`) thuộc sở hữu `selfheal_sysdefiner` (`NOLOGIN BYPASSRLS`).

### 6.3 Kiểm chứng cách ly Context & Negative Tests
- `sprintCPhase1Rls.test.ts` chạy dưới cả `DB_USER=postgres` lẫn `DB_USER=selfheal_app` đều đạt **5/5 PASS (`exit 0`)**: Org A/B đọc dữ liệu riêng, Org A đọc `0` dòng Org B, `INSERT`/`UPDATE`/`DELETE` xuyên tenant bị từ chối, thiếu context fail-closed (`0` rows / RLS error), pool `max: 1` sau `COMMIT` không rò rỉ context, `12` giao dịch đồng thời cách ly hoàn toàn, worker & WebSocket tuân thủ `withTenantTx` / `runWithTenantContext`.

---

## 7. Workstream A.2 — Đánh giá Database Roles & Privileges

Truy vấn `pg_roles`, `pg_auth_members`, `pg_namespace`, `pg_default_acl` trên `aiselfhealing_test` xác nhận:
- **Ownership:** Toàn bộ `49` bảng schema `public` đều thuộc sở hữu `selfheal_migrator` (`OWNERS: ["selfheal_migrator"]`), **không** phải `postgres` hay `selfheal_app`.
- **Thuộc tính Role:** `selfheal_app`, `selfheal_migrator`, `selfheal_readonly` đều có `rolsuper=false, rolbypassrls=false, rolcreaterole=false, rolcreatedb=false, rolcanlogin=true`.
- **Kế thừa & Quyền mặc định:** Không có membership leo thang bất hợp lệ trong `pg_auth_members`; schema `public` đã `REVOKE ALL FROM PUBLIC`, cấp `USAGE` cho `selfheal_app`/`selfheal_readonly` và `USAGE, CREATE` cho `selfheal_migrator`; `selfheal_app` bị tước `INSERT/UPDATE/DELETE` trên `system_roles` và `organization_roles`.
- **Biên giới đặc quyền (Test #8 trong `sprintCPhase3TlsAndDataProtection.test.ts` — PASS `exit 0`):** Xác nhận `selfheal_app` thất bại với `permission denied` / `must be owner of table` khi thử `CREATE TABLE`, `ALTER TABLE incidents`, `SELECT ... FROM pg_authid`, hoặc `ALTER TABLE ... DISABLE ROW LEVEL SECURITY`.
- **Hạn chế:** Toàn bộ các role trên **chưa tồn tại trên `captone-postgres` / `captone_db`** (`docker-compose.yml` vẫn mặc định `DB_USER=postgres`).

---

## 8. Workstream B — Đánh giá Refresh Token & Session Security

### 8.1 Truy vết vòng đời chuẩn (`LOGIN → ACCESS → REFRESH → ROTATION → REUSE → REVOCATION → LOGOUT`)
- **Lưu trữ & Hashing:** `refresh_tokens.token_hash` lưu digest HMAC-SHA256 dùng `REFRESH_TOKEN_PEPPER`; `RefreshTokenService` sinh 32 bytes CSPRNG (`base64url`), tuyệt đối không lưu hay log raw token (đã xác minh trong `sprintCPhase2RefreshToken.test.ts` Test #17).
- **Rotation & Reuse Detection:** `rotateRefreshToken` khóa nguyên tử `FOR UPDATE OF rt, us`; token cũ nhận `used_at = NOW()` và `replaced_by_token_id`; replay token đã dùng/thu hồi lập tức kích hoạt reuse detection `0s`, ghi `reuse_detected_at`, thu hồi toàn bộ `family_id` & `user_sessions`, tăng `users.token_version`, xóa cookie và trả `401` đồng nhất.
- **Concurrent Refresh:** `Promise.all` 2 request song song cho đúng `[200, 401]` với `0` split-brain descendants (`HAVING count(*) > 1` = `0`).
- **Cookie, CSRF & Rate Limit:** Cookie `selfheal_refresh_token` đặt `HttpOnly; SameSite=Lax; Path=/api/v1/auth` (`Secure` khi `COOKIE_SECURE=true`, `NODE_ENV=production` hoặc `X-Forwarded-Proto: https`); `requireTrustedOriginAndCsrf` kiểm tra `Origin` + `X-CSRF-Token` bằng `crypto.timingSafeEqual`; `refreshRateLimiter` giới hạn `20 req/phút`.
- **Frontend:** `apiClient.js`, `authService.js`, `AuthContext.jsx` giữ access token trong RAM (chỉ còn dọn các key cũ ở `localStorage`), hỗ trợ single-flight 401 refresh (`refreshAccessTokenSingleFlight`) và gọi `/auth/logout` khi đăng xuất (`authRefreshLifecycle.test.js` `4/4 PASS`).

### 8.2 Kiểm chứng đặc biệt: Single-Device Logout phụ thuộc Redis
Kiểm tra trực tiếp [auth.controller.ts](file:///d:/AISelfHealing/Main_backend/src/controllers/auth.controller.ts#L516-L545), [sessionRevocation.service.ts](file:///d:/AISelfHealing/Main_backend/src/services/sessionRevocation.service.ts#L46-L89) và [auth.middleware.ts](file:///d:/AISelfHealing/Main_backend/src/middlewares/auth.middleware.ts#L68-L130):
1. **Khi Redis khả dụng (`REDIS_ENABLED=true` & `isRedisReady() === true`):** `POST /api/v1/auth/logout` ghi `auth:token_blacklist:<sha256(token)>` với TTL còn lại (tối thiểu 60s), và `authenticateToken` chặn ngay token đó (`401`).
2. **Khi Redis không khả dụng (`!isAvailable()`):**
   - **Ở `NODE_ENV !== 'production'` (`development` / `test`):** `SessionRevocationService.revokeToken()` trả về rỗng (line 50) và `isTokenRevoked()` **trả về `false` (FAIL-OPEN — line 76)**. Vì single-device `/auth/logout` cố ý gọi `revokeSessionByRawToken(..., { bumpTokenVersion: false })` để giữ phiên thiết bị khác, **Access JWT (`<= 15m`) của thiết bị vừa logout vẫn gọi API thành công cho đến khi hết hạn `15m`** khi Redis tắt ở dev/test.
   - **Ở `NODE_ENV === 'production'`:** Cả `revokeToken` (line 51) và `isTokenRevoked` (line 77) ném **`503 Service Unavailable`** (Fail-Closed). Lưu ý: trong `auth.controller.ts:525`, `logout()` `await` `revokeToken(...)` **trước** `revokeSessionByRawToken(...)`, nên khi Redis sập ở production, `POST /auth/logout` có Bearer header sẽ trả `503` (không giả vờ logout thành công dù chưa chặn access JWT); tuy nhiên người dùng vẫn giữ refresh cookie chưa thu hồi nếu họ chỉ gọi `/auth/logout` trong lúc Redis down. Ngược lại, `/auth/logout-all`, đổi mật khẩu, reset mật khẩu, khóa tài khoản, reuse detection và admin revoke tăng `users.token_version` trong PostgreSQL nên vô hiệu hóa mọi Access JWT & WebSocket ngay lập tức **không phụ thuộc Redis**.

### 8.3 Finding phụ tại Rate Limiter
- **Finding `AUD-B01` (Medium — Per-Process In-Memory Rate Limiter):** [rateLimit.middleware.ts](file:///d:/AISelfHealing/Main_backend/src/middlewares/rateLimit.middleware.ts#L14-L84) dùng `new Map()` trong RAM từng process và `app.ts` chưa cấu hình `trust proxy`, khiến bộ đếm `/auth/login`, `/auth/refresh`, `/auth/forgot-password` không đồng bộ qua nhiều replica và có thể nhận IP proxy nội bộ thay vì client IP thật.

---

## 9. Workstream C — Đánh giá PostgreSQL TLS & Nginx HTTPS

### 9.1 Phân cấp mức độ kiểm chứng thực tế (5 cấp)
| Thành phần | 1. Config trong code/manifest | 2. Cert đã sinh trên đĩa | 3. Mount vào runtime | 4. Service chạy với TLS | 5. Kết nối thật đã xác minh |
| --- | --- | --- | --- | --- | --- |
| **`Main_backend` (`resolvePgSslConfig`, `buildPgPoolConfig`)** | **CÓ** (`verify-full` fail-closed ở prod/staging) | N/A | N/A | N/A (ở test local PG) | **CÓ — Trên container TLS cô lập `selfheal-phase3-tls-probe` (`postgres:16-alpine`)**: TLSv1.3 `ssl=true`, chặn rogue CA, cert hết hạn, sai hostname SAN, plaintext, config sai (`8/8 PASS, exit 0`) |
| **Isolated Staging Compose (`docker-compose.staging.yml`)** | **CÓ** (đã sửa đúng cú pháp YAML, `config --quiet` `exit 0`) | **CHƯA** (`Test-Path certs/postgres` = `False`) | **CHƯA** | **CHƯA** (chưa boot full-stack staging) | **CHƯA (`NOT VERIFIED`)** |
| **Production Compose & K8s (`docker-compose.prod.yml`, `k8s/*.yaml`)** | **CÓ** (`ssl=on`, `DB_SSL_MODE=verify-full`, `selfheal_app`) | **CHƯA** | **CHƯA** (`captone-postgres` không mount cert) | **CHƯA** (`captone-postgres` đang `Up 20h` với `ssl=off`) | **CHƯA (`NOT VERIFIED` trên runtime)** |
| **Edge Reverse Proxy (`nginx/nginx.conf`)** | **KHÔNG** (`nginx.conf:53-56` chỉ có `listen 80`, **chưa có `443 ssl`**, chưa có redirect HTTPS, dù Compose map `443:443`) | **CHƯA** | **CHƯA** | **CHƯA** | **KHÔNG (`OPEN` — Production Blocker)** |

- **Lưu ý bổ sung (`AI_backend` & `Agent`):** Xác nhận cả hai service **không** kết nối trực tiếp tới PostgreSQL; tuy nhiên `nginx/nginx.conf` chỉ chạy HTTP `:80` khiến cookie `Secure` (`COOKIE_SECURE=true` ở `NODE_ENV=production`) bị trình duyệt từ chối nếu truy cập trực tiếp qua Nginx HTTP `:80/:8090` mà không có TLS termination phía trước. Ngoài ra `docker-compose.yml` local dev vẫn còn fallback secret (`dev_only_*`) gắn `NODE_ENV=production` và thiếu `REFRESH_TOKEN_PEPPER` (sẽ fail-closed khi khởi chạy nếu không cung cấp env thật).

---

## 10. Workstream D — Đánh giá Mã hóa dữ liệu nhạy cảm (`OPEN Findings`)

| Hạng mục | Thực trạng kiểm tra trực tiếp trong code | Trạng thái | Mức độ rủi ro |
| --- | --- | --- | --- |
| **D.1 `organization_alert_settings` (`slack_webhook_url`, `pagerduty_key`)** | [organizationAlertSettings.model.ts](file:///d:/AISelfHealing/Main_backend/src/models/organizationAlertSettings.model.ts#L59-L95) đọc/ghi trực tiếp plaintext từ PostgreSQL và trả nguyên chuỗi trong API model; chưa áp dụng AES-256-GCM hay che mask khi `GET` | **`OPEN — NOT IMPLEMENTED`** | **HIGH** (`AUD-D01`): Dump DB hoặc quyền đọc tenant làm lộ webhook URL & PagerDuty integration key |
| **D.2 `approvals.approval_token`** | [hitlNotification.service.ts](file:///d:/AISelfHealing/Main_backend/src/services/hitlNotification.service.ts#L190-L196) thực thi `UPDATE approvals SET approval_token = $1` lưu **plaintext HITL JWT** trong DB; `processQuickApprove` (`line 231-250`) tra cứu `WHERE ap.id = $1` mà không đối chiếu `token_hash` một lần | **`OPEN — NOT IMPLEMENTED`** | **HIGH** (`AUD-D02`): Lộ DB row `approvals` làm lộ token phê duyệt HITL còn hạn |
| **D.3 TOTP Secret (`user_two_factor`)** | [twoFactor.service.ts](file:///d:/AISelfHealing/Main_backend/src/services/twoFactor.service.ts#L18-L46) mã hóa AES-256-GCM (`v1:iv:tag:cipher`) với `TOTP_ENCRYPTION_KEY`; tuy nhiên `decryptTotpSecret` dòng 27–28 vẫn giữ nhánh tương thích ngược trả thẳng plaintext nếu không có tiền tố `v1:` | **`PARTIAL`** | **LOW-MED** (`AUD-D03`): Giá trị cũ không mã hóa vẫn được giải mã thầm |
| **D.3 Refresh Token, Agent Token, Password, PEPPER/HMAC** | `refresh_tokens.token_hash` (HMAC-SHA256 + `REFRESH_TOKEN_PEPPER`), `agent_tokens.token_hash` (SHA-256), `users.password_hash` (`bcrypt`), không in ra log hay báo cáo | **`IMPLEMENTED & VERIFIED`** | Thấp |

---

## 11. Workstream E — Đánh giá Quản trị Migration (`SC-102` — Production Gate Bắt buộc)

Kiểm tra trực tiếp [migrate.ts](file:///d:/AISelfHealing/Main_backend/src/scripts/migrate.ts) (51 dòng), [00_init_full_database.sql](file:///d:/AISelfHealing/Main_backend/migrations/00_init_full_database.sql) và [.github/workflows/cd.yml](file:///d:/AISelfHealing/.github/workflows/cd.yml):

| Yêu cầu `SC-102` | Thực trạng kiểm tra trong code | Kết quả |
| --- | --- | --- |
| **E.1 Bảng sổ cái `schema_migrations`** | **Không tồn tại.** `migrate.ts` chỉ `readdirSync` mọi file `.sql` và chạy lại toàn bộ tuần tự mỗi lần gọi | **`NOT IMPLEMENTED`** |
| **E.2 PostgreSQL Advisory Lock** | **Không có** (`pg_advisory_lock` không xuất hiện trong `migrate.ts`) | **`NOT IMPLEMENTED`** |
| **E.3 Bọc Transaction từng migration** | **Không có.** `client.query(sqlContent)` chạy trực tiếp không `BEGIN`/`COMMIT`/`ROLLBACK` | **`NOT IMPLEMENTED`** |
| **E.4 Hỗ trợ `--baseline`** | **Không có** | **`NOT IMPLEMENTED`** |
| **E.5 Tách Seed khỏi `00_init_full_database.sql`** | **Chưa tách.** Dòng `1399` & `1414` vẫn còn `ON CONFLICT (email) DO UPDATE SET password_hash = crypt('AdminPassword123@', ...)` reset mật khẩu `superadmin@selfheal.com` và `admin@selfheal.com` mỗi lần chạy | **`OPEN — CRITICAL`** |
| **E.6 CI/CD `cd.yml`** | Đã xóa `\|\| true` ở bước `node dist/scripts/migrate.js` (line 277) nên migration lỗi sẽ làm dừng CD. **Tuy nhiên** dòng 274–276 dùng `if [ -x ./scripts/backup-postgres.sh ] && [ -n "${BACKUP_ENCRYPTION_KEY:-}" ]; then ./scripts/backup-postgres.sh; fi` → **bỏ qua backup âm thầm** nếu thiếu biến hoặc quyền thực thi thay vì fail-closed; bước `migrate.js` vẫn chạy bên trong container `main-backend` đang dùng `DB_USER=selfheal_app` trừ khi truyền `DB_MIGRATOR_*` | **`PARTIAL`** |
| **Rollback Scripts Migrations `29–31`** | Có đủ `29_...down.sql`, `30_...down.sql`, `31_...down.sql` (đã test rollback/re-apply thành công trên `aiselfhealing_test`) | **`IMPLEMENTED (riêng M29–31)`** |

**Kết luận Workstream E:** **`SC-102` = `OPEN` và LÀ PRODUCTION BLOCKER TUYỆT ĐỐI (`AUD-E01`, Critical).** Tuyệt đối không chạy `migrate.ts` trên `captone_db` hoặc production cho tới khi hoàn thành `schema_migrations`, advisory lock, `--baseline` và tách seed khỏi `00_init_full_database.sql`.

---

## 12. Workstream F — Đánh giá Backup & Restore

- **Đã triển khai & kiểm chứng logic:** [backup-postgres.sh](file:///d:/AISelfHealing/scripts/backup-postgres.sh) (`pg_dump -Fc -Z 6`, mã hóa `openssl enc -aes-256-cbc -pbkdf2 -iter 600000 -salt -md sha256 -pass env:BACKUP_ENCRYPTION_KEY`, file `.sha256`, `umask 077`, `chmod 0600`, xóa file dump thô qua `trap`) và [restore-postgres.sh](file:///d:/AISelfHealing/scripts/restore-postgres.sh) (kiểm tra `.sha256` trước giải mã, chặn ghi đè `captone_db` nếu thiếu `--confirm-overwrite`, `pg_restore` + kiểm số bảng). Đã kiểm thử thực tế thuật toán này bằng `pg_dump.exe` + `openssl.exe` + `pg_restore.exe` trên `aiselfhealing_test` sang DB tạm `aiselfhealing_phase3_restore_test` (`>= 47` bảng khôi phục đủ, `exit 0`).
- **Hạn chế còn lại (`AUD-F01`, Medium-High):**
  1. Hai shell script `.sh` chưa được chạy trực tiếp trên Linux host/VPS; chỉ được kiểm chứng tương đương từng bước bằng binary PostgreSQL 18 & OpenSSL trên Windows.
  2. Chưa có cấu hình đồng bộ **off-host storage** (S3/Object Lock/remote SCP) và chưa có cron/schedule định kỳ trong Compose/K8s (lưu trữ cục bộ trên cùng host nếu mất ổ đĩa sẽ mất cả backup).
  3. Như nêu ở `AUD-E01`, `cd.yml` không fail-closed nếu thiếu `BACKUP_ENCRYPTION_KEY` trước khi migrate.

---

## 13. Workstream G — Đánh giá Password Reset & Email Dispatch (`/auth/forgot-password`)

Kiểm tra trực tiếp [auth.routes.ts](file:///d:/AISelfHealing/Main_backend/src/routes/auth.routes.ts#L45-L46), [auth.controller.ts](file:///d:/AISelfHealing/Main_backend/src/controllers/auth.controller.ts#L586-L613), [auth.service.ts](file:///d:/AISelfHealing/Main_backend/src/services/auth.service.ts#L506-L548) và `Select-String` toàn `src/`:

| Giai đoạn | Trạng thái thực tế | Bằng chứng |
| --- | --- | --- |
| Sinh token & Hash | **IMPLEMENTED** | `crypto.randomBytes(32).toString('hex')` + SHA-256 (`expiresAt` 15 phút) |
| Lưu trữ & Tiêu thụ 1 lần | **IMPLEMENTED & VERIFIED** | `password_reset_tokens` (`deletePendingPasswordResetTokens`, `createPasswordResetToken`, `consumePasswordResetToken`) |
| Chống user enumeration & Rate limit | **IMPLEMENTED** | Trả response trung tính `200` cả khi email không tồn tại / bị khóa; gắn `authRateLimiter` (`10 req/5p`) |
| Đổi mật khẩu & Thu hồi toàn phiên | **IMPLEMENTED & VERIFIED** | `resetPasswordWithToken` cập nhật `password_hash`, `password_changed_at`, gọi `revokeAllUserSessions(..., 'PASSWORD_RESET')` (`Test #11 PASS`) |
| **Email Template & SMTP Delivery** | **`NOT IMPLEMENTED`** | `requestPasswordReset` kết thúc ở dòng 523 với comment `// Reuse email verification/notification queue or log safely...`; **không có** hàm `sendPasswordResetEmail` trong `EmailService` |
| **E2E Password Reset qua Email** | **`NOT VERIFIED / INCOMPLETE`** | Người dùng thực chưa nhận được link reset mật khẩu qua email (`AUD-G01`, Medium-High) |

---

## 14. Workstream H — Đánh giá Log & Error Sanitization (`SC-REQ-13`)

Kiểm tra toàn cục mã nguồn `Main_backend`, `AI_backend`, `Agent` sau khi khắc phục một lỗi hồi quy ở Phase 4:
- **Điểm đạt & đã xác minh:**
  - [logSanitizer.ts](file:///d:/AISelfHealing/Main_backend/src/utils/logSanitizer.ts): che giấu `Bearer`, JWT (`eyJ...`), `cap_*`, `sk-*`, PEM Private Key, URL query `?token=/code=/secret=`, chuỗi kết nối `postgres://`/`redis://` có hoặc không có username (`[^:\s/@]*:`), các key `password`, `secret`, `token`, `totp`, `backup_codes`, `pagerduty`, `slack_webhook`.
  - [error.middleware.ts](file:///d:/AISelfHealing/Main_backend/src/middlewares/error.middleware.ts), [ai.controller.ts](file:///d:/AISelfHealing/Main_backend/src/controllers/ai.controller.ts), [aiModelRegistry.controller.ts](file:///d:/AISelfHealing/Main_backend/src/controllers/aiModelRegistry.controller.ts): không lộ `(error as Error).message` HTTP 500 ở chế độ non-dev (`'Internal Server Error'`), log nội bộ qua `sanitizeForLog`.
  - [app.ts](file:///d:/AISelfHealing/Main_backend/src/app.ts): Morgan dùng `:sanitized-url` che `?token=...`.
  - [audit.service.ts](file:///d:/AISelfHealing/Main_backend/src/services/audit.service.ts): `SENSITIVE_KEYS_REGEX` mở rộng + `redactSensitiveString` trên giá trị chuỗi.
  - [email.service.ts](file:///d:/AISelfHealing/Main_backend/src/services/email.service.ts): `sendVerificationEmail` và `sendHitlApprovalNotification` đều che token (`maskSecretValue`) khi in dev console.
  - [AI_backend/app/core/logging.py](file:///d:/AISelfHealing/AI_backend/app/core/logging.py) (`SensitiveDataFilter`) & [Agent/selfheal_agent/utils/redaction.py](file:///d:/AISelfHealing/Agent/selfheal_agent/utils/redaction.py) + [logger.py](file:///d:/AISelfHealing/Agent/selfheal_agent/utils/logger.py) (`SensitiveDataLogFilter`): tự động lọc ở tầng `logging.Filter`, đã sửa bug regex khiến `Authorization: Bearer ...` không bị biến đổi thành `Authorization: [REDACTED] [REDACTED_TOKEN]`.
- **Quét `console.(log|warn|error)` toàn `Main_backend/src`:** Kết quả `Select-String` xác nhận không có dòng `console.*` nào in raw password, JWT, refresh token hay TOTP secret (`create-admin.ts`, `create-user-letanquoc.ts`, `email.service.ts` đều đã che `[REDACTED]`). Các `console.log` vận hành còn lại chỉ ghi ID, tên pod/service, hoặc thông điệp rút gọn (`sessionRevocation.service.ts:62,86` ghi `err.message` lỗi Redis — ở rủi ro thấp, nhưng nên bọc qua `redactSensitiveString`). **Đánh giá `SC-REQ-13`: `PASS` (đạt yêu cầu kiểm soát rò rỉ dữ liệu nhạy cảm).**

---

## 15. Workstream I — Đánh giá Hồi quy & Chất lượng kiểm thử

Toàn bộ lệnh được xác minh trên mã nguồn hiện tại ở trạng thái sạch (không sửa đổi file nguồn hay test):

| Suite / Thành phần | Kết quả | Exit Code | Phân loại | Phân tích & Lý do chính xác |
| --- | --- |---:| --- | --- |
| `Main_backend`: `npm run build` | Sạch (`tsc`) | `0` | **PASS** | Biên dịch TS thành công |
| `Main_backend`: `npm run test:ci` | `4/4` | `0` | **PASS** | `incidentModel` + `reportModel` |
| `Main_backend`: `sprintCPhase1Rls.test.ts` (`postgres` & `selfheal_app`) | `5/5` (cả 2 role) | `0` | **PASS** | Đã chạy thực tế với `DB_USER=selfheal_app` |
| `Main_backend`: `sprintCPhase2RefreshToken.test.ts` (`postgres` & `selfheal_app`) | `9/9` (cả 2 role) | `0` | **PASS** | Bao gồm test race đồng thời `[200, 401]` và zero split-brain |
| `Main_backend`: `sprintCPhase3TlsAndDataProtection.test.ts` | `8/8` | `0` | **PASS** | Thực thi trên container PG 16 TLS + `pg_dump`/`pg_restore` + redaction |
| `Main_backend`: `phase2Cp9HitlSecurity.test.ts` | `8/8` | `0` | **PASS** | Xác minh vòng đời HITL & khóa đồng thời |
| `Main_backend`: `sprintBSecuritySB04.test.ts` | `5/5` | `0` | **PASS** | OAuth JWKS, OTP, 2FA, HTML escape |
| `Main_backend`: `sprintBSecuritySB05Ticket.test.ts` | `2/2` | `0` | **PASS** | WS single-use ticket |
| `Main_backend`: `sprintBSecuritySB01.test.ts` | `7/8 PASS, 1 FAIL` (`SB01-01`) | `1` | **LEGACY CONTRACT MISMATCH** | `SB01-01` gọi `updateStatus(..., 'COMPLETED')` không có attempt/verification; bị chặn hợp lệ (`409`) bởi quy tắc CP-9 |
| `Main_backend`: `sprintBSecuritySB03.test.ts` | `5/6 PASS, 1 FAIL` (`SB03-01b`) | `1` | **LEGACY CONTRACT MISMATCH** | `SB03-01b` kỳ vọng `createAction(..., requires_approval: false)` tự `APPROVED`; CP-9 yêu cầu policy DB hợp lệ nên giữ `PENDING` (cộng thêm lỗi teardown khi async email ghi pool đã đóng) |
| `Main_backend`: `sprintASecurity.test.ts` | Chạy tới `TEL-07` (`36 PASS, 2 FAIL`: `WS-10`, `TEL-06`) rồi **treo tiến trình** | *(killed)* | **TEST HARNESS ISSUE** *(Không PASS)* | Thiếu đóng handle/WS/pool sau suite nên tiến trình không tự thoát; `WS-10` thuộc **LEGACY CONTRACT MISMATCH** (Sprint B yêu cầu `SUPER_ADMIN` có membership cho WS tổ chức); `TEL-06` sai lệch thiết lập mock harness |
| `Agent`: `python -m pytest tests -q` | `75 passed, 1 failed` | `1` | **PASS (75) / LEGACY CONTRACT MISMATCH (1)** | `test_redaction.py` & `test_sb03_agent_security.py` đạt 100% PASS; `test_workload_target_resolution.py` assert chuỗi cũ `'SUCCEEDED'` thay cho `'COMPLETED'` |
| `Agent/installer_service`: `python -m pytest tests` | Collection error | `2` | **ENVIRONMENT ISSUE** | Python host thiếu `fastapi`; `Agent/venv` trỏ đường dẫn cũ không tồn tại |
| `AI_backend`: Host `pytest` (5 file pure/security) + 4 file ML/FastAPI | `53 passed, 1 failed, 1 skipped` + `4 collection errors` | `1` / `2` | **PASS (53) / ENVIRONMENT ISSUE** | Host Python 3.14 thiếu `fastapi`, `torch`, `openai`; `.venv` thiếu `pytest`; cần chạy trong Docker image `ai-backend` |
| `Frontend`: Auth/Session/Security/Error subset (`7 suites`) | `36/36` | `0` | **PASS** | `authRefreshLifecycle`, `SprintBSecurity`, `ErrorRouting`, `LoginPage`, `RegisterPage`, `ForgotPasswordPage`, `AdminClusterAndAgentConnection` |
| `Frontend`: `react-scripts test --watchAll=false` (toàn bộ 93 suite) | `82 passed, 11 failed` (`609 pass, 77 fail, 6 skip`) | `1` | **LEGACY CONTRACT MISMATCH** | Toàn bộ 11 suite lỗi thuộc mock/copy UI cũ từ trước Sprint C (`personalPortalService`, `TopHeader`, `SocialProofSection`, `ApmDashboard`, `AdminLayout`, `Admin/*`, `App.test.js`) |
| `Frontend`: `npm run build` | Thành công (chỉ có lint warnings) | `0` | **PASS** | Bundle production build sạch |

---

## 16. Ma trận Yêu cầu Bảo mật Tổng hợp (Master Security Requirements Matrix)

| ID | Yêu cầu bảo mật | Trạng thái triển khai | Trạng thái xác minh | Bằng chứng chính | Kết quả test | Rủi ro còn lại | Production Blocker? | Hành động khuyến nghị cho PO/Owner |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **SC-REQ-01** | Phân loại & phạm vi bảng tenant | **IMPLEMENTED** | **VERIFIED (Test DB)** | Catalog `49` bảng (`37` RLS, `12` Global/System/Auth) | Catalog query OK | Một số cột tenant gián tiếp còn nullable (`AUD-A01`) | Không (nếu backfill chuẩn trước cutover) | Duyệt kế hoạch siết `NOT NULL` sau khi dọn orphan |
| **SC-REQ-02** | PostgreSQL `ENABLE` + `FORCE RLS` | **IMPLEMENTED** | **VERIFIED (Test DB)** | `37` bảng, `86` policies (`M29`, `M30`) | `sprintCPhase1Rls` `5/5 PASS` | Chưa áp dụng lên `captone_db` / runtime | **Có (cho runtime DB)** | Phê duyệt lịch chạy `M29–M31` sau khi xong `SC-102` |
| **SC-REQ-03** | Cách ly Tenant Context (`SET LOCAL`) | **IMPLEMENTED** | **VERIFIED (Test DB)** | `dbContext.ts`, `database.ts`, `middleware/*`, workers/WS | `sprintCPhase1Rls` `5/5 PASS` | Mã mới tạo `new Pool()` ngoài `database.ts` sẽ bỏ qua wrapper | Không | Kiểm soát code review cấm gọi `new Pool()` tùy tiện |
| **SC-REQ-04** | Cách ly Connection Pool & đồng thời | **IMPLEMENTED** | **VERIFIED (Test DB)** | `max: 1` reuse & `12` concurrent tx tests | `sprintCPhase1Rls` `PASS` | Đã khóa cục bộ theo giao dịch (`is_local=true`) | Không | Duy trì bộ test hồi quy trong CI |
| **SC-REQ-05** | Database Least Privilege (`selfheal_app` / `migrator`) | **IMPLEMENTED** | **VERIFIED (Test DB)** | `M30`, `pg_roles`, `selfheal_app` privilege boundary checks | Phase 1–2 PASS dưới `selfheal_app`; Phase 3 Test #8 PASS | `selfheal_app` giữ quyền DML trên `audit_logs`; runtime đang dùng `postgres` | **Có (cho runtime DB)** | Tạo role & mật khẩu tách biệt trên runtime; thu hẹp `DELETE` `audit_logs` nếu cần immutable |
| **SC-REQ-06** | Refresh Token Hashing | **IMPLEMENTED** | **VERIFIED (Test DB)** | `M31`, `refreshToken.service.ts` (HMAC-SHA256 + `REFRESH_TOKEN_PEPPER`) | `sprintCPhase2RefreshToken` Test #1–3, #17 `PASS` | Phụ thuộc độ mạnh `REFRESH_TOKEN_PEPPER` ở prod | **Có** (nếu thiếu env prod) | Nạp `REFRESH_TOKEN_PEPPER >= 32` chars qua secret manager |
| **SC-REQ-07** | Refresh Token Rotation | **IMPLEMENTED** | **VERIFIED (Test DB)** | `rotateRefreshToken` `FOR UPDATE OF rt, us` | Test #2, #3, #6 `[200, 401]` `PASS` | Phụ thuộc Frontend single-flight giảm race nhiều tab | Không | Test đa tab thực tế trên Staging |
| **SC-REQ-08** | Reuse Detection & Family Revocation | **IMPLEMENTED** | **VERIFIED (Test DB)** | `0s` reuse detection revoking `family_id` + `token_version` | Test #4, #5 `PASS` | Giả mạo race do client lỗi sẽ thu hồi phiên (fail-safe) | Không | Theo dõi log/audit event `REFRESH_TOKEN_REUSE_DETECTED` |
| **SC-REQ-09** | Session & Token Revocation | **IMPLEMENTED** *(với điều kiện Redis)* | **VERIFIED (Test DB)** | `token_version` + `revokeAllUserSessions` + WS disconnect + Redis blacklist | Phase 2 Test #9–12 `PASS`; code audit `SessionRevocationService` | Single-device `/auth/logout` **fail-open ở non-prod** và cần Redis ở prod để chặn JWT `<=15m` ngay (`Section 8.2`) | **Có (cần bật Redis prod)** | Đảm bảo `REDIS_ENABLED=true` + `--requirepass` ở production |
| **SC-REQ-10** | Cookie Security, CSRF & Origin | **IMPLEMENTED** | **VERIFIED (Test + Unit)** | `csrfOrigin.middleware.ts`, `app.ts`, Frontend `apiClient`/`authService` | Phase 2 #13–16 `PASS`; FE `authRefreshLifecycle` `4/4 PASS` | `Secure` cookie đòi hỏi Edge HTTPS hoạt động | **Có (cần Nginx `:443`)** | Cấu hình HTTPS trên Nginx trước khi bật `COOKIE_SECURE=true` |
| **SC-REQ-11** | PostgreSQL TLS (`verify-full`) & Cert Validation | **IMPLEMENTED (App & Staging config)** | **VERIFIED (Isolated PG16 TLS Container)** / **NOT VERIFIED (Runtime)** | `database.ts`, `env.ts`, `generate-pg-certs.sh`, `docker-compose.*.yml`, `k8s/*.yaml` | Phase 3 Test #1–7 `PASS` trên container TLS cô lập | Cert chưa sinh/mount trên runtime; `nginx.conf` thiếu `:443` | **Có** | Sinh cert, bật `ssl=on` trên PG và `:443 ssl` trên Nginx |
| **SC-REQ-12** | Encrypted Backup & Restore Verification | **IMPLEMENTED (Scripts + Manual Drill)** | **VERIFIED (Local Binary Test)** / **NOT SCHEDULED** | `backup-postgres.sh`, `restore-postgres.sh`, Phase 3 Test #9–10 | AES-256-PBKDF2 + `.sha256` + `pg_restore` `PASS` | Chưa chạy `.sh` trên Linux VPS, chưa có off-host storage & cron | **Có (cần trước khi chạy migration prod)** | Thiết lập off-host backup, cron & kiểm thử restore định kỳ |
| **SC-REQ-13** | Log & Error Sanitization | **IMPLEMENTED** | **VERIFIED (Node + Python Tests)** | `logSanitizer.ts`, `error.middleware.ts`, `ai*.controller.ts`, `audit.service.ts`, `email.service.ts`, Python filters | Phase 3 #11 `PASS`; `test_redaction` & AI/Agent filters `PASS` | Một số `console.warn` lỗi kết nối còn in `err.message` thô | Không | Tiếp tục chuẩn hóa structured logger dùng `logSanitizer` |
| **SC-REQ-14** | Migration Safety & Governance (`SC-102`) | **NOT IMPLEMENTED** *(trừ M29–31 `.down.sql` & gỡ `\|\| true`)* | **FAILED AUDIT GATE** | `migrate.ts` (không `schema_migrations`/lock/TX/baseline), `00_init_full_database.sql` (seed overwrite), `cd.yml` (backup điều kiện lỏng) | Phát hiện trực tiếp qua đọc code | Nguy cơ reset mật khẩu admin & hỏng schema khi migrate prod | **CÓ — CRITICAL BLOCKER** | Triển khai trọn vẹn `SC-102` & chạy `--baseline` trước Production |
| **SC-REQ-15** | Sensitive Data Encryption (`alert_settings`, `approvals`) | **PARTIAL / OPEN** | **AUDIT CONFIRMED OPEN** | `organizationAlertSettings.model.ts` plaintext; `hitlNotification.service.ts:192` lưu raw JWT; `twoFactor.service.ts` fallback plaintext | Đối chiếu trực tiếp source | Lộ webhook URL, PagerDuty key & HITL token nếu DB bị đọc | **Có (HIGH risk)** | Mã hóa AES-256-GCM cột alert settings & hash `approvals.token_hash` |
| **SC-REQ-16** | Password Reset Security & Email Dispatch | **PARTIAL** | **PARTIAL VERIFIED** | `/forgot-password` & `/reset-password` + `password_reset_tokens` (`15m`) | Phase 2 #11 `PASS` (DB token); thiếu Email template/SMTP | Người dùng thực không nhận được email đặt lại mật khẩu | **Có (nếu mở tính năng UI)** | Bổ sung `EmailService.sendPasswordResetEmail` + HTML template |
| **SC-REQ-17** | Runtime Credential Protection | **PARTIAL** | **VERIFIED PARTIAL** | `env.ts` fail-closed prod; `create-admin` / `letanquoc` ẩn mật khẩu; `k8s/secrets.example.yaml` | Kiểm tra tĩnh | `docker-compose.yml` dev còn default fallback với `NODE_ENV=production`; chưa xoay vòng secret cũ | **Có** | Cấp secret duy nhất qua `.env`/Secret Manager & xoay vòng cred cũ |
| **SC-REQ-18** | Regression & Security Verification | **IMPLEMENTED** | **VERIFIED WITH EXCEPTIONS** | 15+ suite Backend, Python & Frontend đã chạy | Core Sprint C `PASS`; `sprintASecurity` hung; lỗi legacy/env đã phân loại | Chưa chạy full-stack staging compose & AI/Installer container pytest | **Có (cần Staging smoke test)** | Sửa teardown `sprintASecurity`, chạy CI Docker cho AI/Agent & staging smoke test |

---

## 17. Đánh giá các Cổng Sẵn Sàng Production (Production Readiness Gates)

| Cổng (Gate) | Kết quả | Đánh giá chi tiết |
| --- | --- | --- |
| **Gate A — Database Governance (`SC-102`)** | **`FAIL`** | Thiếu `schema_migrations`, advisory lock, TX runner, `--baseline`; `00_init_full_database.sql` vẫn còn `ON CONFLICT DO UPDATE` ghi đè mật khẩu admin; `cd.yml` không fail-closed nếu thiếu `BACKUP_ENCRYPTION_KEY`. |
| **Gate B — Database Security** | **`PASS WITH CONDITIONS`** | RLS (`37` bảng / `86` policies `FORCE RLS`), role tách biệt `selfheal_app`/`selfheal_migrator`, `SET LOCAL` pool isolation, và TLS `verify-full` đạt chuẩn trên môi trường cô lập; **điều kiện:** chưa áp dụng trên runtime `captone_db` và một số cột gián tiếp còn nullable. |
| **Gate C — Authentication & Sensitive Data** | **`PARTIAL`** | Refresh token rotation/reuse/CSRF/cookie đạt chuẩn; **nhưng** `organization_alert_settings` & `approvals.approval_token` còn plaintext (`OPEN`), `/forgot-password` chưa gửi email SMTP, `rateLimit` còn in-memory `Map`, và single-device logout phụ thuộc Redis ở prod. |
| **Gate D — Runtime & Integration** | **`PARTIAL`** | `nginx.conf` chỉ mở `:80` (chưa có `443 ssl`), cert PG chưa sinh (`certs/` không tồn tại), `docker-compose.staging.yml` mới kiểm cú pháp chưa boot full-stack, và 4 test `AI_backend` + `installer_service` chưa chạy trong container phụ thuộc. |
| **Gate E — Testing & Auditability** | **`PASS WITH CONDITIONS`** | Toàn bộ bằng chứng Phase 1–3 đều tái lập được với exit code `0` dưới cả `postgres` lẫn `selfheal_app`; mọi lỗi legacy/environment/harness đều được phân loại trung thực (gồm `sprintASecurity.test.ts` bị treo sau `TEL-07`). |

---

## 18. Danh sách Phát hiện & Rủi ro còn lại (Consolidated Findings)

| Finding ID | Mức độ | Bằng chứng & Thành phần | Trạng thái | Tác động Production | Khuyến nghị & Kiểm thử bắt buộc |
| --- | --- | --- | --- | --- | --- |
| **`AUD-E01`** | **CRITICAL** | `Main_backend/src/scripts/migrate.ts`, `00_init_full_database.sql:1399,1414`, `.github/workflows/cd.yml:274-277` | **OPEN** | Re-run migration reset mật khẩu admin, mất đồng bộ schema hoặc nuốt lỗi thiếu backup trước deploy | Triển khai `schema_migrations`, `pg_advisory_lock`, TX/migration, `--baseline`, tách seed vào `seeds/`, ép fail-closed pre-backup trong `cd.yml`. Verify đủ 8 test `SC-102` (Workstream E.7) |
| **`AUD-C01`** | **CRITICAL (Prod)** | `nginx/nginx.conf:53-56`, `certs/postgres` (`Test-Path` = `False`), `captone-postgres` (`ssl=off`) | **OPEN** | Traffic/token qua Edge đi HTTP thường; cookie `Secure` không lưu được trên trình duyệt HTTP; PG runtime chưa mã hóa TLS | Sinh cert SAN qua `generate-pg-certs.sh`, cấu hình Nginx `443 ssl` + HSTS + redirect HTTPS, boot & verify `docker-compose.staging.yml` |
| **`AUD-D01`** | **HIGH** | `Main_backend/src/models/organizationAlertSettings.model.ts:67-90` | **OPEN** | Lộ `slack_webhook_url` & `pagerduty_key` dạng plaintext trong DB và response API | Mã hóa AES-256-GCM với key riêng + che mask khi trả `GET`/`PUT` + viết unit & DB assertion test |
| **`AUD-D02`** | **HIGH** | `Main_backend/src/services/hitlNotification.service.ts:190-196` | **OPEN** | Lưu JWT phê duyệt HITL thô trong cột `approvals.approval_token` | Lưu SHA-256 `token_hash` & đối chiếu một lần trong transaction `processQuickApprove`/`Reject` + test replay |
| **`AUD-G01`** | **MEDIUM-HIGH** | `Main_backend/src/services/auth.service.ts:506-524` | **PARTIAL** | Người dùng cuối gọi `/forgot-password` không nhận được email chứa reset token | Thêm `EmailService.sendPasswordResetEmail` + HTML escape + test mock SMTP / dev-mask |
| **`AUD-F01`** | **MEDIUM-HIGH** | `scripts/backup-postgres.sh`, `scripts/restore-postgres.sh` | **PARTIAL** | Chưa chạy `.sh` thực tế trên Linux; chưa có off-host backup sync & lịch tự động | Chạy thử `.sh` trên Linux container/staging, nối off-host object lock/remote sync & cron |
| **`AUD-B01`** | **MEDIUM** | `Main_backend/src/middlewares/rateLimit.middleware.ts`, `app.ts`, `sessionRevocation.service.ts:50,76` | **OPEN** | Rate limit không chia sẻ đa replica; single-device logout phụ thuộc Redis (dev fail-open, prod `503` nếu Redis down) | Chuyển rate limiter sang Redis store + cấu hình `trust proxy`; đảm bảo Redis HA ở prod |
| **`AUD-A01`** | **MEDIUM** | Schema `aiselfhealing_test` (`incidents`, `logs`, `kubernetes_events`, `workloads`, `agents`, `metrics`) | **PARTIAL** | Cột tenant/FK còn nullable cho phép dữ liệu mồ côi tiềm tàng nếu code lỗi bỏ qua `SET LOCAL` | Xác nhận quy tắc xử lý orphan với PO và thêm ràng buộc `NOT NULL` + `cluster_id UUID FK` |
| **`AUD-I01`** | **LOW-MED** | `sprintASecurity.test.ts` (treo sau `TEL-07`), `SB01-01`, `SB03-01b`, `Agent` `SUCCEEDED`, `11` Frontend UI suites, `AI_backend`/`installer` host deps | **OPEN** | Làm sai lệch tín hiệu CI/CD nếu không chạy trong container hoặc không dọn teardown | Sửa teardown `sprintASecurity.test.ts`, đồng bộ contract test cũ (khi PO duyệt), chạy Python full suite trong CI container |

---

## 19. Backlog Khắc phục & Hoàn thiện đề xuất (Prioritized Follow-up)

1. **P0 — Bắt buộc trước Production Cutover:**
   - Triển khai đầy đủ **`SC-102`** (`schema_migrations`, advisory lock, `--baseline`, tách seed khỏi `00_init_full_database.sql`, fail-closed pre-backup trong `cd.yml`).
   - Cấu hình **Nginx `:443 ssl`** + redirect HTTPS + HSTS trong `nginx/nginx.conf`.
   - Chạy **`docker-compose.staging.yml` full-stack smoke test** (sinh cert bằng `generate-pg-certs.sh`, kiểm `pg_stat_ssl`, Redis auth, login/refresh/logout qua HTTPS, `AI_backend` & `Agent` pytest trong container).
2. **P1 — Bảo mật dữ liệu & Xác thực hoàn chỉnh:**
   - Mã hóa AES-256-GCM cho `organization_alert_settings` (`AUD-D01`) và chuyển `approvals.approval_token` sang `token_hash` (`AUD-D02`); loại bỏ nhánh decrypt plaintext fallback ở `twoFactor.service.ts` sau backfill.
   - Bổ sung email template & SMTP dispatch cho `POST /api/v1/auth/forgot-password` (`AUD-G01`).
   - Cấu hình off-host encrypted backup & lịch chạy restore verification định kỳ (`AUD-F01`).
3. **P2 — Độ tin cậy & Vệ sinh kiểm thử:**
   - Di chuyển `rateLimit.middleware.ts` sang Redis + cấu hình `trust proxy` (`AUD-B01`).
   - Siết `NOT NULL` cho cột `organization_id` sau backfill & thu hồi `DELETE`/`UPDATE` trực tiếp trên `audit_logs` nếu áp dụng chính sách append-only (`AUD-A01`, `AUD-A02`).
   - Sửa teardown của `sprintASecurity.test.ts` và cập nhật các legacy test contract khi PO phê duyệt (`AUD-I01`).

---

## 20. Khuyến nghị Quyết định dành cho Product Owner

- **Đánh giá hiện trạng Sprint C:** **`PARTIAL`** *(Các kiểm soát lõi Phase 1 RLS, Phase 2 Refresh Token & Phase 3 Client TLS / Backup Logic / Log Redaction đã hoàn thiện và có bằng chứng kiểm thử mạnh trên môi trường cô lập; tuy nhiên còn thiếu `SC-102`, Edge `:443`, `D.1`/`D.2` encryption và Email Reset Password).*
- **Quyết định Production Deployment:** **`BLOCKED / NOT READY FOR PRODUCTION`** cho đến khi đóng toàn bộ **Gate A (`SC-102`)**, hoàn tất **Edge HTTPS `:443 ssl`** + **Staging TLS Smoke Test**, xử lý hoặc có chấp thuận rủi ro bằng văn bản đối với **Gate C (`D.1`/`D.2`/`G`)**, và lấy **encrypted `pg_dump` verified** trước khi chạy Migrations `29–31` lên DB runtime.
- **Lựa chọn đề xuất cho Product Owner:**
  1. **Phương án 1 (Khuyến nghị):** Chưa đóng Sprint C; mở thêm một **Sprint C Closure Mini-Phase (Phase 5 Remediation)** xử lý dứt điểm `SC-102`, `nginx :443 ssl`, `D.1`/`D.2` encryption, `forgot-password` SMTP, và full-stack `docker-compose.staging.yml` smoke test trước khi đóng Sprint C và rollout Production.
  2. **Phương án 2:** Ghi nhận nghiệm thu có điều kiện phần Phase 1–3 cho nhánh phát triển, giữ chặn Production cho tới khi DevSecOps/Backend hoàn tất các ticket P0 trong Backlog Mục 19.
