# SPRINT C — PHASE 3: POSTGRESQL TLS & DATA PROTECTION REPORT

- **Project:** AI-Driven Proactive Self-Healing Infrastructure for SMEs
- **Branch:** `feature/security`
- **Date:** 2026-11-19
- **Status:** **IMPLEMENTED & VERIFIED ON ISOLATED TEST INFRASTRUCTURE — AWAITING PO APPROVAL BEFORE PHASE 4**
- **Reference Baseline:** [SPRINT_C_PHASE_0_DATA_SECURITY_AUDIT.md](file:///d:/AISelfHealing/SPRINT_C_PHASE_0_DATA_SECURITY_AUDIT.md), [SPRINT_C_PHASE_1_RLS_IMPLEMENTATION_REPORT.md](file:///d:/AISelfHealing/SPRINT_C_PHASE_1_RLS_IMPLEMENTATION_REPORT.md), [SPRINT_C_PHASE_2_REFRESH_TOKEN_SECURITY_REPORT.md](file:///d:/AISelfHealing/SPRINT_C_PHASE_2_REFRESH_TOKEN_SECURITY_REPORT.md)

---

## 1. TLS Architecture & Environment Configuration Matrix

### 1.1 Service-to-Database Topology Check
- **`Main_backend` (Node.js / TypeScript):** Direct PostgreSQL client (`pg.Pool`) across application runtime (`pool`) and schema migrations (`createMigratorPool`). Now enforces explicit `DB_SSL_MODE` validation and TLS identity verification via [env.ts](file:///d:/AISelfHealing/Main_backend/src/config/env.ts) and [database.ts](file:///d:/AISelfHealing/Main_backend/src/config/database.ts).
- **`AI_backend` (Python / FastAPI):** Inspected — holds **zero** PostgreSQL or Redis client connections (stateless inference/RCA behind internal HMAC-SHA256 HTTP).
- **`Agent` (Python K8s Agent):** Inspected — holds **zero** PostgreSQL connections (communicates with `Main_backend` over WebSocket + OTel HTTP).
- **Redis (`Main_backend`):** Optional TLS transport added in [redis.ts](file:///d:/AISelfHealing/Main_backend/src/config/redis.ts) (`REDIS_TLS_ENABLED=true`, `REDIS_TLS_CA_PATH`) alongside `--requirepass` in staging/production Compose.

### 1.2 PostgreSQL TLS Behavior (`resolvePgSslConfig` & `buildPgPoolConfig`)
- **Supported modes (`DB_SSL_MODE`):** `disable`, `require`, `verify-ca`, `verify-full`. Any unrecognized mode throws `FATAL DB TLS ERROR` immediately.
- **Fail-Closed Strict Mode (`NODE_ENV=production`, `APP_ENV=staging`, or `DB_SSL_REQUIRE_STRICT=true`):**
  - Default `DB_SSL_MODE` is **`verify-full`**.
  - `disable` and `require` are **rejected at startup** (never uses `sslmode=require` as a substitute for CA + hostname validation, and never silently falls back to plaintext).
  - Conflicting `DATABASE_URL` query parameters (e.g., `?sslmode=disable` or `?sslmode=require`) are rejected in strict mode and stripped so `pg-connection-string` cannot bypass explicit `ConnectionOptions` validation.
  - Requires a readable PEM CA certificate (`-----BEGIN CERTIFICATE-----`) via `DB_SSL_CA_PATH` or inline `DB_SSL_CA`, enforcing `rejectUnauthorized: true`, `minVersion: 'TLSv1.2'`, and standard `tls.checkServerIdentity` hostname/SAN matching (for `verify-full`). Supports optional mutual TLS (`DB_SSL_CERT_PATH` + `DB_SSL_KEY_PATH`).
- **Health Telemetry:** [database.ts](file:///d:/AISelfHealing/Main_backend/src/config/database.ts) (`testDbConnection`, `getDbHealth`) and [health.controller.ts](file:///d:/AISelfHealing/Main_backend/src/controllers/health.controller.ts) query PostgreSQL's built-in `pg_stat_ssl` view (`COALESCE(s.ssl, false)`, `s.version`, `s.cipher`) rather than `ssl_is_used()` (which requires optional `sslinfo` extension).

### 1.3 Environment Matrix (Local Dev vs. Isolated Staging vs. Production)

| Setting | Local Development | Isolated Staging (`docker-compose.staging.yml`) | Production (`docker-compose.prod.yml` / `k8s/`) |
| --- | --- | --- | --- |
| **PG Server `ssl`** | Optional (`off` on local Windows DB) | **`on`** (`TLSv1.2+`, internal CA) | **`on`** (`TLSv1.2+`, internal CA / KMS-managed PKI) |
| **`pg_hba.conf`** | Localhost test access (`scram-sha-256`) | `hostnossl all all all reject` + `hostssl all all ... scram-sha-256` | `hostnossl all all all reject` + `hostssl all all ... scram-sha-256` |
| **`DB_SSL_MODE`** | `disable` (or `verify-full` for TLS testing) | **`verify-full`** (`DB_SSL_REQUIRE_STRICT=true`) | **`verify-full`** (`DB_SSL_REQUIRE_STRICT=true`) |
| **App DB Role** | `selfheal_app` / local dev test DB | **`selfheal_app`** (`NOSUPERUSER NOBYPASSRLS`) | **`selfheal_app`** (`NOSUPERUSER NOBYPASSRLS`) |
| **Migrator DB Role** | `selfheal_migrator` (manual CLI) | **`selfheal_migrator`** (explicit migration step) | **`selfheal_migrator`** (pre-flight backed-up CD gate) |

---

## 2. Files Changed & Provisioned Artifacts

- **TLS & Connection Governance (`Main_backend/`):**
  - [env.ts](file:///d:/AISelfHealing/Main_backend/src/config/env.ts) & [.env.example](file:///d:/AISelfHealing/Main_backend/.env.example) — `DB_SSL_MODE`, `DB_SSL_CA_PATH`, `DB_SSL_CA`, `DB_SSL_CERT_PATH`, `DB_SSL_KEY_PATH`, `DB_SSL_REQUIRE_STRICT`, `REDIS_TLS_ENABLED`, `REDIS_TLS_CA_PATH`.
  - [database.ts](file:///d:/AISelfHealing/Main_backend/src/config/database.ts) — `resolvePgSslConfig`, `buildPgPoolConfig`, strict TLS enforcement, `pg_stat_ssl` health check, sanitized error logging.
  - [redis.ts](file:///d:/AISelfHealing/Main_backend/src/config/redis.ts) — Optional TLS (`rejectUnauthorized: true`, CA pinning) and sanitized connection error warnings.
  - [health.controller.ts](file:///d:/AISelfHealing/Main_backend/src/controllers/health.controller.ts) — Surfaces non-sensitive PostgreSQL `ssl: { used, version, cipher }` status.
  - [create-admin.ts](file:///d:/AISelfHealing/Main_backend/src/scripts/create-admin.ts) & [create-user-letanquoc.ts](file:///d:/AISelfHealing/Main_backend/src/scripts/create-user-letanquoc.ts) — Inherit `buildPgPoolConfig('migrator')` TLS settings, require env-injected passwords in production, and redact password console output.
- **Certificate Provisioning, Staging, Production & CI/CD Manifests:**
  - [generate-pg-certs.sh](file:///d:/AISelfHealing/scripts/certs/generate-pg-certs.sh) *(new)* — Provisions CA + SAN leaf cert (`server.crt`/`server.key` mode `0600`, Alpine `postgres` UID `70`) and strict `hostssl` `pg_hba.conf`.
  - [docker-compose.staging.yml](file:///d:/AISelfHealing/docker-compose.staging.yml) *(new)* — Isolated staging stack (`selfheal-staging-*`) enforcing PostgreSQL TLS, strict `verify-full`, `selfheal_app`, and Redis auth with zero impact on `captone-*`.
  - [docker-compose.prod.yml](file:///d:/AISelfHealing/docker-compose.prod.yml), [postgres.yaml](file:///d:/AISelfHealing/k8s/postgres.yaml), [backend.yaml](file:///d:/AISelfHealing/k8s/backend.yaml), [secrets.example.yaml](file:///d:/AISelfHealing/k8s/secrets.example.yaml) — Updated for PostgreSQL TLS cert mounts, `ssl=on`, `DB_USER=selfheal_app`, `DB_SSL_MODE=verify-full`, `REFRESH_TOKEN_PEPPER`, and `COOKIE_SECURE=true` (manifests prepared; live `captone-*` containers intentionally untouched).
  - [.github/workflows/cd.yml](file:///d:/AISelfHealing/.github/workflows/cd.yml) — Removed silent `|| true` from `migrate.js` and added pre-migration encrypted backup invocation (`scripts/backup-postgres.sh`).
  - [.gitignore](file:///d:/AISelfHealing/.gitignore) — Excludes `certs/`, `backups/`, `*.key`, `*.pem`, `*.crt`, `*.enc`, `*.sha256`, and `k8s/secrets.local.yaml`.
- **Encrypted Backup & Restore Scripts:**
  - [backup-postgres.sh](file:///d:/AISelfHealing/scripts/backup-postgres.sh) *(new)* — TLS `pg_dump -Fc -Z 6`, AES-256-CBC PBKDF2-SHA256 (`-iter 600000`, secret via `env:BACKUP_ENCRYPTION_KEY`), `.sha256` integrity file, `umask 077`, `chmod 0600`, and `BACKUP_RETENTION_DAYS` pruning.
  - [restore-postgres.sh](file:///d:/AISelfHealing/scripts/restore-postgres.sh) *(new)* — Pre-decryption `.sha256` verification, PBKDF2 decryption, guarded `pg_restore`, and table count check.
- **Log & Error Redaction:**
  - [logSanitizer.ts](file:///d:/AISelfHealing/Main_backend/src/utils/logSanitizer.ts) *(new)* — `redactSensitiveString`, `sanitizeForLog`, `maskSecretValue`.
  - [error.middleware.ts](file:///d:/AISelfHealing/Main_backend/src/middlewares/error.middleware.ts) — Sanitizes logged errors/paths and redacts internal stack/error strings.
  - [app.ts](file:///d:/AISelfHealing/Main_backend/src/app.ts) — Custom Morgan `:sanitized-url` token masking `?token=`, `?secret=`, etc.
  - [audit.service.ts](file:///d:/AISelfHealing/Main_backend/src/services/audit.service.ts) — Expanded `SENSITIVE_KEYS_REGEX` (`pagerduty`, `webhook`, `backup_codes`, `encryption_key`, `pepper`, `totp`, `hmac`, `csrf`, `otp`, `passphrase`) + string-value redaction.
  - [email.service.ts](file:///d:/AISelfHealing/Main_backend/src/services/email.service.ts) — Masked HITL approval token in unconfigured-SMTP dev logs (`maskSecretValue`).
  - [ai.controller.ts](file:///d:/AISelfHealing/Main_backend/src/controllers/ai.controller.ts) & [aiModelRegistry.controller.ts](file:///d:/AISelfHealing/Main_backend/src/controllers/aiModelRegistry.controller.ts) — Eliminated raw `(error as Error).message` HTTP 500 leaks; non-`ApiError` failures return generic `'Internal Server Error'` outside `development` and log sanitized details.
  - [agentWebSocket.ts](file:///d:/AISelfHealing/Main_backend/src/websocket/agentWebSocket.ts) & [telemetryWebSocket.ts](file:///d:/AISelfHealing/Main_backend/src/websocket/telemetryWebSocket.ts) — Sanitized WebSocket error logs (`sanitizeForLog`) and removed raw error text from WS error frames.
  - [logging.py](file:///d:/AISelfHealing/AI_backend/app/core/logging.py) (`AI_backend`) & [redaction.py](file:///d:/AISelfHealing/Agent/selfheal_agent/utils/redaction.py), [logger.py](file:///d:/AISelfHealing/Agent/selfheal_agent/utils/logger.py) (`Agent`) — Automatic `logging.Filter` scrubbing `Bearer`/JWT tokens, `sk-*` keys, `cap_*` tokens, DB/Redis URIs (`redis://:pass@host` & `postgres://user:pass@host`), query tokens, and PEM private keys across Python loggers.

---

## 3. Certificate Validation & TLS Test Evidence

Tested against an isolated ephemeral PostgreSQL 16 TLS container (`postgres:16-alpine` on `127.0.0.1:5499`, strictly separate from `captone-*`, removed after test completion) using real `buildPgPoolConfig()` connections in [sprintCPhase3TlsAndDataProtection.test.ts](file:///d:/AISelfHealing/Main_backend/src/test/sprintCPhase3TlsAndDataProtection.test.ts):

| Scenario | Server / Client Posture | Observed Result |
| --- | --- | --- |
| **1 & 2. Valid Cert + Expected CA** | `verify-full` + `ca.crt` vs SAN `DNS:localhost,DNS:postgres,IP:127.0.0.1` | **PASS** — `pg_stat_ssl` confirmed `ssl = true`, TLSv1.3, negotiated cipher |
| **3. Invalid / Untrusted CA** | `verify-full` + `rogue-ca.crt` vs server cert | **REJECTED** — Self-signed / untrusted chain error |
| **4. Expired Server Certificate** | Server reloaded with expired X.509 cert (`notAfter: 2021-01-01`) | **REJECTED** — Certificate expired error |
| **5. Wrong Hostname SAN** | Server reloaded with SAN `DNS:wrong-postgres.internal` vs client connecting to `127.0.0.1` | **REJECTED** — `ERR_TLS_CERT_ALTNAME_INVALID` |
| **6a. Plaintext Rejected by Server** | Client `DB_SSL_MODE=disable` vs `hostnossl reject` / `hostssl` PG | **REJECTED** — `no pg_hba.conf entry ... SSL off` |
| **6b. Plaintext Rejected by Client** | Client `DB_SSL_MODE=verify-full` vs local non-SSL PG (`ssl=off`) | **REJECTED** — Fails closed (`does not support SSL`), no plaintext fallback |
| **7. Invalid App TLS Config** | `production`/`strict`: `disable`, `require`, unknown mode, missing/corrupt CA PEM, `?sslmode=disable` URL | **REJECTED** — Throws startup `FATAL DB TLS ERROR` |

---

## 4. Database Role Privileges & Credential Handling

- **Role Matrix Verified on `aiselfhealing_test`:**
  - `selfheal_app`: `rolsuper=false`, `rolbypassrls=false`, `rolcreaterole=false`, `rolcreatedb=false`. Boundary assertions confirmed `CREATE TABLE`, `ALTER TABLE incidents`, and `SELECT ... FROM pg_authid` all fail with `permission denied` / `must be owner of table`.
  - `selfheal_migrator`: `rolsuper=false`, `rolbypassrls=false`, schema/table owner strictly for migrations.
  - `selfheal_readonly`: `rolsuper=false`, `rolbypassrls=false`.
- **Credential Handling & Rotation:** Zero credentials committed or printed in test reports or source scripts; `create-admin.ts` and `create-user-letanquoc.ts` accept runtime secrets via env and redact console output. Ephemeral test role passwords assigned during verification were immediately cleared (`WITH PASSWORD NULL`) upon test completion.

---

## 5. Backup & Restore Verification Results

- **Dump & Encryption:** `pg_dump.exe -Fc` (`PostgreSQL 18.6`) exported `aiselfhealing_test`, encrypted via `openssl enc -aes-256-cbc -pbkdf2 -iter 600000 -salt -md sha256 -pass env:BACKUP_ENCRYPTION_KEY`.
- **Ciphertext & Tamper Checks:** Confirmed encrypted file header does NOT expose raw `PGDMP`, wrong passphrase fails decryption cleanly, and `.sha256` manifest matches ciphertext digest.
- **Restore Verification:** Decrypted and restored with `pg_restore.exe` into isolated temporary DB `aiselfhealing_phase3_restore_test`, verifying `>= 47` public tables (including `user_sessions` and `refresh_tokens`) before dropping the temporary restore DB and removing temporary files.

---

## 6. Log & Error Redaction Verification Results

- **`Main_backend` Log & Error Tests:** Verified `redactSensitiveString`, `sanitizeForLog`, `AuditService.redactSensitiveData`, `errorHandler` HTTP 500 redaction, `AiController.respondError` HTTP 500 redaction, and `EmailService.sendHitlApprovalNotification` dev console masking (`[REDACTED]` / `đã che giấu`) hide JWTs, `postgres://` & `redis://` credentials (with or without username), `?token=`, `cap_*`, `sk-*`, PEM keys, `pagerduty_key`, `slack_webhook_url`, `backup_codes`, and `totp_secret`.
- **`AI_backend` Log Filter (`pytest`):** Verified `SensitiveDataFilter` redacts Bearer JWT, `sk-*`, DB URI credentials, and query tokens.
- **`Agent` Log Filter (`pytest`):** Verified `SensitiveDataLogFilter` and `redact_sensitive_data` redact `cap_*`, Bearer JWT, query tokens, and `redis://:password@host` credentials.

---

## 7. Verification Commands & Exit Codes

| Check | Command | Result | Exit Code |
| --- | --- | --- | --- |
| **Main Backend Build** | `cd Main_backend; npm run build` | Clean compile (`rimraf dist && tsc`) | `0` |
| **Phase 3 TLS, Roles, Backup & Redaction Suite** | `cd Main_backend; $env:DB_NAME="aiselfhealing_test"; $env:NODE_ENV="test"; $env:REDIS_ENABLED="false"; npx tsx --test src/test/sprintCPhase3TlsAndDataProtection.test.ts` | **8/8 tests PASS** | `0` |
| **Phase 1 RLS + Phase 2 Refresh + CP-9 Regression** | `cd Main_backend; $env:DB_NAME="aiselfhealing_test"; $env:NODE_ENV="test"; $env:REDIS_ENABLED="false"; npx tsx --test src/test/sprintCPhase1Rls.test.ts src/test/sprintCPhase2RefreshToken.test.ts src/test/phase2Cp9HitlSecurity.test.ts` | **22/22 tests PASS** (3/3 suites) | `0` |
| **AI Backend Security & Log Filter** | `cd AI_backend; python -m pytest tests/test_sb02_security.py -v` | **6 passed, 1 skipped** (`test_sb02_05` skipped due to optional FastAPI test dep / existing baseline) | `0` |
| **Agent Security & Log Filter** | `cd Agent; python -m pytest tests/test_sb03_agent_security.py -v` | **6/6 passed** | `0` |
| **Compose Config Validation** | `docker compose -f docker-compose.staging.yml config --quiet` & `docker-compose.prod.yml config --quiet` | Valid YAML syntax & required-var gates | `0` |

---

## 8. Deployment Procedure, Rollback & Runtime Limitations

### 8.1 Deployment Safety & Rollback Summary
1. Provision internal CA + server cert/key into `/opt/selfheal/certs/postgres` via `./scripts/certs/generate-pg-certs.sh` (`chmod 0600 server.key`, `chown 70:70`).
2. Populate production `.env` / K8s Secrets (`DB_USER=selfheal_app`, `DB_PASSWORD`, `DB_MIGRATOR_USER=selfheal_migrator`, `DB_MIGRATOR_PASSWORD`, `REFRESH_TOKEN_PEPPER`, `REDIS_PASSWORD`, `BACKUP_ENCRYPTION_KEY`) — never default values.
3. Verify encrypted backup (`./scripts/backup-postgres.sh`) + isolated restore drill before restarting Postgres or running migrations.
4. Roll Postgres first in dual-mode (`host` + `hostssl`) if zero-downtime transition is needed, update `main-backend` (`DB_SSL_MODE=verify-full`), verify `pg_stat_ssl` shows `ssl=t` on 100% of connections, then enforce `hostnossl reject`.
5. **Rollback:** Revert `pg_hba.conf` to dual-mode or restore the pre-deployment encrypted backup via `./scripts/restore-postgres.sh`.

### 8.2 Runtime Limitations & Remaining Risks
1. **Untouched Runtime Containers (`captone-*`):** Per Change Control, live `captone-postgres`, `captone-main-backend`, `captone-redis`, `captone-installer-service`, and `captone_db` / `aiselfheal` were **not** restarted or modified; production PostgreSQL TLS and `ssl = on` take effect only after approved cert provisioning and scheduled Compose/K8s rollout.
2. **Edge Nginx `:443 ssl` & Off-Host Backup Target:** [nginx.conf](file:///d:/AISelfHealing/nginx/nginx.conf) still listens on HTTP `:80` pending edge domain TLS certificate binding on VPS (`COOKIE_SECURE=true` requires HTTPS at Edge), and `backup-postgres.sh` stores encrypted archives locally until an off-host S3/object-lock or remote rsync target is provisioned.
3. **Plaintext Integration Secrets in DB (`organization_alert_settings` / `approvals.approval_token`):** While API/audit logs mask keys and Phase 3 protects transport and backups, column-level encryption for `slack_webhook_url`/`pagerduty_key` and `approvals.token_hash` hashing remain tracked for Sprint C closure / PO prioritization.

---

**Phase 3 Gate:** Implementation and verification of Sprint C Phase 3 are complete. **Stopped here awaiting Product Owner review and approval before starting Sprint C Phase 4.**
