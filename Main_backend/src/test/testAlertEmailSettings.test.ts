import test, { describe, after } from 'node:test';
import assert from 'node:assert';
import { EmailService } from '../services/email.service';
import { OrganizationController } from '../controllers/organization.controller';
import { OrganizationModel } from '../models/organization.model';
import { OrganizationAlertSettingsModel } from '../models/organizationAlertSettings.model';
import { AuditService } from '../services/audit.service';
import { closeRedis } from '../config/redis';

const makeRes = () => {
  const state: { status: number; body: any } = { status: 200, body: null };
  const res: any = {
    status(code: number) {
      state.status = code;
      return res;
    },
    json(payload: any) {
      state.body = payload;
      return res;
    },
  };
  return { res, state };
};

describe('Organization Test Alert Email Settings Suite', () => {
  const origFindOrg = OrganizationModel.findById;
  const origFindSettings = OrganizationAlertSettingsModel.findOrDefaultByOrgId;
  const origGetRecipients = OrganizationAlertSettingsModel.getDefaultRecipientsPreview;
  const origAudit = AuditService.recordFromRequest;

  after(async () => {
    EmailService.setTransporterForTesting(null);
    OrganizationModel.findById = origFindOrg;
    OrganizationAlertSettingsModel.findOrDefaultByOrgId = origFindSettings;
    OrganizationAlertSettingsModel.getDefaultRecipientsPreview = origGetRecipients;
    AuditService.recordFromRequest = origAudit;
    await closeRedis();
  });

  test('1. Trả về lỗi chi tiết khi Gmail SMTP từ chối xác thực (535 BadCredentials)', async () => {
    EmailService.setTransporterForTesting({
      sendMail: async () => {
        const err: any = new Error('Invalid login: 535-5.7.8 Username and Password not accepted');
        err.responseCode = 535;
        throw err;
      },
    } as any);

    const res = await EmailService.sendTestAlertEmailWithResult({
      toEmail: 'owner@acme-company.vn',
      recipientName: 'Owner',
      organizationName: 'Acme Corp',
      triggeredByEmail: 'owner@acme-company.vn',
    });

    assert.strictEqual(res.ok, false);
    assert.match(res.error || '', /535/);
  });

  test('2. Bỏ qua địa chỉ dummy domain và báo skipped=true thay vì báo gửi thành công giả', async () => {
    EmailService.setTransporterForTesting({
      sendMail: async () => ({ messageId: 'ok' }),
    } as any);

    const res = await EmailService.sendTestAlertEmailWithResult({
      toEmail: 'tester@selfheal.com',
      organizationName: 'Acme Corp',
    });

    assert.strictEqual(res.ok, false);
    assert.strictEqual(res.skipped, true);
    assert.match(res.error || '', /thử nghiệm nội bộ/i);
  });

  test('3. OrganizationController.sendTestAlertEmail trả về HTTP 502 khi sent_count === 0 và HTTP 200 khi gửi thành công', async () => {
    OrganizationModel.findById = (async () => ({ id: 'org-1', name: 'Acme Corp' })) as any;
    OrganizationAlertSettingsModel.findOrDefaultByOrgId = (async () => ({ extra_emails: [] })) as any;
    OrganizationAlertSettingsModel.getDefaultRecipientsPreview = (async () => [
      { user_id: 'u-1', email: 'sre@acme-company.vn', full_name: 'SRE Lead', role_code: 'SME_OWNER' },
    ]) as any;
    AuditService.recordFromRequest = (async () => {}) as any;

    // Case A: SMTP fails -> 502 with error details
    EmailService.setTransporterForTesting({
      sendMail: async () => {
        const err: any = new Error('535-5.7.8 BadCredentials');
        err.responseCode = 535;
        throw err;
      },
    } as any);

    const { res: failRes, state: failState } = makeRes();
    await OrganizationController.sendTestAlertEmail(
      { params: { id: 'org-1' }, body: { to_email: 'sre@acme-company.vn' }, user: { id: 'u-1', email: 'sre@acme-company.vn' } } as any,
      failRes,
      ((err: any) => {
        throw err;
      }) as any
    );

    assert.strictEqual(failState.status, 502);
    assert.strictEqual(failState.body.success, false);
    assert.strictEqual(failState.body.errors.sent_count, 0);
    assert.match(failState.body.message, /535/);

    // Case B: SMTP succeeds -> 200 with sent_count: 1
    EmailService.setTransporterForTesting({
      sendMail: async () => ({ messageId: 'msg-123' }),
    } as any);

    const { res: okRes, state: okState } = makeRes();
    await OrganizationController.sendTestAlertEmail(
      { params: { id: 'org-1' }, body: { to_email: 'sre@acme-company.vn' }, user: { id: 'u-1', email: 'sre@acme-company.vn' } } as any,
      okRes,
      ((err: any) => {
        throw err;
      }) as any
    );

    assert.strictEqual(okState.status, 200);
    assert.strictEqual(okState.body.success, true);
    assert.strictEqual(okState.body.data.sent_count, 1);
    assert.deepStrictEqual(okState.body.data.recipients, ['sre@acme-company.vn']);
  });
});
