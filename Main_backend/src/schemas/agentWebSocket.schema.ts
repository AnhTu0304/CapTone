import { z } from 'zod';

/**
 * Helper to validate ISO 8601 timestamps within a realistic range
 * (not older than 30 days and not more than 1 hour in future).
 */
const IsoTimestampSchema = z.string().refine(
  (val) => {
    const d = new Date(val);
    if (isNaN(d.getTime())) return false;
    const now = Date.now();
    const time = d.getTime();
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
    const oneHourFuture = now + 60 * 60 * 1000;
    return time >= thirtyDaysAgo && time <= oneHourFuture;
  },
  {
    message: 'timestamp must be a valid ISO 8601 string within reasonable range (<= 30 days old and <= 1 hr in future)',
  }
);

/**
 * Helper to sanitize strings (trim, enforce max length, strip NULL bytes to protect PostgreSQL text encoding)
 */
const SafeString = (maxLen: number) =>
  z
    .string()
    .trim()
    .min(1, 'Field cannot be empty')
    .max(maxLen, `Field length cannot exceed ${maxLen} characters`)
    .transform((str) => str.replace(/\0/g, ''));

/**
 * 1. Validation Schema for Metrics stream (table: agent_metrics)
 */
export const AgentMetricsPayloadSchema = z.object({
  service_id: SafeString(100),
  pod_id: z
    .string()
    .trim()
    .max(100, 'pod_id cannot exceed 100 characters')
    .optional()
    .default('unknown-pod')
    .transform((str) => str.replace(/\0/g, '')),
  timestamp: IsoTimestampSchema,
  cpu: z
    .number()
    .finite('cpu must be a finite number')
    .min(0, 'cpu cannot be negative')
    .max(10000, 'cpu cannot exceed 10000%'),
  ram: z
    .number()
    .finite('ram must be a finite number')
    .min(0, 'ram cannot be negative')
    .max(10000000, 'ram cannot exceed 10,000,000 MB'),
  disk: z
    .number()
    .finite('disk must be a finite number')
    .min(0, 'disk cannot be negative')
    .max(100000000, 'disk value out of range'),
  request_rate: z
    .number()
    .finite('request_rate must be a finite number')
    .min(0, 'request_rate cannot be negative')
    .max(10000000, 'request_rate out of range'),
  latency: z
    .number()
    .finite('latency must be a finite number')
    .min(0, 'latency cannot be negative')
    .max(600000, 'latency cannot exceed 600,000 ms (10 minutes)'),
  http_5xx_rate: z
    .number()
    .finite('http_5xx_rate must be a finite number')
    .min(0, 'http_5xx_rate cannot be negative')
    .max(100, 'http_5xx_rate cannot exceed 100%'),
  pod_restart_count: z
    .number()
    .int('pod_restart_count must be an integer')
    .min(0, 'pod_restart_count cannot be negative')
    .max(1000000)
    .default(0),
  replica_count: z
    .number()
    .int('replica_count must be an integer')
    .min(0, 'replica_count cannot be negative')
    .max(1000, 'replica_count cannot exceed 1,000')
    .default(1),
});

/**
 * 1b. Validation Schema for Host/Node Resource Metrics stream (table: node_metrics)
 */
