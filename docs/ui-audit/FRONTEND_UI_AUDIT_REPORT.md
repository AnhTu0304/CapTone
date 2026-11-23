# Frontend UI Audit Report — AI-Driven Proactive Self-Healing Infrastructure for SMEs

**Audit Date:** November 22, 2026  
**Scope:** Strictly read-only static source-code audit of `Frontend/src/` and `Frontend/public/` (zero source modifications, zero package installs)  
**Target Document:** Foundation package for the official *User Interface Design Document* (`C2SE.29` / UID standard format)

---

## 1. Executive Summary

The frontend of **AI-Driven Proactive Self-Healing Infrastructure for SMEs** (branded across the UI as **SelfHeal** / **SelfAI Admin** / **SelfAI User**) is a React 19 Single-Page Application (`Frontend/package.json`) built with a custom `window.history.pushState` + `RouteRenderer` router (`Frontend/src/App.js`, `Frontend/src/routes/index.jsx`), `lucide-react` icons, TradingView `lightweight-charts` v5, `gsap`, `three` (legacy/orphaned components), and `exceljs` for multi-sheet `.xlsx` reporting.

### Key Quantitative Findings
- **Active Application Routes Discovered:** **83 distinct URL paths** (including primary routes, aliases, dynamic detail routes, and error/status routes) across **7 functional portals/groups**.
- **Active Pages & Sub-Views Inspected:** **62 routed page/step views** (+ **41+ interactive modals, slide-over drawers, and confirmation dialogs**).
- **Orphaned / Unreachable Page & UI Files Discovered:** **49 files** exist in `Frontend/src/` without active production routing (including `PredictionsPage.jsx`, `SelfHealingHubPage.jsx`, `ApmPage.jsx`, `LogsAndEventsPage.jsx`, `AlertHistoryPage.jsx`, `DocsLayout.jsx`, `AdminWebsiteDashboard.jsx`, `AIPredictionsTable.jsx`, `AIRCASection.jsx`, `AIPerformanceView.jsx`, `AgentTable.jsx`, and 12 legacy 3D/Canvas files in `pages/Features/components/`).
- **User Roles Verified in Implementation:** **6 actual role levels** — Platform roles (`SUPER_ADMIN`, `ADMIN`/`SYSTEM_ADMIN`, `USER`) and Tenant Organization roles (`SME_OWNER`, `DEVOPS`, `VIEWER`) — governed by `AuthContext.jsx`, `routes/index.jsx`, `usePermissions.js`, and role-filtered sidebars (`AdminSidebar.jsx`, `Sidebar.jsx`).
- **Dual Visual Design System:**
  1. **Greptile Precision Blueprint** (`design-tokens.css`, `globals.css`) — `#EEEEEE` canvas, `#3D3B4F` navy, `#28E99F` mint, `0px` radii, dashed gridlines — used by Public, Legal, Auth, and Onboarding.
  2. **White-First Calm Operations** (`dashboard-tokens.css`) — `#F8FAFC` canvas, `#FFFFFF` surfaces, `#059669` soft emerald, `6px–18px` radii, subtle elevation — used by SME Dashboard, Admin Portal, and Personal Portal.
- **API vs. Mock Transparency:** Core SME operational modules (`Overview`, `Clusters`, `Monitoring`, `Incidents/RCA`, `Self-Healing`, `Alerts`, `Reports`, `Audit Logs`, `Settings`) and Admin core modules (`Users`, `Roles`, `Analytics`, `Broadcast`, `Monitoring`, `Clusters`, `AI Registry`) integrate with **real backend REST/WebSocket/SSE endpoints**. However, several modules rely on **mock data, client-side estimation, or `localStorage`-only persistence** (e.g., `ContactPage`, `PersonalPreferencesPage`, `PersonalSecurityPage` password change & active sessions, `AdminAccountSettingsPage`, `AdminSystemSettingsPage` save buttons, `AdminInfrastructurePage` nodes/workloads, `AdminIncidents` detail/timeline/healing actions, `AdminAgentManagementPage` ping test).

---

## 2. Frontend Architecture & Source Structure

### 2.1 Technology Stack (`Frontend/package.json`)
- **Framework:** `react@^19.3.0`, `react-dom@^19.3.0`, `react-scripts@5.0.1`
- **Routing:** Custom SPA history router in `Frontend/src/App.js` + `Frontend/src/routes/index.jsx` (`react-router-dom@^7.18.4` is installed in `package.json` but **not used** as the root router)
- **Icons & Visualization:** `lucide-react@^1.46.0`, `lightweight-charts@^5.2.1`, `gsap@^3.15.0`, `@gsap/react@^2.1.2`, `three@^0.186.0`
- **Export & Utilities:** `exceljs@^4.4.0`, Canvas 2D chart PNG rendering (`utils/reportExcelExport.js`)

### 2.2 Directory & Layer Breakdown (Non-Test Source Files)

| Directory | File Count | Purpose |
|---|---:|---|
| `src/pages/` | 165 | Page-level modules across Public, Auth, Onboarding, Personal, Dashboard, Admin, and Error/Status |
| `src/components/` | 142 | Reusable UI components grouped by `admin/`, `auth/`, `common/`, `dashboard/`, `layout/`, `marketing/`, `mascot/`, `navigation/`, `onboarding/`, `personal/` |
| `src/services/` | 33 | HTTP/WS/SSE API clients (`apiClient.js`, `authService.js`, `multiTabSync.js`, 11 `admin*Service.js`, 19 tenant/core services) |
| `src/hooks/` | 7 | `usePermissions.js`, `useK8sResourcePolling.js`, `useDebounce.js`, `useScrollHeader.js`, `useScrollSpy.js`, plus unused `useMockProfile.js` & `useMockNotifications.js` |
| `src/layouts/` | 6 | `PublicLayout`, `AuthLayout`, `DashboardLayout`, `AdminLayout`, `PersonalPortalLayout`, and orphaned `DocsLayout` |
| `src/context/` | 3 | `AuthContext.jsx`, `OnboardingContext.jsx`, `ToastContext.jsx` (plus `pages/Dashboard/context/DashboardContext.jsx`) |
| `src/styles/` | 3 | `design-tokens.css`, `dashboard-tokens.css`, `globals.css` (plus root `index.css` & unused `App.css`) |
| `src/utils/` | 5 | `apmChartUtils.js`, `exportUtils.js`, `k8sServiceFilter.js`, `nodeMetricsChartUtils.js`, `reportExcelExport.js` |
| `src/mocks/` | 2 | `notificationMockData.js`, `profileMockData.js` |
| `src/routes/` | 1 | `index.jsx` (`ROUTES` constants & `RouteRenderer` RBAC dispatcher) |
| `src/lib/` | 1 | `animations.js` (GSAP page fade-in & card hover helpers) |

