import React, { useState } from 'react';
import {
  LayoutDashboard,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Zap,
  Layers,
  Server,
  Box,
  ShieldAlert,
  FileBarChart2,
  Users,
  Settings,
  ChevronLeft,
  ChevronRight,
  Shield,
  Building2,
} from 'lucide-react';

export const ADMIN_NAV_GROUPS = [
  {
    id: 'overview',
    title: 'TỔNG QUAN HỆ THỐNG',
    items: [
      {
        id: 'dashboard',
        label: 'Bàn Điều Khiển',
        path: '/admin',
        icon: LayoutDashboard,
      },
      {
        id: 'agents',
        label: 'Sức Khỏe Tác Tử eBPF',
        path: '/admin/agents',
        icon: Activity,
        badge: '100%',
        badgeColor: '#10B981',
      },
    ],
  },
  {
    id: 'self-healing',
    title: 'TỰ LÀNH & HITL GATE',
    items: [
      {
        id: 'approvals',
        label: 'Cổng Phê Duyệt HITL',
        path: '/admin/approvals',
        icon: CheckCircle2,
        badge: '1',
        badgeColor: '#EF4444',
      },
      {
        id: 'incidents',
        label: 'Sự Cố & Điều Tra RCA',
        path: '/admin/incidents',
        icon: AlertTriangle,
      },
      {
        id: 'policies',
        label: 'Chính Sách Tự Lành',
        path: '/admin/policies',
        icon: Zap,
      },
    ],
  },
  {
    id: 'infrastructure',
    title: 'QUẢN TRỊ HẠ TẦNG K8S',
    items: [
      {
        id: 'clusters',
        label: 'Cụm Kubernetes',
        path: '/admin/clusters',
        icon: Layers,
      },
      {
        id: 'nodes',
        label: 'Hạ Tầng Máy Chủ (Nodes)',
        path: '/admin/nodes',
        icon: Server,
      },
      {
        id: 'workloads',
        label: 'Khối Công Việc (Workloads)',
        path: '/admin/workloads',
        icon: Box,
      },
    ],
  },
  {
    id: 'governance',
    title: 'BẢO MẬT & KIỂM TOÁN',
    items: [
      {
        id: 'audit-logs',
        label: 'Nhật Ký Kiểm Toán SHA-256',
        path: '/admin/audit-logs',
        icon: ShieldAlert,
      },
      {
        id: 'reports',
        label: 'Báo Cáo SLA & Chi Phí',
        path: '/admin/reports',
        icon: FileBarChart2,
      },
    ],
  },
  {
    id: 'settings',
    title: 'CẤU HÌNH & TỔ CHỨC',
    items: [
      {
        id: 'organizations',
        label: 'Tổ Chức & Tenants',
        path: '/admin/organizations',
        icon: Building2,
      },
      {
        id: 'members',
        label: 'Thành Viên & Ma Trận RBAC',
        path: '/admin/members',
        icon: Users,
      },
      {
        id: 'settings',
        label: 'Thiết Lập Quản Trị',
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

  const isActive = (itemPath) => {
    const normCurrent = currentPath.toLowerCase().split('?')[0].split('#')[0];
    const normTarget = itemPath.toLowerCase();

    if (normTarget === '/admin') {
      return normCurrent === '/admin' || normCurrent === '/admin/overview';
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
              SelfHeal <span style={{ color: 'var(--dash-primary)' }}>Admin</span>
            </div>
            <div
              style={{
                fontSize: '0.6875rem',
                color: 'var(--dash-text-muted)',
                fontFamily: 'var(--font-mono)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              K8s Autonomous Shell
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
        {ADMIN_NAV_GROUPS.map((group) => (
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
