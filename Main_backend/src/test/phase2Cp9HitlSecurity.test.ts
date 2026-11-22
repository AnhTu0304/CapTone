import test, { describe, before, after, mock } from 'node:test';
import assert from 'node:assert';
import crypto from 'crypto';
import http from 'http';
import { AddressInfo } from 'node:net';
import jwt from 'jsonwebtoken';
import WebSocket from 'ws';
import app from '../app';
import { config } from '../config/env';
import { pool } from '../config/database';
import { closeRedis } from '../config/redis';
import { initAgentWebSocket, dispatchHealingActionToAgent } from '../websocket/agentWebSocket';
import { HealingActionModel } from '../models/healingAction.model';
import { RecommendationModel } from '../models/recommendation.model';
import { HealingActionService } from '../services/healingAction.service';
import { HitlNotificationService } from '../services/hitlNotification.service';
import { RecoveryVerificationService } from '../services/recoveryVerification.service';
import { EmailService } from '../services/email.service';

const ORG_A = 'd9c90000-0000-4000-8000-000000000001';
const ORG_B = 'd9c90000-0000-4000-8000-000000000002';
const ENV_A = 'd9c90000-0000-4000-8000-000000000011';
const ENV_A2 = 'd9c90000-0000-4000-8000-000000000013';
const ENV_B = 'd9c90000-0000-4000-8000-000000000012';
const CLUSTER_A = 'd9c90000-0000-4000-8000-000000000021';
const CLUSTER_A2 = 'd9c90000-0000-4000-8000-000000000023';
const CLUSTER_B = 'd9c90000-0000-4000-8000-000000000022';
const INC_A = 'd9c90000-0000-4000-8000-000000000031';
const INC_B = 'd9c90000-0000-4000-8000-000000000032';
let ACT_TYPE_RESTART = 'd9c90000-0000-4000-8000-000000000051';
let ACT_TYPE_HIGH = 'd9c90000-0000-4000-8000-000000000052';
const POLICY_AUTO_A = 'd9c90000-0000-4000-8000-000000000081';

const AGENT_A1 = 'd9c90000-0000-4000-8000-000000000061';
const AGENT_A2 = 'd9c90000-0000-4000-8000-000000000062';
const AGENT_B1 = 'd9c90000-0000-4000-8000-000000000063';
const TOK_A1 = 'd9c90000-0000-4000-8000-000000000071';
const TOK_A2 = 'd9c90000-0000-4000-8000-000000000072';
const TOK_B1 = 'd9c90000-0000-4000-8000-000000000073';
const RAW_A1 = 'cp9_agent_token_a1_secret_0001';
const RAW_A2 = 'cp9_agent_token_a2_secret_0002';
const RAW_B1 = 'cp9_agent_token_b1_secret_0003';

const USERS = {
  devopsA: 'd9c90000-0000-4000-8000-000000000101',
  viewerA: 'd9c90000-0000-4000-8000-000000000102',
  adminB: 'd9c90000-0000-4000-8000-000000000103',
  superMemberA: 'd9c90000-0000-4000-8000-000000000104',
  superNoOrg: 'd9c90000-0000-4000-8000-000000000105',
  superInactiveA: 'd9c90000-0000-4000-8000-000000000106',
  systemAdminNoOrg: 'd9c90000-0000-4000-8000-000000000107',
};

function signJwt(id: string, email: string, roles: string[] = ['USER']) {
  return jwt.sign({ id, email, status: 'ACTIVE', roles }, config.jwt.secret, {
    algorithm: 'HS256',
    expiresIn: '1h',
  });
}

