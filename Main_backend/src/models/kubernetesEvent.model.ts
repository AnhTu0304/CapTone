import crypto from 'crypto';
import { pool } from '../config/database';

export interface IKubernetesEvent {
  id?: string | number;
  cluster_id: string | null;
  namespace_id?: string | null;
  event_uid?: string | null;
  resource_type?: string;
  resource_uid: string;
  event_type: string;
  reason: string;
  message: string;
  source_component?: string;
  reporting_controller?: string | null;
  action?: string | null;
  first_seen_at?: Date;
  last_seen_at?: Date;
  count?: number;
  metadata?: Record<string, unknown>;
}

export interface IKubernetesEventQueryOptions {
  clusterId?: string | null;
  namespace?: string | null;
  eventType?: string | null;
  reason?: string | null;
  resourceType?: string | null;
  resourceUid?: string | null;
  search?: string | null;
  startTime?: Date | null;
  endTime?: Date | null;
  allowedOrgIds?: string[] | null;
  limit?: number;
  offset?: number;
}

export interface IKubernetesEventItem {
  id: string | number;
  cluster_id: string | null;
  namespace_id: string | null;
  namespace: string;
  resource_type: string;
  resource_uid: string;
  resource_name: string;
  event_type: string;
  reason: string;
  message: string;
  source_component: string;
  count: number;
  first_seen_at: string;
  last_seen_at: string;
  metadata: Record<string, unknown> | null;
}

