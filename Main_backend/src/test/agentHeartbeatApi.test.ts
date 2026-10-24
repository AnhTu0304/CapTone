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
import { RedisCacheService } from '../services/redisCache.service';
import { AgentModel } from '../models/agent.model';

describe('API Tiếp nhận và Lưu trữ Heartbeat Agent Suite [PB10][PB11 2.1]', () => {
  let server: http.Server;
  let baseUrl: string;

  const ownerAId = 'a4000000-0000-0000-0000-000000000001';
  const ownerBId = 'a4000000-0000-0000-0000-000000000002';

  const orgAId = 'b4000000-0000-0000-0000-000000000001';
  const orgBId = 'b4000000-0000-0000-0000-000000000002';

  const envAId = 'c4000000-0000-0000-0000-000000000001';
  const envBId = 'c4000000-0000-0000-0000-000000000002';

  const clusterAId = 'd4000000-0000-0000-0000-000000000001';
  const clusterBId = 'd4000000-0000-0000-0000-000000000002';

  const agentAId = 'e4000000-0000-0000-0000-000000000001';
  const tokenAId = 'f4000000-0000-0000-0000-000000000001';
  const rawTokenA = 'sh_live_sec_agent_a_token_secret_12345';

  const agentBId = 'e4000000-0000-0000-0000-000000000002';
  const tokenBId = 'f4000000-0000-0000-0000-000000000002';
  const rawTokenB = 'sh_live_sec_agent_b_token_secret_12345';

  const agentRevokedId = 'e4000000-0000-0000-0000-000000000003';
  const tokenRevokedId = 'f4000000-0000-0000-0000-000000000003';
  const rawTokenRevoked = 'sh_live_sec_agent_revoked_token_12345';

  const agentExpiredId = 'e4000000-0000-0000-0000-000000000004';
  const tokenExpiredId = 'f4000000-0000-0000-0000-000000000004';
  const rawTokenExpired = 'sh_live_sec_agent_expired_token_12345';

  let ownerAToken: string;
  let ownerBToken: string;

  before(async () => {
    await testRedisConnection();

    // 1. Roles
    const rolesRes = await pool.query(`SELECT id, code FROM roles WHERE scope = 'ORGANIZATION'`);
    const smeOwnerRoleId = rolesRes.rows.find((r) => r.code === 'SME_OWNER')?.id;

    // 2. Users
    await pool.query(
      `INSERT INTO users (id, email, password_hash, full_name, status, created_at, updated_at)
       VALUES 
         ($1, 'owner.a.hb@test.com', 'dummy_hash', 'Owner A Heartbeat', 'ACTIVE', NOW(), NOW()),
         ($2, 'owner.b.hb@test.com', 'dummy_hash', 'Owner B Heartbeat', 'ACTIVE', NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET status = 'ACTIVE', deleted_at = NULL;`,
      [ownerAId, ownerBId]
    );

    // 3. Orgs
    await pool.query(
      `INSERT INTO organizations (id, name, slug, status, created_by, created_at, updated_at)
       VALUES 
         ($1, 'Heartbeat Org A', 'hb-org-a', 'ACTIVE', $2, NOW(), NOW()),
         ($3, 'Heartbeat Org B', 'hb-org-b', 'ACTIVE', $4, NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET status = 'ACTIVE', deleted_at = NULL;`,
      [orgAId, ownerAId, orgBId, ownerBId]
    );

    // 4. Org Members
    await pool.query(
      `INSERT INTO organization_members (organization_id, user_id, role_id, status, joined_at)
       VALUES 
         ($1, $2, $3, 'ACTIVE', NOW()),
         ($4, $5, $3, 'ACTIVE', NOW())
       ON CONFLICT (organization_id, user_id) DO UPDATE SET status = 'ACTIVE';`,
      [orgAId, ownerAId, smeOwnerRoleId, orgBId, ownerBId]
    );

    // 5. Environments
    await pool.query(
      `INSERT INTO environments (id, organization_id, name, code, environment_type, created_by, created_at, updated_at)
       VALUES 
         ($1, $2, 'Env Heartbeat A', 'env-hb-a', 'DEVELOPMENT', $3, NOW(), NOW()),
         ($4, $5, 'Env Heartbeat B', 'env-hb-b', 'DEVELOPMENT', $6, NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET organization_id = EXCLUDED.organization_id;`,
      [envAId, orgAId, ownerAId, envBId, orgBId, ownerBId]
    );

    // 6. Clusters
    await pool.query(
      `INSERT INTO clusters (id, environment_id, name, provider, status, created_at, updated_at)
       VALUES 
         ($1, $2, 'k8s-hb-cluster-a', 'MINIKUBE', 'CONNECTED', NOW(), NOW()),
         ($3, $4, 'k8s-hb-cluster-b', 'MINIKUBE', 'CONNECTED', NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET environment_id = EXCLUDED.environment_id;`,
      [clusterAId, envAId, clusterBId, envBId]
    );

    // 7. Agents
    await pool.query(
      `INSERT INTO agents (id, agent_uid, cluster_id, environment_id, name, version, status, created_at, updated_at)
       VALUES 
         ($1, 'uid-hb-agent-a', $2, $3, 'agent-hb-a', '1.0.0', 'PENDING', NOW(), NOW()),
         ($4, 'uid-hb-agent-b', $5, $6, 'agent-hb-b', '1.0.0', 'ONLINE', NOW(), NOW()),
         ($7, 'uid-hb-agent-revoked', $2, $3, 'agent-hb-revoked', '1.0.0', 'REVOKED', NOW(), NOW()),
         ($8, 'uid-hb-agent-expired', $2, $3, 'agent-hb-expired', '1.0.0', 'ONLINE', NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, version = EXCLUDED.version;`,
      [agentAId, clusterAId, envAId, agentBId, clusterBId, envBId, agentRevokedId, agentExpiredId]
    );

    // 8. Agent Tokens
    const hashA = crypto.createHash('sha256').update(rawTokenA).digest('hex');
    const hashB = crypto.createHash('sha256').update(rawTokenB).digest('hex');
    const hashRevoked = crypto.createHash('sha256').update(rawTokenRevoked).digest('hex');
    const hashExpired = crypto.createHash('sha256').update(rawTokenExpired).digest('hex');

    await pool.query(
      `INSERT INTO agent_tokens (id, agent_id, token_hash, token_prefix, created_at)
       VALUES 
         ($1, $2, $3, $4, NOW()),
         ($5, $6, $7, $8, NOW()),
         ($9, $10, $11, $12, NOW())
       ON CONFLICT (id) DO NOTHING;`,
      [
        tokenAId, agentAId, hashA, rawTokenA.slice(0, 16),
        tokenBId, agentBId, hashB, rawTokenB.slice(0, 16),
        tokenRevokedId, agentRevokedId, hashRevoked, rawTokenRevoked.slice(0, 16),
      ]
    );

    // Mark tokenRevoked as revoked
    await pool.query(`UPDATE agent_tokens SET revoked_at = NOW() WHERE id = $1;`, [tokenRevokedId]);

    // Token Expired (expired yesterday)
    await pool.query(
      `INSERT INTO agent_tokens (id, agent_id, token_hash, token_prefix, expires_at, created_at)
       VALUES ($1, $2, $3, $4, NOW() - INTERVAL '1 day', NOW() - INTERVAL '2 days')
       ON CONFLICT (id) DO UPDATE SET expires_at = NOW() - INTERVAL '1 day';`,
      [tokenExpiredId, agentExpiredId, hashExpired, rawTokenExpired.slice(0, 16)]
    );

    // 9. Generate Org JWTs
    ownerAToken = jwt.sign(
      { id: ownerAId, email: 'owner.a.hb@test.com', status: 'ACTIVE', roles: ['USER'] },
      config.jwt.secret,
      { expiresIn: '1h', algorithm: 'HS256' }
    );
    ownerBToken = jwt.sign(
      { id: ownerBId, email: 'owner.b.hb@test.com', status: 'ACTIVE', roles: ['USER'] },
      config.jwt.secret,
      { expiresIn: '1h', algorithm: 'HS256' }
    );

    // 10. Start HTTP server
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
    await pool.query(`DELETE FROM agent_heartbeats WHERE agent_id IN ($1, $2, $3, $4);`, [
      agentAId, agentBId, agentRevokedId, agentExpiredId,
    ]);
    await pool.query(`DELETE FROM agent_tokens WHERE id IN ($1, $2, $3, $4);`, [
      tokenAId, tokenBId, tokenRevokedId, tokenExpiredId,
    ]);
    await pool.query(`DELETE FROM agents WHERE id IN ($1, $2, $3, $4);`, [
      agentAId, agentBId, agentRevokedId, agentExpiredId,
    ]);
    await pool.query(`DELETE FROM clusters WHERE id IN ($1, $2);`, [clusterAId, clusterBId]);
    await pool.query(`DELETE FROM environments WHERE id IN ($1, $2);`, [envAId, envBId]);
    await pool.query(`DELETE FROM organization_members WHERE organization_id IN ($1, $2);`, [orgAId, orgBId]);
    await pool.query(`DELETE FROM organizations WHERE id IN ($1, $2);`, [orgAId, orgBId]);
    await pool.query(`DELETE FROM users WHERE id IN ($1, $2);`, [ownerAId, ownerBId]);
    await closeRedis();
  });

  test('1. Valid heartbeat with x-agent-token updates status to ONLINE and returns standard response', async () => {
    const res = await fetch(`${baseUrl}/api/v1/agents/heartbeat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-agent-token': rawTokenA,
      },
      body: JSON.stringify({
        latency_ms: 24,
        agent_version: '1.0.0',
        metadata: { k8s_version: 'v1.31.0', node: 'worker-01' },
      }),
    });

    assert.strictEqual(res.status, 200);
    const body: any = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.success, true);
    assert.strictEqual(body.data.agent_id, agentAId);
    assert.strictEqual(body.data.status, 'ONLINE');
    assert.ok(body.data.heartbeat_id);
    assert.ok(body.data.reported_at);

    // Verify DB persistence
    const agentRes = await pool.query('SELECT status, last_seen_at FROM agents WHERE id = $1', [agentAId]);
    assert.strictEqual(agentRes.rows[0].status, 'ONLINE');
    assert.ok(agentRes.rows[0].last_seen_at);

    const hbRes = await pool.query(
      'SELECT id, agent_id, status, latency_ms, metadata FROM agent_heartbeats WHERE agent_id = $1 ORDER BY reported_at DESC LIMIT 1',
      [agentAId]
    );
    assert.strictEqual(hbRes.rows[0].latency_ms, 24);
    assert.strictEqual(hbRes.rows[0].status, 'ONLINE');
  });

  test('2. Valid heartbeat with Authorization: Bearer <token> authenticates and records successfully', async () => {
    const res = await fetch(`${baseUrl}/api/v1/agents/heartbeat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${rawTokenA}`,
      },
      body: JSON.stringify({
        latency_ms: 18,
      }),
    });

    assert.strictEqual(res.status, 200);
    const body: any = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.agent_id, agentAId);
  });

  test('3. Monotonic last_seen_at and version update when agent reports updated version', async () => {
    const res = await fetch(`${baseUrl}/api/v1/agents/heartbeat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-agent-token': rawTokenA,
      },
      body: JSON.stringify({
        latency_ms: 15,
        agent_version: '1.1.0',
      }),
    });

    assert.strictEqual(res.status, 200);
    const agentRes = await pool.query('SELECT version, last_seen_at FROM agents WHERE id = $1', [agentAId]);
    assert.strictEqual(agentRes.rows[0].version, '1.1.0');
    assert.ok(agentRes.rows[0].last_seen_at);
  });

  test('4. Identity Spoofing Protection: Agent A payload containing agent_id/org_id of Agent B is ignored', async () => {
    // Record original status of Agent B
    const beforeB = await pool.query('SELECT last_seen_at, version FROM agents WHERE id = $1', [agentBId]);

    const res = await fetch(`${baseUrl}/api/v1/agents/heartbeat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-agent-token': rawTokenA,
      },
      body: JSON.stringify({
        agent_id: agentBId,
        organization_id: orgBId,
        latency_ms: 99,
        agent_version: 'spoofed-version-9.9.9',
      }),
    });

    assert.strictEqual(res.status, 200);
    const body: any = await res.json();
    // Must update Agent A, NOT Agent B
    assert.strictEqual(body.data.agent_id, agentAId);

    const afterB = await pool.query('SELECT last_seen_at, version FROM agents WHERE id = $1', [agentBId]);
    assert.strictEqual(afterB.rows[0].version, beforeB.rows[0].version);
    assert.deepStrictEqual(afterB.rows[0].last_seen_at, beforeB.rows[0].last_seen_at);
  });

  test('5. Tenant Isolation: Users from Org B cannot access Org A agent heartbeat history', async () => {
    const resForbidden = await fetch(`${baseUrl}/api/v1/organizations/${orgBId}/agents/${agentAId}/heartbeats`, {
      headers: { Authorization: `Bearer ${ownerBToken}` },
    });
    // Org B does not own Agent A -> 404 Not Found (or 403 Forbidden)
    assert.ok(resForbidden.status === 404 || resForbidden.status === 403);

    // Org A user can access Agent A heartbeats
    const resAllowed = await fetch(`${baseUrl}/api/v1/organizations/${orgAId}/agents/${agentAId}/heartbeats`, {
      headers: { Authorization: `Bearer ${ownerAToken}` },
    });
    assert.strictEqual(resAllowed.status, 200);
    const body: any = await resAllowed.json();
    assert.strictEqual(body.success, true);
    assert.ok(Array.isArray(body.data));
    assert.ok(body.data.length >= 1);
  });

  test('6. Missing credential header returns 401 Unauthorized', async () => {
    const res = await fetch(`${baseUrl}/api/v1/agents/heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ latency_ms: 20 }),
    });
    assert.strictEqual(res.status, 401);
  });

  test('7. Non-existent / bogus token returns 401 Unauthorized', async () => {
    const res = await fetch(`${baseUrl}/api/v1/agents/heartbeat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-agent-token': 'sh_live_sec_completely_bogus_token',
      },
      body: JSON.stringify({ latency_ms: 20 }),
    });
    assert.strictEqual(res.status, 401);
  });

  test('8. Expired token returns 401 Unauthorized', async () => {
    const res = await fetch(`${baseUrl}/api/v1/agents/heartbeat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-agent-token': rawTokenExpired,
      },
      body: JSON.stringify({ latency_ms: 20 }),
    });
    assert.strictEqual(res.status, 401);
  });

  test('9. Revoked token returns 401 Unauthorized', async () => {
    const res = await fetch(`${baseUrl}/api/v1/agents/heartbeat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-agent-token': rawTokenRevoked,
      },
      body: JSON.stringify({ latency_ms: 20 }),
    });
    assert.strictEqual(res.status, 401);
  });

  test('10. Revoked Agent cannot heartbeat and cannot be revived to ONLINE', async () => {
    // Attempt heartbeat on revoked agent
    const res = await fetch(`${baseUrl}/api/v1/agents/heartbeat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-agent-token': rawTokenRevoked,
      },
      body: JSON.stringify({ status: 'ONLINE', latency_ms: 10 }),
    });
    assert.strictEqual(res.status, 401);

    const agentRes = await pool.query('SELECT status FROM agents WHERE id = $1', [agentRevokedId]);
    assert.strictEqual(agentRes.rows[0].status, 'REVOKED');
  });

  test('11. Payload Validation: Negative latency_ms is rejected with 400 Bad Request', async () => {
    const res = await fetch(`${baseUrl}/api/v1/agents/heartbeat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-agent-token': rawTokenA,
      },
      body: JSON.stringify({ latency_ms: -100 }),
    });
    assert.strictEqual(res.status, 400);
    const body: any = await res.json();
    assert.strictEqual(body.success, false);
  });

  test('12. Payload Validation: Invalid status is rejected with 400 Bad Request', async () => {
    const res = await fetch(`${baseUrl}/api/v1/agents/heartbeat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-agent-token': rawTokenA,
      },
      body: JSON.stringify({ status: 'INVALID_STATUS_CODE' }),
    });
    assert.strictEqual(res.status, 400);
  });

  test('13. Client timestamp is preserved in metadata while server receipt time is authoritative', async () => {
    const clientTime = '2026-10-24T10:00:00.000Z';
    const res = await fetch(`${baseUrl}/api/v1/agents/heartbeat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-agent-token': rawTokenA,
      },
      body: JSON.stringify({
        latency_ms: 22,
        timestamp: clientTime,
      }),
    });

    assert.strictEqual(res.status, 200);
    const body: any = await res.json();
    assert.strictEqual(body.success, true);
    // reported_at is generated by server clock (recent), not equal to past clientTime
    assert.notStrictEqual(body.data.reported_at, clientTime);

    // Verify metadata stores client_timestamp
    const hbRes = await pool.query(
      'SELECT metadata, reported_at FROM agent_heartbeats WHERE agent_id = $1 ORDER BY reported_at DESC LIMIT 1',
      [agentAId]
    );
    const meta = hbRes.rows[0].metadata;
    assert.strictEqual(meta?.client_timestamp, clientTime);
  });

  test('14. Redis Offline / Degradation does not bypass or break agent token authentication', async () => {
    RedisCacheService.setSimulatedOffline(true);
    try {
      // Valid request still succeeds
      const resValid = await fetch(`${baseUrl}/api/v1/agents/heartbeat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-agent-token': rawTokenA,
        },
        body: JSON.stringify({ latency_ms: 30 }),
      });
      assert.strictEqual(resValid.status, 200);

      // Invalid request is still strictly rejected (fail-closed)
      const resInvalid = await fetch(`${baseUrl}/api/v1/agents/heartbeat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-agent-token': 'fake_token_during_redis_offline',
        },
        body: JSON.stringify({ latency_ms: 30 }),
      });
      assert.strictEqual(resInvalid.status, 401);
    } finally {
      RedisCacheService.setSimulatedOffline(false);
    }
  });

  test('15. Concurrent heartbeats handle out-of-order execution safely without data corruption', async () => {
    // Send 5 concurrent heartbeats with differing latencies and versions
    const promises = [10, 20, 30, 40, 50].map((lat, idx) =>
      fetch(`${baseUrl}/api/v1/agents/heartbeat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-agent-token': rawTokenA,
          'x-skip-rate-limit': 'true',
        },
        body: JSON.stringify({
          latency_ms: lat,
          agent_version: `1.0.${idx}`,
        }),
      })
    );

    const results = await Promise.all(promises);
    for (const r of results) {
      assert.strictEqual(r.status, 200);
    }

    const agentRes = await pool.query('SELECT status, last_seen_at FROM agents WHERE id = $1', [agentAId]);
    assert.strictEqual(agentRes.rows[0].status, 'ONLINE');
    assert.ok(agentRes.rows[0].last_seen_at);
  });

  test('16. Zero Credential Leakage: Error responses never expose raw tokens or hashes', async () => {
    const res = await fetch(`${baseUrl}/api/v1/agents/heartbeat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-agent-token': 'sh_live_sec_sensitive_raw_secret_value_xyz',
      },
      body: JSON.stringify({ latency_ms: 25 }),
    });

    assert.strictEqual(res.status, 401);
    const text = await res.text();
    assert.strictEqual(text.includes('sh_live_sec_sensitive_raw_secret_value_xyz'), false);
    assert.strictEqual(text.includes('hash'), false);
  });
});
