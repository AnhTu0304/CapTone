import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import crypto from 'node:crypto';
import http from 'node:http';
import path from 'node:path';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
process.env.NODE_ENV = 'test';
process.env.DB_NAME = 'aiselfhealing_test';
process.env.REDIS_ENABLED = 'false';

import app from '../app';
import { pool, createMigratorPool } from '../config/database';
import { config } from '../config/env';
import { closeRedis } from '../config/redis';
import { AlertRuleService } from '../services/alertRule.service';
import { HealingActionService } from '../services/healingAction.service';
import { HealingActionModel } from '../models/healingAction.model';
import { EmailService } from '../services/email.service';
import { HitlNotificationService } from '../services/hitlNotification.service';
import { avatarSchema } from '../validations/user.validation';

const ORG_A = 'd6660000-0000-4000-8000-000000000001';
const ORG_B = 'd6660000-0000-4000-8000-000000000002';
const ENV_A = 'd6660000-0000-4000-8000-000000000011';
const CLUSTER_A = 'd6660000-0000-4000-8000-000000000021';
const NS_A = 'd6660000-0000-4000-8000-000000000031';
const NODE_A = 'd6660000-0000-4000-8000-000000000041';
const POD_A = 'd6660000-0000-4000-8000-000000000051';
const INC_A = 'd6660000-0000-4000-8000-000000000061';
const ACT_TYPE_HIGH = 'd6660000-0000-4000-8000-000000000071';

const USER_OWNER_A = 'd6660000-0000-4000-8000-000000000101';
const USER_VIEWER_A = 'd6660000-0000-4000-8000-000000000102';
const USER_SUPER_NO_ORG = 'd6660000-0000-4000-8000-000000000103';

function signTok(id: string, email: string, roles: string[], orgId?: string) {
  return jwt.sign(
    {
      id,
      email,
      roles,
      token_version: 1,
      ...(orgId ? { organization_id: orgId } : {}),
    },
    config.jwt.secret,
    { expiresIn: '15m', algorithm: 'HS256' }
  );
}

