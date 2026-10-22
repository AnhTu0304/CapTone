import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getStoredNotifications, saveStoredNotifications } from '../../../mocks/notificationMockData';
import { useAuth } from '../../../context/AuthContext';
import { request } from '../../../services/apiClient';

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
  const auth = useAuth?.() || {};

  // 1. Organization & Environment State with dynamic persistence from Onboarding/localStorage
  const [currentOrg, setCurrentOrgState] = useState(() => {
    try {
      const activeId = localStorage.getItem('selfheal_active_org_id');
      const activeName = localStorage.getItem('selfheal_active_org_name');
      if (activeId && activeName) {
        return {
          id: activeId,
          name: activeName,
          slug: activeName.toLowerCase().replace(/\s+/g, '-'),
          plan: 'SME Production Pro',
          clusterCount: 1,
        };
      }
    } catch (e) {
      // ignore
    }
    return {
      id: 'org-acme',
      name: 'Acme Corporation',
      slug: 'acme-corp',
      plan: 'SME Production Pro',
      clusterCount: 3,
    };
  });

  const setCurrentOrg = (newOrg) => {
    setCurrentOrgState(newOrg);
    if (newOrg?.id) {
      try {
        localStorage.setItem('selfheal_active_org_id', newOrg.id);
        if (newOrg.name) {
          localStorage.setItem('selfheal_active_org_name', newOrg.name);
        }
      } catch (e) {
        // ignore
      }
    }
  };

  const [orgList, setOrgList] = useState(() => {
    const baseList = [
      { id: 'org-acme', name: 'Acme Corporation', slug: 'acme-corp' },
      { id: 'org-nexus', name: 'Nexus Logistics', slug: 'nexus-logistics' },
      { id: 'org-finflow', name: 'FinFlow Pay', slug: 'finflow-pay' },
    ];
    try {
      const activeId = localStorage.getItem('selfheal_active_org_id');
      const activeName = localStorage.getItem('selfheal_active_org_name');
      if (activeId && activeName) {
        const found = baseList.find((o) => o.id === activeId);
        if (!found) {
          return [
            { id: activeId, name: activeName, slug: activeName.toLowerCase().replace(/\s+/g, '-') },
            ...baseList,
          ];
        }
      }
    } catch (e) {
      // ignore
    }
    return baseList;
  });

  // Tải danh sách Tổ chức thật 100% từ Database PostgreSQL
  const refreshOrganizations = useCallback(async () => {
    try {
      let orgs = [];
      // 1. Thử lấy danh sách tổ chức của user hiện tại
      try {
        const res = await request('/organizations/me/list');
        if (res?.success && Array.isArray(res.data) && res.data.length > 0) {
          orgs = res.data;
        }
      } catch (e) {
        // ignore
      }

      // 2. Nếu không có (ví dụ platform admin), lấy toàn bộ danh sách tổ chức hệ thống
      if (orgs.length === 0) {
        try {
          const allRes = await request('/organizations');
          if (allRes?.success) {
            orgs = Array.isArray(allRes.data?.items)
              ? allRes.data.items
              : (Array.isArray(allRes.data) ? allRes.data : []);
          }
        } catch (e) {
          // ignore
        }
      }

      if (orgs.length > 0) {
        const formattedOrgs = orgs.map((o) => ({
          id: o.id,
          name: o.name,
          slug: o.slug || (o.name ? o.name.toLowerCase().replace(/\s+/g, '-') : 'org'),
          plan: o.plan || 'SME Production Pro',
          clusterCount: o.clusters_count || o.cluster_count || 1,
        }));

        setOrgList(formattedOrgs);

        // Chuẩn hóa tổ chức hiện hành sang tổ chức thật từ CSDL
        setCurrentOrgState((prev) => {
          const storedId = localStorage.getItem('selfheal_active_org_id');
          const matchedByStored = storedId && formattedOrgs.find((o) => o.id === storedId);
          if (matchedByStored) return matchedByStored;

          const matchedByPrev = prev?.id && formattedOrgs.find((o) => o.id === prev.id);
          if (matchedByPrev && !matchedByPrev.id.startsWith('org-')) return matchedByPrev;

          const firstReal = formattedOrgs[0];
          try {
            localStorage.setItem('selfheal_active_org_id', firstReal.id);
            localStorage.setItem('selfheal_active_org_name', firstReal.name);
          } catch {}
          return firstReal;
        });
      }
    } catch (err) {
      console.warn('[DashboardContext] Lỗi đồng bộ tổ chức từ Database:', err);
    }
  }, []);

  useEffect(() => {
    refreshOrganizations();
  }, [refreshOrganizations, auth?.token]);

  const [currentEnv, setCurrentEnv] = useState(() => {
    try {
      const envName = localStorage.getItem('selfheal_active_env_name');
      const clusterName = localStorage.getItem('selfheal_active_cluster_name');
      if (envName) {
        return {
          id: 'env-active',
          name: envName,
          cluster: clusterName || 'k8s-prod-cluster-01',
          k8sVersion: 'v1.29.4',
          nodes: 3,
          status: 'Healthy',
        };
      }
    } catch (e) {
      // ignore
    }
    return {
      id: 'env-prod',
      name: 'production-us-east-1',
      cluster: 'k8s-prod-cluster-01',
      k8sVersion: 'v1.29.4',
      nodes: 8,
      status: 'Healthy',
    };
  });

  const envList = [
    { id: 'env-prod', name: 'production-us-east-1', cluster: 'k8s-prod-cluster-01', status: 'Healthy' },
    { id: 'env-staging', name: 'staging-us-east-2', cluster: 'k8s-staging-cluster-02', status: 'Healthy' },
    { id: 'env-dev', name: 'dev-sandbox-cluster', cluster: 'k8s-dev-cluster-local', status: 'Warning' },
  ];

  // 2. User & RBAC Role State ('SME_OWNER' | 'DEVOPS' | 'VIEWER')
  const [currentUserRole, setCurrentUserRole] = useState(() => {
    return auth?.activeRole || 'SME_OWNER';
  });

  useEffect(() => {
    if (auth?.activeRole && auth.activeRole !== currentUserRole) {
      setCurrentUserRole(auth.activeRole);
    }
  }, [auth?.activeRole, currentUserRole]);

  // 3. Agent Connectivity State (Toggleable to demo honest Empty State)
  const [isAgentConnected, setIsAgentConnected] = useState(true);

  // 4. Auto-refresh & Timestamp State
  const [isAutoRefresh, setIsAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState('Vừa xong');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // 5. Notifications State with centralized persistence
  const [notifications, setNotifications] = useState(() => {
    return getStoredNotifications().map(normalizeNotification);
  });

  // Sidebar collapse state
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  // Trigger manual refresh
  const triggerRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      const now = new Date();
      setLastUpdated(now.toLocaleTimeString());
      setIsRefreshing(false);
    }, 600);
  };

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
        setCurrentOrg,
        orgList,
        refreshOrganizations,
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

export default DashboardContext;