function connectAgentWs(
  wsBaseUrl: string,
  agentUid: string,
  rawToken: string
): Promise<{ ws: WebSocket; messages: any[] }> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${wsBaseUrl}/api/v1/agent/connect`, {
      headers: { 'x-agent-token': rawToken },
    });
    const messages: any[] = [];
    const timer = setTimeout(() => reject(new Error(`WS auth timeout for ${agentUid}`)), 5000);
    ws.on('message', (raw) => {
      const parsed = JSON.parse(raw.toString());
      messages.push(parsed);
      if (parsed.status === 'authenticated') {
        clearTimeout(timer);
        resolve({ ws, messages });
      }
    });
    ws.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

describe('Phase 2 CP-9: HITL Lifecycle, Atomic Transitions, Expiration, RBAC & Agent Routing', () => {
  let server: http.Server;
  let agentWss: ReturnType<typeof initAgentWebSocket>;
  let baseUrl: string;
  let wsBaseUrl: string;

  before(async () => {
    mock.method(EmailService, 'sendHitlApprovalNotification', async () => true);
    const dbCheck = await pool.query('SELECT current_database() AS db');
    if (dbCheck.rows[0]?.db !== 'aiselfhealing_test') {
      throw new Error(`SAFETY ABORT: Wrong database '${dbCheck.rows[0]?.db}'`);
    }

    await pool.query(
      `INSERT INTO users (id, email, password_hash, full_name, status)
       VALUES
         ($1, 'cp9.devops.a@test.local', 'hash', 'CP9 DevOps A', 'ACTIVE'),
         ($2, 'cp9.viewer.a@test.local', 'hash', 'CP9 Viewer A', 'ACTIVE'),
         ($3, 'cp9.admin.b@test.local', 'hash', 'CP9 Admin B', 'ACTIVE'),
         ($4, 'cp9.super.a@test.local', 'hash', 'CP9 Super Member A', 'ACTIVE'),
         ($5, 'cp9.super.noorg@test.local', 'hash', 'CP9 Super NoOrg', 'ACTIVE'),
         ($6, 'cp9.super.inactive@test.local', 'hash', 'CP9 Super Inactive A', 'ACTIVE'),
         ($7, 'cp9.sysadmin.noorg@test.local', 'hash', 'CP9 SysAdmin NoOrg', 'ACTIVE')
       ON CONFLICT (id) DO UPDATE SET status = 'ACTIVE', deleted_at = NULL;`,
      [
        USERS.devopsA,
        USERS.viewerA,
        USERS.adminB,
        USERS.superMemberA,
        USERS.superNoOrg,
        USERS.superInactiveA,
        USERS.systemAdminNoOrg,
      ]
    );

    const sysRolesRes = await pool.query(`SELECT id, name FROM system_roles WHERE name IN ('SUPER_ADMIN', 'SYSTEM_ADMIN')`);
    const superRoleId = sysRolesRes.rows.find((r) => r.name === 'SUPER_ADMIN')?.id;
    const sysAdminRoleId = sysRolesRes.rows.find((r) => r.name === 'SYSTEM_ADMIN')?.id;
    assert.ok(superRoleId && sysAdminRoleId, 'SUPER_ADMIN and SYSTEM_ADMIN system roles required');

    await pool.query(
      `INSERT INTO user_system_roles (user_id, system_role_id)
       VALUES ($1, $5), ($2, $5), ($3, $5), ($4, $6)
       ON CONFLICT DO NOTHING;`,
      [USERS.superMemberA, USERS.superNoOrg, USERS.superInactiveA, USERS.systemAdminNoOrg, superRoleId, sysAdminRoleId]
    );

    await pool.query(
      `INSERT INTO organizations (id, name, slug, status)
       VALUES ($1, 'CP9 Org A', 'cp9-org-a', 'ACTIVE'), ($2, 'CP9 Org B', 'cp9-org-b', 'ACTIVE')
       ON CONFLICT (id) DO NOTHING;`,
      [ORG_A, ORG_B]
    );

    const orgRolesRes = await pool.query(`SELECT id, code FROM organization_roles WHERE code IN ('DEVOPS', 'VIEWER', 'SME_OWNER')`);
    const devopsRoleId = orgRolesRes.rows.find((r) => r.code === 'DEVOPS')?.id;
    const viewerRoleId = orgRolesRes.rows.find((r) => r.code === 'VIEWER')?.id;
    const ownerRoleId = orgRolesRes.rows.find((r) => r.code === 'SME_OWNER')?.id;
    assert.ok(devopsRoleId && viewerRoleId && ownerRoleId);

    await pool.query(
      `INSERT INTO organization_members (organization_id, user_id, role_id, status)
       VALUES
         ($1, $3, $7, 'ACTIVE'),
         ($1, $4, $8, 'ACTIVE'),
         ($2, $5, $9, 'ACTIVE'),
         ($1, $6, $7, 'ACTIVE')
       ON CONFLICT (organization_id, user_id) DO UPDATE SET status = EXCLUDED.status, role_id = EXCLUDED.role_id;`,
      [ORG_A, ORG_B, USERS.devopsA, USERS.viewerA, USERS.adminB, USERS.superMemberA, devopsRoleId, viewerRoleId, ownerRoleId]
    );

    await pool.query(
      `INSERT INTO organization_members (organization_id, user_id, role_id, status)
       VALUES ($1, $2, $3, 'INACTIVE')
       ON CONFLICT (organization_id, user_id) DO UPDATE SET status = 'INACTIVE';`,
      [ORG_A, USERS.superInactiveA, devopsRoleId]
    );

    await pool.query(
      `INSERT INTO environments (id, organization_id, name, status)
       VALUES ($1, $4, 'CP9 Env A1', 'ACTIVE'), ($2, $4, 'CP9 Env A2', 'ACTIVE'), ($3, $5, 'CP9 Env B1', 'ACTIVE')
       ON CONFLICT (id) DO NOTHING;`,
      [ENV_A, ENV_A2, ENV_B, ORG_A, ORG_B]
    );

    await pool.query(
      `INSERT INTO clusters (id, environment_id, name, status)
       VALUES ($1, $4, 'cp9-cluster-a1', 'CONNECTED'), ($2, $5, 'cp9-cluster-a2', 'CONNECTED'), ($3, $6, 'cp9-cluster-b1', 'CONNECTED')
       ON CONFLICT (id) DO NOTHING;`,
      [CLUSTER_A, CLUSTER_A2, CLUSTER_B, ENV_A, ENV_A2, ENV_B]
    );

    await pool.query(
      `INSERT INTO agents (id, name, agent_uid, cluster_id, environment_id, status)
       VALUES
         ($1, 'cp9-agent-a1', 'cp9-uid-a1', $4, $7, 'ONLINE'),
         ($2, 'cp9-agent-a2', 'cp9-uid-a2', $5, $8, 'ONLINE'),
         ($3, 'cp9-agent-b1', 'cp9-uid-b1', $6, $9, 'ONLINE')
       ON CONFLICT (id) DO UPDATE SET status = 'ONLINE', cluster_id = EXCLUDED.cluster_id, environment_id = EXCLUDED.environment_id;`,
      [AGENT_A1, AGENT_A2, AGENT_B1, CLUSTER_A, CLUSTER_A2, CLUSTER_B, ENV_A, ENV_A2, ENV_B]
    );

    for (const [tokId, agId, raw] of [
      [TOK_A1, AGENT_A1, RAW_A1],
      [TOK_A2, AGENT_A2, RAW_A2],
      [TOK_B1, AGENT_B1, RAW_B1],
    ] as const) {
      const h = crypto.createHash('sha256').update(raw).digest('hex');
      await pool.query(
        `INSERT INTO agent_tokens (id, agent_id, token_hash, token_prefix, expires_at)
         VALUES ($1, $2, $3, $4, NOW() + interval '7 days')
         ON CONFLICT (id) DO UPDATE SET revoked_at = NULL, token_hash = EXCLUDED.token_hash;`,
        [tokId, agId, h, raw.slice(0, 12)]
      );
    }

    await pool.query(
      `INSERT INTO healing_action_types (id, code, name, description, target_type, default_risk_level, requires_approval_by_default, enabled)
       VALUES
         ($1, 'RESTART_POD', 'Restart Pod', 'Low risk restart', 'WORKLOAD', 'LOW', false, true),
         ($2, 'DRAIN_NODE', 'Drain Node', 'High risk drain', 'NODE', 'HIGH', true, true)
       ON CONFLICT (code) DO NOTHING;`,
      [ACT_TYPE_RESTART, ACT_TYPE_HIGH]
    );
    const actTypesRes = await pool.query(
      `SELECT id, code FROM healing_action_types WHERE code IN ('RESTART_POD', 'DRAIN_NODE')`
    );
    ACT_TYPE_RESTART = actTypesRes.rows.find((r) => r.code === 'RESTART_POD')?.id || ACT_TYPE_RESTART;
    ACT_TYPE_HIGH = actTypesRes.rows.find((r) => r.code === 'DRAIN_NODE')?.id || ACT_TYPE_HIGH;

    await pool.query(
      `INSERT INTO healing_policies (id, organization_id, environment_id, name, trigger_type, risk_level, execution_mode, requires_approval, is_active)
       VALUES ($1, $2, $3, 'CP9 Auto Low Policy', 'PREDICTION', 'LOW', 'AUTOMATIC', false, true)
       ON CONFLICT (id) DO UPDATE SET is_active = true, requires_approval = false, execution_mode = 'AUTOMATIC';`,
      [POLICY_AUTO_A, ORG_A, ENV_A]
    );

    await pool.query(
      `INSERT INTO incidents (id, organization_id, environment_id, cluster_id, source_type, title, description, incident_type, severity, target_type, target_name, status)
       VALUES
         ($1, $3, $5, $7::text, 'AI_DETECTION', 'CP9 Inc A', 'Desc A', 'CRASH_LOOP', 'HIGH', 'WORKLOAD', 'cp9-svc-a', 'OPEN'),
         ($2, $4, $6, $8::text, 'AI_DETECTION', 'CP9 Inc B', 'Desc B', 'CRASH_LOOP', 'HIGH', 'WORKLOAD', 'cp9-svc-b', 'OPEN')
       ON CONFLICT (id) DO NOTHING;`,
      [INC_A, INC_B, ORG_A, ORG_B, ENV_A, ENV_B, CLUSTER_A, CLUSTER_B]
    );

    server = http.createServer(app);
    agentWss = initAgentWebSocket(server);
    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        const addr = server.address() as AddressInfo;
        baseUrl = `http://127.0.0.1:${addr.port}`;
        wsBaseUrl = `ws://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  after(async () => {
    mock.restoreAll();
    const dbCheck = await pool.query('SELECT current_database() AS db');
    if (dbCheck.rows[0]?.db === 'aiselfhealing_test') {
      await pool.query(`DELETE FROM healing_actions WHERE environment_id IN ($1, $2, $3)`, [ENV_A, ENV_A2, ENV_B]);
      await pool.query(`DELETE FROM healing_policies WHERE id = $1`, [POLICY_AUTO_A]);
      await pool.query(`DELETE FROM incidents WHERE id IN ($1, $2)`, [INC_A, INC_B]);
      await pool.query(`DELETE FROM agent_tokens WHERE id IN ($1, $2, $3)`, [TOK_A1, TOK_A2, TOK_B1]);
      await pool.query(`DELETE FROM agents WHERE id IN ($1, $2, $3)`, [AGENT_A1, AGENT_A2, AGENT_B1]);
      await pool.query(`DELETE FROM clusters WHERE id IN ($1, $2, $3)`, [CLUSTER_A, CLUSTER_A2, CLUSTER_B]);
      await pool.query(`DELETE FROM environments WHERE id IN ($1, $2, $3)`, [ENV_A, ENV_A2, ENV_B]);
      await pool.query(`DELETE FROM organization_members WHERE organization_id IN ($1, $2)`, [ORG_A, ORG_B]);
      await pool.query(`DELETE FROM organizations WHERE id IN ($1, $2)`, [ORG_A, ORG_B]);
      await pool.query(`DELETE FROM user_system_roles WHERE user_id IN ($1, $2, $3, $4)`, [
        USERS.superMemberA,
        USERS.superNoOrg,
        USERS.superInactiveA,
        USERS.systemAdminNoOrg,
      ]);
      await pool.query(`DELETE FROM users WHERE id IN ($1, $2, $3, $4, $5, $6, $7)`, Object.values(USERS));
    }
    if (agentWss) agentWss.close();
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
    await closeRedis().catch(() => {});
    await pool.end().catch(() => {});
  });

  // =========================================================================
  // SECTION A: EXECUTION LIFECYCLE
  // =========================================================================
  test('A1: createAction & createHealingAction with missing status fields never default to APPROVED or COMPLETED', async () => {
    const act1 = await HealingActionModel.createAction({
      incident_id: INC_A,
      environment_id: ENV_A,
      action_type_id: ACT_TYPE_RESTART,
      target_name: 'cp9-missing-status-1',
    });
    assert.strictEqual(act1.approval_status, 'PENDING');
    assert.strictEqual(act1.execution_status, 'PENDING');
    assert.strictEqual(act1.completed_at, null);

    const apRow = await pool.query(`SELECT status FROM approvals WHERE healing_action_id = $1`, [act1.id]);
    assert.strictEqual(apRow.rows.length, 1);
    assert.strictEqual(apRow.rows[0].status, 'PENDING');

    const act2 = await RecommendationModel.createHealingAction({
      incident_id: INC_A,
      environment_id: ENV_A,
      action_type_id: ACT_TYPE_RESTART,
      target_type: 'WORKLOAD',
      target_name: 'cp9-missing-status-2',
    });
    assert.strictEqual(act2.approval_status, 'PENDING');
    assert.strictEqual(act2.execution_status, 'PENDING');
    assert.strictEqual(act2.completed_at, null);

    // Explicit valid LOW auto policy still stays PENDING execution until dispatched
    const lowAuto = await HealingActionModel.createAction({
      incident_id: INC_A,
      environment_id: ENV_A,
      action_type_id: ACT_TYPE_RESTART,
      policy_id: POLICY_AUTO_A,
      target_name: 'cp9-low-auto',
      risk_level: 'LOW',
      execution_mode: 'AUTO',
      requires_approval: false,
    } as any);
    assert.strictEqual(lowAuto.approval_status, 'APPROVED');
    assert.strictEqual(lowAuto.execution_status, 'PENDING');
  });

  test('A2: executeAction transition to RUNNING creates RUNNING attempt, zero recovery_verifications, and offline dispatch marks FAILED', async () => {
    const created = await HealingActionModel.createAction({
      incident_id: INC_A,
      environment_id: ENV_A,
      action_type_id: ACT_TYPE_HIGH,
      target_name: 'cp9-offline-target',
      risk_level: 'HIGH',
      execution_mode: 'MANUAL',
      requested_by: USERS.devopsA,
    });

    // Lock directly after manual approve SQL to isolate executeModel behavior
    await HealingActionModel.approveAction(created.id, USERS.devopsA, 'Approved for dispatch test');
    const execStart = await HealingActionModel.executeAction(created.id, USERS.devopsA);
    assert.strictEqual(execStart.action.execution_status, 'RUNNING');
    assert.strictEqual(execStart.attempt.status, 'RUNNING');

    const rvCountBefore = await pool.query(`SELECT count(*) FROM recovery_verifications WHERE healing_action_id = $1`, [created.id]);
    assert.strictEqual(Number(rvCountBefore.rows[0].count), 0, 'Transition to RUNNING must NOT create recovery_verifications');
    // Close synthetic RUNNING test action cleanly so subsequent incident tests do not hit concurrency lock
    await HealingActionModel.abortAction(created.id, USERS.devopsA, 'Cleanup synthetic RUNNING state');

    // Now test service-level dispatch when NO Agent socket is connected -> must record FAILED (never COMPLETED)
    const offlineAct = await HealingActionModel.createAction({
      incident_id: INC_A,
      environment_id: ENV_A,
      action_type_id: ACT_TYPE_HIGH,
      target_name: 'cp9-no-agent-target',
      risk_level: 'HIGH',
      execution_mode: 'MANUAL',
      requested_by: USERS.devopsA,
    });
    const devopsJwt = signJwt(USERS.devopsA, 'cp9.devops.a@test.local');
    const appRes = await fetch(`${baseUrl}/api/v1/healing/actions/${offlineAct.id}/approve`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${devopsJwt}`,
        'Content-Type': 'application/json',
        'x-organization-id': ORG_A,
      },
      body: JSON.stringify({ reason: 'Approve then expect no-agent FAILED' }),
    });
    assert.strictEqual(appRes.status, 200);

    const dbOffline = await pool.query(`SELECT execution_status, error_message FROM healing_actions WHERE id = $1`, [offlineAct.id]);
    assert.strictEqual(dbOffline.rows[0].execution_status, 'FAILED', 'Unavailable agent must mark execution_status = FAILED, never COMPLETED');
    assert.ok(dbOffline.rows[0].error_message, 'Failed offline dispatch must keep diagnostic error_message');

    const attOffline = await pool.query(`SELECT status, error_message FROM execution_attempts WHERE healing_action_id = $1`, [offlineAct.id]);
    assert.strictEqual(attOffline.rows[0].status, 'FAILED');
  });

  test('A3: End-to-end lifecycle CREATE -> PENDING -> APPROVE -> DISPATCH -> RUNNING -> AGENT RESULT -> RECOVERY VERIFICATION -> COMPLETED (and failure cases)', async () => {
    const devopsJwt = signJwt(USERS.devopsA, 'cp9.devops.a@test.local');
    const { ws, messages } = await connectAgentWs(wsBaseUrl, 'cp9-uid-a1', RAW_A1);

    try {
      // Case 1: Full happy path -> COMPLETED only AFTER recovery verification passes
      const createRes = await fetch(`${baseUrl}/api/v1/healing/actions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${devopsJwt}`,
          'Content-Type': 'application/json',
          'x-organization-id': ORG_A,
        },
        body: JSON.stringify({
          incident_id: INC_A,
          environment_id: ENV_A,
          action_type_id: ACT_TYPE_HIGH,
          target_name: 'cp9-happy-svc',
          risk_level: 'HIGH',
        }),
      });
      assert.strictEqual(createRes.status, 201);
      const created = (await createRes.json()).data;
      assert.strictEqual(created.approval_status, 'PENDING');
      assert.strictEqual(created.execution_status, 'PENDING');

      // Approve triggers dispatch -> RUNNING
      const approvePromise = fetch(`${baseUrl}/api/v1/healing/actions/${created.id}/approve`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${devopsJwt}`,
          'Content-Type': 'application/json',
          'x-organization-id': ORG_A,
        },
        body: JSON.stringify({ reason: 'E2E happy path approval' }),
      });

      // Wait for Agent to receive execute_action
      await new Promise<void>((resolve, reject) => {
        const deadline = setTimeout(() => reject(new Error('Agent did not receive execute_action')), 5000);
        const poll = setInterval(() => {
          const cmd = messages.find((m) => m.type === 'execute_action' && m.data?.action_id === created.id);
          if (cmd) {
            clearTimeout(deadline);
            clearInterval(poll);
            resolve();
          }
        }, 30);
      });

      // Duplicate dispatch must be rejected with 409 while RUNNING
      const dupExecRes = await fetch(`${baseUrl}/api/v1/healing/actions/${created.id}/execute`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${devopsJwt}`, 'x-organization-id': ORG_A },
      });
      assert.strictEqual(dupExecRes.status, 409);

      // Agent sends COMPLETED action_result
      ws.send(JSON.stringify({
        type: 'action_result',
        data: { action_id: created.id, status: 'COMPLETED', message: 'Pod restarted successfully', duration_ms: 420 },
      }));

      await approvePromise;

      // Immediately after Agent action_result, BEFORE recovery verification: action MUST still be RUNNING (NOT COMPLETED!)
      const beforeRv = await pool.query(`SELECT execution_status, result FROM healing_actions WHERE id = $1`, [created.id]);
      assert.strictEqual(beforeRv.rows[0].execution_status, 'RUNNING', 'Must NOT persist COMPLETED before recovery verification');
      assert.strictEqual(beforeRv.rows[0].result?.agent_status, 'COMPLETED');

      const attAfterAgent = await pool.query(`SELECT status FROM execution_attempts WHERE healing_action_id = $1`, [created.id]);
      assert.strictEqual(attAfterAgent.rows[0].status, 'COMPLETED');

      // Duplicate Agent result must be ignored without creating a second completed attempt
      ws.send(JSON.stringify({
        type: 'action_result',
        data: { action_id: created.id, status: 'COMPLETED', message: 'Duplicate callback', duration_ms: 500 },
      }));
      await new Promise((r) => setTimeout(r, 120));
      const attCountDup = await pool.query(`SELECT count(*) FROM execution_attempts WHERE healing_action_id = $1`, [created.id]);
      assert.strictEqual(Number(attCountDup.rows[0].count), 1, 'Duplicate agent action_result must not create extra attempts');

      // Now run actual RecoveryVerificationService with healthy ascending post-action samples -> COMPLETED!
      const baseMs = Date.now() - 1000;
      const healthySeq = Array.from({ length: 6 }, (_, idx) => ({
        cpu: 25,
        ram: 40,
        disk: 30,
        latency: 55,
        http_5xx_rate: 0,
        request_rate: 40,
        collected_at: new Date(baseMs + (idx + 1) * 5000),
        http_health_check: true,
        is_healthy: true,
      }));
      const rvOk = await RecoveryVerificationService.evaluateAdaptiveRecovery('cp9-happy-svc', CLUSTER_A, healthySeq, {
        actionId: created.id,
        severity: 'MEDIUM',
        cooldownSeconds: 0,
      });
      assert.strictEqual(rvOk.verified, true);

      const afterRv = await pool.query(`SELECT execution_status FROM healing_actions WHERE id = $1`, [created.id]);
      assert.strictEqual(afterRv.rows[0].execution_status, 'COMPLETED');
      const rvRows = await pool.query(`SELECT verification_result FROM recovery_verifications WHERE healing_action_id = $1`, [created.id]);
      assert.strictEqual(rvRows.rows[0].verification_result, true);

      // Case 2: Recovery verification FAILS after Agent success -> FAILED (never COMPLETED)
      const rvFailAct = await HealingActionModel.createAction({
        incident_id: INC_A,
        environment_id: ENV_A,
        action_type_id: ACT_TYPE_HIGH,
        target_name: 'cp9-rv-fail-svc',
        risk_level: 'HIGH',
      });
      await HealingActionModel.approveAction(rvFailAct.id, USERS.devopsA, 'Test RV failure');
      await HealingActionModel.executeAction(rvFailAct.id, USERS.devopsA);
      ws.send(JSON.stringify({
        type: 'action_result',
        data: { action_id: rvFailAct.id, status: 'COMPLETED', message: 'Command exited 0', duration_ms: 200 },
      }));
      await new Promise((r) => setTimeout(r, 120));

      const unhealthySeq = Array.from({ length: 6 }, (_, idx) => ({
        cpu: 98,
        ram: 96,
        disk: 30,
        latency: 950,
        http_5xx_rate: 35,
        request_rate: 20,
        collected_at: new Date(Date.now() + (idx + 1) * 5000),
        http_health_check: false,
        is_healthy: false,
      }));
      const rvBad = await RecoveryVerificationService.evaluateAdaptiveRecovery('cp9-rv-fail-svc', CLUSTER_A, unhealthySeq, {
        actionId: rvFailAct.id,
        severity: 'MEDIUM',
        cooldownSeconds: 0,
      });
      assert.strictEqual(rvBad.verified, false);
      const afterRvFail = await pool.query(`SELECT execution_status FROM healing_actions WHERE id = $1`, [rvFailAct.id]);
      assert.strictEqual(afterRvFail.rows[0].execution_status, 'FAILED', 'Failed recovery verification must mark action FAILED');

      // Case 3: Agent returns FAILED -> FAILED
      const agentFailAct = await HealingActionModel.createAction({
        incident_id: INC_A,
        environment_id: ENV_A,
        action_type_id: ACT_TYPE_HIGH,
        target_name: 'cp9-agent-fail-svc',
        risk_level: 'HIGH',
      });
      await HealingActionModel.approveAction(agentFailAct.id, USERS.devopsA, 'Test agent fail');
      await HealingActionModel.executeAction(agentFailAct.id, USERS.devopsA);
      ws.send(JSON.stringify({
        type: 'action_result',
        data: { action_id: agentFailAct.id, status: 'FAILED', message: 'K8s RBAC forbidden', duration_ms: 150 },
      }));
      await new Promise((r) => setTimeout(r, 120));
      const dbAgentFail = await pool.query(`SELECT execution_status, error_message FROM healing_actions WHERE id = $1`, [agentFailAct.id]);
      assert.strictEqual(dbAgentFail.rows[0].execution_status, 'FAILED');
      assert.ok(dbAgentFail.rows[0].error_message?.includes('K8s RBAC forbidden'));

      // Case 4: Invalid/unknown execution status rejected + COMPLETED without evidence rejected
      const badStatusRes = await fetch(`${baseUrl}/api/v1/healing/actions/${agentFailAct.id}/status`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${devopsJwt}`,
          'Content-Type': 'application/json',
          'x-organization-id': ORG_A,
        },
        body: JSON.stringify({ status: 'BOGUS_UNKNOWN_STATUS' }),
      });
      assert.strictEqual(badStatusRes.status, 400);

      const fakeCompleteRes = await fetch(`${baseUrl}/api/v1/healing/actions/${agentFailAct.id}/status`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${devopsJwt}`,
          'Content-Type': 'application/json',
          'x-organization-id': ORG_A,
        },
        body: JSON.stringify({ status: 'COMPLETED' }),
      });
      assert.strictEqual(fakeCompleteRes.status, 409);
    } finally {
      ws.close();
    }
  });

  // =========================================================================
  // SECTION B & C: ATOMIC APPROVAL/REJECTION & EXPIRATION
  // =========================================================================
  test('B1/C1: Atomic approve/reject concurrency & state guards + strict expires_at enforcement', async () => {
    const devopsJwt = signJwt(USERS.devopsA, 'cp9.devops.a@test.local');

    // Concurrent approvals (5 parallel) -> strictly 1 succeeds, 4 fail 409
    const concAct = await HealingActionModel.createAction({
      incident_id: INC_A,
      environment_id: ENV_A,
      action_type_id: ACT_TYPE_HIGH,
      target_name: 'cp9-conc-approve',
      risk_level: 'HIGH',
    });
    const concRes = await Promise.allSettled(
      Array.from({ length: 5 }, () => HealingActionModel.approveAction(concAct.id, USERS.devopsA, 'Concurrent'))
    );
    assert.strictEqual(concRes.filter((r) => r.status === 'fulfilled').length, 1);
    assert.strictEqual(concRes.filter((r) => r.status === 'rejected').length, 4);

    // Rejecting already-approved action must fail with 409
    await assert.rejects(
      () => HealingActionModel.rejectAction(concAct.id, USERS.devopsA, 'Late reject'),
      (e: any) => e.statusCode === 409
    );

    // Concurrent approve + reject -> strictly 1 succeeds
    const raceAct = await HealingActionModel.createAction({
      incident_id: INC_A,
      environment_id: ENV_A,
      action_type_id: ACT_TYPE_HIGH,
      target_name: 'cp9-race-approve-reject',
      risk_level: 'HIGH',
    });
    const raceRes = await Promise.allSettled([
      HealingActionModel.approveAction(raceAct.id, USERS.devopsA, 'Win A'),
      HealingActionModel.rejectAction(raceAct.id, USERS.devopsA, 'Win R'),
    ]);
    assert.strictEqual(raceRes.filter((r) => r.status === 'fulfilled').length, 1);
    assert.strictEqual(raceRes.filter((r) => r.status === 'rejected').length, 1);

    // Approving rejected or cancelled action must fail 409
    const rejAct = await HealingActionModel.createAction({
      incident_id: INC_A,
      environment_id: ENV_A,
      action_type_id: ACT_TYPE_HIGH,
      target_name: 'cp9-rejected-target',
      risk_level: 'HIGH',
    });
    await HealingActionModel.rejectAction(rejAct.id, USERS.devopsA, 'Rejected first');
    await assert.rejects(
      () => HealingActionModel.approveAction(rejAct.id, USERS.devopsA, 'Re-approve blocked'),
      (e: any) => e.statusCode === 409
    );
    const dbRej = await pool.query(`SELECT approval_status, execution_status FROM healing_actions WHERE id = $1`, [rejAct.id]);
    assert.strictEqual(dbRej.rows[0].approval_status, 'REJECTED');
    assert.strictEqual(dbRej.rows[0].execution_status, 'CANCELLED');

    // Expiration before approval (boundary: expires_at = NOW() - interval '1 millisecond')
    const expAct = await HealingActionModel.createAction({
      incident_id: INC_A,
      environment_id: ENV_A,
      action_type_id: ACT_TYPE_HIGH,
      target_name: 'cp9-expired-approve',
      risk_level: 'HIGH',
    });
    await pool.query(`UPDATE approvals SET expires_at = NOW() - interval '1 millisecond' WHERE healing_action_id = $1`, [expAct.id]);
    const expApi = await fetch(`${baseUrl}/api/v1/healing/actions/${expAct.id}/approve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${devopsJwt}`, 'Content-Type': 'application/json', 'x-organization-id': ORG_A },
      body: JSON.stringify({}),
    });
    assert.strictEqual(expApi.status, 409);
    const dbExp = await pool.query(`SELECT approval_status, execution_status FROM healing_actions WHERE id = $1`, [expAct.id]);
    assert.strictEqual(dbExp.rows[0].approval_status, 'EXPIRED');
    assert.strictEqual(dbExp.rows[0].execution_status, 'CANCELLED');

    // Dispatch blocked when approved action's approval expires before dispatch
    const expExecAct = await HealingActionModel.createAction({
      incident_id: INC_A,
      environment_id: ENV_A,
      action_type_id: ACT_TYPE_HIGH,
      target_name: 'cp9-expired-dispatch',
      risk_level: 'HIGH',
    });
    await HealingActionModel.approveAction(expExecAct.id, USERS.devopsA, 'Approved on time');
    await pool.query(`UPDATE approvals SET expires_at = NOW() - interval '1 second' WHERE healing_action_id = $1`, [expExecAct.id]);
    await assert.rejects(
      () => HealingActionService.executeAction(expExecAct.id, USERS.devopsA),
      (e: any) => e.statusCode === 409
    );
    const dbExpExec = await pool.query(`SELECT approval_status, execution_status FROM healing_actions WHERE id = $1`, [expExecAct.id]);
    assert.strictEqual(dbExpExec.rows[0].approval_status, 'EXPIRED');
    assert.strictEqual(dbExpExec.rows[0].execution_status, 'CANCELLED');
  });

  // =========================================================================
  // SECTION D: TENANT ISOLATION & STRICT SUPER_ADMIN MEMBERSHIP
  // =========================================================================
  test('D1: SUPER_ADMIN/SYSTEM_ADMIN/ADMIN require active org membership and cross-tenant access is 403', async () => {
    const targetAct = await HealingActionModel.createAction({
      incident_id: INC_A,
      environment_id: ENV_A,
      action_type_id: ACT_TYPE_HIGH,
      target_name: 'cp9-tenant-target',
      risk_level: 'HIGH',
    });

    const tokens = {
      superMemberA: signJwt(USERS.superMemberA, 'cp9.super.a@test.local', ['SUPER_ADMIN']),
      superNoOrg: signJwt(USERS.superNoOrg, 'cp9.super.noorg@test.local', ['SUPER_ADMIN']),
      superInactiveA: signJwt(USERS.superInactiveA, 'cp9.super.inactive@test.local', ['SUPER_ADMIN']),
      sysAdminNoOrg: signJwt(USERS.systemAdminNoOrg, 'cp9.sysadmin.noorg@test.local', ['SYSTEM_ADMIN']),
      adminB: signJwt(USERS.adminB, 'cp9.admin.b@test.local', ['USER']),
      viewerA: signJwt(USERS.viewerA, 'cp9.viewer.a@test.local', ['USER']),
    };

    // SUPER_ADMIN without membership -> 403
    const rNoOrg = await fetch(`${baseUrl}/api/v1/healing/actions/${targetAct.id}/approve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokens.superNoOrg}`, 'x-organization-id': ORG_A, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert.strictEqual(rNoOrg.status, 403);

    // SUPER_ADMIN with INACTIVE membership -> 403
    const rInactive = await fetch(`${baseUrl}/api/v1/healing/actions/${targetAct.id}/approve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokens.superInactiveA}`, 'x-organization-id': ORG_A, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert.strictEqual(rInactive.status, 403);

    // SYSTEM_ADMIN without membership -> 403
    const rSysAdmin = await fetch(`${baseUrl}/api/v1/healing/actions/${targetAct.id}/approve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokens.sysAdminNoOrg}`, 'x-organization-id': ORG_A, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert.strictEqual(rSysAdmin.status, 403);

    // ADMIN from Org B (passing Org B header to touch Org A action OR Org A header) -> 403
    const rCrossAdmin = await fetch(`${baseUrl}/api/v1/healing/actions/${targetAct.id}/approve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokens.adminB}`, 'x-organization-id': ORG_B, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert.strictEqual(rCrossAdmin.status, 403);

    // VIEWER in Org A -> 403
    const rViewer = await fetch(`${baseUrl}/api/v1/healing/actions/${targetAct.id}/approve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokens.viewerA}`, 'x-organization-id': ORG_A, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert.strictEqual(rViewer.status, 403);

    // Missing organization_id -> 400 / 403
    const rMissingOrg = await fetch(`${baseUrl}/api/v1/healing/actions?cluster_id=${CLUSTER_A}`, {
      headers: { Authorization: `Bearer ${tokens.superMemberA}` },
    });
    assert.ok(rMissingOrg.status === 400 || rMissingOrg.status === 403);

    // User accessing another org's cluster/environment on create -> 403
    const rCrossCreate = await fetch(`${baseUrl}/api/v1/healing/actions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokens.adminB}`, 'x-organization-id': ORG_B, 'Content-Type': 'application/json' },
      body: JSON.stringify({ incident_id: INC_A, environment_id: ENV_A, action_type_id: ACT_TYPE_HIGH }),
    });
    assert.strictEqual(rCrossCreate.status, 403);

    // SUPER_ADMIN WITH active Org A DEVOPS membership -> allowed (200)
    const rSuperOk = await fetch(`${baseUrl}/api/v1/healing/actions/${targetAct.id}/approve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokens.superMemberA}`, 'x-organization-id': ORG_A, 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Active member super admin approved' }),
    });
    assert.strictEqual(rSuperOk.status, 200);
  });

  // =========================================================================
  // SECTION E: QUICK APPROVE / QUICK REJECT TOKEN SECURITY
  // =========================================================================
  test('E1: Quick Approve / Reject enforces actionId, orgId, expiry, membership, single-use & concurrency', async () => {
    const qaAct = await HealingActionModel.createAction({
      incident_id: INC_A,
      environment_id: ENV_A,
      action_type_id: ACT_TYPE_HIGH,
      target_name: 'cp9-quick-target',
      risk_level: 'HIGH',
    });
    const otherAct = await HealingActionModel.createAction({
      incident_id: INC_A,
      environment_id: ENV_A,
      action_type_id: ACT_TYPE_HIGH,
      target_name: 'cp9-quick-other',
      risk_level: 'HIGH',
    });
    const apRows = await pool.query(`SELECT id FROM approvals WHERE healing_action_id = $1`, [qaAct.id]);
    const approvalId = apRows.rows[0].id;

    // 1. Token for DIFFERENT actionId -> 403
    const wrongActionTok = HitlNotificationService.generateApprovalToken(approvalId, otherAct.id, USERS.devopsA, ORG_A);
    const wrongActRes = await HitlNotificationService.processQuickApprove(wrongActionTok);
    assert.strictEqual(wrongActRes.statusCode, 403);

    // 2. Token for DIFFERENT orgId -> 403
    const wrongOrgTok = HitlNotificationService.generateApprovalToken(approvalId, qaAct.id, USERS.devopsA, ORG_B);
    const wrongOrgRes = await HitlNotificationService.processQuickApprove(wrongOrgTok);
    assert.strictEqual(wrongOrgRes.statusCode, 403);

    // 3. SUPER_ADMIN without active membership in quick-approve AND quick-reject -> 403
    const noMemberApproveTok = HitlNotificationService.generateApprovalToken(approvalId, qaAct.id, USERS.superNoOrg, ORG_A);
    const noMemberApproveRes = await HitlNotificationService.processQuickApprove(noMemberApproveTok);
    assert.strictEqual(noMemberApproveRes.statusCode, 403);
    const noMemberRejectRes = await HitlNotificationService.processQuickReject(noMemberApproveTok);
    assert.strictEqual(noMemberRejectRes.statusCode, 403);

    // 4. Valid token concurrent consumption -> strictly 1 succeeds (200), others 409
    const validTok = await HitlNotificationService.issueApprovalEmailToken(approvalId, qaAct.id, USERS.devopsA, ORG_A);
    const qaConc = await Promise.all([
      HitlNotificationService.processQuickApprove(validTok),
      HitlNotificationService.processQuickApprove(validTok),
      HitlNotificationService.processQuickApprove(validTok),
    ]);
    assert.strictEqual(qaConc.filter((r) => r.statusCode === 200 && r.success).length, 1);
    assert.strictEqual(qaConc.filter((r) => !r.success && r.statusCode === 409).length, 2);

    // 5. Replayed token -> 409 (single-use)
    const replayRes = await HitlNotificationService.processQuickApprove(validTok);
    assert.strictEqual(replayRes.success, false);
    assert.strictEqual(replayRes.statusCode, 409);

    // 6. Quick approve after expiration -> 409/410
    const expQaAct = await HealingActionModel.createAction({
      incident_id: INC_A,
      environment_id: ENV_A,
      action_type_id: ACT_TYPE_HIGH,
      target_name: 'cp9-quick-expired',
      risk_level: 'HIGH',
    });
    const expApId = (await pool.query(`SELECT id FROM approvals WHERE healing_action_id = $1`, [expQaAct.id])).rows[0].id;
    await pool.query(`UPDATE approvals SET expires_at = NOW() - interval '5 seconds' WHERE id = $1`, [expApId]);
    const expTok = await HitlNotificationService.issueApprovalEmailToken(expApId, expQaAct.id, USERS.devopsA, ORG_A);
    const expQaRes = await HitlNotificationService.processQuickApprove(expTok);
    assert.strictEqual(expQaRes.success, false);
    assert.ok(expQaRes.statusCode === 409 || expQaRes.statusCode === 410);

    // 7. Quick reject: wrong action, valid reject, and replay blocked
    const qrAct = await HealingActionModel.createAction({
      incident_id: INC_A,
      environment_id: ENV_A,
      action_type_id: ACT_TYPE_HIGH,
      target_name: 'cp9-quick-reject-target',
      risk_level: 'HIGH',
    });
    const qrApId = (await pool.query(`SELECT id FROM approvals WHERE healing_action_id = $1`, [qrAct.id])).rows[0].id;
    const wrongQrTok = HitlNotificationService.generateApprovalToken(qrApId, otherAct.id, USERS.devopsA, ORG_A);
    assert.strictEqual((await HitlNotificationService.processQuickReject(wrongQrTok)).statusCode, 403);

    const validQrTok = await HitlNotificationService.issueApprovalEmailToken(qrApId, qrAct.id, USERS.devopsA, ORG_A);
    const qrOk = await HitlNotificationService.processQuickReject(validQrTok);
    assert.strictEqual(qrOk.statusCode, 200);
    assert.strictEqual(qrOk.success, true);

    const qrReplay = await HitlNotificationService.processQuickReject(validQrTok);
    assert.strictEqual(qrReplay.success, false);
    assert.strictEqual(qrReplay.statusCode, 409);

    // Boundary expires_at = NOW() and expired during concurrent approvals
    const boundaryAct = await HealingActionModel.createAction({
      incident_id: INC_A,
      environment_id: ENV_A,
      action_type_id: ACT_TYPE_HIGH,
      target_name: 'cp9-boundary-exp',
      risk_level: 'HIGH',
    });
    await pool.query(`UPDATE approvals SET expires_at = NOW() WHERE healing_action_id = $1`, [boundaryAct.id]);
    const boundConc = await Promise.allSettled(
      Array.from({ length: 3 }, () => HealingActionModel.approveAction(boundaryAct.id, USERS.devopsA, 'Boundary'))
    );
    assert.strictEqual(boundConc.filter((r) => r.status === 'fulfilled').length, 0);
    assert.strictEqual(boundConc.filter((r) => r.status === 'rejected').length, 3);

    // Dispatch timeout watchdog test (Agent never responds)
    const { ws: timeoutWs } = await connectAgentWs(wsBaseUrl, 'cp9-uid-a1', RAW_A1);
    try {
      const toAct = await HealingActionModel.createAction({
        incident_id: INC_A,
        environment_id: ENV_A,
        action_type_id: ACT_TYPE_HIGH,
        target_name: 'cp9-timeout-svc',
        risk_level: 'HIGH',
      });
      await HealingActionModel.approveAction(toAct.id, USERS.devopsA, 'Timeout test');
      await HealingActionService.executeAction(toAct.id, USERS.devopsA, undefined, undefined, { timeoutMs: 120 });
      await new Promise((r) => setTimeout(r, 250));
      const toDb = await pool.query(`SELECT execution_status, error_message FROM healing_actions WHERE id = $1`, [toAct.id]);
      assert.strictEqual(toDb.rows[0].execution_status, 'FAILED');
      assert.ok(toDb.rows[0].error_message?.toLowerCase().includes('timeout') || toDb.rows[0].error_message?.includes('thời gian chờ'));
      const toAtt = await pool.query(`SELECT status, error_message FROM execution_attempts WHERE healing_action_id = $1`, [toAct.id]);
      assert.strictEqual(toAtt.rows[0].status, 'FAILED');
    } finally {
      timeoutWs.close();
    }
  });

  // =========================================================================
  // SECTION F: STRICT AGENT ROUTING (NO FALLBACK)
  // =========================================================================
  test('F1: dispatchHealingActionToAgent routes strictly by environment_id + cluster_id with zero fallback', async () => {
    const a1 = await connectAgentWs(wsBaseUrl, 'cp9-uid-a1', RAW_A1);
    const a2 = await connectAgentWs(wsBaseUrl, 'cp9-uid-a2', RAW_A2);
    const b1 = await connectAgentWs(wsBaseUrl, 'cp9-uid-b1', RAW_B1);

    try {
      // Missing cluster or missing environment -> refused safely (no fallback to first socket!)
      const missCluster = await dispatchHealingActionToAgent({
        action_id: '00000000-0000-4000-8000-000000000091',
        action_type: 'RESTART_POD',
        target_name: 'svc',
        environment_id: ENV_A,
      });
      assert.strictEqual(missCluster.dispatched, false);

      const missEnv = await dispatchHealingActionToAgent({
        action_id: '00000000-0000-4000-8000-000000000092',
        action_type: 'RESTART_POD',
        target_name: 'svc',
        cluster_id: CLUSTER_A,
      });
      assert.strictEqual(missEnv.dispatched, false);

      // Mismatched cluster + env -> refused safely
      const crossEnvCluster = await dispatchHealingActionToAgent({
        action_id: '00000000-0000-4000-8000-000000000093',
        action_type: 'RESTART_POD',
        target_name: 'svc',
        cluster_id: CLUSTER_B,
        environment_id: ENV_A,
      });
      assert.strictEqual(crossEnvCluster.dispatched, false);

      // Exact cluster A2 + env A2 -> ONLY Agent A2 receives execute_action!
      const okA2 = await dispatchHealingActionToAgent({
        action_id: '00000000-0000-4000-8000-000000000094',
        action_type: 'RESTART_POD',
        target_name: 'svc-a2',
        cluster_id: CLUSTER_A2,
        environment_id: ENV_A2,
      });
      assert.strictEqual(okA2.dispatched, true);
      assert.strictEqual(okA2.recipient_agent, 'cp9-agent-a2');

      await new Promise((r) => setTimeout(r, 80));
      assert.ok(a2.messages.some((m) => m.data?.action_id === '00000000-0000-4000-8000-000000000094'));
      assert.strictEqual(a1.messages.some((m) => m.data?.action_id === '00000000-0000-4000-8000-000000000094'), false);
      assert.strictEqual(b1.messages.some((m) => m.data?.action_id === '00000000-0000-4000-8000-000000000094'), false);

      // Disconnected agent socket cannot receive
      a2.ws.close();
      await new Promise((r) => setTimeout(r, 80));
      const afterClose = await dispatchHealingActionToAgent({
        action_id: '00000000-0000-4000-8000-000000000095',
        action_type: 'RESTART_POD',
        target_name: 'svc-a2',
        cluster_id: CLUSTER_A2,
        environment_id: ENV_A2,
      });
      assert.strictEqual(afterClose.dispatched, false);
    } finally {
      a1.ws.close();
      a2.ws.close();
      b1.ws.close();
    }
  });

  // =========================================================================
  // SECTION G: HTTP CONCURRENCY ON /approve & /abort SUPER_ADMIN ISOLATION
  // =========================================================================
  test('G1: HTTP concurrent approvals allow strictly 1 success, abort enforces SUPER_ADMIN active membership', async () => {
    const devopsJwt = signJwt(USERS.devopsA, 'cp9.devops.a@test.local');
    const superNoOrgJwt = signJwt(USERS.superNoOrg, 'cp9.super.noorg@test.local', ['SUPER_ADMIN']);

    const httpConcAct = await HealingActionModel.createAction({
      incident_id: INC_A,
      environment_id: ENV_A,
      action_type_id: ACT_TYPE_HIGH,
      target_name: 'cp9-http-conc',
      risk_level: 'HIGH',
    });

    const httpResults = await Promise.all(
      Array.from({ length: 5 }, () =>
        fetch(`${baseUrl}/api/v1/healing/actions/${httpConcAct.id}/approve`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${devopsJwt}`,
            'Content-Type': 'application/json',
            'x-organization-id': ORG_A,
          },
          body: JSON.stringify({ reason: 'HTTP race' }),
        })
      )
    );
    const statuses = httpResults.map((r) => r.status);
    assert.strictEqual(statuses.filter((s) => s === 200).length, 1, `Expected 1x200, got ${statuses.join(',')}`);
    assert.strictEqual(statuses.filter((s) => s === 409).length, 4, `Expected 4x409, got ${statuses.join(',')}`);

    const abortTarget = await HealingActionModel.createAction({
      incident_id: INC_A,
      environment_id: ENV_A,
      action_type_id: ACT_TYPE_HIGH,
      target_name: 'cp9-abort-target',
      risk_level: 'HIGH',
    });
    const abortNoOrg = await fetch(`${baseUrl}/api/v1/healing/actions/${abortTarget.id}/abort`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${superNoOrgJwt}`,
        'Content-Type': 'application/json',
        'x-organization-id': ORG_A,
      },
      body: JSON.stringify({ reason: 'No membership' }),
    });
    assert.strictEqual(abortNoOrg.status, 403);
  });
});
