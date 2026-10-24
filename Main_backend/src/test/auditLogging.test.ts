import test, { describe, before, after } from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import { AddressInfo } from 'node:net';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import app from '../app';
import { config } from '../config/env';
import { pool } from '../config/database';
import { testRedisConnection, closeRedis } from '../config/redis';
import { AuditService } from '../services/audit.service';

describe('Security Audit Logging & Tenant Governance Suite [PB08 4.3]', () => {
  let server: http.Server;
  let baseUrl: string;

  const superAdminId = '7a000000-0000-0000-0000-000000000001';
  const adminId = '7a000000-0000-0000-0000-000000000002';
  const ownerAId = '7a000000-0000-0000-0000-000000000003';
  const devopsAId = '7a000000-0000-0000-0000-000000000004';
  const viewerAId = '7a000000-0000-0000-0000-000000000005';
  const ownerBId = '7a000000-0000-0000-0000-000000000006';
  const devopsBId = '7a000000-0000-0000-0000-000000000007';

  const orgAId = '7b000000-0000-0000-0000-000000000001';
  const envAId = '7c000000-0000-0000-0000-000000000001';
  const clusterAId = '7d000000-0000-0000-0000-000000000001';
  const nsAId = '7e000000-0000-0000-0000-000000000001';
  const nodeAId = '7e000000-0000-0000-0000-000000000002';
  const podAId = '7e000000-0000-0000-0000-000000000003';

  const orgBId = '7b000000-0000-0000-0000-000000000002';
  const envBId = '7c000000-0000-0000-0000-000000000002';
  const clusterBId = '7d000000-0000-0000-0000-000000000002';

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
      `DELETE FROM users WHERE email LIKE 'audit.%@test.com' AND id NOT IN ($1, $2, $3, $4, $5, $6, $7);`,
      [superAdminId, adminId, ownerAId, devopsAId, viewerAId, ownerBId, devopsBId]
    );
    await pool.query(
      `DELETE FROM organizations WHERE slug LIKE 'audit-org-%' AND id NOT IN ($1, $2);`,
      [orgAId, orgBId]
    );

    const passwordHash = await bcrypt.hash('SecurePassword123!', 10);

    // 1. Seed Users
    await pool.query(
      `INSERT INTO users (id, email, password_hash, full_name, status, created_at, updated_at)
       VALUES 
         ($1, 'audit.super@test.com', $8, 'Audit Super', 'ACTIVE', NOW(), NOW()),
         ($2, 'audit.admin@test.com', $8, 'Audit Admin', 'ACTIVE', NOW(), NOW()),
         ($3, 'audit.ownera@test.com', $8, 'Audit Owner A', 'ACTIVE', NOW(), NOW()),
         ($4, 'audit.devopsa@test.com', $8, 'Audit DevOps A', 'ACTIVE', NOW(), NOW()),
         ($5, 'audit.viewera@test.com', $8, 'Audit Viewer A', 'ACTIVE', NOW(), NOW()),
         ($6, 'audit.ownerb@test.com', $8, 'Audit Owner B', 'ACTIVE', NOW(), NOW()),
         ($7, 'audit.devopsb@test.com', $8, 'Audit DevOps B', 'ACTIVE', NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET password_hash = $8, status = 'ACTIVE', deleted_at = NULL;`,
      [superAdminId, adminId, ownerAId, devopsAId, viewerAId, ownerBId, devopsBId, passwordHash]
    );

    // 2. Assign System Roles
    const srRes = await pool.query(`SELECT id, name FROM system_roles WHERE name IN ('SUPER_ADMIN', 'ADMIN')`);
    const superRoleId = srRes.rows.find((r) => r.name === 'SUPER_ADMIN')?.id;
    const adminRoleId = srRes.rows.find((r) => r.name === 'ADMIN')?.id;

    if (superRoleId) {
      await pool.query(`INSERT INTO user_system_roles (user_id, system_role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING;`, [superAdminId, superRoleId]);
    }
    if (adminRoleId) {
      await pool.query(`INSERT INTO user_system_roles (user_id, system_role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING;`, [adminId, adminRoleId]);
    }

    // 3. Seed Organizations
    await pool.query(
      `INSERT INTO organizations (id, name, slug, status, created_at, updated_at)
       VALUES 
         ($1, 'Audit Org A', 'audit-org-a', 'ACTIVE', NOW(), NOW()),
         ($2, 'Audit Org B', 'audit-org-b', 'ACTIVE', NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET status = 'ACTIVE', deleted_at = NULL;`,
      [orgAId, orgBId]
    );

    // 4. Seed Organization Members
    const orgRolesRes = await pool.query(`SELECT id, code FROM roles WHERE scope = 'ORGANIZATION'`);
    const smeOwnerRoleId = orgRolesRes.rows.find((r) => r.code === 'SME_OWNER')?.id;
    const devopsRoleId = orgRolesRes.rows.find((r) => r.code === 'DEVOPS')?.id;
    const viewerRoleId = orgRolesRes.rows.find((r) => r.code === 'VIEWER')?.id;

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

    // 5. Seed Environments, Clusters, Nodes, Pods
    await pool.query(
      `INSERT INTO environments (id, organization_id, name, code, environment_type, status, created_at, updated_at)
       VALUES 
         ($1, $2, 'audit-env-a', 'AUDIT_ENV_A', 'DEVELOPMENT', 'ACTIVE', NOW(), NOW()),
         ($3, $4, 'audit-env-b', 'AUDIT_ENV_B', 'DEVELOPMENT', 'ACTIVE', NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET organization_id = EXCLUDED.organization_id, deleted_at = NULL;`,
      [envAId, orgAId, envBId, orgBId]
    );

    await pool.query(
      `INSERT INTO clusters (id, environment_id, name, provider, status, created_at, updated_at)
       VALUES 
         ($1, $2, 'audit-cluster-a', 'MINIKUBE', 'CONNECTED', NOW(), NOW()),
         ($3, $4, 'audit-cluster-b', 'MINIKUBE', 'CONNECTED', NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET environment_id = EXCLUDED.environment_id, deleted_at = NULL;`,
      [clusterAId, envAId, clusterBId, envBId]
    );

    await pool.query(
      `INSERT INTO namespaces (id, cluster_id, name, status, created_at, updated_at)
       VALUES ($1, $2, 'audit-ns-a', 'ACTIVE', NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET cluster_id = EXCLUDED.cluster_id;`,
      [nsAId, clusterAId]
    );

    await pool.query(
      `INSERT INTO nodes (id, cluster_id, name, status, created_at, updated_at)
       VALUES ($1, $2, 'audit-node-a', 'READY', NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET cluster_id = EXCLUDED.cluster_id;`,
      [nodeAId, clusterAId]
    );

    await pool.query(
      `INSERT INTO pods (id, cluster_id, namespace_id, node_id, name, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'audit-pod-a', 'RUNNING', NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET cluster_id = EXCLUDED.cluster_id, deleted_at = NULL;`,
      [podAId, clusterAId, nsAId, nodeAId]
    );

    // 6. Generate Tokens
    superAdminToken = jwt.sign(
      { id: superAdminId, email: 'audit.super@test.com', status: 'ACTIVE', roles: ['SUPER_ADMIN'] },
      config.jwt.secret,
      { expiresIn: '1h', algorithm: 'HS256' }
    );

    adminToken = jwt.sign(
      { id: adminId, email: 'audit.admin@test.com', status: 'ACTIVE', roles: ['ADMIN'] },
      config.jwt.secret,
      { expiresIn: '1h', algorithm: 'HS256' }
    );

    ownerAToken = jwt.sign(
      { id: ownerAId, email: 'audit.ownera@test.com', status: 'ACTIVE', roles: ['USER'] },
      config.jwt.secret,
      { expiresIn: '1h', algorithm: 'HS256' }
    );

    devopsAToken = jwt.sign(
      { id: devopsAId, email: 'audit.devopsa@test.com', status: 'ACTIVE', roles: ['USER'] },
      config.jwt.secret,
      { expiresIn: '1h', algorithm: 'HS256' }
    );

    viewerAToken = jwt.sign(
      { id: viewerAId, email: 'audit.viewera@test.com', status: 'ACTIVE', roles: ['USER'] },
      config.jwt.secret,
      { expiresIn: '1h', algorithm: 'HS256' }
    );

    ownerBToken = jwt.sign(
      { id: ownerBId, email: 'audit.ownerb@test.com', status: 'ACTIVE', roles: ['USER'] },
      config.jwt.secret,
      { expiresIn: '1h', algorithm: 'HS256' }
    );

    devopsBToken = jwt.sign(
      { id: devopsBId, email: 'audit.devopsb@test.com', status: 'ACTIVE', roles: ['USER'] },
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

  // ==============================================================
  // 1. AUTHENTICATION AUDIT LOGGING
  // ==============================================================
  describe('1. Authentication Audit Logging', () => {
    test('1.1. Login success records AUTH_LOGIN_SUCCESS in audit_logs', async () => {
      const loginRes = await requestApi('/api/v1/auth/login', {
        method: 'POST',
        body: { email: 'audit.ownera@test.com', password: 'SecurePassword123!' },
      });
      assert.strictEqual(loginRes.status, 200);

      // Verify database record
      const dbRes = await pool.query(
        `SELECT * FROM audit_logs WHERE user_id = $1 AND action = 'AUTH_LOGIN_SUCCESS' ORDER BY created_at DESC LIMIT 1`,
        [ownerAId]
      );
      assert.ok(dbRes.rows.length > 0, 'Audit log for AUTH_LOGIN_SUCCESS must exist');
      const log = dbRes.rows[0];
      assert.strictEqual(log.status, 'SUCCESS');
      assert.strictEqual(log.action, 'AUTH_LOGIN_SUCCESS');
      assert.ok(log.created_at);
    });

    test('1.2. Login failure records AUTH_LOGIN_FAILURE and NEVER logs password', async () => {
      const loginRes = await requestApi('/api/v1/auth/login', {
        method: 'POST',
        body: { email: 'audit.ownera@test.com', password: 'WrongPassword999!' },
      });
      assert.strictEqual(loginRes.status, 401);

      const dbRes = await pool.query(
        `SELECT * FROM audit_logs WHERE action = 'AUTH_LOGIN_FAILURE' ORDER BY created_at DESC LIMIT 1`
      );
      assert.ok(dbRes.rows.length > 0, 'Audit log for AUTH_LOGIN_FAILURE must exist');
      const log = dbRes.rows[0];
      assert.strictEqual(log.status, 'FAILURE');
      assert.strictEqual(log.reason_code, 'INVALID_CREDENTIALS');

      // Verify no password in metadata or description
      const metaStr = JSON.stringify(log.metadata || {});
      assert.ok(!metaStr.includes('WrongPassword999!'), 'Metadata must NOT contain plain password');
      assert.ok(!log.description.includes('WrongPassword999!'), 'Description must NOT contain plain password');
    });

    test('1.3. Logout records AUTH_LOGOUT in audit_logs', async () => {
      const logoutToken = jwt.sign(
        { id: ownerAId, email: 'audit.ownera@test.com', status: 'ACTIVE', roles: ['USER'], jti: 'logout-specific' },
        config.jwt.secret,
        { expiresIn: '1h', algorithm: 'HS256' }
      );
      const logoutRes = await requestApi('/api/v1/auth/logout', {
        method: 'POST',
        token: logoutToken,
      });
      assert.strictEqual(logoutRes.status, 200);

      const dbRes = await pool.query(
        `SELECT * FROM audit_logs WHERE user_id = $1 AND action = 'AUTH_LOGOUT' ORDER BY created_at DESC LIMIT 1`,
        [ownerAId]
      );
      assert.ok(dbRes.rows.length > 0, 'Audit log for AUTH_LOGOUT must exist');
      assert.strictEqual(dbRes.rows[0].status, 'SUCCESS');
    });
  });

  // ==============================================================
  // 2. AUTHORIZATION DENIAL AUDIT LOGGING (RBAC & TENANT)
  // ==============================================================
  describe('2. Authorization Denial Audit Logging (RBAC & Tenant)', () => {
    test('2.1. RBAC denial (Owner A calling global /nodes) records ACCESS_DENIED_ROLE', async () => {
      const res = await requestApi('/api/v1/nodes', { token: ownerAToken });
      assert.strictEqual(res.status, 403);

      const dbRes = await pool.query(
        `SELECT * FROM audit_logs WHERE user_id = $1 AND action = 'ACCESS_DENIED_ROLE' ORDER BY created_at DESC LIMIT 1`,
        [ownerAId]
      );
      assert.ok(dbRes.rows.length > 0, 'Audit log for ACCESS_DENIED_ROLE must exist');
      const log = dbRes.rows[0];
      assert.strictEqual(log.status, 'DENIED');
      assert.strictEqual(log.reason_code, 'ROLE_REQUIRED');
      assert.ok(log.metadata?.required_roles);
    });

    test('2.2. Tenant IDOR denial (Owner B accessing Org A nodes) records ACCESS_DENIED_TENANT', async () => {
      const res = await requestApi(`/api/v1/organizations/${orgAId}/clusters/${clusterAId}/nodes`, {
        token: ownerBToken,
      });
      assert.strictEqual(res.status, 403);

      const dbRes = await pool.query(
        `SELECT * FROM audit_logs WHERE user_id = $1 AND action = 'ACCESS_DENIED_TENANT' ORDER BY created_at DESC LIMIT 1`,
        [ownerBId]
      );
      assert.ok(dbRes.rows.length > 0, 'Audit log for ACCESS_DENIED_TENANT must exist');
      const log = dbRes.rows[0];
      assert.strictEqual(log.status, 'DENIED');
      assert.strictEqual(log.reason_code, 'ORG_MEMBERSHIP_REQUIRED');
      assert.strictEqual(log.organization_id, orgAId);
    });

    test('2.3. Org Role denial (DevOps A inviting member) records ACCESS_DENIED_ROLE', async () => {
      const res = await requestApi(`/api/v1/organizations/${orgAId}/invitations`, {
        method: 'POST',
        token: devopsAToken,
        body: { email: 'forbidden@test.com', role_code: 'VIEWER' },
      });
      assert.strictEqual(res.status, 403);

      const dbRes = await pool.query(
        `SELECT * FROM audit_logs WHERE user_id = $1 AND action = 'ACCESS_DENIED_ROLE' ORDER BY created_at DESC LIMIT 1`,
        [devopsAId]
      );
      assert.ok(dbRes.rows.length > 0, 'Audit log for org role denial must exist');
      const log = dbRes.rows[0];
      assert.strictEqual(log.status, 'DENIED');
      assert.strictEqual(log.reason_code, 'ORG_ROLE_REQUIRED');
      assert.strictEqual(log.organization_id, orgAId);
    });
  });

  // ==============================================================
  // 3. SENSITIVE ADMINISTRATIVE & REMEDIATION ACTIONS AUDIT
  // ==============================================================
  describe('3. Sensitive Administrative & Remediation Actions Audit', () => {
    test('3.1. SuperAdmin assigning system role records SYSTEM_ROLE_ASSIGNED', async () => {
      const res = await requestApi('/api/v1/roles/assign', {
        method: 'POST',
        token: superAdminToken,
        body: { userId: viewerAId, role: 'USER' },
      });
      assert.strictEqual(res.status, 201);

      const dbRes = await pool.query(
        `SELECT * FROM audit_logs WHERE action = 'SYSTEM_ROLE_ASSIGNED' AND target_id = $1 ORDER BY created_at DESC LIMIT 1`,
        [viewerAId]
      );
      assert.ok(dbRes.rows.length > 0, 'Audit log for SYSTEM_ROLE_ASSIGNED must exist');
      const log = dbRes.rows[0];
      assert.strictEqual(log.status, 'SUCCESS');
      assert.strictEqual(log.user_id, superAdminId);
      assert.strictEqual(log.metadata?.role, 'USER');
    });

    test('3.2. DevOps A draining Node A records REMEDIATION_NODE_DRAINED', async () => {
      const res = await requestApi(`/api/v1/organizations/${orgAId}/clusters/${clusterAId}/nodes/${nodeAId}/drain`, {
        method: 'POST',
        token: devopsAToken,
      });
      assert.strictEqual(res.status, 200);

      const dbRes = await pool.query(
        `SELECT * FROM audit_logs WHERE action = 'REMEDIATION_NODE_DRAINED' AND resource_id = $1 ORDER BY created_at DESC LIMIT 1`,
        [nodeAId]
      );
      assert.ok(dbRes.rows.length > 0, 'Audit log for REMEDIATION_NODE_DRAINED must exist');
      const log = dbRes.rows[0];
      assert.strictEqual(log.status, 'SUCCESS');
      assert.strictEqual(log.organization_id, orgAId);
      assert.strictEqual(log.resource_type, 'NODE');
    });

    test('3.3. DevOps A restarting Pod A records REMEDIATION_POD_RESTARTED', async () => {
      const res = await requestApi(`/api/v1/organizations/${orgAId}/clusters/${clusterAId}/pods/${podAId}/restart`, {
        method: 'POST',
        token: devopsAToken,
      });
      assert.strictEqual(res.status, 200);

      const dbRes = await pool.query(
        `SELECT * FROM audit_logs WHERE action = 'REMEDIATION_POD_RESTARTED' AND resource_id = $1 ORDER BY created_at DESC LIMIT 1`,
        [podAId]
      );
      assert.ok(dbRes.rows.length > 0, 'Audit log for REMEDIATION_POD_RESTARTED must exist');
      const log = dbRes.rows[0];
      assert.strictEqual(log.status, 'SUCCESS');
      assert.strictEqual(log.organization_id, orgAId);
      assert.strictEqual(log.resource_type, 'POD');
    });
  });

  // ==============================================================
  // 4. DATA REDACTION & SECRET LEAKAGE PREVENTION
  // ==============================================================
  describe('4. Data Redaction & Secret Leakage Prevention', () => {
    test('4.1. AuditService.redactSensitiveData redacts all sensitive fields', () => {
      const rawPayload = {
        email: 'user@test.com',
        password: 'mySuperSecretPassword123',
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        api_key: 'sk_live_1234567890',
        nested: {
          secret_key: 'ultra-secret',
          cookie: 'session_id=abcdef',
          authorization: 'Bearer secret_token',
          safe_field: 'safe_value',
        },
      };

      const redacted = AuditService.redactSensitiveData(rawPayload);
      assert.strictEqual(redacted.email, 'user@test.com');
      assert.strictEqual(redacted.password, '[REDACTED]');
      assert.strictEqual(redacted.token, '[REDACTED]');
      assert.strictEqual(redacted.api_key, '[REDACTED]');
      assert.strictEqual(redacted.nested.secret_key, '[REDACTED]');
      assert.strictEqual(redacted.nested.cookie, '[REDACTED]');
      assert.strictEqual(redacted.nested.authorization, '[REDACTED]');
      assert.strictEqual(redacted.nested.safe_field, 'safe_value');
    });

    test('4.2. AuditService.sanitizeIp handles IPv4, IPv6, proxies, and invalid formats safely', () => {
      assert.strictEqual(AuditService.sanitizeIp('127.0.0.1'), '127.0.0.1');
      assert.strictEqual(AuditService.sanitizeIp('::ffff:192.168.1.1'), '192.168.1.1');
      assert.strictEqual(AuditService.sanitizeIp('10.0.0.1, 192.168.1.1'), '10.0.0.1');
      assert.strictEqual(AuditService.sanitizeIp('10.0.0.1:8080'), '10.0.0.1');
      assert.strictEqual(AuditService.sanitizeIp('invalid-ip-string'), null);
      assert.strictEqual(AuditService.sanitizeIp(null), null);
    });
  });

  // ==============================================================
  // 5. AUDIT LOG QUERY API & TENANT ISOLATION
  // ==============================================================
  describe('5. Audit Log Query API & Tenant Isolation', () => {
    test('5.1. Unauthenticated request to /api/v1/audit-logs returns 401', async () => {
      const res = await requestApi('/api/v1/audit-logs');
      assert.strictEqual(res.status, 401);
    });

    test('5.2. Regular Tenant Owner A is FORBIDDEN (403) from platform /api/v1/audit-logs', async () => {
      const res = await requestApi('/api/v1/audit-logs', { token: ownerAToken });
      assert.strictEqual(res.status, 403);
    });

    test('5.3. Platform Admin CAN query platform /api/v1/audit-logs (200 OK)', async () => {
      const res = await requestApi('/api/v1/audit-logs', { token: adminToken });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data?.success, true);
      assert.ok(Array.isArray(res.data?.data?.data));
      assert.ok(res.data?.data?.pagination);
    });

    test('5.4. SuperAdmin CAN query platform /api/v1/audit-logs with filter (200 OK)', async () => {
      const res = await requestApi(`/api/v1/audit-logs?organization_id=${orgAId}&limit=10`, {
        token: superAdminToken,
      });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data?.success, true);
      // All returned logs must be for Org A
      const logs = res.data?.data?.data;
      assert.ok(Array.isArray(logs));
      for (const log of logs) {
        assert.strictEqual(log.organization_id, orgAId);
      }
    });

    test('5.5. Owner A CAN view audit logs of Org A via /organizations/:id/audit-logs (200 OK)', async () => {
      const res = await requestApi(`/api/v1/organizations/${orgAId}/audit-logs`, {
        token: ownerAToken,
      });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data?.success, true);
      const logs = res.data?.data?.data;
      assert.ok(Array.isArray(logs));
      for (const log of logs) {
        assert.strictEqual(log.organization_id, orgAId);
      }
    });

    test('5.6. DevOps A CAN view audit logs of Org A (200 OK)', async () => {
      const res = await requestApi(`/api/v1/organizations/${orgAId}/audit-logs`, {
        token: devopsAToken,
      });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data?.success, true);
    });

    test('5.7. Viewer A is FORBIDDEN (403) from viewing audit logs of Org A', async () => {
      const res = await requestApi(`/api/v1/organizations/${orgAId}/audit-logs`, {
        token: viewerAToken,
      });
      assert.strictEqual(res.status, 403);
    });

    test('5.8. IDOR Prevention: Owner B CANNOT view audit logs of Org A (403 Forbidden)', async () => {
      const res = await requestApi(`/api/v1/organizations/${orgAId}/audit-logs`, {
        token: ownerBToken,
      });
      assert.strictEqual(res.status, 403);
    });

    test('5.9. IDOR Tampering Prevention: Owner A passing organization_id=orgBId is rejected', async () => {
      const res = await requestApi(`/api/v1/organizations/${orgAId}/audit-logs?organization_id=${orgBId}`, {
        token: ownerAToken,
      });
      // Enforced tenant isolation in AuditService.query rejects tampered orgId
      assert.strictEqual(res.status, 403);
    });

    test('5.10. SQL Injection in filter query is safely parameterized and handled (200 OK, 0 results)', async () => {
      const maliciousAction = "'; DROP TABLE audit_logs; --";
      const res = await requestApi(`/api/v1/audit-logs?action=${encodeURIComponent(maliciousAction)}`, {
        token: adminToken,
      });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data?.data?.data?.length, 0);

      // Verify audit_logs table was not dropped!
      const verifyRes = await pool.query(`SELECT COUNT(*)::int AS count FROM audit_logs;`);
      assert.ok(verifyRes.rows[0].count >= 0, 'Table audit_logs must remain intact');
    });

    test('5.11. Immutability: Client cannot POST, PUT, DELETE to audit logs endpoint', async () => {
      const postRes = await requestApi('/api/v1/audit-logs', { method: 'POST', token: adminToken, body: {} });
      assert.ok([404, 405].includes(postRes.status), 'POST to /audit-logs must be rejected');

      const putRes = await requestApi('/api/v1/audit-logs/1', { method: 'PUT', token: adminToken, body: {} });
      assert.ok([404, 405].includes(putRes.status), 'PUT to /audit-logs must be rejected');

      const deleteRes = await requestApi('/api/v1/audit-logs/1', { method: 'DELETE', token: adminToken });
      assert.ok([404, 405].includes(deleteRes.status), 'DELETE to /audit-logs must be rejected');
    });
  });
});
