import crypto from 'crypto';
import { getRedisClient } from '../../config/redis';
import { AlertSeverity } from '../../schemas/alertRule.schema';
import { evaluateOperator } from './ruleEvaluationHelper';

export type RuleEvaluationState = 'NORMAL' | 'PENDING' | 'FIRING' | 'NO_DATA' | 'ERROR';

export interface IConditionEvaluationInput {
  organizationId: string;
  clusterId?: string | null;
  ruleId: string;
  ruleName: string;
  resourceType: string;
  resourceId: string;
  metricType: string;
  operator: string;
  thresholdValue: number;
  duration: number; // in seconds
  observedValue?: number | null;
  sampleCount: number;
  sampleEarliestAt?: Date | null;
  sampleLatestAt?: Date | null;
  evaluationWindowSeconds: number;
  error?: any;
}

export interface IConditionEvaluationResult {
  state: RuleEvaluationState;
  fingerprint: string;
  observedValue?: number | null;
  durationSatisfied: boolean;
  pendingSince?: Date | null;
  message: string;
}

// In-memory fallback map if Redis is temporarily unreachable
const inMemoryPendingMap = new Map<string, { firstBreachedAt: Date; observedValue?: number; expiresAt: number }>();

export class ConditionEvaluator {
  /**
   * Generates a 32-character SHA256 hex fingerprint for unique deduplication
   */
  public static computeFingerprint(
    organizationId: string,
    clusterId?: string | null,
    ruleId?: string | null,
    resourceType?: string,
    resourceId?: string,
    metricType?: string
  ): string {
    const raw = [
      organizationId,
      clusterId || '00000000-0000-0000-0000-000000000000',
      ruleId || '00000000-0000-0000-0000-000000000000',
      resourceType || 'unknown',
      resourceId || 'unknown',
      metricType || 'unknown',
    ].join(':');

    return crypto.createHash('sha256').update(raw).digest('hex').substring(0, 32);
  }

  /**
   * Get PENDING evaluation state from Redis (or in-memory fallback)
   */
  public static async getPendingState(
    fingerprint: string
  ): Promise<{ firstBreachedAt: Date; observedValue?: number } | null> {
    const redis = getRedisClient();
    const key = `alert:pending:${fingerprint}`;

    if (redis) {
      try {
        const data = await redis.get(key);
        if (data) {
          const parsed = JSON.parse(data);
          return {
            firstBreachedAt: new Date(parsed.firstBreachedAt),
            observedValue: parsed.observedValue,
          };
        }
      } catch (err) {
        // Fallback to in-memory on redis read error
      }
    }

    const mem = inMemoryPendingMap.get(fingerprint);
    if (mem) {
      if (Date.now() > mem.expiresAt) {
        inMemoryPendingMap.delete(fingerprint);
        return null;
      }
      return {
        firstBreachedAt: mem.firstBreachedAt,
        observedValue: mem.observedValue,
      };
    }

    return null;
  }

  /**
   * Save PENDING evaluation state to Redis (survives worker restarts)
   */
  public static async setPendingState(
    fingerprint: string,
    data: { firstBreachedAt: Date; observedValue?: number },
    ttlSeconds: number
  ): Promise<void> {
    const redis = getRedisClient();
    const key = `alert:pending:${fingerprint}`;
    const payload = JSON.stringify({
      firstBreachedAt: data.firstBreachedAt.toISOString(),
      observedValue: data.observedValue,
    });

    if (redis) {
      try {
        await redis.set(key, payload, 'EX', Math.max(ttlSeconds, 60));
        return;
      } catch (err) {
        // Fallback to in-memory
      }
    }

    inMemoryPendingMap.set(fingerprint, {
      firstBreachedAt: data.firstBreachedAt,
      observedValue: data.observedValue,
      expiresAt: Date.now() + Math.max(ttlSeconds, 60) * 1000,
    });
  }

  /**
   * Clear PENDING evaluation state when condition returns to normal or resolves
   */
  public static async clearPendingState(fingerprint: string): Promise<void> {
    const redis = getRedisClient();
    const key = `alert:pending:${fingerprint}`;

    if (redis) {
      try {
        await redis.del(key);
      } catch (err) {
        // Ignore
      }
    }
    inMemoryPendingMap.delete(fingerprint);
  }

