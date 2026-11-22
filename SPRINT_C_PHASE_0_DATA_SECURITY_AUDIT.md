# SPRINT C — PHASE 0: DATA SECURITY BASELINE AUDIT

**Project:** AI-Driven Proactive Self-Healing Infrastructure for SMEs  
**Branch Audited:** `feature/security` (preserving uncommitted Sprint B / Phase 2 CP-9 changes)  
**Audit Date:** 2026-11-18  
**Audit Mode:** Strictly Read-Only (No source, migration, role, database, secret, or container modifications performed)  
**Target Document:** `SPRINT_C_PHASE_0_DATA_SECURITY_AUDIT.md`

---

## 1. Executive Summary

This audit establishes the read-only data security baseline prior to Sprint C implementation across four approved pillars:
1. **PostgreSQL Tenant Isolation & Row-Level Security (RLS)**
2. **Refresh Token & Session Lifecycle Security**
3. **PostgreSQL & Adjacent Transport Security (TLS)**
4. **Sensitive Data, Secrets, Logging, Migrations & Backup Protection**

### Key Baseline Reality
- **Database Isolation (`captone_db` on PostgreSQL 16.16 & `aiselfhealing_test` on PostgreSQL 18.6):** Identical **44 tables** exist in schema `public`, all owned by superuser `postgres`. **Zero tables** have Row-Level Security enabled (`rowsecurity = false`, `relforcerowsecurity = false` across all 44 tables; `0` RLS policies). `Main_backend` connects exclusively as superuser `postgres` (`rolsuper = t`, `rolbypassrls = t`), meaning PostgreSQL provides zero defense-in-depth if application queries omit tenant predicates.
- **Application Tenant Query Leaks (Confirmed Bugs):** Despite Sprint A/B hardening, read-only inspection of all 248 files in `Main_backend/src/` identified **active cross-tenant read, write, and WebSocket broadcast vulnerabilities**, including cross-tenant `UPDATE ai_recommendations` (`agentWebSocket.ts:620-639`, `healingAction.model.ts:1663-1682`), cross-tenant incident auto-resolution and policy fallback (`telemetryPipeline.service.ts:368-509, 605-697`), cross-tenant WebSocket `live_pulse` / `initial_state` pushes (`telemetryWebSocket.ts:238, 275, 315` -> `telemetryAggregator.service.ts:782-797`), cross-tenant `target_name` locks/verifications (`healingAction.service.ts:259-271`, `recoveryVerification.service.ts:247-278`, `ai.service.ts:560-741`), and NULL-scope fail-open bypasses (`ai.controller.ts:363-407`, `healingAction.controller.ts:438-446`, `kubernetesEvent.model.ts:431-434`).
- **Schema & Migration Drift:** Three tables actively queried by production code and tests (`alert_rules`, `alert_events`, `alert_event_history`) are **missing from `Main_backend/migrations/*.sql` and live databases** (migrations jump from `14_` to `20_`). `migrate.ts` re-runs every `.sql` file on each invocation with no `schema_migrations` table, resetting default admin passwords to `'AdminPassword123@'` and re-seeding demo `agent_tokens`.
- **Authentication Session Model:** **No refresh token architecture or server-side session tracking exists.** Users receive a single **7-day HS256 JWT** stored in browser `localStorage`. Frontend `logout()` (`AuthContext.jsx:265-293`) never calls `POST /api/v1/auth/logout`, password change does not invalidate active JWTs, account disable/2FA gaps persist, and Redis blacklist fails open in non-production.
- **Transport Security (TLS):** PostgreSQL runs with `ssl = off`, zero TLS certificates, and `trust` authentication on local/loopback sockets in `pg_hba.conf`. Neither `Main_backend/src/config/database.ts`, Docker Compose, nor `k8s/postgres.yaml` configures PostgreSQL TLS. External Nginx (`nginx/nginx.conf`) only listens on HTTP port 80 despite Compose exposing port 443.
- **Data & Backup Protection:** Zero `pg_dump`/`pg_restore` or backup scripts exist, while `.github/workflows/cd.yml:276` executes `node dist/scripts/migrate.js || true` without backup or rollback. Several controllers leak raw HTTP 500 `error.message` strings; `approvals.approval_token` and `organization_alert_settings` secrets (`slack_webhook_url`, `pagerduty_key`) are stored and/or returned in plaintext; and `docker-compose.yml` fallback secrets bypass production startup checks in `env.ts`.

### Audit Verdict
> **VERDICT: `READY WITH CONDITIONS`**  
> Sprint C Phase 1 may begin **only after** Product Owner sign-off on Section 14 open decisions and strict adherence to the pre-migration backup (`pg_dump`), `schema_migrations` baseline reconciliation, and staged rollout gates defined in Sections 12 and 15.

---

## 2. Current Architecture

### 2.1 System Components & Runtime Topology
| Component | Technology | Role | Persistence / Transport |
|---|---|---|---|
| **Frontend** | React + Nginx (`Frontend/nginx.conf`) | SME & Platform Admin SPA | HTTP/WS via Nginx; stores `7d` JWT in `localStorage` |
| **Reverse Proxy** | Nginx (`nginx/nginx.conf`) | Edge proxy (`/api`, `/socket.io` / WS, SPA) | Listens HTTP `:80` only (`443 ssl` unconfigured); logs `$request` |
| **Main Backend** | Node.js / Express / TypeScript (`Main_backend`) | REST API, RBAC, HITL, MAPE-K workers, WS servers | `pg.Pool` -> PostgreSQL `:5432` (no TLS); Redis (no TLS); HTTP -> `AI_backend`; SMTP |
| **AI Backend** | Python / FastAPI (`AI_backend`) | ML Risk Prediction (GRU/PyTorch) & LLM RCA | Stateless (no direct PG/Redis connection); HTTP HMAC-SHA256 from `Main_backend` |
| **K8s Agent & Installer** | Python (`Agent`) | Cluster telemetry collector & remediation executor | WebSocket (`ws://`/`wss://`) + Agent Token SHA-256 auth to `Main_backend`; OTel HTTP |
| **PostgreSQL** | `postgres:16-alpine` (Compose/K8s; live test also PG 18.6) | Primary relational telemetry, auth, HITL & audit store | Plaintext TCP `:5432`, single `postgres` superuser |
| **Redis** | Redis (`docker-compose*.yml`) | Token blacklist, WS tickets, TOTP replay guard, rate cache, email queue | Plaintext TCP `:6379`; no `--requirepass` in `docker-compose.yml` |
| **Observability** | Prometheus + OpenTelemetry Collector | Metrics & OTLP trace/metric export | OTLP HTTP (`http://...:4318`); Prometheus scrape `/metrics` |

### 2.2 Trust Boundaries & Current Gaps
1. **Browser <-> Edge (`Nginx`):** Unencrypted HTTP/WS (`nginx/nginx.conf:53-134`); long-lived JWT in `localStorage` exposed to XSS; query-string tokens (`?token=...`) captured in Nginx access logs (`$request`) and Morgan `combined` logs.
2. **Main Backend <-> PostgreSQL:** No transport encryption (`ssl = off`); no least-privilege separation (runtime uses superuser `postgres`); no DB-enforced RLS boundary between organizations or between platform admin and tenant data.
3. **Background Workers & WebSockets <-> Tenant Scope:** Workers (`TelemetryPipelineService`, `TelemetryAggregatorService`, `RuleEngineExecutionService`, `AgentTimeoutService`, `AuditRetentionService`) and `agentWebSocket` run outside HTTP request middleware and directly execute SQL via global `pool`, making missing `organization_id` predicates immediately exploitable across tenants.
4. **CI/CD Deployment Boundary (`cd.yml`):** Automated deploy runs `migrate.js || true` without pre-flight database snapshot or rollback trigger.

---

## 3. Database Inventory

Verified directly against live PostgreSQL catalog (`captone_db` PG 16.16 and `aiselfhealing_test` PG 18.6) and `Main_backend/src/` read/write code audit.

- **Global RLS Status Across All 44 Live Tables:** `relrowsecurity = false`, `relforcerowsecurity = false`, `0` RLS policies.

### 3.1 Live PostgreSQL Tables (44 Tables in `public`)

