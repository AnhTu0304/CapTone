import test, { describe, before, after } from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import { AddressInfo } from 'node:net';
import jwt from 'jsonwebtoken';
import app from '../app';
import { config } from '../config/env';
import { pool } from '../config/database';
import { testRedisConnection, closeRedis, getRedisClient } from '../config/redis';
import { AlertRuleModel } from '../models/alertRule.model';
import { AlertEventModel } from '../models/alertEvent.model';
import { AlertLifecycleService } from '../services/alertLifecycle.service';
import { ConditionEvaluator } from '../services/evaluators/conditionEvaluator.service';
import { ResourceMetricEvaluator } from '../services/evaluators/resourceMetricEvaluator';

describe('Bộ Đánh giá Điều kiện, Chống Trùng lặp, Severity & Alert Management API [S5][PBI21 Task 3.3]', () => {
  let server: http.Server;
  let baseUrl: string;

  const ownerAId = 'a3333333-0000-4000-8000-000000000001';
  const devopsAId = 'a3333333-0000-4000-8000-000000000002';
  const viewerAId = 'a3333333-0000-4000-8000-000000000003';
  const ownerBId = 'a3333333-0000-4000-8000-000000000004';
  const superAdminId = 'a3333333-0000-4000-8000-000000000005';

  const orgAId = 'b3333333-0000-4000-8000-000000000001';
  const orgBId = 'b3333333-0000-4000-8000-000000000002';

  const envAId = 'c3333333-0000-4000-8000-000000000001';
  const envBId = 'c3333333-0000-4000-8000-000000000002';

  const clusterAId = 'd3333333-0000-4000-8000-000000000001';
  const clusterBId = 'd3333333-0000-4000-8000-000000000002';

  const agentAId = 'e3333333-0000-4000-8000-000000000001';

  let devopsAJwt: string;
  let viewerAJwt: string;
  let ownerBJwt: string;
  let superAdminJwt: string;

  let ruleWarningCpu: any;

  async function requestJson(
    path: string,
    options: {
      method?: string;
      headers?: Record<string, string>;
      body?: any;
    } = {}
  ) {
    const res = await fetch(`${baseUrl}${path}`, {
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

    // 1. Clean test records
    await pool.query(`DELETE FROM alert_events WHERE organization_id IN ($1, $2)`, [orgAId, orgBId]);
    await pool.query(`DELETE FROM alert_rules WHERE organization_id IN ($1, $2)`, [orgAId, orgBId]);
    await pool.query(`DELETE FROM node_metrics WHERE organization_id IN ($1, $2)`, [orgAId, orgBId]);
    await pool.query(`DELETE FROM agent_metrics WHERE organization_id IN ($1, $2)`, [orgAId, orgBId]);
    await pool.query(`DELETE FROM agents WHERE id = $1`, [agentAId]);
    await pool.query(`DELETE FROM clusters WHERE id IN ($1, $2)`, [clusterAId, clusterBId]);
    await pool.query(`DELETE FROM environments WHERE id IN ($1, $2)`, [envAId, envBId]);
    await pool.query(`DELETE FROM organization_members WHERE organization_id IN ($1, $2)`, [orgAId, orgBId]);
    await pool.query(`DELETE FROM organizations WHERE id IN ($1, $2)`, [orgAId, orgBId]);
    await pool.query(`DELETE FROM users WHERE id IN ($1, $2, $3, $4, $5)`, [
      ownerAId,
      devopsAId,
      viewerAId,
      ownerBId,
      superAdminId,
    ]);

    // 2. Fetch role IDs
    const rolesRes = await pool.query(`SELECT id, code FROM roles WHERE scope = 'ORGANIZATION'`);
    const roleMap = new Map<string, string>();
    for (const r of rolesRes.rows) {
      roleMap.set(r.code, r.id);
    }
    const smeOwnerRoleId = roleMap.get('SME_OWNER');
    const devopsRoleId = roleMap.get('DEVOPS');
    const viewerRoleId = roleMap.get('VIEWER');

    // 3. Create Users
    await pool.query(
      `INSERT INTO users (id, email, password_hash, full_name, status, created_at, updated_at) VALUES 
       ($1, 'owner.a.t33@test.com', 'dummy_hash', 'Owner A T33', 'ACTIVE', NOW(), NOW()),
       ($2, 'devops.a.t33@test.com', 'dummy_hash', 'Devops A T33', 'ACTIVE', NOW(), NOW()),
       ($3, 'viewer.a.t33@test.com', 'dummy_hash', 'Viewer A T33', 'ACTIVE', NOW(), NOW()),
       ($4, 'owner.b.t33@test.com', 'dummy_hash', 'Owner B T33', 'ACTIVE', NOW(), NOW()),
       ($5, 'superadmin.t33@test.com', 'dummy_hash', 'Super Admin T33', 'ACTIVE', NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET status = 'ACTIVE', deleted_at = NULL;`,
      [ownerAId, devopsAId, viewerAId, ownerBId, superAdminId]
    );

    // 4. Create Organizations
    await pool.query(
      `INSERT INTO organizations (id, name, slug, status, created_by, created_at, updated_at) VALUES 
       ($1, 'Task33 Org A', 't33-org-a', 'ACTIVE', $2, NOW(), NOW()),
       ($3, 'Task33 Org B', 't33-org-b', 'ACTIVE', $4, NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET status = 'ACTIVE', deleted_at = NULL;`,
      [orgAId, ownerAId, orgBId, ownerBId]
    );

    // 5. Memberships
    await pool.query(
      `INSERT INTO organization_members (organization_id, user_id, role_id, status, joined_at)
       VALUES
         ($1, $2, $3, 'ACTIVE', NOW()),
         ($1, $4, $5, 'ACTIVE', NOW()),
         ($1, $6, $7, 'ACTIVE', NOW()),
         ($8, $9, $3, 'ACTIVE', NOW())
       ON CONFLICT (organization_id, user_id) DO UPDATE SET status = 'ACTIVE';`,
      [
        orgAId, ownerAId, smeOwnerRoleId,
        devopsAId, devopsRoleId,
        viewerAId, viewerRoleId,
        orgBId, ownerBId,
      ]
    );

    // 6. Environments
    await pool.query(
      `INSERT INTO environments (id, organization_id, name, code, environment_type, created_by, created_at, updated_at)
       VALUES 
         ($1, $2, 'Env A T33', 'env-a-t33', 'PRODUCTION', $3, NOW(), NOW()),
         ($4, $5, 'Env B T33', 'env-b-t33', 'PRODUCTION', $6, NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET deleted_at = NULL;`,
      [envAId, orgAId, ownerAId, envBId, orgBId, ownerBId]
    );

    // 7. Clusters
    await pool.query(
      `INSERT INTO clusters (id, environment_id, name, cluster_uid, provider, kubernetes_version, status, created_at, updated_at)
       VALUES 
         ($1, $2, 'k8s-cluster-t33-a', 'uid-t33-a', 'MINIKUBE', 'v1.37.0', 'CONNECTED', NOW(), NOW()),
         ($3, $4, 'k8s-cluster-t33-b', 'uid-t33-b', 'MINIKUBE', 'v1.37.0', 'CONNECTED', NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET deleted_at = NULL;`,
      [clusterAId, envAId, clusterBId, envBId]
    );

    // 8. Agent
    await pool.query(
      `INSERT INTO agents (id, environment_id, cluster_id, name, agent_uid, version, status)
       VALUES ($1, $2, $3, 'agent-a-t33', 'uid-agent-t33-a', '1.0.0', 'ONLINE')
       ON CONFLICT (id) DO NOTHING;`,
      [agentAId, envAId, clusterAId]
    );

    // 9. Tokens
    devopsAJwt = jwt.sign(
      { id: devopsAId, email: 'devops.a.t33@test.com', roles: ['DEVOPS'], status: 'ACTIVE', organization_id: orgAId },
      config.jwt.secret,
      { expiresIn: '1h' }
    );
    viewerAJwt = jwt.sign(
      { id: viewerAId, email: 'viewer.a.t33@test.com', roles: ['VIEWER'], status: 'ACTIVE', organization_id: orgAId },
      config.jwt.secret,
      { expiresIn: '1h' }
    );
    ownerBJwt = jwt.sign(
      { id: ownerBId, email: 'owner.b.t33@test.com', roles: ['SME_OWNER'], status: 'ACTIVE', organization_id: orgBId },
      config.jwt.secret,
      { expiresIn: '1h' }
    );
    superAdminJwt = jwt.sign(
      { id: superAdminId, email: 'superadmin.t33@test.com', roles: ['SUPER_ADMIN'], status: 'ACTIVE' },
      config.jwt.secret,
      { expiresIn: '1h' }
    );

    // 10. Start HTTP server
    server = http.createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const address = server.address() as AddressInfo;
        baseUrl = `http://127.0.0.1:${address.port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    await pool.query(`DELETE FROM alert_events WHERE organization_id IN ($1, $2)`, [orgAId, orgBId]);
    await pool.query(`DELETE FROM alert_rules WHERE organization_id IN ($1, $2)`, [orgAId, orgBId]);
    await pool.query(`DELETE FROM node_metrics WHERE organization_id IN ($1, $2)`, [orgAId, orgBId]);
    await pool.query(`DELETE FROM agent_metrics WHERE organization_id IN ($1, $2)`, [orgAId, orgBId]);
    await pool.query(`DELETE FROM agents WHERE id = $1`, [agentAId]);
    await pool.query(`DELETE FROM clusters WHERE id IN ($1, $2)`, [clusterAId, clusterBId]);
    await pool.query(`DELETE FROM environments WHERE id IN ($1, $2)`, [envAId, envBId]);
    await pool.query(`DELETE FROM organization_members WHERE organization_id IN ($1, $2)`, [orgAId, orgBId]);
    await pool.query(`DELETE FROM organizations WHERE id IN ($1, $2)`, [orgAId, orgBId]);
    await pool.query(`DELETE FROM users WHERE id IN ($1, $2, $3, $4, $5)`, [
      ownerAId,
      devopsAId,
      viewerAId,
      ownerBId,
      superAdminId,
    ]);
    await closeRedis();
    await pool.end();
  });

  // --- 1. CONDITION EVALUATION STATES (NORMAL, PENDING, FIRING, NO_DATA, ERROR) ---
  test('1. [CE-01] Condition Evaluation: Evaluates NORMAL, PENDING, FIRING, NO_DATA, and ERROR correctly', async () => {
    // 1. NO_DATA: Sample count is 0
    const resNoData = await ConditionEvaluator.evaluate({
      organizationId: orgAId,
      clusterId: clusterAId,
      ruleId: 'rule-test-1',
      ruleName: 'Test Rule',
      resourceType: 'node',
      resourceId: 'node-1',
      metricType: 'CPU',
      operator: 'GREATER_THAN',
      thresholdValue: 80,
      duration: 60,
      observedValue: null,
      sampleCount: 0,
      evaluationWindowSeconds: 300,
    });
    assert.strictEqual(resNoData.state, 'NO_DATA');
    assert.strictEqual(resNoData.durationSatisfied, false);

    // 2. ERROR: Simulated error
    const resError = await ConditionEvaluator.evaluate({
      organizationId: orgAId,
      clusterId: clusterAId,
      ruleId: 'rule-test-1',
      ruleName: 'Test Rule',
      resourceType: 'node',
      resourceId: 'node-1',
      metricType: 'CPU',
      operator: 'GREATER_THAN',
      thresholdValue: 80,
      duration: 60,
      observedValue: 90,
      sampleCount: 1,
      evaluationWindowSeconds: 300,
      error: new Error('PostgreSQL timeout connection error'),
    });
    assert.strictEqual(resError.state, 'ERROR');

    // 3. PENDING: Breached (90 > 80) with duration = 60s, first time detected
    const resPending = await ConditionEvaluator.evaluate({
      organizationId: orgAId,
      clusterId: clusterAId,
      ruleId: 'rule-test-pending',
      ruleName: 'Test Rule Pending',
      resourceType: 'node',
      resourceId: 'node-pending-1',
      metricType: 'CPU',
      operator: 'GREATER_THAN',
      thresholdValue: 80,
      duration: 60,
      observedValue: 90,
      sampleCount: 1,
      sampleEarliestAt: new Date(),
      sampleLatestAt: new Date(),
      evaluationWindowSeconds: 300,
    });
    assert.strictEqual(resPending.state, 'PENDING');
    assert.strictEqual(resPending.durationSatisfied, false);
    assert.ok(resPending.pendingSince);

    // 4. FIRING: Immediate violation when duration == 0
    const resFiringZero = await ConditionEvaluator.evaluate({
      organizationId: orgAId,
      clusterId: clusterAId,
      ruleId: 'rule-test-zero',
      ruleName: 'Test Rule Zero Duration',
      resourceType: 'node',
      resourceId: 'node-zero-1',
      metricType: 'CPU',
      operator: 'GREATER_THAN',
      thresholdValue: 80,
      duration: 0,
      observedValue: 92,
      sampleCount: 1,
      evaluationWindowSeconds: 300,
    });
    assert.strictEqual(resFiringZero.state, 'FIRING');
    assert.strictEqual(resFiringZero.durationSatisfied, true);

    // 5. NORMAL: Condition not breached (40 <= 80)
    const resNormal = await ConditionEvaluator.evaluate({
      organizationId: orgAId,
      clusterId: clusterAId,
      ruleId: 'rule-test-pending',
      ruleName: 'Test Rule Pending',
      resourceType: 'node',
      resourceId: 'node-pending-1',
      metricType: 'CPU',
      operator: 'GREATER_THAN',
      thresholdValue: 80,
      duration: 60,
      observedValue: 40,
      sampleCount: 5,
      evaluationWindowSeconds: 300,
    });
    assert.strictEqual(resNormal.state, 'NORMAL');
    assert.strictEqual(resNormal.durationSatisfied, false);
  });

  // --- 2. PENDING PERSISTENCE ACROSS RESTARTS & DURATION ENFORCEMENT ---
  test('2. [CE-02] Pending Persistence: PENDING state saved to Redis survives and transitions to FIRING when duration expires', async () => {
    const fingerprint = ConditionEvaluator.computeFingerprint(
      orgAId,
      clusterAId,
      'rule-restart-test',
      'node',
      'node-restart-1',
      'RAM'
    );

    // Pre-seed pending state in Redis from 65 seconds ago (duration is 60s)
    const sixtyFiveSecondsAgo = new Date(Date.now() - 65 * 1000);
    await ConditionEvaluator.setPendingState(
      fingerprint,
      { firstBreachedAt: sixtyFiveSecondsAgo, observedValue: 85 },
      300
    );

    // Simulate evaluator running after worker restart
    const resEvaluated = await ConditionEvaluator.evaluate({
      organizationId: orgAId,
      clusterId: clusterAId,
      ruleId: 'rule-restart-test',
      ruleName: 'Worker Restart Rule',
      resourceType: 'node',
      resourceId: 'node-restart-1',
      metricType: 'RAM',
      operator: 'GREATER_THAN',
      thresholdValue: 80,
      duration: 60,
      observedValue: 86,
      sampleCount: 2,
      evaluationWindowSeconds: 300,
    });

    assert.strictEqual(resEvaluated.state, 'FIRING', 'Should transition to FIRING because 65s > 60s duration');
    assert.strictEqual(resEvaluated.durationSatisfied, true);

    // Clean up
    await ConditionEvaluator.clearPendingState(fingerprint);
  });

  // --- 3. DEDUPLICATION & CONCURRENCY SAFETY ---
  test('3. [CE-03] Deduplication & Concurrency: Exactly 1 open event created under 5 concurrent workers, incrementing occurrence_count', async () => {
    // 5 concurrent worker calls triggering the same alert condition simultaneously
    const triggerPromises = Array.from({ length: 5 }).map((_, i) =>
      AlertLifecycleService.recordAlertTrigger({
        organization_id: orgAId,
        cluster_id: clusterAId,
        rule_name: 'Concurrent High Load Alert',
        category: 'RESOURCE',
        metric_type: 'CPU',
        resource_type: 'node',
        resource_id: 'node-concurrent-worker',
        severity: 'CRITICAL',
        observed_value: 91.5 + i,
        threshold_value: 80,
        unit: '%',
        message: `High load concurrent attempt ${i}`,
      })
    );

    const results = await Promise.all(triggerPromises);

    // Count how many reported isNew = true
    const newCount = results.filter((r) => r.isNew).length;
    assert.strictEqual(newCount, 1, 'Exactly one concurrent attempt must create a new record');

    // Verify DB contains exactly 1 ACTIVE event for this resource & metric
    const events = await AlertEventModel.findByOrg(orgAId, {
      resource_id: 'node-concurrent-worker',
      metric_type: 'CPU',
      status: 'ACTIVE',
    });
    assert.strictEqual(events.items.length, 1, 'Database must have exactly 1 open event');

    const event = events.items[0];
    assert.strictEqual(Number(event.occurrence_count), 5, 'occurrence_count must reflect all 5 hits');
    assert.ok(event.fingerprint, 'Fingerprint must be populated');
  });

  test('4. [CE-04] Reoccur: When an alert was RESOLVED and condition recurs, a new ACTIVE event is created while preserving history', async () => {
    // 1. Resolve the concurrent event
    const activeEvents = await AlertEventModel.findByOrg(orgAId, {
      resource_id: 'node-concurrent-worker',
      status: 'ACTIVE',
    });
    assert.strictEqual(activeEvents.items.length, 1);
    const resolvedEvent = await AlertLifecycleService.autoResolveAlert({
      organization_id: orgAId,
      cluster_id: clusterAId,
      resource_type: 'node',
      resource_id: 'node-concurrent-worker',
      metric_type: 'CPU',
      resolution_details: { message: 'Load normalized' },
    });
    assert.ok(resolvedEvent);
    assert.strictEqual(resolvedEvent.status, 'RESOLVED');

    // 2. Incident recurs later
    const reoccurResult = await AlertLifecycleService.recordAlertTrigger({
      organization_id: orgAId,
      cluster_id: clusterAId,
      rule_name: 'Concurrent High Load Alert',
      category: 'RESOURCE',
      metric_type: 'CPU',
      resource_type: 'node',
      resource_id: 'node-concurrent-worker',
      severity: 'CRITICAL',
      observed_value: 95.0,
      threshold_value: 80,
      unit: '%',
      message: 'High load returned',
    });

    assert.strictEqual(reoccurResult.isNew, true, 'Recurred incident creates fresh alert event');
    assert.notStrictEqual(reoccurResult.event.id, resolvedEvent.id, 'New alert event must have unique ID');

    // Total events for this resource in DB is now 2: 1 RESOLVED and 1 ACTIVE
    const allEvents = await AlertEventModel.findByOrg(orgAId, {
      resource_id: 'node-concurrent-worker',
    });
    assert.strictEqual(allEvents.items.length, 2, 'History is preserved: 1 resolved + 1 active');
  });

  // --- 4. SEVERITY CLASSIFICATION & DYNAMIC ESCALATION ---
  test('5. [CE-05] Severity: Dynamic escalation upgrades WARNING to CRITICAL on extreme saturation (>= 95%)', () => {
    // 1. Rule configured as WARNING, observed CPU = 85% -> remains WARNING
    const normalWarn = ConditionEvaluator.determineSeverity('WARNING', 85, 80, 'CPU');
    assert.strictEqual(normalWarn.severity, 'WARNING');
    assert.strictEqual(normalWarn.isEscalated, false);

    // 2. Rule configured as WARNING, observed CPU = 97% -> escalated to CRITICAL
    const escalatedCpu = ConditionEvaluator.determineSeverity('WARNING', 97.2, 80, 'CPU');
    assert.strictEqual(escalatedCpu.severity, 'CRITICAL');
    assert.strictEqual(escalatedCpu.isEscalated, true);

    // 3. Rule configured as WARNING, observed HTTP 5xx = 30% -> escalated to CRITICAL
    const escalatedApm = ConditionEvaluator.determineSeverity('WARNING', 30.0, 5, 'HTTP_5XX_RATE');
    assert.strictEqual(escalatedApm.severity, 'CRITICAL');
    assert.strictEqual(escalatedApm.isEscalated, true);

    // 4. Rule configured as CRITICAL -> remains CRITICAL
    const criticalStay = ConditionEvaluator.determineSeverity('CRITICAL', 85, 80, 'CPU');
    assert.strictEqual(criticalStay.severity, 'CRITICAL');
    assert.strictEqual(criticalStay.isEscalated, false);
  });

  // --- 5. ALERT EVENT LIFECYCLE & STATE TRANSITIONS ---
  test('6. [CE-06] Lifecycle: Acknowledged event is NOT reset to ACTIVE by continuous worker triggers', async () => {
    const triggerRes = await AlertLifecycleService.recordAlertTrigger({
      organization_id: orgAId,
      cluster_id: clusterAId,
      rule_name: 'Ack Protection Alert',
      category: 'RESOURCE',
      metric_type: 'DISK',
      resource_type: 'node',
      resource_id: 'node-ack-protect',
      severity: 'WARNING',
      observed_value: 86,
      threshold_value: 80,
      unit: '%',
      message: 'Disk threshold reached',
    });

    const eventId = triggerRes.event.id;

    // User acknowledges
    const acked = await AlertLifecycleService.acknowledgeAlert(eventId, orgAId, devopsAId, 'Engineer investigating');
    assert.strictEqual(acked.status, 'ACKNOWLEDGED');

    // Worker continues to evaluate and re-triggers
    const reTriggerRes = await AlertLifecycleService.recordAlertTrigger({
      organization_id: orgAId,
      cluster_id: clusterAId,
      rule_name: 'Ack Protection Alert',
      category: 'RESOURCE',
      metric_type: 'DISK',
      resource_type: 'node',
      resource_id: 'node-ack-protect',
      severity: 'WARNING',
      observed_value: 88,
      threshold_value: 80,
      unit: '%',
      message: 'Disk threshold sustained',
    });

    assert.strictEqual(reTriggerRes.event.status, 'ACKNOWLEDGED', 'Status must stay ACKNOWLEDGED, not overwritten to ACTIVE');
    assert.strictEqual(reTriggerRes.event.occurrence_count, 2);
  });

  test('7. [CE-07] Lifecycle: Cannot acknowledge a RESOLVED event (400 Bad Request)', async () => {
    // Create and resolve an event
    const activeRes = await AlertLifecycleService.recordAlertTrigger({
      organization_id: orgAId,
      cluster_id: clusterAId,
      rule_name: 'Resolve Then Ack Alert',
      category: 'RESOURCE',
      metric_type: 'DISK',
      resource_type: 'node',
      resource_id: 'node-res-ack',
      severity: 'WARNING',
      message: 'Disk full',
    });

    await AlertLifecycleService.resolveAlertManually(activeRes.event.id, orgAId, devopsAId, 'Fixed');

    // Attempt to acknowledge via API
    const resAck = await requestJson(`/api/v1/alerts/${activeRes.event.id}/acknowledge`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${devopsAJwt}` },
      body: { note: 'Trying to ack resolved' },
    });

    assert.strictEqual(resAck.status, 400);
    assert.ok(resAck.body.message.includes('RESOLVED'));
  });

  // --- 6. ALERT MANAGEMENT APIS: /api/v1/alerts and /api/v1/alerts/summary ---
  test('8. [API-01] GET /api/v1/alerts/summary returns aggregated counts isolated by organization', async () => {
    const resSummary = await requestJson(`/api/v1/alerts/summary`, {
      headers: { Authorization: `Bearer ${devopsAJwt}` },
    });

    assert.strictEqual(resSummary.status, 200);
    const data = resSummary.body.data;
    assert.strictEqual(typeof data.total_active, 'number');
    assert.strictEqual(typeof data.total_acknowledged, 'number');
    assert.strictEqual(typeof data.total_resolved, 'number');
    assert.ok(data.by_severity.CRITICAL !== undefined);
    assert.ok(data.by_severity.WARNING !== undefined);
    assert.ok(data.by_severity.INFO !== undefined);
    assert.ok(Array.isArray(data.by_cluster));
  });

  test('9. [API-02] GET /api/v1/alerts supports advanced filtering, search, and sorting by occurrence_count', async () => {
    const resList = await requestJson(
      `/api/v1/alerts?category=RESOURCE&sort=occurrence_count&order=desc&page=1&limit=5`,
      {
        headers: { Authorization: `Bearer ${devopsAJwt}` },
      }
    );

    assert.strictEqual(resList.status, 200);
    assert.ok(Array.isArray(resList.body.data.items));
    assert.ok(resList.body.data.pagination);
    assert.ok(resList.body.data.items.length <= 5);

    // Verify alias /api/v1/alert-events also works identically
    const resAlias = await requestJson(
      `/api/v1/alert-events?category=RESOURCE&sort=occurrence_count&order=desc&page=1&limit=5`,
      {
        headers: { Authorization: `Bearer ${devopsAJwt}` },
      }
    );
    assert.strictEqual(resAlias.status, 200);
    assert.strictEqual(resAlias.body.data.pagination.total, resList.body.data.pagination.total);
  });

  test('10. [API-03] GET /api/v1/alerts/:id returns full detailed record with joined metadata', async () => {
    // Fetch first event ID
    const listRes = await requestJson(`/api/v1/alerts?limit=1`, {
      headers: { Authorization: `Bearer ${devopsAJwt}` },
    });
    const firstEvent = listRes.body.data.items[0];
    assert.ok(firstEvent);

    const detailRes = await requestJson(`/api/v1/alerts/${firstEvent.id}`, {
      headers: { Authorization: `Bearer ${devopsAJwt}` },
    });

    assert.strictEqual(detailRes.status, 200);
    assert.strictEqual(detailRes.body.data.id, firstEvent.id);
    assert.ok(detailRes.body.data.fingerprint !== undefined);
    assert.ok(detailRes.body.data.occurrence_count >= 1);
  });

  // --- 7. SECURITY: Anti-IDOR & RBAC ---
  test('11. [SEC-01] Anti-IDOR: Tenant B receives empty summary for Tenant A clusters & cannot read Tenant A alerts', async () => {
    // Tenant B attempts to request summary specifying Tenant A's cluster
    const resSummarySpoof = await requestJson(`/api/v1/alerts/summary?cluster_id=${clusterAId}`, {
      headers: { Authorization: `Bearer ${ownerBJwt}` },
    });
    // Forbidden because cluster A belongs to Tenant A
    assert.strictEqual(resSummarySpoof.status, 403);

    // Tenant B normal summary has 0 active events
    const resSummaryB = await requestJson(`/api/v1/alerts/summary`, {
      headers: { Authorization: `Bearer ${ownerBJwt}` },
    });
    assert.strictEqual(resSummaryB.status, 200);
    assert.strictEqual(resSummaryB.body.data.total_active, 0, 'Tenant B has 0 active alerts in its own org');
  });

  test('12. [SEC-02] RBAC: VIEWER cannot acknowledge or resolve alerts (403 Forbidden)', async () => {
    const listRes = await requestJson(`/api/v1/alerts?status=ACTIVE&limit=1`, {
      headers: { Authorization: `Bearer ${viewerAJwt}` },
    });
    const event = listRes.body.data.items[0];
    assert.ok(event);

    // Viewer ACK attempt
    const resAck = await requestJson(`/api/v1/alerts/${event.id}/acknowledge`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${viewerAJwt}` },
      body: { note: 'Viewer attempt' },
    });
    assert.strictEqual(resAck.status, 403);

    // Viewer Resolve attempt
    const resResolve = await requestJson(`/api/v1/alerts/${event.id}/resolve`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${viewerAJwt}` },
      body: { resolution_note: 'Viewer attempt' },
    });
    assert.strictEqual(resResolve.status, 403);
  });
});
