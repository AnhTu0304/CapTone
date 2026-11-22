# AI Self-Healing — Sprint B Runtime Security Verification & Closure Report

**Project:** AI-Driven Proactive Self-Healing Infrastructure for SMEs  
**Repository:** `d:\AISelfHealing` (Branch: `feature/security`)  
**Verification Date:** 2026-11-18  
**Role:** Senior Application Security Engineer, DevSecOps Engineer, Backend Architect, QA Engineer  

> **Governance Note:** Per Section 13, the Agent does **not** declare Sprint B officially closed. Official closure belongs to the Project Owner after reviewing the runtime verification evidence and unresolved conditions below.

---

## 1. Executive Verdict

**Final Status:** `PARTIAL — RUNTIME VERIFICATION INCOMPLETE`

### Summary
All core Sprint B runtime security mechanisms were tested inside an isolated Docker Compose staging environment (`selfheal_staging`), against an isolated PostgreSQL test database (`aiselfhealing_test` / `aiselfhealing_staging`), authenticated Redis, FastAPI/PyTorch container runtime, and Minikube test cluster. Five concrete runtime/security gaps uncovered during the verification itself were patched and re-verified:
1. **`docker-compose.prod.yml` Redis startup crash (P0):** `cap_drop: [ALL]` on `redis:7-alpine` caused `setpriv: setresuid failed: Operation not permitted` (Exit 127) during entrypoint drop-to-`redis`. Fixed with minimal `cap_add: [CHOWN, SETUID, SETGID, DAC_OVERRIDE]` and removed `postgres` host port mapping in `docker-compose.prod.yml`.
2. **HMAC Request Body Integrity Gap (P1):** `internalAuth.ts` & `internal_auth.py` previously signed `timestamp + nonce + method + path` without binding request body content. Updated to bind `X-Internal-Body-Sha256` into the canonical signature across JSON endpoints and streaming chunk verification on multipart uploads.
3. **AI Model Upload Edge Cases (P1):** Empty (`0`-byte) `.pth`/`.pt` uploads were previously written and returned `200`, and symlink/encoded traversal checks in `resolve_model_path` were tightened (`400 Bad Request`).
4. **PostgreSQL Error & Health Info Disclosure (P1):** Public `GET /api/v1/health` returned internal DB name/host/port/nodeVersion/raw error strings, and `error.middleware.ts` forwarded unhandled 500 error messages in non-development mode. Both were sanitized for non-development mode and verified at runtime.
5. **HITL / PostgreSQL Enum Runtime Crash & Bypass (P0/P1):** `HealingActionModel.createAction` wrote invalid `execution_mode = 'AUTO'` (enum only allows `'AUTOMATIC'`, `'MANUAL'`, `'SEMI_AUTOMATIC'`) and invalid `approval_status = 'NOT_REQUIRED'` (enum only allows `'PENDING'`, `'APPROVED'`, `'REJECTED'`, `'EXPIRED'`), while letting `HIGH`/`CRITICAL` actions skip approval if `execution_mode === 'AUTO'`. Fixed and verified against PostgreSQL.

### Why Status Is `PARTIAL — RUNTIME VERIFICATION INCOMPLETE`
- Pre-existing production/infrastructure blockers remain open by design/scope (`INF-01`: HTTPS/TLS `:443` termination & VPS DNS not provisioned; `nginx-proxy` & `selfheal-frontend` master Nginx still run as UID 0 to bind port 80; `docker-compose.yml` local dev stack omits Redis `--requirepass`).
- Legacy test suites (`rbac.test.ts`, `rbacMatrix.test.ts` `3.8`, `sprintASecurity.test.ts` `WS-10`, `AI_backend` legacy endpoint tests without HMAC headers / missing `/trainGRU`, `Agent/tests/test_workload_target_resolution.py` asserting `'SUCCEEDED'`, and 12 legacy `Frontend` Jest suites) still exit non-zero until updated with PO approval, and `tenantIsolation.test.ts` / `roleAssignmentSecurity.test.ts` hang on unclosed handles (`INCONCLUSIVE`).
- Live Agent container execution against a Minikube workload (real Pod restart) was not executed end-to-end against a deployed Minikube backend/agent loop (only read-only RBAC verification and mocked-K8s-SDK Agent unit tests were run).

---

## 2. Environment and Container Inventory

### Pre-Existing Host State (Preserved Untouched)
| Container / Resource | Image / Version | State During Test | Notes |
|---|---|---|---|
| `captone-postgres` | `postgres:16-alpine` | Up 5h (healthy), `0.0.0.0:5433->5432` | Pre-Sprint-B container; untouched |
| `captone-redis` | `redis:7-alpine` | Up 5h (healthy), `0.0.0.0:6380->6379` | Pre-Sprint-B container; used read/test via isolated keys on `6380` |
| `captone-main-backend` | `aiselfhealing-main-backend` | Up 5h (healthy), `0.0.0.0:5005->5000` | Pre-Sprint-B container; untouched |
| `captone-installer-service` | `aiselfhealing-installer-service` | Up 30h (healthy), `0.0.0.0:8100->8100` | Untouched |
| Host PostgreSQL (`aiselfhealing_test`) | `localhost:5432` | Running (`current_database() = "aiselfhealing_test"`) | Dedicated isolated test DB |
| `minikube` | `v1.37.0` (Ready) | Up 27h, context `minikube` | Read-only RBAC checks against `selfheal-agent-sa` |

