import { pool } from '../config/database';
import { ApiError } from '../utils/apiError';

/**
 * [S3][PB14] Task 5.2 – Node, Pod, Deployment & Replica Status Service.
 *
 * Data source: PostgreSQL state tables (`nodes`, `pods`, `workloads`, `clusters`, `agents`)
 * synchronized by `AgentService.syncClusterInventory` from the Task 5.1 Agent collectors.
 * This service never invokes the Kubernetes API directly and never triggers remediation.
 */

export const STATUS_STALE_AFTER_SECONDS = 90;

export type FreshnessState = 'FRESH' | 'STALE' | 'NEVER_SYNCED';

export interface FreshnessMetadata {
  state: FreshnessState;
  observed_at: string | null;
  age_seconds: number | null;
  stale_after_seconds: number;
  agent_connected: boolean;
  agent_status: string | null;
  warning: string | null;
}

export function computeFreshness(
  observedAt: Date | string | null | undefined,
  options: {
    now?: number;
    agentStatus?: string | null;
    clusterStatus?: string | null;
  } = {}
): FreshnessMetadata {
  const now = options.now ?? Date.now();
  const agentStatus = options.agentStatus ? String(options.agentStatus).toUpperCase() : null;
  const clusterStatus = options.clusterStatus ? String(options.clusterStatus).toUpperCase() : null;

  const agentDisconnected =
    clusterStatus === 'DISCONNECTED' ||
    (agentStatus !== null && ['OFFLINE', 'DISCONNECTED', 'REVOKED', 'TIMEOUT'].includes(agentStatus));
  const agentConnected = !agentDisconnected;

  if (!observedAt) {
    return {
      state: 'NEVER_SYNCED',
      observed_at: null,
      age_seconds: null,
      stale_after_seconds: STATUS_STALE_AFTER_SECONDS,
      agent_connected: agentConnected,
      agent_status: agentStatus,
      warning: 'Chưa có dữ liệu đồng bộ từ Kubernetes Agent cho tài nguyên này.',
    };
  }

  const ts = new Date(observedAt).getTime();
  if (isNaN(ts)) {
    return {
      state: 'NEVER_SYNCED',
      observed_at: null,
      age_seconds: null,
      stale_after_seconds: STATUS_STALE_AFTER_SECONDS,
      agent_connected: agentConnected,
      agent_status: agentStatus,
      warning: 'Timestamp quan sát không hợp lệ.',
    };
  }

  const ageSeconds = Math.max(0, Math.round((now - ts) / 1000));
  const isStaleByAge = ageSeconds > STATUS_STALE_AFTER_SECONDS;
  const state: FreshnessState = isStaleByAge ? 'STALE' : 'FRESH';

  let warning: string | null = null;
  if (!agentConnected) {
    warning = 'Agent của cụm đang mất kết nối (OFFLINE/DISCONNECTED); dữ liệu hiển thị là lần quan sát cuối cùng và không thể xác minh là trạng thái hiện tại.';
  } else if (isStaleByAge) {
    warning = `Dữ liệu quan sát đã cũ (${ageSeconds}s > ${STATUS_STALE_AFTER_SECONDS}s); trạng thái hiện tại chưa thể xác minh.`;
  }

  return {
    state,
    observed_at: new Date(ts).toISOString(),
    age_seconds: ageSeconds,
    stale_after_seconds: STATUS_STALE_AFTER_SECONDS,
    agent_connected: agentConnected,
    agent_status: agentStatus,
    warning,
  };
}

export function normalizeNodeStatus(row: any, now: number = Date.now()) {
  const freshness = computeFreshness(row.observed_at, {
    now,
    agentStatus: row.agent_status,
    clusterStatus: row.cluster_status,
  });

  const conditions: Record<string, string> =
    row.conditions && typeof row.conditions === 'object' && !Array.isArray(row.conditions)
      ? { ...row.conditions }
      : {};

  const rawStatus = String(row.status || '').trim();
  const readyCond = conditions.Ready;

  let reportedStatus: 'Ready' | 'NotReady' | 'Unknown';
  if (readyCond === 'True' || (readyCond === undefined && rawStatus === 'Ready')) {
    reportedStatus = 'Ready';
    if (!conditions.Ready) conditions.Ready = 'True';
  } else if (readyCond === 'False' || (readyCond === undefined && rawStatus === 'NotReady')) {
    reportedStatus = 'NotReady';
    if (!conditions.Ready) conditions.Ready = 'False';
  } else {
    reportedStatus = 'Unknown';
    if (!conditions.Ready) conditions.Ready = 'Unknown';
  }

  const pressureKeys = ['MemoryPressure', 'DiskPressure', 'PIDPressure', 'NetworkUnavailable'];
  const activePressures: string[] = [];
  for (const key of pressureKeys) {
    if (conditions[key] === 'True') {
      activePressures.push(key);
    }
  }

  const rawAlloc =
    row.allocatable && typeof row.allocatable === 'object' && !Array.isArray(row.allocatable)
      ? row.allocatable
      : {};
  if (Array.isArray(rawAlloc.active_pressures)) {
    for (const p of rawAlloc.active_pressures) {
      if (typeof p === 'string' && !activePressures.includes(p)) {
        activePressures.push(p);
      }
    }
  }

  const isVerified = freshness.state === 'FRESH' && freshness.agent_connected;
  const effectiveStatus: 'Ready' | 'NotReady' | 'Unknown' | 'Unverified' = isVerified
    ? reportedStatus
    : 'Unverified';

  const ready: boolean | null =
    effectiveStatus === 'Ready'
      ? true
      : effectiveStatus === 'NotReady'
        ? false
        : null;

  const cpuCap = row.cpu_capacity_millicores !== null && row.cpu_capacity_millicores !== undefined
    ? Number(row.cpu_capacity_millicores)
    : null;
  const memCap = row.memory_capacity_bytes !== null && row.memory_capacity_bytes !== undefined
    ? Number(row.memory_capacity_bytes)
    : null;
  const diskCap = row.disk_capacity_bytes !== null && row.disk_capacity_bytes !== undefined
    ? Number(row.disk_capacity_bytes)
    : null;

  return {
    id: row.id,
    cluster_id: row.cluster_id,
    cluster_name: row.cluster_name || null,
    cluster_status: row.cluster_status || null,
    cluster_provider: row.cluster_provider || null,
    name: row.name,
    kubernetes_uid: row.kubernetes_uid || null,
    status: reportedStatus,
    effective_status: effectiveStatus,
    ready,
    conditions,
    active_pressures: activePressures,
    capacity: {
      cpu_millicores: cpuCap,
      memory_bytes: memCap,
      disk_bytes: diskCap,
      pods: rawAlloc.pods_capacity ?? null,
    },
    allocatable: {
      cpu_millicores: rawAlloc.cpu_millicores ?? cpuCap,
      memory_bytes: rawAlloc.memory_bytes ?? memCap,
      disk_bytes: rawAlloc.disk_bytes ?? diskCap,
      pods_capacity: rawAlloc.pods_capacity ?? null,
      pods_allocatable: rawAlloc.pods_allocatable ?? null,
      ready_reason: rawAlloc.ready_reason ?? null,
      ready_message: rawAlloc.ready_message ?? null,
    },
    cpu_capacity_millicores: cpuCap,
    memory_capacity_bytes: memCap,
    disk_capacity_bytes: diskCap,
    kubelet_version: row.kubelet_version || null,
    roles: Array.isArray(row.roles) ? row.roles : [],
    labels: row.labels && typeof row.labels === 'object' ? row.labels : {},
    pods_count: row.pods_count !== undefined ? Number(row.pods_count) : undefined,
    observed_at: freshness.observed_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    freshness,
  };
}

