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
import { IncidentsListPage, IncidentDetailPage } from '../pages/Admin/Incidents';
import TableOfContents from '../components/navigation/TableOfContents';

export const ROUTES = {
  HOME: '/',
  DASHBOARD: '/dashboard',
  ADMIN: '/admin',
  ADMIN_ORGANIZATIONS: '/admin/organizations',
  ADMIN_INCIDENTS: '/admin/incidents',
  ADMIN_INFRASTRUCTURE_CLUSTERS: '/admin/infrastructure/clusters',
  ADMIN_INFRASTRUCTURE_AGENTS: '/admin/infrastructure/agents',
  ADMIN_INFRASTRUCTURE_NODES: '/admin/infrastructure/nodes',
  ADMIN_INFRASTRUCTURE_WORKLOADS: '/admin/infrastructure/workloads',
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
};

export const RouteRenderer = ({ 
  currentPath = '/', 
  onNavigate, 
  activeDocId = 'overview', 
  onSelectDoc 
}) => {
  // Normalize path
  const path = currentPath.toLowerCase().split('?')[0].split('#')[0] || '/';

  // Handle all onboarding routes
  if (path.startsWith('/onboarding')) {
    return <OnboardingPage currentPath={path} onNavigate={onNavigate} />;
  }

  // Handle all dashboard routes
  if (path.startsWith('/dashboard')) {
    return <DashboardPage currentPath={path} onNavigate={onNavigate} />;
  }

  // Handle all admin routes
  if (path.startsWith('/admin')) {
    let adminContent = null;
    if (path === '/admin' || path === '/admin/overview') {
      adminContent = <OverviewPage onNavigate={onNavigate} />;
    } else if (path === '/admin/organizations') {
      adminContent = <OrganizationsListPage onNavigate={onNavigate} />;
    } else if (path.startsWith('/admin/organizations/')) {
      const orgId = path.substring('/admin/organizations/'.length);
      adminContent = <OrganizationDetailsPage orgId={orgId} onNavigate={onNavigate} />;
    } else if (path === '/admin/incidents') {
      adminContent = <IncidentsListPage onNavigate={onNavigate} />;
    } else if (path.startsWith('/admin/incidents/')) {
      const incidentId = path.substring('/admin/incidents/'.length);
      adminContent = <IncidentDetailPage incidentId={incidentId} onNavigate={onNavigate} />;
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
