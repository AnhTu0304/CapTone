import crypto from 'crypto';
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
import {
  AgentMetricsPayload,
  AgentLogPayload,
  AgentK8sEventPayload,
} from '../schemas/agentWebSocket.schema';

export interface AuthenticatedAgent {
  id: string;
  name: string;
  agent_uid: string;
  cluster_id: string | null;
  environment_id: string;
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
    }
  ) {
    // 1. Kiểm tra môi trường có tồn tại và thuộc tổ chức này không
    const env = await EnvironmentModel.findById(data.environment_id);
    if (!env || env.organization_id !== orgId) {
      throw ApiError.badRequest('Môi trường không tồn tại hoặc không thuộc tổ chức này');
    }

    // 2. Kiểm tra cluster nếu có truyền
    if (data.cluster_id) {
      const cluster = await ClusterModel.findByIdOrName(data.cluster_id);
      if (!cluster || cluster.environment_id !== env.id) {
        throw ApiError.badRequest('Cụm máy chủ (Cluster) không hợp lệ hoặc không thuộc môi trường này');
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
      cluster_id: data.cluster_id,
      version: data.version || 'v1.0.0',
      status: 'PENDING',
    });

    // 5. Tự động sinh Token kết nối bí mật ban đầu
    const rawToken = `ag_live_${crypto.randomBytes(24).toString('hex')}`;
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
      expires_at: expiresAt,
      created_by: userId,
    });

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
    });
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
    return revoked;
  }

  /**
   * Xóa Agent khỏi hệ thống
   */
  public static async deleteAgent(orgId: string, agentId: string) {
    const agent = await AgentModel.findById(agentId);
    if (!agent || agent.organization_id !== orgId) {
      throw ApiError.notFound('Agent không tồn tại hoặc không thuộc tổ chức của bạn');
    }

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

    const rawToken = `ag_live_${crypto.randomBytes(24).toString('hex')}`;
    const tokenPrefix = rawToken.slice(0, 12);
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    const days = expiresInDays !== undefined && expiresInDays !== null ? expiresInDays : 90;
    const expiresAt = days ? new Date(Date.now() + days * 24 * 60 * 60 * 1000) : null;

    const tokenRecord = await AgentModel.createToken({
      agent_id: agentId,
      token_hash: tokenHash,
      token_prefix: tokenPrefix,
      expires_at: expiresAt,
      created_by: userId,
    });

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
    return { success: true, message: 'Thu hồi Token thành công' };
  }

  /**
   * Xử lý nhịp tim trực tiếp từ Agent daemon (qua HTTP POST /agents/heartbeat)
   */
  public static async recordHeartbeatFromDaemon(
    rawToken: string,
    data: {
      latency_ms?: number | null;
      agent_version?: string | null;
      status?: any;
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

    const heartbeat = await AgentModel.recordHeartbeatDetailed(agentRow.id, {
      status: data.status || 'ONLINE',
      agent_version: data.agent_version || 'v1.0.0',
      latency_ms: data.latency_ms,
      metadata: data.metadata,
    });

    return {
      success: true,
      agent_id: agentRow.id,
      agent_name: agentRow.name,
      status: 'ONLINE',
      heartbeat_id: heartbeat.id,
      reported_at: heartbeat.reported_at,
    };
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
}

