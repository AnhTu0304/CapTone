import { mergePolledPredictions } from './index';

describe('mergePolledPredictions', () => {
  test('preserves newer WebSocket HEALTHY live-norm predictions against stale DB RISK_DETECTED rows', () => {
    const prevList = [
      {
        id: 'live-norm-1795853000000-ecommerce-store-app',
        workload_name: 'ecommerce-store-app',
        service_id: 'ecommerce-store-app',
        status: 'HEALTHY',
        prediction_type: 'NORMAL',
        risk_score: 0,
        predicted_at: '2026-11-28T08:00:00.000Z',
      },
      {
        id: 'db-old-1',
        workload_name: 'ecommerce-store-app',
        status: 'RISK_DETECTED',
        prediction_type: 'HIGH_LATENCY',
        risk_score: 0.6677,
        predicted_at: '2026-11-28T07:58:00.000Z',
      },
    ];

    const dbList = [
      {
        id: 'db-old-1',
        workload_name: 'ecommerce-store-app',
        status: 'RISK_DETECTED',
        prediction_type: 'HIGH_LATENCY',
        risk_score: 0.6677,
        predicted_at: '2026-11-28T07:58:00.000Z',
      },
    ];

    const merged = mergePolledPredictions(prevList, dbList);
    expect(merged[0].id).toBe('live-norm-1795853000000-ecommerce-store-app');
    expect(merged[0].status).toBe('HEALTHY');
  });

  test('lets newer DB RISK_DETECTED replace older WebSocket HEALTHY prediction', () => {
    const prevList = [
      {
        id: 'live-norm-1795852000000-ecommerce-store-app',
        workload_name: 'ecommerce-store-app',
        status: 'HEALTHY',
        prediction_type: 'NORMAL',
        risk_score: 0,
        predicted_at: '2026-11-28T07:50:00.000Z',
      },
    ];

    const dbList = [
      {
        id: 'db-new-1',
        workload_name: 'ecommerce-store-app',
        status: 'RISK_DETECTED',
        prediction_type: 'HIGH_LATENCY',
        risk_score: 0.72,
        predicted_at: '2026-11-28T07:58:00.000Z',
      },
    ];

    const merged = mergePolledPredictions(prevList, dbList);
    expect(merged).toHaveLength(1);
    expect(merged[0].id).toBe('db-new-1');
    expect(merged[0].status).toBe('RISK_DETECTED');
  });

  test('returns previous reference unchanged when polled rows are identical', () => {
    const prevList = [
      {
        id: 'db-1',
        workload_name: 'mongodb',
        status: 'RISK_DETECTED',
        prediction_type: 'OOM',
        risk_score: 0.8951,
        predicted_at: '2026-11-28T07:14:14.462Z',
      },
    ];

    const dbList = [
      {
        id: 'db-1',
        workload_name: 'mongodb',
        status: 'RISK_DETECTED',
        prediction_type: 'OOM',
        risk_score: 0.8951,
        predicted_at: '2026-11-28T07:14:14.462Z',
      },
    ];

    const merged = mergePolledPredictions(prevList, dbList);
    expect(merged).toBe(prevList);
  });
});
