import { z } from 'zod';

export const alertHistoryQuerySchema = z
  .object({
    severity: z
      .enum(['ALL', 'INFO', 'WARNING', 'CRITICAL', 'all', 'info', 'warning', 'critical'])
      .optional()
      .transform((val) => (val ? val.toUpperCase() : undefined)),
    status: z
      .enum(['ALL', 'ACTIVE', 'ACKNOWLEDGED', 'RESOLVED', 'all', 'active', 'acknowledged', 'resolved'])
      .optional()
      .transform((val) => (val ? val.toUpperCase() : undefined)),
    startDate: z
      .string()
      .optional()
      .refine(
        (val) => {
          if (!val) return true;
          const d = new Date(val);
          return !isNaN(d.getTime());
        },
        { message: 'startDate không hợp lệ (cần định dạng ISO 8601)' }
      ),
    endDate: z
      .string()
      .optional()
      .refine(
        (val) => {
          if (!val) return true;
          const d = new Date(val);
          return !isNaN(d.getTime());
        },
        { message: 'endDate không hợp lệ (cần định dạng ISO 8601)' }
      ),
    search: z.string().optional(),
    clusterId: z.string().optional(),
    ruleId: z.string().optional(),
    resourceType: z.string().optional(),
    page: z
      .preprocess((val) => (val !== undefined && val !== null ? Number(val) : 1), z.number().int().min(1))
      .default(1),
    limit: z
      .preprocess((val) => (val !== undefined && val !== null ? Number(val) : 10), z.number().int().min(1).max(100))
      .default(10),
    sortBy: z
      .enum(['first_detected_at', 'last_seen_at', 'resolved_at', 'severity', 'status', 'created_at', 'duration'])
      .optional()
      .default('first_detected_at'),
    sortOrder: z
      .enum(['asc', 'desc', 'ASC', 'DESC'])
      .optional()
      .transform((val) => (val ? (val.toLowerCase() as 'asc' | 'desc') : 'desc'))
      .default('desc'),
  })
  .refine(
    (data) => {
      if (data.startDate && data.endDate) {
        const start = new Date(data.startDate).getTime();
        const end = new Date(data.endDate).getTime();
        return start <= end;
      }
      return true;
    },
    {
      message: 'startDate không được lớn hơn endDate',
      path: ['startDate'],
    }
  );

export type AlertHistoryQuery = z.infer<typeof alertHistoryQuerySchema>;
