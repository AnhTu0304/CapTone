import test, { describe, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import { CriticalIncidentNotificationService } from '../services/criticalIncidentNotification.service';
import { OrganizationAlertSettingsModel, IDefaultAlertRecipient, IOrganizationAlertSettings } from '../models/organizationAlertSettings.model';
import { EmailService } from '../services/email.service';
import { EmailQueue, EmailWorker, EmailJob } from '../services/emailQueue.service';
import { closeRedis, redisClient } from '../config/redis';

describe('Critical Incident Urgent Alerting & Anti-Spam Cooldown Suite', () => {
  beforeEach(() => {
    CriticalIncidentNotificationService.clearMemoryCooldownsForTesting();
  });

  after(async () => {
    EmailService.setTransporterForTesting(null);
    CriticalIncidentNotificationService.clearMemoryCooldownsForTesting();
    await closeRedis();
  });

  test('1. Lọc người nhận chuẩn RBAC: chỉ lấy SME_OWNER + DEVOPS (bỏ VIEWER), gộp extra_emails khử trùng lặp', () => {
    const orgMembers: IDefaultAlertRecipient[] = [
      { user_id: 'u-owner', email: 'Owner@Acme.vn', full_name: 'Trần Chủ Sở Hữu', role_code: 'SME_OWNER' },
      { user_id: 'u-devops', email: 'devops@acme.vn', full_name: 'Nguyễn DevOps', role_code: 'DEVOPS' },
      { user_id: 'u-viewer', email: 'viewer@acme.vn', full_name: 'Lê Viewer', role_code: 'VIEWER' },
      { user_id: 'u-admin', email: 'admin@acme.vn', full_name: 'Admin Sys', role_code: 'ADMIN' },
    ];

    const extraEmails = [
      'oncall@acme.vn',
      'OWNER@acme.vn', // Trùng với thành viên SME_OWNER (khác hoa/thường) -> phải khử trùng
      'invalid-email',
      'sre-backup@acme.vn',
      'sre-backup@acme.vn', // Trùng trong extra_emails -> phải khử trùng
    ];

    const { inAppMembers, emailTargets } = CriticalIncidentNotificationService.resolveRecipientTargets(
      orgMembers,
      extraEmails,
      { emailEnabled: true, excludeHitlApprovers: false }
    );

    // Chỉ có SME_OWNER & DEVOPS nhận thông báo In-App
    assert.deepStrictEqual(
      inAppMembers.map((m) => m.user_id).sort(),
      ['u-devops', 'u-owner']
    );

    // Email gửi tới owner + devops + oncall + sre-backup (loại viewer, loại admin, loại trùng)
    const targetEmails = emailTargets.map((t) => t.toEmail).sort();
    assert.deepStrictEqual(targetEmails, [
      'devops@acme.vn',
      'oncall@acme.vn',
      'owner@acme.vn',
      'sre-backup@acme.vn',
    ]);
    assert.strictEqual(targetEmails.includes('viewer@acme.vn'), false);
  });

  test('2. Khi HITL đã gửi mail phê duyệt (excludeHitlApprovers=true): vẫn gửi In-App + extra_emails nhưng không gửi trùng email SME_OWNER/DEVOPS', () => {
    const orgMembers: IDefaultAlertRecipient[] = [
      { user_id: 'u-owner', email: 'owner@acme.vn', full_name: 'Owner', role_code: 'SME_OWNER' },
      { user_id: 'u-devops', email: 'devops@acme.vn', full_name: 'DevOps', role_code: 'DEVOPS' },
    ];

    const { inAppMembers, emailTargets } = CriticalIncidentNotificationService.resolveRecipientTargets(
      orgMembers,
      ['oncall-pager@acme.vn'],
      { emailEnabled: true, excludeHitlApprovers: true }
    );

    assert.strictEqual(inAppMembers.length, 2, 'Vẫn phải tạo notification trong app cho SME_OWNER & DEVOPS');
    assert.deepStrictEqual(
      emailTargets.map((t) => t.toEmail),
      ['oncall-pager@acme.vn']
    );
  });

  test('3. OrganizationAlertSettingsModel.normalizeExtraEmails chuẩn hóa & loại bỏ email không hợp lệ', () => {
    const normalized = OrganizationAlertSettingsModel.normalizeExtraEmails([
      '  Alerts@Test.COM ',
      'alerts@test.com',
      'bad@@mail',
      'oncall@ops.io',
      '',
    ]);
    assert.deepStrictEqual(normalized, ['alerts@test.com', 'oncall@ops.io']);
  });

  test('4. Kiểm tra gating cấu hình gửi email tự động theo stage (NO_ACTION / HEALING_FAILED)', () => {
    const settings: IOrganizationAlertSettings = {
      organization_id: '00000000-0000-0000-0000-000000000001',
      critical_email_enabled: true,
      notify_on_no_action: false,
      notify_on_healing_failed: true,
      extra_emails: [],
      cooldown_minutes: 15,
    };

    assert.strictEqual(
      CriticalIncidentNotificationService.isEmailAllowedBySettings(settings, 'NO_ACTION', false),
      false,
      'Khi notify_on_no_action=false, auto NO_ACTION không gửi mail'
    );
    assert.strictEqual(
      CriticalIncidentNotificationService.isEmailAllowedBySettings({ ...settings, notify_on_no_action: true }, 'NO_ACTION', false),
      true,
      'Khi notify_on_no_action=true, auto NO_ACTION tự động gửi mail'
    );
    assert.strictEqual(
      CriticalIncidentNotificationService.isEmailAllowedBySettings(settings, 'HEALING_FAILED', false),
      true
    );

    const allDisabled: IOrganizationAlertSettings = { ...settings, critical_email_enabled: false };
    assert.strictEqual(
      CriticalIncidentNotificationService.isEmailAllowedBySettings(allDisabled, 'HEALING_FAILED', false),
      false
    );
    assert.strictEqual(
      CriticalIncidentNotificationService.isEmailAllowedBySettings(allDisabled, 'NO_ACTION', false),
      false
    );
  });

  test('5. Cơ chế chống spam Cooldown: cùng dịch vụ + cùng loại lỗi + cùng stage bị chặn ở lần 2, khác stage hoặc khác dịch vụ vẫn đi', async () => {
    const originalStatus = redisClient.status;
    try {
      // Ép test đi qua memoryCooldowns để test ổn định không phụ thuộc trạng thái Redis ngoài
      (redisClient as any).status = 'disconnected';

      const key1 = CriticalIncidentNotificationService.buildCooldownKey(
        'org-1',
        'mongodb',
        'SERVICE_DEGRADATION',
        'NO_ACTION'
      );
      const keyOtherStage = CriticalIncidentNotificationService.buildCooldownKey(
        'org-1',
        'mongodb',
        'SERVICE_DEGRADATION',
        'HEALING_FAILED'
      );
      const keyOtherSvc = CriticalIncidentNotificationService.buildCooldownKey(
        'org-1',
        'sme-order-service',
        'SERVICE_DEGRADATION',
        'NO_ACTION'
      );

      assert.strictEqual(await CriticalIncidentNotificationService.acquireCooldownSlot(key1, 15), true);
      assert.strictEqual(
        await CriticalIncidentNotificationService.acquireCooldownSlot(key1, 15),
        false,
        'Lần 2 trong 15 phút phải bị Cooldown chặn để chống spam email'
      );
      assert.strictEqual(await CriticalIncidentNotificationService.acquireCooldownSlot(keyOtherStage, 15), true);
      assert.strictEqual(await CriticalIncidentNotificationService.acquireCooldownSlot(keyOtherSvc, 15), true);
    } finally {
      (redisClient as any).status = originalStatus;
    }
  });

  test('6. EmailService.buildCriticalIncidentEmailContent tạo deep-link ?incident=, hiển thị cảnh báo NO_ACTION và thoát HTML XSS an toàn', () => {
    const incidentId = '200cf5c3-bedc-4456-90a4-dd90015c4982';
    const content = EmailService.buildCriticalIncidentEmailContent({
      toEmail: 'phamthaisang1710@gmail.com',
      recipientName: 'Thái Sang',
      recipientRole: 'SME_OWNER',
      incidentId,
      title: 'Suy giảm hiệu năng dịch vụ trên <script>alert(1)</script> mongodb',
      severity: 'CRITICAL',
      serviceName: 'mongodb',
      podName: 'mongodb-0',
      nodeName: 'minikube',
      namespace: 'test-lab',
      clusterName: 'fyuyu',
      organizationName: 'Acme Lab',
      rootCauseType: 'Service performance degradation',
      rootCauseDescription: 'Latency spike > 2500ms',
      confidenceScore: 0.89,
      recommendationAction: 'NO_ACTION',
      recommendationReason: 'No safe automated action; requires manual DBA inspection',
      reasonStage: 'NO_ACTION',
    });

    assert.ok(content.subject.includes('INC-200CF5C3'), 'Subject phải chứa mã sự cố INC-200CF5C3');
    assert.ok(content.subject.includes('mongodb'), 'Subject phải chứa tên dịch vụ');
    assert.ok(
      content.dashboardUrl.includes(`/dashboard/incidents?incident=${incidentId}`),
      'Deep-link phải trỏ đúng tới trang sự cố kèm query ?incident='
    );
    assert.ok(content.html.includes('Cầu dao an toàn (Circuit Breaker)'), 'Phải giải thích rõ cầu dao NO_ACTION cần kỹ sư kiểm tra');
    assert.ok(content.html.includes('mongodb-0'), 'Phải chứa tên Pod');
    assert.strictEqual(content.html.includes('<script>alert(1)</script>'), false, 'HTML phải escape thẻ script chống XSS');
  });

  test('7. EmailService.sendCriticalIncidentAlertEmail & EmailWorker xử lý job CRITICAL_INCIDENT_ALERT qua mock transporter', async () => {
    const sentEmails: any[] = [];
    EmailService.setTransporterForTesting({
      sendMail: async (mailOptions: any) => {
        sentEmails.push(mailOptions);
        return { messageId: 'mock-critical-id' };
      },
    } as any);

    const directOk = await EmailService.sendCriticalIncidentAlertEmail({
      toEmail: 'devops@acme.vn',
      recipientName: 'DevOps',
      recipientRole: 'DEVOPS',
      incidentId: '200cf5c3-bedc-4456-90a4-dd90015c4982',
      title: 'Suy giảm hiệu năng dịch vụ trên mongodb',
      severity: 'CRITICAL',
      serviceName: 'mongodb',
      reasonStage: 'NO_ACTION',
      recommendationAction: 'NO_ACTION',
    });

    assert.strictEqual(directOk, true);
    assert.strictEqual(sentEmails.length, 1);
    assert.strictEqual(sentEmails[0].to, 'devops@acme.vn');
    assert.ok(sentEmails[0].html.includes('INC-200CF5C3'));

    const job: EmailJob = {
      id: 'crit-job-1',
      type: 'CRITICAL_INCIDENT_EMAIL',
      toEmail: 'owner@acme.vn',
      recipientName: 'SME Owner',
      recipientRole: 'SME_OWNER',
      incidentId: '200cf5c3-bedc-4456-90a4-dd90015c4982',
      incidentCode: 'INC-200CF5C3',
      title: 'Tự phục hồi thất bại trên mongodb',
      severity: 'CRITICAL',
      serviceName: 'mongodb',
      reasonStage: 'HEALING_FAILED',
      failureMessage: 'ExitCode 137 OOMKilled',
      createdAt: Date.now(),
      attempts: 0,
      maxAttempts: 3,
    };

    const workerOk = await EmailWorker.processJob(job, JSON.stringify(job));
    assert.strictEqual(workerOk, true);
    assert.strictEqual(sentEmails.length, 2);
    assert.strictEqual(sentEmails[1].to, 'owner@acme.vn');
    assert.ok(sentEmails[1].html.includes('ExitCode 137 OOMKilled'));

    EmailService.setTransporterForTesting(null);
  });
});
