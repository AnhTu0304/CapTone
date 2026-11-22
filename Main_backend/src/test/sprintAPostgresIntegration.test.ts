import test, { describe, before, after } from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import { AddressInfo } from 'node:net';
import jwt from 'jsonwebtoken';
import app from '../app';
import { config } from '../config/env';
import { pool } from '../config/database';
import { closeRedis } from '../config/redis';
import { HealingActionModel } from '../models/healingAction.model';
import { HealingActionService } from '../services/healingAction.service';

const ORG_A = 'a5a50000-0000-4000-8000-000000000001';
const ORG_B = 'a5a50000-0000-4000-8000-000000000002';
const DEFAULT_LAB_ORG = '00000000-0000-0000-0000-000000000001';

const ENV_A = 'a5a50000-0000-4000-8000-000000000011';
const ENV_B = 'a5a50000-0000-4000-8000-000000000012';
const CLUSTER_A = 'a5a50000-0000-4000-8000-000000000021';
const CLUSTER_B = 'a5a50000-0000-4000-8000-000000000022';
const INC_A = 'a5a50000-0000-4000-8000-000000000031';
const INC_B = 'a5a50000-0000-4000-8000-000000000032';
const ACT_A = 'a5a50000-0000-4000-8000-000000000041';
const ACT_B = 'a5a50000-0000-4000-8000-000000000042';
const ACT_TYPE_TEST = 'a5a50000-0000-4000-8000-000000000051';

const USERS = {
  sysAdmin: 'a5a50000-0000-4000-8000-000000000101',
  orgAdminA: 'a5a50000-0000-4000-8000-000000000102',
  smeOwnerA: 'a5a50000-0000-4000-8000-000000000103',
  devopsA: 'a5a50000-0000-4000-8000-000000000104',
  multiOrgAB: 'a5a50000-0000-4000-8000-000000000105',
};

function signJwt(id: string, email: string, roles: string[] = ['USER']) {
  return jwt.sign({ id, email, status: 'ACTIVE', roles }, config.jwt.secret, {
    algorithm: 'HS256',
    expiresIn: '1h',
  });
}

