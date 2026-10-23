import { Request, Response, NextFunction } from 'express';
import { ClusterService } from '../services/cluster.service';
import { ApiResponse } from '../utils/apiResponse';
import { ApiError } from '../utils/apiError';

export class ClusterController {
  public static async getByOrg(req: Request, res: Response, next: NextFunction) {
    try {
      const orgId = (req.params.orgId || req.params.id || req.orgMember?.organizationId)!;
      const clusters = await ClusterService.getClustersByOrg(orgId);
      return ApiResponse.success(res, 'Lấy danh sách cụm Kubernetes thành công', clusters, 200);
    } catch (error) {
      next(error);
    }
  }

  public static async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const userRoles: string[] = Array.isArray(user?.roles)
        ? user.roles.map((r: string) => String(r).trim().toUpperCase())
        : [];
      const isSuper = userRoles.includes('SUPER_ADMIN') || userRoles.includes('SYSTEM_ADMIN') || userRoles.includes('ADMIN');
      if (!isSuper) {
        return next(new ApiError(403, 'Từ chối truy cập: Quyền hạn dành riêng cho Quản trị viên hệ thống'));
      }
      const clusters = await ClusterService.getAllClusters();
      return ApiResponse.success(res, 'Lấy danh sách cụm Kubernetes hệ thống thành công', clusters, 200);
    } catch (error) {
      next(error);
    }
  }

  public static async getDetail(req: Request, res: Response, next: NextFunction) {
    try {
      const clusterId = req.params.clusterId || req.params.id;
      const orgId = req.params.orgId || req.orgMember?.organizationId;
      const detail = await ClusterService.getClusterDetail(clusterId, orgId);
      return ApiResponse.success(res, 'Lấy chi tiết cụm Kubernetes thành công', detail, 200);
    } catch (error) {
      next(error);
    }
  }

  public static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const orgId = (req.params.orgId || req.params.id || req.orgMember?.organizationId)!;
      const cluster = await ClusterService.createCluster(orgId, req.body);
      return ApiResponse.success(res, 'Đăng ký cụm Kubernetes thành công', cluster, 201);
    } catch (error) {
      next(error);
    }
  }

  public static async rotateToken(req: Request, res: Response, next: NextFunction) {
    try {
      const clusterId = req.params.clusterId || req.params.id;
      const orgId = req.params.orgId || req.orgMember?.organizationId;
      const result = await ClusterService.rotateAgentToken(clusterId, req.body || {}, orgId);
      return ApiResponse.success(res, 'Cấp mới / Xoay vòng Token Agent thành công', result, 201);
    } catch (error) {
      next(error);
    }
  }

  public static async revokeToken(req: Request, res: Response, next: NextFunction) {
    try {
      const clusterId = req.params.clusterId || req.params.id;
      const tokenId = req.params.tokenId;
      const orgId = req.params.orgId || req.orgMember?.organizationId;
      const result = await ClusterService.revokeAgentToken(clusterId, tokenId, orgId);
      return ApiResponse.success(res, 'Thu hồi Token Agent thành công', result, 200);
    } catch (error) {
      next(error);
    }
  }

  public static async updateConfig(req: Request, res: Response, next: NextFunction) {
    try {
      const clusterId = req.params.clusterId || req.params.id;
      const orgId = req.params.orgId || req.orgMember?.organizationId;
      const result = await ClusterService.updateAgentConfig(clusterId, req.body || {}, orgId);
      return ApiResponse.success(res, 'Cập nhật cấu hình Agent thành công', result, 200);
    } catch (error) {
      next(error);
    }
  }

  public static async connectAgent(req: Request, res: Response, next: NextFunction) {
    try {
      const clusterId = req.params.clusterId || req.params.id;
      const orgId = req.params.orgId || req.orgMember?.organizationId;
      const result = await ClusterService.connectAgent(clusterId, orgId);
      return ApiResponse.success(res, 'Kích hoạt kết nối Agent thành công', result, 200);
    } catch (error) {
      next(error);
    }
  }

  public static async disconnectAgent(req: Request, res: Response, next: NextFunction) {
    try {
      const clusterId = req.params.clusterId || req.params.id;
      const orgId = req.params.orgId || req.orgMember?.organizationId;
      const result = await ClusterService.disconnectAgent(clusterId, orgId);
      return ApiResponse.success(res, 'Đã ngắt kết nối Agent thành công', result, 200);
    } catch (error) {
      next(error);
    }
  }

  public static async removeCluster(req: Request, res: Response, next: NextFunction) {
    try {
      const clusterId = req.params.clusterId || req.params.id;
      const orgId = req.params.orgId || req.orgMember?.organizationId;
      const result = await ClusterService.removeCluster(clusterId, orgId);
      return ApiResponse.success(res, 'Đã xóa Cụm Kubernetes thành công', result, 200);
    } catch (error) {
      next(error);
    }
  }
}
