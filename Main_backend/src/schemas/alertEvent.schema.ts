import { z } from 'zod';
import { AlertSeverity } from './alertRule.schema';

export type AlertEventCategory = 'RESOURCE' | 'KUBERNETES' | 'APM';
export type AlertEventStatus = 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED';

export const AcknowledgeAlertEventSchema = z.object({
  note: z.string().trim().max(500).optional(),
});

export const ResolveAlertEventSchema = z.object({
  resolution_note: z.string().trim().max(500).optional(),
});

export const ListAlertEventsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20).optional(),
    search: z.string().trim().optional(),
    category: z.enum(['RESOURCE', 'KUBERNETES', 'APM']).optional(),
    status: z.enum(['ACTIVE', 'ACKNOWLEDGED', 'RESOLVED']).optional(),
    severity: z.enum(['INFO', 'WARNING', 'CRITICAL']).optional(),
    metric_type: z.string().trim().optional(),
    resource_type: z.string().trim().optional(),
    resource_id: z.string().trim().optional(),
    cluster_id: z.string().trim().optional(),
    rule_id: z.string().trim().optional(),
    start_time: z.string().optional(),
    end_time: z.string().optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    sort_by: z
      .enum(['first_detected_at', 'last_seen_at', 'resolved_at', 'severity', 'status', 'created_at', 'occurrence_count'])
      .default('last_seen_at')
      .optional(),
    sort: z
      .enum(['first_detected_at', 'last_seen_at', 'resolved_at', 'severity', 'status', 'created_at', 'occurrence_count'])
      .optional(),
    order: z.enum(['asc', 'desc']).default('desc').optional(),
    organization_id: z.string().trim().optional(),
  })
  .transform((data) => ({
    ...data,
    start_time: data.start_time || data.from,
    end_time: data.end_time || data.to,
    sort_by: data.sort || data.sort_by || 'last_seen_at',
  }));

export const AlertSummaryQuerySchema = z.object({
  cluster_id: z.string().trim().optional(),
  organization_id: z.string().trim().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});
