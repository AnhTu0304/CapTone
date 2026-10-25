/**
 * @file benchmarkNodeMetricsTask44.ts
 * @description Repeatable Performance Benchmark for Task 4.4:
 * 1. Seeds 10,000 synthetic `node_metrics` rows for an isolated benchmark tenant/node (cleaned up in `finally`).
 * 2. Runs PostgreSQL `EXPLAIN (ANALYZE, BUFFERS)` to verify index usage (`idx_node_metrics_...`).
 * 3. Measures Express HTTP API latency (median, p95, p99), payload size, and error rate for:
 *    - 100 points (short window: 5m–15m)
 *    - 1,000 points (medium window: 1h–6h)
 *    - 10,000 points (large window: 24h+)
 *    - 20 concurrent requests burst test
 * 4. Measures Frontend `transformNodeMetricsForCharts` + `downsampleSeries` latency (median, p95, p99)
 *    across 100, 1,000, and 10,000 points.
 */

import http from 'node:http';
import { performance } from 'node:perf_hooks';
import jwt from 'jsonwebtoken';
import app from '../app';
import { config } from '../config/env';
import { pool } from '../config/database';
import { testRedisConnection, closeRedis } from '../config/redis';
import { MetricModel } from '../models/metric.model';
// @ts-ignore - Import pure JS Frontend utility for transform/downsample benchmarking
import { transformNodeMetricsForCharts } from '../../../Frontend/src/utils/nodeMetricsChartUtils.js';

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return Math.round(sorted[idx] * 100) / 100;
}

