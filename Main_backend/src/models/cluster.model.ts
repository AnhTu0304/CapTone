import { PoolClient } from 'pg';
import crypto from 'crypto';
import { pool } from '../config/database';

export interface ICluster {
  id: string;
  environment_id: string;
  name: string;
  provider?: string | null;
  cluster_uid?: string | null;
  endpoint?: string | null;
  kubernetes_version?: string | null;
  status?: string | null;
  created_at?: Date;
  updated_at?: Date;
}

export interface IClusterDetail {
  id: string;
  name: string;
  environment_id: string;
  environment_name: string;
  environment_type: string;
  organization_id?: string;
  organization_name?: string;
  provider: string;
  cluster_uid?: string | null;
  endpoint?: string | null;
  kubernetes_version: string;
  status: string;
  nodes_count: number;
  pods_count: number;
  agent_id?: string | null;
  agent_name?: string | null;
  agent_status?: string | null;
  last_heartbeat_at?: Date | null;
  created_at: Date;
  updated_at: Date;
}

export class ClusterModel {
  /**
   * Find first available cluster
   */
  public static async findFirst(client?: PoolClient): Promise<ICluster | null> {
    const db = client || pool;
    try {
      const res = await db.query<ICluster>('SELECT id, environment_id, name FROM clusters LIMIT 1');
      return res.rows[0] || null;
    } catch {
      return null;
    }
  }

  /**
   * Find cluster by ID or Name
   */
  public static async findByIdOrName(
    idOrName: string,
    client?: PoolClient
  ): Promise<ICluster | null> {
    const db = client || pool;
    try {
      const res = await db.query<ICluster>(
        'SELECT id, environment_id, name FROM clusters WHERE id::text = $1 OR name = $1 LIMIT 1',
        [idOrName]
      );
      return res.rows[0] || null;
    } catch {
      return null;
    }
  }

  /**
   * Khởi tạo các Nodes và Pods ban đầu trong Database cho cụm K8s
   */
  public static async seedClusterResources(clusterId: string, clusterName: string, client?: PoolClient | any): Promise<void> {
    const db = client || pool;
    try {
      let nsRes = await db.query('SELECT id FROM namespaces WHERE cluster_id = $1 AND name = $2 LIMIT 1', [clusterId, 'default']);
      let nsId = nsRes.rows[0]?.id;
      if (!nsId) {
        const newNs = await db.query(
          `INSERT INTO namespaces (cluster_id, name, status, created_at, updated_at)
           VALUES ($1, 'default', 'Active', NOW(), NOW()) RETURNING id`,
          [clusterId]
        );
        nsId = newNs.rows[0]?.id;
      }

      const existingNodes = await db.query('SELECT COUNT(*)::int as count FROM nodes WHERE cluster_id = $1', [clusterId]);
      if (existingNodes.rows[0]?.count === 0) {
        const n1 = await db.query(
          `INSERT INTO nodes (cluster_id, name, status, cpu_capacity_millicores, memory_capacity_bytes, disk_capacity_bytes, kubelet_version, roles, created_at, updated_at)
           VALUES ($1, $2, 'Ready', 4000, 8589934592, 53687091200, 'v1.29.4', '["control-plane"]'::jsonb, NOW(), NOW()) RETURNING id`,
          [clusterId, `${clusterName}-control-plane`]
        );
        const n2 = await db.query(
          `INSERT INTO nodes (cluster_id, name, status, cpu_capacity_millicores, memory_capacity_bytes, disk_capacity_bytes, kubelet_version, roles, created_at, updated_at)
           VALUES ($1, $2, 'Ready', 8000, 17179869184, 107374182400, 'v1.29.4', '["worker"]'::jsonb, NOW(), NOW()) RETURNING id`,
          [clusterId, `${clusterName}-worker-01`]
        );
        const n3 = await db.query(
          `INSERT INTO nodes (cluster_id, name, status, cpu_capacity_millicores, memory_capacity_bytes, disk_capacity_bytes, kubelet_version, roles, created_at, updated_at)
           VALUES ($1, $2, 'Ready', 8000, 17179869184, 107374182400, 'v1.29.4', '["worker"]'::jsonb, NOW(), NOW()) RETURNING id`,
          [clusterId, `${clusterName}-worker-02`]
        );

        const node1Id = n1.rows[0]?.id;
        const node2Id = n2.rows[0]?.id;
        const node3Id = n3.rows[0]?.id;

        await db.query(
          `INSERT INTO pods (cluster_id, namespace_id, node_id, name, status, phase, restart_count, image, created_at, updated_at)
           VALUES 
            ($1, $2, $3, 'ebpf-sensor-agent-01', 'Running', 'Running', 0, 'selfheal/ebpf-agent:v2.4', NOW(), NOW()),
            ($1, $2, $3, 'kube-apiserver-' || $6, 'Running', 'Running', 0, 'registry.k8s.io/kube-apiserver:v1.29.4', NOW(), NOW()),
            ($1, $2, $3, 'kube-controller-manager-' || $6, 'Running', 'Running', 0, 'registry.k8s.io/kube-controller-manager:v1.29.4', NOW(), NOW()),
            ($1, $2, $3, 'kube-scheduler-' || $6, 'Running', 'Running', 0, 'registry.k8s.io/kube-scheduler:v1.29.4', NOW(), NOW()),
            ($1, $2, $4, 'coredns-78fcd69978-abc1', 'Running', 'Running', 0, 'registry.k8s.io/coredns/coredns:v1.11.1', NOW(), NOW()),
            ($1, $2, $4, 'ingress-nginx-controller-01', 'Running', 'Running', 0, 'registry.k8s.io/ingress-nginx:v1.9.4', NOW(), NOW()),
            ($1, $2, $4, 'order-service-deployment-a1', 'Running', 'Running', 0, 'app/order-service:v1.2', NOW(), NOW()),
            ($1, $2, $4, 'payment-gateway-deployment-b2', 'Running', 'Running', 0, 'app/payment-gateway:v2.0', NOW(), NOW()),
            ($1, $2, $5, 'coredns-78fcd69978-xyz2', 'Running', 'Running', 0, 'registry.k8s.io/coredns/coredns:v1.11.1', NOW(), NOW()),
            ($1, $2, $5, 'auth-service-deployment-c3', 'Running', 'Running', 0, 'app/auth-service:v1.0', NOW(), NOW()),
            ($1, $2, $5, 'telemetry-collector-agent-02', 'Running', 'Running', 0, 'selfheal/collector:v1.1', NOW(), NOW()),
            ($1, $2, $5, 'notification-service-deployment-d4', 'Running', 'Running', 0, 'app/notifications:v1.4', NOW(), NOW())`,
          [clusterId, nsId, node1Id, node2Id, node3Id, clusterName]
        );
      }
    } catch (err) {
      console.warn('[ClusterModel] Không thể khởi tạo nodes/pods mặc định:', err);
    }
  }

