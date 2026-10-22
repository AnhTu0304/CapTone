import { ClusterModel, IClusterDetail } from '../models/cluster.model';
import { EnvironmentModel } from '../models/environment.model';
import { ApiError } from '../utils/apiError';

export class ClusterService {
  public static async getClustersByOrg(orgId: string): Promise<IClusterDetail[]> {
    if (!orgId) {
      throw new ApiError(400, 'Mã tổ chức không hợp lệ');
    }
    const clusters = await ClusterModel.findByOrganization(orgId);
    return clusters;
  }

  public static async getAllClusters(): Promise<IClusterDetail[]> {
    return ClusterModel.findAll();
  }

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

  public static async rotateAgentToken(
    clusterId: string,
    data: { expires_in_days?: number | null; revoke_previous?: boolean },
    orgId?: string
  ) {
    if (!clusterId) {
      throw new ApiError(400, 'Mã cụm Kubernetes không hợp lệ');
    }
    if (orgId) {
      await this.getClusterDetail(clusterId, orgId);
    }
    return await ClusterModel.rotateAgentToken(clusterId, data);
  }

  public static async revokeAgentToken(clusterId: string, tokenId: string, orgId?: string) {
    if (!clusterId || !tokenId) {
      throw new ApiError(400, 'Mã cụm hoặc mã Token không hợp lệ');
    }
    if (orgId) {
      await this.getClusterDetail(clusterId, orgId);
    }
    return await ClusterModel.revokeAgentToken(clusterId, tokenId);
  }

  public static async updateAgentConfig(clusterId: string, configData: any, orgId?: string) {
    if (!clusterId) {
      throw new ApiError(400, 'Mã cụm Kubernetes không hợp lệ');
    }
    if (orgId) {
      await this.getClusterDetail(clusterId, orgId);
    }
    return await ClusterModel.updateAgentConfig(clusterId, configData);
  }

  public static async connectAgent(clusterId: string, orgId?: string) {
    if (!clusterId) {
      throw new ApiError(400, 'Mã cụm Kubernetes không hợp lệ');
    }
    if (orgId) {
      await this.getClusterDetail(clusterId, orgId);
    }
    return await ClusterModel.connectAgent(clusterId);
  }

  public static async disconnectAgent(clusterId: string, orgId?: string) {
    if (!clusterId) {
      throw new ApiError(400, 'Mã cụm Kubernetes không hợp lệ');
    }
    if (orgId) {
      await this.getClusterDetail(clusterId, orgId);
    }
    return await ClusterModel.disconnectAgent(clusterId);
  }

  public static async removeCluster(clusterId: string, orgId?: string) {
    if (!clusterId) {
      throw new ApiError(400, 'Mã cụm Kubernetes không hợp lệ');
    }
    if (orgId) {
      await this.getClusterDetail(clusterId, orgId);
    }
    return await ClusterModel.removeCluster(clusterId, orgId);
  }

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
