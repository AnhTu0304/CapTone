import React from 'react';
import { useDashboard } from '../../pages/Dashboard/context/DashboardContext';
import {
  LayoutDashboard,
  Building2,
  Users,
  Radio,
  Server,
  Layers,
  Box,
  LineChart,
  FileText,
  Activity,
  Sparkles,
  AlertTriangle,
  GitFork,
  Zap,
  History,
  ShieldAlert,
  CheckCircle2,
  Bell,
  ScrollText,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';

export const Sidebar = ({ currentPath = '/dashboard' }) => {
  const {
    isSidebarCollapsed,
    setIsSidebarCollapsed,
    pendingApprovalsCount,
    unreadNotifsCount,
    onNavigate,
  } = useDashboard();

  const navGroups = [
    {
      group: 'TỔNG QUAN',
      items: [
        { name: 'Bảng điều khiển', path: '/dashboard', icon: LayoutDashboard },
      ],
    },
    {
      group: 'TỔ CHỨC',
      items: [
        { name: 'Thông tin Tổ chức', path: '/dashboard/organization', icon: Building2 },
        { name: 'Thành viên & Phân quyền', path: '/dashboard/organization/members', icon: Users },
      ],
    },
    {
      group: 'HẠ TẦNG & TÁC TỬ',
      items: [
        { name: 'Tác tử Agent', path: '/dashboard/agents', icon: Radio },
        { name: 'Cụm K8s', path: '/dashboard/clusters', icon: Server },
        { name: 'Hạ tầng máy chủ', path: '/dashboard/infrastructure', icon: Layers },
        { name: 'Khối lượng công việc', path: '/dashboard/workloads', icon: Box },
      ],
    },
    {
      group: 'GIÁM SÁT',
      items: [
        { name: 'Chỉ số tài nguyên', path: '/dashboard/monitoring/metrics', icon: LineChart },
        { name: 'Nhật ký container', path: '/dashboard/monitoring/logs', icon: FileText },
        { name: 'Sự kiện K8s', path: '/dashboard/monitoring/events', icon: Activity },
      ],
    },
    {
      group: 'AI & SỰ CỐ',
      items: [
        { name: 'Dự báo rủi ro AI', path: '/dashboard/ai/predictions', icon: Sparkles, badge: '1', badgeType: 'mint' },
        { name: 'Quản lý sự cố', path: '/dashboard/incidents', icon: AlertTriangle },
        { name: 'Phân tích nguyên nhân (RCA)', path: '/dashboard/incidents/rca', icon: GitFork },
      ],
    },
    {
      group: 'TỰ PHỤC HỒI',
      items: [
        { name: 'Hành động tự sửa', path: '/dashboard/self-healing/actions', icon: Zap },
        { name: 'Lịch sử phục hồi', path: '/dashboard/self-healing/history', icon: History },
        { name: 'Chính sách tự động', path: '/dashboard/self-healing/policies', icon: ShieldAlert },
        {
          name: 'Cổng phê duyệt (HITL)',
          path: '/dashboard/self-healing/approvals',
          icon: CheckCircle2,
          badge: pendingApprovalsCount > 0 ? `${pendingApprovalsCount}` : null,
          badgeType: 'warning',
        },
      ],
    },
    {
      group: 'HỆ THỐNG',
      items: [
        {
          name: 'Thông báo',
          path: '/dashboard/notifications',
          icon: Bell,
          badge: unreadNotifsCount > 0 ? `${unreadNotifsCount}` : null,
          badgeType: 'info',
        },
        { name: 'Nhật ký kiểm toán', path: '/dashboard/audit-logs', icon: ScrollText },
        { name: 'Báo cáo SLA & Chi phí', path: '/dashboard/reports', icon: BarChart3 },
        { name: 'Cài đặt hệ thống', path: '/dashboard/settings', icon: Settings },
      ],
    },
  ];

  const handleItemClick = (path) => {
    if (onNavigate) {
      onNavigate(path);
    }
  };

  return (
    <aside
      className="dashboard-sidebar"
      style={{
        width: isSidebarCollapsed ? '72px' : '260px',
        minWidth: isSidebarCollapsed ? '72px' : '260px',
        backgroundColor: '#FFFFFF',
        borderRight: '1px solid var(--dash-border)',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        transition: 'width 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        overflowY: 'auto',
        overflowX: 'hidden',
        position: 'relative',
        zIndex: 30,
      }}
    >
      {/* Brand Header inside Sidebar */}
      <div
        style={{
          padding: isSidebarCollapsed ? '20px 14px' : '18px 20px',
          borderBottom: '1px solid var(--dash-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: isSidebarCollapsed ? 'center' : 'space-between',
          minHeight: '64px',
        }}
      >
        <div
          onClick={() => handleItemClick('/dashboard')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            cursor: 'pointer',
          }}
        >
          <div
            style={{
              width: '32px',
              height: '32px',
              backgroundColor: 'var(--dash-primary)',
              borderRadius: 'var(--dash-radius-md)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FFFFFF',
              flexShrink: 0,
              boxShadow: '0 2px 4px rgba(5, 150, 105, 0.25)',
            }}
          >
            <ShieldCheck size={18} strokeWidth={2.4} />
          </div>
          {!isSidebarCollapsed && (
            <div>
              <div style={{ fontWeight: 800, fontSize: '0.9375rem', color: 'var(--dash-text-primary)', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
                SelfHeal
              </div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', fontWeight: 500 }}>
                Bảng Vận Hành Hệ Thống
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Navigation Groups */}
      <div
        style={{
          padding: isSidebarCollapsed ? '12px 8px' : '16px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          flex: 1,
        }}
      >
        {navGroups.map((group, gIdx) => (
          <div key={gIdx}>
            {!isSidebarCollapsed && (
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
                const isActive = currentPath === item.path || (item.path !== '/dashboard' && currentPath.startsWith(item.path));

                return (
                  <button
                    key={iIdx}
                    onClick={() => handleItemClick(item.path)}
                    title={isSidebarCollapsed ? item.name : undefined}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: isSidebarCollapsed ? 'center' : 'space-between',
                      padding: isSidebarCollapsed ? '10px 0' : '8px 12px',
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <Icon
                        size={17}
                        strokeWidth={isActive ? 2.2 : 1.8}
                        style={{ color: isActive ? 'var(--dash-primary)' : 'var(--dash-text-secondary)', flexShrink: 0 }}
                      />
                      {!isSidebarCollapsed && <span>{item.name}</span>}
                    </div>

                    {!isSidebarCollapsed && item.badge && (
                      <span
                        style={{
                          fontSize: '0.6875rem',
                          fontWeight: 700,
                          padding: '1px 6px',
                          borderRadius: 'var(--dash-radius-full)',
                          backgroundColor:
                            item.badgeType === 'warning'
                              ? 'var(--dash-warning-bg)'
                              : item.badgeType === 'mint'
                              ? 'var(--dash-mint-100)'
                              : 'var(--dash-info-bg)',
                          color:
                            item.badgeType === 'warning'
                              ? 'var(--dash-warning-text)'
                              : item.badgeType === 'mint'
                              ? 'var(--dash-mint-600)'
                              : 'var(--dash-info-text)',
                          border:
                            item.badgeType === 'warning'
                              ? '1px solid var(--dash-warning-border)'
                              : item.badgeType === 'mint'
                              ? '1px solid var(--dash-mint-200)'
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

      {/* Collapse Toggle Footer */}
      <div
        style={{
          padding: '12px',
          borderTop: '1px solid var(--dash-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: isSidebarCollapsed ? 'center' : 'space-between',
        }}
      >
        {!isSidebarCollapsed && (
          <span style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)' }}>
            v1.4.2 &bull; Bản Doanh nghiệp SME
          </span>
        )}
        <button
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          title={isSidebarCollapsed ? 'Mở rộng thanh điều hướng' : 'Thu gọn thanh điều hướng'}
          style={{
            background: 'var(--dash-bg-subtle)',
            border: '1px solid var(--dash-border)',
            borderRadius: 'var(--dash-radius-md)',
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: 'var(--dash-text-secondary)',
          }}
        >
          {isSidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
