import test, { describe, before, after } from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import { AddressInfo } from 'node:net';
import jwt from 'jsonwebtoken';
import app from '../app';
import { config } from '../config/env';
import { pool } from '../config/database';
import { testRedisConnection, closeRedis } from '../config/redis';

describe('Tenant Data Isolation & Security Enforcement Suite [PB08 4.1]', () => {
  let server: http.Server;
  let baseUrl: string;

  const superAdminId = 'c2000000-0000-0000-0000-000000000001';
  const ownerAId = 'c2000000-0000-0000-0000-000000000002';
  const devopsAId = 'c2000000-0000-0000-0000-000000000003';
  const ownerBId = 'c2000000-0000-0000-0000-000000000004';
  const suspendedUserId = 'c2000000-0000-0000-0000-000000000005';

  const orgAId = 'd2000000-0000-0000-0000-000000000001';
  const orgBId = 'd2000000-0000-0000-0000-000000000002';

  const envAId = 'e2000000-0000-0000-0000-000000000001';
  const envBId = 'e2000000-0000-0000-0000-000000000002';

  const clusterAId = 'f2000000-0000-0000-0000-000000000001';
  const clusterBId = 'f2000000-0000-0000-0000-000000000002';

  let superAdminToken: string;
  let ownerAToken: string;
  let devopsAToken: string;
  let ownerBToken: string;
  let suspendedUserToken: string;

  let smeOwnerRoleId: string;
  let devopsRoleId: string;

  before(async () => {
    await testRedisConnection();

    const rolesRes = await pool.query(`SELECT id, code FROM roles WHERE scope = 'ORGANIZATION'`);
    smeOwnerRoleId = rolesRes.rows.find((r) => r.code === 'SME_OWNER')?.id;
    devopsRoleId = rolesRes.rows.find((r) => r.code === 'DEVOPS')?.id;

    await pool.query(
      `INSERT INTO users (id, email, password_hash, full_name, status, created_at, updated_at)
       VALUES 
         ($1, 'superadmin.tenant@test.com', 'hash', 'Super Admin Tenant', 'ACTIVE', NOW(), NOW()),
         ($2, 'owner.a.tenant@test.com', 'hash', 'Owner A Tenant', 'ACTIVE', NOW(), NOW()),
         ($3, 'devops.a.tenant@test.com', 'hash', 'DevOps A Tenant', 'ACTIVE', NOW(), NOW()),
         ($4, 'owner.b.tenant@test.com', 'hash', 'Owner B Tenant', 'ACTIVE', NOW(), NOW()),
         ($5, 'suspended.tenant@test.com', 'hash', 'Suspended User', 'ACTIVE', NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET status = 'ACTIVE', deleted_at = NULL;`,
      [superAdminId, ownerAId, devopsAId, ownerBId, suspendedUserId]
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
         ($3, 'Tenant Org Beta', 'tenant-org-beta', 'ACTIVE', $4, NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET status = 'ACTIVE', deleted_at = NULL;`,
      [orgAId, ownerAId, orgBId, ownerBId]
    );

    await pool.query(
      `INSERT INTO organization_members (organization_id, user_id, role_id, status, joined_at)
       VALUES 
         ($1, $2, $3, 'ACTIVE', NOW()),
         ($1, $4, $5, 'ACTIVE', NOW()),
         ($6, $7, $3, 'ACTIVE', NOW()),
         ($1, $8, $5, 'INACTIVE', NOW())
       ON CONFLICT (organization_id, user_id) 
       DO UPDATE SET role_id = EXCLUDED.role_id, status = EXCLUDED.status;`,
      [orgAId, ownerAId, smeOwnerRoleId, devopsAId, devopsRoleId, orgBId, ownerBId, suspendedUserId]
    );

    await pool.query(
      `INSERT INTO environments (id, organization_id, name, code, environment_type, created_by, created_at, updated_at)
       VALUES 
         ($1, $2, 'Env Alpha Dev', 'alpha-dev', 'DEVELOPMENT', $3, NOW(), NOW()),
         ($4, $5, 'Env Beta Staging', 'beta-staging', 'STAGING', $6, NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET organization_id = EXCLUDED.organization_id, deleted_at = NULL;`,
      [envAId, orgAId, ownerAId, envBId, orgBId, ownerBId]
    );

    await pool.query(
      `INSERT INTO clusters (id, environment_id, name, provider, status, created_at, updated_at)
       VALUES 
         ($1, $2, 'cluster-alpha', 'MINIKUBE', 'CONNECTED', NOW(), NOW()),
         ($3, $4, 'cluster-beta', 'MINIKUBE', 'CONNECTED', NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET environment_id = EXCLUDED.environment_id, deleted_at = NULL;`,
      [clusterAId, envAId, clusterBId, envBId]
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
    await pool.query(`DELETE FROM clusters WHERE id IN ($1, $2);`, [clusterAId, clusterBId]);
    await pool.query(`DELETE FROM environments WHERE id IN ($1, $2);`, [envAId, envBId]);
    await pool.query(`DELETE FROM organization_members WHERE organization_id IN ($1, $2);`, [orgAId, orgBId]);
    await pool.query(`DELETE FROM organizations WHERE id IN ($1, $2);`, [orgAId, orgBId]);
    await pool.query(`DELETE FROM user_system_roles WHERE user_id = $1;`, [superAdminId]);
    await pool.query(`DELETE FROM users WHERE id IN ($1, $2, $3, $4, $5);`, [
      superAdminId,
      ownerAId,
      devopsAId,
      ownerBId,
      suspendedUserId,
    ]);
    await closeRedis();
  });

  test('1. Unauthenticated request without JWT token returns 401', async () => {
    const res = await fetch(`${baseUrl}/api/v1/organizations/${orgAId}/environments`);
    assert.strictEqual(res.status, 401);
  });

  test('2. User A can successfully read Org A environments', async () => {
    const res = await fetch(`${baseUrl}/api/v1/organizations/${orgAId}/environments`, {
      headers: { Authorization: `Bearer ${ownerAToken}` },
    });
    assert.strictEqual(res.status, 200);
    const body: any = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(Array.isArray(body.data.environments));
    assert.strictEqual(body.data.environments.some((e: any) => e.id === envAId), true);
  });

  test('3. User A cannot read Org B environments directly (Returns 403 Forbidden)', async () => {
    const res = await fetch(`${baseUrl}/api/v1/organizations/${orgBId}/environments`, {
      headers: { Authorization: `Bearer ${ownerAToken}` },
    });
    assert.strictEqual(res.status, 403);
  });

  test('4. User A swapping env ID to access Org B environment via Org A path returns 404 (IDOR Prevention)', async () => {
    const res = await fetch(`${baseUrl}/api/v1/organizations/${orgAId}/environments/${envBId}`, {
      headers: { Authorization: `Bearer ${ownerAToken}` },
    });
    assert.strictEqual(res.status, 404);
  });

  test('5. User A cannot update Org B environment (Returns 404/403 and data remains unchanged)', async () => {
    const res = await fetch(`${baseUrl}/api/v1/organizations/${orgAId}/environments/${envBId}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${ownerAToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: 'Tampered Name by User A' }),
    });
    assert.strictEqual(res.status, 404);

    const checkRes = await pool.query(`SELECT name FROM environments WHERE id = $1`, [envBId]);
    assert.strictEqual(checkRes.rows[0].name, 'Env Beta Staging');
  });

  test('6. User A cannot delete Org B environment (Returns 404/403)', async () => {
    const res = await fetch(`${baseUrl}/api/v1/organizations/${orgAId}/environments/${envBId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${ownerAToken}` },
    });
    assert.strictEqual(res.status, 404);

    const checkRes = await pool.query(`SELECT deleted_at FROM environments WHERE id = $1`, [envBId]);
    assert.strictEqual(checkRes.rows[0].deleted_at, null);
  });

  test('7. User A cannot create environment under Org B (Returns 403)', async () => {
    const res = await fetch(`${baseUrl}/api/v1/organizations/${orgBId}/environments`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ownerAToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Malicious Env',
        code: 'mal-env',
        environment_type: 'DEVELOPMENT',
      }),
    });
    assert.strictEqual(res.status, 403);
  });

  test('8. Inactive or Suspended member in Org A is rejected with 403', async () => {
    const res = await fetch(`${baseUrl}/api/v1/organizations/${orgAId}/environments`, {
      headers: { Authorization: `Bearer ${suspendedUserToken}` },
    });
    assert.strictEqual(res.status, 403);
  });

  test('9. User A can read Org A cluster details', async () => {
    const res = await fetch(`${baseUrl}/api/v1/organizations/${orgAId}/clusters/${clusterAId}`, {
      headers: { Authorization: `Bearer ${ownerAToken}` },
    });
    assert.strictEqual(res.status, 200);
    const body: any = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.id, clusterAId);
  });

  test('10. User A swapping cluster ID to read Org B cluster returns 404 (IDOR Prevention)', async () => {
    const res = await fetch(`${baseUrl}/api/v1/organizations/${orgAId}/clusters/${clusterBId}`, {
      headers: { Authorization: `Bearer ${ownerAToken}` },
    });
    assert.strictEqual(res.status, 404);
  });

  test('11. User A calling Org B cluster route directly returns 403', async () => {
    const res = await fetch(`${baseUrl}/api/v1/organizations/${orgBId}/clusters/${clusterBId}`, {
      headers: { Authorization: `Bearer ${ownerAToken}` },
    });
    assert.strictEqual(res.status, 403);
  });

  test('12. User A cannot mutate Org B cluster (rotate-token returns 404)', async () => {
    const res = await fetch(`${baseUrl}/api/v1/organizations/${orgAId}/clusters/${clusterBId}/rotate-token`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ownerAToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });
    assert.strictEqual(res.status, 404);
  });

  test('13. User A cannot delete Org B cluster (Returns 404 and cluster remains active)', async () => {
    const res = await fetch(`${baseUrl}/api/v1/organizations/${orgAId}/clusters/${clusterBId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${ownerAToken}` },
    });
    assert.strictEqual(res.status, 404);

    const checkRes = await pool.query(`SELECT deleted_at FROM clusters WHERE id = $1`, [clusterBId]);
    assert.strictEqual(checkRes.rows[0].deleted_at, null);
  });

  test('14. Regular tenant user calling Global Clusters endpoint /api/v1/clusters returns 403 Forbidden', async () => {
    const res = await fetch(`${baseUrl}/api/v1/clusters`, {
      headers: { Authorization: `Bearer ${ownerAToken}` },
    });
    assert.strictEqual(res.status, 403);
  });

  test('15. SuperAdmin can access Global Clusters endpoint /api/v1/clusters successfully', async () => {
    const res = await fetch(`${baseUrl}/api/v1/clusters`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    assert.strictEqual(res.status, 200);
    const body: any = await res.json();
    assert.strictEqual(body.success, true);
  });

  test('16. SuperAdmin can read any organization environment across tenants', async () => {
    const resA = await fetch(`${baseUrl}/api/v1/organizations/${orgAId}/environments/${envAId}`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    assert.strictEqual(resA.status, 200);

    const resB = await fetch(`${baseUrl}/api/v1/organizations/${orgBId}/environments/${envBId}`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    assert.strictEqual(resB.status, 200);
  });
});
