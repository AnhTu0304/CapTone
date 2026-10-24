import crypto from 'crypto';

import { pool } from '../config/database';
import {
  AgentModel,
  MetricModel,
  LogModel,
  KubernetesEventModel,
  WorkloadModel,
  EnvironmentModel,
  ClusterModel,
} from '../models';
import { ApiError } from '../utils/apiError';
import { AuditService } from './audit.service';
import {
  AgentMetricsPayload,
  AgentLogPayload,
  AgentK8sEventPayload,
  AgentK8sInventoryPayload,
} from '../schemas/agentWebSocket.schema';

export interface AuthenticatedAgent {
  id: string;
  name: string;
  agent_uid: string;
  cluster_id: string | null;
  environment_id: string;
  organization_id?: string;
  status: string;
}

export class AgentService {
  /**
   * Authenticate Agent using Agent Token
   */
  public static async authenticateAgent(token: string): Promise<AuthenticatedAgent | null> {
    if (!token || typeof token !== 'string') return null;

    const tokenHash = crypto.createHash('sha256').update(token.trim()).digest('hex');

    try {
      const agentRow = await AgentModel.findByTokenHash(tokenHash, token.trim());
      if (!agentRow) {
        return null;
      }

      // Mark agent ONLINE and update token last_used
      await AgentModel.setOnline(agentRow.id, agentRow.token_id);

      // Record connection heartbeat
      await AgentModel.recordHeartbeat(
        agentRow.id,
        'ONLINE',
        { event: 'connect', token_prefix: token.slice(0, 8) }
      );

      return {
        id: agentRow.id,
        name: agentRow.name,
        agent_uid: agentRow.agent_uid,
        cluster_id: agentRow.cluster_id,
        environment_id: agentRow.environment_id,
        status: 'ONLINE',
      };
    } catch (error) {
      console.error('Error during agent authentication:', error);
      return null;
    }
  }

  /**
   * Mark agent OFFLINE on disconnect
   */
  public static async setAgentOffline(agentId: string): Promise<void> {
    try {
      await AgentModel.setOffline(agentId);
      await AgentModel.recordHeartbeat(agentId, 'OFFLINE', { event: 'disconnect' });
    } catch (error) {
      console.error(`Error marking agent ${agentId} offline:`, error);
    }
  }

  /**
   * Store Agent Metrics with boundary validation and sanitization
   */
  public static async storeMetrics(
    agent: AuthenticatedAgent,
    data: AgentMetricsPayload
  ): Promise<{ id: number | string }> {
    const rawDate = new Date(data.timestamp);
    const collectedAt = isNaN(rawDate.getTime()) ? new Date() : rawDate;

    // Enforce safe string truncation for database varchar(100)
    const serviceId = data.service_id.slice(0, 100);
    const podId = (data.pod_id || 'unknown-pod').slice(0, 100);

    // Auto-link workload with namespace_id
    const clusterId = agent.cluster_id ? agent.cluster_id.slice(0, 100) : null;
    const namespaceName = (data.namespace || 'default').trim();
    if (clusterId && serviceId) {
      try {
        const nsRes = await pool.query(
          `SELECT id FROM namespaces WHERE (cluster_id = $1 OR cluster_id IN (SELECT name FROM clusters WHERE id::text = $1 OR cluster_uid = $1)) AND name = $2 LIMIT 1`,
          [clusterId, namespaceName]
        );
        const namespaceId = nsRes.rows[0]?.id || null;
        await WorkloadModel.findOrCreateByName(serviceId, clusterId, undefined, namespaceId);
      } catch {
        // Non-blocking workload sync
      }
    }

    const result = await MetricModel.create({
      agent_id: agent.id.slice(0, 100),
      cluster_id: agent.cluster_id ? agent.cluster_id.slice(0, 100) : null,
      service_id: serviceId,
      pod_id: podId,
      cpu: Number.isFinite(data.cpu) ? data.cpu : 0,
      ram: Number.isFinite(data.ram) ? data.ram : 0,
      disk: Number.isFinite(data.disk) ? data.disk : 0,
      request_rate: Number.isFinite(data.request_rate) ? data.request_rate : 0,
      latency: Number.isFinite(data.latency) ? data.latency : 0,
      http_5xx_rate: Number.isFinite(data.http_5xx_rate) ? data.http_5xx_rate : 0,
      pod_restart_count: Number.isInteger(data.pod_restart_count) ? data.pod_restart_count : 0,
      replica_count: Number.isInteger(data.replica_count) && data.replica_count > 0 ? data.replica_count : 1,
      collected_at: collectedAt,
    });

    await AgentModel.touchLastSeen(agent.id);
    return result;
  }

