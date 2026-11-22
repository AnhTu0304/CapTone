# SPRINT C — DATA SECURITY INTEGRATION & ACCEPTANCE REPORT

- **Project:** AI-Driven Proactive Self-Healing Infrastructure for SMEs
- **Branch:** `feature/security`
- **Assessment Date:** 2026-11-19
- **Prepared By:** Senior Security QA Engineer & Security Architect
- **Overall Acceptance Verdict:** **`PASS WITH CONDITIONS`**

> **Governance Notice:** This report provides independent, evidence-based verification results for Product Owner review. Automated test success on isolated infrastructure does **not** equate to immediate Production Readiness, and **Sprint C is NOT declared closed here** — the **Product Owner retains final closure and deployment approval authority**.

---

## 1. Executive Summary

Across Sprint C Phases 0–4, the project implemented and verified core data-security controls across PostgreSQL tenant isolation, authentication/refresh-token lifecycle hardening, transport encryption (TLS), encrypted database backup/restore, and cross-service log/error sanitization:

1. **PostgreSQL Row-Level Security & Least-Privilege Roles (Phase 1):** `37` tenant/audit tables enforce `ENABLE` + `FORCE ROW LEVEL SECURITY` (`86` policies) on `aiselfhealing_test` using transaction-local `AsyncLocalStorage` + `SET LOCAL` GUCs and non-superuser `selfheal_app` (`NOSUPERUSER NOBYPASSRLS`). Zero cross-tenant leakage or pool context carryover occurred under both `postgres` and `selfheal_app` test runs.
2. **Refresh Token & Session Lifecycle Hardening (Phase 2):** Access JWTs shortened to `15m` with `tv` (`token_version`) verification; opaque 256-bit refresh tokens stored solely as HMAC-SHA256 hashes in `user_sessions` + `refresh_tokens`; atomic row-locked rotation (`FOR UPDATE OF rt, us`) with strict `0s` reuse detection revoking full token families; `HttpOnly; SameSite=Lax; Path=/api/v1/auth` cookies paired with Double-Submit CSRF and strict `Origin` checks; Frontend updated to store access tokens in RAM with single-flight 401 refresh-and-retry.
3. **PostgreSQL TLS & Data Protection (Phase 3):** `Main_backend` (`pg.Pool` & migrator scripts) enforces `DB_SSL_MODE=verify-full` fail-closed startup in staging/production without plaintext fallback; verified against real `postgres:16-alpine` TLS 1.3 (`ca.crt`, rogue CA, expired cert, wrong hostname SAN, plaintext rejection); AES-256-PBKDF2 encrypted `pg_dump` -> `.sha256` -> `pg_restore` verified cleanly; Node.js (`Main_backend`) and Python (`AI_backend`, `Agent`) log/error redaction filters verified (including fixing a Phase 4 regression in `Authorization: Bearer` redaction ordering).

