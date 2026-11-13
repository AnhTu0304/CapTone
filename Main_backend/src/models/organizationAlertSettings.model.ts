import { PoolClient } from 'pg';
import { pool } from '../config/database';

export interface IOrganizationAlertSettings {
  organization_id: string;
  critical_email_enabled: boolean;
  notify_on_no_action: boolean;
  notify_on_healing_failed: boolean;
  extra_emails: string[];
  cooldown_minutes: number;
  slack_webhook_url?: string | null;
  slack_channel?: string | null;
  pagerduty_key?: string | null;
  updated_by?: string | null;
  created_at?: Date | null;
  updated_at?: Date | null;
}

export interface IDefaultAlertRecipient {
  user_id: string;
  full_name: string;
  email: string;
  role_code: string;
}

const SIMPLE_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class OrganizationAlertSettingsModel {
  /**
   * Chuẩn hóa và khử trùng lặp danh sách email tùy chỉnh
   */
  public static normalizeExtraEmails(rawEmails: unknown): string[] {
    let list: string[] = [];
    if (Array.isArray(rawEmails)) {
      list = rawEmails.map((e) => String(e || '').trim().toLowerCase());
    } else if (typeof rawEmails === 'string') {
      list = rawEmails
        .split(/[,;\n]+/)
        .map((e) => e.trim().toLowerCase());
    }

    const deduped = new Set<string>();
    for (const email of list) {
      if (email && SIMPLE_EMAIL_REGEX.test(email)) {
        deduped.add(email);
      }
    }
    return Array.from(deduped);
  }

  /**
   * Lấy cấu hình cảnh báo của tổ chức; nếu chưa lưu thì trả về giá trị mặc định an toàn
   */
  public static async findOrDefaultByOrgId(
    orgId: string,
    client?: PoolClient
  ): Promise<IOrganizationAlertSettings> {
    const db = client || pool;
    const res = await db.query(
      `SELECT
        organization_id,
        critical_email_enabled,
        notify_on_no_action,
        notify_on_healing_failed,
        extra_emails,
        cooldown_minutes,
        slack_webhook_url,
        slack_channel,
        pagerduty_key,
        updated_by,
        created_at,
        updated_at
      FROM organization_alert_settings
      WHERE organization_id = $1
      LIMIT 1;`,
      [orgId]
    );

    if (res.rows.length > 0) {
      const row = res.rows[0];
      return {
        organization_id: row.organization_id,
        critical_email_enabled: row.critical_email_enabled !== false,
        notify_on_no_action: row.notify_on_no_action !== false,
        notify_on_healing_failed: row.notify_on_healing_failed !== false,
        extra_emails: this.normalizeExtraEmails(row.extra_emails),
        cooldown_minutes: Number(row.cooldown_minutes) || 15,
        slack_webhook_url: row.slack_webhook_url || null,
        slack_channel: row.slack_channel || null,
        pagerduty_key: row.pagerduty_key || null,
        updated_by: row.updated_by || null,
        created_at: row.created_at || null,
        updated_at: row.updated_at || null,
      };
    }

    return {
      organization_id: orgId,
      critical_email_enabled: true,
      notify_on_no_action: true,
      notify_on_healing_failed: true,
      extra_emails: [],
      cooldown_minutes: 15,
      slack_webhook_url: null,
      slack_channel: null,
      pagerduty_key: null,
      updated_by: null,
      created_at: null,
      updated_at: null,
    };
  }

  /**
   * Tạo hoặc cập nhật cấu hình cảnh báo của tổ chức
   */
  public static async upsert(
    orgId: string,
    payload: Partial<Omit<IOrganizationAlertSettings, 'organization_id' | 'created_at' | 'updated_at'>>,
    updatedBy?: string | null,
    client?: PoolClient
  ): Promise<IOrganizationAlertSettings> {
    const db = client || pool;
    const current = await this.findOrDefaultByOrgId(orgId, client);

    const nextCriticalEnabled =
      payload.critical_email_enabled !== undefined
        ? Boolean(payload.critical_email_enabled)
        : current.critical_email_enabled;
    const nextNotifyNoAction =
      payload.notify_on_no_action !== undefined
        ? Boolean(payload.notify_on_no_action)
        : current.notify_on_no_action;
    const nextNotifyHealingFailed =
      payload.notify_on_healing_failed !== undefined
        ? Boolean(payload.notify_on_healing_failed)
        : current.notify_on_healing_failed;
    const nextExtraEmails =
      payload.extra_emails !== undefined
        ? this.normalizeExtraEmails(payload.extra_emails)
        : current.extra_emails;
    const rawCooldown =
      payload.cooldown_minutes !== undefined
        ? Number(payload.cooldown_minutes)
        : current.cooldown_minutes;
    const nextCooldown = Number.isFinite(rawCooldown)
      ? Math.min(1440, Math.max(1, Math.round(rawCooldown)))
      : 15;
    const nextSlackWebhook =
      payload.slack_webhook_url !== undefined
        ? (payload.slack_webhook_url ? String(payload.slack_webhook_url).trim() : null)
        : current.slack_webhook_url || null;
    const nextSlackChannel =
      payload.slack_channel !== undefined
        ? (payload.slack_channel ? String(payload.slack_channel).trim() : null)
        : current.slack_channel || null;
    const nextPagerdutyKey =
      payload.pagerduty_key !== undefined
        ? (payload.pagerduty_key ? String(payload.pagerduty_key).trim() : null)
        : current.pagerduty_key || null;

    const res = await db.query(
      `INSERT INTO organization_alert_settings (
        organization_id,
        critical_email_enabled,
        notify_on_no_action,
        notify_on_healing_failed,
        extra_emails,
        cooldown_minutes,
        slack_webhook_url,
        slack_channel,
        pagerduty_key,
        updated_by,
        created_at,
        updated_at
      ) VALUES (
        $1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, $10, NOW(), NOW()
      )
      ON CONFLICT (organization_id) DO UPDATE SET
        critical_email_enabled = EXCLUDED.critical_email_enabled,
        notify_on_no_action = EXCLUDED.notify_on_no_action,
        notify_on_healing_failed = EXCLUDED.notify_on_healing_failed,
        extra_emails = EXCLUDED.extra_emails,
        cooldown_minutes = EXCLUDED.cooldown_minutes,
        slack_webhook_url = EXCLUDED.slack_webhook_url,
        slack_channel = EXCLUDED.slack_channel,
        pagerduty_key = EXCLUDED.pagerduty_key,
        updated_by = EXCLUDED.updated_by,
        updated_at = NOW()
      RETURNING *;`,
      [
        orgId,
        nextCriticalEnabled,
        nextNotifyNoAction,
        nextNotifyHealingFailed,
        JSON.stringify(nextExtraEmails),
        nextCooldown,
        nextSlackWebhook,
        nextSlackChannel,
        nextPagerdutyKey,
        updatedBy || null,
      ]
    );

    const row = res.rows[0];
    return {
      organization_id: row.organization_id,
      critical_email_enabled: Boolean(row.critical_email_enabled),
      notify_on_no_action: Boolean(row.notify_on_no_action),
      notify_on_healing_failed: Boolean(row.notify_on_healing_failed),
      extra_emails: this.normalizeExtraEmails(row.extra_emails),
      cooldown_minutes: Number(row.cooldown_minutes) || 15,
      slack_webhook_url: row.slack_webhook_url || null,
      slack_channel: row.slack_channel || null,
      pagerduty_key: row.pagerduty_key || null,
      updated_by: row.updated_by || null,
      created_at: row.created_at || null,
      updated_at: row.updated_at || null,
    };
  }

  /**
   * Lấy danh sách thành viên mặc định tự động nhận cảnh báo khẩn cấp (chỉ SME_OWNER & DEVOPS đang ACTIVE)
   */
  public static async getDefaultRecipientsPreview(
    orgId: string,
    client?: PoolClient
  ): Promise<IDefaultAlertRecipient[]> {
    const db = client || pool;
    const res = await db.query(
      `SELECT DISTINCT ON (u.id)
        u.id AS user_id,
        COALESCE(u.full_name, u.email) AS full_name,
        u.email,
        UPPER(r.code) AS role_code
      FROM organization_members om
      JOIN organization_roles r ON r.id = om.role_id
      JOIN users u ON u.id = om.user_id
      WHERE om.organization_id = $1
        AND om.status = 'ACTIVE'
        AND u.status = 'ACTIVE'
        AND u.deleted_at IS NULL
        AND u.email IS NOT NULL
        AND UPPER(r.code) IN ('SME_OWNER', 'DEVOPS')
      ORDER BY u.id, CASE WHEN UPPER(r.code) = 'SME_OWNER' THEN 0 ELSE 1 END;`,
      [orgId]
    );

    return res.rows.sort((a, b) => {
      const rankA = a.role_code === 'SME_OWNER' ? 0 : 1;
      const rankB = b.role_code === 'SME_OWNER' ? 0 : 1;
      if (rankA !== rankB) return rankA - rankB;
      return String(a.full_name || '').localeCompare(String(b.full_name || ''));
    });
  }
}
