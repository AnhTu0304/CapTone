import test, { describe, before, after } from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import { AddressInfo } from 'node:net';
import jwt from 'jsonwebtoken';
import app from '../app';
import { config } from '../config/env';
import { pool } from '../config/database';

describe('User Management API & Status Lock/Unlock Suite (/api/v1/users)', () => {
  let server: http.Server;
  let baseUsersUrl: string;

  // Test Fixture IDs
  const superAdminId = 'b9db2c90-e3fb-49b2-9027-835b2fb8468a';
  const adminId = '12aa03dc-dd04-4513-bf85-a9f6baad2682';
  const targetUserId = '53f5bcdb-a15f-43b6-b3d1-afa8eb5843c1';
  const nonExistentUserId = '00000000-0000-0000-0000-000000000000';

  let superAdminToken: string;
  let adminToken: string;
  let targetUserToken: string;

  before(async () => {
    // 1. Ensure test users exist in PostgreSQL database
    await pool.query(`
      INSERT INTO users (id, email, password_hash, full_name, status, created_at, updated_at)
      VALUES 
        ($1, 'superadmin@selfheal.com', 'dummy_hash', 'Super Admin Test', 'ACTIVE', NOW(), NOW()),
        ($2, 'admin@selfheal.com', 'dummy_hash', 'Admin Test', 'ACTIVE', NOW(), NOW()),
        ($3, 'target.user@selfheal.com', 'dummy_hash', 'Target User Test', 'ACTIVE', NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET status = 'ACTIVE', deleted_at = NULL;
    `, [superAdminId, adminId, targetUserId]);

    // Ensure roles in system_roles & user_system_roles
    const superAdminRoleRes = await pool.query(`SELECT id FROM system_roles WHERE name = 'SUPER_ADMIN'`);
    const adminRoleRes = await pool.query(`SELECT id FROM system_roles WHERE name = 'ADMIN'`);

    if (superAdminRoleRes.rows[0]) {
      await pool.query(`
        INSERT INTO user_system_roles (user_id, system_role_id)
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING;
      `, [superAdminId, superAdminRoleRes.rows[0].id]);
    }

    if (adminRoleRes.rows[0]) {
      await pool.query(`
        INSERT INTO user_system_roles (user_id, system_role_id)
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING;
      `, [adminId, adminRoleRes.rows[0].id]);
    }

    // 2. Generate valid JWT tokens
    superAdminToken = jwt.sign(
      { id: superAdminId, email: 'superadmin@selfheal.com', status: 'ACTIVE', roles: ['SUPER_ADMIN'] },
      config.jwt.secret,
      { expiresIn: '1h', algorithm: 'HS256' }
    );

    adminToken = jwt.sign(
      { id: adminId, email: 'admin@selfheal.com', status: 'ACTIVE', roles: ['ADMIN'] },
      config.jwt.secret,
      { expiresIn: '1h', algorithm: 'HS256' }
    );

    targetUserToken = jwt.sign(
      { id: targetUserId, email: 'target.user@selfheal.com', status: 'ACTIVE', roles: ['USER'] },
      config.jwt.secret,
      { expiresIn: '1h', algorithm: 'HS256' }
    );

    // 3. Start ephemeral test server
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const port = (server.address() as AddressInfo).port;
        baseUsersUrl = `http://127.0.0.1:${port}/api/v1/users`;
        resolve();
      });
    });
  });

  after(async () => {
    // Reset test user status
    await pool.query(`UPDATE users SET status = 'ACTIVE' WHERE id = $1`, [targetUserId]);

    if (server) {
      server.closeAllConnections?.();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    await pool.end();
  });

  // --- A. GET /api/v1/users Tests ---

  test('1. GET /api/v1/users without token returns 401', async () => {
    const res = await fetch(baseUsersUrl);
    const body = (await res.json()) as any;

    assert.strictEqual(res.status, 401);
    assert.strictEqual(body.success, false);
    assert.match(body.message, /Yêu cầu đăng nhập/i);
  });

  test('2. GET /api/v1/users with regular USER role returns 403 Forbidden', async () => {
    const res = await fetch(baseUsersUrl, {
      headers: { Authorization: `Bearer ${targetUserToken}` },
    });
    const body = (await res.json()) as any;

    assert.strictEqual(res.status, 403);
    assert.strictEqual(body.success, false);
    assert.match(body.message, /Từ chối truy cập/i);
  });

  test('3. GET /api/v1/users with ADMIN or SUPER_ADMIN returns 200 with system_roles and organization_roles without password_hash', async () => {
    const res = await fetch(`${baseUsersUrl}?page=1&limit=5`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const body = (await res.json()) as any;

    assert.strictEqual(res.status, 200);
    assert.strictEqual(body.success, true);
    assert.ok(Array.isArray(body.data.items));
    assert.ok(body.data.pagination);

    const firstUser = body.data.items[0];
    assert.ok(firstUser.id);
    assert.ok(firstUser.email);
    assert.strictEqual(firstUser.password_hash, undefined);
    assert.ok(Array.isArray(firstUser.system_roles));
    assert.ok(Array.isArray(firstUser.organization_roles));
  });

  // --- B. PATCH /api/v1/users/:id/status Tests ---

  test('4. PATCH /api/v1/users/:id/status without token returns 401', async () => {
    const res = await fetch(`${baseUsersUrl}/${targetUserId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'SUSPENDED' }),
    });
    const body = (await res.json()) as any;

    assert.strictEqual(res.status, 401);
    assert.strictEqual(body.success, false);
  });

  test('5. PATCH /api/v1/users/:id/status with regular USER role returns 403', async () => {
    const res = await fetch(`${baseUsersUrl}/${targetUserId}/status`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${targetUserToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'SUSPENDED' }),
    });
    const body = (await res.json()) as any;

    assert.strictEqual(res.status, 403);
    assert.strictEqual(body.success, false);
  });

  test('6. Self-lock prevention: Admin cannot lock their own account (returns 400)', async () => {
    const res = await fetch(`${baseUsersUrl}/${adminId}/status`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'SUSPENDED' }),
    });
    const body = (await res.json()) as any;

    assert.strictEqual(res.status, 400);
    assert.strictEqual(body.success, false);
    assert.match(body.message, /Không thể tự thay đổi trạng thái hoặc khóa tài khoản của chính mình/i);
  });

  test('7. Target user non-existent returns 404', async () => {
    const res = await fetch(`${baseUsersUrl}/${nonExistentUserId}/status`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'SUSPENDED' }),
    });
    const body = (await res.json()) as any;

    assert.strictEqual(res.status, 404);
    assert.strictEqual(body.success, false);
    assert.match(body.message, /Không tìm thấy người dùng/i);
  });

  test('8. Invalid status value (not ACTIVE or SUSPENDED) returns 400', async () => {
    const res = await fetch(`${baseUsersUrl}/${targetUserId}/status`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'BANNED' }),
    });
    const body = (await res.json()) as any;

    assert.strictEqual(res.status, 400);
    assert.strictEqual(body.success, false);
  });

  test('9. Privilege Protection: ADMIN cannot lock/unlock SUPER_ADMIN (returns 403)', async () => {
    const res = await fetch(`${baseUsersUrl}/${superAdminId}/status`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'SUSPENDED' }),
    });
    const body = (await res.json()) as any;

    assert.strictEqual(res.status, 403);
    assert.strictEqual(body.success, false);
    assert.match(body.message, /Quản trị viên \(ADMIN\) không có quyền thay đổi trạng thái của Super Admin/i);
  });

  test('10. SUPER_ADMIN locks a user successfully (returns 200, status = SUSPENDED)', async () => {
    const res = await fetch(`${baseUsersUrl}/${targetUserId}/status`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${superAdminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'SUSPENDED' }),
    });
    const body = (await res.json()) as any;

    assert.strictEqual(res.status, 200);
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.status, 'SUSPENDED');
    assert.strictEqual(body.data.password_hash, undefined);

    // Verify persisted in PostgreSQL
    const dbRes = await pool.query(`SELECT status FROM users WHERE id = $1`, [targetUserId]);
    assert.strictEqual(dbRes.rows[0].status, 'SUSPENDED');
  });

  test('11. Immediate Token Revocation: Suspended user token is immediately rejected on protected endpoint with 403', async () => {
    const meRes = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1/users/me`, {
      headers: { Authorization: `Bearer ${targetUserToken}` },
    });
    const body = (await meRes.json()) as any;

    assert.strictEqual(meRes.status, 403);
    assert.strictEqual(body.success, false);
    assert.match(body.message, /Tài khoản đã bị tạm khóa hoặc ngừng hoạt động/i);
  });

  test('12. Attempting to lock user who is already SUSPENDED returns 400 Bad Request', async () => {
    const res = await fetch(`${baseUsersUrl}/${targetUserId}/status`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${superAdminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'SUSPENDED' }),
    });
    const body = (await res.json()) as any;

    assert.strictEqual(res.status, 400);
    assert.strictEqual(body.success, false);
    assert.match(body.message, /Tài khoản đã ở trạng thái tạm khóa/i);
  });

  test('13. Unlock user: Setting status = ACTIVE succeeds and unlocks access', async () => {
    const res = await fetch(`${baseUsersUrl}/${targetUserId}/status`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'ACTIVE' }),
    });
    const body = (await res.json()) as any;

    assert.strictEqual(res.status, 200);
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.status, 'ACTIVE');

    // Suspended token should now work again on /me
    const meRes = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1/users/me`, {
      headers: { Authorization: `Bearer ${targetUserToken}` },
    });
    const meBody = (await meRes.json()) as any;

    assert.strictEqual(meRes.status, 200);
    assert.strictEqual(meBody.success, true);
    assert.strictEqual(meBody.data.id, targetUserId);
  });

  test('14. PUT /api/v1/users/:id/status alias functions identically', async () => {
    const res = await fetch(`${baseUsersUrl}/${targetUserId}/status`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'SUSPENDED' }),
    });
    const body = (await res.json()) as any;

    assert.strictEqual(res.status, 200);
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.status, 'SUSPENDED');

    // Re-activate for clean state
    await pool.query(`UPDATE users SET status = 'ACTIVE' WHERE id = $1`, [targetUserId]);
  });
});
