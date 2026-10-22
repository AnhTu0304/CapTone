import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { onboardingService } from '../services/onboardingService';

const STORAGE_KEY = 'selfheal_onboarding_state_v1';

const initialDefaultState = {
  organization: {
    id: null,
    name: 'Acme Cloud Corp',
    slug: 'acme-cloud-corp',
    description: 'Cloud native microservices infrastructure for retail platform',
  },
  environment: {
    id: null,
    name: 'Staging',
    type: 'staging', // 'development' | 'staging'
    description: 'Primary staging cluster before production deployment',
  },
  cluster: {
    id: null,
    agentId: null,
    name: 'k8s-prod-east-01',
    token: 'ag_live_sec_default_token',
    tokenGeneratedAt: new Date().toISOString(),
    installCommand: '',
    isRegistered: false,
  },
  agentStatus: {
    state: 'waiting', // 'waiting' | 'connecting' | 'connected' | 'failed' | 'permission_denied' | 'token_expired' | 'offline'
    lastHeartbeat: 'Chờ nhận tín hiệu đầu tiên...',
    latencyMs: null,
    k8sVersion: 'v1.29.4',
    nodeCount: 3,
    podsMonitored: 12,
    k8sAccess: true,
    monitoringReady: true,
    aiDataReadiness: 'calibrating', // 'calibrating' | 'ready'
    telemetrySamples: 1420,
    requiredSamples: 3000,
  },
  currentStep: 1, // 1 to 5
};

const OnboardingContext = createContext(null);

export const OnboardingProvider = ({ children }) => {
  const [state, setState] = useState(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      // Ignore sessionStorage parsing errors
    }
    return initialDefaultState;
  });

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore quota errors
    }
  }, [state]);

  const updateOrganization = (orgData) => {
    setState((prev) => ({
      ...prev,
      organization: { ...prev.organization, ...orgData },
    }));
  };

  const updateEnvironment = (envData) => {
    setState((prev) => ({
      ...prev,
      environment: { ...prev.environment, ...envData },
    }));
  };

  const updateCluster = (clusterData) => {
    setState((prev) => ({
      ...prev,
      cluster: { ...prev.cluster, ...clusterData },
    }));
  };

  const updateAgentStatus = (statusData) => {
    setState((prev) => ({
      ...prev,
      agentStatus: { ...prev.agentStatus, ...statusData },
    }));
  };

  const setStep = useCallback((stepNumber) => {
    const target = Math.max(1, Math.min(5, stepNumber));
    setState((prev) => {
      if (prev.currentStep === target) return prev;
      return {
        ...prev,
        currentStep: target,
      };
    });
  }, []);

  /**
   * Sinh Token kết nối mới (Xoay vòng token bảo mật)
   * Kết nối với backend API nếu có orgId và agentId
   */
  const generateNewToken = async () => {
    const orgId = state.organization?.id;
    const agentId = state.cluster?.agentId;

    if (orgId && agentId) {
      try {
        const tokenData = await onboardingService.generateNewToken(orgId, agentId);
        updateCluster({
          token: tokenData.raw_token,
          tokenGeneratedAt: tokenData.created_at || new Date().toISOString(),
        });
        return tokenData.raw_token;
      } catch (err) {
        console.warn('[Onboarding] Lỗi gọi API xoay vòng token, dùng fallback local:', err);
      }
    }

    // Fallback nếu chạy offline hoặc chưa có agentId
    const randomHex = Array.from({ length: 24 }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join('');
    const newToken = `ag_live_${randomHex}`;
    updateCluster({
      token: newToken,
      tokenGeneratedAt: new Date().toISOString(),
    });
    return newToken;
  };

  /**
   * Kiểm tra và xác thực trạng thái kết nối của Agent
   * Kết nối với backend API để kiểm tra trạng thái thực tế
   */
  const retryAgentVerification = async () => {
    updateAgentStatus({ state: 'connecting' });

    const orgId = state.organization?.id;
    const agentId = state.cluster?.agentId;

    if (orgId && agentId) {
      try {
        const agentDetail = await onboardingService.checkAgentStatus(orgId, agentId);
        if (agentDetail?.status === 'ONLINE') {
          updateAgentStatus({
            state: 'connected',
            lastHeartbeat: 'Vừa xong',
            latencyMs: agentDetail.last_latency_ms || 18,
            k8sAccess: true,
            monitoringReady: true,
          });
          return;
        } else {
          updateAgentStatus({
            state: 'waiting',
            lastHeartbeat: 'Chờ tín hiệu từ Pod Agent trong Kubernetes...',
            latencyMs: null,
          });
          return;
        }
      } catch (err) {
        console.warn('[Onboarding] Không thể kiểm tra Agent qua backend API:', err.message);
      }
    }

    // Fallback mô phỏng cho môi trường sandbox dev
    setTimeout(() => {
      updateAgentStatus({
        state: 'connected',
        lastHeartbeat: 'Vừa xong (mô phỏng sandbox)',
        latencyMs: 14,
        k8sAccess: true,
        monitoringReady: true,
      });
    }, 1000);
  };

  const resetOnboarding = () => {
    setState(initialDefaultState);
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {}
  };

  return (
    <OnboardingContext.Provider
      value={{
        ...state,
        updateOrganization,
        updateEnvironment,
        updateCluster,
        updateAgentStatus,
        setStep,
        generateNewToken,
        retryAgentVerification,
        resetOnboarding,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
};

export const useOnboarding = () => {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error('useOnboarding must be used within an OnboardingProvider');
  }
  return context;
};

export default OnboardingContext;
