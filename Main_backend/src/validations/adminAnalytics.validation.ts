import { z } from 'zod';

export const growthAnalyticsQuerySchema = z.object({
  year: z.coerce.number().int().min(2020).max(2050).default(() => new Date().getFullYear()).optional(),
  month: z.string().trim().regex(/^(ALL|[1-9]|1[0-2])$/, 'Tháng phải là ALL hoặc từ 1 đến 12').default('ALL').optional(),
  page: z.coerce.number().int().min(1).default(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(10).optional(),
  search: z.string().trim().optional(),
  status: z.enum(['ALL', 'ACTIVE', 'SUSPENDED', 'PENDING']).default('ALL').optional(),
  env: z.enum(['ALL', 'Production', 'Staging', 'Development']).default('ALL').optional(),
});

export type GrowthAnalyticsQuery = z.infer<typeof growthAnalyticsQuerySchema>;
