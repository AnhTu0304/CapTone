import { z } from 'zod';

const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export const overviewStatisticsQuerySchema = z.object({
  time_range: z.enum(['15m', '1h', '6h', '24h', '7d', '30d']).optional().default('24h'),
  organization_id: z.string().regex(uuidRegex, 'organization_id must be a valid UUID').optional(),
  cluster_id: z.string().regex(uuidRegex, 'cluster_id must be a valid UUID').optional(),
});

export type OverviewStatisticsQuery = z.infer<typeof overviewStatisticsQuerySchema>;
