import { AlertEventModel, IAlertEvent, IAlertEventFilters, IPaginatedAlertEvents } from '../models/alertEvent.model';
import { AlertEventHistoryModel, IAlertEventHistory } from '../models/alertEventHistory.model';
import { AlertHistoryQuery } from '../schemas/alertHistory.schema';
import { AlertEventCategory, AlertEventStatus } from '../schemas/alertEvent.schema';
import { AlertSeverity } from '../schemas/alertRule.schema';
import { ApiError } from '../utils/apiError';
import { pool } from '../config/database';
import { ConditionEvaluator } from './evaluators/conditionEvaluator.service';
import { broadcastTelemetryToUi } from '../websocket/telemetryWebSocket';

export interface IAlertTriggerInput {
  organization_id: string;
  cluster_id?: string | null;
  rule_id?: string | null;
  rule_name: string;
  category: AlertEventCategory;
  metric_type: string;
  resource_type: string;
  resource_id: string;
  severity: AlertSeverity;
  observed_value?: number | null;
  threshold_value?: number | null;
  unit?: string | null;
  message: string;
  details?: Record<string, any>;
  cooldown_seconds?: number;
  fingerprint?: string | null;
}

export interface IAlertTriggerResult {
  event: IAlertEvent;
  isNew: boolean;
  cooldownActive: boolean;
}

