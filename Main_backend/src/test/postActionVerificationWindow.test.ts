import test, { describe, afterEach, after, mock } from 'node:test';
import assert from 'node:assert';
import { pool } from '../config/database';
import { closeRedis } from '../config/redis';
import { AiService } from '../services/ai.service';
import { TelemetryPipelineService } from '../services/telemetryPipeline.service';
import { RecoveryVerificationService, ITelemetrySample } from '../services/recoveryVerification.service';
import { HealingActionModel } from '../models/healingAction.model';
import {
  WorkloadModel,
  IncidentModel,
  RcaModel,
  RecommendationModel,
  EnvironmentModel,
  OrganizationModel,
} from '../models';

const ORG_ID = '11111111-1111-4111-8111-111111111111';
const ENV_ID = 'e0000000-0000-0000-0000-000000000001';
const CLUSTER_ID = '8ea9ecbf-c5c2-44b2-b149-0f496665c0b6';

function buildMixedBatch(actionCompletedAtMs: number, postCutoffStartIndex: number): ITelemetrySample[] {
  // Construct 12 points (5s intervals) where early points fall inside pre-action / rollout settling window
  // and later points fall strictly after actionCompletedAt + grace.
  const firstPostCutoffMs = actionCompletedAtMs + 25_000 + 5_000;
  return Array.from({ length: 12 }, (_, idx) => {
    const sampleMs = firstPostCutoffMs + (idx - postCutoffStartIndex) * 5_000;
    const isDegraded = idx < postCutoffStartIndex;
    return {
      cpu: isDegraded ? 68 : 12,
      ram: isDegraded ? 45 : 30,
      disk: 12,
      request_rate: isDegraded ? 15 : 2.5,
      latency: isDegraded ? 4100 : 40,
      http_5xx_rate: isDegraded ? 100 : 0,
      pod_restart_count: 0,
      replica_count: isDegraded ? 4 : 2,
      is_healthy: !isDegraded,
      http_health_check: !isDegraded,
      time_bucket: new Date(sampleMs).toISOString(),
    };
  });
}