### Isolated Staging Environment (`selfheal_staging`)
Built from current workspace Dockerfiles (`Main_backend/Dockerfile`, `AI_backend/Dockerfile`, `Frontend/Dockerfile`, `Agent/installer_service/Dockerfile`, `nginx/Dockerfile`) with dedicated bridge network (`staging-network`), dedicated volumes (`staging_postgres_data`, `staging_redis_data`), production-mode flags (`NODE_ENV=production`, `APP_ENV=production`), authenticated Redis, and localhost-only proxy binding (`127.0.0.1:18090:80`). Torn down cleanly with `docker compose -p selfheal_staging down -v` after verification.

---

## 3. Runtime Startup Results (CP-1.1)

| Service | Initial Attempt | Final Staging Result | Healthcheck | Observed Startup Log Evidence |
|---|---|---|---|---|
| `postgres` | Healthy | Up (healthy) | `pg_isready` PASS | `database system is ready to accept connections` |
| `redis` | **FAIL (Exit 127)** `setpriv: setresuid failed` | Up (healthy) after adding `CHOWN/SETUID/SETGID/DAC_OVERRIDE` | `redis-cli -a ... ping` -> `PONG` | Clean boot after `cap_add` fix |
| `main-backend` | Blocked by Redis dependency | Up (healthy) | `wget http://localhost:5000/api/v1/health` -> `200` | Connected PG + Redis + WS endpoints; pre-migration `42P01` telemetry table error resolved once migrations ran |
| `ai-backend` | Healthy | Up (healthy) | `urllib http://127.0.0.1:8000/health` -> `200` | Loaded `/app/saved_models/gru_model_8feature.pth`, `Application startup complete` |
| `installer-service` | Healthy | Up (healthy) | `urllib http://127.0.0.1:8100/health` -> `200` | `Uvicorn running on http://0.0.0.0:8100` |
| `selfheal-frontend` | Running | Up (`80/tcp`) | Served static SPA via `nginx-proxy` | `nginx/1.25.5` started cleanly |
| `nginx-proxy` | Blocked by main-backend wait | Up (healthy) | `wget http://localhost/healthz` -> `200` | `/healthz` returned `{"status":"ok","proxy":"nginx-reverse-proxy"}` |

---

## 4. Container Security Verification (CP-1.2)

Verified via live `docker inspect` and `docker exec ... cat /proc/1/status`:

| Container | Runtime PID 1 Process | Actual UID / GID (`/proc/1/status`) | `NoNewPrivs` | `CapEff` / Caps | `Privileged` | `RO Rootfs` | Memory Limit | Storage / Volume Notes |
|---|---|---|---|---|---|---|---|---|
| `postgres` | `postgres` | `70 / 70` (root drops) | `1` (`true`) | `0000000000000000` | `false` | `false` | `512MiB` (`536870912`) | Staging volume `/var/lib/postgresql/data` (`rw`) |
| `redis` | `redis-server` | `999 / 1000` (after entrypoint drop) | `1` (`true`) | `0000000000000000` (`CapDrop: ALL`, `CapAdd: CHOWN, SETUID, SETGID, DAC_OVERRIDE`) | `false` | `false` | `256MiB` (`268435456`) | Staging volume `/data` (`rw`) |
| `main-backend` | `node` | `1000 / 1000` (`node`) | `1` (`true`) | `0000000000000000` (`CapDrop: ALL`) | `false` | `false` | `512MiB` (`536870912`) | No host mounts |
| `ai-backend` | `uvicorn` | `10001 / 10001` (`appuser`) | `1` (`true`) | `0000000000000000` (`CapDrop: ALL`) | `false` | `false` | `1GiB` (`1073741824`) | Runtime write/read/unlink probe inside `/app/saved_models`: `WRITE_OK: ok` |
| `installer-service` | `uvicorn` | `10001 / 10001` (`appuser`) | `1` (`true`) | `0000000000000000` (`CapDrop: ALL`) | `false` | `false` | `256MiB` (`268435456`) | No host mounts |
| `selfheal-frontend` | `nginx` master (`nginx` workers) | **Master `0 / 0` (root)**; workers `nginx` | `1` (`true`) | `00000000a80425fb` | `false` | `false` | `256MiB` (`268435456`) | Standard `nginx:1.25-alpine` listens on `:80` (<1024) and writes `/var/run/nginx.pid` + cache as root before spawning workers |
| `nginx-proxy` | `nginx` master (`nginx` workers) | **Master `0 / 0` (root)**; workers `nginx` | `1` (`true`) | `00000000a80425fb` | `false` | `false` | `256MiB` (`268435456`) | Same root reason; recommendation: migrate both to `nginxinc/nginx-unprivileged:alpine` on port `8080` behind host TLS proxy |

> **Resource Limits Note:** `docker-compose.prod.yml` currently omits `deploy.resources.limits` (which were applied in staging compose); recommended for production hardening.

---

## 5. Network Exposure Verification (CP-1.3)

