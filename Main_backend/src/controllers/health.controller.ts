import { Request, Response } from 'express';
import { ApiResponse } from '../utils/apiResponse';
import { pool } from '../config/database';
import { config } from '../config/env';

export class HealthController {
  public static async check(req: Request, res: Response) {
    let dbStatus = 'DISCONNECTED';
    let dbTime: string | null = null;

    try {
      const result = await pool.query('SELECT NOW() as now');
      dbStatus = 'CONNECTED';
      dbTime = result.rows[0].now;
    } catch (error) {
      dbStatus = `ERROR: ${(error as Error).message}`;
    }

    const healthData = {
      status: 'UP',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      nodeVersion: process.version,
      database: {
        status: dbStatus,
        name: config.db.database,
        host: config.db.host,
        port: config.db.port,
        serverTime: dbTime,
      },
    };

    return ApiResponse.success(res, 'Server is healthy and running', healthData, 200);
  }
}
