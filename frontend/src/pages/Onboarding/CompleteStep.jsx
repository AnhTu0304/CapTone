import React from 'react';
import SetupSummary from '../../components/onboarding/SetupSummary';
import { useOnboarding } from '../../context/OnboardingContext';

export const CompleteStep = ({ onNavigate }) => {
  const {
    organization,
    environment,
    cluster,
    agentStatus,
  } = useOnboarding();

  const handleGoToDashboard = () => {
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
