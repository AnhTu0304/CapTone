import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { authService } from '../services/authService';
import multiTabSync, { SYNC_EVENTS } from '../services/multiTabSync';

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
  // Lắng nghe sự kiện đồng bộ đa Tab (Đăng xuất / Thu hồi phiên / Đăng nhập)
  useEffect(() => {
    const unsubLogout = multiTabSync.subscribe(SYNC_EVENTS.AUTH_LOGOUT, () => {
      setToken(null);
      setUser(null);
    });
    const unsubRevoke = multiTabSync.subscribe(SYNC_EVENTS.SESSION_REVOKED, () => {
      setToken(null);
      setUser(null);
    });
    const unsubLogin = multiTabSync.subscribe(SYNC_EVENTS.AUTH_LOGIN, () => {
      const savedToken = localStorage.getItem(TOKEN_KEY);
      const savedUser = localStorage.getItem(USER_KEY);
      if (savedToken) {
        setToken(savedToken);
        try {
          if (savedUser) setUser(JSON.parse(savedUser));
        } catch {}
      }
    });
    return () => {
      unsubLogout();
      unsubRevoke();
      unsubLogin();
    };
  }, []);


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
    multiTabSync.broadcast(SYNC_EVENTS.AUTH_LOGIN);
    return profile;
  }, []);

  // Hàm Đăng nhập bằng Google
  const loginWithGoogle = useCallback(async (googleToken) => {
    const res = await authService.googleLogin(googleToken);
    const receivedToken = res?.data?.token;

    if (!receivedToken) {
      throw new Error('Không nhận được mã xác thực token từ máy chủ');
    }

    setToken(receivedToken);
    localStorage.setItem(TOKEN_KEY, receivedToken);

    let profile = res?.data?.user;
    if (!profile) {
      try {
        profile = await authService.getProfile(receivedToken);
      } catch {
        profile = {
          id: res.data?.id,
          email: res.data?.email,
          full_name: res.data?.email?.split('@')[0],
          system_roles: ['USER'],
        };
      }
    }

    setUser(profile);
    localStorage.setItem(USER_KEY, JSON.stringify(profile));
    multiTabSync.broadcast(SYNC_EVENTS.AUTH_LOGIN);
    return profile;
  }, []);

  // Hàm Đăng ký
  const register = useCallback(async ({ email, password, full_name }) => {
    try {
      sessionStorage.removeItem('selfheal_onboarding_state_v1');
      sessionStorage.removeItem('selfheal_onboarding_state_guest');
      Object.keys(sessionStorage).forEach((k) => {
        if (k.startsWith('selfheal_onboarding_state_')) sessionStorage.removeItem(k);
      });
      localStorage.removeItem('selfheal_active_org_id');
      localStorage.removeItem('selfheal_active_org_name');
    } catch {}

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
    localStorage.removeItem('selfheal_active_org_id');
    localStorage.removeItem('selfheal_active_org_name');
    localStorage.removeItem('selfheal_active_org_role');
    sessionStorage.removeItem('admin_access_token');
    try {
      sessionStorage.removeItem('selfheal_onboarding_state_v1');
      sessionStorage.removeItem('selfheal_onboarding_state_guest');
      Object.keys(sessionStorage).forEach((k) => {
        if (k.startsWith('selfheal_onboarding_state_')) sessionStorage.removeItem(k);
      });
    } catch {}
    setToken(null);
    setUser(null);
    multiTabSync.broadcast(SYNC_EVENTS.AUTH_LOGOUT);
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

  // Xác định vai trò gốc thực tế (Base Granted Role) của tài khoản
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

  // Không dùng chuyển vai trò nữa: vai trò đang kích hoạt là chính vai trò thật của tài khoản
  const activeRole = baseRole;
  const availableRoles = useMemo(() => [], []);
  const canSwitchRole = false;
  const switchRole = useCallback(() => {}, []);

  // Tiện ích lấy danh sách vai trò dạng chuẩn hóa kèm kế thừa phân cấp
  const getUserRoles = useCallback((u) => {
    const role = u ? getActualBaseRole(u) : baseRole;
    return ROLE_HIERARCHY[role] || [role, 'VIEWER'];
  }, [baseRole, getActualBaseRole, ROLE_HIERARCHY]);

  const isSuperAdmin = useCallback((u) => {
    const role = u ? getActualBaseRole(u) : baseRole;
    return role === 'SUPER_ADMIN';
  }, [baseRole, getActualBaseRole]);

  const isAdmin = useCallback((u) => {
    const role = u ? getActualBaseRole(u) : baseRole;
    return ['SUPER_ADMIN', 'ADMIN', 'SYSTEM_ADMIN'].includes(role);
  }, [baseRole, getActualBaseRole]);

  const isOwner = useCallback((u) => {
    const role = u ? getActualBaseRole(u) : baseRole;
    return ['SUPER_ADMIN', 'ADMIN', 'SYSTEM_ADMIN', 'SME_OWNER'].includes(role);
  }, [baseRole, getActualBaseRole]);

  const isDevOps = useCallback((u) => {
    const role = u ? getActualBaseRole(u) : baseRole;
    return role === 'DEVOPS';
  }, [baseRole, getActualBaseRole]);

  const isViewer = useCallback((u) => {
    const role = u ? getActualBaseRole(u) : baseRole;
    return role === 'VIEWER';
  }, [baseRole, getActualBaseRole]);

  // Tiện ích lấy vai trò hiển thị cao nhất của người dùng
  const getPrimaryRole = useCallback((u) => {
    const role = u ? getActualBaseRole(u) : baseRole;
    if (role === 'SUPER_ADMIN') return 'SUPER ADMIN';
    if (role === 'ADMIN') return 'ADMIN';
    if (role === 'SME_OWNER') return 'SME OWNER';
    if (role === 'DEVOPS') return 'DEVOPS';
    return 'VIEWER';
  }, [baseRole, getActualBaseRole]);

  const value = {
    user,
    token,
    isAuthenticated: Boolean(token && user),
    loading,
    login,
    loginWithGoogle,
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
