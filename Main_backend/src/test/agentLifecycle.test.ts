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

describe('Agent Enrollment, Token Lifecycle & Heartbeat Test Suite [PB09 5.3]', () => {
  let server: http.Server;
  let baseUrl: string;

  const ownerAId = 'a3000000-0000-0000-0000-000000000001';
  const devopsAId = 'a3000000-0000-0000-0000-000000000002';
  const viewerAId = 'a3000000-0000-0000-0000-000000000003';
  const ownerBId = 'a3000000-0000-0000-0000-000000000004';

  const orgAId = 'b3000000-0000-0000-0000-000000000001';
  const orgBId = 'b3000000-0000-0000-0000-000000000002';

  const envAId = 'c3000000-0000-0000-0000-000000000001';
  const envBId = 'c3000000-0000-0000-0000-000000000002';

  const clusterAId = 'd3000000-0000-0000-0000-000000000001';
  const clusterBId = 'd3000000-0000-0000-0000-000000000002';

  const agentBId = 'e3000000-0000-0000-0000-000000000002';
  const tokenBId = 'f3000000-0000-0000-0000-000000000002';

  let ownerAToken: string;
  let devopsAToken: string;
  let viewerAToken: string;
  let ownerBToken: string;

  let createdAgentId: string;
  let initialRawToken: string;
  let initialTokenId: string;
  let rotatedRawToken: string;
  let rotatedTokenId: string;

  before(async () => {
    await testRedisConnection();

    // 1. Ensure roles exist
    const rolesRes = await pool.query(`SELECT id, code FROM roles WHERE scope = 'ORGANIZATION'`);
    const smeOwnerRoleId = rolesRes.rows.find((r) => r.code === 'SME_OWNER')?.id;
    const devopsRoleId = rolesRes.rows.find((r) => r.code === 'DEVOPS')?.id;
    const viewerRoleId = rolesRes.rows.find((r) => r.code === 'VIEWER')?.id;

    // 2. Insert test users
    await pool.query(
      `INSERT INTO users (id, email, password_hash, full_name, status, created_at, updated_at)
       VALUES 
         ($1, 'owner.a.agent@test.com', 'dummy_hash', 'Owner A Agent', 'ACTIVE', NOW(), NOW()),
         ($2, 'devops.a.agent@test.com', 'dummy_hash', 'DevOps A Agent', 'ACTIVE', NOW(), NOW()),
         ($3, 'viewer.a.agent@test.com', 'dummy_hash', 'Viewer A Agent', 'ACTIVE', NOW(), NOW()),
         ($4, 'owner.b.agent@test.com', 'dummy_hash', 'Owner B Agent', 'ACTIVE', NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET status = 'ACTIVE', deleted_at = NULL;`,
      [ownerAId, devopsAId, viewerAId, ownerBId]
    );

    // 3. Insert test organizations
    await pool.query(
      `INSERT INTO organizations (id, name, slug, status, created_by, created_at, updated_at)
       VALUES 
         ($1, 'Agent Org Alpha', 'agent-org-alpha', 'ACTIVE', $2, NOW(), NOW()),
         ($3, 'Agent Org Beta', 'agent-org-beta', 'ACTIVE', $4, NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET status = 'ACTIVE', deleted_at = NULL;`,
      [orgAId, ownerAId, orgBId, ownerBId]
    );

    // 4. Associate members
    await pool.query(
      `INSERT INTO organization_members (organization_id, user_id, role_id, status, joined_at)
       VALUES 
         ($1, $2, $3, 'ACTIVE', NOW()),
         ($1, $4, $5, 'ACTIVE', NOW()),
         ($1, $6, $7, 'ACTIVE', NOW()),
         ($8, $9, $3, 'ACTIVE', NOW())
       ON CONFLICT (organization_id, user_id) 
       DO UPDATE SET role_id = EXCLUDED.role_id, status = 'ACTIVE';`,
      [orgAId, ownerAId, smeOwnerRoleId, devopsAId, devopsRoleId, viewerAId, viewerRoleId, orgBId, ownerBId]
    );

    // 5. Insert environments
    await pool.query(
      `INSERT INTO environments (id, organization_id, name, code, environment_type, created_by, created_at, updated_at)
       VALUES 
         ($1, $2, 'Env Agent Alpha', 'agent-alpha-dev', 'DEVELOPMENT', $3, NOW(), NOW()),
         ($4, $5, 'Env Agent Beta', 'agent-beta-dev', 'DEVELOPMENT', $6, NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET organization_id = EXCLUDED.organization_id, deleted_at = NULL;`,
      [envAId, orgAId, ownerAId, envBId, orgBId, ownerBId]
    );

    // 6. Insert clusters
    await pool.query(
      `INSERT INTO clusters (id, environment_id, name, provider, status, created_at, updated_at)
       VALUES 
         ($1, $2, 'k8s-agent-cluster-a', 'MINIKUBE', 'CONNECTED', NOW(), NOW()),
         ($3, $4, 'k8s-agent-cluster-b', 'MINIKUBE', 'CONNECTED', NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET environment_id = EXCLUDED.environment_id, deleted_at = NULL;`,
      [clusterAId, envAId, clusterBId, envBId]
    );

    // 7. Seed Org B's agent and token for cross-tenant IDOR tests
    await pool.query(
      `INSERT INTO agents (id, agent_uid, cluster_id, environment_id, name, status, created_at, updated_at)
       VALUES ($1, 'uid-agent-b', $2, $3, 'agent-tenant-b', 'ONLINE', NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET cluster_id = EXCLUDED.cluster_id;`,
      [agentBId, clusterBId, envBId]
    );

    await pool.query(
      `INSERT INTO agent_tokens (id, agent_id, token_hash, token_prefix, created_at)
       VALUES ($1, $2, 'hash_token_b_tenant', 'sh_live_sec_tenantb', NOW())
       ON CONFLICT (id) DO NOTHING;`,
      [tokenBId, agentBId]
    );

    // 8. Generate JWTs
    ownerAToken = jwt.sign(
      { id: ownerAId, email: 'owner.a.agent@test.com', status: 'ACTIVE', roles: ['USER'] },
      config.jwt.secret,
      { expiresIn: '1h', algorithm: 'HS256' }
    );

    devopsAToken = jwt.sign(
      { id: devopsAId, email: 'devops.a.agent@test.com', status: 'ACTIVE', roles: ['USER'] },
      config.jwt.secret,
      { expiresIn: '1h', algorithm: 'HS256' }
    );

    viewerAToken = jwt.sign(
      { id: viewerAId, email: 'viewer.a.agent@test.com', status: 'ACTIVE', roles: ['USER'] },
      config.jwt.secret,
      { expiresIn: '1h', algorithm: 'HS256' }
    );

    ownerBToken = jwt.sign(
      { id: ownerBId, email: 'owner.b.agent@test.com', status: 'ACTIVE', roles: ['USER'] },
      config.jwt.secret,
      { expiresIn: '1h', algorithm: 'HS256' }
    );

    // 9. Start test HTTP server
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

    if (createdAgentId) {
      await pool.query(`DELETE FROM agent_heartbeats WHERE agent_id = $1;`, [createdAgentId]);
      await pool.query(`DELETE FROM agent_tokens WHERE agent_id = $1;`, [createdAgentId]);
      await pool.query(`DELETE FROM agents WHERE id = $1;`, [createdAgentId]);
    }

    await pool.query(`DELETE FROM agent_tokens WHERE id = $1;`, [tokenBId]);
    await pool.query(`DELETE FROM agents WHERE id = $1;`, [agentBId]);
    await pool.query(`DELETE FROM clusters WHERE id IN ($1, $2);`, [clusterAId, clusterBId]);
    await pool.query(`DELETE FROM environments WHERE id IN ($1, $2);`, [envAId, envBId]);
    await pool.query(`DELETE FROM organization_members WHERE organization_id IN ($1, $2);`, [orgAId, orgBId]);
    await pool.query(`DELETE FROM organizations WHERE id IN ($1, $2);`, [orgAId, orgBId]);
    await pool.query(`DELETE FROM users WHERE id IN ($1, $2, $3, $4);`, [
      ownerAId,
      devopsAId,
      viewerAId,
      ownerBId,
    ]);

    await closeRedis();
  });

  test('1. Create agent with initial token & verify prefix is stored and raw hash hidden', async () => {
    const res = await fetch(`${baseUrl}/api/v1/organizations/${orgAId}/agents`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerAToken}`,
      },
      body: JSON.stringify({
        name: 'K8s Edge Daemon Alpha',
        environment_id: envAId,
        cluster_id: clusterAId,
        version: 'v1.0.0',
        token_expires_in_days: 90,
      }),
    });

    assert.strictEqual(res.status, 201);
    const body: any = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(body.data.agent.id);
    assert.strictEqual(body.data.agent.name, 'K8s Edge Daemon Alpha');
    assert.strictEqual(body.data.agent.status, 'PENDING');
    assert.ok(body.data.token, 'Must return token object');
    assert.ok(body.data.token.raw_token, 'Must return plaintext token on initial creation');
    assert.ok(body.data.token.token_prefix, 'Must return token_prefix in response');
    assert.ok(body.data.token.raw_token.startsWith(body.data.token.token_prefix), 'Prefix must match initial token characters');

    createdAgentId = body.data.agent.id;
    initialRawToken = body.data.token.raw_token;

    // Verify database record
    const dbTokenRes = await pool.query(
      `SELECT id, token_hash, token_prefix, created_by, revoked_at FROM agent_tokens WHERE agent_id = $1;`,
      [createdAgentId]
    );
    assert.strictEqual(dbTokenRes.rows.length, 1);
    const dbToken = dbTokenRes.rows[0];
    initialTokenId = dbToken.id;

    assert.strictEqual(dbToken.token_prefix, body.data.token.token_prefix);
    assert.strictEqual(dbToken.created_by, ownerAId);
    assert.strictEqual(dbToken.revoked_at, null);
    // Token hash must be a 64-char SHA-256 hex string, not plaintext
    assert.strictEqual(dbToken.token_hash.length, 64);
    assert.notStrictEqual(dbToken.token_hash, initialRawToken);
  });

  test('2. List agents filtered by org and status', async () => {
    const res = await fetch(`${baseUrl}/api/v1/organizations/${orgAId}/agents?status=PENDING`, {
      headers: { Authorization: `Bearer ${devopsAToken}` },
    });
    assert.strictEqual(res.status, 200);
    const body: any = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(Array.isArray(body.data.items));
    const found = body.data.items.find((a: any) => a.id === createdAgentId);
    assert.ok(found);
    assert.strictEqual(found.status, 'PENDING');

    // Filter status=ONLINE should not include our pending agent
    const resOnline = await fetch(`${baseUrl}/api/v1/organizations/${orgAId}/agents?status=ONLINE`, {
      headers: { Authorization: `Bearer ${devopsAToken}` },
    });
    const bodyOnline: any = await resOnline.json();
    assert.strictEqual(bodyOnline.data.items.some((a: any) => a.id === createdAgentId), false);
  });

  test('3. Get agent detail with tokens and heartbeats', async () => {
    const res = await fetch(`${baseUrl}/api/v1/organizations/${orgAId}/agents/${createdAgentId}`, {
      headers: { Authorization: `Bearer ${ownerAToken}` },
    });
    assert.strictEqual(res.status, 200);
    const body: any = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.id, createdAgentId);
    assert.ok(Array.isArray(body.data.tokens));
    assert.strictEqual(body.data.tokens.length, 1);
    // Must contain token_prefix and id, must NOT expose token_hash
    assert.ok(body.data.tokens[0].token_prefix);
    assert.strictEqual(body.data.tokens[0].token_hash, undefined);
  });

  test('4. Update agent configuration', async () => {
    const res = await fetch(`${baseUrl}/api/v1/organizations/${orgAId}/agents/${createdAgentId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${devopsAToken}`,
      },
      body: JSON.stringify({
        name: 'K8s Edge Daemon Alpha - Renamed',
        version: 'v1.1.0',
      }),
    });
    assert.strictEqual(res.status, 200);
    const body: any = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.name, 'K8s Edge Daemon Alpha - Renamed');
    assert.strictEqual(body.data.version, 'v1.1.0');
  });

  test('5. Rotate / create new token for agent with prefix', async () => {
    const res = await fetch(`${baseUrl}/api/v1/organizations/${orgAId}/agents/${createdAgentId}/tokens`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerAToken}`,
      },
      body: JSON.stringify({
        expires_in_days: 30,
      }),
    });
    assert.strictEqual(res.status, 201);
    const body: any = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(body.data.raw_token, 'Must return new plaintext token');
    assert.ok(body.data.token_prefix, 'Must return token_prefix');
    assert.ok(body.data.raw_token.startsWith(body.data.token_prefix));

    rotatedRawToken = body.data.raw_token;
    rotatedTokenId = body.data.token_id;

    // Verify DB has 2 active tokens with token_prefix populated
    const dbTokens = await pool.query(
      `SELECT id, token_prefix, created_by, revoked_at FROM agent_tokens WHERE agent_id = $1 AND revoked_at IS NULL ORDER BY created_at ASC;`,
      [createdAgentId]
    );
    assert.strictEqual(dbTokens.rows.length, 2);
    assert.ok(dbTokens.rows.every((t) => t.token_prefix !== null && t.token_prefix.length > 0));
  });

  test('6. Authenticated daemon sends heartbeat with x-agent-token', async () => {
    const res = await fetch(`${baseUrl}/api/v1/agents/heartbeat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-agent-token': initialRawToken,
      },
      body: JSON.stringify({
        latency_ms: 12,
        agent_version: 'v1.1.0',
        status: 'ONLINE',
        metadata: {
          k8s_node: 'node-control-plane',
          arch: 'amd64',
        },
      }),
    });

    assert.strictEqual(res.status, 200);
    const body: any = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.status, 'ONLINE');

    // Check DB: agent status is ONLINE and token last_used_at is updated
    const agentCheck = await pool.query(`SELECT status, last_seen_at FROM agents WHERE id = $1;`, [createdAgentId]);
    assert.strictEqual(agentCheck.rows[0].status, 'ONLINE');
    assert.ok(agentCheck.rows[0].last_seen_at);

    const tokenCheck = await pool.query(`SELECT last_used_at FROM agent_tokens WHERE id = $1;`, [initialTokenId]);
    assert.ok(tokenCheck.rows[0].last_used_at, 'Token last_used_at must be populated after heartbeat');
  });

  test('7. Daemon sends heartbeat with Authorization: Bearer <token>', async () => {
    const res = await fetch(`${baseUrl}/api/v1/agents/heartbeat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${rotatedRawToken}`,
      },
      body: JSON.stringify({
        latency_ms: 25,
        status: 'ONLINE',
      }),
    });

    assert.strictEqual(res.status, 200);
    const body: any = await res.json();
    assert.strictEqual(body.success, true);

    const tokenCheck = await pool.query(`SELECT last_used_at FROM agent_tokens WHERE id = $1;`, [rotatedTokenId]);
    assert.ok(tokenCheck.rows[0].last_used_at, 'Rotated token last_used_at must be populated');
  });

  test('8. Revoke specific token via DELETE, verify it returns 401 on heartbeat', async () => {
    // Revoke rotated token
    const delRes = await fetch(
      `${baseUrl}/api/v1/organizations/${orgAId}/agents/${createdAgentId}/tokens/${rotatedTokenId}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${devopsAToken}` },
      }
    );
    assert.strictEqual(delRes.status, 200);

    // Heartbeat using revoked token must fail with 401
    const heartbeatRevoked = await fetch(`${baseUrl}/api/v1/agents/heartbeat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-agent-token': rotatedRawToken,
      },
      body: JSON.stringify({ latency_ms: 20 }),
    });
    assert.strictEqual(heartbeatRevoked.status, 401);

    // Initial token is still active and should succeed
    const heartbeatInitial = await fetch(`${baseUrl}/api/v1/agents/heartbeat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-agent-token': initialRawToken,
      },
      body: JSON.stringify({ latency_ms: 18 }),
    });
    assert.strictEqual(heartbeatInitial.status, 200);
  });

  test('9. Revoke entire agent via POST /revoke, verify status = REVOKED and all tokens revoked', async () => {
    const revokeRes = await fetch(`${baseUrl}/api/v1/organizations/${orgAId}/agents/${createdAgentId}/revoke`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerAToken}` },
    });
    assert.strictEqual(revokeRes.status, 200);
    const body: any = await revokeRes.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.status, 'REVOKED');

    // Verify all tokens for this agent in DB have revoked_at NOT NULL
    const tokensRes = await pool.query(
      `SELECT id, revoked_at FROM agent_tokens WHERE agent_id = $1 AND revoked_at IS NULL;`,
      [createdAgentId]
    );
    assert.strictEqual(tokensRes.rows.length, 0, 'No active tokens should remain after agent revocation');
  });

  test('10. Revoked agent cannot be revived by sending heartbeat (returns 401)', async () => {
    const heartbeatRes = await fetch(`${baseUrl}/api/v1/agents/heartbeat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-agent-token': initialRawToken,
      },
      body: JSON.stringify({ latency_ms: 10, status: 'ONLINE' }),
    });
    assert.strictEqual(heartbeatRes.status, 401);

    // Agent in DB should remain REVOKED
    const agentCheck = await pool.query(`SELECT status FROM agents WHERE id = $1;`, [createdAgentId]);
    assert.strictEqual(agentCheck.rows[0].status, 'REVOKED');
  });

  test('11. Tenant isolation: Org A user cannot access or manipulate Org B agents (IDOR Prevention)', async () => {
    // 11.1 Cannot list Org B agents directly (403 Forbidden)
    const listRes = await fetch(`${baseUrl}/api/v1/organizations/${orgBId}/agents`, {
      headers: { Authorization: `Bearer ${ownerAToken}` },
    });
    assert.strictEqual(listRes.status, 403);

    // 11.2 Cannot query Org B's agent under Org A URL (404 Not Found)
    const getRes = await fetch(`${baseUrl}/api/v1/organizations/${orgAId}/agents/${agentBId}`, {
      headers: { Authorization: `Bearer ${ownerAToken}` },
    });
    assert.strictEqual(getRes.status, 404);

    // 11.3 Cannot create token for Org B agent under Org A URL (404 Not Found)
    const createTokenRes = await fetch(`${baseUrl}/api/v1/organizations/${orgAId}/agents/${agentBId}/tokens`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerAToken}`,
      },
      body: JSON.stringify({ expires_in_days: 7 }),
    });
    assert.strictEqual(createTokenRes.status, 404);

    // 11.4 Cannot revoke Org B agent under Org A URL (404 Not Found)
    const revokeAgentRes = await fetch(`${baseUrl}/api/v1/organizations/${orgAId}/agents/${agentBId}/revoke`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerAToken}` },
    });
    assert.strictEqual(revokeAgentRes.status, 404);
  });

  test('12. RBAC: Viewer role cannot create agent, rotate token, or revoke token (Returns 403)', async () => {
    // Viewer can view agent list
    const getAgentsRes = await fetch(`${baseUrl}/api/v1/organizations/${orgAId}/agents`, {
      headers: { Authorization: `Bearer ${viewerAToken}` },
    });
    assert.strictEqual(getAgentsRes.status, 200);

    // Viewer cannot create agent
    const createRes = await fetch(`${baseUrl}/api/v1/organizations/${orgAId}/agents`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${viewerAToken}`,
      },
      body: JSON.stringify({
        name: 'Malicious Viewer Agent',
        environment_id: envAId,
      }),
    });
    assert.strictEqual(createRes.status, 403);

    // Viewer cannot create token
    const tokenRes = await fetch(`${baseUrl}/api/v1/organizations/${orgAId}/agents/${createdAgentId}/tokens`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${viewerAToken}`,
      },
      body: JSON.stringify({ expires_in_days: 7 }),
    });
    assert.strictEqual(tokenRes.status, 403);

    // Viewer cannot revoke token
    const revokeTokenRes = await fetch(
      `${baseUrl}/api/v1/organizations/${orgAId}/agents/${createdAgentId}/tokens/${initialTokenId}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${viewerAToken}` },
      }
    );
    assert.strictEqual(revokeTokenRes.status, 403);
  });

  test('13. Heartbeat with expired token returns 401 Unauthorized', async () => {
    // Insert an active agent in Org A with an expired token
    const expAgentId = 'e3000000-0000-0000-0000-000000000099';
    const expTokenId = 'f3000000-0000-0000-0000-000000000099';
    const expiredRaw = 'ag_live_expired_raw_secret_token_123456';
    const expiredHash = crypto.createHash('sha256').update(expiredRaw).digest('hex');

    await pool.query(
      `INSERT INTO agents (id, agent_uid, cluster_id, environment_id, name, status, created_at, updated_at)
       VALUES ($1, 'uid-expired-test', $2, $3, 'agent-expired', 'ONLINE', NOW(), NOW())
       ON CONFLICT (id) DO NOTHING;`,
      [expAgentId, clusterAId, envAId]
    );

    await pool.query(
      `INSERT INTO agent_tokens (id, agent_id, token_hash, token_prefix, expires_at, created_at)
       VALUES ($1, $2, $3, 'ag_live_expired', NOW() - INTERVAL '1 day', NOW() - INTERVAL '10 days')
       ON CONFLICT (id) DO NOTHING;`,
      [expTokenId, expAgentId, expiredHash]
    );

    const res = await fetch(`${baseUrl}/api/v1/agents/heartbeat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-agent-token': expiredRaw,
      },
      body: JSON.stringify({ latency_ms: 10 }),
    });

    assert.strictEqual(res.status, 401);

    // Cleanup expired test agent
    await pool.query(`DELETE FROM agent_tokens WHERE id = $1;`, [expTokenId]);
    await pool.query(`DELETE FROM agents WHERE id = $1;`, [expAgentId]);
  });

  test('14. Heartbeat with invalid, malformed or missing token returns 401 Unauthorized', async () => {
    // 14.1 Missing header entirely
    const resNoToken = await fetch(`${baseUrl}/api/v1/agents/heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ latency_ms: 10 }),
    });
    assert.strictEqual(resNoToken.status, 401);

    // 14.2 Completely invalid token string
    const resBadToken = await fetch(`${baseUrl}/api/v1/agents/heartbeat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-agent-token': 'non_existent_token_value_xyz',
      },
      body: JSON.stringify({ latency_ms: 10 }),
    });
    assert.strictEqual(resBadToken.status, 401);

    // 14.3 Malformed Bearer header
    const resEmptyBearer = await fetch(`${baseUrl}/api/v1/agents/heartbeat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ',
      },
      body: JSON.stringify({ latency_ms: 10 }),
    });
    assert.strictEqual(resEmptyBearer.status, 401);
  });

  test('15. Invalid payload handling (negative latency or invalid status)', async () => {
    // Insert a valid agent and token to test payload validation through authenticated middleware
    const validAgentId = 'e3000000-0000-0000-0000-000000000055';
    const validTokenId = 'f3000000-0000-0000-0000-000000000055';
    const validRaw = 'ag_live_payload_valid_token_1234567890';
    const validHash = crypto.createHash('sha256').update(validRaw).digest('hex');

    await pool.query(
      `INSERT INTO agents (id, agent_uid, cluster_id, environment_id, name, status, created_at, updated_at)
       VALUES ($1, 'uid-valid-payload', $2, $3, 'agent-payload', 'ONLINE', NOW(), NOW())
       ON CONFLICT (id) DO NOTHING;`,
      [validAgentId, clusterAId, envAId]
    );

    await pool.query(
      `INSERT INTO agent_tokens (id, agent_id, token_hash, token_prefix, created_at)
       VALUES ($1, $2, $3, 'ag_live_payl', NOW())
       ON CONFLICT (id) DO NOTHING;`,
      [validTokenId, validAgentId, validHash]
    );

    // Negative latency
    const resNegativeLatency = await fetch(`${baseUrl}/api/v1/agents/heartbeat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-agent-token': validRaw,
      },
      body: JSON.stringify({ latency_ms: -50 }),
    });
    assert.strictEqual(resNegativeLatency.status, 400);

    // Invalid status string
    const resInvalidStatus = await fetch(`${baseUrl}/api/v1/agents/heartbeat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-agent-token': validRaw,
      },
      body: JSON.stringify({ status: 'HACKED_STATUS' }),
    });
    assert.strictEqual(resInvalidStatus.status, 400);

    await pool.query(`DELETE FROM agent_tokens WHERE id = $1;`, [validTokenId]);
    await pool.query(`DELETE FROM agents WHERE id = $1;`, [validAgentId]);
  });
});
