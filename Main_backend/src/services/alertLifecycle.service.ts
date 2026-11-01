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
  namespace?: string | null;
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
        SELECT id, first_detected_at, last_seen_at, status, severity, details, occurrence_count
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
              organization_id: input.organization_id,
              old_status: row.status,
              new_status: row.status,
              action: 'ESCALATED',
              actor_type: 'SYSTEM',
              note: `Mức độ nghiêm trọng leo thang lên CRITICAL (giá trị: ${input.observed_value}${input.unit || ''})`,
              old_value: { severity: row.severity },
              new_value: { severity: input.severity, observed_value: input.observed_value },
              metadata: {
                old_severity: row.severity,
                new_severity: input.severity,
                observed_value: input.observed_value,
              },
            },
            client
          );
        }
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
            resource_type, resource_id, namespace, severity, status, observed_value, threshold_value,
            unit, message, details, fingerprint, occurrence_count, first_detected_at, last_seen_at, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'ACTIVE', $11, $12, $13, $14, $15, $16, 1, NOW(), NOW(), NOW(), NOW())
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
            input.namespace || input.details?.namespace || null,
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
            organization_id: input.organization_id,
            old_status: null,
            new_status: 'ACTIVE',
            action: 'TRIGGERED',
            actor_type: 'SYSTEM',
            note: `Khởi phát cảnh báo: ${input.message}`,
            old_value: {},
            new_value: {
              status: 'ACTIVE',
              severity: input.severity,
              observed_value: input.observed_value ?? null,
              threshold_value: input.threshold_value ?? null,
            },
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
          organization_id: data.organization_id,
          old_status: 'ACTIVE',
          new_status: 'RESOLVED',
          action: 'AUTO_RESOLVED',
          actor_type: 'SYSTEM',
          note: 'Rule Engine tự động giải quyết khi chỉ số trở lại bình thường',
          old_value: { status: 'ACTIVE' },
          new_value: { status: 'RESOLVED' },
        });
      } catch {
        // Non-blocking history
      }
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
   * Acknowledge an active alert with concurrency guard & audit trail
   */
  public static async acknowledgeAlert(
    id: string,
    organizationId: string,
    userId: string,
    note?: string,
    expectedVersion?: number
  ): Promise<IAlertEvent> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const lockRes = await client.query(
        `SELECT * FROM alert_events WHERE id = $1 AND organization_id = $2 FOR UPDATE`,
        [id, organizationId]
      );
      if (lockRes.rows.length === 0) {
        throw ApiError.notFound('Không tìm thấy sự kiện cảnh báo hoặc bạn không có quyền truy cập');
      }

      const existing = lockRes.rows[0];
      if (existing.status === 'RESOLVED') {
        throw ApiError.badRequest('Không thể xác nhận sự kiện cảnh báo đã được giải quyết (RESOLVED)');
      }

      const currentVersion = Number(existing.version || 1);
      if (expectedVersion !== undefined && currentVersion !== expectedVersion) {
        throw new ApiError(
          409,
          'Xung đột phiên bản: Cảnh báo đã bị thay đổi bởi thao tác khác. Vui lòng tải lại dữ liệu.'
        );
      }

      if (existing.status === 'ACKNOWLEDGED') {
        await client.query('COMMIT');
        const current = await AlertEventModel.findById(id, organizationId);
        return current!;
      }

      const detailsPatch = note ? { acknowledge_note: note } : {};
      await client.query(
        `UPDATE alert_events
         SET status = 'ACKNOWLEDGED',
             acknowledged_at = NOW(),
             acknowledged_by = $3,
             details = COALESCE(details, '{}'::jsonb) || $4::jsonb,
             version = COALESCE(version, 1) + 1,
             updated_at = NOW()
         WHERE id = $1 AND organization_id = $2`,
        [id, organizationId, userId, JSON.stringify(detailsPatch)]
      );

      await AlertEventHistoryModel.createEntry(
        {
          alert_event_id: id,
          organization_id: organizationId,
          old_status: existing.status,
          new_status: 'ACKNOWLEDGED',
          action: 'ACKNOWLEDGED',
          actor_id: userId,
          actor_type: 'USER',
          note: note || 'Tiếp nhận xử lý cảnh báo',
          old_value: { status: existing.status, acknowledged_by: existing.acknowledged_by || null },
          new_value: { status: 'ACKNOWLEDGED', acknowledged_by: userId },
        },
        client
      );

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    const updated = await AlertEventModel.findById(id, organizationId);
    if (!updated) {
      throw ApiError.internal('Lỗi khi tải lại sự kiện cảnh báo sau khi xác nhận');
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
   * Manually resolve an alert with concurrency guard, resolution_note & audit trail
   */
  public static async resolveAlertManually(
    id: string,
    organizationId: string,
    userId?: string,
    note?: string,
    expectedVersion?: number
  ): Promise<IAlertEvent> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const lockRes = await client.query(
        `SELECT * FROM alert_events WHERE id = $1 AND organization_id = $2 FOR UPDATE`,
        [id, organizationId]
      );
      if (lockRes.rows.length === 0) {
        throw ApiError.notFound('Không tìm thấy sự kiện cảnh báo hoặc bạn không có quyền truy cập');
      }

      const existing = lockRes.rows[0];
      if (existing.status === 'RESOLVED') {
        throw new ApiError(409, 'Sự kiện cảnh báo này đã được giải quyết (RESOLVED) trước đó');
      }

      const currentVersion = Number(existing.version || 1);
      if (expectedVersion !== undefined && currentVersion !== expectedVersion) {
        throw new ApiError(
          409,
          'Xung đột phiên bản: Cảnh báo đã bị thay đổi bởi thao tác khác. Vui lòng tải lại dữ liệu.'
        );
      }

      const cleanNote = note?.trim() || null;
      const detailsPatch = {
        resolved_by: userId ? `USER_${userId}` : 'MANUAL',
        resolution_note: cleanNote || 'Resolved by user',
      };

      await client.query(
        `UPDATE alert_events
         SET status = 'RESOLVED',
             resolved_at = NOW(),
             resolved_by = $3,
             resolution_note = $4,
             details = COALESCE(details, '{}'::jsonb) || $5::jsonb,
             version = COALESCE(version, 1) + 1,
             updated_at = NOW()
         WHERE id = $1 AND organization_id = $2`,
        [id, organizationId, userId || null, cleanNote, JSON.stringify(detailsPatch)]
      );

      await AlertEventHistoryModel.createEntry(
        {
          alert_event_id: id,
          organization_id: organizationId,
          old_status: existing.status,
          new_status: 'RESOLVED',
          action: 'RESOLVED',
          actor_id: userId,
          actor_type: 'USER',
          note: cleanNote || 'Giải quyết cảnh báo thủ công từ giao diện',
          old_value: { status: existing.status, resolved_by: existing.resolved_by || null },
          new_value: {
            status: 'RESOLVED',
            resolved_by: userId || null,
            resolution_note: cleanNote,
          },
        },
        client
      );

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    const updated = await AlertEventModel.findById(id, organizationId);
    if (!updated) {
      throw ApiError.internal('Lỗi khi tải lại sự kiện cảnh báo sau khi giải quyết');
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
   * Assign or reassign an alert to an active organization member
   */
  public static async assignAlert(
    id: string,
    organizationId: string,
    assignedTo: string,
    actorId: string,
    note?: string,
    expectedVersion?: number
  ): Promise<IAlertEvent> {
    const memberCheck = await pool.query(
      `SELECT u.id, u.full_name, u.email
       FROM organization_members om
       JOIN users u ON u.id = om.user_id
       WHERE om.organization_id = $1
         AND om.user_id = $2
         AND om.status = 'ACTIVE'
         AND u.status = 'ACTIVE'
         AND u.deleted_at IS NULL
       LIMIT 1`,
      [organizationId, assignedTo]
    );
    if (memberCheck.rows.length === 0) {
      throw ApiError.badRequest(
        'Người dùng được phân công không tồn tại hoặc không thuộc tổ chức đang hoạt động'
      );
    }
    const targetMember = memberCheck.rows[0];

    let actionType: 'ASSIGNED' | 'REASSIGNED' = 'ASSIGNED';
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const lockRes = await client.query(
        `SELECT ae.*, ua.full_name AS prev_assignee_name, ua.email AS prev_assignee_email
         FROM alert_events ae
         LEFT JOIN users ua ON ae.assigned_to = ua.id
         WHERE ae.id = $1 AND ae.organization_id = $2
         FOR UPDATE OF ae`,
        [id, organizationId]
      );
      if (lockRes.rows.length === 0) {
        throw ApiError.notFound('Không tìm thấy sự kiện cảnh báo hoặc bạn không có quyền truy cập');
      }

      const existing = lockRes.rows[0];
      const currentVersion = Number(existing.version || 1);
      if (expectedVersion !== undefined && currentVersion !== expectedVersion) {
        throw new ApiError(
          409,
          'Xung đột phiên bản: Cảnh báo đã bị thay đổi bởi thao tác khác. Vui lòng tải lại dữ liệu.'
        );
      }

      actionType = existing.assigned_to ? 'REASSIGNED' : 'ASSIGNED';

      await client.query(
        `UPDATE alert_events
         SET assigned_to = $3,
             assigned_by = $4,
             assigned_at = NOW(),
             version = COALESCE(version, 1) + 1,
             updated_at = NOW()
         WHERE id = $1 AND organization_id = $2`,
        [id, organizationId, assignedTo, actorId]
      );

      await AlertEventHistoryModel.createEntry(
        {
          alert_event_id: id,
          organization_id: organizationId,
          old_status: existing.status,
          new_status: existing.status,
          action: actionType,
          actor_id: actorId,
          actor_type: 'USER',
          note:
            note?.trim() ||
            (actionType === 'REASSIGNED'
              ? `Chuyển giao phụ trách sang ${targetMember.full_name || targetMember.email}`
              : `Phân công phụ trách cho ${targetMember.full_name || targetMember.email}`),
          old_value: {
            assigned_to: existing.assigned_to || null,
            assignee_name: existing.prev_assignee_name || existing.prev_assignee_email || null,
          },
          new_value: {
            assigned_to: assignedTo,
            assignee_name: targetMember.full_name || targetMember.email,
          },
        },
        client
      );

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    const updated = await AlertEventModel.findById(id, organizationId);
    if (!updated) {
      throw ApiError.internal('Lỗi khi tải lại cảnh báo sau khi phân công');
    }

    try {
      broadcastTelemetryToUi({
        type: 'alert_updated',
        action: actionType,
        organization_id: organizationId,
        alert_id: updated.id,
        status: updated.status,
        timestamp: new Date().toISOString(),
      });
    } catch {
      // Non-blocking
    }
    return updated;
  }

  /**
   * Unassign an alert and record audit trail
   */
  public static async unassignAlert(
    id: string,
    organizationId: string,
    actorId: string,
    note?: string,
    expectedVersion?: number
  ): Promise<IAlertEvent> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const lockRes = await client.query(
        `SELECT ae.*, ua.full_name AS prev_assignee_name, ua.email AS prev_assignee_email
         FROM alert_events ae
         LEFT JOIN users ua ON ae.assigned_to = ua.id
         WHERE ae.id = $1 AND ae.organization_id = $2
         FOR UPDATE OF ae`,
        [id, organizationId]
      );
      if (lockRes.rows.length === 0) {
        throw ApiError.notFound('Không tìm thấy sự kiện cảnh báo hoặc bạn không có quyền truy cập');
      }

      const existing = lockRes.rows[0];
      const currentVersion = Number(existing.version || 1);
      if (expectedVersion !== undefined && currentVersion !== expectedVersion) {
        throw new ApiError(
          409,
          'Xung đột phiên bản: Cảnh báo đã bị thay đổi bởi thao tác khác. Vui lòng tải lại dữ liệu.'
        );
      }

      await client.query(
        `UPDATE alert_events
         SET assigned_to = NULL,
             assigned_by = $3,
             assigned_at = NULL,
             version = COALESCE(version, 1) + 1,
             updated_at = NOW()
         WHERE id = $1 AND organization_id = $2`,
        [id, organizationId, actorId]
      );

      await AlertEventHistoryModel.createEntry(
        {
          alert_event_id: id,
          organization_id: organizationId,
          old_status: existing.status,
          new_status: existing.status,
          action: 'UNASSIGNED',
          actor_id: actorId,
          actor_type: 'USER',
          note: note?.trim() || 'Hủy phân công người phụ trách',
          old_value: {
            assigned_to: existing.assigned_to || null,
            assignee_name: existing.prev_assignee_name || existing.prev_assignee_email || null,
          },
          new_value: {
            assigned_to: null,
            assignee_name: null,
          },
        },
        client
      );

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    const updated = await AlertEventModel.findById(id, organizationId);
    if (!updated) {
      throw ApiError.internal('Lỗi khi tải lại cảnh báo sau khi hủy phân công');
    }

    try {
      broadcastTelemetryToUi({
        type: 'alert_updated',
        action: 'UNASSIGNED',
        organization_id: organizationId,
        alert_id: updated.id,
        status: updated.status,
        timestamp: new Date().toISOString(),
      });
    } catch {
      // Non-blocking
    }
    return updated;
  }

  /**
   * Get paginated audit trail of an alert event (PBI22 Task 4.3)
   */
  public static async getAlertAuditTrail(
    alertEventId: string,
    organizationId: string,
    options: { page?: number; limit?: number; order?: string } = {}
  ) {
    const alert = await AlertEventModel.findById(alertEventId, organizationId);
    if (!alert) {
      throw ApiError.notFound('Không tìm thấy sự kiện cảnh báo hoặc bạn không có quyền truy cập');
    }
    return AlertEventHistoryModel.getAuditTrail(alertEventId, options);
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
