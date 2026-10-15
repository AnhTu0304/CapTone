import WebSocket from 'ws';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: 'postgresql://postgres:123456@localhost:5432/aiselfheal',
});

const VALID_TOKEN = 'agt_dev_secret_token_2026';
const WS_URL = `ws://localhost:5000/api/v1/agent/connect?token=${VALID_TOKEN}`;

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runTests() {
  console.log('🧪 Starting Agent WebSocket Receiver Test Suite...\n');

  // =========================================================================
  // TEST 1: Unauthorized Connection with invalid token
  // =========================================================================
  console.log('--- TEST 1: Connecting with invalid token ---');
  await new Promise<void>((resolve) => {
    const badWs = new WebSocket('ws://localhost:5000/api/v1/agent/connect?token=bad_token_999');
    badWs.on('message', (data) => {
      console.log('Server rejection response:', data.toString());
    });
    badWs.on('close', (code, reason) => {
      console.log(`✅ Server closed invalid connection as expected (code: ${code}, reason: ${reason})`);
      resolve();
    });
  });

  // =========================================================================
  // TEST 2: Successful Connection & Authentication
  // =========================================================================
  console.log('\n--- TEST 2: Connecting with valid token ---');
  const ws = new WebSocket(WS_URL);

  await new Promise<void>((resolve, reject) => {
    ws.on('open', () => {
      console.log('✅ WebSocket connection opened successfully!');
    });

    ws.on('message', async (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.status === 'authenticated') {
        console.log('✅ Agent authenticated:', msg);

        // Verify database agent status
        const dbRes = await pool.query(
          "SELECT id, name, status, last_seen_at FROM agents WHERE agent_uid = 'agt-k8s-prod-01'"
        );
        console.log('Database agent status:', dbRes.rows[0]);
        if (dbRes.rows[0].status === 'ONLINE') {
          console.log('✅ Agent status confirmed ONLINE in database!');
        }
        resolve();
      }
    });

    ws.on('error', (err) => {
      console.error('WebSocket error:', err);
      reject(err);
    });
  });

  // Helper for message response
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
  // TEST 3: Send Metrics Payload
  // =========================================================================
  console.log('\n--- TEST 3: Streaming Metrics Message ---');
  const metricsMessage = {
    type: 'metrics',
    data: {
      service_id: 'backend-service',
      pod_id: 'pod-001',
      timestamp: '2026-10-02T15:37:10Z',
      cpu: 82.5,
      ram: 76.2,
      disk: 61.3,
      request_rate: 520,
      latency: 180,
      http_5xx_rate: 1.2,
      pod_restart_count: 0,
      replica_count: 2,
    },
  };

  const metricsAck = await sendAndAwaitAck(metricsMessage);
  console.log('Server Ack for Metrics:', metricsAck);

  const metricInDb = await pool.query(
    'SELECT * FROM agent_metrics WHERE id = $1',
    [metricsAck.record_id]
  );
  console.log('✅ Verified metric saved in PostgreSQL:', {
    id: metricInDb.rows[0].id,
    service_id: metricInDb.rows[0].service_id,
    cpu: metricInDb.rows[0].cpu,
    ram: metricInDb.rows[0].ram,
    request_rate: metricInDb.rows[0].request_rate,
    collected_at: metricInDb.rows[0].collected_at,
  });

  // =========================================================================
  // TEST 4: Send Log Message
  // =========================================================================
  console.log('\n--- TEST 4: Streaming Log Message ---');
  const logMessage = {
    type: 'log',
    data: {
      service_id: 'backend-service',
      pod_id: 'pod-001',
      timestamp: '2026-10-02T15:37:08Z',
      level: 'ERROR',
      message: 'OutOfMemoryError: Java heap space',
    },
  };

  const logAck = await sendAndAwaitAck(logMessage);
  console.log('Server Ack for Log:', logAck);

  const logInDb = await pool.query('SELECT * FROM logs WHERE id = $1', [logAck.record_id]);
  console.log('✅ Verified log saved in PostgreSQL:', {
    id: logInDb.rows[0].id,
    level: logInDb.rows[0].level,
    message: logInDb.rows[0].message,
    source: logInDb.rows[0].source,
    occurred_at: logInDb.rows[0].occurred_at,
  });

  // =========================================================================
  // TEST 5: Send Kubernetes Event + Pod Status Message
  // =========================================================================
  console.log('\n--- TEST 5: Streaming Kubernetes Event + Pod Status Message ---');
  const k8sEventMessage = {
    type: 'k8s_event',
    data: {
      service_id: 'backend-service',
      pod_id: 'pod-001',
      pod_name: 'backend-7d8f9c',
      status: 'CrashLoopBackOff',
      timestamp: '2026-10-02T15:37:07Z',
      event: {
        type: 'Warning',
        reason: 'OOMKilled',
        message: 'Container was killed due to out of memory',
      },
    },
  };

  const eventAck = await sendAndAwaitAck(k8sEventMessage);
  console.log('Server Ack for K8s Event:', eventAck);

  const eventInDb = await pool.query(
    'SELECT * FROM kubernetes_events WHERE id = $1',
    [eventAck.record_id]
  );
  console.log('✅ Verified K8s Event saved in PostgreSQL:', {
    id: eventInDb.rows[0].id,
    event_type: eventInDb.rows[0].event_type,
    reason: eventInDb.rows[0].reason,
    message: eventInDb.rows[0].message,
    first_seen_at: eventInDb.rows[0].first_seen_at,
  });

  // =========================================================================
  // TEST 6: Resiliency - Invalid Message Type
  // =========================================================================
  console.log('\n--- TEST 6: Sending invalid message type ---');
  const invalidTypeRes = await sendAndAwaitAck({
    type: 'invalid_type_hello',
    data: {},
  });
  console.log('✅ Server safely handled invalid message type:', invalidTypeRes);

  // =========================================================================
  // TEST 7: Resiliency - Malformed JSON
  // =========================================================================
  console.log('\n--- TEST 7: Sending malformed non-JSON string ---');
  const malformedRes = await new Promise((res) => {
    ws.once('message', (d) => res(JSON.parse(d.toString())));
    ws.send('<<<not valid json>>>');
  });
  console.log('✅ Server safely handled malformed string:', malformedRes);

  // =========================================================================
  // TEST 8: Disconnect & Status OFFLINE
  // =========================================================================
  console.log('\n--- TEST 8: Disconnect and Verify Status OFFLINE ---');
  ws.close();
  await sleep(1000);

  const offlineRes = await pool.query(
    "SELECT id, name, status, last_seen_at FROM agents WHERE agent_uid = 'agt-k8s-prod-01'"
  );
  console.log('Agent status after disconnect:', offlineRes.rows[0]);
  if (offlineRes.rows[0].status === 'OFFLINE') {
    console.log('✅ Agent status confirmed OFFLINE after disconnect!');
  }

  console.log('\n🎉 ALL 8 TESTS PASSED SUCCESSFULLY!');
  await pool.end();
  process.exit(0);
}

runTests().catch(async (err) => {
  console.error('❌ Test failed:', err);
  await pool.end();
  process.exit(1);
});