  /**
   * Store Agent Logs with boundary validation and sanitization
   */
  public static async storeLog(
    agent: AuthenticatedAgent,
    data: AgentLogPayload
  ): Promise<{ id: number | string }> {
    const rawDate = new Date(data.timestamp);
    const occurredAt = isNaN(rawDate.getTime()) ? new Date() : rawDate;

    // Resolve workload_id by service_id if exists
    let workloadId: string | null = null;
    const workload = await WorkloadModel.findByName(data.service_id);
    if (workload) {
      workloadId = workload.id;
    }

    const safeLevel = (data.level || 'INFO').toUpperCase().slice(0, 50);
    const safeMessage = data.message.slice(0, 65535);

    const result = await LogModel.create({
      cluster_id: agent.cluster_id ? agent.cluster_id.slice(0, 255) : null,
      service_id: workloadId,
      level: safeLevel,
      message: safeMessage,
      source: 'k8s-agent',
      occurred_at: occurredAt,
      metadata: {
        service_id: data.service_id.slice(0, 100),
        pod_id: (data.pod_id || 'unknown-pod').slice(0, 100),
        agent_id: agent.id,
      },
    });

    await AgentModel.touchLastSeen(agent.id);
    return result;
  }

  /**
   * Store Kubernetes Events & Pod Status with boundary validation and sanitization
   */
  public static async storeK8sEvent(
    agent: AuthenticatedAgent,
    data: AgentK8sEventPayload
  ): Promise<{ id: number | string }> {
    const rawDate = new Date(data.timestamp);
    const eventTime = isNaN(rawDate.getTime()) ? new Date() : rawDate;

    const safeType = (data.event.type || 'Normal').slice(0, 50);
    const safeReason = (data.event.reason || 'General').slice(0, 100);
    const safeMessage = (data.event.message || '').slice(0, 10000);
    const safePodId = (data.pod_id || 'unknown-pod').slice(0, 255);
    const safePodName = (data.pod_name || 'unknown-pod').slice(0, 255);

    const result = await KubernetesEventModel.create({
      cluster_id: agent.cluster_id ? agent.cluster_id.slice(0, 255) : null,
      resource_type: 'Pod',
      resource_uid: safePodId,
      event_type: safeType,
      reason: safeReason,
      message: safeMessage,
      source_component: 'k8s-agent',
      first_seen_at: eventTime,
      last_seen_at: eventTime,
      count: 1,
      metadata: {
        service_id: data.service_id.slice(0, 100),
        pod_name: safePodName,
        pod_status: (data.status || 'Running').slice(0, 50),
        agent_id: agent.id,
      },
    });

    // Update pod status if tracked
    await KubernetesEventModel.updatePodStatus(
      safePodName,
      safePodId,
      agent.cluster_id,
      (data.status || 'Running').slice(0, 50)
    );

    await AgentModel.touchLastSeen(agent.id);
    return result;
  }

  /* =========================================================================
     CÁC PHƯƠNG THỨC QUẢN TRỊ AGENT (DÀNH CHO WEB/DEVOPS/DASHBOARD)
     ========================================================================= */

  /**
   * Tạo mới Agent kèm Token kết nối ban đầu
   */
  public static async createAgent(
    orgId: string,
    userId: string,
    data: {
      name: string;
      environment_id: string;
      cluster_id?: string | null;
      agent_uid?: string;
      version?: string;
      token_expires_in_days?: number | null;
      initial_token?: string;
    }
  ) {
    // 1. Kiểm tra môi trường có tồn tại và thuộc tổ chức này không
    const env = await EnvironmentModel.findById(data.environment_id);
    if (!env || env.organization_id !== orgId) {
      throw ApiError.badRequest('Môi trường không tồn tại hoặc không thuộc tổ chức này');
    }

    // 2. Tự động liên kết hoặc tạo mới Cụm máy chủ (Cluster) cho môi trường
    let clusterId = null;
    if (data.cluster_id) {
      const cluster = await ClusterModel.findByIdOrName(data.cluster_id);
      if (cluster && cluster.environment_id === env.id) {
        clusterId = cluster.id;
      }
    }
    if (!clusterId) {
      try {
        const cluster = await ClusterModel.findOrCreate(env.id, data.name || "k8s-cluster-01");
        clusterId = cluster.id;
      } catch (err) {
        console.warn("[AgentService] Không thể tự động tạo Cluster:", err);
      }
    }

    // 3. Sinh agent_uid nếu chưa có
    let agentUid = data.agent_uid?.trim();
    if (!agentUid) {
      agentUid = `agent-${crypto.randomBytes(6).toString('hex')}`;
    }

    // Kiểm tra trùng lặp agent_uid
    const existing = await AgentModel.findByUid(agentUid);
    if (existing) {
      throw ApiError.badRequest(`Agent UID '${agentUid}' đã tồn tại trong hệ thống. Vui lòng chọn UID khác.`);
    }

    // 4. Tạo Agent trong CSDL
    const agent = await AgentModel.create({
      name: data.name,
      agent_uid: agentUid,
      environment_id: env.id,
      cluster_id: clusterId,
      version: data.version || 'v1.0.0',
      status: 'PENDING',
    });

    // 5. Tự động sinh Token kết nối bí mật ban đầu
    const rawToken = data.initial_token?.trim() || "ag_live_" + crypto.randomBytes(24).toString("hex");
    const tokenPrefix = rawToken.slice(0, 12);
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    const days = data.token_expires_in_days !== undefined && data.token_expires_in_days !== null
      ? data.token_expires_in_days
      : 90;
    const expiresAt = days ? new Date(Date.now() + days * 24 * 60 * 60 * 1000) : null;

    const tokenRecord = await AgentModel.createToken({
      agent_id: agent.id,
      token_hash: tokenHash,
      token_prefix: tokenPrefix,
      created_by: userId,
      expires_at: expiresAt,
    });

    try {
      const { AuditService } = await import('./audit.service');
      await AuditService.record({
        organization_id: orgId,
        user_id: userId,
        actor_type: 'USER',
        action: 'AGENT_CREATED',
        resource_type: 'AGENT',
        resource_id: agent.id,
        description: `Tạo mới Tác tử Agent [${agent.name}]`,
        status: 'SUCCESS',
      });
    } catch {}

    return {
      agent,
      token: {
        id: tokenRecord.id,
        raw_token: rawToken,
        token_prefix: tokenPrefix,
        expires_at: tokenRecord.expires_at,
        created_at: tokenRecord.created_at,
      },
      install_command: `curl -sSL https://get.selfheal.io/agent | sh -s -- --token ${rawToken} --env ${env.code}`,
    };
  }

