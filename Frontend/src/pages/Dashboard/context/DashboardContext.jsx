import React, { createContext, useContext, useState, useEffect } from 'react';
import { getStoredNotifications, saveStoredNotifications } from '../../../mocks/notificationMockData';

const DashboardContext = createContext(null);

const normalizeNotification = (item) => ({
  ...item,
  desc: item.desc || item.message,
  time: item.time || item.timestamp,
  unread: item.unread !== undefined ? item.unread : !item.read,
  read: item.read !== undefined ? item.read : !item.unread,
  link: item.link || item.actionPath,
});

export const DashboardProvider = ({ children, onNavigate }) => {
  // 1. Organization & Environment State
  const [currentOrg, setCurrentOrg] = useState({
    id: 'org-acme',
    name: 'Acme Corporation',
    slug: 'acme-corp',
    plan: 'SME Production Pro',
    clusterCount: 3,
  });

  const orgList = [
    { id: 'org-acme', name: 'Acme Corporation', slug: 'acme-corp' },
    { id: 'org-nexus', name: 'Nexus Logistics', slug: 'nexus-logistics' },
    { id: 'org-finflow', name: 'FinFlow Pay', slug: 'finflow-pay' },
  ];

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

  // 2. User & RBAC Role State ('SME_OWNER' | 'DEVOPS' | 'VIEWER')
  const [currentUserRole, setCurrentUserRole] = useState('SME_OWNER');

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

  const unreadNotifsCount = notifications.filter((n) => n.unread || !n.read).length;
  const pendingApprovalsCount = 1;
  const activeIncidentsCount = 0;

  return (
    <DashboardContext.Provider
      value={{
        currentOrg,
        setCurrentOrg,
        orgList,
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
