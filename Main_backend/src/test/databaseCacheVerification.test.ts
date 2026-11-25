import { test, describe, after, mock } from 'node:test';
import assert from 'node:assert';
import { isDatabaseCacheWorkload } from '../utils/systemServiceFilter';
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

  after(() => {
    mock.restoreAll();
  });
});
