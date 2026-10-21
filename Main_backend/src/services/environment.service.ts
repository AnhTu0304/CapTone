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

    // 2. Ràng buộc nghiệp vụ: Mỗi tổ chức chỉ được đăng ký duy nhất 1 trong 2 loại môi trường (DEV hoặc STAGING)
    const existingEnv = await EnvironmentModel.findActiveByOrgId(organizationId);
    if (existingEnv) {
      throw ApiError.badRequest(
        `Tổ chức này đã đăng ký môi trường '${existingEnv.name}' (${existingEnv.environment_type}). Mỗi tổ chức chỉ được phép đăng ký duy nhất 1 trong 2 loại môi trường (DEV hoặc STAGING). Vui lòng xóa môi trường hiện tại nếu muốn đổi sang môi trường khác.`
      );
    }

    // 3. Kiểm tra trùng lặp mã code trong cùng tổ chức
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
   * Thống kê tổng quan số lượng môi trường và cụm K8s theo từng loại
   */
  public static async getSummary(organizationId: string) {
    const allEnvs = await EnvironmentModel.findByOrgId(organizationId, { limit: 100 });
    const byType: Record<string, { count: number; clusters_count: number; environments: IEnvironment[] }> = {};

    for (const env of allEnvs.environments) {
      const typeKey = env.environment_type;
      if (!byType[typeKey]) {
        byType[typeKey] = { count: 0, clusters_count: 0, environments: [] };
      }
      byType[typeKey].count += 1;
      byType[typeKey].clusters_count += env.clusters_count || 0;
      byType[typeKey].environments.push(env);
    }

    const devData = byType['DEV'] || byType['DEVELOPMENT'] || { count: 0, clusters_count: 0, environments: [] };
    const stagingData = byType['STAGING'] || { count: 0, clusters_count: 0, environments: [] };

    return {
      total_environments: allEnvs.total,
      by_type: byType,
      dev: devData,
      staging: stagingData,
      development: devData,
    };
  }
}