async function httpReq(
  server: http.Server,
  method: string,
  urlPath: string,
  headers: Record<string, string> = {},
  body?: unknown
): Promise<{ status: number; headers: http.IncomingHttpHeaders; json: any; text: string }> {
  const addr = server.address() as { port: number };
  return new Promise((resolve, reject) => {
    const payload =
      body === undefined
        ? undefined
        : typeof body === 'string'
        ? body
        : JSON.stringify(body);
    const req = http.request(
      {
        host: '127.0.0.1',
        port: addr.port,
        path: urlPath,
        method,
        headers: {
          ...(payload && !headers['Content-Type']
            ? { 'Content-Type': 'application/json', 'Content-Length': String(Buffer.byteLength(payload)) }
            : payload
            ? { 'Content-Length': String(Buffer.byteLength(payload)) }
            : {}),
          ...headers,
        },
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          let parsed: any = null;
          try {
            parsed = JSON.parse(data);
          } catch {
            parsed = null;
          }
          resolve({ status: res.statusCode || 0, headers: res.headers, json: parsed, text: data });
        });
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

describe('Sprint D Phase 6 (SD-06): OWASP Application Security', () => {
  let server: http.Server;

  before(async () => {
    const mig = createMigratorPool();
    try {
      await mig.query(
        `INSERT INTO users (id, email, password_hash, full_name, status)
         VALUES ($1, 'sd06-owner@test.local', 'hash', 'SD06 Owner', 'ACTIVE'),
                ($2, 'sd06-viewer@test.local', 'hash', 'SD06 Viewer', 'ACTIVE'),
                ($3, 'sd06-super@test.local', 'hash', 'SD06 SuperNoOrg', 'ACTIVE')
         ON CONFLICT (id) DO NOTHING`,
        [USER_OWNER_A, USER_VIEWER_A, USER_SUPER_NO_ORG]
      );

      await mig.query(
        `INSERT INTO organizations (id, name, slug, type, status)
         VALUES ($1, 'SD06 Org A', 'sd06-org-a', 'Enterprise', 'ACTIVE'),
                ($2, 'SD06 Org B', 'sd06-org-b', 'Enterprise', 'ACTIVE')
         ON CONFLICT (id) DO NOTHING`,
        [ORG_A, ORG_B]
      );

      const rolesRes = await mig.query(`SELECT id, code FROM organization_roles`);
      const roleMap = new Map(rolesRes.rows.map((r: any) => [String(r.code).toUpperCase(), r.id]));
      await mig.query(
        `INSERT INTO organization_members (organization_id, user_id, role_id, status)
         VALUES ($1, $2, $3, 'ACTIVE'),
                ($1, $4, $5, 'ACTIVE')
         ON CONFLICT DO NOTHING`,
        [ORG_A, USER_OWNER_A, roleMap.get('SME_OWNER'), USER_VIEWER_A, roleMap.get('VIEWER')]
      );

      await mig.query(
        `INSERT INTO environments (id, organization_id, name, environment_type, code)
         VALUES ($1, $2, 'SD06 Env', 'PRODUCTION', 'sd06-env')
         ON CONFLICT (id) DO NOTHING`,
        [ENV_A, ORG_A]
      );

      await mig.query(
        `INSERT INTO clusters (id, environment_id, name, cluster_uid, provider, status)
         VALUES ($1, $2, 'sd06-cluster-a', 'sd06-cluster-uid', 'MINIKUBE', 'ONLINE')
         ON CONFLICT (id) DO NOTHING`,
        [CLUSTER_A, ENV_A]
      );

      await mig.query(
        `INSERT INTO namespaces (id, cluster_id, name, kubernetes_uid, status)
         VALUES ($1, $2, 'default', 'sd06-ns-uid', 'ACTIVE')
         ON CONFLICT (id) DO NOTHING`,
        [NS_A, CLUSTER_A]
      );

      await mig.query(
        `INSERT INTO nodes (id, cluster_id, kubernetes_uid, name, status)
         VALUES ($1, $2, 'sd06-node-uid', 'sd06-node-a', 'READY')
         ON CONFLICT (id) DO NOTHING`,
        [NODE_A, CLUSTER_A]
      );

      await mig.query(
        `INSERT INTO pods (id, cluster_id, namespace_id, kubernetes_uid, name, status, phase)
         VALUES ($1, $2, $3, 'sd06-pod-uid', 'sd06-pod-a', 'Running', 'Running')
         ON CONFLICT (id) DO NOTHING`,
        [POD_A, CLUSTER_A, NS_A]
      );

      await mig.query(
        `INSERT INTO healing_action_types (id, code, name, target_type, default_risk_level, requires_approval_by_default, enabled)
         VALUES ($1, 'SD06_HIGH_ACT', 'Drain Node SD06', 'POD', 'HIGH', true, true)
         ON CONFLICT (id) DO NOTHING`,
        [ACT_TYPE_HIGH]
      );

      await mig.query(
        `INSERT INTO incidents (id, organization_id, environment_id, cluster_id, source_type, target_type, incident_type, target_name, title, severity, status, detected_at, started_at)
         VALUES ($1, $2, $3, $4, 'AI_PREDICTION', 'POD', 'CRASH', 'sd06-pod-a', '<img src=x onerror=alert(1)>', 'HIGH', 'OPEN', NOW(), NOW())
         ON CONFLICT (id) DO NOTHING`,
        [INC_A, ORG_A, ENV_A, CLUSTER_A]
      );
    } finally {
      await mig.end();
    }

    server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  });

  after(async () => {
    EmailService.setTransporterForTesting(null);
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await closeRedis().catch(() => {});
    await pool.end().catch(() => {});
  });

  test('1. Access control / IDOR: SUPER_ADMIN non-member blocked across AlertRule, Node/Pod, Policy, Viewer alert-settings, Audit allowlist', async () => {
    // 1a. AlertRuleService.enforceOrgAccess must reject SUPER_ADMIN without active org membership
    await assert.rejects(
      () => AlertRuleService.enforceOrgAccess({ id: USER_SUPER_NO_ORG, roles: ['SUPER_ADMIN'] }, ORG_A),
      /403|không có quyền|tổ chức/i
    );

    // 1b. Cross-org createPolicy by Org A owner targeting ORG_B must fail 403
    await assert.rejects(
      () =>
        HealingActionService.createPolicy(
          { organization_id: ORG_B, name: 'Cross-org evil policy' },
          { id: USER_OWNER_A, email: 'sd06-owner@test.local', roles: ['SME_OWNER'], organization_id: ORG_A }
        ),
      /403|không có quyền|tổ chức/i
    );

    // 1c. SUPER_ADMIN without Org A membership cannot drain Node A or restart Pod A (must return 403)
    const superTok = signTok(USER_SUPER_NO_ORG, 'sd06-super@test.local', ['SUPER_ADMIN']);
    const drainRes = await httpReq(server, 'POST', `/api/v1/nodes/${NODE_A}/drain`, {
      Authorization: `Bearer ${superTok}`,
    });
    assert.strictEqual(drainRes.status, 403, `Expected 403 on cross-org drainNode, got ${drainRes.status}`);

    const restartRes = await httpReq(server, 'POST', `/api/v1/pods/${POD_A}/restart`, {
      Authorization: `Bearer ${superTok}`,
    });
    assert.strictEqual(restartRes.status, 403, `Expected 403 on cross-org restartPod, got ${restartRes.status}`);

    // 1d. Unscoped /api/v1/nodes/:nodeId/metrics requires ADMIN role just like other unscoped node routes (VIEWER rejected 403)
    const viewerTok = signTok(USER_VIEWER_A, 'sd06-viewer@test.local', ['USER'], ORG_A);
    const metricsRes = await httpReq(server, 'GET', `/api/v1/nodes/${NODE_A}/metrics`, {
      Authorization: `Bearer ${viewerTok}`,
    });
    assert.strictEqual(metricsRes.status, 403, `Expected 403 on unscoped node metrics by VIEWER, got ${metricsRes.status}`);

    // 1e. GET /organizations/:id/alert-settings must reject VIEWER (403)
    const alertSettingsRes = await httpReq(server, 'GET', `/api/v1/organizations/${ORG_A}/alert-settings`, {
      Authorization: `Bearer ${viewerTok}`,
    });
    assert.strictEqual(alertSettingsRes.status, 403, `Expected 403 for VIEWER reading alert-settings, got ${alertSettingsRes.status}`);

    // 1f. POST /users/me/activities rejects spoofed arbitrary admin audit action strings
    const actRes = await httpReq(
      server,
      'POST',
      '/api/v1/users/me/activities',
      { Authorization: `Bearer ${viewerTok}` },
      { action: 'SUPER_ADMIN_SYSTEM_BREACH', description: 'spoofed' }
    );
    assert.strictEqual(actRes.status, 400, `Expected 400 for arbitrary client audit action, got ${actRes.status}`);
  });

  test('2. SSRF & SVG XSS input validation: blocks metadata/loopback/arbitrary webhook URLs and SVG avatar', async () => {
    const ownerTok = signTok(USER_OWNER_A, 'sd06-owner@test.local', ['USER'], ORG_A);

    for (const badUrl of [
      'http://169.254.169.254/latest/meta-data/',
      'http://127.0.0.1:8080/internal-admin',
      'https://10.0.0.5/webhook',
      'https://evil.attacker.com/exfiltrate',
    ]) {
      const res = await httpReq(
        server,
        'PUT',
        `/api/v1/organizations/${ORG_A}/alert-settings`,
        { Authorization: `Bearer ${ownerTok}` },
        { slack_webhook_url: badUrl }
      );
      assert.strictEqual(res.status, 400, `SSRF URL ${badUrl} must be rejected 400, got ${res.status}`);
    }

    const validSlack = await httpReq(
      server,
      'PUT',
      `/api/v1/organizations/${ORG_A}/alert-settings`,
      { Authorization: `Bearer ${ownerTok}` },
      { slack_webhook_url: 'https://hooks.slack.com/services/T01/B02/VALID999' }
    );
    assert.strictEqual(validSlack.status, 200);

    // SVG avatar XSS payload must fail avatarSchema
    const svgCheck = avatarSchema.safeParse('data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9YWxlcnQoMSk+PC9zdmc+');
    assert.strictEqual(svgCheck.success, false, 'SVG data URI must be rejected');
    const pngCheck = avatarSchema.safeParse('data:image/png;base64,iVBORw0KGgo=');
    assert.strictEqual(pngCheck.success, true, 'PNG data URI must remain valid');
  });

  test('3. EmailService escapes HTML payloads and uses configured clientUrl (no hardcoded localhost)', async () => {
    const sent: any[] = [];
    EmailService.setTransporterForTesting({
      sendMail: async (opts: any) => {
        sent.push(opts);
        return { messageId: 'sd06-mail' };
      },
    } as any);

    const prevClientUrl = config.email.clientUrl;
    config.email.clientUrl = 'https://portal.selfheal.example';
    try {
      await EmailService.sendVerificationEmail('u@test.local', '123456', '<script>alert(1)</script>');
      await EmailService.sendInvitationEmail('u@test.local', '<img src=x onerror=alert(2)>', '<b>Inv</b>', '<svg onload=alert(3)>', 'ADMIN');
      await EmailService.sendGoogleWelcomeEmail('u@test.local', '"><script>alert(4)</script>');
      await EmailService.sendHitlApprovalNotification({
        toEmail: 'u@test.local',
        recipientName: '<script>hitl()</script>',
        organizationName: '<svg/onload=alert(5)>',
        actionName: 'Restart Pod',
        actionCode: 'RESTART_POD',
        riskLevel: 'HIGH',
        targetName: 'pod-1',
        targetType: 'POD',
        approvalId: crypto.randomUUID(),
        healingActionId: crypto.randomUUID(),
        token: 'tok-abc-123',
      });

      assert.strictEqual(sent.length, 4);
      for (const mail of sent) {
        const html: string = mail.html || '';
        assert.ok(!html.includes('<script>alert'), 'Raw <script> tag must be escaped');
        assert.ok(!html.includes('<script>hitl'), 'Raw <script> in HITL email must be escaped');
        assert.ok(!html.includes('<svg'), 'Raw <svg> tag must be escaped');
        assert.ok(!html.includes('http://localhost:'), `Must not hardcode http://localhost in emails, got HTML containing localhost`);
      }
    } finally {
      config.email.clientUrl = prevClientUrl;
    }
  });

  test('4. HITL GET quick-approve renders confirmation page without mutating DB; POST executes; telemetry ?token= blocked; Helmet CSP active', async () => {
    const act = await HealingActionModel.createAction({
      incident_id: INC_A,
      environment_id: ENV_A,
      action_type_id: ACT_TYPE_HIGH,
      target_name: 'sd06-hitl-confirm',
      risk_level: 'HIGH',
    });
    const apId = (await pool.query(`SELECT id FROM approvals WHERE healing_action_id = $1`, [act.id])).rows[0].id;
    const tok = await HitlNotificationService.issueApprovalEmailToken(apId, act.id, USER_OWNER_A, ORG_A);

    // 4a. GET renders confirmation HTML with POST form, does NOT mutate approval
    const getRes = await httpReq(
      server,
      'GET',
      `/api/v1/healing/approvals/quick-approve?token=${encodeURIComponent(tok)}`
    );
    assert.strictEqual(getRes.status, 200);
    assert.ok(/<form[^>]*method=["']POST["']/i.test(getRes.text), 'GET quick-approve must render POST confirmation form');
    assert.ok(getRes.headers['content-security-policy'], 'Helmet CSP header must be present');

    const statusAfterGet = (await pool.query(`SELECT status FROM approvals WHERE id = $1`, [apId])).rows[0].status;
    assert.strictEqual(statusAfterGet, 'PENDING', 'GET prefetch/preview must NEVER mutate approval state');

    // 4b. POST commits approval cleanly
    const postRes = await httpReq(
      server,
      'POST',
      `/api/v1/healing/approvals/quick-approve`,
      { 'Content-Type': 'application/x-www-form-urlencoded' },
      `token=${encodeURIComponent(tok)}`
    );
    assert.strictEqual(postRes.status, 200);
    const statusAfterPost = (await pool.query(`SELECT status FROM approvals WHERE id = $1`, [apId])).rows[0].status;
    assert.strictEqual(statusAfterPost, 'APPROVED', 'POST quick-approve must commit approval');

    // 4c. /telemetry/logs/stream no longer accepts ?token= in URL query string
    const ownerTok = signTok(USER_OWNER_A, 'sd06-owner@test.local', ['USER'], ORG_A);
    const streamRes = await httpReq(
      server,
      'GET',
      `/api/v1/telemetry/logs/stream?token=${encodeURIComponent(ownerTok)}`
    );
    assert.strictEqual(streamRes.status, 401, 'Query ?token= on SSE stream must be rejected with 401');
  });
});
