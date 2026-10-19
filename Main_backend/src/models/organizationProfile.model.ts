import { PoolClient } from 'pg';
import { pool } from '../config/database';

/**
 * Model và Kiểu dữ liệu cho Hồ sơ Tổ chức (Organization Profiles)
 * Khớp với bảng `organization_profiles` trong PostgreSQL
 */

export interface IOrganizationProfile {
  id: string;
  organization_id: string;
  description?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  timezone: string;
  created_at: Date;
  updated_at: Date;
}

export interface ICreateOrganizationProfileDto {
  organization_id: string;
  description?: string;
  email?: string;
  phone?: string;
  website?: string;
  address?: string;
  city?: string;
  country?: string;
  timezone?: string;
}

export interface IUpdateOrganizationProfileDto {
  description?: string;
  email?: string;
  phone?: string;
  website?: string;
  address?: string;
  city?: string;
  country?: string;
  timezone?: string;
}

export class OrganizationProfileModel {
  /**
   * Tìm hồ sơ theo ID tổ chức
   */
  public static async findByOrganizationId(
    organizationId: string,
    client?: PoolClient
  ): Promise<IOrganizationProfile | null> {
    const db = client || pool;
    const query = `
      SELECT id, organization_id, description, email, phone, website, address, city, country, timezone, created_at, updated_at
      FROM organization_profiles
      WHERE organization_id = $1
      LIMIT 1;
    `;
    const res = await db.query<IOrganizationProfile>(query, [organizationId]);
    return res.rows[0] || null;
  }

  /**
   * Tạo mới hồ sơ cho tổ chức
   */
  public static async create(
    client: PoolClient | undefined,
    dto: ICreateOrganizationProfileDto
  ): Promise<IOrganizationProfile> {
    const db = client || pool;
    const query = `
      INSERT INTO organization_profiles (
        organization_id, description, email, phone, website, address, city, country, timezone
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9
      ) RETURNING *;
    `;
    const res = await db.query<IOrganizationProfile>(query, [
      dto.organization_id,
      dto.description?.trim() || null,
      dto.email?.trim() || null,
      dto.phone?.trim() || null,
      dto.website?.trim() || null,
      dto.address?.trim() || null,
      dto.city?.trim() || null,
      dto.country?.trim() || null,
      dto.timezone?.trim() || 'Asia/Ho_Chi_Minh',
    ]);
    return res.rows[0];
  }

  /**
   * Cập nhật hồ sơ tổ chức
   */
  public static async update(
    client: PoolClient | undefined,
    organizationId: string,
    dto: IUpdateOrganizationProfileDto
  ): Promise<IOrganizationProfile | null> {
    const db = client || pool;
    const updates: string[] = [];
    const params: any[] = [organizationId];
    let paramIndex = 2;

    if (dto.description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      params.push(dto.description.trim() || null);
    }
    if (dto.email !== undefined) {
      updates.push(`email = $${paramIndex++}`);
      params.push(dto.email.trim() || null);
    }
    if (dto.phone !== undefined) {
      updates.push(`phone = $${paramIndex++}`);
      params.push(dto.phone.trim() || null);
    }
    if (dto.website !== undefined) {
      updates.push(`website = $${paramIndex++}`);
      params.push(dto.website.trim() || null);
    }
    if (dto.address !== undefined) {
      updates.push(`address = $${paramIndex++}`);
      params.push(dto.address.trim() || null);
    }
    if (dto.city !== undefined) {
      updates.push(`city = $${paramIndex++}`);
      params.push(dto.city.trim() || null);
    }
    if (dto.country !== undefined) {
      updates.push(`country = $${paramIndex++}`);
      params.push(dto.country.trim() || null);
    }
    if (dto.timezone !== undefined) {
      updates.push(`timezone = $${paramIndex++}`);
      params.push(dto.timezone.trim() || 'Asia/Ho_Chi_Minh');
    }

    if (updates.length === 0) {
      return this.findByOrganizationId(organizationId, client);
    }

    updates.push('updated_at = NOW()');

    const updateSql = `
      UPDATE organization_profiles
      SET ${updates.join(', ')}
      WHERE organization_id = $1
      RETURNING *;
    `;
    const res = await db.query<IOrganizationProfile>(updateSql, params);
    return res.rows[0] || null;
  }

  /**
   * Xóa hồ sơ tổ chức
   */
  public static async delete(
    client: PoolClient | undefined,
    organizationId: string
  ): Promise<boolean> {
    const db = client || pool;
    const res = await db.query(
      'DELETE FROM organization_profiles WHERE organization_id = $1;',
      [organizationId]
    );
    return (res.rowCount || 0) > 0;
  }
}
