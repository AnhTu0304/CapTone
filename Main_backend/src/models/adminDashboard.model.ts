import { pool } from '../config/database';

export interface IAdminKpiStats {
  companies: {
    total: number;
    active: number;
    incident: number;
    diff: string;
    status: 'positive' | 'neutral' | 'negative' | 'critical';
    label: string;
  };
  users: {
    total: number;
    active: number;
    locked: number;
    pending: number;
    diff: string;
    status: 'positive' | 'neutral' | 'negative' | 'critical';
    label: string;
  };
  agents: {
    total: number;
    online: number;
    offline: number;
    pending: number;
    revoked: number;
    diff: string;
    status: 'positive' | 'neutral' | 'negative' | 'critical';
    label: string;
  };
  clusters: {
    total: number;
    healthy: number;
    degraded: number;
    diff: string;
    status: 'positive' | 'neutral' | 'negative' | 'critical';
    label: string;
  };
  uptime: {
    value: string;
    diff: string;
    status: 'positive' | 'neutral' | 'negative' | 'critical';
    label: string;
  };
  selfHealingRate: {
    value: string;
    diff: string;
    status: 'positive' | 'neutral' | 'negative' | 'critical';
    label: string;
  };
  activeIncidents: {
    value: string;
    diff: string;
    status: 'positive' | 'neutral' | 'negative' | 'critical';
    label: string;
  };
  managedResources: {
    value: string;
    diff: string;
    status: 'positive' | 'neutral' | 'negative' | 'critical';
    label: string;
  };
}

export interface IRawKpiData {
  u: any;
  a: any;
  c: any;
  n: any;
  p: any;
  o: any;
  inc: any;
  heal: any;
}

export class AdminDashboardModel {
  /**
   * Truy vấn cơ sở dữ liệu thô (Raw Data Access) cho các chỉ số KPI nền tảng
   */
  public static async getRawKpiData(): Promise<IRawKpiData> {
    const usersQuery = `
      SELECT 
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'ACTIVE')::int AS active,
        COUNT(*) FILTER (WHERE status IN ('INACTIVE', 'SUSPENDED'))::int AS locked,
        COUNT(*) FILTER (WHERE status = 'PENDING')::int AS pending,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours')::int AS new_today,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::int AS new_week,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days')::int AS new_month
      FROM users
      WHERE deleted_at IS NULL;
    `;

    const agentsQuery = `
      SELECT 
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'ONLINE')::int AS online,
        COUNT(*) FILTER (WHERE status = 'OFFLINE')::int AS offline,
        COUNT(*) FILTER (WHERE status = 'PENDING')::int AS pending,
        COUNT(*) FILTER (WHERE status = 'REVOKED')::int AS revoked
      FROM agents;
    `;

    const clustersQuery = `
      SELECT 
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE UPPER(COALESCE(status, '')) IN ('READY', 'ONLINE', 'HEALTHY', 'ACTIVE'))::int AS healthy,
        COUNT(*) FILTER (WHERE UPPER(COALESCE(status, '')) NOT IN ('READY', 'ONLINE', 'HEALTHY', 'ACTIVE'))::int AS degraded
      FROM clusters
      WHERE deleted_at IS NULL;
    `;

    const nodesQuery = `
      SELECT 
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE UPPER(COALESCE(status, '')) = 'READY')::int AS ready
      FROM nodes;
    `;

    const podsQuery = `
      SELECT 
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE UPPER(COALESCE(status, '')) = 'RUNNING' OR UPPER(COALESCE(phase, '')) = 'RUNNING')::int AS running
      FROM pods
      WHERE deleted_at IS NULL;
    `;

    const orgsQuery = `
      SELECT 
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'ACTIVE')::int AS active,
        COUNT(*) FILTER (WHERE status IN ('INACTIVE', 'SUSPENDED'))::int AS suspended,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days')::int AS new_month
      FROM organizations
      WHERE deleted_at IS NULL;
    `;

    const incidentsQuery = `
      SELECT 
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status NOT IN ('RESOLVED', 'FAILED', 'IGNORED'))::int AS active,
        COUNT(*) FILTER (WHERE status NOT IN ('RESOLVED', 'FAILED', 'IGNORED') AND severity = 'CRITICAL')::int AS critical
      FROM incidents;
    `;

    const healingQuery = `
      SELECT 
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE execution_status = 'SUCCEEDED')::int AS succeeded
      FROM healing_actions;
    `;

    const [
      usersRes,
      agentsRes,
      clustersRes,
      nodesRes,
      podsRes,
      orgsRes,
      incidentsRes,
      healingRes,
    ] = await Promise.allSettled([
      pool.query(usersQuery),
      pool.query(agentsQuery),
      pool.query(clustersQuery),
      pool.query(nodesQuery),
      pool.query(podsQuery),
      pool.query(orgsQuery),
      pool.query(incidentsQuery),
      pool.query(healingQuery),
    ]);

    return {
      u: usersRes.status === 'fulfilled' ? usersRes.value.rows[0] : {},
      a: agentsRes.status === 'fulfilled' ? agentsRes.value.rows[0] : {},
      c: clustersRes.status === 'fulfilled' ? clustersRes.value.rows[0] : {},
      n: nodesRes.status === 'fulfilled' ? nodesRes.value.rows[0] : {},
      p: podsRes.status === 'fulfilled' ? podsRes.value.rows[0] : {},
      o: orgsRes.status === 'fulfilled' ? orgsRes.value.rows[0] : {},
      inc: incidentsRes.status === 'fulfilled' ? incidentsRes.value.rows[0] : {},
      heal: healingRes.status === 'fulfilled' ? healingRes.value.rows[0] : {},
    };
  }

