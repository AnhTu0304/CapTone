import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import crypto from 'node:crypto';
import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
process.env.NODE_ENV = 'test';
process.env.DB_NAME = 'aiselfhealing_test';
process.env.REDIS_ENABLED = 'false';

import { pool, createMigratorPool } from '../config/database';
import { closeRedis } from '../config/redis';
import { runWithTenantContext } from '../config/dbContext';
import { OrganizationAlertSettingsModel } from '../models/organizationAlertSettings.model';
import { HitlNotificationService } from '../services/hitlNotification.service';
import { decryptTotpSecret } from '../services/twoFactor.service';
import * as cryptoVault from '../utils/cryptoVault';
import { runMigrations } from '../scripts/migrate';
import { runSensitiveDataBackfill } from '../scripts/backfillSensitiveData';

const ORG_ID = 'd3330000-0000-4000-8000-000000000001';
const ENV_ID = 'd3330000-0000-4000-8000-000000000002';
const USER_OWNER = 'd3330000-0000-4000-8000-000000000011';
const USER_DEVOPS = 'd3330000-0000-4000-8000-000000000012';
const INC_ID = 'd3330000-0000-4000-8000-000000000021';
const ACT_TYPE_HIGH = 'd3330000-0000-4000-8000-000000000031';

describe('Sprint D Phase 3 (SD-03): Sensitive Data Protection', () => {
  before(async () => {
    const migPool = createMigratorPool();
    try {
      await runMigrations({
        pool: migPool,
        baseline: true,
        baselineThrough: '31_sprint_c_phase2_refresh_tokens.sql',
      });
      await runMigrations({ pool: migPool });
    } finally {
      await migPool.end();
    }
  });

  after(async () => {
    await closeRedis().catch(() => {});
    await pool.end().catch(() => {});
  });

  test('1. cryptoVault enforces unique IVs, AEAD tamper detection, and key rotation', () => {
    const encryptSecret = (cryptoVault as any).encryptSecret;
    const decryptSecret = (cryptoVault as any).decryptSecret;
    assert.strictEqual(typeof encryptSecret, 'function', 'cryptoVault.encryptSecret must exist');
    assert.strictEqual(typeof decryptSecret, 'function', 'cryptoVault.decryptSecret must exist');

    const secret = 'https://hooks.slack.com/services/T000/B000/SUPERSECRET1234';
    const c1 = encryptSecret(secret);
    const c2 = encryptSecret(secret);
    assert.ok(c1.startsWith('enc:v1:'), 'Ciphertext must carry key version prefix');
    assert.notStrictEqual(c1, c2, 'Unique IV must produce distinct ciphertexts for same plaintext');
    assert.strictEqual(decryptSecret(c1), secret);
    assert.strictEqual(decryptSecret(c2), secret);

    // Tamper auth tag / cipher byte -> must throw fail-closed
    const parts = c1.split(':');
    parts[parts.length - 1] = 'ff'.repeat(8) + parts[parts.length - 1].slice(16);
    assert.throws(() => decryptSecret(parts.join(':')), /decrypt|auth|tag|invalid/i);
  });

  test('2. organization_alert_settings encrypts at rest, masks API responses, and preserves secret on masked upsert', async () => {
    const rawWebhook = 'https://hooks.slack.com/services/T123/B456/REAL_WEBHOOK_TOKEN_9876';
    const rawPdKey = 'pd_live_integration_secret_4321';

    await pool.query(
      `INSERT INTO users (id, email, password_hash, full_name, status)
       VALUES ($1, 'sd03-owner@test.local', 'hash', 'SD03 Owner', 'ACTIVE'),
              ($2, 'sd03-devops@test.local', 'hash', 'SD03 DevOps', 'ACTIVE')
       ON CONFLICT (id) DO NOTHING`,
      [USER_OWNER, USER_DEVOPS]
    );
    await pool.query(
      `INSERT INTO organizations (id, name, slug, type, status)
       VALUES ($1, 'SD03 Org', 'sd03-org', 'Enterprise', 'ACTIVE')
       ON CONFLICT (id) DO NOTHING`,
      [ORG_ID]
    );

    await runWithTenantContext(ORG_ID, USER_OWNER, async () => {
      const saved = await OrganizationAlertSettingsModel.upsert(
        ORG_ID,
        {
          slack_webhook_url: rawWebhook,
          pagerduty_key: rawPdKey,
          slack_channel: '#ops-alerts',
        },
        USER_OWNER
      );

      assert.notStrictEqual(saved.slack_webhook_url, rawWebhook, 'API model return must mask slack_webhook_url');
      assert.notStrictEqual(saved.pagerduty_key, rawPdKey, 'API model return must mask pagerduty_key');
      assert.strictEqual((saved as any).has_slack_webhook, true);
      assert.strictEqual((saved as any).has_pagerduty_key, true);

      // Verify raw DB column has encrypted payload, zero plaintext
      const dbRaw = await pool.query(
        `SELECT slack_webhook_url, pagerduty_key FROM organization_alert_settings WHERE organization_id = $1`,
        [ORG_ID]
      );
      assert.ok(dbRaw.rows[0].slack_webhook_url.startsWith('enc:v1:'));
      assert.ok(dbRaw.rows[0].pagerduty_key.startsWith('enc:v1:'));
      assert.ok(!dbRaw.rows[0].slack_webhook_url.includes('REAL_WEBHOOK_TOKEN'));

      // Re-upsert sending back masked values must NOT clobber real secrets
      await OrganizationAlertSettingsModel.upsert(
        ORG_ID,
        {
          cooldown_minutes: 30,
          slack_webhook_url: saved.slack_webhook_url,
          pagerduty_key: saved.pagerduty_key,
        },
        USER_OWNER
      );

      const findDecryptedByOrgId = (OrganizationAlertSettingsModel as any).findDecryptedByOrgId;
      assert.strictEqual(typeof findDecryptedByOrgId, 'function', 'findDecryptedByOrgId must exist for internal senders');
      const internal = await findDecryptedByOrgId.call(OrganizationAlertSettingsModel, ORG_ID);
      assert.strictEqual(internal.slack_webhook_url, rawWebhook);
      assert.strictEqual(internal.pagerduty_key, rawPdKey);
      assert.strictEqual(internal.cooldown_minutes, 30);
    });
  });

  test('3. HITL approval tokens store hashed multi-approver records, reject unissued/legacy tokens, and consume atomically', async () => {
    const ownerRole = (await pool.query(`SELECT id FROM organization_roles WHERE code = 'SME_OWNER' LIMIT 1`)).rows[0].id;
    const devopsRole = (await pool.query(`SELECT id FROM organization_roles WHERE code = 'DEVOPS' LIMIT 1`)).rows[0].id;

    await pool.query(
      `INSERT INTO organization_members (organization_id, user_id, role_id, status)
       VALUES ($1, $2, $3, 'ACTIVE'), ($1, $4, $5, 'ACTIVE')
       ON CONFLICT (organization_id, user_id) DO NOTHING`,
      [ORG_ID, USER_OWNER, ownerRole, USER_DEVOPS, devopsRole]
    );
    await pool.query(
      `INSERT INTO environments (id, organization_id, name, environment_type, code)
       VALUES ($1, $2, 'SD03 Env', 'PRODUCTION', 'sd03-env')
       ON CONFLICT (id) DO NOTHING`,
      [ENV_ID, ORG_ID]
    );
    await pool.query(
      `INSERT INTO healing_action_types (id, code, name, target_type, default_risk_level, requires_approval_by_default, enabled)
       VALUES ($1, 'SD03_HIGH_ACT', 'SD03 High Action', 'POD', 'HIGH', true, true)
       ON CONFLICT (id) DO NOTHING`,
      [ACT_TYPE_HIGH]
    );
    await pool.query(
      `INSERT INTO incidents (id, organization_id, environment_id, source_type, target_type, incident_type, title, severity, status, detected_at, started_at)
       VALUES ($1, $2, $3, 'AI_PREDICTION', 'POD', 'CRASH', 'SD03 Incident', 'HIGH', 'OPEN', NOW(), NOW())
       ON CONFLICT (id) DO NOTHING`,
      [INC_ID, ORG_ID, ENV_ID]
    );

    const actionRes = await pool.query(
      `INSERT INTO healing_actions (incident_id, environment_id, action_type_id, target_type, target_name, risk_level, execution_mode, approval_status, execution_status)
       VALUES ($1, $2, $3, 'POD', 'sd03-pod', 'HIGH', 'MANUAL', 'PENDING', 'PENDING')
       RETURNING id`,
      [INC_ID, ENV_ID, ACT_TYPE_HIGH]
    );
    const actionId = actionRes.rows[0].id;
    const approvalRes = await pool.query(
      `INSERT INTO approvals (healing_action_id, status, expires_at)
       VALUES ($1, 'PENDING', NOW() + INTERVAL '24 hours')
       RETURNING id`,
      [actionId]
    );
    const approvalId = approvalRes.rows[0].id;

    const issueFn = (HitlNotificationService as any).issueApprovalEmailToken;
    assert.strictEqual(typeof issueFn, 'function', 'issueApprovalEmailToken must exist');

    const ownerTok = await issueFn.call(HitlNotificationService, approvalId, actionId, USER_OWNER, ORG_ID);
    const devopsTok = await issueFn.call(HitlNotificationService, approvalId, actionId, USER_DEVOPS, ORG_ID);

    // approvals.approval_token MUST stay NULL (no plaintext JWT persisted)
    const apRow = await pool.query(`SELECT approval_token FROM approvals WHERE id = $1`, [approvalId]);
    assert.strictEqual(apRow.rows[0].approval_token, null, 'approvals.approval_token must remain NULL');

    // approval_email_tokens MUST store SHA-256 hashes only
    const tokRows = await pool.query(
      `SELECT token_hash, token_jti, user_id FROM approval_email_tokens WHERE approval_id = $1`,
      [approvalId]
    );
    assert.strictEqual(tokRows.rows.length, 2);
    const expectedOwnerHash = crypto.createHash('sha256').update(ownerTok).digest('hex');
    assert.ok(tokRows.rows.some((r) => r.token_hash === expectedOwnerHash));
    assert.ok(tokRows.rows.every((r) => !String(r.token_hash).startsWith('eyJ')));

    // Forged/unissued JWT signed locally MUST be rejected (403)
    const unissuedJwt = HitlNotificationService.generateApprovalToken(approvalId, actionId, USER_OWNER, ORG_ID);
    const unissuedRes = await HitlNotificationService.processQuickApprove(unissuedJwt);
    assert.strictEqual(unissuedRes.success, false);
    assert.strictEqual(unissuedRes.statusCode, 403);

    // Approver #2 (DevOps) approves -> 200; replay OR Approver #1 token -> 409
    const devopsApprove = await HitlNotificationService.processQuickApprove(devopsTok);
    assert.strictEqual(devopsApprove.statusCode, 200);
    assert.strictEqual(devopsApprove.success, true);

    const ownerLate = await HitlNotificationService.processQuickApprove(ownerTok);
    assert.strictEqual(ownerLate.success, false);
    assert.strictEqual(ownerLate.statusCode, 409);

    const devopsReplay = await HitlNotificationService.processQuickApprove(devopsTok);
    assert.strictEqual(devopsReplay.statusCode, 409);
  });

  test('4. decryptTotpSecret rejects unencrypted plaintext secrets (fail-closed)', () => {
    assert.throws(
      () => decryptTotpSecret('JBSWY3DPEHPK3PXP'),
      /không hợp lệ|encrypted|v1:/i
    );
  });

  test('5. runSensitiveDataBackfill encrypts legacy plaintext rows and clears approval_token', async () => {
    const migPool = createMigratorPool();
    try {
      const legacyWebhook = 'https://hooks.slack.com/services/TLEGACY/BLEGACY/PLAINTEXT';
      const legacyPd = 'legacy-pd-key-plaintext';
      await migPool.query(
        `INSERT INTO organizations (id, name, slug, type, status)
         VALUES ($1, 'SD03 Org', 'sd03-org', 'Enterprise', 'ACTIVE')
         ON CONFLICT (id) DO NOTHING`,
        [ORG_ID]
      );
      await migPool.query(
        `INSERT INTO organization_alert_settings (organization_id, slack_webhook_url, pagerduty_key)
         VALUES ($1, $2, $3)
         ON CONFLICT (organization_id) DO UPDATE
         SET slack_webhook_url = EXCLUDED.slack_webhook_url, pagerduty_key = EXCLUDED.pagerduty_key`,
        [ORG_ID, legacyWebhook, legacyPd]
      );

      const summary = await runSensitiveDataBackfill(migPool);
      assert.ok(summary.alertSettingsEncrypted >= 1, 'Expected at least 1 alert setting row encrypted');

      const rawAfter = await migPool.query(
        `SELECT slack_webhook_url, pagerduty_key FROM organization_alert_settings WHERE organization_id = $1`,
        [ORG_ID]
      );
      assert.ok(rawAfter.rows[0].slack_webhook_url.startsWith('enc:v1:'), 'slack_webhook_url must be enc:v1 ciphertext');
      assert.ok(rawAfter.rows[0].pagerduty_key.startsWith('enc:v1:'), 'pagerduty_key must be enc:v1 ciphertext');
      assert.strictEqual(cryptoVault.decryptSecret(rawAfter.rows[0].slack_webhook_url), legacyWebhook);
      assert.strictEqual(cryptoVault.decryptSecret(rawAfter.rows[0].pagerduty_key), legacyPd);

      const idempotentSummary = await runSensitiveDataBackfill(migPool);
      assert.strictEqual(idempotentSummary.alertSettingsEncrypted, 0, 'Backfill must be idempotent');
    } finally {
      await migPool.end();
    }
  });
});