### 2.3 Authentication, Session & API Layer
- **Entry & Providers (`src/index.js`, `src/App.js`):** Imports `suppressExtensionErrors.js` first, wraps app in `ToastProvider` -> `AuthProvider` -> `RouteRenderer`. Listens to `popstate` and custom `selfheal:http-status` (redirects to `/503` with warning toast on HTTP 503).
- **Token Security (`src/services/apiClient.js`, `src/context/AuthContext.jsx`):** Access tokens are held **in-memory (RAM) only** (actively clears legacy `selfheal_auth_token` from `localStorage`). Session restoration uses HttpOnly refresh cookies + Double-Submit CSRF header (`X-CSRF-Token` from `selfheal_csrf_token` cookie) with single-flight `POST /api/v1/auth/refresh` rotation. Multi-tenant API calls attach `X-Organization-Id` and abort in-flight requests on organization switch.
- **Cross-Tab Synchronization (`src/services/multiTabSync.js`):** Synchronizes `AUTH_LOGOUT`, `AUTH_LOGIN`, `SESSION_REVOKED`, and `ORG_SWITCHED` via `BroadcastChannel('selfheal_multitab_bus')` with `localStorage` fallback.
- **API Base URL:** Defaults to `http://127.0.0.1:5005/api/v1` (normalizes legacy port `5000` -> `5005`). `executeWithFallback()` blocks mock fallbacks in production and on `401`/`403`/`AbortError`.

---

## 3. Master Route Inventory (Phase 1)