| # | Table | PK | Tenant / Org Col | Foreign Keys (`ON DELETE`) | Tenant / Parent Nullability | Ownership Path | Key Indexes & Unique Constraints | App Readers (`Main_backend/src`) | App Writers (`Main_backend/src`) |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `organizations` | `id` | `id` (self) | `created_by -> users(id)` (`SET NULL`) | Root tenant (`NOT NULL`) | Direct (Root) | PK, UQ `slug`, `idx_organizations_slug`, `idx_organizations_status` | `adminDashboard.model`, `agent.model`, `alertEvent.model`, `cluster.model`, `healingAction.model`, `incident.model`, `organization.model`, `organizationInvitation.model`, `organizationMember.model`, `user.model`, `adminAnalytics.service`, `adminBroadcast.service`, `alertRule.service`, `audit.service`, `hitlNotification.service`, `statistics.service`, `systemRole.service`, `user.service` | `organization.model` |
| 2 | `organization_profiles` | `id` | `organization_id` | `organization_id -> organizations(id)` (`CASCADE`) | `organization_id` `NOT NULL` | Direct | PK, UQ `organization_id` | `organization.model`, `organizationProfile.model` | `organizationProfile.model` |
| 3 | `organization_members` | `id` | `organization_id` | `organization_id -> organizations(id)` (`CASCADE`), `user_id -> users(id)` (`CASCADE`), `role_id -> organization_roles(id)` (`RESTRICT`), `invited_by -> users(id)` (`SET NULL`) | `organization_id`, `user_id`, `role_id` `NOT NULL` | Direct | PK, UQ `(organization_id, user_id)`, `idx_org_members_org`, `idx_org_members_user` | `ai.controller`, `telemetry.controller`, `rbac.middleware`, `orgAuth.middleware`, `organization.model`, `organizationAlertSettings.model`, `organizationMember.model`, `user.model`, `adminAnalytics.service`, `adminBroadcast.service`, `agent.service`, `alertLifecycle.service`, `alertRule.service`, `audit.service`, `cluster.service`, `healingAction.service`, `hitlNotification.service`, `k8sStatus.service`, `statistics.service`, `user.service`, `telemetryWebSocket` | `organizationMember.model`, `organizationInvitation.service`, `organizationMember.service`, `systemRole.service` |
| 4 | `organization_invitations` | `id` | `organization_id` | `organization_id -> organizations(id)` (`CASCADE`), `role_id -> organization_roles(id)` (`RESTRICT`), `invited_by -> users(id)` (`SET NULL`), `accepted_by -> users(id)` (`SET NULL`) | `organization_id`, `role_id` `NOT NULL` | Direct | PK, UQ `token_hash`, `idx_org_invitations_email`, `idx_org_invitations_org`, `idx_org_invitations_status`, `idx_org_invitations_token_hash` | `organization.model`, `organizationInvitation.model` | `organizationInvitation.model` |
| 5 | `organization_alert_settings` | `organization_id` | `organization_id` | `organization_id -> organizations(id)` (`CASCADE`), `updated_by -> users(id)` (`SET NULL`) | `organization_id` `NOT NULL` | Direct | PK (`organization_id`) | `organizationAlertSettings.model` | `organizationAlertSettings.model` |
| 6 | `environments` | `id` | `organization_id` | `organization_id -> organizations(id)` (`CASCADE`), `created_by -> users(id)` (`SET NULL`) | `organization_id` `NOT NULL` | Direct | PK, `idx_environments_org` | `ai.controller`, `alertEvent.controller`, `node.controller`, `pod.controller`, `telemetry.controller`, `agent.model`, `aiPrediction.model`, `alertRule.model`, `cluster.model`, `environment.model`, `healingAction.model`, `incident.model`, `kubernetesEvent.model`, `log.model`, `metric.model`, `organization.model`, `recommendation.model`, `report.model`, `adminAnalytics.service`, `agent.service`, `cluster.service`, `kubernetesRuleEvaluator`, `healingAction.service`, `hitlNotification.service`, `k8sStatus.service`, `statistics.service`, `telemetryAggregator.service`, `telemetryPipeline.service`, `user.service`, `agentWebSocket`, `telemetryWebSocket` | `alertEvent.controller` (`demoIngest`), `environment.model` |
| 7 | `healing_policies` | `id` | `organization_id` | `organization_id -> organizations(id)` (`CASCADE`), `environment_id -> environments(id)` (`CASCADE`), `created_by -> users(id)` (`SET NULL`) | `organization_id` `NOT NULL`; `environment_id` **NULLABLE** | Direct | PK (`healing_policies_pkey`) | `healingAction.model`, `audit.service`, `healingAction.service`, `hitlNotification.service`, `telemetryPipeline.service` | `healingAction.model` |
| 8 | `incidents` | `id` | `organization_id` | **NONE** (no FK on `organization_id`, `environment_id`, `cluster_id`) | `organization_id` **NULLABLE**; `environment_id` `NOT NULL`; `cluster_id` (`varchar`) **NULLABLE** | Direct (`organization_id` nullable) + `environment_id` | PK, `idx_incidents_cluster_detected`, `idx_incidents_created`, `idx_incidents_dedup_lookup`, `idx_incidents_detected_at`, `idx_incidents_org_cluster_created`, `idx_incidents_status` | `adminDashboard.model`, `healingAction.model`, `incident.model`, `recommendation.model`, `report.model`, `adminBroadcast.service`, `ai.service`, `audit.service`, `healingAction.service`, `hitlNotification.service`, `recoveryVerification.service`, `statistics.service`, `user.service`, `agentWebSocket` | `incident.model`, `agent.service`, `ai.service`, `healingAction.service`, `recoveryVerification.service`, `telemetryPipeline.service`, `agentWebSocket` |
| 9 | `agent_metrics` | `id` | `organization_id` | `agent_id -> agents(id)` (`CASCADE`), `cluster_id -> clusters(id)` (`CASCADE`), `environment_id -> environments(id)` (`SET NULL`), `organization_id -> organizations(id)` (`CASCADE`) | `agent_id` `NOT NULL`; `organization_id`, `environment_id`, `cluster_id` **ALL NULLABLE** | Direct (nullable) / Indirect | PK + 11 indexes (`idx_agent_metrics_org_time`, `idx_agent_metrics_org_service_time`, `idx_agent_metrics_dedup`, etc.) | `metric.model`, `apmRuleEvaluator`, `telemetryAggregator.service` | `alertEvent.controller` (`demoIngest`), `metric.model`, `telemetryBuffer.service` |
| 10 | `node_metrics` | `id` | `organization_id` | `organization_id -> organizations(id)` (`CASCADE`), `environment_id -> environments(id)` (`SET NULL`), `node_id -> nodes(id)` (`SET NULL`) (`cluster_id` varchar no FK) | `organization_id`, `environment_id`, `cluster_id`, `node_id` **ALL NULLABLE** | Direct (nullable) / Indirect | PK + 7 indexes (`idx_node_metrics_org_time`, `idx_node_metrics_dedup`, etc.) | `metric.model`, `agent.service`, `resourceMetricEvaluator`, `statistics.service`, `telemetryAggregator.service` | `alertEvent.controller` (`demoIngest`), `metric.model` (`ALTER TABLE`+backfill), `agent.service` |
| 11 | `notifications` | `id` | `organization_id` | `organization_id -> organizations(id)` (`CASCADE`), `user_id -> users(id)` (`CASCADE`) | `user_id` `NOT NULL`; `organization_id` **NULLABLE** | Direct (nullable) + User | PK, `idx_notifications_incident`, `idx_notifications_org`, `idx_notifications_user_created`, `idx_notifications_user_read` | `user.service` | `adminBroadcast.service`, `criticalIncidentNotification.service`, `user.service` |
| 12 | `audit_logs` | `id` | `organization_id` | `organization_id -> organizations(id)` (`SET NULL`), `user_id -> users(id)` (`SET NULL`) | `organization_id` **NULLABLE** (holds platform + tenant events) | Direct (nullable) + Platform | PK + 7 indexes (`idx_audit_logs_org_time`, `idx_audit_logs_org_created`, `idx_audit_logs_user`, etc.) | `cluster.model`, `adminBroadcast.service`, `audit.service`, `auditRetention.service`, `statistics.service`, `user.service` | `audit.service`, `auditRetention.service` |
| 13 | `clusters` | `id` | *None* (`environment_id`) | `environment_id -> environments(id)` (`CASCADE`) | `environment_id` `NOT NULL` | Indirect (1 hop -> `environments`) | PK, `idx_clusters_env` | `ai.controller`, `alertEvent.controller`, `node.controller`, `pod.controller`, `telemetry.controller`, `adminDashboard.model`, `agent.model`, `aiPrediction.model`, `alertEvent.model`, `alertRule.model`, `cluster.model`, `environment.model`, `healingAction.model`, `incident.model`, `kubernetesEvent.model`, `log.model`, `metric.model`, `organization.model`, `recommendation.model`, `report.model`, `workload.model`, `adminAnalytics.service`, `agent.service`, `ai.service`, `audit.service`, `cluster.service`, `kubernetesRuleEvaluator`, `hitlNotification.service`, `k8sStatus.service`, `statistics.service`, `telemetryAggregator.service`, `user.service`, `telemetryWebSocket` | `alertEvent.controller` (`demoIngest`), `cluster.model`, `agent.service` |
| 14 | `agents` | `id` | *None* (`environment_id?`, `cluster_id?`) | **NONE** (`cluster_id` is `varchar` nullable; `environment_id` is `uuid` nullable) | Both `cluster_id` and `environment_id` **NULLABLE, NO FK** | Indirect (nullable/weak) | PK, UQ `agent_uid`, `idx_agents_status`, `idx_agents_uid` | `alertEvent.controller`, `adminDashboard.model`, `agent.model`, `cluster.model`, `environment.model`, `metric.model`, `organization.model`, `report.model`, `adminAnalytics.service`, `agent.service`, `audit.service`, `k8sStatus.service`, `statistics.service` | `alertEvent.controller` (`demoIngest`), `agent.model`, `cluster.model`, `agent.service` |
| 15 | `agent_tokens` | `id` | *None* (`agent_id`) | `agent_id -> agents(id)` (`CASCADE`), `created_by -> users(id)` (`SET NULL`) | `agent_id` `NOT NULL` | Indirect -> `agents` | PK, `idx_agent_tokens_agent`, `idx_agent_tokens_hash` | `agent.model`, `cluster.model` | `agentAuth.middleware`, `agent.model`, `cluster.model`, `agent.service` |
| 16 | `agent_heartbeats` | `id` | *None* (`agent_id`) | `agent_id -> agents(id)` (`CASCADE`) | `agent_id` `NOT NULL` | Indirect -> `agents` | PK, `idx_agent_heartbeats_agent` | `agent.model`, `cluster.model` | `agent.model`, `cluster.model` |
| 17 | `namespaces` | `id` | *None* (`cluster_id`) | `cluster_id -> clusters(id)` (`CASCADE`) | `cluster_id` `NOT NULL` | Indirect (2 hops -> `clusters -> environments`) | PK, `idx_namespaces_cluster` | `alertEvent.controller`, `pod.controller`, `cluster.model`, `incident.model`, `kubernetesEvent.model`, `log.model`, `workload.model`, `agent.service`, `ai.service`, `kubernetesRuleEvaluator`, `k8sStatus.service`, `telemetryAggregator.service` | `alertEvent.controller` (`demoIngest`), `cluster.model`, `agent.service` |
| 18 | `nodes` | `id` | *None* (`cluster_id`) | `cluster_id -> clusters(id)` (`CASCADE`) | `cluster_id` `NOT NULL` | Indirect (2 hops) | PK, `idx_nodes_cluster` | `node.controller`, `adminDashboard.model`, `cluster.model`, `incident.model`, `metric.model`, `adminAnalytics.service`, `agent.service`, `kubernetesRuleEvaluator`, `k8sStatus.service`, `telemetryAggregator.service` | `agent.service`, `k8sStatus.service` (`ALTER TABLE`) |
| 19 | `services` | `id` | *None* (`cluster_id`, `namespace_id`) | `cluster_id -> clusters(id)` (`CASCADE`), `namespace_id -> namespaces(id)` (`CASCADE`) | Both `NOT NULL` | Indirect (2 hops) | PK (`services_pkey`) | `log.model`, `report.model`, `agent.service`, `telemetryAggregator.service`, `telemetryWebSocket` | `agent.service` |
| 20 | `workloads` | `id` | *None* (`cluster_id?`, `namespace_id?`) | `namespace_id -> namespaces(id)` (`SET NULL`) (`cluster_id` `varchar` no FK) | Both `cluster_id` and `namespace_id` **NULLABLE** (orphan risk) | Indirect (weak/nullable) | PK, `idx_workloads_name` | `ai.controller`, `alertEvent.controller`, `aiPrediction.model`, `incident.model`, `log.model`, `organization.model`, `recommendation.model`, `report.model`, `workload.model`, `agent.service`, `ai.service`, `audit.service`, `kubernetesRuleEvaluator`, `k8sStatus.service`, `telemetryAggregator.service` | `alertEvent.controller` (`demoIngest`), `workload.model`, `agent.service`, `k8sStatus.service` (`ALTER TABLE`) |
| 21 | `deployments` | `id` | *None* (`workload_id`) | `workload_id -> workloads(id)` (`CASCADE`) | `workload_id` `NOT NULL` | Indirect (via `workloads`) | PK only (note: migration `28` adds unique index in runtime migrations) | `kubernetesRuleEvaluator`, `telemetryAggregator.service` | `agent.service` |
| 22 | `pods` | `id` | *None* (`cluster_id`, `namespace_id`, `workload_id?`, `node_id?`) | `cluster_id -> clusters(id)` (`CASCADE`), `namespace_id -> namespaces(id)` (`CASCADE`), `node_id -> nodes(id)` (`SET NULL`), `workload_id -> workloads(id)` (`SET NULL`) | `cluster_id`, `namespace_id` `NOT NULL` | Indirect (2 hops) | PK, `idx_pods_namespace`, `idx_pods_workload` | `alertEvent.controller`, `pod.controller`, `adminDashboard.model`, `cluster.model`, `incident.model`, `log.model`, `organization.model`, `report.model`, `workload.model`, `adminAnalytics.service`, `agent.service`, `ai.service`, `audit.service`, `kubernetesRuleEvaluator`, `k8sStatus.service`, `telemetryAggregator.service` | `alertEvent.controller` (`demoIngest`), `kubernetesEvent.model`, `agent.service`, `k8sStatus.service` (`ALTER TABLE`) |
| 23 | `logs` | `id` | *None* (`cluster_id?`, `namespace_id?`) | `namespace_id -> namespaces(id)` (`SET NULL`) (`cluster_id` `varchar` no FK) | Both `cluster_id` & `namespace_id` **NULLABLE** (orphan risk) | Indirect (weak/nullable) | PK, `idx_logs_level`, `idx_logs_service_occurred` | `log.model` | `log.model` |
| 24 | `kubernetes_events` | `id` | *None* (`cluster_id?`, `namespace_id?`) | `namespace_id -> namespaces(id)` (`SET NULL`) (`cluster_id` `varchar` no FK) | Both `cluster_id` & `namespace_id` **NULLABLE** (orphan risk) | Indirect (weak/nullable) | PK + 7 indexes (`idx_k8s_events_cluster_last_seen`, `idx_k8s_events_cluster_dedup`, etc.) | `kubernetesEvent.model`, `kubernetesRuleEvaluator` | `alertEvent.controller` (`demoIngest`), `kubernetesEvent.model` |
| 25 | `ai_predictions` | `id` | *None* (`environment_id`, `cluster_id?`, `workload_id?`) | `model_id -> ai_models(id)` (`RESTRICT`), `workload_id -> workloads(id)` (`SET NULL`) (**NO FK on `environment_id` or `cluster_id`**) | `environment_id` `NOT NULL` (no FK); `cluster_id`, `workload_id` nullable | Indirect (via `environments`) | PK + 6 indexes (`idx_ai_predictions_env_type_predicted`, `idx_ai_predictions_cluster_predicted`, etc.) | `aiModelRegistry.model`, `aiPrediction.model`, `incident.model`, `ai.service` | `aiPrediction.model`, `agent.service` |
| 26 | `prediction_inputs` | `id` | *None* (`prediction_id`) | `prediction_id -> ai_predictions(id)` (`CASCADE`) | `prediction_id` `NOT NULL` | Indirect (via `ai_predictions -> environments`) | PK, `idx_pred_inputs_pred_collected_metric`, `idx_prediction_inputs_pred` | `aiPrediction.model` | `aiPrediction.model` |
| 27 | `rca_analyses` | `id` | *None* (`incident_id`) | `incident_id -> incidents(id)` (`CASCADE`) | `incident_id` `NOT NULL` | Indirect (via `incidents`) | PK (`rca_analyses_pkey`) | `ai.controller`, `healingAction.model`, `incident.model`, `rca.model`, `recommendation.model`, `ai.service`, `hitlNotification.service`, `telemetryBuffer.service` | `rca.model`, `ai.service` |
| 28 | `rca_evidences` | `id` | *None* (`rca_analysis_id`) | `rca_analysis_id -> rca_analyses(id)` (`CASCADE`) | `rca_analysis_id` `NOT NULL` | Indirect (via `rca_analyses -> incidents`) | PK, `idx_rca_evidences_analysis` | `rca.model` | `rca.model`, `telemetryBuffer.service` |
| 29 | `ai_recommendations` | `id` | *None* (`incident_id`, `rca_analysis_id`) | `incident_id -> incidents(id)` (`CASCADE`), `rca_analysis_id -> rca_analyses(id)` (`CASCADE`), `action_type_id -> healing_action_types(id)` (`NO ACTION`) | `incident_id`, `rca_analysis_id` `NOT NULL` | Indirect (via `incidents`) | PK, `idx_ai_recs_incident_priority`, `idx_ai_recs_rca_prediction`, `idx_ai_recs_status_rec_created` | `healingAction.model`, `incident.model`, `recommendation.model`, `ai.service`, `hitlNotification.service` | `healingAction.model`, `recommendation.model`, `ai.service`, `recoveryVerification.service`, `telemetryPipeline.service`, `agentWebSocket` |
| 30 | `healing_actions` | `id` | *None* (`environment_id`, `incident_id`) | `incident_id -> incidents(id)` (`CASCADE`), `environment_id -> environments(id)` (`CASCADE`), `action_type_id -> healing_action_types(id)` (`RESTRICT`), `policy_id -> healing_policies(id)` (`SET NULL`), `recommendation_id -> ai_recommendations(id)` (`SET NULL`), `requested_by`, `executed_by -> users(id)` (`SET NULL`) | `incident_id`, `environment_id`, `action_type_id` `NOT NULL` | Indirect (via `environments` & `incidents`) | PK, `idx_healing_actions_incident_created`, `idx_healing_actions_status`, `idx_healing_actions_status_created` | `ai.controller`, `adminDashboard.model`, `healingAction.model`, `incident.model`, `recommendation.model`, `report.model`, `adminAnalytics.service`, `ai.service`, `audit.service`, `healingAction.service`, `hitlNotification.service`, `recoveryVerification.service`, `telemetryAggregator.service`, `telemetryPipeline.service`, `agentWebSocket` | `healingAction.model`, `incident.model`, `recommendation.model`, `ai.service`, `healingAction.service`, `hitlNotification.service`, `telemetryPipeline.service`, `agentWebSocket` |
| 31 | `approvals` | `id` | *None* (`healing_action_id`) | `healing_action_id -> healing_actions(id)` (`CASCADE`), `requested_by`, `approved_by -> users(id)` (`SET NULL`) | `healing_action_id` `NOT NULL` | Indirect (via `healing_actions -> environments`) | PK, `idx_approvals_status` | `healingAction.model`, `incident.model`, `recommendation.model`, `report.model`, `hitlNotification.service` | `healingAction.model`, `recommendation.model`, `hitlNotification.service`, `telemetryPipeline.service` |
| 32 | `execution_attempts` | `id` | *None* (`healing_action_id`, `agent_id?`) | `healing_action_id -> healing_actions(id)` (`CASCADE`), `agent_id -> agents(id)` (`SET NULL`) | `healing_action_id` `NOT NULL` | Indirect (via `healing_actions`) | PK (`execution_attempts_pkey`) | `healingAction.model`, `report.model`, `agentWebSocket` | `healingAction.model`, `healingAction.service`, `agentWebSocket` |
| 33 | `recovery_verifications` | `id` | *None* (`healing_action_id`) | `healing_action_id -> healing_actions(id)` (`CASCADE`) | `healing_action_id` `NOT NULL` | Indirect (via `healing_actions`) | PK (`recovery_verifications_pkey`) | `healingAction.model`, `incident.model`, `report.model`, `ai.service`, `recoveryVerification.service`, `telemetryPipeline.service` | `healingAction.model`, `ai.service` |
| 34 | `policy_actions` | `id` | *None* (`policy_id`) | `policy_id -> healing_policies(id)` (`CASCADE`), `action_type_id -> healing_action_types(id)` (`RESTRICT`) | `policy_id`, `action_type_id` `NOT NULL` | Indirect (via `healing_policies`) | PK (`policy_actions_pkey`) | `healingAction.model`, `telemetryPipeline.service` | `healingAction.model` |
| 35 | `users` | `id` | *None* (global identity; multi-org via `organization_members`) | **NONE** | Global identity | Auth / Global | PK, UQ `email`, `idx_users_created_at`, `idx_users_deleted_at`, `idx_users_email`, `idx_users_phone`, `idx_users_status` | `adminDashboard.model`, `alertEvent.model`, `alertEventHistory.model`, `alertRule.model`, `healingAction.model`, `organization.model`, `organizationAlertSettings.model`, `organizationInvitation.model`, `organizationMember.model`, `recommendation.model`, `report.model`, `systemRole.model`, `user.model`, `adminAnalytics.service`, `adminBroadcast.service`, `alertLifecycle.service`, `audit.service`, `hitlNotification.service`, `statistics.service` | `auth.model`, `user.model` |
| 36 | `user_system_roles` | `(user_id, system_role_id)` | *None* | `user_id -> users(id)` (`CASCADE`), `system_role_id -> system_roles(id)` (`CASCADE`), `assigned_by -> users(id)` (`SET NULL`) | Both `NOT NULL` | Auth / Platform | Composite PK, `idx_user_system_roles_role`, `idx_user_system_roles_user` | `systemRole.model`, `user.model`, `audit.service`, `user.service` | `systemRole.model` |
| 37 | `user_two_factor` | `id` | *None* (`user_id`) | `user_id -> users(id)` (`CASCADE`) | `user_id` `NOT NULL` | Auth (User) | PK, UQ `user_id`, `idx_user_two_factor_user_id` | `twoFactor.model` | `twoFactor.model` |
| 38 | `email_verification_tokens` | `id` | *None* (`user_id`) | `user_id -> users(id)` (`CASCADE`) | `user_id` `NOT NULL` | Auth (User) | PK, `idx_email_verification_tokens_expires`, `idx_email_verification_tokens_hash`, `idx_email_verification_tokens_user` | `auth.model` | `auth.model` |
| 39 | `password_reset_tokens` | `id` | *None* (`user_id`) | `user_id -> users(id)` (`CASCADE`) | `user_id` `NOT NULL` | Auth (User; **unused in code**) | PK, `idx_password_reset_tokens_expires`, `idx_password_reset_tokens_user` | *(none)* | *(none)* |
| 40 | `system_roles` | `id` | *None* | **NONE** | Global lookup | Global Catalog | PK, UQ `name` | `systemRole.model`, `user.model`, `audit.service`, `user.service` | *(read-only reference)* |
| 41 | `organization_roles` | `id` | *None* | **NONE** | Global lookup | Global Catalog | PK, UQ `code` | `telemetry.controller`, `rbac.middleware`, `organization.model`, `organizationAlertSettings.model`, `organizationInvitation.model`, `organizationMember.model`, `organizationRole.model`, `user.model`, `adminBroadcast.service`, `audit.service`, `hitlNotification.service`, `user.service`, `telemetryWebSocket` | *(read-only reference)* |
| 42 | `healing_action_types` | `id` | *None* | **NONE** | Global lookup | Global Catalog | PK, UQ `code`, UQ `name` | `ai.controller`, `healingAction.model`, `incident.model`, `recommendation.model`, `report.model`, `ai.service`, `healingAction.service`, `hitlNotification.service`, `recoveryVerification.service`, `statistics.service`, `telemetryPipeline.service` | `healingAction.model` (`updateActionType`) |
| 43 | `ai_models` | `id` | *None* | **NONE** | Global (verify multi-tenant plan) | Global / Unclear | PK (`ai_models_pkey`) | `aiModelRegistry.model`, `aiPrediction.model` | `aiModelRegistry.model` |
| 44 | `system_broadcasts` | `id` | *None* | `created_by -> users(id)` (`SET NULL`) | Platform-wide notices | System-Managed | PK, UQ `broadcast_code`, `idx_system_broadcasts_created` | `adminBroadcast.service` | `adminBroadcast.service` |

