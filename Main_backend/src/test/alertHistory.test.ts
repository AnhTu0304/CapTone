import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import { AddressInfo } from 'node:net';
import jwt from 'jsonwebtoken';
import app from '../app';
import { pool } from '../config/database';
import { testRedisConnection } from '../config/redis';
import { config } from '../config/env';

describe('[S5][PBI22] Alert History & Query API Test Suite (Task 4.1 & 4.2)', () => {
  let server: http.Server;
  let baseUrl: string;

  const testOrgAId = 'a4111111-0000-4000-8000-000000000001';
  const testOrgBId = 'b4222222-0000-4000-8000-000000000002';
  const testEnvAId = 'e4111111-0000-4000-8000-000000000001';
  const testEnvBId = 'e4222222-0000-4000-8000-000000000002';
  const testClusterAId = 'c4111111-0000-4000-8000-000000000001';
  const testClusterBId = 'c4222222-0000-4000-8000-000000000002';

  const userDevOpsId = 'd4111111-0000-4000-8000-000000000001';
  const userOrgBId = 'd4222222-0000-4000-8000-000000000002';
  const userViewerId = 'd4333333-0000-4000-8000-000000000003';

  let tokenDevOps: string;
  let tokenOrgB: string;
  let tokenViewer: string;

  let event1Id: string; // CRITICAL, RESOLVED, node, namespace: default
  let event2Id: string; // WARNING, ACTIVE, node, namespace: default
  let event3Id: string; // CRITICAL, ACKNOWLEDGED, pod, namespace: payment
  let event4Id: string; // INFO, RESOLVED, service, namespace: production

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
    try {
      await testRedisConnection();

      // 1. Start server on dynamic port
      await new Promise<void>((resolve) => {
        server = http.createServer(app);
        server.listen(0, () => {
          const address = server.address() as AddressInfo;
          baseUrl = `http://127.0.0.1:${address.port}`;
          resolve();
        });
      });

      // Clean old test records
      await pool.query('DELETE FROM alert_events WHERE organization_id IN ($1, $2)', [testOrgAId, testOrgBId]);
      await pool.query('DELETE FROM clusters WHERE id IN ($1, $2)', [testClusterAId, testClusterBId]);
      await pool.query('DELETE FROM environments WHERE id IN ($1, $2)', [testEnvAId, testEnvBId]);
      await pool.query('DELETE FROM organization_members WHERE organization_id IN ($1, $2)', [testOrgAId, testOrgBId]);
      await pool.query('DELETE FROM organizations WHERE id IN ($1, $2)', [testOrgAId, testOrgBId]);
      await pool.query('DELETE FROM users WHERE id IN ($1, $2, $3)', [userDevOpsId, userOrgBId, userViewerId]);

      // 2. Ensure test users
      await pool.query(
        `INSERT INTO users (id, email, password_hash, full_name, status) VALUES
         ($1, 'devops.pbi22@test.com', 'hash', 'DevOps Alex PBI22', 'ACTIVE'),
         ($2, 'owner.pbi22b@test.com', 'hash', 'Owner Beta PBI22', 'ACTIVE'),
         ($3, 'viewer.pbi22@test.com', 'hash', 'Viewer Sam PBI22', 'ACTIVE')
         ON CONFLICT (id) DO UPDATE SET status = 'ACTIVE'`,
        [userDevOpsId, userOrgBId, userViewerId]
      );

      // 3. Ensure test organizations
      await pool.query(
        `INSERT INTO organizations (id, name, slug, status, created_by) VALUES
         ($1, 'Acme Test Org A', 'acme-test-org-a', 'ACTIVE', $2),
         ($3, 'Beta Test Org B', 'beta-test-org-b', 'ACTIVE', $4)
         ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`,
        [testOrgAId, userDevOpsId, testOrgBId, userOrgBId]
      );

      // 4. Role lookup & membership
      const rolesRes = await pool.query(`SELECT id, code FROM roles WHERE scope = 'ORGANIZATION'`);
      const roleMap = new Map<string, string>();
      for (const r of rolesRes.rows) {
        roleMap.set(r.code, r.id);
      }
      const devopsRoleId = roleMap.get('DEVOPS');
      const smeOwnerRoleId = roleMap.get('SME_OWNER');
      const viewerRoleId = roleMap.get('VIEWER');

      await pool.query(
        `INSERT INTO organization_members (organization_id, user_id, role_id, status) VALUES
         ($1, $2, $3, 'ACTIVE'),
         ($4, $5, $6, 'ACTIVE'),
         ($7, $8, $9, 'ACTIVE')
         ON CONFLICT (organization_id, user_id) DO UPDATE SET status = 'ACTIVE'`,
        [testOrgAId, userDevOpsId, devopsRoleId, testOrgBId, userOrgBId, smeOwnerRoleId, testOrgAId, userViewerId, viewerRoleId]
      );

      // 5. Ensure environments
      await pool.query(
        `INSERT INTO environments (id, organization_id, name, code, environment_type, created_by) VALUES
         ($1, $2, 'Env A', 'env-a', 'PRODUCTION', $3),
         ($4, $5, 'Env B', 'env-b', 'STAGING', $6)
         ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`,
        [testEnvAId, testOrgAId, userDevOpsId, testEnvBId, testOrgBId, userOrgBId]
      );

      // 6. Ensure clusters
      await pool.query(
        `INSERT INTO clusters (id, environment_id, name, cluster_uid, provider, status) VALUES
         ($1, $2, 'k8s-cluster-a', 'uid-cl-a', 'MINIKUBE', 'CONNECTED'),
         ($3, $4, 'k8s-cluster-b', 'uid-cl-b', 'MINIKUBE', 'CONNECTED')
         ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`,
        [testClusterAId, testEnvAId, testClusterBId, testEnvBId]
      );

      // 7. Generate JWT tokens
      tokenDevOps = jwt.sign(
        { id: userDevOpsId, email: 'devops.pbi22@test.com', role: 'DEVOPS', organization_id: testOrgAId },
        config.jwt.secret,
        { expiresIn: '1h' }
      );
      tokenOrgB = jwt.sign(
        { id: userOrgBId, email: 'owner.pbi22b@test.com', role: 'SME_OWNER', organization_id: testOrgBId },
        config.jwt.secret,
        { expiresIn: '1h' }
      );
      tokenViewer = jwt.sign(
        { id: userViewerId, email: 'viewer.pbi22@test.com', role: 'VIEWER', organization_id: testOrgAId },
        config.jwt.secret,
        { expiresIn: '1h' }
      );

      // 8. Seed distinct alert events for testing filters
      // Event 1: CRITICAL, RESOLVED, CPU, worker-node-01, namespace: default
      const r1 = await pool.query(
        `INSERT INTO alert_events (
           organization_id, cluster_id, rule_name, category, metric_type, resource_type, resource_id,
           namespace, severity, status, observed_value, threshold_value, unit, message,
           occurrence_count, first_detected_at, last_seen_at, resolved_at, resolved_by, created_at, updated_at
         ) VALUES (
           $1, $2, 'High CPU Worker Spike', 'RESOURCE', 'CPU', 'node', 'worker-node-01',
           'default', 'CRITICAL', 'RESOLVED', 98.4, 85.0, '%', 'CPU usage 98.4% exceeded 85%',
           4, NOW() - INTERVAL '2 hours', NOW() - INTERVAL '1 hour', NOW() - INTERVAL '45 minutes', $3, NOW() - INTERVAL '2 hours', NOW() - INTERVAL '45 minutes'
         ) RETURNING id`,
        [testOrgAId, testClusterAId, userDevOpsId]
      );
      event1Id = r1.rows[0].id;

      // Timeline for Event 1: TRIGGERED -> ESCALATED -> RESOLVED
      await pool.query(
        `INSERT INTO alert_event_history (alert_event_id, old_status, new_status, action, actor_type, note, created_at)
         VALUES 
           ($1, NULL, 'ACTIVE', 'TRIGGERED', 'SYSTEM', 'CPU spiked above 85%', NOW() - INTERVAL '2 hours'),
           ($1, 'ACTIVE', 'ACTIVE', 'ESCALATED', 'SYSTEM', 'Severity escalated to CRITICAL', NOW() - INTERVAL '1 hour 45 minutes'),
           ($1, 'ACTIVE', 'RESOLVED', 'RESOLVED', 'USER', 'Resolved manually by user', NOW() - INTERVAL '45 minutes')`,
        [event1Id]
      );

      // Event 2: WARNING, ACTIVE, RAM, worker-node-02, namespace: default
      const r2 = await pool.query(
        `INSERT INTO alert_events (
           organization_id, cluster_id, rule_name, category, metric_type, resource_type, resource_id,
           namespace, severity, status, observed_value, threshold_value, unit, message,
           occurrence_count, first_detected_at, last_seen_at, created_at, updated_at
         ) VALUES (
           $1, $2, 'Memory Saturation Warning', 'RESOURCE', 'RAM', 'node', 'worker-node-02',
           'default', 'WARNING', 'ACTIVE', 88.5, 80.0, '%', 'RAM usage 88.5% exceeded 80%',
           2, NOW() - INTERVAL '30 minutes', NOW() - INTERVAL '5 minutes', NOW() - INTERVAL '30 minutes', NOW() - INTERVAL '5 minutes'
         ) RETURNING id`,
        [testOrgAId, testClusterAId]
      );
      event2Id = r2.rows[0].id;

      await pool.query(
        `INSERT INTO alert_event_history (alert_event_id, old_status, new_status, action, actor_type, note, created_at)
         VALUES ($1, NULL, 'ACTIVE', 'TRIGGERED', 'SYSTEM', 'RAM exceeded 80%', NOW() - INTERVAL '30 minutes')`,
        [event2Id]
      );

      // Event 3: CRITICAL, ACKNOWLEDGED, POD_CRASH_LOOP, payment-service-pod, namespace: payment
      const r3 = await pool.query(
        `INSERT INTO alert_events (
           organization_id, cluster_id, rule_name, category, metric_type, resource_type, resource_id,
           namespace, severity, status, observed_value, threshold_value, unit, message,
           occurrence_count, first_detected_at, last_seen_at, acknowledged_at, acknowledged_by, created_at, updated_at
         ) VALUES (
           $1, $2, 'Payment Pod CrashLoopBackOff', 'KUBERNETES', 'POD_CRASH_LOOP', 'pod', 'payment-service-pod-x',
           'payment', 'CRITICAL', 'ACKNOWLEDGED', 8.0, 4.0, 'restarts', 'Pod restarted 8 times in payment namespace',
           5, NOW() - INTERVAL '1 hour', NOW() - INTERVAL '10 minutes', NOW() - INTERVAL '20 minutes', $3, NOW() - INTERVAL '1 hour', NOW() - INTERVAL '10 minutes'
         ) RETURNING id`,
        [testOrgAId, testClusterAId, userDevOpsId]
      );
      event3Id = r3.rows[0].id;

      await pool.query(
        `INSERT INTO alert_event_history (alert_event_id, old_status, new_status, action, actor_id, actor_type, note, created_at)
         VALUES 
           ($1, NULL, 'ACTIVE', 'TRIGGERED', NULL, 'SYSTEM', 'CrashLoopBackOff detected', NOW() - INTERVAL '1 hour'),
           ($1, 'ACTIVE', 'ACKNOWLEDGED', 'ACKNOWLEDGED', $2, 'USER', 'DevOps investigating pod logs', NOW() - INTERVAL '20 minutes')`,
        [event3Id, userDevOpsId]
      );

      // Event 4: INFO, RESOLVED, HTTP_5XX_RATE, order-api, namespace: production
      const r4 = await pool.query(
        `INSERT INTO alert_events (
           organization_id, cluster_id, rule_name, category, metric_type, resource_type, resource_id,
           namespace, severity, status, observed_value, threshold_value, unit, message,
           occurrence_count, first_detected_at, last_seen_at, resolved_at, created_at, updated_at
         ) VALUES (
           $1, $2, 'Order Service Minor Error Burst', 'APM', 'HTTP_5XX_RATE', 'service', 'order-api',
           'production', 'INFO', 'RESOLVED', 2.5, 2.0, '%', 'Minor 5xx burst 2.5%',
           1, NOW() - INTERVAL '10 hours', NOW() - INTERVAL '9 hours 30 minutes', NOW() - INTERVAL '9 hours', NOW() - INTERVAL '10 hours', NOW() - INTERVAL '9 hours'
         ) RETURNING id`,
        [testOrgAId, testClusterAId]
      );
      event4Id = r4.rows[0].id;

      await pool.query(
        `INSERT INTO alert_event_history (alert_event_id, old_status, new_status, action, actor_type, note, created_at)
         VALUES 
           ($1, NULL, 'ACTIVE', 'TRIGGERED', 'SYSTEM', 'Minor 5xx burst', NOW() - INTERVAL '10 hours'),
           ($1, 'ACTIVE', 'RESOLVED', 'AUTO_RESOLVED', 'SYSTEM', 'Auto resolved by Rule Engine', NOW() - INTERVAL '9 hours')`,
        [event4Id]
      );
    } catch (err) {
      console.error('CRITICAL BEFORE HOOK ERROR:', err);
      throw err;
    }
  });

  after(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    await pool.query('DELETE FROM alert_events WHERE organization_id IN ($1, $2)', [testOrgAId, testOrgBId]);
    await pool.query('DELETE FROM clusters WHERE id IN ($1, $2)', [testClusterAId, testClusterBId]);
    await pool.query('DELETE FROM environments WHERE id IN ($1, $2)', [testEnvAId, testEnvBId]);
    await pool.query('DELETE FROM organization_members WHERE organization_id IN ($1, $2)', [testOrgAId, testOrgBId]);
    await pool.query('DELETE FROM organizations WHERE id IN ($1, $2)', [testOrgAId, testOrgBId]);
    await pool.query('DELETE FROM users WHERE id IN ($1, $2, $3)', [userDevOpsId, userOrgBId, userViewerId]);
  });

  it('1. [API-01] GET /api/v1/alerts/history returns all alerts with pagination and formatted duration', async () => {
    const res = await requestJson('/api/v1/alerts/history?page=1&limit=10', {
      headers: { Authorization: `Bearer ${tokenDevOps}` },
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(Array.isArray(res.body.data), true);
    assert.strictEqual(res.body.pagination.total, 4);
    assert.strictEqual(res.body.pagination.page, 1);
    assert.strictEqual(res.body.pagination.limit, 10);
    assert.strictEqual(res.body.pagination.totalPages, 1);

    const first = res.body.data[0];
    assert.ok(first.id);
    assert.ok(first.rule_name);
    assert.ok(first.severity);
    assert.ok(first.status);
    assert.ok(first.duration_formatted);
    assert.ok(first.duration_seconds >= 0);
  });

  it('2. [API-02] GET /api/v1/alerts/history filters by severity (CRITICAL, WARNING, INFO)', async () => {
    // Filter CRITICAL
    const resCrit = await requestJson('/api/v1/alerts/history?severity=CRITICAL', {
      headers: { Authorization: `Bearer ${tokenDevOps}` },
    });
    assert.strictEqual(resCrit.status, 200);
    assert.strictEqual(resCrit.body.pagination.total, 2);
    assert.ok(resCrit.body.data.every((item: any) => item.severity === 'CRITICAL'));

    // Filter WARNING
    const resWarn = await requestJson('/api/v1/alerts/history?severity=WARNING', {
      headers: { Authorization: `Bearer ${tokenDevOps}` },
    });
    assert.strictEqual(resWarn.status, 200);
    assert.strictEqual(resWarn.body.pagination.total, 1);
    assert.strictEqual(resWarn.body.data[0].id, event2Id);

    // Filter INFO
    const resInfo = await requestJson('/api/v1/alerts/history?severity=INFO', {
      headers: { Authorization: `Bearer ${tokenDevOps}` },
    });
    assert.strictEqual(resInfo.status, 200);
    assert.strictEqual(resInfo.body.pagination.total, 1);
    assert.strictEqual(resInfo.body.data[0].id, event4Id);
  });

  it('3. [API-03] GET /api/v1/alerts/history filters by status (ACTIVE, ACKNOWLEDGED, RESOLVED)', async () => {
    // ACTIVE
    const resActive = await requestJson('/api/v1/alerts/history?status=ACTIVE', {
      headers: { Authorization: `Bearer ${tokenDevOps}` },
    });
    assert.strictEqual(resActive.status, 200);
    assert.strictEqual(resActive.body.pagination.total, 1);
    assert.strictEqual(resActive.body.data[0].id, event2Id);

    // ACKNOWLEDGED
    const resAck = await requestJson('/api/v1/alerts/history?status=ACKNOWLEDGED', {
      headers: { Authorization: `Bearer ${tokenDevOps}` },
    });
    assert.strictEqual(resAck.status, 200);
    assert.strictEqual(resAck.body.pagination.total, 1);
    assert.strictEqual(resAck.body.data[0].id, event3Id);

    // RESOLVED
    const resResolved = await requestJson('/api/v1/alerts/history?status=RESOLVED', {
      headers: { Authorization: `Bearer ${tokenDevOps}` },
    });
    assert.strictEqual(resResolved.status, 200);
    assert.strictEqual(resResolved.body.pagination.total, 2);
    assert.ok(resResolved.body.data.every((item: any) => item.status === 'RESOLVED'));
  });

  it('4. [API-04] GET /api/v1/alerts/history searches by title, message, resource, and namespace', async () => {
    // Search by title
    const resTitle = await requestJson('/api/v1/alerts/history?search=Payment', {
      headers: { Authorization: `Bearer ${tokenDevOps}` },
    });
    assert.strictEqual(resTitle.status, 200);
    assert.strictEqual(resTitle.body.pagination.total, 1);
    assert.strictEqual(resTitle.body.data[0].id, event3Id);

    // Search by resource_id
    const resRes = await requestJson('/api/v1/alerts/history?search=worker-node-02', {
      headers: { Authorization: `Bearer ${tokenDevOps}` },
    });
    assert.strictEqual(resRes.status, 200);
    assert.strictEqual(resRes.body.pagination.total, 1);
    assert.strictEqual(resRes.body.data[0].id, event2Id);

    // Search by namespace
    const resNs = await requestJson('/api/v1/alerts/history?search=production', {
      headers: { Authorization: `Bearer ${tokenDevOps}` },
    });
    assert.strictEqual(resNs.status, 200);
    assert.strictEqual(resNs.body.pagination.total, 1);
    assert.strictEqual(resNs.body.data[0].id, event4Id);
  });

  it('5. [API-05] GET /api/v1/alerts/history filters by time range (startDate & endDate)', async () => {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const now = new Date(Date.now() + 60 * 1000).toISOString();

    const resRecent = await requestJson(`/api/v1/alerts/history?startDate=${oneHourAgo}&endDate=${now}`, {
      headers: { Authorization: `Bearer ${tokenDevOps}` },
    });

    assert.strictEqual(resRecent.status, 200);
    assert.ok(resRecent.body.pagination.total >= 1);
  });

  it('6. [API-06] Combines multiple filters (severity=CRITICAL + status=RESOLVED + resourceType=node)', async () => {
    const res = await requestJson('/api/v1/alerts/history?severity=CRITICAL&status=RESOLVED&resourceType=node', {
      headers: { Authorization: `Bearer ${tokenDevOps}` },
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.pagination.total, 1);
    assert.strictEqual(res.body.data[0].id, event1Id);
    assert.strictEqual(res.body.data[0].severity, 'CRITICAL');
    assert.strictEqual(res.body.data[0].status, 'RESOLVED');
    assert.strictEqual(res.body.data[0].resource_type, 'node');
  });

  it('7. [API-07] Pagination limit and sorting order (asc vs desc)', async () => {
    const resPage1 = await requestJson('/api/v1/alerts/history?page=1&limit=2&sortBy=first_detected_at&sortOrder=asc', {
      headers: { Authorization: `Bearer ${tokenDevOps}` },
    });

    assert.strictEqual(resPage1.status, 200);
    assert.strictEqual(resPage1.body.data.length, 2);
    assert.strictEqual(resPage1.body.pagination.page, 1);
    assert.strictEqual(resPage1.body.pagination.limit, 2);
    assert.strictEqual(resPage1.body.pagination.totalPages, 2);

    // Oldest detected event was event4 (10 hours ago)
    assert.strictEqual(resPage1.body.data[0].id, event4Id);
  });

  it('8. [API-08] GET /api/v1/alerts/history/summary returns aggregated counts for history dashboard', async () => {
    const res = await requestJson('/api/v1/alerts/history/summary', {
      headers: { Authorization: `Bearer ${tokenDevOps}` },
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.total_alerts, 4);
    assert.strictEqual(res.body.data.critical_alerts, 2);
    assert.strictEqual(res.body.data.warning_alerts, 1);
    assert.strictEqual(res.body.data.info_alerts, 1);
    assert.strictEqual(res.body.data.resolved_alerts, 2);
    assert.strictEqual(res.body.data.active_alerts, 1);
    assert.strictEqual(res.body.data.acknowledged_alerts, 1);
  });

  it('9. [API-09] GET /api/v1/alerts/history/:id/timeline returns chronological lifecycle timeline', async () => {
    const res = await requestJson(`/api/v1/alerts/history/${event1Id}/timeline`, {
      headers: { Authorization: `Bearer ${tokenDevOps}` },
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.alert_id, event1Id);
    assert.strictEqual(res.body.timeline.length, 3);

    // Chronological order: TRIGGERED -> ESCALATED -> RESOLVED
    assert.strictEqual(res.body.timeline[0].action, 'TRIGGERED');
    assert.strictEqual(res.body.timeline[0].new_status, 'ACTIVE');

    assert.strictEqual(res.body.timeline[1].action, 'ESCALATED');

    assert.strictEqual(res.body.timeline[2].action, 'RESOLVED');
    assert.strictEqual(res.body.timeline[2].new_status, 'RESOLVED');
  });

  it('10. [VAL-01] Validation rejects invalid severity, status, or date formats with 400 Bad Request', async () => {
    // Invalid severity
    const resSev = await requestJson('/api/v1/alerts/history?severity=INVALID_SEVERITY', {
      headers: { Authorization: `Bearer ${tokenDevOps}` },
    });
    assert.strictEqual(resSev.status, 400);
    assert.strictEqual(resSev.body.success, false);

    // Invalid status
    const resSt = await requestJson('/api/v1/alerts/history?status=UNKNOWN_STATUS', {
      headers: { Authorization: `Bearer ${tokenDevOps}` },
    });
    assert.strictEqual(resSt.status, 400);
    assert.strictEqual(resSt.body.success, false);

    // Invalid date
    const resDate = await requestJson('/api/v1/alerts/history?startDate=not-a-date', {
      headers: { Authorization: `Bearer ${tokenDevOps}` },
    });
    assert.strictEqual(resDate.status, 400);
    assert.strictEqual(resDate.body.success, false);
  });

  it('11. [VAL-02] Validation rejects startDate > endDate with 400 Bad Request', async () => {
    const futureDate = '2026-12-31T00:00:00Z';
    const pastDate = '2026-01-01T00:00:00Z';

    const res = await requestJson(`/api/v1/alerts/history?startDate=${futureDate}&endDate=${pastDate}`, {
      headers: { Authorization: `Bearer ${tokenDevOps}` },
    });

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.success, false);
    assert.ok(res.body.message.includes('startDate không được lớn hơn endDate'));
  });

  it('12. [SEC-01] Multi-tenant isolation: Org B receives 0 alerts and cannot access Org A details or timeline', async () => {
    // Org B history list is empty
    const resListB = await requestJson('/api/v1/alerts/history', {
      headers: { Authorization: `Bearer ${tokenOrgB}` },
    });
    assert.strictEqual(resListB.status, 200);
    assert.strictEqual(resListB.body.pagination.total, 0);

    // Org B cannot access Org A's event by ID (404 Not Found)
    const resDetailB = await requestJson(`/api/v1/alerts/history/${event1Id}`, {
      headers: { Authorization: `Bearer ${tokenOrgB}` },
    });
    assert.strictEqual(resDetailB.status, 404);

    // Org B cannot access Org A's timeline (404 Not Found)
    const resTimelineB = await requestJson(`/api/v1/alerts/history/${event1Id}/timeline`, {
      headers: { Authorization: `Bearer ${tokenOrgB}` },
    });
    assert.strictEqual(resTimelineB.status, 404);
  });

  it('13. [SEC-02] RBAC: VIEWER role has read-only access to History, Details, and Timeline', async () => {
    // Viewer can view history
    const resHist = await requestJson('/api/v1/alerts/history', {
      headers: { Authorization: `Bearer ${tokenViewer}` },
    });
    assert.strictEqual(resHist.status, 200);
    assert.strictEqual(resHist.body.pagination.total, 4);

    // Viewer can view timeline
    const resTimeline = await requestJson(`/api/v1/alerts/history/${event1Id}/timeline`, {
      headers: { Authorization: `Bearer ${tokenViewer}` },
    });
    assert.strictEqual(resTimeline.status, 200);
    assert.strictEqual(resTimeline.body.timeline.length, 3);
  });
});
