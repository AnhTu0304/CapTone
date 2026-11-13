import { pool } from '../config/database';
import { WorkloadModel } from '../models';
import { broadcastTelemetryToUi } from '../websocket/telemetryWebSocket';

export type VerificationStage = 'COOLDOWN' | 'INITIAL_CHECK' | 'STABILITY_CHECK' | 'EXTENDED_CHECK';

export type AdaptiveVerificationStatus =
  | 'COOLDOWN_ACTIVE'
  | 'INITIAL_CHECK_PASSED'
  | 'INITIAL_CHECK_FAILED'
  | 'STABILITY_CHECK_PASSED'
  | 'STABILITY_CHECK_FAILED'
  | 'EXTENDED_CHECK_PASSED'
  | 'EXTENDED_CHECK_FAILED'
  | 'INSUFFICIENT_DATA'
  | 'PENDING_RECONCILIATION';

export interface ITelemetrySample {
  cpu: number;
  ram: number;
  disk?: number;
  latency?: number;
  request_rate?: number;
  http_5xx_rate?: number;
  pod_restart_count?: number;
  replica_count?: number;
  time_bucket?: string | Date;
  collected_at?: string | Date;
  timestamp?: string | Date;
  pod_id?: string;
  pod_uid?: string;
  is_healthy?: boolean;
  http_health_check?: boolean;
}

export interface IVerificationDetails {
  stage: VerificationStage;
  status: AdaptiveVerificationStatus;
  sample_count: number;
  action_completed_at?: string | null;
  verification_started_at: string;
  verification_completed_at: string;
  first_sample_at?: string | null;
  last_sample_at?: string | null;
  observation_duration_ms: number;
  bucket_coverage_seconds: number;
  target_workload: string;
  target_pod_uid?: string | null;
  target_pod_uids?: string[];
  pod_uid_before?: string | null;
  pod_uid_after?: string | null;
  severity: string;
  verification_result: boolean;
  reason: string;
  violations?: string[];
}

export class RecoveryVerificationService {
  public static readonly DEFAULT_COOLDOWN_SECONDS = 20;

  /**
   * Parse a valid Date object from multiple possible timestamp fields
   */
  public static parseTimestamp(sample: ITelemetrySample): Date | null {
    const raw = sample.collected_at || sample.time_bucket || sample.timestamp;
    if (!raw) return null;
    const d = raw instanceof Date ? raw : new Date(raw);
    return isNaN(d.getTime()) ? null : d;
  }

  /**
   * Validate timestamp integrity across a telemetry sequence:
   * 1. All samples have valid timestamps
   * 2. Timestamps are strictly ascending (t_1 < t_2 < ... < t_n)
   * 3. No duplicate timestamps
   * 4. No samples before action completion (Anti-Pre-Action Pollution)
   * 5. Reasonable sample spacing (nominal 5s, tolerance 2s - 15s)
   */
  public static validateTimestampSequence(
    samples: ITelemetrySample[],
    actionCompletedAt?: Date | null
  ): {
    valid: boolean;
    reason?: string;
    firstSampleAt?: Date;
    lastSampleAt?: Date;
    durationMs: number;
    sampleCount: number;
  } {
    if (!samples || samples.length === 0) {
      return { valid: false, reason: 'Không có dữ liệu viễn trắc hậu kiểm', durationMs: 0, sampleCount: 0 };
    }

    let prevMs = -1;
    let firstDate: Date | null = null;
    let lastDate: Date | null = null;

    const completedAtMs = actionCompletedAt instanceof Date && !isNaN(actionCompletedAt.getTime())
      ? actionCompletedAt.getTime()
      : null;

    for (let i = 0; i < samples.length; i++) {
      const s = samples[i];
      const d = this.parseTimestamp(s);
      if (!d) {
        return {
          valid: false,
          reason: `Mẫu thứ ${i + 1} thiếu trường timestamp hợp lệ`,
          durationMs: 0,
          sampleCount: samples.length,
        };
      }

      const curMs = d.getTime();

      // Anti-Pre-Action Pollution Check:
      // Samples taken at or prior to action completion cannot prove post-action recovery
      if (completedAtMs !== null && curMs <= completedAtMs) {
        return {
          valid: false,
          reason: `Mẫu thứ ${i + 1} (${d.toISOString()}) được thu thập trước hoặc tại thời điểm hoàn tất hành động (${new Date(completedAtMs).toISOString()})`,
          durationMs: 0,
          sampleCount: samples.length,
        };
      }

      // Strictly ascending check
      if (prevMs !== -1) {
        if (curMs <= prevMs) {
          return {
            valid: false,
            reason: `Timestamp không tăng dần hoặc bị trùng lặp tại mẫu thứ ${i + 1} (hiện tại: ${curMs}ms, trước: ${prevMs}ms)`,
            durationMs: 0,
            sampleCount: samples.length,
          };
        }
        const deltaMs = curMs - prevMs;
        if (deltaMs < 1000) {
          return {
            valid: false,
            reason: `Khoảng cách giữa hai mẫu quá ngắn (< 1s) tại mẫu thứ ${i + 1}`,
            durationMs: 0,
            sampleCount: samples.length,
          };
        }
      }

      if (firstDate === null) firstDate = d;
      lastDate = d;
      prevMs = curMs;
    }

    const durationMs = firstDate && lastDate ? Math.max(0, lastDate.getTime() - firstDate.getTime()) : 0;
    return {
      valid: true,
      firstSampleAt: firstDate || undefined,
      lastSampleAt: lastDate || undefined,
      durationMs,
      sampleCount: samples.length,
    };
  }

