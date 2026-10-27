/**
 * @file benchmarkLargeMetrics.ts
 * @description Benchmark script for APM Historical Metrics on a large dataset (50,000+ records)
 * Evaluates 1h, 24h, 7d ranges, concurrency, p50/p95/p99, and Offset vs Cursor performance.
 */

import { pool } from '../config/database';
import { MetricModel, encodeMetricsCursor } from '../models/metric.model';

interface IBenchmarkResult {
  scenario: string;
  concurrency: number;
  totalRequests: number;
  minMs: number;
  maxMs: number;
  avgMs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  throughputRps: number;
  errorRatePercent: number;
}

function calculatePercentile(sortedArr: number[], p: number): number {
  if (sortedArr.length === 0) return 0;
  const idx = Math.floor((p / 100) * sortedArr.length);
  return sortedArr[Math.min(idx, sortedArr.length - 1)];
}

async function runConcurrentBenchmark(
  name: string,
  concurrency: number,
  totalRequests: number,
  fn: () => Promise<void>
): Promise<IBenchmarkResult> {
  const durations: number[] = [];
  let errors = 0;
  const startTotal = Date.now();

  const worker = async (count: number) => {
    for (let i = 0; i < count; i++) {
      const t0 = performance.now();
      try {
        await fn();
        durations.push(performance.now() - t0);
      } catch (err) {
        errors++;
        durations.push(performance.now() - t0);
      }
    }
  };

  const requestsPerWorker = Math.ceil(totalRequests / concurrency);
  const workers = Array.from({ length: concurrency }, () => worker(requestsPerWorker));
  await Promise.all(workers);

  const totalTimeSec = (Date.now() - startTotal) / 1000;
  durations.sort((a, b) => a - b);

  const sum = durations.reduce((acc, v) => acc + v, 0);
  const avg = durations.length > 0 ? sum / durations.length : 0;

  return {
    scenario: name,
    concurrency,
    totalRequests: durations.length,
    minMs: Number((durations[0] || 0).toFixed(2)),
    maxMs: Number((durations[durations.length - 1] || 0).toFixed(2)),
    avgMs: Number(avg.toFixed(2)),
    p50Ms: Number(calculatePercentile(durations, 50).toFixed(2)),
    p95Ms: Number(calculatePercentile(durations, 95).toFixed(2)),
    p99Ms: Number(calculatePercentile(durations, 99).toFixed(2)),
    throughputRps: Number((durations.length / (totalTimeSec || 0.001)).toFixed(2)),
    errorRatePercent: Number(((errors / durations.length) * 100).toFixed(2)),
  };
}