export const AgentNodeMetricsPayloadSchema = z.object({
  node_name: SafeString(255),
  timestamp: IsoTimestampSchema,
  cpu_usage_percent: z.number().finite().min(0).max(100).default(0),
  cpu_cores: z.number().int().min(1).max(4096).default(1),
  ram_total_bytes: z.number().finite().nonnegative().default(0),
  ram_used_bytes: z.number().finite().nonnegative().default(0),
  ram_available_bytes: z.number().finite().nonnegative().default(0),
  ram_usage_percent: z.number().finite().min(0).max(100).default(0),
  disk_total_bytes: z.number().finite().nonnegative().default(0),
  disk_used_bytes: z.number().finite().nonnegative().default(0),
  disk_available_bytes: z.number().finite().nonnegative().default(0),
  disk_usage_percent: z.number().finite().min(0).max(100).default(0),
  disk_filesystems: z
    .array(
      z.object({
        device: z.string().max(255),
        mount_point: z.string().max(255),
        fs_type: z.string().max(100).optional().default('unknown'),
        total_bytes: z.number().finite().nonnegative(),
        used_bytes: z.number().finite().nonnegative(),
        available_bytes: z.number().finite().nonnegative(),
        usage_percent: z.number().finite().min(0).max(100),
      })
    )
    .optional()
    .default([]),
  net_rx_bytes: z.number().finite().nonnegative().default(0),
  net_tx_bytes: z.number().finite().nonnegative().default(0),
  net_rx_bytes_per_sec: z.number().finite().nonnegative().default(0),
  net_tx_bytes_per_sec: z.number().finite().nonnegative().default(0),
  net_interfaces: z
    .array(
      z.object({
        interface: z.string().max(100),
        rx_bytes: z.number().finite().nonnegative(),
        tx_bytes: z.number().finite().nonnegative(),
        rx_packets: z.number().finite().nonnegative().optional().default(0),
        tx_packets: z.number().finite().nonnegative().optional().default(0),
        rx_errors: z.number().finite().nonnegative().optional().default(0),
        tx_errors: z.number().finite().nonnegative().optional().default(0),
        rx_bytes_per_sec: z.number().finite().nonnegative(),
        tx_bytes_per_sec: z.number().finite().nonnegative(),
        is_warmup: z.boolean().optional().default(false),
        counter_reset: z.boolean().optional().default(false),
      })
    )
    .optional()
    .default([]),
  collection_status: z.enum(['OK', 'WARMUP', 'PARTIAL', 'ERROR']).optional().default('OK'),
  collection_errors: z.record(z.string(), z.string()).optional().default({}),
  metadata: z.record(z.string(), z.any()).optional().default({}),
});

/**
 * 2. Validation Schema for Logs stream (table: logs)
 */
export const AgentLogPayloadSchema = z.object({
  service_id: SafeString(100),
  pod_id: z
    .string()
    .trim()
    .max(100, 'pod_id cannot exceed 100 characters')
    .optional()
    .default('unknown-pod')
    .transform((str) => str.replace(/\0/g, '')),
  timestamp: IsoTimestampSchema,
  level: z
    .string()
    .trim()
    .max(50)
    .transform((lvl) => {
      const upper = lvl.toUpperCase();
      const valid = ['INFO', 'WARN', 'WARNING', 'ERROR', 'FATAL', 'CRITICAL', 'DEBUG', 'TRACE'];
      return valid.includes(upper) ? (upper === 'WARNING' ? 'WARN' : upper) : 'INFO';
    }),
  message: z
    .string()
    .min(1, 'log message is required')
    .max(65535, 'log message length cannot exceed 64 KB')
    .transform((msg) => msg.replace(/\0/g, '')),
});

/**
 * 3. Validation Schema for K8s Events stream (table: kubernetes_events)
 */
export const AgentK8sEventPayloadSchema = z.object({
  service_id: SafeString(100),
  pod_id: z
    .string()
    .trim()
    .max(255, 'pod_id cannot exceed 255 characters')
    .optional()
    .default('unknown-pod')
    .transform((str) => str.replace(/\0/g, '')),
  pod_name: z
    .string()
    .trim()
    .max(255, 'pod_name cannot exceed 255 characters')
    .optional()
    .default('unknown-pod')
    .transform((str) => str.replace(/\0/g, '')),
  status: z
    .string()
    .trim()
    .max(50)
    .default('Running')
    .transform((str) => str.replace(/\0/g, '')),
  timestamp: IsoTimestampSchema,
  event: z.object({
    type: z
      .string()
      .trim()
      .max(50)
      .default('Normal')
      .transform((str) => str.replace(/\0/g, '')),
    reason: z
      .string()
      .trim()
      .max(100, 'event.reason cannot exceed 100 characters')
      .default('General')
      .transform((str) => str.replace(/\0/g, '')),
    message: z
      .string()
      .max(10000, 'event.message cannot exceed 10,000 characters')
      .default('')
      .transform((str) => str.replace(/\0/g, '')),
  }),
});

