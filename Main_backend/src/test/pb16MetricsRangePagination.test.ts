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

describe('PB16 Task 2.3 – Metrics History Range (1h, 24h, 7d) & Pagination Suite', () => {
  let server: http.Server;
  let baseUrl: string;

  const testOrgAId = 'e0000000-0000-4000-8000-00000000001a';
  const testOrgBId = 'e0000000-0000-4000-8000-00000000001b';
  const testEnvAId = 'e0000000-0000-4000-8000-00000000002a';
  const testEnvBId = 'e0000000-0000-4000-8000-00000000002b';
  const testClusterAId = 'e0000000-0000-4000-8000-00000000003a';
  const testClusterBId = 'e0000000-0000-4000-8000-00000000003b';

  const testAgentAId = 'e0000000-0000-4000-8000-00000000004a';
  const testAgentBId = 'e0000000-0000-4000-8000-00000000004b';

  const testUserAId = 'e0000000-0000-4000-8000-00000000005a';
  const testUserBId = 'e0000000-0000-4000-8000-00000000005b';
  let tokenUserA: string;
  let tokenUserB: string;

  async function requestJson(
    path: string,
    options: {
      method?: string;
      body?: any;
      token?: string;
    } = {}
  ): Promise<{ status: number; body: any; headers: http.IncomingHttpHeaders }> {
    const url = new URL(path, baseUrl);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (options.token) {
      headers['Authorization'] = `Bearer ${options.token}`;
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
         ($1, 'user-a-task23@pb16.io', 'hash123', 'User Org A 23', 'ACTIVE', NOW(), NOW()),
         ($2, 'user-b-task23@pb16.io', 'hash123', 'User Org B 23', 'ACTIVE', NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET status = 'ACTIVE', deleted_at = NULL;`,
      [testUserAId, testUserBId]
    );

    await pool.query(
      `INSERT INTO organizations (id, name, slug, status, created_by, created_at, updated_at)
       VALUES 
         ($1, 'PB16 Task23 Org A', 'pb16-23-org-a', 'ACTIVE', $3, NOW(), NOW()),
         ($2, 'PB16 Task23 Org B', 'pb16-23-org-b', 'ACTIVE', $4, NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET status = 'ACTIVE', deleted_at = NULL;`,
      [testOrgAId, testOrgBId, testUserAId, testUserBId]
    );

    await pool.query(
      `INSERT INTO environments (id, organization_id, name, code, environment_type, created_by, created_at, updated_at)
       VALUES 
         ($1, $2, 'Task23 Prod A', 'task23-prod-a', 'PRODUCTION', $3, NOW(), NOW()),
         ($4, $5, 'Task23 Prod B', 'task23-prod-b', 'PRODUCTION', $6, NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET organization_id = EXCLUDED.organization_id;`,
      [testEnvAId, testOrgAId, testUserAId, testEnvBId, testOrgBId, testUserBId]
    );

    await pool.query(
      `INSERT INTO clusters (id, environment_id, name, provider, status, created_at, updated_at)
       VALUES 
         ($1, $2, 'task23-cluster-a', 'MINIKUBE', 'CONNECTED', NOW(), NOW()),
         ($3, $4, 'task23-cluster-b', 'MINIKUBE', 'CONNECTED', NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET environment_id = EXCLUDED.environment_id;`,
      [testClusterAId, testEnvAId, testClusterBId, testEnvBId]
    );

    await pool.query(
      `INSERT INTO agents (id, agent_uid, cluster_id, environment_id, name, version, status, created_at, updated_at)
       VALUES 
         ($1, 'uid-agent-task23-a', $2, $3, 'agent-task23-a', '1.0.0', 'ONLINE', NOW(), NOW()),
         ($4, 'uid-agent-task23-b', $5, $6, 'agent-task23-b', '1.0.0', 'ONLINE', NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET status = 'ONLINE', cluster_id = EXCLUDED.cluster_id, environment_id = EXCLUDED.environment_id;`,
      [testAgentAId, testClusterAId, testEnvAId, testAgentBId, testClusterBId, testEnvBId]
    );

    // 3. User JWT tokens
    tokenUserA = jwt.sign(
      {
        id: testUserAId,
        email: 'user-a-task23@pb16.io',
        roles: ['USER'],
        organizationId: testOrgAId,
      },
      config.jwt.secret,
      { expiresIn: '2h' }
    );

    tokenUserB = jwt.sign(
      {
        id: testUserBId,
        email: 'user-b-task23@pb16.io',
        roles: ['USER'],
        organizationId: testOrgBId,
      },
      config.jwt.secret,
      { expiresIn: '2h' }
    );

    // 4. Seed agent_metrics data across ranges for Org A:
    // - 15m ago (1h, 24h, 7d)
    // - 30m ago (1h, 24h, 7d)
    // - 2h ago (24h, 7d)
    // - 12h ago (24h, 7d)
    // - 3d ago (7d)
    // - 5d ago (7d)
    // - 10d ago (outside 7d)
    // - 3 samples at identical timestamp (20m ago) for deterministic order test
    await pool.query(
      `INSERT INTO agent_metrics (
        agent_id, cluster_id, organization_id, environment_id, service_id, pod_id,
        cpu, ram, disk, request_rate, latency, http_5xx_rate, pod_restart_count, replica_count, collected_at
      ) VALUES
        ($1, $2, $3, $4, 'checkout-service-pb16-23', 'pod-15m', 10.0, 20.0, 15.0, 30.0, 45.0, 0.0, 0, 1, NOW() - INTERVAL '15 minutes'),
        ($1, $2, $3, $4, 'checkout-service-pb16-23', 'pod-30m', 12.0, 22.0, 15.0, 32.0, 48.0, 0.1, 0, 1, NOW() - INTERVAL '30 minutes'),
        ($1, $2, $3, $4, 'checkout-service-pb16-23', 'pod-2h', 15.0, 25.0, 15.0, 40.0, 55.0, 0.0, 0, 1, NOW() - INTERVAL '2 hours'),
        ($1, $2, $3, $4, 'checkout-service-pb16-23', 'pod-12h', 18.0, 28.0, 15.0, 45.0, 60.0, 0.5, 1, 1, NOW() - INTERVAL '12 hours'),
        ($1, $2, $3, $4, 'checkout-service-pb16-23', 'pod-3d', 20.0, 30.0, 15.0, 50.0, 70.0, 0.2, 0, 1, NOW() - INTERVAL '3 days'),
        ($1, $2, $3, $4, 'checkout-service-pb16-23', 'pod-5d', 22.0, 32.0, 15.0, 55.0, 75.0, 0.0, 0, 1, NOW() - INTERVAL '5 days'),
        ($1, $2, $3, $4, 'checkout-service-pb16-23', 'pod-10d', 25.0, 35.0, 15.0, 60.0, 80.0, 1.0, 2, 1, NOW() - INTERVAL '10 days'),
        
        -- Identical timestamp samples
        ($1, $2, $3, $4, 'inventory-service-pb16-23', 'pod-same-a', 30.0, 40.0, 10.0, 10.0, 20.0, 0.0, 0, 1, NOW() - INTERVAL '20 minutes'),
        ($1, $2, $3, $4, 'inventory-service-pb16-23', 'pod-same-b', 32.0, 42.0, 10.0, 12.0, 22.0, 0.0, 0, 1, NOW() - INTERVAL '20 minutes'),
        ($1, $2, $3, $4, 'inventory-service-pb16-23', 'pod-same-c', 34.0, 44.0, 10.0, 14.0, 24.0, 0.0, 0, 1, NOW() - INTERVAL '20 minutes'),

        -- Org B sample (isolated tenant)
        ($5, $6, $7, $8, 'org-b-service-task23', 'pod-org-b', 50.0, 50.0, 50.0, 10.0, 20.0, 0.0, 0, 1, NOW() - INTERVAL '15 minutes')
      ON CONFLICT DO NOTHING;`,
      [
        testAgentAId, testClusterAId, testOrgAId, testEnvAId,
        testAgentBId, testClusterBId, testOrgBId, testEnvBId
      ]
    );

    // 5. Start test server
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
    await pool.query(`DELETE FROM agent_metrics WHERE organization_id IN ($1, $2)`, [testOrgAId, testOrgBId]).catch(() => {});
    await pool.query(`DELETE FROM agents WHERE id IN ($1, $2)`, [testAgentAId, testAgentBId]).catch(() => {});
    await pool.query(`DELETE FROM clusters WHERE id IN ($1, $2)`, [testClusterAId, testClusterBId]).catch(() => {});
    await pool.query(`DELETE FROM environments WHERE id IN ($1, $2)`, [testEnvAId, testEnvBId]).catch(() => {});
    await pool.query(`DELETE FROM organizations WHERE id IN ($1, $2)`, [testOrgAId, testOrgBId]).catch(() => {});
    await pool.query(`DELETE FROM users WHERE id IN ($1, $2)`, [testUserAId, testUserBId]).catch(() => {});

    await new Promise<void>((resolve) => {
      if (server) {
        if ('closeAllConnections' in server && typeof (server as any).closeAllConnections === 'function') {
          (server as any).closeAllConnections();
        }
        server.close(() => resolve());
      } else {
        resolve();
      }
    });
    await closeRedis().catch(() => {});
    await pool.end().catch(() => {});
  });

  test('1. Range 1h: returns only records from the last 1 hour', async () => {
    const res = await requestJson(
      '/api/v1/telemetry/metrics-history?range=1h&service_id=checkout-service-pb16-23',
      { token: tokenUserA }
    );

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    // In 1h for checkout-service-pb16-23, only pod-15m and pod-30m should be returned
    const pods = res.body.data.records.map((r: any) => r.pod_id);
    assert.strictEqual(pods.length, 2);
    assert.ok(pods.includes('pod-15m'));
    assert.ok(pods.includes('pod-30m'));
    assert.ok(!pods.includes('pod-2h'));
    assert.ok(!pods.includes('pod-12h'));
    assert.ok(!pods.includes('pod-3d'));
    assert.ok(!pods.includes('pod-10d'));
  });

  test('2. Range 24h: returns records from the last 24 hours', async () => {
    const res = await requestJson(
      '/api/v1/telemetry/metrics-history?range=24h&service_id=checkout-service-pb16-23',
      { token: tokenUserA }
    );

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    // In 24h, pod-15m, pod-30m, pod-2h, pod-12h should be returned (4 records)
    const pods = res.body.data.records.map((r: any) => r.pod_id);
    assert.strictEqual(pods.length, 4);
    assert.ok(pods.includes('pod-15m'));
    assert.ok(pods.includes('pod-30m'));
    assert.ok(pods.includes('pod-2h'));
    assert.ok(pods.includes('pod-12h'));
    assert.ok(!pods.includes('pod-3d'));
    assert.ok(!pods.includes('pod-5d'));
    assert.ok(!pods.includes('pod-10d'));
  });

  test('3. Range 7d: returns records within 7 days (168 hours), excluding older ones', async () => {
    const res = await requestJson(
      '/api/v1/telemetry/metrics-history?range=7d&service_id=checkout-service-pb16-23',
      { token: tokenUserA }
    );

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    // In 7d, pod-15m, pod-30m, pod-2h, pod-12h, pod-3d, pod-5d should be returned (6 records)
    // pod-10d (10 days ago) MUST be excluded!
    const pods = res.body.data.records.map((r: any) => r.pod_id);
    assert.strictEqual(pods.length, 6);
    assert.ok(pods.includes('pod-3d'));
    assert.ok(pods.includes('pod-5d'));
    assert.ok(!pods.includes('pod-10d'));
  });

  test('4. Range validation: rejects unsupported range with 400 Bad Request without silent fallback', async () => {
    const resInvalid = await requestJson(
      '/api/v1/telemetry/metrics-history?range=30m',
      { token: tokenUserA }
    );

    assert.strictEqual(resInvalid.status, 400);
    assert.strictEqual(resInvalid.body.success, false);

    const resBogus = await requestJson(
      '/api/v1/telemetry/metrics-history?range=custom_unsupported',
      { token: tokenUserA }
    );

    assert.strictEqual(resBogus.status, 400);
  });

  test('5. Boundary timestamp test: query filtered inside PostgreSQL strictly [from, to)', async () => {
    const res = await requestJson(
      '/api/v1/telemetry/metrics-history?range=1h&page=1&limit=100',
      { token: tokenUserA }
    );

    assert.strictEqual(res.status, 200);
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000 - 5000); // 5s grace margin
    for (const record of res.body.data.records) {
      const recTime = new Date(record.collected_at);
      assert.ok(
        recTime.getTime() >= oneHourAgo.getTime(),
        `Record ${record.pod_id} collected_at ${record.collected_at} should be >= 1h ago`
      );
    }
  });

  test('6. Pagination: defaults to page 1 and limit 50', async () => {
    const res = await requestJson(
      '/api/v1/telemetry/metrics-history',
      { token: tokenUserA }
    );

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.data.page, 1);
    assert.strictEqual(res.body.data.limit, 50);
  });

  test('7. Pagination: accepts limit up to 1000, rejects limit > 1000 with 400', async () => {
    const resValid = await requestJson(
      '/api/v1/telemetry/metrics-history?limit=1000',
      { token: tokenUserA }
    );
    assert.strictEqual(resValid.status, 200);
    assert.strictEqual(resValid.body.data.limit, 1000);

    const resOver = await requestJson(
      '/api/v1/telemetry/metrics-history?limit=1001',
      { token: tokenUserA }
    );
    assert.strictEqual(resOver.status, 400);

    const resNegative = await requestJson(
      '/api/v1/telemetry/metrics-history?limit=-5',
      { token: tokenUserA }
    );
    assert.strictEqual(resNegative.status, 400);
  });

  test('8. Pagination: rejects page <= 0 or non-numeric with 400', async () => {
    const resZero = await requestJson(
      '/api/v1/telemetry/metrics-history?page=0',
      { token: tokenUserA }
    );
    assert.strictEqual(resZero.status, 400);

    const resNeg = await requestJson(
      '/api/v1/telemetry/metrics-history?page=-1',
      { token: tokenUserA }
    );
    assert.strictEqual(resNeg.status, 400);

    const resNonNum = await requestJson(
      '/api/v1/telemetry/metrics-history?page=abc',
      { token: tokenUserA }
    );
    assert.strictEqual(resNonNum.status, 400);
  });

  test('9. Stable ordering: identical timestamps are consistently ordered by collected_at DESC, id DESC', async () => {
    // Request twice with page=1&limit=3 for inventory-service
    const res1 = await requestJson(
      '/api/v1/telemetry/metrics-history?service_id=inventory-service-pb16-23&page=1&limit=3&order=desc',
      { token: tokenUserA }
    );
    const res2 = await requestJson(
      '/api/v1/telemetry/metrics-history?service_id=inventory-service-pb16-23&page=1&limit=3&order=desc',
      { token: tokenUserA }
    );

    assert.strictEqual(res1.status, 200);
    assert.strictEqual(res2.status, 200);
    assert.strictEqual(res1.body.data.records.length, 3);

    const ids1 = res1.body.data.records.map((r: any) => r.id);
    const ids2 = res2.body.data.records.map((r: any) => r.id);
    assert.deepStrictEqual(ids1, ids2, 'Subsequent identical queries must yield identical record IDs order');
  });

  test('10. Pagination metadata: total, limit, page, and total_pages are accurate', async () => {
    const res = await requestJson(
      '/api/v1/telemetry/metrics-history?service_id=checkout-service-pb16-23&page=1&limit=2',
      { token: tokenUserA }
    );

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.data.total, 7); // 7 records total for checkout-service
    assert.strictEqual(res.body.data.limit, 2);
    assert.strictEqual(res.body.data.page, 1);
    assert.strictEqual(res.body.data.total_pages, 4); // ceil(7 / 2) = 4
    assert.strictEqual(res.body.data.records.length, 2);
  });

  test('11. Multi-tenant isolation: User A cannot read Org B metrics', async () => {
    // User A query for Org B's service
    const resUserA = await requestJson(
      '/api/v1/telemetry/metrics-history?service_id=org-b-service-task23',
      { token: tokenUserA }
    );
    assert.strictEqual(resUserA.status, 200);
    assert.strictEqual(resUserA.body.data.total, 0);
    assert.strictEqual(resUserA.body.data.records.length, 0);

    // User A trying to pass organization_id=OrgB -> 403 Forbidden
    const resForbidden = await requestJson(
      `/api/v1/telemetry/metrics-history?organization_id=${testOrgBId}`,
      { token: tokenUserA }
    );
    assert.strictEqual(resForbidden.status, 403);

    // User B CAN read Org B service
    const resUserB = await requestJson(
      '/api/v1/telemetry/metrics-history?service_id=org-b-service-task23',
      { token: tokenUserB }
    );
    assert.strictEqual(resUserB.status, 200);
    assert.strictEqual(resUserB.body.data.total, 1);
  });

  test('12. Convenience route /services/:serviceId/metrics-history supports range and pagination', async () => {
    const res = await requestJson(
      '/api/v1/telemetry/services/checkout-service-pb16-23/metrics-history?range=24h&limit=2&page=1',
      { token: tokenUserA }
    );

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.data.records.length, 2);
    assert.strictEqual(res.body.data.total, 4); // 4 records in 24h for checkout-service
    assert.strictEqual(res.body.data.total_pages, 2);
  });
});
