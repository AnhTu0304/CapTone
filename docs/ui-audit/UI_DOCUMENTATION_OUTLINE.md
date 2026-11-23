# Proposed Official User Interface Design Document Outline

> **Purpose of this file:** Blueprint for assembling the official Word document (`User Interface Design Document`) following the exact structure of the project template (`C2SE.29_User Interface Design_ver1.1.docx`), populated exclusively with verified frontend pages, roles, tables (`Table 1`–`Table 67`), and figures (`Figure 1`–`Figure 112`).

---

## DOCUMENT INFORMATION (Cover Page Template)

| Field | Value |
|---|---|
| **Document Title** | User Interface Design Document — AI-Driven Proactive Self-Healing Infrastructure for SMEs |
| **Author(s)** | *[To be filled by project team]* |
| **Role** | Team Member |
| **Date** | *[Release Date — e.g., November 22, 2026]* |
| **File Name** | `User_Interface_Design_SelfHeal_ver1.0.docx` |

## REVISION HISTORY

| Version | Date | Comments | Author | Approval |
|---|---|---|---|---|
| 1.0 | *[TBD]* | Initial Release — Full implementation-based UI Design Document | *[Team]* | *[Lead]* |

---

## TABLE OF CONTENTS

- **1. Introduction**
  - 1.1. Purpose
  - 1.2. Scope
  - 1.3. User Role Classification & Access Model *(Super Admin, Admin, SME Owner, DevOps, Viewer, Standard User)*
  - 1.4. Dual Design System Overview *(Greptile Blueprint vs. White-First Calm Operations)*
