import crypto from 'crypto';
import {
  AgentModel,
  MetricModel,
  LogModel,
  KubernetesEventModel,
  WorkloadModel,
} from '../models';
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
}
