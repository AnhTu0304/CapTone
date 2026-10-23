import test, { describe, before, after } from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import { AddressInfo } from 'node:net';
import jwt from 'jsonwebtoken';
import app from '../app';
import { config } from '../config/env';
import { pool } from '../config/database';
import { testRedisConnection, closeRedis } from '../config/redis';

describe('Comprehensive RBAC Matrix & Tenant Guard Suite [PB08 4.2]', () => {
  let server: http.Server;
  let baseUrl: string;

  const superAdminId = 'a1000000-0000-0000-0000-000000000001';
  const adminId = 'a1000000-0000-0000-0000-000000000002';
  const ownerAId = 'a1000000-0000-0000-0000-000000000003';
  const devopsAId = 'a1000000-0000-0000-0000-000000000004';
  const viewerAId = 'a1000000-0000-0000-0000-000000000005';
  const ownerBId = 'a1000000-0000-0000-0000-000000000006';
  const devopsBId = 'a1000000-0000-0000-0000-000000000007';

  const orgAId = 'b1000000-0000-0000-0000-000000000001';
  const envAId = 'c1000000-0000-0000-0000-000000000001';
  const clusterAId = 'd1000000-0000-0000-0000-000000000001';
  const nsAId = 'e1000000-0000-0000-0000-000000000001';
  const nodeAId = 'f1000000-0000-0000-0000-000000000001';
  const podAId = '01000000-0000-0000-0000-000000000001';

  const orgBId = 'b2000000-0000-0000-0000-000000000002';
  const envBId = 'c2000000-0000-0000-0000-000000000002';
  const clusterBId = 'd2000000-0000-0000-0000-000000000002';
  const nsBId = 'e2000000-0000-0000-0000-000000000002';
  const nodeBId = 'f2000000-0000-0000-0000-000000000002';
  const podBId = '02000000-0000-0000-0000-000000000002';

  let superAdminToken: string;
  let adminToken: string;
  let ownerAToken: string;
  let devopsAToken: string;
  let viewerAToken: string;
  let ownerBToken: string;
  let devopsBToken: string;

  before(async () => {
    await testRedisConnection();

    await pool.query(
      `INSERT INTO users (id, email, password_hash, full_name, status, created_at, updated_at)
       VALUES 
         ($1, 'matrix.super@test.com', 'dummy_hash', 'Matrix Super', 'ACTIVE', NOW(), NOW()),
         ($2, 'matrix.admin@test.com', 'dummy_hash', 'Matrix Admin', 'ACTIVE', NOW(), NOW()),
         ($3, 'matrix.ownera@test.com', 'dummy_hash', 'Matrix Owner A', 'ACTIVE', NOW(), NOW()),
         ($4, 'matrix.devopsa@test.com', 'dummy_hash', 'Matrix DevOps A', 'ACTIVE', NOW(), NOW()),
         ($5, 'matrix.viewera@test.com', 'dummy_hash', 'Matrix Viewer A', 'ACTIVE', NOW(), NOW()),
         ($6, 'matrix.ownerb@test.com', 'dummy_hash', 'Matrix Owner B', 'ACTIVE', NOW(), NOW()),
         ($7, 'matrix.devopsb@test.com', 'dummy_hash', 'Matrix DevOps B', 'ACTIVE', NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET status = 'ACTIVE', deleted_at = NULL;`,
      [superAdminId, adminId, ownerAId, devopsAId, viewerAId, ownerBId, devopsBId]
    );

    const srRes = await pool.query(`SELECT id, name FROM system_roles WHERE name IN ('SUPER_ADMIN', 'ADMIN')`);
    const superRoleId = srRes.rows.find((r) => r.name === 'SUPER_ADMIN')?.id;
    const adminRoleId = srRes.rows.find((r) => r.name === 'ADMIN')?.id;

    if (superRoleId) {
      await pool.query(`INSERT INTO user_system_roles (user_id, system_role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING;`, [superAdminId, superRoleId]);
    }
    if (adminRoleId) {
      await pool.query(`INSERT INTO user_system_roles (user_id, system_role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING;`, [adminId, adminRoleId]);
    }

    const orgRolesRes = await pool.query(`SELECT id, code FROM roles WHERE scope = 'ORGANIZATION'`);
    const smeOwnerRoleId = orgRolesRes.rows.find((r) => r.code === 'SME_OWNER')?.id;
    const devopsRoleId = orgRolesRes.rows.find((r) => r.code === 'DEVOPS')?.id;
    const viewerRoleId = orgRolesRes.rows.find((r) => r.code === 'VIEWER')?.id;

    await pool.query(
      `INSERT INTO organizations (id, name, slug, status, created_at, updated_at)
       VALUES 
         ($1, 'Matrix Org A', 'matrix-org-a', 'ACTIVE', NOW(), NOW()),
         ($2, 'Matrix Org B', 'matrix-org-b', 'ACTIVE', NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET status = 'ACTIVE', deleted_at = NULL;`,
      [orgAId, orgBId]
    );

    await pool.query(
      `INSERT INTO organization_members (organization_id, user_id, role_id, status)
       VALUES 
         ($1, $2, $3, 'ACTIVE'),
         ($1, $4, $5, 'ACTIVE'),
         ($1, $6, $7, 'ACTIVE'),
         ($8, $9, $3, 'ACTIVE'),
         ($8, $10, $5, 'ACTIVE')
       ON CONFLICT (organization_id, user_id) DO UPDATE SET role_id = EXCLUDED.role_id, status = 'ACTIVE';`,
      [orgAId, ownerAId, smeOwnerRoleId, devopsAId, devopsRoleId, viewerAId, viewerRoleId, orgBId, ownerBId, devopsBId]
    );

    await pool.query(
      `INSERT INTO environments (id, organization_id, name, code, environment_type, status, created_at, updated_at)
       VALUES 
         ($1, $2, 'matrix-env-a', 'ENV_A', 'DEVELOPMENT', 'ACTIVE', NOW(), NOW()),
         ($3, $4, 'matrix-env-b', 'ENV_B', 'DEVELOPMENT', 'ACTIVE', NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET organization_id = EXCLUDED.organization_id, deleted_at = NULL;`,
      [envAId, orgAId, envBId, orgBId]
    );

    await pool.query(
      `INSERT INTO clusters (id, environment_id, name, provider, status, created_at, updated_at)
       VALUES 
         ($1, $2, 'matrix-cluster-a', 'MINIKUBE', 'CONNECTED', NOW(), NOW()),
         ($3, $4, 'matrix-cluster-b', 'MINIKUBE', 'CONNECTED', NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET environment_id = EXCLUDED.environment_id, deleted_at = NULL;`,
      [clusterAId, envAId, clusterBId, envBId]
    );

    await pool.query(
      `INSERT INTO namespaces (id, cluster_id, name, status, created_at, updated_at)
       VALUES 
         ($1, $2, 'default', 'ACTIVE', NOW(), NOW()),
         ($3, $4, 'default', 'ACTIVE', NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET cluster_id = EXCLUDED.cluster_id;`,
      [nsAId, clusterAId, nsBId, clusterBId]
    );

    await pool.query(
      `INSERT INTO nodes (id, cluster_id, name, status, created_at, updated_at)
       VALUES 
         ($1, $2, 'matrix-node-a', 'READY', NOW(), NOW()),
         ($3, $4, 'matrix-node-b', 'READY', NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET cluster_id = EXCLUDED.cluster_id;`,
      [nodeAId, clusterAId, nodeBId, clusterBId]
    );

    await pool.query(
      `INSERT INTO pods (id, cluster_id, namespace_id, node_id, name, status, created_at, updated_at)
       VALUES 
         ($1, $2, $3, $4, 'matrix-pod-a', 'RUNNING', NOW(), NOW()),
         ($5, $6, $7, $8, 'matrix-pod-b', 'RUNNING', NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET cluster_id = EXCLUDED.cluster_id, deleted_at = NULL;`,
      [podAId, clusterAId, nsAId, nodeAId, podBId, clusterBId, nsBId, nodeBId]
    );

    superAdminToken = jwt.sign(
      { id: superAdminId, email: 'matrix.super@test.com', status: 'ACTIVE', roles: ['SUPER_ADMIN'] },
      config.jwt.secret,
      { expiresIn: '1h', algorithm: 'HS256' }
    );

    adminToken = jwt.sign(
      { id: adminId, email: 'matrix.admin@test.com', status: 'ACTIVE', roles: ['ADMIN'] },
      config.jwt.secret,
      { expiresIn: '1h', algorithm: 'HS256' }
    );

    ownerAToken = jwt.sign(
      { id: ownerAId, email: 'matrix.ownera@test.com', status: 'ACTIVE', roles: ['USER'] },
      config.jwt.secret,
      { expiresIn: '1h', algorithm: 'HS256' }
    );

    devopsAToken = jwt.sign(
      { id: devopsAId, email: 'matrix.devopsa@test.com', status: 'ACTIVE', roles: ['USER'] },
      config.jwt.secret,
      { expiresIn: '1h', algorithm: 'HS256' }
    );

    viewerAToken = jwt.sign(
      { id: viewerAId, email: 'matrix.viewera@test.com', status: 'ACTIVE', roles: ['USER'] },
      config.jwt.secret,
      { expiresIn: '1h', algorithm: 'HS256' }
    );

    ownerBToken = jwt.sign(
      { id: ownerBId, email: 'matrix.ownerb@test.com', status: 'ACTIVE', roles: ['USER'] },
      config.jwt.secret,
      { expiresIn: '1h', algorithm: 'HS256' }
    );

    devopsBToken = jwt.sign(
      { id: devopsBId, email: 'matrix.devopsb@test.com', status: 'ACTIVE', roles: ['USER'] },
      config.jwt.secret,
      { expiresIn: '1h', algorithm: 'HS256' }
    );

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
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    await closeRedis();
    await pool.end();
  });

  const requestApi = async (path: string, options: { method?: string; token?: string; body?: any; headers?: Record<string, string> } = {}) => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
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

  describe('1. Global Nodes & Pods Endpoint Protection', () => {
    test('1.1. Unauthenticated request to /api/v1/nodes returns 401', async () => {
      const res = await requestApi('/api/v1/nodes');
      assert.strictEqual(res.status, 401);
    });

    test('1.2. Regular tenant user (Owner A) is FORBIDDEN (403) from global /api/v1/nodes', async () => {
      const res = await requestApi('/api/v1/nodes', { token: ownerAToken });
      assert.strictEqual(res.status, 403);
    });

    test('1.3. Regular tenant user (DevOps A) is FORBIDDEN (403) from global /api/v1/nodes', async () => {
      const res = await requestApi('/api/v1/nodes', { token: devopsAToken });
      assert.strictEqual(res.status, 403);
    });

    test('1.4. Platform Admin CAN access global /api/v1/nodes (200 OK)', async () => {
      const res = await requestApi('/api/v1/nodes', { token: adminToken });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data?.success, true);
    });

    test('1.5. SuperAdmin CAN access global /api/v1/nodes (200 OK)', async () => {
      const res = await requestApi('/api/v1/nodes', { token: superAdminToken });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data?.success, true);
    });

    test('1.6. Regular tenant user (Viewer A) is FORBIDDEN (403) from global /api/v1/pods', async () => {
      const res = await requestApi('/api/v1/pods', { token: viewerAToken });
      assert.strictEqual(res.status, 403);
    });

    test('1.7. Platform Admin CAN access global /api/v1/pods (200 OK)', async () => {
      const res = await requestApi('/api/v1/pods', { token: adminToken });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data?.success, true);
    });
  });

  describe('2. Tenant Cluster Scoped Nodes & Pods Access', () => {
    test('2.1. Owner A can view cluster nodes within Org A (200 OK)', async () => {
      const res = await requestApi(`/api/v1/organizations/${orgAId}/clusters/${clusterAId}/nodes`, { token: ownerAToken });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data?.success, true);
      assert.ok(Array.isArray(res.data?.data));
    });

    test('2.2. DevOps A can view cluster nodes within Org A (200 OK)', async () => {
      const res = await requestApi(`/api/v1/organizations/${orgAId}/clusters/${clusterAId}/nodes`, { token: devopsAToken });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data?.success, true);
    });

    test('2.3. Viewer A can view cluster nodes within Org A (200 OK)', async () => {
      const res = await requestApi(`/api/v1/organizations/${orgAId}/clusters/${clusterAId}/nodes`, { token: viewerAToken });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data?.success, true);
    });

    test('2.4. Owner B cannot view cluster nodes of Org A (Returns 403 Forbidden)', async () => {
      const res = await requestApi(`/api/v1/organizations/${orgAId}/clusters/${clusterAId}/nodes`, { token: ownerBToken });
      assert.strictEqual(res.status, 403);
    });

    test('2.5. DevOps A can view cluster pods within Org A (200 OK)', async () => {
      const res = await requestApi(`/api/v1/organizations/${orgAId}/clusters/${clusterAId}/pods`, { token: devopsAToken });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data?.success, true);
    });

    test('2.6. DevOps B cannot view cluster pods of Org A (Returns 403 Forbidden)', async () => {
      const res = await requestApi(`/api/v1/organizations/${orgAId}/clusters/${clusterAId}/pods`, { token: devopsBToken });
      assert.strictEqual(res.status, 403);
    });
  });

  describe('3. Destructive Remediation Operations (Node Drain & Pod Restart)', () => {
    test('3.1. Viewer A is FORBIDDEN (403) from draining Node A', async () => {
      const res = await requestApi(`/api/v1/organizations/${orgAId}/clusters/${clusterAId}/nodes/${nodeAId}/drain`, {
        method: 'POST',
        token: viewerAToken,
      });
      assert.strictEqual(res.status, 403);
    });

    test('3.2. DevOps A CAN drain Node A in Org A (200 OK)', async () => {
      const res = await requestApi(`/api/v1/organizations/${orgAId}/clusters/${clusterAId}/nodes/${nodeAId}/drain`, {
        method: 'POST',
        token: devopsAToken,
      });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data?.success, true);
    });

    test('3.3. Owner A CAN drain Node A in Org A (200 OK)', async () => {
      const res = await requestApi(`/api/v1/organizations/${orgAId}/clusters/${clusterAId}/nodes/${nodeAId}/drain`, {
        method: 'POST',
        token: ownerAToken,
      });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data?.success, true);
    });

    test('3.4. User from Org B is FORBIDDEN (403) from draining Node A', async () => {
      const res = await requestApi(`/api/v1/nodes/${nodeAId}/drain`, {
        method: 'POST',
        token: devopsBToken,
      });
      assert.strictEqual(res.status, 403);
    });

    test('3.5. Viewer A is FORBIDDEN (403) from restarting Pod A', async () => {
      const res = await requestApi(`/api/v1/organizations/${orgAId}/clusters/${clusterAId}/pods/${podAId}/restart`, {
        method: 'POST',
        token: viewerAToken,
      });
      assert.strictEqual(res.status, 403);
    });

    test('3.6. DevOps A CAN restart Pod A in Org A (200 OK)', async () => {
      const res = await requestApi(`/api/v1/organizations/${orgAId}/clusters/${clusterAId}/pods/${podAId}/restart`, {
        method: 'POST',
        token: devopsAToken,
      });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data?.success, true);
    });

    test('3.7. User from Org B is FORBIDDEN (403) from restarting Pod A', async () => {
      const res = await requestApi(`/api/v1/pods/${podAId}/restart`, {
        method: 'POST',
        token: devopsBToken,
      });
      assert.strictEqual(res.status, 403);
    });

    test('3.8. SuperAdmin CAN restart any pod (200 OK)', async () => {
      const res = await requestApi(`/api/v1/pods/${podAId}/restart`, {
        method: 'POST',
        token: superAdminToken,
      });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data?.success, true);
    });
  });

  describe('4. Platform Scope vs Tenant Scope Hard Boundaries', () => {
    test('4.1. Owner A cannot access platform user management /api/v1/users (403)', async () => {
      const res = await requestApi('/api/v1/users', { token: ownerAToken });
      assert.strictEqual(res.status, 403);
    });

    test('4.2. Owner A cannot assign system roles via /api/v1/roles/assign (403)', async () => {
      const res = await requestApi('/api/v1/roles/assign', {
        method: 'POST',
        token: ownerAToken,
        body: { user_id: devopsAId, role_name_or_id: 'ADMIN' },
      });
      assert.strictEqual(res.status, 403);
    });

    test('4.3. Platform Admin cannot assign system roles (SuperAdmin only) (403)', async () => {
      const res = await requestApi('/api/v1/roles/assign', {
        method: 'POST',
        token: adminToken,
        body: { user_id: devopsAId, role_name_or_id: 'ADMIN' },
      });
      assert.strictEqual(res.status, 403);
    });

    test('4.4. SuperAdmin can assign system roles (201 Created)', async () => {
      const res = await requestApi('/api/v1/roles/assign', {
        method: 'POST',
        token: superAdminToken,
        body: { userId: viewerAId, role: 'USER' },
      });
      assert.strictEqual(res.status, 201);
    });

    test('4.5. DevOps A is FORBIDDEN (403) from inviting members to Org A', async () => {
      const res = await requestApi(`/api/v1/organizations/${orgAId}/invitations`, {
        method: 'POST',
        token: devopsAToken,
        body: { email: 'new.member@test.com', role_code: 'VIEWER' },
      });
      assert.strictEqual(res.status, 403);
    });

    test('4.6. DevOps A is FORBIDDEN (403) from deleting environment in Org A', async () => {
      const res = await requestApi(`/api/v1/organizations/${orgAId}/environments/${envAId}`, {
        method: 'DELETE',
        token: devopsAToken,
      });
      assert.strictEqual(res.status, 403);
    });

    test('4.7. DevOps A is FORBIDDEN (403) from soft-deleting Org A', async () => {
      const res = await requestApi(`/api/v1/organizations/${orgAId}`, {
        method: 'DELETE',
        token: devopsAToken,
      });
      assert.strictEqual(res.status, 403);
    });

    test('4.8. Owner A CAN soft-delete Org A (200 OK)', async () => {
      const res = await requestApi(`/api/v1/organizations/${orgAId}`, {
        method: 'DELETE',
        token: ownerAToken,
      });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data?.success, true);
    });
  });
});
