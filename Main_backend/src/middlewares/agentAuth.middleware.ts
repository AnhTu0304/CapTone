import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { ApiError } from '../utils/apiError';
import { AgentModel } from '../models/agent.model';
import { pool } from '../config/database';

export interface AuthenticatedAgentContext {
  id: string;
  name: string;
  agent_uid: string;
  cluster_id: string | null;
  environment_id: string;
  organization_id: string;
  status: string;
  token_id: string;
}

declare global {
  namespace Express {
    interface Request {
      agent?: AuthenticatedAgentContext;
    }
  }
}

/**
 * Middleware xác thực Agent Token cho các endpoint dành riêng cho Agent Daemon
 * Tiếp nhận token qua header `x-agent-token` hoặc `Authorization: Bearer <token>`
 * Áp dụng Fail-closed khi có lỗi cơ sở dữ liệu
 */
export const authenticateAgentToken = async (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  const customHeader = req.headers['x-agent-token'] as string | undefined;
  const authHeader = req.headers.authorization;
  let rawToken = customHeader ? customHeader.trim() : '';

  if (!rawToken && authHeader) {
    const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
    if (bearerMatch) {
      rawToken = bearerMatch[1].trim();
    } else if (authHeader.trim().toLowerCase() === 'bearer') {
      rawToken = '';
    } else {
      rawToken = authHeader.trim();
    }
  }

  if (!rawToken) {
    return next(ApiError.unauthorized('Thiếu token xác thực Agent'));
  }

  try {
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const agentRow = await AgentModel.findByTokenHash(tokenHash, rawToken);

    if (!agentRow) {
      return next(ApiError.unauthorized('Token Agent không hợp lệ, đã hết hạn hoặc đã bị thu hồi'));
    }

    if (agentRow.token_id) {
      await pool.query('UPDATE agent_tokens SET last_used_at = NOW() WHERE id = $1', [agentRow.token_id]);
    }

    req.agent = {
      id: agentRow.id,
      name: agentRow.name,
      agent_uid: agentRow.agent_uid,
      cluster_id: agentRow.cluster_id || null,
      environment_id: agentRow.environment_id,
      organization_id: (agentRow as any).organization_id,
      status: agentRow.status,
      token_id: agentRow.token_id,
    };

    return next();
  } catch (error: any) {
    if (error instanceof ApiError) {
      return next(error);
    }
    return next(new ApiError(500, 'Lỗi cơ sở dữ liệu khi xác thực Agent'));
  }
};
