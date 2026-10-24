import React from 'react';
import SetupSummary from '../../components/onboarding/SetupSummary';
import { useOnboarding } from '../../context/OnboardingContext';

export const CompleteStep = ({ onNavigate }) => {
  const {
    organization,
    environment,
    cluster,
    agentStatus,
    resetOnboarding,
  } = useOnboarding();

  // Chuyển hướng trực tiếp vào Dashboard của Doanh nghiệp (/dashboard)
  const handleGoToDashboard = () => {
    if (organization?.id) {
      try {
        localStorage.setItem('selfheal_active_org_id', organization.id);
        if (organization.name) {
          localStorage.setItem('selfheal_active_org_name', organization.name);
        }
        if (environment?.name) {
          localStorage.setItem('selfheal_active_env_name', environment.name);
        }
        if (cluster?.cluster_name || cluster?.name) {
          localStorage.setItem('selfheal_active_cluster_name', cluster.cluster_name || cluster.name);
        }
        const activeClusterId = cluster?.id || cluster?.clusterId;
        if (activeClusterId) {
          localStorage.setItem('selfheal_active_cluster_id', activeClusterId);
        }
      } catch (e) {
        console.warn('Cannot set active org in localStorage:', e);
      }
    }

    if (resetOnboarding) {
      resetOnboarding();
    }

    if (onNavigate) {
      onNavigate('/dashboard');
    } else {
      window.history.pushState({}, '', '/dashboard');
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  };

  const handleReadGuide = () => {
    if (onNavigate) {
      onNavigate('/guide');
    } else {
      window.history.pushState({}, '', '/guide');
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  };

  return (
    <div className="onboarding-step-complete">
      <SetupSummary
        organization={organization}
        environment={environment}
        cluster={cluster}
        agentStatus={agentStatus}
        onGoToDashboard={handleGoToDashboard}
        onReadGuide={handleReadGuide}
      />
    </div>
  );
};

export default CompleteStep;
