import { Request, Response, NextFunction } from 'express';
import { StatisticsService } from '../services/statistics.service';
import { overviewStatisticsQuerySchema } from '../validations/statistics.validation';

export class StatisticsController {
  /**
   * GET /api/v1/statistics/overview
   * Lấy số liệu thống kê tổng quan hệ thống hoặc theo phạm vi doanh nghiệp/cụm
   */
  public static async getOverview(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = overviewStatisticsQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        const issues = parsed.error.issues || parsed.error.errors || [];
        return res.status(400).json({
          success: false,
          message: 'Tham số truy vấn thống kê không hợp lệ',
          errors: issues.map((e: any) => ({
            field: Array.isArray(e.path) ? e.path.join('.') : '',
            message: e.message,
          })),
        });
      }

      const currentUser = (req as any).user;
      const stats = await StatisticsService.getOverviewStats(currentUser, parsed.data);

      return res.status(200).json({
        success: true,
        message: 'Lấy dữ liệu thống kê tổng quan thành công',
        data: stats,
      });
    } catch (error) {
      next(error);
    }
  }
}
