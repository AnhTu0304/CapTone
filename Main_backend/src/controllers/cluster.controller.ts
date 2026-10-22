import { Request, Response, NextFunction } from 'express';
import { ClusterService } from '../services/cluster.service';
import { ApiResponse } from '../utils/apiResponse';

export class ClusterController {
  /**
   * [GET] /api/v1/organizations/:orgId/clusters
   * Lấy danh sách cụm Kubernetes thuộc tổ chức
   */
  public static async getByOrg(req: Request, res: Response, next: NextFunction) {
    try {
      const orgId = req.params.orgId || req.params.id;
      const clusters = await ClusterService.getClustersByOrg(orgId);
      return ApiResponse.success(res, 'Lấy danh sách cụm Kubernetes thành công', clusters, 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * [GET] /api/v1/clusters
   * Lấy toàn bộ danh sách cụm Kubernetes toàn sàn
   */
  public static async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const clusters = await ClusterService.getAllClusters();
      return ApiResponse.success(res, 'Lấy danh sách cụm Kubernetes hệ thống thành công', clusters, 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * [GET] /api/v1/organizations/:orgId/clusters/:clusterId
   * [GET] /api/v1/clusters/:clusterId
   * Lấy chi tiết toàn diện cụm Kubernetes kèm Nodes, Pods, Agent
   */
  public static async getDetail(req: Request, res: Response, next: NextFunction) {
    try {
      const clusterId = req.params.clusterId || req.params.id;
      const orgId = req.params.orgId || (req.params.clusterId ? req.params.id : undefined);
      const detail = await ClusterService.getClusterDetail(clusterId, orgId);
      return ApiResponse.success(res, 'Lấy chi tiết cụm Kubernetes thành công', detail, 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * [POST] /api/v1/organizations/:orgId/clusters
   * Đăng ký cụm Kubernetes mới cho tổ chức
   */
  public static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const orgId = req.params.orgId || req.params.id;
      const cluster = await ClusterService.createCluster(orgId, req.body);
      return ApiResponse.success(res, 'Đăng ký cụm Kubernetes thành công', cluster, 201);
    } catch (error) {
      next(error);
    }
  }

  /**
   * [POST] /api/v1/organizations/:orgId/clusters/:clusterId/rotate-token
   * [POST] /api/v1/clusters/:clusterId/rotate-token
   * Xoay vòng hoặc tạo mới Token kết nối cho Agent của cụm K8s
   */
  public static async rotateToken(req: Request, res: Response, next: NextFunction) {
    try {
      const clusterId = req.params.clusterId || req.params.id;
      const result = await ClusterService.rotateAgentToken(clusterId, req.body || {});
      return ApiResponse.success(res, 'Cấp mới / Xoay vòng Token Agent thành công', result, 201);
    } catch (error) {
      next(error);
    }
  }

  /**
   * [DELETE] /api/v1/organizations/:orgId/clusters/:clusterId/tokens/:tokenId
   * [DELETE] /api/v1/clusters/:clusterId/tokens/:tokenId
   * Thu hồi Token kết nối của Agent
   */
  public static async revokeToken(req: Request, res: Response, next: NextFunction) {
    try {
      const clusterId = req.params.clusterId || req.params.id;
      const tokenId = req.params.tokenId;
      const result = await ClusterService.revokeAgentToken(clusterId, tokenId);
      return ApiResponse.success(res, 'Thu hồi Token Agent thành công', result, 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * [PUT] /api/v1/organizations/:orgId/clusters/:clusterId/agent-config
   * [PUT] /api/v1/clusters/:clusterId/agent-config
   * Cập nhật cấu hình Agent
   */
  public static async updateConfig(req: Request, res: Response, next: NextFunction) {
    try {
      const clusterId = req.params.clusterId || req.params.id;
      const result = await ClusterService.updateAgentConfig(clusterId, req.body || {});
      return ApiResponse.success(res, 'Cập nhật cấu hình Agent thành công', result, 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * [POST] /api/v1/organizations/:orgId/clusters/:clusterId/connect-agent
   * [POST] /api/v1/clusters/:clusterId/connect-agent
   * Kích hoạt hoặc kết nối Agent thành công
   */
  public static async connectAgent(req: Request, res: Response, next: NextFunction) {
    try {
      const clusterId = req.params.clusterId || req.params.id;
      const result = await ClusterService.connectAgent(clusterId);
      return ApiResponse.success(res, 'Kích hoạt kết nối Agent thành công', result, 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * [POST] /api/v1/organizations/:orgId/clusters/:clusterId/disconnect-agent
   * [POST] /api/v1/clusters/:clusterId/disconnect-agent
   * Ngắt kết nối Agent
   */
  public static async disconnectAgent(req: Request, res: Response, next: NextFunction) {
    try {
      const clusterId = req.params.clusterId || req.params.id;
      const result = await ClusterService.disconnectAgent(clusterId);
      return ApiResponse.success(res, 'Đã ngắt kết nối Agent thành công', result, 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * [DELETE] /api/v1/organizations/:orgId/clusters/:clusterId
   * [DELETE] /api/v1/clusters/:clusterId
   * Xóa cấu hình Cụm Kubernetes
   */
  public static async removeCluster(req: Request, res: Response, next: NextFunction) {
    try {
      const clusterId = req.params.clusterId || req.params.id;
      const result = await ClusterService.removeCluster(clusterId);
      return ApiResponse.success(res, 'Đã xóa Cụm Kubernetes thành công', result, 200);
    } catch (error) {
      next(error);
    }
  }
}
