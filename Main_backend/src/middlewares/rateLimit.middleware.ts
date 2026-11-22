import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/apiError';
import { redisClient, isRedisReady } from '../config/redis';

export interface RateLimitRedisStore {
  isReady: () => boolean;
  incr: (key: string) => Promise<number>;
  pexpire: (key: string, ms: number) => Promise<any>;
  pttl?: (key: string) => Promise<number>;
}

export interface RateLimitOptions {
  windowMs: number;
  max: number;
  message?: string;
  keyPrefix?: string;
  keyGenerator?: (req: Request) => string;
  failClosedOnRedisDown?: boolean;
  redisStore?: RateLimitRedisStore;
}

const defaultRedisStore: RateLimitRedisStore = {
  isReady: () => isRedisReady(),
  incr: (key: string) => redisClient.incr(key),
  pexpire: (key: string, ms: number) => redisClient.pexpire(key, ms),
  pttl: (key: string) => redisClient.pttl(key),
};

/**
 * Distributed Redis-backed rate limiting middleware with bounded in-memory fallback
 * (and optional fail-closed 503 mode for production auth endpoints during Redis outage).
 */
export const rateLimiter = (options: RateLimitOptions) => {
  const hits = new Map<string, { count: number; resetTime: number }>();
  const store = options.redisStore || defaultRedisStore;
  const prefix = options.keyPrefix || 'rl:default';
  let loggedFallback = false;

  const interval = setInterval(() => {
    const now = Date.now();
    for (const [key, value] of hits.entries()) {
      if (now > value.resetTime) {
        hits.delete(key);
      }
    }
  }, 60000);

  if (interval.unref) {
    interval.unref();
  }

  const computeKey = (req: Request): string => {
    if (options.keyGenerator) {
      return `${prefix}:${options.keyGenerator(req)}`;
    }
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const userId = (req as any).user?.id ? `:u:${(req as any).user.id}` : '';
    const routeTag = `${req.baseUrl || ''}${req.path || ''}` || 'root';
    return `${prefix}:${routeTag}:${ip}${userId}`;
  };

  const applyMemoryLimit = (key: string, res: Response, next: NextFunction) => {
    const now = Date.now();
    const entry = hits.get(key);
    if (!entry || now > entry.resetTime) {
      hits.set(key, { count: 1, resetTime: now + options.windowMs });
      return next();
    }
    entry.count += 1;
    if (entry.count > options.max) {
      const retryAfter = Math.max(1, Math.ceil((entry.resetTime - now) / 1000));
      res.setHeader('Retry-After', retryAfter);
      return next(
        new ApiError(
          429,
          options.message || 'Quá nhiều yêu cầu từ địa chỉ IP này. Vui lòng thử lại sau.'
        )
      );
    }
    return next();
  };

  return async (req: Request, res: Response, next: NextFunction) => {
    if (process.env.NODE_ENV === 'test' && req.headers['x-skip-rate-limit'] === 'true') {
      return next();
    }

    const fullKey = computeKey(req);

    if (store.isReady()) {
      try {
        const count = await store.incr(fullKey);
        let ttlMs = options.windowMs;
        if (count === 1) {
          await store.pexpire(fullKey, options.windowMs);
        } else if (store.pttl) {
          const remaining = await store.pttl(fullKey);
          if (remaining < 0) {
            await store.pexpire(fullKey, options.windowMs);
          } else {
            ttlMs = remaining;
          }
        }

        if (count > options.max) {
          const retryAfter = Math.max(1, Math.ceil(ttlMs / 1000));
          res.setHeader('Retry-After', retryAfter);
          return next(
            new ApiError(
              429,
              options.message || 'Quá nhiều yêu cầu từ địa chỉ IP này. Vui lòng thử lại sau.'
            )
          );
        }
        return next();
      } catch (err: any) {
        if (!loggedFallback) {
          loggedFallback = true;
          console.error('[RateLimiter] Redis store error:', err?.message || err);
        }
      }
    }

    if (options.failClosedOnRedisDown && process.env.NODE_ENV === 'production') {
      return next(
        new ApiError(
          503,
          'Dịch vụ kiểm soát truy cập tạm thời gián đoạn. Vui lòng thử lại sau ít phút.'
        )
      );
    }

    return applyMemoryLimit(fullKey, res, next);
  };
};

// Login / register / password-reset rate limit: 10 attempts per 5 minutes per IP (fail-closed in prod)
export const authRateLimiter = rateLimiter({
  windowMs: 5 * 60 * 1000,
  max: 10,
  keyPrefix: 'rl:auth',
  failClosedOnRedisDown: true,
  message: 'Bạn đã thử đăng nhập quá nhiều lần. Vui lòng thử lại sau 5 phút.',
});

// General sensitive operations rate limit: 30 requests per minute
export const sensitiveOpRateLimiter = rateLimiter({
  windowMs: 60 * 1000,
  max: 30,
  keyPrefix: 'rl:sensitive',
  message: 'Tần suất thao tác quá nhanh. Vui lòng làm chậm lại.',
});

// Refresh token endpoint rate limit: 20 attempts per minute per IP (fail-closed in prod)
export const refreshRateLimiter = rateLimiter({
  windowMs: 60 * 1000,
  max: 20,
  keyPrefix: 'rl:refresh',
  failClosedOnRedisDown: true,
  message: 'Quá nhiều yêu cầu làm mới phiên. Vui lòng thử lại sau ít phút.',
});
