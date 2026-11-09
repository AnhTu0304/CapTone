import test, { describe, before, after } from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import { AddressInfo } from 'node:net';
import jwt from 'jsonwebtoken';
import app from '../app';
import { config } from '../config/env';
import { pool } from '../config/database';
import { testRedisConnection, closeRedis } from '../config/redis';
import { AlertRuleModel } from '../models/alertRule.model';
import { AlertEventModel } from '../models/alertEvent.model';
import { AlertLifecycleService } from '../services/alertLifecycle.service';
import { ResourceMetricEvaluator } from '../services/evaluators/resourceMetricEvaluator';
import { KubernetesRuleEvaluator } from '../services/evaluators/kubernetesRuleEvaluator';
import { ApmRuleEvaluator } from '../services/evaluators/apmRuleEvaluator';
import { RuleEngineExecutionService } from '../services/ruleEngineExecution.service';
import {
  evaluateOperator,
  parseWindowToSeconds,
  convertBytesToUnit,
  convertRateToUnit,
} from '../services/evaluators/ruleEvaluationHelper';

describe('Rule Engine Đánh giá Quy tắc, Phát hiện Ngưỡng K8s/APM & Vòng đời Alert Event [S5][PBI21 Task 3.2]', () => {
  let server: http.Server;
  let baseUrl: string;

  const ownerAId = 'a2222222-0000-4000-8000-000000000001';
  const devopsAId = 'a2222222-0000-4000-8000-000000000002';
  const viewerAId = 'a2222222-0000-4000-8000-000000000003';
  const ownerBId = 'a2222222-0000-4000-8000-000000000004';
  const superAdminId = 'a2222222-0000-4000-8000-000000000005';

  const orgAId = 'b2222222-0000-4000-8000-000000000001';
  const orgBId = 'b2222222-0000-4000-8000-000000000002';

  const envAId = 'c2222222-0000-4000-8000-000000000001';
  const envBId = 'c2222222-0000-4000-8000-000000000002';

  const clusterAId = 'd2222222-0000-4000-8000-000000000001';
  const clusterBId = 'd2222222-0000-4000-8000-000000000002';

  const agentAId = 'a3333333-0000-4000-8000-000000000001';
  const namespaceAId = 'e1111111-0000-4000-8000-000000000001';
  const workloadAId = 'e2222222-0000-4000-8000-000000000001';

  let ownerAJwt: string;
  let devopsAJwt: string;
  let viewerAJwt: string;
  let ownerBJwt: string;
  let superAdminJwt: string;

  let testRuleCpu: any;
  let testRuleK8sCrash: any;
  let testRuleApm5xx: any;

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

    // 1. Clean test data
    await pool.query(`DELETE FROM alert_events WHERE organization_id IN ($1, $2)`, [orgAId, orgBId]);
    await pool.query(`DELETE FROM alert_rules WHERE organization_id IN ($1, $2)`, [orgAId, orgBId]);
    await pool.query(`DELETE FROM node_metrics WHERE organization_id IN ($1, $2)`, [orgAId, orgBId]);
    await pool.query(`DELETE FROM agent_metrics WHERE organization_id IN ($1, $2)`, [orgAId, orgBId]);
    await pool.query(`DELETE FROM agents WHERE id = $1`, [agentAId]);
    await pool.query(`DELETE FROM kubernetes_events WHERE cluster_id IN ($1, $2)`, [clusterAId, clusterBId]);
    await pool.query(`DELETE FROM pods WHERE cluster_id IN ($1, $2)`, [clusterAId, clusterBId]);
    await pool.query(`DELETE FROM deployments WHERE workload_id IN (SELECT id FROM workloads WHERE cluster_id IN ($1, $2))`, [clusterAId, clusterBId]);
    await pool.query(`DELETE FROM workloads WHERE cluster_id IN ($1, $2)`, [clusterAId, clusterBId]);
    await pool.query(`DELETE FROM namespaces WHERE cluster_id IN ($1, $2)`, [clusterAId, clusterBId]);
    await pool.query(`DELETE FROM nodes WHERE cluster_id IN ($1, $2)`, [clusterAId, clusterBId]);
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
    const rolesRes = await pool.query(`SELECT id, code FROM organization_roles WHERE scope = 'ORGANIZATION'`);
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
       ($1, 'owner.a.re@test.com', 'dummy_hash', 'Owner A RE', 'ACTIVE', NOW(), NOW()),
       ($2, 'devops.a.re@test.com', 'dummy_hash', 'Devops A RE', 'ACTIVE', NOW(), NOW()),
       ($3, 'viewer.a.re@test.com', 'dummy_hash', 'Viewer A RE', 'ACTIVE', NOW(), NOW()),
       ($4, 'owner.b.re@test.com', 'dummy_hash', 'Owner B RE', 'ACTIVE', NOW(), NOW()),
       ($5, 'superadmin.re@test.com', 'dummy_hash', 'Super Admin RE', 'ACTIVE', NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET status = 'ACTIVE', deleted_at = NULL;`,
      [ownerAId, devopsAId, viewerAId, ownerBId, superAdminId]
    );

    // 4. Create Organizations
    await pool.query(
      `INSERT INTO organizations (id, name, slug, status, created_by, created_at, updated_at) VALUES 
       ($1, 'RuleEngine Org A', 're-org-a', 'ACTIVE', $2, NOW(), NOW()),
       ($3, 'RuleEngine Org B', 're-org-b', 'ACTIVE', $4, NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET status = 'ACTIVE', deleted_at = NULL;`,
      [orgAId, ownerAId, orgBId, ownerBId]
    );

    // 5. Organization Memberships
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
         ($1, $2, 'Production A', 'env-a-re', 'PRODUCTION', $3, NOW(), NOW()),
         ($4, $5, 'Production B', 'env-b-re', 'PRODUCTION', $6, NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET deleted_at = NULL;`,
      [envAId, orgAId, ownerAId, envBId, orgBId, ownerBId]
    );

    // 7. Clusters
    await pool.query(
      `INSERT INTO clusters (id, environment_id, name, cluster_uid, provider, kubernetes_version, status, created_at, updated_at)
       VALUES 
         ($1, $2, 'k8s-cluster-a', 'uid-re-a', 'MINIKUBE', 'v1.37.0', 'CONNECTED', NOW(), NOW()),
         ($3, $4, 'k8s-cluster-b', 'uid-re-b', 'MINIKUBE', 'v1.37.0', 'CONNECTED', NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET deleted_at = NULL;`,
      [clusterAId, envAId, clusterBId, envBId]
    );

    // Agent for Cluster A
    await pool.query(
      `INSERT INTO agents (id, environment_id, cluster_id, name, agent_uid, version, status)
       VALUES ($1, $2, $3, 'agent-a-re', 'uid-agent-re-a', '1.0.0', 'ONLINE')
       ON CONFLICT (id) DO NOTHING;`,
      [agentAId, envAId, clusterAId]
    );

    // 8. Workloads & Deployments for Cluster A
    await pool.query(
      `INSERT INTO namespaces (id, cluster_id, name, status) VALUES ($1, $2, 'default', 'Active')
       ON CONFLICT (id) DO NOTHING;`,
      [namespaceAId, clusterAId]
    );

    await pool.query(
      `INSERT INTO workloads (id, cluster_id, namespace_id, name, workload_type, status) VALUES
       ($1, $2, $3, 'payment-service', 'Deployment', 'Running')
       ON CONFLICT (id) DO NOTHING;`,
      [workloadAId, clusterAId, namespaceAId]
    );

    await pool.query(
      `INSERT INTO deployments (id, workload_id, desired_replicas, available_replicas, ready_replicas, status) VALUES
       (gen_random_uuid(), $1, 3, 3, 3, 'Available');`,
      [workloadAId]
    );

    // 9. Generate JWT Tokens using config.jwt.secret and claims matching auth middleware
    ownerAJwt = jwt.sign(
      { id: ownerAId, email: 'owner.a.re@test.com', roles: ['SME_OWNER'], status: 'ACTIVE', organization_id: orgAId },
      config.jwt.secret,
      { expiresIn: '1h' }
    );
    devopsAJwt = jwt.sign(
      { id: devopsAId, email: 'devops.a.re@test.com', roles: ['DEVOPS'], status: 'ACTIVE', organization_id: orgAId },
      config.jwt.secret,
      { expiresIn: '1h' }
    );
    viewerAJwt = jwt.sign(
      { id: viewerAId, email: 'viewer.a.re@test.com', roles: ['VIEWER'], status: 'ACTIVE', organization_id: orgAId },
      config.jwt.secret,
      { expiresIn: '1h' }
    );
    ownerBJwt = jwt.sign(
      { id: ownerBId, email: 'owner.b.re@test.com', roles: ['SME_OWNER'], status: 'ACTIVE', organization_id: orgBId },
      config.jwt.secret,
      { expiresIn: '1h' }
    );
    superAdminJwt = jwt.sign(
      { id: superAdminId, email: 'superadmin.re@test.com', roles: ['SUPER_ADMIN'], status: 'ACTIVE' },
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
    await pool.query(`DELETE FROM kubernetes_events WHERE cluster_id IN ($1, $2)`, [clusterAId, clusterBId]);
    await pool.query(`DELETE FROM pods WHERE cluster_id IN ($1, $2)`, [clusterAId, clusterBId]);
    await pool.query(`DELETE FROM deployments WHERE workload_id IN (SELECT id FROM workloads WHERE cluster_id IN ($1, $2))`, [clusterAId, clusterBId]);
    await pool.query(`DELETE FROM workloads WHERE cluster_id IN ($1, $2)`, [clusterAId, clusterBId]);
    await pool.query(`DELETE FROM namespaces WHERE cluster_id IN ($1, $2)`, [clusterAId, clusterBId]);
    await pool.query(`DELETE FROM nodes WHERE cluster_id IN ($1, $2)`, [clusterAId, clusterBId]);
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

  // --- UNIT TESTS: Helper Functions ---
  test('1. [RE-01] Helper: Operator comparisons and window parser behave correctly', () => {
    assert.strictEqual(evaluateOperator(90, 'GREATER_THAN', 80), true);
    assert.strictEqual(evaluateOperator(80, 'GREATER_THAN', 80), false);
    assert.strictEqual(evaluateOperator(80, 'GREATER_THAN_OR_EQUAL', 80), true);
    assert.strictEqual(evaluateOperator(50, 'LESS_THAN', 60), true);
    assert.strictEqual(evaluateOperator(70, 'LESS_THAN', 60), false);
    assert.strictEqual(evaluateOperator(60, 'LESS_THAN_OR_EQUAL', 60), true);
    assert.strictEqual(evaluateOperator(100, 'EQUAL', 100), true);
    assert.strictEqual(evaluateOperator(100.00005, 'EQUAL', 100), true);
    assert.strictEqual(evaluateOperator(100.1, 'NOT_EQUAL', 100), true);

    assert.strictEqual(parseWindowToSeconds('30s'), 30);
    assert.strictEqual(parseWindowToSeconds('5m'), 300);
    assert.strictEqual(parseWindowToSeconds('1h'), 3600);
    assert.strictEqual(parseWindowToSeconds('invalid'), 300);

    assert.strictEqual(convertBytesToUnit(1024 * 1024 * 1024, 'GB'), 1);
    assert.strictEqual(convertBytesToUnit(1024 * 1024, 'MB'), 1);
    assert.strictEqual(convertRateToUnit(1024 * 1024, 'MB/s'), 1);
  });

  // --- INTEGRATION: Resource Metric Evaluator ---
  test('2. [RE-02] Resource Metric Evaluator: High CPU breaches threshold and triggers alert event', async () => {
    // Create CPU Alert Rule
    testRuleCpu = await AlertRuleModel.create({
      organization_id: orgAId,
      cluster_id: clusterAId,
      name: 'High CPU Alert Rule',
      metric_type: 'CPU',
      operator: 'GREATER_THAN',
      threshold_value: 80,
      unit: '%',
      severity: 'CRITICAL',
      evaluation_window: '5m',
      duration: 0,
      cooldown_seconds: 300,
    });

    // Seed node_metrics with CPU = 92%
    await pool.query(
      `INSERT INTO node_metrics (
        agent_id, organization_id, cluster_id, node_name, cpu_usage_percent, ram_usage_percent,
        disk_usage_percent, collected_at
      ) VALUES ($1, $2, $3, 'node-worker-1', 92.5, 50.0, 40.0, NOW())`,
      [agentAId, orgAId, clusterAId]
    );

    const evalResult = await ResourceMetricEvaluator.evaluateRule(testRuleCpu);
    assert.strictEqual(evalResult.triggered, 1, 'Rule should trigger 1 alert');

    // Verify open alert event was created in DB
    const events = await AlertEventModel.findByOrg(orgAId, { rule_id: testRuleCpu.id });
    assert.strictEqual(events.items.length, 1);
    const event = events.items[0];
    assert.strictEqual(event.category, 'RESOURCE');
    assert.strictEqual(event.metric_type, 'CPU');
    assert.strictEqual(event.resource_id, 'node-worker-1');
    assert.strictEqual(event.status, 'ACTIVE');
    assert.strictEqual(Number(event.observed_value), 92.5);
  });

  test('3. [RE-03] Deduplication: Re-evaluating sustained high CPU updates existing alert instead of creating duplicate', async () => {
    // Seed second high CPU metric sample
    await pool.query(
      `INSERT INTO node_metrics (
        agent_id, organization_id, cluster_id, node_name, cpu_usage_percent, ram_usage_percent,
        disk_usage_percent, collected_at
      ) VALUES ($1, $2, $3, 'node-worker-1', 95.0, 52.0, 40.0, NOW())`,
      [agentAId, orgAId, clusterAId]
    );

    const evalResult = await ResourceMetricEvaluator.evaluateRule(testRuleCpu);
    assert.strictEqual(evalResult.triggered, 1);

    // Still exactly 1 open alert event (deduplication verified)
    const events = await AlertEventModel.findByOrg(orgAId, { rule_id: testRuleCpu.id, status: 'ACTIVE' });
    assert.strictEqual(events.items.length, 1, 'Should not create duplicate open alert');
    assert.strictEqual(Number(events.items[0].observed_value), 93.75, 'Observed value should reflect updated window average');
  });

  test('4. [RE-04] Auto-Recovery: When CPU returns to normal (40%), rule engine auto-resolves open alert event', async () => {
    // Clean old metrics and insert healthy sample (40% CPU)
    await pool.query(`DELETE FROM node_metrics WHERE organization_id = $1`, [orgAId]);
    await pool.query(
      `INSERT INTO node_metrics (
        agent_id, organization_id, cluster_id, node_name, cpu_usage_percent, ram_usage_percent,
        disk_usage_percent, collected_at
      ) VALUES ($1, $2, $3, 'node-worker-1', 40.0, 45.0, 35.0, NOW())`,
      [agentAId, orgAId, clusterAId]
    );

    const evalResult = await ResourceMetricEvaluator.evaluateRule(testRuleCpu);
    assert.strictEqual(evalResult.resolved, 1, 'Should auto-resolve the open alert');

    // Verify status is now RESOLVED and resolved_at is populated
    const events = await AlertEventModel.findByOrg(orgAId, { rule_id: testRuleCpu.id });
    assert.strictEqual(events.items.length, 1);
    assert.strictEqual(events.items[0].status, 'RESOLVED');
    assert.ok(events.items[0].resolved_at, 'resolved_at must be populated');
  });

  // --- INTEGRATION: Kubernetes Workload & State Evaluator ---
  test('5. [RE-05] Kubernetes Rule Evaluator: Detects Pod CrashLoopBackOff and auto-resolves on pod recovery', async () => {
    testRuleK8sCrash = await AlertRuleModel.create({
      organization_id: orgAId,
      cluster_id: clusterAId,
      name: 'Pod CrashLoop Rule',
      metric_type: 'POD_CRASH_LOOP',
      operator: 'GREATER_THAN',
      threshold_value: 3,
      unit: 'restarts',
      severity: 'CRITICAL',
      evaluation_window: '5m',
      duration: 0,
      cooldown_seconds: 300,
    });

    const podId = 'f2222222-0000-4000-8000-000000000001';
    // 1. Insert pod in CrashLoopBackOff with 8 restarts
    await pool.query(
      `INSERT INTO pods (id, cluster_id, namespace_id, name, status, phase, restart_count, started_at)
       VALUES ($1, $2, $3, 'auth-service-78dfb-x79pq', 'CrashLoopBackOff', 'Running', 8, NOW())`,
      [podId, clusterAId, namespaceAId]
    );

    const evalCrash = await KubernetesRuleEvaluator.evaluateRule(testRuleK8sCrash);
    assert.strictEqual(evalCrash.triggered, 1, 'Should trigger CrashLoop alert');

    let events = await AlertEventModel.findByOrg(orgAId, { rule_id: testRuleK8sCrash.id, status: 'ACTIVE' });
    assert.strictEqual(events.items.length, 1);
    assert.strictEqual(events.items[0].category, 'KUBERNETES');
    assert.strictEqual(events.items[0].metric_type, 'POD_CRASH_LOOP');
    assert.strictEqual(events.items[0].resource_id, 'auth-service-78dfb-x79pq');

    // 2. Pod recovers to Running and healthy
    await pool.query(
      `UPDATE pods SET status = 'Running', restart_count = 0 WHERE id = $1`,
      [podId]
    );

    const evalRecover = await KubernetesRuleEvaluator.evaluateRule(testRuleK8sCrash);
    assert.strictEqual(evalRecover.resolved, 1, 'Should auto-resolve when pod returns to Running');

    events = await AlertEventModel.findByOrg(orgAId, { rule_id: testRuleK8sCrash.id });
    assert.strictEqual(events.items[0].status, 'RESOLVED');
  });

  test('6. [RE-06] Kubernetes Rule Evaluator: Detects Node NotReady & Deployment Unavailable', async () => {
    // 1. Node NotReady
    const ruleNode = await AlertRuleModel.create({
      organization_id: orgAId,
      cluster_id: clusterAId,
      name: 'Node NotReady Rule',
      metric_type: 'NODE_NOT_READY',
      operator: 'GREATER_THAN',
      threshold_value: 0,
      unit: 'count',
      severity: 'CRITICAL',
    });

    await pool.query(
      `INSERT INTO nodes (id, cluster_id, name, status) VALUES (gen_random_uuid(), $1, 'worker-k8s-2', 'NotReady')`,
      [clusterAId]
    );

    const evalNode = await KubernetesRuleEvaluator.evaluateRule(ruleNode);
    assert.strictEqual(evalNode.triggered, 1);

    // 2. Deployment Unavailable
    const ruleDeploy = await AlertRuleModel.create({
      organization_id: orgAId,
      cluster_id: clusterAId,
      name: 'Deployment Unavailable Rule',
      metric_type: 'DEPLOYMENT_UNAVAILABLE',
      operator: 'GREATER_THAN',
      threshold_value: 0,
      unit: 'replicas',
      severity: 'WARNING',
    });

    // Update deployment to missing 2 replicas (desired 3, available 1)
    await pool.query(
      `UPDATE deployments SET available_replicas = 1 WHERE workload_id = $1`,
      [workloadAId]
    );

    const evalDeploy = await KubernetesRuleEvaluator.evaluateRule(ruleDeploy);
    assert.strictEqual(evalDeploy.triggered, 1);

    const deployEvents = await AlertEventModel.findByOrg(orgAId, { rule_id: ruleDeploy.id, status: 'ACTIVE' });
    assert.strictEqual(deployEvents.items.length, 1);
    assert.strictEqual(Number(deployEvents.items[0].observed_value), 2, 'Missing 2 replicas');
  });

  // --- INTEGRATION: APM Evaluator ---
  test('7. [RE-07] APM Evaluator: Detects high HTTP 5xx error rate and auto-resolves when errors subside', async () => {
    testRuleApm5xx = await AlertRuleModel.create({
      organization_id: orgAId,
      cluster_id: clusterAId,
      name: 'High 5xx Error Rate Rule',
      metric_type: 'HTTP_5XX_RATE',
      operator: 'GREATER_THAN',
      threshold_value: 5.0,
      unit: '%',
      severity: 'CRITICAL',
      evaluation_window: '5m',
      duration: 0,
      cooldown_seconds: 300,
    });

    // Seed agent_metrics with http_5xx_rate = 14.5%
    await pool.query(
      `INSERT INTO agent_metrics (
        agent_id, organization_id, cluster_id, service_id, pod_id, http_5xx_rate, latency, request_rate, collected_at
      ) VALUES ($1, $2, $3, 'checkout-service', 'checkout-pod-1', 14.5, 350.0, 200.0, NOW())`,
      [agentAId, orgAId, clusterAId]
    );

    const evalApm = await ApmRuleEvaluator.evaluateRule(testRuleApm5xx);
    assert.strictEqual(evalApm.triggered, 1);

    let apmEvents = await AlertEventModel.findByOrg(orgAId, { rule_id: testRuleApm5xx.id, status: 'ACTIVE' });
    assert.strictEqual(apmEvents.items.length, 1);
    assert.strictEqual(apmEvents.items[0].category, 'APM');
    assert.strictEqual(Number(apmEvents.items[0].observed_value), 14.5);

    // Settle error rate to 0.5%
    await pool.query(`DELETE FROM agent_metrics WHERE organization_id = $1`, [orgAId]);
    await pool.query(
      `INSERT INTO agent_metrics (
        agent_id, organization_id, cluster_id, service_id, pod_id, http_5xx_rate, latency, request_rate, collected_at
      ) VALUES ($1, $2, $3, 'checkout-service', 'checkout-pod-1', 0.5, 45.0, 220.0, NOW())`,
      [agentAId, orgAId, clusterAId]
    );

    const evalRecovery = await ApmRuleEvaluator.evaluateRule(testRuleApm5xx);
    assert.strictEqual(evalRecovery.resolved, 1);

    apmEvents = await AlertEventModel.findByOrg(orgAId, { rule_id: testRuleApm5xx.id });
    assert.strictEqual(apmEvents.items[0].status, 'RESOLVED');
  });

  // --- UNIFIED ENGINE: Execution cycle ---
  test('8. [RE-08] Unified Engine: runEvaluationCycle runs cleanly and aggregates execution metrics', async () => {
    const cycleResult = await RuleEngineExecutionService.runEvaluationCycle({
      organizationId: orgAId,
    });

    assert.ok(cycleResult.rules_evaluated >= 3, 'Evaluated active rules');
    assert.strictEqual(typeof cycleResult.alerts_triggered, 'number');
    assert.strictEqual(typeof cycleResult.alerts_resolved, 'number');
    assert.ok(cycleResult.duration_ms >= 0);
  });

  // --- API & LIFECYCLE: Acknowledge & Resolve Endpoints ---
  test('9. [RE-09] API: Acknowledge Alert Event changes status to ACKNOWLEDGED with audit note', async () => {
    // Create an active event manually to test API lifecycle
    const activeRes = await AlertLifecycleService.recordAlertTrigger({
      organization_id: orgAId,
      cluster_id: clusterAId,
      rule_name: 'Manual Test Alert',
      category: 'RESOURCE',
      metric_type: 'RAM',
      resource_type: 'node',
      resource_id: 'node-worker-manual',
      severity: 'WARNING',
      observed_value: 88,
      threshold_value: 80,
      unit: '%',
      message: 'Node manual RAM breach',
    });

    const eventId = activeRes.event.id;

    // PATCH /api/v1/alert-events/:id/acknowledge
    const resAck = await requestJson(`/api/v1/alert-events/${eventId}/acknowledge`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${devopsAJwt}` },
      body: { note: 'Đang kiểm tra tiến trình chiếm bộ nhớ' },
    });

    assert.strictEqual(resAck.status, 200);
    assert.strictEqual(resAck.body.data.status, 'ACKNOWLEDGED');
    assert.ok(resAck.body.data.acknowledged_at);

    // Verify GET /api/v1/alert-events/:id
    const resGet = await requestJson(`/api/v1/alert-events/${eventId}`, {
      headers: { Authorization: `Bearer ${devopsAJwt}` },
    });
    assert.strictEqual(resGet.status, 200);
    assert.strictEqual(resGet.body.data.status, 'ACKNOWLEDGED');

    // PATCH /api/v1/alert-events/:id/resolve
    const resResolve = await requestJson(`/api/v1/alert-events/${eventId}/resolve`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${devopsAJwt}` },
      body: { resolution_note: 'Đã giải phóng bộ nhớ đệm cache' },
    });

    assert.strictEqual(resResolve.status, 200);
    assert.strictEqual(resResolve.body.data.status, 'RESOLVED');
    assert.ok(resResolve.body.data.resolved_at);
  });

  // --- SECURITY: Anti-IDOR & RBAC ---
  test('10. [RE-10] Security Anti-IDOR: Tenant B cannot view or acknowledge Tenant A alert events (404/403)', async () => {
    // Create active event for Tenant A
    const activeA = await AlertLifecycleService.recordAlertTrigger({
      organization_id: orgAId,
      cluster_id: clusterAId,
      rule_name: 'Tenant A Sensitive Alert',
      category: 'RESOURCE',
      metric_type: 'DISK',
      resource_type: 'node',
      resource_id: 'node-disk-1',
      severity: 'CRITICAL',
      message: 'Tenant A disk full',
    });

    // Tenant B attempts to read Tenant A event
    const resGet = await requestJson(`/api/v1/alert-events/${activeA.event.id}`, {
      headers: { Authorization: `Bearer ${ownerBJwt}` },
    });
    assert.strictEqual(resGet.status, 404, 'Tenant B must receive 404 Not Found on cross-tenant event access');

    // Tenant B attempts to acknowledge Tenant A event
    const resAck = await requestJson(`/api/v1/alert-events/${activeA.event.id}/acknowledge`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${ownerBJwt}` },
      body: { note: 'Hacker attempting acknowledge' },
    });
    assert.strictEqual(resAck.status, 404);
  });

  test('11. [RE-11] Security RBAC: VIEWER role cannot acknowledge, resolve, or trigger evaluate (403 Forbidden)', async () => {
    // Create active event for Tenant A
    const activeA = await AlertLifecycleService.recordAlertTrigger({
      organization_id: orgAId,
      cluster_id: clusterAId,
      rule_name: 'Tenant A RBAC Event',
      category: 'RESOURCE',
      metric_type: 'CPU',
      resource_type: 'node',
      resource_id: 'node-rbac-1',
      severity: 'WARNING',
      message: 'RBAC verification event',
    });

    // Viewer attempts to acknowledge
    const resAck = await requestJson(`/api/v1/alert-events/${activeA.event.id}/acknowledge`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${viewerAJwt}` },
    });
    assert.strictEqual(resAck.status, 403, 'Viewer cannot acknowledge alert');

    // Viewer attempts to resolve
    const resResolve = await requestJson(`/api/v1/alert-events/${activeA.event.id}/resolve`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${viewerAJwt}` },
    });
    assert.strictEqual(resResolve.status, 403, 'Viewer cannot resolve alert');

    // Viewer attempts to trigger evaluate
    const resEval = await requestJson(`/api/v1/alert-events/evaluate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${viewerAJwt}` },
    });
    assert.strictEqual(resEval.status, 403, 'Viewer cannot trigger evaluation cycle');
  });

  test('12. [RE-12] API Filtering & Pagination: GET /api/v1/alert-events filters by category, severity, status', async () => {
    const resList = await requestJson(`/api/v1/alert-events?category=RESOURCE&page=1&limit=10`, {
      headers: { Authorization: `Bearer ${devopsAJwt}` },
    });

    assert.strictEqual(resList.status, 200);
    assert.ok(Array.isArray(resList.body.data.items));
    assert.ok(resList.body.data.pagination);
    for (const item of resList.body.data.items) {
      assert.strictEqual(item.category, 'RESOURCE');
    }
  });
});