- **2. Interface Design**
  - **2.1. Authentication & Public Landing**
    - 2.1.1. Login & 2FA Verification (`/login`, `/get-started`)
    - 2.1.2. Account Registration & Email OTP (`/register`)
    - 2.1.3. Forgot Password (`/forgot-password`)
    - 2.1.4. Reset Password (`/reset-password`)
    - 2.1.5. Public Layout Shell (Header, Resources Mega Menu, Mobile Drawer & Footer)
    - 2.1.6. Home / Landing Page (`/`)
    - 2.1.7. Features & Self-Healing Lifecycle (`/features`)
    - 2.1.8. SRE Operations Handbook (`/guide`, `/docs`)
    - 2.1.9. About SelfHeal (`/about`)
    - 2.1.10. Contact Sales & Consultation (`/contact`)
    - 2.1.11. Legal & Security Practices (`/terms`, `/privacy`, `/security`)
  - **2.2. Onboarding Wizard (Authenticated First-Time Setup)**
    - 2.2.1. Step 1 — Organization Setup (`/onboarding/organization`)
    - 2.2.2. Step 2 — Environment Setup (`/onboarding/environment`)
    - 2.2.3. Step 3 — Kubernetes Cluster & Agent Token (`/onboarding/kubernetes`)
    - 2.2.4. Step 4 — Verify Agent Connection (`/onboarding/verify-agent`)
    - 2.2.5. Step 5 — Complete Setup (`/onboarding/complete`)
  - **2.3. Personal Portal (All Authenticated Roles)**
    - 2.3.1. Personal Dashboard (`/portal`, `/portal/dashboard`)
    - 2.3.2. My Companies & Invitations (+ Create & Leave Modals) (`/portal/companies`)
    - 2.3.3. Personal Profile (`/portal/profile`)
    - 2.3.4. Account Security & 2FA (+ QR Setup, Backup Codes & Disable Modals) (`/portal/security`)
    - 2.3.5. Personal Preferences (`/portal/preferences`)
    - 2.3.6. Personal Notifications (+ Settings Modal) (`/portal/notifications`)
    - 2.3.7. Personal Activity History (`/portal/activity`)
    - 2.3.8. Help & Technical Guide (`/portal/help`)
  - **2.4. SME Owner (Tenant Governance & Full Workspace)**
    - 2.4.1. SME Dashboard Shell (`TopHeader`, Floating `Sidebar` & Profile Menu)
    - 2.4.2. SME Overview — AI Self-Healing Pipeline Canvas (`/dashboard`)
    - 2.4.3. Organization Profile & Edit Modal (`/dashboard/organization`)
    - 2.4.4. Organization Members & RBAC (+ Invite, Role & Remove Modals) (`/dashboard/organization/members`)
    - 2.4.5. Kubernetes Clusters Management (+ Register & One-Time Token Modals) (`/dashboard/clusters`)
    - 2.4.6. Cluster Detail, Agent Guide & Danger Zone (`/dashboard/clusters/:id`)
    - 2.4.7. Human-in-the-Loop (HITL) Approvals Gate (+ YAML Diff Modal) (`/dashboard/self-healing/approvals`)
    - 2.4.8. Self-Healing Policies & Safety Guards (+ New Policy, Detail & Delete Modals) (`/dashboard/self-healing/policies`)
    - 2.4.9. SLA Reports & Analytics (+ Excel Export Modal) (`/dashboard/reports`)
    - 2.4.10. Tenant Immutable Audit Logs (+ JSON Diff Modal) (`/dashboard/audit-logs`)
    - 2.4.11. Emergency Alert Settings (`/dashboard/settings`)
    - 2.4.12. Tenant Notifications Center (`/dashboard/notifications`)
  - **2.5. DevOps (Infrastructure Operations, Observability, Incidents & Remediation)**
    - 2.5.1. Infrastructure Nodes & Drain Modal (`/dashboard/infrastructure`)
    - 2.5.2. Workloads & Pods (+ Detail & Rolling Restart Modal) (`/dashboard/workloads`)
    - 2.5.3. eBPF Agents Management (+ Install, Disconnect & Delete Modals) (`/dashboard/agents`)
    - 2.5.4. Node Metrics Flow Canvas (`/dashboard/monitoring/metrics`)
    - 2.5.5. System & Container Logs Live Tail (+ Log Detail Modal) (`/dashboard/monitoring/logs`)
    - 2.5.6. Kubernetes Cluster Events (+ Event Detail Modal) (`/dashboard/monitoring/events`)
    - 2.5.7. Alerts & Threshold Rules (+ Detail Drawer & Rule Modal) (`/dashboard/alerts`)
    - 2.5.8. Incidents & Root Cause Analysis Drawer (`/dashboard/incidents`)
    - 2.5.9. Live Self-Healing Actions — MAPE-K (+ Abort Modal) (`/dashboard/self-healing/actions`)
    - 2.5.10. Self-Healing Action History (+ Trend Chart & Detail Modal) (`/dashboard/self-healing/history`)
    - *(Note: DevOps also accesses Overview, Clusters [without Delete], Policies, Reports, Audit Logs, Notifications, and read-only HITL Approvals)*
  - **2.6. Viewer (Read-Only Monitoring & Reporting Role)**
    - 2.6.1. Viewer Access Scope, Disabled Controls & 403 Guard Summary
  - **2.7. Platform Admin & Super Admin (`/admin/*`)**
    - 2.7.1. Admin Portal Shell (`AdminSidebar`, `AdminHeader`, Notifications & Profile Menu)
    - 2.7.2. Admin Platform Overview (`/admin`, `/admin/overview`)
    - 2.7.3. Admin Organizations List (`/admin/companies`, `/admin/organizations`)
    - 2.7.4. Admin Organization Details — 7-Tab Tenant Inspector (`/admin/companies/:id`)
    - 2.7.5. Admin Users Management (+ Details Drawer & Lock/Unlock Modal) (`/admin/users`)
    - 2.7.6. Admin Roles & RBAC Matrix `[SUPER_ADMIN Only]` (+ 3 Modals) (`/admin/roles`)
    - 2.7.7. Admin User Activity Tracking (`/admin/activity`)
    - 2.7.8. Admin Growth Analytics (`/admin/analytics`)
    - 2.7.9. Admin Network Broadcast Center (`/admin/notifications`)
    - 2.7.10. Admin Agents Management (+ Token Modal & Profile Drawer) (`/admin/agents`)
    - 2.7.11. Admin Cluster Overview (`/admin/clusters`)
    - 2.7.12. Admin Unified Infrastructure (`/admin/infrastructure`, `/nodes`, `/workloads`)
    - 2.7.13. Admin System Monitoring (`/admin/monitoring`)
    - 2.7.14. Admin Platform Alerts (+ Thresholds Modal) (`/admin/alerts`)
    - 2.7.15. Admin Incidents List & 8-Stage Detail View (`/admin/incidents`, `/admin/incidents/:id`)
    - 2.7.16. Admin AI Management (Overview, Model Registry, Upload & Comparison) (`/admin/ai/*`)
    - 2.7.17. Admin Self-Healing Management (+ Policy Config Modal) (`/admin/self-healing/*`)
    - 2.7.18. Admin Immutable Audit Logs SHA-256 (+ Diff Drawer) (`/admin/audit-logs`)
    - 2.7.19. Admin System Settings `[SUPER_ADMIN Only]` & Account Settings (`/admin/settings`, `/admin/account-settings`)
  - **2.8. System Error & Operational Status Pages**
    - 2.8.1. HTTP Error & Infrastructure Status Pages (10 Pixel-Art Variants)
