import { test, describe, after, mock } from 'node:test';
import assert from 'node:assert';
import {
  isDatabaseCacheWorkload,
  isInfrastructureControlPlaneWorkload,
} from '../utils/systemServiceFilter';
import { RuleEngineService } from '../services/ruleEngine.service';
import { RecoveryVerificationService } from '../services/recoveryVerification.service';
import { AiPredictionModel } from '../models/aiPrediction.model';
import { pool } from '../config/database';

describe('Database Cache Workload Guards (Cách 1)', () => {
  test('isDatabaseCacheWorkload identifies databases while excluding init jobs and app services', () => {
    assert.strictEqual(isDatabaseCacheWorkload('mongodb'), true);
    assert.strictEqual(isDatabaseCacheWorkload('postgres'), true);
    assert.strictEqual(isDatabaseCacheWorkload('redis'), true);
    assert.strictEqual(isDatabaseCacheWorkload('mongodb-init'), false);
    assert.strictEqual(isDatabaseCacheWorkload('ecommerce-store-app'), false);
  });

  test('RuleEngineService treats high RAM on healthy database with zero restart_delta as benign cache', () => {
    const res = RuleEngineService.evaluate({
      service_id: 'mongodb',
      metrics: {
        cpu: 18.0,
        ram: 95.5,
        disk: 12.0,
        latency: 45.0,
        request_rate: 1.0,
        http_5xx_rate: 0.0,
        pod_restart_count: 2,
        replica_count: 2,
      },
      pod_status: 'Running',
      restart_delta: 0,
      active_pod_issue: false,
      k8s_events: [],
    });

    assert.ok(!res.anomalies.includes('MEMORY_PRESSURE'));
  });

  test('RecoveryVerificationService.evaluateSampleHealth exempts high DB cache RAM when healthy and restart=0', () => {
    const dbResHealthy = RecoveryVerificationService.evaluateSampleHealth(
      {
        cpu: 58.71,
        ram: 99.76,
        disk: 12.0,
        latency: 80.0,
        request_rate: 1.0,
        http_5xx_rate: 0.0,
        pod_restart_count: 0,
        is_healthy: true,
        http_health_check: true,
      },
      { isDatabaseWorkload: true }
    );
    assert.strictEqual(dbResHealthy.healthy, true);

    const dbResWithRestart = RecoveryVerificationService.evaluateSampleHealth(
      {
        cpu: 58.71,
        ram: 99.76,
        disk: 12.0,
        latency: 80.0,
        request_rate: 1.0,
        http_5xx_rate: 0.0,
        pod_restart_count: 1,
        is_healthy: true,
        http_health_check: true,
      },
      { isDatabaseWorkload: true }
    );
    assert.strictEqual(dbResWithRestart.healthy, false);

    const appResHighRam = RecoveryVerificationService.evaluateSampleHealth(
      {
        cpu: 58.71,
        ram: 99.76,
        disk: 12.0,
        latency: 80.0,
        request_rate: 1.0,
        http_5xx_rate: 0.0,
        pod_restart_count: 0,
      },
      { isDatabaseWorkload: false }
    );
    assert.strictEqual(appResHighRam.healthy, false);
  });

  test('AiPredictionModel.findById resolves organization_id so getPredictionInputs passes RBAC check', async (t) => {
    const executedSql: string[] = [];
    t.mock.method(pool, 'query', async (sql: string) => {
      executedSql.push(sql);
      return {
        rows: [
          {
            id: 'e1fa0e42-9ecf-4325-9a7b-166c8d28d503',
            environment_id: 'e0000000-0000-0000-0000-000000000001',
            organization_id: '00000000-0000-0000-0000-000000000001',
          },
        ],
      };
    });

    const pred = await AiPredictionModel.findById('e1fa0e42-9ecf-4325-9a7b-166c8d28d503');
    assert.strictEqual(pred?.organization_id, '00000000-0000-0000-0000-000000000001');
    assert.ok(executedSql[0].includes('AS organization_id'));
    assert.ok(executedSql[0].includes('e.organization_id'));
  });

  test('isInfrastructureControlPlaneWorkload isolates infra/monitoring/init-jobs from AI actions while keeping apps enabled', () => {
    assert.strictEqual(isInfrastructureControlPlaneWorkload('selfheal-agent'), true);
    assert.strictEqual(isInfrastructureControlPlaneWorkload('kube-apiserver-minikube'), true);
    assert.strictEqual(isInfrastructureControlPlaneWorkload('prometheus-node-exporter'), true);
    assert.strictEqual(isInfrastructureControlPlaneWorkload('mongodb-init'), true);
    assert.strictEqual(isInfrastructureControlPlaneWorkload('ecommerce-store-app', 'selfheal-system'), true);
    assert.strictEqual(isInfrastructureControlPlaneWorkload('ecommerce-store-app', 'test-lab'), false);
    assert.strictEqual(isInfrastructureControlPlaneWorkload('mongodb', 'test-lab'), false);
  });

  test('RecoveryVerificationService.evaluateSequenceRecovery tolerates single early latency blip, exempts DB cache, and fails tail/multi/5xx faults', () => {
    const mkPoint = (overrides: Record<string, any> = {}) => ({
      cpu: 18,
      ram: 42,
      disk: 15,
      latency: 45,
      request_rate: 12,
      http_5xx_rate: 0,
      pod_restart_count: 0,
      is_healthy: true,
      http_health_check: true,
      ...overrides,
    });

    // 1. Single early latency blip during scale-down settling (Sample 1 = 998ms, Samples 2..12 clean) -> PASS
    const singleEarlyBlip = Array.from({ length: 12 }, (_, idx) =>
      mkPoint(idx === 0 ? { latency: 998 } : {})
    );
    const earlyRes = RecoveryVerificationService.evaluateSequenceRecovery(singleEarlyBlip);
    assert.strictEqual(earlyRes.healthy, true);

    // 2. DB cache RAM 95% with zero restart delta -> PASS
    const dbSeq = Array.from({ length: 12 }, () => mkPoint({ ram: 95.4, pod_restart_count: 2 }));
    const dbRes = RecoveryVerificationService.evaluateSequenceRecovery(dbSeq, {
      isDatabaseWorkload: true,
      baselineRestartCount: 2,
    });
    assert.strictEqual(dbRes.healthy, true);

    // 3. Violation in last 3 stabilization tail samples -> FAIL
    const tailBlip = Array.from({ length: 12 }, (_, idx) =>
      mkPoint(idx === 11 ? { latency: 998 } : {})
    );
    assert.strictEqual(RecoveryVerificationService.evaluateSequenceRecovery(tailBlip).healthy, false);

    // 4. Two unhealthy samples -> FAIL
    const twoBlips = Array.from({ length: 12 }, (_, idx) =>
      mkPoint(idx === 0 || idx === 4 ? { latency: 998 } : {})
    );
    assert.strictEqual(RecoveryVerificationService.evaluateSequenceRecovery(twoBlips).healthy, false);
  });

  after(() => {
    mock.restoreAll();
  });
});
