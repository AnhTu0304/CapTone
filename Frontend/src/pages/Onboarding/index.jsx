import React, { useEffect } from 'react';
import OnboardingLayout from '../../components/onboarding/OnboardingLayout';
import OrganizationStep from './OrganizationStep';
import EnvironmentStep from './EnvironmentStep';
import KubernetesStep from './KubernetesStep';
import VerifyAgentStep from './VerifyAgentStep';
import CompleteStep from './CompleteStep';
import { OnboardingProvider, useOnboarding } from '../../context/OnboardingContext';

const OnboardingContent = ({ currentPath = '/onboarding/organization', onNavigate }) => {
  const { currentStep, setStep, resetOnboarding } = useOnboarding();

  // Normalize path
  const normalizedPath = currentPath.toLowerCase().split('?')[0].split('#')[0];

  // Sync step number from URL
  useEffect(() => {
    // 1. Khi người dùng vào trang /onboarding hoặc /onboarding/organization (Bắt đầu tạo tổ chức)
    if (normalizedPath === '/onboarding' || normalizedPath === '/onboarding/organization') {
      if (currentStep >= 5) {
        // Đã hoàn tất phiên trước, người dùng muốn tạo tổ chức mới -> reset về bước 1
        resetOnboarding();
        return;
      }
      setStep(1);
      return;
    }

    // 2. Khi đang ở bước 5: Chặn quay lại các bước 2, 3, 4 qua URL, giữ ở complete
    if (currentStep >= 5) {
      if (!normalizedPath.includes('/onboarding/complete') && onNavigate) {
        onNavigate('/onboarding/complete');
      }
      return;
    }

    if (normalizedPath.includes('/onboarding/environment')) {
      setStep(2);
    } else if (normalizedPath.includes('/onboarding/kubernetes')) {
      setStep(3);
    } else if (normalizedPath.includes('/onboarding/verify-agent')) {
      setStep(4);
    } else if (normalizedPath.includes('/onboarding/complete')) {
      setStep(5);
    }
  }, [normalizedPath, currentStep, setStep, resetOnboarding, onNavigate]);

  const handleStepClick = (stepNumber, targetPath) => {
    // Khi đã qua bước 5 (hoàn tất): Không cho click lại các bước nào nữa
    if (currentStep >= 5) {
      return;
    }

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