const VALID_POD_PHASES = new Set(['Pending', 'Running', 'Succeeded', 'Failed', 'Unknown']);

export function normalizePodStatus(row: any, now: number = Date.now()) {
  const freshness = computeFreshness(row.observed_at, {
    now,
    agentStatus: row.agent_status,
    clusterStatus: row.cluster_status,
  });

  const rawPhase = String(row.phase || '').trim();
  const phase = VALID_POD_PHASES.has(rawPhase) ? rawPhase : 'Unknown';

  const containers: any[] = Array.isArray(row.containers) ? row.containers : [];
  const appContainers = containers.filter((c) => !c?.is_init);
  const hasContainerData = containers.length > 0;

  let derivedStatus = String(row.status || '').trim() || phase;

  for (const c of containers) {
    if (c?.waiting_reason === 'CrashLoopBackOff') {
      derivedStatus = 'CrashLoopBackOff';
      break;
    }
    if (
      c?.waiting_reason === 'ImagePullBackOff' ||
      c?.waiting_reason === 'ErrImagePull' ||
      c?.waiting_reason === 'CreateContainerConfigError'
    ) {
      derivedStatus = c.waiting_reason;
      break;
    }
    if (c?.state === 'terminated' && c?.terminated_reason === 'OOMKilled') {
      derivedStatus = 'OOMKilled';
      break;
    }
    if (
      c?.state === 'terminated' &&
      (c?.terminated_reason === 'Error' || (typeof c?.exit_code === 'number' && c.exit_code !== 0))
    ) {
      derivedStatus = 'Error';
      break;
    }
  }

  // Never treat phase == Running as healthy if any app container is not ready or container statuses are missing
  if (derivedStatus === 'Running' && phase === 'Running') {
    if (appContainers.length > 0 && appContainers.some((c) => c.ready === false)) {
      derivedStatus = 'NotReady';
    }
  }

  const isVerified = freshness.state === 'FRESH' && freshness.agent_connected;
  const effectiveStatus = isVerified ? derivedStatus : 'Unverified';

  let isHealthy: boolean | null = null;
  if (isVerified) {
    if (derivedStatus === 'Succeeded') {
      isHealthy = true;
    } else if (derivedStatus === 'Running' && phase === 'Running') {
      isHealthy = appContainers.length > 0 ? appContainers.every((c) => c.ready === true) : null;
    } else if (derivedStatus === 'Unknown') {
      isHealthy = null;
    } else {
      isHealthy = false;
    }
  }

  const crashLoopContainers = containers
    .filter((c) => c?.waiting_reason === 'CrashLoopBackOff')
    .map((c) => ({
      name: c.name || 'container',
      is_init: Boolean(c.is_init),
      restart_count: Number(c.restart_count ?? 0),
      waiting_reason: 'CrashLoopBackOff',
      waiting_message: c.waiting_message ?? null,
      last_terminated_reason: c.last_terminated_reason ?? null,
      last_exit_code: c.last_exit_code ?? null,
      last_finished_at: c.last_finished_at ?? null,
    }));

  const restartCount =
    row.restart_count !== null && row.restart_count !== undefined
      ? Number(row.restart_count)
      : containers.reduce((acc, c) => acc + Number(c?.restart_count || 0), 0);

  const unreadyContainers = appContainers
    .filter((c) => c?.ready === false)
    .map((c) => c.name || 'container');

  return {
    id: row.id,
    cluster_id: row.cluster_id,
    cluster_name: row.cluster_name || null,
    namespace: row.namespace || 'default',
    node_name: row.node_name || 'unassigned',
    workload_id: row.workload_id || null,
    name: row.name,
    kubernetes_uid: row.kubernetes_uid || null,
    phase,
    status: derivedStatus,
    effective_status: effectiveStatus,
    is_healthy: isHealthy,
    restart_count: restartCount,
    containers,
    container_data_available: hasContainerData,
    unready_containers: unreadyContainers,
    crash_loop_containers: crashLoopContainers,
    has_crash_loop: derivedStatus === 'CrashLoopBackOff' || crashLoopContainers.length > 0,
    image: row.image || '',
    labels: row.labels && typeof row.labels === 'object' ? row.labels : {},
    started_at: row.started_at || null,
    observed_at: freshness.observed_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    freshness,
  };
}

