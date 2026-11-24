import { describe, test, after } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { closeRedis } from '../config/redis';
import { pool } from '../config/database';
import {
  safeWebsiteSchema,
  createOrganizationSchema,
  updateOrganizationSchema,
} from '../validations/organization.validation';
import { avatarSchema } from '../validations/user.validation';
import { EmailService } from '../services/email.service';
import { HitlNotificationService } from '../services/hitlNotification.service';
import { AlertEventModel } from '../models/alertEvent.model';
import { AlertRuleModel } from '../models/alertRule.model';

describe('SQL Injection & XSS Regression Suite (No-DB Unit Verification)', () => {
  after(async () => {
    await closeRedis().catch(() => {});
    await pool.end().catch(() => {});
  });
  test('XSS-01: safeWebsiteSchema / organization schemas reject javascript:, data:, and non-http(s) URLs', () => {
    for (const dangerous of [
      'javascript:alert(1)',
      'JAVASCRIPT:alert(document.cookie)',
      'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
      'vbscript:msgbox(1)',
      'ftp://files.example.com',
    ]) {
      assert.strictEqual(safeWebsiteSchema.safeParse(dangerous).success, false, `Must reject ${dangerous}`);
      assert.strictEqual(
        createOrganizationSchema.safeParse({ body: { name: 'Acme Org', website: dangerous } }).success,
        false
      );
      assert.strictEqual(
        updateOrganizationSchema.safeParse({ body: { website: dangerous } }).success,
        false
      );
    }

    for (const valid of ['https://selfheal.example.com', 'http://demo.giahungtrieu.net:8090', '']) {
      assert.strictEqual(safeWebsiteSchema.safeParse(valid).success, true, `Must accept ${valid}`);
    }
  });

  test('XSS-02: EmailService escapes broadcastCode, title, content, and recipientName in HTML emails', async () => {
    let capturedHtml = '';
    EmailService.setTransporterForTesting({
      sendMail: async (opts: any) => {
        capturedHtml = opts.html || '';
        return { messageId: 'unit-test' };
      },
    } as any);

    try {
      await EmailService.sendBroadcastEmail({
        toEmail: 'admin@test.local',
        recipientName: '<img src=x onerror=alert(1)>',
        broadcastCode: 'BRD-<script>alert(1)</script>',
        title: '<script>xss()</script>',
        content: '<svg onload=alert(1)>',
        priority: 'INFO',
      });

      assert.strictEqual(capturedHtml.includes('<script>alert(1)</script>'), false);
      assert.strictEqual(capturedHtml.includes('<script>xss()</script>'), false);
      assert.strictEqual(capturedHtml.includes('<svg onload=alert(1)>'), false);
      assert.strictEqual(capturedHtml.includes('<img src=x onerror=alert(1)>'), false);
      assert.strictEqual(capturedHtml.includes('BRD-&lt;script&gt;alert(1)&lt;/script&gt;'), true);
    } finally {
      EmailService.setTransporterForTesting(null);
    }
  });

  test('XSS: avatarSchema rejects SVG/script URIs and HitlNotificationService escapes rawToken', () => {
    assert.strictEqual(avatarSchema.safeParse('data:image/svg+xml;base64,PHN2Zz4=').success, false);
    assert.strictEqual(avatarSchema.safeParse('javascript:alert(1)').success, false);

    const html = HitlNotificationService.renderConfirmationPage('APPROVE', '"><script>alert(1)</script>');
    assert.strictEqual(html.includes('<script>alert(1)</script>'), false);
    assert.strictEqual(html.includes('&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;'), true);
  });

  test('SQL-01: AlertEventModel and AlertRuleModel ignore prototype keys (toString, constructor) in ORDER BY', async () => {
    const executedSql: string[] = [];
    const mockClient = {
      query: async (sql: string) => {
        executedSql.push(sql);
        if (sql.includes('COUNT(')) return { rows: [{ total: '0' }] };
        return { rows: [] };
      },
    } as any;

    const orgId = '00000000-0000-4000-8000-000000000001';
    await AlertEventModel.findByOrg(
      orgId,
      { sort_by: 'toString' as any, order: 'desc' },
      mockClient
    );
    await AlertEventModel.findHistory(
      orgId,
      { sortBy: 'constructor' as any, sortOrder: 'desc' } as any,
      mockClient
    );
    await AlertRuleModel.findByOrg(
      orgId,
      { sort_by: '__proto__' as any, order: 'asc' },
      mockClient
    );

    const joined = executedSql.join('\n');
    assert.strictEqual(joined.includes('function toString'), false);
    assert.strictEqual(joined.includes('function Object'), false);
    assert.strictEqual(joined.includes('[object Object]'), false);
    assert.strictEqual(joined.includes('ORDER BY ae.last_seen_at DESC'), true);
    assert.strictEqual(joined.includes('ORDER BY ae.first_detected_at DESC'), true);
    assert.strictEqual(joined.includes('ORDER BY ar.created_at ASC'), true);
  });

  test('XSS-03 & XSS-04: Nginx CSP configs omit unsafe-inline in script-src and preserve CSP on static assets', () => {
    const repoRoot = path.resolve(__dirname, '../../..');
    const feNginx = fs.readFileSync(path.join(repoRoot, 'Frontend/nginx.conf'), 'utf8');
    const edgeHeaders = fs.readFileSync(path.join(repoRoot, 'nginx/security-headers.conf'), 'utf8');

    for (const [name, content] of [
      ['Frontend/nginx.conf', feNginx],
      ['nginx/security-headers.conf', edgeHeaders],
    ]) {
      const scriptSrcMatch = content.match(/script-src\s+([^;]+);/);
      assert.ok(scriptSrcMatch, `${name} must define script-src`);
      assert.strictEqual(
        scriptSrcMatch![1].includes("'unsafe-inline'"),
        false,
        `${name} script-src must not allow 'unsafe-inline'`
      );
    }

    const staticBlockMatch = feNginx.match(/location\s+~\*\s+\\.\(\?:ico[\s\S]*?\}/);
    assert.ok(staticBlockMatch, 'Static assets location block must exist');
    assert.strictEqual(
      staticBlockMatch![0].includes('Content-Security-Policy'),
      true,
      'Static assets location block must preserve Content-Security-Policy'
    );
  });
});