  /**
   * Evaluate metric condition and classify into NORMAL, PENDING, FIRING, NO_DATA, ERROR
   */
  public static async evaluate(input: IConditionEvaluationInput): Promise<IConditionEvaluationResult> {
    const fingerprint = this.computeFingerprint(
      input.organizationId,
      input.clusterId,
      input.ruleId,
      input.resourceType,
      input.resourceId,
      input.metricType
    );

    // 1. Check for Evaluation Error
    if (input.error) {
      return {
        state: 'ERROR',
        fingerprint,
        durationSatisfied: false,
        message: `Evaluation failed with error: ${input.error.message || input.error}`,
      };
    }

    // 2. Check for NO_DATA
    if (input.sampleCount === 0 || input.observedValue === null || input.observedValue === undefined) {
      return {
        state: 'NO_DATA',
        fingerprint,
        durationSatisfied: false,
        message: `Không có dữ liệu đo lường trong cửa sổ đánh giá (${input.evaluationWindowSeconds}s)`,
      };
    }

    const observed = Number(input.observedValue);

    // 3. Evaluate operator condition
    const isBreached = evaluateOperator(observed, input.operator, Number(input.thresholdValue));

    // Case A: NORMAL (Condition not breached)
    if (!isBreached) {
      await this.clearPendingState(fingerprint);
      return {
        state: 'NORMAL',
        fingerprint,
        observedValue: observed,
        durationSatisfied: false,
        message: `Chỉ số ${input.metricType} của ${input.resourceType} '${input.resourceId}' ở mức an toàn (${observed})`,
      };
    }

    // Case B: Instantaneous FIRING (duration == 0)
    if (input.duration <= 0) {
      await this.clearPendingState(fingerprint);
      return {
        state: 'FIRING',
        fingerprint,
        observedValue: observed,
        durationSatisfied: true,
        message: `Chỉ số ${input.metricType} của ${input.resourceType} '${input.resourceId}' vượt ngưỡng tức thời: ${observed} (${input.operator} ${input.thresholdValue})`,
      };
    }

    // Case C: Duration requirement > 0: Check persistence
    const now = new Date();
    const pending = await this.getPendingState(fingerprint);

    // Calculate spread of real sample timestamps in this evaluation window
    let sampleSpreadSeconds = 0;
    if (input.sampleEarliestAt && input.sampleLatestAt) {
      sampleSpreadSeconds =
        (new Date(input.sampleLatestAt).getTime() - new Date(input.sampleEarliestAt).getTime()) / 1000;
    }

    if (!pending) {
      // First time condition is breached: Record PENDING state
      const firstBreachedAt = input.sampleEarliestAt || now;
      const ttl = Math.max(input.duration * 4, 300);
      await this.setPendingState(fingerprint, { firstBreachedAt, observedValue: observed }, ttl);

      // If sample spread within window already spans >= duration, it fires immediately
      if (sampleSpreadSeconds >= input.duration) {
        return {
          state: 'FIRING',
          fingerprint,
          observedValue: observed,
          durationSatisfied: true,
          message: `Chỉ số ${input.metricType} của ${input.resourceType} '${input.resourceId}' vượt ngưỡng liên tục trong chu kỳ mẫu (${sampleSpreadSeconds}s >= ${input.duration}s)`,
        };
      }

      return {
        state: 'PENDING',
        fingerprint,
        observedValue: observed,
        durationSatisfied: false,
        pendingSince: firstBreachedAt,
        message: `Phát hiện vi phạm ngưỡng, đang theo dõi duy trì (Duration: 0s / ${input.duration}s)`,
      };
    }

    // Condition was already pending: Check elapsed duration
    const elapsedSeconds = (now.getTime() - pending.firstBreachedAt.getTime()) / 1000;

    if (elapsedSeconds >= input.duration || sampleSpreadSeconds >= input.duration) {
      // Duration satisfied -> Transitions to FIRING!
      return {
        state: 'FIRING',
        fingerprint,
        observedValue: observed,
        durationSatisfied: true,
        pendingSince: pending.firstBreachedAt,
        message: `Chỉ số ${input.metricType} của ${input.resourceType} '${input.resourceId}' duy trì vượt ngưỡng đủ ${input.duration}s (${Math.round(elapsedSeconds)}s trôi qua)`,
      };
    }

    // Still PENDING
    return {
      state: 'PENDING',
      fingerprint,
      observedValue: observed,
      durationSatisfied: false,
      pendingSince: pending.firstBreachedAt,
      message: `Chỉ số vi phạm đang trong thời gian chờ duy trì (${Math.round(elapsedSeconds)}s / ${input.duration}s)`,
    };
  }

  /**
   * Determine severity with rule priority and optional dynamic escalation
   */
  public static determineSeverity(
    configuredSeverity: AlertSeverity,
    observedValue: number | null | undefined,
    thresholdValue: number,
    metricType: string
  ): { severity: AlertSeverity; isEscalated: boolean } {
    if (configuredSeverity === 'CRITICAL') {
      return { severity: 'CRITICAL', isEscalated: false };
    }

    // Dynamic escalation policy:
    if (observedValue !== null && observedValue !== undefined) {
      const val = Number(observedValue);
      // 1. Extreme CPU / RAM / Disk saturation (>= 95%)
      if (['CPU', 'RAM', 'DISK'].includes(metricType) && val >= 95) {
        return { severity: 'CRITICAL', isEscalated: true };
      }
      // 2. Catastrophic APM HTTP 5xx rate (>= 25%)
      if (['HTTP_5XX_RATE', 'ERROR_RATE'].includes(metricType) && val >= 25) {
        return { severity: 'CRITICAL', isEscalated: true };
      }
      // 3. High Pod restart count (>= 15 restarts)
      if (metricType === 'POD_CRASH_LOOP' && val >= 15) {
        return { severity: 'CRITICAL', isEscalated: true };
      }
    }

    return { severity: configuredSeverity, isEscalated: false };
  }
}
