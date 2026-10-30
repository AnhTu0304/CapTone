import { pool } from '../config/database';
import { redisClient, isRedisReady } from '../config/redis';
import { ApiError } from '../utils/apiError';
import { OverviewStatisticsQuery } from '../validations/statistics.validation';

export interface IOverviewStatsResponse {
  time_range: string;
  scope: {
    type: 'PLATFORM' | 'TENANT';
    organization_id?: string;
    cluster_id?: string;
  };
  summary: {
    total_organizations: number;
    active_organizations: number;
    total_clusters: number;
    connected_clusters: number;
    total_agents: number;
    online_agents: number;
  };
  incidents: {
    total: number;
    active: number;
    resolved: number;
    failed: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    mttr_minutes: number;
  };
  remediations: {
    total: number;
    succeeded: number;
    failed: number;
    in_progress: number;
    success_rate: number;
  };
  resource_usage: {
    avg_cpu_percent: number;
    peak_cpu_percent: number;
    avg_ram_percent: number;
    peak_ram_percent: number;
    sample_count: number;
  };
  recent_activities: Array<{
    id: string;
    action: string;
    resource: string;
    actor: string;
    status: string;
    created_at: string;
  }>;
  cached?: boolean;
}

const INTERVAL_MAP: Record<string, string> = {
  '15m': "INTERVAL '15 minutes'",
  '1h': "INTERVAL '1 hour'",
  '6h': "INTERVAL '6 hours'",
  '24h': "INTERVAL '24 hours'",
  '7d': "INTERVAL '7 days'",
  '30d': "INTERVAL '30 days'",
};

