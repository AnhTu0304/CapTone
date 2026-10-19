# JWT Authentication & API Security Audit Report

**Project:** SelfHeal — AI-driven Proactive Self-Healing Infrastructure Platform  
**Target Repository:** https://github.com/AnhTu0304/CapTone  
**Audit Date:** 2026-10-19  
**Auditor:** Antigravity Agent  
**Branch:** `feature/jwt-api-security`  
**Status:** Audit Completed — Remediation Required  

---

## 1. Executive Summary

This comprehensive security audit evaluated the authentication architecture, token lifecycle, role-based access control (RBAC), tenant isolation, endpoint exposure, and network security posture of the **SelfHeal** platform (`Main_backend`, `Frontend`, and `AI_backend`).

While basic JWT token generation and bcrypt password hashing exist in `Main_backend`, critical security controls are either missing, partially implemented, or bypassed:
1. **Critical Privilege Escalation:** Administrative and role-assignment endpoints (`/api/v1/roles/assign`, `/api/v1/users/:id/roles`) only require a valid JWT from *any* user and do not check roles. Any normal user can grant themselves `SUPER_ADMIN`.
2. **Missing Authorization on Core AI & Telemetry Endpoints:** `/api/v1/ai/*`, `/api/v1/telemetry/*`, and `/api/v1/rule-engine/*` are completely unauthenticated.
3. **Insecure JWT Configuration:** A hardcoded default secret (`your_super_secret_jwt_key_here`) is used if `JWT_SECRET` is unset, without failing in production. The algorithm whitelist (`HS256`) is not enforced during verification.
4. **Missing Rate Limiting & Overly Permissive CORS:** No rate limiting is configured on `/api/v1/auth/login`, leaving the platform open to brute-force attacks. CORS is set to wildcard `*`.
5. **Horizontal Privilege Escalation (IDOR):** An authenticated user can read or edit any other user's profile (`GET/PUT /api/v1/users/:id`) because resource ownership checks are absent on those routes.

---

## 2. Existing Implementation & Relevant Files

| Component | File Path | Current Status |
| :--- | :--- | :--- |
| **App Entry & Middleware** | `Main_backend/src/app.ts` | Configures Helmet, CORS (`*`), Morgan, body-parser. Missing rate limiter. |
| **Environment Config** | `Main_backend/src/config/env.ts` | Loads dotenv. Hardcoded fallback for `JWT_SECRET`. |
| **Auth Routes** | `Main_backend/src/routes/auth.routes.ts` | Implements `/register`, `/login`, `/me`, `/change-password`, `/verify-email`. |
| **Auth Controller** | `Main_backend/src/controllers/auth.controller.ts` | Coordinates registration, login, token return, password change. |
| **Auth Service** | `Main_backend/src/services/auth.service.ts` | Generates JWT via `jsonwebtoken`, hashes passwords with `bcryptjs`. |
| **Auth Middleware** | `Main_backend/src/middlewares/auth.middleware.ts` | Extracts Bearer token, calls `jwt.verify`. Lacks algorithm restriction and active user validation. |
| **RBAC Middleware** | `Main_backend/src/middlewares/rbac.middleware.ts` | Implements `requireRoles` and `requireSelfOrAdmin`, but **never mounted on routes**. |
| **User Routes** | `Main_backend/src/routes/user.routes.ts` | Protected by `authenticateToken`, but missing role and self-check guards. |
| **System Role Routes** | `Main_backend/src/routes/systemRole.routes.ts` | Mounts role assignment and revocation with only `authenticateToken`. |
| **Telemetry & AI Routes**| `Main_backend/src/routes/telemetry.routes.ts`, `ai.routes.ts`, `ruleEngine.routes.ts` | **Public** — no authentication middleware applied. |
| **Agent WebSocket Auth**| `Main_backend/src/websocket/agentWebSocket.ts` | Authenticates agents via SHA-256 token lookup. |
| **Frontend Auth Client** | `Frontend/src/services/authService.js`, `Frontend/src/context/AuthContext.jsx` | Stores token in `localStorage`, attaches Bearer header on profile requests. |

---

## 3. Working Security Controls

1. **Password Hashing:** Passwords are hashed using `bcryptjs` with salt round 10 before storage in PostgreSQL (`AuthService.register`).
2. **Email OTP Verification:** OTP verification codes are hashed with SHA-256 before storage in `email_verification_tokens` table.
3. **Agent Token Hashing:** Kubernetes Agent tokens are securely compared using SHA-256 hashes (`AgentService.authenticateAgent`).
4. **Input Schema Validation:** Zod schemas are defined and mounted for auth DTOs (`registerSchema`, `loginSchema`, etc.).
5. **Basic Bearer Token Parsing:** `authenticateToken` extracts `Authorization: Bearer <token>` and verifies signature using `jsonwebtoken`.
6. **Error Sanitization in Production:** `errorHandler` suppresses error stack traces when `NODE_ENV === 'production'`.

