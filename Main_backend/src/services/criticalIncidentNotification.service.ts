import { pool } from '../config/database';
import { redisClient, isRedisReady } from '../config/redis';
import { IncidentModel } from '../models/incident.model';
import {
  OrganizationAlertSettingsModel,
  IDefaultAlertRecipient,
  IOrganizationAlertSettings,
} from '../models/organizationAlertSettings.model';
import { EmailService } from './email.service';
import { EmailQueue } from './emailQueue.service';
import { AuditService } from './audit.service';
import { broadcastTelemetryToUi } from '../websocket/telemetryWebSocket';

export type CriticalAlertReasonStage =
  | 'NO_ACTION'
  | 'NO_POLICY'
  | 'POLICY_DISABLED'
  | 'HITL_PENDING'
  | 'HEALING_FAILED'
  | string;

export interface CriticalAlertNotifyOptions {
  reasonStage: CriticalAlertReasonStage;
  force?: boolean;
  excludeHitlApprovers?: boolean;
  failureMessage?: string | null;
  triggeredByUserId?: string | null;
  triggeredByEmail?: string | null;
  requestId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface EmailRecipientTarget {
  toEmail: string;
  recipientName: string;
  recipientRole: string;
  userId?: string;
}

export interface CriticalAlertNotifyResult {
  notified: boolean;
  suppressedByCooldown: boolean;
  disabledBySettings: boolean;
  notifiedUsersCount: number;
  emailedCount: number;
  recipients: string[];
  reason: string;
}

const ALLOWED_AUTO_ROLES = new Set(['SME_OWNER', 'DEVOPS']);
const SIMPLE_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class CriticalIncidentNotificationService {
  // Bộ nhớ tạm dự phòng cho cooldown khi Redis không sẵn sàng (ví dụ môi trường test)
  private static memoryCooldowns = new Map<string, number>();

  public static clearMemoryCooldownsForTesting(): void {
    this.memoryCooldowns.clear();
  }

  /**
   * Chuẩn hóa khóa cooldown chống spam email theo (Org + Service + Loại sự cố + Giai đoạn)
   */
  public static buildCooldownKey(
    orgId: string | null | undefined,
    serviceName: string | null | undefined,
    incidentType: string | null | undefined,
    stage: string | null | undefined
  ): string {
    const sanitize = (v?: string | null, fallback = 'default') =>
      String(v || fallback)
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_.-]+/g, '_')
        .slice(0, 64) || fallback;

