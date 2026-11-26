import assert from 'node:assert';
import test, { describe, after, mock } from 'node:test';
import { pool } from '../config/database';
import { LogModel } from '../models/log.model';
import { LogsRetentionService } from '../services/logsRetention.service';
import { AgentWsMessageSchema } from '../schemas/agentWebSocket.schema';

describe('Logs Query Optimization, Batch Ingestion & TTL Retention', () => {
  after(() => {
    mock.restoreAll();
  });

  test('LogModel.findPrioritizedByService avoids OR seq-scan anti-pattern via UNION ALL', async (t) => {
    const calls: Array<{ sql: string; params: any[] }> = [];
    t.mock.method(pool, 'query', async (sql: string, params: any[]) => {
      calls.push({ sql, params });
      return {
        rows: [
          {
            level: 'ERROR',
            message: 'Connection reset by peer',
            occurred_at: new Date('2026-11-26T17:00:00Z'),
            pod_id: 'pod-1',
          },
        ],
      };
    });

    const rows = await LogModel.findPrioritizedByService('ecommerce-store-app', 30, 30);
    assert.strictEqual(rows.length, 1);
    assert.strictEqual(calls.length, 1);

    const { sql, params } = calls[0];
    assert.ok(sql.includes('UNION ALL'), 'Should separate indexable branches with UNION ALL');
    assert.ok(!sql.includes('service_id::text ='), 'Should not cast varchar service_id to text');
    assert.strictEqual(params[0], 'ecommerce-store-app');
    assert.strictEqual(params[1], 30);
    assert.strictEqual(params[2], 30);
    assert.ok(params[3] >= 500);
  });

  test('LogModel.createBatch builds single multi-row parameterized INSERT', async (t) => {
    const calls: Array<{ sql: string; params: any[] }> = [];
    t.mock.method(pool, 'query', async (sql: string, params: any[]) => {
      calls.push({ sql, params });
      return { rows: [{ id: '101' }, { id: '102' }] };
    });

    const res = await LogModel.createBatch([
      {
        cluster_id: '8ea9ecbf-c5c2-44b2-b149-0f496665c0b6',
        service_id: 'ecommerce-store-app',
        level: 'info',
        message: 'Checkout OK',
        source: 'k8s-agent',
        occurred_at: new Date('2026-11-26T17:00:00Z'),
      },
      {
        cluster_id: '8ea9ecbf-c5c2-44b2-b149-0f496665c0b6',
        service_id: 'ecommerce-store-app',
        level: 'error',
        message: 'Timeout connecting DB',
        source: 'k8s-agent',
        occurred_at: new Date('2026-11-26T17:00:01Z'),
      },
    ]);

    assert.deepStrictEqual(res, [{ id: '101' }, { id: '102' }]);
    assert.strictEqual(calls.length, 1);
    assert.strictEqual(calls[0].params.length, 18);
  });

  test('AgentWsMessageSchema accepts both legacy log and new log_batch envelopes', () => {
    const singleParsed = AgentWsMessageSchema.safeParse({
      type: 'log',
      data: {
        service_id: 'ecommerce-store-app',
        pod_id: 'pod-1',
        namespace: 'test-lab',
        timestamp: '2026-11-26T17:00:00.000Z',
        level: 'INFO',
        message: 'OK',
      },
    });
    assert.strictEqual(singleParsed.success, true);

    const batchParsed = AgentWsMessageSchema.safeParse({
      type: 'log_batch',
      data: [
        {
          service_id: 'ecommerce-store-app',
          pod_id: 'pod-1',
          namespace: 'test-lab',
          timestamp: '2026-11-26T17:00:00.000Z',
          level: 'warning',
          message: 'High latency',
        },
        {
          service_id: 'ecommerce-store-app',
          pod_id: 'pod-2',
          namespace: 'test-lab',
          timestamp: '2026-11-26T17:00:01.000Z',
          level: 'ERROR',
          message: 'DB failure',
        },
      ],
    });
    assert.strictEqual(batchParsed.success, true);
  });

  test('LogsRetentionService ensures indexes and purges INFO (24h) and WARN/ERROR (7d) in batches', async () => {
    const executedSql: string[] = [];
    let deleteCall = 0;
    const mockPool = {
      query: async (sql: string) => {
        executedSql.push(sql);
        if (sql.includes('DELETE FROM public.logs')) {
          deleteCall++;
          if (deleteCall === 1) return { rowCount: 5000 };
          if (deleteCall === 2) return { rowCount: 250 };
          return { rowCount: 40 };
        }
        return { rows: [], rowCount: 0 };
      },
    };

    const idxRes = await LogsRetentionService.ensureLogsIndexes(mockPool);
    assert.strictEqual(idxRes.ensured, 5);
    assert.strictEqual(idxRes.errors.length, 0);

    const purgeRes = await LogsRetentionService.purgeOldLogs({
      infoRetentionHours: 24,
      errorRetentionDays: 7,
      batchSize: 5000,
      maxBatches: 10,
      queryPool: mockPool,
    });

    assert.strictEqual(purgeRes.purgedInfoCount, 5250);
    assert.strictEqual(purgeRes.purgedWarnErrorCount, 40);
    assert.strictEqual(purgeRes.totalPurged, 5290);
    assert.strictEqual(purgeRes.batchesExecuted, 3);
    assert.ok(executedSql.some((q) => q.includes('ANALYZE public.logs')));
  });
});
