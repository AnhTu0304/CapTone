import { Response } from 'express';

export class ApiResponse {
  static success<T>(res: Response, message: string = 'Success', data?: T, statusCode: number = 200) {
    return res.status(statusCode).json({
      success: true,
      message,
      data,
      timestamp: new Date().toISOString(),
    });
  }

  static error(res: Response, message: string = 'Internal Server Error', statusCode: number = 500, errors?: unknown) {
    return res.status(statusCode).json({
      success: false,
      message,
      errors,
      timestamp: new Date().toISOString(),
    });
  }
}
