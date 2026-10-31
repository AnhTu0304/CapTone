import crypto from 'crypto';
import { AlertRuleModel, IAlertRule, IAlertRuleFilters, IPaginatedAlertRules } from '../models/alertRule.model';
import {
  AlertMetricType,
  AlertOperator,
  AlertSeverity,
  validateMetricThresholdAndUnit,
} from '../schemas/alertRule.schema';
import { ApiError } from '../utils/apiError';
import { pool } from '../config/database';
import { RedisCacheService } from './redisCache.service';

export class AlertRuleService {
  /**
   * Helper to resolve active allowed organization IDs for the user
   */
  public static async resolveUserOrganizations(user: any): Promise<{
    isSuperAdmin: boolean;
    allowedOrgIds: string[];
    defaultOrgId?: string;
  }> {
    const roles: string[] = Array.isArray(user?.roles)
      ? user.roles.map((r: string) => r.trim().toUpperCase())
      : [];
    const isSuperAdmin = roles.includes('SUPER_ADMIN');

    if (isSuperAdmin) {
      return { isSuperAdmin: true, allowedOrgIds: [] };
    }

    if (!user?.id) {
      throw ApiError.unauthorized('Yêu cầu đăng nhập trước khi thực hiện');
    }

    const res = await pool.query(
      `SELECT organization_id FROM organization_members WHERE user_id = $1 AND status = 'ACTIVE'`,
      [user.id]
    );
    const allowedOrgIds = res.rows.map((r: any) => r.organization_id);

    // If user has organization_id on token/user record, include it
    if (user.organization_id && !allowedOrgIds.includes(user.organization_id)) {
      allowedOrgIds.push(user.organization_id);
    }

    return {
      isSuperAdmin: false,
      allowedOrgIds,
      defaultOrgId: allowedOrgIds[0] || undefined,
    };
  }

  /**
   * Enforce tenant authorization for an organization target
   */
  public static async enforceOrgAccess(user: any, requestedOrgId?: string): Promise<string> {
    const { isSuperAdmin, allowedOrgIds, defaultOrgId } = await this.resolveUserOrganizations(user);

    if (isSuperAdmin) {
      if (requestedOrgId) return requestedOrgId;
      if (defaultOrgId) return defaultOrgId;
      // If superadmin didn't provide orgId, get first org from DB
      const firstOrg = await pool.query('SELECT id FROM organizations LIMIT 1');
      if (firstOrg.rows[0]) return firstOrg.rows[0].id;
      throw ApiError.badRequest('Hệ thống chưa có tổ chức nào được khởi tạo');
    }

    if (requestedOrgId) {
      if (!allowedOrgIds.includes(requestedOrgId)) {
        throw ApiError.forbidden('Từ chối truy cập: Bạn không có quyền truy cập dữ liệu của tổ chức này');
      }
      return requestedOrgId;
    }

    if (defaultOrgId) {
      return defaultOrgId;
    }

    throw ApiError.forbidden('Từ chối truy cập: Tài khoản chưa thuộc tổ chức hoạt động nào');
  }

  /**
   * Invalidate Redis cache keys for an organization's alert rules
   */
  private static async invalidateOrgCache(organizationId: string): Promise<void> {
    try {
      await RedisCacheService.delByPattern(`alert_rules:${organizationId}:*`);
    } catch {
      // Fail-open
    }
  }

  /**
   * 1. Create Alert Rule
   */
  public static async createRule(
    user: any,
    data: {
      name: string;
      description?: string | null;
      organization_id?: string;
      cluster_id?: string | null;
      metric_type: AlertMetricType;
      operator: AlertOperator;
      threshold_value: number;
      unit: string;
      severity?: AlertSeverity;
      evaluation_window?: string;
      duration?: number;
      cooldown_seconds?: number;
      enabled?: boolean;
    }
  ): Promise<IAlertRule> {
    const targetOrgId = await this.enforceOrgAccess(user, data.organization_id);

    // Validate metric threshold and unit
    const validation = validateMetricThresholdAndUnit(
      data.metric_type,
      data.threshold_value,
      data.unit
    );
    if (!validation.isValid && validation.error) {
      throw ApiError.badRequest(validation.error);
    }

    // Verify cluster ownership if cluster_id is specified
    if (data.cluster_id && data.cluster_id.trim() !== '') {
      const isOwned = await AlertRuleModel.verifyClusterOwnership(
        data.cluster_id,
        targetOrgId
      );
      if (!isOwned) {
        throw ApiError.forbidden(
          'Từ chối truy cập: Cụm máy chủ (cluster_id) không tồn tại hoặc không thuộc quyền sở hữu của tổ chức này'
        );
      }
    }

    // Check duplicate name within organization
    const nameExists = await AlertRuleModel.checkNameExists(targetOrgId, data.name);
    if (nameExists) {
      throw new ApiError(
        409,
        `Cấu hình cảnh báo với tên '${data.name}' đã tồn tại trong tổ chức này`
      );
    }

    const createdRule = await AlertRuleModel.create({
      organization_id: targetOrgId,
      cluster_id: data.cluster_id ? data.cluster_id.trim() : null,
      name: data.name,
      description: data.description,
      metric_type: data.metric_type,
      operator: data.operator,
      threshold_value: data.threshold_value,
      unit: data.unit,
      severity: data.severity,
      evaluation_window: data.evaluation_window,
      duration: data.duration,
      cooldown_seconds: data.cooldown_seconds,
      enabled: data.enabled !== undefined ? data.enabled : true,
      created_by: user.id || null,
    });

    await this.invalidateOrgCache(targetOrgId);
    return createdRule;
  }

