import test, { describe, before, after } from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import crypto from 'node:crypto';
import { AddressInfo } from 'node:net';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import app from '../app';
import { config } from '../config/env';
import { pool } from '../config/database';
import { closeRedis } from '../config/redis';

const TEST_USER_ID = 'c2222222-0000-4000-8000-000000000001';
const TEST_ADMIN_ID = 'c2222222-0000-4000-8000-000000000002';
const TEST_EMAIL = 'phase2.refresh.user@test.local';
const TEST_ADMIN_EMAIL = 'phase2.refresh.admin@test.local';
const INITIAL_PASSWORD = 'Phase2InitPassword!123';
const ALLOWED_ORIGIN = 'http://localhost:3000';

function parseSetCookies(res: Response): Record<string, { value: string; raw: string; attrs: string[] }> {
  const rawList: string[] =
    typeof (res.headers as any).getSetCookie === 'function'
      ? (res.headers as any).getSetCookie()
      : (res.headers.get('set-cookie') ? [res.headers.get('set-cookie')!] : []);

  const parsed: Record<string, { value: string; raw: string; attrs: string[] }> = {};
  for (const raw of rawList) {
    const parts = raw.split(';').map((p) => p.trim());
    const [nameVal, ...attrs] = parts;
    const eqIdx = nameVal.indexOf('=');
    if (eqIdx > 0) {
      const name = nameVal.slice(0, eqIdx).trim();
      const value = nameVal.slice(eqIdx + 1).trim();
      parsed[name] = { value, raw, attrs };
    }
  }
  return parsed;
}

