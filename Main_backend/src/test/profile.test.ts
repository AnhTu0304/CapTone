import test, { describe, before, after } from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import { AddressInfo } from 'node:net';
import jwt from 'jsonwebtoken';
import app from '../app';
import { config } from '../config/env';
import { pool } from '../config/database';

describe('Profile API Suite (/api/v1/users/me)', () => {
  let server: http.Server;
  let baseUrl: string;

  // Test fixtures IDs
  const activeUserId = '53f5bcdb-a15f-43b6-b3d1-afa8eb5843c1';
  let activeUserToken: string;
  let suspendedUserToken: string;
  const nonExistentUserId = '00000000-0000-0000-0000-000000000000';

  before(async () => {
    // 1. Ensure test user exists in PostgreSQL database
    await pool.query(`
      INSERT INTO users (id, email, password_hash, full_name, status, created_at, updated_at)
      VALUES ($1, 'tungo342005@gmail.com', 'dummy_hash', 'Ngo ANh Tu', 'ACTIVE', NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET full_name = 'Ngo ANh Tu', status = 'ACTIVE', deleted_at = NULL;
    `, [activeUserId]);

    // 2. Generate valid JWT tokens
    activeUserToken = jwt.sign(
      { id: activeUserId, email: 'tungo342005@gmail.com', status: 'ACTIVE', roles: ['USER'] },
      config.jwt.secret,
      { expiresIn: '1h', algorithm: 'HS256' }
    );

    suspendedUserToken = jwt.sign(
      { id: activeUserId, email: 'tungo342005@gmail.com', status: 'SUSPENDED', roles: ['USER'] },
      config.jwt.secret,
      { expiresIn: '1h', algorithm: 'HS256' }
    );

    // 3. Start ephemeral test server
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const port = (server.address() as AddressInfo).port;
        baseUrl = `http://127.0.0.1:${port}/api/v1/users/me`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) {
      server.closeAllConnections?.();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    await pool.end();
  });

  // --- GET /api/v1/users/me Tests ---

  test('1. GET /api/v1/users/me without Authorization header returns 401', async () => {
    const res = await fetch(baseUrl);
    const body = await res.json() as any;

    assert.strictEqual(res.status, 401);
    assert.strictEqual(body.success, false);
    assert.match(body.message, /Yêu cầu đăng nhập/i);
  });

  test('2. GET /api/v1/users/me with malformed or invalid token returns 401', async () => {
    const res = await fetch(baseUrl, {
      headers: { Authorization: 'Bearer invalid.token.signature' },
    });
    const body = await res.json() as any;

    assert.strictEqual(res.status, 401);
    assert.strictEqual(body.success, false);
    assert.match(body.message, /Token không hợp lệ/i);
  });

  test('3. GET /api/v1/users/me with expired token returns 401', async () => {
    const expiredToken = jwt.sign(
      { id: activeUserId, email: 'tungo342005@gmail.com' },
      config.jwt.secret,
      { expiresIn: '-1s', algorithm: 'HS256' }
    );

    const res = await fetch(baseUrl, {
      headers: { Authorization: `Bearer ${expiredToken}` },
    });
    const body = await res.json() as any;

    assert.strictEqual(res.status, 401);
    assert.strictEqual(body.success, false);
    assert.match(body.message, /hết hạn/i);
  });

  test('4. GET /api/v1/users/me with non-existent user token returns 401', async () => {
    const ghostToken = jwt.sign(
      { id: nonExistentUserId, email: 'ghost@example.com', status: 'ACTIVE' },
      config.jwt.secret,
      { expiresIn: '1h', algorithm: 'HS256' }
    );

    const res = await fetch(baseUrl, {
      headers: { Authorization: `Bearer ${ghostToken}` },
    });
    const body = await res.json() as any;

    assert.strictEqual(res.status, 401);
    assert.strictEqual(body.success, false);
  });

  test('5. GET /api/v1/users/me rejects suspended account with 403', async () => {
    const res = await fetch(baseUrl, {
      headers: { Authorization: `Bearer ${suspendedUserToken}` },
    });
    const body = await res.json() as any;

    assert.strictEqual(res.status, 403);
    assert.strictEqual(body.success, false);
    assert.match(body.message, /khóa hoặc ngừng hoạt động/i);
  });

  test('6. GET /api/v1/users/me with valid authenticated user returns 200 and safe profile contract', async () => {
    const res = await fetch(baseUrl, {
      headers: { Authorization: `Bearer ${activeUserToken}` },
    });
    const body = await res.json() as any;

    assert.strictEqual(res.status, 200);
    assert.strictEqual(body.success, true);
    assert.ok(body.data);
    assert.strictEqual(body.data.id, activeUserId);
    assert.strictEqual(body.data.email, 'tungo342005@gmail.com');
    assert.strictEqual(body.data.fullName || body.data.full_name, 'Ngo ANh Tu');
    assert.strictEqual(body.data.status, 'ACTIVE');

    // Security check: NEVER expose password_hash or internal credentials
    assert.strictEqual(body.data.password_hash, undefined);
    assert.strictEqual(body.data.password, undefined);
    assert.strictEqual(body.data.token, undefined);
  });

  // --- PUT /api/v1/users/me Tests ---

  test('7. PUT /api/v1/users/me without Authorization header returns 401', async () => {
    const res = await fetch(baseUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullName: 'Updated Name' }),
    });
    const body = await res.json() as any;

    assert.strictEqual(res.status, 401);
    assert.strictEqual(body.success, false);
  });

  test('8. PUT /api/v1/users/me updates fullName successfully and persists in database', async () => {
    const updatedName = 'Ngo Anh Tu DevOps Pro';
    const res = await fetch(baseUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${activeUserToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fullName: updatedName }),
    });
    const body = await res.json() as any;

    assert.strictEqual(res.status, 200);
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.fullName, updatedName);

    // Verify GET after PUT returns updated data
    const getRes = await fetch(baseUrl, {
      headers: { Authorization: `Bearer ${activeUserToken}` },
    });
    const getBody = await getRes.json() as any;
    assert.strictEqual(getBody.data.fullName, updatedName);
  });

  test('9. PUT /api/v1/users/me with empty fullName or only whitespace returns 400 validation error', async () => {
    const res = await fetch(baseUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${activeUserToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fullName: '   ' }),
    });
    const body = await res.json() as any;

    assert.strictEqual(res.status, 400);
    assert.strictEqual(body.success, false);
  });

  test('10. PUT /api/v1/users/me with too short fullName (<2 chars) returns 400 validation error', async () => {
    const res = await fetch(baseUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${activeUserToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fullName: 'A' }),
    });
    const body = await res.json() as any;

    assert.strictEqual(res.status, 400);
    assert.strictEqual(body.success, false);
  });

  test('11. PUT /api/v1/users/me with invalid phone number format returns 400 validation error', async () => {
    const res = await fetch(baseUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${activeUserToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ phone: 'invalid-phone-abc' }),
    });
    const body = await res.json() as any;

    assert.strictEqual(res.status, 400);
    assert.strictEqual(body.success, false);
    assert.match(body.message, /số điện thoại/i);
  });

  test('12. PUT /api/v1/users/me with valid phone and jobTitle succeeds gracefully', async () => {
    const res = await fetch(baseUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${activeUserToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fullName: 'Ngo Anh Tu SRE',
        phone: '0987654321',
        jobTitle: 'Senior Infrastructure Engineer',
      }),
    });
    const body = await res.json() as any;

    assert.strictEqual(res.status, 200);
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.fullName, 'Ngo Anh Tu SRE');
  });

  test('13. PUT /api/v1/users/me ignores forbidden fields (systemRole, status, id, email) and never mutates them', async () => {
    const maliciousPayload = {
      fullName: 'Valid User Name',
      id: '11111111-1111-1111-1111-111111111111',
      email: 'hacked@example.com',
      systemRole: 'SUPER_ADMIN',
      system_roles: ['SUPER_ADMIN'],
      status: 'SUSPENDED',
      accountStatus: 'SUSPENDED',
      password: 'new_password_attempt',
      password_hash: 'new_hash_attempt',
    };

    const res = await fetch(baseUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${activeUserToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(maliciousPayload),
    });
    const body = await res.json() as any;

    assert.strictEqual(res.status, 200);
    assert.strictEqual(body.success, true);

    const checkDb = await pool.query('SELECT id, email, status FROM users WHERE id = $1', [activeUserId]);
    assert.strictEqual(checkDb.rows[0].id, activeUserId);
    assert.strictEqual(checkDb.rows[0].email, 'tungo342005@gmail.com');
    assert.strictEqual(checkDb.rows[0].status, 'ACTIVE');

    const roleCheck = await pool.query(
      'SELECT sr.name FROM user_system_roles usr JOIN system_roles sr ON usr.system_role_id = sr.id WHERE usr.user_id = $1',
      [activeUserId]
    );
    assert.strictEqual(roleCheck.rows.some((r: any) => r.name === 'SUPER_ADMIN'), false);
  });
});
