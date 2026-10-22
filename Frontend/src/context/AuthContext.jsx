import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { authService } from '../services/authService';

const AuthContext = createContext(null);

const TOKEN_KEY = 'selfheal_auth_token';
const USER_KEY = 'selfheal_auth_user';

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || null);
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem(USER_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);

  // Khôi phục phiên đăng nhập khi tải ứng dụng
  useEffect(() => {
    const restoreSession = async () => {
      const savedToken = localStorage.getItem(TOKEN_KEY);
      if (!savedToken) {
        setUser(null);
        setLoading(false);
        return;
      }

      try {
        const profile = await authService.getProfile(savedToken);
        if (profile) {
          setUser(profile);
          localStorage.setItem(USER_KEY, JSON.stringify(profile));
        }
      } catch (err) {
        console.warn('Phiên đăng nhập hết hạn hoặc không hợp lệ:', err.message);
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        setToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    restoreSession();
  }, []);

  // Hàm Đăng nhập
  const login = useCallback(async ({ email, password }) => {
    const res = await authService.login({ email, password });
    const receivedToken = res?.data?.token;

    if (!receivedToken) {
      throw new Error('Không nhận được mã xác thực token từ máy chủ');
    }

    setToken(receivedToken);
    localStorage.setItem(TOKEN_KEY, receivedToken);

    // Lấy thông tin chi tiết đầy đủ (gồm họ tên, vai trò system_roles)
    let profile = null;
    try {
      profile = await authService.getProfile(receivedToken);
    } catch {
      // Fallback nếu profile chưa sẵn sàng
      profile = {
        id: res.data.id,
        email: res.data.email,
        full_name: res.data.email.split('@')[0],
        system_roles: ['USER'],
      };
    }

    setUser(profile);
    localStorage.setItem(USER_KEY, JSON.stringify(profile));
    return profile;
  }, []);

  // Hàm Đăng ký
  const register = useCallback(async ({ email, password, full_name }) => {
    const res = await authService.register({ email, password, full_name });
    const receivedToken = res?.data?.token;

    if (receivedToken) {
      setToken(receivedToken);
      localStorage.setItem(TOKEN_KEY, receivedToken);
    }

    const newUser = res?.data?.user || {
      email,
      full_name,
      system_roles: ['USER'],
    };

    setUser(newUser);
    localStorage.setItem(USER_KEY, JSON.stringify(newUser));
    return newUser;
  }, []);

  // Hàm Đăng xuất
  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
  }, []);

  // Tiện ích lấy chữ cái viết tắt đại diện (Initials)
  const getInitials = useCallback((name) => {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }, []);

  // Phân cấp vai trò RBAC (Role Hierarchy): Cấp cao kế thừa toàn bộ quyền của các cấp thấp hơn
  const ROLE_HIERARCHY = useMemo(() => ({
    SUPER_ADMIN: ['SUPER_ADMIN', 'ADMIN', 'SYSTEM_ADMIN', 'SME_OWNER', 'DEVOPS', 'VIEWER'],
    ADMIN: ['ADMIN', 'SYSTEM_ADMIN', 'SME_OWNER', 'DEVOPS', 'VIEWER'],
    SYSTEM_ADMIN: ['SYSTEM_ADMIN', 'ADMIN', 'SME_OWNER', 'DEVOPS', 'VIEWER'],
    SME_OWNER: ['SME_OWNER', 'DEVOPS', 'VIEWER'],
    DEVOPS: ['DEVOPS', 'VIEWER'],
    VIEWER: ['VIEWER'],
  }), []);

  // Xác định vai trò gốc thực tế (Base Granted Role) được cấp cho tài khoản
  const getActualBaseRole = useCallback((u) => {
    if (u) {
      const rawSystemRoles = (u.system_roles || []).map((r) =>
        typeof r === 'object' && r !== null ? r.role_name || r.name || r.role_id : r
      ).map((r) => String(r).toUpperCase());
      const email = String(u.email || '').toLowerCase();
      const roleStr = String(u.role || u.systemRole || '').toUpperCase();

      // 1. Quản trị viên tối cao (SUPER_ADMIN)
      if (
        rawSystemRoles.includes('SUPER_ADMIN') ||
        roleStr === 'SUPER_ADMIN' ||
        email === 'superadmin@selfheal.com' ||
        email === 'phamthaisang1710@gmail.com'
      ) {
        return 'SUPER_ADMIN';
      }

      // 2. Quản trị viên vận hành (ADMIN)
      if (
        rawSystemRoles.includes('ADMIN') ||
        rawSystemRoles.includes('SYSTEM_ADMIN') ||
        roleStr === 'ADMIN' ||
        email === 'admin@selfheal.com'
      ) {
        return 'ADMIN';
      }

      // 3. Vai trò cấp tổ chức doanh nghiệp (DevOps / Viewer / Owner)
      const rawOrgRoles = (u.organization_roles || []).map((r) =>
        typeof r === 'object' && r !== null ? r.role_code || r.role_name || r.code : r
      ).map((r) => String(r).toUpperCase());
      const orgRoleStr = String(u.organization_role || u.organizationRole || '').toUpperCase();

      if (rawOrgRoles.includes('DEVOPS') || orgRoleStr.includes('DEVOPS') || roleStr === 'DEVOPS') {
        return 'DEVOPS';
      }

      if (rawOrgRoles.includes('VIEWER') || orgRoleStr.includes('VIEWER') || roleStr === 'VIEWER') {
        return 'VIEWER';
      }

      if (
        rawOrgRoles.includes('OWNER') ||
        rawOrgRoles.includes('SME_OWNER') ||
        orgRoleStr.includes('OWNER') ||
        roleStr === 'SME_OWNER' ||
        roleStr === 'OWNER'
      ) {
        return 'SME_OWNER';
      }

      // Tài khoản User thông thường mặc định quản trị tổ chức của họ
      return 'SME_OWNER';
    }

    // Fallback cho tài khoản mẫu mock profile
    try {
      const raw = localStorage.getItem('selfheal_mock_profile_v1');
      if (raw) {
        const mock = JSON.parse(raw);
        const orgRole = String(mock.organizationRole || '').toUpperCase();
        const sysRole = String(mock.systemRole || '').toUpperCase();
        if (sysRole.includes('SUPER_ADMIN')) return 'SUPER_ADMIN';
        if (sysRole.includes('ADMIN')) return 'ADMIN';
        if (orgRole.includes('DEVOPS')) return 'DEVOPS';
        if (orgRole.includes('VIEWER')) return 'VIEWER';
        if (orgRole.includes('OWNER') || orgRole.includes('CHỦ')) return 'SME_OWNER';
      }
    } catch {
      // Ignore
    }

    return 'SME_OWNER';
  }, []);

  const baseRole = useMemo(() => getActualBaseRole(user), [user, getActualBaseRole]);

  // Danh sách các vai trò được phép chuyển đổi theo đúng phân cấp RBAC
  const availableRoles = useMemo(() => {
    const ALL_ROLES = [
      { key: 'SUPER_ADMIN', label: 'Quản Trị Tối Cao (Super Admin)', desc: 'Toàn quyền cấu hình, bảo mật và người dùng' },
      { key: 'ADMIN', label: 'Quản Trị Vận Hành (Admin)', desc: 'Quản lý toàn bộ tính năng vận hành và hạ tầng' },
      { key: 'SME_OWNER', label: 'Chủ DN (SME Owner)', desc: 'Toàn quyền quản trị tổ chức, thành viên & phê duyệt' },
      { key: 'DEVOPS', label: 'Kỹ Sư DevOps (DevOps Lead)', desc: 'Vận hành hạ tầng, tác tử, không quản lý người dùng' },
      { key: 'VIEWER', label: 'Người Xem (Viewer)', desc: 'Chỉ xem dữ liệu, giám sát an toàn' },
    ];

    // SUPER_ADMIN: Toàn quyền xem và chuyển đổi cả 5 vai trò
    if (baseRole === 'SUPER_ADMIN') {
      return ALL_ROLES;
    }

    // ADMIN: Quản trị vận hành xem được 4 vai trò (không có Super Admin)
    if (baseRole === 'ADMIN') {
      return ALL_ROLES.filter((r) => r.key !== 'SUPER_ADMIN');
    }

    // SME_OWNER (Tài khoản doanh nghiệp):
    // "nếu như tài khoản user thì không hiện admin chớ. owner thì hiện hai cái kia nữa"
    // => Hiện 3 vai trò: SME_OWNER + DEVOPS + VIEWER. Không hiển thị SUPER_ADMIN hay ADMIN.
    if (baseRole === 'SME_OWNER') {
      return ALL_ROLES.filter((r) => ['SME_OWNER', 'DEVOPS', 'VIEWER'].includes(r.key));
    }

    // DEVOPS hoặc VIEWER:
    // "còn dev hay viewer thì không được đổi sang vai trò gì"
    // => Không được phép chuyển đổi sang bất kỳ vai trò nào khác.
    return [];
  }, [baseRole]);

  const canSwitchRole = availableRoles.length > 1;

  // Vai trò mô phỏng đang chọn qua Header Switcher
  const [activeRole, setActiveRole] = useState(() => {
    const saved = localStorage.getItem('selfheal_active_role');
    return saved || 'SME_OWNER';
  });

  // Tự động kiểm tra và hiệu chỉnh activeRole: nếu vai trò lưu trữ không được phép theo baseRole thì đặt lại hợp lệ
  useEffect(() => {
    if (availableRoles.length > 0) {
      const isAllowed = availableRoles.some((r) => r.key === activeRole);
      if (!isAllowed) {
        const fallback = availableRoles[0]?.key || baseRole || 'SME_OWNER';
        setActiveRole(fallback);
        localStorage.setItem('selfheal_active_role', fallback);
      }
    } else if (baseRole) {
      if (activeRole !== baseRole) {
        setActiveRole(baseRole);
        localStorage.setItem('selfheal_active_role', baseRole);
      }
    }
  }, [baseRole, availableRoles, activeRole]);

  const switchRole = useCallback((newRole) => {
    // Chỉ cho phép chuyển đổi nếu vai trò mới nằm trong danh sách được cấp phép
    const isPermitted = availableRoles.some((r) => r.key === newRole);
    if (!isPermitted) {
      console.warn(`Tài khoản ${baseRole} không có thẩm quyền chuyển sang vai trò ${newRole}`);
      return false;
    }
    setActiveRole(newRole);
    localStorage.setItem('selfheal_active_role', newRole);
    return true;
  }, [availableRoles, baseRole]);

  // Tiện ích lấy danh sách vai trò dạng chuẩn hóa kèm kế thừa phân cấp
  const getUserRoles = useCallback((u) => {
    if (activeRole) {
      return ROLE_HIERARCHY[activeRole] || [activeRole, 'VIEWER'];
    }

    if (!u) return ['VIEWER'];
    const rolesSet = new Set();

    // 1. system_roles (array of strings or objects)
    const rawSystemRoles = u.system_roles || [];
    if (Array.isArray(rawSystemRoles)) {
      rawSystemRoles.forEach((r) => {
        const val = typeof r === 'object' && r !== null ? r.role_name || r.name || r.role_id : r;
        if (val) rolesSet.add(String(val).trim().toUpperCase());
      });
    }

    // 2. systemRole / role string
    if (u.systemRole) rolesSet.add(String(u.systemRole).trim().toUpperCase());
    if (u.role) rolesSet.add(String(u.role).trim().toUpperCase());

    // 3. organization_roles
    const rawOrgRoles = u.organization_roles || [];
    if (Array.isArray(rawOrgRoles)) {
      rawOrgRoles.forEach((r) => {
        const val = typeof r === 'object' && r !== null ? r.role_code || r.role_name || r.code : r;
        if (val) rolesSet.add(String(val).trim().toUpperCase());
      });
    }

    // 4. organization_role / organizationRole string
    if (u.organization_role) rolesSet.add(String(u.organization_role).trim().toUpperCase());
    if (u.organizationRole) rolesSet.add(String(u.organizationRole).trim().toUpperCase());

    // 5. roles array
    if (Array.isArray(u.roles)) {
      u.roles.forEach((r) => {
        if (r) rolesSet.add(String(r).trim().toUpperCase());
      });
    }

    const rawList = Array.from(rolesSet);
    if (rawList.length === 0) return ['VIEWER'];

    // Mở rộng quyền theo phân cấp (Cấp cao có toàn bộ quyền của cấp thấp)
    const expandedSet = new Set(rawList);
    rawList.forEach((r) => {
      const inherited = ROLE_HIERARCHY[r] || [];
      inherited.forEach((inh) => expandedSet.add(inh));
    });

    return Array.from(expandedSet);
  }, [activeRole, ROLE_HIERARCHY]);

  const isSuperAdmin = useCallback((u) => {
    if (activeRole) return activeRole === 'SUPER_ADMIN';
    const roles = getUserRoles(u);
    return roles.includes('SUPER_ADMIN');
  }, [activeRole, getUserRoles]);

  const isAdmin = useCallback((u) => {
    if (activeRole) return ['SUPER_ADMIN', 'ADMIN', 'SYSTEM_ADMIN'].includes(activeRole);
    const roles = getUserRoles(u);
    return roles.some((r) => ['SUPER_ADMIN', 'ADMIN', 'SYSTEM_ADMIN'].includes(r));
  }, [activeRole, getUserRoles]);

  const isOwner = useCallback((u) => {
    if (activeRole) return ['SUPER_ADMIN', 'ADMIN', 'SYSTEM_ADMIN', 'SME_OWNER'].includes(activeRole);
    const roles = getUserRoles(u);
    return roles.some((r) => ['SUPER_ADMIN', 'ADMIN', 'SYSTEM_ADMIN', 'SME_OWNER', 'OWNER'].includes(r));
  }, [activeRole, getUserRoles]);

  const isDevOps = useCallback((u) => {
    if (activeRole) return activeRole === 'DEVOPS';
    const roles = getUserRoles(u);
    return roles.includes('DEVOPS') && !isAdmin(u) && !isOwner(u);
  }, [activeRole, getUserRoles, isAdmin, isOwner]);

  const isViewer = useCallback((u) => {
    if (activeRole) return activeRole === 'VIEWER';
    if (!u) return true;
    if (isAdmin(u) || isDevOps(u) || isOwner(u)) return false;
    return true;
  }, [activeRole, isAdmin, isDevOps, isOwner]);

  // Tiện ích lấy vai trò hiển thị cao nhất của người dùng
  const getPrimaryRole = useCallback((u) => {
    if (activeRole) {
      if (activeRole === 'SUPER_ADMIN') return 'SUPER ADMIN';
      if (activeRole === 'ADMIN') return 'ADMIN';
      if (activeRole === 'SME_OWNER') return 'SME OWNER';
      if (activeRole === 'DEVOPS') return 'DEVOPS';
      return 'VIEWER';
    }
    if (!u) return 'VIEWER';
    if (isSuperAdmin(u)) return 'SUPER ADMIN';
    if (isAdmin(u)) return 'ADMIN';
    if (isDevOps(u)) return 'DEVOPS';
    return 'VIEWER';
  }, [activeRole, isSuperAdmin, isAdmin, isDevOps]);

  const value = {
    user,
    token,
    isAuthenticated: Boolean(token && user),
    loading,
    login,
    register,
    logout,
    getInitials,
    getUserRoles,
    isSuperAdmin,
    isAdmin,
    isOwner,
    isDevOps,
    isViewer,
    getPrimaryRole,
    activeRole,
    switchRole,
    baseRole,
    availableRoles,
    canSwitchRole,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  return context || {};
};

export default AuthContext;
