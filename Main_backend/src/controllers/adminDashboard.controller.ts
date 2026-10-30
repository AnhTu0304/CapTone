import { Request, Response, NextFunction } from 'express';
import { AdminDashboardService } from '../services/adminDashboard.service';
import { ApiResponse } from '../utils/apiResponse';

export class AdminDashboardController {
  /**
   * [GET] /api/v1/admin/dashboard/stats
   * Lấy số liệu KPI tổng quan thời gian thực cho Platform Admin qua Service Layer
   */
  public static async getKpiStats(req: Request, res: Response, next: NextFunction) {
    try {
      const stats = await AdminDashboardService.getKpiStats();
      return ApiResponse.success(res, 'Lấy thống kê tổng quan nền tảng thành công', stats, 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * [GET] /api/v1/admin/alerts/overview
   * Lấy tổng hợp cảnh báo nền tảng, tình trạng đứt kết nối tác tử và KPI sự cố qua Service Layer
   */
  public static async getAlertsOverview(req: Request, res: Response, next: NextFunction) {
    try {
      const overview = await AdminDashboardService.getAlertsOverview();
      return ApiResponse.success(res, 'Lấy tổng quan cảnh báo và sự cố nền tảng thành công', overview, 200);
    } catch (error) {
      next(error);
    }
  }
}
