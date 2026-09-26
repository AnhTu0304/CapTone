import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'selfheal_onboarding_state_v1';

const initialDefaultState = {
  organization: {
    name: 'Acme Cloud Corp',
    slug: 'acme-cloud-corp',
    description: 'Cloud native microservices infrastructure for retail platform',
  },
  environment: {
    name: 'Production',
    type: 'staging', // 'development' | 'staging'
    description: 'Primary staging cluster before production deployment',
  },
  cluster: {
    name: 'k8s-prod-east-01',
    token: 'sh_live_sec_994a8f21e7b30c1d64aa9c80f4',
    tokenGeneratedAt: '2026-09-18T09:30:00Z',
    isRegistered: true,
  },
  agentStatus: {
    state: 'connected', // 'waiting' | 'connecting' | 'connected' | 'failed' | 'permission_denied' | 'token_expired' | 'offline'
    lastHeartbeat: '3s ago',
    latencyMs: 14,
    k8sVersion: 'v1.29.4',
    nodeCount: 4,
    podsMonitored: 38,
    k8sAccess: true,
    monitoringReady: true,
    aiDataReadiness: 'calibrating', // 'calibrating' (collecting baseline telemetry) | 'ready'
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

  const generateNewToken = () => {
    const randomHex = Array.from({ length: 24 }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join('');
    const newToken = `sh_live_sec_${randomHex}`;
    updateCluster({
      token: newToken,
      tokenGeneratedAt: new Date().toISOString(),
    });
    return newToken;
  };

  const retryAgentVerification = () => {
    updateAgentStatus({ state: 'connecting' });
    setTimeout(() => {
      updateAgentStatus({
        state: 'connected',
        lastHeartbeat: 'just now',
        latencyMs: 12,
        k8sAccess: true,
        monitoringReady: true,
      });
    }, 1200);
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