### 3.2 Orphan Application-Referenced Tables Missing From Migrations & Live DB (3 Tables)
Migrations jump from `14_ai_indexes_and_stored_procedures.sql` to `20_create_user_two_factor.sql`. The following 3 tables do **not** exist in `Main_backend/migrations/*.sql`, `captone_db`, or `aiselfhealing_test`, yet are actively queried/written by `Main_backend/src/`:

| Table (Missing DDL) | App Readers | App Writers | Observed Schema Hint in Code |
|---|---|---|---|
| `alert_rules` | `alertEvent.controller`, `alertEvent.model`, `alertRule.model` | `alertRule.model`, `alertRule.test.ts:65` (`CREATE TABLE IF NOT EXISTS`) | `organization_id UUID NOT NULL REFERENCES organizations(id)`, `cluster_id UUID` |
| `alert_events` | `alertEvent.model`, `alertLifecycle.service` | `alertEvent.model`, `alertLifecycle.service` | `organization_id UUID NOT NULL`, alert rule FK |
| `alert_event_history` | `alertEventHistory.model` | `alertEventHistory.model` | Alert event transition audit rows |

---

## 4. Tenant Ownership Matrix

Every table categorized strictly by ownership semantics:

| Classification | Count | Tables | RLS / Access Policy Requirement |
|---|---|---|---|
| **`TENANT_SCOPED` (Direct `organization_id`)** | **10** (+`organizations`) | `organizations` (root), `environments`, `healing_policies`, `organization_profiles`, `organization_alert_settings`, `organization_members`, `organization_invitations`, `incidents`*, `agent_metrics`*, `node_metrics`*, `notifications`* | Strict `organization_id = current_org_id()`. Columns marked `*` are currently **nullable** and must be backfilled + constrained before strict RLS (`notifications` also needs `user_id` self-read check). |
| **`TENANT_SCOPED` (Indirect via Parent FK)** | **21** | `clusters`, `agents`*, `agent_heartbeats`, `namespaces`, `nodes`, `services`, `workloads`*, `deployments`, `pods`, `logs`*, `kubernetes_events`*, `ai_predictions`*, `prediction_inputs`, `rca_analyses`, `rca_evidences`, `ai_recommendations`, `healing_actions`, `approvals`, `execution_attempts`, `recovery_verifications`, `policy_actions` | Enforce via denormalized `organization_id` (recommended) or `EXISTS` join to parent. Tables marked `*` have **nullable parent FKs or missing FKs** that currently permit tenantless orphan rows. (`21` excluding `agent_tokens`, `22` including it.) |
| **`TENANT_SCOPED` + `AUTHENTICATION`** | **1** | `agent_tokens` | Linked to `agents(id)`. Agent token verification requires `SECURITY DEFINER` auth lookup function (returning `agent_id`, `organization_id`, `cluster_id`), while management UI/API must remain strictly tenant-scoped. |
| **`GLOBAL`** | **4** | `system_roles`, `organization_roles`, `healing_action_types`, `ai_models`* | `SELECT` allowed for authenticated runtime roles; write restricted to `selfheal_migrator` or platform admin context (`healing_action_types`, `ai_models`). *Note: `ai_models` flagged for PO confirmation.* |
| **`SYSTEM_MANAGED`** | **1** | `system_broadcasts` | Platform-wide notices managed by `SUPER_ADMIN` / `ADMIN`; reads restricted to platform context or targeted audience broadcast dispatch. |
| **`AUTHENTICATION`** | **5** | `users`, `user_system_roles`, `user_two_factor`, `email_verification_tokens`, `password_reset_tokens` (+ planned `user_sessions`, `refresh_tokens`) | Scoped by `user_id` (`app.current_user_id`), narrow `AUTH` lookup functions during login/refresh/verification, or `PLATFORM_ADMIN` management. Note `users` is global identity mapped to multiple tenants via `organization_members`. |
| **`AUDIT`** | **1** | `audit_logs` | **Mixed Tenant + Platform table** (`organization_id` nullable). Tenant users/admins may only `SELECT` where `organization_id = current_org_id()` (never `IS NULL` — fixes `StatisticsService:308` leak). Platform admins see `organization_id IS NULL` (or cross-tenant only if PO approves). `INSERT` allowed for active org/platform; `UPDATE`/`DELETE` denied except dedicated retention job (if immutable not required). |
| **`UNCLEAR — requires Product Owner clarification`** | **6 items** | 1. `ai_models` (global vs custom org models)<br>2. `audit_logs` (`organization_id IS NULL` visibility & retention deletion vs immutability)<br>3. Orphan rows where `incidents.organization_id`, `agents.environment_id/cluster_id`, `logs.cluster_id/namespace_id`, `kubernetes_events.cluster_id/namespace_id`, `workloads.cluster_id/namespace_id`, `agent_metrics.organization_id`, `node_metrics.organization_id` are `NULL`<br>4. `agent_snapshot` synthetic rows in `agent_metrics` (`telemetryBuffer.service.ts:466-487`)<br>5. `system_broadcasts` user read scope<br>6. Missing DDL for `alert_rules`, `alert_events`, `alert_event_history` | Cannot guess business intent; requires Product Owner decision (Section 14) prior to enforcing `NOT NULL` backfills and strict RLS `CHECK` constraints. |

