import test, { describe, before, after } from 'node:test';
import assert from 'node:assert';
import http from 'http';
import { AddressInfo } from 'net';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import app from '../app';
import { pool } from '../config/database';
import { config } from '../config/env';
import { closeRedis } from '../config/redis';
import { MetricModel } from '../models/metric.model';

describe('PB16 Task 2.1 & 2.2 – Metrics History Schema, API, Ingestion Pipeline & Deduplication Suite', () => {
  let server: http.Server;
  let baseUrl: string;

  const testOrgAId = 'e0000000-0000-4000-8000-0000000000a1';
  const testOrgBId = 'e0000000-0000-4000-8000-0000000000b2';
  const testEnvAId = 'e0000000-0000-4000-8000-0000000000ea';
  const testEnvBId = 'e0000000-0000-4000-8000-0000000000eb';
  const testClusterAId = 'e0000000-0000-4000-8000-0000000000ca';
  const testClusterBId = 'e0000000-0000-4000-8000-0000000000cb';

  const testAgentAId = 'e0000000-0000-4000-8000-0000000000aa';
  const testAgentBId = 'e0000000-0000-4000-8000-0000000000ab';
  const rawAgentAToken = 'aegis_agt_test_token_pb16_org_a_secret_key_12345';
  const rawAgentBToken = 'aegis_agt_test_token_pb16_org_b_secret_key_67890';

  const testUserAId = 'e0000000-0000-4000-8000-000000000001';
  const testUserBId = 'e0000000-0000-4000-8000-000000000002';
  let tokenUserA: string;
  let tokenUserB: string;

  async function requestJson(
    path: string,
    options: {
      method?: string;
      body?: any;
      token?: string;
      agentToken?: string;
    } = {}
  ): Promise<{ status: number; body: any; headers: http.IncomingHttpHeaders }> {
    const url = new URL(path, baseUrl);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (options.token) {
      headers['Authorization'] = `Bearer ${options.token}`;
    }
    if (options.agentToken) {
      headers['Authorization'] = `Bearer ${options.agentToken}`;
    }

    return new Promise((resolve, reject) => {
      const req = http.request(
        url,
        {
          method: options.method || 'GET',
          headers,
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => {
            let parsedBody = null;
            try {
              parsedBody = data ? JSON.parse(data) : null;
            } catch {
              parsedBody = data;
            }
            resolve({
              status: res.statusCode || 500,
              body: parsedBody,
              headers: res.headers,
            });
          });
        }
      );
      req.on('error', reject);
      if (options.body) {
        req.write(JSON.stringify(options.body));
      }
      req.end();
    });
  }

  before(async () => {
    // 1. Ensure latest schema and indexes
    await MetricModel.ensureAgentMetricsSchema();

    // 2. Setup organizations, environments, clusters, agents, and users
    await pool.query(
      `INSERT INTO users (id, email, password_hash, full_name, status, created_at, updated_at)
       VALUES 
         ($1, 'user-a@pb16.io', 'hash123', 'User Org A', 'ACTIVE', NOW(), NOW()),
         ($2, 'user-b@pb16.io', 'hash123', 'User Org B', 'ACTIVE', NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET status = 'ACTIVE', deleted_at = NULL;`,
      [testUserAId, testUserBId]
    );

    await pool.query(
      `INSERT INTO organizations (id, name, slug, status, created_by, created_at, updated_at)
       VALUES 
         ($1, 'PB16 Org A', 'pb16-org-a', 'ACTIVE', $3, NOW(), NOW()),
         ($2, 'PB16 Org B', 'pb16-org-b', 'ACTIVE', $4, NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET status = 'ACTIVE', deleted_at = NULL;`,
      [testOrgAId, testOrgBId, testUserAId, testUserBId]
    );

    await pool.query(
      `INSERT INTO environments (id, organization_id, name, code, environment_type, created_by, created_at, updated_at)
       VALUES 
         ($1, $2, 'Env A Prod', 'env-a-prod', 'PRODUCTION', $4, NOW(), NOW()),
         ($3, $5, 'Env B Prod', 'env-b-prod', 'PRODUCTION', $6, NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET organization_id = EXCLUDED.organization_id;`,
      [testEnvAId, testOrgAId, testEnvBId, testUserAId, testOrgBId, testUserBId]
    );

    await pool.query(
      `INSERT INTO clusters (id, environment_id, name, provider, status, created_at, updated_at)
       VALUES 
         ($1, $2, 'cluster-a', 'MINIKUBE', 'CONNECTED', NOW(), NOW()),
         ($3, $4, 'cluster-b', 'MINIKUBE', 'CONNECTED', NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET environment_id = EXCLUDED.environment_id;`,
      [testClusterAId, testEnvAId, testClusterBId, testEnvBId]
    );

    await pool.query(
      `INSERT INTO agents (id, agent_uid, cluster_id, environment_id, name, version, status, created_at, updated_at)
       VALUES 
         ($1, 'uid-agent-pb16-a', $2, $3, 'pb16-agent-a', '1.0.0', 'ONLINE', NOW(), NOW()),
         ($4, 'uid-agent-pb16-b', $5, $6, 'pb16-agent-b', '1.0.0', 'ONLINE', NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET status = 'ONLINE', cluster_id = EXCLUDED.cluster_id, environment_id = EXCLUDED.environment_id;`,
      [testAgentAId, testClusterAId, testEnvAId, testAgentBId, testClusterBId, testEnvBId]
    );

    const hashA = crypto.createHash('sha256').update(rawAgentAToken).digest('hex');
    const hashB = crypto.createHash('sha256').update(rawAgentBToken).digest('hex');

    await pool.query(
      `INSERT INTO agent_tokens (id, agent_id, token_hash, token_prefix, expires_at, revoked_at, created_at)
       VALUES 
         (gen_random_uuid(), $1, $2, $3, NOW() + INTERVAL '30 days', NULL, NOW()),
         (gen_random_uuid(), $4, $5, $6, NOW() + INTERVAL '30 days', NULL, NOW());`,
      [testAgentAId, hashA, rawAgentAToken.slice(0, 12), testAgentBId, hashB, rawAgentBToken.slice(0, 12)]
    );

    // 3. User JWT tokens
    tokenUserA = jwt.sign(
      { id: testUserAId, email: 'user-a@pb16.io', roles: ['DEVOPS', 'USER'], organizationId: testOrgAId },
      config.jwt.secret,
      { expiresIn: '1h' }
    );
    tokenUserB = jwt.sign(
      { id: testUserBId, email: 'user-b@pb16.io', roles: ['DEVOPS', 'USER'], organizationId: testOrgBId },
      config.jwt.secret,
      { expiresIn: '1h' }
    );

    // 4. Start HTTP test server
    await new Promise<void>((resolve) => {
      server = http.createServer(app);
      server.listen(0, () => {
        const addr = server.address() as AddressInfo;
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  after(async () => {
    // Cleanup test data
    await pool.query(`DELETE FROM agent_metrics WHERE agent_id IN ($1, $2)`, [testAgentAId, testAgentBId]).catch(() => {});
    await pool.query(`DELETE FROM agent_tokens WHERE agent_id IN ($1, $2)`, [testAgentAId, testAgentBId]).catch(() => {});
    await pool.query(`DELETE FROM agents WHERE id IN ($1, $2)`, [testAgentAId, testAgentBId]).catch(() => {});
    await pool.query(`DELETE FROM clusters WHERE id IN ($1, $2)`, [testClusterAId, testClusterBId]).catch(() => {});
    await pool.query(`DELETE FROM environments WHERE id IN ($1, $2)`, [testEnvAId, testEnvBId]).catch(() => {});
    await pool.query(`DELETE FROM organizations WHERE id IN ($1, $2)`, [testOrgAId, testOrgBId]).catch(() => {});
    await pool.query(`DELETE FROM users WHERE id IN ($1, $2)`, [testUserAId, testUserBId]).catch(() => {});

    await new Promise<void>((resolve) => {
      if (server) server.close(() => resolve());
      else resolve();
    });
    await closeRedis().catch(() => {});
    await pool.end().catch(() => {});
  });

  // =========================================================================
  // Giai đoạn B: Schema, Unique Index & Deduplication Key Tests (Task 2.1)
  // =========================================================================

  test('1. Schema Verification: agent_metrics has tenant columns, batch/sample ID, and deduplication index', async () => {
    const colRes = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'agent_metrics' 
        AND column_name IN ('organization_id', 'environment_id', 'batch_id', 'sample_id');
    `);
    const foundCols = colRes.rows.map((r) => r.column_name);
    assert.ok(foundCols.includes('organization_id'), 'Column organization_id must exist');
    assert.ok(foundCols.includes('environment_id'), 'Column environment_id must exist');
    assert.ok(foundCols.includes('batch_id'), 'Column batch_id must exist');
    assert.ok(foundCols.includes('sample_id'), 'Column sample_id must exist');

    const indexRes = await pool.query(`
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename = 'agent_metrics' AND indexname = 'idx_agent_metrics_dedup';
    `);
    assert.strictEqual(indexRes.rows.length, 1, 'Index idx_agent_metrics_dedup must exist on agent_metrics');
  });

  test('2. Database Deduplication: ON CONFLICT updates existing row and returns deduplicated=true', async () => {
    const fixedTimestamp = new Date('2026-10-26T12:00:00.000Z');
    
    // Insert initial record
    const firstInsert = await MetricModel.create({
      agent_id: testAgentAId,
      cluster_id: testClusterAId,
      organization_id: testOrgAId,
      environment_id: testEnvAId,
      service_id: 'order-service-dedup-test',
      pod_id: 'order-pod-001',
      cpu: 25.0,
      ram: 128.0,
      disk: 15.0,
      request_rate: 100.0,
      latency: 45.0,
      http_5xx_rate: 0.1,
      pod_restart_count: 0,
      replica_count: 2,
      collected_at: fixedTimestamp,
    });
    assert.ok(firstInsert.id);
    assert.strictEqual(firstInsert.deduplicated, false);

    // Re-insert exact same natural key with updated metric value
    const secondInsert = await MetricModel.create({
      agent_id: testAgentAId,
      cluster_id: testClusterAId,
      organization_id: testOrgAId,
      environment_id: testEnvAId,
      service_id: 'order-service-dedup-test',
      pod_id: 'order-pod-001',
      cpu: 35.0, // updated value
      ram: 128.0,
      disk: 15.0,
      request_rate: 110.0,
      latency: 42.0,
      http_5xx_rate: 0.1,
      pod_restart_count: 0,
      replica_count: 2,
      collected_at: fixedTimestamp,
    });

    assert.strictEqual(secondInsert.id, firstInsert.id, 'Same row ID must be returned');
    assert.strictEqual(secondInsert.deduplicated, true, 'Deduplicated flag must be true on duplicate key');

    // Verify row in database: value was updated to 35.0 and total count is still 1
    const checkRes = await pool.query(
      `SELECT COUNT(*)::int as count, cpu FROM agent_metrics WHERE agent_id = $1 AND service_id = $2 AND pod_id = $3 AND collected_at = $4 GROUP BY cpu`,
      [testAgentAId, 'order-service-dedup-test', 'order-pod-001', fixedTimestamp]
    );
    assert.strictEqual(checkRes.rows[0].count, 1);
    assert.strictEqual(Number(checkRes.rows[0].cpu), 35.0);
  });

  // =========================================================================
  // Giai đoạn C: Ingestion Pipeline & Deduplication Tests (Task 2.2)
  // =========================================================================

  test('3. POST /api/v1/agents/apm-metrics requires valid Agent Token', async () => {
    const resNoToken = await requestJson('/api/v1/agents/apm-metrics', {
      method: 'POST',
      body: { service_id: 'svc-test', timestamp: new Date().toISOString(), cpu: 10, ram: 50 },
    });
    assert.strictEqual(resNoToken.status, 401);

    const resBadToken = await requestJson('/api/v1/agents/apm-metrics', {
      method: 'POST',
      agentToken: 'invalid_token_123',
      body: { service_id: 'svc-test', timestamp: new Date().toISOString(), cpu: 10, ram: 50 },
    });
    assert.strictEqual(resBadToken.status, 401);
  });

  test('4. Ingestion Single Sample: first call saves new record (inserted_count=1, deduplicated_count=0)', async () => {
    const timestamp = new Date('2026-10-26T12:05:00.000Z').toISOString();
    const res = await requestJson('/api/v1/agents/apm-metrics', {
      method: 'POST',
      agentToken: rawAgentAToken,
      body: {
        service_id: 'payment-service-task22',
        pod_id: 'pod-pay-1',
        timestamp,
        cpu: 18.5,
        ram: 90.0,
        disk: 12.0,
        request_rate: 45.0,
        latency: 22.0,
        http_5xx_rate: 0.0,
        replica_count: 3,
        pod_restart_count: 0,
      },
    });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.ingested_count, 1);
    assert.strictEqual(res.body.data.inserted_count, 1);
    assert.strictEqual(res.body.data.deduplicated_count, 0);
    assert.strictEqual(res.body.data.records[0].deduplicated, false);
  });

  test('5. Ingestion Retried Sample: re-sending exact same sample does not create duplicate row', async () => {
    const timestamp = new Date('2026-10-26T12:05:00.000Z').toISOString();
    const res = await requestJson('/api/v1/agents/apm-metrics', {
      method: 'POST',
      agentToken: rawAgentAToken,
      body: {
        service_id: 'payment-service-task22',
        pod_id: 'pod-pay-1',
        timestamp,
        cpu: 18.5,
        ram: 90.0,
        disk: 12.0,
        request_rate: 45.0,
        latency: 22.0,
        http_5xx_rate: 0.0,
        replica_count: 3,
        pod_restart_count: 0,
      },
    });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.data.ingested_count, 1);
    assert.strictEqual(res.body.data.inserted_count, 0);
    assert.strictEqual(res.body.data.deduplicated_count, 1);
    assert.strictEqual(res.body.data.records[0].deduplicated, true);

    // Verify exactly 1 row exists in DB
    const dbRes = await pool.query(
      `SELECT COUNT(*)::int as count FROM agent_metrics WHERE agent_id = $1 AND service_id = $2 AND pod_id = $3 AND collected_at = $4`,
      [testAgentAId, 'payment-service-task22', 'pod-pay-1', timestamp]
    );
    assert.strictEqual(dbRes.rows[0].count, 1);
  });

  test('6. Ingestion Batch: accepts batch with batch_id and stores all samples', async () => {
    const batchId = 'batch-pb16-test-001';
    const t1 = new Date('2026-10-26T12:10:00.000Z').toISOString();
    const t2 = new Date('2026-10-26T12:10:05.000Z').toISOString();

    const res = await requestJson('/api/v1/agents/apm-metrics', {
      method: 'POST',
      agentToken: rawAgentAToken,
      body: {
        batch_id: batchId,
        metrics: [
          { service_id: 'batch-svc', pod_id: 'batch-pod-1', timestamp: t1, cpu: 10, ram: 50, latency: 15, request_rate: 20 },
          { service_id: 'batch-svc', pod_id: 'batch-pod-2', timestamp: t2, cpu: 20, ram: 60, latency: 25, request_rate: 30 },
        ],
      },
    });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.data.batch_id, batchId);
    assert.strictEqual(res.body.data.ingested_count, 2);
    assert.strictEqual(res.body.data.inserted_count, 2);
    assert.strictEqual(res.body.data.deduplicated_count, 0);
  });

  test('7. Ingestion Batch Retry: re-sending entire batch yields inserted_count=0 and deduplicated_count=N', async () => {
    const batchId = 'batch-pb16-test-001';
    const t1 = new Date('2026-10-26T12:10:00.000Z').toISOString();
    const t2 = new Date('2026-10-26T12:10:05.000Z').toISOString();

    const res = await requestJson('/api/v1/agents/apm-metrics', {
      method: 'POST',
      agentToken: rawAgentAToken,
      body: {
        batch_id: batchId,
        metrics: [
          { service_id: 'batch-svc', pod_id: 'batch-pod-1', timestamp: t1, cpu: 10, ram: 50, latency: 15, request_rate: 20 },
          { service_id: 'batch-svc', pod_id: 'batch-pod-2', timestamp: t2, cpu: 20, ram: 60, latency: 25, request_rate: 30 },
        ],
      },
    });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.data.ingested_count, 2);
    assert.strictEqual(res.body.data.inserted_count, 0);
    assert.strictEqual(res.body.data.deduplicated_count, 2);
    assert.strictEqual(res.body.data.records[0].deduplicated, true);
    assert.strictEqual(res.body.data.records[1].deduplicated, true);
  });

  test('8. Concurrent Ingestion: concurrent identical requests resolve without duplicate rows', async () => {
    const timestamp = new Date('2026-10-26T12:15:00.000Z').toISOString();
    const payload = {
      service_id: 'concurrent-svc',
      pod_id: 'concurrent-pod',
      timestamp,
      cpu: 40.0,
      ram: 100.0,
      latency: 50.0,
      request_rate: 80.0,
    };

    // Fire 5 concurrent identical requests
    const promises = Array.from({ length: 5 }, () =>
      requestJson('/api/v1/agents/apm-metrics', {
        method: 'POST',
        agentToken: rawAgentAToken,
        body: payload,
      })
    );

    const results = await Promise.all(promises);
    for (const r of results) {
      assert.strictEqual(r.status, 201);
      assert.strictEqual(r.body.success, true);
    }

    // Database must have exactly 1 record
    const countRes = await pool.query(
      `SELECT COUNT(*)::int as count FROM agent_metrics WHERE agent_id = $1 AND service_id = $2 AND pod_id = $3 AND collected_at = $4`,
      [testAgentAId, 'concurrent-svc', 'concurrent-pod', timestamp]
    );
    assert.strictEqual(countRes.rows[0].count, 1, 'Only exactly 1 row must be stored for concurrent identical requests');
  });

  test('9. Same timestamp but different pods/services are both stored without conflict', async () => {
    const sameTime = new Date('2026-10-26T12:20:00.000Z').toISOString();

    const [res1, res2] = await Promise.all([
      requestJson('/api/v1/agents/apm-metrics', {
        method: 'POST',
        agentToken: rawAgentAToken,
        body: { service_id: 'multi-pod-svc', pod_id: 'pod-alpha', timestamp: sameTime, cpu: 15, ram: 40 },
      }),
      requestJson('/api/v1/agents/apm-metrics', {
        method: 'POST',
        agentToken: rawAgentAToken,
        body: { service_id: 'multi-pod-svc', pod_id: 'pod-beta', timestamp: sameTime, cpu: 18, ram: 45 },
      }),
    ]);

    assert.strictEqual(res1.status, 201);
    assert.strictEqual(res2.status, 201);
    assert.strictEqual(res1.body.data.records[0].deduplicated, false);
    assert.strictEqual(res2.body.data.records[0].deduplicated, false);

    const countRes = await pool.query(
      `SELECT COUNT(*)::int as count FROM agent_metrics WHERE agent_id = $1 AND service_id = $2 AND collected_at = $3`,
      [testAgentAId, 'multi-pod-svc', sameTime]
    );
    assert.strictEqual(countRes.rows[0].count, 2, 'Two distinct pods at same timestamp must both be stored');
  });

  // =========================================================================
  // Giai đoạn B: Metrics History Query API Tests (Task 2.1)
  // =========================================================================

  test('10. GET /api/v1/telemetry/metrics-history requires JWT authentication (401 without token)', async () => {
    const res = await requestJson('/api/v1/telemetry/metrics-history');
    assert.strictEqual(res.status, 401);
  });

  test('11. GET /api/v1/telemetry/metrics-history rejects invalid time window when start_time > end_time (400)', async () => {
    const res = await requestJson(
      '/api/v1/telemetry/metrics-history?start_time=2026-10-26T13:00:00.000Z&end_time=2026-10-26T12:00:00.000Z',
      { token: tokenUserA }
    );
    assert.strictEqual(res.status, 400);
    assert.ok(res.body.message.includes('không được lớn hơn'));
  });

  test('12. GET /api/v1/telemetry/metrics-history supports pagination, limits, and order', async () => {
    const res = await requestJson('/api/v1/telemetry/metrics-history?page=1&limit=5&order=asc', {
      token: tokenUserA,
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.data.records.length <= 5);
    assert.strictEqual(res.body.data.page, 1);
    assert.strictEqual(res.body.data.limit, 5);
    assert.ok(typeof res.body.data.total === 'number');
    assert.ok(typeof res.body.data.total_pages === 'number');
  });

  test('13. GET /api/v1/telemetry/metrics-history filters by service_id and pod_id', async () => {
    const res = await requestJson(
      '/api/v1/telemetry/metrics-history?service_id=payment-service-task22&pod_id=pod-pay-1',
      { token: tokenUserA }
    );
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.data.records.length >= 1);
    for (const rec of res.body.data.records) {
      assert.strictEqual(rec.service_id, 'payment-service-task22');
      assert.strictEqual(rec.pod_id, 'pod-pay-1');
    }
  });

  test('14. GET /api/v1/telemetry/metrics-history returns empty array when no data matches (total=0)', async () => {
    const res = await requestJson(
      '/api/v1/telemetry/metrics-history?service_id=non-existent-service-xyz',
      { token: tokenUserA }
    );
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.data.total, 0);
    assert.strictEqual(res.body.data.records.length, 0);
  });

  test('15. Multi-Tenant Isolation: User A (Org A) cannot access Org B metrics', async () => {
    // 1. Ingest metric for Org B using Agent B token
    const orgBTimestamp = new Date('2026-10-26T12:30:00.000Z').toISOString();
    const ingestB = await requestJson('/api/v1/agents/apm-metrics', {
      method: 'POST',
      agentToken: rawAgentBToken,
      body: {
        service_id: 'org-b-secret-banking-service',
        pod_id: 'pod-b-1',
        timestamp: orgBTimestamp,
        cpu: 99.0,
        ram: 500.0,
        latency: 12.0,
      },
    });
    assert.strictEqual(ingestB.status, 201);

    // 2. User A queries Org B service: must return 0 records
    const resUserAQueryOrgB = await requestJson(
      '/api/v1/telemetry/metrics-history?service_id=org-b-secret-banking-service',
      { token: tokenUserA }
    );
    assert.strictEqual(resUserAQueryOrgB.status, 200);
    assert.strictEqual(resUserAQueryOrgB.body.data.total, 0, 'User A must see 0 records for Org B service');

    // 3. User A explicitly attempts to pass organization_id=OrgB: must be rejected with 403 Forbidden
    const resForbiddenOrg = await requestJson(
      `/api/v1/telemetry/metrics-history?organization_id=${testOrgBId}`,
      { token: tokenUserA }
    );
    assert.strictEqual(resForbiddenOrg.status, 403);
    assert.ok(resForbiddenOrg.body.message.includes('Không thể xem metrics của tổ chức khác'));

    // 4. User B queries their own Org B service: returns the record
    const resUserBQuery = await requestJson(
      '/api/v1/telemetry/metrics-history?service_id=org-b-secret-banking-service',
      { token: tokenUserB }
    );
    assert.strictEqual(resUserBQuery.status, 200);
    assert.strictEqual(resUserBQuery.body.data.total, 1, 'User B must see their own service record');
    assert.strictEqual(resUserBQuery.body.data.records[0].service_id, 'org-b-secret-banking-service');
  });

  test('16. GET /api/v1/telemetry/services/:serviceId/metrics-history convenience route works', async () => {
    const res = await requestJson('/api/v1/telemetry/services/payment-service-task22/metrics-history', {
      token: tokenUserA,
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.data.records.length >= 1);
    assert.strictEqual(res.body.data.records[0].service_id, 'payment-service-task22');
  });
});
