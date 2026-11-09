import React from 'react';
import {
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Bell,
} from 'lucide-react';
import { personalPortalService } from '../../services/personalPortalService';
import UserProfileDropdown from '../common/UserProfileDropdown';

export const PersonalHeader = ({
  currentPath = '/portal',
  onNavigate,
  isCollapsed = false,
  onToggleCollapse,
  onToggleMobileDrawer,
}) => {
  const notifs = personalPortalService.getNotifications();
  const unreadCount = notifs.filter((n) => !n.read).length;

  // Compute breadcrumb title based on path
  const getPageTitle = () => {
    if (currentPath.includes('/companies')) return 'Công Ty Của Tôi';
    if (currentPath.includes('/profile')) return 'Hồ Sơ Cá Nhân';
    if (currentPath.includes('/security')) return 'Bảo Mật Tài Khoản';
    if (currentPath.includes('/preferences')) return 'Tùy Chỉnh Cá Nhân (Preferences)';
    if (currentPath.includes('/notifications')) return 'Trung Tâm Thông Báo';
    if (currentPath.includes('/activity')) return 'Lịch Sử Hoạt Động';
    if (currentPath.includes('/help')) return 'Trợ Giúp & Hỗ Trợ (Help & Support)';
    return 'Bảng Điều Khiển Cá Nhân';
  };

  return (
    <header
      style={{
        height: '64px',
        backgroundColor: '#FFFFFF',
        borderBottom: '1px solid var(--dash-border, #E2E8F0)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        flexShrink: 0,
        zIndex: 40,
        gap: '16px',
      }}
    >
      {/* Left: Collapse Toggle + Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
        {/* Toggle Collapse */}
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-label={isCollapsed ? 'Mở rộng sidebar' : 'Thu gọn sidebar'}
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '9px',
            border: '1px solid var(--dash-border, #E2E8F0)',
            backgroundColor: '#FFFFFF',
            color: 'var(--dash-text-secondary, #475569)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          {isCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        </button>

        {/* Mobile Hamburger */}
        {onToggleMobileDrawer && (
          <button
            type="button"
            onClick={onToggleMobileDrawer}
            className="md:hidden"
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '9px',
              border: '1px solid #E2E8F0',
              backgroundColor: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <Menu size={18} />
          </button>
        )}

        {/* Breadcrumb Info */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: '#64748B' }}>
            <span>Không Gian Cá Nhân</span>
            <span>/</span>
            <span style={{ color: '#059669', fontWeight: 600 }}>{getPageTitle()}</span>
          </div>
          <div style={{ fontSize: '0.9375rem', fontWeight: 800, color: '#0F172A', lineHeight: 1.2 }}>
            {getPageTitle()}
          </div>
        </div>
      </div>

      {/* Right Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {/* Notifications Icon Button */}
        <button
          type="button"
          onClick={() => onNavigate && onNavigate('/portal/notifications')}
          title="Thông Báo Cá Nhân"
          style={{
            position: 'relative',
            width: '36px',
            height: '36px',
            borderRadius: '9px',
            border: '1px solid #E2E8F0',
            backgroundColor: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: '#475569',
          }}
        >
          <Bell size={18} />
          {unreadCount > 0 && (
            <span
              style={{
                position: 'absolute',
                top: '-3px',
                right: '-3px',
                backgroundColor: '#EF4444',
                color: '#FFFFFF',
                fontSize: '0.625rem',
                fontWeight: 800,
                width: '18px',
                height: '18px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 4px rgba(239, 68, 68, 0.4)',
              }}
            >
              {unreadCount}
            </span>
          )}
        </button>

        {/* Đồng bộ User Profile Dropdown chuẩn /admin */}
        <UserProfileDropdown onNavigate={onNavigate} />
      </div>
    </header>
  );
};

export default PersonalHeader;
