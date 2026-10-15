import { z } from 'zod';
import { GRUMetricPointSchema } from './ai.schema';

export const GetServiceSequenceQuerySchema = z.object({
  bucket_seconds: z.coerce.number().int().min(1).max(3600).optional().default(5),
  limit: z.coerce.number().int().min(1).max(100).optional().default(12),
  fill_padding: z.coerce
    .string()
    .transform((val) => val === 'true' || val === '1')
    .optional()
    .default(true),
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

export type GetServiceSequenceQuery = z.infer<typeof GetServiceSequenceQuerySchema>;
export type GetRcaContextQuery = z.infer<typeof GetRcaContextQuerySchema>;
export type EvaluateServiceBody = z.infer<typeof EvaluateServiceBodySchema>;
