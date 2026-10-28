import React, { useState, useEffect } from 'react';
import { personalPortalService } from '../../services/personalPortalService';
import multiTabSync, { SYNC_EVENTS } from '../../services/multiTabSync';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard,
  Building2,
  UserCheck,
  ShieldCheck,
  Bell,
  History,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Sliders,
  LifeBuoy,
} from 'lucide-react';

export const PERSONAL_NAV_ITEMS = [
  {
    id: 'dashboard',
    label: 'Bảng Điều Khiển',
    path: '/portal',
    icon: LayoutDashboard,
    badge: null,
  },
  {
    id: 'companies',
    label: 'Company Của Tôi',
    path: '/portal/companies',
    icon: Building2,
    badge: null,
    badgeColor: '#059669',
  },
  {
    id: 'profile',
    label: 'Hồ Sơ Cá Nhân',
    path: '/portal/profile',
    icon: UserCheck,
    badge: null,
  },
  {
    id: 'security',
    label: 'Bảo Mật Tài Khoản',
    path: '/portal/security',
    icon: ShieldCheck,
    badge: '2FA',
    badgeColor: '#0284C7',
  },
  {
    id: 'preferences',
    label: 'Tùy Chỉnh Cá Nhân',
    path: '/portal/preferences',
    icon: Sliders,
    badge: null,
  },
  {
    id: 'notifications',
    label: 'Thông Báo',
    path: '/portal/notifications',
    icon: Bell,
    badge: null,
    badgeColor: '#EF4444',
  },
  {
    id: 'activity',
    label: 'Lịch Sử Hoạt Động',
    path: '/portal/activity',
    icon: History,
    badge: null,
  },
  {
    id: 'help',
    label: 'Trợ Giúp & Hỗ Trợ',
    path: '/portal/help',
    icon: LifeBuoy,
    badge: 'FAQ',
    badgeColor: '#8B5CF6',
  },
];

