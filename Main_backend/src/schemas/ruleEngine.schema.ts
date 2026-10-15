import { z } from 'zod';

export const TelemetryMetricsSchema = z.object({
  cpu: z.number().describe('CPU percentage'),
  ram: z.number().describe('RAM percentage'),
  disk: z.number().describe('Disk percentage'),
  latency: z.number().describe('Latency in ms'),
  request_rate: z.number().describe('Incoming requests per second'),
  http_5xx_rate: z.number().describe('HTTP 5xx rate percentage'),
  pod_restart_count: z.number().int().min(0).describe('Pod restarts count'),
  replica_count: z.number().int().min(0).describe('Current replica count'),
});

export const RuleEngineInputSchema = z.object({
  service_id: z.string().min(1, 'service_id is required'),
  metrics: TelemetryMetricsSchema,
  pod_status: z.string().optional().default('Running'),
  k8s_events: z.array(z.string()).optional().default([]),
  root_cause: z.string().optional(),
});

export type TelemetryMetrics = z.infer<typeof TelemetryMetricsSchema>;
export type RuleEngineInput = z.infer<typeof RuleEngineInputSchema>;

export type ProposedHealingAction =
  | 'RESTART_POD'
  | 'RESTART_DEPLOYMENT'
  | 'SCALE_REPLICAS'
  | 'ROLLBACK_DEPLOYMENT'
  | 'CLEANUP_STORAGE'
  | 'SCALE_DOWN_CANDIDATE';

export interface RuleEvaluationResult {
  service_id: string;
  is_anomalous: boolean;
  anomalies: string[];
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  requires_rca: boolean;
  proposed_action?: ProposedHealingAction;
  reason: string;
  triggered_rules: string[];
}
