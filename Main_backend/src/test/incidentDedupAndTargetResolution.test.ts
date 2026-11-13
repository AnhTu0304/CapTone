import { test, describe, after, mock } from 'node:test';
import assert from 'node:assert';
import { RuleEngineService } from '../services/ruleEngine.service';
import { IncidentModel } from '../models/incident.model';
import { WorkloadModel } from '../models/workload.model';
import { pool } from '../config/database';

const baseMetrics = {
  cpu: 15,
  ram: 35,
  disk: 20,
  latency: 18,
  request_rate: 12,
  http_5xx_rate: 0,
  pod_restart_count: 269,
  replica_count: 1,
};

describe('Incident Deduplication, Rule 5 Delta Restarts & K8s Target Resolution', () => {
  after(() => {
    mock.restoreAll();
  });

  test('Rule 5 ignores historical cumulative restarts when restart_delta is 0 and pod is healthy', () => {
    const res = RuleEngineService.evaluate({
      service_id: 'storage-provisioner',
      metrics: baseMetrics,
      pod_status: 'Running',
      restart_delta: 0,
      active_pod_issue: false,
      k8s_events: [],
    });

    assert.strictEqual(res.is_anomalous, false);
    assert.strictEqual(res.requires_rca, false);
    assert.ok(!res.anomalies.includes('POD_INSTABILITY'));
  });

  test('Rule 5 triggers POD_INSTABILITY when restart_delta >= 1 even if cumulative restarts existed previously', () => {
    const res = RuleEngineService.evaluate({
      service_id: 'selfheal-test-app',
      metrics: baseMetrics,
      pod_status: 'Running',
      restart_delta: 2,
      active_pod_issue: false,
      k8s_events: [],
    });

    assert.strictEqual(res.is_anomalous, true);
    assert.strictEqual(res.requires_rca, true);
    assert.ok(res.anomalies.includes('POD_INSTABILITY'));
    assert.ok(res.triggered_rules.some((r) => r.includes('restart_delta (2 >= 1)')));
  });

  test('Rule 5 triggers POD_INSTABILITY when active_pod_issue is true (unready/backoff live container)', () => {
    const res = RuleEngineService.evaluate({
      service_id: 'ecommerce-store-app',
      metrics: { ...baseMetrics, pod_restart_count: 0 },
      pod_status: 'Running',
      restart_delta: 0,
      active_pod_issue: true,
      k8s_events: [],
    });

    assert.strictEqual(res.is_anomalous, true);
    assert.strictEqual(res.requires_rca, true);
    assert.ok(res.anomalies.includes('POD_INSTABILITY'));
  });

  test('IncidentModel.findOpenIncident isolates by strict target_name when provided and preserves 5-arg legacy SQL', async () => {
    const calls: Array<{ sql: string; params: any[] }> = [];
    const mockClient: any = {
      query: async (sql: string, params: any[]) => {
        calls.push({ sql, params });
        return { rows: [{ id: 'inc-dedup-1', occurrence_count: 3, target_name: 'kube-state-metrics' }] };
      },
    };

    const strictMatch = await IncidentModel.findOpenIncident(
      mockClient,
      'env-1',
      'kube-state-metrics',
      'UNSTABLE_POD',
      1440,
      'kube-state-metrics'
    );
    assert.strictEqual(strictMatch.id, 'inc-dedup-1');
    assert.strictEqual(strictMatch.occurrence_count, 3);
    assert.ok(calls[0].sql.includes("LOWER(COALESCE(target_name, '')) = LOWER($5::text)"));
    assert.ok(!calls[0].sql.includes('OR target_id IS NULL'));
    assert.strictEqual(calls[0].params[3], 1440);
    assert.strictEqual(calls[0].params[4], 'kube-state-metrics');

    const legacyMatch = await IncidentModel.findOpenIncident(
      mockClient,
      'env-1',
      null,
      'UNSTABLE_POD',
      15
    );
    assert.strictEqual(legacyMatch.id, 'inc-dedup-1');
    assert.ok(calls[1].sql.includes('OR target_id IS NULL'));
  });

  test('WorkloadModel.resolveK8sTarget resolves Helm release workload & non-default namespace from pod labels', async (t) => {
    t.mock.method(pool, 'query', async () => ({
      rows: [
        {
          workload_id: '11111111-1111-4111-8111-111111111111',
          workload_name: 'prometheus-kube-state-metrics',
          workload_type: 'Deployment',
          namespace_name: 'monitoring',
          pod_name: 'prometheus-kube-state-metrics-cb5d78584-qks4x',
        },
      ],
    }));

    const resolved = await WorkloadModel.resolveK8sTarget('kube-state-metrics', 'cluster-1');
    assert.strictEqual(resolved.workloadId, '11111111-1111-4111-8111-111111111111');
    assert.strictEqual(resolved.targetName, 'prometheus-kube-state-metrics');
    assert.strictEqual(resolved.namespace, 'monitoring');
    assert.strictEqual(resolved.workloadType, 'Deployment');
  });

  test('WorkloadModel.resolveK8sTarget infers StatefulSet from ordinal pod name when workload row is null', async (t) => {
    t.mock.method(pool, 'query', async () => ({
      rows: [
        {
          workload_id: null,
          workload_name: null,
          workload_type: null,
          namespace_name: 'test-lab',
          pod_name: 'mongodb-0',
        },
      ],
    }));

    const resolved = await WorkloadModel.resolveK8sTarget('mongodb-0', 'cluster-1');
    assert.strictEqual(resolved.workloadId, null);
    assert.strictEqual(resolved.targetName, 'mongodb');
    assert.strictEqual(resolved.namespace, 'test-lab');
    assert.strictEqual(resolved.workloadType, 'StatefulSet');
  });
});