export const PersonalSidebar = ({
  currentPath = '/portal',
  onNavigate,
  isCollapsed = false,
  onToggleCollapse,
  companyCount: propCompanyCount,
}) => {
  const { user, isSuperAdmin, isAdmin } = useAuth();
  const canAccessAdmin = (isSuperAdmin && isSuperAdmin(user)) || (isAdmin && isAdmin(user));
  const [hoveredItem, setHoveredItem] = useState(null);

  const [companyCount, setCompanyCount] = useState(() => {
    const list = personalPortalService.getMyCompanies();
    return Array.isArray(list) ? list.length : 0;
  });
  const [unreadNotifCount, setUnreadNotifCount] = useState(() => {
    const notifs = personalPortalService.getNotifications();
    return Array.isArray(notifs) ? notifs.filter((n) => !n.read).length : 0;
  });

  useEffect(() => {
    let isMounted = true;

    const refreshCounts = async () => {
      try {
        const comps = await personalPortalService.fetchMyCompanies();
        if (isMounted && Array.isArray(comps)) {
          setCompanyCount(comps.length);
        }
      } catch {
        if (isMounted) {
          const cached = personalPortalService.getMyCompanies();
          setCompanyCount(Array.isArray(cached) ? cached.length : 0);
        }
      }

      if (isMounted) {
        const notifs = personalPortalService.getNotifications();
        setUnreadNotifCount(Array.isArray(notifs) ? notifs.filter((n) => !n.read).length : 0);
      }
    };

    refreshCounts();

    const unsubSync = multiTabSync.subscribe(SYNC_EVENTS.ORG_SWITCHED, () => {
      refreshCounts();
    });

    const handleLocalChange = () => {
      const list = personalPortalService.getMyCompanies();
      setCompanyCount(Array.isArray(list) ? list.length : 0);
    };

    const handleStorage = (e) => {
      if (
        !e.key ||
        e.key === 'selfheal_personal_companies_v1' ||
        e.key === 'selfheal_personal_notifications_v1'
      ) {
        handleLocalChange();
      }
    };

    window.addEventListener('selfheal_companies_changed', handleLocalChange);
    window.addEventListener('storage', handleStorage);

    return () => {
      isMounted = false;
      unsubSync();
      window.removeEventListener('selfheal_companies_changed', handleLocalChange);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  const effectiveCompanyCount =
    typeof propCompanyCount === 'number' ? propCompanyCount : companyCount;

  const getItemBadge = (item) => {
    if (item.id === 'companies') {
      return String(effectiveCompanyCount);
    }
    if (item.id === 'notifications') {
      return unreadNotifCount > 0 ? String(unreadNotifCount) : null;
    }
    return item.badge;
  };

  const isActive = (itemPath) => {
    const normCurrent = currentPath.toLowerCase().split('?')[0].split('#')[0];
    const normTarget = itemPath.toLowerCase();

    if (normTarget === '/portal') {
      return normCurrent === '/portal' || normCurrent === '/portal/dashboard';
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
      aria-label="Thanh điều hướng Tầng Cá Nhân"
      style={{
        width: isCollapsed ? '72px' : '260px',
        height: '100%',
        backgroundColor: '#FFFFFF',
        borderRight: '1px solid var(--dash-border, #E2E8F0)',
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
          borderBottom: '1px solid var(--dash-border, #E2E8F0)',
          overflow: 'hidden',
          whiteSpace: 'nowrap',
        }}
      >
        <div
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #059669 0%, #10B981 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            boxShadow: '0 2px 8px rgba(5, 150, 105, 0.3)',
          }}
        >
          <Sparkles size={20} color="#ECFDF5" />
        </div>

        {!isCollapsed && (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div
              style={{
                fontSize: '0.9375rem',
                fontWeight: 800,
                color: 'var(--dash-text-primary, #0F172A)',
                letterSpacing: '-0.02em',
                lineHeight: 1.2,
              }}
            >
              SelfAI <span style={{ color: '#059669' }}>User</span>
            </div>
            <div
              style={{
                fontSize: '0.6875rem',
                color: '#059669',
                fontFamily: 'var(--font-mono, monospace)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                fontWeight: 700,
              }}
            >
              Không Gian Cá Nhân
            </div>
          </div>
        )}
      </div>

      {/* Nav List */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          padding: isCollapsed ? '14px 8px' : '16px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
        }}
      >
        {!isCollapsed && (
          <div
            style={{
              fontSize: '0.6875rem',
              fontWeight: 700,
              color: 'var(--dash-text-muted, #64748B)',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              padding: '6px 10px 4px 10px',
            }}
          >
            Chức Năng Cá Nhân
          </div>
        )}

        {PERSONAL_NAV_ITEMS.map((item) => {
          const active = isActive(item.path);
          const ItemIcon = item.icon;
          const isHovered = hoveredItem === item.id;
          const itemBadge = getItemBadge(item);

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
                    ? 'var(--dash-bg-subtle, #F1F5F9)'
                    : 'transparent',
                  color: active ? '#065F46' : isHovered ? '#0F172A' : '#475569',
                  cursor: 'pointer',
                  position: 'relative',
                  transition: 'all 0.15s ease',
                  fontWeight: active ? 700 : 500,
                  fontSize: '0.8125rem',
                  outline: 'none',
                  whiteSpace: 'nowrap',
                }}
              >
                {/* Active Indicator Bar */}
                {active && (
                  <span
                    style={{
                      position: 'absolute',
                      left: isCollapsed ? '3px' : '0',
                      top: '8px',
                      bottom: '8px',
                      width: '3px',
                      borderRadius: '9999px',
                      backgroundColor: '#059669',
                    }}
                  />
                )}

                {/* Icon */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: active ? '#059669' : isHovered ? '#0F172A' : '#64748B',
                    flexShrink: 0,
                  }}
                >
                  <ItemIcon size={18} />
                </div>

                {/* Label */}
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
                {!isCollapsed && itemBadge !== null && itemBadge !== undefined && (
                  <span
                    data-testid={`badge-${item.id}`}
                    style={{
                      backgroundColor:
                        item.id === 'companies' && effectiveCompanyCount === 0
                          ? '#64748B'
                          : item.badgeColor || '#059669',
                      color: '#FFFFFF',
                      fontSize: '0.6875rem',
                      fontWeight: 700,
                      padding: '1px 7px',
                      borderRadius: '9999px',
                      fontFamily: 'var(--font-mono, monospace)',
                    }}
                  >
                    {itemBadge}
                  </span>
                )}
              </button>
            </div>
          );
        })}

        {/* Switch Space Divider & Links */}
        <div style={{ margin: '12px 10px 4px', borderTop: '1px solid #E2E8F0' }} />

        {!isCollapsed && (
          <div
            style={{
              padding: '6px 14px 2px',
              fontSize: '0.6875rem',
              fontWeight: 700,
              color: '#94A3B8',
              letterSpacing: '0.04em',
            }}
          >
            CHUYỂN KHÔNG GIAN
          </div>
        )}

        <div style={{ padding: '0 8px' }}>
          <button
            type="button"
            onClick={(e) => handleItemClick(e, '/dashboard')}
            title="Bàn Điều Khiển Doanh Nghiệp (Dashboard)"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              width: '100%',
              padding: isCollapsed ? '10px 0' : '9px 12px',
              justifyContent: isCollapsed ? 'center' : 'flex-start',
              borderRadius: '9px',
              border: 'none',
              backgroundColor: 'transparent',
              color: '#334155',
              fontSize: '0.8125rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#F0FDF4';
              e.currentTarget.style.color = '#059669';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = '#334155';
            }}
          >
            <LayoutDashboard size={18} color="#059669" />
            {!isCollapsed && <span>Về Dashboard</span>}
          </button>

          {canAccessAdmin && (
            <button
              type="button"
              onClick={(e) => handleItemClick(e, '/admin')}
              title="Cổng Quản Trị Hệ Thống (Admin)"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                width: '100%',
                marginTop: '2px',
                padding: isCollapsed ? '10px 0' : '9px 12px',
                justifyContent: isCollapsed ? 'center' : 'flex-start',
                borderRadius: '9px',
                border: 'none',
                backgroundColor: 'transparent',
                color: '#334155',
                fontSize: '0.8125rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#F5F3FF';
                e.currentTarget.style.color = '#7C3AED';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = '#334155';
              }}
            >
              <Building2 size={18} color="#7C3AED" />
              {!isCollapsed && <span>Cổng Quản Trị</span>}
            </button>
          )}
        </div>
      </div>

      {/* Sidebar Footer / Collapse Toggle */}
      {onToggleCollapse && (
        <div
          style={{
            padding: isCollapsed ? '12px 8px' : '12px 14px',
            borderTop: '1px solid var(--dash-border, #E2E8F0)',
            backgroundColor: 'var(--dash-bg-canvas, #F8FAFC)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: isCollapsed ? 'center' : 'space-between',
          }}
        >
          {!isCollapsed && (
            <span
              style={{
                fontSize: '0.6875rem',
                color: 'var(--dash-text-muted, #64748B)',
                fontFamily: 'var(--font-mono, monospace)',
                fontWeight: 600,
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
              border: '1px solid var(--dash-border, #CBD5E1)',
              backgroundColor: '#FFFFFF',
              color: 'var(--dash-text-secondary, #475569)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>
      )}
    </aside>
  );
};

export default PersonalSidebar;