---

## 5. Database Role and Privilege Analysis

### 5.1 Current State (Verified Live in `captone-postgres` & `aiselfhealing_test`)
- **Single Role Only:** Only `postgres` exists in `pg_roles` (`rolsuper = t`, `rolinherit = t`, `rolcreaterole = t`, `rolcreatedb = t`, `rolcanlogin = t`, `rolbypassrls = t`).
- **Runtime Identity:** `Main_backend` (`database.ts`, `create-admin.ts`, `create-user-letanquoc.ts`, `migrate.ts`), `docker-compose.yml`, `docker-compose.prod.yml` (default `DB_USER:-postgres`), and `k8s/secrets.example.yaml` all run as `postgres`.
- **Table Ownership:** All 44 tables, sequences, and views/procedures are owned by `postgres`.
- **Network Auth (`pg_hba.conf`):**
  - `local`, `127.0.0.1/32`, `::1/128`: **`trust`** (zero password verification from inside container or loopback).
  - `host all all all scram-sha-256` (permits unencrypted TCP; no `hostssl`).

### 5.2 Why Current Roles Break RLS Completely
In PostgreSQL, **both `SUPERUSER` and `BYPASSRLS` unconditionally bypass all Row-Level Security policies**. Furthermore, **table owners bypass RLS unless `ALTER TABLE ... FORCE ROW LEVEL SECURITY` is set**. Therefore, enabling RLS while the application connects as `postgres` (or as the table owner without `FORCE`) provides **zero security enforcement**.

### 5.3 Target Role Separation Architecture
| Role | Privileges | Purpose |
|---|---|---|
| `selfheal_migrator` | `NOSUPERUSER`, `NOCREATEDB`, `NOCREATEROLE`, `NOBYPASSRLS`, owns schema `public` tables/types/functions | Runs `migrate.ts` DDL and RLS policy migrations in CI/CD or manual maintenance only. Not used by runtime API/workers. |
| `selfheal_app` | `NOSUPERUSER`, `NOCREATEDB`, `NOCREATEROLE`, `NOBYPASSRLS`, `LOGIN`; `GRANT SELECT, INSERT, UPDATE, DELETE` on application tables (and `SELECT` only on `system_roles`, `organization_roles`; append-only or restricted `DELETE` on `audit_logs`); **NO `CREATE`/`ALTER`/`DROP` privileges** | Used by `Main_backend` HTTP API, WebSockets, and tenant-scoped workers. Subject to `ENABLE` + `FORCE ROW LEVEL SECURITY`. Eliminates runtime `ALTER TABLE` hacks (`metric.model.ts`, `k8sStatus.service.ts`). |
| `selfheal_auth_definer` *(pattern via `SECURITY DEFINER`)* | Narrow `SECURITY DEFINER` PostgreSQL functions owned by a controlled definer role with `SET search_path = pg_catalog, public` | Used strictly for pre-tenant auth lookups (login email lookup, refresh token hash verification, agent token hash verification -> resolves `organization_id`) so `selfheal_app` cannot dump arbitrary `users` or `agent_tokens`. |
| `selfheal_readonly` *(optional)* | `NOSUPERUSER`, `NOBYPASSRLS` (or `pg_read_all_data` in PG 14+ ONLY if PO approves full backup role `selfheal_backup`) | Separate dedicated backup role (`selfheal_backup` with `pg_read_all_data` for `pg_dump` only, restricted via `pg_hba.conf` to backup host/local socket) rather than runtime app credentials. |

---

## 6. RLS Feasibility and Design (Design A)

### 6.1 Confirmed Application Cross-Tenant Bugs Driving RLS Necessity
Workstream A audited all 248 files in `Main_backend/src/` and confirmed the following active defects:
1. **Cross-Tenant `UPDATE ai_recommendations` (`agentWebSocket.ts:620-639`, `healingAction.model.ts:1663-1682`):** `action_result` and `approveAction` update `ai_recommendations` across ALL organizations when `incidents.target_name` or `title` matches (no `organization_id` or `cluster_id` predicate).
2. **Cross-Tenant Incident Auto-Resolution & Policy Fallback (`telemetryPipeline.service.ts:368-509, 605-697`):** `autoResolveIfRecovered` receives `organizationId` but ignores it in SQL, resolving `OPEN` incidents across ALL tenants by `target_name`. `evaluatePolicyAndTriggerAutonomousHealing` queries all orgs' `healing_policies` (merely sorting `p.environment_id = $4` first), falling back to another org's `AUTO` policy and `SELECT id FROM environments LIMIT 1` (`line 656`).
3. **Cross-Tenant WebSocket Data Leak (`telemetryWebSocket.ts:238, 275, 315` -> `telemetryAggregator.service.ts:782-797`):** `getLiveSummaryData` ignores `organizationId` and calls 6 unfiltered global model methods (`AgentModel.listAll`, `MetricModel.getRecentRaw`, `LogModel.getRecent`, `KubernetesEventModel.getRecent`, `IncidentModel.getRecent`, `AiPredictionModel.getRecent`) plus `RecommendationModel.getRecent` without `organizationId`, pushing multi-tenant operational data to any connected org's `SME_OWNER`/`DEVOPS` UI.
4. **Cross-Tenant `target_name` Locks, RCA, & Adaptive Recovery (`healingAction.service.ts:259-271`, `ai.controller.ts:711-722`, `ai.service.ts:560-741`, `recoveryVerification.service.ts:247-278`, `incident.model.ts:645-659`):** Shared service names (e.g., `orders-api`) cause Org A actions to lock (`409 Conflict`), mutate, or verify Org B's `healing_actions` and `incidents`.
5. **Unfiltered / Fail-Open Lookups & Fallbacks:**
   - `ai.controller.ts:181-183, 222-224, 363-407` & `ai.service.ts:408-455, 941-987`: Missing `cluster_id`/`organization_id` triggers `ClusterModel.findFirst` / `EnvironmentModel.findFirst` / `OrganizationModel.findFirst`; `prediction.organization_id IS NULL` bypasses ownership checks.
   - `healingAction.controller.ts:438-446` (`resendNotification`): No org membership validation before calling `HitlNotificationService.notifyApproversForAction`.
   - `kubernetesEvent.model.ts:431-434, 472-547`: `OR e.cluster_id IS NULL` leaks events globally; `findWarningEventsByService` / `findLatestRecoveryTimeByService` filter only by service name.
   - `log.model.ts:124-164, 194-264`: `findPrioritizedByService` lacks org/cluster filter; `queryLogs` trusts agent/client `metadata->>'organization_id'`.
   - `workload.model.ts:107-114`, `cluster.model.ts:59-73, 669-844`, `agent.service.ts:719-722, 969-972, 1126-1195`, `node.controller.ts:102-109`, `pod.controller.ts:59-68`, `k8sStatus.service.ts:642-658`: Match ambiguous resource names (`c.name`, `n.name`, `p.name`, `w.name`) across tenants.
   - `statistics.service.ts:306-310`: Includes `OR al.organization_id IS NULL` in tenant `audit_logs` queries.
   - `logStream.service.ts:197-202`: Fail-open SSE broadcast when `logOrgId` is missing.
   - `alertRule.service.ts:121-128` & `systemRole.service.ts:99-109`: `SELECT id FROM organizations ... LIMIT 1` implicit fallback.
   - `telemetryBuffer.service.ts:466-487`: `persistIncidentSnapshot` inserts orphan `agent_metrics` with `NULL` `organization_id`/`environment_id`/`cluster_id`.
   - Runtime DDL (`ALTER TABLE` in `metric.model.ts:179-300`, `k8sStatus.service.ts`) and unfiltered side-effect `UPDATE healing_actions` inside `IncidentModel.findMany` (`incident.model.ts:200-212`), `HealingActionModel.findRunningActions` (`healingAction.model.ts:57-68`), and `TelemetryPipelineService.runPipelineCycle`.

### 6.2 Design A: PostgreSQL Row-Level Security Architecture

#### A. Schema Prerequisites (Denormalization + Integrity Before RLS)
Relying solely on 3–4 hop `EXISTS (...)` RLS subqueries across high-volume tables (`logs`, `agent_metrics`, `node_metrics`, `kubernetes_events`, `pods`, `prediction_inputs`, `rca_evidences`, `execution_attempts`) hurts throughput and index usage, while nullable/missing FKs allow orphan rows. Before enabling strict RLS:
1. Add `organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE` (after backfilling & quarantining/assigning orphans) directly onto hot/indirect tenant tables: `incidents` (already has nullable column, needs FK + `NOT NULL`), `healing_actions`, `ai_predictions`, `agents`, `logs`, `kubernetes_events`, `agent_metrics`, `node_metrics`, `workloads`.
2. Standardize `cluster_id` types (`UUID REFERENCES clusters(id)`) where currently `VARCHAR` (`incidents`, `agents`, `ai_predictions`, `logs`, `kubernetes_events`, `node_metrics`, `workloads`) and remove `cluster.name` fallback joins.
3. Add composite `(organization_id, created_at/collected_at)` and `(organization_id, id)` indexes on RLS-protected tables so PostgreSQL uses index-only / nested-loop scans under RLS.
4. Create missing migrations for `alert_rules`, `alert_events`, `alert_event_history` (with `organization_id NOT NULL`).
5. Remove all runtime `ALTER TABLE` calls from `metric.model.ts` and `k8sStatus.service.ts` into versioned migrations.

#### B. Session Context Contract (Transaction-Local GUCs)
Because `pg.Pool` multiplexes connections across tenants, **session-level `SET` is unsafe**. Context MUST use transaction-local `SET LOCAL` (or `set_config(..., true)`):
- `app.current_org_id`: UUID string (empty `''` unless in `TENANT` scope)
- `app.current_user_id`: UUID string (authenticated actor, or empty for background workers)
- `app.access_scope`: `'TENANT' | 'PLATFORM_ADMIN' | 'SYSTEM' | 'AUTH'`

Provide explicit pool/transaction helpers in `Main_backend/src/config/database.ts`:
- `withTenantTx(orgId, userId, fn)` -> `BEGIN`, validates UUIDs, sets `app.access_scope = 'TENANT'`, `app.current_org_id = $1`, `app.current_user_id = $2`, executes `fn(client)`, `COMMIT`/`ROLLBACK`.
- `withPlatformAdminTx(userId, fn)` -> strictly audited context (`app.access_scope = 'PLATFORM_ADMIN'`) ONLY for approved platform-admin endpoints (`admin.routes.ts`, cross-org statistics/broadcasts if PO-approved) — **never** used by organization routes (`SUPER_ADMIN` must still pass membership + `withTenantTx`).
- `withSystemWorker(fn)` -> workers iterate active `organization_id` values via a narrow `SECURITY DEFINER` list function and process **each org inside its own `withTenantTx(orgId, null, ...)`**, eliminating accidental cross-tenant leakage in `TelemetryPipelineService`, `TelemetryAggregatorService`, `RuleEngineExecutionService`, `AgentWebSocket` (bound to agent's verified `orgId`), and `TelemetryWebSocket` (bound to client's `organizationId`).