describe('A-C01: Real PostgreSQL Integration Security Tests (PG-01..PG-10)', () => {
  let server: http.Server;
  let baseUrl: string;

  before(async () => {
    const dbCheck = await pool.query('SELECT current_database() AS db');
    const currentDb = dbCheck.rows[0]?.db;
    if (currentDb !== 'aiselfhealing_test') {
      throw new Error(`SAFETY ABORT: Refusing to run PostgreSQL integration tests on '${currentDb}'. Expected 'aiselfhealing_test'.`);
    }

    // Seed isolated test users
    await pool.query(
      `INSERT INTO users (id, email, password_hash, full_name, status)
       VALUES
         ($1, 'pg.sysadmin@test.local', 'hash', 'PG SysAdmin', 'ACTIVE'),
         ($2, 'pg.orgadmin.a@test.local', 'hash', 'PG OrgAdmin A', 'ACTIVE'),
         ($3, 'pg.owner.a@test.local', 'hash', 'PG Owner A', 'ACTIVE'),
         ($4, 'pg.devops.a@test.local', 'hash', 'PG DevOps A', 'ACTIVE'),
         ($5, 'pg.multi.ab@test.local', 'hash', 'PG Multi AB', 'ACTIVE')
       ON CONFLICT (id) DO UPDATE SET status = 'ACTIVE', deleted_at = NULL;`,
      [USERS.sysAdmin, USERS.orgAdminA, USERS.smeOwnerA, USERS.devopsA, USERS.multiOrgAB]
    );

    // Ensure system roles & org roles exist
    const sysRolesRes = await pool.query(`SELECT id, name FROM system_roles WHERE name IN ('ADMIN', 'USER')`);
    const sysAdminRoleId = sysRolesRes.rows.find((r) => r.name === 'ADMIN')?.id;
    const sysUserRoleId = sysRolesRes.rows.find((r) => r.name === 'USER')?.id;
    assert.ok(sysAdminRoleId, 'ADMIN system role must exist in aiselfhealing_test');

    await pool.query(
      `INSERT INTO user_system_roles (user_id, system_role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [USERS.sysAdmin, sysAdminRoleId]
    );
    if (sysUserRoleId) {
      for (const uid of [USERS.orgAdminA, USERS.smeOwnerA, USERS.devopsA, USERS.multiOrgAB]) {
        await pool.query(
          `INSERT INTO user_system_roles (user_id, system_role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [uid, sysUserRoleId]
        );
      }
    }

    // Organizations
    await pool.query(
      `INSERT INTO organizations (id, name, slug, status)
       VALUES
         ($1, 'PG Test Org A', 'pg-test-org-a', 'ACTIVE'),
         ($2, 'PG Test Org B', 'pg-test-org-b', 'ACTIVE')
       ON CONFLICT (id) DO NOTHING;`,
      [ORG_A, ORG_B]
    );

    // Organization roles
    const orgRolesRes = await pool.query(`SELECT id, code FROM organization_roles WHERE code IN ('ADMIN', 'SME_OWNER', 'DEVOPS')`);
    const orgAdminRoleId = orgRolesRes.rows.find((r) => r.code === 'ADMIN')?.id;
    const smeOwnerRoleId = orgRolesRes.rows.find((r) => r.code === 'SME_OWNER')?.id;
    const devopsRoleId = orgRolesRes.rows.find((r) => r.code === 'DEVOPS')?.id;
    assert.ok(smeOwnerRoleId && devopsRoleId, 'Organization roles SME_OWNER and DEVOPS must exist');

    if (orgAdminRoleId) {
      await pool.query(
        `INSERT INTO organization_members (organization_id, user_id, role_id, status) VALUES ($1, $2, $3, 'ACTIVE') ON CONFLICT DO NOTHING`,
        [ORG_A, USERS.orgAdminA, orgAdminRoleId]
      );
    }
    await pool.query(
      `INSERT INTO organization_members (organization_id, user_id, role_id, status)
       VALUES
         ($1, $3, $5, 'ACTIVE'),
         ($1, $4, $6, 'ACTIVE'),
         ($1, $7, $6, 'ACTIVE'),
         ($2, $7, $6, 'ACTIVE')
       ON CONFLICT DO NOTHING;`,
      [ORG_A, ORG_B, USERS.smeOwnerA, USERS.devopsA, smeOwnerRoleId, devopsRoleId, USERS.multiOrgAB]
    );

    // Environments & Clusters
    await pool.query(
      `INSERT INTO environments (id, organization_id, name, status)
       VALUES ($1, $3, 'PG Env A', 'ACTIVE'), ($2, $4, 'PG Env B', 'ACTIVE')
       ON CONFLICT (id) DO NOTHING;`,
      [ENV_A, ENV_B, ORG_A, ORG_B]
    );
    await pool.query(
      `INSERT INTO clusters (id, environment_id, name, status)
       VALUES ($1, $3, 'pg-cluster-a', 'CONNECTED'), ($2, $4, 'pg-cluster-b', 'CONNECTED')
       ON CONFLICT (id) DO NOTHING;`,
      [CLUSTER_A, CLUSTER_B, ENV_A, ENV_B]
    );

    // Incidents & Action Type & Healing Actions
    await pool.query(
      `INSERT INTO incidents (id, organization_id, environment_id, cluster_id, source_type, target_type, incident_type, title, severity, status)
       VALUES
         ($1, $3, $5, $7, 'AI_GRU', 'POD', 'HIGH_CPU', 'PG Incident A', 'HIGH', 'OPEN'),
         ($2, $4, $6, $8, 'AI_GRU', 'POD', 'HIGH_CPU', 'PG Incident B', 'HIGH', 'OPEN')
       ON CONFLICT (id) DO NOTHING;`,
      [INC_A, INC_B, ORG_A, ORG_B, ENV_A, ENV_B, CLUSTER_A, CLUSTER_B]
    );

    await pool.query(
      `INSERT INTO healing_action_types (id, code, name, description, target_type, default_risk_level, requires_approval_by_default, enabled)
       VALUES ($1, 'PG_TEST_RESTART', 'PG Test Restart', 'Test action type', 'POD', 'LOW', FALSE, TRUE)
       ON CONFLICT (id) DO NOTHING;`,
      [ACT_TYPE_TEST]
    );

    await pool.query(
      `INSERT INTO healing_actions (id, incident_id, environment_id, action_type_id, target_type, target_name, risk_level, execution_mode, approval_status, execution_status)
       VALUES
         ($1, $3, $5, $7, 'POD', 'svc-a', 'LOW', 'MANUAL', 'APPROVED', 'PENDING'),
         ($2, $4, $6, $7, 'POD', 'svc-b', 'LOW', 'MANUAL', 'APPROVED', 'PENDING')
       ON CONFLICT (id) DO NOTHING;`,
      [ACT_A, ACT_B, INC_A, INC_B, ENV_A, ENV_B, ACT_TYPE_TEST]
    );

    server = http.createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        const addr = server.address() as AddressInfo;
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  after(async () => {
    const dbCheck = await pool.query('SELECT current_database() AS db');
    if (dbCheck.rows[0]?.db === 'aiselfhealing_test') {
      await pool.query(`DELETE FROM healing_actions WHERE id IN ($1, $2)`, [ACT_A, ACT_B]);
      await pool.query(`DELETE FROM healing_action_types WHERE id = $1`, [ACT_TYPE_TEST]);
      await pool.query(`DELETE FROM incidents WHERE id IN ($1, $2)`, [INC_A, INC_B]);
      await pool.query(`DELETE FROM clusters WHERE id IN ($1, $2)`, [CLUSTER_A, CLUSTER_B]);
      await pool.query(`DELETE FROM environments WHERE id IN ($1, $2)`, [ENV_A, ENV_B]);
      await pool.query(`DELETE FROM organization_members WHERE organization_id IN ($1, $2)`, [ORG_A, ORG_B]);
      await pool.query(`DELETE FROM organizations WHERE id IN ($1, $2)`, [ORG_A, ORG_B]);
      await pool.query(`DELETE FROM user_system_roles WHERE user_id = ANY($1::uuid[])`, [Object.values(USERS)]);
      await pool.query(`DELETE FROM users WHERE id = ANY($1::uuid[])`, [Object.values(USERS)]);
    }
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    await closeRedis().catch(() => {});
    await pool.end().catch(() => {});
  });

  test('PG-01: Cross-Organization membership — Org A SME_OWNER accessing Org B returns 403', async () => {
    const token = signJwt(USERS.smeOwnerA, 'pg.owner.a@test.local');
    const res = await fetch(`${baseUrl}/api/v1/healing/actions/${ACT_B}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'x-organization-id': ORG_B },
      body: JSON.stringify({ status: 'SUCCEEDED' }),
    });
    assert.strictEqual(res.status, 403);
  });

  test('PG-02: Missing organization_id on tenant-scoped request returns HTTP 400', async () => {
    const token = signJwt(USERS.devopsA, 'pg.devops.a@test.local');
    const res = await fetch(`${baseUrl}/api/v1/healing/actions/${ACT_A}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'SUCCEEDED' }),
    });
    assert.strictEqual(res.status, 400);
  });

  test('PG-03: organization_id=all returns HTTP 403', async () => {
    const token = signJwt(USERS.devopsA, 'pg.devops.a@test.local');
    const res = await fetch(`${baseUrl}/api/v1/healing/actions/${ACT_A}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'x-organization-id': 'all' },
      body: JSON.stringify({ status: 'SUCCEEDED' }),
    });
    assert.strictEqual(res.status, 403);
  });

  test('PG-04: Default Lab Organization (00000000-...-0001) without membership returns HTTP 403', async () => {
    const token = signJwt(USERS.devopsA, 'pg.devops.a@test.local');
    const res = await fetch(`${baseUrl}/api/v1/healing/actions/${ACT_A}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'x-organization-id': DEFAULT_LAB_ORG },
      body: JSON.stringify({ status: 'SUCCEEDED' }),
    });
    assert.strictEqual(res.status, 403);
  });

  test('PG-05: Cross-tenant Healing Action update (Org A -> Act B) returns 403 and leaves DB unmodified', async () => {
    const token = signJwt(USERS.devopsA, 'pg.devops.a@test.local');
    const res = await fetch(`${baseUrl}/api/v1/healing/actions/${ACT_B}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'x-organization-id': ORG_A },
      body: JSON.stringify({ status: 'SUCCEEDED' }),
    });
    assert.strictEqual(res.status, 403);

    const dbRow = await pool.query(`SELECT execution_status FROM healing_actions WHERE id = $1`, [ACT_B]);
    assert.strictEqual(dbRow.rows[0].execution_status, 'PENDING');
  });

  test('PG-06: Mismatched Environment (Org A) and Incident (Org B) on createAction is rejected (403) with no DB insert', async () => {
    const token = signJwt(USERS.devopsA, 'pg.devops.a@test.local');
    const beforeCount = Number((await pool.query(`SELECT count(*) FROM healing_actions`)).rows[0].count);

    const res = await fetch(`${baseUrl}/api/v1/healing/actions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'x-organization-id': ORG_A },
      body: JSON.stringify({
        incident_id: INC_B,
        environment_id: ENV_A,
        action_type_id: ACT_TYPE_TEST,
        target_name: 'svc-a',
      }),
    });
    assert.strictEqual(res.status, 403);

    const afterCount = Number((await pool.query(`SELECT count(*) FROM healing_actions`)).rows[0].count);
    assert.strictEqual(afterCount, beforeCount);
  });

  test('PG-07: System ADMIN modifies global Healing Action Type (200); Organization ADMIN is denied (403)', async () => {
    const sysToken = signJwt(USERS.sysAdmin, 'pg.sysadmin@test.local', ['ADMIN']);
    const sysRes = await fetch(`${baseUrl}/api/v1/healing/action-types/${ACT_TYPE_TEST}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${sysToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: 'Updated by System ADMIN' }),
    });
    assert.strictEqual(sysRes.status, 200);

    const orgAdminToken = signJwt(USERS.orgAdminA, 'pg.orgadmin.a@test.local', ['USER']);
    const orgRes = await fetch(`${baseUrl}/api/v1/healing/action-types/${ACT_TYPE_TEST}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${orgAdminToken}`, 'Content-Type': 'application/json', 'x-organization-id': ORG_A },
      body: JSON.stringify({ description: 'Tampered by Org ADMIN' }),
    });
    assert.strictEqual(orgRes.status, 403);

    const dbRow = await pool.query(`SELECT description FROM healing_action_types WHERE id = $1`, [ACT_TYPE_TEST]);
    assert.strictEqual(dbRow.rows[0].description, 'Updated by System ADMIN');
  });

  test('PG-08: Atomic tenant-scoped UPDATE succeeds for matching org and modifies 0 rows for mismatched org', async () => {
    // Mismatched tenant: ORG_A trying to update ACT_B
    const wrongUpdate = await HealingActionModel.updateStatus(ACT_B, 'RUNNING', undefined, undefined, ORG_A);
    assert.strictEqual(wrongUpdate, null);
    const actBRow = await pool.query(`SELECT execution_status FROM healing_actions WHERE id = $1`, [ACT_B]);
    assert.strictEqual(actBRow.rows[0].execution_status, 'PENDING');

    // Matching tenant: ORG_A updating ACT_A
    const okUpdate = await HealingActionModel.updateStatus(ACT_A, 'RUNNING', undefined, undefined, ORG_A);
    assert.ok(okUpdate);
    assert.strictEqual(okUpdate.execution_status, 'RUNNING');
  });

  test('PG-09: Multi-org user (Org A & B) explicitly accessing Org B can access B-scoped resources only', async () => {
    const token = signJwt(USERS.multiOrgAB, 'pg.multi.ab@test.local');
    const resB = await fetch(`${baseUrl}/api/v1/healing/actions/${ACT_B}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'x-organization-id': ORG_B },
      body: JSON.stringify({ status: 'COMPLETED' }),
    });
    assert.strictEqual(resB.status, 200);

    // Same user with Org B header cannot update Org A's action
    const resCross = await fetch(`${baseUrl}/api/v1/healing/actions/${ACT_A}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'x-organization-id': ORG_B },
      body: JSON.stringify({ status: 'FAILED' }),
    });
    assert.strictEqual(resCross.status, 403);
  });

  test('PG-10: Real DB schema ownership check rejects cross-tenant cluster/org combinations', async () => {
    await assert.rejects(
      () => HealingActionService.validateUserOrgAndCluster({ id: USERS.devopsA, roles: ['USER'] }, ORG_A, CLUSTER_B),
      (err: any) => err.statusCode === 403
    );
    const valid = await HealingActionService.validateUserOrgAndCluster({ id: USERS.devopsA, roles: ['USER'] }, ORG_A, CLUSTER_A);
    assert.strictEqual(valid.orgId, ORG_A);
    assert.strictEqual(valid.clusterId, CLUSTER_A);
  });
});
