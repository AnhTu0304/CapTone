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
   * Store Agent Metrics
   */
  public static async storeMetrics(
    agent: AuthenticatedAgent,
    data: AgentMetricsPayload
  ): Promise<{ id: number | string }> {
    const collectedAt = new Date(data.timestamp);

    const result = await MetricModel.create({
      agent_id: agent.id,
      cluster_id: agent.cluster_id,
      service_id: data.service_id,
      pod_id: data.pod_id,
      cpu: data.cpu,
      ram: data.ram,
      disk: data.disk,
      request_rate: data.request_rate,
      latency: data.latency,
      http_5xx_rate: data.http_5xx_rate,
      pod_restart_count: data.pod_restart_count,
      replica_count: data.replica_count,
      collected_at: collectedAt,
    });

    await AgentModel.touchLastSeen(agent.id);
    return result;
  }

  /**
   * Store Agent Logs
   */
  public static async storeLog(
    agent: AuthenticatedAgent,
    data: AgentLogPayload
  ): Promise<{ id: number | string }> {
    const occurredAt = new Date(data.timestamp);

    // Resolve workload_id by service_id if exists
    let workloadId: string | null = null;
    const workload = await WorkloadModel.findByName(data.service_id);
    if (workload) {
      workloadId = workload.id;
    }

    const result = await LogModel.create({
      cluster_id: agent.cluster_id,
      service_id: workloadId,
      level: data.level,
      message: data.message,
      source: 'k8s-agent',
      occurred_at: occurredAt,
      metadata: {
        service_id: data.service_id,
        pod_id: data.pod_id,
        agent_id: agent.id,
      },
    });

    await AgentModel.touchLastSeen(agent.id);
    return result;
  }

  /**
   * Store Kubernetes Events & Pod Status
   */
  public static async storeK8sEvent(
    agent: AuthenticatedAgent,
    data: AgentK8sEventPayload
  ): Promise<{ id: number | string }> {
    const eventTime = new Date(data.timestamp);

    const result = await KubernetesEventModel.create({
      cluster_id: agent.cluster_id,
      resource_type: 'Pod',
      resource_uid: data.pod_id,
      event_type: data.event.type,
      reason: data.event.reason,
      message: data.event.message,
      source_component: 'k8s-agent',
      first_seen_at: eventTime,
      last_seen_at: eventTime,
      count: 1,
      metadata: {
        service_id: data.service_id,
        pod_name: data.pod_name,
        pod_status: data.status,
        agent_id: agent.id,
      },
    });

    // Update pod status if tracked
    await KubernetesEventModel.updatePodStatus(
      data.pod_name,
      data.pod_id,
      agent.cluster_id,
      data.status
    );

    await AgentModel.touchLastSeen(agent.id);
    return result;
  }
}