**Why `PASS WITH CONDITIONS` (not `PASS`):**
- Migrations `29–31`, TLS certs, and `selfheal_app` credentials have **only** been executed on isolated test databases/containers (`aiselfhealing_test` and ephemeral `selfheal-phase3-tls-probe`); runtime `captone-*` containers and `captone_db`/`aiselfheal` remain intentionally untouched.
- `Main_backend/src/scripts/migrate.ts` still executes `.sql` files without a `schema_migrations` tracking table, advisory lock, or seed extraction from `00_init_full_database.sql` (`Migration safety = PARTIAL`).
- Production Edge HTTPS `:443 ssl` in [nginx.conf](file:///d:/AISelfHealing/nginx/nginx.conf), live Redis blacklist activation, SMTP password-reset template wiring, off-host backup sync, and legacy test-harness cleanup (`sprintASecurity.test.ts` hang, AI/Installer `.venv` pytest environment, and 11 legacy Frontend UI mock tests) remain open conditions.

---

## 2. Scope & Prerequisites Verified

All prerequisite audit and implementation reports were reviewed alongside `git status` and runtime container inventory (`docker ps`):
- [SPRINT_C_PHASE_0_DATA_SECURITY_AUDIT.md](file:///d:/AISelfHealing/SPRINT_C_PHASE_0_DATA_SECURITY_AUDIT.md) (`READY WITH CONDITIONS`)
- [SPRINT_C_PHASE_1_RLS_IMPLEMENTATION_REPORT.md](file:///d:/AISelfHealing/SPRINT_C_PHASE_1_RLS_IMPLEMENTATION_REPORT.md) (Migrations `29` & `30`, `37` RLS tables, `86` policies, `selfheal_app` / `selfheal_migrator` / `selfheal_readonly` / `selfheal_sysdefiner`)
- [SPRINT_C_PHASE_2_REFRESH_TOKEN_SECURITY_REPORT.md](file:///d:/AISelfHealing/SPRINT_C_PHASE_2_REFRESH_TOKEN_SECURITY_REPORT.md) (Migration `31`, rotation/reuse/CSRF/origin/frontend lifecycle)
- [SPRINT_C_PHASE_3_DATABASE_TLS_DATA_PROTECTION_REPORT.md](file:///d:/AISelfHealing/SPRINT_C_PHASE_3_DATABASE_TLS_DATA_PROTECTION_REPORT.md) (PG TLS `verify-full`, encrypted backup/restore, multi-service redaction, staging/prod/K8s/CD manifests)
- [SPRINT_B_RUNTIME_SECURITY_VERIFICATION_REPORT.md](file:///d:/AISelfHealing/SPRINT_B_RUNTIME_SECURITY_VERIFICATION_REPORT.md) & [PHASE_2_CP9_SECURITY_REMEDIATION_REPORT.md](file:///d:/AISelfHealing/PHASE_2_CP9_SECURITY_REMEDIATION_REPORT.md)
- **Container & Legacy DB Safety:** Confirmed via `docker ps` that `captone-postgres`, `captone-main-backend`, `captone-redis`, and `captone-installer-service` remain continuously running and untouched (`Up 19 hours` / `Up 2 days`), and the temporary Phase 3 TLS test container (`selfheal-phase3-tls-probe`) and restore DB (`aiselfhealing_phase3_restore_test`) were cleaned up.

---

## 3. Architecture Changes Summary

| Layer | Implemented Controls | Primary Artifacts |
| --- | --- | --- |
| **PostgreSQL Schema & RLS** | Reconciled `alert_*` tables; `ENABLE` + `FORCE ROW LEVEL SECURITY` on `37/49` tables (`86` policies); `selfheal_app`, `selfheal_migrator`, `selfheal_readonly`, `selfheal_sysdefiner`; `user_sessions` & `refresh_tokens` | [29_create_alert_tables.sql](file:///d:/AISelfHealing/Main_backend/migrations/29_create_alert_tables.sql), [30_sprint_c_phase1_rls_and_roles.sql](file:///d:/AISelfHealing/Main_backend/migrations/30_sprint_c_phase1_rls_and_roles.sql), [31_sprint_c_phase2_refresh_tokens.sql](file:///d:/AISelfHealing/Main_backend/migrations/31_sprint_c_phase2_refresh_tokens.sql), [rollback/](file:///d:/AISelfHealing/Main_backend/migrations/rollback) |
| **Context & TLS Pool** | `AsyncLocalStorage` (`dbContext.ts`), transaction-local `set_config(..., true)`, `withTenantTx`/`withPlatformAdminTx`/`withSystemTx`, `resolvePgSslConfig`/`buildPgPoolConfig` (`verify-full` strict fail-closed), `pg_stat_ssl` health | [dbContext.ts](file:///d:/AISelfHealing/Main_backend/src/config/dbContext.ts), [database.ts](file:///d:/AISelfHealing/Main_backend/src/config/database.ts), [env.ts](file:///d:/AISelfHealing/Main_backend/src/config/env.ts), [redis.ts](file:///d:/AISelfHealing/Main_backend/src/config/redis.ts) |
| **Auth, Refresh & CSRF** | `15m` Access JWT (`jti`, `sid`, `tv`, `typ: 'access'`), DB `token_version` check, atomic `FOR UPDATE` rotation + `0s` family reuse revocation, `HttpOnly` refresh cookie + Double-Submit CSRF + `Origin` check, WS disconnect on global revocation | [refreshToken.service.ts](file:///d:/AISelfHealing/Main_backend/src/services/refreshToken.service.ts), [csrfOrigin.middleware.ts](file:///d:/AISelfHealing/Main_backend/src/middlewares/csrfOrigin.middleware.ts), [auth.middleware.ts](file:///d:/AISelfHealing/Main_backend/src/middlewares/auth.middleware.ts), [auth.service.ts](file:///d:/AISelfHealing/Main_backend/src/services/auth.service.ts), [auth.controller.ts](file:///d:/AISelfHealing/Main_backend/src/controllers/auth.controller.ts) |
| **Frontend Auth Lifecycle** | Access token stored in RAM (no new `localStorage` persistence); silent reload recovery via HttpOnly refresh cookie; single-flight 401 refresh-and-retry; `/auth/logout` & `/auth/logout-all` with CSRF + cross-tab cleanup | [apiClient.js](file:///d:/AISelfHealing/Frontend/src/services/apiClient.js), [authService.js](file:///d:/AISelfHealing/Frontend/src/services/authService.js), [AuthContext.jsx](file:///d:/AISelfHealing/Frontend/src/context/AuthContext.jsx) |
| **PKI, Backup & Log Sanitization** | CA/SAN provisioning (`chmod 0600`), isolated staging Compose, AES-256-PBKDF2 encrypted `pg_dump`/`.sha256`/`pg_restore`, CD pre-migration backup without `|| true`, unified log/error redaction across Node & Python | [generate-pg-certs.sh](file:///d:/AISelfHealing/scripts/certs/generate-pg-certs.sh), [backup-postgres.sh](file:///d:/AISelfHealing/scripts/backup-postgres.sh), [restore-postgres.sh](file:///d:/AISelfHealing/scripts/restore-postgres.sh), [docker-compose.staging.yml](file:///d:/AISelfHealing/docker-compose.staging.yml), [logSanitizer.ts](file:///d:/AISelfHealing/Main_backend/src/utils/logSanitizer.ts), [logging.py](file:///d:/AISelfHealing/AI_backend/app/core/logging.py), [redaction.py](file:///d:/AISelfHealing/Agent/selfheal_agent/utils/redaction.py) |

---

## 4. RLS & Tenant Isolation Evidence

- **Catalog State (`aiselfhealing_test`):** Direct catalog inspection confirmed `{"total_tables":49,"rls_enabled":37,"rls_forced":37,"policy_count":86}`. All `37` tenant & audit tables enforce `ENABLE` and `FORCE ROW LEVEL SECURITY`.
- **Negative & Worker Isolation Tests ([sprintCPhase1Rls.test.ts](file:///d:/AISelfHealing/Main_backend/src/test/sprintCPhase1Rls.test.ts)):** Executed under **both** `DB_USER=postgres` (`5/5 PASS, exit 0`) and runtime least-privilege **`DB_USER=selfheal_app`** (`5/5 PASS, exit 0`):
  - **Fail-closed default:** Queries with no `app.access_scope` return `0` rows on `SELECT` and fail with PostgreSQL RLS error on `INSERT`.
  - **Cross-tenant read/write prevention:** Separate Org A / Org B queries cannot read, `INSERT`, `UPDATE` (including `organization_id` tampering), or `DELETE` foreign tenant rows directly or through indirect FKs (`clusters`).
  - **Pool isolation & concurrency:** `max: 1` pool reuse after Org A transaction `COMMIT` returns `0` rows unscoped; `12` interleaved concurrent Org A/B transactions remain strictly isolated.
  - **Workers, Raw SQL & WebSockets:** Verified `HealingActionModel.approveAction`, `TelemetryPipelineService` (`autoResolveIfRecovered`, `evaluatePolicyAndTriggerAutonomousHealing`), `TelemetryAggregatorService.getLiveSummaryData`, `StatisticsService`, `LogStreamService`, `RuleEngineExecutionService`, and `AgentTimeoutService` iterate per organization inside explicit `withTenantTx` / `runWithTenantContext`.
  - **Audit platform logs under RLS:** Verified [audit.service.ts](file:///d:/AISelfHealing/Main_backend/src/services/audit.service.ts) cleanly records platform auth events (`organization_id IS NULL`) using explicit `SYSTEM` context without RLS violations under `selfheal_app`.

---

## 5. Database Role & Privilege Evidence

Verified against live `pg_roles` on `aiselfhealing_test` and negative boundary tests in [sprintCPhase3TlsAndDataProtection.test.ts](file:///d:/AISelfHealing/Main_backend/src/test/sprintCPhase3TlsAndDataProtection.test.ts) (`Test #8`):
- `selfheal_app`: `rolsuper=false, rolbypassrls=false, rolcreaterole=false, rolcreatedb=false, rolcanlogin=true`. Confirmed `CREATE TABLE`, `ALTER TABLE incidents`, and `SELECT ... FROM pg_authid` are rejected (`permission denied` / `must be owner of table`); `ALTER TABLE ... DISABLE ROW LEVEL SECURITY` and `SET ROLE postgres` are denied.
- `selfheal_migrator`: `rolsuper=false, rolbypassrls=false, rolcanlogin=true`, owns `public` tables/sequences strictly for migration execution via `createMigratorPool()`.
- `selfheal_readonly`: `rolsuper=false, rolbypassrls=false, rolcanlogin=true`, constrained by RLS.
- `selfheal_sysdefiner`: `NOLOGIN BYPASSRLS`, owns strictly 5 narrow read-only `SECURITY DEFINER` lookup helpers (`SET search_path = pg_catalog, public`) and cannot be logged into or assumed via `SET ROLE`.

---

## 6. Refresh Token Security Evidence

Executed under both `postgres` (`9/9 PASS, exit 0`) and `DB_USER=selfheal_app` (`9/9 PASS, exit 0`) in [sprintCPhase2RefreshToken.test.ts](file:///d:/AISelfHealing/Main_backend/src/test/sprintCPhase2RefreshToken.test.ts), plus Frontend Jest verification (`authRefreshLifecycle.test.js`, `4/4 PASS`):
- **Hashed Storage & Zero Leakage:** `refresh_tokens.token_hash` stores 64-char HMAC-SHA256 digests (`rawToken` rejected from logs, `console.*`, and `audit_logs`).
- **Rotation & Strict `0s` Reuse Detection:** `POST /api/v1/auth/refresh` rotates tokens (`parent_token_id` -> `replaced_by_token_id`), rejects replayed old tokens with generic `401`, sets `reuse_detected_at`, and revokes the entire `family_id` (descendant token `rt2` immediately rejected with `401`).
- **Atomic Concurrency:** Simultaneous `Promise.all` refreshes on one token yielded strictly `[200, 401]` with `0` split-brain child rows (`HAVING count(*) > 1` -> `0`).
- **Session Revocation:** Single-session `/auth/logout` clears cookies and revokes session; `/auth/logout-all`, password change, `POST /auth/reset-password`, account suspension (`PATCH /users/:id/status`), and admin `POST /users/:id/revoke-sessions` revoke all refresh families, bump `users.token_version` (invalidating `15m` Access JWTs immediately without requiring Redis), and sever active telemetry WebSockets.
- **CSRF, Origin & Cookies:** Missing/mismatched `X-CSRF-Token` or missing/untrusted `Origin` returns HTTP `403`; `X-Forwarded-Proto: https` sets `HttpOnly; Secure; SameSite=Lax; Path=/api/v1/auth`; burst refresh triggers HTTP `429`.

---

## 7. PostgreSQL TLS Verification Evidence

Verified against a real ephemeral `postgres:16-alpine` TLS server (`selfheal-phase3-tls-probe` on `127.0.0.1:5499`, `hostnossl reject` + `hostssl scram-sha-256`) using `Main_backend`'s `buildPgPoolConfig` & `resolvePgSslConfig` (`8/8 PASS, exit 0`):
- **Valid CA & Cert (`verify-full`):** Connected with TLSv1.3 confirmed via `SELECT COALESCE(s.ssl, false), s.version, s.cipher FROM pg_stat_ssl`.
- **Negative Certificate Handshakes:** Untrusted/rogue CA rejected; expired server certificate (`notAfter: 2021-01-01`) rejected; wrong hostname SAN (`DNS:wrong-postgres.internal` vs `127.0.0.1`) rejected (`ERR_TLS_CERT_ALTNAME_INVALID`).
- **No Plaintext Fallback:** Plaintext client against TLS-only server rejected by `pg_hba.conf`; `verify-full` client against plaintext local PG (`ssl=off`) fails closed immediately.
- **Startup Guard:** Production/strict `resolvePgSslConfig` throws `FATAL DB TLS ERROR` on `disable`, `require`, invalid mode, missing/corrupt CA PEM, or conflicting `?sslmode=disable` URLs.
- **Adjacent Services:** Verified `AI_backend` and `Agent` hold zero direct PostgreSQL connections.

---

## 8. Backup, Role & Log/Error Protection Evidence

- **Encrypted Backup & Restore Drill:** `pg_dump.exe -Fc` exported `aiselfhealing_test`, encrypted via `openssl enc -aes-256-cbc -pbkdf2 -iter 600000 -salt -md sha256` (no `PGDMP` header leak, wrong passphrase rejected, `.sha256` verified), and `pg_restore.exe` cleanly restored `>= 47` tables (including `user_sessions` and `refresh_tokens`) into `aiselfhealing_phase3_restore_test`.
- **Log & Error Redaction:**
  - `Main_backend`: Verified `redactSensitiveString`, `sanitizeForLog`, `errorHandler` non-dev 500 masking (`'Internal Server Error'`), `AiController` / `AiModelRegistryController` 500 masking, `AuditService.redactSensitiveData` (`pagerduty_key`, `slack_webhook_url`, `backup_codes`, `totp_secret`), Morgan `:sanitized-url`, and `EmailService.sendHitlApprovalNotification` token masking (`đã che giấu`).
  - `AI_backend`: Verified `SensitiveDataFilter` redacts Bearer JWT, `sk-*`, DB credentials, and `?token=`.
  - `Agent`: Caught and fixed a Phase 4 regression in [redaction.py](file:///d:/AISelfHealing/Agent/selfheal_agent/utils/redaction.py) (plus [logging.py](file:///d:/AISelfHealing/AI_backend/app/core/logging.py) and [logSanitizer.ts](file:///d:/AISelfHealing/Main_backend/src/utils/logSanitizer.ts)) where `KV_SECRET_RE` stripped `"Bearer"` inside `"Authorization: Bearer ..."` — fixed with `(?!Bearer\b|\[REDACTED)`. Re-tested `Agent/tests/test_redaction.py` + `test_sb03_agent_security.py` -> all pass.

---

## 9. Regression Test Results & Failure Classification

| Suite / Command | Observed Result | Exit Code | Classification | Notes |
| --- | --- |---:| --- | --- |
| `Main_backend`: `npm run build` | Clean compile | `0` | **PASS** | Ran post-final edit |
| `Main_backend`: `npm run test:ci` (`incidentModel` + `reportModel`) | `4/4 PASS` | `0` | **PASS** | Main CI unit suite |
| `Main_backend`: `sprintCPhase1Rls.test.ts` (`postgres` & `selfheal_app`) | `5/5 PASS` (both roles) | `0` | **PASS** | Ran sequentially post-final edit |
| `Main_backend`: `sprintCPhase2RefreshToken.test.ts` (`postgres` & `selfheal_app`) | `9/9 PASS` (both roles) | `0` | **PASS** | Ran sequentially post-final edit |
| `Main_backend`: `sprintCPhase3TlsAndDataProtection.test.ts` | `8/8 PASS` | `0` | **PASS** | Real PG 16 TLS + `pg_dump`/`pg_restore` + redaction |
| `Main_backend`: `phase2Cp9HitlSecurity.test.ts` | `8/8 PASS` | `0` | **PASS** | HITL lifecycle & concurrency |
| `Main_backend`: `sprintBSecuritySB04.test.ts` | `5/5 PASS` | `0` | **PASS** | OAuth JWKS, OTP, 2FA, HTML escape |
| `Main_backend`: `sprintBSecuritySB05Ticket.test.ts` | `2/2 PASS` | `0` | **PASS** | Single-use WS ticket |
| `Main_backend`: `sprintBSecuritySB01.test.ts` | `7/8 PASS, 1 FAIL` (`SB01-01`) | `1` | **LEGACY CONTRACT MISMATCH** | `SB01-01` writes `COMPLETED` without execution/verification records, blocked by CP-9 HITL rule |
| `Main_backend`: `sprintBSecuritySB03.test.ts` | `5/6 PASS, 1 FAIL` (`SB03-01b`) | `1` | **LEGACY CONTRACT MISMATCH** | `SB03-01b` asserts unverified `createAction(..., requires_approval: false)` auto-approves; CP-9 requires verified DB policy (`PENDING`) |
| `Main_backend`: `sprintASecurity.test.ts` | Ran 38/39 (`36 PASS, 2 FAIL`: `WS-10`, `TEL-06`), **hung after `TEL-07`** | *(killed)* | **TEST HARNESS ISSUE** | Process hangs cleanly exiting (open WS/pool handles) + `WS-10` superseded by Sprint B `SUPER_ADMIN` membership rule |
| `Agent`: `python -m pytest tests -q` | `75 passed, 1 failed` | `1` | **PASS (75) / LEGACY CONTRACT MISMATCH (1)** | `test_redaction.py` & `test_sb03_agent_security.py` 100% PASS after regex fix; `test_workload_target_resolution.py` expects legacy `'SUCCEEDED'` instead of `'COMPLETED'` |
| `Agent/installer_service`: `python -m pytest tests` | Collection error (`fastapi` missing) | `2` | **ENVIRONMENT ISSUE** | Host Python 3.14 lacks `fastapi`; `Agent/venv` points to missing user path |
| `AI_backend`: Host `pytest` (5 pure/security files) | `53 passed, 1 failed, 1 skipped` | `1` | **PASS (53) / ENVIRONMENT ISSUE (2)** | `test_case_15` (`fastapi` missing on host Python 3.14) & `test_sb02_05` skipped; `.venv` lacks `pytest`; 4 `torch`/`fastapi` files need CI container |
| `Frontend`: Auth/Session/Security/Error subset (`7 suites`) | `36/36 PASS` | `0` | **PASS** | `authRefreshLifecycle`, `SprintBSecurity`, `ErrorRouting`, `LoginPage`, `RegisterPage`, `ForgotPasswordPage`, `AdminClusterAndAgentConnection` |
| `Frontend`: Full `react-scripts test --watchAll=false` | `82/93` suites (`609 passed, 77 failed, 6 skipped`) | `1` | **LEGACY CONTRACT MISMATCH** | Pre-existing 11 legacy UI/copy/mock suites (`App.test.js`, `TopHeader`, `personalPortalService`, `Admin/*`); 0 auth/session regressions |
| `Frontend`: `npm run build` | Compiled with lint warnings only | `0` | **PASS** | Production bundle built cleanly |

---

## 10. Security Acceptance Matrix

| Requirement ID | Security Requirement | Implementation Status | Test Evidence | Result | Residual Risk | Owner Action |
| --- | --- | --- | --- | --- | --- | --- |
| **SC-REQ-01** | Tenant isolation across HTTP, WS & workers | **Implemented** | `sprintCPhase1Rls.test.ts` (5/5), `phase2Cp9HitlSecurity.test.ts` (8/8) | **PASS** | `logs`/`kubernetes_events` still use parent `EXISTS` RLS joins; high scale may benefit from direct `organization_id` | Approve production migration & monitor RLS query plans |
| **SC-REQ-02** | PostgreSQL `ENABLE` + `FORCE RLS` | **Implemented** | PG catalog: `37/49` tables RLS+FORCE (`86` policies) | **PASS** | Runtime `captone_db` untouched pending rollout | Schedule maintenance window for Migration `30` |
| **SC-REQ-03** | Database least privilege | **Implemented** | `selfheal_app` role tests (`CREATE`/`ALTER`/`pg_authid` denied); Phase 1 & 2 pass under `selfheal_app` | **PASS** | `docker-compose.yml` local dev defaults still reference `postgres`; prod Compose/K8s still need secret creation | Provision `selfheal_app` & `selfheal_migrator` passwords in prod/staging |
| **SC-REQ-04** | Connection pool isolation | **Implemented** | `AsyncLocalStorage` + `SET LOCAL` + `max:1` reuse & 12 concurrent tx tests in `sprintCPhase1Rls.test.ts` | **PASS** | Any future raw script creating standalone `new Pool` bypasses `dbContext` | Enforce ESLint/code-review rule against ad-hoc `new Pool()` |
| **SC-REQ-05** | Refresh token rotation | **Implemented** | `sprintCPhase2RefreshToken.test.ts` (#1–3, #6 `[200,401]` atomic lock, `0` split-brain descendants) | **PASS** | Single-use `0s` grace relies on Frontend single-flight refresh lock | Verify multi-tab UX in live staging browser test |
| **SC-REQ-06** | Token reuse detection & family revocation | **Implemented** | `sprintCPhase2RefreshToken.test.ts` (#4–5: replay sets `reuse_detected_at` & revokes active child) | **PASS** | None significant once single-flight active | Monitor `REFRESH_TOKEN_REUSE_DETECTED` audit alerts |
| **SC-REQ-07** | Session revocation (logout, reset, suspend, admin) | **Implemented** | `sprintCPhase2RefreshToken.test.ts` (#9–12, `/logout-all`, `/revoke-sessions`) | **PASS** | Single-device `/auth/logout` needs Redis enabled to block remaining ≤`15m` Access JWT immediately | Ensure `REDIS_ENABLED=true` in production; wire SMTP reset email template |
| **SC-REQ-08** | CSRF & Origin validation on cookie routes | **Implemented** | `sprintCPhase2RefreshToken.test.ts` (#13–14, #16 rate limit `429`), `authRefreshLifecycle.test.js` | **PASS** | `Secure` refresh cookies require Edge HTTPS in browser | Enable Nginx `:443 ssl` before production rollout |
| **SC-REQ-09** | PostgreSQL TLS transport (`verify-full`) | **Implemented** | `sprintCPhase3TlsAndDataProtection.test.ts` (#1–2, #6b) against real PG 16 TLS 1.3 | **PASS** | Live `captone-postgres` still `ssl=off` until cert rollout | Run `generate-pg-certs.sh` & cut over `docker-compose.prod.yml` / `k8s/` |
| **SC-REQ-10** | Certificate chain, expiry & hostname SAN validation | **Implemented** | `sprintCPhase3TlsAndDataProtection.test.ts` (#3–5, #7: rogue CA, expired cert, wrong SAN, bad config rejected) | **PASS** | Self-managed CA requires 365d rotation discipline | Automate annual leaf cert renewal & monitoring alert |
| **SC-REQ-11** | Credential & secret protection | **Partial** | Hardcoded admin seed prints removed; `env.ts` strict prod checks; `.gitignore` updated | **PASS WITH CONDITIONS** | `organization_alert_settings` (`slack_webhook_url`/`pagerduty_key`) & `approvals.approval_token` column encryption/hashing deferred | Prioritize column-level encryption & rotate legacy/demo secrets on deploy |
| **SC-REQ-12** | Encrypted backup & restore verification | **Implemented** | `backup-postgres.sh`, `restore-postgres.sh`, Phase 3 test (#9–10 real `pg_dump` + AES-256-PBKDF2 + `pg_restore`) | **PASS WITH CONDITIONS** | Backups stay on local disk unless off-host sync configured | Configure off-host object storage & monthly cron restore drill |
| **SC-REQ-13** | Log & error sanitization | **Implemented** | Phase 3 Node (`errorHandler`, `AiController`, `Morgan`, `EmailService`, `AuditService`) + AI/Agent `pytest` filters | **PASS** | Inline `console.log` statements outside sanitized helpers may log operational non-secret fields | Keep expanding `logSanitizer` adoption for structured logger |
| **SC-REQ-14** | Migration safety (`schema_migrations`, locks, TX) | **Partial** | Migrations `29–31` idempotent with tested `.down.sql` rollbacks; `cd.yml` removes `\|\| true` + adds pre-backup | **PARTIAL** | `migrate.ts` still lacks `schema_migrations` tracking, advisory locks, TX wrapping, & `00_` seed extraction (`SC-102`) | Implement `schema_migrations` + `--baseline` BEFORE running `migrate.js` in production |

---

## 11. Residual Risks & Unresolved Issues

1. **Unapplied Runtime Environment Controls (Blocking Prod Cutover):** `captone-postgres`, `captone_db`, `aiselfheal`, and `nginx/nginx.conf` do not yet have Migrations `29–31`, TLS certs, Edge `:443 ssl`, or `selfheal_app` credentials applied.
2. **Migration Governance (`SC-102`):** `Main_backend/src/scripts/migrate.ts` re-runs `.sql` files linearly without a `schema_migrations` ledger, and `00_init_full_database.sql` still contains `ON CONFLICT DO UPDATE` admin seed resets — must NOT run against live production until refactored and baselined.
3. **Plaintext DB Columns Deferred from Phase 0:** `organization_alert_settings` webhooks/PagerDuty keys and `approvals.approval_token` plaintext JWT storage remain open (`SC-E03`), though masked in audit/email outputs.
4. **Password Reset Email Dispatch & Redis Single-Device Logout:** `/auth/forgot-password` persists hashed tokens in `password_reset_tokens` but lacks an active SMTP reset-link email template; single-device `/auth/logout` requires `REDIS_ENABLED=true` for sub-15m access JWT revocation.
5. **Pre-existing Test Harness & Environment Debt:** `sprintASecurity.test.ts` hangs on exit (`TEST HARNESS ISSUE`), `SB01-01`/`SB03-01b`/`Agent test_workload_target_resolution` and 11 Frontend UI suites assert pre-hardening contracts, and host Python lacks `torch`/`fastapi` for running the 4 ML/FastAPI pytest files outside Docker/CI.

---

## 12. Deployment Readiness Assessment

- **Overall Readiness Decision:** **`PASS WITH CONDITIONS — NOT YET PRODUCTION-READY UNTIL DEPLOYMENT GATES BELOW ARE MET`**
- **Mandatory Pre-Production Checklist for Product Owner / DevSecOps:**
  1. Implement `schema_migrations` + advisory lock + `--baseline` + seed extraction in `Main_backend/src/scripts/migrate.ts` and `00_init_full_database.sql` (`SC-102`).
  2. Provision internal PostgreSQL TLS CA & SAN certs (`./scripts/certs/generate-pg-certs.sh`) + Edge Nginx `:443 ssl` TLS certificate (`COOKIE_SECURE=true`).
  3. Create least-privilege database roles & passwords (`selfheal_app`, `selfheal_migrator`, `selfheal_readonly`), inject production secrets (`JWT_SECRET`, `REFRESH_TOKEN_PEPPER`, `REDIS_PASSWORD`, `AI_INTERNAL_HMAC_SECRET`, `TOTP_ENCRYPTION_KEY`, `BACKUP_ENCRYPTION_KEY`), and rotate all legacy/demo credentials.
  4. Take and verify a pre-cutover encrypted `pg_dump` before executing Migrations `29–31` on runtime databases (`captone_db`).
  5. Deploy `docker-compose.staging.yml` full-stack end-to-end smoke test (PG TLS `verify-full`, Redis auth, AI/Agent containers, Playwright/E2E login + refresh + RLS checks) before VPS production rollout.

---

## 13. Recommended Follow-Up Work

1. **Immediate (Before Production Rollout):** Complete `SC-102` (`schema_migrations` ledger + seed extraction), enable Nginx HTTPS `:443`, and run a live `docker-compose.staging.yml` E2E verification including container-based `AI_backend` & `Agent` full `pytest`.
2. **Short-Term Hardening:** Encrypt `organization_alert_settings` (`slack_webhook_url`, `pagerduty_key`) with AES-256-GCM and convert `approvals.approval_token` to hashed `token_hash`; wire SMTP reset-link email template for `forgot-password`.
3. **Test Suite Hygiene:** With PO approval, clean up `sprintASecurity.test.ts` open handles so it exits `0`, update `SB01-01` / `SB03-01b` / `test_workload_target_resolution.py` / 11 Frontend legacy UI tests to current canonical contracts, and schedule `auditRetention.worker.ts` + automated off-host backup restore drills.

---

**Phase 4 Gate Complete:** All verification evidence has been compiled. **Stopping here for final Product Owner review and Sprint C closure decision.**
