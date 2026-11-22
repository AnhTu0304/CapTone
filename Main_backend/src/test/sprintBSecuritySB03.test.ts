import test, { describe, before, after } from 'node:test';
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
import { initAgentWebSocket } from '../websocket/agentWebSocket';
import { HealingActionModel } from '../models/healingAction.model';
import { AgentModel } from '../models/agent.model';

const ORG_A = 'c5c50000-0000-4000-8000-000000000001';
const ORG_B = 'c5c50000-0000-4000-8000-000000000002';
const ENV_A = 'c5c50000-0000-4000-8000-000000000011';
const ENV_B = 'c5c50000-0000-4000-8000-000000000012';
const CLUSTER_A = 'c5c50000-0000-4000-8000-000000000021';
const CLUSTER_B = 'c5c50000-0000-4000-8000-000000000022';
const INC_A = 'c5c50000-0000-4000-8000-000000000031';
const INC_B = 'c5c50000-0000-4000-8000-000000000032';
const INC_REC_A = 'c5c50000-0000-4000-8000-000000000034';
const RCA_A = 'c5c50000-0000-4000-8000-000000000033';
const REC_HIGH_A = 'c5c50000-0000-4000-8000-000000000035';
const ACT_PENDING_APPROVAL = 'c5c50000-0000-4000-8000-000000000041';
const ACT_APPROVED = 'c5c50000-0000-4000-8000-000000000042';
const ACT_ORG_B = 'c5c50000-0000-4000-8000-000000000043';
const ACT_REJECTED = 'c5c50000-0000-4000-8000-000000000044';
const ACT_CANCELLED = 'c5c50000-0000-4000-8000-000000000045';
const ACT_CONCURRENT = 'c5c50000-0000-4000-8000-000000000046';
const ACT_TYPE_SB03 = 'c5c50000-0000-4000-8000-000000000051';
const AGENT_A = 'c5c50000-0000-4000-8000-000000000061';
const TOKEN_A_ID = 'c5c50000-0000-4000-8000-000000000071';
const USER_DEVOPS_A = 'c5c50000-0000-4000-8000-000000000101';

const RAW_AGENT_TOKEN = 'sb03_agent_secret_token_998877665544';
const HASHED_AGENT_TOKEN = crypto.createHash('sha256').update(RAW_AGENT_TOKEN).digest('hex');

function signJwt(id: string, email: string) {
  return jwt.sign({ id, email, status: 'ACTIVE', roles: ['USER'] }, config.jwt.secret, {
    algorithm: 'HS256',
    expiresIn: '1h',
  });
}

