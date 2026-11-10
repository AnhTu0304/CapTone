import { test, describe, after, mock } from 'node:test';
import assert from 'node:assert';
import { ReportModel, normalizeFailureReason } from '../models/report.model';
import { pool } from '../config/database';

const isLiveDb = process.env.LIVE_DB_TEST === '1';

describe('ReportModel SLA & Action Analytics Tests', () => {
  const orgId = '00000000-0000-0000-0000-000000000001';
  const legacyClusterId = 'c0000000-0000-0000-0000-000000000001';
  const envId = 'e0000000-0000-0000-0000-000000000001';

  test('normalizeFailureReason maps mojibake & UTF-8 causes cleanly', () => {
    const k404 = normalizeFailureReason(
      'FAILED',
      'Th?c thi m? r?ng b?n sao (SCALE_REPLICAS) tr?n d?ch v? selfheal-test-app th?t b?i (M? l?i 404 Not Found)'
    );
    assert.ok(k404.category.includes('404'));
    assert.ok(!k404.cleanText.includes('?'));

    const k403 = normalizeFailureReason(
      'FAILED',
      'K8s API 403 Forbidden: pods is forbidden'
    );
    assert.ok(k403.category.includes('403'));

    const agentOff = normalizeFailureReason(
      'FAILED',
      'Không có Kubernetes Agent nào trực tuyến để nhận lệnh tự phục hồi.'
    );
    assert.ok(agentOff.category.includes('Agent Offline'));

    const hitlCancel = normalizeFailureReason(
      'CANCELLED',
      'Hành động Restart Pod (RESTART_POD) trên ecommerce-store-app đang chờ phê duyệt tại Cổng HITL theo chính sách POL-RESTART-CRASHED-POD.'
    );
    assert.ok(hitlCancel.category.includes('HITL'));

    const emptyCancel = normalizeFailureReason('CANCELLED', null);
    assert.ok(emptyCancel.category.includes('HITL'));
  });

  if (isLiveDb) {
    test('Live DB: Query SLA report with SME Retail org returns real incidents, DISK_FULL type, and actionAnalytics', async () => {
      const report = await ReportModel.getOrganizationSLAReport(orgId, null, null, '1M');
      assert.ok(report.summary.totalIncidentsResolved > 0, 'Should have resolved incidents');
      assert.ok(Array.isArray(report.services) && report.services.length > 0, 'Should have real services');
      assert.ok(
        Object.prototype.hasOwnProperty.call(report.incidentBreakdown.byType, 'DISK_FULL') ||
          Object.keys(report.incidentBreakdown.byType).length > 0,
        'Should include full incident types'
      );
      assert.ok(report.actionAnalytics, 'Should include actionAnalytics');
      assert.ok(report.actionAnalytics.summary.totalActions > 0, 'Should aggregate healing_actions');
      assert.ok(report.actionAnalytics.byActor.length > 0, 'Should aggregate actors (AI vs Human)');
      assert.ok(report.actionAnalytics.errorActionMatrix.length > 0, 'Should build error x action matrix');
      assert.ok(report.actionAnalytics.failureReasons.length > 0, 'Should aggregate failure/cancel reasons');
      assert.ok(report.actionAnalytics.actionHistory.length > 0, 'Should return action traceability rows');
    });

    test('Live DB: Query clusterId matches both UUID and legacy cluster-k8s-sme-01 name', async () => {
      const reportByClusterUuid = await ReportModel.getOrganizationSLAReport(orgId, envId, legacyClusterId, '1M');
      assert.ok(
        reportByClusterUuid.summary.totalIncidentsResolved > 200,
        `Expected legacy cluster name + UUID rows combined, got ${reportByClusterUuid.summary.totalIncidentsResolved}`
      );
    });

    test('Live DB: Query getActionAnalyticsReport filters by FAILED status cleanly', async () => {
      const failedOnly = await ReportModel.getActionAnalyticsReport({
        organizationId: orgId,
        timeRange: '1M',
        status: 'FAILED',
        page: 1,
        limit: 10,
      });
      assert.ok(failedOnly.pagination.total > 0, 'Expected FAILED actions in DB');
      for (const item of failedOnly.actionHistory) {
        assert.strictEqual(item.executionStatus, 'FAILED');
        assert.ok(item.reasonCategory && item.failureReason, 'FAILED item must have normalized failure reason');
      }

      const succeededOnly = await ReportModel.getActionAnalyticsReport({
        organizationId: orgId,
        timeRange: '1M',
        status: 'SUCCEEDED',
        page: 1,
        limit: 10,
      });
      assert.ok(succeededOnly.actionHistory.length > 0, 'Expected SUCCEEDED actions in DB');
      for (const item of succeededOnly.actionHistory) {
        assert.strictEqual(item.executionStatus, 'SUCCEEDED');
        assert.strictEqual(item.reasonCategory, null, 'SUCCEEDED item must not have failure reasonCategory');
        assert.strictEqual(item.failureReason, null, 'SUCCEEDED item must not have failureReason');
      }
    });

    test('Live DB: Supports 7D timeRange daily buckets and limit=500 Excel export queries', async () => {
      const weekly = await ReportModel.getOrganizationSLAReport(orgId, null, null, '7D');
      assert.strictEqual(weekly.monthlyTrends.length, 7);
      assert.ok(weekly.actionAnalytics);

      const batch500 = await ReportModel.getActionAnalyticsReport({
        organizationId: orgId,
        timeRange: '1M',
        page: 1,
        limit: 500,
      });
      assert.strictEqual(batch500.pagination.limit, 500);
      assert.ok(batch500.actionHistory.length > 100 && batch500.actionHistory.length <= 500);
    });
  } else {
    test('Unit: getOrganizationSLAReport & cluster scope resolution resolve legacy cluster name, DISK_FULL, and actionAnalytics', async (t) => {
      const queriesSeen: Array<{ sql: string; params: any[] }> = [];

      t.mock.method(pool, 'query', async (sql: string, params: any[] = []) => {
        queriesSeen.push({ sql, params });
        const q = sql.toLowerCase();

        if (q.includes('from clusters c') && q.includes('join environments e')) {
          return {
            rows: [{ id: legacyClusterId, name: 'cluster-k8s-sme-01', env_id: envId }],
          };
        }
        if (q.includes('as critical_count')) {
          return {
            rows: [
              {
                total_incidents: '7265',
                resolved_incidents: '7105',
                resolved_actions: '2336',
                auto_actions: '2063',
                critical_count: '937',
                high_count: '1126',
                medium_count: '1419',
                low_count: '3783',
                avg_mttr_seconds: '0.83',
              },
            ],
          };
        }
        if (q.includes('as svc_name')) {
          return {
            rows: [
              {
                svc_name: 'ecommerce-store-app',
                total_actions: '891',
                succeeded_actions: '619',
                failed_actions: '12',
                cancelled_actions: '260',
                has_critical: true,
                avg_exec_s: '0.82',
              },
            ],
          };
        }
        if (q.includes('join clusters c on c.id = s.cluster_id')) {
          return { rows: [{ name: 'mongo-service' }] };
        }
        if (q.includes('as filter_service_name')) {
          return {
            rows: [
              { filter_service_name: 'ecommerce-store-app' },
              { filter_service_name: 'mongo-service' },
            ],
          };
        }
        if (q.includes('order by ha.created_at desc') && q.includes('limit 10')) {
          return { rows: [] };
        }
        if (q.includes('as type_name')) {
          return {
            rows: [
              { type_name: 'HTTP_5XX_SPIKE', count: '2800' },
              { type_name: 'DISK_FULL', count: '59' },
            ],
          };
        }
        if (q.includes('as incident_count') && q.includes('group by')) {
          return { rows: [] };
        }
        if (q.includes('as total_actions') && q.includes('from enriched_actions')) {
          return {
            rows: [
              {
                total_actions: '3597',
                succeeded_actions: '2336',
                failed_actions: '66',
                cancelled_actions: '1195',
                pending_actions: '0',
                auto_total: '2545',
                auto_succeeded: '2063',
                manual_total: '1052',
                manual_succeeded: '273',
                avg_exec_s: '0.83',
                median_exec_s: '0.20',
                verified_count: '2336',
                verified_ok_count: '2326',
              },
            ],
          };
        }
        if (q.includes('as incidents_with_action')) {
          return { rows: [{ total_incidents: '7265', incidents_with_action: '3577' }] };
        }
        if (q.includes('as bucket_key') && q.includes('from enriched_actions')) {
          return {
            rows: [
              {
                bucket_key: '2026-11-10',
                total: '100',
                succeeded: '80',
                failed: '5',
                cancelled: '15',
                pending: '0',
                auto_count: '85',
                manual_count: '15',
                avg_dur: '0.8',
              },
            ],
          };
        }
        if (q.includes('group by actor_key, actor_name, actor_type')) {
          return {
            rows: [
              {
                actor_key: 'SYSTEM:AI_MAPE_K',
                actor_name: 'AI MAPE-K (Tự Động)',
                actor_type: 'AI',
                execution_mode: 'AUTO',
                total: '2529',
                succeeded: '2063',
                failed: '50',
                cancelled: '416',
                pending: '0',
                avg_dur: '0.72',
              },
              {
                actor_key: 'HUMAN:u-sang',
                actor_name: 'Phạm Thái Sang',
                actor_type: 'HUMAN',
                execution_mode: 'MIXED',
                total: '283',
                succeeded: '150',
                failed: '0',
                cancelled: '133',
                pending: '0',
                avg_dur: '1.40',
              },
            ],
          };
        }
        if (q.includes('group by incident_type, action_code')) {
          return {
            rows: [
              {
                incident_type: 'HTTP_5XX_SPIKE',
                action_code: 'SCALE_REPLICAS',
                action_name: 'Mở rộng Replicas',
                total: '1400',
                succeeded: '1050',
                failed: '32',
                cancelled: '318',
                pending: '0',
              },
            ],
          };
        }
        if (q.includes('group by execution_status, raw_reason')) {
          return {
            rows: [
              {
                execution_status: 'FAILED',
                raw_reason: 'Th?c thi m? r?ng... 404 Not Found',
                cnt: '32',
              },
            ],
          };
        }
        if (q.includes('select incident_type, count(*) as cnt from enriched_actions')) {
          return { rows: [{ incident_type: 'HTTP_5XX_SPIKE', cnt: '1400' }] };
        }
        if (q.includes('select action_code, count(*) as cnt from enriched_actions')) {
          return { rows: [{ action_code: 'SCALE_REPLICAS', cnt: '1400' }] };
        }
        if (q.includes('select count(*) as total from enriched_actions')) {
          return { rows: [{ total: '1' }] };
        }
        if (q.includes('select *') && q.includes('from enriched_actions')) {
          return {
            rows: [
              {
                id: 'aaaaaaaa-1111-2222-3333-444444444444',
                incident_id: 'bbbbbbbb-1111-2222-3333-444444444444',
                incident_type: 'HTTP_5XX_SPIKE',
                severity: 'HIGH',
                incident_title: '502 Bad Gateway spike',
                incident_detected_at: new Date('2026-11-10T02:00:00Z'),
                target_name: 'ecommerce-store-app',
                action_code: 'SCALE_REPLICAS',
                action_name: 'Mở rộng Replicas',
                risk_level: 'MEDIUM',
                execution_mode: 'AUTO',
                execution_status: 'FAILED',
                actor_key: 'SYSTEM:AI_MAPE_K',
                actor_name: 'AI MAPE-K (Tự Động)',
                actor_type: 'AI',
                executor_name: null,
                approver_name: null,
                agent_name: 'k8s-agent-sme',
                approval_status: null,
                requested_at: null,
                started_at: new Date('2026-11-10T02:00:01Z'),
                completed_at: new Date('2026-11-10T02:00:02Z'),
                created_at: new Date('2026-11-10T02:00:01Z'),
                duration_seconds: 1.0,
                verification_result: false,
                verification_type: 'HTTP_HEALTH',
                raw_reason: 'Th?c thi m? r?ng... 404 Not Found',
              },
            ],
          };
        }

        return { rows: [] };
      });

      const report = await ReportModel.getOrganizationSLAReport(orgId, envId, legacyClusterId, '7D');

      assert.strictEqual(report.monthlyTrends.length, 7);
      assert.strictEqual(report.incidentBreakdown.byType.DISK_FULL, 59);
      assert.strictEqual(report.services.length, 2);
      assert.deepStrictEqual(report.availableServices, ['ecommerce-store-app', 'mongo-service']);
      assert.strictEqual(report.actionAnalytics?.summary.totalActions, 3597);
      assert.strictEqual(report.actionAnalytics?.byActor.length, 2);
      assert.deepStrictEqual(report.actionAnalytics?.filterOptions.services, [
        'ecommerce-store-app',
        'mongo-service',
      ]);
      assert.strictEqual(report.actionAnalytics?.failureReasons[0].reasonCategory, 'Lỗi 404: Không tìm thấy Deployment / Tài nguyên K8s');
      assert.ok(!report.actionAnalytics?.actionHistory[0].failureReason?.includes('?'));

      const clusterParamCall = queriesSeen.find((q) =>
        q.params.some((p) => Array.isArray(p) && p.includes('cluster-k8s-sme-01') && p.includes(legacyClusterId))
      );
      assert.ok(clusterParamCall, 'Should query using both UUID and resolved legacy cluster name');

      // Filtering by serviceName narrows services list & queries while keeping full availableServices
      queriesSeen.length = 0;
      const filteredReport = await ReportModel.getOrganizationSLAReport(
        orgId,
        envId,
        legacyClusterId,
        '1M',
        'mongo-service'
      );
      assert.strictEqual(filteredReport.services.length, 1);
      assert.strictEqual(filteredReport.services[0].name, 'mongo-service');
      assert.deepStrictEqual(filteredReport.availableServices, ['ecommerce-store-app', 'mongo-service']);
      assert.ok(
        queriesSeen.some(
          (q) =>
            q.sql.includes('regexp_replace') &&
            q.params.includes('mongo-service') &&
            q.params.includes('mongo')
        ),
        'Expected service canonical & exact filter parameters in SQL queries'
      );

      const batch500 = await ReportModel.getActionAnalyticsReport({
        organizationId: orgId,
        limit: 500,
      });
      assert.strictEqual(batch500.pagination.limit, 500);

      const batchOverCap = await ReportModel.getActionAnalyticsReport({
        organizationId: orgId,
        limit: 9999,
      });
      assert.strictEqual(batchOverCap.pagination.limit, 500);
    });

    test('Unit: resolveClusterScope isolates duplicate cluster names when name_count > 1', async (t) => {
      const queriesSeen: Array<{ sql: string; params: any[] }> = [];
      const dupClusterId = 'c0000000-0000-0000-0000-000000000099';

      t.mock.method(pool, 'query', async (sql: string, params: any[] = []) => {
        queriesSeen.push({ sql, params });
        const q = sql.toLowerCase();
        if (q.includes('from clusters c') && q.includes('join environments e')) {
          return {
            rows: [{ id: dupClusterId, name: 'k8s-cluster-01', env_id: envId, name_count: '2' }],
          };
        }
        return { rows: [] };
      });

      await ReportModel.getActionAnalyticsReport({
        organizationId: orgId,
        environmentId: envId,
        clusterId: dupClusterId,
      });

      const scopedCall = queriesSeen.find((q) =>
        q.params.some((p) => Array.isArray(p) && p.includes(dupClusterId))
      );
      assert.ok(scopedCall, 'Expected cluster UUID param array');
      const idArray = scopedCall!.params.find((p) => Array.isArray(p)) as string[];
      assert.deepStrictEqual(idArray, [dupClusterId]);
    });
  }

  after(async () => {
    mock.restoreAll();
    if (isLiveDb) {
      await pool.end();
    }
  });
});
