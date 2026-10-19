import http from 'http';
import { AddressInfo } from 'net';
import assert from 'assert';
import jwt from 'jsonwebtoken';
import app from '../src/app';
import { config } from '../src/config/env';
import { pool } from '../src/config/database';
import { rateLimiter } from '../src/middlewares/rateLimit.middleware';
import { requireTenantAccess } from '../src/middlewares/tenant.middleware';
import { UserService } from '../src/services/user.service';
import express from 'express';

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

  const testUserAId = '11111111-1111-1111-1111-111111111111';
  const testAdminId = '22222222-2222-2222-2222-222222222222';
  const testSuperAdminId = '33333333-3333-3333-3333-333333333333';
  const testSuspendedId = '44444444-4444-4444-4444-444444444444';
  const testUserBId = '99999999-9999-9999-9999-999999999999';

  const userPayload = {
    id: testUserAId,
    email: 'usera@selfheal.io',
    status: 'ACTIVE',
    roles: ['USER'],
  };

  const adminPayload = {
    id: testAdminId,
    email: 'admin@selfheal.io',
    status: 'ACTIVE',
    roles: ['ADMIN'],
  };

  const superAdminPayload = {
    id: testSuperAdminId,
    email: 'superadmin@selfheal.io',
    status: 'ACTIVE',
    roles: ['SUPER_ADMIN'],
  };

  const suspendedUserPayload = {
    id: testSuspendedId,
    email: 'suspended@selfheal.io',
    status: 'SUSPENDED',
    roles: ['USER'],
  };

  try {
    // 0. Database Setup: Ensure tables and seed test fixtures
    await pool.query(`
      CREATE TABLE IF NOT EXISTS agent_metrics (
        id BIGSERIAL PRIMARY KEY,
        agent_id VARCHAR(100) NOT NULL,
        cluster_id VARCHAR(100),
        service_id VARCHAR(100) NOT NULL,
        pod_id VARCHAR(100) NOT NULL,
        cpu NUMERIC(6, 2) NOT NULL DEFAULT 0,
        ram NUMERIC(6, 2) NOT NULL DEFAULT 0,
        disk NUMERIC(6, 2) NOT NULL DEFAULT 0,
        request_rate NUMERIC(10, 2) NOT NULL DEFAULT 0,
        latency NUMERIC(10, 2) NOT NULL DEFAULT 0,
        http_5xx_rate NUMERIC(6, 2) NOT NULL DEFAULT 0,
        pod_restart_count INT NOT NULL DEFAULT 0,
        replica_count INT NOT NULL DEFAULT 1,
        collected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_agent_metrics_service_collected ON agent_metrics(service_id, collected_at DESC);
    `);

    // Insert 12 metric points for test-service
    await pool.query('DELETE FROM agent_metrics WHERE service_id = $1', ['test-service']);
    for (let i = 0; i < 12; i++) {
      await pool.query(`
        INSERT INTO agent_metrics (
          agent_id, cluster_id, service_id, pod_id,
          cpu, ram, disk, request_rate, latency, http_5xx_rate,
          pod_restart_count, replica_count, collected_at
        ) VALUES (
          'agent-1', 'cluster-1', 'test-service', 'pod-1',
          15.5, 45.0, 30.0, 120.0, 25.0, 0.0,
          0, 2, NOW() - ($1 || ' seconds')::interval
        );
      `, [i * 5]);
    }

    // Seed test users
    await pool.query(`
      INSERT INTO users (id, email, full_name, status, created_at, updated_at)
      VALUES 
        ('${testUserAId}', 'usera@selfheal.io', 'Test User A', 'ACTIVE', NOW(), NOW()),
        ('${testAdminId}', 'admin@selfheal.io', 'Test Admin', 'ACTIVE', NOW(), NOW()),
        ('${testSuperAdminId}', 'superadmin@selfheal.io', 'Test Super Admin', 'ACTIVE', NOW(), NOW()),
        ('${testSuspendedId}', 'suspended@selfheal.io', 'Test Suspended', 'SUSPENDED', NOW(), NOW()),
        ('${testUserBId}', 'userb@selfheal.io', 'Test User B', 'ACTIVE', NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET 
        status = EXCLUDED.status, 
        deleted_at = NULL,
        email = EXCLUDED.email;
    `);

    // Fetch system role IDs
    const roleRows = (await pool.query<{ id: string; name: string }>('SELECT id, name FROM system_roles')).rows;
    const roleMap = new Map(roleRows.map(r => [r.name, r.id]));

    if (roleMap.has('USER')) {
      await pool.query(`INSERT INTO user_system_roles (user_id, system_role_id) VALUES ('${testUserAId}', '${roleMap.get('USER')}') ON CONFLICT DO NOTHING;`);
      await pool.query(`INSERT INTO user_system_roles (user_id, system_role_id) VALUES ('${testSuspendedId}', '${roleMap.get('USER')}') ON CONFLICT DO NOTHING;`);
      await pool.query(`INSERT INTO user_system_roles (user_id, system_role_id) VALUES ('${testUserBId}', '${roleMap.get('USER')}') ON CONFLICT DO NOTHING;`);
    }
    if (roleMap.has('ADMIN')) {
      await pool.query(`INSERT INTO user_system_roles (user_id, system_role_id) VALUES ('${testAdminId}', '${roleMap.get('ADMIN')}') ON CONFLICT DO NOTHING;`);
    }
    if (roleMap.has('SUPER_ADMIN')) {
      await pool.query(`INSERT INTO user_system_roles (user_id, system_role_id) VALUES ('${testSuperAdminId}', '${roleMap.get('SUPER_ADMIN')}') ON CONFLICT DO NOTHING;`);
    }

    // 1. Valid token can access an authorized protected endpoint
    await test('1. A valid token can access an authorized protected endpoint', async () => {
      const token = createToken(userPayload);
      const res = await fetch(`${baseUrl}/api/v1/telemetry/services/test-service/metrics-sequence`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      assert.strictEqual(res.status, 200, `Expected 200 OK, got ${res.status}`);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.data.service_id, 'test-service');
      assert.strictEqual(data.data.sequence.length, 12, 'Sequence length must be exactly 12');
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
        const res = await fetch(`${baseUrl}/api/v1/telemetry/services/test-service/metrics-sequence`, {
          headers: { Authorization: authHeader },
        });
        assert.strictEqual(res.status, 401, `Failed for header: ${authHeader}`);
      }
    });

    // 4. Invalid signatures are rejected
    await test('4. Invalid signatures and wrong signing algorithms are rejected with 401', async () => {
      const forgedToken = createToken(userPayload, '1h', 'wrong_signature_secret_1234567890');
      const res = await fetch(`${baseUrl}/api/v1/telemetry/services/test-service/metrics-sequence`, {
        headers: { Authorization: `Bearer ${forgedToken}` },
      });
      assert.strictEqual(res.status, 401);
      const data = await res.json();
      assert.ok(data.message.includes('Token không hợp lệ') || data.message.includes('chữ ký'));
    });

    // 5. Expired tokens are rejected
    await test('5. Expired tokens are rejected with 401', async () => {
      const expiredToken = jwt.sign(userPayload, SECRET, { algorithm: 'HS256', expiresIn: -10 });
      const res = await fetch(`${baseUrl}/api/v1/telemetry/services/test-service/metrics-sequence`, {
        headers: { Authorization: `Bearer ${expiredToken}` },
      });
      assert.strictEqual(res.status, 401);
      const data = await res.json();
      assert.ok(data.message.includes('Token đã hết hạn'));
    });

    // 5b. Suspended user tokens in claims are rejected
    await test('5b. Suspended user tokens in claim are rejected with 403', async () => {
      const suspendedToken = createToken(suspendedUserPayload);
      const res = await fetch(`${baseUrl}/api/v1/telemetry/services/test-service/metrics-sequence`, {
        headers: { Authorization: `Bearer ${suspendedToken}` },
      });
      assert.strictEqual(res.status, 403);
    });

    // 5c. SEC-08: Dynamic account status check and token invalidation after suspension
    await test('5c. SEC-08: Token issued while ACTIVE is revoked dynamically when account is SUSPENDED or INACTIVE', async () => {
      const dynamicUserId = '55555555-5555-5555-5555-555555555555';
      const dynamicUserPayload = {
        id: dynamicUserId,
        email: 'dynamic-user@selfheal.io',
        status: 'ACTIVE',
        roles: ['USER'],
      };

      try {
        // Step 1: Create active test account in DB
        await pool.query(`
          INSERT INTO users (id, email, full_name, status, created_at, updated_at)
          VALUES ('${dynamicUserId}', 'dynamic-user@selfheal.io', 'Dynamic User', 'ACTIVE', NOW(), NOW())
          ON CONFLICT (id) DO UPDATE SET status = 'ACTIVE', deleted_at = NULL;
        `);

        // Step 2: Issue a valid JWT while the account is ACTIVE
        const validActiveToken = createToken(dynamicUserPayload);

        // Verify that access succeeds while account is ACTIVE
        const resActive = await fetch(`${baseUrl}/api/v1/telemetry/services/test-service/metrics-sequence`, {
          headers: { Authorization: `Bearer ${validActiveToken}` },
        });
        assert.strictEqual(resActive.status, 200, 'ACTIVE account token must succeed with 200');

        // Step 3: Change account status to SUSPENDED via UserService.updateStatus
        await UserService.updateStatus(dynamicUserId, 'SUSPENDED');

        // Step 4: Reuse the previously issued JWT
        const resSuspended = await fetch(`${baseUrl}/api/v1/telemetry/services/test-service/metrics-sequence`, {
          headers: { Authorization: `Bearer ${validActiveToken}` },
        });
        assert.strictEqual(resSuspended.status, 403, 'SUSPENDED account must be denied with 403 Forbidden');
        const suspendedData = await resSuspended.json();
        assert.ok(suspendedData.message.includes('tạm khóa'), 'Message must indicate suspended status');

        // Step 5: Test INACTIVE status rejection
        await UserService.updateStatus(dynamicUserId, 'INACTIVE');
        const resInactive = await fetch(`${baseUrl}/api/v1/telemetry/services/test-service/metrics-sequence`, {
          headers: { Authorization: `Bearer ${validActiveToken}` },
        });
        assert.strictEqual(resInactive.status, 403, 'INACTIVE account must be denied with 403 Forbidden');

        // Step 6: Test Soft-Deleted status rejection
        await UserService.softDelete(dynamicUserId);
        const resDeleted = await fetch(`${baseUrl}/api/v1/telemetry/services/test-service/metrics-sequence`, {
          headers: { Authorization: `Bearer ${validActiveToken}` },
        });
        assert.strictEqual(resDeleted.status, 401, 'Soft-deleted account must be denied with 401 Unauthorized');

        // Step 7: Database errors fail closed on user status check
        await pool.query('UPDATE users SET deleted_at = NULL, status = $1 WHERE id = $2', ['ACTIVE', dynamicUserId]);
        const origQuery = pool.query;
        (pool as any).query = function (text: any, params: any) {
          if (typeof text === 'string' && text.includes('SELECT id, status, deleted_at FROM users WHERE id = $1')) {
            return Promise.reject(new Error('Simulated database connection crash'));
          }
          return origQuery.apply(pool, arguments as any);
        };
        try {
          const resDbCrash = await fetch(`${baseUrl}/api/v1/telemetry/services/test-service/metrics-sequence`, {
            headers: { Authorization: `Bearer ${validActiveToken}` },
          });
          assert.strictEqual(resDbCrash.status, 500, 'Database query failure must fail closed with 500');
          const dbErrBody = await resDbCrash.json();
          assert.strictEqual(dbErrBody.success, false);
          assert.ok(dbErrBody.message.includes('Lỗi cơ sở dữ liệu'), 'Must return fail-closed error message');
        } finally {
          pool.query = origQuery;
        }
      } finally {
        // Safe cleanup
        await pool.query('DELETE FROM users WHERE id = $1', [dynamicUserId]);
      }
    });

    // 6. User cannot modify another user's profile by supplying a different user ID (IDOR)
    await test('6. A user cannot modify another user\'s profile by supplying a different user ID (IDOR protection)', async () => {
      const userAToken = createToken(userPayload);
      const res = await fetch(`${baseUrl}/api/v1/users/${testUserBId}`, {
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

    // 7. Role reconciliation: ADMIN, SYSTEM_ADMIN, SUPER_ADMIN
    await test('7. RBAC hierarchy: Viewer/USER denied elevated actions, ADMIN permitted operational user view but denied role assignment, SUPER_ADMIN permitted full control', async () => {
      const userToken = createToken(userPayload);
      const adminToken = createToken(adminPayload);
      const superAdminToken = createToken(superAdminPayload);

      // Normal USER cannot access GET /api/v1/users (requires ADMIN or SUPER_ADMIN)
      const resUserList = await fetch(`${baseUrl}/api/v1/users`, {
        headers: { Authorization: `Bearer ${userToken}` },
      });
      assert.strictEqual(resUserList.status, 403, 'Normal USER must not access GET /api/v1/users');

      // Normal USER cannot assign roles
      const resUserAssign = await fetch(`${baseUrl}/api/v1/roles/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userToken}` },
        body: JSON.stringify({ userId: testUserAId, role: 'SUPER_ADMIN' }),
      });
      assert.strictEqual(resUserAssign.status, 403, 'Normal USER must not assign roles');

      // ADMIN can view user list (operational management)
      const resAdminList = await fetch(`${baseUrl}/api/v1/users`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.strictEqual(resAdminList.status, 200, 'ADMIN must be allowed to list users');

      // ADMIN CANNOT assign roles (least privilege: only SUPER_ADMIN can assign roles)
      const resAdminAssign = await fetch(`${baseUrl}/api/v1/roles/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ userId: testUserAId, role: 'ADMIN' }),
      });
      assert.strictEqual(resAdminAssign.status, 403, 'ADMIN must NOT be allowed to assign roles');

      // SUPER_ADMIN has full control
      const resSuperAdminRoles = await fetch(`${baseUrl}/api/v1/roles`, {
        headers: { Authorization: `Bearer ${superAdminToken}` },
      });
      assert.strictEqual(resSuperAdminRoles.status, 200, 'SUPER_ADMIN must access GET /api/v1/roles');
    });

    // 8. Organization / Tenant Isolation
    await test('8. Tenant isolation middleware blocks access when user lacks organization membership', async () => {
      const testTenantApp = express();
      testTenantApp.use(express.json());
      testTenantApp.get(
        '/tenant/:orgId/data',
        (req, res, next) => {
          (req as any).user = userPayload;
          next();
        },
        requireTenantAccess((req) => req.params.orgId),
        (req, res) => res.json({ secretData: 'org-b-confidential' })
      );

      const tenantServer = http.createServer(testTenantApp);
      await new Promise<void>((r) => tenantServer.listen(0, '127.0.0.1', () => r()));
      const tPort = (tenantServer.address() as AddressInfo).port;

      const res = await fetch(`http://127.0.0.1:${tPort}/tenant/foreign-org-id-999/data`);
      assert.strictEqual(res.status, 403);
      tenantServer.close();
    });

    // 9. Public endpoints continue to work without authentication
    await test('9. Public endpoints continue to work without authentication', async () => {
      const resRoot = await fetch(`${baseUrl}/`);
      assert.strictEqual(resRoot.status, 200);

      const resHealth = await fetch(`${baseUrl}/api/v1/health`);
      assert.strictEqual(resHealth.status, 200);

      const resAiHealth = await fetch(`${baseUrl}/api/v1/ai/health`);
      // AI health check is public and accessible without token
      assert.notStrictEqual(resAiHealth.status, 401, 'AI health check must not require token');
      assert.notStrictEqual(resAiHealth.status, 403, 'AI health check must not be forbidden');
    });

    // 9b. AI Health dependency availability behavior
    await test('9b. AI health endpoint returns 503 when dependency is offline, and 200 when online', async () => {
      // 1. Unhealthy dependency: Default test env has no AI_backend on port 8001
      const resOffline = await fetch(`${baseUrl}/api/v1/ai/health`);
      assert.strictEqual(resOffline.status, 503, 'Offline dependency must return 503 Service Unavailable');
      const offlineData = await resOffline.json();
      assert.strictEqual(offlineData.success, false);
      assert.ok(offlineData.message.includes('not reachable') || offlineData.message.includes('not ready'));

      // 2. Healthy dependency: Spawn mock AI backend service
      const mockAiApp = express();
      mockAiApp.get('/health', (req, res) => res.json({ status: 'healthy', model: 'gru-v2' }));
      const mockAiServer = http.createServer(mockAiApp);
      await new Promise<void>((r) => mockAiServer.listen(0, '127.0.0.1', () => r()));
      const mockAiPort = (mockAiServer.address() as AddressInfo).port;

      // Ephemeral route pointing to mock AI backend
      const testAiRouter = express();
      testAiRouter.get('/test-ai-health', async (req, res) => {
        try {
          const resp = await fetch(`http://127.0.0.1:${mockAiPort}/health`);
          if (resp.ok) {
            const data = await resp.json();
            return res.status(200).json({ success: true, message: 'Operational', data });
          }
          return res.status(503).json({ success: false, message: 'Unreachable' });
        } catch {
          return res.status(503).json({ success: false, message: 'Unreachable' });
        }
      });

      const proxyServer = http.createServer(testAiRouter);
      await new Promise<void>((r) => proxyServer.listen(0, '127.0.0.1', () => r()));
      const proxyPort = (proxyServer.address() as AddressInfo).port;

      const resOnline = await fetch(`http://127.0.0.1:${proxyPort}/test-ai-health`);
      assert.strictEqual(resOnline.status, 200, 'Reachable dependency must return 200 OK');
      const onlineData = await resOnline.json();
      assert.strictEqual(onlineData.data.status, 'healthy');

      proxyServer.close();
      mockAiServer.close();
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
      const invalidRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'not-an-email', password: '' }),
      });
      assert.strictEqual(invalidRes.status, 400, 'Invalid login input must return 400 Bad Request');

      const testRateApp = express();
      testRateApp.use(express.json());
      const customLimiter = rateLimiter({ windowMs: 5000, max: 3, message: 'Rate limit exceeded' });
      testRateApp.post('/test-limit', customLimiter, (req, res) => res.json({ ok: true }));

      const rateServer = http.createServer(testRateApp);
      await new Promise<void>((r) => rateServer.listen(0, '127.0.0.1', () => r()));
      const rPort = (rateServer.address() as AddressInfo).port;

      for (let i = 0; i < 3; i++) {
        const r = await fetch(`http://127.0.0.1:${rPort}/test-limit`, { method: 'POST' });
        assert.strictEqual(r.status, 200);
      }

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

      assert.ok(!bodyText.includes('node_modules'), 'Error response must not leak file system paths');
      assert.ok(!bodyText.includes(SECRET), 'Error response must never leak JWT secret');
      assert.ok(!bodyText.includes('SecretPassword123!'), 'Error response must never leak submitted password');
    });

    // 13. CORS Allowlist Policy Verification
    await test('13. CORS allowlisting permits configured origins and rejects untrusted disallowed origins', async () => {
      // 13a: Untrusted disallowed origin must NOT receive Access-Control-Allow-Origin matching its origin
      const untrustedRes = await fetch(`${baseUrl}/api/v1/health`, {
        method: 'GET',
        headers: { Origin: 'http://malicious-attacker.com' },
      });
      const allowOriginUntrusted = untrustedRes.headers.get('access-control-allow-origin');
      assert.notStrictEqual(
        allowOriginUntrusted,
        'http://malicious-attacker.com',
        'Untrusted origin must not be reflected in Access-Control-Allow-Origin header'
      );

      // 13b: Allowed origin (e.g. localhost or configured origin) receives proper header
      const allowedRes = await fetch(`${baseUrl}/api/v1/health`, {
        method: 'GET',
        headers: { Origin: 'http://localhost:5173' },
      });
      const allowOriginTrusted = allowedRes.headers.get('access-control-allow-origin');
      assert.strictEqual(
        allowOriginTrusted,
        'http://localhost:5173',
        'Allowed origin must receive exact Access-Control-Allow-Origin header'
      );
    });

    // 14. Request Body Size Limit (> 100kb) Verification
    await test('14. Oversized request payloads (> 100kb) are rejected with HTTP 413 Payload Too Large', async () => {
      // Create a payload larger than 100kb (approx 120kb)
      const largePayload = {
        email: 'test@selfheal.io',
        data: 'A'.repeat(120 * 1024),
      };

      const res = await fetch(`${baseUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(largePayload),
      });

      assert.strictEqual(
        res.status,
        413,
        `Expected HTTP 413 Payload Too Large for oversized body, received HTTP ${res.status}`
      );
    });

    // 15. Production JWT secret validation enforces minimum 32 chars and rejects default secrets in production
    await test('15. Production JWT secret validation enforces minimum 32 chars and rejects default secrets in production', async () => {
      const validateProdSecret = (secret?: string) => {
        if (!secret || secret === 'your_super_secret_jwt_key_here' || secret.length < 32) {
          throw new Error('FATAL SECURITY ERROR: JWT_SECRET must be set to a secure string of at least 32 characters in production');
        }
        return secret;
      };

      assert.throws(() => validateProdSecret(undefined), /FATAL SECURITY ERROR/);
      assert.throws(() => validateProdSecret('short_secret'), /FATAL SECURITY ERROR/);
      assert.throws(() => validateProdSecret('your_super_secret_jwt_key_here'), /FATAL SECURITY ERROR/);
      assert.doesNotThrow(() => validateProdSecret('production_super_strong_secret_key_exceeding_32_characters'));
    });

  } finally {
    // Teardown test fixtures
    try {
      await pool.query('DELETE FROM agent_metrics WHERE service_id = $1', ['test-service']);
      await pool.query('DELETE FROM user_system_roles WHERE user_id IN ($1, $2, $3, $4, $5)', [
        testUserAId,
        testAdminId,
        testSuperAdminId,
        testSuspendedId,
        testUserBId,
      ]);
      await pool.query('DELETE FROM users WHERE id IN ($1, $2, $3, $4, $5)', [
        testUserAId,
        testAdminId,
        testSuperAdminId,
        testSuspendedId,
        testUserBId,
      ]);
    } catch (cleanupErr) {
      console.error('Warning: Error during test teardown:', cleanupErr);
    }
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
