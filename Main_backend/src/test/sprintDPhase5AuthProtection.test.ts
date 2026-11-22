import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import crypto from 'node:crypto';
import http from 'node:http';
import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
process.env.NODE_ENV = 'test';
process.env.DB_NAME = 'aiselfhealing_test';
process.env.REDIS_ENABLED = 'false';

import app from '../app';
import { pool } from '../config/database';
import { config } from '../config/env';
import { closeRedis } from '../config/redis';
import * as rateLimitMod from '../middlewares/rateLimit.middleware';
import { EmailService } from '../services/email.service';
import { AuthService } from '../services/auth.service';
import { RefreshTokenService } from '../services/refreshToken.service';
import { SessionRevocationService } from '../services/sessionRevocation.service';

const BASE_USER_ID = 'd5550000-0000-4000-8000-000000000001';
const TEST_EMAIL = 'sd05-reset@test.local';

async function httpReq(
  server: http.Server,
  method: string,
  urlPath: string,
  headers: Record<string, string> = {},
  body?: unknown
): Promise<{ status: number; headers: http.IncomingHttpHeaders; json: any; text: string }> {
  const addr = server.address() as { port: number };
  return new Promise((resolve, reject) => {
    const payload = body !== undefined ? JSON.stringify(body) : undefined;
    const req = http.request(
      {
        host: '127.0.0.1',
        port: addr.port,
        path: urlPath,
        method,
        headers: {
          ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}),
          ...headers,
        },
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          let parsed: any = null;
          try {
            parsed = JSON.parse(data);
          } catch {
            parsed = null;
          }
          resolve({ status: res.statusCode || 0, headers: res.headers, json: parsed, text: data });
        });
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

describe('Sprint D Phase 5 (SD-05): Authentication & API Protection', () => {
  let server: http.Server;

  before(async () => {
    await pool.query(
      `INSERT INTO users (id, email, password_hash, full_name, status)
       VALUES ($1, $2, '$2b$10$dummyhashvaluefortestonly00000000000000000000000', '<script>alert("xss")</script>', 'ACTIVE')
       ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, status = 'ACTIVE'`,
      [BASE_USER_ID, TEST_EMAIL]
    );
    server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  });

  after(async () => {
    EmailService.setTransporterForTesting(null);
    SessionRevocationService.setSimulatedOffline(false);
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await closeRedis().catch(() => {});
    await pool.end().catch(() => {});
  });

  test('1. Distributed rateLimiter shares counters across instances via Redis store & handles fail-closed', async () => {
    const sharedCounts = new Map<string, { count: number; expiresAt: number }>();
    const mockRedisStore = {
      isReady: () => true,
      incr: async (key: string) => {
        const cur = sharedCounts.get(key) || { count: 0, expiresAt: Date.now() + 60000 };
        cur.count += 1;
        sharedCounts.set(key, cur);
        return cur.count;
      },
      pexpire: async (key: string, ms: number) => {
        const cur = sharedCounts.get(key);
        if (cur) cur.expiresAt = Date.now() + ms;
        return 1;
      },
      pttl: async (key: string) => {
        const cur = sharedCounts.get(key);
        return cur ? Math.max(0, cur.expiresAt - Date.now()) : 60000;
      },
    };

    const limiterA = (rateLimitMod as any).rateLimiter({
      windowMs: 60000,
      max: 3,
      keyPrefix: 'sd05:dist-test',
      redisStore: mockRedisStore,
    });
    const limiterB = (rateLimitMod as any).rateLimiter({
      windowMs: 60000,
      max: 3,
      keyPrefix: 'sd05:dist-test',
      redisStore: mockRedisStore,
    });

    const invoke = (mw: any, ip: string) =>
      new Promise<{ status: number; retryAfter?: any; err?: any }>((resolve) => {
        const headers: Record<string, any> = {};
        const req: any = { ip, headers: {}, socket: { remoteAddress: ip }, user: undefined };
        const res: any = { setHeader: (k: string, v: any) => (headers[k] = v) };
        mw(req, res, (err?: any) => {
          resolve({ status: err ? err.statusCode || 500 : 200, retryAfter: headers['Retry-After'], err });
        });
      });

    assert.strictEqual((await invoke(limiterA, '198.51.100.10')).status, 200);
    assert.strictEqual((await invoke(limiterA, '198.51.100.10')).status, 200);
    assert.strictEqual((await invoke(limiterB, '198.51.100.10')).status, 200);
    const fourth = await invoke(limiterB, '198.51.100.10');
    assert.strictEqual(fourth.status, 429, '4th request hit on instance B must trigger shared 429 limit');
    assert.ok(fourth.retryAfter, 'Retry-After header must be present');

    const failClosedLimiter = (rateLimitMod as any).rateLimiter({
      windowMs: 60000,
      max: 5,
      keyPrefix: 'sd05:fail-closed',
      failClosedOnRedisDown: true,
      redisStore: {
        isReady: () => false,
        incr: async () => 1,
        pexpire: async () => 1,
      },
    });
    const prevEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const downed = await invoke(failClosedLimiter, '198.51.100.11');
      assert.strictEqual(downed.status, 503, 'Fail-closed auth limiter must return 503 in production when Redis is down');
    } finally {
      process.env.NODE_ENV = prevEnv;
    }
  });

  test('2. Express trust proxy matches config.trustProxyHops (1) preventing X-Forwarded-For spoofing', () => {
    const tp = app.get('trust proxy');
    assert.strictEqual(tp, config.trustProxyHops, 'app trust proxy must use configured numeric hop count');
    assert.notStrictEqual(tp, true, 'trust proxy must NEVER be boolean true');
  });

  test('3. /forgot-password validates Zod email, prevents enumeration, dispatches escaped email, and /reset-password completes flow', async () => {
    const sentMails: any[] = [];
    EmailService.setTransporterForTesting({
      sendMail: async (opts: any) => {
        sentMails.push(opts);
        return { messageId: 'sd05-test-msg-1' };
      },
    } as any);

    // Invalid email must be rejected by Zod schema (400)
    const badRes = await httpReq(server, 'POST', '/api/v1/auth/forgot-password', {}, { email: 'not-an-email' });
    assert.strictEqual(badRes.status, 400);

    // Non-existent user returns neutral 200 and sends NO email
    const unknownRes = await httpReq(server, 'POST', '/api/v1/auth/forgot-password', {}, { email: 'nobody@sd05.local' });
    assert.strictEqual(unknownRes.status, 200);
    assert.strictEqual(sentMails.length, 0);

    // Active user receives escaped HTML reset link via configured clientUrl
    const okRes = await httpReq(server, 'POST', '/api/v1/auth/forgot-password', {}, { email: TEST_EMAIL });
    assert.strictEqual(okRes.status, 200);
    assert.strictEqual(sentMails.length, 1, 'Expected EmailService to dispatch password reset email');

    const mailHtml: string = sentMails[0].html || '';
    assert.ok(!mailHtml.includes('<script>alert("xss")</script>'), 'Display name must be HTML-escaped');
    assert.ok(mailHtml.includes('&lt;script&gt;'), 'Escaped display name expected in HTML');
    const urlMatch = mailHtml.match(/\/reset-password\?token=([0-9a-f]{64})/);
    assert.ok(urlMatch, 'Email HTML must contain /reset-password?token=<64-hex>');
    const resetToken = urlMatch![1];

    // Create active refresh session to verify password reset revokes all sessions
    const session = await RefreshTokenService.createSession(BASE_USER_ID, { ipAddress: '127.0.0.1', userAgent: 'sd05' });

    // Short password rejected by Zod schema (400)
    const shortPw = await httpReq(
      server,
      'POST',
      '/api/v1/auth/reset-password',
      {},
      { token: resetToken, new_password: '123' }
    );
    assert.strictEqual(shortPw.status, 400);

    // Valid reset succeeds and revokes session
    const resetRes = await httpReq(
      server,
      'POST',
      '/api/v1/auth/reset-password',
      {},
      { token: resetToken, new_password: 'NewStrongPassword123!' }
    );
    assert.strictEqual(resetRes.status, 200);

    const sessionRow = await pool.query(`SELECT revoked_at FROM user_sessions WHERE id = $1`, [session.sessionId]);
    assert.ok(sessionRow.rows[0]?.revoked_at, 'Refresh session must be revoked after password reset');
  });

  test('4. POST /auth/logout still revokes PostgreSQL refresh session and clears cookies if Redis revokeToken fails', async () => {
    const session = await RefreshTokenService.createSession(BASE_USER_ID, { ipAddress: '127.0.0.1', userAgent: 'sd05-logout' });
    const origRevoke = SessionRevocationService.revokeToken;
    SessionRevocationService.revokeToken = async () => {
      throw new Error('Simulated Redis outage during logout');
    };

    try {
      const res = await httpReq(
        server,
        'POST',
        '/api/v1/auth/logout',
        {
          Origin: config.email.clientUrl,
          Cookie: `${config.refreshToken.cookieName}=${session.rawRefreshToken}; ${config.refreshToken.csrfCookieName}=${session.csrfToken}`,
          'X-CSRF-Token': session.csrfToken,
          Authorization: 'Bearer dummy.jwt.token',
        },
        {}
      );
      assert.strictEqual(res.status, 200, 'Logout must not fail completely when Redis is unreachable');
      const setCookies = res.headers['set-cookie'] || [];
      assert.ok(
        setCookies.some((c) => c.startsWith(`${config.refreshToken.cookieName}=;`) && c.includes('Max-Age=0')),
        'Refresh cookie must be cleared'
      );
      const row = await pool.query(`SELECT revoked_at, revoked_reason FROM user_sessions WHERE id = $1`, [session.sessionId]);
      assert.ok(row.rows[0]?.revoked_at, 'PostgreSQL refresh session MUST be revoked despite Redis error');
      assert.strictEqual(row.rows[0]?.revoked_reason, 'LOGOUT');
    } finally {
      SessionRevocationService.revokeToken = origRevoke;
    }
  });
});