export class AlertLifecycleService {
  /**
   * Record an alert trigger with deduplication and cooldown tracking
   */
  public static async recordAlertTrigger(input: IAlertTriggerInput): Promise<IAlertTriggerResult> {
    const cooldownSec = input.cooldown_seconds ?? 300;
    const fingerprint =
      input.fingerprint ||
      ConditionEvaluator.computeFingerprint(
        input.organization_id,
        input.cluster_id,
        input.rule_id,
        input.resource_type,
        input.resource_id,
        input.metric_type
      );

    // Check if open alert event exists
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const checkQuery = `
        SELECT id, first_detected_at, last_seen_at, status, details, occurrence_count
        FROM alert_events
        WHERE organization_id = $1
          AND COALESCE(cluster_id, '00000000-0000-0000-0000-000000000000'::uuid) = COALESCE($2, '00000000-0000-0000-0000-000000000000'::uuid)
          AND COALESCE(rule_id, '00000000-0000-0000-0000-000000000000'::uuid) = COALESCE($3, '00000000-0000-0000-0000-000000000000'::uuid)
          AND resource_type = $4
          AND resource_id = $5
          AND metric_type = $6
          AND status != 'RESOLVED'
        LIMIT 1
        FOR UPDATE;
      `;
      const existing = await client.query(checkQuery, [
        input.organization_id,
        input.cluster_id || null,
        input.rule_id || null,
        input.resource_type,
        input.resource_id,
        input.metric_type,
      ]);

      let isNew = false;
      let cooldownActive = false;
      let event: IAlertEvent;

      if (existing.rows.length > 0) {
        const row = existing.rows[0];
        const lastNotifiedAt = row.details?.last_notified_at
          ? new Date(row.details.last_notified_at).getTime()
          : new Date(row.first_detected_at).getTime();
        const now = Date.now();
        const elapsedSeconds = (now - lastNotifiedAt) / 1000;

        cooldownActive = elapsedSeconds < cooldownSec;

        const updatedDetails = {
          ...(input.details || {}),
          ...row.details,
          trigger_count: (row.details?.trigger_count || 1) + 1,
          last_trigger_at: new Date().toISOString(),
          cooldown_active: cooldownActive,
        };

        if (!cooldownActive) {
          updatedDetails.last_notified_at = new Date().toISOString();
        }

        const updateRes = await client.query(
          `
          UPDATE alert_events
          SET last_seen_at = NOW(),
              observed_value = $1,
              threshold_value = $2,
              message = $3,
              details = $4,
              occurrence_count = occurrence_count + 1,
              updated_at = NOW()
          WHERE id = $5
          RETURNING *;
          `,
          [
            input.observed_value ?? null,
            input.threshold_value ?? null,
            input.message,
            JSON.stringify(updatedDetails),
            row.id,
          ]
        );

        event = {
          ...updateRes.rows[0],
          observed_value: updateRes.rows[0].observed_value !== null ? Number(updateRes.rows[0].observed_value) : null,
          threshold_value: updateRes.rows[0].threshold_value !== null ? Number(updateRes.rows[0].threshold_value) : null,
          occurrence_count: Number(updateRes.rows[0].occurrence_count || 1),
        };

        if (row.severity === 'WARNING' && input.severity === 'CRITICAL') {
          await AlertEventHistoryModel.createEntry(
            {
              alert_event_id: event.id,
              old_status: row.status,
              new_status: row.status,
              action: 'ESCALATED',
              actor_type: 'SYSTEM',
              note: `Mức độ nghiêm trọng leo thang lên CRITICAL (giá trị: ${input.observed_value}${input.unit || ''})`,
              metadata: {
                old_severity: row.severity,
                new_severity: input.severity,
                observed_value: input.observed_value,
              },
            },
            client
          );
        };
      } else {
        isNew = true;
        cooldownActive = false;
        const initialDetails = {
          ...(input.details || {}),
          trigger_count: 1,
          first_notified_at: new Date().toISOString(),
          last_notified_at: new Date().toISOString(),
          cooldown_active: false,
        };

        const insertRes = await client.query(
          `
          INSERT INTO alert_events (
            organization_id, cluster_id, rule_id, rule_name, category, metric_type,
            resource_type, resource_id, severity, status, observed_value, threshold_value,
            unit, message, details, fingerprint, occurrence_count, first_detected_at, last_seen_at, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'ACTIVE', $10, $11, $12, $13, $14, $15, 1, NOW(), NOW(), NOW(), NOW())
          RETURNING *;
          `,
          [
            input.organization_id,
            input.cluster_id || null,
            input.rule_id || null,
            input.rule_name,
            input.category,
            input.metric_type,
            input.resource_type,
            input.resource_id,
            input.severity,
            input.observed_value ?? null,
            input.threshold_value ?? null,
            input.unit || null,
            input.message,
            JSON.stringify(initialDetails),
            fingerprint,
          ]
        );

        event = {
          ...insertRes.rows[0],
          observed_value: insertRes.rows[0].observed_value !== null ? Number(insertRes.rows[0].observed_value) : null,
          threshold_value: insertRes.rows[0].threshold_value !== null ? Number(insertRes.rows[0].threshold_value) : null,
          occurrence_count: Number(insertRes.rows[0].occurrence_count || 1),
        };

        await AlertEventHistoryModel.createEntry(
          {
            alert_event_id: event.id,
            old_status: null,
            new_status: 'ACTIVE',
            action: 'TRIGGERED',
            actor_type: 'SYSTEM',
            note: `Khởi phát cảnh báo: ${input.message}`,
            metadata: {
              observed_value: input.observed_value,
              threshold_value: input.threshold_value,
              severity: input.severity,
            },
          },
          client
        );
      }

      await client.query('COMMIT');
      try {
        broadcastTelemetryToUi({
          type: 'alert_updated',
          action: isNew ? 'TRIGGERED' : 'UPDATED',
          organization_id: input.organization_id,
          cluster_id: input.cluster_id || null,
          alert_id: event.id,
          severity: event.severity,
          status: event.status,
          timestamp: new Date().toISOString(),
        });
      } catch {
        // Non-blocking
      }
      return { event, isNew, cooldownActive };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Auto-resolve an alert event when health checks pass or metrics drop below threshold
   */
  public static async autoResolveAlert(data: {
    organization_id: string;
    cluster_id?: string | null;
    rule_id?: string | null;
    resource_type: string;
    resource_id: string;
    metric_type: string;
    resolution_details?: Record<string, any>;
  }): Promise<IAlertEvent | null> {
    const fingerprint = ConditionEvaluator.computeFingerprint(
      data.organization_id,
      data.cluster_id,
      data.rule_id,
      data.resource_type,
      data.resource_id,
      data.metric_type
    );
    await ConditionEvaluator.clearPendingState(fingerprint);
    const resolved = await AlertEventModel.resolveOpenEvent(data);
    if (resolved) {
      try {
        await AlertEventHistoryModel.createEntry({
          alert_event_id: resolved.id,
          old_status: 'ACTIVE',
          new_status: 'RESOLVED',
          action: 'AUTO_RESOLVED',
          actor_type: 'SYSTEM',
          note: 'Rule Engine tự động giải quyết khi chỉ số trở lại bình thường',
        });
      } catch {
        // Non-blocking history
      }
    }
    if (resolved) {
      try {
        broadcastTelemetryToUi({
          type: 'alert_updated',
          action: 'AUTO_RESOLVED',
          organization_id: data.organization_id,
          cluster_id: data.cluster_id || null,
          alert_id: resolved.id,
          status: 'RESOLVED',
          timestamp: new Date().toISOString(),
        });
      } catch {
        // Non-blocking
      }
    }
    return resolved;
  }

  /**
   * Acknowledge an active alert
   */
  public static async acknowledgeAlert(
    id: string,
    organizationId: string,
    userId: string,
    note?: string
  ): Promise<IAlertEvent> {
    const existing = await AlertEventModel.findById(id, organizationId);
    if (!existing) {
      throw ApiError.notFound('Không tìm thấy sự kiện cảnh báo hoặc bạn không có quyền truy cập');
    }

    if (existing.status === 'RESOLVED') {
      throw ApiError.badRequest('Không thể xác nhận sự kiện cảnh báo đã được giải quyết (RESOLVED)');
    }

    if (existing.status === 'ACKNOWLEDGED') {
      return existing;
    }

    const updated = await AlertEventModel.acknowledgeEvent(id, organizationId, userId, note);
    if (updated) {
      try {
        await AlertEventHistoryModel.createEntry({
          alert_event_id: id,
          old_status: 'ACTIVE',
          new_status: 'ACKNOWLEDGED',
          action: 'ACKNOWLEDGED',
          actor_id: userId,
          actor_type: 'USER',
          note: note || 'Tiếp nhận xử lý cảnh báo',
        });
      } catch {
        // Non-blocking history
      }
    }
    if (!updated) {
      throw ApiError.internal('Lỗi khi cập nhật trạng thái xác nhận sự kiện cảnh báo');
    }
    try {
      broadcastTelemetryToUi({
        type: 'alert_updated',
        action: 'ACKNOWLEDGED',
        organization_id: organizationId,
        alert_id: updated.id,
        status: 'ACKNOWLEDGED',
        timestamp: new Date().toISOString(),
      });
    } catch {
      // Non-blocking
    }
    return updated;
  }

  /**
   * Manually resolve an alert
   */
  public static async resolveAlertManually(
    id: string,
    organizationId: string,
    userId?: string,
    note?: string
  ): Promise<IAlertEvent> {
    const existing = await AlertEventModel.findById(id, organizationId);
    if (!existing) {
      throw ApiError.notFound('Không tìm thấy sự kiện cảnh báo hoặc bạn không có quyền truy cập');
    }

    if (existing.status === 'RESOLVED') {
      return existing;
    }

    const updated = await AlertEventModel.resolveEventById(id, organizationId, userId, note);
    if (updated) {
      try {
        await AlertEventHistoryModel.createEntry({
          alert_event_id: id,
          old_status: existing.status,
          new_status: 'RESOLVED',
          action: 'RESOLVED',
          actor_id: userId,
          actor_type: 'USER',
          note: note || 'Giải quyết cảnh báo thủ công từ giao diện',
        });
      } catch {
        // Non-blocking history
      }
    }
    if (!updated) {
      throw ApiError.internal('Lỗi khi giải quyết sự kiện cảnh báo');
    }
    try {
      broadcastTelemetryToUi({
        type: 'alert_updated',
        action: 'RESOLVED',
        organization_id: organizationId,
        alert_id: updated.id,
        status: 'RESOLVED',
        timestamp: new Date().toISOString(),
      });
    } catch {
      // Non-blocking
    }
    return updated;
  }

  /**
   * Get alert events with organization isolation and filtering
   */
  public static async getAlertEvents(
    organizationId: string,
    filters: IAlertEventFilters = {}
  ): Promise<IPaginatedAlertEvents> {
    return AlertEventModel.findByOrg(organizationId, filters);
  }

  /**
   * Get alert event by ID with organization isolation
   */
  public static async getAlertEventById(id: string, organizationId: string): Promise<IAlertEvent> {
    const event = await AlertEventModel.findById(id, organizationId);
    if (!event) {
      throw ApiError.notFound('Không tìm thấy sự kiện cảnh báo hoặc bạn không có quyền truy cập');
    }
    return event;
  }

  /**
   * Get alert summary metrics for dashboard with organization isolation
   */
  /**
   * Get paginated alert history with full filters (PBI22 Task 4.2)
   */
  public static async getAlertHistory(
    organizationId: string,
    filters: AlertHistoryQuery
  ) {
    return AlertEventModel.findHistory(organizationId, filters);
  }

  /**
   * Get alert history summary metrics (PBI22 Task 4.2)
   */
  public static async getAlertHistorySummary(
    organizationId: string,
    options: { clusterId?: string; startDate?: string; endDate?: string } = {}
  ) {
    return AlertEventModel.getHistorySummary(organizationId, options);
  }

  /**
   * Get full lifecycle timeline of an alert event
   */
  public static async getAlertTimeline(
    alertEventId: string,
    organizationId: string
  ): Promise<IAlertEventHistory[]> {
    const alert = await AlertEventModel.findById(alertEventId, organizationId);
    if (!alert) {
      throw ApiError.notFound('Không tìm thấy sự kiện cảnh báo hoặc bạn không có quyền truy cập');
    }
    return AlertEventHistoryModel.findByAlertEventId(alertEventId);
  }

  public static async getSummary(
    organizationId: string,
    options: { clusterId?: string; from?: string; to?: string } = {}
  ) {
    return AlertEventModel.getAlertSummary(organizationId, options);
  }
}
