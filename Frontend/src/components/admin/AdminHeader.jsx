import React from 'react';
import { Menu, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
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
            PROD CLUSTER-01
          </span>
          <span style={{ color: 'var(--dash-text-muted)' }}>&bull;</span>
          <span style={{ color: '#059669', fontWeight: 600 }}>1.2ms</span>
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
