import test, { describe, before, after } from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import { AddressInfo } from 'node:net';
import jwt from 'jsonwebtoken';
import app from '../app';
import { config } from '../config/env';
import { pool } from '../config/database';

describe('Admin Role Assignment & RBAC Security Suite', () => {
  let server: http.Server;
  let baseUrl: string;

  // Test Fixture User IDs
  const superAdmin1Id = 'f1000000-0000-0000-0000-000000000001';
  const superAdmin2Id = 'f1000000-0000-0000-0000-000000000002';
  const adminId       = 'f1000000-0000-0000-0000-000000000003';
  const devopsId      = 'f1000000-0000-0000-0000-000000000004';
  const viewerId      = 'f1000000-0000-0000-0000-000000000005';
  const targetUserId  = 'f1000000-0000-0000-0000-000000000006';

  let superAdminToken: string;
  let adminToken: string;
  let devopsToken: string;
  let viewerToken: string;
  let initialSuperAdmins: Array<{ user_id: string; system_role_id: string }> = [];

  before(async () => {
    // Backup existing Super Admins in DB to restore after tests
    const backupRes = await pool.query(
      `SELECT user_id, system_role_id FROM user_system_roles WHERE system_role_id = (SELECT id FROM system_roles WHERE name = 'SUPER_ADMIN' LIMIT 1)`
    );
    initialSuperAdmins = backupRes.rows;
    // 1. Ensure test users exist in database
    await pool.query(`
      INSERT INTO users (id, email, password_hash, full_name, status, created_at, updated_at)
      VALUES 
        ($1, 'role.sa1@test.com', 'dummy_hash', 'Role SuperAdmin 1', 'ACTIVE', NOW(), NOW()),
        ($2, 'role.sa2@test.com', 'dummy_hash', 'Role SuperAdmin 2', 'ACTIVE', NOW(), NOW()),
        ($3, 'role.admin@test.com', 'dummy_hash', 'Role Admin', 'ACTIVE', NOW(), NOW()),
        ($4, 'role.devops@test.com', 'dummy_hash', 'Role DevOps', 'ACTIVE', NOW(), NOW()),
        ($5, 'role.viewer@test.com', 'dummy_hash', 'Role Viewer', 'ACTIVE', NOW(), NOW()),
        ($6, 'role.target@test.com', 'dummy_hash', 'Role Target User', 'ACTIVE', NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET status = 'ACTIVE', deleted_at = NULL;
    `, [superAdmin1Id, superAdmin2Id, adminId, devopsId, viewerId, targetUserId]);

    // 2. Fetch role IDs from DB
    const srRes = await pool.query(`SELECT id, name FROM system_roles WHERE name IN ('SUPER_ADMIN', 'ADMIN', 'USER')`);
    const rRes = await pool.query(`SELECT id, code FROM roles WHERE code IN ('DEVOPS', 'VIEWER')`);

    const superAdminRoleId = srRes.rows.find(r => r.name === 'SUPER_ADMIN')?.id;
    const adminRoleId = srRes.rows.find(r => r.name === 'ADMIN')?.id;
    const userRoleId = srRes.rows.find(r => r.name === 'USER')?.id;
    const devopsRoleId = rRes.rows.find(r => r.code === 'DEVOPS')?.id;
    const viewerRoleId = rRes.rows.find(r => r.code === 'VIEWER')?.id;

    // Clean user_system_roles for test fixtures
    await pool.query(`DELETE FROM user_system_roles WHERE user_id = ANY($1::uuid[])`, [
      [superAdmin1Id, superAdmin2Id, adminId, devopsId, viewerId, targetUserId]
    ]);

    // Assign system roles
    if (superAdminRoleId) {
      await pool.query(`INSERT INTO user_system_roles (user_id, system_role_id) VALUES ($1, $2), ($3, $2) ON CONFLICT DO NOTHING;`, [
        superAdmin1Id, superAdminRoleId, superAdmin2Id
      ]);
    }
    if (adminRoleId) {
      await pool.query(`INSERT INTO user_system_roles (user_id, system_role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING;`, [
        adminId, adminRoleId
      ]);
    }
    if (userRoleId) {
      await pool.query(`INSERT INTO user_system_roles (user_id, system_role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING;`, [
        targetUserId, userRoleId
      ]);
    }

    // 3. Issue JWT tokens
    superAdminToken = jwt.sign(
      { id: superAdmin1Id, email: 'role.sa1@test.com', status: 'ACTIVE', roles: ['SUPER_ADMIN'] },
      config.jwt.secret,
      { expiresIn: '1h' }
    );

    adminToken = jwt.sign(
      { id: adminId, email: 'role.admin@test.com', status: 'ACTIVE', roles: ['ADMIN'] },
      config.jwt.secret,
      { expiresIn: '1h' }
    );

    devopsToken = jwt.sign(
      { id: devopsId, email: 'role.devops@test.com', status: 'ACTIVE', roles: ['DEVOPS'] },
      config.jwt.secret,
      { expiresIn: '1h' }
    );

    viewerToken = jwt.sign(
      { id: viewerId, email: 'role.viewer@test.com', status: 'ACTIVE', roles: ['VIEWER'] },
      config.jwt.secret,
      { expiresIn: '1h' }
    );

    // 4. Start HTTP test server
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const port = (server.address() as AddressInfo).port;
        baseUrl = `http://127.0.0.1:${port}/api/v1`;
        resolve();
      });
    });
  });

  after(async () => {
    // Restore all initial Super Admin assignments so the test suite does not mutate seed/production data
    for (const sa of initialSuperAdmins) {
      await pool.query(
        `INSERT INTO user_system_roles (user_id, system_role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [sa.user_id, sa.system_role_id]
      );
    }

    if (server) {
      server.closeAllConnections?.();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  // --- 1. Authorization Boundaries ---

  test('1. [SEC-01] POST /roles/assign with SUPER_ADMIN assigns role successfully (201)', async () => {
    const res = await fetch(`${baseUrl}/roles/assign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        userId: targetUserId,
        role: 'ADMIN',
        reason: 'Thăng cấp quản trị viên thử nghiệm',
      }),
    });

    const body = await res.json() as any;
    assert.strictEqual(res.status, 201);
    assert.strictEqual(body.success, true);
    assert.match(body.message, /Cấp vai trò \[ADMIN\] cho người dùng thành công/i);
  });

  test('2. [SEC-02] POST /roles/assign with ADMIN role returns 403 Forbidden', async () => {
    const res = await fetch(`${baseUrl}/roles/assign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        userId: targetUserId,
        role: 'SUPER_ADMIN',
      }),
    });

    const body = await res.json() as any;
    assert.strictEqual(res.status, 403);
    assert.strictEqual(body.success, false);
    assert.ok(body.message.includes('RBAC') || body.message.includes('truy cập'));
  });

  test('3. [SEC-03] POST /roles/assign with DEVOPS role returns 403 Forbidden', async () => {
    const res = await fetch(`${baseUrl}/roles/assign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${devopsToken}`,
      },
      body: JSON.stringify({
        userId: targetUserId,
        role: 'ADMIN',
      }),
    });

    assert.strictEqual(res.status, 403);
  });

  test('4. [SEC-04] POST /roles/assign with VIEWER role returns 403 Forbidden', async () => {
    const res = await fetch(`${baseUrl}/roles/assign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${viewerToken}`,
      },
      body: JSON.stringify({
        userId: targetUserId,
        role: 'ADMIN',
      }),
    });

    assert.strictEqual(res.status, 403);
  });

  test('5. [SEC-05] POST /roles/assign unauthenticated returns 401 Unauthorized', async () => {
    const res = await fetch(`${baseUrl}/roles/assign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: targetUserId,
        role: 'ADMIN',
      }),
    });

    assert.strictEqual(res.status, 401);
  });

  // --- 2. Last Super Admin Protection ---

  test('6. [SEC-06] Demoting sole SUPER_ADMIN returns 400 Bad Request with safety message', async () => {
    // Tạm thời gỡ bỏ các SuperAdmin khác để superAdmin1Id trở thành SuperAdmin duy nhất
    const srRes = await pool.query(`SELECT id FROM system_roles WHERE name = 'SUPER_ADMIN' LIMIT 1`);
    const superAdminRoleId = srRes.rows[0].id;

    // Giữ lại duy nhất 1 Super Admin trong toàn hệ thống
    await pool.query(`DELETE FROM user_system_roles WHERE system_role_id = $1 AND user_id != $2`, [
      superAdminRoleId, superAdmin1Id
    ]);

    // Thử hạ cấp Super Admin duy nhất xuống ADMIN
    const res = await fetch(`${baseUrl}/roles/assign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        userId: superAdmin1Id,
        role: 'ADMIN',
        reason: 'Hạ cấp Super Admin cuối cùng',
      }),
    });

    const body = await res.json() as any;
    assert.strictEqual(res.status, 400);
    assert.strictEqual(body.success, false);
    assert.match(body.message, /Không thể hạ cấp hoặc thu hồi Super Admin cuối cùng/i);

    // Khôi phục lại superAdmin2Id để tiếp tục các bài test sau
    await pool.query(`INSERT INTO user_system_roles (user_id, system_role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [
      superAdmin2Id, superAdminRoleId
    ]);
  });

  test('7. [SEC-07] Revoking role of sole SUPER_ADMIN via /roles/revoke returns 400 Bad Request', async () => {
    const srRes = await pool.query(`SELECT id FROM system_roles WHERE name = 'SUPER_ADMIN' LIMIT 1`);
    const superAdminRoleId = srRes.rows[0].id;

    // Giữ lại duy nhất 1 Super Admin
    await pool.query(`DELETE FROM user_system_roles WHERE system_role_id = $1 AND user_id != $2`, [
      superAdminRoleId, superAdmin1Id
    ]);

    const res = await fetch(`${baseUrl}/roles/revoke`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        userId: superAdmin1Id,
        role: 'SUPER_ADMIN',
      }),
    });

    const body = await res.json() as any;
    assert.strictEqual(res.status, 400);
    assert.strictEqual(body.success, false);
    assert.match(body.message, /Không thể hạ cấp hoặc thu hồi Super Admin cuối cùng/i);

    // Khôi phục lại superAdmin2Id
    await pool.query(`INSERT INTO user_system_roles (user_id, system_role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [
      superAdmin2Id, superAdminRoleId
    ]);
  });

  test('8. [SEC-08] Self-demotion check: Sole Super Admin demoting themselves fails with 400', async () => {
    const srRes = await pool.query(`SELECT id FROM system_roles WHERE name = 'SUPER_ADMIN' LIMIT 1`);
    const superAdminRoleId = srRes.rows[0].id;

    await pool.query(`DELETE FROM user_system_roles WHERE system_role_id = $1 AND user_id != $2`, [
      superAdminRoleId, superAdmin1Id
    ]);

    const res = await fetch(`${baseUrl}/roles/assign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        userId: superAdmin1Id,
        role: 'DEVOPS',
        reason: 'Tự hạ cấp chính mình',
      }),
    });

    assert.strictEqual(res.status, 400);

    // Restore superAdmin2
    await pool.query(`INSERT INTO user_system_roles (user_id, system_role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [
      superAdmin2Id, superAdminRoleId
    ]);
  });

  test('9. [SEC-09] Demotion allowed when multiple (>= 2) Super Admins exist', async () => {
    // Đảm bảo cả superAdmin1Id và superAdmin2Id đều là SUPER_ADMIN
    const srRes = await pool.query(`SELECT id FROM system_roles WHERE name = 'SUPER_ADMIN' LIMIT 1`);
    const superAdminRoleId = srRes.rows[0].id;

    await pool.query(`INSERT INTO user_system_roles (user_id, system_role_id) VALUES ($1, $2), ($3, $2) ON CONFLICT DO NOTHING`, [
      superAdmin1Id, superAdminRoleId, superAdmin2Id
    ]);

    // Hạ cấp superAdmin2Id xuống ADMIN (bởi superAdmin1)
    const res = await fetch(`${baseUrl}/roles/assign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        userId: superAdmin2Id,
        role: 'ADMIN',
        reason: 'Hạ cấp khi hệ thống vẫn còn Super Admin khác',
      }),
    });

    const body = await res.json() as any;
    assert.strictEqual(res.status, 201);
    assert.strictEqual(body.success, true);
  });

  // --- 3. Input Validation & Error Handling ---

  test('10. [SEC-10] Assigning invalid role name returns 404 Not Found', async () => {
    const res = await fetch(`${baseUrl}/roles/assign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        userId: targetUserId,
        role: 'NON_EXISTENT_SUPER_ROLE',
      }),
    });

    const body = await res.json() as any;
    assert.strictEqual(res.status, 404);
    assert.match(body.message, /Không tìm thấy vai trò/i);
  });

  test('11. [SEC-11] Assigning role to non-existent user ID returns 404 Not Found', async () => {
    const nonExistentUserId = '00000000-0000-0000-0000-000000000099';
    const res = await fetch(`${baseUrl}/roles/assign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        userId: nonExistentUserId,
        role: 'ADMIN',
      }),
    });

    const body = await res.json() as any;
    assert.strictEqual(res.status, 404);
    assert.match(body.message, /Người dùng không tồn tại/i);
  });

  test('12. [SEC-12] Assigning role with invalid UUID format returns 400 Bad Request', async () => {
    const res = await fetch(`${baseUrl}/roles/assign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        userId: 'invalid-not-a-uuid',
        role: 'ADMIN',
      }),
    });

    const body = await res.json() as any;
    assert.strictEqual(res.status, 400);
    assert.match(body.message, /User ID không hợp lệ/i);
  });

  // --- 4. Audit Logging Trail ---

  test('13. [SEC-13] Role assignment creates verifiable audit log record', async () => {
    const reasonText = 'Audit test assignment - ' + Date.now();
    const res = await fetch(`${baseUrl}/roles/assign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        userId: targetUserId,
        role: 'ADMIN',
        reason: reasonText,
      }),
    });

    assert.strictEqual(res.status, 201);

    // Verify in audit_logs table
    const auditRes = await pool.query(
      `SELECT * FROM audit_logs 
       WHERE target_id = $1 AND action = 'SYSTEM_ROLE_ASSIGNED' 
       ORDER BY created_at DESC LIMIT 1`,
      [targetUserId]
    );

    assert.strictEqual(auditRes.rows.length, 1);
    const auditLog = auditRes.rows[0];
    assert.strictEqual(auditLog.user_id, superAdmin1Id);
    assert.strictEqual(auditLog.target_id, targetUserId);
    assert.strictEqual(auditLog.status, 'SUCCESS');
    assert.strictEqual(auditLog.metadata?.role, 'ADMIN');
    assert.strictEqual(auditLog.metadata?.reason, reasonText);
  });

  test('14. [SEC-14] Role revocation creates verifiable audit log record', async () => {
    const res = await fetch(`${baseUrl}/roles/revoke`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        userId: targetUserId,
        role: 'ADMIN',
      }),
    });

    assert.strictEqual(res.status, 200);

    const auditRes = await pool.query(
      `SELECT * FROM audit_logs 
       WHERE target_id = $1 AND action = 'SYSTEM_ROLE_REVOKED' 
       ORDER BY created_at DESC LIMIT 1`,
      [targetUserId]
    );

    assert.strictEqual(auditRes.rows.length, 1);
    assert.strictEqual(auditRes.rows[0].status, 'SUCCESS');
    assert.strictEqual(auditRes.rows[0].metadata?.role, 'ADMIN');
  });

  // --- 5. Real-Time Role Reflection ---

  test('15. [SEC-15] Role update reflects immediately on subsequent requests without JWT re-issuance', async () => {
    // Target user ban đầu có token không chứa vai trò quản trị (roles: [])
    const testToken = jwt.sign(
      { id: targetUserId, email: 'role.target@test.com', status: 'ACTIVE', roles: [] },
      config.jwt.secret,
      { expiresIn: '1h' }
    );

    // Gán role SUPER_ADMIN cho targetUserId qua API
    await fetch(`${baseUrl}/roles/assign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        userId: targetUserId,
        role: 'SUPER_ADMIN',
        reason: 'Nâng quyền tức thì để test đồng bộ',
      }),
    });

    // TargetUser dùng token cũ của mình để gọi endpoint bảo vệ /roles
    const testRes = await fetch(`${baseUrl}/roles`, {
      headers: {
        'Authorization': `Bearer ${testToken}`,
      },
    });

    // auth.middleware đồng bộ lại roles trực tiếp từ PostgreSQL, nên user lập tức được nhận diện là SUPER_ADMIN
    assert.strictEqual(testRes.status, 200);
    const body = await testRes.json() as any;
    assert.strictEqual(body.success, true);
  });
});