  /**
   * Lấy danh sách Agent của tổ chức kèm bộ lọc phân trang
   */
  public static async getAgents(orgId: string, filter: any) {
    return await AgentModel.findMany({
      ...filter,
      organizationId: orgId,
      clusterId: filter.clusterId || filter.cluster_id,
      environmentId: filter.environmentId || filter.environment_id,
    });
  }

  /**
   * Lấy danh sách toàn bộ Agent hệ thống (dành cho System Admin)
   */
  public static async getAllAgentsGlobal(filter: any = {}) {
    return await AgentModel.findMany({
      ...filter,
      organizationId: filter.organizationId || filter.organization_id,
      clusterId: filter.clusterId || filter.cluster_id,
      environmentId: filter.environmentId || filter.environment_id,
    });
  }

  /**
   * Xem chi tiết Agent dành cho System Admin
   */
  public static async getAgentDetailGlobal(agentId: string) {
    const agent = await AgentModel.findById(agentId);
    if (!agent || !agent.organization_id) {
      throw ApiError.notFound('Agent không tồn tại trên hệ thống');
    }
    return this.getAgentDetail(agent.organization_id, agentId);
  }

  /**
   * Ngắt kết nối Agent dành cho System Admin
   */
  public static async disconnectAgentGlobal(agentId: string, userId?: string) {
    const agent = await AgentModel.findById(agentId);
    if (!agent || !agent.organization_id) {
      throw ApiError.notFound('Agent không tồn tại trên hệ thống');
    }
    return this.disconnectAgent(agent.organization_id, agentId, userId);
  }

  /**
   * Thu hồi Agent dành cho System Admin
   */
  public static async revokeAgentGlobal(agentId: string) {
    const agent = await AgentModel.findById(agentId);
    if (!agent || !agent.organization_id) {
      throw ApiError.notFound('Agent không tồn tại trên hệ thống');
    }
    return this.revokeAgent(agent.organization_id, agentId);
  }

  /**
   * Xoay vòng (Rotate) Token Agent dành cho System Admin
   */
  public static async rotateAgentTokenGlobal(
    agentId: string,
    userId: string,
    expiresInDays?: number | null
  ) {
    const agent = await AgentModel.findById(agentId);
    if (!agent || !agent.organization_id) {
      throw ApiError.notFound('Agent không tồn tại trên hệ thống');
    }
    // Nếu Agent đang ở trạng thái REVOKED, khôi phục về PENDING để có thể cấp token mới
    if (agent.status === 'REVOKED') {
      await pool.query(
        `UPDATE agents SET status = 'PENDING', revoked_at = NULL, updated_at = NOW() WHERE id = $1`,
        [agentId]
      );
    }
    // Thu hồi các token cũ trước khi cấp phát token mới
    await AgentModel.revokeAllTokensByAgentId(agentId);
    return this.createAgentToken(agent.organization_id, agentId, userId, expiresInDays);
  }

  /**
   * Xóa Agent dành cho System Admin
   */
  public static async deleteAgentGlobal(agentId: string, userId?: string, force?: boolean) {
    const agent = await AgentModel.findById(agentId);
    if (!agent || !agent.organization_id) {
      throw ApiError.notFound('Agent không tồn tại trên hệ thống');
    }
    return this.deleteAgent(agent.organization_id, agentId, userId, force);
  }

  /**
   * Xem chi tiết Agent (kèm tokens và lịch sử heartbeat)
   */
  public static async getAgentDetail(orgId: string, agentId: string) {
    const agent = await AgentModel.findById(agentId);
    if (!agent || agent.organization_id !== orgId) {
      throw ApiError.notFound('Agent không tồn tại hoặc không thuộc tổ chức của bạn');
    }

    const tokens = await AgentModel.findTokensByAgentId(agentId);
    const recentHeartbeats = await AgentModel.getHeartbeatHistory(agentId, 10);

    return {
      ...agent,
      tokens,
      recent_heartbeats: recentHeartbeats,
    };
  }

