import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/apiError';
import { OrganizationMemberModel, MemberStatus } from '../models/organizationMember.model';
import { OrganizationRoleCode } from '../models/organizationRole.model';

export interface IOrgMemberContext {
  organizationId: string;
  roleCode: OrganizationRoleCode;
  status: MemberStatus;
  userId: string;
}

// Mở rộng interface Request của Express để chứa context orgMember
declare global {
  namespace Express {
    interface Request {
      orgMember?: IOrgMemberContext;
    }
  }
}

/**
 * Middleware kiểm tra người dùng hiện tại có phải là thành viên hợp lệ (ACTIVE) của tổ chức hay không.
 * Tự động cho phép SUPER_ADMIN vượt qua mọi hạn chế.
 * Gắn `req.orgMember` vào Request để các middleware/controller phía sau sử dụng.
 */
export const requireOrgMember = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    if (!user || !user.id) {
      return next(new ApiError(401, 'Yêu cầu đăng nhập trước khi truy cập'));
    }

    // Trích xuất orgId từ route params (:id hoặc :orgId), body hoặc header x-organization-id
    const orgId =
      req.params.orgId ||
      req.params.id ||
      req.body?.organization_id ||
      (req.headers['x-organization-id'] as string);

    if (!orgId) {
      return next(new ApiError(400, 'Không tìm thấy định danh tổ chức (ID) trong yêu cầu'));
    }

    const tokenRoles: string[] = Array.isArray(user.roles)
      ? user.roles.map((r: string) => r.trim().toUpperCase())
      : [];

    // SUPER_ADMIN luôn có toàn quyền truy cập
    if (tokenRoles.includes('SUPER_ADMIN')) {
      req.orgMember = {
        organizationId: orgId,
        roleCode: 'SUPER_ADMIN',
        status: 'ACTIVE',
        userId: user.id,
      };
      return next();
    }

    // Kiểm tra trực tiếp trạng thái thành viên trong CSDL qua OrganizationMemberModel
    const member = await OrganizationMemberModel.findByOrgAndUser(orgId, user.id);
    if (!member || member.status !== 'ACTIVE') {
      return next(
        new ApiError(
          403,
          'Từ chối truy cập: Bạn không phải là thành viên đang hoạt động của tổ chức này'
        )
      );
    }

    req.orgMember = {
      organizationId: orgId,
      roleCode: member.role_code,
      status: member.status,
      userId: user.id,
    };

    return next();
  } catch (error) {
    return next(error);
  }
};

/**
 * Middleware kiểm tra vai trò cụ thể trong tổ chức (SME_OWNER, DEVOPS, VIEWER).
 * Tự động cho phép SUPER_ADMIN.
 * @param allowedRoles Danh sách vai trò được phép (VD: ['SME_OWNER'], ['SME_OWNER', 'DEVOPS'])
 */
export const requireOrgRole = (...allowedRoles: OrganizationRoleCode[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Nếu chưa có orgMember trong request thì tự động xác thực thành viên trước
      if (!req.orgMember) {
        await new Promise<void>((resolve, reject) => {
          requireOrgMember(req, res, (err?: any) => {
            if (err) return reject(err);
            resolve();
          });
        });
      }

      const orgMember = req.orgMember;
      if (!orgMember) {
        return next(
          new ApiError(403, 'Không thể xác định thông tin vai trò thành viên trong tổ chức')
        );
      }

      // SUPER_ADMIN bypass
      if (orgMember.roleCode === 'SUPER_ADMIN') {
        return next();
      }

      const normalizedAllowed = allowedRoles.map((r) => r.trim().toUpperCase());
      if (!normalizedAllowed.includes(orgMember.roleCode.toUpperCase())) {
        return next(
          new ApiError(
            403,
            `Từ chối truy cập: Thao tác này yêu cầu một trong các vai trò tổ chức: [${normalizedAllowed.join(
              ', '
            )}]. Vai trò hiện tại của bạn là: '${orgMember.roleCode}'`
          )
        );
      }

      return next();
    } catch (error) {
      return next(error);
    }
  };
};

/**
 * Middleware cho phép chính bản thân thành viên (Self) HOẶC Chủ sở hữu (SME_OWNER) / Super Admin
 * Ví dụ: Thành viên tự rời tổ chức (targetUserId === currentUserId) HOẶC Owner loại bỏ thành viên
 */
export const requireOrgSelfOrOwner = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.orgMember) {
      await new Promise<void>((resolve, reject) => {
        requireOrgMember(req, res, (err?: any) => {
          if (err) return reject(err);
          resolve();
        });
      });
    }

    const currentUserId = (req as any).user?.id;
    const targetUserId = req.params.userId;
    const isSelf = targetUserId && targetUserId === currentUserId;
    const isOwnerOrSuper =
      req.orgMember?.roleCode === 'SME_OWNER' || req.orgMember?.roleCode === 'SUPER_ADMIN';

    if (!isSelf && !isOwnerOrSuper) {
      return next(
        new ApiError(
          403,
          'Từ chối truy cập: Bạn chỉ có thể thao tác với chính tài khoản của mình hoặc cần quyền Chủ sở hữu (SME Owner)'
        )
      );
    }

    return next();
  } catch (error) {
    return next(error);
  }
};
