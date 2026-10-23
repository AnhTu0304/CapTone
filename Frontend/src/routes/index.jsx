import React from 'react';
import HomePage from '../pages/Home';
import GuidePage from '../pages/Guide';
import FeaturesPage from '../pages/Features';
import AboutPage from '../pages/About';
import DocsPage from '../pages/Docs';
import LoginPage from '../pages/Login';
import RegisterPage from '../pages/Register';
import ForgotPasswordPage from '../pages/ForgotPassword';
import ResetPasswordPage from '../pages/ResetPassword';
import GetStartedPage from '../pages/GetStarted';
import OnboardingPage from '../pages/Onboarding';
import DashboardPage from '../pages/Dashboard';
import PublicLayout from '../layouts/PublicLayout';
import DocsLayout from '../layouts/DocsLayout';
import AuthLayout from '../layouts/AuthLayout';
import AdminLayout from '../layouts/AdminLayout';
import OverviewPage from '../pages/Admin/Overview';
import { OrganizationsListPage, OrganizationDetailsPage } from '../pages/Admin/Organizations';
import { AdminInfrastructurePage } from '../pages/Admin/Infrastructure';
import { IncidentDetailPage } from '../pages/Admin/Incidents';
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
import { AdminSystemLogsPage } from '../pages/Admin/SystemLogs/AdminSystemLogsPage';
import { AdminAlertsPage } from '../pages/Admin/Alerts/AdminAlertsPage';
import { AdminSystemSettingsPage } from '../pages/Admin/Settings/AdminSystemSettingsPage';
import { AdminUserActivityPage } from '../pages/Admin/Activity/AdminUserActivityPage';
import { AdminAccountSettingsPage } from '../pages/Admin/Settings/AdminAccountSettingsPage';
import PersonalPortalPage from '../pages/Personal';
import ForbiddenPage from '../pages/Error/ForbiddenPage';
import { AdminNotFound, AdminAccessDenied } from '../components/admin/common';
import { useAuth } from '../context/AuthContext';
import TableOfContents from '../components/navigation/TableOfContents';

export const ROUTES = {
  HOME: '/',
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
  ADMIN_SYSTEM_LOGS: '/admin/system-logs',
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
  FORBIDDEN: '/403',
};

