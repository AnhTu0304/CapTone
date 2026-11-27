import React from 'react';
import { useTranslation } from 'react-i18next';
import DashboardLayout from '../../layouts/DashboardLayout';
import OverviewPage from './Overview';
import AgentsPage from './Agents';
import InfrastructurePage from './Infrastructure';
import WorkloadsPage from './Workloads';
import MetricsPage from './Monitoring/MetricsPage';
import LogsPage from './Monitoring/LogsPage';
import EventsPage from './Monitoring/EventsPage';
import IncidentsPage from './Incidents/IncidentsPage';
import HealingActionsPage from './SelfHealing/HealingActionsPage';
import ActionHistoryPage from './SelfHealing/ActionHistoryPage';
import ApprovalsPage from './SelfHealing/ApprovalsPage';
import PoliciesPage from './SelfHealing/PoliciesPage';
import OrganizationPage from './Organization/OrganizationPage';
import MembersPage from './Organization/MembersPage';
import ClustersPage from './Clusters/ClustersPage';
import ClusterDetailPage from './Clusters/ClusterDetailPage';
import NotificationsPage from './Notifications/NotificationsPage';
import AlertsPage from './Alerts/AlertsPage';
import AuditLogsPage from './AuditLogs/AuditLogsPage';
import ReportsPage from './Reports/ReportsPage';
import SettingsPage from './Settings/SettingsPage';
import { NotFoundPage } from '../Error/StatusPages';

export const DashboardPage = ({ currentPath = '/dashboard', onNavigate }) => {
  const { t } = useTranslation('dashboard');
  const path = currentPath.toLowerCase().split('?')[0].split('#')[0] || '/dashboard';

  // Compute Breadcrumbs based on path
  const getBreadcrumbs = () => {
    const parts = path.split('/').filter(Boolean);
    if (parts.length <= 1) return [];

    const crumbs = [];
    let accumulatedPath = '';

    const segmentKeyMap = {
      clusters: 'clusters',
      incidents: 'incidents',
      monitoring: 'monitoring',
      metrics: 'metrics',
      logs: 'logs',
      events: 'events',
      'self-healing': 'selfHealing',
      actions: 'actions',
      history: 'history',
      approvals: 'approvals',
      policies: 'policies',
      agents: 'agents',
      infrastructure: 'infrastructure',
      workloads: 'workloads',
      organization: 'organization',
      members: 'members',
      alerts: 'alerts',
      notifications: 'notifications',
      'audit-logs': 'auditLogs',
      reports: 'reports',
      settings: 'settings',
    };

    parts.forEach((part, index) => {
      accumulatedPath += `/${part}`;
      if (index === 0) return; // Skip 'dashboard' root crumb as layout handles it

      let label = part
        .split('-')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');

      if (parts[index - 1] === 'clusters') {
        label = t('layout.breadcrumbs.clusterDetail');
      } else if (segmentKeyMap[part]) {
        label = t(`layout.breadcrumbs.${segmentKeyMap[part]}`);
      }

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
    if (path.startsWith('/dashboard/clusters/')) {
      const clusterId = currentPath.split('/dashboard/clusters/')[1]?.split('/')[0]?.split('?')[0];
      return (
        <ClusterDetailPage
          clusterId={clusterId}
          onBack={() => onNavigate?.('/dashboard/clusters')}
          onNavigate={onNavigate}
        />
      );
    }
    if (path === '/dashboard/clusters') {
      return <ClustersPage onNavigate={onNavigate} />;
    }
    if (path === '/dashboard/infrastructure') {
      return <InfrastructurePage />;
    }
    if (path === '/dashboard/workloads') {
      return <WorkloadsPage />;
    }

    // 4. Monitoring
    if (path === '/dashboard/monitoring/metrics') {
      return <MetricsPage onNavigate={onNavigate} />;
    }
    if (path === '/dashboard/monitoring/logs') {
      return <LogsPage onNavigate={onNavigate} />;
    }
    if (path === '/dashboard/monitoring/events') {
      return <EventsPage onNavigate={onNavigate} />;
    }

    // 5. Incidents & RCA
    if (path === '/dashboard/incidents' || path.startsWith('/dashboard/incidents')) {
      return <IncidentsPage onNavigate={onNavigate} />;
    }

    // 6. Self-Healing
    if (path === '/dashboard/self-healing/actions') {
      return <HealingActionsPage onNavigate={onNavigate} />;
    }
    if (path === '/dashboard/self-healing/history') {
      return <ActionHistoryPage onNavigate={onNavigate} />;
    }
    if (path === '/dashboard/self-healing/policies') {
      return <PoliciesPage onNavigate={onNavigate} />;
    }
    if (path === '/dashboard/self-healing/approvals') {
      return <ApprovalsPage onNavigate={onNavigate} />;
    }
    if (path === '/dashboard/self-healing' || path === '/dashboard/self-healing/') {
      return <HealingActionsPage onNavigate={onNavigate} />;
    }

    // 7. System
    if (path === '/dashboard/alerts') {
      return <AlertsPage onNavigate={onNavigate} />;
    }
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

    return (
      <NotFoundPage
        embedded
        onNavigate={onNavigate}
        warnPath={currentPath}
        title={t('layout.notFoundTitle')}
        message={t('layout.notFoundMessage', { path: currentPath })}
      />
    );
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
