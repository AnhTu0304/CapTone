import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Bell,
} from 'lucide-react';
import { personalPortalService } from '../../services/personalPortalService';
import UserProfileDropdown from '../common/UserProfileDropdown';
import LanguageSwitcherCompact from '../common/LanguageSwitcherCompact';

export const PersonalHeader = ({
  currentPath = '/portal',
  onNavigate,
  isCollapsed = false,
  onToggleCollapse,
  onToggleMobileDrawer,
}) => {
  const { t } = useTranslation('portal');
  const notifs = personalPortalService.getNotifications();
  const unreadCount = notifs.filter((n) => !n.read).length;

  // Compute breadcrumb title based on path
  const getPageTitle = () => {
    if (currentPath.includes('/companies')) return t('header.titles.companies');
    if (currentPath.includes('/profile')) return t('header.titles.profile');
    if (currentPath.includes('/security')) return t('header.titles.security');
    if (currentPath.includes('/preferences')) return t('header.titles.preferences');
    if (currentPath.includes('/notifications')) return t('header.titles.notifications');
    if (currentPath.includes('/activity')) return t('header.titles.activity');
    if (currentPath.includes('/help')) return t('header.titles.help');
    return t('header.titles.dashboard');
  };

  return (
    <header
      className="portal-top-header"
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
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
        {/* Toggle Collapse (Desktop / Tablet) */}
        <button
          type="button"
          className="portal-collapse-toggle"
          onClick={onToggleCollapse}
          aria-label={isCollapsed ? t('header.expandSidebar') : t('header.collapseSidebar')}
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
            flexShrink: 0,
          }}
        >
          {isCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        </button>

        {/* Mobile Hamburger */}
        {onToggleMobileDrawer && (
          <button
            type="button"
            onClick={onToggleMobileDrawer}
            className="portal-mobile-toggle"
            aria-label={t('header.navAria')}
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '9px',
              border: '1px solid #E2E8F0',
              backgroundColor: '#FFFFFF',
              color: '#475569',
              display: 'none',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <Menu size={18} />
          </button>
        )}

        {/* Breadcrumb Info */}
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <div
            className="portal-breadcrumb-sub"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: '#64748B' }}
          >
            <span>{t('header.centerTitle')}</span>
            <span>/</span>
            <span style={{ color: '#059669', fontWeight: 600 }}>{getPageTitle()}</span>
          </div>
          <div
            style={{
              fontSize: '0.9375rem',
              fontWeight: 800,
              color: '#0F172A',
              lineHeight: 1.2,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {getPageTitle()}
          </div>
        </div>
      </div>

      {/* Right Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
        <LanguageSwitcherCompact height="36px" />

        {/* Notifications Icon Button */}
        <button
          type="button"
          onClick={() => onNavigate && onNavigate('/portal/notifications')}
          title={t('header.notificationsTitle')}
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
