import { AgentModel } from '../models/agent.model';
import { AuditService } from './audit.service';

export interface IAgentTimeoutCheckResult {
  checked_at: Date;
  timeout_threshold_seconds: number;
  stale_agents_count: number;
  stale_agents: Array<{
    id: string;
    name: string;
    agent_uid: string;
    cluster_id: string | null;
    environment_id: string;
    status: string;
    previous_status: string;
    organization_id?: string | null;
    last_seen_at?: Date | null;
  }>;
}

export class AgentTimeoutService {
  /**
   * Lấy cấu hình ngưỡng timeout không nhận được heartbeat (mặc định 45s = 3 chu kỳ x 15s)
   */
  public static getTimeoutThresholdSeconds(): number {
    const envVal = process.env.AGENT_HEARTBEAT_TIMEOUT_SECONDS;
    if (envVal) {
      const parsed = parseInt(envVal, 10);
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
    return 45;
  }

  /**
   * Lấy chu kỳ chạy scheduler kiểm tra (mặc định 15s)
   */
  public static getCheckIntervalSeconds(): number {
    const envVal = process.env.AGENT_STATUS_CHECK_INTERVAL_SECONDS;
    if (envVal) {
      const parsed = parseInt(envVal, 10);
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
    return 15;
  }

  /**
   * Quét và chuyển trạng thái các Agent ONLINE đã quá hạn sang OFFLINE,
   * đồng thời ghi nhận audit log trạng thái cho từng Agent bị ảnh hưởng.
   */
  public static async checkAndMarkStaleAgents(timeoutSeconds?: number): Promise<IAgentTimeoutCheckResult> {
    const threshold = timeoutSeconds !== undefined ? timeoutSeconds : this.getTimeoutThresholdSeconds();

    const staleAgents = await AgentModel.markStaleAgentsOffline(threshold);

    for (const agent of staleAgents) {
      try {
        await AuditService.record({
          organization_id: (agent as any).organization_id || null,
          actor_type: 'SYSTEM',
          action: 'AGENT_DISCONNECTED',
          reason_code: 'HEARTBEAT_TIMEOUT',
          target_type: 'AGENT',
          target_id: agent.id,
          resource_type: 'AGENT',
          resource_id: agent.id,
          status: 'SUCCESS',
          description: `Agent '${agent.name}' timed out after missing heartbeats (> ${threshold}s). Status transitioned from ONLINE to OFFLINE.`,
          before_data: { status: 'ONLINE', last_seen_at: agent.last_seen_at },
          after_data: { status: 'OFFLINE' },
        });
      } catch (err) {
        console.warn(`[AgentTimeoutService] Failed to record audit log for agent ${agent.id}:`, err);
      }
    }

    return {
      checked_at: new Date(),
      timeout_threshold_seconds: threshold,
      stale_agents_count: staleAgents.length,
      stale_agents: staleAgents as any,
    };
  }
}
