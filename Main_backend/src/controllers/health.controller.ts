import { Request, Response } from 'express';
import { ApiResponse } from '../utils/apiResponse';
import { getDbHealth } from '../config/database';
import { getRedisHealth } from '../config/redis';
import { config } from '../config/env';

export class HealthController {
  public static async check(req: Request, res: Response) {
    const [dbHealth, redisHealth] = await Promise.all([
      getDbHealth(),
      getRedisHealth(),
    ]);

    const isProdLike = !config.isDevelopment;
    const sanitizedDbStatus =
      isProdLike && !dbHealth.status.startsWith('CONNECTED') ? 'ERROR' : dbHealth.status;

    const healthData = {
      status: 'UP',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      ...(isProdLike
        ? {}
        : {
            nodeVersion: process.version,
            port: process.env.BACKEND_HOST_PORT ? parseInt(process.env.BACKEND_HOST_PORT, 10) : config.port,
            externalPort: process.env.BACKEND_HOST_PORT ? parseInt(process.env.BACKEND_HOST_PORT, 10) : config.port,
            aiPort: process.env.AI_HOST_PORT ? parseInt(process.env.AI_HOST_PORT, 10) : 8005,
          }),
      memory: {
        rssMb: Math.round(process.memoryUsage().rss / (1024 * 1024)),
        heapUsedMb: Math.round(process.memoryUsage().heapUsed / (1024 * 1024)),
        heapTotalMb: Math.round(process.memoryUsage().heapTotal / (1024 * 1024)),
      },
      database: isProdLike
        ? {
            status: sanitizedDbStatus,
            serverTime: dbHealth.serverTime,
            ...(dbHealth.ssl ? { ssl: dbHealth.ssl } : {}),
          }
        : {
            status: dbHealth.status,
            name: config.db.database,
            host: config.db.host,
            port: process.env.DB_HOST_PORT ? parseInt(process.env.DB_HOST_PORT, 10) : config.db.port,
            externalPort: process.env.DB_HOST_PORT ? parseInt(process.env.DB_HOST_PORT, 10) : config.db.port,
            internalPort: config.db.port,
            serverTime: dbHealth.serverTime,
            ...(dbHealth.ssl ? { ssl: dbHealth.ssl } : {}),
            ...(dbHealth.error ? { error: dbHealth.error } : {}),
          },
      redis: isProdLike
        ? {
            status: redisHealth.status,
            latencyMs: redisHealth.latencyMs,
          }
        : {
            ...redisHealth,
            port: process.env.REDIS_HOST_PORT ? parseInt(process.env.REDIS_HOST_PORT, 10) : redisHealth.port,
            externalPort: process.env.REDIS_HOST_PORT ? parseInt(process.env.REDIS_HOST_PORT, 10) : redisHealth.port,
            internalPort: redisHealth.port,
          },
    };

    return ApiResponse.success(res, 'Server is healthy and running', healthData, 200);
  }
}
