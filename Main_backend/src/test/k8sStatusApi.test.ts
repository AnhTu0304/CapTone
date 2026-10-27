import test, { describe, before, after } from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import { AddressInfo } from 'node:net';
import jwt from 'jsonwebtoken';
import app from '../app';
import { config } from '../config/env';
import { pool } from '../config/database';
import { testRedisConnection, closeRedis } from '../config/redis';
import { AgentService } from '../services/agent.service';
import { K8sStatusService } from '../services/k8sStatus.service';
import { AgentK8sInventoryPayloadSchema } from '../schemas/agentWebSocket.schema';

describe('Kubernetes Status API Suite: Node, Pod, Deployment & Replica [S3][PB14 5.2]', () => {
  let server: http.Server;
  let baseUrl: string;

  const orgAId = 'b5200000-0000-4000-8000-000000000001';
  const orgBId = 'b5200000-0000-4000-8000-000000000002';

  const ownerAId = 'a5200000-0000-4000-8000-000000000001';
  const viewerAId = 'a5200000-0000-4000-8000-000000000002';
  const ownerBId = 'a5200000-0000-4000-8000-000000000003';
  const superAdminId = 'a5200000-0000-4000-8000-000000000004';

  const envAId = 'c5200000-0000-4000-8000-000000000001';
  const envBId = 'c5200000-0000-4000-8000-000000000002';

  const clusterAId = 'd5200000-0000-4000-8000-000000000001';
  const clusterBId = 'd5200000-0000-4000-8000-000000000002';

  const agentAId = 'e5200000-0000-4000-8000-000000000001';
  const agentBId = 'e5200000-0000-4000-8000-000000000002';

  const authAgentA = {
    id: agentAId,
    agent_uid: 'uid-k8s52-agent-a',
    name: 'agent-k8s52-a',
    status: 'ONLINE',
    cluster_id: clusterAId,
    environment_id: envAId,
    organization_id: orgAId,
    token_id: 'f5200000-0000-4000-8000-000000000001',
    token_expires_at: null,
  };

  let ownerAToken: string;
  let viewerAToken: string;
  let ownerBToken: string;
  let superAdminToken: string;

  before(async () => {
    await testRedisConnection();
    await K8sStatusService.ensureStatusColumns();

    const rolesRes = await pool.query(`SELECT id, code FROM roles WHERE scope = 'ORGANIZATION'`);
    const smeOwnerRoleId = rolesRes.rows.find((r) => r.code === 'SME_OWNER')?.id;
    const viewerRoleId = rolesRes.rows.find((r) => r.code === 'VIEWER')?.id;
    const srRes = await pool.query(`SELECT id, name FROM system_roles WHERE name = 'SUPER_ADMIN'`);
    const superAdminRoleId = srRes.rows[0]?.id;

    await pool.query(
      `INSERT INTO users (id, email, password_hash, full_name, status, created_at, updated_at)
       VALUES
         ($1, 'owner.a.k8s52@test.com', 'dummy_hash', 'Owner A K8s52', 'ACTIVE', NOW(), NOW()),
         ($2, 'viewer.a.k8s52@test.com', 'dummy_hash', 'Viewer A K8s52', 'ACTIVE', NOW(), NOW()),
         ($3, 'owner.b.k8s52@test.com', 'dummy_hash', 'Owner B K8s52', 'ACTIVE', NOW(), NOW()),
         ($4, 'super.k8s52@test.com', 'dummy_hash', 'Super Admin K8s52', 'ACTIVE', NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET status = 'ACTIVE', deleted_at = NULL;`,
      [ownerAId, viewerAId, ownerBId, superAdminId]
    );

    if (superAdminRoleId) {
      await pool.query(
        `INSERT INTO user_system_roles (user_id, system_role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING;`,
        [superAdminId, superAdminRoleId]
      );
    }

    await pool.query(
      `INSERT INTO organizations (id, name, slug, status, created_by, created_at, updated_at)
       VALUES
         ($1, 'K8s52 Org A', 'k8s52-org-a', 'ACTIVE', $2, NOW(), NOW()),
         ($3, 'K8s52 Org B', 'k8s52-org-b', 'ACTIVE', $4, NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET status = 'ACTIVE', deleted_at = NULL;`,
      [orgAId, ownerAId, orgBId, ownerBId]
    );

    await pool.query(
      `INSERT INTO organization_members (organization_id, user_id, role_id, status, joined_at)
       VALUES
         ($1, $2, $3, 'ACTIVE', NOW()),
         ($1, $4, $5, 'ACTIVE', NOW()),
         ($6, $7, $3, 'ACTIVE', NOW())
       ON CONFLICT (organization_id, user_id) DO UPDATE SET status = 'ACTIVE';`,
      [orgAId, ownerAId, smeOwnerRoleId, viewerAId, viewerRoleId, orgBId, ownerBId]
    );

    await pool.query(
      `INSERT INTO environments (id, organization_id, name, code, environment_type, created_by, created_at, updated_at)
       VALUES
         ($1, $2, 'Env K8s52 A', 'env-k8s52-a', 'PRODUCTION', $3, NOW(), NOW()),
         ($4, $5, 'Env K8s52 B', 'env-k8s52-b', 'PRODUCTION', $6, NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET organization_id = EXCLUDED.organization_id;`,
      [envAId, orgAId, ownerAId, envBId, orgBId, ownerBId]
    );

    await pool.query(
      `INSERT INTO clusters (id, environment_id, name, provider, kubernetes_version, status, last_synced_at, created_at, updated_at)
       VALUES
         ($1, $2, 'Cluster A K8s52', 'SELF_MANAGED', 'v1.30.0', 'CONNECTED', NOW(), NOW(), NOW()),
         ($3, $4, 'Cluster B K8s52', 'SELF_MANAGED', 'v1.30.0', 'CONNECTED', NOW(), NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET status = 'CONNECTED', deleted_at = NULL, last_synced_at = NOW();`,
      [clusterAId, envAId, clusterBId, envBId]
    );

    await pool.query(
      `INSERT INTO agents (id, agent_uid, cluster_id, environment_id, name, version, status, last_seen_at, created_at, updated_at)
       VALUES
         ($1, 'uid-k8s52-agent-a', $2, $3, 'agent-k8s52-a', '1.0.0', 'ONLINE', NOW(), NOW(), NOW()),
         ($4, 'uid-k8s52-agent-b', $5, $6, 'agent-k8s52-b', '1.0.0', 'ONLINE', NOW(), NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET status = 'ONLINE', last_seen_at = NOW();`,
      [agentAId, clusterAId, envAId, agentBId, clusterBId, envBId]
    );

    const signUser = (id: string, email: string, roles: string[] = ['USER']) =>
      jwt.sign({ id, email, status: 'ACTIVE', roles }, config.jwt.secret, {
        expiresIn: '1h',
        algorithm: 'HS256',
      });

    ownerAToken = signUser(ownerAId, 'owner.a.k8s52@test.com');
    viewerAToken = signUser(viewerAId, 'viewer.a.k8s52@test.com');
    ownerBToken = signUser(ownerBId, 'owner.b.k8s52@test.com');
    superAdminToken = signUser(superAdminId, 'super.k8s52@test.com', ['SUPER_ADMIN']);

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
    await pool.query(`DELETE FROM pods WHERE cluster_id IN ($1, $2)`, [clusterAId, clusterBId]);
    await pool.query(`DELETE FROM workloads WHERE cluster_id IN ($1, $2)`, [clusterAId, clusterBId]);
    await pool.query(`DELETE FROM nodes WHERE cluster_id IN ($1, $2)`, [clusterAId, clusterBId]);
    await pool.query(`DELETE FROM namespaces WHERE cluster_id IN ($1, $2)`, [clusterAId, clusterBId]);
    await pool.query(`DELETE FROM agents WHERE id IN ($1, $2)`, [agentAId, agentBId]);
    await pool.query(`DELETE FROM clusters WHERE id IN ($1, $2)`, [clusterAId, clusterBId]);
    await pool.query(`DELETE FROM environments WHERE id IN ($1, $2)`, [envAId, envBId]);
    await pool.query(`DELETE FROM organization_members WHERE organization_id IN ($1, $2)`, [orgAId, orgBId]);
    await pool.query(`DELETE FROM organizations WHERE id IN ($1, $2)`, [orgAId, orgBId]);
    await pool.query(`DELETE FROM users WHERE id IN ($1, $2, $3, $4)`, [ownerAId, viewerAId, ownerBId, superAdminId]);
    await closeRedis();
  });

  test('1. Sync inventory from Task 5.1 payload and verify Node Status API (Ready, NotReady, Unknown)', async () => {
    const parsedInventory = AgentK8sInventoryPayloadSchema.parse({
      nodes: [
        {
          name: 'node-ready-1',
          kubernetes_uid: 'uid-node-ready-1',
          status: 'Ready',
          roles: ['control-plane'],
          cpu_capacity_millicores: 4000,
          memory_capacity_bytes: 8589934592,
          disk_capacity_bytes: 53687091200,
          cpu_allocatable_millicores: 3800,
          memory_allocatable_bytes: 8000000000,
          disk_allocatable_bytes: 50000000000,
          pods_capacity: 110,
          pods_allocatable: 110,
          kubelet_version: 'v1.30.0',
          conditions: {
            Ready: 'True',
            MemoryPressure: 'False',
            DiskPressure: 'False',
            PIDPressure: 'False',
            NetworkUnavailable: 'False',
          },
          active_pressures: [],
          ready_reason: 'KubeletReady',
          ready_message: 'kubelet is posting ready status',
        },
        {
          name: 'node-notready-2',
          kubernetes_uid: 'uid-node-notready-2',
          status: 'NotReady',
          roles: ['worker'],
          cpu_capacity_millicores: 8000,
          memory_capacity_bytes: 17179869184,
          disk_capacity_bytes: 107374182400,
          cpu_allocatable_millicores: 7500,
          memory_allocatable_bytes: 16000000000,
          kubelet_version: 'v1.30.0',
          conditions: {
            Ready: 'False',
            MemoryPressure: 'True',
            DiskPressure: 'False',
            PIDPressure: 'False',
          },
          active_pressures: ['MemoryPressure'],
          ready_reason: 'KubeletNotReady',
          ready_message: 'PLEG is not healthy',
        },
        {
          name: 'node-unknown-3',
          kubernetes_uid: 'uid-node-unknown-3',
          status: 'Unknown',
          roles: ['worker'],
          cpu_capacity_millicores: 4000,
          memory_capacity_bytes: 8589934592,
          conditions: {
            Ready: 'Unknown',
          },
        },
      ],
      pods: [
        {
          name: 'web-running-ok',
          kubernetes_uid: 'uid-pod-running-ok',
          namespace: 'default',
          node_name: 'node-ready-1',
          phase: 'Running',
          status: 'Running',
          restart_count: 0,
          image: 'nginx:1.27',
          containers: [
            {
              name: 'nginx',
              image: 'nginx:1.27',
              ready: true,
              restart_count: 0,
              state: 'running',
            },
          ],
        },
        {
          name: 'api-running-unready',
          kubernetes_uid: 'uid-pod-running-unready',
          namespace: 'default',
          node_name: 'node-ready-1',
          phase: 'Running',
          status: 'Running',
          restart_count: 1,
          image: 'aegis/api:v1',
          containers: [
            {
              name: 'api-server',
              image: 'aegis/api:v1',
              ready: false,
              restart_count: 1,
              state: 'running',
            },
          ],
        },
        {
          name: 'worker-crashloop',
          kubernetes_uid: 'uid-pod-crashloop',
          namespace: 'production',
          node_name: 'node-notready-2',
          phase: 'Running',
          status: 'CrashLoopBackOff',
          restart_count: 6,
          image: 'aegis/worker:broken',
          containers: [
            {
              name: 'sidecar-proxy',
              image: 'envoy:v1.30',
              ready: true,
              restart_count: 0,
              state: 'running',
            },
            {
              name: 'billing-worker',
              image: 'aegis/worker:broken',
              ready: false,
              restart_count: 6,
              state: 'waiting',
              waiting_reason: 'CrashLoopBackOff',
              waiting_message: 'back-off 5m0s restarting failed container',
              last_terminated_reason: 'OOMKilled',
              last_exit_code: 137,
              last_finished_at: '2026-10-25T09:00:00Z',
            },
          ],
        },
        {
          name: 'job-pending',
          kubernetes_uid: 'uid-pod-pending',
          namespace: 'batch',
          node_name: null,
          phase: 'Pending',
          status: 'Pending',
          restart_count: 0,
          containers: [
            {
              name: 'migrator',
              image: 'aegis/migrator:v1',
              ready: false,
              restart_count: 0,
              state: 'waiting',
              waiting_reason: 'ContainerCreating',
            },
          ],
        },
        {
          name: 'pod-no-containers',
          kubernetes_uid: 'uid-pod-no-containers',
          namespace: 'default',
          node_name: 'node-ready-1',
          phase: 'Running',
          status: 'Running',
          restart_count: 0,
          containers: [],
        },
      ],
      deployments: [
        {
          name: 'web-frontend',
          kubernetes_uid: 'uid-dep-healthy',
          namespace: 'default',
          desired_replicas: 3,
          ready_replicas: 3,
          available_replicas: 3,
          updated_replicas: 3,
          unavailable_replicas: 0,
          generation: 4,
          observed_generation: 4,
          status: 'Healthy',
          conditions: {
            Available: { status: 'True', reason: 'MinimumReplicasAvailable', message: 'Deployment has minimum availability.' },
            Progressing: { status: 'True', reason: 'NewReplicaSetAvailable', message: 'ReplicaSet has successfully progressed.' },
          },
        },
        {
          name: 'payment-service',
          kubernetes_uid: 'uid-dep-degraded',
          namespace: 'production',
          desired_replicas: 3,
          ready_replicas: 1,
          available_replicas: 1,
          updated_replicas: 3,
          unavailable_replicas: 2,
          generation: 2,
          observed_generation: 2,
          status: 'Degraded',
          conditions: {
            Available: { status: 'False', reason: 'MinimumReplicasUnavailable', message: 'Deployment does not have minimum availability.' },
            Progressing: { status: 'True', reason: 'ReplicaSetUpdated', message: 'ReplicaSet is progressing.' },
          },
        },
        {
          name: 'checkout-rollout',
          kubernetes_uid: 'uid-dep-progressing',
          namespace: 'production',
          desired_replicas: 4,
          ready_replicas: 4,
          available_replicas: 4,
          updated_replicas: 2,
          unavailable_replicas: 0,
          generation: 5,
          observed_generation: 5,
          status: 'Progressing',
          conditions: {
            Available: { status: 'True', reason: 'MinimumReplicasAvailable', message: 'Minimum availability met' },
            Progressing: { status: 'True', reason: 'ReplicaSetUpdated', message: 'Rolling out new replica set' },
          },
        },
        {
          name: 'failed-rollout-app',
          kubernetes_uid: 'uid-dep-deadline',
          namespace: 'production',
          desired_replicas: 2,
          ready_replicas: 0,
          available_replicas: 0,
          updated_replicas: 1,
          unavailable_replicas: 2,
          generation: 3,
          observed_generation: 3,
          status: 'ProgressDeadlineExceeded',
          conditions: {
            Available: { status: 'False', reason: 'MinimumReplicasUnavailable', message: 'No replicas available' },
            Progressing: { status: 'False', reason: 'ProgressDeadlineExceeded', message: 'ReplicaSet timed out progressing' },
          },
        },
        {
          name: 'batch-scaler-zero',
          kubernetes_uid: 'uid-dep-zero',
          namespace: 'batch',
          desired_replicas: 0,
          ready_replicas: 0,
          available_replicas: 0,
          updated_replicas: 0,
          unavailable_replicas: 0,
          generation: 1,
          observed_generation: 1,
          status: 'ScaledToZero',
          conditions: {
            Progressing: { status: 'True', reason: 'NewReplicaSetAvailable', message: 'Scaled to zero' },
          },
        },
        {
          name: 'incomplete-deployment',
          kubernetes_uid: 'uid-dep-incomplete',
          namespace: 'default',
          desired_replicas: null,
          ready_replicas: null,
          available_replicas: null,
          updated_replicas: null,
          unavailable_replicas: null,
          generation: null,
          observed_generation: null,
          status: null,
        },
      ],
    });

    await AgentService.syncClusterInventory(authAgentA, parsedInventory);

    const res = await fetch(`${baseUrl}/api/v1/organizations/${orgAId}/clusters/${clusterAId}/nodes`, {
      headers: { Authorization: `Bearer ${viewerAToken}` },
    });
    assert.strictEqual(res.status, 200);
    const body: any = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.length, 3);

    const readyNode = body.data.find((n: any) => n.name === 'node-ready-1');
    assert.strictEqual(readyNode.status, 'Ready');
    assert.strictEqual(readyNode.effective_status, 'Ready');
    assert.strictEqual(readyNode.ready, true);
    assert.strictEqual(readyNode.capacity.cpu_millicores, 4000);
    assert.strictEqual(readyNode.allocatable.cpu_millicores, 3800);
    assert.strictEqual(readyNode.freshness.state, 'FRESH');

    const notReadyNode = body.data.find((n: any) => n.name === 'node-notready-2');
    assert.strictEqual(notReadyNode.status, 'NotReady');
    assert.strictEqual(notReadyNode.effective_status, 'NotReady');
    assert.strictEqual(notReadyNode.ready, false);
    assert.ok(notReadyNode.active_pressures.includes('MemoryPressure'));

    const unknownNode = body.data.find((n: any) => n.name === 'node-unknown-3');
    assert.strictEqual(unknownNode.status, 'Unknown');
    assert.strictEqual(unknownNode.effective_status, 'Unknown');
    assert.strictEqual(unknownNode.ready, null);

    // Detail endpoint by ID
    const detailRes = await fetch(
      `${baseUrl}/api/v1/organizations/${orgAId}/clusters/${clusterAId}/nodes/${readyNode.id}/status`,
      { headers: { Authorization: `Bearer ${viewerAToken}` } }
    );
    assert.strictEqual(detailRes.status, 200);
    const detailBody: any = await detailRes.json();
    assert.strictEqual(detailBody.data.name, 'node-ready-1');
    assert.strictEqual(detailBody.data.conditions.Ready, 'True');

    // Non-existent node -> 404
    const notFoundRes = await fetch(
      `${baseUrl}/api/v1/organizations/${orgAId}/clusters/${clusterAId}/nodes/non-existent-node`,
      { headers: { Authorization: `Bearer ${viewerAToken}` } }
    );
    assert.strictEqual(notFoundRes.status, 404);
  });

  test('2. Pod Status API: Running+Ready vs Running+Unready, CrashLoopBackOff, Pending, and missing containers', async () => {
    const res = await fetch(`${baseUrl}/api/v1/organizations/${orgAId}/clusters/${clusterAId}/pods`, {
      headers: { Authorization: `Bearer ${ownerAToken}` },
    });
    assert.strictEqual(res.status, 200);
    const body: any = await res.json();
    assert.strictEqual(body.data.length, 5);

    // 2.1 Running + Ready container -> healthy
    const healthyPod = body.data.find((p: any) => p.name === 'web-running-ok');
    assert.strictEqual(healthyPod.phase, 'Running');
    assert.strictEqual(healthyPod.status, 'Running');
    assert.strictEqual(healthyPod.effective_status, 'Running');
    assert.strictEqual(healthyPod.is_healthy, true);

    // 2.2 Running phase + Unready container -> NOT healthy (status = NotReady)
    const unreadyPod = body.data.find((p: any) => p.name === 'api-running-unready');
    assert.strictEqual(unreadyPod.phase, 'Running');
    assert.strictEqual(unreadyPod.status, 'NotReady');
    assert.strictEqual(unreadyPod.is_healthy, false);
    assert.strictEqual(unreadyPod.unready_containers.length, 1);

    // 2.3 Multi-container Pod with CrashLoopBackOff
    const crashPod = body.data.find((p: any) => p.name === 'worker-crashloop');
    assert.strictEqual(crashPod.status, 'CrashLoopBackOff');
    assert.strictEqual(crashPod.is_healthy, false);
    assert.strictEqual(crashPod.crash_loop_containers.length, 1);
    assert.strictEqual(crashPod.crash_loop_containers[0].name, 'billing-worker');
    assert.strictEqual(crashPod.crash_loop_containers[0].restart_count, 6);
    assert.strictEqual(crashPod.crash_loop_containers[0].last_terminated_reason, 'OOMKilled');
    assert.strictEqual(crashPod.crash_loop_containers[0].last_exit_code, 137);

    // 2.4 Pending Pod
    const pendingPod = body.data.find((p: any) => p.name === 'job-pending');
    assert.strictEqual(pendingPod.phase, 'Pending');
    assert.strictEqual(pendingPod.is_healthy, false);

    // 2.5 Running Pod without container data -> container_data_available = false, is_healthy = null
    const noContainerPod = body.data.find((p: any) => p.name === 'pod-no-containers');
    assert.strictEqual(noContainerPod.container_data_available, false);
    assert.strictEqual(noContainerPod.is_healthy, null);

    // Filter by crashLoopOnly=true
    const crashFilterRes = await fetch(
      `${baseUrl}/api/v1/organizations/${orgAId}/clusters/${clusterAId}/pods?crashLoopOnly=true`,
      { headers: { Authorization: `Bearer ${ownerAToken}` } }
    );
    assert.strictEqual(crashFilterRes.status, 200);
    const crashFilterBody: any = await crashFilterRes.json();
    assert.strictEqual(crashFilterBody.data.length, 1);
    assert.strictEqual(crashFilterBody.data[0].name, 'worker-crashloop');
  });

  test('3. Deployment & Replica Status API: Healthy, Degraded, Progressing, ProgressDeadlineExceeded, ScaledToZero, InsufficientData', async () => {
    const res = await fetch(`${baseUrl}/api/v1/organizations/${orgAId}/clusters/${clusterAId}/deployments`, {
      headers: { Authorization: `Bearer ${ownerAToken}` },
    });
    assert.strictEqual(res.status, 200);
    const body: any = await res.json();
    assert.strictEqual(body.data.length, 6);

    // 3.1 Healthy Deployment
    const healthyDep = body.data.find((d: any) => d.name === 'web-frontend');
    assert.strictEqual(healthyDep.status, 'Healthy');
    assert.strictEqual(healthyDep.is_healthy, true);
    assert.strictEqual(healthyDep.replicas.status, 'Satisfied');
    assert.strictEqual(healthyDep.replicas.is_satisfied, true);
    assert.strictEqual(healthyDep.replicas.desired, 3);
    assert.strictEqual(healthyDep.replicas.ready, 3);
    assert.strictEqual(healthyDep.replicas.available, 3);
    assert.strictEqual(healthyDep.replicas.missing_ready, 0);

    // 3.2 Degraded Deployment (ready < desired)
    const degradedDep = body.data.find((d: any) => d.name === 'payment-service');
    assert.strictEqual(degradedDep.status, 'Degraded');
    assert.strictEqual(degradedDep.is_healthy, false);
    assert.strictEqual(degradedDep.replicas.status, 'InsufficientReplicas');
    assert.strictEqual(degradedDep.replicas.is_satisfied, false);
    assert.strictEqual(degradedDep.replicas.missing_ready, 2);
    assert.strictEqual(degradedDep.replicas.missing_available, 2);

    // 3.3 Rollout in progress (updated < desired)
    const rolloutDep = body.data.find((d: any) => d.name === 'checkout-rollout');
    assert.strictEqual(rolloutDep.status, 'Progressing');
    assert.strictEqual(rolloutDep.rollout_in_progress, true);
    assert.strictEqual(rolloutDep.replicas.status, 'RolloutUpdating');
    assert.strictEqual(rolloutDep.replicas.outdated_replicas, 2);

    // 3.4 ProgressDeadlineExceeded
    const failedDep = body.data.find((d: any) => d.name === 'failed-rollout-app');
    assert.strictEqual(failedDep.status, 'ProgressDeadlineExceeded');
    assert.strictEqual(failedDep.is_healthy, false);

    // 3.5 Intentional scale to zero (desired = 0 is NOT an error)
    const zeroDep = body.data.find((d: any) => d.name === 'batch-scaler-zero');
    assert.strictEqual(zeroDep.status, 'ScaledToZero');
    assert.strictEqual(zeroDep.is_healthy, true);
    assert.strictEqual(zeroDep.replicas.status, 'ScaledToZero');
    assert.strictEqual(zeroDep.replicas.is_satisfied, true);

    // 3.6 Incomplete deployment fields -> InsufficientData (never defaults to 0/0 Healthy)
    const incompleteDep = body.data.find((d: any) => d.name === 'incomplete-deployment');
    assert.strictEqual(incompleteDep.status, 'InsufficientData');
    assert.strictEqual(incompleteDep.is_healthy, null);
    assert.strictEqual(incompleteDep.replicas.data_complete, false);
    assert.strictEqual(incompleteDep.replicas.status, 'InsufficientData');

    // 3.7 Dedicated Replica Status endpoint
    const repRes = await fetch(
      `${baseUrl}/api/v1/organizations/${orgAId}/clusters/${clusterAId}/deployments/${degradedDep.id}/replicas`,
      { headers: { Authorization: `Bearer ${ownerAToken}` } }
    );
    assert.strictEqual(repRes.status, 200);
    const repBody: any = await repRes.json();
    assert.strictEqual(repBody.data.deployment_name, 'payment-service');
    assert.strictEqual(repBody.data.desired, 3);
    assert.strictEqual(repBody.data.ready, 1);
    assert.strictEqual(repBody.data.missing_ready, 2);
  });

  test('4. Cluster Status Summary endpoint aggregates Node, Pod, Deployment & Freshness state', async () => {
    const res = await fetch(`${baseUrl}/api/v1/organizations/${orgAId}/clusters/${clusterAId}/status`, {
      headers: { Authorization: `Bearer ${ownerAToken}` },
    });
    assert.strictEqual(res.status, 200);
    const body: any = await res.json();
    assert.strictEqual(body.data.cluster_id, clusterAId);
    assert.strictEqual(body.data.summary.nodes.total, 3);
    assert.strictEqual(body.data.summary.nodes.ready, 1);
    assert.strictEqual(body.data.summary.nodes.not_ready, 1);
    assert.strictEqual(body.data.summary.nodes.unknown, 1);
    assert.strictEqual(body.data.summary.pods.total, 5);
    assert.strictEqual(body.data.summary.pods.crash_loop_back_off, 1);
    assert.strictEqual(body.data.summary.deployments.total, 6);
  });

  test('5. Freshness & Agent Disconnection: Stale or OFFLINE Agent marks effective_status as Unverified', async () => {
    await pool.query(
      `UPDATE agents SET status = 'OFFLINE', last_seen_at = NOW() - INTERVAL '10 minutes' WHERE id = $1`,
      [agentAId]
    );
    await pool.query(
      `UPDATE nodes SET observed_at = NOW() - INTERVAL '10 minutes' WHERE cluster_id = $1`,
      [clusterAId]
    );
    await pool.query(
      `UPDATE workloads SET observed_at = NOW() - INTERVAL '10 minutes' WHERE cluster_id = $1`,
      [clusterAId]
    );

    const nodeRes = await fetch(`${baseUrl}/api/v1/organizations/${orgAId}/clusters/${clusterAId}/nodes`, {
      headers: { Authorization: `Bearer ${ownerAToken}` },
    });
    assert.strictEqual(nodeRes.status, 200);
    const nodeBody: any = await nodeRes.json();
    const readyNode = nodeBody.data.find((n: any) => n.name === 'node-ready-1');
    assert.strictEqual(readyNode.status, 'Ready');
    assert.strictEqual(readyNode.effective_status, 'Unverified');
    assert.strictEqual(readyNode.freshness.state, 'STALE');
    assert.strictEqual(readyNode.freshness.agent_connected, false);
    assert.ok(readyNode.freshness.warning.length > 0);

    const depRes = await fetch(`${baseUrl}/api/v1/organizations/${orgAId}/clusters/${clusterAId}/deployments`, {
      headers: { Authorization: `Bearer ${ownerAToken}` },
    });
    const depBody: any = await depRes.json();
    const healthyDep = depBody.data.find((d: any) => d.name === 'web-frontend');
    assert.strictEqual(healthyDep.status, 'Healthy');
    assert.strictEqual(healthyDep.effective_status, 'Unverified');
    assert.strictEqual(healthyDep.replicas.status, 'Unverified');

    // Restore agent ONLINE
    await pool.query(`UPDATE agents SET status = 'ONLINE', last_seen_at = NOW() WHERE id = $1`, [agentAId]);
  });

  test('6. Deleted Pod & Deleted Deployment are removed on subsequent inventory sync (not retained indefinitely)', async () => {
    const nextInventory = AgentK8sInventoryPayloadSchema.parse({
      nodes: [
        {
          name: 'node-ready-1',
          kubernetes_uid: 'uid-node-ready-1',
          status: 'Ready',
          roles: ['control-plane'],
          cpu_capacity_millicores: 4000,
          memory_capacity_bytes: 8589934592,
        },
      ],
      pods: [
        {
          name: 'web-running-ok',
          kubernetes_uid: 'uid-pod-running-ok',
          namespace: 'default',
          node_name: 'node-ready-1',
          phase: 'Running',
          status: 'Running',
          restart_count: 0,
          containers: [{ name: 'nginx', image: 'nginx:1.27', ready: true, restart_count: 0, state: 'running' }],
        },
      ],
      deployments: [
        {
          name: 'web-frontend',
          kubernetes_uid: 'uid-dep-healthy',
          namespace: 'default',
          desired_replicas: 3,
          ready_replicas: 3,
          available_replicas: 3,
          updated_replicas: 3,
          unavailable_replicas: 0,
          generation: 4,
          observed_generation: 4,
          status: 'Healthy',
        },
      ],
    });

    await AgentService.syncClusterInventory(authAgentA, nextInventory);

    const deletedPodRes = await fetch(
      `${baseUrl}/api/v1/organizations/${orgAId}/clusters/${clusterAId}/pods/worker-crashloop`,
      { headers: { Authorization: `Bearer ${ownerAToken}` } }
    );
    assert.strictEqual(deletedPodRes.status, 404);

    const deletedDepRes = await fetch(
      `${baseUrl}/api/v1/organizations/${orgAId}/clusters/${clusterAId}/deployments/payment-service`,
      { headers: { Authorization: `Bearer ${ownerAToken}` } }
    );
    assert.strictEqual(deletedDepRes.status, 404);
  });

  test('7. Security, Authentication, RBAC & Cross-Tenant Isolation', async () => {
    // 7.1 Unauthenticated -> 401
    const unauthRes = await fetch(`${baseUrl}/api/v1/organizations/${orgAId}/clusters/${clusterAId}/nodes`);
    assert.strictEqual(unauthRes.status, 401);

    // 7.2 Org B user accessing Org A cluster via URL -> 403
    const crossOrgRes = await fetch(`${baseUrl}/api/v1/organizations/${orgAId}/clusters/${clusterAId}/nodes`, {
      headers: { Authorization: `Bearer ${ownerBToken}` },
    });
    assert.strictEqual(crossOrgRes.status, 403);

    // 7.3 Org B user accessing Org A cluster under Org B URL -> 403
    const spoofClusterRes = await fetch(`${baseUrl}/api/v1/organizations/${orgBId}/clusters/${clusterAId}/pods`, {
      headers: { Authorization: `Bearer ${ownerBToken}` },
    });
    assert.strictEqual(spoofClusterRes.status, 403);

    // 7.4 Org A user spoofing Org B in query parameter -> 403
    const spoofQueryOrgRes = await fetch(
      `${baseUrl}/api/v1/organizations/${orgAId}/clusters/${clusterAId}/deployments?orgId=${orgBId}`,
      { headers: { Authorization: `Bearer ${ownerAToken}` } }
    );
    assert.strictEqual(spoofQueryOrgRes.status, 403);

    // 7.5 Super Admin can query global /api/v1/clusters/:clusterId/deployments
    const superRes = await fetch(`${baseUrl}/api/v1/clusters/${clusterAId}/deployments`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    assert.strictEqual(superRes.status, 200);

    // 7.6 Non-admin calling global /api/v1/clusters/:clusterId/deployments -> 403
    const nonAdminGlobalClusterRes = await fetch(`${baseUrl}/api/v1/clusters/${clusterAId}/deployments`, {
      headers: { Authorization: `Bearer ${ownerAToken}` },
    });
    assert.strictEqual(nonAdminGlobalClusterRes.status, 403);

    // 7.7 Invalid pagination parameter -> 400
    const badLimitRes = await fetch(
      `${baseUrl}/api/v1/organizations/${orgAId}/clusters/${clusterAId}/nodes?limit=9999`,
      { headers: { Authorization: `Bearer ${ownerAToken}` } }
    );
    assert.strictEqual(badLimitRes.status, 400);
  });
});
