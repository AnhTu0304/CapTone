# SPRINT C — PHASE 1: POSTGRESQL RLS & DATABASE ACCESS CONTROL IMPLEMENTATION REPORT

**Project:** AI-Driven Proactive Self-Healing Infrastructure for SMEs  
**Branch:** `feature/security`  
**Date:** 2026-11-19  
**Target Database Executed:** Isolated Test Database `aiselfhealing_test` (PostgreSQL 18.6)  
**Runtime / Legacy Containers (`captone-*`, `captone_db`, `aiselfheal`):** Untouched (Zero modifications)

---

## 1. Approved Design Reference
- Baseline audit: `SPRINT_C_PHASE_0_DATA_SECURITY_AUDIT.md` (Design A — PostgreSQL Row-Level Security & Role Separation).
- Product Owner approvals confirmed prior to implementation:
  - **A1:** 33 tenant-scoped tables + 1 hybrid `audit_logs` table (plus 3 reconciled alert tables = **37 RLS-protected tables**); 10 Global/System/Auth tables excluded from tenant RLS.
  - **A2:** `ENABLE` + `FORCE ROW LEVEL SECURITY` fail-closed; hybrid `notifications` policy allowing users to read personal `organization_id IS NULL` notifications while keeping org-scoped alerts isolated; `audit_logs` hiding `organization_id IS NULL` platform rows from tenant queries.
  - **A3:** Reconcile missing `alert_rules`, `alert_events`, `alert_event_history` tables via idempotent migration + RLS.
  - **A4:** `AsyncLocalStorage` + `SET LOCAL` transaction-local context propagation (`withTenantTx`, `runWithTenantContext`), separated roles (`selfheal_migrator`, `selfheal_app`, `selfheal_readonly`), isolated execution on `aiselfhealing_test`.

---

## 2. Files & Migrations Changed

### Migrations & Rollback Scripts Added
- `Main_backend/migrations/29_create_alert_tables.sql` — Reconciles missing `alert_rules`, `alert_events` (including `uq_alert_events_open_dedup` partial unique index), and `alert_event_history`.
- `Main_backend/migrations/rollback/29_create_alert_tables.down.sql` — Rollback DDL for Migration 29.
- `Main_backend/migrations/30_sprint_c_phase1_rls_and_roles.sql` — Creates least-privilege roles (`selfheal_migrator`, `selfheal_app`, `selfheal_readonly`, and `NOLOGIN` `selfheal_sysdefiner`), transfers ownership of all `public` tables/views/standalone sequences to `selfheal_migrator`, creates fail-closed GUC accessors (`app_access_scope`, `app_current_org_id`, `app_current_user_id`) and narrow `SECURITY DEFINER` lookup helpers (`fn_authenticate_agent_token`, `fn_list_active_organization_ids`, `fn_lookup_invitation_by_token_hash`, `fn_lookup_approval_context`, `fn_user_has_org_membership`), and enforces `ENABLE` + `FORCE ROW LEVEL SECURITY` with **86 policies across 37 tables**.
- `Main_backend/migrations/rollback/30_sprint_c_phase1_rls_and_roles.down.sql` — Non-destructive rollback disabling RLS and removing Sprint C policies/functions while preserving data.

