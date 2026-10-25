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
import { MetricModel } from '../models/metric.model';

describe('API Tiếp nhận, Lưu trữ & Truy vấn Node Metrics Suite [S3][PB13 4.3]', () => {
  let server: http.Server;
  let baseUrl: string;

  const ownerAId = 'a8000000-0000-4000-8000-000000000001';
  const ownerBId = 'a8000000-0000-4000-8000-000000000002';

  const orgAId = 'b8000000-0000-4000-8000-000000000001';
  const orgBId = 'b8000000-0000-4000-8000-000000000002';

  const envAId = 'c8000000-0000-4000-8000-000000000001';
  const envBId = 'c8000000-0000-4000-8000-000000000002';

  const clusterAId = 'd8000000-0000-4000-8000-000000000001';
  const clusterBId = 'd8000000-0000-4000-8000-000000000002';

  const nodeA1Id = '18000000-0000-4000-8000-000000000001';
  const nodeA2Id = '18000000-0000-4000-8000-000000000002';
  const nodeB1Id = '28000000-0000-4000-8000-000000000001';

  const agentAId = 'e8000000-0000-4000-8000-000000000001';
  const tokenAId = 'f8000000-0000-4000-8000-000000000001';
  const rawTokenA = 'ag_live_task43_agent_a_secret_token_0001';

  const agentBId = 'e8000000-0000-4000-8000-000000000002';
  const tokenBId = 'f8000000-0000-4000-8000-000000000002';
  const rawTokenB = 'ag_live_task43_agent_b_secret_token_0002';

  const agentRevokedId = 'e8000000-0000-4000-8000-000000000003';
  const tokenRevokedId = 'f8000000-0000-4000-8000-000000000003';
  const rawTokenRevoked = 'ag_live_task43_agent_revoked_token_0003';

  const agentExpiredId = 'e8000000-0000-4000-8000-000000000004';
  const tokenExpiredId = 'f8000000-0000-4000-8000-000000000004';
  const rawTokenExpired = 'ag_live_task43_agent_expired_token_0004';

  let ownerAJwt: string;
  let ownerBJwt: string;

  const baseNow = Date.now();
  const t1Iso = new Date(baseNow - 60000).toISOString();
  const t2Iso = new Date(baseNow - 30000).toISOString();
  const t3Iso = new Date(baseNow - 10000).toISOString();

  function buildValidMetricSample(overrides: Record<string, any> = {}) {
    return {
      node_name: 'k8s-org-a-worker-01',
      timestamp: t1Iso,
      cpu_usage_percent: 37.5,
      cpu_cores: 8,
      ram_total_bytes: 17179869184,
      ram_used_bytes: 8589934592,
      ram_available_bytes: 8589934592,
      ram_usage_percent: 50.0,
      disk_total_bytes: 107374182400,
      disk_used_bytes: 42949672960,
      disk_available_bytes: 64424509440,
      disk_usage_percent: 40.0,
      disk_filesystems: [
        {
          device: '/dev/nvme0n1p1',
          mount_point: '/',
          fs_type: 'ext4',
          total_bytes: 107374182400,
          used_bytes: 42949672960,
          available_bytes: 64424509440,
          usage_percent: 40.0,
        },
      ],
      net_rx_bytes: 2048000,
      net_tx_bytes: 1024000,
      net_rx_bytes_per_sec: 4096.5,
      net_tx_bytes_per_sec: 2048.25,
      net_interfaces: [
        {
          interface: 'eth0',
          rx_bytes: 2048000,
          tx_bytes: 1024000,
          rx_packets: 1500,
          tx_packets: 900,
          rx_errors: 0,
          tx_errors: 0,
          rx_bytes_per_sec: 4096.5,
          tx_bytes_per_sec: 2048.25,
          is_warmup: false,
          counter_reset: false,
        },
      ],
      collection_status: 'OK',
      collection_errors: {},
      metadata: { is_containerized: true, platform: 'linux' },
      ...overrides,
    };
  }

  async function requestJson(
    path: string,
    options: {
      method?: string;
      headers?: Record<string, string>;
      body?: any;
    } = {}
  ) {
    const res = await fetch(`${baseUrl}${path}`, {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
    const json = await res.json().catch(() => ({}));
    return { status: res.status, body: json };
  }

  before(async () => {
    await testRedisConnection();
    await MetricModel.ensureNodeMetricsTable();

    const rolesRes = await pool.query(`SELECT id, code FROM roles WHERE scope = 'ORGANIZATION'`);
    const smeOwnerRoleId = rolesRes.rows.find((r) => r.code === 'SME_OWNER')?.id;

    // Clean any leftover test data
    await pool.query(`DELETE FROM node_metrics WHERE agent_id IN ($1, $2, $3, $4)`, [
      agentAId,
      agentBId,
      agentRevokedId,
      agentExpiredId,
    ]);

    await pool.query(
      `INSERT INTO users (id, email, password_hash, full_name, status, created_at, updated_at)
       VALUES
         ($1, 'owner.a.task43@test.com', 'dummy_hash', 'Owner A Task43', 'ACTIVE', NOW(), NOW()),
         ($2, 'owner.b.task43@test.com', 'dummy_hash', 'Owner B Task43', 'ACTIVE', NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET status = 'ACTIVE', deleted_at = NULL;`,
      [ownerAId, ownerBId]
    );

    await pool.query(
      `INSERT INTO organizations (id, name, slug, status, created_by, created_at, updated_at)
       VALUES
         ($1, 'Task43 Org A', 'task43-org-a', 'ACTIVE', $2, NOW(), NOW()),
         ($3, 'Task43 Org B', 'task43-org-b', 'ACTIVE', $4, NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET status = 'ACTIVE', deleted_at = NULL;`,
      [orgAId, ownerAId, orgBId, ownerBId]
    );

    await pool.query(
      `INSERT INTO organization_members (organization_id, user_id, role_id, status, joined_at)
       VALUES
         ($1, $2, $3, 'ACTIVE', NOW()),
         ($4, $5, $3, 'ACTIVE', NOW())
       ON CONFLICT (organization_id, user_id) DO UPDATE SET status = 'ACTIVE';`,
      [orgAId, ownerAId, smeOwnerRoleId, orgBId, ownerBId]
    );

    await pool.query(
      `INSERT INTO environments (id, organization_id, name, code, environment_type, created_by, created_at, updated_at)
       VALUES
         ($1, $2, 'Env Task43 A', 'env-t43-a', 'PRODUCTION', $3, NOW(), NOW()),
         ($4, $5, 'Env Task43 B', 'env-t43-b', 'PRODUCTION', $6, NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET organization_id = EXCLUDED.organization_id;`,
      [envAId, orgAId, ownerAId, envBId, orgBId, ownerBId]
    );

    await pool.query(
      `INSERT INTO clusters (id, environment_id, name, provider, status, created_at, updated_at)
       VALUES
         ($1, $2, 'cluster-task43-a', 'MINIKUBE', 'CONNECTED', NOW(), NOW()),
         ($3, $4, 'cluster-task43-b', 'MINIKUBE', 'CONNECTED', NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET environment_id = EXCLUDED.environment_id, deleted_at = NULL;`,
      [clusterAId, envAId, clusterBId, envBId]
    );

    await pool.query(
      `INSERT INTO nodes (id, cluster_id, name, status, cpu_capacity_millicores, memory_capacity_bytes, disk_capacity_bytes, created_at, updated_at)
       VALUES
         ($1, $2, 'k8s-org-a-worker-01', 'Ready', 8000, 17179869184, 107374182400, NOW(), NOW()),
         ($3, $2, 'k8s-org-a-worker-02', 'Ready', 8000, 17179869184, 107374182400, NOW(), NOW()),
         ($4, $5, 'k8s-org-b-worker-01', 'Ready', 8000, 17179869184, 107374182400, NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET cluster_id = EXCLUDED.cluster_id, name = EXCLUDED.name;`,
      [nodeA1Id, clusterAId, nodeA2Id, nodeB1Id, clusterBId]
    );

    await pool.query(
      `INSERT INTO agents (id, agent_uid, cluster_id, environment_id, name, version, status, created_at, updated_at)
       VALUES
         ($1, 'uid-t43-agent-a', $2, $3, 'agent-t43-a', '1.0.0', 'ONLINE', NOW(), NOW()),
         ($4, 'uid-t43-agent-b', $5, $6, 'agent-t43-b', '1.0.0', 'ONLINE', NOW(), NOW()),
         ($7, 'uid-t43-agent-revoked', $2, $3, 'agent-t43-revoked', '1.0.0', 'REVOKED', NOW(), NOW()),
         ($8, 'uid-t43-agent-expired', $2, $3, 'agent-t43-expired', '1.0.0', 'ONLINE', NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, cluster_id = EXCLUDED.cluster_id, environment_id = EXCLUDED.environment_id;`,
      [agentAId, clusterAId, envAId, agentBId, clusterBId, envBId, agentRevokedId, agentExpiredId]
    );

    const hashA = crypto.createHash('sha256').update(rawTokenA).digest('hex');
    const hashB = crypto.createHash('sha256').update(rawTokenB).digest('hex');
    const hashRevoked = crypto.createHash('sha256').update(rawTokenRevoked).digest('hex');
    const hashExpired = crypto.createHash('sha256').update(rawTokenExpired).digest('hex');

    await pool.query(
      `INSERT INTO agent_tokens (id, agent_id, token_hash, token_prefix, expires_at, revoked_at, created_at)
       VALUES
         ($1, $2, $3, $4, NOW() + INTERVAL '30 days', NULL, NOW()),
         ($5, $6, $7, $8, NOW() + INTERVAL '30 days', NULL, NOW()),
         ($9, $10, $11, $12, NOW() + INTERVAL '30 days', NOW(), NOW()),
         ($13, $14, $15, $16, NOW() - INTERVAL '1 day', NULL, NOW())
       ON CONFLICT (id) DO UPDATE SET
         token_hash = EXCLUDED.token_hash,
         expires_at = EXCLUDED.expires_at,
         revoked_at = EXCLUDED.revoked_at;`,
      [
        tokenAId, agentAId, hashA, rawTokenA.slice(0, 12),
        tokenBId, agentBId, hashB, rawTokenB.slice(0, 12),
        tokenRevokedId, agentRevokedId, hashRevoked, rawTokenRevoked.slice(0, 12),
        tokenExpiredId, agentExpiredId, hashExpired, rawTokenExpired.slice(0, 12),
      ]
    );

    ownerAJwt = jwt.sign(
      { id: ownerAId, email: 'owner.a.task43@test.com', roles: ['SME_OWNER'] },
      config.jwt.secret,
      { expiresIn: '1h' }
    );
    ownerBJwt = jwt.sign(
      { id: ownerBId, email: 'owner.b.task43@test.com', roles: ['SME_OWNER'] },
      config.jwt.secret,
      { expiresIn: '1h' }
    );

    server = app.listen(0);
    const addr = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  after(async () => {
    await pool.query(`DELETE FROM node_metrics WHERE agent_id IN ($1, $2, $3, $4)`, [
      agentAId,
      agentBId,
      agentRevokedId,
      agentExpiredId,
    ]);
    await pool.query(`DELETE FROM agent_tokens WHERE id IN ($1, $2, $3, $4)`, [
      tokenAId,
      tokenBId,
      tokenRevokedId,
      tokenExpiredId,
    ]);
    await pool.query(`DELETE FROM agents WHERE id IN ($1, $2, $3, $4)`, [
      agentAId,
      agentBId,
      agentRevokedId,
      agentExpiredId,
    ]);
    await pool.query(`DELETE FROM nodes WHERE id IN ($1, $2, $3)`, [nodeA1Id, nodeA2Id, nodeB1Id]);
    await pool.query(`DELETE FROM clusters WHERE id IN ($1, $2)`, [clusterAId, clusterBId]);
    await pool.query(`DELETE FROM environments WHERE id IN ($1, $2)`, [envAId, envBId]);
    await pool.query(`DELETE FROM organization_members WHERE organization_id IN ($1, $2)`, [orgAId, orgBId]);
    await pool.query(`DELETE FROM organizations WHERE id IN ($1, $2)`, [orgAId, orgBId]);
    await pool.query(`DELETE FROM users WHERE id IN ($1, $2)`, [ownerAId, ownerBId]);

    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    await closeRedis();
    await pool.end();
  });

  // =========================================================================
  // PHẦN 1: INGESTION API TESTS
  // =========================================================================

  test('1. Valid single Node Metrics request is authenticated and persisted (201 Created)', async () => {
    const sample = buildValidMetricSample({ timestamp: t1Iso, cpu_usage_percent: 42.5 });
    const res = await requestJson('/api/v1/agents/node-metrics', {
      method: 'POST',
      headers: { 'x-agent-token': rawTokenA },
      body: sample,
    });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.ingested_count, 1);
    assert.strictEqual(res.body.data.agent_id, agentAId);
    assert.strictEqual(res.body.data.records[0].deduplicated, false);
  });

  test('2. Duplicate / Retry submission with identical (agent_id, node_name, timestamp) is handled idempotently without creating duplicate rows', async () => {
    const sampleRetry = buildValidMetricSample({ timestamp: t1Iso, cpu_usage_percent: 44.0 });
    const res = await requestJson('/api/v1/agents/node-metrics', {
      method: 'POST',
      headers: { Authorization: `Bearer ${rawTokenA}` },
      body: sampleRetry,
    });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.data.ingested_count, 1);
    assert.strictEqual(res.body.data.records[0].deduplicated, true);

    const dbCount = await pool.query(
      `SELECT COUNT(*)::int AS cnt, MAX(cpu_usage_percent)::float AS cpu FROM node_metrics WHERE agent_id = $1 AND node_name = $2 AND collected_at = $3`,
      [agentAId, 'k8s-org-a-worker-01', new Date(t1Iso)]
    );
    assert.strictEqual(dbCount.rows[0].cnt, 1, 'Retry must not create duplicate row');
    assert.strictEqual(dbCount.rows[0].cpu, 44.0, 'Retry updates latest value idempotently');
  });

  test('3. Valid batch ingestion (multiple timestamps and nodes) succeeds & oversized batch (>100) is rejected', async () => {
    const batchPayload = {
      metrics: [
        buildValidMetricSample({
          node_name: 'k8s-org-a-worker-01',
          timestamp: t2Iso,
          cpu_usage_percent: 61.2,
        }),
        buildValidMetricSample({
          node_name: 'k8s-org-a-worker-01',
          timestamp: t3Iso,
          cpu_usage_percent: 78.9,
        }),
        buildValidMetricSample({
          node_name: 'k8s-org-a-worker-02',
          timestamp: t3Iso,
          cpu_usage_percent: 25.0,
        }),
      ],
    };

    const res = await requestJson('/api/v1/agents/metrics', {
      method: 'POST',
      headers: { 'x-agent-token': rawTokenA },
      body: batchPayload,
    });
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.data.ingested_count, 3);

    // Also ingest one sample for Agent B / Org B for tenant isolation tests
    const resB = await requestJson('/api/v1/agents/node-metrics', {
      method: 'POST',
      headers: { 'x-agent-token': rawTokenB },
      body: buildValidMetricSample({
        node_name: 'k8s-org-b-worker-01',
        timestamp: t2Iso,
        cpu_usage_percent: 88.8,
      }),
    });
    assert.strictEqual(resB.status, 201);

    // Oversized batch (101 samples) -> 400 Bad Request
    const oversized = {
      metrics: Array.from({ length: 101 }, (_, idx) =>
        buildValidMetricSample({ timestamp: new Date(baseNow - idx * 1000).toISOString() })
      ),
    };
    const resOver = await requestJson('/api/v1/agents/node-metrics', {
      method: 'POST',
      headers: { 'x-agent-token': rawTokenA },
      body: oversized,
    });
    assert.strictEqual(resOver.status, 400);
  });

  test('4. Payload missing required fields or wrong types is rejected (400 Bad Request)', async () => {
    const missingNodeName = buildValidMetricSample();
    delete (missingNodeName as any).node_name;

    const res1 = await requestJson('/api/v1/agents/node-metrics', {
      method: 'POST',
      headers: { 'x-agent-token': rawTokenA },
      body: missingNodeName,
    });
    assert.strictEqual(res1.status, 400);

    const wrongType = buildValidMetricSample({ cpu_cores: 'eight-cores' });
    const res2 = await requestJson('/api/v1/agents/node-metrics', {
      method: 'POST',
      headers: { 'x-agent-token': rawTokenA },
      body: wrongType,
    });
    assert.strictEqual(res2.status, 400);
  });

  test('5. Invalid metric values (CPU > 100%, negative bytes, used > total) are rejected (400 Bad Request)', async () => {
    const cpuOver100 = buildValidMetricSample({ cpu_usage_percent: 145.0 });
    const r1 = await requestJson('/api/v1/agents/node-metrics', {
      method: 'POST',
      headers: { 'x-agent-token': rawTokenA },
      body: cpuOver100,
    });
    assert.strictEqual(r1.status, 400);

    const negativeBytes = buildValidMetricSample({ net_rx_bytes: -500 });
    const r2 = await requestJson('/api/v1/agents/node-metrics', {
      method: 'POST',
      headers: { 'x-agent-token': rawTokenA },
      body: negativeBytes,
    });
    assert.strictEqual(r2.status, 400);

    const usedExceedsTotal = buildValidMetricSample({
      ram_total_bytes: 1024,
      ram_used_bytes: 4096,
    });
    const r3 = await requestJson('/api/v1/agents/node-metrics', {
      method: 'POST',
      headers: { 'x-agent-token': rawTokenA },
      body: usedExceedsTotal,
    });
    assert.strictEqual(r3.status, 400);
  });

  test('6. Missing, wrong, expired, or revoked Agent credentials are rejected (401 Unauthorized)', async () => {
    const sample = buildValidMetricSample();

    const noToken = await requestJson('/api/v1/agents/node-metrics', {
      method: 'POST',
      body: sample,
    });
    assert.strictEqual(noToken.status, 401);

    const badToken = await requestJson('/api/v1/agents/node-metrics', {
      method: 'POST',
      headers: { 'x-agent-token': 'ag_live_invalid_token_xyz' },
      body: sample,
    });
    assert.strictEqual(badToken.status, 401);

    const expiredToken = await requestJson('/api/v1/agents/node-metrics', {
      method: 'POST',
      headers: { 'x-agent-token': rawTokenExpired },
      body: sample,
    });
    assert.strictEqual(expiredToken.status, 401);

    const revokedToken = await requestJson('/api/v1/agents/node-metrics', {
      method: 'POST',
      headers: { 'x-agent-token': rawTokenRevoked },
      body: sample,
    });
    assert.strictEqual(revokedToken.status, 401);
  });

  test('7. Agent A cannot spoof Agent B identity or report metrics for Node belonging to Org B / Cluster B (403 Forbidden)', async () => {
    // 7a. Spoofing agent_id of Agent B
    const spoofAgent = await requestJson('/api/v1/agents/node-metrics', {
      method: 'POST',
      headers: { 'x-agent-token': rawTokenA },
      body: buildValidMetricSample({ agent_id: agentBId }),
    });
    assert.strictEqual(spoofAgent.status, 403);

    // 7b. Reporting for Node B (by node_name belonging to Cluster B)
    const crossNodeByName = await requestJson('/api/v1/agents/node-metrics', {
      method: 'POST',
      headers: { 'x-agent-token': rawTokenA },
      body: buildValidMetricSample({ node_name: 'k8s-org-b-worker-01' }),
    });
    assert.strictEqual(crossNodeByName.status, 403);

    // 7c. Reporting for Node B (by node_id belonging to Cluster B)
    const crossNodeById = await requestJson('/api/v1/agents/node-metrics', {
      method: 'POST',
      headers: { 'x-agent-token': rawTokenA },
      body: buildValidMetricSample({ node_id: nodeB1Id }),
    });
    assert.strictEqual(crossNodeById.status, 403);
  });

  test('8. Database failure during ingestion does not return false success and does not leak stack trace (500)', async () => {
    const origCreate = MetricModel.createNodeMetric;
    MetricModel.createNodeMetric = async () => {
      throw new Error('Simulated PostgreSQL connection reset ECONNRESET at internal/pg:999');
    };

    try {
      const res = await requestJson('/api/v1/agents/node-metrics', {
        method: 'POST',
        headers: { 'x-agent-token': rawTokenA },
        body: buildValidMetricSample(),
      });
      assert.strictEqual(res.status, 500);
      assert.strictEqual(res.body.success, false);
      assert.ok(!JSON.stringify(res.body).includes('ECONNRESET'), 'Must not leak internal DB error details');
    } finally {
      MetricModel.createNodeMetric = origCreate;
    }
  });

  // =========================================================================
  // PHẦN 2: QUERY API & TENANT ISOLATION TESTS
  // =========================================================================

  test('9. Query by Node/Agent and time range [from, to] returns matching records in deterministic order', async () => {
    // Query Agent A metrics for k8s-org-a-worker-01 across all 3 timestamps
    const allRes = await requestJson(
      `/api/v1/organizations/${orgAId}/agents/${agentAId}/metrics?node_name=k8s-org-a-worker-01`,
      { headers: { Authorization: `Bearer ${ownerAJwt}` } }
    );
    assert.strictEqual(allRes.status, 200);
    assert.strictEqual(allRes.body.data.items.length, 3);
    assert.strictEqual(allRes.body.data.pagination.total, 3);
    // Descending order: t3 (78.9%), t2 (61.2%), t1 (44.0%)
    assert.strictEqual(allRes.body.data.items[0].cpu_usage_percent, 78.9);
    assert.strictEqual(allRes.body.data.items[1].cpu_usage_percent, 61.2);
    assert.strictEqual(allRes.body.data.items[2].cpu_usage_percent, 44.0);

    // Filter strictly to [t2 - 1s, t2 + 1s]
    const fromIso = new Date(new Date(t2Iso).getTime() - 1000).toISOString();
    const toIso = new Date(new Date(t2Iso).getTime() + 1000).toISOString();
    const rangeRes = await requestJson(
      `/api/v1/organizations/${orgAId}/clusters/${clusterAId}/nodes/${nodeA1Id}/metrics?from=${encodeURIComponent(fromIso)}&to=${encodeURIComponent(toIso)}`,
      { headers: { Authorization: `Bearer ${ownerAJwt}` } }
    );
    assert.strictEqual(rangeRes.status, 200);
    assert.strictEqual(rangeRes.body.data.items.length, 1);
    assert.strictEqual(rangeRes.body.data.items[0].cpu_usage_percent, 61.2);

    // Deterministic secondary ordering when two records share the exact same timestamp (t3Iso)
    const sameTimeRes = await requestJson(
      `/api/v1/organizations/${orgAId}/agents/${agentAId}/metrics?from=${encodeURIComponent(t3Iso)}&to=${encodeURIComponent(t3Iso)}`,
      { headers: { Authorization: `Bearer ${ownerAJwt}` } }
    );
    assert.strictEqual(sameTimeRes.status, 200);
    assert.strictEqual(sameTimeRes.body.data.items.length, 2);
    assert.ok(
      Number(sameTimeRes.body.data.items[0].id) > Number(sameTimeRes.body.data.items[1].id),
      'Records with identical collected_at must be deterministically ordered by id DESC'
    );
  });

  test('10. Query with no matching data in time window returns valid empty response (200 OK)', async () => {
    const ancientFrom = new Date(baseNow - 10 * 24 * 3600 * 1000).toISOString();
    const ancientTo = new Date(baseNow - 9 * 24 * 3600 * 1000).toISOString();

    const res = await requestJson(
      `/api/v1/organizations/${orgAId}/agents/${agentAId}/metrics?from=${encodeURIComponent(ancientFrom)}&to=${encodeURIComponent(ancientTo)}`,
      { headers: { Authorization: `Bearer ${ownerAJwt}` } }
    );
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.items.length, 0);
    assert.strictEqual(res.body.data.pagination.total, 0);
  });

  test('11. Query with from > to or invalid date format is rejected (400 Bad Request)', async () => {
    const resReversed = await requestJson(
      `/api/v1/organizations/${orgAId}/agents/${agentAId}/metrics?from=${encodeURIComponent(t3Iso)}&to=${encodeURIComponent(t1Iso)}`,
      { headers: { Authorization: `Bearer ${ownerAJwt}` } }
    );
    assert.strictEqual(resReversed.status, 400);

    const resMalformed = await requestJson(
      `/api/v1/organizations/${orgAId}/agents/${agentAId}/metrics?from=not-a-timestamp`,
      { headers: { Authorization: `Bearer ${ownerAJwt}` } }
    );
    assert.strictEqual(resMalformed.status, 400);
  });

  test('12. Pagination (limit, page) works accurately and rejects invalid limit/page (400)', async () => {
    const page1 = await requestJson(
      `/api/v1/organizations/${orgAId}/agents/${agentAId}/metrics?node_name=k8s-org-a-worker-01&limit=2&page=1`,
      { headers: { Authorization: `Bearer ${ownerAJwt}` } }
    );
    assert.strictEqual(page1.status, 200);
    assert.strictEqual(page1.body.data.items.length, 2);
    assert.strictEqual(page1.body.data.pagination.total, 3);
    assert.strictEqual(page1.body.data.pagination.total_pages, 2);
    assert.strictEqual(page1.body.data.pagination.has_more, true);

    const page2 = await requestJson(
      `/api/v1/organizations/${orgAId}/agents/${agentAId}/metrics?node_name=k8s-org-a-worker-01&limit=2&page=2`,
      { headers: { Authorization: `Bearer ${ownerAJwt}` } }
    );
    assert.strictEqual(page2.status, 200);
    assert.strictEqual(page2.body.data.items.length, 1);
    assert.strictEqual(page2.body.data.pagination.has_more, false);

    const badLimit = await requestJson(
      `/api/v1/organizations/${orgAId}/agents/${agentAId}/metrics?limit=0`,
      { headers: { Authorization: `Bearer ${ownerAJwt}` } }
    );
    assert.strictEqual(badLimit.status, 400);
  });

  test('13. Tenant Isolation: User in Org B is FORBIDDEN (403) from reading Org A Node/Agent metrics via any route or query param', async () => {
    // 13a. Org B user calling Org A URL
    const r1 = await requestJson(
      `/api/v1/organizations/${orgAId}/agents/${agentAId}/metrics`,
      { headers: { Authorization: `Bearer ${ownerBJwt}` } }
    );
    assert.strictEqual(r1.status, 403);

    // 13b. Org B user calling their own Org B URL but passing Org A's agentId
    const r2 = await requestJson(
      `/api/v1/organizations/${orgBId}/agents/${agentAId}/metrics`,
      { headers: { Authorization: `Bearer ${ownerBJwt}` } }
    );
    assert.strictEqual(r2.status, 403);

    // 13c. Org B user calling /api/v1/nodes/:nodeA1Id/metrics directly
    const r3 = await requestJson(
      `/api/v1/nodes/${nodeA1Id}/metrics`,
      { headers: { Authorization: `Bearer ${ownerBJwt}` } }
    );
    assert.strictEqual(r3.status, 403);

    // 13d. Org B user calling /api/v1/telemetry/node-metrics?agent_id=agentAId
    const r4 = await requestJson(
      `/api/v1/telemetry/node-metrics?agent_id=${agentAId}`,
      { headers: { Authorization: `Bearer ${ownerBJwt}` } }
    );
    assert.strictEqual(r4.status, 403);
  });

  test('14. Non-existent Node or Agent ID returns 404 Not Found', async () => {
    const fakeUuid = '99999999-0000-4000-8000-999999999999';

    const missingAgent = await requestJson(
      `/api/v1/organizations/${orgAId}/agents/${fakeUuid}/metrics`,
      { headers: { Authorization: `Bearer ${ownerAJwt}` } }
    );
    assert.strictEqual(missingAgent.status, 404);

    const missingNode = await requestJson(
      `/api/v1/organizations/${orgAId}/clusters/${clusterAId}/nodes/${fakeUuid}/metrics`,
      { headers: { Authorization: `Bearer ${ownerAJwt}` } }
    );
    assert.strictEqual(missingNode.status, 404);
  });
});
