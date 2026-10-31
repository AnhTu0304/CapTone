import { z } from 'zod';

export type AlertMetricType = 'CPU' | 'RAM' | 'DISK' | 'NETWORK_RECEIVE' | 'NETWORK_TRANSMIT';
export type AlertOperator =
  | 'GREATER_THAN'
  | 'GREATER_THAN_OR_EQUAL'
  | 'LESS_THAN'
  | 'LESS_THAN_OR_EQUAL'
  | 'EQUAL'
  | 'NOT_EQUAL';
export type AlertSeverity = 'INFO' | 'WARNING' | 'CRITICAL';

export const METRIC_UNITS_MAP: Record<AlertMetricType, string[]> = {
  CPU: ['%', 'cores', 'millicores'],
  RAM: ['%', 'Bytes', 'KB', 'MB', 'GB'],
  DISK: ['%', 'Bytes', 'KB', 'MB', 'GB'],
  NETWORK_RECEIVE: ['B/s', 'KB/s', 'MB/s', 'GB/s'],
  NETWORK_TRANSMIT: ['B/s', 'KB/s', 'MB/s', 'GB/s'],
};

export const EVALUATION_WINDOW_REGEX = /^([1-9]\d*)(s|m|h)$/i;

/**
 * Validate compatibility between metricType, thresholdValue, and unit
 */
export function validateMetricThresholdAndUnit(
  metricType: AlertMetricType,
  thresholdValue: number,
  unit: string
): { isValid: boolean; error?: string } {
  const allowedUnits = METRIC_UNITS_MAP[metricType];
  if (!allowedUnits || !allowedUnits.includes(unit)) {
    return {
      isValid: false,
      error: `Đơn vị '${unit}' không hợp lệ cho chỉ số '${metricType}'. Các đơn vị cho phép: ${allowedUnits?.join(', ')}`,
    };
  }

  if (!Number.isFinite(thresholdValue)) {
    return {
      isValid: false,
      error: 'Ngưỡng cảnh báo (threshold_value) phải là một số hữu hạn',
    };
  }

  if (unit === '%') {
    if (thresholdValue < 0 || thresholdValue > 100) {
      return {
        isValid: false,
        error: `Ngưỡng phần trăm (%) phải nằm trong khoảng từ 0 đến 100 (nhận được: ${thresholdValue})`,
      };
    }
  } else {
    if (thresholdValue <= 0) {
      return {
        isValid: false,
        error: `Ngưỡng cảnh báo theo đơn vị '${unit}' phải lớn hơn 0`,
      };
    }
  }

  return { isValid: true };
}

export const CreateAlertRuleSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, 'Tên cấu hình phải có ít nhất 2 ký tự')
      .max(255, 'Tên cấu hình không được vượt quá 255 ký tự'),
    description: z.string().trim().max(1000).optional().nullable(),
    organization_id: z.string().uuid('organization_id phải là định dạng UUID hợp lệ').optional(),
    cluster_id: z
      .string()
      .uuid('cluster_id phải là định dạng UUID hợp lệ')
      .optional()
      .nullable()
      .or(z.literal('')),
    metric_type: z.enum(['CPU', 'RAM', 'DISK', 'NETWORK_RECEIVE', 'NETWORK_TRANSMIT']),
    operator: z.enum([
      'GREATER_THAN',
      'GREATER_THAN_OR_EQUAL',
      'LESS_THAN',
      'LESS_THAN_OR_EQUAL',
      'EQUAL',
      'NOT_EQUAL',
    ]),
    threshold_value: z.coerce
      .number()
      .refine((val) => Number.isFinite(val), 'Giá trị ngưỡng phải là số hữu hạn'),
    unit: z.string().trim().min(1, 'Đơn vị đo lường không được để trống'),
    severity: z.enum(['INFO', 'WARNING', 'CRITICAL']).default('WARNING'),
    evaluation_window: z
      .string()
      .trim()
      .regex(EVALUATION_WINDOW_REGEX, 'Cửa sổ đánh giá phải có định dạng hợp lệ (vd: 30s, 5m, 15m, 1h)')
      .default('5m'),
    duration: z.coerce
      .number()
      .int('Thời gian duy trì (duration) phải là số nguyên')
      .min(0, 'Thời gian duy trì không được âm')
      .default(60),
    cooldown_seconds: z.coerce
      .number()
      .int('Thời gian chờ (cooldown_seconds) phải là số nguyên')
      .min(0, 'Thời gian chờ không được âm')
      .default(300),
    enabled: z.boolean().default(true),
  })
  .superRefine((data, ctx) => {
    const res = validateMetricThresholdAndUnit(
      data.metric_type as AlertMetricType,
      data.threshold_value,
      data.unit
    );
    if (!res.isValid && res.error) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: res.error,
        path: ['threshold_value'],
      });
    }
  });

export const UpdateAlertRuleSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, 'Tên cấu hình phải có ít nhất 2 ký tự')
      .max(255, 'Tên cấu hình không được vượt quá 255 ký tự')
      .optional(),
    description: z.string().trim().max(1000).optional().nullable(),
    cluster_id: z
      .string()
      .uuid('cluster_id phải là định dạng UUID hợp lệ')
      .optional()
      .nullable()
      .or(z.literal('')),
    metric_type: z
      .enum(['CPU', 'RAM', 'DISK', 'NETWORK_RECEIVE', 'NETWORK_TRANSMIT'])
      .optional(),
    operator: z
      .enum([
        'GREATER_THAN',
        'GREATER_THAN_OR_EQUAL',
        'LESS_THAN',
        'LESS_THAN_OR_EQUAL',
        'EQUAL',
        'NOT_EQUAL',
      ])
      .optional(),
    threshold_value: z.coerce.number().optional(),
    unit: z.string().trim().min(1).optional(),
    severity: z.enum(['INFO', 'WARNING', 'CRITICAL']).optional(),
    evaluation_window: z
      .string()
      .trim()
      .regex(EVALUATION_WINDOW_REGEX, 'Cửa sổ đánh giá phải có định dạng hợp lệ (vd: 30s, 5m, 15m, 1h)')
      .optional(),
    duration: z.coerce.number().int().min(0, 'Thời gian duy trì không được âm').optional(),
    cooldown_seconds: z.coerce.number().int().min(0, 'Thời gian chờ không được âm').optional(),
    enabled: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.metric_type && data.threshold_value !== undefined && data.unit) {
      const res = validateMetricThresholdAndUnit(
        data.metric_type as AlertMetricType,
        data.threshold_value,
        data.unit
      );
      if (!res.isValid && res.error) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: res.error,
          path: ['threshold_value'],
        });
      }
    }
  });

export const ToggleAlertRuleStatusSchema = z.object({
  enabled: z.boolean(),
});

export const ListAlertRulesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20).optional(),
  search: z.string().trim().optional(),
  metric_type: z.enum(['CPU', 'RAM', 'DISK', 'NETWORK_RECEIVE', 'NETWORK_TRANSMIT']).optional(),
  severity: z.enum(['INFO', 'WARNING', 'CRITICAL']).optional(),
  enabled: z
    .string()
    .transform((val) => {
      if (val === 'true' || val === '1') return true;
      if (val === 'false' || val === '0') return false;
      return undefined;
    })
    .optional(),
  cluster_id: z.string().trim().optional(),
  organization_id: z.string().trim().optional(),
  sort_by: z
    .enum(['created_at', 'updated_at', 'name', 'severity', 'threshold_value', 'metric_type'])
    .default('created_at')
    .optional(),
  order: z.enum(['asc', 'desc']).default('desc').optional(),
});