  /**
   * Cập nhật thông tin Agent
   */
  public static async updateAgent(
    orgId: string,
    agentId: string,
    data: { name?: string; cluster_id?: string | null; version?: string }
  ) {
    const agent = await AgentModel.findById(agentId);
    if (!agent || agent.organization_id !== orgId) {
      throw ApiError.notFound('Agent không tồn tại hoặc không thuộc tổ chức của bạn');
    }

    if (data.cluster_id) {
      const cluster = await ClusterModel.findByIdOrName(data.cluster_id);
      if (!cluster || cluster.environment_id !== agent.environment_id) {
        throw ApiError.badRequest('Cụm máy chủ (Cluster) không hợp lệ');
      }
    }

    const updated = await AgentModel.update(agentId, data);
    return updated;
  }

  /**
   * Thu hồi Agent và vô hiệu hóa toàn bộ Token
   */
  public static async revokeAgent(orgId: string, agentId: string) {
    const agent = await AgentModel.findById(agentId);
    if (!agent || agent.organization_id !== orgId) {
      throw ApiError.notFound('Agent không tồn tại hoặc không thuộc tổ chức của bạn');
    }

    const revoked = await AgentModel.revoke(agentId);
    await AgentModel.revokeAllTokensByAgentId(agentId);

    try {
      const { disconnectAgentSession } = await import('../websocket/agentWebSocket');
      disconnectAgentSession(agentId);
    } catch {}

    try {
      const { AuditService } = await import('./audit.service');
      await AuditService.record({
        organization_id: orgId,
        actor_type: 'USER',
        action: 'AGENT_REVOKED',
        resource_type: 'AGENT',
        resource_id: agentId,
        description: `Thu hồi toàn bộ Agent [${agent.name}] và vô hiệu hóa tất cả token`,
        status: 'SUCCESS',
      });
    } catch {}

    return revoked;
  }

  /**
   * Ngắt kết nối Agent (chuyển sang OFFLINE, thu hồi token hiện có, ngắt WebSocket)
   */
  public static async disconnectAgent(orgId: string, agentId: string, userId?: string) {
    const agent = await AgentModel.findById(agentId);
    if (!agent || agent.organization_id !== orgId) {
      throw ApiError.notFound('Agent không tồn tại hoặc không thuộc tổ chức của bạn');
    }

    if (agent.status === 'REVOKED') {
      throw ApiError.badRequest('Không thể ngắt kết nối Agent đã bị thu hồi (REVOKED)');
    }

    // 1. Chuyển trạng thái sang OFFLINE
    await pool.query(
      `UPDATE agents SET status = 'OFFLINE', updated_at = NOW() WHERE id = $1`,
      [agentId]
    );

    // 2. Thu hồi các token kết nối hiện thời để ngăn Agent tự kết nối lại trái phép
    await AgentModel.revokeAllTokensByAgentId(agentId);

    // 3. Ngắt phiên WebSocket đang mở
    try {
      const { disconnectAgentSession } = await import('../websocket/agentWebSocket');
      disconnectAgentSession(agentId);
    } catch {}

    // 4. Ghi nhận audit log
    try {
      const { AuditService } = await import('./audit.service');
      await AuditService.record({
        organization_id: orgId,
        user_id: userId || null,
        actor_type: 'USER',
        action: 'AGENT_DISCONNECTED',
        reason_code: 'USER_DISCONNECTED',
        resource_type: 'AGENT',
        resource_id: agentId,
        target_type: 'AGENT',
        target_id: agentId,
        description: `Người quản trị đã ngắt kết nối Agent [${agent.name}] và thu hồi token kết nối`,
        status: 'SUCCESS',
        before_data: { status: agent.status },
        after_data: { status: 'OFFLINE' },
      });
    } catch (auditErr) {
      console.warn('[AgentService] Failed to record disconnect audit log:', auditErr);
    }

    return {
      id: agentId,
      name: agent.name,
      status: 'OFFLINE',
      message: 'Ngắt kết nối Agent thành công (tất cả token hoạt động đã bị thu hồi)',
    };
  }

  /**
   * Xóa Agent khỏi hệ thống (kiểm tra an toàn nếu Agent đang ONLINE)
   */
  public static async deleteAgent(orgId: string, agentId: string, userId?: string, force?: boolean) {
    const agent = await AgentModel.findById(agentId);
    if (!agent || agent.organization_id !== orgId) {
      throw ApiError.notFound('Agent không tồn tại hoặc không thuộc tổ chức của bạn');
    }

    // Bảo vệ: Chặn xóa Agent đang hoạt động ONLINE nếu không có xác nhận force=true
    if (agent.status === 'ONLINE' && !force) {
      throw ApiError.badRequest('Không thể xóa Agent khi đang hoạt động (ONLINE). Vui lòng ngắt kết nối Agent trước hoặc truyền cờ xác nhận force=true.');
    }

    // 1. Thu hồi toàn bộ token liên quan
    await AgentModel.revokeAllTokensByAgentId(agentId);

    // 2. Ngắt phiên WebSocket
    try {
      const { disconnectAgentSession } = await import('../websocket/agentWebSocket');
      disconnectAgentSession(agentId);
    } catch {}

    // 3. Ghi audit log trước khi xóa
    try {
      const { AuditService } = await import('./audit.service');
      await AuditService.record({
        organization_id: orgId,
        user_id: userId || null,
        actor_type: 'USER',
        action: 'AGENT_DELETED',
        resource_type: 'AGENT',
        resource_id: agentId,
        target_type: 'AGENT',
        target_id: agentId,
        description: `Xóa Agent [${agent.name}] khỏi hệ thống`,
        status: 'SUCCESS',
        before_data: { status: agent.status, cluster_id: agent.cluster_id, environment_id: agent.environment_id },
      });
    } catch (auditErr) {
      console.warn('[AgentService] Failed to record delete audit log:', auditErr);
    }

    // 4. Xóa Agent
    return await AgentModel.delete(agentId);
  }

