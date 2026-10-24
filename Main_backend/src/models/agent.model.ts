import { PoolClient } from 'pg';
import { pool } from '../config/database';

export type AgentStatus = 'PENDING' | 'ONLINE' | 'OFFLINE' | 'REVOKED';

export interface IAgent {
  id: string;
  environment_id: string;
  cluster_id: string | null;
  name: string;
  agent_uid: string;
  version: string | null;
  status: AgentStatus;
  last_seen_at?: Date | null;
  installed_at?: Date | null;
  revoked_at?: Date | null;
  created_at: Date;
  updated_at?: Date | null;
}

export interface IAgentDetail extends IAgent {
  environment_name?: string;
  environment_code?: string;
  environment_type?: string;
  organization_id?: string;
  cluster_name?: string | null;
  active_tokens_count?: number;
  last_latency_ms?: number | null;
}

export interface IAgentToken {
  id: string;
  agent_id: string;
  token_hash: string;
  token_prefix: string;
  expires_at?: Date | null;
  last_used_at?: Date | null;
  revoked_at?: Date | null;
  created_by?: string | null;
  created_at: Date;
}

export interface IAgentTokenInfo {
  id: string;
  agent_id: string;
  token_prefix: string;
  expires_at?: Date | null;
  last_used_at?: Date | null;
  revoked_at?: Date | null;
  created_by?: string | null;
  created_at: Date;
  is_active: boolean;
}

export interface IAgentHeartbeat {
  id: string;
  agent_id: string;
  status: AgentStatus;
  agent_version?: string | null;
  reported_at: Date;
  latency_ms?: number | null;
  metadata?: Record<string, unknown> | null;
}

export interface IAgentQueryFilter {
  organizationId?: string;
  environmentId?: string;
  clusterId?: string;
  status?: AgentStatus;
  search?: string;
  page?: number;
  limit?: number;
}

export class AgentModel {
  /**
   * 1. Tìm Agent hợp lệ qua hash của token (phục vụ WebSocket và HTTP auth)
   * (Giữ nguyên tương thích với code hiện tại)
   */
  public static async findByTokenHash(tokenHash: string, rawToken: string) {
    const cleanToken = rawToken ? rawToken.trim() : '';

    const result = await pool.query(
      `SELECT a.id, a.name, a.agent_uid, a.cluster_id, a.environment_id, a.status, t.id AS token_id
       FROM agent_tokens t
       JOIN agents a ON a.id = t.agent_id
       WHERE (t.token_hash = $1 OR t.token_hash = $2)
         AND (t.expires_at IS NULL OR t.expires_at > NOW())
         AND t.revoked_at IS NULL
         AND a.revoked_at IS NULL
         AND a.status != 'REVOKED'
       LIMIT 1`,
      [tokenHash, cleanToken]
    );
    return result.rows[0] || null;
  }

  /**
   * 2. Đánh dấu Agent ONLINE và cập nhật last_used của token
   * (Giữ nguyên tương thích với code hiện tại)
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

    try {
      const agentRes = await pool.query(
        `SELECT a.id, a.cluster_id, c.id AS actual_cluster_id, c.name AS cluster_name
         FROM agents a
         LEFT JOIN clusters c ON (c.id::text = a.cluster_id::text OR c.cluster_uid = a.cluster_id::text)
         WHERE a.id = $1`,
        [agentId]
      );
      const cluster = agentRes.rows[0];
      if (cluster?.actual_cluster_id) {
        const { ClusterModel } = await import('./cluster.model');
        await ClusterModel.seedClusterResources(cluster.actual_cluster_id, cluster.cluster_name || 'k8s-cluster', pool);
      }
    } catch (e) {
      console.warn('Auto-seed cluster on agent online failed gracefully:', e);
    }
  }

  /**
   * 3. Đánh dấu Agent OFFLINE khi ngắt kết nối
   * (Giữ nguyên tương thích với code hiện tại)
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
   * 4. Cập nhật last_seen_at khi nhận dữ liệu viễn trắc
   * (Giữ nguyên tương thích với code hiện tại)
   */
  public static async touchLastSeen(agentId: string) {
    await pool.query('UPDATE agents SET last_seen_at = NOW() WHERE id = $1', [agentId]);
  }

