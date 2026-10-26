import test, { describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import { AddressInfo } from 'node:net';
import jwt from 'jsonwebtoken';
import app from '../app';
import { config } from '../config/env';
import { pool } from '../config/database';
import { closeRedis } from '../config/redis';
import { LogStreamService } from '../services/logStream.service';

describe('Real-Time Log Streaming & Load Limits Suite [S4][PB17] 3.3', () => {
  let server: http.Server;
  let baseUrl: string;

  const testUserId = 'a9000000-0000-4000-8000-000000000001';
  let validUserToken: string;

  before(async () => {
    validUserToken = jwt.sign(
      {
        id: testUserId,
        email: 'test-stream-user@aegisai.io',
        role: 'DEVOPS',
        organization_id: 'org-test-stream',
      },
      config.jwt.secret,
      { expiresIn: '1h' }
    );

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const address = server.address() as AddressInfo;
        baseUrl = `http://localhost:${address.port}`;
        resolve();
      });
    });
  });

  after(async () => {
    LogStreamService.resetForTesting();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    try {
      await pool.end();
    } catch {}
    try {
      await closeRedis();
    } catch {}
  });

  beforeEach(() => {
    LogStreamService.resetForTesting();
  });

  test('1. Reject unauthorized requests without JWT token with 401', async () => {
    const res = await fetch(`${baseUrl}/api/v1/telemetry/logs/stream`);
    assert.strictEqual(res.status, 401);
  });

  test('2. Connects successfully with valid Bearer token and returns SSE headers', async () => {
    const controller = new AbortController();
    const res = await fetch(`${baseUrl}/api/v1/telemetry/logs/stream?tail=0`, {
      headers: {
        Authorization: `Bearer ${validUserToken}`,
      },
      signal: controller.signal,
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers.get('content-type'), 'text/event-stream');
    assert.strictEqual(res.headers.get('cache-control'), 'no-cache, no-transform');
    assert.strictEqual(res.headers.get('x-accel-buffering'), 'no');

    controller.abort();
  });

  test('3. Connects successfully with token in query param (?token=...) for native EventSource compatibility', async () => {
    const controller = new AbortController();
    const res = await fetch(`${baseUrl}/api/v1/telemetry/logs/stream?token=${validUserToken}&tail=0`, {
      signal: controller.signal,
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers.get('content-type'), 'text/event-stream');

    controller.abort();
  });

  test('4. Receives initial status event frame upon connection', async () => {
    const controller = new AbortController();
    const res = await fetch(`${baseUrl}/api/v1/telemetry/logs/stream?tail=0&namespace=default`, {
      headers: { Authorization: `Bearer ${validUserToken}` },
      signal: controller.signal,
    });

    assert.ok(res.body);
    const reader = res.body.getReader();
    const decoder = new TextDecoder();

    let receivedData = '';
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      receivedData += decoder.decode(value, { stream: true });
      if (receivedData.includes('event: status')) {
        break;
      }
    }

    controller.abort();

    assert.ok(receivedData.includes('event: status'));
    assert.ok(receivedData.includes('"status":"connected"'));
    assert.ok(receivedData.includes('"namespace":"default"'));
  });

  test('5. Streams new incoming log event in real-time when emitted', async () => {
    const controller = new AbortController();
    const res = await fetch(`${baseUrl}/api/v1/telemetry/logs/stream?tail=0&service_id=stream-svc-test`, {
      headers: { Authorization: `Bearer ${validUserToken}` },
      signal: controller.signal,
    });

    assert.ok(res.body);
    const reader = res.body.getReader();
    const decoder = new TextDecoder();

    // Emit live log after connection is established
    setTimeout(() => {
      LogStreamService.emitLog({
        id: 'test-log-live-99',
        service_id: 'stream-svc-test',
        level: 'INFO',
        message: 'Live stream test message delivered via SSE',
        occurred_at: new Date().toISOString(),
        metadata: { service_id: 'stream-svc-test' },
      });
    }, 50);

    let receivedData = '';
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      receivedData += decoder.decode(value, { stream: true });
      if (receivedData.includes('Live stream test message')) {
        break;
      }
    }

    controller.abort();

    assert.ok(receivedData.includes('event: log'));
    assert.ok(receivedData.includes('Live stream test message delivered via SSE'));
    assert.ok(receivedData.includes('test-log-live-99'));
  });

  test('6. Filters logs and does NOT emit logs that do not match the filter', async () => {
    const controller = new AbortController();
    const res = await fetch(`${baseUrl}/api/v1/telemetry/logs/stream?tail=0&namespace=production`, {
      headers: { Authorization: `Bearer ${validUserToken}` },
      signal: controller.signal,
    });

    assert.ok(res.body);
    const reader = res.body.getReader();
    const decoder = new TextDecoder();

    // Emit non-matching log (staging namespace)
    setTimeout(() => {
      LogStreamService.emitLog({
        id: 'staging-log-01',
        service_id: 'test-svc',
        namespace: 'staging',
        level: 'INFO',
        message: 'This log should be filtered out and not delivered',
        occurred_at: new Date().toISOString(),
        metadata: { namespace: 'staging' },
      });

      // Emit matching log (production namespace)
      setTimeout(() => {
        LogStreamService.emitLog({
          id: 'prod-log-02',
          service_id: 'test-svc',
          namespace: 'production',
          level: 'INFO',
          message: 'Matching production log should be delivered',
          occurred_at: new Date().toISOString(),
          metadata: { namespace: 'production' },
        });
      }, 30);
    }, 30);

    let receivedData = '';
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      receivedData += decoder.decode(value, { stream: true });
      if (receivedData.includes('Matching production log')) {
        break;
      }
    }

    controller.abort();

    assert.ok(!receivedData.includes('This log should be filtered out'));
    assert.ok(receivedData.includes('Matching production log should be delivered'));
  });

  test('7. Enforces per-user max concurrent streams limit (returns 429)', async () => {
    LogStreamService.setConfig({ maxUserStreams: 2 });

    const controllers: AbortController[] = [];

    // Stream 1: Success
    const c1 = new AbortController();
    controllers.push(c1);
    const res1 = await fetch(`${baseUrl}/api/v1/telemetry/logs/stream?tail=0`, {
      headers: { Authorization: `Bearer ${validUserToken}` },
      signal: c1.signal,
    });
    assert.strictEqual(res1.status, 200);

    // Stream 2: Success
    const c2 = new AbortController();
    controllers.push(c2);
    const res2 = await fetch(`${baseUrl}/api/v1/telemetry/logs/stream?tail=0`, {
      headers: { Authorization: `Bearer ${validUserToken}` },
      signal: c2.signal,
    });
    assert.strictEqual(res2.status, 200);

    // Stream 3: Rejected with 429 Too Many Requests
    const res3 = await fetch(`${baseUrl}/api/v1/telemetry/logs/stream?tail=0`, {
      headers: { Authorization: `Bearer ${validUserToken}` },
    });
    assert.strictEqual(res3.status, 429);
    const body3: any = await res3.json();
    assert.ok(body3.message.includes('giới hạn kết nối streaming song song'));

    // Abort existing streams and verify permit is released
    controllers.forEach((c) => c.abort());
    await new Promise((r) => setTimeout(r, 60));

    const counts = LogStreamService.getActiveCounts();
    assert.strictEqual(counts.global, 0);
  });

  test('8. Enforces global stream limit across all users (returns 429)', async () => {
    LogStreamService.setConfig({ maxGlobalStreams: 1 });

    const c1 = new AbortController();
    const res1 = await fetch(`${baseUrl}/api/v1/telemetry/logs/stream?tail=0`, {
      headers: { Authorization: `Bearer ${validUserToken}` },
      signal: c1.signal,
    });
    assert.strictEqual(res1.status, 200);

    // Other user attempts to connect
    const otherUserToken = jwt.sign(
      { id: '7a000000-0000-0000-0000-000000000003', email: 'audit.ownera@test.com', role: 'ADMIN' },
      config.jwt.secret
    );
    const res2 = await fetch(`${baseUrl}/api/v1/telemetry/logs/stream?tail=0`, {
      headers: { Authorization: `Bearer ${otherUserToken}` },
    });
    assert.strictEqual(res2.status, 429);
    const body2: any = await res2.json();
    assert.ok(body2.message.includes('giới hạn kết nối streaming toàn cục'));

    c1.abort();
    await new Promise((r) => setTimeout(r, 60));
  });

  test('9. Emits heartbeat pulses to keep connection alive', async () => {
    LogStreamService.setConfig({ heartbeatIntervalMs: 50 });

    const controller = new AbortController();
    const res = await fetch(`${baseUrl}/api/v1/telemetry/logs/stream?tail=0`, {
      headers: { Authorization: `Bearer ${validUserToken}` },
      signal: controller.signal,
    });

    assert.ok(res.body);
    const reader = res.body.getReader();
    const decoder = new TextDecoder();

    let receivedData = '';
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      receivedData += decoder.decode(value, { stream: true });
      if (receivedData.includes('event: heartbeat')) {
        break;
      }
    }

    controller.abort();
    assert.ok(receivedData.includes('event: heartbeat'));
    assert.ok(receivedData.includes('"timestamp"'));
  });

  test('10. Client disconnection releases stream counter cleanly', async () => {
    const controller = new AbortController();
    const res = await fetch(`${baseUrl}/api/v1/telemetry/logs/stream?tail=0`, {
      headers: { Authorization: `Bearer ${validUserToken}` },
      signal: controller.signal,
    });
    assert.strictEqual(res.status, 200);

    const countsBefore = LogStreamService.getActiveCounts();
    assert.strictEqual(countsBefore.global, 1);

    controller.abort();
    await new Promise((r) => setTimeout(r, 60));

    const countsAfter = LogStreamService.getActiveCounts();
    assert.strictEqual(countsAfter.global, 0);
  });

  test('11. Stream filters incoming logs by dynamic search keyword (?search=...) [S4][PB17] 3.4', async () => {
    const controller = new AbortController();
    const res = await fetch(`${baseUrl}/api/v1/telemetry/logs/stream?tail=0&search=DatabaseTimeout`, {
      headers: { Authorization: `Bearer ${validUserToken}` },
      signal: controller.signal,
    });

    assert.ok(res.body);
    const reader = res.body.getReader();
    const decoder = new TextDecoder();

    // 1. Emit non-matching log
    setTimeout(() => {
      LogStreamService.emitLog({
        id: 'non-matching-log-1',
        service_id: 'test-svc',
        level: 'INFO',
        message: 'Normal query executed in 12ms',
        occurred_at: new Date().toISOString(),
      });

      // 2. Emit matching log
      setTimeout(() => {
        LogStreamService.emitLog({
          id: 'matching-log-2',
          service_id: 'test-svc',
          level: 'ERROR',
          message: 'Critical error: DatabaseTimeout occurred after 30000ms',
          occurred_at: new Date().toISOString(),
        });
      }, 30);
    }, 30);

    let receivedData = '';
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      receivedData += decoder.decode(value, { stream: true });
      if (receivedData.includes('DatabaseTimeout occurred')) {
        break;
      }
    }

    controller.abort();

    assert.ok(!receivedData.includes('Normal query executed'));
    assert.ok(receivedData.includes('Critical error: DatabaseTimeout occurred after 30000ms'));
  });
});
