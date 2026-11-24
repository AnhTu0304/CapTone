import test, { describe, before, after } from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import { AddressInfo } from 'node:net';
import jwt from 'jsonwebtoken';
import WebSocket from 'ws';
import app from '../app';
import { config } from '../config/env';
import { pool } from '../config/database';
import { closeRedis } from '../config/redis';
import { initTelemetryWebSocket, broadcastTelemetryToUi } from '../websocket/telemetryWebSocket';
import { HealingActionModel } from '../models/healingAction.model';
import { K8sStatusService } from '../services/k8sStatus.service';

const ORG_A = 'b5b50000-0000-4000-8000-000000000001';
const ORG_B = 'b5b50000-0000-4000-8000-000000000002';
const ENV_A = 'b5b50000-0000-4000-8000-000000000011';
const ENV_B = 'b5b50000-0000-4000-8000-000000000012';
const CLUSTER_A = 'b5b50000-0000-4000-8000-000000000021';
const CLUSTER_B = 'b5b50000-0000-4000-8000-000000000022';
const INC_A = 'b5b50000-0000-4000-8000-000000000031';
const INC_B = 'b5b50000-0000-4000-8000-000000000032';
const ACT_A = 'b5b50000-0000-4000-8000-000000000041';
const ACT_TYPE_SB01 = 'b5b50000-0000-4000-8000-000000000051';

const USERS = {
  superAdminNoOrg: 'b5b50000-0000-4000-8000-000000000101',
  superAdminMemberOrgA: 'b5b50000-0000-4000-8000-000000000102',
  viewerOrgA: 'b5b50000-0000-4000-8000-000000000103',
};

function signJwt(id: string, email: string, roles: string[] = ['USER']) {
  return jwt.sign({ id, email, status: 'ACTIVE', roles }, config.jwt.secret, {
    algorithm: 'HS256',
    expiresIn: '1h',
  });
}

