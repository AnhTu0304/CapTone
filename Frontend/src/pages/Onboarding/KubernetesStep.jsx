import React, { useState } from 'react';
import StepHeader from '../../components/onboarding/StepHeader';
import OrganizationSummary from '../../components/onboarding/OrganizationSummary';
import EnvironmentSummary from '../../components/onboarding/EnvironmentSummary';
import ClusterRegistrationCard from '../../components/onboarding/ClusterRegistrationCard';
import AgentTokenCard from '../../components/onboarding/AgentTokenCard';
import InstallationCodeBlock from '../../components/onboarding/InstallationCodeBlock';
import RBACNotice from '../../components/onboarding/RBACNotice';
import PrimaryButton from '../../components/onboarding/PrimaryButton';
import SecondaryButton from '../../components/onboarding/SecondaryButton';
import ErrorAlert from '../../components/onboarding/ErrorAlert';
import { useOnboarding } from '../../context/OnboardingContext';

export const KubernetesStep = ({ onNavigate }) => {
  const {
    organization,
    environment,
    cluster,
    updateCluster,
    generateNewToken,
    setStep,
  } = useOnboarding();

  const [clusterName, setClusterName] = useState(cluster?.name || 'k8s-prod-east-01');
  const [error, setError] = useState('');
  const [isGeneratingToken, setIsGeneratingToken] = useState(false);

  const handleRegenerateToken = async () => {
    setIsGeneratingToken(true);
    setError('');
    try {
      await generateNewToken();
    } catch (err) {
      setError(err.message || 'Không thể cấp lại Token vào lúc này');
    } finally {
      setIsGeneratingToken(false);
    }
  };

  const handleBack = () => {
    setStep(2);
    if (onNavigate) {
      onNavigate('/onboarding/environment');
    }
  };

  /**
   * Chuyển qua Bước 4: Kiểm tra ràng buộc hợp lệ của Cụm máy chủ và điều hướng sang chỉ dẫn
   * (Chưa nạp vào Database - việc nạp vào Database được thực hiện ở Bước 4 khi hoàn tất)
   */
  const handleContinue = () => {
    if (!clusterName.trim()) {
      setError('Vui lòng nhập tên định danh cụm máy chủ hợp lệ.');
      return;
    }

    // Kiểm tra định dạng tên cụm K8s chuẩn DNS (chữ thường, số, dấu gạch ngang)
    const clusterNameRegex = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/;
    if (!clusterNameRegex.test(clusterName.trim())) {
      setError('Tên định danh cụm máy chủ chỉ được chứa chữ thường, số và dấu gạch ngang (không bắt đầu hoặc kết thúc bằng gạch ngang).');
      return;
    }

    setError('');

    // Cập nhật thông tin cụm vào Context
    updateCluster({
      name: clusterName.trim(),
      isRegistered: true,
    });

    // Chuyển sang Bước 4 (Chỉ dẫn Kết nối Tác tử)
    setStep(4);
    if (onNavigate) {
      onNavigate('/onboarding/verify-agent');
    }
  };

  return (
    <div className="onboarding-step-kubernetes">
      <StepHeader
        stepNumber={3}
        totalSteps={5}
        category="KẾT NỐI KUBERNETES"
        title="Kết nối môi trường Kubernetes"
        description="Kết nối cụm máy chủ của bạn với SelfHeal để bắt đầu giám sát và kích hoạt tự phục hồi."
      />

      {error && <ErrorAlert message={error} onRetry={() => setError('')} />}

      {/* Organization and Environment Summaries */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px', marginBottom: '8px' }}>
        <OrganizationSummary
          organization={organization}
          onEdit={() => {
            setStep(1);
            if (onNavigate) onNavigate('/onboarding/organization');
          }}
          style={{ marginBottom: '12px' }}
        />
        <EnvironmentSummary
          environment={environment}
          onEdit={handleBack}
          style={{ marginBottom: '12px' }}
        />
      </div>

      {/* 1. Register Cluster */}
      <ClusterRegistrationCard
        clusterName={clusterName}
        onChangeClusterName={setClusterName}
        isRegistered={cluster?.isRegistered}
      />

      {/* 2. Generate Agent Token */}
      <AgentTokenCard
        token={cluster?.token || ''}
        tokenPrefix={cluster?.tokenPrefix || ''}
        tokenGeneratedAt={cluster?.tokenGeneratedAt}
        onRegenerate={handleRegenerateToken}
        isGenerating={isGeneratingToken}
      />

      {/* 3. Install SelfHeal Agent */}
      <InstallationCodeBlock
        clusterName={clusterName}
        token={cluster?.token || ''}
        environmentName={environment?.name || 'Staging'}
      />

      {/* 4. RBAC Minimum Privilege Security Notice */}
      <RBACNotice onNavigate={onNavigate} />

      {/* Navigation Actions */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: '32px',
          paddingTop: '20px',
          borderTop: '1px dashed var(--border-default)',
        }}
      >
        <SecondaryButton onClick={handleBack}>Quay lại Môi trường</SecondaryButton>
        <PrimaryButton onClick={handleContinue}>
          Chỉ dẫn Kết nối Tác tử
        </PrimaryButton>
      </div>
    </div>
  );
};

export default KubernetesStep;
