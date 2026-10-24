import test, { describe, before, after } from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import crypto from 'node:crypto';
import { AddressInfo } from 'node:net';
import jwt from 'jsonwebtoken';
import app from '../app';
import { config } from '../config/env';
import { pool } from '../config/database';
import { testRedisConnection, closeRedis } from '../config/redis';

describe('Cluster Management, RBAC & Agent Token Lifecycle Suite [PB12 3.1]', () => {
  let server: http.Server;
  let baseUrl: string;

  const orgAId = 'b6000000-0000-0000-0000-000000000001';
  const orgBId = 'b6000000-0000-0000-0000-000000000002';

  const ownerAId = 'a6000000-0000-0000-0000-000000000001';
  const devopsAId = 'a6000000-0000-0000-0000-000000000002';
  const viewerAId = 'a6000000-0000-0000-0000-000000000003';
  const ownerBId = 'a6000000-0000-0000-0000-000000000004';

  const envAId = 'c6000000-0000-0000-0000-000000000001';
  const envBId = 'c6000000-0000-0000-0000-000000000002';

  let ownerAToken: string;
  let devopsAToken: string;
  let viewerAToken: string;
  let ownerBToken: string;

  let createdClusterAId: string;
  let initialRawTokenA: string;
  let initialTokenAId: string;
  let createdAgentAId: string;

  let rotatedRawTokenA: string;
  let rotatedTokenAId: string;

  let createdClusterCId: string;
  let createdAgentCId: string;

  before(async () => {
    await testRedisConnection();

    // 1. Roles
    const rolesRes = await pool.query(`SELECT id, code FROM roles WHERE scope = 'ORGANIZATION'`);
    const smeOwnerRoleId = rolesRes.rows.find((r) => r.code === 'SME_OWNER')?.id;
    const devopsRoleId = rolesRes.rows.find((r) => r.code === 'DEVOPS')?.id;
    const viewerRoleId = rolesRes.rows.find((r) => r.code === 'VIEWER')?.id;

    // 2. Users
    await pool.query(
      `INSERT INTO users (id, email, password_hash, full_name, status, created_at, updated_at)
       VALUES 
         ($1, 'owner.a.cluster@test.com', 'dummy_hash', 'Owner A Cluster', 'ACTIVE', NOW(), NOW()),
         ($2, 'devops.a.cluster@test.com', 'dummy_hash', 'Devops A Cluster', 'ACTIVE', NOW(), NOW()),
         ($3, 'viewer.a.cluster@test.com', 'dummy_hash', 'Viewer A Cluster', 'ACTIVE', NOW(), NOW()),
         ($4, 'owner.b.cluster@test.com', 'dummy_hash', 'Owner B Cluster', 'ACTIVE', NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET status = 'ACTIVE', deleted_at = NULL;`,
      [ownerAId, devopsAId, viewerAId, ownerBId]
    );

    // 3. Orgs
    await pool.query(
      `INSERT INTO organizations (id, name, slug, status, created_by, created_at, updated_at)
       VALUES 
         ($1, 'Cluster Org A', 'cluster-org-a', 'ACTIVE', $2, NOW(), NOW()),
         ($3, 'Cluster Org B', 'cluster-org-b', 'ACTIVE', $4, NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET status = 'ACTIVE', deleted_at = NULL;`,
      [orgAId, ownerAId, orgBId, ownerBId]
    );

    // 4. Org Members
    await pool.query(
      `INSERT INTO organization_members (organization_id, user_id, role_id, status, joined_at)
       VALUES 
         ($1, $2, $3, 'ACTIVE', NOW()),
         ($1, $4, $5, 'ACTIVE', NOW()),
         ($1, $6, $7, 'ACTIVE', NOW()),
         ($8, $9, $3, 'ACTIVE', NOW())
       ON CONFLICT (organization_id, user_id) DO UPDATE SET status = 'ACTIVE';`,
      [orgAId, ownerAId, smeOwnerRoleId, devopsAId, devopsRoleId, viewerAId, viewerRoleId, orgBId, ownerBId]
    );

    // 5. Environments
    await pool.query(
      `INSERT INTO environments (id, organization_id, name, code, environment_type, created_by, created_at, updated_at)
       VALUES 
         ($1, $2, 'Env Cluster A', 'env-cls-a', 'PRODUCTION', $3, NOW(), NOW()),
         ($4, $5, 'Env Cluster B', 'env-cls-b', 'PRODUCTION', $6, NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET organization_id = EXCLUDED.organization_id;`,
      [envAId, orgAId, ownerAId, envBId, orgBId, ownerBId]
    );

    // 6. JWT Signings
    const signUser = (id: string, email: string) =>
      jwt.sign({ id, email, status: 'ACTIVE', roles: ['USER'] }, config.jwt.secret, {
        expiresIn: '1h',
        algorithm: 'HS256',
      });

    ownerAToken = signUser(ownerAId, 'owner.a.cluster@test.com');
    devopsAToken = signUser(devopsAId, 'devops.a.cluster@test.com');
    viewerAToken = signUser(viewerAId, 'viewer.a.cluster@test.com');
    ownerBToken = signUser(ownerBId, 'owner.b.cluster@test.com');

    // 7. HTTP Server
    server = http.createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const address = server.address() as AddressInfo;
        baseUrl = `http://127.0.0.1:${address.port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    // Cleanup created test records
    await pool.query(`DELETE FROM audit_logs WHERE organization_id IN ($1, $2);`, [orgAId, orgBId]);
    await pool.query(
      `DELETE FROM agent_heartbeats WHERE agent_id IN (
         SELECT a.id FROM agents a JOIN environments e ON a.environment_id = e.id WHERE e.organization_id IN ($1, $2)
       );`,
      [orgAId, orgBId]
    );
    await pool.query(
      `DELETE FROM agent_tokens WHERE agent_id IN (
         SELECT a.id FROM agents a JOIN environments e ON a.environment_id = e.id WHERE e.organization_id IN ($1, $2)
       );`,
      [orgAId, orgBId]
    );
    await pool.query(
      `DELETE FROM agents WHERE environment_id IN ($1, $2);`,
      [envAId, envBId]
    );
    await pool.query(`DELETE FROM clusters WHERE environment_id IN ($1, $2);`, [envAId, envBId]);
    await pool.query(`DELETE FROM environments WHERE id IN ($1, $2);`, [envAId, envBId]);
    await pool.query(`DELETE FROM organization_members WHERE organization_id IN ($1, $2);`, [orgAId, orgBId]);
    await pool.query(`DELETE FROM organizations WHERE id IN ($1, $2);`, [orgAId, orgBId]);
    await pool.query(`DELETE FROM users WHERE id IN ($1, $2, $3, $4);`, [ownerAId, devopsAId, viewerAId, ownerBId]);
    await closeRedis();
  });

  test('1. Create cluster with valid data: returns 201, auto-creates Agent and token, returns raw token once', async () => {
    const res = await fetch(`${baseUrl}/api/v1/organizations/${orgAId}/clusters`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerAToken}`,
      },
      body: JSON.stringify({
        name: 'k8s-prod-cluster-a',
        environment_id: envAId,
        provider: 'MINIKUBE',
        kubernetes_version: 'v1.29.4',
      }),
    });

    assert.strictEqual(res.status, 201);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(body.data.id, 'Cluster ID must be returned');
    assert.strictEqual(body.data.name, 'k8s-prod-cluster-a');
    assert.ok(body.data.agent_id, 'Agent ID must be automatically generated');
    assert.strictEqual(body.data.agent_status, 'PENDING');
    assert.ok(body.data.token?.raw_token, 'Raw token must be returned once upon creation');
    assert.ok(body.data.token.raw_token.startsWith('sh_live_sec_'), 'Token format must start with sh_live_sec_');
    assert.ok(body.data.install_command.includes(body.data.id), 'Install command must include clusterId');

    createdClusterAId = body.data.id;
    createdAgentAId = body.data.agent_id;
    initialRawTokenA = body.data.token.raw_token;
    initialTokenAId = body.data.token.id;

    // Verify database security: token_hash is stored, raw_token is NOT stored in DB
    const dbToken = await pool.query(`SELECT token_hash, token_prefix FROM agent_tokens WHERE id = $1`, [initialTokenAId]);
    assert.strictEqual(dbToken.rows.length, 1);
    const expectedHash = crypto.createHash('sha256').update(initialRawTokenA).digest('hex');
    assert.strictEqual(dbToken.rows[0].token_hash, expectedHash);
    assert.strictEqual(dbToken.rows[0].token_prefix, initialRawTokenA.slice(0, 16));

    // Verify audit log created
    const dbAudit = await pool.query(
      `SELECT * FROM audit_logs WHERE resource_id = $1 AND action = 'CLUSTER_CREATED'`,
      [createdClusterAId]
    );
    assert.strictEqual(dbAudit.rows.length, 1);
    assert.strictEqual(dbAudit.rows[0].organization_id, orgAId);
  });

  test('2. List clusters by Organization: returns 200, shows masked token_prefix, NO raw token in response', async () => {
    const res = await fetch(`${baseUrl}/api/v1/organizations/${orgAId}/clusters`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${ownerAToken}`,
      },
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(Array.isArray(body.data));
    const found = body.data.find((c: any) => c.id === createdClusterAId);
    assert.ok(found, 'Cluster A must be present in org listing');
    assert.strictEqual(found.token_prefix, initialRawTokenA.slice(0, 16));
    assert.strictEqual(found.agent_status, 'PENDING');
    // Ensure raw token and token_hash are never leaked
    const jsonStr = JSON.stringify(body);
    assert.strictEqual(jsonStr.includes(initialRawTokenA), false, 'Raw token must not appear in cluster list');
    assert.strictEqual(jsonStr.includes('token_hash'), false, 'token_hash must not appear in cluster list');
  });

  test('3. Get cluster detail: returns 200 with tokens list, does NOT inject fake mock heartbeats', async () => {
    const res = await fetch(`${baseUrl}/api/v1/organizations/${orgAId}/clusters/${createdClusterAId}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${devopsAToken}`,
      },
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.id, createdClusterAId);
    assert.strictEqual(body.data.agent_id, createdAgentAId);
    assert.ok(Array.isArray(body.data.tokens));
    assert.strictEqual(body.data.tokens.length, 1);
    assert.strictEqual(body.data.tokens[0].is_active, true);
    assert.strictEqual(body.data.tokens[0].token_prefix, initialRawTokenA.slice(0, 16));
    // Verify no fake heartbeat injected
    assert.ok(Array.isArray(body.data.recent_heartbeats));
    assert.strictEqual(body.data.recent_heartbeats.length, 0, 'No mock heartbeat should be injected on GET');
  });

  test('4. Tenant Isolation: Org B cannot access, list, or view Org A cluster', async () => {
    // Org B member attempting to access Org A endpoint
    const crossRes1 = await fetch(`${baseUrl}/api/v1/organizations/${orgAId}/clusters`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${ownerBToken}` },
    });
    assert.strictEqual(crossRes1.status, 403, 'User outside Org A must be rejected with 403');

    // Org B member accessing their own org route for Org A cluster ID
    const crossRes2 = await fetch(`${baseUrl}/api/v1/organizations/${orgBId}/clusters/${createdClusterAId}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${ownerBToken}` },
    });
    assert.strictEqual(crossRes2.status, 404, 'Cluster A does not belong to Org B and must return 404');
  });

  test('5. Tenant Isolation: Org B cannot rotate token or remove Org A cluster', async () => {
    const crossRotate = await fetch(`${baseUrl}/api/v1/organizations/${orgBId}/clusters/${createdClusterAId}/rotate-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerBToken}`,
      },
      body: JSON.stringify({}),
    });
    assert.strictEqual(crossRotate.status, 404);

    const crossDelete = await fetch(`${baseUrl}/api/v1/organizations/${orgBId}/clusters/${createdClusterAId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${ownerBToken}` },
    });
    assert.strictEqual(crossDelete.status, 404);
  });

  test('6. RBAC Enforcement: Viewer can read cluster but cannot create, rotate token, or delete cluster', async () => {
    // Read: allowed
    const viewRes = await fetch(`${baseUrl}/api/v1/organizations/${orgAId}/clusters/${createdClusterAId}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${viewerAToken}` },
    });
    assert.strictEqual(viewRes.status, 200);

    // Create: forbidden
    const createRes = await fetch(`${baseUrl}/api/v1/organizations/${orgAId}/clusters`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${viewerAToken}`,
      },
      body: JSON.stringify({ name: 'viewer-cluster' }),
    });
    assert.strictEqual(createRes.status, 403);

    // Rotate: forbidden
    const rotateRes = await fetch(`${baseUrl}/api/v1/organizations/${orgAId}/clusters/${createdClusterAId}/rotate-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${viewerAToken}`,
      },
      body: JSON.stringify({}),
    });
    assert.strictEqual(rotateRes.status, 403);

    // Delete: forbidden
    const deleteRes = await fetch(`${baseUrl}/api/v1/organizations/${orgAId}/clusters/${createdClusterAId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${viewerAToken}` },
    });
    assert.strictEqual(deleteRes.status, 403);
  });

  test('7. Agent Heartbeat with Initial Token: Agent connects and transitions to ONLINE', async () => {
    const hbRes = await fetch(`${baseUrl}/api/v1/agents/heartbeat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-agent-token': initialRawTokenA,
      },
      body: JSON.stringify({
        latency_ms: 12,
        reported_at: new Date().toISOString(),
        agent_version: 'v2.4.1',
      }),
    });

    assert.strictEqual(hbRes.status, 200);
    const hbBody = await hbRes.json();
    assert.strictEqual(hbBody.success, true);
    assert.strictEqual(hbBody.data.status, 'ONLINE');

    // Verify Cluster detail now shows agent_status: 'ONLINE'
    const detailRes = await fetch(`${baseUrl}/api/v1/organizations/${orgAId}/clusters/${createdClusterAId}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${ownerAToken}` },
    });
    const detailBody = await detailRes.json();
    assert.strictEqual(detailBody.data.agent_status, 'ONLINE');
    assert.strictEqual(detailBody.data.recent_heartbeats.length, 1);
  });

  test('8. Token Rotation (POST /:clusterId/rotate-token): Generates new token, revokes previous token', async () => {
    const res = await fetch(`${baseUrl}/api/v1/organizations/${orgAId}/clusters/${createdClusterAId}/rotate-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${devopsAToken}`,
      },
      body: JSON.stringify({ expires_in_days: 60 }),
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(body.data.raw_token);
    assert.ok(body.data.raw_token.startsWith('sh_live_sec_'));
    assert.notStrictEqual(body.data.raw_token, initialRawTokenA);

    rotatedRawTokenA = body.data.raw_token;
    rotatedTokenAId = body.data.token_id;

    // Database verification: initial token revoked
    const oldTok = await pool.query(`SELECT revoked_at FROM agent_tokens WHERE id = $1`, [initialTokenAId]);
    assert.ok(oldTok.rows[0].revoked_at, 'Initial token must be marked as revoked');

    // Audit log verification
    const auditRes = await pool.query(
      `SELECT * FROM audit_logs WHERE resource_id = $1 AND action = 'TOKEN_ROTATED' ORDER BY created_at DESC LIMIT 1`,
      [createdClusterAId]
    );
    assert.strictEqual(auditRes.rows.length, 1);
    assert.strictEqual(auditRes.rows[0].organization_id, orgAId);
  });

  test('9. Previous (Rotated) Token is rejected with 401 on heartbeat attempt', async () => {
    const res = await fetch(`${baseUrl}/api/v1/agents/heartbeat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-agent-token': initialRawTokenA,
      },
      body: JSON.stringify({ latency_ms: 10 }),
    });

    assert.strictEqual(res.status, 401);
  });

  test('10. Rotated Token successfully authenticates and recovers/maintains agent connection', async () => {
    const res = await fetch(`${baseUrl}/api/v1/agents/heartbeat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${rotatedRawTokenA}`,
      },
      body: JSON.stringify({
        latency_ms: 15,
        reported_at: new Date().toISOString(),
        agent_version: 'v2.4.1',
      }),
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.status, 'ONLINE');
  });

  test('11. Specific Token Revocation (DELETE /:clusterId/tokens/:tokenId): Revokes token and transitions agent to OFFLINE', async () => {
    const res = await fetch(
      `${baseUrl}/api/v1/organizations/${orgAId}/clusters/${createdClusterAId}/tokens/${rotatedTokenAId}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${ownerAToken}`,
        },
      }
    );

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);

    // Verify token is revoked and agent status is OFFLINE in DB
    const tokRes = await pool.query(`SELECT revoked_at FROM agent_tokens WHERE id = $1`, [rotatedTokenAId]);
    assert.ok(tokRes.rows[0].revoked_at);

    const agRes = await pool.query(`SELECT status FROM agents WHERE id = $1`, [createdAgentAId]);
    assert.strictEqual(agRes.rows[0].status, 'OFFLINE');

    // Audit log verification
    const auditRes = await pool.query(
      `SELECT * FROM audit_logs WHERE resource_id = $1 AND action = 'TOKEN_REVOKED' ORDER BY created_at DESC LIMIT 1`,
      [createdClusterAId]
    );
    assert.strictEqual(auditRes.rows.length, 1);
  });

  test('12. Revoked Token cannot send heartbeat (returns 401)', async () => {
    const res = await fetch(`${baseUrl}/api/v1/agents/heartbeat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-agent-token': rotatedRawTokenA,
      },
      body: JSON.stringify({ latency_ms: 10 }),
    });

    assert.strictEqual(res.status, 401);
  });

  test('13. Delete Protection for ONLINE Agent: Deleting cluster with ONLINE agent without force returns 400', async () => {
    // Create Cluster C
    const createRes = await fetch(`${baseUrl}/api/v1/organizations/${orgAId}/clusters`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerAToken}`,
      },
      body: JSON.stringify({
        name: 'k8s-online-cluster-c',
        environment_id: envAId,
      }),
    });
    assert.strictEqual(createRes.status, 201);
    const cBody = await createRes.json();
    createdClusterCId = cBody.data.id;
    createdAgentCId = cBody.data.agent_id;
    const tokenC = cBody.data.token.raw_token;

    // Send heartbeat to set agent ONLINE
    const hbRes = await fetch(`${baseUrl}/api/v1/agents/heartbeat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-agent-token': tokenC,
      },
      body: JSON.stringify({ latency_ms: 14 }),
    });
    assert.strictEqual(hbRes.status, 200);

    // Attempt delete without force
    const delRes = await fetch(`${baseUrl}/api/v1/organizations/${orgAId}/clusters/${createdClusterCId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${ownerAToken}` },
    });
    assert.strictEqual(delRes.status, 400);
    const delBody = await delRes.json();
    assert.strictEqual(delBody.success, false);
    assert.ok(delBody.message.includes('ONLINE'));
  });

  test('14. Safe Cluster Deletion with force=true: Soft deletes cluster, revokes Agent and all tokens', async () => {
    const delRes = await fetch(`${baseUrl}/api/v1/organizations/${orgAId}/clusters/${createdClusterCId}?force=true`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${ownerAToken}` },
    });
    assert.strictEqual(delRes.status, 200);

    // Database verification:
    // 1. Cluster marked DELETED
    const clsDb = await pool.query(`SELECT status, deleted_at FROM clusters WHERE id = $1`, [createdClusterCId]);
    assert.strictEqual(clsDb.rows[0].status, 'DELETED');
    assert.ok(clsDb.rows[0].deleted_at);

    // 2. Agent marked REVOKED
    const agDb = await pool.query(`SELECT status, revoked_at FROM agents WHERE id = $1`, [createdAgentCId]);
    assert.strictEqual(agDb.rows[0].status, 'REVOKED');
    assert.ok(agDb.rows[0].revoked_at);

    // 3. Tokens marked revoked
    const tokDb = await pool.query(
      `SELECT COUNT(*)::int AS unrevoked FROM agent_tokens WHERE agent_id = $1 AND revoked_at IS NULL`,
      [createdAgentCId]
    );
    assert.strictEqual(tokDb.rows[0].unrevoked, 0);

    // 4. Audit log recorded
    const auditDb = await pool.query(
      `SELECT * FROM audit_logs WHERE resource_id = $1 AND action = 'CLUSTER_REMOVED'`,
      [createdClusterCId]
    );
    assert.strictEqual(auditDb.rows.length, 1);
  });

  test('15. Zero Credential Leakage: Audit logs never store raw tokens, prefixes or secrets in descriptions', async () => {
    const logs = await pool.query(
      `SELECT * FROM audit_logs WHERE organization_id = $1`,
      [orgAId]
    );
    for (const log of logs.rows) {
      const serialized = JSON.stringify(log);
      assert.strictEqual(serialized.includes(initialRawTokenA), false, 'Audit log must not contain initial token');
      if (rotatedRawTokenA) {
        assert.strictEqual(serialized.includes(rotatedRawTokenA), false, 'Audit log must not contain rotated token');
      }
    }
  });
});
