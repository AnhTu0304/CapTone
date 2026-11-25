import {
  doesEntityMatchServiceTarget,
  doesPodMatchServiceTarget,
  doesRecordMatchServiceTarget,
} from './k8sServiceFilter';

describe('k8sServiceFilter general service matching', () => {
  const knownServices = [
    'attack-injector-app',
    'ecommerce-store-app',
    'kube-state-metrics',
    'mongodb',
    'mongodb-init',
    'prometheus',
    'prometheus-node-exporter',
  ];

  test('never matches mongodb-init or UNKNOWN on mongodb-init when mongodb is selected', () => {
    expect(doesEntityMatchServiceTarget('mongodb-init', 'mongodb', knownServices)).toBe(false);
    expect(doesEntityMatchServiceTarget('UNKNOWN on mongodb-init', 'mongodb', knownServices)).toBe(false);
    expect(
      doesEntityMatchServiceTarget('mongodb-init', 'mongodb', [])
    ).toBe(false);

    expect(
      doesRecordMatchServiceTarget(
        {
          id: 'inc-init',
          target_name: 'mongodb-init',
          service_id: 'mongodb-init',
          title: 'UNKNOWN on mongodb-init',
        },
        'mongodb',
        knownServices
      )
    ).toBe(false);
  });

  test('matches real StatefulSet and Deployment pod names and normalizes incidents for selected service', () => {
    expect(doesEntityMatchServiceTarget('mongodb', 'mongodb', knownServices)).toBe(true);
    expect(doesEntityMatchServiceTarget('mongodb-0', 'mongodb', knownServices)).toBe(true);
    expect(doesEntityMatchServiceTarget('mongodb-1', 'mongodb', knownServices)).toBe(true);
    expect(doesEntityMatchServiceTarget('Tràn bộ nhớ RAM (RAM 85%) on mongodb', 'mongodb', knownServices)).toBe(true);
    expect(
      doesEntityMatchServiceTarget('ecommerce-store-app-87b9fff69-2d9hc', 'ecommerce-store-app', knownServices)
    ).toBe(true);

    expect(
      doesRecordMatchServiceTarget(
        {
          id: 'inc-mongo',
          service_id: '46cc7435-0e81-41d5-866e-8d14b35581b5',
          target_name: 'mongodb-0',
          title: 'Tràn bộ nhớ RAM (RAM 85%) on mongodb',
        },
        'mongodb',
        knownServices
      )
    ).toBe(true);
  });

  test('isolates prometheus from prometheus-node-exporter and kube-state-metrics generally', () => {
    expect(doesEntityMatchServiceTarget('prometheus-node-exporter', 'prometheus', knownServices)).toBe(false);
    expect(doesEntityMatchServiceTarget('prometheus-kube-state-metrics', 'prometheus', knownServices)).toBe(false);
    expect(
      doesEntityMatchServiceTarget('prometheus-prometheus-kube-prometheus-prometheus-0', 'prometheus', knownServices)
    ).toBe(true);
  });

  test('doesPodMatchServiceTarget isolates mongodb-rs-init job pod from mongodb service', () => {
    expect(
      doesPodMatchServiceTarget(
        {
          name: 'mongodb-rs-init-pzx5f',
          service_id: 'mongodb-init',
          labels: { app: 'mongodb-init' },
        },
        'mongodb',
        knownServices
      )
    ).toBe(false);

    expect(
      doesPodMatchServiceTarget(
        {
          name: 'mongodb-0',
          service_id: 'mongodb',
          labels: { app: 'mongodb' },
        },
        'mongodb',
        knownServices
      )
    ).toBe(true);
  });
});
