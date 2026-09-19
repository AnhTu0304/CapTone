import { Request, Response } from 'express';
import { ApiResponse } from '../utils/apiResponse';

export class HealthController {
  public static check(req: Request, res: Response) {
    const healthData = {
      status: 'UP',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      nodeVersion: process.version,
    };

    return ApiResponse.success(res, 'Server is healthy and running', healthData, 200);
  }
}
