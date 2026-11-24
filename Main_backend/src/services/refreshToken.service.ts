import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { pool } from '../config/database';
import { config } from '../config/env';
import { ApiError } from '../utils/apiError';
import { AuditService } from './audit.service';
import { UserModel } from '../models/user.model';
import { disconnectUserTelemetrySessions } from '../websocket/telemetryWebSocket';

export const GENERIC_REFRESH_ERROR = 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại.';

const RAW_TOKEN_FORMAT_RE = /^[A-Za-z0-9_-]{20,256}$/;

export interface IRefreshSessionMeta {
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface IIssuedSession {
  sessionId: string;
  familyId: string;
  rawRefreshToken: string;
  csrfToken: string;
  expiresAt: Date;
}

export interface IRotatedSession {
  userId: string;
  email: string;
  status: string;
  roles: string[];
  accessToken: string;
  rawRefreshToken: string;
  csrfToken: string;
  sessionId: string;
  familyId: string;
}

export class RefreshTokenService {
  /**
   * Hash raw refresh token with HMAC-SHA256 using dedicated pepper.
   * Raw refresh tokens are NEVER persisted in PostgreSQL or emitted in logs.
   */
  public static hashToken(rawToken: string): string {
    return crypto
      .createHmac('sha256', config.refreshToken.pepper)
      .update(rawToken.trim())
      .digest('hex');
  }

  public static generateRawToken(): string {
    return crypto.randomBytes(32).toString('base64url');
  }

  public static generateCsrfToken(): string {
    return crypto.randomBytes(24).toString('base64url');
  }

  public static signAccessToken(
    user: { id: string; email: string; status: any; token_version?: number },
    roles: string[] = [],
    sessionId?: string
  ): string {
    return jwt.sign(
      {
        id: user.id,
        email: user.email,
        status: user.status,
        roles,
        typ: 'access',
        jti: crypto.randomUUID(),
        sid: sessionId,
        tv: user.token_version ?? 1,
      },
      config.jwt.secret,
      {
        expiresIn: config.jwt.accessExpiresIn,
        algorithm: 'HS256',
      } as jwt.SignOptions
    );
  }

