import ExcelJS from 'exceljs/dist/exceljs.min.js';
import {
  REPORT_EXCEL_SECTIONS,
  exportReportsToExcel,
} from './reportExcelExport';

const samplePayload = {
  reportData: {
    summary: {
      actualUptime: '99.98%',
      targetSla: '99.90%',
      mttrAvgSeconds: 4.2,
      totalIncidentsResolved: 7105,
      autonomousHealingRate: '88.3%',
      totalOperatingHours: 720,
    },
    monthlyTrends: [
      {
        month: 'Tuần 1',
        uptime: 99.98,
        slaTarget: 99.9,
        preventedIncidents: 610,
        downtimeAvoidedHours: 183,
        mttrSeconds: 4.1,
        autonomousHealingRate: 88.5,
      },
    ],
    incidentBreakdown: {
      bySeverity: { CRITICAL: 937, HIGH: 1126, MEDIUM: 1419, LOW: 3783 },
      byType: {
        HTTP_5XX_SPIKE: 2800,
        OOM: 1750,
        DISK_FULL: 59,
      },
    },
  },
  actionAnalytics: {
    summary: {
      totalActions: 3597,
      succeededActions: 2336,
      failedActions: 66,
      cancelledActions: 1195,
      successRate: 64.9,
      autoActionsTotal: 2545,
      autoSucceeded: 2063,
      manualActionsTotal: 1052,
      manualSucceeded: 273,
      avgExecutionSeconds: 0.83,
      medianExecutionSeconds: 0.2,
      verifiedCount: 2336,
      verifiedSuccessRate: 99.6,
      totalIncidents: 7265,
      incidentsWithAction: 3577,
    },
    trends: [
      {
        label: '10/11',
        total: 1797,
        succeeded: 1136,
        failed: 36,
        cancelled: 625,
        pending: 0,
        successRate: 63.2,
        autoCount: 1245,
        manualCount: 552,
        avgDurationSeconds: 0.85,
      },
    ],
    byActor: [
      {
        actorKey: 'SYSTEM:AI_MAPE_K',
        actorName: 'AI MAPE-K (Tự Động)',
        actorType: 'AI',
        executionMode: 'AUTO',
        total: 2529,
        succeeded: 2063,
        failed: 50,
        cancelled: 416,
        successRate: 81.6,
        avgDurationSeconds: 0.72,
      },
      {
        actorKey: 'HUMAN:u-sang',
        actorName: 'Phạm Thái Sang',
        actorType: 'HUMAN',
        executionMode: 'MIXED',
        total: 283,
        succeeded: 150,
        failed: 0,
        cancelled: 133,
        successRate: 53.0,
        avgDurationSeconds: 1.4,
      },
    ],
    errorActionMatrix: [
      {
        incidentType: 'HTTP_5XX_SPIKE',
        actionCode: 'SCALE_REPLICAS',
        actionName: 'Mở rộng Replicas',
        total: 1400,
        succeeded: 1050,
        failed: 32,
        cancelled: 318,
        pending: 0,
        successRate: 75.0,
      },
    ],
    failureReasons: [
      {
        status: 'FAILED',
        reasonCategory: 'Lỗi 404: Không tìm thấy Deployment / Tài nguyên K8s',
        sampleRawReason: 'Thực thi hành động trên K8s thất bại (404 Not Found)',
        count: 32,
        percentOfStatus: 48.5,
      },
    ],
  },
  actionRows: [
    {
      shortId: 'ACT-1111',
      createdAt: '2026-11-10T03:00:00.000Z',
      startedAt: '2026-11-10T03:00:02.000Z',
      targetName: 'ecommerce-store-app',
      incidentType: 'HTTP_5XX_SPIKE',
      severity: 'HIGH',
      incidentTitle: 'HTTP 502 spike trên ecommerce-store-app',
      actionCode: 'SCALE_REPLICAS',
      executionMode: 'AUTO',
      actorName: 'AI MAPE-K (Tự Động)',
      approverName: null,
      executionStatus: 'SUCCEEDED',
      durationSeconds: 1.0,
      verificationResult: true,
      reasonCategory: null,
      failureReason: null,
      resultSummary: 'Đã mở rộng ReplicaSet ecommerce-store-app thành công.',
    },
    {
      shortId: 'ACT-2222',
      createdAt: '2026-11-10T02:30:00.000Z',
      startedAt: '2026-11-10T02:30:05.000Z',
      targetName: 'selfheal-test-app',
      incidentType: 'OOM',
      severity: 'CRITICAL',
      incidentTitle: 'Pod tràn RAM trên selfheal-test-app',
      actionCode: 'RESTART_POD',
      executionMode: 'MANUAL',
      actorName: 'Phạm Thái Sang',
      approverName: 'Phạm Thái Sang',
      executionStatus: 'FAILED',
      durationSeconds: 1.0,
      verificationResult: false,
      reasonCategory: 'Lỗi 404: Không tìm thấy Deployment / Tài nguyên K8s',
      failureReason: '404 Not Found: Không tìm thấy Deployment',
    },
  ],
  services: [
    {
      name: 'ecommerce-store-app',
      tier: 'Tier 2',
      targetSla: '99.50%',
      actualUptime: '99.96%',
      mttrAvg: '0.82s',
      actionsTotal: 891,
      incidentsResolved: 619,
      actionsFailed: 12,
      actionsCancelled: 260,
      status: 'Đạt SLA',
    },
  ],
  meta: {
    orgName: 'SME Retail Enterprise',
    scopeLabel: 'Toàn doanh nghiệp',
    timeRangeLabel: '30 Ngày gần nhất',
    documentId: 'SLA-RPT-SME-TEST',
  },
};