---

## 4. Security Risks & Vulnerability Analysis

### Risk Ranking Summary

| ID | Finding | Severity | CVSS v3.1 | Status |
| :--- | :--- | :--- | :--- | :--- |
| **SEC-01** | Privilege Escalation to SUPER_ADMIN via unprotected role assignment | **CRITICAL** | 9.8 | Confirmed |
| **SEC-02** | Unauthenticated Telemetry, AI Prediction & Rule Engine Endpoints | **HIGH** | 8.2 | Confirmed |
| **SEC-03** | Insecure JWT Default Secret & Missing Algorithm Whitelist | **HIGH** | 7.5 | Confirmed |
| **SEC-04** | Horizontal Privilege Escalation (IDOR) on User Profile Modification | **HIGH** | 7.4 | Confirmed |
| **SEC-05** | Missing Rate Limiting on Login and Sensitive Endpoints | **MEDIUM** | 5.3 | Confirmed |
| **SEC-06** | Overly Permissive CORS Configuration (`*`) | **MEDIUM** | 5.3 | Confirmed |
| **SEC-07** | Missing Request Body Size Limits | **LOW** | 4.3 | Confirmed |
| **SEC-08** | Inactive/Suspended User Token Invalidation Gap | **LOW** | 4.0 | Confirmed |

---

### Detailed Findings

#### SEC-01 (CRITICAL): Privilege Escalation to SUPER_ADMIN
- **Location:** `Main_backend/src/routes/systemRole.routes.ts` (lines 16-23) & `Main_backend/src/routes/user.routes.ts` (lines 43-47).
- **Vulnerability:** Any authenticated user with a standard `'USER'` role can send a POST request to `/api/v1/roles/assign` or `/api/v1/users/:id/roles` with payload `{"role": "SUPER_ADMIN"}`.
- **Evidence:** `systemRole.routes.ts` applies `router.use(authenticateToken)`, but does **not** invoke `requireRoles('SUPER_ADMIN')`.
- **Impact:** Total compromise of system integrity and administrative capabilities.

#### SEC-02 (HIGH): Unauthenticated Telemetry, AI Prediction & Rule Engine Endpoints
- **Location:** `Main_backend/src/routes/telemetry.routes.ts`, `Main_backend/src/routes/ai.routes.ts`, `Main_backend/src/routes/ruleEngine.routes.ts`.
- **Vulnerability:** Endpoints such as `POST /api/v1/ai/predict`, `POST /api/v1/ai/rca`, and `POST /api/v1/rule-engine/evaluate` do not mount `authenticateToken` or any API key check.
- **Evidence:** Code inspection confirms direct routing to controllers without middleware.
- **Impact:** Unauthenticated attackers can trigger computationally intensive AI models, manipulate rule evaluations, or view internal telemetry metrics.

#### SEC-03 (HIGH): Insecure Default Secret & Missing Algorithm Restriction
- **Location:** `Main_backend/src/config/env.ts` (line 31) & `Main_backend/src/middlewares/auth.middleware.ts` (line 22).
- **Vulnerability:** `config.jwt.secret` falls back to `'your_super_secret_jwt_key_here'` without throwing an error if running in production. Furthermore, `jwt.verify(token, secret)` is called without passing `{ algorithms: ['HS256'] }`.
- **Evidence:** `const decoded = jwt.verify(token, config.jwt.secret) as IJwtPayload;`.
- **Impact:** If deployed with default config, attackers can forge valid tokens using the known key or exploit algorithm confusion.

#### SEC-04 (HIGH): Horizontal Privilege Escalation (IDOR) on Users
- **Location:** `Main_backend/src/routes/user.routes.ts` (lines 50-53).
- **Vulnerability:** `GET /api/v1/users/:id` and `PUT /api/v1/users/:id` allow any logged-in user to query or alter another user's profile simply by changing `:id`.
- **Evidence:** `requireSelfOrAdmin` is defined in `rbac.middleware.ts` but never mounted on `:id` routes.
- **Impact:** Data tampering, unauthorized viewing of private user profile data.

#### SEC-05 (MEDIUM): Missing Rate Limiting on Login
- **Location:** `Main_backend/src/routes/auth.routes.ts` (line 20).
- **Vulnerability:** No rate limiter is applied to `POST /api/v1/auth/login`.
- **Evidence:** `package.json` contains no rate-limiting library (e.g. `express-rate-limit`), and `app.ts` has no rate limiter middleware.
- **Impact:** Susceptible to credential stuffing and brute-force password guessing.

