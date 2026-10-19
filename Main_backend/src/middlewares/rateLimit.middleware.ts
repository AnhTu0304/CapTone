import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/apiError';

export interface RateLimitOptions {
  windowMs: number;
  max: number;
  message?: string;
}

/**
 * Lightweight, in-memory rate limiting middleware
 * Protects sensitive endpoints (login, password change) from brute-force attacks
 */
export const rateLimiter = (options: RateLimitOptions) => {
  const hits = new Map<string, { count: number; resetTime: number }>();

  // Cleanup expired entries periodically
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

  return (req: Request, res: Response, next: NextFunction) => {
    // In test environment, allow bypassing rate limit if header present
    if (process.env.NODE_ENV === 'test' && req.headers['x-skip-rate-limit'] === 'true') {
      return next();
    }

    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const entry = hits.get(ip);

    if (!entry || now > entry.resetTime) {
      hits.set(ip, { count: 1, resetTime: now + options.windowMs });
      return next();
    }

    entry.count += 1;
    if (entry.count > options.max) {
      const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
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
};

/**
 * Pre-configured rate limiters
 */
// Login rate limit: 10 attempts per 5 minutes per IP
export const authRateLimiter = rateLimiter({
  windowMs: 5 * 60 * 1000,
  max: 10,
  message: 'Bạn đã thử đăng nhập quá nhiều lần. Vui lòng thử lại sau 5 phút.',
});

// General sensitive operations rate limit: 30 requests per minute
export const sensitiveOpRateLimiter = rateLimiter({
  windowMs: 60 * 1000,
  max: 30,
  message: 'Tần suất thao tác quá nhanh. Vui lòng làm chậm lại.',
});