#### C. Fail-Closed RLS Policy Pattern
With `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` and `ALTER TABLE ... FORCE ROW LEVEL SECURITY` (owned by `selfheal_migrator`, queried by `selfheal_app`):
```sql
-- Standard tenant-scoped table with direct organization_id:
CREATE POLICY tenant_isolation_select ON incidents
  FOR SELECT TO selfheal_app
  USING (
    current_setting('app.access_scope', true) = 'TENANT'
    AND organization_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid
  );

CREATE POLICY tenant_isolation_write ON incidents
  FOR ALL TO selfheal_app
  USING (
    current_setting('app.access_scope', true) = 'TENANT'
    AND organization_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.access_scope', true) = 'TENANT'
    AND organization_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid
  );
```
- **When context is unset:** `current_setting('app.access_scope', true)` is `NULL`/`''` -> `USING` evaluates `FALSE` (returns **0 rows**, never throws leaked error details or falls back to default org) and `WITH CHECK` rejects unauthorized writes (`42501 insufficient_privilege`).
- **Dual/Hybrid tables:**
  - `audit_logs`: `TENANT` scope sees `organization_id = current_org_id()` (`IS NULL` hidden!); `PLATFORM_ADMIN` sees `organization_id IS NULL` (or all rows if PO requires cross-tenant audit viewing); `INSERT` allowed for active org/platform/system; `UPDATE`/`DELETE` denied for `selfheal_app` except explicit retention procedure/role.
  - `notifications`: `user_id = current_user_id() AND (organization_id IS NULL OR organization_id = current_org_id())`.
  - `organization_members` / `organizations`: Also permit `AUTH`/user self-membership lookup via narrow `SECURITY DEFINER` function `fn_get_user_orgs(user_id)` so user workspace switcher only enumerates organizations where `status = 'ACTIVE'`.
  - **Admin Bypass Control:** Platform admin policies (if approved by PO for `admin.routes.ts`) should be explicit separate `FOR SELECT` policies gated on `app.access_scope = 'PLATFORM_ADMIN'` OR routed through dedicated `SECURITY DEFINER` aggregate views (`admin_platform_kpi_summary`) so raw PII/operational payloads aren't broadly exposed.

---

## 7. Refresh Token Lifecycle Analysis & Target Architecture (Design B)

### 7.1 Current Auth & Session Lifecycle Findings
Verified directly across `Main_backend/src/` and `Frontend/src/`:

| Lifecycle Stage | Current Implementation | Confirmed Security Gaps |
|---|---|---|
| **Login (`POST /auth/login`, `/login/2fa`, `/google`, `/register`)** | Issues a single **7-day HS256 JWT** (`auth.service.ts:53-63`, `env.ts:59`). Frontend saves token to `localStorage['selfheal_auth_token']`. `apiClient.js:28` contains dead `'/auth/refresh'` reference. | **[CRITICAL]** No refresh token or `user_sessions` table exists anywhere; compromised JWT grants 7 days of access. `verify2FALogin` (`auth.service.ts:139-165`) misses checking `SUSPENDED`/`INACTIVE` before issuing JWT; `verify2FALogin` (`124`) & `verifyEmail` (`auth.controller.ts:221`) omit `algorithms: ['HS256']`. |
| **Access Token Verification (`auth.middleware.ts`)** | `Authorization: Bearer <jwt>`, checks Redis `auth:token_blacklist:<sha256>`, queries `UserModel.findAuthStatus`. WebSockets support `POST /auth/ws-ticket` (30s single-use) + legacy `?token=` fallback. | **[MEDIUM]** No `jti`, `typ`/`purpose`, or `token_version` claim (`config.jwt.secret` shared across access JWT, 2FA `temp_token`, HITL JWT). `ALLOW_DEV_FALLBACK=true` auto-grants `SUPER_ADMIN` whenever `NODE_ENV !== 'production'`. |
| **Refresh** | **Not implemented.** `apiClient.js:154-160` throws immediately on 401. | **[CRITICAL]** Forces 7-day access token lifetime and prevents short-lived access tokens (`5m–15m`). |
| **Logout (`POST /auth/logout`)** | Backend blacklists raw token SHA-256 in Redis (`SessionRevocationService`). Frontend `AuthContext.logout` (`AuthContext.jsx:265-293`) clears local state/partial keys. | **[HIGH]** **Frontend `logout()` NEVER calls `POST /api/v1/auth/logout`** -> tokens remain valid for 7 days. `AuthContext.logout` misses `localStorage.admin_access_token` & `localStorage.token`. 401 `SESSION_REVOKED` handler fails to wipe `localStorage` on originating tab (`multiTabSync.js:44`). |
| **Revocation & Redis Posture** | `SessionRevocationService` writes `auth:token_blacklist:<sha256>` to Redis only. | **[MEDIUM-HIGH]** Fails **open** (`isTokenRevoked` returns `false`) when Redis is down in non-production (`sessionRevocation.service.ts:76`). No per-user global revocation ("logout all sessions"). |
| **Password Change** | Backend updates `password_hash` (`UserService.changePassword`, `user.service.ts:318-337`). Frontend (`PersonalSecurityPage.jsx` / `personalPortalService.js:747-756`) uses a **local mock stub**. | **[HIGH]** Backend does **not** revoke caller's or other active sessions/JWTs on password change. Frontend password change & session revocation (`personalPortalService.js:859-864`) never call the backend API. |
| **Account Disable (`PATCH /users/:id/status`)** | Sets `users.status = 'SUSPENDED'`; HTTP middleware checks DB `status` on each call. | **[MEDIUM-HIGH]** Active `telemetryWebSocket.ts` connections are **not disconnected** on user suspension/soft-delete; WS handshake (`109`) misses `INACTIVE`. `AuthModel.verifyUserEmailAndActivate` (`178`) can unconditionally reset a `SUSPENDED` account to `'ACTIVE'`. |
| **Rate Limiting & CSRF** | Per-process `Map` keyed by `req.ip` (`rateLimit.middleware.ts:14-60`); no `trust proxy` in `app.ts`; no cookies used today (`cors` sets `credentials: true` + allows `!origin`). | **[MEDIUM]** Per-instance memory limits break multi-replica & behind-proxy IPs (global 429 DoS). `/auth/ws-ticket` & per-account `/login` + `/login/2fa` brute-force protection missing. Cookie adoption requires explicit CSRF defense. |

### 7.2 Design B: Refresh Token, Session Tracking & Rotation Architecture

1. **Database Schema Additions (`user_sessions` & `refresh_tokens` + `users.token_version`):**
   - `users.token_version INTEGER NOT NULL DEFAULT 1` + `password_changed_at TIMESTAMPTZ`.
   - `user_sessions`: `id UUID PK`, `user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE`, `family_id UUID NOT NULL UNIQUE`, `user_agent TEXT`, `ip_address INET`, `created_at TIMESTAMPTZ`, `last_used_at TIMESTAMPTZ`, `expires_at TIMESTAMPTZ`, `revoked_at TIMESTAMPTZ`, `revoked_reason VARCHAR(64)`.
   - `refresh_tokens`: `id UUID PK`, `session_id UUID NOT NULL REFERENCES user_sessions(id) ON DELETE CASCADE`, `family_id UUID NOT NULL`, `token_hash TEXT NOT NULL UNIQUE` (HMAC-SHA256 with server secret/pepper or SHA-256 of 256-bit CSPRNG opaque token), `parent_token_id UUID`, `replaced_by_token_id UUID`, `issued_at TIMESTAMPTZ`, `expires_at TIMESTAMPTZ`, `used_at TIMESTAMPTZ`, `revoked_at TIMESTAMPTZ`, `reuse_detected_at TIMESTAMPTZ`.
