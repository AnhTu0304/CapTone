import test, { describe, before, after } from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import { AddressInfo } from 'node:net';
import jwt from 'jsonwebtoken';
import app from '../app';
import { config } from '../config/env';
import { pool } from '../config/database';
import { testRedisConnection, closeRedis } from '../config/redis';
import { MetricModel } from '../models/metric.model';

describe('Cụm API Truy vấn Chuỗi Thời Gian Node Metrics (CPU, RAM, Disk, Network) [S5][PBI20 Task 2.2]', () => {
  let server: http.Server;
  let baseUrl: string;

  const ownerAId = 'a9000000-0000-4000-8000-000000000001';
  const ownerBId = 'a9000000-0000-4000-8000-000000000002';
  const superAdminId = 'a9000000-0000-4000-8000-000000000003';

  const orgAId = 'b9000000-0000-4000-8000-000000000001';
  const orgBId = 'b9000000-0000-4000-8000-000000000002';

  const envAId = 'c9000000-0000-4000-8000-000000000001';
  const envBId = 'c9000000-0000-4000-8000-000000000002';

  const clusterAId = 'd9000000-0000-4000-8000-000000000001';
  const clusterBId = 'd9000000-0000-4000-8000-000000000002';

  const nodeA1Id = '19000000-0000-4000-8000-000000000001';
  const nodeB1Id = '29000000-0000-4000-8000-000000000001';

  const agentAId = 'e9000000-0000-4000-8000-000000000001';
  const agentBId = 'e9000000-0000-4000-8000-000000000002';

  let ownerAJwt: string;
  let ownerBJwt: string;
  let superAdminJwt: string;

  const nowMs = Date.now();
  const t0 = new Date(nowMs - 300000); // 5 mins ago
  const t1 = new Date(nowMs - 240000); // 4 mins ago
  const t2 = new Date(nowMs - 180000); // 3 mins ago
  const t3 = new Date(nowMs - 120000); // 2 mins ago
  const t4 = new Date(nowMs - 60000);  // 1 min ago

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
    await pool.query(`DELETE FROM node_metrics WHERE agent_id IN ($1, $2)`, [agentAId, agentBId]);

    // Users
    await pool.query(
      `INSERT INTO users (id, email, password_hash, full_name, status, created_at, updated_at)
       VALUES
         ($1, 'owner.a.ts@test.com', 'dummy_hash', 'Owner A Timeseries', 'ACTIVE', NOW(), NOW()),
         ($2, 'owner.b.ts@test.com', 'dummy_hash', 'Owner B Timeseries', 'ACTIVE', NOW(), NOW()),
         ($3, 'superadmin.ts@test.com', 'dummy_hash', 'SuperAdmin Timeseries', 'ACTIVE', NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET status = 'ACTIVE', deleted_at = NULL;`,
      [ownerAId, ownerBId, superAdminId]
    );

    // Organizations
    await pool.query(
      `INSERT INTO organizations (id, name, slug, status, created_by, created_at, updated_at)
       VALUES
         ($1, 'TS Org A', 'ts-org-a', 'ACTIVE', $2, NOW(), NOW()),
         ($3, 'TS Org B', 'ts-org-b', 'ACTIVE', $4, NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET status = 'ACTIVE', deleted_at = NULL;`,
      [orgAId, ownerAId, orgBId, ownerBId]
    );

    // Memberships
    await pool.query(
      `INSERT INTO organization_members (organization_id, user_id, role_id, status, joined_at)
       VALUES
         ($1, $2, $3, 'ACTIVE', NOW()),
         ($4, $5, $3, 'ACTIVE', NOW())
       ON CONFLICT (organization_id, user_id) DO UPDATE SET status = 'ACTIVE';`,
      [orgAId, ownerAId, smeOwnerRoleId, orgBId, ownerBId]
    );

    // Environments
    await pool.query(
      `INSERT INTO environments (id, organization_id, name, code, environment_type, created_by, created_at, updated_at)
       VALUES
         ($1, $2, 'Env TS A', 'env-ts-a', 'PRODUCTION', $3, NOW(), NOW()),
         ($4, $5, 'Env TS B', 'env-ts-b', 'PRODUCTION', $6, NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET organization_id = EXCLUDED.organization_id;`,
      [envAId, orgAId, ownerAId, envBId, orgBId, ownerBId]
    );

    // Clusters
    await pool.query(
      `INSERT INTO clusters (id, environment_id, name, provider, status, created_at, updated_at)
       VALUES
         ($1, $2, 'cluster-ts-a', 'MINIKUBE', 'CONNECTED', NOW(), NOW()),
         ($3, $4, 'cluster-ts-b', 'MINIKUBE', 'CONNECTED', NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET environment_id = EXCLUDED.environment_id, deleted_at = NULL;`,
      [clusterAId, envAId, clusterBId, envBId]
    );

    // Nodes
    await pool.query(
      `INSERT INTO nodes (id, cluster_id, name, status, cpu_capacity_millicores, memory_capacity_bytes, disk_capacity_bytes, created_at, updated_at)
       VALUES
         ($1, $2, 'k8s-ts-node-a1', 'Ready', 8000, 17179869184, 107374182400, NOW(), NOW()),
         ($3, $4, 'k8s-ts-node-b1', 'Ready', 8000, 17179869184, 107374182400, NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET cluster_id = EXCLUDED.cluster_id, name = EXCLUDED.name;`,
      [nodeA1Id, clusterAId, nodeB1Id, clusterBId]
    );

    // Seed test node metrics for Node A1 across 5 distinct time buckets
    const samples = [
      { t: t0, cpu: 20.0, ram: 40.0, disk: 15.0, rx_rate: 1024.0, tx_rate: 512.0 },
      { t: t1, cpu: 35.0, ram: 45.0, disk: 15.2, rx_rate: 2048.0, tx_rate: 1024.0 },
      { t: t2, cpu: 60.0, ram: 50.0, disk: 15.5, rx_rate: 4096.0, tx_rate: 2048.0 },
      { t: t3, cpu: 45.0, ram: 48.0, disk: 15.6, rx_rate: 3072.0, tx_rate: 1536.0 },
      { t: t4, cpu: 25.0, ram: 42.0, disk: 15.8, rx_rate: 1536.0, tx_rate: 768.0 },
    ];

    for (const s of samples) {
      await pool.query(
        `INSERT INTO node_metrics (
          organization_id, environment_id, agent_id, cluster_id, node_id, node_name,
          cpu_usage_percent, cpu_cores,
          ram_total_bytes, ram_used_bytes, ram_available_bytes, ram_usage_percent,
          disk_total_bytes, disk_used_bytes, disk_available_bytes, disk_usage_percent, disk_filesystems,
          net_rx_bytes, net_tx_bytes, net_rx_bytes_per_sec, net_tx_bytes_per_sec, net_interfaces,
          collection_status, collection_errors, metadata, collected_at, created_at
        ) VALUES (
          $1, $2, $3, $4, $5, 'k8s-ts-node-a1',
          $6, 8,
          17179869184, ROUND(17179869184 * ($7 / 100.0)), 17179869184 - ROUND(17179869184 * ($7 / 100.0)), $7,
          107374182400, ROUND(107374182400 * ($8 / 100.0)), 107374182400 - ROUND(107374182400 * ($8 / 100.0)), $8, '[]'::jsonb,
          1000000, 500000, $9, $10, '[]'::jsonb,
          'OK', '{}'::jsonb, '{"source": "test"}'::jsonb, $11, NOW()
        )
        ON CONFLICT (agent_id, node_name, collected_at) DO NOTHING;`,
        [orgAId, envAId, agentAId, clusterAId, nodeA1Id, s.cpu, s.ram, s.disk, s.rx_rate, s.tx_rate, s.t]
      );
    }

    // Seed test metric for Node B1
    await pool.query(
      `INSERT INTO node_metrics (
        organization_id, environment_id, agent_id, cluster_id, node_id, node_name,
        cpu_usage_percent, cpu_cores,
        ram_total_bytes, ram_used_bytes, ram_available_bytes, ram_usage_percent,
        disk_total_bytes, disk_used_bytes, disk_available_bytes, disk_usage_percent, disk_filesystems,
        net_rx_bytes, net_tx_bytes, net_rx_bytes_per_sec, net_tx_bytes_per_sec, net_interfaces,
        collection_status, collection_errors, metadata, collected_at, created_at
      ) VALUES (
        $1, $2, $3, $4, $5, 'k8s-ts-node-b1',
        75.0, 8,
        17179869184, 8589934592, 8589934592, 50.0,
        107374182400, 42949672960, 64424509440, 40.0, '[]'::jsonb,
        2000000, 1000000, 5000.0, 2500.0, '[]'::jsonb,
        'OK', '{}'::jsonb, '{"source": "test"}'::jsonb, NOW(), NOW()
      )
      ON CONFLICT (agent_id, node_name, collected_at) DO NOTHING;`,
      [orgBId, envBId, agentBId, clusterBId, nodeB1Id]
    );

    // Generate JWT Tokens
    const secret = config.jwt.secret;
    ownerAJwt = jwt.sign(
      {
        id: ownerAId,
        email: 'owner.a.ts@test.com',
        roles: ['SME_OWNER'],
        organizationId: orgAId,
      },
      secret,
      { expiresIn: '1h' }
    );

    ownerBJwt = jwt.sign(
      {
        id: ownerBId,
        email: 'owner.b.ts@test.com',
        roles: ['SME_OWNER'],
        organizationId: orgBId,
      },
      secret,
      { expiresIn: '1h' }
    );

    superAdminJwt = jwt.sign(
      {
        id: superAdminId,
        email: 'superadmin.ts@test.com',
        roles: ['SUPER_ADMIN'],
      },
      secret,
      { expiresIn: '1h' }
    );

    server = http.createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve());
    });
    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}/api/v1`;
  });

  after(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    await pool.query(`DELETE FROM node_metrics WHERE agent_id IN ($1, $2)`, [agentAId, agentBId]);
    await closeRedis();
    await pool.end();
  });

  test('1. [TS-01] Authentication: Querying time-series without token returns 401 Unauthorized', async () => {
    const res = await requestJson('/telemetry/timeseries');
    assert.strictEqual(res.status, 401);
  });

  test('2. [TS-02] Default Query (metricType=ALL): Returns structured response with all 4 metric series and meta', async () => {
    const res = await requestJson(
      `/telemetry/timeseries?clusterId=${clusterAId}&nodeName=k8s-ts-node-a1&range=1h`,
      { headers: { Authorization: `Bearer ${ownerAJwt}` } }
    );

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    const data = res.body.data;

    assert.strictEqual(data.clusterId, clusterAId);
    assert.strictEqual(data.nodeName, 'k8s-ts-node-a1');
    assert.strictEqual(data.metricType, 'ALL');
    assert.ok(data.series, 'Expected series object');
    assert.ok(data.series.cpu, 'Expected cpu series');
    assert.ok(data.series.ram, 'Expected ram series');
    assert.ok(data.series.disk, 'Expected disk series');
    assert.ok(data.series.network, 'Expected network series');

    // Data points presence
    assert.ok(Array.isArray(data.series.cpu.dataPoints));
    assert.ok(data.series.cpu.dataPoints.length >= 1);
    assert.strictEqual(data.series.cpu.unit, '%');
    assert.strictEqual(data.series.network.unit, 'bytes/sec');

    // Meta checks
    assert.ok(data.meta);
    assert.ok(data.meta.startTime);
    assert.ok(data.meta.endTime);
    assert.ok(data.meta.count >= 1);
  });

  test('3. [TS-03] Single Metric CPU: metricType=CPU returns % unit and value/min/max points', async () => {
    const res = await requestJson(
      `/telemetry/timeseries?clusterId=${clusterAId}&nodeName=k8s-ts-node-a1&metricType=CPU&range=1h`,
      { headers: { Authorization: `Bearer ${ownerAJwt}` } }
    );

    assert.strictEqual(res.status, 200);
    const data = res.body.data;
    assert.strictEqual(data.metricType, 'CPU');
    assert.strictEqual(data.unit, '%');
    assert.ok(Array.isArray(data.dataPoints));
    assert.ok(data.dataPoints.length >= 1);

    const firstPt = data.dataPoints[0];
    assert.ok(firstPt.timestamp);
    assert.ok(typeof firstPt.value === 'number');
    assert.ok(typeof firstPt.min === 'number');
    assert.ok(typeof firstPt.max === 'number');
  });

  test('4. [TS-04] Single Metric RAM: metricType=RAM returns % and byte metrics', async () => {
    const res = await requestJson(
      `/telemetry/timeseries?clusterId=${clusterAId}&nodeName=k8s-ts-node-a1&metricType=RAM&range=1h`,
      { headers: { Authorization: `Bearer ${ownerAJwt}` } }
    );

    assert.strictEqual(res.status, 200);
    const data = res.body.data;
    assert.strictEqual(data.metricType, 'RAM');
    assert.strictEqual(data.unit, '%');
    assert.ok(Array.isArray(data.dataPoints));
    assert.ok(data.dataPoints.length >= 1);

    const pt = data.dataPoints[0];
    assert.ok(typeof pt.value === 'number');
    assert.ok(typeof pt.ram_used_bytes === 'number');
    assert.ok(typeof pt.ram_total_bytes === 'number');
  });

  test('5. [TS-05] Single Metric DISK: metricType=DISK returns % and used/total storage', async () => {
    const res = await requestJson(
      `/telemetry/timeseries?clusterId=${clusterAId}&nodeName=k8s-ts-node-a1&metricType=DISK&range=1h`,
      { headers: { Authorization: `Bearer ${ownerAJwt}` } }
    );

    assert.strictEqual(res.status, 200);
    const data = res.body.data;
    assert.strictEqual(data.metricType, 'DISK');
    assert.strictEqual(data.unit, '%');
    assert.ok(Array.isArray(data.dataPoints));
    assert.ok(data.dataPoints.length >= 1);

    const pt = data.dataPoints[0];
    assert.ok(typeof pt.value === 'number');
    assert.ok(typeof pt.disk_used_bytes === 'number');
    assert.ok(typeof pt.disk_total_bytes === 'number');
  });

  test('6. [TS-06] Single Metric NETWORK: metricType=NETWORK returns rx/tx throughput rates and bytes', async () => {
    const res = await requestJson(
      `/telemetry/timeseries?clusterId=${clusterAId}&nodeName=k8s-ts-node-a1&metricType=NETWORK&range=1h`,
      { headers: { Authorization: `Bearer ${ownerAJwt}` } }
    );

    assert.strictEqual(res.status, 200);
    const data = res.body.data;
    assert.strictEqual(data.metricType, 'NETWORK');
    assert.strictEqual(data.unit, 'bytes/sec');
    assert.ok(Array.isArray(data.dataPoints));
    assert.ok(data.dataPoints.length >= 1);

    const pt = data.dataPoints[0];
    assert.ok(typeof pt.rx_rate === 'number');
    assert.ok(typeof pt.tx_rate === 'number');
    assert.ok(typeof pt.rx_bytes === 'number');
    assert.ok(typeof pt.tx_bytes === 'number');
  });

  test('7. [TS-07] Node-scoped Endpoint: GET /telemetry/nodes/:nodeId/timeseries filters by nodeId parameter', async () => {
    const res = await requestJson(
      `/telemetry/nodes/${nodeA1Id}/timeseries?metricType=CPU&range=1h`,
      { headers: { Authorization: `Bearer ${ownerAJwt}` } }
    );

    assert.strictEqual(res.status, 200);
    const data = res.body.data;
    assert.strictEqual(data.nodeId, nodeA1Id);
    assert.strictEqual(data.metricType, 'CPU');
    assert.ok(data.dataPoints.length >= 1);
  });

  test('8. [TS-08] Downsampling Interval: range presets correctly map to appropriate bucketing seconds', async () => {
    const res15m = await requestJson(
      `/telemetry/timeseries?clusterId=${clusterAId}&nodeName=k8s-ts-node-a1&range=15m`,
      { headers: { Authorization: `Bearer ${ownerAJwt}` } }
    );
    assert.strictEqual(res15m.status, 200);
    assert.strictEqual(res15m.body.data.intervalSeconds, 15);

    const res24h = await requestJson(
      `/telemetry/timeseries?clusterId=${clusterAId}&nodeName=k8s-ts-node-a1&range=24h`,
      { headers: { Authorization: `Bearer ${ownerAJwt}` } }
    );
    assert.strictEqual(res24h.status, 200);
    assert.strictEqual(res24h.body.data.intervalSeconds, 300); // 5m buckets
  });

  test('9. [TS-09] Custom Interval: interval=60 sets intervalSeconds to 60', async () => {
    const res = await requestJson(
      `/telemetry/timeseries?clusterId=${clusterAId}&nodeName=k8s-ts-node-a1&interval=60s&range=1h`,
      { headers: { Authorization: `Bearer ${ownerAJwt}` } }
    );
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.data.intervalSeconds, 60);
  });

  test('10. [TS-10] Anti-IDOR: Tenant A querying foreign organization_id returns 403 Forbidden', async () => {
    const res = await requestJson(
      `/telemetry/timeseries?organizationId=${orgBId}&range=1h`,
      { headers: { Authorization: `Bearer ${ownerAJwt}` } }
    );
    assert.strictEqual(res.status, 403);
  });

  test('11. [TS-11] Anti-IDOR: Tenant A querying foreign cluster_id returns 403 Forbidden', async () => {
    const res = await requestJson(
      `/telemetry/timeseries?clusterId=${clusterBId}&range=1h`,
      { headers: { Authorization: `Bearer ${ownerAJwt}` } }
    );
    assert.strictEqual(res.status, 403);
  });

  test('12. [TS-12] Anti-IDOR: Tenant A querying foreign node returns 403 Forbidden', async () => {
    const res = await requestJson(
      `/telemetry/nodes/${nodeB1Id}/timeseries?range=1h`,
      { headers: { Authorization: `Bearer ${ownerAJwt}` } }
    );
    assert.strictEqual(res.status, 403);
  });

  test('13. [TS-13] Input Validation: startTime > endTime returns 400 Bad Request', async () => {
    const res = await requestJson(
      `/telemetry/timeseries?clusterId=${clusterAId}&startTime=2026-10-31T10:00:00Z&endTime=2026-10-31T09:00:00Z`,
      { headers: { Authorization: `Bearer ${ownerAJwt}` } }
    );
    assert.strictEqual(res.status, 400);
  });

  test('14. [TS-14] Input Validation: Invalid metricType returns 400 Bad Request', async () => {
    const res = await requestJson(
      `/telemetry/timeseries?clusterId=${clusterAId}&metricType=INVALID_METRIC`,
      { headers: { Authorization: `Bearer ${ownerAJwt}` } }
    );
    assert.strictEqual(res.status, 400);
  });

  test('15. [TS-15] SuperAdmin Access: SuperAdmin can query specific organization explicitly', async () => {
    const res = await requestJson(
      `/telemetry/timeseries?organizationId=${orgAId}&clusterId=${clusterAId}&range=1h`,
      { headers: { Authorization: `Bearer ${superAdminJwt}` } }
    );
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
  });

  test('16. [TS-16] Empty Result: Query for non-existent time range returns empty dataPoints (200 OK)', async () => {
    const res = await requestJson(
      `/telemetry/timeseries?clusterId=${clusterAId}&nodeName=k8s-ts-node-a1&startTime=2020-01-01T00:00:00Z&endTime=2020-01-01T01:00:00Z&metricType=CPU`,
      { headers: { Authorization: `Bearer ${ownerAJwt}` } }
    );
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.data.dataPoints.length, 0);
    assert.strictEqual(res.body.data.meta.count, 0);
  });
});