  /**
   * 5. Ghi nhận nhịp tim cơ bản
   * (Giữ nguyên tương thích với code hiện tại)
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

  /**
   * 6. Danh sách tất cả agent cho Telemetry Aggregator
   * (Giữ nguyên tương thích với code hiện tại)
   */
  public static async listAll() {
    const result = await pool.query(
      `SELECT id, name, agent_uid, cluster_id, status, last_seen_at
       FROM agents
       ORDER BY last_seen_at DESC`
    );
    return result.rows;
  }

  /* =========================================================================
     CÁC PHƯƠNG THỨC QUẢN LÝ AGENT (CRUD & QUẢN TRỊ HẠ TẦNG)
     ========================================================================= */

  /**
   * Tạo mới Agent
   */
  public static async create(
    data: {
      name: string;
      agent_uid: string;
      environment_id: string;
      cluster_id?: string | null;
      version?: string | null;
      status?: AgentStatus;
    },
    client?: PoolClient
  ): Promise<IAgent> {
    const db = client || pool;
    const query = `
      INSERT INTO agents (
        name, agent_uid, environment_id, cluster_id, version, status, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, NOW(), NOW()
      ) RETURNING *;
    `;
    const values = [
      data.name.trim(),
      data.agent_uid.trim(),
      data.environment_id,
      data.cluster_id || null,
      data.version || 'v1.0.0',
      data.status || 'PENDING',
    ];
    const res = await db.query<IAgent>(query, values);
    return res.rows[0];
  }

  /**
   * Tìm Agent theo ID (kèm thông tin Environment, Cluster & Token count)
   */
  public static async findById(id: string, client?: PoolClient): Promise<IAgentDetail | null> {
    const db = client || pool;
    const query = `
      SELECT 
        a.*,
        e.name AS environment_name,
        e.code AS environment_code,
        e.environment_type AS environment_type,
        e.organization_id AS organization_id,
        c.name AS cluster_name,
        (
          SELECT COUNT(*)::int 
          FROM agent_tokens t 
          WHERE t.agent_id = a.id AND t.revoked_at IS NULL AND (t.expires_at IS NULL OR t.expires_at > NOW())
        ) AS active_tokens_count,
        (
          SELECT h.latency_ms 
          FROM agent_heartbeats h 
          WHERE h.agent_id = a.id 
          ORDER BY h.reported_at DESC 
          LIMIT 1
        ) AS last_latency_ms
      FROM agents a
      JOIN environments e ON a.environment_id = e.id
      LEFT JOIN clusters c ON a.cluster_id::text = c.id::text
      WHERE a.id = $1
      LIMIT 1;
    `;
    const res = await db.query<IAgentDetail>(query, [id]);
    return res.rows[0] || null;
  }

  /**
   * Tìm Agent theo Agent UID
   */
  public static async findByUid(agentUid: string, client?: PoolClient): Promise<IAgent | null> {
    const db = client || pool;
    const query = 'SELECT * FROM agents WHERE agent_uid = $1 LIMIT 1;';
    const res = await db.query<IAgent>(query, [agentUid.trim()]);
    return res.rows[0] || null;
  }

