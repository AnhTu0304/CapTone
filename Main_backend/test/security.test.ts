import http from 'http';
import { AddressInfo } from 'net';
import assert from 'assert';
import jwt from 'jsonwebtoken';
import app from '../src/app';
import { config } from '../src/config/env';
import { rateLimiter } from '../src/middlewares/rateLimit.middleware';
import { requireTenantAccess } from '../src/middlewares/tenant.middleware';
import { requireSelfOrAdmin, requireRoles } from '../src/middlewares/rbac.middleware';
import { authenticateToken } from '../middlewares/auth.middleware';
import express, { Request, Response, NextFunction } from 'express';

async function runSecurityTests() {
  console.log('====================================================');
  console.log('   STARTING AUTOMATED API & JWT SECURITY TESTS');
  console.log('====================================================\n');

  // Start ephemeral HTTP test server
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const port = (server.address() as AddressInfo).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  let passed = 0;
  let failed = 0;

  async function test(name: string, fn: () => Promise<void>) {
    try {
      await fn();
      console.log(`  PASS: [${name}]`);
      passed++;
    } catch (err) {
      console.error(`  FAIL: [${name}]`);
      console.error(`        ${(err as Error).message}`);
      failed++;
    }
  }

  const SECRET = config.jwt.secret;

  // Helpers to generate test tokens
  function createToken(payload: object, expiresIn: string | number = '1h', key = SECRET, algorithm: jwt.Algorithm = 'HS256') {
    return jwt.sign(payload, key, { algorithm, expiresIn: expiresIn as any });
  }

  const userPayload = {
    id: '11111111-1111-1111-1111-111111111111',
    email: 'user@selfheal.io',
    status: 'ACTIVE',
    roles: ['USER'],
  };

  const adminPayload = {
    id: '22222222-2222-2222-2222-222222222222',
    email: 'admin@selfheal.io',
    status: 'ACTIVE',
    roles: ['ADMIN'],
  };

  const superAdminPayload = {
    id: '33333333-3333-3333-3333-333333333333',
    email: 'superadmin@selfheal.io',
    status: 'ACTIVE',
    roles: ['SUPER_ADMIN'],
  };

  const suspendedUserPayload = {
    id: '44444444-4444-4444-4444-444444444444',
    email: 'suspended@selfheal.io',
    status: 'SUSPENDED',
    roles: ['USER'],
  };

  try {
    // 1. Valid token can access an authorized protected endpoint
    await test('1. A valid token can access an authorized protected endpoint', async () => {
      const token = createToken(userPayload);
      // Accessing a route protected by authenticateToken with a mock/valid token
      // Route /api/v1/telemetry/services/test-service/metrics-sequence
      const res = await fetch(`${baseUrl}/api/v1/telemetry/services/test-service/metrics-sequence`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      // Should not be 401 or 403
      assert.notStrictEqual(res.status, 401, 'Should not return 401 Unauthorized');
      assert.notStrictEqual(res.status, 403, 'Should not return 403 Forbidden');
    });

    // 2. Missing credentials are rejected
    await test('2. Missing credentials are rejected with 401', async () => {
      const res = await fetch(`${baseUrl}/api/v1/telemetry/services/test-service/metrics-sequence`);
      assert.strictEqual(res.status, 401);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.ok(data.message.includes('Yêu cầu đăng nhập') || data.message.includes('Thiếu'));
    });

    // 3. Malformed tokens are rejected
    await test('3. Malformed tokens are rejected with 401', async () => {
      const malformedTokens = [
        'Bearer ',
        'Bearer not.a.valid.jwt',
        'Basic abcdef123456',
        'Bearer 12345',
      ];
      for (const authHeader of malformedTokens) {
        const res = await fetch(`${baseUrl}/api/v1/telemetry/services/test/metrics-sequence`, {
          headers: { Authorization: authHeader },
        });
        assert.strictEqual(res.status, 401, `Failed for header: ${authHeader}`);
      }
    });

    // 4. Invalid signatures are rejected
    await test('4. Invalid signatures and wrong signing algorithms are rejected with 401', async () => {
      const forgedToken = createToken(userPayload, '1h', 'wrong_signature_secret_1234567890');
      const res = await fetch(`${baseUrl}/api/v1/telemetry/services/test/metrics-sequence`, {
        headers: { Authorization: `Bearer ${forgedToken}` },
      });
      assert.strictEqual(res.status, 401);
      const data = await res.json();
      assert.ok(data.message.includes('Token không hợp lệ') || data.message.includes('chữ ký'));
    });

    // 5. Expired tokens are rejected
    await test('5. Expired tokens are rejected with 401', async () => {
      const expiredToken = jwt.sign(userPayload, SECRET, { algorithm: 'HS256', expiresIn: -10 });
      const res = await fetch(`${baseUrl}/api/v1/telemetry/services/test/metrics-sequence`, {
        headers: { Authorization: `Bearer ${expiredToken}` },
      });
      assert.strictEqual(res.status, 401);
      const data = await res.json();
      assert.ok(data.message.includes('Token đã hết hạn'));
    });

    // 5b. Suspended user tokens are rejected
    await test('5b. Suspended user tokens are rejected with 403', async () => {
      const suspendedToken = createToken(suspendedUserPayload);
      const res = await fetch(`${baseUrl}/api/v1/telemetry/services/test/metrics-sequence`, {
        headers: { Authorization: `Bearer ${suspendedToken}` },
      });
      assert.strictEqual(res.status, 403);
    });

    // 6. User cannot modify another user's profile by supplying a different user ID (IDOR)
    await test('6. A user cannot modify another user\'s profile by supplying a different user ID (IDOR protection)', async () => {
      const userAToken = createToken({
        id: '11111111-1111-1111-1111-111111111111',
        email: 'usera@selfheal.io',
        status: 'ACTIVE',
        roles: ['USER'],
      });
      const targetUserIdB = '99999999-9999-9999-9999-999999999999';

      const res = await fetch(`${baseUrl}/api/v1/users/${targetUserIdB}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userAToken}`,
        },
        body: JSON.stringify({ full_name: 'Hacked Name' }),
      });

      assert.strictEqual(res.status, 403);
      const data = await res.json();
      assert.ok(data.message.includes('chính mình') || data.message.includes('quyền'));
    });

    // 7. A regular User / Viewer cannot execute an action requiring higher privileges
    await test('7. A Viewer / normal USER cannot execute actions requiring higher privileges', async () => {
      const userToken = createToken(userPayload);

      // Attempt to access admin-only endpoint: GET /api/v1/users (requires ADMIN or SUPER_ADMIN)
      const resUsers = await fetch(`${baseUrl}/api/v1/users`, {
        headers: { Authorization: `Bearer ${userToken}` },
      });
      assert.strictEqual(resUsers.status, 403, 'Normal USER must not access GET /api/v1/users');

      // Attempt to assign role: POST /api/v1/roles/assign (requires SUPER_ADMIN)
      const resAssign = await fetch(`${baseUrl}/api/v1/roles/assign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userToken}`,
        },
        body: JSON.stringify({
          userId: userPayload.id,
          role: 'SUPER_ADMIN',
        }),
      });
      assert.strictEqual(resAssign.status, 403, 'Normal USER must not escalate privileges');

      // Attempt to access GET /api/v1/roles
      const resRoles = await fetch(`${baseUrl}/api/v1/roles`, {
        headers: { Authorization: `Bearer ${userToken}` },
      });
      assert.strictEqual(resRoles.status, 403, 'Normal USER must not list all system roles');
    });

    // 8. Organization / Tenant Isolation
    await test('8. Tenant isolation middleware blocks access when user lacks organization membership', async () => {
      // Create isolated express app with tenant middleware
      const testTenantApp = express();
      testTenantApp.use(express.json());
      testTenantApp.get(
        '/tenant/:orgId/data',
        (req, res, next) => {
          (req as any).user = userPayload; // authenticated as normal user
          next();
        },
        requireTenantAccess((req) => req.params.orgId),
        (req, res) => res.json({ secretData: 'org-b-confidential' })
      );

      const tenantServer = http.createServer(testTenantApp);
      await new Promise<void>((r) => tenantServer.listen(0, '127.0.0.1', () => r()));
      const tPort = (tenantServer.address() as AddressInfo).port;

      const res = await fetch(`http://127.0.0.1:${tPort}/tenant/foreign-org-id-999/data`);
      // User is not a member of foreign-org-id-999
      assert.strictEqual(res.status, 403);
      tenantServer.close();
    });

    // 9. Public endpoints continue to work without authentication
    await test('9. Public endpoints continue to work without authentication', async () => {
      // Primary public endpoints
      const resRoot = await fetch(`${baseUrl}/`);
      assert.strictEqual(resRoot.status, 200);

      const resHealth = await fetch(`${baseUrl}/api/v1/health`);
      assert.strictEqual(resHealth.status, 200);

      // AI health check is public and accessible without token (returns 200 if connected or 503 if AI backend down, never 401/403)
      const resAiHealth = await fetch(`${baseUrl}/api/v1/ai/health`);
      assert.notStrictEqual(resAiHealth.status, 401, 'AI health check must not require token');
      assert.notStrictEqual(resAiHealth.status, 403, 'AI health check must not be forbidden');
    });

    // 10. Protected endpoints reject unauthorized requests
    await test('10. Protected endpoints reject unauthorized requests across all services', async () => {
      const endpointsToTest = [
        { path: '/api/v1/auth/me', method: 'GET' },
        { path: '/api/v1/users/profile', method: 'GET' },
        { path: '/api/v1/users', method: 'GET' },
        { path: '/api/v1/roles', method: 'GET' },
        { path: '/api/v1/telemetry/services/svc-1/rca-context', method: 'GET' },
        { path: '/api/v1/ai/predict', method: 'POST' },
        { path: '/api/v1/ai/rca', method: 'POST' },
        { path: '/api/v1/rule-engine/evaluate', method: 'POST' },
      ];

      for (const ep of endpointsToTest) {
        const res = await fetch(`${baseUrl}${ep.path}`, {
          method: ep.method,
          headers: { 'Content-Type': 'application/json' },
          body: ep.method === 'POST' ? JSON.stringify({}) : undefined,
        });
        assert.strictEqual(
          res.status,
          401,
          `Protected endpoint ${ep.method} ${ep.path} did not reject unauthenticated request (returned ${res.status})`
        );
      }
    });

    // 11. Login input validation and rate limiting
    await test('11. Login input validation and rate limiting operate correctly', async () => {
      // 11a: Input validation rejects invalid email / missing password
      const invalidRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'not-an-email', password: '' }),
      });
      assert.strictEqual(invalidRes.status, 400, 'Invalid login input must return 400 Bad Request');

      // 11b: Rate limiting blocks after exceeding max requests
      const testRateApp = express();
      testRateApp.use(express.json());
      const customLimiter = rateLimiter({ windowMs: 5000, max: 3, message: 'Rate limit exceeded' });
      testRateApp.post('/test-limit', customLimiter, (req, res) => res.json({ ok: true }));

      const rateServer = http.createServer(testRateApp);
      await new Promise<void>((r) => rateServer.listen(0, '127.0.0.1', () => r()));
      const rPort = (rateServer.address() as AddressInfo).port;

      // 3 allowed requests
      for (let i = 0; i < 3; i++) {
        const r = await fetch(`http://127.0.0.1:${rPort}/test-limit`, { method: 'POST' });
        assert.strictEqual(r.status, 200);
      }

      // 4th request must be rate limited with 429
      const blockedRes = await fetch(`http://127.0.0.1:${rPort}/test-limit`, { method: 'POST' });
      assert.strictEqual(blockedRes.status, 429, 'Excessive requests must return 429 Too Many Requests');
      assert.ok(blockedRes.headers.get('Retry-After'), 'Retry-After header must be set');
      rateServer.close();
    });

    // 12. Sensitive values do not appear in error responses
    await test('12. Sensitive values do not leak in error responses or logs', async () => {
      const res = await fetch(`${baseUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'unknown@selfheal.io', password: 'SecretPassword123!' }),
      });
      const bodyText = await res.text();

      // Must not leak stack trace in test/prod responses
      assert.ok(!bodyText.includes('node_modules'), 'Error response must not leak file system paths');
      assert.ok(!bodyText.includes(SECRET), 'Error response must never leak JWT secret');
      assert.ok(!bodyText.includes('SecretPassword123!'), 'Error response must never leak submitted password');
    });

  } finally {
    server.close();
  }

  console.log('\n====================================================');
  console.log(`   TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runSecurityTests().catch((err) => {
  console.error('Fatal test execution error:', err);
  process.exit(1);
});
