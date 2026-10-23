import { z } from 'zod';

export const GRUMetricPointSchema = z.object({
  cpu: z.number().describe('CPU utilization percentage'),
  ram: z.number().describe('Memory / RAM utilization percentage'),
  disk: z.number().describe('Disk utilization percentage'),
  latency: z.number().describe('Service response latency in ms'),
  request_rate: z.number().describe('Incoming requests per second'),
  http_5xx_rate: z.number().describe('HTTP 5xx error rate percentage'),
  pod_restart_count: z.number().int().min(0).describe('Total pod restarts in window'),
  replica_count: z.number().int().min(0).describe('Available replica count'),
  time_bucket: z.string().optional().describe('ISO timestamp of bucket'),
});

export const PredictRequestSchema = z.object({
  service_id: z.string().min(1, 'service_id is required'),
  sequence: z
    .array(GRUMetricPointSchema)
    .length(12, 'sequence must contain exactly 12 time-ordered metric observations'),
  environment_id: z.string().uuid().optional(),
  cluster_id: z.string().uuid().optional(),
  workload_id: z.string().uuid().optional(),
  prediction_horizon_minutes: z.number().int().min(1).optional().default(15),
});

export const RCARequestSchema = z.object({
  service_id: z.string().min(1, 'service_id is required'),
  risk_type: z
    .enum([
      'CPU_OVERLOAD',
      'OOM',
      'DISK_FULL',
      'HIGH_LATENCY',
      'HTTP_5XX_SPIKE',
      'TRAFFIC_OVERLOAD',
      'SCALE_DOWN_CANDIDATE',
    ])
    .optional(),
  confidence: z.number().min(0).max(1).optional(),
  pod_id: z.string().optional(),
  metrics: z.object({
    cpu: z.number(),
    ram: z.number(),
    disk: z.number(),
    latency: z.number(),
    request_rate: z.number(),
    http_5xx_rate: z.number(),
    pod_restart_count: z.number().int().min(0),
    replica_count: z.number().int().min(0),
  }),
  logs: z.array(z.string()).max(1000).optional().default([]),
  kubernetes_events: z.array(z.string()).max(500).optional().default([]),
  prediction_id: z.string().uuid().optional(),
  environment_id: z.string().uuid().optional(),
  cluster_id: z.string().uuid().optional(),
  workload_id: z.string().uuid().optional(),
});

export type GRUMetricPoint = z.infer<typeof GRUMetricPointSchema>;
export type PredictRequestInput = z.infer<typeof PredictRequestSchema>;
export type RCARequestInput = z.infer<typeof RCARequestSchema>;
