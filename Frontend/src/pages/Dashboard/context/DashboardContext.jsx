import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { request, setActiveOrganizationId, cancelPendingRequests } from '../../../services/apiClient';
import multiTabSync, { SYNC_EVENTS } from '../../../services/multiTabSync';

import { clusterService } from '../../../services/clusterService';
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
  // Ref để chống race condition khi chuyển đổi tổ chức / tải cụm K8s
  const activeOrgFetchIdRef = useRef(null);

  // 1. Organization State
  const [currentOrg, setCurrentOrg] = useState(() => {
    const savedId = localStorage.getItem('selfheal_active_org_id');
    const savedName = localStorage.getItem('selfheal_active_org_name');
    const savedRole = localStorage.getItem('selfheal_active_org_role') || 'SME_OWNER';
    if (!savedId || savedId === 'org-empty') {
      return null;
    }
    return {
      id: savedId,
      name: savedName || 'Tổ chức hiện tại',
      slug: (savedName || 'org').toLowerCase().replace(/\s+/g, '-'),
      plan: 'SME Production Pro',
      clusterCount: 0,
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
    return localStorage.getItem('selfheal_active_org_role') || null;
  });

  // 3. Dynamic Environment & K8s Cluster State
  const [currentEnv, setCurrentEnv] = useState(() => {
    const savedClusterId = localStorage.getItem('selfheal_active_cluster_id');
    const savedClusterName = localStorage.getItem('selfheal_active_cluster_name');
    const savedEnvName = localStorage.getItem('selfheal_active_env_name');
    if (!savedClusterId || savedClusterId === 'k8s-cluster-01') {
      return null;
    }
    return {
      id: savedClusterId,
      clusterId: savedClusterId,
      name: `${savedEnvName || 'Production'} / ${savedClusterName || savedClusterId}`,
      displayName: `${savedEnvName || 'Production'} / ${savedClusterName || savedClusterId}`,
      cluster: savedClusterName || savedClusterId,
      envName: savedEnvName || 'Production',
      status: 'Ready',
      agentStatus: 'PENDING',
    };
  });

  const [envList, setEnvList] = useState([]);
  const [isLoadingEnvs, setIsLoadingEnvs] = useState(false);

  // Tự động tải danh sách Môi trường & Cụm K8s thực tế theo Tổ chức đang chọn
  const fetchOrgEnvironmentsAndClusters = useCallback(async (orgId) => {
    if (!orgId || orgId.startsWith('sandbox-') || orgId === 'org-empty') {
      setEnvList([]);
      setCurrentEnv(null);
      setIsAgentConnected(false);
      return;
    }
    activeOrgFetchIdRef.current = orgId;
    setIsLoadingEnvs(true);
    try {
      const clusters = await clusterService.getClustersByOrg(orgId);
      // Ngăn race-condition: nếu orgId không còn là yêu cầu mới nhất, bỏ qua
      if (activeOrgFetchIdRef.current !== orgId) return;

      if (Array.isArray(clusters) && clusters.length > 0) {
        const mapped = clusters.map((c) => ({
          id: c.id,
          clusterId: c.id,
          name: `${c.environment_name || 'Production'} / ${c.name}`,
          displayName: `${c.environment_name || 'Production'} / ${c.name}`,
          cluster: c.name,
          envName: c.environment_name || 'Production',
          environment_type: c.environment_type,
          environment_id: c.environment_id,
          nodes: c.nodes_count || 0,
          pods: c.pods_count || 0,
          status: c.agent_status === 'ONLINE' ? 'Healthy' : (c.status === 'CONNECTED' ? 'Ready' : 'Pending'),
          agentStatus: c.agent_status || 'PENDING',
        }));
        setEnvList(mapped);

        const savedClusterId = localStorage.getItem('selfheal_active_cluster_id');
        let active = mapped.find((item) => item.id === savedClusterId);
        if (!active) {
          active = mapped.find((item) => item.agentStatus === 'ONLINE') || mapped[0];
        }
        if (active) {
          setCurrentEnv(active);
          setIsAgentConnected(active.agentStatus === 'ONLINE');
          localStorage.setItem('selfheal_active_cluster_id', active.id);
          localStorage.setItem('selfheal_active_cluster_name', active.cluster);
          localStorage.setItem('selfheal_active_env_name', active.envName);
        }
      } else {
        // Tổ chức này không có Cụm K8s nào trong DB
        setEnvList([]);
        setCurrentEnv(null);
        setIsAgentConnected(false);
        localStorage.removeItem('selfheal_active_cluster_id');
        localStorage.removeItem('selfheal_active_cluster_name');
        localStorage.removeItem('selfheal_active_env_name');
      }
    } catch (err) {
      console.warn('[DashboardContext] Lỗi tải môi trường & cụm của tổ chức:', err);
      if (activeOrgFetchIdRef.current === orgId) {
        setEnvList([]);
        setCurrentEnv(null);
        setIsAgentConnected(false);
      }
    } finally {
      if (activeOrgFetchIdRef.current === orgId) {
        setIsLoadingEnvs(false);
      }
    }
  }, []);

  useEffect(() => {
    if (currentOrg?.id && !currentOrg.id.startsWith('sandbox-') && currentOrg.id !== 'org-empty') {
      fetchOrgEnvironmentsAndClusters(currentOrg.id);
    } else {
      setCurrentEnv(null);
      setEnvList([]);
      setIsAgentConnected(false);
    }
  }, [currentOrg?.id, fetchOrgEnvironmentsAndClusters]);

  // 4. Agent Connectivity State - Đồng bộ động theo cụm K8s đang chọn
  const [isAgentConnected, setIsAgentConnected] = useState(() => currentEnv?.agentStatus === 'ONLINE');
  useEffect(() => {
    setIsAgentConnected(currentEnv?.agentStatus === 'ONLINE');
  }, [currentEnv?.agentStatus, currentEnv?.id]);

  // 5. Auto-refresh & Timestamp State
  const [isAutoRefresh, setIsAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState('Vừa xong');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Trigger manual refresh
  const triggerRefresh = useCallback(() => {
    setIsRefreshing(true);
    if (currentOrg?.id) {
      fetchOrgEnvironmentsAndClusters(currentOrg.id);
    }
    setTimeout(() => {
      const now = new Date();
      setLastUpdated(now.toLocaleTimeString());
      setIsRefreshing(false);
    }, 400);
  }, [currentOrg?.id, fetchOrgEnvironmentsAndClusters]);

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

    // NGAY LẬP TỨC: Xóa cụm K8s của tổ chức cũ để tránh rò rỉ dữ liệu hoặc hiển thị sai lệch
    setCurrentEnv(null);
    setEnvList([]);
    setIsAgentConnected(false);
    localStorage.removeItem('selfheal_active_cluster_id');
    localStorage.removeItem('selfheal_active_cluster_name');
    localStorage.removeItem('selfheal_active_env_name');

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

    // Tải ngay cụm K8s thuộc tổ chức mới
    fetchOrgEnvironmentsAndClusters(target.id);

    multiTabSync.broadcast(SYNC_EVENTS.ORG_SWITCHED, {
      orgId: target.id,
      orgName: target.name,
      orgRole: activeRole,
    });

    setTimeout(() => {
      setIsSwitchingOrg(false);
    }, 200);

    return true;
  }, [orgList, fetchOrgEnvironmentsAndClusters]);

  // Tự động tải danh sách tổ chức thật của tài khoản từ backend
  const fetchUserOrgs = useCallback(async () => {
    setIsLoadingOrgs(true);
    setOrgError(null);
    try {
      const token =
        sessionStorage.getItem('admin_access_token') ||
        localStorage.getItem('admin_access_token') ||
        localStorage.getItem('selfheal_auth_token') ||
        localStorage.getItem('token');
      if (!token) {
        setIsLoadingOrgs(false);
        return;
      }

      const res = await request('/organizations/me/list');
      if (res && res.data) {
        const rawOrgs = Array.isArray(res.data) ? res.data : [];

        const list = rawOrgs.map((o) => ({
          id: o.id,
          name: o.name,
          slug: o.slug,
          plan: 'SME Production Pro',
          clusterCount: o.members_count || 0,
          role_in_org: o.role_in_org || 'VIEWER',
          role: o.role_in_org || 'VIEWER',
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
        } else {
          // Người dùng không có Organization nào (list rỗng)
          setCurrentOrg(null);
          setCurrentUserRole(null);
          setCurrentEnv(null);
          setEnvList([]);
          setIsAgentConnected(false);
          localStorage.removeItem('selfheal_active_org_id');
          localStorage.removeItem('selfheal_active_org_name');
          localStorage.removeItem('selfheal_active_org_role');
          localStorage.removeItem('selfheal_active_cluster_id');
          localStorage.removeItem('selfheal_active_cluster_name');
          localStorage.removeItem('selfheal_active_env_name');
          if (setActiveOrganizationId) {
            setActiveOrganizationId(null);
          }
        }
      }
    } catch (err) {
      console.warn('[DashboardContext] Lỗi tải danh sách tổ chức:', err);
      setOrgError(err.message || 'Không thể tải danh sách tổ chức');
      setOrgList([]);
      setCurrentOrg(null);
      setCurrentEnv(null);
      setEnvList([]);
    } finally {
      setIsLoadingOrgs(false);
    }
  }, []);

  useEffect(() => {
    fetchUserOrgs();
  }, [fetchUserOrgs]);

  // Lắng nghe sự kiện chuyển đổi Organization, Login, Logout từ các Tab khác
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
          fetchOrgEnvironmentsAndClusters(matched.id);
        }
        return currentList;
      });
    });

    const unsubLogout = multiTabSync.subscribe(SYNC_EVENTS.AUTH_LOGOUT, () => {
      setCurrentOrg(null);
      setOrgList([]);
      setCurrentEnv(null);
      setEnvList([]);
      setIsAgentConnected(false);
      localStorage.removeItem('selfheal_active_org_id');
      localStorage.removeItem('selfheal_active_org_name');
      localStorage.removeItem('selfheal_active_org_role');
      localStorage.removeItem('selfheal_active_cluster_id');
      localStorage.removeItem('selfheal_active_cluster_name');
      localStorage.removeItem('selfheal_active_env_name');
    });

    const unsubLogin = multiTabSync.subscribe(SYNC_EVENTS.AUTH_LOGIN, () => {
      fetchUserOrgs();
    });

    return () => {
      unsubOrg();
      unsubLogout();
      unsubLogin();
    };
  }, [fetchOrgEnvironmentsAndClusters, fetchUserOrgs]);

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
        isLoadingEnvs,
        fetchOrgEnvironmentsAndClusters,
        refreshClusters: () => {
          if (currentOrg?.id) fetchOrgEnvironmentsAndClusters(currentOrg.id);
        },
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
