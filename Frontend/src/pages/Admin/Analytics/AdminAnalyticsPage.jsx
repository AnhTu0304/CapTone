import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  Building2,
  Users,
  Calendar,
  Filter,
  Download,
  ArrowUpRight,
  ArrowDownRight,
  ChevronRight,
  ShieldCheck,
  Activity,
  Layers,
  Sparkles,
  PieChart,
  BarChart3,
  CheckCircle2,
} from 'lucide-react';

export const AdminAnalyticsPage = ({ onNavigate }) => {
  const [selectedYear, setSelectedYear] = useState('2026');
  const [selectedMonth, setSelectedMonth] = useState('ALL'); // 'ALL' | '1' .. '12'
  const [tierFilter, setTierFilter] = useState('ALL');

  // Dữ liệu tăng trưởng giả lập 12 tháng năm 2026
  const monthlyData2026 = [
    { month: 'T1', monthName: 'Tháng 1', newOrgs: 3, totalOrgs: 35, mau: 980 },
    { month: 'T2', monthName: 'Tháng 2', newOrgs: 4, totalOrgs: 39, mau: 1050 },
    { month: 'T3', monthName: 'Tháng 3', newOrgs: 2, totalOrgs: 41, mau: 1120 },
    { month: 'T4', monthName: 'Tháng 4', newOrgs: 3, totalOrgs: 44, mau: 1190 },
    { month: 'T5', monthName: 'Tháng 5', newOrgs: 5, totalOrgs: 49, mau: 1280 },
    { month: 'T6', monthName: 'Tháng 6', newOrgs: 4, totalOrgs: 53, mau: 1350 },
    { month: 'T7', monthName: 'Tháng 7', newOrgs: 6, totalOrgs: 59, mau: 1420 },
    { month: 'T8', monthName: 'Tháng 8', newOrgs: 4, totalOrgs: 63, mau: 1510 },
    { month: 'T9', monthName: 'Tháng 9', newOrgs: 5, totalOrgs: 68, mau: 1620 },
    { month: 'T10', monthName: 'Tháng 10', newOrgs: 6, totalOrgs: 74, mau: 1750 },
    { month: 'T11', monthName: 'Tháng 11', newOrgs: 5, totalOrgs: 79, mau: 1840 },
    { month: 'T12', monthName: 'Tháng 12', newOrgs: 7, totalOrgs: 86, mau: 1960 },
  ];

  // Danh sách công ty kèm số liệu chi tiết
  const mockOrgList = [
    {
      id: 'org-acme',
      name: 'Acme Corporation',
      plan: 'Enterprise VIP',
      joinedMonth: 'T2/2026',
      usersCount: 42,
      clustersCount: 6,
      aiRequests: '142,500/tháng',
      status: 'Active',
    },
    {
      id: 'org-nexus',
      name: 'Nexus Logistics AI',
      plan: 'SME Production Pro',
      joinedMonth: 'T4/2026',
      usersCount: 18,
      clustersCount: 3,
      aiRequests: '86,200/tháng',
      status: 'Active',
    },
    {
      id: 'org-finflow',
      name: 'FinFlow Payment Gateway',
      plan: 'Enterprise VIP',
      joinedMonth: 'T6/2026',
      usersCount: 64,
      clustersCount: 8,
      aiRequests: '310,000/tháng',
      status: 'Active',
    },
    {
      id: 'org-viettel-sme',
      name: 'Viettel SME Cloud Solutions',
      plan: 'Enterprise VIP',
      joinedMonth: 'T1/2026',
      usersCount: 85,
      clustersCount: 12,
      aiRequests: '520,000/tháng',
      status: 'Active',
    },
    {
      id: 'org-vnpay',
      name: 'VNPAY Merchant Platform',
      plan: 'SME Production Pro',
      joinedMonth: 'T8/2026',
      usersCount: 26,
      clustersCount: 4,
      aiRequests: '112,000/tháng',
      status: 'Active',
    },
    {
      id: 'org-techlead',
      name: 'TechLead EduSystem',
      plan: 'SME Starter',
      joinedMonth: 'T9/2026',
      usersCount: 8,
      clustersCount: 1,
      aiRequests: '24,000/tháng',
      status: 'Active',
    },
  ];

  const filteredOrgs = useMemo(() => {
    if (tierFilter === 'ALL') return mockOrgList;
    return mockOrgList.filter((o) => o.plan.includes(tierFilter));
  }, [tierFilter]);

  const maxNewOrgs = Math.max(...monthlyData2026.map((d) => d.newOrgs));

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
              Thống Kê Tăng Trưởng & Dữ Liệu Doanh Nghiệp
            </h1>
            <span
              style={{
                padding: '2px 8px',
                borderRadius: '6px',
                backgroundColor: 'rgba(5, 150, 105, 0.1)',
                color: '#059669',
                fontSize: '0.6875rem',
                fontWeight: 700,
                border: '1px solid rgba(5, 150, 105, 0.25)',
              }}
            >
              SUPER ADMIN
            </span>
          </div>
          <p
            style={{
              fontSize: '0.8125rem',
              color: 'var(--dash-text-secondary)',
              marginTop: '4px',
              margin: '4px 0 0 0',
            }}
          >
            Phân tích số lượng công ty, người dùng hoạt động và quy mô hạ tầng K8s theo Tháng & Năm.
          </p>
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
              <option value="2026">Năm 2026</option>
              <option value="2025">Năm 2025</option>
              <option value="2024">Năm 2024</option>
            </select>
          </div>

          {/* Month selector */}
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
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
            <option value="10">Tháng 10</option>
            <option value="11">Tháng 11</option>
            <option value="12">Tháng 12</option>
          </select>

          {/* Export Button */}
          <button
            type="button"
            onClick={() => alert('Đang xuất báo cáo thống kê định dạng CSV/Excel...')}
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
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <Download size={14} />
            <span>Xuất Báo Cáo</span>
          </button>
        </div>
      </div>

      {/* 2. Top KPI Cards Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '16px',
        }}
      >
        {/* Card 1: Tổng Doanh Nghiệp */}
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
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--dash-text-muted)', textTransform: 'uppercase' }}>
              Tổng Doanh Nghiệp Khách Hàng
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
            86 <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--dash-text-muted)' }}>công ty</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '6px', fontSize: '0.75rem', color: '#059669', fontWeight: 600 }}>
            <ArrowUpRight size={14} />
            <span>+32.4% so với năm 2025</span>
          </div>
        </div>

        {/* Card 2: Người Dùng Hoạt Động (MAU/YAU) */}
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
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--dash-text-muted)', textTransform: 'uppercase' }}>
              Người Dùng Hoạt Động (MAU)
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
            1,960 <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--dash-text-muted)' }}>active/tháng</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '6px', fontSize: '0.75rem', color: '#059669', fontWeight: 600 }}>
            <ArrowUpRight size={14} />
            <span>YAU: 5,840 người dùng tích lũy</span>
          </div>
        </div>

        {/* Card 3: Hạ Tầng Cụm K8s Đang Kết Nối */}
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
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--dash-text-muted)', textTransform: 'uppercase' }}>
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
            34 <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--dash-text-muted)' }}>cụm Kubernetes</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '6px', fontSize: '0.75rem', color: '#059669', fontWeight: 600 }}>
            <ArrowUpRight size={14} />
            <span>Tổng cộng: 112 nodes vật lý & ảo hóa</span>
          </div>
        </div>

        {/* Card 4: Tỷ lệ Giữ Chân Khách Hàng */}
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
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--dash-text-muted)', textTransform: 'uppercase' }}>
              Tỷ Lệ Giữ Chân (Retention Rate)
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
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--dash-text-primary)', marginTop: '8px' }}>
            98.2% <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--dash-text-muted)' }}>ổn định</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '6px', fontSize: '0.75rem', color: '#059669', fontWeight: 600 }}>
            <span>Tỷ lệ rời bỏ (Churn): chỉ 1.8%</span>
          </div>
        </div>
      </div>

      {/* 3. Charts Section: Monthly Growth + Tier Breakdown */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))',
          gap: '20px',
        }}
      >
        {/* Monthly Bar Chart */}
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
              <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--dash-text-primary)', margin: 0 }}>
                Biểu Đồ Doanh Nghiệp Mới Gia Nhập (12 Tháng Năm {selectedYear})
              </h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)', margin: '2px 0 0 0' }}>
                Số lượng công ty đăng ký mới hàng tháng và đà tăng trưởng
              </p>
            </div>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#059669' }}>+51 công ty mới</span>
          </div>

          {/* SVG Bar Chart Visualization */}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '12px', height: '180px', paddingTop: '20px', borderBottom: '1px solid var(--dash-border)' }}>
            {monthlyData2026.map((item) => {
              const heightPercent = (item.newOrgs / maxNewOrgs) * 100;
              const isSelected = selectedMonth === item.month.replace('T', '');
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
                  <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--dash-text-secondary)' }}>
                    +{item.newOrgs}
                  </span>
                  <div
                    style={{
                      width: '100%',
                      maxWidth: '28px',
                      height: `${heightPercent}%`,
                      backgroundColor: isSelected ? '#047857' : '#10B981',
                      borderRadius: '4px 4px 0 0',
                      transition: 'height 0.3s ease',
                      cursor: 'pointer',
                    }}
                    title={`${item.monthName}: +${item.newOrgs} tổ chức mới (Tổng: ${item.totalOrgs})`}
                    onClick={() => setSelectedMonth(item.month.replace('T', ''))}
                  />
                  <span
                    style={{
                      fontSize: '0.6875rem',
                      fontWeight: isSelected ? 700 : 500,
                      color: isSelected ? '#059669' : 'var(--dash-text-muted)',
                      marginTop: '4px',
                    }}
                  >
                    {item.month}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Subscription Tier Distribution */}
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
              <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--dash-text-primary)', margin: 0 }}>
                Cơ Cấu Quy Mô Tổ Chức
              </h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)', margin: '2px 0 0 0' }}>
                Phân bổ theo số lượng tổ chức đăng ký từng gói
              </p>
            </div>
            <PieChart size={18} color="var(--dash-text-muted)" />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '16px' }}>
            {/* Enterprise Tier */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', marginBottom: '4px' }}>
                <span style={{ fontWeight: 600, color: 'var(--dash-text-primary)' }}>Enterprise VIP Platform</span>
                <span style={{ fontWeight: 700, color: '#059669' }}>28 tổ chức (33% tổng số)</span>
              </div>
              <div style={{ height: '8px', backgroundColor: '#F1F5F9', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: '33%', height: '100%', backgroundColor: '#059669', borderRadius: '4px' }} />
              </div>
            </div>

            {/* SME Production Pro */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', marginBottom: '4px' }}>
                <span style={{ fontWeight: 600, color: 'var(--dash-text-primary)' }}>SME Production Pro</span>
                <span style={{ fontWeight: 700, color: '#3B82F6' }}>42 tổ chức (49% tổng số)</span>
              </div>
              <div style={{ height: '8px', backgroundColor: '#F1F5F9', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: '49%', height: '100%', backgroundColor: '#3B82F6', borderRadius: '4px' }} />
              </div>
            </div>

            {/* SME Starter */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', marginBottom: '4px' }}>
                <span style={{ fontWeight: 600, color: 'var(--dash-text-primary)' }}>SME Starter Package</span>
                <span style={{ fontWeight: 700, color: '#F59E0B' }}>16 tổ chức (18% tổng số)</span>
              </div>
              <div style={{ height: '8px', backgroundColor: '#F1F5F9', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: '18%', height: '100%', backgroundColor: '#F59E0B', borderRadius: '4px' }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Detailed Organization Table */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid var(--dash-border)',
          borderRadius: '12px',
          boxShadow: 'var(--dash-shadow-xs)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--dash-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div>
            <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--dash-text-primary)', margin: 0 }}>
              Dữ Liệu Khách Hàng Tiêu Biểu & Mức Sử Dụng Nền Tảng
            </h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)', margin: '2px 0 0 0' }}>
              Theo dõi chi tiết mức độ tiêu thụ AI và cụm máy chủ theo từng doanh nghiệp
            </p>
          </div>

          {/* Filter by Tier */}
          <div style={{ display: 'flex', gap: '6px' }}>
            {['ALL', 'Enterprise', 'Production', 'Starter'].map((tier) => (
              <button
                key={tier}
                onClick={() => setTierFilter(tier)}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  fontWeight: tierFilter === tier ? 700 : 500,
                  border: '1px solid var(--dash-border)',
                  backgroundColor: tierFilter === tier ? '#059669' : '#FFFFFF',
                  color: tierFilter === tier ? '#FFFFFF' : 'var(--dash-text-secondary)',
                  cursor: 'pointer',
                }}
              >
                {tier === 'ALL' ? 'Tất cả gói' : tier}
              </button>
            ))}
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8125rem' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--dash-bg-canvas)', borderBottom: '1px solid var(--dash-border)', color: 'var(--dash-text-muted)' }}>
                <th style={{ padding: '12px 20px', fontWeight: 600 }}>TÊN DOANH NGHIỆP</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>GÓI DỊCH VỤ</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>THÁNG THAM GIA</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>THÀNH VIÊN</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>CỤM K8S</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>LƯỢNG GỌI AI</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>HẠ TẦNG NODES</th>
                <th style={{ padding: '12px 20px', fontWeight: 600, textAlign: 'right' }}>THAO TÁC</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrgs.map((org) => (
                <tr
                  key={org.id}
                  style={{
                    borderBottom: '1px solid var(--dash-border)',
                    transition: 'background-color 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--dash-bg-subtle)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <td style={{ padding: '14px 20px', fontWeight: 700, color: 'var(--dash-text-primary)' }}>
                    {org.name}
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: '6px',
                        fontSize: '0.6875rem',
                        fontWeight: 700,
                        backgroundColor: org.plan.includes('Enterprise') ? 'rgba(5, 150, 105, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                        color: org.plan.includes('Enterprise') ? '#059669' : '#3B82F6',
                        border: `1px solid ${org.plan.includes('Enterprise') ? 'rgba(5, 150, 105, 0.25)' : 'rgba(59, 130, 246, 0.25)'}`,
                      }}
                    >
                      {org.plan}
                    </span>
                  </td>
                  <td style={{ padding: '14px 16px', color: 'var(--dash-text-secondary)', fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
                    {org.joinedMonth}
                  </td>
                  <td style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--dash-text-primary)' }}>
                    {org.usersCount} users
                  </td>
                  <td style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--dash-text-primary)' }}>
                    {org.clustersCount} clusters
                  </td>
                  <td style={{ padding: '14px 16px', color: '#059669', fontWeight: 600, fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
                    {org.aiRequests}
                  </td>
                  <td style={{ padding: '14px 16px', fontWeight: 700, color: 'var(--dash-text-primary)' }}>
                    {org.clustersCount * 3} nodes
                  </td>
                  <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                    <button
                      type="button"
                      onClick={() => onNavigate && onNavigate(`/admin/organizations/${org.id}`)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        border: '1px solid var(--dash-border)',
                        backgroundColor: '#FFFFFF',
                        color: '#059669',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      <span>Chi tiết</span>
                      <ChevronRight size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminAnalyticsPage;
