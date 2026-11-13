import { PoolClient } from 'pg';
import { pool } from '../config/database';

export interface IWorkloadInfo {
  id: string;
  name?: string;
  workload_type?: string | null;
  cluster_id?: string | null;
  namespace_id?: string | null;
}

export interface IK8sTargetResolution {
  workloadId: string | null;
  targetName: string;
  namespace: string;
  workloadType: string;
}

export class WorkloadModel {
  /**
   * Find or create workload by service name, automatically resolving real controller workload before creating
   */
  public static async findOrCreateByName(
    name: string,
    clusterId?: string | null,
    client?: PoolClient,
    namespaceId?: string | null
  ): Promise<IWorkloadInfo> {
    const existing = await this.findByName(name, client, clusterId);
    if (existing) {
      if (namespaceId && !existing.namespace_id) {
        const db = client || pool;
        try {
          await db.query('UPDATE workloads SET namespace_id = $1, updated_at = NOW() WHERE id = $2', [
            namespaceId,
            existing.id,
          ]);
          existing.namespace_id = namespaceId;
        } catch {
          // Ignore update error
        }
      }
      return existing;
    }

    const db = client || pool;
    try {
      if (client) await client.query('SAVEPOINT sp_workload_create');
      const res = await db.query(
        `INSERT INTO workloads (name, cluster_id, namespace_id, workload_type, status)
         VALUES ($1, $2, $3, 'Deployment', 'HEALTHY')
         RETURNING id, name, workload_type, cluster_id, namespace_id`,
        [name, clusterId || null, namespaceId || null]
      );
      if (client) await client.query('RELEASE SAVEPOINT sp_workload_create');
      return res.rows[0];
    } catch {
      if (client) {
        try {
          await client.query('ROLLBACK TO SAVEPOINT sp_workload_create');
        } catch {}
      }
      const retry = await this.findByName(name, client, clusterId);
      if (retry) {
        if (namespaceId && !retry.namespace_id) {
          try {
            await db.query('UPDATE workloads SET namespace_id = $1, updated_at = NOW() WHERE id = $2', [
              namespaceId,
              retry.id,
            ]);
            retry.namespace_id = namespaceId;
          } catch {}
        }
        return retry;
      }
      return { id: name, name: name, cluster_id: clusterId || null, namespace_id: namespaceId || null };
    }
  }

