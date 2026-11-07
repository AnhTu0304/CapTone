import { Request, Response, NextFunction } from 'express';
import { TwoFactorService } from '../services/twoFactor.service';
import { ApiResponse } from '../utils/apiResponse';
import { ApiError } from '../utils/apiError';
import { AuditService } from '../services/audit.service';

export class TwoFactorController {
    /**
     * [GET] /api/v1/auth/2fa/status
     * Kiểm tra trạng thái 2FA của tài khoản hiện tại
     */
    public static async getStatus(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = (req as any).user?.id;
            if (!userId) {
                throw new ApiError(401, 'Không tìm thấy thông tin xác thực');
            }

            const status = await TwoFactorService.getStatus(userId);
            return ApiResponse.success(res, 'Lấy trạng thái 2FA thành công', status, 200);
        } catch (error) {
            next(error);
        }
    }

    /**
     * [POST] /api/v1/auth/2fa/setup
     * Khởi tạo secret key và tạo mã QR để người dùng quét ứng dụng Authenticator
     */
    public static async setup(req: Request, res: Response, next: NextFunction) {
        try {
            const user = (req as any).user;
            if (!user?.id) {
                throw new ApiError(401, 'Không tìm thấy thông tin xác thực');
            }

            const setupData = await TwoFactorService.setup(user.id, user.email || '');
            return ApiResponse.success(res, 'Khởi tạo cấu hình 2FA thành công', setupData, 200);
        } catch (error) {
            next(error);
        }
    }

    /**
     * [POST] /api/v1/auth/2fa/enable
     * Xác thực mã OTP 6 số đầu tiên để kích hoạt 2FA
     */
    public static async enable(req: Request, res: Response, next: NextFunction) {
        try {
            const user = (req as any).user;
            if (!user?.id) {
                throw new ApiError(401, 'Không tìm thấy thông tin xác thực');
            }

            const { code } = req.body;
            if (!code) {
                throw new ApiError(400, 'Vui lòng cung cấp mã OTP 6 số từ ứng dụng xác thực');
            }

            const result = await TwoFactorService.enable(user.id, code);

            await AuditService.recordFromRequest(req, {
                action: 'SECURITY_2FA_ENABLED',
                status: 'SUCCESS',
                user_id: user.id,
                description: `Người dùng [${user.email || user.id}] đã kích hoạt bảo mật Xác thực 2 yếu tố (2FA)`,
                metadata: { email: user.email },
            }).catch(() => {});

            return ApiResponse.success(res, result.message, result, 200);
        } catch (error) {
            next(error);
        }
    }

    /**
     * [POST] /api/v1/auth/2fa/disable
     * Tắt tính năng Xác thực 2 yếu tố (2FA)
     */
    public static async disable(req: Request, res: Response, next: NextFunction) {
        try {
            const user = (req as any).user;
            if (!user?.id) {
                throw new ApiError(401, 'Không tìm thấy thông tin xác thực');
            }

            const { password } = req.body;
            const result = await TwoFactorService.disable(user.id, password);

            await AuditService.recordFromRequest(req, {
                action: 'SECURITY_2FA_DISABLED',
                status: 'SUCCESS',
                user_id: user.id,
                description: `Người dùng [${user.email || user.id}] đã vô hiệu hóa Xác thực 2 yếu tố (2FA)`,
                metadata: { email: user.email },
            }).catch(() => {});

            return ApiResponse.success(res, result.message, result, 200);
        } catch (error) {
            next(error);
        }
    }
}