export interface IKubernetesEventQueryResult {
  events: IKubernetesEventItem[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export class KubernetesEventModel {
  /**
   * Helper to compute an idempotent SHA256 dedup hash
   */
  public static computeDedupHash(event: IKubernetesEvent): string {
    const clusterKey = event.cluster_id || 'no-cluster';
    if (event.event_uid && event.event_uid.trim()) {
      return crypto.createHash('sha256').update(`${clusterKey}:uid:${event.event_uid.trim()}`).digest('hex');
    }
    const ns = String(event.metadata?.namespace || 'default').trim().toLowerCase();
    const rType = String(event.resource_type || 'Pod').trim();
    const rUid = String(event.resource_uid || '').trim();
    const reason = String(event.reason || 'General').trim();
    const msg = String(event.message || '').trim().slice(0, 300);
    return crypto.createHash('sha256').update(`${clusterKey}:fallback:${ns}:${rType}:${rUid}:${reason}:${msg}`).digest('hex');
  }

  /**
   * Idempotent Ingestion & Upsert for Kubernetes Events [S4][PB18] 4.2
   */
  public static async upsertEvent(
    event: IKubernetesEvent
  ): Promise<{ id: string | number; count: number; is_new: boolean }> {
    const rawFirst = event.first_seen_at ? new Date(event.first_seen_at) : new Date();
    const rawLast = event.last_seen_at ? new Date(event.last_seen_at) : new Date();
    const firstSeen = isNaN(rawFirst.getTime()) ? new Date() : rawFirst;
    const lastSeen = isNaN(rawLast.getTime()) ? new Date() : rawLast;

    const dedupHash = this.computeDedupHash(event);
    const eventUid = event.event_uid ? event.event_uid.trim().slice(0, 255) : null;
    const resourceType = (event.resource_type || 'Pod').slice(0, 100);
    const resourceUid = (event.resource_uid || 'unknown').slice(0, 255);
    const eventType = (event.event_type || 'Normal').slice(0, 50);
    const reason = (event.reason || 'General').slice(0, 100);
    const message = event.message || '';
    const sourceComponent = (event.source_component || 'k8s-agent').slice(0, 100);
    const reportingController = event.reporting_controller ? event.reporting_controller.slice(0, 100) : null;
    const action = event.action ? event.action.slice(0, 100) : null;
    const count = Math.max(1, Number(event.count) || 1);
    const metadata = event.metadata || {};

    let namespaceId: string | null = event.namespace_id || null;
    if (!namespaceId && metadata.namespace && event.cluster_id) {
      try {
        const nsRes = await pool.query(
          `SELECT id FROM namespaces WHERE name = $1 AND cluster_id = $2 LIMIT 1`,
          [metadata.namespace, event.cluster_id]
        );
        if (nsRes.rows.length > 0) {
          namespaceId = nsRes.rows[0].id;
        }
      } catch {
        // Fallback gracefully
      }
    }

    const query = `
      INSERT INTO kubernetes_events (
        cluster_id,
        namespace_id,
        event_uid,
        dedup_hash,
        resource_type,
        resource_uid,
        event_type,
        reason,
        message,
        source_component,
        reporting_controller,
        action,
        first_seen_at,
        last_seen_at,
        count,
        metadata,
        observed_at,
        updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW(), NOW()
      )
      ON CONFLICT (cluster_id, dedup_hash)
      DO UPDATE SET
        count = CASE 
          WHEN EXCLUDED.count > kubernetes_events.count THEN EXCLUDED.count
          ELSE kubernetes_events.count + 1
        END,
        last_seen_at = GREATEST(kubernetes_events.last_seen_at, EXCLUDED.last_seen_at),
        first_seen_at = LEAST(kubernetes_events.first_seen_at, EXCLUDED.first_seen_at),
        message = EXCLUDED.message,
        event_type = EXCLUDED.event_type,
        source_component = COALESCE(EXCLUDED.source_component, kubernetes_events.source_component),
        reporting_controller = COALESCE(EXCLUDED.reporting_controller, kubernetes_events.reporting_controller),
        action = COALESCE(EXCLUDED.action, kubernetes_events.action),
        metadata = kubernetes_events.metadata || EXCLUDED.metadata,
        updated_at = NOW()
      RETURNING id, count, (xmax = 0) AS is_new;
    `;

    const res = await pool.query(query, [
      event.cluster_id,
      namespaceId,
      eventUid,
      dedupHash,
      resourceType,
      resourceUid,
      eventType,
      reason,
      message,
      sourceComponent,
      reportingController,
      action,
      firstSeen,
      lastSeen,
      count,
      JSON.stringify(metadata),
    ]);

    return {
      id: res.rows[0].id,
      count: Number(res.rows[0].count),
      is_new: Boolean(res.rows[0].is_new),
    };
  }

  /**
   * Insert raw K8s event record (Backward compatible wrapper calling upsertEvent)
   */
  public static async create(event: IKubernetesEvent): Promise<{ id: string | number }> {
    const res = await this.upsertEvent(event);
    return { id: res.id };
  }

  /**
   * Centralized Kubernetes Events querying with filters, search, and pagination [S4][PB18] 4.1 & 4.2
   */
  public static async queryEvents(options: IKubernetesEventQueryOptions = {}): Promise<IKubernetesEventQueryResult> {
    const limit = Math.min(200, Math.max(1, Number(options.limit) || 50));
    const offset = Math.max(0, Number(options.offset) || 0);
    const page = Math.floor(offset / limit) + 1;

    const conditions: string[] = [];
    const params: any[] = [];
    let paramIdx = 1;

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    // Filter by Event Type (Normal, Warning, etc.)
    if (options.eventType && options.eventType.toUpperCase() !== 'ALL') {
      conditions.push(`e.event_type ILIKE $${paramIdx++}`);
      params.push(options.eventType.trim());
    }

    // Filter by Namespace
    if (options.namespace && options.namespace.toUpperCase() !== 'ALL') {
      const ns = options.namespace.trim();
      if (uuidRegex.test(ns)) {
        conditions.push(`(
          e.namespace_id = $${paramIdx}
          OR e.metadata->>'namespace_id' = $${paramIdx}
          OR e.metadata->>'namespace' = $${paramIdx}
        )`);
      } else {
        conditions.push(`(
          e.metadata->>'namespace' ILIKE $${paramIdx}
          OR e.namespace_id IN (SELECT id FROM namespaces WHERE name ILIKE $${paramIdx})
        )`);
      }
      params.push(ns);
      paramIdx++;
    }

    // Filter by Reason
    if (options.reason && options.reason.toUpperCase() !== 'ALL') {
      conditions.push(`e.reason ILIKE $${paramIdx++}`);
      params.push(options.reason.trim());
    }

    // Filter by Resource Type
    if (options.resourceType && options.resourceType.toUpperCase() !== 'ALL') {
      conditions.push(`e.resource_type ILIKE $${paramIdx++}`);
      params.push(options.resourceType.trim());
    }

    // Filter by Resource UID or Pod/Node
    if (options.resourceUid && options.resourceUid.toUpperCase() !== 'ALL') {
      const rUid = options.resourceUid.trim();
      conditions.push(`(
        e.resource_uid ILIKE $${paramIdx}
        OR e.metadata->>'pod_name' ILIKE $${paramIdx}
        OR e.metadata->>'pod_id' ILIKE $${paramIdx}
        OR e.metadata->>'service_id' ILIKE $${paramIdx}
      )`);
      params.push(rUid);
      paramIdx++;
    }

    // Search query in message, reason, resource_uid, and pod_name
    if (options.search && options.search.trim()) {
      const term = `%${options.search.trim()}%`;
      conditions.push(`(
        e.message ILIKE $${paramIdx}
        OR e.reason ILIKE $${paramIdx}
        OR e.resource_uid ILIKE $${paramIdx}
        OR e.metadata->>'pod_name' ILIKE $${paramIdx}
        OR e.metadata->>'service_id' ILIKE $${paramIdx}
      )`);
      params.push(term);
      paramIdx++;
    }

    // Filter by Time Range
    if (options.startTime) {
      conditions.push(`e.last_seen_at >= $${paramIdx++}`);
      params.push(options.startTime);
    }

    if (options.endTime) {
      conditions.push(`e.last_seen_at <= $${paramIdx++}`);
      params.push(options.endTime);
    }

    // Filter by Cluster ID
    if (options.clusterId && options.clusterId.toUpperCase() !== 'ALL') {
      conditions.push(`e.cluster_id::text = $${paramIdx++}`);
      params.push(options.clusterId);
    }

    // Multi-tenant organization isolation scope [S4][PB18] 4.2
    if (Array.isArray(options.allowedOrgIds) && options.allowedOrgIds.length > 0) {
      conditions.push(`(
        e.cluster_id IN (
          SELECT c.id FROM clusters c
          JOIN environments env ON c.environment_id = env.id
          WHERE env.organization_id = ANY($${paramIdx}::uuid[])
        )
        OR (e.metadata->>'organization_id') = ANY($${paramIdx}::text[])
        OR (e.metadata->>'org_id') = ANY($${paramIdx}::text[])
      )`);
      params.push(options.allowedOrgIds);
      paramIdx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // 1. Get total count
    const countQuery = `
      SELECT COUNT(*)::int as total
      FROM kubernetes_events e
      ${whereClause};
    `;
    const countRes = await pool.query(countQuery, params);
    const total = Number(countRes.rows[0]?.total || 0);

    // 2. Fetch paginated records with human-readable namespace and resource names
    const dataParams = [...params, limit, offset];
    const dataQuery = `
      SELECT 
        e.id,
        e.cluster_id,
        e.namespace_id,
        COALESCE(ns.name, e.metadata->>'namespace', 'default') as namespace,
        e.resource_type,
        e.resource_uid,
        COALESCE(e.metadata->>'pod_name', e.resource_uid) as resource_name,
        e.event_type,
        e.reason,
        e.message,
        e.source_component,
        e.count,
        e.first_seen_at,
        e.last_seen_at,
        e.metadata
      FROM kubernetes_events e
      LEFT JOIN namespaces ns ON e.namespace_id = ns.id
      ${whereClause}
      ORDER BY e.last_seen_at DESC, e.id DESC
      LIMIT $${paramIdx++} OFFSET $${paramIdx++};
    `;

    const dataRes = await pool.query(dataQuery, dataParams);
    const events: IKubernetesEventItem[] = dataRes.rows.map((row) => ({
      id: String(row.id),
      cluster_id: row.cluster_id ? String(row.cluster_id) : null,
      namespace_id: row.namespace_id ? String(row.namespace_id) : null,
      namespace: row.namespace || 'default',
      resource_type: row.resource_type || 'Pod',
      resource_uid: row.resource_uid || 'unknown',
      resource_name: row.resource_name || row.resource_uid || 'unknown',
      event_type: row.event_type || 'Normal',
      reason: row.reason || 'General',
      message: row.message || '',
      source_component: row.source_component || 'k8s-agent',
      count: Number(row.count) || 1,
      first_seen_at: row.first_seen_at ? new Date(row.first_seen_at).toISOString() : new Date().toISOString(),
      last_seen_at: row.last_seen_at ? new Date(row.last_seen_at).toISOString() : new Date().toISOString(),
      metadata: row.metadata || null,
    }));

    return {
      events,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Query Warning/Incident K8s events for RCA context (within active window)
   */
  public static async findWarningEventsByService(
    serviceId: string,
    windowMinutes: number = 30,
    limit: number = 20
  ): Promise<
    Array<{
      event_type: string;
      reason: string;
      message: string;
      first_seen_at: Date;
      last_seen_at: Date;
      count: number;
      pod_name?: string;
    }>
  > {
    const query = `
      SELECT 
        event_type,
        reason,
        message,
        first_seen_at,
        last_seen_at,
        count,
        metadata->>'pod_name' as pod_name
      FROM kubernetes_events
      WHERE metadata->>'service_id' = $1
        AND (last_seen_at >= NOW() - ($2 || ' minutes')::interval OR first_seen_at >= NOW() - ($2 || ' minutes')::interval)
        AND (
          UPPER(event_type) IN ('WARNING', 'ERROR')
          OR reason ~* '(OOM|BackOff|Failed|Unhealthy|Evicted|Killing|Crash)'
        )
      ORDER BY last_seen_at DESC
      LIMIT $3;
    `;

    const res = await pool.query(query, [serviceId, windowMinutes, limit]);
    return res.rows;
  }

  /**
   * Optional: update pod status in pods table
   */
  public static async updatePodStatus(
    podName: string,
    kubernetesUid: string,
    clusterId: string | null,
    status: string
  ): Promise<void> {
    try {
      await pool.query(
        `UPDATE pods
         SET status = $1, updated_at = NOW()
         WHERE (name = $2 OR kubernetes_uid = $3)
           AND cluster_id = $4`,
        [status, podName, kubernetesUid, clusterId]
      );
    } catch {
      // Non-critical
    }
  }

  /**
   * Get recent Kubernetes events
   */
  public static async getRecent(limit: number = 20) {
    const res = await pool.query(
      `SELECT id, event_type, reason, message, first_seen_at, last_seen_at, count, metadata
       FROM kubernetes_events
       ORDER BY last_seen_at DESC
       LIMIT $1`,
      [limit]
    );
    return res.rows;
  }
}