    return `critical_alert_cooldown:${sanitize(orgId, 'global')}:${sanitize(serviceName, 'unknown_svc')}:${sanitize(incidentType, 'critical')}:${sanitize(stage, 'alert')}`;
  }

  /**
   * Lọc & hợp nhất người nhận:
   * - Luôn chỉ lấy thành viên ACTIVE có vai trò SME_OWNER hoặc DEVOPS (loại bỏ VIEWER)
   * - Kết hợp thêm danh sách extra_emails hợp lệ, khử trùng lặp (case-insensitive)
   * - Khi HITL đã gửi email 1-Click cho SME_OWNER/DEVOPS, cho phép bỏ qua gửi trùng email nhưng vẫn gửi extra_emails
   */
  public static resolveRecipientTargets(
    memberRecipients: IDefaultAlertRecipient[],
    extraEmails: string[],
    options?: {
      excludeHitlApprovers?: boolean;
      emailEnabled?: boolean;
    }
  ): {
    inAppMembers: IDefaultAlertRecipient[];
    emailTargets: EmailRecipientTarget[];
  } {
    const seenMemberIds = new Set<string>();
    const inAppMembers: IDefaultAlertRecipient[] = [];

    for (const member of memberRecipients || []) {
      const role = String(member.role_code || '').toUpperCase();
      if (!ALLOWED_AUTO_ROLES.has(role)) continue;
      if (!member.user_id || seenMemberIds.has(member.user_id)) continue;
      seenMemberIds.add(member.user_id);
      inAppMembers.push({
        ...member,
        role_code: role,
      });
    }

    const emailEnabled = options?.emailEnabled !== false;
    if (!emailEnabled) {
      return { inAppMembers, emailTargets: [] };
    }

    const emailMap = new Map<string, EmailRecipientTarget>();

    if (!options?.excludeHitlApprovers) {
      for (const member of inAppMembers) {
        const cleanEmail = String(member.email || '').trim().toLowerCase();
        if (cleanEmail && SIMPLE_EMAIL_REGEX.test(cleanEmail) && !emailMap.has(cleanEmail)) {
          emailMap.set(cleanEmail, {
            toEmail: cleanEmail,
            recipientName: member.full_name || cleanEmail,
            recipientRole: member.role_code,
            userId: member.user_id,
          });
        }
      }
    }

    for (const rawExtra of extraEmails || []) {
      const cleanEmail = String(rawExtra || '').trim().toLowerCase();
      if (cleanEmail && SIMPLE_EMAIL_REGEX.test(cleanEmail) && !emailMap.has(cleanEmail)) {
        emailMap.set(cleanEmail, {
          toEmail: cleanEmail,
          recipientName: cleanEmail,
          recipientRole: 'CUSTOM',
        });
      }
    }

    return {
      inAppMembers,
      emailTargets: Array.from(emailMap.values()),
    };
  }

  /**
   * Kiểm tra xem cấu hình tổ chức có cho phép gửi email tự động ở stage này hay không
   */
  public static isEmailAllowedBySettings(
    settings: IOrganizationAlertSettings,
    reasonStage: CriticalAlertReasonStage,
    force?: boolean
  ): boolean {
    if (force) return true;
    if (!settings.critical_email_enabled) return false;
    const upperStage = String(reasonStage || '').toUpperCase();
    if (upperStage === 'NO_ACTION' && !settings.notify_on_no_action) return false;
    if (upperStage === 'HEALING_FAILED' && !settings.notify_on_healing_failed) return false;
    return true;
  }

  /**
   * Thử chiếm slot cooldown (Atomic Redis NX EX, fallback in-memory Map nếu Redis tắt)
   */
  public static async acquireCooldownSlot(cooldownKey: string, cooldownMinutes: number): Promise<boolean> {
    const ttlSeconds = Math.max(60, Math.round((Number(cooldownMinutes) || 15) * 60));

    if (isRedisReady()) {
      try {
        const res = await redisClient.set(cooldownKey, String(Date.now()), 'EX', ttlSeconds, 'NX');
        return res === 'OK';
      } catch (err: any) {
        console.warn(`[CriticalIncidentAlert] Redis cooldown error (${err.message}), fallback memory map.`);
      }
    }

    const now = Date.now();
    const existingExpiry = this.memoryCooldowns.get(cooldownKey);
    if (existingExpiry && existingExpiry > now) {
      return false;
    }

    this.memoryCooldowns.set(cooldownKey, now + ttlSeconds * 1000);
    // Dọn dẹp bớt key hết hạn nếu map phình to
    if (this.memoryCooldowns.size > 500) {
      for (const [k, exp] of this.memoryCooldowns.entries()) {
        if (exp <= now) this.memoryCooldowns.delete(k);
      }
    }
    return true;
  }

  /**
   * Điểm kích hoạt tự động trung tâm khi sự cố CRITICAL cần báo động khẩn cấp
   */
  public static async notifyIfNeeded(
    incidentId: string,
    options: CriticalAlertNotifyOptions
  ): Promise<CriticalAlertNotifyResult> {
    if (!incidentId) {
      return {
        notified: false,
        suppressedByCooldown: false,
        disabledBySettings: false,
        notifiedUsersCount: 0,
        emailedCount: 0,
        recipients: [],
        reason: 'MISSING_INCIDENT_ID',
      };
    }

    const incident = await IncidentModel.findById(incidentId);
    if (!incident) {
      return {
        notified: false,
        suppressedByCooldown: false,
        disabledBySettings: false,
        notifiedUsersCount: 0,
        emailedCount: 0,
        recipients: [],
        reason: 'INCIDENT_NOT_FOUND',
      };
    }

    const severity = String(incident.severity || 'HIGH').toUpperCase();
    if (!options.force && severity !== 'CRITICAL') {
      return {
        notified: false,
        suppressedByCooldown: false,
        disabledBySettings: false,
        notifiedUsersCount: 0,
        emailedCount: 0,
        recipients: [],
        reason: 'SEVERITY_NOT_CRITICAL',
      };
    }

    const orgId: string | null =
      incident.effective_organization_id ||
      incident.organization_id ||
      incident.env_organization_id ||
      (await IncidentModel.findOrgIdByIncidentId(incidentId));

    const settings: IOrganizationAlertSettings = orgId
      ? await OrganizationAlertSettingsModel.findOrDefaultByOrgId(orgId)
      : {
          organization_id: 'default',
          critical_email_enabled: true,
          notify_on_no_action: true,
          notify_on_healing_failed: true,
          extra_emails: [],
          cooldown_minutes: 15,
        };

    const emailAllowed = this.isEmailAllowedBySettings(settings, options.reasonStage, options.force);

    let analysisParsed: any = null;
    if (incident.analysis_result) {
      try {
        analysisParsed =
          typeof incident.analysis_result === 'string'
            ? JSON.parse(incident.analysis_result)
            : incident.analysis_result;
      } catch {}
    }

    const serviceName =
      incident.service_name ||
      incident.workload_name ||
      incident.healing_target_name ||
      incident.target_id ||
      'unknown-service';
    const incidentCode = `INC-${String(incident.id).slice(0, 8).toUpperCase()}`;
    const incidentType = incident.incident_type || incident.root_cause_type || 'CRITICAL_ALERT';

    // Chống spam email (chỉ áp dụng cho trigger tự động; bấm thủ công trên UI có force=true gửi ngay)
    if (!options.force) {
      const cooldownKey = this.buildCooldownKey(orgId, serviceName, incidentType, options.reasonStage);
      const acquired = await this.acquireCooldownSlot(cooldownKey, settings.cooldown_minutes);
      if (!acquired) {
        console.log(
          `⏳ [CriticalIncidentAlert] Bỏ qua báo động lặp cho ${incidentCode} (${serviceName} / ${options.reasonStage}) do đang trong thời gian Cooldown ${settings.cooldown_minutes} phút.`
        );
        AuditService.record({
          organization_id: orgId || null,
          actor_type: 'SYSTEM',
          action: 'CRITICAL_INCIDENT_ALERT_SUPPRESSED_COOLDOWN',
          resource_type: 'INCIDENT',
          resource_id: incident.id,
          target_type: 'WORKLOAD',
          target_id: incident.target_id || null,
          description: `Tạm nén cảnh báo khẩn cấp [${incidentCode}] cho dịch vụ ${serviceName} theo quy tắc chống spam Cooldown (${settings.cooldown_minutes} phút).`,
          status: 'WARN',
          metadata: {
            incident_id: incident.id,
            incident_code: incidentCode,
            service_id: serviceName,
            reason_stage: options.reasonStage,
            cooldown_minutes: settings.cooldown_minutes,
            cooldown_key: cooldownKey,
            cluster_id: incident.cluster_id || null,
            cluster_name: incident.cluster_name || null,
          },
        }).catch(() => {});

        return {
          notified: false,
          suppressedByCooldown: true,
          disabledBySettings: false,
          notifiedUsersCount: 0,
          emailedCount: 0,
          recipients: [],
          reason: 'COOLDOWN_ACTIVE',
        };
      }
    }

    const memberRecipients = orgId
      ? await OrganizationAlertSettingsModel.getDefaultRecipientsPreview(orgId)
      : [];

    const { inAppMembers, emailTargets } = this.resolveRecipientTargets(
      memberRecipients,
      settings.extra_emails || [],
      {
        excludeHitlApprovers: Boolean(options.excludeHitlApprovers && !options.force),
        emailEnabled: emailAllowed,
      }
    );

    const recAction =
      analysisParsed?.recommendation?.action ||
      incident.recommendation_action ||
      'NO_ACTION';
    const recReason =
      analysisParsed?.recommendation?.reason ||
      incident.recommendation_reason ||
      null;
    const podName =
      analysisParsed?.recommendation?.action_parameters?.faulty_pod_name ||
      incident.actual_pod_name ||
      null;
    const nodeName =
      analysisParsed?.recommendation?.action_parameters?.faulty_node_name ||
      incident.node_name ||
      null;

    const notifTitle = `🚨 [${incidentCode}] Khẩn cấp trên ${serviceName}`;
    const stageShort =
      options.reasonStage === 'NO_ACTION'
        ? 'Cầu dao ngắt / NO_ACTION (cần kỹ sư kiểm tra)'
        : options.reasonStage === 'HEALING_FAILED'
        ? 'Tự phục hồi thất bại'
        : options.reasonStage === 'NO_POLICY'
        ? 'Chưa có policy tự động'
        : options.reasonStage === 'POLICY_DISABLED'
        ? 'Policy tự động đang tắt'
        : options.reasonStage === 'HITL_PENDING'
        ? 'Đang chờ duyệt HITL'
        : 'Sự cố nghiêm trọng cần kiểm tra';
    const notifMessage = `${incident.title || incident.root_cause_type || 'Sự cố nghiêm trọng'} — ${stageShort}.`;

    // 1. Ghi thông báo In-App thật vào bảng notifications cho SME_OWNER & DEVOPS
    let notifiedUsersCount = 0;
    for (const member of inAppMembers) {
      try {
        await pool.query(
          `INSERT INTO notifications (
            user_id,
            organization_id,
            incident_id,
            notification_type,
            title,
            message,
            severity,
            related_resource_type,
            related_resource_id,
            is_read,
            created_at
          ) VALUES (
            $1, $2, $3, 'INFRASTRUCTURE', $4, $5, $6, 'INCIDENT', $3, FALSE, NOW()
          );`,
          [member.user_id, orgId, incident.id, notifTitle, notifMessage, severity]
        );
        notifiedUsersCount++;
      } catch (dbErr: any) {
        console.warn(`[CriticalIncidentAlert] Không thể lưu DB notification cho ${member.email}:`, dbErr.message);
      }
    }

    // 2. Đẩy Email vào hàng đợi Redis bền vững (nếu hàng đợi tạm mất kết nối, gửi trực tiếp dự phòng)
    let emailedCount = 0;
    const emailedAddresses: string[] = [];

    for (const target of emailTargets) {
      const emailPayload = {
        toEmail: target.toEmail,
        recipientName: target.recipientName,
        recipientRole: target.recipientRole,
        incidentId: incident.id,
        incidentCode,
        title: incident.title || incident.root_cause_type || `Sự cố trên ${serviceName}`,
        severity,
        serviceName,
        podName,
        nodeName,
        namespace: incident.namespace || null,
        clusterName: incident.cluster_name || incident.cluster_id || null,
        organizationName: incident.organization_name || null,
        rootCauseType: incident.root_cause_type || null,
        rootCauseDescription: incident.root_cause_description || incident.description || null,
        confidenceScore: incident.rca_confidence ?? incident.prediction_confidence ?? null,
        recommendationAction: recAction,
        recommendationReason: recReason,
        reasonStage: options.reasonStage,
        failureMessage: options.failureMessage || incident.healing_error_message || incident.healing_result_error || null,
        occurrenceCount: Number(incident.occurrence_count || 1),
        detectedAt: incident.detected_at ? new Date(incident.detected_at).toISOString() : null,
        manualPlaybook: Array.isArray(analysisParsed?.recommendation?.action_parameters?.manual_playbook)
          ? analysisParsed.recommendation.action_parameters.manual_playbook
          : [],
      };

      try {
        await EmailQueue.enqueueCriticalIncidentAlert(emailPayload);
        emailedCount++;
        emailedAddresses.push(target.toEmail);
      } catch (queueErr: any) {
        console.warn(
          `⚠️ [CriticalIncidentAlert] EmailQueue không khả dụng (${queueErr.message}), chuyển sang gửi trực tiếp tới ${target.toEmail}`
        );
        const sentDirect = await EmailService.sendCriticalIncidentAlertEmail(emailPayload);
        if (sentDirect) {
          emailedCount++;
          emailedAddresses.push(target.toEmail);
        }
      }
    }

    // 3. Broadcast WebSocket sự kiện khẩn cấp tới Frontend UI ngay lập tức
    try {
      broadcastTelemetryToUi({
        type: 'critical_incident_alert',
        data: {
          id: incident.id,
          incident_id: incident.id,
          incident_code: incidentCode,
          organization_id: orgId,
          cluster_id: incident.cluster_id || null,
          cluster_name: incident.cluster_name || null,
          service_name: serviceName,
          title: incident.title || incident.root_cause_type,
          severity,
          recommendation_action: recAction,
          reason_stage: options.reasonStage,
          message: notifMessage,
          recipients_count: emailedCount,
          link: `/dashboard/incidents?incident=${incident.id}`,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (wsErr) {
      console.warn('[CriticalIncidentAlert] Broadcast WS thất bại:', wsErr);
    }

    // 4. Ghi nhật ký Audit Trail bất biến
    AuditService.record({
      organization_id: orgId || null,
      user_id: options.triggeredByUserId || null,
      actor_type: options.force ? 'USER' : 'SYSTEM',
      action: 'CRITICAL_INCIDENT_ALERT_SENT',
      resource_type: 'INCIDENT',
      resource_id: incident.id,
      target_type: 'WORKLOAD',
      target_id: incident.target_id || null,
      request_id: options.requestId || null,
      ip_address: options.ipAddress || null,
      user_agent: options.userAgent || null,
      description: options.force
        ? `Kỹ sư ${options.triggeredByEmail || ''} đã gửi cảnh báo khẩn cấp cho sự cố [${incidentCode}] (${serviceName}) tới ${emailedCount} email & ${notifiedUsersCount} tài khoản.`
        : `Hệ thống tự động phát cảnh báo khẩn cấp sự cố [${incidentCode}] (${serviceName} - ${options.reasonStage}) tới ${emailedCount} email & ${notifiedUsersCount} tài khoản.`,
      status: 'SUCCESS',
      metadata: {
        incident_id: incident.id,
        incident_code: incidentCode,
        service_id: serviceName,
        reason_stage: options.reasonStage,
        force: Boolean(options.force),
        email_enabled: emailAllowed,
        emailed_count: emailedCount,
        notified_users_count: notifiedUsersCount,
        recipients: emailedAddresses,
        cluster_id: incident.cluster_id || null,
        cluster_name: incident.cluster_name || null,
      },
    }).catch(() => {});

    return {
      notified: notifiedUsersCount > 0 || emailedCount > 0,
      suppressedByCooldown: false,
      disabledBySettings: !emailAllowed,
      notifiedUsersCount,
      emailedCount,
      recipients: emailedAddresses,
      reason: !emailAllowed ? 'EMAIL_DISABLED_IN_SETTINGS_INAPP_SENT' : 'ALERT_DISPATCHED',
    };
  }
}
