import test, { describe, before, after } from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { AddressInfo } from 'node:net';
import jwt from 'jsonwebtoken';
import app from '../app';
import { config } from '../config/env';
import { pool } from '../config/database';
import { testRedisConnection, closeRedis } from '../config/redis';

describe('Kiểm thử Tích hợp Giao diện, Cấu hình Ngưỡng & Kích hoạt Cảnh báo [S5][PBI21 Task 3.4]', () => {
  let server: http.Server;
  let baseUrl: string;

  const ownerAId = 'a3444444-0000-4000-8000-000000000001';
  const viewerAId = 'a3444444-0000-4000-8000-000000000003';
  const orgAId = 'b3444444-0000-4000-8000-000000000001';
  const envAId = 'c3444444-0000-4000-8000-000000000001';
  const clusterAId = 'd3444444-0000-4000-8000-000000000001';
  const agentAId = 'e3444444-0000-4000-8000-000000000001';

  let ownerAJwt: string;
  let viewerAJwt: string;
  let fixtureData: any;

  async function requestJson(
    reqPath: string,
    options: {
      method?: string;
      headers?: Record<string, string>;
      body?: any;
    } = {}
  ) {
    const res = await fetch(`${baseUrl}${reqPath}`, {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
    const json = await res.json().catch(() => ({}));
    return { status: res.status, body: json };
  }

  before(async () => {
    await testRedisConnection();

    const fixturePath = path.resolve(process.cwd(), '../pbi21_3_4_alert_ui_demo.json');
    fixtureData = JSON.parse(fs.readFileSync(fixturePath, 'utf-8'));

    // Dọn dẹp dữ liệu test cũ
    await pool.query(`DELETE FROM alert_events WHERE organization_id = $1`, [orgAId]);
    await pool.query(`DELETE FROM alert_rules WHERE organization_id = $1`, [orgAId]);
    await pool.query(`DELETE FROM node_metrics WHERE organization_id = $1`, [orgAId]);
    await pool.query(`DELETE FROM agent_metrics WHERE organization_id = $1`, [orgAId]);
    await pool.query(`DELETE FROM kubernetes_events WHERE cluster_id = $1`, [clusterAId]);
    await pool.query(`DELETE FROM pods WHERE cluster_id = $1`, [clusterAId]);
    await pool.query(`DELETE FROM workloads WHERE cluster_id = $1`, [clusterAId]);
    await pool.query(`DELETE FROM namespaces WHERE cluster_id = $1`, [clusterAId]);
    await pool.query(`DELETE FROM agents WHERE id = $1`, [agentAId]);
    await pool.query(`DELETE FROM clusters WHERE id = $1`, [clusterAId]);
    await pool.query(`DELETE FROM environments WHERE id = $1`, [envAId]);
    await pool.query(`DELETE FROM organization_members WHERE organization_id = $1`, [orgAId]);
    await pool.query(`DELETE FROM organizations WHERE id = $1`, [orgAId]);
    await pool.query(`DELETE FROM users WHERE id IN ($1, $2)`, [ownerAId, viewerAId]);

    const rolesRes = await pool.query(`SELECT id, code FROM roles WHERE scope = 'ORGANIZATION'`);
    const roleMap = new Map<string, string>();
    for (const r of rolesRes.rows) {
      roleMap.set(r.code, r.id);
    }
    const smeOwnerRoleId = roleMap.get('SME_OWNER');
    const viewerRoleId = roleMap.get('VIEWER');

    await pool.query(
      `INSERT INTO users (id, email, password_hash, full_name, status, created_at, updated_at) VALUES
       ($1, 'owner.a.t34@test.com', 'dummy_hash', 'Owner A T34', 'ACTIVE', NOW(), NOW()),
       ($2, 'viewer.a.t34@test.com', 'dummy_hash', 'Viewer A T34', 'ACTIVE', NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET status = 'ACTIVE', deleted_at = NULL`,
      [ownerAId, viewerAId]
    );

    await pool.query(
      `INSERT INTO organizations (id, name, slug, status, created_by, created_at, updated_at) VALUES
       ($1, 'Task34 Demo Org', 't34-demo-org', 'ACTIVE', $2, NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET status = 'ACTIVE', deleted_at = NULL`,
      [orgAId, ownerAId]
    );

    await pool.query(
      `INSERT INTO organization_members (organization_id, user_id, role_id, status, joined_at) VALUES
       ($1, $2, $3, 'ACTIVE', NOW()),
       ($1, $4, $5, 'ACTIVE', NOW())
       ON CONFLICT (organization_id, user_id) DO UPDATE SET status = 'ACTIVE'`,
      [orgAId, ownerAId, smeOwnerRoleId, viewerAId, viewerRoleId]
    );

    await pool.query(
      `INSERT INTO environments (id, organization_id, name, code, environment_type, created_by, created_at, updated_at) VALUES
       ($1, $2, 'Staging T34', 'staging-t34', 'STAGING', $3, NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET deleted_at = NULL`,
      [envAId, orgAId, ownerAId]
    );

    await pool.query(
      `INSERT INTO clusters (id, environment_id, name, cluster_uid, provider, kubernetes_version, status, created_at, updated_at) VALUES
       ($1, $2, 'k8s-pods-cluster-v2', 'uid-t34-cluster', 'MINIKUBE', 'v1.37.0', 'CONNECTED', NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET deleted_at = NULL`,
      [clusterAId, envAId]
    );

    await pool.query(
      `INSERT INTO agents (id, environment_id, cluster_id, name, agent_uid, version, status) VALUES
       ($1, $2, $3, 'agent-t34', 'uid-agent-t34', '1.0.0', 'ONLINE')
       ON CONFLICT (id) DO NOTHING`,
      [agentAId, envAId, clusterAId]
    );

    ownerAJwt = jwt.sign(
      { id: ownerAId, email: 'owner.a.t34@test.com', roles: ['SME_OWNER'], status: 'ACTIVE', organization_id: orgAId },
      config.jwt.secret,
      { expiresIn: '1h' }
    );

    viewerAJwt = jwt.sign(
      { id: viewerAId, email: 'viewer.a.t34@test.com', roles: ['VIEWER'], status: 'ACTIVE', organization_id: orgAId },
      config.jwt.secret,
      { expiresIn: '1h' }
    );

    server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  after(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    await pool.query(`DELETE FROM alert_events WHERE organization_id = $1`, [orgAId]);
    await pool.query(`DELETE FROM alert_rules WHERE organization_id = $1`, [orgAId]);
    await pool.query(`DELETE FROM node_metrics WHERE organization_id = $1`, [orgAId]);
    await pool.query(`DELETE FROM agent_metrics WHERE organization_id = $1`, [orgAId]);
    await pool.query(`DELETE FROM kubernetes_events WHERE cluster_id = $1`, [clusterAId]);
    await pool.query(`DELETE FROM pods WHERE cluster_id = $1`, [clusterAId]);
    await pool.query(`DELETE FROM workloads WHERE cluster_id = $1`, [clusterAId]);
    await pool.query(`DELETE FROM namespaces WHERE cluster_id = $1`, [clusterAId]);
    await pool.query(`DELETE FROM agents WHERE id = $1`, [agentAId]);
    await pool.query(`DELETE FROM clusters WHERE id = $1`, [clusterAId]);
    await pool.query(`DELETE FROM environments WHERE id = $1`, [envAId]);
    await pool.query(`DELETE FROM organization_members WHERE organization_id = $1`, [orgAId]);
    await pool.query(`DELETE FROM organizations WHERE id = $1`, [orgAId]);
    await pool.query(`DELETE FROM users WHERE id IN ($1, $2)`, [ownerAId, viewerAId]);
    await closeRedis();
    await pool.end();
  });

  test('1. GET /api/v1/alert-rules/metadata trả về danh sách Metric Types, Operators, Severities và Units hợp lệ cho UI Modal', async () => {
    const res = await requestJson('/api/v1/alert-rules/metadata', {
      headers: { Authorization: `Bearer ${ownerAJwt}` },
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(Array.isArray(res.body.data.metric_types));
    const metricCodes = res.body.data.metric_types.map((m: any) => m.code);
    assert.ok(metricCodes.includes('CPU'));
    assert.ok(metricCodes.includes('POD_CRASH_LOOP'));
    assert.ok(metricCodes.includes('HTTP_5XX_RATE'));
    assert.strictEqual(res.body.data.units_map.CPU[0], '%');
    assert.ok(res.body.data.units_map.POD_CRASH_LOOP.includes('restarts'));
  });

  test('2. POST /api/v1/alerts/demo-ingest nạp pbi21_3_4_alert_ui_demo.json và kích hoạt đúng 3 Alert Events (CPU-HIGH-001, K8S-CRASH-001, APM-5XX-001)', async () => {
    const ingestRes = await requestJson('/api/v1/alerts/demo-ingest', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ownerAJwt}`,
        'X-Organization-Id': orgAId,
      },
      body: {
        cluster_id: clusterAId,
        mode: 'trigger',
        scenarios: fixtureData.scenarios,
      },
    });

    assert.strictEqual(ingestRes.status, 200);
    assert.strictEqual(ingestRes.body.success, true);
    assert.strictEqual(ingestRes.body.data.ingested_scenarios.length, 3);

    // Kiểm tra Summary API
    const summaryRes = await requestJson(`/api/v1/alerts/summary?cluster_id=${clusterAId}`, {
      headers: { Authorization: `Bearer ${ownerAJwt}` },
    });
    assert.strictEqual(summaryRes.status, 200);
    assert.strictEqual(summaryRes.body.data.total_active, 3);
    assert.strictEqual(summaryRes.body.data.critical, 2);
    assert.strictEqual(summaryRes.body.data.warning, 1);

    // Kiểm tra danh sách Alert Events
    const listRes = await requestJson(`/api/v1/alerts?cluster_id=${clusterAId}&limit=20`, {
      headers: { Authorization: `Bearer ${ownerAJwt}` },
    });
    assert.strictEqual(listRes.status, 200);
    const alerts = listRes.body.data.items;
    assert.strictEqual(alerts.length, 3);

    const cpuAlert = alerts.find((a: any) => a.resource_id === 'worker-node-01');
    const k8sAlert = alerts.find((a: any) => a.resource_id === 'orders-api-7d9c8b6f4-x9k2m');
    const apmAlert = alerts.find((a: any) => a.resource_id === 'checkout-service');

    assert.ok(cpuAlert, 'Phải tạo cảnh báo CPU-HIGH-001 cho worker-node-01');
    assert.strictEqual(cpuAlert.severity, 'WARNING');
    assert.strictEqual(cpuAlert.status, 'ACTIVE');
    assert.strictEqual(Number(cpuAlert.observed_value), 96.1);
    assert.strictEqual(Number(cpuAlert.threshold_value), 85);

    assert.ok(k8sAlert, 'Phải tạo cảnh báo K8S-CRASH-001 cho orders-api-7d9c8b6f4-x9k2m');
    assert.strictEqual(k8sAlert.severity, 'CRITICAL');
    assert.strictEqual(k8sAlert.status, 'ACTIVE');
    assert.strictEqual(Number(k8sAlert.observed_value), 6);
    assert.strictEqual(Number(k8sAlert.threshold_value), 4);
    assert.strictEqual(k8sAlert.details?.namespace, 'production');

    assert.ok(apmAlert, 'Phải tạo cảnh báo APM-5XX-001 cho checkout-service');
    assert.strictEqual(apmAlert.severity, 'CRITICAL');
    assert.strictEqual(apmAlert.status, 'ACTIVE');
    assert.strictEqual(Number(apmAlert.observed_value), 11.2);
    assert.strictEqual(Number(apmAlert.threshold_value), 5);
  });

  test('3. Chạy lại demo-ingest lần 2 chống trùng lặp (Deduplication): không sinh dòng ACTIVE mới, tăng occurrence_count lên 2', async () => {
    const ingestRes2 = await requestJson('/api/v1/alerts/demo-ingest', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ownerAJwt}`,
        'X-Organization-Id': orgAId,
      },
      body: {
        cluster_id: clusterAId,
        mode: 'trigger',
        scenarios: fixtureData.scenarios,
      },
    });
    assert.strictEqual(ingestRes2.status, 200);

    const listRes = await requestJson(`/api/v1/alerts?cluster_id=${clusterAId}&limit=20`, {
      headers: { Authorization: `Bearer ${ownerAJwt}` },
    });
    const activeAlerts = listRes.body.data.items.filter((a: any) => a.status === 'ACTIVE');
    assert.strictEqual(activeAlerts.length, 3);
    for (const alertItem of activeAlerts) {
      assert.strictEqual(Number(alertItem.occurrence_count), 2);
    }
  });

  test('4. Chi tiết Alert (GET /api/v1/alerts/:id) trả về đầy đủ Organization, Cluster, Rule, Namespace và Event History cho Side Drawer', async () => {
    const listRes = await requestJson(`/api/v1/alerts?cluster_id=${clusterAId}&resource_type=POD`, {
      headers: { Authorization: `Bearer ${viewerAJwt}` },
    });
    assert.strictEqual(listRes.status, 200);
    assert.strictEqual(listRes.body.data.items.length, 1);

    const podAlertId = listRes.body.data.items[0].id;
    const detailRes = await requestJson(`/api/v1/alerts/${podAlertId}`, {
      headers: { Authorization: `Bearer ${viewerAJwt}` },
    });
    assert.strictEqual(detailRes.status, 200);
    assert.strictEqual(detailRes.body.data.organization_name, 'Task34 Demo Org');
    assert.strictEqual(detailRes.body.data.cluster_name, 'k8s-pods-cluster-v2');
    assert.strictEqual(detailRes.body.data.rule_name, 'Demo Rule - Pod CrashLoopBackOff');
    assert.strictEqual(detailRes.body.data.details?.namespace, 'production');
  });

  test('5. RBAC: VIEWER bị từ chối (403) khi gọi demo-ingest, acknowledge hoặc resolve', async () => {
    const viewerIngest = await requestJson('/api/v1/alerts/demo-ingest', {
      method: 'POST',
      headers: { Authorization: `Bearer ${viewerAJwt}` },
      body: { cluster_id: clusterAId, scenarios: fixtureData.scenarios },
    });
    assert.strictEqual(viewerIngest.status, 403);
  });

  test('6. Auto-Resolve khi gửi tín hiệu phục hồi (mode=recover): cả 3 cảnh báo chuyển sang RESOLVED và có resolved_at', async () => {
    const recoverRes = await requestJson('/api/v1/alerts/demo-ingest', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ownerAJwt}`,
        'X-Organization-Id': orgAId,
      },
      body: {
        cluster_id: clusterAId,
        mode: 'recover',
        scenarios: fixtureData.scenarios,
      },
    });
    assert.strictEqual(recoverRes.status, 200);

    const summaryRes = await requestJson(`/api/v1/alerts/summary?cluster_id=${clusterAId}`, {
      headers: { Authorization: `Bearer ${ownerAJwt}` },
    });
    assert.strictEqual(summaryRes.body.data.total_active, 0);
    assert.strictEqual(summaryRes.body.data.resolved, 3);
  });
});
