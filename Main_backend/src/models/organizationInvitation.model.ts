import { PoolClient } from 'pg';
import { pool } from '../config/database';

export type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED';

export interface IOrganizationInvitation {
  id: string;
  organization_id: string;
  email: string;
  role_id: string;
  invited_by?: string | null;
  token_hash: string;
  status: InvitationStatus;
  expires_at: Date;
  accepted_at?: Date | null;
  accepted_by?: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface IOrganizationInvitationDetail {
  id: string;
  organization_id: string;
  organization_name: string;
  email: string;
  role: {
    id: string;
    code: string;
    name: string;
    description?: string | null;
  };
  invited_by?: {
    id: string;
    full_name: string;
    email: string;
  } | null;
  status: InvitationStatus;
  expires_at: Date;
  accepted_at?: Date | null;
  created_at: Date;
}

export interface IInvitationQuery {
  page?: number;
  limit?: number;
  status?: InvitationStatus;
  search?: string;
}

export class OrganizationInvitationModel {
  /**
   * Tạo bản ghi lời mời mới vào bảng organization_invitations
   */
  public static async create(
    client: PoolClient | undefined,
    data: {
      organization_id: string;
      email: string;
      role_id: string;
      invited_by?: string | null;
      token_hash: string;
      expires_at: Date;
    }
  ): Promise<IOrganizationInvitation> {
    const db = client || pool;
    const query = `
      INSERT INTO organization_invitations (
        organization_id, email, role_id, invited_by, token_hash, expires_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6
      ) RETURNING *;
    `;
    const res = await db.query<IOrganizationInvitation>(query, [
      data.organization_id,
      data.email.trim().toLowerCase(),
      data.role_id,
      data.invited_by || null,
      data.token_hash,
      data.expires_at,
    ]);
    return res.rows[0];
  }

  /**
   * Tìm lời mời đang PENDING theo email và tổ chức
   */
  public static async findPendingByEmailAndOrg(
    email: string,
    organizationId: string,
    client?: PoolClient
  ): Promise<IOrganizationInvitation | null> {
    const db = client || pool;
    const query = `
      SELECT * FROM organization_invitations 
      WHERE LOWER(email) = LOWER($1) 
        AND organization_id = $2 
        AND status = 'PENDING' 
        AND expires_at > NOW()
      LIMIT 1;
    `;
    const res = await db.query<IOrganizationInvitation>(query, [email.trim(), organizationId]);
    return res.rows[0] || null;
  }

  /**
   * Tìm lời mời theo token_hash (kèm thông tin tổ chức và vai trò)
   */
  public static async findByTokenHash(
    tokenHash: string,
    client?: PoolClient
  ): Promise<
    | (IOrganizationInvitation & {
        org_name: string;
        org_status: string;
        org_deleted_at: Date | null;
        role_code: string;
        role_name: string;
      })
    | null
  > {
    const db = client || pool;
    const query = `
      SELECT 
        oi.*,
        o.name AS org_name,
        o.status AS org_status,
        o.deleted_at AS org_deleted_at,
        r.code AS role_code,
        r.name AS role_name
      FROM organization_invitations oi
      JOIN organizations o ON oi.organization_id = o.id
      JOIN roles r ON oi.role_id = r.id
      WHERE oi.token_hash = $1
      LIMIT 1;
    `;
    const res = await db.query(query, [tokenHash]);
    return res.rows[0] || null;
  }

  /**
   * Tìm chi tiết lời mời theo ID và tổ chức
   */
  public static async findByIdAndOrg(
    id: string,
    organizationId: string,
    client?: PoolClient
  ): Promise<IOrganizationInvitationDetail | null> {
    const db = client || pool;
    const query = `
      SELECT 
        oi.id, oi.organization_id, oi.email, oi.status, oi.expires_at, oi.accepted_at, oi.created_at,
        o.name AS organization_name,
        r.id AS role_id, r.code AS role_code, r.name AS role_name, r.description AS role_description,
        inv.id AS inviter_id, inv.full_name AS inviter_full_name, inv.email AS inviter_email
      FROM organization_invitations oi
      JOIN organizations o ON oi.organization_id = o.id
      JOIN roles r ON oi.role_id = r.id
      LEFT JOIN users inv ON oi.invited_by = inv.id
      WHERE oi.id = $1 AND oi.organization_id = $2
      LIMIT 1;
    `;
    const res = await db.query(query, [id, organizationId]);
    if (res.rows.length === 0) return null;
    const row = res.rows[0];
    return {
      id: row.id,
      organization_id: row.organization_id,
      organization_name: row.organization_name,
      email: row.email,
      role: {
        id: row.role_id,
        code: row.role_code,
        name: row.role_name,
        description: row.role_description,
      },
      invited_by: row.inviter_id
        ? {
            id: row.inviter_id,
            full_name: row.inviter_full_name,
            email: row.inviter_email,
          }
        : null,
      status: row.status,
      expires_at: row.expires_at,
      accepted_at: row.accepted_at,
      created_at: row.created_at,
    };
  }

