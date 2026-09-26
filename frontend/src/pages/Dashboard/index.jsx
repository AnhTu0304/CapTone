import React from 'react';
import DashboardLayout from '../../layouts/DashboardLayout';
import OverviewPage from './Overview';
import AgentsPage from './Agents';
import InfrastructurePage from './Infrastructure';
import WorkloadsPage from './Workloads';
import MetricsPage from './Monitoring/MetricsPage';
import LogsPage from './Monitoring/LogsPage';
import EventsPage from './Monitoring/EventsPage';
import PredictionsPage from './AI/PredictionsPage';
import IncidentsPage from './Incidents/IncidentsPage';
import HealingActionsPage from './SelfHealing/HealingActionsPage';
import ActionHistoryPage from './SelfHealing/ActionHistoryPage';
import ApprovalsPage from './SelfHealing/ApprovalsPage';
import PoliciesPage from './SelfHealing/PoliciesPage';
import OrganizationPage from './Organization/OrganizationPage';
import MembersPage from './Organization/MembersPage';
import ClustersPage from './Clusters/ClustersPage';
import NotificationsPage from './Notifications/NotificationsPage';
import AuditLogsPage from './AuditLogs/AuditLogsPage';
import ReportsPage from './Reports/ReportsPage';
import SettingsPage from './Settings/SettingsPage';


export const DashboardPage = ({ currentPath = '/dashboard', onNavigate }) => {
  const path = currentPath.toLowerCase().split('?')[0].split('#')[0] || '/dashboard';

  // Compute Breadcrumbs based on path
  const getBreadcrumbs = () => {
    const parts = path.split('/').filter(Boolean);
    if (parts.length <= 1) return [];

    const crumbs = [];
    let accumulatedPath = '';

    parts.forEach((part, index) => {
      accumulatedPath += `/${part}`;
      if (index === 0) return; // Skip 'dashboard' root crumb as layout handles it

      const label = part
        .split('-')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');

      crumbs.push({
        label,
        path: index === parts.length - 1 ? null : accumulatedPath,
      });
    });

    return crumbs;
  };

  const renderContent = () => {
    // 1. Overview
    if (path === '/dashboard' || path === '/dashboard/') {
      return <OverviewPage />;
    }

    // 2. Organization & Members
    if (path === '/dashboard/organization') {
      return <OrganizationPage />;
    }
    if (path === '/dashboard/organization/members') {
      return <MembersPage />;
    }

    // 3. Infrastructure & Agents
    if (path === '/dashboard/agents') {
      return <AgentsPage />;
    }
    if (path === '/dashboard/clusters') {
      return <ClustersPage />;
    }
    if (path === '/dashboard/infrastructure') {
      return <InfrastructurePage />;
    }
    if (path === '/dashboard/workloads') {
      return <WorkloadsPage />;
    }

    // 4. Monitoring
    if (path === '/dashboard/monitoring/metrics') {
      return <MetricsPage />;
    }
    if (path === '/dashboard/monitoring/logs') {
      return <LogsPage />;
    }
    if (path === '/dashboard/monitoring/events') {
      return <EventsPage />;
    }

    // 5. AI & Incidents
    if (path === '/dashboard/ai/predictions') {
      return <PredictionsPage />;
    }
    if (path === '/dashboard/incidents' || path.startsWith('/dashboard/incidents/')) {
      return <IncidentsPage initialRcaOpen={path.includes('/rca')} />;
    }

    // 6. Self-Healing
    if (path === '/dashboard/self-healing/actions') {
      return <HealingActionsPage />;
    }
    if (path === '/dashboard/self-healing/history') {
      return <ActionHistoryPage />;
    }
    if (path === '/dashboard/self-healing/approvals') {
      return <ApprovalsPage />;
    }
    if (path === '/dashboard/self-healing/policies') {
      return <PoliciesPage />;
    }
    if (path.startsWith('/dashboard/self-healing')) {
      return <HealingActionsPage />;
    }

    // 7. System
    if (path === '/dashboard/notifications') {
      return <NotificationsPage />;
    }
    if (path === '/dashboard/audit-logs') {
      return <AuditLogsPage />;
    }
    if (path === '/dashboard/reports') {
      return <ReportsPage />;
    }
    if (path === '/dashboard/settings') {
      return <SettingsPage />;
    }

    // Fallback to overview
    return <OverviewPage />;
  };

  return (
    <DashboardLayout
      currentPath={path}
      onNavigate={onNavigate}
      breadcrumbs={getBreadcrumbs()}
    >
      {renderContent()}
    </DashboardLayout>
  );
};

export default DashboardPage;
