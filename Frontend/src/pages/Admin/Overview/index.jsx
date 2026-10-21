import React, { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw,
  Clock,
  Users,
  Building2,
  TrendingUp,
  Scale,
  Bell,
  ArrowRight,
  ShieldCheck,
  Cpu,
  Activity,
  Layers,
  Sparkles,
  PieChart,
} from 'lucide-react';
import { fetchAdminOverview } from '../../../services/adminOverviewService';
import GlobalScopeSelector from './components/GlobalScopeSelector';
import KPISection from './components/KPISection';
import PlatformHealthSection from './components/PlatformHealthSection';
import { OrganizationGrowthSection } from './components/GrowthAndAnalyticsSections';
import { AIOverviewSection } from './components/AIAndAgentSections';
import { RecentActivitySection } from './components/FeedsSections';
import InteractiveOrganizationGrowthChart from '../../../components/admin/InteractiveOrganizationGrowthChart';
import { useAuth } from '../../../context/AuthContext';

export const OverviewPage = ({ onNavigate }) => {
  const { activeRole } = useAuth();

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
              Bàn Điều Khiển Quản Trị Nền Tảng ({activeRole === 'SUPER_ADMIN' ? 'Super Admin Hub' : 'Admin Operations Hub'})
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
                border: '1px solid rgba(5, 150, 105, 0.25)',
              }}
            >
              {activeRole === 'SUPER_ADMIN' ? 'SUPER ADMIN' : 'ADMIN'}
            </span>
          </div>
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

      {/* SECTION 2: SUPER ADMIN QUICK HUBS (4 CORE OPERATIONS - 4 CARDS PER ROW) */}
      <style>{`
        .admin-overview-hubs-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 16px;
        }
        @media (max-width: 992px) {
          .admin-overview-hubs-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
        @media (max-width: 540px) {
          .admin-overview-hubs-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
      <div className="admin-overview-hubs-grid">
        {/* Hub 1: Quản Lý Người Dùng & Phân Quyền */}
        <div
          onClick={() => onNavigate && onNavigate('/admin/users')}
          style={{
            backgroundColor: '#FFFFFF',
            border: '1px solid var(--dash-border)',
            borderRadius: '12px',
            padding: '16px 18px',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            boxShadow: 'var(--dash-shadow-xs)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = '#059669';
            e.currentTarget.style.transform = 'translateY(-2px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--dash-border)';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Users size={18} color="#059669" />
              <span style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--dash-text-primary)' }}>
                Quản Lý Người Dùng
              </span>
            </div>
            <ArrowRight size={14} color="var(--dash-text-muted)" />
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)', margin: '8px 0 12px 0' }}>
            Cấp quyền RBAC, khóa/mở khóa tài khoản và kiểm tra chi tiết người dùng
          </p>
          <div style={{ display: 'flex', gap: '8px' }}>
            <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#059669', backgroundColor: 'rgba(5, 150, 105, 0.1)', padding: '2px 6px', borderRadius: '4px' }}>
              Danh sách user
            </span>
            <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#1D4ED8', backgroundColor: '#EFF6FF', padding: '2px 6px', borderRadius: '4px' }}>
              Phân cấp RBAC
            </span>
          </div>
        </div>

        {/* Hub 2: Quản Lý Doanh Nghiệp & Tăng Trưởng */}
        <div
          onClick={() => onNavigate && onNavigate('/admin/analytics')}
          style={{
            backgroundColor: '#FFFFFF',
            border: '1px solid var(--dash-border)',
            borderRadius: '12px',
            padding: '16px 18px',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            boxShadow: 'var(--dash-shadow-xs)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = '#059669';
            e.currentTarget.style.transform = 'translateY(-2px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--dash-border)';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Building2 size={18} color="#059669" />
              <span style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--dash-text-primary)' }}>
                Công Ty & Thống Kê
              </span>
            </div>
            <ArrowRight size={14} color="var(--dash-text-muted)" />
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)', margin: '8px 0 12px 0' }}>
            Xem hồ sơ công ty và biểu đồ tăng trưởng khách hàng theo Tháng/Năm
          </p>
          <div style={{ display: 'flex', gap: '8px' }}>
            <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#059669', backgroundColor: 'rgba(5, 150, 105, 0.1)', padding: '2px 6px', borderRadius: '4px' }}>
              86 Doanh nghiệp
            </span>
            <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#D97706', backgroundColor: '#FEFCE8', padding: '2px 6px', borderRadius: '4px' }}>
              Thống kê 12 tháng
            </span>
          </div>
        </div>

        {/* Hub 3: Đánh Giá & So Sánh Mô Hình AI */}
        <div
          onClick={() => onNavigate && onNavigate('/admin/ai/comparison')}
          style={{
            backgroundColor: '#FFFFFF',
            border: '1px solid var(--dash-border)',
            borderRadius: '12px',
            padding: '16px 18px',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            boxShadow: 'var(--dash-shadow-xs)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = '#059669';
            e.currentTarget.style.transform = 'translateY(-2px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--dash-border)';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Scale size={18} color="#059669" />
              <span style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--dash-text-primary)' }}>
                Đánh Giá Mô Hình AI
              </span>
            </div>
            <ArrowRight size={14} color="var(--dash-text-muted)" />
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)', margin: '8px 0 12px 0' }}>
            So sánh đối đầu phiên bản trước vs sau, kiểm tra độ lệch trôi dữ liệu
          </p>
          <div style={{ display: 'flex', gap: '8px' }}>
            <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#059669', backgroundColor: 'rgba(5, 150, 105, 0.1)', padding: '2px 6px', borderRadius: '4px' }}>
              So sánh Trước/Sau
            </span>
            <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#7C3AED', backgroundColor: '#F5F3FF', padding: '2px 6px', borderRadius: '4px' }}>
              Kho 5 Model
            </span>
          </div>
        </div>

        {/* Hub 4: Phát Thông Báo Toàn Mạng */}
        <div
          onClick={() => onNavigate && onNavigate('/admin/notifications')}
          style={{
            backgroundColor: '#FFFFFF',
            border: '1px solid var(--dash-border)',
            borderRadius: '12px',
            padding: '16px 18px',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            boxShadow: 'var(--dash-shadow-xs)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = '#059669';
            e.currentTarget.style.transform = 'translateY(-2px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--dash-border)';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Bell size={18} color="#059669" />
              <span style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--dash-text-primary)' }}>
                Phát Thông Báo Toàn Mạng
              </span>
            </div>
            <ArrowRight size={14} color="var(--dash-text-muted)" />
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)', margin: '8px 0 12px 0' }}>
            Phát tin bảo trì hệ thống, tin tức nâng cấp AI tới toàn bộ người dùng
          </p>
          <div style={{ display: 'flex', gap: '8px' }}>
            <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#059669', backgroundColor: 'rgba(5, 150, 105, 0.1)', padding: '2px 6px', borderRadius: '4px' }}>
              Ghim banner nổi
            </span>
            <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#D97706', backgroundColor: '#FEFCE8', padding: '2px 6px', borderRadius: '4px' }}>
              Hộp thư cảnh báo
            </span>
          </div>
        </div>
      </div>

      {/* SECTION 3: KPI CARDS */}
      <KPISection
        kpiData={data?.kpi}
        status={status}
        errorMessage={errorMessage}
        onRetry={handleManualRefresh}
        onNavigate={onNavigate}
      />

      {/* SECTION 4: INTERACTIVE ORGANIZATION & TENANT GROWTH DYNAMICS (DAY / MONTH / YEAR) */}
      <InteractiveOrganizationGrowthChart />

      {/* SECTION 5: PLATFORM CORE SUBSYSTEMS HEALTH */}
      <PlatformHealthSection
        healthData={data?.platformHealth}
        status={status}
        errorMessage={errorMessage}
        onRetry={handleManualRefresh}
      />

      {/* SECTION 5: 2-COLUMN GRID (ORGANIZATION GROWTH & AI PLATFORM OVERVIEW) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '20px' }}>
        {/* ORGANIZATION GROWTH SECTION */}
        <OrganizationGrowthSection
          growthData={data?.organizationGrowth}
          status={status}
          errorMessage={errorMessage}
          onRetry={handleManualRefresh}
        />

        {/* AI OVERVIEW SECTION */}
        <AIOverviewSection
          aiData={data?.aiOverview}
          status={status}
          errorMessage={errorMessage}
          onRetry={handleManualRefresh}
        />
      </div>

      {/* SECTION 6: RECENT PLATFORM ACTIVITY (AUDIT TRAIL) */}
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
