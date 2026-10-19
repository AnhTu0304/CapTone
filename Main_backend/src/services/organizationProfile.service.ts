import { PoolClient } from 'pg';
import {
  IOrganizationProfile,
  ICreateOrganizationProfileDto,
  IUpdateOrganizationProfileDto,
  OrganizationProfileModel,
} from '../models/organizationProfile.model';

/**
 * Service xử lý logic nghiệp vụ cho Hồ sơ Tổ chức (Organization Profiles)
 * Ủy thác toàn bộ truy vấn dữ liệu cho OrganizationProfileModel
 */
export class OrganizationProfileService {
  /**
   * 1. Lấy thông tin hồ sơ theo ID tổ chức
   */
  public static async getByOrganizationId(
    organizationId: string,
    client?: PoolClient
  ): Promise<IOrganizationProfile | null> {
    return OrganizationProfileModel.findByOrganizationId(organizationId, client);
  }

  /**
   * 2. Tạo hồ sơ mới cho tổ chức
   */
  public static async create(
    dto: ICreateOrganizationProfileDto,
    client?: PoolClient
  ): Promise<IOrganizationProfile> {
    return OrganizationProfileModel.create(client, dto);
  }

  /**
   * 3. Cập nhật hồ sơ tổ chức
   */
  public static async update(
    organizationId: string,
    dto: IUpdateOrganizationProfileDto,
    client?: PoolClient
  ): Promise<IOrganizationProfile | null> {
    return OrganizationProfileModel.update(client, organizationId, dto);
  }

  /**
   * 4. Upsert hồ sơ (Tạo mới nếu chưa có, cập nhật nếu đã có)
   */
  public static async upsert(
    organizationId: string,
    dto: IUpdateOrganizationProfileDto,
    client?: PoolClient
  ): Promise<IOrganizationProfile> {
    const existing = await OrganizationProfileModel.findByOrganizationId(organizationId, client);
    if (!existing) {
      return OrganizationProfileModel.create(client, { organization_id: organizationId, ...dto });
    }
    const updated = await OrganizationProfileModel.update(client, organizationId, dto);
    return updated || existing;
  }

  /**
   * 5. Xóa hồ sơ tổ chức
   */
  public static async delete(
    organizationId: string,
    client?: PoolClient
  ): Promise<boolean> {
    return OrganizationProfileModel.delete(client, organizationId);
  }
}
