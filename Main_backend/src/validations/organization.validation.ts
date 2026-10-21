import { z } from 'zod';

/**
 * Regex kiểm tra slug URL hợp lệ (chỉ chữ thường, số và dấu gạch ngang)
 */
const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Regex kiểm tra UUID v4
 */
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Schema kiểm tra dữ liệu khi TẠO MỚI TỔ CHỨC
 */
export const createOrganizationSchema = z.object({
  body: z.object({
    name: z
      .string('Tên tổ chức là bắt buộc')
      .trim()
      .min(2, 'Tên tổ chức phải có ít nhất 2 ký tự')
      .max(150, 'Tên tổ chức không được vượt quá 150 ký tự'),
    slug: z
      .string()
      .trim()
      .toLowerCase()
      .min(2, 'Slug phải có ít nhất 2 ký tự')
      .max(150, 'Slug không được vượt quá 150 ký tự')
      .regex(slugRegex, 'Slug chỉ được chứa chữ cái thường, số và dấu gạch ngang (-)')
      .optional(),
    type: z.string().trim().max(50, 'Loại hình không được vượt quá 50 ký tự').optional(),
    description: z.string().trim().optional(),
    // Profile mở rộng
    email: z.string().trim().email('Email liên hệ không hợp lệ').optional().or(z.literal('')),
    phone: z.string().trim().max(30, 'Số điện thoại không vượt quá 30 ký tự').optional(),
    website: z.string().trim().url('Website phải là URL hợp lệ').optional().or(z.literal('')),
    address: z.string().trim().optional(),
    city: z.string().trim().max(100, 'Thành phố không vượt quá 100 ký tự').optional(),
    country: z.string().trim().max(100, 'Quốc gia không vượt quá 100 ký tự').optional(),
    timezone: z.string().trim().max(100, 'Múi giờ không hợp lệ').default('Asia/Ho_Chi_Minh').optional(),
  }),
});

/**
 * Schema kiểm tra dữ liệu khi CẬP NHẬT TỔ CHỨC
 */
export const updateOrganizationSchema = z.object({
  body: z
    .object({
      name: z.string().trim().min(2, 'Tên tổ chức phải có ít nhất 2 ký tự').max(150).optional(),
      type: z.string().trim().max(50).optional(),
      description: z.string().trim().optional(),
      status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).optional(),
      // Profile mở rộng
      email: z.string().trim().email('Email liên hệ không hợp lệ').optional().or(z.literal('')),
      phone: z.string().trim().max(30).optional(),
      website: z.string().trim().url('Website phải là URL hợp lệ').optional().or(z.literal('')),
      address: z.string().trim().optional(),
      city: z.string().trim().max(100).optional(),
      country: z.string().trim().max(100).optional(),
      timezone: z.string().trim().max(100).optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: 'Vui lòng cung cấp ít nhất một thông tin cần cập nhật',
    }),
});

/**
 * Schema kiểm tra ID tổ chức trên URL Params (/organizations/:id)
 */
export const orgIdParamSchema = z.object({
  params: z.object({
    id: z
      .string('Vui lòng cung cấp ID tổ chức')
      .trim()
      .regex(uuidRegex, 'Định dạng ID tổ chức không hợp lệ (yêu cầu UUID)'),
  }),
});

/**
 * Schema kiểm tra query string khi LẤY DANH SÁCH & TÌM KIẾM TỔ CHỨC (/organizations?page=...&limit=...)
 */
export const orgQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(10).optional(),
    search: z.string().trim().optional(),
    status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).optional(),
    sort_by: z.enum(['created_at', 'name', 'status']).default('created_at').optional(),
    order: z.enum(['ASC', 'DESC', 'asc', 'desc']).default('DESC').optional(),
  }),
});

/**
 * Schema kiểm tra dữ liệu khi CẬP NHẬT TRẠNG THÁI TỔ CHỨC ([2.12])
 * PATCH /api/v1/organizations/:id/status
 */
export const updateOrgStatusSchema = z.object({
  body: z.object({
    status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED'], {
      message: 'Trạng thái tổ chức phải là một trong các giá trị: ACTIVE, INACTIVE, SUSPENDED',
    }),
    reason: z.string().trim().max(500, 'Lý do thay đổi trạng thái không vượt quá 500 ký tự').optional(),
  }),
});
