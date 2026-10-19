import { PoolClient } from 'pg';
import { IOrganizationRole, OrganizationRoleModel } from '../models/organizationRole.model';

/**
 * Service xử lý logic nghiệp vụ cho Vai trò Tổ chức (Organization Roles)
 * Ủy thác toàn bộ truy vấn dữ liệu cho OrganizationRoleModel
 */
export class OrganizationRoleService {
  /**
   * 1. Lấy toàn bộ danh sách vai trò tổ chức (SME_OWNER, DEVOPS, VIEWER)
   */
  public static async getAllRoles(client?: PoolClient): Promise<IOrganizationRole[]> {
    return OrganizationRoleModel.findAll(client);
  }

  /**
   * 2. Lấy thông tin vai trò theo mã Code
   */
  public static async getByCode(
    code: string,
    client?: PoolClient
  ): Promise<IOrganizationRole | null> {
    return OrganizationRoleModel.findByCode(code, client);
  }

  /**
   * 3. Lấy thông tin vai trò theo ID (UUID)
   */
  public static async getById(
    id: string,
    client?: PoolClient
  ): Promise<IOrganizationRole | null> {
    return OrganizationRoleModel.findById(id, client);
  }
}