  /**
   * Lấy danh sách Agent theo bộ lọc phân trang
   */
  public static async findMany(
    filter: IAgentQueryFilter,
    client?: PoolClient
  ): Promise<{ items: IAgentDetail[]; total: number; page: number; limit: number; totalPages: number }> {
    const db = client || pool;
    const page = Math.max(1, filter.page || 1);
    const limit = Math.max(1, Math.min(100, filter.limit || 20));
    const offset = (page - 1) * limit;

    const conditions: string[] = ['1=1'];
    const params: any[] = [];
    let idx = 1;

    if (filter.organizationId) {
      conditions.push(`e.organization_id = $${idx++}`);
      params.push(filter.organizationId);
    }

    if (filter.environmentId) {
      conditions.push(`a.environment_id = $${idx++}`);
      params.push(filter.environmentId);
    }

    if (filter.clusterId) {
      conditions.push(`a.cluster_id = $${idx++}`);
      params.push(filter.clusterId);
    }

    if (filter.status) {
      conditions.push(`a.status = $${idx++}`);
      params.push(filter.status);
    }

    if (filter.search && filter.search.trim() !== '') {
      conditions.push(`(a.name ILIKE $${idx} OR a.agent_uid ILIKE $${idx})`);
      params.push(`%${filter.search.trim()}%`);
      idx++;
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    // Đếm tổng số
    const countQuery = `
      SELECT COUNT(*)::int AS total
      FROM agents a
      JOIN environments e ON a.environment_id = e.id
      ${whereClause};
    `;
    const countRes = await db.query<{ total: number }>(countQuery, params);
    const total = countRes.rows[0]?.total || 0;

    // Lấy dữ liệu chi tiết
    const dataQuery = `
      SELECT 
        a.*,
        e.name AS environment_name,
        e.code AS environment_code,
        e.environment_type AS environment_type,
        e.organization_id AS organization_id,
        c.name AS cluster_name,
        (
          SELECT COUNT(*)::int 
          FROM agent_tokens t 
          WHERE t.agent_id = a.id AND t.revoked_at IS NULL AND (t.expires_at IS NULL OR t.expires_at > NOW())
        ) AS active_tokens_count,
        (
          SELECT h.latency_ms 
          FROM agent_heartbeats h 
          WHERE h.agent_id = a.id 
          ORDER BY h.reported_at DESC 
          LIMIT 1
        ) AS last_latency_ms
      FROM agents a
      JOIN environments e ON a.environment_id = e.id
      LEFT JOIN clusters c ON a.cluster_id::text = c.id::text
      ${whereClause}
      ORDER BY 
        CASE 
          WHEN a.status = 'ONLINE' THEN 1
          WHEN a.status = 'PENDING' THEN 2
          WHEN a.status = 'OFFLINE' THEN 3
          ELSE 4
        END ASC,
        a.created_at DESC
      LIMIT $${idx} OFFSET $${idx + 1};
    `;
    params.push(limit, offset);
    const res = await db.query<IAgentDetail>(dataQuery, params);

    return {
      items: res.rows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Cập nhật thông tin Agent
   */
  public static async update(
    id: string,
    data: { name?: string; cluster_id?: string | null; version?: string },
    client?: PoolClient
  ): Promise<IAgent | null> {
    const db = client || pool;
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (data.name !== undefined) {
      fields.push(`name = $${idx++}`);
      values.push(data.name.trim());
    }
    if (data.cluster_id !== undefined) {
      fields.push(`cluster_id = $${idx++}`);
      values.push(data.cluster_id);
    }
    if (data.version !== undefined) {
      fields.push(`version = $${idx++}`);
      values.push(data.version.trim());
    }

    if (fields.length === 0) {
      const res = await db.query<IAgent>('SELECT * FROM agents WHERE id = $1;', [id]);
      return res.rows[0] || null;
    }

    fields.push('updated_at = NOW()');
    values.push(id);

    const query = `
      UPDATE agents
      SET ${fields.join(', ')}
      WHERE id = $${idx}
      RETURNING *;
    `;
    const res = await db.query<IAgent>(query, values);
    return res.rows[0] || null;
  }

  /**
   * Thu hồi Agent (Đổi status sang REVOKED)
   */
  public static async revoke(id: string, client?: PoolClient): Promise<IAgent | null> {
    const db = client || pool;
    const query = `
      UPDATE agents
      SET status = 'REVOKED', revoked_at = NOW(), updated_at = NOW()
      WHERE id = $1
      RETURNING *;
    `;
    const res = await db.query<IAgent>(query, [id]);
    return res.rows[0] || null;
  }

  /**
   * Xóa Agent khỏi hệ thống
   */
  public static async delete(id: string, client?: PoolClient): Promise<boolean> {
    const db = client || pool;
    const res = await db.query('DELETE FROM agents WHERE id = $1;', [id]);
    return (res.rowCount || 0) > 0;
  }

  /* =========================================================================
     CÁC PHƯƠNG THỨC QUẢN LÝ AGENT TOKENS
     ========================================================================= */

  /**
   * Tạo Token mới cho Agent
   */
  public static async createToken(
    data: {
      agent_id: string;
      token_hash: string;
      token_prefix?: string;
      expires_at?: Date | null;
      created_by?: string | null;
    },
    client?: PoolClient
  ): Promise<IAgentToken> {
    const db = client || pool;
    const query = `
      INSERT INTO agent_tokens (
        agent_id, token_hash, token_prefix, created_by, expires_at, created_at
      ) VALUES (
        $1, $2, $3, $4, $5, NOW()
      ) RETURNING *;
    `;
    const values = [
      data.agent_id,
      data.token_hash,
      data.token_prefix || null,
      data.created_by || null,
      data.expires_at || null,
    ];
    const res = await db.query<IAgentToken>(query, values);
    return res.rows[0];
  }

  /**
   * Lấy danh sách Token của một Agent (không lộ token_hash)
   */
  public static async findTokensByAgentId(agentId: string, client?: PoolClient): Promise<IAgentTokenInfo[]> {
    const db = client || pool;
    const query = `
      SELECT 
        id, agent_id, token_prefix, expires_at, last_used_at, revoked_at, created_at,
        (revoked_at IS NULL AND (expires_at IS NULL OR expires_at > NOW())) AS is_active
      FROM agent_tokens
      WHERE agent_id = $1
      ORDER BY created_at DESC;
    `;
    const res = await db.query<IAgentTokenInfo>(query, [agentId]);
    return res.rows;
  }

  /**
   * Thu hồi một Token cụ thể
   */
  public static async revokeToken(tokenId: string, agentId?: string, client?: PoolClient): Promise<boolean> {
    const db = client || pool;
    let query = 'UPDATE agent_tokens SET revoked_at = NOW() WHERE id = $1';
    const params: any[] = [tokenId];
    if (agentId) {
      query += ' AND agent_id = $2';
      params.push(agentId);
    }
    const res = await db.query(query, params);
    return (res.rowCount || 0) > 0;
  }

  /**
   * Thu hồi toàn bộ Token của một Agent
   */
  public static async revokeAllTokensByAgentId(agentId: string, client?: PoolClient): Promise<number> {
    const db = client || pool;
    const res = await db.query(
      'UPDATE agent_tokens SET revoked_at = NOW() WHERE agent_id = $1 AND revoked_at IS NULL;',
      [agentId]
    );
    return res.rowCount || 0;
  }

  /* =========================================================================
     CÁC PHƯƠNG THỨC QUẢN LÝ AGENT HEARTBEATS
     ========================================================================= */

  /**
   * Ghi nhận Heartbeat chi tiết từ Agent daemon
   */
  public static async recordHeartbeatDetailed(
    agentId: string,
    data: {
      status?: AgentStatus;
      agent_version?: string | null;
      latency_ms?: number | null;
      metadata?: Record<string, unknown> | null;
    },
    client?: PoolClient
  ): Promise<IAgentHeartbeat> {
    const db = client || pool;
    const query = `
      INSERT INTO agent_heartbeats (
        agent_id, status, agent_version, latency_ms, metadata, reported_at
      ) VALUES (
        $1, $2, $3, $4, $5, NOW()
      ) RETURNING *;
    `;
    const values = [
      agentId,
      data.status || 'ONLINE',
      data.agent_version || null,
      data.latency_ms !== undefined ? data.latency_ms : null,
      data.metadata ? JSON.stringify(data.metadata) : null,
    ];
    const res = await db.query<IAgentHeartbeat>(query, values);

    // Đồng thời cập nhật trạng thái Agent sang ONLINE & last_seen_at = NOW()
    await db.query(
      `UPDATE agents 
       SET status = 'ONLINE', last_seen_at = NOW(), updated_at = NOW() 
       WHERE id = $1 AND status != 'REVOKED';`,
      [agentId]
    );

    return res.rows[0];
  }

  /**
   * Lấy lịch sử Heartbeat của một Agent
   */
  public static async getHeartbeatHistory(
    agentId: string,
    limit: number = 50,
    client?: PoolClient
  ): Promise<IAgentHeartbeat[]> {
    const db = client || pool;
    const safeLimit = Math.max(1, Math.min(200, limit));
    const query = `
      SELECT id, agent_id, status, agent_version, reported_at, latency_ms, metadata
      FROM agent_heartbeats
      WHERE agent_id = $1
      ORDER BY reported_at DESC
      LIMIT $2;
    `;
    const res = await db.query<IAgentHeartbeat>(query, [agentId, safeLimit]);
    return res.rows;
  }
}