- **3. References**
- **Appendix A: Implementation Status & Data Source Summary (Real API vs. Hybrid vs. Mock)**
- **Appendix B: Orphaned & Unreachable Frontend Files (Excluded from Active UI)**

---

## TABLE OF TABLES (67 Standardized Specification Tables)

| Table No. | Title | Section | Source Spec |
|---|---|---|---|
| Table 1 | Login | 2.1.1 | `UI_COMPONENT_SPECIFICATIONS.md` |
| Table 2 | Register | 2.1.2 | `UI_COMPONENT_SPECIFICATIONS.md` |
| Table 3 | Forgot Password | 2.1.3 | `UI_COMPONENT_SPECIFICATIONS.md` |
| Table 4 | Reset Password | 2.1.4 | `UI_COMPONENT_SPECIFICATIONS.md` |
| Table 5 | Public Layout Shell (Header, Mega Menu, Mobile Drawer & Footer) | 2.1.5 | `UI_COMPONENT_SPECIFICATIONS.md` |
| Table 6 | Home / Landing Page | 2.1.6 | `UI_COMPONENT_SPECIFICATIONS.md` |
| Table 7 | Features & Self-Healing Lifecycle | 2.1.7 | `UI_COMPONENT_SPECIFICATIONS.md` |
| Table 8 | SRE Operations Handbook (Guide) | 2.1.8 | `UI_COMPONENT_SPECIFICATIONS.md` |
| Table 9 | About SelfHeal | 2.1.9 | `UI_COMPONENT_SPECIFICATIONS.md` |
| Table 10 | Contact Consultation Page | 2.1.10 | `UI_COMPONENT_SPECIFICATIONS.md` |
| Table 11 | Legal & Security Pages (Terms, Privacy, Security Practices) | 2.1.11 | `UI_COMPONENT_SPECIFICATIONS.md` |
| Table 12 | Onboarding Step 1 — Organization Setup | 2.2.1 | `UI_COMPONENT_SPECIFICATIONS.md` |
| Table 13 | Onboarding Step 2 — Environment Setup | 2.2.2 | `UI_COMPONENT_SPECIFICATIONS.md` |
| Table 14 | Onboarding Step 3 — Kubernetes Cluster & Agent Token | 2.2.3 | `UI_COMPONENT_SPECIFICATIONS.md` |
| Table 15 | Onboarding Step 4 — Verify Agent Connection | 2.2.4 | `UI_COMPONENT_SPECIFICATIONS.md` |
| Table 16 | Onboarding Step 5 — Complete Setup | 2.2.5 | `UI_COMPONENT_SPECIFICATIONS.md` |
| Table 17 | Personal Dashboard | 2.3.1 | `UI_COMPONENT_SPECIFICATIONS.md` |
| Table 18 | My Companies & Invitations (+ Create/Leave Modals) | 2.3.2 | `UI_COMPONENT_SPECIFICATIONS.md` |
| Table 19 | Personal Profile | 2.3.3 | `UI_COMPONENT_SPECIFICATIONS.md` |
| Table 20 | Account Security & 2FA (+ Modals) | 2.3.4 | `UI_COMPONENT_SPECIFICATIONS.md` |
| Table 21 | Personal Preferences | 2.3.5 | `UI_COMPONENT_SPECIFICATIONS.md` |
| Table 22 | Personal Notifications (+ Settings Modal) | 2.3.6 | `UI_COMPONENT_SPECIFICATIONS.md` |
| Table 23 | Personal Activity Log | 2.3.7 | `UI_COMPONENT_SPECIFICATIONS.md` |
| Table 24 | Personal Help & Technical Guide | 2.3.8 | `UI_COMPONENT_SPECIFICATIONS.md` |
| Table 25 | SME Dashboard Shell (`TopHeader`, `Sidebar`, `UserProfileDropdown`) | 2.4.1 | `UI_COMPONENT_SPECIFICATIONS.md` |
| Table 26 | SME Overview — AI Self-Healing Pipeline Canvas | 2.4.2 | `UI_COMPONENT_SPECIFICATIONS.md` |
| Table 27 | Organization Profile (+ Edit Modal) | 2.4.3 | `UI_COMPONENT_SPECIFICATIONS.md` |
| Table 28 | Organization Members & RBAC (+ 4 Modals) | 2.4.4 | `UI_COMPONENT_SPECIFICATIONS.md` |
| Table 29 | Kubernetes Clusters Management (+ Register & Token Modals) | 2.4.5 | `UI_COMPONENT_SPECIFICATIONS.md` |
| Table 30 | Cluster Detail, Agent Guide & Danger Zone | 2.4.6 | `UI_COMPONENT_SPECIFICATIONS.md` |
| Table 31 | HITL Approvals Gate (+ YAML Diff Modal) | 2.4.7 | `UI_COMPONENT_SPECIFICATIONS.md` |
| Table 32 | Self-Healing Policies & Safety Guards (+ New/Detail/Delete Modals) | 2.4.8 | `UI_COMPONENT_SPECIFICATIONS.md` |
| Table 33 | SLA Reports & Analytics (+ Excel Export Modal) | 2.4.9 | `UI_COMPONENT_SPECIFICATIONS.md` |
| Table 34 | Tenant Immutable Audit Logs (+ Detail Modal) | 2.4.10 | `UI_COMPONENT_SPECIFICATIONS.md` |
| Table 35 | Emergency Alert Settings | 2.4.11 | `UI_COMPONENT_SPECIFICATIONS.md` |
| Table 36 | Tenant Notifications Center | 2.4.12 | `UI_COMPONENT_SPECIFICATIONS.md` |
| Table 37 | Infrastructure Nodes (+ Detail & Drain Modal) | 2.5.1 | `UI_COMPONENT_SPECIFICATIONS.md` |
| Table 38 | Workloads & Pods (+ Detail & Rolling Restart Modal) | 2.5.2 | `UI_COMPONENT_SPECIFICATIONS.md` |
| Table 39 | eBPF Agents Management (+ Install/Disconnect/Delete Modals) | 2.5.3 | `UI_COMPONENT_SPECIFICATIONS.md` |
| Table 40 | Node Metrics Flow Canvas | 2.5.4 | `UI_COMPONENT_SPECIFICATIONS.md` |
| Table 41 | System & Container Logs (+ Log Detail Modal) | 2.5.5 | `UI_COMPONENT_SPECIFICATIONS.md` |
| Table 42 | Kubernetes Cluster Events (+ Event Detail Modal) | 2.5.6 | `UI_COMPONENT_SPECIFICATIONS.md` |
| Table 43 | Alerts & Threshold Rules (+ Detail Drawer & Rule Modal) | 2.5.7 | `UI_COMPONENT_SPECIFICATIONS.md` |
| Table 44 | Incidents & Root Cause Analysis Drawer | 2.5.8 | `UI_COMPONENT_SPECIFICATIONS.md` |
| Table 45 | Live Self-Healing Actions — MAPE-K (+ Abort Modal) | 2.5.9 | `UI_COMPONENT_SPECIFICATIONS.md` |
| Table 46 | Self-Healing Action History (+ Trend Chart & Detail Modal) | 2.5.10 | `UI_COMPONENT_SPECIFICATIONS.md` |
| Table 47 | Viewer Role Access & Read-Only UI Restrictions | 2.6.1 | `UI_COMPONENT_SPECIFICATIONS.md` |
| Table 48 | Admin Portal Shell (`AdminSidebar`, `AdminHeader`, Notifications, Profile) | 2.7.1 | `UI_COMPONENT_SPECIFICATIONS.md` |
| Table 49 | Admin Platform Overview | 2.7.2 | `UI_COMPONENT_SPECIFICATIONS.md` |
| Table 50 | Admin Organizations List | 2.7.3 | `UI_COMPONENT_SPECIFICATIONS.md` |
| Table 51 | Admin Organization Details (7-Tab Inspector) | 2.7.4 | `UI_COMPONENT_SPECIFICATIONS.md` |
| Table 52 | Admin Users Management (+ Drawer & Lock Modal) | 2.7.5 | `UI_COMPONENT_SPECIFICATIONS.md` |
| Table 53 | Admin Roles & RBAC Matrix `[SUPER_ADMIN Only]` (+ 3 Modals) | 2.7.6 | `UI_COMPONENT_SPECIFICATIONS.md` |
| Table 54 | Admin User Activity Tracking | 2.7.7 | `UI_COMPONENT_SPECIFICATIONS.md` |
| Table 55 | Admin Growth Analytics | 2.7.8 | `UI_COMPONENT_SPECIFICATIONS.md` |
| Table 56 | Admin Network Broadcast Center | 2.7.9 | `UI_COMPONENT_SPECIFICATIONS.md` |
| Table 57 | Admin Agents Management (+ Token Modal & Profile Drawer) | 2.7.10 | `UI_COMPONENT_SPECIFICATIONS.md` |
| Table 58 | Admin Cluster Overview | 2.7.11 | `UI_COMPONENT_SPECIFICATIONS.md` |
| Table 59 | Admin Unified Infrastructure | 2.7.12 | `UI_COMPONENT_SPECIFICATIONS.md` |
| Table 60 | Admin System Monitoring | 2.7.13 | `UI_COMPONENT_SPECIFICATIONS.md` |
| Table 61 | Admin Platform Alerts (+ Thresholds Modal) | 2.7.14 | `UI_COMPONENT_SPECIFICATIONS.md` |
| Table 62 | Admin Incidents List & 8-Stage Incident Detail | 2.7.15 | `UI_COMPONENT_SPECIFICATIONS.md` |
| Table 63 | Admin AI Management (Overview, Model Registry, Upload & Comparison) | 2.7.16 | `UI_COMPONENT_SPECIFICATIONS.md` |
| Table 64 | Admin Self-Healing Management (+ Policy Config Modal) | 2.7.17 | `UI_COMPONENT_SPECIFICATIONS.md` |
| Table 65 | Admin Immutable Audit Logs SHA-256 (+ Detail Drawer) | 2.7.18 | `UI_COMPONENT_SPECIFICATIONS.md` |
| Table 66 | Admin System Settings `[SUPER_ADMIN Only]` & Account Settings | 2.7.19 | `UI_COMPONENT_SPECIFICATIONS.md` |
| Table 67 | System Error & Operational Status Pages (10 Variants) | 2.8.1 | `UI_COMPONENT_SPECIFICATIONS.md` |