  /**
   * Create a new session family and initial hashed refresh token atomically.
   */
  public static async createSession(
    userId: string,
    meta: IRefreshSessionMeta = {}
  ): Promise<IIssuedSession> {
    const rawRefreshToken = this.generateRawToken();
    const csrfToken = this.generateCsrfToken();
    const tokenHash = this.hashToken(rawRefreshToken);

    const ttlMs = config.refreshToken.ttlDays * 24 * 60 * 60 * 1000;
    const maxLifeMs = config.refreshToken.maxLifetimeDays * 24 * 60 * 60 * 1000;
    const tokenExpiresAt = new Date(Date.now() + ttlMs);
    const sessionExpiresAt = new Date(Date.now() + Math.max(ttlMs, maxLifeMs));

    const cleanIp = meta.ipAddress ? String(meta.ipAddress).replace(/^::ffff:/, '').slice(0, 45) : null;
    const cleanUa = meta.userAgent ? String(meta.userAgent).slice(0, 512) : null;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const sessRes = await client.query(
        `INSERT INTO user_sessions (user_id, ip_address, user_agent, expires_at, created_at, last_used_at)
         VALUES ($1, $2::inet, $3, $4, NOW(), NOW())
         RETURNING id, family_id;`,
        [userId, cleanIp, cleanUa, sessionExpiresAt]
      );
      const { id: sessionId, family_id: familyId } = sessRes.rows[0];

      await client.query(
        `INSERT INTO refresh_tokens (session_id, family_id, token_hash, issued_at, expires_at)
         VALUES ($1, $2, $3, NOW(), $4);`,
        [sessionId, familyId, tokenHash, tokenExpiresAt]
      );

      await client.query('COMMIT');
      return { sessionId, familyId, rawRefreshToken, csrfToken, expiresAt: tokenExpiresAt };
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Atomically rotate a presented refresh token inside a row-locked transaction.
   * - Single-use: concurrent calls serialize via FOR UPDATE; second call detects reuse & revokes family.
   * - Never leaks DB token existence in error messages or logs.
   */
  public static async rotateRefreshToken(
    rawToken: string,
    meta: IRefreshSessionMeta = {}
  ): Promise<IRotatedSession> {
    if (!rawToken || typeof rawToken !== 'string' || !RAW_TOKEN_FORMAT_RE.test(rawToken.trim())) {
      throw new ApiError(401, GENERIC_REFRESH_ERROR);
    }

    const tokenHash = this.hashToken(rawToken);
    const cleanIp = meta.ipAddress ? String(meta.ipAddress).replace(/^::ffff:/, '').slice(0, 45) : null;
    const cleanUa = meta.userAgent ? String(meta.userAgent).slice(0, 512) : null;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const lockRes = await client.query(
        `SELECT
           rt.id AS token_id,
           rt.session_id,
           rt.family_id,
           rt.expires_at AS token_expires_at,
           rt.used_at,
           rt.revoked_at AS token_revoked_at,
           us.user_id,
           us.expires_at AS session_expires_at,
           us.revoked_at AS session_revoked_at,
           u.email,
           u.status AS user_status,
           u.deleted_at AS user_deleted_at,
           u.token_version
         FROM refresh_tokens rt
         JOIN user_sessions us ON us.id = rt.session_id
         JOIN users u ON u.id = us.user_id
         WHERE rt.token_hash = $1
         FOR UPDATE OF rt, us;`,
        [tokenHash]
      );

      if (lockRes.rows.length === 0) {
        await client.query('ROLLBACK');
        throw new ApiError(401, GENERIC_REFRESH_ERROR);
      }

      const row = lockRes.rows[0];
      const now = Date.now();

      // Reuse detection: token already used or revoked -> revoke entire family immediately
      if (row.used_at !== null || row.token_revoked_at !== null || row.session_revoked_at !== null) {
        await client.query(
          `UPDATE refresh_tokens
           SET reuse_detected_at = CASE WHEN id = $2 THEN COALESCE(reuse_detected_at, NOW()) ELSE reuse_detected_at END,
               revoked_at = COALESCE(revoked_at, NOW())
           WHERE family_id = $1;`,
          [row.family_id, row.token_id]
        );
        await client.query(
          `UPDATE user_sessions
           SET revoked_at = COALESCE(revoked_at, NOW()),
               revoked_reason = COALESCE(revoked_reason, 'TOKEN_REUSE_DETECTED')
           WHERE family_id = $1;`,
          [row.family_id]
        );
        await client.query('COMMIT');

        AuditService.record({
          user_id: row.user_id,
          actor_type: 'SYSTEM',
          action: 'AUTH_REFRESH_REUSE_DETECTED',
          resource_type: 'USER_SESSION',
          resource_id: row.session_id,
          status: 'DENIED',
          reason_code: 'REFRESH_TOKEN_REUSE',
          description: 'Phát hiện tái sử dụng refresh token đã xoay vòng; toàn bộ token family đã bị thu hồi',
          metadata: {
            session_id: row.session_id,
            family_id: row.family_id,
          },
        }).catch(() => {});

        throw new ApiError(401, GENERIC_REFRESH_ERROR);
      }

      // Expiry or inactive/deleted user check
      const tokenExpired = new Date(row.token_expires_at).getTime() <= now;
      const sessionExpired = new Date(row.session_expires_at).getTime() <= now;
      const userBlocked = row.user_deleted_at !== null || row.user_status !== 'ACTIVE';

      if (tokenExpired || sessionExpired || userBlocked) {
        const reason = userBlocked ? 'ACCOUNT_INACTIVE' : 'EXPIRED';
        await client.query(
          `UPDATE refresh_tokens SET revoked_at = COALESCE(revoked_at, NOW()) WHERE family_id = $1;`,
          [row.family_id]
        );
        await client.query(
          `UPDATE user_sessions SET revoked_at = COALESCE(revoked_at, NOW()), revoked_reason = COALESCE(revoked_reason, $2) WHERE id = $1;`,
          [row.session_id, reason]
        );
        await client.query('COMMIT');
        throw new ApiError(401, GENERIC_REFRESH_ERROR);
      }

      // Issue new rotated child token in same family
      const newRawToken = this.generateRawToken();
      const newTokenHash = this.hashToken(newRawToken);
      const newCsrfToken = this.generateCsrfToken();

      const ttlMs = config.refreshToken.ttlDays * 24 * 60 * 60 * 1000;
      const candidateExpiry = new Date(now + ttlMs);
      const sessionExpiryDate = new Date(row.session_expires_at);
      const nextExpiresAt = candidateExpiry < sessionExpiryDate ? candidateExpiry : sessionExpiryDate;

      const insRes = await client.query(
        `INSERT INTO refresh_tokens (session_id, family_id, token_hash, parent_token_id, issued_at, expires_at)
         VALUES ($1, $2, $3, $4, NOW(), $5)
         RETURNING id;`,
        [row.session_id, row.family_id, newTokenHash, row.token_id, nextExpiresAt]
      );
      const newTokenId = insRes.rows[0].id;

      await client.query(
        `UPDATE refresh_tokens
         SET used_at = NOW(), replaced_by_token_id = $1
         WHERE id = $2;`,
        [newTokenId, row.token_id]
      );

      await client.query(
        `UPDATE user_sessions
         SET last_used_at = NOW(),
             ip_address = COALESCE($2::inet, ip_address),
             user_agent = COALESCE($3, user_agent)
         WHERE id = $1;`,
        [row.session_id, cleanIp, cleanUa]
      );

      const systemRoles = await UserModel.getUserSystemRoles(row.user_id, client);
      await client.query('COMMIT');

      const accessToken = this.signAccessToken(
        { id: row.user_id, email: row.email, status: row.user_status, token_version: Number(row.token_version ?? 1) },
        systemRoles,
        row.session_id
      );

      return {
        userId: row.user_id,
        email: row.email,
        status: row.user_status,
        roles: systemRoles,
        accessToken,
        rawRefreshToken: newRawToken,
        csrfToken: newCsrfToken,
        sessionId: row.session_id,
        familyId: row.family_id,
      };
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Revoke a single session family by raw refresh token (used on Logout).
   */
  public static async revokeSessionByRawToken(
    rawToken?: string | null,
    reason: string = 'LOGOUT'
  ): Promise<{ revoked: boolean; userId?: string; sessionId?: string }> {
    if (!rawToken || typeof rawToken !== 'string' || !RAW_TOKEN_FORMAT_RE.test(rawToken.trim())) {
      return { revoked: false };
    }

    const tokenHash = this.hashToken(rawToken);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const found = await client.query(
        `SELECT rt.family_id, rt.session_id, us.user_id
         FROM refresh_tokens rt
         JOIN user_sessions us ON us.id = rt.session_id
         WHERE rt.token_hash = $1
         LIMIT 1;`,
        [tokenHash]
      );
      if (found.rows.length === 0) {
        await client.query('ROLLBACK');
        return { revoked: false };
      }
      const { family_id: familyId, session_id: sessionId, user_id: userId } = found.rows[0];
      await client.query(
        `UPDATE refresh_tokens SET revoked_at = COALESCE(revoked_at, NOW()) WHERE family_id = $1;`,
        [familyId]
      );
      await client.query(
        `UPDATE user_sessions SET revoked_at = COALESCE(revoked_at, NOW()), revoked_reason = COALESCE(revoked_reason, $2) WHERE family_id = $1;`,
        [familyId, reason]
      );
      await client.query('COMMIT');
      return { revoked: true, userId, sessionId };
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Globally revoke all refresh sessions/tokens for a user, bump users.token_version
   * so existing access JWTs are rejected on next DB-backed verification, and close active WS sessions.
   */
  public static async revokeAllUserSessions(
    userId: string,
    reason: string,
    options: { bumpTokenVersion?: boolean; disconnectWs?: boolean } = {}
  ): Promise<void> {
    const bumpTokenVersion = options.bumpTokenVersion !== false;
    const disconnectWs = options.disconnectWs !== false;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `UPDATE refresh_tokens
         SET revoked_at = COALESCE(revoked_at, NOW())
         WHERE session_id IN (SELECT id FROM user_sessions WHERE user_id = $1)
           AND revoked_at IS NULL;`,
        [userId]
      );
      await client.query(
        `UPDATE user_sessions
         SET revoked_at = COALESCE(revoked_at, NOW()),
             revoked_reason = COALESCE(revoked_reason, $2)
         WHERE user_id = $1 AND revoked_at IS NULL;`,
        [userId, reason]
      );
      if (bumpTokenVersion) {
        await client.query(
          `UPDATE users SET token_version = COALESCE(token_version, 1) + 1, updated_at = NOW() WHERE id = $1;`,
          [userId]
        );
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }

    if (disconnectWs) {
      try {
        disconnectUserTelemetrySessions(userId);
      } catch {}
    }
  }
}
