import test, { describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { AddressInfo } from 'net';

import app from '../app';
import { pool } from '../config/database';
import { config } from '../config/env';
import { closeRedis } from '../config/redis';
import { AlertLifecycleService } from '../services/alertLifecycle.service';

describe('[S5][PBI22 Task 4.3 & 4.4] Alert Assignment, Resolution Concurrency & Audit Trail Suite', () => {
  let server: http.Server;
  let baseUrl: string;

  const orgAId = crypto.randomUUID();
  const orgBId = crypto.randomUUID();
  const envAId = crypto.randomUUID();
  const clusterAId = crypto.randomUUID();

  const ownerAId = crypto.randomUUID();
  const devopsAId = crypto.randomUUID();
  const viewerAId = crypto.randomUUID();
  const ownerBId = crypto.randomUUID();

  let ownerAJwt: string;
  let devopsAJwt: string;
  let viewerAJwt: string;
  let ownerBJwt: string;

  let testAlertId: string;

  async function requestJson(
    urlPath: string,
    options: { method?: string; headers?: Record<string, string>; body?: any } = {}
  ): Promise<{ status: number; body: any }> {
    const res = await fetch(`${baseUrl}${urlPath}`, {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    const text = await res.text();
    let parsed: any = text;
    try {
      parsed = JSON.parse(text);
    } catch {
      // plain text fallback
    }
    return { status: res.status, body: parsed };
  }

  before(async () => {
    const rolesRes = await pool.query(`SELECT id, code FROM roles WHERE scope = 'ORGANIZATION'`);
    const roleMap = new Map<string, string>();
    rolesRes.rows.forEach((r: any) => roleMap.set(r.code, r.id));

    await pool.query(
      `INSERT INTO users (id, email, password_hash, full_name, status, created_at, updated_at)
       VALUES
         ($1, 'owner.a.t43@test.com', 'hash', 'Owner Alpha', 'ACTIVE', NOW(), NOW()),
         ($2, 'devops.a.t43@test.com', 'hash', 'DevOps Alpha', 'ACTIVE', NOW(), NOW()),
         ($3, 'viewer.a.t43@test.com', 'hash', 'Viewer Alpha', 'ACTIVE', NOW(), NOW()),
         ($4, 'owner.b.t43@test.com', 'hash', 'Owner Beta', 'ACTIVE', NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET status = 'ACTIVE', deleted_at = NULL;`,
      [ownerAId, devopsAId, viewerAId, ownerBId]
    );

    await pool.query(
      `INSERT INTO organizations (id, name, slug, status, created_by, created_at, updated_at)
       VALUES
         ($1, 'Org Alpha T43', $3, 'ACTIVE', $5, NOW(), NOW()),
         ($2, 'Org Beta T43', $4, 'ACTIVE', $6, NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET status = 'ACTIVE', deleted_at = NULL;`,
      [orgAId, orgBId, `org-alpha-t43-${orgAId.slice(0, 6)}`, `org-beta-t43-${orgBId.slice(0, 6)}`, ownerAId, ownerBId]
    );

    await pool.query(
      `INSERT INTO organization_members (organization_id, user_id, role_id, status, joined_at)
       VALUES
         ($1, $3, $7, 'ACTIVE', NOW()),
         ($1, $4, $8, 'ACTIVE', NOW()),
         ($1, $5, $9, 'ACTIVE', NOW()),
         ($2, $6, $7, 'ACTIVE', NOW())
       ON CONFLICT (organization_id, user_id) DO UPDATE SET status = 'ACTIVE';`,
      [
        orgAId,
        orgBId,
        ownerAId,
        devopsAId,
        viewerAId,
        ownerBId,
        roleMap.get('SME_OWNER'),
        roleMap.get('DEVOPS'),
        roleMap.get('VIEWER'),
      ]
    );

    await pool.query(
      `INSERT INTO environments (id, organization_id, name, code, environment_type, created_by, created_at, updated_at)
       VALUES ($1, $2, 'Prod T43', $3, 'PRODUCTION', $4, NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET deleted_at = NULL;`,
      [envAId, orgAId, `env-t43-${envAId.slice(0, 6)}`, ownerAId]
    );
    await pool.query(
      `INSERT INTO clusters (id, environment_id, name, cluster_uid, provider, kubernetes_version, status, created_at, updated_at)
       VALUES ($1, $2, 'cluster-alpha-t43', $3, 'MINIKUBE', 'v1.37.0', 'CONNECTED', NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET deleted_at = NULL;`,
      [clusterAId, envAId, `uid-t43-${clusterAId.slice(0, 6)}`]
    );

    ownerAJwt = jwt.sign(
      { id: ownerAId, email: 'owner.a.t43@test.com', roles: ['SME_OWNER'], status: 'ACTIVE', organization_id: orgAId },
      config.jwt.secret,
      { expiresIn: '1h' }
    );
    devopsAJwt = jwt.sign(
      { id: devopsAId, email: 'devops.a.t43@test.com', roles: ['DEVOPS'], status: 'ACTIVE', organization_id: orgAId },
      config.jwt.secret,
      { expiresIn: '1h' }
    );
    viewerAJwt = jwt.sign(
      { id: viewerAId, email: 'viewer.a.t43@test.com', roles: ['VIEWER'], status: 'ACTIVE', organization_id: orgAId },
      config.jwt.secret,
      { expiresIn: '1h' }
    );
    ownerBJwt = jwt.sign(
      { id: ownerBId, email: 'owner.b.t43@test.com', roles: ['SME_OWNER'], status: 'ACTIVE', organization_id: orgBId },
      config.jwt.secret,
      { expiresIn: '1h' }
    );

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
    await pool.query(`DELETE FROM clusters WHERE id = $1`, [clusterAId]);
    await pool.query(`DELETE FROM environments WHERE id = $1`, [envAId]);
    await pool.query(`DELETE FROM organization_members WHERE organization_id IN ($1, $2)`, [orgAId, orgBId]);
    await pool.query(`DELETE FROM organizations WHERE id IN ($1, $2)`, [orgAId, orgBId]);
    await pool.query(`DELETE FROM users WHERE id IN ($1, $2, $3, $4)`, [ownerAId, devopsAId, viewerAId, ownerBId]);
    await closeRedis();
    await pool.end();
  });

  test('1. Assign, Reassign, and Unassign alert with org membership validation and version increment', async () => {
    const triggered = await AlertLifecycleService.recordAlertTrigger({
      organization_id: orgAId,
      cluster_id: clusterAId,
      rule_name: 'CPU High Alert T43',
      category: 'RESOURCE',
      metric_type: 'CPU',
      resource_type: 'node',
      resource_id: 'worker-node-t43',
      namespace: 'kube-system',
      severity: 'CRITICAL',
      observed_value: 96.4,
      threshold_value: 85,
      unit: '%',
      message: 'CPU node worker-node-t43 đạt 96.4%',
    });
    testAlertId = triggered.event.id;

    // 1a. Reject assigning user from another organization (Org B)
    const crossOrgAssign = await requestJson(`/api/v1/alerts/${testAlertId}/assign`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${ownerAJwt}` },
      body: { assignedTo: ownerBId, note: 'Cross-org user attempt' },
    });
    assert.strictEqual(crossOrgAssign.status, 400);

    // 1b. Assign to DevOps Alpha (valid active member of Org A)
    const assignRes = await requestJson(`/api/v1/alerts/${testAlertId}/assign`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${ownerAJwt}` },
      body: { assignedTo: devopsAId, note: 'Giao cho kỹ sư trực ca' },
    });
    assert.strictEqual(assignRes.status, 200);
    assert.strictEqual(assignRes.body.data.assigned_to, devopsAId);
    assert.strictEqual(assignRes.body.data.assigned_by, ownerAId);
    assert.strictEqual(assignRes.body.data.assignee_name, 'DevOps Alpha');
    assert.ok(assignRes.body.data.assigned_at);
    assert.strictEqual(assignRes.body.data.version, 2);

    // 1c. Reassign to Owner Alpha
    const reassignRes = await requestJson(`/api/v1/alerts/${testAlertId}/assign`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${devopsAJwt}` },
      body: { assignedTo: ownerAId, note: 'Chuyển cấp quản lý xử lý', expectedVersion: 2 },
    });
    assert.strictEqual(reassignRes.status, 200);
    assert.strictEqual(reassignRes.body.data.assigned_to, ownerAId);
    assert.strictEqual(reassignRes.body.data.assignee_name, 'Owner Alpha');
    assert.strictEqual(reassignRes.body.data.version, 3);

    // 1d. Unassign
    const unassignRes = await requestJson(`/api/v1/alerts/${testAlertId}/unassign`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${ownerAJwt}` },
      body: { note: 'Hủy phân công tạm thời', expectedVersion: 3 },
    });
    assert.strictEqual(unassignRes.status, 200);
    assert.strictEqual(unassignRes.body.data.assigned_to, null);
    assert.strictEqual(unassignRes.body.data.version, 4);

    // Re-assign back to DevOps Alpha for subsequent lifecycle steps
    const assignAgain = await requestJson(`/api/v1/alerts/${testAlertId}/assign`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${ownerAJwt}` },
      body: { assignedTo: devopsAId, expectedVersion: 4 },
    });
    assert.strictEqual(assignAgain.status, 200);
    assert.strictEqual(assignAgain.body.data.version, 5);
  });

  test('2. Acknowledge, Rule Engine re-trigger preservation, Resolve with resolutionNote & 409 Conflict protection', async () => {
    // 2a. Stale expectedVersion should fail with 409 Conflict
    const staleAck = await requestJson(`/api/v1/alerts/${testAlertId}/acknowledge`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${devopsAJwt}` },
      body: { note: 'Stale version', expectedVersion: 1 },
    });
    assert.strictEqual(staleAck.status, 409);

    // 2b. Valid Acknowledge
    const ackRes = await requestJson(`/api/v1/alerts/${testAlertId}/acknowledge`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${devopsAJwt}` },
      body: { note: 'Đang kiểm tra pod gây nghẽn CPU', expectedVersion: 5 },
    });
    assert.strictEqual(ackRes.status, 200);
    assert.strictEqual(ackRes.body.data.status, 'ACKNOWLEDGED');
    assert.strictEqual(ackRes.body.data.acknowledged_by, devopsAId);
    assert.strictEqual(ackRes.body.data.version, 6);

    // 2c. Rule Engine continuous trigger must preserve assigned_to & acknowledged_by
    const reTriggered = await AlertLifecycleService.recordAlertTrigger({
      organization_id: orgAId,
      cluster_id: clusterAId,
      rule_name: 'CPU High Alert T43',
      category: 'RESOURCE',
      metric_type: 'CPU',
      resource_type: 'node',
      resource_id: 'worker-node-t43',
      severity: 'CRITICAL',
      observed_value: 97.1,
      threshold_value: 85,
      unit: '%',
      message: 'CPU node worker-node-t43 đạt 97.1%',
    });
    assert.strictEqual(reTriggered.event.status, 'ACKNOWLEDGED');
    assert.strictEqual(reTriggered.event.assigned_to, devopsAId);
    assert.strictEqual(reTriggered.event.acknowledged_by, devopsAId);

    // 2d. Resolve with resolutionNote
    const resolveRes = await requestJson(`/api/v1/alerts/${testAlertId}/resolve`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${devopsAJwt}` },
      body: {
        resolutionNote: 'Đã scale thêm 2 worker nodes và giới hạn CPU limit deployment',
        expectedVersion: 6,
      },
    });
    assert.strictEqual(resolveRes.status, 200);
    assert.strictEqual(resolveRes.body.data.status, 'RESOLVED');
    assert.strictEqual(resolveRes.body.data.resolved_by, devopsAId);
    assert.strictEqual(resolveRes.body.data.resolver_name, 'DevOps Alpha');
    assert.strictEqual(
      resolveRes.body.data.resolution_note,
      'Đã scale thêm 2 worker nodes và giới hạn CPU limit deployment'
    );
    assert.ok(resolveRes.body.data.resolved_at);
    assert.strictEqual(resolveRes.body.data.version, 7);

    // 2e. Duplicate resolve on already RESOLVED alert returns 409 Conflict
    const dupResolve = await requestJson(`/api/v1/alerts/${testAlertId}/resolve`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${ownerAJwt}` },
      body: { resolutionNote: 'Giải quyết trùng lặp' },
    });
    assert.strictEqual(dupResolve.status, 409);
  });

  test('3. Audit Trail & Alert History pagination/assignedTo filter return complete lifecycle data', async () => {
    const auditRes = await requestJson(`/api/v1/alerts/${testAlertId}/audit-trail?page=1&limit=20&order=asc`, {
      headers: { Authorization: `Bearer ${viewerAJwt}` },
    });
    assert.strictEqual(auditRes.status, 200);
    const items = auditRes.body.data.items;
    assert.ok(Array.isArray(items));
    const actions = items.map((e: any) => e.action);
    assert.deepStrictEqual(actions, [
      'TRIGGERED',
      'ASSIGNED',
      'REASSIGNED',
      'UNASSIGNED',
      'ASSIGNED',
      'ACKNOWLEDGED',
      'RESOLVED',
    ]);

    const reassignEntry = items.find((e: any) => e.action === 'REASSIGNED');
    assert.strictEqual(reassignEntry.old_value.assigned_to, devopsAId);
    assert.strictEqual(reassignEntry.new_value.assigned_to, ownerAId);

    const resolveEntry = items.find((e: any) => e.action === 'RESOLVED');
    assert.strictEqual(resolveEntry.actor_name, 'DevOps Alpha');
    assert.strictEqual(
      resolveEntry.note,
      'Đã scale thêm 2 worker nodes và giới hạn CPU limit deployment'
    );

    // History query with assignedTo filter and pagination total_pages normalization
    const historyRes = await requestJson(
      `/api/v1/alerts/history?assignedTo=${devopsAId}&page=1&limit=10`,
      { headers: { Authorization: `Bearer ${viewerAJwt}` } }
    );
    assert.strictEqual(historyRes.status, 200);
    assert.strictEqual(historyRes.body.pagination.total_pages, 1);
    assert.strictEqual(historyRes.body.pagination.totalPages, 1);
    assert.strictEqual(historyRes.body.data.length, 1);
    assert.strictEqual(historyRes.body.data[0].id, testAlertId);
    assert.strictEqual(historyRes.body.data[0].assignee_name, 'DevOps Alpha');
    assert.strictEqual(
      historyRes.body.data[0].resolution_note,
      'Đã scale thêm 2 worker nodes và giới hạn CPU limit deployment'
    );
  });

  test('4. RBAC & Anti-IDOR: VIEWER is read-only (403) and Tenant B is isolated (404)', async () => {
    const activeRes = await AlertLifecycleService.recordAlertTrigger({
      organization_id: orgAId,
      cluster_id: clusterAId,
      rule_name: 'Memory Warning T43',
      category: 'RESOURCE',
      metric_type: 'RAM',
      resource_type: 'node',
      resource_id: 'worker-ram-t43',
      severity: 'WARNING',
      observed_value: 84,
      threshold_value: 80,
      unit: '%',
      message: 'RAM cao 84%',
    });
    const alert2Id = activeRes.event.id;

    // VIEWER cannot assign, unassign, acknowledge, or resolve
    for (const [path, body] of [
      [`/api/v1/alerts/${alert2Id}/assign`, { assignedTo: devopsAId }],
      [`/api/v1/alerts/${alert2Id}/unassign`, {}],
      [`/api/v1/alerts/${alert2Id}/acknowledge`, {}],
      [`/api/v1/alerts/${alert2Id}/resolve`, { resolutionNote: 'try' }],
    ] as const) {
      const r = await requestJson(path, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${viewerAJwt}` },
        body,
      });
      assert.strictEqual(r.status, 403, `Expected 403 for VIEWER on ${path}`);
    }

    // Tenant B cannot access Tenant A alert or audit trail
    const crossAudit = await requestJson(`/api/v1/alerts/${alert2Id}/audit-trail`, {
      headers: { Authorization: `Bearer ${ownerBJwt}` },
    });
    assert.strictEqual(crossAudit.status, 404);

    const crossResolve = await requestJson(`/api/v1/alerts/${alert2Id}/resolve`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${ownerBJwt}` },
      body: { resolutionNote: 'Cross-tenant hijack' },
    });
    assert.strictEqual(crossResolve.status, 404);
  });
});