export const RouteRenderer = ({ 
  currentPath = '/', 
  onNavigate, 
  activeDocId = 'overview', 
  onSelectDoc 
}) => {
  // Normalize path
  const path = currentPath.toLowerCase().split('?')[0].split('#')[0] || '/';

  // Phân quyền điều hướng (RBAC Route Guard)
  const auth = useAuth();

  const user = auth?.user || null;
  const isViewerUser = auth?.isViewer ? auth.isViewer(user) : false;
  const isDevOpsUser = auth?.isDevOps ? auth.isDevOps(user) : false;

  if (path === '/403' || path === '/forbidden') {
    return <ForbiddenPage onNavigate={onNavigate} />;
  }

  // Handle profile routes (unify into Personal Portal Profile)
  if (path === '/dashboard/profile' || path === '/profile' || path === '/admin/profile') {
    return <PersonalPortalPage currentPath="/portal/profile" onNavigate={onNavigate} />;
  }

  // Handle all Personal Portal routes (Tầng Cá Nhân)
  if (path.startsWith('/portal') || path === '/user' || path === '/personal' || path === '/me') {
    return <PersonalPortalPage currentPath={path} onNavigate={onNavigate} />;
  }

  // Handle all onboarding routes
  if (path.startsWith('/onboarding')) {
    return <OnboardingPage currentPath={path} onNavigate={onNavigate} />;
  }

  // Handle all dashboard routes (User / Owner Portal với phân cấp RBAC động theo tenant role)
  if (path.startsWith('/dashboard')) {
    const activeOrgRole = (localStorage.getItem('selfheal_active_org_role') || '').toUpperCase();
    const effectiveDashboardRole = activeOrgRole || (isViewerUser ? 'VIEWER' : isDevOpsUser ? 'DEVOPS' : 'SME_OWNER');
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
        <AdminAccessDenied
          onNavigate={onNavigate}
          redirectPath="/dashboard"
          title="403 — Không Có Quyền Truy Cập"
          message="Tài khoản Viewer không có quyền truy cập Tổ chức, Cụm K8s, Chính sách tự động, Cổng phê duyệt hoặc Cài đặt hệ thống."
        />
      );
    }
    if (isDashboardDevOps && (path.startsWith('/dashboard/organization') || path === '/dashboard/settings')) {
      return (
        <AdminAccessDenied
          onNavigate={onNavigate}
          redirectPath="/dashboard"
          title="403 — Không Có Quyền Truy Cập"
          message="Tài khoản DevOps chỉ có quyền vận hành kỹ thuật và hạ tầng, không có quyền quản trị thông tin tổ chức hoặc thay đổi cài đặt hệ thống."
        />
      );
    }
    return <DashboardPage currentPath={path} onNavigate={onNavigate} />;
  }

  // Handle standalone notifications paths
  if (path === '/notifications') {
    return <DashboardPage currentPath="/dashboard/notifications" onNavigate={onNavigate} />;
  }

  // Handle all admin routes
  if (path.startsWith('/admin')) {
    let adminContent = null;

    const activeRole = auth?.activeRole;
    const isAdminRole = activeRole === 'ADMIN';
    const isSmeOwnerRole = activeRole === 'SME_OWNER';

    // SME_OWNER truy cập /admin sẽ điều hướng sang Bàn điều khiển Doanh nghiệp (/dashboard)
    if (isSmeOwnerRole && (path === '/admin' || path === '/admin/overview')) {
      return <DashboardPage currentPath="/dashboard" onNavigate={onNavigate} />;
    }

    if (isSmeOwnerRole && (path.startsWith('/admin/roles') || path === '/admin/settings' || path.startsWith('/admin/system-settings') || path === '/admin/companies' || path.startsWith('/admin/companies/') || path === '/admin/users' || path === '/admin/members')) {
      return (
        <AdminAccessDenied
          onNavigate={onNavigate}
          redirectPath="/dashboard"
          title="403 — Quyền Hạn Dành Riêng Cho Quản Trị Nền Tảng"
          message="Chức năng quản trị toàn sàn (Roles, Settings, Companies) dành riêng cho Quản trị viên Tối cao và Quản trị viên Vận hành. Chủ Doanh Nghiệp (SME Owner) quản trị tổ chức tại Bàn điều khiển Doanh nghiệp."
        />
      );
    }

    if (isDevOpsUser && (path.startsWith('/admin/roles') || path === '/admin/settings' || path.startsWith('/admin/system-settings') || path === '/admin/companies' || path.startsWith('/admin/companies/') || path === '/admin/users')) {
      return (
        <AdminAccessDenied
          onNavigate={onNavigate}
          redirectPath="/dashboard"
          title="403 — Không Có Quyền Quản Trị Hệ Thống"
          message="Tài khoản DevOps chỉ có quyền vận hành kỹ thuật và hạ tầng, không có quyền quản lý người dùng, tổ chức hay thay đổi cài đặt hệ thống."
        />
      );
    }

    // Rào cản bảo vệ (RBAC): Phân quyền vai trò (Roles) và Cấu hình hệ thống (System Settings) dành riêng cho Quản trị viên Tối cao
    const isRestrictedForAdmin =
      path.startsWith('/admin/roles') ||
      path === '/admin/settings' ||
      path.startsWith('/admin/system-settings');

    if (isAdminRole && isRestrictedForAdmin) {
      const isRolePath = path.startsWith('/admin/roles');
      adminContent = (
        <AdminAccessDenied
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
    } else if (path === '/admin/activity') {
      adminContent = <AdminUserActivityPage onNavigate={onNavigate} />;
    } else if (path === '/admin/account-settings') {
      adminContent = <AdminAccountSettingsPage onNavigate={onNavigate} />;
    } else if (path === '/admin/settings' || path === '/admin/system-settings') {
      adminContent = <AdminSystemSettingsPage onNavigate={onNavigate} />;
    } else if (isViewerUser && path !== '/admin' && path !== '/admin/overview' && path !== '/admin/profile') {
      adminContent = (
        <AdminAccessDenied
          onNavigate={onNavigate}
          redirectPath="/admin"
          title="403 — Không Có Quyền Truy Cập"
          message="Tài khoản Viewer chỉ được xem Bàn điều khiển tổng quan. Bạn không được truy cập các trang chức năng, xem dữ liệu chi tiết, quản lý User, xem logs/metrics, AI Prediction/RCA, incident history, thực hiện remediation, phê duyệt hành động hoặc thay đổi cấu hình."
        />
      );
    } else if (isDevOpsUser && (path === '/admin/users' || path === '/admin/members')) {
      adminContent = (
        <AdminAccessDenied
          onNavigate={onNavigate}
          redirectPath="/admin"
          title="403 — Không Có Quyền Quản Lý Người Dùng"
          message="Tài khoản DevOps không có quyền quản lý tài khoản người dùng hoặc gán quyền hệ thống. Quyền này dành riêng cho Quản trị viên (Admin)."
        />
      );
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
      adminContent = <AdminAlertsPage onNavigate={onNavigate} />;
    } else if (path.startsWith('/admin/incidents/')) {
      const incidentId = path.substring('/admin/incidents/'.length);
      adminContent = <IncidentDetailPage incidentId={incidentId} onNavigate={onNavigate} />;
    } else if (path === '/admin/system-logs') {
      adminContent = <AdminSystemLogsPage onNavigate={onNavigate} />;
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
    } else if (path === '/admin/ai/predictions') {
      adminContent = <AdminAIPage currentSection="predictions" onNavigate={onNavigate} />;
    } else if (path === '/admin/ai/rca') {
      adminContent = <AdminAIPage currentSection="rca" onNavigate={onNavigate} />;
    } else if (path === '/admin/ai/performance') {
      adminContent = <AdminAIPage currentSection="performance" onNavigate={onNavigate} />;
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
      adminContent = <AdminNotFound onNavigate={onNavigate} />;
    }

    return (
      <AdminLayout currentPath={path} onNavigate={onNavigate}>
        {adminContent}
      </AdminLayout>
    );
  }

  switch (path) {
    case ROUTES.LOGIN:
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
      return (
        <DocsLayout
          currentPath={ROUTES.DOCS}
          activeDocId={activeDocId}
          onSelectDoc={onSelectDoc}
          onNavigate={onNavigate}
          tocComponent={
            <TableOfContents
              title="On this page"
              items={[
                { id: 'overview-intro', title: 'Introduction', level: 2 },
                { id: 'specifications', title: 'Specifications', level: 2 },
                { id: 'implementation', title: 'Implementation', level: 2 },
              ]}
              onItemClick={(id) => {
                const el = document.getElementById(id);
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
            />
          }
        >
          <DocsPage activeDocId={activeDocId} onSelectDoc={onSelectDoc} />
        </DocsLayout>
      );

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

    case ROUTES.ABOUT:
      return (
        <PublicLayout currentPath={ROUTES.ABOUT} onNavigate={onNavigate}>
          <AboutPage onNavigate={onNavigate} />
        </PublicLayout>
      );

    case ROUTES.GET_STARTED:
      return (
        <PublicLayout currentPath={ROUTES.GET_STARTED} onNavigate={onNavigate}>
          <GetStartedPage onNavigate={onNavigate} />
        </PublicLayout>
      );

    case ROUTES.HOME:
    default:
      return (
        <PublicLayout currentPath={ROUTES.HOME} onNavigate={onNavigate}>
          <HomePage onNavigate={onNavigate} />
        </PublicLayout>
      );
  }
};

export default RouteRenderer;