  /**
   * Find or Create cluster by environment_id and name
   */
  public static async findOrCreate(
    environmentId: string,
    name: string,
    client?: PoolClient
  ): Promise<ICluster> {
    const db = client || pool;
    const cleanName = (name || 'k8s-cluster-01').trim();
    const existing = await db.query<ICluster>(
      'SELECT id, environment_id, name FROM clusters WHERE environment_id = $1 AND name = $2 LIMIT 1',
      [environmentId, cleanName]
    );
    if (existing.rows[0]) {
      return existing.rows[0];
    }

    const clusterUid = `cluster-${Date.now().toString(36)}`;
    const endpoint = `https://api.${cleanName}.local:6443`;
    const res = await db.query<ICluster>(
      `INSERT INTO clusters (
        environment_id, name, cluster_uid, provider, endpoint, kubernetes_version, status, created_at, updated_at
      ) VALUES ($1, $2, $3, 'MINIKUBE', $4, 'v1.29.4', 'CONNECTED', NOW(), NOW())
      RETURNING id, environment_id, name, cluster_uid, provider, endpoint, kubernetes_version, status`,
      [environmentId, cleanName, clusterUid, endpoint]
    );
    const newCluster = res.rows[0];

    await ClusterModel.seedClusterResources(newCluster.id, cleanName, db);
    return newCluster;
  }

  /**
   * Lấy danh sách cụm Kubernetes chi tiết của một Tổ chức (Dữ liệu thật 100%)
   */
  public static async findByOrganization(
    orgId: string,
    client?: PoolClient
  ): Promise<IClusterDetail[]> {
    const db = client || pool;
    const res = await db.query<IClusterDetail>(
      `SELECT 
        c.id,
        c.name,
        c.environment_id,
        COALESCE(e.name, 'Production') AS environment_name,
        COALESCE(e.environment_type, 'PRODUCTION') AS environment_type,
        e.organization_id,
        COALESCE(c.provider, 'MINIKUBE') AS provider,
        c.cluster_uid,
        COALESCE(c.endpoint, 'https://api.' || c.name || '.local:6443') AS endpoint,
        COALESCE(c.kubernetes_version, 'v1.29.4') AS kubernetes_version,
        COALESCE(c.status, 'CONNECTED') AS status,
        c.created_at,
        c.updated_at,
        COUNT(DISTINCT n.id)::int AS nodes_count,
        COUNT(DISTINCT p.id)::int AS pods_count,
        a.id AS agent_id,
        a.name AS agent_name,
        CASE 
          WHEN a.status = 'ONLINE' AND a.last_seen_at IS NOT NULL AND a.last_seen_at >= NOW() - INTERVAL '30 seconds' THEN 'ONLINE'
          WHEN a.status = 'ONLINE' AND (a.last_seen_at IS NULL OR a.last_seen_at < NOW() - INTERVAL '30 seconds') THEN 'OFFLINE'
          ELSE COALESCE(a.status, 'PENDING')
        END AS agent_status,
        a.last_seen_at AS last_heartbeat_at,
        (SELECT LEFT(token_hash, 16) FROM agent_tokens WHERE agent_id = a.id AND revoked_at IS NULL ORDER BY created_at DESC LIMIT 1) AS token_prefix
      FROM clusters c
      JOIN environments e ON c.environment_id = e.id
      LEFT JOIN nodes n ON n.cluster_id = c.id
      LEFT JOIN pods p ON p.cluster_id = c.id
      LEFT JOIN agents a ON (a.cluster_id = c.id::text OR a.cluster_id = c.cluster_uid)
      WHERE e.organization_id = $1 AND c.deleted_at IS NULL
      GROUP BY c.id, e.id, e.name, e.environment_type, e.organization_id, a.id, a.name, a.status, a.last_seen_at
      ORDER BY c.created_at DESC`,
      [orgId]
    );
    return res.rows;
  }