describe('Post-action recovery verification window & pre-action sample filtering', () => {
  afterEach(() => {
    mock.restoreAll();
  });

  after(async () => {
    await closeRedis().catch(() => {});
  });

  test('filterPostActionSamples excludes pre-action / mid-rollout metrics and keeps settled tail', () => {
    assert.strictEqual(
      RecoveryVerificationService.getActionSettlingCooldownSeconds('ROLLBACK_DEPLOYMENT', {
        details: { rollout_settled: true },
      }),
      10
    );
    assert.strictEqual(
      RecoveryVerificationService.getActionSettlingCooldownSeconds('ROLLBACK_DEPLOYMENT', {}),
      25
    );
    assert.strictEqual(
      RecoveryVerificationService.getActionSettlingCooldownSeconds('TEMPORARY_IP_BLOCK', {}),
      15
    );

    const completedAtMs = Date.now() - 60_000;
    // Indices 0..4 (5 points) are <= completedAt + 25s with 100% 5xx; indices 5..11 (7 points) are healthy after settling
    const mixedBatch = buildMixedBatch(completedAtMs, 5);

    const postFilter = RecoveryVerificationService.filterPostActionSamples(
      mixedBatch,
      new Date(completedAtMs),
      25
    );
    assert.strictEqual(postFilter.hasTimestamps, true);
    assert.strictEqual(postFilter.excludedPreActionCount, 5);
    assert.strictEqual(postFilter.filtered.length, 7);

    const evalRes = RecoveryVerificationService.evaluateSequenceRecovery(postFilter.filtered);
    assert.strictEqual(evalRes.healthy, true);

    // Untimed batches (legacy synthetic tests) preserve full sequence without filtering
    const untimed = Array.from({ length: 12 }, () => ({
      cpu: 10,
      ram: 30,
      disk: 10,
      latency: 40,
      http_5xx_rate: 0,
      request_rate: 5,
      pod_restart_count: 0,
    }));
    const untimedFilter = RecoveryVerificationService.filterPostActionSamples(untimed, new Date(completedAtMs), 25);
    assert.strictEqual(untimedFilter.hasTimestamps, false);
    assert.strictEqual(untimedFilter.filtered.length, 12);
  });

  test('AiService.analyzeRootCause uses 65s wait window and defers or passes mixed ROLLBACK_DEPLOYMENT batches', async () => {
    const executedSql: string[] = [];
    const finalizedCalls: any[] = [];
    const actionCompletedAtMs = Date.now() - 70_000;

    mock.method(WorkloadModel, 'resolveK8sTarget', async () => ({
      workloadId: '46cc7435-0e81-41d5-866e-8d14b35581b5',
      targetName: 'ecommerce-store-app',
      namespace: 'test-lab',
      workloadType: 'Deployment',
    }));
    mock.method(EnvironmentModel, 'findByIdOrName', async () => ({
      id: ENV_ID,
      organization_id: ORG_ID,
    } as any));
    mock.method(OrganizationModel, 'findFirst', async () => ({ id: ORG_ID } as any));
    mock.method(IncidentModel, 'findOpenIncident', async () => null);
    mock.method(IncidentModel, 'create', async () => ({
      id: '22222222-2222-4222-8222-222222222222',
      created_at: new Date().toISOString(),
    } as any));
    mock.method(RcaModel, 'createAnalysis', async () => ({
      id: '33333333-3333-4333-8333-333333333333',
    } as any));
    mock.method(RcaModel, 'createEvidences', async () => []);
    mock.method(RecommendationModel, 'findActionTypeIdByName', async () => 'd0000000-0000-0000-0000-000000000003');
    mock.method(RecommendationModel, 'create', async () => ({
      id: '44444444-4444-4444-8444-844444444444',
    } as any));
    mock.method(pool, 'connect', async () => ({
      query: async (sql: string) => {
        if (typeof sql === 'string' && sql.includes('RETURNING')) {
          return { rows: [{ id: '11111111-1111-4111-8111-111111111111', created_at: new Date().toISOString() }], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      },
      release: () => {},
    }));
    mock.method(globalThis, 'fetch', async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        service_id: 'ecommerce-store-app',
        root_cause: { cause: 'High latency transient', confidence: 0.72, severity: 'MEDIUM' },
        evidence: ['Early batch spike'],
        recommendation: { action: 'NO_ACTION', reason: 'Settled cleanly', priority: 'LOW' },
        explanation: 'Recovered after rollback',
        historical_context_used: false,
        similar_incident_ids: [],
      }),
    } as any));
    mock.method(HealingActionModel, 'finalizeRecoveryVerificationOutcome', async (id: string, verification: any) => {
      finalizedCalls.push({ id, verification });
      return { id };
    });

    mock.method(pool, 'query', async (sql: string) => {
      if (typeof sql === 'string') {
        executedSql.push(sql);
        if (sql.includes('AS effective_completed_at')) {
          return {
            rows: [
              {
                id: 'act-rollback-1',
                execution_status: 'RUNNING',
                action_code: 'ROLLBACK_DEPLOYMENT',
                target_name: 'ecommerce-store-app',
                action_result: { agent_status: 'COMPLETED', details: { rollout_settled: false } },
                effective_completed_at: new Date(actionCompletedAtMs).toISOString(),
              },
            ],
            rowCount: 1,
          } as any;
        }
      }
      return { rows: [], rowCount: 0 } as any;
    });

    // Case A: Batch recovered on indices 9..11 (only 3 post-cutoff samples < 6) -> MUST DEFER, NOT FAIL!
    const tooEarlyBatch = buildMixedBatch(actionCompletedAtMs, 9);
    await AiService.analyzeRootCause({
      service_id: 'ecommerce-store-app',
      risk_type: 'HIGH_LATENCY',
      confidence: 0.85,
      metric_sequence: tooEarlyBatch,
      metrics: tooEarlyBatch[11] as any,
      environment_id: ENV_ID,
      cluster_id: CLUSTER_ID,
    } as any);

    const unvSql = executedSql.find((q) => q.includes('AS effective_completed_at'));
    assert.ok(unvSql, 'Expected unverified action SQL query');
    assert.match(unvSql!, /interval '65 seconds'/i);
    assert.doesNotMatch(unvSql!, /interval '35 seconds'/i);
    assert.strictEqual(
      finalizedCalls.length,
      0,
      'Must defer verification when fewer than 6 post-settling samples exist in the batch'
    );

    // Case B: Batch has 8 clean post-cutoff samples (indices 4..11 healthy) despite 4 pre-cutoff 5xx samples -> PASS!
    const settledBatch = buildMixedBatch(actionCompletedAtMs, 4);
    await AiService.analyzeRootCause({
      service_id: 'ecommerce-store-app',
      risk_type: 'HIGH_LATENCY',
      confidence: 0.85,
      metric_sequence: settledBatch,
      metrics: settledBatch[11] as any,
      environment_id: ENV_ID,
      cluster_id: CLUSTER_ID,
    } as any);

    assert.strictEqual(finalizedCalls.length, 1);
    assert.strictEqual(finalizedCalls[0].verification.verified, true);
    assert.strictEqual(finalizedCalls[0].verification.details.status, 'VERIFIED_HEALTHY');
    assert.strictEqual(finalizedCalls[0].verification.details.post_action_samples_evaluated, 8);
    assert.strictEqual(finalizedCalls[0].verification.details.excluded_pre_action_samples, 4);
  });

  test('TelemetryPipelineService.autoResolveIfRecovered avoids false failure during settling and passes on clean tail', async () => {
    const finalizedCalls: any[] = [];
    const actionCompletedAtMs = Date.now() - 45_000;

    mock.method(WorkloadModel, 'resolveK8sTarget', async (svc: string) => ({
      targetName: svc,
      workloadId: null,
      namespace: 'test-lab',
      workloadType: 'Deployment',
    }));
    mock.method(pool, 'connect', async () => ({
      query: async () => ({ rows: [], rowCount: 0 }),
      release: () => {},
    }));
    mock.method(HealingActionModel, 'finalizeRecoveryVerificationOutcome', async (id: string, verification: any) => {
      finalizedCalls.push({ id, verification });
      return { id };
    });
    mock.method(pool, 'query', async (sql: string) => {
      if (typeof sql === 'string' && sql.includes('FROM healing_actions h') && sql.includes('AS effective_completed_at')) {
        return {
          rows: [
            {
              id: 'act-rollback-auto-1',
              incident_id: 'inc-rollback-1',
              action_code: 'ROLLBACK_DEPLOYMENT',
              action_result: { details: { rollout_settled: true } },
              effective_completed_at: new Date(actionCompletedAtMs).toISOString(),
            },
          ],
          rowCount: 1,
        } as any;
      }
      return { rows: [], rowCount: 0 } as any;
    });

    // Case A: Only 3 samples after completedAt + 10s grace -> defer instead of writing VERIFICATION_FAILED
    const firstPostMs = actionCompletedAtMs + 10_000 + 5_000;
    const partialBatch: ITelemetrySample[] = Array.from({ length: 12 }, (_, idx) => {
      const sampleMs = firstPostMs + (idx - 9) * 5_000;
      const isDegraded = idx < 9;
      return {
        cpu: 10,
        ram: 30,
        disk: 10,
        request_rate: 2,
        latency: isDegraded ? 3000 : 35,
        http_5xx_rate: isDegraded ? 100 : 0,
        pod_restart_count: 0,
        replica_count: 2,
        time_bucket: new Date(sampleMs).toISOString(),
      };
    });

    await TelemetryPipelineService.autoResolveIfRecovered('ecommerce-store-app', CLUSTER_ID, partialBatch, ORG_ID);
    assert.strictEqual(finalizedCalls.length, 0, 'Must defer instead of false-failing when < 6 post-action samples');

    // Case B: 7 clean samples after completedAt + 10s grace while first 5 points were pre-settling 5xx -> VERIFIED_HEALTHY
    const recoveredBatch: ITelemetrySample[] = Array.from({ length: 12 }, (_, idx) => {
      const sampleMs = firstPostMs + (idx - 5) * 5_000;
      const isDegraded = idx < 5;
      return {
        cpu: 10,
        ram: 30,
        disk: 10,
        request_rate: 2,
        latency: isDegraded ? 3000 : 35,
        http_5xx_rate: isDegraded ? 100 : 0,
        pod_restart_count: 0,
        replica_count: 2,
        time_bucket: new Date(sampleMs).toISOString(),
      };
    });

    await TelemetryPipelineService.autoResolveIfRecovered('ecommerce-store-app', CLUSTER_ID, recoveredBatch, ORG_ID);
    assert.strictEqual(finalizedCalls.length, 1);
    assert.strictEqual(finalizedCalls[0].verification.verified, true);
    assert.strictEqual(finalizedCalls[0].verification.details.status, 'VERIFIED_HEALTHY');
    assert.strictEqual(finalizedCalls[0].verification.details.excluded_pre_action_samples, 5);
  });
});
