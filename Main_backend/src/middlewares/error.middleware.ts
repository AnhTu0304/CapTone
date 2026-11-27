import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { ApiError } from '../utils/apiError';
import { ApiResponse } from '../utils/apiResponse';
import { config } from '../config/env';
import {
  isSensitiveDbDriverError,
  redactSensitiveString,
  resolveSafeClientErrorMessage,
  sanitizeForLog,
} from '../utils/logSanitizer';

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

  const isApiErr = err instanceof ApiError;
  const statusCode = isApiErr
    ? err.statusCode
    : (typeof (err as any).statusCode === 'number'
        ? (err as any).statusCode
        : (typeof (err as any).status === 'number' ? (err as any).status : 500));
  const message = resolveSafeClientErrorMessage(err, {
    isDevelopment: config.isDevelopment,
    isApiError: isApiErr,
    statusCode,
  });
  const errors = isApiErr ? err.errors : undefined;

  const isMaskedDbError = !isApiErr && statusCode >= 500 && isSensitiveDbDriverError(err);
  const stack =
    config.isDevelopment && !isMaskedDbError && err.stack
      ? redactSensitiveString(err.stack)
      : undefined;
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