describe('reportExcelExport', () => {
  it('throws when no chart or table card is selected', async () => {
    await expect(
      exportReportsToExcel({
        ...samplePayload,
        selectedSections: [],
        download: false,
      })
    ).rejects.toThrow(/chọn ít nhất một biểu đồ/i);
  });

  it('generates a valid multi-sheet .xlsx workbook strictly matching selected chart cards', async () => {
    const selected = ['kpi_summary', 'incident_type', 'actor_breakdown', 'action_history'];
    const result = await exportReportsToExcel({
      ...samplePayload,
      selectedSections: selected,
      includeChartImages: true,
      fileName: 'bao-cao-chon-loc',
      download: false,
    });

    expect(result.success).toBe(true);
    expect(result.fileName).toBe('bao-cao-chon-loc.xlsx');
    expect(result.sheetNames).toEqual([
      '1_TongQuan_KPI',
      '4_BieuDo_LoaiSuCo',
      '6_BieuDo_AI_Nguoi',
      '9_Bang_TruyVet_Action',
    ]);

    // Round-trip binary XLSX buffer to guarantee genuine Excel OpenXML format & cell data
    const buffer = await result.workbook.xlsx.writeBuffer();
    const parsedWb = new ExcelJS.Workbook();
    await parsedWb.xlsx.load(buffer);

    expect(parsedWb.worksheets.map((w) => w.name)).toEqual(result.sheetNames);

    const incSheet = parsedWb.getWorksheet('4_BieuDo_LoaiSuCo');
    const incValues = [];
    incSheet.eachRow((row) => incValues.push(row.values.join('|')));
    expect(incValues.some((line) => line.includes('DISK_FULL') && line.includes('59'))).toBe(true);

    const actorSheet = parsedWb.getWorksheet('6_BieuDo_AI_Nguoi');
    const actorValues = [];
    actorSheet.eachRow((row) => actorValues.push(row.values.join('|')));
    expect(actorValues.some((line) => line.includes('Phạm Thái Sang') && line.includes('283'))).toBe(true);

    const historySheet = parsedWb.getWorksheet('9_Bang_TruyVet_Action');
    const historyValues = [];
    historySheet.eachRow((row) => historyValues.push(row.values.join('|')));
    expect(historyValues.some((line) => line.includes('ACT-1111') && line.includes('SUCCEEDED'))).toBe(true);
    expect(
      historyValues.some(
        (line) => line.includes('ACT-2222') && line.includes('404 Not Found: Không tìm thấy Deployment')
      )
    ).toBe(true);
  });

  it('supports exporting all 10 selectable cards with valid <=31 char Excel sheet names', async () => {
    const allIds = REPORT_EXCEL_SECTIONS.map((s) => s.id);
    for (const sec of REPORT_EXCEL_SECTIONS) {
      expect(sec.sheetName.length).toBeLessThanOrEqual(31);
      expect(/[*?:\\/[\]]/.test(sec.sheetName)).toBe(false);
    }

    const result = await exportReportsToExcel({
      ...samplePayload,
      selectedSections: allIds,
      includeChartImages: false,
      fileName: 'full-10-sheets.xlsx',
      download: false,
    });

    expect(result.sheetNames).toHaveLength(10);
    expect(result.workbook.worksheets).toHaveLength(10);
  });
});