  /**
   * Tạo Token kết nối mới cho Agent (phục vụ xoay vòng token)
   */
  public static async createAgentToken(
    orgId: string,
    agentId: string,
    userId: string,
    expiresInDays?: number | null
  ) {
    const agent = await AgentModel.findById(agentId);
    if (!agent || agent.organization_id !== orgId) {
      throw ApiError.notFound('Agent không tồn tại hoặc không thuộc tổ chức của bạn');
    }

    if (agent.status === 'REVOKED') {
      throw ApiError.badRequest('Không thể tạo token cho Agent đã bị thu hồi (REVOKED)');
    }

    const rawToken = "ag_live_" + crypto.randomBytes(24).toString("hex");
    const tokenPrefix = rawToken.slice(0, 12);
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    const days = expiresInDays !== undefined && expiresInDays !== null ? expiresInDays : 90;
    const expiresAt = days ? new Date(Date.now() + days * 24 * 60 * 60 * 1000) : null;

    const tokenRecord = await AgentModel.createToken({
      agent_id: agentId,
      token_hash: tokenHash,
      token_prefix: tokenPrefix,
      created_by: userId,
      expires_at: expiresAt,
    });

    try {
      const { AuditService } = await import('./audit.service');
      await AuditService.record({
        organization_id: orgId,
        user_id: userId,
        actor_type: 'USER',
        action: 'AGENT_TOKEN_CREATED',
        resource_type: 'AGENT',
        resource_id: agentId,
        target_type: 'TOKEN',
        target_id: tokenRecord.id,
        description: `Cấp phát mã Token mới cho Agent [${agent.name}] (Prefix: ${tokenPrefix})`,
        status: 'SUCCESS',
      });
    } catch {}

    return {
      token_id: tokenRecord.id,
      raw_token: rawToken,
      token_prefix: tokenPrefix,
      expires_at: tokenRecord.expires_at,
      created_at: tokenRecord.created_at,
    };
  }

  /**
   * Lấy danh sách Token của một Agent
   */
  public static async getAgentTokens(orgId: string, agentId: string) {
    const agent = await AgentModel.findById(agentId);
    if (!agent || agent.organization_id !== orgId) {
      throw ApiError.notFound('Agent không tồn tại hoặc không thuộc tổ chức của bạn');
    }

    return await AgentModel.findTokensByAgentId(agentId);
  }

  /**
   * Thu hồi một Token cụ thể của Agent
   */
  public static async revokeAgentToken(orgId: string, agentId: string, tokenId: string) {
    const agent = await AgentModel.findById(agentId);
    if (!agent || agent.organization_id !== orgId) {
      throw ApiError.notFound('Agent không tồn tại hoặc không thuộc tổ chức của bạn');
    }

    const success = await AgentModel.revokeToken(tokenId, agentId);
    if (!success) {
      throw ApiError.notFound('Token không tồn tại hoặc đã bị thu hồi trước đó');
    }

    try {
      const { disconnectAgentSession } = await import('../websocket/agentWebSocket');
      disconnectAgentSession(agentId);
    } catch {}

    const remainingTokens = await AgentModel.findTokensByAgentId(agentId);
    const hasActiveToken = remainingTokens.some((t) => t.is_active);
    if (!hasActiveToken) {
      await AgentModel.setOffline(agentId);
    }

    try {
      const { AuditService } = await import('./audit.service');
      await AuditService.record({
        organization_id: orgId,
        actor_type: 'USER',
        action: 'AGENT_TOKEN_REVOKED',
        resource_type: 'AGENT',
        resource_id: agentId,
        target_type: 'TOKEN',
        target_id: tokenId,
        description: `Thu hồi Token của Agent [${agent.name}]`,
        status: 'SUCCESS',
      });
    } catch {}

    return { success: true, message: 'Thu hồi Token thành công' };
  }

