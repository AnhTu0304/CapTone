import React, { useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard,
  Activity,
  AlertTriangle,
  Layers,
  ShieldAlert,
  Users,
  Settings,
  ChevronLeft,
  ChevronRight,
  Shield,
  Building2,
  BrainCircuit,
  ShieldCheck,
  Bot,
  FileCode,
  Bell,
  TrendingUp,
  UserCheck,
  Server,
  Box,
  Sparkles,
  GitFork,
  Zap,
  History,
  CheckCircle2,
} from 'lucide-react';

export const SME_OWNER_NAV_GROUPS = [
  {
    id: 'overview',
    title: 'TỔNG QUAN',
    items: [
      {
        id: 'dashboard',
        label: 'Bảng điều khiển',
        path: '/dashboard',
        icon: LayoutDashboard,
      },
    ],
  },
  {
    id: 'organization',
    title: 'TỔ CHỨC DOANH NGHIỆP',
    items: [
      {
        id: 'org-info',
        label: 'Thông tin Tổ chức',
        path: '/dashboard/organization',
        icon: Building2,
      },
      {
        id: 'members',
        label: 'Thành viên & Phân quyền',
        path: '/dashboard/organization/members',
        icon: Users,
      },
    ],
  },
  {
    id: 'infra-agents',
    title: 'HẠ TẦNG & TÁC TỬ',
    items: [
      {
        id: 'agents',
        label: 'Tác tử Agent',
        path: '/dashboard/agents',
        icon: Bot,
      },
      {
        id: 'clusters',
        label: 'Cụm K8s',
        path: '/dashboard/clusters',
        icon: Layers,
      },
      {
        id: 'infra',
        label: 'Hạ tầng máy chủ',
        path: '/dashboard/infrastructure',
        icon: Server,
      },
      {
        id: 'workloads',
        label: 'Khối lượng công việc',
        path: '/dashboard/workloads',
        icon: Box,
      },
    ],
  },
  {
    id: 'monitoring',
    title: 'GIÁM SÁT TÀI NGUYÊN',
    items: [
      {
        id: 'metrics',
        label: 'Chỉ số tài nguyên',
        path: '/dashboard/monitoring/metrics',
        icon: Activity,
        badge: 'LIVE',
        badgeColor: '#059669',
      },
      {
        id: 'logs',
        label: 'Nhật ký container',
        path: '/dashboard/monitoring/logs',
        icon: FileCode,
      },
      {
        id: 'events',
        label: 'Sự kiện K8s',
        path: '/dashboard/monitoring/events',
        icon: AlertTriangle,
      },
    ],
  },
  {
    id: 'ai-incidents',
    title: 'AI & SỰ CỐ',
    items: [
      {
        id: 'predictions',
        label: 'Dự báo rủi ro AI',
        path: '/dashboard/ai/predictions',
        icon: Sparkles,
        badge: '1',
        badgeColor: '#059669',
      },
      {
        id: 'incidents',
        label: 'Quản lý sự cố',
        path: '/dashboard/incidents',
        icon: AlertTriangle,
      },
      {
        id: 'rca',
        label: 'Phân tích nguyên nhân (RCA)',
        path: '/dashboard/incidents/rca',
        icon: GitFork,
      },
    ],
  },
  {
    id: 'self-healing',
    title: 'TỰ PHỤC HỒI & PHÊ DUYỆT',
    items: [
      {
        id: 'actions',
        label: 'Hành động tự sửa',
        path: '/dashboard/self-healing/actions',
        icon: Zap,
      },
      {
        id: 'history',
        label: 'Lịch sử phục hồi',
        path: '/dashboard/self-healing/history',
        icon: History,
      },
      {
        id: 'policies',
        label: 'Chính sách tự động',
        path: '/dashboard/self-healing/policies',
        icon: ShieldAlert,
      },
      {
        id: 'approvals',
        label: 'Cổng phê duyệt (HITL)',
        path: '/dashboard/self-healing/approvals',
        icon: CheckCircle2,
      },
    ],
  },
  {
    id: 'system',
    title: 'HỆ THỐNG & BÁO CÁO',
    items: [
      {
        id: 'notifications',
        label: 'Thông báo',
        path: '/dashboard/notifications',
        icon: Bell,
      },
      {
        id: 'reports',
        label: 'Báo cáo SLA & Chi phí',
        path: '/dashboard/reports',
        icon: TrendingUp,
      },
      {
        id: 'audit-logs',
        label: 'Nhật ký kiểm toán',
        path: '/dashboard/audit-logs',
        icon: ShieldCheck,
      },
      {
        id: 'profile',
        label: 'Hồ sơ cá nhân',
        path: '/portal/profile',
        icon: UserCheck,
      },
      {
        id: 'settings',
        label: 'Cài đặt hệ thống',
        path: '/dashboard/settings',
        icon: Settings,
      },
    ],
  },
];

