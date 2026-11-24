import React from 'react';
import HomePage from '../pages/Home';
import GuidePage from '../pages/Guide';
import FeaturesPage from '../pages/Features';
import AboutPage from '../pages/About';
import ContactPage from '../pages/Contact';
import LoginPage from '../pages/Login';
import RegisterPage from '../pages/Register';
import ForgotPasswordPage from '../pages/ForgotPassword';
import ResetPasswordPage from '../pages/ResetPassword';
import DashboardPage from '../pages/Dashboard';
import PublicLayout from '../layouts/PublicLayout';
import AuthLayout from '../layouts/AuthLayout';
import AdminLayout from '../layouts/AdminLayout';
import OverviewPage from '../pages/Admin/Overview';
import { OrganizationsListPage, OrganizationDetailsPage } from '../pages/Admin/Organizations';
import { AdminInfrastructurePage } from '../pages/Admin/Infrastructure';
import { IncidentDetailPage, IncidentsListPage } from '../pages/Admin/Incidents';
import { AdminSelfHealingPage } from '../pages/Admin/SelfHealing';
import { AdminAIPage } from '../pages/Admin/AI';
import { AdminAuditLogsPage } from '../pages/Admin/AuditLogs';
import { AdminUsersPage } from '../pages/Admin/Users';
import { AdminAnalyticsPage } from '../pages/Admin/Analytics/AdminAnalyticsPage';
import { AdminBroadcastPage } from '../pages/Admin/Notifications/AdminBroadcastPage';
import { AdminRolesPage } from '../pages/Admin/Roles/AdminRolesPage';
import { AdminAgentManagementPage } from '../pages/Admin/Agents/AdminAgentManagementPage';
import { AdminClusterOverviewPage } from '../pages/Admin/Clusters/AdminClusterOverviewPage';
import { AdminMonitoringPage } from '../pages/Admin/Monitoring/AdminMonitoringPage';
import { AdminAlertsPage } from '../pages/Admin/Alerts/AdminAlertsPage';
import { AdminSystemSettingsPage } from '../pages/Admin/Settings/AdminSystemSettingsPage';
import { AdminUserActivityPage } from '../pages/Admin/Activity/AdminUserActivityPage';
import { AdminAccountSettingsPage } from '../pages/Admin/Settings/AdminAccountSettingsPage';
import PersonalPortalPage from '../pages/Personal';
import SecurityPracticesPage from '../pages/SecurityPractices';
import PrivacyPage from '../pages/Privacy';
import TermsPage from '../pages/Terms';
import ForbiddenPage from '../pages/Error/ForbiddenPage';
import {
  UnauthorizedPage,
  NotFoundPage,
  ServerErrorPage,
  ServiceUnavailablePage,
  TooManyRequestsPage,
  AgentOfflinePage,
  ClusterLostPage,
  MonitoringStatusPage,
  MaintenancePage,
} from '../pages/Error/StatusPages';
import { useAuth } from '../context/AuthContext';

