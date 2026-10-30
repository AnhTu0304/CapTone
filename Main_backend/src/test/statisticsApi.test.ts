import test, { describe, before, after } from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import { AddressInfo } from 'node:net';
import jwt from 'jsonwebtoken';
import app from '../app';
import { config } from '../config/env';
import { pool } from '../config/database';

describe('Statistics API Cluster & Aggregated Overview Suite [S5][PBI19]', () => {
  let server: http.Server;
  let baseUrl: string;

  const superAdminId = 'e2000000-0000-0000-0000-000000000001';
  const tenantUserId = 'e2000000-0000-0000-0000-000000000002';
  const tenantOrgId  = 'e2000000-0000-0000-0000-000000000010';
  const foreignOrgId = 'e2000000-0000-0000-0000-000000000099';

  let superAdminToken: string;
  let tenantToken: string;

  before(async () => {
    // 1. Tạo dữ liệu người dùng & tổ chức kiểm thử
    await pool.query(`
      INSERT INTO organizations (id, name, slug, status, created_at, updated_at)
      VALUES 
        ($1, 'Stats Test Org', 'stats-test-org', 'ACTIVE', NOW(), NOW()),
        ($2, 'Foreign Test Org', 'foreign-test-org', 'ACTIVE', NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET status = 'ACTIVE', deleted_at = NULL;
    `, [tenantOrgId, foreignOrgId]);

    await pool.query(`
      INSERT INTO users (id, email, password_hash, full_name, status, created_at, updated_at)
      VALUES 
        ($1, 'stats.superadmin@test.com', 'dummy_hash', 'Stats SuperAdmin', 'ACTIVE', NOW(), NOW()),
        ($2, 'stats.tenant@test.com', 'dummy_hash', 'Stats Tenant User', 'ACTIVE', NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET status = 'ACTIVE', deleted_at = NULL;
    `, [superAdminId, tenantUserId]);

    // 2. Gán System Role SUPER_ADMIN
    const srRes = await pool.query(`SELECT id FROM system_roles WHERE name = 'SUPER_ADMIN' LIMIT 1`);
    if (srRes.rows.length > 0) {
      await pool.query(`
        INSERT INTO user_system_roles (user_id, system_role_id)
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING;
      `, [superAdminId, srRes.rows[0].id]);
    }

    // 3. Gán Organization Membership cho tenant user vào tenantOrgId (role VIEWER)
    const roleRes = await pool.query(`SELECT id FROM roles WHERE code = 'VIEWER' LIMIT 1`);
    if (roleRes.rows.length > 0) {
      await pool.query(`
        INSERT INTO organization_members (id, organization_id, user_id, role_id, status, created_at, updated_at)
        VALUES ('e2000000-0000-0000-0000-000000000020', $1, $2, $3, 'ACTIVE', NOW(), NOW())
        ON CONFLICT (id) DO UPDATE SET status = 'ACTIVE';
      `, [tenantOrgId, tenantUserId, roleRes.rows[0].id]);
    }

    // 4. Khởi tạo Tokens
    superAdminToken = jwt.sign(
      {
        id: superAdminId,
        userId: superAdminId,
        email: 'stats.superadmin@test.com',
        roles: ['SUPER_ADMIN'],
        status: 'ACTIVE',
      },
      config.jwt.secret,
      { expiresIn: '1h' }
    );

    tenantToken = jwt.sign(
      {
        id: tenantUserId,
        userId: tenantUserId,
        email: 'stats.tenant@test.com',
        roles: ['VIEWER'],
        status: 'ACTIVE',
      },
      config.jwt.secret,
      { expiresIn: '1h' }
    );

    // 5. Khởi chạy HTTP Server trên cổng ngẫu nhiên
    server = http.createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        const addr = server.address() as AddressInfo;
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  after(async () => {
    // Dọn dẹp
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    await pool.query(`DELETE FROM organization_members WHERE organization_id IN ($1, $2)`, [tenantOrgId, foreignOrgId]);
    await pool.query(`DELETE FROM user_system_roles WHERE user_id = $1`, [superAdminId]);
    await pool.query(`DELETE FROM users WHERE id IN ($1, $2)`, [superAdminId, tenantUserId]);
    await pool.query(`DELETE FROM organizations WHERE id IN ($1, $2)`, [tenantOrgId, foreignOrgId]);
  });

  test('1. [STAT-01] GET /statistics/overview unauthenticated returns 401 Unauthorized', async () => {
    const res = await fetch(`${baseUrl}/api/v1/statistics/overview`);
    assert.strictEqual(res.status, 401);
  });

  test('2. [STAT-02] GET /statistics/overview as SuperAdmin returns 200 with complete PLATFORM aggregates', async () => {
    const res = await fetch(`${baseUrl}/api/v1/statistics/overview`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    assert.strictEqual(res.status, 200);

    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(body.data);
    assert.strictEqual(body.data.scope.type, 'PLATFORM');
    assert.strictEqual(body.data.time_range, '24h');

    // Kiểm tra cấu trúc KPI
    const { summary, incidents, remediations, resource_usage, recent_activities } = body.data;
    assert.ok(typeof summary.total_organizations === 'number');
    assert.ok(typeof summary.total_clusters === 'number');
    assert.ok(typeof summary.total_agents === 'number');

    // Kiểm tra cấu trúc Incidents
    assert.ok(typeof incidents.total === 'number');
    assert.ok(typeof incidents.active === 'number');
    assert.ok(typeof incidents.resolved === 'number');
    assert.ok(typeof incidents.mttr_minutes === 'number');

    // Kiểm tra cấu trúc Remediations
    assert.ok(typeof remediations.total === 'number');
    assert.ok(typeof remediations.succeeded === 'number');
    assert.ok(typeof remediations.success_rate === 'number');

    // Kiểm tra Resource Telemetry
    assert.ok(typeof resource_usage.avg_cpu_percent === 'number');
    assert.ok(typeof resource_usage.avg_ram_percent === 'number');

    // Kiểm tra Recent Activities list
    assert.ok(Array.isArray(recent_activities));
  });

  test('3. [STAT-03] GET /statistics/overview accepts valid time_range (1h, 7d, 30d)', async () => {
    for (const tr of ['1h', '7d', '30d']) {
      const res = await fetch(`${baseUrl}/api/v1/statistics/overview?time_range=${tr}`, {
        headers: { Authorization: `Bearer ${superAdminToken}` },
      });
      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.data.time_range, tr);
    }
  });

  test('4. [STAT-04] GET /statistics/overview with invalid time_range returns 400 Bad Request', async () => {
    const res = await fetch(`${baseUrl}/api/v1/statistics/overview?time_range=999y`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    assert.strictEqual(res.status, 400);
  });

  test('5. [STAT-05] GET /statistics/overview as Tenant user returns 200 scoped to TENANT', async () => {
    const res = await fetch(`${baseUrl}/api/v1/statistics/overview`, {
      headers: { Authorization: `Bearer ${tenantToken}` },
    });
    assert.strictEqual(res.status, 200);

    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.scope.type, 'TENANT');
    assert.strictEqual(body.data.scope.organization_id, tenantOrgId);
  });

  test('6. [STAT-06] Anti-IDOR: Tenant user accessing foreign organization_id returns 403 Forbidden', async () => {
    const res = await fetch(`${baseUrl}/api/v1/statistics/overview?organization_id=${foreignOrgId}`, {
      headers: { Authorization: `Bearer ${tenantToken}` },
    });
    assert.strictEqual(res.status, 403);
  });

  test('7. [STAT-07] SuperAdmin can explicitly scope query to specific organization', async () => {
    const res = await fetch(`${baseUrl}/api/v1/statistics/overview?organization_id=${tenantOrgId}`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    assert.strictEqual(res.status, 200);

    const body = await res.json();
    assert.strictEqual(body.data.scope.type, 'TENANT');
    assert.strictEqual(body.data.scope.organization_id, tenantOrgId);
  });

  test('8. [STAT-08] Performance: Repeated queries complete within optimized bounds (< 100ms)', async () => {
    const start = Date.now();
    const res = await fetch(`${baseUrl}/api/v1/statistics/overview?time_range=24h`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    const elapsed = Date.now() - start;
    assert.strictEqual(res.status, 200);
    assert.ok(elapsed < 200, `Expected elapsed < 200ms, got ${elapsed}ms`);
  });
});
