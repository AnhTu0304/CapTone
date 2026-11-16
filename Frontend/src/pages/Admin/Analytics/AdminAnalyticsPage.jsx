import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  TrendingUp,
  Building2,
  Users,
  Calendar,
  Filter,
  Download,
  ArrowUpRight,
  Activity,
  Layers,
  PieChart,
  BarChart3,
  CheckCircle2,
  RefreshCw,
  X,
  AlertTriangle,
  Server,
  Radio,
  Clock,
  ShieldCheck,
  UserPlus,
  Zap,
} from 'lucide-react';
import adminAnalyticsService from '../../../services/adminAnalyticsService';

export const AdminAnalyticsPage = ({ onNavigate }) => {
  const [selectedYear, setSelectedYear] = useState('2026');
  const [selectedMonth, setSelectedMonth] = useState('ALL'); // 'ALL' | '1' .. '12'
  const [chartViewMode, setChartViewMode] = useState('ALL'); // 'ALL' | 'ORGS' | 'USERS'

  const [analyticsData, setAnalyticsData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  /**
   * Nạp dữ liệu thống kê tăng trưởng thực tế từ Backend API
   */
  const fetchAnalytics = useCallback(
    async (showRefreshToast = false) => {
      if (showRefreshToast) setIsRefreshing(true);
      else setIsLoading(true);
      setError(null);

      try {
        const data = await adminAnalyticsService.getGrowthAnalytics({
          year: Number(selectedYear),
          month: selectedMonth,
        });

        setAnalyticsData(data);
        if (showRefreshToast) {
          showToast(`Đã đồng bộ dữ liệu tăng trưởng mới nhất từ cơ sở dữ liệu!`);
        }
      } catch (err) {
        console.error('[AdminAnalyticsPage] Lỗi nạp số liệu thống kê:', err);
        setError(err.message || 'Không thể tải số liệu thống kê tăng trưởng từ máy chủ.');
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [selectedYear, selectedMonth]
  );

  useEffect(() => {
    fetchAnalytics(false);
  }, [fetchAnalytics]);

  /**
   * Xử lý xuất báo cáo CSV an toàn chống CSV Injection
   */
  const handleExportCsv = async () => {
    setIsExporting(true);
    try {
      await adminAnalyticsService.downloadGrowthCsv({
        year: Number(selectedYear),
        month: selectedMonth,
      });
      showToast('Đã xuất báo cáo tăng trưởng doanh nghiệp định dạng CSV thành công!');
    } catch (err) {
      console.error('[AdminAnalyticsPage] Lỗi xuất CSV:', err);
      alert('Không thể xuất báo cáo CSV: ' + (err.message || 'Lỗi kết nối'));
    } finally {
      setIsExporting(false);
    }
  };

  const kpi = analyticsData?.kpi || {
    totalOrganizations: 0,
    newOrganizationsThisMonth: 0,
    orgGrowthRatePercent: '0%',
    totalUsers: 0,
    activeUsers: 0,
    totalClusters: 0,
    totalNodes: 0,
    totalPods: 0,
    onlineAgents: 0,
    totalAgents: 0,
    agentAvailabilityRate: '0%',
    healingSuccessRate: '0%',
  };

  const monthlyGrowth = analyticsData?.monthlyGrowth || [];
  const maxNewOrgs = useMemo(() => {
    const vals = monthlyGrowth.map((d) => d.newOrgs);
    const m = Math.max(...vals, 0);
    return m > 0 ? m : 1;
  }, [monthlyGrowth]);

  const maxNewUsers = useMemo(() => {
    const vals = monthlyGrowth.map((d) => d.newUsers || 0);
    const m = Math.max(...vals, 0);
    return m > 0 ? m : 1;
  }, [monthlyGrowth]);

  const envBreakdown = analyticsData?.environmentBreakdown || {
    production: { count: 0, percentage: '0%' },
    staging: { count: 0, percentage: '0%' },
    development: { count: 0, percentage: '0%' },
  };

  const statusBreakdown = analyticsData?.statusBreakdown || {
    active: { count: 0, percentage: '0%' },
    suspended: { count: 0, percentage: '0%' },
  };

  const totalGrowthNewOrgsInYear = useMemo(() => {
    return monthlyGrowth.reduce((acc, curr) => acc + curr.newOrgs, 0);
  }, [monthlyGrowth]);

  const totalGrowthNewUsersInYear = useMemo(() => {
    return monthlyGrowth.reduce((acc, curr) => acc + (curr.newUsers || 0), 0);
  }, [monthlyGrowth]);

  const avgUsersPerOrg = useMemo(() => {
    return kpi.totalOrganizations > 0 ? (kpi.totalUsers / kpi.totalOrganizations).toFixed(1) : '0';
  }, [kpi.totalOrganizations, kpi.totalUsers]);

  const avgPodsPerCluster = useMemo(() => {
    return kpi.totalClusters > 0 ? (kpi.totalPods / kpi.totalClusters).toFixed(1) : '0';
  }, [kpi.totalClusters, kpi.totalPods]);

  const isMonthFiltered = selectedMonth !== 'ALL';

  return (
    <div
      className="admin-analytics-page"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
        maxWidth: '1440px',
        margin: '0 auto',
        paddingBottom: '48px',
      }}
    >
      {/* 1. Header & Actions */}
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
            <TrendingUp size={24} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <h1
                style={{
                  fontSize: '1.5rem',
                  fontWeight: 800,
                  color: 'var(--dash-text-primary)',
                  letterSpacing: '-0.02em',
                  margin: 0,
                }}
              >
                Thống Kê Tăng Trưởng & Dữ Liệu Doanh Nghiệp
              </h1>
              {isMonthFiltered && (
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    backgroundColor: '#ECFDF5',
                    color: '#065F46',
                    padding: '3px 8px',
                    borderRadius: '6px',
                    border: '1px solid #A7F3D0',
                  }}
                >
                  Đang lọc: Tháng {selectedMonth}/{selectedYear}
                </span>
              )}
            </div>
            <p
              style={{
                fontSize: '0.8125rem',
                color: 'var(--dash-text-secondary)',
                margin: '4px 0 0 0',
              }}
            >
              Phân tích số lượng công ty, người dùng hoạt động và quy mô hạ tầng K8s theo Tháng & Năm từ cơ sở dữ liệu thật.
            </p>
          </div>
        </div>

        {/* Filter Controls Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Year selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Calendar size={15} color="var(--dash-text-muted)" />
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                border: '1px solid var(--dash-border)',
                backgroundColor: '#FFFFFF',
                fontSize: '0.8125rem',
                fontWeight: 600,
                color: 'var(--dash-text-primary)',
                cursor: 'pointer',
              }}
            >
              <option value="2026">Năm 2026 (Hiện tại)</option>
              <option value="2025">Năm 2025</option>
              <option value="2024">Năm 2024</option>
            </select>
          </div>

          {/* Month selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                border: isMonthFiltered ? '2px solid #059669' : '1px solid var(--dash-border)',
                backgroundColor: isMonthFiltered ? '#F0FDF4' : '#FFFFFF',
                fontSize: '0.8125rem',
                fontWeight: 700,
                color: isMonthFiltered ? '#065F46' : 'var(--dash-text-primary)',
                cursor: 'pointer',
              }}
            >
              <option value="ALL">Toàn Bộ 12 Tháng</option>
              <option value="1">Tháng 1</option>
              <option value="2">Tháng 2</option>
              <option value="3">Tháng 3</option>
              <option value="4">Tháng 4</option>
              <option value="5">Tháng 5</option>
              <option value="6">Tháng 6</option>
              <option value="7">Tháng 7</option>
              <option value="8">Tháng 8</option>
              <option value="9">Tháng 9</option>
              <option value="10">Tháng 10 (+18 DN)</option>
              <option value="11">Tháng 11 (+3 DN)</option>
              <option value="12">Tháng 12</option>
            </select>

            {isMonthFiltered && (
              <button
                type="button"
                onClick={() => setSelectedMonth('ALL')}
                title="Bỏ lọc tháng, xem toàn bộ 12 tháng"
                style={{
                  padding: '6px 10px',
                  borderRadius: '8px',
                  border: '1px solid #FECACA',
                  backgroundColor: '#FEF2F2',
                  color: '#DC2626',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <X size={12} />
                <span>Xem 12 Tháng</span>
              </button>
            )}
          </div>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={() => fetchAnalytics(true)}
            disabled={isRefreshing || isLoading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: '8px',
              border: '1px solid var(--dash-border)',
              backgroundColor: '#FFFFFF',
              color: 'var(--dash-text-primary)',
              fontSize: '0.8125rem',
              fontWeight: 600,
              cursor: isRefreshing || isLoading ? 'not-allowed' : 'pointer',
            }}
          >
            <RefreshCw size={14} className={isRefreshing ? 'spin-icon' : ''} />
            <span>Làm Mới</span>
          </button>

          {/* Export Button */}
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={isExporting || isLoading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: '8px',
              border: '1px solid #A7F3D0',
              backgroundColor: '#ECFDF5',
              color: '#065F46',
              fontSize: '0.8125rem',
              fontWeight: 700,
              cursor: isExporting || isLoading ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <Download size={14} className={isExporting ? 'spin-icon' : ''} />
            <span>{isExporting ? 'Đang xuất CSV...' : 'Xuất Báo Cáo CSV'}</span>
          </button>
        </div>
      </div>

      {toastMessage && (
        <div
          role="status"
          style={{
            padding: '12px 16px',
            borderRadius: '8px',
            backgroundColor: '#ECFDF5',
            border: '1px solid #A7F3D0',
            color: '#065F46',
            fontSize: '0.8125rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <CheckCircle2 size={16} color="#059669" />
          <span>{toastMessage}</span>
        </div>
      )}

      {error && (
        <div
          style={{
            padding: '14px 18px',
            borderRadius: '10px',
            backgroundColor: '#FEF2F2',
            border: '1px solid #FECACA',
            color: '#991B1B',
            fontSize: '0.8125rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={18} color="#DC2626" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => fetchAnalytics(false)}
            style={{
              padding: '4px 12px',
              borderRadius: '6px',
              backgroundColor: '#FFFFFF',
              border: '1px solid #FECACA',
              color: '#DC2626',
              fontSize: '0.75rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Thử lại
          </button>
        </div>
      )}

      {/* 2. Top KPI Cards Grid (Biến thiên chuẩn xác theo bộ lọc Năm & Tháng) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '16px',
        }}
      >
        {/* Card 1: Doanh Nghiệp */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            border: '1px solid var(--dash-border)',
            borderRadius: '12px',
            padding: '18px 20px',
            boxShadow: 'var(--dash-shadow-xs)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--dash-text-muted)', textTransform: 'uppercase' }}>
              {isMonthFiltered ? `Doanh Nghiệp (Tích Lũy Đến T${selectedMonth})` : 'Tổng Doanh Nghiệp Khách Hàng'}
            </span>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: 'rgba(5, 150, 105, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#059669',
              }}
            >
              <Building2 size={16} />
            </div>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--dash-text-primary)', marginTop: '8px' }}>
            {isLoading ? '...' : kpi.totalOrganizations}{' '}
            <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--dash-text-muted)' }}>công ty</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '6px', fontSize: '0.75rem', color: '#059669', fontWeight: 600 }}>
            <ArrowUpRight size={14} />
            <span>{kpi.orgGrowthRatePercent}</span>
          </div>
        </div>

        {/* Card 2: Người Dùng Nền Tảng */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            border: '1px solid var(--dash-border)',
            borderRadius: '12px',
            padding: '18px 20px',
            boxShadow: 'var(--dash-shadow-xs)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--dash-text-muted)', textTransform: 'uppercase' }}>
              {isMonthFiltered ? `Người Dùng (Tích Lũy Đến T${selectedMonth})` : 'Người Dùng Hoạt Động (MAU)'}
            </span>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#3B82F6',
              }}
            >
              <Users size={16} />
            </div>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--dash-text-primary)', marginTop: '8px' }}>
            {isLoading ? '...' : isMonthFiltered ? kpi.totalUsers : kpi.activeUsers}{' '}
            <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--dash-text-muted)' }}>
              {isMonthFiltered ? 'người dùng' : 'active/tháng'}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '6px', fontSize: '0.75rem', color: '#2563EB', fontWeight: 600 }}>
            <ArrowUpRight size={14} />
            <span>
              {isMonthFiltered
                ? `Tích lũy tính đến Tháng ${selectedMonth}/${selectedYear}`
                : `Tổng cộng: ${kpi.totalUsers} tài khoản người dùng`}
            </span>
          </div>
        </div>

        {/* Card 3: Hạ Tầng Cụm K8s Đang Quản Lý */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            border: '1px solid var(--dash-border)',
            borderRadius: '12px',
            padding: '18px 20px',
            boxShadow: 'var(--dash-shadow-xs)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--dash-text-muted)', textTransform: 'uppercase' }}>
              Cụm K8s Đang Quản Lý
            </span>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: 'rgba(217, 119, 6, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#D97706',
              }}
            >
              <Layers size={16} />
            </div>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--dash-text-primary)', marginTop: '8px' }}>
            {isLoading ? '...' : kpi.totalClusters}{' '}
            <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--dash-text-muted)' }}>cụm Kubernetes</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '6px', fontSize: '0.75rem', color: '#D97706', fontWeight: 600 }}>
            <Server size={13} />
            <span>{kpi.totalNodes} Nodes vật lý • {kpi.totalPods} Pods vi dịch vụ</span>
          </div>
        </div>

        {/* Card 4: Độ Sẵn Sàng Tác Tử & Tự Phục Hồi */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            border: '1px solid var(--dash-border)',
            borderRadius: '12px',
            padding: '18px 20px',
            boxShadow: 'var(--dash-shadow-xs)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--dash-text-muted)', textTransform: 'uppercase' }}>
              Tỷ Lệ Tự Phục Hồi (Self-Healing)
            </span>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#10B981',
              }}
            >
              <CheckCircle2 size={16} />
            </div>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#15803D', marginTop: '8px' }}>
            {isLoading ? '...' : kpi.healingSuccessRate}{' '}
            <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--dash-text-muted)' }}>thành công</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', fontSize: '0.75rem', color: '#059669', fontWeight: 600 }}>
            <Radio size={13} />
            <span>Tác tử eBPF: {kpi.onlineAgents}/{kpi.totalAgents} Online ({kpi.agentAvailabilityRate})</span>
          </div>
        </div>
      </div>

      {/* 3. Section Title & View Mode Selector */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '1.0625rem', fontWeight: 700, color: 'var(--dash-text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BarChart3 size={20} color="#059669" />
            Biểu Đồ Phân Tích Tăng Trưởng (12 Tháng Năm {selectedYear})
          </h2>
          <p style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)', margin: '2px 0 0 0' }}>
            Theo dõi xu hướng gia nhập của doanh nghiệp và đăng ký tài khoản người dùng mới từ cơ sở dữ liệu thật
          </p>
        </div>

        {/* View Mode Toggle Controls */}
        <div style={{ display: 'flex', alignItems: 'center', backgroundColor: '#F1F5F9', padding: '3px', borderRadius: '8px', border: '1px solid var(--dash-border)' }}>
          <button
            type="button"
            onClick={() => setChartViewMode('ALL')}
            style={{
              padding: '5px 12px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: chartViewMode === 'ALL' ? '#FFFFFF' : 'transparent',
              color: chartViewMode === 'ALL' ? 'var(--dash-text-primary)' : 'var(--dash-text-muted)',
              fontSize: '0.75rem',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: chartViewMode === 'ALL' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            Tất Cả Biểu Đồ
          </button>
          <button
            type="button"
            onClick={() => setChartViewMode('ORGS')}
            style={{
              padding: '5px 12px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: chartViewMode === 'ORGS' ? '#FFFFFF' : 'transparent',
              color: chartViewMode === 'ORGS' ? '#059669' : 'var(--dash-text-muted)',
              fontSize: '0.75rem',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: chartViewMode === 'ORGS' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            🏢 Doanh Nghiệp Mới
          </button>
          <button
            type="button"
            onClick={() => setChartViewMode('USERS')}
            style={{
              padding: '5px 12px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: chartViewMode === 'USERS' ? '#FFFFFF' : 'transparent',
              color: chartViewMode === 'USERS' ? '#2563EB' : 'var(--dash-text-muted)',
              fontSize: '0.75rem',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: chartViewMode === 'USERS' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            👥 Người Dùng Mới
          </button>
        </div>
      </div>

      {/* 3.1 Growth Charts Grid (Doanh Nghiệp Mới & Người Dùng Mới) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns:
            chartViewMode === 'ALL'
              ? 'repeat(auto-fit, minmax(460px, 1fr))'
              : '1fr',
          gap: '20px',
        }}
      >
        {/* Chart A: Monthly Orgs Bar Chart */}
        {(chartViewMode === 'ALL' || chartViewMode === 'ORGS') && (
          <div
            style={{
              backgroundColor: '#FFFFFF',
              border: '1px solid var(--dash-border)',
              borderRadius: '12px',
              padding: '20px',
              boxShadow: 'var(--dash-shadow-xs)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--dash-text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Building2 size={16} color="#059669" />
                  Biểu Đồ Doanh Nghiệp Mới Gia Nhập (12 Tháng Năm {selectedYear})
                </h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)', margin: '2px 0 0 0' }}>
                  Số lượng công ty đăng ký mới hàng tháng từ cơ sở dữ liệu thật
                </p>
              </div>
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  color: '#059669',
                  backgroundColor: '#ECFDF5',
                  padding: '4px 8px',
                  borderRadius: '6px',
                  border: '1px solid #A7F3D0',
                }}
              >
                +{totalGrowthNewOrgsInYear} công ty mới trong năm
              </span>
            </div>

            {/* SVG/CSS Bar Chart Visualization */}
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', height: '180px', paddingTop: '20px', borderBottom: '1px solid var(--dash-border)' }}>
              {isLoading ? (
                <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--dash-text-muted)', fontSize: '0.8125rem' }}>
                  <RefreshCw size={20} className="spin-icon" style={{ margin: '0 auto 6px auto', display: 'block' }} />
                  <span>Đang tính toán biểu đồ tăng trưởng doanh nghiệp...</span>
                </div>
              ) : (
                monthlyGrowth.map((item) => {
                  const heightPercent = item.newOrgs > 0 ? Math.max(14, (item.newOrgs / maxNewOrgs) * 100) : 4;
                  const isSelected = selectedMonth === String(item.monthIndex);
                  return (
                    <div
                      key={item.month}
                      style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '6px',
                        height: '100%',
                        justifyContent: 'flex-end',
                      }}
                    >
                      <span
                        style={{
                          fontSize: '0.6875rem',
                          fontWeight: 700,
                          color: item.newOrgs > 0 ? (isSelected ? '#065F46' : 'var(--dash-text-secondary)') : 'transparent',
                        }}
                      >
                        +{item.newOrgs}
                      </span>
                      <div
                        style={{
                          width: '100%',
                          maxWidth: '28px',
                          height: `${heightPercent}%`,
                          backgroundColor: isSelected ? '#047857' : item.newOrgs > 0 ? '#10B981' : '#E2E8F0',
                          borderRadius: '4px 4px 0 0',
                          transition: 'all 0.25s ease',
                          cursor: 'pointer',
                          boxShadow: isSelected ? '0 0 0 2px #047857' : 'none',
                        }}
                        title={`${item.monthName}: +${item.newOrgs} doanh nghiệp mới (+${item.newUsers} người dùng). Nhấn để lọc!`}
                        onClick={() => setSelectedMonth(selectedMonth === String(item.monthIndex) ? 'ALL' : String(item.monthIndex))}
                      />
                      <span
                        style={{
                          fontSize: '0.6875rem',
                          fontWeight: isSelected ? 800 : 500,
                          color: isSelected ? '#059669' : 'var(--dash-text-muted)',
                          marginTop: '4px',
                        }}
                      >
                        {item.month}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', fontSize: '0.6875rem', color: 'var(--dash-text-muted)' }}>
              <span>💡 Nhấn vào từng cột tháng để lọc doanh nghiệp của tháng đó</span>
              {isMonthFiltered && (
                <button
                  type="button"
                  onClick={() => setSelectedMonth('ALL')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#059669',
                    fontWeight: 700,
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  Đặt lại: Xem toàn bộ 12 tháng
                </button>
              )}
            </div>
          </div>
        )}

        {/* Chart B: Monthly Users Bar Chart (Người Dùng Mới) */}
        {(chartViewMode === 'ALL' || chartViewMode === 'USERS') && (
          <div
            style={{
              backgroundColor: '#FFFFFF',
              border: '1px solid var(--dash-border)',
              borderRadius: '12px',
              padding: '20px',
              boxShadow: 'var(--dash-shadow-xs)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--dash-text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Users size={16} color="#2563EB" />
                  Biểu Đồ Người Dùng Mới Đăng Ký (12 Tháng Năm {selectedYear})
                </h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)', margin: '2px 0 0 0' }}>
                  Số lượng tài khoản người dùng đăng ký mới hàng tháng trên nền tảng
                </p>
              </div>
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  color: '#2563EB',
                  backgroundColor: '#EFF6FF',
                  padding: '4px 8px',
                  borderRadius: '6px',
                  border: '1px solid #BFDBFE',
                }}
              >
                +{totalGrowthNewUsersInYear} người dùng mới trong năm
              </span>
            </div>

            {/* SVG/CSS Bar Chart Visualization for Users */}
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', height: '180px', paddingTop: '20px', borderBottom: '1px solid var(--dash-border)' }}>
              {isLoading ? (
                <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--dash-text-muted)', fontSize: '0.8125rem' }}>
                  <RefreshCw size={20} className="spin-icon" style={{ margin: '0 auto 6px auto', display: 'block' }} />
                  <span>Đang tính toán biểu đồ tăng trưởng người dùng...</span>
                </div>
              ) : (
                monthlyGrowth.map((item) => {
                  const nUsers = item.newUsers || 0;
                  const heightPercent = nUsers > 0 ? Math.max(14, (nUsers / maxNewUsers) * 100) : 4;
                  const isSelected = selectedMonth === String(item.monthIndex);
                  return (
                    <div
                      key={`user-${item.month}`}
                      style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '6px',
                        height: '100%',
                        justifyContent: 'flex-end',
                      }}
                    >
                      <span
                        style={{
                          fontSize: '0.6875rem',
                          fontWeight: 700,
                          color: nUsers > 0 ? (isSelected ? '#1E40AF' : '#2563EB') : 'transparent',
                        }}
                      >
                        +{nUsers}
                      </span>
                      <div
                        style={{
                          width: '100%',
                          maxWidth: '28px',
                          height: `${heightPercent}%`,
                          backgroundColor: isSelected ? '#1D4ED8' : nUsers > 0 ? '#3B82F6' : '#E2E8F0',
                          borderRadius: '4px 4px 0 0',
                          transition: 'all 0.25s ease',
                          cursor: 'pointer',
                          boxShadow: isSelected ? '0 0 0 2px #1D4ED8' : 'none',
                        }}
                        title={`${item.monthName}: +${nUsers} người dùng mới (Tích lũy: ${item.cumulativeUsers || 0} người dùng). Nhấn để lọc!`}
                        onClick={() => setSelectedMonth(selectedMonth === String(item.monthIndex) ? 'ALL' : String(item.monthIndex))}
                      />
                      <span
                        style={{
                          fontSize: '0.6875rem',
                          fontWeight: isSelected ? 800 : 500,
                          color: isSelected ? '#2563EB' : 'var(--dash-text-muted)',
                          marginTop: '4px',
                        }}
                      >
                        {item.month}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', fontSize: '0.6875rem', color: 'var(--dash-text-muted)' }}>
              <span>💡 Nhấn vào từng cột tháng để lọc số liệu theo tháng tương ứng</span>
              {isMonthFiltered && (
                <button
                  type="button"
                  onClick={() => setSelectedMonth('ALL')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#2563EB',
                    fontWeight: 700,
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  Đặt lại: Xem toàn bộ 12 tháng
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 3.2 Secondary Distribution & Platform Scale Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))',
          gap: '20px',
        }}
      >
        {/* Environment & Status Distribution */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            border: '1px solid var(--dash-border)',
            borderRadius: '12px',
            padding: '20px',
            boxShadow: 'var(--dash-shadow-xs)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div>
                <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--dash-text-primary)', margin: 0 }}>
                  Cơ Cấu Môi Trường & Trạng Thái {isMonthFiltered ? `(Tích Lũy Đến T${selectedMonth})` : ''}
                </h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)', margin: '2px 0 0 0' }}>
                  Phân bổ theo môi trường hạ tầng K8s và trạng thái doanh nghiệp
                </p>
              </div>
              <PieChart size={18} color="var(--dash-text-muted)" />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '10px' }}>
              {/* Production */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', marginBottom: '4px' }}>
                  <span style={{ fontWeight: 600, color: 'var(--dash-text-primary)' }}>Môi trường Production (Sản xuất)</span>
                  <span style={{ fontWeight: 700, color: '#1D4ED8' }}>
                    {envBreakdown.production.count} cụm ({envBreakdown.production.percentage})
                  </span>
                </div>
                <div style={{ height: '7px', backgroundColor: '#F1F5F9', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: envBreakdown.production.percentage, height: '100%', backgroundColor: '#2563EB', borderRadius: '4px' }} />
                </div>
              </div>

              {/* Staging */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', marginBottom: '4px' }}>
                  <span style={{ fontWeight: 600, color: 'var(--dash-text-primary)' }}>Môi trường Staging (Thử nghiệm)</span>
                  <span style={{ fontWeight: 700, color: '#059669' }}>
                    {envBreakdown.staging.count} cụm ({envBreakdown.staging.percentage})
                  </span>
                </div>
                <div style={{ height: '7px', backgroundColor: '#F1F5F9', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: envBreakdown.staging.percentage, height: '100%', backgroundColor: '#059669', borderRadius: '4px' }} />
                </div>
              </div>

              {/* Development */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', marginBottom: '4px' }}>
                  <span style={{ fontWeight: 600, color: 'var(--dash-text-primary)' }}>Môi trường Development (Phát triển)</span>
                  <span style={{ fontWeight: 700, color: '#D97706' }}>
                    {envBreakdown.development.count} cụm ({envBreakdown.development.percentage})
                  </span>
                </div>
                <div style={{ height: '7px', backgroundColor: '#F1F5F9', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: envBreakdown.development.percentage, height: '100%', backgroundColor: '#F59E0B', borderRadius: '4px' }} />
                </div>
              </div>
            </div>
          </div>

          {/* Status Breakdown row */}
          <div style={{ paddingTop: '14px', borderTop: '1px solid var(--dash-border)', marginTop: '16px' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--dash-text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>
              Trạng thái tài khoản doanh nghiệp
            </div>
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10B981' }} />
                <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--dash-text-primary)' }}>
                  Đang hoạt động: <strong>{statusBreakdown.active.count}</strong> ({statusBreakdown.active.percentage})
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#EF4444' }} />
                <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--dash-text-primary)' }}>
                  Tạm dừng: <strong>{statusBreakdown.suspended.count}</strong> ({statusBreakdown.suspended.percentage})
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Platform Ratios & Scale Insights Card */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            border: '1px solid var(--dash-border)',
            borderRadius: '12px',
            padding: '20px',
            boxShadow: 'var(--dash-shadow-xs)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div>
                <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--dash-text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Zap size={16} color="#7C3AED" />
                  Chỉ Số Tương Quan & Quy Mô Nền Tảng {isMonthFiltered ? `(Đến T${selectedMonth})` : ''}
                </h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)', margin: '2px 0 0 0' }}>
                  Tỷ lệ thành viên/công ty, mật độ hạ tầng và hiệu năng tự lành thực tế
                </p>
              </div>
              <ShieldCheck size={18} color="#059669" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginTop: '12px' }}>
              <div style={{ padding: '12px 14px', backgroundColor: '#F8FAFC', borderRadius: '10px', border: '1px solid var(--dash-border)' }}>
                <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--dash-text-muted)', textTransform: 'uppercase' }}>
                  Người Dùng / Công Ty
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1E293B', marginTop: '4px' }}>
                  {avgUsersPerOrg}{' '}
                  <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--dash-text-muted)' }}>thành viên/DN</span>
                </div>
                <div style={{ fontSize: '0.6875rem', color: '#2563EB', marginTop: '2px' }}>
                  {kpi.totalUsers} users / {kpi.totalOrganizations} công ty
                </div>
              </div>

              <div style={{ padding: '12px 14px', backgroundColor: '#F8FAFC', borderRadius: '10px', border: '1px solid var(--dash-border)' }}>
                <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--dash-text-muted)', textTransform: 'uppercase' }}>
                  Mật Độ Vi Dịch Vụ
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1E293B', marginTop: '4px' }}>
                  {avgPodsPerCluster}{' '}
                  <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--dash-text-muted)' }}>Pods / cụm K8s</span>
                </div>
                <div style={{ fontSize: '0.6875rem', color: '#D97706', marginTop: '2px' }}>
                  {kpi.totalPods} Pods trên {kpi.totalClusters} cụm
                </div>
              </div>

              <div style={{ padding: '12px 14px', backgroundColor: '#F8FAFC', borderRadius: '10px', border: '1px solid var(--dash-border)' }}>
                <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--dash-text-muted)', textTransform: 'uppercase' }}>
                  Tác Tử eBPF Trực Tuyến
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#059669', marginTop: '4px' }}>
                  {kpi.agentAvailabilityRate}
                </div>
                <div style={{ fontSize: '0.6875rem', color: '#059669', marginTop: '2px' }}>
                  {kpi.onlineAgents}/{kpi.totalAgents} Agents Online
                </div>
              </div>

              <div style={{ padding: '12px 14px', backgroundColor: '#F8FAFC', borderRadius: '10px', border: '1px solid var(--dash-border)' }}>
                <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--dash-text-muted)', textTransform: 'uppercase' }}>
                  Tỷ Lệ Tự Lành MAPE-K
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#16A34A', marginTop: '4px' }}>
                  {kpi.healingSuccessRate}
                </div>
                <div style={{ fontSize: '0.6875rem', color: '#166534', marginTop: '2px' }}>
                  Tự động khắc phục sự cố
                </div>
              </div>
            </div>
          </div>

          <div
            style={{
              padding: '10px 14px',
              backgroundColor: '#F0FDF4',
              borderRadius: '8px',
              border: '1px solid #BBF7D0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.75rem',
              marginTop: '16px',
            }}
          >
            <span style={{ color: '#166534', fontWeight: 600 }}>
              🔒 100% tài nguyên và người dùng được phân lập RBAC & Tenant an toàn
            </span>
            <span style={{ color: '#065F46', fontWeight: 700 }}>
              Cơ sở dữ liệu thực tế
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminAnalyticsPage;
