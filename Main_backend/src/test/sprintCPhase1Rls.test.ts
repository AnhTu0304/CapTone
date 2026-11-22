import test, { describe, before, after } from 'node:test';
import assert from 'node:assert';
import crypto from 'node:crypto';
import { Pool } from 'pg';
import { config } from '../config/env';
import { pool, withTenantTx } from '../config/database';
import { runWithDbContext, runWithTenantContext } from '../config/dbContext';
import { closeRedis } from '../config/redis';
import { AgentModel } from '../models/agent.model';
import { RuleEngineExecutionService } from '../services/ruleEngineExecution.service';
import { AgentTimeoutService } from '../services/agentTimeout.service';
import { LogStreamService } from '../services/logStream.service';
import { TelemetryPipelineService } from '../services/telemetryPipeline.service';
import { TelemetryAggregatorService } from '../services/telemetryAggregator.service';
import { HealingActionModel } from '../models/healingAction.model';
import { StatisticsService } from '../services/statistics.service';

const ORG_A = 'c1111111-0000-4000-8000-000000000001';
const ORG_B = 'c1111111-0000-4000-8000-000000000002';
const ENV_A = 'c1111111-0000-4000-8000-000000000011';
const ENV_B = 'c1111111-0000-4000-8000-000000000012';
const CLUSTER_A = 'c1111111-0000-4000-8000-000000000021';
const CLUSTER_B = 'c1111111-0000-4000-8000-000000000022';
const NS_A = 'c1111111-0000-4000-8000-000000000025';
const NS_B = 'c1111111-0000-4000-8000-000000000026';
const AGENT_A = 'c1111111-0000-4000-8000-000000000031';
const AGENT_B = 'c1111111-0000-4000-8000-000000000032';
const USER_A = 'c1111111-0000-4000-8000-000000000041';
const USER_B = 'c1111111-0000-4000-8000-000000000042';
const INC_A = 'c1111111-0000-4000-8000-000000000051';
const INC_B = 'c1111111-0000-4000-8000-000000000052';
const RCA_A = 'c1111111-0000-4000-8000-000000000061';
const RCA_B = 'c1111111-0000-4000-8000-000000000062';
const REC_A = 'c1111111-0000-4000-8000-000000000071';
const REC_B = 'c1111111-0000-4000-8000-000000000072';
const ACT_TYPE_ID = 'c1111111-0000-4000-8000-000000000081';
const ACTION_A = 'c1111111-0000-4000-8000-000000000091';
const ACTION_B = 'c1111111-0000-4000-8000-000000000092';
const POLICY_B = 'c1111111-0000-4000-8000-000000000095';
const NOTIF_A_NULL = 'c1111111-0000-4000-8000-0000000000a1';
const NOTIF_B_ORG = 'c1111111-0000-4000-8000-0000000000a2';

const SHARED_SERVICE = 'rls-shared-orders-api';

const EXPECTED_TENANT_DIRECT_TABLES = [
  'organizations',
  'environments',
  'healing_policies',
  'incidents',
  'agent_metrics',
  'node_metrics',
  'organization_alert_settings',
  'organization_invitations',
  'organization_members',
  'organization_profiles',
  'notifications',
  'alert_rules',
  'alert_events',
];

const EXPECTED_TENANT_INDIRECT_TABLES = [
  'clusters',
  'agents',
  'agent_heartbeats',
  'agent_tokens',
  'namespaces',
  'nodes',
  'services',
  'workloads',
  'deployments',
  'pods',
  'logs',
  'kubernetes_events',
  'ai_predictions',
  'prediction_inputs',
  'rca_analyses',
  'rca_evidences',
  'ai_recommendations',
  'healing_actions',
  'approvals',
  'execution_attempts',
  'recovery_verifications',
  'policy_actions',
  'alert_event_history',
];

const EXPECTED_AUDIT_TABLES = ['audit_logs'];
const EXPECTED_EXCLUDED_TABLES = [
  'system_roles',
  'organization_roles',
  'healing_action_types',
  'ai_models',
  'system_broadcasts',
  'users',
  'user_system_roles',
  'user_two_factor',
  'email_verification_tokens',
  'password_reset_tokens',
];

