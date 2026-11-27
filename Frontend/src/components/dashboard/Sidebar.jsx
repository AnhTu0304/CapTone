import React from 'react';
import { useTranslation } from 'react-i18next';
import logoPng from '../../assets/Logo-transparent.png';
import { useDashboard } from '../../pages/Dashboard/context/DashboardContext';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard,
  LineChart,
  FileText,
  Activity,
  AlertTriangle,
  Zap,
  History,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Radio,
  Server,
  Layers,
  Box,
  Building2,
  Users,
  ScrollText,
  BarChart3,
  ShieldAlert,
  Settings,
} from 'lucide-react';

export const Sidebar = ({ currentPath = '/dashboard', isFloating = true, isMobileDrawer = false }) => {
  const { t } = useTranslation('dashboard');
  const {
    isSidebarCollapsed,
    setIsSidebarCollapsed,
    setIsMobileNavOpen,
    pendingApprovalsCount,
    activeIncidentsCount,
    newHealingHistoryCount,
    clearNewHealingHistoryCount,
    onNavigate,
    currentOrg,
    currentUserRole,
  } = useDashboard();

  const effectiveCollapsed = isMobileDrawer ? false : isSidebarCollapsed;

  // Tự động xóa số thông báo mới khi người dùng đang mở trang Lịch sử phục hồi
  React.useEffect(() => {
    const clean = (currentPath || '').toLowerCase().split('?')[0].split('#')[0];
    if (clean.startsWith('/dashboard/self-healing/history') && newHealingHistoryCount > 0) {
      clearNewHealingHistoryCount?.();
    }
  }, [currentPath, newHealingHistoryCount, clearNewHealingHistoryCount]);

  const auth = useAuth();

  const user = auth?.user || null;
  const isSuperAdmin = auth?.isSuperAdmin ? auth.isSuperAdmin(user) : false;
  const isSystemAdmin = auth?.isAdmin ? auth.isAdmin(user) : false;
  const isOwnerUser = auth?.isOwner ? auth.isOwner(user) : false;
  // Quyền hạn tenant trong Tổ chức đang chọn có ưu tiên tối cao trong Dashboard (Principle of Least Privilege: Mặc định VIEWER)
  const effectiveRole = (
    currentUserRole ||
    currentOrg?.role_in_org ||
    currentOrg?.role ||
    (isSuperAdmin || isSystemAdmin || isOwnerUser ? 'SME_OWNER' : (auth?.isDevOps && auth.isDevOps(user)) ? 'DEVOPS' : 'VIEWER')
  ).toUpperCase();

  const isDevOpsUser = effectiveRole === 'DEVOPS';
  const isViewerUser = effectiveRole === 'VIEWER';

  const navGroups = React.useMemo(
    () => [
      {
        key: 'overview',
        group: t('sidebar.groups.overview'),
        items: [
          { name: t('sidebar.items.dashboard'), path: '/dashboard', icon: LayoutDashboard },
        ],
      },
      {
        key: 'monitoring',
        group: t('sidebar.groups.monitoring'),
        items: [
          { name: t('sidebar.items.metrics'), path: '/dashboard/monitoring/metrics', icon: LineChart },
          { name: t('sidebar.items.logs'), path: '/dashboard/monitoring/logs', icon: FileText },
          { name: t('sidebar.items.events'), path: '/dashboard/monitoring/events', icon: Activity },
        ],
      },
      {
        key: 'ai',
        group: t('sidebar.groups.ai'),
        items: [
          {
            name: t('sidebar.items.incidents'),
            path: '/dashboard/incidents',
            icon: AlertTriangle,
            badge: activeIncidentsCount > 0 ? `${activeIncidentsCount}` : null,
            badgeType: 'danger',
          },
        ],
      },
      {
        key: 'selfHealing',
        group: t('sidebar.groups.selfHealing'),
        items: [
          { name: t('sidebar.items.actions'), path: '/dashboard/self-healing/actions', icon: Zap },
          {
            name: t('sidebar.items.history'),
            path: '/dashboard/self-healing/history',
            icon: History,
            badge: newHealingHistoryCount > 0 ? `${newHealingHistoryCount}` : null,
            badgeType: 'mint',
          },
          {
            name: t('sidebar.items.approvalGate'),
            path: '/dashboard/self-healing/approvals',
            icon: CheckCircle2,
            badge: pendingApprovalsCount > 0 ? `${pendingApprovalsCount}` : null,
            badgeType: 'warning',
          },
        ],
      },
      ...(isMobileDrawer
        ? [
            {
              key: 'infra',
              group: t('sidebar.groups.infraShort'),
              items: [
                { name: t('sidebar.items.agents'), path: '/dashboard/agents', icon: Radio },
                { name: t('sidebar.items.clustersShort'), path: '/dashboard/clusters', icon: Server },
                { name: t('sidebar.items.infraHosts'), path: '/dashboard/infrastructure', icon: Layers },
                { name: t('sidebar.items.workloadsFull'), path: '/dashboard/workloads', icon: Box },
              ],
            },
            {
              key: 'org',
              group: t('sidebar.groups.orgGroup'),
              items: [
                { name: t('sidebar.items.organizationTitle'), path: '/dashboard/organization', icon: Building2 },
                { name: t('sidebar.items.membersFull'), path: '/dashboard/organization/members', icon: Users },
              ],
            },
            {
              key: 'system',
              group: t('sidebar.groups.systemGroup'),
              items: [
                { name: t('sidebar.items.policies'), path: '/dashboard/self-healing/policies', icon: ShieldAlert },
                { name: t('sidebar.items.auditLogs'), path: '/dashboard/audit-logs', icon: ScrollText },
                { name: t('sidebar.items.slaReports'), path: '/dashboard/reports', icon: BarChart3 },
                { name: t('sidebar.items.systemSettings'), path: '/dashboard/settings', icon: Settings },
              ],
            },
          ]
        : []),
    ],
    [t, activeIncidentsCount, newHealingHistoryCount, pendingApprovalsCount, isMobileDrawer]
  );

  const filteredNavGroups = React.useMemo(() => {
    // 1. Viewer: Xóa Cổng phê duyệt, Cài đặt hệ thống, Tổ chức, Chính sách tự động, Cụm K8s
    if (isViewerUser) {
      return navGroups
        .filter((group) => group.key !== 'org')
        .map((group) => {
          const filteredItems = group.items.filter((item) => {
            if (item.path === '/dashboard/clusters') return false;
            if (item.path === '/dashboard/self-healing/policies') return false;
            if (item.path === '/dashboard/self-healing/approvals') return false;
            if (item.path === '/dashboard/settings') return false;
            return true;
          });
          return {
            ...group,
            items: filteredItems,
          };
        })
        .filter((group) => group.items.length > 0);
    }

    // 2. DevOps: Thấy toàn bộ hạ tầng, giám sát, AI, tự phục hồi nhưng ẩn Tổ chức và Cài đặt hệ thống
    if (isDevOpsUser) {
      return navGroups
        .filter((group) => group.key !== 'org')
        .map((group) => {
          if (group.key === 'system') {
            return {
              ...group,
              items: group.items.filter((item) => item.path !== '/dashboard/settings'),
            };
          }
          return group;
        });
    }

    // 3. Cấp cao (SME Owner, Admin, Super Admin): Kế thừa toàn bộ quyền hạn và thấy tất cả 18 trang
    return navGroups;
  }, [isViewerUser, isDevOpsUser, navGroups]);

  const activeItemPath = React.useMemo(() => {
    const cleanPath = (currentPath || '').split('?')[0].split('#')[0];
    const allItems = filteredNavGroups.flatMap((g) => g.items);

    // 1. Exact match has top priority
    const exact = allItems.find((it) => it.path === cleanPath);
    if (exact) return exact.path;

    // Special aliased routes for consolidated views (Phương án 1)
    if (cleanPath.startsWith('/dashboard/monitoring/events') || cleanPath.startsWith('/dashboard/monitoring/logs')) {
      const logsItem = allItems.find((it) => it.path === '/dashboard/monitoring/logs');
      if (logsItem) return logsItem.path;
    }
    if (
      cleanPath.startsWith('/dashboard/self-healing/history') ||
      cleanPath.startsWith('/dashboard/self-healing/actions') ||
      cleanPath.startsWith('/dashboard/self-healing/approvals') ||
      cleanPath === '/dashboard/self-healing'
    ) {
      const hubItem = allItems.find((it) => it.path === '/dashboard/self-healing');
      if (hubItem) return hubItem.path;
    }
    if (cleanPath.startsWith('/dashboard/audit-logs') || cleanPath.startsWith('/dashboard/reports')) {
      const repItem = allItems.find((it) => it.path === '/dashboard/reports');
      if (repItem) return repItem.path;
    }

    // 2. Longest prefix match with trailing slash (ignoring root '/dashboard')
    const prefixMatches = allItems.filter(
      (it) => it.path !== '/dashboard' && cleanPath.startsWith(`${it.path}/`)
    );
    if (prefixMatches.length > 0) {
      prefixMatches.sort((a, b) => b.path.length - a.path.length);
      return prefixMatches[0].path;
    }
    return null;
  }, [filteredNavGroups, currentPath]);

  const handleItemClick = (path) => {
    if (path === '/dashboard/self-healing/history') {
      clearNewHealingHistoryCount?.();
    }
    if (isMobileDrawer) {
      setIsMobileNavOpen?.(false);
    }
    if (onNavigate) {
      onNavigate(path);
    }
  };

  return (
    <aside
      className="dashboard-sidebar"
      style={{
        width: isMobileDrawer ? '100%' : effectiveCollapsed ? '68px' : '256px',
        minWidth: isMobileDrawer ? 0 : effectiveCollapsed ? '68px' : '256px',
        background: isFloating
          ? 'linear-gradient(180deg, rgba(255, 255, 255, 0.86) 0%, rgba(255, 255, 255, 0.80) 100%)'
          : '#FFFFFF',
        backdropFilter: isFloating ? 'blur(24px) brightness(1.04)' : 'none',
        WebkitBackdropFilter: isFloating ? 'blur(24px) brightness(1.04)' : 'none',
        border: isFloating ? '1px solid rgba(255, 255, 255, 0.96)' : 'none',
        borderRight: isFloating ? '1px solid rgba(255, 255, 255, 0.96)' : '1px solid var(--dash-border)',
        borderRadius: isFloating ? '18px' : 0,
        boxShadow: isFloating
          ? 'inset 0 1px 0 rgba(255, 255, 255, 1), 0 0 0 1px rgba(203, 213, 225, 0.65), 0 12px 32px rgba(15, 23, 42, 0.07)'
          : 'none',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        transition: 'width 0.22s cubic-bezier(0.4, 0, 0.2, 1), min-width 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
        position: 'relative',
        overflow: 'visible',
        zIndex: 40,
      }}
    >
      {/* Lớp vân nhám trắng mịn (White Sandblasted Frosted Matte) */}
      {isFloating && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '18px',
            overflow: 'hidden',
            pointerEvents: 'none',
            zIndex: 0,
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              opacity: 0.16,
              mixBlendMode: 'multiply',
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 220 220' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1.15' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
              backgroundRepeat: 'repeat',
              backgroundSize: '150px 150px',
            }}
          />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background:
                'radial-gradient(circle at 20% 0%, rgba(255, 255, 255, 0.65) 0%, rgba(255, 255, 255, 0) 60%)',
            }}
          />
        </div>
      )}
      {/* Nút tròn xanh lá phóng ra / thu vào ở cạnh phải Sidebar */}
      {isFloating && (
        <button
          type="button"
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          title={isSidebarCollapsed ? t('sidebar.expandAria') : t('sidebar.collapseAria')}
          aria-label={isSidebarCollapsed ? t('sidebar.expandAria') : t('sidebar.collapseAria')}
          style={{
            position: 'absolute',
            right: '-13px',
            top: '16px',
            width: '26px',
            height: '26px',
            borderRadius: '50%',
            backgroundColor: '#059669',
            color: '#FFFFFF',
            border: '2px solid #FFFFFF',
            boxShadow: '0 2px 8px rgba(5, 150, 105, 0.35), 0 1px 3px rgba(15, 23, 42, 0.14)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            zIndex: 60,
            padding: 0,
            transition: 'transform 0.15s ease, background-color 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#047857';
            e.currentTarget.style.transform = 'scale(1.06)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#059669';
            e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          {isSidebarCollapsed ? <ChevronRight size={15} strokeWidth={2.6} /> : <ChevronLeft size={15} strokeWidth={2.6} />}
        </button>
      )}

      {/* Brand Header inside Floating Sidebar Card */}
      <div
        style={{
          padding: effectiveCollapsed ? '14px 10px' : '14px 16px',
          borderBottom: '1px solid rgba(203, 213, 225, 0.55)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: effectiveCollapsed ? 'center' : 'flex-start',
          minHeight: '58px',
          flexShrink: 0,
          position: 'relative',
          zIndex: 1,
        }}
      >
        <div
          onClick={() => (effectiveCollapsed ? setIsSidebarCollapsed(false) : handleItemClick('/dashboard'))}
          title={effectiveCollapsed ? t('sidebar.expandHint') : t('sidebar.homeTitle')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            cursor: 'pointer',
            minWidth: 0,
          }}
        >
          <img
            src={logoPng}
            width={30}
            height={30}
            alt="SelfHeal Logo"
            style={{
              width: '30px',
              height: '30px',
              objectFit: 'contain',
              flexShrink: 0,
            }}
          />
          {!effectiveCollapsed && (
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: '0.9375rem', color: 'var(--dash-text-primary)', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
                SelfHeal
              </div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {t('sidebar.brandSubtitle')}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Navigation Groups */}
      <div
        className="dashboard-sidebar-nav"
        style={{
          padding: effectiveCollapsed ? '12px 8px' : '16px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          position: 'relative',
          zIndex: 1,
        }}
      >
        {filteredNavGroups.map((group, gIdx) => (
          <div key={gIdx}>
            {!effectiveCollapsed && (
              <div
                style={{
                  fontSize: '0.6875rem',
                  fontWeight: 700,
                  color: 'var(--dash-text-muted)',
                  letterSpacing: '0.06em',
                  padding: '4px 10px',
                  marginBottom: '4px',
                }}
              >
                {group.group}
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {group.items.map((item, iIdx) => {
                const Icon = item.icon;
                const isActive = item.path === activeItemPath;

                return (
                  <button
                    key={iIdx}
                    onClick={() => handleItemClick(item.path)}
                    title={effectiveCollapsed ? item.name : undefined}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: effectiveCollapsed ? 'center' : 'space-between',
                      padding: effectiveCollapsed ? '10px 0' : '8px 12px',
                      borderRadius: 'var(--dash-radius-md)',
                      backgroundColor: isActive ? 'var(--dash-primary-light)' : 'transparent',
                      color: isActive ? 'var(--dash-primary)' : 'var(--dash-text-secondary)',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '0.8125rem',
                      fontWeight: isActive ? 600 : 500,
                      textAlign: 'left',
                      transition: 'all 0.15s ease',
                      width: '100%',
                      outline: 'none',
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.backgroundColor = 'var(--dash-bg-subtle)';
                        e.currentTarget.style.color = 'var(--dash-text-primary)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.color = 'var(--dash-text-secondary)';
                      }
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                      <Icon
                        size={17}
                        strokeWidth={isActive ? 2.2 : 1.8}
                        style={{ color: isActive ? 'var(--dash-primary)' : 'var(--dash-text-secondary)', flexShrink: 0 }}
                      />
                      {!effectiveCollapsed && (
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
                      )}
                    </div>

                    {!effectiveCollapsed && item.badge && (
                      <span
                        style={{
                          fontSize: '0.6875rem',
                          fontWeight: 700,
                          padding: '1px 6px',
                          borderRadius: 'var(--dash-radius-full)',
                          backgroundColor:
                            item.badgeType === 'danger'
                              ? '#FEE2E2'
                              : item.badgeType === 'warning'
                              ? 'var(--dash-warning-bg)'
                              : item.badgeType === 'mint'
                              ? 'var(--dash-mint-100)'
                              : item.badgeType === 'neutral'
                              ? '#F1F5F9'
                              : 'var(--dash-info-bg)',
                          color:
                            item.badgeType === 'danger'
                              ? '#DC2626'
                              : item.badgeType === 'warning'
                              ? 'var(--dash-warning-text)'
                              : item.badgeType === 'mint'
                              ? 'var(--dash-mint-600)'
                              : item.badgeType === 'neutral'
                              ? '#64748B'
                              : 'var(--dash-info-text)',
                          border:
                            item.badgeType === 'danger'
                              ? '1px solid #FCA5A5'
                              : item.badgeType === 'warning'
                              ? '1px solid var(--dash-warning-border)'
                              : item.badgeType === 'mint'
                              ? '1px solid var(--dash-mint-200)'
                              : item.badgeType === 'neutral'
                              ? '1px solid #CBD5E1'
                              : '1px solid var(--dash-info-border)',
                        }}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

    </aside>
  );
};

export default Sidebar;
