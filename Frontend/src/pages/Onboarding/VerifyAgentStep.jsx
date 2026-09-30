import React, { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import StepHeader from '../../components/onboarding/StepHeader';
import ConnectionStatusCard from '../../components/onboarding/ConnectionStatusCard';
import TroubleshootingAccordion from '../../components/onboarding/TroubleshootingAccordion';
import PrimaryButton from '../../components/onboarding/PrimaryButton';
import SecondaryButton from '../../components/onboarding/SecondaryButton';
import { useOnboarding } from '../../context/OnboardingContext';

export const VerifyAgentStep = ({ onNavigate }) => {
  const {
    agentStatus,
    updateAgentStatus,
    retryAgentVerification,
    setStep,
  } = useOnboarding();

  const [simulatedState, setSimulatedState] = useState(agentStatus?.state || 'connected');
  const [retrying, setRetrying] = useState(false);

  const handleBack = () => {
    setStep(3);
    if (onNavigate) {
      onNavigate('/onboarding/kubernetes');
    }
  };

  const handleRetry = () => {
    setRetrying(true);
    setSimulatedState('connecting');
    updateAgentStatus({ state: 'connecting' });

    setTimeout(() => {
      setRetrying(false);
      setSimulatedState('connected');
      retryAgentVerification();
    }, 1200);
  };

  const handleContinue = () => {
    setStep(5);
    if (onNavigate) {
      onNavigate('/onboarding/complete');
    }
  };

  const isConnected = simulatedState === 'connected';

  return (
    <div className="onboarding-step-verify-agent">
      <StepHeader
        stepNumber={4}
        totalSteps={5}
        category="XÁC THỰC VIỄN TRẮC"
        title="Xác thực Tác tử SelfHeal"
        description="Kiểm tra kết nối của Tác tử và mức độ sẵn sàng truyền dữ liệu viễn trắc hạ tầng."
      />

      {/* Main 4-Indicator Connection Status Card with AI distinction */}
      <ConnectionStatusCard
        statusState={simulatedState}
        agentData={agentStatus}
      />

      {/* State Switcher for DevOps testing (Supports all 7 required states) */}
      <div
        style={{
          padding: '12px 16px',
          backgroundColor: 'var(--color-surface)',
          border: '1px dashed var(--border-default)',
          borderRadius: '0px',
          marginBottom: '20px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '10px',
        }}
      >
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
          MÔ PHỎNG TRẠNG THÁI KIỂM THỬ:
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {[
            { id: 'connected', label: 'Đã kết nối' },
            { id: 'connecting', label: 'Đang kết nối' },
            { id: 'waiting', label: 'Chờ Pod' },
            { id: 'failed', label: 'Thất bại' },
            { id: 'permission_denied', label: 'Từ chối quyền' },
            { id: 'token_expired', label: 'Token hết hạn' },
            { id: 'offline', label: 'Ngoại tuyến' },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setSimulatedState(item.id);
                updateAgentStatus({ state: item.id });
              }}
              style={{
                padding: '3px 8px',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.625rem',
                fontWeight: 700,
                backgroundColor: simulatedState === item.id ? 'var(--color-primary)' : 'rgba(61, 59, 79, 0.05)',
                color: simulatedState === item.id ? '#FFFFFF' : 'var(--color-primary)',
                border: '1px solid var(--border-default)',
                cursor: 'pointer',
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Troubleshooting Accordion for quick diagnostics */}
      <TroubleshootingAccordion />

      {/* Navigation and Action Bar */}
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
        <SecondaryButton onClick={handleBack}>Quay lại Thiết lập Cụm</SecondaryButton>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            type="button"
            onClick={handleRetry}
            disabled={retrying}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '12px 18px',
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--border-default)',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.8125rem',
              fontWeight: 700,
              color: 'var(--color-primary)',
              cursor: retrying ? 'not-allowed' : 'pointer',
            }}
          >
            <RefreshCw size={14} className={retrying ? 'animate-spin' : ''} />
            <span>{retrying ? 'Đang thử lại...' : 'Thử kết nối lại'}</span>
          </button>

          <PrimaryButton
            onClick={handleContinue}
            disabled={!isConnected}
            style={{
              backgroundColor: isConnected ? 'var(--color-primary)' : '#E2E8F0',
            }}
          >
            Tiếp tục Hoàn tất
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
};

export default VerifyAgentStep;
