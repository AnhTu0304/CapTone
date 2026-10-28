import React, { useState, useEffect, useCallback } from 'react';
import {
  Building2,
  CheckCircle2,
  Bell,
  ArrowRight,
  Shield,
  Activity,
  AlertCircle,
  RefreshCw,
  Plus,
  Loader2,
} from 'lucide-react';
import { personalPortalService } from '../../services/personalPortalService';
import { useAuth } from '../../context/AuthContext';
import multiTabSync, { SYNC_EVENTS } from '../../services/multiTabSync';

export const PersonalDashboardPage = ({ onNavigate }) => {
  const { user, isViewer, isOwner, isSuperAdmin } = useAuth?.() || {};
  const [isLoading, setIsLoading] = useState(true);
  const [apiError, setApiError] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [summary, setSummary] = useState({
    totalCompanies: 0,
    activeCompanies: 0,
    unreadNotifs: 0,
    pendingInvitations: 0,
    recentCompany: null,
    recentActivities: [],
  });

  const loadDashboardData = useCallback(async () => {
    setIsLoading(true);
    setApiError(null);
    try {
      const data = await personalPortalService.fetchDashboardSummary();
      setCompanies(data.companies || []);
      setInvitations(data.invitations || []);
      setSummary(
        data.summary || {
          totalCompanies: 0,
          activeCompanies: 0,
          unreadNotifs: 0,
          pendingInvitations: 0,
          recentCompany: null,
          recentActivities: [],
        }
      );
    } catch (err) {
      console.error('[PersonalDashboardPage] Lỗi tải dữ liệu dashboard:', err);
      setApiError(err.message || 'Không thể kết nối đến máy chủ hoặc cơ sở dữ liệu');
      setCompanies([]);
      setInvitations([]);
      setSummary({
        totalCompanies: 0,
        activeCompanies: 0,
        unreadNotifs: 0,
        pendingInvitations: 0,
        recentCompany: null,
        recentActivities: [],
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
    const unsub = multiTabSync.subscribe(SYNC_EVENTS.ORG_SWITCHED, () => {
      loadDashboardData();
    });
    return () => {
      unsub();
    };
  }, [loadDashboardData]);

  const handleEnterCompany = (company) => {
    if (!company || !company.id) return;
    localStorage.setItem('selfheal_active_org_id', company.id);
    localStorage.setItem('selfheal_active_org_name', company.name);
    localStorage.setItem('selfheal_active_org_role', company.role || 'SME_OWNER');
    if (onNavigate) {
      onNavigate('/dashboard');
    }
  };

  const handleAcceptInvite = async (invId) => {
    try {
      const targetInv = invitations.find((i) => i.id === invId);
      if (targetInv && targetInv.organizationId) {
        await personalPortalService.acceptBackendInvitation(invId, targetInv.organizationId);
      } else {
        personalPortalService.respondInvitation(invId, true);
      }
      await loadDashboardData();
    } catch (e) {
      alert(e.message || 'Không thể chấp nhận lời mời');
    }
  };

  const handleRejectInvite = async (invId) => {
    try {
      personalPortalService.respondInvitation(invId, false);
      await loadDashboardData();
    } catch (e) {
      alert(e.message || 'Không thể từ chối lời mời');
    }
  };

  const canCreateCompany =
    isSuperAdmin || isOwner || !isViewer || !user?.roles?.includes('VIEWER');

  const pendingInvites = invitations.filter((i) => i.status === 'PENDING');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Error Banner (if API or database error) */}
      {apiError && (
        <div
          style={{
            backgroundColor: '#FEF2F2',
            border: '1px solid #FECACA',
            borderRadius: '12px',
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertCircle size={20} color="#DC2626" />
            <div>
              <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#991B1B' }}>
                Không thể tải dữ liệu từ máy chủ hoặc cơ sở dữ liệu
              </div>
              <div style={{ fontSize: '0.78125rem', color: '#B91C1C', marginTop: '2px' }}>
                {apiError}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={loadDashboardData}
            style={{
              padding: '6px 14px',
              borderRadius: '8px',
              backgroundColor: '#DC2626',
              color: '#FFFFFF',
              border: 'none',
              fontSize: '0.78125rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <RefreshCw size={13} />
            <span>Thử lại</span>
          </button>
        </div>
      )}

      {/* Pending Invitations Banner (If any) */}
      {!isLoading && !apiError && pendingInvites.length > 0 && (
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
              Xem chi tiết &rarr;
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
            {isLoading ? '...' : summary.totalCompanies}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#059669', marginTop: '8px', fontWeight: 600 }}>
            {isLoading ? 'Đang kiểm tra...' : `${summary.activeCompanies} công ty đang kích hoạt`}
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
            {isLoading ? '...' : summary.activeCompanies}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '8px' }}>
            {isLoading
              ? 'Đang đồng bộ...'
              : summary.totalCompanies > 0
              ? `${summary.activeCompanies}/${summary.totalCompanies} công ty đang hoạt động`
              : 'Chưa có công ty nào kích hoạt'}
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
            {isLoading ? '...' : summary.unreadNotifs}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '8px' }}>
            {isLoading ? 'Đang kiểm tra...' : `${summary.pendingInvitations} lời mời công ty đang chờ`}
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
            {isLoading ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px',
                  padding: '48px 20px',
                  color: '#64748B',
                  fontSize: '0.875rem',
                }}
              >
                <Loader2 size={20} className="animate-spin" color="#059669" />
                <span>Đang tải danh sách Company...</span>
              </div>
            ) : apiError ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: '36px 20px',
                  backgroundColor: '#FFF5F5',
                  borderRadius: '10px',
                  border: '1px solid #FED7D7',
                  color: '#C53030',
                }}
              >
                <AlertCircle size={32} color="#E53E3E" style={{ margin: '0 auto 8px auto' }} />
                <div style={{ fontSize: '0.875rem', fontWeight: 700 }}>Không thể hiển thị Company</div>
                <p style={{ fontSize: '0.75rem', color: '#742A2A', margin: '4px 0 0 0' }}>
                  Đã xảy ra lỗi khi truy vấn backend. Vui lòng bấm "Thử lại" bên trên.
                </p>
              </div>
            ) : companies.length === 0 ? (
              /* Friendly Empty State khi Database chưa có Company */
              <div
                style={{
                  textAlign: 'center',
                  padding: '40px 20px',
                  backgroundColor: '#F8FAFC',
                  borderRadius: '10px',
                  border: '1px dashed #CBD5E1',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '12px',
                }}
              >
                <div
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    backgroundColor: '#EFF6FF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#2563EB',
                  }}
                >
                  <Building2 size={24} />
                </div>
                <div>
                  <div style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#1E293B' }}>
                    Chưa tham gia Company nào
                  </div>
                  <p
                    style={{
                      fontSize: '0.8125rem',
                      color: '#64748B',
                      maxWidth: '400px',
                      margin: '6px auto 0 auto',
                      lineHeight: 1.5,
                    }}
                  >
                    Hiện tại bạn chưa thuộc Company nào hoặc chưa được cấp quyền truy cập. Hãy tạo Company nếu bạn có quyền hoặc liên hệ quản trị viên để được mời tham gia.
                  </p>
                </div>
                {canCreateCompany && (
                  <button
                    type="button"
                    onClick={() => onNavigate && onNavigate('/portal/companies')}
                    style={{
                      marginTop: '6px',
                      padding: '8px 16px',
                      borderRadius: '8px',
                      backgroundColor: '#059669',
                      color: '#FFFFFF',
                      border: 'none',
                      fontSize: '0.78125rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: '0 2px 4px rgba(5, 150, 105, 0.2)',
                    }}
                  >
                    <Plus size={14} />
                    <span>Tạo Company Mới</span>
                  </button>
                )}
              </div>
            ) : (
              companies.map((company) => (
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
                      {company.name ? company.name.charAt(0).toUpperCase() : 'C'}
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
                          {company.roleTitle || 'Thành viên'}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '3px' }}>
                        {company.clustersCount || 0} Cụm K8s • {company.activeWorkloads || 0} Workloads • Truy cập {company.lastAccessedAt || 'Gần đây'}
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
              ))
            )}
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
              Xem nhật ký &rarr;
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {summary.recentActivities && summary.recentActivities.length > 0 ? (
              summary.recentActivities.map((act) => (
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
              ))
            ) : (
              <div
                style={{
                  textAlign: 'center',
                  padding: '30px 16px',
                  color: '#94A3B8',
                  fontSize: '0.8125rem',
                  border: '1px dashed #E2E8F0',
                  borderRadius: '8px',
                }}
              >
                Chưa có hoạt động gần đây
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PersonalDashboardPage;
