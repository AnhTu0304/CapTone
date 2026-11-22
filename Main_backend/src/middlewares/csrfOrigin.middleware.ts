import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { config } from '../config/env';
import { ApiError } from '../utils/apiError';

export function parseCookies(cookieHeader?: string): Record<string, string> {
  const result: Record<string, string> = {};
  if (!cookieHeader || typeof cookieHeader !== 'string') return result;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx <= 0) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (key) {
      try {
        result[key] = decodeURIComponent(val);
      } catch {
        result[key] = val;
      }
    }
  }
  return result;
}

export function isRequestHttps(req?: Request): boolean {
  if (config.refreshToken.cookieSecure) return true;
  if (!req) return false;
  if (req.secure) return true;
  const proto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim().toLowerCase();
  return proto === 'https';
}

export function buildCookieString(
  name: string,
  value: string,
  opts: {
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: 'Lax' | 'Strict' | 'None';
    path?: string;
    maxAgeSeconds?: number;
  }
): string {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  if (opts.maxAgeSeconds !== undefined) {
    parts.push(`Max-Age=${Math.max(0, Math.floor(opts.maxAgeSeconds))}`);
  }
  parts.push(`Path=${opts.path || '/'}`);
  if (opts.httpOnly) parts.push('HttpOnly');
  if (opts.secure) parts.push('Secure');
  parts.push(`SameSite=${opts.sameSite || 'Lax'}`);
  return parts.join('; ');
}

export function setAuthCookies(
  res: Response,
  rawRefreshToken: string,
  csrfToken: string,
  req?: Request
): void {
  const secure = isRequestHttps(req);
  const maxAgeSeconds = config.refreshToken.ttlDays * 24 * 60 * 60;
  const refreshPath = `${config.apiPrefix.replace(/\/$/, '')}/auth`;

  const refreshCookie = buildCookieString(config.refreshToken.cookieName, rawRefreshToken, {
    httpOnly: true,
    secure,
    sameSite: config.refreshToken.cookieSameSite,
    path: refreshPath,
    maxAgeSeconds,
  });

  const csrfCookie = buildCookieString(config.refreshToken.csrfCookieName, csrfToken, {
    httpOnly: false,
    secure,
    sameSite: config.refreshToken.cookieSameSite,
    path: '/',
    maxAgeSeconds,
  });

  res.setHeader('Set-Cookie', [refreshCookie, csrfCookie]);
}

export function clearAuthCookies(res: Response, req?: Request): void {
  const secure = isRequestHttps(req);
  const refreshPath = `${config.apiPrefix.replace(/\/$/, '')}/auth`;

  const clearRefresh = buildCookieString(config.refreshToken.cookieName, '', {
    httpOnly: true,
    secure,
    sameSite: config.refreshToken.cookieSameSite,
    path: refreshPath,
    maxAgeSeconds: 0,
  });

  const clearCsrf = buildCookieString(config.refreshToken.csrfCookieName, '', {
    httpOnly: false,
    secure,
    sameSite: config.refreshToken.cookieSameSite,
    path: '/',
    maxAgeSeconds: 0,
  });

  res.setHeader('Set-Cookie', [clearRefresh, clearCsrf]);
}

export function isTrustedOrigin(originHeader?: string, refererHeader?: string): boolean {
  let candidate = originHeader?.trim() || '';
  if (!candidate && refererHeader) {
    try {
      candidate = new URL(refererHeader.trim()).origin;
    } catch {
      candidate = '';
    }
  }
  if (!candidate) return false;

  const allowed = config.corsOrigins.filter((o) => o && o !== '*');
  if (allowed.includes(candidate)) return true;

  if (config.isDevelopment && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(candidate)) {
    return true;
  }

  return false;
}

function safeTimingEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length === 0 || bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Strict Origin + Double-Submit CSRF validation middleware for cookie-authenticated endpoints
 * (/auth/refresh, /auth/logout, /auth/logout-all).
 */
export function requireTrustedOriginAndCsrf(req: Request, _res: Response, next: NextFunction): void {
  const origin = req.headers.origin as string | undefined;
  const referer = req.headers.referer as string | undefined;

  if (!isTrustedOrigin(origin, referer)) {
    return next(new ApiError(403, 'Nguồn gốc yêu cầu (Origin) không được phép'));
  }

  const cookies = parseCookies(req.headers.cookie);
  const cookieCsrf = cookies[config.refreshToken.csrfCookieName] || '';
  const headerCsrf = String(req.headers['x-csrf-token'] || '').trim();

  if (!cookieCsrf || !headerCsrf || !safeTimingEqual(cookieCsrf, headerCsrf)) {
    return next(new ApiError(403, 'Xác thực CSRF thất bại'));
  }

  return next();
}
