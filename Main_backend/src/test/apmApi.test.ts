import test, { describe, before, after } from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import { AddressInfo } from 'node:net';
import jwt from 'jsonwebtoken';
import app from '../app';
import { config } from '../config/env';
import { pool } from '../config/database';
import { closeRedis } from '../config/redis';

describe('APM Monitoring Services & Metrics API Suite [S4][PB15 1.1]', () => {
  let server: http.Server;
  let baseUrl: string;

  const testUserId = 'a9000000-0000-4000-8000-000000000001';
  let validUserToken: string;

  const requestJson = async (path: string, options: { method?: string; headers?: Record<string, string>; token?: string } = {}) => {
    const url = `${baseUrl}${path}`;
    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...(options.headers || {}),
    };
    if (options.token) {
      headers['Authorization'] = `Bearer ${options.token}`;
    }

    const res = await fetch(url, {
      method: options.method || 'GET',
      headers,
    });
    const body = await res.json().catch(() => null);
    return { status: res.status, body };
  };

  before(async () => {
    // Ensure test user exists in database for auth middleware verification
    await pool.query(
      `INSERT INTO users (id, email, password_hash, full_name, status, created_at, updated_at)
       VALUES ($1, 'devops-apm@aegisai.io', 'dummy_hash', 'DevOps APM User', 'ACTIVE', NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET status = 'ACTIVE', deleted_at = NULL;`,
      [testUserId]
    );

    // Generate valid JWT token
    validUserToken = jwt.sign(
      {
        id: testUserId,
        email: 'devops-apm@aegisai.io',
        roles: ['DEVOPS', 'USER'],
        organizationId: 'b9000000-0000-4000-8000-000000000001',
      },
      config.jwt.secret,
      { expiresIn: '1h' }
    );

    // Insert sample agent_metrics test rows
    await pool.query(`
      INSERT INTO agent_metrics (
        agent_id, cluster_id, service_id, pod_id,
        cpu, ram, disk, request_rate, latency, http_5xx_rate,
        pod_restart_count, replica_count, collected_at
      ) VALUES
        ('test-apm-agent', 'test-cluster', 'test-apm-order-service', 'pod-1', 15.0, 30.0, 10.0, 48.5, 25.0, 0.0, 0, 2, NOW() - INTERVAL '1 minute'),
        ('test-apm-agent', 'test-cluster', 'test-apm-order-service', 'pod-2', 18.0, 32.0, 10.0, 52.0, 30.0, 0.2, 0, 2, NOW() - INTERVAL '30 seconds'),
        ('test-apm-agent', 'test-cluster', 'test-apm-payment-service', 'pod-3', 25.0, 40.0, 15.0, 15.0, 120.0, 1.5, 1, 1, NOW() - INTERVAL '45 seconds');
    `);

    // Start local server
    await new Promise<void>((resolve) => {
      server = http.createServer(app);
      server.listen(0, () => {
        const addr = server.address() as AddressInfo;
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  after(async () => {
    // Cleanup test data
    await pool.query(`DELETE FROM agent_metrics WHERE agent_id = 'test-apm-agent'`).catch(() => {});
    await pool.query(`DELETE FROM users WHERE id = $1`, [testUserId]).catch(() => {});
    await new Promise<void>((resolve) => {
      if (server) server.close(() => resolve());
      else resolve();
    });
    await closeRedis().catch(() => {});
  });

  test('1. GET /api/v1/telemetry/services requires authentication (401 without token)', async () => {
    const res = await requestJson('/api/v1/telemetry/services');
    assert.strictEqual(res.status, 401);
  });

  test('2. GET /api/v1/telemetry/services returns list of monitored services with aggregated metrics', async () => {
    const res = await requestJson('/api/v1/telemetry/services?window_minutes=60', {
      token: validUserToken,
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(Array.isArray(res.body.data));
    assert.ok(res.body.data.length >= 2);

    const orderService = res.body.data.find((s: any) => s.service_id === 'test-apm-order-service');
    assert.ok(orderService, 'test-apm-order-service should exist in returned services');
    assert.ok(orderService.avg_latency_ms >= 20.0);
    assert.ok(orderService.avg_request_rate >= 40.0);
    assert.ok(orderService.replica_count >= 1);
  });

  test('3. GET /api/v1/telemetry/services/:serviceId/metrics-sequence returns time-series with extended limits', async () => {
    const res = await requestJson(
      '/api/v1/telemetry/services/test-apm-order-service/metrics-sequence?limit=180&bucket_seconds=5',
      { token: validUserToken }
    );

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.service_id, 'test-apm-order-service');
    assert.ok(Array.isArray(res.body.data.sequence));
    assert.ok(res.body.data.sequence.length > 0);

    const point = res.body.data.sequence[0];
    assert.ok(point.time_bucket);
    assert.strictEqual(typeof point.latency, 'number');
    assert.strictEqual(typeof point.request_rate, 'number');
    assert.strictEqual(typeof point.http_5xx_rate, 'number');
  });

  test('4. GET /api/v1/telemetry/services/:serviceId/metrics-sequence rejects invalid limit > 2000 or < 1', async () => {
    const resTooBig = await requestJson(
      '/api/v1/telemetry/services/test-apm-order-service/metrics-sequence?limit=9999',
      { token: validUserToken }
    );
    assert.strictEqual(resTooBig.status, 400);

    const resNegative = await requestJson(
      '/api/v1/telemetry/services/test-apm-order-service/metrics-sequence?limit=-5',
      { token: validUserToken }
    );
    assert.strictEqual(resNegative.status, 400);
  });
});
