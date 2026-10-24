import test, { describe, before, after } from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import crypto from 'node:crypto';
import { AddressInfo } from 'node:net';
import app from '../app';
import { pool } from '../config/database';
import { testRedisConnection, closeRedis } from '../config/redis';

describe('Agent Token Authentication & Identity Security Suite [PB10 1.2]', () => {
  let server: http.Server;
  let baseUrl: string;

  const orgAId = 'b4000000-0000-0000-0000-000000000001';
  const orgBId = 'b4000000-0000-0000-0000-000000000002';

  const envAId = 'c4000000-0000-0000-0000-000000000001';
  const envBId = 'c4000000-0000-0000-0000-000000000002';

  const clusterAId = 'd4000000-0000-0000-0000-000000000001';
  const clusterBId = 'd4000000-0000-0000-0000-000000000002';

  const agentAId = 'e4000000-0000-0000-0000-000000000001';
  const agentBId = 'e4000000-0000-0000-0000-000000000002';
  const agentRevokedId = 'e4000000-0000-0000-0000-000000000003';

  const tokenAId = 'f4000000-0000-0000-0000-000000000001';
  const tokenBearerId = 'f4000000-0000-0000-0000-000000000002';
  const tokenExpiredId = 'f4000000-0000-0000-0000-000000000003';
  const tokenRevokedId = 'f4000000-0000-0000-0000-000000000004';
  const tokenForRevokedAgentId = 'f4000000-0000-0000-0000-000000000005';

  const rawTokenA = 'ag_live_auth_test_token_alpha_secret_123';
  const rawTokenBearer = 'ag_live_auth_test_token_bearer_secret_456';
  const rawTokenExpired = 'ag_live_auth_test_token_expired_secret_789';
  const rawTokenRevoked = 'ag_live_auth_test_token_revoked_secret_012';
  const rawTokenForRevokedAgent = 'ag_live_auth_test_token_agentrev_345';

  before(async () => {
    await testRedisConnection();

    // 1. Seed Organizations
    await pool.query(
      `INSERT INTO organizations (id, name, slug, status, created_at, updated_at)
       VALUES 
         ($1, 'Auth Test Org Alpha', 'auth-org-alpha', 'ACTIVE', NOW(), NOW()),
         ($2, 'Auth Test Org Beta', 'auth-org-beta', 'ACTIVE', NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET status = 'ACTIVE', deleted_at = NULL;`,
      [orgAId, orgBId]
    );

    // 2. Seed Environments
    await pool.query(
      `INSERT INTO environments (id, organization_id, name, code, environment_type, created_at, updated_at)
       VALUES 
         ($1, $2, 'Env Auth Alpha', 'auth-alpha-dev', 'DEVELOPMENT', NOW(), NOW()),
         ($3, $4, 'Env Auth Beta', 'auth-beta-dev', 'DEVELOPMENT', NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET organization_id = EXCLUDED.organization_id, deleted_at = NULL;`,
      [envAId, orgAId, envBId, orgBId]
    );

    // 3. Seed Clusters
    await pool.query(
      `INSERT INTO clusters (id, environment_id, name, provider, status, created_at, updated_at)
       VALUES 
         ($1, $2, 'k8s-auth-cluster-a', 'MINIKUBE', 'CONNECTED', NOW(), NOW()),
         ($3, $4, 'k8s-auth-cluster-b', 'MINIKUBE', 'CONNECTED', NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET environment_id = EXCLUDED.environment_id, deleted_at = NULL;`,
      [clusterAId, envAId, clusterBId, envBId]
    );

    // 4. Seed Agents
    await pool.query(
      `INSERT INTO agents (id, agent_uid, cluster_id, environment_id, name, status, created_at, updated_at)
       VALUES 
         ($1, 'uid-auth-agent-a', $2, $3, 'Agent Auth Alpha', 'PENDING', NOW(), NOW()),
         ($4, 'uid-auth-agent-b', $5, $6, 'Agent Auth Beta', 'ONLINE', NOW(), NOW()),
         ($7, 'uid-auth-agent-revoked', $2, $3, 'Agent Auth Revoked', 'REVOKED', NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, cluster_id = EXCLUDED.cluster_id;`,
      [agentAId, clusterAId, envAId, agentBId, clusterBId, envBId, agentRevokedId]
    );

    // 5. Seed Agent Tokens
    const hashA = crypto.createHash('sha256').update(rawTokenA).digest('hex');
    const hashBearer = crypto.createHash('sha256').update(rawTokenBearer).digest('hex');
    const hashExpired = crypto.createHash('sha256').update(rawTokenExpired).digest('hex');
    const hashRevoked = crypto.createHash('sha256').update(rawTokenRevoked).digest('hex');
    const hashForRevokedAgent = crypto.createHash('sha256').update(rawTokenForRevokedAgent).digest('hex');

    await pool.query(
      `INSERT INTO agent_tokens (id, agent_id, token_hash, token_prefix, created_at)
       VALUES 
         ($1, $2, $3, 'ag_live_auth', NOW()),
         ($4, $2, $5, 'ag_live_auth', NOW())
       ON CONFLICT (id) DO NOTHING;`,
      [tokenAId, agentAId, hashA, tokenBearerId, hashBearer]
    );

    // Expired Token
    await pool.query(
      `INSERT INTO agent_tokens (id, agent_id, token_hash, token_prefix, expires_at, created_at)
       VALUES ($1, $2, $3, 'ag_live_auth', NOW() - INTERVAL '2 days', NOW() - INTERVAL '10 days')
       ON CONFLICT (id) DO NOTHING;`,
      [tokenExpiredId, agentAId, hashExpired]
    );

    // Revoked Token
    await pool.query(
      `INSERT INTO agent_tokens (id, agent_id, token_hash, token_prefix, revoked_at, created_at)
       VALUES ($1, $2, $3, 'ag_live_auth', NOW() - INTERVAL '1 hour', NOW() - INTERVAL '5 days')
       ON CONFLICT (id) DO NOTHING;`,
      [tokenRevokedId, agentAId, hashRevoked]
    );

    // Token for Revoked Agent
    await pool.query(
      `INSERT INTO agent_tokens (id, agent_id, token_hash, token_prefix, created_at)
       VALUES ($1, $2, $3, 'ag_live_auth', NOW())
       ON CONFLICT (id) DO NOTHING;`,
      [tokenForRevokedAgentId, agentRevokedId, hashForRevokedAgent]
    );

    // 6. Start server
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

    await pool.query(`DELETE FROM agent_heartbeats WHERE agent_id IN ($1, $2, $3);`, [agentAId, agentBId, agentRevokedId]);
    await pool.query(`DELETE FROM agent_tokens WHERE agent_id IN ($1, $2, $3);`, [agentAId, agentBId, agentRevokedId]);
    await pool.query(`DELETE FROM agents WHERE id IN ($1, $2, $3);`, [agentAId, agentBId, agentRevokedId]);
    await pool.query(`DELETE FROM clusters WHERE id IN ($1, $2);`, [clusterAId, clusterBId]);
    await pool.query(`DELETE FROM environments WHERE id IN ($1, $2);`, [envAId, envBId]);
    await pool.query(`DELETE FROM organizations WHERE id IN ($1, $2);`, [orgAId, orgBId]);

    await closeRedis();
  });

  test('1. Missing token header returns 401 Unauthorized', async () => {
    const res = await fetch(`${baseUrl}/api/v1/agents/heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ latency_ms: 10 }),
    });
    assert.strictEqual(res.status, 401);
    const body: any = await res.json();
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.message, 'Thiếu token xác thực Agent');
  });

  test('2. Empty / malformed Bearer authorization header returns 401 Unauthorized', async () => {
    const res = await fetch(`${baseUrl}/api/v1/agents/heartbeat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer   ',
      },
      body: JSON.stringify({ latency_ms: 10 }),
    });
    assert.strictEqual(res.status, 401);
    const body: any = await res.json();
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.message, 'Thiếu token xác thực Agent');
  });

  test('3. Non-existent / bogus agent token returns 401 Unauthorized', async () => {
    const res = await fetch(`${baseUrl}/api/v1/agents/heartbeat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-agent-token': 'ag_live_fake_token_completely_invalid_99999',
      },
      body: JSON.stringify({ latency_ms: 10 }),
    });
    assert.strictEqual(res.status, 401);
    const body: any = await res.json();
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.message, 'Token Agent không hợp lệ, đã hết hạn hoặc đã bị thu hồi');
  });

  test('4. Valid token with x-agent-token authenticates, binds req.agent and updates last_used_at', async () => {
    const res = await fetch(`${baseUrl}/api/v1/agents/heartbeat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-agent-token': rawTokenA,
      },
      body: JSON.stringify({
        latency_ms: 14,
        agent_version: 'v1.0.0',
        status: 'ONLINE',
        metadata: { node: 'worker-a' },
      }),
    });

    assert.strictEqual(res.status, 200);
    const body: any = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.agent_id, agentAId);
    assert.strictEqual(body.data.status, 'ONLINE');

    // Verify token last_used_at updated in database
    const tokenDb = await pool.query(`SELECT last_used_at FROM agent_tokens WHERE id = $1;`, [tokenAId]);
    assert.ok(tokenDb.rows[0].last_used_at);

    // Verify agent status updated to ONLINE
    const agentDb = await pool.query(`SELECT status, last_seen_at FROM agents WHERE id = $1;`, [agentAId]);
    assert.strictEqual(agentDb.rows[0].status, 'ONLINE');
    assert.ok(agentDb.rows[0].last_seen_at);
  });

  test('5. Valid token with Authorization: Bearer <token> authenticates successfully', async () => {
    const res = await fetch(`${baseUrl}/api/v1/agents/heartbeat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${rawTokenBearer}`,
      },
      body: JSON.stringify({ latency_ms: 22, status: 'ONLINE' }),
    });

    assert.strictEqual(res.status, 200);
    const body: any = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.agent_id, agentAId);
  });

  test('6. Expired token returns 401 Unauthorized', async () => {
    const res = await fetch(`${baseUrl}/api/v1/agents/heartbeat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-agent-token': rawTokenExpired,
      },
      body: JSON.stringify({ latency_ms: 10 }),
    });

    assert.strictEqual(res.status, 401);
    const body: any = await res.json();
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.message, 'Token Agent không hợp lệ, đã hết hạn hoặc đã bị thu hồi');
  });

  test('7. Revoked token returns 401 Unauthorized', async () => {
    const res = await fetch(`${baseUrl}/api/v1/agents/heartbeat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-agent-token': rawTokenRevoked,
      },
      body: JSON.stringify({ latency_ms: 10 }),
    });

    assert.strictEqual(res.status, 401);
    const body: any = await res.json();
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.message, 'Token Agent không hợp lệ, đã hết hạn hoặc đã bị thu hồi');
  });

  test('8. Token for Agent in REVOKED status returns 401 Unauthorized', async () => {
    const res = await fetch(`${baseUrl}/api/v1/agents/heartbeat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-agent-token': rawTokenForRevokedAgent,
      },
      body: JSON.stringify({ latency_ms: 10 }),
    });

    assert.strictEqual(res.status, 401);
    const body: any = await res.json();
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.message, 'Token Agent không hợp lệ, đã hết hạn hoặc đã bị thu hồi');
  });

  test('9. Anti-Spoofing: Client providing different agent_id in request body does NOT spoof authenticated identity', async () => {
    // Malicious agent sending Token A (Org A) but claiming agent_id is Agent B (Org B)
    const res = await fetch(`${baseUrl}/api/v1/agents/heartbeat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-agent-token': rawTokenA,
      },
      body: JSON.stringify({
        latency_ms: 15,
        agent_id: agentBId, // Spoofed agent_id in payload
        metadata: { malicious_claim: 'agent-b' },
      }),
    });

    assert.strictEqual(res.status, 200);
    const body: any = await res.json();
    assert.strictEqual(body.success, true);
    // Identity must strictly bind to Token A owner (agentAId), NOT the spoofed agentBId!
    assert.strictEqual(body.data.agent_id, agentAId);

    // Verify Agent B in DB was NOT touched by Agent A's heartbeat
    const agentBCheck = await pool.query(`SELECT status, last_seen_at FROM agents WHERE id = $1;`, [agentBId]);
    assert.strictEqual(agentBCheck.rows[0].last_seen_at, null);
  });

  test('10. Tenant Isolation: Org A token context correctly binds Org A organization_id', async () => {
    // Check that AgentModel.findByTokenHash successfully resolved organization_id for Token A
    const tokenHashA = crypto.createHash('sha256').update(rawTokenA).digest('hex');
    const { AgentModel } = await import('../models/agent.model');
    const resolvedAgent = await AgentModel.findByTokenHash(tokenHashA, rawTokenA);

    assert.ok(resolvedAgent);
    assert.strictEqual(resolvedAgent.id, agentAId);
    assert.strictEqual((resolvedAgent as any).organization_id, orgAId);
    assert.notStrictEqual((resolvedAgent as any).organization_id, orgBId);
  });

  test('11. Rate limiting on heartbeat endpoint limits excessive traffic', async () => {
    // Send 130 rapid requests to test rateLimiter (max 120 req/min)
    let hitRateLimit = false;
    for (let i = 0; i < 130; i++) {
      const res = await fetch(`${baseUrl}/api/v1/agents/heartbeat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-agent-token': rawTokenA,
        },
        body: JSON.stringify({ latency_ms: 10 }),
      });

      if (res.status === 429) {
        hitRateLimit = true;
        break;
      }
    }

    assert.strictEqual(hitRateLimit, true, 'Rate limiter must trigger 429 Too Many Requests when threshold exceeded');
  });
});
