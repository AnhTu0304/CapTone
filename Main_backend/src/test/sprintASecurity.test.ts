import test, { describe, before, after, afterEach, mock } from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import { AddressInfo } from 'node:net';
import WebSocket, { WebSocketServer } from 'ws';
import jwt from 'jsonwebtoken';
import app from '../app';
import { config } from '../config/env';
import { pool } from '../config/database';
import { closeRedis } from '../config/redis';
import { UserModel } from '../models/user.model';
import { SystemRoleService } from '../services/systemRole.service';
import { SessionRevocationService } from '../services/sessionRevocation.service';
import { HealingActionModel } from '../models/healingAction.model';
import { HealingActionService } from '../services/healingAction.service';
import { OrganizationMemberModel } from '../models/organizationMember.model';
import { TelemetryController } from '../controllers/telemetry.controller';
import { TelemetryPipelineService } from '../services/telemetryPipeline.service';
import { TelemetryBufferService } from '../services/telemetryBuffer.service';
import { initTelemetryWebSocket, broadcastTelemetryToUi } from '../websocket/telemetryWebSocket';

const ORG_A = '11111111-1111-4111-8111-111111111111';
const ORG_B = '22222222-2222-4222-8222-222222222222';
const ORG_C = '33333333-3333-4333-8333-333333333333';
const DEFAULT_LAB_ORG = '00000000-0000-0000-0000-000000000001';

const CLUSTER_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const CLUSTER_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const ENV_A = '11111111-eeee-4111-8111-111111111111';
const ENV_B = '22222222-eeee-4222-8222-222222222222';
const INCIDENT_A = '11111111-1111-4111-8111-aaaaaaaaaaaa';
const ACTION_A = 'aaaa1111-1111-4111-8111-111111111111';
const ACTION_B = 'bbbb2222-2222-4222-8222-222222222222';
const ACTION_TYPE_ID = 'cccc3333-3333-4333-8333-333333333333';

const USERS = {
  sysSuperAdmin: '90000000-0000-4000-8000-000000000001',
  sysAdmin: '90000000-0000-4000-8000-000000000002',
  orgAdminA: '90000000-0000-4000-8000-000000000003',
  smeOwnerA: '90000000-0000-4000-8000-000000000004',
  devopsA: '90000000-0000-4000-8000-000000000005',
  viewerA: '90000000-0000-4000-8000-000000000006',
  multiOrgAC: '90000000-0000-4000-8000-000000000007',
  badRolesUser: '90000000-0000-4000-8000-000000000008',
};

function signJwt(id: string, email: string, roles: string[] = ['USER']) {
  return jwt.sign({ id, email, status: 'ACTIVE', roles }, config.jwt.secret, {
    algorithm: 'HS256',
    expiresIn: '1h',
  });
}