| Check | Target | Observed Result |
|---|---|---|
| Host Port Bindings (`selfheal_staging`) | `docker inspect` `.HostConfig.PortBindings` | Only `nginx-proxy` published `127.0.0.1:18090->80/tcp`. `postgres`, `redis`, `ai-backend`, `main-backend`, `installer-service`, `selfheal-frontend` all `Ports={}`. |
| Proxy -> Frontend Root | `GET http://127.0.0.1:18090/` | `HTTP 200`, `text/html`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Server: nginx` (no version). |
| Proxy -> `/ai/*` Exposure | `GET http://127.0.0.1:18090/ai/health` & `/ai/api/v1/model/active` | Blocked from reaching `ai-backend` (served `text/html` Frontend SPA instead of AI JSON). |
| Proxy -> Backend Health | `GET http://127.0.0.1:18090/api/v1/health` | `HTTP 200`, JSON without DB host/name/port/error disclosure. |
| Internal Docker DNS (`main-backend` -> `ai-backend`) | `http://ai-backend:8000/health` & unauthenticated `POST /api/v1/predict` | `/health` -> `200`; unauthenticated `/predict` -> `401 {"detail":"Missing internal authentication headers"}`. |
| Shared Bridge Segmentation Note | `docker exec nginx-proxy nc -z` | Because Compose currently uses a single bridge network (`captone-network`), containers can resolve sibling DNS (`postgres:5432`, `redis:6379`, `ai-backend:8000`). Splitting into `edge` + `internal` Docker networks is recommended as P2 defense-in-depth. |

> **Legacy Host Containers Warning:** Pre-existing host stack containers (`captone-postgres:5433`, `captone-redis:6380`, `captone-main-backend:5005`, `captone-installer-service:8100`) still run on `0.0.0.0` from before Sprint B and should be restarted from the hardened Compose definitions when cutting over.

---

## 6. HMAC Internal Service Authentication Results (CP-2)

Verified cross-container (`selfheal_staging-main-backend-1` -> `http://ai-backend:8000`) AND via pytest (`AI_backend/tests/test_sb02_security.py`):

| Test Case | Live / Unit Result | Exact Observed Status & Response |
|---|---|---|
| Valid HMAC `POST /api/v1/predict` | PASS | `HTTP 200` |
| Reused Nonce Replay | PASS | `HTTP 401 {"detail":"Replayed internal authentication nonce"}` |
| Request Body Tampering (`sign Body A`, `send Body B`) | PASS | `HTTP 401 {"detail":"Request body digest mismatch"}` |
| Missing `X-Internal-Signature` | PASS | `HTTP 401` |
| Invalid `X-Internal-Signature` (`'f' * 64`) | PASS | `HTTP 401` |
| Expired Timestamp (`-120s`) & Future Timestamp (`+120s`) | PASS | `HTTP 401` |
| Path / Method Mismatch | PASS | `HTTP 401` (`test_sb02_02`) |
| Concurrent Nonce Replay (8 threads, 1 nonce) | PASS | Strictly 1 `200`, 7 `401` (`test_sb02_02b`) |
| Missing Secret (`secret=""`) | PASS | Fail closed `HTTP 503` (`test_sb02_02`) |
| Weak / Missing Secret in `APP_ENV=production` | PASS | `ValueError` at config load (`test_sb02_03`) |
| Constant-Time Signature & Digest Comparison | Verified in code | `hmac.compare_digest` used for both signature and `X-Internal-Body-Sha256` in `internal_auth.py` & `model_management.py` |
| Secret Exposure Audit | PASS | Zero matches for `AI_INTERNAL_HMAC_SECRET` / `aiInternalHmacSecret` in `Frontend/src/`; `0` secret occurrences in staging container logs (`SECRETS_IN_LOGS_COUNT=0`) |

> **Scaling Note:** Nonce replay cache (`_SEEN_NONCES` protected by `threading.Lock`) is process-local. Current `AI_backend` container runs a single Uvicorn worker; if ever scaled to `--workers > 1`, migrate nonce cache to authenticated Redis `SET NX EX`.

---

## 7. AI Model Upload Runtime Security Results (CP-3)

Executed **inside the live `selfheal_staging-ai-backend-1` container** (`Python 3.12.16`, `torch`, `fastapi`, `pytest`):

| Test Case | Result | Evidence |
|---|---|---|
| `test_sb02_01..05` in live AI container | **6/6 PASS** (`AI_SB02_EXIT=0`, `5.69s`) | Executed against `/app/app` and `/app/saved_models` as `appuser` |
| Valid `.pt` upload & switch | PASS | Saved as `<uuid>_valid_test.pt` inside `SAVED_MODELS_DIR`; response `file_path` returns filename only (no absolute path) |
| Invalid file extensions (`malware.exe`) | PASS | Rejected `HTTP 400` |
| Empty (`0`-byte) `.pth` upload | PASS | Fixed & verified: rejected `HTTP 400`, zero-byte file unlinked |
| Oversized upload (`> max_model_upload_bytes`) | PASS | Enforced chunk-by-chunk while streaming (`1MB` chunks), rejected `HTTP 413`, partial file unlinked |
| Traversal (`../evil.pth`, `/etc/passwd.pth`, `sub/%2e%2e/evil.pth`) | PASS | Rejected `HTTP 400` |
| Symlink escape inside `saved_models` (`symlink_to('/etc/passwd')`) | PASS | Rejected `HTTP 400` |
| Crafted oversized GRU checkpoint (`hidden_size=99999`) | PASS | Validation fails cleanly (`validate_model_config`); generic error returned without absolute path leak |
| Concurrent upload (crafted checkpoint) + concurrent `/model/switch` | PASS | Protected by `_MODEL_OP_LOCK` (`asyncio.Lock`) + `run_in_threadpool`; active model remains healthy and serves `POST /api/v1/predict` -> `200` |
| Deserialization Audit (`evaluation_service.py`, `prediction_service.py`) | PASS | Both call `torch.load(..., map_location="cpu", weights_only=True)` — no arbitrary pickle execution or `joblib`/`yaml.load` usage |

---

## 8. Redis and PostgreSQL Security Results (CP-4)

### Redis (`selfheal_staging-redis-1`)
- **Unauthenticated probe (`redis-cli ping`):** `NOAUTH Authentication required.` (PASS).
- **Authenticated probe (`redis-cli -a ... ping`):** `PONG` (PASS).
- **Network Exposure:** Internal-only (`Ports={}`).
- **Main Backend Integration:** Health endpoint confirmed `redis: { status: "CONNECTED" }`.
- **Single-Use WS Ticket (`WsTicketService`):**
  - `TICKET_LEN=64`, `EXPIRES_IN=30`, `REDIS_TTL=30`.
  - Concurrent Lua `GET`+`DEL` test (`10` parallel consumes of 1 ticket): `CONCURRENT_CONSUME_HITS=1/10` (strictly atomic).
  - Expired ticket (`pexpire` 150ms -> consume at 250ms): `EXPIRED_TICKET_CONSUMED=null`.
- **Dev Compose Caveat:** `docker-compose.yml` still starts Redis without `--requirepass` (`docker-compose.prod.yml` enforces `--requirepass`).

### PostgreSQL (`selfheal_staging-postgres-1` & `aiselfhealing_test`)
- **Network Exposure:** `docker-compose.prod.yml` updated to `expose: ["5432"]` (zero host ports).
- **Hardcoded Credentials:** Production `env.ts` & `docker-compose.prod.yml` fail closed on missing secrets; no hardcoded DB passwords in application source.
- **Full Migrations Run:** `docker exec selfheal_staging-main-backend-1 node dist/scripts/migrate.js` executed all 18 SQL migrations (`00_init...sql` -> `26_backfill_execution_status_completed.sql`) on clean `aiselfhealing_staging` -> `STAGING_MIGRATE_EXIT=0`.
- **Error Disclosure Verification:**
  - Unauthenticated `/organizations/invalid-id/clusters` -> `HTTP 401` JSON.
  - Malformed JSON `/auth/login` -> `HTTP 400` JSON.
  - Simulated unhandled `pg`-like `500` error (`relation "users_secret_table" ... password=supersecret`) under `NODE_ENV=production` -> `HTTP 500 {"success":false,"message":"Internal Server Error",...}` (SQL/password suppressed from HTTP client).
  - Public `GET /api/v1/health` under `NODE_ENV=production` -> internal DB name, host, port, and raw error details omitted.
- **PostgreSQL RLS:** Deferred to P2 backlog as instructed.

---

## 9. HITL and Agent Runtime Verification Results (CP-5)

### Backend HITL & Agent WebSocket (`sprintBSecuritySB03.test.ts` — 6/6 PASS, `SB03_EXIT=0` against `aiselfhealing_test`)
| Test | Scenario Verified | Result |
|---|---|---|
| `SB03-01` | Rejects `PENDING` (`403`), `REJECTED` (`403`), `CANCELLED` (`409`); executes `APPROVED` once; rejects repeat (`409`); **5 concurrent `executeAction` calls allow strictly 1 execution and reject 4 atomically** | PASS |
| `SB03-01b` | `createAction` with `risk_level: 'HIGH'` + `execution_mode: 'AUTO'` stays `PENDING` approval; `LOW` + `AUTO` normalizes to `'AUTOMATIC'` + `'APPROVED'` matching real `pg_enum` | PASS |
| `SB03-02` | `POST /api/v1/ai/recommendations/:id/apply` on `HIGH` risk stops at HITL gate (`HTTP 202`, `hitl_required: true`, `PENDING/PENDING`) | PASS |
| `SB03-03` | `AgentModel.findByTokenHash` rejects raw hash fallback (`null`) and only matches SHA-256 of raw token | PASS |
| `SB03-04` | `agentWebSocket` ignores/blocks cross-tenant `action_result` for Org B and closes session on re-auth (`4003`) | PASS |
| `SB03-05` | Revoked agent token (`revoked_at = NOW()`) rejected by `AgentModel` and closed with WebSocket `4001` | PASS |

### Kubernetes Agent Security (`Agent/tests/test_sb03_agent_security.py` — 5/5 PASS) & Minikube RBAC
- `ENABLE_HEALING_ACTIONS=False` fails closed on mutating actions while permitting `NO_ACTION`: PASS.
- Disallowed `action_type` fails closed: PASS.
- `action_id` replay cache & expired `expires_at` rejected: PASS.
- `PROTECTED_NAMESPACES` blocks all mutations including `TEMPORARY_IP_BLOCK`: PASS.
- IP/CIDR validation blocks private/loopback/CGNAT/ULA and broad ranges (`< /24` IPv4, `< /64` IPv6): PASS.
- **Minikube `selfheal-agent-sa` (`selfheal-system`) Read-Only Check:**
  - `create secrets --all-namespaces`: **`no`**
  - `* * --all-namespaces` (`cluster-admin`): **`no`**
  - `patch deployments -n kube-system`: **`yes`** at K8s RBAC level (because default manifest uses cluster-wide `ClusterRole`; blocked in application layer by `PROTECTED_NAMESPACES` — recommended to set `clusterScope: false` in Helm for single-namespace tenants).

---

## 10. Full Test Inventory (CP-6 — Run After Final Edit)

| Component | Command | Total | Passed | Failed | Skipped | Exit Code | Environment | Classification / Notes |
|---|---|---|---|---|---|---|---|---|
| **Main_backend TS** | `npx tsc --noEmit` | — | — | 0 | 0 | `0` | Host Node | **PASS** |
| **Main_backend CI** | `npm run test:ci` | 4 | 4 | 0 | 0 | `0` | Host Node | **PASS** |
| **Main_backend Sprint A DB** | `npx ts-node src/test/sprintAPostgresIntegration.test.ts` | 10 | 10 | 0 | 0 | `0` | Host `aiselfhealing_test` + Redis `6380` | **PASS** |
| **Main_backend Telemetry Pipe** | `npx ts-node src/test/sprintATelemetryPipeline.test.ts` | 8 | 8 | 0 | 0 | `0` | Host `aiselfhealing_test` + Redis `6380` | **PASS** |
| **Main_backend SB-01** | `npx ts-node src/test/sprintBSecuritySB01.test.ts` | 8 | 8 | 0 | 0 | `0` | Host `aiselfhealing_test` + Redis `6380` | **PASS** |
| **Main_backend SB-03** | `npx ts-node src/test/sprintBSecuritySB03.test.ts` | 6 | 6 | 0 | 0 | `0` | Host `aiselfhealing_test` + Redis `6380` | **PASS** |
| **Main_backend SB-04** | `npx ts-node src/test/sprintBSecuritySB04.test.ts` | 5 | 5 | 0 | 0 | `0` | Host `aiselfhealing_test` + Redis `6380` | **PASS** |
| **Main_backend SB-05 Ticket** | `npx ts-node src/test/sprintBSecuritySB05Ticket.test.ts` | 2 | 2 | 0 | 0 | `0` | Host `aiselfhealing_test` + Redis `6380` | **PASS** |
| **Main_backend Google Auth** | `npx ts-node src/test/googleAuth.test.ts` | 3 | 3 | 0 | 0 | `0` | Host `aiselfhealing_test` | **PASS** |
| **Main_backend Agent Auth** | `npx ts-node src/test/agentAuth.test.ts` | 11 | 11 | 0 | 0 | `0` | Host `aiselfhealing_test` | **PASS** |
| **Main_backend Tenant Iso** | `npx ts-node src/test/tenantIsolation.test.ts` | 10 | 10 | 0 | 0 | Timed out (12s) | Host `aiselfhealing_test` + Redis `6380` | **INCONCLUSIVE** (All 10 assertions pass; process hangs on unclosed DB/Redis handle) |
| **Main_backend Role Assign** | `npx ts-node src/test/roleAssignmentSecurity.test.ts` | 15 | 15 | 0 | 0 | Timed out (12s) | Host `aiselfhealing_test` + Redis `6380` | **INCONCLUSIVE** (All 15 assertions pass; process hangs on unclosed handle) |
| **Main_backend RBAC Matrix** | `npx ts-node src/test/rbacMatrix.test.ts` | 29 | 28 | 1 | 0 | `1` | Host `aiselfhealing_test` + Redis `6380` | **FAIL (Outdated Test / Decision 2.2):** `3.8` SuperAdmin restart pod omits `organization_id` -> `400` |
| **Main_backend Sprint A Sec** | `npx ts-node src/test/sprintASecurity.test.ts` | 37 | 36 | 1 | 0 | `0` (custom script) | Host `aiselfhealing_test` + Redis `6380` | **FAIL (Decision 2.2):** `WS-10` SuperAdmin global WS without `organization_id` rejected (`4003`) |
| **Main_backend Legacy RBAC** | `npx ts-node src/test/rbac.test.ts` | 25 | 10 | 15 | 0 | `1` | Host `aiselfhealing_test` + Redis `6380` | **FAIL (Decision 2.2):** 15 legacy tests omit `organization_id` -> `400` / WS `4003` |
| **AI_backend SB-02/03 Container** | `pytest /tmp/test_sb02_security.py -v` | 6 | 6 | 0 | 0 | `0` | `selfheal_staging-ai-backend-1` (`Python 3.12`) | **PASS** |
| **AI_backend Combined Container** | `pytest` 7 suites in `/tmp/ai_full_tests` (`test_sb02_security`, `test_evidence_pipeline`, `test_phase_a_evidence_isolation`, `test_circuit_breaker_error_details`, `test_rca_core`, `test_prediction`, `test_rca`) | 88 | 61 | 27 | 0 | `1` | `selfheal_staging-ai-backend-1` (`Python 3.12`) | **FAIL (Legacy tests unauthenticated / missing `/trainGRU`):** 19 legacy HTTP tests fail `401 Missing internal authentication headers` (expected after HMAC enforcement); 8 fail `FileNotFoundError: /trainGRU/sample_batch_8feature.json` |
| **Agent SB-03 Security** | `python -m pytest tests/test_sb03_agent_security.py -v` | 5 | 5 | 0 | 0 | `0` | Host `Python 3.14` | **PASS** |
| **Agent Full Suite** | `python -m pytest -q` | 75 | 74 | 1 | 0 | `1` | Host `Python 3.14` | **FAIL (Outdated Status Test):** `test_workload_target_resolution.py:74` asserts `'SUCCEEDED'` instead of `'COMPLETED'` |
| **Frontend Targeted Sec/Err/RBAC** | `npm test -- --watchAll=false --testPathPattern="SprintBSecurity\|OrganizationSwitcher\|ErrorRouting\|ForbiddenPage\|PixelStatusPage\|RBAC\.test\|Users\.test"` | 64 | 64 | 0 | 0 | `0` | Node / jsdom | **PASS** (7/7 suites) |
| **Frontend Full Jest Suite** | `npm test -- --watchAll=false` | 688 | 600 | 82 | 6 | `1` | Node / jsdom | **FAIL (Legacy suites):** 80/92 suites pass; 12 pre-existing/legacy failures (`personalPortalService`, `TopHeader`, `SocialProofSection`, `ApmDashboard`, `AdminLayout`, `Admin/AI`, `Admin/AuditLogs`, `OverviewDashboard`, `Admin/Incidents`, `Admin/SelfHealing`, `Admin/Organizations`, `App.test.js` due to unauthenticated guard / old copy / `'SUCCEEDED'` expectations) |
| **Frontend Production Build** | `npm run build` | — | — | 0 | 0 | `0` | Node | **PASS** (`main.8c08f853.js`) |

---

## 11. Updated Security Audit Findings Mapping (CP-7)

| Audit ID | Finding | Status | Evidence & Notes |
|---|---|---|---|
| **BE-01** | Global RBAC bypass & Healing Action IDOR / Default Lab bypass | **VERIFIED CLOSED** | `PG-01..10`, `RBAC-01..14`, `SB01-01..08` pass against real `aiselfhealing_test`. |
| **BE-02** | Telemetry WS tenant leak & missing revocation/`HS256` | **VERIFIED CLOSED** | `WS-01..18` (except legacy `WS-10` Cat B), `SB01-06..07`, `SB05-01..02` pass at runtime. |
| **BE-03** | Google OAuth missing `aud`/`iss`/`email_verified` | **VERIFIED CLOSED** | Cryptographic RS256 JWKS verified in `SB04-01..02` & `googleAuth.test.ts` (`3/3`). |
| **BE-04** | OTP leakage & unverified `/users/verify-email` bypass | **VERIFIED CLOSED** | Verified in `SB04-03` against PostgreSQL & Redis. |
| **BE-05** | 2FA disable without re-auth & plaintext `secret_key` | **VERIFIED CLOSED** | AES-256-GCM encrypted at rest, replay-protected, re-auth enforced (`SB04-04`). |
| **BE-06** | Reflected XSS in `GET /auth/verify-email` | **VERIFIED CLOSED** | HTML escaping verified (`SB04-05`). |
| **BE-07** | Missing refresh token rotation, PG RLS/SSL, Redis rate limiter | **OPEN** *(Deferred P2)* | PostgreSQL RLS/SSL & Redis-backed HTTP rate limiter remain P2 roadmap items. |
| **AI-01** | Public `/ai/*` proxy exposure & unauthenticated AI API | **VERIFIED CLOSED** | Live Nginx `/ai/*` blocked; cross-container HMAC + body-sha256 verified (`200` valid, `401` missing/tampered/replayed/expired). |
| **AI-02** | Path traversal on model upload / switch | **VERIFIED CLOSED** | Verified inside `ai-backend` container (`test_sb02_05` `6/6` pass incl. symlink, `../`, `/etc/passwd.pth`, `%2e%2e`). |
| **AI-03** | Unbounded upload, blocking event loop, path leak, GRU bounds | **VERIFIED CLOSED** | Chunked streaming `413`, empty `400`, `asyncio.Lock`, `run_in_threadpool`, generic error, GRU bounds all verified inside container. |
| **AI-04** | Missing Pydantic bounds & `NaN`/`Inf` rejection | **VERIFIED CLOSED** | Verified in `test_sb02_04`. |
| **K8S-01** | Direct HITL bypass (`/execute`, `/apply`, `ENABLE_HEALING_ACTIONS`) | **VERIFIED CLOSED** | `SB03-01..02` (`aiselfhealing_test` + fixed enum normalization) & Agent `test_sb03_a01` pass. |
| **K8S-02** | Raw `token_hash` fallback & weak tokens | **VERIFIED CLOSED** | `SB03-03` & `agentAuth.test.ts` (`11/11`) pass (`00_init` dev seed untouched). |
| **K8S-03** | Agent WS replay/allowlist/CIDR/scope & `wss://` | **PARTIALLY MITIGATED** | Replay, `expires_at`, strict allowlist, CIDR guard, revocation (`SB03-05`), re-auth (`4003`), ownership isolation **VERIFIED CLOSED**; live `wss://` depends on VPS TLS provisioning (`INF-01`), and live pod mutation against Minikube was not run. |
| **K8S-04** | Hardcoded production secrets & unhardened pods in `k8s/` | **IMPLEMENTED BUT NOT RUNTIME VERIFIED** | Manifests & `secrets.example.yaml` updated; not yet applied onto Minikube cluster. |
| **FE-01** | Client route guard bypass & `localStorage` escalation | **VERIFIED CLOSED** | `SprintBSecurity.test.jsx` (`4/4`) & `ErrorRouting.test.jsx` (`8/8`) pass. |
| **FE-02** | JWT in WebSocket query string & console log | **VERIFIED CLOSED** | Replaced by Redis single-use 30s Lua ticket (`SB05-01..02` + staging Redis `WS_TICKET_EXIT=0`). |
| **FE-03** | JWT in `localStorage` without `HttpOnly` refresh cookie | **OPEN** *(Deferred P2)* | Out of Sprint B scope; risk reduced by WS ticket & route guards. |
| **FE-04** | Website URL XSS & CSV formula injection | **VERIFIED CLOSED** | Verified in `SprintBSecurity.test.jsx` & `ErrorRouting.test.jsx`. |
| **INF-01** | Missing HTTPS/TLS `:443` & Nginx security headers | **PARTIALLY MITIGATED** | Security headers, `server_tokens off`, `/api/v1/auth/` rate limit verified in staging Nginx; **TLS `:443` remains OPEN (Production Blocker)** awaiting VPS domain certificates. |
| **INF-02** | Exposed Postgres & unauthenticated Redis | **PARTIALLY MITIGATED** | Prod compose hardened (`postgres` internal-only, Redis `--requirepass` + working caps verified in staging); dev `docker-compose.yml` Redis remains unauthenticated for local dev convenience. |
| **INF-03** | Containers running as `root` & missing resource limits | **PARTIALLY MITIGATED** | `main-backend` (`1000`), `ai-backend` (`10001`), `installer-service` (`10001`), `postgres` (`70`), `redis` (`999`) verified non-root at PID 1; Nginx master in `selfheal-frontend` & `nginx-proxy` still runs PID 1 UID 0 (`nginx` workers drop privilege), and `docker-compose.prod.yml` omits `deploy.resources.limits`. |
| **INF-04** | Unauthenticated OTel/Prometheus & debug exporter | **OPEN** *(Deferred P3)* | Out of Sprint B scope. |
| **INF-05** | RabbitMQ Message Broker | **NOT APPLICABLE** | Explicitly excluded per Decision 7. |
| **INF-06** | NPM CVEs (`zod`, `body-parser`, `react-scripts`) & CI checks | **OPEN** *(Deferred P2)* | Dependency upgrades intentionally deferred per Section 4 Execution Rules. |

---

## 12. Modified Files Inventory (Phase 1 Changes Added on Top of Sprint B Baseline)

- [`docker-compose.prod.yml`](file:///d:/AISelfHealing/docker-compose.prod.yml) — Removed host `ports` on `postgres` (now internal `expose: ["5432"]` only); added explicit `cap_drop: [ALL]` + `cap_add: [CHOWN, SETUID, SETGID, DAC_OVERRIDE]` on `redis` so entrypoint `setpriv` succeeds cleanly.
- [`Main_backend/src/utils/internalAuth.ts`](file:///d:/AISelfHealing/Main_backend/src/utils/internalAuth.ts) — Added `X-Internal-Body-Sha256` payload digest into HMAC-SHA256 canonical signing string.
- [`Main_backend/src/services/ai.service.ts`](file:///d:/AISelfHealing/Main_backend/src/services/ai.service.ts) — Bound serialized JSON bodies into HMAC headers on `/api/v1/predict` and `/api/v1/rca`.
- [`Main_backend/src/services/aiModelRegistry.service.ts`](file:///d:/AISelfHealing/Main_backend/src/services/aiModelRegistry.service.ts) — Bound file buffer digest on `/api/v1/model/upload` and serialized JSON body on `/api/v1/model/switch`.
- [`Main_backend/src/middlewares/error.middleware.ts`](file:///d:/AISelfHealing/Main_backend/src/middlewares/error.middleware.ts) — Masked raw internal 500 error messages (`pg`/SQL/system details) to `'Internal Server Error'` in non-development mode.
- [`Main_backend/src/controllers/health.controller.ts`](file:///d:/AISelfHealing/Main_backend/src/controllers/health.controller.ts) — Redacted DB name/host/port/error, Redis host/port, and `nodeVersion` from public `/api/v1/health` in non-development mode.
- [`Main_backend/src/models/healingAction.model.ts`](file:///d:/AISelfHealing/Main_backend/src/models/healingAction.model.ts) — Normalized `execution_mode` to valid enum `'AUTOMATIC'`/`'MANUAL'`/`'SEMI_AUTOMATIC'`; used valid `'APPROVED'` instead of nonexistent `'NOT_REQUIRED'`; enforced `HIGH`/`CRITICAL` HITL approval even under `AUTOMATIC` mode + checked `requires_approval_by_default`.
- [`AI_backend/app/core/internal_auth.py`](file:///d:/AISelfHealing/AI_backend/app/core/internal_auth.py) — Verified mandatory `X-Internal-Body-Sha256` on JSON bodies and propagated expected upload digest via `request.state` for multipart streaming verification.
- [`AI_backend/app/api/model_management.py`](file:///d:/AISelfHealing/AI_backend/app/api/model_management.py) — Verified streaming SHA-256 digest during upload chunks, rejected empty `0`-byte uploads (`400`), added explicit symlink rejection + `%2e`/`%2f`/`..` checks in `resolve_model_path`.
- [`AI_backend/tests/test_sb02_security.py`](file:///d:/AISelfHealing/AI_backend/tests/test_sb02_security.py) — Expanded negative HMAC tests (future skew, body tampering, concurrent nonce replay, missing secret fail-closed) and real PyTorch checkpoint/upload security tests.
- [`Main_backend/src/test/sprintBSecuritySB03.test.ts`](file:///d:/AISelfHealing/Main_backend/src/test/sprintBSecuritySB03.test.ts) — Expanded runtime tests for `REJECTED`, `CANCELLED`, concurrent `executeAction`, `HIGH+AUTO` HITL gate, valid enum persistence, and revoked agent WebSocket `4001`.

*(All prior Sprint B modified/added files remain intact in working tree; `git status --short` shows 79 modified tracked files + 15 untracked files/dirs.)*

---

## 13. Remaining Security Risks

1. **Unencrypted External Transport (`INF-01` — Production Blocker):** Public Nginx currently terminates HTTP `:80` only. Credentials, JWTs, OAuth tokens, WS tickets, and Agent WebSocket traffic lack transport encryption until TLS `:443` / `wss://` certificates are deployed on VPS.
2. **Stale Pre-Sprint-B Host Containers Running:** The host's long-running `captone-*` containers (`5433`, `6380`, `5005`, `8100`) still run older builds bound to `0.0.0.0` and must be replaced cleanly when deploying Sprint B.
3. **Single-Worker HMAC Nonce Cache & Unsplit Docker Bridge:** Multi-worker Uvicorn scaling would split `_SEEN_NONCES` memory unless backed by Redis; single Docker bridge network allows east-west TCP reachability between proxy and DB/AI containers.
4. **Nginx Master Process Runs as Root (`INF-03`):** Both `nginx-proxy` and `selfheal-frontend` drop worker processes to `nginx`, while master binds port 80 as UID 0.
5. **K8s Default `ClusterRole` Grants Cross-Namespace Deployment Mutation (`K8S-03`):** Mitigated by Agent Python `PROTECTED_NAMESPACES`, though K8s RBAC itself allows `patch deployments` in `kube-system` when deployed with `clusterScope: true`.

---

## 14. Production Readiness Checklist (PO Gate Before Go-Live)

- [x] `Main_backend` (`1000`), `AI_backend` (`10001`), `installer-service` (`10001`), `postgres` (`70`), `redis` (`999`) verified non-root UID at runtime.
- [x] Staging `redis` boots with `--requirepass`, rejects unauthenticated clients (`NOAUTH`), and atomically enforces single-use WS tickets.
- [x] Staging `postgres` executes all 18 migrations cleanly and `error.middleware.ts` + `health.controller.ts` mask internal SQL/host errors.
- [x] Cross-container HMAC-SHA256 + body SHA-256 integrity, timestamp window, and concurrent replay protection verified live.
- [x] AI model upload streaming `413`, empty `400`, path/symlink `400`, `weights_only=True`, and concurrent swap safety verified inside Linux AI container.
- [x] HITL atomic transition lock, `HIGH+AUTO` gating, `COMPLETED` canonical status, and revoked agent `4001` rejection verified against PostgreSQL + WebSocket.
- [ ] Configure VPS domain TLS certificates (`listen 443 ssl`, HTTP -> HTTPS redirect, `wss://` for Agent & UI).
- [ ] Populate strong >= 32-char `.env` / K8s Secrets (`JWT_SECRET`, `AI_INTERNAL_HMAC_SECRET`, `TOTP_ENCRYPTION_KEY`, `DB_PASSWORD`, `REDIS_PASSWORD`) — never use dev defaults.
- [ ] Rebuild & cut over running host stack; verify Minikube/K8s manifests & Agent live pod remediation in isolated namespace.

---

## 15. Recommended P2 / P3 Backlog

1. **P2 — Update Legacy Test Suites (Requires PO Approval):** Migrate `rbac.test.ts`, `rbacMatrix.test.ts` `3.8`, `sprintASecurity.test.ts` `WS-10` to Decision 2.2 (`organization_id`), update `Agent/test_workload_target_resolution.py` & `Frontend` legacy tests to `'COMPLETED'` and authenticated mocks, add `await pool.end()/closeRedis()` to `tenantIsolation.test.ts` & `roleAssignmentSecurity.test.ts`, and add HMAC test helper to `AI_backend` `test_prediction.py` / `test_rca.py`.
2. **P2 — Infrastructure & Transport Hardening:** Provision Certbot/TLS `:443` in `nginx/nginx.conf`, split `docker-compose.prod.yml` networks into `frontend-edge` and `backend-internal`, add `deploy.resources.limits` & `--requirepass` in dev compose if desired, and switch `Frontend`/`nginx` to `nginxinc/nginx-unprivileged` on `:8080`.
3. **P2 — Dependency CVE Upgrades & Auth Roadmap:** Upgrade `Main_backend` (`zod`, `body-parser`, `nodemailer`) and plan `Frontend` `react-scripts` -> Vite migration (`INF-06`); implement short-lived JWT + `HttpOnly` refresh token rotation (`FE-03`, `BE-07`) and evaluate PostgreSQL RLS + SSL (`BE-07`).
4. **P3 — Distributed AI Nonce Cache & Observability Security:** Move AI HMAC nonce tracking to Redis `SET NX EX` if multi-worker Uvicorn is enabled; enable auth/mTLS on OTel Collector & Prometheus scraping (`INF-04`); default Agent Helm chart to `clusterScope: false`.