function httpGetJson(
  baseUrl: string,
  path: string,
  token: string
): Promise<{ status: number; durationMs: number; payloadBytes: number; body: any }> {
  return new Promise((resolve, reject) => {
    const start = performance.now();
    const url = new URL(path, baseUrl);
    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        res.on('end', () => {
          const durationMs = performance.now() - start;
          const rawBuf = Buffer.concat(chunks);
          let parsed: any = null;
          try {
            parsed = JSON.parse(rawBuf.toString('utf8'));
          } catch {}
          resolve({
            status: res.statusCode || 0,
            durationMs,
            payloadBytes: rawBuf.byteLength,
            body: parsed,
          });
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

async function runBenchmark() {
  const userId = 'a4400000-0000-4000-8000-000000000044';
  const orgId = 'b4400000-0000-4000-8000-000000000044';
  const envId = 'c4400000-0000-4000-8000-000000000044';
  const clusterId = 'd4400000-0000-4000-8000-000000000044';
  const agentId = 'e4400000-0000-4000-8000-000000000044';
  const nodeId = '14400000-0000-4000-8000-000000000044';
  const nodeName = 'k8s-perf-bench-node-44';

  await testRedisConnection();
  await MetricModel.ensureNodeMetricsTable();

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const addr = server.address() as { port: number };
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  try {
    console.log('=== [Task 4.4 Performance Benchmark] Setting up isolated 10,000-point dataset ===');

    const rolesRes = await pool.query(`SELECT id, code FROM roles WHERE scope = 'ORGANIZATION'`);
    const smeOwnerRoleId = rolesRes.rows.find((r) => r.code === 'SME_OWNER')?.id;

    await pool.query(
      `INSERT INTO users (id, email, password_hash, full_name, status, created_at, updated_at)
       VALUES ($1, 'perf44@aegis.local', 'dummy_hash', 'Perf 44 User', 'ACTIVE', NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET status = 'ACTIVE', deleted_at = NULL`,
      [userId]
    );
    await pool.query(
      `INSERT INTO organizations (id, name, slug, status, created_by, created_at, updated_at)
       VALUES ($1, 'Perf Org 44', 'perf-org-44-slug', 'ACTIVE', $2, NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET status = 'ACTIVE', deleted_at = NULL`,
      [orgId, userId]
    );
    await pool.query(
      `INSERT INTO organization_members (organization_id, user_id, role_id, status, joined_at)
       VALUES ($1, $2, $3, 'ACTIVE', NOW())
       ON CONFLICT (organization_id, user_id) DO UPDATE SET status = 'ACTIVE'`,
      [orgId, userId, smeOwnerRoleId]
    );
    await pool.query(
      `INSERT INTO environments (id, organization_id, name, code, environment_type, created_by, created_at, updated_at)
       VALUES ($1, $2, 'Perf Prod 44', 'perf-prod-44', 'PRODUCTION', $3, NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET organization_id = EXCLUDED.organization_id`,
      [envId, orgId, userId]
    );
    await pool.query(
      `INSERT INTO clusters (id, environment_id, name, provider, status, created_at, updated_at)
       VALUES ($1, $2, 'perf-cluster-44', 'MINIKUBE', 'CONNECTED', NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET environment_id = EXCLUDED.environment_id, deleted_at = NULL`,
      [clusterId, envId]
    );
    await pool.query(
      `INSERT INTO nodes (id, cluster_id, name, status, cpu_capacity_millicores, memory_capacity_bytes, disk_capacity_bytes, created_at, updated_at)
       VALUES ($1, $2, $3, 'Ready', 8000, 17179869184, 107374182400, NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET cluster_id = EXCLUDED.cluster_id, name = EXCLUDED.name`,
      [nodeId, clusterId, nodeName]
    );
    await pool.query(
      `INSERT INTO agents (id, agent_uid, cluster_id, environment_id, name, version, status, created_at, updated_at)
       VALUES ($1, 'agent-uid-perf-44', $2, $3, 'perf-agent-44', '1.0.0', 'ONLINE', NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET status = 'ONLINE', cluster_id = EXCLUDED.cluster_id`,
      [agentId, clusterId, envId]
    );

    await pool.query(`DELETE FROM node_metrics WHERE agent_id = $1`, [agentId]);

    // Bulk insert 10,000 points using PostgreSQL generate_series (5s interval = ~13.8 hours of telemetry)
    const insertStart = performance.now();
    await pool.query(
      `INSERT INTO node_metrics (
        organization_id, environment_id, agent_id, cluster_id, node_id, node_name,
        cpu_usage_percent, cpu_cores,
        ram_total_bytes, ram_used_bytes, ram_available_bytes, ram_usage_percent,
        disk_total_bytes, disk_used_bytes, disk_available_bytes, disk_usage_percent, disk_filesystems,
        net_rx_bytes, net_tx_bytes, net_rx_bytes_per_sec, net_tx_bytes_per_sec, net_interfaces,
        collection_status, collection_errors, metadata, collected_at, created_at
      )
      SELECT
        $1::uuid,
        $2::uuid,
        $3,
        $4,
        $5::uuid,
        $6,
        ROUND((20 + (i % 75) + CASE WHEN i = 5000 THEN 24.5 ELSE 0 END)::numeric, 2),
        8,
        17179869184,
        8589934592 + (i % 1000) * 1048576,
        8589934592 - (i % 1000) * 1048576,
        ROUND((50 + (i % 35) * 0.5)::numeric, 2),
        107374182400,
        42949672960,
        64424509440,
        40.0,
        '[{"device":"/dev/nvme0n1p1","mount_point":"/","fs_type":"ext4","total_bytes":107374182400,"used_bytes":42949672960,"available_bytes":64424509440,"usage_percent":40.0}]'::jsonb,
        1000000 + i * 2048,
        500000 + i * 1024,
        ROUND((1024 + (i % 500) * 12.5)::numeric, 2),
        ROUND((512 + (i % 300) * 8.25)::numeric, 2),
        '[]'::jsonb,
        'OK',
        '{}'::jsonb,
        '{"platform":"linux"}'::jsonb,
        NOW() - ((10000 - i) * INTERVAL '5 seconds'),
        NOW()
      FROM generate_series(1, 10000) AS s(i);`,
      [orgId, envId, agentId, clusterId, nodeId, nodeName]
    );
    await pool.query(`ANALYZE node_metrics;`);
    const insertMs = Math.round((performance.now() - insertStart) * 100) / 100;
    console.log(`✔ Seeded 10,000 node_metrics rows + ANALYZE in ${insertMs} ms\n`);

    // 1. PostgreSQL EXPLAIN (ANALYZE, BUFFERS) check
    const explainRes = await pool.query(
      `EXPLAIN (ANALYZE, BUFFERS)
       SELECT nm.id, nm.node_name, nm.cpu_usage_percent, nm.collected_at
       FROM node_metrics nm
       WHERE nm.organization_id = $1::uuid
         AND nm.cluster_id = $2
         AND nm.node_id = $3::uuid
         AND nm.collected_at >= NOW() - INTERVAL '15 hours'
       ORDER BY nm.collected_at DESC, nm.id DESC
       LIMIT 200 OFFSET 0;`,
      [orgId, clusterId, nodeId]
    );
    console.log('=== 1. PostgreSQL EXPLAIN (ANALYZE, BUFFERS) Plan ===');
    for (const r of explainRes.rows) {
      console.log('  ', r['QUERY PLAN']);
    }
    console.log('');

    // 2. HTTP API Benchmark across 100, 1,000, and 10,000 points
    const token = jwt.sign(
      { id: userId, email: 'perf44@aegis.local', roles: ['SME_OWNER'] },
      config.jwt.secret,
      { expiresIn: '1h' }
    );

    const sizes = [100, 1000, 10000];
    const apiResults: Record<number, any> = {};
    const fetchedItemsBySize: Record<number, any[]> = {};

    console.log('=== 2. Backend HTTP Query API Benchmark (20 iterations per dataset size) ===');
    for (const limit of sizes) {
      const path = `/api/v1/organizations/${orgId}/clusters/${clusterId}/nodes/${nodeId}/metrics?limit=${limit}&order=asc`;
      // Warmup
      await httpGetJson(baseUrl, path, token);

      const latencies: number[] = [];
      let errors = 0;
      let payloadBytes = 0;

      for (let iter = 0; iter < 20; iter++) {
        const res = await httpGetJson(baseUrl, path, token);
        latencies.push(res.durationMs);
        payloadBytes = res.payloadBytes;
        if (res.status !== 200 || !res.body?.success) {
          errors++;
        }
        if (iter === 0) {
          fetchedItemsBySize[limit] = res.body?.data?.items || [];
        }
      }

      latencies.sort((a, b) => a - b);
      apiResults[limit] = {
        pointsReturned: fetchedItemsBySize[limit]?.length || 0,
        medianMs: percentile(latencies, 50),
        p95Ms: percentile(latencies, 95),
        p99Ms: percentile(latencies, 99),
        payloadKiB: Math.round((payloadBytes / 1024) * 10) / 10,
        errorRatePercent: (errors / 20) * 100,
      };
      console.log(
        `  • Dataset ${limit} points -> returned=${apiResults[limit].pointsReturned}, median=${apiResults[limit].medianMs}ms, p95=${apiResults[limit].p95Ms}ms, p99=${apiResults[limit].p99Ms}ms, payload=${apiResults[limit].payloadKiB} KiB, errorRate=${apiResults[limit].errorRatePercent}%`
      );
    }

    // 3. Concurrent Burst Benchmark (20 simultaneous requests for 200 points)
    const burstPath = `/api/v1/organizations/${orgId}/clusters/${clusterId}/nodes/${nodeId}/metrics?limit=200&order=asc`;
    const burstStart = performance.now();
    const burstResponses = await Promise.all(
      Array.from({ length: 20 }, () => httpGetJson(baseUrl, burstPath, token))
    );
    const burstTotalMs = Math.round((performance.now() - burstStart) * 100) / 100;
    const burstLatencies = burstResponses.map((r) => r.durationMs).sort((a, b) => a - b);
    const burstErrors = burstResponses.filter((r) => r.status !== 200).length;
    console.log(
      `  • Concurrent Burst (20 parallel requests, 200 pts each) -> totalWallTime=${burstTotalMs}ms, median=${percentile(burstLatencies, 50)}ms, p95=${percentile(burstLatencies, 95)}ms, p99=${percentile(burstLatencies, 99)}ms, errors=${burstErrors}/20\n`
    );

    // 4. Frontend Transform + Extrema-Preserving Downsample Benchmark (50 iterations per dataset size)
    console.log('=== 3. Frontend Chart Transform & Downsample Benchmark (50 iterations per size) ===');
    for (const size of sizes) {
      const rawDataset = fetchedItemsBySize[size] || [];
      const timings: number[] = [];
      let plottedCount = 0;

      const memBefore = process.memoryUsage().heapUsed;
      for (let iter = 0; iter < 50; iter++) {
        const t0 = performance.now();
        const transformed = transformNodeMetricsForCharts(rawDataset, {
          mountPoint: 'ALL',
          maxPoints: 360,
        });
        timings.push(performance.now() - t0);
        plottedCount = transformed.cpuSeries.length;
      }
      const memAfter = process.memoryUsage().heapUsed;
      timings.sort((a, b) => a - b);

      console.log(
        `  • Transform + Downsample ${size} raw pts -> ${plottedCount} chart pts: median=${percentile(timings, 50)}ms, p95=${percentile(timings, 95)}ms, p99=${percentile(timings, 99)}ms, heapDelta=${Math.round((memAfter - memBefore) / 1024)} KiB`
      );
    }
  } finally {
    // Clean up all synthetic benchmark data
    await pool.query(`DELETE FROM node_metrics WHERE agent_id = $1`, [agentId]);
    await pool.query(`DELETE FROM agents WHERE id = $1`, [agentId]);
    await pool.query(`DELETE FROM nodes WHERE id = $1`, [nodeId]);
    await pool.query(`DELETE FROM clusters WHERE id = $1`, [clusterId]);
    await pool.query(`DELETE FROM environments WHERE id = $1`, [envId]);
    await pool.query(`DELETE FROM organization_members WHERE organization_id = $1`, [orgId]);
    await pool.query(`DELETE FROM organizations WHERE id = $1`, [orgId]);
    await pool.query(`DELETE FROM users WHERE id = $1`, [userId]);

    await new Promise<void>((resolve) => server.close(() => resolve()));
    await closeRedis();
    await pool.end();
  }
}

runBenchmark().catch((err) => {
  console.error('Benchmark failed:', err);
  process.exit(1);
});