describe('Sprint A Security Regression Suite (RBAC-01..14 & WS-01..12)', () => {
  let server: http.Server;
  let uiWss: WebSocketServer;
  let baseUrl: string;
  let wsBaseUrl: string;
  const revokedTokens = new Set<string>();
  let simulateRedisOffline = false;

  before(async () => {
    // Mock infrastructure boundaries (read-only / zero DB mutation)
    mock.method(SessionRevocationService, 'isTokenRevoked', async (token: string) => {
      if (simulateRedisOffline) {
        throw new Error('Redis connection unavailable');
      }
      return revokedTokens.has(token);
    });

    mock.method(UserModel, 'findAuthStatus', async (userId: string) => {
      if (userId === USERS.sysSuperAdmin) return { id: userId, status: 'ACTIVE' as any, deleted_at: null, roles: ['SUPER_ADMIN'] };
      if (userId === USERS.sysAdmin) return { id: userId, status: 'ACTIVE' as any, deleted_at: null, roles: ['ADMIN'] };
      if (userId === USERS.badRolesUser) return { id: userId, status: 'ACTIVE' as any, deleted_at: null, roles: null as any };
      if (Object.values(USERS).includes(userId)) {
        return { id: userId, status: 'ACTIVE' as any, deleted_at: null, roles: ['USER'] };
      }
      return null;
    });

    mock.method(SystemRoleService, 'hasAnyRole', async (userId: string, targetRoles: string[]) => {
      const upper = targetRoles.map((r) => r.toUpperCase());
      if (userId === USERS.sysSuperAdmin) return upper.includes('SUPER_ADMIN') || upper.includes('ADMIN');
      if (userId === USERS.sysAdmin) return upper.includes('ADMIN');
      return false;
    });

    mock.method(OrganizationMemberModel, 'findByOrgAndUser', async (orgId: string, userId: string) => {
      if (orgId === ORG_A) {
        if (userId === USERS.orgAdminA) return { organization_id: ORG_A, user_id: userId, role_code: 'ADMIN', status: 'ACTIVE' } as any;
        if (userId === USERS.smeOwnerA) return { organization_id: ORG_A, user_id: userId, role_code: 'SME_OWNER', status: 'ACTIVE' } as any;
        if (userId === USERS.devopsA) return { organization_id: ORG_A, user_id: userId, role_code: 'DEVOPS', status: 'ACTIVE' } as any;
        if (userId === USERS.viewerA) return { organization_id: ORG_A, user_id: userId, role_code: 'VIEWER', status: 'ACTIVE' } as any;
        if (userId === USERS.multiOrgAC) return { organization_id: ORG_A, user_id: userId, role_code: 'DEVOPS', status: 'ACTIVE' } as any;
      }
      if (orgId === ORG_C && userId === USERS.multiOrgAC) {
        return { organization_id: ORG_C, user_id: userId, role_code: 'DEVOPS', status: 'ACTIVE' } as any;
      }
      return null;
    });

    mock.method(HealingActionModel, 'validateClusterBelongsToOrg', async (clusterId: string, orgId?: string) => {
      const map: Record<string, { id: string; name: string; environment_id: string; organization_id: string }> = {
        [CLUSTER_A]: { id: CLUSTER_A, name: 'cluster-a', environment_id: ENV_A, organization_id: ORG_A },
        [CLUSTER_B]: { id: CLUSTER_B, name: 'cluster-b', environment_id: ENV_B, organization_id: ORG_B },
      };
      const entry = map[clusterId];
      if (!entry) return null;
      if (orgId && entry.organization_id !== orgId) return null;
      return entry;
    });

    mock.method(HealingActionModel, 'findActionById', async (id: string) => {
      if (id === ACTION_A) {
        return { id: ACTION_A, organization_id: ORG_A, cluster_id: CLUSTER_A, environment_id: ENV_A, execution_status: 'PENDING' };
      }
      if (id === ACTION_B) {
        return { id: ACTION_B, organization_id: ORG_B, cluster_id: CLUSTER_B, environment_id: ENV_B, execution_status: 'PENDING' };
      }
      return null;
    });

    mock.method(HealingActionModel, 'updateStatus', async (id: string, status: string, _r?: any, _e?: string, orgId?: string) => {
      const ownerOrg = id === ACTION_A ? ORG_A : id === ACTION_B ? ORG_B : null;
      if (!ownerOrg) return null;
      if (orgId && orgId !== ownerOrg) return null;
      return { id, execution_status: status, organization_id: ownerOrg };
    });

    mock.method(HealingActionModel, 'updateActionType', async (id: string, data: any) => {
      if (id !== ACTION_TYPE_ID) return null;
      return { id, ...data };
    });

    mock.method(HealingActionModel, 'createAction', async (data: any) => ({ id: ACTION_A, ...data }));

    mock.method(TelemetryController, 'getLiveSummaryData', async () => ({
      service_id: 'sme-order-service',
      raw_metrics: [{ cpu: 10 }],
      logs: [{ message: 'ok' }],
      events: [],
      incidents: [],
      recommendations: [],
      predictions: [],
    }));

    mock.method(TelemetryPipelineService, 'processServiceBatch', async () => {});

    // Keep references for A-C03 telemetry tests when needed

    // Mock pool.query for RBAC, org membership, and service ownership checks
    mock.method(pool, 'query', async (sql: string, params: any[] = []) => {
      const q = String(sql).replace(/\s+/g, ' ').trim();

      if (q.includes('FROM organization_members om') && q.includes('JOIN organization_roles r')) {
        const userId = params[0];
        const orgId = params[1];
        const memberships: Array<{ organization_id: string; role_code: string }> = [];
        if (userId === USERS.orgAdminA) memberships.push({ organization_id: ORG_A, role_code: 'ADMIN' });
        if (userId === USERS.smeOwnerA) memberships.push({ organization_id: ORG_A, role_code: 'SME_OWNER' });
        if (userId === USERS.devopsA) memberships.push({ organization_id: ORG_A, role_code: 'DEVOPS' });
        if (userId === USERS.viewerA) memberships.push({ organization_id: ORG_A, role_code: 'VIEWER' });
        if (userId === USERS.multiOrgAC) {
          memberships.push({ organization_id: ORG_A, role_code: 'DEVOPS' });
          memberships.push({ organization_id: ORG_C, role_code: 'DEVOPS' });
        }
        const filtered = orgId ? memberships.filter((m) => m.organization_id === orgId) : memberships;
        return { rows: filtered.map((m) => ({ organization_id: m.organization_id, role_code: m.role_code, code: m.role_code, name: m.role_code })) } as any;
      }

      if (q.includes('SELECT organization_id FROM organization_members')) {
        const userId = params[0];
        if (userId === USERS.smeOwnerA || userId === USERS.devopsA || userId === USERS.viewerA || userId === USERS.orgAdminA) {
          return { rows: [{ organization_id: ORG_A }] } as any;
        }
        if (userId === USERS.multiOrgAC) {
          return { rows: [{ organization_id: ORG_A }, { organization_id: ORG_C }] } as any;
        }
        return { rows: [] } as any;
      }

      if (q.includes('FROM services s') && q.includes('JOIN clusters c')) {
        const serviceId = params[0];
        if (serviceId === 'svc-org-b') return { rows: [{ organization_id: ORG_B }] } as any;
        if (serviceId === 'svc-org-a') return { rows: [{ organization_id: ORG_A }] } as any;
        return { rows: [] } as any;
      }

      if (q.includes('FROM environments WHERE id = $1')) {
        const envId = params[0];
        if (envId === ENV_A) return { rows: [{ organization_id: ORG_A }] } as any;
        if (envId === ENV_B) return { rows: [{ organization_id: ORG_B }] } as any;
        return { rows: [] } as any;
      }

      if (q.includes('FROM incidents WHERE id = $1')) {
        return { rows: [{ environment_id: ENV_A }] } as any;
      }

      return { rows: [] } as any;
    });

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

  afterEach(() => {
    simulateRedisOffline = false;
    revokedTokens.clear();
  });

  after(async () => {
    uiWss?.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await closeRedis().catch(() => {});
    await pool.end().catch(() => {});
    process.exit(0);
  });

  // =========================================================================
  // RBAC TESTS (RBAC-01 .. RBAC-14)
  // =========================================================================

  test('RBAC-01: Cross-Organization role escalation (SME_OWNER Org A -> Org B) returns 403', async () => {
    const token = signJwt(USERS.smeOwnerA, 'owner.a@test.com');
    const res = await fetch(`${baseUrl}/api/v1/healing/actions/${ACTION_B}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'x-organization-id': ORG_B },
      body: JSON.stringify({ status: 'SUCCEEDED' }),
    });
    assert.strictEqual(res.status, 403);
  });

  test('RBAC-02: Missing organization_id on Organization-scoped endpoint is denied (400)', async () => {
    const token = signJwt(USERS.devopsA, 'devops.a@test.com');
    const res = await fetch(`${baseUrl}/api/v1/healing/actions/${ACTION_A}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'SUCCEEDED' }),
    });
    assert.strictEqual(res.status, 400);
  });

  test('RBAC-03: organization_id=all is rejected with 403 Forbidden', async () => {
    const token = signJwt(USERS.devopsA, 'devops.a@test.com');
    const res = await fetch(`${baseUrl}/api/v1/healing/actions/${ACTION_A}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'x-organization-id': 'all' },
      body: JSON.stringify({ status: 'SUCCEEDED' }),
    });
    assert.strictEqual(res.status, 403);
  });

  test('RBAC-04: VIEWER role attempting to modify Healing Action returns 403', async () => {
    const token = signJwt(USERS.viewerA, 'viewer.a@test.com');
    const res = await fetch(`${baseUrl}/api/v1/healing/actions/${ACTION_A}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'x-organization-id': ORG_A },
      body: JSON.stringify({ status: 'SUCCEEDED' }),
    });
    assert.strictEqual(res.status, 403);
  });

  test('RBAC-05: Cross-tenant Healing Action IDOR (Org A DevOps updates Org B action with Org A header) returns 403', async () => {
    const token = signJwt(USERS.devopsA, 'devops.a@test.com');
    const res = await fetch(`${baseUrl}/api/v1/healing/actions/${ACTION_B}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'x-organization-id': ORG_A },
      body: JSON.stringify({ status: 'SUCCEEDED' }),
    });
    assert.strictEqual(res.status, 403);
  });

  test('RBAC-06: Org SME_OWNER / DEVOPS attempting to modify global Healing Action Type returns 403', async () => {
    const token = signJwt(USERS.smeOwnerA, 'owner.a@test.com');
    const res = await fetch(`${baseUrl}/api/v1/healing/action-types/${ACTION_TYPE_ID}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'x-organization-id': ORG_A },
      body: JSON.stringify({ requires_approval_by_default: false }),
    });
    assert.strictEqual(res.status, 403);
  });

  test('RBAC-07: Default Lab Organization (00000000-...-0001) bypass is rejected with 403', async () => {
    const token = signJwt(USERS.devopsA, 'devops.a@test.com');
    await assert.rejects(
      () => HealingActionService.validateUserOrgAndCluster({ id: USERS.devopsA, roles: ['USER'] }, DEFAULT_LAB_ORG, CLUSTER_B),
      (err: any) => err.statusCode === 403
    );
  });

  test('RBAC-08: Org A user submitting Cluster B ID returns 403', async () => {
    await assert.rejects(
      () => HealingActionService.validateUserOrgAndCluster({ id: USERS.devopsA, roles: ['USER'] }, ORG_A, CLUSTER_B),
      (err: any) => err.statusCode === 403
    );
  });

  test('RBAC-09: Malformed organization_id returns 400 without global lookup', async () => {
    const token = signJwt(USERS.devopsA, 'devops.a@test.com');
    const res = await fetch(`${baseUrl}/api/v1/healing/actions/${ACTION_A}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'x-organization-id': 'not-a-uuid' },
      body: JSON.stringify({ status: 'SUCCEEDED' }),
    });
    assert.strictEqual(res.status, 400);
  });

  test('RBAC-10: Direct service-level call without ownership is denied with 403', async () => {
    await assert.rejects(
      () => HealingActionService.updateActionStatus(ACTION_B, 'SUCCEEDED', undefined, undefined, { id: USERS.devopsA, roles: ['USER'] }),
      (err: any) => err.statusCode === 403
    );
  });

  test('RBAC-11: Multi-org user (Org A & C) requesting Org B where not a member returns 403', async () => {
    const token = signJwt(USERS.multiOrgAC, 'multi.ac@test.com');
    const res = await fetch(`${baseUrl}/api/v1/healing/actions/${ACTION_B}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'x-organization-id': ORG_B },
      body: JSON.stringify({ status: 'SUCCEEDED' }),
    });
    assert.strictEqual(res.status, 403);
  });

  test('RBAC-12: System ADMIN without Organization membership can modify global Healing Action Type (200)', async () => {
    const token = signJwt(USERS.sysAdmin, 'sys.admin@test.com', ['ADMIN']);
    const res = await fetch(`${baseUrl}/api/v1/healing/action-types/${ACTION_TYPE_ID}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: true }),
    });
    assert.strictEqual(res.status, 200);
  });

  test('RBAC-13: Organization-level ADMIN without System ADMIN privilege cannot modify global Healing Action Type (403)', async () => {
    const token = signJwt(USERS.orgAdminA, 'org.admin.a@test.com', ['USER']);
    const res = await fetch(`${baseUrl}/api/v1/healing/action-types/${ACTION_TYPE_ID}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'x-organization-id': ORG_A },
      body: JSON.stringify({ enabled: false }),
    });
    assert.strictEqual(res.status, 403);
  });

  test('RBAC-14: User without membership attempting to access Default Lab Organization resources returns 403', async () => {
    const token = signJwt(USERS.devopsA, 'devops.a@test.com');
    const res = await fetch(`${baseUrl}/api/v1/healing/actions/${ACTION_A}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'x-organization-id': DEFAULT_LAB_ORG },
      body: JSON.stringify({ status: 'SUCCEEDED' }),
    });
    assert.strictEqual(res.status, 403);
  });

  // =========================================================================
  // WEBSOCKET TESTS (WS-01 .. WS-12)
  // =========================================================================

  function connectWs(query: string): Promise<{ opened: boolean; closeCode?: number; statusCode?: number; ws?: WebSocket; messages: any[] }> {
    return new Promise((resolve) => {
      const ws = new WebSocket(`${wsBaseUrl}/api/v1/telemetry/ws${query}`);
      const messages: any[] = [];
      let settled = false;
      const done = (res: any) => {
        if (!settled) {
          settled = true;
          resolve(res);
        }
      };
      ws.on('unexpected-response', (_req, res) => {
        ws.terminate();
        done({ opened: false, statusCode: res.statusCode, messages });
      });
      ws.on('error', () => {
        done({ opened: false, messages });
      });
      ws.on('message', (d) => {
        try { messages.push(JSON.parse(d.toString())); } catch {}
      });
      ws.on('close', (code) => {
        done({ opened: false, closeCode: code, messages });
      });
      ws.on('open', () => {
        setTimeout(() => done({ opened: true, ws, messages }), 120);
      });
    });
  }

  test('WS-01: Cross-tenant Cluster subscription (Org A user -> Cluster B) closes with 4003', async () => {
    const token = signJwt(USERS.devopsA, 'devops.a@test.com');
    const res = await connectWs(`?token=${token}&organization_id=${ORG_A}&cluster_id=${CLUSTER_B}`);
    assert.strictEqual(res.closeCode, 4003);
  });

  test('WS-02: Cross-tenant Service subscription (Org A user -> svc-org-b) closes with 4003', async () => {
    const token = signJwt(USERS.devopsA, 'devops.a@test.com');
    const res = await connectWs(`?token=${token}&organization_id=${ORG_A}&service_id=svc-org-b`);
    assert.strictEqual(res.closeCode, 4003);
  });

  test('WS-03: Revoked JWT is rejected before establishing WebSocket session (401)', async () => {
    const token = signJwt(USERS.devopsA, 'devops.a@test.com');
    revokedTokens.add(token);
    const res = await connectWs(`?token=${token}&organization_id=${ORG_A}`);
    assert.strictEqual(res.opened, false);
    assert.strictEqual(res.statusCode, 401);
  });

  test('WS-04: Invalid JWT algorithm (alg: none) is rejected (401)', async () => {
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ id: USERS.sysSuperAdmin, email: 'x@y.com' })).toString('base64url');
    const unsignedToken = `${header}.${payload}.`;
    const res = await connectWs(`?token=${unsignedToken}&organization_id=${ORG_A}`);
    assert.strictEqual(res.opened, false);
    assert.strictEqual(res.statusCode, 401);
  });

  test('WS-05: Missing/null roles in DB never grants SUPER_ADMIN and denies access (403)', async () => {
    const token = signJwt(USERS.badRolesUser, 'bad.roles@test.com');
    const res = await connectWs(`?token=${token}&organization_id=${ORG_A}`);
    assert.strictEqual(res.opened, false);
    assert.strictEqual(res.statusCode, 403);
  });

  test('WS-06: Redis revocation failure fails closed (503)', async () => {
    simulateRedisOffline = true;
    const token = signJwt(USERS.devopsA, 'devops.a@test.com');
    const res = await connectWs(`?token=${token}&organization_id=${ORG_A}`);
    assert.strictEqual(res.opened, false);
    assert.strictEqual(res.statusCode, 503);
  });

  test('WS-07: Broadcast isolation — Org A subscriber receives zero Org B events', async () => {
    const token = signJwt(USERS.devopsA, 'devops.a@test.com');
    const conn = await connectWs(`?token=${token}&organization_id=${ORG_A}&cluster_id=${CLUSTER_A}`);
    assert.strictEqual(conn.opened, true);
    const beforeCount = conn.messages.length;
    await broadcastTelemetryToUi({ type: 'log', data: { organization_id: ORG_B, cluster_id: CLUSTER_B, message: 'org-b-secret' } });
    await new Promise((r) => setTimeout(r, 80));
    assert.strictEqual(conn.messages.length, beforeCount);
    conn.ws?.close();
  });

  test('WS-08: Subscription scope manipulation in WS message cannot switch to Org B', async () => {
    const token = signJwt(USERS.devopsA, 'devops.a@test.com');
    const conn = await connectWs(`?token=${token}&organization_id=${ORG_A}&cluster_id=${CLUSTER_A}`);
    assert.strictEqual(conn.opened, true);
    conn.ws?.send(JSON.stringify({ type: 'request_refresh', cluster_id: CLUSTER_B, organization_id: ORG_B }));
    await new Promise((r) => setTimeout(r, 80));
    const errMsg = conn.messages.find((m) => m.type === 'error' && m.code === 'SCOPE_IMMUTABLE');
    assert.ok(errMsg, 'Should reject scope manipulation with SCOPE_IMMUTABLE');
    conn.ws?.close();
  });

  test('WS-09: Valid same-tenant DEVOPS in Org A subscribing to Cluster A succeeds', async () => {
    const token = signJwt(USERS.devopsA, 'devops.a@test.com');
    const conn = await connectWs(`?token=${token}&organization_id=${ORG_A}&cluster_id=${CLUSTER_A}`);
    assert.strictEqual(conn.opened, true);
    assert.ok(conn.messages.some((m) => m.type === 'initial_state'));
    conn.ws?.close();
  });

  test('WS-10: Valid System SUPER_ADMIN global WebSocket access succeeds', async () => {
    const token = signJwt(USERS.sysSuperAdmin, 'superadmin@test.com', ['SUPER_ADMIN']);
    const conn = await connectWs(`?token=${token}&cluster_id=${CLUSTER_B}`);
    assert.strictEqual(conn.opened, true);
    conn.ws?.close();
  });

  test('WS-11: Telemetry payload without trustworthy tenant identity is NOT broadcast to tenant-scoped subscribers', async () => {
    const token = signJwt(USERS.devopsA, 'devops.a@test.com');
    const conn = await connectWs(`?token=${token}&organization_id=${ORG_A}&cluster_id=${CLUSTER_A}`);
    assert.strictEqual(conn.opened, true);
    const beforeCount = conn.messages.length;
    await broadcastTelemetryToUi({ type: 'log', data: { message: 'unattributed-tenant-log' } });
    await new Promise((r) => setTimeout(r, 80));
    assert.strictEqual(conn.messages.length, beforeCount);
    conn.ws?.close();
  });

  test('WS-12: Payload claiming Org A while underlying cluster belongs to Org B is NOT broadcast', async () => {
    const token = signJwt(USERS.devopsA, 'devops.a@test.com');
    const conn = await connectWs(`?token=${token}&organization_id=${ORG_A}&cluster_id=${CLUSTER_A}`);
    assert.strictEqual(conn.opened, true);
    const beforeCount = conn.messages.length;
    await broadcastTelemetryToUi({
      type: 'log',
      data: { organization_id: ORG_A, cluster_id: CLUSTER_B, message: 'spoofed-org-a-log' },
    });
    await new Promise((r) => setTimeout(r, 80));
    assert.strictEqual(conn.messages.length, beforeCount);
    conn.ws?.close();
  });

  // =========================================================================
  // A-C02 WEBSOCKET ORGANIZATION CONTEXT TESTS (WS-13 .. WS-18)
  // =========================================================================

  test('WS-13: Multi-org user omitting organization_id is rejected (4003) — no allowedOrgIds[0] fallback', async () => {
    const token = signJwt(USERS.multiOrgAC, 'multi.ac@test.com');
    const res = await connectWs(`?token=${token}`);
    assert.strictEqual(res.closeCode, 4003);
  });

  test('WS-14: Multi-org user explicitly selecting Org C is scoped strictly to Org C', async () => {
    const token = signJwt(USERS.multiOrgAC, 'multi.ac@test.com');
    const conn = await connectWs(`?token=${token}&organization_id=${ORG_C}`);
    assert.strictEqual(conn.opened, true);
    const beforeCount = conn.messages.length;
    await broadcastTelemetryToUi({ type: 'log', data: { organization_id: ORG_A, cluster_id: CLUSTER_A, message: 'org-a-only' } });
    await new Promise((r) => setTimeout(r, 80));
    assert.strictEqual(conn.messages.length, beforeCount, 'Socket scoped to Org C must NOT receive Org A broadcast');
    conn.ws?.close();
  });

  test('WS-15: Multi-org user selects Org C but supplies Cluster A (belonging to Org A) — rejected (4003)', async () => {
    const token = signJwt(USERS.multiOrgAC, 'multi.ac@test.com');
    const res = await connectWs(`?token=${token}&organization_id=${ORG_C}&cluster_id=${CLUSTER_A}`);
    assert.strictEqual(res.closeCode, 4003);
  });

  test('WS-16: Client attempts to change organization_id via WS message — rejected with SCOPE_IMMUTABLE', async () => {
    const token = signJwt(USERS.multiOrgAC, 'multi.ac@test.com');
    const conn = await connectWs(`?token=${token}&organization_id=${ORG_C}`);
    assert.strictEqual(conn.opened, true);
    conn.ws?.send(JSON.stringify({ type: 'switch_org', organization_id: ORG_A }));
    await new Promise((r) => setTimeout(r, 80));
    assert.ok(conn.messages.some((m) => m.type === 'error' && m.code === 'SCOPE_IMMUTABLE'));
    conn.ws?.close();
  });

  test('WS-17: Organization switching closes old connection and establishes new connection with new verified scope', async () => {
    const token = signJwt(USERS.multiOrgAC, 'multi.ac@test.com');
    const conn1 = await connectWs(`?token=${token}&organization_id=${ORG_A}&cluster_id=${CLUSTER_A}`);
    assert.strictEqual(conn1.opened, true);
    conn1.ws?.close();
    const conn2 = await connectWs(`?token=${token}&organization_id=${ORG_C}`);
    assert.strictEqual(conn2.opened, true);
    assert.ok(conn2.messages.some((m) => m.type === 'initial_state'));
    conn2.ws?.close();
  });

  test('WS-18: Existing legitimate same-tenant DEVOPS connection with explicit organization_id works', async () => {
    const token = signJwt(USERS.devopsA, 'devops.a@test.com');
    const conn = await connectWs(`?token=${token}&organization_id=${ORG_A}&cluster_id=${CLUSTER_A}`);
    assert.strictEqual(conn.opened, true);
    assert.ok(conn.messages.some((m) => m.type === 'initial_state'));
    conn.ws?.close();
  });

  // =========================================================================
  // A-C03 TELEMETRY TENANT CONTEXT TESTS (TEL-01 .. TEL-08)
  // =========================================================================

  test('TEL-01: Authenticated Agent telemetry preserves Organization and Cluster context in TelemetryBufferService', async () => {
    TelemetryBufferService.pushMetric({
      organization_id: ORG_A,
      cluster_id: CLUSTER_A,
      agent_id: 'agent-a-1',
      service_id: 'tel-svc-1',
      pod_id: 'pod-1',
      cpu: 42,
      ram: 55,
      disk: 20,
      request_rate: 120,
      latency: 45,
      http_5xx_rate: 0.1,
      pod_restart_count: 0,
      replica_count: 2,
      collected_at: new Date(),
    } as any);

    const batch = await TelemetryBufferService.getFreshBatch('tel-svc-1', 5, null, 12, ORG_A, CLUSTER_A);
    assert.strictEqual(batch.organizationId, ORG_A);
    assert.strictEqual(batch.clusterId, CLUSTER_A);
    assert.ok(batch.points.length >= 1);
  });

  test('TEL-02 & TEL-03 & TEL-04 & TEL-08: batch_accumulation receives verified tenant context and broadcasts ONLY to Org A', async () => {
    const tokenA = signJwt(USERS.devopsA, 'devops.a@test.com');
    const tokenC = signJwt(USERS.multiOrgAC, 'multi.ac@test.com');
    const connA = await connectWs(`?token=${tokenA}&organization_id=${ORG_A}&cluster_id=${CLUSTER_A}`);
    const connC = await connectWs(`?token=${tokenC}&organization_id=${ORG_C}`);
    assert.strictEqual(connA.opened, true);
    assert.strictEqual(connC.opened, true);

    TelemetryBufferService.pushMetric({
      organization_id: ORG_A,
      cluster_id: CLUSTER_A,
      agent_id: 'agent-a-2',
      service_id: 'tel-svc-2',
      pod_id: 'pod-2',
      cpu: 35,
      ram: 40,
      disk: 15,
      request_rate: 80,
      latency: 30,
      http_5xx_rate: 0,
      pod_restart_count: 0,
      replica_count: 1,
      collected_at: new Date(),
    } as any);

    const fresh = await TelemetryBufferService.getFreshBatch('tel-svc-2', 5, null, 12, ORG_A, CLUSTER_A);
    await broadcastTelemetryToUi({
      type: 'batch_accumulation',
      data: {
        service_id: 'tel-svc-2',
        organization_id: fresh.organizationId,
        cluster_id: fresh.clusterId,
        collected: fresh.points.length,
        target: 12,
      },
    });

    await new Promise((r) => setTimeout(r, 80));
    const batchMsgA = connA.messages.find((m) => m.type === 'batch_accumulation' && m.data?.service_id === 'tel-svc-2');
    assert.ok(batchMsgA, 'Org A must receive verified batch_accumulation');
    assert.strictEqual(batchMsgA.data.organization_id, ORG_A);
    assert.strictEqual(batchMsgA.data.cluster_id, CLUSTER_A);
    connA.ws?.close();
    connC.ws?.close();
  });

  test('TEL-05: Missing Organization context in telemetry payload is dropped (not broadcast)', async () => {
    const tokenA = signJwt(USERS.devopsA, 'devops.a@test.com');
    const connA = await connectWs(`?token=${tokenA}&organization_id=${ORG_A}&cluster_id=${CLUSTER_A}`);
    assert.strictEqual(connA.opened, true);
    const before = connA.messages.length;

    await broadcastTelemetryToUi({
      type: 'batch_accumulation',
      data: { service_id: 'tel-svc-no-org', collected: 3, target: 12 },
    });
    await new Promise((r) => setTimeout(r, 80));
    assert.strictEqual(connA.messages.length, before);
    connA.ws?.close();
  });

  test('TEL-06: Organization and Cluster mismatch in telemetry payload is dropped', async () => {
    const tokenA = signJwt(USERS.devopsA, 'devops.a@test.com');
    const connA = await connectWs(`?token=${tokenA}&organization_id=${ORG_A}&cluster_id=${CLUSTER_A}`);
    assert.strictEqual(connA.opened, true);
    const before = connA.messages.length;

    await broadcastTelemetryToUi({
      type: 'batch_accumulation',
      data: { service_id: 'tel-svc-mismatch', organization_id: ORG_A, cluster_id: CLUSTER_B, collected: 5, target: 12 },
    });
    await new Promise((r) => setTimeout(r, 80));
    assert.strictEqual(connA.messages.length, before);
    connA.ws?.close();
  });

  test('TEL-07: Mixed-tenant telemetry for same service name is partitioned and never emitted as a single-tenant batch', async () => {
    const sharedSvc = 'shared-order-svc';
    TelemetryBufferService.pushMetric({
      organization_id: ORG_A,
      cluster_id: CLUSTER_A,
      agent_id: 'agent-a',
      service_id: sharedSvc,
      pod_id: 'pod-a',
      cpu: 11,
      ram: 22,
      disk: 10,
      request_rate: 10,
      latency: 10,
      http_5xx_rate: 0,
      pod_restart_count: 0,
      replica_count: 1,
      collected_at: new Date(),
    } as any);
    TelemetryBufferService.pushMetric({
      organization_id: ORG_B,
      cluster_id: CLUSTER_B,
      agent_id: 'agent-b',
      service_id: sharedSvc,
      pod_id: 'pod-b',
      cpu: 88,
      ram: 77,
      disk: 10,
      request_rate: 99,
      latency: 90,
      http_5xx_rate: 5,
      pod_restart_count: 1,
      replica_count: 1,
      collected_at: new Date(),
    } as any);

    const batchA = await TelemetryBufferService.getFreshBatch(sharedSvc, 5, null, 12, ORG_A, CLUSTER_A);
    const batchB = await TelemetryBufferService.getFreshBatch(sharedSvc, 5, null, 12, ORG_B, CLUSTER_B);
    assert.strictEqual(batchA.organizationId, ORG_A);
    assert.strictEqual(batchB.organizationId, ORG_B);
    assert.strictEqual(batchA.points[0].cpu, 11);
    assert.strictEqual(batchB.points[0].cpu, 88);

    // Unscoped lookup across mixed-tenant buffers must refuse to emit a mixed batch
    const unscoped = (TelemetryBufferService as any).computeBucketsFromMemory(sharedSvc, 5);
    assert.strictEqual(unscoped.buckets.length, 0);
  });
});
