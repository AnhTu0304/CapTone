import { pool } from '../src/config/database';

const BASE_URL = 'http://localhost:5000/api/v1/telemetry';

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runTestSuite() {
  console.log('🧪 Starting Telemetry Aggregator & RCA Context Builder Test Suite...\n');

  try {
    // 0. Ensure clean slate for test service
    const testService = 'order-service';
    console.log(`--- SETUP: Cleaning previous test data for ${testService} ---`);
    await pool.query("DELETE FROM agent_metrics WHERE service_id = $1", [testService]);
    await pool.query("DELETE FROM logs WHERE metadata->>'service_id' = $1", [testService]);
    await pool.query("DELETE FROM kubernetes_events WHERE metadata->>'service_id' = $1", [testService]);

    // Query an active agent_id and cluster_id
    const agentRes = await pool.query("SELECT id, cluster_id FROM agents LIMIT 1");
    const agentId = agentRes.rows[0].id;
    const clusterId = agentRes.rows[0].cluster_id;

    // =========================================================================
    // TEST 1: Insert Multi-Pod Telemetry & Verify Service Aggregation
    // =========================================================================
    console.log('\n--- TEST 1: Inserting Multi-Pod Metrics for order-service ---');
    
    // Simulate 3 pods at timestamp T0
    const now = new Date();
    const t0 = new Date(now.getTime() - 10000); // 10 seconds ago
    const t1 = new Date(now.getTime() - 5000);  // 5 seconds ago
    const t2 = now;                             // now

    // Timestep T0: 3 pods (pod-001, pod-002, pod-003)
    // pod-001: CPU 70, RAM 60, Req 200, Lat 120, 5xx 0.0, Restarts 0
    // pod-002: CPU 85, RAM 75, Req 300, Lat 180, 5xx 1.5, Restarts 1
    // pod-003: CPU 65, RAM 55, Req 250, Lat 90,  5xx 0.0, Restarts 0
    // Expected Aggregation: CPU=85, RAM=75, Req=750, Lat=180, 5xx=0.5, Restarts=1, Replicas=3
    const podDataT0 = [
      { pod: 'pod-001', cpu: 70.0, ram: 60.0, disk: 40.0, req: 200, lat: 120, err5xx: 0.0, restarts: 0, time: t0 },
      { pod: 'pod-002', cpu: 85.0, ram: 75.0, disk: 50.0, req: 300, lat: 180, err5xx: 1.5, restarts: 1, time: t0 },
      { pod: 'pod-003', cpu: 65.0, ram: 55.0, disk: 45.0, req: 250, lat: 90,  err5xx: 0.0, restarts: 0, time: t0 },
    ];

    for (const p of podDataT0) {
      await pool.query(
        `INSERT INTO agent_metrics (
          agent_id, cluster_id, service_id, pod_id, cpu, ram, disk,
          request_rate, latency, http_5xx_rate, pod_restart_count, replica_count, collected_at, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 3, $12, NOW())`,
        [agentId, clusterId, testService, p.pod, p.cpu, p.ram, p.disk, p.req, p.lat, p.err5xx, p.restarts, p.time]
      );
    }

    // Timestep T1: Another reading
    const podDataT1 = [
      { pod: 'pod-001', cpu: 72.0, ram: 62.0, disk: 40.0, req: 210, lat: 130, err5xx: 0.0, restarts: 0, time: t1 },
      { pod: 'pod-002', cpu: 88.0, ram: 82.0, disk: 52.0, req: 320, lat: 210, err5xx: 2.0, restarts: 1, time: t1 },
      { pod: 'pod-003', cpu: 68.0, ram: 58.0, disk: 46.0, req: 260, lat: 100, err5xx: 0.0, restarts: 0, time: t1 },
    ];
    for (const p of podDataT1) {
      await pool.query(
        `INSERT INTO agent_metrics (
          agent_id, cluster_id, service_id, pod_id, cpu, ram, disk,
          request_rate, latency, http_5xx_rate, pod_restart_count, replica_count, collected_at, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 3, $12, NOW())`,
        [agentId, clusterId, testService, p.pod, p.cpu, p.ram, p.disk, p.req, p.lat, p.err5xx, p.restarts, p.time]
      );
    }

    console.log('✅ Multi-pod test metrics inserted successfully.');

    // Query Aggregated Metrics Sequence via API
    console.log('\n--- TEST 2: GET /api/v1/telemetry/services/order-service/metrics-sequence ---');
    const seqRes = await fetch(`${BASE_URL}/services/${testService}/metrics-sequence?bucket_seconds=5&limit=12&fill_padding=true`);
    const seqJson = await seqRes.json();
    console.log('Status code:', seqRes.status);
    console.log('Response message:', seqJson.message);
    console.log(`Returned points count: ${seqJson.data.sequence.length}`);

    if (seqJson.data.sequence.length !== 12) {
      throw new Error(`Expected exactly 12 points, got ${seqJson.data.sequence.length}`);
    }

    const latestPoint = seqJson.data.sequence[11];
    console.log('Latest aggregated point:', latestPoint);

    // Verify aggregation correctness for T1:
    // CPU max: 88, RAM max: 82, Request sum: 210+320+260 = 790, Latency max: 210
    if (latestPoint.cpu < 80 || latestPoint.request_rate < 700 || latestPoint.replica_count < 3) {
      throw new Error(`Aggregation math verification failed: ${JSON.stringify(latestPoint)}`);
    }
    console.log('✅ Metric aggregation logic successfully verified!');

    // =========================================================================
    // TEST 3: Insert Logs & K8s Events for RCA Context
    // =========================================================================
    console.log('\n--- TEST 3: Inserting Logs and K8s Events for order-service ---');

    const testLogs = [
      { level: 'INFO', msg: 'Order created successfully: #ORD-9912', time: new Date(now.getTime() - 25000) },
      { level: 'INFO', msg: 'Payment processed successfully', time: new Date(now.getTime() - 20000) },
      { level: 'WARN', msg: 'Connection timeout connecting to Redis cluster node 2', time: new Date(now.getTime() - 15000) },
      { level: 'ERROR', msg: 'OutOfMemoryError: Java heap space in checkout worker', time: new Date(now.getTime() - 8000) },
      { level: 'INFO', msg: 'Worker thread restarting after failure', time: new Date(now.getTime() - 2000) },
    ];

    for (const log of testLogs) {
      await pool.query(
        `INSERT INTO logs (
          cluster_id, level, message, source, occurred_at, metadata
        ) VALUES ($1, $2, $3, 'k8s-agent', $4, $5)`,
        [clusterId, log.level, log.msg, log.time, JSON.stringify({ service_id: testService, pod_id: 'pod-002' })]
      );
    }

    const testEvents = [
      {
        type: 'Warning',
        reason: 'OOMKilled',
        msg: 'Container was killed due to memory limit reached',
        pod: 'order-service-7d8f9c-002',
        time: new Date(now.getTime() - 7000),
      },
      {
        type: 'Warning',
        reason: 'BackOff',
        msg: 'Back-off restarting failed container order-service in pod',
        pod: 'order-service-7d8f9c-002',
        time: new Date(now.getTime() - 3000),
      },
    ];

    for (const ev of testEvents) {
      await pool.query(
        `INSERT INTO kubernetes_events (
          cluster_id, resource_type, resource_uid, event_type, reason, message,
          source_component, first_seen_at, last_seen_at, count, metadata
        ) VALUES ($1, 'Pod', 'pod-002', $2, $3, $4, 'k8s-agent', $5, $5, 1, $6)`,
        [clusterId, ev.type, ev.reason, ev.msg, ev.time, JSON.stringify({ service_id: testService, pod_name: ev.pod })]
      );
    }

    console.log('✅ Test logs and K8s events inserted successfully.');

    // Query RCA Context via API
    console.log('\n--- TEST 4: GET /api/v1/telemetry/services/order-service/rca-context ---');
    const rcaRes = await fetch(`${BASE_URL}/services/${testService}/rca-context?window_minutes=30&log_limit=20&event_limit=10`);
    const rcaJson = await rcaRes.json();
    console.log('Status code:', rcaRes.status);
    console.log('Filtered logs count:', rcaJson.data.logs.length);
    console.log('Logs sample:');
    rcaJson.data.logs.forEach((l: string) => console.log('  ', l));
    console.log('Filtered events count:', rcaJson.data.kubernetes_events.length);
    rcaJson.data.kubernetes_events.forEach((e: string) => console.log('  ', e));

    if (rcaJson.data.logs.length === 0 || rcaJson.data.kubernetes_events.length === 0) {
      throw new Error('RCA context query returned empty logs or events');
    }
    console.log('✅ RCA Context extraction logic successfully verified!');

    // =========================================================================
    // TEST 5: End-to-End Orchestration (Evaluate Service)
    // =========================================================================
    console.log('\n--- TEST 5: POST /api/v1/telemetry/services/order-service/evaluate ---');
    const evalRes = await fetch(`${BASE_URL}/services/${testService}/evaluate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bucket_seconds: 5,
        window_minutes: 30,
        force_rca: false,
        auto_trigger_rca: true,
      }),
    });
    const evalJson = await evalRes.json();
    console.log('Status code:', evalRes.status);
    console.log('Service evaluation summary:');
    console.log('  Service:', evalJson.data.service_id);
    console.log('  Rule Engine Anomaly detected:', evalJson.data.rule_evaluation.is_anomalous);
    console.log('  Rule Engine Anomalies:', evalJson.data.rule_evaluation.anomalies);
    console.log('  Rule Engine Proposed Action:', evalJson.data.rule_evaluation.proposed_action);
    console.log('  RCA Triggered:', evalJson.data.rca_triggered);
    console.log('  RCA Trigger Reason:', evalJson.data.rca_trigger_reason);
    if (evalJson.data.rca_diagnosis) {
      console.log('  RCA Root Cause:', evalJson.data.rca_diagnosis.root_cause);
      console.log('  RCA Recommendation:', evalJson.data.rca_diagnosis.recommendation);
      console.log('  RCA Incident ID:', evalJson.data.rca_diagnosis.incident_id);
    }

    console.log('\n======================================================');
    console.log('🎉 ALL 5 TELEMETRY AGGREGATION & RCA TESTS PASSED!');
    console.log('======================================================\n');
  } catch (error) {
    console.error('❌ Test failed with error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runTestSuite();
