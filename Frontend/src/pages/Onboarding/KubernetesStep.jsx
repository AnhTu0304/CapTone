import React, { useState, useEffect } from 'react';
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
import { onboardingService } from '../../services/onboardingService';

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
  const [registering, setRegistering] = useState(false);

  // Tự động khởi tạo Agent trên backend nếu đã có organization và environment
  useEffect(() => {
    let isMounted = true;
    const registerAgentOnBackend = async () => {
      if (organization?.id && environment?.id && !cluster?.agentId) {
        try {
          const res = await onboardingService.createAgent(organization.id, {
            name: clusterName,
            environment_id: environment.id,
            version: 'v1.0.0',
          });

          if (isMounted && res?.token?.raw_token) {
            updateCluster({
              agentId: res.agent?.id,
              name: clusterName,
              token: res.token.raw_token,
              tokenGeneratedAt: res.token.created_at || new Date().toISOString(),
              installCommand: res.install_command,
              isRegistered: true,
            });
          }
        } catch (err) {
          console.warn('[KubernetesStep] Đăng ký Agent trên backend gặp lỗi:', err.message);
          try {
            const existingAgents = await onboardingService.getAgents(organization.id);
            if (isMounted && existingAgents && existingAgents.length > 0) {
              const matchedAgent = existingAgents.find((a) => a.environment_id === environment.id) || existingAgents[0];
              try {
                const tokenData = await onboardingService.generateNewToken(organization.id, matchedAgent.id);
                updateCluster({
                  agentId: matchedAgent.id,
                  name: matchedAgent.name || clusterName,
                  token: tokenData.raw_token,
                  tokenGeneratedAt: tokenData.created_at || new Date().toISOString(),
                  isRegistered: true,
                });
              } catch (tokenErr) {
                console.warn('[KubernetesStep] Không thể tạo token mới cho Agent:', tokenErr);
                updateCluster({
                  agentId: matchedAgent.id,
                  name: matchedAgent.name || clusterName,
                  isRegistered: true,
                });
              }
            }
          } catch (agentErr) {
            console.warn('[KubernetesStep] Không thể truy vấn Agent hiện có:', agentErr);
          }
        }
      }
    };

    registerAgentOnBackend();
    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organization?.id, environment?.id]);

  const handleBack = () => {
    setStep(2);
    if (onNavigate) {
      onNavigate('/onboarding/environment');
    }
  };

  const handleContinue = async () => {
    if (!clusterName.trim()) {
      setError('Vui lòng nhập tên định danh cụm máy chủ hợp lệ.');
      return;
    }

    // Nếu chưa tạo agent trên backend thì tạo ngay lúc này
    if (organization?.id && environment?.id && !cluster?.agentId) {
      setRegistering(true);
      try {
        const res = await onboardingService.createAgent(organization.id, {
          name: clusterName.trim(),
          environment_id: environment.id,
          version: 'v1.0.0',
        });

        if (res?.token?.raw_token) {
          updateCluster({
            agentId: res.agent?.id,
            name: clusterName.trim(),
            token: res.token.raw_token,
            tokenGeneratedAt: res.token.created_at || new Date().toISOString(),
            installCommand: res.install_command,
            isRegistered: true,
          });
        }
      } catch (err) {
        console.warn('[KubernetesStep] Lỗi tạo Agent, dùng fallback local:', err.message);
      } finally {
        setRegistering(false);
      }
    } else {
      updateCluster({
        name: clusterName.trim(),
        isRegistered: true,
      });
    }

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
        token={cluster?.token || 'sh_live_sec_default_token'}
        tokenGeneratedAt={cluster?.tokenGeneratedAt}
        onRegenerate={generateNewToken}
      />

      {/* 3. Install SelfHeal Agent */}
      <InstallationCodeBlock
        clusterName={clusterName}
        token={cluster?.token || 'sh_live_sec_default_token'}
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
        <PrimaryButton onClick={handleContinue} disabled={registering}>
          {registering ? 'Đang tạo Tác tử...' : 'Xác thực Kết nối Tác tử'}
        </PrimaryButton>
      </div>
    </div>
  );
};

export default KubernetesStep;