  /**
   * 2. Get Alert Rule Detail by ID with Anti-IDOR guard
   */
  public static async getRuleById(user: any, ruleId: string): Promise<IAlertRule> {
    const rule = await AlertRuleModel.findById(ruleId);
    if (!rule) {
      throw ApiError.notFound('Không tìm thấy cấu hình cảnh báo');
    }

    // Ensure user has access to rule's organization
    await this.enforceOrgAccess(user, rule.organization_id);
    return rule;
  }

  /**
   * 3. List Alert Rules with Pagination & Filtering & Redis Caching
   */
  public static async listRules(
    user: any,
    filters: IAlertRuleFilters & { organization_id?: string }
  ): Promise<IPaginatedAlertRules> {
    const targetOrgId = await this.enforceOrgAccess(user, filters.organization_id);

    // Cache key based on org and serialized filters
    const filterHash = crypto
      .createHash('md5')
      .update(JSON.stringify({ ...filters, organization_id: targetOrgId }))
      .digest('hex');
    const cacheKey = `alert_rules:${targetOrgId}:list:${filterHash}`;

    try {
      const cached = await RedisCacheService.get<IPaginatedAlertRules>(cacheKey);
      if (cached && Array.isArray(cached.items)) {
        return cached;
      }
    } catch {
      // Fallback directly to DB
    }

    const result = await AlertRuleModel.findByOrg(targetOrgId, filters);

    // Cache for 60 seconds
    try {
      await RedisCacheService.set(cacheKey, result, 60);
    } catch {
      // Fail-open
    }

    return result;
  }

  /**
   * 4. Update Alert Rule
   */
  public static async updateRule(
    user: any,
    ruleId: string,
    data: {
      name?: string;
      description?: string | null;
      cluster_id?: string | null;
      metric_type?: AlertMetricType;
      operator?: AlertOperator;
      threshold_value?: number;
      unit?: string;
      severity?: AlertSeverity;
      evaluation_window?: string;
      duration?: number;
      cooldown_seconds?: number;
      enabled?: boolean;
    }
  ): Promise<IAlertRule> {
    const existing = await AlertRuleModel.findById(ruleId);
    if (!existing) {
      throw ApiError.notFound('Không tìm thấy cấu hình cảnh báo cần cập nhật');
    }

    // Tenant check
    await this.enforceOrgAccess(user, existing.organization_id);

    // Validate metric + threshold + unit combination if any changed
    const effectiveMetricType = data.metric_type || existing.metric_type;
    const effectiveThreshold =
      data.threshold_value !== undefined ? data.threshold_value : existing.threshold_value;
    const effectiveUnit = data.unit !== undefined ? data.unit : existing.unit;

    const validation = validateMetricThresholdAndUnit(
      effectiveMetricType,
      effectiveThreshold,
      effectiveUnit
    );
    if (!validation.isValid && validation.error) {
      throw ApiError.badRequest(validation.error);
    }

    // Cluster ownership check if changing cluster_id
    if (data.cluster_id !== undefined && data.cluster_id && data.cluster_id.trim() !== '') {
      const isOwned = await AlertRuleModel.verifyClusterOwnership(
        data.cluster_id,
        existing.organization_id
      );
      if (!isOwned) {
        throw ApiError.forbidden(
          'Từ chối truy cập: Cụm máy chủ (cluster_id) không tồn tại hoặc không thuộc quyền sở hữu của tổ chức này'
        );
      }
    }

    // Duplicate name check if changing name
    if (data.name && data.name.trim().toLowerCase() !== existing.name.toLowerCase()) {
      const nameExists = await AlertRuleModel.checkNameExists(
        existing.organization_id,
        data.name,
        ruleId
      );
      if (nameExists) {
        throw new ApiError(
          409,
          `Cấu hình cảnh báo với tên '${data.name}' đã tồn tại trong tổ chức này`
        );
      }
    }

    const updated = await AlertRuleModel.update(ruleId, existing.organization_id, data);
    if (!updated) {
      throw ApiError.notFound('Không thể cập nhật cấu hình cảnh báo');
    }

    await this.invalidateOrgCache(existing.organization_id);
    return updated;
  }

  /**
   * 5. Toggle Alert Rule Status
   */
  public static async toggleRuleStatus(
    user: any,
    ruleId: string,
    enabled: boolean
  ): Promise<IAlertRule> {
    const existing = await AlertRuleModel.findById(ruleId);
    if (!existing) {
      throw ApiError.notFound('Không tìm thấy cấu hình cảnh báo cần cập nhật trạng thái');
    }

    await this.enforceOrgAccess(user, existing.organization_id);

    const updated = await AlertRuleModel.toggleStatus(ruleId, existing.organization_id, enabled);
    if (!updated) {
      throw ApiError.notFound('Không thể thay đổi trạng thái cấu hình cảnh báo');
    }

    await this.invalidateOrgCache(existing.organization_id);
    return updated;
  }

  /**
   * 6. Delete Alert Rule
   */
  public static async deleteRule(user: any, ruleId: string): Promise<{ id: string }> {
    const existing = await AlertRuleModel.findById(ruleId);
    if (!existing) {
      throw ApiError.notFound('Không tìm thấy cấu hình cảnh báo cần xóa');
    }

    await this.enforceOrgAccess(user, existing.organization_id);

    const deleted = await AlertRuleModel.delete(ruleId, existing.organization_id);
    if (!deleted) {
      throw ApiError.notFound('Không thể xóa cấu hình cảnh báo');
    }

    await this.invalidateOrgCache(existing.organization_id);
    return { id: ruleId };
  }
}
