import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Clock } from 'lucide-react';
import { fetchAdminOverview } from '../../../services/adminOverviewService';
import GlobalScopeSelector from './components/GlobalScopeSelector';
import KPISection from './components/KPISection';
import PlatformHealthSection from './components/PlatformHealthSection';
import InfrastructureSection from './components/InfrastructureSection';
import {
  OrganizationGrowthSection,
  IncidentAnalyticsSection,
  SelfHealingAnalyticsSection,
} from './components/GrowthAndAnalyticsSections';
import { AIOverviewSection, AgentHealthSection } from './components/AIAndAgentSections';
import { CriticalIncidentFeedSection, RecentActivitySection } from './components/FeedsSections';

export const OverviewPage = ({ onNavigate }) => {
  // Global scope state
  const [scope, setScope] = useState({
    orgId: 'acme-corp',
    env: 'all',
    clusterId: 'all',
    timeRange: '24h',
  });

  // Data fetching state
  const [status, setStatus] = useState('loading'); // 'loading' | 'ready' | 'empty' | 'error' | 'no-data' | 'disconnected'
  const [data, setData] = useState(null);
  const [lastUpdated, setLastUpdated] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch handler through dedicated service layer
  const loadData = useCallback(async (currentScope) => {
    setIsRefreshing(true);
    setStatus('loading');
    setErrorMessage('');

    try {
      const response = await fetchAdminOverview(currentScope);
      setStatus(response.status);
      setLastUpdated(response.timestamp);
      setData(response.data);
      if (response.message) {
        setErrorMessage(response.message);
      }
    } catch (err) {
      setStatus('error');
      setErrorMessage(err.message || 'Lỗi không xác định khi truy vấn dữ liệu từ dịch vụ quản trị.');
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  // Initial mount & scope change
  useEffect(() => {
    loadData(scope);
  }, [scope, loadData]);

  // Manual refresh handler
  const handleManualRefresh = () => {
    loadData(scope);
  };

  return (
    <div
      className="admin-overview-page"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
        maxWidth: '1440px',
        margin: '0 auto',
        paddingBottom: '40px',
      }}
    >
      {/* SECTION 1: PAGE HEADER */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h1
              style={{
                fontSize: '1.5rem',
                fontWeight: 800,
                color: 'var(--dash-text-primary)',
                letterSpacing: '-0.02em',
                margin: 0,
              }}
            >
              Bàn Điều Khiển Sức Khỏe Nền Tảng
            </h1>
            <span
              style={{
                padding: '2px 8px',
                borderRadius: '6px',
                backgroundColor: 'rgba(5, 150, 105, 0.1)',
                color: '#065F46',
                fontSize: '0.6875rem',
                fontWeight: 700,
                fontFamily: 'var(--font-mono)',
              }}
            >
              PLATFORM HEALTH
            </span>
          </div>
          <p
            style={{
              fontSize: '0.8125rem',
              color: 'var(--dash-text-secondary)',
              margin: '4px 0 0 0',
            }}
          >
            Giám sát tập trung viễn trắc eBPF, tỷ lệ tự phục hồi MAPE-K và sức khỏe cụm Kubernetes toàn hệ thống
          </p>
        </div>

        {/* Snapshot Timestamp & Manual Refresh Action */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {lastUpdated && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '8px',
                backgroundColor: '#FFFFFF',
                border: '1px solid var(--dash-border)',
                fontSize: '0.75rem',
                color: 'var(--dash-text-muted)',
                fontFamily: 'var(--font-mono)',
                boxShadow: 'var(--dash-shadow-xs)',
              }}
            >
              <Clock size={13} color="#64748B" />
              <span>Ảnh chụp: <strong style={{ color: 'var(--dash-text-primary)' }}>{lastUpdated}</strong></span>
            </div>
          )}

          <button
            type="button"
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            aria-label="Làm mới dữ liệu nền tảng"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 16px',
              backgroundColor: isRefreshing ? '#94A3B8' : 'var(--dash-primary)',
              color: '#FFFFFF',
              borderRadius: '9px',
              border: 'none',
              fontSize: '0.8125rem',
              fontWeight: 700,
              cursor: isRefreshing ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.15s ease',
              boxShadow: '0 2px 4px rgba(5, 150, 105, 0.25)',
            }}
          >
            <RefreshCw
              size={14}
              style={{
                animation: isRefreshing ? 'spin 1s linear infinite' : 'none',
              }}
            />
            <span>{isRefreshing ? 'Đang Nạp...' : 'Làm Mới Dữ Liệu'}</span>
          </button>
        </div>
      </div>

      {/* SECTION 2: GLOBAL SCOPE SELECTOR */}
      <GlobalScopeSelector
        scope={scope}
        onChange={setScope}
        isRefreshing={isRefreshing}
      />

      {/* SECTION 3: KPI CARDS */}
      <KPISection
        kpiData={data?.kpi}
        status={status}
        errorMessage={errorMessage}
        onRetry={handleManualRefresh}
      />

      {/* SECTION 4: PLATFORM HEALTH SUBSYSTEMS */}
      <PlatformHealthSection
        healthData={data?.platformHealth}
        status={status}
        errorMessage={errorMessage}
        onRetry={handleManualRefresh}
      />

      {/* SECTION 5: INFRASTRUCTURE OVERVIEW */}
      <InfrastructureSection
        infraData={data?.infrastructure}
        status={status}
        errorMessage={errorMessage}
        onRetry={handleManualRefresh}
      />

      {/* 2-COLUMN GRID: GROWTH & ANALYTICS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px' }}>
        {/* SECTION 6: ORGANIZATION GROWTH */}
        <OrganizationGrowthSection
          growthData={data?.organizationGrowth}
          status={status}
          errorMessage={errorMessage}
          onRetry={handleManualRefresh}
        />

        {/* SECTION 7: INCIDENT ANALYTICS */}
        <IncidentAnalyticsSection
          incidentData={data?.incidentAnalytics}
          status={status}
          errorMessage={errorMessage}
          onRetry={handleManualRefresh}
        />
      </div>

      {/* 2-COLUMN GRID: SELF-HEALING & AI OVERVIEW */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px' }}>
        {/* SECTION 8: SELF-HEALING ANALYTICS */}
        <SelfHealingAnalyticsSection
          healingData={data?.selfHealingAnalytics}
          status={status}
          errorMessage={errorMessage}
          onRetry={handleManualRefresh}
        />

        {/* SECTION 9: AI OVERVIEW */}
        <AIOverviewSection
          aiData={data?.aiOverview}
          status={status}
          errorMessage={errorMessage}
          onRetry={handleManualRefresh}
        />
      </div>

      {/* SECTION 10: AGENT HEALTH & KERNEL PROBES */}
      <AgentHealthSection
        agentData={data?.agentHealth}
        status={status}
        errorMessage={errorMessage}
        onRetry={handleManualRefresh}
      />

      {/* SECTION 11: CRITICAL INCIDENT FEED */}
      <CriticalIncidentFeedSection
        incidents={data?.criticalIncidents}
        status={status}
        errorMessage={errorMessage}
        onRetry={handleManualRefresh}
        onNavigate={onNavigate}
      />

      {/* SECTION 12: RECENT ACTIVITY */}
      <RecentActivitySection
        activities={data?.recentActivity}
        status={status}
        errorMessage={errorMessage}
        onRetry={handleManualRefresh}
        onNavigate={onNavigate}
      />
    </div>
  );
};

export default OverviewPage;
