import { z } from 'zod';

/**
 * Schema kiểm tra dữ liệu khi CẬP NHẬT PROFILE
 */
export const updateProfileSchema = z.object({
  body: z
    .object({
      full_name: z
        .string()
        .trim()
        .min(2, 'Họ và tên phải có ít nhất 2 ký tự')
        .max(150, 'Họ và tên không được vượt quá 150 ký tự')
        .optional(),
      avatar_url: z
        .string()
        .trim()
        .url('Đường dẫn ảnh đại diện avatar không hợp lệ')
        .optional()
        .or(z.literal('')),
    })
    .refine(
      (data) => data.full_name !== undefined || data.avatar_url !== undefined,
      { message: 'Vui lòng cung cấp ít nhất một thông tin cần cập nhật (full_name hoặc avatar_url)' }
    ),
});

/**
 * Schema kiểm tra ID người dùng trên URL Params (/users/:id)
 */
export const userIdParamSchema = z.object({
  params: z.object({
    id: z
      .string('Vui lòng cung cấp ID người dùng')
      .trim()
      .regex(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
        'Định dạng ID người dùng không hợp lệ (yêu cầu UUID)'
      ),
  }),
});

/**
 * Schema kiểm tra query string khi LẤY DANH SÁCH & TÌM KIẾM NGƯỜI DÙNG (/users?page=...&limit=...)
 */
export const userQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(10).optional(),
    search: z.string().trim().optional(),
    name: z.string().trim().optional(),
    email: z.string().trim().optional(),
    id: z.string().trim().optional(),
    status: z.enum(['PENDING', 'ACTIVE', 'INACTIVE', 'SUSPENDED']).optional(),
    sort_by: z.enum(['created_at', 'full_name', 'email', 'last_login_at']).optional(),
    order: z.enum(['ASC', 'DESC', 'asc', 'desc']).optional(),
  }),
});