  /**
   * Find workload by service name, falling back to pod label/owner resolution & controller suffix matching
   */
  public static async findByName(
    name: string,
    client?: PoolClient,
    clusterId?: string | null
  ): Promise<IWorkloadInfo | null> {
    // Use auto-commit pool for optional read lookups so caught SQL quirks cannot abort caller's TX (25P02)
    const db = pool;
    try {
      if (clusterId) {
        const res = await db.query(
          `SELECT id, name, workload_type, cluster_id, namespace_id FROM workloads
           WHERE name = $1
             AND deleted_at IS NULL
             AND (
               cluster_id::text = $2
               OR cluster_id::text IN (SELECT id::text FROM clusters WHERE id::text = $2 OR cluster_uid = $2 OR name = $2)
             )
           ORDER BY (workload_type != 'Deployment') DESC, (kubernetes_uid IS NOT NULL) DESC, updated_at DESC NULLS LAST, created_at ASC
           LIMIT 1`,
          [name, clusterId]
        );
        if (res.rows.length > 0) return res.rows[0];
      }

      const exactRes = await db.query(
        `SELECT id, name, workload_type, cluster_id, namespace_id FROM workloads
         WHERE name = $1 AND deleted_at IS NULL
         ORDER BY (kubernetes_uid IS NOT NULL) DESC, updated_at DESC NULLS LAST, created_at ASC
         LIMIT 1`,
        [name]
      );
      if (exactRes.rows.length > 0) return exactRes.rows[0];

      // Resolve via live pod labels (e.g. app.kubernetes.io/name = kube-state-metrics -> prometheus-kube-state-metrics)
      const podWlParams: any[] = [name, `${name}-%`];
      let clusterFilterSql = '';
      if (clusterId) {
        clusterFilterSql = `AND (
          w.cluster_id::text = $3
          OR w.cluster_id::text IN (SELECT id::text FROM clusters WHERE id::text = $3 OR cluster_uid = $3 OR name = $3)
        )`;
        podWlParams.push(clusterId);
      }

      const viaPodsRes = await db.query(
        `SELECT w.id, w.name, w.workload_type, w.cluster_id, w.namespace_id
         FROM pods p
         JOIN workloads w ON w.id = p.workload_id
         WHERE p.deleted_at IS NULL
           AND w.deleted_at IS NULL
           AND (
             p.labels->>'app' = $1
             OR p.labels->>'app.kubernetes.io/name' = $1
             OR p.name LIKE $2
           )
           ${clusterFilterSql}
         ORDER BY p.created_at DESC
         LIMIT 1`,
        podWlParams
      );
      if (viaPodsRes.rows.length > 0) return viaPodsRes.rows[0];

      // Suffix match on canonical workloads in cluster (e.g. otel-collector-opentelemetry-collector, prometheus-kube-state-metrics)
      const suffixParams: any[] = [`%-${name}`];
      let suffixClusterSql = '';
      if (clusterId) {
        suffixClusterSql = `AND (
          cluster_id::text = $2
          OR cluster_id::text IN (SELECT id::text FROM clusters WHERE id::text = $2 OR cluster_uid = $2 OR name = $2)
        )`;
        suffixParams.push(clusterId);
      }
      const suffixRes = await db.query(
        `SELECT id, name, workload_type, cluster_id, namespace_id FROM workloads
         WHERE name LIKE $1 AND deleted_at IS NULL ${suffixClusterSql}
         ORDER BY (kubernetes_uid IS NOT NULL) DESC, updated_at DESC NULLS LAST, created_at ASC
         LIMIT 1`,
        suffixParams
      );
      return suffixRes.rows[0] || null;
    } catch {
      return null;
    }
  }