2. **Token Design & Storage:**
   - **Access Token:** Short-lived JWT (`15m` default, configurable `10m–15m`), signed HS256 with dedicated JWT claim contract `{ sub: userId, jti, sid: sessionId, tv: tokenVersion, typ: 'access', roles }` (separate secret or strict `typ`/`purpose` check rejecting `2fa_login` / `hitl_action` JWTs in `auth.middleware.ts`). Stored **in-memory** on Frontend (or transitional fallback during cutover, never 7d `localStorage`).
   - **Refresh Token:** 32-byte (`256-bit`) cryptographically random opaque secret (`rt_<sessionId>.<secret>` or pure random + DB lookup by `token_hash`), `7d` idle / `30d` absolute cap, stored in **`HttpOnly; Secure; SameSite=Lax` cookie** scoped strictly to `Path=/api/v1/auth` (so API calls don't send the refresh cookie, minimizing CSRF surface).
3. **Rotation, Reuse Detection & Concurrency Safety:**
   - `POST /api/v1/auth/refresh` runs inside a PostgreSQL transaction locking the presented `refresh_tokens` row (`SELECT ... FOR UPDATE`).
   - **Normal rotation (`used_at IS NULL AND revoked_at IS NULL AND expires_at > NOW()`):** Mark current row `used_at = NOW()`, generate child token row (`parent_token_id = current.id`, `replaced_by_token_id` back-linked), update `user_sessions.last_used_at`, set new cookie + return new `15m` Access JWT.
   - **Reuse Detection (`used_at IS NOT NULL OR revoked_at IS NOT NULL`):**
     - *Concurrency consideration:* Multi-tab races can submit two concurrent refreshes. Mitigate primarily on Frontend via a **single-flight shared refresh Promise + `BroadcastChannel`/Web Lock** across tabs; optionally support a **very short (e.g., 5s) idempotent grace window** returning an error or cached rotation ONLY if explicitly opted in — **recommended security default: strict single-use (`0s` grace) combined with cross-tab `BroadcastChannel` refresh coordination**, where any replay immediately revokes the entire `family_id` (`user_sessions.revoked_at = NOW()`, all `refresh_tokens.revoked_at = NOW()`), sets `reuse_detected_at`, increments audit log `AUTH_REFRESH_REUSE_DETECTED`, clears cookie, and returns `401`.
4. **CSRF Defense for Cookie-Authenticated `/auth/refresh` & `/auth/logout`:**
   - `SameSite=Lax` cookie + **Double-Submit CSRF token cookie** (`XSRF-TOKEN` non-HttpOnly paired with `X-CSRF-Token` header) + strict `Origin`/`Referer` verification on `/auth/*` state-changing cookie routes (do **not** fail-open when `Origin` is absent on browser cookie endpoints).
5. **Global Revocation & Real-Time Disconnection:**
   - **Password Change / Reset / Account Disable / "Logout All Devices":** Inside one DB transaction, update user state + increment `users.token_version = token_version + 1` + set `revoked_at = NOW()` on all active `user_sessions` and `refresh_tokens`, blacklist current access `jti` in Redis (`ttl = 15m`), and publish Redis event `auth:user_revoked:<userId>` so all `Main_backend` instances immediately close matching sockets in `telemetryWebSocket.ts` `uiClients` (`1008`/`4401`).
   - `authenticateToken` verifies `decoded.tv === dbUser.token_version` from the already-executed `UserModel.findAuthStatus` query (zero extra DB round-trip!).
6. **Pre-Auth & Abuse Hardening:** Fix `AuthService.verify2FALogin` status check & `algorithms: ['HS256']`, prevent `AuthModel.verifyUserEmailAndActivate` from re-activating `SUSPENDED` accounts, move `rateLimit.middleware.ts` to Redis store with configurable `trust proxy` + account-level lockout on `/auth/login`, `/auth/login/2fa`, and `/auth/ws-ticket`.

---

## 8. PostgreSQL TLS Analysis & Target Architecture (Design C)

### 8.1 Current Transport Security State
| Layer | Current Config (Verified) | Risk |
|---|---|---|
| **PostgreSQL Server (`captone-postgres` & Compose/K8s)** | `SHOW ssl;` -> `off`. No certs in `/var/lib/postgresql/data`. `docker-compose.yml:5-25`, `docker-compose.prod.yml:8-28`, `k8s/postgres.yaml:30-55` mount no TLS cert volumes or `-c ssl=on`. `pg_hba.conf` allows `trust` on `local`/`127.0.0.1/32`/`::1/128` and non-SSL `host all all all scram-sha-256`. | **[HIGH]** Database credentials, JWT/HMAC audit metadata, tenant operational telemetry, and PII travel in cleartext on pod/Docker overlay networks. |
| **PostgreSQL Clients (`Main_backend`)** | `database.ts:5-18`, `create-admin.ts:18-24`, `create-user-letanquoc.ts:12-18` instantiate `pg.Pool` with **no `ssl` config**; `env.ts:30-40` defines zero `DB_SSL*` vars. (`AI_backend` has no DB connection.) | **[HIGH]** Client never initiates or verifies PostgreSQL TLS/CA identity. |
| **Edge Proxy (`nginx/nginx.conf`)** | `nginx/nginx.conf:53-134` listens only on port `80`, even though Compose publishes `443:443`. | **[HIGH]** External login credentials, tokens, and WS traffic traverse public networks unencrypted unless external TLS proxy sits in front. |
| **Internal Service Links** | `AI_BACKEND_URL` (`http://ai-backend:8000`), Redis (`redis.ts:7-29`, no `tls`, no password in `docker-compose.yml`), OTLP (`http://...:4318`), `http://localhost` links hardcoded in `email.service.ts:139,800-801`, non-587 SMTP missing `requireTLS`. | **[MEDIUM]** Internal service traffic and Redis commands/tokens traverse plaintext TCP. |

### 8.2 Design C: PostgreSQL & Adjacent TLS Architecture

1. **PKI & Certificate Layout:**
   - Dedicated internal **Root/Intermediate CA** (managed via `cert-manager` in K8s or automated OpenSSL/Vault issuance in Compose/VPS, **never committed to git**).
   - Server leaf cert (`postgres.crt` / `postgres.key`, key mode `0600` owned by `postgres` UID `70` on Alpine / `999` on Debian!) with SANs: `DNS:postgres`, `DNS:postgres-service`, `DNS:postgres-service.monitoring.svc.cluster.local`, `DNS:localhost`, `IP:127.0.0.1`.
2. **PostgreSQL Server Configuration (`postgresql.conf` / command flags + `pg_hba.conf`):**
   - Enable `ssl = on`, `ssl_cert_file = '/etc/postgresql/certs/server.crt'`, `ssl_key_file = '/etc/postgresql/certs/server.key'`, `ssl_ca_file = '/etc/postgresql/certs/ca.crt'`, `ssl_min_protocol_version = 'TLSv1.2'` (prefer `'TLSv1.3'`).
   - Tighten `pg_hba.conf`:
     - Replace `127.0.0.1/32` & `::1/128` `trust` with `scram-sha-256` (keep local socket `local all postgres peer` or `scram-sha-256`).
     - Stage 1 (Transition): keep `hostssl` preferred; Stage 2 (Cutover): enforce **`hostssl all all all scram-sha-256`** (reject all non-TLS TCP connections).
3. **`Main_backend` (`pg.Pool`) Configuration (`env.ts` & `database.ts`):**
   - Introduce `DB_SSL_MODE` (`disable` [dev-local only] | `require` | `verify-full`), `DB_SSL_CA_PATH`, and optional client mTLS (`DB_SSL_CERT_PATH`, `DB_SSL_KEY_PATH`).
   - Fail startup in production (`config.isProduction`) if `DB_SSL_MODE !== 'verify-full'` or CA file missing (unless explicit override flag for managed cloud CA bundle).
   - Configure `ssl: { rejectUnauthorized: true, ca: fs.readFileSync(caPath, 'utf8') }` consistently across `database.ts` and all CLI/migration scripts.
4. **Infrastructure Parity (`Compose`, `K8s`, `Nginx`, `Redis`):**
   - Mount CA + server certs in `docker-compose.prod.yml` and `k8s/postgres.yaml` (add `NetworkPolicy` restricting `:5432` ingress strictly to `main-backend` & backup pods + `securityContext`).
   - Close adjacent edge/internal gaps: add `listen 443 ssl` + HSTS + TLS 1.2/1.3 in `nginx/nginx.conf`, enable `--requirepass` + TLS on Redis in production, enforce `CLIENT_URL`/`APP_PUBLIC_URL` instead of `http://localhost` in `email.service.ts`.

---

## 9. Sensitive Data, Secrets, Logs, Migrations & Backup Analysis (Design D)

### 9.1 Confirmed Findings Across Data Protection, Secrets & Migrations

| Area | Verified Evidence | Security / Operational Risk |
|---|---|---|
| **DB Seed Admin Password Reset & Demo Tokens** | `00_init_full_database.sql:1378-1431, 1552-1558`: `ON CONFLICT DO UPDATE` resets `superadmin@selfheal.com` and `admin@selfheal.com` passwords to `'AdminPassword123@'` on every `migrate.ts` run; seeds 4 `agent_tokens` (365d expiry) with 2 plaintext strings and 2 known SHA-256 hashes. | **[CRITICAL]** Re-running migrations in production resets admin credentials to a public default and re-enables demo agent credentials! |
| **Hardcoded Compose Fallbacks Bypass `env.ts` Guards** | `docker-compose.yml:11,70,75,78-80,127-128`: Sets `NODE_ENV=production` while supplying default fallbacks (`postgres`, `dev_only_jwt_secret...`, `dev_only_totp...`, `dev_only_ai_internal_hmac...`), bypassing `env.ts` startup checks. Also `env.ts:98` hardcodes `GOOGLE_CLIENT_ID`, `k8s/secrets.example.yaml` lacks `REDIS_PASSWORD`, `Main_backend/.env` lacks `AI_INTERNAL_HMAC_SECRET` and `TOTP_ENCRYPTION_KEY`, and `Agent/venv` is tracked in git. | **[HIGH]** Easy accidental deployment with predictable cryptographic secrets. |
| **Unprotected Secrets in DB & API** | `approvals.approval_token` stores raw signed HITL JWT (`hitlNotification.service.ts:192`) yet is never validated on quick-approve; `organization_alert_settings` stores `slack_webhook_url` & `pagerduty_key` in plaintext and returns them **unmasked** in `GET`/`PUT` (`organizationAlertSettings.model.ts:67-90`, `organization.controller.ts:197,249`); `user_two_factor` decrypt silently accepts unencrypted strings (`twoFactor.service.ts:27-29`) and stores unsalted SHA-256 `backup_codes`. | **[HIGH]** DB dump or RBAC read leaks webhook bearer URLs, PagerDuty integration keys, and live HITL approval JWTs. |
| **Error & Token Log Leakage** | `ai.controller.ts` (17 handlers) & `aiModelRegistry.controller.ts` (4 handlers) return raw `(error as Error).message` in HTTP 500 JSON; `error.middleware.ts:37` logs full `err` object to stdout; `email.service.ts:818-819` logs full HITL JWT URLs when SMTP is unset; Nginx (`$request`) & Morgan (`combined`) log `?token=` URLs (verification, HITL, legacy WS `?token=`); `AuditService` redaction regex (`audit.service.ts:15`) misses `pagerduty_key`, `slack_webhook_url`, `backup_codes`; `hitlNotification.service.ts:425,636` & `email.service.ts:860-905` lack HTML escaping; `create-admin.ts:76` & `create-user-letanquoc.ts:88` print raw passwords. | **[HIGH]** Leaks DB errors, tokens, and secrets into logs and API responses; potential HTML injection in notification emails/pages. |
| **Migration & Backup Absence** | `migrate.ts:19-38` has no `schema_migrations`, no transactions, no advisory lock, and no rollback/down scripts. `cd.yml:276` executes `node dist/scripts/migrate.js || true` with **zero `pg_dump` backup** and **zero error halt/rollback**. Zero backup/restore scripts exist; destructive `DELETE`s appear in migrations `05`, `10`, `12`, `13`, `26`; `auditRetention.worker.ts` & `sp_cleanup_old_prediction_inputs` are unscheduled; telemetry tables have no TTL. | **[CRITICAL]** High risk of irreversible data loss, silent schema corruption in CD, and unbounded table growth. |

### 9.2 Design D: Backup, Migration Governance & Data Protection Architecture

1. **Migration Governance Refactor (`migrate.ts` & `migrations/`):**
   - Add `schema_migrations (filename TEXT PRIMARY KEY, checksum VARCHAR(64) NOT NULL, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), execution_ms INTEGER)` + `pg_advisory_lock`.
   - Wrap each pending migration in `BEGIN ... COMMIT` (handling `ALTER TYPE ... ADD VALUE` outside TX safely where PG requires, with explicit pre-check).
   - Provide a **one-time baseline reconciliation command** (`migrate.ts --baseline`) for already-initialized environments (`captone_db`) so `00_`..`28_` are recorded without re-executing destructive/seed SQL.
   - Extract demo seeds (`00_init_full_database.sql:1378-1593`) into explicit non-production `seeds/dev_seed.sql` (never auto-run in production).
   - Restore/author migrations for `alert_rules`, `alert_events`, `alert_event_history`.
   - Remove `|| true` from `.github/workflows/cd.yml:276`; require automated pre-migration `pg_dump` + abort & container rollback on migration failure.
2. **Automated Backup, Encryption & Restore Drill:**
   - Implement `scripts/backup-postgres.sh` (using `pg_dump -Fc` over TLS / local peer socket -> AES-256/age encryption -> off-host encrypted storage + retention policy) and `scripts/restore-postgres.sh` with checksum verification + monthly automated restore-to-ephemeral-DB verification test.
   - Add WAL archiving / PITR path for production Compose/K8s (e.g., `pgBackRest` or WAL-G sidecar).
3. **Sensitive Data & Logging Sanitization:**
   - Replace `approvals.approval_token` with `token_hash` (SHA-256 of JWT/JTI) and verify single-use state against it.
   - Encrypt `organization_alert_settings.slack_webhook_url` and `pagerduty_key` at rest using AES-256-GCM (dedicated `INTEGRATION_ENCRYPTION_KEY`) and return masked values (`https://hooks.slack.com/...****`) on API `GET`/`PUT`.
   - Expand `AuditService.SENSITIVE_KEYS_REGEX` (`pagerduty`, `webhook`, `backup_codes`, `encryption_key`).
   - Route `ai.controller.ts` & `aiModelRegistry.controller.ts` errors through `next(err)` (`errorHandler`), sanitize `error.middleware.ts` & `health.controller.ts` (`redisHealth.status`), escape HTML in `hitlNotification.service.ts` / `email.service.ts`, mask HITL logs in `email.service.ts:818-819`, deprecate WS `?token=` fallback in production, and transition email/HITL links away from URL query-string tokens (POST-body / short-lived one-time code exchange).
   - Schedule `auditRetention.worker.ts` and metric/log retention jobs (`sp_cleanup_old_prediction_inputs`, `email_verification_tokens`, `password_reset_tokens`, `logs`, `agent_metrics`, `node_metrics`).

---

## 10. Findings and Risk Ranking

| ID | Category | Type | Severity | Evidence | Affected Files / DB Objects | Potential Impact | Proposed Remediation | Dependencies | Migration Risk | Required Approval |
|---|---|---|---|---|---|---|---|---|---|---|
| **SC-A01** | Tenant Isolation / RLS | Confirmed Vulnerability | **CRITICAL** | `agentWebSocket.ts:620-639` & `healingAction.model.ts:1663-1682` update `ai_recommendations` by `target_name`/`title` with no `organization_id`; `telemetryPipeline.service.ts:368-509,605-697` resolve incidents & trigger `AUTO` policies across orgs; `telemetryAggregator.service.ts:782-797` + `telemetryWebSocket.ts:238,275,315` leak 6 global tables over WS; `ai.service.ts:560-741` & `recoveryVerification.service.ts:247-278` read/write across orgs. | `agentWebSocket.ts`, `healingAction.model.ts`, `telemetryPipeline.service.ts`, `telemetryAggregator.service.ts`, `telemetryWebSocket.ts`, `ai.service.ts`, `recoveryVerification.service.ts`, `healingAction.service.ts` | Cross-tenant incident resolution, unauthorized policy-triggered actions, cross-tenant `ai_recommendations` corruption, and live telemetry data leak to other tenants' UIs. | Fix all SQL queries immediately with mandatory `organization_id` / `cluster_id` predicates (Phase 1 quick patch) + enforce DB-level RLS (Design A). | PO decision on orphan rows | Low-Med (query fixes immediate; RLS staged) | PO + Tech Lead |
| **SC-B01** | Auth / Session Lifecycle | Confirmed Vulnerability | **CRITICAL** | No `refresh_tokens`/`user_sessions` table (`00_init_full_database.sql`, `auth.routes.ts`); single `7d` JWT (`env.ts:59`, `auth.service.ts:53-63`) in `localStorage` (`AuthContext.jsx:26`); `AuthContext.logout` never calls `POST /api/v1/auth/logout`; `UserService.changePassword` leaves tokens valid. | `auth.service.ts`, `auth.controller.ts`, `auth.middleware.ts`, `user.service.ts`, `AuthContext.jsx`, `apiClient.js`, `PersonalSecurityPage.jsx`, `personalPortalService.js` | Stolen JWT or post-logout/post-password-change browser keeps up to 7 days of full tenant/admin access; XSS can exfiltrate 7d token. | Implement Design B: `15m` access JWT, `user_sessions` + rotating hashed refresh tokens in `HttpOnly; Secure; SameSite=Lax` cookie, reuse detection, CSRF, `token_version` global revocation, and Frontend wiring. | Redis + HTTPS/Nginx TLS for `Secure` cookies | High (auth UX & multi-tab impact; stage feature-flagged / cutover) | PO + Security Lead |
| **SC-A02** | DB Privileges & RLS Absence | Confirmed Config Gap + Architecture | **CRITICAL** | `captone_db` & `aiselfhealing_test`: 44 tables all `rowsecurity = false`, `0` policies; single superuser `postgres` (`rolsuper=t, rolbypassrls=t`) used by `database.ts`. | PostgreSQL `pg_roles`, all 44 tables, `database.ts`, `docker-compose*.yml`, `k8s/*.yaml` | Zero database-layer defense against any buggy SQL query, IDOR, or SQL injection; app holds superuser privileges. | Implement Design A: `selfheal_migrator` + `selfheal_app` (`NOBYPASSRLS`), `FORCE ROW LEVEL SECURITY`, `withTenantTx` / `SET LOCAL` GUCs, org_id denormalization. | SC-E01 (`schema_migrations`), SC-A03 (schema FKs/backfill) | High (misconfigured policy breaks queries; must stage permissive -> audit -> strict) | PO + DBA/Lead |
| **SC-E01** | Migrations & Seeds | Confirmed Vulnerability | **CRITICAL** | `migrate.ts:19-38` re-runs all SQL without tracking/TX; `00_init_full_database.sql:1391-1558` resets `superadmin`/`admin` passwords to `AdminPassword123@` & re-seeds 4 demo `agent_tokens`; `cd.yml:276` runs `migrate.js || true` with no backup; migrations `15..19` (`alert_rules`, `alert_events`, `alert_event_history`) missing from repo. | `migrate.ts`, `00_init_full_database.sql`, `migrations/*`, `.github/workflows/cd.yml`, `alertRule.*`, `alertEvent.*` | Production deploy silently resets admin passwords, swallows DDL errors, drops integrity, or corrupts production data without rollback. | Implement `schema_migrations`, TX runner, baseline reconciliation, extract seeds from `00_`, add missing `alert_*` migrations, fail CD on error with mandatory pre-`pg_dump`. | Backup script (SC-E02) | High on live `captone_db` (must baseline carefully) | PO + DevSecOps |
| **SC-E02** | Backup & Recovery | Confirmed Config Gap | **CRITICAL** | Zero `pg_dump`/`pg_restore`/WAL backup scripts or CronJobs exist despite `26_*.sql` explicit backup warning and `cd.yml` running migrations in production. | Repo-wide (`scripts/`, `cd.yml`, `docker-compose.prod.yml`, `k8s/postgres.yaml`) | Any bad migration, ransomware, volume failure, or accidental `DELETE` causes permanent total data loss. | Implement automated encrypted `pg_dump` + off-host sync + pre-migration backup hook + restore test drill (Design D). | Storage target + encryption key | None (additive) | PO + DevSecOps |
| **SC-D01** | PostgreSQL & Edge TLS | Confirmed Config Gap | **HIGH** | `SHOW ssl;` -> `off`; `pg_hba.conf` uses `trust` on loopback/local + unencrypted `scram-sha-256`; `database.ts`, Compose, `k8s/postgres.yaml` configure no SSL; `nginx/nginx.conf` has no `443 ssl` block. | `database.ts`, `env.ts`, `create-admin.ts`, `create-user-letanquoc.ts`, `docker-compose*.yml`, `k8s/postgres.yaml`, `nginx/nginx.conf` | Credential/token sniffing and MITM on Docker/K8s/public networks; blocks `Secure` cookie transport over HTTPS. | Provision internal CA + PG `ssl=on` + `hostssl` (`pg_hba.conf`) + `pg.Pool` `verify-full` + Nginx `443 ssl` (Design C). | Cert lifecycle strategy | Med (dual-mode transition avoids downtime) | DevSecOps + PO |
| **SC-A03** | Schema Integrity & Null FKs | Architectural / Data Gap | **HIGH** | Nullable/missing FKs & `VARCHAR` mismatches on `incidents`, `agents`, `ai_predictions`, `logs`, `kubernetes_events`, `workloads`, `agent_metrics`, `node_metrics`; `telemetryBuffer.service.ts:466-487` writes orphan `agent-snapshot` rows; `ai.controller.ts:363-407` & `kubernetesEvent.model.ts:431-434` fail open when org/cluster is `NULL`. | `00_init_full_database.sql`, `telemetryBuffer.service.ts`, `ai.controller.ts`, `ai.service.ts`, `kubernetesEvent.model.ts` | Enables orphan cross-tenant visibility and blocks strict `NOT NULL` RLS policies. | Quarantine/backfill NULL rows per PO rule, add `organization_id NOT NULL` + FKs, fail closed on null scope, stop writing tenantless snapshots. | PO decision on legacy orphans | Med (requires orphan backfill check first) | PO |
| **SC-A04** | Unfiltered Model & Controller Bypasses | Confirmed Vulnerability | **HIGH** | `healingAction.controller.ts:438-446` (`resendNotification`) skips org check; `ai.controller.ts:181,222` & `ai.service.ts` fall back to `findFirst`; `alertRule.service.ts:121` & `systemRole.service.ts:99` query `LIMIT 1` org; `node/pod.controller`, `cluster/workload/log.model`, `k8sStatus.service` resolve by non-unique `name`; `statistics.service.ts:308` includes `audit_logs.organization_id IS NULL`; `logStream.service.ts:197` fails open on missing orgId; runtime `ALTER TABLE` in models/services. | Multiple `controllers/`, `models/`, `services/` (see Section 6.1) | Privilege/tenant escalation, cross-org notification spam, ambiguous name resolution, audit log leak of platform events. | Enforce mandatory explicit `orgId` (remove all `findFirst`/`LIMIT 1` org fallbacks), check org membership on `resendNotification` & `node/pod`, validate cluster/org before name lookup, restrict `audit_logs` `IS NULL` to platform scope, remove runtime DDL. | None (app refactor) | Low | Tech Lead |
| **SC-E03** | Sensitive Data & Plaintext Secrets | Confirmed Vulnerability | **HIGH** | `docker-compose.yml` fallback secrets bypass `env.ts` prod checks; `approvals.approval_token` plaintext JWT; `organization_alert_settings` plaintext & unmasked API output (`slack_webhook_url`, `pagerduty_key`); `user_two_factor` accepts unencrypted secrets; `k8s/secrets.example.yaml` lacks `REDIS_PASSWORD`; `DEPLOYMENT.md:197` sample key; `Agent/venv` in git. | `docker-compose.yml`, `env.ts`, `hitlNotification.service.ts`, `organizationAlertSettings.model.ts`, `organization.controller.ts`, `twoFactor.service.ts`, `DEPLOYMENT.md`, `k8s/secrets.example.yaml` | Predictable JWT/HMAC/TOTP keys in Docker deployments; webhook/PagerDuty/HITL token exfiltration via DB or GET API. | Remove prod Compose fallbacks, hash `approvals.token_hash`, AES-256-GCM encrypt & mask alert settings, fail closed on unencrypted TOTP, rotate secrets & remove sample keys/venv. | Secret/key rotation plan | Med (re-encrypt existing rows cleanly) | PO + Security Lead |
| **SC-E04** | Error, Stack & URL Token Leakage | Confirmed Vulnerability | **HIGH** | `ai.controller.ts` (17x) & `aiModelRegistry.controller.ts` (4x) return raw 500 `error.message`; `email.service.ts:818-819` logs raw HITL JWT links; `?token=` in Nginx `$request` & Morgan `combined` logs; `AuditService` regex misses `pagerduty_key`, `slack_webhook_url`, `backup_codes`; HTML unescaped in `hitlNotification.service.ts` / `email.service.ts`; `create-admin.ts` prints passwords; `error.middleware.ts:37` logs full `err`. | `ai.controller.ts`, `aiModelRegistry.controller.ts`, `error.middleware.ts`, `health.controller.ts`, `email.service.ts`, `hitlNotification.service.ts`, `audit.service.ts`, `nginx.conf`, `app.ts`, scripts | Internal SQL/stack exposure to attackers; bearer token theft from log aggregators; HTML injection in approval emails/pages. | Delegate controllers to `next(err)`, sanitize logs & `AuditService` regex, mask HITL log output, escape HTML, move URL query tokens to POST/short-lived opaque codes, stop printing script passwords. | Cookie/auth migration for WS | Low | Tech Lead |
| **SC-B02** | Session Disable, 2FA, Verification & Redis Fail-Open | Confirmed Vulnerability | **HIGH** | `verify2FALogin` misses `SUSPENDED`/`INACTIVE` check; `verifyEmail` (`auth.controller.ts:219`) skips revocation check & `verifyUserEmailAndActivate` resets `SUSPENDED` -> `ACTIVE`; `telemetryWebSocket.ts:109` misses `INACTIVE` & never disconnects live WS on suspension; Redis blacklist fails open in non-prod. | `auth.service.ts`, `auth.controller.ts`, `auth.model.ts`, `telemetryWebSocket.ts`, `sessionRevocation.service.ts` | Suspended users retain live WebSocket streams, finish 2FA login, or re-activate via old verification emails. | Enforce status checks in 2FA/verifyEmail/WS, enforce `algorithms: ['HS256']` everywhere, disconnect active WS on suspend/password-change, fail-closed or PG fallback for revocation. | Design B `token_version` / event bus | Low | Security Lead |
| **SC-B03** | Rate Limit, Trust Proxy & Secret Separation | Config Gap | **MEDIUM** | `rateLimit.middleware.ts` uses in-memory `Map`; `app.ts` omits `trust proxy`; `/auth/ws-ticket` & per-account `/login` / `/login/2fa` lack lockout; single `config.jwt.secret` shared by access/2FA/HITL JWTs with no `typ` check. | `rateLimit.middleware.ts`, `app.ts`, `auth.routes.ts`, `twoFactor.service.ts`, `env.ts` | Brute-force via IP rotation or global 429 DoS behind Nginx proxy; lack of JWT domain separation. | Migrate rate limiter to Redis, configure `trust proxy` explicitly, add account lockout, enforce strict `typ` claims & separate signing purposes. | Redis HA | Low | Tech Lead |
| **SC-D02** | Adjacent Plaintext Links (Redis, AI, OTel, SMTP) | Config Gap | **MEDIUM** | `docker-compose.yml` Redis lacks `--requirepass` & TLS; `AI_BACKEND_URL` & OTLP use `http://`; non-587 SMTP lacks `requireTLS`; `email.service.ts` hardcodes `http://localhost`. | `docker-compose*.yml`, `redis.ts`, `otel.ts`, `otel.py`, `email.service.ts`, `env.ts` | Internal interception or unauthenticated Redis manipulation (token blacklist / email queue / TOTP guard). | Enforce Redis auth + TLS in prod, use configurable `APP_PUBLIC_URL`, enforce TLS/mTLS for internal/OTel/SMTP links. | Certs / Compose config | Low | DevSecOps |
| **SC-E05** | Unscheduled Data Retention & Global Update Side-Effects | Architectural / Ops Gap | **MEDIUM** | `auditRetention.worker.ts` & `sp_cleanup_old_prediction_inputs` unscheduled; telemetry/token tables grow unboundedly; `IncidentModel.findMany` & `HealingActionModel.findRunningActions` run global `UPDATE healing_actions` on `GET` calls. | `auditRetention.worker.ts`, `server.ts`, `docker-compose*.yml`, `k8s/`, `incident.model.ts`, `healingAction.model.ts` | Unbounded DB storage growth and unexpected cross-tenant mutations on read queries. | Move timeout cleanup exclusively to scoped background worker; schedule retention CronJobs/workers per PO retention policy. | PO retention SLA decision | Low | PO + DevSecOps |

---

## 11. Proposed Sprint C Backlog

- **Epic C1 — Emergency Code Tenant Isolation & Schema Foundation (Phase 1)**
  - `SC-101` *(Quick Containment)*: Fix `agentWebSocket.ts:620-639`, `healingAction.model.ts:1663-1682`, `telemetryPipeline.service.ts` (`autoResolveIfRecovered`, `evaluatePolicyAndTriggerAutonomousHealing`, remove `environments LIMIT 1`), `telemetryAggregator.service.ts` (`getLiveSummaryData`, `buildRcaContext`, `evaluateAndDiagnoseService`), `ai.service.ts`, `recoveryVerification.service.ts`, `healingAction.controller.ts` (`resendNotification`), `logStream.service.ts`, `statistics.service.ts`, and `ai.controller.ts` fail-open paths + remove `findFirst`/`LIMIT 1` org fallbacks.
  - `SC-102`: Implement `schema_migrations` tracking, advisory lock, transactional runner (`migrate.ts`), baseline command, remove seed SQL from `00_init_full_database.sql` into `seeds/`, and add missing migrations for `alert_rules`, `alert_events`, `alert_event_history`.
  - `SC-103`: Implement encrypted `pg_dump` / `pg_restore` automation + pre-migration backup gate in `cd.yml` (remove `|| true`) + restore verification test.
- **Epic C2 — PostgreSQL Role Separation & Row-Level Security (Phase 2)**
  - `SC-201`: Reconcile orphan NULL rows (per PO rule), denormalize `organization_id` + FKs + indexes onto core tenant tables, remove runtime `ALTER TABLE` from models/services.
  - `SC-202`: Create `selfheal_migrator` & `selfheal_app` (`NOSUPERUSER NOBYPASSRLS`) roles + narrow `SECURITY DEFINER` auth/worker lookup functions + `withTenantTx` / `withPlatformAdminTx` helpers in `database.ts`.
  - `SC-203`: Enable + `FORCE ROW LEVEL SECURITY` policies across all tenant & audit tables; refactor workers to iterate per org with `withTenantTx`; add cross-tenant RLS penetration integration suite (`test_rls_isolation`).
- **Epic C3 — Refresh Token Lifecycle & Session Hardening (Phase 3)**
  - `SC-301`: Create `user_sessions`, `refresh_tokens`, and `users.token_version` + `password_changed_at` migration.
  - `SC-302`: Implement `15m` Access JWT (`jti`, `tv`, `typ`), rotating hashed refresh token in `HttpOnly; Secure; SameSite=Lax` cookie, reuse detection (`family_id` revocation), CSRF defense, and global revocation (password change, disable, logout-all) + active WebSocket kick.
  - `SC-303`: Fix `verify2FALogin`, `verifyEmail`, WS `INACTIVE` check, `algorithms: ['HS256']`, Redis-backed rate limiter + `trust proxy` + account lockout, and wire Frontend (`AuthContext`, `apiClient` single-flight refresh, `multiTabSync`, `PersonalSecurityPage`).
- **Epic C4 — Transport TLS, Secrets & Data Sanitization (Phase 4)**
  - `SC-401`: Provision CA/server TLS certs, enable PG `ssl=on` + tighten `pg_hba.conf` (`hostssl`, drop TCP `trust`), configure `database.ts` & scripts `DB_SSL_MODE=verify-full`, configure Nginx `:443 ssl` + HSTS + Redis TLS/auth.
  - `SC-402`: Remove `docker-compose.yml` production secret fallbacks, rotate compromised/demo admin & agent credentials, hash `approvals.token_hash`, encrypt & mask `organization_alert_settings`, fix 500 error leaks, HTML escaping, log/URL token masking, `AuditService` redaction regex, and schedule retention jobs.

---

## 12. Migration and Rollback Plan

### 12.1 Zero-Downtime Staged Rollout Sequence
1. **Pre-Flight Backup (`Required Gate`):** Run full `pg_dump -Fc` + schema dump on target DB; verify restore to an isolated scratch DB before running any Sprint C DDL.
2. **Migration Governance Baseline:** Deploy `schema_migrations` table and `--baseline` existing already-applied files (`00`..`28`) cleanly without re-executing `00_` seed updates or `05/10/12/13/26` destructive statements. Reconcile `alert_rules`, `alert_events`, `alert_event_history` via `CREATE TABLE IF NOT EXISTS`.
3. **App Query Fixes (SC-101):** Deploy SQL tenant filters & null-scope rejections immediately (100% backward compatible with existing schema).
4. **Schema Prep & Dual-Write Denormalization (SC-201):** Add nullable `organization_id` to target indirect tables -> backfill deterministically -> quarantine/resolve PO-approved NULL orphans -> verify 0 NULLs -> add `NOT NULL` + FKs + indexes (`CREATE INDEX CONCURRENTLY` where needed).
5. **Role & RLS Cutover (SC-202/203):**
   - Step A: Create `selfheal_migrator` & `selfheal_app`; transfer ownership safely inside maintenance window or staged grant; deploy `withTenantTx` helpers so app sets GUCs on every transaction while testing under `selfheal_app`.
   - Step B: Enable RLS in staging first; run full API, worker, WS, and negative cross-tenant RLS test suites.
   - Step C: Enable & `FORCE ROW LEVEL SECURITY` in production.
6. **PostgreSQL TLS Dual-Mode Cutover (SC-401):**
   - Step A: Mount certs and enable PG `ssl = on`, keeping both `hostssl` and temporary `host` in `pg_hba.conf`.
   - Step B: Update `Main_backend` (`DB_SSL_MODE=verify-full`) and Nginx `:443 ssl`; verify `pg_stat_ssl` shows `ssl = t` for 100% of app connections.
   - Step C: Switch `pg_hba.conf` to `hostssl` only and remove TCP `trust`.
7. **Refresh Token Cutover (SC-301..303):** Requires HTTPS/Nginx `:443` active in production so `Secure` cookies work; deploy schema (`user_sessions`, `refresh_tokens`, `users.token_version`) -> deploy backend supporting short access JWT + refresh cookie -> deploy Frontend interceptor; existing 7d JWTs either expire naturally with `token_version` validation or require clean re-login per PO decision.

### 12.2 Rollback Strategy
- **Code / Application Rollback:** Retain previous tagged Docker images; if `withTenantTx` or refresh rotation fails verification, revert image tag (additive `user_sessions` / `refresh_tokens` / `organization_id` columns are harmless to N-1 code if `NOT NULL` constraints aren't prematurely enforced on columns N-1 doesn't populate!).
- **RLS Emergency Rollback:** Disable policy enforcement without data loss via a signed maintenance script (`ALTER TABLE ... DISABLE ROW LEVEL SECURITY`) rather than reverting data; keep app-level SC-101 filters active as baseline.
- **PG TLS Rollback:** Switch `pg_hba.conf` back to dual-mode (`host` + `hostssl`) and `DB_SSL_MODE=require`/`disable` while diagnosing cert mismatch, without touching data volumes.
- **Schema Rollback:** Every destructive or data-changing Sprint C migration ships with an explicit tested `*.down.sql` or point-in-time `pg_restore` runbook (verified prior to deploy). Never wrap DDL that cannot be rolled back inside unbacked production runs (`cd.yml`).

---

## 13. Dependencies

- **Technical Order Dependencies:**
  - `SC-E02` (Backup/Restore) + `SC-E01` (`schema_migrations`) **MUST precede** any Sprint C schema/role/RLS migration.
  - `SC-A03` (Orphan resolution + `organization_id` denormalization + FKs) **MUST precede** strict `FORCE ROW LEVEL SECURITY` (`SC-A02`).
  - `SC-D01` (Nginx HTTPS `:443 ssl`) **MUST precede or land with** `SC-B01` production rollout (`HttpOnly; Secure` refresh cookies will not be stored by browsers over HTTP in production!).
  - `SC-B02` (Redis HA / fail-closed posture + WebSocket event pub/sub) supports immediate WS termination on token/session revocation in `SC-B01`.
- **Cross-Component Dependencies:**
  - `Main_backend` <-> `PostgreSQL`: role swap, GUC transaction wrappers, `ssl` pool options.
  - `Main_backend` <-> `Frontend`: `15m` JWT + `/auth/refresh` cookie + CSRF token + `AuthContext.logout` + `PersonalSecurityPage` real API integration.
  - `Main_backend` <-> `Agent`: `agent_tokens` seed cleanup & rotation impacts any running K8s demo agents (`captone-agent-default`); WebSocket URL tokens (`?token=`) should transition strictly to `Authorization`/header or ticket once Agent installer matches.
  - `Ops / CI-CD`: `cd.yml`, `docker-compose*.yml`, `k8s/*.yaml`, and Nginx cert provisioning (`cert-manager` / Let's Encrypt / internal CA).

---

## 14. Open Questions for Product Owner

Phase 1+ design choices below require explicit Product Owner decision before coding:

1. **Orphan / `NULL` Tenant Records Policy:** How should existing rows with `organization_id IS NULL` or missing parent links (`incidents`, `logs`, `kubernetes_events`, `workloads`, `agents`, `agent_metrics` incl. `agent-snapshot`, `node_metrics`) be handled — **backfill to a default/reconciled org**, **archive & delete**, or **quarantine to a platform bucket**?
2. **Global vs. Tenant `SUPER_ADMIN` / `ADMIN` Visibility Under RLS:** Should platform admin endpoints (`adminDashboard`, `adminAnalytics`, `audit_logs`, global cluster/incident lists) view cross-tenant **aggregates only** (recommended via `SECURITY DEFINER` views) or **raw per-tenant operational rows** via an audited `PLATFORM_ADMIN` RLS scope? (Consistent with Sprint B rule: `SUPER_ADMIN` still needs explicit membership for `/organizations/:id/*` APIs.)
3. **`audit_logs` Retention vs. Immutability:** Should `auditRetention.worker.ts` permanently `DELETE` old rows after 90 days (requiring retention-role delete privilege under RLS), or archive to cold encrypted storage before purge while keeping `audit_logs` append-only (`NO UPDATE/DELETE`) for `selfheal_app`?
4. **`ai_models` Scope:** Does `ai_models` stay a `GLOBAL` platform-managed ML registry (read-only for all tenants), or are tenant-specific custom uploaded models planned (which would require nullable/scoped `organization_id`)?
5. **Session & Refresh Token TTL Policy + Existing Session Cutover:** Approve Access JWT TTL (`15m` recommended), Refresh Token idle/absolute lifetime (`7d` idle / `30d` max), concurrency policy (`0s` strict reuse detection + tab sync vs short grace window), and whether Sprint C deployment will **force re-login of all existing 7-day JWT users** (`token_version` bump / secret rotation).
6. **Agent Token Rotation & Migration Cleanup:** Approve removing hardcoded demo credentials/tokens (`superadmin@selfheal.com`, `admin@selfheal.com`, 4 `captone-agent-default` demo tokens) from `00_init_full_database.sql` and rotating all existing dev/staging/prod secrets on rollout.
7. **Deployment Target Priority for TLS & Backups:** Confirm whether Sprint C targets **Docker Compose VPS (`docker-compose.prod.yml`) first**, **Kubernetes (`k8s/`) first**, or both in parity (determining `cert-manager` vs OpenSSL/Let's Encrypt and off-host backup destination).
8. **Notification Webhook/Secret Policy (`organization_alert_settings`):** Confirm once `slack_webhook_url` and `pagerduty_key` are encrypted at rest and masked on read (`****1234`), UI users only re-enter new keys on edit rather than viewing existing plaintext keys.

---

## 15. Recommended Implementation Order

1. **Sprint C — Phase 1: Safety Net & Application Tenant Plug (Zero Breaking Changes)**
   - Implement `SC-E02` (backup/restore scripts + `cd.yml` safety gate removing `|| true`) and `SC-E01` (`schema_migrations`, advisory lock, TX runner, extract seeds, restore `alert_*` migrations).
   - Land `SC-101` (all confirmed SQL cross-tenant bug fixes in `agentWebSocket`, `healingAction.model`, `telemetryPipeline`, `telemetryAggregator`, `telemetryWebSocket`, `ai.service`, `recoveryVerification`, `healingAction.controller`, `logStream`, `statistics`, `log/workload/cluster` models) + `SC-E04` error/log sanitization.
2. **Sprint C — Phase 2: Database Role Separation & Row-Level Security (Design A)**
   - Execute PO-approved orphan backfill/cleanup, denormalize `organization_id` + FKs + indexes, drop runtime `ALTER TABLE`.
   - Deploy `selfheal_migrator` + `selfheal_app` (`NOBYPASSRLS`), `withTenantTx` GUC wrappers, worker org-iteration loops, and staged `ENABLE` + `FORCE ROW LEVEL SECURITY` backed by automated negative cross-tenant RLS tests.
3. **Sprint C — Phase 3: TLS Everywhere (Design C) & Refresh Token Lifecycle (Design B)**
   - Land PostgreSQL TLS (`ssl=on`, `hostssl`, `verify-full`) + Nginx HTTPS `:443 ssl` + Redis auth/TLS + secret cleanup (`SC-401`, `SC-402`).
   - With HTTPS operational, land `user_sessions` + rotating hashed refresh tokens in `HttpOnly; Secure; SameSite=Lax` cookies, CSRF protection, `15m` Access JWT, `token_version` global revocation, WebSocket live kick, Redis rate limiters, and Frontend `AuthContext` / `apiClient` / `PersonalSecurityPage` updates.
4. **Sprint C — Phase 4: End-to-End Verification & Closure**
   - Run full regression, negative RLS bypass checks, refresh reuse-detection & concurrency tests, TLS `verify-full` & `ssl=off` rejection tests, and live `pg_dump` -> `pg_restore` drill before sign-off.

---

## Final Readiness Sign-Off

**Status:** **`READY WITH CONDITIONS`**  
Phase 0 audit is complete with zero workspace, database, or container mutations. Proceed to Sprint C Phase 1 once the Product Owner reviews and confirms the open decisions in Section 14.
