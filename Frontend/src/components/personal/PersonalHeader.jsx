import React, { useState, useRef, useEffect } from 'react';
import {
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Building2,
  ChevronDown,
  Bell,
  User,
  ShieldCheck,
  LogOut,
  LayoutDashboard,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { personalPortalService } from '../../services/personalPortalService';

export const PersonalHeader = ({
  currentPath = '/portal',
  onNavigate,
  isCollapsed = false,
  onToggleCollapse,
  onToggleMobileDrawer,
}) => {
  const { user, logout, isSuperAdmin, isAdmin } = useAuth();
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const profileDropdownRef = useRef(null);

  const notifs = personalPortalService.getNotifications();
  const unreadCount = notifs.filter((n) => !n.read).length;

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(e.target)) {
        setIsProfileDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Compute breadcrumb title based on path
  const getPageTitle = () => {
    if (currentPath.includes('/companies')) return 'Company Của Tôi';
    if (currentPath.includes('/profile')) return 'Hồ Sơ Cá Nhân';
    if (currentPath.includes('/security')) return 'Bảo Mật Tài Khoản';
    if (currentPath.includes('/preferences')) return 'Tùy Chỉnh Cá Nhân (Preferences)';
    if (currentPath.includes('/notifications')) return 'Trung Tâm Thông Báo';
    if (currentPath.includes('/activity')) return 'Lịch Sử Hoạt Động';
    if (currentPath.includes('/help')) return 'Trợ Giúp & Hỗ Trợ (Help & Support)';
    return 'Bảng Điều Khiển Cá Nhân';
  };

  const userDisplayName = user?.full_name || user?.name || 'Nguyễn Văn An';
  const userInitials = userDisplayName
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .slice(-2)
    .join('')
    .toUpperCase() || 'NA';

  const canAccessAdmin = (isSuperAdmin && isSuperAdmin(user)) || (isAdmin && isAdmin(user));

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

        {/* User Profile Dropdown */}
        <div ref={profileDropdownRef} style={{ position: 'relative' }}>
          <button
            type="button"
            onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '4px 6px',
              borderRadius: '9px',
              border: '1px solid #E2E8F0',
              backgroundColor: '#FFFFFF',
              cursor: 'pointer',
            }}
          >
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #059669 0%, #10B981 100%)',
                color: '#FFFFFF',
                fontWeight: 700,
                fontSize: '0.8125rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {userInitials}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left', minWidth: '90px' }}>
              <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#0F172A', lineHeight: 1.2 }}>
                {userDisplayName}
              </span>
              <span style={{ fontSize: '0.6875rem', color: '#059669', fontWeight: 600 }}>Tài Khoản Cá Nhân</span>
            </div>
            <ChevronDown size={14} color="#64748B" />
          </button>

          {/* Profile Dropdown */}
          {isProfileDropdownOpen && (
            <div
              style={{
                position: 'absolute',
                right: 0,
                top: '100%',
                marginTop: '6px',
                width: '240px',
                backgroundColor: '#FFFFFF',
                borderRadius: '10px',
                border: '1px solid #E2E8F0',
                boxShadow: '0 10px 25px rgba(0, 0, 0, 0.08)',
                padding: '8px',
                zIndex: 100,
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setIsProfileDropdownOpen(false);
                  onNavigate && onNavigate('/portal/profile');
                }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: 'transparent',
                  color: '#334155',
                  cursor: 'pointer',
                  fontSize: '0.8125rem',
                  fontWeight: 500,
                  textAlign: 'left',
                }}
              >
                <User size={16} color="#059669" />
                <span>Xem Hồ Sơ Cá Nhân</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsProfileDropdownOpen(false);
                  onNavigate && onNavigate('/portal/security');
                }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: 'transparent',
                  color: '#334155',
                  cursor: 'pointer',
                  fontSize: '0.8125rem',
                  fontWeight: 500,
                  textAlign: 'left',
                }}
              >
                <ShieldCheck size={16} color="#0284C7" />
                <span>Bảo Mật & Đổi Mật Khẩu</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsProfileDropdownOpen(false);
                  onNavigate && onNavigate('/dashboard');
                }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: 'transparent',
                  color: '#334155',
                  cursor: 'pointer',
                  fontSize: '0.8125rem',
                  fontWeight: 500,
                  textAlign: 'left',
                }}
              >
                <LayoutDashboard size={16} color="#059669" />
                <span>Bàn Điều Khiển Doanh Nghiệp</span>
              </button>

              {canAccessAdmin && (
                <button
                  type="button"
                  onClick={() => {
                    setIsProfileDropdownOpen(false);
                    onNavigate && onNavigate('/admin');
                  }}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: 'transparent',
                    color: '#334155',
                    cursor: 'pointer',
                    fontSize: '0.8125rem',
                    fontWeight: 500,
                    textAlign: 'left',
                  }}
                >
                  <Building2 size={16} color="#8B5CF6" />
                  <span>Cổng Quản Trị Hệ Thống</span>
                </button>
              )}

              <div style={{ height: '1px', backgroundColor: '#E2E8F0', margin: '6px 0' }} />

              <button
                type="button"
                onClick={() => {
                  setIsProfileDropdownOpen(false);
                  if (logout) logout();
                  if (onNavigate) onNavigate('/login');
                }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: '#FEF2F2',
                  color: '#DC2626',
                  cursor: 'pointer',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  textAlign: 'left',
                }}
              >
                <LogOut size={16} color="#DC2626" />
                <span>Đăng Xuất Tài Khoản</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default PersonalHeader;
