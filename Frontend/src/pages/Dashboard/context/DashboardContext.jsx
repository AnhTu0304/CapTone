import React, { createContext, useContext, useState, useEffect } from 'react';

const DashboardContext = createContext(null);

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

  // 5. Notifications State
  const [notifications, setNotifications] = useState([
    {
      id: 'notif-1',
      title: 'Yêu cầu phê duyệt hành động khẩn cấp',
      desc: 'AI đề xuất Drain Node worker-03 để phòng ngừa Kernel OOM Panic.',
      time: '2 phút trước',
      type: 'approval',
      unread: true,
      link: '/dashboard/self-healing/approvals',
    },
    {
      id: 'notif-2',
      title: 'AI Prediction: Rủi ro tràn RAM sớm',
      desc: 'Dịch vụ payment-gateway có xác suất 87% chạm giới hạn bộ nhớ trong 18 phút.',
      time: '14 phút trước',
      type: 'warning',
      unread: true,
      link: '/dashboard/ai/predictions',
    },
    {
      id: 'notif-3',
      title: 'Tác tử Agent đồng bộ thành công',
      desc: 'Agent eBPF trên cụm k8s-prod-cluster-01 đã kiểm tra và nạp lại cấu hình mTLS 1.3.',
      time: '1 giờ trước',
      type: 'info',
      unread: false,
      link: '/dashboard/agents',
    },
  ]);

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
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
  };

  const unreadNotifsCount = notifications.filter((n) => n.unread).length;
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
        unreadNotifsCount,
        pendingApprovalsCount,
        activeIncidentsCount,
        markAllNotificationsRead,
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
