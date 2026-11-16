import { Request, Response, NextFunction } from 'express';
import { AdminAnalyticsService } from '../services/adminAnalytics.service';
import { AuditService } from '../services/audit.service';
import { growthAnalyticsQuerySchema } from '../validations/adminAnalytics.validation';
import { ApiResponse } from '../utils/apiResponse';

export class AdminAnalyticsController {
  /**
   * [GET] /api/v1/admin/analytics/growth
   * Lấy số liệu phân tích tăng trưởng và dữ liệu doanh nghiệp thời gian thực
   */
  public static async getGrowthAnalytics(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = growthAnalyticsQuerySchema.parse(req.query);
      const result = await AdminAnalyticsService.getGrowthAnalytics(parsed);
      return ApiResponse.success(res, 'Lấy dữ liệu thống kê tăng trưởng thành công', result, 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * [GET] /api/v1/admin/analytics/export
   * Xuất báo cáo dữ liệu tăng trưởng doanh nghiệp định dạng CSV an toàn (có chống CSV Injection)
   */
  public static async exportGrowthCsv(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = growthAnalyticsQuerySchema.parse(req.query);
      const csvData = await AdminAnalyticsService.exportGrowthCsv(parsed);

      // Ghi nhận nhật ký kiểm toán an ninh (Audit Trail)
      AuditService.recordFromRequest(req, {
        action: 'ANALYTICS_CSV_EXPORTED',
        target_type: 'ORGANIZATION',
        target_id: (req as any).user?.id || 'admin',
        description: `Quản trị viên xuất báo cáo dữ liệu tăng trưởng doanh nghiệp (Năm ${parsed.year || new Date().getFullYear()}, Tháng ${parsed.month || 'ALL'})`,
        status: 'SUCCESS',
        metadata: {
          year: parsed.year,
          month: parsed.month,
          filter: parsed.status,
        },
      });

      const filename = `bao-cao-tang-truong-${parsed.year || new Date().getFullYear()}-${Date.now()}.csv`;
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.status(200).send(csvData);
    } catch (error) {
      next(error);
    }
  }
}