#### SEC-06 (MEDIUM): Overly Permissive CORS
- **Location:** `Main_backend/src/app.ts` (line 15).
- **Vulnerability:** `app.use(cors())` enables cross-origin requests from any origin without restriction.
- **Impact:** Exposes internal API responses to malicious origins in browser contexts.

---

## 5. Public vs Protected Endpoints Classification

### Endpoints That Must Remain Public

| Endpoint | Method | Justification |
| :--- | :--- | :--- |
| `/` | GET | Root health/status probe for load balancers. |
| `/api/v1/health` | GET | Kubernetes liveness and readiness probes. Must not require auth. |
| `/api/v1/auth/login` | POST | Entry point for users to authenticate and receive tokens. |
| `/api/v1/auth/register` | POST | Public user registration. |
| `/api/v1/auth/verify-email` | GET / POST | Allows users to click link from email verification message. |
| `/dashboard/*` | GET | Static UI asset hosting. |
| `/api/v1/agent/connect` | WS | Authenticated via custom Agent Token (in-protocol handshake). |

### Endpoints That Must Be Protected

| Endpoint | Method | Required Protection | Required Roles |
| :--- | :--- | :--- | :--- |
| `/api/v1/auth/me` | GET | `authenticateToken` | Authenticated User |
| `/api/v1/auth/me` | PUT | `authenticateToken` | Authenticated User |
| `/api/v1/auth/change-password` | POST | `authenticateToken` | Authenticated User |
| `/api/v1/auth/send-verification`| POST | `authenticateToken` | Authenticated User |
| `/api/v1/users` | GET | `authenticateToken`, `requireRoles` | `ADMIN`, `SUPER_ADMIN` |
| `/api/v1/users/profile` | GET / PUT | `authenticateToken` | Authenticated User |
| `/api/v1/users/:id` | GET / PUT | `authenticateToken`, `requireSelfOrAdmin` | Self or `ADMIN`, `SUPER_ADMIN` |
| `/api/v1/users/:id/roles` | GET | `authenticateToken`, `requireRoles` | `ADMIN`, `SUPER_ADMIN` |
| `/api/v1/users/:id/roles` | POST / DELETE | `authenticateToken`, `requireRoles` | `SUPER_ADMIN` |
| `/api/v1/roles` | GET | `authenticateToken`, `requireRoles` | `ADMIN`, `SUPER_ADMIN` |
| `/api/v1/roles/assign` | POST | `authenticateToken`, `requireRoles` | `SUPER_ADMIN` |
| `/api/v1/roles/revoke` | POST / DELETE | `authenticateToken`, `requireRoles` | `SUPER_ADMIN` |
| `/api/v1/telemetry/*` | GET / POST | `authenticateToken` | Authenticated User / Admin |
| `/api/v1/ai/*` | GET / POST | `authenticateToken` | Authenticated User / Admin |
| `/api/v1/rule-engine/*` | GET / POST | `authenticateToken` | Authenticated User / Admin |

---

## 6. Prioritized Remediation Plan

1. **Phase 2 (JWT Hardening):**
   - Require `JWT_SECRET` in production or enforce a secure minimum key length; fail startup if missing in production.
   - Restrict JWT sign and verify to `HS256` explicitly.
   - Validate expiration and required claims in `authenticateToken`.
   - Ensure accounts with status `SUSPENDED` or `INACTIVE` cannot authenticate or use active tokens.

2. **Phase 3 (API Security & RBAC):**
   - Apply `requireRoles('SUPER_ADMIN')` on all role assignment and revocation routes.
   - Apply `requireRoles('ADMIN', 'SUPER_ADMIN')` on `GET /api/v1/users`.
   - Apply `requireSelfOrAdmin((req) => req.params.id)` on `/api/v1/users/:id`.
   - Protect `/api/v1/telemetry`, `/api/v1/ai`, and `/api/v1/rule-engine` with `authenticateToken`.
   - Configure strict CORS origin allowlist based on `CORS_ORIGIN` / `CLIENT_URL`.
   - Add rate limiting for `/api/v1/auth/login` and sensitive endpoints.
   - Add explicit JSON request size limit (`100kb`).

3. **Phase 4 (Security Tests):**
   - Implement automated unit and integration tests verifying token lifecycle, algorithm enforcement, RBAC boundaries, IDOR prevention, and public vs protected routing.

4. **Phase 5 (Configuration & Docs):**
   - Provide complete `.env.example` template with security variables documented.
