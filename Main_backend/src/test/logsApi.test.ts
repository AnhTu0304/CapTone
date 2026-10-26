import test, { describe, before, after } from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import { AddressInfo } from 'node:net';
import jwt from 'jsonwebtoken';
import app from '../app';
import { config } from '../config/env';
import { pool } from '../config/database';
import { closeRedis } from '../config/redis';
import { LogModel } from '../models/log.model';

describe('Centralized Logs API Suite [S4][PB17 3.1]', () => {
  let server: http.Server;
  let baseUrl: string;

  const testUserId = 'a9000000-0000-4000-8000-000000000001';
  const testClusterId = 'c083f597-12a4-4860-9a41-c93860139808';
  let validUserToken: string;
  let testLogIds: Array<string | number> = [];

  const requestJson = async (
    path: string,
    options: {
      method?: string;
      headers?: Record<string, string>;
      token?: string;
      body?: any;
    } = {}
  ) => {
    const url = `${baseUrl}${path}`;
    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...(options.headers || {}),
    };
    if (options.token) {
      headers['Authorization'] = `Bearer ${options.token}`;
    }
    if (options.body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    const res = await fetch(url, {
      method: options.method || 'GET',
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
    const body = await res.json().catch(() => null);
    return { status: res.status, body };
  };

  before(async () => {
    // 1. Ensure test user in DB
    await pool.query(
      `INSERT INTO users (id, email, password_hash, full_name, status, created_at, updated_at)
       VALUES ($1, 'devops-logs@aegisai.io', 'dummy_hash', 'DevOps Logs User', 'ACTIVE', NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET status = 'ACTIVE', deleted_at = NULL;`,
      [testUserId]
    );

    server = http.createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve());
    });
    const addr = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${addr.port}`;

    validUserToken = jwt.sign(
      {
        id: testUserId,
        userId: testUserId,
        email: 'devops-logs@aegisai.io',
        roles: ['DEVOPS', 'USER'],
      },
      config.jwt.secret,
      { expiresIn: '1h' }
    );

    // Seed test logs with diverse severity, K8s namespaces, deployments and pods
    const seedLogs = [
      {
        cluster_id: testClusterId,
        service_id: 'test-order-service',
        level: 'INFO',
        message: 'Order created successfully with ID ord-101',
        source: 'k8s-agent',
        occurred_at: new Date(Date.now() - 5 * 60 * 1000), // 5m ago
        metadata: {
          pod_id: 'pod-order-01',
          pod_name: 'pod-order-01',
          service_id: 'test-order-service',
          deployment: 'test-order-service',
          namespace: 'production',
        },
      },
      {
        cluster_id: testClusterId,
        service_id: 'test-order-service',
        level: 'WARN',
        message: 'Payment gateway latency elevated (1200ms)',
        source: 'k8s-agent',
        occurred_at: new Date(Date.now() - 3 * 60 * 1000), // 3m ago
        metadata: {
          pod_id: 'pod-order-01',
          pod_name: 'pod-order-01',
          service_id: 'test-order-service',
          deployment: 'test-order-service',
          namespace: 'production',
        },
      },
      {
        cluster_id: testClusterId,
        service_id: 'test-order-service',
        level: 'ERROR',
        message: 'Database connection failed: timeout connecting to PostgreSQL replica',
        source: 'k8s-agent',
        occurred_at: new Date(Date.now() - 1 * 60 * 1000), // 1m ago
        metadata: {
          pod_id: 'pod-order-02',
          pod_name: 'pod-order-02',
          service_id: 'test-order-service',
          deployment: 'test-order-service',
          namespace: 'production',
        },
      },
      {
        cluster_id: testClusterId,
        service_id: 'test-inventory-service',
        level: 'INFO',
        message: 'Stock reservation committed for SKU-999',
        source: 'k8s-agent',
        occurred_at: new Date(Date.now() - 2 * 60 * 1000), // 2m ago
        metadata: {
          pod_id: 'pod-inv-01',
          pod_name: 'pod-inv-01',
          service_id: 'test-inventory-service',
          deployment: 'test-inventory-service',
          namespace: 'staging',
        },
      },
    ];

    for (const log of seedLogs) {
      const created = await LogModel.create(log);
      testLogIds.push(created.id);
    }
  });

  after(async () => {
    if (testLogIds.length > 0) {
      await pool.query('DELETE FROM logs WHERE id = ANY($1)', [testLogIds]);
    }
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
    }
    await closeRedis();
    await pool.end();
  });

  test('1. Reject unauthorized requests without JWT token with 401', async () => {
    const res = await requestJson('/api/v1/telemetry/logs');
    assert.strictEqual(res.status, 401);
  });

  test('2. Retrieve paginated logs with valid token and proper structure', async () => {
    const res = await requestJson('/api/v1/telemetry/logs?limit=10', { token: validUserToken });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(Array.isArray(res.body.data.logs));
    assert.ok(res.body.data.pagination);
    assert.ok(typeof res.body.data.pagination.total === 'number');
    assert.strictEqual(res.body.data.pagination.page, 1);
    assert.strictEqual(res.body.data.pagination.limit, 10);
  });

  test('3. Filter logs by severity level (level=ERROR)', async () => {
    const res = await requestJson('/api/v1/telemetry/logs?level=ERROR&service_id=test-order-service', {
      token: validUserToken,
    });
    assert.strictEqual(res.status, 200);
    const { logs } = res.body.data;
    assert.ok(logs.length >= 1);
    for (const log of logs) {
      assert.strictEqual(log.level, 'ERROR');
    }
  });

  test('4. Filter logs by service_id', async () => {
    const res = await requestJson('/api/v1/telemetry/logs?service_id=test-inventory-service', {
      token: validUserToken,
    });
    assert.strictEqual(res.status, 200);
    const { logs } = res.body.data;
    assert.ok(logs.length >= 1);
    for (const log of logs) {
      assert.ok(
        log.service_id === 'test-inventory-service' ||
          log.service_name === 'test-inventory-service' ||
          log.metadata?.service_id === 'test-inventory-service'
      );
    }
  });

  test('5. Search logs by keyword in message (search=PostgreSQL)', async () => {
    const res = await requestJson('/api/v1/telemetry/logs?search=PostgreSQL', {
      token: validUserToken,
    });
    assert.strictEqual(res.status, 200);
    const { logs } = res.body.data;
    assert.ok(logs.length >= 1);
    assert.ok(logs.some((l: any) => l.message.includes('PostgreSQL')));
  });

  test('6. Filter logs by time range (range=1h)', async () => {
    const res = await requestJson('/api/v1/telemetry/logs?range=1h&service_id=test-order-service', {
      token: validUserToken,
    });
    assert.strictEqual(res.status, 200);
    const { logs } = res.body.data;
    assert.ok(logs.length >= 3);
  });

  test('7. Pagination controls page offset and limit', async () => {
    const page1 = await requestJson('/api/v1/telemetry/logs?limit=2&page=1', { token: validUserToken });
    const page2 = await requestJson('/api/v1/telemetry/logs?limit=2&page=2', { token: validUserToken });

    assert.strictEqual(page1.status, 200);
    assert.strictEqual(page2.status, 200);
    assert.strictEqual(page1.body.data.logs.length, 2);
    assert.strictEqual(page2.body.data.logs.length, 2);

    // Logs in page 1 and page 2 must have distinct IDs
    const page1Ids = page1.body.data.logs.map((l: any) => l.id);
    const page2Ids = page2.body.data.logs.map((l: any) => l.id);
    const hasOverlap = page1Ids.some((id: string) => page2Ids.includes(id));
    assert.strictEqual(hasOverlap, false, 'Page 1 and Page 2 should not have overlapping IDs');
  });

  test('8. Rejects invalid time range where start_time > end_time with 400', async () => {
    const res = await requestJson(
      '/api/v1/telemetry/logs?start_time=2026-10-26T15:00:00Z&end_time=2026-10-26T14:00:00Z',
      { token: validUserToken }
    );
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.success, false);
  });

  test('9. Filter logs by Kubernetes namespace (namespace=production)', async () => {
    const res = await requestJson('/api/v1/telemetry/logs?namespace=production', {
      token: validUserToken,
    });
    assert.strictEqual(res.status, 200);
    const { logs } = res.body.data;
    assert.ok(logs.length >= 3);
    for (const log of logs) {
      assert.strictEqual(log.namespace, 'production');
    }
  });

  test('10. Filter logs by Kubernetes deployment (deployment=test-order-service)', async () => {
    const res = await requestJson('/api/v1/telemetry/logs?deployment=test-order-service', {
      token: validUserToken,
    });
    assert.strictEqual(res.status, 200);
    const { logs } = res.body.data;
    assert.ok(logs.length >= 3);
    for (const log of logs) {
      assert.strictEqual(log.service_name, 'test-order-service');
    }
  });

  test('11. Filter logs by Kubernetes pod (pod=pod-order-01)', async () => {
    const res = await requestJson('/api/v1/telemetry/logs?pod=pod-order-01', {
      token: validUserToken,
    });
    assert.strictEqual(res.status, 200);
    const { logs } = res.body.data;
    assert.ok(logs.length >= 2);
    for (const log of logs) {
      assert.strictEqual(log.pod_name, 'pod-order-01');
    }
  });

  test('12. Filter logs by combined Kubernetes filters (namespace + pod + level + time range)', async () => {
    const res = await requestJson(
      '/api/v1/telemetry/logs?namespace=production&pod=pod-order-01&level=WARN&range=1h',
      {
        token: validUserToken,
      }
    );
    assert.strictEqual(res.status, 200);
    const { logs } = res.body.data;
    assert.strictEqual(logs.length, 1);
    assert.strictEqual(logs[0].level, 'WARN');
    assert.strictEqual(logs[0].namespace, 'production');
    assert.strictEqual(logs[0].pod_name, 'pod-order-01');
  });

  test('13. Response records project namespace and pod_name attributes', async () => {
    const res = await requestJson('/api/v1/telemetry/logs?pod=pod-inv-01', {
      token: validUserToken,
    });
    assert.strictEqual(res.status, 200);
    const { logs } = res.body.data;
    assert.ok(logs.length >= 1);
    assert.strictEqual(logs[0].namespace, 'staging');
    assert.strictEqual(logs[0].pod_name, 'pod-inv-01');
  });
});