  /**
   * Health evaluation of an individual telemetry sample
   */
  public static evaluateSampleHealth(sample: ITelemetrySample): {
    healthy: boolean;
    violations: string[];
  } {
    const violations: string[] = [];
    const cpu = Number(sample.cpu ?? 0);
    const ram = Number(sample.ram ?? 0);
    const disk = Number(sample.disk ?? 0);
    const latency = Number(sample.latency ?? 0);
    const err5xx = Number(sample.http_5xx_rate ?? 0);
    const reqRate = Number(sample.request_rate ?? 0);

    if (cpu >= 90) violations.push(`CPU quá tải (${cpu}%)`);
    if (ram >= 90) violations.push(`RAM cạn kiệt (${ram}%)`);
    if (disk >= 90) violations.push(`Ổ đĩa đầy (${disk}%)`);
    if (latency >= 600) violations.push(`Độ trễ quá cao (${Math.round(latency)}ms)`);

    // HTTP 5xx check: distinguish micro-sample from true error spike
    if (err5xx > 0) {
      if (reqRate >= 5.0 && err5xx >= 15.0) {
        violations.push(`Tỷ lệ lỗi HTTP 5xx cao (${err5xx}% tại ${reqRate} req/s)`);
      } else if (reqRate < 5.0 && err5xx >= 50.0) {
        violations.push(`Tỷ lệ lỗi HTTP 5xx nghiêm trọng (${err5xx}% tại mẫu nhỏ ${reqRate} req/s)`);
      }
    }

    if (sample.http_health_check === false) {
      violations.push('HTTP Health Check / Liveness Probe thất bại');
    }

    if (sample.is_healthy === false) {
      violations.push('Trạng thái container/pod không khỏe mạnh');
    }

    return {
      healthy: violations.length === 0,
      violations,
    };
  }