  /**
   * Resolve real Kubernetes Deployment/StatefulSet name & namespace for a service_id or workload name
   */
  public static async resolveK8sTarget(
    serviceIdOrName: string,
    clusterId?: string | null,
    client?: PoolClient
  ): Promise<IK8sTargetResolution> {
    const db = client || pool;
    const cleanInput = String(serviceIdOrName || '').trim();
    const fallback: IK8sTargetResolution = {
      workloadId: null,
      targetName: cleanInput || 'unknown-service',
      namespace: cleanInput === 'selfheal-test-app' ? 'test-lab' : 'default',
      workloadType: 'Deployment',
    };
    if (!cleanInput) return fallback;

    try {
      // 1. Direct workload lookup first to prevent cross-component contamination in multi-tier charts
      const exactWl = await this.findByName(cleanInput, client, clusterId);
      if (exactWl && exactWl.name && exactWl.name.toLowerCase() === cleanInput.toLowerCase()) {
        let nsName = fallback.namespace;
        if (exactWl.namespace_id) {
          const nsRes = await db.query('SELECT name FROM namespaces WHERE id = $1 LIMIT 1', [exactWl.namespace_id]);
          if (nsRes.rows[0]?.name) nsName = nsRes.rows[0].name;
        }
        return {
          workloadId: exactWl.id,
          targetName: exactWl.name,
          namespace: nsName,
          workloadType: exactWl.workload_type || 'Deployment',
        };
      }

      // 2. Check live pod with matching app labels / controller prefix to get exact namespace & owned workload
      const podParams: any[] = [cleanInput, `${cleanInput}-%`, `%-${cleanInput}-%`];
      let podClusterSql = '';
      if (clusterId) {
        podClusterSql = `AND (
          p.cluster_id::text = $4
          OR p.cluster_id::text IN (SELECT id::text FROM clusters WHERE id::text = $4 OR cluster_uid = $4 OR name = $4)
        )`;
        podParams.push(clusterId);
      }

      const podRes = await db.query(
        `SELECT
           w.id AS workload_id,
           w.name AS workload_name,
           w.workload_type,
           COALESCE(ns_w.name, ns_p.name) AS namespace_name,
           p.name AS pod_name,
           p.labels->>'app' AS app_label,
           p.labels->>'app.kubernetes.io/name' AS app_io_label
         FROM pods p
         LEFT JOIN workloads w ON w.id = p.workload_id AND w.deleted_at IS NULL
         LEFT JOIN namespaces ns_w ON ns_w.id = w.namespace_id
         LEFT JOIN namespaces ns_p ON ns_p.id = p.namespace_id
         WHERE p.deleted_at IS NULL
           AND (
             w.name = $1
             OR p.labels->>'app' = $1
             OR p.labels->>'app.kubernetes.io/name' = $1
             OR p.name = $1
             OR p.name LIKE $2
             OR p.name LIKE $3
           )
           ${podClusterSql}
         ORDER BY
           (w.name = $1) DESC,
           (p.name = $1) DESC,
           (p.labels->>'app' = $1) DESC,
           (p.labels->>'app.kubernetes.io/name' = $1) DESC,
           (p.name LIKE $2) DESC,
           (w.id IS NOT NULL) DESC,
           (w.kubernetes_uid IS NOT NULL) DESC,
           p.updated_at DESC NULLS LAST,
           p.created_at DESC
         LIMIT 1`,
        podParams
      );

      if (podRes.rows.length > 0) {
        const row = podRes.rows[0];
        let resolvedName = '';
        if (row.app_io_label && (row.app_io_label === cleanInput || cleanInput.includes(row.app_io_label))) {
          resolvedName = row.app_io_label;
        } else if (row.app_label && (row.app_label === cleanInput || cleanInput.includes(row.app_label))) {
          resolvedName = row.app_label;
        } else if (row.workload_name) {
          resolvedName = row.workload_name;
        } else if (row.pod_name) {
          resolvedName = String(row.pod_name)
            .replace(/-[a-z0-9]{6,10}-[a-z0-9]{4,6}$/, '')
            .replace(/-[a-z0-9]+-[a-z0-9]+$/, '')
            .replace(/-\d+$/, '');
        }
        return {
          workloadId: row.workload_id || null,
          targetName: resolvedName || cleanInput,
          namespace: row.namespace_name || fallback.namespace,
          workloadType: row.workload_type || (/-\d+$/.test(row.pod_name || '') ? 'StatefulSet' : 'Deployment'),
        };
      }

      // 3. Fallback to workloads table (exact / suffix)
      const wl = await this.findByName(cleanInput, client, clusterId);
      if (wl) {
        let nsName = fallback.namespace;
        if (wl.namespace_id) {
          const nsRes = await db.query('SELECT name FROM namespaces WHERE id = $1 LIMIT 1', [wl.namespace_id]);
          if (nsRes.rows[0]?.name) nsName = nsRes.rows[0].name;
        }
        return {
          workloadId: wl.id,
          targetName: wl.name || cleanInput,
          namespace: nsName,
          workloadType: wl.workload_type || 'Deployment',
        };
      }
    } catch {
      // Safe fallback
    }

    return fallback;
  }

  /**
   * Find cluster ID of a workload
   */
  public static async findClusterId(
    workloadId: string,
    client?: PoolClient
  ): Promise<string | null> {
    const db = client || pool;
    try {
      const res = await db.query(
        'SELECT cluster_id FROM workloads WHERE id = $1 LIMIT 1',
        [workloadId]
      );
      return res.rows[0]?.cluster_id || null;
    } catch {
      return null;
    }
  }
}
