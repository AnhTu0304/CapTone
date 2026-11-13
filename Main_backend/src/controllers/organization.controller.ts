import { Request, Response, NextFunction } from 'express';
import { OrganizationService } from '../services/organization.service';
import { OrganizationRoleService } from '../services/organizationRole.service';
import { OrganizationAlertSettingsModel } from '../models/organizationAlertSettings.model';
import { OrganizationModel } from '../models/organization.model';
import { EmailService } from '../services/email.service';
import { ApiResponse } from '../utils/apiResponse';
import { AuditService } from '../services/audit.service';

export class OrganizationController {
  /**
   * [POST] /api/v1/organizations
   * Tạo tổ chức mới kèm hồ sơ mở rộng (Profile) và gán người tạo làm SME_OWNER
   */
  public static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id;
      const result = await OrganizationService.create(userId, req.body);
      AuditService.recordFromRequest(req, {
        organization_id: result.id,
        action: 'ORG_CREATED',
        status: 'SUCCESS',
        target_type: 'ORGANIZATION',
        target_id: result.id,
        description: `Tạo tổ chức mới: ${result.name}`,
      }).catch(() => {});
      return ApiResponse.success(res, 'Tạo tổ chức thành công', result, 201);
    } catch (error) {
      next(error);
    }
  }

  /**
   * [GET] /api/v1/organizations
   * Lấy danh sách tổ chức (hỗ trợ phân trang, tìm kiếm, lọc theo trạng thái)
   */
  public static async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const result = await OrganizationService.getAll(user.id, user.roles || [], req.query);
      return ApiResponse.success(res, 'Lấy danh sách tổ chức thành công', result, 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * [GET] /api/v1/organizations/:id
   * Xem chi tiết thông tin và hồ sơ của một tổ chức
   */
  public static async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const orgId = req.params.id;
      const result = await OrganizationService.getById(orgId, user.id, user.roles || []);
      return ApiResponse.success(res, 'Lấy chi tiết tổ chức thành công', result, 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * [PUT] /api/v1/organizations/:id
   * Cập nhật thông tin tổ chức và hồ sơ
   */
  public static async update(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const orgId = req.params.id;
      const result = await OrganizationService.update(orgId, user.id, user.roles || [], req.body);
      AuditService.recordFromRequest(req, {
        organization_id: orgId,
        action: 'ORG_UPDATED',
        status: 'SUCCESS',
        target_type: 'ORGANIZATION',
        target_id: orgId,
        description: 'Cập nhật thông tin hồ sơ tổ chức: ' + result.name,
        metadata: {
          name: result.name,
          email: req.body.email,
          website: req.body.website,
        },
      }).catch((err) => console.warn('[AuditService] Lỗi ghi audit log cập nhật tổ chức:', err));
      return ApiResponse.success(res, 'Cập nhật thông tin tổ chức thành công', result, 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * [PATCH] /api/v1/organizations/:id/status
   * Khóa / Mở khóa / Vô hiệu hóa tổ chức ([2.12])
   */
  public static async updateStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const orgId = req.params.id;
      const { status, reason } = req.body;
      const result = await OrganizationService.updateStatus(
        orgId,
        user.id,
        user.roles || [],
        status,
        reason
      );
      AuditService.recordFromRequest(req, {
        organization_id: orgId,
        action: 'ORG_STATUS_CHANGED',
        status: 'SUCCESS',
        target_type: 'ORGANIZATION',
        target_id: orgId,
        description: `Cập nhật trạng thái tổ chức thành '${status}'`,
        metadata: { status, reason },
      }).catch(() => {});

      return ApiResponse.success(
        res,
        `Cập nhật trạng thái tổ chức thành '${status}' thành công`,
        result,
        200
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * [DELETE] /api/v1/organizations/:id
   * Xóa tổ chức (Soft delete)
   */
  public static async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const orgId = req.params.id;
      const result = await OrganizationService.delete(orgId, user.id, user.roles || []);
      AuditService.recordFromRequest(req, {
        organization_id: orgId,
        action: 'ORG_DELETED',
        status: 'SUCCESS',
        target_type: 'ORGANIZATION',
        target_id: orgId,
        description: 'Xóa tổ chức (Soft delete)',
      }).catch(() => {});
      return ApiResponse.success(res, 'Xóa tổ chức thành công', result, 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * [GET] /api/v1/organizations/roles
   * Lấy danh mục các vai trò tổ chức khả dụng (SME_OWNER, DEVOPS, VIEWER)
   */
  public static async getRoles(req: Request, res: Response, next: NextFunction) {
    try {
      const roles = await OrganizationRoleService.getAllRoles();
      return ApiResponse.success(res, 'Lấy danh mục vai trò tổ chức thành công', roles, 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * [GET] /api/v1/organizations/me/list hoặc /api/v1/users/me/organizations
   * Lấy danh sách tất cả các tổ chức mà người dùng hiện tại đang tham gia (Workspace Context)
   */
  public static async getMyOrganizations(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const result = await OrganizationService.getUserOrganizations(user.id, user.roles || []);
      return ApiResponse.success(res, 'Lấy danh sách tổ chức của bạn thành công', result, 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * [GET] /api/v1/organizations/me/invitations hoặc /api/v1/users/me/invitations
   * Lấy danh sách các lời mời tham gia tổ chức đang chờ chấp nhận của tài khoản hiện tại
   */
  /**
   * [GET] /api/v1/organizations/:id/alert-settings
   * Lấy cấu hình cảnh báo khẩn cấp & danh sách người nhận mặc định của tổ chức
   */
  public static async getAlertSettings(req: Request, res: Response, next: NextFunction) {
    try {
      const orgId = req.params.id || req.params.orgId;
      const [settings, defaultRecipients] = await Promise.all([
        OrganizationAlertSettingsModel.findOrDefaultByOrgId(orgId),
        OrganizationAlertSettingsModel.getDefaultRecipientsPreview(orgId),
      ]);

      return ApiResponse.success(
        res,
        'Lấy cấu hình cảnh báo tổ chức thành công',
        {
          ...settings,
          default_recipients: defaultRecipients,
        },
        200
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * [PUT] /api/v1/organizations/:id/alert-settings
   * Cập nhật cấu hình cảnh báo khẩn cấp & chống spam email (chỉ SME_OWNER / DEVOPS)
   */
  public static async updateAlertSettings(req: Request, res: Response, next: NextFunction) {
    try {
      const orgId = req.params.id || req.params.orgId;
      const user = (req as any).user;

      const before = await OrganizationAlertSettingsModel.findOrDefaultByOrgId(orgId);
      const updated = await OrganizationAlertSettingsModel.upsert(orgId, req.body || {}, user?.id || null);
      const defaultRecipients = await OrganizationAlertSettingsModel.getDefaultRecipientsPreview(orgId);

      AuditService.recordFromRequest(req, {
        organization_id: orgId,
        action: 'ORG_ALERT_SETTINGS_UPDATED',
        status: 'SUCCESS',
        resource_type: 'ORGANIZATION',
        resource_id: orgId,
        target_type: 'ORGANIZATION',
        target_id: orgId,
        description: `Cập nhật cấu hình cảnh báo khẩn cấp tổ chức (Bật email: ${updated.critical_email_enabled}, Cooldown: ${updated.cooldown_minutes} phút, Email ngoài: ${updated.extra_emails.length})`,
        before_data: {
          critical_email_enabled: before.critical_email_enabled,
          notify_on_no_action: before.notify_on_no_action,
          notify_on_healing_failed: before.notify_on_healing_failed,
          cooldown_minutes: before.cooldown_minutes,
          extra_emails: before.extra_emails,
        },
        after_data: {
          critical_email_enabled: updated.critical_email_enabled,
          notify_on_no_action: updated.notify_on_no_action,
          notify_on_healing_failed: updated.notify_on_healing_failed,
          cooldown_minutes: updated.cooldown_minutes,
          extra_emails: updated.extra_emails,
        },
      }).catch(() => {});

      return ApiResponse.success(
        res,
        'Cập nhật cấu hình cảnh báo tổ chức thành công',
        {
          ...updated,
          default_recipients: defaultRecipients,
        },
        200
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * [POST] /api/v1/organizations/:id/alert-settings/test-email
   * Gửi thử email kiểm tra cấu hình cảnh báo khẩn cấp
   */
  public static async sendTestAlertEmail(req: Request, res: Response, next: NextFunction) {
    try {
      const orgId = req.params.id || req.params.orgId;
      const user = (req as any).user;
      const customTarget = req.body?.to_email ? String(req.body.to_email).trim().toLowerCase() : '';

      const [org, settings, defaultRecipients] = await Promise.all([
        OrganizationModel.findById(orgId),
        OrganizationAlertSettingsModel.findOrDefaultByOrgId(orgId),
        OrganizationAlertSettingsModel.getDefaultRecipientsPreview(orgId),
      ]);

      const recipientMap = new Map<string, { email: string; name: string }>();
      if (customTarget) {
        recipientMap.set(customTarget, { email: customTarget, name: customTarget });
      } else {
        for (const r of defaultRecipients) {
          if (r.email) {
            recipientMap.set(r.email.toLowerCase(), {
              email: r.email.toLowerCase(),
              name: r.full_name || r.email,
            });
          }
        }
        for (const extra of settings.extra_emails || []) {
          const clean = String(extra).trim().toLowerCase();
          if (clean && !recipientMap.has(clean)) {
            recipientMap.set(clean, { email: clean, name: clean });
          }
        }
        if (recipientMap.size === 0 && user?.email) {
          const fallback = String(user.email).trim().toLowerCase();
          recipientMap.set(fallback, { email: fallback, name: user.full_name || fallback });
        }
      }

      const targets = Array.from(recipientMap.values());
      let sentCount = 0;
      for (const target of targets) {
        const ok = await EmailService.sendTestAlertEmail({
          toEmail: target.email,
          recipientName: target.name,
          organizationName: org?.name || 'Tổ chức SME',
          triggeredByEmail: user?.email || user?.full_name || 'Admin',
        });
        if (ok) sentCount++;
      }

      AuditService.recordFromRequest(req, {
        organization_id: orgId,
        action: 'TEST_ALERT_EMAIL_SENT',
        status: sentCount > 0 ? 'SUCCESS' : 'FAILURE',
        resource_type: 'ORGANIZATION',
        resource_id: orgId,
        target_type: 'ORGANIZATION',
        target_id: orgId,
        description: `Gửi email kiểm tra kênh cảnh báo khẩn cấp tới ${sentCount}/${targets.length} địa chỉ`,
        metadata: { recipients: targets.map((t) => t.email), sent_count: sentCount },
      }).catch(() => {});

      return ApiResponse.success(
        res,
        `Đã gửi email kiểm tra cảnh báo tới ${sentCount}/${targets.length} địa chỉ`,
        {
          sent_count: sentCount,
          recipients: targets.map((t) => t.email),
        },
        200
      );
    } catch (error) {
      next(error);
    }
  }

  public static async getMyInvitations(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const result = await OrganizationService.getUserPendingInvitations(user.id);
      return ApiResponse.success(res, 'Lấy danh sách lời mời đang chờ thành công', result, 200);
    } catch (error) {
      next(error);
    }
  }
}