export function buildReplicaStatus(
  row: any,
  isVerified: boolean = true
) {
  const toIntOrNull = (val: any): number | null => {
    if (val === null || val === undefined || val === '') return null;
    const n = Number(val);
    return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : null;
  };

  const desired = toIntOrNull(row.desired_replicas);
  const ready = toIntOrNull(row.ready_replicas);
  const available = toIntOrNull(row.available_replicas);
  const updated = toIntOrNull(row.updated_replicas);
  const rawUnavail = toIntOrNull(row.unavailable_replicas);

  const dataComplete =
    desired !== null && ready !== null && available !== null && updated !== null;

  const unavailable =
    rawUnavail !== null
      ? rawUnavail
      : desired !== null && available !== null
        ? Math.max(0, desired - available)
        : null;

  const missingReady =
    desired !== null && ready !== null ? Math.max(0, desired - ready) : null;
  const missingAvailable =
    desired !== null && available !== null ? Math.max(0, desired - available) : null;
  const outdatedReplicas =
    desired !== null && updated !== null ? Math.max(0, desired - updated) : null;

  const isSatisfied: boolean | null = !dataComplete
    ? null
    : desired === 0
      ? true
      : ready! >= desired! && available! >= desired! && updated! >= desired! && (unavailable ?? 0) === 0;

  let replicaStatus:
    | 'ScaledToZero'
    | 'Satisfied'
    | 'RolloutUpdating'
    | 'InsufficientReplicas'
    | 'InsufficientData'
    | 'Unverified';

  if (!isVerified) {
    replicaStatus = 'Unverified';
  } else if (!dataComplete) {
    replicaStatus = 'InsufficientData';
  } else if (desired === 0) {
    replicaStatus = 'ScaledToZero';
  } else if (ready! < desired! || available! < desired! || (unavailable ?? 0) > 0) {
    replicaStatus = 'InsufficientReplicas';
  } else if (updated! < desired!) {
    replicaStatus = 'RolloutUpdating';
  } else {
    replicaStatus = 'Satisfied';
  }

  return {
    deployment_id: row.id || null,
    deployment_name: row.name || null,
    namespace: row.namespace || 'default',
    cluster_id: row.cluster_id || null,
    desired,
    ready,
    available,
    updated,
    unavailable,
    missing_ready: missingReady,
    missing_available: missingAvailable,
    outdated_replicas: outdatedReplicas,
    data_complete: dataComplete,
    is_satisfied: isVerified ? isSatisfied : null,
    status: replicaStatus,
  };
}

export function normalizeDeploymentStatus(row: any, now: number = Date.now()) {
  const freshness = computeFreshness(row.observed_at, {
    now,
    agentStatus: row.agent_status,
    clusterStatus: row.cluster_status,
  });
  const isVerified = freshness.state === 'FRESH' && freshness.agent_connected;
  const replicas = buildReplicaStatus(row, isVerified);

  const generation =
    row.generation === null || row.generation === undefined ? null : Number(row.generation);
  const observedGeneration =
    row.observed_generation === null || row.observed_generation === undefined
      ? null
      : Number(row.observed_generation);

  const conditions: Record<string, any> =
    row.conditions && typeof row.conditions === 'object' && !Array.isArray(row.conditions)
      ? row.conditions
      : {};

  const progCond = conditions.Progressing || {};
  const availCond = conditions.Available || {};
  const repFailCond = conditions.ReplicaFailure || {};

  let evaluatedRolloutStatus: string;
  if (!replicas.data_complete) {
    evaluatedRolloutStatus = 'InsufficientData';
  } else if (replicas.desired === 0) {
    evaluatedRolloutStatus = 'ScaledToZero';
  } else if (
    progCond.status === 'False' &&
    progCond.reason === 'ProgressDeadlineExceeded'
  ) {
    evaluatedRolloutStatus = 'ProgressDeadlineExceeded';
  } else if (repFailCond.status === 'True') {
    evaluatedRolloutStatus = 'ReplicaFailure';
  } else if (
    generation !== null &&
    observedGeneration !== null &&
    observedGeneration < generation
  ) {
    evaluatedRolloutStatus = 'Progressing';
  } else if (
    replicas.ready! < replicas.desired! ||
    replicas.available! < replicas.desired! ||
    (replicas.unavailable ?? 0) > 0 ||
    availCond.status === 'False'
  ) {
    evaluatedRolloutStatus = 'Degraded';
  } else if (replicas.updated! < replicas.desired!) {
    evaluatedRolloutStatus = 'Progressing';
  } else {
    evaluatedRolloutStatus = row.rollout_status || 'Healthy';
  }

  const effectiveStatus = isVerified ? evaluatedRolloutStatus : 'Unverified';

  let isHealthy: boolean | null = null;
  if (isVerified && evaluatedRolloutStatus !== 'InsufficientData') {
    if (evaluatedRolloutStatus === 'Healthy' || evaluatedRolloutStatus === 'ScaledToZero') {
      isHealthy = true;
    } else if (evaluatedRolloutStatus === 'Progressing') {
      isHealthy =
        replicas.ready !== null &&
        replicas.available !== null &&
        replicas.desired !== null &&
        replicas.ready >= replicas.desired &&
        replicas.available >= replicas.desired;
    } else {
      isHealthy = false;
    }
  }

  const rolloutInProgress =
    evaluatedRolloutStatus === 'Progressing' ||
    (generation !== null && observedGeneration !== null && observedGeneration < generation) ||
    (replicas.data_complete && replicas.desired! > 0 && replicas.updated! < replicas.desired!);

  return {
    id: row.id,
    cluster_id: row.cluster_id,
    cluster_name: row.cluster_name || null,
    namespace: row.namespace || 'default',
    name: row.name,
    kubernetes_uid: row.kubernetes_uid || null,
    workload_type: row.workload_type || 'Deployment',
    status: evaluatedRolloutStatus,
    rollout_status: evaluatedRolloutStatus,
    effective_status: effectiveStatus,
    is_healthy: isHealthy,
    rollout_in_progress: rolloutInProgress,
    desired_replicas: replicas.desired,
    ready_replicas: replicas.ready,
    available_replicas: replicas.available,
    updated_replicas: replicas.updated,
    unavailable_replicas: replicas.unavailable,
    generation,
    observed_generation: observedGeneration,
    replicas,
    conditions,
    labels: row.labels && typeof row.labels === 'object' ? row.labels : {},
    observed_at: freshness.observed_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    freshness,
  };
}

