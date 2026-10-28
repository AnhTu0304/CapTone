import { z } from 'zod';

/**
 * Schema kiểm tra dữ liệu đầu vào khi ĐĂNG KÝ
 */
export const registerSchema = z.object({
  body: z.object({
    email: z
      .string('Vui lòng cung cấp email')
      .trim()
      .email('Địa chỉ email không đúng định dạng'),
    password: z
      .string('Vui lòng cung cấp mật khẩu')
      .min(6, 'Mật khẩu phải có ít nhất 6 ký tự'),
    full_name: z
      .string('Vui lòng cung cấp họ và tên')
      .trim()
      .min(2, 'Họ và tên phải có ít nhất 2 ký tự')
      .max(150, 'Họ và tên không được vượt quá 150 ký tự'),
  }),
});

/**
 * Schema kiểm tra dữ liệu đầu vào khi ĐĂNG NHẬP
 */
export const loginSchema = z.object({
  body: z.object({
    email: z
      .string('Vui lòng cung cấp email hoặc tài khoản')
      .trim()
      .min(1, 'Email hoặc tài khoản không được để trống'),
    password: z
      .string('Vui lòng cung cấp mật khẩu')
      .min(1, 'Mật khẩu không được để trống'),
  }),
});

/**
 * Schema kiểm tra dữ liệu đầu vào khi ĐỔI MẬT KHẨU
 */
export const changePasswordSchema = z.object({
  body: z
    .object({
      old_password: z
        .string('Vui lòng cung cấp mật khẩu cũ')
        .min(1, 'Mật khẩu cũ không được để trống'),
      new_password: z
        .string('Vui lòng cung cấp mật khẩu mới')
        .min(6, 'Mật khẩu mới phải có ít nhất 6 ký tự'),
    })
    .refine((data) => data.old_password !== data.new_password, {
      message: 'Mật khẩu mới không được trùng với mật khẩu cũ',
      path: ['new_password'],
    }),
});

/**
 * Schema kiểm tra mã xác thực (Code/Token) khi XÁC THỰC EMAIL
 */
export const verifyEmailSchema = z.object({
  body: z
    .object({
      code: z.string().trim().optional(),
      token: z.string().trim().optional(),
    })
    .optional(),
  query: z
    .object({
      code: z.string().trim().optional(),
      token: z.string().trim().optional(),
    })
    .optional(),
}).refine(
  (data) => Boolean(data.body?.code || data.body?.token || data.query?.code || data.query?.token),
  { message: 'Vui lòng cung cấp mã xác thực được gửi về email của bạn' }
);