export const ROUTES = {
  HOME: '/',
  CONTACT: '/contact',
  TERMS: '/terms',
  PRIVACY: '/privacy',
  SECURITY_PRACTICES: '/security',
  SECURITY_PRACTICES_ALIAS: '/security-practices',
  DASHBOARD: '/dashboard',
  PORTAL: '/portal',
  PORTAL_DASHBOARD: '/portal/dashboard',
  PORTAL_COMPANIES: '/portal/companies',
  PORTAL_PROFILE: '/portal/profile',
  PORTAL_SECURITY: '/portal/security',
  PORTAL_PREFERENCES: '/portal/preferences',
  PORTAL_NOTIFICATIONS: '/portal/notifications',
  PORTAL_HELP: '/portal/help',
  PORTAL_ACTIVITY: '/portal/activity',
  ADMIN: '/admin',
  ADMIN_COMPANIES: '/admin/companies',
  ADMIN_ORGANIZATIONS: '/admin/organizations',
  ADMIN_AGENTS: '/admin/agents',
  ADMIN_CLUSTERS: '/admin/clusters',
  ADMIN_MONITORING: '/admin/monitoring',
  ADMIN_ALERTS: '/admin/alerts',
  ADMIN_SETTINGS: '/admin/settings',
  ADMIN_ACTIVITY: '/admin/activity',
  ADMIN_INCIDENTS: '/admin/incidents',
  ADMIN_SELF_HEALING_ACTIONS: '/admin/self-healing/actions',
  ADMIN_SELF_HEALING_ACTION_TYPES: '/admin/self-healing/action-types',
  ADMIN_SELF_HEALING_POLICIES: '/admin/self-healing/policies',
  ADMIN_SELF_HEALING_ANALYTICS: '/admin/self-healing/analytics',
  ADMIN_INFRASTRUCTURE_CLUSTERS: '/admin/infrastructure/clusters',
  ADMIN_INFRASTRUCTURE_AGENTS: '/admin/infrastructure/agents',
  ADMIN_INFRASTRUCTURE_NODES: '/admin/infrastructure/nodes',
  ADMIN_INFRASTRUCTURE_WORKLOADS: '/admin/infrastructure/workloads',
  ADMIN_AI_OVERVIEW: '/admin/ai/overview',
  ADMIN_AI_MODELS: '/admin/ai/models',
  ADMIN_AI_PREDICTIONS: '/admin/ai/predictions',
  ADMIN_AI_COMPARISON: '/admin/ai/comparison',
  ADMIN_AI_RCA: '/admin/ai/rca',
  ADMIN_AI_PERFORMANCE: '/admin/ai/performance',
  ADMIN_AUDIT_LOGS: '/admin/audit-logs',
  ADMIN_USERS: '/admin/users',
  ADMIN_MEMBERS: '/admin/members',
  ADMIN_ROLES: '/admin/roles',
  ADMIN_ANALYTICS: '/admin/analytics',
  ADMIN_NOTIFICATIONS: '/admin/notifications',
  GUIDE: '/guide',
  FEATURES: '/features',
  ABOUT: '/about',
  DOCS: '/docs',
  LOGIN: '/login',
  REGISTER: '/register',
  FORGOT_PASSWORD: '/forgot-password',
  RESET_PASSWORD: '/reset-password',
  GET_STARTED: '/get-started',
  ONBOARDING: '/onboarding',
  ONBOARDING_ORG: '/onboarding/organization',
  ONBOARDING_ENV: '/onboarding/environment',
  ONBOARDING_K8S: '/onboarding/kubernetes',
  ONBOARDING_VERIFY: '/onboarding/verify-agent',
  ONBOARDING_COMPLETE: '/onboarding/complete',
  PROFILE: '/portal/profile',
  NOTIFICATIONS: '/dashboard/notifications',
  ALERTS: '/dashboard/alerts',
  UNAUTHORIZED: '/401',
  FORBIDDEN: '/403',
  NOT_FOUND: '/404',
  TOO_MANY_REQUESTS: '/429',
  SERVER_ERROR: '/500',
  SERVICE_UNAVAILABLE: '/503',
  MAINTENANCE: '/maintenance',
  STATUS_AGENT_OFFLINE: '/status/agent-offline',
  STATUS_CLUSTER_LOST: '/status/cluster-lost',
  STATUS_MONITORING: '/status/monitoring',
};

