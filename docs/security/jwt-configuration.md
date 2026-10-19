# JWT Authentication & API Security Configuration Guide

**Project:** SelfHeal Platform  
**Target:** Node.js Express Backend (`Main_backend`) & React Frontend (`Frontend`)  
**Version:** 1.0.0  
**Updated:** 2026-10-19  

---

## 1. Overview

This document specifies the JWT authentication architecture, API security policies, role-based access control (RBAC), and deployment hardening guidelines for the **SelfHeal** proactive Kubernetes self-healing platform.

---

## 2. Required Environment Variables

All variables should be placed in `.env` within `Main_backend` (never commit real secrets to version control):

| Variable | Description | Development Default | Production Requirement |
| :--- | :--- | :--- | :--- |
| `PORT` | HTTP Port for Backend | `5000` | Configured port (e.g. `5000`) |
| `NODE_ENV` | Runtime environment | `development` | Must be `production` |
| `API_PREFIX` | Base prefix for REST endpoints | `/api/v1` | `/api/v1` |
| `JWT_SECRET` | Secret key used for signing & verifying tokens | dev fallback key | **Required** (min 32 chars, crypto-random) |
| `JWT_EXPIRES_IN` | Token expiration duration | `7d` | `1h` or `1d` recommended |
| `CORS_ORIGIN` | Comma-separated list of allowed origins | `http://localhost:3000` | Exact frontend domain(s) |
| `CLIENT_URL` | Frontend URL for email verification | `http://localhost:3000` | Production UI domain |
| `DATABASE_URL` / `DB_*` | PostgreSQL connection parameters | local postgres | Secure managed PostgreSQL credentials |

---

## 3. How to Generate a Secure Signing Secret

In production, never use predictable phrases or defaults. Generate a cryptographically secure 256-bit key using OpenSSL or Node.js crypto:

### Option A: OpenSSL (Linux / macOS / Git Bash)
```bash
openssl rand -base64 32
```

### Option B: Node.js (Cross-Platform)
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Copy the generated base64 string into your production environment secret manager (e.g., Kubernetes Secret, HashiCorp Vault, AWS Secrets Manager) and map it to `JWT_SECRET`.

> [!CAUTION]
> If `NODE_ENV=production` is detected and `JWT_SECRET` is missing, default, or shorter than 32 characters, the backend server will **immediately fail to start** to prevent security compromise.

---

## 4. Authentication Flow

```
[ Frontend Client ]                    [ Main Backend API ]                     [ PostgreSQL DB ]
         |                                       |                                      |
         | --- 1. POST /auth/login ------------> |                                      |
         |    { email, password }                | --- 2. Query user & hash ----------> |
         |                                       | <--- 3. Return user & status ------- |
         |                                       |                                      |
         |                                       | --- 4. bcrypt.compare()              |
         |                                       | --- 5. Sign JWT (HS256)              |
         | <--- 6. Return { id, email, token } - |                                      |
         |                                       |                                      |
         | [ Store token in storage ]            |                                      |
         |                                       |                                      |
         | --- 7. GET /api/v1/users/profile ---> |                                      |
         |    Header: Bearer <token>             | --- 8. authenticateToken ------------ |
         |                                       |    (verify HS256, expiration, claims)|
         |                                       | --- 9. RBAC / Ownership check ------- |
         | <--- 10. Return Protected Data ------ |                                      |
```

1. **User Login:** Client sends `email` and `password` to `POST /api/v1/auth/login`. Rate limiting (10 attempts / 5 mins) is enforced.
2. **Password Verification:** The backend hashes and compares the password using `bcryptjs` (cost factor 10).
3. **Token Issuance:** Upon success, a signed JWT token containing claims `{ id, email, status, roles }` is issued using `HS256`.
4. **Token Storage:** Frontend stores the token in `localStorage` under `selfheal_auth_token` (or `admin_access_token`).
5. **Authenticated Request:** For every protected API call, the client attaches the HTTP header:
   ```http
   Authorization: Bearer <token>
   ```
6. **Authentication Middleware:** `authenticateToken` checks:
   - Header presence and `Bearer <token>` format.
   - Signature validity and algorithm (`HS256` only).
   - Expiration timestamp.
   - Required claims (`id`, `email`).
   - Account status (`ACTIVE` vs `SUSPENDED`/`INACTIVE`).
7. **Authorization & RBAC:** Route guards (`requireRoles`, `requireSelfOrAdmin`, `requireTenantAccess`) check permissions.

---

## 5. Public vs Protected Endpoints

