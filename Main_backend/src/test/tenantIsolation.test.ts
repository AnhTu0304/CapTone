import test, { describe, before, after } from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import { AddressInfo } from 'node:net';
import jwt from 'jsonwebtoken';
import app from '../app';
import { config } from '../config/env';
import { pool } from '../config/database';
import { testRedisConnection, closeRedis } from '../config/redis';

describe('Tenant Data Isolation & Security Enforcement Suite (TC-01 to TC-10)', () => {
  let server: http.Server;
  let baseUrl: string;

  const superAdminId = 'c2000000-0000-0000-0000-000000000001';
  const ownerAId = 'c2000000-0000-0000-0000-000000000002';
  const devopsAId = 'c2000000-0000-0000-0000-000000000003';
  const ownerBId = 'c2000000-0000-0000-0000-000000000004';
  const multiOrgUserId = 'c2000000-0000-0000-0000-000000000005';
  const suspendedUserId = 'c2000000-0000-0000-0000-000000000006';

  const orgAId = 'd2000000-0000-0000-0000-000000000001';
  const orgBId = 'd2000000-0000-0000-0000-000000000002';
  const orgCId = 'd2000000-0000-0000-0000-000000000003';
  let createdOrgABySuperId: string = '';

  const envAId = 'e2000000-0000-0000-0000-000000000001';
  const envBId = 'e2000000-0000-0000-0000-000000000002';
  const envCId = 'e2000000-0000-0000-0000-000000000003';

  const clusterAId = 'f2000000-0000-0000-0000-000000000001';
  const clusterBId = 'f2000000-0000-0000-0000-000000000002';
  const agentBId = 'a2000000-0000-0000-0000-000000000002';
  const tokenBId = 'b2000000-0000-0000-0000-000000000002';

  let superAdminToken: string;
  let ownerAToken: string;
  let devopsAToken: string;
  let ownerBToken: string;
  let multiOrgUserToken: string;
  let suspendedUserToken: string;

  let smeOwnerRoleId: string;
  let devopsRoleId: string;

  before(async () => {
    await testRedisConnection();

    const rolesRes = await pool.query(`SELECT id, code FROM organization_roles WHERE scope = 'ORGANIZATION'`);
    smeOwnerRoleId = rolesRes.rows.find((r) => r.code === 'SME_OWNER')?.id;
    devopsRoleId = rolesRes.rows.find((r) => r.code === 'DEVOPS')?.id;

    await pool.query(
      `INSERT INTO users (id, email, password_hash, full_name, status, created_at, updated_at)
       VALUES 
         ($1, 'superadmin.tenant@test.com', 'hash', 'Super Admin Tenant', 'ACTIVE', NOW(), NOW()),
         ($2, 'owner.a.tenant@test.com', 'hash', 'Owner A Tenant', 'ACTIVE', NOW(), NOW()),
         ($3, 'devops.a.tenant@test.com', 'hash', 'DevOps A Tenant', 'ACTIVE', NOW(), NOW()),
         ($4, 'owner.b.tenant@test.com', 'hash', 'Owner B Tenant', 'ACTIVE', NOW(), NOW()),
         ($5, 'multiorg.tenant@test.com', 'hash', 'Multi Org User', 'ACTIVE', NOW(), NOW()),
         ($6, 'suspended.tenant@test.com', 'hash', 'Suspended User', 'ACTIVE', NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET status = 'ACTIVE', deleted_at = NULL;`,
      [superAdminId, ownerAId, devopsAId, ownerBId, multiOrgUserId, suspendedUserId]
    );

    const srRes = await pool.query(`SELECT id FROM system_roles WHERE name = 'SUPER_ADMIN'`);
    if (srRes.rows[0]) {
      await pool.query(
        `INSERT INTO user_system_roles (user_id, system_role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING;`,
        [superAdminId, srRes.rows[0].id]
      );
    }

    await pool.query(
      `INSERT INTO organizations (id, name, slug, status, created_by, created_at, updated_at)
       VALUES 
         ($1, 'Tenant Org Alpha', 'tenant-org-alpha', 'ACTIVE', $2, NOW(), NOW()),
         ($3, 'Tenant Org Beta', 'tenant-org-beta', 'ACTIVE', $4, NOW(), NOW()),
         ($5, 'Tenant Org Gamma', 'tenant-org-gamma', 'ACTIVE', $2, NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET status = 'ACTIVE', deleted_at = NULL;`,
      [orgAId, ownerAId, orgBId, ownerBId, orgCId]
    );

    await pool.query(
      `INSERT INTO organization_members (organization_id, user_id, role_id, status, joined_at)
       VALUES 
         ($1, $2, $3, 'ACTIVE', NOW()),
         ($1, $4, $5, 'ACTIVE', NOW()),
         ($6, $7, $3, 'ACTIVE', NOW()),
         ($1, $8, $5, 'ACTIVE', NOW()),
         ($9, $8, $5, 'ACTIVE', NOW()),
         ($1, $10, $5, 'INACTIVE', NOW())
       ON CONFLICT (organization_id, user_id) 
       DO UPDATE SET role_id = EXCLUDED.role_id, status = EXCLUDED.status;`,
      [
        orgAId,
        ownerAId,
        smeOwnerRoleId,
        devopsAId,
        devopsRoleId,
        orgBId,
        ownerBId,
        multiOrgUserId,
        orgCId,
        suspendedUserId,
      ]
    );

    await pool.query(
      `INSERT INTO environments (id, organization_id, name, code, environment_type, created_by, created_at, updated_at)
       VALUES 
         ($1, $2, 'Env Alpha Dev', 'alpha-dev', 'DEVELOPMENT', $3, NOW(), NOW()),
         ($4, $5, 'Env Beta Staging', 'beta-staging', 'STAGING', $6, NOW(), NOW()),
         ($7, $8, 'Env Gamma Dev', 'gamma-dev', 'DEVELOPMENT', $3, NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET organization_id = EXCLUDED.organization_id, deleted_at = NULL;`,
      [envAId, orgAId, ownerAId, envBId, orgBId, ownerBId, envCId, orgCId]
    );

    await pool.query(
      `INSERT INTO clusters (id, environment_id, name, provider, status, created_at, updated_at)
       VALUES 
         ($1, $2, 'cluster-alpha', 'MINIKUBE', 'CONNECTED', NOW(), NOW()),
         ($3, $4, 'cluster-beta', 'MINIKUBE', 'CONNECTED', NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET environment_id = EXCLUDED.environment_id, deleted_at = NULL;`,
      [clusterAId, envAId, clusterBId, envBId]
    );

    await pool.query(
      `INSERT INTO agents (id, agent_uid, cluster_id, environment_id, name, status, created_at, updated_at)
       VALUES ($1, 'uid-beta', $2, $3, 'agent-beta', 'ONLINE', NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET cluster_id = EXCLUDED.cluster_id;`,
      [agentBId, clusterBId, envBId]
    );

    await pool.query(
      `INSERT INTO agent_tokens (id, agent_id, token_hash, token_prefix, created_at)
       VALUES ($1, $2, 'hash_token_b', 'sh_live_sec_beta', NOW())
       ON CONFLICT (id) DO NOTHING;`,
      [tokenBId, agentBId]
    );

    superAdminToken = jwt.sign(
      { id: superAdminId, email: 'superadmin.tenant@test.com', status: 'ACTIVE', roles: ['SUPER_ADMIN'] },
      config.jwt.secret,
      { expiresIn: '1h', algorithm: 'HS256' }
    );

    ownerAToken = jwt.sign(
      { id: ownerAId, email: 'owner.a.tenant@test.com', status: 'ACTIVE', roles: ['USER'] },
      config.jwt.secret,
      { expiresIn: '1h', algorithm: 'HS256' }
    );

    devopsAToken = jwt.sign(
      { id: devopsAId, email: 'devops.a.tenant@test.com', status: 'ACTIVE', roles: ['USER'] },
      config.jwt.secret,
      { expiresIn: '1h', algorithm: 'HS256' }
    );

    ownerBToken = jwt.sign(
      { id: ownerBId, email: 'owner.b.tenant@test.com', status: 'ACTIVE', roles: ['USER'] },
      config.jwt.secret,
      { expiresIn: '1h', algorithm: 'HS256' }
    );

    multiOrgUserToken = jwt.sign(
      { id: multiOrgUserId, email: 'multiorg.tenant@test.com', status: 'ACTIVE', roles: ['USER'] },
      config.jwt.secret,
      { expiresIn: '1h', algorithm: 'HS256' }
    );

    suspendedUserToken = jwt.sign(
      { id: suspendedUserId, email: 'suspended.tenant@test.com', status: 'ACTIVE', roles: ['USER'] },
      config.jwt.secret,
      { expiresIn: '1h', algorithm: 'HS256' }
    );

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const port = (server.address() as AddressInfo).port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    if (createdOrgABySuperId) {
      await pool.query(`DELETE FROM organization_members WHERE organization_id = $1;`, [createdOrgABySuperId]);
      await pool.query(`DELETE FROM organization_profiles WHERE organization_id = $1;`, [createdOrgABySuperId]);
      await pool.query(`DELETE FROM organizations WHERE id = $1;`, [createdOrgABySuperId]);
    }
    await pool.query(`DELETE FROM agent_tokens WHERE id = $1;`, [tokenBId]);
    await pool.query(`DELETE FROM agents WHERE id = $1;`, [agentBId]);
    await pool.query(`DELETE FROM clusters WHERE id IN ($1, $2);`, [clusterAId, clusterBId]);
    await pool.query(`DELETE FROM environments WHERE id IN ($1, $2, $3);`, [envAId, envBId, envCId]);
    await pool.query(`DELETE FROM organization_members WHERE organization_id IN ($1, $2, $3);`, [orgAId, orgBId, orgCId]);
    await pool.query(`DELETE FROM organizations WHERE id IN ($1, $2, $3);`, [orgAId, orgBId, orgCId]);
    await pool.query(`DELETE FROM user_system_roles WHERE user_id = $1;`, [superAdminId]);
    await pool.query(`DELETE FROM users WHERE id IN ($1, $2, $3, $4, $5, $6);`, [
      superAdminId,
      ownerAId,
      devopsAId,
      ownerBId,
      multiOrgUserId,
      suspendedUserId,
    ]);
    await closeRedis();
  });

  // TC-01: SUPER_ADMIN tạo công ty A -> Gán SME_OWNER cho công ty A trong DB
  test('TC-01: SUPER_ADMIN tạo công ty A -> Gán vai trò SME_OWNER trong organization_members', async () => {
    const res = await fetch(`${baseUrl}/api/v1/organizations`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${superAdminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Super Admin Owned Org',
        slug: 'super-admin-owned-org',
        description: 'Organization created by Super Admin',
      }),
    });
    assert.strictEqual(res.status, 201);
    const body: any = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(body.data?.id);
    createdOrgABySuperId = body.data.id;
    assert.strictEqual(body.data.role_in_org, 'SME_OWNER');

    // Kiểm tra trực tiếp bảng organization_members trong PostgreSQL
    const memberCheck = await pool.query(
      `SELECT om.status, r.code AS role_code
       FROM organization_members om
       JOIN organization_roles r ON om.role_id = r.id
       WHERE om.organization_id = $1 AND om.user_id = $2`,
      [createdOrgABySuperId, superAdminId]
    );
    assert.strictEqual(memberCheck.rowCount, 1);
    assert.strictEqual(memberCheck.rows[0].status, 'ACTIVE');
    assert.strictEqual(memberCheck.rows[0].role_code, 'SME_OWNER');
  });

  // TC-02: SUPER_ADMIN vào công ty A do mình tạo -> Quyền SME_OWNER
  test('TC-02: SUPER_ADMIN truy cập công ty A do chính mình tạo -> Nhận quyền SME_OWNER', async () => {
    assert.ok(createdOrgABySuperId, 'createdOrgABySuperId must exist');
    const res = await fetch(`${baseUrl}/api/v1/organizations/${createdOrgABySuperId}`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    assert.strictEqual(res.status, 200);
    const body: any = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.role_in_org, 'SME_OWNER');
  });

  // TC-03: SUPER_ADMIN vào công ty B do khách hàng tạo -> Không có quyền SME_OWNER (role_in_org: null)
  test('TC-03: SUPER_ADMIN xem thông tin công ty B của khách hàng -> role_in_org là null', async () => {
    const res = await fetch(`${baseUrl}/api/v1/organizations/${orgBId}`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    assert.strictEqual(res.status, 200);
    const body: any = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.role_in_org, null, 'SUPER_ADMIN must NOT have SME_OWNER in customer org');
  });

  // TC-04: SME_OWNER công ty A truy cập công ty B -> Bị từ chối (403 Forbidden)
  test('TC-04: SME_OWNER của công ty A truy cập công ty B -> 403 Forbidden', async () => {
    const res = await fetch(`${baseUrl}/api/v1/organizations/${orgBId}`, {
      headers: { Authorization: `Bearer ${ownerAToken}` },
    });
    assert.strictEqual(res.status, 403);
    const body: any = await res.json();
    assert.strictEqual(body.success, false);
  });

  // TC-05: SME_OWNER công ty A xem cluster của công ty B -> Bị từ chối
  test('TC-05: SME_OWNER của công ty A xem cluster của công ty B -> Bị từ chối (403/404)', async () => {
    // Truy cập trực tiếp qua orgB route -> 403 Forbidden
    const resDirect = await fetch(`${baseUrl}/api/v1/organizations/${orgBId}/clusters/${clusterBId}`, {
      headers: { Authorization: `Bearer ${ownerAToken}` },
    });
    assert.strictEqual(resDirect.status, 403);

    // IDOR spoofing: Truy cập clusterB thông qua orgA route -> Bị từ chối (403/404)
    const resIdor = await fetch(`${baseUrl}/api/v1/organizations/${orgAId}/clusters/${clusterBId}`, {
      headers: { Authorization: `Bearer ${ownerAToken}` },
    });
    assert.ok(resIdor.status === 403 || resIdor.status === 404, `Expected 403 or 404, got ${resIdor.status}`);
  });

  // TC-06: SME_OWNER công ty A gọi API metrics/telemetry của công ty B -> Bị từ chối (403 Forbidden)
  test('TC-06: SME_OWNER công ty A gọi API telemetry/metrics của công ty B -> 403 Forbidden', async () => {
    const res = await fetch(`${baseUrl}/api/v1/telemetry/live-summary?organization_id=${orgBId}`, {
      headers: { Authorization: `Bearer ${ownerAToken}` },
    });
    assert.strictEqual(res.status, 403);
    const body: any = await res.json();
    assert.strictEqual(body.success, false);
  });

  // TC-07: Người dùng sửa organization_id trên request -> Bị từ chối (403 Forbidden)
  test('TC-07: Người dùng sửa header x-organization-id sang công ty khác -> 403 Forbidden (IDOR Prevention)', async () => {
    const res = await fetch(`${baseUrl}/api/v1/telemetry/live-summary`, {
      headers: {
        Authorization: `Bearer ${ownerAToken}`,
        'x-organization-id': orgBId,
      },
    });
    assert.strictEqual(res.status, 403);
    const body: any = await res.json();
    assert.strictEqual(body.success, false);
  });

  // TC-08: SUPER_ADMIN xem danh sách tổng quan các công ty -> Hoạt động bình thường
  test('TC-08: SUPER_ADMIN xem danh sách tổng quan các công ty -> Hoạt động bình thường (200 OK)', async () => {
    const res = await fetch(`${baseUrl}/api/v1/organizations`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    assert.strictEqual(res.status, 200);
    const body: any = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(Array.isArray(body.data?.items));
    assert.ok(body.data.items.length >= 2);

    // Kiểm tra Org B trong danh sách: role_in_org phải là null đối với SUPER_ADMIN
    const orgBItem = body.data.items.find((i: any) => i.id === orgBId);
    assert.ok(orgBItem);
    assert.strictEqual(orgBItem.role_in_org, null);
  });

  // TC-09: SUPER_ADMIN truy cập dữ liệu nội bộ của công ty B (môi trường, cluster, metrics) -> Bị từ chối (403)
  test('TC-09: SUPER_ADMIN truy cập dữ liệu nội bộ của công ty B (environments, clusters, metrics) -> 403 Forbidden', async () => {
    // 1. Dữ liệu Môi trường (Environments)
    const resEnv = await fetch(`${baseUrl}/api/v1/organizations/${orgBId}/environments`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    assert.strictEqual(resEnv.status, 403, 'SUPER_ADMIN must not access customer environments without membership');

    // 2. Dữ liệu Cụm K8s (Clusters)
    const resCluster = await fetch(`${baseUrl}/api/v1/organizations/${orgBId}/clusters`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    assert.strictEqual(resCluster.status, 403, 'SUPER_ADMIN must not access customer clusters without membership');

    // 3. Dữ liệu Viễn trắc (Telemetry Metrics)
    const resTelemetry = await fetch(`${baseUrl}/api/v1/telemetry/live-summary?organization_id=${orgBId}`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    assert.strictEqual(resTelemetry.status, 403, 'SUPER_ADMIN must not query customer telemetry without membership');
  });

  // TC-10: Người dùng thuộc nhiều công ty -> Chỉ truy cập được các công ty có quyền
  test('TC-10: Người dùng thuộc nhiều công ty -> Truy cập được Org A & C, bị từ chối ở Org B', async () => {
    // Truy cập Org A -> Thành công (200)
    const resA = await fetch(`${baseUrl}/api/v1/organizations/${orgAId}/environments`, {
      headers: { Authorization: `Bearer ${multiOrgUserToken}` },
    });
    assert.strictEqual(resA.status, 200);

    // Truy cập Org C -> Thành công (200)
    const resC = await fetch(`${baseUrl}/api/v1/organizations/${orgCId}/environments`, {
      headers: { Authorization: `Bearer ${multiOrgUserToken}` },
    });
    assert.strictEqual(resC.status, 200);

    // Truy cập Org B (không có quyền) -> Bị từ chối (403)
    const resB = await fetch(`${baseUrl}/api/v1/organizations/${orgBId}/environments`, {
      headers: { Authorization: `Bearer ${multiOrgUserToken}` },
    });
    assert.strictEqual(resB.status, 403);
  });
});