  /**
   * Cập nhật trạng thái ACCEPTED nguyên tử (Atomic Handshake)
   * Chống race condition khi 2 request cùng cố gắng accept cùng lúc
   */
  public static async acceptAtomic(
    invitationId: string,
    userId: string,
    client?: PoolClient
  ): Promise<IOrganizationInvitation | null> {
    const db = client || pool;
    const query = `
      UPDATE organization_invitations
      SET status = 'ACCEPTED', accepted_at = NOW(), accepted_by = $1, updated_at = NOW()
      WHERE id = $2 AND status = 'PENDING' AND expires_at > NOW()
      RETURNING *;
    `;
    const res = await db.query<IOrganizationInvitation>(query, [userId, invitationId]);
    return res.rows[0] || null;
  }

  /**
   * Thu hồi lời mời (Revoke)
   */
  public static async revoke(
    invitationId: string,
    organizationId: string,
    client?: PoolClient
  ): Promise<IOrganizationInvitation | null> {
    const db = client || pool;
    const query = `
      UPDATE organization_invitations
      SET status = 'REVOKED', updated_at = NOW()
      WHERE id = $1 AND organization_id = $2 AND status = 'PENDING'
      RETURNING *;
    `;
    const res = await db.query<IOrganizationInvitation>(query, [invitationId, organizationId]);
    return res.rows[0] || null;
  }

  /**
   * Gửi lại lời mời (Cập nhật token mới và gia hạn thời gian)
   */
  public static async resend(
    invitationId: string,
    organizationId: string,
    newTokenHash: string,
    newExpiresAt: Date,
    client?: PoolClient
  ): Promise<IOrganizationInvitation | null> {
    const db = client || pool;
    const query = `
      UPDATE organization_invitations
      SET token_hash = $3, expires_at = $4, status = 'PENDING', updated_at = NOW()
      WHERE id = $1 AND organization_id = $2 AND (status = 'PENDING' OR status = 'EXPIRED')
      RETURNING *;
    `;
    const res = await db.query<IOrganizationInvitation>(query, [
      invitationId,
      organizationId,
      newTokenHash,
      newExpiresAt,
    ]);
    return res.rows[0] || null;
  }

  /**
   * Lấy danh sách lời mời của tổ chức có phân trang và bộ lọc
   */
  public static async findManyByOrg(
    organizationId: string,
    filter: { status?: InvitationStatus; search?: string; limit: number; offset: number },
    client?: PoolClient
  ): Promise<IOrganizationInvitationDetail[]> {
    const db = client || pool;
    const conditions: string[] = ['oi.organization_id = $1'];
    const params: any[] = [organizationId];
    let paramIndex = 2;

    if (filter.status) {
      conditions.push(`oi.status = $${paramIndex++}`);
      params.push(filter.status);
    }

    if (filter.search && filter.search.trim() !== '') {
      conditions.push(`oi.email ILIKE $${paramIndex++}`);
      params.push(`%${filter.search.trim()}%`);
    }

    const query = `
      SELECT 
        oi.id, oi.organization_id, oi.email, oi.status, oi.expires_at, oi.accepted_at, oi.created_at,
        o.name AS organization_name,
        r.id AS role_id, r.code AS role_code, r.name AS role_name, r.description AS role_description,
        inv.id AS inviter_id, inv.full_name AS inviter_full_name, inv.email AS inviter_email
      FROM organization_invitations oi
      JOIN organizations o ON oi.organization_id = o.id
      JOIN roles r ON oi.role_id = r.id
      LEFT JOIN users inv ON oi.invited_by = inv.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY oi.created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++};
    `;

    params.push(filter.limit, filter.offset);
    const res = await db.query(query, params);

    return res.rows.map((row) => ({
      id: row.id,
      organization_id: row.organization_id,
      organization_name: row.organization_name,
      email: row.email,
      role: {
        id: row.role_id,
        code: row.role_code,
        name: row.role_name,
        description: row.role_description,
      },
      invited_by: row.inviter_id
        ? {
            id: row.inviter_id,
            full_name: row.inviter_full_name,
            email: row.inviter_email,
          }
        : null,
      status: row.status,
      expires_at: row.expires_at,
      accepted_at: row.accepted_at,
      created_at: row.created_at,
    }));
  }

  /**
   * Đếm tổng số lời mời theo bộ lọc
   */
  public static async countByOrg(
    organizationId: string,
    filter: { status?: InvitationStatus; search?: string },
    client?: PoolClient
  ): Promise<number> {
    const db = client || pool;
    const conditions: string[] = ['oi.organization_id = $1'];
    const params: any[] = [organizationId];
    let paramIndex = 2;

    if (filter.status) {
      conditions.push(`oi.status = $${paramIndex++}`);
      params.push(filter.status);
    }

    if (filter.search && filter.search.trim() !== '') {
      conditions.push(`oi.email ILIKE $${paramIndex++}`);
      params.push(`%${filter.search.trim()}%`);
    }

    const query = `
      SELECT COUNT(*)::int AS total
      FROM organization_invitations oi
      WHERE ${conditions.join(' AND ')};
    `;
    const res = await db.query<{ total: number }>(query, params);
    return res.rows[0]?.total || 0;
  }
}