export const ADMIN_ROLE_NAV_GROUPS = [
  {
    id: 'overview',
    title: 'TỔNG QUAN WEBSITE',
    items: [
      {
        id: 'dashboard',
        label: 'Bảng Điều Khiển',
        path: '/admin',
        icon: LayoutDashboard,
      },
    ],
  },
  {
    id: 'management',
    title: 'QUẢN LÝ DOANH NGHIỆP & NGƯỜI DÙNG',
    items: [
      {
        id: 'users',
        label: 'Quản Lý Người Dùng',
        path: '/admin/users',
        icon: Users,
      },
      {
        id: 'companies',
        label: 'Quản Lý Doanh Nghiệp',
        path: '/admin/companies',
        icon: Building2,
      },
    ],
  },
  {
    id: 'monitoring-analytics',
    title: 'HOẠT ĐỘNG, BÁO CÁO & THÔNG BÁO',
    items: [
      {
        id: 'user-activity',
        label: 'Hoạt Động Người Dùng',
        path: '/admin/activity',
        icon: Activity,
      },
      {
        id: 'notifications',
        label: 'Phát Thông Báo Toàn Mạng',
        path: '/admin/notifications',
        icon: Bell,
      },
      {
        id: 'reports',
        label: 'Báo Cáo & Thống Kê',
        path: '/admin/analytics',
        icon: TrendingUp,
      },
      {
        id: 'audit-logs',
        label: 'Nhật Ký Kiểm Toán',
        path: '/admin/audit-logs',
        icon: ShieldAlert,
      },
    ],
  },
];

export const ADMIN_NAV_GROUPS = [
  {
    id: 'overview',
    title: 'TỔNG QUAN HỆ THỐNG',
    items: [
      {
        id: 'dashboard',
        label: 'Bảng Điều Khiển',
        path: '/admin',
        icon: LayoutDashboard,
      },
    ],
  },
  {
    id: 'companies-users',
    title: 'DOANH NGHIỆP & PHÂN QUYỀN',
    items: [
      {
        id: 'companies',
        label: 'Quản Lý Doanh Nghiệp',
        path: '/admin/companies',
        icon: Building2,
      },
      {
        id: 'users',
        label: 'Quản Lý Người Dùng',
        path: '/admin/users',
        icon: Users,
      },
      {
        id: 'user-activity',
        label: 'Hoạt Động Người Dùng',
        path: '/admin/activity',
        icon: Activity,
      },
      {
        id: 'roles',
        label: 'Vai Trò & Phân Quyền',
        path: '/admin/roles',
        icon: ShieldCheck,
      },
      {
        id: 'reports',
        label: 'Báo Cáo & Thống Kê',
        path: '/admin/analytics',
        icon: TrendingUp,
      },
    ],
  },
  {
    id: 'agents-clusters',
    title: 'TÁC TỬ & HẠ TẦNG NỀN TẢNG',
    items: [
      {
        id: 'agents',
        label: 'Quản Lý Tác Tử',
        path: '/admin/agents',
        icon: Bot,
      },
      {
        id: 'clusters',
        label: 'Tổng Quan Cụm K8s',
        path: '/admin/clusters',
        icon: Layers,
      },
    ],
  },
  {
    id: 'ai-monitoring',
    title: 'VẬN HÀNH AI & HỆ THỐNG',
    items: [
      {
        id: 'ai-models',
        label: 'Quản Trị Mô Hình AI',
        path: '/admin/ai/models',
        icon: BrainCircuit,
      },
      {
        id: 'monitoring',
        label: 'Giám Sát Hệ Thống',
        path: '/admin/monitoring',
        icon: Activity,
      },
      {
        id: 'alerts',
        label: 'Sự Cố & Cảnh Báo',
        path: '/admin/alerts',
        icon: AlertTriangle,
        badge: 'Cảnh báo',
        badgeColor: '#EF4444',
      },
      {
        id: 'system-logs',
        label: 'Nhật Ký Hệ Thống',
        path: '/admin/system-logs',
        icon: FileCode,
      },
    ],
  },
  {
    id: 'security-settings',
    title: 'AN NINH & CẤU HÌNH',
    items: [
      {
        id: 'audit-logs',
        label: 'Nhật Ký Kiểm Toán',
        path: '/admin/audit-logs',
        icon: ShieldAlert,
      },
      {
        id: 'notifications',
        label: 'Phát Thông Báo Toàn Mạng',
        path: '/admin/notifications',
        icon: Bell,
      },
      {
        id: 'settings',
        label: 'Cài Đặt Hệ Thống',
        path: '/admin/settings',
        icon: Settings,
      },
    ],
  },
];