### Application & Test Files Modified / Added
- `Main_backend/src/config/dbContext.ts` *(new)* — `AsyncLocalStorage` tenant/auth/platform/system context store (`runWithDbContext`, `runWithTenantContext`, `setActiveDbContext`, `enterOrUpdateDbContext`, `isValidUuid`).
- `Main_backend/src/config/database.ts` — Intercepts `pool.query` and `pool.connect` (passing internal callback-based calls through cleanly) to inject transaction-local `set_config('app.access_scope', ..., true)`, `app.current_org_id`, `app.current_user_id`; exports `withTenantTx`, `withPlatformAdminTx`, `withSystemTx`, and migration-only `createMigratorPool()`.
- `Main_backend/src/config/env.ts` — Adds `config.dbMigrator` (`DB_MIGRATOR_USER`, `DB_MIGRATOR_PASSWORD`, `DB_MIGRATOR_URL`) separated from runtime `config.db`.
- `Main_backend/src/scripts/migrate.ts` — Uses `createMigratorPool()` instead of runtime `pool`.
- `Main_backend/src/middlewares/auth.middleware.ts`, `orgAuth.middleware.ts`, `rbac.middleware.ts`, `agentAuth.middleware.ts` — Propagate `AUTH`, `TENANT`, and `PLATFORM_ADMIN` contexts derived exclusively from DB-verified authentication/membership.
- `Main_backend/src/models/agent.model.ts`, `organizationInvitation.model.ts`, `incident.model.ts`, `healingAction.model.ts` — Use narrow `SECURITY DEFINER` auth lookups (`fn_authenticate_agent_token`, `fn_lookup_invitation_by_token_hash`), add explicit `organization_id` filtering (`AgentModel.listAll`, `IncidentModel.getRecent`), and fix cross-tenant `UPDATE ai_recommendations` in `approveAction`.
- `Main_backend/src/controllers/ai.controller.ts`, `healingAction.controller.ts`, `report.controller.ts` — Propagate verified `TENANT` context, close `resendNotification` missing org-membership check, and fail closed on null `prediction.organization_id`.
- `Main_backend/src/services/agent.service.ts`, `hitlNotification.service.ts`, `statistics.service.ts`, `logStream.service.ts`, `telemetryAggregator.service.ts`, `telemetryPipeline.service.ts`, `recoveryVerification.service.ts`, `ruleEngineExecution.service.ts`, `agentTimeout.service.ts`, `auditRetention.service.ts` — Establish explicit tenant/system context in workers, fix `SC-A01`/`SC-A04` cross-tenant SQL queries, remove cross-tenant policy fallback & `audit_logs.organization_id IS NULL` exposure, and make SSE `LogStreamService` fail closed when `organization_id` is absent.
- `Main_backend/src/websocket/agentWebSocket.ts`, `telemetryWebSocket.ts` — Bind authenticated tenant context on all WS messages/pulses/disconnects and fix cross-tenant `UPDATE ai_recommendations` in `action_result`.
- `Main_backend/src/test/sprintCPhase1Rls.test.ts` *(new)* — Isolated PostgreSQL RLS & cross-tenant security verification suite.

---

## 3. Tables Protected by RLS (37 Tables — `ENABLE` + `FORCE ROW LEVEL SECURITY`)

| Category | Count | Tables |
|---|---:|---|
| **Direct `organization_id` (`TENANT_SCOPED`)** | 13 | `organizations` (root), `environments`, `healing_policies`, `incidents`, `agent_metrics`, `node_metrics`, `organization_alert_settings`, `organization_invitations`, `organization_members`, `organization_profiles`, `notifications` *(hybrid user+org)*, `alert_rules`, `alert_events` |
| **Indirect Parent-FK (`TENANT_SCOPED`)** | 23 | `clusters`, `agents`, `agent_heartbeats`, `agent_tokens`, `namespaces`, `nodes`, `services`, `workloads`, `deployments`, `pods`, `logs`, `kubernetes_events`, `ai_predictions`, `prediction_inputs`, `rca_analyses`, `rca_evidences`, `ai_recommendations`, `healing_actions`, `approvals`, `execution_attempts`, `recovery_verifications`, `policy_actions`, `alert_event_history` |
| **Hybrid Audit (`AUDIT`)** | 1 | `audit_logs` *(tenant sees only `organization_id = app_current_org_id()`, never `IS NULL`; `PLATFORM_ADMIN`/`SYSTEM` manages platform & retention scope)* |

**Live Catalog Verification on `aiselfhealing_test`:**
`{ total_tables: 47, rls_enabled: 37, rls_forced: 37 }`, `policy_count: 86`.

---

## 4. Tables Intentionally Excluded from Tenant RLS (10 Tables)

| Classification | Tables | Rationale |
|---|---|---|
| **`GLOBAL` Catalog (4)** | `system_roles`, `organization_roles`, `healing_action_types`, `ai_models` | Shared platform reference catalogs read across organizations; writes to `system_roles`/`organization_roles` revoked from `selfheal_app`. |
| **`SYSTEM_MANAGED` (1)** | `system_broadcasts` | Platform-wide notices published by platform admins. |
| **`AUTHENTICATION` / Global User Identity (5)** | `users`, `user_system_roles`, `user_two_factor`, `email_verification_tokens`, `password_reset_tokens` | Global multi-org user identity & pre-tenant authentication records; protected by RBAC and `user_id` scoping rather than a single `organization_id`. |

