import React, { useState } from 'react';
import {
  Users,
  Building2,
  TrendingUp,
      Clock,
  ArrowRight,
  ShieldCheck,
        RefreshCw,
    CheckCircle2,
      Activity,
    } from 'lucide-react';

export const AdminWebsiteDashboard = ({ onNavigate }) => {
  const [timeFilter, setTimeFilter] = useState('month'); // 'day' | 'week' | 'month'
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState('Vừa xong (01:00)');

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
      setLastRefreshed(new Date().toLocaleTimeString('vi-VN'));
    }, 500);
  };

  // Mock thống kê tổng quan website
  const stats = {
    totalUsers: 1960,
    activeUsers: 1842,
    inactiveUsers: 118,
    newUsersToday: 14,
    newUsersWeek: 98,
    newUsersMonth: 420,
    totalCompanies: 86,
    activeCompanies: 81,
    suspendedCompanies: 5,
    newCompaniesMonth: 7,
    todayAdminActions: 38,
    activeWebSessions: 342,
  };

  // Mock danh sách công ty mới đăng ký gần đây
  const recentCompanies = [
    {
      id: 'org-vng-fin',
      name: 'VNG FinTech Solutions',
      ownerName: 'Lê Hoàng Nam',
      ownerEmail: 'nam.le@vngfin.vn',
      membersCount: 28,
      createdAt: '21/10/2026',
      status: 'ACTIVE',
    },
    {
      id: 'org-tiki-log',
      name: 'Tiki Supply Chain AI',
      ownerName: 'Trần Minh Tuấn',
      ownerEmail: 'tuan.tm@tiki.vn',
      membersCount: 14,
      createdAt: '20/10/2026',
      status: 'ACTIVE',
    },
    {
      id: 'org-viettel-sme',
      name: 'Viettel Digital Retail',
      ownerName: 'Phạm Thu Hằng',
      ownerEmail: 'hangpt@viettel.com.vn',
      membersCount: 35,
      createdAt: '19/10/2026',
      status: 'ACTIVE',
    },
    {
      id: 'org-sun-cloud',
      name: 'Sun Cloud Media Labs',
      ownerName: 'Đỗ Quốc Bảo',
      ownerEmail: 'bao.do@suncloud.io',
      membersCount: 8,
      createdAt: '17/10/2026',
      status: 'SUSPENDED',
      suspendedReason: 'Vi phạm điều khoản thanh toán kỳ 10/2026',
    },
    {
      id: 'org-green-agro',
      name: 'GreenAgro Logistics',
      ownerName: 'Ngô Thanh Sơn',
      ownerEmail: 'son.ngo@greenagro.vn',
      membersCount: 12,
      createdAt: '15/10/2026',
      status: 'ACTIVE',
    },
  ];

  // Mock danh sách hoạt động quản trị gần đây do ADMIN thực hiện
  const recentAdminActivities = [
    {
      id: 'act-01',
      actor: 'Admin (Bạn)',
      action: 'Mở khóa tài khoản',
      target: 'devops.lead@acme.corp',
      type: 'USER_UNLOCK',
      time: '15 phút trước',
      status: 'SUCCESS',
    },
    {
      id: 'act-02',
      actor: 'Admin (Bạn)',
      action: 'Đặt lại mật khẩu tạm thời',
      target: 'owner@nexuslogistics.ai',
      type: 'PWD_RESET',
      time: '45 phút trước',
      status: 'SUCCESS',
    },
    {
      id: 'act-03',
      actor: 'Admin (Bạn)',
      action: 'Tạm ngưng công ty',
      target: 'Sun Cloud Media Labs',
      type: 'ORG_SUSPEND',
      time: '3 giờ trước',
      status: 'WARNING',
    },
    {
      id: 'act-04',
      actor: 'Admin (Bạn)',
      action: 'Thu hồi phiên đăng nhập rủi ro',
      target: 'viewer.test@finflow.io',
      type: 'REVOKE_SESSION',
      time: '5 giờ trước',
      status: 'SUCCESS',
    },
    {
      id: 'act-05',
      actor: 'Admin (Bạn)',
      action: 'Gán vai trò SME_OWNER',
      target: 'tuan.tm@tiki.vn',
      type: 'ROLE_ASSIGN',
      time: '1 ngày trước',
      status: 'SUCCESS',
    },
  ];

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
        maxWidth: '1440px',
        margin: '0 auto',
        paddingBottom: '40px',
      }}
    >
      {/* 1. Header Bàn Điều Khiển Vận Hành Website */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
          backgroundColor: '#FFFFFF',
          padding: '20px 24px',
          borderRadius: '16px',
          border: '1px solid var(--dash-border)',
          boxShadow: 'var(--dash-shadow-xs)',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1
              style={{
                fontSize: '1.5rem',
                fontWeight: 800,
                color: 'var(--dash-text-primary)',
                margin: 0,
                letterSpacing: '-0.02em',
              }}
            >
              Tổng Quan Vận Hành Website
            </h1>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '4px 10px',
                borderRadius: '9999px',
                backgroundColor: '#EFF6FF',
                color: '#1D4ED8',
                fontSize: '0.75rem',
                fontWeight: 700,
                border: '1px solid #BFDBFE',
              }}
            >
              <ShieldCheck size={13} />
              Vai trò: ADMIN
            </span>
          </div>
          <p
            style={{
              fontSize: '0.875rem',
              color: 'var(--dash-text-secondary)',
              margin: '6px 0 0 0',
            }}
          >
            Quản trị thông tin người dùng, công ty đăng ký và theo dõi hoạt động nền tảng SelfAI.
          </p>
        </div>

        {/* Nút Refresh & Thời gian cập nhật */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              backgroundColor: '#F8FAFC',
              borderRadius: '8px',
              border: '1px solid var(--dash-border)',
              fontSize: '0.75rem',
              color: 'var(--dash-text-muted)',
            }}
          >
            <Clock size={13} />
            <span>Cập nhật: <strong style={{ color: 'var(--dash-text-primary)' }}>{lastRefreshed}</strong></span>
          </div>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              backgroundColor: isRefreshing ? '#94A3B8' : '#059669',
              color: '#FFFFFF',
              borderRadius: '8px',
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
            <span>{isRefreshing ? 'Đang Tải...' : 'Làm Mới'}</span>
          </button>
        </div>
      </div>

      {/* 2. Bốn Thẻ KPI Cốt Lõi Vận Hành Website */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '16px',
        }}
      >
        {/* KPI 1: Người Dùng */}
        <div
          className="dash-card"
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '16px',
            border: '1px solid var(--dash-border)',
            padding: '20px',
            boxShadow: 'var(--dash-shadow-xs)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--dash-text-muted)', textTransform: 'uppercase' }}>
              Tổng Người Dùng
            </span>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                backgroundColor: '#EFF6FF',
                color: '#2563EB',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Users size={18} />
            </div>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#1E293B', lineHeight: 1.1 }}>
            {stats.totalUsers.toLocaleString()}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px', fontSize: '0.75rem' }}>
            <span style={{ color: '#059669', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#059669' }} />
              {stats.activeUsers.toLocaleString()} Đang hoạt động
            </span>
            <span style={{ color: 'var(--dash-text-muted)' }}>&bull;</span>
            <span style={{ color: '#DC2626', fontWeight: 600 }}>
              {stats.inactiveUsers} Đã khóa
            </span>
          </div>
        </div>

        {/* KPI 2: Công Ty / Doanh Nghiệp */}
        <div
          className="dash-card"
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '16px',
            border: '1px solid var(--dash-border)',
            padding: '20px',
            boxShadow: 'var(--dash-shadow-xs)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--dash-text-muted)', textTransform: 'uppercase' }}>
              Công Ty Đã Đăng Ký
            </span>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                backgroundColor: '#ECFDF5',
                color: '#059669',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Building2 size={18} />
            </div>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#1E293B', lineHeight: 1.1 }}>
            {stats.totalCompanies}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px', fontSize: '0.75rem' }}>
            <span style={{ color: '#059669', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#059669' }} />
              {stats.activeCompanies} Đang hoạt động
            </span>
            <span style={{ color: 'var(--dash-text-muted)' }}>&bull;</span>
            <span style={{ color: '#D97706', fontWeight: 600 }}>
              {stats.suspendedCompanies} Tạm ngưng
            </span>
          </div>
        </div>

        {/* KPI 3: Tài Khoản Mới Đăng Ký */}
        <div
          className="dash-card"
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '16px',
            border: '1px solid var(--dash-border)',
            padding: '20px',
            boxShadow: 'var(--dash-shadow-xs)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--dash-text-muted)', textTransform: 'uppercase' }}>
              Tài Khoản Mới Đăng Ký
            </span>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                backgroundColor: '#F5F3FF',
                color: '#7C3AED',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <TrendingUp size={18} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '2rem', fontWeight: 800, color: '#7C3AED', lineHeight: 1.1 }}>
              +{stats.newUsersMonth}
            </span>
            <span style={{ fontSize: '0.8125rem', color: 'var(--dash-text-muted)' }}>trong tháng</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px', fontSize: '0.75rem' }}>
            <span style={{ color: '#1E293B', fontWeight: 600 }}>
              Hôm nay: <strong style={{ color: '#059669' }}>+{stats.newUsersToday}</strong>
            </span>
            <span style={{ color: 'var(--dash-text-muted)' }}>&bull;</span>
            <span style={{ color: '#1E293B', fontWeight: 600 }}>
              Tuần này: <strong style={{ color: '#2563EB' }}>+{stats.newUsersWeek}</strong>
            </span>
          </div>
        </div>

        {/* KPI 4: Thao Tác Quản Trị & Phiên Website */}
        <div
          className="dash-card"
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '16px',
            border: '1px solid var(--dash-border)',
            padding: '20px',
            boxShadow: 'var(--dash-shadow-xs)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--dash-text-muted)', textTransform: 'uppercase' }}>
              Hoạt Động Quản Trị Hôm Nay
            </span>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                backgroundColor: '#FEF3C7',
                color: '#D97706',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Activity size={18} />
            </div>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#1E293B', lineHeight: 1.1 }}>
            {stats.todayAdminActions}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px', fontSize: '0.75rem' }}>
            <span style={{ color: '#059669', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <CheckCircle2 size={12} />
              {stats.activeWebSessions} Phiên đăng nhập hoạt động
            </span>
          </div>
        </div>
      </div>

      {/* 3. Bốn Hub Thao Tác Nhanh Dành Riêng Cho ADMIN */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '16px',
        }}
      >
        {/* Hub 1: Quản lý người dùng */}
        <div
          onClick={() => onNavigate && onNavigate('/admin/users')}
          style={{
            backgroundColor: '#FFFFFF',
            border: '1px solid var(--dash-border)',
            borderRadius: '14px',
            padding: '16px 18px',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            boxShadow: 'var(--dash-shadow-xs)',
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
                User Management
              </span>
            </div>
            <ArrowRight size={14} color="var(--dash-text-muted)" />
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)', margin: '8px 0 10px 0' }}>
            Xem hồ sơ, khóa/mở khóa tài khoản, thu hồi phiên đăng nhập rủi ro
          </p>
          <div style={{ display: 'flex', gap: '6px' }}>
            <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#059669', backgroundColor: '#ECFDF5', padding: '2px 8px', borderRadius: '4px' }}>
              {stats.totalUsers} Tài khoản
            </span>
          </div>
        </div>

        {/* Hub 2: Quản lý Company */}
        <div
          onClick={() => onNavigate && onNavigate('/admin/companies')}
          style={{
            backgroundColor: '#FFFFFF',
            border: '1px solid var(--dash-border)',
            borderRadius: '14px',
            padding: '16px 18px',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            boxShadow: 'var(--dash-shadow-xs)',
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
                Company Management
              </span>
            </div>
            <ArrowRight size={14} color="var(--dash-text-muted)" />
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)', margin: '8px 0 10px 0' }}>
            Quản lý thông tin công ty, kích hoạt hoặc tạm ngưng theo chính sách
          </p>
          <div style={{ display: 'flex', gap: '6px' }}>
            <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#059669', backgroundColor: '#ECFDF5', padding: '2px 8px', borderRadius: '4px' }}>
              {stats.totalCompanies} Doanh nghiệp
            </span>
          </div>
        </div>

        {/* Hub 3: User Activity */}
        <div
          onClick={() => onNavigate && onNavigate('/admin/activity')}
          style={{
            backgroundColor: '#FFFFFF',
            border: '1px solid var(--dash-border)',
            borderRadius: '14px',
            padding: '16px 18px',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            boxShadow: 'var(--dash-shadow-xs)',
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
              <Activity size={18} color="#059669" />
              <span style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--dash-text-primary)' }}>
                User Activity
              </span>
            </div>
            <ArrowRight size={14} color="var(--dash-text-muted)" />
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)', margin: '8px 0 10px 0' }}>
            Theo dõi nhật ký đăng nhập, đổi mật khẩu và cảnh báo vị trí bất thường
          </p>
          <div style={{ display: 'flex', gap: '6px' }}>
            <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#2563EB', backgroundColor: '#EFF6FF', padding: '2px 8px', borderRadius: '4px' }}>
              Nhật ký thời gian thực
            </span>
          </div>
        </div>

        {/* Hub 4: Báo cáo & Thống kê */}
        <div
          onClick={() => onNavigate && onNavigate('/admin/analytics')}
          style={{
            backgroundColor: '#FFFFFF',
            border: '1px solid var(--dash-border)',
            borderRadius: '14px',
            padding: '16px 18px',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            boxShadow: 'var(--dash-shadow-xs)',
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
              <TrendingUp size={18} color="#059669" />
              <span style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--dash-text-primary)' }}>
                Reports & Analytics
              </span>
            </div>
            <ArrowRight size={14} color="var(--dash-text-muted)" />
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)', margin: '8px 0 10px 0' }}>
            Báo cáo tăng trưởng người dùng, công ty mới và xuất dữ liệu báo cáo
          </p>
          <div style={{ display: 'flex', gap: '6px' }}>
            <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#D97706', backgroundColor: '#FEFCE8', padding: '2px 8px', borderRadius: '4px' }}>
              Báo cáo & Xuất file
            </span>
          </div>
        </div>
      </div>

      {/* 4. Khối Biểu Đồ Tăng Trưởng Người Dùng & Company */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          border: '1px solid var(--dash-border)',
          padding: '24px',
          boxShadow: 'var(--dash-shadow-xs)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            marginBottom: '20px',
          }}
        >
          <div>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 800, color: 'var(--dash-text-primary)', margin: 0 }}>
              Biểu Đồ Tăng Trưởng Người Dùng & Công Ty
            </h2>
            <p style={{ fontSize: '0.8125rem', color: 'var(--dash-text-muted)', margin: '4px 0 0 0' }}>
              Theo dõi tốc độ tăng trưởng tài khoản và quy mô doanh nghiệp trên toàn website SelfAI.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              type="button"
              onClick={() => setTimeFilter('day')}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                border: '1px solid var(--dash-border)',
                backgroundColor: timeFilter === 'day' ? '#ECFDF5' : '#FFFFFF',
                color: timeFilter === 'day' ? '#065F46' : 'var(--dash-text-secondary)',
                fontWeight: timeFilter === 'day' ? 700 : 500,
                fontSize: '0.75rem',
                cursor: 'pointer',
              }}
            >
              Theo Ngày
            </button>
            <button
              type="button"
              onClick={() => setTimeFilter('week')}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                border: '1px solid var(--dash-border)',
                backgroundColor: timeFilter === 'week' ? '#ECFDF5' : '#FFFFFF',
                color: timeFilter === 'week' ? '#065F46' : 'var(--dash-text-secondary)',
                fontWeight: timeFilter === 'week' ? 700 : 500,
                fontSize: '0.75rem',
                cursor: 'pointer',
              }}
            >
              Theo Tuần
            </button>
            <button
              type="button"
              onClick={() => setTimeFilter('month')}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                border: '1px solid var(--dash-border)',
                backgroundColor: timeFilter === 'month' ? '#ECFDF5' : '#FFFFFF',
                color: timeFilter === 'month' ? '#065F46' : 'var(--dash-text-secondary)',
                fontWeight: timeFilter === 'month' ? 700 : 500,
                fontSize: '0.75rem',
                cursor: 'pointer',
              }}
            >
              Theo Tháng
            </button>
          </div>
        </div>

        {/* Visual Mock SVG Chart */}
        <div style={{ height: '240px', width: '100%', position: 'relative' }}>
          <svg style={{ width: '100%', height: '100%', overflow: 'visible' }}>
            <defs>
              <linearGradient id="userGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2563EB" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#2563EB" stopOpacity="0.0" />
              </linearGradient>
              <linearGradient id="compGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#059669" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#059669" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Grid Lines */}
            <line x1="0" y1="40" x2="100%" y2="40" stroke="#E2E8F0" strokeDasharray="4 4" />
            <line x1="0" y1="100" x2="100%" y2="100" stroke="#E2E8F0" strokeDasharray="4 4" />
            <line x1="0" y1="160" x2="100%" y2="160" stroke="#E2E8F0" strokeDasharray="4 4" />
            <line x1="0" y1="210" x2="100%" y2="210" stroke="#CBD5E1" />

            {/* User Trend Area & Line */}
            <path
              d="M 20 180 Q 200 150 400 120 T 800 80 T 1200 45 L 1200 210 L 20 210 Z"
              fill="url(#userGrad)"
            />
            <path
              d="M 20 180 Q 200 150 400 120 T 800 80 T 1200 45"
              fill="none"
              stroke="#2563EB"
              strokeWidth="3"
            />

            {/* Company Trend Line */}
            <path
              d="M 20 200 Q 200 190 400 175 T 800 160 T 1200 145"
              fill="none"
              stroke="#059669"
              strokeWidth="2.5"
            />
          </svg>
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '24px', marginTop: '16px', fontSize: '0.8125rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: '#2563EB' }} />
            <span style={{ fontWeight: 600, color: 'var(--dash-text-primary)' }}>Người Dùng Toàn Website (Users)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: '#059669' }} />
            <span style={{ fontWeight: 600, color: 'var(--dash-text-primary)' }}>Doanh Nghiệp Đăng Ký (Companies)</span>
          </div>
        </div>
      </div>

      {/* 5. Hai Bảng Hoạt Động Cốt Lõi: Company Mới Đăng Ký & Hoạt Động Quản Trị Gần Đây */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))',
          gap: '20px',
        }}
      >
        {/* Khối Trái: Company Mới Đăng Ký */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '16px',
            border: '1px solid var(--dash-border)',
            padding: '20px',
            boxShadow: 'var(--dash-shadow-xs)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--dash-text-primary)', margin: 0 }}>
                Company Mới Đăng Ký
              </h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)', margin: '2px 0 0 0' }}>
                Danh sách doanh nghiệp mới khởi tạo gần đây
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate && onNavigate('/admin/companies')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '0.75rem',
                fontWeight: 600,
                color: '#059669',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <span>Xem tất cả</span>
              <ArrowRight size={12} />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {recentCompanies.map((c) => (
              <div
                key={c.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 14px',
                  borderRadius: '10px',
                  backgroundColor: '#F8FAFC',
                  border: '1px solid var(--dash-border)',
                  fontSize: '0.8125rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '8px',
                      backgroundColor: '#ECFDF5',
                      color: '#059669',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      fontSize: '0.75rem',
                    }}
                  >
                    {c.name.charAt(0)}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, color: 'var(--dash-text-primary)' }}>{c.name}</div>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)' }}>
                      Owner: {c.ownerName} ({c.membersCount} thành viên)
                    </div>
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      borderRadius: '9999px',
                      fontSize: '0.6875rem',
                      fontWeight: 700,
                      backgroundColor: c.status === 'ACTIVE' ? '#ECFDF5' : '#FEF2F2',
                      color: c.status === 'ACTIVE' ? '#059669' : '#DC2626',
                      border: c.status === 'ACTIVE' ? '1px solid #A7F3D0' : '1px solid #FECACA',
                    }}
                  >
                    {c.status === 'ACTIVE' ? 'Hoạt động' : 'Tạm ngưng'}
                  </span>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', marginTop: '2px' }}>
                    {c.createdAt}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Khối Phải: Hoạt Động Quản Trị Gần Đây */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '16px',
            border: '1px solid var(--dash-border)',
            padding: '20px',
            boxShadow: 'var(--dash-shadow-xs)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--dash-text-primary)', margin: 0 }}>
                Nhật Ký Quản Trị Gần Đây
              </h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)', margin: '2px 0 0 0' }}>
                Thao tác quản lý tài khoản và công ty do ADMIN thực hiện
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate && onNavigate('/admin/audit-logs')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '0.75rem',
                fontWeight: 600,
                color: '#059669',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <span>Xem Audit Log</span>
              <ArrowRight size={12} />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {recentAdminActivities.map((act) => (
              <div
                key={act.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 14px',
                  borderRadius: '10px',
                  backgroundColor: '#F8FAFC',
                  border: '1px solid var(--dash-border)',
                  fontSize: '0.8125rem',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontWeight: 700, color: 'var(--dash-text-primary)' }}>{act.action}</span>
                    <span style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)' }}>&bull; {act.time}</span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-secondary)', marginTop: '2px', fontFamily: 'var(--font-mono)' }}>
                    Đối tượng: {act.target}
                  </div>
                </div>

                <div>
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      borderRadius: '6px',
                      fontSize: '0.6875rem',
                      fontWeight: 600,
                      backgroundColor: act.status === 'SUCCESS' ? '#ECFDF5' : '#FEF3C7',
                      color: act.status === 'SUCCESS' ? '#059669' : '#D97706',
                    }}
                  >
                    Thành công
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminWebsiteDashboard;
