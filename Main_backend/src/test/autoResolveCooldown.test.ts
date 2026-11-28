import test, { describe, beforeEach, afterEach, after, mock } from 'node:test';
import assert from 'node:assert';
import { pool } from '../config/database';
import { closeRedis } from '../config/redis';
import { TelemetryPipelineService } from '../services/telemetryPipeline.service';
import { WorkloadModel } from '../models';
import { RecoveryVerificationService } from '../services/recoveryVerification.service';

const ORG_ID = '11111111-1111-4111-8111-111111111111';

const makeHealthy12 = () =>
  Array.from({ length: 12 }, (_, idx) => ({
    cpu: 4.5,
    ram: 31.1,
    disk: 2.0,
    request_rate: 0.4,
    latency: 8.5,
    http_5xx_rate: 0,
    pod_restart_count: 0,
    replica_count: 2,
    collected_at: new Date(Date.now() - (12 - idx) * 5000).toISOString(),
  }));

describe('TelemetryPipelineService.autoResolveIfRecovered failure-cooldown SQL guard', () => {
  beforeEach(() => {
    mock.method(WorkloadModel, 'resolveK8sTarget', async (svc: string) => ({
      targetName: svc,
      workloadId: null,
      namespace: 'test-lab',
      workloadType: 'Deployment',
    }));
    mock.method(RecoveryVerificationService, 'evaluateSequenceRecovery', () => ({
      healthy: true,
      violations: [],
      summary: {},
    }));
  });

  afterEach(() => {
    mock.restoreAll();
  });

  after(async () => {
    await closeRedis().catch(() => {});
  });

  test('scopes failed action/verification block to 15-minute cooldown instead of permanent lock under NO_ACTION Circuit Breaker', async () => {
    const executedSql: string[] = [];

    mock.method(pool, 'connect', async () => ({
      query: async (sql: string) => {
        if (typeof sql === 'string') executedSql.push(sql);
        return { rows: [], rowCount: 0 };
      },
      release: () => {},
    }));

    mock.method(pool, 'query', async (sql: string) => {
      if (typeof sql === 'string') executedSql.push(sql);
      if (sql.includes('UPDATE incidents i') && sql.includes("SET status = 'RESOLVED'")) {
        return {
          rows: [{ id: 'inc-stale-cb', title: 'UNKNOWN on ecommerce-store-app', target_name: 'ecommerce-store-app' }],
          rowCount: 1,
        } as any;
      }
      return { rows: [], rowCount: 0 } as any;
    });

    await TelemetryPipelineService.autoResolveIfRecovered(
      'ecommerce-store-app',
      '8ea9ecbf-c5c2-44b2-b149-0f496665c0b6',
      makeHealthy12(),
      ORG_ID
    );

    const resolveQuery = executedSql.find(
      (q) => q.includes('UPDATE incidents i') && q.includes("SET status = 'RESOLVED'")
    );
    assert.ok(resolveQuery, 'Expected UPDATE incidents SET status = RESOLVED query to execute');
    assert.match(
      resolveQuery!,
      /ha_fail\.execution_status = 'FAILED'[\s\S]*interval '15 minutes'/i,
      'FAILED execution_status guard must expire after 15-minute cooldown window'
    );
    assert.match(
      resolveQuery!,
      /rv_fail\.verification_result = false[\s\S]*interval '15 minutes'/i,
      'FAILED verification_result guard must keep recent ST-15 failures OPEN within 15-minute window'
    );
  });
});