async function main() {
  console.log('========================================================================');
  console.log('🚀 Task [S4][PB16] 2.4 – Benchmark Hiệu năng Lịch sử Metrics Dữ liệu Lớn');
  console.log('========================================================================\n');

  const benchOrgId = 'e0000000-0000-4000-8000-000000000099';
  const benchEnvId = 'e0000000-0000-4000-8000-000000000088';
  const benchClusterId = 'e0000000-0000-4000-8000-000000000077';
  const benchAgentId = 'e0000000-0000-4000-8000-000000000066';
  const benchUserId = 'e0000000-0000-4000-8000-000000000055';

  await MetricModel.ensureAgentMetricsSchema();

  // 1. Setup benchmark tenant
  console.log('📦 1. Khởi tạo cấu trúc Tenant & Agent thử nghiệm độc lập...');
  await pool.query(
    `INSERT INTO users (id, email, password_hash, full_name, status, created_at, updated_at)
     VALUES ($1, 'bench@pb16.io', 'hash', 'Bench User', 'ACTIVE', NOW(), NOW())
     ON CONFLICT (id) DO UPDATE SET status = 'ACTIVE';`,
    [benchUserId]
  );
  await pool.query(
    `INSERT INTO organizations (id, name, slug, status, created_by, created_at, updated_at)
     VALUES ($1, 'Benchmark Org', 'bench-org', 'ACTIVE', $2, NOW(), NOW())
     ON CONFLICT (id) DO UPDATE SET status = 'ACTIVE';`,
    [benchOrgId, benchUserId]
  );
  await pool.query(
    `INSERT INTO environments (id, organization_id, name, code, environment_type, created_by, created_at, updated_at)
     VALUES ($1, $2, 'Bench Env', 'bench-env', 'PRODUCTION', $3, NOW(), NOW())
     ON CONFLICT (id) DO UPDATE SET organization_id = EXCLUDED.organization_id;`,
    [benchEnvId, benchOrgId, benchUserId]
  );
  await pool.query(
    `INSERT INTO clusters (id, environment_id, name, provider, status, created_at, updated_at)
     VALUES ($1, $2, 'bench-cluster', 'MINIKUBE', 'CONNECTED', NOW(), NOW())
     ON CONFLICT (id) DO UPDATE SET environment_id = EXCLUDED.environment_id;`,
    [benchClusterId, benchEnvId]
  );
  await pool.query(
    `INSERT INTO agents (id, agent_uid, cluster_id, environment_id, name, version, status, created_at, updated_at)
     VALUES ($1, 'uid-bench-agent', $2, $3, 'bench-agent', '1.0.0', 'ONLINE', NOW(), NOW())
     ON CONFLICT (id) DO UPDATE SET status = 'ONLINE';`,
    [benchAgentId, benchClusterId, benchEnvId]
  );

  // 2. Seed 50,000 synthetic metrics distributed over 7 days
  console.log('🌱 2. Đang sinh 50.000 bản ghi telemetry phân bổ trong 7 ngày (chia thành 10 lô)...');
  const totalRecords = 50000;
  const batchSize = 5000;
  const services = ['order-service', 'payment-service', 'inventory-service', 'notification-service'];
  const pods = ['pod-01', 'pod-02', 'pod-03', 'pod-04', 'pod-05'];

  const tSeedStart = Date.now();
  for (let b = 0; b < totalRecords / batchSize; b++) {
    // Generate values
    const query = `
      INSERT INTO agent_metrics (
        agent_id, cluster_id, organization_id, environment_id, service_id, pod_id,
        cpu, ram, disk, request_rate, latency, http_5xx_rate, pod_restart_count, replica_count, collected_at
      )
      SELECT
        $1, $2, $3, $4,
        ($5::text[])[1 + (g % 4)],
        ($6::text[])[1 + (g % 5)],
        (10 + (g % 80))::float,
        (20 + (g % 60))::float,
        15.0::float,
        (5 + (g % 200))::float,
        (15 + (g % 150))::float,
        (CASE WHEN g % 20 = 0 THEN 2.5 ELSE 0.0 END)::float,
        0, 1,
        -- Distributed over 7 days (604,800 seconds): earlier records further back
        NOW() - ((604800.0 * (g + $7) / $8) || ' seconds')::interval
      FROM generate_series(1, $9) AS g
      ON CONFLICT DO NOTHING;
    `;
    await pool.query(query, [
      benchAgentId,
      benchClusterId,
      benchOrgId,
      benchEnvId,
      services,
      pods,
      b * batchSize,
      totalRecords,
      batchSize,
    ]);
    process.stdout.write(`   > Đã nạp ${(b + 1) * batchSize} / ${totalRecords} bản ghi...\r`);
  }
  console.log(`\n   ✓ Hoàn tất nạp dữ liệu trong ${((Date.now() - tSeedStart) / 1000).toFixed(2)}s.`);

  // Verify total count in DB
  const countRes = await pool.query(
    `SELECT COUNT(*)::int as count FROM agent_metrics WHERE organization_id = $1`,
    [benchOrgId]
  );
  const seededCount = countRes.rows[0].count;
  console.log(`📊 Số lượng bản ghi kiểm thử trong DB: ${seededCount.toLocaleString()} bản ghi.\n`);

  // 3. Run Benchmark Scenarios
  console.log('⚡ 3. Đang thực thi kịch bản đo lường hiệu năng truy vấn...');
  const results: IBenchmarkResult[] = [];

  // Scenario 1: Range 1h (Concurrency: 1, 5, 10)
  for (const c of [1, 5, 10]) {
    const res = await runConcurrentBenchmark(`Range 1h (limit 50, order desc)`, c, 50, async () => {
      await MetricModel.queryMetricsHistory({
        organizationId: benchOrgId,
        serviceId: 'order-service',
        range: '1h',
        limit: 50,
        order: 'desc',
      });
    });
    results.push(res);
  }

  // Scenario 2: Range 24h (Concurrency: 1, 5, 10)
  for (const c of [1, 5, 10]) {
    const res = await runConcurrentBenchmark(`Range 24h (limit 50, order desc)`, c, 50, async () => {
      await MetricModel.queryMetricsHistory({
        organizationId: benchOrgId,
        serviceId: 'order-service',
        range: '24h',
        limit: 50,
        order: 'desc',
      });
    });
    results.push(res);
  }

  // Scenario 3: Range 7d (Concurrency: 1, 5, 10)
  for (const c of [1, 5, 10]) {
    const res = await runConcurrentBenchmark(`Range 7d (limit 100, order desc)`, c, 50, async () => {
      await MetricModel.queryMetricsHistory({
        organizationId: benchOrgId,
        serviceId: 'order-service',
        range: '7d',
        limit: 100,
        order: 'desc',
      });
    });
    results.push(res);
  }

  // Scenario 4: Deep Offset Pagination (page=100, offset=4950) vs Cursor Keyset Pagination
  console.log('🔍 4. Đo lường so sánh: Deep Offset (page=100) vs Cursor Keyset Pagination...');
  
  // A. Deep Offset (offset = 4950)
  const offsetRes = await runConcurrentBenchmark(`Deep Offset (page 100, offset 4950)`, 5, 50, async () => {
    await MetricModel.queryMetricsHistory({
      organizationId: benchOrgId,
      range: '7d',
      page: 100,
      limit: 50,
      order: 'desc',
    });
  });
  results.push(offsetRes);

  // B. Cursor Keyset at comparable depth
  // First obtain a cursor around deep point
  const deepSeed = await pool.query(
    `SELECT id, collected_at FROM agent_metrics WHERE organization_id = $1 ORDER BY collected_at DESC, id DESC LIMIT 1 OFFSET 4950`,
    [benchOrgId]
  );
  const sampleCursor = encodeMetricsCursor(deepSeed.rows[0]);

  const cursorRes = await runConcurrentBenchmark(`Cursor Keyset (deep point, O(1))`, 5, 50, async () => {
    await MetricModel.queryMetricsHistory({
      organizationId: benchOrgId,
      range: '7d',
      cursor: sampleCursor,
      limit: 50,
      order: 'desc',
    });
  });
  results.push(cursorRes);

  // 5. EXPLAIN ANALYZE on PostgreSQL
  console.log('\n🔬 5. Phân tích chi tiết EXPLAIN ANALYZE trên PostgreSQL:');
  const explain1 = await pool.query(`
    EXPLAIN (ANALYZE, BUFFERS)
    SELECT am.id, am.service_id, am.pod_id, am.cpu, am.ram, am.collected_at
    FROM agent_metrics am
    WHERE am.organization_id = '${benchOrgId}'::uuid
      AND am.service_id = 'order-service'
      AND am.collected_at >= NOW() - INTERVAL '24 hours'
    ORDER BY am.collected_at DESC, am.id DESC
    LIMIT 50;
  `);
  console.log('--- Kế hoạch thực thi truy vấn Range 24h + Service Filter ---');
  explain1.rows.forEach((r) => console.log('  ' + r['QUERY PLAN']));

  const explain2 = await pool.query(`
    EXPLAIN (ANALYZE, BUFFERS)
    SELECT am.id, am.service_id, am.pod_id, am.cpu, am.ram, am.collected_at
    FROM agent_metrics am
    WHERE am.organization_id = '${benchOrgId}'::uuid
      AND (am.collected_at < '${deepSeed.rows[0].collected_at.toISOString()}'::timestamptz 
           OR (am.collected_at = '${deepSeed.rows[0].collected_at.toISOString()}'::timestamptz AND am.id < '${deepSeed.rows[0].id}'))
    ORDER BY am.collected_at DESC, am.id DESC
    LIMIT 50;
  `);
  console.log('\n--- Kế hoạch thực thi Keyset Cursor Pagination ---');
  explain2.rows.forEach((r) => console.log('  ' + r['QUERY PLAN']));

  // 6. Summary Table
  console.log('\n========================================================================');
  console.log('📈 BẢNG TỔNG HỢP KẾT QUẢ BENCHMARK (50.000 BẢN GHI TELEMETRY)');
  console.log('========================================================================');
  console.table(
    results.map((r) => ({
      'Kịch bản': r.scenario,
      'Workers': r.concurrency,
      'Số req': r.totalRequests,
      'Avg (ms)': r.avgMs,
      'p50 (ms)': r.p50Ms,
      'p95 (ms)': r.p95Ms,
      'p99 (ms)': r.p99Ms,
      'RPS': r.throughputRps,
      'Error %': `${r.errorRatePercent}%`,
    }))
  );

  // 7. Cleanup
  console.log('\n🧹 6. Dọn sạch 100% dữ liệu benchmark khỏi PostgreSQL...');
  await pool.query(`DELETE FROM agent_metrics WHERE organization_id = $1`, [benchOrgId]);
  await pool.query(`DELETE FROM agents WHERE id = $1`, [benchAgentId]);
  await pool.query(`DELETE FROM clusters WHERE id = $1`, [benchClusterId]);
  await pool.query(`DELETE FROM environments WHERE id = $1`, [benchEnvId]);
  await pool.query(`DELETE FROM organizations WHERE id = $1`, [benchOrgId]);
  await pool.query(`DELETE FROM users WHERE id = $1`, [benchUserId]);
  console.log('   ✓ Đã hoàn tất dọn dẹp dữ liệu thử nghiệm.');

  await pool.end();
  console.log('\n✅ Toàn bộ bài benchmark hoàn tất thành công!');
}

main().catch(async (err) => {
  console.error('❌ Lỗi benchmark:', err);
  await pool.end().catch(() => {});
  process.exit(1);
});