| No. | Route | Page Name | Role | Access Type | Layout | Implementation Status |
|---:|---|---|---|---|---|---|
| 1 | `/` | Home / Landing Page | Public (All) | Public | `PublicLayout` | Implemented (Static Marketing) |
| 2 | `/features` | Features & Self-Healing Lifecycle | Public (All) | Public | `PublicLayout` (Full-bleed) | Implemented (Static + 2D Canvases) |
| 3 | `/guide` | SRE Operations Handbook | Public (All) | Public | `PublicLayout` (Full-bleed) | Implemented (Static Docs) |
| 4 | `/docs` | SRE Operations Handbook (Alias) | Public (All) | Public | `PublicLayout` (Full-bleed) | Alias -> `GuidePage` |
| 5 | `/about` | About SelfHeal | Public (All) | Public | `PublicLayout` (Full-bleed) | Implemented (Static Editorial) |
| 6 | `/contact` | Contact Sales / Consultation | Public (All) | Public | `PublicLayout` | Partial (Simulated `setTimeout` submit, no API) |
| 7 | `/terms` | Terms of Service | Public (All) | Public | `PublicLayout` (Full-bleed) | Implemented (Static Legal) |
| 8 | `/privacy` | Privacy Policy | Public (All) | Public | `PublicLayout` (Full-bleed) | Implemented (Static Legal) |
| 9 | `/security` | Security Practices | Public (All) | Public | `PublicLayout` (Full-bleed) | Implemented (Static Legal) |
| 10 | `/security-practices` | Security Practices (Alias) | Public (All) | Public | `PublicLayout` (Full-bleed) | Alias -> `SecurityPracticesPage` |
| 11 | `/login` | Login (+ 2FA OTP Step) | Public / Unauth Redirect | Public | `AuthLayout` | Implemented (Real API + Google OAuth2 + 2FA) |
| 12 | `/get-started` | Login (Alias) | Public (All) | Public | `AuthLayout` | Alias -> `LoginPage` |
| 13 | `/register` | Register (+ 6-Digit Email OTP) | Public (All) | Public | `AuthLayout` | Implemented (Real API; GSI script defect on direct load) |
| 14 | `/forgot-password` | Forgot Password | Public (All) | Public | `AuthLayout` | Implemented (Real API; resend cooldown timer bug) |
| 15 | `/reset-password` | Reset Password (`?token=`) | Public (Token-gated) | Public | `AuthLayout` | Implemented (Real API; English-only copy) |
| 16 | `/onboarding`, `/onboarding/` | Onboarding Step 1 (Default) | All Authenticated | Protected | `OnboardingLayout` | Hybrid (Real slug check API; local defer to Step 4) |
| 17 | `/onboarding/organization` | Onboarding Step 1 — Organization | All Authenticated | Protected | `OnboardingLayout` | Hybrid (Real slug check API; local defer to Step 4) |
| 18 | `/onboarding/environment` | Onboarding Step 2 — Environment | All Authenticated | Protected | `OnboardingLayout` | Partial (Local context; DB create deferred to Step 4) |
| 19 | `/onboarding/kubernetes` | Onboarding Step 3 — Kubernetes | All Authenticated | Protected | `OnboardingLayout` | Hybrid (Real token rotation API; local cluster save) |
| 20 | `/onboarding/verify-agent` | Onboarding Step 4 — Verify Agent | All Authenticated | Protected | `OnboardingLayout` | Real API (4-step DB persist + sandbox fallback) |
| 21 | `/onboarding/complete` | Onboarding Step 5 — Complete | All Authenticated | Protected | `OnboardingLayout` | Implemented (Context handoff + mock fallback counts) |
| 22 | `/portal`, `/portal/dashboard` | Personal Dashboard | All Authenticated | Protected | `PersonalPortalLayout` | Hybrid (5 real APIs + `localStorage` fallback) |
| 23 | `/user`, `/personal`, `/me` | Personal Dashboard (Aliases) | All Authenticated | Protected | `PersonalPortalLayout` | Aliases -> `PersonalDashboardPage` |
| 24 | `/portal/companies` | My Companies & Invitations | All Authenticated | Protected | `PersonalPortalLayout` | Hybrid (List/Create/Accept = Real API; Reject/Leave = `localStorage`) |
| 25 | `/portal/profile` | Personal Profile | All Authenticated | Protected | `PersonalPortalLayout` | Hybrid (`GET/PUT /users/me` + local `department`/`bio`) |
| 26 | `/profile`, `/dashboard/profile`, `/admin/profile` | Personal Profile (Aliases) | All Authenticated | Protected | `PersonalPortalLayout` | Aliases -> `PersonalProfilePage` |
| 27 | `/portal/security` | Account Security & 2FA | All Authenticated | Protected | `PersonalPortalLayout` | Hybrid (2FA & Login History = Real API; Password Change & Sessions = Local/Mock) |
| 28 | `/portal/preferences` | Personal Preferences | All Authenticated | Protected | `PersonalPortalLayout` | Mock / `localStorage`-only (theme/lang not wired globally) |
| 29 | `/portal/notifications` | Personal Notifications | All Authenticated | Protected | `PersonalPortalLayout` | Hybrid (Real API + `localStorage` cache; settings local-only) |
| 30 | `/portal/activity` | Personal Activity History | All Authenticated | Protected | `PersonalPortalLayout` | Real API (`GET /users/me/activities` + CSV export) |
| 31 | `/portal/help` | Personal Help & FAQ | All Authenticated | Protected | `PersonalPortalLayout` | Implemented (Static docs & FAQ data) |
| 32 | `/dashboard`, `/dashboard/` | SME Overview (AI Pipeline Canvas) | SUPER_ADMIN, ADMIN, SME_OWNER, DEVOPS, VIEWER | Protected (Tenant) | `DashboardLayout` (Full-bleed) | Implemented (100% Real API + WebSocket + 4s poll) |
| 33 | `/dashboard/organization` | Organization Profile | SUPER_ADMIN, ADMIN, SME_OWNER | Protected (RBAC) | `DashboardLayout` | Implemented (100% Real API; DEVOPS/VIEWER 403) |
| 34 | `/dashboard/organization/members` | Organization Members & RBAC | SUPER_ADMIN, ADMIN, SME_OWNER | Protected (RBAC) | `DashboardLayout` | Real API + silent `localStorage` fallback (DEVOPS/VIEWER 403) |
| 35 | `/dashboard/clusters` | Kubernetes Clusters List | SUPER_ADMIN, ADMIN, SME_OWNER, DEVOPS | Protected (RBAC) | `DashboardLayout` | Implemented (100% Real API; VIEWER 403) |
| 36 | `/dashboard/clusters/:id` | Cluster Detail & Agent Config | SUPER_ADMIN, ADMIN, SME_OWNER, DEVOPS | Protected (RBAC) | `DashboardLayout` | Implemented (100% Real API + 12s/20s polling; VIEWER 403) |
| 37 | `/dashboard/infrastructure` | Infrastructure Nodes | SUPER_ADMIN, ADMIN, SME_OWNER, DEVOPS, VIEWER* | Protected (Tenant) | `DashboardLayout` | Partial Real API (Client-estimated CPU/RAM; *VIEWER Drain RBAC bug) |
| 38 | `/dashboard/workloads` | Workloads & Pods | SUPER_ADMIN, ADMIN, SME_OWNER, DEVOPS, VIEWER | Protected (Tenant) | `DashboardLayout` | Partial Real API (3s poll; client-estimated CPU/RAM; VIEWER read-only) |
| 39 | `/dashboard/agents` | eBPF Agents Management | SUPER_ADMIN, ADMIN, SME_OWNER, DEVOPS, VIEWER | Protected (Tenant) | `DashboardLayout` | Partial Real API (Static heartbeat/footprint strings when ONLINE) |
| 40 | `/dashboard/monitoring/metrics` | Node Metrics Flow Canvas | All Authenticated SME Roles | Protected (Tenant) | `DashboardLayout` (Full-bleed) | Implemented (Real API + 20s poll + `lightweight-charts` v5) |
| 41 | `/dashboard/monitoring/logs` | System & Container Logs | All Authenticated SME Roles | Protected (Tenant) | `DashboardLayout` | Implemented (100% Real API + Fetch SSE Live Tail) |
| 42 | `/dashboard/monitoring/events` | Kubernetes Cluster Events | All Authenticated SME Roles | Protected (Tenant) | `DashboardLayout` | Implemented (100% Real API) |
| 43 | `/dashboard/alerts` | Alerts & Threshold Rules | All Authenticated SME Roles | Protected (Tenant) | `DashboardLayout` | Implemented (Real API + WS; **unlinked in Sidebar/TopHeader**) |
| 44 | `/dashboard/incidents` | Incidents & RCA | All Authenticated SME Roles | Protected (Tenant) | `DashboardLayout` | Implemented (100% Real API + 15s poll; no RBAC gate on Resolve) |
| 45 | `/dashboard/self-healing`, `/dashboard/self-healing/actions` | Live Self-Healing Actions (MAPE-K) | All Authenticated SME Roles | Protected (Tenant) | `DashboardLayout` | Implemented (Real API + WS; Abort gated by `POLICY_MANAGE`) |
| 46 | `/dashboard/self-healing/history` | Self-Healing Action History | All Authenticated SME Roles | Protected (Tenant) | `DashboardLayout` | Implemented (Real API; status pill filter enum mismatch bug) |
| 47 | `/dashboard/self-healing/approvals` | HITL Approvals Gate | SUPER_ADMIN, ADMIN, SME_OWNER, DEVOPS | Protected (RBAC) | `DashboardLayout` | Real API + WS (VIEWER 403; DEVOPS read-only except YAML modal gap) |
| 48 | `/dashboard/self-healing/policies` | Self-Healing Policies & Guards | SUPER_ADMIN, ADMIN, SME_OWNER, DEVOPS | Protected (RBAC) | `DashboardLayout` | Hybrid (Policies = Real API; Global Mode/Guards = `localStorage` + sync) |
| 49 | `/dashboard/reports` | SLA Reports & Multi-Format Export | All Authenticated SME Roles | Protected (Tenant) | `DashboardLayout` | Implemented (100% Real API; VIEWER export locked) |
| 50 | `/dashboard/audit-logs` | Tenant Immutable Audit Logs | All Authenticated SME Roles | Protected (Tenant) | `DashboardLayout` | Implemented (100% Real API; export limited to current page) |
| 51 | `/dashboard/notifications`, `/notifications` | Tenant Notifications Center | All Authenticated SME Roles | Protected (Tenant) | `DashboardLayout` | Hybrid (Real API + WS + `notificationMockData` initial seed) |
| 52 | `/dashboard/settings` | Emergency Alert Settings | SUPER_ADMIN, ADMIN, SME_OWNER | Protected (RBAC) | `DashboardLayout` | Implemented (100% Real API; DEVOPS/VIEWER 403) |
| 53 | `/admin`, `/admin/overview` | Admin Platform Overview | SUPER_ADMIN, ADMIN, DEVOPS, VIEWER | Protected (Admin) | `AdminLayout` | Real API + Fallback + Synthesized Chart History (SME_OWNER -> `/dashboard`) |
| 54 | `/admin/companies`, `/admin/organizations` | Admin Organizations List | SUPER_ADMIN, ADMIN (*gap: `/organizations` open to SME_OWNER/DEVOPS) | Protected (Admin) | `AdminLayout` | Real API with dev mock fallback |
| 55 | `/admin/companies/:id`, `/admin/organizations/:id` | Admin Organization Details | SUPER_ADMIN, ADMIN (*same `/organizations` gap) | Protected (Admin) | `AdminLayout` | Real API with multi-layer mock fallback |
| 56 | `/admin/users`, `/admin/members` | Admin Users Management | SUPER_ADMIN, ADMIN | Protected (Admin) | `AdminLayout` | Implemented (100% Real API; drawer/modal z-index bug) |
| 57 | `/admin/roles` | Admin Roles & RBAC Matrix | **SUPER_ADMIN Only** | Protected (Super Admin) | `AdminLayout` | Implemented (Real API + static matrix; ADMIN gets 403) |
| 58 | `/admin/activity` | Admin User Activity Tracking | SUPER_ADMIN, ADMIN (*gap: reachable by VIEWER/SME_OWNER/DEVOPS) | Protected (Admin) | `AdminLayout` | Real API with dev mock fallback |
| 59 | `/admin/analytics` | Admin Growth Analytics | SUPER_ADMIN, ADMIN (*gap: SME_OWNER/DEVOPS not blocked) | Protected (Admin) | `AdminLayout` | Implemented (100% Real API + CSV export) |
| 60 | `/admin/notifications` | Admin Network Broadcast Center | SUPER_ADMIN, ADMIN, DEVOPS (*gap: SME_OWNER not blocked) | Protected (Admin) | `AdminLayout` | Implemented (100% Real API; no delete confirm) |
| 61 | `/admin/agents`, `/admin/infrastructure/agents` | Admin Agents Management | SUPER_ADMIN, ADMIN, DEVOPS (*gap: SME_OWNER not blocked) | Protected (Admin) | `AdminLayout` | Partial Real API (Ping test 100% mock; shadows `AdminInfrastructurePage` agents) |
| 62 | `/admin/clusters`, `/admin/infrastructure/clusters` | Admin Cluster Overview | SUPER_ADMIN, ADMIN, DEVOPS (*gap: SME_OWNER not blocked) | Protected (Admin) | `AdminLayout` | Implemented (100% Real API; shadows `AdminInfrastructurePage` clusters) |
| 63 | `/admin/infrastructure` | Admin Unified Infrastructure (Clusters) | SUPER_ADMIN, ADMIN, DEVOPS (*gap: SME_OWNER) | Protected (Admin) | `AdminLayout` | Partial / Mock (Direct URL only; row actions = fake toasts) |
| 64 | `/admin/infrastructure/nodes`, `/admin/nodes` | Admin Infrastructure — Nodes | SUPER_ADMIN, ADMIN, DEVOPS (*gap: SME_OWNER) | Protected (Admin) | `AdminLayout` | **100% Mock** (Direct URL only) |
| 65 | `/admin/infrastructure/workloads`, `/admin/workloads` | Admin Infrastructure — Workloads | SUPER_ADMIN, ADMIN, DEVOPS (*gap: SME_OWNER) | Protected (Admin) | `AdminLayout` | **100% Mock** (Direct URL only) |
| 66 | `/admin/monitoring` | Admin System Monitoring | SUPER_ADMIN, ADMIN, DEVOPS (*gap: SME_OWNER) | Protected (Admin) | `AdminLayout` | Implemented (100% Real API — 4 core subsystems + AI telemetry) |
| 67 | `/admin/alerts` | Admin Platform Alerts | SUPER_ADMIN, ADMIN, DEVOPS (*gap: SME_OWNER) | Protected (Admin) | `AdminLayout` | Hybrid (Real API + 30s poll + mock fallback; Threshold modal = `localStorage`) |
| 68 | `/admin/incidents` | Admin Incidents List | SUPER_ADMIN, ADMIN, DEVOPS (*gap: SME_OWNER) | Protected (Admin) | `AdminLayout` | **Broken on Live API** (`recoveryDuration` undefined crash; works only on mock) |
| 69 | `/admin/incidents/:id` | Admin Incident Detail (8-Stage) | SUPER_ADMIN, ADMIN, DEVOPS (*gap: SME_OWNER) | Protected (Admin) | `AdminLayout` | **Mock-only IDs** (Real UUIDs 404; HITL CTA links to 404 `/admin/approvals`) |
| 70 | `/admin/ai`, `/admin/ai/overview` | Admin AI Overview | SUPER_ADMIN, ADMIN, DEVOPS (*gap: SME_OWNER) | Protected (Admin) | `AdminLayout` | Implemented (100% Real API) |
| 71 | `/admin/ai/models` | Admin AI Model Registry | SUPER_ADMIN, ADMIN, DEVOPS (*gap: SME_OWNER) | Protected (Admin) | `AdminLayout` | Implemented (100% Real API; `canManageModels` `|| true` bypass) |
| 72 | `/admin/ai/comparison` | Admin AI Model Comparison & Rollback | SUPER_ADMIN, ADMIN, DEVOPS (*gap: SME_OWNER) | Protected (Admin) | `AdminLayout` | Implemented (Real API; raw LaTeX `$\Delta$`/`$\rightarrow$` text bugs) |
| 73 | `/admin/ai/predictions`, `/admin/ai/rca`, `/admin/ai/performance` | Admin AI Redirected Aliases | SUPER_ADMIN, ADMIN, DEVOPS (*gap: SME_OWNER) | Protected (Admin) | `AdminLayout` | **Shadowed** -> hardcoded to `models` tab (dedicated components orphaned) |
| 74 | `/admin/self-healing`, `/admin/self-healing/actions` | Admin Self-Healing Actions | SUPER_ADMIN, ADMIN, DEVOPS (*gap: SME_OWNER) | Protected (Admin) | `AdminLayout` | Real API + Mock fallback (filter param mismatch; `/admin/approvals` 404 link) |
| 75 | `/admin/self-healing/action-types` | Admin Self-Healing Action Catalog | SUPER_ADMIN, ADMIN, DEVOPS (*gap: SME_OWNER) | Protected (Admin) | `AdminLayout` | Real API + Mock fallback (Direct URL only) |
| 76 | `/admin/self-healing/policies`, `/admin/policies` | Admin Self-Healing Policies | SUPER_ADMIN, ADMIN, DEVOPS (*gap: SME_OWNER) | Protected (Admin) | `AdminLayout` | Real API + Mock fallback (`updatePolicyConfig` drops `activeStatus`/`Dry-Run`) |
| 77 | `/admin/self-healing/analytics` | Admin Self-Healing Analytics | SUPER_ADMIN, ADMIN, DEVOPS (*gap: SME_OWNER) | Protected (Admin) | `AdminLayout` | Real API + Mock fallback (Direct URL only) |
| 78 | `/admin/audit-logs` | Admin Immutable Audit Logs (SHA-256) | SUPER_ADMIN, ADMIN, DEVOPS (*gap: SME_OWNER) | Protected (Admin) | `AdminLayout` | Real API + Mock fallback + Synthesized KPIs (sort params omitted in API call) |
| 79 | `/admin/settings`, `/admin/system-settings` | Admin System Settings | **SUPER_ADMIN Only** | Protected (Super Admin) | `AdminLayout` | **Mostly Mock** (only Retention Stats/Purge & Tab 6 Audit Logs call API; `${retentionStats.*}` JSX bug) |
| 80 | `/admin/account-settings` | Admin Account Settings | All Admin-Area Roles (*gap: reachable by VIEWER) | Protected (Admin) | `AdminLayout` | **100% Mock / Client-Only** (unlinked in navigation) |
| 81 | `/401`, `/unauthorized`, `/403`, `/forbidden`, `/404`, `/not-found`, `/429`, `/500`, `/503` | HTTP Error Status Pages (6 variants) | Public / Guard Fallback | Public / System | `PublicLayout` / Standalone / Embedded | Implemented (Static pixel-art; **missing navigation buttons**) |
| 82 | `/maintenance`, `/status/agent-offline`, `/status/cluster-lost`, `/status/monitoring` | Operational Status Pages (4 variants) | Public | Public / System | `PublicLayout` | Implemented (Static pixel-art; **missing navigation buttons**) |
| 83 | `*` (Catch-all & Invalid Sub-Paths) | 404 Not Found (+ Toast Warning) | Public / Auth | Fallback | `PublicLayout` / `AdminLayout` / `DashboardLayout` / `PersonalPortalLayout` | Implemented (Triggers `ToastContext.warning` on `warnPath`) |

