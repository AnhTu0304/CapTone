import React from 'react';
import StepHeader from '../../components/onboarding/StepHeader';
import OrganizationSummary from '../../components/onboarding/OrganizationSummary';
import EnvironmentForm from '../../components/onboarding/EnvironmentForm';
import { useOnboarding } from '../../context/OnboardingContext';

export const EnvironmentStep = ({ onNavigate }) => {
  const { organization, environment, updateEnvironment, setStep } = useOnboarding();

  const handleBack = () => {
    setStep(1);
    if (onNavigate) {
      onNavigate('/onboarding/organization');
    }
  };

  const handleSave = (envData) => {
    updateEnvironment(envData);
    setStep(3);
    if (onNavigate) {
      onNavigate('/onboarding/kubernetes');
    }
  };

  return (
    <div className="onboarding-step-environment">
      <StepHeader
        stepNumber={2}
        totalSteps={5}
        category="MÔI TRƯỜNG HẠ TẦNG"
        title="Tạo môi trường giám sát"
        description="Phân tách tài nguyên hạ tầng của bạn theo từng môi trường cụ thể."
      />

      {/* Small organization summary card */}
      <OrganizationSummary
        organization={organization}
        onEdit={handleBack}
      />

      <EnvironmentForm
        initialData={environment}
        onSave={handleSave}
        onBack={handleBack}
      />
    </div>
  );
};

export default EnvironmentStep;
