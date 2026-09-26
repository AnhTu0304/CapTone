import React, { useEffect } from 'react';
import OnboardingLayout from '../../components/onboarding/OnboardingLayout';
import OrganizationStep from './OrganizationStep';
import EnvironmentStep from './EnvironmentStep';
import KubernetesStep from './KubernetesStep';
import VerifyAgentStep from './VerifyAgentStep';
import CompleteStep from './CompleteStep';
import { OnboardingProvider, useOnboarding } from '../../context/OnboardingContext';

const OnboardingContent = ({ currentPath = '/onboarding/organization', onNavigate }) => {
  const { currentStep, setStep } = useOnboarding();

  // Normalize path
  const normalizedPath = currentPath.toLowerCase().split('?')[0].split('#')[0];

  // Sync step number from URL
  useEffect(() => {
    if (normalizedPath.includes('/onboarding/organization')) {
      setStep(1);
    } else if (normalizedPath.includes('/onboarding/environment')) {
      setStep(2);
    } else if (normalizedPath.includes('/onboarding/kubernetes')) {
      setStep(3);
    } else if (normalizedPath.includes('/onboarding/verify-agent')) {
      setStep(4);
    } else if (normalizedPath.includes('/onboarding/complete')) {
      setStep(5);
    }
  }, [normalizedPath, setStep]);

  const handleStepClick = (stepNumber, targetPath) => {
    setStep(stepNumber);
    if (onNavigate) {
      onNavigate(targetPath);
    }
  };

  const renderCurrentStep = () => {
    if (normalizedPath.includes('/onboarding/environment')) {
      return <EnvironmentStep onNavigate={onNavigate} />;
    }
    if (normalizedPath.includes('/onboarding/kubernetes')) {
      return <KubernetesStep onNavigate={onNavigate} />;
    }
    if (normalizedPath.includes('/onboarding/verify-agent')) {
      return <VerifyAgentStep onNavigate={onNavigate} />;
    }
    if (normalizedPath.includes('/onboarding/complete')) {
      return <CompleteStep onNavigate={onNavigate} />;
    }

    // Default to Step 1: Organization
    return <OrganizationStep onNavigate={onNavigate} />;
  };

  return (
    <OnboardingLayout
      currentStep={currentStep}
      onStepClick={handleStepClick}
      onNavigate={onNavigate}
    >
      {renderCurrentStep()}
    </OnboardingLayout>
  );
};

export const OnboardingPage = ({ currentPath, onNavigate }) => {
  return (
    <OnboardingProvider>
      <OnboardingContent currentPath={currentPath} onNavigate={onNavigate} />
    </OnboardingProvider>
  );
};

export default OnboardingPage;
