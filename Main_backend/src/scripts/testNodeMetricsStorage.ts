import assert from 'assert';
import { pool } from '../config/database';
import { MetricModel } from '../models/metric.model';
import { AgentService, AuthenticatedAgent } from '../services/agent.service';
import { AgentWsMessageSchema } from '../schemas/agentWebSocket.schema';

async function runNodeMetricsStorageTest() {
  console.log('🧪 Starting Task 4.1 Node Metrics Storage & Query Verification...');

  const testAgentId = '00000000-0000-4000-8000-000000000041';
  const testClusterId = '00000000-0000-4000-8000-000000000042';
  const insertedIds: Array<string | number> = [];

  try {
    // 1. Validate WebSocket schema for node_metrics envelope
    const now = Date.now();
    const t1Iso = new Date(now - 20000).toISOString();
    const t2Iso = new Date(now - 10000).toISOString();
    const t3Iso = new Date(now - 2000).toISOString();

    const wsEnvelope = {
      type: 'node_metrics',
      data: {
        node_name: 'worker-node-01',
        timestamp: t1Iso,
        cpu_usage_percent: 42.75,
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
        net_rx_bytes: 10485760,
        net_tx_bytes: 5242880,
        net_rx_bytes_per_sec: 12500.5,
        net_tx_bytes_per_sec: 6400.25,
        net_interfaces: [
          {
            interface: 'eth0',
            rx_bytes: 10485760,
            tx_bytes: 5242880,
            rx_packets: 8500,
            tx_packets: 4200,
            rx_errors: 0,
            tx_errors: 0,
            rx_bytes_per_sec: 12500.5,
            tx_bytes_per_sec: 6400.25,
            is_warmup: false,
            counter_reset: false,
          },
        ],
        collection_status: 'OK',
        collection_errors: {},
        metadata: { is_containerized: true, platform: 'linux' },
      },
    };

    const parsed = AgentWsMessageSchema.safeParse(wsEnvelope);
    assert.strictEqual(parsed.success, true, 'AgentWsMessageSchema must accept valid node_metrics envelope');
    if (!parsed.success || parsed.data.type !== 'node_metrics') {
      throw new Error('Unexpected schema parse result');
    }

    const mockAgent: AuthenticatedAgent = {
      id: testAgentId,
      name: 'test-agent-41',
      agent_uid: 'uid-test-41',
      cluster_id: testClusterId,
      environment_id: '00000000-0000-0000-0000-000000000000',
      status: 'ONLINE',
    };

    // 2. Store 3 time-series records (2 for worker-node-01 at t1, t2 and 1 for worker-node-02 at t3)
    const r1 = await AgentService.storeNodeMetrics(mockAgent, parsed.data.data);
    insertedIds.push(r1.id);

    const r2 = await AgentService.storeNodeMetrics(mockAgent, {
      ...parsed.data.data,
      timestamp: t2Iso,
      cpu_usage_percent: 68.4,
      ram_usage_percent: 55.2,
      net_rx_bytes: 10548260,
      net_rx_bytes_per_sec: 14200.0,
    });
    insertedIds.push(r2.id);

    const r3 = await AgentService.storeNodeMetrics(mockAgent, {
      ...parsed.data.data,
      node_name: 'worker-node-02',
      timestamp: t3Iso,
      cpu_usage_percent: 21.0,
      collection_status: 'PARTIAL',
      collection_errors: { disk: 'Permission denied on /mnt/restricted' },
    });
    insertedIds.push(r3.id);

    // 3. Query by agentId + nodeName
    const node1Rows = await MetricModel.queryNodeMetrics({
      agentId: testAgentId,
      nodeName: 'worker-node-01',
      limit: 10,
    });
    assert.strictEqual(node1Rows.length, 2, 'Should retrieve 2 records for worker-node-01');
    // Ordered by collected_at DESC -> t2 first, t1 second
    assert.strictEqual(node1Rows[0].cpu_usage_percent, 68.4);
    assert.strictEqual(node1Rows[1].cpu_usage_percent, 42.75);
    assert.strictEqual(node1Rows[1].cpu_cores, 8);
    assert.strictEqual(Number(node1Rows[1].ram_total_bytes), 17179869184);
    assert.strictEqual(Number(node1Rows[1].disk_total_bytes), 107374182400);
    assert.strictEqual(node1Rows[1].disk_filesystems[0].mount_point, '/');
    assert.strictEqual(node1Rows[1].net_interfaces[0].interface, 'eth0');

    // 4. Query by time range [t2 - 1s, t2 + 1s] for worker-node-01
    const rangeRows = await MetricModel.queryNodeMetrics({
      agentId: testAgentId,
      nodeName: 'worker-node-01',
      startTime: new Date(now - 12000),
      endTime: new Date(now - 8000),
    });
    assert.strictEqual(rangeRows.length, 1, 'Time-range query should isolate sample t2');
    assert.strictEqual(rangeRows[0].cpu_usage_percent, 68.4);

    // 5. Verify partial error status persistence on worker-node-02
    const node2Rows = await MetricModel.queryNodeMetrics({
      agentId: testAgentId,
      nodeName: 'worker-node-02',
    });
    assert.strictEqual(node2Rows.length, 1);
    assert.strictEqual(node2Rows[0].collection_status, 'PARTIAL');
    assert.strictEqual(node2Rows[0].collection_errors.disk, 'Permission denied on /mnt/restricted');

    console.log('✅ All Task 4.1 Node Metrics storage & time-range query assertions PASSED!');
  } finally {
    if (insertedIds.length > 0) {
      await pool.query('DELETE FROM node_metrics WHERE id = ANY($1)', [insertedIds]);
    }
    await pool.end();
  }
}

runNodeMetricsStorageTest().catch((err) => {
  console.error('❌ Task 4.1 verification test failed:', err);
  process.exit(1);
});
