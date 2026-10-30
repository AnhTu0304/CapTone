import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { ReportModel } from '../models/report.model';
import { pool } from '../config/database';

describe('ReportModel SLA Report Tests', () => {
  const orgId = '6557b262-e8aa-40ff-b850-426b3b3461d2';
  const clusterId = 'b411d61c-9d75-4a68-a977-617aedae4bce';
  const envId = '04bbf168-64ab-4230-8a37-5b51231294a0';

  test('Query with organizationId only returns 20 incidents', async () => {
    const report = await ReportModel.getOrganizationSLAReport(orgId, null, null, '6M');
    assert.strictEqual(report.summary.totalIncidentsResolved, 20);
    assert.strictEqual(report.summary.actualUptime, '99.92%');
  });

  test('Query with clusterId returns 20 incidents', async () => {
    const report = await ReportModel.getOrganizationSLAReport(orgId, null, clusterId, '6M');
    assert.strictEqual(report.summary.totalIncidentsResolved, 20);
  });

  test('Query with clusterId passed as environmentId (backward compat) returns 20 incidents', async () => {
    const report = await ReportModel.getOrganizationSLAReport(orgId, clusterId, null, '6M');
    assert.strictEqual(report.summary.totalIncidentsResolved, 20);
    assert.strictEqual(report.summary.actualUptime, '99.92%');
  });

  test('Query with environmentId returns 20 incidents', async () => {
    const report = await ReportModel.getOrganizationSLAReport(orgId, envId, null, '6M');
    assert.strictEqual(report.summary.totalIncidentsResolved, 20);
    assert.strictEqual(report.summary.actualUptime, '99.92%');
  });

  after(async () => {
    await pool.end();
  });
});
