import test, { describe, before, after } from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import { AddressInfo } from 'node:net';
import WebSocket, { WebSocketServer } from 'ws';
import jwt from 'jsonwebtoken';
import app from '../app';
import { config } from '../config/env';
import { pool } from '../config/database';
import { initTelemetryWebSocket } from '../websocket/telemetryWebSocket';

describe('RBAC Verification Suite (Admin, DevOps, Viewer)', () => {
  let server: http.Server;
  let uiWss: WebSocketServer;
  let baseUrl: string;
  let wsBaseUrl: string;

  // Test Fixture User IDs
  const superAdminId = 'e0000000-0000-0000-0000-000000000001';
  const adminId = 'e0000000-0000-0000-0000-000000000002';
  const devopsId = 'e0000000-0000-0000-0000-000000000003';
  const viewerId = 'e0000000-0000-0000-0000-000000000004';

  let superAdminToken: string;
  let adminToken: string;
  let devopsToken: string;
  let viewerToken: string;

  before(async () => {
    // 1. Ensure test users exist in database
    await pool.query(`
      INSERT INTO users (id, email, password_hash, full_name, status, created_at, updated_at)
      VALUES 
        ($1, 'rbac.superadmin@test.com', 'dummy_hash', 'RBAC SuperAdmin', 'ACTIVE', NOW(), NOW()),
        ($2, 'rbac.admin@test.com', 'dummy_hash', 'RBAC Admin', 'ACTIVE', NOW(), NOW()),
        ($3, 'rbac.devops@test.com', 'dummy_hash', 'RBAC DevOps', 'ACTIVE', NOW(), NOW()),
        ($4, 'rbac.viewer@test.com', 'dummy_hash', 'RBAC Viewer', 'ACTIVE', NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET status = 'ACTIVE', deleted_at = NULL;
    `, [superAdminId, adminId, devopsId, viewerId]);

    // 2. Fetch role IDs
    const srRes = await pool.query(`SELECT id, name FROM system_roles WHERE name IN ('SUPER_ADMIN', 'ADMIN', 'USER')`);
    const rRes = await pool.query(`SELECT id, code FROM roles WHERE code IN ('DEVOPS', 'VIEWER')`);

    const superAdminRoleId = srRes.rows.find(r => r.name === 'SUPER_ADMIN')?.id;
    const adminRoleId = srRes.rows.find(r => r.name === 'ADMIN')?.id;
    const userRoleId = srRes.rows.find(r => r.name === 'USER')?.id;
    const devopsRoleId = rRes.rows.find(r => r.code === 'DEVOPS')?.id;
    const viewerRoleId = rRes.rows.find(r => r.code === 'VIEWER')?.id;

    // Assign system roles
    if (superAdminRoleId) {
      await pool.query(`INSERT INTO user_system_roles (user_id, system_role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING;`, [superAdminId, superAdminRoleId]);
    }
    if (adminRoleId) {
      await pool.query(`INSERT INTO user_system_roles (user_id, system_role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING;`, [adminId, adminRoleId]);
    }
    if (userRoleId) {
      await pool.query(`INSERT INTO user_system_roles (user_id, system_role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING;`, [viewerId, userRoleId]);
    }

    // Assign org roles for DevOps & Viewer
    let orgRes = await pool.query(`SELECT id FROM organizations LIMIT 1`);
    if (orgRes.rows.length === 0) {
      orgRes = await pool.query(`
        INSERT INTO organizations (id, name, slug, status, created_at, updated_at)
        VALUES ('f0000000-0000-0000-0000-000000000001', 'Test Organization', 'test-org', 'ACTIVE', NOW(), NOW())
        ON CONFLICT (id) DO NOTHING
        RETURNING id;
      `);
      if (orgRes.rows.length === 0) {
        orgRes = await pool.query(`SELECT id FROM organizations LIMIT 1`);
      }
    }
    const orgId = orgRes.rows[0].id;
    if (devopsRoleId) {
      await pool.query(`
        INSERT INTO organization_members (organization_id, user_id, role_id, status)
        VALUES ($1, $2, $3, 'ACTIVE')
        ON CONFLICT (organization_id, user_id) DO UPDATE SET role_id = $3, status = 'ACTIVE';
      `, [orgId, devopsId, devopsRoleId]);
    }
    if (viewerRoleId) {
      await pool.query(`
        INSERT INTO organization_members (organization_id, user_id, role_id, status)
        VALUES ($1, $2, $3, 'ACTIVE')
        ON CONFLICT (organization_id, user_id) DO UPDATE SET role_id = $3, status = 'ACTIVE';
      `, [orgId, viewerId, viewerRoleId]);
    }

    // 3. Generate JWT tokens
    superAdminToken = jwt.sign(
      { id: superAdminId, email: 'rbac.superadmin@test.com', status: 'ACTIVE', roles: ['SUPER_ADMIN'] },
      config.jwt.secret,
      { expiresIn: '1h', algorithm: 'HS256' }
    );

    adminToken = jwt.sign(
      { id: adminId, email: 'rbac.admin@test.com', status: 'ACTIVE', roles: ['ADMIN'] },
      config.jwt.secret,
      { expiresIn: '1h', algorithm: 'HS256' }
    );

    devopsToken = jwt.sign(
      { id: devopsId, email: 'rbac.devops@test.com', status: 'ACTIVE', roles: ['DEVOPS'] },
      config.jwt.secret,
      { expiresIn: '1h', algorithm: 'HS256' }
    );

    viewerToken = jwt.sign(
      { id: viewerId, email: 'rbac.viewer@test.com', status: 'ACTIVE', roles: ['VIEWER'] },
      config.jwt.secret,
      { expiresIn: '1h', algorithm: 'HS256' }
    );

    // 4. Start HTTP test server with UI WebSocket
    server = http.createServer(app);
    uiWss = initTelemetryWebSocket(server);
    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        const addr = server.address() as AddressInfo;
        baseUrl = `http://127.0.0.1:${addr.port}`;
        wsBaseUrl = `ws://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (uiWss) {
      uiWss.close();
    }
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    await pool.end();
  });

  const requestApi = async (path: string, options: { method?: string; token?: string; body?: any } = {}) => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (options.token) {
      headers['Authorization'] = `Bearer ${options.token}`;
    }

    const res = await fetch(`${baseUrl}${path}`, {
      method: options.method || 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    let data: any = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }

    return { status: res.status, data };
  };

  // ==========================================
  // 1. VIEWER RESTRICTIONS TEST SUITE
  // ==========================================
  describe('1. Viewer Access Controls (Strict Overview Only)', () => {
    test('1.1. Viewer CAN access Overview Telemetry Live Summary (200 OK)', async () => {
      const res = await requestApi('/api/v1/telemetry/live-summary', { token: viewerToken });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data?.success, true);
    });

    test('1.2. Viewer is FORBIDDEN (403) from AI Predictions list', async () => {
      const res = await requestApi('/api/v1/ai/predictions', { token: viewerToken });
      assert.strictEqual(res.status, 403);
      assert.match(res.data?.message, /Từ chối truy cập/i);
    });

    test('1.3. Viewer is FORBIDDEN (403) from AI Incidents & RCA', async () => {
      const res = await requestApi('/api/v1/ai/incidents', { token: viewerToken });
      assert.strictEqual(res.status, 403);
      assert.match(res.data?.message, /Từ chối truy cập/i);
    });

    test('1.4. Viewer is FORBIDDEN (403) from Detailed Telemetry Metrics Sequence', async () => {
      const res = await requestApi('/api/v1/telemetry/services/svc-test/metrics-sequence', { token: viewerToken });
      assert.strictEqual(res.status, 403);
      assert.match(res.data?.message, /Từ chối truy cập/i);
    });

    test('1.5. Viewer is FORBIDDEN (403) from Rule Engine Thresholds & Configurations', async () => {
      const res = await requestApi('/api/v1/rule-engine/thresholds', { token: viewerToken });
      assert.strictEqual(res.status, 403);
      assert.match(res.data?.message, /Từ chối truy cập/i);
    });

    test('1.6. Viewer is FORBIDDEN (403) from User Management list', async () => {
      const res = await requestApi('/api/v1/users', { token: viewerToken });
      assert.strictEqual(res.status, 403);
      assert.match(res.data?.message, /Từ chối truy cập/i);
    });

    test('1.7. Viewer is FORBIDDEN (403) from System Role Assignment', async () => {
      const res = await requestApi('/api/v1/roles/assign', {
        method: 'POST',
        token: viewerToken,
        body: { user_id: adminId, role_name_or_id: 'ADMIN' },
      });
      assert.strictEqual(res.status, 403);
      assert.match(res.data?.message, /Từ chối truy cập/i);
    });
  });

  // ==========================================
  // 2. DEVOPS ACCESS CONTROLS TEST SUITE
  // ==========================================
  describe('2. DevOps Access Controls (Infrastructure & AI Allowed, User Management Prohibited)', () => {
    test('2.1. DevOps CAN access Overview Telemetry Live Summary (200 OK)', async () => {
      const res = await requestApi('/api/v1/telemetry/live-summary', { token: devopsToken });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data?.success, true);
    });

    test('2.2. DevOps CAN access AI Predictions list (200 OK)', async () => {
      const res = await requestApi('/api/v1/ai/predictions', { token: devopsToken });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data?.success, true);
    });

    test('2.3. DevOps CAN access AI Incidents list (200 OK)', async () => {
      const res = await requestApi('/api/v1/ai/incidents', { token: devopsToken });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data?.success, true);
    });

    test('2.4. DevOps CAN access Rule Engine Thresholds (200 OK)', async () => {
      const res = await requestApi('/api/v1/rule-engine/thresholds', { token: devopsToken });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data?.success, true);
    });

    test('2.5. DevOps is FORBIDDEN (403) from User Management list', async () => {
      const res = await requestApi('/api/v1/users', { token: devopsToken });
      assert.strictEqual(res.status, 403);
      assert.match(res.data?.message, /Từ chối truy cập/i);
    });

    test('2.6. DevOps is FORBIDDEN (403) from User Status Modification', async () => {
      const res = await requestApi(`/api/v1/users/${viewerId}/status`, {
        method: 'PATCH',
        token: devopsToken,
        body: { status: 'SUSPENDED' },
      });
      assert.strictEqual(res.status, 403);
      assert.match(res.data?.message, /Từ chối truy cập/i);
    });

    test('2.7. DevOps is FORBIDDEN (403) from System Role Assignment', async () => {
      const res = await requestApi('/api/v1/roles/assign', {
        method: 'POST',
        token: devopsToken,
        body: { user_id: viewerId, role_name_or_id: 'ADMIN' },
      });
      assert.strictEqual(res.status, 403);
      assert.match(res.data?.message, /Từ chối truy cập/i);
    });
  });

  // ==========================================
  // 3. ADMIN ACCESS CONTROLS TEST SUITE
  // ==========================================
  describe('3. Admin Access Controls (User Management & Operations Allowed, System Role Escalation Blocked)', () => {
    test('3.1. Admin CAN access Overview Live Summary (200 OK)', async () => {
      const res = await requestApi('/api/v1/telemetry/live-summary', { token: adminToken });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data?.success, true);
    });

    test('3.2. Admin CAN access User Management list (200 OK)', async () => {
      const res = await requestApi('/api/v1/users', { token: adminToken });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data?.success, true);
    });

    test('3.3. Admin CAN access AI Predictions & Incidents (200 OK)', async () => {
      const resPred = await requestApi('/api/v1/ai/predictions', { token: adminToken });
      assert.strictEqual(resPred.status, 200);
      const resInc = await requestApi('/api/v1/ai/incidents', { token: adminToken });
      assert.strictEqual(resInc.status, 200);
    });

    test('3.4. Admin is FORBIDDEN (403) from System Role Assignment (SuperAdmin only)', async () => {
      const res = await requestApi('/api/v1/roles/assign', {
        method: 'POST',
        token: adminToken,
        body: { user_id: viewerId, role_name_or_id: 'ADMIN' },
      });
      assert.strictEqual(res.status, 403);
      assert.match(res.data?.message, /Từ chối truy cập/i);
    });
  });

  // ==========================================
  // 4. SUPER_ADMIN FULL ACCESS TEST SUITE
  // ==========================================
  describe('4. SuperAdmin Full Access Controls', () => {
    test('4.1. SuperAdmin CAN access Telemetry, AI, and User Management (200 OK)', async () => {
      const resTel = await requestApi('/api/v1/telemetry/live-summary', { token: superAdminToken });
      assert.strictEqual(resTel.status, 200);

      const resUsers = await requestApi('/api/v1/users', { token: superAdminToken });
      assert.strictEqual(resUsers.status, 200);

      const resAi = await requestApi('/api/v1/ai/predictions', { token: superAdminToken });
      assert.strictEqual(resAi.status, 200);
    });
  });

  // ==========================================
  // 5. SECURITY VULNERABILITY REGRESSION TESTS
  // ==========================================
  describe('5. Security Vulnerability Regression Tests', () => {
    test('5.1. [SEC-01] SME_OWNER is strictly FORBIDDEN (403) from Platform User Management', async () => {
      const smeOwnerToken = jwt.sign(
        { id: viewerId, email: 'sme.owner@tenant-a.com', status: 'ACTIVE', roles: ['SME_OWNER'] },
        config.jwt.secret,
        { expiresIn: '1h', algorithm: 'HS256' }
      );

      const res = await requestApi('/api/v1/users', { token: smeOwnerToken });
      assert.strictEqual(res.status, 403, 'SME_OWNER must not be escalated to platform ADMIN');
      assert.match(res.data?.message, /Từ chối truy cập/i);
    });

    test('5.2. [SEC-02] Stale JWT with Revoked Role is FORBIDDEN (403) immediately', async () => {
      const tempAdminId = 'e0000000-0000-0000-0000-000000000099';
      // Create active user
      await pool.query(`
        INSERT INTO users (id, email, password_hash, full_name, status, created_at, updated_at)
        VALUES ($1, 'temp.admin@test.com', 'dummy_hash', 'Temp Admin', 'ACTIVE', NOW(), NOW())
        ON CONFLICT (id) DO UPDATE SET status = 'ACTIVE';
      `, [tempAdminId]);

      // Assign ADMIN role in DB
      const adminRoleRes = await pool.query(`SELECT id FROM system_roles WHERE name = 'ADMIN'`);
      if (adminRoleRes.rows[0]) {
        await pool.query(`
          INSERT INTO user_system_roles (user_id, system_role_id)
          VALUES ($1, $2)
          ON CONFLICT DO NOTHING;
        `, [tempAdminId, adminRoleRes.rows[0].id]);
      }

      // Generate token claiming ADMIN
      const tokenWithAdmin = jwt.sign(
        { id: tempAdminId, email: 'temp.admin@test.com', status: 'ACTIVE', roles: ['ADMIN'] },
        config.jwt.secret,
        { expiresIn: '1h', algorithm: 'HS256' }
      );

      // Now REVOKE ADMIN role in DB
      await pool.query(`DELETE FROM user_system_roles WHERE user_id = $1`, [tempAdminId]);

      // Request User Management with stale token claiming ADMIN
      const res = await requestApi('/api/v1/users', { token: tokenWithAdmin });
      assert.strictEqual(res.status, 403, 'Stale token with revoked role must be rejected with 403');
    });

    test('5.3. [SEC-04] Viewer live-summary does NOT leak raw metrics, container logs, or AI predictions', async () => {
      const res = await requestApi('/api/v1/telemetry/live-summary', { token: viewerToken });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data?.success, true);

      // Verify sanitized payload
      const payload = res.data?.data;
      assert.ok(payload, 'Payload exists');
      assert.strictEqual(payload.raw_metrics?.length ?? 0, 0, 'raw_metrics must be omitted for Viewer');
      assert.strictEqual(payload.logs?.length ?? 0, 0, 'logs must be omitted for Viewer');
      assert.strictEqual(payload.predictions?.length ?? 0, 0, 'predictions must be omitted for Viewer');
      assert.strictEqual(payload.events?.length ?? 0, 0, 'events must be omitted for Viewer');
    });

    test('5.4. [SEC-05] WebSocket /api/v1/telemetry/ws rejects unauthenticated connection (401)', async () => {
      const unauthWs = new WebSocket(`${wsBaseUrl}/api/v1/telemetry/ws`);

      const errorOrClosePromise = new Promise<{ rejected: boolean; codeOrStatus?: any }>((resolve) => {
        unauthWs.on('error', (err: any) => {
          resolve({ rejected: true, codeOrStatus: err.message });
        });
        unauthWs.on('unexpected-response', (req, res) => {
          resolve({ rejected: true, codeOrStatus: res.statusCode });
        });
        unauthWs.on('open', () => {
          resolve({ rejected: false });
        });
      });

      const result = await errorOrClosePromise;
      unauthWs.close();
      assert.strictEqual(result.rejected, true, 'Unauthenticated WebSocket connection must be rejected');
    });

    test('5.5. [SEC-05] WebSocket /api/v1/telemetry/ws accepts authenticated viewer and sanitizes initial_state', async () => {
      const authWs = new WebSocket(`${wsBaseUrl}/api/v1/telemetry/ws?token=${viewerToken}`);

      const msgPromise = new Promise<any>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('WebSocket timeout waiting for initial_state')), 4000);
        authWs.on('message', (data) => {
          clearTimeout(timer);
          try {
            resolve(JSON.parse(data.toString()));
          } catch (e) {
            reject(e);
          }
        });
        authWs.on('error', (err) => {
          clearTimeout(timer);
          reject(err);
        });
      });

      const initialMsg = await msgPromise;
      authWs.close();

      assert.strictEqual(initialMsg.type, 'initial_state');
      assert.ok(initialMsg.data, 'initial_state data must exist');
      assert.strictEqual(initialMsg.data.raw_metrics?.length ?? 0, 0, 'WebSocket initial_state raw_metrics must be omitted for Viewer');
      assert.strictEqual(initialMsg.data.logs?.length ?? 0, 0, 'WebSocket initial_state logs must be omitted for Viewer');
      assert.strictEqual(initialMsg.data.events?.length ?? 0, 0, 'WebSocket initial_state events must be omitted for Viewer');
      assert.strictEqual(initialMsg.data.predictions?.length ?? 0, 0, 'WebSocket initial_state predictions must be omitted for Viewer');
    });
  });
});
