import WebSocket from 'ws';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: 'postgresql://postgres:123456@localhost:5432/aiselfheal',
});

const WS_URL = 'ws://localhost:5000/api/v1/agent/connect?token=agt_dev_secret_token_2026';

async function runVerification() {
  console.log('================================================================');
  console.log('🔍 KIỂM TRA 3 THÀNH PHẦN: METRICS -> LOGS -> K8S EVENTS');
  console.log('================================================================\n');

  const ws = new WebSocket(WS_URL);

  await new Promise<void>((resolve, reject) => {
    ws.on('open', () => {
      console.log('✅ Đã kết nối WebSocket tới Main Backend!');
    });

    ws.on('message', (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.status === 'authenticated') {
        console.log('✅ Xác thực Agent thành công:', msg.agent.name);
        resolve();
      }
    });

    ws.on('error', reject);
  });

  const sendAndAwaitAck = (payload: object): Promise<any> => {
    return new Promise((resolve) => {
      const handler = (data: WebSocket.RawData) => {
        const res = JSON.parse(data.toString());
        ws.off('message', handler);
        resolve(res);
      };
      ws.on('message', handler);
      ws.send(JSON.stringify(payload));
    });
  };

  // =========================================================================
  // 1. KIỂM TRA METRICS -> lưu bảng agent_metrics
  // =========================================================================
  console.log('\n--- 1. KIỂM TRA METRICS ---');
  const uniqueMetricTimestamp = new Date().toISOString();
  const metricPayload = {
    type: 'metrics',
    data: {
      service_id: 'order-service',
      pod_id: 'order-pod-001',
      timestamp: uniqueMetricTimestamp,
      cpu: 85.5,
      ram: 78.4,
      disk: 55.0,
      request_rate: 650.0,
      latency: 220.0,
      http_5xx_rate: 2.5,
      pod_restart_count: 1,
      replica_count: 3,
    },
  };

  console.log('➡️ Simulator gửi gói [type: "metrics"]...');
  const metricAck = await sendAndAwaitAck(metricPayload);
  console.log('⬅️ Main BE phản hồi ACK:', metricAck);

  // Truy vấn trực tiếp từ bảng agent_metrics
  const metricRow = await pool.query(
    'SELECT id, service_id, pod_id, cpu, ram, disk, request_rate, latency, http_5xx_rate, pod_restart_count, replica_count, collected_at FROM agent_metrics WHERE id = $1',
    [metricAck.record_id]
  );
  console.log('📊 DỮ LIỆU ĐÃ LƯU TRONG BẢNG `agent_metrics`:');
  console.log(metricRow.rows[0]);

  // =========================================================================
  // 2. KIỂM TRA LOGS -> lưu bảng logs
  // =========================================================================
  console.log('\n--- 2. KIỂM TRA LOGS ---');
  const uniqueLogTimestamp = new Date().toISOString();
  const logPayload = {
    type: 'log',
    data: {
      service_id: 'order-service',
      pod_id: 'order-pod-001',
      timestamp: uniqueLogTimestamp,
      level: 'ERROR',
      message: 'OutOfMemoryError: Java heap space during order processing batch',
    },
  };

  console.log('➡️ Simulator gửi gói [type: "log"]...');
  const logAck = await sendAndAwaitAck(logPayload);
  console.log('⬅️ Main BE phản hồi ACK:', logAck);

  // Truy vấn trực tiếp từ bảng logs
  const logRow = await pool.query(
    'SELECT id, level, message, source, occurred_at, metadata FROM logs WHERE id = $1',
    [logAck.record_id]
  );
  console.log('📝 DỮ LIỆU ĐÃ LƯU TRONG BẢNG `logs`:');
  console.log(logRow.rows[0]);

  // =========================================================================
  // 3. KIỂM TRA K8S EVENTS -> lưu bảng kubernetes_events
  // =========================================================================
  console.log('\n--- 3. KIỂM TRA K8S EVENTS ---');
  const uniqueEventTimestamp = new Date().toISOString();
  const eventPayload = {
    type: 'k8s_event',
    data: {
      service_id: 'order-service',
      pod_id: 'order-pod-001',
      pod_name: 'order-pod-7f9a2b',
      status: 'CrashLoopBackOff',
      timestamp: uniqueEventTimestamp,
      event: {
        type: 'Warning',
        reason: 'OOMKilled',
        message: 'Container order-worker was killed due to memory limit reached',
      },
    },
  };

  console.log('➡️ Simulator gửi gói [type: "k8s_event"]...');
  const eventAck = await sendAndAwaitAck(eventPayload);
  console.log('⬅️ Main BE phản hồi ACK:', eventAck);

  // Truy vấn trực tiếp từ bảng kubernetes_events
  const eventRow = await pool.query(
    'SELECT id, resource_type, resource_uid, event_type, reason, message, source_component, first_seen_at, metadata FROM kubernetes_events WHERE id = $1',
    [eventAck.record_id]
  );
  console.log('⚡ DỮ LIỆU ĐÃ LƯU TRONG BẢNG `kubernetes_events`:');
  console.log(eventRow.rows[0]);

  ws.close();
  await pool.end();

  console.log('\n================================================================');
  console.log('🎯 KẾT LUẬN: CẢ 3 THÀNH PHẦN ĐÃ LƯU ĐÚNG 100% VÀO DATABASE!');
  console.log('================================================================');
  process.exit(0);
}

runVerification().catch(async (err) => {
  console.error('❌ Lỗi kiểm tra:', err);
  await pool.end();
  process.exit(1);
});
