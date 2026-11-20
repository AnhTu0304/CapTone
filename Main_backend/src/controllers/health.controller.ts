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

    const healthData = {
      status: 'UP',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      nodeVersion: process.version,
      port: process.env.BACKEND_HOST_PORT ? parseInt(process.env.BACKEND_HOST_PORT, 10) : 5005,
      externalPort: process.env.BACKEND_HOST_PORT ? parseInt(process.env.BACKEND_HOST_PORT, 10) : 5005,
      aiPort: process.env.AI_HOST_PORT ? parseInt(process.env.AI_HOST_PORT, 10) : 8005,
      memory: {
        rssMb: Math.round(process.memoryUsage().rss / (1024 * 1024)),
        heapUsedMb: Math.round(process.memoryUsage().heapUsed / (1024 * 1024)),
        heapTotalMb: Math.round(process.memoryUsage().heapTotal / (1024 * 1024)),
      },
      database: {
        status: dbHealth.status,
        name: config.db.database,
        host: config.db.host,
        port: process.env.DB_HOST_PORT ? parseInt(process.env.DB_HOST_PORT, 10) : 5433,
        externalPort: process.env.DB_HOST_PORT ? parseInt(process.env.DB_HOST_PORT, 10) : 5433,
        internalPort: config.db.port,
        serverTime: dbHealth.serverTime,
        ...(dbHealth.error ? { error: dbHealth.error } : {}),
      },
      redis: {
        ...redisHealth,
        port: process.env.REDIS_HOST_PORT ? parseInt(process.env.REDIS_HOST_PORT, 10) : 6380,
        externalPort: process.env.REDIS_HOST_PORT ? parseInt(process.env.REDIS_HOST_PORT, 10) : 6380,
        internalPort: redisHealth.port,
      },
    };

    return ApiResponse.success(res, 'Server is healthy and running', healthData, 200);
  }
}