  /**
   * Xử lý nhịp tim trực tiếp từ Agent daemon (qua HTTP POST /agents/heartbeat)
   */
  public static async recordHeartbeatForAgent(
    agent: AuthenticatedAgent,
    data: {
      latency_ms?: number | null;
      agent_version?: string | null;
      status?: any;
      timestamp?: string | null;
      metadata?: Record<string, unknown> | null;
    }
  ) {
    if (!agent || !agent.id) {
      throw ApiError.unauthorized('Agent chưa được xác thực');
    }

    const metadata: Record<string, unknown> = { ...(data.metadata || {}) };
    if (data.timestamp) {
      metadata.client_timestamp = data.timestamp;
    }

    const heartbeat = await AgentModel.recordHeartbeatDetailed(agent.id, {
      status: data.status || 'ONLINE',
      agent_version: data.agent_version || null,
      latency_ms: data.latency_ms,
      metadata,
    });

    // Nếu Agent trước đó đang OFFLINE, ghi nhận audit log chuyển trạng thái phục hồi
    if (agent.status === 'OFFLINE') {
      try {
        await AuditService.record({
          organization_id: agent.organization_id || null,
          actor_type: 'AGENT',
          action: 'AGENT_CONNECTED',
          reason_code: 'HEARTBEAT_RECOVERED',
          target_type: 'AGENT',
          target_id: agent.id,
          resource_type: 'AGENT',
          resource_id: agent.id,
          status: 'SUCCESS',
          description: `Agent '${agent.name}' recovered connection via valid heartbeat. Status transitioned from OFFLINE to ONLINE.`,
          before_data: { status: 'OFFLINE' },
          after_data: { status: 'ONLINE', last_seen_at: heartbeat.reported_at },
        });
      } catch (auditErr) {
        console.warn(`[AgentService] Non-fatal: Failed to record recovery audit log for agent ${agent.id}:`, auditErr);
      }
    }

    return {
      success: true,
      agent_id: agent.id,
      agent_name: agent.name,
      agent_uid: agent.agent_uid,
      cluster_id: agent.cluster_id,
      status: 'ONLINE',
      heartbeat_id: heartbeat.id,
      reported_at: heartbeat.reported_at,
    };
  }

  public static async recordHeartbeatFromDaemon(
    rawToken: string,
    data: {
      latency_ms?: number | null;
      agent_version?: string | null;
      status?: any;
      timestamp?: string | null;
      metadata?: Record<string, unknown> | null;
    }
  ) {
    if (!rawToken) {
      throw ApiError.unauthorized('Thiếu token xác thực Agent');
    }

    const tokenHash = crypto.createHash('sha256').update(rawToken.trim()).digest('hex');
    const agentRow = await AgentModel.findByTokenHash(tokenHash, rawToken.trim());

    if (!agentRow) {
      throw ApiError.unauthorized('Token Agent không hợp lệ, đã hết hạn hoặc đã bị thu hồi');
    }

    if (agentRow.token_id) {
      await pool.query('UPDATE agent_tokens SET last_used_at = NOW() WHERE id = $1', [agentRow.token_id]);
    }

    return this.recordHeartbeatForAgent(
      {
        id: agentRow.id,
        name: agentRow.name,
        agent_uid: agentRow.agent_uid,
        cluster_id: agentRow.cluster_id,
        environment_id: agentRow.environment_id,
        organization_id: (agentRow as any).organization_id,
        status: agentRow.status,
      },
      data
    );
  }

  /**
   * Lấy lịch sử Heartbeat của Agent (dành cho Dashboard theo dõi độ trễ)
   */
  public static async getHeartbeats(orgId: string, agentId: string, limit?: number) {
    const agent = await AgentModel.findById(agentId);
    if (!agent || agent.organization_id !== orgId) {
      throw ApiError.notFound('Agent không tồn tại hoặc không thuộc tổ chức của bạn');
    }

    return await AgentModel.getHeartbeatHistory(agentId, limit || 50);
  }

