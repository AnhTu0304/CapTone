import { test, describe, after, mock } from 'node:test';
import assert from 'node:assert';
import { IncidentModel } from '../models/incident.model';
import { pool } from '../config/database';

const isLiveDb = process.env.LIVE_DB_TEST === '1';

describe('IncidentModel Honesty Queries', () => {
  if (isLiveDb) {
    test('Live DB: IncidentModel.findById returns real recommendation_risk_level, pod, node, and cluster_node_count for INC-DD0CCA2C', async () => {
      const incident = await IncidentModel.findById('dd0cca2c-2fcf-4492-9024-24e9557ba784');
      assert.ok(incident, 'Expected target incident dd0cca2c-2fcf-4492-9024-24e9557ba784 to exist');
      assert.strictEqual(incident.cluster_name, 'fyuyu');
      assert.strictEqual(incident.service_name, 'sme-order-service');
      assert.strictEqual(incident.recommendation_action, 'SCALE_REPLICAS');
      assert.strictEqual(incident.recommendation_risk_level, 'MEDIUM');
      assert.strictEqual(incident.recommendation_priority, 'MEDIUM');
      assert.strictEqual(incident.prediction_type, 'HIGH_LATENCY');
      assert.strictEqual(incident.cluster_node_count, 1);
      assert.ok(
        typeof incident.actual_pod_name === 'string' && incident.actual_pod_name.startsWith('sme-order-service-'),
        `Expected real pod name starting with sme-order-service-, got ${incident.actual_pod_name}`
      );
      assert.strictEqual(incident.node_name, 'minikube');
    });

    test('Live DB: IncidentModel.findMany executes cleanly and returns enriched columns without row multiplication', async () => {
      const many = await IncidentModel.findMany({ limit: 10, offset: 0 });
      assert.ok(Array.isArray(many.items) && many.items.length > 0);
      assert.ok('recommendation_risk_level' in many.items[0]);
      assert.ok('actual_pod_name' in many.items[0]);
      assert.ok('cluster_node_count' in many.items[0]);
      assert.ok('prediction_type' in many.items[0]);
    });
  } else {
    test('Unit: IncidentModel.findMany and findById do not hardcode minikube or default fallbacks and include real joins', async (t) => {
      const executedSql: string[] = [];

      t.mock.method(pool, 'query', async (sql: string) => {
        executedSql.push(sql);
        if (/^\s*select\s+count\(\*\)\s+from\s+incidents/i.test(sql)) {
          return { rows: [{ count: '1' }] };
        }
        return {
          rows: [
            {
              id: 'inc-1',
              service_name: 'sme-order-service',
              cluster_name: 'prod-cluster',
              namespace: 'production',
              node_name: 'worker-02',
              actual_pod_name: 'sme-order-service-77f9b8c-abcde',
              cluster_node_count: 3,
              recommendation_action: 'SCALE_REPLICAS',
              recommendation_risk_level: 'MEDIUM',
              recommendation_priority: 'MEDIUM',
            },
          ],
        };
      });

      const listRes = await IncidentModel.findMany({ limit: 10, offset: 0 });
      assert.strictEqual(listRes.total, 1);
      assert.strictEqual(listRes.items[0].recommendation_risk_level, 'MEDIUM');
      assert.strictEqual(listRes.items[0].actual_pod_name, 'sme-order-service-77f9b8c-abcde');

      const detail = await IncidentModel.findById('inc-1');
      assert.strictEqual(detail.node_name, 'worker-02');
      assert.strictEqual(detail.cluster_node_count, 3);

      const mainQueries = executedSql.filter((q) => /^\s*SELECT\s+i\.id/i.test(q));
      assert.strictEqual(mainQueries.length, 2);
      for (const sql of mainQueries) {
        assert.ok(!sql.includes("'minikube'"), 'SQL must never hardcode minikube fallback');
        assert.ok(!sql.includes("'default'"), 'SQL must never hardcode default namespace fallback');
        assert.ok(sql.includes('pod_info'), 'SQL must query real pod_info lateral join');
        assert.ok(sql.includes('rec_info'), 'SQL must query rec_info lateral join');
        assert.ok(sql.includes('cluster_node_count'), 'SQL must compute cluster_node_count');
        assert.ok(sql.includes('ai_predictions pred'), 'SQL must join ai_predictions');
      }
    });
  }

  after(async () => {
    mock.restoreAll();
    if (isLiveDb) {
      await pool.end();
    }
  });
});
