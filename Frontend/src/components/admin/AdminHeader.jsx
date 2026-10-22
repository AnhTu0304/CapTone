import React, { useState, useRef, useEffect } from 'react';
import { Menu, PanelLeftClose, PanelLeftOpen, Shield, ChevronDown, Check } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import AdminBreadcrumb from './AdminBreadcrumb';
import AdminNotificationButton from './AdminNotificationButton';
import AdminProfileMenu from './AdminProfileMenu';

export const AdminHeader = ({
  currentPath = '/admin',
  onNavigate,
  breadcrumbItems,
  isCollapsed = false,
  onToggleCollapse,
  onToggleMobileDrawer,
}) => {
  const { user, activeRole, switchRole, baseRole, availableRoles, canSwitchRole } = useAuth();
  const [isRoleDropdownOpen, setIsRoleDropdownOpen] = useState(false);
  const roleDropdownRef = useRef(null);

  const ADMIN_ROLES = [
    { key: 'SUPER_ADMIN', label: 'Quản Trị Tối Cao (Super Admin)', desc: 'Toàn quyền cấu hình, bảo mật và phân quyền hệ thống' },
    { key: 'ADMIN', label: 'Quản Trị Vận Hành (Admin)', desc: 'Vận hành AI, tác tử, hạ tầng và quản trị toàn diện hệ thống' },
    { key: 'SME_OWNER', label: 'Chủ Doanh Nghiệp (SME Owner)', desc: 'Toàn quyền trong phạm vi tổ chức doanh nghiệp' },
    { key: 'DEVOPS', label: 'Kỹ Sư DevOps (DevOps Lead)', desc: 'Vận hành kỹ thuật, không quản lý người dùng' },
    { key: 'VIEWER', label: 'Người Giám Sát (Viewer)', desc: 'Chỉ xem báo cáo và bàn điều khiển tổng quan' },
  ];

  const currentRoleKey = activeRole || (user?.system_roles?.includes('SUPER_ADMIN') ? 'SUPER_ADMIN' : 'ADMIN');
  const currentRoleObj = ADMIN_ROLES.find((r) => r.key === currentRoleKey) || ADMIN_ROLES[0];

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (roleDropdownRef.current && !roleDropdownRef.current.contains(e.target)) {
        setIsRoleDropdownOpen(false);
      }
    };
    if (isRoleDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isRoleDropdownOpen]);
  return (
    <header
      className="admin-top-header"
      style={{
        height: '64px',
        backgroundColor: '#FFFFFF',
        borderBottom: '1px solid var(--dash-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        flexShrink: 0,
        zIndex: 40,
        gap: '16px',
      }}
    >
      {/* Left: Sidebar Toggle + Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', minWidth: 0 }}>
        {/* Desktop / Tablet Collapse Toggle */}
        <button
          type="button"
          className="admin-desktop-toggle"
          aria-label={isCollapsed ? 'Mở rộng thanh điều hướng' : 'Thu gọn thanh điều hướng'}
          onClick={onToggleCollapse}
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '9px',
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
          {isCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        </button>

        {/* Mobile Hamburger Toggle */}
        <button
          type="button"
          className="admin-mobile-toggle"
          aria-label="Mở ngăn kéo điều hướng di động"
          onClick={onToggleMobileDrawer}
          style={{
            display: 'none', // Handled via CSS media query
            width: '36px',
            height: '36px',
            borderRadius: '9px',
            border: '1px solid var(--dash-border)',
            backgroundColor: '#FFFFFF',
            color: 'var(--dash-text-secondary)',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: 'var(--dash-shadow-xs)',
          }}
        >
          <Menu size={18} />
        </button>

        {/* Breadcrumb Navigation */}
        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          <AdminBreadcrumb
            items={breadcrumbItems}
            currentPath={currentPath}
            onNavigate={onNavigate}
          />
        </div>
      </div>

      {/* Right: Environment Badge + Notification + Profile Menu */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
        {/* Cluster / Env Indicator Badge */}
        <div
          className="admin-env-badge"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 12px',
            backgroundColor: 'var(--dash-bg-canvas)',
            border: '1px solid var(--dash-border)',
            borderRadius: '10px',
            fontSize: '0.75rem',
            fontFamily: 'var(--font-mono)',
            color: 'var(--dash-text-secondary)',
          }}
        >
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: '#10B981',
              boxShadow: '0 0 0 2px rgba(16, 185, 129, 0.2)',
            }}
          />
          <span style={{ fontWeight: 700, color: 'var(--dash-text-primary)' }}>
            {currentRoleKey === 'ADMIN' ? 'PROD CLUSTER-01' : 'PROD CLUSTER-01'}
          </span>
          <span style={{ color: 'var(--dash-text-muted)' }}>&bull;</span>
          <span style={{ color: '#059669', fontWeight: 600 }}>
            1.2ms
          </span>
        </div>

        {/* RBAC Role Switcher Dropdown (Mô phỏng chuyển đổi vai trò) */}
        <div ref={roleDropdownRef} style={{ position: 'relative' }}>
          <button
            type="button"
            aria-label="Chuyển đổi vai trò hệ thống"
            aria-expanded={isRoleDropdownOpen}
            onClick={() => setIsRoleDropdownOpen((prev) => !prev)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              backgroundColor: isRoleDropdownOpen ? 'var(--dash-mint-50)' : 'var(--dash-bg-canvas)',
              border: isRoleDropdownOpen ? '1px solid var(--dash-primary)' : '1px solid var(--dash-border)',
              borderRadius: '10px',
              color: 'var(--dash-text-primary)',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <Shield size={13} color="var(--dash-primary)" />
            <span>Vai trò: {currentRoleObj.label.split('(')[0].trim()}</span>
            <ChevronDown size={12} color="var(--dash-text-muted)" />
          </button>

          {isRoleDropdownOpen && (
            <div
              role="menu"
              style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                right: 0,
                width: '280px',
                backgroundColor: '#FFFFFF',
                border: '1px solid var(--dash-border)',
                borderRadius: '12px',
                boxShadow: 'var(--dash-shadow-dropdown)',
                padding: '6px',
                zIndex: 60,
                animation: 'fadeInSlide 0.15s ease',
              }}
            >
              <div style={{ padding: '6px 10px', fontSize: '0.6875rem', fontWeight: 700, color: 'var(--dash-text-muted)', textTransform: 'uppercase' }}>
                Chuyển Đổi Quyền Hệ Thống (RBAC)
              </div>
              {(availableRoles && availableRoles.length > 0 ? availableRoles : ADMIN_ROLES).map((r) => {
                const isSelected = r.key === currentRoleKey;
                return (
                  <button
                    key={r.key}
                    type="button"
                    onClick={() => {
                      switchRole(r.key);
                      setIsRoleDropdownOpen(false);
                      if ((r.key === 'SME_OWNER' || r.key === 'DEVOPS' || r.key === 'VIEWER') && onNavigate) {
                        onNavigate('/dashboard');
                      }
                    }}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      padding: '8px 10px',
                      borderRadius: '8px',
                      border: 'none',
                      backgroundColor: isSelected ? 'var(--dash-mint-50)' : 'transparent',
                      color: isSelected ? 'var(--dash-primary)' : 'var(--dash-text-primary)',
                      fontSize: '0.8125rem',
                      cursor: 'pointer',
                      textAlign: 'left',
                      marginBottom: '2px',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.backgroundColor = 'var(--dash-bg-subtle)';
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: isSelected ? 700 : 600 }}>{r.label}</div>
                      <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', marginTop: '2px' }}>{r.desc}</div>
                    </div>
                    {isSelected && <Check size={14} color="var(--dash-primary)" style={{ flexShrink: 0, marginTop: '2px' }} />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Global Notification Popover Button */}
        <AdminNotificationButton onNavigate={onNavigate} />

        {/* Admin Profile Dropdown Menu */}
        <AdminProfileMenu onNavigate={onNavigate} />
      </div>
    </header>
  );
};

export default AdminHeader;