### Public Endpoints (No Auth Required)
- `GET /` — Service status probe.
- `GET /api/v1/health` — Kubernetes health / readiness check.
- `GET /api/v1/ai/health` — AI Backend connectivity probe.
- `POST /api/v1/auth/register` — New account registration (rate-limited).
- `POST /api/v1/auth/login` — Authentication endpoint (rate-limited).
- `GET /api/v1/auth/verify-email` & `POST /api/v1/auth/verify-email` — Email OTP verification.
- `GET /dashboard/*` — Static asset hosting.
- `WS /api/v1/agent/connect` — Kubernetes Agent connection (authenticated via agent token).

### Protected Endpoints (Requires `Authorization: Bearer <token>`)

| Endpoint | Method | Required Roles | Description |
| :--- | :--- | :--- | :--- |
| `/api/v1/auth/me` | GET / PUT | Any Authenticated User | Current user profile |
| `/api/v1/auth/change-password` | POST | Any Authenticated User | Change password (rate-limited) |
| `/api/v1/users/profile` | GET / PUT | Any Authenticated User | Get / update own profile |
| `/api/v1/users` | GET | `ADMIN`, `SUPER_ADMIN` | List all users (paginated) |
| `/api/v1/users/:id` | GET / PUT | Self OR `ADMIN`, `SUPER_ADMIN` | IDOR-protected user details |
| `/api/v1/users/:id/roles` | GET | `ADMIN`, `SUPER_ADMIN` | View user roles |
| `/api/v1/users/:id/roles` | POST / DELETE | `SUPER_ADMIN` | Grant or revoke user roles |
| `/api/v1/roles` | GET | `ADMIN`, `SUPER_ADMIN` | List all system roles |
| `/api/v1/roles/assign` | POST | `SUPER_ADMIN` | Assign system roles |
| `/api/v1/roles/revoke` | POST / DELETE | `SUPER_ADMIN` | Revoke system roles |
| `/api/v1/telemetry/*` | GET / POST | Any Authenticated User | Metrics sequence & RCA context |
| `/api/v1/ai/predict` | POST | Any Authenticated User | GRU risk prediction execution |
| `/api/v1/ai/rca` | POST | Any Authenticated User | AI root cause analysis execution |
| `/api/v1/rule-engine/*` | GET / POST | Any Authenticated User | Rule evaluation & thresholds |

---

## 6. How to Run Security Tests

The automated test suite verifies 13 distinct security scenarios including token verification, malformed token rejection, signature verification, expiration, IDOR prevention, RBAC privilege isolation, tenant isolation, public route access, rate limiting, and sensitive data masking.

Run the test suite from `Main_backend`:

```bash
cd Main_backend
npm run test:security
```

Expected output:
```text
====================================================
   STARTING AUTOMATED API & JWT SECURITY TESTS
====================================================
  PASS: [1. A valid token can access an authorized protected endpoint]
  PASS: [2. Missing credentials are rejected with 401]
  PASS: [3. Malformed tokens are rejected with 401]
  PASS: [4. Invalid signatures and wrong signing algorithms are rejected with 401]
  PASS: [5. Expired tokens are rejected with 401]
  PASS: [5b. Suspended user tokens are rejected with 403]
  PASS: [6. A user cannot modify another user's profile by supplying a different user ID (IDOR protection)]
  PASS: [7. A Viewer / normal USER cannot execute actions requiring higher privileges]
  PASS: [8. Tenant isolation middleware blocks access when user lacks organization membership]
  PASS: [9. Public endpoints continue to work without authentication]
  PASS: [10. Protected endpoints reject unauthorized requests across all services]
  PASS: [11. Login input validation and rate limiting operate correctly]
  PASS: [12. Sensitive values do not leak in error responses or logs]
====================================================
   TEST RESULTS: 13 PASSED | 0 FAILED
====================================================
```

---

## 7. Remaining Limitations and Future Improvements

1. **Token Revocation Blacklist / Redis:** Currently, JWT tokens remain valid until their expiration timestamp unless an account is marked `SUSPENDED` or `INACTIVE`. In a future iteration, an in-memory or Redis-backed token revocation list (or refresh token rotation) can provide instantaneous token revocation upon user logout or password reset.
2. **Refresh Tokens:** Currently single-access tokens with configurable expiry are used to match the current frontend architecture. If shorter lifetimes (e.g. 15 minutes) are desired, refresh token pairs can be introduced in a future release.
3. **Distributed Rate Limiting:** The current rate limiter uses an in-memory sliding window per instance. When scaling to multiple backend replicas behind a load balancer, backing the rate limiter with Redis will ensure global rate tracking across all nodes.