export const RouteRenderer = ({
  currentPath = '/',
  onNavigate,
}) => {
  // Normalize path
  const path = currentPath.toLowerCase().split('?')[0].split('#')[0] || '/';

  // Phân quyền điều hướng (RBAC Route Guard)
  const auth = useAuth();

  const user = auth?.user || null;
  const isAuthenticated = Boolean(auth?.isAuthenticated && user);
  const authLoading = Boolean(auth?.loading);
  const isSuperAdmin = auth?.isSuperAdmin ? auth.isSuperAdmin(user) : false;
  const isSystemAdmin = auth?.isAdmin ? auth.isAdmin(user) : false;
  const isOwnerUser = auth?.isOwner ? auth.isOwner(user) : false;
  const isDevOpsUser = auth?.isDevOps ? auth.isDevOps(user) : false;

  const isProtectedPath =
    path === '/profile' ||
    path === '/user' ||
    path === '/personal' ||
    path === '/me' ||
    path === '/notifications' ||
    path.startsWith('/portal') ||
    path.startsWith('/onboarding') ||
    path.startsWith('/dashboard') ||
    path.startsWith('/admin');

  if (isProtectedPath && authLoading) {
    return (
      <div
        data-testid="auth-loading-guard"
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#64748B',
          fontSize: '0.875rem',
        }}
      >
        Đang xác thực phiên làm việc...
      </div>
    );
  }

  if (isProtectedPath && !authLoading && !isAuthenticated) {
    return (
      <PublicLayout currentPath={path} onNavigate={onNavigate}>
        <UnauthorizedPage
          onNavigate={onNavigate}
          warnPath={currentPath}
          warnTitle="Cảnh báo xác thực — 401"
          warnMessage={`Bạn cần đăng nhập để truy cập "${currentPath}".`}
        />
      </PublicLayout>
    );
  }

  const statusRoutes = {
    '/401': <UnauthorizedPage onNavigate={onNavigate} />,
    '/unauthorized': <UnauthorizedPage onNavigate={onNavigate} />,
    '/403': <ForbiddenPage onNavigate={onNavigate} />,
    '/forbidden': <ForbiddenPage onNavigate={onNavigate} />,
    '/404': <NotFoundPage onNavigate={onNavigate} />,
    '/not-found': <NotFoundPage onNavigate={onNavigate} />,
    '/500': <ServerErrorPage onNavigate={onNavigate} />,
    '/503': <ServiceUnavailablePage onNavigate={onNavigate} />,
    '/429': <TooManyRequestsPage onNavigate={onNavigate} />,
    '/status/agent-offline': <AgentOfflinePage onNavigate={onNavigate} />,
    '/status/cluster-lost': <ClusterLostPage onNavigate={onNavigate} />,
    '/status/monitoring': <MonitoringStatusPage onNavigate={onNavigate} />,
    '/maintenance': <MaintenancePage onNavigate={onNavigate} />,
  };

  if (statusRoutes[path]) {
    return (
      <PublicLayout currentPath={path} onNavigate={onNavigate}>
        {statusRoutes[path]}
      </PublicLayout>
    );
  }

  // Handle profile routes (unify into Personal Portal Profile; /admin/profile stays gated by /admin guard below)
  if (path === '/dashboard/profile' || path === '/profile') {
    return <PersonalPortalPage currentPath="/portal/profile" onNavigate={onNavigate} />;
  }

  // Handle all Personal Portal routes (Tầng Cá Nhân)
  if (path.startsWith('/portal') || path === '/user' || path === '/personal' || path === '/me') {
    return <PersonalPortalPage currentPath={path} onNavigate={onNavigate} />;
  }

  // Legacy onboarding paths now route directly to Personal Portal
  if (path.startsWith('/onboarding')) {
    return <PersonalPortalPage currentPath="/portal" onNavigate={onNavigate} />;
  }

  // Handle all dashboard routes (User / Owner Portal với phân cấp RBAC động theo tenant role)
  if (path.startsWith('/dashboard')) {
    const activeOrgRole = (localStorage.getItem('selfheal_active_org_role') || '').toUpperCase();
    const effectiveDashboardRole = activeOrgRole || (isSuperAdmin || isSystemAdmin || isOwnerUser ? 'SME_OWNER' : isDevOpsUser ? 'DEVOPS' : 'VIEWER');
    const isDashboardDevOps = effectiveDashboardRole === 'DEVOPS';
    const isDashboardViewer = effectiveDashboardRole === 'VIEWER';

    const isRestrictedForViewer =
      path.startsWith('/dashboard/organization') ||
      path.startsWith('/dashboard/clusters') ||
      path === '/dashboard/self-healing/policies' ||
      path === '/dashboard/self-healing/approvals' ||
      path === '/dashboard/settings';

    if (isDashboardViewer && isRestrictedForViewer) {
      return (
        <ForbiddenPage
          onNavigate={onNavigate}
          redirectPath="/dashboard"
          title="403 — Không Có Quyền Truy Cập"
          message="Tài khoản Viewer không có quyền truy cập Tổ chức, Cụm K8s, Chính sách tự động, Cổng phê duyệt hoặc Cài đặt hệ thống."
        />
      );
    }
    if (isDashboardDevOps && (path.startsWith('/dashboard/organization') || path === '/dashboard/settings')) {
      return (
        <ForbiddenPage
          onNavigate={onNavigate}
          redirectPath="/dashboard"
          title="403 — Không Có Quyền Truy Cập"
          message="Tài khoản DevOps chỉ có quyền vận hành kỹ thuật và hạ tầng, không có quyền quản trị thông tin tổ chức hoặc thay đổi cài đặt hệ thống."
        />
      );
    }
    return <DashboardPage currentPath={path} onNavigate={onNavigate} />;
  }

  // Handle standalone notifications path
  if (path === '/notifications') {
    return <DashboardPage currentPath="/dashboard/notifications" onNavigate={onNavigate} />;
  }

  // Handle all admin routes (chỉ ADMIN / SUPER_ADMIN mới được phép truy cập /admin/*)
  if (path.startsWith('/admin')) {
    if (!isSuperAdmin && !isSystemAdmin) {
      return (
        <PublicLayout currentPath={path} onNavigate={onNavigate}>
          <ForbiddenPage
            onNavigate={onNavigate}
            warnPath={currentPath}
            warnTitle="Cảnh báo phân quyền — 403"
            warnMessage="Khu vực Quản trị Hệ thống (/admin) chỉ dành riêng cho Quản trị viên Nền tảng (Admin / Super Admin). Vui lòng sử dụng Bàn điều khiển Doanh nghiệp (/dashboard)."
            title="403 — Không Có Quyền Truy Cập Quản Trị"
            message="Khu vực Quản trị Hệ thống (/admin) chỉ dành riêng cho Quản trị viên Nền tảng (Admin / Super Admin). Tài khoản người dùng và thành viên tổ chức vui lòng thao tác tại Bàn điều khiển Doanh nghiệp."
          />
        </PublicLayout>
      );
    }

    let adminContent = null;
    const isAdminRole = !isSuperAdmin && isSystemAdmin;

    // Rào cản bảo vệ (RBAC): Phân quyền vai trò (Roles) và Cấu hình hệ thống (System Settings) dành riêng cho Quản trị viên Tối cao
    const isRestrictedForAdmin =
      path.startsWith('/admin/roles') ||
      path === '/admin/settings' ||
      path.startsWith('/admin/system-settings');

    if (isAdminRole && isRestrictedForAdmin) {
      const isRolePath = path.startsWith('/admin/roles');
      adminContent = (
        <ForbiddenPage
          embedded
          onNavigate={onNavigate}
          redirectPath="/admin"
          title={isRolePath ? '403 — Không Có Quyền Phân Quyền Vai Trò' : '403 — Không Có Quyền Cấu Hình Hệ Thống'}
          message={
            isRolePath
              ? 'Chức năng Quản lý Vai trò & Phân quyền (Roles & Permissions) dành riêng cho Quản trị viên Tối cao (Super Admin). Quản trị viên Vận hành (Admin) không có thẩm quyền gán hoặc sửa đổi vai trò cốt lõi hệ thống.'
              : 'Chức năng Cấu hình Hệ thống (System Settings) dành riêng cho Quản trị viên Tối cao (Super Admin). Quản trị viên Vận hành (Admin) không có thẩm quyền thay đổi các thông số cấu hình nền tảng.'
          }
        />
      );
    } else if (path === '/admin/profile') {
      return <PersonalPortalPage currentPath="/portal/profile" onNavigate={onNavigate} />;
    } else if (path === '/admin/activity') {
      adminContent = <AdminUserActivityPage onNavigate={onNavigate} />;
    } else if (path === '/admin/account-settings') {
      adminContent = <AdminAccountSettingsPage onNavigate={onNavigate} />;
    } else if (path === '/admin/settings' || path === '/admin/system-settings') {
      adminContent = <AdminSystemSettingsPage onNavigate={onNavigate} />;
    } else if (path === '/admin' || path === '/admin/overview') {
      adminContent = <OverviewPage onNavigate={onNavigate} />;
    } else if (path === '/admin/companies' || path === '/admin/organizations') {
      adminContent = <OrganizationsListPage onNavigate={onNavigate} />;
    } else if (path.startsWith('/admin/companies/')) {
      const orgId = path.substring('/admin/companies/'.length);
      adminContent = <OrganizationDetailsPage orgId={orgId} onNavigate={onNavigate} />;
    } else if (path.startsWith('/admin/organizations/')) {
      const orgId = path.substring('/admin/organizations/'.length);
      adminContent = <OrganizationDetailsPage orgId={orgId} onNavigate={onNavigate} />;
    } else if (path === '/admin/agents' || path === '/admin/infrastructure/agents') {
      adminContent = <AdminAgentManagementPage onNavigate={onNavigate} />;
    } else if (path === '/admin/clusters' || path === '/admin/infrastructure/clusters') {
      adminContent = <AdminClusterOverviewPage onNavigate={onNavigate} />;
    } else if (path === '/admin/monitoring') {
      adminContent = <AdminMonitoringPage onNavigate={onNavigate} />;
    } else if (path === '/admin/alerts') {
      adminContent = <AdminAlertsPage onNavigate={onNavigate} />;
    } else if (path === '/admin/incidents') {
      adminContent = <IncidentsListPage onNavigate={onNavigate} />;
    } else if (path.startsWith('/admin/incidents/')) {
      const incidentId = path.substring('/admin/incidents/'.length);
      adminContent = <IncidentDetailPage incidentId={incidentId} onNavigate={onNavigate} />;
    } else if (path === '/admin/self-healing/actions' || path === '/admin/self-healing') {
      adminContent = <AdminSelfHealingPage currentSection="actions" onNavigate={onNavigate} />;
    } else if (path === '/admin/self-healing/action-types') {
      adminContent = <AdminSelfHealingPage currentSection="action-types" onNavigate={onNavigate} />;
    } else if (path === '/admin/self-healing/policies' || path === '/admin/policies') {
      adminContent = <AdminSelfHealingPage currentSection="policies" onNavigate={onNavigate} />;
    } else if (path === '/admin/self-healing/analytics') {
      adminContent = <AdminSelfHealingPage currentSection="analytics" onNavigate={onNavigate} />;
    } else if (path === '/admin/infrastructure/clusters' || path === '/admin/clusters') {
      adminContent = <AdminInfrastructurePage currentSection="clusters" onNavigate={onNavigate} />;
    } else if (path === '/admin/infrastructure/agents' || path === '/admin/agents') {
      adminContent = <AdminInfrastructurePage currentSection="agents" onNavigate={onNavigate} />;
    } else if (path === '/admin/infrastructure/nodes' || path === '/admin/nodes') {
      adminContent = <AdminInfrastructurePage currentSection="nodes" onNavigate={onNavigate} />;
    } else if (path === '/admin/infrastructure/workloads' || path === '/admin/workloads') {
      adminContent = <AdminInfrastructurePage currentSection="workloads" onNavigate={onNavigate} />;
    } else if (path === '/admin/infrastructure') {
      adminContent = <AdminInfrastructurePage currentSection="clusters" onNavigate={onNavigate} />;
    } else if (path === '/admin/ai/overview' || path === '/admin/ai') {
      adminContent = <AdminAIPage currentSection="overview" onNavigate={onNavigate} />;
    } else if (path === '/admin/ai/models') {
      adminContent = <AdminAIPage currentSection="models" onNavigate={onNavigate} />;
    } else if (path === '/admin/ai/comparison') {
      adminContent = <AdminAIPage currentSection="comparison" onNavigate={onNavigate} />;
    } else if (path === '/admin/ai/predictions' || path === '/admin/ai/rca' || path === '/admin/ai/performance') {
      adminContent = <AdminAIPage currentSection="models" onNavigate={onNavigate} />;
    } else if (path === '/admin/audit-logs') {
      adminContent = <AdminAuditLogsPage onNavigate={onNavigate} />;
    } else if (path === '/admin/analytics') {
      adminContent = <AdminAnalyticsPage onNavigate={onNavigate} />;
    } else if (path === '/admin/notifications') {
      adminContent = <AdminBroadcastPage onNavigate={onNavigate} />;
    } else if (path === '/admin/roles') {
      adminContent = <AdminRolesPage onNavigate={onNavigate} />;
    } else if (path === '/admin/users' || path === '/admin/members') {
      adminContent = <AdminUsersPage onNavigate={onNavigate} />;
    } else {
      adminContent = (
        <NotFoundPage
          embedded
          onNavigate={onNavigate}
          warnPath={currentPath}
          title="404 — Không tìm thấy trang quản trị"
          message={`Đường dẫn quản trị "${currentPath}" không tồn tại hoặc đã được chuyển sang phân hệ khác.`}
        />
      );
    }

    return (
      <AdminLayout currentPath={path} onNavigate={onNavigate}>
        {adminContent}
      </AdminLayout>
    );
  }

  switch (path) {
    case ROUTES.LOGIN:
    case ROUTES.GET_STARTED:
      return (
        <AuthLayout onNavigate={onNavigate}>
          <LoginPage onNavigate={onNavigate} />
        </AuthLayout>
      );

    case ROUTES.REGISTER:
      return (
        <AuthLayout onNavigate={onNavigate}>
          <RegisterPage onNavigate={onNavigate} />
        </AuthLayout>
      );

    case ROUTES.FORGOT_PASSWORD:
      return (
        <AuthLayout onNavigate={onNavigate}>
          <ForgotPasswordPage onNavigate={onNavigate} />
        </AuthLayout>
      );

    case ROUTES.RESET_PASSWORD:
      return (
        <AuthLayout onNavigate={onNavigate}>
          <ResetPasswordPage onNavigate={onNavigate} />
        </AuthLayout>
      );

    case ROUTES.DOCS:
    case ROUTES.GUIDE:
      return (
        <PublicLayout currentPath={ROUTES.GUIDE} onNavigate={onNavigate}>
          <GuidePage onNavigate={onNavigate} />
        </PublicLayout>
      );

    case ROUTES.FEATURES:
      return (
        <PublicLayout currentPath={ROUTES.FEATURES} onNavigate={onNavigate}>
          <FeaturesPage onNavigate={onNavigate} />
        </PublicLayout>
      );

    case ROUTES.CONTACT:
      return (
        <PublicLayout currentPath={ROUTES.CONTACT} onNavigate={onNavigate}>
          <ContactPage onNavigate={onNavigate} />
        </PublicLayout>
      );

    case ROUTES.ABOUT:
      return (
        <PublicLayout currentPath={ROUTES.ABOUT} onNavigate={onNavigate}>
          <AboutPage onNavigate={onNavigate} />
        </PublicLayout>
      );

    case ROUTES.TERMS:
    case '/terms':
      return (
        <PublicLayout currentPath={ROUTES.TERMS} onNavigate={onNavigate}>
          <TermsPage onNavigate={onNavigate} />
        </PublicLayout>
      );

    case ROUTES.PRIVACY:
    case '/privacy':
      return (
        <PublicLayout currentPath={ROUTES.PRIVACY} onNavigate={onNavigate}>
          <PrivacyPage onNavigate={onNavigate} />
        </PublicLayout>
      );

    case ROUTES.SECURITY_PRACTICES:
    case ROUTES.SECURITY_PRACTICES_ALIAS:
    case '/security':
    case '/security-practices':
      return (
        <PublicLayout currentPath={ROUTES.SECURITY_PRACTICES} onNavigate={onNavigate}>
          <SecurityPracticesPage onNavigate={onNavigate} />
        </PublicLayout>
      );

    case ROUTES.HOME:
      return (
        <PublicLayout currentPath={ROUTES.HOME} onNavigate={onNavigate}>
          <HomePage onNavigate={onNavigate} />
        </PublicLayout>
      );

    default:
      return (
        <PublicLayout currentPath={path} onNavigate={onNavigate}>
          <NotFoundPage
            onNavigate={onNavigate}
            warnPath={currentPath}
            message={`Đường dẫn "${currentPath}" không tồn tại trên hệ thống hoặc đã được di chuyển sang vị trí khác.`}
          />
        </PublicLayout>
      );
  }
};

export default RouteRenderer;