---

## 4. Role-Based Page & Permission Inventory (Phase 3)

### 4.1 Role Hierarchy Verified in Code (`AuthContext.jsx` & `usePermissions.js`)
The frontend implements **two layered role scopes**:
1. **Platform System Roles (`AuthContext.jsx`):** `SUPER_ADMIN` > `ADMIN` (`SYSTEM_ADMIN`) > `USER`.
2. **Tenant Organization Roles (`DashboardContext.jsx` + `usePermissions.js`):** `SME_OWNER` > `DEVOPS` > `VIEWER` (with `SUPER_ADMIN` and `ADMIN` bypassing all tenant permission checks via `can()`).

| Role | Primary Workspace | Allowed Portals & Capabilities (Verified in Source) | Explicitly Blocked Routes / Controls |
|---|---|---|---|
| **Super Admin (`SUPER_ADMIN`)** | `/admin` (`AdminLayout`) | Full access to all 14 Admin sidebar items, **exclusive access** to `/admin/roles` and `/admin/settings` (`/admin/system-settings`), full bypass in `/dashboard/*`, `/portal/*`, and `/onboarding/*`. | None. |
| **Admin (`ADMIN` / `SYSTEM_ADMIN`)** | `/admin` (`AdminLayout`) | 12 Admin sidebar items (Overview, Companies, Users, Activity, Analytics, Agents, Clusters, AI Models, Monitoring, Alerts, Audit Logs, Broadcast) + full bypass in `/dashboard/*` and `/portal/*`. Cannot lock `SUPER_ADMIN` or self. | Embedded 403 on `/admin/roles` and `/admin/settings` (`/admin/system-settings`). |
| **SME Owner (`SME_OWNER`)** | `/dashboard` (`DashboardLayout`) | Full access to all SME Dashboard modules: Overview, Organization, Members (`ORG_MANAGE`), Clusters (`ENV_MANAGE` + `ENV_DELETE`), Infrastructure, Workloads, Agents (`AGENT_MANAGE` + `AGENT_DELETE`), Monitoring, Alerts, Incidents, Live Self-Healing, History, **HITL Approvals (`HITL_APPROVE`)**, Policies (`POLICY_MANAGE`), Reports + Multi-Format Export, Audit Logs, Notifications, Emergency Alert Settings (`SETTINGS_MANAGE`), plus `/portal/*` & `/onboarding/*`. | Redirected from `/admin` & `/admin/overview` to `/dashboard`; 403 on `/admin/roles`, `/admin/settings`, `/admin/companies*`, `/admin/users`, `/admin/members`. *(Audit Gap: `/admin/organizations*` and other `/admin/*` technical routes lack explicit block in `routes/index.jsx`.)* |
| **DevOps (`DEVOPS`)** | `/dashboard` (`DashboardLayout`) | Operational access to `/dashboard` (Overview), Clusters (create/rotate/disconnect — no delete), Infrastructure (Nodes + Drain), Workloads (Restart Pod), Agents (Install/Disconnect — no delete), Monitoring (Metrics/Logs/Events), Alerts (full CRUD/ACK/Resolve), Incidents, Live Self-Healing (incl. Abort), History, Policies (`POLICY_MANAGE`), Reports (with Export), Audit Logs, Notifications. Also sees 7 technical items in `AdminSidebar` (`/admin`, `/admin/agents`, `/admin/clusters`, `/admin/ai/models`, `/admin/monitoring`, `/admin/alerts`, `/admin/audit-logs`, `/admin/notifications`). | 403 on `/dashboard/organization*`, `/dashboard/settings`, `/admin/roles`, `/admin/settings`, `/admin/companies*`, `/admin/users`, `/admin/members`. On `/dashboard/self-healing/approvals`, Approve/Reject buttons are disabled via `PermissionGate(HITL_APPROVE)` *(except YAML Diff modal gap)*. Delete Cluster & Delete Agent hidden. |
| **Viewer (`VIEWER`)** | `/dashboard` (`DashboardLayout`) | Read-only access to `/dashboard` (Overview), Workloads (no Restart), Agents (no Disconnect/Delete), Monitoring (Metrics/Logs/Events), Alerts (read-only), Incidents, Live Self-Healing (no Abort), History, Reports (Export disabled with `"Chỉ Đọc (Viewer)"` lock), Audit Logs, Notifications, `/portal/*`, and `/admin` Overview only. | 403 on `/dashboard/organization*`, `/dashboard/clusters*`, `/dashboard/self-healing/policies`, `/dashboard/self-healing/approvals`, `/dashboard/settings`, and `/admin/*` (except `/admin`, `/admin/overview`, `/admin/profile`). *(Audit Gaps: can still trigger Drain on `/dashboard/infrastructure` and access `/admin/activity` & `/admin/account-settings` by direct URL.)* |
| **Standard User (`USER`)** | `/portal` (`PersonalPortalLayout`) | Newly registered user without org membership yet: `/portal/*`, `/onboarding/*`, and `/dashboard` (defaults to `VIEWER` if no org role). | Full-page 403 on `/admin/*`. |

