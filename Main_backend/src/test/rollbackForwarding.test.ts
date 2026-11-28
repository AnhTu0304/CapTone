import test, { describe, afterEach, after, mock } from 'node:test';
import assert from 'node:assert';
import { pool } from '../config/database';
import { closeRedis } from '../config/redis';
import { AiService } from '../services/ai.service';
import {
  WorkloadModel,
  IncidentModel,
  RcaModel,
  RecommendationModel,
  EnvironmentModel,
  OrganizationModel,
} from '../models';

describe('AiService.analyzeRootCause deployment payload forwarding', () => {
  afterEach(() => {
    mock.restoreAll();
  });

  after(async () => {
    await closeRedis().catch(() => {});
  });

  test('forwards top-level deployment (and kubernetes.deployment) to AI Backend /api/v1/rca', async () => {
    let sentBody: any = null;

    mock.method(WorkloadModel, 'resolveK8sTarget', async () => ({
      workloadId: '46cc7435-0e81-41d5-866e-8d14b35581b5',
      targetName: 'ecommerce-store-app',
      namespace: 'test-lab',
      workloadType: 'Deployment',
    }));
    mock.method(EnvironmentModel, 'findByIdOrName', async () => ({
      id: 'e0000000-0000-0000-0000-000000000001',
      organization_id: '00000000-0000-0000-0000-000000000001',
    } as any));
    mock.method(OrganizationModel, 'findFirst', async () => ({
      id: '00000000-0000-0000-0000-000000000001',
    } as any));

    mock.method(pool, 'query', async () => ({ rows: [], rowCount: 0 } as any));
    mock.method(pool, 'connect', async () => ({
      query: async (sql: string) => {
        if (typeof sql === 'string' && sql.includes('RETURNING')) {
          return { rows: [{ id: '11111111-1111-4111-8111-111111111111', created_at: new Date().toISOString() }], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      },
      release: () => {},
    }));

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
      id: '44444444-4444-4444-8444-444444444444',
    } as any));

    mock.method(globalThis, 'fetch', async (_url: any, init: any) => {
      sentBody = JSON.parse(String(init?.body || '{}'));
      return {
        ok: true,
        status: 200,
        json: async () => ({
          service_id: 'ecommerce-store-app',
          root_cause: { cause: 'Deployment failure', confidence: 0.95, severity: 'CRITICAL' },
          evidence: ['HTTP 5xx 100%'],
          recommendation: { action: 'ROLLBACK_DEPLOYMENT', reason: 'Rollback to v1.2.0-stable', priority: 'HIGH' },
          explanation: 'Regression on v1.2.1-faulty',
          historical_context_used: false,
          similar_incident_ids: [],
        }),
      } as any;
    });

    await AiService.analyzeRootCause({
      service_id: 'ecommerce-store-app',
      risk_type: 'HTTP_5XX_SPIKE',
      confidence: 1.0,
      metrics: {
        cpu: 4,
        ram: 29,
        disk: 12,
        latency: 1100,
        request_rate: 15,
        http_5xx_rate: 100,
        pod_restart_count: 0,
        replica_count: 4,
      },
      logs: [],
      kubernetes_events: ['Deployment rollout v1.2.1-faulty failed health regression check (HTTP 5xx spike)'],
      kubernetes: {
        deployment: {
          desired_replicas: 4,
          available_replicas: 3,
          version: 'v1.2.1-faulty',
          previous_version: 'v1.2.0-stable',
        },
      },
      deployment: {
        current_version: 'v1.2.1-faulty',
        previous_version: 'v1.2.0-stable',
        status: 'degraded',
      },
      environment_id: 'e0000000-0000-0000-0000-000000000001',
      cluster_id: '8ea9ecbf-c5c2-44b2-b149-0f496665c0b6',
    } as any);

    assert.ok(sentBody, 'Expected fetch to POST RCA payload');
    assert.deepStrictEqual(sentBody.deployment, {
      current_version: 'v1.2.1-faulty',
      previous_version: 'v1.2.0-stable',
      status: 'degraded',
    });
    assert.strictEqual(sentBody.kubernetes?.deployment?.version, 'v1.2.1-faulty');
    assert.strictEqual(sentBody.kubernetes?.deployment?.previous_version, 'v1.2.0-stable');
  });
});
