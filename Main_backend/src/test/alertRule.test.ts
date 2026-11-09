import test, { describe, before, after } from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import { AddressInfo } from 'node:net';
import jwt from 'jsonwebtoken';
import app from '../app';
import { config } from '../config/env';
import { pool } from '../config/database';
import { testRedisConnection, closeRedis } from '../config/redis';
import { AlertRuleModel } from '../models/alertRule.model';
import { RedisCacheService } from './../services/redisCache.service';

describe('Cụm API & DB Quản lý Cấu hình Ngưỡng Cảnh báo (Alert Rules) [S5][PBI21 Task 3.1]', () => {
  let server: http.Server;
  let baseUrl: string;

  const ownerAId = 'a1111111-0000-4000-8000-000000000001';
  const devopsAId = 'a1111111-0000-4000-8000-000000000002';
  const viewerAId = 'a1111111-0000-4000-8000-000000000003';
  const ownerBId = 'a1111111-0000-4000-8000-000000000004';
  const superAdminId = 'a1111111-0000-4000-8000-000000000005';

  const orgAId = 'b1111111-0000-4000-8000-000000000001';
  const orgBId = 'b1111111-0000-4000-8000-000000000002';

  const envAId = 'c1111111-0000-4000-8000-000000000001';
  const envBId = 'c1111111-0000-4000-8000-000000000002';

  const clusterAId = 'd1111111-0000-4000-8000-000000000001';
  const clusterBId = 'd1111111-0000-4000-8000-000000000002';

  let ownerAJwt: string;
  let devopsAJwt: string;
  let viewerAJwt: string;
  let ownerBJwt: string;
  let superAdminJwt: string;

  let createdRuleId: string;

  async function requestJson(
    path: string,
    options: {
      method?: string;
      headers?: Record<string, string>;
      body?: any;
    } = {}
  ) {
    const res = await fetch(`${baseUrl}${path}`, {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
    const json = await res.json().catch(() => ({}));
    return { status: res.status, body: json };
  }

  before(async () => {
    await testRedisConnection();

    // Ensure migration 15 is executed
    await pool.query(`
      CREATE TABLE IF NOT EXISTS alert_rules (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        cluster_id UUID REFERENCES clusters(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        metric_type VARCHAR(50) NOT NULL,
        operator VARCHAR(50) NOT NULL,
        threshold_value NUMERIC(14, 2) NOT NULL,
        unit VARCHAR(50) NOT NULL,
        severity VARCHAR(50) NOT NULL DEFAULT 'WARNING',
        evaluation_window VARCHAR(50) NOT NULL DEFAULT '5m',
        duration INTEGER NOT NULL DEFAULT 60,
        cooldown_seconds INTEGER NOT NULL DEFAULT 300,
        enabled BOOLEAN NOT NULL DEFAULT true,
        created_by UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // Clean test records
    await pool.query(`DELETE FROM alert_rules WHERE organization_id IN ($1, $2)`, [orgAId, orgBId]);

    // Role IDs
    const rolesRes = await pool.query(`SELECT id, code FROM organization_roles WHERE scope = 'ORGANIZATION'`);
    const smeOwnerRoleId = rolesRes.rows.find((r) => r.code === 'SME_OWNER')?.id;
    const devopsRoleId = rolesRes.rows.find((r) => r.code === 'DEVOPS')?.id;
    const viewerRoleId = rolesRes.rows.find((r) => r.code === 'VIEWER')?.id;

    // Users
    await pool.query(
      `INSERT INTO users (id, email, password_hash, full_name, status, created_at, updated_at)
       VALUES
         ($1, 'owner.a.ar@test.com', 'dummy_hash', 'Owner A AlertRules', 'ACTIVE', NOW(), NOW()),
         ($2, 'devops.a.ar@test.com', 'dummy_hash', 'DevOps A AlertRules', 'ACTIVE', NOW(), NOW()),
         ($3, 'viewer.a.ar@test.com', 'dummy_hash', 'Viewer A AlertRules', 'ACTIVE', NOW(), NOW()),
         ($4, 'owner.b.ar@test.com', 'dummy_hash', 'Owner B AlertRules', 'ACTIVE', NOW(), NOW()),
         ($5, 'superadmin.ar@test.com', 'dummy_hash', 'SuperAdmin AlertRules', 'ACTIVE', NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET status = 'ACTIVE', deleted_at = NULL;`,
      [ownerAId, devopsAId, viewerAId, ownerBId, superAdminId]
    );

    // Organizations
    await pool.query(
      `INSERT INTO organizations (id, name, slug, status, created_by, created_at, updated_at)
       VALUES
         ($1, 'AlertRule Org A', 'ar-org-a', 'ACTIVE', $2, NOW(), NOW()),
         ($3, 'AlertRule Org B', 'ar-org-b', 'ACTIVE', $4, NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET status = 'ACTIVE', deleted_at = NULL;`,
      [orgAId, ownerAId, orgBId, ownerBId]
    );

    // Memberships
    await pool.query(
      `INSERT INTO organization_members (organization_id, user_id, role_id, status, joined_at)
       VALUES
         ($1, $2, $3, 'ACTIVE', NOW()),
         ($1, $4, $5, 'ACTIVE', NOW()),
         ($1, $6, $7, 'ACTIVE', NOW()),
         ($8, $9, $3, 'ACTIVE', NOW())
       ON CONFLICT (organization_id, user_id) DO UPDATE SET status = 'ACTIVE';`,
      [
        orgAId, ownerAId, smeOwnerRoleId,
        devopsAId, devopsRoleId,
        viewerAId, viewerRoleId,
        orgBId, ownerBId,
      ]
    );

    // Environments
    await pool.query(
      `INSERT INTO environments (id, organization_id, name, code, environment_type, created_by, created_at, updated_at)
       VALUES
         ($1, $2, 'Env A AR', 'env-a-ar', 'PRODUCTION', $3, NOW(), NOW()),
         ($4, $5, 'Env B AR', 'env-b-ar', 'STAGING', $6, NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET deleted_at = NULL;`,
      [envAId, orgAId, ownerAId, envBId, orgBId, ownerBId]
    );

    // Clusters
    await pool.query(
      `INSERT INTO clusters (id, environment_id, name, cluster_uid, provider, kubernetes_version, status, created_at, updated_at)
       VALUES
         ($1, $2, 'k8s-cluster-ar-a', 'uid-ar-a', 'MINIKUBE', 'v1.37.0', 'CONNECTED', NOW(), NOW()),
         ($3, $4, 'k8s-cluster-ar-b', 'uid-ar-b', 'MINIKUBE', 'v1.37.0', 'CONNECTED', NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET deleted_at = NULL;`,
      [clusterAId, envAId, clusterBId, envBId]
    );

    // Tokens
    ownerAJwt = jwt.sign(
      { id: ownerAId, email: 'owner.a.ar@test.com', roles: ['SME_OWNER'], status: 'ACTIVE', organization_id: orgAId },
      config.jwt.secret,
      { expiresIn: '1h' }
    );
    devopsAJwt = jwt.sign(
      { id: devopsAId, email: 'devops.a.ar@test.com', roles: ['DEVOPS'], status: 'ACTIVE', organization_id: orgAId },
      config.jwt.secret,
      { expiresIn: '1h' }
    );
    viewerAJwt = jwt.sign(
      { id: viewerAId, email: 'viewer.a.ar@test.com', roles: ['VIEWER'], status: 'ACTIVE', organization_id: orgAId },
      config.jwt.secret,
      { expiresIn: '1h' }
    );
    ownerBJwt = jwt.sign(
      { id: ownerBId, email: 'owner.b.ar@test.com', roles: ['SME_OWNER'], status: 'ACTIVE', organization_id: orgBId },
      config.jwt.secret,
      { expiresIn: '1h' }
    );
    superAdminJwt = jwt.sign(
      { id: superAdminId, email: 'superadmin.ar@test.com', roles: ['SUPER_ADMIN'], status: 'ACTIVE' },
      config.jwt.secret,
      { expiresIn: '1h' }
    );

    // Start ephemeral server
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
    try {
      if (server) {
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }
      await pool.query(`DELETE FROM alert_rules WHERE organization_id IN ($1, $2)`, [orgAId, orgBId]);
      await pool.query(`DELETE FROM clusters WHERE id IN ($1, $2)`, [clusterAId, clusterBId]);
      await pool.query(`DELETE FROM environments WHERE id IN ($1, $2)`, [envAId, envBId]);
      await pool.query(`DELETE FROM organization_members WHERE organization_id IN ($1, $2)`, [orgAId, orgBId]);
      await pool.query(`DELETE FROM audit_logs WHERE organization_id IN ($1, $2) OR user_id IN ($3, $4, $5, $6, $7)`, [
        orgAId, orgBId, ownerAId, devopsAId, viewerAId, ownerBId, superAdminId,
      ]);
      await pool.query(`DELETE FROM organizations WHERE id IN ($1, $2)`, [orgAId, orgBId]);
      await pool.query(`DELETE FROM users WHERE id IN ($1, $2, $3, $4, $5)`, [
        ownerAId, devopsAId, viewerAId, ownerBId, superAdminId,
      ]);
      await closeRedis();
      await pool.end();
    } catch (afterErr: any) {
      console.error('AFTER HOOK CAUGHT ERROR:', afterErr.message);
    }
  });

  // =========================================================================
  // 1. CREATE ALERT RULE API
  // =========================================================================

  test('1. [AR-01] Create Rule: Valid CPU threshold creates rule with HTTP 201 Created', async () => {
    const payload = {
      name: 'High CPU Saturation Alert',
      description: 'Cảnh báo khi CPU của cụm vượt quá 85%',
      cluster_id: clusterAId,
      metric_type: 'CPU',
      operator: 'GREATER_THAN',
      threshold_value: 85.5,
      unit: '%',
      severity: 'WARNING',
      evaluation_window: '5m',
      duration: 60,
      cooldown_seconds: 300,
      enabled: true,
    };

    const res = await requestJson('/api/v1/alert-rules', {
      method: 'POST',
      headers: { Authorization: `Bearer ${devopsAJwt}` },
      body: payload,
    });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.name, 'High CPU Saturation Alert');
    assert.strictEqual(res.body.data.organization_id, orgAId);
    assert.strictEqual(res.body.data.cluster_id, clusterAId);
    assert.strictEqual(res.body.data.metric_type, 'CPU');
    assert.strictEqual(res.body.data.threshold_value, 85.5);
    assert.strictEqual(res.body.data.unit, '%');
    assert.strictEqual(res.body.data.severity, 'WARNING');

    createdRuleId = res.body.data.id;
    assert.ok(createdRuleId, 'Rule ID must be defined');
  });

  test('2. [AR-02] Duplicate Name: Creating rule with existing name in same organization returns 409 Conflict', async () => {
    const payload = {
      name: 'High CPU Saturation Alert', // Same name as AR-01
      metric_type: 'CPU',
      operator: 'GREATER_THAN',
      threshold_value: 90,
      unit: '%',
    };

    const res = await requestJson('/api/v1/alert-rules', {
      method: 'POST',
      headers: { Authorization: `Bearer ${devopsAJwt}` },
      body: payload,
    });

    assert.strictEqual(res.status, 409);
    assert.strictEqual(res.body.success, false);
    assert.match(res.body.message, /đã tồn tại trong tổ chức/i);
  });

  test('3. [AR-03] Validation: CPU with incompatible unit (GB) returns 400 Bad Request', async () => {
    const payload = {
      name: 'Invalid Unit CPU Rule',
      metric_type: 'CPU',
      operator: 'GREATER_THAN',
      threshold_value: 50,
      unit: 'GB', // Invalid unit for CPU
    };

    const res = await requestJson('/api/v1/alert-rules', {
      method: 'POST',
      headers: { Authorization: `Bearer ${devopsAJwt}` },
      body: payload,
    });

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.success, false);
    assert.match(res.body.message, /không hợp lệ cho chỉ số 'CPU'/i);
  });

  test('4. [AR-04] Validation: Percentage threshold > 100 or < 0 returns 400 Bad Request', async () => {
    const payloadOver = {
      name: 'Exceed 100 Percent Rule',
      metric_type: 'RAM',
      operator: 'GREATER_THAN',
      threshold_value: 105.0,
      unit: '%',
    };

    const resOver = await requestJson('/api/v1/alert-rules', {
      method: 'POST',
      headers: { Authorization: `Bearer ${devopsAJwt}` },
      body: payloadOver,
    });

    assert.strictEqual(resOver.status, 400);
    assert.match(resOver.body.message, /từ 0 đến 100/i);

    const payloadNeg = {
      name: 'Negative Percent Rule',
      metric_type: 'RAM',
      operator: 'GREATER_THAN',
      threshold_value: -5.0,
      unit: '%',
    };

    const resNeg = await requestJson('/api/v1/alert-rules', {
      method: 'POST',
      headers: { Authorization: `Bearer ${devopsAJwt}` },
      body: payloadNeg,
    });

    assert.strictEqual(resNeg.status, 400);
  });

  test('5. [AR-05] Validation: Network rate with percentage unit returns 400 Bad Request', async () => {
    const payload = {
      name: 'Invalid Network Rate Rule',
      metric_type: 'NETWORK_RECEIVE',
      operator: 'GREATER_THAN',
      threshold_value: 80,
      unit: '%', // Network rate must use throughput units like MB/s, KB/s, B/s
    };

    const res = await requestJson('/api/v1/alert-rules', {
      method: 'POST',
      headers: { Authorization: `Bearer ${devopsAJwt}` },
      body: payload,
    });

    assert.strictEqual(res.status, 400);
    assert.match(res.body.message, /không hợp lệ cho chỉ số 'NETWORK_RECEIVE'/i);
  });

  test('6. [AR-06] Validation: Valid Network throughput rule (MB/s) creates successfully', async () => {
    const payload = {
      name: 'Network Flood Inbound',
      metric_type: 'NETWORK_RECEIVE',
      operator: 'GREATER_THAN_OR_EQUAL',
      threshold_value: 100,
      unit: 'MB/s',
      severity: 'CRITICAL',
    };

    const res = await requestJson('/api/v1/alert-rules', {
      method: 'POST',
      headers: { Authorization: `Bearer ${devopsAJwt}` },
      body: payload,
    });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.data.metric_type, 'NETWORK_RECEIVE');
    assert.strictEqual(res.body.data.unit, 'MB/s');
  });

  test('7. [AR-07] Validation: Malformed evaluation_window (e.g. 5x) returns 400 Bad Request', async () => {
    const payload = {
      name: 'Bad Window Rule',
      metric_type: 'DISK',
      operator: 'GREATER_THAN',
      threshold_value: 90,
      unit: '%',
      evaluation_window: '5x', // Invalid
    };

    const res = await requestJson('/api/v1/alert-rules', {
      method: 'POST',
      headers: { Authorization: `Bearer ${devopsAJwt}` },
      body: payload,
    });

    assert.strictEqual(res.status, 400);
  });

  test('8. [AR-08] Foreign Cluster Ownership: Assigning Cluster B to Org A rule returns 403 Forbidden', async () => {
    const payload = {
      name: 'Cross Cluster Injection Alert',
      cluster_id: clusterBId, // Belongs to Org B
      metric_type: 'CPU',
      operator: 'GREATER_THAN',
      threshold_value: 80,
      unit: '%',
    };

    const res = await requestJson('/api/v1/alert-rules', {
      method: 'POST',
      headers: { Authorization: `Bearer ${devopsAJwt}` },
      body: payload,
    });

    assert.strictEqual(res.status, 403);
    assert.match(res.body.message, /không thuộc quyền sở hữu của tổ chức/i);
  });

  // =========================================================================
  // 2. LIST & GET DETAIL & FILTERS
  // =========================================================================

  test('9. [AR-09] List Rules: Returns paginated rules strictly scoped to user organization', async () => {
    const res = await requestJson('/api/v1/alert-rules', {
      headers: { Authorization: `Bearer ${devopsAJwt}` },
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(Array.isArray(res.body.data.items), 'data.items must be array');
    assert.ok(res.body.data.items.length >= 2, 'Should have at least 2 rules created');
    assert.ok(
      res.body.data.items.every((r: any) => r.organization_id === orgAId),
      'All rules must belong to Org A'
    );
    assert.strictEqual(res.body.data.pagination.page, 1);
  });

  test('10. [AR-10] Filters: Filter by metric_type=CPU and severity=WARNING returns matching rules only', async () => {
    const res = await requestJson('/api/v1/alert-rules?metric_type=CPU&severity=WARNING', {
      headers: { Authorization: `Bearer ${viewerAJwt}` },
    });

    assert.strictEqual(res.status, 200);
    assert.ok(res.body.data.items.length >= 1);
    assert.ok(res.body.data.items.every((r: any) => r.metric_type === 'CPU' && r.severity === 'WARNING'));
  });

  test('11. [AR-11] Search: Search query matches rule name correctly', async () => {
    const res = await requestJson('/api/v1/alert-rules?search=Saturation', {
      headers: { Authorization: `Bearer ${viewerAJwt}` },
    });

    assert.strictEqual(res.status, 200);
    assert.ok(res.body.data.items.length >= 1);
    assert.ok(res.body.data.items.some((r: any) => r.name.includes('Saturation')));
  });

  test('12. [AR-12] Get Detail: Viewing existing rule returns 200 OK with joined cluster name', async () => {
    const res = await requestJson(`/api/v1/alert-rules/${createdRuleId}`, {
      headers: { Authorization: `Bearer ${viewerAJwt}` },
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.data.id, createdRuleId);
    assert.strictEqual(res.body.data.cluster_name, 'k8s-cluster-ar-a');
  });

  // =========================================================================
  // 3. UPDATE & TOGGLE & DELETE
  // =========================================================================

  test('13. [AR-13] Update Rule: Modifying threshold and severity returns 200 OK with updated values', async () => {
    const updatePayload = {
      threshold_value: 92.0,
      severity: 'CRITICAL',
      description: 'Ngưỡng CPU cập nhật khẩn cấp',
    };

    const res = await requestJson(`/api/v1/alert-rules/${createdRuleId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${devopsAJwt}` },
      body: updatePayload,
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.data.threshold_value, 92.0);
    assert.strictEqual(res.body.data.severity, 'CRITICAL');
    assert.strictEqual(res.body.data.description, 'Ngưỡng CPU cập nhật khẩn cấp');
  });

  test('14. [AR-14] Toggle Status: PATCH /status changes enabled from true to false', async () => {
    const res = await requestJson(`/api/v1/alert-rules/${createdRuleId}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${devopsAJwt}` },
      body: { enabled: false },
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.data.enabled, false);

    // Verify persisted in DB
    const check = await AlertRuleModel.findById(createdRuleId);
    assert.strictEqual(check?.enabled, false);
  });

  // =========================================================================
  // 4. SECURITY & ANTI-IDOR & RBAC
  // =========================================================================

  test('15. [AR-15] Anti-IDOR: Tenant B attempting to GET Tenant A rule returns 403 Forbidden', async () => {
    const res = await requestJson(`/api/v1/alert-rules/${createdRuleId}`, {
      headers: { Authorization: `Bearer ${ownerBJwt}` },
    });

    assert.strictEqual(res.status, 403);
    assert.match(res.body.message, /tổ chức/i);
  });

  test('16. [AR-16] Anti-IDOR: Tenant B attempting to UPDATE Tenant A rule returns 403 Forbidden', async () => {
    const res = await requestJson(`/api/v1/alert-rules/${createdRuleId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${ownerBJwt}` },
      body: { threshold_value: 10.0 },
    });

    assert.strictEqual(res.status, 403);
  });

  test('17. [AR-17] Anti-IDOR: Tenant B attempting to DELETE Tenant A rule returns 403 Forbidden', async () => {
    const res = await requestJson(`/api/v1/alert-rules/${createdRuleId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${ownerBJwt}` },
    });

    assert.strictEqual(res.status, 403);
  });

  test('18. [AR-18] Anti-IDOR: Tenant B attempting to spoof organization_id in POST returns 403 Forbidden', async () => {
    const payload = {
      name: 'Spoofed Tenant Rule',
      organization_id: orgAId, // Trying to inject into Tenant A
      metric_type: 'CPU',
      operator: 'GREATER_THAN',
      threshold_value: 80,
      unit: '%',
    };

    const res = await requestJson('/api/v1/alert-rules', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerBJwt}` },
      body: payload,
    });

    assert.strictEqual(res.status, 403);
  });

  test('19. [AR-19] RBAC: VIEWER role cannot CREATE, UPDATE, or DELETE rules (403 Forbidden)', async () => {
    // Attempt Create
    const resCreate = await requestJson('/api/v1/alert-rules', {
      method: 'POST',
      headers: { Authorization: `Bearer ${viewerAJwt}` },
      body: { name: 'Viewer Illegal Rule', metric_type: 'CPU', operator: 'GREATER_THAN', threshold_value: 50, unit: '%' },
    });
    assert.strictEqual(resCreate.status, 403);

    // Attempt Update
    const resUpdate = await requestJson(`/api/v1/alert-rules/${createdRuleId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${viewerAJwt}` },
      body: { threshold_value: 60 },
    });
    assert.strictEqual(resUpdate.status, 403);

    // Attempt Delete
    const resDelete = await requestJson(`/api/v1/alert-rules/${createdRuleId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${viewerAJwt}` },
    });
    assert.strictEqual(resDelete.status, 403);
  });

  test('20. [AR-20] SuperAdmin Access: SuperAdmin can query specific organization explicitly', async () => {
    const res = await requestJson(`/api/v1/alert-rules?organization_id=${orgAId}`, {
      headers: { Authorization: `Bearer ${superAdminJwt}` },
    });

    assert.strictEqual(res.status, 200);
    assert.ok(res.body.data.items.length >= 1);
  });

  // =========================================================================
  // 5. CACHING & ENGINE INTEGRATION & CLEAN DELETION
  // =========================================================================

  test('21. [AR-21] Engine Integration: findActiveRules returns enabled rules matching criteria', async () => {
    // Re-enable rule
    await AlertRuleModel.toggleStatus(createdRuleId, orgAId, true);

    const activeRules = await AlertRuleModel.findActiveRules(orgAId, clusterAId, 'CPU');
    assert.ok(activeRules.length >= 1);
    assert.strictEqual(activeRules[0].metric_type, 'CPU');
    assert.strictEqual(activeRules[0].enabled, true);
  });

  test('22. [AR-22] Delete Rule: Deleting rule returns 200 OK and subsequent GET returns 404 Not Found', async () => {
    const resDel = await requestJson(`/api/v1/alert-rules/${createdRuleId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${ownerAJwt}` },
    });

    assert.strictEqual(resDel.status, 200);
    assert.strictEqual(resDel.body.success, true);

    const resGet = await requestJson(`/api/v1/alert-rules/${createdRuleId}`, {
      headers: { Authorization: `Bearer ${ownerAJwt}` },
    });

    assert.strictEqual(resGet.status, 404);
  });
});