---

## 5. Project-Specific AI Self-Healing Domain Audit (Phase 3)

| Domain Area | Implemented Frontend Modules | Key Capabilities Verified | Mock / Gap Notes |
|---|---|---|---|
| **A. Authentication & Account** | `Login` (+ 2FA), `Register` (+ 6-digit OTP), `ForgotPassword`, `ResetPassword`, `PersonalProfile`, `PersonalSecurity` (2FA QR + Backup Codes), `PersonalPreferences` | Real JWT RAM-only + HttpOnly refresh + CSRF + Google OAuth2 + TOTP 2FA setup/enable/disable + multi-tab logout sync. | `PersonalSecurity` password change & session revoke are `localStorage`/mock; `ForgotPassword` resend cooldown stuck at 30s; `Register` missing GSI script loader; `ResetPassword` in English. |
| **B. Main Dashboard** | `Dashboard/Overview` (`AIPipelineFlowCanvas` + 8 KPIs), `Admin/Overview` (4 KPIs + 4-Pillar Growth Chart + Active AI Engine) | Live 7-stage MAPE-K interactive pan/zoom canvas with 4s polling & WS, clickable 8 glass KPIs, draggable node inspector. | `Admin/Overview` growth chart history is mathematically interpolated from current totals; `AdminWebsiteDashboard` is orphaned. |
| **C. Infrastructure & K8s** | `Onboarding` (5 steps), `Dashboard/Clusters` (+ Detail), `Dashboard/Infrastructure`, `Dashboard/Workloads`, `Dashboard/Agents`, `Admin/Agents`, `Admin/Clusters`, `Admin/Infrastructure` | Cluster registration + one-time token modal + rotate/revoke + 3-OS install guides, live K8s node/pod/deployment polling (3s–20s), Drain Node, Rolling Restart Pod, Agent disconnect/delete. | `Infrastructure`/`Workloads` CPU/RAM estimated client-side; `Agents` heartbeat/footprint hardcoded when ONLINE; `Admin/Infrastructure` Nodes & Workloads are 100% mock; `AgentTable` shadowed. |
| **D. Monitoring & Observability** | `Dashboard/Monitoring/Metrics` (`NodeMetricsFlowCanvas` + 4 synced `lightweight-charts`), `Logs` (Fetch SSE live tail + sensitive masking), `Events`, `Dashboard/Alerts` (+ Drawer & Rule Modal), `Admin/Monitoring` (4 core services), `Admin/Alerts` | Synced CPU/RAM/Disk/Network timeseries (`15m–7d`), live SSE log streaming with overflow banner, K8s events with quick-filter modal, full alert rule CRUD + optimistic locking (`expectedVersion`) + assignment. | `ApmPage`, `LogsAndEventsPage`, `AlertHistoryPage` are orphaned/unreachable; `/dashboard/alerts` has no sidebar/header link; `AlertsPage` says `Auto 15s` but polls every `60s`. |
| **E. Incident Management** | `Dashboard/Incidents` + `RootCauseModal`, `Admin/Incidents` + `IncidentDetailPage` | 4 clickable KPIs, severity/status/service/calendar filters, deep-link `?incident=`, 8-stage lifecycle timeline (Admin), manual resolve (`PATCH /ai/incidents/:id/status`). | `RootCauseModal` Resolve lacks confirmation & RBAC; `Admin/Incidents` crashes on live API data (`recoveryDuration` undefined) and Detail page only works for 4 mock IDs. |
| **F. AI Prediction** | Embedded in `Dashboard/Overview` (`AIPipelineFlowCanvas`), `RootCauseModal` Tab 2 (7 GRU risk heads + 12-step telemetry table), `Admin/AI` (Overview, Model Registry + Upload/Auto-Evaluate + Technical Drawer, Before/After Comparison + Drift + Rollback) | Real Multi-Head GRU risk distribution (`OOM`, `CPU_OVERLOAD`, `DISK_FULL`, `HIGH_LATENCY`, `HTTP_5XX_SPIKE`, `TRAFFIC_OVERLOAD`, `SCALE_DOWN`), live model upload `.pth/.onnx/.pkl` & hot-reload activation, A/B comparison verdict. | Standalone `Dashboard/AI/PredictionsPage.jsx`, `AIPredictionForecastChart.jsx`, `Admin/AIPredictionsTable.jsx`, `AIRCASection.jsx`, and `AIPerformanceView.jsx` are all orphaned/unreachable. |
| **G. Root Cause Analysis (RCA)** | `RootCauseModal` (Tab 1 Diagnosis & SRE Playbook + `kubectl` CLI + Evidence For/Missing + Circuit Breaker), `Admin/IncidentRCA` | Causal chain, verified vs missing evidence checklist, rule engine (`ALLOW`/`BLOCK`), circuit breaker guard, copyable plain-text SRE summary & JSON. | `Admin/IncidentRCA` uses mock data fallback for mock incident IDs. |
| **H. Self-Healing & Remediation** | `Dashboard/SelfHealing` (`HealingActions`, `ActionHistory` + `ActionDetailModal`, `Policies` + `NewPolicyModal` + `PolicyDetailModal`), `Admin/SelfHealing` (Actions, Catalog, Policies, Analytics) | **10 verified action codes in frontend:** `RESTART_POD`, `REPLACE_POD`, `SCALE_REPLICAS` (`SCALE_UP`/`SCALE_DOWN`), `RESTART_DEPLOYMENT`, `ROLLBACK_DEPLOYMENT`, `CLEANUP_TEMP_FILES`, `DRAIN_NODE` (`CORDON_NODE`), `BLOCK_IP_TEMP`, `ADJUST_RESOURCE_LIMITS`, `NO_ACTION`. Live Abort modal, structured rule builder (7 selectable actions), 5 safety guards, Global Mode (`SUPERVISED`/`AUTONOMOUS`/`AUDIT`). | `SelfHealingHubPage.jsx` is orphaned; `BLOCK_IP_TEMP` and `ADJUST_RESOURCE_LIMITS` appear in history/filters/matrices but are not selectable in `NewPolicyModal`; `SUCCEEDED` vs `COMPLETED` enum mismatch; Admin Self-Healing filter params camelCase vs snake_case bug. |
| **I. Human-in-the-Loop (HITL)** | `Dashboard/SelfHealing/ApprovalsPage`, `PoliciesPage` Immutable HITL Lock (`ROLLBACK_DEPLOYMENT`, `DRAIN_NODE`), `Admin/Incidents` & `Admin/SelfHealing` HITL Gate banners | Real-time WS pending approval queue, live Pod health check, YAML Diff Preview modal, RBAC `PermissionGate(HITL_APPROVE)` disabling DevOps, Auto-Dismiss stale reconciler, mandatory non-removable HITL lock for `ROLLBACK` & `DRAIN`. | Approve/Reject on cards execute immediately without confirmation dialog; YAML Diff modal Approve button misses `PermissionGate`; `DashboardContext` auto-rejects regardless of toggle; Admin HITL CTA links to 404 `/admin/approvals`. |
| **J. Security & Access Control** | `Admin/Users`, `Admin/Roles` (3-tab RBAC Matrix + Audit), `Admin/AuditLogs` (SHA-256 + Diff Drawer), `Dashboard/Organization/Members`, `Dashboard/AuditLogs`, `Personal/Security`, `SecurityPractices`, `ForbiddenPage` | Cryptographic SHA-256 immutable audit logs with Before/After JSON diffs, Super Admin exclusive RBAC console, User Lock/Unlock modal, manual email verification, last-owner protection. | Multiple RBAC guard gaps in `routes/index.jsx` (`/admin/activity`, `/admin/account-settings`, `/admin/organizations*`, `/admin/*` for SME_OWNER) & `Infrastructure` Drain; `AdminUsersPage` drawer z-index covers confirmation modal. |
| **K. Reports & Settings** | `Dashboard/Reports` + `ExcelExportModal` (10 sheets + embedded 2x PNG charts + CSV/JSON/Print), `Dashboard/Settings` (Emergency Alerts + Test Email), `Admin/Analytics` (+ CSV), `Admin/Notifications` (Broadcast), `Admin/Settings` (6 tabs), `Admin/AccountSettings` | Comprehensive 6-chart cross-filtering SLA analytics, `@media print` A4 executive report with signature block, formula-injection-safe CSV export, SMTP test email. | `Admin/Settings` Save buttons (Tabs 1/2/3/5) are mock no-ops & Tab 1 has literal `${retentionStats.*}` bug; `Admin/AccountSettings` is 100% mock; `Dashboard/AuditLogs` exports only current 10-row page. |