  /**
   * Truy vấn số liệu thống kê sự cố và tác tử thô từ database
   */
  public static async getAlertsStats(): Promise<any> {
    const query = `
      SELECT 
        (SELECT count(*)::int FROM incidents) as total_incidents,
        (SELECT count(*)::int FROM incidents WHERE severity = 'CRITICAL' AND status NOT IN ('RESOLVED', 'IGNORED')) as critical_incidents,
        (SELECT count(*)::int FROM incidents WHERE status IN ('OPEN', 'INVESTIGATING')) as open_incidents,
        (SELECT count(*)::int FROM incidents WHERE status = 'RESOLVED') as resolved_incidents,
        (SELECT count(*)::int FROM agents) as total_agents,
        (SELECT count(*)::int FROM agents WHERE status = 'ONLINE') as online_agents,
        (SELECT count(*)::int FROM agents WHERE status = 'OFFLINE') as offline_agents,
        (SELECT count(*)::int FROM agents WHERE status = 'PENDING') as pending_agents,
        (SELECT count(*)::int FROM healing_actions) as total_healing_actions,
        (SELECT count(*)::int FROM healing_actions WHERE execution_status = 'SUCCEEDED') as succeeded_healing_actions,
        (SELECT count(*)::int FROM clusters WHERE deleted_at IS NULL) as total_clusters,
        (SELECT count(*)::int FROM organizations WHERE deleted_at IS NULL) as total_organizations,
        (SELECT COALESCE(ROUND(AVG(EXTRACT(EPOCH FROM (COALESCE(resolved_at, created_at) - detected_at)))::numeric, 0), 45) 
         FROM incidents WHERE status = 'RESOLVED' AND detected_at IS NOT NULL) as avg_mttr_seconds;
    `;
    const res = await pool.query(query);
    return res.rows[0] || {};
  }

  /**
   * Truy vấn danh sách các cụm có tác tử bị Offline
   */
  public static async getClustersWithOfflineAgents(): Promise<any[]> {
    const query = `
      SELECT 
        COALESCE(c.id::text, a.cluster_id::text, 'unknown') as cluster_id,
        COALESCE(c.name, 'Cụm k8s chưa gán') as cluster_name,
        count(*)::int as total_agents,
        count(*) FILTER (WHERE a.status = 'OFFLINE')::int as offline_agents,
        count(*) FILTER (WHERE a.status = 'ONLINE')::int as online_agents,
        MAX(a.last_seen_at) as last_seen_at
      FROM agents a
      LEFT JOIN clusters c ON c.id = a.cluster_id
      GROUP BY c.id, c.name, a.cluster_id
      HAVING count(*) FILTER (WHERE a.status = 'OFFLINE') > 0
      ORDER BY offline_agents DESC;
    `;
    const res = await pool.query(query);
    return res.rows || [];
  }

  /**
   * Truy vấn danh sách tác tử bị Offline gần đây
   */
  public static async getOfflineAgents(limit: number = 10): Promise<any[]> {
    const query = `
      SELECT 
        a.id,
        a.name,
        a.agent_uid,
        a.status,
        a.version,
        a.last_seen_at,
        COALESCE(c.name, 'minikube') as cluster_name
      FROM agents a
      LEFT JOIN clusters c ON c.id = a.cluster_id
      WHERE a.status = 'OFFLINE'
      ORDER BY a.last_seen_at DESC NULLS LAST
      LIMIT $1;
    `;
    const res = await pool.query(query, [limit]);
    return res.rows || [];
  }

  /**
   * Truy vấn các sự cố Critical gần đây chưa giải quyết
   */
  public static async getRecentCriticalIncidents(limit: number = 5): Promise<any[]> {
    const query = `
      SELECT 
        i.id,
        i.title,
        i.incident_type,
        i.severity,
        i.status,
        i.detected_at,
        COALESCE(o.name, 'Tổ chức chung') as organization_name,
        COALESCE(c.name, 'Cụm k8s') as cluster_name
      FROM incidents i
      LEFT JOIN organizations o ON o.id = i.organization_id
      LEFT JOIN clusters c ON (c.id::text = i.cluster_id OR c.name = i.cluster_id)
      WHERE i.severity = 'CRITICAL' AND i.status NOT IN ('RESOLVED', 'IGNORED')
      ORDER BY i.detected_at DESC
      LIMIT $1;
    `;
    const res = await pool.query(query, [limit]);
    return res.rows || [];
  }

  /**
   * Truy vấn danh sách các tổ chức đang hoạt động
   */
  public static async getActiveOrganizations(): Promise<any[]> {
    const query = `
      SELECT id, name, slug, status 
      FROM organizations 
      WHERE deleted_at IS NULL 
      ORDER BY name ASC;
    `;
    const res = await pool.query(query);
    return res.rows || [];
  }
}
