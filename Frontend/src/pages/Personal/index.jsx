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

export const PersonalPortalPage = ({ currentPath = '/portal', onNavigate }) => {
  const renderContent = () => {
    const norm = currentPath.toLowerCase();

    if (norm.includes('/companies')) {
      return <PersonalCompaniesPage onNavigate={onNavigate} />;
    }
    if (norm.includes('/profile')) {
      return <PersonalProfilePage onNavigate={onNavigate} />;
    }
    if (norm.includes('/security')) {
      return <PersonalSecurityPage onNavigate={onNavigate} />;
    }
    if (norm.includes('/preferences')) {
      return <PersonalPreferencesPage onNavigate={onNavigate} />;
    }
    if (norm.includes('/notifications')) {
      return <PersonalNotificationsPage onNavigate={onNavigate} />;
    }
    if (norm.includes('/activity')) {
      return <PersonalActivityPage onNavigate={onNavigate} />;
    }
    if (norm.includes('/help')) {
      return <PersonalHelpPage onNavigate={onNavigate} />;
    }
    // Default: Dashboard
    return <PersonalDashboardPage onNavigate={onNavigate} />;
  };

  return (
    <PersonalPortalLayout currentPath={currentPath} onNavigate={onNavigate}>
      {renderContent()}
    </PersonalPortalLayout>
  );
};

export default PersonalPortalPage;