export class StatisticsService {
  /**
   * Tính toán và tổng hợp dữ liệu thống kê Dashboard tổng quan
   */
  public static async getOverviewStats(
    currentUser: any,
    query: OverviewStatisticsQuery
  ): Promise<IOverviewStatsResponse> {
    const timeRange = query.time_range || '24h';
    const intervalSql = INTERVAL_MAP[timeRange] || "INTERVAL '24 hours'";
    const requestedOrgId = query.organization_id;
    const requestedClusterId = query.cluster_id;

    // 1. Phân định thẩm quyền RBAC & Phạm vi truy cập (Scope)
    const isSuperAdmin =
      currentUser?.roles?.includes('SUPER_ADMIN') ||
      currentUser?.systemRoles?.includes('SUPER_ADMIN') ||
      currentUser?.role === 'SUPER_ADMIN';

    const isAdmin =
      isSuperAdmin ||
      currentUser?.roles?.includes('ADMIN') ||
      currentUser?.systemRoles?.includes('ADMIN') ||
      currentUser?.systemRoles?.includes('SYSTEM_ADMIN');

    let effectiveScopeType: 'PLATFORM' | 'TENANT' = 'PLATFORM';
    let targetOrgIds: string[] = [];

    if (isAdmin) {
      if (requestedOrgId) {
        effectiveScopeType = 'TENANT';
        targetOrgIds = [requestedOrgId];
      } else {
        effectiveScopeType = 'PLATFORM';
      }
    } else {
      // Người dùng cấp Tenant (SME_OWNER, DEVOPS, VIEWER, USER)
      effectiveScopeType = 'TENANT';
      const userMemberships = await pool.query(
        `SELECT organization_id FROM organization_members 
         WHERE user_id = $1 AND status = 'ACTIVE'`,
        [currentUser.id || currentUser.userId]
      );
      const allowedOrgIds = userMemberships.rows.map((r: any) => r.organization_id);

      if (allowedOrgIds.length === 0) {
        return this.getEmptyStatsResponse(timeRange, effectiveScopeType, requestedOrgId, requestedClusterId);
      }

      if (requestedOrgId) {
        if (!allowedOrgIds.includes(requestedOrgId)) {
          throw new ApiError(403, 'Bạn không có quyền truy cập dữ liệu thống kê của tổ chức này');
        }
        targetOrgIds = [requestedOrgId];
      } else {
        targetOrgIds = allowedOrgIds;
      }
    }

    // 2. Kiểm tra Cache Redis (TTL: 15s)
    const scopeKey = effectiveScopeType === 'PLATFORM' ? 'platform' : targetOrgIds.sort().join(',');
    const cacheKey = `stats:overview:${scopeKey}:${requestedClusterId || 'all'}:${timeRange}`;

    if (isRedisReady()) {
      try {
        const cachedData = await redisClient.get(cacheKey);
        if (cachedData) {
          const parsed = JSON.parse(cachedData);
          parsed.cached = true;
          return parsed;
        }
      } catch (e) {
        // Fallback trực tiếp qua PostgreSQL nếu Redis không sẵn sàng
      }
    }

    // 3. Chuẩn bị mệnh đề lọc SQL an toàn
    const hasOrgFilter = targetOrgIds.length > 0;
    const orgPlaceholders = hasOrgFilter
      ? targetOrgIds.map((_, i) => `$${i + 1}`).join(', ')
      : '';

    // A. Query Core KPIs: Organizations, Clusters, Agents
    let kpiQuery: string;
    let kpiParams: any[] = [];

    if (effectiveScopeType === 'PLATFORM') {
      kpiQuery = `
        SELECT
          (SELECT COUNT(*) FROM organizations WHERE deleted_at IS NULL)::int AS total_orgs,
          (SELECT COUNT(*) FROM organizations WHERE status = 'ACTIVE' AND deleted_at IS NULL)::int AS active_orgs,
          (SELECT COUNT(*) FROM clusters WHERE deleted_at IS NULL)::int AS total_clusters,
          (SELECT COUNT(*) FROM clusters WHERE status = 'CONNECTED' AND deleted_at IS NULL)::int AS connected_clusters,
          (SELECT COUNT(*) FROM agents WHERE revoked_at IS NULL)::int AS total_agents,
          (SELECT COUNT(*) FROM agents WHERE status = 'ONLINE' AND revoked_at IS NULL)::int AS online_agents
      `;
    } else {
      kpiQuery = `
        SELECT
          ${targetOrgIds.length}::int AS total_orgs,
          (SELECT COUNT(*) FROM organizations WHERE id IN (${orgPlaceholders}) AND status = 'ACTIVE' AND deleted_at IS NULL)::int AS active_orgs,
          (SELECT COUNT(*) FROM clusters c JOIN environments e ON c.environment_id = e.id WHERE e.organization_id IN (${orgPlaceholders}) AND c.deleted_at IS NULL)::int AS total_clusters,
          (SELECT COUNT(*) FROM clusters c JOIN environments e ON c.environment_id = e.id WHERE e.organization_id IN (${orgPlaceholders}) AND c.status = 'CONNECTED' AND c.deleted_at IS NULL)::int AS connected_clusters,
          (SELECT COUNT(*) FROM agents a JOIN environments e ON a.environment_id = e.id WHERE e.organization_id IN (${orgPlaceholders}) AND a.revoked_at IS NULL)::int AS total_agents,
          (SELECT COUNT(*) FROM agents a JOIN environments e ON a.environment_id = e.id WHERE e.organization_id IN (${orgPlaceholders}) AND a.status = 'ONLINE' AND a.revoked_at IS NULL)::int AS online_agents
      `;
      kpiParams = [...targetOrgIds];
    }

    // B. Query Incidents Breakdown
    let incConds = [`created_at >= NOW() - ${intervalSql}`];
    let incParams: any[] = [];
    let pIdx = 1;

    if (hasOrgFilter) {
      const incOrgs = targetOrgIds.map(() => `$${pIdx++}`).join(', ');
      incConds.push(`organization_id IN (${incOrgs})`);
      incParams.push(...targetOrgIds);
    }
    if (requestedClusterId) {
      incConds.push(`cluster_id = $${pIdx++}`);
      incParams.push(requestedClusterId);
    }

    const incQuery = `
      SELECT
        COUNT(*)::int AS total,
        COUNT(CASE WHEN status IN ('OPEN', 'INVESTIGATING', 'MITIGATING') THEN 1 END)::int AS active,
        COUNT(CASE WHEN status = 'RESOLVED' THEN 1 END)::int AS resolved,
        COUNT(CASE WHEN status = 'FAILED' THEN 1 END)::int AS failed,
        COUNT(CASE WHEN severity = 'CRITICAL' THEN 1 END)::int AS critical,
        COUNT(CASE WHEN severity = 'HIGH' THEN 1 END)::int AS high,
        COUNT(CASE WHEN severity = 'MEDIUM' THEN 1 END)::int AS medium,
        COUNT(CASE WHEN severity = 'LOW' THEN 1 END)::int AS low,
        COALESCE(ROUND(AVG(CASE WHEN resolved_at IS NOT NULL THEN EXTRACT(EPOCH FROM (resolved_at - started_at))/60 END)), 0)::int AS mttr_minutes
      FROM incidents
      WHERE ${incConds.join(' AND ')}
    `;

    // C. Query Remediations / Self-healing Actions
    let remConds = [`ha.created_at >= NOW() - ${intervalSql}`];
    let remParams: any[] = [];
    pIdx = 1;

    let remFrom = 'healing_actions ha';
    if (hasOrgFilter) {
      remFrom = `
        healing_actions ha
        LEFT JOIN environments e ON ha.environment_id = e.id
        LEFT JOIN incidents i ON ha.incident_id = i.id
      `;
      const remOrgs = targetOrgIds.map(() => `$${pIdx++}`).join(', ');
      remConds.push(`(e.organization_id IN (${remOrgs}) OR i.organization_id IN (${remOrgs}))`);
      remParams.push(...targetOrgIds);
    }
    if (requestedClusterId) {
      if (!hasOrgFilter) {
        remFrom = `
          healing_actions ha
          LEFT JOIN incidents i ON ha.incident_id = i.id
        `;
      }
      remConds.push(`i.cluster_id = $${pIdx++}`);
      remParams.push(requestedClusterId);
    }

    const remQuery = `
      SELECT
        COUNT(*)::int AS total,
        COUNT(CASE WHEN ha.execution_status = 'SUCCEEDED' THEN 1 END)::int AS succeeded,
        COUNT(CASE WHEN ha.execution_status = 'FAILED' THEN 1 END)::int AS failed,
        COUNT(CASE WHEN ha.execution_status IN ('PENDING', 'QUEUED', 'RUNNING') THEN 1 END)::int AS in_progress,
        CASE 
          WHEN COUNT(*) > 0 THEN ROUND((COUNT(CASE WHEN ha.execution_status = 'SUCCEEDED' THEN 1 END)::numeric / COUNT(*)::numeric) * 100, 1)
          ELSE 100.0
        END AS success_rate
      FROM ${remFrom}
      WHERE ${remConds.join(' AND ')}
    `;

    // D. Query Resource Usage Telemetry (node_metrics)
    let metConds = [`collected_at >= NOW() - ${intervalSql}`];
    let metParams: any[] = [];
    pIdx = 1;

    if (hasOrgFilter) {
      const metOrgs = targetOrgIds.map(() => `$${pIdx++}`).join(', ');
      metConds.push(`organization_id IN (${metOrgs})`);
      metParams.push(...targetOrgIds);
    }
    if (requestedClusterId) {
      metConds.push(`cluster_id = $${pIdx++}`);
      metParams.push(requestedClusterId);
    }

    const metQuery = `
      SELECT
        COALESCE(ROUND(AVG(cpu_usage_percent)::numeric, 1), 0.0) AS avg_cpu,
        COALESCE(ROUND(MAX(cpu_usage_percent)::numeric, 1), 0.0) AS max_cpu,
        COALESCE(ROUND(AVG(ram_usage_percent)::numeric, 1), 0.0) AS avg_ram,
        COALESCE(ROUND(MAX(ram_usage_percent)::numeric, 1), 0.0) AS max_ram,
        COUNT(*)::int AS sample_count
      FROM node_metrics
      WHERE ${metConds.join(' AND ')}
    `;

    // E. Query Recent Activities (Audit Logs)
    let actConds: string[] = [];
    let actParams: any[] = [];
    pIdx = 1;

    if (hasOrgFilter) {
      const actOrgs = targetOrgIds.map(() => `$${pIdx++}`).join(', ');
      actConds.push(`(al.organization_id IN (${actOrgs}) OR al.organization_id IS NULL)`);
      actParams.push(...targetOrgIds);
    }

    const actWhere = actConds.length > 0 ? `WHERE ${actConds.join(' AND ')}` : '';
    const actQuery = `
      SELECT
        al.id,
        al.action,
        COALESCE(al.resource_type, 'SYSTEM') AS resource,
        COALESCE(u.email, al.actor_type, 'system') AS actor,
        al.status,
        al.created_at
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      ${actWhere}
      ORDER BY al.created_at DESC
      LIMIT 6
    `;

    // 4. Chạy song song 5 truy vấn tổng hợp
    const [kpiRes, incRes, remRes, metRes, actRes] = await Promise.all([
      pool.query(kpiQuery, kpiParams),
      pool.query(incQuery, incParams),
      pool.query(remQuery, remParams),
      pool.query(metQuery, metParams),
      pool.query(actQuery, actParams),
    ]);

    const kpi = kpiRes.rows[0] || {};
    const inc = incRes.rows[0] || {};
    const rem = remRes.rows[0] || {};
    const met = metRes.rows[0] || {};

    const response: IOverviewStatsResponse = {
      time_range: timeRange,
      scope: {
        type: effectiveScopeType,
        organization_id: targetOrgIds.length === 1 ? targetOrgIds[0] : undefined,
        cluster_id: requestedClusterId,
      },
      summary: {
        total_organizations: Number(kpi.total_orgs || 0),
        active_organizations: Number(kpi.active_orgs || 0),
        total_clusters: Number(kpi.total_clusters || 0),
        connected_clusters: Number(kpi.connected_clusters || 0),
        total_agents: Number(kpi.total_agents || 0),
        online_agents: Number(kpi.online_agents || 0),
      },
      incidents: {
        total: Number(inc.total || 0),
        active: Number(inc.active || 0),
        resolved: Number(inc.resolved || 0),
        failed: Number(inc.failed || 0),
        critical: Number(inc.critical || 0),
        high: Number(inc.high || 0),
        medium: Number(inc.medium || 0),
        low: Number(inc.low || 0),
        mttr_minutes: Number(inc.mttr_minutes || 0),
      },
      remediations: {
        total: Number(rem.total || 0),
        succeeded: Number(rem.succeeded || 0),
        failed: Number(rem.failed || 0),
        in_progress: Number(rem.in_progress || 0),
        success_rate: Number(rem.success_rate != null ? rem.success_rate : 100),
      },
      resource_usage: {
        avg_cpu_percent: Number(met.avg_cpu || 0),
        peak_cpu_percent: Number(met.max_cpu || 0),
        avg_ram_percent: Number(met.avg_ram || 0),
        peak_ram_percent: Number(met.max_ram || 0),
        sample_count: Number(met.sample_count || 0),
      },
      recent_activities: actRes.rows.map((row: any) => ({
        id: row.id,
        action: row.action,
        resource: row.resource,
        actor: row.actor,
        status: row.status,
        created_at: row.created_at ? new Date(row.created_at).toISOString() : '',
      })),
    };

    // 5. Lưu kết quả vào Cache Redis với TTL 15s
    if (isRedisReady()) {
      try {
        await redisClient.setex(cacheKey, 15, JSON.stringify(response));
      } catch (e) {
        // Bỏ qua lỗi ghi cache
      }
    }

    return response;
  }

  private static getEmptyStatsResponse(
    timeRange: string,
    scopeType: 'PLATFORM' | 'TENANT',
    orgId?: string,
    clusterId?: string
  ): IOverviewStatsResponse {
    return {
      time_range: timeRange,
      scope: {
        type: scopeType,
        organization_id: orgId,
        cluster_id: clusterId,
      },
      summary: {
        total_organizations: 0,
        active_organizations: 0,
        total_clusters: 0,
        connected_clusters: 0,
        total_agents: 0,
        online_agents: 0,
      },
      incidents: {
        total: 0,
        active: 0,
        resolved: 0,
        failed: 0,
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        mttr_minutes: 0,
      },
      remediations: {
        total: 0,
        succeeded: 0,
        failed: 0,
        in_progress: 0,
        success_rate: 100,
      },
      resource_usage: {
        avg_cpu_percent: 0,
        peak_cpu_percent: 0,
        avg_ram_percent: 0,
        peak_ram_percent: 0,
        sample_count: 0,
      },
      recent_activities: [],
    };
  }
}
