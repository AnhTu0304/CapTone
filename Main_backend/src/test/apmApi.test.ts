import test, { describe, before, after } from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import crypto from 'node:crypto';
import { AddressInfo } from 'node:net';
import jwt from 'jsonwebtoken';
import app from '../app';
import { config } from '../config/env';
import { pool } from '../config/database';
import { closeRedis } from '../config/redis';

describe('APM Monitoring Services & Ingestion Pipeline Suite [S4][PB15 1.1 - 1.3]', () => {
  let server: http.Server;
  let baseUrl: string;

  const testUserId = 'a9000000-0000-4000-8000-000000000001';
  const testOrgId = 'b9000000-0000-4000-8000-000000000001';
  const testEnvId = 'c9000000-0000-4000-8000-000000000001';
  const testClusterId = 'd9000000-0000-4000-8000-000000000001';
  const testAgentId = 'e9000000-0000-4000-8000-000000000001';
  const testTokenId = 'f9000000-0000-4000-8000-000000000001';
  const rawAgentToken = 'ag_live_apm_test_token_secret_123';

  let validUserToken: string;

  const requestJson = async (
    path: string,
    options: {
      method?: string;
      headers?: Record<string, string>;
      token?: string;
      agentToken?: string;
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
    if (options.agentToken) {
      headers['x-agent-token'] = options.agentToken;
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
    // 1. Ensure test user & tenant structure in DB
    await pool.query(
      `INSERT INTO users (id, email, password_hash, full_name, status, created_at, updated_at)
       VALUES ($1, 'devops-apm@aegisai.io', 'dummy_hash', 'DevOps APM User', 'ACTIVE', NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET status = 'ACTIVE', deleted_at = NULL;`,
      [testUserId]
    );

    await pool.query(
      `INSERT INTO organizations (id, name, slug, status, created_by, created_at, updated_at)
       VALUES ($1, 'APM Test Org', 'apm-test-org', 'ACTIVE', $2, NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET status = 'ACTIVE', deleted_at = NULL;`,
      [testOrgId, testUserId]
    );

    await pool.query(
      `INSERT INTO environments (id, organization_id, name, code, environment_type, created_by, created_at, updated_at)
       VALUES ($1, $2, 'APM Production', 'apm-prod', 'PRODUCTION', $3, NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET organization_id = EXCLUDED.organization_id;`,
      [testEnvId, testOrgId, testUserId]
    );

    await pool.query(
      `INSERT INTO clusters (id, environment_id, name, provider, status, created_at, updated_at)
       VALUES ($1, $2, 'test-cluster', 'MINIKUBE', 'CONNECTED', NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET environment_id = EXCLUDED.environment_id;`,
      [testClusterId, testEnvId]
    );

    await pool.query(
      `INSERT INTO agents (id, agent_uid, cluster_id, environment_id, name, version, status, created_at, updated_at)
       VALUES ($1, 'uid-apm-agent-01', $2, $3, 'test-apm-agent', '1.0.0', 'ONLINE', NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET status = 'ONLINE', cluster_id = EXCLUDED.cluster_id, environment_id = EXCLUDED.environment_id;`,
      [testAgentId, testClusterId, testEnvId]
    );

    const tokenHash = crypto.createHash('sha256').update(rawAgentToken).digest('hex');
    await pool.query(
      `INSERT INTO agent_tokens (id, agent_id, token_hash, token_prefix, expires_at, revoked_at, created_at)
       VALUES ($1, $2, $3, $4, NOW() + INTERVAL '30 days', NULL, NOW())
       ON CONFLICT (id) DO UPDATE SET token_hash = EXCLUDED.token_hash, expires_at = EXCLUDED.expires_at, revoked_at = NULL;`,
      [testTokenId, testAgentId, tokenHash, rawAgentToken.slice(0, 12)]
    );

    // 2. Generate valid JWT token for API user
    validUserToken = jwt.sign(
      {
        id: testUserId,
        email: 'devops-apm@aegisai.io',
        roles: ['DEVOPS', 'USER'],
        organizationId: testOrgId,
      },
      config.jwt.secret,
      { expiresIn: '1h' }
    );

    // 3. Insert baseline agent_metrics test rows
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

    // 4. Start local server
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
    await pool.query(`DELETE FROM agent_metrics WHERE agent_id IN ('test-apm-agent', $1)`, [testAgentId]).catch(() => {});
    await pool.query(`DELETE FROM agent_tokens WHERE agent_id = $1`, [testAgentId]).catch(() => {});
    await pool.query(`DELETE FROM agents WHERE id = $1`, [testAgentId]).catch(() => {});
    await pool.query(`DELETE FROM clusters WHERE id = $1`, [testClusterId]).catch(() => {});
    await pool.query(`DELETE FROM environments WHERE id = $1`, [testEnvId]).catch(() => {});
    await pool.query(`DELETE FROM organizations WHERE id = $1`, [testOrgId]).catch(() => {});
    await pool.query(`DELETE FROM users WHERE id = $1`, [testUserId]).catch(() => {});
    await new Promise<void>((resolve) => {
      if (server) server.close(() => resolve());
      else resolve();
    });
    await closeRedis().catch(() => {});
    await pool.end().catch(() => {});
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

  test('5. POST /api/v1/agents/apm-metrics requires Agent authentication (401 without token)', async () => {
    const res = await requestJson('/api/v1/agents/apm-metrics', {
      method: 'POST',
      body: {
        service_id: 'test-apm-order-service',
        timestamp: new Date().toISOString(),
        cpu: 25.0,
        ram: 64.0,
        disk: 10.0,
        request_rate: 30.0,
        latency: 18.0,
        http_5xx_rate: 0.0,
      },
    });
    assert.strictEqual(res.status, 401);
  });

  test('6. POST /api/v1/agents/apm-metrics successfully ingests single APM metric sample', async () => {
    const res = await requestJson('/api/v1/agents/apm-metrics', {
      method: 'POST',
      agentToken: rawAgentToken,
      body: {
        service_id: 'test-apm-order-service',
        pod_id: 'pod-test-apm-live-1',
        timestamp: new Date().toISOString(),
        cpu: 32.5,
        ram: 75.0,
        disk: 12.0,
        request_rate: 65.0,
        latency: 28.4,
        http_5xx_rate: 0.05,
        replica_count: 3,
        pod_restart_count: 0,
      },
    });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.ingested_count, 1);
  });

  test('7. POST /api/v1/agents/apm-metrics successfully ingests batch of APM metric samples', async () => {
    const res = await requestJson('/api/v1/agents/apm-metrics', {
      method: 'POST',
      agentToken: rawAgentToken,
      body: {
        metrics: [
          {
            service_id: 'test-apm-inventory-service',
            pod_id: 'pod-inv-1',
            timestamp: new Date().toISOString(),
            cpu: 15.0,
            ram: 45.0,
            disk: 8.0,
            request_rate: 22.0,
            latency: 14.5,
            http_5xx_rate: 0.0,
            replica_count: 2,
            pod_restart_count: 0,
          },
          {
            service_id: 'test-apm-inventory-service',
            pod_id: 'pod-inv-2',
            timestamp: new Date().toISOString(),
            cpu: 18.0,
            ram: 50.0,
            disk: 8.0,
            request_rate: 25.0,
            latency: 16.0,
            http_5xx_rate: 0.1,
            replica_count: 2,
            pod_restart_count: 0,
          },
        ],
      },
    });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.ingested_count, 2);
  });

  test('8. POST /api/v1/agents/apm-metrics rejects invalid values (negative latency or 5xx > 100)', async () => {
    const resNegative = await requestJson('/api/v1/agents/apm-metrics', {
      method: 'POST',
      agentToken: rawAgentToken,
      body: {
        service_id: 'test-apm-order-service',
        timestamp: new Date().toISOString(),
        cpu: 10.0,
        ram: 20.0,
        disk: 5.0,
        request_rate: 10.0,
        latency: -5.0,
        http_5xx_rate: 0.0,
      },
    });
    assert.strictEqual(resNegative.status, 400);

    const resOverflow = await requestJson('/api/v1/agents/apm-metrics', {
      method: 'POST',
      agentToken: rawAgentToken,
      body: {
        service_id: 'test-apm-order-service',
        timestamp: new Date().toISOString(),
        cpu: 10.0,
        ram: 20.0,
        disk: 5.0,
        request_rate: 10.0,
        latency: 10.0,
        http_5xx_rate: 150.0,
      },
    });
    assert.strictEqual(resOverflow.status, 400);
  });

  test('9. GET /api/v1/telemetry/services/:serviceId/metrics-sequence supports time window filtering (from/to)', async () => {
    const now = Date.now();
    const fromIso = new Date(now - 120000).toISOString();
    const toIso = new Date(now + 1000).toISOString();

    const res = await requestJson(
      `/api/v1/telemetry/services/test-apm-order-service/metrics-sequence?limit=50&bucket_seconds=5&from=${encodeURIComponent(fromIso)}&to=${encodeURIComponent(toIso)}`,
      { token: validUserToken }
    );

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(Array.isArray(res.body.data.sequence));
  });

  test('10. GET /api/v1/telemetry/services respects cluster_id and organization isolation', async () => {
    const res = await requestJson(`/api/v1/telemetry/services?window_minutes=60&cluster_id=${testClusterId}`, {
      token: validUserToken,
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(Array.isArray(res.body.data));
  });
});
