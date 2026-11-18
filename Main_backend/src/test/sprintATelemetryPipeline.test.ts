import test, { describe, beforeEach, afterEach, after, mock } from 'node:test';
import assert from 'node:assert';
import { pool } from '../config/database';
import { closeRedis } from '../config/redis';
import { TelemetryBufferService } from '../services/telemetryBuffer.service';
import { TelemetryPipelineService } from '../services/telemetryPipeline.service';
import { TelemetryAggregatorService } from '../services/telemetryAggregator.service';
import { MetricModel } from '../models/metric.model';
import { WorkloadModel } from '../models/workload.model';

const ORG_A = '11111111-1111-4111-8111-111111111111';
const ORG_B = '22222222-2222-4222-8222-222222222222';
const CLUSTER_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const CLUSTER_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

function pushBuckets(
  orgId: string | null | undefined,
  clusterId: string | null | undefined,
  serviceId: string,
  count: number,
  baseCpu: number,
  startSec = Math.floor(Date.now() / 1000) - 120
) {
  for (let i = 0; i < count; i++) {
    TelemetryBufferService.pushMetric({
      organization_id: orgId as any,
      cluster_id: clusterId as any,
      agent_id: `agent-${orgId || 'none'}`,
      service_id: serviceId,
      pod_id: `pod-${i}`,
      cpu: baseCpu + i * 0.1,
      ram: 45,
      disk: 20,
      request_rate: 100,
      latency: 25,
      http_5xx_rate: 0,
      pod_restart_count: 0,
      replica_count: 1,
      collected_at: new Date((startSec + i * 5) * 1000),
    } as any);
  }
}

