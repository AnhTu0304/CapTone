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

describe('Agent Disconnect, Delete & Access Control Suite [PB12 3.2]', () => {
  let server: http.Server;
  let baseUrl: string;

  const orgAId = 'b7000000-0000-0000-0000-000000000001';
  const orgBId = 'b7000000-0000-0000-0000-000000000002';

  const ownerAId = 'a7000000-0000-0000-0000-000000000001';
  const devopsAId = 'a7000000-0000-0000-0000-000000000002';
  const viewerAId = 'a7000000-0000-0000-0000-000000000003';
  const ownerBId = 'a7000000-0000-0000-0000-000000000004';

  const envAId = 'c7000000-0000-0000-0000-000000000001';
  const envBId = 'c7000000-0000-0000-0000-000000000002';

  const clusterAId = 'd7000000-0000-0000-0000-000000000001';
  const clusterBId = 'd7000000-0000-0000-0000-000000000002';
  const clusterA2Id = 'd7000000-0000-0000-0000-000000000003';

  const agent1Id = 'e7000000-0000-0000-0000-000000000001';
  const agent2Id = 'e7000000-0000-0000-0000-000000000002';
  const agent3RevokedId = 'e7000000-0000-0000-0000-000000000003';
  const agent4OnlineId = 'e7000000-0000-0000-0000-000000000004';
  const agentBId = 'e7000000-0000-0000-0000-000000000005';

  const token1Id = 'f7000000-0000-0000-0000-000000000001';
  const token2Id = 'f7000000-0000-0000-0000-000000000002';
  const token3Id = 'f7000000-0000-0000-0000-000000000003';
  const token4Id = 'f7000000-0000-0000-0000-000000000004';
  const tokenBId = 'f7000000-0000-0000-0000-000000000005';

  const rawToken1 = 'sh_live_sec_disconnect_agent1_12345';
  const rawToken2 = 'sh_live_sec_disconnect_agent2_12345';
  const rawToken3 = 'sh_live_sec_disconnect_agent3_12345';
  const rawToken4 = 'sh_live_sec_disconnect_agent4_12345';
  const rawTokenB = 'sh_live_sec_disconnect_agentb_12345';

  let ownerAToken: string;
  let devopsAToken: string;
  let viewerAToken: string;
  let ownerBToken: string;

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
         ($1, 'owner.a.disc@test.com', 'dummy_hash', 'Owner A Disc', 'ACTIVE', NOW(), NOW()),
         ($2, 'devops.a.disc@test.com', 'dummy_hash', 'Devops A Disc', 'ACTIVE', NOW(), NOW()),
         ($3, 'viewer.a.disc@test.com', 'dummy_hash', 'Viewer A Disc', 'ACTIVE', NOW(), NOW()),
         ($4, 'owner.b.disc@test.com', 'dummy_hash', 'Owner B Disc', 'ACTIVE', NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET status = 'ACTIVE', deleted_at = NULL;`,
      [ownerAId, devopsAId, viewerAId, ownerBId]
    );

    // 3. Orgs
    await pool.query(
      `INSERT INTO organizations (id, name, slug, status, created_by, created_at, updated_at)
       VALUES 
         ($1, 'Disconnect Org A', 'disc-org-a', 'ACTIVE', $2, NOW(), NOW()),
         ($3, 'Disconnect Org B', 'disc-org-b', 'ACTIVE', $4, NOW(), NOW())
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
         ($1, $2, 'Env Disc A', 'env-disc-a', 'PRODUCTION', $3, NOW(), NOW()),
         ($4, $5, 'Env Disc B', 'env-disc-b', 'PRODUCTION', $6, NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET organization_id = EXCLUDED.organization_id;`,
      [envAId, orgAId, ownerAId, envBId, orgBId, ownerBId]
    );

    // 6. Clusters
    await pool.query(
      `INSERT INTO clusters (id, environment_id, name, status, created_at, updated_at)
       VALUES 
         ($1, $2, 'k8s-cluster-disc-a', 'CONNECTED', NOW(), NOW()),
         ($3, $4, 'k8s-cluster-disc-b', 'CONNECTED', NOW(), NOW()),
         ($5, $2, 'k8s-cluster-disc-a2', 'CONNECTED', NOW(), NOW())
       ON CONFLICT (id) DO NOTHING;`,
      [clusterAId, envAId, clusterBId, envBId, clusterA2Id]
    );

    // 7. Agents
    await pool.query(
      `INSERT INTO agents (id, environment_id, cluster_id, name, agent_uid, version, status, last_seen_at, created_at, updated_at)
       VALUES 
         ($1, $2, $3, 'Agent One', 'uid-agent-disc-1', '1.0.0', 'ONLINE', NOW(), NOW(), NOW()),
         ($4, $2, $5, 'Agent Two', 'uid-agent-disc-2', '1.0.0', 'ONLINE', NOW(), NOW(), NOW()),
         ($6, $2, NULL, 'Agent Three Revoked', 'uid-agent-disc-3', '1.0.0', 'REVOKED', NOW() - INTERVAL '1 day', NOW(), NOW()),
         ($7, $2, NULL, 'Agent Four Online', 'uid-agent-disc-4', '1.0.0', 'ONLINE', NOW(), NOW(), NOW()),
         ($8, $9, $10, 'Agent B', 'uid-agent-disc-b', '1.0.0', 'ONLINE', NOW(), NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, revoked_at = NULL;`,
      [agent1Id, envAId, clusterAId, agent2Id, clusterA2Id, agent3RevokedId, agent4OnlineId, agentBId, envBId, clusterBId]
    );

    // 8. Agent Tokens
    const hash = (t: string) => crypto.createHash('sha256').update(t).digest('hex');
    await pool.query(
      `INSERT INTO agent_tokens (id, agent_id, token_hash, token_prefix, expires_at, created_at)
       VALUES 
         ($1, $2, $3, $4, NOW() + INTERVAL '30 days', NOW()),
         ($5, $6, $7, $8, NOW() + INTERVAL '30 days', NOW()),
         ($9, $10, $11, $12, NOW() + INTERVAL '30 days', NOW()),
         ($13, $14, $15, $16, NOW() + INTERVAL '30 days', NOW()),
         ($17, $18, $19, $20, NOW() + INTERVAL '30 days', NOW())
       ON CONFLICT (id) DO UPDATE SET revoked_at = NULL;`,
      [
        token1Id, agent1Id, hash(rawToken1), rawToken1.slice(0, 16),
        token2Id, agent2Id, hash(rawToken2), rawToken2.slice(0, 16),
        token3Id, agent3RevokedId, hash(rawToken3), rawToken3.slice(0, 16),
        token4Id, agent4OnlineId, hash(rawToken4), rawToken4.slice(0, 16),
        tokenBId, agentBId, hash(rawTokenB), rawTokenB.slice(0, 16),
      ]
    );

    // Mark agent3 token revoked
    await pool.query(`UPDATE agent_tokens SET revoked_at = NOW() WHERE id = $1;`, [token3Id]);
    await pool.query(`UPDATE agents SET revoked_at = NOW() WHERE id = $1;`, [agent3RevokedId]);

    // 9. Sign JWTs
    const signUser = (id: string, email: string) =>
      jwt.sign({ id, email, status: 'ACTIVE', roles: ['USER'] }, config.jwt.secret, {
        expiresIn: '1h',
        algorithm: 'HS256',
      });

    ownerAToken = signUser(ownerAId, 'owner.a.disc@test.com');
    devopsAToken = signUser(devopsAId, 'devops.a.disc@test.com');
    viewerAToken = signUser(viewerAId, 'viewer.a.disc@test.com');
    ownerBToken = signUser(ownerBId, 'owner.b.disc@test.com');

    // 10. HTTP Server
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
    // Cleanup
    await pool.query(`DELETE FROM audit_logs WHERE organization_id IN ($1, $2);`, [orgAId, orgBId]);
    await pool.query(
      `DELETE FROM agent_heartbeats WHERE agent_id IN ($1, $2, $3, $4, $5);`,
      [agent1Id, agent2Id, agent3RevokedId, agent4OnlineId, agentBId]
    );
    await pool.query(
      `DELETE FROM agent_tokens WHERE id IN ($1, $2, $3, $4, $5);`,
      [token1Id, token2Id, token3Id, token4Id, tokenBId]
    );
    await pool.query(
      `DELETE FROM agents WHERE id IN ($1, $2, $3, $4, $5);`,
      [agent1Id, agent2Id, agent3RevokedId, agent4OnlineId, agentBId]
    );
    await pool.query(`DELETE FROM clusters WHERE id IN ($1, $2, $3);`, [clusterAId, clusterBId, clusterA2Id]);
    await pool.query(`DELETE FROM environments WHERE id IN ($1, $2);`, [envAId, envBId]);
    await pool.query(`DELETE FROM organization_members WHERE organization_id IN ($1, $2);`, [orgAId, orgBId]);
    await pool.query(`DELETE FROM organizations WHERE id IN ($1, $2);`, [orgAId, orgBId]);
    await pool.query(`DELETE FROM users WHERE id IN ($1, $2, $3, $4);`, [ownerAId, devopsAId, viewerAId, ownerBId]);
    await closeRedis();
  });

  test('1. POST /:agentId/disconnect: DevOps disconnects Agent 1 (transitions OFFLINE, revokes token)', async () => {
    const res = await fetch(`${baseUrl}/api/v1/organizations/${orgAId}/agents/${agent1Id}/disconnect`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${devopsAToken}`,
      },
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.id, agent1Id);
    assert.strictEqual(body.data.status, 'OFFLINE');

    // Verify database: Agent status is OFFLINE
    const agRes = await pool.query(`SELECT status FROM agents WHERE id = $1`, [agent1Id]);
    assert.strictEqual(agRes.rows[0].status, 'OFFLINE');

    // Verify database: All active tokens for Agent 1 are revoked
    const tokRes = await pool.query(`SELECT revoked_at FROM agent_tokens WHERE id = $1`, [token1Id]);
    assert.ok(tokRes.rows[0].revoked_at, 'Token 1 must be marked as revoked');

    // Verify audit log recorded
    const auditRes = await pool.query(
      `SELECT * FROM audit_logs WHERE resource_id = $1 AND action = 'AGENT_DISCONNECTED' ORDER BY created_at DESC LIMIT 1`,
      [agent1Id]
    );
    assert.strictEqual(auditRes.rows.length, 1);
    assert.strictEqual(auditRes.rows[0].reason_code, 'USER_DISCONNECTED');
    assert.strictEqual(auditRes.rows[0].organization_id, orgAId);
  });

  test('2. Stale/late heartbeat attempt after disconnect: Rejected with 401 Unauthorized', async () => {
    const res = await fetch(`${baseUrl}/api/v1/agents/heartbeat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-agent-token': rawToken1,
      },
      body: JSON.stringify({ latency_ms: 10 }),
    });

    assert.strictEqual(res.status, 401);
    const body = await res.json();
    assert.strictEqual(body.success, false);

    // Verify Agent remains OFFLINE
    const agRes = await pool.query(`SELECT status FROM agents WHERE id = $1`, [agent1Id]);
    assert.strictEqual(agRes.rows[0].status, 'OFFLINE');
  });

  test('3. Idempotency: Disconnecting an already OFFLINE agent succeeds safely', async () => {
    const res = await fetch(`${baseUrl}/api/v1/organizations/${orgAId}/agents/${agent1Id}/disconnect`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${devopsAToken}`,
      },
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.status, 'OFFLINE');
  });

  test('4. Cannot disconnect already REVOKED agent: Returns 400 Bad Request', async () => {
    const res = await fetch(`${baseUrl}/api/v1/organizations/${orgAId}/agents/${agent3RevokedId}/disconnect`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${devopsAToken}`,
      },
    });

    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.ok(body.message.includes('REVOKED'));
  });

  test('5. Non-existent agent disconnect: Returns 404 Not Found', async () => {
    const bogusId = 'e7000000-0000-0000-0000-000000000099';
    const res = await fetch(`${baseUrl}/api/v1/organizations/${orgAId}/agents/${bogusId}/disconnect`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${devopsAToken}`,
      },
    });

    assert.strictEqual(res.status, 404);
  });

  test('6. Tenant Isolation - Disconnect: Org B cannot disconnect Org A agent', async () => {
    // Org B member attempting to disconnect Agent 1 via Org B path
    const crossRes1 = await fetch(`${baseUrl}/api/v1/organizations/${orgBId}/agents/${agent1Id}/disconnect`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerBToken}` },
    });
    assert.strictEqual(crossRes1.status, 404);

    // Org B member attempting to disconnect Agent 1 via Org A path
    const crossRes2 = await fetch(`${baseUrl}/api/v1/organizations/${orgAId}/agents/${agent1Id}/disconnect`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerBToken}` },
    });
    assert.strictEqual(crossRes2.status, 403);
  });

  test('7. RBAC Enforcement - Disconnect: Viewer cannot disconnect (403), Owner can disconnect (200)', async () => {
    // Viewer: forbidden
    const viewRes = await fetch(`${baseUrl}/api/v1/organizations/${orgAId}/agents/${agent2Id}/disconnect`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${viewerAToken}` },
    });
    assert.strictEqual(viewRes.status, 403);

    // Owner: allowed
    const ownerRes = await fetch(`${baseUrl}/api/v1/organizations/${orgAId}/agents/${agent2Id}/disconnect`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerAToken}` },
    });
    assert.strictEqual(ownerRes.status, 200);
    const body = await ownerRes.json();
    assert.strictEqual(body.data.status, 'OFFLINE');
  });

  test('8. Delete Protection for ONLINE Agent: Deleting ONLINE agent without force returns 400', async () => {
    // Agent 4 is currently ONLINE
    const res = await fetch(`${baseUrl}/api/v1/organizations/${orgAId}/agents/${agent4OnlineId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${ownerAToken}` },
    });

    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.ok(body.message.includes('ONLINE'));

    // Verify Agent 4 is still in database and stays ONLINE
    const agRes = await pool.query(`SELECT status FROM agents WHERE id = $1`, [agent4OnlineId]);
    assert.strictEqual(agRes.rows.length, 1);
    assert.strictEqual(agRes.rows[0].status, 'ONLINE');
  });

  test('9. RBAC Enforcement - Delete: DevOps and Viewer cannot delete Agent (403), only SME_OWNER', async () => {
    // DevOps: forbidden
    const devopsRes = await fetch(`${baseUrl}/api/v1/organizations/${orgAId}/agents/${agent4OnlineId}?force=true`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${devopsAToken}` },
    });
    assert.strictEqual(devopsRes.status, 403);

    // Viewer: forbidden
    const viewerRes = await fetch(`${baseUrl}/api/v1/organizations/${orgAId}/agents/${agent4OnlineId}?force=true`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${viewerAToken}` },
    });
    assert.strictEqual(viewerRes.status, 403);
  });

  test('10. Tenant Isolation - Delete: Org B cannot delete Org A agent', async () => {
    // Org B path
    const crossRes1 = await fetch(`${baseUrl}/api/v1/organizations/${orgBId}/agents/${agent4OnlineId}?force=true`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${ownerBToken}` },
    });
    assert.strictEqual(crossRes1.status, 404);

    // Org A path
    const crossRes2 = await fetch(`${baseUrl}/api/v1/organizations/${orgAId}/agents/${agent4OnlineId}?force=true`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${ownerBToken}` },
    });
    assert.strictEqual(crossRes2.status, 403);
  });

  test('11. Safe Delete with force=true: Owner deletes ONLINE agent with force flag', async () => {
    const res = await fetch(`${baseUrl}/api/v1/organizations/${orgAId}/agents/${agent4OnlineId}?force=true`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${ownerAToken}` },
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);

    // Database verification: Agent 4 is removed
    const agRes = await pool.query(`SELECT * FROM agents WHERE id = $1`, [agent4OnlineId]);
    assert.strictEqual(agRes.rows.length, 0);

    // Verify audit log recorded
    const auditRes = await pool.query(
      `SELECT * FROM audit_logs WHERE resource_id = $1 AND action = 'AGENT_DELETED' ORDER BY created_at DESC LIMIT 1`,
      [agent4OnlineId]
    );
    assert.strictEqual(auditRes.rows.length, 1);
    assert.strictEqual(auditRes.rows[0].organization_id, orgAId);
  });

  test('12. Deleted Agent cannot send heartbeat (token returns 401)', async () => {
    const res = await fetch(`${baseUrl}/api/v1/agents/heartbeat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-agent-token': rawToken4,
      },
      body: JSON.stringify({ latency_ms: 10 }),
    });

    assert.strictEqual(res.status, 401);
  });

  test('13. Safe Delete for OFFLINE Agent without force flag: Succeeds directly', async () => {
    // Agent 1 is already OFFLINE
    const res = await fetch(`${baseUrl}/api/v1/organizations/${orgAId}/agents/${agent1Id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${ownerAToken}` },
    });

    assert.strictEqual(res.status, 200);
    const agRes = await pool.query(`SELECT * FROM agents WHERE id = $1`, [agent1Id]);
    assert.strictEqual(agRes.rows.length, 0);

    const auditRes = await pool.query(
      `SELECT * FROM audit_logs WHERE resource_id = $1 AND action = 'AGENT_DELETED' ORDER BY created_at DESC LIMIT 1`,
      [agent1Id]
    );
    assert.strictEqual(auditRes.rows.length, 1);
  });

  test('14. Cluster Disconnect Route parity: POST /clusters/:clusterId/disconnect-agent', async () => {
    // Put Agent 2 ONLINE
    await pool.query(`UPDATE agents SET status = 'ONLINE', last_seen_at = NOW() WHERE id = $1`, [agent2Id]);

    const res = await fetch(`${baseUrl}/api/v1/organizations/${orgAId}/clusters/${clusterA2Id}/disconnect-agent`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${devopsAToken}` },
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);

    const agRes = await pool.query(`SELECT status FROM agents WHERE id = $1`, [agent2Id]);
    assert.strictEqual(agRes.rows[0].status, 'OFFLINE');
  });

  test('15. Zero Credential Leakage: Audit logs never store raw tokens or sensitive headers', async () => {
    const auditRes = await pool.query(`SELECT * FROM audit_logs WHERE organization_id = $1`, [orgAId]);
    for (const log of auditRes.rows) {
      const serialized = JSON.stringify(log);
      assert.strictEqual(serialized.includes(rawToken1), false, 'Raw token 1 must not be in audit logs');
      assert.strictEqual(serialized.includes(rawToken2), false, 'Raw token 2 must not be in audit logs');
      assert.strictEqual(serialized.includes(rawToken4), false, 'Raw token 4 must not be in audit logs');
    }
  });
});
