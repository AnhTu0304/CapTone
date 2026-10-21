import { Request, Response, NextFunction } from 'express';
import { EnvironmentService } from '../services/environment.service';
import { ApiResponse } from '../utils/apiResponse';

export class EnvironmentController {
  /**
   * [POST] /api/v1/organizations/:orgId/environments
   * Tạo môi trường mới (DEV / STAGING) cho tổ chức
   */
  public static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const orgId = req.params.orgId || req.params.id;
      const userId = (req as any).user?.id;
      const result = await EnvironmentService.create(orgId, userId, req.body);
      return ApiResponse.success(res, 'Tạo môi trường thành công', result, 201);
    } catch (error) {
      next(error);
    }
  }

  /**
   * [GET] /api/v1/organizations/:orgId/environments
   * Lấy danh sách môi trường của tổ chức (hỗ trợ phân trang, tìm kiếm, lọc DEV/STAGING)
   */
  public static async getByOrg(req: Request, res: Response, next: NextFunction) {
    try {
      const orgId = req.params.orgId || req.params.id;
      const result = await EnvironmentService.getByOrg(orgId, req.query as any);
      return ApiResponse.success(res, 'Lấy danh sách môi trường thành công', result, 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * [GET] /api/v1/organizations/:orgId/environments/summary
   * Thống kê tổng quan môi trường (phân bổ số lượng cụm K8s theo DEV và STAGING)
   */
  public static async getSummary(req: Request, res: Response, next: NextFunction) {
    try {
      const orgId = req.params.orgId || req.params.id;
      const result = await EnvironmentService.getSummary(orgId);
      return ApiResponse.success(res, 'Lấy thông tin tổng quan môi trường thành công', result, 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * [GET] /api/v1/organizations/:orgId/environments/:id
   * Xem chi tiết một môi trường
   */
  public static async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const orgId = req.params.orgId;
      const id = req.params.id;
      const result = await EnvironmentService.getById(orgId, id);
      return ApiResponse.success(res, 'Lấy chi tiết môi trường thành công', result, 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * [PUT] /api/v1/organizations/:orgId/environments/:id
   * Cập nhật thông tin môi trường
   */
  public static async update(req: Request, res: Response, next: NextFunction) {
    try {
      const orgId = req.params.orgId;
      const id = req.params.id;
      const result = await EnvironmentService.update(orgId, id, req.body);
      return ApiResponse.success(res, 'Cập nhật môi trường thành công', result, 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * [DELETE] /api/v1/organizations/:orgId/environments/:id
   * Xóa mềm môi trường (yêu cầu không còn cụm K8s hoặc Agent liên kết)
   */
  public static async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const orgId = req.params.orgId;
      const id = req.params.id;
      await EnvironmentService.delete(orgId, id);
      return ApiResponse.success(res, 'Xóa môi trường thành công', { id }, 200);
    } catch (error) {
      next(error);
    }
  }
}
