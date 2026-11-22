import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { ApiError } from '../utils/apiError';
import { ApiResponse } from '../utils/apiResponse';
import { config } from '../config/env';
import { redactSensitiveString, sanitizeForLog } from '../utils/logSanitizer';

export const errorHandler = (
  err: Error | ApiError | ZodError,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
) => {
  if (err instanceof ZodError) {
    const primaryMessage = err.issues[0]?.message || 'Dữ liệu đầu vào không hợp lệ';
    const details = err.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    }));
    return ApiResponse.error(res, primaryMessage, 400, { details });
  }

  const statusCode =
    err instanceof ApiError
      ? err.statusCode
      : (typeof (err as any).statusCode === 'number'
          ? (err as any).statusCode
          : (typeof (err as any).status === 'number' ? (err as any).status : 500));
  const rawMessage = redactSensitiveString(err.message || 'Internal Server Error');
  const message =
    !(err instanceof ApiError) && statusCode >= 500 && !config.isDevelopment
      ? 'Internal Server Error'
      : rawMessage;
  const errors = err instanceof ApiError ? err.errors : undefined;

  const stack = config.isDevelopment && err.stack ? redactSensitiveString(err.stack) : undefined;
  console.error('[ErrorMiddleware] Captured error:', {
    method: req.method,
    path: redactSensitiveString(req.originalUrl || req.url || ''),
    statusCode,
    error: sanitizeForLog(err),
  });

  return ApiResponse.error(res, message, statusCode, {
    ...(errors ? { details: errors } : {}),
    ...(stack ? { stack } : {}),
  });
};
