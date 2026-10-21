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

  // Vai trò mô phỏng đang chọn qua Header Switcher
  const [activeRole, setActiveRole] = useState(() => {
    return localStorage.getItem('selfheal_active_role') || null;
  });

  const switchRole = useCallback((newRole) => {
    setActiveRole(newRole || null);
    if (newRole) {
      localStorage.setItem('selfheal_active_role', newRole);
    } else {
      localStorage.removeItem('selfheal_active_role');
    }
  }, []);

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
    const roles = getUserRoles(u);
    return roles.includes('SUPER_ADMIN');
  }, [getUserRoles]);

  const isAdmin = useCallback((u) => {
    const roles = getUserRoles(u);
    return roles.some((r) => ['SUPER_ADMIN', 'ADMIN', 'SYSTEM_ADMIN'].includes(r));
  }, [getUserRoles]);

  const isOwner = useCallback((u) => {
    const roles = getUserRoles(u);
    return roles.some((r) => ['SUPER_ADMIN', 'ADMIN', 'SYSTEM_ADMIN', 'SME_OWNER', 'OWNER'].includes(r));
  }, [getUserRoles]);

  const isDevOps = useCallback((u) => {
    const roles = getUserRoles(u);
    return roles.includes('DEVOPS') && !isAdmin(u);
  }, [getUserRoles, isAdmin]);

  const isViewer = useCallback((u) => {
    if (activeRole === 'VIEWER') return true;
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
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  return context || {};
};

export default AuthContext;
