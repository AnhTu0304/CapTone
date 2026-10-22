import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { request, setActiveOrganizationId, cancelPendingRequests } from '../../../services/apiClient';
import multiTabSync, { SYNC_EVENTS } from '../../../services/multiTabSync';
import { getStoredNotifications, saveStoredNotifications } from '../../../mocks/notificationMockData';

const DashboardContext = createContext(null);

const normalizeNotification = (item) => {
  const isRead = item.read !== undefined ? Boolean(item.read) : !Boolean(item.unread);
  return {
    ...item,
    read: isRead,
    unread: !isRead,
    desc: item.desc || item.message,
    time: item.time || item.timestamp,
    link: item.link || item.actionPath,
  };
};

export const DashboardProvider = ({ children, onNavigate }) => {
  // 1. Organization State
  const [currentOrg, setCurrentOrg] = useState(() => {
    const savedId = localStorage.getItem('selfheal_active_org_id');
    const savedName = localStorage.getItem('selfheal_active_org_name');
    const savedRole = localStorage.getItem('selfheal_active_org_role') || 'SME_OWNER';
    if (!savedId) {
      return {
        id: 'org-acme',
        name: 'Acme Corporation',
        slug: 'acme-corp',
        plan: 'SME Production Pro',
        clusterCount: 3,
        role: savedRole,
        role_in_org: savedRole,
      };
    }
    return {
      id: savedId,
      name: savedName || 'Tổ chức hiện tại',
      slug: (savedName || 'org').toLowerCase().replace(/\s+/g, '-'),
      plan: 'SME Production Pro',
      clusterCount: 3,
      role: savedRole,
      role_in_org: savedRole,
    };
  });

  const [orgList, setOrgList] = useState([]);
  const [isLoadingOrgs, setIsLoadingOrgs] = useState(true);
  const [isSwitchingOrg, setIsSwitchingOrg] = useState(false);
  const [orgError, setOrgError] = useState(null);

  // 2. User & RBAC Role State ('SME_OWNER' | 'DEVOPS' | 'VIEWER')
  const [currentUserRole, setCurrentUserRole] = useState(() => {
    return localStorage.getItem('selfheal_active_org_role') || 'SME_OWNER';
  });

  // 3. Environment State
  const [currentEnv, setCurrentEnv] = useState({
    id: 'env-prod',
    name: 'production-us-east-1',
    cluster: 'k8s-prod-cluster-01',
    k8sVersion: 'v1.29.4',
    nodes: 8,
    status: 'Healthy',
  });

  const envList = [
    { id: 'env-prod', name: 'production-us-east-1', cluster: 'k8s-prod-cluster-01', status: 'Healthy' },
    { id: 'env-staging', name: 'staging-us-east-2', cluster: 'k8s-staging-cluster-02', status: 'Healthy' },
    { id: 'env-dev', name: 'dev-sandbox-cluster', cluster: 'k8s-dev-cluster-local', status: 'Warning' },
  ];

  // 4. Agent Connectivity State
  const [isAgentConnected, setIsAgentConnected] = useState(true);

  // 5. Auto-refresh & Timestamp State
  const [isAutoRefresh, setIsAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState('Vừa xong');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Trigger manual refresh
  const triggerRefresh = useCallback(() => {
    setIsRefreshing(true);
    setTimeout(() => {
      const now = new Date();
      setLastUpdated(now.toLocaleTimeString());
      setIsRefreshing(false);
    }, 400);
  }, []);

  // Chuyển đổi tổ chức có kiểm soát ngữ cảnh, xóa cache cũ và ngăn ngừa race conditions
  const switchOrganization = useCallback((orgOrId) => {
    const targetId = typeof orgOrId === 'object' && orgOrId !== null ? orgOrId.id : orgOrId;
    const target = orgList.find((o) => o.id === targetId) || (typeof orgOrId === 'object' ? orgOrId : null);

    if (!target) {
      console.warn('[DashboardContext] switchOrganization: Tổ chức không tồn tại trong danh sách truy cập');
      return false;
    }

    setIsSwitchingOrg(true);
    setOrgError(null);

    // Hủy các request API đang xử lý của tổ chức cũ
    if (cancelPendingRequests) {
      cancelPendingRequests();
    }

    const activeRole = target.role_in_org || target.role || 'SME_OWNER';

    setCurrentOrg({
      ...target,
      role: activeRole,
      role_in_org: activeRole,
    });
    setCurrentUserRole(activeRole);

    localStorage.setItem('selfheal_active_org_id', target.id);
    localStorage.setItem('selfheal_active_org_name', target.name);
    localStorage.setItem('selfheal_active_org_role', activeRole);

    if (setActiveOrganizationId) {
      setActiveOrganizationId(target.id);
    }

    triggerRefresh();
    multiTabSync.broadcast(SYNC_EVENTS.ORG_SWITCHED, {
      orgId: target.id,
      orgName: target.name,
      orgRole: activeRole,
    });

    setTimeout(() => {
      setIsSwitchingOrg(false);
    }, 200);

    return true;
  }, [orgList, triggerRefresh]);

  // Tự động tải danh sách tổ chức thật của tài khoản từ backend
  const fetchUserOrgs = useCallback(async () => {
    setIsLoadingOrgs(true);
    setOrgError(null);
    try {
      const token =
        localStorage.getItem('selfheal_auth_token') ||
        sessionStorage.getItem('admin_access_token');
      if (!token) {
        setIsLoadingOrgs(false);
        return;
      }

      const res = await request('/organizations/me/list');
      if (res && res.data) {
        const list = res.data.map((o) => ({
          id: o.id,
          name: o.name,
          slug: o.slug,
          plan: 'SME Production Pro',
          clusterCount: o.members_count || 1,
          role_in_org: o.role_in_org || 'SME_OWNER',
          role: o.role_in_org || 'SME_OWNER',
          status: o.status,
        }));
        setOrgList(list);

        const savedOrgId = localStorage.getItem('selfheal_active_org_id');
        let matched = list.find((o) => o.id === savedOrgId);

        // Fallback: nếu ID đã lưu không hợp lệ, chọn tổ chức đầu tiên được backend xác nhận
        if (!matched && list.length > 0) {
          matched = list[0];
        }

        if (matched) {
          const activeRole = matched.role_in_org || 'SME_OWNER';
          setCurrentOrg((prev) => ({
            ...prev,
            ...matched,
            role: activeRole,
            role_in_org: activeRole,
          }));
          setCurrentUserRole(activeRole);
          localStorage.setItem('selfheal_active_org_id', matched.id);
          localStorage.setItem('selfheal_active_org_name', matched.name);
          localStorage.setItem('selfheal_active_org_role', activeRole);
          if (setActiveOrganizationId) {
            setActiveOrganizationId(matched.id);
          }
        } else if (list.length === 0) {
          setCurrentOrg(null);
          setCurrentUserRole('VIEWER');
          localStorage.removeItem('selfheal_active_org_id');
          localStorage.removeItem('selfheal_active_org_name');
          localStorage.removeItem('selfheal_active_org_role');
          if (setActiveOrganizationId) {
            setActiveOrganizationId(null);
          }
        }
      }
    } catch (err) {
      setOrgError(err.message || 'Không thể tải danh sách tổ chức');
      setOrgList((prev) => {
        if (prev.length > 0) return prev;
        return [
          { id: 'org-acme', name: 'Acme Corporation', slug: 'acme-corp', role_in_org: 'SME_OWNER', role: 'SME_OWNER' },
        ];
      });
    } finally {
      setIsLoadingOrgs(false);
    }
  }, []);

  useEffect(() => {
    fetchUserOrgs();
  }, [fetchUserOrgs]);
  // Lắng nghe sự kiện chuyển đổi Organization từ các Tab khác
  useEffect(() => {
    const unsubOrg = multiTabSync.subscribe(SYNC_EVENTS.ORG_SWITCHED, (payload) => {
      if (!payload || !payload.orgId) return;
      setOrgList((currentList) => {
        const matched = currentList.find((o) => o.id === payload.orgId);
        if (matched) {
          const activeRole = matched.role_in_org || matched.role || payload.orgRole || 'SME_OWNER';
          setCurrentOrg((prev) => ({
            ...prev,
            ...matched,
            role: activeRole,
            role_in_org: activeRole,
          }));
          setCurrentUserRole(activeRole);
          localStorage.setItem('selfheal_active_org_id', matched.id);
          localStorage.setItem('selfheal_active_org_name', matched.name);
          localStorage.setItem('selfheal_active_org_role', activeRole);
          if (setActiveOrganizationId) {
            setActiveOrganizationId(matched.id);
          }
          triggerRefresh();
        }
        return currentList;
      });
    });

    return () => {
      unsubOrg();
    };
  }, [triggerRefresh]);


  // Notifications State with centralized persistence
  const [notifications, setNotifications] = useState(() => {
    return getStoredNotifications().map(normalizeNotification);
  });

  // Sidebar collapse state
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  // Auto-refresh interval (every 30s)
  useEffect(() => {
    if (!isAutoRefresh) return;
    const interval = setInterval(() => {
      const now = new Date();
      setLastUpdated(now.toLocaleTimeString());
    }, 30000);
    return () => clearInterval(interval);
  }, [isAutoRefresh]);

  const markAllNotificationsRead = () => {
    setNotifications((prev) => {
      const updated = prev.map((n) => ({ ...n, unread: false, read: true }));
      saveStoredNotifications(updated);
      return updated;
    });
  };

  const toggleNotificationRead = (id) => {
    setNotifications((prev) => {
      const updated = prev.map((n) =>
        n.id === id ? { ...n, read: !n.read, unread: n.read } : n
      );
      saveStoredNotifications(updated);
      return updated;
    });
  };

  const unreadNotifsCount = notifications.filter((n) => !n.read).length;
  const pendingApprovalsCount = 1;
  const activeIncidentsCount = 0;

  return (
    <DashboardContext.Provider
      value={{
        currentOrg,
        currentOrganizationId: currentOrg?.id || null,
        setCurrentOrg,
        orgList,
        setOrgList,
        switchOrganization,
        switchOrg: switchOrganization,
        isLoadingOrgs,
        isSwitchingOrg,
        orgError,
        fetchUserOrgs,
        refreshOrganizations: fetchUserOrgs,
        currentEnv,
        setCurrentEnv,
        envList,
        currentUserRole,
        setCurrentUserRole,
        isAgentConnected,
        setIsAgentConnected,
        isAutoRefresh,
        setIsAutoRefresh,
        lastUpdated,
        isRefreshing,
        triggerRefresh,
        notifications,
        setNotifications,
        unreadNotifsCount,
        pendingApprovalsCount,
        activeIncidentsCount,
        markAllNotificationsRead,
        toggleNotificationRead,
        isSidebarCollapsed,
        setIsSidebarCollapsed,
        isMobileNavOpen,
        setIsMobileNavOpen,
        onNavigate,
      }}
    >
      {children}
    </DashboardContext.Provider>
  );
};

export const useDashboard = () => {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error('useDashboard must be used within a DashboardProvider');
  }
  return context;
};

export const useOrganization = () => {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error('useOrganization must be used within a DashboardProvider');
  }
  return {
    currentOrg: context.currentOrg,
    currentOrganizationId: context.currentOrganizationId,
    orgList: context.orgList,
    currentUserRole: context.currentUserRole,
    isLoadingOrgs: context.isLoadingOrgs,
    isSwitchingOrg: context.isSwitchingOrg,
    orgError: context.orgError,
    switchOrganization: context.switchOrganization,
    switchOrg: context.switchOrg,
    fetchUserOrgs: context.fetchUserOrgs,
  };
};

export default DashboardContext;
