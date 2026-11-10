import { ClusterModel, IClusterDetail } from '../models/cluster.model';
import { EnvironmentModel } from '../models/environment.model';
import { ApiError } from '../utils/apiError';
import { pool } from '../config/database';
import type { IAuditRequestContext } from './audit.service';

export class ClusterService {
  public static async getClustersByOrg(orgId: string): Promise<IClusterDetail[]> {
    if (!orgId) {
      throw new ApiError(400, 'Mã tổ chức không hợp lệ');
    }
    const clusters = await ClusterModel.findByOrganization(orgId);
    return clusters;
  }

  public static async getAllClusters(userId?: string): Promise<IClusterDetail[]> {
    if (userId) {
      const memberRes = await pool.query(
        `SELECT organization_id FROM organization_members WHERE user_id = $1 AND status = 'ACTIVE'`,
        [userId]
      );
      const userOrgIds = memberRes.rows.map((r) => r.organization_id);
      return ClusterModel.findAll(userOrgIds);
    }
    return ClusterModel.findAll();
  }

  public static async getClusterDetail(clusterId: string, orgId?: string, userId?: string): Promise<any> {
    if (!clusterId) {
      throw new ApiError(400, 'Mã cụm Kubernetes không hợp lệ');
    }
    if (userId) {
      const memberRes = await pool.query(
        `SELECT organization_id FROM organization_members WHERE user_id = $1 AND status = 'ACTIVE'`,
        [userId]
      );
      const userOrgIds = memberRes.rows.map((r) => r.organization_id);
      if (orgId && !userOrgIds.includes(orgId)) {
        throw new ApiError(403, 'Từ chối truy cập: Bạn không thuộc tổ chức này');
      }
      if (userOrgIds.length === 0) {
        throw new ApiError(403, 'Từ chối truy cập: Tài khoản chưa thuộc tổ chức hoạt động nào');
      }
      const clusterRes = await pool.query(
        `SELECT c.id, e.organization_id FROM clusters c JOIN environments e ON c.environment_id = e.id WHERE (c.id::text = $1 OR c.name = $1) AND c.deleted_at IS NULL LIMIT 1`,
        [clusterId]
      );
      if (clusterRes.rows[0]) {
        const clusterOrg = clusterRes.rows[0].organization_id;
        if (!userOrgIds.includes(clusterOrg)) {
          throw new ApiError(403, 'Từ chối truy cập: Bạn không có quyền truy cập cụm Kubernetes của tổ chức khác');
        }
      }
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
    orgId?: string,
    userId?: string,
    reqContext?: IAuditRequestContext
  ) {
    if (!clusterId) {
      throw new ApiError(400, 'Mã cụm Kubernetes không hợp lệ');
    }
    if (orgId || userId) {
      await this.getClusterDetail(clusterId, orgId, userId);
    }
    return await ClusterModel.rotateAgentToken(clusterId, data, orgId, undefined, {
      ...reqContext,
      user_id: reqContext?.user_id || userId || null,
    });
  }

  public static async revokeAgentToken(
    clusterId: string,
    tokenId: string,
    orgId?: string,
    userId?: string,
    reqContext?: IAuditRequestContext
  ) {
    if (!clusterId || !tokenId) {
      throw new ApiError(400, 'Mã cụm hoặc mã Token không hợp lệ');
    }
    if (orgId || userId) {
      await this.getClusterDetail(clusterId, orgId, userId);
    }
    const revoked = await ClusterModel.revokeAgentToken(clusterId, tokenId, orgId, undefined, {
      ...reqContext,
      user_id: reqContext?.user_id || userId || null,
    });
    if (!revoked) {
      throw new ApiError(404, 'Không tìm thấy Token hoặc Token không thuộc cụm chỉ định');
    }
    return revoked;
  }

  public static async updateAgentConfig(
    clusterId: string,
    configData: any,
    orgId?: string,
    userId?: string,
    reqContext?: IAuditRequestContext
  ) {
    if (!clusterId) {
      throw new ApiError(400, 'Mã cụm Kubernetes không hợp lệ');
    }
    if (orgId || userId) {
      await this.getClusterDetail(clusterId, orgId, userId);
    }
    return await ClusterModel.updateAgentConfig(clusterId, configData, undefined, {
      ...reqContext,
      user_id: reqContext?.user_id || userId || null,
    });
  }

  public static async connectAgent(
    clusterId: string,
    orgId?: string,
    userId?: string,
    reqContext?: IAuditRequestContext
  ) {
    if (!clusterId) {
      throw new ApiError(400, 'Mã cụm Kubernetes không hợp lệ');
    }
    if (orgId || userId) {
      await this.getClusterDetail(clusterId, orgId, userId);
    }
    return await ClusterModel.connectAgent(clusterId, undefined, {
      ...reqContext,
      user_id: reqContext?.user_id || userId || null,
    });
  }

  public static async disconnectAgent(
    clusterId: string,
    orgId?: string,
    userId?: string,
    reqContext?: IAuditRequestContext
  ) {
    if (!clusterId) {
      throw new ApiError(400, 'Mã cụm Kubernetes không hợp lệ');
    }
    if (orgId || userId) {
      await this.getClusterDetail(clusterId, orgId, userId);
    }
    return await ClusterModel.disconnectAgent(clusterId, undefined, {
      ...reqContext,
      user_id: reqContext?.user_id || userId || null,
    });
  }

  public static async removeCluster(
    clusterId: string,
    orgId?: string,
    force?: boolean,
    userId?: string,
    reqContext?: IAuditRequestContext
  ) {
    if (!clusterId) {
      throw new ApiError(400, 'Mã cụm Kubernetes không hợp lệ');
    }
    if (orgId || userId) {
      await this.getClusterDetail(clusterId, orgId, userId);
    }
    try {
      return await ClusterModel.removeCluster(clusterId, orgId, force, undefined, {
        ...reqContext,
        user_id: reqContext?.user_id || userId || null,
      });
    } catch (err: any) {
      if (err.message === 'CANNOT_DELETE_ONLINE_CLUSTER') {
        throw new ApiError(400, 'Không thể xóa Cụm Kubernetes khi Agent đang hoạt động (ONLINE). Vui lòng ngắt kết nối Agent hoặc xác nhận xóa bắt buộc.');
      }
      throw err;
    }
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
    },
    reqContext?: IAuditRequestContext
  ): Promise<any> {
    if (!data.name || !data.name.trim()) {
      throw new ApiError(400, 'Tên cụm Kubernetes là bắt buộc');
    }

    let envId = data.environment_id;

    if (envId) {
      const targetEnv = await EnvironmentModel.findById(envId);
      if (!targetEnv || targetEnv.organization_id !== orgId) {
        throw new ApiError(404, 'Môi trường không tồn tại hoặc không thuộc tổ chức');
      }
    } else {
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

    const cluster = await ClusterModel.create(
      {
        environment_id: envId,
        name: data.name.trim(),
        provider: data.provider || 'MINIKUBE',
        endpoint: data.endpoint,
        kubernetes_version: data.kubernetes_version || 'v1.29.4',
        status: 'CONNECTED',
      },
      undefined,
      reqContext
    );

    return cluster;
  }
}
