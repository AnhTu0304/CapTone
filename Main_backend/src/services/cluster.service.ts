import { ClusterModel, IClusterDetail } from '../models/cluster.model';
import { EnvironmentModel } from '../models/environment.model';
import { ApiError } from '../utils/apiError';

export class ClusterService {
  /**
   * Lấy danh sách cụm Kubernetes của một tổ chức
   */
  public static async getClustersByOrg(orgId: string): Promise<IClusterDetail[]> {
    if (!orgId) {
      throw new ApiError(400, 'Mã tổ chức không hợp lệ');
    }
    const clusters = await ClusterModel.findByOrganization(orgId);
    return clusters;
  }

  /**
   * Lấy toàn bộ danh sách cụm Kubernetes hệ thống (Platform Admin)
   */
  public static async getAllClusters(): Promise<IClusterDetail[]> {
    return ClusterModel.findAll();
  }

  /**
   * Lấy chi tiết toàn diện cụm Kubernetes (Nodes, Pods, Namespaces, Agent)
   */
  public static async getClusterDetail(clusterId: string, orgId?: string): Promise<any> {
    if (!clusterId) {
      throw new ApiError(400, 'Mã cụm Kubernetes không hợp lệ');
    }
    const detail = await ClusterModel.findFullDetailById(clusterId, orgId);
    if (!detail) {
      throw new ApiError(404, 'Không tìm thấy cụm Kubernetes yêu cầu');
    }
    return detail;
  }

  /**
   * Cấp mới hoặc xoay vòng Token kết nối của Agent cho cụm K8s
   */
  public static async rotateAgentToken(
    clusterId: string,
    data: { expires_in_days?: number | null; revoke_previous?: boolean }
  ) {
    if (!clusterId) {
      throw new ApiError(400, 'Mã cụm Kubernetes không hợp lệ');
    }
    return await ClusterModel.rotateAgentToken(clusterId, data);
  }

  /**
   * Thu hồi Token kết nối của Agent thuộc cụm K8s
   */
  public static async revokeAgentToken(clusterId: string, tokenId: string) {
    if (!clusterId || !tokenId) {
      throw new ApiError(400, 'Mã cụm hoặc mã Token không hợp lệ');
    }
    return await ClusterModel.revokeAgentToken(clusterId, tokenId);
  }

  /**
   * Cập nhật cấu hình Agent
   */
  public static async updateAgentConfig(clusterId: string, configData: any) {
    if (!clusterId) {
      throw new ApiError(400, 'Mã cụm Kubernetes không hợp lệ');
    }
    return await ClusterModel.updateAgentConfig(clusterId, configData);
  }

  /**
   * Kích hoạt kết nối Agent
   */
  public static async connectAgent(clusterId: string) {
    if (!clusterId) {
      throw new ApiError(400, 'Mã cụm Kubernetes không hợp lệ');
    }
    return await ClusterModel.connectAgent(clusterId);
  }

  /**
   * Ngắt kết nối Agent
   */
  public static async disconnectAgent(clusterId: string) {
    if (!clusterId) {
      throw new ApiError(400, 'Mã cụm Kubernetes không hợp lệ');
    }
    return await ClusterModel.disconnectAgent(clusterId);
  }

  /**
   * Xóa cấu hình Cụm Kubernetes
   */
  public static async removeCluster(clusterId: string) {
    if (!clusterId) {
      throw new ApiError(400, 'Mã cụm Kubernetes không hợp lệ');
    }
    return await ClusterModel.removeCluster(clusterId);
  }

  /**
   * Đăng ký tạo cụm Kubernetes mới cho tổ chức
   */
  public static async createCluster(
    orgId: string,
    data: {
      name: string;
      environment_id?: string;
      environment_type?: 'PRODUCTION' | 'STAGING' | 'DEV';
      provider?: string;
      endpoint?: string;
      kubernetes_version?: string;
    }
  ): Promise<any> {
    if (!data.name || !data.name.trim()) {
      throw new ApiError(400, 'Tên cụm Kubernetes là bắt buộc');
    }

    let envId = data.environment_id;

    // Nếu không truyền environment_id, tìm môi trường sẵn có của org hoặc tạo mới
    if (!envId) {
      const activeEnv = await EnvironmentModel.findActiveByOrgId(orgId);
      if (activeEnv) {
        envId = activeEnv.id;
      } else {
        const envCode = `env-${Date.now().toString(36)}`;
        const defaultEnv = await EnvironmentModel.create({
          organization_id: orgId,
          name: 'Production',
          code: envCode,
          environment_type: data.environment_type || 'PRODUCTION',
          description: 'Môi trường vận hành mặc định',
        });
        envId = defaultEnv.id;
      }
    }

    const cluster = await ClusterModel.create({
      environment_id: envId,
      name: data.name.trim(),
      provider: data.provider || 'MINIKUBE',
      endpoint: data.endpoint,
      kubernetes_version: data.kubernetes_version || 'v1.29.4',
      status: 'CONNECTED',
    });

    return cluster;
  }
}
