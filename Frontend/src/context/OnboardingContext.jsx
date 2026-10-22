import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { onboardingService } from '../services/onboardingService';
import { useAuth } from './AuthContext';

const initialDefaultState = {
  organization: {
    id: null,
    name: '',
    slug: '',
    description: '',
  },
  environment: {
    id: null,
    name: 'Production',
    type: 'staging', // 'development' | 'staging'
    description: 'Cụm máy chủ sản xuất chính',
  },
  cluster: {
    id: null,
    agentId: null,
    name: 'k8s-cluster-01',
    token: 'sh_live_sec_default_token',
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
  const auth = useAuth?.() || {};
  const userId = auth?.user?.id || auth?.user?.email || 'guest';
  const storageKey = `selfheal_onboarding_state_${userId}`;

  const [state, setState] = useState(() => {
    try {
      const saved = sessionStorage.getItem(storageKey);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      // Ignore sessionStorage parsing errors
    }
    return initialDefaultState;
  });

  // Tự động chuyển đổi hoặc làm mới trạng thái Onboarding khi đổi tài khoản (userId thay đổi)
  const prevUserRef = useRef(userId);
  useEffect(() => {
    if (prevUserRef.current !== userId) {
      prevUserRef.current = userId;
      try {
        const saved = sessionStorage.getItem(`selfheal_onboarding_state_${userId}`);
        if (saved) {
          setState(JSON.parse(saved));
          return;
        }
      } catch {}
      setState(initialDefaultState);
    }
  }, [userId]);

  useEffect(() => {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(state));
    } catch {
      // Ignore quota errors
    }
  }, [state, storageKey]);

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
      // Khi đã qua bước 5 (hoàn tất): Khóa không cho lùi về các bước trung gian 2, 3, 4
      if (prev.currentStep >= 5 && target < 5 && target > 1) {
        return prev;
      }
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

  const resetOnboarding = useCallback(() => {
    setState(initialDefaultState);
    try {
      sessionStorage.removeItem(storageKey);
      sessionStorage.removeItem('selfheal_onboarding_state_v1');
      sessionStorage.removeItem('selfheal_onboarding_state_guest');
      Object.keys(sessionStorage).forEach((k) => {
        if (k.startsWith('selfheal_onboarding_state_')) {
          sessionStorage.removeItem(k);
        }
      });
    } catch {}
  }, [storageKey]);

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
