import React from 'react';
import PersonalPortalLayout from '../../layouts/PersonalPortalLayout';
import PersonalDashboardPage from './PersonalDashboardPage';
import PersonalCompaniesPage from './PersonalCompaniesPage';
import PersonalProfilePage from './PersonalProfilePage';
import PersonalSecurityPage from './PersonalSecurityPage';
import PersonalPreferencesPage from './PersonalPreferencesPage';
import PersonalNotificationsPage from './PersonalNotificationsPage';
import PersonalActivityPage from './PersonalActivityPage';
import PersonalHelpPage from './PersonalHelpPage';
import { NotFoundPage } from '../Error/StatusPages';

export const PersonalPortalPage = ({ currentPath = '/portal', onNavigate }) => {
  const renderContent = () => {
    const rawNorm = currentPath.toLowerCase().split('?')[0].split('#')[0];
    const norm = rawNorm.length > 1 ? rawNorm.replace(/\/+$/, '') : rawNorm;

    if (norm === '/portal/companies') {
      return <PersonalCompaniesPage onNavigate={onNavigate} />;
    }
    if (norm === '/portal/profile') {
      return <PersonalProfilePage onNavigate={onNavigate} />;
    }
    if (norm === '/portal/security') {
      return <PersonalSecurityPage onNavigate={onNavigate} />;
    }
    if (norm === '/portal/preferences') {
      return <PersonalPreferencesPage onNavigate={onNavigate} />;
    }
    if (norm === '/portal/notifications') {
      return <PersonalNotificationsPage onNavigate={onNavigate} />;
    }
    if (norm === '/portal/activity') {
      return <PersonalActivityPage onNavigate={onNavigate} />;
    }
    if (norm === '/portal/help') {
      return <PersonalHelpPage onNavigate={onNavigate} />;
    }
    if (norm === '/portal' || norm === '/portal/dashboard' || norm === '/user' || norm === '/personal' || norm === '/me') {
      return <PersonalDashboardPage onNavigate={onNavigate} />;
    }

    return (
      <NotFoundPage
        embedded
        onNavigate={onNavigate}
        warnPath={currentPath}
        title="404 — Không tìm thấy trang Cá nhân"
        message={`Đường dẫn "${currentPath}" không tồn tại trong Cổng Cá Nhân.`}
      />
    );
  };

  return (
    <PersonalPortalLayout currentPath={currentPath} onNavigate={onNavigate}>
      {renderContent()}
    </PersonalPortalLayout>
  );
};

export default PersonalPortalPage;
