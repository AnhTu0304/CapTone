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
import { AgentModel } from '../models/agent.model';
import { AgentTimeoutService } from '../services/agentTimeout.service';

describe('Agent Timeout, Status Transition & Audit Logging Suite [PB11 2.3]', () => {
  let server: http.Server;
  let baseUrl: string;

  const orgId = 'b5000000-0000-0000-0000-000000000001';
  const ownerId = 'a5000000-0000-0000-0000-000000000001';
  const envId = 'c5000000-0000-0000-0000-000000000001';
  const clusterId = 'd5000000-0000-0000-0000-000000000001';

  // 1. Agent Fresh (Online recently)
  const agentFreshId = 'e5000000-0000-0000-0000-000000000001';
  const tokenFreshId = 'f5000000-0000-0000-0000-000000000001';
  const rawTokenFresh = 'sh_live_sec_agent_fresh_12345';

  // 2. Agent Stale (Online, but last_seen_at 2 minutes ago)
  const agentStaleId = 'e5000000-0000-0000-0000-000000000002';
  const tokenStaleId = 'f5000000-0000-0000-0000-000000000002';
  const rawTokenStale = 'sh_live_sec_agent_stale_12345';

  // 3. Agent Pending (Enrollment created, never sent heartbeat)
  const agentPendingId = 'e5000000-0000-0000-0000-000000000003';
  const tokenPendingId = 'f5000000-0000-0000-0000-000000000003';

  // 4. Agent Revoked
  const agentRevokedId = 'e5000000-0000-0000-0000-000000000004';
  const tokenRevokedId = 'f5000000-0000-0000-0000-000000000004';
  const rawTokenRevoked = 'sh_live_sec_agent_revoked_12345';

  let ownerJwt: string;

  before(async () => {
    await testRedisConnection();

    // Setup base organization, user, environment, cluster
    const rolesRes = await pool.query(`SELECT id, code FROM roles WHERE scope = 'ORGANIZATION'`);
    const ownerRoleId = rolesRes.rows.find((r) => r.code === 'SME_OWNER')?.id;

    await pool.query(
      `INSERT INTO users (id, email, password_hash, full_name, status, created_at, updated_at)
       VALUES ($1, 'timeout.owner@test.com', 'dummy_hash', 'Timeout Test Owner', 'ACTIVE', NOW(), NOW())
       ON CONFLICT (id) DO NOTHING;`,
      [ownerId]
    );

    await pool.query(
      `INSERT INTO organizations (id, name, slug, created_by, status, created_at, updated_at)
       VALUES ($1, 'Timeout Test Org', 'timeout-test-org', $2, 'ACTIVE', NOW(), NOW())
       ON CONFLICT (id) DO NOTHING;`,
      [orgId, ownerId]
    );

    if (ownerRoleId) {
      await pool.query(
        `INSERT INTO organization_members (organization_id, user_id, role_id, status, joined_at, created_at, updated_at)
         VALUES ($1, $2, $3, 'ACTIVE', NOW(), NOW(), NOW())
         ON CONFLICT (organization_id, user_id) DO NOTHING;`,
        [orgId, ownerId, ownerRoleId]
      );
    }

    await pool.query(
      `INSERT INTO environments (id, organization_id, name, code, environment_type, status, created_at, updated_at)
       VALUES ($1, $2, 'Production Timeout Env', 'prod-timeout', 'PRODUCTION', 'ACTIVE', NOW(), NOW())
       ON CONFLICT (id) DO NOTHING;`,
      [envId, orgId]
    );

    await pool.query(
      `INSERT INTO clusters (id, environment_id, name, status, created_at, updated_at)
       VALUES ($1, $2, 'Timeout Test Cluster', 'CONNECTED', NOW(), NOW())
       ON CONFLICT (id) DO NOTHING;`,
      [clusterId, envId]
    );

    // Seed Agents
    // 1. Fresh Agent: ONLINE, last_seen_at = NOW()
    await pool.query(
      `INSERT INTO agents (id, environment_id, cluster_id, name, agent_uid, version, status, last_seen_at, created_at, updated_at)
       VALUES ($1, $2, $3, 'Agent Fresh', 'uid-agent-fresh', '1.0.0', 'ONLINE', NOW(), NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET status = 'ONLINE', last_seen_at = NOW();`,
      [agentFreshId, envId, clusterId]
    );
    const hashFresh = crypto.createHash('sha256').update(rawTokenFresh).digest('hex');
    await pool.query(
      `INSERT INTO agent_tokens (id, agent_id, token_hash, token_prefix, expires_at, created_at)
       VALUES ($1, $2, $3, $4, NOW() + INTERVAL '30 days', NOW())
       ON CONFLICT (id) DO UPDATE SET token_hash = $3;`,
      [tokenFreshId, agentFreshId, hashFresh, rawTokenFresh.slice(0, 16)]
    );

    // 2. Stale Agent: ONLINE, but last_seen_at = NOW() - 2 minutes
    await pool.query(
      `INSERT INTO agents (id, environment_id, cluster_id, name, agent_uid, version, status, last_seen_at, created_at, updated_at)
       VALUES ($1, $2, $3, 'Agent Stale', 'uid-agent-stale', '1.0.0', 'ONLINE', NOW() - INTERVAL '2 minutes', NOW() - INTERVAL '1 day', NOW() - INTERVAL '2 minutes')
       ON CONFLICT (id) DO UPDATE SET status = 'ONLINE', last_seen_at = NOW() - INTERVAL '2 minutes';`,
      [agentStaleId, envId, clusterId]
    );
    const hashStale = crypto.createHash('sha256').update(rawTokenStale).digest('hex');
    await pool.query(
      `INSERT INTO agent_tokens (id, agent_id, token_hash, token_prefix, expires_at, created_at)
       VALUES ($1, $2, $3, $4, NOW() + INTERVAL '30 days', NOW())
       ON CONFLICT (id) DO UPDATE SET token_hash = $3;`,
      [tokenStaleId, agentStaleId, hashStale, rawTokenStale.slice(0, 16)]
    );

    // 3. Pending Agent: PENDING, last_seen_at = NULL
    await pool.query(
      `INSERT INTO agents (id, environment_id, cluster_id, name, agent_uid, version, status, last_seen_at, created_at, updated_at)
       VALUES ($1, $2, $3, 'Agent Pending', 'uid-agent-pending', '1.0.0', 'PENDING', NULL, NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET status = 'PENDING', last_seen_at = NULL;`,
      [agentPendingId, envId, clusterId]
    );

    // 4. Revoked Agent: REVOKED, last_seen_at = NOW() - 5 minutes
    await pool.query(
      `INSERT INTO agents (id, environment_id, cluster_id, name, agent_uid, version, status, last_seen_at, revoked_at, created_at, updated_at)
       VALUES ($1, $2, $3, 'Agent Revoked', 'uid-agent-revoked', '1.0.0', 'REVOKED', NOW() - INTERVAL '5 minutes', NOW() - INTERVAL '5 minutes', NOW() - INTERVAL '10 minutes', NOW())
       ON CONFLICT (id) DO UPDATE SET status = 'REVOKED';`,
      [agentRevokedId, envId, clusterId]
    );
    const hashRevoked = crypto.createHash('sha256').update(rawTokenRevoked).digest('hex');
    await pool.query(
      `INSERT INTO agent_tokens (id, agent_id, token_hash, token_prefix, expires_at, revoked_at, created_at)
       VALUES ($1, $2, $3, $4, NOW() + INTERVAL '30 days', NOW() - INTERVAL '5 minutes', NOW())
       ON CONFLICT (id) DO UPDATE SET revoked_at = NOW() - INTERVAL '5 minutes';`,
      [tokenRevokedId, agentRevokedId, hashRevoked, rawTokenRevoked.slice(0, 16)]
    );

    ownerJwt = jwt.sign(
      { id: ownerId, email: 'timeout.owner@test.com', status: 'ACTIVE', roles: ['USER'] },
      config.jwt.secret,
      { expiresIn: '1h', algorithm: 'HS256' }
    );

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
    // Cleanup test data
    await pool.query(`DELETE FROM audit_logs WHERE target_id IN ($1, $2, $3, $4);`, [
      agentFreshId, agentStaleId, agentPendingId, agentRevokedId,
    ]);
    await pool.query(`DELETE FROM agent_heartbeats WHERE agent_id IN ($1, $2, $3, $4);`, [
      agentFreshId, agentStaleId, agentPendingId, agentRevokedId,
    ]);
    await pool.query(`DELETE FROM agent_tokens WHERE id IN ($1, $2, $3, $4);`, [
      tokenFreshId, tokenStaleId, tokenPendingId, tokenRevokedId,
    ]);
    await pool.query(`DELETE FROM agents WHERE id IN ($1, $2, $3, $4);`, [
      agentFreshId, agentStaleId, agentPendingId, agentRevokedId,
    ]);
    await pool.query(`DELETE FROM clusters WHERE id = $1;`, [clusterId]);
    await pool.query(`DELETE FROM environments WHERE id = $1;`, [envId]);
    await pool.query(`DELETE FROM organization_members WHERE organization_id = $1;`, [orgId]);
    await pool.query(`DELETE FROM organizations WHERE id = $1;`, [orgId]);
    await pool.query(`DELETE FROM users WHERE id = $1;`, [ownerId]);
    await closeRedis();
  });

  test('1. Agent with recent heartbeat (last_seen_at = NOW()) remains ONLINE after timeout check', async () => {
    // Ensure agentFresh is ONLINE and fresh
    await pool.query(`UPDATE agents SET status = 'ONLINE', last_seen_at = NOW() WHERE id = $1`, [agentFreshId]);

    const res = await AgentTimeoutService.checkAndMarkStaleAgents(45);
    assert.strictEqual(res.timeout_threshold_seconds, 45);

    const freshRow = await pool.query('SELECT status FROM agents WHERE id = $1', [agentFreshId]);
    assert.strictEqual(freshRow.rows[0].status, 'ONLINE');

    const freshInStale = res.stale_agents.find((a: any) => a.id === agentFreshId);
    assert.strictEqual(freshInStale, undefined);
  });

  test('2. Stale Agent (last_seen_at > 45s ago) is atomically transitioned from ONLINE to OFFLINE', async () => {
    // Explicitly set agentStale to ONLINE and stale
    await pool.query(
      `UPDATE agents SET status = 'ONLINE', last_seen_at = NOW() - INTERVAL '2 minutes' WHERE id = $1`,
      [agentStaleId]
    );

    const res = await AgentTimeoutService.checkAndMarkStaleAgents(45);
    assert.ok(res.stale_agents_count >= 1);
    const markedStale = res.stale_agents.find((a: any) => a.id === agentStaleId);
    assert.ok(markedStale, 'Stale agent must be returned in updated list');

    const staleRow = await pool.query('SELECT status, last_seen_at FROM agents WHERE id = $1', [agentStaleId]);
    assert.strictEqual(staleRow.rows[0].status, 'OFFLINE');
    // last_seen_at must be preserved as historical timestamp, not altered to NOW()
    assert.ok(staleRow.rows[0].last_seen_at);
  });

  test('3. Transition to OFFLINE records an audit log entry with action AGENT_DISCONNECTED', async () => {
    const auditRes = await pool.query(
      `SELECT * FROM audit_logs 
       WHERE target_id = $1 AND action = 'AGENT_DISCONNECTED' 
       ORDER BY created_at DESC LIMIT 1;`,
      [agentStaleId]
    );
    assert.strictEqual(auditRes.rows.length, 1);
    const log = auditRes.rows[0];
    assert.strictEqual(log.reason_code, 'HEARTBEAT_TIMEOUT');
    assert.strictEqual(log.actor_type, 'SYSTEM');
    assert.strictEqual(log.organization_id, orgId);
    assert.strictEqual(log.before_data?.status, 'ONLINE');
    assert.strictEqual(log.after_data?.status, 'OFFLINE');
  });

  test('4. Agent in PENDING state (last_seen_at = NULL) is NOT marked OFFLINE by timeout check', async () => {
    const pendingRow = await pool.query('SELECT status, last_seen_at FROM agents WHERE id = $1', [agentPendingId]);
    assert.strictEqual(pendingRow.rows[0].status, 'PENDING');
    assert.strictEqual(pendingRow.rows[0].last_seen_at, null);
  });

  test('5. Agent in REVOKED state is NOT touched by timeout check', async () => {
    const revokedRow = await pool.query('SELECT status FROM agents WHERE id = $1', [agentRevokedId]);
    assert.strictEqual(revokedRow.rows[0].status, 'REVOKED');
  });

  test('6. Idempotency: Multiple runs of timeout check do NOT produce duplicate audit logs', async () => {
    const countBefore = await pool.query(
      `SELECT COUNT(*)::int AS count FROM audit_logs WHERE target_id = $1;`,
      [agentStaleId]
    );

    // Run timeout check again
    const resAgain = await AgentTimeoutService.checkAndMarkStaleAgents(45);
    // Since agent is already OFFLINE, it must not update again
    assert.strictEqual(
      resAgain.stale_agents.filter((a: any) => a.id === agentStaleId).length,
      0
    );

    const countAfter = await pool.query(
      `SELECT COUNT(*)::int AS count FROM audit_logs WHERE target_id = $1;`,
      [agentStaleId]
    );
    assert.strictEqual(countAfter.rows[0].count, countBefore.rows[0].count);
  });

  test('7. OFFLINE Agent recovers to ONLINE upon receiving a valid heartbeat', async () => {
    // Agent Stale sends a valid heartbeat
    const res = await fetch(`${baseUrl}/api/v1/agents/heartbeat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-agent-token': rawTokenStale,
      },
      body: JSON.stringify({
        latency_ms: 18,
        agent_version: '1.0.0',
      }),
    });
    assert.strictEqual(res.status, 200);

    const checkRow = await pool.query('SELECT status, last_seen_at FROM agents WHERE id = $1', [agentStaleId]);
    assert.strictEqual(checkRow.rows[0].status, 'ONLINE');
    assert.ok(checkRow.rows[0].last_seen_at);
  });

  test('8. Recovery from OFFLINE to ONLINE records an audit log entry with action AGENT_CONNECTED', async () => {
    const auditRes = await pool.query(
      `SELECT * FROM audit_logs 
       WHERE target_id = $1 AND action = 'AGENT_CONNECTED' AND reason_code = 'HEARTBEAT_RECOVERED'
       ORDER BY created_at DESC LIMIT 1;`,
      [agentStaleId]
    );
    assert.strictEqual(auditRes.rows.length, 1);
    const log = auditRes.rows[0];
    assert.strictEqual(log.actor_type, 'AGENT');
    assert.strictEqual(log.organization_id, orgId);
    assert.strictEqual(log.before_data?.status, 'OFFLINE');
    assert.strictEqual(log.after_data?.status, 'ONLINE');
  });

  test('9. Concurrency: Heartbeat arriving concurrently with timeout check maintains ONLINE state', async () => {
    // Set last_seen_at to 40 seconds ago (close to 45s threshold)
    await pool.query(
      `UPDATE agents SET status = 'ONLINE', last_seen_at = NOW() - INTERVAL '40 seconds' WHERE id = $1`,
      [agentFreshId]
    );

    // Concurrently send heartbeat and run timeout check
    const [heartbeatRes, timeoutRes] = await Promise.all([
      fetch(`${baseUrl}/api/v1/agents/heartbeat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-agent-token': rawTokenFresh,
        },
        body: JSON.stringify({ latency_ms: 12 }),
      }),
      AgentTimeoutService.checkAndMarkStaleAgents(45),
    ]);

    assert.strictEqual(heartbeatRes.status, 200);
    const finalRow = await pool.query('SELECT status FROM agents WHERE id = $1', [agentFreshId]);
    assert.strictEqual(finalRow.rows[0].status, 'ONLINE');
  });

  test('10. Monotonic timestamp: Stale/late heartbeat cannot regress last_seen_at', async () => {
    // Current last_seen_at
    const beforeRow = await pool.query('SELECT last_seen_at FROM agents WHERE id = $1', [agentFreshId]);
    const originalTime = new Date(beforeRow.rows[0].last_seen_at).getTime();

    // Send heartbeat with past timestamp in payload
    await fetch(`${baseUrl}/api/v1/agents/heartbeat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-agent-token': rawTokenFresh,
      },
      body: JSON.stringify({
        latency_ms: 10,
        timestamp: '2020-01-01T00:00:00.000Z',
      }),
    });

    const afterRow = await pool.query('SELECT last_seen_at FROM agents WHERE id = $1', [agentFreshId]);
    const updatedTime = new Date(afterRow.rows[0].last_seen_at).getTime();
    assert.ok(updatedTime >= originalTime, 'last_seen_at must be monotonic and never decrease');
  });

  test('11. Heartbeat with invalid token does NOT recover an OFFLINE agent', async () => {
    // Mark agentStale OFFLINE
    await pool.query(`UPDATE agents SET status = 'OFFLINE' WHERE id = $1`, [agentStaleId]);

    const res = await fetch(`${baseUrl}/api/v1/agents/heartbeat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-agent-token': 'fake_invalid_token_12345',
      },
      body: JSON.stringify({ latency_ms: 10 }),
    });
    assert.strictEqual(res.status, 401);

    const checkRow = await pool.query('SELECT status FROM agents WHERE id = $1', [agentStaleId]);
    assert.strictEqual(checkRow.rows[0].status, 'OFFLINE');
  });

  test('12. Revoked Agent cannot be revived to ONLINE even with valid unrevoked token format', async () => {
    const res = await fetch(`${baseUrl}/api/v1/agents/heartbeat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-agent-token': rawTokenRevoked,
      },
      body: JSON.stringify({ latency_ms: 10 }),
    });
    assert.strictEqual(res.status, 401);

    const checkRow = await pool.query('SELECT status FROM agents WHERE id = $1', [agentRevokedId]);
    assert.strictEqual(checkRow.rows[0].status, 'REVOKED');
  });

  test('13. Zero Credential Leakage: Audit logs never store raw tokens or authorization headers', async () => {
    const logsRes = await pool.query(
      `SELECT before_data, after_data, metadata, description FROM audit_logs WHERE target_id IN ($1, $2);`,
      [agentFreshId, agentStaleId]
    );

    for (const row of logsRes.rows) {
      const dump = JSON.stringify(row);
      assert.strictEqual(dump.includes(rawTokenFresh), false, 'Token Fresh leaked in audit logs');
      assert.strictEqual(dump.includes(rawTokenStale), false, 'Token Stale leaked in audit logs');
    }
  });

  test('14. Dashboard / Agent API reflects current OFFLINE/ONLINE status accurately', async () => {
    // 1. Agent Stale is currently OFFLINE
    const res = await fetch(`${baseUrl}/api/v1/organizations/${orgId}/agents/${agentStaleId}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${ownerJwt}`,
      },
    });

    assert.strictEqual(res.status, 200);
    const body: any = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.status, 'OFFLINE');
    assert.strictEqual(body.data.id, agentStaleId);
  });
});
