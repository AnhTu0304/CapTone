import { Pool } from 'pg';
import { createMigratorPool } from '../config/database';
import { encryptSecret, isEncryptedSecret } from '../utils/cryptoVault';
import { encryptTotpSecret } from '../services/twoFactor.service';

export interface BackfillResult {
  alertSettingsEncrypted: number;
  totpSecretsEncrypted: number;
  plaintextApprovalTokensCleared: number;
}

export async function runSensitiveDataBackfill(customPool?: Pool): Promise<BackfillResult> {
  const ownsPool = !customPool;
  const dbPool = customPool || createMigratorPool();
  const resSummary: BackfillResult = {
    alertSettingsEncrypted: 0,
    totpSecretsEncrypted: 0,
    plaintextApprovalTokensCleared: 0,
  };

  try {
    // 1. Encrypt any plaintext slack_webhook_url or pagerduty_key in organization_alert_settings
    const alertRes = await dbPool.query<{
      organization_id: string;
      slack_webhook_url: string | null;
      pagerduty_key: string | null;
    }>(`SELECT organization_id, slack_webhook_url, pagerduty_key FROM organization_alert_settings`);

    for (const row of alertRes.rows) {
      let changed = false;
      let nextWebhook = row.slack_webhook_url;
      let nextPd = row.pagerduty_key;

      if (nextWebhook && !isEncryptedSecret(nextWebhook)) {
        nextWebhook = encryptSecret(nextWebhook);
        changed = true;
      }
      if (nextPd && !isEncryptedSecret(nextPd)) {
        nextPd = encryptSecret(nextPd);
        changed = true;
      }

      if (changed) {
        await dbPool.query(
          `UPDATE organization_alert_settings
           SET slack_webhook_url = $1, pagerduty_key = $2, updated_at = NOW()
           WHERE organization_id = $3`,
          [nextWebhook, nextPd, row.organization_id]
        );
        resSummary.alertSettingsEncrypted++;
      }
    }

    // 2. Encrypt any legacy plaintext user_two_factor.secret_key missing v1: prefix
    const totpRes = await dbPool.query<{ id: string; secret_key: string }>(
      `SELECT id, secret_key FROM user_two_factor WHERE secret_key IS NOT NULL AND secret_key NOT LIKE 'v1:%'`
    );
    for (const row of totpRes.rows) {
      const enc = encryptTotpSecret(row.secret_key);
      await dbPool.query(`UPDATE user_two_factor SET secret_key = $1, updated_at = NOW() WHERE id = $2`, [
        enc,
        row.id,
      ]);
      resSummary.totpSecretsEncrypted++;
    }

    // 3. Purge any plaintext approval_token values from approvals
    const apClear = await dbPool.query(
      `UPDATE approvals SET approval_token = NULL WHERE approval_token IS NOT NULL`
    );
    resSummary.plaintextApprovalTokensCleared = apClear.rowCount || 0;

    return resSummary;
  } finally {
    if (ownsPool) {
      await dbPool.end().catch(() => {});
    }
  }
}

if (require.main === module) {
  runSensitiveDataBackfill()
    .then((res) => {
      console.log('✅ Sensitive data backfill completed:', JSON.stringify(res));
      process.exit(0);
    })
    .catch((err) => {
      console.error('❌ Sensitive data backfill failed:', (err as Error).message);
      process.exit(1);
    });
}