/**
 * 4. Validation Schema for Kubernetes Cluster Inventory Sync (tables: namespaces, nodes, pods)
 */
export const AgentK8sInventoryPayloadSchema = z.object({
  nodes: z.array(z.object({
    name: z.string().trim().min(1).max(255),
    kubernetes_uid: z.string().optional().nullable(),
    status: z.string().default('Ready'),
    cpu_capacity_millicores: z.number().optional().nullable(),
    memory_capacity_bytes: z.number().optional().nullable(),
    disk_capacity_bytes: z.number().optional().nullable(),
    kubelet_version: z.string().optional().nullable(),
    roles: z.array(z.string()).optional().default([]),
    labels: z.record(z.string(), z.any()).optional().default({}),
  })).default([]),
  namespaces: z.array(z.object({
    name: z.string().trim().min(1).max(255),
    kubernetes_uid: z.string().optional().nullable(),
    status: z.string().default('Active'),
    labels: z.record(z.string(), z.any()).optional().default({}),
  })).default([]),
  pods: z.array(z.object({
    name: z.string().trim().min(1).max(255),
    namespace: z.string().default('default'),
    node_name: z.string().optional().nullable(),
    kubernetes_uid: z.string().optional().nullable(),
    status: z.string().default('Running'),
    phase: z.string().default('Running'),
    restart_count: z.number().int().nonnegative().default(0),
    image: z.string().optional().nullable(),
    labels: z.record(z.string(), z.any()).optional().default({}),
    started_at: z.string().optional().nullable(),
  })).default([]),
});

/**
 * 5. Validation Schema for Agent Authentication (tables: agent_tokens, agents)
 */
export const AgentAuthPayloadSchema = z.object({
  type: z.literal('auth'),
  token: z
    .string()
    .trim()
    .min(8, 'agent token is too short (minimum 8 characters)')
    .max(255, 'agent token cannot exceed 255 characters'),
});

export const AgentWsMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('metrics'),
    data: AgentMetricsPayloadSchema,
  }),
  z.object({
    type: z.literal('node_metrics'),
    data: AgentNodeMetricsPayloadSchema,
  }),
  z.object({
    type: z.literal('log'),
    data: AgentLogPayloadSchema,
  }),
  z.object({
    type: z.literal('k8s_event'),
    data: AgentK8sEventPayloadSchema,
  }),
  z.object({
    type: z.literal('k8s_inventory'),
    data: AgentK8sInventoryPayloadSchema,
  }),
  z.object({
    type: z.literal('action_result'),
    data: z.object({
      action_id: z.string().trim().min(1),
      status: z.enum(['SUCCEEDED', 'FAILED']),
      message: z.string().optional().default('Action completed'),
      duration_ms: z.number().nonnegative().optional().default(1000),
      details: z.any().optional().default({}),
    }),
  }),
  AgentAuthPayloadSchema,
]);

export type AgentMetricsPayload = z.infer<typeof AgentMetricsPayloadSchema>;
export type AgentNodeMetricsPayload = z.infer<typeof AgentNodeMetricsPayloadSchema>;
export type AgentLogPayload = z.infer<typeof AgentLogPayloadSchema>;
export type AgentK8sEventPayload = z.infer<typeof AgentK8sEventPayloadSchema>;
export type AgentK8sInventoryPayload = z.infer<typeof AgentK8sInventoryPayloadSchema>;

export type AgentWsMessage = z.infer<typeof AgentWsMessageSchema>;
