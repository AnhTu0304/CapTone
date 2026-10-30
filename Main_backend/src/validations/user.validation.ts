import { z } from 'zod';

/**
 * Schema kiểm tra ảnh đại diện avatar (Hỗ trợ URL http/https và chuỗi ảnh Base64 data:image/...)
 */
export const avatarSchema = z
  .string()
  .trim()
  .refine(
    (val) => {
      if (!val) return true;
      if (val.startsWith('http://') || val.startsWith('https://')) {
        try {
          new URL(val);
          return true;
        } catch {
          return false;
        }
      }
      if (val.startsWith('data:image/')) {
        return true;
      }
      return false;
    },
    { message: 'Đường dẫn avatar phải là URL hợp lệ hoặc chuỗi ảnh Base64 (data:image/...)' }
  )
  .optional()
  .or(z.literal(''))
  .nullable();

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
      avatar_url: avatarSchema,
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
    role: z.enum(['SUPER_ADMIN', 'ADMIN', 'SME_OWNER', 'DEVOPS', 'VIEWER', 'ALL']).optional(),
    sort_by: z.enum(['created_at', 'full_name', 'email', 'last_login_at']).optional(),
    order: z.enum(['ASC', 'DESC', 'asc', 'desc']).optional(),
  }),
});

/**
 * Schema kiem tra du lieu khi CAP NHAT HO SO CA NHAN (PUT /api/v1/users/me)
 */
export const updateMyProfileSchema = z.object({
  body: z
    .object({
      full_name: z
        .string()
        .trim()
        .min(2, 'Họ và tên phải có ít nhất 2 ký tự')
        .max(150, 'Họ và tên không được vượt quá 150 ký tự')
        .optional(),
      fullName: z
        .string()
        .trim()
        .min(2, 'Họ và tên phải có ít nhất 2 ký tự')
        .max(150, 'Họ và tên không được vượt quá 150 ký tự')
        .optional(),
      avatar_url: avatarSchema,
      avatarUrl: avatarSchema,
      phone: z
        .string()
        .trim()
        .regex(/^[+]?[(]?[0-9]{2,4}[)]?[-\s.]?[0-9]{3,4}[-\s.]?[0-9]{3,6}$/, 'Định dạng số điện thoại không hợp lệ (Ví dụ: 0912345678)')
        .optional()
        .or(z.literal(''))
        .nullable(),
      job_title: z
        .string()
        .trim()
        .max(100, 'Chức danh nghề nghiệp không được vượt quá 100 ký tự')
        .optional()
        .or(z.literal(''))
        .nullable(),
      jobTitle: z
        .string()
        .trim()
        .max(100, 'Chức danh nghề nghiệp không được vượt quá 100 ký tự')
        .optional()
        .or(z.literal(''))
        .nullable(),
    })
    .passthrough()
    .refine(
      (data) => {
        const hasName = data.full_name !== undefined || data.fullName !== undefined;
        const hasAvatar = data.avatar_url !== undefined || data.avatarUrl !== undefined;
        const hasPhone = data.phone !== undefined;
        const hasJob = data.job_title !== undefined || data.jobTitle !== undefined;
        return hasName || hasAvatar || hasPhone || hasJob;
      },
      { message: 'Vui lòng cung cấp ít nhất một thông tin cần cập nhật' }
    ),
});


/**
 * Schema kiểm tra dữ liệu khi CẬP NHẬT TRẠNG THÁI TÀI KHOẢN (Khóa/Mở khóa)
 * Chỉ chấp nhận ACTIVE hoặc SUSPENDED
 */
export const updateUserStatusSchema = z.object({
  body: z.object({
    status: z.enum(['ACTIVE', 'SUSPENDED'], {
      message: 'Trạng thái tài khoản không hợp lệ. Chỉ chấp nhận ACTIVE hoặc SUSPENDED',
    }),
  }),
});
