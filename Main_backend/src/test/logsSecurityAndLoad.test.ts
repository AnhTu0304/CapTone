import test, { describe, before, after } from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import { AddressInfo } from 'node:net';
import jwt from 'jsonwebtoken';
import app from '../app';
import { config } from '../config/env';
import { pool } from '../config/database';
import { closeRedis, testRedisConnection } from '../config/redis';
import { LogStreamService } from '../services/logStream.service';
import { LogModel } from '../models/log.model';

describe('Logs Security, Multi-Tenant Organization Isolation & Load Testing Suite [S4][PB17] 3.5', () => {
  let server: http.Server;
  let baseUrl: string;

  // Organizations
  const orgAId = 'a1000000-0000-4000-8000-000000000001';
  const orgBId = 'b1000000-0000-4000-8000-000000000002';

  // Users
  const superAdminId = 'c1000000-0000-4000-8000-000000000001';
  const ownerAId = 'c1000000-0000-4000-8000-000000000002';
  const ownerBId = 'c1000000-0000-4000-8000-000000000003';
  const suspendedUserId = 'c1000000-0000-4000-8000-000000000004';

  // Environments
  const envAId = 'e1000000-0000-4000-8000-000000000001';
  const envBId = 'e1000000-0000-4000-8000-000000000002';

  // Clusters
  const clusterAId = 'f1000000-0000-4000-8000-000000000001';
  const clusterBId = 'f1000000-0000-4000-8000-000000000002';

  // Tokens
  let superAdminToken: string;
  let ownerAToken: string;
  let ownerBToken: string;
  let suspendedUserToken: string;

  let smeOwnerRoleId: string;

  before(async () => {
    await testRedisConnection();

    // 1. Fetch SME_OWNER role ID
    const rolesRes = await pool.query(`SELECT id FROM roles WHERE code = 'SME_OWNER' AND scope = 'ORGANIZATION'`);
    smeOwnerRoleId = rolesRes.rows[0]?.id;

    // 2. Insert Users
    await pool.query(
      `INSERT INTO users (id, email, password_hash, full_name, status, created_at, updated_at)
       VALUES 
         ($1, 'super.pb17@test.com', 'dummy_hash', 'Super Admin PB17', 'ACTIVE', NOW(), NOW()),
         ($2, 'owner.a.pb17@test.com', 'dummy_hash', 'Owner A PB17', 'ACTIVE', NOW(), NOW()),
         ($3, 'owner.b.pb17@test.com', 'dummy_hash', 'Owner B PB17', 'ACTIVE', NOW(), NOW()),
         ($4, 'suspended.pb17@test.com', 'dummy_hash', 'Suspended PB17', 'SUSPENDED', NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, deleted_at = NULL;`,
      [superAdminId, ownerAId, ownerBId, suspendedUserId]
    );

    // 3. Assign SUPER_ADMIN system role
    const sysRoleRes = await pool.query(`SELECT id FROM system_roles WHERE name = 'SUPER_ADMIN'`);
    if (sysRoleRes.rows[0]) {
      await pool.query(
        `INSERT INTO user_system_roles (user_id, system_role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING;`,
        [superAdminId, sysRoleRes.rows[0].id]
      );
    }

    // 4. Insert Organizations
    await pool.query(
      `INSERT INTO organizations (id, name, slug, status, created_by, created_at, updated_at)
       VALUES 
         ($1, 'PB17 Alpha Enterprise', 'pb17-alpha-enterprise', 'ACTIVE', $2, NOW(), NOW()),
         ($3, 'PB17 Beta Logistics', 'pb17-beta-logistics', 'ACTIVE', $4, NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET status = 'ACTIVE', deleted_at = NULL;`,
      [orgAId, ownerAId, orgBId, ownerBId]
    );

    // 5. Insert Organization Memberships
    if (smeOwnerRoleId) {
      await pool.query(
        `INSERT INTO organization_members (organization_id, user_id, role_id, status, joined_at)
         VALUES 
           ($1, $2, $3, 'ACTIVE', NOW()),
           ($4, $5, $3, 'ACTIVE', NOW()),
           ($1, $6, $3, 'INACTIVE', NOW())
         ON CONFLICT (organization_id, user_id) 
         DO UPDATE SET status = EXCLUDED.status;`,
        [orgAId, ownerAId, smeOwnerRoleId, orgBId, ownerBId, suspendedUserId]
      );
    }

    // 6. Insert Environments
    await pool.query(
      `INSERT INTO environments (id, organization_id, name, code, environment_type, created_by, created_at, updated_at)
       VALUES 
         ($1, $2, 'Env Alpha Production', 'env-alpha-prod', 'PRODUCTION', $3, NOW(), NOW()),
         ($4, $5, 'Env Beta Production', 'env-beta-prod', 'PRODUCTION', $6, NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET organization_id = EXCLUDED.organization_id;`,
      [envAId, orgAId, ownerAId, envBId, orgBId, ownerBId]
    );

    // 7. Insert Clusters
    await pool.query(
      `INSERT INTO clusters (id, environment_id, name, provider, status, created_at, updated_at)
       VALUES 
         ($1, $2, 'k8s-cluster-alpha', 'EKS', 'CONNECTED', NOW(), NOW()),
         ($3, $4, 'k8s-cluster-beta', 'GKE', 'CONNECTED', NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET status = 'CONNECTED', deleted_at = NULL;`,
      [clusterAId, envAId, clusterBId, envBId]
    );

    // 8. Sign Tokens
    const sign = (id: string, email: string, roles: string[] = ['USER'], orgId?: string, status: string = 'ACTIVE') =>
      jwt.sign({ id, email, status, roles, organization_id: orgId }, config.jwt.secret, {
        expiresIn: '1h',
        algorithm: 'HS256',
      });

    superAdminToken = sign(superAdminId, 'super.pb17@test.com', ['SUPER_ADMIN']);
    ownerAToken = sign(ownerAId, 'owner.a.pb17@test.com', ['SME_OWNER'], orgAId);
    ownerBToken = sign(ownerBId, 'owner.b.pb17@test.com', ['SME_OWNER'], orgBId);
    suspendedUserToken = sign(suspendedUserId, 'suspended.pb17@test.com', ['SME_OWNER'], orgAId, 'SUSPENDED');

    // 9. Seed Identifiable Logs
    await LogModel.create({
      cluster_id: clusterAId,
      service_id: 'order-service-alpha',
      level: 'INFO',
      message: 'Alpha order processed secret_marker=ALPHA_SECRET_KEYWORD_X99',
      source: 'k8s-agent',
      occurred_at: new Date(),
      metadata: {
        organization_id: orgAId,
        pod_name: 'alpha-pod-01',
        namespace: 'production',
      },
    });

    await LogModel.create({
      cluster_id: clusterBId,
      service_id: 'payment-service-beta',
      level: 'ERROR',
      message: 'Beta confidential transaction failed marker=BETA_CONFIDENTIAL_MARKER_Y88',
      source: 'k8s-agent',
      occurred_at: new Date(),
      metadata: {
        organization_id: orgBId,
        pod_name: 'beta-pod-02',
        namespace: 'production',
      },
    });

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
    LogStreamService.resetForTesting();
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    // Cleanup seeded records
    await pool.query(`DELETE FROM logs WHERE cluster_id IN ($1, $2);`, [clusterAId, clusterBId]);
    await pool.query(`DELETE FROM clusters WHERE id IN ($1, $2);`, [clusterAId, clusterBId]);
    await pool.query(`DELETE FROM environments WHERE id IN ($1, $2);`, [envAId, envBId]);
    await pool.query(`DELETE FROM organization_members WHERE organization_id IN ($1, $2);`, [orgAId, orgBId]);
    await pool.query(`DELETE FROM organizations WHERE id IN ($1, $2);`, [orgAId, orgBId]);
    await pool.query(`DELETE FROM user_system_roles WHERE user_id = $1;`, [superAdminId]);
    await pool.query(`DELETE FROM users WHERE id IN ($1, $2, $3, $4);`, [
      superAdminId,
      ownerAId,
      ownerBId,
      suspendedUserId,
    ]);
    try {
      await pool.end();
    } catch {}
    try {
      await closeRedis();
    } catch {}
  });

  describe('1. Organization Data Isolation & Cross-Tenant Security', () => {
    test('1.1. Owner A queries logs and ONLY receives Org Alpha records', async () => {
      const res = await fetch(`${baseUrl}/api/v1/telemetry/logs`, {
        headers: { Authorization: `Bearer ${ownerAToken}` },
      });
      assert.strictEqual(res.status, 200);
      const json: any = await res.json();
      assert.ok(Array.isArray(json.data.logs));

      const hasAlpha = json.data.logs.some((l: any) => l.message.includes('ALPHA_SECRET_KEYWORD_X99'));
      const hasBeta = json.data.logs.some((l: any) => l.message.includes('BETA_CONFIDENTIAL_MARKER_Y88'));

      assert.strictEqual(hasAlpha, true, 'Owner A should see Alpha logs');
      assert.strictEqual(hasBeta, false, 'Owner A MUST NOT see Beta logs');
    });

    test('1.2. Owner B queries logs and ONLY receives Org Beta records', async () => {
      const res = await fetch(`${baseUrl}/api/v1/telemetry/logs`, {
        headers: { Authorization: `Bearer ${ownerBToken}` },
      });
      assert.strictEqual(res.status, 200);
      const json: any = await res.json();
      assert.ok(Array.isArray(json.data.logs));

      const hasAlpha = json.data.logs.some((l: any) => l.message.includes('ALPHA_SECRET_KEYWORD_X99'));
      const hasBeta = json.data.logs.some((l: any) => l.message.includes('BETA_CONFIDENTIAL_MARKER_Y88'));

      assert.strictEqual(hasBeta, true, 'Owner B should see Beta logs');
      assert.strictEqual(hasAlpha, false, 'Owner B MUST NOT see Alpha logs');
    });

    test('1.3. Owner A searching for Beta marker yields 0 records (No search leak)', async () => {
      const res = await fetch(`${baseUrl}/api/v1/telemetry/logs?search=BETA_CONFIDENTIAL_MARKER_Y88`, {
        headers: { Authorization: `Bearer ${ownerAToken}` },
      });
      assert.strictEqual(res.status, 200);
      const json: any = await res.json();
      assert.strictEqual(json.data.logs.length, 0, 'Cross-tenant search must return 0 records');
    });

    test('1.4. Cross-cluster access: Owner A querying Org B cluster returns 403 Forbidden', async () => {
      const res = await fetch(`${baseUrl}/api/v1/telemetry/logs?cluster_id=${clusterBId}`, {
        headers: { Authorization: `Bearer ${ownerAToken}` },
      });
      assert.strictEqual(res.status, 403);
      const json: any = await res.json();
      assert.ok(json.message.includes('Từ chối truy cập'));
    });

    test('1.5. Cross-cluster access: Owner B querying Org A cluster returns 403 Forbidden', async () => {
      const res = await fetch(`${baseUrl}/api/v1/telemetry/logs?cluster_id=${clusterAId}`, {
        headers: { Authorization: `Bearer ${ownerBToken}` },
      });
      assert.strictEqual(res.status, 403);
    });

    test('1.6. Organization parameter spoofing: Owner A passing ?organization_id=orgBId returns 403 Forbidden', async () => {
      const res = await fetch(`${baseUrl}/api/v1/telemetry/logs?organization_id=${orgBId}`, {
        headers: { Authorization: `Bearer ${ownerAToken}` },
      });
      assert.strictEqual(res.status, 403);
    });

    test('1.7. Super Admin can query logs across all organizations', async () => {
      const res = await fetch(`${baseUrl}/api/v1/telemetry/logs`, {
        headers: { Authorization: `Bearer ${superAdminToken}` },
      });
      assert.strictEqual(res.status, 200);
      const json: any = await res.json();
      const hasAlpha = json.data.logs.some((l: any) => l.message.includes('ALPHA_SECRET_KEYWORD_X99'));
      const hasBeta = json.data.logs.some((l: any) => l.message.includes('BETA_CONFIDENTIAL_MARKER_Y88'));
      assert.ok(hasAlpha && hasBeta, 'Super Admin should have global visibility');
    });

    test('1.8. Unauthenticated requests are rejected with 401 Unauthorized', async () => {
      const res = await fetch(`${baseUrl}/api/v1/telemetry/logs`);
      assert.strictEqual(res.status, 401);
    });

    test('1.9. Suspended user request is rejected with 403 Forbidden', async () => {
      const res = await fetch(`${baseUrl}/api/v1/telemetry/logs`, {
        headers: { Authorization: `Bearer ${suspendedUserToken}` },
      });
      assert.strictEqual(res.status, 403);
    });
  });

  describe('2. Query Parameter Validation & Bounds Enforcement', () => {
    test('2.1. Rejects invalid time range where start_time > end_time with 400 Bad Request', async () => {
      const res = await fetch(
        `${baseUrl}/api/v1/telemetry/logs?start_time=2026-10-27T12:00:00Z&end_time=2026-10-27T10:00:00Z`,
        { headers: { Authorization: `Bearer ${ownerAToken}` } }
      );
      assert.strictEqual(res.status, 400);
    });

    test('2.2. Rejects limit > 200 with 400 Bad Request (Max Page Size boundary)', async () => {
      const res = await fetch(`${baseUrl}/api/v1/telemetry/logs?limit=500`, {
        headers: { Authorization: `Bearer ${ownerAToken}` },
      });
      assert.strictEqual(res.status, 400);
    });

    test('2.3. Query by severity level, namespace, and time range', async () => {
      const res = await fetch(
        `${baseUrl}/api/v1/telemetry/logs?cluster_id=${clusterAId}&level=INFO&namespace=production&range=24h`,
        { headers: { Authorization: `Bearer ${ownerAToken}` } }
      );
      assert.strictEqual(res.status, 200);
      const json: any = await res.json();
      assert.ok(json.data.logs.length >= 1);
      assert.strictEqual(json.data.logs[0].level, 'INFO');
    });

    test('2.4. Deterministic ordering: Results ordered by occurred_at DESC, id DESC', async () => {
      const res = await fetch(`${baseUrl}/api/v1/telemetry/logs?limit=10`, {
        headers: { Authorization: `Bearer ${superAdminToken}` },
      });
      assert.strictEqual(res.status, 200);
      const json: any = await res.json();
      const logs = json.data.logs;
      if (logs.length >= 2) {
        const time0 = new Date(logs[0].occurred_at).getTime();
        const time1 = new Date(logs[1].occurred_at).getTime();
        assert.ok(time0 >= time1, 'Logs must be in descending chronological order');
      }
    });
  });

  describe('3. Real-Time Streaming Security & Isolation', () => {
    test('3.1. Owner A opening stream on Org B cluster is rejected with 403 Forbidden', async () => {
      const res = await fetch(`${baseUrl}/api/v1/telemetry/logs/stream?tail=0&cluster_id=${clusterBId}`, {
        headers: { Authorization: `Bearer ${ownerAToken}` },
      });
      assert.strictEqual(res.status, 403);
    });

    test('3.2. Streaming event isolation: Org B log event is NOT emitted to Owner A stream', async () => {
      const controllerA = new AbortController();
      const resA = await fetch(`${baseUrl}/api/v1/telemetry/logs/stream?tail=0&cluster_id=${clusterAId}`, {
        headers: { Authorization: `Bearer ${ownerAToken}` },
        signal: controllerA.signal,
      });
      assert.strictEqual(resA.status, 200);

      const readerA = resA.body!.getReader();
      const decoder = new TextDecoder();

      // Emit log for Org B
      setTimeout(() => {
        LogStreamService.emitLog({
          id: 'leak-test-log-beta',
          organization_id: orgBId,
          cluster_id: clusterBId,
          service_id: 'beta-svc',
          level: 'WARN',
          message: 'Confidential stream event for beta only',
          occurred_at: new Date().toISOString(),
          metadata: { organization_id: orgBId },
        });

        // Follow up with matching log for Org A
        setTimeout(() => {
          LogStreamService.emitLog({
            id: 'valid-stream-log-alpha',
            organization_id: orgAId,
            cluster_id: clusterAId,
            service_id: 'alpha-svc',
            level: 'INFO',
            message: 'Valid stream event for alpha',
            occurred_at: new Date().toISOString(),
            metadata: { organization_id: orgAId },
          });
        }, 40);
      }, 40);

      let receivedData = '';
      while (true) {
        const { value, done } = await readerA.read();
        if (done) break;
        receivedData += decoder.decode(value, { stream: true });
        if (receivedData.includes('Valid stream event for alpha')) {
          break;
        }
      }

      controllerA.abort();

      assert.ok(!receivedData.includes('Confidential stream event for beta only'), 'Owner A stream must NOT leak Org B logs');
      assert.ok(receivedData.includes('Valid stream event for alpha'));
    });
  });

  describe('4. Controlled Performance & Load Scenarios', () => {
    test('4.1. Concurrency load test: 50 simultaneous search queries (p50, p95, p99 latency verification)', async () => {
      const concurrentCount = 50;
      const latencies: number[] = [];
      let successCount = 0;

      const runQuery = async (idx: number) => {
        const start = performance.now();
        const res = await fetch(`${baseUrl}/api/v1/telemetry/logs?search=order&limit=25`, {
          headers: { Authorization: `Bearer ${ownerAToken}` },
        });
        const duration = performance.now() - start;
        latencies.push(duration);
        if (res.status === 200) {
          successCount++;
        }
      };

      await Promise.all(Array.from({ length: concurrentCount }, (_, i) => runQuery(i)));

      latencies.sort((a, b) => a - b);
      const p50 = latencies[Math.floor(latencies.length * 0.5)];
      const p95 = latencies[Math.floor(latencies.length * 0.95)];
      const p99 = latencies[Math.floor(latencies.length * 0.99)];

      console.log(`\n    📊 Load Benchmark (50 Concurrent Requests):`);
      console.log(`       - Success Rate: ${successCount}/${concurrentCount} (100%)`);
      console.log(`       - Latency p50: ${p50.toFixed(2)}ms`);
      console.log(`       - Latency p95: ${p95.toFixed(2)}ms`);
      console.log(`       - Latency p99: ${p99.toFixed(2)}ms`);

      assert.strictEqual(successCount, concurrentCount, '100% of concurrent queries must succeed');
      assert.ok(p95 < 2000, `p95 latency should remain under 2000ms under 50 concurrent requests (actual: ${p95.toFixed(2)}ms)`);
    });

    test('4.2. Streaming connection ramp-up & clean teardown under burst emissions', async () => {
      const initialCounts = LogStreamService.getActiveCounts();
      assert.strictEqual(initialCounts.global, 0);

      // Open 5 concurrent streams (within per-user limit)
      const controllers: AbortController[] = [];
      const streams = await Promise.all(
        Array.from({ length: 4 }, async () => {
          const c = new AbortController();
          controllers.push(c);
          return fetch(`${baseUrl}/api/v1/telemetry/logs/stream?tail=0&cluster_id=${clusterAId}`, {
            headers: { Authorization: `Bearer ${ownerAToken}` },
            signal: c.signal,
          });
        })
      );

      for (const res of streams) {
        assert.strictEqual(res.status, 200);
      }

      const activeCounts = LogStreamService.getActiveCounts();
      assert.strictEqual(activeCounts.global, 4);

      // Burst emit 20 logs
      for (let i = 0; i < 20; i++) {
        LogStreamService.emitLog({
          id: `burst-log-${i}`,
          organization_id: orgAId,
          cluster_id: clusterAId,
          level: 'INFO',
          message: `Burst log message batch test #${i}`,
          occurred_at: new Date().toISOString(),
        });
      }

      // Disconnect all streams
      for (const c of controllers) {
        c.abort();
      }

      // Allow teardown tick
      await new Promise((r) => setTimeout(r, 80));

      const finalCounts = LogStreamService.getActiveCounts();
      assert.strictEqual(finalCounts.global, 0, 'All stream permits must be cleanly released to 0');
    });
  });
});
