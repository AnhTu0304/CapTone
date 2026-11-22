import { PoolClient } from 'pg';
import { pool } from '../config/database';
import {
  decryptSecret,
  encryptSecret,
  isEncryptedSecret,
  isMaskedSecretSentinel,
  maskSecretForApi,
} from '../utils/cryptoVault';

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
  has_slack_webhook?: boolean;
  has_pagerduty_key?: boolean;
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

  private static mapRow(row: any, includeDecryptedSecrets: boolean): IOrganizationAlertSettings {
    const rawWebhook: string | null = row.slack_webhook_url || null;
    const rawPdKey: string | null = row.pagerduty_key || null;

    const decryptOrPlain = (val: string | null): string | null => {
      if (!val) return null;
      return isEncryptedSecret(val) ? decryptSecret(val) : val;
    };

    return {
      organization_id: row.organization_id,
      critical_email_enabled: row.critical_email_enabled !== false,
      notify_on_no_action: row.notify_on_no_action !== false,
      notify_on_healing_failed: row.notify_on_healing_failed !== false,
      extra_emails: this.normalizeExtraEmails(row.extra_emails),
      cooldown_minutes: Number(row.cooldown_minutes) || 15,
      slack_webhook_url: includeDecryptedSecrets
        ? decryptOrPlain(rawWebhook)
        : maskSecretForApi(rawWebhook, 'webhook'),
      slack_channel: row.slack_channel || null,
      pagerduty_key: includeDecryptedSecrets
        ? decryptOrPlain(rawPdKey)
        : maskSecretForApi(rawPdKey, 'key'),
      has_slack_webhook: Boolean(rawWebhook && rawWebhook.trim()),
      has_pagerduty_key: Boolean(rawPdKey && rawPdKey.trim()),
      updated_by: row.updated_by || null,
      created_at: row.created_at || null,
      updated_at: row.updated_at || null,
    };
  }

  private static defaultSettings(orgId: string): IOrganizationAlertSettings {
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
      has_slack_webhook: false,
      has_pagerduty_key: false,
      updated_by: null,
      created_at: null,
      updated_at: null,
    };
  }

  /**
   * Public/API safe getter: NEVER exposes raw slack_webhook_url or pagerduty_key.
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
      return this.mapRow(res.rows[0], false);
    }
    return this.defaultSettings(orgId);
  }

  /**
   * Internal-only getter for backend alert dispatchers needing decrypted webhook/key.
   */
  public static async findDecryptedByOrgId(
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
      return this.mapRow(res.rows[0], true);
    }
    return this.defaultSettings(orgId);
  }

  /**
   * Create or update org alert settings; encrypts slack_webhook_url & pagerduty_key at rest
   * using AES-256-GCM and returns masked secret representations.
   */
  public static async upsert(
    orgId: string,
    payload: Partial<Omit<IOrganizationAlertSettings, 'organization_id' | 'created_at' | 'updated_at'>>,
    updatedBy?: string | null,
    client?: PoolClient
  ): Promise<IOrganizationAlertSettings> {
    const db = client || pool;
    const currentRes = await db.query(
      `SELECT * FROM organization_alert_settings WHERE organization_id = $1 LIMIT 1;`,
      [orgId]
    );
    const currentRow = currentRes.rows[0] || null;
    const current = currentRow ? this.mapRow(currentRow, true) : this.defaultSettings(orgId);

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

    const resolveEncryptedField = (
      incoming: string | null | undefined,
      existingStored: string | null | undefined
    ): string | null => {
      if (incoming === undefined) {
        if (!existingStored) return null;
        return isEncryptedSecret(existingStored) ? existingStored : encryptSecret(existingStored);
      }
      if (incoming === null) return null;
      const trimmed = String(incoming).trim();
      if (!trimmed) return null;
      if (isMaskedSecretSentinel(trimmed)) {
        if (!existingStored) return null;
        return isEncryptedSecret(existingStored) ? existingStored : encryptSecret(existingStored);
      }
      return isEncryptedSecret(trimmed) ? trimmed : encryptSecret(trimmed);
    };

    const nextSlackWebhookEnc = resolveEncryptedField(
      payload.slack_webhook_url,
      currentRow?.slack_webhook_url || null
    );
    const nextSlackChannel =
      payload.slack_channel !== undefined
        ? (payload.slack_channel ? String(payload.slack_channel).trim() : null)
        : current.slack_channel || null;
    const nextPagerdutyKeyEnc = resolveEncryptedField(
      payload.pagerduty_key,
      currentRow?.pagerduty_key || null
    );

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
        nextSlackWebhookEnc,
        nextSlackChannel,
        nextPagerdutyKeyEnc,
        updatedBy || null,
      ]
    );

    return this.mapRow(res.rows[0], false);
  }

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
