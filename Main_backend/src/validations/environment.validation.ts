import { z } from 'zod';

/**
 * Validation schema cho loại môi trường:
 * Kiểm tra chặt chẽ ở tầng Application/Validation: CHỈ CHẤP NHẬN 2 LOẠI LÀ DEV VÀ STAGING.
 * Tự động chuẩn hóa về dạng chữ hoa ('DEV' hoặc 'STAGING').
 * Chấp nhận 'DEV', 'dev', 'DEVELOPMENT', 'development' -> 'DEV'
 * Chấp nhận 'STAGING', 'staging' -> 'STAGING'
 * Bất kỳ giá trị nào khác sẽ bị chặn ngay tại validation.
 */
export const environmentTypeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .refine(
    (val) => val === 'DEV' || val === 'DEVELOPMENT' || val === 'STAGING',
    {
      message: "Loại môi trường chỉ được phép là 'DEV' hoặc 'STAGING'",
    }
  )
  .transform((val) => (val === 'DEVELOPMENT' ? 'DEV' : val));

export const environmentStatusSchema = z.enum(['ACTIVE', 'INACTIVE', 'DISCONNECTED']);

/**
 * Validation schema tạo mới môi trường
 */
export const createEnvironmentSchema = z.object({
  body: z.object({
    name: z
      .string()
      .trim()
      .min(2, 'Tên môi trường tối thiểu 2 ký tự')
      .max(100, 'Tên môi trường tối đa 100 ký tự'),
    code: z
      .string()
      .trim()
      .toLowerCase()
      .min(2, 'Mã code tối thiểu 2 ký tự')
      .max(50, 'Mã code tối đa 50 ký tự')
      .regex(
        /^[a-z0-9-]+$/,
        'Mã code chỉ được chứa chữ cái thường không dấu, chữ số và dấu gạch nối (-)'
      ),
    environment_type: environmentTypeSchema,
    description: z
      .string()
      .trim()
      .max(500, 'Mô tả không được vượt quá 500 ký tự')
      .optional()
      .nullable(),
  }),
});

/**
 * Validation schema cập nhật môi trường
 */
export const updateEnvironmentSchema = z.object({
  body: z.object({
    name: z
      .string()
      .trim()
      .min(2, 'Tên môi trường tối thiểu 2 ký tự')
      .max(100, 'Tên môi trường tối đa 100 ký tự')
      .optional(),
    environment_type: environmentTypeSchema.optional(),
    status: environmentStatusSchema.optional(),
    description: z
      .string()
      .trim()
      .max(500, 'Mô tả không được vượt quá 500 ký tự')
      .optional()
      .nullable(),
  }),
});

/**
 * Validation schema cho params (ID)
 */
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const envParamSchema = z.object({
  params: z.object({
    id: z.string().regex(uuidRegex, 'Định danh ID môi trường không hợp lệ'),
    orgId: z.string().regex(uuidRegex, 'Định danh ID tổ chức không hợp lệ').optional(),
  }),
});

/**
 * Validation schema cho query params tìm kiếm & phân trang
 */
export const envQuerySchema = z.object({
  query: z.object({
    page: z
      .string()
      .regex(/^\d+$/, 'Số trang phải là số nguyên dương')
      .transform(Number)
      .optional(),
    limit: z
      .string()
      .regex(/^\d+$/, 'Giới hạn phải là số nguyên dương')
      .transform(Number)
      .optional(),
    search: z.string().trim().optional(),
    type: environmentTypeSchema.optional(),
    status: environmentStatusSchema.optional(),
  }),
});