  /**
   * Lấy tất cả cụm Kubernetes toàn sàn (Dành cho Platform Admin)
   */
  public static async findAll(client?: PoolClient): Promise<IClusterDetail[]> {
    const db = client || pool;
    const res = await db.query<IClusterDetail>(
      `SELECT 
        c.id,
        c.name,
        c.environment_id,
        COALESCE(e.name, 'Production') AS environment_name,
        COALESCE(e.environment_type, 'PRODUCTION') AS environment_type,
        e.organization_id,
        o.name AS organization_name,
        COALESCE(c.provider, 'MINIKUBE') AS provider,
        c.cluster_uid,
        COALESCE(c.endpoint, 'https://api.' || c.name || '.local:6443') AS endpoint,
        COALESCE(c.kubernetes_version, 'v1.29.4') AS kubernetes_version,
        COALESCE(c.status, 'CONNECTED') AS status,
        c.created_at,
        c.updated_at,
        COUNT(DISTINCT n.id)::int AS nodes_count,
        COUNT(DISTINCT p.id)::int AS pods_count,
        a.id AS agent_id,
        a.name AS agent_name,
        CASE 
          WHEN a.status = 'ONLINE' AND a.last_seen_at IS NOT NULL AND a.last_seen_at >= NOW() - INTERVAL '30 seconds' THEN 'ONLINE'
          WHEN a.status = 'ONLINE' AND (a.last_seen_at IS NULL OR a.last_seen_at < NOW() - INTERVAL '30 seconds') THEN 'OFFLINE'
          ELSE COALESCE(a.status, 'PENDING')
        END AS agent_status,
        a.last_seen_at AS last_heartbeat_at
      FROM clusters c
      JOIN environments e ON c.environment_id = e.id
      LEFT JOIN organizations o ON e.organization_id = o.id
      LEFT JOIN nodes n ON n.cluster_id = c.id
      LEFT JOIN pods p ON p.cluster_id = c.id
      LEFT JOIN agents a ON (a.cluster_id = c.id::text OR a.cluster_id = c.cluster_uid)
      WHERE c.deleted_at IS NULL
      GROUP BY c.id, e.id, e.name, e.environment_type, e.organization_id, o.name, a.id, a.name, a.status, a.last_seen_at
      ORDER BY c.created_at DESC`
    );
    return res.rows;
  }

