import { Request, Response, NextFunction } from 'express';
import { EnvironmentService } from '../services/environment.service';
import { ApiResponse } from '../utils/apiResponse';
import { ApiError } from '../utils/apiError';

export class EnvironmentController {
  public static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const orgId = req.params.orgId || req.params.id || req.orgMember?.organizationId;
      if (!orgId) throw new ApiError(400, 'Mã tổ chức không hợp lệ');
      const userId = (req as any).user?.id;
      const result = await EnvironmentService.create(orgId, userId, req.body);
      return ApiResponse.success(res, 'Tạo môi trường thành công', result, 201);
    } catch (error) {
      next(error);
    }
  }

  public static async getByOrg(req: Request, res: Response, next: NextFunction) {
    try {
      const orgId = req.params.orgId || req.params.id || req.orgMember?.organizationId;
      if (!orgId) throw new ApiError(400, 'Mã tổ chức không hợp lệ');
      const result = await EnvironmentService.getByOrg(orgId, req.query as any);
      return ApiResponse.success(res, 'Lấy danh sách môi trường thành công', result, 200);
    } catch (error) {
      next(error);
    }
  }

  public static async getSummary(req: Request, res: Response, next: NextFunction) {
    try {
      const orgId = req.params.orgId || req.params.id || req.orgMember?.organizationId;
      if (!orgId) throw new ApiError(400, 'Mã tổ chức không hợp lệ');
      const result = await EnvironmentService.getSummary(orgId);
      return ApiResponse.success(res, 'Lấy thông tin tổng quan môi trường thành công', result, 200);
    } catch (error) {
      next(error);
    }
  }

  public static async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const orgId = req.params.orgId || req.orgMember?.organizationId;
      if (!orgId) throw new ApiError(400, 'Mã tổ chức không hợp lệ');
      const id = req.params.id;
      const result = await EnvironmentService.getById(orgId, id);
      return ApiResponse.success(res, 'Lấy chi tiết môi trường thành công', result, 200);
    } catch (error) {
      next(error);
    }
  }

  public static async update(req: Request, res: Response, next: NextFunction) {
    try {
      const orgId = req.params.orgId || req.orgMember?.organizationId;
      if (!orgId) throw new ApiError(400, 'Mã tổ chức không hợp lệ');
      const id = req.params.id;
      const result = await EnvironmentService.update(orgId, id, req.body);
      return ApiResponse.success(res, 'Cập nhật môi trường thành công', result, 200);
    } catch (error) {
      next(error);
    }
  }

  public static async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const orgId = req.params.orgId || req.orgMember?.organizationId;
      if (!orgId) throw new ApiError(400, 'Mã tổ chức không hợp lệ');
      const id = req.params.id;
      await EnvironmentService.delete(orgId, id);
      return ApiResponse.success(res, 'Xóa môi trường thành công', { id }, 200);
    } catch (error) {
      next(error);
    }
  }
}