export function parsePagination(query: Record<string, any>): { limit: number | null; offset: number } {
  let limit: number | null = null;
  let offset = 0;
  if (query.limit !== undefined && String(query.limit).trim() !== '') {
    const l = Number(query.limit);
    if (!Number.isInteger(l) || l < 1 || l > 500) {
      throw ApiError.badRequest('Tham số limit phải là số nguyên từ 1 đến 500');
    }
    limit = l;
  }
  if (query.offset !== undefined && String(query.offset).trim() !== '') {
    const o = Number(query.offset);
    if (!Number.isInteger(o) || o < 0) {
      throw ApiError.badRequest('Tham số offset phải là số nguyên không âm');
    }
    offset = o;
  }
  return { limit, offset };
}

export interface StatusRequestScope {
  user?: { id?: string; roles?: string[] | string };
  orgMember?: { organizationId: string; roleCode: string };
  orgId?: string;
  clusterId?: string;
  query?: Record<string, any>;
}

export interface ResolvedTenantScope {
  isPlatformAdmin: boolean;
  effectiveOrgId: string | null;
  allowedOrgIds: string[];
  clusterId: string | null;
}

export class K8sStatusService {
  private static columnsEnsured = false;

  public static async ensureStatusColumns(): Promise<void> {
    if (this.columnsEnsured) return;
    await pool.query(`
      ALTER TABLE nodes ADD COLUMN IF NOT EXISTS conditions JSONB DEFAULT '{}'::JSONB;
      ALTER TABLE nodes ADD COLUMN IF NOT EXISTS allocatable JSONB DEFAULT '{}'::JSONB;
      ALTER TABLE nodes ADD COLUMN IF NOT EXISTS observed_at TIMESTAMPTZ;
      ALTER TABLE pods ADD COLUMN IF NOT EXISTS containers JSONB DEFAULT '[]'::JSONB;
      ALTER TABLE pods ADD COLUMN IF NOT EXISTS observed_at TIMESTAMPTZ;
      ALTER TABLE workloads ADD COLUMN IF NOT EXISTS desired_replicas INT;
      ALTER TABLE workloads ADD COLUMN IF NOT EXISTS ready_replicas INT;
      ALTER TABLE workloads ADD COLUMN IF NOT EXISTS available_replicas INT;
      ALTER TABLE workloads ADD COLUMN IF NOT EXISTS updated_replicas INT;
      ALTER TABLE workloads ADD COLUMN IF NOT EXISTS unavailable_replicas INT;
      ALTER TABLE workloads ADD COLUMN IF NOT EXISTS generation BIGINT;
      ALTER TABLE workloads ADD COLUMN IF NOT EXISTS observed_generation BIGINT;
      ALTER TABLE workloads ADD COLUMN IF NOT EXISTS conditions JSONB DEFAULT '{}'::JSONB;
      ALTER TABLE workloads ADD COLUMN IF NOT EXISTS rollout_status VARCHAR(50);
      ALTER TABLE workloads ADD COLUMN IF NOT EXISTS observed_at TIMESTAMPTZ;
    `);
    this.columnsEnsured = true;
  }

  /**
   * Server-side authorization and tenant isolation check.
   * Never trusts client-supplied orgId or clusterId on URL/query without verifying ownership.
   */
  public static async resolveScope(scope: StatusRequestScope): Promise<ResolvedTenantScope> {
    const user = scope.user;
    if (!user?.id) {
      throw ApiError.unauthorized('Yêu cầu đăng nhập trước khi truy cập');
    }

    const rawRoles: string[] = Array.isArray(user.roles)
      ? user.roles
      : user.roles
        ? [String(user.roles)]
        : [];
    const isPlatformAdmin =
      scope.orgMember?.roleCode === 'SUPER_ADMIN' ||
      rawRoles.some((r) =>
        ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'ADMIN'].includes(String(r).trim().toUpperCase())
      );

    const urlOrgId = scope.orgId || scope.orgMember?.organizationId;
    const queryOrgId =
      (scope.query?.organization_id as string) ||
      (scope.query?.orgId as string) ||
      undefined;

    // Prevent URL vs query orgId spoofing
    if (urlOrgId && queryOrgId && urlOrgId !== queryOrgId) {
      throw ApiError.forbidden('Từ chối truy cập: Không được phép thay đổi organization_id trên query khác với phạm vi tổ chức hiện tại');
    }

