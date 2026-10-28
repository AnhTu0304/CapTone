import { Request, Response, NextFunction } from 'express';
import { AdminDashboardModel } from '../models/adminDashboard.model';
import { ApiResponse } from '../utils/apiResponse';

export class AdminDashboardController {
  /**
   * [GET] /api/v1/admin/dashboard/stats
   * Lấy số liệu KPI tổng quan thời gian thực cho Platform Admin
   */
  public static async getKpiStats(req: Request, res: Response, next: NextFunction) {
    try {
      const stats = await AdminDashboardModel.getKpiStats();
      return ApiResponse.success(res, 'Lấy thống kê tổng quan nền tảng thành công', stats, 200);
    } catch (error) {
      next(error);
    }
  }
}
