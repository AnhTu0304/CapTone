import { pool } from '../config/database';

export interface IAgent {
  id: string;
  name: string;
  agent_uid: string;
  cluster_id: string | null;
  environment_id: string;
  status: string;
  last_seen_at?: Date;
  created_at: Date;
  updated_at?: Date;
}

export interface IAgentToken {
  id: string;
  agent_id: string;
  token_hash: string;
  expires_at?: Date;
  revoked_at?: Date;
  last_used_at?: Date;
  created_at: Date;
}

export interface IAgentHeartbeat {
  id: string;
  agent_id: string;
  status: string;
  agent_version?: string;
  reported_at: Date;
  metadata?: Record<string, unknown>;
}

export class AgentModel {
  /**
   * Find valid agent by token hash
   */
  public static async findByTokenHash(tokenHash: string, rawToken: string) {
    const result = await pool.query(
      `SELECT a.id, a.name, a.agent_uid, a.cluster_id, a.environment_id, a.status, t.id AS token_id
       FROM agent_tokens t
       JOIN agents a ON a.id = t.agent_id
       WHERE (t.token_hash = $1 OR t.token_hash = $2)
         AND (t.expires_at IS NULL OR t.expires_at > NOW())
         AND t.revoked_at IS NULL
         AND a.revoked_at IS NULL
       LIMIT 1`,
      [tokenHash, rawToken.trim()]
    );
    return result.rows[0] || null;
  }

  /**
   * Mark agent online and update token last_used
   */
  public static async setOnline(agentId: string, tokenId: string) {
    await pool.query(
      `UPDATE agents
       SET status = 'ONLINE', last_seen_at = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [agentId]
    );

    await pool.query(
      `UPDATE agent_tokens
       SET last_used_at = NOW()
       WHERE id = $1`,
      [tokenId]
    );
  }

  /**
   * Mark agent offline on disconnect
   */
  public static async setOffline(agentId: string) {
    await pool.query(
      `UPDATE agents
       SET status = 'OFFLINE', last_seen_at = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [agentId]
    );
  }

  /**
   * Update agent last_seen_at
   */
  public static async touchLastSeen(agentId: string) {
    await pool.query('UPDATE agents SET last_seen_at = NOW() WHERE id = $1', [agentId]);
  }

  /**
   * Record connection/heartbeat event
   */
  public static async recordHeartbeat(
    agentId: string,
    status: string,
    metadata?: Record<string, unknown>,
    version: string = '1.0.0'
  ) {
    await pool.query(
      `INSERT INTO agent_heartbeats (
        agent_id, status, agent_version, reported_at, metadata
      ) VALUES (
        $1, $2, $3, NOW(), $4
      )`,
      [agentId, status, version, metadata ? JSON.stringify(metadata) : null]
    );
  }
}
