import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import { AddressInfo } from 'net';
import jwt from 'jsonwebtoken';
import app from '../app';
import { pool } from '../config/database';
import { config } from '../config/env';
import { KubernetesEventModel } from '../models/kubernetesEvent.model';
import { AgentService } from '../services/agent.service';

describe('Kubernetes Events Ingestion, Deduplication, Multi-Tenant Isolation & Query API [S4][PB18] 4.1 & 4.2', () => {
  let server: http.Server;
  let baseUrl: string;

  // Test UUIDs
  const orgAId = 'a2000000-0000-4000-8000-000000000001';
  const orgBId = 'a2000000-0000-4000-8000-000000000002';
  const envAId = 'e2000000-0000-4000-8000-000000000001';
  const envBId = 'e2000000-0000-4000-8000-000000000002';
  const clusterAId = 'c2000000-0000-4000-8000-000000000001';
  const clusterBId = 'c2000000-0000-4000-8000-000000000002';

  const superAdminId = 'b2000000-0000-4000-8000-000000000001';
  const ownerAId = 'b2000000-0000-4000-8000-000000000002';
  const ownerBId = 'b2000000-0000-4000-8000-000000000003';
  const suspendedUserId = 'b2000000-0000-4000-8000-000000000004';

  let superAdminToken: string;
  let ownerAToken: string;
  let ownerBToken: string;
  let suspendedUserToken: string;
  let smeOwnerRoleId: string;

  before(async () => {
    try {
      // 0. Cleanup any leftovers from prior runs
      await pool.query(`DELETE FROM kubernetes_events WHERE cluster_id IN ($1, $2);`, [clusterAId, clusterBId]);
      await pool.query(`DELETE FROM clusters WHERE id IN ($1, $2);`, [clusterAId, clusterBId]);
      await pool.query(`DELETE FROM environments WHERE id IN ($1, $2);`, [envAId, envBId]);
      await pool.query(`DELETE FROM organization_members WHERE organization_id IN ($1, $2);`, [orgAId, orgBId]);
      await pool.query(`DELETE FROM organizations WHERE id IN ($1, $2);`, [orgAId, orgBId]);
      await pool.query(`DELETE FROM user_system_roles WHERE user_id = $1;`, [superAdminId]);
      await pool.query(`DELETE FROM users WHERE id IN ($1, $2, $3, $4);`, [
        superAdminId,
        ownerAId,
        ownerBId,
        suspendedUserId,
      ]);

      // 1. Fetch SME_OWNER role ID
    const rolesRes = await pool.query(`SELECT id FROM roles WHERE code = 'SME_OWNER' AND scope = 'ORGANIZATION'`);
    smeOwnerRoleId = rolesRes.rows[0]?.id;

    // 2. Insert Users
    await pool.query(
      `INSERT INTO users (id, email, password_hash, full_name, status, created_at, updated_at)
       VALUES 
         ($1, 'super.pb18@test.com', 'dummy_hash', 'Super Admin PB18', 'ACTIVE', NOW(), NOW()),
         ($2, 'owner.a.pb18@test.com', 'dummy_hash', 'Owner Alpha PB18', 'ACTIVE', NOW(), NOW()),
         ($3, 'owner.b.pb18@test.com', 'dummy_hash', 'Owner Beta PB18', 'ACTIVE', NOW(), NOW()),
         ($4, 'suspended.pb18@test.com', 'dummy_hash', 'Suspended PB18', 'SUSPENDED', NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, deleted_at = NULL;`,
      [superAdminId, ownerAId, ownerBId, suspendedUserId]
    );

    // 3. Assign SUPER_ADMIN system role
    const sysRoleRes = await pool.query(`SELECT id FROM system_roles WHERE name = 'SUPER_ADMIN'`);
    if (sysRoleRes.rows[0]) {
      await pool.query(
        `INSERT INTO user_system_roles (user_id, system_role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING;`,
        [superAdminId, sysRoleRes.rows[0].id]
      );
    }

    // 4. Insert Organizations
    await pool.query(
      `INSERT INTO organizations (id, name, slug, status, created_by, created_at, updated_at)
       VALUES 
         ($1, 'PB18 Alpha Enterprise', 'pb18-alpha-enterprise', 'ACTIVE', $2, NOW(), NOW()),
         ($3, 'PB18 Beta Logistics', 'pb18-beta-logistics', 'ACTIVE', $4, NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET status = 'ACTIVE', deleted_at = NULL;`,
      [orgAId, ownerAId, orgBId, ownerBId]
    );

    // 5. Insert Organization Memberships
    if (smeOwnerRoleId) {
      await pool.query(
        `INSERT INTO organization_members (organization_id, user_id, role_id, status, joined_at)
         VALUES 
           ($1, $2, $3, 'ACTIVE', NOW()),
           ($4, $5, $3, 'ACTIVE', NOW()),
           ($1, $6, $3, 'INACTIVE', NOW())
         ON CONFLICT (organization_id, user_id) 
         DO UPDATE SET status = EXCLUDED.status;`,
        [orgAId, ownerAId, smeOwnerRoleId, orgBId, ownerBId, suspendedUserId]
      );
    }

    // 6. Insert Environments
    await pool.query(
      `INSERT INTO environments (id, organization_id, name, code, environment_type, created_by, created_at, updated_at)
       VALUES 
         ($1, $2, 'Env Alpha Production', 'env-alpha-prod-pb18', 'PRODUCTION', $3, NOW(), NOW()),
         ($4, $5, 'Env Beta Production', 'env-beta-prod-pb18', 'PRODUCTION', $6, NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET organization_id = EXCLUDED.organization_id;`,
      [envAId, orgAId, ownerAId, envBId, orgBId, ownerBId]
    );

    // 7. Insert Clusters
    await pool.query(
      `INSERT INTO clusters (id, environment_id, name, provider, status, created_at, updated_at)
       VALUES 
         ($1, $2, 'k8s-cluster-alpha-pb18', 'EKS', 'CONNECTED', NOW(), NOW()),
         ($3, $4, 'k8s-cluster-beta-pb18', 'GKE', 'CONNECTED', NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET status = 'CONNECTED', deleted_at = NULL;`,
      [clusterAId, envAId, clusterBId, envBId]
    );

    // 8. Sign Tokens
    const sign = (id: string, email: string, roles: string[] = ['USER'], orgId?: string, status: string = 'ACTIVE') =>
      jwt.sign({ id, email, status, roles, organization_id: orgId }, config.jwt.secret, {
        expiresIn: '1h',
        algorithm: 'HS256',
      });

    superAdminToken = sign(superAdminId, 'super.pb18@test.com', ['SUPER_ADMIN']);
    ownerAToken = sign(ownerAId, 'owner.a.pb18@test.com', ['SME_OWNER'], orgAId);
    ownerBToken = sign(ownerBId, 'owner.b.pb18@test.com', ['SME_OWNER'], orgBId);
    suspendedUserToken = sign(suspendedUserId, 'suspended.pb18@test.com', ['SME_OWNER'], orgAId, 'SUSPENDED');

    // 6. Launch Server
    server = http.createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const address = server.address() as AddressInfo;
        baseUrl = `http://127.0.0.1:${address.port}`;
        resolve();
      });
    });
    } catch (err) {
      console.error("BEFORE HOOK FAILED:", err);
      throw err;
    }
  });

  after(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    // Cleanup seeded records
    await pool.query(`DELETE FROM kubernetes_events WHERE cluster_id IN ($1, $2);`, [clusterAId, clusterBId]);
    await pool.query(`DELETE FROM clusters WHERE id IN ($1, $2);`, [clusterAId, clusterBId]);
    await pool.query(`DELETE FROM environments WHERE id IN ($1, $2);`, [envAId, envBId]);
    await pool.query(`DELETE FROM organization_members WHERE organization_id IN ($1, $2);`, [orgAId, orgBId]);
    await pool.query(`DELETE FROM organizations WHERE id IN ($1, $2);`, [orgAId, orgBId]);
    await pool.query(`DELETE FROM user_system_roles WHERE user_id = $1;`, [superAdminId]);
    await pool.query(`DELETE FROM users WHERE id IN ($1, $2, $3, $4);`, [
      superAdminId,
      ownerAId,
      ownerBId,
      suspendedUserId,
    ]);
    try {
      await pool.end();
    } catch {
      // Pool already closed
    }
  });

  // =========================================================================
  // PHẦN 1: NORMALIZATION & IDEMPOTENT UPSERT DEDUPLICATION [PB18.4.2]
  // =========================================================================
  describe('1. Normalization & Idempotent Deduplication Pipeline', () => {
    const eventUid1 = 'uid-k8s-pod-oom-001';

    test('1.1. Ingesting a new event inserts a single record with is_new = true and count = 1', async () => {
      const now = new Date();
      const res = await KubernetesEventModel.upsertEvent({
        cluster_id: clusterAId,
        event_uid: eventUid1,
        resource_type: 'Pod',
        resource_uid: 'order-service-pod-01',
        event_type: 'Warning',
        reason: 'OOMKilled',
        message: 'Container memory limit exceeded (1024MB), killed by cgroup controller',
        source_component: 'kubelet',
        first_seen_at: now,
        last_seen_at: now,
        count: 1,
        metadata: {
          namespace: 'production',
          pod_name: 'order-service-pod-01',
          service_id: 'order-service',
        },
      });

      assert.ok(res.id, 'Must return record ID');
      assert.strictEqual(res.is_new, true, 'First ingestion must flag is_new = true');
      assert.strictEqual(res.count, 1, 'Initial count must be 1');

      // Verify DB row count
      const check = await pool.query(
        `SELECT count(*)::int as count, count as event_count, event_uid FROM kubernetes_events WHERE cluster_id = $1 AND event_uid = $2 GROUP BY count, event_uid;`,
        [clusterAId, eventUid1]
      );
      assert.strictEqual(check.rows.length, 1);
      assert.strictEqual(check.rows[0].event_count, 1);
    });

    test('1.2. Re-ingesting the exact same event does NOT create a duplicate; updates count and last_seen_at', async () => {
      const later = new Date(Date.now() + 5000);
      const res = await KubernetesEventModel.upsertEvent({
        cluster_id: clusterAId,
        event_uid: eventUid1,
        resource_type: 'Pod',
        resource_uid: 'order-service-pod-01',
        event_type: 'Warning',
        reason: 'OOMKilled',
        message: 'Container memory limit exceeded (1024MB), killed by cgroup controller',
        source_component: 'kubelet',
        first_seen_at: new Date(),
        last_seen_at: later,
        count: 2,
        metadata: {
          namespace: 'production',
          pod_name: 'order-service-pod-01',
          service_id: 'order-service',
        },
      });

      assert.strictEqual(res.is_new, false, 'Duplicate ingestion must flag is_new = false');
      assert.strictEqual(res.count, 2, 'Count must update to 2');

      // Ensure table still has exactly 1 row for this event
      const check = await pool.query(
        `SELECT id, count, last_seen_at FROM kubernetes_events WHERE cluster_id = $1 AND event_uid = $2;`,
        [clusterAId, eventUid1]
      );
      assert.strictEqual(check.rows.length, 1, 'Table must strictly maintain exactly 1 row');
      assert.strictEqual(check.rows[0].count, 2);
    });

    test('1.3. Fallback deduplication: Events without event_uid use natural composite key without collision', async () => {
      const t1 = new Date();
      // First submission without event_uid
      const res1 = await KubernetesEventModel.upsertEvent({
        cluster_id: clusterAId,
        resource_type: 'Node',
        resource_uid: 'node-worker-01',
        event_type: 'Normal',
        reason: 'NodeReady',
        message: 'Node worker-01 status is now: NodeReady',
        source_component: 'kubelet',
        first_seen_at: t1,
        last_seen_at: t1,
        count: 1,
        metadata: {
          namespace: 'default',
        },
      });
      assert.strictEqual(res1.is_new, true);

      // Re-submission without event_uid
      const res2 = await KubernetesEventModel.upsertEvent({
        cluster_id: clusterAId,
        resource_type: 'Node',
        resource_uid: 'node-worker-01',
        event_type: 'Normal',
        reason: 'NodeReady',
        message: 'Node worker-01 status is now: NodeReady',
        source_component: 'kubelet',
        first_seen_at: t1,
        last_seen_at: new Date(Date.now() + 10000),
        count: 2,
        metadata: {
          namespace: 'default',
        },
      });
      assert.strictEqual(res2.is_new, false, 'Fallback natural key must deduplicate correctly');
      assert.strictEqual(res2.count, 2);
    });

    test('1.4. Cross-cluster isolation: Same event_uid in cluster B is saved separately from cluster A', async () => {
      const resB = await KubernetesEventModel.upsertEvent({
        cluster_id: clusterBId,
        event_uid: eventUid1, // Identical UID in different cluster
        resource_type: 'Pod',
        resource_uid: 'payment-service-pod-02',
        event_type: 'Warning',
        reason: 'FailedScheduling',
        message: '0/8 nodes are available: Insufficient memory in Beta cluster',
        source_component: 'default-scheduler',
        first_seen_at: new Date(),
        last_seen_at: new Date(),
        count: 1,
        metadata: {
          namespace: 'production',
          secret_marker: 'BETA_CONFIDENTIAL_EVENT_X88',
        },
      });

      assert.strictEqual(resB.is_new, true, 'Must treat as separate event under cluster B');

      // Verify each cluster has its own independent row
      const checkA = await pool.query(
        `SELECT id, count, reason FROM kubernetes_events WHERE cluster_id = $1 AND event_uid = $2;`,
        [clusterAId, eventUid1]
      );
      const checkB = await pool.query(
        `SELECT id, count, reason FROM kubernetes_events WHERE cluster_id = $1 AND event_uid = $2;`,
        [clusterBId, eventUid1]
      );
      assert.strictEqual(checkA.rows.length, 1);
      assert.strictEqual(checkA.rows[0].reason, 'OOMKilled');
      assert.strictEqual(checkB.rows.length, 1);
      assert.strictEqual(checkB.rows[0].reason, 'FailedScheduling');
    });

    test('1.5. Concurrency safety: 10 concurrent upserts of the same event all resolve cleanly without deadlock or duplicate', async () => {
      const concurrentUid = 'uid-concurrent-race-test';
      const promises = Array.from({ length: 10 }, (_, i) =>
        KubernetesEventModel.upsertEvent({
          cluster_id: clusterAId,
          event_uid: concurrentUid,
          resource_type: 'Pod',
          resource_uid: 'race-pod',
          event_type: 'Warning',
          reason: 'BackOff',
          message: 'Back-off restarting failed container',
          first_seen_at: new Date(),
          last_seen_at: new Date(Date.now() + i * 100),
          count: i + 1,
          metadata: { namespace: 'default' },
        })
      );

      const results = await Promise.all(promises);
      assert.strictEqual(results.length, 10);

      // Verify exactly 1 row exists in the database
      const check = await pool.query(
        `SELECT count(*)::int as row_count, count FROM kubernetes_events WHERE cluster_id = $1 AND event_uid = $2 GROUP BY count;`,
        [clusterAId, concurrentUid]
      );
      assert.strictEqual(check.rows.length, 1, 'Must strictly collapse to exactly 1 record');
    });
  });

  // =========================================================================
  // PHẦN 2: API QUERY PARAMETER VALIDATION & BOUNDS ENFORCEMENT [PB18.4.1]
  // =========================================================================
  describe('2. API Parameter Validation & Query Bounds Enforcement', () => {
    test('2.1. Rejects unauthenticated requests with 401 Unauthorized', async () => {
      const res = await fetch(`${baseUrl}/api/v1/telemetry/events`);
      assert.strictEqual(res.status, 401);
    });

    test('2.2. Rejects suspended users with 403 Forbidden', async () => {
      const res = await fetch(`${baseUrl}/api/v1/telemetry/events`, {
        headers: { Authorization: `Bearer ${suspendedUserToken}` },
      });
      assert.strictEqual(res.status, 403);
    });

    test('2.3. Rejects invalid time bounds where start_time > end_time with 400 Bad Request', async () => {
      const res = await fetch(
        `${baseUrl}/api/v1/telemetry/events?start_time=2026-10-27T12:00:00Z&end_time=2026-10-27T10:00:00Z`,
        { headers: { Authorization: `Bearer ${ownerAToken}` } }
      );
      assert.strictEqual(res.status, 400);
      const json = await res.json();
      assert.ok(json.message.includes('thời gian') || json.message.includes('start_time'));
    });

    test('2.4. Rejects limit > 200 with 400 Bad Request (Max Page Size boundary)', async () => {
      const res = await fetch(`${baseUrl}/api/v1/telemetry/events?limit=500`, {
        headers: { Authorization: `Bearer ${ownerAToken}` },
      });
      assert.strictEqual(res.status, 400);
      const json = await res.json();
      assert.ok(json.message.includes('200') || json.message.includes('limit'));
    });

    test('2.5. Queries events with combined filters: type, namespace, reason, and time range', async () => {
      const res = await fetch(
        `${baseUrl}/api/v1/telemetry/events?cluster_id=${clusterAId}&type=Warning&namespace=production&reason=OOMKilled&range=24h`,
        { headers: { Authorization: `Bearer ${ownerAToken}` } }
      );
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.ok(Array.isArray(json.data.events));
      assert.ok(json.data.events.length >= 1);
      assert.strictEqual(json.data.events[0].event_type, 'Warning');
      assert.strictEqual(json.data.events[0].reason, 'OOMKilled');
      assert.strictEqual(json.data.events[0].namespace, 'production');
    });

    test('2.6. Keyword search matches text in event message', async () => {
      const res = await fetch(
        `${baseUrl}/api/v1/telemetry/events?search=memory+limit+exceeded`,
        { headers: { Authorization: `Bearer ${ownerAToken}` } }
      );
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.ok(json.data.events.length >= 1);
      assert.ok(json.data.events[0].message.includes('memory limit exceeded'));
    });

    test('2.7. Deterministic ordering: Results are ordered by last_seen_at DESC, id DESC', async () => {
      const res = await fetch(`${baseUrl}/api/v1/telemetry/events?limit=10`, {
        headers: { Authorization: `Bearer ${ownerAToken}` },
      });
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      const events = json.data.events;
      if (events.length >= 2) {
        for (let i = 0; i < events.length - 1; i++) {
          const t1 = new Date(events[i].last_seen_at).getTime();
          const t2 = new Date(events[i + 1].last_seen_at).getTime();
          assert.ok(t1 >= t2, `Item ${i} (${t1}) must be >= item ${i + 1} (${t2})`);
        }
      }
    });
  });

  // =========================================================================
  // PHẦN 3: MULTI-TENANT ORGANIZATION ISOLATION & ATTACK DEFENSE
  // =========================================================================
  describe('3. Multi-Tenant Organization Isolation & Cross-Tenant Defense', () => {
    test('3.1. Owner A queries events and ONLY receives Org Alpha records', async () => {
      const res = await fetch(`${baseUrl}/api/v1/telemetry/events`, {
        headers: { Authorization: `Bearer ${ownerAToken}` },
      });
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      const clusterIds = json.data.events.map((e: any) => e.cluster_id);
      assert.ok(clusterIds.every((cid: string) => cid === clusterAId));
    });

    test('3.2. Owner B queries events and ONLY receives Org Beta records', async () => {
      const res = await fetch(`${baseUrl}/api/v1/telemetry/events`, {
        headers: { Authorization: `Bearer ${ownerBToken}` },
      });
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      const clusterIds = json.data.events.map((e: any) => e.cluster_id);
      assert.ok(clusterIds.every((cid: string) => cid === clusterBId));
    });

    test('3.3. Owner A searching for Org B secret keyword yields 0 records (No search leak)', async () => {
      const res = await fetch(
        `${baseUrl}/api/v1/telemetry/events?search=BETA_CONFIDENTIAL_EVENT_X88`,
        { headers: { Authorization: `Bearer ${ownerAToken}` } }
      );
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.data.events.length, 0, 'Must NOT leak events belonging to other organizations');
    });

    test('3.4. Cross-cluster access: Owner A querying Org B cluster returns 403 Forbidden', async () => {
      const res = await fetch(`${baseUrl}/api/v1/telemetry/events?cluster_id=${clusterBId}`, {
        headers: { Authorization: `Bearer ${ownerAToken}` },
      });
      assert.strictEqual(res.status, 403, 'Cross-tenant cluster access must be blocked with 403');
    });

    test('3.5. Organization parameter spoofing: Owner A passing ?organization_id=orgBId returns 403 Forbidden', async () => {
      const res = await fetch(`${baseUrl}/api/v1/telemetry/events?organization_id=${orgBId}`, {
        headers: { Authorization: `Bearer ${ownerAToken}` },
      });
      assert.strictEqual(res.status, 403, 'Cross-tenant organization spoofing must be blocked with 403');
    });

    test('3.6. Super Admin can query events across all organizations', async () => {
      const res = await fetch(`${baseUrl}/api/v1/telemetry/events`, {
        headers: { Authorization: `Bearer ${superAdminToken}` },
      });
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      const clusterIds = new Set(json.data.events.map((e: any) => e.cluster_id));
      assert.ok(clusterIds.has(clusterAId), 'Super Admin should see Cluster A');
      assert.ok(clusterIds.has(clusterBId), 'Super Admin should see Cluster B');
    });
  });
});