---

## 5. Database Role Configuration

| Role | Flags | Ownership / Privileges |
|---|---|---|
| `selfheal_migrator` | `NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS LOGIN` | Owns all 47 `public` tables, views, and sequences. Used only by `migrate.ts` (`DB_MIGRATOR_*`). |
| `selfheal_app` | `NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS LOGIN` | Runtime API/worker role. DML only (`SELECT/INSERT/UPDATE/DELETE`; read-only on `system_roles`, `organization_roles`); cannot own tables, disable RLS, or `SET ROLE postgres`. |
| `selfheal_readonly` | `NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS LOGIN` | `SELECT`-only reporting role, still constrained by RLS policies. |
| `selfheal_sysdefiner` | `NOSUPERUSER NOCREATEDB NOCREATEROLE BYPASSRLS NOLOGIN` | Non-login internal definer owning strictly 5 read-only `SECURITY DEFINER` lookup functions (`SET search_path = pg_catalog, public`); cannot be logged into or assumed via `SET ROLE` by `selfheal_app`. |

---

## 6. Tenant Context Implementation & Connection Pool Safety
- Context derives exclusively from verified DB membership/token lookups (`authenticateToken` → `AUTH`; `requireOrgMember` / org-scoped `requireRoles` / `authenticateAgentToken` / WS upgrade → `TENANT`; verified system admin routes → `PLATFORM_ADMIN`; retention worker → `SYSTEM`).
- Every pooled `pool.query(...)` inside an active context wraps the statement in `BEGIN` → `SELECT set_config('app.access_scope', $1, true), set_config('app.current_org_id', $2, true), set_config('app.current_user_id', $3, true)` → query → `COMMIT`/`ROLLBACK` → `client.release()`.
- Manual `pool.connect()` transactions inject `set_config(..., true)` automatically upon `BEGIN` and strip wrappers on `release()`.
- Because `is_local = true` (`SET LOCAL`) binds GUCs strictly to the transaction lifetime, PostgreSQL clears all tenant context upon `COMMIT`/`ROLLBACK` before the connection returns to the pool.
- Missing context (`app_access_scope() = 'NONE'`, `app_current_org_id() IS NULL`) evaluates every tenant RLS policy to `FALSE` (fail closed: 0 rows read, `42501` error on write). No global default tenant exists.

---

## 7. Verification Commands, Exit Codes & Negative Test Results

| Check | Command | Exit Code | Result |
|---|---|---:|---|
| TypeScript Build | `cd Main_backend; npm run build` | `0` | 0 compilation errors |
| Apply Migrations 29 & 30 on `aiselfhealing_test` | Node `pg` runner applying `29_create_alert_tables.sql` & `30_sprint_c_phase1_rls_and_roles.sql` | `0` | `total_tables: 47, rls_enabled: 37, rls_forced: 37, policies: 86` |
| Rollback & Re-apply Drill on `aiselfhealing_test` | Node `pg` runner executing `rollback/30_...down.sql` then re-applying `30_...sql` | `0` | Rollback: `rls_enabled: 0, policies: 0, orgs: 3` (zero data loss); Re-apply: `rls_enabled: 37, rls_forced: 37, policies: 86` |
| Phase 1 RLS Suite (as `DB_USER=postgres` + `selfheal_app` pool) | `$env:DB_NAME="aiselfhealing_test"; $env:REDIS_ENABLED="false"; npx tsx --test src/test/sprintCPhase1Rls.test.ts` | `0` | **5/5 PASS** (all 12 scenarios verified) |
| Phase 1 RLS Suite (runtime `Main_backend` `pool` connected directly as **`DB_USER=selfheal_app`**) | Ephemeral `selfheal_app` test runner executing `sprintCPhase1Rls.test.ts` | `0` | **5/5 PASS** — full application services & workers passed under `NOSUPERUSER NOBYPASSRLS` |
| Regression Suite (`incidentModel`, `reportModel`, `sprintASecurity`, `sprintBSecuritySB01/03/04/05Ticket`, `phase2Cp9HitlSecurity`) | `$env:DB_NAME="aiselfhealing_test"; $env:REDIS_ENABLED="false"; npx tsx --test ...` | `1` | **67/70 PASS, 3 pre-existing legacy policy mismatches (0 Phase 1 regressions)** |