  /**
   * Synchronize Real Kubernetes Cluster Inventory (Namespaces, Nodes, Pods)
   */
  public static async syncClusterInventory(
    agent: AuthenticatedAgent,
    data: AgentK8sInventoryPayload
  ): Promise<{ synced_nodes: number; synced_pods: number }> {
    const clusterId = agent.cluster_id;
    if (!clusterId) {
      console.warn(`[AgentService] Agent ${agent.name} (${agent.id}) has no cluster_id to sync inventory.`);
      return { synced_nodes: 0, synced_pods: 0 };
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Sync Namespaces
      const namespaceMap: Record<string, string> = {};
      const existingNsRes = await client.query(
        'SELECT id, name FROM namespaces WHERE cluster_id = $1',
        [clusterId]
      );
      for (const row of existingNsRes.rows) {
        namespaceMap[row.name] = row.id;
      }

      for (const ns of data.namespaces) {
        if (namespaceMap[ns.name]) {
          await client.query(
            `UPDATE namespaces 
             SET kubernetes_uid = COALESCE($1, kubernetes_uid),
                 status = $2,
                 labels = $3,
                 updated_at = NOW()
             WHERE id = $4`,
            [ns.kubernetes_uid || null, ns.status, JSON.stringify(ns.labels || {}), namespaceMap[ns.name]]
          );
        } else {
          const insRes = await client.query(
            `INSERT INTO namespaces (cluster_id, name, kubernetes_uid, status, labels, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
             RETURNING id, name`,
            [clusterId, ns.name, ns.kubernetes_uid || null, ns.status, JSON.stringify(ns.labels || {})]
          );
          if (insRes.rows[0]) {
            namespaceMap[insRes.rows[0].name] = insRes.rows[0].id;
          }
        }
      }

      // Also ensure namespaces of reported pods exist in namespaceMap
      for (const pod of data.pods) {
        const pNs = pod.namespace || 'default';
        if (!namespaceMap[pNs]) {
          const insNs = await client.query(
            `INSERT INTO namespaces (cluster_id, name, status, created_at, updated_at)
             VALUES ($1, $2, 'Active', NOW(), NOW())
             RETURNING id, name`,
            [clusterId, pNs]
          );
          if (insNs.rows[0]) {
            namespaceMap[insNs.rows[0].name] = insNs.rows[0].id;
          }
        }
      }

      // 2. Sync Nodes
      const nodeMap: Record<string, string> = {};
      const existingNodesRes = await client.query(
        'SELECT id, name FROM nodes WHERE cluster_id = $1',
        [clusterId]
      );
      for (const row of existingNodesRes.rows) {
        nodeMap[row.name] = row.id;
      }

      const reportedNodeNames = new Set(data.nodes.map((n) => n.name));

      for (const node of data.nodes) {
        if (nodeMap[node.name]) {
          await client.query(
            `UPDATE nodes
             SET kubernetes_uid = COALESCE($1, kubernetes_uid),
                 status = $2,
                 cpu_capacity_millicores = $3,
                 memory_capacity_bytes = $4,
                 disk_capacity_bytes = $5,
                 kubelet_version = $6,
                 roles = $7,
                 labels = $8,
                 updated_at = NOW()
             WHERE id = $9`,
            [
              node.kubernetes_uid || null,
              node.status || 'Ready',
              node.cpu_capacity_millicores || 4000,
              node.memory_capacity_bytes || 8589934592,
              node.disk_capacity_bytes || 53687091200,
              node.kubelet_version || 'v1.37.0',
              JSON.stringify(node.roles || ['worker']),
              JSON.stringify(node.labels || {}),
              nodeMap[node.name],
            ]
          );
        } else {
          const insNode = await client.query(
            `INSERT INTO nodes (cluster_id, name, kubernetes_uid, status, cpu_capacity_millicores, memory_capacity_bytes, disk_capacity_bytes, kubelet_version, roles, labels, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
             RETURNING id, name`,
            [
              clusterId,
              node.name,
              node.kubernetes_uid || null,
              node.status || 'Ready',
              node.cpu_capacity_millicores || 4000,
              node.memory_capacity_bytes || 8589934592,
              node.disk_capacity_bytes || 53687091200,
              node.kubelet_version || 'v1.37.0',
              JSON.stringify(node.roles || ['worker']),
              JSON.stringify(node.labels || {}),
            ]
          );
          if (insNode.rows[0]) {
            nodeMap[insNode.rows[0].name] = insNode.rows[0].id;
          }
        }
      }

      // Delete stale nodes that are not reported by the real cluster
      if (reportedNodeNames.size > 0) {
        const staleNodes = existingNodesRes.rows.filter((n) => !reportedNodeNames.has(n.name));
        for (const stale of staleNodes) {
          await client.query('DELETE FROM nodes WHERE id = $1', [stale.id]);
        }
      }

      // 3. Sync Pods
      const existingPodsRes = await client.query(
        'SELECT id, name FROM pods WHERE cluster_id = $1',
        [clusterId]
      );
      const podMap: Record<string, string> = {};
      for (const row of existingPodsRes.rows) {
        podMap[row.name] = row.id;
      }

      const reportedPodNames = new Set(data.pods.map((p) => p.name));

      for (const pod of data.pods) {
        const nsId = namespaceMap[pod.namespace] || Object.values(namespaceMap)[0] || null;
        const nodeId = pod.node_name ? nodeMap[pod.node_name] || null : null;

        if (podMap[pod.name]) {
          await client.query(
            `UPDATE pods
             SET namespace_id = COALESCE($1, namespace_id),
                 node_id = $2,
                 kubernetes_uid = COALESCE($3, kubernetes_uid),
                 status = $4,
                 phase = $5,
                 restart_count = $6,
                 image = $7,
                 labels = $8,
                 updated_at = NOW()
             WHERE id = $9`,
            [
              nsId,
              nodeId,
              pod.kubernetes_uid || null,
              pod.status || 'Running',
              pod.phase || 'Running',
              pod.restart_count || 0,
              pod.image || '',
              JSON.stringify(pod.labels || {}),
              podMap[pod.name],
            ]
          );
        } else {
          await client.query(
            `INSERT INTO pods (cluster_id, namespace_id, node_id, name, kubernetes_uid, status, phase, restart_count, image, labels, started_at, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())`,
            [
              clusterId,
              nsId,
              nodeId,
              pod.name,
              pod.kubernetes_uid || null,
              pod.status || 'Running',
              pod.phase || 'Running',
              pod.restart_count || 0,
              pod.image || '',
              JSON.stringify(pod.labels || {}),
              pod.started_at ? new Date(pod.started_at) : null,
            ]
          );
        }
      }

      // Delete stale pods that are not in reportedPodNames
      if (reportedPodNames.size > 0) {
        const stalePods = existingPodsRes.rows.filter((p) => !reportedPodNames.has(p.name));
        for (const stale of stalePods) {
          await client.query('DELETE FROM pods WHERE id = $1', [stale.id]);
        }
      }

      // 4. Sync Services
      let syncedServicesCount = 0;
      if (Array.isArray(data.services) && data.services.length > 0) {
        const existingSvcRes = await client.query(
          'SELECT id, name, namespace_id FROM services WHERE cluster_id = $1',
          [clusterId]
        );
        const svcMap: Record<string, string> = {};
        for (const row of existingSvcRes.rows) {
          svcMap[`${row.namespace_id}/${row.name}`] = row.id;
        }

        for (const svc of data.services) {
          const nsId = namespaceMap[svc.namespace] || Object.values(namespaceMap)[0] || null;
          if (!nsId) continue;
          const key = `${nsId}/${svc.name}`;
          const clusterIp = svc.cluster_ip && svc.cluster_ip !== 'None' ? svc.cluster_ip : null;

          if (svcMap[key]) {
            await client.query(
              `UPDATE services
               SET kubernetes_uid = COALESCE($1, kubernetes_uid),
                   service_type = $2,
                   cluster_ip = $3,
                   ports = $4,
                   selector = $5,
                   status = $6,
                   updated_at = NOW()
               WHERE id = $7`,
              [
                svc.kubernetes_uid || null,
                svc.service_type || 'ClusterIP',
                clusterIp,
                JSON.stringify(svc.ports || []),
                JSON.stringify(svc.selector || {}),
                svc.status || 'Active',
                svcMap[key],
              ]
            );
          } else {
            const insSvc = await client.query(
              `INSERT INTO services (cluster_id, namespace_id, name, kubernetes_uid, service_type, cluster_ip, ports, selector, status, created_at, updated_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
               RETURNING id`,
              [
                clusterId,
                nsId,
                svc.name,
                svc.kubernetes_uid || null,
                svc.service_type || 'ClusterIP',
                clusterIp,
                JSON.stringify(svc.ports || []),
                JSON.stringify(svc.selector || {}),
                svc.status || 'Active',
              ]
            );
            if (insSvc.rows[0]) {
              svcMap[key] = insSvc.rows[0].id;
            }
          }
          syncedServicesCount++;
        }
      }

      // 5. Sync Workloads derived from pods and associate namespace_id
      const existingWlRes = await client.query(
        'SELECT id, name, namespace_id FROM workloads WHERE cluster_id = $1',
        [clusterId]
      );
      const workloadMapByName: Record<string, { id: string; namespace_id: string | null }> = {};
      for (const row of existingWlRes.rows) {
        workloadMapByName[row.name] = { id: row.id, namespace_id: row.namespace_id };
      }

      for (const pod of data.pods) {
        const nsId = namespaceMap[pod.namespace] || Object.values(namespaceMap)[0] || null;
        const wlName =
          pod.service_id ||
          pod.labels?.app ||
          pod.labels?.['app.kubernetes.io/name'] ||
          pod.name.replace(/-[a-z0-9]+-[a-z0-9]+$/, '');

        if (!wlName) continue;

        let wlInfo = workloadMapByName[wlName];
        if (wlInfo) {
          if (nsId && !wlInfo.namespace_id) {
            await client.query(
              'UPDATE workloads SET namespace_id = $1, updated_at = NOW() WHERE id = $2',
              [nsId, wlInfo.id]
            );
            wlInfo.namespace_id = nsId;
          }
        } else {
          const insWl = await client.query(
            `INSERT INTO workloads (cluster_id, namespace_id, name, workload_type, status, labels, created_at, updated_at)
             VALUES ($1, $2, $3, 'Deployment', 'HEALTHY', $4, NOW(), NOW())
             RETURNING id, namespace_id`,
            [clusterId, nsId, wlName, JSON.stringify(pod.labels || {})]
          );
          if (insWl.rows[0]) {
            wlInfo = { id: insWl.rows[0].id, namespace_id: insWl.rows[0].namespace_id };
            workloadMapByName[wlName] = wlInfo;
          }
        }

        if (wlInfo?.id) {
          await client.query(
            'UPDATE pods SET workload_id = $1 WHERE cluster_id = $2 AND name = $3',
            [wlInfo.id, clusterId, pod.name]
          );
        }
      }

      await client.query('COMMIT');
      console.log(`✅ [INVENTORY SYNC] Cluster ${clusterId}: Synced ${data.nodes.length} nodes, ${data.pods.length} pods, ${Object.keys(namespaceMap).length} namespaces.`);

      return {
        synced_nodes: data.nodes.length,
        synced_pods: data.pods.length,
      };
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('[AgentService] Error syncing cluster inventory:', err);
      throw err;
    } finally {
      client.release();
    }
  }
}