describe('Sprint A Task B: Tenant-Aware Background Telemetry Pipeline (PIPE-01..PIPE-08)', () => {
  beforeEach(() => {
    TelemetryPipelineService.stopPipeline();
    if (typeof (TelemetryPipelineService as any).resetState === 'function') {
      (TelemetryPipelineService as any).resetState();
    } else {
      (TelemetryPipelineService as any).lastEvaluatedBucketTimestamp = {};
      (TelemetryPipelineService as any).urgentReasonByService = {};
      (TelemetryPipelineService as any).isProcessingService = {};
    }
    TelemetryBufferService.clearBuffer();

    // Prevent touching real PostgreSQL in isolated unit tests
    mock.method(pool, 'query', async () => ({ rows: [], rowCount: 0 } as any));
    mock.method(WorkloadModel, 'resolveK8sTarget', async (svc: string) => ({
      targetName: svc,
      workloadId: null,
      namespace: 'default',
      workloadType: 'Deployment',
    }));
  });

  afterEach(() => {
    TelemetryPipelineService.stopPipeline();
    mock.restoreAll();
    TelemetryBufferService.clearBuffer();
  });

  after(async () => {
    await closeRedis().catch(() => {});
  });

  test('PIPE-01: One organization, one service, normal batch processing via background pipeline', async () => {
    const evalCalls: Array<{ serviceId: string; options: any }> = [];
    mock.method(TelemetryAggregatorService, 'evaluateAndDiagnoseService', async (serviceId: string, options: any) => {
      evalCalls.push({ serviceId, options });
      return { rca_triggered: false, rule_evaluation: { anomalies: [] } } as any;
    });

    pushBuckets(ORG_A, CLUSTER_A, 'order-svc', 12, 30);

    const rawBuffers: Map<string, any[]> = (TelemetryBufferService as any).rawBuffers;
    assert.ok(
      rawBuffers.has(`${ORG_A}::${CLUSTER_A}::order-svc`),
      'Buffer key must partition by organizationId::clusterId::serviceId'
    );

    await TelemetryPipelineService.runPipelineCycle();
    await new Promise((r) => setTimeout(r, 40));

    assert.strictEqual(evalCalls.length, 1);
    assert.strictEqual(evalCalls[0].serviceId, 'order-svc');
    assert.strictEqual(evalCalls[0].options.organizationId, ORG_A);
    assert.strictEqual(evalCalls[0].options.clusterId, CLUSTER_A);
    assert.strictEqual(evalCalls[0].options.providedSequence.length, 12);
    assert.ok(evalCalls[0].options.providedSequence.every((p: any) => p.cpu >= 30 && p.cpu < 32));
  });

  test('PIPE-02: Two organizations using the same serviceId are both discovered and processed cleanly', async () => {
    const evalCalls: Array<{ serviceId: string; options: any }> = [];
    mock.method(TelemetryAggregatorService, 'evaluateAndDiagnoseService', async (serviceId: string, options: any) => {
      evalCalls.push({ serviceId, options });
      return { rca_triggered: false, rule_evaluation: { anomalies: [] } } as any;
    });

    pushBuckets(ORG_A, CLUSTER_A, 'shared-payment-svc', 12, 15);
    pushBuckets(ORG_B, CLUSTER_B, 'shared-payment-svc', 12, 75);

    const rawBuffers: Map<string, any[]> = (TelemetryBufferService as any).rawBuffers;
    assert.ok(rawBuffers.has(`${ORG_A}::${CLUSTER_A}::shared-payment-svc`));
    assert.ok(rawBuffers.has(`${ORG_B}::${CLUSTER_B}::shared-payment-svc`));

    await TelemetryPipelineService.runPipelineCycle();
    await new Promise((r) => setTimeout(r, 40));

    assert.strictEqual(evalCalls.length, 2, 'Both organizations with same serviceId must be processed');
    const callA = evalCalls.find((c) => c.options.organizationId === ORG_A);
    const callB = evalCalls.find((c) => c.options.organizationId === ORG_B);
    assert.ok(callA, 'Org A batch must be evaluated');
    assert.ok(callB, 'Org B batch must be evaluated');
    assert.strictEqual(callA.options.clusterId, CLUSTER_A);
    assert.strictEqual(callB.options.clusterId, CLUSTER_B);
    assert.ok(callA.options.providedSequence.every((p: any) => p.cpu >= 15 && p.cpu < 20));
    assert.ok(callB.options.providedSequence.every((p: any) => p.cpu >= 75 && p.cpu < 80));
  });

  test('PIPE-03: Two clusters in one organization using the same serviceId are isolated and both processed', async () => {
    const evalCalls: Array<{ serviceId: string; options: any }> = [];
    mock.method(TelemetryAggregatorService, 'evaluateAndDiagnoseService', async (serviceId: string, options: any) => {
      evalCalls.push({ serviceId, options });
      return { rca_triggered: false, rule_evaluation: { anomalies: [] } } as any;
    });

    pushBuckets(ORG_A, CLUSTER_A, 'api-gateway', 12, 20);
    pushBuckets(ORG_A, CLUSTER_B, 'api-gateway', 12, 60);

    const rawBuffers: Map<string, any[]> = (TelemetryBufferService as any).rawBuffers;
    assert.ok(rawBuffers.has(`${ORG_A}::${CLUSTER_A}::api-gateway`));
    assert.ok(rawBuffers.has(`${ORG_A}::${CLUSTER_B}::api-gateway`));

    await TelemetryPipelineService.runPipelineCycle();
    await new Promise((r) => setTimeout(r, 40));

    assert.strictEqual(evalCalls.length, 2);
    const callClusterA = evalCalls.find((c) => c.options.clusterId === CLUSTER_A);
    const callClusterB = evalCalls.find((c) => c.options.clusterId === CLUSTER_B);
    assert.ok(callClusterA && callClusterA.options.organizationId === ORG_A);
    assert.ok(callClusterB && callClusterB.options.organizationId === ORG_A);
    assert.ok(callClusterA.options.providedSequence.every((p: any) => p.cpu >= 20 && p.cpu < 25));
    assert.ok(callClusterB.options.providedSequence.every((p: any) => p.cpu >= 60 && p.cpu < 65));
  });

  test('PIPE-04: Batch strictly contains only one organization and rejects corrupted mixed-tenant buffers', async () => {
    pushBuckets(ORG_A, CLUSTER_A, 'billing-svc', 12, 12);
    pushBuckets(ORG_B, CLUSTER_B, 'billing-svc', 12, 88);

    const batchA = await TelemetryBufferService.getFreshBatch('billing-svc', 5, null, 12, ORG_A, CLUSTER_A);
    const batchB = await TelemetryBufferService.getFreshBatch('billing-svc', 5, null, 12, ORG_B, CLUSTER_B);

    assert.strictEqual(batchA.organizationId, ORG_A);
    assert.strictEqual(batchA.clusterId, CLUSTER_A);
    assert.ok(batchA.points.every((p) => p.cpu < 20));

    assert.strictEqual(batchB.organizationId, ORG_B);
    assert.strictEqual(batchB.clusterId, CLUSTER_B);
    assert.ok(batchB.points.every((p) => p.cpu > 80));

    // Inject mixed-tenant corruption into a single buffer key and verify rejection
    const rawBuffers: Map<string, any[]> = (TelemetryBufferService as any).rawBuffers;
    const corruptedKey = `${ORG_A}::${CLUSTER_A}::corrupted-svc`;
    rawBuffers.set(corruptedKey, [
      {
        organization_id: ORG_A,
        cluster_id: CLUSTER_A,
        agent_id: 'a1',
        service_id: 'corrupted-svc',
        pod_id: 'p1',
        cpu: 10,
        ram: 10,
        disk: 10,
        request_rate: 10,
        latency: 10,
        http_5xx_rate: 0,
        pod_restart_count: 0,
        replica_count: 1,
        collected_at: new Date(),
      },
      {
        organization_id: ORG_B,
        cluster_id: CLUSTER_A,
        agent_id: 'b1',
        service_id: 'corrupted-svc',
        pod_id: 'p2',
        cpu: 99,
        ram: 99,
        disk: 10,
        request_rate: 10,
        latency: 10,
        http_5xx_rate: 0,
        pod_restart_count: 0,
        replica_count: 1,
        collected_at: new Date(),
      },
    ]);

    const corruptedBatch = await TelemetryBufferService.getFreshBatch('corrupted-svc', 5, null, 12, ORG_A, CLUSTER_A);
    assert.strictEqual(corruptedBatch.points.length, 0, 'Mixed-tenant buffer must never emit a batch');

    // Inject mixed-cluster corruption inside same organization and verify rejection
    const mixedClusterKey = `${ORG_A}::${CLUSTER_A}::mixed-cluster-svc`;
    rawBuffers.set(mixedClusterKey, [
      {
        organization_id: ORG_A,
        cluster_id: CLUSTER_A,
        agent_id: 'a1',
        service_id: 'mixed-cluster-svc',
        pod_id: 'p1',
        cpu: 10,
        ram: 10,
        disk: 10,
        request_rate: 10,
        latency: 10,
        http_5xx_rate: 0,
        pod_restart_count: 0,
        replica_count: 1,
        collected_at: new Date(),
      },
      {
        organization_id: ORG_A,
        cluster_id: CLUSTER_B,
        agent_id: 'a2',
        service_id: 'mixed-cluster-svc',
        pod_id: 'p2',
        cpu: 50,
        ram: 50,
        disk: 10,
        request_rate: 10,
        latency: 10,
        http_5xx_rate: 0,
        pod_restart_count: 0,
        replica_count: 1,
        collected_at: new Date(),
      },
    ]);

    const mixedClusterBatch = await TelemetryBufferService.getFreshBatch('mixed-cluster-svc', 5, null, 12, ORG_A, CLUSTER_A);
    assert.strictEqual(mixedClusterBatch.points.length, 0, 'Mixed-cluster buffer must never emit a batch');
  });

  test('PIPE-05: Missing or invalid organizationId is rejected safely without DB fallback or processing', async () => {
    let evalCount = 0;
    let dbFallbackCount = 0;
    mock.method(TelemetryAggregatorService, 'evaluateAndDiagnoseService', async () => {
      evalCount++;
      return { rca_triggered: false } as any;
    });
    mock.method(MetricModel, 'aggregateByService', async () => {
      dbFallbackCount++;
      return [];
    });
    mock.method(MetricModel, 'getFreshBatchByService', async () => {
      dbFallbackCount++;
      return { points: [] };
    });

    // Unattributed / invalid pushMetric attempts must be dropped safely
    pushBuckets(null, CLUSTER_A, 'untrusted-svc', 12, 50);
    pushBuckets('', CLUSTER_A, 'untrusted-svc', 12, 50);
    pushBuckets('all', CLUSTER_A, 'untrusted-svc', 12, 50);
    pushBuckets('not-a-uuid', CLUSTER_A, 'untrusted-svc', 12, 50);
    pushBuckets(ORG_A, null, 'untrusted-svc', 12, 50);

    const rawBuffers: Map<string, any[]> = (TelemetryBufferService as any).rawBuffers;
    assert.strictEqual(rawBuffers.size, 0, 'Invalid tenant metrics must not accumulate in rawBuffers');

    // Direct calls to processServiceBatch without valid tenant context must fail safely
    await TelemetryPipelineService.processServiceBatch('untrusted-svc');
    await TelemetryPipelineService.processServiceBatch('untrusted-svc', null, CLUSTER_A);
    await TelemetryPipelineService.processServiceBatch('untrusted-svc', 'all', CLUSTER_A);
    await TelemetryPipelineService.processServiceBatch('untrusted-svc', 'invalid-org', CLUSTER_A);
    await TelemetryPipelineService.processServiceBatch('untrusted-svc', ORG_A, null);

    assert.strictEqual(evalCount, 0);
    assert.strictEqual(dbFallbackCount, 0);
  });

  test('PIPE-06: Processing failure in one tenant does not stop another tenant in the same cycle', async () => {
    const evalOrgs: string[] = [];
    mock.method(TelemetryAggregatorService, 'evaluateAndDiagnoseService', async (_svc: string, options: any) => {
      evalOrgs.push(options.organizationId);
      return { rca_triggered: false, rule_evaluation: { anomalies: [] } } as any;
    });

    const origGetFreshBatch = TelemetryBufferService.getFreshBatch.bind(TelemetryBufferService);
    mock.method(
      TelemetryBufferService,
      'getFreshBatch',
      async (svc: string, bucketSec: number, afterTs: any, limit: number, orgId?: string | null, clusterId?: string | null) => {
        if (orgId === ORG_A) {
          throw new Error('Simulated tenant A transient failure');
        }
        return origGetFreshBatch(svc, bucketSec, afterTs, limit, orgId, clusterId);
      }
    );

    pushBuckets(ORG_A, CLUSTER_A, 'resilient-svc', 12, 25);
    pushBuckets(ORG_B, CLUSTER_B, 'resilient-svc', 12, 55);

    await TelemetryPipelineService.runPipelineCycle();
    await new Promise((r) => setTimeout(r, 40));

    assert.deepStrictEqual(evalOrgs, [ORG_B], 'Tenant B must still be processed when Tenant A throws');
    const lockMap: Record<string, boolean> = (TelemetryPipelineService as any).isProcessingService;
    assert.strictEqual(
      lockMap[`${ORG_A}:${CLUSTER_A}:resilient-svc`],
      false,
      'Lock for failed Tenant A must be released in finally'
    );
  });

  test('PIPE-07: Each tenant batch is processed independently (12/12 Org A triggers AI, 4/12 Org B waits)', async () => {
    const evalCalls: Array<{ organizationId: string; clusterId: string }> = [];
    mock.method(TelemetryAggregatorService, 'evaluateAndDiagnoseService', async (_svc: string, options: any) => {
      evalCalls.push({ organizationId: options.organizationId, clusterId: options.clusterId });
      return { rca_triggered: false, rule_evaluation: { anomalies: [] } } as any;
    });

    pushBuckets(ORG_A, CLUSTER_A, 'worker-svc', 12, 40);
    pushBuckets(ORG_B, CLUSTER_B, 'worker-svc', 4, 80);

    await TelemetryPipelineService.runPipelineCycle();
    await new Promise((r) => setTimeout(r, 40));

    assert.strictEqual(evalCalls.length, 1);
    assert.strictEqual(evalCalls[0].organizationId, ORG_A);
    assert.strictEqual(evalCalls[0].clusterId, CLUSTER_A);

    const lastBuckets: Record<string, Date | null> = (TelemetryPipelineService as any).lastEvaluatedBucketTimestamp;
    assert.ok(lastBuckets[`${ORG_A}:${CLUSTER_A}:worker-svc`] instanceof Date);
    assert.strictEqual(lastBuckets[`${ORG_B}:${CLUSTER_B}:worker-svc`], undefined);
  });

  test('PIPE-08: No duplicate processing of the same 12-point batch across repeated or concurrent cycles', async () => {
    let evalCount = 0;
    mock.method(TelemetryAggregatorService, 'evaluateAndDiagnoseService', async () => {
      evalCount++;
      return { rca_triggered: false, rule_evaluation: { anomalies: [] } } as any;
    });

    const t0 = Math.floor(Date.now() / 1000) - 200;
    pushBuckets(ORG_A, CLUSTER_A, 'checkout-svc', 12, 33, t0);

    // Trigger twice concurrently and once sequentially with no new buckets
    await Promise.all([
      TelemetryPipelineService.processServiceBatch('checkout-svc', ORG_A, CLUSTER_A),
      TelemetryPipelineService.processServiceBatch('checkout-svc', ORG_A, CLUSTER_A),
    ]);
    await TelemetryPipelineService.runPipelineCycle();
    await new Promise((r) => setTimeout(r, 40));

    assert.strictEqual(evalCount, 1, 'Same 12-point batch must be evaluated only once');

    // Push 12 genuinely new buckets after the first batch and verify second evaluation happens once
    pushBuckets(ORG_A, CLUSTER_A, 'checkout-svc', 12, 44, t0 + 12 * 5);
    await TelemetryPipelineService.runPipelineCycle();
    await TelemetryPipelineService.runPipelineCycle();
    await new Promise((r) => setTimeout(r, 40));

    assert.strictEqual(evalCount, 2, 'New 12-point batch must be evaluated exactly once');
  });
});
