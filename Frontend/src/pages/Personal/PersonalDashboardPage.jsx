import React, { useState } from 'react';
import {
  Building2,
  CheckCircle2,
  Bell,
  ArrowRight,
  Shield,
  Activity,
} from 'lucide-react';
import { personalPortalService } from '../../services/personalPortalService';

export const PersonalDashboardPage = ({ onNavigate }) => {
  const [summary] = useState(() => personalPortalService.getDashboardSummary());
  const [companies] = useState(() => personalPortalService.getMyCompanies());
  const [invitations, setInvitations] = useState(() => personalPortalService.getInvitations());

  const handleEnterCompany = (company) => {
    localStorage.setItem('selfheal_active_org_id', company.id);
    localStorage.setItem('selfheal_active_org_name', company.name);
    if (onNavigate) {
      onNavigate('/dashboard');
    }
  };

  const handleAcceptInvite = (invId) => {
    try {
      personalPortalService.respondInvitation(invId, true);
      setInvitations(personalPortalService.getInvitations());
    } catch (e) {
      alert(e.message);
    }
  };

  const handleRejectInvite = (invId) => {
    try {
      personalPortalService.respondInvitation(invId, false);
      setInvitations(personalPortalService.getInvitations());
    } catch (e) {
      alert(e.message);
    }
  };

  const pendingInvites = invitations.filter((i) => i.status === 'PENDING');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Pending Invitations Banner (If any) */}
      {pendingInvites.length > 0 && (
        <div
          style={{
            backgroundColor: '#EFF6FF',
            border: '1px solid #BFDBFE',
            borderRadius: '12px',
            padding: '16px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Bell size={18} color="#2563EB" />
              <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#1E40AF' }}>
                Bạn có {pendingInvites.length} lời mời tham gia Company đang chờ phản hồi
              </span>
            </div>
            <button
              type="button"
              onClick={() => onNavigate && onNavigate('/portal/companies')}
              style={{
                fontSize: '0.75rem',
                color: '#2563EB',
                fontWeight: 700,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Xem chi tiết $\to$
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '12px' }}>
            {pendingInvites.map((inv) => (
              <div
                key={inv.id}
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: '9px',
                  padding: '12px 16px',
                  border: '1px solid #DBEAFE',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                }}
              >
                <div>
                  <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#1E293B' }}>{inv.organizationName}</div>
                  <div style={{ fontSize: '0.75rem', color: '#64748B' }}>
                    Từ {inv.inviterName} • Vai trò: <strong style={{ color: '#059669' }}>{inv.invitedRoleTitle}</strong>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    type="button"
                    onClick={() => handleAcceptInvite(inv.id)}
                    style={{
                      padding: '5px 10px',
                      borderRadius: '6px',
                      backgroundColor: '#059669',
                      color: '#FFFFFF',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    Đồng ý
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRejectInvite(inv.id)}
                    style={{
                      padding: '5px 10px',
                      borderRadius: '6px',
                      backgroundColor: '#F1F5F9',
                      color: '#64748B',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      border: '1px solid #CBD5E1',
                      cursor: 'pointer',
                    }}
                  >
                    Từ chối
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4 KPIs Row (4 cards 1 hàng) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
          gap: '16px',
        }}
      >
        {/* KPI 1 */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            padding: '20px',
            border: '1px solid var(--dash-border, #E2E8F0)',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#64748B' }}>Tổng Company Tham Gia</span>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                backgroundColor: '#EFF6FF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Building2 size={18} color="#2563EB" />
            </div>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0F172A', lineHeight: 1 }}>
            {summary.totalCompanies}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#059669', marginTop: '8px', fontWeight: 600 }}>
            {summary.activeCompanies} công ty đang kích hoạt
          </div>
        </div>

        {/* KPI 2 */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            padding: '20px',
            border: '1px solid var(--dash-border, #E2E8F0)',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#64748B' }}>Company Đang Hoạt Động</span>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                backgroundColor: '#ECFDF5',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <CheckCircle2 size={18} color="#059669" />
            </div>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#059669', lineHeight: 1 }}>
            {summary.activeCompanies}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '8px' }}>
            100% kết nối cụm K8s ổn định
          </div>
        </div>

        {/* KPI 3 */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            padding: '20px',
            border: '1px solid var(--dash-border, #E2E8F0)',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#64748B' }}>Thông Báo Chưa Đọc</span>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                backgroundColor: '#FEF2F2',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Bell size={18} color="#DC2626" />
            </div>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#DC2626', lineHeight: 1 }}>
            {summary.unreadNotifs}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '8px' }}>
            {summary.pendingInvitations} lời mời công ty đang chờ
          </div>
        </div>

        {/* KPI 4 */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            padding: '20px',
            border: '1px solid var(--dash-border, #E2E8F0)',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#64748B' }}>Bảo Mật Tài Khoản</span>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                backgroundColor: '#F0F9FF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Shield size={18} color="#0284C7" />
            </div>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0284C7', lineHeight: 1 }}>
            Đã bật 2FA
          </div>
          <div style={{ fontSize: '0.75rem', color: '#059669', marginTop: '8px', fontWeight: 600 }}>
            Phiên làm việc bảo vệ an toàn
          </div>
        </div>
      </div>

      {/* Main Content Grid: Left (Company List) & Right (Recent Activity Feed) */}
      <div style={{ display: 'grid', gridTemplateColumns: '7fr 5fr', gap: '20px' }}>
        {/* Left Column: My Companies Quick Access */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            border: '1px solid var(--dash-border, #E2E8F0)',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                Company Của Tôi — Truy Cập Nhanh
              </h3>
              <p style={{ fontSize: '0.78125rem', color: '#64748B', margin: '2px 0 0 0' }}>
                Danh sách các tổ chức bạn đang nắm giữ vai trò và quyền truy cập
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate && onNavigate('/portal/companies')}
              style={{
                fontSize: '0.78125rem',
                color: '#059669',
                fontWeight: 700,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <span>Xem tất cả ({companies.length})</span>
              <ArrowRight size={14} />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {companies.map((company) => (
              <div
                key={company.id}
                style={{
                  border: '1px solid #E2E8F0',
                  borderRadius: '10px',
                  padding: '14px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  transition: 'all 0.15s ease',
                  backgroundColor: '#FFFFFF',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div
                    style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '10px',
                      backgroundColor: '#EFF6FF',
                      color: '#2563EB',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.125rem',
                      fontWeight: 800,
                    }}
                  >
                    {company.name.charAt(0)}
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#0F172A' }}>
                        {company.name}
                      </span>
                      <span
                        style={{
                          fontSize: '0.6875rem',
                          fontWeight: 700,
                          padding: '1px 8px',
                          borderRadius: '9999px',
                          backgroundColor:
                            company.role === 'SME_OWNER'
                              ? '#ECFDF5'
                              : company.role === 'DEVOPS'
                              ? '#EFF6FF'
                              : '#F1F5F9',
                          color:
                            company.role === 'SME_OWNER'
                              ? '#065F46'
                              : company.role === 'DEVOPS'
                              ? '#1E40AF'
                              : '#475569',
                        }}
                      >
                        {company.roleTitle}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '3px' }}>
                      {company.clustersCount} Cụm K8s • {company.activeWorkloads} Workloads • Truy cập {company.lastAccessedAt}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleEnterCompany(company)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '8px',
                    backgroundColor: '#059669',
                    color: '#FFFFFF',
                    border: 'none',
                    fontSize: '0.78125rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 2px 4px rgba(5, 150, 105, 0.2)',
                  }}
                >
                  <span>Vào Workspace</span>
                  <ArrowRight size={13} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Recent Personal Activity */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            border: '1px solid var(--dash-border, #E2E8F0)',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                Hoạt Động Gần Đây
              </h3>
              <p style={{ fontSize: '0.78125rem', color: '#64748B', margin: '2px 0 0 0' }}>
                Lịch sử đăng nhập, bảo mật và tương tác Company
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate && onNavigate('/portal/activity')}
              style={{
                fontSize: '0.78125rem',
                color: '#059669',
                fontWeight: 700,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Xem nhật ký $\to$
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {summary.recentActivities.map((act) => (
              <div key={act.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                <div
                  style={{
                    width: '30px',
                    height: '30px',
                    borderRadius: '8px',
                    backgroundColor:
                      act.category === 'AUTH'
                        ? '#EFF6FF'
                        : act.category === 'SECURITY'
                        ? '#FEF3C7'
                        : act.category === 'COMPANY'
                        ? '#ECFDF5'
                        : '#F1F5F9',
                    color:
                      act.category === 'AUTH'
                        ? '#2563EB'
                        : act.category === 'SECURITY'
                        ? '#D97706'
                        : act.category === 'COMPANY'
                        ? '#059669'
                        : '#475569',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    marginTop: '2px',
                  }}
                >
                  <Activity size={15} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#1E293B' }}>{act.title}</div>
                  <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '1px' }}>{act.description}</div>
                  <div style={{ fontSize: '0.6875rem', color: '#94A3B8', marginTop: '2px' }}>{act.timestamp}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PersonalDashboardPage;
