import { Request, Response, NextFunction } from 'express';
import { ZodType, ZodError } from 'zod';
import { ApiError } from '../utils/apiError';

/**
 * Middleware xác thực dữ liệu đầu vào sử dụng Zod schema
 * Tự động kiểm tra body, query, params trước khi chuyển tới Controller
 */
export const validate = (schema: ZodType) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
        headers: req.headers,
      });
      return next();
    } catch (error) {
      if (error instanceof ZodError) {
        // Trích xuất danh sách lỗi chi tiết theo từng field
        const details = error.issues.map((issue) => ({
          field: issue.path.slice(1).join('.') || issue.path[0]?.toString() || 'unknown',
          message: issue.message,
        }));

        const primaryMessage = error.issues[0]?.message || 'Dữ liệu đầu vào không hợp lệ';
        return next(new ApiError(400, primaryMessage, details));
      }
      return next(error);
    }
  };
};
