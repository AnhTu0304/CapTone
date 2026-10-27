import test, { describe, before, after } from 'node:test';
import assert from 'node:assert';
import http from 'http';
import { AddressInfo } from 'net';
import jwt from 'jsonwebtoken';
import app from '../app';
import { pool } from '../config/database';
import { config } from '../config/env';
import { closeRedis } from '../config/redis';
import { MetricModel } from '../models/metric.model';

describe('PB16 Task 2.3 – Cursor-based Keyset Pagination Suite', () => {
  let server: http.Server;
  let baseUrl: string;

  const testOrgAId = 'e0000000-0000-4000-8000-00000000008a';
  const testOrgBId = 'e0000000-0000-4000-8000-00000000008b';
  const testEnvAId = 'e0000000-0000-4000-8000-00000000009a';
  const testEnvBId = 'e0000000-0000-4000-8000-00000000009b';
  const testClusterAId = 'e0000000-0000-4000-8000-00000000007a';
  const testClusterBId = 'e0000000-0000-4000-8000-00000000007b';

  const testAgentAId = 'e0000000-0000-4000-8000-00000000006a';
  const testAgentBId = 'e0000000-0000-4000-8000-00000000006b';

  const testUserAId = 'e0000000-0000-4000-8000-000000000051';
  const testUserBId = 'e0000000-0000-4000-8000-000000000052';
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
    // 1. Ensure schema
    await MetricModel.ensureAgentMetricsSchema();

    // 2. Insert tenants & users
    await pool.query(
      `INSERT INTO users (id, email, password_hash, full_name, status, created_at, updated_at)
       VALUES 
         ($1, 'user-a-cursor@pb16.io', 'hash123', 'User Cursor Org A', 'ACTIVE', NOW(), NOW()),
         ($2, 'user-b-cursor@pb16.io', 'hash123', 'User Cursor Org B', 'ACTIVE', NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET status = 'ACTIVE', deleted_at = NULL;`,
      [testUserAId, testUserBId]
    );

    await pool.query(
      `INSERT INTO organizations (id, name, slug, status, created_by, created_at, updated_at)
       VALUES 
         ($1, 'PB16 Cursor Org A', 'pb16-cursor-org-a', 'ACTIVE', $3, NOW(), NOW()),
         ($2, 'PB16 Cursor Org B', 'pb16-cursor-org-b', 'ACTIVE', $4, NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET status = 'ACTIVE', deleted_at = NULL;`,
      [testOrgAId, testOrgBId, testUserAId, testUserBId]
    );

    await pool.query(
      `INSERT INTO environments (id, organization_id, name, code, environment_type, created_by, created_at, updated_at)
       VALUES 
         ($1, $2, 'Cursor Prod A', 'cursor-prod-a', 'PRODUCTION', $3, NOW(), NOW()),
         ($4, $5, 'Cursor Prod B', 'cursor-prod-b', 'PRODUCTION', $6, NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET organization_id = EXCLUDED.organization_id;`,
      [testEnvAId, testOrgAId, testUserAId, testEnvBId, testOrgBId, testUserBId]
    );

    await pool.query(
      `INSERT INTO clusters (id, environment_id, name, provider, status, created_at, updated_at)
       VALUES 
         ($1, $2, 'cursor-cluster-a', 'MINIKUBE', 'CONNECTED', NOW(), NOW()),
         ($3, $4, 'cursor-cluster-b', 'MINIKUBE', 'CONNECTED', NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET environment_id = EXCLUDED.environment_id;`,
      [testClusterAId, testEnvAId, testClusterBId, testEnvBId]
    );

    await pool.query(
      `INSERT INTO agents (id, agent_uid, cluster_id, environment_id, name, version, status, created_at, updated_at)
       VALUES 
         ($1, 'uid-agent-cursor-a', $2, $3, 'agent-cursor-a', '1.0.0', 'ONLINE', NOW(), NOW()),
         ($4, 'uid-agent-cursor-b', $5, $6, 'agent-cursor-b', '1.0.0', 'ONLINE', NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET status = 'ONLINE', cluster_id = EXCLUDED.cluster_id, environment_id = EXCLUDED.environment_id;`,
      [testAgentAId, testClusterAId, testEnvAId, testAgentBId, testClusterBId, testEnvBId]
    );

    // 3. Tokens
    tokenUserA = jwt.sign(
      { id: testUserAId, email: 'user-a-cursor@pb16.io', roles: ['USER'], organizationId: testOrgAId },
      config.jwt.secret,
      { expiresIn: '2h' }
    );
    tokenUserB = jwt.sign(
      { id: testUserBId, email: 'user-b-cursor@pb16.io', roles: ['USER'], organizationId: testOrgBId },
      config.jwt.secret,
      { expiresIn: '2h' }
    );

    // 4. Seed 6 sequential records for Org A service 'cursor-stream-service':
    // Sample 1: 10m ago, pod-c-1
    // Sample 2: 8m ago, pod-c-2
    // Sample 3: 5m ago, pod-c-3 (same timestamp)
    // Sample 4: 5m ago, pod-c-4 (same timestamp)
    // Sample 5: 3m ago, pod-c-5
    // Sample 6: 1m ago, pod-c-6
    const baseTime = new Date('2026-10-26T12:00:00.000Z');
    await pool.query(
      `INSERT INTO agent_metrics (
        agent_id, cluster_id, organization_id, environment_id, service_id, pod_id,
        cpu, ram, disk, request_rate, latency, http_5xx_rate, pod_restart_count, replica_count, collected_at
      ) VALUES
        ($1, $2, $3, $4, 'cursor-stream-service', 'pod-c-1', 10.0, 20.0, 15.0, 10.0, 20.0, 0.0, 0, 1, $9::timestamptz + INTERVAL '1 minute'),
        ($1, $2, $3, $4, 'cursor-stream-service', 'pod-c-2', 12.0, 22.0, 15.0, 12.0, 22.0, 0.0, 0, 1, $9::timestamptz + INTERVAL '2 minutes'),
        ($1, $2, $3, $4, 'cursor-stream-service', 'pod-c-3', 14.0, 24.0, 15.0, 14.0, 24.0, 0.0, 0, 1, $9::timestamptz + INTERVAL '5 minutes'),
        ($1, $2, $3, $4, 'cursor-stream-service', 'pod-c-4', 16.0, 26.0, 15.0, 16.0, 26.0, 0.0, 0, 1, $9::timestamptz + INTERVAL '5 minutes'),
        ($1, $2, $3, $4, 'cursor-stream-service', 'pod-c-5', 18.0, 28.0, 15.0, 18.0, 28.0, 0.0, 0, 1, $9::timestamptz + INTERVAL '8 minutes'),
        ($1, $2, $3, $4, 'cursor-stream-service', 'pod-c-6', 20.0, 30.0, 15.0, 20.0, 30.0, 0.0, 0, 1, $9::timestamptz + INTERVAL '10 minutes'),

        -- Org B sample
        ($5, $6, $7, $8, 'cursor-stream-service', 'pod-org-b', 50.0, 50.0, 50.0, 10.0, 20.0, 0.0, 0, 1, $9::timestamptz + INTERVAL '10 minutes')
      ON CONFLICT DO NOTHING;`,
      [
        testAgentAId, testClusterAId, testOrgAId, testEnvAId,
        testAgentBId, testClusterBId, testOrgBId, testEnvBId,
        baseTime.toISOString()
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

  test('1. First page returns next_cursor and has_more: true when more records exist', async () => {
    const res = await requestJson(
      '/api/v1/telemetry/metrics-history?service_id=cursor-stream-service&limit=2&order=desc',
      { token: tokenUserA }
    );

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.records.length, 2);
    assert.strictEqual(res.body.data.has_more, true);
    assert.ok(typeof res.body.data.next_cursor === 'string' && res.body.data.next_cursor.length > 0);

    // In DESC order, first page has pod-c-6 (10m) and pod-c-5 (8m)
    assert.strictEqual(res.body.data.records[0].pod_id, 'pod-c-6');
    assert.strictEqual(res.body.data.records[1].pod_id, 'pod-c-5');
  });

  test('2. Keyset traversal: passing cursor=next_cursor returns next exact window without duplicates', async () => {
    // Page 1
    const res1 = await requestJson(
      '/api/v1/telemetry/metrics-history?service_id=cursor-stream-service&limit=2&order=desc',
      { token: tokenUserA }
    );
    assert.strictEqual(res1.status, 200);
    const cursor1 = res1.body.data.next_cursor;
    assert.ok(cursor1);

    // Page 2 using cursor1
    const res2 = await requestJson(
      `/api/v1/telemetry/metrics-history?service_id=cursor-stream-service&limit=2&order=desc&cursor=${cursor1}`,
      { token: tokenUserA }
    );
    assert.strictEqual(res2.status, 200);
    assert.strictEqual(res2.body.data.records.length, 2);
    assert.strictEqual(res2.body.data.has_more, true);

    const idsPage1 = res1.body.data.records.map((r: any) => r.id);
    const idsPage2 = res2.body.data.records.map((r: any) => r.id);

    // Ensure zero overlap between page 1 and page 2
    for (const id of idsPage2) {
      assert.ok(!idsPage1.includes(id), `Record ID ${id} must not appear on both page 1 and page 2`);
    }
  });

  test('3. Keyset traversal across identical timestamps: tie-breaker ID resolves correctly', async () => {
    // Page 2 ended with the two 5-minute samples (pod-c-3 and pod-c-4)
    // Let's traverse all 6 items step-by-step with limit=1 to verify every record is reached
    const visitedPods: string[] = [];
    let currentCursor: string | null = null;
    let iterations = 0;

    while (iterations < 10) {
      iterations++;
      const url = currentCursor
        ? `/api/v1/telemetry/metrics-history?service_id=cursor-stream-service&limit=1&order=desc&cursor=${currentCursor}`
        : `/api/v1/telemetry/metrics-history?service_id=cursor-stream-service&limit=1&order=desc`;
      
      const res = await requestJson(url, { token: tokenUserA });
      assert.strictEqual(res.status, 200);
      if (res.body.data.records.length === 0) break;

      visitedPods.push(res.body.data.records[0].pod_id);
      if (!res.body.data.has_more || !res.body.data.next_cursor) {
        break;
      }
      currentCursor = res.body.data.next_cursor;
    }

    assert.strictEqual(visitedPods.length, 6, 'Must traverse exactly all 6 records');
    assert.ok(visitedPods.includes('pod-c-3'));
    assert.ok(visitedPods.includes('pod-c-4'));
    assert.strictEqual(visitedPods[0], 'pod-c-6');
    assert.strictEqual(visitedPods[5], 'pod-c-1');
  });

  test('4. End of list: last page returns has_more: false and next_cursor: null', async () => {
    const res = await requestJson(
      '/api/v1/telemetry/metrics-history?service_id=cursor-stream-service&limit=10&order=desc',
      { token: tokenUserA }
    );

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.data.records.length, 6);
    assert.strictEqual(res.body.data.has_more, false);
    assert.strictEqual(res.body.data.next_cursor, null);
  });

  test('5. Rejects invalid or corrupted cursor with 400 Bad Request', async () => {
    const resInvalid = await requestJson(
      '/api/v1/telemetry/metrics-history?cursor=invalid_base64_string_!!!',
      { token: tokenUserA }
    );

    assert.strictEqual(resInvalid.status, 400);
    assert.strictEqual(resInvalid.body.success, false);

    // Corrupted JSON in valid base64
    const badJsonCursor = Buffer.from('{"random":"data"}').toString('base64url');
    const resBadJson = await requestJson(
      `/api/v1/telemetry/metrics-history?cursor=${badJsonCursor}`,
      { token: tokenUserA }
    );
    assert.strictEqual(resBadJson.status, 400);
  });

  test('6. Keyset pagination works with order=asc (oldest to newest)', async () => {
    const res1 = await requestJson(
      '/api/v1/telemetry/metrics-history?service_id=cursor-stream-service&limit=2&order=asc',
      { token: tokenUserA }
    );

    assert.strictEqual(res1.status, 200);
    assert.strictEqual(res1.body.data.records[0].pod_id, 'pod-c-1');
    assert.strictEqual(res1.body.data.records[1].pod_id, 'pod-c-2');
    assert.strictEqual(res1.body.data.has_more, true);
    assert.ok(res1.body.data.next_cursor);

    // Page 2 ASC
    const res2 = await requestJson(
      `/api/v1/telemetry/metrics-history?service_id=cursor-stream-service&limit=2&order=asc&cursor=${res1.body.data.next_cursor}`,
      { token: tokenUserA }
    );
    assert.strictEqual(res2.status, 200);
    assert.strictEqual(res2.body.data.records.length, 2);
    // Next records should be pod-c-3 and pod-c-4
    const pods = res2.body.data.records.map((r: any) => r.pod_id);
    assert.ok(pods.includes('pod-c-3'));
    assert.ok(pods.includes('pod-c-4'));
  });

  test('7. Multi-tenant isolation is preserved: Org A cannot read Org B metrics with cursor', async () => {
    const resUserA = await requestJson(
      '/api/v1/telemetry/metrics-history?service_id=cursor-stream-service&limit=20',
      { token: tokenUserA }
    );
    assert.strictEqual(resUserA.status, 200);
    const pods = resUserA.body.data.records.map((r: any) => r.pod_id);
    assert.ok(!pods.includes('pod-org-b'), 'User A must NEVER see Org B pods');
  });

  test('8. Backward compatibility: standard page/limit offset pagination still works and provides next_cursor', async () => {
    const res = await requestJson(
      '/api/v1/telemetry/metrics-history?service_id=cursor-stream-service&page=1&limit=3&order=desc',
      { token: tokenUserA }
    );

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.data.page, 1);
    assert.strictEqual(res.body.data.limit, 3);
    assert.strictEqual(res.body.data.total, 6);
    assert.strictEqual(res.body.data.total_pages, 2);
    assert.strictEqual(res.body.data.has_more, true);
    assert.ok(res.body.data.next_cursor);
  });
});