    const requestedOrgId = urlOrgId || queryOrgId || null;
    let allowedOrgIds: string[] = [];

    if (!isPlatformAdmin) {
      const memberRes = await pool.query(
        `SELECT organization_id FROM organization_members WHERE user_id = $1 AND status = 'ACTIVE'`,
        [user.id]
      );
      allowedOrgIds = memberRes.rows.map((r) => r.organization_id);

      if (requestedOrgId) {
        if (!allowedOrgIds.includes(requestedOrgId)) {
          throw ApiError.forbidden('Từ chối truy cập: Bạn không phải là thành viên đang hoạt động của tổ chức này');
        }
      } else if (allowedOrgIds.length === 0) {
        throw ApiError.forbidden('Từ chối truy cập: Tài khoản chưa thuộc tổ chức hoạt động nào');
      }
    }

    const rawClusterParam = scope.clusterId;
    const rawClusterQuery =
      (scope.query?.cluster_id as string) ||
      (scope.query?.clusterId as string) ||
      (scope.query?.cluster as string) ||
      undefined;

    // Prevent URL vs query clusterId spoofing when both are real cluster identifiers
    if (
      rawClusterParam &&
      rawClusterQuery &&
      !rawClusterParam.startsWith('org-') &&
      !rawClusterQuery.startsWith('org-') &&
      rawClusterParam !== rawClusterQuery
    ) {
      throw ApiError.forbidden('Từ chối truy cập: Tham số clusterId trên query không khớp với clusterId trên đường dẫn');
    }

    const candidateClusterId = rawClusterParam || rawClusterQuery;
    let resolvedClusterId: string | null = null;

    if (
      candidateClusterId &&
      !candidateClusterId.startsWith('org-') &&
      !candidateClusterId.startsWith('sandbox-')
    ) {
      const clusterRes = await pool.query(
        `SELECT c.id, c.name, e.organization_id
         FROM clusters c
         LEFT JOIN environments e ON c.environment_id = e.id
         WHERE (c.id::text = $1 OR c.name = $1) AND c.deleted_at IS NULL
         ORDER BY (c.id::text = $1) DESC
         LIMIT 1`,
        [candidateClusterId]
      );
      const clusterRow = clusterRes.rows[0];
      if (!clusterRow) {
        throw ApiError.notFound('Không tìm thấy cụm Kubernetes yêu cầu');
      }
      const clusterOrgId = clusterRow.organization_id;
      if (requestedOrgId && clusterOrgId && clusterOrgId !== requestedOrgId) {
        throw ApiError.forbidden('Từ chối truy cập: Cụm Kubernetes không thuộc tổ chức được yêu cầu');
      }
      if (!isPlatformAdmin && clusterOrgId && !allowedOrgIds.includes(clusterOrgId)) {
        throw ApiError.forbidden('Từ chối truy cập: Bạn không có quyền truy cập cụm Kubernetes của tổ chức khác');
      }
      resolvedClusterId = clusterRow.id;
    }