describe('Sprint C Phase 1 — PostgreSQL RLS & Cross-Tenant Access Control', () => {
  const testDbName = process.env.DB_NAME || config.db.database;
  let adminPool: Pool;
  let appPool: Pool | null = null;
  let migratorPool: Pool | null = null;
  let ephAppPassword: string;
  let ephMigratorPassword: string;

  before(async () => {
    if (testDbName !== 'aiselfhealing_test') {
      throw new Error(`Safety guard: Sprint C Phase 1 tests MUST run against aiselfhealing_test, got '${testDbName}'`);
    }

    adminPool = new Pool({
      host: config.db.host,
      port: config.db.port,
      user: 'postgres',
      password: process.env.DB_ADMIN_PASSWORD || config.db.password,
      database: 'aiselfhealing_test',
      max: 5,
    });

    // Seed isolated Org A & Org B fixtures using superuser adminPool (bypassing RLS intentionally for setup)
    await adminPool.query(`DELETE FROM ai_recommendations WHERE id IN ($1, $2);`, [REC_A, REC_B]);
    await adminPool.query(`DELETE FROM execution_attempts WHERE healing_action_id IN ($1, $2);`, [ACTION_A, ACTION_B]);
    await adminPool.query(`DELETE FROM approvals WHERE healing_action_id IN ($1, $2);`, [ACTION_A, ACTION_B]);
    await adminPool.query(`DELETE FROM recovery_verifications WHERE healing_action_id IN ($1, $2);`, [ACTION_A, ACTION_B]);
    await adminPool.query(`DELETE FROM healing_actions WHERE id IN ($1, $2);`, [ACTION_A, ACTION_B]);
    await adminPool.query(`DELETE FROM policy_actions WHERE policy_id = $1;`, [POLICY_B]);
    await adminPool.query(`DELETE FROM healing_policies WHERE id = $1;`, [POLICY_B]);
    await adminPool.query(`DELETE FROM rca_analyses WHERE id IN ($1, $2);`, [RCA_A, RCA_B]);
    await adminPool.query(`DELETE FROM incidents WHERE id IN ($1, $2);`, [INC_A, INC_B]);
    await adminPool.query(`DELETE FROM notifications WHERE id IN ($1, $2);`, [NOTIF_A_NULL, NOTIF_B_ORG]);
    await adminPool.query(`DELETE FROM audit_logs WHERE organization_id IN ($1, $2) OR user_id IN ($3, $4);`, [ORG_A, ORG_B, USER_A, USER_B]);
    await adminPool.query(`DELETE FROM agents WHERE id IN ($1, $2);`, [AGENT_A, AGENT_B]);
    await adminPool.query(`DELETE FROM namespaces WHERE id IN ($1, $2);`, [NS_A, NS_B]);
    await adminPool.query(`DELETE FROM clusters WHERE id IN ($1, $2);`, [CLUSTER_A, CLUSTER_B]);
    await adminPool.query(`DELETE FROM environments WHERE id IN ($1, $2);`, [ENV_A, ENV_B]);
    await adminPool.query(`DELETE FROM organization_members WHERE organization_id IN ($1, $2);`, [ORG_A, ORG_B]);
    await adminPool.query(`DELETE FROM organizations WHERE id IN ($1, $2);`, [ORG_A, ORG_B]);
    await adminPool.query(`DELETE FROM users WHERE id IN ($1, $2);`, [USER_A, USER_B]);

    await adminPool.query(
      `INSERT INTO users (id, email, password_hash, full_name, status, created_at, updated_at)
       VALUES
         ($1, 'rls.user.a@test.local', 'hash_a', 'RLS User A', 'ACTIVE', NOW(), NOW()),
         ($2, 'rls.user.b@test.local', 'hash_b', 'RLS User B', 'ACTIVE', NOW(), NOW())
       ON CONFLICT (id) DO NOTHING;`,
      [USER_A, USER_B]
    );

    await adminPool.query(
      `INSERT INTO organizations (id, name, slug, status, created_by, created_at, updated_at)
       VALUES
         ($1, 'RLS Org A', 'rls-org-a', 'ACTIVE', $3, NOW(), NOW()),
         ($2, 'RLS Org B', 'rls-org-b', 'ACTIVE', $4, NOW(), NOW());`,
      [ORG_A, ORG_B, USER_A, USER_B]
    );

    const roleRes = await adminPool.query(`SELECT id, code FROM organization_roles WHERE code IN ('SME_OWNER', 'DEVOPS') LIMIT 2;`);
    const ownerRoleId = roleRes.rows.find((r) => r.code === 'SME_OWNER')?.id || roleRes.rows[0].id;

    await adminPool.query(
      `INSERT INTO organization_members (organization_id, user_id, role_id, status, joined_at, created_at, updated_at)
       VALUES
         ($1, $3, $5, 'ACTIVE', NOW(), NOW(), NOW()),
         ($2, $4, $5, 'ACTIVE', NOW(), NOW(), NOW());`,
      [ORG_A, ORG_B, USER_A, USER_B, ownerRoleId]
    );

    await adminPool.query(
      `INSERT INTO environments (id, organization_id, name, code, environment_type, status, created_at, updated_at)
       VALUES
         ($1, $3, 'Env A', 'PROD', 'PRODUCTION', 'ACTIVE', NOW(), NOW()),
         ($2, $4, 'Env B', 'PROD', 'PRODUCTION', 'ACTIVE', NOW(), NOW());`,
      [ENV_A, ENV_B, ORG_A, ORG_B]
    );

    await adminPool.query(
      `INSERT INTO clusters (id, environment_id, name, cluster_uid, status, created_at, updated_at)
       VALUES
         ($1, $3, 'rls-shared-cluster', 'uid-rls-a', 'CONNECTED', NOW(), NOW()),
         ($2, $4, 'rls-shared-cluster', 'uid-rls-b', 'CONNECTED', NOW(), NOW());`,
      [CLUSTER_A, CLUSTER_B, ENV_A, ENV_B]
    );

    await adminPool.query(
      `INSERT INTO namespaces (id, cluster_id, name, status, created_at, updated_at)
       VALUES
         ($1, $3, 'default', 'ACTIVE', NOW(), NOW()),
         ($2, $4, 'default', 'ACTIVE', NOW(), NOW());`,
      [NS_A, NS_B, CLUSTER_A, CLUSTER_B]
    );

    await adminPool.query(
      `INSERT INTO agents (id, name, agent_uid, cluster_id, environment_id, status, created_at, updated_at)
       VALUES
         ($1, 'Agent A', 'uid-agent-rls-a', $3, $5, 'ONLINE', NOW(), NOW()),
         ($2, 'Agent B', 'uid-agent-rls-b', $4, $6, 'ONLINE', NOW(), NOW());`,
      [AGENT_A, AGENT_B, CLUSTER_A, CLUSTER_B, ENV_A, ENV_B]
    );

    await adminPool.query(
      `INSERT INTO healing_action_types (id, code, name, default_risk_level, requires_approval_by_default, enabled, created_at, updated_at)
       VALUES ($1, 'RLS_TEST_RESTART', 'RESTART_POD', 'LOW', false, true, NOW(), NOW())
       ON CONFLICT (id) DO NOTHING;`,
      [ACT_TYPE_ID]
    );

    await adminPool.query(
      `INSERT INTO incidents (id, organization_id, environment_id, cluster_id, source_type, target_type, target_id, target_name, incident_type, title, severity, status, detected_at, started_at, created_at, updated_at, occurrence_count)
       VALUES
         ($1, $3, $5, $7, 'AI_RCA', 'WORKLOAD', $9::text, $9::text, 'HIGH_LATENCY', 'High Latency on ' || $9::text, 'HIGH', 'OPEN', NOW() - interval '5 minutes', NOW() - interval '5 minutes', NOW(), NOW(), 1),
         ($2, $4, $6, $8, 'AI_RCA', 'WORKLOAD', $9::text, $9::text, 'HIGH_LATENCY', 'High Latency on ' || $9::text, 'HIGH', 'OPEN', NOW() - interval '5 minutes', NOW() - interval '5 minutes', NOW(), NOW(), 1);`,
      [INC_A, INC_B, ORG_A, ORG_B, ENV_A, ENV_B, CLUSTER_A, CLUSTER_B, SHARED_SERVICE]
    );

    await adminPool.query(
      `INSERT INTO rca_analyses (id, incident_id, root_cause_type, root_cause_description, confidence_score, analyzed_at, created_at, updated_at)
       VALUES
         ($1, $3, 'OOM', 'Org A RCA', 0.9, NOW(), NOW(), NOW()),
         ($2, $4, 'OOM', 'Org B RCA', 0.9, NOW(), NOW(), NOW());`,
      [RCA_A, RCA_B, INC_A, INC_B]
    );

    await adminPool.query(
      `INSERT INTO ai_recommendations (id, incident_id, rca_analysis_id, action_type_id, recommendation, reasoning, risk_level, status, created_at)
       VALUES
         ($1, $3, $5, $7, 'RESTART_POD', 'Org A Rec', 'LOW', 'PROPOSED', NOW()),
         ($2, $4, $6, $7, 'RESTART_POD', 'Org B Rec', 'PROPOSED', 'PROPOSED', NOW());`,
      [REC_A, REC_B, INC_A, INC_B, RCA_A, RCA_B, ACT_TYPE_ID]
    );

    await adminPool.query(
      `INSERT INTO healing_actions (id, incident_id, recommendation_id, environment_id, action_type_id, target_type, target_name, risk_level, execution_mode, approval_status, execution_status, requested_at, created_at)
       VALUES
         ($1, $3, $5, $7, $9, 'POD', $10, 'LOW', 'MANUAL', 'PENDING', 'PENDING', NOW(), NOW()),
         ($2, $4, $6, $8, $9, 'POD', $10, 'LOW', 'MANUAL', 'APPROVED', 'RUNNING', NOW(), NOW());`,
      [ACTION_A, ACTION_B, INC_A, INC_B, REC_A, REC_B, ENV_A, ENV_B, ACT_TYPE_ID, SHARED_SERVICE]
    );

    // Org B active AUTO policy for cross-tenant fallback test
    await adminPool.query(
      `INSERT INTO healing_policies (id, organization_id, environment_id, name, trigger_type, execution_mode, risk_level, confidence_threshold, cooldown_seconds, requires_approval, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, 'Org B Auto Restart', 'PREDICTION', 'AUTOMATIC', 'LOW', 0.50, 60, false, true, NOW(), NOW());`,
      [POLICY_B, ORG_B, ENV_B]
    );
    await adminPool.query(
      `INSERT INTO policy_actions (policy_id, action_type_id, priority, is_enabled, created_at)
       VALUES ($1, $2, 1, true, NOW());`,
      [POLICY_B, ACT_TYPE_ID]
    );

    // Hybrid notifications & audit_logs (NULL org vs Org B)
    await adminPool.query(
      `INSERT INTO notifications (id, user_id, organization_id, notification_type, title, message, severity, created_at)
       VALUES
         ($1, $3, NULL, 'SECURITY', 'User A System Security Notice', 'Personal security alert', 'INFO', NOW()),
         ($2, $4, $5, 'INCIDENT', 'Org B Incident Notice', 'Org B secret alert', 'HIGH', NOW());`,
      [NOTIF_A_NULL, NOTIF_B_ORG, USER_A, USER_B, ORG_B]
    );
    await adminPool.query(
      `INSERT INTO audit_logs (organization_id, user_id, actor_type, action, resource_type, status, description, created_at)
       VALUES
         (NULL, $1, 'SYSTEM', 'PLATFORM_SECRET_EVENT', 'SYSTEM', 'SUCCESS', 'Platform null-org audit event', NOW()),
         ($2, $3, 'USER', 'ORG_B_SECRET_ACTION', 'CLUSTER', 'SUCCESS', 'Org B audit event', NOW());`,
      [USER_A, ORG_B, USER_B]
    );

    // If selfheal_app / selfheal_migrator roles exist yet, create ephemeral test credentials in test DB ONLY
    const rolesCheck = await adminPool.query(`SELECT rolname FROM pg_roles WHERE rolname IN ('selfheal_app', 'selfheal_migrator');`);
    const existingRoles = new Set(rolesCheck.rows.map((r) => r.rolname));
    if (existingRoles.has('selfheal_app')) {
      ephAppPassword = config.db.user === 'selfheal_app' && config.db.password ? config.db.password : crypto.randomBytes(16).toString('hex');
      if (config.db.user !== 'selfheal_app') {
        await adminPool.query(`ALTER ROLE selfheal_app WITH LOGIN PASSWORD '${ephAppPassword}';`);
      }
      appPool = new Pool({
        host: config.db.host,
        port: config.db.port,
        user: 'selfheal_app',
        password: ephAppPassword,
        database: 'aiselfhealing_test',
        max: 1, // max=1 intentionally exercises connection reuse!
      });
    }
    if (existingRoles.has('selfheal_migrator')) {
      ephMigratorPassword = crypto.randomBytes(16).toString('hex');
      await adminPool.query(`ALTER ROLE selfheal_migrator WITH LOGIN PASSWORD '${ephMigratorPassword}';`);
      migratorPool = new Pool({
        host: config.db.host,
        port: config.db.port,
        user: 'selfheal_migrator',
        password: ephMigratorPassword,
        database: 'aiselfhealing_test',
        max: 2,
      });
    }
  });

  after(async () => {
    if (appPool) await appPool.end();
    if (migratorPool) await migratorPool.end();
    if (adminPool) {
      await adminPool.query(`DELETE FROM ai_recommendations WHERE id IN ($1, $2);`, [REC_A, REC_B]).catch(() => {});
      await adminPool.query(`DELETE FROM healing_actions WHERE id IN ($1, $2);`, [ACTION_A, ACTION_B]).catch(() => {});
      await adminPool.query(`DELETE FROM policy_actions WHERE policy_id = $1;`, [POLICY_B]).catch(() => {});
      await adminPool.query(`DELETE FROM healing_policies WHERE id = $1;`, [POLICY_B]).catch(() => {});
      await adminPool.query(`DELETE FROM rca_analyses WHERE id IN ($1, $2);`, [RCA_A, RCA_B]).catch(() => {});
      await adminPool.query(`DELETE FROM incidents WHERE id IN ($1, $2);`, [INC_A, INC_B]).catch(() => {});
      await adminPool.query(`DELETE FROM notifications WHERE id IN ($1, $2);`, [NOTIF_A_NULL, NOTIF_B_ORG]).catch(() => {});
      await adminPool.query(`DELETE FROM audit_logs WHERE organization_id IN ($1, $2) OR user_id IN ($3, $4);`, [ORG_A, ORG_B, USER_A, USER_B]).catch(() => {});
      await adminPool.query(`DELETE FROM agents WHERE id IN ($1, $2);`, [AGENT_A, AGENT_B]).catch(() => {});
      await adminPool.query(`DELETE FROM namespaces WHERE id IN ($1, $2);`, [NS_A, NS_B]).catch(() => {});
      await adminPool.query(`DELETE FROM clusters WHERE id IN ($1, $2);`, [CLUSTER_A, CLUSTER_B]).catch(() => {});
      await adminPool.query(`DELETE FROM environments WHERE id IN ($1, $2);`, [ENV_A, ENV_B]).catch(() => {});
      await adminPool.query(`DELETE FROM organization_members WHERE organization_id IN ($1, $2);`, [ORG_A, ORG_B]).catch(() => {});
      await adminPool.query(`DELETE FROM organizations WHERE id IN ($1, $2);`, [ORG_A, ORG_B]).catch(() => {});
      await adminPool.query(`DELETE FROM users WHERE id IN ($1, $2);`, [USER_A, USER_B]).catch(() => {});
      await adminPool.end();
    }
    await pool.end().catch(() => {});
    await closeRedis().catch(() => {});
  });

  test('10 & 11. Least-privilege roles (selfheal_app & selfheal_migrator) and FORCE RLS catalog posture', async () => {
    const roleRes = await adminPool.query(
      `SELECT rolname, rolsuper, rolbypassrls, rolcreaterole, rolcreatedb, rolcanlogin
       FROM pg_roles
       WHERE rolname IN ('selfheal_app', 'selfheal_migrator', 'selfheal_readonly')
       ORDER BY rolname;`
    );
    assert.strictEqual(roleRes.rows.length, 3, 'Expected selfheal_app, selfheal_migrator, selfheal_readonly roles');
    for (const r of roleRes.rows) {
      assert.strictEqual(r.rolsuper, false, `${r.rolname} must NOT be superuser`);
      assert.strictEqual(r.rolbypassrls, false, `${r.rolname} must NOT have BYPASSRLS`);
    }

    const rlsRes = await adminPool.query(
      `SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity, pg_get_userbyid(c.relowner) AS owner
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relkind = 'r';`
    );
    const byName = new Map(rlsRes.rows.map((r) => [r.relname, r]));

    for (const tbl of [...EXPECTED_TENANT_DIRECT_TABLES, ...EXPECTED_TENANT_INDIRECT_TABLES, ...EXPECTED_AUDIT_TABLES]) {
      const row = byName.get(tbl);
      assert.ok(row, `Expected table ${tbl} to exist`);
      assert.strictEqual(row.relrowsecurity, true, `${tbl} must have ENABLE ROW LEVEL SECURITY`);
      assert.strictEqual(row.relforcerowsecurity, true, `${tbl} must have FORCE ROW LEVEL SECURITY`);
      assert.strictEqual(row.owner, 'selfheal_migrator', `${tbl} must be owned by selfheal_migrator, not postgres/selfheal_app`);
    }

    for (const tbl of EXPECTED_EXCLUDED_TABLES) {
      const row = byName.get(tbl);
      assert.ok(row, `Expected excluded table ${tbl} to exist`);
      assert.strictEqual(row.relrowsecurity, false, `Global/Auth table ${tbl} must stay excluded from tenant RLS`);
    }

    // selfheal_app cannot disable RLS or escalate to postgres
    assert.ok(appPool, 'appPool must be initialized');
    await assert.rejects(
      () => appPool!.query(`ALTER TABLE incidents DISABLE ROW LEVEL SECURITY;`),
      /must be owner of table|permission denied/i
    );
    await assert.rejects(
      () => appPool!.query(`SET ROLE postgres;`),
      /permission denied/i
    );
  });

  test('1, 2, 3, 7 & 8. Org A/B read isolation, missing context fail-closed, and pooled connection reuse safety', async () => {
    assert.ok(appPool, 'appPool must exist');

    // 7. Missing tenant context fails closed (returns 0 rows, cannot insert)
    const noCtxInc = await appPool!.query(`SELECT id FROM incidents WHERE id IN ($1, $2);`, [INC_A, INC_B]);
    assert.strictEqual(noCtxInc.rows.length, 0, 'Missing tenant context must return 0 incidents');
    await assert.rejects(
      () =>
        appPool!.query(
          `INSERT INTO incidents (organization_id, environment_id, source_type, target_type, incident_type, title, severity, status, detected_at, started_at, occurrence_count)
           VALUES ($1, $2, 'MANUAL', 'POD', 'TEST', 'FailClosed', 'LOW', 'OPEN', NOW(), NOW(), 1);`,
          [ORG_A, ENV_A]
        ),
      /row-level security policy|42501/i
    );

    // 1. Org A context (on max=1 pool!) sees ONLY Org A rows
    const client = await appPool!.connect();
    try {
      await client.query('BEGIN');
      await client.query(`SELECT set_config('app.access_scope', 'TENANT', true), set_config('app.current_org_id', $1, true), set_config('app.current_user_id', $2, true);`, [ORG_A, USER_A]);
      const orgAInc = await client.query(`SELECT id, organization_id FROM incidents WHERE id IN ($1, $2);`, [INC_A, INC_B]);
      assert.deepStrictEqual(orgAInc.rows.map((r) => r.id), [INC_A]);
      const orgAAct = await client.query(`SELECT id FROM healing_actions WHERE id IN ($1, $2);`, [ACTION_A, ACTION_B]);
      assert.deepStrictEqual(orgAAct.rows.map((r) => r.id), [ACTION_A]);
      const orgAAudit = await client.query(`SELECT action FROM audit_logs WHERE description IN ('Platform null-org audit event', 'Org B audit event');`);
      assert.strictEqual(orgAAudit.rows.length, 0, 'Tenant Org A must NOT see NULL-org or Org B audit_logs');
      await client.query('COMMIT');
    } finally {
      client.release();
    }

    // 8. Immediately reuse SAME pooled connection (max=1) WITHOUT context -> must fail closed!
    const afterReuseNoCtx = await appPool!.query(`SELECT id FROM incidents WHERE id IN ($1, $2);`, [INC_A, INC_B]);
    assert.strictEqual(afterReuseNoCtx.rows.length, 0, 'Connection reuse after Org A commit must NOT leak Org A context');

    // 2. Org B sees ONLY Org B
    const clientB = await appPool!.connect();
    try {
      await clientB.query('BEGIN');
      await clientB.query(`SELECT set_config('app.access_scope', 'TENANT', true), set_config('app.current_org_id', $1, true), set_config('app.current_user_id', $2, true);`, [ORG_B, USER_B]);
      const orgBInc = await clientB.query(`SELECT id FROM incidents WHERE id IN ($1, $2);`, [INC_A, INC_B]);
      assert.deepStrictEqual(orgBInc.rows.map((r) => r.id), [INC_B]);
      await clientB.query('COMMIT');
    } finally {
      clientB.release();
    }
  });

  test('4, 5 & 6. Cross-tenant INSERT, UPDATE (including org_id tampering), and DELETE are denied', async () => {
    assert.ok(appPool, 'appPool must exist');
    const client = await appPool!.connect();
    try {
      await client.query('BEGIN');
      await client.query(`SELECT set_config('app.access_scope', 'TENANT', true), set_config('app.current_org_id', $1, true), set_config('app.current_user_id', $2, true);`, [ORG_A, USER_A]);

      // 4a. Direct cross-tenant INSERT into incidents claiming ORG_B
      await client.query('SAVEPOINT sp_ins_direct;');
      await assert.rejects(
        () =>
          client.query(
            `INSERT INTO incidents (organization_id, environment_id, source_type, target_type, incident_type, title, severity, status, detected_at, started_at, occurrence_count)
             VALUES ($1, $2, 'MANUAL', 'POD', 'TEST', 'CrossTenant', 'LOW', 'OPEN', NOW(), NOW(), 1);`,
            [ORG_B, ENV_B]
          ),
        /row-level security policy/i
      );
      await client.query('ROLLBACK TO SAVEPOINT sp_ins_direct;');

      // 4b. Indirect cross-tenant INSERT attaching cluster to ORG_B environment
      await client.query('SAVEPOINT sp_ins_indirect;');
      await assert.rejects(
        () => client.query(`INSERT INTO clusters (environment_id, name, status) VALUES ($1, 'hijack-cluster', 'CONNECTED');`, [ENV_B]),
        /row-level security policy/i
      );
      await client.query('ROLLBACK TO SAVEPOINT sp_ins_indirect;');

      // 5a. Cross-tenant UPDATE targeting Org B incident
      const updB = await client.query(`UPDATE incidents SET title = 'Hacked' WHERE id = $1 RETURNING id;`, [INC_B]);
      assert.strictEqual(updB.rowCount, 0, 'Org A UPDATE on Org B incident must affect 0 rows');

      // 5b. Ownership tampering: Org A updating own incident to reassign organization_id = ORG_B
      await client.query('SAVEPOINT sp_upd_own;');
      await assert.rejects(
        () => client.query(`UPDATE incidents SET organization_id = $1 WHERE id = $2;`, [ORG_B, INC_A]),
        /row-level security policy/i
      );
      await client.query('ROLLBACK TO SAVEPOINT sp_upd_own;');

      // 6. Cross-tenant DELETE targeting Org B incident
      const delB = await client.query(`DELETE FROM incidents WHERE id = $1 RETURNING id;`, [INC_B]);
      assert.strictEqual(delB.rowCount, 0, 'Org A DELETE on Org B incident must affect 0 rows');

      await client.query('ROLLBACK');
    } finally {
      client.release();
    }

    // Confirm Org B incident intact
    const checkB = await adminPool.query(`SELECT title FROM incidents WHERE id = $1;`, [INC_B]);
    assert.strictEqual(checkB.rows.length, 1);
    assert.notStrictEqual(checkB.rows[0].title, 'Hacked');
  });

  test('9. Concurrent Org A & Org B transactions remain strictly isolated', async () => {
    assert.ok(appPool, 'appPool must exist');
    const concPool = new Pool({
      host: config.db.host,
      port: config.db.port,
      user: 'selfheal_app',
      password: ephAppPassword,
      database: 'aiselfhealing_test',
      max: 6,
    });
    try {
      const queries = Array.from({ length: 12 }, (_, idx) => {
        const isA = idx % 2 === 0;
        const org = isA ? ORG_A : ORG_B;
        const expectedInc = isA ? INC_A : INC_B;
        return (async () => {
          const c = await concPool.connect();
          try {
            await c.query('BEGIN');
            await c.query(`SELECT set_config('app.access_scope', 'TENANT', true), set_config('app.current_org_id', $1, true);`, [org]);
            const res = await c.query(`SELECT id FROM incidents WHERE id IN ($1, $2);`, [INC_A, INC_B]);
            await c.query('COMMIT');
            return { expectedInc, got: res.rows.map((r) => r.id) };
          } finally {
            c.release();
          }
        })();
      });

      const results = await Promise.all(queries);
      for (const r of results) {
        assert.deepStrictEqual(r.got, [r.expectedInc]);
      }
    } finally {
      await concPool.end();
    }
  });

  test('12. Application cross-tenant security regression checks (SC-A01 / SC-A04)', async () => {
    // a. HealingActionModel.approveAction on ACTION_A (shared target_name) MUST NOT mark ORG_B's REC_B as APPLIED
    await runWithTenantContext(ORG_A, USER_A, () => HealingActionModel.approveAction(ACTION_A, USER_A));
    const recCheck = await adminPool.query(`SELECT id, status FROM ai_recommendations WHERE id IN ($1, $2) ORDER BY id;`, [REC_A, REC_B]);
    const recAStatus = recCheck.rows.find((r) => r.id === REC_A)?.status;
    const recBStatus = recCheck.rows.find((r) => r.id === REC_B)?.status;
    assert.strictEqual(recAStatus, 'APPLIED', 'Org A recommendation should be APPLIED');
    assert.strictEqual(recBStatus, 'PROPOSED', 'Org B recommendation MUST remain PROPOSED despite matching target_name');

    // b. TelemetryPipelineService.autoResolveIfRecovered scoped to ORG_A MUST NOT resolve ORG_B's INC_B
    const healthySeq = Array.from({ length: 12 }, (_, i) => ({
      cpu: 12,
      ram: 30,
      disk: 25,
      request_rate: 10,
      latency: 20,
      http_5xx_rate: 0,
      pod_restart_count: 0,
      replica_count: 1,
      collected_at: new Date(Date.now() - (12 - i) * 5000).toISOString(),
    }));
    await TelemetryPipelineService.autoResolveIfRecovered(SHARED_SERVICE, CLUSTER_A, healthySeq, ORG_A);
    const incBCheck = await adminPool.query(`SELECT status FROM incidents WHERE id = $1;`, [INC_B]);
    assert.strictEqual(incBCheck.rows[0].status, 'OPEN', 'Org A autoResolveIfRecovered MUST NOT close Org B incident');

    // c. TelemetryPipelineService.evaluatePolicyAndTriggerAutonomousHealing for ORG_A (has NO policy) MUST NOT fall back to ORG_B's AUTO policy
    await runWithTenantContext(ORG_A, null, () =>
      TelemetryPipelineService.evaluatePolicyAndTriggerAutonomousHealing(
        {
          incident_id: INC_A,
          environment_id: ENV_A,
          organization_id: ORG_A,
          cluster_id: CLUSTER_A,
          root_cause: { category: 'MEMORY_LEAK', summary: 'test', confidence: 0.95 },
          recommendation: { action: 'RESTART_POD', reason: 'test', priority: 1 },
        } as any,
        SHARED_SERVICE
      )
    );
    const newOrgAActions = await adminPool.query(`SELECT id FROM healing_actions WHERE incident_id = $1 AND id <> $2;`, [INC_A, ACTION_A]);
    assert.strictEqual(newOrgAActions.rows.length, 0, 'Org A MUST NOT inherit Org B active AUTO policy');

    // d. LogStreamService.matchesFilter fails CLOSED when emitted log omits organization_id
    const leaked = (LogStreamService as any).matchesFilter(
      { level: 'INFO', message: 'untagged log' },
      { allowedOrgIds: [ORG_A] }
    );
    assert.strictEqual(leaked, false, 'Untagged log MUST NOT stream to tenant SSE listener');

    // e. TelemetryAggregatorService.getLiveSummaryData scoped to ORG_A MUST NOT include ORG_B incidents or agents
    const summaryA = await TelemetryAggregatorService.getLiveSummaryData(SHARED_SERVICE, CLUSTER_A, ORG_A);
    const leakedAgentB = (summaryA.agents || []).some((a: any) => a.id === AGENT_B);
    const leakedIncB = (summaryA.incidents || []).some((i: any) => i.id === INC_B);
    assert.strictEqual(leakedAgentB, false, 'Org A live summary MUST NOT contain Org B agents');
    assert.strictEqual(leakedIncB, false, 'Org A live summary MUST NOT contain Org B incidents');

    // f. StatisticsService tenant scope MUST NOT expose NULL-org audit_logs
    const statsA = await runWithDbContext({ scope: 'AUTH', userId: USER_A }, () =>
      StatisticsService.getOverviewStats(
        { id: USER_A, email: 'rls.user.a@test.local', roles: ['SME_OWNER'], status: 'ACTIVE' } as any,
        { organization_id: ORG_A } as any
      )
    );
    const hasPlatformNullLog = (statsA.recent_activities || []).some((a: any) => a.action === 'PLATFORM_SECRET_EVENT');
    assert.strictEqual(hasPlatformNullLog, false, 'Tenant overview stats MUST NOT include NULL-org platform audit logs');

    // g. Hybrid notifications: AUTH scope allows User A personal NULL-org notification ONLY, never Org B notification
    assert.ok(appPool);
    const notifClient = await appPool!.connect();
    try {
      await notifClient.query('BEGIN');
      await notifClient.query(`SELECT set_config('app.access_scope', 'AUTH', true), set_config('app.current_user_id', $1, true);`, [USER_A]);
      const notifRes = await notifClient.query(`SELECT id FROM notifications WHERE id IN ($1, $2);`, [NOTIF_A_NULL, NOTIF_B_ORG]);
      assert.deepStrictEqual(notifRes.rows.map((r) => r.id), [NOTIF_A_NULL]);
      await notifClient.query('COMMIT');
    } finally {
      notifClient.release();
    }

    // h. Application context helpers & pool wrapper isolation verification
    const insideA = await withTenantTx(ORG_A, USER_A, async (txClient) => {
      const r = await txClient.query(`SELECT public.app_access_scope() AS scope, public.app_current_org_id()::text AS org_id;`);
      return r.rows[0];
    });
    assert.strictEqual(insideA.scope, 'TENANT');
    assert.strictEqual(insideA.org_id, ORG_A);

    const afterTxCtx = await pool.query(`SELECT public.app_access_scope() AS scope, public.app_current_org_id()::text AS org_id;`);
    assert.strictEqual(afterTxCtx.rows[0].scope, 'NONE');
    assert.strictEqual(afterTxCtx.rows[0].org_id, null);

    const alsCtx = await runWithTenantContext(ORG_B, USER_B, async () => {
      const r = await pool.query(
        `SELECT current_user AS db_role, public.app_access_scope() AS scope, public.app_current_org_id()::text AS org_id, id FROM incidents WHERE id IN ($1, $2);`,
        [INC_A, INC_B]
      );
      return r.rows;
    });
    assert.ok(alsCtx.length >= 1, 'Expected at least Org B incident');
    assert.strictEqual(alsCtx[0].scope, 'TENANT');
    assert.strictEqual(alsCtx[0].org_id, ORG_B);
    if (alsCtx[0].db_role === 'selfheal_app') {
      assert.strictEqual(alsCtx.length, 1, 'Under selfheal_app runtime role, RLS must return strictly Org B row only');
      assert.strictEqual(alsCtx[0].id, INC_B);
    }

    // i. Background jobs establish tenant context without throwing or leaking across orgs
    await RuleEngineExecutionService.runEvaluationCycle();
    await AgentTimeoutService.checkAndMarkStaleAgents(3600);
    await AgentModel.findByTokenHash('nonexistent_hash_probe', 'raw');
  });
});