### Classification of 3 Pre-Existing Legacy Failures (No RLS Policy Weakened)
1. `sprintASecurity.test.ts` (`WS-10`): Expects `SUPER_ADMIN` global WebSocket without org membership — superseded by immutable Sprint B Decision 2.2.
2. `sprintBSecuritySB01.test.ts` (`SB01-01`): Calls `HealingActionModel.updateStatus(..., 'COMPLETED')` without `execution_attempts`/`recovery_verifications` — intentionally blocked (`409`) by Phase 2 CP-9 HITL guard.
3. `sprintBSecuritySB03.test.ts` (`SB03-01b`): Expects `createAction` auto-approval without an active verified DB policy — intentionally tightened to `'PENDING'` by Phase 2 CP-9 HITL guard.

### Cross-Tenant Negative Test Matrix (`sprintCPhase1Rls.test.ts`)
- Scenarios 1–3: Org A reads Org A only; Org B reads Org B only; Org A reads 0 Org B rows (`incidents`, `healing_actions`, `audit_logs`) — **PASS**.
- Scenario 4: Direct (`incidents` with `organization_id = ORG_B`) and indirect (`clusters` under `ENV_B`) cross-tenant `INSERT` rejected with PG RLS error — **PASS**.
- Scenario 5: Cross-tenant `UPDATE` affects 0 rows; ownership tampering (`UPDATE incidents SET organization_id = ORG_B`) rejected with PG RLS error — **PASS**.
- Scenario 6: Cross-tenant `DELETE` affects 0 rows; Org B record intact — **PASS**.
- Scenario 7: Missing tenant context fails closed (0 rows on `SELECT`, RLS error on `INSERT`) — **PASS**.
- Scenario 8: Pooled connection reuse (`max: 1` pool under `selfheal_app`) after Org A `COMMIT` returns 0 rows when un-scoped — **PASS**.
- Scenario 9: 12 interleaved concurrent Org A / Org B transactions remain strictly isolated — **PASS**.
- Scenarios 10–11: `selfheal_app` cannot `ALTER TABLE ... DISABLE ROW LEVEL SECURITY` or `SET ROLE postgres`; `selfheal_migrator` owns all protected tables with `FORCE ROW LEVEL SECURITY` — **PASS**.
- Scenario 12: `HealingActionModel.approveAction`, `TelemetryPipelineService` (`autoResolveIfRecovered` & `evaluatePolicyAndTriggerAutonomousHealing`), `TelemetryAggregatorService.getLiveSummaryData`, `StatisticsService`, `LogStreamService`, `RuleEngineExecutionService`, `AgentTimeoutService`, `AgentModel.findByTokenHash`, and hybrid `notifications` all pass strictly isolated — **PASS**.

---

## 8. Migration Safety, Rollback & Remaining Risks
- **Pre-migration Check:** Zero unintended NULL tenant rows in `aiselfhealing_test` and `captone_db`; `notifications` NULL-org rows and `audit_logs` NULL-org platform rows explicitly handled by approved policies.
- **Rollback Strategy:** Tested `migrations/rollback/30_sprint_c_phase1_rls_and_roles.down.sql` cleanly disables RLS and drops Sprint C policies/helpers with zero data loss; application-level SQL filters remain active.
- **Remaining Risks:**
  1. Production / staging environments (`docker-compose.prod.yml`, `k8s/`, `captone-*`) have **not** yet had roles/passwords provisioned or `DB_USER` switched from `postgres` to `selfheal_app` (intentionally deferred per Change Control until PO deployment window and Phase 3/4 TLS + secret rollout).
  2. `migrations/00_init_full_database.sql` and `migrate.ts` still need `schema_migrations` tracking & seed extraction (scheduled in Sprint C backlog `SC-102`).
  3. High-volume indirect tables (`logs`, `kubernetes_events`, `workloads`) currently evaluate RLS via indexed parent `EXISTS` joins; future denormalization of `organization_id NOT NULL` is recommended if table volume grows into millions of rows.
