import {
  EnvironmentModel,
  ICreateEnvironmentInput,
  IUpdateEnvironmentInput,
  IEnvironmentQueryOptions,
  IEnvironment,
} from '../models/environment.model';
import { OrganizationModel } from '../models/organization.model';
import { ApiError } from '../utils/apiError';

export class EnvironmentService {
  /**
   * Tạo môi trường mới trong tổ chức
   */
  public static async create(
    organizationId: string,
    userId: string,
    data: Omit<ICreateEnvironmentInput, 'organization_id' | 'created_by'>
  ): Promise<IEnvironment> {
    // 1. Kiểm tra tổ chức tồn tại
    const org = await OrganizationModel.findById(organizationId);
    if (!org) {
      throw ApiError.notFound('Tổ chức không tồn tại');
    }

    // 2. Kiểm tra trùng lặp mã code trong cùng tổ chức
    const existingCode = await EnvironmentModel.findByCode(organizationId, data.code);
    if (existingCode) {
      throw ApiError.badRequest(
        `Mã môi trường '${data.code}' đã tồn tại trong tổ chức. Vui lòng chọn mã khác.`
      );
    }

    // 3. Tạo môi trường
    return await EnvironmentModel.create({
      ...data,
      organization_id: organizationId,
      created_by: userId,
    });
  }

  /**
   * Lấy danh sách môi trường của một tổ chức
   */
  public static async getByOrg(
    organizationId: string,
    options: IEnvironmentQueryOptions = {}
  ) {
    const org = await OrganizationModel.findById(organizationId);
    if (!org) {
      throw ApiError.notFound('Tổ chức không tồn tại');
    }

    return await EnvironmentModel.findByOrgId(organizationId, options);
  }

  /**
   * Xem chi tiết một môi trường
   */
  public static async getById(organizationId: string, id: string): Promise<IEnvironment> {
    const env = await EnvironmentModel.findById(id);
    if (!env || env.organization_id !== organizationId) {
      throw ApiError.notFound('Môi trường không tồn tại hoặc không thuộc tổ chức này');
    }

    return env;
  }

  /**
   * Cập nhật thông tin môi trường
   */
  public static async update(
    organizationId: string,
    id: string,
    data: IUpdateEnvironmentInput
  ): Promise<IEnvironment> {
    // 1. Kiểm tra môi trường tồn tại
    const env = await this.getById(organizationId, id);

    // 2. Cập nhật dữ liệu
    const updated = await EnvironmentModel.update(env.id, data);
    if (!updated) {
      throw ApiError.internal('Không thể cập nhật thông tin môi trường');
    }

    return updated;
  }

  /**
   * Xóa mềm môi trường (Soft Delete có kiểm tra an toàn hạ tầng)
   */
  public static async delete(organizationId: string, id: string): Promise<boolean> {
    // 1. Kiểm tra môi trường tồn tại
    const env = await this.getById(organizationId, id);

    // 2. Kiểm tra an toàn: Có cụm K8s nào đang gắn vào môi trường này không?
    const clusterCount = await EnvironmentModel.countClusters(env.id);
    if (clusterCount > 0) {
      throw ApiError.badRequest(
        `Không thể xóa môi trường '${env.name}' vì đang có ${clusterCount} cụm Kubernetes liên kết. Vui lòng gỡ bỏ hoặc chuyển cụm trước.`
      );
    }

    // 3. Kiểm tra an toàn: Có Agent nào đang gắn vào môi trường này không?
    const agentCount = await EnvironmentModel.countAgents(env.id);
    if (agentCount > 0) {
      throw ApiError.badRequest(
        `Không thể xóa môi trường '${env.name}' vì đang có ${agentCount} Agent kết nối. Vui lòng thu hồi Agent trước.`
      );
    }

    // 4. Thực hiện xóa mềm
    return await EnvironmentModel.softDelete(env.id);
  }

  /**
   * Thống kê tổng quan số lượng môi trường theo từng loại (DEV vs STAGING)
   */
  public static async getSummary(organizationId: string) {
    const devList = await EnvironmentModel.findByOrgId(organizationId, { type: 'DEVELOPMENT', limit: 100 });
    const stagingList = await EnvironmentModel.findByOrgId(organizationId, { type: 'STAGING', limit: 100 });

    const totalClustersDev = devList.environments.reduce((acc, e) => acc + (e.clusters_count || 0), 0);
    const totalClustersStaging = stagingList.environments.reduce((acc, e) => acc + (e.clusters_count || 0), 0);

    return {
      total_environments: devList.total + stagingList.total,
      development: {
        count: devList.total,
        clusters_count: totalClustersDev,
        environments: devList.environments,
      },
      staging: {
        count: stagingList.total,
        clusters_count: totalClustersStaging,
        environments: stagingList.environments,
      },
    };
  }
}
