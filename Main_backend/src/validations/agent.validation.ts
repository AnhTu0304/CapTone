import { z } from 'zod';

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const agentStatusEnum = z.enum(['PENDING', 'ONLINE', 'OFFLINE', 'REVOKED'], {
  message: "Trạng thái Agent phải là 'PENDING', 'ONLINE', 'OFFLINE' hoặc 'REVOKED'",
});

/**
 * Validation schema tạo mới Agent
 */
export const createAgentSchema = z.object({
  body: z.object({
    name: z
      .string('Tên Agent là bắt buộc')
      .trim()
      .min(2, 'Tên Agent tối thiểu 2 ký tự')
      .max(150, 'Tên Agent tối đa 150 ký tự'),
    environment_id: z
      .string('Mã môi trường (environment_id) là bắt buộc')
      .regex(uuidRegex, 'Định danh ID môi trường không hợp lệ (yêu cầu UUID)'),
    cluster_id: z
      .string()
      .regex(uuidRegex, 'Định danh ID cụm Kubernetes không hợp lệ (yêu cầu UUID)')
      .optional()
      .nullable(),
    agent_uid: z
      .string()
      .trim()
      .max(255, 'Mã Agent UID tối đa 255 ký tự')
      .optional(),
    version: z
      .string()
      .trim()
      .max(50, 'Phiên bản tối đa 50 ký tự')
      .default('v1.0.0')
      .optional(),
    token_expires_in_days: z
      .coerce
      .number()
      .int()
      .min(1, 'Thời hạn token tối thiểu 1 ngày')
      .max(365, 'Thời hạn token tối đa 365 ngày')
      .optional()
      .nullable(),
  }),
});

/**
 * Validation schema cập nhật Agent
 */
export const updateAgentSchema = z.object({
  body: z
    .object({
      name: z
        .string()
        .trim()
        .min(2, 'Tên Agent tối thiểu 2 ký tự')
        .max(150, 'Tên Agent tối đa 150 ký tự')
        .optional(),
      cluster_id: z
        .string()
        .regex(uuidRegex, 'Định danh ID cụm Kubernetes không hợp lệ')
        .optional()
        .nullable(),
      version: z
        .string()
        .trim()
        .max(50, 'Phiên bản tối đa 50 ký tự')
        .optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: 'Vui lòng cung cấp ít nhất một thông tin cần cập nhật (name, cluster_id, version)',
    }),
});

/**
 * Validation schema tạo thêm Token cho Agent
 */
export const createTokenSchema = z.object({
  body: z.object({
    expires_in_days: z
      .coerce
      .number()
      .int()
      .min(1, 'Thời hạn tối thiểu 1 ngày')
      .max(365, 'Thời hạn tối đa 365 ngày')
      .optional()
      .nullable(),
  }).optional(),
});

/**
 * Validation schema nhận nhịp tim Heartbeat từ Agent daemon
 */
export const agentHeartbeatSchema = z.object({
  body: z.object({
    latency_ms: z.coerce.number().int().min(0, 'Độ trễ latency không được âm').optional().nullable(),
    agent_version: z.string().trim().max(50).optional().nullable(),
    status: agentStatusEnum.optional().default('ONLINE'),
    metadata: z.record(z.string(), z.any()).optional().nullable(),
  }),
});

/**
 * Validation schema truy vấn danh sách Agent
 */
export const agentQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20).optional(),
    environment_id: z.string().regex(uuidRegex).optional(),
    cluster_id: z.string().regex(uuidRegex).optional(),
    status: agentStatusEnum.optional(),
    search: z.string().trim().optional(),
  }),
});

/**
 * Validation schema URL params chứa ID Agent
 */
export const agentIdParamSchema = z.object({
  params: z.object({
    orgId: z.string().regex(uuidRegex, 'Định danh ID tổ chức không hợp lệ').optional(),
    id: z.string().regex(uuidRegex, 'Định danh ID Agent không hợp lệ').optional(),
    agentId: z.string().regex(uuidRegex, 'Định danh ID Agent không hợp lệ').optional(),
    tokenId: z.string().regex(uuidRegex, 'Định danh ID Token không hợp lệ').optional(),
  }),
});