---

## TABLE OF FIGURES (112 Planned Screenshots)

Complete figure list (`Figure 1. UI Login` through `Figure 112. UI Operational Status Pages`) with exact role, view state, and numbered annotation keys is maintained in [UI_SCREENSHOT_CHECKLIST.md](file:///d:/AISelfHealing/docs/ui-audit/UI_SCREENSHOT_CHECKLIST.md).

---

## PROPOSED SECTION 1 TEXT (Ready for Word Document)

### 1. Introduction

#### 1.1. Purpose
This User Interface Design Document specifies the implemented user interfaces of **AI-Driven Proactive Self-Healing Infrastructure for SMEs (SelfHeal)**. Its objectives are:
- To provide an accurate, source-verified reference describing every page, modal, drawer, navigation structure, interactive control, and UI state across all user roles.
- To establish a shared specification for engineering, QA, and stakeholders verifying role-based access control (RBAC), Human-in-the-Loop (HITL) safety governance, observability workflows, and visual design consistency.

#### 1.2. Scope
This document covers all active frontend interfaces implemented in `Frontend/src/` across seven functional areas:
1. Public Marketing, Documentation, Contact & Legal pages (`PublicLayout`).
2. Authentication flows including 2FA, Email OTP, Google OAuth2, and Password Recovery (`AuthLayout`).
3. 5-step Guided Infrastructure Onboarding Wizard (`OnboardingLayout`).
4. Personal Account & Workspace Hub (`PersonalPortalLayout`).
5. Multi-tenant SME Operations Dashboard for `SME_OWNER`, `DEVOPS`, and `VIEWER` (`DashboardLayout`).
6. Platform Administration Console for `SUPER_ADMIN` and `ADMIN` (`AdminLayout`).
7. System Error and Operational Status screens (`PixelStatusPage`).

Out of scope: Backend API internals, Kubernetes agent binaries, and 49 orphaned/unrouted frontend source files documented separately in Appendix B.

---

## PROPOSED SECTION 3: REFERENCES

1. `Frontend/src/routes/index.jsx` — Application Route Dispatcher & RBAC Route Guards.
2. `Frontend/src/context/AuthContext.jsx` & `Frontend/src/hooks/usePermissions.js` — Role Hierarchy & Tenant Permission Engine.
3. `Frontend/src/styles/design-tokens.css` & `Frontend/src/styles/dashboard-tokens.css` — Global Dual-Theme Visual Design Tokens.
4. `docs/ui-audit/FRONTEND_UI_AUDIT_REPORT.md` — Comprehensive Frontend UI Audit Report.
5. `docs/ui-audit/UI_COMPONENT_SPECIFICATIONS.md` — Standardized Component Specification Tables (`Table 1`–`Table 67`).
6. `docs/ui-audit/UI_SCREENSHOT_CHECKLIST.md` — Master Screenshot & Annotation Checklist (`Figure 1`–`Figure 112`).
7. `docs/ui-audit/UI_DOCUMENTATION_GAP_ANALYSIS.md` — Documentation Gap Analysis & Pre-Release Verification Notes.
8. `docs/DASHBOARD_ARCHITECTURE.md`, `docs/PBI-04_4.3_USER_STATUS_AND_LIST_REPORT.md`, `docs/PBI-04_4.4_RBAC_ADMIN_DEVOPS_VIEWER_REPORT.md`, `RBAC_Test_Cases_PB08_4.2.csv` — Historical Architecture & RBAC QA Reports.
9. Official Project Figma / Design Mockups *(insert Figma URL if applicable before final Word submission)*.
