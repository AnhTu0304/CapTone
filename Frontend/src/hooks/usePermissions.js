/**
 * @file usePermissions.js
 * @description Enterprise Permission Hook & RBAC Gate Helper for Tenant Workspaces.
 * 
 * Xác định quyền hạn dựa trên vai trò thực tế của người dùng trong Tổ chức đang chọn (Tenant Role),
 * kết hợp với quyền quản trị hệ thống tối cao (SUPER_ADMIN, ADMIN).
 * 
 * Nguyên tắc:
 * 1. SUPER_ADMIN / ADMIN luôn có toàn quyền (Bypass).
 * 2. SME_OWNER: Toàn quyền quản trị tổ chức, thành viên, cài đặt, xóa tài nguyên, và phê duyệt Human-in-the-Loop (HITL).
 * 3. DEVOPS: Quyền vận hành kỹ thuật (tạo/sửa Môi trường, Agent, Cụm K8s, Chính sách tự phục hồi), không có quyền quản trị thành viên/tổ chức hoặc xóa tài nguyên cốt lõi.
 * 4. VIEWER: Quyền chỉ xem (Read-only), không được kích hoạt thao tác ghi/xóa/phê duyệt nào.
 */

import { useDashboard } from '../pages/Dashboard/context/DashboardContext';
import { useAuth } from '../context/AuthContext';

export const PERMISSIONS = {
  // Quản trị tổ chức & thành viên
  ORG_MANAGE: 'ORG_MANAGE',
  ORG_DELETE: 'ORG_DELETE',

  // Môi trường & Hạ tầng
  ENV_MANAGE: 'ENV_MANAGE',
  ENV_DELETE: 'ENV_DELETE',

  // Agent & Tokens
  AGENT_MANAGE: 'AGENT_MANAGE',
  AGENT_DELETE: 'AGENT_DELETE',

  // Cơ chế Tự phục hồi & Cổng phê duyệt HITL
  HITL_APPROVE: 'HITL_APPROVE',
  POLICY_MANAGE: 'POLICY_MANAGE',

  // Giám sát & Báo cáo
  METRICS_VIEW: 'METRICS_VIEW',
  LOGS_VIEW: 'LOGS_VIEW',

  // Cài đặt hệ thống
  SETTINGS_MANAGE: 'SETTINGS_MANAGE',
};

export const usePermissions = () => {
  let dashboardContext = null;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    dashboardContext = useDashboard();
  } catch {
    dashboardContext = null;
  }

  const auth = useAuth?.() || null;
  const user = auth?.user || null;

  // Quyền quản trị hệ thống tối cao
  const isSuperAdmin = auth?.isSuperAdmin ? auth.isSuperAdmin(user) : false;
  const isSystemAdmin = auth?.isAdmin ? auth.isAdmin(user) : false;

  // Lấy vai trò trong Tổ chức đang kích hoạt
  const rawRole = (
    dashboardContext?.currentOrg?.role_in_org ||
    dashboardContext?.currentOrg?.role ||
    dashboardContext?.currentUserRole ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('selfheal_active_org_role') : null) ||
    'SME_OWNER'
  ).toUpperCase();
  const normalizedRole = rawRole.replace(/\s+/g, '_');
  const activeRole = normalizedRole;

  const isOwner = isSuperAdmin || isSystemAdmin || normalizedRole === 'SME_OWNER' || normalizedRole === 'PLATFORM_ADMIN' || normalizedRole === 'OWNER' || normalizedRole === 'ADMIN';
  const isDevOps = (normalizedRole === 'DEVOPS' || (auth?.isDevOps && auth.isDevOps(user))) && !isOwner;
  const isViewer = (normalizedRole === 'VIEWER' || (auth?.isViewer && auth.isViewer(user))) && !isOwner && !isDevOps;

  /**
   * Kiểm tra quyền cụ thể
   * @param {string} permission - Một trong các giá trị của PERMISSIONS
   * @returns {boolean}
   */
  const can = (permission) => {
    if (isSuperAdmin || isSystemAdmin) return true;

    switch (permission) {
      // Nhóm thao tác chỉ Chủ doanh nghiệp (SME Owner) hoặc Quản trị hệ thống
      case PERMISSIONS.ORG_MANAGE:
      case PERMISSIONS.ORG_DELETE:
      case PERMISSIONS.ENV_DELETE:
      case PERMISSIONS.AGENT_DELETE:
      case PERMISSIONS.HITL_APPROVE:
      case PERMISSIONS.SETTINGS_MANAGE:
        return isOwner;

      // Nhóm thao tác Kỹ thuật (Owner hoặc DevOps)
      case PERMISSIONS.ENV_MANAGE:
      case PERMISSIONS.AGENT_MANAGE:
      case PERMISSIONS.POLICY_MANAGE:
        return isOwner || isDevOps;

      // Nhóm quyền xem (Viewer, DevOps, Owner đều được)
      case PERMISSIONS.METRICS_VIEW:
      case PERMISSIONS.LOGS_VIEW:
        return true;

      default:
        return false;
    }
  };

  return {
    role: activeRole,
    isOwner,
    isDevOps,
    isViewer,
    isSuperAdmin,
    isSystemAdmin,
    can,
    canManageOrg: can(PERMISSIONS.ORG_MANAGE),
    canApproveHitl: can(PERMISSIONS.HITL_APPROVE),
    canManageEnv: can(PERMISSIONS.ENV_MANAGE),
    canDeleteEnv: can(PERMISSIONS.ENV_DELETE),
    canManageAgents: can(PERMISSIONS.AGENT_MANAGE),
    canDeleteAgents: can(PERMISSIONS.AGENT_DELETE),
    canManagePolicies: can(PERMISSIONS.POLICY_MANAGE),
  };
};

export default usePermissions;
