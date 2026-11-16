import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, LayoutDashboard } from 'lucide-react';
import { fetchAdminOverview } from '../../../services/adminOverviewService';
import KPISection from './components/KPISection';
import { AIOverviewSection } from './components/AIAndAgentSections';
import InteractiveOrganizationGrowthChart from '../../../components/admin/InteractiveOrganizationGrowthChart';

export const OverviewPage = ({ onNavigate }) => {

  // Global scope state
  const [scope, setScope] = useState({
    orgId: 'all',
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #059669 0%, #10B981 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FFFFFF',
              boxShadow: '0 4px 10px rgba(5, 150, 105, 0.25)',
              flexShrink: 0,
            }}
          >
            <LayoutDashboard size={24} />
          </div>
          <div>
            <h1
              style={{
                fontSize: '1.5rem',
                fontWeight: 800,
                color: 'var(--dash-text-primary)',
                letterSpacing: '-0.02em',
                margin: 0,
              }}
            >
              Bảng Điều Khiển Quản Trị Nền Tảng
            </h1>
            <p
              style={{
                fontSize: '0.8125rem',
                color: 'var(--dash-text-secondary)',
                margin: '4px 0 0 0',
              }}
            >
              Trung tâm quản trị toàn diện: Người dùng, Doanh nghiệp khách hàng, Đánh giá Mô hình AI và Thông báo toàn mạng.
            </p>
          </div>
        </div>

        {/* Manual Refresh Action */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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

      {/* SECTION 4: KPI CARDS */}
      <KPISection
        kpiData={data?.kpi}
        status={status}
        errorMessage={errorMessage}
        onRetry={handleManualRefresh}
        onNavigate={onNavigate}
      />

      {/* SECTION 5: INTERACTIVE ORGANIZATION & TENANT GROWTH DYNAMICS */}
      <InteractiveOrganizationGrowthChart
        kpiData={data?.kpi}
        statistics={data?.statistics}
      />

      {/* SECTION 6: AI PLATFORM OVERVIEW */}
      <AIOverviewSection
        aiData={data?.aiOverview}
        status={status}
        errorMessage={errorMessage}
        onRetry={handleManualRefresh}
      />
    </div>
  );
};

export default OverviewPage;