describe('Sprint B SB-01: Canonical Status, SUPER_ADMIN Policy & K8sStatus Security', () => {
  let server: http.Server;
  let uiWss: ReturnType<typeof initTelemetryWebSocket>;
  let baseUrl: string;
  let wsBaseUrl: string;

  before(async () => {
    const dbCheck = await pool.query('SELECT current_database() AS db');
    if (dbCheck.rows[0]?.db !== 'aiselfhealing_test') {
      throw new Error(`SAFETY ABORT: Wrong database '${dbCheck.rows[0]?.db}'`);
    }

    await pool.query(
      `INSERT INTO users (id, email, password_hash, full_name, status)
       VALUES
         ($1, 'sb01.super.noorg@test.local', 'hash', 'SB01 Super NoOrg', 'ACTIVE'),
         ($2, 'sb01.super.orga@test.local', 'hash', 'SB01 Super OrgA', 'ACTIVE'),
         ($3, 'sb01.viewer.orga@test.local', 'hash', 'SB01 Viewer OrgA', 'ACTIVE')
       ON CONFLICT (id) DO UPDATE SET status = 'ACTIVE', deleted_at = NULL;`,
      [USERS.superAdminNoOrg, USERS.superAdminMemberOrgA, USERS.viewerOrgA]
    );

    const sysRolesRes = await pool.query(`SELECT id, name FROM system_roles WHERE name IN ('SUPER_ADMIN', 'ADMIN')`);
    const superRoleId = sysRolesRes.rows.find((r) => r.name === 'SUPER_ADMIN')?.id;
    assert.ok(superRoleId, 'SUPER_ADMIN role must exist');

    await pool.query(
      `INSERT INTO user_system_roles (user_id, system_role_id)
       VALUES ($1, $3), ($2, $3)
       ON CONFLICT DO NOTHING;`,
      [USERS.superAdminNoOrg, USERS.superAdminMemberOrgA, superRoleId]
    );

    await pool.query(
      `INSERT INTO organizations (id, name, slug, status)
       VALUES
         ($1, 'SB01 Org A', 'sb01-org-a', 'ACTIVE'),
         ($2, 'SB01 Org B', 'sb01-org-b', 'ACTIVE')
       ON CONFLICT (id) DO NOTHING;`,
      [ORG_A, ORG_B]
    );

    const orgRolesRes = await pool.query(`SELECT id, code FROM organization_roles WHERE code IN ('DEVOPS', 'VIEWER')`);
    const devopsRoleId = orgRolesRes.rows.find((r) => r.code === 'DEVOPS')?.id;
    const viewerRoleId = orgRolesRes.rows.find((r) => r.code === 'VIEWER')?.id;
    assert.ok(devopsRoleId && viewerRoleId, 'DEVOPS and VIEWER organization roles must exist');

    await pool.query(
      `INSERT INTO organization_members (organization_id, user_id, role_id, status)
       VALUES
         ($1, $2, $4, 'ACTIVE'),
         ($1, $3, $5, 'ACTIVE')
       ON CONFLICT DO NOTHING;`,
      [ORG_A, USERS.superAdminMemberOrgA, USERS.viewerOrgA, devopsRoleId, viewerRoleId]
    );

    await pool.query(
      `INSERT INTO environments (id, organization_id, name, status)
       VALUES ($1, $3, 'SB01 Env A', 'ACTIVE'), ($2, $4, 'SB01 Env B', 'ACTIVE')
       ON CONFLICT (id) DO NOTHING;`,
      [ENV_A, ENV_B, ORG_A, ORG_B]
    );
    await pool.query(
      `INSERT INTO clusters (id, environment_id, name, status)
       VALUES ($1, $3, 'sb01-cluster-a', 'CONNECTED'), ($2, $4, 'sb01-cluster-b', 'CONNECTED')
       ON CONFLICT (id) DO NOTHING;`,
      [CLUSTER_A, CLUSTER_B, ENV_A, ENV_B]
    );

    await pool.query(
      `INSERT INTO incidents (id, organization_id, environment_id, cluster_id, source_type, target_type, incident_type, title, severity, status)
       VALUES
         ($1, $3, $5, $7, 'AI_GRU', 'POD', 'HIGH_CPU', 'SB01 Incident A', 'HIGH', 'OPEN'),
         ($2, $4, $6, $8, 'AI_GRU', 'POD', 'HIGH_CPU', 'SB01 Incident B', 'HIGH', 'OPEN')
       ON CONFLICT (id) DO NOTHING;`,
      [INC_A, INC_B, ORG_A, ORG_B, ENV_A, ENV_B, CLUSTER_A, CLUSTER_B]
    );

    await pool.query(
      `INSERT INTO healing_action_types (id, code, name, description, target_type, default_risk_level, requires_approval_by_default, enabled)
       VALUES ($1, 'SB01_RESTART', 'SB01 Restart', 'Test', 'POD', 'LOW', FALSE, TRUE)
       ON CONFLICT (id) DO NOTHING;`,
      [ACT_TYPE_SB01]
    );

    await pool.query(
      `INSERT INTO healing_actions (id, incident_id, environment_id, action_type_id, target_type, target_name, risk_level, execution_mode, approval_status, execution_status)
       VALUES ($1, $2, $3, $4, 'POD', 'sb01-svc', 'LOW', 'MANUAL', 'APPROVED', 'PENDING')
       ON CONFLICT (id) DO NOTHING;`,
      [ACT_A, INC_A, ENV_A, ACT_TYPE_SB01]
    );

    server = http.createServer(app);
    uiWss = initTelemetryWebSocket(server);
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
      await pool.query(`DELETE FROM healing_actions WHERE id = $1`, [ACT_A]);
      await pool.query(`DELETE FROM healing_action_types WHERE id = $1`, [ACT_TYPE_SB01]);
      await pool.query(`DELETE FROM incidents WHERE id IN ($1, $2)`, [INC_A, INC_B]);
      await pool.query(`DELETE FROM clusters WHERE id IN ($1, $2)`, [CLUSTER_A, CLUSTER_B]);
      await pool.query(`DELETE FROM environments WHERE id IN ($1, $2)`, [ENV_A, ENV_B]);
      await pool.query(`DELETE FROM organization_members WHERE organization_id IN ($1, $2)`, [ORG_A, ORG_B]);
      await pool.query(`DELETE FROM organizations WHERE id IN ($1, $2)`, [ORG_A, ORG_B]);
      await pool.query(`DELETE FROM user_system_roles WHERE user_id = ANY($1::uuid[])`, [Object.values(USERS)]);
      await pool.query(`DELETE FROM users WHERE id = ANY($1::uuid[])`, [Object.values(USERS)]);
    }
    if (uiWss) {
      uiWss.close();
    }
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    await closeRedis().catch(() => {});
    await pool.end().catch(() => {});
  });

  test('SB01-01: PostgreSQL execution_status enum uses canonical COMPLETED (no SUCCEEDED write)', async () => {
    const enumRes = await pool.query(
      `SELECT e.enumlabel FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'execution_status'`
    );
    const labels = enumRes.rows.map((r) => r.enumlabel);
    assert.ok(labels.includes('COMPLETED'), 'execution_status enum must contain COMPLETED');
    assert.ok(!labels.includes('SUCCEEDED'), 'execution_status enum must not contain SUCCEEDED');

    const updated = await HealingActionModel.updateStatus(ACT_A, 'COMPLETED', undefined, undefined, ORG_A);
    assert.ok(updated);
    assert.strictEqual(updated.execution_status, 'COMPLETED');
  });

  test('SB01-02: SUPER_ADMIN without Org B membership is denied (403) on Org B HTTP endpoints', async () => {
    const superToken = signJwt(USERS.superAdminMemberOrgA, 'sb01.super.orga@test.local', ['SUPER_ADMIN']);

    const telRes = await fetch(`${baseUrl}/api/v1/telemetry/live-summary?organization_id=${ORG_B}`, {
      headers: { Authorization: `Bearer ${superToken}` },
    });
    assert.strictEqual(telRes.status, 403);

    const predRes = await fetch(`${baseUrl}/api/v1/ai/predictions?organization_id=${ORG_B}`, {
      headers: { Authorization: `Bearer ${superToken}` },
    });
    assert.strictEqual(predRes.status, 403);

    const incRes = await fetch(`${baseUrl}/api/v1/ai/incidents/${INC_B}`, {
      headers: { Authorization: `Bearer ${superToken}`, 'x-organization-id': ORG_B },
    });
    assert.strictEqual(incRes.status, 403);
  });

  test('SB01-03: SUPER_ADMIN omitting organization_id on org-scoped endpoints gets 400 (no bypass / fallback)', async () => {
    const superToken = signJwt(USERS.superAdminMemberOrgA, 'sb01.super.orga@test.local', ['SUPER_ADMIN']);

    const telRes = await fetch(`${baseUrl}/api/v1/telemetry/live-summary`, {
      headers: { Authorization: `Bearer ${superToken}` },
    });
    assert.strictEqual(telRes.status, 400);

    const predRes = await fetch(`${baseUrl}/api/v1/ai/predictions`, {
      headers: { Authorization: `Bearer ${superToken}` },
    });
    assert.strictEqual(predRes.status, 400);
  });

  test('SB01-04: SUPER_ADMIN who IS ACTIVE member of Org A can access Org A scoped HTTP endpoints', async () => {
    const superToken = signJwt(USERS.superAdminMemberOrgA, 'sb01.super.orga@test.local', ['SUPER_ADMIN']);

    const telRes = await fetch(`${baseUrl}/api/v1/telemetry/live-summary?organization_id=${ORG_A}`, {
      headers: { Authorization: `Bearer ${superToken}` },
    });
    assert.strictEqual(telRes.status, 200);

    const predRes = await fetch(`${baseUrl}/api/v1/ai/predictions?organization_id=${ORG_A}`, {
      headers: { Authorization: `Bearer ${superToken}` },
    });
    assert.strictEqual(predRes.status, 200);
  });

  test('SB01-05: Platform-level admin routes remain accessible to SUPER_ADMIN without org membership', async () => {
    const superNoOrgToken = signJwt(USERS.superAdminNoOrg, 'sb01.super.noorg@test.local', ['SUPER_ADMIN']);

    const nodesRes = await fetch(`${baseUrl}/api/v1/nodes`, {
      headers: { Authorization: `Bearer ${superNoOrgToken}` },
    });
    assert.strictEqual(nodesRes.status, 200);

    const podsRes = await fetch(`${baseUrl}/api/v1/pods`, {
      headers: { Authorization: `Bearer ${superNoOrgToken}` },
    });
    assert.strictEqual(podsRes.status, 200);

    const actionTypeRes = await fetch(`${baseUrl}/api/v1/healing/action-types/${ACT_TYPE_SB01}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${superNoOrgToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: 'Platform admin catalog update' }),
    });
    assert.strictEqual(actionTypeRes.status, 200);
  });

  test('SB01-06: WebSocket denies SUPER_ADMIN without org membership or orgId (4003) and enforces tenant broadcast isolation', async () => {
    const superNoOrgToken = signJwt(USERS.superAdminNoOrg, 'sb01.super.noorg@test.local', ['SUPER_ADMIN']);
    const superMemberToken = signJwt(USERS.superAdminMemberOrgA, 'sb01.super.orga@test.local', ['SUPER_ADMIN']);

    const noOrgCode = await new Promise<number>((resolve) => {
      const ws = new WebSocket(`${wsBaseUrl}/api/v1/telemetry/ws?token=${superNoOrgToken}`);
      ws.on('close', (code) => resolve(code));
    });
    assert.strictEqual(noOrgCode, 4003);

    const wrongOrgCode = await new Promise<number>((resolve) => {
      const ws = new WebSocket(`${wsBaseUrl}/api/v1/telemetry/ws?token=${superMemberToken}&organization_id=${ORG_B}`);
      ws.on('close', (code) => resolve(code));
    });
    assert.strictEqual(wrongOrgCode, 4003);

    const receivedTypes: string[] = [];
    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(`${wsBaseUrl}/api/v1/telemetry/ws?token=${superMemberToken}&organization_id=${ORG_A}`);
      const timer = setTimeout(() => {
        ws.close();
        reject(new Error('WS timeout'));
      }, 4000);
      ws.on('message', async (raw) => {
        const msg = JSON.parse(raw.toString());
        receivedTypes.push(msg.type);
        if (msg.type === 'initial_state') {
          await broadcastTelemetryToUi({
            type: 'sb01_cross_org_secret',
            data: { organization_id: ORG_B, cluster_id: CLUSTER_B, secret: 'org-b-only' },
          });
          await broadcastTelemetryToUi({
            type: 'sb01_same_org_event',
            data: { organization_id: ORG_A, cluster_id: CLUSTER_A, ok: true },
          });
          setTimeout(() => {
            clearTimeout(timer);
            ws.close();
            resolve();
          }, 150);
        }
      });
    });

    assert.ok(receivedTypes.includes('sb01_same_org_event'), 'Org A event must reach member SUPER_ADMIN');
    assert.ok(!receivedTypes.includes('sb01_cross_org_secret'), 'Org B event must NOT leak to Org A member SUPER_ADMIN');
  });

  test('SB01-07: Authenticated VIEWER with explicit organization_id receives sanitized WS initial_state', async () => {
    const viewerToken = signJwt(USERS.viewerOrgA, 'sb01.viewer.orga@test.local', ['USER']);
    const initialMsg = await new Promise<any>((resolve, reject) => {
      const ws = new WebSocket(`${wsBaseUrl}/api/v1/telemetry/ws?token=${viewerToken}&organization_id=${ORG_A}`);
      const timer = setTimeout(() => {
        ws.close();
        reject(new Error('Viewer WS timeout'));
      }, 4000);
      ws.on('message', (raw) => {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'initial_state') {
          clearTimeout(timer);
          ws.close();
          resolve(msg);
        }
      });
    });

    assert.strictEqual(initialMsg.type, 'initial_state');
    assert.deepStrictEqual(initialMsg.data.raw_metrics, []);
    assert.deepStrictEqual(initialMsg.data.logs, []);
    assert.deepStrictEqual(initialMsg.data.events, []);
  });

  test('SB01-08: K8sStatusService nodes/pods/workloads SQL executes without cluster_id uuid=varchar error', async () => {
    const scope = {
      user: { id: USERS.superAdminMemberOrgA, roles: ['USER'] },
      orgId: ORG_A,
      query: { organization_id: ORG_A, cluster_id: CLUSTER_A },
    };
    const [nodes, pods, workloads] = await Promise.all([
      K8sStatusService.getNodesStatus(scope),
      K8sStatusService.getPodsStatus(scope),
      K8sStatusService.getDeploymentsStatus(scope),
    ]);
    assert.ok(Array.isArray(nodes));
    assert.ok(Array.isArray(pods));
    assert.ok(Array.isArray(workloads));
  });
});