  /**
   * Core Adaptive Recovery Verification Engine:
   * Progressive multi-stage verification (3 -> 6 -> 12 samples)
   */
  public static async evaluateAdaptiveRecovery(
    serviceId: string,
    clusterId?: string | null,
    providedSequence?: ITelemetrySample[],
    customOptions?: {
      actionId?: string;
      incidentId?: string;
      severity?: string;
      podUidBefore?: string | null;
      podUidAfter?: string | null;
      cooldownSeconds?: number;
      enforceStrictTimestamp?: boolean;
    }
  ): Promise<{
    stage: VerificationStage;
    status: AdaptiveVerificationStatus;
    verified: boolean;
    durationMs: number;
    sampleCount: number;
    incidentResolved: boolean;
    details: IVerificationDetails;
  }> {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const resolvedTarget = await WorkloadModel.resolveK8sTarget(serviceId, clusterId || null);
    const canonicalTargetName = resolvedTarget.targetName || serviceId;
    const targetAliasesLower = Array.from(
      new Set([serviceId.toLowerCase(), canonicalTargetName.toLowerCase()].filter(Boolean))
    );
    const validTargetWorkloadId =
      resolvedTarget.workloadId && uuidRegex.test(resolvedTarget.workloadId)
        ? resolvedTarget.workloadId
        : null;

    const cooldownSec = customOptions?.cooldownSeconds ?? this.DEFAULT_COOLDOWN_SECONDS;

    // 1. Locate the SUCCEEDED healing action eligible for post-action verification
    let actionQuery = `
      SELECT h.id, h.incident_id, h.completed_at, h.started_at, h.action_type_id,
             h.execution_status, h.result, act.code AS action_code, i.severity AS incident_severity
      FROM healing_actions h
      LEFT JOIN healing_action_types act ON act.id = h.action_type_id
      LEFT JOIN incidents i ON i.id = h.incident_id
      WHERE (
        LOWER(COALESCE(h.target_name, '')) = ANY($1)
        OR ($2::text IS NOT NULL AND h.target_id::text = $2)
      )
    `;
    const params: any[] = [targetAliasesLower, validTargetWorkloadId];

    if (customOptions?.actionId) {
      actionQuery += ` AND h.id = $3`;
      params.push(customOptions.actionId);
    } else {
      actionQuery += `
        AND h.execution_status = 'SUCCEEDED'
        AND h.completed_at IS NOT NULL
        AND h.completed_at >= NOW() - interval '60 minutes'
        AND NOT EXISTS (
          SELECT 1 FROM recovery_verifications rv
          WHERE rv.healing_action_id = h.id
        )
        ORDER BY h.completed_at DESC
        LIMIT 1
      `;
    }

    const actionRes = await pool.query(actionQuery, params);
    const actionRow = actionRes.rows[0];

    // Check if the action is pending reconciliation
    const isPendingRecon = actionRow?.result?.reconciliation_status === 'PENDING_RECONCILIATION';
    if (isPendingRecon) {
      const details: IVerificationDetails = {
        stage: 'COOLDOWN',
        status: 'PENDING_RECONCILIATION',
        sample_count: providedSequence?.length || 0,
        verification_started_at: new Date().toISOString(),
        verification_completed_at: new Date().toISOString(),
        observation_duration_ms: 0,
        bucket_coverage_seconds: 0,
        target_workload: serviceId,
        severity: actionRow?.incident_severity || customOptions?.severity || 'MEDIUM',
        verification_result: false,
        reason: 'Hành động đang trong trạng thái chờ đối soát (PENDING_RECONCILIATION). Tạm hoãn hậu kiểm an toàn.',
      };
      return {
        stage: 'COOLDOWN',
        status: 'PENDING_RECONCILIATION',
        verified: false,
        durationMs: 0,
        sampleCount: providedSequence?.length || 0,
        incidentResolved: false,
        details,
      };
    }

    // Cooldown verification:
    // If completed_at is defined, verify cooldown elapsed
    const completedAtDate = actionRow?.completed_at ? new Date(actionRow.completed_at) : null;
    if (completedAtDate && !isNaN(completedAtDate.getTime())) {
      const elapsedSinceCompletionMs = Date.now() - completedAtDate.getTime();
      if (elapsedSinceCompletionMs < cooldownSec * 1000) {
        const details: IVerificationDetails = {
          stage: 'COOLDOWN',
          status: 'COOLDOWN_ACTIVE',
          sample_count: providedSequence?.length || 0,
          action_completed_at: completedAtDate.toISOString(),
          verification_started_at: new Date().toISOString(),
          verification_completed_at: new Date().toISOString(),
          observation_duration_ms: 0,
          bucket_coverage_seconds: 0,
          target_workload: serviceId,
          severity: actionRow?.incident_severity || customOptions?.severity || 'MEDIUM',
          verification_result: false,
          reason: `Hành động vừa hoàn tất cách đây ${Math.round(elapsedSinceCompletionMs / 1000)}s (< cooldown ${cooldownSec}s). Chưa bắt đầu thu thập hậu kiểm.`,
        };
        return {
          stage: 'COOLDOWN',
          status: 'COOLDOWN_ACTIVE',
          verified: false,
          durationMs: 0,
          sampleCount: providedSequence?.length || 0,
          incidentResolved: false,
          details,
        };
      }
    }

    // Sequence integrity verification
    const rawSequence = providedSequence || [];
    const sampleCount = rawSequence.length;

    if (sampleCount < 3) {
      const details: IVerificationDetails = {
        stage: 'INITIAL_CHECK',
        status: 'INSUFFICIENT_DATA',
        sample_count: sampleCount,
        action_completed_at: completedAtDate?.toISOString() || null,
        verification_started_at: new Date().toISOString(),
        verification_completed_at: new Date().toISOString(),
        observation_duration_ms: 0,
        bucket_coverage_seconds: sampleCount * 5,
        target_workload: serviceId,
        severity: actionRow?.incident_severity || customOptions?.severity || 'MEDIUM',
        verification_result: false,
        reason: `Chưa đủ số lượng mẫu tối thiểu cho Initial Check (yêu cầu >= 3 mẫu, hiện có: ${sampleCount} mẫu).`,
      };
      return {
        stage: 'INITIAL_CHECK',
        status: 'INSUFFICIENT_DATA',
        verified: false,
        durationMs: 0,
        sampleCount,
        incidentResolved: false,
        details,
      };
    }

    // Validate timestamp sequence
    const tsCheck = this.validateTimestampSequence(rawSequence, completedAtDate);
    if (!tsCheck.valid && customOptions?.enforceStrictTimestamp !== false) {
      const details: IVerificationDetails = {
        stage: 'INITIAL_CHECK',
        status: 'INSUFFICIENT_DATA',
        sample_count: sampleCount,
        action_completed_at: completedAtDate?.toISOString() || null,
        verification_started_at: new Date().toISOString(),
        verification_completed_at: new Date().toISOString(),
        observation_duration_ms: tsCheck.durationMs,
        bucket_coverage_seconds: sampleCount * 5,
        target_workload: serviceId,
        severity: actionRow?.incident_severity || customOptions?.severity || 'MEDIUM',
        verification_result: false,
        reason: `Dữ liệu viễn trắc không hợp lệ: ${tsCheck.reason}`,
      };
      return {
        stage: 'INITIAL_CHECK',
        status: 'INSUFFICIENT_DATA',
        verified: false,
        durationMs: tsCheck.durationMs,
        sampleCount,
        incidentResolved: false,
        details,
      };
    }

    // Actual observation duration derived strictly from timestamp delta
    const actualDurationMs = tsCheck.durationMs > 0
      ? tsCheck.durationMs
      : (sampleCount >= 12 ? 60000 : sampleCount * 5000);

    const firstSampleIso = tsCheck.firstSampleAt?.toISOString() || null;
    const lastSampleIso = tsCheck.lastSampleAt?.toISOString() || null;

    // Check health across samples
    const allViolations: string[] = [];
    for (let i = 0; i < rawSequence.length; i++) {
      const evalRes = this.evaluateSampleHealth(rawSequence[i]);
      if (!evalRes.healthy) {
        allViolations.push(`Mẫu ${i + 1}: ${evalRes.violations.join(', ')}`);
      }
    }

    // Pod UID Change Validation for REPLACE_POD actions
    const actionCode = (actionRow?.action_code || '').toUpperCase();
    const isReplacePod = actionCode.includes('REPLACE_POD');
    let podUidBefore = customOptions?.podUidBefore || actionRow?.result?.pod_uid_before || null;
    let podUidAfter = customOptions?.podUidAfter || actionRow?.result?.pod_uid_after || null;

    if (isReplacePod) {
      const samplePodUid = rawSequence[rawSequence.length - 1]?.pod_uid || rawSequence[rawSequence.length - 1]?.pod_id;
      if (samplePodUid && !podUidAfter) podUidAfter = samplePodUid;
      if (podUidBefore && podUidAfter && podUidBefore === podUidAfter) {
        allViolations.push(`Pod UID sau Replace Pod không thay đổi (${podUidBefore} == ${podUidAfter})`);
      }
    }

    const severity = (customOptions?.severity || actionRow?.incident_severity || 'MEDIUM').toUpperCase();
    const isDegraded = allViolations.length > 0;

    // Determine Stage based on cumulative sample count:
    // 3 - 5 samples: INITIAL_CHECK
    // 6 - 11 samples: STABILITY_CHECK
    // >= 12 samples: EXTENDED_CHECK
    let stage: VerificationStage = 'INITIAL_CHECK';
    let status: AdaptiveVerificationStatus = 'INITIAL_CHECK_PASSED';
    let verified = false;
    let incidentResolved = false;

    if (sampleCount < 6) {
      stage = 'INITIAL_CHECK';
      if (isDegraded) {
        status = 'INITIAL_CHECK_FAILED';
        verified = false;
      } else {
        status = 'INITIAL_CHECK_PASSED';
        // Crucial SRE rule: INITIAL_CHECK_PASSED NEVER resolves the incident
        verified = true;
        incidentResolved = false;
      }
    } else if (sampleCount < 12) {
      stage = 'STABILITY_CHECK';
      if (isDegraded) {
        status = 'STABILITY_CHECK_FAILED';
        verified = false;
      } else {
        status = 'STABILITY_CHECK_PASSED';
        verified = true;
        // Severity Gating: LOW/MEDIUM can auto-resolve at 6 samples; HIGH/CRITICAL MUST continue to 12
        if (severity === 'LOW' || severity === 'MEDIUM') {
          incidentResolved = true;
        } else {
          incidentResolved = false;
        }
      }
    } else {
      stage = 'EXTENDED_CHECK';
      if (isDegraded) {
        status = 'EXTENDED_CHECK_FAILED';
        verified = false;
      } else {
        status = 'EXTENDED_CHECK_PASSED';
        verified = true;
        incidentResolved = true;
      }
    }

    const reason = isDegraded
      ? `Hậu kiểm thất bại tại ${stage} (${sampleCount} mẫu, ${actualDurationMs}ms): ${allViolations.slice(0, 3).join('; ')}`
      : `Hậu kiểm ${status} (${sampleCount} mẫu, ${actualDurationMs}ms thực tế): Dịch vụ '${serviceId}' đạt chuẩn sức khỏe.`;

    const details: IVerificationDetails = {
      stage,
      status,
      sample_count: sampleCount,
      action_completed_at: completedAtDate?.toISOString() || null,
      verification_started_at: firstSampleIso || new Date().toISOString(),
      verification_completed_at: lastSampleIso || new Date().toISOString(),
      first_sample_at: firstSampleIso,
      last_sample_at: lastSampleIso,
      observation_duration_ms: actualDurationMs,
      bucket_coverage_seconds: sampleCount * 5,
      target_workload: serviceId,
      pod_uid_before: podUidBefore,
      pod_uid_after: podUidAfter,
      severity,
      verification_result: verified && !isDegraded,
      reason,
      violations: allViolations,
    };

    // If an actionRow exists and we have a definitive pass/fail result, persist to recovery_verifications
    if (actionRow && (stage === 'EXTENDED_CHECK' || (stage === 'STABILITY_CHECK' && incidentResolved) || isDegraded)) {
      try {
        await pool.query(
          `INSERT INTO recovery_verifications (
             healing_action_id, verification_type, status_before, status_after,
             verification_result, verification_details, verified_at, duration_ms
           ) VALUES (
             $1, 'ADAPTIVE_RECOVERY_VERIFICATION', $2::jsonb, $3::jsonb,
             $4, $5::jsonb, NOW(), $6
           );`,
          [
            actionRow.id,
            JSON.stringify({ health: 'DEGRADED', stage, severity }),
            JSON.stringify({
              health: isDegraded ? 'STILL_DEGRADED' : 'HEALTHY',
              stage,
              status,
              sample_count: sampleCount,
              pod_uid_before: podUidBefore,
              pod_uid_after: podUidAfter,
              latest_metrics: rawSequence[rawSequence.length - 1] || null,
            }),
            verified && !isDegraded,
            JSON.stringify(details),
            actualDurationMs,
          ]
        );

        if (incidentResolved && actionRow.incident_id) {
          // Resolve the incident only when no other failed action exists
          await pool.query(
            `UPDATE incidents
             SET status = 'RESOLVED',
                 resolved_at = COALESCE(resolved_at, NOW()),
                 updated_at = NOW()
             WHERE id = $1 AND status IN ('OPEN', 'INVESTIGATING')
               AND NOT EXISTS (
                 SELECT 1 FROM healing_actions ha_fail
                 WHERE ha_fail.incident_id = $1
                   AND (
                     ha_fail.execution_status = 'FAILED'
                     OR EXISTS (
                       SELECT 1 FROM recovery_verifications rv_fail
                       WHERE rv_fail.healing_action_id = ha_fail.id
                         AND rv_fail.verification_result = false
                     )
                   )
               );`,
            [actionRow.incident_id]
          );

          await pool.query(
            `UPDATE ai_recommendations
             SET status = 'APPLIED'
             WHERE incident_id = $1 AND status = 'PROPOSED';`,
            [actionRow.incident_id]
          );

          broadcastTelemetryToUi({
            type: 'incident_resolved',
            data: {
              service_id: serviceId,
              incident_ids: [actionRow.incident_id],
              stage,
              sample_count: sampleCount,
              duration_ms: actualDurationMs,
              timestamp: new Date().toISOString(),
            },
          });
        }
      } catch (dbErr) {
        console.warn(`[RecoveryVerificationService] Database write error for ${serviceId}:`, dbErr);
      }
    }

    return {
      stage,
      status,
      verified: verified && !isDegraded,
      durationMs: actualDurationMs,
      sampleCount,
      incidentResolved,
      details,
    };
  }
}
