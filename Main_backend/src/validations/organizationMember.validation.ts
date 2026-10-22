import { z } from 'zod';

/**
 * Regex kiểm tra UUID v4
 */
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Schema kiểm tra dữ liệu khi MỜI THÀNH VIÊN
 */
export const inviteMemberSchema = z.object({
  params: z.object({
    id: z.string().trim().regex(uuidRegex, 'Định dạng ID tổ chức không hợp lệ (yêu cầu UUID)'),
  }),
  body: z.object({
    email: z
      .string('Email là bắt buộc')
      .trim()
      .email('Địa chỉ email không hợp lệ'),
    role_code: z
      .enum(['SME_OWNER', 'DEVOPS', 'VIEWER'], {
        message: 'Vai trò phải là một trong các giá trị: SME_OWNER, DEVOPS, VIEWER',
      })
      .default('DEVOPS'),
  }),
});

/**
 * Schema kiểm tra dữ liệu khi CẬP NHẬT THÀNH VIÊN
 */
export const updateMemberSchema = z.object({
  params: z.object({
    id: z.string().trim().regex(uuidRegex, 'Định dạng ID tổ chức không hợp lệ (yêu cầu UUID)'),
    userId: z.string().trim().regex(uuidRegex, 'Định dạng ID người dùng không hợp lệ (yêu cầu UUID)'),
  }),
  body: z
    .object({
      role_code: z
        .enum(['SME_OWNER', 'DEVOPS', 'VIEWER'], {
          message: 'Vai trò phải là một trong các giá trị: SME_OWNER, DEVOPS, VIEWER',
        })
        .optional(),
      status: z
        .enum(['ACTIVE', 'INACTIVE'], {
          message: 'Trạng thái phải là ACTIVE hoặc INACTIVE',
        })
        .optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: 'Vui lòng cung cấp ít nhất một thông tin cần cập nhật (role_code hoặc status)',
    }),
});

/**
 * Schema kiểm tra tham số URL khi thao tác với 1 thành viên (/organizations/:id/members/:userId)
 */
export const memberParamSchema = z.object({
  params: z.object({
    id: z.string().trim().regex(uuidRegex, 'Định dạng ID tổ chức không hợp lệ (yêu cầu UUID)'),
    userId: z.string().trim().regex(uuidRegex, 'Định dạng ID người dùng không hợp lệ (yêu cầu UUID)'),
  }),
});

/**
 * Schema kiểm tra tham số URL khi xem danh sách thành viên hoặc chấp nhận lời mời (/organizations/:id/members)
 */
export const orgMemberIdOnlySchema = z.object({
  params: z.object({
    id: z.string().trim().regex(uuidRegex, 'Định dạng ID tổ chức không hợp lệ (yêu cầu UUID)'),
  }),
});

/**
 * Schema kiểm tra query string khi LẤY DANH SÁCH THÀNH VIÊN (/organizations/:id/members?page=...&status=...)
 */
export const memberQuerySchema = z.object({
  params: z.object({
    id: z.string().trim().regex(uuidRegex, 'Định dạng ID tổ chức không hợp lệ (yêu cầu UUID)'),
  }),
  query: z.object({
    page: z.coerce.number().int().min(1).default(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20).optional(),
    search: z.string().trim().optional(),
    status: z.enum(['INVITED', 'ACTIVE', 'INACTIVE', 'REMOVED']).optional(),
    role: z.enum(['SME_OWNER', 'DEVOPS', 'VIEWER']).optional(),
  }),
});


/**
 * Schema kiểm tra dữ liệu khi CHẤP NHẬN LỜI MỜI BẰNG TOKEN (/organizations/invitations/accept)
 */
export const acceptInvitationByTokenSchema = z.object({
  body: z.object({
    token: z.string({ error: 'Mã token là bắt buộc' }).trim().min(1, 'Mã token không được để trống'),
  }),
});

/**
 * Schema kiểm tra URL params khi thao tác với 1 lời mời cụ thể (/organizations/:id/invitations/:invitationId)
 */
export const invitationParamSchema = z.object({
  params: z.object({
    id: z.string().trim().regex(uuidRegex, 'Định dạng ID tổ chức không hợp lệ (yêu cầu UUID)'),
    invitationId: z.string().trim().regex(uuidRegex, 'Định dạng ID lời mời không hợp lệ (yêu cầu UUID)'),
  }),
});

/**
 * Schema kiểm tra query string khi XEM DANH SÁCH LỜI MỜI (/organizations/:id/invitations)
 */
export const invitationQuerySchema = z.object({
  params: z.object({
    id: z.string().trim().regex(uuidRegex, 'Định dạng ID tổ chức không hợp lệ (yêu cầu UUID)'),
  }),
  query: z.object({
    page: z.coerce.number().int().min(1).default(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20).optional(),
    search: z.string().trim().optional(),
    status: z.enum(['PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED']).optional(),
  }),
});
