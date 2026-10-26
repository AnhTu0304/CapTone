import { z } from 'zod';
import { GRUMetricPointSchema } from './ai.schema';

export const GetServiceSequenceQuerySchema = z.object({
  bucket_seconds: z.coerce.number().int().min(1).max(3600).optional().default(5),
  limit: z.coerce.number().int().min(1).max(2000).optional().default(12),
  fill_padding: z.coerce
    .string()
    .transform((val) => val === 'true' || val === '1')
    .optional()
    .default(true),
  from: z.string().optional(),
  to: z.string().optional(),
  start_time: z.string().optional(),
  end_time: z.string().optional(),
  cluster_id: z.string().trim().max(100).optional(),
});

export const GetRcaContextQuerySchema = z.object({
  window_minutes: z.coerce.number().int().min(1).max(1440).optional().default(30),
  log_limit: z.coerce.number().int().min(1).max(100).optional().default(30),
  event_limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export const EvaluateServiceBodySchema = z.object({
  bucket_seconds: z.number().int().min(1).max(3600).optional().default(5),
  window_minutes: z.number().int().min(1).max(1440).optional().default(30),
  force_rca: z.boolean().optional().default(false),
  auto_trigger_rca: z.boolean().optional().default(true),
});

export const GetApmServicesQuerySchema = z.object({
  window_minutes: z.coerce.number().int().min(1).max(1440).optional().default(60),
  cluster_id: z.string().trim().max(100).optional(),
  environment_id: z.string().trim().max(100).optional(),
  organization_id: z.string().trim().max(100).optional(),
});

/**
 * Validation schema cho API truy vấn lịch sử viễn trắc chi tiết (Task [S4][PB16] 2.1)
 */
export const GetMetricsHistoryQuerySchema = z
  .object({
    service_id: z.string().trim().max(100).optional(),
    pod_id: z.string().trim().max(100).optional(),
    cluster_id: z.string().trim().max(100).optional(),
    organization_id: z.string().trim().max(100).optional(),
    metric_type: z
      .enum(['all', 'cpu', 'ram', 'disk', 'latency', 'request_rate', 'http_5xx_rate'])
      .default('all')
      .optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    start_time: z.string().optional(),
    end_time: z.string().optional(),
    page: z.coerce.number().int().min(1).default(1).optional(),
    limit: z.coerce.number().int().min(1).max(500).default(50).optional(),
    order: z.enum(['asc', 'desc']).default('desc').optional(),
  })
  .refine(
    (data) => {
      const startStr = data.from || data.start_time;
      const endStr = data.to || data.end_time;
      if (startStr && endStr) {
        const startMs = new Date(startStr).getTime();
        const endMs = new Date(endStr).getTime();
        if (!isNaN(startMs) && !isNaN(endMs) && startMs > endMs) {
          return false;
        }
      }
      return true;
    },
    {
      message: 'Thời gian bắt đầu (start_time/from) không được lớn hơn thời gian kết thúc (end_time/to)',
      path: ['start_time'],
    }
  );

export type GetServiceSequenceQuery = z.infer<typeof GetServiceSequenceQuerySchema>;
export type GetRcaContextQuery = z.infer<typeof GetRcaContextQuerySchema>;
export type EvaluateServiceBody = z.infer<typeof EvaluateServiceBodySchema>;
export type GetMetricsHistoryQuery = z.infer<typeof GetMetricsHistoryQuerySchema>;