export const AdminSidebar = ({
  currentPath = '/admin',
  onNavigate,
  isCollapsed = false,
  onToggleCollapse,
}) => {
  const [hoveredItem, setHoveredItem] = useState(null);

  // Phân quyền hiển thị thanh điều hướng theo vai trò (RBAC)
  const auth = useAuth();

  const user = auth?.user || null;
  const isViewerUser = auth?.isViewer ? auth.isViewer(user) : false;
  const isDevOpsUser = auth?.isDevOps ? auth.isDevOps(user) : false;

  const displayNavGroups = useMemo(() => {
    // 1. Viewer: CHỈ thấy Bàn điều khiển tổng quan (/admin)
    if (isViewerUser) {
      return [
        {
          id: 'overview',
          title: 'TỔNG QUAN HỆ THỐNG',
          items: [
            {
              id: 'dashboard',
              label: 'Bảng Điều Khiển',
              path: '/admin',
              icon: LayoutDashboard,
            },
          ],
        },
      ];
    }

    // 2. DevOps: Không quản lý User & Phân quyền hệ thống, ẩn Cài đặt hệ thống & Tổ chức
    if (isDevOpsUser) {
      return ADMIN_NAV_GROUPS
        .filter((group) => group.id !== 'companies-users')
        .map((group) => {
          if (group.id === 'security-settings') {
            return {
              ...group,
              items: group.items.filter((item) => item.id !== 'settings'),
            };
          }
          return group;
        });
    }

    // 3. ADMIN: Quản trị và vận hành toàn hệ thống như Super Admin (Tác tử, Hạ tầng, AI, Giám sát, Dashboard), ngoại trừ Quản lý Phân quyền (Roles & Permissions) và Cấu hình Hệ thống (System Settings)
    if (auth?.activeRole === 'ADMIN') {
      return ADMIN_NAV_GROUPS.map((group) => {
        if (group.id === 'companies-users') {
          return {
            ...group,
            items: group.items.filter((item) => item.id !== 'roles'),
          };
        }
        if (group.id === 'security-settings') {
          return {
            ...group,
            items: group.items.filter((item) => item.id !== 'settings'),
          };
        }
        return group;
      });
    }

    // 4. SME_OWNER: Quản trị theo mô hình bên User (Tổ chức, Thành viên & Phân quyền, Tác tử, Cụm K8s, Giám sát, AI & Sự cố, Tự phục hồi)
    if (auth?.activeRole === 'SME_OWNER') {
      return SME_OWNER_NAV_GROUPS;
    }

    // 5. SUPER_ADMIN: Xem toàn bộ các nhóm chức năng hạ tầng, AI, K8s và Phân quyền Roles
    return ADMIN_NAV_GROUPS;
  }, [isViewerUser, isDevOpsUser, auth?.activeRole]);

  const isActive = (itemPath) => {
    const normCurrent = currentPath.toLowerCase().split('?')[0].split('#')[0];
    const normTarget = itemPath.toLowerCase();

    if (normTarget === '/admin') {
      return normCurrent === '/admin' || normCurrent === '/admin/overview';
    }
    if (normTarget === '/admin/companies') {
      return (
        normCurrent === '/admin/companies' ||
        normCurrent === '/admin/organizations' ||
        normCurrent.startsWith('/admin/companies/') ||
        normCurrent.startsWith('/admin/organizations/')
      );
    }
    if (normTarget === '/admin/agents') {
      return normCurrent === '/admin/agents' || normCurrent === '/admin/infrastructure/agents';
    }
    if (normTarget === '/admin/clusters') {
      return normCurrent === '/admin/clusters' || normCurrent === '/admin/infrastructure/clusters';
    }
    if (normTarget === '/admin/ai/models') {
      return normCurrent.startsWith('/admin/ai');
    }
    if (normTarget === '/admin/alerts') {
      return normCurrent === '/admin/alerts' || normCurrent.startsWith('/admin/incidents');
    }
    return normCurrent === normTarget || normCurrent.startsWith(`${normTarget}/`);
  };

  const handleItemClick = (e, path) => {
    e.preventDefault();
    if (onNavigate) {
      onNavigate(path);
    }
  };

  return (
    <aside
      aria-label="Thanh điều hướng bên Admin"
      style={{
        width: isCollapsed ? '72px' : '260px',
        height: '100%',
        backgroundColor: '#FFFFFF',
        borderRight: '1px solid var(--dash-border)',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        position: 'relative',
        zIndex: 50,
        userSelect: 'none',
        flexShrink: 0,
      }}
    >
      {/* Brand / Logo Area */}
      <div
        style={{
          height: '64px',
          padding: isCollapsed ? '0 16px' : '0 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: isCollapsed ? 'center' : 'flex-start',
          gap: '12px',
          borderBottom: '1px solid var(--dash-border)',
          overflow: 'hidden',
          whiteSpace: 'nowrap',
        }}
      >
        <div
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #065F46 0%, #059669 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            boxShadow: '0 2px 6px rgba(5, 150, 105, 0.3)',
          }}
        >
          <Shield size={20} color="#A7F3D0" />
        </div>

        {!isCollapsed && (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div
              style={{
                fontSize: '0.9375rem',
                fontWeight: 800,
                color: 'var(--dash-text-primary)',
                letterSpacing: '-0.02em',
                lineHeight: 1.2,
              }}
            >
              SelfAI <span style={{ color: 'var(--dash-primary)' }}>Admin</span>
            </div>
            <div
              style={{
                fontSize: '0.6875rem',
                color: auth?.activeRole === 'ADMIN' ? '#059669' : auth?.activeRole === 'SME_OWNER' ? '#059669' : 'var(--dash-text-muted)',
                fontFamily: 'var(--font-mono)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                fontWeight: (auth?.activeRole === 'ADMIN' || auth?.activeRole === 'SME_OWNER') ? 700 : 400,
              }}
            >
              {auth?.activeRole === 'ADMIN'
                ? 'Vận Hành Nền Tảng'
                : auth?.activeRole === 'SME_OWNER'
                ? 'Cổng Doanh Nghiệp'
                : auth?.activeRole === 'DEVOPS'
                ? 'Kỹ Sư Hạ Tầng DevOps'
                : auth?.activeRole === 'VIEWER'
                ? 'Người Giám Sát'
                : 'Tối Cao Toàn Nền Tảng'}
            </div>
          </div>
        )}
      </div>

      {/* Nav List / Grouped Navigation */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          padding: isCollapsed ? '12px 8px' : '16px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: isCollapsed ? '16px' : '20px',
        }}
      >
        {displayNavGroups.map((group) => (
          <div key={group.id} style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            {/* Group Title */}
            {isCollapsed ? (
              <div
                style={{
                  height: '1px',
                  backgroundColor: 'var(--dash-border)',
                  margin: '4px 6px',
                }}
              />
            ) : (
              <div
                style={{
                  fontSize: '0.6875rem',
                  fontWeight: 700,
                  color: 'var(--dash-text-muted)',
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  padding: '4px 10px 6px 10px',
                  whiteSpace: 'nowrap',
                }}
              >
                {group.title}
              </div>
            )}

            {/* Group Items */}
            {group.items.map((item) => {
              const active = isActive(item.path);
              const ItemIcon = item.icon;
              const isHovered = hoveredItem === item.id;

              return (
                <div
                  key={item.id}
                  style={{ position: 'relative' }}
                  onMouseEnter={() => setHoveredItem(item.id)}
                  onMouseLeave={() => setHoveredItem(null)}
                >
                  <button
                    type="button"
                    onClick={(e) => handleItemClick(e, item.path)}
                    aria-current={active ? 'page' : undefined}
                    aria-label={item.label}
                    title={isCollapsed ? item.label : undefined}
                    style={{
                      width: '100%',
                      height: '40px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: isCollapsed ? 'center' : 'flex-start',
                      gap: '12px',
                      padding: isCollapsed ? '0' : '0 12px',
                      borderRadius: '10px',
                      border: 'none',
                      backgroundColor: active
                        ? 'rgba(5, 150, 105, 0.1)'
                        : isHovered
                        ? 'var(--dash-bg-subtle)'
                        : 'transparent',
                      color: active ? '#065F46' : isHovered ? 'var(--dash-text-primary)' : 'var(--dash-text-secondary)',
                      cursor: 'pointer',
                      position: 'relative',
                      transition: 'all 0.15s ease',
                      fontWeight: active ? 700 : 500,
                      fontSize: '0.8125rem',
                      outline: 'none',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {/* Active Left Indicator Bar */}
                    {active && (
                      <span
                        style={{
                          position: 'absolute',
                          left: isCollapsed ? '3px' : '0',
                          top: '8px',
                          bottom: '8px',
                          width: '3px',
                          borderRadius: '9999px',
                          backgroundColor: 'var(--dash-primary)',
                        }}
                      />
                    )}

                    {/* Icon */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: active ? 'var(--dash-primary)' : isHovered ? 'var(--dash-text-primary)' : 'var(--dash-text-secondary)',
                        flexShrink: 0,
                      }}
                    >
                      <ItemIcon size={18} />
                    </div>

                    {/* Label (when expanded) */}
                    {!isCollapsed && (
                      <span
                        style={{
                          flex: 1,
                          textAlign: 'left',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {item.label}
                      </span>
                    )}

                    {/* Badge */}
                    {!isCollapsed && item.badge && (
                      <span
                        style={{
                          backgroundColor: item.badgeColor || 'var(--dash-primary)',
                          color: '#FFFFFF',
                          fontSize: '0.6875rem',
                          fontWeight: 700,
                          padding: '1px 7px',
                          borderRadius: '9999px',
                          fontFamily: 'var(--font-mono)',
                        }}
                      >
                        {item.badge}
                      </span>
                    )}

                    {/* Dot Indicator for Badge in Collapsed mode */}
                    {isCollapsed && item.badge && (
                      <span
                        style={{
                          position: 'absolute',
                          top: '6px',
                          right: '12px',
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          backgroundColor: item.badgeColor || 'var(--dash-primary)',
                        }}
                      />
                    )}
                  </button>

                  {/* Tooltip when collapsed */}
                  {isCollapsed && isHovered && (
                    <div
                      role="tooltip"
                      style={{
                        position: 'fixed',
                        left: '80px',
                        transform: 'translateY(-50%)',
                        backgroundColor: '#0F172A',
                        color: '#FFFFFF',
                        padding: '6px 12px',
                        borderRadius: '8px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                        zIndex: 9999,
                        boxShadow: '0 4px 12px rgba(15, 23, 42, 0.3)',
                        pointerEvents: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        animation: 'fadeInSlide 0.15s ease-out',
                      }}
                    >
                      <span>{item.label}</span>
                      {item.badge && (
                        <span
                          style={{
                            backgroundColor: item.badgeColor || 'var(--dash-primary)',
                            color: '#FFFFFF',
                            fontSize: '0.625rem',
                            fontWeight: 700,
                            padding: '1px 5px',
                            borderRadius: '9999px',
                            fontFamily: 'var(--font-mono)',
                          }}
                        >
                          {item.badge}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Sidebar Footer / Collapse Toggle */}
      {onToggleCollapse && (
        <div
          style={{
            padding: isCollapsed ? '12px 8px' : '12px 14px',
            borderTop: '1px solid var(--dash-border)',
            backgroundColor: 'var(--dash-bg-canvas)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: isCollapsed ? 'center' : 'space-between',
          }}
        >
          {!isCollapsed && (
            <span
              style={{
                fontSize: '0.6875rem',
                color: 'var(--dash-text-muted)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              THU GỌN SIDEBAR
            </span>
          )}

          <button
            type="button"
            aria-label={isCollapsed ? 'Mở rộng sidebar' : 'Thu gọn sidebar'}
            onClick={onToggleCollapse}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              border: '1px solid var(--dash-border)',
              backgroundColor: '#FFFFFF',
              color: 'var(--dash-text-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              boxShadow: 'var(--dash-shadow-xs)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#CBD5E1';
              e.currentTarget.style.backgroundColor = 'var(--dash-bg-subtle)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--dash-border)';
              e.currentTarget.style.backgroundColor = '#FFFFFF';
            }}
          >
            {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>
      )}
    </aside>
  );
};

export default AdminSidebar;