describe('Sprint B SB-03: HITL Approval Gate, Token Hash & Agent WS Isolation', () => {
  let server: http.Server;
  let agentWss: ReturnType<typeof initAgentWebSocket>;
  let baseUrl: string;
  let wsBaseUrl: string;

  before(async () => {
    const dbCheck = await pool.query('SELECT current_database() AS db');
    if (dbCheck.rows[0]?.db !== 'aiselfhealing_test') {
      throw new Error(`SAFETY ABORT: Wrong database '${dbCheck.rows[0]?.db}'`);
    }

    await pool.query(
      `INSERT INTO users (id, email, password_hash, full_name, status)
       VALUES ($1, 'sb03.devops.a@test.local', 'hash', 'SB03 DevOps A', 'ACTIVE')
       ON CONFLICT (id) DO UPDATE SET status = 'ACTIVE', deleted_at = NULL;`,
      [USER_DEVOPS_A]
    );

    await pool.query(
      `INSERT INTO organizations (id, name, slug, status)
       VALUES ($1, 'SB03 Org A', 'sb03-org-a', 'ACTIVE'), ($2, 'SB03 Org B', 'sb03-org-b', 'ACTIVE')
       ON CONFLICT (id) DO NOTHING;`,
      [ORG_A, ORG_B]
    );

    const roleRes = await pool.query(`SELECT id FROM organization_roles WHERE code = 'DEVOPS' LIMIT 1`);
    const devopsRoleId = roleRes.rows[0]?.id;
    assert.ok(devopsRoleId);

    await pool.query(
      `INSERT INTO organization_members (organization_id, user_id, role_id, status)
       VALUES ($1, $2, $3, 'ACTIVE') ON CONFLICT DO NOTHING;`,
      [ORG_A, USER_DEVOPS_A, devopsRoleId]
    );

    await pool.query(
      `INSERT INTO environments (id, organization_id, name, status)
       VALUES ($1, $3, 'SB03 Env A', 'ACTIVE'), ($2, $4, 'SB03 Env B', 'ACTIVE')
       ON CONFLICT (id) DO NOTHING;`,
      [ENV_A, ENV_B, ORG_A, ORG_B]
    );

    await pool.query(
      `INSERT INTO clusters (id, environment_id, name, status)
       VALUES ($1, $3, 'sb03-cluster-a', 'CONNECTED'), ($2, $4, 'sb03-cluster-b', 'CONNECTED')
       ON CONFLICT (id) DO NOTHING;`,
      [CLUSTER_A, CLUSTER_B, ENV_A, ENV_B]
    );

    await pool.query(
      `INSERT INTO agents (id, name, agent_uid, cluster_id, environment_id, status)
       VALUES ($1, 'sb03-agent-a', 'sb03-uid-a', $2, $3, 'ONLINE')
       ON CONFLICT (id) DO NOTHING;`,
      [AGENT_A, CLUSTER_A, ENV_A]
    );

    await pool.query(
      `INSERT INTO agent_tokens (id, agent_id, token_hash, token_prefix)
       VALUES ($1, $2, $3, 'sb03_')
       ON CONFLICT (id) DO UPDATE SET token_hash = $3, revoked_at = NULL;`,
      [TOKEN_A_ID, AGENT_A, HASHED_AGENT_TOKEN]
    );

    await pool.query(
      `INSERT INTO incidents (id, organization_id, environment_id, cluster_id, source_type, target_type, target_name, incident_type, title, severity, status)
       VALUES
         ($1, $4, $6, $8, 'AI_GRU', 'POD', 'orders-api', 'OOM', 'SB03 Incident A', 'HIGH', 'OPEN'),
         ($2, $5, $7, $9, 'AI_GRU', 'POD', 'payments-api', 'HIGH_CPU', 'SB03 Incident B', 'HIGH', 'OPEN'),
         ($3, $4, $6, $8, 'AI_GRU', 'NODE', 'worker-node-rec', 'NODE_PRESSURE', 'SB03 Incident Rec A', 'HIGH', 'OPEN')
       ON CONFLICT (id) DO NOTHING;`,
      [INC_A, INC_B, INC_REC_A, ORG_A, ORG_B, ENV_A, ENV_B, CLUSTER_A, CLUSTER_B]
    );

    await pool.query(
      `INSERT INTO healing_action_types (id, code, name, description, target_type, default_risk_level, requires_approval_by_default, enabled)
       VALUES ($1, 'SB03_HIGH_RISK_DRAIN', 'SB03 Drain Node', 'High risk action', 'NODE', 'HIGH', TRUE, TRUE)
       ON CONFLICT (id) DO NOTHING;`,
      [ACT_TYPE_SB03]
    );

    await pool.query(
      `INSERT INTO rca_analyses (id, incident_id, root_cause_type, root_cause_description, confidence_score)
       VALUES ($1, $2, 'NODE_PRESSURE', 'SB03 Test RCA', 0.90)
       ON CONFLICT (id) DO NOTHING;`,
      [RCA_A, INC_REC_A]
    );

    await pool.query(
      `INSERT INTO ai_recommendations (id, incident_id, rca_analysis_id, action_type_id, recommendation, reasoning, risk_level, status)
       VALUES ($1, $2, $3, $4, 'SB03_HIGH_RISK_DRAIN', 'SB03 test high-risk HITL check', 'HIGH', 'PENDING')
       ON CONFLICT (id) DO UPDATE SET status = 'PENDING';`,
      [REC_HIGH_A, INC_REC_A, RCA_A, ACT_TYPE_SB03]
    );

    await pool.query(
      `INSERT INTO healing_actions (id, incident_id, environment_id, action_type_id, target_type, target_name, risk_level, execution_mode, approval_status, execution_status)
       VALUES
         ($1, $7, $9, $11, 'NODE', 'node-a', 'HIGH', 'MANUAL', 'PENDING', 'PENDING'),
         ($2, $7, $9, $11, 'NODE', 'node-a-ok', 'LOW', 'MANUAL', 'APPROVED', 'PENDING'),
         ($3, $8, $10, $11, 'NODE', 'node-b', 'LOW', 'MANUAL', 'APPROVED', 'PENDING'),
         ($4, $7, $9, $11, 'NODE', 'node-a-rej', 'HIGH', 'MANUAL', 'REJECTED', 'PENDING'),
         ($5, $7, $9, $11, 'NODE', 'node-a-can', 'LOW', 'MANUAL', 'APPROVED', 'CANCELLED'),
         ($6, $7, $9, $11, 'NODE', 'node-a-conc', 'LOW', 'MANUAL', 'APPROVED', 'PENDING')
       ON CONFLICT (id) DO UPDATE SET approval_status = EXCLUDED.approval_status, execution_status = EXCLUDED.execution_status;`,
      [ACT_PENDING_APPROVAL, ACT_APPROVED, ACT_ORG_B, ACT_REJECTED, ACT_CANCELLED, ACT_CONCURRENT, INC_A, INC_B, ENV_A, ENV_B, ACT_TYPE_SB03]
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
    const dbCheck = await pool.query('SELECT current_database() AS db');
    if (dbCheck.rows[0]?.db === 'aiselfhealing_test') {
      const actionIds = [ACT_PENDING_APPROVAL, ACT_APPROVED, ACT_ORG_B, ACT_REJECTED, ACT_CANCELLED, ACT_CONCURRENT];
      await pool.query(`DELETE FROM approvals WHERE healing_action_id = ANY($1::uuid[]) OR healing_action_id IN (SELECT id FROM healing_actions WHERE incident_id IN ($2, $3))`, [actionIds, INC_A, INC_REC_A]);
      await pool.query(`DELETE FROM recovery_verifications WHERE healing_action_id = ANY($1::uuid[]) OR healing_action_id IN (SELECT id FROM healing_actions WHERE incident_id IN ($2, $3))`, [actionIds, INC_A, INC_REC_A]);
      await pool.query(`DELETE FROM execution_attempts WHERE healing_action_id = ANY($1::uuid[]) OR healing_action_id IN (SELECT id FROM healing_actions WHERE incident_id IN ($2, $3))`, [actionIds, INC_A, INC_REC_A]);
      await pool.query(`DELETE FROM healing_actions WHERE id = ANY($1::uuid[]) OR incident_id IN ($2, $3)`, [actionIds, INC_A, INC_REC_A]);
      await pool.query(`DELETE FROM ai_recommendations WHERE id = $1`, [REC_HIGH_A]);
      await pool.query(`DELETE FROM rca_analyses WHERE id = $1`, [RCA_A]);
      await pool.query(`DELETE FROM healing_action_types WHERE id = $1`, [ACT_TYPE_SB03]);
      await pool.query(`DELETE FROM incidents WHERE id IN ($1, $2, $3)`, [INC_A, INC_B, INC_REC_A]);
      await pool.query(`DELETE FROM agent_tokens WHERE id = $1`, [TOKEN_A_ID]);
      await pool.query(`DELETE FROM agents WHERE id = $1`, [AGENT_A]);
      await pool.query(`DELETE FROM clusters WHERE id IN ($1, $2)`, [CLUSTER_A, CLUSTER_B]);
      await pool.query(`DELETE FROM environments WHERE id IN ($1, $2)`, [ENV_A, ENV_B]);
      await pool.query(`DELETE FROM organization_members WHERE organization_id IN ($1, $2)`, [ORG_A, ORG_B]);
      await pool.query(`DELETE FROM organizations WHERE id IN ($1, $2)`, [ORG_A, ORG_B]);
      await pool.query(`DELETE FROM users WHERE id = $1`, [USER_DEVOPS_A]);
    }
    if (agentWss) agentWss.close();
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
    await closeRedis().catch(() => {});
    await pool.end().catch(() => {});
  });

  test('SB03-01: executeAction enforces atomic HITL approval transition and rejects PENDING, REJECTED, CANCELLED, and concurrent duplicates', async () => {
    await assert.rejects(
      () => HealingActionModel.executeAction(ACT_PENDING_APPROVAL, USER_DEVOPS_A),
      (err: any) => err.statusCode === 403
    );

    await assert.rejects(
      () => HealingActionModel.executeAction(ACT_REJECTED, USER_DEVOPS_A),
      (err: any) => err.statusCode === 403
    );

    await assert.rejects(
      () => HealingActionModel.executeAction(ACT_CANCELLED, USER_DEVOPS_A),
      (err: any) => err.statusCode === 409
    );

    const execOk = await HealingActionModel.executeAction(ACT_APPROVED, USER_DEVOPS_A);
    assert.ok(execOk);

    // Repeat execution must fail atomically with 409
    await assert.rejects(
      () => HealingActionModel.executeAction(ACT_APPROVED, USER_DEVOPS_A),
      (err: any) => err.statusCode === 409
    );

    // Concurrent execution requests on ACT_CONCURRENT: strictly 1 succeeds, 4 fail atomically
    const concurrentResults = await Promise.allSettled(
      Array.from({ length: 5 }, () => HealingActionModel.executeAction(ACT_CONCURRENT, USER_DEVOPS_A))
    );
    const fulfilled = concurrentResults.filter((r) => r.status === 'fulfilled');
    const rejected = concurrentResults.filter((r) => r.status === 'rejected');
    assert.strictEqual(fulfilled.length, 1, 'Only one concurrent execution may acquire atomic row lock');
    assert.strictEqual(rejected.length, 4);
  });

  test('SB03-01b: createAction keeps HIGH risk under AUTO mode in PENDING approval and allows valid LOW auto-policy enum', async () => {
    const highAuto = await HealingActionModel.createAction({
      incident_id: INC_A,
      environment_id: ENV_A,
      action_type_id: ACT_TYPE_SB03,
      target_type: 'POD',
      target_name: 'high-risk-pod',
      risk_level: 'HIGH',
      execution_mode: 'AUTO',
      requested_by: USER_DEVOPS_A,
    });
    assert.strictEqual(highAuto.approval_status, 'PENDING');
    assert.strictEqual(highAuto.execution_status, 'PENDING');

    const lowAuto = await HealingActionModel.createAction({
      incident_id: INC_A,
      environment_id: ENV_A,
      action_type_id: ACT_TYPE_SB03,
      target_type: 'POD',
      target_name: 'low-risk-pod',
      risk_level: 'LOW',
      execution_mode: 'AUTO',
      requires_approval: false,
      requested_by: USER_DEVOPS_A,
    } as any);
    assert.strictEqual(lowAuto.approval_status, 'APPROVED');
  });

  test('SB03-02: applyRecommendation on HIGH risk requires HITL gate (PENDING/PENDING, HTTP 202)', async () => {
    const token = signJwt(USER_DEVOPS_A, 'sb03.devops.a@test.local');
    const res = await fetch(`${baseUrl}/api/v1/ai/recommendations/${REC_HIGH_A}/apply`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'x-organization-id': ORG_A,
      },
      body: JSON.stringify({}),
    });
    assert.strictEqual(res.status, 202);
    const body = await res.json();
    assert.strictEqual(body.data.hitl_required, true);
    assert.strictEqual(body.data.healing_action.approval_status, 'PENDING');
    assert.strictEqual(body.data.healing_action.execution_status, 'PENDING');
  });

  test('SB03-03: AgentModel.findByTokenHash rejects raw-token fallback and only accepts SHA-256 hash', async () => {
    const fakeRawMatch = await AgentModel.findByTokenHash('wrong_hash_value', HASHED_AGENT_TOKEN);
    assert.strictEqual(fakeRawMatch, null);

    const validMatch = await AgentModel.findByTokenHash(HASHED_AGENT_TOKEN, RAW_AGENT_TOKEN);
    assert.ok(validMatch);
    assert.strictEqual(validMatch.id, AGENT_A);
  });

  test('SB03-04: agentWebSocket rejects re-auth (4003) and blocks cross-tenant action_result overwrite', async () => {
    const closeCode = await new Promise<number>((resolve, reject) => {
      const ws = new WebSocket(`${wsBaseUrl}/api/v1/agent/connect?token=${RAW_AGENT_TOKEN}`);
      const timer = setTimeout(() => {
        ws.close();
        reject(new Error('Agent WS timeout'));
      }, 4000);
      let step = 0;
      ws.on('message', (raw) => {
        const msg = JSON.parse(raw.toString());
        if (step === 0 && msg.status === 'authenticated') {
          step = 1;
          // Attempt cross-tenant action_result for Org B's action
          ws.send(JSON.stringify({
            type: 'action_result',
            data: { action_id: ACT_ORG_B, status: 'FAILED', message: 'Hijacked by Org A agent', duration_ms: 100 },
          }));
          // Attempt re-auth on same socket
          setTimeout(() => {
            ws.send(JSON.stringify({ type: 'auth', token: RAW_AGENT_TOKEN }));
          }, 100);
        }
      });
      ws.on('close', (code) => {
        clearTimeout(timer);
        resolve(code);
      });
    });

    assert.strictEqual(closeCode, 4003);

    const orgBAction = await pool.query(`SELECT execution_status FROM healing_actions WHERE id = $1`, [ACT_ORG_B]);
    assert.strictEqual(orgBAction.rows[0].execution_status, 'PENDING', 'Cross-tenant action_result must NOT modify Org B action');
  });

  test('SB03-05: Revoked agent token is rejected by AgentModel and closed with 4001 on WebSocket', async () => {
    await pool.query(`UPDATE agent_tokens SET revoked_at = NOW() WHERE id = $1`, [TOKEN_A_ID]);
    const matchAfterRevoke = await AgentModel.findByTokenHash(HASHED_AGENT_TOKEN, RAW_AGENT_TOKEN);
    assert.strictEqual(matchAfterRevoke, null);

    const closeCode = await new Promise<number>((resolve, reject) => {
      const ws = new WebSocket(`${wsBaseUrl}/api/v1/agent/connect?token=${RAW_AGENT_TOKEN}`);
      const timer = setTimeout(() => {
        ws.close();
        reject(new Error('Expected 4001 close timeout'));
      }, 3000);
      ws.on('unexpected-response', (_req, res) => {
        clearTimeout(timer);
        resolve(res.statusCode || 0);
      });
      ws.on('close', (code) => {
        clearTimeout(timer);
        resolve(code);
      });
      ws.on('error', () => {});
    });
    assert.strictEqual(closeCode, 4001);
  });
});
