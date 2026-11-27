import test, { describe, after, afterEach } from 'node:test';
import assert from 'node:assert';
import { EmailService } from '../services/email.service';
import { HitlNotificationService } from '../services/hitlNotification.service';
import { closeRedis } from '../config/redis';

describe('Email Branding, Purpose Intro & Logo Template Redesign', () => {
  after(async () => {
    await closeRedis();
  });

  afterEach(() => {
    EmailService.setTransporterForTesting(null);
  });

  test('all EmailService templates remove CapTone branding, embed project logo CID, and include purpose intro', async () => {
    const sent: any[] = [];
    EmailService.setTransporterForTesting({
      sendMail: async (opts: any) => {
        sent.push(opts);
        return { messageId: `mock-${sent.length}` };
      },
    } as any);

    await EmailService.sendVerificationEmail('user@company.vn', '123456', 'Minh Dev');
    await EmailService.sendInvitationEmail('user@company.vn', 'Minh Dev', 'Lan Lead', 'Acme K8s', 'DEVOPS');
    await EmailService.sendGoogleWelcomeEmail('user@gmail.com', 'Minh Google');
    await EmailService.sendCriticalIncidentAlertEmail({
      toEmail: 'ops@company.vn',
      recipientName: 'Ops Lead',
      incidentId: '200cf5c3-bedc-4456-90a4-dd90015c4982',
      title: 'Container OOMKilled',
      severity: 'CRITICAL',
      serviceName: 'checkout-api',
      reasonStage: 'NO_ACTION',
    });
    await EmailService.sendTestAlertEmailWithResult({
      toEmail: 'ops@company.vn',
      recipientName: 'Ops Lead',
      organizationName: 'Acme K8s',
      triggeredByEmail: 'admin@company.vn',
    });
    await EmailService.sendBroadcastEmail({
      toEmail: 'ops@company.vn',
      recipientName: 'Ops Lead',
      broadcastCode: 'SYS-2026',
      title: 'Nâng cấp hệ thống',
      content: 'Bảo trì cụm định kỳ 02:00 UTC',
      priority: 'INFO',
    });
    await EmailService.sendHitlApprovalNotification({
      toEmail: 'ops@company.vn',
      recipientName: 'Ops Lead',
      approvalId: 'app-12345678',
      healingActionId: 'act-1',
      targetName: 'checkout-api',
      targetType: 'Deployment',
      actionCode: 'ROLLBACK_DEPLOYMENT',
      actionName: 'Khôi phục phiên bản',
      riskLevel: 'HIGH',
      token: 'signed-jwt-token',
    });
    await EmailService.sendPasswordResetEmail('user@company.vn', 'Minh Dev', 'reset-tok');

    assert.strictEqual(sent.length, 8);

    for (const mail of sent) {
      assert.strictEqual(/captone/i.test(mail.subject), false, `Subject must not contain CapTone: ${mail.subject}`);
      assert.strictEqual(/captone/i.test(mail.html), false, `HTML for "${mail.subject}" must not contain CapTone`);
      assert.ok(mail.html.includes('cid:selfheal-logo'), `HTML for "${mail.subject}" must embed cid:selfheal-logo`);
      assert.ok(mail.html.includes('Mục đích thư'), `HTML for "${mail.subject}" must include Mục đích thư intro`);
      assert.ok(mail.html.includes('AI Self-Heal'), `HTML for "${mail.subject}" must include AI Self-Heal brand`);
      assert.ok(
        Array.isArray(mail.attachments) && mail.attachments.some((att: any) => att.cid === 'selfheal-logo'),
        `Mail "${mail.subject}" must attach inline logo with cid=selfheal-logo`
      );
    }
  });

  test('HitlNotificationService confirmation page removes CapTone branding and includes PNG logo', () => {
    const html = HitlNotificationService.renderConfirmationPage('APPROVE', 'dummy-token');
    assert.strictEqual(/captone/i.test(html), false, 'Confirmation page must not contain CapTone');
    assert.ok(html.includes('AI Self-Heal Platform'), 'Confirmation page must include AI Self-Heal Platform');
    assert.ok(html.includes('data:image/png;base64,'), 'Confirmation page must render embedded PNG logo');
  });
});
