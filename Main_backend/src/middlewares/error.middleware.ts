import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/apiError';
import { ApiResponse } from '../utils/apiResponse';
import { config } from '../config/env';

export const errorHandler = (
  err: Error | ApiError,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
) => {
  const statusCode =
    err instanceof ApiError
      ? err.statusCode
      : (typeof (err as any).statusCode === 'number'
          ? (err as any).statusCode
          : (typeof (err as any).status === 'number' ? (err as any).status : 500));
  const message = err.message || 'Internal Server Error';
  const errors = err instanceof ApiError ? err.errors : undefined;

  const stack = config.isDevelopment ? err.stack : undefined;
  console.error('[ErrorMiddleware] Captured error:', err);

  return ApiResponse.error(res, message, statusCode, {
    ...(errors ? { details: errors } : {}),
    ...(stack ? { stack } : {}),
  });
};
