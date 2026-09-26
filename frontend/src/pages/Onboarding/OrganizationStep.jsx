import React from 'react';
import StepHeader from '../../components/onboarding/StepHeader';
import OrganizationForm from '../../components/onboarding/OrganizationForm';
import { useOnboarding } from '../../context/OnboardingContext';

export const OrganizationStep = ({ onNavigate }) => {
  const { organization, updateOrganization, setStep } = useOnboarding();

  const handleSave = (orgData) => {
    updateOrganization(orgData);
    setStep(2);
    if (onNavigate) {
      onNavigate('/onboarding/environment');
    }
  };

  return (
    <div className="onboarding-step-organization">
      <StepHeader
        stepNumber={1}
        totalSteps={5}
        category="KHÔNG GIAN TỔ CHỨC"
        title="Tạo tổ chức của bạn"
        description="Thiết lập không gian làm việc để bắt đầu giám sát và quản trị hạ tầng cụm máy chủ."
      />

      <OrganizationForm
        initialData={organization}
        onSave={handleSave}
      />
    </div>
  );
};

export default OrganizationStep;