describe('Sprint C Phase 2 — Refresh Token Lifecycle Hardening (18 Security Scenarios)', () => {
  const testDbName = process.env.DB_NAME || config.db.database;
  let adminPool: Pool;
  let server: http.Server;
  let baseUrl: string;
  let adminJwt: string;

  async function apiFetch(
    path: string,
    opts: {
      method?: string;
      headers?: Record<string, string>;
      body?: any;
      cookies?: Record<string, string>;
    } = {}
  ) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    };
    if (opts.cookies && Object.keys(opts.cookies).length > 0) {
      headers['Cookie'] = Object.entries(opts.cookies)
        .map(([k, v]) => `${k}=${v}`)
        .join('; ');
    }
    const res = await fetch(`${baseUrl}${path}`, {
      method: opts.method || 'GET',
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
    const body = await res.json().catch(() => ({}));
    const setCookies = parseSetCookies(res);
    return { status: res.status, body, setCookies, res };
  }

  async function loginAsTestUser(password = INITIAL_PASSWORD) {
    const res = await apiFetch('/api/v1/auth/login', {
      method: 'POST',
      headers: { Origin: ALLOWED_ORIGIN, 'x-skip-rate-limit': 'true' },
      body: { email: TEST_EMAIL, password },
    });
    assert.strictEqual(res.status, 200, `Login failed: ${JSON.stringify(res.body)}`);
    const refreshCookie = res.setCookies['selfheal_refresh_token'];
    const csrfCookie = res.setCookies['selfheal_csrf_token'];
    assert.ok(refreshCookie?.value, 'Expected selfheal_refresh_token cookie on login');
    assert.ok(csrfCookie?.value, 'Expected selfheal_csrf_token cookie on login');
    return {
      accessToken: res.body?.data?.token as string,
      refreshToken: refreshCookie.value,
      csrfToken: csrfCookie.value,
      refreshCookieRaw: refreshCookie.raw,
      csrfCookieRaw: csrfCookie.raw,
      rawResponse: res,
    };
  }

  before(async () => {
    if (testDbName !== 'aiselfhealing_test') {
      throw new Error(`Safety guard: Phase 2 tests MUST run against aiselfhealing_test, got '${testDbName}'`);
    }

    adminPool = new Pool({
      host: config.db.host,
      port: config.db.port,
      user: 'postgres',
      password: process.env.DB_ADMIN_PASSWORD || config.db.password,
      database: 'aiselfhealing_test',
      max: 5,
    });

    await adminPool.query(`DELETE FROM password_reset_tokens WHERE user_id IN ($1, $2);`, [TEST_USER_ID, TEST_ADMIN_ID]);
    await adminPool.query(`DELETE FROM audit_logs WHERE user_id IN ($1, $2);`, [TEST_USER_ID, TEST_ADMIN_ID]);
    await adminPool.query(`DELETE FROM user_system_roles WHERE user_id IN ($1, $2);`, [TEST_USER_ID, TEST_ADMIN_ID]);
    await adminPool.query(`DELETE FROM users WHERE id IN ($1, $2) OR email IN ($3, $4);`, [
      TEST_USER_ID,
      TEST_ADMIN_ID,
      TEST_EMAIL,
      TEST_ADMIN_EMAIL,
    ]);

    const pwHash = await bcrypt.hash(INITIAL_PASSWORD, 10);
    await adminPool.query(
      `INSERT INTO users (id, email, password_hash, full_name, status, email_verified_at, created_at, updated_at)
       VALUES
         ($1, $3, $5, 'Phase2 Refresh User', 'ACTIVE', NOW(), NOW(), NOW()),
         ($2, $4, $5, 'Phase2 Refresh Admin', 'ACTIVE', NOW(), NOW(), NOW());`,
      [TEST_USER_ID, TEST_ADMIN_ID, TEST_EMAIL, TEST_ADMIN_EMAIL, pwHash]
    );

    const roleRes = await adminPool.query(`SELECT id, name FROM system_roles WHERE name IN ('USER', 'SUPER_ADMIN');`);
    const userRoleId = roleRes.rows.find((r) => r.name === 'USER')?.id;
    const superAdminRoleId = roleRes.rows.find((r) => r.name === 'SUPER_ADMIN')?.id;
    if (userRoleId) {
      await adminPool.query(
        `INSERT INTO user_system_roles (user_id, system_role_id, assigned_at) VALUES ($1, $2, NOW()) ON CONFLICT DO NOTHING;`,
        [TEST_USER_ID, userRoleId]
      );
    }
    if (superAdminRoleId) {
      await adminPool.query(
        `INSERT INTO user_system_roles (user_id, system_role_id, assigned_at) VALUES ($1, $2, NOW()) ON CONFLICT DO NOTHING;`,
        [TEST_ADMIN_ID, superAdminRoleId]
      );
    }

    adminJwt = jwt.sign(
      { id: TEST_ADMIN_ID, email: TEST_ADMIN_EMAIL, status: 'ACTIVE', roles: ['SUPER_ADMIN'], typ: 'access', tv: 1 },
      config.jwt.secret,
      { expiresIn: '15m', algorithm: 'HS256' }
    );

    server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const addr = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  after(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    if (adminPool) {
      await adminPool.query(`DELETE FROM password_reset_tokens WHERE user_id IN ($1, $2);`, [TEST_USER_ID, TEST_ADMIN_ID]).catch(() => {});
      await adminPool.query(`DELETE FROM audit_logs WHERE user_id IN ($1, $2);`, [TEST_USER_ID, TEST_ADMIN_ID]).catch(() => {});
      await adminPool.query(`DELETE FROM user_system_roles WHERE user_id IN ($1, $2);`, [TEST_USER_ID, TEST_ADMIN_ID]).catch(() => {});
      await adminPool.query(`DELETE FROM users WHERE id IN ($1, $2);`, [TEST_USER_ID, TEST_ADMIN_ID]).catch(() => {});
      await adminPool.end();
    }
    await pool.end().catch(() => {});
    await closeRedis().catch(() => {});
  });

  test('1, 2, 3, 15 & 17. Login, cookie attributes, rotation chain, DB hash-only storage, and zero log leakage', async () => {
    const capturedLogs: string[] = [];
    const origLog = console.log;
    const origWarn = console.warn;
    const origErr = console.error;
    const capture = (...args: any[]) => {
      capturedLogs.push(args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '));
    };
    console.log = capture;
    console.warn = capture;
    console.error = capture;

    let rt1 = '';
    let rt2 = '';
    try {
      const login = await loginAsTestUser();
      rt1 = login.refreshToken;

      // 15. Cookie attributes check (HttpOnly, SameSite=Lax, Path=/api/v1/auth, no broad Domain)
      assert.match(login.refreshCookieRaw, /HttpOnly/i, 'Refresh cookie MUST be HttpOnly');
      assert.match(login.refreshCookieRaw, /SameSite=Lax/i, 'Refresh cookie MUST set SameSite=Lax');
      assert.match(login.refreshCookieRaw, /Path=\/api\/v1\/auth/i, 'Refresh cookie MUST scope Path=/api/v1/auth');
      assert.doesNotMatch(login.refreshCookieRaw, /Domain=/i, 'Refresh cookie must NOT set overly broad Domain');
      // Refresh token must NOT be returned in JSON body
      assert.strictEqual(login.rawResponse.body?.data?.refresh_token, undefined, 'Raw refresh token must NOT leak in JSON body');

      // Short-lived Access JWT (~15m) with typ & tv claims
      const decodedAccess = jwt.decode(login.accessToken) as any;
      assert.strictEqual(decodedAccess?.typ, 'access');
      assert.ok(decodedAccess?.exp && decodedAccess?.iat);
      assert.ok(decodedAccess.exp - decodedAccess.iat <= 16 * 60, 'Access JWT TTL must be <= 15m');

      // 17. Raw refresh token MUST NOT appear in refresh_tokens table
      const rawInDb = await adminPool.query(`SELECT id FROM refresh_tokens WHERE token_hash = $1;`, [rt1]);
      assert.strictEqual(rawInDb.rows.length, 0, 'Raw refresh token must never be stored unhashed in DB');

      // 1 & 2. Refresh rotates rt1 -> rt2
      const refresh1 = await apiFetch('/api/v1/auth/refresh', {
        method: 'POST',
        headers: {
          Origin: ALLOWED_ORIGIN,
          'X-CSRF-Token': login.csrfToken,
          'x-skip-rate-limit': 'true',
        },
        cookies: {
          selfheal_refresh_token: rt1,
          selfheal_csrf_token: login.csrfToken,
        },
      });
      assert.strictEqual(refresh1.status, 200, `Expected 200 refresh, got ${refresh1.status}: ${JSON.stringify(refresh1.body)}`);
      rt2 = refresh1.setCookies['selfheal_refresh_token']?.value || '';
      const csrf2 = refresh1.setCookies['selfheal_csrf_token']?.value || '';
      assert.ok(rt2 && rt2 !== rt1, 'Rotation must issue a new distinct refresh token');
      assert.ok(refresh1.body?.data?.token, 'Refresh must return a new access token');

      // 3. New token rt2 can refresh cleanly to rt3
      const refresh2 = await apiFetch('/api/v1/auth/refresh', {
        method: 'POST',
        headers: {
          Origin: ALLOWED_ORIGIN,
          'X-CSRF-Token': csrf2,
          'x-skip-rate-limit': 'true',
        },
        cookies: {
          selfheal_refresh_token: rt2,
          selfheal_csrf_token: csrf2,
        },
      });
      assert.strictEqual(refresh2.status, 200);
      const rt3 = refresh2.setCookies['selfheal_refresh_token']?.value || '';
      assert.ok(rt3 && rt3 !== rt2);

      // Verify chain metadata in DB (same family, used_at & replaced_by_token_id set)
      const chainRes = await adminPool.query(
        `SELECT rt.id, rt.family_id, rt.parent_token_id, rt.replaced_by_token_id, rt.used_at, rt.revoked_at
         FROM refresh_tokens rt
         JOIN user_sessions us ON us.id = rt.session_id
         WHERE us.user_id = $1
         ORDER BY rt.issued_at ASC;`,
        [TEST_USER_ID]
      );
      assert.strictEqual(chainRes.rows.length, 3);
      assert.strictEqual(chainRes.rows[0].family_id, chainRes.rows[1].family_id);
      assert.strictEqual(chainRes.rows[1].family_id, chainRes.rows[2].family_id);
      assert.ok(chainRes.rows[0].used_at, 'Old token #1 must have used_at set');
      assert.strictEqual(chainRes.rows[0].replaced_by_token_id, chainRes.rows[1].id);
      assert.strictEqual(chainRes.rows[1].parent_token_id, chainRes.rows[0].id);
      assert.strictEqual(chainRes.rows[2].used_at, null, 'Newest token #3 should be active');

      // 17. Raw refresh tokens MUST NOT appear in captured logs or audit_logs
      const joinedLogs = capturedLogs.join('\n');
      assert.strictEqual(joinedLogs.includes(rt1), false, 'Raw refresh token rt1 leaked to logs!');
      assert.strictEqual(joinedLogs.includes(rt2), false, 'Raw refresh token rt2 leaked to logs!');
      const auditLeak = await adminPool.query(
        `SELECT id FROM audit_logs WHERE user_id = $1 AND (description ILIKE $2 OR metadata::text ILIKE $2 OR description ILIKE $3 OR metadata::text ILIKE $3);`,
        [TEST_USER_ID, `%${rt1}%`, `%${rt2}%`]
      );
      assert.strictEqual(auditLeak.rows.length, 0, 'Raw refresh token leaked to audit_logs!');
    } finally {
      console.log = origLog;
      console.warn = origWarn;
      console.error = origErr;
    }
  });

  test('4 & 5. Old refresh token reuse triggers family revocation and invalidates active descendants', async () => {
    const login = await loginAsTestUser();
    const r1 = await apiFetch('/api/v1/auth/refresh', {
      method: 'POST',
      headers: { Origin: ALLOWED_ORIGIN, 'X-CSRF-Token': login.csrfToken, 'x-skip-rate-limit': 'true' },
      cookies: { selfheal_refresh_token: login.refreshToken, selfheal_csrf_token: login.csrfToken },
    });
    assert.strictEqual(r1.status, 200);
    const rt2 = r1.setCookies['selfheal_refresh_token'].value;
    const csrf2 = r1.setCookies['selfheal_csrf_token'].value;

    // 4. Replay old token rt1 -> MUST return 401 and revoke entire family
    const replay = await apiFetch('/api/v1/auth/refresh', {
      method: 'POST',
      headers: { Origin: ALLOWED_ORIGIN, 'X-CSRF-Token': csrf2, 'x-skip-rate-limit': 'true' },
      cookies: { selfheal_refresh_token: login.refreshToken, selfheal_csrf_token: csrf2 },
    });
    assert.strictEqual(replay.status, 401);

    // 5. Legitimate descendant rt2 MUST now be rejected (family revoked!)
    const useRt2AfterRevoke = await apiFetch('/api/v1/auth/refresh', {
      method: 'POST',
      headers: { Origin: ALLOWED_ORIGIN, 'X-CSRF-Token': csrf2, 'x-skip-rate-limit': 'true' },
      cookies: { selfheal_refresh_token: rt2, selfheal_csrf_token: csrf2 },
    });
    assert.strictEqual(useRt2AfterRevoke.status, 401);

    // Verify reuse_detected_at recorded in DB
    const reuseRes = await adminPool.query(
      `SELECT count(*)::int AS c FROM refresh_tokens WHERE reuse_detected_at IS NOT NULL;`
    );
    assert.ok(reuseRes.rows[0].c >= 1, 'Expected reuse_detected_at to be persisted');
  });

  test('6. Two simultaneous refresh requests on the same token produce at most ONE valid rotation (atomic locking)', async () => {
    const login = await loginAsTestUser();
    const reqOpts = {
      method: 'POST',
      headers: { Origin: ALLOWED_ORIGIN, 'X-CSRF-Token': login.csrfToken, 'x-skip-rate-limit': 'true' },
      cookies: { selfheal_refresh_token: login.refreshToken, selfheal_csrf_token: login.csrfToken },
    };

    const [resA, resB] = await Promise.all([
      apiFetch('/api/v1/auth/refresh', reqOpts),
      apiFetch('/api/v1/auth/refresh', reqOpts),
    ]);

    const statuses = [resA.status, resB.status].sort((a, b) => a - b);
    assert.deepStrictEqual(statuses, [200, 401], `Expected exactly one 200 and one 401 on concurrent refresh, got ${JSON.stringify(statuses)}`);

    // Check DB: that token has at most 1 child (no split-brain descendants!)
    const childrenRes = await adminPool.query(
      `SELECT parent_token_id, count(*)::int AS child_count
       FROM refresh_tokens
       WHERE parent_token_id IS NOT NULL
       GROUP BY parent_token_id
       HAVING count(*) > 1;`
    );
    assert.strictEqual(childrenRes.rows.length, 0, 'Concurrent refresh MUST NEVER produce multiple descendants from one token');
  });

  test('7, 8 & malformed. Expired, revoked, and malformed refresh tokens return identical generic 401', async () => {
    const login = await loginAsTestUser();

    // 7. Force expire latest token in DB
    await adminPool.query(
      `UPDATE refresh_tokens SET expires_at = NOW() - interval '1 minute'
       WHERE session_id IN (SELECT id FROM user_sessions WHERE user_id = $1 AND revoked_at IS NULL);`,
      [TEST_USER_ID]
    );
    const expRes = await apiFetch('/api/v1/auth/refresh', {
      method: 'POST',
      headers: { Origin: ALLOWED_ORIGIN, 'X-CSRF-Token': login.csrfToken, 'x-skip-rate-limit': 'true' },
      cookies: { selfheal_refresh_token: login.refreshToken, selfheal_csrf_token: login.csrfToken },
    });
    assert.strictEqual(expRes.status, 401);

    // 8. Revoked refresh token
    const login2 = await loginAsTestUser();
    await adminPool.query(
      `UPDATE user_sessions SET revoked_at = NOW(), revoked_reason = 'TEST_REVOKED' WHERE user_id = $1 AND revoked_at IS NULL;`,
      [TEST_USER_ID]
    );
    const revRes = await apiFetch('/api/v1/auth/refresh', {
      method: 'POST',
      headers: { Origin: ALLOWED_ORIGIN, 'X-CSRF-Token': login2.csrfToken, 'x-skip-rate-limit': 'true' },
      cookies: { selfheal_refresh_token: login2.refreshToken, selfheal_csrf_token: login2.csrfToken },
    });
    assert.strictEqual(revRes.status, 401);

    // Malformed / unknown token
    const malRes = await apiFetch('/api/v1/auth/refresh', {
      method: 'POST',
      headers: { Origin: ALLOWED_ORIGIN, 'X-CSRF-Token': login2.csrfToken, 'x-skip-rate-limit': 'true' },
      cookies: { selfheal_refresh_token: 'malformed!!token', selfheal_csrf_token: login2.csrfToken },
    });
    assert.strictEqual(malRes.status, 401);

    // Responses must not disclose whether token exists in DB
    assert.strictEqual(expRes.body?.message, malRes.body?.message);
    assert.strictEqual(revRes.body?.message, malRes.body?.message);
  });

  test('9. Logout revokes refresh session and clears cookies', async () => {
    const login = await loginAsTestUser();
    const logoutRes = await apiFetch('/api/v1/auth/logout', {
      method: 'POST',
      headers: {
        Origin: ALLOWED_ORIGIN,
        Authorization: `Bearer ${login.accessToken}`,
        'X-CSRF-Token': login.csrfToken,
      },
      cookies: {
        selfheal_refresh_token: login.refreshToken,
        selfheal_csrf_token: login.csrfToken,
      },
    });
    assert.strictEqual(logoutRes.status, 200);

    // Refresh after logout MUST fail with 401
    const afterLogout = await apiFetch('/api/v1/auth/refresh', {
      method: 'POST',
      headers: { Origin: ALLOWED_ORIGIN, 'X-CSRF-Token': login.csrfToken, 'x-skip-rate-limit': 'true' },
      cookies: { selfheal_refresh_token: login.refreshToken, selfheal_csrf_token: login.csrfToken },
    });
    assert.strictEqual(afterLogout.status, 401);
  });

  test('10 & 11. Password change and password reset revoke all active sessions & invalidate old access tokens', async () => {
    const sess1 = await loginAsTestUser();
    const sess2 = await loginAsTestUser();
    const newPw = 'Phase2ChangedPassword!456';

    // 10. Password change
    const chgRes = await apiFetch('/api/v1/auth/change-password', {
      method: 'POST',
      headers: {
        Origin: ALLOWED_ORIGIN,
        Authorization: `Bearer ${sess1.accessToken}`,
        'x-skip-rate-limit': 'true',
      },
      body: { old_password: INITIAL_PASSWORD, new_password: newPw },
    });
    assert.strictEqual(chgRes.status, 200);

    // Both old refresh tokens AND old access tokens must fail now (token_version bumped!)
    const meOld = await apiFetch('/api/v1/auth/me', {
      headers: { Authorization: `Bearer ${sess2.accessToken}` },
    });
    assert.strictEqual(meOld.status, 401, 'Old access token MUST be invalidated via token_version on password change');

    const refOld = await apiFetch('/api/v1/auth/refresh', {
      method: 'POST',
      headers: { Origin: ALLOWED_ORIGIN, 'X-CSRF-Token': sess2.csrfToken, 'x-skip-rate-limit': 'true' },
      cookies: { selfheal_refresh_token: sess2.refreshToken, selfheal_csrf_token: sess2.csrfToken },
    });
    assert.strictEqual(refOld.status, 401, 'Old refresh token MUST be revoked on password change');

    // 11. Password reset flow via password_reset_tokens
    const sess3 = await loginAsTestUser(newPw);
    const rawResetToken = crypto.randomBytes(32).toString('hex');
    const resetHash = crypto.createHash('sha256').update(rawResetToken).digest('hex');
    await adminPool.query(
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at, created_at)
       VALUES ($1, $2, NOW() + interval '15 minutes', NOW());`,
      [TEST_USER_ID, resetHash]
    );

    const resetRes = await apiFetch('/api/v1/auth/reset-password', {
      method: 'POST',
      headers: { Origin: ALLOWED_ORIGIN, 'x-skip-rate-limit': 'true' },
      body: { token: rawResetToken, new_password: INITIAL_PASSWORD },
    });
    assert.strictEqual(resetRes.status, 200);

    // Session created before password reset must now be invalidated
    const meBeforeReset = await apiFetch('/api/v1/auth/me', {
      headers: { Authorization: `Bearer ${sess3.accessToken}` },
    });
    assert.strictEqual(meBeforeReset.status, 401);

    const refBeforeReset = await apiFetch('/api/v1/auth/refresh', {
      method: 'POST',
      headers: { Origin: ALLOWED_ORIGIN, 'X-CSRF-Token': sess3.csrfToken, 'x-skip-rate-limit': 'true' },
      cookies: { selfheal_refresh_token: sess3.refreshToken, selfheal_csrf_token: sess3.csrfToken },
    });
    assert.strictEqual(refBeforeReset.status, 401);
  });

  test('12. Account disable revokes all refresh tokens & blocks access/refresh', async () => {
    const sess = await loginAsTestUser();
    const disableRes = await apiFetch(`/api/v1/users/${TEST_USER_ID}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminJwt}` },
      body: { status: 'SUSPENDED' },
    });
    assert.strictEqual(disableRes.status, 200);

    const refDisabled = await apiFetch('/api/v1/auth/refresh', {
      method: 'POST',
      headers: { Origin: ALLOWED_ORIGIN, 'X-CSRF-Token': sess.csrfToken, 'x-skip-rate-limit': 'true' },
      cookies: { selfheal_refresh_token: sess.refreshToken, selfheal_csrf_token: sess.csrfToken },
    });
    assert.strictEqual(refDisabled.status, 401);

    const meDisabled = await apiFetch('/api/v1/auth/me', {
      headers: { Authorization: `Bearer ${sess.accessToken}` },
    });
    assert.ok([401, 403].includes(meDisabled.status));

    // Re-activate user for subsequent tests
    const reactivate = await apiFetch(`/api/v1/users/${TEST_USER_ID}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminJwt}` },
      body: { status: 'ACTIVE' },
    });
    assert.strictEqual(reactivate.status, 200);
  });

  test('13, 14 & 16. CSRF rejection, invalid/missing Origin rejection, and refresh rate limiting', async () => {
    const login = await loginAsTestUser();

    // 13. Missing or mismatched CSRF token -> 403
    const noCsrf = await apiFetch('/api/v1/auth/refresh', {
      method: 'POST',
      headers: { Origin: ALLOWED_ORIGIN, 'x-skip-rate-limit': 'true' },
      cookies: { selfheal_refresh_token: login.refreshToken, selfheal_csrf_token: login.csrfToken },
    });
    assert.strictEqual(noCsrf.status, 403);

    const badCsrf = await apiFetch('/api/v1/auth/refresh', {
      method: 'POST',
      headers: { Origin: ALLOWED_ORIGIN, 'X-CSRF-Token': 'wrong_csrf_token', 'x-skip-rate-limit': 'true' },
      cookies: { selfheal_refresh_token: login.refreshToken, selfheal_csrf_token: login.csrfToken },
    });
    assert.strictEqual(badCsrf.status, 403);

    // 14. Invalid Origin AND missing Origin -> 403
    const evilOrigin = await apiFetch('/api/v1/auth/refresh', {
      method: 'POST',
      headers: { Origin: 'https://evil-attacker.example', 'X-CSRF-Token': login.csrfToken, 'x-skip-rate-limit': 'true' },
      cookies: { selfheal_refresh_token: login.refreshToken, selfheal_csrf_token: login.csrfToken },
    });
    assert.strictEqual(evilOrigin.status, 403);

    const missingOrigin = await apiFetch('/api/v1/auth/refresh', {
      method: 'POST',
      headers: { 'X-CSRF-Token': login.csrfToken, 'x-skip-rate-limit': 'true' },
      cookies: { selfheal_refresh_token: login.refreshToken, selfheal_csrf_token: login.csrfToken },
    });
    assert.strictEqual(missingOrigin.status, 403);

    // 16. Rate limit triggers 429 on burst refresh calls (without x-skip-rate-limit)
    let hit429 = false;
    for (let i = 0; i < 35; i++) {
      const r = await apiFetch('/api/v1/auth/refresh', {
        method: 'POST',
        headers: { Origin: ALLOWED_ORIGIN, 'X-CSRF-Token': login.csrfToken },
        cookies: { selfheal_refresh_token: 'invalid_for_rate_limit_probe', selfheal_csrf_token: login.csrfToken },
      });
      if (r.status === 429) {
        hit429 = true;
        break;
      }
    }
    assert.strictEqual(hit429, true, 'Expected 429 rate limit on excessive /auth/refresh attempts');
  });

  test('15b & admin/self revoke-all. HTTPS sets Secure cookie; logout-all and admin revoke-sessions invalidate all sessions', async () => {
    // 15b. Verify Secure attribute is set when request arrives via HTTPS proxy
    const httpsLogin = await apiFetch('/api/v1/auth/login', {
      method: 'POST',
      headers: {
        Origin: ALLOWED_ORIGIN,
        'X-Forwarded-Proto': 'https',
        'x-skip-rate-limit': 'true',
      },
      body: { email: TEST_EMAIL, password: INITIAL_PASSWORD },
    });
    assert.strictEqual(httpsLogin.status, 200);
    const httpsRefreshCookie = httpsLogin.setCookies['selfheal_refresh_token'];
    const lowerAttrs = (httpsRefreshCookie?.attrs || []).map((a) => a.toLowerCase());
    assert.ok(lowerAttrs.includes('secure'), 'Refresh cookie MUST include Secure over HTTPS');
    assert.ok(lowerAttrs.includes('httponly'), 'Refresh cookie MUST include HttpOnly');

    // Second concurrent session
    const sessB = await loginAsTestUser();

    // User self logout-all revokes BOTH sessions
    const logoutAllRes = await apiFetch('/api/v1/auth/logout-all', {
      method: 'POST',
      headers: {
        Origin: ALLOWED_ORIGIN,
        Authorization: `Bearer ${sessB.accessToken}`,
        'X-CSRF-Token': sessB.csrfToken,
        'x-skip-rate-limit': 'true',
      },
      cookies: {
        selfheal_refresh_token: sessB.refreshToken,
        selfheal_csrf_token: sessB.csrfToken,
      },
    });
    assert.strictEqual(logoutAllRes.status, 200);

    const refA = await apiFetch('/api/v1/auth/refresh', {
      method: 'POST',
      headers: { Origin: ALLOWED_ORIGIN, 'X-CSRF-Token': httpsLogin.setCookies['selfheal_csrf_token'].value, 'x-skip-rate-limit': 'true' },
      cookies: {
        selfheal_refresh_token: httpsRefreshCookie.value,
        selfheal_csrf_token: httpsLogin.setCookies['selfheal_csrf_token'].value,
      },
    });
    assert.strictEqual(refA.status, 401, 'Session A must be revoked after logout-all');

    // Admin force-revoke sessions endpoint
    const sessC = await loginAsTestUser();
    const adminRevoke = await apiFetch(`/api/v1/users/${TEST_USER_ID}/revoke-sessions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminJwt}` },
      body: { reason: 'ADMIN_FORCE_LOGOUT_TEST' },
    });
    assert.strictEqual(adminRevoke.status, 200);

    const refC = await apiFetch('/api/v1/auth/refresh', {
      method: 'POST',
      headers: { Origin: ALLOWED_ORIGIN, 'X-CSRF-Token': sessC.csrfToken, 'x-skip-rate-limit': 'true' },
      cookies: { selfheal_refresh_token: sessC.refreshToken, selfheal_csrf_token: sessC.csrfToken },
    });
    assert.strictEqual(refC.status, 401, 'Session C must be revoked after admin revoke-sessions');

    const meC = await apiFetch('/api/v1/auth/me', {
      headers: { Authorization: `Bearer ${sessC.accessToken}` },
    });
    assert.strictEqual(meC.status, 401, 'Access JWT from before admin revoke-sessions must fail token_version check');
  });
});
