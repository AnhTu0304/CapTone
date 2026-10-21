import { Request, Response } from 'express';
import { ApiResponse } from '../utils/apiResponse';
import { getDbHealth } from '../config/database';
import { config } from '../config/env';

export class HealthController {
  public static async check(req: Request, res: Response) {
    const dbHealth = await getDbHealth();

    const healthData = {
      status: 'UP',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      nodeVersion: process.version,
      database: {
        status: dbHealth.status,
        name: config.db.database,
        host: config.db.host,
        port: config.db.port,
        serverTime: dbHealth.serverTime,
        ...(dbHealth.error ? { error: dbHealth.error } : {}),
      },
    };

    return ApiResponse.success(res, 'Server is healthy and running', healthData, 200);
  }
}
