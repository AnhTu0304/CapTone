import { z } from 'zod';

export const AgentMetricsPayloadSchema = z.object({
  service_id: z.string().min(1, 'service_id is required'),
  pod_id: z.string().optional().default('unknown-pod'),
  timestamp: z.string().min(1, 'timestamp is required'),
  cpu: z.number().min(0, 'cpu must be non-negative'),
  ram: z.number().min(0, 'ram must be non-negative'),
  disk: z.number().min(0, 'disk must be non-negative'),
  request_rate: z.number().min(0, 'request_rate must be non-negative'),
  latency: z.number().min(0, 'latency must be non-negative'),
  http_5xx_rate: z.number().min(0, 'http_5xx_rate must be non-negative'),
  pod_restart_count: z.number().int().min(0).default(0),
  replica_count: z.number().int().min(0).default(1),
});

export const AgentLogPayloadSchema = z.object({
  service_id: z.string().min(1, 'service_id is required'),
  pod_id: z.string().optional().default('unknown-pod'),
  timestamp: z.string().min(1, 'timestamp is required'),
  level: z.string().min(1, 'level is required'),
  message: z.string().min(1, 'message is required'),
});

export const AgentK8sEventPayloadSchema = z.object({
  service_id: z.string().min(1, 'service_id is required'),
  pod_id: z.string().optional().default('unknown-pod'),
  pod_name: z.string().optional().default('unknown-pod'),
  status: z.string().min(1, 'status is required'),
  timestamp: z.string().min(1, 'timestamp is required'),
  event: z.object({
    type: z.string().min(1, 'event.type is required'),
    reason: z.string().min(1, 'event.reason is required'),
    message: z.string().min(1, 'event.message is required'),
  }),
});

export const AgentAuthPayloadSchema = z.object({
  type: z.literal('auth'),
  token: z.string().min(1, 'token is required'),
});

export const AgentWsMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('metrics'),
    data: AgentMetricsPayloadSchema,
  }),
  z.object({
    type: z.literal('log'),
    data: AgentLogPayloadSchema,
  }),
  z.object({
    type: z.literal('k8s_event'),
    data: AgentK8sEventPayloadSchema,
  }),
  AgentAuthPayloadSchema,
]);

export type AgentMetricsPayload = z.infer<typeof AgentMetricsPayloadSchema>;
export type AgentLogPayload = z.infer<typeof AgentLogPayloadSchema>;
export type AgentK8sEventPayload = z.infer<typeof AgentK8sEventPayloadSchema>;
export type AgentWsMessage = z.infer<typeof AgentWsMessageSchema>;