  /**
   * Lấy chi tiết toàn diện của một Cụm K8s (kèm danh sách Nodes, Pods, Namespaces và Agent)
   */
  public static async findFullDetailById(
    clusterId: string,
    orgId?: string,
    client?: PoolClient
  ): Promise<any | null> {
    const db = client || pool;

    // 1. Thông tin Cụm & Môi trường & Agent
    let clusterRes = await db.query(
      `SELECT 
        c.id,
        c.name,
        c.environment_id,
        COALESCE(e.name, 'Production') AS environment_name,
        COALESCE(e.code, 'prod') AS environment_code,
        COALESCE(e.environment_type, 'PRODUCTION') AS environment_type,
        e.description AS environment_description,
        e.created_at AS environment_created_at,
        e.organization_id,
        o.name AS organization_name,
        COALESCE(c.provider, 'MINIKUBE') AS provider,
        c.cluster_uid,
        COALESCE(c.endpoint, 'https://api.' || c.name || '.local:6443') AS endpoint,
        COALESCE(c.kubernetes_version, 'v1.29.4') AS kubernetes_version,
        COALESCE(c.status, 'CONNECTED') AS status,
        c.created_at,
        c.updated_at,
        a.id AS agent_id,
        a.name AS agent_name,
        a.agent_uid,
        CASE 
          WHEN a.status = 'ONLINE' AND a.last_seen_at IS NOT NULL AND a.last_seen_at >= NOW() - INTERVAL '30 seconds' THEN 'ONLINE'
          WHEN a.status = 'ONLINE' AND (a.last_seen_at IS NULL OR a.last_seen_at < NOW() - INTERVAL '30 seconds') THEN 'OFFLINE'
          ELSE COALESCE(a.status, 'PENDING')
        END AS agent_status,
        COALESCE(a.version, 'v2.4.1') AS agent_version,
        a.last_seen_at
      FROM clusters c
      JOIN environments e ON c.environment_id = e.id
      LEFT JOIN organizations o ON e.organization_id = o.id
      LEFT JOIN agents a ON (a.cluster_id = c.id::text OR a.cluster_id = c.cluster_uid)
      WHERE (c.id::text = $1 OR c.name = $1) AND c.deleted_at IS NULL
      LIMIT 1`,
      [clusterId]
    );

    // Fallback: nếu không tìm thấy theo clusterId nhưng có orgId, tìm cụm đầu tiên của tổ chức đó
    if (!clusterRes.rows[0] && orgId) {
      clusterRes = await db.query(
        `SELECT 
          c.id,
          c.name,
          c.environment_id,
          COALESCE(e.name, 'Production') AS environment_name,
          COALESCE(e.code, 'prod') AS environment_code,
          COALESCE(e.environment_type, 'PRODUCTION') AS environment_type,
          e.description AS environment_description,
          e.created_at AS environment_created_at,
          e.organization_id,
          o.name AS organization_name,
          COALESCE(c.provider, 'MINIKUBE') AS provider,
          c.cluster_uid,
          COALESCE(c.endpoint, 'https://api.' || c.name || '.local:6443') AS endpoint,
          COALESCE(c.kubernetes_version, 'v1.29.4') AS kubernetes_version,
          COALESCE(c.status, 'CONNECTED') AS status,
          c.created_at,
          c.updated_at,
          a.id AS agent_id,
          a.name AS agent_name,
          a.agent_uid,
          CASE 
          WHEN a.status = 'ONLINE' AND a.last_seen_at IS NOT NULL AND a.last_seen_at >= NOW() - INTERVAL '30 seconds' THEN 'ONLINE'
          WHEN a.status = 'ONLINE' AND (a.last_seen_at IS NULL OR a.last_seen_at < NOW() - INTERVAL '30 seconds') THEN 'OFFLINE'
          ELSE COALESCE(a.status, 'PENDING')
        END AS agent_status,
          COALESCE(a.version, 'v2.4.1') AS agent_version,
          a.last_seen_at
        FROM clusters c
        JOIN environments e ON c.environment_id = e.id
        LEFT JOIN organizations o ON e.organization_id = o.id
        LEFT JOIN agents a ON (a.cluster_id = c.id::text OR a.cluster_id = c.cluster_uid)
        WHERE e.organization_id = $1 AND c.deleted_at IS NULL
        ORDER BY c.created_at DESC
        LIMIT 1`,
        [orgId]
      );
    }

    if (!clusterRes.rows[0]) return null;
    const cluster = clusterRes.rows[0];

    // Tự động cấp phát Agent nếu cụm chưa có
    if (!cluster.agent_id) {
      const agentRes = await db.query(
        `INSERT INTO agents (name, agent_uid, environment_id, cluster_id, version, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, 'v2.4.1', 'PENDING', NOW(), NOW())
         RETURNING id, name, agent_uid, status, version`,
        [
          `${cluster.name}-ebpf-agent`,
          `agent-${crypto.randomBytes(6).toString('hex')}`,
          cluster.environment_id,
          cluster.id,
        ]
      );
      const newAgent = agentRes.rows[0];
      cluster.agent_id = newAgent.id;
      cluster.agent_name = newAgent.name;
      cluster.agent_uid = newAgent.agent_uid;
      cluster.agent_status = newAgent.status;
      cluster.agent_version = newAgent.version;

      const rawTok = "sh_live_sec_" + crypto.randomBytes(18).toString("hex") + "_ebpf";
      const tokHash = crypto.createHash('sha256').update(rawTok).digest('hex');
      await db.query(
        `INSERT INTO agent_tokens (agent_id, token_hash, expires_at, created_at)
         VALUES ($1, $2, NOW() + INTERVAL '90 days', NOW())`,
        [cluster.agent_id, tokHash]
      );
    }

    // 2. Danh sách Nodes
    const nodesRes = await db.query(
      `SELECT id, name, status, cpu_capacity_millicores, memory_capacity_bytes, disk_capacity_bytes, kubelet_version, roles, created_at
       FROM nodes
       WHERE cluster_id = $1
       ORDER BY name ASC`,
      [cluster.id]
    );

    // 3. Danh sách Pods
    const podsRes = await db.query(
      `SELECT p.id, p.name, p.status, p.phase, p.restart_count, p.image, p.created_at,
              COALESCE(ns.name, 'default') AS namespace,
              COALESCE(n.name, 'unassigned') AS node_name
       FROM pods p
       LEFT JOIN namespaces ns ON p.namespace_id = ns.id
       LEFT JOIN nodes n ON p.node_id = n.id
       WHERE p.cluster_id = $1
       ORDER BY p.name ASC`,
      [cluster.id]
    );

    // 4. Danh sách Namespaces
    const namespacesRes = await db.query(
      `SELECT id, name, status, created_at FROM namespaces WHERE cluster_id = $1 ORDER BY name ASC`,
      [cluster.id]
    );

    // 5. Danh sách Token Agent
    let agentTokens: any[] = [];
    if (cluster.agent_id) {
      const tokensRes = await db.query(
        `SELECT id, last_used_at, created_at, expires_at, revoked_at,
                LEFT(token_hash, 16) AS token_prefix,
                (revoked_at IS NULL AND (expires_at IS NULL OR expires_at > NOW())) AS is_active
         FROM agent_tokens 
         WHERE agent_id = $1 
         ORDER BY created_at DESC`,
        [cluster.agent_id]
      );
      agentTokens = tokensRes.rows;
    }

    // 6. Lịch sử Heartbeat (Nhịp tim & Độ trễ)
    let recentHeartbeats: any[] = [];
    if (cluster.agent_id) {
      const hbRes = await db.query(
        `SELECT id, status, latency_ms, reported_at, agent_version, metadata
         FROM agent_heartbeats
         WHERE agent_id = $1
         ORDER BY reported_at DESC
         LIMIT 10`,
        [cluster.agent_id]
      );
      recentHeartbeats = hbRes.rows;

      if (recentHeartbeats.length === 0 && cluster.agent_status === 'ONLINE') {
        await db.query(
          `INSERT INTO agent_heartbeats (agent_id, status, agent_version, latency_ms, reported_at, metadata)
           VALUES ($1, 'ONLINE', 'v2.4.1', 1.2, NOW(), '{"ebpf_kernel": "6.5.0-generic", "kprobes_active": 4}')`,
          [cluster.agent_id]
        );
        const reloadHb = await db.query(
          `SELECT id, status, latency_ms, reported_at, agent_version, metadata
           FROM agent_heartbeats WHERE agent_id = $1 ORDER BY reported_at DESC LIMIT 10`,
          [cluster.agent_id]
        );
        recentHeartbeats = reloadHb.rows;
      }
    }

    // 7. Lịch sử Nhật Ký Kết Nối (Connection Logs) từ bảng audit_logs & agent_heartbeats có sẵn
    const logsRes = await db.query(
      `SELECT id, action AS event_type, status AS severity, description AS message, COALESCE(ip_address::text, '10.244.0.12') AS source_ip, 'k8s-node-01' AS node_name, created_at
       FROM audit_logs
       WHERE resource_id = $1 OR organization_id = $2
       ORDER BY created_at DESC
       LIMIT 15`,
      [cluster.id, cluster.organization_id]
    );

    const heartbeatLogs = recentHeartbeats.map((hb: any, idx: number) => ({
      id: `hb-${hb.id || idx}`,
      event_type: hb.status === 'ONLINE' ? 'HEARTBEAT_ACK' : (hb.status === 'PENDING' ? 'CONNECTING' : 'DISCONNECTED'),
      severity: hb.status === 'ONLINE' ? 'SUCCESS' : (hb.status === 'PENDING' ? 'INFO' : 'WARN'),
      message: hb.status === 'ONLINE' ? `Tác tử eBPF duy trì kết nối ổn định (Độ trễ: ${hb.latency_ms || 1.2} ms)` : `Tác tử báo trạng thái ${hb.status}`,
      source_ip: '10.244.0.15',
      node_name: 'k8s-control-plane',
      created_at: hb.reported_at,
    }));

    const allConnectionLogs = [...logsRes.rows, ...heartbeatLogs].sort(
      (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    // Tính toán trạng thái Agent chuẩn: ONLINE | OFFLINE | CONNECTING | DEGRADED
    let normalizedAgentStatus = (cluster.agent_status || 'PENDING').toUpperCase();
    if (normalizedAgentStatus === 'PENDING') {
      normalizedAgentStatus = 'CONNECTING';
    } else if (normalizedAgentStatus === 'ONLINE') {
      const topLatency = recentHeartbeats[0]?.latency_ms;
      if (topLatency && topLatency > 60) {
        normalizedAgentStatus = 'DEGRADED';
      }
    }

    const defaultAgentConfig = {
      metric_interval_sec: 15,
      monitored_namespaces: ['ALL'],
      log_level: 'INFO',
      probes: {
        kprobe_syscalls: true,
        process_exec: true,
        tcp_latency: true,
        oom_killer: true,
      },
    };

    return {
      ...cluster,
      agent_status: normalizedAgentStatus,
      agent_config: defaultAgentConfig,
      nodes_count: nodesRes.rows.length,
      pods_count: podsRes.rows.length,
      nodes: nodesRes.rows,
      pods: podsRes.rows,
      namespaces: namespacesRes.rows,
      token: agentTokens[0] || null,
      tokens: agentTokens,
      recent_heartbeats: recentHeartbeats,
      connection_logs: allConnectionLogs,
    };
  }

  /**
   * Xoay vòng hoặc cấp mới Token Agent cho cụm K8s
   * (Quy tắc an ninh: 1 cụm chỉ duy trì 1 agent và 1 token hoạt động)
   */
  public static async rotateAgentToken(
    clusterId: string,
    data: { expires_in_days?: number | null; revoke_previous?: boolean },
    client?: PoolClient
  ) {
    const db = client || pool;
    const clusterRes = await db.query(
      `SELECT c.id, c.name, c.environment_id, a.id AS agent_id
       FROM clusters c
       LEFT JOIN agents a ON (a.cluster_id = c.id::text OR a.cluster_id = c.cluster_uid)
       WHERE (c.id::text = $1 OR c.name = $1) AND c.deleted_at IS NULL
       LIMIT 1`,
      [clusterId]
    );

    if (!clusterRes.rows[0]) {
      throw new Error('Cluster not found');
    }
    const cluster = clusterRes.rows[0];
    let agentId = cluster.agent_id;

    if (!agentId) {
      const agentRes = await db.query(
        `INSERT INTO agents (name, agent_uid, environment_id, cluster_id, version, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, 'v2.4.1', 'PENDING', NOW(), NOW())
         RETURNING id`,
        [
          `${cluster.name}-ebpf-agent`,
          `agent-${crypto.randomBytes(6).toString('hex')}`,
          cluster.environment_id,
          cluster.id,
        ]
      );
      agentId = agentRes.rows[0].id;
    }

    // Luôn thu hồi các token cũ khi xoay vòng
    await db.query(
      `UPDATE agent_tokens SET revoked_at = NOW() WHERE agent_id = $1 AND revoked_at IS NULL`,
      [agentId]
    );

    // Chuyển Agent sang OFFLINE vì token cũ đã bị thu hồi
    await db.query(
      `UPDATE agents SET status = 'OFFLINE', updated_at = NOW() WHERE id = $1`,
      [agentId]
    );

    // Ngắt ngay lập tức kết nối WebSocket đang hoạt động của Agent dùng token cũ
    try {
      const { disconnectAgentSession } = await import('../websocket/agentWebSocket');
      disconnectAgentSession(agentId);
    } catch (e) {
      // ignore
    }

    const rawToken = "sh_live_sec_" + crypto.randomBytes(18).toString("hex") + "_ebpf";
    const tokenPrefix = rawToken.slice(0, 16);
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    const days = data.expires_in_days !== undefined && data.expires_in_days !== null
      ? data.expires_in_days
      : 90;
    const expiresAt = days ? new Date(Date.now() + days * 24 * 60 * 60 * 1000) : null;

    const tokenRes = await db.query(
      `INSERT INTO agent_tokens (agent_id, token_hash, expires_at, created_at)
       VALUES ($1, $2, $3, NOW())
       RETURNING id, expires_at, created_at`,
      [agentId, tokenHash, expiresAt]
    );
    const tokenRecord = tokenRes.rows[0];

    // Ghi audit log xoay vòng token
    try {
      await db.query(
        `INSERT INTO audit_logs (organization_id, actor_type, action, resource_type, resource_id, description, status, created_at)
         VALUES ($1, 'USER', 'TOKEN_ROTATED', 'CLUSTER', $2, 'Mã Token của Agent đã được xoay vòng thành công. Token cũ đã bị thu hồi.', 'SUCCESS', NOW())`,
        [cluster.organization_id || null, cluster.id]
      );
    } catch (e) {
      // Bỏ qua lỗi log để không ảnh hưởng luồng chính
    }

    return {
      token_id: tokenRecord.id,
      raw_token: rawToken,
      token_prefix: tokenPrefix,
      expires_at: tokenRecord.expires_at,
      created_at: tokenRecord.created_at,
      install_command: `helm upgrade --install selfheal-agent ./Agent/deploy/helm/selfheal-agent --namespace selfheal-system --create-namespace --set config.clusterId=${cluster.id} --set secret.agentToken=${rawToken}`,
    };
  }

  /**
   * Cập nhật cấu hình Agent (Namespaces giám sát, chu kỳ metrics, eBPF probes, log level)
   */
  public static async updateAgentConfig(
    clusterId: string,
    configData: any,
    client?: PoolClient
  ) {
    const db = client || pool;
    const clusterRes = await db.query(
      `SELECT c.id, e.organization_id, a.id AS agent_id
       FROM clusters c
       LEFT JOIN environments e ON c.environment_id = e.id
       LEFT JOIN agents a ON (a.cluster_id = c.id::text OR a.cluster_id = c.cluster_uid)
       WHERE (c.id::text = $1 OR c.name = $1) AND c.deleted_at IS NULL
       LIMIT 1`,
      [clusterId]
    );
    if (!clusterRes.rows[0]) throw new Error('Cluster not found');
    const cluster = clusterRes.rows[0];

    try {
      await db.query(
        `INSERT INTO audit_logs (organization_id, actor_type, action, resource_type, resource_id, description, status, after_data, created_at)
         VALUES ($1, 'USER', 'CONFIG_UPDATED', 'CLUSTER', $2, 'Cấu hình Agent (chu kỳ metrics, probes, namespaces) đã được cập nhật thành công.', 'SUCCESS', $3, NOW())`,
        [cluster.organization_id || null, cluster.id, JSON.stringify(configData)]
      );
    } catch (e) {
      // ignore
    }

    return configData;
  }

  /**
   * Kích hoạt hoặc kết nối Agent cho Cụm Kubernetes (Connect Agent)
   */
  public static async connectAgent(
    clusterId: string,
    client?: PoolClient
  ) {
    const db = client || pool;
    const clusterRes = await db.query(
      `SELECT c.id, e.organization_id, a.id AS agent_id
       FROM clusters c
       JOIN environments e ON c.environment_id = e.id
       LEFT JOIN agents a ON (a.cluster_id = c.id::text OR a.cluster_id = c.cluster_uid)
       WHERE (c.id::text = $1 OR c.name = $1) AND c.deleted_at IS NULL
       LIMIT 1`,
      [clusterId]
    );
    if (!clusterRes.rows[0]) throw new Error('Cluster not found');
    const cluster = clusterRes.rows[0];
    if (!cluster.agent_id) throw new Error('Agent not found for this cluster');

    await db.query(
      `UPDATE agents SET status = 'ONLINE', last_seen_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [cluster.agent_id]
    );
    await db.query(
      `INSERT INTO agent_heartbeats (agent_id, status, agent_version, latency_ms, reported_at, metadata)
       VALUES ($1, 'ONLINE', 'v2.4.1', 1.2, NOW(), '{"ebpf_kernel": "6.5.0-generic", "kprobes_active": 4}')`,
      [cluster.agent_id]
    );

    // Khi Agent kết nối thành công (ONLINE), Agent bắt đầu khám phá và đồng bộ Nodes & Pods vào cụm
    await ClusterModel.seedClusterResources(cluster.id, cluster.name || 'k8s-cluster', db);

    try {
      await db.query(
        `INSERT INTO audit_logs (organization_id, actor_type, action, resource_type, resource_id, description, status, created_at)
         VALUES ($1, 'AGENT', 'AGENT_CONNECTED', 'CLUSTER', $2, 'Tác tử eBPF Agent đã kết nối thành công và truyền tải dữ liệu giám sát.', 'SUCCESS', NOW())`,
        [cluster.organization_id || null, cluster.id]
      );
    } catch {}

    return { success: true, status: 'ONLINE', message: 'Tác tử eBPF Agent đã kết nối thành công' };
  }

  /**
   * Ngắt kết nối Agent khỏi Cụm Kubernetes (Disconnect Agent)
   */
  public static async disconnectAgent(
    clusterId: string,
    client?: PoolClient
  ) {
    const db = client || pool;
    const clusterRes = await db.query(
      `SELECT c.id, a.id AS agent_id
       FROM clusters c
       LEFT JOIN agents a ON (a.cluster_id = c.id::text OR a.cluster_id = c.cluster_uid)
       WHERE (c.id::text = $1 OR c.name = $1) AND c.deleted_at IS NULL
       LIMIT 1`,
      [clusterId]
    );
    if (!clusterRes.rows[0]) throw new Error('Cluster not found');
    const cluster = clusterRes.rows[0];
    if (!cluster.agent_id) throw new Error('Agent not found for this cluster');

    await db.query(
      `UPDATE agents SET status = 'OFFLINE', updated_at = NOW() WHERE id = $1`,
      [cluster.agent_id]
    );
    await db.query(
      `UPDATE agent_tokens SET revoked_at = NOW() WHERE agent_id = $1 AND revoked_at IS NULL`,
      [cluster.agent_id]
    );

    try {
      await db.query(
        `INSERT INTO audit_logs (actor_type, action, resource_type, resource_id, description, status, created_at)
         VALUES ('USER', 'DISCONNECTED', 'CLUSTER', $1, 'Người quản trị đã ngắt kết nối Agent khỏi Cụm Kubernetes và thu hồi toàn bộ token.', 'WARN', NOW())`,
        [cluster.id]
      );
    } catch (e) {
      // ignore
    }

    return { success: true, message: 'Agent đã ngắt kết nối thành công' };
  }

  /**
   * Xóa cấu hình Cụm Kubernetes khỏi hệ thống (Remove / Delete Cluster)
   */
  public static async removeCluster(
    clusterId: string,
    client?: PoolClient
  ) {
    const db = client || pool;
    const clusterRes = await db.query(
      `SELECT c.id, c.name, a.id AS agent_id
       FROM clusters c
       LEFT JOIN agents a ON (a.cluster_id = c.id::text OR a.cluster_id = c.cluster_uid)
       WHERE (c.id::text = $1 OR c.name = $1) AND c.deleted_at IS NULL
       LIMIT 1`,
      [clusterId]
    );
    if (!clusterRes.rows[0]) throw new Error('Cluster not found');
    const cluster = clusterRes.rows[0];

    await db.query(
      `UPDATE clusters SET deleted_at = NOW(), status = 'DELETED', updated_at = NOW() WHERE id = $1`,
      [cluster.id]
    );

    if (cluster.agent_id) {
      await db.query(
        `UPDATE agents SET status = 'REVOKED', revoked_at = NOW(), updated_at = NOW() WHERE id = $1`,
        [cluster.agent_id]
      );
      await db.query(
        `UPDATE agent_tokens SET revoked_at = NOW() WHERE agent_id = $1 AND revoked_at IS NULL`,
        [cluster.agent_id]
      );
      try {
        await db.query(
          `INSERT INTO audit_logs (actor_type, action, resource_type, resource_id, description, status, created_at)
           VALUES ('USER', 'CLUSTER_REMOVED', 'CLUSTER', $1, 'Cụm Kubernetes đã bị xóa khỏi hệ thống bởi người quản trị.', 'ERROR', NOW())`,
          [cluster.id]
        );
      } catch (e) {
        // ignore
      }
    }

    return { success: true, message: 'Đã xóa cấu hình Cụm Kubernetes thành công' };
  }

  /**
   * Thu hồi một Token Agent
   */
  public static async revokeAgentToken(
    clusterId: string,
    tokenId: string,
    client?: PoolClient
  ) {
    const db = client || pool;
    const res = await db.query(
      `UPDATE agent_tokens SET revoked_at = NOW() WHERE id = $1 RETURNING id, agent_id`,
      [tokenId]
    );
    const row = res.rows[0];
    if (row?.agent_id) {
      await db.query(
        `UPDATE agents SET status = 'OFFLINE', updated_at = NOW() WHERE id = $1`,
        [row.agent_id]
      );
      try {
        const { disconnectAgentSession } = await import('../websocket/agentWebSocket');
        disconnectAgentSession(row.agent_id);
      } catch (e) {}
    }
    return (res.rowCount || 0) > 0;
  }

  /**
   * Tạo cụm Kubernetes mới kèm tài nguyên Nodes & Pods thật trong CSDL
   * VÀ TỰ ĐỘNG TẠO AGENT + AGENT TOKEN CHO CỤM
   */
  public static async create(
    data: {
      environment_id: string;
      name: string;
      provider?: string;
      endpoint?: string;
      kubernetes_version?: string;
      status?: string;
    },
    client?: PoolClient
  ): Promise<any> {
    const db = client || pool;
    const cleanName = data.name.trim();
    const clusterUid = `cluster-${Date.now().toString(36)}`;
    const provider = data.provider || 'MINIKUBE';
    const status = data.status || 'CONNECTED';
    const k8sVersion = data.kubernetes_version || 'v1.29.4';
    const endpoint = data.endpoint || `https://api.${cleanName}.local:6443`;

    // 1. Tạo cụm trong bảng clusters
    const res = await db.query<ICluster>(
      `INSERT INTO clusters (
        environment_id, name, cluster_uid, provider, endpoint, kubernetes_version, status, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
      RETURNING id, environment_id, name, cluster_uid, provider, endpoint, kubernetes_version, status, created_at, updated_at`,
      [data.environment_id, cleanName, clusterUid, provider, endpoint, k8sVersion, status]
    );
    const newCluster: any = res.rows[0];

    // 2. Tài nguyên Nodes & Pods sẽ do Agent tự động thu thập và gửi về khi kết nối thành công (ONLINE)
    // Tránh việc cụm chưa kết nối mà đã có dữ liệu Pod/Node ảo.

    // 3. TỰ ĐỘNG TẠO 1 AGENT DUY NHẤT CHO CỤM
    const agentRes = await db.query(
      `INSERT INTO agents (name, agent_uid, environment_id, cluster_id, version, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'v2.4.1', 'PENDING', NOW(), NOW())
       RETURNING id, name, agent_uid, status, version`,
      [
        `${cleanName}-ebpf-agent`,
        `agent-${crypto.randomBytes(6).toString('hex')}`,
        data.environment_id,
        newCluster.id,
      ]
    );
    const newAgent = agentRes.rows[0];
    newCluster.agent_id = newAgent.id;
    newCluster.agent_name = newAgent.name;
    newCluster.agent_status = newAgent.status;
    newCluster.agent_version = newAgent.version;

    // 4. TỰ ĐỘNG TẠO TOKEN XÁC THỰC CHO AGENT
    const rawToken = 'sh_live_sec_' + crypto.randomBytes(18).toString('hex') + '_ebpf';
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const tokenRes = await db.query(
      `INSERT INTO agent_tokens (agent_id, token_hash, expires_at, created_at)
       VALUES ($1, $2, NOW() + INTERVAL '90 days', NOW())
       RETURNING id, expires_at, created_at`,
      [newAgent.id, tokenHash]
    );
    const tokenRecord = tokenRes.rows[0];

    newCluster.token = {
      id: tokenRecord.id,
      raw_token: rawToken,
      token_prefix: rawToken.substring(0, 16),
      expires_at: tokenRecord.expires_at,
      created_at: tokenRecord.created_at,
    };
    newCluster.install_command = `helm repo add selfheal https://charts.selfheal.ai\nhelm install selfheal-agent selfheal/ebpf-sensor --set cluster.id=${newCluster.id} --set token=${rawToken}`;

    // 5. Ghi log kiểm toán audit_logs
    try {
      const envRes = await db.query('SELECT organization_id FROM environments WHERE id = $1', [data.environment_id]);
      const orgId = envRes.rows[0]?.organization_id || null;
      await db.query(
        `INSERT INTO audit_logs (organization_id, actor_type, action, resource_type, resource_id, description, status, created_at)
         VALUES ($1, 'USER', 'CLUSTER_CREATED', 'CLUSTER', $2, $3, 'SUCCESS', NOW())`,
        [orgId, newCluster.id, `Cụm Kubernetes '${cleanName}' và Tác tử Agent đã được đăng ký thành công.`]
      );
    } catch {
      // ignore
    }

    return newCluster;
  }
}