    return {
      isPlatformAdmin,
      effectiveOrgId: requestedOrgId,
      allowedOrgIds,
      clusterId: resolvedClusterId,
    };
  }

  public static async getNodesStatus(scope: StatusRequestScope) {
    await this.ensureStatusColumns();
    const pagination = parsePagination(scope.query || {});
    const resolved = await this.resolveScope(scope);
    const statusFilter = scope.query?.status ? String(scope.query.status).trim() : undefined;

    const params: any[] = [];
    let sql = `
      SELECT
        n.id,
        n.cluster_id,
        c.name AS cluster_name,
        c.status AS cluster_status,
        c.provider AS cluster_provider,
        ag.status AS agent_status,
        n.name,
        n.kubernetes_uid,
        n.status,
        n.cpu_capacity_millicores,
        n.memory_capacity_bytes,
        n.disk_capacity_bytes,
        n.kubelet_version,
        n.roles,
        n.labels,
        n.conditions,
        n.allocatable,
        n.observed_at,
        n.created_at,
        n.updated_at,
        COUNT(p.id)::int AS pods_count
      FROM nodes n
      JOIN clusters c ON n.cluster_id = c.id
      LEFT JOIN environments e ON c.environment_id = e.id
      LEFT JOIN LATERAL (
        SELECT a.status
        FROM agents a
        WHERE a.cluster_id = c.id
        ORDER BY (a.status = 'ONLINE') DESC, a.last_seen_at DESC NULLS LAST, a.updated_at DESC
        LIMIT 1
      ) ag ON TRUE
      LEFT JOIN pods p ON p.node_id = n.id AND p.deleted_at IS NULL
      WHERE c.deleted_at IS NULL
    `;

    if (resolved.effectiveOrgId) {
      params.push(resolved.effectiveOrgId);
      sql += ` AND e.organization_id = $${params.length}`;
    } else if (!resolved.isPlatformAdmin) {
      params.push(resolved.allowedOrgIds);
      sql += ` AND e.organization_id = ANY($${params.length}::uuid[])`;
    }

    if (resolved.clusterId) {
      params.push(resolved.clusterId);
      sql += ` AND c.id = $${params.length}`;
    }

    if (statusFilter && statusFilter !== 'ALL') {
      params.push(statusFilter);
      sql += ` AND LOWER(n.status) = LOWER($${params.length})`;
    }

    sql += ` GROUP BY n.id, c.name, c.status, c.provider, ag.status ORDER BY c.name ASC, n.name ASC`;

    if (pagination.limit !== null) {
      params.push(pagination.limit, pagination.offset);
      sql += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;
    }

    const res = await pool.query(sql, params);
    const now = Date.now();
    return res.rows.map((r) => normalizeNodeStatus(r, now));
  }

  public static async getNodeStatusById(scope: StatusRequestScope, nodeId: string) {
    await this.ensureStatusColumns();
    if (!nodeId || !String(nodeId).trim()) {
      throw ApiError.badRequest('Mã Node không hợp lệ');
    }
    const resolved = await this.resolveScope(scope);

    const nodeRes = await pool.query(
      `SELECT
         n.id,
         n.cluster_id,
         c.name AS cluster_name,
         c.status AS cluster_status,
         c.provider AS cluster_provider,
         e.organization_id,
         ag.status AS agent_status,
         n.name,
         n.kubernetes_uid,
         n.status,
         n.cpu_capacity_millicores,
         n.memory_capacity_bytes,
         n.disk_capacity_bytes,
         n.kubelet_version,
         n.roles,
         n.labels,
         n.conditions,
         n.allocatable,
         n.observed_at,
         n.created_at,
         n.updated_at
       FROM nodes n
       JOIN clusters c ON n.cluster_id = c.id
       LEFT JOIN environments e ON c.environment_id = e.id
       LEFT JOIN LATERAL (
         SELECT a.status
         FROM agents a
         WHERE a.cluster_id = c.id
         ORDER BY (a.status = 'ONLINE') DESC, a.last_seen_at DESC NULLS LAST, a.updated_at DESC
         LIMIT 1
       ) ag ON TRUE
       WHERE (n.id::text = $1 OR n.name = $1 OR n.kubernetes_uid = $1)
         AND c.deleted_at IS NULL`,
      [nodeId]
    );

    if (nodeRes.rows.length === 0) {
      throw ApiError.notFound('Không tìm thấy Node máy chủ');
    }

    const matchingRow = nodeRes.rows.find((row) => {
      if (resolved.clusterId && row.cluster_id !== resolved.clusterId) return false;
      if (resolved.effectiveOrgId && row.organization_id !== resolved.effectiveOrgId) return false;
      if (!resolved.isPlatformAdmin && !resolved.allowedOrgIds.includes(row.organization_id)) return false;
      return true;
    });

    if (!matchingRow) {
      throw ApiError.forbidden('Từ chối truy cập: Node không thuộc phạm vi tổ chức hoặc cụm máy chủ của bạn');
    }

    const podsRes = await pool.query(
      `SELECT
         p.id,
         p.cluster_id,
         p.workload_id,
         p.name,
         p.kubernetes_uid,
         p.status,
         p.phase,
         p.restart_count,
         p.image,
         p.labels,
         p.containers,
         p.started_at,
         p.observed_at,
         p.created_at,
         p.updated_at,
         COALESCE(ns.name, 'default') AS namespace
       FROM pods p
       LEFT JOIN namespaces ns ON p.namespace_id = ns.id
       WHERE p.node_id = $1 AND p.deleted_at IS NULL
       ORDER BY p.name ASC`,
      [matchingRow.id]
    );

    const now = Date.now();
    const pods = podsRes.rows.map((p) =>
      normalizePodStatus(
        {
          ...p,
          cluster_name: matchingRow.cluster_name,
          cluster_status: matchingRow.cluster_status,
          agent_status: matchingRow.agent_status,
          node_name: matchingRow.name,
        },
        now
      )
    );

    const normalizedNode = normalizeNodeStatus(
      { ...matchingRow, pods_count: pods.length },
      now
    );

    return {
      ...normalizedNode,
      pods_count: pods.length,
      pods,
    };
  }

  public static async getPodsStatus(scope: StatusRequestScope) {
    await this.ensureStatusColumns();
    const pagination = parsePagination(scope.query || {});
    const resolved = await this.resolveScope(scope);
    const namespace = scope.query?.namespace ? String(scope.query.namespace).trim() : undefined;
    const statusFilter = scope.query?.status ? String(scope.query.status).trim() : undefined;
    const phaseFilter = scope.query?.phase ? String(scope.query.phase).trim() : undefined;

    const params: any[] = [];
    let sql = `
      SELECT
        p.id,
        p.cluster_id,
        c.name AS cluster_name,
        c.status AS cluster_status,
        ag.status AS agent_status,
        p.workload_id,
        p.name,
        p.kubernetes_uid,
        p.status,
        p.phase,
        p.restart_count,
        p.image,
        p.labels,
        p.containers,
        p.started_at,
        p.observed_at,
        p.created_at,
        p.updated_at,
        COALESCE(ns.name, 'default') AS namespace,
        COALESCE(n.name, 'unassigned') AS node_name
      FROM pods p
      JOIN clusters c ON p.cluster_id = c.id
      LEFT JOIN environments e ON c.environment_id = e.id
      LEFT JOIN namespaces ns ON p.namespace_id = ns.id
      LEFT JOIN nodes n ON p.node_id = n.id
      LEFT JOIN LATERAL (
        SELECT a.status
        FROM agents a
        WHERE a.cluster_id = c.id
        ORDER BY (a.status = 'ONLINE') DESC, a.last_seen_at DESC NULLS LAST, a.updated_at DESC
        LIMIT 1
      ) ag ON TRUE
      WHERE p.deleted_at IS NULL AND c.deleted_at IS NULL
    `;

    if (resolved.effectiveOrgId) {
      params.push(resolved.effectiveOrgId);
      sql += ` AND e.organization_id = $${params.length}`;
    } else if (!resolved.isPlatformAdmin) {
      params.push(resolved.allowedOrgIds);
      sql += ` AND e.organization_id = ANY($${params.length}::uuid[])`;
    }

    if (resolved.clusterId) {
      params.push(resolved.clusterId);
      sql += ` AND c.id = $${params.length}`;
    }

    if (namespace && namespace !== 'ALL') {
      params.push(namespace);
      sql += ` AND ns.name = $${params.length}`;
    }

    if (phaseFilter && phaseFilter !== 'ALL') {
      params.push(phaseFilter);
      sql += ` AND LOWER(p.phase) = LOWER($${params.length})`;
    }

    if (statusFilter && statusFilter !== 'ALL') {
      params.push(statusFilter);
      sql += ` AND LOWER(p.status) = LOWER($${params.length})`;
    }

    sql += ` ORDER BY c.name ASC, ns.name ASC, p.name ASC`;

    if (pagination.limit !== null) {
      params.push(pagination.limit, pagination.offset);
      sql += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;
    }

    const res = await pool.query(sql, params);
    const now = Date.now();
    let items = res.rows.map((r) => normalizePodStatus(r, now));
    const crashLoopOnly =
      scope.query?.crashLoopOnly === 'true' ||
      scope.query?.crashLoopOnly === true ||
      scope.query?.crash_loop_only === 'true';
    if (crashLoopOnly) {
      items = items.filter((p) => p.has_crash_loop);
    }
    return items;
  }

  public static async getPodStatusById(scope: StatusRequestScope, podId: string) {
    await this.ensureStatusColumns();
    if (!podId || !String(podId).trim()) {
      throw ApiError.badRequest('Mã Pod không hợp lệ');
    }
    const resolved = await this.resolveScope(scope);

    const podRes = await pool.query(
      `SELECT
         p.id,
         p.cluster_id,
         c.name AS cluster_name,
         c.status AS cluster_status,
         e.organization_id,
         ag.status AS agent_status,
         p.workload_id,
         p.name,
         p.kubernetes_uid,
         p.status,
         p.phase,
         p.restart_count,
         p.image,
         p.labels,
         p.containers,
         p.started_at,
         p.observed_at,
         p.created_at,
         p.updated_at,
         COALESCE(ns.name, 'default') AS namespace,
         COALESCE(n.name, 'unassigned') AS node_name
       FROM pods p
       JOIN clusters c ON p.cluster_id = c.id
       LEFT JOIN environments e ON c.environment_id = e.id
       LEFT JOIN namespaces ns ON p.namespace_id = ns.id
       LEFT JOIN nodes n ON p.node_id = n.id
       LEFT JOIN LATERAL (
         SELECT a.status
         FROM agents a
         WHERE a.cluster_id = c.id
         ORDER BY (a.status = 'ONLINE') DESC, a.last_seen_at DESC NULLS LAST, a.updated_at DESC
         LIMIT 1
       ) ag ON TRUE
       WHERE (p.id::text = $1 OR p.name = $1 OR p.kubernetes_uid = $1)
         AND p.deleted_at IS NULL
         AND c.deleted_at IS NULL`,
      [podId]
    );

    if (podRes.rows.length === 0) {
      throw ApiError.notFound('Không tìm thấy Pod');
    }

    const matchingRow = podRes.rows.find((row) => {
      if (resolved.clusterId && row.cluster_id !== resolved.clusterId) return false;
      if (resolved.effectiveOrgId && row.organization_id !== resolved.effectiveOrgId) return false;
      if (!resolved.isPlatformAdmin && !resolved.allowedOrgIds.includes(row.organization_id)) return false;
      return true;
    });

    if (!matchingRow) {
      throw ApiError.forbidden('Từ chối truy cập: Pod không thuộc phạm vi tổ chức hoặc cụm máy chủ của bạn');
    }

    return normalizePodStatus(matchingRow, Date.now());
  }

  public static async getDeploymentsStatus(scope: StatusRequestScope) {
    await this.ensureStatusColumns();
    const pagination = parsePagination(scope.query || {});
    const resolved = await this.resolveScope(scope);
    const namespace = scope.query?.namespace ? String(scope.query.namespace).trim() : undefined;
    const statusFilter = scope.query?.status ? String(scope.query.status).trim() : undefined;

    const params: any[] = [];
    let sql = `
      SELECT DISTINCT ON (c.name, COALESCE(ns.name, 'default'), w.name)
        w.id,
        w.cluster_id,
        c.name AS cluster_name,
        c.status AS cluster_status,
        ag.status AS agent_status,
        w.name,
        w.kubernetes_uid,
        w.workload_type,
        w.status AS db_status,
        w.rollout_status,
        w.desired_replicas,
        w.ready_replicas,
        w.available_replicas,
        w.updated_replicas,
        w.unavailable_replicas,
        w.generation,
        w.observed_generation,
        w.conditions,
        w.labels,
        w.observed_at,
        w.created_at,
        w.updated_at,
        COALESCE(ns.name, 'default') AS namespace
      FROM workloads w
      JOIN clusters c ON w.cluster_id::text = c.id::text
      LEFT JOIN environments e ON c.environment_id = e.id
      LEFT JOIN namespaces ns ON w.namespace_id::text = ns.id::text
      LEFT JOIN LATERAL (
        SELECT a.status
        FROM agents a
        WHERE a.cluster_id = c.id
        ORDER BY (a.status = 'ONLINE') DESC, a.last_seen_at DESC NULLS LAST, a.updated_at DESC
        LIMIT 1
      ) ag ON TRUE
      WHERE w.deleted_at IS NULL
        AND c.deleted_at IS NULL
        AND COALESCE(w.workload_type, 'Deployment') IN ('Deployment', 'StatefulSet')
    `;

    if (resolved.effectiveOrgId) {
      params.push(resolved.effectiveOrgId);
      sql += ` AND e.organization_id = $${params.length}`;
    } else if (!resolved.isPlatformAdmin) {
      params.push(resolved.allowedOrgIds);
      sql += ` AND e.organization_id = ANY($${params.length}::uuid[])`;
    }

    if (resolved.clusterId) {
      params.push(resolved.clusterId);
      sql += ` AND c.id = $${params.length}`;
    }

    if (namespace && namespace !== 'ALL') {
      params.push(namespace);
      sql += ` AND ns.name = $${params.length}`;
    }

    sql += ` ORDER BY c.name ASC, COALESCE(ns.name, 'default') ASC, w.name ASC, w.updated_at DESC NULLS LAST`;

    if (pagination.limit !== null) {
      params.push(pagination.limit, pagination.offset);
      sql += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;
    }

    const res = await pool.query(sql, params);
    const now = Date.now();
    const items = res.rows.map((r) => normalizeDeploymentStatus(r, now));
    if (statusFilter && statusFilter !== 'ALL') {
      return items.filter(
        (d) =>
          d.status.toLowerCase() === statusFilter.toLowerCase() ||
          d.effective_status.toLowerCase() === statusFilter.toLowerCase()
      );
    }
    return items;
  }

  public static async getDeploymentStatusById(scope: StatusRequestScope, deploymentId: string) {
    await this.ensureStatusColumns();
    if (!deploymentId || !String(deploymentId).trim()) {
      throw ApiError.badRequest('Mã Deployment không hợp lệ');
    }
    const resolved = await this.resolveScope(scope);
    const namespace = scope.query?.namespace ? String(scope.query.namespace).trim() : undefined;

    const depRes = await pool.query(
      `SELECT
         w.id,
         w.cluster_id,
         c.name AS cluster_name,
         c.status AS cluster_status,
         e.organization_id,
         ag.status AS agent_status,
         w.name,
         w.kubernetes_uid,
         w.workload_type,
         w.status AS db_status,
         w.rollout_status,
         w.desired_replicas,
         w.ready_replicas,
         w.available_replicas,
         w.updated_replicas,
         w.unavailable_replicas,
         w.generation,
         w.observed_generation,
         w.conditions,
         w.labels,
         w.observed_at,
         w.created_at,
         w.updated_at,
         COALESCE(ns.name, 'default') AS namespace
       FROM workloads w
       JOIN clusters c ON w.cluster_id::text = c.id::text
       LEFT JOIN environments e ON c.environment_id = e.id
       LEFT JOIN namespaces ns ON w.namespace_id::text = ns.id::text
       LEFT JOIN LATERAL (
         SELECT a.status
         FROM agents a
         WHERE a.cluster_id = c.id
         ORDER BY (a.status = 'ONLINE') DESC, a.last_seen_at DESC NULLS LAST, a.updated_at DESC
         LIMIT 1
       ) ag ON TRUE
       WHERE (w.id::text = $1 OR w.name = $1 OR w.kubernetes_uid = $1)
         AND w.deleted_at IS NULL
         AND c.deleted_at IS NULL`,
      [deploymentId]
    );

    if (depRes.rows.length === 0) {
      throw ApiError.notFound('Không tìm thấy Deployment');
    }

    const matchingRow = depRes.rows.find((row) => {
      if (resolved.clusterId && row.cluster_id !== resolved.clusterId) return false;
      if (resolved.effectiveOrgId && row.organization_id !== resolved.effectiveOrgId) return false;
      if (!resolved.isPlatformAdmin && !resolved.allowedOrgIds.includes(row.organization_id)) return false;
      if (namespace && namespace !== 'ALL' && row.namespace !== namespace) return false;
      return true;
    });

    if (!matchingRow) {
      throw ApiError.forbidden('Từ chối truy cập: Deployment không thuộc phạm vi tổ chức hoặc cụm máy chủ của bạn');
    }

    return normalizeDeploymentStatus(matchingRow, Date.now());
  }

  public static async getClusterStatusSummary(scope: StatusRequestScope) {
    const [nodes, pods, deployments] = await Promise.all([
      this.getNodesStatus(scope),
      this.getPodsStatus(scope),
      this.getDeploymentsStatus(scope),
    ]);

    return {
      cluster_id: scope.clusterId || null,
      summary: {
        nodes: {
          total: nodes.length,
          ready: nodes.filter((n) => n.effective_status === 'Ready').length,
          not_ready: nodes.filter((n) => n.effective_status === 'NotReady').length,
          unknown: nodes.filter((n) => n.effective_status === 'Unknown').length,
          unverified: nodes.filter((n) => n.effective_status === 'Unverified').length,
        },
        pods: {
          total: pods.length,
          running_healthy: pods.filter((p) => p.effective_status === 'Running' && p.is_healthy === true).length,
          pending: pods.filter((p) => p.phase === 'Pending').length,
          succeeded: pods.filter((p) => p.phase === 'Succeeded').length,
          failed: pods.filter((p) => p.phase === 'Failed').length,
          crash_loop_back_off: pods.filter((p) => p.status === 'CrashLoopBackOff').length,
          unverified: pods.filter((p) => p.effective_status === 'Unverified').length,
        },
        deployments: {
          total: deployments.length,
          healthy: deployments.filter((d) => d.effective_status === 'Healthy').length,
          scaled_to_zero: deployments.filter((d) => d.effective_status === 'ScaledToZero').length,
          progressing: deployments.filter((d) => d.effective_status === 'Progressing').length,
          degraded: deployments.filter((d) =>
            ['Degraded', 'ProgressDeadlineExceeded', 'ReplicaFailure'].includes(d.effective_status)
          ).length,
          insufficient_data: deployments.filter((d) => d.effective_status === 'InsufficientData').length,
          unverified: deployments.filter((d) => d.effective_status === 'Unverified').length,
        },
      },
      nodes,
      pods,
      deployments,
    };
  }
}