---

## 6. Page-by-Page Component Inventory, Interactions & UI States Summary

Full component-by-component numbered specifications (`Table 1` through `Table 67`) are provided in [UI_COMPONENT_SPECIFICATIONS.md](file:///d:/AISelfHealing/docs/ui-audit/UI_COMPONENT_SPECIFICATIONS.md). Below is the cross-cutting synthesis of interaction and UI state patterns verified across all 62 active pages:

### 6.1 Form Validation & Submission Patterns
- **Real API Forms with Client Validation:** `Login` (required), `Register` (name >=2, email regex, password >=8 & score >=2, confirm match, terms checkbox), `ForgotPassword` (email regex), `ResetPassword` (4 password criteria + match + token >=16 chars), `Onboarding Organization` (debounced slug uniqueness API + kebab regex), `Onboarding Kubernetes` (DNS-1123 regex), `AlertRuleModal` (unit/threshold range + `eval_window` regex), `OrganizationPage` edit modal (URL XSS scheme guard), `SettingsPage` (cooldown `1–1440` + comma-separated email regex), `AdminBroadcastPage` (title >=3, content >=5), `UploadModelModal` (file extension `.pth/.pt/.onnx/.pkl` + required name/version).
- **Confirmation Dialog Audit:**
  - *Implemented Confirmations:* `PersonalCompaniesPage` (Leave Company), `PersonalSecurityPage` (Disable 2FA), `ClusterDetailPage` (Disconnect Agent, Delete Cluster with exact name match + `force`), `AgentsPage` (Disconnect, Delete with `force`), `AlertsPage` (Table Resolve modal + Drawer Reassign inline confirm), `HealingActionsPage` (Abort modal with reason), `PoliciesPage` (Delete Policy modal), `MembersPage` (Remove/Revoke modal), `AdminUsersPage` (Lock/Unlock modal + inline Email Verify confirm), `AdminAgentManagementPage` (Rotate/Revoke modal), `AIComparisonView` (Rollback modal), `AdminSystemSettingsPage` (Purge Logs via `window.confirm`).
  - *Missing Confirmations (High-Risk Actions Executing Immediately):* `ApprovalsPage` (Approve & Reject HITL on card), `RootCauseModal` (Resolve Incident), `AlertsPage` (Delete Alert Rule), `OrganizationsListPage` / `OrganizationDetailsPage` (Suspend/Activate Tenant), `AdminBroadcastPage` (Delete Broadcast).

### 6.2 Table Patterns
- Shared pagination component `AdminTablePagination` is used across Admin (`Users`, `Roles`, `Activity`, `Agents`, `Clusters`, `Alerts`, `AuditLogs`) and `PersonalActivityPage`, whereas `OrganizationsListPage`, `PersonalSecurityPage`, and SME Dashboard tables implement custom pagination bars.
- `dashboard-tokens.css` globally enforces `.dash-table thead tr { background: #F8FAFC !important; color: #64748B !important; }` across all workspace tables, overriding inline green headers in several Admin tables.

### 6.3 UI States Matrix
- **Loading:** Explicit spinners/skeletons implemented in most pages (`WidgetContainer`, `AdminUsersPage` 5-row skeleton, `PersonalDashboardPage`, `LogsPage`, `ReportsPage`); missing table skeleton in `AdminAlertsPage` (`isLoading` unused in JSX) and `PersonalProfilePage`.
- **Empty:** Dashed-border empty cards implemented consistently across tables and lists; missing empty state on `ActionTypesCatalog` (Admin Self-Healing).
- **Error:** `AdminErrorState` with retry button on Admin core pages; inline red alert cards on Auth/Forms; `ToastContext` floating alerts bottom-right; **silent error swallowing** in `AdminAgentManagementPage`, `AdminClusterOverviewPage`, `RegisterPage` OTP resend, and `AdminSelfHealingPage` policy toggles.
- **Native Browser Alerts (`window.alert` / `window.confirm`):** Still used inconsistently in `NewPolicyModal`, `Infrastructure`, `Workloads`, `ClusterDetailPage`, `PersonalDashboardPage`, `AdminAnalyticsPage`, `AIModelsTable`, `AIComparisonView`, and `AdminSystemSettingsPage`.

---

## 7. Design System Extraction (Phase 7)

### 7.1 Dual-Theme Color Tokens

#### A. Public / Auth / Onboarding — Greptile Blueprint (`styles/design-tokens.css`)
| Role | Token(s) | Exact Value |
|---|---|---|
| Canvas | `--color-canvas`, `--bg-primary` | `#EEEEEE` |
| Surface | `--color-surface`, `--bg-secondary` | `#FFFFFF` |
| Subtle / Dark Neutral | `--bg-subtle` / `--color-neutral-1` | `#E7E7E7` / `#2A2A2A` |
| Brand Primary (Navy) | `--color-primary`, `--border-strong` | `#3D3B4F` |
| Brand Accent (Mint) | `--color-accent`, `--emerald-500` | `#28E99F` |
| Decorative / Muted | `--color-accent-decorative` / `--color-muted` | `#ECFFA3` / `#FFCFFE` |
| Text (Ink / Body / Link) | `--color-ink` / `--color-body` / `--color-link` | `#000000` / `#3D3B4F` / `#555368` |
| Borders | `--color-hairline` / `--border-dashed` | `#D6D6D6` / `1px dashed rgba(61,59,79,0.16)` |
| Semantic (Success / Warn / Error / Info) | `--*-text` / `--*-icon` | `#059669`/`#28E99F`, `#92400E`/`#D97706`, `#991B1B`/`#DC2626`, `#075985`/`#0284C7` |
| Radii & Shadows | `--radius-*` / `--shadow-*` | `0px` / `none` |

#### B. Authenticated Workspaces — Calm Operations (`styles/dashboard-tokens.css`)
| Role | Token(s) | Exact Value |
|---|---|---|
| Canvas / Surface / Subtle / Active | `--dash-bg-canvas` / `-surface` / `-subtle` / `-active` | `#F8FAFC` / `#FFFFFF` / `#F1F5F9` / `#F0FDF4` |
| Primary (Soft Emerald) | `--dash-primary` / `-hover` / `-light` / `-border` | `#059669` / `#047857` / `#ECFDF5` / `#A7F3D0` |
| Mint Secondary | `--dash-secondary` / `--dash-mint-100` / `-200` / `-600` | `#D1FAE5` / `#DCFCE7` / `#BBF7D0` / `#16A34A` |
| Text (Primary / Secondary / Muted / Inverse) | `--dash-text-*` | `#0F172A` / `#475569` / `#94A3B8` / `#FFFFFF` |
| Borders | `--dash-border` / `--dash-border-subtle` | `#E2E8F0` / `#E6ECE8` |
| Semantic Status | `--dash-success` / `-warning` / `-critical` / `-info` | `#10B981`, `#F59E0B`, `#EF4444`, `#0284C7` |
| Glossy Modal Header | `.dash-modal-header-glossy` | `linear-gradient(135deg, #065F46 0%, #047857 55%, #059669 100%)` |
| Radii | `--dash-radius-xs` .. `2xl` / `full` | `4px`, `6px`, `10px`, `14px`, `18px`, `22px`, `9999px` |
| Focus Ring | Global `:focus-visible` | `2px solid #059669 !important; outline-offset: 2px` |

*(Page-specific overrides: `AuthShared.css` uses `#22E59B` primary buttons and `6px` radii; `ToastContext.jsx` uses Rose `#E11D48` and Blue `#2563EB`; `Footer.css` uses `#EDEDF0` dot matrix; `LogsPage` terminal uses `#0B1120`.)*

### 7.2 Typography (`Frontend/public/index.html` & `styles/`)
- **Loaded Google Fonts:** `Inter` (400–700), `JetBrains Mono` (400–600), `Anybody` (400–800), `DM Sans` (400–700), `Space Mono` (400, 700).
- **Active Defaults:** `--font-display` & `--font-body` resolve to `'Inter', sans-serif` (for Vietnamese diacritic fidelity); `--font-mono` resolves to `'JetBrains Mono', monospace`. Marketing headings/nav use `Anybody` and `Space Mono`.
- **Scale:** Public Hero H1 `clamp(2.75rem, 6vw, 4.5rem)` (`90px` on Home); Workspace H1/H2 `1.25rem–1.5rem` (`20–24px`, weight `700–800`); Body `0.8125rem–1rem` (`13–16px`); Table headers `0.6875rem` (`11px`, uppercase bold); Badges `0.6875rem–0.75rem` mono.

### 7.3 Layout Grid & Responsive Breakpoints

| Layout Shell | Header Height | Sidebar (Expanded / Collapsed / Mobile) | Main Container | Key `@media` Breakpoints |
|---|---:|---|---|---|
| `PublicLayout` | `64px` top / `56px` scrolled | None (fullscreen mobile drawer `<=900px`) | `max-width: 1400px` (+ 20px blueprint gutters `>1400px`) | `1400px`, `1024px`, `900px`, `768px`, `640px` |
| `AuthLayout` | None | Left 3D pane `flex: 1.2` (hidden `<=840px`) | Right form `max-width: 380px` | `840px` |
| `OnboardingLayout` | `60px` sticky | Left stepper `320px` (top bar `<=1024px`) | `max-width: 1400px` (right step `720px`) | `1024px`, `600px` |
| `PersonalPortalLayout` | `64px` | `260px` / `72px` (**No mobile drawer wired**) | `max-width: 1440px`, `padding: 24px` | None dedicated (fixed 4-col KPI grid) |
| `DashboardLayout` | `60px` (`52px` `<=860px`) | Floating glass `256px` / `68px` / `272px` mobile drawer | `max-width: 1440px` (100% full-bleed on Overview & Metrics) | `1024px`, `860px`, `768px`, `640px`, `@media print` (A4) |
| `AdminLayout` | `64px` | `260px` / `72px` (`Ctrl+B` toggle; auto-collapse `<1024px`) / `280px` drawer `<=768px` | Responsive padding `32x36` -> `14x16` | `1440px`, `1024px`, `768px` |

---

## 8. Orphaned & Unreachable Component Inventory

| Category | Files Verified as Orphaned / Unreachable |
|---|---|
| **Unmounted Dashboard Pages (5)** | `pages/Dashboard/AI/PredictionsPage.jsx`, `pages/Dashboard/SelfHealing/SelfHealingHubPage.jsx`, `pages/Dashboard/Monitoring/ApmPage.jsx`, `pages/Dashboard/Monitoring/LogsAndEventsPage.jsx`, `pages/Dashboard/Alerts/AlertHistoryPage.jsx` (unreachable tab) |
| **Unmounted Dashboard Components (6)** | `components/dashboard/AIPredictionForecastChart.jsx`, `ApmChartsPanel.jsx`, `InteractiveResourceChart.jsx`, `K8sDeploymentsPanel.jsx`, `K8sResourceDetailModal.jsx`, `K8sFreshnessBadge.jsx` (+ default export of `NodeMetricsChartsPanel.jsx`) |
| **Unmounted / Shadowed Admin Files (13)** | `pages/Admin/Overview/components/{AdminWebsiteDashboard,GlobalScopeSelector,PlatformHealthSection,InfrastructureSection,GrowthAndAnalyticsSections,FeedsSections}.jsx`, `components/admin/infrastructure/AgentTable.jsx` (shadowed), `components/admin/ai/{AIPredictionsTable,AIRCASection,AIPerformanceView}.jsx`, `components/admin/common/{AdminAccessDenied,AdminNotFound}.jsx`, `ADMIN_ROLE_NAV_GROUPS` in `AdminSidebar.jsx` |
| **Unmounted Public / Docs / Onboarding / Hooks (25)** | `layouts/DocsLayout.jsx`, `components/navigation/{DocumentationSidebar,Pagination,Sidebar,TableOfContents}.jsx`, `components/marketing/{CapabilityCard,CTASection,FeatureCard,IncidentCard,ProcessStep}.jsx`, `pages/Home/components/{DashboardPreview,FloatingCard,HeroAmbientDecor,HeroDashboardLive}.jsx` + 2 `illustrations/*.jsx`, 12 legacy 3D/Canvas files in `pages/Features/components/`, `pages/Guide/components/{GuideNotebookCanvas,NotebookIndexNav}.jsx`, `components/onboarding/{ConnectionStatusCard,HeartbeatIndicator,EmptyState,LoadingState}.jsx`, `hooks/{useMockProfile,useMockNotifications}.js`, `src/App.css` |

---

## 9. Documentation Gap Analysis Summary (Phase 8)

Detailed findings (32 prioritized items: **8 Critical, 11 High, 8 Medium, 5 Low**) are documented in [UI_DOCUMENTATION_GAP_ANALYSIS.md](file:///d:/AISelfHealing/docs/ui-audit/UI_DOCUMENTATION_GAP_ANALYSIS.md). Top priorities:
- **Critical:** Zero official UI docs exist for Personal Portal (8 routes), Platform Admin Portal (20+ routes beyond `/admin/users`), and Error/Status pages (10 variants); runtime crash on live `Admin/Incidents` (`recoveryDuration` undefined); broken `/admin/approvals` 404 links; RBAC guard leaks (`VIEWER` on `Infrastructure` Drain, `/admin/activity`, `/admin/account-settings`; `SME_OWNER` on `/admin/*` technical routes; `DEVOPS` on `ApprovalsPage` YAML modal); dead-end `PixelStatusPage` with zero navigation buttons.
- **High:** Three-way contradiction across existing docs (`DASHBOARD_ARCHITECTURE.md` vs `PBI-04_4.4` vs `RBAC_Test_Cases_PB08_4.2.csv`) on Viewer permissions; outdated `PROJECT_STRUCTURE.md` & `SELFHEAL_FRONTEND_SPEC.md` (claiming Greptile-only or old 7-group Dashboard sidebar); outdated JWT docs claiming `localStorage` storage and port `5000`; unlinked `/dashboard/alerts` route; shadowed `/admin/infrastructure/*` and `/admin/ai/*` routes.

---

## 10. Companion Deliverables in This Audit Package

1. **[FRONTEND_UI_AUDIT_REPORT.md](file:///d:/AISelfHealing/docs/ui-audit/FRONTEND_UI_AUDIT_REPORT.md)** — Master executive audit report (this document).
2. **[UI_COMPONENT_SPECIFICATIONS.md](file:///d:/AISelfHealing/docs/ui-audit/UI_COMPONENT_SPECIFICATIONS.md)** — Standardized `Table 1`–`Table 67` (`No. | Field Name | Type | Require | Target`) covering every discovered page and modal.
3. **[UI_SCREENSHOT_CHECKLIST.md](file:///d:/AISelfHealing/docs/ui-audit/UI_SCREENSHOT_CHECKLIST.md)** — Complete `Figure 1`–`Figure 112` screenshot & callout annotation checklist.
4. **[UI_DOCUMENTATION_OUTLINE.md](file:///d:/AISelfHealing/docs/ui-audit/UI_DOCUMENTATION_OUTLINE.md)** — Proposed official Word *User Interface Design Document* outline matching the `C2SE.29` format (Metadata, Revision History, TOC, Table of Tables, Table of Figures, Role Sections, References).
5. **[UI_DOCUMENTATION_GAP_ANALYSIS.md](file:///d:/AISelfHealing/docs/ui-audit/UI_DOCUMENTATION_GAP_ANALYSIS.md)** — Full gap analysis table classifying all 32 documentation, architecture, RBAC, and implementation inconsistencies.
